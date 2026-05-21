// ══════════════════════════════════════════════════════════
//  CONFIGURAÇÃO
// ══════════════════════════════════════════════════════════
const DEFAULT_CAL_ID = 'c82d7e89c34b742daed656c5aa3113d25cb3feda4e8f159936750f2e17473b38@group.calendar.google.com';
const END_STUDIO     = 'Rua Barão de Itapagipe, 445, apt 702 bloco A, Tijuca';

const CAL_ID = () => localStorage.getItem('orca_cal_id') || DEFAULT_CAL_ID;


const DEFAULT_SERVICES = [
  { nome: 'Maquiagem em domicílio',           valor: 350,  duracao: 60  },
  { nome: 'Maquiagem no Studio',              valor: 0,    duracao: 60  },
  { nome: 'Cabelo em domicílio',              valor: 250,  duracao: 60  },
  { nome: 'Cabelo no Studio',                 valor: 0,    duracao: 60  },
  { nome: 'Maquiagem e Cabelo em domicílio',  valor: 0,    duracao: 120 },
  { nome: 'Maquiagem e Cabelo no Studio',     valor: 0,    duracao: 120 },
  { nome: 'Noiva',                            valor: 1500, duracao: 180 },
];

function pickIcon(s) {
  if (!s) return '🌸';
  const low = s.toLowerCase();
  if (low.includes('noiva'))                                       return '👰';
  if (low.includes('curso') || low.includes('automaq'))            return '📚';
  if (low.includes('maquiagem') && low.includes('cabelo'))         return '✨';
  if (low.includes('penteado') || low.includes('cabelo'))          return '💇‍♀️';
  if (low.includes('maquiagem') || low.includes('make'))           return '💄';
  return '🌸';
}

const STATUS_CLASS = {
  'Novo Pedido':       'st-novo',
  'Orçamento Enviado': 'st-enviado',
  'Em Negociação':     'st-negoc',
  'Fechado':           'st-fechado',
  'Perdido':           'st-perdido',
  'Sem Resposta':      'st-semresp',
};

const DIAS = ['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];

// ── STATE ──────────────────────────────────────────────────
function safeJSON(s, fallback) { try { return s ? JSON.parse(s) : fallback; } catch(e) { return fallback; } }
let entries     = (function() {
  const raw = safeJSON(localStorage.getItem('orca_entries'), []);
  const deletedIds = safeJSON(localStorage.getItem('orca_deleted_ids'), []);
  return raw.filter(e => !deletedIds.includes(String(e.ID)));
})();
let services    = safeJSON(localStorage.getItem('orca_services'), DEFAULT_SERVICES);
let curFilter   = 'todos';
let curOrigem   = 'todos';   // filtro por origem: 'todos' | 'Produção Social' | 'Noiva' | 'Curso de Automaquiagem'
let curSearch   = '';        // pesquisa por nome do cliente
let activeId    = null;
let filterMonth = null;

let addSlots          = [];
let fechSlots         = [];
let fechLocal         = 'studio';
let fechSinalRecebido = true;
let fechSinalManual   = false;
let fechPropostas     = [];
let actPropostas      = [];
let lastFechamento    = null;

const coworkDisponivel = (typeof window !== 'undefined' && typeof window.cowork !== 'undefined');

// ══════════════════════════════════════════════════════════
//  UTILS
// ══════════════════════════════════════════════════════════
function pad(n) { return String(n).padStart(2,'0'); }
function pad2(n) { return String(n).padStart(2,'0'); }
function todayStr() {
  const t = new Date();
  return t.getFullYear() + '-' + pad(t.getMonth()+1) + '-' + pad(t.getDate());
}
function defaultFollowup() {
  const d = new Date(); d.setDate(d.getDate() + 2);
  return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate());
}
function fmtDate(s) {
  if (!s) return '—';
  const [y,m,d] = s.split('-');
  return d + '/' + m + '/' + y;
}
function fmtDateCard(s) {
  if (!s) return '<span class="e-date-day">—</span><span class="e-date-mon"></span>';
  const parts = s.split('-');
  const d = parseInt(parts[2], 10) || '—';
  const meses = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  const mon = parts[1] ? (meses[parseInt(parts[1],10)-1] || '') : '';
  return '<span class="e-date-day">' + d + '</span><span class="e-date-mon">' + mon + '</span>';
}
function fmtDateGroup(s) {
  if (!s) return 'Sem data';
  const parts = s.split('-').map(Number);
  const [y, m, d] = parts;
  if (!y || !m || !d) return s;
  const meses = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  const dias  = ['dom','seg','ter','qua','qui','sex','sáb'];
  return pad(d) + ' ' + meses[m-1] + ' · ' + dias[new Date(y, m-1, d).getDay()];
}
function renderEntryCard(e) {
  const sCls   = STATUS_CLASS[e.Status] || 'st-novo';
  const agOk   = e.Status === 'Fechado' && getAgendaCriada(e);
  const agPend = e.Status === 'Fechado' && !getAgendaCriada(e);
  const cls    = agPend ? 'is-agenda-pend' :
                 agOk   ? 'is-agenda-ok'   :
                 e.Status === 'Perdido' ? 'is-perdido' :
                 needsFollowup(e) ? 'needs-fu' : '';
  const nfu    = needsFollowup(e);
  const val    = e.ValorFechado ? parseFloat(e.ValorFechado) : parseFloat(e.ValorProp) || 0;
  const valStr = val ? fmtVal(val) : '—';
  const meta   = e.DataEvento    ? 'Evento: '      + fmtDate(e.DataEvento)
               : e.ProxFollowup  ? 'Follow-up: '   + fmtDate(e.ProxFollowup)
               : '';
  const compOk = hasComprovante(e);
  const statusRow = e.Status === 'Fechado'
    ? '<div class="status-row">' +
        (agOk ? '<span class="chip chip-ok">📅 Na agenda</span>'
              : '<span class="chip chip-warn">📅 Agenda pendente</span>') +
        (compOk
          ? '<span class="chip chip-ok">🧾 ' + (Array.isArray(e.Comprovantes) && e.Comprovantes.length > 1 ? e.Comprovantes.length + ' comprovantes' : 'Comprovante') + '</span>'
          : '<span class="chip chip-muted">🧾 Sem comprovante</span>') +
      '</div>'
    : '';
  return (
    '<div class="entry ' + cls + '" onclick="openAction(\'' + esc(e.ID) + '\')">' +
      '<div class="e-date">' + fmtDateCard(e.DataPedido) + '</div>' +
      '<div class="e-info">' +
        '<div class="e-name">' + esc(e.Cliente || '—') + '</div>' +
        '<div class="e-srv">' + (nfu ? '<span class="fu-dot"></span>' : '') + esc(e.Servico || '—') + '</div>' +
        (meta ? '<div class="e-meta">' + esc(meta) + '</div>' : '') +
        statusRow +
      '</div>' +
      '<div class="e-right">' +
        '<span class="badge ' + sCls + '">' + esc(e.Status || 'Novo') + '</span>' +
        '<span class="e-val">' + valStr + '</span>' +
      '</div>' +
    '</div>');
}
function fmtDateWeek(s) {
  if (!s) return '';
  const [y,m,d] = s.split('-').map(Number);
  if (!y || !m || !d) return '';
  const dt = new Date(y, m-1, d);
  return pad(d) + '/' + pad(m) + ', ' + DIAS[dt.getDay()];
}
function fmtDateWeekFull(s) {
  if (!s) return '';
  const [y,m,d] = s.split('-').map(Number);
  if (!y || !m || !d) return '';
  const dt = new Date(y, m-1, d);
  return pad(d) + '/' + pad(m) + '/' + y + ' — ' + DIAS[dt.getDay()];
}
function fmtHorario(val) { return val ? val.replace(':', 'h') : ''; }
function fmt(v) { return parseFloat(v||0).toFixed(2).replace('.', ','); }
function fmtVal(v) {
  if (!v && v !== 0) return '—';
  return 'R$ ' + Number(v).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});
}
function daysSince(dateStr) {
  if (!dateStr) return 0;
  const d = new Date(dateStr + 'T12:00:00');
  return Math.floor((Date.now() - d) / 86400000);
}
function needsFollowup(e) {
  if (['Fechado','Perdido'].includes(e.Status)) return false;
  return e.ProxFollowup && e.ProxFollowup <= todayStr();
}
function initials(name) {
  return (name || '?').split(' ').slice(0,2).map(w => w[0]||'').join('').toUpperCase();
}
function formatPhone(p) {
  const d = (p || '').replace(/\D/g,'');
  if (!d) return '';
  if (d.startsWith('55') && d.length >= 12) return d;
  return '55' + d;
}
function addMinutes(horario, mins) {
  if (!horario) return '';
  const [h, m] = horario.split(':').map(Number);
  const total = h * 60 + m + mins;
  return pad2(Math.floor(total/60) % 24) + ':' + pad2(total % 60);
}
function addMinutesFmt(horario, mins) {
  if (!horario) return '';
  const [h, m] = horario.split(':').map(Number);
  const total = h * 60 + m + mins;
  return pad2(Math.floor(total/60) % 24) + 'h' + pad2(total % 60);
}
function toISO(dataStr, horarioStr) {
  if (!dataStr || !horarioStr) return null;
  return dataStr + 'T' + horarioStr + ':00';
}
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2300);
}
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function cacheEntries() { localStorage.setItem('orca_entries', JSON.stringify(entries)); }
function cacheServices() { localStorage.setItem('orca_services', JSON.stringify(services)); }

// ── Safeguard: lista de IDs excluídos localmente ──
function getDeletedIds() {
  return safeJSON(localStorage.getItem('orca_deleted_ids'), []);
}
function addDeletedId(id) {
  const ids = getDeletedIds();
  if (!ids.includes(String(id))) {
    ids.push(String(id));
    localStorage.setItem('orca_deleted_ids', JSON.stringify(ids));
  }
}
function removeDeletedId(id) {
  const ids = getDeletedIds().filter(x => x !== String(id));
  localStorage.setItem('orca_deleted_ids', JSON.stringify(ids));
}

// ── Slots <-> Obs roundtrip (compatível com sheet existente) ──
const SLOTS_MARK = '\n\n__SLOTS__=';
function packSlots(obs, slots) {
  const clean = (obs || '').replace(/\n*__SLOTS__=.*$/s, '').replace(/\s+$/, '');
  if (!slots || !slots.length) return clean;
  return (clean ? clean + SLOTS_MARK : '__SLOTS__=') + JSON.stringify(slots);
}
function unpackSlots(obs) {
  const s = obs || '';
  const idx = s.indexOf('__SLOTS__=');
  if (idx < 0) return { obs: s, slots: [] };
  const before = s.slice(0, idx).replace(/\n+$/,'');
  const json = s.slice(idx + '__SLOTS__='.length).trim();
  return { obs: before, slots: safeJSON(json, []) };
}
function entrySlots(e) { return unpackSlots(e.Obs).slots; }
function entryCleanObs(e) { return unpackSlots(e.Obs).obs; }

let _syncState = 'syncing';
function dot(state) {
  _syncState = state || 'offline';
  const sub = { syncing:'Sincronizando...', ok:'Carregado', offline:'Sem conexão', nourl:'Configure o Script' };
  const hsub = document.getElementById('hsub');
  if (hsub) hsub.textContent = sub[state] || '';
  // Atualiza o status no painel de configurações (se aberto)
  const note = document.getElementById('sb-status-note');
  if (note) {
    note.textContent = { ok:'🟢 Supabase conectado', syncing:'🟡 Sincronizando...', offline:'🔴 Sem conexão' }[state] || '⚪ Status desconhecido';
  }
}

// ══════════════════════════════════════════════════════════
//  LOADING SCREEN
// ══════════════════════════════════════════════════════════
function showLoading(msg, sub) {
  document.getElementById('loading-msg').textContent = msg || 'Processando...';
  document.getElementById('loading-sub').textContent = sub || 'Aguarde um momento';
  [0,1,2].forEach(i => { document.getElementById('lstep-'+i).className = 'loading-step'; });
  document.getElementById('loading-screen').classList.add('show');
}
function hideLoading() {
  document.getElementById('loading-screen').classList.remove('show');
}
function setLoadingStep(step, msg, sub) {
  for (let i = 0; i <= 2; i++) {
    const s = document.getElementById('lstep-'+i);
    if (i < step)      s.className = 'loading-step done';
    else if (i===step) s.className = 'loading-step active';
    else               s.className = 'loading-step';
  }
  if (msg) document.getElementById('loading-msg').textContent = msg;
  if (sub) document.getElementById('loading-sub').textContent = sub;
}

