// ════════════════════════════════════════════════════════════
// fluxo/scripts/ui.js — estado da interface, navegação e componentes
// (formatação, barras de progresso, modal, toast)
//
// Navegação: uma definição só (NAV) gera o menu lateral do computador
// e a barra inferior do celular — as duas ficam sempre iguais.
// ════════════════════════════════════════════════════════════

const UI = {
  tab: 'inicio',         // inicio | plano | caixinhas | movs | conciliar | mais | dividas | analises | ajustes
  ent: 'PF',             // PF | PJ — vale para todas as telas
  mes: stHoje().slice(0, 7),
  modelo: false,         // Plano: editando o modelo
  movFiltro: 'todos',
  extrato: null,         // { contaId, propostas, info } — revisão do extrato (tela Conferir)
  sim: null,             // simulador de dívidas { orc, est, ini }
  aberto: {},            // seções expandidas
  _pn: {},               // painel do mês calculado nesta renderização
};
// nomes antigos das abas (links e preferência salva) → telas novas
const TAB_ALIAS = { mes: 'inicio', pendencias: 'inicio', hoje: 'inicio', movimentos: 'movs', extrato: 'conciliar' };
try {
  const s = JSON.parse(localStorage.getItem('mk_fluxo_ui') || 'null');
  if (s) { UI.tab = TAB_ALIAS[s.tab] || s.tab || UI.tab; UI.ent = s.ent || UI.ent; }
} catch (_) {}
function uiPersist() { try { localStorage.setItem('mk_fluxo_ui', JSON.stringify({ tab: UI.tab, ent: UI.ent })); } catch (_) {} }

// ── Navegação ────────────────────────────────────────────
const _sv = d => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICO = {
  casa: _sv('<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'),
  plano: _sv('<rect x="4" y="3" width="16" height="18" rx="2"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="16" x2="13" y2="16"/>'),
  caixa: _sv('<path d="M5 8h14v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"/><path d="M4 4h16v4H4z"/><line x1="10" y1="12" x2="14" y2="12"/>'),
  setas: _sv('<polyline points="7 4 3 8 7 12"/><line x1="3" y1="8" x2="17" y2="8"/><polyline points="17 12 21 16 17 20"/><line x1="21" y1="16" x2="7" y2="16"/>'),
  banco: _sv('<path d="M3 9 12 4l9 5"/><line x1="4" y1="20" x2="20" y2="20"/><line x1="6" y1="10" x2="6" y2="17"/><line x1="10" y1="10" x2="10" y2="17"/><line x1="14" y1="10" x2="14" y2="17"/><line x1="18" y1="10" x2="18" y2="17"/>'),
  cartao: _sv('<rect x="3" y="5" width="18" height="14" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="7" y1="15" x2="11" y2="15"/>'),
  grafico: _sv('<line x1="4" y1="20" x2="20" y2="20"/><rect x="6" y="11" width="3" height="7"/><rect x="11" y="7" width="3" height="11"/><rect x="16" y="13" width="3" height="5"/>'),
  ajuste: _sv('<line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/><circle cx="9" cy="6" r="2" fill="var(--surface)"/><circle cx="15" cy="12" r="2" fill="var(--surface)"/><circle cx="8" cy="18" r="2" fill="var(--surface)"/>'),
  mais: _sv('<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>'),
};
// grupo = seção do menu lateral (a sequência Planejar → Acompanhar → Conciliar)
const NAV = [
  { id: 'inicio',    rot: 'Hoje',                 ico: 'casa',    grupo: '' },
  { id: 'plano',     rot: 'Plano do mês',         ico: 'plano',   grupo: 'Planejar e distribuir' },
  { id: 'caixinhas', rot: 'Caixinhas',            ico: 'caixa',   grupo: 'Gastar e acompanhar' },
  { id: 'movs',      rot: 'Movimentos',           ico: 'setas',   grupo: 'Gastar e acompanhar' },
  { id: 'conciliar', rot: 'Conferir com o banco', ico: 'banco',   grupo: 'Conciliar' },
  { id: 'dividas',   rot: 'Dívidas',              ico: 'cartao',  grupo: 'Mais' },
  { id: 'analises',  rot: 'Análises',             ico: 'grafico', grupo: 'Mais' },
  { id: 'ajustes',   rot: 'Ajustes',              ico: 'ajuste',  grupo: 'Mais' },
];
// celular: 5 botões; "Movimentos" e "Mais" agrupam as telas vizinhas
const NAV_BAIXO = [
  { id: 'inicio', rot: 'Hoje', ico: 'casa' },
  { id: 'plano', rot: 'Plano', ico: 'plano' },
  { id: 'caixinhas', rot: 'Caixinhas', ico: 'caixa' },
  { id: 'movs', rot: 'Movimentos', ico: 'setas', inclui: ['conciliar'] },
  { id: 'mais', rot: 'Mais', ico: 'mais', inclui: ['dividas', 'analises', 'ajustes'] },
];

