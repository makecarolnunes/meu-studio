// ════════════════════════════════════════════════════════════
// fluxo/scripts/ui.js — helpers de interface (formatação, modal, toast)
// ════════════════════════════════════════════════════════════

const UI = {
  tab: 'mes',            // mes | plano | movs | caixinhas | pendencias | analises | ajustes
  ent: 'PF',             // entidade das telas com seletor
  mes: stHoje().slice(0, 7),
  modelo: false,         // Plano: editando o modelo
  movFiltro: 'todos',
  extrato: null,         // { contaId, propostas, info }
  sim: null,             // simulador de dívidas { orc, est, ini }
  aberto: {},            // seções expandidas
};
try { const s = JSON.parse(localStorage.getItem('mk_fluxo_ui') || 'null'); if (s) { UI.tab = s.tab || UI.tab; UI.ent = s.ent || UI.ent; } } catch (_) {}
function uiPersist() { try { localStorage.setItem('mk_fluxo_ui', JSON.stringify({ tab: UI.tab, ent: UI.ent })); } catch (_) {} }

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const MESES_C = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function brl(n, sinal) {
  const v = Number(n) || 0;
  const s = Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (sinal) return (v > 0 ? '+ ' : v < 0 ? '− ' : '') + 'R$ ' + s;
  return (v < 0 ? '− ' : '') + 'R$ ' + s;
}
function brlc(n) {   // compacto, sem centavos quando inteiro
  const v = Number(n) || 0;
  const inteiro = Math.abs(v - Math.round(v)) < 0.005;
  return (v < 0 ? '−' : '') + 'R$ ' + Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: inteiro ? 0 : 2, maximumFractionDigits: 2 });
}
function dm(data) { return data ? `${data.slice(8, 10)}/${data.slice(5, 7)}` : ''; }
function nomeMes(mes) { if (mes === 'modelo') return 'Modelo'; const [y, m] = mes.split('-'); return `${MESES[Number(m) - 1]} ${y}`; }
function nomeMesC(mes) { const [y, m] = mes.split('-'); return `${MESES_C[Number(m) - 1]}/${y.slice(2)}`; }
function valIn(n) { return n === '' || n == null ? '' : String(FX.r2(n)).replace('.', ','); }

const ST_LABEL = { feito: 'feito', parcial: 'parcial', 'parcial-atrasado': 'parcial · atrasado', atrasado: 'atrasado',
  hoje: 'hoje', futuro: 'previsto', dispensado: 'dispensado', reprogramado: 'reprogramado' };
function chip(status) { return `<span class="chip st-${status}">${ST_LABEL[status] || status}</span>`; }
const TIPO_LABEL = { prolabore: 'Pró-labore', aporte: 'Reservar', pagamento: 'Pagar', receita: 'Receber' };
const ACAO_LABEL = { prolabore: 'Pagar', aporte: 'Reservar', pagamento: 'Pagar', receita: 'Receber' };

function nomeConta(id) { const c = stConta(id); return c ? c.nome : '—'; }
function contasDe(ent, tipos) {
  return ST.contas.filter(c => c.entidade === ent && c.ativa !== false && (!tipos || tipos.includes(c.tipo)));
}
function optContas(ent, tipos, sel, vazio) {
  return (vazio ? `<option value="">${esc(vazio)}</option>` : '') +
    contasDe(ent, tipos).map(c => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(c.nome)}${c.tipo === 'cartao' ? ' (cartão)' : ''}</option>`).join('');
}
function categorias(ent) {
  const cfg = ST.cfg || FX_MODELO.config;
  return (cfg.categorias && cfg.categorias[ent]) || [];
}
function optCategorias(ent, sel) {
  const grupos = {};
  categorias(ent).forEach(c => { (grupos[c.grupo || 'Outras'] = grupos[c.grupo || 'Outras'] || []).push(c.nome); });
  const extra = sel && !categorias(ent).some(c => c.nome === sel) ? `<option selected>${esc(sel)}</option>` : '';
  return extra + Object.keys(grupos).map(g => `<optgroup label="${esc(g)}">${grupos[g].map(n =>
    `<option ${n === sel ? 'selected' : ''}>${esc(n)}</option>`).join('')}</optgroup>`).join('');
}
function barra(parte, total, cls) {
  const p = total > 0 ? Math.max(0, Math.min(100, parte / total * 100)) : 0;
  return `<div class="bar ${cls || ''}"><i style="width:${p.toFixed(1)}%"></i></div>`;
}
function autoTag(txt) { return `<span class="auto" title="Deduzido automaticamente — toque para mudar">${txt || 'auto'}</span>`; }
function vazio(txt) { return `<div class="vazio">${txt}</div>`; }

// ── Modal (folha inferior) ───────────────────────────────
function abrirModal(html) {
  document.getElementById('modal-box').innerHTML = html;
  document.getElementById('modal').classList.add('on');
  setTimeout(() => { const f = document.querySelector('#modal-box [autofocus]'); if (f) f.focus(); }, 60);
}
function fecharModal() { document.getElementById('modal').classList.remove('on'); }

let _toastT;
function toast(msg, erro) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'toast on' + (erro ? ' erro' : '');
  clearTimeout(_toastT); _toastT = setTimeout(() => { t.className = 'toast'; }, 2800);
}
function $v(id) { const el = document.getElementById(id); return el ? (el.type === 'checkbox' ? el.checked : el.value) : ''; }

// Executa uma ação com trava de duplo clique, toast de erro e re-render
let _ocupado = false;
async function executar(fn, msgOk) {
  if (_ocupado) return;
  _ocupado = true;
  document.body.classList.add('ocupado');
  try {
    const r = await fn();
    if (msgOk) toast(msgOk);
    fecharModal();
    render();
    return r;
  } catch (e) {
    console.error('[fluxo]', e);
    toast(e.usuario ? e.message : ('Erro: ' + (e.message || e)), true);
  } finally {
    _ocupado = false;
    document.body.classList.remove('ocupado');
  }
}
