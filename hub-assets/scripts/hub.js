  // ══════════════════════════════════════════════════════════
  //  HUB — busca links dos sistemas no Apps Script da planilha
  // ══════════════════════════════════════════════════════════

  var ORDER_OPS = ['orcamentos', 'financeiro', 'clientes', 'agendamentos'];

  var FALLBACK = [
    { nome: 'Orçamentos',   descricao: 'Início do fluxo — feche tudo em um clique', icone: '💰', url: 'orcamentos/',   cor: 'purple'       },
    { nome: 'Financeiro',   descricao: 'Entradas, saídas e resumo do mês',          icone: '💵', url: 'financeiro/',   cor: 'green'        },
    { nome: 'Clientes',     descricao: 'Atendimentos realizados e previstos',       icone: '👥', url: 'clientes/',     cor: 'brown'        },
    { nome: 'Agendamentos', descricao: 'Confirmação avulsa de agenda',              icone: '📅', url: 'confirmacao/',  cor: 'purple-light' },
    { nome: 'Conteúdo',     descricao: 'Planejamento de posts e ideias',            icone: '📱', url: 'conteudo/',     cor: 'amber'        },
  ];

  // ── UTILS ──
  function safeJSON(s, fb) { try { return s ? JSON.parse(s) : fb; } catch(e) { return fb; } }
  function pad(n) { return String(n).padStart(2,'0'); }
  function todayStr() {
    var t = new Date();
    return t.getFullYear() + '-' + pad(t.getMonth()+1) + '-' + pad(t.getDate());
  }
  function setSync(state, text) {
    var pill = document.getElementById('sync-pill');
    pill.className = 'sync-pill ' + (state || '');
    document.getElementById('sync-text').textContent = text || '';
  }
  function norm(s) {
    return String(s || '')
      .normalize('NFD').replace(/[̀-ͯ]/g,'')
      .toLowerCase().trim();
  }
  function keyFor(item) {
    var n = norm(item.nome || item.name || item.titulo || '');
    if (n.indexOf('orcamento') >= 0) return 'orcamentos';
    if (n.indexOf('financ')    >= 0) return 'financeiro';
    if (n.indexOf('client')    >= 0) return 'clientes';
    if (n.indexOf('agendam')   >= 0) return 'agendamentos';
    if (n.indexOf('confirma')  >= 0) return 'agendamentos';
    if (n.indexOf('conteudo')  >= 0) return 'conteudo';
    if (n.indexOf('content')   >= 0) return 'conteudo';
    return n;
  }
  function normItem(raw) {
    return {
      nome:      raw.nome      || raw.name      || raw.titulo     || raw.title       || '',
      descricao: raw.descricao || raw.descrição  || raw.descricao_ || raw.description || raw.desc || '',
      icone:     raw.icone     || raw.ícone      || raw.icon       || '🌸',
      url:       raw.url       || raw.link       || raw.href       || '',
      cor:       raw.cor       || raw.color      || ''
    };
  }

  // ── SVG icons (Feather-style, 1.5 stroke) ──
  var ICONS = {
    orcamentos:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<rect x="8" y="3" width="8" height="3" rx="1"/>' +
        '<path d="M9 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3"/>' +
        '<path d="M8 12h8M8 16h5"/>' +
      '</svg>',
    financeiro:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M20 12V8a2 2 0 0 0-2-2H5a1 1 0 0 1 0-2h13"/>' +
        '<path d="M3 5v14a2 2 0 0 0 2 2h15a2 2 0 0 0 2-2v-4"/>' +
        '<circle cx="17" cy="14" r="1.5"/>' +
      '</svg>',
    clientes:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>' +
        '<circle cx="9" cy="7" r="4"/>' +
        '<path d="M22 21v-2a4 4 0 0 0-3-3.87"/>' +
        '<path d="M16 3.13a4 4 0 0 1 0 7.75"/>' +
      '</svg>',
    agendamentos:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<rect x="3" y="5" width="18" height="16" rx="2"/>' +
        '<path d="M16 3v4M8 3v4M3 10h18"/>' +
      '</svg>',
    conteudo:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M12 3l1.6 5L19 9.5 13.6 11 12 16l-1.6-5L5 9.5 10.4 8z"/>' +
        '<path d="M19 15l.7 2.3 2.3.7-2.3.7L19 21l-.7-2.3-2.3-.7 2.3-.7z"/>' +
      '</svg>',
    estoque:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>' +
        '<polyline points="3.27 6.96 12 12.01 20.73 6.96"/>' +
        '<line x1="12" y1="22.08" x2="12" y2="12"/>' +
      '</svg>',
    tarefas:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<line x1="8" y1="6" x2="21" y2="6"/>' +
        '<line x1="8" y1="12" x2="21" y2="12"/>' +
        '<line x1="8" y1="18" x2="21" y2="18"/>' +
        '<line x1="3" y1="6" x2="3.01" y2="6"/>' +
        '<line x1="3" y1="12" x2="3.01" y2="12"/>' +
        '<line x1="3" y1="18" x2="3.01" y2="18"/>' +
      '</svg>',
    arrow:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M5 12h14M13 6l6 6-6 6"/>' +
      '</svg>'
  };
  function iconSvg(key) { return ICONS[key] || ICONS.arrow; }

  // ── Renderiza os cards ──
  function buildCards(systems) {
    var byKey = {};
    systems.forEach(function(raw) {
      var item = normItem(raw);
      if (!item.nome) return;
      byKey[keyFor(item)] = item;
    });

    if (!byKey.orcamentos) byKey.orcamentos = normItem(FALLBACK[0]);
    if (!byKey.orcamentos.url) byKey.orcamentos.url = 'orcamentos/';

    // ── Operação ──
    var opsHtml = '';
    ORDER_OPS.forEach(function(k) {
      var item = byKey[k];
      if (!item) {
        var fb = FALLBACK.find(function(f){ return keyFor(f) === k; });
        if (!fb) return;
        item = normItem(fb);
      }

      if (k === 'orcamentos') {
        opsHtml +=
          '<a href="' + esc(item.url) + '" class="card-orca">' +
            '<div class="sys-icon-wrap">' + iconSvg('orcamentos') + '</div>' +
            '<div class="orca-text">' +
              '<div class="orca-badge">Principal</div>' +
              '<div class="sys-name">' + esc(item.nome || 'Orçamentos') + '</div>' +
              '<div class="sys-desc">' + esc(item.descricao || 'Início do fluxo — feche tudo em um clique') + '</div>' +
            '</div>' +
            '<div class="sys-arrow">' + iconSvg('arrow') + '</div>' +
          '</a>';
      } else {
        var cls =
          k === 'financeiro'   ? 'card-fin'    :
          k === 'clientes'     ? 'card-client' :
          k === 'agendamentos' ? 'card-conf'   : '';
        var defaultDesc =
          k === 'financeiro'   ? 'Entradas e saídas do mês'     :
          k === 'clientes'     ? 'Atendimentos previstos'       :
          k === 'agendamentos' ? 'Confirmação avulsa de agenda' : '';
        opsHtml +=
          '<a href="' + esc(item.url) + '" class="sys-card ' + cls + '">' +
            '<div class="sys-icon-wrap">' + iconSvg(k) + '</div>' +
            '<div class="sys-name">' + esc(item.nome) + '</div>' +
            '<div class="sys-desc">' + esc(item.descricao || defaultDesc) + '</div>' +
            '<div class="sys-arrow">' + iconSvg('arrow') + '</div>' +
          '</a>';
      }
    });
    document.getElementById('ops-grid').innerHTML = opsHtml;

    // ── Conteúdo ──
    var cont = byKey.conteudo;
    if (!cont) {
      var fbCont = FALLBACK.find(function(f){ return keyFor(f) === 'conteudo'; });
      if (fbCont) cont = normItem(fbCont);
    }
    if (cont) {
      document.getElementById('creative-section').innerHTML =
        '<a href="' + esc(cont.url) + '" class="creative-card">' +
          '<div class="creative-icon">' + iconSvg('conteudo') + '</div>' +
          '<div class="creative-text">' +
            '<div class="creative-name">' + esc(cont.nome || 'Conteúdo') + '</div>' +
            '<div class="creative-desc">' + esc(cont.descricao || 'Planejamento de posts e ideias') + '</div>' +
          '</div>' +
          '<span class="creative-arrow">' + iconSvg('arrow') + '</span>' +
        '</a>';
    } else {
      document.getElementById('creative-section').innerHTML =
        '<div style="text-align:center;padding:14px;color:var(--muted);font-size:12px;">Sem itens de conteúdo cadastrados na planilha.</div>';
    }
  }

  function esc(s) {
    return String(s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── Gestão ──
  function buildGestao() {
    var GESTAO = [
      { key: 'estoque', nome: 'Estoque',  desc: 'Produtos, equipamentos e wishlist', url: 'estoque/', cls: 'card-estoque' },
      { key: 'tarefas', nome: 'Tarefas',  desc: 'To-do list da empresa',             url: 'tarefas/', cls: 'card-tarefas' },
    ];
    document.getElementById('gestao-grid').innerHTML = GESTAO.map(function(c) {
      return '<a href="' + esc(c.url) + '" class="sys-card ' + c.cls + '">' +
        '<div class="sys-icon-wrap">' + iconSvg(c.key) + '</div>' +
        '<div class="sys-name">' + esc(c.nome) + '</div>' +
        '<div class="sys-desc">' + esc(c.desc) + '</div>' +
        '<div class="sys-arrow">' + iconSvg('arrow') + '</div>' +
      '</a>';
    }).join('');
  }

  // ── Widget To-Do ──
  async function loadTodoWidget() {
    if (typeof DB === 'undefined' || window._SB_ERROR) return;
    try {
      var now  = new Date(), day = now.getDay();
      var mon  = new Date(now); mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
      var sun  = new Date(mon); sun.setDate(mon.getDate() + 6);
      function fmt(d) { return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate()); }
      var ws = fmt(mon), we = fmt(sun), hoje = fmt(now);
      var all = await DB.tarefas.list();
      var sem = all.filter(function(t) {
        return !t.feita && t.prazo && t.prazo >= ws && t.prazo <= we;
      });
      var section = document.getElementById('todo-section');
      if (!sem.length) { section.style.display = 'none'; return; }
      var DPTS = ['dom','seg','ter','qua','qui','sex','sáb'];
      var html = sem.slice(0, 5).map(function(t) {
        var parts = t.prazo.split('-');
        var d = new Date(parseInt(parts[0]), parseInt(parts[1])-1, parseInt(parts[2]));
        var dia = t.prazo === hoje ? 'hoje' : DPTS[d.getDay()];
        var isHoje = t.prazo === hoje;
        return '<div class="todo-hub-item">' +
          '<button class="todo-hub-check" onclick="hubToggle(\'' + esc(t.id) + '\',this)" aria-label="Concluir">' +
            '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' +
          '</button>' +
          (t.prioridade === 'alta' ? '<div class="todo-hub-prio"></div>' : '') +
          '<div class="todo-hub-titulo">' + esc(t.titulo) + '</div>' +
          '<div class="todo-hub-dia' + (isHoje ? ' dia-hoje' : '') + '">' + dia + '</div>' +
        '</div>';
      }).join('');
      html += '<a href="tarefas/" class="todo-hub-ver">Ver todas as tarefas' +
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>' +
      '</a>';
      document.getElementById('todo-widget').innerHTML = html;
      section.style.display = 'block';
    } catch(e) { /* silencioso — tabela pode não existir ainda */ }
  }

  async function hubToggle(id, btn) {
    btn.disabled = true;
    try {
      var all = await DB.tarefas.list();
      var t   = all.find(function(x) { return x.id === id; });
      if (!t) return;
      t.feita = true;
      await DB.tarefas.upsert(t);
      loadTodoWidget();
    } catch(e) { btn.disabled = false; }
  }

  // ── Carrega os cards (somente FALLBACK — sem GAS) ──
  function loadHub() {
    localStorage.removeItem('hub_systems');
    buildCards(FALLBACK);
    buildGestao();
  }

  // ── Data ──
  (function init() {
    var now   = new Date();
    var DIAS  = ['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];
    var MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
    document.getElementById('hero-date').textContent =
      DIAS[now.getDay()] + ', ' + now.getDate() + ' de ' + MESES[now.getMonth()] + ' de ' + now.getFullYear();

    checkAuth();
  })();

  // ── AUTH ──────────────────────────────────────────────────
  function checkAuth() {
    var s = localStorage.getItem('mk_session');
    if (s) {
      try {
        var sess = JSON.parse(s);
        if (Date.now() < sess.expires) { showHub(); return; }
      } catch(e) {}
      localStorage.removeItem('mk_session');
    }
    showLogin();
  }

  function showLogin() {
    document.getElementById('login-overlay').style.display = 'flex';
    document.getElementById('hub-app').style.display = 'none';
    setTimeout(function() { var u = document.getElementById('login-user'); if(u) u.focus(); }, 100);
  }

  function showHub() {
    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('hub-app').style.display = 'block';
    loadHub();
    loadTodoWidget();
  }

  async function doLogin() {
    var user = (document.getElementById('login-user').value || '').trim().toLowerCase();
    var pass = document.getElementById('login-pass').value || '';
    var remember = document.getElementById('login-remember').checked;
    var btn = document.getElementById('login-btn');
    if (!user || !pass) { showErr('Preencha usuário e senha.'); return; }
    btn.disabled = true; btn.textContent = 'Verificando...';

    // Diagnóstico: verifica pré-requisitos antes de chamar Supabase
    if (typeof DB === 'undefined') {
      var diagMsg = 'Erro interno: DB não definido.';
      if (typeof supabase === 'undefined') diagMsg = 'Erro: CDN supabase-js não carregou (sem internet?).';
      else if (!window.ENV || !window.ENV.SUPABASE_URL) diagMsg = 'Erro: config.js sem SUPABASE_URL — configure os Secrets no GitHub.';
      showErr(diagMsg);
      btn.disabled = false; btn.textContent = 'Entrar';
      return;
    }
    if (window._SB_ERROR) {
      showErr('Erro Supabase: ' + window._SB_ERROR);
      btn.disabled = false; btn.textContent = 'Entrar';
      return;
    }

    try {
      var resultado = await DB.auth.login(user, pass);
      if (resultado) {
        var expires = Date.now() + (remember ? 30*24*60*60*1000 : 8*60*60*1000);
        localStorage.setItem('mk_session', JSON.stringify({ expires: expires, usuario: resultado.usuario, nivel: resultado.nivel }));
        showHub();
      } else {
        showErr('Usuário ou senha incorretos.');
        document.getElementById('login-pass').value = '';
        document.getElementById('login-pass').focus();
      }
    } catch(e) {
      console.error('[doLogin] erro:', e);
      var msg = (e && e.message) ? e.message : String(e);
      showErr('Erro: ' + msg);
    } finally {
      btn.disabled = false; btn.textContent = 'Entrar';
    }
  }

  function doLogout() {
    localStorage.removeItem('mk_session');
    showLogin();
  }

  function showErr(msg) {
    var e = document.getElementById('login-err');
    e.textContent = msg; e.style.display = 'block';
    setTimeout(function() { e.style.display = 'none'; }, 3000);
  }