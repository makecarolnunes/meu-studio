// ════════════════════════════════════════════════════════════
// financeiro/scripts/fiscal/fiscal-ir.js  (Sprint 4)
// Aba IR: resumo anual + documentos fiscais.
// ════════════════════════════════════════════════════════════

const FS_IR_TIPOS = [
  { v: 'DASN_SIMEI',  l: 'DASN-SIMEI',  ico: '📋' },
  { v: 'RECIBO',      l: 'Recibo',      ico: '🧾' },
  { v: 'INFORME',     l: 'Informe',     ico: '📨' },
  { v: 'NF',          l: 'Nota Fiscal', ico: '📑' },
  { v: 'COMPROVANTE', l: 'Comprovante', ico: '📎' },
  { v: 'OUTRO',       l: 'Outro',       ico: '📄' },
];

// 7 itens canônicos do checklist IR para MEI prestador de serviços.
// Sequência reflete a ordem natural de preparação anual.
const FS_IR_CHECKLIST = [
  {
    key:   'conferir_receita',
    titulo: 'Conferir receita bruta gerada',
    hint:   'Confira o total do ano no cartão acima. Deve bater com seus extratos bancários.',
  },
  {
    key:   'categorizar_pendentes',
    titulo: 'Categorizar transações pendentes',
    hint:   'Vá em Despesas → filtre PENDENTE e classifique cada uma como profissional/pessoal.',
  },
  {
    key:   'upload_dasn',
    titulo: 'Baixar e anexar DASN-SIMEI',
    hint:   'Declaração anual MEI no portal Gov.br até 31/05. Anexe abaixo após emitir.',
  },
  {
    key:   'recibos_atividade',
    titulo: 'Recibos de cursos e equipamentos',
    hint:   'Comprovam que você exerceu atividade profissional. Bom ter mesmo se MEI não exige.',
  },
  {
    key:   'informe_clt',
    titulo: 'Informe de rendimentos CLT (se houve)',
    hint:   'Se trabalhou registrada em parte do ano, pegue com o empregador até 28/02.',
  },
  {
    key:   'comprovantes_bens',
    titulo: 'Comprovantes de bens > R$ 5.000',
    hint:   'Carro, imóvel, investimentos. Necessários se você declarar IRPF como PF.',
  },
  {
    key:   'dedutiveis_irpf',
    titulo: 'Dedutíveis: plano de saúde, INSS, dependentes',
    hint:   'Recibos de plano de saúde, contribuição INSS além do MEI, despesas com dependentes.',
  },
];

const FS_IR_STATUS_CYCLE = { pendente: 'em_progresso', em_progresso: 'concluido', concluido: 'pendente' };
const FS_IR_STATUS_LABEL = { pendente: 'Pendente', em_progresso: 'Em progresso', concluido: 'Concluído' };

function _fsIrTipoLabel(v) {
  const t = FS_IR_TIPOS.find(x => x.v === v);
  return t ? t.l : v;
}
function _fsIrTipoIcon(v) {
  const t = FS_IR_TIPOS.find(x => x.v === v);
  return t ? t.ico : '📄';
}

// ── Cálculo do resumo anual ─────────────────────────────────
function fsIrComputeResumo(ano) {
  const inAno = (s) => {
    if (!s) return false;
    const y = parseInt(String(s).slice(0, 4));
    return y === ano;
  };

  const entriesAno = (FS.entries || []).filter(e => inAno(e.dataPag));
  const saidasAno  = (FS.saidas  || []).filter(s => inAno(s.dataPag));
  const dasAno     = (FS.das     || []).filter(d => inAno(d.competencia));
  const docsAno    = (FS.documentos || []).filter(d => d.ano === ano);

  const receitaBruta = entriesAno
    .filter(e => e.status === 'Realizado')
    .reduce((t, e) => t + Number(e.valor || 0), 0);

  const receitaPrev = entriesAno
    .filter(e => e.status === 'Previsto')
    .reduce((t, e) => t + Number(e.valor || 0), 0);

  const despesasProf = saidasAno
    .filter(s => (s.natureza || 'PROFISSIONAL') === 'PROFISSIONAL' && s.status === 'Pago')
    .reduce((t, s) => t + Number(s.valor || 0), 0);

  const lucroContabil = receitaBruta - despesasProf;
  // Regra dos 32% para serviços MEI/Simples
  const lucroIsento   = receitaBruta * 0.32;
  const lucroTributavel = Math.max(0, lucroContabil - lucroIsento);

  const dasPagos = dasAno.filter(d => d.pago);
  const totalDas = dasPagos.reduce((t, d) => t + Number(d.valor || 0), 0);

  return {
    ano,
    receitaBruta, receitaPrev,
    despesasProf, lucroContabil,
    lucroIsento, lucroTributavel,
    dasPagosCount: dasPagos.length,
    totalDas,
    docsCount: docsAno.length,
  };
}

