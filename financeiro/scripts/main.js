// ════════════════════════════════════════════════════════════
// financeiro/scripts/main.js
// Bootstrap: navegação + boot inicial
// Deve ser o ÚLTIMO script do módulo (depois de todos os outros)
// ════════════════════════════════════════════════════════════

function go(s) {
    screen = s;
    document.querySelectorAll('.ni').forEach(el => el.classList.remove('active'));
    const navEl = document.getElementById('nav-'+s);
    if (navEl) navEl.classList.add('active');
    document.getElementById('hsub').textContent =
        { nova:'Novo lançamento', lista:'Entradas', saidas:'Saídas', resumo:'Resumo', noivas:'Noivas' }[s] || '';
    render();
}

// ── BOOT ──
entries = entries.map(normalizeE);
noivas  = noivas.map(normalizeN);
initF(); initFs();
checkAuth();

// 6.A.3 · Atalho de teclado para busca global ("/" abre)
document.addEventListener('keydown', (ev) => {
    if (ev.key !== '/' || ev.metaKey || ev.ctrlKey || ev.altKey) return;
    const tag = (ev.target && ev.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (ev.target && ev.target.isContentEditable) return;
    ev.preventDefault();
    if (typeof openGlobalSearch === 'function') openGlobalSearch();
});
