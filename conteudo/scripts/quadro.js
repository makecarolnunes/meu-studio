/* ============================================================
   QUADRO — Kanban de conteúdos (visão padrão do módulo)
   Inspirado no Trello: colunas = etapas do funil (ST_ORDER), cards
   mínimos, arrastar entre colunas, adicionar direto na coluna e
   edição rápida num painel lateral.

   Reaproveita estado e persistência de conteudo.js (carregado antes):
   ideas, curPlats, ST_ORDER, persistIdea, saveIdeas, openModal, uid,
   safe, showToast, syncCfg, _parseArr, ideaInCurPlat, fmtsOf, platsOf.
   Nenhuma tabela nova: a ordem dos cards vai para `configuracoes`
   (chave conteudo_board_order) + cache local.
   ============================================================ */

var CQ_COLS = [
  { v:'Nao Iniciado',     lbl:'Ideias'    },
  { v:'Fila de Gravacao', lbl:'Gravar'    },
  { v:'Editando',         lbl:'Editando'  },
  { v:'Pronto',           lbl:'Pronto'    },
  { v:'Publicado',        lbl:'Publicado' },
];
var CQ_FMTS       = ['Reels','Carrossel','Stories','Feed'];
var CQ_ORDER_KEY  = 'mk_content_board_order';
var CQ_PUB_LIMIT  = 8;          // Publicado mostra só os mais recentes
var CQ_MESES      = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

var cqOrder      = [];          // ids na ordem do quadro (todas as colunas)
var cqShowAllPub = false;
var cqAddingCol  = null;        // coluna com o campo "adicionar" aberto
var cqEditId     = null;        // card aberto no painel de edição rápida
var cqDrag       = null;        // estado do arrastar

/* ── Ordem (local + nuvem) ─────────────────────────────────── */
function cqReadOrder(){ try{ cqOrder = JSON.parse(localStorage.getItem(CQ_ORDER_KEY)||'[]') || []; }catch(e){ cqOrder=[]; } }
var _cqOrderTimer = null;
function cqSaveOrder(){
  var vivos = {}; ideas.forEach(function(i){ vivos[i.id]=1; });
  cqOrder = cqOrder.filter(function(id){ return vivos[id]; });
  try{ localStorage.setItem(CQ_ORDER_KEY, JSON.stringify(cqOrder)); }catch(e){}
  clearTimeout(_cqOrderTimer);
  _cqOrderTimer = setTimeout(function(){ syncCfg('conteudo_board_order', cqOrder); }, 800);
}
function cqLoadOrderCloud(){
  if(typeof DB==='undefined' || !DB.config || window._SB_ERROR) return;
  DB.config.get('conteudo_board_order').then(function(v){
    var arr = v ? _parseArr(v) : null;
    if(!arr) return;
    cqOrder = arr;
    try{ localStorage.setItem(CQ_ORDER_KEY, JSON.stringify(cqOrder)); }catch(e){}
    if(curView==='quadro') renderQuadro();
  }).catch(function(){});
}

/* ── Dados ─────────────────────────────────────────────────── */
function cqColOf(idea){ return ST_ORDER.indexOf(idea.status)!==-1 ? idea.status : 'Nao Iniciado'; }

function cqColIdeas(colV){
  var pos = {}; cqOrder.forEach(function(id,ix){ pos[id]=ix; });
  var list = ideas.filter(function(i){ return ideaInCurPlat(i) && cqColOf(i)===colV; });
  // Sem posição salva (ex.: criados pelo editor completo) aparecem no topo,
  // pela data; os já organizados seguem a ordem que a Carol arrastou.
  var semPos = list.filter(function(i){ return pos[i.id]===undefined; });
  var comPos = list.filter(function(i){ return pos[i.id]!==undefined; });
  semPos.sort(function(a,b){
    if(colV==='Publicado') return (b.scheduledDate||b.createdAt||'') < (a.scheduledDate||a.createdAt||'') ? -1 : 1;
    if(a.scheduledDate && b.scheduledDate) return a.scheduledDate < b.scheduledDate ? -1 : 1;
    if(a.scheduledDate) return -1;
    if(b.scheduledDate) return 1;
    return (b.createdAt||'') < (a.createdAt||'') ? -1 : 1;
  });
  comPos.sort(function(a,b){ return pos[a.id]-pos[b.id]; });
  return semPos.concat(comPos);
}

