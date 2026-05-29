// ════════════════════════════════════════════════════════════
// financeiro/scripts/fiscal/fiscal-state.js
// Estado global do módulo Fiscal. Namespace FS.* — não usa
// variáveis globais do financeiro (entries, saidas, noivas)
// para evitar conflito quando o usuário tem ambas as abas abertas.
// ════════════════════════════════════════════════════════════

window.FS = {
  // tab atual
  screen: 'painel',

  // config fiscal (carregada do Supabase)
  config: null,   // { regime, tetoAnual, dataAbertura, cnpj, atividade }

  // entradas do Financeiro — read-only, usadas só p/ calcular faturamento
  entries: [],

  // orçamentos abertos — read-only, usados no cenário otimista
  orcamentos: [],

  // saídas (leitura compartilhada com financeiro)
  saidas: [],

  // despesas fiscais (metadados das saídas — categoria fiscal, origem, etc.)
  despesas: [],

  // regras aprendidas
  regras: [],

  // Sprint 4 — documentos fiscais (DASN-SIMEI, recibos, informes, NFs...)
  documentos: [],

  // DAS pagos (Sprint 2 — usado também no resumo IR)
  das: [],

  // ano selecionado no painel (default: ano atual)
  selYear: new Date().getFullYear(),

  // ano selecionado na aba IR
  selYearIR: new Date().getFullYear(),

  // filtro de tipo na aba IR ('todos' | 'DASN_SIMEI' | 'RECIBO' | ...)
  irTipoFilter: 'todos',

  // cache localStorage (independente do financeiro)
  CK_CONFIG:    'mk_fiscal_config',
  CK_ENTRIES:   'mk_entries',     // mesma chave do financeiro — leitura aproveitada
  CK_ORC:       'mk_orcamentos',  // mesma chave do módulo orçamentos
  CK_SAIDAS:    'mk_saidas',      // mesma chave do financeiro
  CK_DESPESAS:  'mk_fiscal_despesas',
  CK_REGRAS:    'mk_fiscal_regras',
  CK_DOCS:      'mk_fiscal_documentos',
  CK_DAS:       'mk_fiscal_das',
};

// ── Helpers próprios ────────────────────────────────────────
function fsBrl(n) {
  const v = Number(n) || 0;
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fsToast(msg, ms = 2200) {
  const el = document.getElementById('fs-toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(window.__fsToastT);
  window.__fsToastT = setTimeout(() => el.classList.remove('show'), ms);
}

function fsCheckAuth() {
  const session = localStorage.getItem('mk_session');
  if (session) {
    try {
      const { expires } = JSON.parse(session);
      if (Date.now() < expires) return true;
    } catch(_) {}
    localStorage.removeItem('mk_session');
  }
  return false;
}

function fsCacheConfig(cfg) {
  try { localStorage.setItem(FS.CK_CONFIG, JSON.stringify(cfg)); } catch(_) {}
}

function fsLoadCachedConfig() {
  try {
    const raw = localStorage.getItem(FS.CK_CONFIG);
    return raw ? JSON.parse(raw) : null;
  } catch(_) { return null; }
}

function fsLoadCachedEntries() {
  try {
    const raw = localStorage.getItem(FS.CK_ENTRIES);
    return raw ? JSON.parse(raw) : [];
  } catch(_) { return []; }
}

function fsLoadCachedOrcamentos() {
  try {
    const raw = localStorage.getItem(FS.CK_ORC);
    return raw ? JSON.parse(raw) : [];
  } catch(_) { return []; }
}

function fsLoadCachedSaidas() {
  try {
    const raw = localStorage.getItem(FS.CK_SAIDAS);
    return raw ? JSON.parse(raw) : [];
  } catch(_) { return []; }
}

function fsLoadCachedDespesas() {
  try {
    const raw = localStorage.getItem(FS.CK_DESPESAS);
    return raw ? JSON.parse(raw) : [];
  } catch(_) { return []; }
}

function fsLoadCachedDocs() {
  try {
    const raw = localStorage.getItem(FS.CK_DOCS);
    return raw ? JSON.parse(raw) : [];
  } catch(_) { return []; }
}

function fsLoadCachedDas() {
  try {
    const raw = localStorage.getItem(FS.CK_DAS);
    return raw ? JSON.parse(raw) : [];
  } catch(_) { return []; }
}
