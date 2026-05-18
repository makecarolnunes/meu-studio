/* ============================================================
   CONFIG
   ============================================================ */
var HARDCODED_SCRIPT_URL = ''; // GAS desativado — módulo usa localStorage

/* ============================================================
   CONSTANTES
   ============================================================ */
var CATS = ['Maquiagem Profissional','Cachos e Crespos','Penteados','Noivas','Automaquiagem','Vida e Lifestyle','Compras e Produtos'];
var ST = {
  'Nao Iniciado':    {bg:'#f3f4f6',color:'#6b7280',dot:'#9e9e9e',cls:'s-nao'},
  'Fila de Gravacao':{bg:'#ffebee',color:'#c62828',dot:'#e53935',cls:'s-fila'},
  'Editando':        {bg:'#f5edf3',color:'#7d3c6e',dot:'#7d3c6e',cls:'s-edit'},
  'Publicado':       {bg:'#e8f5e9',color:'#2d7d3a',dot:'#2d7d3a',cls:'s-pub'}
};
var DEFAULT_PLATFORMS = ['Instagram','TikTok'];
var MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
var DAYS_PT = ['domingo','segunda','terça','quarta','quinta','sexta','sábado'];
var DOW = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];

/* ============================================================
   STATE
   ============================================================ */
var ideas=[], customCats=[], customPlats=[];
var curView='list', curSF='todos', curCF=[], curPlat='todos';
var colIdx=0, editId=null;
var fCats=[CATS[0]], fFmts=['Reels'], fSt='Nao Iniciado', fPlats=['Instagram'];
var calYear=new Date().getFullYear(), calMonth=new Date().getMonth();
var curDayDate=null, dayPickerOpen=false, dayPickerQ='';

/* ============================================================
   SYNC
   ============================================================ */
var syncTimer=null;
function getScriptUrl(){ return HARDCODED_SCRIPT_URL||localStorage.getItem('mk_script_url')||''; }
function setScriptUrl(u){ localStorage.setItem('mk_script_url',u); }
function updateSyncDot(s){ /* sync dot removido */ }
function scheduleSync(){
  if(!getScriptUrl()) return;
  updateSyncDot('pending');
  if(syncTimer) clearTimeout(syncTimer);
  syncTimer=setTimeout(pushToSheets,1800);
}
function pushToSheets(){
  var url=getScriptUrl(); if(!url) return;
  updateSyncDot('syncing');
  fetch(url,{method:'POST',headers:{'Content-Type':'text/plain'},
    body:JSON.stringify({action:'saveAll',ideas:ideas,customCats:customCats,customPlats:customPlats,curPlatform:curPlat})})
  .then(function(r){return r.json();})
  .then(function(d){updateSyncDot(d.ok?'ok':'error');})
  .catch(function(){updateSyncDot('error');});
}

/* ============================================================
   LOCAL STORAGE
   ============================================================ */
function readLS(){
  try{ideas      =JSON.parse(localStorage.getItem('mk_content_ideas')||'[]');}catch(e){ideas=[];}
  try{customCats =JSON.parse(localStorage.getItem('mk_content_cats') ||'[]');}catch(e){customCats=[];}
  try{customPlats=JSON.parse(localStorage.getItem('mk_content_platforms')||'[]');}catch(e){customPlats=[];}
  try{curPlat    =localStorage.getItem('mk_content_cur_platform')||'todos';}catch(e){curPlat='todos';}
}
function writeLS(){
  try{localStorage.setItem('mk_content_ideas',       JSON.stringify(ideas));}catch(e){}
  try{localStorage.setItem('mk_content_cats',        JSON.stringify(customCats));}catch(e){}
  try{localStorage.setItem('mk_content_platforms',   JSON.stringify(customPlats));}catch(e){}
  try{localStorage.setItem('mk_content_cur_platform',curPlat);}catch(e){}
}
function saveIdeas(){try{localStorage.setItem('mk_content_ideas',JSON.stringify(ideas));}catch(e){} scheduleSync();}
function saveCats() {try{localStorage.setItem('mk_content_cats', JSON.stringify(customCats));}catch(e){} scheduleSync();}
function savePlats(){try{localStorage.setItem('mk_content_platforms',JSON.stringify(customPlats));}catch(e){} scheduleSync();}
function saveCurPlat(){try{localStorage.setItem('mk_content_cur_platform',curPlat);}catch(e){} scheduleSync();}

/* ============================================================
   MIGRATION — handles old single-value fields
   ============================================================ */
