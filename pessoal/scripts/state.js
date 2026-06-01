// ════════════════════════════════════════════════════════════
// pessoal/scripts/state.js — estado global, categorias, helpers
// ════════════════════════════════════════════════════════════

const SESSION_KEY = 'mk_session_pessoal';
const CACHE_ENT   = 'mk_pess_entradas';
const CACHE_SAI   = 'mk_pess_saidas';

// Dados (cache localStorage + fonte Supabase)
let entradas = [];
let saidas   = [];
let sessao   = null;          // { id, usuario }

// Navegação
let screen   = 'resumo';      // resumo | entradas | saidas | importar
const _now   = new Date();
let selMonth = _now.getMonth();
let selYear  = _now.getFullYear();

// Filtros
let entFilter = 'todas';      // todas | manual | sincronizado | importacao
let saiFilter = 'todas';

// Form state
let FE = {};                  // form entrada
let FS = {};                  // form saída

// Import
let importParsed = [];        // [{ data, descricao, valor, tipoMov, categoria, tipo:'entrada'|'saida', dup }]
let importInfo   = null;      // { banco, periodoIni, periodoFim }

// Categorias
const CAT_ENTRADAS = ['Salário/Renda', 'Transferência', 'Reembolso', 'Presente', 'Investimentos', 'Outros'];
const CAT_SAIDAS   = ['Alimentação', 'Transporte', 'Moradia', 'Saúde', 'Lazer', 'Educação',
                      'Compras', 'Assinaturas', 'Contas', 'Outros'];

const CAT_ICON = {
  'Salário/Renda':'💼', 'Transferência':'🔁', 'Reembolso':'↩️', 'Presente':'🎁',
  'Investimentos':'📈', 'Alimentação':'🍽️', 'Transporte':'🚗', 'Moradia':'🏠',
  'Saúde':'💊', 'Lazer':'🎬', 'Educação':'📚', 'Compras':'🛍️', 'Assinaturas':'📺',
  'Contas':'🧾', 'Outros':'•',
};

const FORMAS = ['PIX', 'Débito', 'Crédito', 'Dinheiro', 'Transferência'];

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

// ── Helpers ──────────────────────────────────────────────
function today() { return new Date().toISOString().slice(0, 10); }
function genId()  { return 'p' + Date.now() + Math.random().toString(36).slice(2, 6); }
function brl(n)  {
  return 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function getMonthYear(dateStr) {
  if (!dateStr) return null;
  const m = String(dateStr).match(/^(\d{4})-(\d{2})/);
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]) - 1 };
}
function inSelectedMonth(dateStr) {
  const my = getMonthYear(dateStr);
  return my && my.m === selMonth && my.y === selYear;
}
function catIcon(c) { return CAT_ICON[c] || '•'; }

function cacheEntradas() { try { localStorage.setItem(CACHE_ENT, JSON.stringify(entradas)); } catch(_){} }
function cacheSaidas()   { try { localStorage.setItem(CACHE_SAI, JSON.stringify(saidas)); } catch(_){} }

let _toastT = null;
function toast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(_toastT);
  _toastT = setTimeout(() => t.classList.remove('show'), 2600);
}

function initFE() {
  FE = { data: today(), valor: '', descricao: '', categoria: 'Salário/Renda', forma: 'PIX' };
}
function initFS() {
  FS = { data: today(), valor: '', descricao: '', categoria: 'Alimentação', forma: 'PIX' };
}
