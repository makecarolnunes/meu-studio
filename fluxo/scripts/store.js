// ════════════════════════════════════════════════════════════
// fluxo/scripts/store.js — estado em memória + leitura/gravação
//
// Fonte da verdade: Supabase. Cache localStorage só p/ abrir rápido.
// Toda gravação do fluxo passa por aqui e gera um registro em fin_log
// (rastreabilidade). Lançamentos do Financeiro/Orçamentos continuam
// sendo gravados pelos próprios módulos; aqui só se lê — exceto quando
// a Carol executa algo pelo fluxo (pró-labore, gasto PJ, confirmar
// recebimento), sempre pelos métodos já existentes de window.DB.
// ════════════════════════════════════════════════════════════

const ST = {
  // fluxo (fin_*)
  contas: [], transferencias: [], planos: [], itens: [], dividas: [], dividaSaldos: [], conciliacoes: [], meta: {}, log: [],
  // lançamentos existentes
  entries: [], saidas: [], entradasPF: [], saidasPF: [],
  cfg: null,
  pfLiberado: false,      // PF tem login próprio (mk_session_pessoal)
  usuario: '',
  migracaoOk: null,       // false = tabelas fin_* ainda não existem
  erroCarga: '',
  carregado: false,
  _movs: null,
};

const ST_CACHE = 'mk_fluxo_cache_v1';

