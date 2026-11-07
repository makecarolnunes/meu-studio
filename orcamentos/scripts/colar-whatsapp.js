// ══════════════════════════════════════════════════════════
//  COLAR DO WHATSAPP — conversa (texto ou print) → orçamento
//
//  A IA (Claude Haiku, structured outputs) lê a conversa e devolve os pedidos
//  em JSON. Cada pedido lido vira um card com três saídas:
//    Salvar     → grava como 'Novo Pedido'
//    A revisar  → grava como STATUS_REVISAR (lembrete no app, no sino e no
//                 atalho do iPhone até a Carol conferir)
//    Editar     → abre o "Novo orçamento" já preenchido
//
//  Atalho do iPhone (orcamentos/atalho-iphone.html) abre esta página com
//  ?colar=<texto>&acao=revisar  → lê e já grava tudo como A revisar
//  ?colar=<texto>&acao=conferir → lê e mostra os cards
//
//  Depende de orcamentos.js (carregado antes): services, entries, END_STUDIO,
//  STATUS_REVISAR, expandRows, descreveSlots, packSlots, postEntry…
// ══════════════════════════════════════════════════════════

const COLAR_MODEL   = 'claude-haiku-5-5';
const COLAR_ORIGENS = ['Produção Social', 'Noiva', 'Assistência', 'Curso de Automaquiagem'];
const COLAR_LS_ULT  = 'orca_colar_ultimo';   // evita gravar duas vezes o mesmo texto

let colarImgs     = [];     // prints anexados: [{ b64, tipo, nome }]
let colarPedidos  = [];     // pedidos lidos; p._salvo = status gravado
let colarEditIdx  = null;   // pedido aberto no "Novo orçamento" via Editar
let colarLendo    = false;

// ── Abrir / fechar ─────────────────────────────────────────
function openColar() {
  closePanel('panel-add');
  renderColar();
  openPanel('panel-colar');
}

function colarNovaLeitura() {
  colarPedidos = [];
  colarImgs = [];
  const txt = document.getElementById('colar-txt');
  if (txt) txt.value = '';
  renderColar();
  if (txt) txt.focus();
}

// ── Entrada: texto e prints ────────────────────────────────
async function colarDaAreaTransferencia() {
  const txt = document.getElementById('colar-txt');
  try {
    const t = await navigator.clipboard.readText();
    if (!t) { toast('A área de transferência está vazia'); return; }
    txt.value = txt.value.trim() ? txt.value.trim() + '\n\n' + t : t;
  } catch (_) {
    toast('Toque e segure na caixa e escolha Colar');
    txt.focus();
  }
}

async function colarAnexarPrints(input) {
  const files = Array.from(input.files || []);
  input.value = '';
  for (const f of files) {
    try {
      const b64 = await fileToBase64(f);
      const red = await resizeImageBase64(b64, f.type);
      // resizeImageBase64 devolve JPEG; se a imagem não abriu, volta o original
      colarImgs.push({ b64: red, tipo: red === b64 ? (f.type || 'image/jpeg') : 'image/jpeg', nome: f.name });
    } catch (_) {
      toast('Não consegui abrir ' + (f.name || 'a imagem'));
    }
  }
  renderColarPrints();
}

function colarRemoverPrint(i) {
  colarImgs.splice(i, 1);
  renderColarPrints();
}

function renderColarPrints() {
  const box = document.getElementById('colar-prints');
  if (!box) return;
  box.innerHTML = colarImgs.map((im, i) =>
    '<span class="colar-print">' +
      '<img src="data:' + im.tipo + ';base64,' + im.b64 + '" alt="">' +
      '<button onclick="colarRemoverPrint(' + i + ')" aria-label="Remover print">×</button>' +
    '</span>'
  ).join('');
}