// ══════════════════════════════════════════════════════════
//  FOLLOW-UP TEMPLATES — storage
// ══════════════════════════════════════════════════════════
const DEFAULT_FU_TEMPLATES = [
  { id:'orç-1',  nome:'ORÇ-1 — Confirmação',        texto:'Olá, [NOME]! 😊\n\nRecebi seu pedido de orçamento para [SERVIÇO] e já estou preparando sua proposta!\n\nEm breve envio todos os detalhes. Se tiver alguma dúvida, pode me chamar aqui mesmo.\n\nUm abraço! 🎂' },
  { id:'fu-1',   nome:'FU-1 — 1º Follow-up',         texto:'Oi, [NOME]! Tudo bem? 😊\n\nPassei para verificar se você recebeu o orçamento que enviei sobre [SERVIÇO].\n\nCaso tenha alguma dúvida ou queira ajustar algum detalhe, é só me falar! Estou aqui para ajudar. 🎂\n\nAguardo seu retorno!' },
  { id:'fu-2',   nome:'FU-2 — 2º Follow-up',         texto:'Oi, [NOME]! 👋\n\nSei que a vida fica corrida! Só queria confirmar se você ainda tem interesse no orçamento de [SERVIÇO].\n\nPosso ajustar o valor ou algum detalhe se precisar. Me fala o que você precisa! 📅' },
  { id:'fu-3',   nome:'FU-3 — Última tentativa',      texto:'Olá, [NOME]! Espero que esteja bem. 🌟\n\nEsta é minha última mensagem sobre o orçamento de [SERVIÇO].\n\nCaso mude de ideia ou queira conversar mais pra frente, estarei aqui! 💚' },
  { id:'neg-1',  nome:'NEG-1 — Negociação',           texto:'Oi, [NOME]! Entendo que o investimento precisa caber no orçamento. 😊\n\nPosso te oferecer algumas opções:\n\n🔸 Opção 1: [descreva uma opção mais simples]\n🔸 Opção 2: [serviço padrão] por R$ [VALOR]\n🔸 Opção 3: Parcelamento disponível\n\nMe diz o que funciona melhor pra você!' },
  { id:'fech-1', nome:'FECH-1 — Fechamento',          texto:'Que ótima notícia, [NOME]! 🎉\n\nFicou confirmado o pedido de [SERVIÇO]!\n\nPróximos passos:\n✅ Pagamento do sinal via Pix\n✅ Saldo no dia do atendimento: R$ [VALOR]\n\nVou enviar o recibo assim que confirmar o pagamento. Qualquer dúvida, estou aqui! 🎂' },
  { id:'pos-1',  nome:'POS-1 — Pós-venda',            texto:'Oi, [NOME]! Espero que tudo tenha corrido maravilhosamente! 🎉\n\nGostaria de saber como foi a experiência com [SERVIÇO].\n\nSua opinião é muito importante pra mim! Se puder, me deixa uma avaliação. ⭐\n\nObrigada pela confiança. Espero te atender em breve! 💚' },
];

let fuTemplates = null;

function getFollowupTemplates() {
  if (!fuTemplates) {
    fuTemplates = safeJSON(localStorage.getItem('orca_fu_templates'), null);
    if (!fuTemplates) fuTemplates = DEFAULT_FU_TEMPLATES.map(t => ({ ...t }));
  }
  return fuTemplates;
}
function saveFollowupTemplatesLS() {
  localStorage.setItem('orca_fu_templates', JSON.stringify(fuTemplates));
}

function personalizeTemplate(text, entry) {
  const nome    = (entry.Cliente || '').split(' ')[0] || '[NOME]';
  const servico = entry.Servico  || '[SERVIÇO]';
  const valor   = entry.ValorFechado
    ? fmtVal(parseFloat(entry.ValorFechado))
    : (entry.ValorProp ? fmtVal(parseFloat(entry.ValorProp)) : '[VALOR]');
  return text
    .replace(/\[NOME\]/g, nome)
    .replace(/\[SERVIÇO\]/g, servico)
    .replace(/\[VALOR\]/g, valor);
}

// ── Picker no painel de ação ──
let activeFuIdx   = null;
let activeFuEntry = null;

function renderFollowupPicker(id) {
  const scroll  = document.getElementById('fu-chips-scroll');
  const preview = document.getElementById('fu-preview');
  if (!scroll) return;
  activeFuIdx   = null;
  activeFuEntry = entries.find(x => String(x.ID) === String(id));
  if (preview) preview.classList.remove('show');

  const templates = getFollowupTemplates();
  if (!templates.length) {
    scroll.innerHTML = '<span class="fu-empty-chips">Nenhum template cadastrado. Crie em ⚙️ Configurações → Follow-ups.</span>';
    return;
  }
  scroll.innerHTML = templates.map((t, i) => {
    const label = t.nome.includes('—') ? t.nome.split('—')[0].trim() : t.nome;
    return '<button class="fu-chip" onclick="selectFuTemplate(' + i + ')">' + esc(label) + '</button>';
  }).join('');
}

function selectFuTemplate(idx) {
  activeFuIdx = idx;
  const templates = getFollowupTemplates();
  const tpl = templates[idx];
  if (!tpl || !activeFuEntry) return;

  document.querySelectorAll('.fu-chip').forEach((c, i) => c.classList.toggle('on', i === idx));

  const msgEl   = document.getElementById('fu-preview-msg');
  const preview = document.getElementById('fu-preview');
  if (!msgEl || !preview) return;
  msgEl.textContent = personalizeTemplate(tpl.texto, activeFuEntry);
  preview.classList.add('show');
  setTimeout(() => preview.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 60);
}

function getFuCurrentText() {
  const msgEl = document.getElementById('fu-preview-msg');
  return msgEl ? (msgEl.innerText || msgEl.textContent || '') : '';
}

function sendFuWA() {
  if (!activeFuEntry) return;
  const text  = getFuCurrentText();
  const phone = formatPhone(activeFuEntry.Telefone);
  if (!phone) { toast('⚠️ Cliente sem telefone cadastrado'); return; }
  window.open('https://wa.me/' + phone + '?text=' + encodeURIComponent(text), '_blank');
  _autoLogFuSend('wa');
}

function copyFuMsg() {
  const text = getFuCurrentText();
  if (!text) return;
  const doToast = () => { toast('📋 Mensagem copiada!'); _autoLogFuSend('copy'); };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(doToast).catch(() => _fallbackCopy(text, doToast));
  } else {
    _fallbackCopy(text, doToast);
  }
}
function _fallbackCopy(text, cb) {
  const ta = document.createElement('textarea');
  ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.focus(); ta.select();
  try { document.execCommand('copy'); } catch(e) {}
  document.body.removeChild(ta);
  if (cb) cb();
}
function _autoLogFuSend(tipo) {
  if (!activeFuEntry || activeFuIdx === null) return;
  const templates = getFollowupTemplates();
  const tpl = templates[activeFuIdx];
  _addFuRecord(String(activeFuEntry.ID), {
    date: todayStr(), tipo,
    template: tpl ? tpl.nome : null,
  });
}

// ── Histórico (log silencioso) ──
function _getFuHistory(id) {
  const all = safeJSON(localStorage.getItem('orca_fu_history'), {});
  return all[String(id)] || [];
}
function _addFuRecord(id, record) {
  const all = safeJSON(localStorage.getItem('orca_fu_history'), {});
  if (!all[id]) all[id] = [];
  all[id].push(record);
  localStorage.setItem('orca_fu_history', JSON.stringify(all));
}

// ── Settings — CRUD de templates ──
function renderFollowupSettings() {
  const list = document.getElementById('fu-tpl-list');
  if (!list) return;
  const templates = getFollowupTemplates();
  if (!templates.length) {
    list.innerHTML = '<div style="text-align:center;padding:16px;color:var(--muted);font-size:0.8rem;">Nenhum template. Clique em "+ Novo template".</div>';
    return;
  }
  list.innerHTML = templates.map((t, idx) =>
    '<div class="fu-tpl-card">' +
      '<div class="fu-tpl-name-row">' +
        '<input class="fu-tpl-name" type="text" value="' + esc(t.nome) + '" placeholder="Nome do template" ' +
          'oninput="fuTemplates[' + idx + '].nome = this.value">' +
        '<button class="fu-tpl-del" onclick="removeFollowupTemplate(' + idx + ')" title="Excluir template">✕</button>' +
      '</div>' +
      '<textarea class="fu-tpl-textarea" rows="5" ' +
        'oninput="fuTemplates[' + idx + '].texto = this.value">' + esc(t.texto) + '</textarea>' +
      '<div class="fu-tpl-vars">Variáveis: <strong>[NOME]</strong> · <strong>[SERVIÇO]</strong> · <strong>[VALOR]</strong></div>' +
    '</div>'
  ).join('');
}

function addFollowupTemplate() {
  getFollowupTemplates();
  fuTemplates.push({ id: 'custom-' + Date.now(), nome: 'Novo template', texto: 'Oi, [NOME]! 😊\n\n' });
  renderFollowupSettings();
  // Scroll para o novo card
  const list = document.getElementById('fu-tpl-list');
  if (list) setTimeout(() => list.lastElementChild && list.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 60);
}

function removeFollowupTemplate(idx) {
  if (!confirm('Excluir este template?')) return;
  getFollowupTemplates();
  fuTemplates.splice(idx, 1);
  renderFollowupSettings();
}

function saveFollowupSettings() {
  getFollowupTemplates();
  fuTemplates = fuTemplates.filter(t => t.nome && t.nome.trim() && t.texto && t.texto.trim());
  saveFollowupTemplatesLS();
  toast('✅ Templates salvos!');
  // Atualiza chips se picker estiver visível
  if (activeFuEntry) renderFollowupPicker(activeFuEntry.ID);
}

// ══════════════════════════════════════════════════════════
//  API — Apps Script (Orçamentos)
// ══════════════════════════════════════════════════════════
async function syncAll() {
  dot('syncing');
  try {
    const deletedIds = getDeletedIds();
    const [all, svcMap] = await Promise.all([
      DB.orcamentos.list(),
      DB.valoresServicos.load().catch(() => null),
    ]);
    entries = all.filter(e => !deletedIds.includes(String(e.ID)));
    cacheEntries();
    if (svcMap) {
      // Mescla com a lista local: prioriza ordem do localStorage para serviços que existem;
      // adiciona serviços novos do Supabase no fim
      const localNames = new Set(services.map(s => s.nome));
      services = services.map(s => {
        if (svcMap[s.nome]) {
          return { nome: s.nome, valor: svcMap[s.nome].valor, duracao: svcMap[s.nome].duracao ?? s.duracao ?? 60 };
        }
        return s;
      });
      Object.entries(svcMap).forEach(([nome, v]) => {
        if (!localNames.has(nome)) services.push({ nome, valor: v.valor, duracao: v.duracao ?? 60 });
      });
      cacheServices();
    }
    dot('ok');
  } catch(e) {
    dot('offline');
    console.warn('syncAll error:', e.message);
  }
  render();
}

async function postEntry(payload) {
  const { action, id, fields, entry, fileId } = payload;
  try {
    dot('syncing');
    if (action === 'save' && entry) {
      await DB.orcamentos.upsert(entry);
    } else if (action === 'update' && id && fields) {
      if (typeof fields.Comprovantes === 'string') {
        try { fields.Comprovantes = JSON.parse(fields.Comprovantes); } catch(_) { fields.Comprovantes = []; }
      }
      await DB.orcamentos.update(id, fields);
    } else if (action === 'delete' && id) {
      await DB.orcamentos.delete(id);
    } else if (action === 'deleteComprovante' && fileId) {
      try { await DB.storage.deleteComprovante(fileId); } catch(_) {}
    }
    dot('ok');
    return { ok: true };
  } catch(e) {
    dot('offline');
    console.warn('postEntry error:', e.message);
    return { ok: false, error: e.message };
  }
}

// ══════════════════════════════════════════════════════════
//  API — Financeiro (mesmo padrão de entradas.html)
// ══════════════════════════════════════════════════════════
async function finEntryCreate(entry) {
  try {
    await DB.entries.upsert(entry);
    return { ok: true };
  } catch(e) {
    console.warn('finEntryCreate error:', e.message);
    return { ok: false, error: e.message };
  }
}