function migrate(){
  for(var i=0;i<ideas.length;i++){
    var idea=ideas[i];
    // platforms
    if(!idea.platforms||!idea.platforms.length){ idea.platforms=[idea.platform||'Instagram']; delete idea.platform; }
    // categories (was .category string)
    if(!idea.categories||!idea.categories.length){ idea.categories=idea.category?[idea.category]:[CATS[0]]; }
    // formatos (was .formato string)
    if(!idea.formatos||!idea.formatos.length){ idea.formatos=idea.formato?[idea.formato]:['Reels']; }
    // scheduledDate
    if(idea.scheduledDate===undefined) idea.scheduledDate='';
  }
}
function validateCurPlat(){ if(curPlat!=='todos'&&allPlats().indexOf(curPlat)===-1) curPlat='todos'; }

/* ============================================================
   LOAD DATA
   ============================================================ */
function loadData(){
  readLS(); migrate(); validateCurPlat(); render();
  if(typeof DB === 'undefined' || window._SB_ERROR){ updateSyncDot('offline'); return; }
  updateSyncDot('syncing');
  DB.conteudo.list()
    .then(function(data){
      if(data.length > 0 || ideas.length === 0){
        ideas = data; migrate(); validateCurPlat(); writeLS();
      }
      updateSyncDot('ok'); render();
    })
    .catch(function(){ updateSyncDot('offline'); });
}
function migrateData(){ showMigrateBanner(false); showToast('Migrando...'); pushToSheets(); }

/* ============================================================
   SETUP MODAL
   ============================================================ */
function showSetup(){ document.getElementById('setup-bg').className='setup-bg'; }
function hideSetup(){ document.getElementById('setup-bg').className='setup-bg hidden'; }
function openSetup(){ var c=getScriptUrl(); if(c) document.getElementById('setup-url-inp').value=c; showSetup(); }
function skipSetup(){ hideSetup(); render(); }
function saveSetupUrl(){
  var url=document.getElementById('setup-url-inp').value.trim();
  if(!url){showToast('Cole a URL!');return;}
  if(url.indexOf('script.google.com')===-1){showToast('URL invalida.');return;}
  setScriptUrl(url); hideSetup(); showLoading(true);
  fetch(url+'?action=getData')
    .then(function(r){return r.json();})
    .then(function(data){
      showLoading(false);
      if(!data.ok){updateSyncDot('error');showToast('Erro ao conectar.');return;}
      if((!data.ideas||!data.ideas.length)&&ideas.length>0){
        showMigrateBanner(true); updateSyncDot('error'); showToast('Conectado! Migre seus dados.');
      } else {
        ideas=data.ideas||[]; customCats=data.customCats||[]; customPlats=data.customPlats||[]; curPlat=data.curPlatform||'todos';
        migrate(); validateCurPlat(); writeLS(); updateSyncDot('ok'); showToast('Conectado!');
      }
      render();
    })
    .catch(function(){showLoading(false);updateSyncDot('error');showToast('Nao foi possivel conectar.');});
}
function showLoading(on){ document.getElementById('loading-overlay').className='loading-overlay'+(on?'':' hidden'); }
function showMigrateBanner(on){ document.getElementById('migrate-banner').className='migrate-banner'+(on?'':' hidden'); }

/* ============================================================
   SCROLL HORIZONTAL
   ============================================================ */
function attachHorizWheel(el){
  if(!el||el._hw) return; el._hw=true;
  el.addEventListener('wheel',function(e){
    if(el.scrollWidth<=el.clientWidth) return;
    var dy=e.deltaY,dx=e.deltaX;
    if(Math.abs(dx)>Math.abs(dy)||dy===0) return;
    e.preventDefault(); el.scrollLeft+=dy;
  },{passive:false});
  var dn=false,sx=0,ss=0;
  el.addEventListener('mousedown',function(e){if(e.target.closest('button')) return; dn=true;sx=e.pageX;ss=el.scrollLeft;el.style.cursor='grabbing';});
  document.addEventListener('mouseup',function(){dn=false;if(el)el.style.cursor='';});
  document.addEventListener('mousemove',function(e){if(!dn) return; el.scrollLeft=ss-(e.pageX-sx);});
}

/* ============================================================
   PLATFORM
   ============================================================ */
function allPlats(){ var m=DEFAULT_PLATFORMS.slice(); for(var i=0;i<customPlats.length;i++) if(m.indexOf(customPlats[i])===-1) m.push(customPlats[i]); return m; }
function allCats(){  var m=CATS.slice(); for(var i=0;i<customCats.length;i++) if(m.indexOf(customCats[i])===-1) m.push(customCats[i]); return m; }
function platsOf(idea){ if(idea.platforms&&idea.platforms.length) return idea.platforms; return [idea.platform||'Instagram']; }
function catsOf(idea){ if(idea.categories&&idea.categories.length) return idea.categories; return [idea.category||CATS[0]]; }
function fmtsOf(idea){ if(idea.formatos&&idea.formatos.length) return idea.formatos; return [idea.formato||'Reels']; }
function ideaInCurPlat(idea){ if(curPlat==='todos') return true; return platsOf(idea).indexOf(curPlat)!==-1; }