// ── IA ─────────────────────────────────────────────────────
// A chave fica salva no Supabase (configuracoes.claude_api_key) — o mesmo
// lugar que o Financeiro usa; o localStorage é só cache.
async function getClaudeKey() {
  let k = localStorage.getItem('mk_claude_key') || '';
  if (!k && window.DB && DB.config) {
    try { k = (await DB.config.get('claude_api_key')) || ''; } catch (_) {}
    if (k) localStorage.setItem('mk_claude_key', k);
  }
  return k;
}

function colarSchema() {
  const nomes = [...new Set(services.map(s => s.nome).filter(Boolean))];
  const str = { type: 'string' };
  return {
    type: 'object', additionalProperties: false, required: ['pedidos'],
    properties: {
      pedidos: {
        type: 'array',
        items: {
          type: 'object', additionalProperties: false,
          required: ['cliente', 'telefone', 'servicos', 'local', 'endereco', 'cacheada',
                     'origem', 'observacoes', 'duvidas', 'mensagem_original'],
          properties: {
            cliente:  str,
            telefone: str,
            servicos: {
              type: 'array',
              items: {
                type: 'object', additionalProperties: false,
                required: ['servico', 'qtd', 'data', 'horario'],
                properties: {
                  servico: { type: 'string', enum: nomes.concat('') },
                  qtd:     { type: 'integer' },
                  data:    str,
                  horario: str,
                },
              },
            },
            local:    { type: 'string', enum: ['studio', 'domicilio', ''] },
            endereco: str,
            cacheada: { type: 'boolean' },
            origem:   { type: 'string', enum: COLAR_ORIGENS },
            observacoes:       str,
            duvidas:           str,
            mensagem_original: str,
          },
        },
      },
    },
  };
}

function colarSystemPrompt() {
  const hoje = todayStr();
  const [y, m, d] = hoje.split('-').map(Number);
  const diaSemana = DIAS[new Date(y, m - 1, d).getDay()];
  const catalogo = services.filter(s => s.nome)
    .map(s => '- ' + s.nome + ' (' + fmtDur(s.duracao || defaultDuracao(s.nome, false)) + ')').join('\n');

  return `Você organiza pedidos de orçamento que a Carol, maquiadora no Rio de Janeiro, recebe pelo WhatsApp. Leia a conversa (texto colado ou prints) e devolva cada pedido no formato pedido.

Hoje é ${diaSemana}, ${fmtDate(hoje)}.

Catálogo de serviços (use o nome exatamente como está aqui):
${catalogo}

Como preencher:
- Um pedido por cliente e evento. Se várias conversas vierem coladas juntas, separe. Se não houver nenhum pedido de serviço, devolva pedidos vazio.
- A Carol é a maquiadora: as mensagens dela não são de cliente, mas podem trazer dados do pedido (valor combinado, data confirmada).
- cliente: nome de quem pede (do cabeçalho "[10:32, 03/11/2026] Nome:" ou do texto). Sem nome, use "".
- telefone: só se aparecer na conversa, no formato "21 99999-9999". Senão, "".
- servicos: uma linha por serviço e data. "make" é maquiagem; penteado, escova e cabelo são cabelo. Maquiagem e cabelo para a mesma pessoa é o serviço combinado. qtd é o número de pessoas que fazem aquele serviço ("eu, minha mãe e minha irmã" = 3). Escolha a variante do catálogo pelo local: casa, hotel, salão de festa ou endereço da cliente é domicílio; ir até a Carol é Studio. Sem pista de local, use a variante Studio e anote em duvidas. Serviço fora do catálogo: servico "" e descreva em observacoes.
- data: AAAA-MM-DD. Resolva datas relativas a partir de hoje; sem ano, use a próxima ocorrência. Sem data, "".
- horario: HH:MM (24h), só se a cliente disser o horário de início. "Preciso estar pronta às 17h" vai em observacoes, com horario "".
- local: studio, domicilio ou "" se não der para saber. endereco: só o que a cliente informou.
- cacheada: true se falar de cabelo cacheado, crespo ou cachos.
- origem: Noiva quando a cliente for a noiva; Curso de Automaquiagem para curso ou aula; Assistência se for chamada para assistir outra maquiadora; senão Produção Social.
- observacoes: o que ajuda a orçar e não coube nos campos (tipo de evento, pronta às, referências, pedido de desconto). Curto.
- duvidas: o que faltou ou ficou ambíguo, curto. "" se nada.
- mensagem_original: o trecho da conversa sobre este pedido, copiado como está (até uns 800 caracteres).
Não invente dados: o que não estiver na conversa fica vazio.`;
}