// ── Render principal da aba IR ──────────────────────────────
function fsRenderIR() {
  const el = document.getElementById('fs-content');
  if (!el) return;

  const ano = FS.selYearIR || new Date().getFullYear();
  const r = fsIrComputeResumo(ano);
  const anoAtual = new Date().getFullYear();
  const anosDisp = [anoAtual, anoAtual - 1, anoAtual - 2];

  el.innerHTML = `
  <div id="fs-ir-printable">
    <div class="fs-ir-yearbar fs-no-print">
      ${anosDisp.map(y => `
        <button class="fs-pill ${y === ano ? 'on' : ''}" onclick="fsIrSetYear(${y})">${y}</button>
      `).join('')}
    </div>

    <div class="fs-card fs-ir-resumo">
      <div class="fs-card-title">Resumo fiscal ${ano}</div>

      <div class="fs-ir-row">
        <span class="fs-ir-lbl">Receita bruta MEI</span>
        <strong class="fs-ir-val ok">${fsBrl(r.receitaBruta)}</strong>
      </div>
      ${r.receitaPrev > 0 ? `
      <div class="fs-ir-row fs-ir-row--sub">
        <span class="fs-ir-lbl">+ previsto no ano</span>
        <span class="fs-ir-val">${fsBrl(r.receitaPrev)}</span>
      </div>` : ''}

      <div class="fs-ir-row">
        <span class="fs-ir-lbl">Despesas profissionais (pagas)</span>
        <strong class="fs-ir-val danger">${fsBrl(r.despesasProf)}</strong>
      </div>

      <div class="fs-ir-row fs-ir-row--big">
        <span class="fs-ir-lbl">Lucro contábil</span>
        <strong class="fs-ir-val">${fsBrl(r.lucroContabil)}</strong>
      </div>

      <div class="fs-ir-divider"></div>

      <div class="fs-ir-row">
        <span class="fs-ir-lbl">Lucro isento (32% serviços)</span>
        <strong class="fs-ir-val ok">${fsBrl(r.lucroIsento)}</strong>
      </div>
      <div class="fs-ir-help">
        Regra dos 32% para atividade de serviços. Esse valor entra no IRPF como
        rendimento <strong>isento</strong>.
      </div>

      <div class="fs-ir-row fs-ir-row--big">
        <span class="fs-ir-lbl">Lucro tributável</span>
        <strong class="fs-ir-val ${r.lucroTributavel > 0 ? 'danger' : ''}">${fsBrl(r.lucroTributavel)}</strong>
      </div>
      ${r.lucroTributavel > 0 ? `
      <div class="fs-ir-help">
        Excede a regra dos 32%. Lance no IRPF como <strong>rendimento tributável</strong>
        recebido de pessoa jurídica (você mesma, via MEI).
      </div>` : ''}

      <div class="fs-ir-divider"></div>

      <div class="fs-ir-row">
        <span class="fs-ir-lbl">DAS pagos no ano</span>
        <strong class="fs-ir-val">${r.dasPagosCount}/12 · ${fsBrl(r.totalDas)}</strong>
      </div>
      <div class="fs-ir-row">
        <span class="fs-ir-lbl">Documentos anexados</span>
        <strong class="fs-ir-val">${r.docsCount}</strong>
      </div>

      <button class="fs-btn fs-btn-ghost fs-no-print" style="margin-top:14px" onclick="fsIrPrint()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px;margin-right:6px"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
        Imprimir / Salvar como PDF
      </button>
    </div>

    ${_fsIrRenderChecklist(ano)}

    <div class="fs-card fs-no-print-bg">
      <div class="fs-ir-docs-head">
        <div class="fs-card-title" style="margin:0">Documentos do ano</div>
        <button class="fs-btn fs-btn-primary fs-no-print" style="padding:9px 16px;font-size:13px" onclick="fsIrOpenUpload()">
          + Anexar
        </button>
      </div>

      <div class="fs-ir-filters fs-no-print">
        <button class="fs-pill ${FS.irTipoFilter === 'todos' ? 'on' : ''}" onclick="fsIrSetTipoFilter('todos')">Todos</button>
        ${FS_IR_TIPOS.map(t => `
          <button class="fs-pill ${FS.irTipoFilter === t.v ? 'on' : ''}" onclick="fsIrSetTipoFilter('${t.v}')">
            ${t.ico} ${t.l}
          </button>
        `).join('')}
      </div>

      ${_fsIrRenderDocsList(ano)}
    </div>
  </div>
  `;
}

