// ══════════════════════════════════════════════════════════
//  Instagram Dashboard — @makecarolnunes
//  Lê dados da Instagram Graph API e renderiza dashboard
//  com performance, horários de pico, hashtags e formatos.
// ══════════════════════════════════════════════════════════

(function() {
  'use strict';

  // ── STATE ─────────────────────────────────────────────────
  var TOKEN_KEY = 'mk_instagram_token';
  var CACHE_KEY = 'mk_instagram_cache';
  var CACHE_TTL = 30 * 60 * 1000; // 30 min

  var state = {
    token: '',
    profile: null,
    posts: [],
    updatedAt: null,
    chart: null
  };

  // ── BOOT ──────────────────────────────────────────────────
  function checkAuth() {
    var s = localStorage.getItem('mk_session');
    if (!s) { redirectHub(); return; }
    try {
      var sess = JSON.parse(s);
      if (Date.now() >= sess.expires) { redirectHub(); return; }
    } catch (e) { redirectHub(); return; }
    init();
  }

  function redirectHub() { window.location.href = '../'; }

  function init() {
    document.getElementById('ig-app').style.display = 'block';
    state.token = localStorage.getItem(TOKEN_KEY) || '';
    if (!state.token) { showSetup(); return; }
    loadFromCacheOrAPI();
  }

  // ── UI STATES ─────────────────────────────────────────────
  function showSetup() { swap('setup-screen'); }
  function showLoading(msg) {
    document.getElementById('loading-txt').textContent = msg || 'Carregando dados do Instagram...';
    swap('loading-screen');
  }
  function showError(title, msg) {
    document.getElementById('error-title').textContent = title || 'Erro';
    document.getElementById('error-msg').textContent = msg || '';
    swap('error-screen');
  }
  function showDashboard() { swap('dashboard'); }

  function swap(id) {
    ['setup-screen', 'loading-screen', 'error-screen', 'dashboard'].forEach(function(s) {
      var el = document.getElementById(s);
      if (el) el.style.display = (s === id) ? 'block' : 'none';
    });
  }

  // ── DATA LOAD ─────────────────────────────────────────────
  function loadFromCacheOrAPI() {
    var cached = readCache();
    if (cached) {
      state.profile = cached.profile;
      state.posts = cached.posts;
      state.updatedAt = cached.updatedAt;
      render();
      return;
    }
    fetchAll();
  }

  function readCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var c = JSON.parse(raw);
      if (!c || !c.updatedAt) return null;
      if (Date.now() - c.updatedAt > CACHE_TTL) return null;
      return c;
    } catch (e) { return null; }
  }

  function writeCache() {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        profile: state.profile,
        posts: state.posts,
        updatedAt: state.updatedAt
      }));
    } catch (e) {}
  }

  async function fetchAll() {
    showLoading('Conectando ao Instagram...');
    try {
      var profile = await fetchProfile();
      state.profile = profile;
      document.getElementById('loading-txt').textContent = 'Carregando últimos posts...';
      var posts = await fetchMedia();
      state.posts = posts;
      state.updatedAt = Date.now();
      writeCache();
      render();
    } catch (err) {
      console.error('[ig] fetch error:', err);
      var msg = (err && err.message) ? err.message : 'Erro desconhecido';
      if (/OAuth|token|session/i.test(msg)) {
        showError('Token inválido ou expirado', 'Gere um novo token no Facebook Developer e atualize aqui.');
      } else {
        showError('Erro ao carregar', msg);
      }
    }
  }

  async function fetchProfile() {
    var url = 'https://graph.instagram.com/me' +
      '?fields=id,username,biography,followers_count,follows_count,media_count,profile_picture_url' +
      '&access_token=' + encodeURIComponent(state.token);
    var res = await fetch(url);
    var json = await res.json();
    if (json.error) throw new Error(json.error.message || 'Erro API');
    return json;
  }

  async function fetchMedia() {
    var url = 'https://graph.instagram.com/me/media' +
      '?fields=id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count,thumbnail_url,media_url' +
      '&limit=20' +
      '&access_token=' + encodeURIComponent(state.token);
    var res = await fetch(url);
    var json = await res.json();
    if (json.error) throw new Error(json.error.message || 'Erro API');
    return json.data || [];
  }

  // ── RENDER ────────────────────────────────────────────────
  function render() {
    if (!state.profile) return;
    renderHeader();
    renderProfile();
    renderStats();
    renderPerformanceChart();
    renderTopBottom();
    renderHeatmap();
    renderHashtags();
    renderFormats();
    renderUpdatedAt();
    showDashboard();
  }

  function renderHeader() {
    document.getElementById('hdr-handle').textContent = '@' + (state.profile.username || '');
  }

  function renderProfile() {
    var p = state.profile;
    var pic = document.getElementById('profile-pic');
    if (p.profile_picture_url) {
      pic.src = p.profile_picture_url;
      pic.alt = p.username || '';
    } else {
      pic.style.display = 'none';
    }
    document.getElementById('profile-username').textContent = '@' + (p.username || '');
    document.getElementById('profile-bio').textContent = p.biography || '(sem bio)';
    var bioLen = (p.biography || '').length;
    document.getElementById('profile-bio-meta').textContent =
      bioLen + ' caracteres · ' + (p.media_count || 0) + ' posts · seguindo ' + (p.follows_count || 0);
  }

  function renderStats() {
    var p = state.profile;
    var posts = state.posts;
    var totalLikes = 0, totalCom = 0;
    posts.forEach(function(post) {
      totalLikes += (post.like_count || 0);
      totalCom += (post.comments_count || 0);
    });
    var n = posts.length || 1;
    var avgLikes = Math.round(totalLikes / n);
    var avgEng = p.followers_count ? ((totalLikes + totalCom) / n / p.followers_count * 100) : 0;

    document.getElementById('stat-followers').textContent = fmtNum(p.followers_count || 0);
    document.getElementById('stat-media').textContent = fmtNum(p.media_count || 0);
    document.getElementById('stat-avg-likes').textContent = fmtNum(avgLikes);
    document.getElementById('stat-engagement').textContent = avgEng.toFixed(2) + '%';
  }

  function renderPerformanceChart() {
    var ctx = document.getElementById('perf-chart');
    if (!ctx || !window.Chart) return;
    if (state.chart) state.chart.destroy();

    // ordena por data (mais antigos -> mais novos da esquerda pra direita)
    var posts = state.posts.slice().sort(function(a, b) {
      return new Date(a.timestamp) - new Date(b.timestamp);
    });
    var labels = posts.map(function(p, i) { return (i + 1); });
    var likes = posts.map(function(p) { return p.like_count || 0; });
    var coms = posts.map(function(p) { return p.comments_count || 0; });

    state.chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Likes',
            data: likes,
            backgroundColor: '#D4537E',
            borderRadius: 3,
            barPercentage: 0.8,
            categoryPercentage: 0.85
          },
          {
            label: 'Comentários',
            data: coms,
            backgroundColor: '#a36844',
            borderRadius: 3,
            barPercentage: 0.8,
            categoryPercentage: 0.85
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: function(items) {
                var i = items[0].dataIndex;
                var post = posts[i];
                if (!post) return '';
                var d = new Date(post.timestamp);
                return formatDate(d);
              },
              afterBody: function(items) {
                var i = items[0].dataIndex;
                var post = posts[i];
                if (!post) return '';
                var cap = (post.caption || '').slice(0, 80);
                return cap ? '"' + cap + (post.caption.length > 80 ? '...' : '') + '"' : '';
              }
            }
          }
        },
        scales: {
          x: { stacked: false, grid: { display: false }, ticks: { font: { size: 9 } } },
          y: { beginAtZero: true, grid: { color: '#EDE4DF' }, ticks: { font: { size: 9 } } }
        }
      }
    });
    document.getElementById('perf-foot').textContent =
      'Mais antigo → mais recente · ' + posts.length + ' posts';
  }

  function renderTopBottom() {
    var posts = state.posts.slice().map(function(p) {
      return Object.assign({}, p, { _eng: (p.like_count || 0) + (p.comments_count || 0) });
    }).sort(function(a, b) { return b._eng - a._eng; });

    var top = posts.slice(0, 3);
    var bottom = posts.slice(-3).reverse();
    document.getElementById('top-posts').innerHTML = top.map(postRowHTML).join('');
    document.getElementById('bottom-posts').innerHTML = bottom.map(postRowHTML).join('');
  }

  function postRowHTML(p) {
    var d = new Date(p.timestamp);
    var thumb = p.thumbnail_url || p.media_url || '';
    var cap = (p.caption || '(sem legenda)').replace(/\n/g, ' ').slice(0, 60);
    return '<div class="post-row">' +
      (thumb ? '<img class="post-thumb" src="' + esc(thumb) + '" alt="" onerror="this.style.display=\'none\'">' : '<div class="post-thumb"></div>') +
      '<div class="post-info">' +
        '<div class="post-caption">' + esc(cap) + '</div>' +
        '<div class="post-meta">' + (p.media_type || '') + ' · ' + formatDate(d) + ' · ' +
          '<a href="' + esc(p.permalink || '#') + '" target="_blank" style="color:var(--brand)">ver</a>' +
        '</div>' +
      '</div>' +
      '<div class="post-numbers">' +
        '<strong>' + fmtNum(p._eng) + '</strong>' +
        (p.like_count || 0) + '♥ ' + (p.comments_count || 0) + '💬' +
      '</div>' +
    '</div>';
  }

  function renderHeatmap() {
    // matriz [dia 0-6][hora 0-23] = { sum, count }
    var grid = [];
    for (var d = 0; d < 7; d++) {
      grid.push([]);
      for (var h = 0; h < 24; h++) grid[d].push({ sum: 0, count: 0 });
    }
    state.posts.forEach(function(p) {
      var dt = new Date(p.timestamp);
      var dow = dt.getDay();
      var hr = dt.getHours();
      var eng = (p.like_count || 0) + (p.comments_count || 0);
      grid[dow][hr].sum += eng;
      grid[dow][hr].count += 1;
    });

    // agrupa hora em 4 períodos: 0-5, 6-11, 12-17, 18-23
    var periods = [
      { label: 'madru', start: 0, end: 6 },
      { label: 'manhã', start: 6, end: 12 },
      { label: 'tarde', start: 12, end: 18 },
      { label: 'noite', start: 18, end: 24 }
    ];
    var dayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    // valor médio por (dia, período)
    var cells = [];
    var maxAvg = 0;
    for (var d2 = 0; d2 < 7; d2++) {
      cells.push([]);
      for (var pi = 0; pi < periods.length; pi++) {
        var per = periods[pi];
        var sum = 0, count = 0;
        for (var h2 = per.start; h2 < per.end; h2++) {
          sum += grid[d2][h2].sum;
          count += grid[d2][h2].count;
        }
        var avg = count ? sum / count : 0;
        cells[d2].push({ avg: avg, count: count });
        if (avg > maxAvg) maxAvg = avg;
      }
    }

    // header
    var html = '<thead><tr><th></th>';
    periods.forEach(function(p) { html += '<th>' + p.label + '</th>'; });
    html += '</tr></thead><tbody>';

    for (var d3 = 0; d3 < 7; d3++) {
      html += '<tr><td class="day-label">' + dayLabels[d3] + '</td>';
      for (var pi2 = 0; pi2 < periods.length; pi2++) {
        var c = cells[d3][pi2];
        var intensity = maxAvg > 0 ? c.avg / maxAvg : 0;
        var cls = c.count === 0 ? '' :
          intensity > 0.8 ? 'h5' :
          intensity > 0.6 ? 'h4' :
          intensity > 0.4 ? 'h3' :
          intensity > 0.2 ? 'h2' :
          intensity > 0 ? 'h1' : '';
        var content = c.count === 0 ? '·' : (c.count + ' post' + (c.count > 1 ? 's' : ''));
        html += '<td class="cell ' + cls + '" title="média ' + Math.round(c.avg) + ' eng">' + content + '</td>';
      }
      html += '</tr>';
    }
    html += '</tbody>';
    document.getElementById('heatmap').innerHTML = html;
  }

  function renderHashtags() {
    var tagCount = {};
    state.posts.forEach(function(p) {
      var cap = p.caption || '';
      var matches = cap.match(/#[\wàáâãéèêíïóôõöúüçñ]+/gi) || [];
      matches.forEach(function(t) {
        var k = t.toLowerCase();
        tagCount[k] = (tagCount[k] || 0) + 1;
      });
    });
    var arr = Object.keys(tagCount).map(function(k) {
      return { tag: k, count: tagCount[k] };
    }).sort(function(a, b) { return b.count - a.count; }).slice(0, 15);

    var el = document.getElementById('hashtag-list');
    if (!arr.length) {
      el.innerHTML = '<div class="t-muted t-caption">Nenhuma hashtag encontrada nos últimos 20 posts.</div>';
      return;
    }
    var max = arr[0].count;
    el.innerHTML = arr.map(function(t) {
      var pct = (t.count / max) * 100;
      return '<div class="tag-row">' +
        '<span class="tag-name">' + esc(t.tag) + '</span>' +
        '<div class="tag-bar"><div class="tag-bar-fill" style="width:' + pct + '%"></div></div>' +
        '<span class="tag-count">' + t.count + 'x</span>' +
      '</div>';
    }).join('');
  }

  function renderFormats() {
    var groups = {};
    state.posts.forEach(function(p) {
      var fmt = p.media_product_type === 'REELS' ? 'Reel' :
                p.media_type === 'CAROUSEL_ALBUM' ? 'Carrossel' :
                p.media_type === 'VIDEO' ? 'Vídeo' :
                p.media_type === 'IMAGE' ? 'Foto' : 'Outro';
      if (!groups[fmt]) groups[fmt] = { count: 0, totalEng: 0 };
      groups[fmt].count += 1;
      groups[fmt].totalEng += (p.like_count || 0) + (p.comments_count || 0);
    });
    var arr = Object.keys(groups).map(function(k) {
      var g = groups[k];
      return { fmt: k, count: g.count, avgEng: Math.round(g.totalEng / g.count) };
    }).sort(function(a, b) { return b.avgEng - a.avgEng; });

    var el = document.getElementById('format-stats');
    if (!arr.length) {
      el.innerHTML = '<div class="t-muted t-caption">Sem dados de formato.</div>';
      return;
    }
    el.innerHTML = arr.map(function(g, i) {
      return '<div class="format-row' + (i === 0 ? ' best' : '') + '">' +
        '<div>' +
          '<div class="format-name">' + (i === 0 ? '🏆 ' : '') + esc(g.fmt) + '</div>' +
          '<div class="t-caption">' + g.count + ' post' + (g.count > 1 ? 's' : '') + '</div>' +
        '</div>' +
        '<div class="format-stats-num"><strong>' + fmtNum(g.avgEng) + '</strong> eng médio</div>' +
      '</div>';
    }).join('');
  }

  function renderUpdatedAt() {
    var d = new Date(state.updatedAt);
    document.getElementById('updated-at').textContent = formatDateTime(d);
  }

  // ── ACTIONS ───────────────────────────────────────────────
  window.igRefresh = function() {
    localStorage.removeItem(CACHE_KEY);
    fetchAll();
  };

  window.saveSetupToken = function() {
    var v = (document.getElementById('setup-token-inp').value || '').trim();
    if (!v) { toast('Cole o token primeiro', true); return; }
    localStorage.setItem(TOKEN_KEY, v);
    state.token = v;
    localStorage.removeItem(CACHE_KEY);
    fetchAll();
  };

  window.openTokenModal = function() {
    var current = localStorage.getItem(TOKEN_KEY) || '';
    document.getElementById('token-modal-inp').value = current;
    var hint = current ? 'Atual: ' + current.slice(0, 12) + '...' + current.slice(-6) : 'Nenhum token configurado.';
    document.getElementById('token-current').textContent = hint;
    document.getElementById('token-modal-bg').classList.add('open');
  };

  window.closeTokenModal = function() {
    document.getElementById('token-modal-bg').classList.remove('open');
  };

  window.saveTokenModal = function() {
    var v = (document.getElementById('token-modal-inp').value || '').trim();
    if (!v) { toast('Cole o token primeiro', true); return; }
    localStorage.setItem(TOKEN_KEY, v);
    state.token = v;
    localStorage.removeItem(CACHE_KEY);
    closeTokenModal();
    fetchAll();
    toast('Token salvo. Recarregando...');
  };

  // ── UTILS ─────────────────────────────────────────────────
  function fmtNum(n) {
    n = Number(n) || 0;
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(n);
  }
  function pad(n) { return String(n).padStart(2, '0'); }
  function formatDate(d) {
    var DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
    return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + ' ' + DIAS[d.getDay()] + ' ' + pad(d.getHours()) + 'h';
  }
  function formatDateTime(d) {
    return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + ' às ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function toast(msg, isErr) {
    var el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.toggle('error', !!isErr);
    el.classList.add('show');
    setTimeout(function() { el.classList.remove('show'); }, 2500);
  }

  // ── BOOT ──────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAuth);
  } else {
    checkAuth();
  }

})();