async function lerPedidosIA(texto, imgs) {
  const key = await getClaudeKey();
  if (!key) throw new Error('A chave da IA não está configurada (⚙️ no Financeiro › Claude IA).');

  const content = imgs.map(im => ({ type: 'image', source: { type: 'base64', media_type: im.tipo, data: im.b64 } }));
  content.push({ type: 'text', text: texto ? 'Conversa do WhatsApp:\n\n' + texto : 'A conversa está nos prints acima.' });

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: COLAR_MODEL,
      max_tokens: 16000,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: colarSchema() } },
      system: colarSystemPrompt(),
      messages: [{ role: 'user', content }],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error((err && err.error && err.error.message) || res.statusText);
  }
  const data = await res.json();
  if (data.stop_reason === 'refusal')    throw new Error('A IA não conseguiu ler esta conversa.');
  if (data.stop_reason === 'max_tokens') throw new Error('Conversa longa demais — cole menos pedidos por vez.');
  const txt = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  const out = JSON.parse(txt);
  return Array.isArray(out.pedidos) ? out.pedidos : [];
}

// ── Pedido lido → linhas / orçamento ───────────────────────
function colarData(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s || '') && slotDateYearValid(s) ? s : '';
}
function colarHora(s) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s || '') ? s : '';
}

// Mesmo formato das linhas do "Novo orçamento" (addSlots)
function pedidoRows(p) {
  const cacheada = !!p.cacheada;
  return (p.servicos || []).filter(s => s && s.servico).map(s => {
    const svc = services.find(x => x.nome === s.servico) || {};
    return {
      id: Date.now() + Math.random(),
      servico: s.servico,
      valorUnit: svc.valor || 0,
      data: colarData(s.data),
      horario: colarHora(s.horario),
      qtd: Math.max(1, parseInt(s.qtd) || 1),
      duracao: defaultDuracao(s.servico, cacheada),
      _cacheada: cacheada,
    };
  });
}

function pedidoLocal(p, rows) {
  if (p.local === 'studio' || p.local === 'domicilio') return p.local;
  for (const r of rows) { const l = localDoServico(r.servico); if (l) return l; }
  return '';
}

// Observações gravadas: o que a IA anotou + o que ficou em dúvida + o trecho
// original da conversa (para conferir sem voltar ao WhatsApp)
function pedidoObs(p) {
  return [
    (p.observacoes || '').trim(),
    p.duvidas ? 'A conferir: ' + p.duvidas.trim() : '',
    p.mensagem_original ? '— Mensagem do WhatsApp —\n' + p.mensagem_original.trim() : '',
  ].filter(Boolean).join('\n\n');
}

function colarNovoId() {
  let id = Date.now();
  while (entries.some(e => String(e.ID) === String(id))) id++;
  return String(id);
}

function pedidoParaEntry(p, status) {
  const rows  = pedidoRows(p);
  const total = rows.reduce((s, x) => s + (parseFloat(x.valorUnit) || 0) * slotQtd(x), 0);
  const datas = rows.map(r => r.data).filter(Boolean).sort();
  const local = pedidoLocal(p, rows);
  return {
    ID:             colarNovoId(),
    DataPedido:     todayStr(),
    Cliente:        (p.cliente || '').trim() || 'Cliente do WhatsApp',
    Telefone:       (p.telefone || '').trim(),
    Servico:        descreveSlots(rows),
    ValorProp:      total,
    Status:         status,
    DataEnvio:      '',
    DataFechamento: '',
    ValorFechado:   '',
    Obs:            packSlots(pedidoObs(p), expandRows(rows)),
    Origem:         COLAR_ORIGENS.includes(p.origem) ? p.origem : 'Produção Social',
    Equipe:         '',
    Responsavel:    '',
    Repasse:        '',
    Cacheada:       !!p.cacheada,
    DataEvento:     datas[0] || '',
    DataCriacao:    todayStr(),
    LocalTipo:      local,
    EnderecoEvento: local === 'studio' ? END_STUDIO : (p.endereco || '').trim(),
  };
}