function cqFmtDate(iso){
  if(!iso) return '';
  var p = iso.split('-'); return parseInt(p[2],10)+' '+CQ_MESES[parseInt(p[1],10)-1];
}

/* ── Render ────────────────────────────────────────────────── */
function cqCardHTML(i){
  var meta = [];
  var fm = fmtsOf(i); if(fm.length) meta.push('<span>'+safe(fm.join(' · '))+'</span>');
  if(i.scheduledDate){
    var late = i.status!=='Publicado' && i.scheduledDate < todayISO();
    meta.push('<span class="cq-date'+(late?' is-late':'')+'" title="'+(late?'Publicação atrasada':'Publicação')+'">'+cqFmtDate(i.scheduledDate)+'</span>');
  }
  if(i.roteiro) meta.push('<span class="cq-has" title="Tem roteiro">roteiro</span>');
  return '<div class="cq-card" data-id="'+safe(i.id)+'" tabindex="0">'+
    '<div class="cq-card-t">'+safe(i.title||'(sem título)')+'</div>'+
    (meta.length ? '<div class="cq-card-m">'+meta.join('')+'</div>' : '')+
  '</div>';
}

function cqColHTML(col){
  var list = cqColIdeas(col.v), total = list.length;
  var isPub = col.v==='Publicado';
  var shown = (isPub && !cqShowAllPub) ? list.slice(0, CQ_PUB_LIMIT) : list;
  var html = '<section class="cq-col" data-st="'+safe(col.v)+'">'+
    '<header class="cq-col-hd"><span class="cq-col-t">'+col.lbl+'</span><span class="cq-col-n">'+total+'</span></header>'+
    '<div class="cq-list">'+shown.map(cqCardHTML).join('')+'</div>';
  if(isPub && total > CQ_PUB_LIMIT){
    html += '<button class="cq-more-pub" onclick="cqTogglePub()">'+(cqShowAllPub ? 'Mostrar menos' : 'Ver todos ('+total+')')+'</button>';
  }
  if(cqAddingCol===col.v){
    html += '<div class="cq-addform">'+
      '<textarea id="cq-add-inp" data-col="'+safe(col.v)+'" rows="2" placeholder="Título do conteúdo" onkeydown="cqAddKey(event,\''+col.v+'\')"></textarea>'+
      '<div class="cq-addform-row">'+
        '<button class="cq-btn-pri" onclick="cqAddSave(\''+col.v+'\')">Adicionar</button>'+
        '<button class="cq-btn-ghost" onclick="cqAddClose()">Cancelar</button>'+
      '</div></div>';
  } else if(!isPub){
    html += '<button class="cq-add" onclick="cqAddOpen(\''+col.v+'\')">+ Adicionar</button>';
  }
  return html + '</section>';
}

function renderQuadro(){
  var el = document.getElementById('quadro-view'); if(!el) return;
  // Dados chegando da nuvem no meio de um arrasto: adia o redesenho
  if(cqDrag && cqDrag.started){ cqDrag.pendingRender = true; return; }
  var board = document.getElementById('cq-board');
  if(!board){
    el.innerHTML = cqShellHTML();
    board = document.getElementById('cq-board');
    cqBindDnD(board);
  }
  var prevInp = document.getElementById('cq-add-inp');
  var typed = (prevInp && prevInp.getAttribute('data-col')===cqAddingCol) ? prevInp.value : '';
  var scroll = board.scrollLeft;
  board.innerHTML = CQ_COLS.map(cqColHTML).join('');
  board.scrollLeft = scroll;
  cqSyncHeader();
  var inp = document.getElementById('cq-add-inp');
  if(inp){ inp.value = typed; inp.focus(); }
}

