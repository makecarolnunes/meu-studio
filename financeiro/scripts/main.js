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
