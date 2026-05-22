/* ============================================================
   QUICK NOTES — Widget flutuante de captura rápida de ideias
   Uso: QuickNotes.init('instagram')   (chamar no final do body)
   Dados: localStorage 'mk_quick_notes'  [{id,text,createdAt,source,promoted}]
   ============================================================ */
(function(){
  var QN_KEY = 'mk_quick_notes';
  var _open = false;
  var _source = 'outros';
  var _sessionId = null; // id da nota atual da sessão (auto-save atualiza ela)
  var _timer = null;

  /* ---------- CRUD ---------- */
  function readNotes(){
    try{ return JSON.parse(localStorage.getItem(QN_KEY)||'[]'); }catch(e){ return []; }
  }
  function writeNotes(notes){
    try{ localStorage.setItem(QN_KEY, JSON.stringify(notes)); }catch(e){}
  }
  function pendingCount(){
    return readNotes().filter(function(n){ return !n.promoted; }).length;
  }
  function upsertSessionNote(text){
    var notes = readNotes();
    if(_sessionId){
      for(var i=0;i<notes.length;i++){
        if(notes[i].id===_sessionId){ notes[i].text=text.trim(); writeNotes(notes); return; }
      }
    }
    var note = {
      id: 'qn_'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),
      text: text.trim(),
      createdAt: new Date().toISOString(),
      source: _source,
      promoted: false
    };
    _sessionId = note.id;
    notes.unshift(note);
    writeNotes(notes);
  }
  function clearSessionNote(){
    _sessionId = null;
    var ta = document.getElementById('qn-textarea');
    if(ta){ ta.value = ''; autoResize(ta); }
    updateBadge(); renderRecents();
  }

  /* ---------- CSS ---------- */
  function injectCSS(){
    if(document.getElementById('qn-css')) return;
    var s = document.createElement('style');
    s.id = 'qn-css';
    s.textContent = [
      '#qn-fab{position:fixed;bottom:22px;right:18px;z-index:1200;width:46px;height:46px;',
      'border-radius:50%;background:linear-gradient(135deg,#9c27b0,#ce93d8);border:none;',
      'cursor:pointer;box-shadow:0 3px 14px rgba(0,0,0,.22);display:flex;align-items:center;',
      'justify-content:center;transition:transform .18s,box-shadow .18s;}',
      '#qn-fab:hover{transform:scale(1.07);box-shadow:0 5px 18px rgba(0,0,0,.28);}',
      '#qn-badge{position:absolute;top:-5px;right:-5px;background:#e91e63;color:#fff;',
      'border-radius:10px;font-size:10px;font-weight:700;min-width:18px;height:18px;',
      'padding:0 4px;display:none;align-items:center;justify-content:center;',
      'border:2px solid #fff;line-height:1;}',
      '#qn-panel{position:fixed;bottom:76px;right:14px;z-index:1199;width:290px;',
      'max-width:calc(100vw - 28px);background:#fff;border-radius:16px;',
      'box-shadow:0 8px 32px rgba(0,0,0,.16);transform:translateY(14px) scale(.96);',
      'opacity:0;transition:transform .2s ease,opacity .2s ease;pointer-events:none;overflow:hidden;}',
      '#qn-panel.qn-open{transform:translateY(0) scale(1);opacity:1;pointer-events:all;}',
      '.qn-hdr{padding:11px 14px;background:linear-gradient(135deg,#9c27b0,#ce93d8);',
      'display:flex;align-items:center;justify-content:space-between;color:#fff;}',
      '.qn-hdr-title{font-size:13px;font-weight:700;letter-spacing:.3px;}',
      '.qn-hdr-close{background:none;border:none;color:#fff;cursor:pointer;font-size:20px;',
      'line-height:1;padding:0 2px;opacity:.75;transition:opacity .15s;}',
      '.qn-hdr-close:hover{opacity:1;}',
      '.qn-body{padding:12px;}',
      '#qn-textarea{width:100%;box-sizing:border-box;min-height:76px;max-height:180px;',
      'resize:none;border:1.5px solid #e0e0e0;border-radius:10px;padding:9px 11px;',
      'font-size:13px;font-family:inherit;outline:none;transition:border-color .15s;',
      'line-height:1.5;color:#333;overflow-y:auto;}',
      '#qn-textarea:focus{border-color:#9c27b0;}',
      '.qn-row{display:flex;align-items:center;justify-content:space-between;margin-top:8px;}',
      '.qn-saved{font-size:11px;color:#9c27b0;opacity:0;transition:opacity .3s;}',
      '.qn-saved.show{opacity:1;}',
      '.qn-btn{background:#9c27b0;color:#fff;border:none;border-radius:8px;',
      'padding:6px 13px;font-size:12px;font-weight:600;cursor:pointer;transition:background .15s;}',
      '.qn-btn:hover{background:#7b1fa2;}',
      '.qn-recents{margin-top:10px;border-top:1px solid #f0f0f0;padding-top:8px;}',
      '.qn-recents-lbl{font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px;}',
      '.qn-item{padding:6px 9px;background:#faf5fc;border-radius:8px;margin-bottom:4px;}',
      '.qn-item-txt{font-size:12px;color:#333;line-height:1.4;word-break:break-word;}',
      '.qn-item-meta{font-size:10px;color:#bbb;margin-top:2px;}',
      '.qn-empty-msg{font-size:12px;color:#ccc;text-align:center;padding:6px 0;}',
      '.qn-link{display:block;text-align:center;font-size:12px;color:#9c27b0;',
      'text-decoration:none;margin-top:9px;padding-top:8px;border-top:1px solid #f0f0f0;font-weight:600;}',
      '.qn-link:hover{text-decoration:underline;}'
    ].join('');
    document.head.appendChild(s);
  }

  /* ---------- Helpers ---------- */
  function autoResize(ta){
    ta.style.height='auto';
    ta.style.height=Math.min(ta.scrollHeight,180)+'px';
  }
  function relTime(iso){
    var diff=Math.floor((Date.now()-new Date(iso).getTime())/1000);
    if(diff<60) return 'agora';
    if(diff<3600) return Math.floor(diff/60)+'min atrás';
    if(diff<86400) return Math.floor(diff/3600)+'h atrás';
    return Math.floor(diff/86400)+'d atrás';
  }
  function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function showSaved(){
    var el=document.getElementById('qn-saved-lbl');
    if(!el) return;
    el.classList.add('show');
    setTimeout(function(){ el.classList.remove('show'); },2000);
  }
  function updateBadge(){
    var el=document.getElementById('qn-badge');
    if(!el) return;
    var n=pendingCount();
    el.textContent=n>9?'9+':String(n);
    el.style.display=n>0?'flex':'none';
  }
  function renderRecents(){
    var el=document.getElementById('qn-recents');
    if(!el) return;
    var notes=readNotes().filter(function(n){return !n.promoted;}).slice(0,3);
    if(!notes.length){
      el.innerHTML='<div class="qn-empty-msg">Nenhuma nota ainda</div>';
      return;
    }
    var html='<div class="qn-recents-lbl">Notas recentes</div>';
    for(var i=0;i<notes.length;i++){
      var n=notes[i];
      var preview=n.text.length>72?n.text.slice(0,72)+'…':n.text;
      var src=n.source&&n.source!=='outros'?' · '+esc(n.source):'';
      html+='<div class="qn-item"><div class="qn-item-txt">'+esc(preview)+'</div>'+
            '<div class="qn-item-meta">'+relTime(n.createdAt)+src+'</div></div>';
    }
    el.innerHTML=html;
  }

  /* ---------- BUILD ---------- */
  function init(source){
    _source = source || 'outros';
    injectCSS();

    // FAB
    var fab=document.createElement('button');
    fab.id='qn-fab'; fab.title='Quick Notes';
    fab.innerHTML='<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg><span id="qn-badge"></span>';

    // Painel
    var isConteudo=window.location.pathname.indexOf('/conteudo')!==-1;
    var linkHref=isConteudo?'':_resolvePath();
    var panel=document.createElement('div');
    panel.id='qn-panel';
    panel.innerHTML=
      '<div class="qn-hdr">'+
        '<span class="qn-hdr-title">✍️ Quick Notes</span>'+
        '<button class="qn-hdr-close" id="qn-close" aria-label="Fechar">×</button>'+
      '</div>'+
      '<div class="qn-body">'+
        '<textarea id="qn-textarea" placeholder="Anota uma ideia rápida...&#10;Ex: Reels com before/after make de noiva"></textarea>'+
        '<div class="qn-row">'+
          '<span class="qn-saved" id="qn-saved-lbl">✓ Salvo</span>'+
          '<button class="qn-btn" id="qn-save-btn">Salvar nota</button>'+
        '</div>'+
        '<div class="qn-recents" id="qn-recents"></div>'+
        (linkHref?'<a href="'+linkHref+'" class="qn-link">Ver todas no Planejamento →</a>':
                  '<a href="javascript:void(0)" class="qn-link" onclick="setView(\'inbox\')">Ver inbox →</a>')+
      '</div>';

    document.body.appendChild(fab);
    document.body.appendChild(panel);
    updateBadge();
    renderRecents();

    // Toggle
    fab.addEventListener('click',function(){
      _open=!_open;
      panel.classList.toggle('qn-open',_open);
      if(_open){
        renderRecents();
        setTimeout(function(){ var ta=document.getElementById('qn-textarea'); if(ta) ta.focus(); },200);
      } else {
        // salva ao fechar se tiver texto
        var ta=document.getElementById('qn-textarea');
        if(ta&&ta.value.trim()){ upsertSessionNote(ta.value); updateBadge(); renderRecents(); }
      }
    });

    document.getElementById('qn-close').addEventListener('click',function(){
      var ta=document.getElementById('qn-textarea');
      if(ta&&ta.value.trim()){ upsertSessionNote(ta.value); }
      _open=false; panel.classList.remove('qn-open');
      updateBadge(); renderRecents();
    });

    // Auto-save no idle
    var ta=document.getElementById('qn-textarea');
    ta.addEventListener('input',function(){
      autoResize(ta);
      if(_timer) clearTimeout(_timer);
      _timer=setTimeout(function(){
        if(ta.value.trim()){ upsertSessionNote(ta.value); showSaved(); updateBadge(); renderRecents(); }
      },1000);
    });

    // Botão Salvar nota
    document.getElementById('qn-save-btn').addEventListener('click',function(){
      var text=ta.value.trim();
      if(!text){ ta.focus(); return; }
      upsertSessionNote(text);
      clearSessionNote();
      showSaved();
    });
  }

  function _resolvePath(){
    var p=window.location.pathname;
    // /instagram/ → ../conteudo/
    var depth=(p.match(/\//g)||[]).length - 1;
    var base='';
    for(var i=0;i<depth;i++) base+='../';
    return base+'conteudo/';
  }

  /* ---------- API pública ---------- */
  window.QuickNotes={
    read: readNotes,
    write: writeNotes,
    pendingCount: pendingCount,
    init: init,
    refresh: function(){ updateBadge(); renderRecents(); }
  };
})();
