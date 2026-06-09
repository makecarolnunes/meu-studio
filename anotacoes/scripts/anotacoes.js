'use strict';

// ── State ─────────────────────────────────────────────────────────────
var cadernos  = [];
var notas     = [];
var curCad    = null;    // caderno aberto
var curNota   = null;    // nota em edição (null = nova)
var curView   = 'cadernos';
var tagFilter = null;
var editTags  = [];      // tags na edição atual
var editImgs  = [];      // imagens na edição atual [{url, path, nome}]
var editCadId = null;    // id do caderno em edição no form (null = novo)
var cadMenuId = null;    // id do caderno cujo menu está aberto

// ── Auto-save ─────────────────────────────────────────────────────────
var _autoSaveTimer = null;
var _isDirty       = false;

// ── Auth ──────────────────────────────────────────────────────────────
(function checkAuth() {
  var s = localStorage.getItem('mk_session');
  if (s) {
    try {
      var sess = JSON.parse(s);
      if (Date.now() < sess.expires) return;
    } catch(e) {}
    localStorage.removeItem('mk_session');
  }
  window.location.href = '../';
})();

// ── Toast ─────────────────────────────────────────────────────────────
var _toastTimer;
function toast(msg, type, action) {
  var el = document.getElementById('toast');
  el.innerHTML = '';
  if (action && action.label) {
    var span = document.createElement('span');
    span.textContent = msg;
    var btn = document.createElement('button');
    btn.className = 'toast-action';
    btn.type = 'button';
    btn.textContent = action.label;
    btn.onclick = function() {
      el.className = 'toast';
      clearTimeout(_toastTimer);
      action.onClick();
    };
    el.appendChild(span);
    el.appendChild(btn);
  } else {
    el.textContent = msg;
  }
  el.className = 'toast show' +
    (type === 'err' ? ' toast-err' : '') +
    (action ? ' toast-action-on' : '');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(function() { el.className = 'toast'; }, action ? 6500 : 2800);
}

// ── Auto-save ─────────────────────────────────────────────────────────
function setSaveStatus(st, msg) {
  var el  = document.getElementById('save-status');
  var hdr = document.getElementById('hdr-save-status');
  if (el)  { el.textContent = msg; el.className = 'save-status ' + st; }
  if (hdr) { hdr.textContent = msg; }
}

function scheduleAutoSave() {
  _isDirty = true;
  setSaveStatus('', '');
  clearTimeout(_autoSaveTimer);
  _autoSaveTimer = setTimeout(autoSave, 1500);
}

async function autoSave() {
  _autoSaveTimer = null;
  if (!_isDirty || !curCad) return;
  var titulo = (document.getElementById('f-titulo').value || '').trim();
  if (!titulo) { setSaveStatus('', 'Digite um título para salvar'); return; }

  _isDirty = false;
  setSaveStatus('saving', 'Salvando...');

  var now  = new Date().toISOString();
  var nota = {
    id:        curNota ? curNota.id : String(Date.now()),
    cadernoId: curCad.id,
    titulo:    titulo,
    conteudo:  getEditorHtml(),
    tags:      editTags.slice(),
    imagens:   editImgs.slice(),
    createdAt: curNota ? curNota.createdAt : now,
    updatedAt: now,
  };

  var isNew = !curNota;
  if (isNew) {
    notas.unshift(nota);
  } else {
    var idx = notas.findIndex(function(n) { return n.id === nota.id; });
    if (idx >= 0) notas[idx] = nota;
  }
  curNota = nota;

  try {
    await DB.anotacoes.upsert(nota);
    setSaveStatus('saved', 'Salvo ✓');
    setTimeout(function() { setSaveStatus('', ''); }, 2500);
    if (isNew) {
      showEditorDesktop(true);
      renderNotas();
    } else {
      renderNotas();
    }
    // Atualiza data no desktop
    var dateEl = document.getElementById('d-editor-date');
    if (dateEl) {
      var d = new Date(nota.updatedAt);
      dateEl.textContent = 'Salvo às ' + d.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
    }
  } catch(e) {
    _isDirty = true;
    setSaveStatus('error', 'Erro ao salvar');
  }
}

async function flushAutoSave() {
  if (!_isDirty) return;
  clearTimeout(_autoSaveTimer);
  await autoSave();
}

// ── Editor rico (contenteditable) ─────────────────────────────────────
function editorEl() { return document.getElementById('f-conteudo'); }

