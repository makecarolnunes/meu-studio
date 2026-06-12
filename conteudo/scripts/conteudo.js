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
  'Pronto':          {bg:'#e0f2f1',color:'#00695c',dot:'#00897b',cls:'s-pronto'},
  'Publicado':       {bg:'#e8f5e9',color:'#2d7d3a',dot:'#2d7d3a',cls:'s-pub'}
};
/* Ordem do funil de produção (avanço com 1 toque) */
var ST_ORDER = ['Nao Iniciado','Fila de Gravacao','Editando','Pronto','Publicado'];
var DEFAULT_PLATFORMS = ['Instagram','TikTok'];
var MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
var DAYS_PT = ['domingo','segunda','terça','quarta','quinta','sexta','sábado'];
var DOW = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];

/* ============================================================
   STATE
   ============================================================ */
var QN_KEY='mk_quick_notes';
var STORIES_KEY='mk_content_stories';
var ideas=[], customCats=[], customPlats=[];
var stories=[];               // checklist diário de stories
var bankCat='todos';          // filtro de tema da gaveta do banco
var promoIdeaId=null;         // ideia alvo do menu "promover" (⤴)
var curView='hoje', curSF='todos', curCF=[], curPlats=[];
var curSort='status'; // 'date' | 'category' | 'status' | 'scheduled' — padrão: por etapa de produção
var colIdx=0, editId=null;
var fCats=[CATS[0]], fFmts=['Reels'], fSt='Nao Iniciado', fPlats=['Instagram'];
var calYear=new Date().getFullYear(), calMonth=new Date().getMonth();
var curDayDate=null, dayPickerOpen=false, dayPickerQ='';

/* ============================================================
   RTE — EDITOR RICO
   ============================================================ */
var activeRTE = 'roteiro';

function switchRteTab(tab){
  activeRTE = tab;
  ['roteiro','legenda','notas'].forEach(function(t){
    var tabEl = document.getElementById('rte-tab-'+t);
    var bodyEl = document.getElementById('rte-'+t);
    if(tabEl) tabEl.classList.toggle('on', t===tab);
    if(bodyEl) bodyEl.classList.toggle('rte-hidden', t!==tab);
  });
  var el = document.getElementById('rte-'+tab);
  if(el) el.focus();
}

function rfmt(cmd, val){
  var el = document.getElementById('rte-'+activeRTE);
  if(!el) return;
  el.focus();
  document.execCommand(cmd, false, val||null);
}

function rfmtBg(color){
  var el = document.getElementById('rte-'+activeRTE);
  if(!el) return;
  el.focus();
  document.execCommand('hiliteColor', false, color);
}

function getRteHtml(id){
  var el = document.getElementById(id);
  if(!el) return '';
  var h = el.innerHTML;
  if(h===''||h==='<br>'||h==='<p></p>'||h==='<p><br></p>') return '';
  return h;
}

function setRteHtml(id, html){
  var el = document.getElementById(id);
  if(!el) return;
  el.innerHTML = html||'';
}

/* ============================================================
   DROPDOWN MULTISELEÇÃO (reutilizável: filtros + seletores do editor)
   ============================================================ */
var _openDD = null; // id do dropdown atualmente aberto

// Helpers de toggle em arrays
function toggleArr(arr, v){ var i=arr.indexOf(v); if(i===-1) arr.push(v); else arr.splice(i,1); }
function toggleArrMin1(arr, v, msg){
  var i=arr.indexOf(v);
  if(i===-1){ arr.push(v); }
  else { if(arr.length<=1){ showToast(msg); return; } arr.splice(i,1); }
}

// Monta o HTML de um dropdown. opts: {dark, allowClear, addPlat, removable}
function ddHtml(id, kind, label, options, selected, opts){
  opts = opts||{};
  var sel = selected||[];
  var cnt = sel.length;
  var trig = label + (cnt ? ' · ' + cnt : '');
  var cls = 'ms-dd' + (opts.dark?' ms-dd-dark':'') + (cnt?' has-sel':'');
  var h = '<div class="'+cls+'" id="'+id+'">'+
    '<button type="button" class="ms-dd-trigger">'+
      '<span class="ms-dd-lbl">'+safe(trig)+'</span>'+
      '<svg class="ms-dd-caret" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>'+
    '</button>'+
    '<div class="ms-dd-panel">';
  if(opts.allowClear !== false){
    h += '<button type="button" class="ms-dd-clear" data-clear="'+safe(kind)+'">'+(opts.clearLabel||'Limpar seleção')+'</button>';
  }
  for(var i=0;i<options.length;i++){
    var v = (options[i].value!==undefined)?options[i].value:options[i];
    var l = (options[i].label!==undefined)?options[i].label:options[i];
    var on = sel.indexOf(v)!==-1;
    var rm = (opts.removable && opts.removable.indexOf(v)!==-1)
      ? '<span class="ms-dd-rm" data-rm="'+safe(v)+'" title="Remover">×</span>' : '';
    h += '<button type="button" class="ms-dd-opt'+(on?' on':'')+'" data-kind="'+safe(kind)+'" data-val="'+safe(v)+'">'+
      '<span class="ms-dd-check"></span><span class="ms-dd-opt-lbl">'+safe(l)+'</span>'+rm+'</button>';
  }
  if(opts.addPlat){
    h += '<button type="button" class="ms-dd-add" data-add="plat">+ Nova plataforma</button>';
  }
  h += '</div></div>';
  return h;
}

function toggleDD(id){ _openDD = (_openDD===id) ? null : id; applyDDOpen(); }
function applyDDOpen(){
  var all = document.querySelectorAll('.ms-dd');
  for(var i=0;i<all.length;i++) all[i].classList.toggle('open', all[i].id===_openDD);
}

function ddPick(kind, val){
  if(kind==='fltPlat'){ toggleArr(curPlats, val); saveCurPlat(); render(); }
  else if(kind==='fltCat'){ toggleArr(curCF, val); render(); }
  else if(kind==='edCat'){  toggleArrMin1(fCats,  val, 'Pelo menos um tema!');       buildEditorDDs(); scheduleDraft(); }
  else if(kind==='edPlat'){ toggleArrMin1(fPlats, val, 'Pelo menos uma plataforma!'); buildEditorDDs(); scheduleDraft(); }
  else if(kind==='edFmt'){  toggleArrMin1(fFmts,  val, 'Pelo menos um formato!');     buildEditorDDs(); scheduleDraft(); }
  applyDDOpen();
}
function ddClear(kind){
  if(kind==='fltPlat'){ curPlats=[]; saveCurPlat(); render(); }
  else if(kind==='fltCat'){ curCF=[]; render(); }
  applyDDOpen();
}

// Delegação única para todos os dropdowns
document.addEventListener('click', function(e){
  var trig = e.target.closest('.ms-dd-trigger');
  if(trig){ e.stopPropagation(); var dd=trig.closest('.ms-dd'); if(dd) toggleDD(dd.id); return; }
  var rm = e.target.closest('.ms-dd-rm');
  if(rm){ e.stopPropagation(); removePlatform(rm.getAttribute('data-rm')); return; }
  var add = e.target.closest('.ms-dd-add');
  if(add){ e.stopPropagation(); addPlatform(); return; }
  var opt = e.target.closest('.ms-dd-opt');
  if(opt){ e.stopPropagation(); ddPick(opt.getAttribute('data-kind'), opt.getAttribute('data-val')); return; }
  var clr = e.target.closest('.ms-dd-clear');
  if(clr){ e.stopPropagation(); ddClear(clr.getAttribute('data-clear')); return; }
  if(_openDD && !e.target.closest('.ms-dd')){ _openDD=null; applyDDOpen(); }
});

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
    body:JSON.stringify({action:'saveAll',ideas:ideas,customCats:customCats,customPlats:customPlats,curPlatform:curPlats})})
  .then(function(r){return r.json();})
  .then(function(d){updateSyncDot(d.ok?'ok':'error');})
  .catch(function(){updateSyncDot('error');});
}

/* ============================================================
   LOCAL STORAGE
   ============================================================ */
function readLS(){
  try{ideas      =JSON.parse(localStorage.getItem('mk_content_ideas')||'[]');}catch(e){ideas=[];}
  try{stories    =JSON.parse(localStorage.getItem(STORIES_KEY)||'[]');}catch(e){stories=[];}
  try{customCats =JSON.parse(localStorage.getItem('mk_content_cats') ||'[]');}catch(e){customCats=[];}
  try{customPlats=JSON.parse(localStorage.getItem('mk_content_platforms')||'[]');}catch(e){customPlats=[];}
  // Filtro de plataforma agora é multiseleção (array). Migra o valor único antigo.
  try{
    var rawP=localStorage.getItem('mk_content_cur_platform');
    if(!rawP||rawP==='todos'){ curPlats=[]; }
    else if(rawP.charAt(0)==='['){ curPlats=JSON.parse(rawP)||[]; }
    else { curPlats=[rawP]; }
  }catch(e){ curPlats=[]; }
}
function writeLS(){
  try{localStorage.setItem('mk_content_ideas',       JSON.stringify(ideas));}catch(e){}
  try{localStorage.setItem('mk_content_cats',        JSON.stringify(customCats));}catch(e){}
  try{localStorage.setItem('mk_content_platforms',   JSON.stringify(customPlats));}catch(e){}
  try{localStorage.setItem('mk_content_cur_platform',JSON.stringify(curPlats));}catch(e){}
}
function saveIdeas(){try{localStorage.setItem('mk_content_ideas',JSON.stringify(ideas));}catch(e){} scheduleSync();}
function saveStoriesLS(){try{localStorage.setItem(STORIES_KEY,JSON.stringify(stories));}catch(e){}}
function persistIdea(idea){
  saveIdeas();
  if(idea && typeof DB!=='undefined' && !window._SB_ERROR) DB.conteudo.upsert(idea).catch(function(){});
}
function persistStory(s){
  saveStoriesLS();
  if(s && typeof DB!=='undefined' && DB.stories && !window._SB_ERROR) DB.stories.upsert(s).catch(function(){});
}
// Persiste categorias/plataformas personalizadas no Supabase (tabela configuracoes) p/ sync entre devices
function syncCfg(chave,val){ if(typeof DB!=='undefined' && DB.config && DB.config.set && !window._SB_ERROR){ DB.config.set(chave, JSON.stringify(val)).catch(function(){}); } }
function saveCats() {try{localStorage.setItem('mk_content_cats', JSON.stringify(customCats));}catch(e){} syncCfg('conteudo_custom_cats', customCats); scheduleSync();}
function savePlats(){try{localStorage.setItem('mk_content_platforms',JSON.stringify(customPlats));}catch(e){} syncCfg('conteudo_custom_plats', customPlats); scheduleSync();}
function saveCurPlat(){try{localStorage.setItem('mk_content_cur_platform',JSON.stringify(curPlats));}catch(e){} scheduleSync();}

/* ============================================================
   RASCUNHO AUTOMÁTICO (draft)
   ============================================================ */
var DRAFT_KEY  = 'mk_modal_draft';
var draftTimer = null;

function scheduleDraft(){
  if(draftTimer) clearTimeout(draftTimer);
  draftTimer = setTimeout(saveDraft, 700);
}

function saveDraft(){
  if(!document.getElementById('modal-bg').classList.contains('open')) return;
  var draft = {
    editId:  editId,
    title:   document.getElementById('f-title').value,
    roteiro: getRteHtml('rte-roteiro'),
    legenda: getRteHtml('rte-legenda'),
    notas:   getRteHtml('rte-notas'),
    sdate:   (document.getElementById('f-date').value)||'',
    gdate:   (document.getElementById('f-gravar').value)||'',
    fCats:   fCats.slice(),
    fFmts:   fFmts.slice(),
    fSt:     fSt,
    fPlats:  fPlats.slice(),
    savedAt: new Date().toISOString()
  };
  try{ localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); }catch(e){}
  showDraftIndicator();
}

function clearDraft(){
  if(draftTimer){ clearTimeout(draftTimer); draftTimer=null; }
  try{ localStorage.removeItem(DRAFT_KEY); }catch(e){}
}

function restoreDraft(id){
  try{
    var raw = localStorage.getItem(DRAFT_KEY);
    if(!raw) return false;
    var d = JSON.parse(raw);
    // Só restaura se for o mesmo contexto (mesma ideia ou ambos "nova")
    if(d.editId !== id) return false;
    // Ignora rascunhos com mais de 7 dias
    if(Date.now() - new Date(d.savedAt).getTime() > 7*86400000){ clearDraft(); return false; }
    document.getElementById('f-title').value = d.title||'';
    document.getElementById('f-date').value  = d.sdate||'';
    document.getElementById('f-gravar').value= d.gdate||'';
    setRteHtml('rte-roteiro', d.roteiro||'');
    setRteHtml('rte-legenda', d.legenda||'');
    setRteHtml('rte-notas',   d.notas||'');
    if(d.fCats  && d.fCats.length)  fCats  = d.fCats;
    if(d.fFmts  && d.fFmts.length)  fFmts  = d.fFmts;
    if(d.fSt)                        fSt    = d.fSt;
    if(d.fPlats && d.fPlats.length)  fPlats = d.fPlats;
    return true;
  }catch(e){ return false; }
}

function showDraftIndicator(){
  var el = document.getElementById('draft-indicator');
  if(!el) return;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(function(){ el.classList.remove('show'); }, 2200);
}

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
    // gravarDate (data de gravação — separada da publicação)
    if(idea.gravarDate===undefined) idea.gravarDate='';
  }
}
function validateCurPlat(){ var all=allPlats(); curPlats=curPlats.filter(function(p){ return all.indexOf(p)!==-1; }); }

/* ============================================================
   QUICK NOTES / INBOX
   ============================================================ */