// ══════════════════════════════════════════════════════════
//  WHATSAPP — follow-ups por status
// ══════════════════════════════════════════════════════════
function getWaTemplate(entry) {
  const nome    = (entry.Cliente || '').split(' ')[0] || 'cliente';
  const servico = entry.Servico  || 'o serviço solicitado';
  const diasEnvio  = daysSince(entry.DataEnvio  || entry.DataPedido);
  const diasPedido = daysSince(entry.DataPedido);

  // ORÇ-1 — Confirmação de recebimento (Novo Pedido)
  if (entry.Status === 'Novo Pedido') return {
    code: 'ORÇ-1', hint: 'Confirmação de recebimento do pedido',
    text: 'Olá, ' + nome + '! 😊\n\nRecebi seu pedido de orçamento para ' + servico + ' e já estou preparando sua proposta!\n\nEm breve envio todos os detalhes. Se tiver alguma dúvida ou queira passar informações adicionais, pode me chamar aqui mesmo.\n\nUm abraço! 🎂'
  };

  // FU-1 — 1º follow-up (Orçamento Enviado, ~2 dias)
  if (entry.Status === 'Orçamento Enviado') return {
    code: 'FU-1', hint: 'FU-1 — 1º follow-up, verificar se recebeu',
    text: 'Oi, ' + nome + '! Tudo bem? 😊\n\nPassei para verificar se você recebeu o orçamento que enviei sobre ' + servico + '.\n\nCaso tenha alguma dúvida ou queira ajustar algum detalhe, é só me falar! Estou aqui para ajudar. 🎂\n\nAguardo seu retorno!'
  };

  // FU-2 — 2º follow-up (Sem Resposta, ≤6 dias)
  if (entry.Status === 'Sem Resposta' && diasEnvio <= 6) return {
    code: 'FU-2', hint: 'FU-2 — 2º follow-up, segunda tentativa (dia 4)',
    text: 'Oi, ' + nome + '! 👋\n\nSei que a vida fica corrida às vezes! Só queria confirmar se você ainda tem interesse no orçamento de ' + servico + '.\n\nPosso ajustar o valor, o tamanho ou algum detalhe se precisar. Me fala o que você precisa!\n\nEm caso de data próxima, gostaria de já confirmar na agenda. 📅'
  };

  // FU-3 — Última tentativa (Sem Resposta, >6 dias)
  if (entry.Status === 'Sem Resposta' && diasEnvio > 6) return {
    code: 'FU-3', hint: 'FU-3 — Última tentativa (dia 7+)',
    text: 'Olá, ' + nome + '! Espero que esteja bem. 🌟\n\nEsta é minha última mensagem sobre o orçamento de ' + servico + '.\n\nCaso mude de ideia ou queira conversar mais pra frente, fico feliz em te atender!\n\nSe precisar de algo diferente ou outro serviço, estarei aqui. 🎂\n\nNão perca meu contato — estarei aqui quando precisar! 💚'
  };

  // NEG-1 — Negociação de preço
  if (entry.Status === 'Em Negociação') return {
    code: 'NEG-1', hint: 'NEG-1 — Resposta sobre preço / negociação',
    text: 'Oi, ' + nome + '! Entendo que o investimento precisa caber no orçamento. 😊\n\nPosso te oferecer algumas opções:\n\n🔸 Opção 1: [descreva serviço menor] por R$ [valor]\n🔸 Opção 2: [serviço padrão] por R$ [valor]\n🔸 Opção 3: Parcelamento disponível\n\nMe diz o que funciona melhor pra você e encontramos uma solução!'
  };

  // POS-1 — Pós-venda (Fechado)
  if (entry.Status === 'Fechado') return {
    code: 'POS-1', hint: 'POS-1 — Pós-venda / pesquisa de satisfação',
    text: 'Oi, ' + nome + '! Espero que tudo tenha corrido maravilhosamente! 🎉\n\nGostaria de saber como foi a experiência com ' + servico + '.\n\nSua opinião é muito importante pra mim! Se puder, me deixa uma avaliação: ⭐ [link do Google ou Instagram]\n\nE se tirar fotos, adoro ver o resultado! Pode me marcar. 📸\n\nObrigada pela confiança. Espero te atender em breve novamente! 💚'
  };

  return { code: '—', hint: 'Mensagem de contato geral', text: 'Oi, ' + nome + '! 😊\n\nTudo bem?' };
}

// ══════════════════════════════════════════════════════════
//  WHATSAPP — mensagem de confirmação (igual ao confirmacao.html)
// ══════════════════════════════════════════════════════════
function buildConfirmacaoMessage(nome, slots, total, sinal, saldo, endereco, localTipo) {
  const linhas = [];
  linhas.push('Obrigada, ' + (nome || '[nome]') + '!');

  // Agrupar slots por data
  const porData = {};
  slots.forEach(s => {
    const key = s.data || '__semdata__';
    if (!porData[key]) porData[key] = [];
    porData[key].push(s);
  });
  const datas = Object.keys(porData).sort();
  const plural = slots.length > 1 || datas.length > 1;
  linhas.push(plural ? 'Seus agendamentos estão confirmados ✅' : 'Seu agendamento está confirmado ✅');

  const tipoLocalStr = (localTipo === 'domicilio') ? 'em domicílio' : 'no studio';

  datas.forEach(dataKey => {
    const grupo = porData[dataKey];
    linhas.push('');

    // Contar tipos de serviço no grupo
    let nMaquiagem = 0, nCabelo = 0, nNoiva = 0, nOutro = 0;
    grupo.forEach(s => {
      const low = (s.servico || '').toLowerCase();
      const hasMake   = low.includes('maquiagem') || low.includes('make');
      const hasCabelo = low.includes('cabelo')    || low.includes('penteado');
      const hasNoiva  = low.includes('noiva');
      if (hasNoiva)                  { nNoiva++; }
      else if (hasMake && hasCabelo) { nMaquiagem++; nCabelo++; }
      else if (hasMake)              { nMaquiagem++; }
      else if (hasCabelo)            { nCabelo++; }
      else                           { nOutro++; }
    });

    const partes = [];
    if (nNoiva > 0)     partes.push(nNoiva     + (nNoiva     === 1 ? ' noiva'     : ' noivas'));
    if (nMaquiagem > 0) partes.push(nMaquiagem + (nMaquiagem === 1 ? ' maquiagem' : ' maquiagens'));
    if (nCabelo > 0)    partes.push(nCabelo    + (nCabelo    === 1 ? ' cabelo'    : ' cabelos'));
    if (nOutro > 0)     partes.push(nOutro     + (nOutro     === 1 ? ' serviço'   : ' serviços'));
    const descServico = (partes.join(' e ') || grupo.length + ' serviços') + ' ' + tipoLocalStr;
    linhas.push('*Serviço:* ' + descServico);

    // Horário mais cedo do grupo
    const firstSlot = grupo.reduce((min, s) =>
      (!min.horario || (s.horario && s.horario < min.horario)) ? s : min, grupo[0]);
    if (dataKey !== '__semdata__') linhas.push('*Data:* ' + fmtDateWeekFull(dataKey));
    if (firstSlot.horario)         linhas.push('*Horário de início:* ' + fmtHorario(firstSlot.horario));
    linhas.push('*Endereço:* ' + (endereco || '[endereço]'));

    // Valores por tipo de serviço (preço unitário, sem repetir)
    const tiposValor = {};
    grupo.forEach(s => {
      const v = parseFloat(s.valorUnit) || 0;
      const label = simplifyServiceName(s.servico);
      if (v > 0 && !tiposValor[label]) tiposValor[label] = v;
    });
    const tiposEntries = Object.entries(tiposValor);
    if (tiposEntries.length > 0) {
      linhas.push('');
      linhas.push('*Valores:*');
      tiposEntries.forEach(([label, v]) => linhas.push('• ' + label + ': R$ ' + fmt(v)));
    }
  });

  // ── Totais gerais ──
  linhas.push('');
  linhas.push('*Valor total do orçamento:* R$ ' + (total > 0 ? fmt(total) : '[valor]'));

  // Sinal com detalhamento por tipo de serviço
  linhas.push('*Valor pago na reserva:* R$ ' + (sinal > 0 ? fmt(sinal) : '[sinal]'));
  if (sinal > 0 && total > 0 && slots.length > 1) {
    const tiposSinal = {};
    slots.forEach(s => {
      const v = parseFloat(s.valorUnit) || 0;
      if (v > 0) {
        const label = simplifyServiceName(s.servico);
        const sinalUnit = Math.round(sinal * (v / total) * 100) / 100;
        if (!tiposSinal[label]) tiposSinal[label] = { sinalUnit, count: 0 };
        tiposSinal[label].count++;
      }
    });
    Object.entries(tiposSinal).forEach(([label, info]) => {
      const prefix = info.count > 1 ? info.count + '× ' : '';
      const suffix = info.count > 1 ? ' cada' : '';
      linhas.push('  • ' + prefix + label + ': R$ ' + fmt(info.sinalUnit) + suffix);
    });
  }

  // Restante com detalhamento por tipo de serviço
  linhas.push('*Restante a pagar no dia:* R$ ' + (saldo > 0 ? fmt(saldo) : '[restante]'));
  if (saldo > 0 && total > 0 && slots.length > 1) {
    const tiposSaldo = {};
    slots.forEach(s => {
      const v = parseFloat(s.valorUnit) || 0;
      if (v > 0) {
        const label = simplifyServiceName(s.servico);
        const saldoUnit = Math.round(saldo * (v / total) * 100) / 100;
        if (!tiposSaldo[label]) tiposSaldo[label] = { saldoUnit, count: 0 };
        tiposSaldo[label].count++;
      }
    });
    Object.entries(tiposSaldo).forEach(([label, info]) => {
      const prefix = info.count > 1 ? info.count + '× ' : '';
      const suffix = info.count > 1 ? ' cada' : '';
      linhas.push('  • ' + prefix + label + ': R$ ' + fmt(info.saldoUnit) + suffix);
    });
  }

  return linhas.join('\n');
}

// ══════════════════════════════════════════════════════════
//  GOOGLE AGENDA
// ══════════════════════════════════════════════════════════
function buildGCalURL(titulo, dataStr, horarioStr, durMinutes, endereco, descricao) {
  if (!dataStr || !horarioStr) return null;
  const dp = dataStr.split('-');
  const tp = horarioStr.split(':');
  const h = parseInt(tp[0]), m = parseInt(tp[1]);
  const startStr = dp[0] + dp[1] + dp[2] + 'T' + pad2(h) + pad2(m) + '00';
  const endTot = h * 60 + m + (durMinutes || 60);
  const eh = Math.floor(endTot / 60) % 24, em = endTot % 60;
  const endStr = dp[0] + dp[1] + dp[2] + 'T' + pad2(eh) + pad2(em) + '00';
  let url = 'https://calendar.google.com/calendar/render?action=TEMPLATE';
  url += '&text='    + encodeURIComponent(titulo);
  url += '&dates='   + startStr + '/' + endStr;
  url += '&ctz=America%2FSao_Paulo';
  if (endereco)  url += '&location=' + encodeURIComponent(endereco);
  if (descricao) url += '&details='  + encodeURIComponent(descricao);
  return url;
}

function getServiceDuration(servName) {
  const svc = services.find(s => s.nome === servName);
  if (svc && svc.duracao) return Number(svc.duracao);
  const low = (servName || '').toLowerCase();
  if (low.includes('noiva')) return 180;
  if (low.includes('maquiagem') && low.includes('cabelo')) return 120;
  return 60;
}

function abrevServico(servName) {
  const low = (servName || '').toLowerCase();
  if (low.includes('noiva'))                                  return 'Noiva';
  if (low.includes('maquiagem') && low.includes('cabelo'))    return 'Make e Cabelo';
  if (low.includes('penteado') || low.includes('cabelo'))     return 'Cabelo';
  if (low.includes('maquiagem') || low.includes('make'))      return 'Make';
  return servName || 'Serviço';
}

function simplifyServiceName(servName) {
  if (!servName) return 'Serviço';
  const low = servName.toLowerCase();
  const hasMake   = low.includes('maquiagem') || low.includes('make');
  const hasCabelo = low.includes('cabelo')    || low.includes('penteado');
  if (hasMake && hasCabelo) return 'Cabelo e maquiagem';
  if (hasMake)   return 'Maquiagem';
  if (hasCabelo) return 'Apenas cabelo';
  if (low.includes('noiva')) return 'Noiva';
  return servName.replace(/\s+(em domicílio|no studio|no estúdio|em domicilio|no estudio)\s*$/i, '').trim();
}

