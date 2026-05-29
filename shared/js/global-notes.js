/* ============================================================
   GLOBAL NOTES — Widget flutuante de lembretes operacionais (esquerda)
   Diferente do QuickNotes (direita, ideias de conteúdo).
   Persistência: Supabase anotacoes/cadernos · caderno "Notas rápidas"
   Cache: localStorage 'mk_qn_notes' + 'mk_qn_caderno_id'
   Init: automático no DOMContentLoaded (a menos que body[data-no-globalnotes])
   ============================================================ */
(function(){
  var CAD_NOME = 'Notas rápidas';
  var LS_NOTES = 'mk_qn_notes';
  var LS_CAD   = 'mk_qn_caderno_id';
  var _open = false;
  var _cadId = localStorage.getItem(LS_CAD) || '';
  var _notes = (function(){
    try { return JSON.parse(localStorage.getItem(LS_NOTES) || '[]'); }
    catch(_) { return []; }
  })();
  var _ready = false;

  /* ---------- Storage helpers ---------- */
  function saveCache(){
    try { localStorage.setItem(LS_NOTES, JSON.stringify(_notes)); } catch(_){}
  }

  async function ensureCaderno(){
    if (_cadId) return _cadId;
    if (!window.DB || !DB.cadernos) return '';
    try {
      var cads = await DB.cadernos.list();
      var existente = cads.find(function(c){ return c.nome === CAD_NOME; });
      if (existente){
        _cadId = existente.id;
        try { localStorage.setItem(LS_CAD, _cadId); } catch(_){}
        return _cadId;
      }
      var novo = { id: 'qn_' + Date.now(), nome: CAD_NOME, emoji: '📝', cor: '#a36844' };
      await DB.cadernos.upsert(novo);
      _cadId = novo.id;
      try { localStorage.setItem(LS_CAD, _cadId); } catch(_){}
      return _cadId;
    } catch(err){
      console.warn('[global-notes] ensureCaderno falhou:', err);
      return '';
    }
  }

  async function loadFromServer(){
    if (!window.DB || !DB.anotacoes) return;
    try {
      var cad = await ensureCaderno();
      if (!cad) return;
      var notes = await DB.anotacoes.listByCaderno(cad);
      _notes = (notes || []).map(function(n){
        return { id: n.id, titulo: n.titulo, updatedAt: n.updatedAt };
      });
      saveCache();
      renderList();
      updateBadge();
    } catch(err){
      console.warn('[global-notes] load falhou:', err);
    }
  }

  async function addNote(titulo){
    var t = String(titulo || '').trim();
    if (!t) return;
    var cad = await ensureCaderno();
    if (!cad){ alert('Sem conexão para criar caderno. Tente novamente.'); return; }
    var nota = {
      id: 'qn_' + Date.now(),
      cadernoId: cad,
      titulo: t,
      conteudo: '',
      tags: [],
      imagens: [],
      createdAt: new Date().toISOString(),
    };
    _notes.unshift({ id: nota.id, titulo: nota.titulo, updatedAt: nota.createdAt });
    saveCache();
    renderList();
    updateBadge();
    try { await DB.anotacoes.upsert(nota); }
    catch(err){ console.warn('[global-notes] add falhou:', err); }
  }

  async function deleteNote(id){
    _notes = _notes.filter(function(n){ return n.id !== id; });
    saveCache();
    renderList();
    updateBadge();
    if (!window.DB || !DB.anotacoes) return;
    try { await DB.anotacoes.delete(id); } catch(_){}
  }

  /* ---------- CSS ---------- */
  function injectCSS(){
    if (document.getElementById('lqn-css')) return;
    var s = document.createElement('style');
    s.id = 'lqn-css';
    s.textContent = [
      '#lqn-fab{position:fixed;bottom:22px;left:18px;z-index:1100;width:46px;height:46px;',
      'border-radius:50%;background:linear-gradient(135deg,#8B5A3C,#a36844);border:none;',
      'cursor:pointer;box-shadow:0 3px 14px rgba(0,0,0,.22);display:flex;align-items:center;',
      'justify-content:center;transition:transform .18s,box-shadow .18s;color:#fff;}',
      '#lqn-fab:hover{transform:scale(1.07);box-shadow:0 5px 18px rgba(0,0,0,.28);}',
      '#lqn-badge{position:absolute;top:-5px;right:-5px;background:#d97706;color:#fff;',
      'border-radius:10px;font-size:10px;font-weight:700;min-width:18px;height:18px;',
      'padding:0 4px;display:none;align-items:center;justify-content:center;',
      'border:2px solid #fff;line-height:1;}',
      '#lqn-panel{position:fixed;bottom:76px;left:14px;z-index:1099;width:290px;',
      'max-width:calc(100vw - 28px);background:#fff;border-radius:16px;',
      'box-shadow:0 8px 32px rgba(0,0,0,.16);transform:translateY(14px) scale(.96);',
      'opacity:0;transition:transform .2s ease,opacity .2s ease;pointer-events:none;overflow:hidden;}',
      '#lqn-panel.lqn-open{transform:translateY(0) scale(1);opacity:1;pointer-events:all;}',
      '.lqn-hdr{padding:11px 14px;background:linear-gradient(135deg,#8B5A3C,#a36844);',
      'display:flex;align-items:center;justify-content:space-between;color:#fff;}',
      '.lqn-hdr-title{font-size:13px;font-weight:700;letter-spacing:.3px;}',
      '.lqn-hdr-close{background:none;border:none;color:#fff;cursor:pointer;font-size:20px;',
      'line-height:1;padding:0 2px;opacity:.75;}',
      '.lqn-hdr-close:hover{opacity:1;}',
      '.lqn-body{padding:12px;max-height:60vh;overflow-y:auto;}',
      '.lqn-row{display:flex;gap:6px;}',
      '#lqn-input{flex:1;box-sizing:border-box;border:1.5px solid #e0e0e0;border-radius:10px;',
      'padding:9px 11px;font-size:13px;font-family:inherit;outline:none;color:#333;}',
      '#lqn-input:focus{border-color:#a36844;}',
      '.lqn-add{background:#a36844;color:#fff;border:none;border-radius:10px;',
      'padding:0 14px;font-size:18px;font-weight:700;cursor:pointer;}',
      '.lqn-add:hover{background:#8B5A3C;}',
      '.lqn-list{list-style:none;padding:0;margin:10px 0 0;display:flex;flex-direction:column;gap:5px;}',
      '.lqn-item{display:flex;align-items:center;gap:8px;padding:8px 10px;background:#faf5f0;',
      'border-radius:8px;font-size:13px;color:#333;}',
      '.lqn-item-txt{flex:1;min-width:0;word-break:break-word;line-height:1.35;}',
      '.lqn-item-del{background:none;border:none;color:#999;font-size:16px;cursor:pointer;',
      'padding:0 4px;line-height:1;flex-shrink:0;}',
      '.lqn-item-del:hover{color:#d33;}',
      '.lqn-empty{font-size:12px;color:#bbb;text-align:center;padding:14px 0;}',
      '.lqn-link{display:block;text-align:center;font-size:12px;color:#a36844;',
      'text-decoration:none;margin-top:9px;padding-top:8px;border-top:1px solid #f0e8e0;font-weight:600;}',
      '.lqn-link:hover{text-decoration:underline;}'
    ].join('');
    document.head.appendChild(s);
  }

  /* ---------- Render ---------- */
  function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  function updateBadge(){
    var el = document.getElementById('lqn-badge');
    if (!el) return;
    var n = _notes.length;
    el.textContent = n > 9 ? '9+' : String(n);
    el.style.display = n > 0 ? 'flex' : 'none';
  }

  function renderList(){
    var el = document.getElementById('lqn-list');
    if (!el) return;
    if (!_notes.length){
      el.innerHTML = '<li class="lqn-empty">Nenhum lembrete</li>';
      return;
    }
    var html = '';
    for (var i = 0; i < _notes.length && i < 12; i++){
      var n = _notes[i];
      html += '<li class="lqn-item">'
            +   '<span class="lqn-item-txt">' + esc(n.titulo) + '</span>'
            +   '<button class="lqn-item-del" data-id="' + esc(n.id) + '" title="Concluir">✕</button>'
            + '</li>';
    }
    el.innerHTML = html;
    // delegate clicks
    var dels = el.querySelectorAll('.lqn-item-del');
    for (var j = 0; j < dels.length; j++){
      dels[j].addEventListener('click', function(ev){
        var id = ev.currentTarget.getAttribute('data-id');
        if (id) deleteNote(id);
      });
    }
  }

  function _resolveAnotacoesPath(){
    var p = window.location.pathname;
    var depth = (p.match(/\//g) || []).length - 1;
    if (depth < 0) depth = 0;
    var base = '';
    for (var i = 0; i < depth; i++) base += '../';
    return base + 'anotacoes/';
  }

  function build(){
    if (_ready) return;
    _ready = true;
    injectCSS();

    var fab = document.createElement('button');
    fab.id = 'lqn-fab';
    fab.title = 'Lembretes';
    fab.setAttribute('aria-label', 'Lembretes');
    fab.innerHTML =
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M9 11l3 3L22 4"/>' +
        '<path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>' +
      '</svg>' +
      '<span id="lqn-badge"></span>';

    var panel = document.createElement('div');
    panel.id = 'lqn-panel';
    panel.innerHTML =
      '<div class="lqn-hdr">' +
        '<span class="lqn-hdr-title">📝 Lembretes</span>' +
        '<button class="lqn-hdr-close" id="lqn-close" aria-label="Fechar">×</button>' +
      '</div>' +
      '<div class="lqn-body">' +
        '<div class="lqn-row">' +
          '<input id="lqn-input" type="text" placeholder="Anota um lembrete..." autocomplete="off">' +
          '<button class="lqn-add" id="lqn-add" aria-label="Adicionar">+</button>' +
        '</div>' +
        '<ul class="lqn-list" id="lqn-list"></ul>' +
        '<a href="' + _resolveAnotacoesPath() + '" class="lqn-link">Ver todas no Anotações →</a>' +
      '</div>';

    document.body.appendChild(fab);
    document.body.appendChild(panel);

    renderList();
    updateBadge();

    fab.addEventListener('click', toggle);
    document.getElementById('lqn-close').addEventListener('click', function(e){ e.stopPropagation(); close(); });
    document.getElementById('lqn-add').addEventListener('click', submitFromInput);
    var inp = document.getElementById('lqn-input');
    inp.addEventListener('keydown', function(ev){
      if (ev.key === 'Enter'){ ev.preventDefault(); submitFromInput(); }
      if (ev.key === 'Escape'){ close(); }
    });

    // fecha clicando fora
    document.addEventListener('click', function(ev){
      if (!_open) return;
      if (panel.contains(ev.target) || fab.contains(ev.target)) return;
      close();
    });
  }

  function submitFromInput(){
    var inp = document.getElementById('lqn-input');
    if (!inp) return;
    var v = inp.value;
    inp.value = '';
    addNote(v);
    inp.focus();
  }

  function toggle(){ _open ? close() : open(); }

  function open(){
    var panel = document.getElementById('lqn-panel');
    if (!panel) return;
    _open = true;
    panel.classList.add('lqn-open');
    setTimeout(function(){
      var inp = document.getElementById('lqn-input');
      if (inp) inp.focus();
    }, 180);
    loadFromServer();
  }

  function close(){
    var panel = document.getElementById('lqn-panel');
    if (!panel) return;
    _open = false;
    panel.classList.remove('lqn-open');
  }

  /* ---------- Auto-init ---------- */
  function _autoInit(){
    if (document.body && document.body.hasAttribute('data-no-globalnotes')) return;
    // Não mostrar se login-screen está visível
    var login = document.getElementById('login-screen');
    if (login && getComputedStyle(login).display !== 'none') {
      // Espera login sumir
      var obs = new MutationObserver(function(){
        if (getComputedStyle(login).display === 'none'){
          obs.disconnect();
          build();
          loadFromServer();
        }
      });
      obs.observe(login, { attributes: true, attributeFilter: ['style', 'class'] });
      return;
    }
    build();
    loadFromServer();
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', _autoInit);
  } else {
    _autoInit();
  }

  /* ---------- API pública ---------- */
  window.GlobalNotes = {
    open: open,
    close: close,
    add: addNote,
    list: function(){ return _notes.slice(); },
    refresh: loadFromServer,
  };
})();