function setPlatform(p){ curPlat=p; saveCurPlat(); colIdx=0; render(); }
function addPlatform(){
  var name=prompt('Nome da nova plataforma:'); if(!name) return; name=name.trim(); if(!name) return;
  var plats=allPlats();
  for(var i=0;i<plats.length;i++){if(plats[i].toLowerCase()===name.toLowerCase()){setPlatform(plats[i]);showToast('Plataforma ja existia');return;}}
  customPlats.push(name); savePlats(); setPlatform(name); showToast('Plataforma criada!');
}
function removePlatform(p){
  if(DEFAULT_PLATFORMS.indexOf(p)!==-1){showToast('Nao da pra remover '+p);return;}
  var count=ideas.filter(function(i){return platsOf(i).indexOf(p)!==-1;}).length;
  var msg='Remover a plataforma "'+p+'"?'; if(count>0) msg+='\n\n'+count+' ideia(s) serao afetadas.';
  if(!confirm(msg)) return;
  for(var i=0;i<ideas.length;i++){var idx=platsOf(ideas[i]).indexOf(p);if(idx!==-1){ideas[i].platforms=platsOf(ideas[i]).filter(function(x){return x!==p;});if(!ideas[i].platforms.length)ideas[i].platforms=['Instagram'];}}
  customPlats=customPlats.filter(function(x){return x!==p;}); if(curPlat===p) curPlat='todos';
  savePlats();saveIdeas();saveCurPlat(); render(); showToast('Plataforma removida');
}
function buildPlatTabs(){
  var plats=allPlats();
  var html='<button class="ptab ptab-all'+(curPlat==='todos'?' on':'')+'" data-p="todos">Todos</button>';
  for(var i=0;i<plats.length;i++){
    var p=plats[i],isC=DEFAULT_PLATFORMS.indexOf(p)===-1;
    var del=(isC&&curPlat===p)?'<span class="ptab-del" data-del="'+safe(p)+'">×</span>':'';
    html+='<button class="ptab'+(curPlat===p?' on':'')+'" data-p="'+safe(p)+'">'+safe(p)+del+'</button>';
  }
  html+='<button class="ptab ptab-add" id="ptab-add">+ Plataforma</button>';
  var el=document.getElementById('ptabs'); el.innerHTML=html; attachHorizWheel(el);
  var tabs=el.querySelectorAll('.ptab:not(.ptab-add)');
  for(var j=0;j<tabs.length;j++){(function(tab){tab.onclick=function(e){var del=e.target.getAttribute&&e.target.getAttribute('data-del');if(del){e.stopPropagation();removePlatform(del);return;}setPlatform(tab.getAttribute('data-p'));};})(tabs[j]);}
  document.getElementById('ptab-add').onclick=addPlatform;
}

/* ============================================================
   VIEW
   ============================================================ */
function setView(v){
  curView=v;
  document.getElementById('btn-list').className ='vbtn'+(v==='list'?' on':'');
  document.getElementById('btn-board').className='vbtn'+(v==='board'?' on':'');
  document.getElementById('btn-cal').className  ='vbtn'+(v==='cal'?' on':'');
  var showListUI=(v==='list');
  document.getElementById('ctabs').style.display    =showListUI?'':'none';
  document.getElementById('chips').style.display    =showListUI?'':'none';
  document.getElementById('list-view').style.display=showListUI?'':'none';
  document.getElementById('board-wrap').className   ='board-wrap'+(v==='board'?' active':'');
  document.getElementById('cal-wrap').className     ='cal-wrap'+(v==='cal'?' active':'');
  if(v==='board') colIdx=0;
  render();
}
function setSF(btn){ curSF=btn.getAttribute('data-s'); var tabs=document.querySelectorAll('.stab'); for(var i=0;i<tabs.length;i++) tabs[i].classList.toggle('on',tabs[i]===btn); render(); }

/* Multi-select category filter */
function setCF(val){
  if(val==='todos'){ curCF=[]; }
  else {
    var idx=curCF.indexOf(val);
    if(idx===-1) curCF.push(val);
    else curCF.splice(idx,1);
  }
  buildCatTabs(); render();
}

/* ============================================================
   FILTER
   ============================================================ */
function filtered(){
  return ideas.filter(function(idea){
    if(!ideaInCurPlat(idea)) return false;
    if(curSF!=='todos'&&idea.status!==curSF) return false;
    if(curCF.length>0){
      var cats=catsOf(idea), match=false;
      for(var c=0;c<curCF.length;c++) if(cats.indexOf(curCF[c])!==-1){match=true;break;}
      if(!match) return false;
    }
    return true;
  });
}