function buildEventos(nome, slots, endereco, total, sinal, saldo, telefone) {
  const eventos = [];
  slots.forEach(s => {
    if (!s.data || !s.horario) return;
    const dur = getServiceDuration(s.servico);
    const inicio = fmtHorario(s.horario);
    const fim = addMinutesFmt(s.horario, dur);
    const local = fechLocal === 'studio' ? 'Studio' : 'Domicílio';
    const abrev = abrevServico(s.servico);
    const titulo = inicio + ' - ' + fim + ' | ' + (nome || '[nome]') + ' | ' + abrev + ' | ' + local;

    const desc = [];
    desc.push('Serviço: ' + (s.servico || ''));
    desc.push('Data: ' + (fmtDateWeek(s.data) || ''));
    desc.push('Horário de início: ' + inicio);
    desc.push('Endereço: ' + (endereco || ''));
    if (parseFloat(s.valorUnit) > 0) desc.push('Valor deste serviço: R$ ' + fmt(s.valorUnit));
    desc.push('Valor total do orçamento: R$ ' + (total > 0 ? fmt(total) : ''));
    desc.push('Valor pago na reserva: R$ '   + (sinal > 0 ? fmt(sinal) : ''));
    desc.push('Restante a ser pago no dia: R$ ' + (saldo > 0 ? fmt(saldo) : ''));
    if (telefone) { desc.push(''); desc.push('Contato: ' + telefone); }

    const endHora = addMinutes(s.horario, dur);
    eventos.push({
      titulo,
      startISO: toISO(s.data, s.horario),
      endISO:   toISO(s.data, endHora),
      endereco,
      descricao: desc.join('\n'),
      durMinutes: dur,
      data: s.data,
      horario: s.horario,
    });
  });
  return eventos;
}

async function salvarEventosDireto(eventos, statusEl) {
  if (!coworkDisponivel) return { ok: false, error: 'cowork não disponível' };
  const calId = CAL_ID();
  if (statusEl) { statusEl.className = 'gcal-status loading'; statusEl.textContent = 'Salvando na agenda...'; }
  try {
    const promessas = eventos.map(ev => {
      const params = {
        summary:    ev.titulo,
        startTime:  ev.startISO,
        endTime:    ev.endISO,
        timeZone:   'America/Sao_Paulo',
        description: ev.descricao,
      };
      if (ev.endereco) params.location   = ev.endereco;
      if (calId)       params.calendarId = calId;
      return window.cowork.callMcpTool(
        'mcp__26a09c15-4d33-4f5b-87c7-da8ae7d87b7c__create_event', params
      );
    });
    await Promise.all(promessas);
    if (statusEl) {
      statusEl.className = 'gcal-status ok';
      const n = eventos.length;
      statusEl.textContent = '✅ ' + n + (n === 1 ? ' evento salvo' : ' eventos salvos') + ' na agenda!';
    }
    return { ok: true };
  } catch (err) {
    if (statusEl) {
      statusEl.className = 'gcal-status err';
      statusEl.textContent = 'Erro ao salvar: ' + (err.message || err);
    }
    return { ok: false, error: err.message || String(err) };
  }
}

function abrirEventosNoNavegador(eventos, statusEl) {
  if (!eventos.length) {
    if (statusEl) { statusEl.className = 'gcal-status err'; statusEl.textContent = 'Preencha data e horário antes de adicionar à agenda.'; }
    return { ok: false };
  }
  if (eventos.length === 1) {
    const ev = eventos[0];
    const url = buildGCalURL(ev.titulo, ev.data, ev.horario, ev.durMinutes, ev.endereco, ev.descricao);
    if (url) window.open(url, '_blank');
    if (statusEl) {
      statusEl.className = 'gcal-status warn';
      statusEl.textContent = '⚠️ Na tela do Google Agenda, troque para a agenda "Clientes" antes de salvar.';
    }
    return { ok: true };
  }
  if (statusEl) {
    statusEl.className = 'gcal-status info';
    let h = '<div style="font-size:13px;font-weight:600;margin-bottom:8px;">Clique para adicionar cada evento:</div>';
    h += '<div style="font-size:12px;color:#b45309;margin-bottom:6px;">⚠️ Lembre de trocar para a agenda Clientes antes de salvar.</div>';
    eventos.forEach(ev => {
      const url = buildGCalURL(ev.titulo, ev.data, ev.horario, ev.durMinutes, ev.endereco, ev.descricao);
      if (url) h += '<a href="' + esc(url) + '" target="_blank" class="gcal-link-btn">📅 ' + esc(fmtDate(ev.data)) + ' ' + esc(fmtHorario(ev.horario)) + '</a>';
    });
    statusEl.innerHTML = h;
  }
  return { ok: true };
}

// ══════════════════════════════════════════════════════════
//  RENDER — lista de orçamentos
// ══════════════════════════════════════════════════════════
function render() {
  const total = entries.length;
  const fechados = entries.filter(e => e.Status === 'Fechado').length;
  const receita = entries
    .filter(e => e.Status === 'Fechado')
    .reduce((s, e) => s + (parseFloat(e.ValorFechado) || parseFloat(e.ValorProp) || 0), 0);
  document.getElementById('c-total').textContent    = total;
  document.getElementById('c-fechados').textContent = fechados;
  document.getElementById('c-conv').textContent     = total ? Math.round(fechados / total * 100) + '%' : '—';
  document.getElementById('c-receita').textContent  = receita ? fmtVal(receita) : '—';

  const ml = document.getElementById('month-label');
  const mc = document.getElementById('month-clear');
  if (filterMonth) {
    const [y, m] = filterMonth.split('-');
    const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    ml.textContent = meses[parseInt(m)-1] + ' ' + y;
    ml.classList.add('filtered'); mc.classList.add('show');
  } else {
    ml.textContent = 'Todos os meses';
    ml.classList.remove('filtered'); mc.classList.remove('show');
  }

  const fuCount = entries.filter(e => needsFollowup(e)).length;
  const dsFu = document.getElementById('dsf-fu');
  if (dsFu) dsFu.textContent = fuCount || '0';
  const fuEl = document.getElementById('fu-alert');
  if (fuCount > 0 && curFilter !== 'followup') {
    fuEl.classList.add('show');
    document.getElementById('fu-alert-txt').textContent =
      fuCount === 1 ? '1 cliente esperando follow-up' : fuCount + ' clientes esperando follow-up';
  } else fuEl.classList.remove('show');

  let list = entries.slice();

  // Filtro por mês usa DataPedido (data de recebimento), não DataEvento
  if (filterMonth) {
    list = list.filter(e => (e.DataPedido || '').startsWith(filterMonth));
  }

  // Filtro por status
  if (curFilter === 'followup')          list = list.filter(e => needsFollowup(e));
  else if (curFilter === 'novos')        list = list.filter(e => ['Novo Pedido','Orçamento Enviado'].includes(e.Status));
  else if (curFilter === 'sem-resposta') list = list.filter(e => e.Status === 'Sem Resposta');
  else if (curFilter === 'negoc')        list = list.filter(e => e.Status === 'Em Negociação');
  else if (curFilter === 'perdidos')     list = list.filter(e => e.Status === 'Perdido');
  else if (curFilter === 'fechados')     list = list.filter(e => e.Status === 'Fechado');
  else if (curFilter === 'agenda-pend')  list = list.filter(e => e.Status === 'Fechado' && !getAgendaCriada(e));
  else if (curFilter === 'agenda-ok')    list = list.filter(e => e.Status === 'Fechado' && getAgendaCriada(e));

  // Filtro por origem (Produção Social / Noiva / Curso de Automaquiagem)
  if (curOrigem !== 'todos') {
    list = list.filter(e => e.Origem === curOrigem);
  }

  // Pesquisa por nome do cliente
  if (curSearch.trim()) {
    const q = curSearch.toLowerCase().trim();
    list = list.filter(e => (e.Cliente || '').toLowerCase().includes(q));
  }

  list.sort((a, b) => (b.DataPedido || '').localeCompare(a.DataPedido || ''));

  // Atualiza tabs de status (mobile + desktop)
  document.querySelectorAll('.ftab').forEach(t => t.classList.toggle('on', t.dataset.f === curFilter));
  document.querySelectorAll('.d-fil-item[data-f]').forEach(t => t.classList.toggle('active', t.dataset.f === curFilter));

  // Atualiza tabs de origem (mobile + desktop)
  document.querySelectorAll('.orig-tab').forEach(t => t.classList.toggle('on', t.dataset.o === curOrigem));
  document.querySelectorAll('.d-fil-item[data-o]').forEach(t => t.classList.toggle('active', t.dataset.o === curOrigem));

  // Atualiza KPIs do sidebar desktop (se existirem)
  const dsTotal   = document.getElementById('ds-total');
  const dsFecTxt  = document.getElementById('ds-fechados');
  const dsConv    = document.getElementById('ds-conv');
  const dsReceita = document.getElementById('ds-receita');
  const total2    = entries.length;
  const fech2     = entries.filter(e => e.Status === 'Fechado').length;
  const rec2      = entries.filter(e => e.Status === 'Fechado').reduce((s,e) => s + (parseFloat(e.ValorFechado) || parseFloat(e.ValorProp) || 0), 0);
  if (dsTotal)   dsTotal.textContent   = total2;
  if (dsFecTxt)  dsFecTxt.textContent  = fech2;
  if (dsConv)    dsConv.textContent    = total2 ? Math.round(fech2/total2*100)+'%' : '—';
  if (dsReceita) dsReceita.textContent = rec2 ? fmtVal(rec2) : '—';

  // Atualiza o period toggle do desktop
  updatePeriodToggle();

  const content = document.getElementById('content');
  if (list.length === 0) {
    content.innerHTML =
      '<div class="empty">' +
        '<span class="ico">' + (curFilter === 'todos' ? '💰' : '🔍') + '</span>' +
        '<p>' + (curFilter === 'todos' ? 'Nenhum orçamento ainda.<br>Toque em <strong>＋</strong> para adicionar.' : 'Nenhum orçamento neste filtro.') + '</p>' +
      '</div>';
    return;
  }

  const groups = [];
  const groupMap = {};
  list.forEach(e => {
    const key = e.DataPedido || '';
    if (!groupMap[key]) { groupMap[key] = []; groups.push({ key, items: groupMap[key] }); }
    groupMap[key].push(e);
  });
  content.innerHTML = groups.map(g =>
    '<div class="date-group">' +
      '<div class="date-group-hdr">' +
        '<span class="date-group-pill">' + fmtDateGroup(g.key) + '</span>' +
        (g.items.length > 1 ? '<span class="date-group-count">' + g.items.length + '</span>' : '') +
        '<span class="date-group-line"></span>' +
      '</div>' +
      g.items.map(renderEntryCard).join('') +
    '</div>'
  ).join('');
}

// ══════════════════════════════════════════════════════════
//  FILTROS
// ══════════════════════════════════════════════════════════
function setF(f) { curFilter = f; render(); }
function setOrigem(v) { curOrigem = v; render(); }
function setSearch(v) { curSearch = v; render(); }
function navMonth(dir) {
  const base = filterMonth ? new Date(filterMonth + '-01T12:00:00') : new Date();
  base.setMonth(base.getMonth() + dir);
  filterMonth = base.getFullYear() + '-' + pad(base.getMonth() + 1);
  render();
}
function clearMonth() { filterMonth = null; render(); }
function setPorMes() {
  if (!filterMonth) navMonth(0);   // navMonth() chama render() → updatePeriodToggle()
}
function updatePeriodToggle() {
  const todos    = document.getElementById('period-todos');
  const porMes   = document.getElementById('period-mes');
  const monthNav = document.getElementById('month-nav-inline');
  const dName    = document.getElementById('d-month-name');
  if (!todos) return;
  if (filterMonth) {
    todos.classList.remove('on'); porMes.classList.add('on');
    if (monthNav) { monthNav.style.opacity = '1'; monthNav.style.pointerEvents = 'auto'; }
    if (dName) {
      const [y, m] = filterMonth.split('-');
      const ms = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
      dName.textContent = ms[parseInt(m)-1] + ' · ' + y;
    }
  } else {
    todos.classList.add('on'); porMes.classList.remove('on');
    if (monthNav) { monthNav.style.opacity = '0.4'; monthNav.style.pointerEvents = 'none'; }
    if (dName) dName.textContent = 'Todos';
  }
}

// ══════════════════════════════════════════════════════════
//  OVERLAY / PANELS
// ══════════════════════════════════════════════════════════
function openPanel(id) {
  document.getElementById('overlay').classList.add('show');
  document.getElementById(id).classList.add('show');
}
function closePanel(id) {
  const p = document.getElementById(id);
  if (p) p.classList.remove('show');
}
function closeAll() {
  document.getElementById('overlay').classList.remove('show');
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('show'));
}

