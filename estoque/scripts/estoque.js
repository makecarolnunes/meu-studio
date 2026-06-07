var STATUS_CFG = {
  ok:       { label: 'OK',       color: '#3B6D11', bg: '#EAF3DE' },
  acabando: { label: 'Acabando', color: '#BA7517', bg: '#FAEEDA' },
  zerado:   { label: 'Zerado',   color: '#C62828', bg: '#FCE7E7' },
  investir: { label: 'Investir', color: '#6A1B9A', bg: '#F3E5F5' },
  wishlist: { label: 'Wishlist', color: '#1565C0', bg: '#E3F2FD' },
};

var SVG_CHECK =
  '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

var items     = [];
var curFilter = 'todos';
var curSearch = '';
var curCat    = 'todos';
var editId    = null;

// ── AUTH ──────────────────────────────────────────────────────
function checkAuth() {
  var s = localStorage.getItem('mk_session');
  if (s) {
    try {
      var sess = JSON.parse(s);
      if (Date.now() < sess.expires) return true;
    } catch(e) {}
  }
  localStorage.removeItem('mk_session');
  window.location.href = '../';
  return false;
}

// ── UTILS ─────────────────────────────────────────────────────
function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function showToast(msg, err) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (err ? ' toast-err' : '');
  clearTimeout(t._tmr);
  t._tmr = setTimeout(function() { t.className = 'toast'; }, 2600);
}

// ── DATA ──────────────────────────────────────────────────────
async function load() {
  document.getElementById('hsub').textContent = 'Sincronizando...';
  try {
    items = await DB.estoque.list();
    render();
    document.getElementById('hsub').textContent = '';
  } catch(e) {
    document.getElementById('hsub').textContent = 'Sem conexão';
    console.error('[estoque]', e);
  }
}

async function saveItem() {
  var nome = (document.getElementById('f-nome').value || '').trim();
  if (!nome) { showToast('Nome obrigatório', true); return; }
  var btn = document.getElementById('btn-save');
  btn.disabled = true;
  try {
    await DB.estoque.upsert({
      id:        editId || String(Date.now()),
      nome:      nome,
      categoria: document.getElementById('f-cat').value,
      status:    document.getElementById('f-status').value,
      valor:     parseFloat(document.getElementById('f-valor').value) || 0,
      obs:       (document.getElementById('f-obs').value || '').trim(),
      // comprado não é tocado pelo formulário — preservado no DB
    });
    closePanel();
    showToast(editId ? 'Atualizado' : 'Item adicionado');
    await load();
  } catch(e) {
    showToast('Erro ao salvar', true);
  } finally {
    btn.disabled = false;
  }
}

async function deleteItem() {
  if (!editId) return;
  if (!confirm('Excluir este item do estoque?')) return;
  try {
    await DB.estoque.delete(editId);
    closePanel();
    showToast('Removido');
    await load();
  } catch(e) {
    showToast('Erro ao excluir', true);
  }
}

// ── TOGGLE COMPRADO (otimista) ────────────────────────────────
async function toggleComprado(event, id) {
  event.stopPropagation();
  var item = items.find(function(i) { return i.id === id; });
  if (!item) return;
  var prev = item.comprado;
  item.comprado = !prev;
  render();
  try {
    await DB.estoque.upsert(item);
    if (!prev) showToast('Marcado como comprado ✓');
  } catch(e) {
    item.comprado = prev;
    render();
    showToast('Erro ao salvar', true);
  }
}

