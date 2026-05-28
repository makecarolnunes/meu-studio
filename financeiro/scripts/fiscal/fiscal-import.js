// ════════════════════════════════════════════════════════════
// fiscal-import.js — Orquestrador do fluxo de import
// ════════════════════════════════════════════════════════════
//
// Fluxo:
//   1) usuário escolhe arquivo
//   2) parse → preview (transações detectadas + dedup contra hash existente)
//   3) pré-conciliação contra saidas existentes (data+valor)
//   4) categorização (regras + IA)
//   5) tela de revisão
//   6) aprovar → cria saida + fiscal_despesa, atualiza raw
// ════════════════════════════════════════════════════════════

window.FS_IMPORT = {
  estado: 'idle',     // idle|parseando|categorizando|revisando|salvando
  parsed: null,       // { transacoes, banco, conta, periodoIni, periodoFim }
  comHash: [],        // transacoes com hash calculado
  preview: null,      // { novas: [], duplicadas: [], possiveis: [] }
  categorizadas: [],  // após IA
  importacaoId: '',
  fileName: '',
};

// Entrada principal — chamada pelo botão "Importar extrato"
function fsImportAbrir() {
  document.getElementById('fs-modal-inner').innerHTML = `
    <h2>Importar extrato</h2>
    <p>Aceita arquivos <b>OFX</b> ou <b>CSV</b> do seu banco. As receitas ficam só pra conciliação — não criam nada no Financeiro. As saídas viram saídas no Financeiro + despesas no Fiscal.</p>
    <div class="fs-field">
      <label>Arquivo do extrato</label>
      <input type="file" id="fs-import-file" accept=".ofx,.csv,.txt" class="fs-file-input">
      <div class="fs-field-hint">Nubank, Inter, Itaú, Banco do Brasil etc.</div>
    </div>
    <div class="fs-modal-actions">
      <button class="fs-btn fs-btn-ghost" onclick="fiscalModalClose()">Cancelar</button>
      <button class="fs-btn fs-btn-primary" onclick="fsImportProcessar()">Continuar</button>
    </div>
  `;
  document.getElementById('fs-modal-bg').style.display = 'flex';
}

async function fsImportProcessar() {
  const inp = document.getElementById('fs-import-file');
  const file = inp && inp.files && inp.files[0];
  if (!file) { fsToast('Selecione um arquivo'); return; }
  FS_IMPORT.fileName = file.name;
  FS_IMPORT.estado = 'parseando';
  fsImportRenderLoading('Lendo arquivo...');

  try {
    FS_IMPORT.parsed = await fsParseArquivo(file);
  } catch (err) {
    fsImportRenderErro(err.message || 'Erro ao ler arquivo');
    return;
  }

  // Calcula hash de cada transação
  const banco = FS_IMPORT.parsed.banco || 'Banco';
  const comHash = [];
  for (const t of FS_IMPORT.parsed.transacoes) {
    const hash = await fsHashTransacao(banco, t.data, t.valor, t.descricao);
    comHash.push({ ...t, hash, banco });
  }
  FS_IMPORT.comHash = comHash;

  // Dedup contra hashes já no banco (carrega lista de hashes existentes)
  await fsImportDedupAndPreview();
  fsImportRenderPreview();
}