/* ============================================================
   RENDER
   ============================================================ */
function render(){
  buildPlatTabs(); buildCatTabs();
  attachHorizWheel(document.getElementById('stabs'));
  var platIdeas=ideas.filter(ideaInCurPlat), total=platIdeas.length;
  var fila=platIdeas.filter(function(i){return i.status==='Fila de Gravacao';}).length;
  var edit=platIdeas.filter(function(i){return i.status==='Editando';}).length;
  var pub =platIdeas.filter(function(i){return i.status==='Publicado';}).length;
  var label=curPlat==='todos'?'Todas plataformas':curPlat;
  document.getElementById('hdr-count').textContent=total+' ideia'+(total!==1?'s':'')+' • '+label;
  document.getElementById('chips').innerHTML=total?(
    '<div class="chip"><div class="chip-lbl">Total</div><div class="chip-val">'+total+'</div></div>'+
    '<div class="chip"><div class="chip-lbl" style="color:#e53935">Gravacao</div><div class="chip-val" style="color:#e53935">'+fila+'</div></div>'+
    '<div class="chip"><div class="chip-lbl" style="color:#7d3c6e">Editando</div><div class="chip-val" style="color:#7d3c6e">'+edit+'</div></div>'+
    '<div class="chip"><div class="chip-lbl" style="color:#2d7d3a">Publicado</div><div class="chip-val" style="color:#2d7d3a">'+pub+'</div></div>'
  ):'';
  if(curView==='list')  renderList();
  else if(curView==='board') renderBoard();
  else renderCalendar();
}

function buildCatTabs(){
  var cats=allCats(), todos=(curCF.length===0);
  var html='<button class="ctab ctab-todos'+(todos?' on':'')+'" data-c="todos">Todas</button>';
  for(var i=0;i<cats.length;i++){
    var on=curCF.indexOf(cats[i])!==-1;
    html+='<button class="ctab'+(on?' on':'')+'" data-c="'+safe(cats[i])+'">'+safe(cats[i])+'</button>';
  }
  var el=document.getElementById('ctabs'); el.innerHTML=html; attachHorizWheel(el);
  var tabs=el.querySelectorAll('.ctab');
  for(var j=0;j<tabs.length;j++){(function(tab){tab.onclick=function(){setCF(tab.getAttribute('data-c'));};})(tabs[j]);}
}

function renderList(){
  var list=filtered(), el=document.getElementById('list-view');
  if(!list.length){el.innerHTML='<div class="empty"><span class="ico">💡</span><p>Nenhuma ideia aqui ainda.<br>Toque no <b>+</b> para comecar!</p></div>';return;}
  var cats=allCats(), byC={};
  for(var i=0;i<list.length;i++){
    var c=catsOf(list[i])[0]||cats[0]; // group by primary category
    if(!byC[c]) byC[c]=[];
    byC[c].push(list[i]);
  }
  var order=cats.slice(); for(var k in byC){if(order.indexOf(k)===-1)order.push(k);}
  var html='';
  for(var ci=0;ci<order.length;ci++){var cat=order[ci];if(!byC[cat])continue;html+='<div class="group-hdr"><span class="group-pill">'+safe(cat)+'</span><span class="group-count">'+byC[cat].length+'</span></div>';for(var ii=0;ii<byC[cat].length;ii++)html+=ideaCardHTML(byC[cat][ii]);}
  el.innerHTML=html;
  var cards=el.querySelectorAll('.idea-card');
  for(var ci2=0;ci2<cards.length;ci2++){(function(card){card.onclick=function(){openModal(card.getAttribute('data-id'));};})(cards[ci2]);}
}

function ideaCardHTML(idea){
  var sc=ST[idea.status]||ST['Nao Iniciado'];
  var plats=platsOf(idea), cats=catsOf(idea), fmts=fmtsOf(idea);
  var meta='';
  for(var f=0;f<fmts.length;f++) meta+='<span class="idea-fmt">'+safe(fmts[f])+'</span>';
  if(cats.length>1) for(var c=0;c<cats.length;c++) meta+='<span class="idea-cat">'+safe(cats[c])+'</span>';
  if(curPlat==='todos'||plats.length>1) meta+='<span class="idea-plat">'+plats.map(safe).join(' • ')+'</span>';
  var notes=idea.notes?'<div class="idea-notes">'+safe(idea.notes)+'</div>':'';
  var calBadge=idea.scheduledDate?'<span class="idea-cal-date">📅 '+fmtDate(idea.scheduledDate)+'</span>':'';
  return '<div class="idea-card '+sc.cls+'" data-id="'+safe(idea.id)+'">'+
    '<div class="idea-meta">'+meta+'</div>'+
    '<div class="idea-title">'+safe(idea.title)+'</div>'+
    notes+
    '<div class="idea-footer">'+
      '<div class="status-pill" style="background:'+sc.bg+';color:'+sc.color+'"><span class="sdot" style="background:'+sc.dot+'"></span>'+safe(idea.status)+'</div>'+
      '<span class="idea-date">'+fDate(idea.createdAt)+'</span>'+
      calBadge+
    '</div></div>';
}

