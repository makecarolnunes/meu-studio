// ════════════════════════════════════════════════════════════
// financeiro/scripts/api.js
// Sync com Supabase: load, sbCall (save/update/delete), normalizers
// ════════════════════════════════════════════════════════════

function normalizeE(e) { return { ...e, id: String(e.id||''), auto: e.auto==='true'||e.auto===true, noivaId: e.noivaId||'', comprovanteUrl: e.comprovanteUrl||'' }; }
function normalizeS(s) { return { ...s, id: String(s.id||'') }; }
function normalizeN(n) { return { ...n, id: String(n.id||''), contratos: Array.isArray(n.contratos)?n.contratos:[] }; }

async function loadFromSupabase() {
    updateDot('syncing');
    isSyncing = true;
    // Retry com backoff — cold start em mobile/4G falha na 1ª; 2 retries cobrem o caso
    const delays = [0, 1500, 4000];
    let lastErr = null;
    try {
        for (let i = 0; i < delays.length; i++) {
            if (delays[i]) await new Promise(r => setTimeout(r, delays[i]));
            try {
                const [ents, sais, novs] = await Promise.all([
                    DB.entries.list(),
                    DB.saidas.list(),
                    DB.noivas.list(),
                ]);
                entries = ents.map(normalizeE);
                saidas  = sais.map(normalizeS);
                noivas  = novs.map(normalizeN);
                cacheEntries(); cacheSaidas(); cacheNoivas();
                updateDot('ok');
                lastErr = null;
                // Preços em paralelo (não bloqueia render)
                loadServicePricesFromSupabase().catch(() => {});
                break;
            } catch(e) {
                lastErr = e;
                console.warn(`[loadFromSupabase] tentativa ${i+1}/${delays.length} falhou:`, e && e.message || e);
            }
        }
        if (lastErr) {
            updateDot('offline');
            const detalhe = (lastErr && lastErr.message) ? String(lastErr.message) : String(lastErr || 'erro desconhecido');
            const code = lastErr && (lastErr.code || lastErr.status || lastErr.statusCode);
            toast('Supabase falhou: ' + (code ? '[' + code + '] ' : '') + detalhe.slice(0, 120), 8000);
        }
    } finally {
        isSyncing = false;
        render();
        document.getElementById('loading-overlay').style.display = 'none';
    }
}

async function sbCall(params) {
    const { action, table, data, id, field, value } = params;
    try {
        updateDot('syncing');
        if (action === 'save' && data) {
            const obj = JSON.parse(decodeURIComponent(data));
            await DB[table].upsert(obj);
        } else if (action === 'delete' && id) {
            await DB[table].delete(id);
        } else if (action === 'update' && id && field) {
            await DB[table].update(id, { [field]: value });
        }
        updateDot('ok');
    } catch(e) {
        updateDot('offline');
        console.warn('sbCall error:', e.message);
        toast('⚠️ Não foi possível salvar no servidor: ' + (e.message || 'verifique a conexão'));
    }
}

async function syncNow() {
    closeModal();
    toast('Sincronizando...');
    await loadFromSupabase();
}