async function fsImportDedupAndPreview() {
  // Carrega hashes existentes (limita ao período da importação +/- 1 ano pra eficiência)
  let existentes = [];
  try {
    existentes = await DB.fiscal.transacoes.list();
  } catch(_) { existentes = []; }
  const hashesExist = new Set(existentes.map(t => t.hash).filter(Boolean));

  const novas = [];
  const duplicadas = [];
  for (const t of FS_IMPORT.comHash) {
    if (hashesExist.has(t.hash)) duplicadas.push(t);
    else novas.push(t);
  }

  // Pré-conciliação contra `saidas` existentes (apenas débitos)
  // Match: mesma data ±2 dias + mesmo |valor| (±R$0,01)
  // Em financeiro: usa window.saidas (global do módulo).
  // Em fiscal: usa FS.saidas (carregado em fiscalRefresh).
  const saidasAll = (FS.saidas && FS.saidas.length)
    ? FS.saidas
    : (Array.isArray(window.saidas) ? window.saidas : []);
  const possiveis = [];
  for (const t of novas) {
    if (t.valor >= 0) continue; // só débitos pra conciliação com saidas
    const abs = Math.abs(t.valor);
    const tdate = new Date(t.data);
    const match = saidasAll.find(s => {
      const sv = parseFloat(s.valor) || 0;
      if (Math.abs(sv - abs) > 0.01) return false;
      const sd = new Date(s.dataPag);
      if (isNaN(sd) || isNaN(tdate)) return false;
      const diff = Math.abs((tdate - sd) / (1000 * 3600 * 24));
      return diff <= 2;
    });
    if (match) {
      possiveis.push({ raw: t, saida: match });
    }
  }

  FS_IMPORT.preview = { novas, duplicadas, possiveis };
}

function fsImportRenderLoading(msg) {
  document.getElementById('fs-modal-inner').innerHTML = `
    <h2>${msg}</h2>
    <div style="display:flex;justify-content:center;padding:var(--space-6)">
      <div class="fs-spinner"></div>
    </div>
  `;
}

function fsImportRenderErro(msg) {
  document.getElementById('fs-modal-inner').innerHTML = `
    <h2>Não consegui ler o arquivo</h2>
    <p>${msg}</p>
    <div class="fs-modal-actions">
      <button class="fs-btn fs-btn-ghost" onclick="fiscalModalClose()">Fechar</button>
      <button class="fs-btn fs-btn-primary" onclick="fsImportAbrir()">Tentar outro</button>
    </div>
  `;
}

function fsImportRenderPreview() {
  const { novas, duplicadas, possiveis } = FS_IMPORT.preview;
  const p = FS_IMPORT.parsed;

  const periodo = (p.periodoIni && p.periodoFim)
    ? `${fsFmtDataBr(p.periodoIni)} → ${fsFmtDataBr(p.periodoFim)}`
    : '—';

  document.getElementById('fs-modal-inner').innerHTML = `
    <h2>Pronto pra revisar</h2>
    <div class="fs-import-stat">
      <div><span class="fs-stat-num">${novas.length}</span><span class="fs-stat-lbl">novas</span></div>
      <div><span class="fs-stat-num">${duplicadas.length}</span><span class="fs-stat-lbl">já importadas</span></div>
      <div><span class="fs-stat-num">${possiveis.length}</span><span class="fs-stat-lbl">possíveis duplicatas no Financeiro</span></div>
    </div>

    <div class="fs-import-meta">
      <div><b>Banco:</b> ${p.banco}</div>
      <div><b>Período:</b> ${periodo}</div>
      <div><b>Arquivo:</b> ${FS_IMPORT.fileName}</div>
    </div>

    ${possiveis.length ? `
      <div class="fs-import-warn">
        <b>⚠ ${possiveis.length} transação(ões)</b> têm data/valor parecidos com saídas já lançadas. Na revisão, você decide se é a mesma ou outra compra.
      </div>
    ` : ''}

    ${duplicadas.length ? `
      <div class="fs-import-info">
        ${duplicadas.length} transação(ões) já foram importadas antes — serão ignoradas.
      </div>
    ` : ''}

    <div class="fs-modal-actions">
      <button class="fs-btn fs-btn-ghost" onclick="fiscalModalClose()">Cancelar</button>
      <button class="fs-btn fs-btn-primary" onclick="fsImportCategorizar()" ${!novas.length?'disabled':''}>
        ${novas.length ? `Categorizar ${novas.length} com IA` : 'Nada a importar'}
      </button>
    </div>
  `;
}

