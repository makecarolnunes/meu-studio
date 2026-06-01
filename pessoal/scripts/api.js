// ════════════════════════════════════════════════════════════
// pessoal/scripts/api.js — auth, carga e gravação (Supabase)
// ════════════════════════════════════════════════════════════

// ── AUTH ─────────────────────────────────────────────────
async function authLogin(usuario, senha) {
  return await DB.pessoal.auth.login(usuario, senha);
}

// ── CARGA ────────────────────────────────────────────────
function loadCache() {
  try { entradas = JSON.parse(localStorage.getItem(CACHE_ENT) || '[]'); } catch(_) { entradas = []; }
  try { saidas   = JSON.parse(localStorage.getItem(CACHE_SAI) || '[]'); } catch(_) { saidas   = []; }
}

async function loadFromSupabase() {
  try {
    const [e, s] = await Promise.all([
      DB.pessoal.entradas.list(),
      DB.pessoal.saidas.list(),
    ]);
    entradas = e;
    saidas   = s;
    cacheEntradas(); cacheSaidas();
    render();
  } catch (err) {
    console.warn('[pessoal] carga Supabase falhou, usando cache:', err.message || err);
    toast('Offline — mostrando dados salvos');
  }
}

// ── GRAVAÇÃO (otimista: muta array → render → grava async) ──
async function saveEntrada(e) {
  try { await DB.pessoal.entradas.upsert(e); return true; }
  catch (err) { console.error('[pessoal] saveEntrada', err); toast('⚠️ Erro ao salvar entrada'); return false; }
}
async function saveSaidaPess(s) {
  try { await DB.pessoal.saidas.upsert(s); return true; }
  catch (err) { console.error('[pessoal] saveSaida', err); toast('⚠️ Erro ao salvar saída'); return false; }
}
async function removeEntrada(id) {
  try { await DB.pessoal.entradas.delete(id); return true; }
  catch (err) { console.error('[pessoal] removeEntrada', err); toast('⚠️ Erro ao excluir'); return false; }
}
async function removeSaidaPess(id) {
  try { await DB.pessoal.saidas.delete(id); return true; }
  catch (err) { console.error('[pessoal] removeSaida', err); toast('⚠️ Erro ao excluir'); return false; }
}