function cqShellHTML(){
  var plats = allPlats();
  return ''+
  '<header class="cq-hd">'+
    '<div class="cq-hd-l"><h1>Conteúdos</h1><span class="cq-sub" id="cq-sub"></span></div>'+
    '<div class="cq-hd-r">'+
      '<div class="cq-seg" role="tablist">'+
        '<button class="on" onclick="setView(\'quadro\')">Quadro</button>'+
        '<button onclick="setView(\'cal\')">Agenda</button>'+
      '</div>'+
      '<select class="cq-sel" id="cq-plat" onchange="cqSetPlat(this.value)" aria-label="Rede social">'+
        '<option value="">Todas as redes</option>'+
        plats.map(function(p){ return '<option value="'+safe(p)+'">'+safe(p)+'</option>'; }).join('')+
      '</select>'+
      '<div class="cq-menu-wrap">'+
        '<button class="cq-icon" onclick="cqToggleMenu(event)" aria-label="Outras visões" title="Outras visões">'+
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>'+
        '</button>'+
        '<div class="cq-menu" id="cq-menu">'+
          '<div class="cq-menu-lbl">Outras visões</div>'+
          '<button onclick="setView(\'hoje\')">Painel do dia</button>'+
          '<button onclick="setView(\'list\')">Lista de ideias</button>'+
          '<button onclick="setView(\'inbox\')">Inbox de notas</button>'+
        '</div>'+
      '</div>'+
      '<button class="cq-new" onclick="cqAddOpen(\'Nao Iniciado\')">+ Novo</button>'+
    '</div>'+
  '</header>'+
  '<div class="cq-board" id="cq-board"></div>'+
  '<p class="cq-hint">Arraste os cards entre as colunas'+('ontouchstart' in window ? ' (toque e segure)' : '')+'. Clique para editar.</p>';
}

function cqSyncHeader(){
  var emProd = ideas.filter(function(i){ return ideaInCurPlat(i) && i.status!=='Publicado'; }).length;
  var sub = document.getElementById('cq-sub');
  if(sub) sub.textContent = emProd + ' em andamento';
  var sel = document.getElementById('cq-plat');
  if(sel) sel.value = curPlats.length===1 ? curPlats[0] : '';
}

function cqSetPlat(p){ curPlats = p ? [p] : []; saveCurPlat(); renderQuadro(); }
function cqTogglePub(){ cqShowAllPub = !cqShowAllPub; renderQuadro(); }
function cqToggleMenu(ev){
  if(ev) ev.stopPropagation();
  var m = document.getElementById('cq-menu'); if(m) m.classList.toggle('open');
}
document.addEventListener('click', function(){
  var m = document.getElementById('cq-menu'); if(m) m.classList.remove('open');
});

/* ── Adicionar direto na coluna ────────────────────────────── */
function cqAddOpen(colV){ cqAddingCol = colV; renderQuadro(); }
function cqAddClose(){ cqAddingCol = null; renderQuadro(); }
function cqAddKey(ev, colV){
  if(ev.key==='Enter' && !ev.shiftKey){ ev.preventDefault(); cqAddSave(colV); }
  else if(ev.key==='Escape'){ ev.stopPropagation(); cqAddClose(); }
}
function cqAddSave(colV){
  var inp = document.getElementById('cq-add-inp');
  var title = inp ? inp.value.trim() : '';
  if(!title){ if(inp) inp.focus(); return; }
  var idea = {
    id: uid(), title: title, categories: [], formatos: ['Reels'], status: colV,
    notes: '', roteiro: '', legenda: '',
    platforms: [curPlats[0] || 'Instagram'],
    scheduledDate: '', gravarDate: '', createdAt: new Date().toISOString()
  };
  ideas.unshift(idea);
  cqOrder.push(idea.id);
  persistIdea(idea);
  cqSaveOrder();
  if(inp) inp.value = '';
  renderQuadro();   // mantém o campo aberto (vazio) para adicionar o próximo
}

