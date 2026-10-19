// ══════════════════════════════════════════════════════════
//  INÍCIO — página inicial minimalista
//  Saudação + Orçamentos e Financeiro (uma informação cada) + atalhos.
//  A navegação completa fica no menu compartilhado (shared/js/sidebar.js).
// ══════════════════════════════════════════════════════════

// ── UTILS ──
function safeJSON(s, fb){ try { return s ? JSON.parse(s) : fb; } catch(e){ return fb; } }
function pad(n){ return String(n).padStart(2,'0'); }
function todayStr(){ var t=new Date(); return t.getFullYear()+'-'+pad(t.getMonth()+1)+'-'+pad(t.getDate()); }
function brl(v){ return Number(v||0).toLocaleString('pt-BR', { style:'currency', currency:'BRL', maximumFractionDigits:0 }); }

var MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
var DIAS  = ['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];

// ── INIT ──
(function init(){
  var now = new Date();
  var hd = document.getElementById('hero-date');
  var dia = DIAS[now.getDay()];
  if (hd) hd.textContent = dia.charAt(0).toUpperCase() + dia.slice(1) + ', ' + now.getDate() + ' de ' + MESES[now.getMonth()];
  checkAuth();
})();

// ── AUTH ──
function checkAuth(){
  var s = localStorage.getItem('mk_session');
  if (s) {
    try { var sess = JSON.parse(s); if (Date.now() < sess.expires) { showHub(); return; } } catch(e){}
    localStorage.removeItem('mk_session');
  }
  showLogin();
}
function showLogin(){
  document.getElementById('login-overlay').style.display = 'flex';
  document.getElementById('hub-app').style.display = 'none';
  setTimeout(function(){ var u=document.getElementById('login-user'); if(u) u.focus(); }, 100);
}
function showHub(){
  document.getElementById('login-overlay').style.display = 'none';
  document.getElementById('hub-app').style.display = 'block';
  renderGreeting();
  renderEye();
  loadWidgets();
}
async function doLogin(){
  var user = (document.getElementById('login-user').value || '').trim().toLowerCase();
  var pass = document.getElementById('login-pass').value || '';
  var remember = document.getElementById('login-remember').checked;
  var btn = document.getElementById('login-btn');
  if (!user || !pass) { showErr('Preencha usuário e senha.'); return; }
  btn.disabled = true; btn.textContent = 'Verificando...';
  if (typeof DB === 'undefined') {
    var diag = 'Erro interno: DB não definido.';
    if (typeof supabase === 'undefined') diag = 'Erro: CDN supabase-js não carregou (sem internet?).';
    else if (!window.ENV || !window.ENV.SUPABASE_URL) diag = 'Erro: config.js sem SUPABASE_URL.';
    showErr(diag); btn.disabled = false; btn.textContent = 'Entrar'; return;
  }
  if (window._SB_ERROR) { showErr('Erro Supabase: ' + window._SB_ERROR); btn.disabled = false; btn.textContent = 'Entrar'; return; }
  try {
    var r = await DB.auth.login(user, pass);
    if (r) {
      var expires = Date.now() + (remember ? 30*24*60*60*1000 : 8*60*60*1000);
      localStorage.setItem('mk_session', JSON.stringify({ expires: expires, usuario: r.usuario, nivel: r.nivel }));
      showHub();
    } else {
      showErr('Usuário ou senha incorretos.');
      document.getElementById('login-pass').value = '';
      document.getElementById('login-pass').focus();
    }
  } catch(e) {
    console.error('[doLogin]', e);
    showErr('Erro: ' + ((e && e.message) ? e.message : String(e)));
  } finally { btn.disabled = false; btn.textContent = 'Entrar'; }
}
function doLogout(){ localStorage.removeItem('mk_session'); showLogin(); }
function showErr(msg){
  var e = document.getElementById('login-err');
  e.textContent = msg; e.style.display = 'block';
  setTimeout(function(){ e.style.display = 'none'; }, 3000);
}

// ── SAUDAÇÃO ──
function renderGreeting(){
  var h = new Date().getHours();
  var saud = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  var sess = safeJSON(localStorage.getItem('mk_session'), null);
  var u = (sess && sess.usuario) ? sess.usuario : 'carol';
  var nome = u.charAt(0).toUpperCase() + u.slice(1);
  var g = document.getElementById('hub-greet'); if (g) g.textContent = saud + ', ' + nome;
}

// ── OCULTAR VALORES (privacidade ao abrir o app perto de alguém) ──
var HIDE_KEY = 'mk_hub_hide_vals';
function valoresOcultos(){ try { return localStorage.getItem(HIDE_KEY) === '1'; } catch(e){ return false; } }
function toggleValores(){
  try { localStorage.setItem(HIDE_KEY, valoresOcultos() ? '0' : '1'); } catch(e){}
  renderEye(); renderFin(); renderSummary();
}
function renderEye(){
  var b = document.getElementById('h-eye'); if (!b) return;
  b.innerHTML = valoresOcultos()
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M17.9 17.9A10 10 0 0 1 12 20c-7 0-11-8-11-8a18 18 0 0 1 5.1-5.9M9.9 4.2A9 9 0 0 1 12 4c7 0 11 8 11 8a18 18 0 0 1-2.2 3.2"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
}

// ════════════════════════════════════════════════════════════
//  CARTÕES (dado real, só leitura)
// ════════════════════════════════════════════════════════════
function setText(id, txt){ var el = document.getElementById(id); if (el) el.textContent = txt; }

function loadWidgets(){
  if (typeof DB === 'undefined' || window._SB_ERROR) {
    setText('h-summary', 'Sem conexão com o banco de dados.'); return;
  }
  loadOrca();
  loadFin();
  loadConteudo();
}

// Estado dos cartões — alimenta também a frase de resumo do dia
var _orca = null, _fin = null, _cont = null;

// Orçamentos — quantos estão em aberto + follow-ups vencidos
// "Em aberto" = mesma regra do filtro Novos do módulo (Novo Pedido + Orçamento Enviado);
// Fechado e "Perdido - <motivo>" ficam de fora.
async function loadOrca(){
  try {
    var all = await DB.orcamentos.list();
    var hoje = todayStr();
    var novo    = function(o){ return !o.Status || o.Status === 'Novo Pedido'; };
    var enviado = function(o){ return o.Status === 'Orçamento Enviado'; };
    var abertos = all.filter(function(o){ return novo(o) || enviado(o); });
    _orca = {
      abertos:  abertos.length,
      novos:    abertos.filter(novo).length,
      enviados: abertos.filter(enviado).length,
      followups: abertos.filter(function(o){ return o.ProxFollowup && o.ProxFollowup <= hoje; }).length
    };
    setText('h-orca-val',   String(_orca.abertos));
    setText('h-orca-novos', String(_orca.novos));
    setText('h-orca-env',   String(_orca.enviados));
    setText('h-orca-alert', _orca.followups
      ? _orca.followups + (_orca.followups === 1 ? ' follow-up para hoje' : ' follow-ups para hoje') : '');
  } catch(e) { console.error('[inicio-orca]', e); setText('h-orca-val', '—'); }
  renderSummary();
}

// Financeiro — recebido no mês corrente + o que ainda falta entrar
async function loadFin(){
  try {
    var all = await DB.entries.list();
    var t = new Date(), ym = t.getFullYear() + '-' + pad(t.getMonth() + 1);
    var doMes = all.filter(function(e){ return (e.dataPag || '').slice(0, 7) === ym; });
    var soma = function(st){ return doMes.filter(function(e){ return e.status === st; })
                                         .reduce(function(s, e){ return s + Number(e.valor || 0); }, 0); };
    _fin = { recebido: soma('Realizado'), previsto: soma('Previsto'), mes: MESES[t.getMonth()] };
    renderFin();
  } catch(e) { console.error('[inicio-fin]', e); }
  renderSummary();
}
function renderFin(){
  if (!_fin) return;
  var oculto = valoresOcultos();
  var v = function(n){ return oculto ? 'R$ ••••' : brl(n); };
  var total = _fin.recebido + _fin.previsto;
  var val = document.getElementById('h-fin-val');
  if (val) { val.textContent = v(_fin.recebido); val.classList.toggle('is-hidden-val', oculto); }
  setText('h-fin-mes',  _fin.mes.charAt(0).toUpperCase() + _fin.mes.slice(1));
  setText('h-fin-prev', v(_fin.previsto));
  setText('h-fin-tot',  v(total));
  var bar = document.getElementById('h-fin-bar');
  if (bar) bar.style.width = (total > 0 ? Math.round(_fin.recebido / total * 100) : 0) + '%';
}

// Conteúdo — uma linha no bloco "Também no studio"
async function loadConteudo(){
  try {
    var all = await DB.conteudo.list();
    _cont = {
      prontos: all.filter(function(c){ return c.status === 'Pronto'; }).length,
      prod:    all.filter(function(c){ return c.status === 'Fila de Gravacao' || c.status === 'Editando'; }).length
    };
    setText('h-cont-sub', _cont.prontos ? _cont.prontos + (_cont.prontos === 1 ? ' pronto para publicar' : ' prontos para publicar')
                        : _cont.prod    ? _cont.prod + ' em produção' : 'Quadro de produção');
  } catch(e) { /* silencioso: é informação secundária */ }
  renderSummary();
}

// Frase de resumo do dia (o que pede atenção primeiro)
function renderSummary(){
  var el = document.getElementById('h-summary'); if (!el) return;
  if (!_orca && !_fin) return;
  var partes = [];
  if (_orca && _orca.followups) partes.push('<span class="warn">' + _orca.followups + (_orca.followups === 1 ? ' follow-up' : ' follow-ups') + ' para hoje</span>');
  if (_orca && _orca.novos)     partes.push('<b>' + _orca.novos + (_orca.novos === 1 ? ' pedido novo' : ' pedidos novos') + '</b>');
  if (_fin && _fin.previsto > 0) partes.push('<b>' + (valoresOcultos() ? 'R$ ••••' : brl(_fin.previsto)) + '</b> a receber este mês');
  if (_cont && _cont.prontos)   partes.push(_cont.prontos + (_cont.prontos === 1 ? ' conteúdo pronto' : ' conteúdos prontos') + ' para publicar');
  if (!partes.length) { el.textContent = 'Tudo em dia por aqui.'; return; }
  var ult = partes.pop();
  el.innerHTML = 'Hoje você tem ' + (partes.length ? partes.join(', ') + ' e ' : '') + ult + '.';
}