function readQuickNotes(){
  try{ return JSON.parse(localStorage.getItem(QN_KEY)||'[]'); }catch(e){ return []; }
}
function saveQuickNotes(notes){
  try{ localStorage.setItem(QN_KEY,JSON.stringify(notes)); }catch(e){}
}
function inboxNotes(){
  return readQuickNotes().filter(function(n){ return !n.promoted; });
}
function updateInboxBadges(){
  var n=inboxNotes().length;
  var txt=n>0?String(n):'';
  ['inbox-badge-mob','inbox-badge-desk','inbox-badge-sb'].forEach(function(id){
    var el=document.getElementById(id); if(el) el.textContent=txt;
  });
  // destaca botão inbox na sidebar desktop se tiver notas
  var sb=document.getElementById('d-sb-inbox-btn');
  if(sb) sb.classList.toggle('has-notes',n>0);
}
function discardNote(id){
  var notes=readQuickNotes();
  for(var i=0;i<notes.length;i++){
    if(notes[i].id===id){ notes[i].promoted=true; break; }
  }
  saveQuickNotes(notes);
  // refresh widget badge se disponível
  if(window.QuickNotes) QuickNotes.refresh();
  updateInboxBadges();
  renderInbox();
}
function promoteToIdeia(id){
  var notes=readQuickNotes();
  var note=null;
  for(var i=0;i<notes.length;i++) if(notes[i].id===id){ note=notes[i]; break; }
  if(!note) return;
  // Abre modal pré-preenchido com texto da nota
  openModal(null);
  var rteNotas=document.getElementById('rte-notas');
  if(rteNotas) rteNotas.textContent=note.text;
  // Tenta inferir título: primeira linha até 60 chars
  var firstLine=note.text.split('\n')[0].slice(0,60);
  document.getElementById('f-title').value=firstLine;
  document.getElementById('f-title').focus();
  document.getElementById('f-title').select();
  // Marca nota como promovida imediatamente
  note.promoted=true;
  saveQuickNotes(notes);
  if(window.QuickNotes) QuickNotes.refresh();
  updateInboxBadges();
  renderInbox();
}
function fmtNoteDate(iso){
  if(!iso) return '';
  var d=new Date(iso);
  var diff=Math.floor((Date.now()-d.getTime())/1000);
  if(diff<60) return 'agora';
  if(diff<3600) return Math.floor(diff/60)+'min atrás';
  if(diff<86400) return Math.floor(diff/3600)+'h atrás';
  if(diff<172800) return 'ontem';
  return ('0'+d.getDate()).slice(-2)+'/'+('0'+(d.getMonth()+1)).slice(-2);
}
function srcLabel(src){
  var map={'instagram':'📸 Instagram','conteudo':'📋 Conteúdo','analise-marca':'🏷️ Análise de Marca'};
  return map[src]||'';
}
function renderInbox(){
  var el=document.getElementById('inbox-view'); if(!el) return;
  var notes=inboxNotes();
  updateInboxBadges();
  if(!notes.length){
    el.innerHTML='<div class="inbox-empty">'+
      '<div class="inbox-empty-icon">✍️</div>'+
      '<div class="inbox-empty-title">Nenhuma quick note</div>'+
      '<div class="inbox-empty-sub">Capture ideias rápidas no módulo do Instagram usando o botão flutuante roxo. Elas aparecem aqui prontas para virar pauta.</div>'+
      '</div>';
    return;
  }
  var html='<div class="inbox-header">'+
    '<div class="inbox-header-title">Inbox de Ideias</div>'+
    '<div class="inbox-header-sub">'+notes.length+' nota'+(notes.length!==1?'s':'')+' aguardando</div>'+
    '</div>'+
    '<div class="inbox-list">';
  for(var i=0;i<notes.length;i++){
    var n=notes[i];
    var src=srcLabel(n.source);
    html+='<div class="inbox-card" data-id="'+safe(n.id)+'">'+
      '<div class="inbox-card-top">'+
        (src?'<span class="inbox-src-badge">'+src+'</span>':'')+
        '<span class="inbox-date">'+fmtNoteDate(n.createdAt)+'</span>'+
      '</div>'+
      '<div class="inbox-card-text">'+safe(n.text)+'</div>'+
      '<div class="inbox-card-actions">'+
        '<button class="inbox-btn-promote" onclick="promoteToIdeia(\''+safe(n.id)+'\')">'+
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'+
          'Transformar em Pauta'+
        '</button>'+
        '<button class="inbox-btn-discard" onclick="discardNote(\''+safe(n.id)+'\')">Descartar</button>'+
      '</div>'+
    '</div>';
  }
  html+='</div>';
  el.innerHTML=html;
}

/* ============================================================
   LOAD DATA
   ============================================================ */
function loadData(){
  readLS(); migrate(); validateCurPlat(); render();
  if(typeof DB === 'undefined' || window._SB_ERROR){ updateSyncDot('offline'); return; }
  updateSyncDot('syncing');
  DB.conteudo.list()
    .then(function(data){
      // Supabase é fonte de verdade; ideias locais ainda não enviadas sobem sempre.
      var sbIds = {};
      for(var i=0;i<data.length;i++) sbIds[data[i].id] = true;
      var localOnly = ideas.filter(function(idea){ return !sbIds[idea.id]; });
      ideas = data.concat(localOnly);
      for(var j=0;j<localOnly.length;j++){
        (function(idea){ DB.conteudo.upsert(idea).catch(function(){}); })(localOnly[j]);
      }
      migrate(); validateCurPlat(); writeLS();
      updateSyncDot('ok'); render();
      loadCustomFromCloud();   // categorias/plataformas personalizadas (cross-device)
      loadStoriesFromCloud();  // checklist de stories (cross-device)
    })
    .catch(function(){ updateSyncDot('offline'); });
}

// Stories: Supabase é fonte de verdade; itens locais ainda não enviados sobem.
function loadStoriesFromCloud(){
  if(typeof DB==='undefined' || !DB.stories || window._SB_ERROR) return;
  DB.stories.list()
    .then(function(data){
      var sbIds={};
      for(var i=0;i<data.length;i++) sbIds[data[i].id]=true;
      var localOnly=stories.filter(function(s){ return !sbIds[s.id]; });
      stories=data.concat(localOnly);
      for(var j=0;j<localOnly.length;j++){
        (function(s){ DB.stories.upsert(s).catch(function(){}); })(localOnly[j]);
      }
      saveStoriesLS();
      if(curView==='hoje'||curView==='stories') render();
    })
    .catch(function(){ /* tabela ainda não criada — segue só local */ });
}

// Mescla categorias/plataformas personalizadas vindas do Supabase (união — não perde nada)
function loadCustomFromCloud(){
  if(typeof DB==='undefined' || !DB.config || window._SB_ERROR) return;
  DB.config.get('conteudo_custom_cats').then(function(v){
    var arr=_parseArr(v); if(!arr) return;
    var m=_unionArr(customCats,arr); if(m.length!==customCats.length){ customCats=m; writeLS(); render(); }
  }).catch(function(){});
  DB.config.get('conteudo_custom_plats').then(function(v){
    var arr=_parseArr(v); if(!arr) return;
    var m=_unionArr(customPlats,arr); if(m.length!==customPlats.length){ customPlats=m; writeLS(); validateCurPlat(); render(); }
  }).catch(function(){});
}
function _parseArr(v){ try{ var a=JSON.parse(v); return Array.isArray(a)?a:null; }catch(e){ return null; } }
function _unionArr(a,b){ var out=a.slice(),seen={}; a.forEach(function(x){seen[x]=1;}); b.forEach(function(x){ if(!seen[x]){seen[x]=1;out.push(x);} }); return out; }
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
        ideas=data.ideas||[]; customCats=data.customCats||[]; customPlats=data.customPlats||[]; curPlats=Array.isArray(data.curPlatform)?data.curPlatform:((data.curPlatform&&data.curPlatform!=='todos')?[data.curPlatform]:[]);
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
  // Sem listener de wheel — não interfere no scroll da página
  // Drag horizontal com mouse (arrastar as abas)
  var dn=false,sx=0,ss=0;
  el.addEventListener('mousedown',function(e){if(e.target.closest('button')) return; dn=true;sx=e.pageX;ss=el.scrollLeft;el.style.cursor='grabbing';e.preventDefault();});
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
function ideaInCurPlat(idea){
  if(!curPlats.length) return true;
  var p=platsOf(idea);
  for(var i=0;i<curPlats.length;i++) if(p.indexOf(curPlats[i])!==-1) return true;
  return false;
}

function addPlatform(){
  var name=prompt('Nome da nova plataforma:'); if(!name) return; name=name.trim(); if(!name) return;
  var plats=allPlats();
  for(var i=0;i<plats.length;i++){
    if(plats[i].toLowerCase()===name.toLowerCase()){
      if(curPlats.indexOf(plats[i])===-1) curPlats.push(plats[i]);
      saveCurPlat(); render(); showToast('Plataforma ja existia'); return;
    }
  }
  customPlats.push(name); savePlats(); curPlats.push(name); saveCurPlat(); render(); showToast('Plataforma criada!');
}
function removePlatform(p){
  if(DEFAULT_PLATFORMS.indexOf(p)!==-1){showToast('Nao da pra remover '+p);return;}
  var count=ideas.filter(function(i){return platsOf(i).indexOf(p)!==-1;}).length;
  var msg='Remover a plataforma "'+p+'"?'; if(count>0) msg+='\n\n'+count+' ideia(s) serao afetadas.';
  if(!confirm(msg)) return;
  for(var i=0;i<ideas.length;i++){var idx=platsOf(ideas[i]).indexOf(p);if(idx!==-1){ideas[i].platforms=platsOf(ideas[i]).filter(function(x){return x!==p;});if(!ideas[i].platforms.length)ideas[i].platforms=['Instagram'];}}
  customPlats=customPlats.filter(function(x){return x!==p;}); curPlats=curPlats.filter(function(x){return x!==p;});
  savePlats();saveIdeas();saveCurPlat(); render(); showToast('Plataforma removida');
}

// Barra de filtros (Plataforma + Temas) — dropdowns multiseleção; mobile (#ptabs) e desktop (#d-filter-dds)
function buildFilters(){
  var plats=allPlats(), cats=allCats();
  var customPl=customPlats.slice();
  var platOpts=plats.map(function(p){ return {value:p,label:p}; });
  var catOpts=cats.map(function(c){ return {value:c,label:c}; });
  var mobHtml =
    ddHtml('dd-fltPlat-mob','fltPlat','Plataforma',platOpts,curPlats,{addPlat:true,removable:customPl}) +
    ddHtml('dd-fltCat-mob','fltCat','Temas',catOpts,curCF,{});
  var deskHtml =
    ddHtml('dd-fltPlat-desk','fltPlat','Plataforma',platOpts,curPlats,{addPlat:true,removable:customPl}) +
    ddHtml('dd-fltCat-desk','fltCat','Temas',catOpts,curCF,{});
  var mob=document.getElementById('ptabs'); if(mob) mob.innerHTML=mobHtml;
  var desk=document.getElementById('d-filter-dds'); if(desk) desk.innerHTML=deskHtml;
}

/* ============================================================
   VIEW
   ============================================================ */
function setView(v){
  curView=v;
  // Toggle do header mobile (Lista/Board/Inbox) — só visível no acervo
  var ideiasCtx=(v==='list'||v==='board'||v==='inbox');
  var vt=document.getElementById('view-toggle');
  if(vt) vt.style.display=ideiasCtx?'':'none';
  var bl=document.getElementById('btn-list');  if(bl) bl.className ='vbtn'+(v==='list'?' on':'');
  var bb=document.getElementById('btn-board'); if(bb) bb.className='vbtn'+(v==='board'?' on':'');
  var bi=document.getElementById('btn-inbox'); if(bi) bi.className='vbtn'+(v==='inbox'?' on':'');
  // Desktop toolbar toggle
  document.querySelectorAll('.d-vbtn').forEach(function(b){ b.classList.toggle('on', b.dataset.v===v); });
  // Toolbar desktop só no acervo; sort só na lista
  var toolbar=document.querySelector('.d-toolbar');
  if(toolbar){
    toolbar.style.display=ideiasCtx?'':'none';
    toolbar.classList.toggle('hide-sort', v!=='list');
  }
  // Views novas
  var hojeEl=document.getElementById('hoje-view');
  if(hojeEl) hojeEl.style.display=(v==='hoje')?'':'none';
  var stEl=document.getElementById('stories-view');
  if(stEl) stEl.style.display=(v==='stories')?'':'none';
  document.getElementById('list-view').style.display=(v==='list')?'':'none';
  // Filtros (Plataforma/Temas + Status) só fazem sentido em lista e board
  var showFilters=(v==='list'||v==='board');
  var fbar=document.getElementById('ptabs'); if(fbar) fbar.style.display=showFilters?'':'none';
  var sbar=document.getElementById('stabs'); if(sbar) sbar.style.display=showFilters?'':'none';
  if(toolbar) toolbar.classList.toggle('no-filters', !showFilters);
  // Mobile board vs desktop board
  var dboard=document.getElementById('d-board-wrap');
  if(dboard) dboard.style.display=(v==='board'&&isDesktop())?'flex':'none';
  document.getElementById('board-wrap').className   ='board-wrap'+((v==='board'&&!isDesktop())?' active':'');
  document.getElementById('cal-wrap').className     ='cal-wrap'+(v==='cal'?' active':'');
  // Inbox
  var inboxEl=document.getElementById('inbox-view');
  if(inboxEl){ inboxEl.style.display=(v==='inbox')?'':'none'; if(v==='inbox') renderInbox(); }
  // Acervo
  var acvEl=document.getElementById('acervo-view');
  if(acvEl) acvEl.style.display=(v==='acervo')?'':'none';
  // FAB "+ nova ideia" não faz sentido no Acervo (criação é "+ Novo material");
  // escondê-lo evita o atropelo com as ações dos cards de oportunidade no mobile
  var fabBtn=document.getElementById('fab-btn');
  if(fabBtn) fabBtn.style.display=(v==='acervo')?'none':'';
  // Gaveta do banco (desktop) — só na view Hoje
  var drawer=document.getElementById('bank-drawer');
  if(drawer) drawer.classList.toggle('show', v==='hoje');
  // Header mobile: título contextual
  var h1=document.querySelector('.hdr h1');
  if(h1){
    var titles={hoje:'Hoje',stories:'Stories',cal:'Agenda',inbox:'Inbox',list:'Ideias',board:'Ideias',acervo:'Acervo'};
    h1.textContent=titles[v]||'Conteúdo';
  }
  if(v==='hoje'||v==='stories'||v==='cal'||v==='inbox'){
    var hc=document.getElementById('hdr-count');
    if(hc){
      var today=new Date();
      hc.textContent=(v==='hoje')
        ? DAYS_PT[today.getDay()]+', '+today.getDate()+' de '+MONTHS[today.getMonth()].toLowerCase()
        : '';
    }
  }
  // Tabs mobile + nav sidebar
  syncNavStates();
  if(v==='board') colIdx=0;
  if(v!=='inbox') render(); else buildSidebar();
}

function syncNavStates(){
  var group=(curView==='board')?'list':curView; // board pertence ao grupo Ideias
  document.querySelectorAll('.d-sb-nav-item').forEach(function(b){
    b.classList.toggle('on', b.dataset.nav===group || (group==='stories'&&b.dataset.nav==='hoje'));
  });
  document.querySelectorAll('.m-tab').forEach(function(b){
    b.classList.toggle('on', b.dataset.nav===group || (group==='inbox'&&b.dataset.nav==='list'));
  });
}
function setSF(btn){ curSF=btn.getAttribute('data-s'); var tabs=document.querySelectorAll('.stab'); for(var i=0;i<tabs.length;i++) tabs[i].classList.toggle('on',tabs[i]===btn); render(); }

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

function isDesktop(){ return window.innerWidth >= 1024; }

/* ============================================================
   SIDEBAR DESKTOP
   ============================================================ */
function buildSidebar(){
  var pipeEl = document.getElementById('d-sb-pipe');
  if(pipeEl){
    var cnt=function(st){ return ideas.filter(function(i){return i.status===st;}).length; };
    var rows=[
      {v:'Nao Iniciado',    ico:'💡', lbl:'Ideias',   n:cnt('Nao Iniciado')},
      {v:'Fila de Gravacao',ico:'🎬', lbl:'Gravar',   n:cnt('Fila de Gravacao')},
      {v:'Editando',        ico:'✂️', lbl:'Editar',   n:cnt('Editando')},
      {v:'Pronto',          ico:'✅', lbl:'Pronto',   n:cnt('Pronto')},
      {v:'Publicado',       ico:'📤', lbl:'Publicado',n:cnt('Publicado'), dim:true},
    ];
    var html='<div class="d-sb-lbl">Pipeline</div>';
    for(var r=0;r<rows.length;r++){
      var row=rows[r];
      html+='<button class="d-sb-st-item'+(row.dim?' d-sb-st-dim':'')+'" onclick="pipeGo(\''+safe(row.v)+'\')">'+
        '<span class="d-sb-st-ico">'+row.ico+'</span>'+
        '<span class="d-sb-st-name">'+row.lbl+'</span>'+
        '<span class="d-sb-st-cnt">'+row.n+'</span>'+
      '</button>';
    }
    pipeEl.innerHTML=html;
  }

  // Toolbar (acervo)
  var filterNames={todos:'Todos','Nao Iniciado':'Ideias','Fila de Gravacao':'Fila de gravação','Editando':'Editando','Pronto':'Pronto','Publicado':'Publicado'};
  var dTitle=document.getElementById('d-toolbar-title');
  var dCnt=document.getElementById('d-toolbar-cnt');
  if(dTitle) dTitle.textContent=filterNames[curSF]||'Todos';
  if(dCnt){
    var n=filtered().length;
    dCnt.textContent=n+' ideia'+(n!==1?'s':'');
  }
}

