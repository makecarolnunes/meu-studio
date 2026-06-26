/* ════════════════════════════════════════════════════════════
   Tarefas — Studio Flow
   Estado em memória sincronizado com Supabase (DB.tarefas / DB.projetos)
   ════════════════════════════════════════════════════════════ */

var tasks    = [];
var projetos = [];
var curView  = 'hoje';
var editId   = null;   // tarefa em edição
var editProj = null;   // projeto em edição
var authed   = false;

var FLOW = ['ideia','a_fazer','fazendo','feita'];
var AREAS = {
  conteudo: { label:'Conteúdo', cor:'var(--rose)',  bg:'var(--rose-soft)',  ico:'📹' },
  cursos:   { label:'Cursos',   cor:'var(--brand)', bg:'var(--brand-soft)', ico:'📦' },
  clientes: { label:'Clientes', cor:'var(--amber)', bg:'var(--amber-soft)', ico:'👰' },
  producao: { label:'Studio',   cor:'var(--green)', bg:'var(--green-soft)', ico:'🪴' },
  admin:    { label:'Admin',    cor:'var(--brown)', bg:'var(--brown-soft)', ico:'🗂' },
};
function area(a){ return AREAS[a] || AREAS.admin; }

// arrastar só em ponteiro fino (desktop); no toque usa-se o botão "mover →"
var IS_TOUCH = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

// ── AUTH ──────────────────────────────────────────────────────
function checkAuth() {
  var s = localStorage.getItem('mk_session');
  if (s) {
    try { if (Date.now() < JSON.parse(s).expires) return true; } catch(e) {}
  }
  localStorage.removeItem('mk_session');
  window.location.href = '../';
  return false;
}

