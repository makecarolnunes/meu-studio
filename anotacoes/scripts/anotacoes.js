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
function toast(msg, type) {
  var el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show' + (type === 'err' ? ' toast-err' : '');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(function() { el.className = 'toast'; }, 2800);
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

// ── Views ─────────────────────────────────────────────────────────────
function showView(v) {
  curView = v;
  ['cadernos','notas','editor'].forEach(function(name) {
    var el = document.getElementById('view-' + name);
    if (el) el.style.display = (name === v) ? '' : 'none';
  });

  var fab     = document.getElementById('fab');
  var hdrSave = document.getElementById('hdr-save');
  var hdrBack = document.getElementById('hdr-back');
  var hdrTitle= document.getElementById('hdr-title');

  fab.style.display     = (v === 'editor') ? 'none' : '';
  hdrSave.style.display = (v === 'editor') ? ''     : 'none';

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
    return '<div class="cad-card" onclick="openCaderno(\'' + c.id + '\')">' +
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
function openCaderno(id) {
  curCad    = cadernos.find(function(c) { return c.id === id; });
  tagFilter = null;
  if (!curCad) return;
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
    var preview = n.conteudo ? n.conteudo.slice(0,90) + (n.conteudo.length > 90 ? '…' : '') : '';
    return '<div class="nota-card" onclick="openNotaEditor(\'' + n.id + '\')">' +
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

// ── Editor ────────────────────────────────────────────────────────────
function openNotaEditor(id) {
  curNota = notas.find(function(n) { return n.id === id; });
  if (!curNota) return;
  openEditor(curNota);
}

function openEditor(nota) {
  curNota  = nota;
  editTags = nota ? (nota.tags    || []).slice() : [];
  editImgs = nota ? (nota.imagens || []).slice() : [];

  document.getElementById('f-titulo').value   = nota ? nota.titulo   : '';
  document.getElementById('f-conteudo').value = nota ? nota.conteudo : '';

  renderEditTags();
  renderEditImgs();

  document.getElementById('btn-del-nota').style.display = nota ? '' : 'none';

  showView('editor');
  setTimeout(function() {
    var t = document.getElementById('f-titulo');
    t.focus();
    // Coloca cursor no fim
    if (t.value) { var len = t.value.length; t.setSelectionRange(len, len); }
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

// ── Salvar nota ───────────────────────────────────────────────────────
async function saveNota() {
  var titulo   = (document.getElementById('f-titulo').value   || '').trim();
  var conteudo = (document.getElementById('f-conteudo').value || '').trim();
  if (!titulo) {
    document.getElementById('f-titulo').focus();
    toast('Informe um título para a nota', 'err');
    return;
  }
  var btn = document.getElementById('hdr-save');
  btn.disabled = true;

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
    showView('notas');
    renderNotas();
  } catch(e) {
    if (isNew) notas.shift();
    toast('Erro ao salvar: ' + e.message, 'err');
  } finally {
    btn.disabled = false;
  }
}

// ── Excluir nota ──────────────────────────────────────────────────────
async function deleteNota() {
  if (!curNota) return;
  if (!confirm('Excluir esta nota permanentemente?')) return;
  try {
    await DB.anotacoes.delete(curNota.id);
    notas = notas.filter(function(n) { return n.id !== curNota.id; });
    curNota = null;
    toast('Nota excluída');
    showView('notas');
    renderNotas();
  } catch(e) {
    toast('Erro ao excluir', 'err');
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