// Clique num estágio do pipeline → abre o acervo já filtrado por aquele status
function pipeGo(s){
  curSF=s;
  document.querySelectorAll('.stab').forEach(function(b){b.classList.toggle('on',b.dataset.s===s);});
  setView('list');
}

function setSFD(s){
  curSF=s;
  document.querySelectorAll('.stab').forEach(function(b){b.classList.toggle('on',b.dataset.s===s);});
  render();
}

/* ============================================================
   BOARD DESKTOP (kanban 4 colunas por status)
   ============================================================ */
function renderBoardDesktop(){
  var el=document.getElementById('d-board-wrap');
  if(!el) return;
  var cols=[
    {v:'Nao Iniciado',    lbl:'Ideias',           dot:'#9e9e9e', bg:'rgba(0,0,0,.04)'},
    {v:'Fila de Gravacao',lbl:'Fila de gravação', dot:'#e53935', bg:'rgba(198,40,40,.05)'},
    {v:'Editando',        lbl:'Editando',         dot:'#7d3c6e', bg:'rgba(126,87,194,.06)'},
    {v:'Pronto',          lbl:'Pronto',           dot:'#00897b', bg:'rgba(0,137,123,.06)'},
    {v:'Publicado',       lbl:'Publicado',        dot:'#2d7d3a', bg:'rgba(59,109,17,.05)'},
  ];
  var html='';
  for(var ci=0;ci<cols.length;ci++){
    var col=cols[ci];
    var colIdeas=ideas.filter(function(idea){
      if(!ideaInCurPlat(idea)) return false;
      if(curCF.length>0){
        var cats=catsOf(idea), match=false;
        for(var c=0;c<curCF.length;c++) if(cats.indexOf(curCF[c])!==-1){match=true;break;}
        if(!match) return false;
      }
      return idea.status===col.v;
    });
    html+='<div class="d-board-col" style="background:'+col.bg+'">'+
      '<div class="d-board-col-hdr">'+
        '<div class="d-board-col-dot" style="background:'+col.dot+'"></div>'+
        '<span class="d-board-col-title">'+col.lbl+'</span>'+
        '<span class="d-board-col-cnt">'+colIdeas.length+'</span>'+
      '</div>';
    if(!colIdeas.length){html+='<div style="text-align:center;padding:18px 0;font-size:.75rem;color:var(--muted)">Nenhuma ideia</div>';}
    else{
      for(var ii=0;ii<colIdeas.length;ii++){
        var idea=colIdeas[ii], cats2=catsOf(idea);
        var catTag=cats2.length?'<span class="d-bcard-tag" style="background:#f0e6f0;color:#5c2a51">'+safe(cats2[0])+'</span>':'';
        var dateTag=idea.scheduledDate?'<span class="d-bcard-date">📅 '+fmtDate(idea.scheduledDate)+'</span>':'';
        html+='<div class="d-bcard" data-id="'+safe(idea.id)+'">'+
          '<div class="d-bcard-title">'+safe(idea.title)+'</div>'+
          '<div class="d-bcard-foot">'+catTag+dateTag+'</div>'+
        '</div>';
      }
    }
    html+='<button class="d-board-add" onclick="openModal(null)">+ Nova ideia</button>';
    html+='</div>';
  }
  el.innerHTML=html;
  var bcards=el.querySelectorAll('.d-bcard');
  for(var bi=0;bi<bcards.length;bi++){(function(card){card.onclick=function(){openModal(card.getAttribute('data-id'));};})(bcards[bi]);}
}

/* ============================================================
   RENDER
   ============================================================ */
function render(){
  buildFilters();
  attachHorizWheel(document.getElementById('stabs'));
  if(curView==='list'||curView==='board'){
    var platIdeas=ideas.filter(ideaInCurPlat), total=platIdeas.length;
    var label=curPlats.length?curPlats.join(', '):'Todas plataformas';
    var hc=document.getElementById('hdr-count');
    if(hc) hc.textContent=total+' ideia'+(total!==1?'s':'')+' • '+label;
  }
  buildSidebar();
  if(curView==='hoje'){ renderHoje(); buildBank(); }
  else if(curView==='stories') renderStoriesView();
  else if(curView==='list')  renderList();
  else if(curView==='board'){
    if(isDesktop()){ renderBoardDesktop(); }
    else { renderBoard(); }
  }
  else if(curView==='cal') renderCalendar();
  else if(curView==='acervo') renderAcervo();
  applyDDOpen();
}

function setSort(s){
  curSort=s;
  document.querySelectorAll('.d-sort-btn').forEach(function(b){ b.classList.toggle('active', b.dataset.sort===s); });
  renderList();
}

function renderList(){
  var list=filtered(), el=document.getElementById('list-view');
  if(!list.length){el.innerHTML='<div class="empty"><span class="ico">💡</span><p>Nenhuma ideia aqui ainda.<br>Toque no <b>+</b> para comecar!</p></div>';return;}
  var html='';

  if(curSort==='category'){
    // Agrupar por tema
    var cats=allCats(), byC={};
    for(var i=0;i<list.length;i++){
      var c=catsOf(list[i])[0]||cats[0];
      if(!byC[c]) byC[c]=[];
      byC[c].push(list[i]);
    }
    var order=cats.slice(); for(var k in byC){if(order.indexOf(k)===-1)order.push(k);}
    for(var ci=0;ci<order.length;ci++){
      var cat=order[ci]; if(!byC[cat]) continue;
      html+='<div class="group-hdr"><span class="group-pill">'+safe(cat)+'</span><span class="group-count">'+byC[cat].length+'</span></div>';
      for(var ii=0;ii<byC[cat].length;ii++) html+=ideaCardHTML(byC[cat][ii]);
    }
  } else if(curSort==='status'){
    // Agrupar por etapa de produção. Ordem do fluxo: o que precisa de ação
    // primeiro, e Publicado por último (apagadinho, pois já saiu).
    var stOrder=['Fila de Gravacao','Editando','Pronto','Nao Iniciado','Publicado'];
    for(var si=0;si<stOrder.length;si++){
      var sv=stOrder[si], sc2=ST[sv]||ST['Nao Iniciado'];
      var stList=list.filter(function(i){ return i.status===sv; });
      if(!stList.length) continue;
      var dim = (sv==='Publicado') ? ' grp-dim' : '';
      html+='<div class="group-hdr'+dim+'"><span class="group-pill" style="background:'+sc2.dot+'">'+safe(sv)+'</span><span class="group-count">'+stList.length+'</span></div>';
      for(var sii=0;sii<stList.length;sii++) html+=ideaCardHTML(stList[sii], dim?'idea-card-dim':'');
    }
  } else if(curSort==='scheduled'){
    // Ordenar por data agendada (sem data no final)
    var sorted=list.slice().sort(function(a,b){
      if(!a.scheduledDate && !b.scheduledDate) return 0;
      if(!a.scheduledDate) return 1;
      if(!b.scheduledDate) return -1;
      return a.scheduledDate < b.scheduledDate ? -1 : 1;
    });
    for(var i2=0;i2<sorted.length;i2++) html+=ideaCardHTML(sorted[i2]);
  } else {
    // 'date' (padrão): mais recentes primeiro
    var byDate=list.slice().sort(function(a,b){
      var da=a.createdAt||'', db=b.createdAt||'';
      return da < db ? 1 : -1;
    });
    for(var i3=0;i3<byDate.length;i3++) html+=ideaCardHTML(byDate[i3]);
  }

  el.innerHTML=html;
  var cards=el.querySelectorAll('.idea-card');
  for(var ci2=0;ci2<cards.length;ci2++){(function(card){card.onclick=function(){openModal(card.getAttribute('data-id'));};})(cards[ci2]);}
}

function ideaCardHTML(idea, extraCls){
  var sc=ST[idea.status]||ST['Nao Iniciado'];
  var cat=catsOf(idea)[0]||'';
  var hasContent=!!(idea.roteiro||idea.legenda);
  var contentDot=hasContent?'<span class="idea-content-dot" title="Tem roteiro">●</span>':'';
  var dateStr=idea.scheduledDate
    ?'<span class="idea-cal-date">📅 '+fmtDate(idea.scheduledDate)+'</span>'
    :'<span class="idea-date-sm">'+fDate(idea.createdAt)+'</span>';
  return '<div class="idea-card '+sc.cls+(extraCls?' '+extraCls:'')+'" data-id="'+safe(idea.id)+'">'+
    '<div class="idea-card-top">'+
      '<div class="idea-title">'+safe(idea.title)+contentDot+'</div>'+
      '<div class="status-pill" style="background:'+sc.bg+';color:'+sc.color+'">'+
        '<span class="sdot" style="background:'+sc.dot+'"></span>'+
        stLabel(idea.status)+
      '</div>'+
    '</div>'+
    '<div class="idea-card-bot">'+
      dateStr+
      (cat?'<span class="idea-cat-sm">'+safe(cat)+'</span>':'')+
      '<button class="idea-promote" title="Promover (gravar hoje, story, agendar)" onclick="openPromo(\''+safe(idea.id)+'\',event)">⤴</button>'+
    '</div>'+
  '</div>';
}
function stLabel(s){
  var map={'Nao Iniciado':'Ideia','Fila de Gravacao':'Gravar','Editando':'Editando','Pronto':'Pronto','Publicado':'Publicado'};
  return map[s]||safe(s);
}

/* ============================================================
   BOARD
   ============================================================ */
function moveCol(dir){ var cats=allCats(); colIdx=Math.max(0,Math.min(cats.length-1,colIdx+dir)); renderBoard(); }
function renderBoard(){
  var cats=allCats(); colIdx=Math.min(colIdx,cats.length-1); var cat=cats[colIdx];
  var label=curPlats.length?curPlats.join(', '):'Todas plataformas';
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
      var platTag=(!curPlats.length||plats.length>1)?' <span style="font-size:.55rem;color:var(--purple-d);background:var(--purple-l);padding:1px 6px;border-radius:7px;font-weight:700;">'+plats.map(safe).join('·')+'</span>':'';
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
function closeDayModal(){
  document.getElementById('day-bg').classList.remove('open'); curDayDate=null;
  if(curView==='hoje') render(); // o painel pode ter mudado (ex: ideia agendada num dia)
}

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
   CENTRO DE COMANDO — view "Hoje"
   ============================================================ */
function byIdIdea(id){ for(var i=0;i<ideas.length;i++) if(ideas[i].id===id) return ideas[i]; return null; }
function todayISO(){ var d=new Date(); return dateStr(d.getFullYear(),d.getMonth(),d.getDate()); }
function addDaysISO(iso,n){ var p=iso.split('-'); var d=new Date(+p[0],+p[1]-1,+p[2]+n); return dateStr(d.getFullYear(),d.getMonth(),d.getDate()); }
function dowOf(iso){ var p=iso.split('-'); return new Date(+p[0],+p[1]-1,+p[2]).getDay(); }
function cap(s){ return s.charAt(0).toUpperCase()+s.slice(1); }
function dayLabel(iso){
  var t=todayISO();
  if(iso===t) return 'Hoje';
  if(iso===addDaysISO(t,1)) return 'Amanhã';
  return cap(DAYS_PT[dowOf(iso)])+' · '+fmtDate(iso);
}

/* Regras determinísticas do painel (seções mutuamente exclusivas) */
function hojeData(){
  var t=todayISO(), lim=addDaysISO(t,3);
  var atrasados=[],gravar=[],publicar=[],editando=[],prontos=[];
  for(var k=0;k<ideas.length;k++){
    var i=ideas[k];
    if(i.status==='Publicado') continue;
    if(i.scheduledDate && i.scheduledDate<t){ atrasados.push(i); continue; }
    if(i.scheduledDate===t){ publicar.push(i); continue; }
    if(i.status==='Editando'){ editando.push(i); continue; }
    if(i.status==='Pronto'){ if(!i.scheduledDate) prontos.push(i); continue; }
    if(i.gravarDate && i.gravarDate<=t){ gravar.push(i); continue; }
    if(i.status==='Fila de Gravacao' && !i.gravarDate && i.scheduledDate && i.scheduledDate<=lim){ gravar.push(i); }
  }
  var bySched=function(a,b){ var x=a.scheduledDate||'9999',y=b.scheduledDate||'9999'; return x<y?-1:(x>y?1:0); };
  atrasados.sort(bySched); gravar.sort(bySched); editando.sort(bySched);
  return {atrasados:atrasados,gravar:gravar,publicar:publicar,editando:editando,prontos:prontos};
}

function nextDayItems(dt){
  var pubs=ideas.filter(function(i){ return i.scheduledDate===dt && i.status!=='Publicado'; });
  var gravs=ideas.filter(function(i){ return i.gravarDate===dt && i.status!=='Publicado' && i.scheduledDate!==dt; });
  return {pubs:pubs, gravs:gravs, st:storiesFor(dt).length};
}

/* ── Ações de 1 toque ── */
function advanceTo(id,st,ev){
  if(ev) ev.stopPropagation();
  var i=byIdIdea(id); if(!i) return;
  i.status=st;
  persistIdea(i);
  var msg={'Editando':'🎬 Gravado! Foi para a edição','Pronto':'✅ Pronto para publicar!','Publicado':'🎉 Publicado!'}[st]||('Status: '+stLabel(st));
  showToast(msg);
  render();
}
function reagendarIdea(id,ev){
  if(ev) ev.stopPropagation();
  openModal(id);
  setTimeout(function(){ var f=document.getElementById('f-date'); if(f) f.focus(); },380);
}
function openRoteiro(id,ev){
  if(ev) ev.stopPropagation();
  var i=byIdIdea(id); if(!i) return;
  if(!i.roteiro){ openModal(id); setTimeout(function(){ switchRteTab('roteiro'); },380); return; }
  editId=id;
  setRteHtml('rte-roteiro', i.roteiro||'');
  document.getElementById('grav-title-lbl').textContent=i.title||'Modo Gravação';
  var b=document.getElementById('gravacao-body');
  b.innerHTML=i.roteiro;
  b.style.fontSize=gravFontSize+'rem';
  document.getElementById('gravacao-bg').classList.add('open');
}
function copyLegenda(id,ev){
  if(ev) ev.stopPropagation();
  var i=byIdIdea(id); if(!i) return;
  var div=document.createElement('div'); div.innerHTML=i.legenda||'';
  var txt=(div.innerText||'').trim();
  if(!txt){ showToast('Sem legenda ainda — escreva no editor'); openModal(id); setTimeout(function(){ switchRteTab('legenda'); },380); return; }
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(txt).then(function(){ showToast('📋 Legenda copiada!'); },function(){ showToast('Não consegui copiar'); });
  } else {
    var ta=document.createElement('textarea'); ta.value=txt; document.body.appendChild(ta); ta.select();
    try{ document.execCommand('copy'); showToast('📋 Legenda copiada!'); }catch(e){ showToast('Não consegui copiar'); }
    document.body.removeChild(ta);
  }
}

