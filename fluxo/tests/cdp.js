// ════════════════════════════════════════════════════════════
// fluxo/tests/cdp.js — servidor local + Chrome headless (DevTools
// Protocol) para testar o /fluxo/ num navegador de verdade, com o
// banco FALSO (fake-db.js) no lugar do Supabase. Nada vai para a rede.
// ════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), http = require('http'), os = require('os');
const { spawn } = require('child_process');

const RAIZ = path.join(__dirname, '..', '..');
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.json': 'application/json', '.woff2': 'font/woff2' };

// Página do fluxo com o Supabase trocado pelo banco falso + sessão de admin
// real=true: Supabase de verdade, mas o navegador BLOQUEIA toda escrita (só GET passa)
function paginaFluxo(real) {
  let h = fs.readFileSync(path.join(RAIZ, 'fluxo', 'index.html'), 'utf8');
  if (real) return h.replace('<script src="https://cdn.jsdelivr', `<script>localStorage.setItem('mk_session', JSON.stringify({ expires: Date.now() + 36e5, usuario: 'teste', nivel: 'admin' }));</script>
<script src="https://cdn.jsdelivr`);
  const semente = `<script>
    localStorage.clear();
    localStorage.setItem('mk_session', JSON.stringify({ expires: Date.now() + 36e5, usuario: 'teste', nivel: 'admin' }));
  </script><script src="/fluxo/tests/fake-db.js"></script>`;
  h = h.replace(/<script src="https:\/\/cdn\.jsdelivr[^"]*"><\/script>\s*/, '')
       .replace(/<script src="\.\.\/config\.js[^"]*"><\/script>\s*/, '')
       .replace(/<script src="\.\.\/shared\/js\/db\.js[^"]*"><\/script>/, semente);
  if (!h.includes('fake-db.js')) throw new Error('index.html: não achei as tags do Supabase para trocar');
  return h;
}

function servidor(real) {
  return new Promise(res => {
    const srv = http.createServer((req, resp) => {
      const url = decodeURIComponent(req.url.split('?')[0]);
      if (url === '/fluxo/' || url === '/fluxo/index.html') {
        resp.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return resp.end(paginaFluxo(real));
      }
      const arq = path.join(RAIZ, url);
      if (!arq.startsWith(RAIZ) || !fs.existsSync(arq) || fs.statSync(arq).isDirectory()) { resp.writeHead(404); return resp.end(); }
      resp.writeHead(200, { 'Content-Type': (TIPOS[path.extname(arq)] || 'application/octet-stream') + '; charset=utf-8' });
      fs.createReadStream(arq).pipe(resp);
    });
    srv.listen(0, '127.0.0.1', () => res(srv));
  });
}

function acharChrome() {
  const c = [process.env.CHROME, 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean);
  const a = c.find(p => fs.existsSync(p));
  if (!a) throw new Error('Chrome/Edge não encontrado (defina CHROME=caminho)');
  return a;
}

