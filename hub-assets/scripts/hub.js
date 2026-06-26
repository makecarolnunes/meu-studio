// ══════════════════════════════════════════════════════════
//  HUB — Painel de Gestão (Studio Flow)
//  Rail de navegação + widgets dos pilares (dado real) + lançador por seção.
// ══════════════════════════════════════════════════════════

// ── UTILS ──
function safeJSON(s, fb){ try { return s ? JSON.parse(s) : fb; } catch(e){ return fb; } }
function pad(n){ return String(n).padStart(2,'0'); }
function todayStr(){ var t=new Date(); return t.getFullYear()+'-'+pad(t.getMonth()+1)+'-'+pad(t.getDate()); }
function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

var MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
var DIAS  = ['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];

// ── INIT ──
(function init(){
  var now = new Date();
  var hd = document.getElementById('hero-date');
  if (hd) hd.textContent = DIAS[now.getDay()] + ', ' + now.getDate() + ' de ' + MESES[now.getMonth()] + ' de ' + now.getFullYear();
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
  var un = document.getElementById('rail-un'); if (un) un.textContent = '@' + u;
  var av = document.querySelector('.rail-av'); if (av) av.textContent = nome.charAt(0);
}

// ── RAIL (interações) ──
function hubGrp(id){ var el = document.getElementById(id); if (el) el.classList.toggle('closed'); }
function hubOpenRail(){ document.getElementById('rail').classList.add('open'); document.getElementById('bd').classList.add('open'); }
function hubCloseRail(){ document.getElementById('rail').classList.remove('open'); document.getElementById('bd').classList.remove('open'); }

// ════════════════════════════════════════════════════════════
//  WIDGETS DOS PILARES (dado real)
// ════════════════════════════════════════════════════════════
function loadWidgets(){
  if (typeof DB === 'undefined' || window._SB_ERROR) return;
  loadWOrca();
  loadWTarefas();
  loadWConteudo();
}

function setW(id, html){ var el = document.getElementById(id); if (el) el.innerHTML = html; }
function wFail(id, metric){ setW(id, '<div class="w-metric">'+metric+'</div><div class="w-empty">Sem conexão</div>'); }

// Orçamentos — pipeline (contagens, sem valores)
async function loadWOrca(){
  try {
    var all = await DB.orcamentos.list();
    var hoje = todayStr();
    var aberto = function(o){ return o.Status !== 'Fechado' && o.Status !== 'Perdido'; };
    var novos    = all.filter(function(o){ return !o.Status || o.Status === 'Novo Pedido'; }).length;
    var enviados = all.filter(function(o){ return o.Status === 'Enviado'; }).length;
    var aFechar  = all.filter(function(o){ return aberto(o) && o.ProxFollowup && o.ProxFollowup <= hoje; }).length;
    var mes = MESES[new Date().getMonth()];
    setW('w-orca',
      '<div class="w-metric" style="margin-bottom:12px;">Pipeline <small>· ' + mes + '</small></div>' +
      '<div class="pipe">' +
        '<div class="pipe-cell"><div class="pipe-n">' + novos + '</div><div class="pipe-l">Novos</div></div>' +
        '<div class="pipe-cell"><div class="pipe-n">' + enviados + '</div><div class="pipe-l">Enviados</div></div>' +
        '<div class="pipe-cell warn"><div class="pipe-n">' + aFechar + '</div><div class="pipe-l">A fechar</div></div>' +
      '</div>');
  } catch(e) { console.error('[w-orca]', e); wFail('w-orca', 'Pipeline'); }
}

// Tarefas — foco do dia (ou pendentes)
function tareDot(t){
  if (t.prioridade === 'urgente') return 'var(--danger)';
  return t.area === 'conteudo' ? 'var(--rose)' :
         t.area === 'clientes' ? 'var(--amber)' :
         t.area === 'producao' ? 'var(--green)' :
         t.area === 'admin'    ? 'var(--brown)' : 'var(--brand)';
}
async function loadWTarefas(){
  try {
    var all = await DB.tarefas.list();
    var pend = all.filter(function(t){ return !t.feita && t.status !== 'ideia'; });
    var foco = pend.filter(function(t){ return t.foco; });
    var useFoco = foco.length > 0;
    var list = useFoco ? foco : pend;
    var metric = useFoco
      ? foco.length + ' <small>no foco de hoje</small>'
      : pend.length + ' <small>pendente' + (pend.length !== 1 ? 's' : '') + '</small>';
    var items = list.slice(0, 3).map(function(t){
      return '<div class="w-item"><span class="w-dot" style="background:' + tareDot(t) + '"></span>' +
        '<span class="tt">' + esc(t.titulo) + '</span>' +
        (t.prioridade === 'urgente' ? '<span class="tag tag-urg">urgente</span>' : '') + '</div>';
    }).join('');
    if (!list.length) items = '<div class="w-empty">Nada pendente 🤎</div>';
    setW('w-tarefas', '<div class="w-metric">' + metric + '</div>' + items);
  } catch(e) { console.error('[w-tarefas]', e); wFail('w-tarefas', 'Foco de hoje'); }
}

// Conteúdo — fila (prontos + total)
async function loadWConteudo(){
  try {
    var all = await DB.conteudo.list();
    var posted = function(s){ return /postad|publicad/i.test(s || ''); };
    var ready  = function(s){ return /pronto|aprovad/i.test(s || ''); };
    var fila = all.filter(function(c){ return !posted(c.status); });
    var prontos = fila.filter(function(c){ return ready(c.status); });
    var metric = (prontos.length ? prontos.length + ' <small>prontos · </small>' : '') +
                 fila.length + ' <small>na fila</small>';
    var ordered = fila.slice().sort(function(a, b){
      var ar = ready(a.status) ? 0 : 1, br = ready(b.status) ? 0 : 1;
      if (ar !== br) return ar - br;
      var ad = a.scheduledDate || '9999', bd = b.scheduledDate || '9999';
      return ad < bd ? -1 : ad > bd ? 1 : 0;
    });
    var items = ordered.slice(0, 3).map(function(c){
      return '<div class="w-item"><span class="w-dot" style="background:var(--rose)"></span>' +
        '<span class="tt">' + esc(c.title || '(sem título)') + '</span>' +
        (ready(c.status) ? '<span class="tag tag-rdy">pronto</span>' : '') + '</div>';
    }).join('');
    if (!fila.length) items = '<div class="w-empty">Fila vazia ✨</div>';
    setW('w-conteudo', '<div class="w-metric">' + metric + '</div>' + items);
  } catch(e) { console.error('[w-conteudo]', e); wFail('w-conteudo', 'Fila de conteúdo'); }
}