function renderNav() {
  const urg = ST.contas.length && (UI.ent === 'PJ' || ST.pfLiberado)
    ? painel().acoes.filter(a => ['atencao', 'atrasado', 'hoje'].includes(a.grupo)).length : 0;
  const badge = id => id === 'inicio' && urg ? `<i class="badge" aria-label="${urg} para agora">${urg}</i>` : '';
  const lat = document.getElementById('lateral');
  if (lat) {
    let g = null;
    lat.innerHTML = `<div class="lat-marca">Meu dinheiro<small>${UI.ent === 'PF' ? 'Pessoal (PF)' : 'Empresa (PJ)'}</small></div>
      <button class="btn lat-novo" onclick="menuNovo()">+ Registrar</button>
      <nav class="lat-nav">${NAV.map(n => {
        const cab = n.grupo !== g ? (g = n.grupo, n.grupo ? `<div class="lat-grp">${n.grupo}</div>` : '') : '';
        return `${cab}<button data-tab="${n.id}" class="${UI.tab === n.id ? 'on' : ''}" onclick="go('${n.id}')" ${UI.tab === n.id ? 'aria-current="page"' : ''}>${ICO[n.ico]}<span>${n.rot}</span>${badge(n.id)}</button>`;
      }).join('')}</nav>`;
  }
  const tb = document.getElementById('tabs');
  if (tb) tb.innerHTML = NAV_BAIXO.map(n => {
    const on = UI.tab === n.id || (n.inclui || []).includes(UI.tab);
    return `<button data-tab="${n.id}" class="${on ? 'on' : ''}" onclick="go('${n.id}')" ${on ? 'aria-current="page"' : ''}>${ICO[n.ico]}<span>${n.rot}</span>${badge(n.id)}</button>`;
  }).join('');
  const se = document.getElementById('seg-ent');
  if (se) se.innerHTML = ['PF', 'PJ'].map(e => `<button class="${e.toLowerCase()} ${UI.ent === e ? 'on' : ''}" onclick="setEnt('${e}')" aria-pressed="${UI.ent === e}"><b>${e}</b><small>${e === 'PF' ? 'Pessoal' : 'Empresa'}</small></button>`).join('');
  document.body.dataset.ent = UI.ent;
}

// Painel do mês da entidade (calculado uma vez por renderização)
function painel(ent) {
  ent = ent || UI.ent;
  const k = ent + '|' + UI.mes;
  if (!UI._pn[k]) UI._pn[k] = FX.painelMes(ent, stCtx(UI.mes));
  return UI._pn[k];
}

// ── Formatação ───────────────────────────────────────────
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
// Atrasado só fica vermelho quando é conta a pagar; reserva/pró-labore atrasados = âmbar (pendente)
function chip(status, tipo) {
  const leve = /atrasado/.test(status) && tipo && tipo !== 'pagamento';
  return `<span class="chip st-${status}${leve ? ' leve' : ''}">${ST_LABEL[status] || status}</span>`;
}
const TIPO_LABEL = { prolabore: 'Pró-labore', aporte: 'Guardar', pagamento: 'Pagar', receita: 'Receber' };
const ACAO_LABEL = { prolabore: 'Pagar', aporte: 'Guardar', pagamento: 'Pagar', receita: 'Receber' };

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

// ── Componentes ──────────────────────────────────────────
// Barra: nivel = ok (verde) · alerta (âmbar) · erro (vermelho) · andamento (grafite) · neutro
function barra(parte, total, nivel) {
  const p = total > 0 ? Math.max(0, Math.min(100, parte / total * 100)) : (parte > 0 ? 100 : 0);
  return `<div class="bar ${nivel || ''}" role="progressbar" aria-valuenow="${Math.round(p)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${p.toFixed(1)}%"></i></div>`;
}