// ══════════════════════════════════════════════════════════
//  NOVO ORÇAMENTO — multi-slot
// ══════════════════════════════════════════════════════════
function openAddForm() {
  document.getElementById('add-nome').value     = '';
  document.getElementById('add-tel').value      = '';
  document.getElementById('add-followup').value = defaultFollowup();
  document.getElementById('add-obs').value      = '';
  document.getElementById('add-origem').value   = 'Produção Social';
  addSlots = [];
  addAddSlot();
  openPanel('panel-add');
}

function addAddSlot() {
  const first = services[0] || { nome: '', valor: 0 };
  addSlots.push({
    id: Date.now() + Math.random(),
    servico: first.nome || '',
    valorUnit: first.valor || 0,
    data: '',
    horario: '',
  });
  renderAddSlots();
  recalcAddTotal();
}

function removerAddSlot(id) {
  if (addSlots.length <= 1) { toast('⚠️ Pelo menos um serviço é necessário'); return; }
  addSlots = addSlots.filter(s => s.id !== id);
  renderAddSlots();
  recalcAddTotal();
}

function renderAddSlots() {
  const list = document.getElementById('add-slots-list');
  list.innerHTML = addSlots.map((s, idx) => {
    const opts = services.map(svc =>
      '<option value="' + esc(svc.nome) + '"' + (svc.nome === s.servico ? ' selected' : '') + '>' + esc(svc.nome) + '</option>'
    ).join('');
    return (
      '<div class="slot-row">' +
        '<div class="slot-num">' + (idx + 1) + '</div>' +
        '<div class="slot-fields">' +
          '<select class="form-input" onchange="syncAddSlot(' + s.id + ', \'servico\', this.value)">' +
            '<option value="">— Selecione o serviço —</option>' +
            opts +
          '</select>' +
          '<div class="form-row">' +
            '<input class="form-input" type="number" step="0.01" min="0" placeholder="R$ valor" value="' + (s.valorUnit || '') + '" oninput="syncAddSlot(' + s.id + ', \'valorUnit\', this.value)">' +
            '<input class="form-input" type="date" value="' + (s.data || '') + '" oninput="syncAddSlot(' + s.id + ', \'data\', this.value)">' +
          '</div>' +
          '<input class="form-input" type="time" placeholder="Horário" value="' + (s.horario || '') + '" oninput="syncAddSlot(' + s.id + ', \'horario\', this.value)">' +
        '</div>' +
        (addSlots.length > 1
          ? '<button class="slot-del" onclick="removerAddSlot(' + s.id + ')" title="Remover">✕</button>'
          : '<div style="width:26px"></div>') +
      '</div>');
  }).join('');
}

function syncAddSlot(id, campo, valor) {
  const s = addSlots.find(x => x.id === id);
  if (!s) return;
  if (campo === 'servico') {
    s.servico = valor;
    const svc = services.find(x => x.nome === valor);
    if (svc && !s._manual) s.valorUnit = svc.valor || 0;
    renderAddSlots();
  } else if (campo === 'valorUnit') {
    s.valorUnit = parseFloat(valor) || 0;
    s._manual = true;
  } else {
    s[campo] = valor;
  }
  recalcAddTotal();
}

function recalcAddTotal() {
  const total = addSlots.reduce((sum, s) => sum + (parseFloat(s.valorUnit) || 0), 0);
  document.getElementById('add-valor').value = total ? fmt(total) : '';
}

function descreveSlots(slots) {
  if (!slots || !slots.length) return '';
  const grupos = {};
  slots.forEach(s => {
    const key = s.servico || 'Serviço';
    if (!grupos[key]) grupos[key] = [];
    if (s.data) grupos[key].push(fmtDate(s.data));
  });
  return Object.entries(grupos).map(([nome, datas]) => {
    if (!datas.length) return nome;
    return nome + ' (' + datas.join(', ') + ')';
  }).join(', ');
}

async function saveNew() {
  const nome   = document.getElementById('add-nome').value.trim();
  const tel    = document.getElementById('add-tel').value.trim();
  const obs    = document.getElementById('add-obs').value.trim();
  const fu     = document.getElementById('add-followup').value;
  const origem = document.getElementById('add-origem').value;

  if (!nome) { toast('⚠️ Informe o nome do cliente'); return; }
  if (!tel)  { toast('⚠️ Informe o telefone'); return; }
  const slotsValidos = addSlots.filter(s => s.servico);
  if (!slotsValidos.length) { toast('⚠️ Adicione pelo menos um serviço'); return; }

  const total = slotsValidos.reduce((s, x) => s + (parseFloat(x.valorUnit) || 0), 0);
  const servicoDesc = descreveSlots(slotsValidos);
  const datasOrdenadas = slotsValidos.map(s => s.data).filter(Boolean).sort();
  const dataEvento = datasOrdenadas[0] || '';

  const slotsToStore = slotsValidos.map(s => ({
    servico: s.servico,
    valorUnit: parseFloat(s.valorUnit) || 0,
    data: s.data || '',
    horario: s.horario || '',
  }));

  const entry = {
    ID:           String(Date.now()),
    DataPedido:   todayStr(),
    Cliente:      nome,
    Telefone:     tel,
    Servico:      servicoDesc,
    ValorProp:    total,
    Status:       'Novo Pedido',
    DataEnvio:    '',
    DataFechamento: '',
    ProxFollowup: fu || defaultFollowup(),
    ValorFechado:'',
    Obs:          packSlots(obs, slotsToStore),
    Origem:       origem,
    DataEvento:   dataEvento,
    DataCriacao:  todayStr(),
  };

  entries.unshift(entry);
  cacheEntries();
  closeAll();
  render();
  toast('✅ Orçamento salvo!');

  const result = await postEntry({ action: 'save', entry });
  if (!result.ok && result.error !== 'no-url') {
    toast('⚠️ Salvo localmente, falha ao sincronizar');
  } else if (result.ok) {
    dot('ok');
  }
}