function stHoje() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function stId(prefixo) { return (prefixo || 'fx') + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

function stInvalidar() { ST._movs = null; }

function stMovs() {
  if (!ST._movs) {
    ST._movs = FX.normalizar({
      entries: ST.entries, saidas: ST.saidas,
      entradasPF: ST.pfLiberado ? ST.entradasPF : [],
      saidasPF: ST.pfLiberado ? ST.saidasPF : [],
      transferencias: ST.transferencias.filter(t => ST.pfLiberado || t.entidade !== 'PF'),
      meta: ST.meta,
    }, ST.contas);
    // vínculos e caixinhas deduzidos automaticamente (só em memória)
    FX.automatizar(ST._movs, ST.itens, ST.contas, ST.cfg || FX_MODELO.config);
  }
  return ST._movs;
}

function stCtx(mes, hoje) {
  return { contas: ST.contas, movs: stMovs(), itens: ST.itens, mes, hoje: hoje || stHoje(), cfg: ST.cfg || FX_MODELO.config };
}

function stConta(id) { return ST.contas.find(c => c.id === id) || null; }
function stItem(id) { return ST.itens.find(i => i.id === id) || null; }
function stPlano(mes) { return ST.planos.find(p => p.mes === mes) || null; }

// ── CARGA ────────────────────────────────────────────────
function stCarregarCache() {
  try {
    const c = JSON.parse(localStorage.getItem(ST_CACHE) || 'null');
    if (c) ['contas', 'transferencias', 'planos', 'itens', 'dividas', 'dividaSaldos', 'conciliacoes', 'meta', 'cfg']
      .forEach(k => { if (c[k] != null) ST[k] = c[k]; });
  } catch (_) {}
  try { ST.entries = JSON.parse(localStorage.getItem('mk_entries') || '[]'); } catch (_) {}
  try { ST.saidas  = JSON.parse(localStorage.getItem('mk_saidas')  || '[]'); } catch (_) {}
  if (ST.pfLiberado) {
    try { ST.entradasPF = JSON.parse(localStorage.getItem('mk_pess_entradas') || '[]'); } catch (_) {}
    try { ST.saidasPF   = JSON.parse(localStorage.getItem('mk_pess_saidas')   || '[]'); } catch (_) {}
  }
  stInvalidar();
}
function stSalvarCache() {
  try {
    localStorage.setItem(ST_CACHE, JSON.stringify({
      contas: ST.contas, transferencias: ST.transferencias, planos: ST.planos, itens: ST.itens,
      dividas: ST.dividas, dividaSaldos: ST.dividaSaldos, conciliacoes: ST.conciliacoes, meta: ST.meta, cfg: ST.cfg,
    }));
  } catch (_) {}
}

function _ehTabelaAusente(err) {
  const m = String((err && (err.message || err.code)) || err || '');
  return /PGRST205|42P01|does not exist|Could not find the table|schema cache/i.test(m);
}

async function stCarregar() {
  ST.erroCarga = '';
  try {
    const [entries, saidas] = await Promise.all([DB.entries.list(), DB.saidas.list()]);
    ST.entries = entries; ST.saidas = saidas;
  } catch (e) { ST.erroCarga = 'Financeiro PJ: ' + (e.message || e); }

  if (ST.pfLiberado) {
    try {
      const [e, s] = await Promise.all([DB.pessoal.entradas.list(), DB.pessoal.saidas.list()]);
      ST.entradasPF = e; ST.saidasPF = s;
      try { localStorage.setItem('mk_pess_entradas', JSON.stringify(e)); localStorage.setItem('mk_pess_saidas', JSON.stringify(s)); } catch (_) {}
    } catch (e) { ST.erroCarga += ' · Pessoal: ' + (e.message || e); }
  }

  try {
    const T = ['fin_contas', 'fin_transferencias', 'fin_planos', 'fin_plano_itens', 'fin_dividas', 'fin_conciliacoes', 'fin_mov_meta', 'fin_divida_saldos'];
    const [contas, transf, planos, itens, dividas, conc, meta, dvs] = await Promise.all(T.map(t => DB.fluxo.list(t)));
    ST.dividaSaldos = dvs;
    ST.contas = contas.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    ST.transferencias = transf; ST.planos = planos; ST.itens = itens; ST.dividas = dividas; ST.conciliacoes = conc;
    ST.meta = {}; meta.forEach(m => { ST.meta[m.id] = m; });
    ST.migracaoOk = true;
  } catch (e) {
    if (_ehTabelaAusente(e)) ST.migracaoOk = false;
    else ST.erroCarga += ' · Fluxo: ' + (e.message || e);
  }

  try {
    const raw = await DB.config.get('fluxo_config');
    ST.cfg = raw ? JSON.parse(raw) : null;
    if (ST.cfg && ST.migracaoOk && stAtualizarCfg(ST.cfg)) await DB.config.set('fluxo_config', JSON.stringify(ST.cfg));
  } catch (_) { /* sem config ainda */ }

  ST.carregado = true;
  stInvalidar();
  stSalvarCache();
}

// Atualizações de versão da config salva. Retorna true se mudou.
const CAT_PJ_V1 = ['Deslocamento', 'Alimentação trabalho', 'Reposição/Investimento de material', 'Cursos', 'Equipamentos',
  'Assinaturas', 'DAS', 'Dívidas', 'Assistente', 'Modelos', 'Marketing', 'Equipe', 'Outro'];
function stAtualizarCfg(cfg) {
  let mudou = false;
  if ((cfg.versao || 1) < 2) {
    // PJ: só RAIO X PJ; categorias que VOCÊ acrescentou continuam
    const suas = ((cfg.categorias && cfg.categorias.PJ) || []).filter(c => !CAT_PJ_V1.includes(c.nome));
    cfg.categorias = cfg.categorias || {};
    cfg.categorias.PJ = FX_MODELO.config.categorias.PJ.concat(suas);
    cfg.versao = 2; mudou = true;
  }
  return mudou;
}

// ── GRAVAÇÃO (fluxo) ─────────────────────────────────────
function stLog(acao, tabela, registroId, dados) {
  const reg = { id: stId('log'), em: new Date().toISOString(), usuario: ST.usuario || '', acao,
                tabela: tabela || '', registroId: String(registroId || ''), dados: dados || null };
  ST.log.unshift(reg);
  DB.fluxo.upsert('fin_log', reg).catch(e => console.warn('[fluxo] log', e.message || e));
}

const _ARR = { fin_contas: 'contas', fin_transferencias: 'transferencias', fin_planos: 'planos',
               fin_plano_itens: 'itens', fin_dividas: 'dividas', fin_conciliacoes: 'conciliacoes', fin_divida_saldos: 'dividaSaldos' };

// Grava no banco ANTES de mexer na memória: se falhar, nada muda na tela.
async function stSalvar(tabela, obj, acao) {
  if (ST.migracaoOk === false) throw new Error('Rode sql/fluxo-financeiro.sql no Supabase antes de usar o fluxo.');
  const agora = new Date().toISOString();
  const reg = Object.assign({}, obj);
  if (!reg.id) reg.id = stId(tabela.replace('fin_', '').slice(0, 3));
  if (!['fin_transferencias', 'fin_conciliacoes', 'fin_mov_meta', 'fin_divida_saldos'].includes(tabela)) reg.updatedAt = agora;
  if (!reg.createdAt && tabela !== 'fin_mov_meta') reg.createdAt = agora;
  await DB.fluxo.upsert(tabela, reg);
  const arr = ST[_ARR[tabela]];
  if (arr) {
    const i = arr.findIndex(x => x.id === reg.id);
    const antes = i >= 0 ? arr[i] : null;
    if (i >= 0) arr[i] = reg; else arr.push(reg);
    stLog(acao || (antes ? 'editar' : 'criar'), tabela, reg.id, { antes, depois: reg });
  }
  stInvalidar(); stSalvarCache();
  return reg;
}

async function stSalvarVarios(tabela, lista, acao) {
  if (!lista.length) return [];
  if (ST.migracaoOk === false) throw new Error('Rode sql/fluxo-financeiro.sql no Supabase antes de usar o fluxo.');
  const agora = new Date().toISOString();
  const regs = lista.map(o => Object.assign({ createdAt: agora }, o, { id: o.id || stId('it') }));
  await DB.fluxo.upsertMany(tabela, regs);
  const arr = ST[_ARR[tabela]];
  regs.forEach(r => { const i = arr.findIndex(x => x.id === r.id); if (i >= 0) arr[i] = r; else arr.push(r); });
  stLog(acao || 'criar-lote', tabela, '', { n: regs.length, ids: regs.map(r => r.id) });
  stInvalidar(); stSalvarCache();
  return regs;
}

async function stRemover(tabela, id, acao) {
  await DB.fluxo.remove(tabela, id);
  const arr = ST[_ARR[tabela]];
  const i = arr.findIndex(x => x.id === id);
  const antes = i >= 0 ? arr.splice(i, 1)[0] : null;
  stLog(acao || 'excluir', tabela, id, { antes });
  stInvalidar(); stSalvarCache();
}

// Metadados de um lançamento existente (conta, caixinha, item do plano…)
async function stSalvarMeta(tabela, registroId, campos) {
  const id = `${tabela}:${registroId}`;
  const atual = ST.meta[id] || { id, tabela, registroId: String(registroId) };
  const novo = Object.assign({}, atual, campos, { updatedAt: new Date().toISOString() });
  await DB.fluxo.upsert('fin_mov_meta', novo);
  ST.meta[id] = novo;
  stLog('meta', tabela, registroId, { antes: atual, depois: novo });
  stInvalidar(); stSalvarCache();
  return novo;
}

async function stSalvarCfg(cfg) {
  await DB.config.set('fluxo_config', JSON.stringify(cfg));
  const antes = ST.cfg;
  ST.cfg = cfg;
  stLog('config', 'configuracoes', 'fluxo_config', { antes, depois: cfg });
  stInvalidar(); stSalvarCache();
}

// ── GRAVAÇÃO (lançamentos existentes — via APIs já usadas pelos módulos) ──
async function stSalvarSaidaPJ(s) {
  await DB.saidas.upsert(s);
  const i = ST.saidas.findIndex(x => String(x.id) === String(s.id));
  if (i >= 0) ST.saidas[i] = Object.assign({}, ST.saidas[i], s); else ST.saidas.unshift(s);
  try { localStorage.setItem('mk_saidas', JSON.stringify(ST.saidas)); } catch (_) {}
  stLog(i >= 0 ? 'editar' : 'criar', 'saidas', s.id, { depois: s });
  stInvalidar();
}
async function stAtualizarEntry(id, campos) {
  await DB.entries.update(id, campos);
  const e = ST.entries.find(x => String(x.id) === String(id));
  const antes = e ? Object.assign({}, e) : null;
  if (e) Object.assign(e, campos);
  try { localStorage.setItem('mk_entries', JSON.stringify(ST.entries)); } catch (_) {}
  stLog('editar', 'entries', id, { antes, campos });
  stInvalidar();
}
async function stCriarEntry(e) {
  await DB.entries.upsert(e);
  ST.entries.unshift(e);
  try { localStorage.setItem('mk_entries', JSON.stringify(ST.entries)); } catch (_) {}
  stLog('criar', 'entries', e.id, { depois: e });
  stInvalidar();
}
async function stAtualizarSaidaPJ(id, campos) {
  await DB.saidas.update(id, campos);
  const s = ST.saidas.find(x => String(x.id) === String(id));
  const antes = s ? Object.assign({}, s) : null;
  if (s) Object.assign(s, campos);
  try { localStorage.setItem('mk_saidas', JSON.stringify(ST.saidas)); } catch (_) {}
  stLog('editar', 'saidas', id, { antes, campos });
  stInvalidar();
}
async function stSalvarPF(tipo, reg) {
  const api = tipo === 'entrada' ? DB.pessoal.entradas : DB.pessoal.saidas;
  const arr = tipo === 'entrada' ? ST.entradasPF : ST.saidasPF;
  await api.upsert(reg);
  const i = arr.findIndex(x => String(x.id) === String(reg.id));
  if (i >= 0) arr[i] = Object.assign({}, arr[i], reg); else arr.unshift(reg);
  try { localStorage.setItem(tipo === 'entrada' ? 'mk_pess_entradas' : 'mk_pess_saidas', JSON.stringify(arr)); } catch (_) {}
  stLog(i >= 0 ? 'editar' : 'criar', tipo === 'entrada' ? 'entradas_pessoal' : 'saidas_pessoal', reg.id, { depois: reg });
  stInvalidar();
}
async function stRemoverPF(tipo, id) {
  const api = tipo === 'entrada' ? DB.pessoal.entradas : DB.pessoal.saidas;
  const arr = tipo === 'entrada' ? ST.entradasPF : ST.saidasPF;
  await api.delete(id);
  const i = arr.findIndex(x => String(x.id) === String(id));
  const antes = i >= 0 ? arr.splice(i, 1)[0] : null;
  stLog('excluir', tipo === 'entrada' ? 'entradas_pessoal' : 'saidas_pessoal', id, { antes });
  stInvalidar();
}

if (typeof module !== 'undefined') module.exports = { ST };
