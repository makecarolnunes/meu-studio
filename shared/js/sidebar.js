/**
 * sidebar.js — Barra lateral de navegação compartilhada
 * @makecarolnunes Studio
 *
 * Uso: <script src="../shared/js/sidebar.js"></script>
 */
(function () {
  'use strict';

  // ── Detecção de módulo ativo ──────────────────────────────
  var _p  = window.location.pathname;
  var _qs = window.location.search;

  var ACTIVE = 'hub';
  var BASE   = './';

  if      (_p.indexOf('/conteudo/brand-brain')      !== -1) { ACTIVE = 'radar';       BASE = '../'; }
  else if (_p.indexOf('/conteudo/direcao-criativa') !== -1) { ACTIVE = 'direcao';     BASE = '../'; }
  else if (_p.indexOf('/conteudo/centro-de-marca')  !== -1) { ACTIVE = 'centromarca'; BASE = '../'; }
  else if (_p.indexOf('/conteudo/concorrentes')     !== -1) { ACTIVE = 'radar';       BASE = '../'; }
  else if (_p.indexOf('/estrategia')                !== -1) { ACTIVE = 'cdc';         BASE = '../'; }
  else if (_p.indexOf('/formacao-vip')              !== -1) { ACTIVE = 'formacao';    BASE = '../'; }
  else if (_p.indexOf('/instagram')                 !== -1) {
    BASE = '../';
    ACTIVE = _qs.indexOf('tab=validador') !== -1 ? 'validador' : 'instagram';
  }
  else if (_p.indexOf('/financeiro/fiscal')         !== -1) { ACTIVE = 'financeiro';  BASE = '../'; }
  else {
    var _mapa = [
      ['financeiro',  '/financeiro'],
      ['orcamentos',  '/orcamentos'],
      ['clientes',    '/clientes'],
      ['conteudo',    '/conteudo'],
      ['anotacoes',   '/anotacoes'],
      ['tarefas',     '/tarefas'],
      ['estoque',     '/estoque'],
    ];
    for (var _i = 0; _i < _mapa.length; _i++) {
      if (_p.indexOf(_mapa[_i][1]) !== -1) {
        ACTIVE = _mapa[_i][0];
        BASE   = '../';
        break;
      }
    }
  }

  // ── Ícones SVG ───────────────────────────────────────────
  var IC = {
    home:  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
    fin:   '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>',
    doc:   '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
    usr:   '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>',
    cal:   '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    cam:   '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>',
    note:  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>',
    task:  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>',
    box:   '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',
    menu:  '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>',
    back:  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>',
    out:   '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
    ig:    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>',
    radar: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>',
    check: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    cdc:   '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    pin:   '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a5 5 0 015 5c0 2.38-1.32 4.45-3.25 5.54L12 22l-1.75-9.46A5.99 5.99 0 017 7a5 5 0 015-5z"/><circle cx="12" cy="7" r="2"/></svg>',
    chev:  '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>',
    cap:   '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10L12 5 2 10l10 5 10-5z"/><path d="M6 12v5c0 1 2.5 3 6 3s6-2 6-3v-5"/></svg>',
  };

  // ── Estrutura de grupos ───────────────────────────────────
  var GROUPS = [
    {
      id: 'operacao',
      label: 'Operação',
      items: [
        { id: 'orcamentos', label: 'Orçamentos', path: 'orcamentos/orcamentos_novo.html', icon: IC.doc },
        { id: 'financeiro', label: 'Financeiro', path: 'financeiro/',                     icon: IC.fin },
        { id: 'clientes',   label: 'Clientes',   path: 'clientes/',                       icon: IC.usr },
      ]
    },
    {
      id: 'conteudo',
      label: 'Conteúdo',
      items: [
        { id: 'conteudo',   label: 'Lista de Conteúdos', path: 'conteudo/',                        icon: IC.cam   },
        { id: 'direcao',    label: 'Direção Criativa',   path: 'conteudo/direcao-criativa.html',   icon: IC.cdc   },
        { id: 'instagram',  label: 'Instagram',           path: 'instagram/',                       icon: IC.ig    },
        { id: 'validador',  label: 'Validador',           path: 'instagram/?tab=validador',         icon: IC.check },
      ]
    },
    {
      id: 'formacao',
      label: 'Formação',
      items: [
        { id: 'formacao', label: 'Cachos & Crespos', path: 'formacao-vip/', icon: IC.cap },
      ]
    },
    {
      id: 'planejamento',
      label: 'Planejamento',
      items: [
        { id: 'tarefas',   label: 'Tarefas',   path: 'tarefas/',   icon: IC.task },
        { id: 'anotacoes', label: 'Anotações', path: 'anotacoes/', icon: IC.note },
      ]
    },
    {
      id: 'estrategia',
      label: 'Estratégia',
      items: [
        { id: 'radar',       label: 'Insights de Mercado', path: 'conteudo/brand-brain.html',         icon: IC.radar },
        { id: 'centromarca', label: 'Análise de Marca',    path: 'conteudo/centro-de-marca.html',     icon: IC.pin   },
        { id: 'cdc',         label: 'Manual de Marca',     path: 'estrategia/centro-de-comando.html', icon: IC.cdc   },
      ]
    },
    {
      id: 'gestao',
      label: 'Gestão',
      items: [
        { id: 'estoque',    label: 'Estoque',      path: 'estoque/',     icon: IC.box },
      ]
    },
  ];

  // Qual grupo contém o item ativo
  function _activeGroup() {
    for (var i = 0; i < GROUPS.length; i++) {
      for (var j = 0; j < GROUPS[i].items.length; j++) {
        if (GROUPS[i].items[j].id === ACTIVE) return GROUPS[i].id;
      }
    }
    return null;
  }
  var ACTIVE_GROUP = _activeGroup();

  // ── Estado de colapso (localStorage) ────────────────────
  var LS_KEY = 'mk_sb_collapsed';

  function _getCollapsed() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch (e) { return []; }
  }
  function _setCollapsed(arr) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(arr)); } catch (e) {}
  }
  function _isCollapsed(gid) {
    if (gid === ACTIVE_GROUP) return false; // grupo ativo nunca colapsa
    return _getCollapsed().indexOf(gid) !== -1;
  }
  function _toggleCollapse(gid) {
    if (gid === ACTIVE_GROUP) return;
    var arr = _getCollapsed();
    var idx = arr.indexOf(gid);
    if (idx !== -1) arr.splice(idx, 1); else arr.push(gid);
    _setCollapsed(arr);
    _applyCollapse(gid, arr.indexOf(gid) !== -1);
  }
  function _applyCollapse(gid, collapsed) {
    var grpEl = document.getElementById('mk-grp-' + gid);
    if (!grpEl) return;
    if (collapsed) grpEl.classList.add('mk-closed');
    else grpEl.classList.remove('mk-closed');
  }

  // ── CSS ──────────────────────────────────────────────────
  var CSS = '\
#mk-sb-fab,#mk-sidebar,#mk-sb-bd{\
  box-sizing:border-box;\
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;\
  -webkit-tap-highlight-color:transparent;\
}\
\
/* ── FAB ─────────────────────────────────────────────── */\
#mk-sb-fab{\
  position:fixed;top:13px;left:13px;z-index:901;\
  width:36px;height:36px;border-radius:50%;\
  border:.5px solid rgba(255,255,255,.18);\
  background:rgba(18,5,1,.82);\
  backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);\
  color:rgba(255,255,255,.85);\
  display:flex;align-items:center;justify-content:center;\
  cursor:pointer;box-shadow:0 2px 12px rgba(0,0,0,.32);\
  transition:opacity .22s,transform .18s,background .15s;\
  padding:0;\
}\
#mk-sb-fab:hover{background:rgba(18,5,1,.97)}\
#mk-sb-fab:active{transform:scale(.9)}\
#mk-sb-fab.mk-gone{opacity:0;pointer-events:none;transform:scale(.78)}\
\
/* ── Backdrop ────────────────────────────────────────── */\
#mk-sb-bd{\
  position:fixed;inset:0;z-index:899;\
  background:rgba(0,0,0,.48);\
  opacity:0;pointer-events:none;\
  transition:opacity .3s ease;\
}\
#mk-sb-bd.mk-on{opacity:1;pointer-events:all}\
\
/* ── Sidebar ─────────────────────────────────────────── */\
#mk-sidebar{\
  position:fixed;top:0;left:0;\
  height:100vh;height:100dvh;\
  width:228px;z-index:900;\
  background:rgba(14,4,1,.93);\
  backdrop-filter:blur(24px) saturate(1.5);\
  -webkit-backdrop-filter:blur(24px) saturate(1.5);\
  border-right:.5px solid rgba(255,255,255,.07);\
  box-shadow:6px 0 36px rgba(0,0,0,.32);\
  display:flex;flex-direction:column;\
  transform:translateX(-234px);\
  transition:transform .3s cubic-bezier(.4,0,.2,1);\
  overflow:hidden;will-change:transform;\
}\
#mk-sidebar.mk-on{transform:translateX(0)}\
\
/* ── Header ──────────────────────────────────────────── */\
.mk-sb-hd{\
  display:flex;align-items:center;\
  justify-content:space-between;\
  padding:20px 14px 14px;\
  border-bottom:.5px solid rgba(255,255,255,.06);\
  flex-shrink:0;\
}\
.mk-sb-logo{display:flex;align-items:center;gap:9px}\
.mk-sb-logo-em{\
  font-size:20px;line-height:1;\
  filter:drop-shadow(0 1px 4px rgba(0,0,0,.5));\
}\
.mk-sb-logo-tx{\
  font-size:13.5px;font-weight:700;\
  color:rgba(255,255,255,.9);\
  letter-spacing:-.02em;line-height:1.2;\
}\
.mk-sb-logo-sub{\
  font-size:9px;font-weight:500;\
  color:rgba(255,255,255,.32);\
  letter-spacing:.08em;text-transform:uppercase;\
  margin-top:2px;\
}\
.mk-sb-btn{\
  width:28px;height:28px;border-radius:7px;\
  border:.5px solid rgba(255,255,255,.1);\
  background:rgba(255,255,255,.055);\
  color:rgba(255,255,255,.55);\
  display:flex;align-items:center;justify-content:center;\
  cursor:pointer;padding:0;\
  transition:background .14s,color .14s;\
}\
.mk-sb-btn:hover{background:rgba(255,255,255,.12);color:rgba(255,255,255,.9)}\
\
/* ── Nav ─────────────────────────────────────────────── */\
.mk-sb-nav{\
  flex:1;padding:8px 8px 4px;\
  overflow-y:auto;scrollbar-width:none;\
}\
.mk-sb-nav::-webkit-scrollbar{display:none}\
\
/* Item standalone (Início) */\
.mk-sb-a{\
  display:flex;align-items:center;gap:9px;\
  padding:9px 10px;border-radius:8px;\
  text-decoration:none;\
  color:rgba(255,255,255,.52);\
  font-size:13px;font-weight:450;\
  letter-spacing:-.01em;\
  transition:background .13s,color .13s;\
  white-space:nowrap;position:relative;\
}\
.mk-sb-a:hover{background:rgba(255,255,255,.065);color:rgba(255,255,255,.82)}\
.mk-sb-a.mk-cur{\
  background:rgba(212,83,126,.2);\
  color:#F9D0DF;\
  font-weight:640;\
}\
.mk-sb-a.mk-cur:hover{background:rgba(212,83,126,.28)}\
.mk-sb-a.mk-cur::before{\
  content:"";\
  position:absolute;left:-1px;top:50%;\
  transform:translateY(-50%);\
  width:3.5px;height:22px;\
  background:linear-gradient(180deg,#e87aa0,#c94572);\
  border-radius:0 4px 4px 0;\
  box-shadow:0 0 8px rgba(212,83,126,.5);\
}\
.mk-sb-ic{\
  flex-shrink:0;\
  width:16px;height:16px;\
  display:flex;align-items:center;justify-content:center;\
  opacity:.7;\
}\
.mk-sb-a.mk-cur .mk-sb-ic{opacity:1}\
\
/* ── Grupos ──────────────────────────────────────────── */\
.mk-sb-grp{\
  margin-top:6px;\
}\
.mk-sb-grp + .mk-sb-grp{\
  border-top:.5px solid rgba(255,255,255,.055);\
  padding-top:5px;\
}\
.mk-sb-grp-hd{\
  display:flex;align-items:center;justify-content:space-between;\
  padding:6px 10px 5px;\
  cursor:pointer;\
  border-radius:7px;\
  user-select:none;-webkit-user-select:none;\
  transition:background .13s;\
}\
.mk-sb-grp-hd:hover{background:rgba(255,255,255,.04)}\
.mk-sb-grp-hd:active{background:rgba(255,255,255,.08)}\
.mk-sb-grp-label{\
  font-size:9px;font-weight:750;\
  text-transform:uppercase;letter-spacing:.12em;\
  color:rgba(255,255,255,.3);\
  transition:color .15s;\
}\
.mk-sb-grp.mk-has-active .mk-sb-grp-label{\
  color:rgba(212,83,126,.75);\
}\
.mk-sb-grp-arr{\
  color:rgba(255,255,255,.25);\
  transition:transform .22s ease,color .15s;\
  flex-shrink:0;line-height:0;\
}\
.mk-sb-grp.mk-has-active .mk-sb-grp-arr{color:rgba(212,83,126,.55)}\
.mk-sb-grp.mk-closed .mk-sb-grp-arr{transform:rotate(-90deg)}\
\
/* Animação de colapso via grid-template-rows */\
.mk-sb-grp-body{\
  display:grid;\
  grid-template-rows:1fr;\
  transition:grid-template-rows .22s ease;\
}\
.mk-sb-grp.mk-closed .mk-sb-grp-body{grid-template-rows:0fr}\
.mk-sb-grp-inner{\
  overflow:hidden;\
  display:flex;flex-direction:column;gap:1px;\
  padding-bottom:3px;\
}\
\
/* Item dentro de grupo — levemente recuado */\
.mk-sb-grp .mk-sb-a{\
  padding-left:12px;\
}\
.mk-sb-grp .mk-sb-a.mk-cur::before{\
  left:-1px;\
}\
\
/* ── Footer ──────────────────────────────────────────── */\
.mk-sb-ft{\
  padding:8px 8px 14px;\
  border-top:.5px solid rgba(255,255,255,.06);\
  flex-shrink:0;\
}\
.mk-sb-user{\
  display:flex;align-items:center;gap:9px;\
  padding:7px 10px;margin-bottom:4px;\
}\
.mk-sb-av{\
  width:26px;height:26px;border-radius:50%;\
  background:rgba(212,83,126,.22);\
  border:1px solid rgba(212,83,126,.36);\
  display:flex;align-items:center;justify-content:center;\
  font-size:10.5px;color:#F4C0D1;font-weight:700;\
  flex-shrink:0;letter-spacing:-.01em;\
}\
.mk-sb-un{\
  font-size:11px;font-weight:500;\
  color:rgba(255,255,255,.5);\
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;\
}\
.mk-sb-out{\
  display:flex;align-items:center;gap:9px;\
  padding:8px 10px;border-radius:8px;\
  border:none;background:none;\
  color:rgba(255,255,255,.35);\
  font-size:13px;cursor:pointer;\
  width:100%;text-align:left;\
  transition:background .13s,color .13s;\
  letter-spacing:-.01em;\
}\
.mk-sb-out:hover{background:rgba(255,70,70,.1);color:rgba(255,130,130,.82)}\
.mk-sb-out-ic{\
  width:16px;height:16px;\
  display:flex;align-items:center;justify-content:center;\
  flex-shrink:0;\
}\
';

  // ── HTML ─────────────────────────────────────────────────
  function _html() {
    var sess = null;
    try { sess = JSON.parse(localStorage.getItem('mk_session') || 'null'); } catch (e) {}
    var uname = (sess && sess.usuario) ? sess.usuario : 'carol';
    var ini   = uname.charAt(0).toUpperCase();

    // Item "Início" standalone
    var homeItem = '<a href="' + BASE + '" class="mk-sb-a' + (ACTIVE === 'hub' ? ' mk-cur' : '') + '">'
      + '<span class="mk-sb-ic">' + IC.home + '</span>'
      + '<span>Início</span>'
      + '</a>';

    // Grupos com accordion
    var groupsHtml = GROUPS.map(function (g) {
      var hasActive = g.items.some(function (it) { return it.id === ACTIVE; });
      var collapsed = _isCollapsed(g.id);
      var grpCls = 'mk-sb-grp'
        + (hasActive   ? ' mk-has-active' : '')
        + (collapsed   ? ' mk-closed'     : '');

      var itemsHtml = g.items.map(function (m) {
        var cls = 'mk-sb-a' + (m.id === ACTIVE ? ' mk-cur' : '');
        return '<a href="' + BASE + m.path + '" class="' + cls + '">'
          + '<span class="mk-sb-ic">' + m.icon + '</span>'
          + '<span>' + m.label + '</span>'
          + '</a>';
      }).join('');

      return '<div class="' + grpCls + '" id="mk-grp-' + g.id + '">'
        + '<div class="mk-sb-grp-hd" onclick="mkSidebarToggleGroup(\'' + g.id + '\')" role="button" aria-label="' + g.label + '">'
        +   '<span class="mk-sb-grp-label">' + g.label + '</span>'
        +   '<span class="mk-sb-grp-arr">' + IC.chev + '</span>'
        + '</div>'
        + '<div class="mk-sb-grp-body">'
        +   '<div class="mk-sb-grp-inner">' + itemsHtml + '</div>'
        + '</div>'
        + '</div>';
    }).join('');

    var logoSvg = '<svg width="19" height="19" viewBox="0 0 40 40" fill="none" stroke="rgba(255,255,255,.88)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="display:block"><path d="M20 5l2.8 9.4L32 17l-9.2 2.6L20 29l-2.8-9.4L8 17l9.2-2.6z"/><path d="M30 28l1 3 3 1-3 1-1 3-1-3-3-1 3-1z"/></svg>';

    return ''
      + '<button id="mk-sb-fab" onclick="mkSidebarToggle()" aria-label="Menu">' + IC.menu + '</button>'
      + '<div id="mk-sb-bd" onclick="mkSidebarClose()"></div>'
      + '<aside id="mk-sidebar" role="navigation" aria-label="Navegação">'
      +   '<div class="mk-sb-hd">'
      +     '<div class="mk-sb-logo">'
      +       '<span class="mk-sb-logo-em">' + logoSvg + '</span>'
      +       '<div>'
      +         '<div class="mk-sb-logo-tx">Meu Studio</div>'
      +         '<div class="mk-sb-logo-sub">@makecarolnunes</div>'
      +       '</div>'
      +     '</div>'
      +     '<button class="mk-sb-btn" onclick="mkSidebarClose()" aria-label="Fechar menu">' + IC.back + '</button>'
      +   '</div>'
      +   '<nav class="mk-sb-nav">'
      +     homeItem
      +     groupsHtml
      +   '</nav>'
      +   '<div class="mk-sb-ft">'
      +     '<div class="mk-sb-user">'
      +       '<div class="mk-sb-av">' + ini + '</div>'
      +       '<span class="mk-sb-un">@' + uname + '</span>'
      +     '</div>'
      +     '<button class="mk-sb-out" onclick="mkSidebarLogout()">'
      +       '<span class="mk-sb-out-ic">' + IC.out + '</span>'
      +       '<span>Sair</span>'
      +     '</button>'
      +   '</div>'
      + '</aside>';
  }

  // ── API pública ──────────────────────────────────────────
  window.mkSidebarToggle = function () {
    var sb = document.getElementById('mk-sidebar');
    if (!sb) return;
    if (sb.classList.contains('mk-on')) _close(); else _open();
  };

  window.mkSidebarToggleGroup = function (gid) {
    _toggleCollapse(gid);
  };

  window.mkSidebarOpen  = _open;
  window.mkSidebarClose = _close;

  function _open() {
    var sb  = document.getElementById('mk-sidebar');
    var bd  = document.getElementById('mk-sb-bd');
    var fab = document.getElementById('mk-sb-fab');
    if (!sb) return;
    sb.classList.add('mk-on');
    if (bd)  bd.classList.add('mk-on');
    if (fab) fab.classList.add('mk-gone');
  }

  function _close() {
    var sb  = document.getElementById('mk-sidebar');
    var bd  = document.getElementById('mk-sb-bd');
    var fab = document.getElementById('mk-sb-fab');
    if (!sb) return;
    sb.classList.remove('mk-on');
    if (bd)  bd.classList.remove('mk-on');
    if (fab) fab.classList.remove('mk-gone');
  }

  window.mkSidebarLogout = function () {
    _close();
    if (typeof window.doLogout === 'function') {
      window.doLogout();
    } else {
      localStorage.removeItem('mk_session');
      window.location.href = BASE;
    }
  };

  // ── Init ─────────────────────────────────────────────────
  function _init() {
    if (document.getElementById('mk-sb-fab')) return;

    var st = document.createElement('style');
    st.id  = 'mk-sb-css';
    st.textContent = CSS;
    document.head.appendChild(st);

    document.body.insertAdjacentHTML('beforeend', _html());

    // Hub: esconde FAB durante tela de login
    if (ACTIVE === 'hub') {
      var hubApp = document.getElementById('hub-app');
      if (hubApp) {
        var fab = document.getElementById('mk-sb-fab');
        function _syncFab() {
          var loggedIn = hubApp.style.display !== 'none';
          if (fab) {
            if (loggedIn) fab.classList.remove('mk-gone');
            else { fab.classList.add('mk-gone'); _close(); }
          }
        }
        _syncFab();
        var obs = new MutationObserver(_syncFab);
        obs.observe(hubApp, { attributes: true, attributeFilter: ['style'] });
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }
})();