// Linha de progresso com o número principal em destaque.
//   modo 'meta'   → chegar ao total é bom (receber, reservar): falta = âmbar, completo = verde
//   modo 'limite' → passar do total é ruim (gastar): perto = âmbar, acima = vermelho
function progresso(o) {
  const total = FX.r2(o.total || 0), feito = FX.r2(o.feito || 0);
  let nivel, status;
  if (o.modo === 'limite') {
    if (total > 0 && feito > total + FX.EPS) { nivel = 'erro'; status = `${brl(feito - total)} acima`; }
    else if (total > 0 && feito >= total * 0.85) { nivel = 'alerta'; status = `restam ${brl(total - feito)}`; }
    else { nivel = 'ok'; status = total > 0 ? `restam ${brl(total - feito)}` : ''; }
  } else {
    const falta = Math.max(0, total - feito);
    if (total <= FX.EPS) { nivel = 'neutro'; status = 'nada previsto'; }
    else if (falta <= FX.EPS) { nivel = 'ok'; status = '✓ completo'; }
    else { nivel = 'andamento'; status = `faltam ${brl(falta)}`; }
  }
  const cor = nivel === 'andamento' ? 'alerta' : nivel;
  const det = o.detalhe ? `<details class="pg-det" ${UI.aberto[o.chave] ? 'open' : ''} ontoggle="UI.aberto['${o.chave}']=this.open"><summary>${o.rotDetalhe || 'Ver detalhe'}</summary>${o.detalhe}</details>` : '';
  return `<div class="pg">
    <div class="pg-h"><span class="pg-r">${o.rotulo}</span><span class="pg-st t-${cor}">${status}</span></div>
    <div class="pg-v"><b>${brl(feito)}</b><span> ${o.verbo || ''} de ${brl(total)}</span></div>
    ${barra(feito, total, nivel)}
    ${o.extra ? `<div class="pg-x">${o.extra}</div>` : ''}${det}
  </div>`;
}
function autoTag(txt) { return `<span class="auto" title="Deduzido automaticamente — toque para mudar">${txt || 'auto'}</span>`; }
function vazio(txt) { return `<div class="vazio">${txt}</div>`; }

// ── Modal (folha inferior no celular, janela no computador) ──
function abrirModal(html) {
  document.getElementById('modal-box').innerHTML = html;
  notasEmInfo(document.getElementById('modal-box'));
  document.getElementById('modal').classList.add('on');
  document.body.classList.add('modal-on');
  setTimeout(() => { const f = document.querySelector('#modal-box [autofocus]'); if (f) f.focus(); }, 60);
}
function fecharModal() { if (_balaoDe && _balaoDe.closest && _balaoDe.closest('#modal')) fecharBalao(); document.getElementById('modal').classList.remove('on'); document.body.classList.remove('modal-on'); }

let _toastT;
// ── "i" + balão de informação ────────────────────────────
// Telas objetivas: número + rótulo curto. Toda explicação fica num "i"
// que abre um balão (toque no celular, clique no computador).
function info(texto) {
  return texto ? `<button type="button" class="i-info" aria-label="Mais informações" data-info="${esc(texto)}" onclick="event.stopPropagation();abrirBalao(this)">i</button>` : '';
}
let _balaoDe = null;
function abrirBalao(btn) {
  let b = document.getElementById('balao');
  if (!b || !b.getBoundingClientRect) {
    b = document.createElement('div'); b.id = 'balao'; b.className = 'balao'; b.setAttribute('role', 'tooltip');
    document.body.appendChild(b);
  }
  if (_balaoDe === btn && b.classList.contains('on')) return fecharBalao();
  _balaoDe = btn;
  b.innerHTML = '<button type="button" class="balao-x" aria-label="Fechar" onclick="fecharBalao()">×</button><div class="balao-t"></div>';
  b.querySelector('.balao-t').textContent = btn.dataset.info;
  b.classList.add('on');
  posicionarBalao();
}
// O balão fica aberto até tocar no ×, no mesmo "i" ou Esc (não fecha ao tocar fora).
function posicionarBalao() {
  const b = document.getElementById('balao'), btn = _balaoDe;
  if (!b || !btn) return;
  if (btn.isConnected === false) return fecharBalao();
  const r = btn.getBoundingClientRect(), m = 12, w = Math.min(300, innerWidth - 2 * m);
  b.style.width = w + 'px';
  const left = Math.max(m, Math.min(r.left + r.width / 2 - w / 2, innerWidth - w - m));
  const alt = b.offsetHeight;
  const acima = r.bottom + 8 + alt > innerHeight - m && r.top - alt - 8 > m;
  b.style.left = left + 'px';
  b.style.top = (acima ? r.top - alt - 8 : r.bottom + 8) + 'px';
  b.style.setProperty('--seta', (r.left + r.width / 2 - left) + 'px');
  b.classList.toggle('acima', acima);
}
function fecharBalao() {
  const b = document.getElementById('balao');
  if (b && b.classList && b.classList.remove) b.classList.remove('on');
  _balaoDe = null;
}
if (typeof window !== 'undefined' && window.addEventListener && typeof document !== 'undefined' && document.addEventListener) {
  window.addEventListener('scroll', () => { if (_balaoDe) posicionarBalao(); }, true);
  window.addEventListener('resize', () => { if (_balaoDe) posicionarBalao(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && _balaoDe) fecharBalao(); });
}
// Formulários: notas explicativas (.nota sem id, p.muted) viram um "i" no título
function notasEmInfo(box) {
  if (!box || !box.querySelectorAll) return;
  const h2 = box.querySelector('h2');
  const notas = Array.from(box.querySelectorAll('.nota:not([id]), p.muted'));
  if (!h2 || !notas.length) return;
  const txt = notas.map(n => n.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n\n');
  notas.forEach(n => n.remove());
  h2.insertAdjacentHTML('beforeend', info(txt));
}

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
