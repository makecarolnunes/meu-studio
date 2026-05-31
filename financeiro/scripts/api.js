// ════════════════════════════════════════════════════════════
// financeiro/scripts/api.js
// Sync com Supabase: load, sbCall (save/update/delete), normalizers
// ════════════════════════════════════════════════════════════

function normalizeE(e) { return { ...e, id: String(e.id||''), auto: e.auto==='true'||e.auto===true, noivaId: e.noivaId||'', comprovanteUrl: e.comprovanteUrl||'' }; }
function normalizeS(s) { return { ...s, id: String(s.id||'') }; }
function normalizeN(n) { return { ...n, id: String(n.id||''), contratos: Array.isArray(n.contratos)?n.contratos:[] }; }

// Cache de LEITURA apenas (abrir rápido / ver dados). Nunca é fonte da verdade:
// só é escrito DEPOIS que o Supabase confirma uma escrita (ou após um load).
// Salva no localStorage tolerando quota (iOS Safari ≈ 2.5MB).
// Loga tamanhos pra ajudar a identificar o vilão. Não derruba o sync.
function _safeCacheAll() {
    const items = [
        { key: 'mk_entries', payload: entries },
        { key: 'mk_saidas',  payload: saidas  },
        { key: 'mk_noivas',  payload: noivas  },
    ];
    for (const { key, payload } of items) {
        try {
            const str = JSON.stringify(payload);
            localStorage.setItem(key, str);
        } catch(e) {
            const sizes = {};
            try {
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    sizes[k] = (localStorage.getItem(k) || '').length;
                }
            } catch(_) {}
            const top = Object.entries(sizes).sort((a,b) => b[1]-a[1]).slice(0, 6)
                .map(([k,v]) => `${k}:${(v/1024).toFixed(1)}KB`).join(' ');
            console.warn(`[cache] localStorage cheio ao salvar ${key} — top: ${top}`, e.message);
            return { ok: false, fullKey: key, top };
        }
    }
    return { ok: true };
}

async function loadFromSupabase() {
    updateDot('syncing');
    isSyncing = true;
    // Retry com backoff — cold start em mobile/4G falha na 1ª; 2 retries cobrem o caso
    const delays = [0, 1500, 4000];
    let lastErr = null;
    let cacheErr = null;
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
                // Cache isolado — se localStorage estourar, sync ainda é sucesso
                const cacheRes = _safeCacheAll();
                if (!cacheRes.ok) cacheErr = cacheRes;
                updateDot('ok');
                lastErr = null;
                // Preços em paralelo (não bloqueia render)
                loadServicePricesFromSupabase().catch(() => {});
                // 6.A.4 · Notas rápidas agora vivem no shared/js/global-notes.js
                // (carregam on demand quando o FAB esquerdo abre)
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
        } else if (cacheErr) {
            toast('Dados carregados, mas cache local cheio (' + cacheErr.fullKey + '). Veja console.', 6000);
        }
    } finally {
        isSyncing = false;
        render();
        document.getElementById('loading-overlay').style.display = 'none';
    }
}

// Escrita CONFIRMADA. Resolve `true` só se o Supabase aceitou; em falha mostra
// erro e resolve `false`. Quem chama NÃO deve atualizar tela/cache como salvo
// quando isto retornar false — assim nada é dado como salvo sem estar no Supabase.
const SBCALL_TIMEOUT_MS = 15000;
async function sbCall(params) {
    const { action, table, data, id, field, value } = params;
    // Sem internet: falha NA HORA (não espera o fetch pendurar até o timeout do SO)
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        updateDot('offline');
        toast('❌ Sem internet — NÃO foi salvo. Conecte-se e tente de novo.', 7000);
        return false;
    }
    updateDot('syncing');
    try {
        const op = (async () => {
            if (action === 'save' && data) {
                await DB[table].upsert(JSON.parse(decodeURIComponent(data)));
            } else if (action === 'delete' && id) {
                await DB[table].delete(id);
            } else if (action === 'update' && id && field) {
                await DB[table].update(id, { [field]: value });
            }
        })();
        // Timeout: nunca deixa o salvamento "pendurar" se a rede não responder
        let to;
        await Promise.race([
            op,
            new Promise((_, rej) => { to = setTimeout(() => rej(new Error('tempo esgotado — servidor não respondeu')), SBCALL_TIMEOUT_MS); }),
        ]);
        clearTimeout(to);
        updateDot('ok');
        return true;
    } catch(e) {
        updateDot('offline');
        console.warn('sbCall error:', e && e.message);
        toast('❌ NÃO foi salvo no servidor: ' + (e && e.message ? e.message : 'sem conexão') + '. Verifique a internet e tente de novo.', 8000);
        return false;
    }
}

async function syncNow() {
    closeModal();
    toast('Sincronizando...');
    await loadFromSupabase();
}