function _fsIrRenderDocsList(ano) {
  const filtroTipo = FS.irTipoFilter || 'todos';
  const docs = (FS.documentos || [])
    .filter(d => d.ano === ano)
    .filter(d => filtroTipo === 'todos' || d.tipo === filtroTipo)
    .sort((a, b) => (b.uploadedAt || '').localeCompare(a.uploadedAt || ''));

  if (!docs.length) {
    return `
    <div class="fs-empty" style="padding:32px 16px">
      <h3 style="font-size:15px;margin-bottom:6px">Nenhum documento ${filtroTipo === 'todos' ? '' : 'desse tipo '}em ${ano}</h3>
      <p style="font-size:13px">Anexe DASN-SIMEI, recibos, informes ou NFs.<br>Tudo fica organizado por ano.</p>
    </div>`;
  }

  return docs.map(d => {
    const mesLabel = d.mes ? ` · ${String(d.mes).padStart(2,'0')}/${d.ano}` : '';
    return `
    <div class="fs-doc-item">
      <div class="fs-doc-ico">${_fsIrTipoIcon(d.tipo)}</div>
      <div class="fs-doc-body">
        <div class="fs-doc-title">
          <a href="${d.arquivoUrl}" target="_blank" rel="noopener">${d.descricao || d.arquivoNome || 'Documento sem nome'}</a>
        </div>
        <div class="fs-doc-meta">
          <span class="fs-doc-tipo">${_fsIrTipoLabel(d.tipo)}</span>${mesLabel}${d.emitente ? ' · ' + d.emitente : ''}
        </div>
      </div>
      <div class="fs-doc-right">
        ${d.valor != null ? `<div class="fs-doc-valor">${fsBrl(d.valor)}</div>` : ''}
        <button class="fs-doc-del fs-no-print" onclick="fsIrDeleteDoc('${d.id}', '${(d.arquivoUrl||'').split('fiscal-documentos/').pop() || ''}')" title="Excluir">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
        </button>
      </div>
    </div>`;
  }).join('');
}

// ── Handlers ─────────────────────────────────────────────────
function fsIrSetYear(y) {
  FS.selYearIR = y;
  fsRenderIR();
}

function fsIrSetTipoFilter(tipo) {
  FS.irTipoFilter = tipo;
  fsRenderIR();
}

function fsIrPrint() {
  document.body.classList.add('fs-printing');
  // Pequeno delay pra dar tempo do CSS aplicar antes da janela de print abrir
  setTimeout(() => {
    window.print();
    setTimeout(() => document.body.classList.remove('fs-printing'), 100);
  }, 50);
}

// ── Upload modal ─────────────────────────────────────────────
function fsIrOpenUpload() {
  const ano = FS.selYearIR || new Date().getFullYear();
  fiscalModalOpen(`
    <h2>Anexar documento</h2>
    <p>Suba PDF ou imagem (DASN, recibo, informe etc.).</p>

    <div class="fs-field">
      <label>Tipo</label>
      <div class="fs-ir-tipo-grid" id="fs-ir-tipo-pills">
        ${FS_IR_TIPOS.map((t, i) => `
          <button type="button" class="fs-pill ${i === 0 ? 'on' : ''}" data-tipo="${t.v}">${t.ico} ${t.l}</button>
        `).join('')}
      </div>
    </div>

    <div class="fs-field">
      <label>Descrição</label>
      <input type="text" id="fs-ir-desc" placeholder="Ex: Recibo curso de visagismo">
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="fs-field">
        <label>Ano</label>
        <input type="number" id="fs-ir-ano" value="${ano}" min="2000" max="2099">
      </div>
      <div class="fs-field">
        <label>Mês <span style="text-transform:none;letter-spacing:0;color:var(--text-subtle)">(opcional)</span></label>
        <select id="fs-ir-mes">
          <option value="">—</option>
          ${['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
            .map((m, i) => `<option value="${i+1}">${i+1} · ${m}</option>`).join('')}
        </select>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="fs-field">
        <label>Valor <span style="text-transform:none;letter-spacing:0;color:var(--text-subtle)">(opcional)</span></label>
        <input type="number" id="fs-ir-valor" step="0.01" min="0" placeholder="0,00">
      </div>
      <div class="fs-field">
        <label>Emitente <span style="text-transform:none;letter-spacing:0;color:var(--text-subtle)">(opcional)</span></label>
        <input type="text" id="fs-ir-emitente" placeholder="Ex: Receita Federal">
      </div>
    </div>

    <div class="fs-field">
      <label>Arquivo</label>
      <input type="file" id="fs-ir-file" class="fs-file-input" accept="application/pdf,image/*">
    </div>

    <div class="fs-modal-actions">
      <button class="fs-btn fs-btn-ghost" onclick="fiscalModalClose()">Cancelar</button>
      <button class="fs-btn fs-btn-primary" id="fs-ir-save" onclick="fsIrSaveUpload()">Anexar</button>
    </div>
  `);

  // Liga pills de tipo
  document.querySelectorAll('#fs-ir-tipo-pills .fs-pill').forEach(p => {
    p.addEventListener('click', () => {
      document.querySelectorAll('#fs-ir-tipo-pills .fs-pill').forEach(x => x.classList.remove('on'));
      p.classList.add('on');
    });
  });
}