// ── UTILS ─────────────────────────────────────────────────────
function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function byId(id){ return tasks.find(function(t){ return t.id === id; }); }
function projById(id){ return projetos.find(function(p){ return p.id === id; }); }
function projName(id){ var p = projById(id); return p ? p.nome : ''; }
function todayStr(){ var t=new Date(); return t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0'); }

var toastTmr;
function showToast(msg, err){
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (err ? ' toast-err' : '');
  clearTimeout(toastTmr);
  toastTmr = setTimeout(function(){ t.className = 'toast'; }, 2400);
}

function prazoLabel(prazo){
  if(!prazo) return null;
  var hoje = todayStr();
  if(prazo < hoje)  return { txt:'atrasada', cls:'chip-urg' };
  if(prazo === hoje) return { txt:'hoje', cls:'chip-urg' };
  var pts = prazo.split('-');
  var MES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  return { txt: String(parseInt(pts[2])).padStart(2,'0')+'/'+MES[parseInt(pts[1])-1], cls:'chip-proj' };
}

// ── DATA ──────────────────────────────────────────────────────
async function load(){
  if(!authed) return;
  document.getElementById('hsub').textContent = 'Sincronizando...';
  try{
    var res = await Promise.all([ DB.projetos.list(), DB.tarefas.list() ]);
    projetos = res[0];
    tasks    = res[1];
    var bl = document.getElementById('boot-loader'); if(bl) bl.style.display = 'none';
    populateProjSelects();
    renderCurrent();
    document.getElementById('hsub').textContent = '';
  }catch(e){
    document.getElementById('hsub').textContent = 'Sem conexão';
    console.error('[tarefas]', e);
  }
}

// ── NAV ───────────────────────────────────────────────────────
var TITLES = { hoje:'Studio Flow', projetos:'Projetos', kanban:'Kanban', ideias:'Ideias', feitas:'Conquistas' };
function go(v){
  curView = v;
  document.querySelectorAll('.view').forEach(function(el){ el.classList.remove('on'); });
  document.getElementById('v-'+v).classList.add('on');
  document.querySelectorAll('.tar-nav button, .d-nav').forEach(function(b){ b.classList.toggle('on', b.dataset.v === v); });
  var sc = document.getElementById('scroll'); if(sc) sc.scrollTop = 0;
  renderCurrent();
}
function renderCurrent(){
  if(curView==='hoje')          renderHoje();
  else if(curView==='projetos') renderProjetos();
  else if(curView==='kanban')   renderKanban();
  else if(curView==='ideias')   renderIdeias();
  else if(curView==='feitas')   renderFeitas();
  refreshBadges();
}
function refreshBadges(){
  var pend = tasks.filter(function(t){ return t.status!=='feita' && t.status!=='ideia'; }).length;
  var ide  = tasks.filter(function(t){ return t.status==='ideia'; }).length;
  var done = tasks.filter(function(t){ return t.status==='feita'; }).length;
  setTxt('d-b-hoje', pend); setTxt('d-b-ideias', ide); setTxt('d-b-feitas', done);
}
function setTxt(id, v){ var e=document.getElementById(id); if(e) e.textContent=v; }

// ── TASK CARD ─────────────────────────────────────────────────
function rank(t){
  if(t.prioridade==='urgente')  return 0;
  if(t.status==='fazendo')      return 1;
  if(t.prioridade==='importante') return 2;
  return 3;
}
function prioChip(t){
  if(t.prioridade==='urgente')    return '<span class="chip chip-urg">🔴 urgente</span>';
  if(t.prioridade==='importante') return '<span class="chip chip-imp">⭐ importante</span>';
  return '';
}
function taskHTML(t){
  var checkCls = t.status==='fazendo' ? 'doing' : (t.status==='feita' ? 'done' : '');
  var ctx  = projName(t.projetoId) || area(t.area).label;
  var meta = '<span class="chip chip-proj">'+esc(ctx)+'</span>';
  if(t.status==='fazendo') meta += '<span class="chip chip-doing">fazendo</span>';
  var pl = prazoLabel(t.prazo);
  if(pl) meta += '<span class="chip '+pl.cls+'">'+pl.txt+'</span>';
  else   meta += prioChip(t);
  return '<div class="task area-'+esc(t.area)+'" id="task-'+esc(t.id)+'">'+
    '<button class="check '+checkCls+'" onclick="complete(\''+esc(t.id)+'\',event)" aria-label="Concluir">'+
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'+
    '</button>'+
    '<div class="task-body" onclick="openTaskEdit(\''+esc(t.id)+'\')"><div class="task-ttl">'+esc(t.titulo)+'</div>'+
    '<div class="task-meta">'+meta+'</div></div>'+
    '<button class="foco-star '+(t.foco?'on':'')+'" onclick="toggleFoco(\''+esc(t.id)+'\',event)" aria-label="Foco">'+(t.foco?'★':'☆')+'</button>'+
  '</div>';
}
function doneHTML(t){
  return '<div class="task area-'+esc(t.area)+' done-row"><button class="check done"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></button>'+
    '<div class="task-body" onclick="openTaskEdit(\''+esc(t.id)+'\')"><div class="task-ttl">'+esc(t.titulo)+'</div>'+
    '<div class="task-meta"><span class="chip chip-proj">'+esc(projName(t.projetoId)||area(t.area).label)+'</span></div></div></div>';
}

// ── HOJE ──────────────────────────────────────────────────────
function renderHoje(){
  var pend = tasks.filter(function(t){ return t.status!=='feita' && t.status!=='ideia'; });
  var foco = pend.filter(function(t){ return t.foco; }).sort(function(a,b){ return rank(a)-rank(b); });
  var rest = pend.filter(function(t){ return !t.foco; }).sort(function(a,b){ return rank(a)-rank(b); });
  var done = tasks.filter(function(t){ return t.status==='feita'; });

  setTxt('foco-cnt', foco.length);
  document.getElementById('foco-list').innerHTML = foco.length
    ? foco.map(taskHTML).join('')
    : '<div class="muted-empty">Toque na ☆ de uma tarefa para escolher seu foco do dia.</div>';

  setTxt('todo-cnt', rest.length);
  document.getElementById('todo-list').innerHTML = rest.length
    ? rest.map(taskHTML).join('')
    : '<div class="muted-empty">Nada pendente fora do foco 🎯</div>';

  setTxt('wins-cnt', done.length);
  document.getElementById('wins-list').innerHTML = done.length
    ? done.slice(0,8).map(doneHTML).join('')
    : '<div class="muted-empty">Conclua uma tarefa e ela aparece aqui ✨</div>';

  // trilho projetos (desktop)
  document.getElementById('rail-proj-list').innerHTML = projetos.length
    ? projetos.map(function(p){
        var s = projStats(p.id), a = area(p.area);
        return '<div class="rail-pj" onclick="openKanban(\''+esc(p.id)+'\')">'+
          '<div class="rail-pj-top"><div class="rail-pj-ico" style="background:'+a.bg+'">'+a.ico+'</div>'+
          '<div class="rail-pj-name">'+esc(p.nome)+'</div><div class="rail-pj-pct">'+s.pct+'%</div></div>'+
          '<div class="bar"><div class="bar-fill" style="width:'+s.pct+'%;background:'+a.cor+'"></div></div></div>';
      }).join('')
    : '<div class="muted-empty">Crie um projeto na aba Projetos.</div>';
}

function toggleFoco(id, ev){
  if(ev) ev.stopPropagation();
  var t = byId(id); if(!t) return;
  t.foco = !t.foco;
  renderCurrent();
  showToast(t.foco ? 'No foco de hoje 🎯' : 'Tirada do foco');
  DB.tarefas.upsert(t).catch(function(){ t.foco=!t.foco; renderCurrent(); showToast('Erro ao salvar', true); });
}

var PHRASES = ['Mais uma 🤎','Isso! 🎉','Studio andando ✨','Boa, Carol! 👏','Progresso real 🔥'];
function complete(id, ev){
  if(ev) ev.stopPropagation();
  var t = byId(id); if(!t || t.status==='feita') return;
  var prev = { status:t.status, foco:t.foco };
  t.status='feita'; t.foco=false; t.feita=true;
  showToast(PHRASES[Math.floor(Math.random()*PHRASES.length)]);
  var el = document.getElementById('task-'+id);
  if(el){
    var c = el.querySelector('.check'); if(c) c.classList.add('done');
    el.classList.add('leaving');
    setTimeout(renderCurrent, 340);
  } else { renderCurrent(); }
  DB.tarefas.upsert(t).catch(function(){
    t.status=prev.status; t.foco=prev.foco; t.feita=(prev.status==='feita');
    renderCurrent(); showToast('Erro ao salvar', true);
  });
}

// ── CAPTURA RÁPIDA ────────────────────────────────────────────
function parseCapture(raw){
  var ar='', prio='normal', projId='';
  var m = raw.match(/#([\wÀ-ÿ]+)/);
  if(m){
    var a = m[1].toLowerCase();
    var p = projetos.find(function(x){ return x.nome.toLowerCase().indexOf(a) >= 0; });
    if(p){ projId = p.id; ar = p.area; }
    else {
      var map = { conteudo:'conteudo', conte:'conteudo', reel:'conteudo', reels:'conteudo', post:'conteudo',
                  curso:'cursos', cursos:'cursos', cachos:'cursos', cacho:'cursos', aula:'cursos',
                  noiva:'clientes', noivas:'clientes', cliente:'clientes', clientes:'clientes',
                  studio:'producao', estudio:'producao', producao:'producao',
                  admin:'admin', fiscal:'admin', mei:'admin' };
      ar = map[a] || '';
    }
  }
  if(/!urg/i.test(raw)) prio='urgente'; else if(/!imp/i.test(raw)) prio='importante';
  var titulo = raw.replace(/#[\wÀ-ÿ]+/g,'').replace(/![a-zA-ZÀ-ÿ]+/g,'').trim();
  return { titulo:titulo, area:ar||'admin', prioridade:prio, projetoId:projId };
}
function capture(inp){
  var raw = (inp.value||'').trim(); if(!raw) return;
  var p = parseCapture(raw); if(!p.titulo) return;
  inp.value = '';
  var t = { id:String(Date.now()), titulo:p.titulo, prazo:'', prioridade:p.prioridade,
            area:p.area, projetoId:p.projetoId, status:'a_fazer', foco:false, feita:false };
  tasks.unshift(t); renderHoje(); refreshBadges();
  showToast('Adicionada em A fazer');
  DB.tarefas.upsert(t).then(load).catch(function(){
    tasks = tasks.filter(function(x){ return x.id!==t.id; });
    renderHoje(); refreshBadges(); showToast('Erro ao criar', true);
  });
}

// ── PROJETOS ──────────────────────────────────────────────────
function projStats(pid){
  var ts = tasks.filter(function(t){ return t.projetoId===pid && t.status!=='ideia'; });
  var feitas = ts.filter(function(t){ return t.status==='feita'; }).length;
  var total = ts.length;
  var pct = total ? Math.round(feitas/total*100) : 0;
  var next = ts.filter(function(t){ return t.status!=='feita'; }).sort(function(a,b){ return rank(a)-rank(b); })[0];
  return { feitas:feitas, total:total, pct:pct, next: next ? next.titulo : '—' };
}
function renderProjetos(){
  var el = document.getElementById('proj-list');
  if(!projetos.length){ el.innerHTML = '<div class="empty"><div class="empty-ico">📋</div><p>Nenhum projeto ainda.<br>Crie um para agrupar suas tarefas!</p></div>'; return; }
  el.innerHTML = projetos.map(function(p){
    var s = projStats(p.id), a = area(p.area);
    var goal = p.metaData ? '🎯 '+formatGoal(p.metaData) : a.label;
    return '<div class="proj" onclick="openKanban(\''+esc(p.id)+'\')">'+
      '<div class="proj-top">'+
        '<div class="proj-ico" style="background:'+a.bg+'">'+a.ico+'</div>'+
        '<div class="proj-ttl">'+esc(p.nome)+'</div>'+
        '<span class="proj-goal">'+goal+'</span>'+
        '<button class="proj-edit" onclick="event.stopPropagation();openProjEdit(\''+esc(p.id)+'\')" aria-label="Editar">✎</button>'+
      '</div>'+
      '<div class="bar"><div class="bar-fill" style="width:'+s.pct+'%;background:'+a.cor+'"></div></div>'+
      '<div class="proj-foot"><span>'+s.feitas+'/'+s.total+' · '+s.pct+'%</span>'+
      '<span>próxima: <span class="proj-next">'+esc(s.next)+'</span></span></div>'+
    '</div>';
  }).join('');
}
function formatGoal(d){
  var pts = String(d).split('-');
  var MES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  return String(parseInt(pts[2])).padStart(2,'0')+'/'+MES[parseInt(pts[1])-1];
}

// ── KANBAN ────────────────────────────────────────────────────
var KB_COLS = [
  { key:'ideia',   nome:'Ideias',   cor:'var(--brown)' },
  { key:'a_fazer', nome:'A fazer',  cor:'var(--amber)' },
  { key:'fazendo', nome:'Fazendo',  cor:'var(--brand)', wip:2 },
  { key:'feita',   nome:'Concluído',cor:'var(--green)' },
];
function openKanban(pid){ go('kanban'); var sel=document.getElementById('kb-select'); if(sel){ sel.value=pid; } renderKanban(); }
function renderKanban(){
  var board = document.getElementById('kb-board');
  var sel = document.getElementById('kb-select');
  var pid = sel ? sel.value : '';
  if(!projetos.length || !pid){ board.innerHTML = '<div class="empty"><div class="empty-ico">⬚</div><p>Crie um projeto para usar o fluxo Kanban.</p></div>'; return; }
  var projTasks = tasks.filter(function(t){ return t.projetoId===pid; });
  board.innerHTML = KB_COLS.map(function(col){
    var items = projTasks.filter(function(t){ return t.status===col.key; });
    var wip = col.wip ? '<span class="kb-wip">'+items.length+'/'+col.wip+'</span>' : '<span class="kb-wip">'+items.length+'</span>';
    var cards = items.map(function(t){
      var i = FLOW.indexOf(t.status);
      var btn = i < FLOW.length-1
        ? '<button class="kb-move" onclick="kbMove(\''+esc(t.id)+'\')">mover →</button>'
        : '<span style="color:var(--green);font-weight:800;">✓</span>';
      var drag = IS_TOUCH ? '' : ' draggable="true" ondragstart="kbDragStart(event,\''+esc(t.id)+'\')" ondragend="kbDragEnd(event)"';
      return '<div class="kb-card"'+drag+'>'+
        '<div class="kb-body" onclick="openTaskEdit(\''+esc(t.id)+'\')"><div class="kb-t">'+esc(t.titulo)+'</div></div>'+btn+'</div>';
    }).join('') || '<div class="muted-empty" style="padding:6px 2px;">arraste um cartão aqui</div>';
    return '<div class="kb-col" data-col="'+col.key+'" ondragover="kbDragOver(event)" ondragleave="kbDragLeave(event)" ondrop="kbDrop(event,\''+col.key+'\')">'+
      '<div class="kb-col-hdr"><span class="kb-dot" style="background:'+col.cor+'"></span>'+
      '<span class="kb-name">'+col.nome+'</span>'+wip+'</div>'+cards+'</div>';
  }).join('');
}
function kbSetStatus(id, status){
  var t = byId(id); if(!t || t.status===status) return;
  var prev = { status:t.status, foco:t.foco, feita:t.feita };
  t.status = status;
  if(status==='feita'){ t.foco=false; t.feita=true; showToast('Concluída! 🎉'); }
  else { t.feita=false; showToast(status==='fazendo' ? 'Em andamento' : (status==='ideia' ? 'Voltou pra ideias' : 'Movida')); }
  renderKanban(); refreshBadges();
  DB.tarefas.upsert(t).catch(function(){ t.status=prev.status; t.foco=prev.foco; t.feita=prev.feita; renderKanban(); refreshBadges(); showToast('Erro ao salvar', true); });
}
function kbMove(id){
  var t = byId(id); if(!t) return;
  var i = FLOW.indexOf(t.status);
  if(i < FLOW.length-1) kbSetStatus(id, FLOW[i+1]);
}

// ── Drag & drop (desktop; botão "mover →" cobre o toque) ──
var _kbDragId = null;
function kbDragStart(e, id){
  _kbDragId = id;
  e.dataTransfer.effectAllowed = 'move';
  try{ e.dataTransfer.setData('text/plain', id); }catch(_){}
  var el = e.target.closest('.kb-card'); if(el) setTimeout(function(){ el.classList.add('dragging'); }, 0);
}
function kbDragEnd(e){
  var el = e.target.closest('.kb-card'); if(el) el.classList.remove('dragging');
  document.querySelectorAll('.kb-col.drag-over').forEach(function(c){ c.classList.remove('drag-over'); });
  _kbDragId = null;
}
function kbDragOver(e){
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.classList.add('drag-over');
}
function kbDragLeave(e){
  var col = e.currentTarget;
  if(!col.contains(e.relatedTarget)) col.classList.remove('drag-over');
}
function kbDrop(e, colKey){
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  var id = _kbDragId || (e.dataTransfer && e.dataTransfer.getData('text/plain'));
  if(id) kbSetStatus(id, colKey);
}

// ── IDEIAS ────────────────────────────────────────────────────
function renderIdeias(){
  var ideias = tasks.filter(function(t){ return t.status==='ideia'; });
  var el = document.getElementById('idea-list');
  el.innerHTML = ideias.length
    ? ideias.map(function(t){
        return '<div class="idea"><span class="bulb">💡</span><div class="idea-t" onclick="openTaskEdit(\''+esc(t.id)+'\')">'+esc(t.titulo)+'</div>'+
          '<button class="idea-promote" onclick="promote(\''+esc(t.id)+'\')">→ tarefa</button></div>';
      }).join('')
    : '<div class="empty"><div class="empty-ico">💭</div><p>Sem ideias por enquanto.<br>Solte a próxima aqui!</p></div>';
}
function addIdea(inp){
  var v = (inp.value||'').trim(); if(!v) return;
  inp.value = '';
  var t = { id:String(Date.now()), titulo:v, prazo:'', prioridade:'normal', area:'admin', projetoId:'', status:'ideia', foco:false, feita:false };
  tasks.unshift(t); renderIdeias(); refreshBadges();
  showToast('Ideia guardada 💡');
  DB.tarefas.upsert(t).catch(function(){ tasks = tasks.filter(function(x){ return x.id!==t.id; }); renderIdeias(); refreshBadges(); showToast('Erro ao criar', true); });
}
function promote(id){
  var t = byId(id); if(!t) return;
  var prev = { status:t.status, foco:t.foco };
  t.status = 'a_fazer'; t.foco = true;
  renderIdeias(); refreshBadges();
  showToast('Virou tarefa no foco ✨');
  DB.tarefas.upsert(t).catch(function(){ t.status=prev.status; t.foco=prev.foco; renderIdeias(); refreshBadges(); showToast('Erro ao salvar', true); });
  setTimeout(function(){ go('hoje'); }, 450);
}

// ── FEITAS ────────────────────────────────────────────────────
function renderFeitas(){
  var done = tasks.filter(function(t){ return t.status==='feita'; });
  var el = document.getElementById('v-feitas');
  // garante card de destaque
  var streak = document.getElementById('feitas-streak');
  if(!streak){
    streak = document.createElement('div');
    streak.id = 'feitas-streak'; streak.className = 'streak';
    el.querySelector('.view-ttl').insertAdjacentElement('afterend', streak);
  }
  streak.innerHTML = '<div class="streak-num">'+done.length+'</div>'+
    '<div class="streak-lbl">tarefas concluídas</div>'+
    '<div class="streak-sub">cada uma é o Studio andando 🤎</div>';
  setTxt('done-cnt', done.length);
  document.getElementById('done-list').innerHTML = done.length
    ? done.map(doneHTML).join('')
    : '<div class="empty"><div class="empty-ico">🌱</div><p>Nada concluído ainda.<br>Comece pelo seu foco!</p></div>';
}

// ── PAINEL TAREFA ─────────────────────────────────────────────
function populateProjSelects(){
  var opts = '<option value="">Sem projeto</option>' + projetos.map(function(p){ return '<option value="'+esc(p.id)+'">'+esc(p.nome)+'</option>'; }).join('');
  var fp = document.getElementById('f-proj'); if(fp) fp.innerHTML = opts;
  var kb = document.getElementById('kb-select');
  if(kb){
    var cur = kb.value;
    kb.innerHTML = projetos.map(function(p){ return '<option value="'+esc(p.id)+'">'+esc(p.nome)+'</option>'; }).join('');
    if(cur && projById(cur)) kb.value = cur;
  }
}
function setPrio(btn){
  document.querySelectorAll('#task-panel .prio-btn').forEach(function(b){ b.classList.remove('on'); });
  btn.classList.add('on');
}
function getPrio(){ var on = document.querySelector('#task-panel .prio-btn.on'); return on ? on.dataset.prio : 'normal'; }

function openTaskAdd(){
  editId = null;
  document.getElementById('tp-title').textContent = 'Nova tarefa';
  document.getElementById('f-titulo').value = '';
  document.getElementById('f-area').value = 'conteudo';
  document.getElementById('f-proj').value = '';
  document.getElementById('f-prazo').value = '';
  setPrio(document.getElementById('f-prio-normal'));
  document.getElementById('tp-del').style.display = 'none';
  showPanel('task-panel', 'f-titulo');
}
function openTaskEdit(id){
  var t = byId(id); if(!t) return;
  editId = id;
  document.getElementById('tp-title').textContent = 'Editar tarefa';
  document.getElementById('f-titulo').value = t.titulo;
  document.getElementById('f-area').value = t.area || 'admin';
  document.getElementById('f-proj').value = t.projetoId || '';
  document.getElementById('f-prazo').value = t.prazo || '';
  var pid = 'f-prio-' + (t.prioridade==='urgente'||t.prioridade==='importante' ? t.prioridade : 'normal');
  setPrio(document.getElementById(pid));
  document.getElementById('tp-del').style.display = 'block';
  showPanel('task-panel', 'f-titulo');
}
async function saveTask(){
  var titulo = (document.getElementById('f-titulo').value||'').trim();
  if(!titulo){ showToast('Título obrigatório', true); return; }
  var btn = document.getElementById('tp-save'); btn.disabled = true;
  var existing = editId ? byId(editId) : null;
  var t = {
    id: editId || String(Date.now()),
    titulo: titulo,
    area: document.getElementById('f-area').value,
    projetoId: document.getElementById('f-proj').value,
    prazo: document.getElementById('f-prazo').value || null,
    prioridade: getPrio(),
    status: existing ? existing.status : 'a_fazer',
    foco: existing ? existing.foco : false,
    feita: existing ? existing.feita : false,
  };
  try{
    await DB.tarefas.upsert(t);
    closePanels();
    showToast(editId ? 'Atualizada' : 'Tarefa criada');
    await load();
  }catch(e){ showToast('Erro ao salvar', true); }
  finally{ btn.disabled = false; }
}
async function deleteTask(){
  if(!editId) return;
  if(!confirm('Excluir esta tarefa?')) return;
  try{ await DB.tarefas.delete(editId); closePanels(); showToast('Removida'); await load(); }
  catch(e){ showToast('Erro ao excluir', true); }
}

// ── PAINEL PROJETO ────────────────────────────────────────────
function openProjAdd(){
  editProj = null;
  document.getElementById('pp-title').textContent = 'Novo projeto';
  document.getElementById('p-nome').value = '';
  document.getElementById('p-area').value = 'cursos';
  document.getElementById('p-meta').value = '';
  document.getElementById('pp-del').style.display = 'none';
  showPanel('proj-panel', 'p-nome');
}
function openProjEdit(id){
  var p = projById(id); if(!p) return;
  editProj = id;
  document.getElementById('pp-title').textContent = 'Editar projeto';
  document.getElementById('p-nome').value = p.nome;
  document.getElementById('p-area').value = p.area || 'cursos';
  document.getElementById('p-meta').value = p.metaData || '';
  document.getElementById('pp-del').style.display = 'block';
  showPanel('proj-panel', 'p-nome');
}
async function saveProj(){
  var nome = (document.getElementById('p-nome').value||'').trim();
  if(!nome){ showToast('Nome obrigatório', true); return; }
  var btn = document.getElementById('pp-save'); btn.disabled = true;
  var p = {
    id: editProj || ('proj-'+Date.now()),
    nome: nome,
    area: document.getElementById('p-area').value,
    metaData: document.getElementById('p-meta').value || null,
  };
  try{
    await DB.projetos.upsert(p);
    closePanels();
    showToast(editProj ? 'Atualizado' : 'Projeto criado');
    await load();
    go('projetos');
  }catch(e){ showToast('Erro ao salvar', true); }
  finally{ btn.disabled = false; }
}
async function deleteProj(){
  if(!editProj) return;
  if(!confirm('Excluir este projeto? As tarefas dele continuam, mas ficam sem projeto.')) return;
  try{
    await DB.projetos.delete(editProj);
    // desvincula tarefas localmente + persiste
    var orf = tasks.filter(function(t){ return t.projetoId===editProj; });
    for(var i=0;i<orf.length;i++){ orf[i].projetoId=''; DB.tarefas.upsert(orf[i]); }
    closePanels(); showToast('Projeto removido'); await load(); go('projetos');
  }catch(e){ showToast('Erro ao excluir', true); }
}

// ── PANELS ────────────────────────────────────────────────────
function showPanel(id, focusId){
  document.getElementById('overlay').style.display = 'block';
  document.getElementById(id).classList.add('open');
  if(focusId) setTimeout(function(){ var f=document.getElementById(focusId); if(f) f.focus(); }, 300);
}
function closePanels(){
  document.getElementById('overlay').style.display = 'none';
  document.getElementById('task-panel').classList.remove('open');
  document.getElementById('proj-panel').classList.remove('open');
}

// ── INIT ──────────────────────────────────────────────────────
if(checkAuth()){ authed = true; load(); }