/* ── Stories (checklist diário) ── */
function storiesFor(date){
  return stories.filter(function(s){ return s.date===date; })
    .sort(function(a,b){ return (a.ordem-b.ordem) || (a.createdAt<b.createdAt?-1:1); });
}
function addStory(date,texto,ideaId){
  if(!texto) return;
  var s={id:uid(),date:date,texto:texto,ideaId:ideaId||'',done:false,ordem:storiesFor(date).length,createdAt:new Date().toISOString()};
  stories.push(s);
  persistStory(s);
}
function storyInpKey(ev,date){
  if(ev.key!=='Enter') return;
  var v=ev.target.value.trim(); if(!v) return;
  addStory(date,v,'');
  render();
  var inp=document.getElementById('st-inp-'+date);
  if(inp) inp.focus();
}
function toggleStoryDone(id){
  for(var i=0;i<stories.length;i++) if(stories[i].id===id){ stories[i].done=!stories[i].done; persistStory(stories[i]); break; }
  render();
}
function removeStory(id,ev){
  if(ev) ev.stopPropagation();
  stories=stories.filter(function(s){ return s.id!==id; });
  saveStoriesLS();
  if(typeof DB!=='undefined' && DB.stories && !window._SB_ERROR) DB.stories.delete(id).catch(function(){});
  render();
}
function storiesBlockHTML(date,label){
  var list=storiesFor(date), done=list.filter(function(s){return s.done;}).length;
  var h='<div class="stories-day">'+safe(label)+(list.length?'<span class="prog">'+done+'/'+list.length+'</span>':'')+'</div>';
  if(!list.length) h+='<div class="stories-empty">nenhum story planejado</div>';
  for(var k=0;k<list.length;k++){
    var s=list[k];
    h+='<div class="story'+(s.done?' done':'')+'" onclick="toggleStoryDone(\''+safe(s.id)+'\')">'+
      '<span class="story-chk">✓</span>'+
      '<span class="story-txt">'+safe(s.texto)+'</span>'+
      (s.ideaId?'<span class="story-link" title="Veio do banco de ideias">↗</span>':'')+
      '<button class="story-del" title="Remover" onclick="removeStory(\''+safe(s.id)+'\',event)">×</button>'+
    '</div>';
  }
  h+='<input class="story-add-inp" id="st-inp-'+date+'" placeholder="＋ story rápido… (Enter)" onkeydown="storyInpKey(event,\''+date+'\')">';
  return h;
}
function renderStoriesView(){
  var el=document.getElementById('stories-view'); if(!el) return;
  var t=todayISO(), html='<div class="stories-page">';
  for(var k=0;k<7;k++){
    var dt=addDaysISO(t,k);
    html+='<div class="stories-box stories-box-page">'+storiesBlockHTML(dt,dayLabel(dt))+'</div>';
  }
  html+='</div>';
  el.innerHTML=html;
}

/* ── Cards de ação do painel ── */
function acardHTML(i,mode){
  var cat=catsOf(i)[0]||'';
  var pilar=cat?'<span class="pilar">'+safe(cat)+'</span>':'';
  var flag='',extra='',meta='',actions='';
  if(mode==='late'){
    flag='<div class="late-flag">🔴 Atrasado · era para '+fmtDate(i.scheduledDate)+'</div>';
    meta=pilar+'<span>'+stLabel(i.status)+'</span>';
    actions='<button class="a-btn a-btn-sec" onclick="reagendarIdea(\''+safe(i.id)+'\',event)">📅 Reagendar</button>'+
            '<button class="a-btn a-btn-go" onclick="advanceTo(\''+safe(i.id)+'\',\'Publicado\',event)">✓ Publiquei</button>';
  } else if(mode==='gravar'){
    var pub=i.scheduledDate?('publica '+fmtDate(i.scheduledDate)):'sem data de publicação';
    var rot=i.roteiro?' · roteiro ●':' · sem roteiro';
    meta=pilar+'<span>'+fmtsOf(i).map(safe).join(', ')+' · '+pub+rot+'</span>';
    actions='<button class="a-btn a-btn-sec" onclick="openRoteiro(\''+safe(i.id)+'\',event)">'+(i.roteiro?'📖 Roteiro':'✍️ Escrever roteiro')+'</button>'+
            '<button class="a-btn a-btn-go" onclick="advanceTo(\''+safe(i.id)+'\',\'Editando\',event)">✓ Gravei</button>';
  } else { /* publicar */
    extra=(i.status==='Pronto')
      ?'<span class="badge-pronto">✅ Pronto</span>'
      :'<span class="badge-alerta">⚠ '+stLabel(i.status)+'</span>';
    meta=pilar+'<span>'+fmtsOf(i).map(safe).join(', ')+' · '+platsOf(i).map(safe).join(', ')+'</span>';
    actions='<button class="a-btn a-btn-sec" onclick="copyLegenda(\''+safe(i.id)+'\',event)">📋 Legenda</button>'+
            '<button class="a-btn a-btn-go" onclick="advanceTo(\''+safe(i.id)+'\',\'Publicado\',event)">✓ Publiquei</button>';
  }
  return '<div class="acard'+(mode==='late'?' acard-late':'')+'" onclick="openModal(\''+safe(i.id)+'\')">'+flag+
    '<div class="acard-title">'+safe(i.title)+(extra?' '+extra:'')+'</div>'+
    '<div class="acard-meta">'+meta+'</div>'+
    '<div class="acard-actions">'+actions+'</div>'+
  '</div>';
}
function erowHTML(i){
  return '<div class="erow" onclick="openModal(\''+safe(i.id)+'\')">'+
    '<span class="erow-dot"></span>'+
    '<span class="erow-title">'+safe(i.title)+'</span>'+
    '<span class="erow-date">'+(i.scheduledDate?('publica '+fmtDate(i.scheduledDate)):'sem data')+'</span>'+
    '<button class="erow-done" onclick="advanceTo(\''+safe(i.id)+'\',\'Pronto\',event)">✓ Editado</button>'+
  '</div>';
}

/* ── Herói mobile: a próxima ação ── */
function heroHTML(d){
  var t=todayISO(), i=null, verb='', actions='';
  if(d.atrasados.length){ i=d.atrasados[0]; verb='⚠️ Resolver:';
    actions='<button class="h-btn h-btn-ghost" onclick="reagendarIdea(\''+safe(i.id)+'\',event)">📅 Reagendar</button>'+
            '<button class="h-btn h-btn-go" onclick="advanceTo(\''+safe(i.id)+'\',\'Publicado\',event)">✓ Publiquei</button>';
  } else if(d.publicar.length){ i=d.publicar[0]; verb='📤 Publicar:';
    actions='<button class="h-btn h-btn-ghost" onclick="copyLegenda(\''+safe(i.id)+'\',event)">📋 Legenda</button>'+
            '<button class="h-btn h-btn-go" onclick="advanceTo(\''+safe(i.id)+'\',\'Publicado\',event)">✓ Publiquei</button>';
  } else if(d.gravar.length){ i=d.gravar[0]; verb='🎬 Gravar:';
    actions='<button class="h-btn h-btn-ghost" onclick="openRoteiro(\''+safe(i.id)+'\',event)">📖 Roteiro</button>'+
            '<button class="h-btn h-btn-go" onclick="advanceTo(\''+safe(i.id)+'\',\'Editando\',event)">✓ Gravei</button>';
  } else if(d.editando.length){ i=d.editando[0]; verb='✂️ Editar:';
    actions='<button class="h-btn h-btn-go" onclick="advanceTo(\''+safe(i.id)+'\',\'Pronto\',event)">✓ Editado</button>';
  } else {
    var st=storiesFor(t).filter(function(s){return !s.done;});
    if(st.length){
      return '<div class="hero" onclick="setView(\'stories\')"><div class="hero-lbl">⭐ Próxima ação</div>'+
        '<div class="hero-title"><span class="verb">📱 Story:</span> '+safe(st[0].texto)+'</div>'+
        '<div class="hero-meta">'+st.length+' storie'+(st.length>1?'s':'')+' pendente'+(st.length>1?'s':'')+' hoje</div></div>';
    }
    return '';
  }
  var cat=catsOf(i)[0]||'';
  var meta=[cat,fmtsOf(i).map(safe).join(', '),i.scheduledDate?('publica '+fmtDate(i.scheduledDate)):''].filter(Boolean).join(' · ');
  return '<div class="hero" onclick="openModal(\''+safe(i.id)+'\')">'+
    '<div class="hero-lbl">⭐ Próxima ação</div>'+
    '<div class="hero-title"><span class="verb">'+verb+'</span> '+safe(i.title)+'</div>'+
    '<div class="hero-meta">'+safe(meta)+'</div>'+
    '<div class="hero-actions">'+actions+'</div>'+
  '</div>';
}

/* ── Render do painel Hoje ── */
function renderHoje(){
  var el=document.getElementById('hoje-view'); if(!el) return;
  var t=todayISO(), d=hojeData(), today=new Date();
  var dateLbl=cap(DAYS_PT[today.getDay()])+', '+today.getDate()+' de '+MONTHS[today.getMonth()].toLowerCase();
  var stHoje=storiesFor(t);

  var parts=[];
  if(d.gravar.length)   parts.push('<b>'+d.gravar.length+' gravaç'+(d.gravar.length>1?'ões':'ão')+'</b>');
  if(d.publicar.length) parts.push('<b>'+d.publicar.length+' publicaç'+(d.publicar.length>1?'ões':'ão')+'</b>');
  if(stHoje.length)     parts.push('<b>'+stHoje.length+' storie'+(stHoje.length>1?'s':'')+'</b>');
  if(d.atrasados.length)parts.push('<b class="hj-late-txt">'+d.atrasados.length+' atrasado'+(d.atrasados.length>1?'s':'')+'</b>');
  var resume=parts.length?('☀️ Hoje: '+parts.join(' · ')):'☀️ Dia livre — nada programado para hoje.';

  var html=
    '<div class="hj-hdr">'+
      '<div>'+
        '<div class="hj-kicker">Centro de comando</div>'+
        '<div class="hj-date">'+dateLbl+'</div>'+
        '<div class="hj-resume">'+resume+'</div>'+
      '</div>'+
      '<button class="hj-nova" onclick="openModal(null)">＋ Nova ideia</button>'+
    '</div>';

  html+=heroHTML(d);

  html+='<div class="hj-zones">';

  /* ZONA 1 — O que eu faço hoje */
  html+='<section class="hj-zone hj-zone-hoje"><div class="hj-zone-title">O que eu faço hoje</div>';
  if(d.atrasados.length){
    html+='<div class="sec">';
    for(var a=0;a<d.atrasados.length;a++) html+=acardHTML(d.atrasados[a],'late');
    html+='</div>';
  }
  html+='<div class="sec sec-drop" ondragover="dragOverZ(event)" ondragleave="dragLeaveZ(event)" ondrop="dropOn(event,\'gravar\')">'+
    '<div class="sec-hdr"><span class="ico">🎬</span><h2>Gravar hoje</h2><span class="cnt">'+d.gravar.length+'</span></div>';
  if(!d.gravar.length) html+='<div class="sec-empty">Nada para gravar hoje — arraste uma ideia do banco ou use ⤴ para promover.</div>';
  for(var g=0;g<d.gravar.length;g++) html+=acardHTML(d.gravar[g],'gravar');
  html+='</div>';
  html+='<div class="sec"><div class="sec-hdr"><span class="ico">📤</span><h2>Publicar hoje</h2><span class="cnt">'+d.publicar.length+'</span></div>';
  if(!d.publicar.length) html+='<div class="sec-empty">Nenhuma publicação agendada para hoje.</div>';
  for(var p=0;p<d.publicar.length;p++) html+=acardHTML(d.publicar[p],'publicar');
  html+='</div>';
  if(d.editando.length){
    html+='<div class="sec"><div class="sec-hdr"><span class="ico">✂️</span><h2>Em edição</h2><span class="cnt">'+d.editando.length+'</span></div>';
    for(var e=0;e<d.editando.length;e++) html+=erowHTML(d.editando[e]);
    html+='</div>';
  }
  html+='</section>';

  /* ZONA 2 — Stories */
  var tm=addDaysISO(t,1);
  html+='<section class="hj-zone hj-zone-stories"><div class="hj-zone-title">📱 Stories</div>'+
    '<div class="stories-box sec-drop" ondragover="dragOverZ(event)" ondragleave="dragLeaveZ(event)" ondrop="dropOn(event,\'story\')">'+
      storiesBlockHTML(t,'Hoje')+
      '<button class="stories-bank-btn" onclick="bankFromStories()">⤵ trazer do banco de ideias</button>'+
      '<div class="stories-tmr">'+storiesBlockHTML(tm,'Amanhã')+'</div>'+
    '</div>'+
  '</section>';

  /* ZONA 3 — Próximos dias */
  html+='<section class="hj-zone hj-zone-next">';
  var tmIt=nextDayItems(tm);
  var tmParts=[];
  for(var x=0;x<tmIt.pubs.length;x++)  tmParts.push(safe(tmIt.pubs[x].title));
  for(var y=0;y<tmIt.gravs.length;y++) tmParts.push('gravar '+safe(tmIt.gravs[y].title));
  if(tmIt.st) tmParts.push(tmIt.st+' storie'+(tmIt.st>1?'s':''));
  html+='<div class="nd-mobile-line" onclick="setView(\'cal\')">📅 <b>Amanhã:</b>&nbsp;<span class="nd-ml-txt">'+(tmParts.length?tmParts.join(' · '):'nada planejado')+'</span><span class="arrow">›</span></div>';
  html+='<div class="nd-full"><div class="hj-zone-title">Próximos dias</div>';
  for(var k=1;k<=4;k++){
    var dt=addDaysISO(t,k), it=nextDayItems(dt);
    html+='<div class="nd-day sec-drop" ondragover="dragOverZ(event)" ondragleave="dragLeaveZ(event)" ondrop="dropOn(event,\'day\',\''+dt+'\')">'+
      '<div class="nd-lbl" onclick="openDayModal(\''+dt+'\')"><b>'+safe(dayLabel(dt))+'</b></div>';
    var has=false;
    for(var p2=0;p2<it.pubs.length;p2++){ has=true; html+='<div class="nd-card" onclick="openModal(\''+safe(it.pubs[p2].id)+'\')"><span class="nd-ico">📤</span><span class="nd-title">'+safe(it.pubs[p2].title)+'</span></div>'; }
    for(var g2=0;g2<it.gravs.length;g2++){ has=true; html+='<div class="nd-card" onclick="openModal(\''+safe(it.gravs[g2].id)+'\')"><span class="nd-ico">🎬</span><span class="nd-title">Gravar: '+safe(it.gravs[g2].title)+'</span></div>'; }
    if(it.st){ has=true; html+='<div class="nd-card nd-card-st" onclick="setView(\'stories\')"><span class="nd-ico">📱</span><span class="nd-title">'+it.st+' storie'+(it.st>1?'s':'')+' planejado'+(it.st>1?'s':'')+'</span></div>'; }
    if(!has) html+='<div class="nd-empty">nada planejado · <button onclick="openDayModal(\''+dt+'\')">+ planejar</button></div>';
    html+='</div>';
  }
  if(d.prontos.length){
    html+='<div class="nd-alert">⚠️ <b>'+d.prontos.length+' conteúdo'+(d.prontos.length>1?'s':'')+' pronto'+(d.prontos.length>1?'s':'')+' sem data.</b> '+
      '<button onclick="pipeGo(\'Pronto\')">agendar agora</button></div>';
  }
  html+='</div></section>';

  html+='</div>'; /* /hj-zones */
  el.innerHTML=html;
}