async function fsIrSaveUpload() {
  const tipoEl = document.querySelector('#fs-ir-tipo-pills .fs-pill.on');
  const tipo   = tipoEl ? tipoEl.dataset.tipo : 'OUTRO';
  const desc   = document.getElementById('fs-ir-desc').value.trim();
  const ano    = parseInt(document.getElementById('fs-ir-ano').value) || new Date().getFullYear();
  const mes    = document.getElementById('fs-ir-mes').value || '';
  const valor  = document.getElementById('fs-ir-valor').value || '';
  const emitente = document.getElementById('fs-ir-emitente').value.trim();
  const fileInp = document.getElementById('fs-ir-file');
  const file    = (fileInp.files || [])[0];

  if (!file) { fsToast('Selecione um arquivo'); return; }
  if (file.size > 20 * 1024 * 1024) { fsToast('Arquivo muito grande (máx 20 MB)'); return; }

  const btn = document.getElementById('fs-ir-save');
  if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }

  try {
    // Converte para base64
    const b64 = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result.split(',')[1]);
      r.onerror = rej;
      r.readAsDataURL(file);
    });

    // Upload no Storage
    const up = await DB.storage.uploadFiscalDoc(ano, tipo, file, b64, file.type);

    // Salva metadata
    const doc = {
      id:          'doc_' + Date.now(),
      tipo,
      ano,
      mes:         mes || null,
      descricao:   desc || file.name,
      arquivoUrl:  up.link,
      arquivoNome: file.name,
      valor:       valor || null,
      emitente:    emitente || '',
    };
    await DB.fiscal.documentos.upsert(doc);

    // UI otimista — adiciona ao cache local
    FS.documentos = [{...doc, uploadedAt: new Date().toISOString()}, ...(FS.documentos || [])];
    try { localStorage.setItem(FS.CK_DOCS, JSON.stringify(FS.documentos)); } catch(_) {}

    fiscalModalClose();
    fsToast('Documento anexado!');
    fsRenderIR();
  } catch (err) {
    console.error('[fiscal-ir] upload falhou:', err);
    fsToast('Erro ao enviar: ' + (err.message || err));
    if (btn) { btn.disabled = false; btn.textContent = 'Anexar'; }
  }
}

// ── Checklist (Sprint 4 fase 2) ──────────────────────────────
function _fsIrChecklistItems(ano) {
  // Garante shape: {item_key: {status, nota}} para todos os 7 itens canônicos
  const stored = (FS.checklist && FS.checklist[ano]) || {};
  const out = {};
  FS_IR_CHECKLIST.forEach(item => {
    const s = stored[item.key] || {};
    out[item.key] = {
      status: s.status || 'pendente',
      nota:   s.nota   || '',
    };
  });
  return out;
}