// Grava no app na hora e sincroniza com o Supabase em seguida
async function gravarPedidos(lista, status) {
  const novos = lista.map(p => {
    const e = pedidoParaEntry(p, status);
    entries.unshift(e);
    p._salvo = status;
    return e;
  });
  cacheEntries();
  render();
  let falhas = 0;
  for (const e of novos) {
    const r = await postEntry({ action: 'save', entry: e });
    if (!r.ok && r.error !== 'no-url') falhas++;
  }
  if (falhas) toast('Salvo no aparelho, mas ' + falhas + ' não sincronizou — toque em Atualizar');
  return novos;
}

// ── Ler ────────────────────────────────────────────────────
// opts.autoRevisar = true → grava tudo como A revisar sem esperar a Carol
async function colarLer(opts) {
  const autoRevisar = !!(opts && opts.autoRevisar);
  const texto = (document.getElementById('colar-txt').value || '').trim();
  if (!texto && !colarImgs.length) { toast('Cole a conversa ou anexe um print'); return; }
  if (colarLendo) return;

  colarLendo = true;
  const btn = document.getElementById('colar-ler-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Lendo a conversa...'; }
  try {
    const pedidos = await lerPedidosIA(texto, colarImgs);
    if (!pedidos.length) {
      colarPedidos = [];
      renderColar('Não encontrei pedido de serviço nessa conversa.', texto);
      return;
    }
    colarPedidos = pedidos;
    if (autoRevisar) {
      await gravarPedidos(colarPedidos, STATUS_REVISAR);
      toast(pedidos.length === 1 ? 'Pedido salvo para revisar' : pedidos.length + ' pedidos salvos para revisar');
    }
    colarImgs = [];
    document.getElementById('colar-txt').value = '';
    renderColar();
  } catch (err) {
    console.warn('colarLer:', err);
    renderColar('Não consegui ler: ' + (err.message || err), texto);
  } finally {
    colarLendo = false;
    if (btn) { btn.disabled = false; btn.textContent = 'Ler pedido'; }
  }
}

// Sem IA (erro, sem internet): guarda o texto cru como A revisar, para não
// perder o pedido. A Carol completa os campos depois.
async function colarGuardarTexto() {
  const texto = (document.getElementById('colar-txt').value || '').trim();
  if (!texto) return;
  await gravarPedidos([{ observacoes: '', mensagem_original: texto }], STATUS_REVISAR);
  document.getElementById('colar-txt').value = '';
  colarPedidos = [];
  renderColar();
  toast('Texto guardado em A revisar');
}

// ── Ações dos cards ────────────────────────────────────────
async function colarSalvarUm(i, status) {
  const p = colarPedidos[i];
  if (!p || p._salvo) return;
  if (status !== STATUS_REVISAR && !pedidoRows(p).length) {
    toast('Falta o serviço — use Editar ou A revisar'); return;
  }
  await gravarPedidos([p], status);
  renderColar();
  toast(status === STATUS_REVISAR ? 'Salvo para revisar' : 'Orçamento salvo!');
}