/* ── Menu Promover (⤴) ── */
function openPromo(id,ev){
  if(ev){ ev.stopPropagation(); ev.preventDefault(); }
  var i=byIdIdea(id); if(!i) return;
  promoIdeaId=id;
  var m=document.getElementById('promo-menu');
  m.innerHTML='<div class="promo-title">'+safe(i.title)+'</div>'+
    '<button class="promo-opt" onclick="promoAction(\'gravar\')">🎬 Gravar hoje</button>'+
    '<button class="promo-opt" onclick="promoAction(\'story\')">📱 Virar story de hoje</button>'+
    '<button class="promo-opt" onclick="promoAction(\'amanha\')">📤 Publicar amanhã</button>'+
    '<button class="promo-opt" onclick="promoAction(\'data\')">📅 Escolher data…</button>'+
    '<button class="promo-cancel" onclick="closePromo()">Cancelar</button>';
  document.getElementById('promo-bg').classList.add('open');
}
function closePromo(){
  promoIdeaId=null;
  document.getElementById('promo-bg').classList.remove('open');
}
function promoAction(act){
  var id=promoIdeaId, i=byIdIdea(id);
  if(!i){ closePromo(); return; }
  var t=todayISO();
  if(act==='gravar'){
    i.gravarDate=t;
    if(i.status==='Nao Iniciado') i.status='Fila de Gravacao';
    persistIdea(i); showToast('🎬 Na pauta de gravação de hoje!');
  } else if(act==='story'){
    addStory(t,i.title,i.id); showToast('📱 Story de hoje adicionado!');
  } else if(act==='amanha'){
    i.scheduledDate=addDaysISO(t,1);
    persistIdea(i); showToast('📤 Publicação marcada para amanhã');
  } else if(act==='data'){
    closePromo(); reagendarIdea(id); return;
  }
  closePromo(); render();
}

/* ── Banco de ideias (gaveta desktop) ── */
function toggleBank(){ document.getElementById('bank-drawer').classList.toggle('open'); }
function setBankCat(c){ bankCat=c; buildBank(); }
function bankFromStories(){
  if(isDesktop()){
    var dEl=document.getElementById('bank-drawer');
    if(dEl) dEl.classList.add('open');
    buildBank();
    showToast('Arraste uma ideia para os Stories ou use ⤴');
  } else {
    pipeGo('Nao Iniciado');
    showToast('Toque em ⤴ numa ideia para promover');
  }
}
function buildBank(){
  var grid=document.getElementById('bank-grid'); if(!grid) return;
  var all=ideas.filter(function(i){ return i.status==='Nao Iniciado'; });
  var cntEl=document.getElementById('bank-cnt');
  if(cntEl) cntEl.textContent=all.length+' ideia'+(all.length!==1?'s':'');
  var chipsEl=document.getElementById('bank-chips');
  if(chipsEl){
    var cats=allCats();
    if(bankCat!=='todos' && cats.indexOf(bankCat)===-1) bankCat='todos';
    var ch='<button class="bank-chip'+(bankCat==='todos'?' on':'')+'" onclick="setBankCat(\'todos\')">Todos</button>';
    for(var c=0;c<cats.length;c++)
      ch+='<button class="bank-chip'+(bankCat===cats[c]?' on':'')+'" onclick="setBankCat(\''+safe(cats[c])+'\')">'+safe(cats[c])+'</button>';
    chipsEl.innerHTML=ch;
  }
  var list=(bankCat==='todos')?all:all.filter(function(i){ return catsOf(i).indexOf(bankCat)!==-1; });
  var h='';
  if(!list.length) h='<div class="bank-empty">Nenhuma ideia aqui ainda — crie em ＋ Nova Ideia.</div>';
  for(var k=0;k<list.length;k++){
    var i=list[k], cat=catsOf(i)[0]||'';
    h+='<div class="bcard" draggable="true" ondragstart="bankDrag(event,\''+safe(i.id)+'\')" onclick="openModal(\''+safe(i.id)+'\')">'+
      '<div class="bcard-title">'+safe(i.title)+'</div>'+
      '<div class="bcard-foot">'+(cat?'<span class="pilar">'+safe(cat)+'</span>':'')+
      '<button class="bcard-promote" title="Promover" onclick="openPromo(\''+safe(i.id)+'\',event)">⤴</button></div>'+
    '</div>';
  }
  grid.innerHTML=h;
}

/* ── Drag-and-drop banco → painel ── */
function bankDrag(ev,id){
  ev.dataTransfer.setData('text/plain',id);
  ev.dataTransfer.effectAllowed='move';
}
function dragOverZ(ev){ ev.preventDefault(); ev.currentTarget.classList.add('drop-on'); }
function dragLeaveZ(ev){ ev.currentTarget.classList.remove('drop-on'); }
function dropOn(ev,kind,arg){
  ev.preventDefault();
  ev.currentTarget.classList.remove('drop-on');
  var id=ev.dataTransfer.getData('text/plain'); if(!id) return;
  var i=byIdIdea(id); if(!i) return;
  var t=todayISO();
  if(kind==='gravar'){
    i.gravarDate=t;
    if(i.status==='Nao Iniciado') i.status='Fila de Gravacao';
    persistIdea(i); showToast('🎬 Na pauta de gravação de hoje!');
  } else if(kind==='story'){
    addStory(t,i.title,i.id); showToast('📱 Story de hoje adicionado!');
  } else if(kind==='day'){
    i.scheduledDate=arg;
    persistIdea(i); showToast('📅 Publicação agendada para '+fmtDate(arg));
  }
  render();
}

/* ============================================================
   MODAL — idea
   ============================================================ */
var FMT_OPTS=['Reels','Carrossel','Stories','Feed'];

// Seletores do editor (Temas, Plataforma, Formato) como dropdowns multiseleção
function buildEditorDDs(){
  var cats=allCats(), plats=allPlats();
  var catEl=document.getElementById('cat-dd');
  var plEl =document.getElementById('pl-dd');
  var fmtEl=document.getElementById('fmt-dd');
  if(catEl) catEl.innerHTML=ddHtml('dd-edCat','edCat','Temas',cats.map(function(c){return {value:c,label:c};}),fCats,{allowClear:false});
  if(plEl)  plEl.innerHTML =ddHtml('dd-edPlat','edPlat','Plataformas',plats.map(function(p){return {value:p,label:p};}),fPlats,{allowClear:false});
  if(fmtEl) fmtEl.innerHTML=ddHtml('dd-edFmt','edFmt','Formato',FMT_OPTS.map(function(f){return {value:f,label:f};}),fFmts,{allowClear:false});
  applyDDOpen();
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
  document.getElementById('f-date').value=idea?(idea.scheduledDate||''):'';
  document.getElementById('f-gravar').value=idea?(idea.gravarDate||''):'';
  document.getElementById('new-cat-inp').value='';
  document.getElementById('btn-del').style.display=idea?'block':'none';
  fCats = idea ? catsOf(idea).slice() : (fCats.length?fCats:[CATS[0]]);
  fFmts = idea ? fmtsOf(idea).slice() : ['Reels'];
  fSt   = idea ? (idea.status||'Nao Iniciado') : 'Nao Iniciado';
  fPlats= idea ? platsOf(idea).slice() : (curPlats.length?[curPlats[0]]:['Instagram']);
  // Preenche editores ricos com dados da ideia
  setRteHtml('rte-roteiro', idea?(idea.roteiro||''):'');
  setRteHtml('rte-legenda', idea?(idea.legenda||''):'');
  setRteHtml('rte-notas',   idea?(idea.notes||''):'');
  switchRteTab('roteiro');
  buildEditorDDs(); syncStBtns();
  // Restaura rascunho salvo automaticamente (sobrescreve dados acima se houver)
  var restored = restoreDraft(id);
  if(restored){ buildEditorDDs(); syncStBtns(); showToast('Rascunho restaurado ✓'); }
  _openDD=null;
  document.getElementById('modal-bg').classList.add('open');
  setTimeout(function(){document.getElementById('f-title').focus();},320);
}
function closeModal(){ _openDD=null; applyDDOpen(); document.getElementById('modal-bg').classList.remove('open'); }

function saveIdea(){
  var title=document.getElementById('f-title').value.trim();
  if(!title){showToast('Coloca um titulo!');document.getElementById('f-title').focus();return;}
  if(!fPlats.length){showToast('Escolhe pelo menos uma plataforma!');return;}
  if(!fCats.length){showToast('Escolhe pelo menos um tema!');return;}
  if(!fFmts.length){showToast('Escolhe pelo menos um formato!');return;}
  var roteiro=getRteHtml('rte-roteiro');
  var legenda=getRteHtml('rte-legenda');
  var notas  =getRteHtml('rte-notas');
  var sdate=document.getElementById('f-date').value||'';
  var gdate=document.getElementById('f-gravar').value||'';
  if(editId){
    for(var i=0;i<ideas.length;i++){
      if(ideas[i].id===editId){
        ideas[i].title=title; ideas[i].categories=fCats.slice(); ideas[i].formatos=fFmts.slice();
        ideas[i].status=fSt; ideas[i].notes=notas; ideas[i].roteiro=roteiro; ideas[i].legenda=legenda;
        ideas[i].platforms=fPlats.slice(); ideas[i].scheduledDate=sdate; ideas[i].gravarDate=gdate;
        break;
      }
    }
    showToast('Ideia atualizada!');
  } else {
    ideas.unshift({id:uid(),title:title,categories:fCats.slice(),formatos:fFmts.slice(),status:fSt,
      notes:notas,roteiro:roteiro,legenda:legenda,platforms:fPlats.slice(),scheduledDate:sdate,
      gravarDate:gdate,createdAt:new Date().toISOString()});
    showToast('Ideia salva!');
  }
  var syncIdea = editId ? ideas.find(function(i){return i.id===editId;}) : ideas[0];
  clearDraft(); saveIdeas(); closeModal(); render();
  if(syncIdea && typeof DB !== 'undefined' && !window._SB_ERROR)
    DB.conteudo.upsert(syncIdea).catch(function(){});
}
function deleteIdea(){
  if(!editId) return; if(!confirm('Excluir essa ideia?')) return;
  var delId = editId;
  ideas=ideas.filter(function(i){return i.id!==delId;});
  clearDraft(); saveIdeas(); closeModal(); render(); showToast('Ideia excluida');
  if(typeof DB !== 'undefined' && !window._SB_ERROR)
    DB.conteudo.delete(delId).catch(function(){});
}
function addCustomCat(){
  var inp=document.getElementById('new-cat-inp'),name=inp.value.trim(); if(!name){inp.focus();return;}
  var cats=allCats(),lower=name.toLowerCase();
  for(var i=0;i<cats.length;i++){if(cats[i].toLowerCase()===lower){if(fCats.indexOf(cats[i])===-1)fCats.push(cats[i]);inp.value='';buildEditorDDs();return;}}
  customCats.push(name); saveCats(); fCats.push(name); inp.value=''; buildEditorDDs(); showToast('Tema criado!');
}

/* ============================================================
   MODO GRAVAÇÃO
   ============================================================ */
var gravFontSize = 1.5;

function openGravacao(){
  var idea = editId ? ideas.find(function(i){return i.id===editId;}) : null;
  var roteiro = getRteHtml('rte-roteiro') || (idea&&idea.roteiro) || '';
  var body = document.getElementById('gravacao-body');
  if(!roteiro){
    body.innerHTML = '<p style="opacity:.4;font-size:1rem">Nenhum roteiro escrito ainda.<br>Escreva na aba Roteiro e volte aqui.</p>';
  } else {
    body.innerHTML = roteiro;
  }
  if(idea) document.getElementById('grav-title-lbl').textContent = idea.title || 'Modo Gravação';
  body.style.fontSize = gravFontSize + 'rem';
  document.getElementById('gravacao-bg').classList.add('open');
}
function closeGravacao(){
  document.getElementById('gravacao-bg').classList.remove('open');
}
function increaseFontGrav(){
  gravFontSize = Math.min(3.2, +(gravFontSize + 0.15).toFixed(2));
  document.getElementById('gravacao-body').style.fontSize = gravFontSize + 'rem';
}
function decreaseFontGrav(){
  gravFontSize = Math.max(0.9, +(gravFontSize - 0.15).toFixed(2));
  document.getElementById('gravacao-body').style.fontSize = gravFontSize + 'rem';
}

/* ============================================================
   MODO TELEPROMPTER
   ============================================================ */
var tpInterval = null;
var tpPlaying  = false;
var tpMirrored = false;
var tpSpeed    = 3;
var tpFontSize = 1.6;

