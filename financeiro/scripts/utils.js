// ════════════════════════════════════════════════════════════
// financeiro/scripts/utils.js
// Helpers puros: formatação, ID, estilos de tipo, toast
// ════════════════════════════════════════════════════════════

function today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function brl(v) {
    return 'R$ ' + Number(v||0).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});
}
function fmtDate(s) {
    if (!s) return '—';
    const [y,m,d] = s.split('-'); return `${d}/${m}`;
}
function getMonthYear(ds) {
    if (!ds) return null;
    const [y,m] = ds.split('-');
    return { y: parseInt(y), m: parseInt(m)-1 };
}
function genId() {
    if (window.crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,10);
}
function addMonths(dateStr, n) {
    const [y,m,d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1 + n, d);
    return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
}

// ── Competência / fluxo de caixa (cartão de crédito) ──────────────
// Subtrai 1 mês sem "vazar" pro mês errado por overflow de dia
// (ex.: 2025-05-31 → 2025-04-30, não 2025-05-01).
function prevMonth(dateStr) {
    const [y,m,d] = String(dateStr||'').split('-').map(Number);
    if (!y || !m) return dateStr || '';
    const dt = new Date(y, m - 2, 1);                                   // dia 1 do mês anterior
    const lastDay = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
    const day = Math.min(d || 1, lastDay);
    return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}
// Competência padrão de uma saída: cartão pesa no mês anterior ao vencimento;
// demais formas pesam na própria data de pagamento.
function defaultDataCaixa(dataPag, forma) {
    if (!dataPag) return '';
    return forma === 'Crédito' ? prevMonth(dataPag) : dataPag;
}
// Data de competência efetiva (com fallback p/ registros antigos sem dataCaixa).
function saidaDataCaixa(s) {
    return (s && s.dataCaixa) ? s.dataCaixa : defaultDataCaixa(s && s.dataPag, s && s.forma);
}
// Data usada pra agrupar uma saída por mês, conforme a visão atual:
//  'caixa' (padrão) → competência · 'banco' → vencimento/movimento bancário.
function saidaBucketDate(s) {
    return (typeof saidasVisao !== 'undefined' && saidasVisao === 'banco')
        ? (s && s.dataPag || '')
        : saidaDataCaixa(s);
}
// "abr/25" — mês/ano curto, pra rótulos de competência.
function fmtMesAno(ds) {
    const my = getMonthYear(ds);
    if (!my) return '—';
    return MONTHS_SHORT[my.m].toLowerCase() + '/' + String(my.y).slice(2);
}

// Guards anti-duplo-clique
let _savingEntry = false;
let _savingSaida = false;

function toast(msg, dur) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg; t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), dur || 2400);
}

// ── Undo toast (soft delete) ──
// Mantém 1 ação pendente por vez. Se outra chegar, a anterior é committada.
let _pendingUndo = null;  // { commitFn, restoreFn, timerId }

function showUndoToast(msg, restoreFn, commitFn, durMs) {
    // Se já tem uma pendente, commita ela imediatamente
    if (_pendingUndo) {
        clearTimeout(_pendingUndo.timerId);
        try { _pendingUndo.commitFn(); } catch (_) {}
        _pendingUndo = null;
    }
    const t = document.getElementById('undo-toast');
    if (!t) {
        // Sem elemento: comporta como delete imediato
        try { commitFn(); } catch (_) {}
        return;
    }
    t.innerHTML = `<span class="undo-msg"></span><button class="undo-btn" onclick="undoSoftDelete()">Desfazer</button>`;
    t.querySelector('.undo-msg').textContent = msg;
    t.classList.add('show');
    const timerId = setTimeout(() => {
        t.classList.remove('show');
        try { commitFn(); } catch (_) {}
        _pendingUndo = null;
    }, durMs || 5000);
    _pendingUndo = { commitFn, restoreFn, timerId };
}

function undoSoftDelete() {
    if (!_pendingUndo) return;
    clearTimeout(_pendingUndo.timerId);
    const restore = _pendingUndo.restoreFn;
    _pendingUndo = null;
    const t = document.getElementById('undo-toast');
    if (t) t.classList.remove('show');
    try { restore(); } catch (_) {}
    toast('Restaurado');
}

