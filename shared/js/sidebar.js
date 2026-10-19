/**
 * sidebar.js — Barra lateral de navegação compartilhada
 * @makecarolnunes Studio
 *
 * Uso: <script src="../shared/js/sidebar.js"></script>
 *
 * Menu principal enxuto: só os módulos do dia a dia. Os demais continuam
 * funcionando nas próprias rotas e ficam listados em /modulos/
 * ("Outros módulos", link discreto no rodapé da barra).
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
  else if (_p.indexOf('/conteudo/tiktok')           !== -1) { ACTIVE = 'tiktok';      BASE = '../'; }
  else if (_p.indexOf('/conteudo') !== -1 && _qs.indexOf('view=acervo') !== -1) { ACTIVE = 'acervo'; BASE = '../'; }
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
      ['modulos',     '/modulos'],
    ];
    for (var _i = 0; _i < _mapa.length; _i++) {
      if (_p.indexOf(_mapa[_i][1]) !== -1) {
        ACTIVE = _mapa[_i][0];
        BASE   = '../';
        break;
      }
    }
  }

  // ── Ícones SVG (traço fino, monocromáticos) ──────────────
  function _svg(d, w) {
    return '<svg width="' + (w || 16) + '" height="' + (w || 16) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';
  }
  var IC = {
    home: _svg('<path d="M3 10l9-7 9 7v10a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z"/>'),
    fin:  _svg('<line x1="12" y1="2" x2="12" y2="22"/><path d="M17 6H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>'),
    doc:  _svg('<path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><polyline points="14 3 14 8 19 8"/>'),
    cam:  _svg('<rect x="3" y="4" width="7" height="16" rx="1.5"/><rect x="14" y="4" width="7" height="10" rx="1.5"/>'),
    ig:   _svg('<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/>'),
    note: _svg('<path d="M5 4h11l3 3v13H5z"/><line x1="9" y1="10" x2="15" y2="10"/><line x1="9" y1="14" x2="15" y2="14"/>'),
    grid: _svg('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>', 15),
    menu: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/></svg>',
    back: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>',
    out:  _svg('<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>', 15),
  };

  // ── Menu principal ───────────────────────────────────────
  var GROUPS = [
    {
      id: 'operacao',
      label: 'Operação',
      items: [
        { id: 'orcamentos', label: 'Orçamentos', path: 'orcamentos/orcamentos_novo.html', icon: IC.doc },
        { id: 'financeiro', label: 'Financeiro', path: 'financeiro/',                     icon: IC.fin },
      ]
    },
    {
      id: 'conteudo',
      label: 'Conteúdo',
      items: [
        { id: 'conteudo',  label: 'Lista de Conteúdos', path: 'conteudo/',  icon: IC.cam },
        { id: 'instagram', label: 'Instagram',          path: 'instagram/', icon: IC.ig  },
      ]
    },
    {
      id: 'organizacao',
      label: 'Organização',
      items: [
        { id: 'anotacoes', label: 'Anotações', path: 'anotacoes/', icon: IC.note },
      ]
    },
  ];

  // Módulos fora do menu (rotas independentes, listadas em /modulos/)
  var HIDDEN = ['clientes', 'acervo', 'direcao', 'validador', 'formacao', 'cdc',
                'centromarca', 'radar', 'tiktok', 'tarefas', 'estoque', 'modulos'];
  var IN_HIDDEN = HIDDEN.indexOf(ACTIVE) !== -1;

  // ── CSS ──────────────────────────────────────────────────
  var CSS = '\
#mk-sb-fab,#mk-sb-back,#mk-sidebar,#mk-sb-bd{\
  box-sizing:border-box;\
  font-family:var(--font-sans,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif);\
  -webkit-tap-highlight-color:transparent;\
}\
\
/* ── Botões flutuantes (menu + voltar ao início) ─────── */\
#mk-sb-fab,#mk-sb-back{\
  position:fixed;top:12px;z-index:901;\
  width:36px;height:36px;border-radius:50%;\
  border:1px solid var(--border,#ECE9E5);\
  background:rgba(255,255,255,.92);\
  backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);\
  color:var(--text,#22201E);\
  display:flex;align-items:center;justify-content:center;\
  cursor:pointer;padding:0;text-decoration:none;\
  transition:opacity .2s,transform .15s,background .15s;\
}\
#mk-sb-fab{left:12px}\
#mk-sb-back{left:54px}\
#mk-sb-fab:hover,#mk-sb-back:hover{background:#fff}\
#mk-sb-fab:active,#mk-sb-back:active{transform:scale(.92)}\
#mk-sb-fab.mk-gone,#mk-sb-back.mk-gone{opacity:0;pointer-events:none;transform:scale(.8)}\
\
/* Esconde botões de voltar antigos de cada módulo — unificados acima */\
.hdr-back,.ig-back,.btn-back-float,#ms-back-btn{display:none!important}\
\
/* ── Backdrop ────────────────────────────────────────── */\
#mk-sb-bd{\
  position:fixed;inset:0;z-index:899;\
  background:rgba(20,18,16,.18);\
  opacity:0;pointer-events:none;\
  transition:opacity .25s ease;\
}\
#mk-sb-bd.mk-on{opacity:1;pointer-events:all}\
\
/* ── Painel ──────────────────────────────────────────── */\
#mk-sidebar{\
  position:fixed;top:0;left:0;\
  height:100vh;height:100dvh;\
  width:248px;z-index:900;\
  background:var(--surface,#fff);\
  border-right:1px solid var(--border,#ECE9E5);\
  box-shadow:0 0 40px rgba(20,18,16,.08);\
  display:flex;flex-direction:column;\
  transform:translateX(-260px);\
  transition:transform .28s cubic-bezier(.4,0,.2,1);\
  overflow:hidden;will-change:transform;\
}\
#mk-sidebar.mk-on{transform:translateX(0)}\
\
.mk-sb-hd{\
  display:flex;align-items:center;justify-content:space-between;\
  padding:22px 18px 18px 22px;flex-shrink:0;\
}\
.mk-sb-logo-tx{\
  font-size:15px;font-weight:600;color:var(--text,#22201E);\
  letter-spacing:-.01em;line-height:1.2;\
}\
.mk-sb-logo-sub{\
  font-size:11px;color:var(--text-subtle,#A19C96);margin-top:2px;\
}\
.mk-sb-btn{\
  width:30px;height:30px;border-radius:8px;border:none;\
  background:none;color:var(--text-subtle,#A19C96);\
  display:flex;align-items:center;justify-content:center;\
  cursor:pointer;padding:0;transition:background .14s,color .14s;\
}\
.mk-sb-btn:hover{background:var(--surface-2,#F4F2EF);color:var(--text,#22201E)}\
\
.mk-sb-nav{flex:1;padding:4px 12px;overflow-y:auto;scrollbar-width:none}\
.mk-sb-nav::-webkit-scrollbar{display:none}\
\
.mk-sb-a{\
  display:flex;align-items:center;gap:12px;\
  padding:10px 12px;border-radius:8px;\
  text-decoration:none;\
  color:var(--text-muted,#6E6963);\
  font-size:14px;font-weight:450;letter-spacing:-.005em;\
  transition:background .13s,color .13s;\
  white-space:nowrap;\
}\
.mk-sb-a:hover{background:var(--surface-2,#F4F2EF);color:var(--text,#22201E)}\
.mk-sb-a.mk-cur{background:var(--accent-soft,#F4EDE8);color:var(--text,#22201E);font-weight:600;position:relative}\
.mk-sb-a.mk-cur::before{content:"";position:absolute;left:0;top:9px;bottom:9px;width:3px;border-radius:0 3px 3px 0;background:var(--accent,#9A6B4F)}\
.mk-sb-ic{flex-shrink:0;width:16px;height:16px;display:flex;align-items:center;justify-content:center;opacity:.75}\
.mk-sb-a.mk-cur .mk-sb-ic{opacity:1;color:var(--accent,#9A6B4F)}\
\
.mk-sb-grp{margin-top:24px}\
.mk-sb-grp-label{\
  display:block;padding:0 12px 8px;\
  font-size:10.5px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;\
  color:var(--text-muted,#6E6963);\
}\
\
/* ── Rodapé ──────────────────────────────────────────── */\
.mk-sb-ft{padding:12px 12px 18px;border-top:1px solid var(--border,#ECE9E5);flex-shrink:0}\
.mk-sb-more{font-size:13px;padding:8px 12px}\
.mk-sb-row{display:flex;align-items:center;justify-content:space-between;padding:8px 12px 0}\
.mk-sb-un{font-size:12px;color:var(--text-subtle,#A19C96);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\
.mk-sb-out{\
  display:flex;align-items:center;gap:6px;\
  border:none;background:none;padding:4px 0;\
  color:var(--text-subtle,#A19C96);font-size:12px;cursor:pointer;\
  font-family:inherit;transition:color .13s;\
}\
.mk-sb-out:hover{color:var(--danger,#B4483C)}\
';

  // ── HTML ─────────────────────────────────────────────────
  function _link(m) {
    var cls = 'mk-sb-a' + (m.id === ACTIVE ? ' mk-cur' : '');
    return '<a href="' + BASE + m.path + '" class="' + cls + '">'
      + '<span class="mk-sb-ic">' + m.icon + '</span>'
      + '<span>' + m.label + '</span>'
      + '</a>';
  }

  function _html() {
    var sess = null;
    try { sess = JSON.parse(localStorage.getItem('mk_session') || 'null'); } catch (e) {}
    var uname = (sess && sess.usuario) ? sess.usuario : 'carol';

    var homeItem = _link({ id: 'hub', label: 'Início', path: '', icon: IC.home });

    var groupsHtml = GROUPS.map(function (g) {
      return '<div class="mk-sb-grp">'
        + '<span class="mk-sb-grp-label">' + g.label + '</span>'
        + g.items.map(_link).join('')
        + '</div>';
    }).join('');

    var moreItem = '<a href="' + BASE + 'modulos/" class="mk-sb-a mk-sb-more' + (IN_HIDDEN ? ' mk-cur' : '') + '">'
      + '<span class="mk-sb-ic">' + IC.grid + '</span><span>Outros módulos</span></a>';

    var backBtn = (ACTIVE === 'hub') ? ''
      : '<a id="mk-sb-back" href="' + BASE + '" aria-label="Voltar ao início" title="Voltar ao início">' + IC.back + '</a>';

    return ''
      + '<button id="mk-sb-fab" onclick="mkSidebarToggle()" aria-label="Menu">' + IC.menu + '</button>'
      + backBtn
      + '<div id="mk-sb-bd" onclick="mkSidebarClose()"></div>'
      + '<aside id="mk-sidebar" role="navigation" aria-label="Navegação">'
      +   '<div class="mk-sb-hd">'
      +     '<div>'
      +       '<div class="mk-sb-logo-tx">Meu Studio</div>'
      +       '<div class="mk-sb-logo-sub">@makecarolnunes</div>'
      +     '</div>'
      +     '<button class="mk-sb-btn" onclick="mkSidebarClose()" aria-label="Fechar menu">' + IC.back + '</button>'
      +   '</div>'
      +   '<nav class="mk-sb-nav">'
      +     homeItem
      +     groupsHtml
      +   '</nav>'
      +   '<div class="mk-sb-ft">'
      +     moreItem
      +     '<div class="mk-sb-row">'
      +       '<span class="mk-sb-un">@' + uname + '</span>'
      +       '<button class="mk-sb-out" onclick="mkSidebarLogout()">'
      +         '<span>' + IC.out + '</span><span>Sair</span>'
      +       '</button>'
      +     '</div>'
      +   '</div>'
      + '</aside>';
  }

  // ── API pública ──────────────────────────────────────────
  window.mkSidebarToggle = function () {
    var sb = document.getElementById('mk-sidebar');
    if (!sb) return;
    if (sb.classList.contains('mk-on')) _close(); else _open();
  };

  // Mantido por compatibilidade (o menu não tem mais grupos recolhíveis)
  window.mkSidebarToggleGroup = function () {};

  window.mkSidebarOpen  = _open;
  window.mkSidebarClose = _close;

  function _setOpen(on) {
    var sb = document.getElementById('mk-sidebar');
    if (!sb) return;
    sb.classList.toggle('mk-on', on);
    var bd = document.getElementById('mk-sb-bd');
    if (bd) bd.classList.toggle('mk-on', on);
    ['mk-sb-fab', 'mk-sb-back'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.classList.toggle('mk-gone', on);
    });
  }
  function _open()  { _setOpen(true); }
  function _close() { _setOpen(false); }

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

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') _close();
    });

    // Hub: esconde FAB durante tela de login
    if (ACTIVE === 'hub') {
      var hubApp = document.getElementById('hub-app');
      if (hubApp) {
        var fab = document.getElementById('mk-sb-fab');
        function _syncFab() {
          var loggedIn = hubApp.style.display !== 'none';
          if (fab) {
            if (loggedIn) fab.classList.remove('mk-gone');
            else { _close(); fab.classList.add('mk-gone'); }
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
