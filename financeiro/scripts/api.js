// ════════════════════════════════════════════════════════════
// financeiro/scripts/api.js
// Sync com Supabase: load, sbCall (save/update/delete), normalizers
// ════════════════════════════════════════════════════════════

function normalizeE(e) { return { ...e, id: String(e.id||''), auto: e.auto==='true'||e.auto===true, noivaId: e.noivaId||'', comprovanteUrl: e.comprovanteUrl||'' }; }
function normalizeS(s) { return { ...s, id: String(s.id||'') }; }
function normalizeN(n) { return { ...n, id: String(n.id||''), contratos: Array.isArray(n.contratos)?n.contratos:[] }; }

// ── Fila de escritas pendentes (rede caiu, coluna ausente no PostgREST, etc.) ──
// Bug real (jan/2026): um save falhava em silêncio (ex.: PGRST204 — coluna
// `equipe` ainda não estava no schema cache do PostgREST) e o registro, vivo só
// no localStorage, sumia no próximo load. A fila garante retry no próximo sync e
// que nada criado/editado se perca por uma falha de escrita.
const PENDING_KEY = 'mk_pending_writes';
const PENDING_MAX_ATTEMPTS = 5;
function _loadPending() { try { return JSON.parse(localStorage.getItem(PENDING_KEY) || '[]'); } catch(_) { return []; } }
function _savePending(q) { try { localStorage.setItem(PENDING_KEY, JSON.stringify(q)); } catch(_) {} }
function _writeKey(p) {
    if (p.action === 'save' && p.data) {
        try { return 'save|' + p.table + '|' + JSON.parse(decodeURIComponent(p.data)).id; } catch(_) { return 'save|' + p.table + '|?'; }
    }
    return p.action + '|' + p.table + '|' + (p.id || '');
}
// Remove da fila qualquer escrita equivalente (mesma ação+tabela+id)
function _dequeue(params) {
    const q = _loadPending();
    const k = _writeKey(params);
    const next = q.filter(p => _writeKey(p) !== k);
    if (next.length !== q.length) _savePending(next);
}
// Enfileira (substituindo versão anterior do mesmo registro)
function _enqueue(params) {
    if (!['save','update','delete'].includes(params.action)) return;
    const k = _writeKey(params);
    const q = _loadPending().filter(p => _writeKey(p) !== k);
    q.push({ action: params.action, table: params.table, data: params.data, id: params.id, field: params.field, value: params.value, _attempts: 0, _ts: Date.now() });
    _savePending(q);
}
// Reinsere na memória um registro que voltou a persistir (caso o load não o tenha trazido)
function _reinsertLocal(table, obj) {
    const arr = table === 'entries' ? entries : table === 'saidas' ? saidas : table === 'noivas' ? noivas : null;
    if (!arr || arr.some(x => String(x.id) === String(obj.id))) return;
    const norm = table === 'entries' ? normalizeE(obj) : table === 'saidas' ? normalizeS(obj) : normalizeN(obj);
    arr.unshift(norm);
}
// Reprocessa a fila — chamada após um load bem-sucedido (PostgREST de volta)
async function flushPendingWrites() {
    let q = _loadPending();
    if (!q.length) return;
    const remaining = [];
    let reinserted = false;
    for (const p of q) {
        try {
            if (p.action === 'save' && p.data) {
                const obj = JSON.parse(decodeURIComponent(p.data));
                await DB[p.table].upsert(obj);
                _reinsertLocal(p.table, obj); reinserted = true;
            } else if (p.action === 'update' && p.id && p.field) {
                await DB[p.table].update(p.id, { [p.field]: p.value });
            } else if (p.action === 'delete' && p.id) {
                await DB[p.table].delete(p.id);
            }
        } catch(e) {
            p._attempts = (p._attempts || 0) + 1;
            if (p._attempts < PENDING_MAX_ATTEMPTS) remaining.push(p);
            else console.warn('[pending] desisti de sincronizar após', PENDING_MAX_ATTEMPTS, 'tentativas:', _writeKey(p), e && e.message);
        }
    }
    _savePending(remaining);
    if (reinserted) { _safeCacheAll(); render(); }
    if (remaining.length) toast('⚠️ ' + remaining.length + ' alteração(ões) ainda não sincronizada(s) — tentarei de novo no próximo sync.', 6000);
}

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
        // Load OK = servidor de volta: reprocessa escritas que ficaram pendentes
        if (!lastErr) { try { await flushPendingWrites(); } catch(_) {} }
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
        _dequeue(params);   // persistiu — tira da fila se estava lá
    } catch(e) {
        updateDot('offline');
        console.warn('sbCall error:', e.message);
        _enqueue(params);   // não perde: re-tenta no próximo sync
        toast('⚠️ Sem conexão com o servidor — alteração salva localmente e será sincronizada no próximo acesso.');
    }
}

async function syncNow() {
    closeModal();
    toast('Sincronizando...');
    await loadFromSupabase();
}