// ══════════════════════════════════════════════════════════
//  ACTION SHEET
// ══════════════════════════════════════════════════════════
function openAction(id) {
  closePanel('panel-add');
  closePanel('panel-fechar');
  closePanel('panel-confirmacao');

  const e = entries.find(x => String(x.ID) === String(id));
  if (!e) return;
  activeId = id;

  document.getElementById('act-avatar').textContent = initials(e.Cliente);
  document.getElementById('act-name').textContent   = e.Cliente || '—';
  document.getElementById('act-phone').textContent  = e.Telefone || 'Sem telefone';

  const badge = document.getElementById('act-badge');
  badge.textContent = e.Status || '—';
  badge.className = 'badge ' + (STATUS_CLASS[e.Status] || 'st-novo');

  const meta = [];
  if (e.Servico)    meta.push(e.Servico);
  if (e.ValorProp)  meta.push(fmtVal(parseFloat(e.ValorProp)));
  if (e.DataEvento) meta.push('Evento: ' + fmtDate(e.DataEvento));
  document.getElementById('act-meta').textContent = meta.join(' · ');

  document.querySelectorAll('#status-grid .st-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.s === e.Status));

  document.getElementById('val-fechado-row').style.display = e.Status === 'Fechado' ? 'block' : 'none';
  document.getElementById('act-val-fechado').value = e.ValorFechado || '';
  document.getElementById('act-val-enviado').value = e.ValorProp || '';
  document.getElementById('act-followup').value = e.ProxFollowup || '';
  document.getElementById('act-obs').value      = entryCleanObs(e);

  // Carrega o picker de follow-up
  renderFollowupPicker(id);

  renderActGcalSection(e);
  renderActCompSection(String(id));
  renderActPropostaSection(e);
  openPanel('panel-action');
}

function setStatus(btn) {
  const e = entries.find(x => String(x.ID) === String(activeId));
  if (!e) return;
  const newStatus = btn.dataset.s;
  e.Status = newStatus;
  document.querySelectorAll('#status-grid .st-btn').forEach(b => b.classList.toggle('active', b === btn));
  const badge = document.getElementById('act-badge');
  badge.textContent = newStatus;
  badge.className = 'badge ' + (STATUS_CLASS[newStatus] || 'st-novo');
  if (newStatus === 'Orçamento Enviado' && !e.DataEnvio) e.DataEnvio = todayStr();
  if (newStatus === 'Fechado' && !e.DataFechamento)     e.DataFechamento = todayStr();
  document.getElementById('val-fechado-row').style.display = newStatus === 'Fechado' ? 'block' : 'none';
  cacheEntries();
  render();
}

async function updateFollowup() {
  const e = entries.find(x => String(x.ID) === String(activeId));
  if (!e) return;
  e.ProxFollowup = document.getElementById('act-followup').value;
  cacheEntries();
  render();
}

async function saveAction() {
  const e = entries.find(x => String(x.ID) === String(activeId));
  if (!e) return;
  const newObs = document.getElementById('act-obs').value;
  const existingSlots = entrySlots(e);
  e.Obs = packSlots(newObs, existingSlots);
  e.ProxFollowup = document.getElementById('act-followup').value;
  const vf = document.getElementById('act-val-fechado').value;
  const ve = document.getElementById('act-val-enviado').value;
  if (e.Status === 'Fechado' && vf) e.ValorFechado = vf;
  if (ve) e.ValorProp = ve;

  // Salvar propostas se for noiva (por origem ou serviço)
  if (isNoivaEntry(e) && actPropostas.length > 0) {
    e.Propostas = actPropostas;
  }

  cacheEntries();
  closeAll();
  render();
  toast('✅ Alterações salvas');

  const fields = {
    Status:        e.Status,
    DataEnvio:     e.DataEnvio,
    DataFechamento:e.DataFechamento,
    ProxFollowup:  e.ProxFollowup,
    ValorFechado:  e.ValorFechado,
    ValorProp:     e.ValorProp,
    Obs:           e.Obs,
    Propostas:     e.Propostas,
  };
  const result = await postEntry({ action: 'update', id: e.ID, fields });
  if (!result.ok && result.error !== 'no-url') {
    toast('⚠️ Sincronização falhou');
  }
}

async function excluirOrcamento() {
  if (!confirm('Excluir este orçamento? Esta ação não pode ser desfeita.')) return;
  const idToDelete = String(activeId);

  // 1) Marca como excluído no localStorage como salvaguarda
  //    (impede que o syncAll traga de volta mesmo se o servidor demorar)
  addDeletedId(idToDelete);

  // 2) Remove da lista local e atualiza a UI imediatamente
  entries = entries.filter(e => String(e.ID) !== idToDelete);
  cacheEntries();
  closeAll();
  render();
  toast('🗑 Orçamento excluído');

  // 3) Envia o delete para o servidor (Apps Script)
  //    O deletedIds PERMANECE no localStorage independente da resposta,
  //    impedindo que o orçamento reapareça em qualquer dispositivo durante o sync.
  const result = await postEntry({ action: 'delete', id: idToDelete });
  if (!result.ok && result.error !== 'no-url') {
    toast('⚠️ Falha ao excluir da planilha — verifique o Apps Script');
  }
}

function openWhatsApp() {
  const e = entries.find(x => String(x.ID) === String(activeId));
  if (!e) return;
  const tmpl = getWaTemplate(e);
  const phone = formatPhone(e.Telefone);
  const url = 'https://wa.me/' + phone + '?text=' + encodeURIComponent(tmpl.text);
  window.open(url, '_blank');
  if (!e.DataEnvio) {
    e.DataEnvio = todayStr();
    cacheEntries();
  }
}

// ══════════════════════════════════════════════════════════
//  FECHAR E AGENDAR TUDO
// ══════════════════════════════════════════════════════════
function abrirFechamento() {
  const e = entries.find(x => String(x.ID) === String(activeId));
  if (!e) return;

  closePanel('panel-action');
  fechSinalManual = false;
  fechLocal = 'studio';
  fechSinalRecebido = true;
  fechPropostas = e.Propostas || [];

  document.getElementById('fech-nome').textContent = e.Cliente || '';
  document.getElementById('fech-addr').value = '';
  document.getElementById('fech-obs').value  = entryCleanObs(e);
  document.getElementById('fech-origem').value = e.Origem || 'Produção Social';
  document.getElementById('fech-forma').value  = 'PIX';
  document.getElementById('fech-valor-enviado').value = e.ValorProp || '';

  const existingSlots = entrySlots(e);
  fechSlots = existingSlots.length
    ? existingSlots.map(s => Object.assign({}, s, { id: Date.now() + Math.random() }))
    : [{ id: Date.now(), servico: (services[0] && services[0].nome) || '', valorUnit: (services[0] && services[0].valor) || 0, data: e.DataEvento || '', horario: '' }];
  renderFechSlots();

  const totalSlots = fechSlots.reduce((s, x) => s + (parseFloat(x.valorUnit) || 0), 0);
  const totalFinal = totalSlots || parseFloat(e.ValorFechado) || parseFloat(e.ValorProp) || 0;
  document.getElementById('fech-total').value = totalFinal || '';
  calcFechSinal();

  document.querySelectorAll('[data-local]').forEach(b => b.classList.toggle('on', b.dataset.local === 'studio'));
  document.getElementById('fech-addr-row').classList.remove('show');
  // Auto-detect local a partir do serviço pré-preenchido
  const _primarySvc = (fechSlots[0] && fechSlots[0].servico) || '';
  if (_primarySvc) autoDetectLocal(_primarySvc);
  document.querySelectorAll('[data-ss]').forEach(b => {
    b.classList.remove('on', 'on-ok');
    if (b.dataset.ss === 'recebido') b.classList.add('on-ok');
  });

  updatePropostaSection();
  renderFechPropostas();
  openPanel('panel-fechar');
}

function voltarFechamento() {
  closePanel('panel-fechar');
  openAction(activeId);
}

function updatePropostaSection() {
  const origem = document.getElementById('fech-origem').value;
  const section = document.getElementById('fech-proposta-section');
  if (section) {
    section.style.display = origem === 'Noiva' ? 'block' : 'none';
  }
}

function renderFechPropostas() {
  const list = document.getElementById('fech-proposta-list');
  if (!list) return;
  if (fechPropostas.length === 0) {
    list.innerHTML = '<p style="font-size:0.75rem;color:var(--muted);margin:0 0 8px">Nenhuma proposta anexada</p>';
  } else {
    const trash = (window.SVG && window.SVG.trash) ? window.SVG.trash : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path></svg>';
    list.innerHTML = fechPropostas.map(p => `
      <div style="display:flex;align-items:center;gap:8px;padding:8px;background:#fafafa;border-radius:8px;margin-bottom:6px">
        <span style="flex:1;font-size:0.85rem;color:var(--brown);word-break:break-word">${esc(p.nome || 'proposta')}</span>
        <a href="${esc(p.link || '#')}" target="_blank" rel="noopener" style="font-size:0.75rem;color:#1976d2;padding:4px 8px;border-radius:4px;background:#e3f2fd;text-decoration:none;white-space:nowrap">📄 Ver</a>
        <button class="delbtn" style="width:24px;height:24px;flex-shrink:0;padding:0;border:none;background:none;cursor:pointer" type="button" onclick="deleteFechProposta('${esc(p.fileId || '')}');" title="Remover">${trash}</button>
      </div>`).join('');
  }
}

async function uploadOrcProposal() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/pdf,image/*';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    toast('Enviando proposta...');
    try {
      const b64 = await fileToBase64(file);
      const result = await DB.storage.uploadComprovante(activeId, file, 'PROPOSTA', b64, file.type);
      fechPropostas.push({ fileId: result.fileId, link: result.link, nome: file.name, ts: Date.now() });
      renderFechPropostas();
      toast('Proposta anexada!');
    } catch(err) {
      toast('Erro ao enviar: ' + err.message);
    }
  };
  input.click();
}

function deleteFechProposta(fileId) {
  if (!confirm('Remover esta proposta?')) return;
  fechPropostas = fechPropostas.filter(p => p.fileId !== fileId);
  try { DB.storage.deleteComprovante(fileId); } catch(_) {}
  renderFechPropostas();
  toast('Proposta removida');
}

function addFechSlot() {
  const first = services[0] || { nome: '', valor: 0 };
  fechSlots.push({
    id: Date.now() + Math.random(),
    servico: first.nome || '',
    valorUnit: first.valor || 0,
    data: '',
    horario: '',
  });
  renderFechSlots();
  recalcFechTotalFromSlots();
}

function removerFechSlot(id) {
  if (fechSlots.length <= 1) { toast('⚠️ Pelo menos uma data é necessária'); return; }
  fechSlots = fechSlots.filter(s => s.id !== id);
  renderFechSlots();
  recalcFechTotalFromSlots();
}

function renderFechSlots() {
  const list = document.getElementById('fech-slots-list');
  list.innerHTML = fechSlots.map((s, idx) => {
    const opts = services.map(svc =>
      '<option value="' + esc(svc.nome) + '"' + (svc.nome === s.servico ? ' selected' : '') + '>' + esc(svc.nome) + '</option>'
    ).join('');
    return (
      '<div class="slot-row">' +
        '<div class="slot-num">' + (idx + 1) + '</div>' +
        '<div class="slot-fields">' +
          '<select class="form-input" onchange="syncFechSlot(' + s.id + ', \'servico\', this.value)">' +
            '<option value="">— Selecione o serviço —</option>' +
            opts +
          '</select>' +
          '<div class="form-row">' +
            '<input class="form-input" type="number" step="0.01" min="0" placeholder="R$ valor" value="' + (s.valorUnit || '') + '" oninput="syncFechSlot(' + s.id + ', \'valorUnit\', this.value)">' +
            '<input class="form-input" type="date" value="' + (s.data || '') + '" oninput="syncFechSlot(' + s.id + ', \'data\', this.value)">' +
          '</div>' +
          '<input class="form-input" type="time" placeholder="Horário" value="' + (s.horario || '') + '" oninput="syncFechSlot(' + s.id + ', \'horario\', this.value)">' +
        '</div>' +
        (fechSlots.length > 1
          ? '<button class="slot-del" onclick="removerFechSlot(' + s.id + ')" title="Remover">✕</button>'
          : '<div style="width:26px"></div>') +
      '</div>');
  }).join('');
}

function autoDetectLocal(servName) {
  const low = (servName || '').toLowerCase();
  if (low.includes('domicílio') || low.includes('domicilio')) {
    const btn = document.querySelector('[data-local="domicilio"]');
    if (btn && fechLocal !== 'domicilio') setFechLocal(btn);
  } else if (low.includes('studio') || low.includes('estúdio') || low.includes('estudio')) {
    const btn = document.querySelector('[data-local="studio"]');
    if (btn && fechLocal !== 'studio') setFechLocal(btn);
  }
}

function syncFechSlot(id, campo, valor) {
  const s = fechSlots.find(x => x.id === id);
  if (!s) return;
  if (campo === 'servico') {
    s.servico = valor;
    const svc = services.find(x => x.nome === valor);
    if (svc && !s._manual) s.valorUnit = svc.valor || 0;
    autoDetectLocal(valor);
    renderFechSlots();
  } else if (campo === 'valorUnit') {
    s.valorUnit = parseFloat(valor) || 0;
    s._manual = true;
  } else {
    s[campo] = valor;
  }
  recalcFechTotalFromSlots();
}

function recalcFechTotalFromSlots() {
  const total = fechSlots.reduce((sum, s) => sum + (parseFloat(s.valorUnit) || 0), 0);
  if (total > 0) {
    document.getElementById('fech-total').value = total.toFixed(2);
    calcFechSinal();
  }
}

function setFechLocal(btn) {
  fechLocal = btn.dataset.local;
  document.querySelectorAll('[data-local]').forEach(b => b.classList.toggle('on', b === btn));
  document.getElementById('fech-addr-row').classList.toggle('show', fechLocal === 'domicilio');
}

function setFechSinalStatus(btn) {
  fechSinalRecebido = btn.dataset.ss === 'recebido';
  document.querySelectorAll('[data-ss]').forEach(b => {
    b.classList.remove('on', 'on-ok');
    if (b === btn) b.classList.add(fechSinalRecebido ? 'on-ok' : 'on');
  });
}

function calcFechSinal() {
  const total = parseFloat(document.getElementById('fech-total').value) || 0;
  if (!fechSinalManual) {
    const sinal = Math.round(total * 0.30 * 100) / 100;
    document.getElementById('fech-sinal').value = sinal ? sinal.toFixed(2) : '';
  }
  calcFechSaldo();
}

function calcFechSaldo() {
  const total = parseFloat(document.getElementById('fech-total').value) || 0;
  const sinal = parseFloat(document.getElementById('fech-sinal').value) || 0;
  const saldo = Math.max(0, total - sinal);
  document.getElementById('fech-saldo').value = saldo ? saldo.toFixed(2) : '';
}

async function confirmarFechamento() {
  const e = entries.find(x => String(x.ID) === String(activeId));
  if (!e) return;

  const slotsValidos = fechSlots.filter(s => s.servico);
  if (!slotsValidos.length) { toast('⚠️ Adicione pelo menos um serviço'); return; }

  const total = parseFloat(document.getElementById('fech-total').value) || 0;
  const sinal = parseFloat(document.getElementById('fech-sinal').value) || 0;
  const saldo = parseFloat(document.getElementById('fech-saldo').value) || 0;
  const forma = document.getElementById('fech-forma').value;
  const origem = document.getElementById('fech-origem').value;
  const obs   = document.getElementById('fech-obs').value.trim();

  if (total <= 0) { toast('⚠️ Informe o valor total'); return; }

  const endereco = fechLocal === 'studio'
    ? END_STUDIO
    : (document.getElementById('fech-addr').value.trim() || '');

  if (fechLocal === 'domicilio' && !endereco) {
    toast('⚠️ Informe o endereço da cliente'); return;
  }

  // ── Ativa loading e bloqueia o botão ──
  const fechBtn = document.getElementById('fech-confirm-btn');
  if (fechBtn) fechBtn.disabled = true;
  showLoading('Fechando orçamento...', 'Salvando na planilha');
  setLoadingStep(0, 'Salvando orçamento...', 'Atualizando dados');

  try {

  // 1) Atualiza orçamento localmente
  const slotsToStore = slotsValidos.map(s => ({
    servico: s.servico,
    valorUnit: parseFloat(s.valorUnit) || 0,
    data: s.data || '',
    horario: s.horario || '',
  }));
  const datasOrdenadas = slotsValidos.map(s => s.data).filter(Boolean).sort();
  const valorEnviado = document.getElementById('fech-valor-enviado').value;
  e.Status         = 'Fechado';
  e.ValorFechado   = total;
  e.ValorProp      = valorEnviado || total;
  e.DataFechamento = todayStr();
  e.DataEvento     = datasOrdenadas[0] || e.DataEvento || '';
  e.Servico        = descreveSlots(slotsValidos);
  e.Obs            = packSlots(obs, slotsToStore);
  e.Origem         = origem;
  e.EnderecoEvento = endereco;
  e.LocalTipo      = fechLocal;
  e.SinalFech      = sinal;
  e.SaldoFech      = saldo;
  e.Propostas      = fechPropostas;
  e.AgendaCriada   = false;
  cacheEntries();

  // 2) Sincroniza com a planilha de orçamentos
  const updResult = await postEntry({
    action: 'update', id: e.ID,
    fields: {
      Status:         e.Status,
      ValorFechado:   e.ValorFechado,
      ValorProp:      e.ValorProp,
      DataFechamento: e.DataFechamento,
      DataEvento:     e.DataEvento,
      Servico:        e.Servico,
      Obs:            e.Obs,
      Origem:         e.Origem,
      Propostas:      e.Propostas,
    },
  });

  setLoadingStep(1, 'Lançando no financeiro...', 'Registrando sinal e restante');

  // 3) Lança Sinal + Restante no Financeiro (Supabase)
  let finResult = { ok: true };
  const local = fechLocal === 'studio' ? 'Studio' : 'Domicílio';
  const dataEvento = e.DataEvento || todayStr();
  const dataPagSinal = fechSinalRecebido ? todayStr() : dataEvento;

  if (sinal > 0) {
    const eSinal = {
      id: String(Date.now()),
      dataPag: dataPagSinal,
      dataServ: dataEvento,
      cliente: e.Cliente,
      tipo: 'Sinal',
      valor: sinal.toFixed(2),
      valorTotal: total.toFixed(2),
      servico: e.Servico,
      local: local,
      forma: forma,
      status: fechSinalRecebido ? 'Realizado' : 'Previsto',
      origem: origem,
      obs: 'Sinal — Orçamento ' + e.ID,
      auto: false,
      createdAt: new Date().toISOString(),
      noivaId: ''
    };
    const r1 = await finEntryCreate(eSinal);
    if (!r1.ok) finResult = { ok: false, error: r1.error || 'sinal' };
  }
  if (saldo > 0) {
    const eSaldo = {
      id: String(Date.now() + 1),
      dataPag: dataEvento,
      dataServ: dataEvento,
      cliente: e.Cliente,
      tipo: 'Pagamento',
      valor: saldo.toFixed(2),
      valorTotal: '',
      servico: e.Servico,
      local: local,
      forma: forma,
      status: 'Previsto',
      origem: origem,
      obs: 'Restante (sinal: R$ ' + fmt(sinal) + ') — Orçamento ' + e.ID,
      auto: true,
      createdAt: new Date().toISOString(),
      noivaId: ''
    };
    const r2 = await finEntryCreate(eSaldo);
    if (!r2.ok && finResult.ok) finResult = { ok: false, error: r2.error || 'saldo' };
  }

  setLoadingStep(2, 'Preparando confirmação...', 'Quase lá!');

  // 4) Prepara dados para Google Agenda + WhatsApp
  const eventos = buildEventos(e.Cliente, slotsValidos, endereco, total, sinal, saldo, e.Telefone);
  const waText  = buildConfirmacaoMessage(e.Cliente, slotsValidos, total, sinal, saldo, endereco, fechLocal);

  lastFechamento = {
    entryId: e.ID,
    cliente: e.Cliente,
    telefone: e.Telefone,
    eventos: eventos,
    waText: waText,
    finResult: finResult,
    sheetResult: updResult,
    saldoCriado: saldo > 0,
    sinalCriado: sinal > 0,
  };

  hideLoading();
  if (fechBtn) fechBtn.disabled = false;
  closePanel('panel-fechar');
  abrirSucesso();
  render();

  } catch(err) {
    hideLoading();
    if (fechBtn) fechBtn.disabled = false;
    toast('⚠️ Erro ao processar: ' + (err.message || 'tente novamente'));
  }
}

// ══════════════════════════════════════════════════════════
//  PAINEL DE SUCESSO
// ══════════════════════════════════════════════════════════
function abrirSucesso() {
  const f = lastFechamento;
  if (!f) return;
  document.getElementById('conf-client').textContent = f.cliente || '';

  const list = document.getElementById('conf-list');
  const items = [];
  if (f.sheetResult && f.sheetResult.ok) items.push({ tipo: 'ok', txt: '✅ Orçamento marcado como Fechado' });
  else if (f.sheetResult && f.sheetResult.error === 'no-url') items.push({ tipo: 'warn', txt: '⚠️ Sheet de orçamentos não configurado' });
  else items.push({ tipo: 'warn', txt: '⚠️ Salvo localmente (sincronizar depois)' });

  if (false) { // removido: integração financeiro agora via Supabase direto
    items.push({ tipo: 'warn', txt: '' });
  } else if (f.finResult.ok) {
    const parts = [];
    if (f.sinalCriado) parts.push('Sinal');
    if (f.saldoCriado) parts.push('Restante (previsto)');
    items.push({ tipo: 'ok', txt: '✅ Financeiro: ' + parts.join(' + ') + ' lançados' });
  } else {
    items.push({ tipo: 'err', txt: '❌ Erro ao lançar no Financeiro' });
  }
  items.push({ tipo: 'warn', txt: '📅 Clique em "Adicionar ao Google Agenda" abaixo' });

  list.innerHTML = items.map(it =>
    '<div class="success-item ' + it.tipo + '">' + esc(it.txt) + '</div>'
  ).join('');

  document.getElementById('conf-wa-text').textContent = f.waText || '';
  const gcalStatus = document.getElementById('conf-gcal-status');
  gcalStatus.className = 'gcal-status'; gcalStatus.textContent = '';
  const gcalBtn = document.getElementById('conf-gcal-btn');
  gcalBtn.classList.remove('ok');
  gcalBtn.textContent = '📅 Adicionar ao Google Agenda';

  openPanel('panel-confirmacao');
}

async function abrirGcalConfirmacao() {
  const f = lastFechamento;
  if (!f) return;
  const statusEl = document.getElementById('conf-gcal-status');
  const btn      = document.getElementById('conf-gcal-btn');

  const validos = f.eventos.filter(ev => ev.startISO && ev.endISO);
  if (!validos.length) {
    statusEl.className = 'gcal-status err';
    statusEl.textContent = 'Preencha data e horário antes de adicionar à agenda.';
    return;
  }

  if (coworkDisponivel) {
    btn.disabled = true;
    const r = await salvarEventosDireto(validos, statusEl);
    btn.disabled = false;
    if (r.ok) {
      marcarAgendaCriada(lastFechamento.entryId);
      btn.classList.add('ok');
      btn.textContent = '✓ Eventos salvos!';
      setTimeout(() => {
        btn.classList.remove('ok');
        btn.textContent = '📅 Adicionar ao Google Agenda';
      }, 4000);
    }
  } else {
    abrirEventosNoNavegador(validos, statusEl);
    marcarAgendaCriada(lastFechamento.entryId);
    btn.classList.add('ok');
    btn.textContent = '✓ Agenda aberta!';
    setTimeout(() => {
      btn.classList.remove('ok');
      btn.textContent = '📅 Adicionar ao Google Agenda';
    }, 4000);
  }
}

function sendConfirmationWA() {
  const f = lastFechamento;
  if (!f) return;
  const phone = formatPhone(f.telefone);
  const url = 'https://wa.me/' + phone + '?text=' + encodeURIComponent(f.waText || '');
  window.open(url, '_blank');
}

function copiarMensagem() {
  const f = lastFechamento;
  if (!f) return;
  navigator.clipboard.writeText(f.waText || '').then(() => toast('📋 Mensagem copiada'));
}

// ══════════════════════════════════════════════════════════
//  SETTINGS — Conexões + Serviços
// ══════════════════════════════════════════════════════════
function openSettings() {
  document.getElementById('cfg-cal-id').value  = localStorage.getItem('orca_cal_id')  || DEFAULT_CAL_ID;
  // Atualizar status do Supabase a partir do estado real
  const note = document.getElementById('sb-status-note');
  if (note) {
    note.textContent = { ok:'🟢 Supabase conectado', syncing:'🟡 Sincronizando...', offline:'🔴 Sem conexão' }[_syncState] || '⚪ Status desconhecido';
  }
  setSettingsTab('conex');
  renderServices();
  openPanel('panel-settings');
}

function setSettingsTab(tab) {
  document.querySelectorAll('.settings-tab').forEach(t =>
    t.classList.toggle('on', t.dataset.tab === tab));
  document.getElementById('settings-tab-conex').style.display     = tab === 'conex'     ? 'block' : 'none';
  document.getElementById('settings-tab-servicos').style.display  = tab === 'servicos'  ? 'block' : 'none';
  document.getElementById('settings-tab-followups').style.display = tab === 'followups' ? 'block' : 'none';
  if (tab === 'followups') renderFollowupSettings();
  if (tab === 'servicos')  renderServices();
}

function saveSettings() {
  const calId = document.getElementById('cfg-cal-id').value.trim();
  if (calId) localStorage.setItem('orca_cal_id', calId); else localStorage.removeItem('orca_cal_id');
  toast('✅ Configurações salvas');
  syncAll();
}

function renderServices() {
  const list = document.getElementById('svc-list');
  list.innerHTML = services.map((svc, idx) =>
    '<div class="svc-row">' +
      '<input class="svc-name" type="text" value="' + esc(svc.nome) + '" placeholder="Nome do serviço" oninput="services[' + idx + '].nome = this.value; cacheServices();">' +
      '<input class="svc-val"  type="number" step="0.01" min="0" value="' + (svc.valor || '') + '" placeholder="R$ 0,00" oninput="services[' + idx + '].valor = parseFloat(this.value) || 0; cacheServices();">' +
      '<button class="svc-del" onclick="removeService(' + idx + ')" title="Remover">✕</button>' +
    '</div>'
  ).join('');
}

function addService() {
  services.push({ nome: '', valor: 0, duracao: 60 });
  cacheServices();
  renderServices();
}

async function removeService(idx) {
  const removed = services[idx];
  services.splice(idx, 1);
  cacheServices();
  renderServices();
  // Remove do Supabase se tinha nome
  if (removed && removed.nome && removed.nome.trim()) {
    try { await DB.valoresServicos.remove(removed.nome); }
    catch(e) { console.warn('[serviços] erro ao remover:', e.message); }
  }
}

async function saveServices() {
  services = services.filter(s => s.nome && s.nome.trim());
  cacheServices();
  renderServices();
  dot('syncing');
  try {
    await DB.valoresServicos.saveAll(services);
    dot('ok');
    toast('✅ Serviços salvos');
  } catch(e) {
    console.warn('[serviços] erro ao salvar no Supabase:', e.message);
    dot('offline');
    toast('Salvo localmente (Supabase offline)');
  }
}

// ══════════════════════════════════════════════════════════
//  GERAR LINK DE ACESSO (compartilhar URL entre dispositivos)
// ══════════════════════════════════════════════════════════
function gerarLinkAcesso() {
  const link = location.href.split('?')[0];
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(link).then(() => {
      toast('📋 Link copiado!');
    }).catch(() => prompt('Link do sistema:', link));
  } else {
    prompt('Link do sistema:', link);
  }
}

// ══════════════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
//  AGENDA — status e ação autônoma
// ══════════════════════════════════════════════════════════
function getAgendaCriada(e) {
  return e.AgendaCriada === true || e.AgendaCriada === 'true';
}

function marcarAgendaCriada(id) {
  const e = entries.find(x => String(x.ID) === String(id));
  if (!e) return;
  e.AgendaCriada = true;
  cacheEntries();
  render();
  postEntry({ action: 'update', id: e.ID, fields: { AgendaCriada: 'true' } });
}

function renderActGcalSection(e) {
  const section  = document.getElementById('act-gcal-section');
  const fechArea = document.getElementById('act-fech-btn-area');
  if (!section) return;

  if (e.Status !== 'Fechado') {
    section.style.display = 'none';
    if (fechArea) fechArea.style.display = 'block';
    return;
  }

  // Só oculta "Fechar e Agendar" se o fluxo completo já foi executado
  // (SinalFech é gravado apenas pelo painel de fechamento)
  const fluxoCompleto = e.SinalFech !== undefined && e.SinalFech !== '' && e.SinalFech !== '0';
  if (fechArea) fechArea.style.display = fluxoCompleto ? 'none' : 'block';

  // Google Agenda sempre visível para fechados
  section.style.display = 'block';

  if (getAgendaCriada(e)) {
    const btn = document.getElementById('act-gcal-btn');
    const res = document.getElementById('act-gcal-result');
    if (btn) {
      btn.textContent = '✓ Evento já adicionado à Agenda';
      btn.classList.add('ok');
      btn.disabled = true;
    }
    if (res) { res.className = 'gcal-status'; res.textContent = ''; }
  } else {
    const btn = document.getElementById('act-gcal-btn');
    const res = document.getElementById('act-gcal-result');
    if (btn) { btn.textContent = '📅 Adicionar ao Google Agenda'; btn.classList.remove('ok'); btn.disabled = false; }
    if (res) { res.className = 'gcal-status'; res.textContent = ''; }
  }
}

function isNoivaEntry(e) {
  if (!e) return false;
  if (e.Origem === 'Noiva') return true;
  const servico = String(e.Servico || '').toLowerCase();
  return servico.includes('noiva');
}

function renderActPropostaSection(e) {
  const section = document.getElementById('act-proposta-section');
  if (!section) return;

  const isNoiva = isNoivaEntry(e);
  section.style.display = isNoiva ? 'block' : 'none';

  if (!isNoiva) return;

  actPropostas = (e.Propostas && Array.isArray(e.Propostas)) ? e.Propostas : [];
  renderActPropostas();
}

function renderActPropostas() {
  const list = document.getElementById('act-proposta-list');
  if (!list) return;
  if (actPropostas.length === 0) {
    list.innerHTML = '<p style="font-size:0.75rem;color:var(--muted);margin:0 0 8px">Nenhuma proposta anexada</p>';
  } else {
    const trash = (window.SVG && window.SVG.trash) ? window.SVG.trash : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path></svg>';
    list.innerHTML = actPropostas.map(p => `
      <div style="display:flex;align-items:center;gap:8px;padding:8px;background:#fafafa;border-radius:8px;margin-bottom:6px">
        <span style="flex:1;font-size:0.85rem;color:var(--brown);word-break:break-word">${esc(p.nome || 'proposta')}</span>
        <a href="${esc(p.link || '#')}" target="_blank" rel="noopener" style="font-size:0.75rem;color:#1976d2;padding:4px 8px;border-radius:4px;background:#e3f2fd;text-decoration:none;white-space:nowrap">📄 Ver</a>
        <button class="delbtn" style="width:24px;height:24px;flex-shrink:0;padding:0;border:none;background:none;cursor:pointer" type="button" onclick="deleteActProposta('${esc(p.fileId || '')}');" title="Remover">${trash}</button>
      </div>`).join('');
  }
}

async function uploadActProposal() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/pdf,image/*';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    toast('Enviando proposta...');
    try {
      const b64 = await fileToBase64(file);
      const result = await DB.storage.uploadComprovante(activeId, file, 'PROPOSTA', b64, file.type);
      actPropostas.push({ fileId: result.fileId, link: result.link, nome: file.name, ts: Date.now() });
      renderActPropostas();
      toast('Proposta anexada!');
    } catch(err) {
      toast('Erro ao enviar: ' + err.message);
    }
  };
  input.click();
}

function deleteActProposta(fileId) {
  if (!confirm('Remover esta proposta?')) return;
  actPropostas = actPropostas.filter(p => p.fileId !== fileId);
  try { DB.storage.deleteComprovante(fileId); } catch(_) {}
  renderActPropostas();
  toast('Proposta removida');
}

async function adicionarAgendaDeAction() {
  const e = entries.find(x => String(x.ID) === String(activeId));
  if (!e) return;

  const slots = entrySlots(e);
  if (!slots.length) { toast('⚠️ Sem dados de serviço para criar o evento'); return; }

  // Recuperar dados armazenados no fechamento
  const localTipoSalvo = e.LocalTipo || 'studio';
  fechLocal = localTipoSalvo; // atualiza global para buildEventos usar título correto
  const endereco = e.EnderecoEvento || (localTipoSalvo === 'studio' ? END_STUDIO : '');
  const total = parseFloat(e.ValorFechado) || 0;
  const sinal = parseFloat(e.SinalFech)    || Math.round(total * 0.30 * 100) / 100;
  const saldo = parseFloat(e.SaldoFech)    || Math.max(0, total - sinal);

  const eventos = buildEventos(e.Cliente, slots, endereco, total, sinal, saldo, e.Telefone);
  const validos = eventos.filter(ev => ev.startISO && ev.endISO);

  if (!validos.length) {
    toast('⚠️ Preencha data e horário nos serviços para poder agendar');
    return;
  }

  const statusEl = document.getElementById('act-gcal-result');
  const btn      = document.getElementById('act-gcal-btn');
  if (btn) btn.disabled = true;

  if (coworkDisponivel) {
    const r = await salvarEventosDireto(validos, statusEl);
    if (r.ok) {
      marcarAgendaCriada(String(activeId));
      setTimeout(() => renderActGcalSection(e), 1500);
    } else {
      if (btn) btn.disabled = false;
    }
  } else {
    abrirEventosNoNavegador(validos, statusEl);
    marcarAgendaCriada(String(activeId));
    setTimeout(() => renderActGcalSection(e), 1500);
  }
}

// ══════════════════════════════════════════════════════════
//  COMPROVANTE — múltiplos, Google Drive via GAS
//  e.Comprovantes = [ { id, nome, categoria, driveFileId, driveLink, dataUpload }, ... ]
//  Compat. legado: e.Comprovante (objeto único) e localStorage
// ══════════════════════════════════════════════════════════

let currentCompCat = 'sinal'; // categoria selecionada no formulário de upload

function setCompCat(cat) {
  currentCompCat = cat;
  document.querySelectorAll('.comp-cat-tab').forEach(btn => {
    btn.classList.toggle('on', btn.dataset.cat === cat);
  });
}

function getComprovantesArray(e) {
  if (!e) return [];
  // Array novo (Drive)
  if (Array.isArray(e.Comprovantes) && e.Comprovantes.length > 0) return e.Comprovantes;
  // String JSON vinda do GAS
  if (typeof e.Comprovantes === 'string' && e.Comprovantes.startsWith('[')) {
    try { return JSON.parse(e.Comprovantes); } catch(_) { return []; }
  }
  return [];
}

function hasComprovante(e) {
  if (!e) return false;
  if (getComprovantesArray(e).length > 0) return true;
  if (e.Comprovante && e.Comprovante.driveLink) return true;
  if (e.ID && localStorage.getItem('orca_comp_' + e.ID)) return true;
  return false;
}

function verComprovanteItem(link) {
  if (!link) return;
  window.open(link, '_blank');
}

async function removeComprovanteItem(entryId, compId) {
  if (!confirm('Remover este comprovante?')) return;
  const e = entries.find(x => String(x.ID) === String(entryId));
  if (!e) return;

  const arr = getComprovantesArray(e);
  const item = arr.find(c => c.id === compId);
  if (item && item.driveFileId) {
    postEntry({ action: 'deleteComprovante', fileId: item.driveFileId }).catch(() => {});
  }

  e.Comprovantes = arr.filter(c => c.id !== compId);
  cacheEntries();
  render();
  postEntry({ action: 'update', id: e.ID, fields: { Comprovantes: JSON.stringify(e.Comprovantes) } });
  renderActCompSection(String(entryId));
  toast('🗑 Comprovante removido');
}

function renderCompItem(entryId, item) {
  const catIcons = { sinal: '💰', restante: '🏦', outros: '📄' };
  const icon   = catIcons[item.categoria] || '📎';
  const data   = item.dataUpload ? item.dataUpload.slice(0, 10) : '';
  const catLbl = { sinal: 'Sinal', restante: 'Restante', outros: 'Outros' }[item.categoria] || item.categoria;
  return (
    '<div class="comp-item">' +
      '<div class="comp-item-head">' +
        '<span class="comp-item-icon">' + icon + '</span>' +
        '<div class="comp-item-info">' +
          '<div class="comp-item-nome">' + esc(item.nome || 'comprovante') + '</div>' +
          '<div class="comp-item-meta">' + catLbl + (data ? ' · ' + data : '') + '</div>' +
        '</div>' +
        '<div class="comp-item-btns">' +
          '<button class="comp-item-btn view" onclick="verComprovanteItem(\'' + esc(item.driveLink) + '\')">👁 Abrir</button>' +
          '<button class="comp-item-btn del"  onclick="removeComprovanteItem(\'' + esc(entryId) + '\',\'' + esc(item.id) + '\')">🗑</button>' +
        '</div>' +
      '</div>' +
    '</div>'
  );
}

function renderActCompSection(id) {
  const el  = document.getElementById('act-comp-content');
  const inp = document.getElementById('act-comp-input');
  if (!el || !inp) return;

  inp.onchange = ev => handleComprovanteUpload(ev, id);

  const e    = entries.find(x => String(x.ID) === String(id));
  const arr  = getComprovantesArray(e);
  const cats = ['sinal', 'restante', 'outros'];
  const catLabels = { sinal: 'Sinal 💰', restante: 'Restante 🏦', outros: 'Outros 📄' };

  let html = '<div class="comp-list">';

  // Legado — único comprovante local
  const legLocal = localStorage.getItem('orca_comp_' + id);
  const legObj   = legLocal ? safeJSON(legLocal, null) : null;
  if (legObj) {
    html += '<div class="comp-item">' +
      '<div class="comp-item-head">' +
        '<span class="comp-item-icon">⚠️</span>' +
        '<div class="comp-item-info">' +
          '<div class="comp-item-nome">' + esc(legObj.nome || 'comprovante') + '</div>' +
          '<div class="comp-item-meta">Salvo localmente — re-envie para sincronizar</div>' +
        '</div>' +
        '<div class="comp-item-btns">' +
          '<button class="comp-item-btn del" onclick="localStorage.removeItem(\'orca_comp_\' + \'' + esc(id) + '\');renderActCompSection(\'' + esc(id) + '\')">🗑</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  // Legado — único comprovante no Drive (e.Comprovante)
  if (e && e.Comprovante && e.Comprovante.driveLink && arr.length === 0) {
    const lk = e.Comprovante;
    html += '<div class="comp-item">' +
      '<div class="comp-item-head">' +
        '<span class="comp-item-icon">📎</span>' +
        '<div class="comp-item-info">' +
          '<div class="comp-item-nome">' + esc(lk.nome || 'comprovante') + '</div>' +
          '<div class="comp-item-meta">' + (lk.dataUpload ? lk.dataUpload.slice(0,10) : '') + '</div>' +
        '</div>' +
        '<div class="comp-item-btns">' +
          '<button class="comp-item-btn view" onclick="window.open(\'' + esc(lk.driveLink) + '\',\'_blank\')">👁 Abrir</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  // Comprovantes novos agrupados por categoria
  cats.forEach(cat => {
    const items = arr.filter(ci => ci.categoria === cat);
    if (!items.length) return;
    html += '<div class="comp-cat-lbl">' + catLabels[cat] + '</div>';
    items.forEach(item => { html += renderCompItem(id, item); });
  });
  // Sem categoria definida
  arr.filter(ci => !cats.includes(ci.categoria)).forEach(item => {
    html += renderCompItem(id, item);
  });

  html += '</div>';

  // Área de upload
  html +=
    '<div class="comp-add-area">' +
      '<div class="comp-cat-tabs">' +
        cats.map(cat =>
          '<button class="comp-cat-tab' + (cat === currentCompCat ? ' on' : '') + '" ' +
          'data-cat="' + cat + '" onclick="setCompCat(\'' + cat + '\')">' +
          catLabels[cat] + '</button>'
        ).join('') +
      '</div>' +
      '<div class="comp-upload" onclick="document.getElementById(\'act-comp-input\').click()">' +
        '📎 Adicionar comprovante<br>' +
        '<span style="font-size:0.7rem;opacity:0.7">Imagem ou PDF · máx. 10 MB</span>' +
      '</div>' +
    '</div>';

  el.innerHTML = html;
}

async function handleComprovanteUpload(event, id) {
  const file = (event.target.files || [])[0];
  if (!file) return;
  event.target.value = '';

  const MAX_BYTES = 10 * 1024 * 1024;
  if (file.size > MAX_BYTES) { toast('⚠️ Arquivo muito grande. Máximo 10 MB.'); return; }

  const categoria = currentCompCat || 'outros';

  // Loading isolado dentro da área de comprovante (não bloqueia o resto)
  const addArea = document.querySelector('.comp-add-area');
  if (addArea) addArea.innerHTML = '<div class="comp-uploading">⏳ Enviando comprovante...</div>';

  try {
    // Ler como base64 (sem prefixo data:...)
    const base64Raw = await new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload  = ev => res((ev.target.result || '').split(',')[1] || '');
      reader.onerror = rej;
      reader.readAsDataURL(file);
    });

    // Redimensionar imagens antes do upload
    let uploadB64  = base64Raw;
    let uploadTipo = file.type;
    if (file.type.startsWith('image/')) {
      uploadB64  = await resizeImageBase64(base64Raw, file.type);
      uploadTipo = 'image/jpeg';
    }

    // Upload para Supabase Storage
    const result = await DB.storage.uploadComprovante(String(id), file, categoria, uploadB64, uploadTipo);
    if (!result.ok) throw new Error(result.error || 'Erro no upload');

    // Adicionar à lista de comprovantes da entrada (sem substituir)
    const e = entries.find(x => String(x.ID) === String(id));
    if (e) {
      if (!Array.isArray(e.Comprovantes)) e.Comprovantes = [];
      e.Comprovantes.push({
        id:          String(Date.now()) + '_' + Math.floor(Math.random() * 9999),
        nome:        result.nome || file.name,
        categoria:   categoria,
        driveFileId: result.fileId,
        driveLink:   result.link,
        dataUpload:  new Date().toISOString(),
      });
      cacheEntries();
      render();
      postEntry({ action: 'update', id: e.ID, fields: { Comprovantes: JSON.stringify(e.Comprovantes) } });
    }

    renderActCompSection(id);
    toast('✅ Comprovante enviado com sucesso!');

  } catch(err) {
    console.error('Upload comprovante:', err);
    toast('❌ Erro ao enviar: ' + (err.message || err));
    renderActCompSection(id);
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function resizeImageBase64(base64, tipo) {
  return new Promise(res => {
    const img = new Image();
    img.onload = function() {
      const MAX_DIM = 1600;
      let w = img.width, h = img.height;
      if (w > MAX_DIM || h > MAX_DIM) {
        if (w > h) { h = Math.round(h * MAX_DIM / w); w = MAX_DIM; }
        else        { w = Math.round(w * MAX_DIM / h); h = MAX_DIM; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      res((canvas.toDataURL('image/jpeg', 0.82)).split(',')[1]);
    };
    img.onerror = () => res(base64);
    img.src = 'data:' + tipo + ';base64,' + base64;
  });
}

(function init() {
  render();
  syncAll();
})();