function _fsIrRenderChecklist(ano) {
  const items = _fsIrChecklistItems(ano);
  const concluidos = Object.values(items).filter(i => i.status === 'concluido').length;
  const total = FS_IR_CHECKLIST.length;

  return `
  <div class="fs-card fs-checklist-card">
    <div class="fs-card-title fs-checklist-head">
      <span>Checklist IR ${ano}</span>
      <span class="fs-checklist-progress">${concluidos}/${total} concluídos</span>
    </div>

    <div class="fs-checklist">
      ${FS_IR_CHECKLIST.map(item => {
        const it = items[item.key];
        const editing = FS.checklistEditing === item.key;
        const safeNota = (it.nota || '').replace(/"/g,'&quot;');
        return `
        <div class="fs-check-item fs-check-item--${it.status}">
          <button class="fs-check-status fs-check-status--${it.status} fs-no-print"
                  onclick="fsIrCycleCheck('${item.key}')"
                  title="${FS_IR_STATUS_LABEL[it.status]} — clique para mudar">
            ${it.status === 'concluido' ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
              : it.status === 'em_progresso' ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2 A10 10 0 0 1 22 12 L12 12 Z" fill="currentColor"/></svg>`
              : ''}
          </button>
          <div class="fs-check-body">
            <div class="fs-check-titulo">${item.titulo}</div>
            <div class="fs-check-hint">${item.hint}</div>
            ${editing ? `
              <div class="fs-check-nota-edit fs-no-print">
                <textarea id="fs-check-nota-${item.key}" placeholder="Adicione uma nota...">${it.nota}</textarea>
                <div class="fs-check-nota-actions">
                  <button class="fs-mini-btn" onclick="fsIrCancelNota()">Cancelar</button>
                  <button class="fs-mini-btn on" onclick="fsIrSaveNota('${item.key}')">Salvar</button>
                </div>
              </div>
            ` : it.nota ? `
              <div class="fs-check-nota">
                <span>${it.nota}</span>
                <button class="fs-check-nota-edit-btn fs-no-print" onclick="fsIrEditNota('${item.key}')" title="Editar nota">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
              </div>
            ` : `
              <button class="fs-check-add-nota fs-no-print" onclick="fsIrEditNota('${item.key}')">+ nota</button>
            `}
          </div>
        </div>`;
      }).join('')}
    </div>
  </div>`;
}

async function fsIrCycleCheck(itemKey) {
  const ano = FS.selYearIR || new Date().getFullYear();
  const items = _fsIrChecklistItems(ano);
  const cur = items[itemKey] || { status: 'pendente', nota: '' };
  const next = FS_IR_STATUS_CYCLE[cur.status] || 'pendente';

  // UI otimista
  FS.checklist = FS.checklist || {};
  FS.checklist[ano] = { ...(FS.checklist[ano] || {}) };
  FS.checklist[ano][itemKey] = { status: next, nota: cur.nota };
  try { localStorage.setItem(FS.CK_CHECKLIST, JSON.stringify(FS.checklist)); } catch(_) {}
  fsRenderIR();

  try {
    await DB.fiscal.checklist.save(ano, FS.checklist[ano]);
  } catch (err) {
    console.error('[fiscal-ir] save checklist falhou:', err);
    fsToast('Erro ao salvar — tentando novamente em breve');
  }
}

function fsIrEditNota(itemKey) {
  FS.checklistEditing = itemKey;
  fsRenderIR();
  // Foca o textarea
  setTimeout(() => {
    const ta = document.getElementById('fs-check-nota-' + itemKey);
    if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
  }, 50);
}

function fsIrCancelNota() {
  FS.checklistEditing = null;
  fsRenderIR();
}

async function fsIrSaveNota(itemKey) {
  const ano = FS.selYearIR || new Date().getFullYear();
  const ta  = document.getElementById('fs-check-nota-' + itemKey);
  const nota = ta ? ta.value.trim() : '';
  const items = _fsIrChecklistItems(ano);
  const cur = items[itemKey];

  FS.checklist = FS.checklist || {};
  FS.checklist[ano] = { ...(FS.checklist[ano] || {}) };
  FS.checklist[ano][itemKey] = { status: cur.status, nota };
  FS.checklistEditing = null;
  try { localStorage.setItem(FS.CK_CHECKLIST, JSON.stringify(FS.checklist)); } catch(_) {}
  fsRenderIR();

  try {
    await DB.fiscal.checklist.save(ano, FS.checklist[ano]);
  } catch (err) {
    console.error('[fiscal-ir] save nota falhou:', err);
    fsToast('Erro ao salvar nota');
  }
}

async function fsIrDeleteDoc(id, storagePath) {
  if (!confirm('Excluir este documento? O arquivo também será removido.')) return;

  // UI otimista
  FS.documentos = (FS.documentos || []).filter(d => d.id !== id);
  try { localStorage.setItem(FS.CK_DOCS, JSON.stringify(FS.documentos)); } catch(_) {}
  fsRenderIR();
  fsToast('Documento removido');

  try {
    await DB.fiscal.documentos.delete(id);
    if (storagePath) await DB.storage.deleteFiscalDoc(storagePath);
  } catch (err) {
    console.error('[fiscal-ir] delete falhou:', err);
    fsToast('Erro no servidor — tente atualizar');
  }
}
