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

// Atalho do Início: ?tela=nova abre direto o formulário de lançamento
(function () {
    const t = new URLSearchParams(location.search).get('tela');
    if (['nova', 'lista', 'saidas', 'noivas'].indexOf(t) === -1) return;
    history.replaceState(null, '', location.pathname);
    go(t);
})();

// 6.A.3 · Atalho "/" agora vive no shared/js/global-search.js (cross-módulo).
