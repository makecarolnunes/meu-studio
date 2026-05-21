// ══════════════════════════════════════════════════════════
//  Instagram Dashboard — @makecarolnunes
//  Fase 1 · Dados expandidos + Brand Brain + concorrentes + inputs manuais
// ══════════════════════════════════════════════════════════

(function() {
  'use strict';

  // ── CONSTANTS ─────────────────────────────────────────────
  var TOKEN_KEY = 'mk_instagram_token';
  var CACHE_KEY = 'mk_instagram_cache_v2';
  var COMPETITORS_KEY = 'mk_instagram_competitors';
  var MANUAL_KEY = 'mk_instagram_manual';
  var CACHE_TTL = 30 * 60 * 1000;

  // ── STATE ─────────────────────────────────────────────────
  var state = {
    token: '',
    profile: null,
    posts: [],
    insights: {},           // { mediaId: { reach, saved, shares, total_interactions } }
    accountInsights: null,  // [{ name, values: [{value, end_time}] }]
    audience: null,
    updatedAt: null,
    chart: null,
    accountChart: null,
    audienceChart: null
  };

  var BRAND = null;           // brand brain parseado
  var COMPETITORS = [];       // lista de concorrentes (objects)
  var MANUAL = {};            // inputs manuais (origem tráfego, retenção)

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

  async function init() {
    document.getElementById('ig-app').style.display = 'block';
    state.token = localStorage.getItem(TOKEN_KEY) || '';
    COMPETITORS = readJSON(COMPETITORS_KEY, []);
    MANUAL = readJSON(MANUAL_KEY, {});

    // Carrega Brand Brain em paralelo (não bloqueia se falhar)
    loadBrandBrain();

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

  // ══════════════════════════════════════════════════════════
  //  BRAND BRAIN PARSER
  //  Lê instagram/brand-brain-source.html e extrai dados estruturados.
  // ══════════════════════════════════════════════════════════
  async function loadBrandBrain() {
    var urls = ['./brand-brain-source.html', 'brand-brain-source.html'];
    var lastErr = null;
    for (var i = 0; i < urls.length; i++) {
      try {
        console.log('[ig] tentando carregar Brand Brain de', urls[i]);
        var res = await fetch(urls[i]);
        if (!res.ok) { lastErr = new Error('HTTP ' + res.status); continue; }
        var html = await res.text();
        if (!html || html.length < 1000) { lastErr = new Error('arquivo vazio ou muito pequeno'); continue; }
        BRAND = parseBrandBrain(html);
        window.BRAND_BRAIN = BRAND;
        console.log('[ig] brand brain loaded ✓', BRAND);
        if (document.getElementById('dashboard').style.display === 'block') {
          renderBrandContext();
        }
        return;
      } catch (e) {
        lastErr = e;
        console.warn('[ig] falha em', urls[i], ':', e.message);
      }
    }
    BRAND = null;
    window._BRAND_ERROR = lastErr ? lastErr.message : 'desconhecido';
    console.error('[ig] brand brain falhou em todas as urls:', lastErr);
  }

  function parseBrandBrain(html) {
    var doc = new DOMParser().parseFromString(html, 'text/html');
    function txt(el) { return el ? el.textContent.replace(/\s+/g, ' ').trim() : ''; }
    function all(sel, root) {
      try { return Array.from((root || doc).querySelectorAll(sel)); }
      catch (e) { console.warn('[brand] selector falhou:', sel, e); return []; }
    }
    function norm(s) {
      return (s || '').toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    }

    // DNA — cards na seção #b-dna
    var dna = {};
    all('#b-dna .card').forEach(function(c) {
      var label = txt(c.querySelector('.label'));
      var text = txt(c.querySelector('p'));
      if (label) dna[norm(label)] = { label: label, text: text };
    });

    // Pilares — cards .dark na seção #b-pilares
    var pilares = all('#b-pilares .card').map(function(c) {
      return {
        titulo: txt(c.querySelector('.label')),
        itens: all('ul li', c).map(txt)
      };
    });

    // Personas — cards na seção #b-publico
    var personas = all('#b-publico > .g2 > .card').map(function(c) {
      var label = txt(c.querySelector('.label'));
      var paras = all('p', c).map(txt);
      var quemEh = '', desejo = '', medo = '', decisao = '';
      paras.forEach(function(p) {
        if (/Quem é:/i.test(p)) quemEh = p.replace(/.*Quem é:\s*/i, '');
        else if (/quer:/i.test(p)) desejo = p.replace(/.*quer:\s*/i, '');
        else if (/inseguranças:|medo/i.test(p)) medo = p.replace(/.*Inseguranças:\s*/i, '');
        else if (/decide:/i.test(p)) decisao = p.replace(/.*decide:\s*/i, '');
      });
      return { titulo: label, quemEh: quemEh, desejo: desejo, medo: medo, decisao: decisao };
    });

    // Tom de voz: palavras da marca + proibidas
    var palavrasMarca = [];
    var palavrasProibidas = [];
    var vozSec = doc.querySelector('#b-voz');
    if (vozSec) {
      all('.tag', vozSec).forEach(function(t) {
        var classes = ' ' + (t.className || '') + ' ';
        var val = txt(t);
        if (/ d /.test(classes)) palavrasProibidas.push(val);
        else palavrasMarca.push(val);
      });
    }

    // Pilares editoriais — tabela na #b-instagram
    var pilaresEditoriais = [];
    var instaSec = doc.querySelector('#b-instagram');
    if (instaSec) {
      // procura a tabela após o h3 "Pilares Editoriais do Feed"
      var tables = all('table', instaSec);
      tables.forEach(function(tbl) {
        var headers = all('th', tbl).map(txt);
        if (headers.length && /pilar/i.test(headers[0])) {
          all('tr', tbl).slice(1).forEach(function(r) {
            var cells = all('td', r).map(txt);
            if (cells.length >= 3) {
              pilaresEditoriais.push({
                pilar: cells[0],
                pct: cells[1],
                tipo: cells[2],
                frequencia: cells[3] || ''
              });
            }
          });
        }
      });
    }

    // Arquétipos — tabela em #b-arq (primeira)
    var arquetipos = [];
    var arqSec = doc.querySelector('#b-arq');
    if (arqSec) {
      var tbl = arqSec.querySelector('table');
      if (tbl) {
        all('tr', tbl).slice(1).forEach(function(r) {
          var cells = all('td', r).map(txt);
          if (cells.length >= 3) {
            arquetipos.push({ nome: cells[0], como: cells[1], onde: cells[2] });
          }
        });
      }
    }

    // 5 categorias de conteúdo — pillars no #b-conteudo
    var categorias = all('#b-conteudo .pillar').map(function(p) {
      return {
        titulo: txt(p.querySelector('h3.sub')),
        descricao: txt(p.querySelector('p')),
        exemplos: all('ul li', p).map(txt)
      };
    });

    // Erros / o que evitar
    var erros = [];
    var evitarSec = doc.querySelector('#b-evitar');
    if (evitarSec) {
      all('.alert.danger', evitarSec).forEach(function(a) {
        erros.push(txt(a));
      });
    }

    return {
      dna: dna,
      pilares: pilares,
      personas: personas,
      arquetipos: arquetipos,
      palavrasMarca: palavrasMarca,
      palavrasProibidas: palavrasProibidas,
      pilaresEditoriais: pilaresEditoriais,
      categorias: categorias,
      erros: erros
    };
  }

  // ══════════════════════════════════════════════════════════
  //  DATA LOAD
  // ══════════════════════════════════════════════════════════
  function loadFromCacheOrAPI() {
    var cached = readCache();
    if (cached) {
      state.profile = cached.profile;
      state.posts = cached.posts;
      state.insights = cached.insights || {};
      state.accountInsights = cached.accountInsights || null;
      state.audience = cached.audience || null;
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
        insights: state.insights,
        accountInsights: state.accountInsights,
        audience: state.audience,
        updatedAt: state.updatedAt
      }));
    } catch (e) { console.warn('[ig] cache write failed:', e); }
  }

  async function fetchAll() {
    showLoading('Conectando ao Instagram...');
    try {
      var profilePromise = fetchProfile();
      var postsPromise = fetchMedia();
      var profile = await profilePromise;
      state.profile = profile;

      document.getElementById('loading-txt').textContent = 'Carregando últimos posts...';
      var posts = await postsPromise;
      state.posts = posts;

      // Insights por post — paralelo
      document.getElementById('loading-txt').textContent = 'Lendo métricas por post (alcance, salvamentos, compartilhamentos)...';
      var insightsArr = await Promise.all(posts.map(function(p) {
        return fetchPostInsights(p).catch(function(err) {
          console.warn('[ig] insights failed for', p.id, err.message);
          return null;
        });
      }));
      state.insights = {};
      posts.forEach(function(p, i) {
        if (insightsArr[i]) state.insights[p.id] = insightsArr[i];
      });

      // Account insights (últimos 30 dias)
      document.getElementById('loading-txt').textContent = 'Lendo métricas da conta...';
      try {
        state.accountInsights = await fetchAccountInsights();
      } catch (e) {
        console.warn('[ig] account insights failed:', e.message);
        state.accountInsights = null;
      }

      // Demografia (lifetime)
      try {
        state.audience = await fetchAudienceInsights();
      } catch (e) {
        console.warn('[ig] audience failed:', e.message);
        state.audience = null;
      }

      state.updatedAt = Date.now();
      writeCache();
      render();
    } catch (err) {
      console.error('[ig] fetch error:', err);
      var msg = (err && err.message) ? err.message : 'Erro desconhecido';
      if (/OAuth|token|session|access/i.test(msg)) {
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

  function metricsForPost(post) {
    var type = post.media_type;
    var product = post.media_product_type;
    // Reels têm o conjunto mais rico
    if (product === 'REELS') {
      return ['reach', 'saved', 'shares', 'total_interactions', 'plays', 'likes', 'comments'];
    }
    // Vídeos (não-Reels)
    if (type === 'VIDEO') {
      return ['reach', 'saved', 'total_interactions', 'plays'];
    }
    // Imagens / Carrosséis
    return ['reach', 'saved', 'shares', 'total_interactions'];
  }

  async function fetchPostInsights(post) {
    var metrics = metricsForPost(post);
    var url = 'https://graph.instagram.com/' + post.id + '/insights' +
      '?metric=' + metrics.join(',') +
      '&access_token=' + encodeURIComponent(state.token);
    var res = await fetch(url);
    var json = await res.json();
    if (json.error) {
      // Se uma métrica falhou, tenta uma a uma (mais lento mas resiliente)
      console.warn('[ig] bulk insights falhou pro post', post.id, '(' + (post.media_product_type || post.media_type) + '):', json.error.message);
      var out = {};
      for (var i = 0; i < metrics.length; i++) {
        try {
          var singleUrl = 'https://graph.instagram.com/' + post.id + '/insights?metric=' + metrics[i] + '&access_token=' + encodeURIComponent(state.token);
          var sr = await fetch(singleUrl);
          var sj = await sr.json();
          if (!sj.error && sj.data && sj.data[0]) {
            var sv = sj.data[0].values && sj.data[0].values[0] ? sj.data[0].values[0].value : 0;
            out[metrics[i]] = sv;
          }
        } catch (e) { /* skip */ }
      }
      if (Object.keys(out).length) return out;
      throw new Error(json.error.message);
    }
    var out2 = {};
    (json.data || []).forEach(function(m) {
      var v = m.values && m.values[0] ? m.values[0].value : 0;
      out2[m.name] = v;
    });
    return out2;
  }

  async function fetchAccountInsights() {
    var today = Math.floor(Date.now() / 1000);
    var since = today - 30 * 24 * 60 * 60;
    var url = 'https://graph.instagram.com/me/insights' +
      '?metric=impressions,reach,profile_views,website_clicks,follower_count' +
      '&period=day&since=' + since + '&until=' + today +
      '&access_token=' + encodeURIComponent(state.token);
    var res = await fetch(url);
    var json = await res.json();
    if (json.error) throw new Error(json.error.message);
    return json.data || [];
  }

  async function fetchAudienceInsights() {
    var url = 'https://graph.instagram.com/me/insights' +
      '?metric=audience_gender_age,audience_city,audience_country' +
      '&period=lifetime' +
      '&access_token=' + encodeURIComponent(state.token);
    var res = await fetch(url);
    var json = await res.json();
    if (json.error) throw new Error(json.error.message);
    return json.data || [];
  }

  // ══════════════════════════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════════════════════════
  function render() {
    if (!state.profile) return;
    renderHeader();
    renderProfile();
    renderStats();
    renderBrandContext();
    renderAccountInsights();
    renderAudience();
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
      pic.style.display = '';
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
    var totalLikes = 0, totalCom = 0, totalReach = 0, totalSaved = 0, totalShares = 0;
    var reachCount = 0;
    posts.forEach(function(post) {
      totalLikes += (post.like_count || 0);
      totalCom += (post.comments_count || 0);
      var ins = state.insights[post.id];
      if (ins) {
        if (typeof ins.reach === 'number') { totalReach += ins.reach; reachCount++; }
        totalSaved += (ins.saved || 0);
        totalShares += (ins.shares || 0);
      }
    });
    var n = posts.length || 1;
    var avgLikes = Math.round(totalLikes / n);
    var avgEng = p.followers_count ? ((totalLikes + totalCom) / n / p.followers_count * 100) : 0;
    var avgReach = reachCount ? Math.round(totalReach / reachCount) : 0;

    document.getElementById('stat-followers').textContent = fmtNum(p.followers_count || 0);
    document.getElementById('stat-media').textContent = fmtNum(p.media_count || 0);
    document.getElementById('stat-avg-likes').textContent = fmtNum(avgLikes);
    document.getElementById('stat-engagement').textContent = avgEng.toFixed(2) + '%';

    // Nova linha de stats: alcance médio, saves, shares
    var statsExtra = document.getElementById('stats-extra');
    if (statsExtra) {
      statsExtra.innerHTML =
        '<div class="stat-card">' +
          '<div class="stat-label">Alcance médio</div>' +
          '<div class="stat-value">' + fmtNum(avgReach) + '</div>' +
          '<div class="stat-foot">por post</div>' +
        '</div>' +
        '<div class="stat-card">' +
          '<div class="stat-label">Salvamentos</div>' +
          '<div class="stat-value">' + fmtNum(totalSaved) + '</div>' +
          '<div class="stat-foot">últimos ' + n + ' posts</div>' +
        '</div>' +
        '<div class="stat-card">' +
          '<div class="stat-label">Compartilhamentos</div>' +
          '<div class="stat-value">' + fmtNum(totalShares) + '</div>' +
          '<div class="stat-foot">últimos ' + n + ' posts</div>' +
        '</div>';
    }
  }

  function renderBrandContext() {
    var el = document.getElementById('brand-context');
    if (!el) return;
    if (!BRAND) {
      el.innerHTML = '<div class="t-muted t-caption">Brand Brain não carregou. Verifique se ./brand-brain-source.html existe.</div>';
      return;
    }
    var essencia = BRAND.dna.essencia ? BRAND.dna.essencia.text : '';
    var posicionamento = BRAND.dna.posicionamento ? BRAND.dna.posicionamento.text : '';

    var pilaresHTML = BRAND.pilares.map(function(p) {
      return '<div class="brand-pilar"><strong>' + esc(p.titulo) + '</strong></div>';
    }).join('');

    var pilaresEdHTML = (BRAND.pilaresEditoriais || []).slice(0, 7).map(function(p) {
      return '<tr><td>' + esc(p.pilar) + '</td><td style="text-align:right">' + esc(p.pct) + '</td></tr>';
    }).join('');

    el.innerHTML =
      (essencia ? '<div class="brand-essence">"' + esc(essencia.replace(/^"|"$/g, '')) + '"</div>' : '') +
      (posicionamento ? '<div class="brand-position"><span class="t-label">Posicionamento</span><div>' + esc(posicionamento) + '</div></div>' : '') +
      '<div class="brand-pilares-row">' + pilaresHTML + '</div>' +
      (pilaresEdHTML ? '<div class="brand-edit-pilares"><span class="t-label">Pilares editoriais ideais</span><table class="brand-table">' + pilaresEdHTML + '</table></div>' : '') +
      '<a class="brand-link" href="../centro de comando/centro-de-comando.html" target="_blank">Ver Brand Brain completo →</a>';
  }

  function renderAccountInsights() {
    var el = document.getElementById('account-insights');
    if (!el) return;
    if (!state.accountInsights || !state.accountInsights.length) {
      el.innerHTML = '<div class="t-muted t-caption">Insights da conta indisponíveis. Pode ser limitação de permissão do token ou conta com menos de 100 seguidores.</div>';
      return;
    }

    // Resume os totais
    var totals = {};
    state.accountInsights.forEach(function(m) {
      var sum = 0;
      (m.values || []).forEach(function(v) { sum += (v.value || 0); });
      totals[m.name] = sum;
    });

    el.innerHTML =
      '<div class="account-summary">' +
        '<div class="acc-item"><span class="acc-label">Impressões 30d</span><strong>' + fmtNum(totals.impressions || 0) + '</strong></div>' +
        '<div class="acc-item"><span class="acc-label">Alcance 30d</span><strong>' + fmtNum(totals.reach || 0) + '</strong></div>' +
        '<div class="acc-item"><span class="acc-label">Visitas ao perfil 30d</span><strong>' + fmtNum(totals.profile_views || 0) + '</strong></div>' +
        '<div class="acc-item"><span class="acc-label">Cliques no link 30d</span><strong>' + fmtNum(totals.website_clicks || 0) + '</strong></div>' +
      '</div>' +
      '<div class="chart-wrap" style="height:180px"><canvas id="acc-chart"></canvas></div>';

    // Chart de alcance diário
    var reachMetric = state.accountInsights.find(function(m) { return m.name === 'reach'; });
    if (reachMetric && window.Chart) {
      var canvas = document.getElementById('acc-chart');
      if (canvas) {
        if (state.accountChart) state.accountChart.destroy();
        var labels = reachMetric.values.map(function(v) {
          var d = new Date(v.end_time);
          return pad(d.getDate()) + '/' + pad(d.getMonth() + 1);
        });
        var data = reachMetric.values.map(function(v) { return v.value || 0; });
        state.accountChart = new Chart(canvas, {
          type: 'line',
          data: {
            labels: labels,
            datasets: [{
              label: 'Alcance diário',
              data: data,
              borderColor: '#a36844',
              backgroundColor: 'rgba(163,104,68,0.12)',
              fill: true,
              tension: 0.3,
              pointRadius: 2
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { grid: { display: false }, ticks: { font: { size: 9 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } },
              y: { beginAtZero: true, grid: { color: '#EDE4DF' }, ticks: { font: { size: 9 } } }
            }
          }
        });
      }
    }
  }

  function renderAudience() {
    var el = document.getElementById('audience-section');
    if (!el) return;
    if (!state.audience || !state.audience.length) {
      el.innerHTML = '<div class="t-muted t-caption">Demografia indisponível. Requer 100+ seguidores e permissão de audience insights.</div>';
      return;
    }

    var html = '';
    state.audience.forEach(function(m) {
      var val = m.values && m.values[0] ? m.values[0].value : {};
      if (m.name === 'audience_gender_age') {
        // val é {F.18-24: 12, M.18-24: 3, ...}
        var groups = {};
        Object.keys(val).forEach(function(k) {
          var parts = k.split('.');
          var gender = parts[0];
          var age = parts[1] || '?';
          if (!groups[age]) groups[age] = { F: 0, M: 0, U: 0 };
          groups[age][gender] = val[k];
        });
        var ages = Object.keys(groups).sort();
        var maxAge = Math.max.apply(null, ages.map(function(a) { return (groups[a].F || 0) + (groups[a].M || 0) + (groups[a].U || 0); }));
        html += '<div class="aud-block"><div class="t-label">Idade × Gênero</div>';
        ages.forEach(function(age) {
          var f = groups[age].F || 0, m = groups[age].M || 0, u = groups[age].U || 0;
          var total = f + m + u;
          var pct = maxAge ? (total / maxAge * 100) : 0;
          html += '<div class="aud-row">' +
            '<span class="aud-age">' + esc(age) + '</span>' +
            '<div class="aud-bar"><div class="aud-bar-f" style="width:' + ((f / (maxAge || 1)) * 100) + '%"></div></div>' +
            '<span class="aud-num">' + total + '</span>' +
          '</div>';
        });
        html += '</div>';
      } else if (m.name === 'audience_city') {
        var cities = Object.keys(val).sort(function(a, b) { return val[b] - val[a]; }).slice(0, 5);
        html += '<div class="aud-block"><div class="t-label">Top cidades</div>';
        cities.forEach(function(c) {
          html += '<div class="aud-row"><span class="aud-city">' + esc(c) + '</span><span class="aud-num">' + val[c] + '</span></div>';
        });
        html += '</div>';
      } else if (m.name === 'audience_country') {
        var countries = Object.keys(val).sort(function(a, b) { return val[b] - val[a]; }).slice(0, 5);
        html += '<div class="aud-block"><div class="t-label">Top países</div>';
        countries.forEach(function(c) {
          html += '<div class="aud-row"><span class="aud-city">' + esc(c) + '</span><span class="aud-num">' + val[c] + '</span></div>';
        });
        html += '</div>';
      }
    });
    el.innerHTML = html || '<div class="t-muted t-caption">Sem dados de demografia.</div>';
  }

  function renderPerformanceChart() {
    var ctx = document.getElementById('perf-chart');
    if (!ctx || !window.Chart) return;
    if (state.chart) state.chart.destroy();

    var posts = state.posts.slice().sort(function(a, b) {
      return new Date(a.timestamp) - new Date(b.timestamp);
    });
    var labels = posts.map(function(p, i) { return (i + 1); });
    var likes = posts.map(function(p) { return p.like_count || 0; });
    var coms = posts.map(function(p) { return p.comments_count || 0; });
    var reach = posts.map(function(p) {
      var ins = state.insights[p.id];
      return ins && typeof ins.reach === 'number' ? ins.reach : null;
    });

    var hasReach = reach.some(function(r) { return r !== null; });

    var datasets = [
      { label: 'Likes', data: likes, backgroundColor: '#D4537E', borderRadius: 3, yAxisID: 'y' },
      { label: 'Comentários', data: coms, backgroundColor: '#a36844', borderRadius: 3, yAxisID: 'y' }
    ];
    if (hasReach) {
      datasets.push({
        type: 'line',
        label: 'Alcance',
        data: reach,
        borderColor: '#38190b',
        backgroundColor: 'transparent',
        yAxisID: 'y1',
        pointRadius: 2,
        tension: 0.2,
        spanGaps: true
      });
    }

    state.chart = new Chart(ctx, {
      type: 'bar',
      data: { labels: labels, datasets: datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: hasReach, labels: { font: { size: 10 } } },
          tooltip: {
            callbacks: {
              title: function(items) {
                var i = items[0].dataIndex;
                var post = posts[i];
                if (!post) return '';
                return formatDate(new Date(post.timestamp));
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
          y: { beginAtZero: true, grid: { color: '#EDE4DF' }, ticks: { font: { size: 9 } } },
          y1: hasReach ? { beginAtZero: true, position: 'right', grid: { display: false }, ticks: { font: { size: 9 } } } : { display: false }
        }
      }
    });
    document.getElementById('perf-foot').textContent =
      'Mais antigo → mais recente · ' + posts.length + ' posts' +
      (hasReach ? ' · Linha = alcance (eixo direito)' : '');
  }

  function renderTopBottom() {
    var posts = state.posts.slice().map(function(p) {
      var ins = state.insights[p.id] || {};
      var eng = (p.like_count || 0) + (p.comments_count || 0) + (ins.saved || 0) + (ins.shares || 0);
      return Object.assign({}, p, { _eng: eng, _ins: ins });
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
    var ins = p._ins || {};
    var insLine = '';
    if (typeof ins.reach === 'number') {
      insLine = '<div class="post-ins-line">' +
        fmtNum(ins.reach) + ' alcance · ' +
        (ins.saved || 0) + ' saves · ' +
        (ins.shares || 0) + ' shares' +
      '</div>';
    }
    return '<div class="post-row">' +
      (thumb ? '<img class="post-thumb" src="' + esc(thumb) + '" alt="" onerror="this.style.display=\'none\'">' : '<div class="post-thumb"></div>') +
      '<div class="post-info">' +
        '<div class="post-caption">' + esc(cap) + '</div>' +
        '<div class="post-meta">' + (p.media_type || '') + ' · ' + formatDate(d) + ' · ' +
          '<a href="' + esc(p.permalink || '#') + '" target="_blank" style="color:var(--brand)">ver</a>' +
        '</div>' +
        insLine +
      '</div>' +
      '<div class="post-numbers">' +
        '<strong>' + fmtNum(p._eng) + '</strong>' +
        (p.like_count || 0) + '♥ ' + (p.comments_count || 0) + '💬' +
      '</div>' +
    '</div>';
  }

  function renderHeatmap() {
    var grid = [];
    for (var d = 0; d < 7; d++) {
      grid.push([]);
      for (var h = 0; h < 24; h++) grid[d].push({ sum: 0, count: 0 });
    }
    state.posts.forEach(function(p) {
      var dt = new Date(p.timestamp);
      var dow = dt.getDay();
      var hr = dt.getHours();
      var ins = state.insights[p.id] || {};
      var eng = (p.like_count || 0) + (p.comments_count || 0) + (ins.saved || 0) + (ins.shares || 0);
      grid[dow][hr].sum += eng;
      grid[dow][hr].count += 1;
    });

    var periods = [
      { label: 'madru', start: 0, end: 6 },
      { label: 'manhã', start: 6, end: 12 },
      { label: 'tarde', start: 12, end: 18 },
      { label: 'noite', start: 18, end: 24 }
    ];
    var dayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

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
        var content = c.count === 0 ? '·' : (c.count + 'p');
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
      if (!groups[fmt]) groups[fmt] = { count: 0, totalEng: 0, totalReach: 0, reachCount: 0 };
      var ins = state.insights[p.id] || {};
      groups[fmt].count += 1;
      groups[fmt].totalEng += (p.like_count || 0) + (p.comments_count || 0) + (ins.saved || 0) + (ins.shares || 0);
      if (typeof ins.reach === 'number') { groups[fmt].totalReach += ins.reach; groups[fmt].reachCount++; }
    });
    var arr = Object.keys(groups).map(function(k) {
      var g = groups[k];
      return {
        fmt: k,
        count: g.count,
        avgEng: Math.round(g.totalEng / g.count),
        avgReach: g.reachCount ? Math.round(g.totalReach / g.reachCount) : null
      };
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
          '<div class="t-caption">' + g.count + ' post' + (g.count > 1 ? 's' : '') + (g.avgReach ? ' · alcance médio ' + fmtNum(g.avgReach) : '') + '</div>' +
        '</div>' +
        '<div class="format-stats-num"><strong>' + fmtNum(g.avgEng) + '</strong> eng médio</div>' +
      '</div>';
    }).join('');
  }

  function renderUpdatedAt() {
    var d = new Date(state.updatedAt);
    document.getElementById('updated-at').textContent = formatDateTime(d);
  }

  // ══════════════════════════════════════════════════════════
  //  CONCORRENTES — UI estruturada (modal com formulário)
  // ══════════════════════════════════════════════════════════
  var DEFAULT_COMPETITORS = [
    'makecomgaby', 'juliatorresmakeup', 'cinthiaprado',
    'nathmatosmakeup', 'carolzimmaromakeup', 'thaisbenites', 'anasamakeup'
  ];

  window.openCompetitorsModal = function() {
    var modal = document.getElementById('competitors-modal-bg');
    if (!modal) return;
    if (!COMPETITORS.length) {
      // Inicializa com a lista padrão
      COMPETITORS = DEFAULT_COMPETITORS.map(function(h) {
        return { handle: h, posicionamento: '', especialidade: '', estetica: '', posts: [], comentariosTipicos: '', relacionamento: '' };
      });
    }
    renderCompetitorsList();
    modal.classList.add('open');
  };

  window.closeCompetitorsModal = function() {
    document.getElementById('competitors-modal-bg').classList.remove('open');
  };

  function renderCompetitorsList() {
    var list = document.getElementById('competitors-list');
    if (!list) return;
    list.innerHTML = COMPETITORS.map(function(c, idx) {
      return '<div class="comp-item">' +
        '<div class="comp-head">' +
          '<strong>@' + esc(c.handle) + '</strong>' +
          '<button class="comp-toggle" onclick="toggleCompetitor(' + idx + ')">' + (c._open ? 'Fechar' : 'Editar') + '</button>' +
          '<button class="comp-remove" onclick="removeCompetitor(' + idx + ')">×</button>' +
        '</div>' +
        (c._open ? renderCompetitorEdit(c, idx) : '<div class="comp-summary">' +
          (c.posicionamento ? esc(c.posicionamento) + ' · ' : '') +
          (c.posts && c.posts.length ? c.posts.length + ' posts coletados' : 'sem posts coletados') +
        '</div>') +
      '</div>';
    }).join('') +
    '<button class="btn btn-secondary" onclick="addCompetitor()" style="width:100%;margin-top:8px">+ Adicionar concorrente</button>';
  }

  function renderCompetitorEdit(c, idx) {
    var postsHTML = (c.posts || []).map(function(p, pi) {
      return '<div class="comp-post">' +
        '<div class="comp-post-head">Post ' + (pi + 1) + ' <button class="comp-post-rm" onclick="removeCompPost(' + idx + ',' + pi + ')">×</button></div>' +
        '<div class="comp-post-grid">' +
          '<label>Tipo<select onchange="updCompPost(' + idx + ',' + pi + ',\'tipo\',this.value)">' +
            ['', 'Reel', 'Foto', 'Carrossel', 'Vídeo'].map(function(t) {
              return '<option value="' + t + '"' + (p.tipo === t ? ' selected' : '') + '>' + (t || '—') + '</option>';
            }).join('') +
          '</select></label>' +
          '<label>Likes<input type="number" value="' + (p.likes || '') + '" onchange="updCompPost(' + idx + ',' + pi + ',\'likes\',this.value)"></label>' +
          '<label>Coment.<input type="number" value="' + (p.comentarios || '') + '" onchange="updCompPost(' + idx + ',' + pi + ',\'comentarios\',this.value)"></label>' +
        '</div>' +
        '<label class="comp-fullw">Tema<input type="text" value="' + esc(p.tema || '') + '" onchange="updCompPost(' + idx + ',' + pi + ',\'tema\',this.value)" placeholder="ex: tutorial sombra esfumada"></label>' +
        '<label class="comp-fullw">Legenda (resumo)<textarea onchange="updCompPost(' + idx + ',' + pi + ',\'legenda\',this.value)" rows="2" placeholder="cole a legenda ou resuma">' + esc(p.legenda || '') + '</textarea></label>' +
      '</div>';
    }).join('');

    return '<div class="comp-edit">' +
      '<label>Posicionamento percebido<select onchange="updComp(' + idx + ',\'posicionamento\',this.value)">' +
        ['', 'Premium', 'Mid', 'Acessível'].map(function(o) {
          return '<option value="' + o + '"' + (c.posicionamento === o ? ' selected' : '') + '>' + (o || '—') + '</option>';
        }).join('') +
      '</select></label>' +
      '<label>Especialidade declarada<input type="text" value="' + esc(c.especialidade || '') + '" onchange="updComp(' + idx + ',\'especialidade\',this.value)" placeholder="ex: noiva, pele preta..."></label>' +
      '<label>Estética visual<select onchange="updComp(' + idx + ',\'estetica\',this.value)">' +
        ['', 'Editorial', 'Casual', 'Mista'].map(function(o) {
          return '<option value="' + o + '"' + (c.estetica === o ? ' selected' : '') + '>' + (o || '—') + '</option>';
        }).join('') +
      '</select></label>' +
      '<div class="comp-posts-wrap"><strong>Posts recentes</strong>' + postsHTML +
        '<button class="btn btn-ghost btn-sm" onclick="addCompPost(' + idx + ')">+ Adicionar post</button>' +
      '</div>' +
      '<label>Comentários típicos (3 exemplos)<textarea onchange="updComp(' + idx + ',\'comentariosTipicos\',this.value)" rows="3" placeholder="cole 3 exemplos de comentários que ela recebe">' + esc(c.comentariosTipicos || '') + '</textarea></label>' +
      '<label>Relacionamento com seguidores<select onchange="updComp(' + idx + ',\'relacionamento\',this.value)">' +
        ['', 'Distante', 'Próxima', 'Mentora', 'Amiga'].map(function(o) {
          return '<option value="' + o + '"' + (c.relacionamento === o ? ' selected' : '') + '>' + (o || '—') + '</option>';
        }).join('') +
      '</select></label>' +
    '</div>';
  }

  window.toggleCompetitor = function(idx) {
    COMPETITORS[idx]._open = !COMPETITORS[idx]._open;
    renderCompetitorsList();
  };

  window.removeCompetitor = function(idx) {
    if (!confirm('Remover @' + COMPETITORS[idx].handle + '?')) return;
    COMPETITORS.splice(idx, 1);
    renderCompetitorsList();
  };

  window.addCompetitor = function() {
    var handle = prompt('@ do concorrente (sem o @):');
    if (!handle) return;
    handle = handle.replace(/^@/, '').trim();
    if (!handle) return;
    COMPETITORS.push({ handle: handle, posicionamento: '', especialidade: '', estetica: '', posts: [], comentariosTipicos: '', relacionamento: '', _open: true });
    renderCompetitorsList();
  };

  window.updComp = function(idx, field, value) {
    COMPETITORS[idx][field] = value;
  };

  window.addCompPost = function(idx) {
    if (!COMPETITORS[idx].posts) COMPETITORS[idx].posts = [];
    COMPETITORS[idx].posts.push({ tipo: '', likes: '', comentarios: '', tema: '', legenda: '' });
    renderCompetitorsList();
  };

  window.removeCompPost = function(idx, pi) {
    COMPETITORS[idx].posts.splice(pi, 1);
    renderCompetitorsList();
  };

  window.updCompPost = function(idx, pi, field, value) {
    COMPETITORS[idx].posts[pi][field] = value;
  };

  window.saveCompetitors = function() {
    // Limpa flags internas antes de salvar
    var clean = COMPETITORS.map(function(c) {
      var copy = Object.assign({}, c);
      delete copy._open;
      return copy;
    });
    localStorage.setItem(COMPETITORS_KEY, JSON.stringify(clean));
    closeCompetitorsModal();
    toast('Concorrentes salvos');
  };

  // ══════════════════════════════════════════════════════════
  //  INPUTS MANUAIS — origem do tráfego + retenção Reels
  // ══════════════════════════════════════════════════════════
  window.openManualModal = function() {
    var m = MANUAL || {};
    document.getElementById('m-explorar').value = m.explorar || '';
    document.getElementById('m-reels').value = m.reels || '';
    document.getElementById('m-compart').value = m.compart || '';
    document.getElementById('m-perfil').value = m.perfil || '';
    document.getElementById('m-outros').value = m.outros || '';
    document.getElementById('m-reel1-link').value = (m.reelsTop && m.reelsTop[0] && m.reelsTop[0].link) || '';
    document.getElementById('m-reel1-ret').value = (m.reelsTop && m.reelsTop[0] && m.reelsTop[0].retencao) || '';
    document.getElementById('m-reel2-link').value = (m.reelsTop && m.reelsTop[1] && m.reelsTop[1].link) || '';
    document.getElementById('m-reel2-ret').value = (m.reelsTop && m.reelsTop[1] && m.reelsTop[1].retencao) || '';
    document.getElementById('m-reel3-link').value = (m.reelsTop && m.reelsTop[2] && m.reelsTop[2].link) || '';
    document.getElementById('m-reel3-ret').value = (m.reelsTop && m.reelsTop[2] && m.reelsTop[2].retencao) || '';
    document.getElementById('m-obs').value = m.observacoes || '';
    document.getElementById('manual-modal-bg').classList.add('open');
  };

  window.closeManualModal = function() {
    document.getElementById('manual-modal-bg').classList.remove('open');
  };

  window.saveManual = function() {
    MANUAL = {
      semana: new Date().toISOString().slice(0, 10),
      explorar: document.getElementById('m-explorar').value,
      reels: document.getElementById('m-reels').value,
      compart: document.getElementById('m-compart').value,
      perfil: document.getElementById('m-perfil').value,
      outros: document.getElementById('m-outros').value,
      reelsTop: [
        { link: document.getElementById('m-reel1-link').value, retencao: document.getElementById('m-reel1-ret').value },
        { link: document.getElementById('m-reel2-link').value, retencao: document.getElementById('m-reel2-ret').value },
        { link: document.getElementById('m-reel3-link').value, retencao: document.getElementById('m-reel3-ret').value }
      ],
      observacoes: document.getElementById('m-obs').value
    };
    localStorage.setItem(MANUAL_KEY, JSON.stringify(MANUAL));
    closeManualModal();
    toast('Inputs salvos');
  };

  // ══════════════════════════════════════════════════════════
  //  ACTIONS
  // ══════════════════════════════════════════════════════════
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

  // ══════════════════════════════════════════════════════════
  //  UTILS
  // ══════════════════════════════════════════════════════════
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
  function readJSON(key, fallback) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch (e) { return fallback; }
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
