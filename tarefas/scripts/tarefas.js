var tasks     = [];
var curFilter = 'pendentes';
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

// ── DATE UTILS ────────────────────────────────────────────────
function todayStr() {
  var t = new Date();
  return t.getFullYear() + '-' + String(t.getMonth()+1).padStart(2,'0') + '-' + String(t.getDate()).padStart(2,'0');
}
function addDays(dateStr, n) {
  var d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
function weekEnd() {
  var now = new Date(), day = now.getDay();
  var sun = new Date(now);
  sun.setDate(now.getDate() + (day === 0 ? 0 : 7 - day));
  return sun.getFullYear() + '-' + String(sun.getMonth()+1).padStart(2,'0') + '-' + String(sun.getDate()).padStart(2,'0');
}
function prazoLabel(prazo, hoje) {
  if (!prazo) return null;
  var parts = prazo.split('-');
  var d     = new Date(parseInt(parts[0]), parseInt(parts[1])-1, parseInt(parts[2]));
  var DIAS  = ['dom','seg','ter','qua','qui','sex','sáb'];
  var MESES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  var dia   = String(parseInt(parts[2])).padStart(2,'0');
  if (prazo === hoje)              return { txt: 'Hoje',    cls: 'hoje' };
  if (prazo === addDays(hoje, 1))  return { txt: 'Amanhã',  cls: 'amanha' };
  var label = DIAS[d.getDay()] + ' ' + dia + '/' + MESES[parseInt(parts[1])-1];
  if (prazo < hoje)  return { txt: label, cls: 'atrasada' };
  return { txt: label, cls: 'ok' };
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
  render();
  try {
    await DB.tarefas.upsert(t);
  } catch(e) {
    t.feita = !t.feita;
    render();
    showToast('Erro ao atualizar', true);
  }
}

async function quickAdd() {
  var input = document.getElementById('quick-input');
  var titulo = (input.value || '').trim();
  if (!titulo) return;
  input.value = '';
  var tmp = { id: 'tmp-' + Date.now(), titulo: titulo, prazo: '', prioridade: 'normal', feita: false };
  tasks.unshift(tmp);
  render();
  try {
    var realId = await DB.tarefas.upsert({ id: tmp.id, titulo: titulo, prazo: null, prioridade: 'normal', feita: false });
    await load();
  } catch(e) {
    tasks = tasks.filter(function(t) { return t.id !== tmp.id; });
    render();
    showToast('Erro ao criar tarefa', true);
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

// ── GROUPING ─────────────────────────────────────────────────
function buildGroups(list) {
  var hoje   = todayStr();
  var amanha = addDays(hoje, 1);
  var we     = weekEnd();

  var g = {
    atrasadas: { label: 'Atrasadas', cls: 'atrasadas', tasks: [] },
    hoje:      { label: 'Hoje',      cls: 'hoje',      tasks: [] },
    amanha:    { label: 'Amanhã',    cls: 'amanha',    tasks: [] },
    semana:    { label: 'Esta semana',cls:'semana',     tasks: [] },
    depois:    { label: 'Depois',    cls: 'depois',     tasks: [] },
  };

  list.forEach(function(t) {
    if (!t.prazo)              { g.depois.tasks.push(t);    return; }
    if (t.prazo < hoje)        { g.atrasadas.tasks.push(t); return; }
    if (t.prazo === hoje)      { g.hoje.tasks.push(t);      return; }
    if (t.prazo === amanha)    { g.amanha.tasks.push(t);    return; }
    if (t.prazo <= we)         { g.semana.tasks.push(t);    return; }
    g.depois.tasks.push(t);
  });

  return ['atrasadas','hoje','amanha','semana','depois']
    .map(function(k) { return g[k]; })
    .filter(function(g) { return g.tasks.length > 0; });
}

// ── RENDER ────────────────────────────────────────────────────
function render() {
  var hoje   = todayStr();
  var amanha = addDays(hoje, 1);
  var we     = weekEnd();

  var pend = tasks.filter(function(t) { return !t.feita; });
  var hj   = tasks.filter(function(t) { return !t.feita && t.prazo === hoje; });
  var sem  = tasks.filter(function(t) {
    return !t.feita && t.prazo && t.prazo >= hoje && t.prazo <= we;
  });
  var done = tasks.filter(function(t) { return t.feita; });
  var atrs = tasks.filter(function(t) { return !t.feita && t.prazo && t.prazo < hoje; });

  // Progress
  var total = tasks.length;
  var feitas = done.length;
  var pct = total > 0 ? Math.round((feitas / total) * 100) : 0;
  var progMsg =
    total === 0 ? 'Nenhuma tarefa cadastrada' :
    feitas === total ? 'Tudo concluído!' :
    feitas + ' de ' + total + ' concluída' + (feitas !== 1 ? 's' : '');
  document.getElementById('prog-fill').style.width = pct + '%';
  document.getElementById('prog-lbl').textContent = progMsg;
  document.getElementById('prog-pct').textContent = total > 0 ? pct + '%' : '';

  // Chips
  document.getElementById('c-pend').textContent   = pend.length;
  document.getElementById('c-hoje').textContent   = hj.length;
  document.getElementById('c-semana').textContent = sem.length;
  document.getElementById('c-feitas').textContent = done.length;

  // Alert chip color
  var cp = document.getElementById('c-pend');
  cp.style.color = atrs.length > 0 ? '#C62828' : '';

  // ── Desktop sidebar ──
  var ring = document.getElementById('d-ring');
  if (ring) {
    var circ = 100.5;
    ring.style.strokeDashoffset = circ * (1 - pct / 100);
    document.getElementById('d-ring-pct').textContent  = pct + '%';
    document.getElementById('d-prog-lbl').textContent  = progMsg;
    document.getElementById('d-prog-val').textContent  = total > 0 ? feitas + ' de ' + total : '';
    document.getElementById('d-s-pend').textContent    = pend.length;
    document.getElementById('d-s-hoje').textContent    = hj.length;
    document.getElementById('d-s-atrs').textContent    = atrs.length;
    document.getElementById('d-s-feitas').textContent  = done.length;
    document.getElementById('d-fc-pend').textContent   = pend.length;
    document.getElementById('d-fc-hoje').textContent   = hj.length;
    document.getElementById('d-fc-sem').textContent    = sem.length;
    document.getElementById('d-fc-feitas').textContent = done.length;
    var filterLabels = { pendentes:'Pendentes', hoje:'Hoje', semana:'Esta semana', feitas:'Feitas' };
    var d_title = document.getElementById('d-toolbar-title');
    var d_sub   = document.getElementById('d-toolbar-sub');
    if (d_title) d_title.textContent = filterLabels[curFilter] || 'Tarefas';
    if (d_sub) {
      var filtList =
        curFilter === 'hoje'   ? hj :
        curFilter === 'feitas' ? done :
        curFilter === 'semana' ? pend.filter(function(t){ return !t.prazo || t.prazo <= we || t.prazo < hoje; }) :
        pend;
      d_sub.textContent = filtList.length + ' tarefa' + (filtList.length !== 1 ? 's' : '') +
        (atrs.length > 0 && curFilter === 'pendentes' ? ' · ' + atrs.length + ' atrasada' + (atrs.length !== 1 ? 's' : '') : '');
    }
  }

  var content = document.getElementById('content');

  // Feitas: flat list
  if (curFilter === 'feitas') {
    if (!done.length) {
      content.innerHTML = emptyHtml('Nenhuma tarefa concluída ainda.');
      return;
    }
    content.innerHTML =
      '<div class="grupo-hdr" style="margin-top:8px">' +
        '<span class="grupo-pill feitas">Concluídas</span>' +
        '<span class="grupo-count">' + done.length + '</span>' +
        '<span class="grupo-line"></span>' +
      '</div>' +
      done.map(function(t) { return renderCard(t, hoje); }).join('');
    return;
  }

  // Filtrar lista
  var list =
    curFilter === 'hoje'   ? hj   :
    curFilter === 'semana' ? pend.filter(function(t){ return !t.prazo || t.prazo <= we || t.prazo < hoje; }) :
    pend;

  if (!list.length) {
    content.innerHTML = emptyHtml(
      curFilter === 'hoje'   ? 'Nenhuma tarefa para hoje.' :
      curFilter === 'semana' ? 'Nenhuma tarefa esta semana.' :
      'Nenhuma tarefa pendente.<br>Use o campo acima para criar!'
    );
    return;
  }

  var groups = buildGroups(list);
  content.innerHTML = groups.map(function(g) {
    return '<div class="grupo">' +
      '<div class="grupo-hdr">' +
        '<span class="grupo-pill ' + g.cls + '">' + g.label + '</span>' +
        '<span class="grupo-count">' + g.tasks.length + '</span>' +
        '<span class="grupo-line"></span>' +
      '</div>' +
      g.tasks.map(function(t) { return renderCard(t, hoje); }).join('') +
    '</div>';
  }).join('');
}

function renderCard(t, hoje) {
  var isAlta  = t.prioridade === 'alta';
  var pl      = prazoLabel(t.prazo, hoje);
  var cardCls = 'task-card' + (isAlta ? ' alta' : ' normal') +
                (t.prazo && t.prazo < hoje && !t.feita ? ' atrasada' : '') +
                (t.prazo === hoje && !t.feita ? ' hoje-card' : '') +
                (t.feita ? ' feita' : '');

  var prazoBadge = pl
    ? '<span class="prazo-badge ' + pl.cls + '">' + pl.txt + '</span>'
    : '';
  var prioTag = isAlta && !t.feita
    ? '<span class="prio-tag">Alta</span>'
    : '';

  return '<div class="' + cardCls + '">' +
    '<button class="task-check" onclick="toggleDone(\'' + esc(t.id) + '\')" aria-label="' + (t.feita ? 'Desmarcar' : 'Concluir') + '">' +
      '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">' +
        (t.feita ? '<polyline points="20 6 9 17 4 12"/>' : '') +
      '</svg>' +
    '</button>' +
    '<div class="task-body" onclick="openEdit(\'' + esc(t.id) + '\')">' +
      '<div class="task-titulo' + (t.feita ? ' riscado' : '') + '">' + esc(t.titulo) + '</div>' +
      (prazoBadge || prioTag
        ? '<div class="task-meta">' + prazoBadge + prioTag + '</div>'
        : '') +
    '</div>' +
  '</div>';
}

function emptyHtml(msg) {
  return '<div class="empty">' +
    '<div class="empty-ico"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg></div>' +
    '<p>' + msg + '</p>' +
  '</div>';
}

// ── FILTERS ───────────────────────────────────────────────────
function setF(f) {
  curFilter = f;
  document.querySelectorAll('.ftab').forEach(function(b) {
    b.classList.toggle('on', b.dataset.f === f);
  });
  document.querySelectorAll('.tar-d-fil').forEach(function(b) {
    b.classList.toggle('active', b.dataset.f === f);
  });
  render();
}

function quickAddD() {
  var input = document.getElementById('d-quick-inp');
  var titulo = (input.value || '').trim();
  if (!titulo) return;
  input.value = '';
  var tmp = { id: 'tmp-' + Date.now(), titulo: titulo, prazo: '', prioridade: 'normal', feita: false };
  tasks.unshift(tmp);
  render();
  DB.tarefas.upsert({ id: tmp.id, titulo: titulo, prazo: null, prioridade: 'normal', feita: false })
    .then(function() { load(); })
    .catch(function() {
      tasks = tasks.filter(function(t) { return t.id !== tmp.id; });
      render();
      showToast('Erro ao criar tarefa', true);
    });
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
    t.prioridade === 'alta'
      ? document.getElementById('f-prio-alta')
      : document.getElementById('f-prio-normal'),
    t.prioridade || 'normal'
  );
  document.getElementById('btn-del').style.display = 'block';
  showPanel();
}

function setPrio(btn) {
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