/* ── Edição rápida (painel lateral) ────────────────────────── */
function cqOpen(id){
  var i = byIdIdea(id); if(!i) return;
  cqEditId = id;
  cqRenderPanel();
  document.getElementById('cq-panel-bg').classList.add('open');
  setTimeout(function(){ var t=document.getElementById('cq-p-title'); if(t){ cqAutosize(t); } }, 30);
}
function cqClose(){
  var t = document.getElementById('cq-p-title');
  if(t) cqSaveTitle(t.value);
  cqEditId = null;
  document.getElementById('cq-panel-bg').classList.remove('open');
}
function cqRenderPanel(){
  var i = byIdIdea(cqEditId); if(!i) return;
  var fm = fmtsOf(i), st = cqColOf(i);
  var temRot = !!(i.roteiro||'').replace(/<[^>]*>/g,'').trim();
  var temLeg = !!(i.legenda||'').replace(/<[^>]*>/g,'').trim();
  var extras = [temRot?'roteiro':'', temLeg?'legenda':''].filter(Boolean);
  document.getElementById('cq-panel').innerHTML = ''+
    '<div class="cq-p-hd">'+
      '<span class="cq-p-kicker">'+safe(platsOf(i).join(' · '))+'</span>'+
      '<button class="cq-icon" onclick="cqClose()" aria-label="Fechar">'+
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'+
      '</button>'+
    '</div>'+
    '<textarea class="cq-p-title" id="cq-p-title" rows="1" placeholder="Título" oninput="cqAutosize(this)" onblur="cqSaveTitle(this.value)" onkeydown="if(event.key===\'Enter\'){event.preventDefault();this.blur();}">'+safe(i.title)+'</textarea>'+

    '<div class="cq-p-lbl">Etapa</div>'+
    '<div class="cq-p-steps">'+CQ_COLS.map(function(c){
      return '<button class="'+(c.v===st?'on':'')+'" onclick="cqSet(\'status\',\''+c.v+'\')">'+c.lbl+'</button>';
    }).join('')+'</div>'+

    '<div class="cq-p-lbl">Formato</div>'+
    '<div class="cq-p-chips">'+CQ_FMTS.map(function(f){
      return '<button class="'+(fm.indexOf(f)!==-1?'on':'')+'" onclick="cqToggleFmt(\''+f+'\')">'+f+'</button>';
    }).join('')+'</div>'+

    '<label class="cq-p-lbl" for="cq-p-date">Publicação</label>'+
    '<div class="cq-p-date"><input type="date" id="cq-p-date" value="'+safe(i.scheduledDate||'')+'" onchange="cqSet(\'scheduledDate\',this.value)">'+
      (i.scheduledDate ? '<button class="cq-btn-ghost" onclick="cqSet(\'scheduledDate\',\'\')">Remover data</button>' : '')+
    '</div>'+

    '<button class="cq-p-full" onclick="cqOpenFull()">'+
      '<span>Roteiro, legenda e notas</span>'+
      '<span class="cq-p-full-m">'+(extras.length ? extras.join(' · ') : 'vazio')+' →</span>'+
    '</button>'+

    '<button class="cq-p-del" onclick="cqDelete()">Excluir conteúdo</button>';
}
function cqAutosize(t){ t.style.height='auto'; t.style.height=t.scrollHeight+'px'; }
function cqSaveTitle(v){
  var i = byIdIdea(cqEditId); v = (v||'').trim();
  if(!i || !v || v===i.title) return;
  i.title = v; persistIdea(i); renderQuadro();
}
function cqSet(field, val){
  var i = byIdIdea(cqEditId); if(!i) return;
  if(i[field]===val) return;
  i[field] = val;
  persistIdea(i);
  cqRenderPanel(); renderQuadro();
}
function cqToggleFmt(f){
  var i = byIdIdea(cqEditId); if(!i) return;
  var fm = fmtsOf(i).slice(), ix = fm.indexOf(f);
  if(ix===-1) fm.push(f); else if(fm.length>1) fm.splice(ix,1); else { showToast('Deixe pelo menos um formato'); return; }
  i.formatos = fm; persistIdea(i);
  cqRenderPanel(); renderQuadro();
}
function cqOpenFull(){
  var id = cqEditId; cqClose();
  setTimeout(function(){ openModal(id); }, 180);
}
function cqDelete(){
  var id = cqEditId; if(!id) return;
  if(!confirm('Excluir este conteúdo?')) return;
  ideas = ideas.filter(function(i){ return i.id!==id; });
  saveIdeas();
  if(typeof DB!=='undefined' && !window._SB_ERROR) DB.conteudo.delete(id).catch(function(){});
  cqEditId = null;
  document.getElementById('cq-panel-bg').classList.remove('open');
  cqSaveOrder(); renderQuadro(); showToast('Conteúdo excluído');
}