// ── 6.A.3 · Busca global ──
// Normaliza string (lowercase + remove acentos)
function gsNorm(s) {
    return String(s || '').toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Busca query em entries/saidas/noivas. Retorna { entries[], saidas[], noivas[] }.
function runGlobalSearch(query, limit) {
    const q = gsNorm(query).trim();
    if (!q || q.length < 2) return { entries: [], saidas: [], noivas: [], total: 0 };
    const lim = limit || 6;
    const match = (s) => gsNorm(s).includes(q);

    const eMatches = (entries || []).filter(e =>
        match(e.cliente) || match(e.obs) || match(e.tipo) ||
        match(e.servico) || match(e.origem)
    ).sort((a,b) => (b.dataPag||'').localeCompare(a.dataPag||''));

    const sMatches = (saidas || []).filter(s =>
        match(s.tipo) || match(s.obs)
    ).sort((a,b) => (b.dataPag||'').localeCompare(a.dataPag||''));

    const nMatches = (noivas || []).filter(n =>
        match(n.nome) || match(n.obs)
    ).sort((a,b) => (b.dataCasamento||'').localeCompare(a.dataCasamento||''));

    return {
        entries: eMatches.slice(0, lim),
        saidas:  sMatches.slice(0, lim),
        noivas:  nMatches.slice(0, lim),
        total:   eMatches.length + sMatches.length + nMatches.length,
        totalEntries: eMatches.length,
        totalSaidas:  sMatches.length,
        totalNoivas:  nMatches.length,
    };
}

// ── 6.A.4 · Notas rápidas (reaproveita módulo anotacoes/) ──
// Mantém um caderno "Notas rápidas" auto-criado e um cache localStorage.
const _QN_CADERNO_NOME = 'Notas rápidas';
let _qnCadernoId = localStorage.getItem('mk_qn_caderno_id') || '';
let _qnNotes     = (() => {
    try { return JSON.parse(localStorage.getItem('mk_qn_notes') || '[]'); }
    catch(_) { return []; }
})();

function qnGetNotes() { return _qnNotes.slice(); }

async function _qnEnsureCaderno() {
    if (_qnCadernoId) return _qnCadernoId;
    // Procura caderno existente
    try {
        const cads = await DB.cadernos.list();
        const existente = cads.find(c => c.nome === _QN_CADERNO_NOME);
        if (existente) {
            _qnCadernoId = existente.id;
            localStorage.setItem('mk_qn_caderno_id', _qnCadernoId);
            return _qnCadernoId;
        }
        // Cria
        const novo = { id: 'qn_' + Date.now(), nome: _QN_CADERNO_NOME, emoji: '📝', cor: '#a36844' };
        await DB.cadernos.upsert(novo);
        _qnCadernoId = novo.id;
        localStorage.setItem('mk_qn_caderno_id', _qnCadernoId);
        return _qnCadernoId;
    } catch (err) {
        console.warn('[qn] ensureCaderno falhou:', err);
        return '';
    }
}

async function qnLoadNotes() {
    try {
        const cadId = await _qnEnsureCaderno();
        if (!cadId) return;
        const notes = await DB.anotacoes.listByCaderno(cadId);
        _qnNotes = (notes || []).map(n => ({
            id: n.id, titulo: n.titulo, updatedAt: n.updatedAt
        }));
        try { localStorage.setItem('mk_qn_notes', JSON.stringify(_qnNotes)); } catch(_) {}
    } catch (err) {
        console.warn('[qn] load falhou:', err);
    }
}

async function qnAdd(titulo) {
    const t = String(titulo || '').trim();
    if (!t) return;
    const cadId = await _qnEnsureCaderno();
    if (!cadId) { toast('Erro ao carregar caderno'); return; }
    const nota = {
        id: 'qn_' + Date.now(),
        cadernoId: cadId,
        titulo: t,
        conteudo: '',
        tags: [],
        imagens: [],
        createdAt: new Date().toISOString(),
    };
    // UI otimista
    _qnNotes.unshift({ id: nota.id, titulo: nota.titulo, updatedAt: nota.createdAt });
    try { localStorage.setItem('mk_qn_notes', JSON.stringify(_qnNotes)); } catch(_) {}
    render();
    try { await DB.anotacoes.upsert(nota); }
    catch (err) { console.warn('[qn] add falhou:', err); toast('Nota salva localmente — sincroniza depois'); }
}

async function qnDelete(id) {
    _qnNotes = _qnNotes.filter(n => n.id !== id);
    try { localStorage.setItem('mk_qn_notes', JSON.stringify(_qnNotes)); } catch(_) {}
    render();
    try { await DB.anotacoes.delete(id); } catch(_) {}
}

function qnSubmit(ev) {
    if (ev && ev.key && ev.key !== 'Enter') return;
    const inp = document.getElementById('qn-input');
    if (!inp) return;
    const v = inp.value;
    inp.value = '';
    qnAdd(v);
}

// ── PIX (6.G.2): config + gerador de BR Code (payload + QR) ──
function getPixConfig() {
    try {
        const raw = localStorage.getItem('mk_pix_config');
        return raw ? JSON.parse(raw) : { chave: '', nome: '', cidade: '' };
    } catch(_) { return { chave: '', nome: '', cidade: '' }; }
}
function setPixConfig(cfg) {
    localStorage.setItem('mk_pix_config', JSON.stringify(cfg || {}));
}

// EMV BR Code builder. Padrão oficial BACEN/EMVCo.
// Estrutura: campos TLV (id 2 dígitos + tamanho 2 dígitos + valor).
// Campo 63 (CRC16) calculado por último com polinômio 0x1021.
function buildPixPayload({ chave, nome, cidade, valor, txid }) {
    if (!chave) throw new Error('Chave PIX vazia');
    nome = String(nome || 'PAGADOR').toUpperCase().slice(0, 25);
    cidade = String(cidade || 'BRASIL').toUpperCase().slice(0, 15);
    txid = String(txid || '***').slice(0, 25);

    const tlv = (id, val) => {
        const s = String(val);
        return id + String(s.length).padStart(2, '0') + s;
    };

    // Campo 26: Merchant Account Info (GUI + chave)
    const mai = tlv('00', 'BR.GOV.BCB.PIX') + tlv('01', String(chave).trim());

    // Campo 62: Additional Data (txid)
    const adf = tlv('05', txid);

    let payload =
        tlv('00', '01') +           // Payload format indicator
        tlv('26', mai) +
        tlv('52', '0000') +         // MCC
        tlv('53', '986') +          // BRL
        (valor != null && valor > 0 ? tlv('54', Number(valor).toFixed(2)) : '') +
        tlv('58', 'BR') +
        tlv('59', nome) +
        tlv('60', cidade) +
        tlv('62', adf);

    // CRC16/CCITT-FALSE com polinômio 0x1021, init 0xFFFF
    const dataForCrc = payload + '6304';
    let crc = 0xFFFF;
    for (let i = 0; i < dataForCrc.length; i++) {
        crc ^= dataForCrc.charCodeAt(i) << 8;
        for (let j = 0; j < 8; j++) {
            crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
            crc &= 0xFFFF;
        }
    }
    const crcHex = crc.toString(16).toUpperCase().padStart(4, '0');
    return payload + '6304' + crcHex;
}

// URL pra gerar QR code (api.qrserver.com — sem dep externa no bundle)
function pixQrUrl(payload, size) {
    const s = size || 280;
    return `https://api.qrserver.com/v1/create-qr-code/?size=${s}x${s}&margin=2&data=${encodeURIComponent(payload)}`;
}

// ── Meta mensal de faturamento (localStorage) ──
function getMetaMensal() {
    const v = localStorage.getItem('mk_meta_mensal');
    const n = v ? Number(v) : 0;
    return isFinite(n) && n > 0 ? n : 0;
}
function setMetaMensal(v) {
    if (!v || v <= 0) localStorage.removeItem('mk_meta_mensal');
    else localStorage.setItem('mk_meta_mensal', String(v));
}
function promptMetaMensal() {
    const atual = getMetaMensal();
    const v = prompt('Meta de faturamento mensal (R$):\nDeixe vazio para desativar.', atual || '');
    if (v === null) return;
    const trimmed = v.trim();
    if (trimmed === '') { setMetaMensal(0); toast('Meta desativada'); render(); return; }
    const n = parseFloat(trimmed.replace(/\./g,'').replace(',', '.'));
    if (!isFinite(n) || n < 0) { toast('Valor inválido'); return; }
    setMetaMensal(n);
    toast(n > 0 ? `Meta definida: ${brl(n)}/mês` : 'Meta desativada');
    render();
}

function typeStyle(t) {
    return { Sinal:{bg:'#fff3e0',col:'#bf360c',ico:SVG.lock}, Pagamento:{bg:'#efebe9',col:'#4e342e',ico:SVG.money}, Parcela:{bg:'#e3f2fd',col:'#0d47a1',ico:SVG.calendar} }[t]
        || { bg:'#f5f5f5', col:'#666', ico:SVG.money };
}
function entradaStyle(origem, tipo) {
    const ico = {Sinal:SVG.lock, Parcela:SVG.calendar, Pagamento:SVG.money}[tipo] || SVG.money;
    const cores = {
        'Noiva':                  {bg:'#fff3e0', col:'#bf360c'},
        'Produção Social':        {bg:'#e8f5e9', col:'#2e7d32'},
        'Assistência':            {bg:'#f3e5f5', col:'#6a1b9a'},
        'Curso de Automaquiagem': {bg:'#e3f2fd', col:'#0d47a1'},
    };
    const {bg,col} = cores[origem] || {bg:'#f5f5f5', col:'#666'};
    return {bg, col, ico};
}
function fmtOrigem(o) {
    return o === 'Curso de Automaquiagem' ? 'Automaquiagem' : (o || '');
}
function saidaStyle(t) {
    const map = {
        // Tipos canônicos atuais
        'DAS':                               {bg:'#fce4ec',col:'#880e4f',ico:SVG.bank},
        'Cursos':                            {bg:'#e3f2fd',col:'#0d47a1',ico:SVG.book},
        'Assistente':                        {bg:'#f3e5f5',col:'#6a1b9a',ico:SVG.userSingle},
        'Reposição/Investimento de material':{bg:'#fff8e1',col:'#f57f17',ico:SVG.bag},
        'Deslocamento':                      {bg:'#e8eaf6',col:'#283593',ico:SVG.truck},
        'Alimentação trabalho':              {bg:'#fff3e0',col:'#e65100',ico:SVG.coffee},
        'Equipamentos':                      {bg:'#e0f2f1',col:'#00695c',ico:SVG.camera},
        'Modelos':                           {bg:'#fce4ec',col:'#c2185b',ico:SVG.userSingle},
        'Assinaturas':                       {bg:'#ede7f6',col:'#4527a0',ico:SVG.repeat},
        'Marketing':                         {bg:'#e8f5e9',col:'#2e7d32',ico:SVG.target},
        'Equipe':                            {bg:'#fbe9e7',col:'#bf360c',ico:SVG.users},
        'Repasse para equipe':               {bg:'#f3e5f5',col:'#6a1b9a',ico:SVG.users},
        'Outro':                             {bg:'#f5f5f5',col:'#424242',ico:SVG.tag},
        'Pessoal':                           {bg:'#efebe9',col:'#5d4037',ico:SVG.tag},
        // Tipos legados (retrocompatibilidade)
        'Curso':                             {bg:'#e3f2fd',col:'#0d47a1',ico:SVG.book},
        'Seguro de Celular':                 {bg:'#e8eaf6',col:'#283593',ico:SVG.phone},
        'Reposição de Material':             {bg:'#fff8e1',col:'#f57f17',ico:SVG.bag},
        'Investimento Produto':              {bg:'#e0f7fa',col:'#006064',ico:SVG.box},
        'Investimento Material':             {bg:'#efebe9',col:'#4e342e',ico:SVG.box},
    };
    return map[t] || { bg:'#f5f5f5', col:'#666', ico:SVG.money };
}

// Etiquetas de equipe de uma entrada. São coisas diferentes:
//  `equipe`      → eu trabalhei PARA a equipe de outra pessoa
//  `responsavel` → um profissional da MINHA equipe executou (gera repasse
//                  como saída "Repasse para equipe")
function equipeTags(e) {
    const terceiros = e.equipe ? `<span class="equipe-tag">↑ ${e.equipe}</span>` : '';
    const resp = e.responsavel ? `<span class="resp-tag">👥 ${e.responsavel}</span>` : '';
    return terceiros + resp;
}

function updateDot(_state) { /* indicador de sync removido — placeholder p/ compat */ }

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function resizeImageBase64(base64, tipo) {
    return new Promise(res => {
        const img = new Image();
        img.onload = function() {
            const MAX = 1600;
            let w = img.width, h = img.height;
            if (w > MAX || h > MAX) {
                if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
                else       { w = Math.round(w * MAX / h); h = MAX; }
            }
            const cv = document.createElement('canvas');
            cv.width = w; cv.height = h;
            cv.getContext('2d').drawImage(img, 0, 0, w, h);
            res(cv.toDataURL('image/jpeg', 0.82).split(',')[1]);
        };
        img.onerror = () => res(base64);
        img.src = 'data:' + tipo + ';base64,' + base64;
    });
}

function dl(csv, name) {
    const blob = new Blob(['﻿'+csv], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), {href:url, download:name});
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}
