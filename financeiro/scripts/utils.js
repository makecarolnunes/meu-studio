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

// Guards anti-duplo-clique
let _savingEntry = false;
let _savingSaida = false;

function toast(msg, dur) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg; t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), dur || 2400);
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
    return { 'DAS':{bg:'#fce4ec',col:'#880e4f',ico:SVG.bank}, 'Curso':{bg:'#e3f2fd',col:'#0d47a1',ico:SVG.book},
             'Assistente':{bg:'#f3e5f5',col:'#6a1b9a',ico:SVG.users}, 'Seguro de Celular':{bg:'#e8eaf6',col:'#283593',ico:SVG.phone},
             'Reposição de Material':{bg:'#fff8e1',col:'#f57f17',ico:SVG.bag},
             'Investimento Produto':{bg:'#e0f7fa',col:'#006064',ico:SVG.box},
             'Investimento Material':{bg:'#efebe9',col:'#4e342e',ico:SVG.box},
             'Outro':{bg:'#f5f5f5',col:'#424242',ico:SVG.tag} }[t]
        || { bg:'#f5f5f5', col:'#666', ico:SVG.money };
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