async function fsImportCategorizar() {
  FS_IMPORT.estado = 'categorizando';
  fsImportRenderLoading('Categorizando com IA...');

  // Carrega regras do DB
  let regrasDb = [];
  try { regrasDb = await DB.fiscal.regras.list(); } catch(_) {}
  FS.regras = regrasDb;

  const novas = FS_IMPORT.preview.novas;
  const possiveisSet = new Set(FS_IMPORT.preview.possiveis.map(x => x.raw.hash));

  const categorizadas = await fsCategorizarLote(novas, regrasDb);

  // Marca as que tem possível duplicata
  categorizadas.forEach(c => {
    if (possiveisSet.has(c.hash)) {
      const m = FS_IMPORT.preview.possiveis.find(x => x.raw.hash === c.hash);
      c._possivelDuplicata = m ? m.saida : null;
    }
  });

  FS_IMPORT.categorizadas = categorizadas;
  FS_IMPORT.importacaoId = 'imp_' + Date.now();
  fsImportRenderRevisao();
}

// ── Tela de revisão ─────────────────────────────────────────
window.FS_REV = {
  idx: 0,
  decisoes: {},  // hash → { acao, categoria, natureza, vincularSaidaId? }
};

function fsImportRenderRevisao() {
  // Inicializa estado da revisão a partir das sugestões da IA
  FS_REV.decisoes = {};
  FS_IMPORT.categorizadas.forEach(c => {
    if (c.naturezaSugerida === 'IGNORAR' || c.valor >= 0) {
      FS_REV.decisoes[c.hash] = { acao: c.valor >= 0 ? 'receita' : 'ignorar', categoria: c.categoriaSugerida, natureza: c.naturezaSugerida };
    } else {
      FS_REV.decisoes[c.hash] = {
        acao: c._possivelDuplicata ? 'duplicata-pendente' : 'aprovar',
        categoria: c.categoriaSugerida || '',
        natureza: c.naturezaSugerida || 'PENDENTE',
        vincularSaidaId: null,
      };
    }
  });
  FS_REV.idx = 0;
  fsImportRenderItem();
}

