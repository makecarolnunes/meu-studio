/* ============================================================
   GLOBAL SEARCH — Busca cross-módulo
   Busca em: entries, saidas, noivas, orcamentos, clientes, anotacoes,
             tarefas, estoque, conteudo
   Atalho: tecla "/" ou botão lupa no header.
   API:    window.GlobalSearch.{open, close, mount(btnEl)}
   ============================================================ */
(function(){
  var _open    = false;
  var _loaded  = false;
  var _loading = false;
  var _data    = {
    entries: [], saidas: [], noivas: [],
    orcamentos: [], clientes: [], anotacoes: [],
    tarefas: [], estoque: [], conteudo: [],
  };
  var _kbHooked = false;

  /* ---------- Helpers ---------- */
  function norm(s){
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
  }
  function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function brl(v){ return 'R$ ' + Number(v||0).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2}); }
  function fmtDate(s){
    if (!s) return '';
    var p = String(s).split('-');
    if (p.length < 3) return s;
    return p[2] + '/' + p[1] + '/' + p[0];
  }

  function basePath(){
    var p = window.location.pathname;
    var segs = p.split('/').filter(Boolean);
    // Se termina em arquivo .html, ignora último segmento
    if (/\.html?$/i.test(segs[segs.length-1] || '')) segs.pop();
    var depth = segs.length;
    var base = '';
    for (var i = 0; i < depth; i++) base += '../';
    return base || './';
  }

  function go(href){
    window.location.href = basePath() + href;
  }

  /* ---------- CSS ---------- */
  function injectCSS(){
    if (document.getElementById('gs-css')) return;
    var s = document.createElement('style');
    s.id = 'gs-css';
    s.textContent = [
      '#gs-backdrop{position:fixed;inset:0;z-index:1500;background:rgba(40,25,15,.45);',
      'backdrop-filter:blur(2px);display:none;align-items:flex-start;justify-content:center;',
      'padding:60px 16px 24px;}',
      '#gs-backdrop.gs-open{display:flex;}',
      '#gs-modal{width:100%;max-width:560px;background:#fff;border-radius:16px;',
      'box-shadow:0 16px 56px rgba(0,0,0,.32);overflow:hidden;display:flex;flex-direction:column;',
      'max-height:calc(100vh - 96px);}',
      '.gs-hdr{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid #f0e8e0;}',
      '.gs-hdr svg{flex-shrink:0;color:#a36844;}',
      '#gs-input{flex:1;border:none;outline:none;font-size:16px;font-family:inherit;',
      'background:transparent;color:#2c1810;}',
      '#gs-input::placeholder{color:#a99284;}',
      '.gs-kbd{font-size:11px;color:#888;background:#f3eee8;border:1px solid #e0d5cb;',
      'border-radius:5px;padding:2px 6px;font-family:ui-monospace,Menlo,monospace;}',
      '.gs-close{background:none;border:none;color:#888;cursor:pointer;font-size:20px;line-height:1;padding:0 4px;}',
      '.gs-close:hover{color:#333;}',
      '.gs-body{overflow-y:auto;flex:1;padding:6px 0 12px;}',
      '.gs-loading{text-align:center;color:#999;padding:30px 0;font-size:13px;}',
      '.gs-empty{text-align:center;color:#aaa;padding:30px 16px;font-size:13px;}',
      '.gs-group{margin-top:8px;}',
      '.gs-group-hdr{padding:8px 16px 4px;font-size:11px;font-weight:700;letter-spacing:.06em;',
      'text-transform:uppercase;color:#a99284;display:flex;justify-content:space-between;align-items:center;}',
      '.gs-group-count{font-weight:500;color:#bbb;}',
      '.gs-item{display:flex;align-items:center;gap:10px;padding:10px 16px;cursor:pointer;',
      'border:none;background:none;width:100%;text-align:left;border-radius:0;font-family:inherit;}',
      '.gs-item:hover,.gs-item.gs-active{background:#faf5f0;}',
      '.gs-ico{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;',
      'font-size:14px;flex-shrink:0;font-weight:700;}',
      '.gs-txt{flex:1;min-width:0;}',
      '.gs-title{font-size:14px;font-weight:600;color:#2c1810;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.gs-sub{font-size:11.5px;color:#88736a;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.gs-hint{padding:14px 16px 8px;font-size:11.5px;color:#bbb;border-top:1px solid #f5f0eb;',
      'display:flex;gap:14px;flex-wrap:wrap;}',
      '.gs-hint kbd{background:#f3eee8;border:1px solid #e0d5cb;border-radius:4px;',
      'padding:1px 5px;font-family:ui-monospace,Menlo,monospace;font-size:10.5px;}',
      '@media(max-width:480px){#gs-backdrop{padding-top:30px;}}'
    ].join('');
    document.head.appendChild(s);
  }

  /* ---------- Build DOM ---------- */
  function build(){
    if (document.getElementById('gs-backdrop')) return;
    injectCSS();
    var b = document.createElement('div');
    b.id = 'gs-backdrop';
    b.innerHTML =
      '<div id="gs-modal" role="dialog" aria-modal="true" aria-label="Busca global">'+
        '<div class="gs-hdr">'+
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'+
          '<input id="gs-input" type="text" placeholder="Buscar clientes, entradas, orçamentos, anotações..." autocomplete="off" />'+
          '<button class="gs-close" id="gs-close" aria-label="Fechar">×</button>'+
        '</div>'+
        '<div class="gs-body" id="gs-body">'+
          '<div class="gs-empty">Digite para buscar em todo o sistema.</div>'+
        '</div>'+
        '<div class="gs-hint">'+
          '<span><kbd>/</kbd> abrir</span>'+
          '<span><kbd>Esc</kbd> fechar</span>'+
          '<span><kbd>Enter</kbd> abrir primeiro</span>'+
        '</div>'+
      '</div>';
    document.body.appendChild(b);

    b.addEventListener('click', function(e){ if (e.target === b) close(); });
    document.getElementById('gs-close').addEventListener('click', close);
    var inp = document.getElementById('gs-input');
    inp.addEventListener('input', onInput);
    inp.addEventListener('keydown', onKey);
  }

  /* ---------- Load data (lazy) ---------- */
  async function loadAll(){
    if (_loaded || _loading) return;
    _loading = true;
    if (!window.DB){ _loading = false; return; }
    var jobs = [];
    function safe(p){ return p.catch(function(err){ console.warn('[gs] load fail', err); return null; }); }
    jobs.push(safe((DB.entries     && DB.entries.list)     ? DB.entries.list()     : Promise.resolve([])).then(function(d){ if(d) _data.entries = d; }));
    jobs.push(safe((DB.saidas      && DB.saidas.list)      ? DB.saidas.list()      : Promise.resolve([])).then(function(d){ if(d) _data.saidas = d; }));
    jobs.push(safe((DB.noivas      && DB.noivas.list)      ? DB.noivas.list()      : Promise.resolve([])).then(function(d){ if(d) _data.noivas = d; }));
    jobs.push(safe((DB.orcamentos  && DB.orcamentos.list)  ? DB.orcamentos.list()  : Promise.resolve([])).then(function(d){ if(d) _data.orcamentos = d; }));
    jobs.push(safe((DB.clienteContatos && DB.clienteContatos.list) ? DB.clienteContatos.list() : Promise.resolve({})).then(function(m){
      if (!m) return;
      _data.clientes = Object.keys(m).map(function(k){
        return { id: k, nome: m[k].nomeOriginal || k, telefone: m[k].telefone || '' };
      });
    }));
    jobs.push(safe((DB.tarefas     && DB.tarefas.list)     ? DB.tarefas.list()     : Promise.resolve([])).then(function(d){ if(d) _data.tarefas = d; }));
    jobs.push(safe((DB.estoque     && DB.estoque.list)     ? DB.estoque.list()     : Promise.resolve([])).then(function(d){ if(d) _data.estoque = d; }));
    jobs.push(safe((DB.conteudo    && DB.conteudo.list)    ? DB.conteudo.list()    : Promise.resolve([])).then(function(d){ if(d) _data.conteudo = d; }));
    // Anotações: pega de todos os cadernos
    jobs.push(safe((DB.cadernos && DB.cadernos.list) ? DB.cadernos.list() : Promise.resolve([])).then(async function(cads){
      if (!cads || !DB.anotacoes || !DB.anotacoes.listByCaderno) return;
      var all = [];
      for (var i = 0; i < cads.length; i++){
        try {
          var notes = await DB.anotacoes.listByCaderno(cads[i].id);
          (notes || []).forEach(function(n){
            all.push({ id: n.id, titulo: n.titulo, conteudo: n.conteudo, cadernoNome: cads[i].nome, cadernoId: cads[i].id });
          });
        } catch(_){}
      }
      _data.anotacoes = all;
    }));

    await Promise.all(jobs);
    _loaded = true;
    _loading = false;
    var inp = document.getElementById('gs-input');
    if (inp && inp.value.trim().length >= 2) onInput();
  }

  /* ---------- Search ---------- */
  function search(q){
    var nq = norm(q).trim();
    if (nq.length < 2) return null;
    var max = 6;
    function match(s){ return norm(s).indexOf(nq) !== -1; }

    var ent = (_data.entries || []).filter(function(e){
      return match(e.cliente) || match(e.obs) || match(e.tipo) || match(e.origem) || match(e.servico);
    }).slice(0, max);

    var sai = (_data.saidas || []).filter(function(s){
      return match(s.tipo) || match(s.obs);
    }).slice(0, max);

    var noi = (_data.noivas || []).filter(function(n){
      return match(n.nome) || match(n.obs);
    }).slice(0, max);

    var orc = (_data.orcamentos || []).filter(function(o){
      return match(o.cliente) || match(o.obs) || match(o.status) || match(o.servico);
    }).slice(0, max);

    var cli = (_data.clientes || []).filter(function(c){
      return match(c.nome) || match(c.telefone);
    }).slice(0, max);

    var ano = (_data.anotacoes || []).filter(function(a){
      return match(a.titulo) || match(a.conteudo) || match(a.cadernoNome);
    }).slice(0, max);

    var tar = (_data.tarefas || []).filter(function(t){
      return match(t.titulo);
    }).slice(0, max);

    var est = (_data.estoque || []).filter(function(i){
      return match(i.nome) || match(i.obs) || match(i.categoria);
    }).slice(0, max);

    var con = (_data.conteudo || []).filter(function(c){
      return match(c.title) || match(c.notes) || (c.categories||[]).some(match);
    }).slice(0, max);

    var total = ent.length + sai.length + noi.length + orc.length + cli.length + ano.length + tar.length + est.length + con.length;
    return { ent: ent, sai: sai, noi: noi, orc: orc, cli: cli, ano: ano, tar: tar, est: est, con: con, total: total };
  }

  /* ---------- Render results ---------- */
  function renderGroup(label, color, items, mapper){
    if (!items.length) return '';
    var rows = items.map(function(it, idx){
      var m = mapper(it);
      return '<button class="gs-item" data-href="' + esc(m.href) + '" data-idx="' + idx + '">'
           + '<span class="gs-ico" style="background:' + m.bg + ';color:' + m.fg + '">' + m.ico + '</span>'
           + '<span class="gs-txt"><div class="gs-title">' + esc(m.title) + '</div>'
           + (m.sub ? '<div class="gs-sub">' + esc(m.sub) + '</div>' : '')
           + '</span></button>';
    }).join('');
    return '<div class="gs-group">'
         + '<div class="gs-group-hdr"><span>' + esc(label) + '</span><span class="gs-group-count">' + items.length + '</span></div>'
         + rows
         + '</div>';
  }

  function renderResults(r){
    var body = document.getElementById('gs-body');
    if (!body) return;
    if (!r){
      body.innerHTML = _loading
        ? '<div class="gs-loading">Carregando dados…</div>'
        : '<div class="gs-empty">Digite ao menos 2 letras para buscar.</div>';
      return;
    }
    if (r.total === 0){
      body.innerHTML = '<div class="gs-empty">Nenhum resultado.</div>';
      return;
    }
    var html = '';
    html += renderGroup('Entradas', '#bf360c', r.ent, function(e){
      return {
        title: e.cliente || '(sem nome)',
        sub: fmtDate(e.dataPag) + ' · ' + (e.tipo||'') + ' · ' + brl(e.valor) + ' · ' + (e.status||''),
        href: 'financeiro/?focus=' + encodeURIComponent(e.id) + '&type=entry',
        bg: '#fff3e0', fg: '#bf360c', ico: '$'
      };
    });
    html += renderGroup('Saídas', '#c62828', r.sai, function(s){
      return {
        title: s.tipo || '(sem tipo)',
        sub: fmtDate(s.dataPag) + ' · ' + brl(s.valor) + (s.obs ? ' · ' + s.obs : ''),
        href: 'financeiro/?focus=' + encodeURIComponent(s.id) + '&type=saida',
        bg: '#fce7e7', fg: '#c62828', ico: '↓'
      };
    });
    html += renderGroup('Noivas', '#bf360c', r.noi, function(n){
      return {
        title: n.nome || '(sem nome)',
        sub: 'Casa em ' + fmtDate(n.dataCasamento) + ' · ' + brl(n.valorContrato),
        href: 'financeiro/?focus=' + encodeURIComponent(n.id) + '&type=noiva',
        bg: '#fff3e0', fg: '#bf360c', ico: '♥'
      };
    });
    html += renderGroup('Orçamentos', '#6a1b9a', r.orc, function(o){
      return {
        title: o.cliente || '(sem cliente)',
        sub: (o.status||'Novo Pedido') + ' · ' + brl(o.valorProp || o.valor_prop),
        href: 'orcamentos/orcamentos_novo.html?openId=' + encodeURIComponent(o.id),
        bg: '#f3e5f5', fg: '#6a1b9a', ico: '✎'
      };
    });
    html += renderGroup('Clientes', '#2e7d32', r.cli, function(c){
      return {
        title: c.nome,
        sub: c.telefone ? '📱 ' + c.telefone : 'Sem telefone',
        href: 'clientes/?focusName=' + encodeURIComponent(c.nome),
        bg: '#e8f5e9', fg: '#2e7d32', ico: '👤'
      };
    });
    html += renderGroup('Anotações', '#a36844', r.ano, function(a){
      var s = (a.conteudo || '').replace(/<[^>]+>/g,'').slice(0, 80);
      return {
        title: a.titulo || '(sem título)',
        sub: a.cadernoNome ? '📓 ' + a.cadernoNome + (s ? ' · ' + s : '') : s,
        href: 'anotacoes/?nota=' + encodeURIComponent(a.id),
        bg: '#faf5f0', fg: '#a36844', ico: '📝'
      };
    });
    html += renderGroup('Tarefas', '#1565c0', r.tar, function(t){
      return {
        title: t.titulo,
        sub: (t.prazo ? 'Prazo: ' + fmtDate(t.prazo) + ' · ' : '') + (t.feita ? 'feita' : 'pendente'),
        href: 'tarefas/?tarefa=' + encodeURIComponent(t.id),
        bg: '#e3f2fd', fg: '#1565c0', ico: '✓'
      };
    });
    html += renderGroup('Estoque', '#f57f17', r.est, function(i){
      return {
        title: i.nome,
        sub: (i.categoria || '') + (i.status ? ' · ' + i.status : ''),
        href: 'estoque/?item=' + encodeURIComponent(i.id),
        bg: '#fff8e1', fg: '#f57f17', ico: '📦'
      };
    });
    html += renderGroup('Conteúdo', '#0d47a1', r.con, function(c){
      return {
        title: c.title,
        sub: (c.status || '') + (c.scheduledDate ? ' · ' + fmtDate(c.scheduledDate) : ''),
        href: 'conteudo/?idea=' + encodeURIComponent(c.id),
        bg: '#e3f2fd', fg: '#0d47a1', ico: '🎬'
      };
    });
    body.innerHTML = html;

    // attach clicks
    var items = body.querySelectorAll('.gs-item');
    for (var i = 0; i < items.length; i++){
      items[i].addEventListener('click', function(ev){
        var href = ev.currentTarget.getAttribute('data-href');
        if (href) go(href);
      });
    }
  }

  function onInput(){
    var inp = document.getElementById('gs-input');
    if (!inp) return;
    var q = inp.value;
    if (!_loaded){
      var body = document.getElementById('gs-body');
      if (body) body.innerHTML = '<div class="gs-loading">Carregando dados…</div>';
      loadAll();
      return;
    }
    renderResults(search(q));
  }

  function onKey(ev){
    if (ev.key === 'Escape'){ close(); return; }
    if (ev.key === 'Enter'){
      var first = document.querySelector('#gs-body .gs-item');
      if (first){
        var href = first.getAttribute('data-href');
        if (href) go(href);
      }
      return;
    }
  }

  /* ---------- Open / close ---------- */
  function open(){
    if (_open) return;
    build();
    _open = true;
    var b = document.getElementById('gs-backdrop');
    b.classList.add('gs-open');
    var inp = document.getElementById('gs-input');
    if (inp){ inp.value = ''; setTimeout(function(){ inp.focus(); }, 60); }
    var body = document.getElementById('gs-body');
    if (body) body.innerHTML = '<div class="gs-empty">Digite para buscar em todo o sistema.</div>';
    loadAll();
  }

  function close(){
    if (!_open) return;
    _open = false;
    var b = document.getElementById('gs-backdrop');
    if (b) b.classList.remove('gs-open');
  }

  /* ---------- Keyboard hook ---------- */
  function hookKb(){
    if (_kbHooked) return;
    _kbHooked = true;
    document.addEventListener('keydown', function(ev){
      if (ev.key !== '/') return;
      var t = ev.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || (t.isContentEditable))) return;
      if (_open) return;
      ev.preventDefault();
      open();
    });
  }

  function mount(selectorOrEl){
    var el = (typeof selectorOrEl === 'string') ? document.querySelector(selectorOrEl) : selectorOrEl;
    if (!el) return;
    if (el.querySelector('[data-gs-btn]')) return;
    var btn = document.createElement('button');
    btn.setAttribute('data-gs-btn', '1');
    btn.className = 'gs-mount-btn icon-btn hdr-icon-btn ig-icon-btn gear-btn';
    btn.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;background:rgba(255,255,255,.15);border:none;border-radius:50%;width:34px;height:34px;cursor:pointer;color:inherit;margin-right:6px;';
    btn.title = 'Buscar (atalho: /)';
    btn.setAttribute('aria-label', 'Buscar');
    btn.innerHTML = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
    btn.addEventListener('click', open);
    el.insertBefore(btn, el.firstChild);
  }

  function _autoMount(){
    // Tenta auto-montar o botão lupa em headers conhecidos.
    // Pula se a página já tem um botão chamando openGlobalSearch (ex: Financeiro).
    var existing = document.querySelector('[onclick*="openGlobalSearch"], [onclick*="GlobalSearch.open"]');
    if (existing) return;
    var targets = ['.hdr-right', '.ig-hdr-right'];
    for (var i = 0; i < targets.length; i++){
      var el = document.querySelector(targets[i]);
      if (el){ mount(el); break; }
    }
  }

  function _autoInit(){
    hookKb();
    _autoMount();
  }
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', _autoInit);
  } else {
    _autoInit();
  }

  /* ---------- API ---------- */
  window.GlobalSearch = {
    open: open,
    close: close,
    refresh: function(){ _loaded = false; loadAll(); }
  };

  window.GlobalSearch.mount = mount;
})();