// Lê o HTML da nota; '' quando o editor está visualmente vazio
function getEditorHtml() {
  var el = editorEl();
  if (!el) return '';
  var h = el.innerHTML;
  if (h === '' || h === '<br>' || h === '<p></p>' ||
      h === '<p><br></p>' || h === '<div><br></div>') return '';
  return h;
}

// Heurística: o conteúdo salvo já é HTML?
function looksHtml(s) {
  return /<(p|br|h[1-6]|ul|ol|li|div|b|i|u|strong|em|a|mark|span|blockquote)\b/i.test(String(s || ''));
}

// Preenche o editor; notas antigas (texto puro) são escapadas e ganham <br>
function setEditorHtml(content) {
  var el = editorEl();
  if (!el) return;
  content = content || '';
  if (content && !looksHtml(content)) {
    el.innerHTML = esc(content).replace(/\n/g, '<br>');
  } else {
    el.innerHTML = content;
  }
}

// Texto puro a partir de HTML (previews e busca)
function stripHtml(s) {
  return String(s || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ').trim();
}

// Comandos de formatação
function anoFmt(cmd, val) {
  var el = editorEl();
  if (!el) return;
  el.focus();
  document.execCommand(cmd, false, val || null);
  scheduleAutoSave();
}

function anoFmtBg(color) {
  var el = editorEl();
  if (!el) return;
  el.focus();
  document.execCommand('hiliteColor', false, color);
  scheduleAutoSave();
}

// Inserir link (Ctrl+K) — preserva a seleção que o prompt pode descartar
function anoLink() {
  var el = editorEl();
  if (!el) return;
  el.focus();
  var sel = window.getSelection();
  var savedRange = (sel && sel.rangeCount) ? sel.getRangeAt(0).cloneRange() : null;
  var hadSel = savedRange && !savedRange.collapsed;
  var url = prompt('URL do link:', 'https://');
  if (url === null) return;
  url = url.trim();
  if (!url || url === 'https://') return;
  if (!/^https?:\/\//i.test(url) && !/^mailto:/i.test(url)) url = 'https://' + url;
  el.focus();
  if (savedRange) { sel.removeAllRanges(); sel.addRange(savedRange); }
  if (hadSel) {
    document.execCommand('createLink', false, url);
  } else {
    document.execCommand('insertHTML', false, '<a href="' + esc(url) + '">' + esc(url) + '</a>');
  }
  scheduleAutoSave();
}

// Acha o <ul> que contém a seleção (dentro do editor)
function _closestUl() {
  var node = window.getSelection().anchorNode;
  var n = node ? (node.nodeType === 1 ? node : node.parentNode) : null;
  var el = editorEl();
  while (n && n !== el && n !== document.body) {
    if (n.tagName === 'UL') return n;
    n = n.parentNode;
  }
  return null;
}

// Checklist: texto → checklist; bullet → checklist; checklist → texto
function anoChecklist() {
  var el = editorEl();
  if (!el) return;
  el.focus();
  var ul = _closestUl();
  if (ul && ul.classList.contains('ano-check')) {
    document.execCommand('insertUnorderedList'); // toggle off
  } else if (ul) {
    ul.classList.add('ano-check');               // bullet → checklist
  } else {
    document.execCommand('insertUnorderedList');
    var nl = _closestUl();
    if (nl) nl.classList.add('ano-check');
  }
  scheduleAutoSave();
}

// Clique na caixinha de um item de checklist alterna o estado
function _checklistClick(e) {
  var li = e.target.closest ? e.target.closest('.ano-check > li') : null;
  if (!li) return;
  var rect = li.getBoundingClientRect();
  if (e.clientX - rect.left <= 30) {
    li.classList.toggle('done');
    scheduleAutoSave();
  }
}

// Atalhos de teclado no editor
function _editorKeydown(e) {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
  var k = (e.key || '').toLowerCase();
  if (k === 'b')      { e.preventDefault(); anoFmt('bold'); }
  else if (k === 'i') { e.preventDefault(); anoFmt('italic'); }
  else if (k === 'u') { e.preventDefault(); anoFmt('underline'); }
  else if (k === 'k') { e.preventDefault(); anoLink(); }
}

// ── Utils ─────────────────────────────────────────────────────────────
function esc(s) {
  return String(s || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function relTime(iso) {
  if (!iso) return '';
  var ms  = Date.now() - new Date(iso).getTime();
  var m = 60000, h = 3600000, day = 86400000;
  if (ms < m)    return 'agora';
  if (ms < h)    return Math.floor(ms/m) + 'min';
  if (ms < day)  return Math.floor(ms/h) + 'h';
  var days = Math.floor(ms/day);
  if (days === 1) return 'ontem';
  if (days < 7)   return days + 'd atrás';
  var d = new Date(iso);
  return String(d.getDate()).padStart(2,'0') + '/' +
         String(d.getMonth()+1).padStart(2,'0');
}

function isDesktop() { return window.innerWidth >= 1024; }

// ── Views ─────────────────────────────────────────────────────────────
function showView(v) {
  curView = v;

  if (isDesktop()) {
    // Desktop: todas as colunas visíveis via CSS
    // Apenas gerencia o conteúdo do editor (empty vs preenchido)
    var fab = document.getElementById('fab');
    if (fab) fab.style.display = 'none';
    return;
  }

  // Mobile: alterna visibilidade das views
  ['cadernos','notas','editor'].forEach(function(name) {
    var el = document.getElementById('view-' + name);
    if (el) el.style.display = (name === v) ? '' : 'none';
  });

  // Ao sair do editor no mobile, oculta o form para o próximo openEditor() inicializar limpo
  if (v !== 'editor') {
    var edCont = document.getElementById('d-editor-content');
    if (edCont) edCont.style.display = 'none';
  }

  var fab       = document.getElementById('fab');
  var hdrStatus = document.getElementById('hdr-save-status');
  var hdrBack   = document.getElementById('hdr-back');
  var hdrTitle  = document.getElementById('hdr-title');
  var hdrTrash  = document.getElementById('hdr-trash');

  fab.style.display = (v === 'editor') ? 'none' : '';
  if (hdrStatus) hdrStatus.style.display = (v === 'editor') ? '' : 'none';
  if (hdrTrash)  hdrTrash.style.display  = (v === 'cadernos') ? '' : 'none';

  if (v === 'cadernos') {
    hdrTitle.textContent = 'Anotações';
    hdrBack.onclick = function() { window.location.href = '../'; };
  } else if (v === 'notas') {
    hdrTitle.textContent = curCad ? curCad.nome : 'Notas';
    hdrBack.onclick = function() { showView('cadernos'); };
  } else {
    hdrTitle.textContent = curNota ? 'Editar nota' : 'Nova nota';
    hdrBack.onclick = function() { showView('notas'); };
  }
}

// ── FAB ───────────────────────────────────────────────────────────────
function fabAction() {
  if (curView === 'cadernos') openCadForm(null);
  else if (curView === 'notas') openEditor(null);
}

// ── Load: cadernos ────────────────────────────────────────────────────
async function load() {
  try {
    cadernos = await DB.cadernos.list();
    renderCadernos();
  } catch(e) {
    document.getElementById('cadernos-list').innerHTML =
      '<div class="empty-state"><div class="empty-ico">⚠️</div>' +
      '<div class="empty-title">Erro ao carregar</div>' +
      '<div class="empty-msg">' + esc(e.message) + '</div></div>';
  }
}

// ── Load: notas do caderno atual ──────────────────────────────────────
async function loadNotas() {
  document.getElementById('notas-list').innerHTML =
    '<div class="loader"><div class="spinner"></div><br>Carregando...</div>';
  try {
    notas = await DB.anotacoes.listByCaderno(curCad.id);
    renderNotas();
  } catch(e) {
    document.getElementById('notas-list').innerHTML =
      '<div class="empty-state"><div class="empty-ico">⚠️</div>' +
      '<div class="empty-msg">Erro ao carregar notas</div></div>';
  }
}

// ── Render: cadernos ──────────────────────────────────────────────────
function renderCadernos() {
  var el = document.getElementById('cadernos-list');
  if (!cadernos.length) {
    el.innerHTML =
      '<div class="empty-state">' +
        '<div class="empty-ico">📓</div>' +
        '<div class="empty-title">Nenhum caderno ainda</div>' +
        '<div class="empty-msg">Toque em + para criar seu primeiro caderno de anotações</div>' +
      '</div>';
    return;
  }
  el.innerHTML = cadernos.map(function(c) {
    var isSelected = curCad && curCad.id === c.id;
    return '<div class="cad-card' + (isSelected ? ' selected' : '') + '" data-cad-id="' + esc(c.id) + '" onclick="openCaderno(\'' + c.id + '\')">' +
      '<div class="cad-emoji-wrap" style="background:' + esc(c.cor) + '22">' +
        '<span class="cad-emoji">' + esc(c.emoji) + '</span>' +
      '</div>' +
      '<div class="cad-info">' +
        '<div class="cad-nome">' + esc(c.nome) + '</div>' +
        '<div class="cad-meta">criado ' + relTime(c.createdAt) + '</div>' +
      '</div>' +
      '<button class="cad-more" onclick="openCadMenu(event,\'' + c.id + '\')" aria-label="Opções do caderno">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>' +
      '</button>' +
    '</div>';
  }).join('');
}

// ── Open caderno ──────────────────────────────────────────────────────
async function openCaderno(id) {
  await flushAutoSave();
  curCad    = cadernos.find(function(c) { return c.id === id; });
  tagFilter = null;
  if (!curCad) return;

  // Desktop: marca caderno ativo e reseta editor
  if (isDesktop()) {
    document.querySelectorAll('#view-cadernos .cad-card').forEach(function(el) {
      el.classList.toggle('selected', el.dataset.cadId === id);
    });
    var dTitle = document.getElementById('d-notas-title');
    if (dTitle) dTitle.textContent = curCad.nome;
    // Fecha editor (volta ao empty state)
    showEditorDesktop(false);
  }

  showView('notas');
  loadNotas();
}

// ── Render: notas ─────────────────────────────────────────────────────
function renderNotas() {
  var el = document.getElementById('notas-list');

  // Monta lista de tags únicas
  var allTags = [];
  notas.forEach(function(n) {
    (n.tags || []).forEach(function(t) {
      if (allTags.indexOf(t) < 0) allTags.push(t);
    });
  });

  var filterBar = '';
  if (allTags.length) {
    filterBar = '<div class="tag-filter-bar">' +
      '<button class="tag-pill' + (!tagFilter ? ' active' : '') +
        '" onclick="setTagFilter(null)">Todas</button>' +
      allTags.map(function(t) {
        return '<button class="tag-pill' + (tagFilter === t ? ' active' : '') +
          '" onclick="setTagFilter(\'' + esc(t) + '\')">#' + esc(t) + '</button>';
      }).join('') +
    '</div>';
  }

  var list = tagFilter
    ? notas.filter(function(n) { return n.tags && n.tags.indexOf(tagFilter) >= 0; })
    : notas;

  if (_notaSearch) {
    list = list.filter(function(n) {
      return (n.titulo || '').toLowerCase().includes(_notaSearch) ||
             stripHtml(n.conteudo).toLowerCase().includes(_notaSearch);
    });
  }

  // Atualiza contador desktop
  var dCnt = document.getElementById('d-notas-cnt');
  if (dCnt) dCnt.textContent = list.length;

  if (!list.length) {
    var msg = tagFilter
      ? '<div class="empty-state"><div class="empty-ico">🔍</div>' +
          '<div class="empty-msg">Nenhuma nota com <strong>#' + esc(tagFilter) + '</strong></div></div>'
      : '<div class="empty-state"><div class="empty-ico">✏️</div>' +
          '<div class="empty-title">Caderno vazio</div>' +
          '<div class="empty-msg">Toque em + para criar sua primeira nota</div></div>';
    el.innerHTML = filterBar + msg;
    return;
  }

  el.innerHTML = filterBar + list.map(function(n) {
    var tagsHtml = (n.tags && n.tags.length)
      ? '<div class="nota-tags">' +
          n.tags.map(function(t) { return '<span class="nota-tag">#' + esc(t) + '</span>'; }).join('') +
        '</div>'
      : '';
    var imgBadge = (n.imagens && n.imagens.length)
      ? '<span class="nota-imgs-badge">' +
          '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>' +
          ' ' + n.imagens.length +
        '</span>'
      : '';
    var ptxt = stripHtml(n.conteudo);
    var preview = ptxt ? ptxt.slice(0,90) + (ptxt.length > 90 ? '…' : '') : '';
    var isSelNota = curNota && curNota.id === n.id;
    return '<div class="nota-card' + (isSelNota ? ' selected' : '') + '" onclick="openNotaEditor(\'' + n.id + '\')">' +
      tagsHtml +
      '<div class="nota-titulo">' + esc(n.titulo || 'Sem título') + '</div>' +
      (preview ? '<div class="nota-preview">' + esc(preview) + '</div>' : '') +
      '<div class="nota-footer">' +
        imgBadge +
        '<span class="nota-date">' + relTime(n.updatedAt || n.createdAt) + '</span>' +
      '</div>' +
    '</div>';
  }).join('');
}

function setTagFilter(tag) {
  tagFilter = tag;
  renderNotas();
}

var _notaSearch = '';
function filterNotasSearch(val) {
  _notaSearch = (val || '').trim().toLowerCase();
  renderNotas();
}

// Abre/fecha o editor desktop
function showEditorDesktop(open) {
  var empty   = document.getElementById('d-editor-empty');
  var content = document.getElementById('d-editor-content');
  var delBtn  = document.getElementById('d-btn-del-nota');
  if (!empty || !content) return;
  empty.style.display   = open ? 'none' : '';
  content.style.display = open ? '' : 'none';
  if (delBtn) delBtn.style.display = (open && curNota) ? '' : 'none';
  // Atualiza data
  var dateEl = document.getElementById('d-editor-date');
  if (dateEl && open && curNota) {
    var d = new Date(curNota.updatedAt || curNota.createdAt || Date.now());
    dateEl.textContent = 'Última edição: ' + d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
  } else if (dateEl) {
    dateEl.textContent = '';
  }
}

// ── Editor ────────────────────────────────────────────────────────────
async function openNotaEditor(id) {
  await flushAutoSave();
  curNota = notas.find(function(n) { return n.id === id; });
  if (!curNota) return;
  openEditor(curNota);
}

function openEditor(nota) {
  // Reseta estado de auto-save para a nota nova
  clearTimeout(_autoSaveTimer);
  _autoSaveTimer = null;
  _isDirty       = false;
  setSaveStatus('', '');

  curNota  = nota;
  editTags = nota ? (nota.tags    || []).slice() : [];
  editImgs = nota ? (nota.imagens || []).slice() : [];

  document.getElementById('f-titulo').value = nota ? nota.titulo : '';
  setEditorHtml(nota ? nota.conteudo : '');

  renderEditTags();
  renderEditImgs();

  document.getElementById('btn-del-nota').style.display = nota ? '' : 'none';

  if (isDesktop()) {
    showEditorDesktop(true);
    renderNotas();
    setTimeout(function() {
      var t = document.getElementById('f-titulo');
      if (t) { t.focus(); if (t.value) { var len = t.value.length; t.setSelectionRange(len, len); } }
    }, 60);
    return;
  }

  // Mobile: mostra o conteúdo do editor (estava oculto pelo wrapper desktop)
  var edCont  = document.getElementById('d-editor-content');
  var edEmpty = document.getElementById('d-editor-empty');
  if (edCont)  edCont.style.display  = '';
  if (edEmpty) edEmpty.style.display = 'none';

  showView('editor');
  setTimeout(function() {
    var t = document.getElementById('f-titulo');
    if (t) { t.focus(); if (t.value) { var len = t.value.length; t.setSelectionRange(len, len); } }
  }, 80);
}

// ── Tags no editor ────────────────────────────────────────────────────
function renderEditTags() {
  document.getElementById('edit-tags').innerHTML = editTags.map(function(t, i) {
    return '<span class="edit-tag">#' + esc(t) +
      '<button class="edit-tag-rm" onclick="removeTag(' + i + ')" aria-label="Remover tag">&times;</button>' +
    '</span>';
  }).join('');
}

function removeTag(i) {
  editTags.splice(i, 1);
  renderEditTags();
}

function addTag() {
  var inp = document.getElementById('tag-inp');
  var val = (inp.value || '').trim().toLowerCase()
    .replace(/[#,;\s]+$/, '').replace(/^[#,;\s]+/, '');
  if (!val || editTags.indexOf(val) >= 0) { inp.value = ''; return; }
  editTags.push(val);
  inp.value = '';
  renderEditTags();
}

function tagKeydown(e) {
  if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); }
}

// ── Imagens no editor ─────────────────────────────────────────────────
function renderEditImgs() {
  var el = document.getElementById('edit-imgs');
  if (!editImgs.length) { el.innerHTML = ''; return; }
  el.innerHTML = '<div class="imgs-grid">' +
    editImgs.map(function(img, i) {
      return '<div class="img-thumb">' +
        '<img src="' + esc(img.url) + '" alt="' + esc(img.nome || '') +
          '" onclick="window.open(\'' + esc(img.url) + '\',\'_blank\')">' +
        '<button class="img-rm" onclick="removeImg(' + i + ')" aria-label="Remover imagem">&times;</button>' +
      '</div>';
    }).join('') +
  '</div>';
}

function removeImg(i) {
  editImgs.splice(i, 1);
  renderEditImgs();
}

function pickImage() {
  var inp = document.createElement('input');
  inp.type     = 'file';
  inp.accept   = 'image/*';
  inp.multiple = true;
  inp.onchange = function() {
    Array.from(inp.files || []).forEach(function(f) { uploadImg(f); });
  };
  inp.click();
}

async function uploadImg(file) {
  var btn = document.getElementById('btn-upload');
  btn.disabled    = true;
  btn.textContent = 'Enviando…';
  try {
    var b64    = await fileToBase64(file);
    var notaId = (curNota && curNota.id) ? curNota.id : 'rascunho-' + Date.now();
    var result = await DB.storage.uploadAnotacao(notaId, file, b64.split(',')[1], file.type);
    editImgs.push({ url: result.link, path: result.fileId, nome: result.nome });
    renderEditImgs();
    toast('Imagem adicionada');
  } catch(e) {
    toast('Erro ao enviar imagem', 'err');
    console.error('[uploadImg]', e);
  } finally {
    btn.disabled    = false;
    btn.textContent = '+ Imagem';
  }
}

function fileToBase64(f) {
  return new Promise(function(res, rej) {
    var r = new FileReader();
    r.onload  = function(e) { res(e.target.result); };
    r.onerror = rej;
    r.readAsDataURL(f);
  });
}

// ── Salvar nota (manual) ─────────────────────────────────────────────
async function saveNota() {
  // Cancela auto-save pendente — este já faz o trabalho
  clearTimeout(_autoSaveTimer);
  _autoSaveTimer = null;
  _isDirty = false;

  var titulo   = (document.getElementById('f-titulo').value   || '').trim();
  var conteudo = getEditorHtml();
  if (!titulo) {
    document.getElementById('f-titulo').focus();
    toast('Informe um título para a nota', 'err');
    return;
  }
  var btn = isDesktop() ? document.querySelector('.d-editor-save') : null;
  if (btn) btn.disabled = true;

  var now  = new Date().toISOString();
  var nota = {
    id:        curNota ? curNota.id : String(Date.now()),
    cadernoId: curCad.id,
    titulo:    titulo,
    conteudo:  conteudo,
    tags:      editTags.slice(),
    imagens:   editImgs.slice(),
    createdAt: curNota ? curNota.createdAt : now,
    updatedAt: now,
  };

  var isNew = !curNota;
  if (isNew) {
    notas.unshift(nota);
  } else {
    var idx = notas.findIndex(function(n) { return n.id === nota.id; });
    if (idx >= 0) notas[idx] = nota;
  }

  try {
    await DB.anotacoes.upsert(nota);
    curNota = nota;
    toast(isNew ? 'Nota criada' : 'Nota salva');
    if (isDesktop()) {
      showEditorDesktop(true);
      renderNotas();
    } else {
      showView('notas');
      renderNotas();
    }
  } catch(e) {
    if (isNew) notas.shift();
    toast('Erro ao salvar: ' + e.message, 'err');
    setSaveStatus('saved', 'Salvo ✓');
    setTimeout(function() { setSaveStatus('', ''); }, 2500);
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ── Excluir nota (manda pra lixeira, reversível) ──────────────────────
async function deleteNota() {
  if (!curNota) return;
  var alvo = curNota;
  try {
    await DB.anotacoes.softDelete(alvo.id);
    notas = notas.filter(function(n) { return n.id !== alvo.id; });
    curNota = null;
    if (isDesktop()) {
      showEditorDesktop(false);
      renderNotas();
    } else {
      showView('notas');
      renderNotas();
    }
    toast('Nota movida para a lixeira', null, {
      label: 'Desfazer',
      onClick: function() { undoDelete(alvo); }
    });
  } catch(e) {
    toast('Erro ao excluir', 'err');
  }
}

// Desfazer a última exclusão (restaura da lixeira)
async function undoDelete(nota) {
  try {
    await DB.anotacoes.restore(nota.id);
    if (curCad && nota.cadernoId === curCad.id) {
      notas.unshift(nota);
      notas.sort(function(a, b) {
        return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
      });
      renderNotas();
    }
    toast('Nota restaurada');
  } catch(e) {
    toast('Erro ao restaurar', 'err');
  }
}

// ── Lixeira ───────────────────────────────────────────────────────────
function cadLabel(cadId) {
  var c = cadernos.find(function(x) { return x.id === cadId; });
  return c ? ((c.emoji || '📓') + ' ' + c.nome) : 'Caderno removido';
}

async function openTrash() {
  showPanel('trash');
  var el = document.getElementById('trash-list');
  el.innerHTML = '<div class="loader"><div class="spinner"></div><br>Carregando...</div>';
  try {
    var lixo = await DB.anotacoes.listTrash();
    renderTrash(lixo);
  } catch(e) {
    el.innerHTML = '<div class="empty-state"><div class="empty-ico">⚠️</div>' +
      '<div class="empty-msg">Erro ao carregar a lixeira</div></div>';
  }
}

function renderTrash(lixo) {
  var el  = document.getElementById('trash-list');
  var btn = document.getElementById('trash-empty-btn');
  if (btn) btn.style.display = lixo.length ? '' : 'none';

  if (!lixo.length) {
    el.innerHTML = '<div class="empty-state">' +
      '<div class="empty-ico">🗑️</div>' +
      '<div class="empty-title">Lixeira vazia</div>' +
      '<div class="empty-msg">Notas que você excluir aparecem aqui e podem ser restauradas</div>' +
    '</div>';
    return;
  }

  el.innerHTML = lixo.map(function(n) {
    var ptxt = stripHtml(n.conteudo);
    var preview = ptxt ? ptxt.slice(0, 80) + (ptxt.length > 80 ? '…' : '') : '';
    return '<div class="trash-item">' +
      '<div class="trash-item-main">' +
        '<div class="trash-item-titulo">' + esc(n.titulo || 'Sem título') + '</div>' +
        '<div class="trash-item-meta">' + esc(cadLabel(n.cadernoId)) +
          ' · excluída ' + relTime(n.deletedAt) + '</div>' +
        (preview ? '<div class="trash-item-preview">' + esc(preview) + '</div>' : '') +
      '</div>' +
      '<div class="trash-item-actions">' +
        '<button class="trash-btn trash-restore" onclick="restoreNota(\'' + n.id + '\')">Restaurar</button>' +
        '<button class="trash-btn trash-purge" onclick="purgeNota(\'' + n.id + '\')" aria-label="Excluir definitivamente">' +
          '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>' +
        '</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

async function restoreNota(id) {
  try {
    await DB.anotacoes.restore(id);
    toast('Nota restaurada');
    var lixo = await DB.anotacoes.listTrash();
    renderTrash(lixo);
    if (curCad) loadNotas();   // recarrega a lista do caderno aberto
  } catch(e) {
    toast('Erro ao restaurar', 'err');
  }
}

async function purgeNota(id) {
  if (!confirm('Excluir esta nota definitivamente? Isso não pode ser desfeito.')) return;
  try {
    await DB.anotacoes.delete(id);
    toast('Nota excluída definitivamente');
    var lixo = await DB.anotacoes.listTrash();
    renderTrash(lixo);
  } catch(e) {
    toast('Erro ao excluir', 'err');
  }
}

async function emptyTrash() {
  var lixo;
  try { lixo = await DB.anotacoes.listTrash(); }
  catch(e) { toast('Erro ao carregar a lixeira', 'err'); return; }
  if (!lixo.length) return;
  if (!confirm('Esvaziar a lixeira? ' + lixo.length +
    (lixo.length === 1 ? ' nota será excluída' : ' notas serão excluídas') +
    ' para sempre. Isso não pode ser desfeito.')) return;
  try {
    for (var i = 0; i < lixo.length; i++) {
      await DB.anotacoes.delete(lixo[i].id);
    }
    toast('Lixeira esvaziada');
    renderTrash([]);
  } catch(e) {
    toast('Erro ao esvaziar a lixeira', 'err');
  }
}

// ── Menu do caderno ───────────────────────────────────────────────────
function openCadMenu(e, id) {
  e.stopPropagation();
  cadMenuId = id;
  showPanel('menu');
}

function editCadernoFromMenu() {
  var c = cadernos.find(function(x) { return x.id === cadMenuId; });
  closePanel('menu');
  if (c) openCadForm(c);
}

async function deleteCadernoFromMenu() {
  var c = cadernos.find(function(x) { return x.id === cadMenuId; });
  closePanel('menu');
  if (!c) return;
  if (!confirm('Excluir o caderno "' + c.nome + '" e todas as notas dentro dele?')) return;
  try {
    await DB.cadernos.delete(c.id);
    cadernos = cadernos.filter(function(x) { return x.id !== c.id; });
    toast('Caderno excluído');
    renderCadernos();
  } catch(e) {
    toast('Erro ao excluir: ' + e.message, 'err');
  }
}

// ── Formulário do caderno ─────────────────────────────────────────────
var EMOJIS = ['📓','📔','📒','📗','📘','📙','📕','📝','✏️','🎓','📸','🎨','💄','💅','📷','🎥','✨','💡','💫','🌟'];
var CORES  = ['#a36844','#D4537E','#BA7517','#3B6D11','#1565C0','#7E57C2','#e67e22','#16a085','#555555','#8B6B61'];
var selEmoji = '📓';
var selCor   = '#a36844';

function openCadForm(c) {
  editCadId = c ? c.id : null;
  selEmoji  = c ? (c.emoji || '📓') : '📓';
  selCor    = c ? (c.cor   || '#a36844') : '#a36844';

  document.getElementById('cf-nome').value             = c ? c.nome : '';
  document.getElementById('cf-title').textContent      = c ? 'Editar caderno' : 'Novo caderno';
  document.getElementById('btn-del-cad').style.display = c ? '' : 'none';

  renderEmojiPicker();
  renderCorPicker();
  showPanel('form');
  setTimeout(function() { document.getElementById('cf-nome').focus(); }, 260);
}

function renderEmojiPicker() {
  document.getElementById('emoji-picker').innerHTML = EMOJIS.map(function(e) {
    return '<button class="ep-btn' + (e === selEmoji ? ' on' : '') +
      '" onclick="pickEmoji(\'' + e + '\')">' + e + '</button>';
  }).join('');
}

function pickEmoji(e) {
  selEmoji = e;
  renderEmojiPicker();
}

function renderCorPicker() {
  document.getElementById('cor-picker').innerHTML = CORES.map(function(c) {
    return '<button class="cp-btn' + (c === selCor ? ' on' : '') +
      '" style="background:' + c + '" onclick="pickCor(\'' + c + '\')" aria-label="Cor ' + c + '"></button>';
  }).join('');
}

function pickCor(c) {
  selCor = c;
  renderCorPicker();
}

async function saveCaderno() {
  var nome = (document.getElementById('cf-nome').value || '').trim();
  if (!nome) { document.getElementById('cf-nome').focus(); toast('Informe o nome do caderno', 'err'); return; }

  var btn = document.getElementById('btn-save-cad');
  btn.disabled    = true;
  btn.textContent = 'Salvando…';

  var existing = editCadId ? cadernos.find(function(c) { return c.id === editCadId; }) : null;
  var cad = {
    id:        editCadId || String(Date.now()),
    nome:      nome,
    emoji:     selEmoji,
    cor:       selCor,
    createdAt: existing ? existing.createdAt : new Date().toISOString(),
  };

  var isNew = !editCadId;
  if (isNew) {
    cadernos.unshift(cad);
  } else {
    var idx = cadernos.findIndex(function(c) { return c.id === cad.id; });
    if (idx >= 0) cadernos[idx] = cad;
  }

  renderCadernos();
  closePanel('form');

  try {
    await DB.cadernos.upsert(cad);
    toast(isNew ? 'Caderno criado' : 'Caderno atualizado');
  } catch(e) {
    if (isNew) { cadernos.shift(); renderCadernos(); }
    toast('Erro ao salvar: ' + e.message, 'err');
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Salvar caderno';
  }
}

async function deleteCadernoFromForm() {
  closePanel('form');
  var c = cadernos.find(function(x) { return x.id === editCadId; });
  if (!c) return;
  if (!confirm('Excluir o caderno "' + c.nome + '" e todas as notas dentro dele?')) return;
  try {
    await DB.cadernos.delete(c.id);
    cadernos = cadernos.filter(function(x) { return x.id !== c.id; });
    toast('Caderno excluído');
    renderCadernos();
  } catch(e) {
    toast('Erro ao excluir: ' + e.message, 'err');
  }
}

// ── Panels ────────────────────────────────────────────────────────────
function showPanel(name) {
  document.getElementById(name + '-overlay').style.display = 'block';
  document.getElementById(name + '-panel').classList.add('open');
}

function closePanel(name) {
  document.getElementById(name + '-overlay').style.display = 'none';
  document.getElementById(name + '-panel').classList.remove('open');
}

// ── Init ──────────────────────────────────────────────────────────────
load();
showView('cadernos');

// Listeners do editor rico (o #f-conteudo já existe no DOM, mesmo oculto)
(function initEditor() {
  var el = editorEl();
  if (!el) return;
  el.addEventListener('keydown', _editorKeydown);
  el.addEventListener('click', _checklistClick);
})();