function fsImportRenderItem() {
  const total = FS_IMPORT.categorizadas.length;
  if (FS_REV.idx >= total) return fsImportRenderResumoFinal();
  const t = FS_IMPORT.categorizadas[FS_REV.idx];
  const dec = FS_REV.decisoes[t.hash];

  // Receitas só são marcadas pra conciliação reversa (não criam nada)
  if (t.valor >= 0) {
    return fsImportRenderItemReceita(t);
  }

  // Despesas: tela de aprovação
  const confLabel = t.confiancaIa >= 0.85 ? 'Alta confiança' : t.confiancaIa >= 0.6 ? 'Sugestão' : 'Pouca certeza';
  const confCls = t.confiancaIa >= 0.85 ? 'ok' : t.confiancaIa >= 0.6 ? 'warn' : 'danger';

  const cats = window.FS_CATEGORIAS.filter(c => c.nat !== 'IGNORAR' && c.id !== 'das').map(c => c.nome);

  // Possível duplicata?
  const dup = t._possivelDuplicata;
  const dupHtml = dup ? `
    <div class="fs-rev-dup">
      <b>⚠ Possível duplicata</b>
      <div>Já existe no Financeiro: <b>${dup.tipo}</b> · ${fsFmtDataBr(dup.dataPag)} · ${fsBrl(parseFloat(dup.valor)||0)}</div>
      <div class="fs-rev-dup-actions">
        <button class="fs-mini-btn ${dec.acao==='vincular'?'on':''}" onclick="fsImportDecidir('${t.hash}','vincular','${dup.id}')">Vincular (não criar nova)</button>
        <button class="fs-mini-btn ${dec.acao==='aprovar'?'on':''}" onclick="fsImportDecidir('${t.hash}','aprovar')">Criar mesmo assim</button>
        <button class="fs-mini-btn ${dec.acao==='ignorar'?'on':''}" onclick="fsImportDecidir('${t.hash}','ignorar')">Ignorar</button>
      </div>
    </div>
  ` : '';

  document.getElementById('fs-modal-inner').innerHTML = `
    <div class="fs-rev-progress">${FS_REV.idx+1} de ${total}</div>
    <div class="fs-rev-card">
      <div class="fs-rev-desc">${t.descricao || '(sem descrição)'}</div>
      <div class="fs-rev-meta">${fsFmtDataBr(t.data)} · ${t.banco}</div>
      <div class="fs-rev-valor">${fsBrl(Math.abs(t.valor))}</div>
      <div class="fs-rev-conf ${confCls}">${confLabel} · ${Math.round((t.confiancaIa||0)*100)}%</div>
    </div>

    ${dupHtml}

    ${!dup || dec.acao !== 'vincular' ? `
      <div class="fs-field">
        <label>Natureza</label>
        <div class="fs-regime-pills">
          <button class="fs-regime-pill ${dec.natureza==='PROFISSIONAL'?'selected':''}" onclick="fsImportSetNat('${t.hash}','PROFISSIONAL')">Profissional</button>
          <button class="fs-regime-pill ${dec.natureza==='PESSOAL'?'selected':''}" onclick="fsImportSetNat('${t.hash}','PESSOAL')">Pessoal</button>
          <button class="fs-regime-pill ${dec.natureza==='MISTA'?'selected':''}" onclick="fsImportSetNat('${t.hash}','MISTA')">Mista</button>
        </div>
      </div>

      ${dec.natureza !== 'PESSOAL' ? `
        <div class="fs-field">
          <label>Categoria</label>
          <div class="fs-cat-grid">
            ${cats.filter(c => c !== 'Pessoal').map(c => `
              <button class="fs-cat-pill ${dec.categoria===c?'selected':''}" onclick="fsImportSetCat('${t.hash}','${c.replace(/'/g, "\\'")}')">${fsCategoriaIcone(c)} ${c}</button>
            `).join('')}
          </div>
        </div>
      ` : ''}
    ` : ''}

    <div class="fs-modal-actions" style="gap:6px">
      ${FS_REV.idx>0?`<button class="fs-btn fs-btn-ghost" style="flex:0 0 48px;padding:14px 0" onclick="fsImportItem(-1)">‹</button>`:''}
      <button class="fs-btn fs-btn-ghost" onclick="fsImportDecidir('${t.hash}','ignorar', null, true)">Ignorar</button>
      <button class="fs-btn fs-btn-primary" onclick="fsImportItem(1)">${FS_REV.idx===total-1?'Concluir':'Próxima'} ›</button>
    </div>
  `;
}

function fsImportRenderItemReceita(t) {
  const total = FS_IMPORT.categorizadas.length;
  document.getElementById('fs-modal-inner').innerHTML = `
    <div class="fs-rev-progress">${FS_REV.idx+1} de ${total}</div>
    <div class="fs-rev-card fs-rev-card-receita">
      <div class="fs-rev-tag">💰 Receita</div>
      <div class="fs-rev-desc">${t.descricao || '(sem descrição)'}</div>
      <div class="fs-rev-meta">${fsFmtDataBr(t.data)} · ${t.banco}</div>
      <div class="fs-rev-valor" style="color:var(--success)">+${fsBrl(Math.abs(t.valor))}</div>
    </div>
    <p style="color:var(--text-muted);font-size:var(--text-sm);line-height:var(--leading-normal);margin-top:var(--space-3)">
      Receitas não são lançadas automaticamente. Confira no Financeiro se você já lançou — ela só é guardada aqui pra controle.
    </p>
    <div class="fs-modal-actions">
      ${FS_REV.idx>0?`<button class="fs-btn fs-btn-ghost" style="flex:0 0 48px;padding:14px 0" onclick="fsImportItem(-1)">‹</button>`:''}
      <button class="fs-btn fs-btn-primary" onclick="fsImportItem(1)">${FS_REV.idx===total-1?'Concluir':'Próxima'} ›</button>
    </div>
  `;
}