/* ── Arrastar (mouse + toque com pressão longa) ────────────── */
function cqBindDnD(board){
  board.addEventListener('pointerdown', function(ev){
    if(ev.pointerType==='touch' || ev.button!==0) return;
    cqDown(ev, ev.clientX, ev.clientY, false);
  });
  board.addEventListener('touchstart', function(ev){
    if(ev.touches.length!==1) return;
    cqDown(ev, ev.touches[0].clientX, ev.touches[0].clientY, true);
  }, { passive:true });
  board.addEventListener('keydown', function(ev){
    var c = ev.target.closest && ev.target.closest('.cq-card');
    if(c && (ev.key==='Enter' || ev.key===' ')){ ev.preventDefault(); cqOpen(c.getAttribute('data-id')); }
  });
}

function cqDown(ev, x, y, touch){
  var card = ev.target.closest('.cq-card');
  if(!card || ev.target.closest('button,textarea,input,select')) return;
  cqDrag = { id: card.getAttribute('data-id'), card: card, x0:x, y0:y, x:x, y:y, touch:touch, started:false };
  if(touch){
    cqDrag.timer = setTimeout(function(){ if(cqDrag && !cqDrag.started) cqStart(); }, 280);
    document.addEventListener('touchmove', cqTouchMove, { passive:false });
    document.addEventListener('touchend', cqTouchEnd);
    document.addEventListener('touchcancel', cqTouchCancel);
  } else {
    document.addEventListener('pointermove', cqPtrMove);
    document.addEventListener('pointerup', cqPtrUp);
  }
}
function cqPtrMove(ev){ cqMove(ev, ev.clientX, ev.clientY); }
function cqPtrUp(){ cqUp(); }
function cqTouchMove(ev){ var t=ev.touches[0]; if(t) cqMove(ev, t.clientX, t.clientY); }
function cqTouchEnd(){ cqUp(); }
function cqTouchCancel(){ var p = cqDrag && cqDrag.pendingRender; cqCleanup(); if(p) renderQuadro(); }

function cqMove(ev, x, y){
  var d = cqDrag; if(!d) return;
  d.x = x; d.y = y;
  if(!d.started){
    var dist = Math.abs(x-d.x0) + Math.abs(y-d.y0);
    if(d.touch){ if(dist > 10) cqCleanup(); return; }   // rolou a tela: não é arrasto
    if(dist < 6) return;
    cqStart();
  }
  if(ev.cancelable) ev.preventDefault();
  cqMoveGhost(); cqPlace();
}

function cqStart(){
  var d = cqDrag; if(!d) return;
  d.started = true;
  var r = d.card.getBoundingClientRect();
  d.offX = d.x - r.left; d.offY = d.y - r.top;
  var g = d.card.cloneNode(true);
  g.className = 'cq-card cq-ghost';
  g.style.width = r.width + 'px';
  document.body.appendChild(g);
  d.ghost = g;
  d.card.classList.add('cq-ph');
  document.body.classList.add('cq-dragging');
  if(d.touch && navigator.vibrate) { try{ navigator.vibrate(8); }catch(e){} }
  cqMoveGhost();
  d.raf = requestAnimationFrame(cqAutoScroll);
}