/* ============================================================
   BOARD
   ============================================================ */
function moveCol(dir){ var cats=allCats(); colIdx=Math.max(0,Math.min(cats.length-1,colIdx+dir)); renderBoard(); }
function renderBoard(){
  var cats=allCats(); colIdx=Math.min(colIdx,cats.length-1); var cat=cats[colIdx];
  var label=curPlat==='todos'?'Todas plataformas':curPlat;
  document.getElementById('b-cat-name').textContent=cat;
  document.getElementById('b-cat-pos').textContent=(colIdx+1)+' de '+cats.length+' • '+label;
  document.getElementById('arr-prev').disabled=colIdx===0;
  document.getElementById('arr-next').disabled=colIdx>=cats.length-1;
  var catIdeas=ideas.filter(function(i){
    if(!ideaInCurPlat(i)) return false;
    if(curSF!=='todos'&&i.status!==curSF) return false;
    return catsOf(i).indexOf(cat)!==-1; // multi-cat aware
  });
  var html='<div class="col-col-hdr"><span class="col-col-title">'+safe(cat)+'</span><span class="col-col-count">'+catIdeas.length+'</span></div>';
  if(!catIdeas.length){html+='<div class="board-empty">Nenhuma ideia nesta categoria</div>';}
  else{
    for(var i=0;i<catIdeas.length;i++){
      var idea=catIdeas[i],sc=ST[idea.status]||ST['Nao Iniciado'],plats=platsOf(idea),fmts=fmtsOf(idea);
      var platTag=(curPlat==='todos'||plats.length>1)?' <span style="font-size:.55rem;color:var(--purple-d);background:var(--purple-l);padding:1px 6px;border-radius:7px;font-weight:700;">'+plats.map(safe).join('·')+'</span>':'';
      html+='<div class="board-card" data-id="'+safe(idea.id)+'"><div class="board-card-title">'+safe(idea.title)+platTag+'</div><div class="board-card-row"><span class="bstatus" style="background:'+sc.bg+';color:'+sc.color+'">'+safe(idea.status)+'</span><span class="bfmt">'+fmts.map(safe).join(', ')+'</span></div></div>';
    }
  }
  html+='<button class="col-add-btn" id="col-add-btn">+ Nova ideia aqui</button>';
  var el=document.getElementById('board-col-view'); el.innerHTML=html;
  var cards=el.querySelectorAll('.board-card');
  for(var ci=0;ci<cards.length;ci++){(function(card){card.onclick=function(){openModal(card.getAttribute('data-id'));};})(cards[ci]);}
  document.getElementById('col-add-btn').onclick=function(){fCats=[cat];openModal(null);};
}

/* ============================================================
   CALENDAR
   ============================================================ */
function moveMonth(dir){
  calMonth+=dir;
  if(calMonth<0){calMonth=11;calYear--;}
  if(calMonth>11){calMonth=0;calYear++;}
  renderCalendar();
}
function goToday(){ calYear=new Date().getFullYear(); calMonth=new Date().getMonth(); renderCalendar(); }
function pad2(n){ return n<10?'0'+n:String(n); }
function dateStr(y,m,d){ return y+'-'+pad2(m+1)+'-'+pad2(d); }