function fsImportSetNat(hash, nat) {
  const dec = FS_REV.decisoes[hash];
  dec.natureza = nat;
  if (nat === 'PESSOAL') dec.categoria = 'Pessoal';
  // Usuário tocou na natureza → intenção é aprovar (sobrescreve 'ignorar' que veio
  // da sugestão IGNORAR da IA). Mantém 'vincular' se estava conciliando duplicata.
  if (dec.acao !== 'vincular') dec.acao = 'aprovar';
  fsImportRenderItem();
}
function fsImportSetCat(hash, cat) {
  const dec = FS_REV.decisoes[hash];
  dec.categoria = cat;
  const c = fsCategoriaByNome(cat);
  if (c && c.nat === 'PESSOAL') dec.natureza = 'PESSOAL';
  if (dec.acao !== 'vincular') dec.acao = 'aprovar';
  fsImportRenderItem();
}
function fsImportDecidir(hash, acao, vincularId, avancar) {
  const dec = FS_REV.decisoes[hash];
  dec.acao = acao;
  if (vincularId) dec.vincularSaidaId = vincularId;
  if (avancar) fsImportItem(1);
  else fsImportRenderItem();
}
function fsImportItem(dir) {
  FS_REV.idx = Math.max(0, Math.min(FS_IMPORT.categorizadas.length, FS_REV.idx + dir));
  if (FS_REV.idx >= FS_IMPORT.categorizadas.length) fsImportRenderResumoFinal();
  else fsImportRenderItem();
}

function fsImportRenderResumoFinal() {
  let aprovar = 0, vincular = 0, ignorar = 0, pessoal = 0, profissional = 0, receitas = 0;
  for (const t of FS_IMPORT.categorizadas) {
    const d = FS_REV.decisoes[t.hash];
    if (t.valor >= 0) { receitas++; continue; }
    if (d.acao === 'aprovar') {
      aprovar++;
      if (d.natureza === 'PESSOAL') pessoal++;
      else profissional++;
    }
    else if (d.acao === 'vincular') vincular++;
    else ignorar++;
  }

  document.getElementById('fs-modal-inner').innerHTML = `
    <h2>Confirmar importação</h2>
    <div class="fs-import-stat" style="grid-template-columns:1fr 1fr 1fr">
      <div><span class="fs-stat-num">${aprovar}</span><span class="fs-stat-lbl">novas saídas</span></div>
      <div><span class="fs-stat-num">${vincular}</span><span class="fs-stat-lbl">vinculadas</span></div>
      <div><span class="fs-stat-num">${ignorar}</span><span class="fs-stat-lbl">ignoradas</span></div>
    </div>
    <p style="color:var(--text-muted);font-size:var(--text-sm)">
      Serão criadas <b>${profissional}</b> saídas profissionais e <b>${pessoal}</b> pessoais.
      ${receitas?`<br>${receitas} receita(s) serão guardadas só para conciliação.`:''}
    </p>
    <div class="fs-modal-actions">
      <button class="fs-btn fs-btn-ghost" onclick="FS_REV.idx=0;fsImportRenderItem()">Voltar</button>
      <button class="fs-btn fs-btn-primary" onclick="fsImportSalvar()">Confirmar</button>
    </div>
  `;
}