// ── DESKTOP SIDEBAR ───────────────────────────────────
function buildSidebar() {
  var sbStats = document.getElementById('d-sb-stats');
  if (!sbStats) return;

  var ativos    = items.filter(function(i) { return !i.comprado; });
  var comprados = items.filter(function(i) { return  i.comprado; });
  var repor     = ativos.filter(function(i){ return i.status === 'zerado'; }).length;
  var acabando  = ativos.filter(function(i){ return i.status === 'acabando'; }).length;
  var investir  = ativos.filter(function(i){ return i.status === 'investir'; }).length;
  var wishlist  = ativos.filter(function(i){ return i.status === 'wishlist'; }).length;
  var ok        = ativos.filter(function(i){ return i.status === 'ok'; }).length;

  sbStats.innerHTML =
    '<div class="d-sb-stats-grid">' +
      '<div class="d-sb-stat"><div class="d-sb-stat-lbl">Total</div><span class="d-sb-stat-val">' + ativos.length + '</span></div>' +
      '<div class="d-sb-stat"><div class="d-sb-stat-lbl">Repor</div><span class="d-sb-stat-val c-repor">' + repor + '</span></div>' +
      '<div class="d-sb-stat"><div class="d-sb-stat-lbl">Acabando</div><span class="d-sb-stat-val c-acabando">' + acabando + '</span></div>' +
      '<div class="d-sb-stat"><div class="d-sb-stat-lbl">Wishlist</div><span class="d-sb-stat-val c-wishlist">' + wishlist + '</span></div>' +
    '</div>';

  var statusList = [
    { v: 'todos',    lbl: 'Todos',          dot: '#aaa',      cnt: ativos.length },
    { v: 'repor',    lbl: 'Repor (zerado)', dot: '#C62828',   cnt: repor },
    { v: 'acabando', lbl: 'Acabando',        dot: '#BA7517',   cnt: acabando },
    { v: 'investir', lbl: 'Investir',        dot: '#6A1B9A',   cnt: investir },
    { v: 'wishlist', lbl: 'Wishlist',         dot: '#1565C0',   cnt: wishlist },
  ];
  var stHtml = '<div class="d-sb-lbl">Status</div>';
  for (var i = 0; i < statusList.length; i++) {
    var s = statusList[i];
    stHtml += '<button class="d-sb-fil' + (curFilter === s.v ? ' active' : '') + '" onclick="setFD(\'' + s.v + '\')">' +
      '<div class="d-sb-fil-dot" style="background:' + s.dot + '"></div>' +
      '<span class="d-sb-fil-name">' + s.lbl + '</span>' +
      '<span class="d-sb-fil-cnt">' + s.cnt + '</span>' +
    '</button>';
  }
  document.getElementById('d-sb-status').innerHTML = stHtml;

  var cats = ['todos', 'Maquiagem', 'Cabelo', 'Skin', 'Equipamentos', 'Consumíveis', 'Outros'];
  var catHtml = '<div class="d-sb-lbl">Categoria</div><div class="d-sb-cats-row">';
  for (var c = 0; c < cats.length; c++) {
    var cv = cats[c], cl = cv === 'todos' ? 'Todas' : cv;
    catHtml += '<button class="d-sb-cat' + (curCat === cv ? ' active' : '') + '" onclick="setCatD(\'' + esc(cv) + '\')">' + esc(cl) + '</button>';
  }
  catHtml += '</div>';
  document.getElementById('d-sb-cats').innerHTML = catHtml;

  var filterLabels = { todos: 'Todos os itens', repor: 'Repor (zerado)', acabando: 'Acabando', investir: 'Investir', wishlist: 'Wishlist' };
  var dTitle = document.getElementById('d-toolbar-title');
  var dCnt   = document.getElementById('d-toolbar-cnt');
  if (dTitle) dTitle.textContent = filterLabels[curFilter] || 'Todos os itens';
  if (dCnt) {
    var cnt = filteredList().length;
    dCnt.textContent = cnt + ' item' + (cnt !== 1 ? 's' : '');
  }
}

function setFD(f) {
  curFilter = f;
  document.querySelectorAll('.ftab').forEach(function(b) { b.classList.toggle('on', b.dataset.f === f); });
  render();
}

function setCatD(c) { curCat = c; render(); }
function setSearch(v) { curSearch = (v || '').trim().toLowerCase(); render(); }

