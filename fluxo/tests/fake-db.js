// ════════════════════════════════════════════════════════════
// fluxo/tests/fake-db.js — Supabase FALSO em memória (window.DB)
// Usado pelos testes em Node (cenarios.js) e pelo teste no navegador
// (navegador.js). Replica o trigger sync_saida_pessoal (saída PJ
// natureza PESSOAL → entrada/saída PF com id 'sync_<id>').
// ════════════════════════════════════════════════════════════
(function (raiz) {
  function criarDB() {
    const T = { entries: [], saidas: [], entradas_pessoal: [], saidas_pessoal: [], configuracoes: {} };
    const clone = o => JSON.parse(JSON.stringify(o));
    const up = (arr, o) => { const i = arr.findIndex(x => String(x.id) === String(o.id)); if (i >= 0) arr[i] = Object.assign({}, arr[i], clone(o)); else arr.push(clone(o)); };
    const fluxo = {};
    const trigger = s => {    // réplica de sync_saida_pessoal()
      const pess = String(s.natureza || '').toUpperCase() === 'PESSOAL';
      T.entradas_pessoal = T.entradas_pessoal.filter(e => e.saidaOrigemId !== s.id || pess);
      if (!pess) return;
      if (/transfer/i.test(s.forma || '') && s.transferenciaParaMim) {
        up(T.entradas_pessoal, { id: 'sync_' + s.id, data: s.dataPag, descricao: s.obs, valor: Number(s.valor),
          categoria: s.tipo === 'Pró-labore' ? 'Pró-labore' : 'Transferência', forma: s.forma, origem: 'sincronizado', saidaOrigemId: s.id });
      } else {
        const ex = T.saidas_pessoal.find(x => x.id === 'sync_' + s.id);   // ON CONFLICT não mexe na categoria
        up(T.saidas_pessoal, { id: 'sync_' + s.id, data: s.dataPag, descricao: s.obs, valor: Number(s.valor),
          categoria: ex ? ex.categoria : 'Outros', forma: s.forma, origem: 'sincronizado', saidaOrigemId: s.id });
      }
    };
    return {
      T, fluxoT: fluxo,
      entries: { list: async () => clone(T.entries), upsert: async e => up(T.entries, e),
                 update: async (id, f) => up(T.entries, Object.assign({ id }, f)) },
      saidas: { list: async () => clone(T.saidas), upsert: async s => { up(T.saidas, s); trigger(s); },
                update: async (id, f) => { up(T.saidas, Object.assign({ id }, f)); trigger(T.saidas.find(x => x.id === id)); } },
      pessoal: {
        entradas: { list: async () => clone(T.entradas_pessoal), upsert: async e => up(T.entradas_pessoal, e),
                    delete: async id => { T.entradas_pessoal = T.entradas_pessoal.filter(x => x.id !== id); } },
        saidas: { list: async () => clone(T.saidas_pessoal), upsert: async e => up(T.saidas_pessoal, e),
                  delete: async id => { T.saidas_pessoal = T.saidas_pessoal.filter(x => x.id !== id); } },
      },
      fluxo: {
        list: async t => clone(fluxo[t] || []),
        upsert: async (t, o) => { fluxo[t] = fluxo[t] || []; up(fluxo[t], o); },
        upsertMany: async (t, arr) => { fluxo[t] = fluxo[t] || []; arr.forEach(o => up(fluxo[t], o)); },
        remove: async (t, id) => { fluxo[t] = (fluxo[t] || []).filter(x => x.id !== id); },
      },
      config: { get: async k => T.configuracoes[k] || null, set: async (k, v) => { T.configuracoes[k] = v; } },
    };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { criarDB };
  else raiz.DB = criarDB();
})(typeof window !== 'undefined' ? window : globalThis);
