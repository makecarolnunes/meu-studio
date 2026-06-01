// ════════════════════════════════════════════════════════════
// pessoal/scripts/main.js — boot, auth (login próprio), logout
// ════════════════════════════════════════════════════════════

function checkAuthPessoal() {
  const raw = localStorage.getItem(SESSION_KEY);
  if (raw) {
    try {
      const s = JSON.parse(raw);
      if (s && s.expires && Date.now() < s.expires) {
        sessao = { id: s.id, usuario: s.usuario };
        showApp();
        return;
      }
    } catch (_) {}
    localStorage.removeItem(SESSION_KEY);
  }
  showLogin();
}

function showLogin() {
  document.getElementById('loading-overlay').style.display = 'none';
  document.getElementById('app').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  setTimeout(() => { const u = document.getElementById('login-user'); if (u) u.focus(); }, 100);
}

function showApp() {
  document.getElementById('loading-overlay').style.display = 'none';
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  loadCache();
  render();
  loadFromSupabase();
}

async function doLoginPessoal(ev) {
  if (ev) ev.preventDefault();
  const u = document.getElementById('login-user').value.trim();
  const p = document.getElementById('login-pass').value;
  const errEl = document.getElementById('login-err');
  const btn = document.getElementById('login-btn');
  errEl.textContent = '';
  if (!u || !p) { errEl.textContent = 'Preencha usuário e senha'; return false; }
  btn.disabled = true; btn.textContent = 'Entrando...';
  try {
    const user = await authLogin(u, p);
    if (!user) {
      errEl.textContent = 'Usuário ou senha incorretos';
      btn.disabled = false; btn.textContent = 'Entrar';
      return false;
    }
    const remember = document.getElementById('login-remember').checked;
    const dur = remember ? 30 * 24 * 3600 * 1000 : 8 * 3600 * 1000;
    const sess = { id: user.id, usuario: user.usuario, expires: Date.now() + dur };
    localStorage.setItem(SESSION_KEY, JSON.stringify(sess));
    sessao = { id: user.id, usuario: user.usuario };
    showApp();
  } catch (err) {
    console.error('[pessoal] login', err);
    errEl.textContent = 'Erro de conexão. Tente novamente.';
    btn.disabled = false; btn.textContent = 'Entrar';
  }
  return false;
}

function doLogoutPessoal() {
  localStorage.removeItem(SESSION_KEY);
  sessao = null;
  showLogin();
  document.getElementById('login-pass').value = '';
}

function toggleEye() {
  const inp = document.getElementById('login-pass');
  const btn = document.getElementById('eye-btn');
  if (inp.type === 'password') { inp.type = 'text'; btn.textContent = '🙈'; }
  else { inp.type = 'password'; btn.textContent = '👁'; }
}

// Boot
document.addEventListener('DOMContentLoaded', checkAuthPessoal);
