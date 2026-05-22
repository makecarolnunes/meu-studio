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
  var CLAUDE_KEY = 'mk_claude_key';
  var ANALYSIS_KEY = 'mk_instagram_analysis';
  var VALIDATIONS_KEY = 'mk_instagram_validations';
  var CACHE_TTL = 30 * 60 * 1000;
  var ANALYSIS_TTL = 7 * 24 * 60 * 60 * 1000; // 7 dias
  var MAX_VALIDATIONS = 10;

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

    // Sincroniza com Supabase em background (não bloqueia UI)
    syncFromSupabase();

    if (!state.token) { showSetup(); return; }
    loadFromCacheOrAPI();
  }

  // ══════════════════════════════════════════════════════════
  //  SUPABASE SYNC — cross-device
  //  Mobile/desktop compartilham validações, análise, concorrentes,
  //  inputs manuais. localStorage = cache local + fallback offline.
  // ══════════════════════════════════════════════════════════
  async function syncFromSupabase() {
    if (typeof DB === 'undefined' || !DB.instagram || window._SB_ERROR) {
      console.log('[ig] Supabase indisponível — usando só localStorage');
      return;
    }
    try {
      console.log('[ig] sincronizando do Supabase...');
      // Validações
      var supaVals = await DB.instagram.validations.list().catch(function(e) {
        console.warn('[ig] validations list falhou:', e.message);
        return null;
      });
      if (supaVals && supaVals.length) {
        localStorage.setItem(VALIDATIONS_KEY, JSON.stringify(supaVals.slice(0, MAX_VALIDATIONS)));
      }
      // Singleton states
      var supaAnalysis = await DB.instagram.getState('analysis').catch(function() { return null; });
      var supaComps = await DB.instagram.getState('competitors').catch(function() { return null; });
      var supaManual = await DB.instagram.getState('manual').catch(function() { return null; });

      if (supaAnalysis) {
        localStorage.setItem(ANALYSIS_KEY, JSON.stringify(supaAnalysis));
        state.analysis = supaAnalysis;
      } else {
        // Supabase vazio mas pode ter no localStorage — empurra pra Supabase
        var localAn = readJSON(ANALYSIS_KEY, null);
        if (localAn) pushStateToSupabase('analysis', localAn);
      }
      if (supaComps && Array.isArray(supaComps) && supaComps.length) {
        COMPETITORS = supaComps;
        localStorage.setItem(COMPETITORS_KEY, JSON.stringify(supaComps));
      } else if (COMPETITORS && COMPETITORS.length) {
        pushStateToSupabase('competitors', COMPETITORS);
      }
      if (supaManual) {
        MANUAL = supaManual;
        localStorage.setItem(MANUAL_KEY, JSON.stringify(supaManual));
      } else if (MANUAL && Object.keys(MANUAL).length) {
        pushStateToSupabase('manual', MANUAL);
      }
      // Validações locais sem Supabase → empurra
      if (!supaVals || !supaVals.length) {
        var localVals = readJSON(VALIDATIONS_KEY, []);
        if (localVals.length) {
          console.log('[ig] empurrando', localVals.length, 'validações locais pro Supabase');
          localVals.forEach(function(v) {
            if (!v.id) v.id = String(v.generatedAt || Date.now());
            pushValidationToSupabase(v);
          });
        }
      }

      console.log('[ig] sync OK — validations:', (supaVals || []).length, 'analysis:', !!supaAnalysis, 'comps:', (supaComps || []).length, 'manual:', !!supaManual);

      // Re-render se dashboard já visível
      var dash = document.getElementById('dashboard');
      if (dash && dash.style.display === 'block') {
        renderAnalysis();
        restoreLastValidation();
      }
    } catch (err) {
      console.warn('[ig] sync error:', err);
    }
  }

  function pushValidationToSupabase(v) {
    if (typeof DB === 'undefined' || !DB.instagram || window._SB_ERROR) return;
    DB.instagram.validations.upsert(v).catch(function(err) {
      console.warn('[ig] push validation falhou:', err.message);
    });
  }

  function pushStateToSupabase(key, value) {
    if (typeof DB === 'undefined' || !DB.instagram || window._SB_ERROR) return;
    DB.instagram.setState(key, value).catch(function(err) {
      console.warn('[ig] push state ' + key + ' falhou:', err.message);
    });
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
    // Em API v22+ várias métricas exigem metric_type=total_value.
    // Tenta múltiplas combinações por métrica.
    var requests = [
      // Métricas atuais (v22+) com metric_type
      { metric: 'reach', extra: '&metric_type=total_value', period: 'day' },
      { metric: 'views', extra: '&metric_type=total_value', period: 'day' },
      { metric: 'profile_views', extra: '&metric_type=total_value', period: 'day' },
      { metric: 'accounts_engaged', extra: '&metric_type=total_value', period: 'day' },
      { metric: 'total_interactions', extra: '&metric_type=total_value', period: 'day' },
      { metric: 'likes', extra: '&metric_type=total_value', period: 'day' },
      { metric: 'comments', extra: '&metric_type=total_value', period: 'day' },
      { metric: 'shares', extra: '&metric_type=total_value', period: 'day' },
      { metric: 'saves', extra: '&metric_type=total_value', period: 'day' },
      { metric: 'replies', extra: '&metric_type=total_value', period: 'day' },
      { metric: 'profile_links_taps', extra: '&metric_type=total_value', period: 'day' },
      { metric: 'follower_count', extra: '', period: 'day' },
      // Fallbacks legados sem metric_type
      { metric: 'reach', extra: '', period: 'day' },
      { metric: 'impressions', extra: '', period: 'day' },
      { metric: 'website_clicks', extra: '', period: 'day' }
    ];
    var results = [];
    var errors = [];
    var seen = {};
    for (var i = 0; i < requests.length; i++) {
      var r = requests[i];
      if (seen[r.metric]) continue;
      try {
        var url = 'https://graph.instagram.com/me/insights' +
          '?metric=' + r.metric + r.extra +
          '&period=' + r.period + '&since=' + since + '&until=' + today +
          '&access_token=' + encodeURIComponent(state.token);
        var res = await fetch(url);
        var json = await res.json();
        if (json.error) {
          errors.push(r.metric + (r.extra ? ' (com metric_type)' : '') + ': ' + json.error.message);
          continue;
        }
        if (json.data && json.data.length) {
          seen[r.metric] = true;
          results.push.apply(results, json.data);
        }
      } catch (e) {
        errors.push(r.metric + ': ' + e.message);
      }
    }
    if (!results.length && errors.length) {
      console.warn('[ig] account insights — todas as métricas falharam:', errors);
      state.accountInsightsError = errors.slice(0, 5).join(' · ');
    } else if (errors.length) {
      console.log('[ig] account insights — algumas métricas falharam:', errors);
    }
    console.log('[ig] account insights — coletadas:', results.map(function(r) { return r.name; }));
    return results;
  }

  async function fetchAudienceInsights() {
    // v22+ usa follower_demographics com breakdown
    var requests = [
      { metric: 'follower_demographics', params: '&metric_type=total_value&timeframe=this_month&breakdown=age' },
      { metric: 'follower_demographics', params: '&metric_type=total_value&timeframe=this_month&breakdown=gender' },
      { metric: 'follower_demographics', params: '&metric_type=total_value&timeframe=this_month&breakdown=city' },
      { metric: 'follower_demographics', params: '&metric_type=total_value&timeframe=this_month&breakdown=country' },
      { metric: 'engaged_audience_demographics', params: '&metric_type=total_value&timeframe=this_month&breakdown=age' },
      // Fallback antigo
      { metric: 'audience_gender_age', params: '&period=lifetime' },
      { metric: 'audience_city', params: '&period=lifetime' },
      { metric: 'audience_country', params: '&period=lifetime' }
    ];
    var results = [];
    var errors = [];
    for (var i = 0; i < requests.length; i++) {
      var r = requests[i];
      try {
        var url = 'https://graph.instagram.com/me/insights' +
          '?metric=' + r.metric + r.params +
          '&access_token=' + encodeURIComponent(state.token);
        var res = await fetch(url);
        var json = await res.json();
        if (json.error) {
          errors.push(r.metric + ': ' + json.error.message);
          continue;
        }
        if (json.data && json.data.length) {
          results.push.apply(results, json.data);
        }
      } catch (e) {
        errors.push(r.metric + ': ' + e.message);
      }
    }
    if (!results.length && errors.length) {
      console.warn('[ig] audience — todas as métricas falharam:', errors);
      state.audienceError = errors.slice(0, 5).join(' · ');
    } else if (errors.length) {
      console.log('[ig] audience — algumas métricas falharam:', errors);
    }
    console.log('[ig] audience — coletadas:', results.length, 'métricas');
    return results;
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
    renderAnalysis();
    renderUpdatedAt();
    showDashboard();
    // Restaura última validação se houver
    setTimeout(restoreLastValidation, 0);
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
      var msg = '<div class="t-muted t-caption">Insights da conta indisponíveis.</div>';
      if (state.accountInsightsError) {
        msg += '<details class="error-details"><summary>Ver erro detalhado</summary><pre>' + esc(state.accountInsightsError) + '</pre></details>';
      }
      msg += '<div class="t-caption" style="margin-top:6px">Verifique: (1) token tem permissão <code>instagram_business_manage_insights</code>, (2) gerou um token NOVO após adicionar a permissão, (3) clicou em refresh 🔄 no header pra limpar cache.</div>';
      el.innerHTML = msg;
      return;
    }

    // Resume os totais — suporta 2 formatos:
    //   Legado: m.values[i].value (time series por dia)
    //   v22+:   m.total_value.value (escalar agregado)
    var totals = {};
    var timeSeries = {};
    state.accountInsights.forEach(function(m) {
      if (m.total_value && typeof m.total_value.value !== 'undefined') {
        totals[m.name] = m.total_value.value || 0;
      } else if (Array.isArray(m.values)) {
        var sum = 0;
        var series = [];
        m.values.forEach(function(v) {
          sum += (v.value || 0);
          series.push({ end_time: v.end_time, value: v.value || 0 });
        });
        totals[m.name] = sum;
        if (series.length > 1) timeSeries[m.name] = series;
      }
    });

    el.innerHTML =
      '<div class="account-summary">' +
        '<div class="acc-item"><span class="acc-label">Alcance 30d</span><strong>' + fmtNum(totals.reach || 0) + '</strong></div>' +
        '<div class="acc-item"><span class="acc-label">Visualizações 30d</span><strong>' + fmtNum(totals.views || totals.impressions || 0) + '</strong></div>' +
        '<div class="acc-item"><span class="acc-label">Visitas ao perfil 30d</span><strong>' + fmtNum(totals.profile_views || 0) + '</strong></div>' +
        '<div class="acc-item"><span class="acc-label">Cliques no link 30d</span><strong>' + fmtNum(totals.profile_links_taps || totals.website_clicks || 0) + '</strong></div>' +
        (totals.accounts_engaged ? '<div class="acc-item"><span class="acc-label">Contas engajadas 30d</span><strong>' + fmtNum(totals.accounts_engaged) + '</strong></div>' : '') +
        (totals.total_interactions ? '<div class="acc-item"><span class="acc-label">Interações 30d</span><strong>' + fmtNum(totals.total_interactions) + '</strong></div>' : '') +
      '</div>' +
      (timeSeries.reach || timeSeries.follower_count ? '<div class="chart-wrap" style="height:180px"><canvas id="acc-chart"></canvas></div>' : '');

    // Chart só se temos time series (formato legado com .values array)
    var serieReach = timeSeries.reach || timeSeries.follower_count;
    if (serieReach && window.Chart) {
      var canvas = document.getElementById('acc-chart');
      if (canvas) {
        if (state.accountChart) state.accountChart.destroy();
        var labels = serieReach.map(function(v) {
          var d = new Date(v.end_time);
          return pad(d.getDate()) + '/' + pad(d.getMonth() + 1);
        });
        var data = serieReach.map(function(v) { return v.value || 0; });
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
      var msg = '<div class="t-muted t-caption">Demografia indisponível.</div>';
      if (state.audienceError) {
        msg += '<details class="error-details"><summary>Ver erro detalhado</summary><pre>' + esc(state.audienceError) + '</pre></details>';
      }
      msg += '<div class="t-caption" style="margin-top:6px">Requer 100+ seguidores (você tem ✓) e permissão de audience insights no token.</div>';
      el.innerHTML = msg;
      return;
    }

    // Normaliza para um formato único: { age: {...}, gender: {...}, city: {...}, country: {...} }
    var bins = { age: {}, gender: {}, city: {}, country: {} };
    state.audience.forEach(function(m) {
      // Formato moderno: total_value.breakdowns
      if (m.total_value && m.total_value.breakdowns) {
        m.total_value.breakdowns.forEach(function(bd) {
          var dim = (bd.dimension_keys && bd.dimension_keys[0]) || '';
          var key = dim.toLowerCase();
          if (!bins[key]) bins[key] = {};
          (bd.results || []).forEach(function(r) {
            var label = r.dimension_values && r.dimension_values[0];
            if (label) bins[key][label] = (bins[key][label] || 0) + (r.value || 0);
          });
        });
      }
      // Formato legado: values[0].value como objeto
      else if (m.values && m.values[0] && typeof m.values[0].value === 'object') {
        var val = m.values[0].value;
        if (m.name === 'audience_gender_age') {
          Object.keys(val).forEach(function(k) {
            var parts = k.split('.');
            var gender = parts[0], age = parts[1];
            if (age) bins.age[age] = (bins.age[age] || 0) + val[k];
            if (gender) bins.gender[gender] = (bins.gender[gender] || 0) + val[k];
          });
        } else if (m.name === 'audience_city') {
          Object.keys(val).forEach(function(k) { bins.city[k] = (bins.city[k] || 0) + val[k]; });
        } else if (m.name === 'audience_country') {
          Object.keys(val).forEach(function(k) { bins.country[k] = (bins.country[k] || 0) + val[k]; });
        }
      }
    });

    var html = '';
    // Render idade
    if (Object.keys(bins.age).length) {
      var ages = Object.keys(bins.age).sort();
      var maxA = Math.max.apply(null, ages.map(function(a) { return bins.age[a]; }));
      html += '<div class="aud-block"><div class="t-label">Idade</div>';
      ages.forEach(function(a) {
        var pct = maxA ? (bins.age[a] / maxA * 100) : 0;
        html += '<div class="aud-row">' +
          '<span class="aud-age">' + esc(a) + '</span>' +
          '<div class="aud-bar"><div class="aud-bar-f" style="width:' + pct + '%"></div></div>' +
          '<span class="aud-num">' + bins.age[a] + '</span>' +
        '</div>';
      });
      html += '</div>';
    }
    // Gênero
    if (Object.keys(bins.gender).length) {
      var genders = Object.keys(bins.gender);
      var maxG = Math.max.apply(null, genders.map(function(g) { return bins.gender[g]; }));
      html += '<div class="aud-block"><div class="t-label">Gênero</div>';
      genders.forEach(function(g) {
        var pct = maxG ? (bins.gender[g] / maxG * 100) : 0;
        var label = g === 'F' ? 'Feminino' : g === 'M' ? 'Masculino' : g === 'U' ? 'Não-binário' : g;
        html += '<div class="aud-row">' +
          '<span class="aud-age">' + esc(label) + '</span>' +
          '<div class="aud-bar"><div class="aud-bar-f" style="width:' + pct + '%"></div></div>' +
          '<span class="aud-num">' + bins.gender[g] + '</span>' +
        '</div>';
      });
      html += '</div>';
    }
    // Cidade
    if (Object.keys(bins.city).length) {
      var cities = Object.keys(bins.city).sort(function(a, b) { return bins.city[b] - bins.city[a]; }).slice(0, 5);
      html += '<div class="aud-block"><div class="t-label">Top cidades</div>';
      cities.forEach(function(c) {
        html += '<div class="aud-row"><span class="aud-city">' + esc(c) + '</span><span class="aud-num">' + bins.city[c] + '</span></div>';
      });
      html += '</div>';
    }
    // País
    if (Object.keys(bins.country).length) {
      var countries = Object.keys(bins.country).sort(function(a, b) { return bins.country[b] - bins.country[a]; }).slice(0, 5);
      html += '<div class="aud-block"><div class="t-label">Top países</div>';
      countries.forEach(function(c) {
        html += '<div class="aud-row"><span class="aud-city">' + esc(c) + '</span><span class="aud-num">' + bins.country[c] + '</span></div>';
      });
      html += '</div>';
    }

    if (!html) html = '<div class="t-muted t-caption">Dados de audiência retornados mas formato não reconhecido. Veja console para debug.</div>';
    el.innerHTML = html;
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
        return { handle: h, observacoes: '', prints: [], analise: null };
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
      var hasAnalysis = c.analise && typeof c.analise === 'object';
      var summary;
      if (hasAnalysis) {
        summary = (c.analise.posicionamento || '—') + ' · ' + (c.analise.especialidade || 'sem especialidade') +
          ' · analisado em ' + (c.analise.analisadoEm ? new Date(c.analise.analisadoEm).toLocaleDateString('pt-BR') : '—');
      } else {
        summary = 'sem análise · adicione prints e gere';
      }
      return '<div class="comp-item">' +
        '<div class="comp-head">' +
          '<strong>@' + esc(c.handle) + '</strong>' +
          '<button class="comp-toggle" onclick="toggleCompetitor(' + idx + ')">' + (c._open ? 'Fechar' : 'Abrir') + '</button>' +
          '<button class="comp-remove" onclick="removeCompetitor(' + idx + ')">×</button>' +
        '</div>' +
        (c._open ? renderCompetitorEdit(c, idx) : '<div class="comp-summary">' + esc(summary) + '</div>') +
      '</div>';
    }).join('') +
    '<button class="btn btn-secondary" onclick="addCompetitor()" style="width:100%;margin-top:8px">+ Adicionar concorrente</button>';
  }

  function renderCompetitorEdit(c, idx) {
    var prints = c.prints || [];
    var analise = c.analise || null;

    var printsHTML = prints.length
      ? '<div class="comp-prints-grid">' + prints.map(function(p, pi) {
          return '<div class="comp-print-thumb">' +
            '<img src="' + p.dataUrl + '" alt="print ' + (pi + 1) + '">' +
            '<button class="comp-print-rm" onclick="removeCompPrint(' + idx + ',' + pi + ')" title="Remover">×</button>' +
          '</div>';
        }).join('') + '</div>'
      : '<div class="comp-prints-empty">Nenhum print ainda. Adicione 3-8 imagens: grid do perfil, prints de posts, stories destaque, bio.</div>';

    var analiseHTML = analise ? renderCompAnalise(analise) : '';

    var statusId = 'comp-status-' + idx;

    return '<div class="comp-edit">' +
      '<div class="comp-section">' +
        '<div class="comp-section-head">📷 Prints (' + prints.length + ')</div>' +
        printsHTML +
        '<div class="comp-actions">' +
          '<label class="btn btn-outline btn-sm comp-upload-btn">' +
            '+ Adicionar prints' +
            '<input type="file" accept="image/*" multiple style="display:none" onchange="addCompPrints(' + idx + ', this.files); this.value=null">' +
          '</label>' +
          (prints.length ? '<button class="btn btn-primary btn-sm" onclick="analyzeCompetitorPrints(' + idx + ')">🧠 Analisar com IA</button>' : '') +
        '</div>' +
        '<div id="' + statusId + '" class="comp-status"></div>' +
      '</div>' +
      (analise ? '<div class="comp-section"><div class="comp-section-head">🎯 Análise IA</div>' + analiseHTML + '</div>' : '') +
      '<div class="comp-section">' +
        '<div class="comp-section-head">✍️ Observação manual</div>' +
        '<textarea class="comp-obs" onchange="updComp(' + idx + ',\'observacoes\',this.value)" rows="3" placeholder="Qualquer detalhe que o print não captura (ex: mora em SP, tem curso pago, parceira frequente da Dior...)">' + esc(c.observacoes || '') + '</textarea>' +
      '</div>' +
    '</div>';
  }

  function renderCompAnalise(a) {
    function tags(arr) {
      if (!arr || !arr.length) return '<span class="comp-empty">—</span>';
      return arr.map(function(t) { return '<span class="comp-tag">' + esc(String(t)) + '</span>'; }).join('');
    }
    function bullets(arr) {
      if (!arr || !arr.length) return '<div class="comp-empty">—</div>';
      return '<ul class="comp-bullets">' + arr.map(function(t) { return '<li>' + esc(String(t)) + '</li>'; }).join('') + '</ul>';
    }
    var pos = a.posicionamento ? '<span class="comp-badge pos-' + esc((a.posicionamento || '').toLowerCase()) + '">' + esc(a.posicionamento) + '</span>' : '';
    return '<div class="comp-analise">' +
      '<div class="comp-analise-row"><span class="comp-k">Posicionamento</span><span>' + pos + '</span></div>' +
      '<div class="comp-analise-row"><span class="comp-k">Especialidade</span><span>' + esc(a.especialidade || '—') + '</span></div>' +
      '<div class="comp-analise-row"><span class="comp-k">Estética</span><span>' + esc(a.estetica || '—') + '</span></div>' +
      (a.paleta ? '<div class="comp-analise-row"><span class="comp-k">Paleta</span><span>' + esc(a.paleta) + '</span></div>' : '') +
      (a.tipografia ? '<div class="comp-analise-row"><span class="comp-k">Tipografia</span><span>' + esc(a.tipografia) + '</span></div>' : '') +
      (a.qualidadeProducao ? '<div class="comp-analise-row"><span class="comp-k">Qualidade</span><span>' + esc(a.qualidadeProducao) + '</span></div>' : '') +
      '<div class="comp-analise-block"><div class="comp-k">Padrões de conteúdo</div>' + bullets(a.padroesConteudo) + '</div>' +
      '<div class="comp-analise-block"><div class="comp-k">Temas recorrentes</div><div class="comp-tags">' + tags(a.temasRecorrentes) + '</div></div>' +
      '<div class="comp-analise-block"><div class="comp-k">Sinais de engajamento</div>' + bullets(a.sinaisEngajamento) + '</div>' +
      '<div class="comp-analise-block"><div class="comp-k">Diferencial vs. Carol</div>' + bullets(a.diferencialVsCarol) + '</div>' +
      (a.observacoesIA ? '<div class="comp-analise-block"><div class="comp-k">Observações da IA</div><div class="comp-note">' + esc(a.observacoesIA) + '</div></div>' : '') +
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
    COMPETITORS.push({ handle: handle, observacoes: '', prints: [], analise: null, _open: true });
    renderCompetitorsList();
  };

  window.updComp = function(idx, field, value) {
    COMPETITORS[idx][field] = value;
  };

  function fileToDataURL(file) {
    return new Promise(function(resolve, reject) {
      var r = new FileReader();
      r.onload = function() { resolve(r.result); };
      r.onerror = function() { reject(r.error); };
      r.readAsDataURL(file);
    });
  }

  // Redimensiona imagem se > maxDim e converte pra JPEG ~0.85 pra reduzir payload
  function compressImage(dataUrl, maxDim) {
    return new Promise(function(resolve) {
      var img = new Image();
      img.onload = function() {
        var w = img.width, h = img.height;
        var scale = Math.min(1, maxDim / Math.max(w, h));
        var cw = Math.round(w * scale), ch = Math.round(h * scale);
        var canvas = document.createElement('canvas');
        canvas.width = cw; canvas.height = ch;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, cw, ch);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = function() { resolve(dataUrl); };
      img.src = dataUrl;
    });
  }

  window.addCompPrints = async function(idx, files) {
    if (!files || !files.length) return;
    if (!COMPETITORS[idx].prints) COMPETITORS[idx].prints = [];
    var arr = Array.prototype.slice.call(files);
    for (var i = 0; i < arr.length; i++) {
      try {
        var raw = await fileToDataURL(arr[i]);
        var compressed = await compressImage(raw, 1280);
        COMPETITORS[idx].prints.push({ dataUrl: compressed, name: arr[i].name });
      } catch (e) {
        console.warn('[ig] falha carregando print', arr[i].name, e);
      }
    }
    renderCompetitorsList();
    // reabre o card que estava aberto
    if (!COMPETITORS[idx]._open) { COMPETITORS[idx]._open = true; renderCompetitorsList(); }
  };

  window.removeCompPrint = function(idx, pi) {
    COMPETITORS[idx].prints.splice(pi, 1);
    renderCompetitorsList();
  };

  window.analyzeCompetitorPrints = async function(idx) {
    var c = COMPETITORS[idx];
    if (!c || !c.prints || !c.prints.length) {
      toast('Adicione prints primeiro', true);
      return;
    }
    if (!getClaudeKey()) {
      toast('Configure sua chave Claude primeiro', true);
      openClaudeKeyModal();
      return;
    }

    var statusEl = document.getElementById('comp-status-' + idx);
    if (statusEl) statusEl.innerHTML = '<div class="spinner-sm"></div> Analisando ' + c.prints.length + ' prints com Claude Vision...';

    try {
      var content = [];
      c.prints.forEach(function(p) {
        var m = p.dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
        if (!m) return;
        content.push({
          type: 'image',
          source: { type: 'base64', media_type: m[1], data: m[2] }
        });
      });

      var prompt = 'Você é uma estrategista de marca analisando prints do Instagram da concorrente @' + c.handle + ' (mercado de maquiagem profissional brasileira).\n\n' +
        'Analise CUIDADOSAMENTE os ' + c.prints.length + ' prints acima (grid de perfil, posts, stories, bio) e devolva APENAS um JSON válido, sem cercas markdown, com esta estrutura exata:\n\n' +
        '{\n' +
        '  "posicionamento": "Premium" | "Mid" | "Acessível",\n' +
        '  "especialidade": "string curta (ex: noiva clássica, pele preta, madrinha, social...)",\n' +
        '  "estetica": "Editorial" | "Casual" | "Mista",\n' +
        '  "paleta": "descrição da paleta de cores predominante (ex: tons terrosos quentes, nude + dourado)",\n' +
        '  "tipografia": "descrição de fontes/tratamento de texto se visível (ex: serif clássica em capas, manuscrita em destaques)",\n' +
        '  "qualidadeProducao": "Alta" | "Média" | "Baixa" + breve justificativa em 1 frase",\n' +
        '  "padroesConteudo": ["3-6 bullets sobre tipos de post, formatos, frequência aparente, estrutura de capas"],\n' +
        '  "temasRecorrentes": ["3-7 tags curtas com temas, ex: tutorial-olho, antes-depois, bastidores"],\n' +
        '  "sinaisEngajamento": ["3-5 bullets sobre likes/comentários visíveis, comentários típicos, tipo de seguidor"],\n' +
        '  "diferencialVsCarol": ["3-5 bullets do que ela faz diferente da Carol (Carol = maquiadora noiva clássica brasileira, estética café/terra/nude, arquétipos Criadora/Cuidadora/Sábia, premium acessível)"],\n' +
        '  "observacoesIA": "1 parágrafo curto (3-5 frases) com insight estratégico sobre o que Carol pode aprender/evitar dessa concorrente"\n' +
        '}\n\n' +
        'IMPORTANTE: Responda APENAS o JSON, sem texto antes ou depois, sem cercas markdown.';

      content.push({ type: 'text', text: prompt });

      var result = await callClaude(content);
      var analise = result.parsed;
      analise.analisadoEm = Date.now();
      COMPETITORS[idx].analise = analise;

      if (statusEl) statusEl.innerHTML = '<span style="color:var(--green,#2d8a4f)">✓ Análise concluída</span>';
      renderCompetitorsList();
      // mantém aberto
      COMPETITORS[idx]._open = true;
      renderCompetitorsList();
    } catch (e) {
      console.error('[ig] erro analisando concorrente', e);
      if (statusEl) statusEl.innerHTML = '<span style="color:var(--red,#c44)">✗ ' + esc(e.message) + '</span>';
      toast('Erro: ' + e.message, true);
    }
  };

  window.saveCompetitors = function() {
    // Limpa flags internas e prints (apenas resultado da análise persiste)
    var clean = COMPETITORS.map(function(c) {
      return {
        handle: c.handle,
        observacoes: c.observacoes || '',
        analise: c.analise || null
      };
    });
    localStorage.setItem(COMPETITORS_KEY, JSON.stringify(clean));
    pushStateToSupabase('competitors', clean);
    closeCompetitorsModal();
    toast('Concorrentes salvos · sincronizados');
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
    pushStateToSupabase('manual', MANUAL);
    closeManualModal();
    toast('Inputs salvos · sincronizados');
  };

  // ══════════════════════════════════════════════════════════
  //  ANÁLISE IA — Claude API
  // ══════════════════════════════════════════════════════════

  function getClaudeKey() {
    return localStorage.getItem(CLAUDE_KEY) || '';
  }

  function loadStoredAnalysis() {
    try {
      var raw = localStorage.getItem(ANALYSIS_KEY);
      if (!raw) return null;
      var a = JSON.parse(raw);
      if (!a || !a.generatedAt) return null;
      return a;
    } catch (e) { return null; }
  }

  function brandToText() {
    if (!BRAND) return '';
    var lines = ['## BRAND BRAIN — Carol Nunes (@makecarolnunes)\n'];

    if (BRAND.dna) {
      lines.push('### DNA');
      Object.keys(BRAND.dna).forEach(function(k) {
        var d = BRAND.dna[k];
        if (d && d.label && d.text) lines.push('- **' + d.label + '**: ' + d.text);
      });
      lines.push('');
    }

    if (BRAND.pilares && BRAND.pilares.length) {
      lines.push('### Pilares');
      BRAND.pilares.forEach(function(p) {
        lines.push('**' + p.titulo + '**');
        (p.itens || []).forEach(function(it) { lines.push('- ' + it); });
      });
      lines.push('');
    }

    if (BRAND.personas && BRAND.personas.length) {
      lines.push('### Personas');
      BRAND.personas.forEach(function(p, i) {
        lines.push('**P' + (i + 1) + ' — ' + p.titulo + '**');
        if (p.quemEh) lines.push('- Quem é: ' + p.quemEh);
        if (p.desejo) lines.push('- Quer: ' + p.desejo);
        if (p.medo) lines.push('- Medo: ' + p.medo);
        if (p.decisao) lines.push('- Decide: ' + p.decisao);
      });
      lines.push('');
    }

    if (BRAND.arquetipos && BRAND.arquetipos.length) {
      lines.push('### Arquétipos');
      BRAND.arquetipos.forEach(function(a) {
        lines.push('- **' + a.nome + '**: ' + a.como);
      });
      lines.push('');
    }

    if (BRAND.palavrasMarca && BRAND.palavrasMarca.length) {
      lines.push('### Tom de voz');
      lines.push('Palavras da marca: ' + BRAND.palavrasMarca.join(', '));
      lines.push('Palavras PROIBIDAS: ' + (BRAND.palavrasProibidas || []).join(', '));
      lines.push('');
    }

    if (BRAND.pilaresEditoriais && BRAND.pilaresEditoriais.length) {
      lines.push('### Pilares editoriais ideais (% do feed)');
      BRAND.pilaresEditoriais.forEach(function(p) {
        lines.push('- ' + p.pilar + ': ' + p.pct + ' — ' + p.tipo);
      });
      lines.push('');
    }

    if (BRAND.categorias && BRAND.categorias.length) {
      lines.push('### 5 categorias de conteúdo');
      BRAND.categorias.forEach(function(c) {
        lines.push('- **' + c.titulo + '**: ' + c.descricao);
      });
      lines.push('');
    }

    if (BRAND.erros && BRAND.erros.length) {
      lines.push('### O que evitar');
      BRAND.erros.slice(0, 15).forEach(function(e) {
        lines.push('- ' + e);
      });
    }

    return lines.join('\n');
  }

  function dataToText() {
    var p = state.profile || {};
    var lines = ['## DADOS ATUAIS DA CONTA\n'];

    lines.push('### Perfil');
    lines.push('- Username: @' + (p.username || ''));
    lines.push('- Bio: "' + (p.biography || '') + '" (' + (p.biography || '').length + ' chars)');
    lines.push('- Seguidores: ' + (p.followers_count || 0));
    lines.push('- Seguindo: ' + (p.follows_count || 0));
    lines.push('- Total posts: ' + (p.media_count || 0));
    lines.push('');

    lines.push('### Últimos ' + state.posts.length + ' posts');
    state.posts.forEach(function(post, i) {
      var d = new Date(post.timestamp);
      var ins = state.insights[post.id] || {};
      var DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
      var fmt = post.media_product_type === 'REELS' ? 'Reel' :
                post.media_type === 'CAROUSEL_ALBUM' ? 'Carrossel' :
                post.media_type === 'VIDEO' ? 'Vídeo' :
                post.media_type === 'IMAGE' ? 'Foto' : (post.media_type || 'Outro');
      var caption = (post.caption || '').replace(/\n/g, ' ').slice(0, 400);
      lines.push('[P' + (i + 1) + '] id=' + post.id + ' | ' + fmt + ' | ' +
        d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + DIAS[d.getDay()] + ' ' + pad(d.getHours()) + 'h | ' +
        '♥' + (post.like_count || 0) + ' 💬' + (post.comments_count || 0) +
        (typeof ins.reach === 'number' ? ' alc:' + ins.reach : '') +
        (typeof ins.saved === 'number' ? ' sv:' + ins.saved : '') +
        (typeof ins.shares === 'number' ? ' sh:' + ins.shares : '') +
        (typeof ins.plays === 'number' ? ' pl:' + ins.plays : ''));
      lines.push('  Legenda: ' + caption + (post.caption && post.caption.length > 400 ? '...' : ''));
      lines.push('  URL: ' + post.permalink);
    });
    lines.push('');

    if (state.accountInsights && state.accountInsights.length) {
      lines.push('### Insights da conta (últimos 30 dias)');
      state.accountInsights.forEach(function(m) {
        var sum = 0;
        (m.values || []).forEach(function(v) { sum += (v.value || 0); });
        lines.push('- ' + m.name + ': ' + sum + ' (30 dias)');
      });
      lines.push('');
    } else {
      lines.push('### Insights da conta: indisponível');
      lines.push('');
    }

    if (state.audience && state.audience.length) {
      lines.push('### Demografia');
      state.audience.forEach(function(m) {
        var val = m.values && m.values[0] ? m.values[0].value : {};
        if (typeof val === 'object') {
          var entries = Object.keys(val).map(function(k) { return k + ':' + val[k]; }).join(', ');
          lines.push('- ' + m.name + ': ' + entries);
        }
      });
      lines.push('');
    }

    return lines.join('\n');
  }

  function competitorsToText() {
    if (!COMPETITORS || !COMPETITORS.length) return '';
    var withData = COMPETITORS.filter(function(c) {
      return (c.analise && typeof c.analise === 'object') || c.observacoes;
    });
    if (!withData.length) return '## CONCORRENTES\nNenhum concorrente analisado ainda. Adicione prints e gere análise no modal Concorrentes.';

    var lines = ['## CONCORRENTES (' + withData.length + ' com análise)\n'];
    withData.forEach(function(c) {
      lines.push('### @' + c.handle);
      var a = c.analise || {};
      if (a.posicionamento) lines.push('- Posicionamento: ' + a.posicionamento);
      if (a.especialidade) lines.push('- Especialidade: ' + a.especialidade);
      if (a.estetica) lines.push('- Estética: ' + a.estetica);
      if (a.paleta) lines.push('- Paleta: ' + a.paleta);
      if (a.tipografia) lines.push('- Tipografia: ' + a.tipografia);
      if (a.qualidadeProducao) lines.push('- Qualidade de produção: ' + a.qualidadeProducao);
      if (a.padroesConteudo && a.padroesConteudo.length) {
        lines.push('- Padrões de conteúdo:');
        a.padroesConteudo.forEach(function(p) { lines.push('  • ' + p); });
      }
      if (a.temasRecorrentes && a.temasRecorrentes.length) {
        lines.push('- Temas recorrentes: ' + a.temasRecorrentes.join(', '));
      }
      if (a.sinaisEngajamento && a.sinaisEngajamento.length) {
        lines.push('- Sinais de engajamento:');
        a.sinaisEngajamento.forEach(function(p) { lines.push('  • ' + p); });
      }
      if (a.diferencialVsCarol && a.diferencialVsCarol.length) {
        lines.push('- Diferencial vs. Carol:');
        a.diferencialVsCarol.forEach(function(p) { lines.push('  • ' + p); });
      }
      if (a.observacoesIA) lines.push('- Insight IA: ' + a.observacoesIA);
      if (c.observacoes) lines.push('- Observação manual da Carol: ' + c.observacoes);
      lines.push('');
    });
    return lines.join('\n');
  }

  function manualToText() {
    if (!MANUAL || !MANUAL.semana) return '';
    var lines = ['## INPUTS MANUAIS DA CAROL'];
    lines.push('### Origem do tráfego (%)');
    if (MANUAL.explorar) lines.push('- Explorar: ' + MANUAL.explorar + '%');
    if (MANUAL.reels) lines.push('- Reels: ' + MANUAL.reels + '%');
    if (MANUAL.compart) lines.push('- Compartilhamento: ' + MANUAL.compart + '%');
    if (MANUAL.perfil) lines.push('- Perfil/Search: ' + MANUAL.perfil + '%');
    if (MANUAL.outros) lines.push('- Outros: ' + MANUAL.outros + '%');
    if (MANUAL.reelsTop && MANUAL.reelsTop.length) {
      lines.push('### Top 3 Reels por retenção');
      MANUAL.reelsTop.forEach(function(r, i) {
        if (r.link || r.retencao) lines.push('- Reel ' + (i + 1) + ': ' + (r.link || '?') + ' | retenção: ' + (r.retencao || '?'));
      });
    }
    if (MANUAL.observacoes) lines.push('### Observações da semana\n' + MANUAL.observacoes);
    return lines.join('\n');
  }

  function buildAnalysisPrompt() {
    var sections = [
      brandToText(),
      dataToText(),
      competitorsToText(),
      manualToText()
    ].filter(Boolean);

    var data = sections.join('\n\n---\n\n');

    var task = '\n\n---\n\n## TAREFA\n\n' +
'Você é um estrategista sênior de marca + diretor criativo + analista de Instagram, especializado em maquiadoras profissionais premium. Sua análise é específica, cita evidências concretas, e usa o Brand Brain como lente principal — nunca genérica.\n\n' +
'Gere uma análise estratégica completa cruzando os dados acima com o Brand Brain. Retorne SOMENTE JSON válido (sem markdown, sem prefácio, sem ```json```) com a estrutura abaixo:\n\n' +
'```json\n{\n' +
'  "diagnostico_executivo": "3-5 frases. Os insights mais críticos da semana, conectando performance + Brand Brain. Deve ser tão denso que se a Carol só ler isso, ela já sabe o essencial.",\n' +
'  "padroes_top": [\n' +
'    { "padrao": "padrão observado nos top posts", "evidencias_post_ids": ["P1","P3"], "performance_lift": "ex: 3x mais alcance que a média", "hipotese": "por que performou cruzando com Brand Brain (pilar, persona, arquétipo)" }\n' +
'  ],\n' +
'  "padroes_bottom": [\n' +
'    { "padrao": "...", "evidencias_post_ids": ["P5"], "performance_drop": "...", "hipotese": "por que falhou cruzando com Brand Brain" }\n' +
'  ],\n' +
'  "alinhamento_marca": {\n' +
'    "score_geral_0_10": 7.2,\n' +
'    "dimensoes": { "tom_de_voz": 8, "estetica": 6, "alinhamento_pilar": 7, "posicionamento_premium": 7 },\n' +
'    "posts_off_brand": [ { "post_id": "P5", "score": 3, "flags": ["usa palavra proibida X", "estética fora da paleta"] } ],\n' +
'    "posts_perfeitos": [ { "post_id": "P1", "score": 9, "fortalezas": ["alinha com arquétipo Sábia", "tom impecável"] } ]\n' +
'  },\n' +
'  "pilares_balance": {\n' +
'    "diagnostico": "1-2 frases sobre o equilíbrio",\n' +
'    "desvios_criticos": [ "Pilar X em Y% (ideal Z%)" ]\n' +
'  },\n' +
'  "analise_bio": {\n' +
'    "diagnostico": "o que está bom e o que está ruim na bio atual",\n' +
'    "sugestao_pronta": "bio nova pronta pra copiar e colar (multilinha com \\n)"\n' +
'  },\n' +
'  "audiencia_e_origem": {\n' +
'    "diagnostico": "quem está engajando, baseado em demografia + comentários. Cruzar com personas.",\n' +
'    "sinais_audiencia_certa": ["..."],\n' +
'    "sinais_audiencia_vazia": ["..."]\n' +
'  },\n' +
'  "concorrentes": {\n' +
'    "diferenciais_reais_carol": ["..."],\n' +
'    "gaps_mercado": [ { "gap": "...", "fit_com_carol": "por que alinha com Brand Brain" } ],\n' +
'    "formatos_saturados_evitar": ["..."]\n' +
'  },\n' +
'  "pautas_proxima_semana": [\n' +
'    {\n' +
'      "titulo": "título curto e prático",\n' +
'      "formato": "Reel|Foto|Carrossel|Story",\n' +
'      "pilar": "I-Noivas|II-Autoridade|Carol-Presenca|Produtos|Social",\n' +
'      "persona_alvo": ["P1","P2"],\n' +
'      "arquetipo_dominante": "Criadora|Cuidadora|Sabia",\n' +
'      "justificativa": "2-3 frases conectando: dado da performance + gap identificado + alinhamento com Brand Brain + (se aplicável) preparação para Curso VIP",\n' +
'      "estrutura": ["bullet 1", "bullet 2", "bullet 3", "bullet 4"],\n' +
'      "score_estrategico_0_10": 9\n' +
'    }\n' +
'  ]\n' +
'}\n```\n\n' +
'REGRAS CRÍTICAS:\n' +
'- Use APENAS dados reais fornecidos. Se faltar dado, escreva "dado indisponível" no campo.\n' +
'- Cite post_ids (formato P1, P2, ...) como evidência específica.\n' +
'- Seja específico e acionável. Sem genéricos tipo "poste mais Reels".\n' +
'- Hipóteses devem CRUZAR Brand Brain (pilar, persona, arquétipo, palavras da marca).\n' +
'- 10 pautas. Cada uma deve fechar um gap específico + reforçar pilar + atrair persona específica.\n' +
'- Português brasileiro, tom direto e profissional.\n' +
'- Retorne SOMENTE o JSON. NADA antes ou depois.';

    return data + task;
  }

  async function callClaude(promptOrContent) {
    var key = getClaudeKey();
    if (!key) throw new Error('Chave Claude não configurada. Clica no botão de chave 🔑 pra configurar.');

    // promptOrContent pode ser string (texto puro) ou array de content blocks (texto + imagens)
    var content = typeof promptOrContent === 'string' ? promptOrContent : promptOrContent;

    var res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 16000,
        messages: [{ role: 'user', content: content }]
      })
    });

    var json = await res.json();
    if (json.error) throw new Error(json.error.message || 'Erro na Claude API');
    if (!json.content || !json.content.length) throw new Error('Resposta vazia da Claude');
    var text = json.content.map(function(c) { return c.text || ''; }).join('');

    // Extrai JSON (caso venha com cercas markdown apesar das instruções)
    var match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('JSON não encontrado na resposta. Texto:\n' + text.slice(0, 300));
    try {
      var parsed = JSON.parse(match[0]);
      return { parsed: parsed, raw: text, usage: json.usage || null };
    } catch (e) {
      throw new Error('JSON inválido: ' + e.message + '\nTexto: ' + match[0].slice(0, 300));
    }
  }

  window.generateAnalysis = async function() {
    if (!state.profile || !state.posts.length) {
      toast('Aguarda os dados carregarem primeiro', true);
      return;
    }
    if (!getClaudeKey()) {
      toast('Configure sua chave Claude primeiro', true);
      openClaudeKeyModal();
      return;
    }

    var btn = document.getElementById('btn-generate');
    var statusEl = document.getElementById('analysis-status');
    if (btn) { btn.disabled = true; btn.textContent = '🧠 Analisando...'; }
    if (statusEl) statusEl.innerHTML = '<div class="spinner-sm"></div> Construindo contexto + chamando Claude... isso leva 30-60s.';

    try {
      var prompt = buildAnalysisPrompt();
      console.log('[ig] prompt size:', prompt.length, 'chars');
      var result = await callClaude(prompt);
      var analysis = {
        generatedAt: Date.now(),
        data: result.parsed,
        usage: result.usage
      };
      localStorage.setItem(ANALYSIS_KEY, JSON.stringify(analysis));
      pushStateToSupabase('analysis', analysis);
      state.analysis = analysis;
      renderAnalysis();
      toast('Análise gerada · sincronizada ✓');
    } catch (err) {
      console.error('[ig] análise falhou:', err);
      if (statusEl) statusEl.innerHTML = '<span style="color:var(--danger)">Erro: ' + esc(err.message) + '</span>';
      toast('Erro: ' + err.message, true);
    } finally {
      if (btn) { btn.disabled = false; updateGenerateButton(); }
    }
  };

  function updateGenerateButton() {
    var btn = document.getElementById('btn-generate');
    if (!btn) return;
    var stored = loadStoredAnalysis();
    if (stored) {
      btn.textContent = '🔄 Regenerar análise estratégica';
    } else {
      btn.textContent = '🧠 Gerar análise estratégica';
    }
  }

  function renderAnalysis() {
    var stored = state.analysis || loadStoredAnalysis();
    var statusEl = document.getElementById('analysis-status');
    var subnav = document.getElementById('insights-subtabs');

    if (!stored) {
      if (statusEl) statusEl.innerHTML = '<span class="t-muted t-caption">Sem análise ainda. Clica em Gerar.</span>';
      if (subnav) subnav.style.display = 'none';
      ['diagnostico','padroes','alinhamento','oportunidades','pautas','alertas'].forEach(function(s) {
        var el = document.getElementById('sub-' + s);
        if (el) el.innerHTML = '';
      });
      renderAlertsStrip();
      renderQuickDiagnostic();
      return;
    }

    var d = new Date(stored.generatedAt);
    if (statusEl) {
      var ago = humanAgo(d);
      statusEl.innerHTML = '<span class="t-caption">✓ Gerada ' + ago + (stored.usage ? ' · ' + fmtNum(stored.usage.input_tokens) + ' → ' + fmtNum(stored.usage.output_tokens) + ' tokens' : '') + '</span>';
    }
    if (subnav) subnav.style.display = 'flex';

    var a = stored.data || {};

    // Métricas resumo do diagnóstico — calcula a partir dos dados
    var metricsHTML = '';
    if (a.alinhamento_marca) {
      var al = a.alinhamento_marca;
      var offCount = (al.posts_off_brand || []).length;
      var perfCount = (al.posts_perfeitos || []).length;
      var pautasCount = (a.pautas_proxima_semana || []).length;
      var gapsCount = (a.concorrentes && a.concorrentes.gaps_mercado || []).length;
      var topCount = (a.padroes_top || []).length;
      metricsHTML =
        '<div class="diag-metrics">' +
          '<div class="diag-metric"><div class="diag-metric-v">' + (al.score_geral_0_10 || '—') + '/10</div><div class="diag-metric-l">Alinhamento</div></div>' +
          '<div class="diag-metric"><div class="diag-metric-v">' + offCount + '</div><div class="diag-metric-l">Posts off-brand</div></div>' +
          '<div class="diag-metric"><div class="diag-metric-v">' + perfCount + '</div><div class="diag-metric-l">Posts alinhados</div></div>' +
          '<div class="diag-metric"><div class="diag-metric-v">' + topCount + '</div><div class="diag-metric-l">Padrões top</div></div>' +
          '<div class="diag-metric"><div class="diag-metric-v">' + gapsCount + '</div><div class="diag-metric-l">Gaps mercado</div></div>' +
          '<div class="diag-metric"><div class="diag-metric-v">' + pautasCount + '</div><div class="diag-metric-l">Pautas</div></div>' +
        '</div>';
    }

    // ── SUB-PANEL: DIAGNÓSTICO ──
    var diagHTML = '';
    if (a.diagnostico_executivo) {
      diagHTML += '<div class="hero-diag">' +
        '<div class="hero-diag-tag">DIAGNÓSTICO EXECUTIVO</div>' +
        '<div class="hero-diag-text">' + esc(a.diagnostico_executivo) + '</div>' +
        metricsHTML +
      '</div>';
    }
    if (a.audiencia_e_origem) {
      var au = a.audiencia_e_origem;
      diagHTML += '<div class="analysis-block">' +
        '<div class="analysis-h">👥 Audiência e origem</div>' +
        '<div class="diag-text">' + esc(au.diagnostico || '') + '</div>' +
        '<div class="audience-cols">' +
          (au.sinais_audiencia_certa && au.sinais_audiencia_certa.length ?
            '<div class="aud-col aud-col-good"><div class="aud-col-h">✓ Audiência certa</div><ul>' +
            au.sinais_audiencia_certa.map(function(s) { return '<li>' + esc(s) + '</li>'; }).join('') +
            '</ul></div>' : '') +
          (au.sinais_audiencia_vazia && au.sinais_audiencia_vazia.length ?
            '<div class="aud-col aud-col-bad"><div class="aud-col-h">⚠ Audiência vazia</div><ul>' +
            au.sinais_audiencia_vazia.map(function(s) { return '<li>' + esc(s) + '</li>'; }).join('') +
            '</ul></div>' : '') +
        '</div>' +
      '</div>';
    }
    setHTML('sub-diagnostico', diagHTML);

    // ── SUB-PANEL: PADRÕES ──
    var padHTML = '';
    if (a.padroes_top && a.padroes_top.length) {
      padHTML += '<div class="pattern-cols">' +
        '<div class="pattern-col pattern-col-top">' +
          '<div class="pattern-col-h">🔥 Por que performaram</div>' +
          a.padroes_top.map(renderPatternHTML).join('') +
        '</div>';
      if (a.padroes_bottom && a.padroes_bottom.length) {
        padHTML += '<div class="pattern-col pattern-col-bottom">' +
          '<div class="pattern-col-h">📉 Por que falharam</div>' +
          a.padroes_bottom.map(function(p) { return renderPatternHTML(p, true); }).join('') +
        '</div>';
      }
      padHTML += '</div>';
    }
    setHTML('sub-padroes', padHTML);

    // ── SUB-PANEL: ALINHAMENTO ──
    var alinHTML = '';
    if (a.alinhamento_marca) {
      var al2 = a.alinhamento_marca;
      var score = al2.score_geral_0_10 || 0;
      alinHTML += '<div class="hero-diag">' +
        '<div class="hero-diag-tag">SCORE DE ALINHAMENTO</div>' +
        '<div class="score-big">' + score + '<span class="score-out">/10</span></div>' +
        '<div class="score-bar"><div class="score-bar-f" style="width:' + (score * 10) + '%"></div></div>' +
      '</div>';

      if (al2.dimensoes) {
        alinHTML += '<div class="analysis-block">' +
          '<div class="analysis-h">Dimensões avaliadas</div>' +
          Object.keys(al2.dimensoes).map(function(k) {
            var v = al2.dimensoes[k];
            var color = v >= 8 ? 'var(--success)' : v >= 6 ? 'var(--brand)' : v >= 4 ? 'var(--warning)' : 'var(--danger)';
            return '<div class="align-dim"><span class="align-label">' + esc(k.replace(/_/g, ' ')) + '</span>' +
              '<div class="align-bar"><div class="align-bar-f" style="width:' + (v * 10) + '%;background:' + color + '"></div></div>' +
              '<span class="align-val">' + v + '</span></div>';
          }).join('') +
        '</div>';
      }

      if (al2.posts_perfeitos && al2.posts_perfeitos.length) {
        alinHTML += '<div class="analysis-block">' +
          '<div class="analysis-h" style="color:var(--success)">✓ Posts alinhados (replicar)</div>' +
          al2.posts_perfeitos.map(function(p) { return renderPostAlignmentHTML(p, true); }).join('') +
        '</div>';
      }
      if (al2.posts_off_brand && al2.posts_off_brand.length) {
        alinHTML += '<div class="analysis-block">' +
          '<div class="analysis-h" style="color:var(--danger)">⚠ Posts off-brand (corrigir)</div>' +
          al2.posts_off_brand.map(function(p) { return renderPostAlignmentHTML(p, false); }).join('') +
        '</div>';
      }
    }
    setHTML('sub-alinhamento', alinHTML);

    // ── SUB-PANEL: OPORTUNIDADES ──
    var opHTML = '';
    if (a.pilares_balance) {
      opHTML += '<div class="analysis-block">' +
        '<div class="analysis-h">📊 Balance dos pilares editoriais</div>' +
        '<div class="diag-text">' + esc(a.pilares_balance.diagnostico || '') + '</div>' +
        (a.pilares_balance.desvios_criticos && a.pilares_balance.desvios_criticos.length ?
          '<div class="deviation-list">' +
          a.pilares_balance.desvios_criticos.map(function(d) {
            return '<div class="deviation-item">⚠ ' + esc(d) + '</div>';
          }).join('') +
          '</div>' : '') +
      '</div>';
    }
    if (a.analise_bio) {
      opHTML += '<div class="analysis-block">' +
        '<div class="analysis-h">📝 Análise da bio</div>' +
        '<div class="diag-text">' + esc(a.analise_bio.diagnostico || '') + '</div>' +
        (a.analise_bio.sugestao_pronta ?
          '<div class="bio-suggested">' +
          '<div class="t-label">Bio sugerida</div>' +
          '<pre>' + esc(a.analise_bio.sugestao_pronta) + '</pre>' +
          '<button class="btn btn-secondary btn-sm" onclick="copyBio()">📋 Copiar</button>' +
          '</div>' : '') +
      '</div>';
    }
    if (a.concorrentes) {
      var co = a.concorrentes;
      opHTML += '<div class="analysis-block">' +
        '<div class="analysis-h">🎯 Análise comparativa</div>';
      if (co.diferenciais_reais_carol && co.diferenciais_reais_carol.length) {
        opHTML += '<div class="comp-section comp-good"><div class="t-label">Seus diferenciais reais</div>' +
          '<ul>' + co.diferenciais_reais_carol.map(function(s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul></div>';
      }
      if (co.gaps_mercado && co.gaps_mercado.length) {
        opHTML += '<div class="comp-section comp-gap"><div class="t-label">Gaps de mercado pra dominar</div>' +
          co.gaps_mercado.map(function(g) {
            return '<div class="gap-item"><strong>' + esc(g.gap) + '</strong>' +
              (g.fit_com_carol ? '<div class="gap-fit">↳ ' + esc(g.fit_com_carol) + '</div>' : '') + '</div>';
          }).join('') + '</div>';
      }
      if (co.formatos_saturados_evitar && co.formatos_saturados_evitar.length) {
        opHTML += '<div class="comp-section comp-avoid"><div class="t-label">Formatos saturados (evitar)</div>' +
          '<ul>' + co.formatos_saturados_evitar.map(function(s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul></div>';
      }
      opHTML += '</div>';
    }
    setHTML('sub-oportunidades', opHTML);

    // ── SUB-PANEL: PAUTAS ──
    var pauHTML = '';
    if (a.pautas_proxima_semana && a.pautas_proxima_semana.length) {
      pauHTML += '<div class="pauta-list">' + a.pautas_proxima_semana.map(renderPautaHTML).join('') + '</div>';
    }
    setHTML('sub-pautas', pauHTML);

    // ── SUB-PANEL: ALERTAS ──
    var alertHTML = '';
    var alerts = collectAlerts(a);
    if (alerts.length) {
      alertHTML += '<div class="alert-list">' +
        alerts.map(function(al) {
          return '<div class="alert-item alert-' + al.level + '">' +
            '<div class="alert-icon">' + (al.level === 'high' ? '🚨' : al.level === 'medium' ? '⚠️' : 'ℹ️') + '</div>' +
            '<div class="alert-body">' +
              '<div class="alert-title">' + esc(al.title) + '</div>' +
              '<div class="alert-desc">' + esc(al.desc) + '</div>' +
            '</div>' +
          '</div>';
        }).join('') +
      '</div>';
    } else {
      alertHTML = '<div class="t-muted t-caption" style="text-align:center;padding:20px">Nenhum alerta crítico no momento.</div>';
    }
    setHTML('sub-alertas', alertHTML);

    renderAlertsStrip(alerts);
    renderQuickDiagnostic();
    updateGenerateButton();
  }

  function setHTML(id, html) {
    var el = document.getElementById(id);
    if (el) el.innerHTML = html;
  }

  function collectAlerts(a) {
    var out = [];
    if (a.alinhamento_marca && a.alinhamento_marca.posts_off_brand) {
      a.alinhamento_marca.posts_off_brand.forEach(function(p) {
        out.push({
          level: p.score < 4 ? 'high' : 'medium',
          title: 'Post off-brand: ' + (p.post_id || ''),
          desc: (p.flags || []).join(' · ')
        });
      });
    }
    if (a.pilares_balance && a.pilares_balance.desvios_criticos) {
      a.pilares_balance.desvios_criticos.forEach(function(d) {
        out.push({ level: 'medium', title: 'Desvio de pilar', desc: d });
      });
    }
    if (a.audiencia_e_origem && a.audiencia_e_origem.sinais_audiencia_vazia) {
      a.audiencia_e_origem.sinais_audiencia_vazia.forEach(function(s) {
        out.push({ level: 'low', title: 'Audiência vazia', desc: s });
      });
    }
    return out;
  }

  function renderAlertsStrip(alerts) {
    var el = document.getElementById('alerts-strip');
    if (!el) return;
    if (!alerts) {
      var stored = state.analysis || loadStoredAnalysis();
      if (!stored) { el.innerHTML = ''; return; }
      alerts = collectAlerts(stored.data || {});
    }
    if (!alerts.length) { el.innerHTML = ''; return; }
    var high = alerts.filter(function(a) { return a.level === 'high'; }).length;
    var med = alerts.filter(function(a) { return a.level === 'medium'; }).length;
    el.innerHTML = '<div class="alerts-strip">' +
      '<div class="alerts-strip-h">⚠️ Alertas ativos</div>' +
      (high ? '<span class="alert-badge alert-high">' + high + ' críticos</span>' : '') +
      (med ? '<span class="alert-badge alert-medium">' + med + ' atenção</span>' : '') +
      '<button class="alert-jump" onclick="switchTab(\'estrategia\');switchSubtab(\'alertas\')">Ver detalhes →</button>' +
    '</div>';
  }

  function renderQuickDiagnostic() {
    var el = document.getElementById('quick-diagnostic');
    if (!el) return;
    var stored = state.analysis || loadStoredAnalysis();
    if (!stored || !stored.data || !stored.data.diagnostico_executivo) {
      el.innerHTML = '';
      return;
    }
    el.innerHTML = '<div class="quick-diag">' +
      '<div class="t-label">⭐ Diagnóstico mais recente</div>' +
      '<div class="quick-diag-text">' + esc(stored.data.diagnostico_executivo) + '</div>' +
      '<button class="btn btn-ghost btn-sm" onclick="switchTab(\'estrategia\')">Ver análise completa →</button>' +
    '</div>';
  }

  function renderPostAlignmentHTML(p, isGood) {
    return '<div class="post-align ' + (isGood ? 'pa-good' : 'pa-bad') + '">' +
      '<div class="pa-head">' +
        '<strong>' + esc(p.post_id || '') + '</strong>' +
        '<div class="pa-score">' + (p.score || 0) + '/10</div>' +
      '</div>' +
      (p.flags && p.flags.length ? '<ul class="pa-list">' + p.flags.map(function(f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul>' : '') +
      (p.fortalezas && p.fortalezas.length ? '<ul class="pa-list pa-list-good">' + p.fortalezas.map(function(f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul>' : '') +
    '</div>';
  }

  function humanAgo(d) {
    var diff = Date.now() - d.getTime();
    var mins = Math.floor(diff / 60000);
    if (mins < 1) return 'agora';
    if (mins < 60) return 'há ' + mins + 'min';
    var h = Math.floor(mins / 60);
    if (h < 24) return 'há ' + h + 'h';
    var d2 = Math.floor(h / 24);
    return 'há ' + d2 + 'd';
  }

  window.switchSubtab = function(name) {
    document.querySelectorAll('.ig-subtab').forEach(function(b) {
      b.classList.toggle('active', b.dataset.sub === name);
    });
    document.querySelectorAll('.sub-panel').forEach(function(p) {
      p.classList.toggle('active', p.id === 'sub-' + name);
    });
  };

  function renderPatternHTML(p, isBottom) {
    return '<div class="pattern-item ' + (isBottom ? 'pattern-bad' : 'pattern-good') + '">' +
      '<div class="pattern-name">' + esc(p.padrao || '') + '</div>' +
      (p.performance_lift ? '<div class="pattern-lift">📈 ' + esc(p.performance_lift) + '</div>' : '') +
      (p.performance_drop ? '<div class="pattern-lift pattern-down">📉 ' + esc(p.performance_drop) + '</div>' : '') +
      (p.evidencias_post_ids && p.evidencias_post_ids.length ?
        '<div class="pattern-ev">' + p.evidencias_post_ids.map(function(e) { return '<span class="ev-tag">' + esc(e) + '</span>'; }).join('') + '</div>' : '') +
      (p.hipotese ? '<div class="pattern-hyp">' + esc(p.hipotese) + '</div>' : '') +
    '</div>';
  }

  function renderPautaHTML(p, idx) {
    var safeIdx = typeof idx === 'number' ? idx : 0;
    return '<div class="pauta-item" data-pauta-idx="' + safeIdx + '">' +
      '<div class="pauta-head">' +
        '<div class="pauta-title">' + esc(p.titulo || '') + '</div>' +
        (typeof p.score_estrategico_0_10 === 'number' ? '<div class="pauta-score">' + p.score_estrategico_0_10 + '/10</div>' : '') +
      '</div>' +
      '<div class="pauta-tags">' +
        (p.formato ? '<span class="pauta-tag">' + esc(p.formato) + '</span>' : '') +
        (p.pilar ? '<span class="pauta-tag tag-pilar">' + esc(p.pilar) + '</span>' : '') +
        (p.arquetipo_dominante ? '<span class="pauta-tag tag-arq">' + esc(p.arquetipo_dominante) + '</span>' : '') +
        (p.persona_alvo && p.persona_alvo.length ? p.persona_alvo.map(function(x) { return '<span class="pauta-tag tag-pers">' + esc(x) + '</span>'; }).join('') : '') +
      '</div>' +
      (p.justificativa ? '<div class="pauta-just">' + esc(p.justificativa) + '</div>' : '') +
      (p.estrutura && p.estrutura.length ? '<div class="pauta-est"><div class="t-label">Estrutura</div><ul>' + p.estrutura.map(function(s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul></div>' : '') +
      '<div class="pauta-actions">' +
        '<button class="btn btn-primary btn-sm" onclick="sendPautaToContent(' + safeIdx + ', this)">📅 Enviar para Planejamento</button>' +
      '</div>' +
    '</div>';
  }

  function pilarToCategory(pilar) {
    if (!pilar) return 'Maquiagem Profissional';
    var p = pilar.toLowerCase();
    if (p.indexOf('noiva') !== -1) return 'Noivas';
    if (p.indexOf('autoridade') !== -1 || p.indexOf('técnic') !== -1 || p.indexOf('tecnic') !== -1) return 'Maquiagem Profissional';
    if (p.indexOf('cacho') !== -1 || p.indexOf('cresp') !== -1) return 'Cachos e Crespos';
    if (p.indexOf('penteado') !== -1) return 'Penteados';
    if (p.indexOf('automaqui') !== -1) return 'Automaquiagem';
    if (p.indexOf('lifestyle') !== -1 || p.indexOf('vida') !== -1) return 'Vida e Lifestyle';
    if (p.indexOf('produto') !== -1 || p.indexOf('compra') !== -1) return 'Compras e Produtos';
    return 'Maquiagem Profissional';
  }

  window.sendPautaToContent = function(idx, btn) {
    var a = (state.analysis || loadStoredAnalysis() || {}).data;
    if (!a || !a.pautas_proxima_semana || !a.pautas_proxima_semana[idx]) {
      toast('Pauta não encontrada', true);
      return;
    }
    var p = a.pautas_proxima_semana[idx];
    var category = pilarToCategory(p.pilar);
    var formato = p.formato || 'Reels';

    var notesLines = [];
    if (p.justificativa) notesLines.push('💡 ' + p.justificativa);
    if (typeof p.score_estrategico_0_10 === 'number') notesLines.push('Score estratégico: ' + p.score_estrategico_0_10 + '/10');
    if (p.persona_alvo && p.persona_alvo.length) notesLines.push('Persona-alvo: ' + p.persona_alvo.join(', '));
    if (p.arquetipo_dominante) notesLines.push('Arquétipo: ' + p.arquetipo_dominante);
    if (p.estrutura && p.estrutura.length) {
      notesLines.push('');
      notesLines.push('Estrutura sugerida:');
      p.estrutura.forEach(function(s, i) { notesLines.push((i + 1) + '. ' + s); });
    }
    notesLines.push('');
    notesLines.push('— Gerado pelo Insights IA do Instagram');

    var uid = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    var idea = {
      id: uid,
      title: p.titulo || 'Pauta sem título',
      categories: [category],
      formatos: [formato],
      status: 'Nao Iniciado',
      notes: notesLines.join('\n'),
      platforms: ['Instagram'],
      scheduledDate: '',
      createdAt: new Date().toISOString()
    };

    try {
      var raw = localStorage.getItem('mk_content_ideas');
      var ideas = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(ideas)) ideas = [];
      // dedup por título: se já existe pauta com mesmo título, não duplica
      if (ideas.some(function(i) { return i.title === idea.title; })) {
        toast('Já existe uma ideia com esse título no Planejamento', true);
        return;
      }
      ideas.unshift(idea);
      localStorage.setItem('mk_content_ideas', JSON.stringify(ideas));

      // Sync Supabase (best-effort)
      if (window.DB && DB.conteudo && typeof DB.conteudo.upsert === 'function') {
        DB.conteudo.upsert(idea).catch(function(e) { console.warn('[ig] supabase upsert falhou:', e); });
      }

      if (btn) {
        btn.textContent = '✓ Enviado';
        btn.disabled = true;
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-secondary');
      }
      toast('Pauta enviada — abra o Planejamento');
    } catch (e) {
      console.error('[ig] erro enviando pauta', e);
      toast('Erro: ' + e.message, true);
    }
  };

  window.copyBio = function() {
    var a = (state.analysis || loadStoredAnalysis() || {}).data;
    if (!a || !a.analise_bio || !a.analise_bio.sugestao_pronta) return;
    navigator.clipboard.writeText(a.analise_bio.sugestao_pronta).then(function() {
      toast('Bio copiada');
    });
  };

  // ── Claude Key Modal ─────────────────────────────────────
  window.openClaudeKeyModal = function() {
    var current = getClaudeKey();
    document.getElementById('claude-key-inp').value = current;
    var hint = current ? 'Atual: ' + current.slice(0, 14) + '...' + current.slice(-6) : 'Nenhuma chave configurada.';
    document.getElementById('claude-key-current').textContent = hint;
    document.getElementById('claude-key-modal-bg').classList.add('open');
  };

  window.closeClaudeKeyModal = function() {
    document.getElementById('claude-key-modal-bg').classList.remove('open');
  };

  window.saveClaudeKey = function() {
    var v = (document.getElementById('claude-key-inp').value || '').trim();
    if (!v) { toast('Cole a chave primeiro', true); return; }
    if (!v.startsWith('sk-ant-')) {
      if (!confirm('Essa chave não começa com "sk-ant-". Tem certeza que é uma chave Claude?')) return;
    }
    localStorage.setItem(CLAUDE_KEY, v);
    closeClaudeKeyModal();
    toast('Chave salva ✓');
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

  // ══════════════════════════════════════════════════════════
  //  TAB SWITCHING
  // ══════════════════════════════════════════════════════════
  window.switchTab = function(name) {
    document.querySelectorAll('.ig-tab').forEach(function(b) {
      b.classList.toggle('active', b.dataset.tab === name);
    });
    document.querySelectorAll('.tab-panel').forEach(function(p) {
      p.classList.toggle('active', p.id === 'tab-' + name);
    });
    // Scroll top do conteúdo
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ══════════════════════════════════════════════════════════
  //  VALIDADOR DE POST — Post Strategist
  // ══════════════════════════════════════════════════════════
  var VAL_STATE = { formato: 'reel', pilar: 'auto', objetivo: 'auto' };

  window.setValFormat = function(f) {
    VAL_STATE.formato = f;
    document.querySelectorAll('.format-pill[data-fmt]').forEach(function(b) {
      b.classList.toggle('active', b.dataset.fmt === f);
    });
  };
  window.setValPilar = function(p) {
    VAL_STATE.pilar = p;
    document.querySelectorAll('.format-pill[data-pilar]').forEach(function(b) {
      b.classList.toggle('active', b.dataset.pilar === p);
    });
  };
  window.setValObj = function(o) {
    VAL_STATE.objetivo = o;
    document.querySelectorAll('.format-pill[data-obj]').forEach(function(b) {
      b.classList.toggle('active', b.dataset.obj === o);
    });
  };

  // Assets do validador — carrossel de imagens OU vídeo (mutuamente exclusivos)
  // VALIDATOR_ASSETS.kind: 'images' | 'video' | null
  var VALIDATOR_ASSETS = { kind: null, images: [], video: null };
  var MAX_VAL_IMAGES = 10;
  var VIDEO_FRAME_COUNT = 10;

  function valAssetsHasContent() {
    if (VALIDATOR_ASSETS.kind === 'images') return VALIDATOR_ASSETS.images.length > 0;
    if (VALIDATOR_ASSETS.kind === 'video') return !!VALIDATOR_ASSETS.video;
    return false;
  }

  window.addValidatorImages = async function(files) {
    if (!files || !files.length) return;
    if (VALIDATOR_ASSETS.kind === 'video') {
      if (!confirm('Já existe um vídeo carregado. Substituir por imagens?')) return;
      VALIDATOR_ASSETS.video = null;
      VALIDATOR_ASSETS.kind = null;
    }
    VALIDATOR_ASSETS.kind = 'images';
    var arr = Array.prototype.slice.call(files);
    var room = MAX_VAL_IMAGES - VALIDATOR_ASSETS.images.length;
    if (arr.length > room) {
      toast('Máximo ' + MAX_VAL_IMAGES + ' imagens. Adicionando as primeiras ' + room + '.', true);
      arr = arr.slice(0, room);
    }
    for (var i = 0; i < arr.length; i++) {
      try {
        var raw = await fileToDataURL(arr[i]);
        var compressed = await compressImage(raw, 1280);
        var m = compressed.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
        if (!m) continue;
        VALIDATOR_ASSETS.images.push({
          dataUrl: compressed,
          mediaType: m[1],
          base64: m[2],
          name: arr[i].name || ('imagem-' + (VALIDATOR_ASSETS.images.length + 1))
        });
      } catch (e) {
        console.warn('[ig] erro carregando imagem do validador', e);
      }
    }
    renderValidatorAssets();
  };

  window.setValidatorVideo = async function(files) {
    if (!files || !files.length) return;
    if (VALIDATOR_ASSETS.kind === 'images' && VALIDATOR_ASSETS.images.length) {
      if (!confirm('Já existem imagens carregadas. Substituir por vídeo?')) return;
      VALIDATOR_ASSETS.images = [];
      VALIDATOR_ASSETS.kind = null;
    }
    var file = files[0];
    var hintEl = document.getElementById('val-assets-hint');
    if (hintEl) hintEl.textContent = 'Processando vídeo... extraindo frames para análise.';
    try {
      var dataUrl = await fileToDataURL(file);
      var extraction = await extractVideoFrames(dataUrl, VIDEO_FRAME_COUNT);
      VALIDATOR_ASSETS.kind = 'video';
      VALIDATOR_ASSETS.video = {
        dataUrl: dataUrl,
        name: file.name || 'reel.mp4',
        durationSec: extraction.durationSec,
        frames: extraction.frames
      };
      renderValidatorAssets();
    } catch (e) {
      console.warn('[ig] erro processando vídeo', e);
      toast('Erro processando vídeo: ' + e.message, true);
      if (hintEl) hintEl.textContent = 'Erro ao processar vídeo. Tente outro arquivo.';
    }
  };

  function extractVideoFrames(videoDataUrl, count) {
    return new Promise(function(resolve, reject) {
      var video = document.createElement('video');
      video.preload = 'auto';
      video.muted = true;
      video.playsInline = true;
      video.src = videoDataUrl;
      video.onerror = function() { reject(new Error('Não consegui ler o vídeo')); };
      video.onloadedmetadata = function() {
        var dur = isFinite(video.duration) ? video.duration : 0;
        if (!dur || dur < 0.1) { reject(new Error('Vídeo sem duração válida')); return; }
        var hookSlice = Math.min(3, dur);
        var hookFrames = Math.min(4, Math.max(2, Math.round(count * 0.35)));
        var bodyFrames = Math.max(1, count - hookFrames);
        var times = [];
        for (var i = 0; i < hookFrames; i++) {
          times.push((hookSlice * (i + 0.5)) / hookFrames);
        }
        if (dur > hookSlice + 0.2) {
          for (var j = 0; j < bodyFrames; j++) {
            var t = hookSlice + ((dur - hookSlice) * (j + 0.5)) / bodyFrames;
            times.push(Math.min(dur - 0.05, t));
          }
        }
        var frames = [];
        var idx = 0;
        var canvas = document.createElement('canvas');
        var maxDim = 720;
        function nextFrame() {
          if (idx >= times.length) { resolve({ durationSec: dur, frames: frames }); return; }
          video.currentTime = times[idx];
        }
        video.onseeked = function() {
          var vw = video.videoWidth, vh = video.videoHeight;
          if (!vw || !vh) { idx++; nextFrame(); return; }
          var scale = Math.min(1, maxDim / Math.max(vw, vh));
          canvas.width = Math.round(vw * scale);
          canvas.height = Math.round(vh * scale);
          var ctx = canvas.getContext('2d');
          try { ctx.drawImage(video, 0, 0, canvas.width, canvas.height); }
          catch (e) { idx++; nextFrame(); return; }
          var url = canvas.toDataURL('image/jpeg', 0.82);
          var m = url.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
          if (m) {
            frames.push({
              dataUrl: url, mediaType: m[1], base64: m[2],
              tSec: Math.round(times[idx] * 10) / 10
            });
          }
          idx++;
          nextFrame();
        };
        nextFrame();
      };
    });
  }

  window.moveValidatorImage = function(idx, dir) {
    var arr = VALIDATOR_ASSETS.images;
    var ni = idx + dir;
    if (ni < 0 || ni >= arr.length) return;
    var tmp = arr[idx]; arr[idx] = arr[ni]; arr[ni] = tmp;
    renderValidatorAssets();
  };

  window.removeValidatorImage = function(idx) {
    VALIDATOR_ASSETS.images.splice(idx, 1);
    if (!VALIDATOR_ASSETS.images.length) VALIDATOR_ASSETS.kind = null;
    renderValidatorAssets();
  };

  window.clearValidatorAssets = function() {
    VALIDATOR_ASSETS = { kind: null, images: [], video: null };
    renderValidatorAssets();
  };

  function renderValidatorAssets() {
    var grid = document.getElementById('val-assets-grid');
    var vwrap = document.getElementById('val-video-wrap');
    var clearBtn = document.getElementById('val-assets-clear');
    var hint = document.getElementById('val-assets-hint');
    if (!grid || !vwrap) return;

    if (VALIDATOR_ASSETS.kind === 'images' && VALIDATOR_ASSETS.images.length) {
      vwrap.style.display = 'none';
      vwrap.innerHTML = '';
      var n = VALIDATOR_ASSETS.images.length;
      grid.innerHTML = VALIDATOR_ASSETS.images.map(function(img, i) {
        var isCover = i === 0;
        return '<div class="val-asset-card' + (isCover ? ' val-asset-cover' : '') + '">' +
          '<div class="val-asset-thumb"><img src="' + img.dataUrl + '" alt=""></div>' +
          '<div class="val-asset-meta">' +
            '<div class="val-asset-pos">' + (i + 1) + '/' + n + (isCover ? ' · CAPA' : '') + '</div>' +
            '<div class="val-asset-name" title="' + esc(img.name) + '">' + esc(img.name) + '</div>' +
          '</div>' +
          '<div class="val-asset-actions">' +
            (i > 0 ? '<button class="val-asset-btn" onclick="moveValidatorImage(' + i + ',-1)" title="Mover para esquerda">←</button>' : '<span class="val-asset-btn ghost">←</span>') +
            (i < n - 1 ? '<button class="val-asset-btn" onclick="moveValidatorImage(' + i + ',1)" title="Mover para direita">→</button>' : '<span class="val-asset-btn ghost">→</span>') +
            '<button class="val-asset-btn val-asset-rm" onclick="removeValidatorImage(' + i + ')" title="Remover">×</button>' +
          '</div>' +
        '</div>';
      }).join('');
      if (hint) hint.textContent = n === 1
        ? 'Foto única — a IA analisa como capa/post unitário.'
        : 'Carrossel com ' + n + ' imagens · ordem atual será avaliada e podem ser sugeridas mudanças.';
    } else if (VALIDATOR_ASSETS.kind === 'video' && VALIDATOR_ASSETS.video) {
      grid.innerHTML = '';
      var v = VALIDATOR_ASSETS.video;
      vwrap.style.display = 'block';
      vwrap.innerHTML =
        '<div class="val-video-card">' +
          '<div class="val-video-head">' +
            '<div class="val-video-icon">🎬</div>' +
            '<div class="val-video-info">' +
              '<div class="val-video-name">' + esc(v.name) + '</div>' +
              '<div class="val-video-meta">' + v.durationSec.toFixed(1) + 's · ' + v.frames.length + ' frames extraídos para análise</div>' +
            '</div>' +
          '</div>' +
          '<video class="val-video-preview" src="' + v.dataUrl + '" controls playsinline muted></video>' +
          '<div class="val-frames-strip">' +
            v.frames.map(function(f, i) {
              return '<div class="val-frame">' +
                '<img src="' + f.dataUrl + '" alt="frame ' + i + '">' +
                '<div class="val-frame-t">' + f.tSec.toFixed(1) + 's</div>' +
              '</div>';
            }).join('') +
          '</div>' +
        '</div>';
      if (hint) hint.textContent = 'Reel · capa = frame 1. Hook = primeiros 3s. IA vai analisar ritmo, retenção e cortes.';
    } else {
      grid.innerHTML = '';
      vwrap.style.display = 'none';
      vwrap.innerHTML = '';
      if (hint) hint.textContent = 'Adicione fotos na ORDEM exata do carrossel ou um vídeo de reel.';
    }
    if (clearBtn) clearBtn.style.display = valAssetsHasContent() ? '' : 'none';
  }

  // assetKind: 'images' | 'video' | null; assetMeta: { n?, duration? }
  function buildValidatorPrompt(briefing, visual, assetKind, assetMeta) {
    var sections = [
      brandToText(),
      dataToText().split('### Insights da conta')[0],
    ].filter(Boolean);

    var ctx = sections.join('\n\n---\n\n');

    var assetBlock = '';
    if (assetKind === 'images') {
      var n = assetMeta.n || 0;
      assetBlock = '**MÍDIA ANEXADA — CARROSSEL DE ' + n + ' IMAGEM(NS):**\n' +
        'As ' + n + ' imagens anexadas estão na ORDEM ATUAL planejada pela Carol.\n' +
        '- Imagem 1 = capa atual (primeira a aparecer no feed)\n' +
        '- Imagens 2-' + n + ' = sequência do carrossel (swipe-through)\n' +
        'Analise CADA imagem individualmente E o conjunto como narrativa. Preencha `analise_carrossel` no JSON.\n\n';
    } else if (assetKind === 'video') {
      var dur = assetMeta.duration || 0;
      var fc = assetMeta.frameCount || 0;
      assetBlock = '**MÍDIA ANEXADA — VÍDEO/REEL (' + dur.toFixed(1) + 's):**\n' +
        fc + ' frames foram extraídos do vídeo em ordem cronológica:\n' +
        '- Os primeiros ~4 frames cobrem os PRIMEIROS 3 SEGUNDOS (HOOK — crítico para retenção)\n' +
        '- Os demais frames são espaçados pelo resto do vídeo (body)\n' +
        '- Frame 1 = capa/thumb atual do Reel\n' +
        'Analise hook, ritmo, cortes, enquadramento, iluminação, expressão, energia, clareza, CTA visual, legendas, estética, autoralidade (genérico vs autoral), autoridade vs venda. Preencha `analise_reel` no JSON.\n\n';
    }

    var task = '\n\n---\n\n## TAREFA — VALIDAÇÃO DE POST PRÉ-PUBLICAÇÃO\n\n' +
'Você é estrategista de marca + diretor criativo + social media premium + analista de comportamento + especialista em posicionamento. Atue como consultor que valida cada post antes de a Carol publicar.\n\n' +
'## POST EM AVALIAÇÃO\n\n' +
'**Formato planejado:** ' + VAL_STATE.formato + '\n' +
'**Pilar pretendido:** ' + VAL_STATE.pilar + (VAL_STATE.pilar === 'auto' ? ' (você identifica)' : '') + '\n' +
'**Objetivo:** ' + VAL_STATE.objetivo + (VAL_STATE.objetivo === 'auto' ? ' (você sugere)' : '') + '\n\n' +
'**Briefing / ideia:**\n' + briefing + '\n\n' +
(visual ? '**Descrição visual (texto):**\n' + visual + '\n\n' : '') +
assetBlock +
'## OUTPUT — JSON ESTRUTURADO\n\n' +
'Retorne SOMENTE JSON válido (sem markdown ```json```, sem prefácio). Use APENAS os blocos relevantes ao tipo de mídia anexada (carrossel → `analise_carrossel`; vídeo → `analise_reel`; imagem única → `analise_visual`; sem mídia → omita todos os 3 blocos visuais). Estrutura:\n\n' +
'```json\n{\n' +
'  "score_geral": 0,\n' +
'  "veredito": "PUBLICAR|AJUSTAR|REPENSAR",\n' +
'  "veredito_resumo": "1 frase justificando o veredito",\n' +
'  "pilar_identificado": { "pilar": "Noivas Premium|Autoridade Técnica|Cachos & Crespos|Carol-Presença|Produtos|Social Beauty", "justificativa": "por que esse pilar" },\n' +
'  "alinhamento_brand_brain": { "score_0_10": 0, "pontos_fortes": ["..."], "pontos_fracos": ["..."] },\n' +
'  "persona_atrai": { "principal": "P1|P2|P3|P4", "secundaria": "...", "justificativa": "..." },\n' +
'  "arquetipo_ativado": "Criadora|Cuidadora|Sábia",\n' +
'  "formato_ideal": { "sugerido": "Reel|Carrossel|Foto|Story|Storytelling|Bastidores|Autoridade|Conversão", "justificativa": "..." },\n' +
'  "problemas_identificados": [ { "categoria": "Tom|Visual|Posicionamento|Estrutura", "problema": "...", "gravidade": "alta|media|baixa" } ],\n' +
'  "melhorias_sugeridas": [ { "antes": "...", "depois": "...", "porque": "..." } ],\n' +
'  "hook_sugerido": { "primeira_opcao": "...", "segunda_opcao": "...", "principio": "..." },\n' +
'  "cta_sugerido": { "texto": "...", "justificativa": "..." },\n' +
'  "legenda_sugerida": "Legenda completa multilinha com \\n",\n' +
'  "titulo_capa": { "texto": "máx 3 palavras", "fonte_recomendada": "Cormorant Garamond Bold Italic" },\n' +
'  "melhorias_visuais": [ { "elemento": "luz|enquadramento|composição|tratamento|fundo", "diretriz": "..." } ],\n' +
(assetKind === 'images' ?
'  "analise_carrossel": {\n' +
'    "score_0_10": 0,\n' +
'    "leitura_geral": "1 parágrafo sobre a narrativa do carrossel como um todo",\n' +
'    "ordem_atual_avaliacao": "a ordem atual funciona ou prejudica? por quê?",\n' +
'    "coerencia_visual": "coerência entre as imagens (paleta, tratamento, mood, tipografia)",\n' +
'    "ritmo_narrativa": "tem ritmo? abre, desenvolve, fecha? ou é um loop visual sem progressão?",\n' +
'    "equilibrio_estetica_info_impacto": "está equilibrado ou pesa demais em info/estética/impacto?",\n' +
'    "excesso_informacao": false,\n' +
'    "repeticao_visual": false,\n' +
'    "imagens": [\n' +
'      { "posicao": 1, "papel": "capa|hook|desenvolvimento|prova|cta|fechamento", "forca": "alta|media|baixa", "para_scroll": "alto|medio|baixo", "fortalece_post": true, "leitura": "1-2 frases sobre essa imagem", "ajuste_sugerido": "ou null se ok" }\n' +
'    ],\n' +
'    "melhor_capa": { "posicao_atual": 1, "razao": "por que essa funciona como capa OU por que outra funcionaria melhor" },\n' +
'    "ordem_sugerida": [1, 3, 2, 4],\n' +
'    "ordem_sugerida_justificativa": "por que essa nova ordem",\n' +
'    "imagens_para_remover": [ { "posicao": 0, "motivo": "..." } ],\n' +
'    "imagens_para_substituir": [ { "posicao": 0, "motivo": "...", "sugestao_substituicao": "tipo de imagem que entraria no lugar" } ],\n' +
'    "imagens_que_fortalecem": [1],\n' +
'    "imagens_que_enfraquecem": [3],\n' +
'    "pontos_fortes_globais": ["..."],\n' +
'    "pontos_fracos_globais": ["..."],\n' +
'    "ajustes_imediatos": ["..."]\n' +
'  },\n' : '') +
(assetKind === 'video' ?
'  "analise_reel": {\n' +
'    "score_0_10": 0,\n' +
'    "leitura_geral": "1 parágrafo sobre o reel como um todo",\n' +
'    "hook_3s": { "score_0_10": 0, "leitura": "o que acontece nos primeiros 3s? prende? gera curiosidade?", "ajustes": ["..."] },\n' +
'    "retencao": { "potencial": "alto|medio|baixo", "pontos_queda_previstos": [ { "momento_aprox_seg": 5, "motivo": "..." } ], "justificativa": "..." },\n' +
'    "ritmo": "rápido|equilibrado|arrastado — análise dos cortes e densidade de informação",\n' +
'    "cortes_dinamica": "cortes secos? cortes longos? variação de planos? estática?",\n' +
'    "enquadramento": "fechado/aberto, regra dos terços, profundidade, framing",\n' +
'    "iluminacao": "natural|estúdio|mista — qualidade, sombras, temperatura, coerência com Premium",\n' +
'    "expressao": "expressão facial, olhar, linguagem corporal, energia transmitida",\n' +
'    "energia": "alta|média|baixa — combina com objetivo?",\n' +
'    "clareza_mensagem": "mensagem clara em 1 frase? ou confusa?",\n' +
'    "estetica_geral": "alinha com paleta café/terra/nude e premium? mood?",\n' +
'    "consistencia_posicionamento": "alinha com posicionamento Premium da Carol? algo destoa?",\n' +
'    "autoralidade": "autoral|genérico — soa como Carol ou parecido com qualquer maquiadora?",\n' +
'    "tom_predominante": "autoridade|conexão|venda-excessiva|misto — qual predomina?",\n' +
'    "potencial_compartilhamento": "alto|medio|baixo + por quê",\n' +
'    "potencial_viralizacao": "alto|medio|baixo + por quê",\n' +
'    "cta_visual": "tem CTA visual/falado claro? sugestão se faltar",\n' +
'    "legendas_textos_tela": "se houver, hierarquia/timing/contraste/erros",\n' +
'    "timing_informacao": "info distribuída bem ao longo? ou empilhada no início/fim?",\n' +
'    "momentos_fortes": [ { "tempo_aprox_seg": 7, "razao": "...", "potencial_corte_curto": true } ],\n' +
'    "trechos_virariam_cortes": [ { "tempo_aprox_seg": 12, "ideia_corte": "frase ou cena destacável que vira reel de 6s" } ],\n' +
'    "sugestoes_melhorias": ["..."],\n' +
'    "thumb_capa_atual": "leitura do frame 1 (capa atual)",\n' +
'    "thumb_capa_recomendada": { "frame_aprox_seg": 4, "razao": "esse momento funciona melhor como capa porque..." },\n' +
'    "texto_capa_sugerido": ["3 opções de texto curto pra capa, máx 3-4 palavras cada"],\n' +
'    "comparativo_reels_passados": "cruzando com top reels recentes da Carol, esse se parece com quais? que padrões dos top reels ele reproduz ou ignora?",\n' +
'    "padroes_top_reels": ["padrões recorrentes detectados nos posts de melhor performance"],\n' +
'    "ajustes_imediatos": ["3-5 mudanças concretas"]\n' +
'  },\n' : '') +
(assetKind === null ? '' :
'  "analise_visual": { "score_0_10": 0, "leitura_geral": "1 parágrafo", "design_composicao": "...", "estetica_branding": "...", "legibilidade": "...", "expressao_enquadramento": "...", "pontos_fortes_visuais": ["..."], "pontos_fracos_visuais": ["..."], "ajustes_imediatos": ["..."] },\n') +
'  "potencial_performance": { "alcance": "alto|medio|baixo", "engajamento": "alto|medio|baixo", "conversao": "alto|medio|baixo", "salvamento": "alto|medio|baixo", "justificativa": "cruzando com performance recente" },\n' +
'  "vs_feed_recente": { "repetitivo": false, "diversidade": "...", "posts_relacionados": ["..."], "proximo_passo_sugerido": "..." }\n' +
'}\n```\n\n' +
'## REGRAS\n\n' +
'- Use Brand Brain como lente principal. Avalie posicionamento, tom, palavras da marca/proibidas.\n' +
'- Seja específico. Cite trechos exatos do briefing e momentos exatos do vídeo/imagens quando apontar problemas.\n' +
'- Para carrossel: avalie ordem, capa, scroll-stoppers, coerência, ritmo, e sugira reordenação concreta.\n' +
'- Para reel: cruze ritmo + hook + retenção + tom + autoralidade. Indique momentos mais fortes por segundo aproximado.\n' +
'- Cruze TUDO com o feed recente, top posts e Brand Brain — todas as análises devem dialogar entre si.\n' +
'- Português brasileiro, tom direto e profissional. Retorne SOMENTE o JSON.';

    return ctx + task;
  }

  function loadValidations() {
    try {
      var raw = localStorage.getItem(VALIDATIONS_KEY);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }

  function saveValidations(arr) {
    try {
      localStorage.setItem(VALIDATIONS_KEY, JSON.stringify(arr.slice(0, MAX_VALIDATIONS)));
    } catch (e) { console.warn('[ig] não salvou validações:', e); }
  }

  function restoreLastValidation() {
    var list = loadValidations();
    if (!list.length) {
      renderValidationHistory();
      return;
    }
    var latest = list[0];
    // Restaura inputs visualmente
    if (latest.inputs) {
      var bf = document.getElementById('val-briefing');
      var vs = document.getElementById('val-visual');
      if (bf) bf.value = latest.inputs.briefing || '';
      if (vs) vs.value = latest.inputs.visual || '';
      if (latest.inputs.formato) setValFormat(latest.inputs.formato);
      if (latest.inputs.pilar) setValPilar(latest.inputs.pilar);
      if (latest.inputs.objetivo) setValObj(latest.inputs.objetivo);
    }
    // Renderiza resultado salvo
    if (latest.result) {
      if (latest.inputs && latest.inputs.assets) latest.result.__inputAssets = latest.inputs.assets;
      renderValidatorResult(latest.result, latest.generatedAt);
    }
    renderValidationHistory();
  }

  function renderValidationHistory() {
    var el = document.getElementById('validate-history');
    if (!el) return;
    var list = loadValidations();
    if (!list.length) {
      el.innerHTML = '';
      return;
    }
    el.innerHTML = '<div class="hist-card">' +
      '<div class="hist-h">📜 Validações anteriores (' + list.length + ')</div>' +
      list.slice(0, 5).map(function(v, i) {
        var d = new Date(v.generatedAt);
        var brief = (v.inputs && v.inputs.briefing || '').replace(/\n/g, ' ').slice(0, 60);
        var ver = (v.result && v.result.veredito) || '—';
        var verCls = ver === 'PUBLICAR' ? 'pub' : ver === 'AJUSTAR' ? 'adj' : ver === 'REPENSAR' ? 'rep' : '';
        return '<div class="hist-item" onclick="loadValidation(' + i + ')">' +
          '<div class="hist-i-l">' +
            '<div class="hist-i-brief">' + esc(brief) + (brief.length >= 60 ? '...' : '') + '</div>' +
            '<div class="hist-i-meta">' + humanAgo(d) + ' · ' + esc(v.inputs && v.inputs.formato || '?') + '</div>' +
          '</div>' +
          '<div class="hist-i-ver ver-' + verCls + '">' + esc(ver) + '</div>' +
        '</div>';
      }).join('') +
      '<button class="btn btn-ghost btn-sm" onclick="clearValidations()" style="margin-top:8px">🗑 Limpar histórico</button>' +
    '</div>';
  }

  window.loadValidation = function(idx) {
    var list = loadValidations();
    var v = list[idx];
    if (!v) return;
    if (v.inputs) {
      document.getElementById('val-briefing').value = v.inputs.briefing || '';
      document.getElementById('val-visual').value = v.inputs.visual || '';
      if (v.inputs.formato) setValFormat(v.inputs.formato);
      if (v.inputs.pilar) setValPilar(v.inputs.pilar);
      if (v.inputs.objetivo) setValObj(v.inputs.objetivo);
    }
    if (v.result) {
      if (v.inputs && v.inputs.assets) v.result.__inputAssets = v.inputs.assets;
      renderValidatorResult(v.result, v.generatedAt);
    }
    toast('Validação carregada');
  };

  window.clearValidations = function() {
    if (!confirm('Apagar todo o histórico de validações (mobile + desktop)?')) return;
    localStorage.removeItem(VALIDATIONS_KEY);
    document.getElementById('validate-result').innerHTML = '';
    renderValidationHistory();
    if (typeof DB !== 'undefined' && DB.instagram && !window._SB_ERROR) {
      DB.instagram.validations.clear().catch(function(err) {
        console.warn('[ig] clear Supabase falhou:', err.message);
      });
    }
    toast('Histórico apagado');
  };

  window.validatePost = async function() {
    var briefing = (document.getElementById('val-briefing').value || '').trim();
    if (!briefing) {
      toast('Cole a ideia/briefing primeiro', true);
      return;
    }
    if (!getClaudeKey()) {
      toast('Configure sua chave Claude primeiro', true);
      openClaudeKeyModal();
      return;
    }
    if (!state.profile) {
      toast('Aguarda os dados do Instagram carregarem', true);
      return;
    }

    var visual = (document.getElementById('val-visual').value || '').trim();
    var btn = document.getElementById('btn-validate');
    var statusEl = document.getElementById('validate-status');
    var resultEl = document.getElementById('validate-result');

    if (btn) { btn.disabled = true; btn.textContent = '✨ Analisando...'; }
    if (statusEl) statusEl.innerHTML = '<div class="spinner-sm"></div> Cruzando com Brand Brain + performance recente...';
    if (resultEl) resultEl.innerHTML = '';

    try {
      var assetKind = VALIDATOR_ASSETS.kind;
      var assetMeta = {};
      var visionBlocks = [];

      if (assetKind === 'images') {
        assetMeta.n = VALIDATOR_ASSETS.images.length;
        VALIDATOR_ASSETS.images.forEach(function(img, i) {
          visionBlocks.push({ type: 'text', text: 'IMAGEM ' + (i + 1) + '/' + assetMeta.n + (i === 0 ? ' (CAPA)' : '') + ':' });
          visionBlocks.push({ type: 'image', source: { type: 'base64', media_type: img.mediaType, data: img.base64 } });
        });
      } else if (assetKind === 'video') {
        var vid = VALIDATOR_ASSETS.video;
        assetMeta.duration = vid.durationSec;
        assetMeta.frameCount = vid.frames.length;
        vid.frames.forEach(function(f, i) {
          var label = 'FRAME ' + (i + 1) + '/' + vid.frames.length + ' @ ' + f.tSec.toFixed(1) + 's' +
            (i === 0 ? ' (CAPA/THUMB ATUAL)' : (f.tSec <= 3 ? ' (HOOK)' : ''));
          visionBlocks.push({ type: 'text', text: label + ':' });
          visionBlocks.push({ type: 'image', source: { type: 'base64', media_type: f.mediaType, data: f.base64 } });
        });
      }

      var prompt = buildValidatorPrompt(briefing, visual, assetKind, assetMeta);
      console.log('[ig] validator prompt size:', prompt.length, '· mídia:', assetKind, assetMeta);

      var callPayload;
      if (visionBlocks.length) {
        callPayload = visionBlocks.concat([{ type: 'text', text: prompt }]);
        if (statusEl) {
          statusEl.innerHTML = '<div class="spinner-sm"></div> Analisando ' +
            (assetKind === 'images' ? assetMeta.n + ' imagens do carrossel' : assetMeta.frameCount + ' frames do reel') +
            ' + briefing com Claude Vision...';
        }
      } else {
        callPayload = prompt;
      }

      var result = await callClaude(callPayload);

      var inputAssets = null;
      if (assetKind === 'images') {
        inputAssets = { kind: 'images', images: VALIDATOR_ASSETS.images.map(function(im) { return { dataUrl: im.dataUrl, name: im.name }; }) };
      } else if (assetKind === 'video') {
        inputAssets = {
          kind: 'video',
          name: VALIDATOR_ASSETS.video.name,
          durationSec: VALIDATOR_ASSETS.video.durationSec,
          frames: VALIDATOR_ASSETS.video.frames.map(function(f) { return { dataUrl: f.dataUrl, tSec: f.tSec }; })
        };
      }

      var validation = {
        id: String(Date.now()),
        generatedAt: Date.now(),
        inputs: {
          briefing: briefing,
          visual: visual,
          formato: VAL_STATE.formato,
          pilar: VAL_STATE.pilar,
          objetivo: VAL_STATE.objetivo,
          assets: inputAssets
        },
        result: result.parsed,
        usage: result.usage
      };
      // Salva no histórico local (novo no topo) + Supabase
      var hist = loadValidations();
      hist.unshift(validation);
      saveValidations(hist);
      pushValidationToSupabase(validation);
      renderValidatorResult(result.parsed, validation.generatedAt);
      renderValidationHistory();
      if (statusEl) statusEl.innerHTML = '<span class="t-caption">✓ Análise salva · ' + (result.usage ? fmtNum(result.usage.input_tokens) + ' → ' + fmtNum(result.usage.output_tokens) + ' tokens' : '') + '</span>';
    } catch (err) {
      console.error('[ig] validator error:', err);
      if (statusEl) statusEl.innerHTML = '<span style="color:var(--danger)">Erro: ' + esc(err.message) + '</span>';
      toast('Erro: ' + err.message, true);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '✨ Validar com IA'; }
    }
  };

  function renderValidatorResult(r, generatedAt) {
    var el = document.getElementById('validate-result');
    if (!el) return;

    var verCls = r.veredito === 'PUBLICAR' ? 'ver-publish' :
                 r.veredito === 'AJUSTAR' ? 'ver-adjust' : 'ver-rethink';
    var verIcon = r.veredito === 'PUBLICAR' ? '✅' :
                  r.veredito === 'AJUSTAR' ? '✏️' : '🤔';
    var score = r.score_geral || 0;

    var html = '';
    if (generatedAt) {
      html += '<div class="val-meta">💾 Salva ' + humanAgo(new Date(generatedAt)) + ' · análise persistida no navegador</div>';
    }

    html += '<div class="val-hero ' + verCls + '">' +
      '<div class="val-verdict">' +
        '<div class="val-verdict-icon">' + verIcon + '</div>' +
        '<div>' +
          '<div class="val-verdict-label">' + esc(r.veredito || '—') + '</div>' +
          '<div class="val-verdict-sub">' + esc(r.veredito_resumo || '') + '</div>' +
        '</div>' +
        '<div class="val-score-big">' + score + '<span>/10</span></div>' +
      '</div>' +
      '<div class="score-bar"><div class="score-bar-f" style="width:' + (score * 10) + '%"></div></div>' +
    '</div>';

    // Identificação (pilar, persona, arquétipo, formato)
    html += '<div class="val-grid">';
    if (r.pilar_identificado) {
      html += '<div class="val-tile"><div class="val-tile-h">🏛️ Pilar</div>' +
        '<div class="val-tile-v">' + esc(r.pilar_identificado.pilar || '—') + '</div>' +
        '<div class="val-tile-d">' + esc(r.pilar_identificado.justificativa || '') + '</div></div>';
    }
    if (r.persona_atrai) {
      html += '<div class="val-tile"><div class="val-tile-h">🎯 Persona</div>' +
        '<div class="val-tile-v">' + esc(r.persona_atrai.principal || '—') + '</div>' +
        (r.persona_atrai.secundaria ? '<div class="val-tile-sub">+ ' + esc(r.persona_atrai.secundaria) + '</div>' : '') +
        '<div class="val-tile-d">' + esc(r.persona_atrai.justificativa || '') + '</div></div>';
    }
    if (r.arquetipo_ativado) {
      html += '<div class="val-tile"><div class="val-tile-h">⚡ Arquétipo</div>' +
        '<div class="val-tile-v">' + esc(r.arquetipo_ativado) + '</div></div>';
    }
    if (r.formato_ideal) {
      html += '<div class="val-tile"><div class="val-tile-h">🎬 Formato ideal</div>' +
        '<div class="val-tile-v">' + esc(r.formato_ideal.sugerido || '—') + '</div>' +
        '<div class="val-tile-d">' + esc(r.formato_ideal.justificativa || '') + '</div></div>';
    }
    html += '</div>';

    // Alinhamento brand brain
    if (r.alinhamento_brand_brain) {
      var ab = r.alinhamento_brand_brain;
      html += '<div class="analysis-block">' +
        '<div class="analysis-h">🎯 Alinhamento Brand Brain · ' + (ab.score_0_10 || 0) + '/10</div>' +
        '<div class="val-cols">' +
          (ab.pontos_fortes && ab.pontos_fortes.length ?
            '<div class="aud-col aud-col-good"><div class="aud-col-h">✓ Pontos fortes</div><ul>' +
            ab.pontos_fortes.map(function(s) { return '<li>' + esc(s) + '</li>'; }).join('') +
            '</ul></div>' : '') +
          (ab.pontos_fracos && ab.pontos_fracos.length ?
            '<div class="aud-col aud-col-bad"><div class="aud-col-h">⚠ Pontos fracos</div><ul>' +
            ab.pontos_fracos.map(function(s) { return '<li>' + esc(s) + '</li>'; }).join('') +
            '</ul></div>' : '') +
        '</div>' +
      '</div>';
    }

    // Análise de carrossel (múltiplas imagens)
    if (r.analise_carrossel) {
      var ac = r.analise_carrossel;
      var carouselImgs = (generatedAt && r.__inputAssets && r.__inputAssets.kind === 'images')
        ? r.__inputAssets.images
        : (VALIDATOR_ASSETS.kind === 'images' ? VALIDATOR_ASSETS.images : []);
      html += '<div class="analysis-block val-carousel-block">' +
        '<div class="analysis-h">🖼️ Análise do carrossel · ' + (ac.score_0_10 || 0) + '/10</div>' +
        (ac.leitura_geral ? '<div class="diag-text">' + esc(ac.leitura_geral) + '</div>' : '') +
        '<div class="val-carousel-meta-grid">' +
          (ac.ordem_atual_avaliacao ? '<div class="val-meta-tile"><div class="val-meta-h">📐 Ordem atual</div><div>' + esc(ac.ordem_atual_avaliacao) + '</div></div>' : '') +
          (ac.coerencia_visual ? '<div class="val-meta-tile"><div class="val-meta-h">🎨 Coerência visual</div><div>' + esc(ac.coerencia_visual) + '</div></div>' : '') +
          (ac.ritmo_narrativa ? '<div class="val-meta-tile"><div class="val-meta-h">🎵 Ritmo & narrativa</div><div>' + esc(ac.ritmo_narrativa) + '</div></div>' : '') +
          (ac.equilibrio_estetica_info_impacto ? '<div class="val-meta-tile"><div class="val-meta-h">⚖️ Equilíbrio</div><div>' + esc(ac.equilibrio_estetica_info_impacto) + '</div></div>' : '') +
        '</div>' +
        '<div class="val-flag-row">' +
          '<span class="val-flag ' + (ac.excesso_informacao ? 'flag-bad' : 'flag-good') + '">' + (ac.excesso_informacao ? '⚠ Excesso de informação' : '✓ Densidade ok') + '</span>' +
          '<span class="val-flag ' + (ac.repeticao_visual ? 'flag-bad' : 'flag-good') + '">' + (ac.repeticao_visual ? '⚠ Repetição visual' : '✓ Sem repetição') + '</span>' +
        '</div>';

      // Análise por imagem individual
      if (ac.imagens && ac.imagens.length) {
        html += '<div class="val-imgs-analysis">' +
          ac.imagens.map(function(ai) {
            var pos = ai.posicao;
            var thumb = (carouselImgs && carouselImgs[pos - 1]) ? carouselImgs[pos - 1].dataUrl : null;
            var forcaCls = ai.forca === 'alta' ? 'pot-high' : ai.forca === 'media' ? 'pot-med' : 'pot-low';
            var scrollCls = ai.para_scroll === 'alto' ? 'pot-high' : ai.para_scroll === 'medio' ? 'pot-med' : 'pot-low';
            return '<div class="val-img-row ' + (ai.fortalece_post === false ? 'val-img-weak' : '') + '">' +
              '<div class="val-img-pos">#' + pos + '</div>' +
              (thumb ? '<div class="val-img-thumb"><img src="' + thumb + '" alt=""></div>' : '<div class="val-img-thumb val-img-thumb-empty"></div>') +
              '<div class="val-img-body">' +
                '<div class="val-img-tags">' +
                  (ai.papel ? '<span class="ev-tag">' + esc(ai.papel) + '</span>' : '') +
                  '<span class="pot-pill ' + forcaCls + '"><span class="pot-label">força</span><span class="pot-value">' + esc(ai.forca || '—') + '</span></span>' +
                  '<span class="pot-pill ' + scrollCls + '"><span class="pot-label">para scroll</span><span class="pot-value">' + esc(ai.para_scroll || '—') + '</span></span>' +
                  (ai.fortalece_post === false ? '<span class="val-flag flag-bad">⚠ Enfraquece</span>' : '<span class="val-flag flag-good">✓ Fortalece</span>') +
                '</div>' +
                (ai.leitura ? '<div class="val-img-read">' + esc(ai.leitura) + '</div>' : '') +
                (ai.ajuste_sugerido ? '<div class="val-img-fix">🔧 ' + esc(ai.ajuste_sugerido) + '</div>' : '') +
              '</div>' +
            '</div>';
          }).join('') +
        '</div>';
      }

      // Melhor capa
      if (ac.melhor_capa) {
        var mc = ac.melhor_capa;
        var mcThumb = (carouselImgs && carouselImgs[(mc.posicao_atual || 1) - 1]) ? carouselImgs[(mc.posicao_atual || 1) - 1].dataUrl : null;
        html += '<div class="val-cover-suggest">' +
          '<div class="val-cover-h">🏆 Capa recomendada</div>' +
          '<div class="val-cover-row">' +
            (mcThumb ? '<div class="val-cover-thumb"><img src="' + mcThumb + '" alt=""><span class="val-cover-badge">Imagem #' + (mc.posicao_atual || 1) + '</span></div>' : '') +
            '<div class="val-cover-reason">' + esc(mc.razao || '') + '</div>' +
          '</div>' +
        '</div>';
      }

      // Ordem sugerida
      if (ac.ordem_sugerida && ac.ordem_sugerida.length) {
        html += '<div class="val-order-suggest">' +
          '<div class="val-order-h">🔀 Ordem sugerida</div>' +
          '<div class="val-order-sequence">' +
            ac.ordem_sugerida.map(function(pos, i) {
              var t = (carouselImgs && carouselImgs[pos - 1]) ? carouselImgs[pos - 1].dataUrl : null;
              return '<div class="val-order-item">' +
                (t ? '<div class="val-order-thumb"><img src="' + t + '" alt=""></div>' : '<div class="val-order-thumb val-img-thumb-empty"></div>') +
                '<div class="val-order-label">' + (i + 1) + ' · era #' + pos + '</div>' +
              '</div>' +
              (i < ac.ordem_sugerida.length - 1 ? '<div class="val-order-arrow">→</div>' : '');
            }).join('') +
          '</div>' +
          (ac.ordem_sugerida_justificativa ? '<div class="val-order-why">↳ ' + esc(ac.ordem_sugerida_justificativa) + '</div>' : '') +
        '</div>';
      }

      // Remover / Substituir
      if ((ac.imagens_para_remover && ac.imagens_para_remover.length) || (ac.imagens_para_substituir && ac.imagens_para_substituir.length)) {
        html += '<div class="val-cols">';
        if (ac.imagens_para_remover && ac.imagens_para_remover.length) {
          html += '<div class="aud-col aud-col-bad"><div class="aud-col-h">🗑 Remover</div><ul>' +
            ac.imagens_para_remover.map(function(it) { return '<li>#' + it.posicao + ' — ' + esc(it.motivo || '') + '</li>'; }).join('') +
          '</ul></div>';
        }
        if (ac.imagens_para_substituir && ac.imagens_para_substituir.length) {
          html += '<div class="aud-col aud-col-med"><div class="aud-col-h">🔁 Substituir</div><ul>' +
            ac.imagens_para_substituir.map(function(it) {
              return '<li>#' + it.posicao + ' — ' + esc(it.motivo || '') + (it.sugestao_substituicao ? '<br><em>↳ ' + esc(it.sugestao_substituicao) + '</em>' : '') + '</li>';
            }).join('') +
          '</ul></div>';
        }
        html += '</div>';
      }

      // Fortalecem / Enfraquecem (resumo)
      if ((ac.imagens_que_fortalecem && ac.imagens_que_fortalecem.length) || (ac.imagens_que_enfraquecem && ac.imagens_que_enfraquecem.length)) {
        html += '<div class="val-flag-row">' +
          (ac.imagens_que_fortalecem && ac.imagens_que_fortalecem.length ? '<span class="val-flag flag-good">✓ Fortalecem: ' + ac.imagens_que_fortalecem.map(function(p) { return '#' + p; }).join(', ') + '</span>' : '') +
          (ac.imagens_que_enfraquecem && ac.imagens_que_enfraquecem.length ? '<span class="val-flag flag-bad">⚠ Enfraquecem: ' + ac.imagens_que_enfraquecem.map(function(p) { return '#' + p; }).join(', ') + '</span>' : '') +
        '</div>';
      }

      html += '<div class="val-cols">' +
        (ac.pontos_fortes_globais && ac.pontos_fortes_globais.length ?
          '<div class="aud-col aud-col-good"><div class="aud-col-h">✓ Pontos fortes</div><ul>' +
          ac.pontos_fortes_globais.map(function(s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul></div>' : '') +
        (ac.pontos_fracos_globais && ac.pontos_fracos_globais.length ?
          '<div class="aud-col aud-col-bad"><div class="aud-col-h">⚠ Pontos fracos</div><ul>' +
          ac.pontos_fracos_globais.map(function(s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul></div>' : '') +
      '</div>';

      if (ac.ajustes_imediatos && ac.ajustes_imediatos.length) {
        html += '<div class="val-visual-fixes"><div class="t-label">🔧 Ajustes imediatos</div><ul>' +
          ac.ajustes_imediatos.map(function(s) { return '<li>' + esc(s) + '</li>'; }).join('') +
        '</ul></div>';
      }
      html += '</div>';
    }

    // Análise de Reel/Vídeo
    if (r.analise_reel) {
      var ar = r.analise_reel;
      var reelFrames = (generatedAt && r.__inputAssets && r.__inputAssets.kind === 'video')
        ? r.__inputAssets.frames
        : (VALIDATOR_ASSETS.kind === 'video' ? VALIDATOR_ASSETS.video.frames : []);
      html += '<div class="analysis-block val-reel-block">' +
        '<div class="analysis-h">🎬 Análise do Reel · ' + (ar.score_0_10 || 0) + '/10</div>' +
        (ar.leitura_geral ? '<div class="diag-text">' + esc(ar.leitura_geral) + '</div>' : '');

      // Hook
      if (ar.hook_3s) {
        var hk = ar.hook_3s;
        html += '<div class="val-reel-section">' +
          '<div class="val-reel-h">🎣 Hook (primeiros 3s) · ' + (hk.score_0_10 || 0) + '/10</div>' +
          (hk.leitura ? '<div class="diag-text">' + esc(hk.leitura) + '</div>' : '') +
          (hk.ajustes && hk.ajustes.length ? '<ul>' + hk.ajustes.map(function(s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>' : '') +
        '</div>';
      }

      // Retenção + queda
      if (ar.retencao) {
        var ret = ar.retencao;
        var retCls = ret.potencial === 'alto' ? 'pot-high' : ret.potencial === 'medio' ? 'pot-med' : 'pot-low';
        html += '<div class="val-reel-section">' +
          '<div class="val-reel-h">📈 Retenção</div>' +
          '<div class="pot-pill ' + retCls + '" style="display:inline-flex"><span class="pot-label">potencial</span><span class="pot-value">' + esc(ret.potencial || '—') + '</span></div>' +
          (ret.justificativa ? '<div class="diag-text" style="margin-top:8px">' + esc(ret.justificativa) + '</div>' : '') +
          (ret.pontos_queda_previstos && ret.pontos_queda_previstos.length ?
            '<div class="val-retention-drops"><div class="t-label">⚠ Possíveis quedas</div>' +
            ret.pontos_queda_previstos.map(function(d) {
              return '<div class="val-drop-row"><span class="val-drop-t">' + (d.momento_aprox_seg != null ? d.momento_aprox_seg + 's' : '—') + '</span><span class="val-drop-r">' + esc(d.motivo || '') + '</span></div>';
            }).join('') +
            '</div>' : '') +
        '</div>';
      }

      // Grid de leitura técnica
      var techPairs = [
        ['🎵 Ritmo', ar.ritmo],
        ['✂️ Cortes & dinâmica', ar.cortes_dinamica],
        ['🎞️ Enquadramento', ar.enquadramento],
        ['💡 Iluminação', ar.iluminacao],
        ['😊 Expressão', ar.expressao],
        ['⚡ Energia', ar.energia],
        ['💬 Clareza da mensagem', ar.clareza_mensagem],
        ['🎨 Estética geral', ar.estetica_geral],
        ['🧬 Consistência posicionamento', ar.consistencia_posicionamento],
        ['🖋️ Autoralidade', ar.autoralidade],
        ['🎚️ Tom predominante', ar.tom_predominante],
        ['📲 Compartilhamento', ar.potencial_compartilhamento],
        ['🚀 Viralização', ar.potencial_viralizacao],
        ['📣 CTA visual', ar.cta_visual],
        ['🔠 Legendas/texto em tela', ar.legendas_textos_tela],
        ['⏱️ Timing das informações', ar.timing_informacao]
      ].filter(function(p) { return p[1]; });
      if (techPairs.length) {
        html += '<div class="val-reel-tech-grid">' +
          techPairs.map(function(p) {
            return '<div class="val-meta-tile"><div class="val-meta-h">' + p[0] + '</div><div>' + esc(p[1]) + '</div></div>';
          }).join('') +
        '</div>';
      }

      // Momentos fortes
      if (ar.momentos_fortes && ar.momentos_fortes.length) {
        html += '<div class="val-reel-section">' +
          '<div class="val-reel-h">⭐ Momentos mais fortes</div>' +
          '<div class="val-moments">' +
          ar.momentos_fortes.map(function(m) {
            var nearestFrame = nearestFrameByTime(reelFrames, m.tempo_aprox_seg);
            return '<div class="val-moment-card">' +
              (nearestFrame ? '<div class="val-moment-thumb"><img src="' + nearestFrame.dataUrl + '" alt=""><span class="val-moment-t">' + (m.tempo_aprox_seg != null ? m.tempo_aprox_seg + 's' : '—') + '</span></div>' : '<div class="val-moment-thumb val-img-thumb-empty"><span class="val-moment-t">' + (m.tempo_aprox_seg != null ? m.tempo_aprox_seg + 's' : '—') + '</span></div>') +
              '<div class="val-moment-body">' +
                '<div>' + esc(m.razao || '') + '</div>' +
                (m.potencial_corte_curto ? '<div class="val-moment-tag">✂️ Vira corte curto</div>' : '') +
              '</div>' +
            '</div>';
          }).join('') +
          '</div>' +
        '</div>';
      }

      // Trechos que viram cortes
      if (ar.trechos_virariam_cortes && ar.trechos_virariam_cortes.length) {
        html += '<div class="val-reel-section">' +
          '<div class="val-reel-h">✂️ Trechos que virariam cortes</div>' +
          ar.trechos_virariam_cortes.map(function(t) {
            return '<div class="val-cut-row"><span class="val-cut-t">' + (t.tempo_aprox_seg != null ? t.tempo_aprox_seg + 's' : '—') + '</span><span class="val-cut-i">' + esc(t.ideia_corte || '') + '</span></div>';
          }).join('') +
        '</div>';
      }

      // Capa do Reel
      if (ar.thumb_capa_atual || ar.thumb_capa_recomendada || (ar.texto_capa_sugerido && ar.texto_capa_sugerido.length)) {
        html += '<div class="val-reel-section val-reel-cover">' +
          '<div class="val-reel-h">🖼️ Capa do Reel</div>' +
          '<div class="val-reel-cover-grid">';
        var atualFrame = reelFrames && reelFrames[0] ? reelFrames[0] : null;
        if (ar.thumb_capa_atual) {
          html += '<div class="val-cover-tile">' +
            (atualFrame ? '<div class="val-cover-thumb"><img src="' + atualFrame.dataUrl + '" alt=""><span class="val-cover-badge">Atual · ' + atualFrame.tSec.toFixed(1) + 's</span></div>' : '') +
            '<div class="val-cover-reason">' + esc(ar.thumb_capa_atual) + '</div>' +
          '</div>';
        }
        if (ar.thumb_capa_recomendada) {
          var rec = ar.thumb_capa_recomendada;
          var recFrame = nearestFrameByTime(reelFrames, rec.frame_aprox_seg);
          html += '<div class="val-cover-tile val-cover-tile-best">' +
            (recFrame ? '<div class="val-cover-thumb"><img src="' + recFrame.dataUrl + '" alt=""><span class="val-cover-badge val-cover-badge-best">★ Recomendada · ' + (rec.frame_aprox_seg != null ? rec.frame_aprox_seg + 's' : '—') + '</span></div>' : '') +
            '<div class="val-cover-reason">' + esc(rec.razao || '') + '</div>' +
          '</div>';
        }
        html += '</div>';
        if (ar.texto_capa_sugerido && ar.texto_capa_sugerido.length) {
          html += '<div class="val-cover-texts"><div class="t-label">Textos de capa sugeridos</div>' +
            ar.texto_capa_sugerido.map(function(t) {
              return '<div class="val-cover-text-opt"><span>' + esc(t) + '</span><button class="btn btn-ghost btn-sm" onclick="copyText(' + JSON.stringify(t) + ')">📋</button></div>';
            }).join('') +
          '</div>';
        }
        html += '</div>';
      }

      // Comparativo + padrões
      if (ar.comparativo_reels_passados || (ar.padroes_top_reels && ar.padroes_top_reels.length)) {
        html += '<div class="val-reel-section">' +
          '<div class="val-reel-h">📊 vs. Reels que performaram</div>' +
          (ar.comparativo_reels_passados ? '<div class="diag-text">' + esc(ar.comparativo_reels_passados) + '</div>' : '') +
          (ar.padroes_top_reels && ar.padroes_top_reels.length ?
            '<ul>' + ar.padroes_top_reels.map(function(s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>' : '') +
        '</div>';
      }

      // Sugestões + ajustes
      if (ar.sugestoes_melhorias && ar.sugestoes_melhorias.length) {
        html += '<div class="val-reel-section">' +
          '<div class="val-reel-h">💡 Melhorias sugeridas</div>' +
          '<ul>' + ar.sugestoes_melhorias.map(function(s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>' +
        '</div>';
      }
      if (ar.ajustes_imediatos && ar.ajustes_imediatos.length) {
        html += '<div class="val-visual-fixes"><div class="t-label">🔧 Ajustes imediatos</div><ul>' +
          ar.ajustes_imediatos.map(function(s) { return '<li>' + esc(s) + '</li>'; }).join('') +
        '</ul></div>';
      }
      html += '</div>';
    }

    // Análise visual (imagem única — mantém comportamento legado)
    if (r.analise_visual) {
      var av = r.analise_visual;
      html += '<div class="analysis-block val-visual-block">' +
        '<div class="analysis-h">🎨 Análise visual · ' + (av.score_0_10 || 0) + '/10</div>' +
        (av.leitura_geral ? '<div class="diag-text">' + esc(av.leitura_geral) + '</div>' : '') +
        '<div class="val-visual-grid">' +
          (av.design_composicao ? '<div class="val-visual-tile"><div class="val-visual-tile-h">📐 Design & composição</div><div>' + esc(av.design_composicao) + '</div></div>' : '') +
          (av.estetica_branding ? '<div class="val-visual-tile"><div class="val-visual-tile-h">🎨 Estética & branding</div><div>' + esc(av.estetica_branding) + '</div></div>' : '') +
          (av.legibilidade ? '<div class="val-visual-tile"><div class="val-visual-tile-h">🔠 Legibilidade</div><div>' + esc(av.legibilidade) + '</div></div>' : '') +
          (av.expressao_enquadramento ? '<div class="val-visual-tile"><div class="val-visual-tile-h">👁 Expressão & enquadramento</div><div>' + esc(av.expressao_enquadramento) + '</div></div>' : '') +
        '</div>' +
        '<div class="val-cols">' +
          (av.pontos_fortes_visuais && av.pontos_fortes_visuais.length ?
            '<div class="aud-col aud-col-good"><div class="aud-col-h">✓ Pontos fortes visuais</div><ul>' +
            av.pontos_fortes_visuais.map(function(s) { return '<li>' + esc(s) + '</li>'; }).join('') +
            '</ul></div>' : '') +
          (av.pontos_fracos_visuais && av.pontos_fracos_visuais.length ?
            '<div class="aud-col aud-col-bad"><div class="aud-col-h">⚠ Pontos fracos visuais</div><ul>' +
            av.pontos_fracos_visuais.map(function(s) { return '<li>' + esc(s) + '</li>'; }).join('') +
            '</ul></div>' : '') +
        '</div>' +
        (av.ajustes_imediatos && av.ajustes_imediatos.length ?
          '<div class="val-visual-fixes"><div class="t-label">🔧 Ajustes imediatos</div><ul>' +
          av.ajustes_imediatos.map(function(s) { return '<li>' + esc(s) + '</li>'; }).join('') +
          '</ul></div>' : '') +
      '</div>';
    }

    // Problemas
    if (r.problemas_identificados && r.problemas_identificados.length) {
      html += '<div class="analysis-block">' +
        '<div class="analysis-h">🚨 Problemas identificados</div>' +
        r.problemas_identificados.map(function(p) {
          var sevCls = p.gravidade === 'alta' ? 'sev-high' : p.gravidade === 'media' ? 'sev-med' : 'sev-low';
          return '<div class="problem-item ' + sevCls + '">' +
            '<div class="problem-cat">' + esc(p.categoria || '') + '</div>' +
            '<div class="problem-desc">' + esc(p.problema || '') + '</div>' +
          '</div>';
        }).join('') +
      '</div>';
    }

    // Melhorias
    if (r.melhorias_sugeridas && r.melhorias_sugeridas.length) {
      html += '<div class="analysis-block">' +
        '<div class="analysis-h">💡 Melhorias sugeridas</div>' +
        r.melhorias_sugeridas.map(function(m) {
          return '<div class="improve-item">' +
            '<div class="improve-before"><div class="improve-tag">ANTES</div>' + esc(m.antes || '') + '</div>' +
            '<div class="improve-after"><div class="improve-tag">DEPOIS</div>' + esc(m.depois || '') + '</div>' +
            (m.porque ? '<div class="improve-why">↳ ' + esc(m.porque) + '</div>' : '') +
          '</div>';
        }).join('') +
      '</div>';
    }

    // Hook
    if (r.hook_sugerido) {
      var h = r.hook_sugerido;
      html += '<div class="analysis-block">' +
        '<div class="analysis-h">🎣 Hook sugerido</div>' +
        '<div class="hook-opt"><div class="hook-num">1</div><div class="hook-text">' + esc(h.primeira_opcao || '') + '</div><button class="btn btn-ghost btn-sm" onclick="copyText(\'' + esc(h.primeira_opcao || '').replace(/'/g, "\\'") + '\')">📋</button></div>' +
        (h.segunda_opcao ? '<div class="hook-opt"><div class="hook-num">2</div><div class="hook-text">' + esc(h.segunda_opcao) + '</div><button class="btn btn-ghost btn-sm" onclick="copyText(\'' + esc(h.segunda_opcao).replace(/'/g, "\\'") + '\')">📋</button></div>' : '') +
        (h.principio ? '<div class="hook-prin">↳ ' + esc(h.principio) + '</div>' : '') +
      '</div>';
    }

    // CTA
    if (r.cta_sugerido) {
      html += '<div class="analysis-block">' +
        '<div class="analysis-h">💬 CTA sugerido</div>' +
        '<div class="cta-box">' +
          '<div class="cta-text">' + esc(r.cta_sugerido.texto || '') + '</div>' +
          '<button class="btn btn-secondary btn-sm" onclick="copyText(\'' + esc(r.cta_sugerido.texto || '').replace(/'/g, "\\'") + '\')">📋 Copiar</button>' +
        '</div>' +
        (r.cta_sugerido.justificativa ? '<div class="cta-why">↳ ' + esc(r.cta_sugerido.justificativa) + '</div>' : '') +
      '</div>';
    }

    // Legenda
    if (r.legenda_sugerida) {
      html += '<div class="analysis-block">' +
        '<div class="analysis-h">📝 Legenda sugerida</div>' +
        '<pre class="legenda-pre">' + esc(r.legenda_sugerida) + '</pre>' +
        '<button class="btn btn-primary btn-sm" onclick="copyText(' + JSON.stringify(r.legenda_sugerida) + ')">📋 Copiar legenda</button>' +
      '</div>';
    }

    // Capa
    if (r.titulo_capa) {
      html += '<div class="analysis-block">' +
        '<div class="analysis-h">🖼️ Título da capa</div>' +
        '<div class="capa-preview">' +
          '<div class="capa-title">' + esc(r.titulo_capa.texto || '') + '</div>' +
          (r.titulo_capa.fonte_recomendada ? '<div class="capa-font">Fonte: ' + esc(r.titulo_capa.fonte_recomendada) + '</div>' : '') +
        '</div>' +
      '</div>';
    }

    // Melhorias visuais
    if (r.melhorias_visuais && r.melhorias_visuais.length) {
      html += '<div class="analysis-block">' +
        '<div class="analysis-h">🎨 Diretrizes visuais</div>' +
        r.melhorias_visuais.map(function(v) {
          return '<div class="visual-guide"><strong>' + esc(v.elemento || '') + ':</strong> ' + esc(v.diretriz || '') + '</div>';
        }).join('') +
      '</div>';
    }

    // Potencial
    if (r.potencial_performance) {
      var pp = r.potencial_performance;
      html += '<div class="analysis-block">' +
        '<div class="analysis-h">📈 Potencial previsto</div>' +
        '<div class="potential-grid">' +
          renderPotentialPill('Alcance', pp.alcance) +
          renderPotentialPill('Engajamento', pp.engajamento) +
          renderPotentialPill('Conversão', pp.conversao) +
          renderPotentialPill('Salvamento', pp.salvamento) +
        '</div>' +
        (pp.justificativa ? '<div class="diag-text" style="margin-top:10px">' + esc(pp.justificativa) + '</div>' : '') +
      '</div>';
    }

    // vs Feed
    if (r.vs_feed_recente) {
      var vf = r.vs_feed_recente;
      html += '<div class="analysis-block">' +
        '<div class="analysis-h">🔁 Versus feed recente</div>' +
        '<div class="vsfeed-row">' +
          '<div class="vsfeed-status ' + (vf.repetitivo ? 'vsfeed-rep' : 'vsfeed-fresh') + '">' +
            (vf.repetitivo ? '⚠ Repetitivo' : '✓ Não repetitivo') +
          '</div>' +
        '</div>' +
        (vf.diversidade ? '<div class="diag-text">' + esc(vf.diversidade) + '</div>' : '') +
        (vf.posts_relacionados && vf.posts_relacionados.length ?
          '<div class="vsfeed-related">Conecta com: ' + vf.posts_relacionados.map(function(p) { return '<span class="ev-tag">' + esc(p) + '</span>'; }).join('') + '</div>' : '') +
        (vf.proximo_passo_sugerido ? '<div class="vsfeed-next"><div class="t-label">Próximo passo sugerido</div>' + esc(vf.proximo_passo_sugerido) + '</div>' : '') +
      '</div>';
    }

    el.innerHTML = html;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function nearestFrameByTime(frames, tSec) {
    if (!frames || !frames.length || tSec == null) return null;
    var best = frames[0], bestDiff = Math.abs((best.tSec || 0) - tSec);
    for (var i = 1; i < frames.length; i++) {
      var d = Math.abs((frames[i].tSec || 0) - tSec);
      if (d < bestDiff) { best = frames[i]; bestDiff = d; }
    }
    return best;
  }

  function renderPotentialPill(label, value) {
    var cls = value === 'alto' ? 'pot-high' : value === 'medio' ? 'pot-med' : 'pot-low';
    var icon = value === 'alto' ? '↑' : value === 'medio' ? '→' : '↓';
    return '<div class="pot-pill ' + cls + '">' +
      '<div class="pot-label">' + esc(label) + '</div>' +
      '<div class="pot-value">' + icon + ' ' + esc(value || '—') + '</div>' +
    '</div>';
  }

  window.copyText = function(t) {
    navigator.clipboard.writeText(t).then(function() { toast('Copiado'); });
  };

  // ── BOOT ──────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAuth);
  } else {
    checkAuth();
  }

})();
