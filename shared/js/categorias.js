// ════════════════════════════════════════════════════════════
// shared/js/categorias.js — UMA lista de categorias para o Financeiro
// e o Meu dinheiro (/fluxo/).
//
// Fonte da verdade: configuracoes.fluxo_config.categorias (editada em
// Meu dinheiro › Ajustes › Categorias). Cada categoria: { nome, grupo }.
//   PJ → "Tipo de despesa" das saídas do Financeiro
//   PF → categoria do gasto pessoal (inclusive o pago pela conta PJ)
// Cache em localStorage (mk_categorias) para abrir na hora; atualiza do
// Supabase em segundo plano. Sem cache e sem rede, cada módulo usa a
// própria lista padrão.
// Depende de window.DB (shared/js/db.js) só para atualizar.
// ════════════════════════════════════════════════════════════
(function () {
  const K = 'mk_categorias';
  let cache = null;
  try { cache = JSON.parse(localStorage.getItem(K) || 'null'); } catch (_) {}

  function guardar(cfg) {
    if (!cfg || !cfg.categorias) return;
    cache = { PJ: cfg.categorias.PJ || [], PF: cfg.categorias.PF || [], versao: cfg.versao || 1, em: Date.now() };
    try { localStorage.setItem(K, JSON.stringify(cache)); } catch (_) {}
  }

  async function atualizar() {
    if (!window.DB || !DB.config) return cache;
    try {
      let v = await DB.config.get('fluxo_config');
      if (typeof v === 'string') v = JSON.parse(v);
      guardar(v);
    } catch (_) {}
    return cache;
  }

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // <option>s agrupados por grupo (Semanada, Reposição…). O valor atual
  // entra mesmo se não estiver na lista (registro antigo não muda sozinho).
  function opcoes(lista, sel, vazio) {
    const grupos = {};
    (lista || []).forEach(c => { (grupos[c.grupo || 'Outras'] = grupos[c.grupo || 'Outras'] || []).push(c.nome); });
    const tem = (lista || []).some(c => c.nome === sel);
    return (vazio != null ? `<option value="">${esc(vazio)}</option>` : '') +
      (sel && !tem ? `<option selected>${esc(sel)}</option>` : '') +
      Object.keys(grupos).map(g => `<optgroup label="${esc(g)}">${grupos[g].map(n =>
        `<option ${n === sel ? 'selected' : ''}>${esc(n)}</option>`).join('')}</optgroup>`).join('');
  }

  window.CATEGORIAS = {
    guardar, atualizar, opcoes,
    versao: () => (cache && cache.versao) || 0,
    PJ: () => (cache && cache.PJ && cache.PJ.length ? cache.PJ : null),
    PF: () => (cache && cache.PF && cache.PF.length ? cache.PF : null),
  };
})();
