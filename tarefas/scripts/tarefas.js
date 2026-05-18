var tasks    = [];
var curFilter = 'pendentes';
var editId   = null;

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
function todayStr() {
  var t = new Date();
  return t.getFullYear() + '-' + String(t.getMonth()+1).padStart(2,'0') + '-' + String(t.getDate()).padStart(2,'0');
}
function weekRange() {
  var now = new Date(), day = now.getDay();
  var mon = new Date(now); mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  var sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  function fmt(d) { return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }
  return { start: fmt(mon), end: fmt(sun) };
}
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
    tasks = await DB.tarefas.list();
    render();
    document.getElementById('hsub').textContent = '';
  } catch(e) {
    document.getElementById('hsub').textContent = 'Sem conexão';
    console.error('[tarefas]', e);
  }
}

async function toggleDone(id) {
  var t = tasks.find(function(t) { return t.id === id; });
  if (!t) return;
  t.feita = !t.feita;
  render(); // otimista
  try {
    await DB.tarefas.upsert(t);
  } catch(e) {
    t.feita = !t.feita; // rollback
    render();
    showToast('Erro ao atualizar', true);
  }
}

async function saveTask() {
  var titulo = (document.getElementById('f-titulo').value || '').trim();
  if (!titulo) { showToast('Título obrigatório', true); return; }
  var btn = document.getElementById('btn-save');
  btn.disabled = true;
  var existing = editId ? tasks.find(function(t) { return t.id === editId; }) : null;
  try {
    await DB.tarefas.upsert({
      id:        editId || String(Date.now()),
      titulo:    titulo,
      prazo:     document.getElementById('f-prazo').value || null,
      prioridade: getSelectedPrio(),
      feita:     existing ? existing.feita : false,
    });
    closePanel();
    showToast(editId ? 'Atualizado' : 'Tarefa criada');
    await load();
  } catch(e) {
    showToast('Erro ao salvar', true);
  } finally {
    btn.disabled = false;
  }
}

async function deleteTask() {
  if (!editId) return;
  if (!confirm('Excluir esta tarefa?')) return;
  try {
    await DB.tarefas.delete(editId);
    closePanel();
    showToast('Removida');
    await load();
  } catch(e) {
    showToast('Erro ao excluir', true);
  }
}

// ── RENDER ────────────────────────────────────────────────────
function render() {
  var hoje = todayStr();
  var wr   = weekRange();
  var pend = tasks.filter(function(t) { return !t.feita; });
  var hj   = tasks.filter(function(t) { return !t.feita && t.prazo === hoje; });
  var sem  = tasks.filter(function(t) { return !t.feita && t.prazo && t.prazo >= wr.start && t.prazo <= wr.end; });
  var done = tasks.filter(function(t) { return t.feita; });

  document.getElementById('c-pend').textContent   = pend.length;
  document.getElementById('c-hoje').textContent   = hj.length;
  document.getElementById('c-semana').textContent = sem.length;
  document.getElementById('c-feitas').textContent = done.length;

  var list =
    curFilter === 'hoje'    ? hj   :
    curFilter === 'semana'  ? sem  :
    curFilter === 'feitas'  ? done : pend;

  var content = document.getElementById('content');
  if (!list.length) {
    content.innerHTML =
      '<div class="empty">' +
        '<div class="empty-ico"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg></div>' +
        '<p>Nenhuma tarefa aqui.<br>Toque <strong>+</strong> para adicionar.</p>' +
      '</div>';
    return;
  }

  var DIAS_PT = ['dom','seg','ter','qua','qui','sex','sáb'];

  content.innerHTML = list.map(function(t) {
    var isAlta    = t.prioridade === 'alta';
    var prazoHtml = '';
    if (t.prazo) {
      var parts = t.prazo.split('-');
      var d     = new Date(parseInt(parts[0]), parseInt(parts[1])-1, parseInt(parts[2]));
      var label = String(parseInt(parts[2])).padStart(2,'0') + '/' + parts[1] + ' ' + DIAS_PT[d.getDay()];
      var cls   = t.prazo < hoje && !t.feita ? ' prazo-atrasada' : t.prazo === hoje && !t.feita ? ' prazo-hoje' : '';
      prazoHtml = '<div class="task-prazo' + cls + '">' + label + '</div>';
    }
    return '<div class="task-item' + (t.feita ? ' done' : '') + '">' +
      '<button class="task-check" onclick="toggleDone(\'' + esc(t.id) + '\')" aria-label="' + (t.feita ? 'Desmarcar' : 'Concluir') + '">' +
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">' +
          (t.feita ? '<polyline points="20 6 9 17 4 12"/>' : '') +
        '</svg>' +
      '</button>' +
      (isAlta && !t.feita ? '<div class="task-prio"></div>' : '') +
      '<div class="task-info" onclick="openEdit(\'' + esc(t.id) + '\')">' +
        '<div class="task-titulo' + (t.feita ? ' done-txt' : '') + '">' + esc(t.titulo) + '</div>' +
        prazoHtml +
      '</div>' +
    '</div>';
  }).join('');
}

// ── FILTERS ───────────────────────────────────────────────────
function setF(f) {
  curFilter = f;
  document.querySelectorAll('.ftab').forEach(function(b) {
    b.classList.toggle('on', b.dataset.f === f);
  });
  render();
}

// ── PANEL ─────────────────────────────────────────────────────
function openAdd() {
  editId = null;
  document.getElementById('p-title').textContent = 'Nova Tarefa';
  document.getElementById('f-titulo').value = '';
  document.getElementById('f-prazo').value  = '';
  setPrio(document.getElementById('f-prio-normal'), 'normal');
  document.getElementById('btn-del').style.display = 'none';
  showPanel();
}

function openEdit(id) {
  var t = tasks.find(function(t) { return t.id === id; });
  if (!t) return;
  editId = id;
  document.getElementById('p-title').textContent = 'Editar Tarefa';
  document.getElementById('f-titulo').value = t.titulo;
  document.getElementById('f-prazo').value  = t.prazo || '';
  setPrio(
    t.prioridade === 'alta' ? document.getElementById('f-prio-alta') : document.getElementById('f-prio-normal'),
    t.prioridade || 'normal'
  );
  document.getElementById('btn-del').style.display = 'block';
  showPanel();
}

function setPrio(btn, val) {
  document.querySelectorAll('.prio-btn').forEach(function(b) { b.classList.remove('on'); });
  btn.classList.add('on');
}
function getSelectedPrio() {
  var on = document.querySelector('.prio-btn.on');
  return on ? on.dataset.prio : 'normal';
}

function showPanel() {
  document.getElementById('overlay').style.display = 'block';
  document.getElementById('panel').classList.add('open');
  setTimeout(function() { document.getElementById('f-titulo').focus(); }, 300);
}
function closePanel() {
  document.getElementById('overlay').style.display = 'none';
  document.getElementById('panel').classList.remove('open');
}

// ── INIT ──────────────────────────────────────────────────────
if (checkAuth()) { load(); }