async function fsImportSalvar() {
  fsImportRenderLoading('Salvando...');
  const importacaoId = FS_IMPORT.importacaoId;

  // 1) Cria saidas + despesas + atualiza raw transactions
  const novasSaidas = [];
  const novasDespesas = [];
  const rawsParaSalvar = [];

  for (const t of FS_IMPORT.categorizadas) {
    const dec = FS_REV.decisoes[t.hash];
    const baseRaw = {
      id: 'raw_' + Date.now() + '_' + Math.random().toString(36).slice(2,7),
      importacaoId, banco: t.banco, conta: FS_IMPORT.parsed.conta,
      data: t.data, descricao: t.descricao, valor: t.valor,
      tipoMov: t.valor >= 0 ? 'CREDITO' : 'DEBITO',
      hash: t.hash,
      categoriaSugerida: t.categoriaSugerida || null,
      naturezaSugerida: t.naturezaSugerida || null,
      confiancaIa: t.confiancaIa,
    };

    // Receitas
    if (t.valor >= 0) {
      rawsParaSalvar.push({ ...baseRaw, status: 'APROVADA_RECEITA' });
      continue;
    }
    // Ignorar
    if (dec.acao === 'ignorar' || dec.acao === 'duplicata-pendente') {
      rawsParaSalvar.push({ ...baseRaw, status: 'IGNORADA' });
      continue;
    }
    // Vincular a saida existente
    if (dec.acao === 'vincular' && dec.vincularSaidaId) {
      rawsParaSalvar.push({ ...baseRaw, status: 'VINCULADA', saidaExistenteId: dec.vincularSaidaId });
      continue;
    }
    // Aprovar: cria saida + despesa
    const valorAbs = Math.abs(t.valor);
    const natureza = dec.natureza || 'PROFISSIONAL';
    const categoria = natureza === 'PESSOAL' ? 'Pessoal' : (dec.categoria || 'Outro');
    const saidaId = 'sai_' + Date.now() + '_' + Math.random().toString(36).slice(2,7);
    const despId = 'desp_' + Date.now() + '_' + Math.random().toString(36).slice(2,7);

    novasSaidas.push({
      id: saidaId,
      dataPag: t.data,
      tipo: categoria,
      valor: String(valorAbs),
      forma: 'Crédito',     // banco; usuário pode editar depois
      status: 'Pago',
      obs: 'Importado: ' + (t.descricao || ''),
      recorrencia: 'unica',
      grupoId: null,
      natureza,
      createdAt: new Date().toISOString(),
    });

    const catObj = fsCategoriaByNome(categoria);
    novasDespesas.push({
      id: despId,
      saidaId,
      data: t.data,
      descricao: t.descricao,
      valor: valorAbs,
      categoria,
      natureza,
      dedutivel: catObj ? catObj.dedutivel : false,
      origem: FS_IMPORT.fileName.toLowerCase().endsWith('.ofx') ? 'ofx' : 'csv',
      transacaoRawId: baseRaw.id,
      obs: '',
    });

    rawsParaSalvar.push({
      ...baseRaw, status: 'APROVADA',
      saidaId, despesaId: despId,
    });

    // Aprendizado de regra
    try { await fsAprenderRegra(t.descricao, categoria, natureza); } catch(_) {}
  }

  // 2) Persiste: raws (batch), saidas (uma a uma — via sbCall pra reaproveitar fluxo do financeiro)
  try {
    if (rawsParaSalvar.length) await DB.fiscal.transacoes.insertBatch(rawsParaSalvar);
  } catch (err) {
    console.error('[fiscal-import] erro salvando raw:', err);
  }

  // Salva saidas — usa DB direto (financeiro state será resincronizado depois)
  for (const s of novasSaidas) {
    try { await DB.saidas.upsert(s); } catch (err) { console.error('[fiscal-import] saida fail', err); }
  }
  for (const d of novasDespesas) {
    try { await DB.fiscal.despesas.upsert(d); } catch (err) { console.error('[fiscal-import] despesa fail', err); }
  }

  // 3) Atualiza state e fecha modal
  FS.saidas   = [...(FS.saidas   || []), ...novasSaidas];
  FS.despesas = [...(FS.despesas || []), ...novasDespesas];
  fiscalModalClose();
  fsToast(`${novasSaidas.length} saída(s) importada(s)!`);

  // Refresh sensível ao contexto da página atual
  const ehPaginaFiscal     = !!document.getElementById('fiscal-app');
  const ehPaginaFinanceiro = !!document.getElementById('app') && !ehPaginaFiscal;

  if (ehPaginaFinanceiro && typeof window.loadFromSupabase === 'function') {
    // Recarrega tudo do financeiro (saidas, entries, noivas) — fonte da verdade
    try { await window.loadFromSupabase(); } catch(_) {}
  } else if (ehPaginaFiscal && typeof window.fiscalRefresh === 'function') {
    try { await window.fiscalRefresh(); } catch(_) {}
  }
}

// Helper: fmt data BR
function fsFmtDataBr(s) {
  if (!s) return '';
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
}
