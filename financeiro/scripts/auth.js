// ════════════════════════════════════════════════════════════
// financeiro/scripts/auth.js
// Sessão: checkAuth, showApp, doLogout
// ════════════════════════════════════════════════════════════

function checkAuth() {
    const session = localStorage.getItem('mk_session');
    if (session) {
        try {
            const { expires } = JSON.parse(session);
            if (Date.now() < expires) { showApp(); return; }
        } catch(_) {}
        localStorage.removeItem('mk_session');
    }
    window.location.href = '../';
}

function showApp() {
    document.getElementById('loading-overlay').style.display = 'none';
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    render();
    loadFromSupabase();
    DB.config.get('claude_api_key').then(v => {
        if (v && !localStorage.getItem('mk_claude_key')) localStorage.setItem('mk_claude_key', v);
    }).catch(() => {});
}

function doLogout() {
    localStorage.removeItem('mk_session');
    window.location.href = '../';
}

function toggleEye() {
    const inp = document.getElementById('login-pass');
    const btn = document.getElementById('eye-btn');
    if (inp.type === 'password') { inp.type = 'text'; btn.textContent = '🙈'; }
    else { inp.type = 'password'; btn.textContent = '👁'; }
}