function renderCalendar(){
  var today=new Date();
  var todayStr=dateStr(today.getFullYear(),today.getMonth(),today.getDate());
  document.getElementById('cal-title').textContent=MONTHS[calMonth]+' '+calYear;
  var first=new Date(calYear,calMonth,1);
  var lastDay=new Date(calYear,calMonth+1,0).getDate();
  var startDow=(first.getDay()+6)%7; // Mon=0

  // build indexed ideas by date
  var byDate={};
  for(var i=0;i<ideas.length;i++){
    var sd=ideas[i].scheduledDate;
    if(sd){if(!byDate[sd])byDate[sd]=[];byDate[sd].push(ideas[i]);}
  }

  var html='';
  for(var d=0;d<7;d++) html+='<div class="cal-dow">'+DOW[d]+'</div>';

  // prev month filler
  var prevLast=new Date(calYear,calMonth,0);
  for(var p=startDow-1;p>=0;p--){
    var pd=prevLast.getDate()-p;
    var pds=dateStr(calYear,calMonth-1<0?11:calMonth-1,pd);
    html+='<div class="cal-day other" onclick="openDayModal(\''+pds+'\')"><div class="cal-dn">'+pd+'</div></div>';
  }
  // current month
  for(var d2=1;d2<=lastDay;d2++){
    var ds=dateStr(calYear,calMonth,d2);
    var isToday=(ds===todayStr);
    var dayIdeas=byDate[ds]||[];
    var cls='cal-day'+(isToday?' today':'');
    html+='<div class="'+cls+'" onclick="openDayModal(\''+ds+'\')">';
    html+='<div class="cal-dn">'+d2+'</div>';
    var maxShow=2;
    for(var ii=0;ii<Math.min(dayIdeas.length,maxShow);ii++){
      var sc=ST[dayIdeas[ii].status]||ST['Nao Iniciado'];
      html+='<div class="cal-chip" style="background:'+sc.bg+';color:'+sc.color+'">'+safe(dayIdeas[ii].title)+'</div>';
    }
    if(dayIdeas.length>maxShow) html+='<div class="cal-more">+' +(dayIdeas.length-maxShow)+' mais</div>';
    html+='</div>';
  }
  // next month filler
  var totalCells=startDow+lastDay;
  var remain=(7-(totalCells%7))%7;
  for(var n=1;n<=remain;n++){
    var nds=dateStr(calYear,calMonth+1,n);
    html+='<div class="cal-day other" onclick="openDayModal(\''+nds+'\')"><div class="cal-dn">'+n+'</div></div>';
  }
  document.getElementById('cal-grid').innerHTML=html;
}

/* ============================================================
   DAY MODAL
   ============================================================ */
function openDayModal(ds){
  curDayDate=ds; dayPickerOpen=false; dayPickerQ='';
  var parts=ds.split('-');
  var d=new Date(parseInt(parts[0]),parseInt(parts[1])-1,parseInt(parts[2]));
  document.getElementById('day-date-lbl').textContent=DAYS_PT[d.getDay()]+', '+d.getDate()+' de '+MONTHS[d.getMonth()]+' de '+d.getFullYear();
  renderDayContent();
  document.getElementById('day-bg').classList.add('open');
}
function closeDayModal(){ document.getElementById('day-bg').classList.remove('open'); curDayDate=null; }

function renderDayContent(){
  if(!curDayDate) return;
  var dayIdeas=ideas.filter(function(i){return i.scheduledDate===curDayDate;});
  var html='';
  if(!dayIdeas.length) html+='<div class="day-empty">Nenhuma ideia programada para este dia.</div>';
  else{
    for(var i=0;i<dayIdeas.length;i++){
      var idea=dayIdeas[i],sc=ST[idea.status]||ST['Nao Iniciado'];
      html+='<div class="day-idea-row">'+
        '<div class="day-idea-dot" style="background:'+sc.dot+'"></div>'+
        '<div class="day-idea-info">'+
          '<div class="day-idea-title">'+safe(idea.title)+'</div>'+
          '<div class="day-idea-sub">'+fmtsOf(idea).map(safe).join(', ')+' • '+safe(idea.status)+'</div>'+
        '</div>'+
        '<button class="day-idea-edit" onclick="editFromDay(\''+safe(idea.id)+'\')">Editar</button>'+
        '<button class="day-remove" onclick="removeFromCal(\''+safe(idea.id)+'\')">×</button>'+
      '</div>';
    }
  }
  if(!dayPickerOpen){
    html+='<button class="day-add-btn" onclick="openDayPicker()">+ Adicionar ideia neste dia</button>';
  } else {
    html+='<div class="day-picker-hdr">Escolha uma ideia</div>';
    html+='<input type="text" class="day-picker-search" id="day-search" placeholder="Buscar ideia..." oninput="filterDayPicker(this.value)">';
    var avail=ideas.filter(function(i){return i.scheduledDate!==curDayDate;});
    if(dayPickerQ) avail=avail.filter(function(i){return i.title.toLowerCase().indexOf(dayPickerQ.toLowerCase())!==-1;});
    if(!avail.length) html+='<div class="day-pick-none">Nenhuma ideia disponível</div>';
    else{
      for(var j=0;j<avail.length;j++){
        var av=avail[j],sc2=ST[av.status]||ST['Nao Iniciado'];
        html+='<div class="day-pick-item" onclick="scheduleToDay(\''+safe(av.id)+'\')">'+
          '<div class="day-pick-dot" style="background:'+sc2.dot+'"></div>'+
          '<div><div class="day-pick-title">'+safe(av.title)+'</div>'+
          '<div class="day-pick-sub">'+catsOf(av).map(safe).join(', ')+' • '+fmtsOf(av).map(safe).join(', ')+'</div></div>'+
        '</div>';
      }
    }
  }
  document.getElementById('day-content').innerHTML=html;
  if(dayPickerOpen){ var s=document.getElementById('day-search'); if(s) s.focus(); }
}