// "Salvar todos": quem não tem serviço identificado vai para A revisar
async function colarSalvarTodos(status) {
  const pend = colarPedidos.filter(p => !p._salvo);
  if (!pend.length) return;
  if (status === STATUS_REVISAR) {
    await gravarPedidos(pend, STATUS_REVISAR);
    toast(pend.length + ' pedidos salvos para revisar');
  } else {
    const ok  = pend.filter(p => pedidoRows(p).length);
    const rev = pend.filter(p => !pedidoRows(p).length);
    if (ok.length)  await gravarPedidos(ok, 'Novo Pedido');
    if (rev.length) await gravarPedidos(rev, STATUS_REVISAR);
    toast(ok.length + (ok.length === 1 ? ' salvo' : ' salvos') +
          (rev.length ? ' · ' + rev.length + ' foi para A revisar (faltou o serviço)' : ''));
  }
  renderColar();
}

// Abre o "Novo orçamento" com os dados lidos, para ajustar antes de salvar
function colarEditar(i) {
  const p = colarPedidos[i];
  if (!p) return;
  closePanel('panel-colar');
  openAddForm();                       // zera o formulário (e colarEditIdx)
  colarEditIdx = i;

  document.getElementById('add-nome').value = (p.cliente || '').trim();
  document.getElementById('add-tel').value  = (p.telefone || '').trim();
  document.getElementById('add-obs').value  = pedidoObs(p);
  const orig = document.getElementById('add-origem');
  if (orig && COLAR_ORIGENS.includes(p.origem)) orig.value = p.origem;
  const cach = document.getElementById('add-cacheada');
  if (cach) cach.checked = !!p.cacheada;

  const rows = pedidoRows(p);
  if (rows.length) {
    addSlots = rows;
    renderAddSlots();
    recalcAddTotal();
  } else {
    applyCacheada(addSlots, !!p.cacheada, renderAddSlots);
  }

  // Local e endereço que a cliente informou na conversa
  const local = pedidoLocal(p, rows);
  resetEndereco('add', local === 'domicilio' ? (p.endereco || '').trim() : '');
  addLocalManual = !!local;
  syncAddLocalUI(local || 'studio');
}

// Ganchos chamados por orcamentos.js
function onColarNovoForm() { colarEditIdx = null; }
function onColarPedidoSalvo(fecharAgora) {
  if (colarEditIdx === null) return;
  const p = colarPedidos[colarEditIdx];
  if (p) p._salvo = 'Novo Pedido';
  colarEditIdx = null;
  // Ainda há pedidos lidos esperando: volta para a lista deles
  if (!fecharAgora && colarPedidos.some(x => !x._salvo)) {
    renderColar();
    openPanel('panel-colar');
  }
}

// ── Render ─────────────────────────────────────────────────
function colarLinhaHTML(r) {
  const partes = [];
  if (r.data) partes.push(fmtDateEvento(r.data));
  else partes.push('sem data');
  partes.push((r.qtd > 1 ? r.qtd + '× ' : '') + r.servico);
  if (r.horario) partes.push(fmtHorario(r.horario));
  return '<div class="colar-linha">' + esc(partes.join(' · ')) + '</div>';
}

function colarCardHTML(p, i) {
  const rows  = pedidoRows(p);
  const total = rows.reduce((s, x) => s + (parseFloat(x.valorUnit) || 0) * slotQtd(x), 0);
  const local = pedidoLocal(p, rows);
  const tags  = [];
  if (local === 'domicilio') tags.push('Domicílio');
  if (local === 'studio')    tags.push('Studio');
  if (p.cacheada)            tags.push('Cacheada');
  if (p.origem && p.origem !== 'Produção Social') tags.push(p.origem);

  let acoes;
  if (p._salvo) {
    acoes = '<div class="colar-salvo">' + (p._salvo === STATUS_REVISAR ? 'Salvo em A revisar' : 'Salvo') + '</div>';
  } else {
    acoes =
      '<div class="colar-card-btns">' +
        '<button class="colar-b colar-b-ok" onclick="colarSalvarUm(' + i + ', \'Novo Pedido\')"' + (rows.length ? '' : ' disabled') + '>Salvar</button>' +
        '<button class="colar-b colar-b-rev" onclick="colarSalvarUm(' + i + ', STATUS_REVISAR)">A revisar</button>' +
        '<button class="colar-b" onclick="colarEditar(' + i + ')">Editar</button>' +
      '</div>';
  }

  return '<div class="colar-card' + (p._salvo ? ' is-salvo' : '') + '">' +
    '<div class="colar-card-top">' +
      '<span class="colar-nome">' + esc((p.cliente || '').trim() || 'Sem nome') + '</span>' +
      '<span class="colar-tel">' + esc((p.telefone || '').trim() || 'sem telefone') + '</span>' +
    '</div>' +
    (rows.length ? rows.map(colarLinhaHTML).join('') : '<div class="colar-duvida">Serviço não identificado</div>') +
    (tags.length ? '<div class="colar-tags">' + tags.map(t => '<span>' + esc(t) + '</span>').join('') + '</div>' : '') +
    (total ? '<div class="colar-total">' + fmtVal(total) + '</div>' : '') +
    (p.duvidas ? '<div class="colar-duvida">A conferir: ' + esc(p.duvidas) + '</div>' : '') +
    acoes +
  '</div>';
}