function openTeleprompter(){
  var idea = editId ? ideas.find(function(i){return i.id===editId;}) : null;
  var roteiro = getRteHtml('rte-roteiro') || (idea&&idea.roteiro) || '';
  var body = document.getElementById('tp-body');
  if(!roteiro){
    body.innerHTML = '<p style="opacity:.35;font-size:1rem">Nenhum roteiro escrito ainda.</p>';
  } else {
    body.innerHTML = roteiro;
  }
  body.scrollTop = 0;
  body.style.fontSize = tpFontSize + 'rem';
  tpPlaying = false;
  tpMirrored = false;
  updateTpMirror();
  var playBtn = document.getElementById('tp-play-btn');
  if(playBtn) playBtn.textContent = '▶';
  var speedEl = document.getElementById('tp-speed');
  if(speedEl) speedEl.value = tpSpeed;
  // Fecha gravação se estiver aberta
  closeGravacao();
  document.getElementById('tp-bg').classList.add('open');
}
function closeTeleprompter(){
  stopTpScroll();
  if(document.fullscreenElement) document.exitFullscreen().catch(function(){});
  document.getElementById('tp-bg').classList.remove('open');
}
function toggleTpPlay(){
  tpPlaying = !tpPlaying;
  var btn = document.getElementById('tp-play-btn');
  if(tpPlaying){ if(btn) btn.textContent='⏸'; startTpScroll(); }
  else          { if(btn) btn.textContent='▶'; stopTpScroll(); }
}
function startTpScroll(){
  if(tpInterval) clearInterval(tpInterval);
  tpInterval = setInterval(function(){
    var el = document.getElementById('tp-body'); if(!el) return;
    el.scrollTop += tpSpeed * 0.4;
    if(el.scrollTop + el.clientHeight >= el.scrollHeight - 4){
      stopTpScroll(); tpPlaying=false;
      var btn=document.getElementById('tp-play-btn'); if(btn) btn.textContent='▶';
    }
  }, 40);
}
function stopTpScroll(){
  if(tpInterval){ clearInterval(tpInterval); tpInterval=null; }
}
function setTpSpeed(v){
  tpSpeed = parseInt(v);
}
function toggleTpMirror(){
  tpMirrored = !tpMirrored;
  updateTpMirror();
}
function updateTpMirror(){
  var body = document.getElementById('tp-body');
  if(body) body.style.transform = tpMirrored ? 'scaleX(-1)' : '';
  var btn = document.getElementById('tp-mirror-btn');
  if(btn) btn.classList.toggle('on', tpMirrored);
}
function increaseTpFont(){
  tpFontSize = Math.min(4, +(tpFontSize + 0.15).toFixed(2));
  document.getElementById('tp-body').style.fontSize = tpFontSize + 'rem';
}
function decreaseTpFont(){
  tpFontSize = Math.max(0.9, +(tpFontSize - 0.15).toFixed(2));
  document.getElementById('tp-body').style.fontSize = tpFontSize + 'rem';
}
function toggleTpFullscreen(){
  var el = document.getElementById('tp-bg');
  if(!document.fullscreenElement){
    (el.requestFullscreen||el.webkitRequestFullscreen||function(){}).call(el);
  } else {
    (document.exitFullscreen||document.webkitExitFullscreen||function(){}).call(document);
  }
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
   ACERVO — BANCO DE MATÉRIA-PRIMA
   ============================================================ */
var materiais   = [];      // lotes de mídia (Supabase + cache local)
var acvDetailId = null;    // material aberto no modal de detalhe
var acvDraft    = null;    // material em edição no modal de captura
var acvBusy     = false;   // trava durante upload/garimpo
var acvUrlCache = {};      // path -> URL assinada (cache de sessão)
var acvErrors   = {};      // id do material -> última mensagem de erro do garimpo
var MAT_KEY     = 'mk_content_materiais';

var OBJETIVOS = {
  'Autoridade':     {emoji:'🟣', cor:'#7d3c6e', bg:'#f5edf3'},
  'Relacionamento': {emoji:'🩷', cor:'#c2185b', bg:'#fce4ec'},
  'Engajamento':    {emoji:'🟠', cor:'#e07b00', bg:'#fff4e5'},
  'Venda':          {emoji:'🟢', cor:'#2d7d3a', bg:'#e8f5e9'}
};
var OBJ_KEYS      = ['Autoridade','Relacionamento','Engajamento','Venda'];
var FORMATOS_ALL  = ['Reels','Stories','Carrossel','Post'];
var FMT_EMOJI     = {'Reels':'🎬','Stories':'📱','Carrossel':'🖼️','Post':'🟦'};
var TIPOS_MIDIA   = [
  {v:'final',         lbl:'Foto final',    emoji:'📸'},
  {v:'bastidor',      lbl:'Bastidor',      emoji:'🎬'},
  {v:'transformacao', lbl:'Transformação', emoji:'✨'},
  {v:'depoimento',    lbl:'Depoimento',    emoji:'🗣️'}
];

/* ── helpers ── */
function _matIndex(id){ for(var i=0;i<materiais.length;i++) if(materiais[i].id===id) return i; return -1; }
function _matById(id){ var i=_matIndex(id); return i>=0?materiais[i]:null; }
function _todayISO(){ var d=new Date(); var m=String(d.getMonth()+1); var dd=String(d.getDate()); return d.getFullYear()+'-'+(m.length<2?'0'+m:m)+'-'+(dd.length<2?'0'+dd:dd); }
function tipoLabel(v){ for(var i=0;i<TIPOS_MIDIA.length;i++) if(TIPOS_MIDIA[i].v===v) return TIPOS_MIDIA[i].lbl; return 'foto'; }
function tipoEmoji(v){ for(var i=0;i<TIPOS_MIDIA.length;i++) if(TIPOS_MIDIA[i].v===v) return TIPOS_MIDIA[i].emoji; return '📸'; }
function acvOrigemLabel(m){
  var map={noiva:'💍 Noiva',cliente:'👤 Cliente',orcamento:'🧾 Orçamento',livre:'📁 Geral'};
  return m.origemRef ? safe(m.origemRef) : (map[m.origemTipo]||map.livre);
}
function acvOrigemPlain(m){ var map={noiva:'Noiva',cliente:'Cliente',orcamento:'Orçamento',livre:'Geral'}; return (map[m.origemTipo]||'Geral')+(m.origemRef?(' — '+m.origemRef):''); }
function thumbUrl(a){ var p=a&&(a.thumbPath||a.path); return (p&&acvUrlCache[p])||''; }

/* ── exploração ── */
function ideiasDoMaterial(id){ return ideas.filter(function(i){ return i.materialId===id; }); }
function formatosExplorados(m){
  var set={};
  ideiasDoMaterial(m.id).forEach(function(i){ (i.formatos||[]).forEach(function(f){ set[f]=1; }); });
  (m.sugestoes||[]).forEach(function(s){ if(s.status==='planejada'&&s.formato) set[s.formato]=1; });
  return set;
}
function sugPendentes(m){ return (m.sugestoes||[]).filter(function(s){ return s.status==='pendente'; }); }
function materialEsgotado(m){
  var exp=formatosExplorados(m);
  var todos=true; for(var i=0;i<FORMATOS_ALL.length;i++) if(!exp[FORMATOS_ALL[i]]) todos=false;
  return todos && !sugPendentes(m).length;
}

/* ── camada estratégica (Brand Brain) ── */
function brandPilares(){ return (window.BRAND&&BRAND.pilares)||[]; }
function pilarDeTexto(txt){
  var t=String(txt||'').toLowerCase(), ps=brandPilares();
  for(var i=0;i<ps.length;i++){ for(var j=0;j<ps[i].aliases.length;j++){ if(t.indexOf(ps[i].aliases[j])!==-1) return ps[i].nome; } }
  return null;
}
function pilarToCat(pilar){
  var map={'Noivas Premium':'Noivas','Cachos e Crespos':'Cachos e Crespos','Pele Negra':'Maquiagem Profissional','Autoridade Técnica':'Maquiagem Profissional','Humanização':'Vida e Lifestyle'};
  return map[pilar] || CATS[0];
}
// Resumo do que já foi publicado por pilar + lacunas (entra no prompt do garimpo)
function brandContentState(){
  var ps=brandPilares(); if(!ps.length) return '';
  var pub={}, total=0; ps.forEach(function(p){ pub[p.nome]=0; });
  ideas.forEach(function(i){
    if(i.status!=='Publicado') return;
    var pn=pilarDeTexto((i.categories||[]).join(' ')+' '+(i.title||''));
    if(pn){ pub[pn]++; total++; }
  });
  var linhas=ps.map(function(p){
    var n=pub[p.nome]||0, pct=total?Math.round(n/total*100):0;
    var dir = pct < p.peso-7 ? '⚠ ABAIXO do ideal (LACUNA)' : (pct > p.peso+10 ? 'acima do ideal' : 'ok');
    return '- '+p.nome+': '+n+' publicados ('+pct+'% vs ideal '+p.peso+'%) — '+dir;
  });
  var fila=ideas.filter(function(i){ return i.status!=='Publicado'; }).length;
  return 'ESTADO ATUAL DO CONTEÚDO (publicados='+total+', em produção/fila='+fila+'):\n'+
    linhas.join('\n')+'\nQuando o material permitir, PRIORIZE os pilares marcados como LACUNA.';
}

/* ── persistência ── */
function readMateriaisLS(){ try{ materiais=JSON.parse(localStorage.getItem(MAT_KEY)||'[]')||[]; }catch(e){ materiais=[]; } }
function saveMateriaisLS(){ try{ localStorage.setItem(MAT_KEY, JSON.stringify(materiais)); }catch(e){} }
function persistMaterial(m){
  saveMateriaisLS();
  if(m && typeof DB!=='undefined' && DB.materiais && !window._SB_ERROR) DB.materiais.upsert(m).catch(function(){});
}
function loadMateriais(){
  readMateriaisLS();
  if(curView==='acervo') renderAcervo();
  updateAcvBadge();
  if(typeof DB==='undefined' || !DB.materiais || window._SB_ERROR) return;
  DB.materiais.list().then(function(data){
    var ids={}; for(var i=0;i<data.length;i++) ids[data[i].id]=true;
    var localOnly=materiais.filter(function(m){ return !ids[m.id]; });
    materiais=data.concat(localOnly);
    for(var j=0;j<localOnly.length;j++){ (function(m){ DB.materiais.upsert(m).catch(function(){}); })(localOnly[j]); }
    saveMateriaisLS();
    updateAcvBadge();
    signAllThumbs().then(function(){ if(curView==='acervo') renderAcervo(); });
  }).catch(function(){});
}

/* ── URLs assinadas ── */
function signAllThumbs(){
  if(typeof DB==='undefined' || !DB.storage || !DB.storage.signMaterials || window._SB_ERROR) return Promise.resolve(false);
  var paths=[], seen={};
  materiais.forEach(function(m){ (m.assets||[]).forEach(function(a){ var p=a.thumbPath||a.path; if(p && !acvUrlCache[p] && !seen[p]){ seen[p]=1; paths.push(p); } }); });
  if(!paths.length) return Promise.resolve(false);
  return DB.storage.signMaterials(paths,3600).then(function(map){
    var keys=Object.keys(map); keys.forEach(function(p){ acvUrlCache[p]=map[p]; });
    return keys.length>0;
  }).catch(function(){ return false; });
}

/* ── badge da nav ── */
function updateAcvBadge(){
  var n=0; materiais.forEach(function(m){ n+=sugPendentes(m).length; });
  var b=document.getElementById('acv-nav-badge'); if(b){ b.textContent=n?String(n):''; b.style.display=n?'':'none'; }
}

/* ── render principal ── */
function renderAcervo(){
  var el=document.getElementById('acervo-view'); if(!el) return;
  signAllThumbs().then(function(fetched){ if(fetched && curView==='acervo') renderAcervo(); });
  var naoExpl=0, totalSug=0;
  materiais.forEach(function(m){ if(!materialEsgotado(m)) naoExpl++; totalSug+=sugPendentes(m).length; });
  var hero='<div class="acv-hero">'+
      '<div class="acv-hero-txt">Você tem <b>'+materiais.length+'</b> material'+(materiais.length!==1?'is':'')+
        ' · <b>'+naoExpl+'</b> com potencial não explorado → <b>'+totalSug+'</b> ideia'+(totalSug!==1?'s':'')+
        ' pronta'+(totalSug!==1?'s':'')+' para virar post.</div>'+
      '<button class="acv-hero-btn" onclick="openMaterialModal(null)">+ Novo material</button>'+
    '</div>';
  el.innerHTML=hero+'<div class="acv-cols">'+
      '<div class="acv-col-acervo">'+renderAcervoGrid()+'</div>'+
      '<div class="acv-col-opps">'+renderOportunidades()+'</div>'+
    '</div>';
}
function renderAcervoGrid(){
  if(!materiais.length){
    return '<div class="acv-empty">'+
        '<div class="acv-empty-emoji">🎞️</div>'+
        '<div class="acv-empty-tit">Seu acervo está vazio</div>'+
        '<div class="acv-empty-sub">Suba fotos, bastidores e vídeos de um atendimento e deixe a IA achar o que dá pra postar.</div>'+
        '<button class="acv-hero-btn" onclick="openMaterialModal(null)">+ Criar primeiro material</button>'+
      '</div>';
  }
  var cards=materiais.map(function(m){
    var exp=formatosExplorados(m);
    var chips=FORMATOS_ALL.map(function(f){
      var on=!!exp[f];
      return '<span class="acv-chip'+(on?' on':'')+'" title="'+(on?'já explorado':'não explorado')+'">'+FMT_EMOJI[f]+' '+f+'</span>';
    }).join('');
    var a0=(m.assets||[])[0], u=a0?thumbUrl(a0):'';
    var thumb=a0
      ? (u?'<img class="acv-card-thumb" src="'+safe(u)+'" alt="" loading="lazy">':'<div class="acv-card-thumb acv-ph">'+(a0.kind==='video'?'🎬':'🖼️')+'</div>')
      : '<div class="acv-card-thumb acv-ph">＋</div>';
    var nMid=(m.assets||[]).length, pend=sugPendentes(m).length;
    var foot=pend
      ? '<span class="acv-restantes">⚡ '+pend+' oportunidade'+(pend!==1?'s':'')+'</span>'
      : (materialEsgotado(m) ? '<span class="acv-esgotado">✓ esgotado</span>'
         : '<button class="acv-garimpar-mini" onclick="garimpar(\''+safe(m.id)+'\',event)">⛏️ Garimpar</button>');
    return '<div class="acv-card" onclick="openMaterialDetail(\''+safe(m.id)+'\')">'+thumb+
        '<div class="acv-card-body">'+
          '<div class="acv-card-tit">'+safe(m.titulo||'Sem título')+'</div>'+
          '<div class="acv-card-meta">'+acvOrigemLabel(m)+' · '+nMid+' mídia'+(nMid!==1?'s':'')+'</div>'+
          '<div class="acv-chips">'+chips+'</div>'+
          '<div class="acv-card-foot">'+foot+'</div>'+
        '</div></div>';
  }).join('');
  return '<div class="acv-grid">'+cards+'</div>';
}
function renderOportunidades(){
  var items=[];
  materiais.forEach(function(m){ sugPendentes(m).forEach(function(s){ items.push({m:m,s:s}); }); });
  items.sort(function(a,b){ return (b.s.prioridade||0)-(a.s.prioridade||0); });
  var hdr='<div class="acv-opps-hdr">⚡ Oportunidades <span class="acv-opps-cnt">'+items.length+'</span></div>';
  if(!items.length) return hdr+'<div class="acv-opps-empty">Sem oportunidades agora. Abra um material e toque em <b>⛏️ Garimpar</b> para a IA sugerir posts.</div>';
  return hdr+'<div class="acv-opps-list">'+items.map(function(it){ return oppCardHtml(it.m,it.s); }).join('')+'</div>';
}
function prioStars(n){ n=parseInt(n,10)||0; return n?('<span class="acv-prio" title="prioridade '+n+'/5">'+new Array(n+1).join('★')+'</span>'):''; }
function pilarChip(p){ return p?('<span class="acv-opp-pilar">🎯 '+safe(p)+'</span>'):''; }
function alignLine(s){ return s.alinhamento?('<div class="acv-opp-align">🧭 '+safe(s.alinhamento)+'</div>'):''; }
function oppCardHtml(m,s){
  var obj=OBJETIVOS[s.objetivo]||OBJETIVOS.Autoridade;
  return '<div class="acv-opp">'+
      '<div class="acv-opp-tags">'+
        prioStars(s.prioridade)+
        '<span class="acv-opp-fmt">'+(FMT_EMOJI[s.formato]||'')+' '+safe(s.formato)+'</span>'+
        '<span class="acv-opp-obj" style="background:'+obj.bg+';color:'+obj.cor+'">'+obj.emoji+' '+safe(s.objetivo)+'</span>'+
        pilarChip(s.pilar)+
      '</div>'+
      '<div class="acv-opp-tit">'+safe(s.titulo)+'</div>'+
      alignLine(s)+
      '<div class="acv-opp-src">de: '+safe(m.titulo||'material')+'</div>'+
      '<div class="acv-opp-acts">'+
        '<button class="acv-opp-plan" onclick="promoverOportunidade(\''+safe(m.id)+'\',\''+safe(s.id)+'\')">→ Planejar</button>'+
        '<button class="acv-opp-mini" onclick="openMaterialDetail(\''+safe(m.id)+'\')">ver</button>'+
        '<button class="acv-opp-mini" onclick="descartarSugestao(\''+safe(m.id)+'\',\''+safe(s.id)+'\')">✕</button>'+
      '</div></div>';
}
function refreshAcv(){
  updateAcvBadge();
  if(curView==='acervo') renderAcervo();
  if(document.getElementById('acv-detail-bg').classList.contains('open') && acvDetailId) renderMaterialDetail();
}

/* ── modal de captura/edição ── */
function openMaterialModal(id){
  var m=id?_matById(id):null;
  acvDraft = m ? JSON.parse(JSON.stringify(m)) : {
    id:'mat_'+Date.now(), titulo:'', origemTipo:'livre', origemRef:'', data:_todayISO(),
    assets:[], sugestoes:[], status:'novo', createdAt:new Date().toISOString()
  };
  renderMaterialModal();
  document.getElementById('acv-modal-bg').classList.add('open');
}
function closeMaterialModal(){ document.getElementById('acv-modal-bg').classList.remove('open'); acvDraft=null; }
function renderMaterialModal(){
  var d=acvDraft; if(!d) return;
  var origens=[{v:'livre',lbl:'Geral'},{v:'noiva',lbl:'Noiva'},{v:'cliente',lbl:'Cliente'},{v:'orcamento',lbl:'Orçamento'}];
  var origemOpts=origens.map(function(o){ return '<option value="'+o.v+'"'+(d.origemTipo===o.v?' selected':'')+'>'+o.lbl+'</option>'; }).join('');
  var assetsHtml=(d.assets||[]).map(function(a,idx){ return assetRowHtml(a,idx); }).join('');
  var midiasBlock=d.assets.length?('<div class="acv-asset-grid">'+assetsHtml+'</div>'):'';
  var isEdit=_matIndex(d.id)>=0;
  var html='<div class="acv-modal-top">'+
      '<button class="acv-x" onclick="closeMaterialModal()">✕</button>'+
      '<div class="acv-modal-tit">'+(isEdit?'Editar material':'Novo material')+'</div>'+
      '<button class="acv-save" onclick="saveMaterial()">Salvar</button>'+
    '</div>'+
    '<div class="acv-modal-body">'+
      '<input class="acv-fi acv-fi-tit" id="acv-f-tit" placeholder="Título — ex.: Atendimento Ana (noiva)" value="'+safe(d.titulo)+'">'+
      '<div class="acv-row2">'+
        '<div><label class="acv-fl">Origem</label><select class="acv-fi" id="acv-f-otipo" onchange="acvDraft.origemTipo=this.value">'+origemOpts+'</select></div>'+
        '<div><label class="acv-fl">Referência</label><input class="acv-fi" id="acv-f-oref" placeholder="ex.: Ana Silva" value="'+safe(d.origemRef)+'"></div>'+
      '</div>'+
      '<div class="acv-row2">'+
        '<div><label class="acv-fl">Data</label><input type="date" class="acv-fi" id="acv-f-data" value="'+safe(d.data)+'"></div>'+
        '<div></div>'+
      '</div>'+
      '<label class="acv-fl">Mídias <span class="acv-fl-hint">(fotos e vídeos)</span></label>'+
      '<button class="acv-drop" onclick="acvPickFiles()"'+(acvBusy?' disabled':'')+'>'+(acvBusy?'⏳ enviando…':'＋ Adicionar fotos / vídeos')+'</button>'+
      midiasBlock+
      (d.assets.length?('<button class="acv-garimpar-big" onclick="garimparDraft()"'+(acvBusy?' disabled':'')+'>⛏️ Garimpar ideias com IA</button>'+(acvErrors[d.id]?('<div class="acv-err">⚠ '+safe(acvErrors[d.id])+'</div>'):'')):'')+
    '</div>';
  document.getElementById('acv-modal').innerHTML=html;
  var t=document.getElementById('acv-f-tit'); if(t) t.addEventListener('input',function(){ acvDraft.titulo=this.value; });
  var r=document.getElementById('acv-f-oref'); if(r) r.addEventListener('input',function(){ acvDraft.origemRef=this.value; });
  var dt=document.getElementById('acv-f-data'); if(dt) dt.addEventListener('change',function(){ acvDraft.data=this.value; });
}
function assetRowHtml(a,idx){
  var url=thumbUrl(a);
  var thumb=url
    ? '<div style="position:relative"><img class="acv-asset-thumb" src="'+safe(url)+'" alt="">'+(a.kind==='video'?'<span class="acv-asset-play">▶</span>':'')+'</div>'
    : '<div class="acv-asset-thumb acv-ph">'+(a.kind==='video'?'🎬':'🖼️')+'</div>';
  var tipoOpts=TIPOS_MIDIA.map(function(t){ return '<option value="'+t.v+'"'+(a.tipo===t.v?' selected':'')+'>'+t.emoji+' '+t.lbl+'</option>'; }).join('');
  return '<div class="acv-asset">'+thumb+
      '<select class="acv-asset-tipo" onchange="acvSetTipo('+idx+',this.value)">'+tipoOpts+'</select>'+
      '<button class="acv-asset-del" onclick="acvRemoveAsset('+idx+')">remover</button>'+
    '</div>';
}
function acvSetTipo(idx,v){ if(acvDraft&&acvDraft.assets[idx]) acvDraft.assets[idx].tipo=v; }
function acvRemoveAsset(idx){
  if(!acvDraft) return;
  var a=acvDraft.assets[idx]; if(!a) return;
  var paths=[a.path]; if(a.thumbPath&&a.thumbPath!==a.path) paths.push(a.thumbPath);
  if(typeof DB!=='undefined'&&DB.storage&&DB.storage.deleteMaterial) DB.storage.deleteMaterial(paths).catch(function(){});
  acvDraft.assets.splice(idx,1);
  renderMaterialModal();
}
function saveMaterial(){
  var d=acvDraft; if(!d) return;
  var ti=document.getElementById('acv-f-tit'); if(ti) d.titulo=ti.value;
  if(!String(d.titulo).trim() && !d.assets.length){ showToast('Dê um título ou adicione mídias'); return; }
  if(!String(d.titulo).trim()) d.titulo='Material '+(fmtDate(d.data)||'');
  d.status = materialEsgotado(d)?'esgotado':((sugPendentes(d).length||ideiasDoMaterial(d.id).length)?'em_uso':'novo');
  var i=_matIndex(d.id); if(i>=0) materiais[i]=d; else materiais.unshift(d);
  persistMaterial(d);
  closeMaterialModal();
  refreshAcv();
  showToast('Material salvo');
}

/* ── upload / processamento de mídia ── */
function acvPickFiles(){ var inp=document.getElementById('acv-file-input'); if(inp){ inp.value=''; inp.click(); } }
function acvOnFiles(files){
  if(!acvDraft || !files || !files.length) return;
  if(typeof DB==='undefined' || !DB.storage || !DB.storage.uploadMaterial || window._SB_ERROR){ showToast('Conecte ao Supabase para subir mídias'); return; }
  var arr=Array.prototype.slice.call(files), i=0;
  acvBusy=true; renderMaterialModal();
  function next(){
    if(!acvDraft){ acvBusy=false; return; }   // modal fechado no meio do envio
    if(i>=arr.length){ acvBusy=false; renderMaterialModal(); persistMaterial(acvDraft); return; }
    var f=arr[i++];
    processFile(f).then(function(asset){ if(asset && acvDraft) acvDraft.assets.push(asset); next(); })
      .catch(function(){ showToast('Falha ao enviar '+(f.name||'arquivo')); next(); });
  }
  next();
}
function processFile(f){ return (/^video\//.test(f.type||'')) ? processVideo(f) : processImage(f); }
function processImage(f){
  return resizeImageToJpeg(f,1280,0.82).then(function(out){
    return DB.storage.uploadMaterial(acvDraft.id, out.base64, 'image/jpeg', 'jpg').then(function(path){
      acvUrlCache[path]=out.dataUrl;
      return { path:path, thumbPath:path, kind:'foto', tipo:'final', w:out.w, h:out.h };
    });
  });
}
function processVideo(f){
  return extractVideoFrame(f,1280,0.82).then(function(frame){
    return DB.storage.uploadMaterial(acvDraft.id, frame.base64, 'image/jpeg', 'jpg').then(function(thumbPath){
      acvUrlCache[thumbPath]=frame.dataUrl;
      return fileToBase64(f).then(function(b64){
        var ext=(f.name.split('.').pop()||'mp4').toLowerCase();
        return DB.storage.uploadMaterial(acvDraft.id, b64, f.type||'video/mp4', ext).then(function(path){
          return { path:path, thumbPath:thumbPath, kind:'video', tipo:'bastidor', w:frame.w, h:frame.h };
        });
      });
    });
  });
}
function fileToBase64(f){
  return new Promise(function(res,rej){
    var r=new FileReader();
    r.onload=function(){ var s=String(r.result||''); var i=s.indexOf(','); res(i>=0?s.slice(i+1):s); };
    r.onerror=rej; r.readAsDataURL(f);
  });
}
function resizeImageToJpeg(f,maxDim,q){
  return new Promise(function(res,rej){
    var url=URL.createObjectURL(f), img=new Image();
    img.onload=function(){
      var w=img.naturalWidth,h=img.naturalHeight,s=Math.min(1,maxDim/Math.max(w,h));
      var cw=Math.max(1,Math.round(w*s)), ch=Math.max(1,Math.round(h*s));
      var c=document.createElement('canvas'); c.width=cw; c.height=ch;
      c.getContext('2d').drawImage(img,0,0,cw,ch);
      var dataUrl=c.toDataURL('image/jpeg',q||0.82);
      URL.revokeObjectURL(url);
      res({ base64:dataUrl.split(',')[1], dataUrl:dataUrl, w:cw, h:ch });
    };
    img.onerror=function(){ URL.revokeObjectURL(url); rej(new Error('img')); };
    img.src=url;
  });
}
function extractVideoFrame(f,maxDim,q){
  return new Promise(function(res,rej){
    var url=URL.createObjectURL(f), v=document.createElement('video'), done=false;
    v.muted=true; v.playsInline=true; v.preload='metadata';
    function grab(){
      if(done) return; done=true;
      try{
        var w=v.videoWidth,h=v.videoHeight; if(!w||!h) throw new Error('dims');
        var s=Math.min(1,maxDim/Math.max(w,h));
        var cw=Math.max(1,Math.round(w*s)), ch=Math.max(1,Math.round(h*s));
        var c=document.createElement('canvas'); c.width=cw; c.height=ch;
        c.getContext('2d').drawImage(v,0,0,cw,ch);
        var dataUrl=c.toDataURL('image/jpeg',q||0.82);
        URL.revokeObjectURL(url);
        res({ base64:dataUrl.split(',')[1], dataUrl:dataUrl, w:cw, h:ch });
      }catch(e){ URL.revokeObjectURL(url); rej(e); }
    }
    v.onloadeddata=function(){ try{ v.currentTime=Math.min(0.5,(v.duration||1)/3); }catch(e){ grab(); } };
    v.onseeked=grab;
    v.onerror=function(){ URL.revokeObjectURL(url); rej(new Error('video')); };
    setTimeout(grab,2500);
    v.src=url;
  });
}

/* ── modal de detalhe ── */
function openMaterialDetail(id){
  var m=_matById(id); if(!m) return;
  acvDetailId=id;
  var paths=[], seen={};
  (m.assets||[]).forEach(function(a){
    [a.path,a.thumbPath].forEach(function(p){ if(p && !acvUrlCache[p] && !seen[p]){ seen[p]=1; paths.push(p); } });
  });
  var go=function(){ renderMaterialDetail(); document.getElementById('acv-detail-bg').classList.add('open'); };
  if(paths.length && typeof DB!=='undefined' && DB.storage && DB.storage.signMaterials){
    DB.storage.signMaterials(paths,3600).then(function(map){ Object.keys(map).forEach(function(p){ acvUrlCache[p]=map[p]; }); go(); }).catch(go);
  } else go();
}
function closeMaterialDetail(){ document.getElementById('acv-detail-bg').classList.remove('open'); acvDetailId=null; }
function renderMaterialDetail(){
  var m=_matById(acvDetailId); if(!m){ closeMaterialDetail(); return; }
  var gal=(m.assets||[]).map(function(a){
    var u=thumbUrl(a), full=(a.path&&acvUrlCache[a.path])||u;
    var inner='<div class="acv-gal-thumb"'+(u?(' style="background-image:url(\''+safe(u)+'\')"'):'')+'>'+(a.kind==='video'?'<span class="acv-asset-play">▶</span>':'')+'</div>';
    return '<a class="acv-gal-item" href="'+safe(full)+'" target="_blank" rel="noopener">'+inner+'<span class="acv-gal-tip">'+tipoEmoji(a.tipo)+'</span></a>';
  }).join('') || '<div class="acv-opps-empty">Sem mídias.</div>';
  var sorted=(m.sugestoes||[]).slice().sort(function(a,b){
    var rank={pendente:0,planejada:1,descartada:2}, ra=rank[a.status]||0, rb=rank[b.status]||0;
    if(ra!==rb) return ra-rb;
    return (b.prioridade||0)-(a.prioridade||0);
  });
  var sugHtml=sorted.length
    ? sorted.map(function(s){ return detailSugHtml(m,s); }).join('')
    : '<div class="acv-opps-empty">Ainda não garimpado. Toque em <b>⛏️ Garimpar ideias</b> acima.</div>';
  var html='<div class="acv-detail-top">'+
      '<button class="acv-x" onclick="closeMaterialDetail()">✕</button>'+
      '<div class="acv-detail-tit">'+safe(m.titulo)+'</div>'+
      '<button class="acv-detail-edit" onclick="closeMaterialDetail();openMaterialModal(\''+safe(m.id)+'\')">editar</button>'+
    '</div>'+
    '<div class="acv-detail-body">'+
      '<div class="acv-detail-meta">'+acvOrigemLabel(m)+' · '+(m.data?fmtDate(m.data):'sem data')+' · '+(m.assets||[]).length+' mídias</div>'+
      '<div class="acv-gallery">'+gal+'</div>'+
      '<button class="acv-garimpar-big" onclick="garimpar(\''+safe(m.id)+'\',event)"'+(acvBusy?' disabled':'')+'>⛏️ '+(acvBusy?'Garimpando…':('Garimpar '+((m.sugestoes||[]).length?'mais ':'')+'ideias'))+'</button>'+
      (acvErrors[m.id]?('<div class="acv-err">⚠ '+safe(acvErrors[m.id])+'</div>'):'')+
      (m.diagnostico?diagnosticoHtml(m.diagnostico):'')+
      '<div class="acv-detail-sec">Oportunidades</div>'+
      '<div class="acv-detail-sugs">'+sugHtml+'</div>'+
      '<button class="acv-del-mat" onclick="excluirMaterial(\''+safe(m.id)+'\')">Excluir material</button>'+
    '</div>';
  document.getElementById('acv-detail').innerHTML=html;
}
function detailSugHtml(m,s){
  var obj=OBJETIVOS[s.objetivo]||OBJETIVOS.Autoridade;
  var badge = s.status==='planejada' ? '<span class="acv-sug-pl">✓ planejada</span>'
            : s.status==='descartada' ? '<span class="acv-sug-dis">descartada</span>' : '';
  var acts = s.status==='pendente'
    ? '<div class="acv-opp-acts">'+
        '<button class="acv-opp-plan" onclick="promoverOportunidade(\''+safe(m.id)+'\',\''+safe(s.id)+'\')">→ Planejar</button>'+
        '<button class="acv-opp-mini" onclick="descartarSugestao(\''+safe(m.id)+'\',\''+safe(s.id)+'\')">✕ descartar</button>'+
      '</div>' : '';
  var rot=s.roteiro?('<div class="acv-sug-rot">'+safe(s.roteiro)+'</div>'):'';
  var leg=s.legenda?('<div class="acv-sug-leg">📝 '+safe(s.legenda)+(s.hashtags?('\n'+safe(s.hashtags)):'')+'</div>'):'';
  return '<div class="acv-sug'+(s.status!=='pendente'?' acv-sug-off':'')+'">'+
      '<div class="acv-opp-tags">'+
        prioStars(s.prioridade)+
        '<span class="acv-opp-fmt">'+(FMT_EMOJI[s.formato]||'')+' '+safe(s.formato)+'</span>'+
        '<span class="acv-opp-obj" style="background:'+obj.bg+';color:'+obj.cor+'">'+obj.emoji+' '+safe(s.objetivo)+'</span>'+
        pilarChip(s.pilar)+badge+
      '</div>'+
      '<div class="acv-sug-tit">'+safe(s.titulo)+'</div>'+alignLine(s)+rot+leg+acts+
    '</div>';
}
function diagnosticoHtml(d){
  if(!d) return '';
  var pil=(d.pilares_a_fortalecer||[]).join(' · '), rows='';
  if(d.comunicar_agora)       rows+='<div class="acv-diag-row">'+safe(d.comunicar_agora)+'</div>';
  if(pil)                     rows+='<div class="acv-diag-row"><b>Fortalecer:</b> '+safe(pil)+'</div>';
  if(d.lacunas)               rows+='<div class="acv-diag-row"><b>Lacunas:</b> '+safe(d.lacunas)+'</div>';
  if(d.como_o_material_ajuda) rows+='<div class="acv-diag-row"><b>Este material:</b> '+safe(d.como_o_material_ajuda)+'</div>';
  return '<div class="acv-diag"><div class="acv-diag-tit">🧠 O que sua marca precisa agora</div>'+rows+'</div>';
}

/* ── ações sobre sugestões ── */
function descartarSugestao(mid,sid){
  var m=_matById(mid); if(!m) return;
  (m.sugestoes||[]).forEach(function(s){ if(s.id===sid) s.status='descartada'; });
  m.status=materialEsgotado(m)?'esgotado':m.status;
  persistMaterial(m); refreshAcv();
}
function promoverOportunidade(mid,sid){
  var m=_matById(mid); if(!m) return;
  var s=null; (m.sugestoes||[]).forEach(function(x){ if(x.id===sid) s=x; }); if(!s) return;
  var now=new Date();
  var cat = s.pilar ? pilarToCat(s.pilar) : (m.origemTipo==='noiva' ? 'Noivas' : CATS[0]);
  var nota = (s.alinhamento?('🧭 '+s.alinhamento):'') + (s.pilar?((s.alinhamento?' · ':'')+'Pilar: '+s.pilar):'');
  var idea={
    id:'op_'+now.getTime()+'_'+Math.random().toString(36).slice(2,6),
    title:s.titulo||'Oportunidade',
    categories:[cat],
    formatos:[FORMATOS_ALL.indexOf(s.formato)>=0?s.formato:'Reels'],
    status:'Fila de Gravacao',
    notes:nota,
    roteiro:s.roteiro?('<p>'+safe(s.roteiro).replace(/\n/g,'<br>')+'</p>'):'',
    legenda:(s.legenda?('<p>'+safe(s.legenda).replace(/\n/g,'<br>')+'</p>'):'')+(s.hashtags?('<p>'+safe(s.hashtags)+'</p>'):''),
    platforms:['Instagram'],
    scheduledDate:'',
    gravarDate:'',
    objetivo:s.objetivo||'',
    materialId:m.id,
    createdAt:now.toISOString()
  };
  ideas.unshift(idea);
  persistIdea(idea);
  s.status='planejada';
  m.status=materialEsgotado(m)?'esgotado':'em_uso';
  persistMaterial(m);
  refreshAcv(); buildSidebar();
  showToast('Enviado ao Planejamento (Fila de Gravação)');
}
function excluirMaterial(id){
  var m=_matById(id); if(!m) return;
  if(!confirm('Excluir o material "'+(m.titulo||'')+'" e suas mídias?\nAs ideias já promovidas ao Planejamento permanecem.')) return;
  var paths=[]; (m.assets||[]).forEach(function(a){ if(a.path) paths.push(a.path); if(a.thumbPath&&a.thumbPath!==a.path) paths.push(a.thumbPath); });
  if(typeof DB!=='undefined'&&DB.storage&&DB.storage.deleteMaterial) DB.storage.deleteMaterial(paths).catch(function(){});
  if(typeof DB!=='undefined'&&DB.materiais) DB.materiais.delete(id).catch(function(){});
  var i=_matIndex(id); if(i>=0) materiais.splice(i,1);
  saveMateriaisLS();
  closeMaterialDetail(); refreshAcv();
  showToast('Material excluído');
}

/* ── IA: garimpo de ideias (Claude visão) ── */
function garimparDraft(){
  if(!acvDraft) return;
  if(!String(acvDraft.titulo).trim()) acvDraft.titulo='Material '+(fmtDate(acvDraft.data)||'');
  var i=_matIndex(acvDraft.id); if(i>=0) materiais[i]=acvDraft; else materiais.unshift(acvDraft);
  persistMaterial(acvDraft);
  garimpar(acvDraft.id,null);
}
function garimpar(id,ev){
  if(ev&&ev.stopPropagation) ev.stopPropagation();
  var m=_matById(id) || (acvDraft&&acvDraft.id===id?acvDraft:null);
  if(!m) return;
  if(acvBusy){ showToast('Aguarde o processo atual…'); return; }
  var key=localStorage.getItem('mk_claude_key')||'';
  if(!key){ showToast('Configure sua chave Claude (⚙️ no Financeiro) primeiro'); return; }
  if(!(m.assets||[]).length){ showToast('Adicione mídias antes de garimpar'); return; }
  acvBusy=true;
  delete acvErrors[m.id];
  showToast('⛏️ Garimpando ideias…');
  if(document.getElementById('acv-detail-bg').classList.contains('open')) renderMaterialDetail();
  if(acvDraft&&acvDraft.id===m.id) renderMaterialModal();
  var thumbs=[]; (m.assets||[]).forEach(function(a){ var p=a.thumbPath||a.path; if(p) thumbs.push({p:p,tipo:a.tipo,kind:a.kind}); });
  thumbs=thumbs.slice(0,6);
  // baixa os bytes de cada mídia (robusto: não depende de URL pública)
  var jobs=thumbs.map(function(t){ return DB.storage.materialBytes(t.p)
    .then(function(b){ return {tipo:t.tipo,kind:t.kind,base64:b.base64,mime:b.mime}; })
    .catch(function(){ return null; }); });
  Promise.all(jobs).then(function(imgs){
    imgs=imgs.filter(Boolean);
    if(!imgs.length) throw new Error('não consegui ler as mídias. Você rodou a migration sql/conteudo-acervo.sql no Supabase?');
    return callGarimpoIA(key,m,imgs);
  }).then(function(result){
    acvBusy=false;
    var sugs=(result&&result.ideias)||[];
    if(!sugs.length){ showToast('A IA não retornou ideias. Tente de novo.'); finalizeGarimpoUI(m); return; }
    m.diagnostico=(result&&result.diagnostico)||null;
    var now=Date.now();
    sugs.forEach(function(s,i){
      var prio=(typeof s.prioridade==='number')?s.prioridade:parseInt(s.prioridade,10);
      m.sugestoes.push({
        id:'sg_'+now+'_'+i,
        titulo:String(s.titulo||'').slice(0,140),
        formato:FORMATOS_ALL.indexOf(s.formato)>=0?s.formato:'Reels',
        objetivo:OBJ_KEYS.indexOf(s.objetivo)>=0?s.objetivo:'Autoridade',
        pilar:String(s.pilar||''),
        alinhamento:String(s.alinhamento||''),
        prioridade:(prio>=1&&prio<=5)?prio:3,
        roteiro:String(s.roteiro||''),
        legenda:String(s.legenda||''),
        hashtags:String(s.hashtags||''),
        status:'pendente'
      });
    });
    m.status='em_uso';
    if(_matIndex(m.id)<0) materiais.unshift(m);
    persistMaterial(m);
    finalizeGarimpoUI(m);
    showToast('✨ '+sugs.length+' oportunidade'+(sugs.length!==1?'s':'')+' garimpada'+(sugs.length!==1?'s':'')+'!');
  }).catch(function(err){
    acvBusy=false;
    var msg=(err&&err.message)||'tente de novo';
    try{ console.error('[garimpo] falhou:', err); }catch(e){}
    acvErrors[m.id]=msg;
    finalizeGarimpoUI(m);
    showToast('Erro no garimpo — veja o detalhe do material');
  });
}
function finalizeGarimpoUI(m){
  refreshAcv();
  if(acvDraft&&acvDraft.id===m.id){ acvDraft=m; renderMaterialModal(); }
}
function callGarimpoIA(apiKey,m,images){
  var brandDna=(window.BRAND&&BRAND.dna)||'';
  var estado=brandContentState();
  var ctxMidias='MATERIAL BRUTO: '+(m.titulo||'(sem título)')+'\nOrigem: '+acvOrigemPlain(m)+
    '\nMídias ('+images.length+'): '+images.map(function(im){ return (im.kind==='video'?'vídeo':'foto')+' de '+tipoLabel(im.tipo); }).join(', ');

  var system =
    'Você é a estrategista-chefe de conteúdo da marca Carol Nunes — NÃO um gerador genérico de ideias para redes sociais. '+
    'Você parte SEMPRE da estratégia da marca e trata o material enviado apenas como matéria-prima. '+
    'Toda oportunidade precisa servir a um PILAR e a um OBJETIVO de negócio reais da marca. '+
    'Nada de "antes e depois / bastidores / transformação" soltos: explique como cada peça fortalece a marca AGORA.'+
    (brandDna ? ('\n\n════ CÉREBRO DA MARCA ════\n'+brandDna) : '');

  var instr =
    'Analise as imagens deste material e gere de 4 a 6 OPORTUNIDADES de conteúdo para a marca.\n\n'+
    'ANTES de gerar, preencha o diagnóstico, respondendo internamente: (1) quais os objetivos estratégicos atuais da marca; '+
    '(2) o que a marca precisa comunicar agora; (3) quais pilares precisam ser fortalecidos; (4) quais lacunas existem no planejamento; '+
    '(5) como ESTE material ajuda nesses objetivos.\n\n'+
    'Para cada oportunidade: escolha o formato (Reels/Stories/Carrossel/Post) e o objetivo (Autoridade/Relacionamento/Engajamento/Venda); '+
    'aponte o PILAR que reforça; escreva o ALINHAMENTO em uma frase (por que serve à marca AGORA — pilar, objeção do público que combate, lacuna que preenche ou contribuição ao curso Formação VIP); '+
    'dê uma PRIORIDADE de 1 a 5 (5 = mais estratégica), priorizando nesta ordem: alinhamento aos objetivos > autoridade > venda > relacionamento > engajamento; '+
    'traga roteiro curto (cenas/passos em linhas) e legenda pronta com CTA, no tom da marca. Varie formatos e objetivos entre as oportunidades.\n\n'+
    estado+'\n\n'+ctxMidias;

  var content=[{type:'text',text:instr}];
  images.forEach(function(im){
    var mt=(im.mime==='image/png'||im.mime==='image/webp'||im.mime==='image/gif')?im.mime:'image/jpeg';
    content.push({type:'image',source:{type:'base64',media_type:mt,data:im.base64}});
  });

  var tool={
    name:'registrar_oportunidades',
    description:'Registra o diagnóstico estratégico e as oportunidades de conteúdo geradas a partir do material.',
    input_schema:{ type:'object', properties:{
      diagnostico:{ type:'object', properties:{
        objetivos_do_momento:{type:'string'},
        comunicar_agora:{type:'string'},
        pilares_a_fortalecer:{type:'array',items:{type:'string'}},
        lacunas:{type:'string'},
        como_o_material_ajuda:{type:'string'}
      }, required:['objetivos_do_momento','comunicar_agora','pilares_a_fortalecer','como_o_material_ajuda'] },
      ideias:{ type:'array', items:{ type:'object', properties:{
        titulo:{type:'string'},
        formato:{type:'string',enum:FORMATOS_ALL},
        objetivo:{type:'string',enum:OBJ_KEYS},
        pilar:{type:'string'},
        alinhamento:{type:'string'},
        prioridade:{type:'integer'},
        roteiro:{type:'string'},
        legenda:{type:'string'},
        hashtags:{type:'string'}
      }, required:['titulo','formato','objetivo','pilar','alinhamento','prioridade','roteiro','legenda'] } }
    }, required:['diagnostico','ideias'] }
  };
  var ctrl=(typeof AbortController!=='undefined')?new AbortController():null;
  var to=ctrl?setTimeout(function(){ try{ctrl.abort();}catch(e){} },120000):null;
  var opts={
    method:'POST',
    headers:{ 'content-type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true' },
    body:JSON.stringify({
      model:'claude-sonnet-4-6',
      max_tokens:8000,
      system:system,
      tools:[tool],
      tool_choice:{type:'tool',name:'registrar_oportunidades'},
      messages:[{role:'user',content:content}]
    })
  };
  if(ctrl) opts.signal=ctrl.signal;
  return fetch('https://api.anthropic.com/v1/messages',opts).then(function(res){
    if(to){ clearTimeout(to); to=null; }
    if(!res.ok){
      return res.text().then(function(txt){
        var msg=String(res.status);
        try{ var j=JSON.parse(txt); if(j&&j.error&&j.error.message) msg=j.error.message; }catch(e){ if(txt) msg=txt.slice(0,180); }
        throw new Error('API '+res.status+': '+msg);
      });
    }
    return res.json();
  }).then(function(data){
    var blocks=(data&&data.content)||[];
    for(var i=0;i<blocks.length;i++){ if(blocks[i].type==='tool_use'&&blocks[i].input&&blocks[i].input.ideias) return blocks[i].input; }
    var sr=(data&&data.stop_reason)||'';
    throw new Error('a IA respondeu sem ideias'+(sr?(' (stop_reason: '+sr+')'):''));
  }).catch(function(e){
    if(to){ clearTimeout(to); to=null; }
    if(e&&e.name==='AbortError') throw new Error('tempo esgotado (120s) — verifique sua conexão/chave');
    throw e;
  });
}

/* ── eventos do Acervo ── */
(function attachAcvEvents(){
  var inp=document.getElementById('acv-file-input');
  if(inp) inp.addEventListener('change', function(){ acvOnFiles(this.files); });
  var mb=document.getElementById('acv-modal-bg');
  if(mb) mb.addEventListener('click', function(e){ if(e.target===mb && !acvBusy) closeMaterialModal(); });
  var db2=document.getElementById('acv-detail-bg');
  if(db2) db2.addEventListener('click', function(e){ if(e.target===db2) closeMaterialDetail(); });
})();

/* ============================================================
   EVENTOS GLOBAIS
   ============================================================ */
document.getElementById('fab-btn').onclick=function(){openModal(null);};
document.getElementById('btn-save').onclick=saveIdea;
document.getElementById('btn-del').onclick=deleteIdea;
document.getElementById('btn-add-cat').onclick=addCustomCat;
document.getElementById('day-bg').onclick=function(e){if(e.target===document.getElementById('day-bg'))closeDayModal();};

// Auto-save do rascunho: título e datas
document.getElementById('f-title').addEventListener('input', scheduleDraft);
document.getElementById('f-date').addEventListener('change', scheduleDraft);
document.getElementById('f-gravar').addEventListener('change', scheduleDraft);

// Menu Promover (⤴): clicar fora fecha
document.getElementById('promo-bg').addEventListener('click', function(e){
  if(e.target===this) closePromo();
});
// Auto-save do rascunho: editores ricos (contenteditable)
['rte-roteiro','rte-legenda','rte-notas'].forEach(function(id){
  var el = document.getElementById(id);
  if(el) el.addEventListener('input', scheduleDraft);
});

// Fechar overlays com Escape
document.addEventListener('keydown',function(e){
  if(e.key==='Escape'){
    if(_openDD){ _openDD=null; applyDDOpen(); }
    else if(document.getElementById('promo-bg').classList.contains('open')) closePromo();
    else if(document.getElementById('tp-bg').classList.contains('open')) closeTeleprompter();
    else if(document.getElementById('gravacao-bg').classList.contains('open')) closeGravacao();
    else if(document.getElementById('modal-bg').classList.contains('open')) closeModal();
  }
});

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
loadMateriais();   // Acervo — banco de matéria-prima (carrega em paralelo)
setView('hoje');   // home = painel do dia (ajusta visibilidade de todas as views)
updateInboxBadges();

// Atualiza badge do inbox quando storage muda (ex: nota salva no Instagram)
window.addEventListener('storage', function(e){
  if(e.key===QN_KEY){ updateInboxBadges(); if(curView==='inbox') renderInbox(); }
});