function filteredList() {
  var ativos = items.filter(function(i) { return !i.comprado; });
  var list = ativos;
  if (curFilter === 'repor')    list = ativos.filter(function(i){ return i.status === 'zerado' || i.status === 'acabando'; });
  else if (curFilter === 'acabando') list = ativos.filter(function(i){ return i.status === 'acabando'; });
  else if (curFilter === 'investir') list = ativos.filter(function(i){ return i.status === 'investir'; });
  else if (curFilter === 'wishlist') list = ativos.filter(function(i){ return i.status === 'wishlist'; });
  if (curCat !== 'todos') list = list.filter(function(i){ return i.categoria === curCat; });
  if (curSearch) list = list.filter(function(i){
    return (i.nome || '').toLowerCase().includes(curSearch) || (i.obs || '').toLowerCase().includes(curSearch);
  });
  return list;
}

// ── RENDER ────────────────────────────────────────────────────
function render() {
  var comprados   = items.filter(function(i) { return  i.comprado; });
  var ativos      = items.filter(function(i) { return !i.comprado; });

  var counts = { repor: 0, acabando: 0, wishlist: 0 };
  ativos.forEach(function(i) {
    if (i.status === 'zerado')   counts.repor++;
    if (i.status === 'acabando') counts.acabando++;
    if (i.status === 'wishlist') counts.wishlist++;
  });

  document.getElementById('c-total').textContent    = ativos.length;
  document.getElementById('c-repor').textContent    = counts.repor;
  document.getElementById('c-acabando').textContent = counts.acabando;
  document.getElementById('c-wishlist').textContent = counts.wishlist;
  document.getElementById('c-comprado').textContent = comprados.length;

  buildSidebar();

  var list = filteredList();
  var html = '';

  if (!list.length && !comprados.length) {
    html =
      '<div class="empty">' +
        '<div class="empty-ico"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg></div>' +
        '<p>Nenhum item' + (curFilter !== 'todos' ? ' neste filtro' : '') + '.<br>Toque <strong>+</strong> para adicionar.</p>' +
      '</div>';
    document.getElementById('content').innerHTML = html;
    return;
  }

  if (!list.length) {
    html += '<div class="empty-filter"><p>Nenhum item' + (curFilter !== 'todos' ? ' neste filtro' : '') + '.</p></div>';
  } else {
    html += renderGrouped(list);
  }

  // Seção de comprados
  if (comprados.length) {
    html +=
      '<div class="comp-sec-hdr">' +
        '<div class="comp-sec-line"></div>' +
        '<span class="comp-sec-lbl">' +
          SVG_CHECK + ' Comprados <span class="comp-sec-count">' + comprados.length + '</span>' +
        '</span>' +
        '<div class="comp-sec-line"></div>' +
      '</div>';
    html += comprados.map(function(i) { return itemCardHtml(i, true); }).join('');
  }

  document.getElementById('content').innerHTML = html;
}

function itemCardHtml(i, isComprado) {
  var s = STATUS_CFG[i.status] || STATUS_CFG.ok;
  return '<div class="item-card' + (isComprado ? ' is-comprado' : '') + '" onclick="openEdit(\'' + esc(i.id) + '\')">' +
    '<button class="item-check' + (isComprado ? ' checked' : '') + '" ' +
      'onclick="toggleComprado(event,\'' + esc(i.id) + '\')" ' +
      'aria-label="' + (isComprado ? 'Desmarcar compra' : 'Marcar como comprado') + '">' +
      (isComprado ? SVG_CHECK : '') +
    '</button>' +
    '<div class="item-info">' +
      '<div class="item-nome">' + esc(i.nome) + '</div>' +
      '<div class="item-cat">' +
        (i.categoria ? esc(i.categoria) : '') +
        (i.valor > 0 ? '<span class="item-valor">R$ ' + i.valor.toLocaleString('pt-BR', {minimumFractionDigits:2,maximumFractionDigits:2}) + '</span>' : '') +
      '</div>' +
      (i.obs ? '<div class="item-obs">' + esc(i.obs) + '</div>' : '') +
    '</div>' +
    '<span class="sbadge" style="color:' + s.color + ';background:' + s.bg + '">' + s.label + '</span>' +
  '</div>';
}