// erro + textoOriginal → mostra o erro e devolve o texto à caixa (com a opção
// de guardá-lo cru em A revisar)
function renderColar(erro, textoOriginal) {
  renderColarPrints();
  const entrada = document.getElementById('colar-entrada');
  const box = document.getElementById('colar-resultado');
  if (!box || !entrada) return;

  if (erro) {
    if (textoOriginal) document.getElementById('colar-txt').value = textoOriginal;
    entrada.style.display = '';
    box.innerHTML = '<div class="colar-erro">' + esc(erro) + '</div>' +
      (textoOriginal ? '<button class="btn-outline" onclick="colarGuardarTexto()">Guardar só o texto em A revisar</button>' : '');
    return;
  }

  if (!colarPedidos.length) {
    entrada.style.display = '';
    box.innerHTML = '';
    return;
  }

  // Com pedidos lidos, a caixa de colar some até "Ler outra conversa"
  entrada.style.display = 'none';
  const pend = colarPedidos.filter(p => !p._salvo).length;
  box.innerHTML =
    '<div class="colar-res-hdr">' +
      (colarPedidos.length === 1 ? '1 pedido encontrado' : colarPedidos.length + ' pedidos encontrados') +
    '</div>' +
    colarPedidos.map(colarCardHTML).join('') +
    (pend > 1
      ? '<button class="btn-primary" onclick="colarSalvarTodos(\'Novo Pedido\')">Salvar todos</button>' +
        '<button class="btn-outline colar-todos-rev" onclick="colarSalvarTodos(STATUS_REVISAR)">Todos para A revisar</button>'
      : '') +
    '<button class="btn-outline" onclick="colarNovaLeitura()">Ler outra conversa</button>';
}

// ── Deep link do atalho do iPhone ──────────────────────────
function colarHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return String(h);
}

async function colarFromUrl() {
  const q = new URLSearchParams(location.search);
  const texto = (q.get('colar') || '').trim();
  if (!texto) return;
  const acao = q.get('acao') === 'revisar' ? 'revisar' : 'conferir';
  // Limpa a URL antes de tudo: um refresh não pode gravar o pedido de novo
  history.replaceState(null, '', location.pathname);

  // O mesmo texto compartilhado duas vezes em poucos minutos não duplica
  const h = colarHash(texto);
  const ult = safeJSON(localStorage.getItem(COLAR_LS_ULT), null);
  if (acao === 'revisar' && ult && ult.h === h && Date.now() - ult.t < 10 * 60 * 1000) {
    setF('revisar');
    toast('Esse pedido já foi salvo para revisar');
    return;
  }

  colarPedidos = [];
  colarImgs = [];
  openColar();
  document.getElementById('colar-txt').value = texto;
  await colarLer({ autoRevisar: acao === 'revisar' });
  if (acao === 'revisar' && colarPedidos.length && colarPedidos.every(p => p._salvo)) {
    localStorage.setItem(COLAR_LS_ULT, JSON.stringify({ h, t: Date.now() }));
  }
}
