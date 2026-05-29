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