// ── AGRUPAMENTO POR STATUS (página principal) ─────────────────
// Ordem dos tópicos na lista: zerado → acabando → investir → wishlist → ok
var STATUS_ORDER   = ['zerado', 'acabando', 'investir', 'wishlist', 'ok'];
var STATUS_SEC_LBL = {
  zerado:   'Zerado — repor',
  acabando: 'Acabando',
  investir: 'Investir',
  wishlist: 'Wishlist',
  ok:       'OK — tenho',
};

function renderGrouped(list) {
  var groups = STATUS_ORDER.map(function(st) {
    return { st: st, items: list.filter(function(i) { return i.status === st; }) };
  }).filter(function(g) { return g.items.length; });

  // Qualquer status fora da lista conhecida cai num grupo final
  var others = list.filter(function(i) { return STATUS_ORDER.indexOf(i.status) < 0; });
  if (others.length) groups.push({ st: 'outros', items: others });

  // Um único grupo (ex.: filtro de status específico) → sem cabeçalho
  if (groups.length <= 1) {
    return list.map(function(i) { return itemCardHtml(i, false); }).join('');
  }

  return groups.map(function(g) {
    return statusSecHeaderHtml(g.st, g.items.length) +
      g.items.map(function(i) { return itemCardHtml(i, false); }).join('');
  }).join('');
}

function statusSecHeaderHtml(status, count) {
  var cfg = STATUS_CFG[status] || { color: '#888', bg: '#EEE' };
  var lbl = STATUS_SEC_LBL[status] || cfg.label || 'Outros';
  return '<div class="status-sec-hdr">' +
      '<span class="status-sec-dot" style="background:' + cfg.color + '"></span>' +
      '<span class="status-sec-lbl" style="color:' + cfg.color + '">' + lbl + '</span>' +
      '<span class="status-sec-count" style="color:' + cfg.color + ';background:' + cfg.bg + '">' + count + '</span>' +
      '<span class="status-sec-line"></span>' +
    '</div>';
}

// ── FILTERS ───────────────────────────────────────────────────
function setF(f) {
  curFilter = f;
  document.querySelectorAll('.ftab').forEach(function(b) {
    b.classList.toggle('on', b.dataset.f === f);
  });
  render();
}

// Alias para compatibilidade com mobile (setF) e desktop (setFD já existe acima)

// ── PANEL ─────────────────────────────────────────────────────
function openAdd() {
  editId = null;
  document.getElementById('p-title').textContent = 'Novo Item';
  document.getElementById('f-nome').value   = '';
  document.getElementById('f-valor').value  = '';
  document.getElementById('f-cat').value    = 'Maquiagem';
  document.getElementById('f-status').value = 'ok';
  document.getElementById('f-obs').value    = '';
  document.getElementById('btn-del').style.display = 'none';
  showPanel();
}

function openEdit(id) {
  var item = items.find(function(i) { return i.id === id; });
  if (!item) return;
  editId = id;
  document.getElementById('p-title').textContent = 'Editar Item';
  document.getElementById('f-nome').value   = item.nome;
  document.getElementById('f-valor').value  = item.valor > 0 ? item.valor : '';
  document.getElementById('f-cat').value    = item.categoria || 'Maquiagem';
  document.getElementById('f-status').value = item.status    || 'ok';
  document.getElementById('f-obs').value    = item.obs       || '';
  document.getElementById('btn-del').style.display = 'block';
  showPanel();
}

function showPanel() {
  document.getElementById('overlay').style.display = 'block';
  document.getElementById('panel').classList.add('open');
  setTimeout(function() { document.getElementById('f-nome').focus(); }, 300);
}

function closePanel() {
  document.getElementById('overlay').style.display = 'none';
  document.getElementById('panel').classList.remove('open');
}

// ── INIT ──────────────────────────────────────────────────────
if (checkAuth()) { load(); }