function openDayPicker(){ dayPickerOpen=true; dayPickerQ=''; renderDayContent(); }
function filterDayPicker(q){ dayPickerQ=q; renderDayContent(); }

function scheduleToDay(id){
  var idea;
  for(var i=0;i<ideas.length;i++) if(ideas[i].id===id){ ideas[i].scheduledDate=curDayDate; idea=ideas[i]; break; }
  saveIdeas(); renderCalendar(); dayPickerOpen=false; dayPickerQ=''; renderDayContent();
  showToast('Ideia programada!');
  if(idea && typeof DB !== 'undefined' && !window._SB_ERROR) DB.conteudo.upsert(idea).catch(function(){});
}
function removeFromCal(id){
  var idea;
  for(var i=0;i<ideas.length;i++) if(ideas[i].id===id){ ideas[i].scheduledDate=''; idea=ideas[i]; break; }
  saveIdeas(); renderCalendar(); renderDayContent(); showToast('Removido do calendário');
  if(idea && typeof DB !== 'undefined' && !window._SB_ERROR) DB.conteudo.upsert(idea).catch(function(){});
}
function editFromDay(id){ closeDayModal(); setTimeout(function(){openModal(id);},200); }

/* ============================================================
   MODAL — idea
   ============================================================ */
function buildCatBtns(){
  var cats=allCats(), el=document.getElementById('cat-btns'), html='';
  for(var i=0;i<cats.length;i++){
    var on=fCats.indexOf(cats[i])!==-1;
    html+='<button class="gbtn'+(on?' on':'')+'" data-v="'+safe(cats[i])+'">'+safe(cats[i])+'</button>';
  }
  el.innerHTML=html;
  var btns=el.querySelectorAll('.gbtn');
  for(var j=0;j<btns.length;j++){(function(btn){btn.onclick=function(){
    var v=btn.getAttribute('data-v'),idx=fCats.indexOf(v);
    if(idx===-1){fCats.push(v);btn.classList.add('on');}
    else{if(fCats.length<=1){showToast('Pelo menos um tema!');return;}fCats.splice(idx,1);btn.classList.remove('on');}
  };})(btns[j]);}
}

function buildPlatBtns(){
  var plats=allPlats(), el=document.getElementById('pl-btns'), html='';
  for(var i=0;i<plats.length;i++){
    var on=fPlats.indexOf(plats[i])!==-1;
    html+='<button type="button" class="gbtn pl'+(on?' on':'')+'" data-v="'+safe(plats[i])+'">'+safe(plats[i])+'</button>';
  }
  el.innerHTML=html;
  var btns=el.querySelectorAll('.gbtn');
  for(var j=0;j<btns.length;j++){(function(btn){btn.onclick=function(){
    var v=btn.getAttribute('data-v'),idx=fPlats.indexOf(v);
    if(idx===-1){fPlats.push(v);btn.classList.add('on');}
    else{if(fPlats.length<=1){showToast('Pelo menos uma plataforma!');return;}fPlats.splice(idx,1);btn.classList.remove('on');}
  };})(btns[j]);}
}

function syncFmtBtns(){
  var btns=document.querySelectorAll('#fmt-btns .gbtn');
  for(var i=0;i<btns.length;i++) btns[i].classList.toggle('on',fFmts.indexOf(btns[i].getAttribute('data-v'))!==-1);
}
function syncStBtns(){
  var btns=document.querySelectorAll('#st-btns .gbtn');
  for(var i=0;i<btns.length;i++) btns[i].classList.toggle('on',btns[i].getAttribute('data-v')===fSt);
}

function openModal(id){
  editId=id;
  var idea=id?ideas.filter(function(i){return i.id===id;})[0]:null;
  document.getElementById('modal-title').textContent=idea?'Editar Ideia':'Nova Ideia';
  document.getElementById('f-title').value=idea?idea.title:'';
  document.getElementById('f-notes').value=idea?(idea.notes||''):'';
  document.getElementById('f-date').value=idea?(idea.scheduledDate||''):'';
  document.getElementById('new-cat-inp').value='';
  document.getElementById('btn-del').style.display=idea?'block':'none';
  fCats = idea ? catsOf(idea).slice() : (fCats.length?fCats:[CATS[0]]);
  fFmts = idea ? fmtsOf(idea).slice() : ['Reels'];
  fSt   = idea ? (idea.status||'Nao Iniciado') : 'Nao Iniciado';
  fPlats= idea ? platsOf(idea).slice() : [(curPlat==='todos')?'Instagram':curPlat];
  buildCatBtns(); buildPlatBtns(); syncFmtBtns(); syncStBtns();
  document.getElementById('modal-bg').classList.add('open');
  setTimeout(function(){document.getElementById('f-title').focus();},320);
}
function closeModal(){ document.getElementById('modal-bg').classList.remove('open'); }