async function abrir(opc) {
  const real = !!(opc && opc.real);
  const srv = await servidor(real);
  const perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'fluxo-cdp-'));
  const chrome = spawn(acharChrome(), ['--headless=new', '--remote-debugging-port=0', '--user-data-dir=' + perfil,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions', 'about:blank'], { stdio: 'ignore' });
  const portaArq = path.join(perfil, 'DevToolsActivePort');
  for (let i = 0; i < 100 && !fs.existsSync(portaArq); i++) await espera(100);
  const porta = fs.readFileSync(portaArq, 'utf8').split('\n')[0];
  let alvo;
  for (let i = 0; i < 50 && !alvo; i++) {
    try { alvo = (await (await fetch(`http://127.0.0.1:${porta}/json/list`)).json()).find(t => t.type === 'page'); } catch (_) {}
    if (!alvo) await espera(100);
  }
  const ws = new WebSocket(alvo.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let seq = 0; const pend = {}; const ouvintes = [];
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pend[m.id]) { const p = pend[m.id]; delete pend[m.id]; m.error ? p.j(new Error(m.error.message)) : p.r(m.result); }
    else if (m.method) ouvintes.forEach(f => f(m));
  };
  const send = (method, params) => new Promise((r, j) => { const id = ++seq; pend[id] = { r, j }; ws.send(JSON.stringify({ id, method, params: params || {} })); });
  const erros = [];
  ouvintes.push(m => {
    if (m.method === 'Runtime.exceptionThrown') erros.push(m.params.exceptionDetails.exception ? m.params.exceptionDetails.exception.description : m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') erros.push(m.params.args.map(a => a.value || a.description).join(' '));
  });
  await send('Runtime.enable'); await send('Page.enable');
  const bloqueadas = [];
  if (real) {
    ouvintes.push(m => {
      if (m.method !== 'Fetch.requestPaused') return;
      const q = m.params.request;
      if (['GET', 'HEAD', 'OPTIONS'].includes(q.method)) send('Fetch.continueRequest', { requestId: m.params.requestId });
      else { bloqueadas.push(q.method + ' ' + q.url.split('?')[0]); send('Fetch.failRequest', { requestId: m.params.requestId, errorReason: 'BlockedByClient' }); }
    });
    await send('Fetch.enable', { patterns: [{ urlPattern: '*supabase.co*' }] });
  }
  const base = `http://127.0.0.1:${srv.address().port}`;

  const api = {
    erros, send, bloqueadas,
    async ir(url) {
      const carregou = new Promise(r => { const f = m => { if (m.method === 'Page.loadEventFired') { ouvintes.splice(ouvintes.indexOf(f), 1); r(); } }; ouvintes.push(f); });
      await send('Page.navigate', { url: base + url }); await carregou;
    },
    async tela(largura, altura, celular) {
      await send('Emulation.setDeviceMetricsOverride', { width: largura, height: altura, deviceScaleFactor: celular ? 2 : 1, mobile: !!celular });
      await send('Emulation.setTouchEmulationEnabled', celular ? { enabled: true, maxTouchPoints: 5 } : { enabled: false });
    },
    async js(expr) {
      const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text);
      return r.result.value;
    },
    // Clique REAL na coordenada do elemento (pega sobreposição/elemento escondido).
    // Retorna { ok, motivo }.
    async clicar(seletor, celular) {
      const info = await api.js(`(() => { const el = document.querySelector(${JSON.stringify(seletor)});
        if (!el) return { ok: false, motivo: 'não existe' };
        el.scrollIntoView({ block: 'center' });
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) return { ok: false, motivo: 'invisível (sem tamanho)' };
        const x = r.left + r.width / 2, y = r.top + r.height / 2;
        const topo = document.elementFromPoint(x, y);
        if (!topo || !(topo === el || el.contains(topo))) return { ok: false, motivo: 'coberto por ' + (topo ? topo.tagName + '#' + topo.id + '.' + topo.className : 'nada'), x, y };
        return { ok: true, x, y }; })()`);
      if (!info.ok) return info;
      if (celular) {
        await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: info.x, y: info.y }] });
        await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ x: info.x, y: info.y }] });
      } else {
        for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased'])
          await send('Input.dispatchMouseEvent', { type, x: info.x, y: info.y, button: 'left', clickCount: 1 });
      }
      await espera(60);
      return info;
    },
    async foto(arquivo, inteira) {
      const p = { format: 'png' };
      if (inteira) {
        const m = await send('Page.getLayoutMetrics');
        p.captureBeyondViewport = true;
        p.clip = { x: 0, y: 0, width: m.cssContentSize.width, height: Math.min(m.cssContentSize.height, 6000), scale: 1 };
      }
      const r = await send('Page.captureScreenshot', p);
      fs.writeFileSync(arquivo, Buffer.from(r.data, 'base64'));
    },
    async fechar() {
      try { ws.close(); } catch (_) {}
      chrome.kill(); srv.close();
      await espera(300);
      try { fs.rmSync(perfil, { recursive: true, force: true }); } catch (_) {}
    },
  };
  return api;
}
const espera = ms => new Promise(r => setTimeout(r, ms));

module.exports = { abrir, espera };