function cqMoveGhost(){
  var d = cqDrag; if(!d || !d.ghost) return;
  d.ghost.style.transform = 'translate('+(d.x-d.offX)+'px,'+(d.y-d.offY)+'px) rotate(2deg)';
}

function cqPlace(){
  var d = cqDrag; if(!d) return;
  var el = document.elementFromPoint(d.x, d.y);
  var col = el && el.closest ? el.closest('.cq-col') : null;
  if(!col) return;
  var list = col.querySelector('.cq-list');
  var cards = Array.prototype.filter.call(list.querySelectorAll('.cq-card'), function(c){ return c!==d.card; });
  var before = null;
  for(var k=0;k<cards.length;k++){
    var r = cards[k].getBoundingClientRect();
    if(d.y < r.top + r.height/2){ before = cards[k]; break; }
  }
  if(before){ if(d.card.nextSibling!==before) list.insertBefore(d.card, before); }
  else if(list.lastElementChild!==d.card) list.appendChild(d.card);
}

function cqAutoScroll(){
  var d = cqDrag; if(!d || !d.started) return;
  var board = document.getElementById('cq-board');
  if(board){
    var br = board.getBoundingClientRect(), edge = 48, sp = 14;
    if(d.x < br.left + edge) board.scrollLeft -= sp;
    else if(d.x > br.right - edge) board.scrollLeft += sp;
    var el = document.elementFromPoint(d.x, d.y);
    var list = el && el.closest ? el.closest('.cq-list') : null;
    if(list){
      var lr = list.getBoundingClientRect();
      if(d.y < lr.top + 36) list.scrollTop -= 10;
      else if(d.y > lr.bottom - 36) list.scrollTop += 10;
    }
    cqPlace();
  }
  d.raf = requestAnimationFrame(cqAutoScroll);
}

function cqUp(){
  var d = cqDrag; if(!d) return;
  if(!d.started){ var id = d.id; cqCleanup(); cqOpen(id); return; }
  var col = d.card.closest('.cq-col');
  var newSt = col ? col.getAttribute('data-st') : null;
  var domIds = Array.prototype.map.call(document.querySelectorAll('#cq-board .cq-card:not(.cq-ghost)'), function(c){ return c.getAttribute('data-id'); });
  var seen = {}; domIds.forEach(function(id){ seen[id]=1; });
  cqOrder = domIds.concat(cqOrder.filter(function(id){ return !seen[id]; }));
  var idea = byIdIdea(d.id);
  var moved = idea && newSt && cqColOf(idea)!==newSt;
  cqCleanup();
  if(moved){
    idea.status = newSt;
    persistIdea(idea);
    var lbl = CQ_COLS.filter(function(c){ return c.v===newSt; })[0];
    showToast('Movido para ' + (lbl ? lbl.lbl : newSt));
  }
  cqSaveOrder();
  renderQuadro();
}

function cqCleanup(){
  var d = cqDrag; if(!d) return;
  clearTimeout(d.timer);
  if(d.raf) cancelAnimationFrame(d.raf);
  if(d.ghost && d.ghost.parentNode) d.ghost.parentNode.removeChild(d.ghost);
  if(d.card) d.card.classList.remove('cq-ph');
  document.body.classList.remove('cq-dragging');
  document.removeEventListener('pointermove', cqPtrMove);
  document.removeEventListener('pointerup', cqPtrUp);
  document.removeEventListener('touchmove', cqTouchMove);
  document.removeEventListener('touchend', cqTouchEnd);
  document.removeEventListener('touchcancel', cqTouchCancel);
  cqDrag = null;
}

/* ── Teclado: Esc fecha painel / campo de adicionar ────────── */
document.addEventListener('keydown', function(e){
  if(e.key!=='Escape' || curView!=='quadro') return;
  var bg = document.getElementById('cq-panel-bg');
  if(bg && bg.classList.contains('open')) cqClose();
  else if(cqAddingCol) cqAddClose();
});

/* ── Init ──────────────────────────────────────────────────── */
cqReadOrder();
cqLoadOrderCloud();