function saveIdea(){
  var title=document.getElementById('f-title').value.trim();
  if(!title){showToast('Coloca um titulo!');document.getElementById('f-title').focus();return;}
  if(!fPlats.length){showToast('Escolhe pelo menos uma plataforma!');return;}
  if(!fCats.length){showToast('Escolhe pelo menos um tema!');return;}
  if(!fFmts.length){showToast('Escolhe pelo menos um formato!');return;}
  var notes=document.getElementById('f-notes').value.trim();
  var sdate=document.getElementById('f-date').value||'';
  if(editId){
    for(var i=0;i<ideas.length;i++){
      if(ideas[i].id===editId){
        ideas[i].title=title; ideas[i].categories=fCats.slice(); ideas[i].formatos=fFmts.slice();
        ideas[i].status=fSt; ideas[i].notes=notes; ideas[i].platforms=fPlats.slice();
        ideas[i].scheduledDate=sdate;
        break;
      }
    }
    showToast('Ideia atualizada!');
  } else {
    ideas.unshift({id:uid(),title:title,categories:fCats.slice(),formatos:fFmts.slice(),status:fSt,notes:notes,platforms:fPlats.slice(),scheduledDate:sdate,createdAt:new Date().toISOString()});
    showToast('Ideia salva!');
  }
  var syncIdea = editId ? ideas.find(function(i){return i.id===editId;}) : ideas[0];
  saveIdeas(); closeModal(); render();
  if(syncIdea && typeof DB !== 'undefined' && !window._SB_ERROR)
    DB.conteudo.upsert(syncIdea).catch(function(){});
}
function deleteIdea(){
  if(!editId) return; if(!confirm('Excluir essa ideia?')) return;
  var delId = editId;
  ideas=ideas.filter(function(i){return i.id!==delId;});
  saveIdeas(); closeModal(); render(); showToast('Ideia excluida');
  if(typeof DB !== 'undefined' && !window._SB_ERROR)
    DB.conteudo.delete(delId).catch(function(){});
}
function addCustomCat(){
  var inp=document.getElementById('new-cat-inp'),name=inp.value.trim(); if(!name){inp.focus();return;}
  var cats=allCats(),lower=name.toLowerCase();
  for(var i=0;i<cats.length;i++){if(cats[i].toLowerCase()===lower){if(fCats.indexOf(cats[i])===-1)fCats.push(cats[i]);inp.value='';buildCatBtns();return;}}
  customCats.push(name); saveCats(); fCats.push(name); inp.value=''; buildCatBtns(); showToast('Tema criado!');
}

/* ============================================================
   UTILS
   ============================================================ */
function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
function fDate(iso){ if(!iso) return ''; var d=new Date(iso); return ('0'+d.getDate()).slice(-2)+'/'+('0'+(d.getMonth()+1)).slice(-2); }
function fmtDate(ds){ if(!ds) return ''; var p=ds.split('-'); return p[2]+'/'+p[1]; }
function safe(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function showToast(msg){ var t=document.getElementById('toast'); t.textContent=msg; t.classList.add('show'); setTimeout(function(){t.classList.remove('show');},2500); }

/* ============================================================
   EVENTOS GLOBAIS
   ============================================================ */
document.getElementById('fab-btn').onclick=function(){openModal(null);};
document.getElementById('btn-save').onclick=saveIdea;
document.getElementById('btn-del').onclick=deleteIdea;
document.getElementById('btn-add-cat').onclick=addCustomCat;
document.getElementById('modal-bg').onclick=function(e){if(e.target===document.getElementById('modal-bg'))closeModal();};
document.getElementById('day-bg').onclick=function(e){if(e.target===document.getElementById('day-bg'))closeDayModal();};

// Formato multi-select
var fmtBtns=document.querySelectorAll('#fmt-btns .gbtn');
for(var fi=0;fi<fmtBtns.length;fi++){(function(btn){btn.onclick=function(){
  var v=btn.getAttribute('data-v'),idx=fFmts.indexOf(v);
  if(idx===-1){fFmts.push(v);btn.classList.add('on');}
  else{if(fFmts.length<=1){showToast('Pelo menos um formato!');return;}fFmts.splice(idx,1);btn.classList.remove('on');}
};})(fmtBtns[fi]);}

// Status single-select
var stBtns=document.querySelectorAll('#st-btns .gbtn');
for(var si=0;si<stBtns.length;si++){(function(btn){btn.onclick=function(){
  fSt=btn.getAttribute('data-v');
  for(var k=0;k<stBtns.length;k++)stBtns[k].classList.toggle('on',stBtns[k]===btn);
};})(stBtns[si]);}

/* ============================================================
   INIT
   ============================================================ */
loadData();