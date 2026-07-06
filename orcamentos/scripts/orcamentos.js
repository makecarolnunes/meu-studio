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
  'Novo Pedido':                   'st-novo',
  'Orçamento Enviado':             'st-enviado',
  'Fechado':                       'st-fechado',
  'Perdido - Sem Resposta':        'st-semresp',
  'Perdido - Sem Disponibilidade': 'st-perdido',
  'Perdido - Outros motivos':      'st-outros',
};

// Todos os status de "perdido" (qualquer motivo)
const PERDIDO_STATUS = ['Perdido - Sem Resposta', 'Perdido - Sem Disponibilidade', 'Perdido - Outros motivos'];

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
let curEquipe   = 'todos';   // filtro por equipe: 'todos' | '__sem__' | nome da equipe
let curSearch   = '';        // pesquisa por nome do cliente
let activeId    = null;
let filterMonth = null;
let filterEventDate = null;   // data do atendimento (YYYY-MM-DD) — filtra por DataEvento / datas dos serviços

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
                 PERDIDO_STATUS.includes(e.Status) ? 'is-perdido' : '';
  const val    = e.ValorFechado ? parseFloat(e.ValorFechado) : parseFloat(e.ValorProp) || 0;
  const valStr = val ? fmtVal(val) : '—';
  const meta   = e.DataEvento ? 'Evento: ' + fmtDate(e.DataEvento) : '';
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
        '<div class="e-name">' + esc(e.Cliente || '—') + (e.Equipe ? ' <span style="display:inline-block;background:#e0f7fa;color:#006064;border-radius:8px;padding:1px 7px;font-size:.65rem;font-weight:600;vertical-align:middle">↑ Equipe ' + esc(e.Equipe) + '</span>' : '') + '</div>' +
        '<div class="e-srv">' + esc(e.Servico || '—') + '</div>' +
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
// Todas as datas de atendimento de um orçamento (datas dos serviços + DataEvento)
function entryEventDates(e) {
  const set = {};
  entrySlots(e).forEach(s => { if (s.data) set[s.data] = 1; });
  if (e.DataEvento) set[e.DataEvento] = 1;
  return Object.keys(set);
}

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

    // Aplica atualizações pendentes (salvas offline durante confirmarFechamento)
    const pending = safeJSON(localStorage.getItem('orca_pending_status'), {});
    const pendingIds = Object.keys(pending);
    if (pendingIds.length) {
      const synced = [];
      for (const [pid, fields] of Object.entries(pending)) {
        const local = entries.find(e => String(e.ID) === String(pid));
        if (local) Object.assign(local, fields);
        try {
          await DB.orcamentos.update(pid, fields);
          synced.push(pid);
        } catch(_) {}
      }
      synced.forEach(pid => delete pending[pid]);
      localStorage.setItem('orca_pending_status', JSON.stringify(pending));
    }

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
    const partes = contarServicosGrupo(grupo).partes;
    const descServico = (partes.join(' e ') || grupo.length + ' serviços') + ' ' + tipoLocalStr;
    linhas.push('*Serviço:* ' + descServico);

    // Período do grupo: início (menor horário) e fim (maior horário + duração)
    let iniMin = null, fimMax = null;
    grupo.forEach(s => {
      if (!s.horario) return;
      const [hh, mm] = s.horario.split(':').map(Number);
      const start = hh * 60 + mm;
      const end   = start + slotDuracao(s);
      if (iniMin === null || start < iniMin) iniMin = start;
      if (fimMax === null || end   > fimMax) fimMax = end;
    });
    if (dataKey !== '__semdata__') linhas.push('*Data:* ' + fmtDateWeekFull(dataKey));
    if (iniMin !== null) {
      const horaIni = pad2(Math.floor(iniMin / 60) % 24) + ':' + pad2(iniMin % 60);
      const horaFim = pad2(Math.floor(fimMax / 60) % 24) + ':' + pad2(fimMax % 60);
      if (grupo.length > 1) linhas.push('*Horário:* ' + fmtHorario(horaIni) + ' às ' + fmtHorario(horaFim));
      else                  linhas.push('*Horário de início:* ' + fmtHorario(horaIni));
    }
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

// Duração de uma slot: usa a duração gravada ou deriva do serviço.
function slotDuracao(s) {
  return parseInt(s && s.duracao) || getServiceDuration(s && s.servico);
}

// Conta os serviços de um grupo (mesma data) por categoria.
// Reaproveitado pelo evento da agenda e pela mensagem de WhatsApp.
function contarServicosGrupo(grupo) {
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
  return { nMaquiagem, nCabelo, nNoiva, nOutro, partes };
}

// Resumo curto para o título do evento da agenda (ex: "6 Make e Cabelo").
function resumoServicosGrupo(grupo) {
  if (!grupo || !grupo.length) return 'Serviço';
  const todosCombo = grupo.every(s => {
    const low = (s.servico || '').toLowerCase();
    return (low.includes('maquiagem') || low.includes('make')) &&
           (low.includes('cabelo')    || low.includes('penteado'));
  });
  if (todosCombo) return grupo.length + ' Make e Cabelo';
  const c = contarServicosGrupo(grupo);
  const partes = [];
  if (c.nNoiva)     partes.push(c.nNoiva     + ' Noiva' + (c.nNoiva   > 1 ? 's' : ''));
  if (c.nMaquiagem) partes.push(c.nMaquiagem + ' Make');
  if (c.nCabelo)    partes.push(c.nCabelo    + ' Cabelo' + (c.nCabelo > 1 ? 's' : ''));
  if (c.nOutro)     partes.push(c.nOutro     + ' Serviço' + (c.nOutro > 1 ? 's' : ''));
  return partes.join(', ') || abrevServico(grupo[0].servico);
}

// Descrição agrupada de um evento único (vários serviços na mesma data).
function buildGrupoDescricao(grupo, endereco, total, sinal, saldo, telefone, equipe, inicioFmt, fimFmt) {
  const c = contarServicosGrupo(grupo);
  const desc = [];
  desc.push('Serviços: ' + (c.partes.join(' e ') || (grupo.length + ' serviços')));
  if (equipe) desc.push('Equipe responsável: ' + equipe);
  desc.push('Data: ' + (fmtDateWeek(grupo[0].data) || ''));
  desc.push('Horário: ' + inicioFmt + ' às ' + fimFmt);
  desc.push('Endereço: ' + (endereco || ''));

  // Valor unitário por tipo de serviço (sem repetir)
  const tiposValor = {};
  grupo.forEach(s => {
    const v = parseFloat(s.valorUnit) || 0;
    const label = simplifyServiceName(s.servico);
    if (v > 0 && !tiposValor[label]) tiposValor[label] = v;
  });
  const tiposEntries = Object.entries(tiposValor);
  if (tiposEntries.length) {
    desc.push('');
    desc.push('Valor por serviço:');
    tiposEntries.forEach(([label, v]) => desc.push('• ' + label + ': R$ ' + fmt(v)));
  }

  desc.push('');
  desc.push('Valor total do orçamento: R$ ' + (total > 0 ? fmt(total) : ''));
  desc.push('Valor pago na reserva: R$ '    + (sinal > 0 ? fmt(sinal) : ''));
  desc.push('Restante a ser pago no dia: R$ ' + (saldo > 0 ? fmt(saldo) : ''));

  // Restante por tipo de serviço (rateado pelo valor unitário)
  if (saldo > 0 && total > 0 && grupo.length > 1) {
    const tiposSaldo = {};
    grupo.forEach(s => {
      const v = parseFloat(s.valorUnit) || 0;
      if (v > 0) {
        const label = simplifyServiceName(s.servico);
        const saldoUnit = Math.round(saldo * (v / total) * 100) / 100;
        if (!tiposSaldo[label]) tiposSaldo[label] = { saldoUnit, count: 0 };
        tiposSaldo[label].count++;
      }
    });
    desc.push('Restante por serviço:');
    Object.entries(tiposSaldo).forEach(([label, info]) => {
      const prefix = info.count > 1 ? info.count + '× ' : '';
      const suffix = info.count > 1 ? ' cada' : '';
      desc.push('  • ' + prefix + label + ': R$ ' + fmt(info.saldoUnit) + suffix);
    });
  }

  if (telefone) { desc.push(''); desc.push('Contato: ' + telefone); }
  return desc.join('\n');
}

// Constrói eventos da agenda agrupando slots por data:
// mesma data com vários serviços → UM evento (12h30–18h30); datas diferentes → eventos separados.
function buildEventos(nome, slots, endereco, total, sinal, saldo, telefone, equipe) {
  const eventos = [];
  const local = fechLocal === 'studio' ? 'Studio' : 'Domicílio';
  const nomeComEquipe = (nome || '[nome]') + (equipe ? ' — Equipe ' + equipe : '');

  // Agrupa por data, preservando a ordem de aparição
  const byData = {};
  const ordem = [];
  slots.forEach(s => {
    if (!s.data || !s.horario) return;   // sem data/horário não vira evento
    if (!byData[s.data]) { byData[s.data] = []; ordem.push(s.data); }
    byData[s.data].push(s);
  });

  ordem.forEach(dataKey => {
    const grupo = byData[dataKey];

    // início = menor horário do grupo; fim = maior (horário + duração)
    let iniMin = null, fimMax = null;
    grupo.forEach(s => {
      const [hh, mm] = s.horario.split(':').map(Number);
      const start = hh * 60 + mm;
      const end   = start + slotDuracao(s);
      if (iniMin === null || start < iniMin) iniMin = start;
      if (fimMax === null || end   > fimMax) fimMax = end;
    });
    const horaInicio = pad2(Math.floor(iniMin / 60) % 24) + ':' + pad2(iniMin % 60);
    const horaFim    = pad2(Math.floor(fimMax / 60) % 24) + ':' + pad2(fimMax % 60);
    const inicioFmt  = fmtHorario(horaInicio);
    const fimFmt     = fmtHorario(horaFim);

    let titulo, descricao;
    if (grupo.length === 1) {
      // Um único serviço na data — comportamento padrão
      const s = grupo[0];
      titulo = inicioFmt + ' - ' + fimFmt + ' | ' + nomeComEquipe + ' | ' + abrevServico(s.servico) + ' | ' + local;
      const desc = [];
      desc.push('Serviço: ' + (s.servico || ''));
      if (equipe) desc.push('Equipe responsável: ' + equipe);
      desc.push('Data: ' + (fmtDateWeek(s.data) || ''));
      desc.push('Horário de início: ' + inicioFmt);
      desc.push('Endereço: ' + (endereco || ''));
      if (parseFloat(s.valorUnit) > 0) desc.push('Valor deste serviço: R$ ' + fmt(s.valorUnit));
      desc.push('Valor total do orçamento: R$ ' + (total > 0 ? fmt(total) : ''));
      desc.push('Valor pago na reserva: R$ '    + (sinal > 0 ? fmt(sinal) : ''));
      desc.push('Restante a ser pago no dia: R$ ' + (saldo > 0 ? fmt(saldo) : ''));
      if (telefone) { desc.push(''); desc.push('Contato: ' + telefone); }
      descricao = desc.join('\n');
    } else {
      // Vários serviços na mesma data — UM evento agrupado
      titulo = inicioFmt + ' - ' + fimFmt + ' | ' + nomeComEquipe + ' | ' + resumoServicosGrupo(grupo) + ' | ' + local;
      descricao = buildGrupoDescricao(grupo, endereco, total, sinal, saldo, telefone, equipe, inicioFmt, fimFmt);
    }

    eventos.push({
      titulo,
      startISO: toISO(dataKey, horaInicio),
      endISO:   toISO(dataKey, horaFim),
      endereco,
      descricao,
      durMinutes: fimMax - iniMin,
      data: dataKey,
      horario: horaInicio,
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
//  6.C.2 · DASHBOARD DE CONVERSÃO
//  Mostra mês corrente vs mês anterior vs últimos 3 meses
// ══════════════════════════════════════════════════════════
function _convStatsFor(start, end) {
  // start/end: 'YYYY-MM' inclusivos
  const ano = (e) => (e.DataPedido || '').slice(0, 7);
  const inPeriod = (e) => {
    const m = ano(e);
    return m >= start && m <= end;
  };
  const list = entries.filter(inPeriod);
  const enviados   = list.length;
  const fechados   = list.filter(e => e.Status === 'Fechado').length;
  const perdidos   = list.filter(e => PERDIDO_STATUS.includes(e.Status)).length;
  const abertos    = enviados - fechados - perdidos;
  const receita    = list.filter(e => e.Status === 'Fechado')
    .reduce((s,e) => s + (parseFloat(e.ValorFechado) || parseFloat(e.ValorProp) || 0), 0);
  const ticketMedio = fechados > 0 ? receita / fechados : 0;
  const conv = enviados > 0 ? Math.round(fechados / enviados * 100) : 0;
  return { enviados, fechados, perdidos, abertos, receita, ticketMedio, conv };
}

function openConversaoDashboard() {
  const hoje = new Date();
  const mY = hoje.getFullYear();
  const mM = hoje.getMonth(); // 0-based
  const pad = (n) => String(n).padStart(2, '0');
  const mesAtualKey = `${mY}-${pad(mM+1)}`;
  const mesAntDate = new Date(mY, mM - 1, 1);
  const mesAntKey  = `${mesAntDate.getFullYear()}-${pad(mesAntDate.getMonth()+1)}`;
  const inicio3Date = new Date(mY, mM - 2, 1);
  const inicio3Key  = `${inicio3Date.getFullYear()}-${pad(inicio3Date.getMonth()+1)}`;
  const anoAtualKey = `${mY}-01`;

  const mesAtual  = _convStatsFor(mesAtualKey, mesAtualKey);
  const mesAnt    = _convStatsFor(mesAntKey, mesAntKey);
  const ult3      = _convStatsFor(inicio3Key, mesAtualKey);
  const ano       = _convStatsFor(anoAtualKey, `${mY}-12`);

  const deltaConv = mesAnt.enviados > 0
    ? mesAtual.conv - mesAnt.conv
    : null;
  const deltaRec  = mesAnt.receita > 0
    ? Math.round(((mesAtual.receita - mesAnt.receita) / mesAnt.receita) * 100)
    : null;

  const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const fmt = (v) => 'R$ ' + Number(v||0).toLocaleString('pt-BR', {minimumFractionDigits:0, maximumFractionDigits:0});

  const card = (titulo, sub, st, opts) => {
    const o = opts || {};
    const corConv = st.conv >= 50 ? '#3B6D11' : st.conv >= 30 ? '#BA7517' : '#C62828';
    const deltaHtml = o.deltaConv !== undefined && o.deltaConv !== null
      ? `<span style="font-size:.7rem;font-weight:700;color:${o.deltaConv >= 0 ? '#3B6D11' : '#C62828'};margin-left:6px">${o.deltaConv >= 0 ? '+' : ''}${o.deltaConv}pp</span>`
      : '';
    return `
      <div style="background:white;border:1px solid #EDE4DF;border-radius:14px;padding:14px 16px;margin-bottom:10px">
        <div style="font-size:.7rem;font-weight:700;color:#6F6660;text-transform:uppercase;letter-spacing:.08em;margin-bottom:2px">${titulo}</div>
        ${sub ? `<div style="font-size:.68rem;color:#A8A199;margin-bottom:10px">${sub}</div>` : '<div style="height:10px"></div>'}
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;text-align:center;margin-bottom:10px">
          <div><div style="font-size:1.2rem;font-weight:800;color:#2C2420">${st.enviados}</div><div style="font-size:.62rem;color:#6F6660">Enviados</div></div>
          <div><div style="font-size:1.2rem;font-weight:800;color:#3B6D11">${st.fechados}</div><div style="font-size:.62rem;color:#6F6660">Fechados</div></div>
          <div><div style="font-size:1.2rem;font-weight:800;color:#C62828">${st.perdidos}</div><div style="font-size:.62rem;color:#6F6660">Perdidos</div></div>
          <div><div style="font-size:1.2rem;font-weight:800;color:#BA7517">${st.abertos}</div><div style="font-size:.62rem;color:#6F6660">Em aberto</div></div>
        </div>
        <div style="display:flex;align-items:baseline;justify-content:space-between;padding-top:10px;border-top:1px dashed #EDE4DF">
          <div>
            <span style="font-size:.75rem;color:#6F6660">Conversão</span>
            <strong style="font-size:1.05rem;color:${corConv};margin-left:5px">${st.conv}%</strong>
            ${deltaHtml}
          </div>
          <div style="text-align:right">
            <div style="font-size:.95rem;font-weight:800;color:#38190b">${fmt(st.receita)}</div>
            ${o.deltaRec !== undefined && o.deltaRec !== null ? `<div style="font-size:.65rem;color:${o.deltaRec >= 0 ? '#3B6D11' : '#C62828'};font-weight:600">${o.deltaRec >= 0 ? '+' : ''}${o.deltaRec}% vs anterior</div>` : ''}
            ${st.fechados > 0 ? `<div style="font-size:.65rem;color:#A8A199">Ticket médio ${fmt(st.ticketMedio)}</div>` : ''}
          </div>
        </div>
      </div>
    `;
  };

  const html = `
    <div style="font-size:1.05rem;font-weight:800;color:#38190b;margin-bottom:14px">📊 Conversão · ${meses[mM]} ${mY}</div>
    ${card(meses[mM] + ' ' + mY, 'mês corrente', mesAtual, { deltaConv, deltaRec })}
    ${card(meses[mesAntDate.getMonth()] + ' ' + mesAntDate.getFullYear(), 'mês anterior · comparação', mesAnt)}
    ${card('Últimos 3 meses', `${meses[inicio3Date.getMonth()]} → ${meses[mM]}`, ult3)}
    ${card('Ano ' + mY, 'janeiro até dezembro', ano)}
    <button onclick="closeConversaoDashboard()" style="width:100%;margin-top:6px;padding:11px;background:none;border:1.5px solid #EDE4DF;border-radius:12px;font-family:inherit;font-size:.85rem;font-weight:600;color:#6F6660;cursor:pointer">Fechar</button>
  `;

  // Cria overlay próprio (não usa o modal de orçamento)
  let bg = document.getElementById('conv-bg');
  if (!bg) {
    bg = document.createElement('div');
    bg.id = 'conv-bg';
    bg.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:400;display:flex;align-items:center;justify-content:center;padding:16px';
    bg.onclick = (e) => { if (e.target === bg) closeConversaoDashboard(); };
    document.body.appendChild(bg);
  }
  bg.innerHTML = `<div style="background:#FAF8F6;width:100%;max-width:480px;max-height:90vh;overflow-y:auto;border-radius:20px;padding:22px 18px;box-shadow:0 12px 40px rgba(0,0,0,.25)">${html}</div>`;
  bg.style.display = 'flex';
}

function closeConversaoDashboard() {
  const bg = document.getElementById('conv-bg');
  if (bg) bg.style.display = 'none';
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

  let list = entries.slice();

  // Filtro por mês usa DataPedido (data de recebimento), não DataEvento
  if (filterMonth) {
    list = list.filter(e => (e.DataPedido || '').startsWith(filterMonth));
  }

  // Filtro por data de atendimento (dia específico) — usa DataEvento / datas dos serviços
  if (filterEventDate) {
    list = list.filter(e => entryEventDates(e).includes(filterEventDate));
  }
  syncEventDateUI();

  // Filtro por status
  if (curFilter === 'novos')             list = list.filter(e => ['Novo Pedido','Orçamento Enviado'].includes(e.Status));
  else if (curFilter === 'perdidos')     list = list.filter(e => PERDIDO_STATUS.includes(e.Status));
  else if (curFilter === 'fechados')     list = list.filter(e => e.Status === 'Fechado');
  else if (curFilter === 'agenda-pend')  list = list.filter(e => e.Status === 'Fechado' && !getAgendaCriada(e));
  else if (curFilter === 'agenda-ok')    list = list.filter(e => e.Status === 'Fechado' && getAgendaCriada(e));

  // Filtro por origem (Produção Social / Noiva / Curso de Automaquiagem)
  if (curOrigem !== 'todos') {
    // "Noiva" reconhece por origem OU por serviço (isNoivaEntry) — orçamentos
    // marcados como noiva só pelo serviço (Origem default) também aparecem.
    if (curOrigem === 'Noiva') {
      list = list.filter(e => isNoivaEntry(e));
    } else {
      list = list.filter(e => e.Origem === curOrigem);
    }
  }

  // Filtro por equipe
  if (curEquipe === '__sem__') list = list.filter(e => !e.Equipe);
  else if (curEquipe !== 'todos') list = list.filter(e => e.Equipe === curEquipe);

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

  // Atualiza tabs de equipe (mobile + desktop)
  document.querySelectorAll('.equipe-tab').forEach(t => t.classList.toggle('on', t.dataset.eq === curEquipe));
  document.querySelectorAll('.d-fil-item[data-eq]').forEach(t => t.classList.toggle('active', t.dataset.eq === curEquipe));

  // Monta filtro de equipe dinamicamente
  const equipesDisp = [...new Set(entries.map(e => e.Equipe).filter(Boolean))];
  const equipeTabsEl = document.getElementById('equipe-tabs');
  const equipeTabsDsEl = document.getElementById('ds-equipe-section');
  if (equipeTabsEl) {
    if (equipesDisp.length) {
      equipeTabsEl.style.display = '';
      const items = [{eq:'todos',l:'Todas'},{eq:'__sem__',l:'Sem equipe'},...equipesDisp.map(eq=>({eq,l:'Equipe ' + eq}))];
      equipeTabsEl.innerHTML = items.map(f=>`<button class="equipe-tab${curEquipe===f.eq?' on':''}" data-eq="${f.eq}" onclick="setEquipe('${f.eq}')">${f.l}</button>`).join('');
    } else {
      equipeTabsEl.style.display = 'none';
    }
  }
  if (equipeTabsDsEl) {
    if (equipesDisp.length) {
      equipeTabsDsEl.style.display = '';
      const items = [{eq:'todos',l:'Todas as equipes'},{eq:'__sem__',l:'Sem equipe'},...equipesDisp.map(eq=>({eq,l:'Equipe ' + eq}))];
      equipeTabsDsEl.innerHTML = `<div class="dsb-lbl">Equipe</div>` + items.map(f=>`<button class="d-fil-item${curEquipe===f.eq?' active':''}" data-eq="${f.eq}" onclick="setEquipe('${f.eq}')"><span class="d-fil-dot" style="background:#006064"></span>${f.l}</button>`).join('');
    } else {
      equipeTabsDsEl.style.display = 'none';
    }
  }

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
    const semFiltro = curFilter === 'todos' && !filterEventDate && !filterMonth &&
                      !curSearch.trim() && curOrigem === 'todos' && curEquipe === 'todos';
    let msg;
    if (filterEventDate)   msg = 'Nenhum atendimento marcado para ' + fmtDate(filterEventDate) + '.';
    else if (semFiltro)    msg = 'Nenhum orçamento ainda.<br>Toque em <strong>＋</strong> para adicionar.';
    else                   msg = 'Nenhum orçamento neste filtro.';
    content.innerHTML =
      '<div class="empty">' +
        '<span class="ico">' + (semFiltro ? '💰' : '🔍') + '</span>' +
        '<p>' + msg + '</p>' +
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
function setF(f) { curFilter = f; localStorage.setItem('orca_cur_filter', f); render(); }
function setOrigem(v) { curOrigem = v; localStorage.setItem('orca_cur_origem', v); render(); }
function setEquipe(v) { curEquipe = v; localStorage.setItem('orca_cur_equipe', v); render(); }
function setSearch(v) { curSearch = v; render(); }
function navMonth(dir) {
  const base = filterMonth ? new Date(filterMonth + '-01T12:00:00') : new Date();
  base.setMonth(base.getMonth() + dir);
  filterMonth = base.getFullYear() + '-' + pad(base.getMonth() + 1);
  render();
}
function clearMonth() { filterMonth = null; render(); }
// ── Filtro por data de atendimento (dia específico) ──────────
function setEventDate(v) { filterEventDate = v || null; render(); }
function clearEventDate() { filterEventDate = null; render(); }
function syncEventDateUI() {
  const inps   = [document.getElementById('d-event-date'), document.getElementById('m-event-date')];
  const clears = [document.getElementById('d-event-clear'), document.getElementById('m-event-clear')];
  inps.forEach(inp => { if (inp && inp.value !== (filterEventDate || '')) inp.value = filterEventDate || ''; });
  clears.forEach(btn => { if (btn) btn.style.display = filterEventDate ? '' : 'none'; });
}
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
  const addNoTel = document.getElementById('add-no-tel');
  if (addNoTel) addNoTel.checked = false;
  toggleNoPhone(false);
  document.getElementById('add-obs').value      = '';
  document.getElementById('add-origem').value   = 'Produção Social';
  const addEqChk = document.getElementById('add-eq-chk');
  const addEqInp = document.getElementById('add-equipe');
  if (addEqChk) addEqChk.checked = false;
  if (addEqInp) { addEqInp.value = ''; addEqInp.style.display = 'none'; }
  slotCheckExcludeId = null;   // orçamento novo: confere contra todos os existentes
  addSlots = [];
  addAddSlot();
  openPanel('panel-add');
}

function toggleAddEquipeInput(checked) {
  const inp = document.getElementById('add-equipe');
  if (!inp) return;
  if (checked) { inp.style.display = ''; inp.style.marginTop = '8px'; inp.focus(); }
  else { inp.style.display = 'none'; inp.value = ''; }
}

function toggleNoPhone(checked) {
  const inp = document.getElementById('add-tel');
  if (!inp) return;
  if (checked) { inp.value = ''; inp.disabled = true; inp.placeholder = 'Telefone não informado'; }
  else { inp.disabled = false; inp.placeholder = '11 98765-4321'; }
}

function toggleActEquipeInput(checked) {
  const inp = document.getElementById('act-equipe');
  if (!inp) return;
  if (checked) { inp.style.display = ''; inp.style.marginTop = '8px'; inp.focus(); }
  else { inp.style.display = 'none'; inp.value = ''; }
  const toToggle = ['act-val-enviado-wrap', 'act-comp-wrap'];
  toToggle.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = checked ? 'none' : '';
  });
}

// ── Slots: total de ocorrências de uma linha = valorUnit × qtd ──
function slotQtd(s) { return Math.max(1, parseInt(s && s.qtd) || 1); }

// Linha-resumo por slot: "6 × R$ 500,00 = R$ 3.000,00 · 12:30–18:30"
function slotResumoLinha(s) {
  const qtd = slotQtd(s);
  const val = parseFloat(s.valorUnit) || 0;
  const dur = parseInt(s.duracao) || getServiceDuration(s.servico);
  const parts = [];
  if (val > 0 || qtd > 1) parts.push(qtd + ' × R$ ' + fmt(val) + ' = R$ ' + fmt(qtd * val));
  if (s.horario) parts.push(fmtHorario(s.horario) + '–' + addMinutesFmt(s.horario, qtd * dur));
  return parts.join(' · ');
}

// ── Detecção de conflito de agenda (data + horário) ──────────────
// Compara o slot que está sendo preenchido com os slots de TODOS os
// outros orçamentos. A base é o próprio app: os orçamentos *Fechados*
// são justamente os que viram evento no Google Agenda. O navegador não
// lê o Google Agenda diretamente, então eventos criados à mão na agenda
// (fora do app) não entram nessa checagem.
let slotCheckExcludeId = null;   // ID do orçamento em edição (não conflita consigo mesmo)

function hhmmToMin(h) {
  if (!h) return null;
  const [a, b] = h.split(':').map(Number);
  if (isNaN(a)) return null;
  return a * 60 + (b || 0);
}

function findSlotConflicts(cand, excludeId) {
  const out = { conflitos: [], procuras: [], mesmoDia: [] };
  if (!cand || !cand.data) return out;
  const candStart = hhmmToMin(cand.horario);
  const candEnd   = candStart != null ? candStart + slotDuracao(cand) : null;
  const seen = {};

  entries.forEach(e => {
    if (excludeId && String(e.ID) === String(excludeId)) return;
    if (PERDIDO_STATUS.includes(e.Status)) return;   // lead perdido não gera aviso de agenda
    entrySlots(e).forEach(s => {
      if (!s.data || s.data !== cand.data) return;
      const exStart = hhmmToMin(s.horario);
      const exEnd   = exStart != null ? exStart + slotDuracao(s) : null;
      const overlap = (candStart != null && exStart != null) &&
                      (candStart < exEnd && exStart < candEnd);
      const key = String(e.ID) + '|' + (s.horario || '');
      if (seen[key]) return;
      seen[key] = 1;
      const rec = {
        cliente: e.Cliente || 'cliente',
        status:  e.Status  || '',
        horario: s.horario  || '',
        servico: s.servico  || '',
      };
      if (overlap) {
        if (e.Status === 'Fechado') out.conflitos.push(rec);
        else                        out.procuras.push(rec);
      } else {
        out.mesmoDia.push(rec);
      }
    });
  });
  return out;
}

function slotConflictHTML(cand, excludeId) {
  const r = findSlotConflicts(cand, excludeId);
  const lines = [];
  r.conflitos.forEach(c =>
    lines.push('<div class="slot-warn slot-warn-err">⛔ <strong>' + esc(c.cliente) +
      '</strong> já tem atendimento <strong>fechado</strong>' +
      (c.horario ? ' às ' + fmtHorario(c.horario) : '') +
      ' — possível choque de agenda</div>'));
  r.procuras.forEach(c =>
    lines.push('<div class="slot-warn slot-warn-fu">👀 <strong>' + esc(c.cliente) +
      '</strong> também procurou esse horário' +
      (c.status ? ' (' + esc(c.status) + ')' : '') +
      ' — vale um follow-up</div>'));
  // "Mesmo dia" (horário diferente) só aparece quando não há sobreposição.
  // Diferencia agendamento real (Fechado) de quem apenas pediu orçamento.
  if (!r.conflitos.length && !r.procuras.length) {
    const md = r.mesmoDia.slice()
      .sort((a, b) => (b.status === 'Fechado') - (a.status === 'Fechado')); // Fechados primeiro
    md.slice(0, 3).forEach(c => {
      const quando = c.horario ? ' às ' + fmtHorario(c.horario) : '';
      if (c.status === 'Fechado') {
        lines.push('<div class="slot-warn slot-warn-fu">⚠️ Você já tem <strong>' + esc(c.cliente) +
          '</strong> nesse dia' + quando + '</div>');
      } else {
        lines.push('<div class="slot-warn slot-warn-info">📋 Pedido de orçamento — <strong>' +
          esc(c.cliente) + '</strong>' + quando + '</div>');
      }
    });
  }
  return lines.join('');
}

// ── Data do slot via listas Dia / Mês / Ano (evita ano digitado errado) ──
const MESES_ABREV = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
function daysInMonth(y, m) {
  if (!m) return 31;
  const yy = Number(y) || new Date().getFullYear();
  return new Date(yy, Number(m), 0).getDate();
}
function yearOptionsList(selected) {
  const cy = new Date().getFullYear();
  const list = [];
  for (let y = cy - 1; y <= cy + 3; y++) list.push(String(y));
  if (selected && !list.includes(String(selected))) list.unshift(String(selected)); // preserva ano fora do range (dado antigo)
  return list;
}
// Quebra a data do slot em {y,m,d}; ano vazio assume o ano atual (autopreenchido).
function slotDateParts(s) {
  let y = '', m = '', d = '';
  if (s && /^\d{4}-\d{2}-\d{2}$/.test(s.data || '')) {
    const a = s.data.split('-'); y = a[0]; m = a[1]; d = a[2];
  } else if (s) {
    y = s._y || ''; m = s._m || ''; d = s._d || '';
  }
  if (!y) y = String(new Date().getFullYear());
  return { y, m, d };
}
function buildSlotDateSelects(s, syncFn) {
  const p = slotDateParts(s);
  let dias = '<option value="">Dia</option>';
  const maxD = daysInMonth(p.y, p.m);
  for (let i = 1; i <= maxD; i++) {
    const dd = pad2(i);
    dias += '<option value="' + dd + '"' + (dd === p.d ? ' selected' : '') + '>' + i + '</option>';
  }
  let meses = '<option value="">Mês</option>';
  MESES_ABREV.forEach((nm, i) => {
    const mm = pad2(i + 1);
    meses += '<option value="' + mm + '"' + (mm === p.m ? ' selected' : '') + '>' + nm + '</option>';
  });
  const anos = yearOptionsList(p.y).map(y =>
    '<option value="' + y + '"' + (y === p.y ? ' selected' : '') + '>' + y + '</option>').join('');
  return (
    '<select class="form-input slot-sel" onchange="' + syncFn + '(' + s.id + ', \'dia\', this.value)" title="Dia">' + dias + '</select>' +
    '<select class="form-input slot-sel" onchange="' + syncFn + '(' + s.id + ', \'mes\', this.value)" title="Mês">' + meses + '</select>' +
    '<select class="form-input slot-sel" onchange="' + syncFn + '(' + s.id + ', \'ano\', this.value)" title="Ano">' + anos + '</select>'
  );
}
// Data (se houver) precisa ter ano plausível e ser um dia real do calendário.
function slotDateYearValid(dateStr) {
  if (!dateStr) return true;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) return false;
  const y = Number(m[1]), cy = new Date().getFullYear();
  if (y < cy - 1 || y > cy + 5) return false;
  const dt = new Date(y, Number(m[2]) - 1, Number(m[3]));
  return dt.getFullYear() === y && (dt.getMonth() + 1) === Number(m[2]) && dt.getDate() === Number(m[3]);
}

// HTML de uma linha de slot (compartilhado entre Novo Orçamento e Fechar)
function renderSlotRow(s, idx, count, syncFn, removeFn) {
  const opts = services.map(svc =>
    '<option value="' + esc(svc.nome) + '"' + (svc.nome === s.servico ? ' selected' : '') + '>' + esc(svc.nome) + '</option>'
  ).join('');
  const qtd = slotQtd(s);
  const dur = parseInt(s.duracao) || getServiceDuration(s.servico);
  return (
    '<div class="slot-row">' +
      '<div class="slot-num">' + (idx + 1) + '</div>' +
      '<div class="slot-fields">' +
        '<select class="form-input" onchange="' + syncFn + '(' + s.id + ', \'servico\', this.value)">' +
          '<option value="">— Selecione o serviço —</option>' +
          opts +
        '</select>' +
        '<div class="slot-qty-row">' +
          '<label class="slot-mini-lbl">Qtd' +
            '<input class="form-input" type="number" min="1" step="1" value="' + qtd + '" oninput="' + syncFn + '(' + s.id + ', \'qtd\', this.value)">' +
          '</label>' +
          '<label class="slot-mini-lbl">R$ un.' +
            '<input class="form-input" type="number" step="0.01" min="0" placeholder="valor" value="' + (s.valorUnit || '') + '" oninput="' + syncFn + '(' + s.id + ', \'valorUnit\', this.value)">' +
          '</label>' +
          '<label class="slot-mini-lbl">Duração' +
            '<input class="form-input" type="number" min="0" step="5" placeholder="min" value="' + dur + '" oninput="' + syncFn + '(' + s.id + ', \'duracao\', this.value)">' +
          '</label>' +
        '</div>' +
        '<div class="slot-date-row">' +
          buildSlotDateSelects(s, syncFn) +
          '<input class="form-input slot-sel-hora" type="time" placeholder="Início" value="' + (s.horario || '') + '" oninput="' + syncFn + '(' + s.id + ', \'horario\', this.value)">' +
        '</div>' +
        '<div class="slot-resumo" id="resumo-' + s.id + '">' + esc(slotResumoLinha(s)) + '</div>' +
        '<div class="slot-conflict" id="conflict-' + s.id + '">' + slotConflictHTML(s, slotCheckExcludeId) + '</div>' +
      '</div>' +
      (count > 1
        ? '<button class="slot-del" onclick="' + removeFn + '(' + s.id + ')" title="Remover">✕</button>'
        : '<div style="width:26px"></div>') +
    '</div>');
}

// Atualiza só a linha-resumo (sem re-render — preserva o foco nos inputs)
function updateSlotResumo(s) {
  const el = document.getElementById('resumo-' + s.id);
  if (el) el.textContent = slotResumoLinha(s);
  const cf = document.getElementById('conflict-' + s.id);
  if (cf) cf.innerHTML = slotConflictHTML(s, slotCheckExcludeId);
}

// Trata mudança em um campo de slot. Recebe o array (addSlots/fechSlots),
// a função de re-render e a de recálculo de total.
function syncSlotField(arr, id, campo, valor, rerender, recalc) {
  const s = arr.find(x => x.id === id);
  if (!s) return;
  if (campo === 'servico') {
    s.servico = valor;
    const svc = services.find(x => x.nome === valor);
    if (svc && !s._manual) s.valorUnit = svc.valor || 0;
    if (!s._durManual) s.duracao = getServiceDuration(valor);
    rerender();
  } else if (campo === 'valorUnit') {
    s.valorUnit = parseFloat(valor) || 0;
    s._manual = true;
    updateSlotResumo(s);
  } else if (campo === 'qtd') {
    s.qtd = Math.max(1, parseInt(valor) || 1);
    updateSlotResumo(s);
  } else if (campo === 'duracao') {
    s.duracao = Math.max(0, parseInt(valor) || 0);
    s._durManual = true;
    updateSlotResumo(s);
  } else if (campo === 'dia' || campo === 'mes' || campo === 'ano') {
    const p = slotDateParts(s);
    if (campo === 'dia') p.d = valor;
    if (campo === 'mes') p.m = valor;
    if (campo === 'ano') p.y = valor;
    if (p.m && p.d) {                       // não deixa o dia passar do fim do mês
      const maxD = daysInMonth(p.y, p.m);
      if (Number(p.d) > maxD) p.d = pad2(maxD);
    }
    s._y = p.y; s._m = p.m; s._d = p.d;
    s.data = (p.y && p.m && p.d) ? (p.y + '-' + p.m + '-' + p.d) : '';
    if (campo === 'mes' || campo === 'ano') rerender();   // atualiza a lista de dias
    else updateSlotResumo(s);
  } else {
    s[campo] = valor;            // horario
    updateSlotResumo(s);
  }
  recalc();
}

function addAddSlot() {
  const first = services[0] || { nome: '', valor: 0 };
  addSlots.push({
    id: Date.now() + Math.random(),
    servico: first.nome || '',
    valorUnit: first.valor || 0,
    data: '',
    horario: '',
    qtd: 1,
    duracao: getServiceDuration(first.nome || ''),
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
  document.getElementById('add-slots-list').innerHTML =
    addSlots.map((s, idx) => renderSlotRow(s, idx, addSlots.length, 'syncAddSlot', 'removerAddSlot')).join('');
}

function syncAddSlot(id, campo, valor) {
  syncSlotField(addSlots, id, campo, valor, renderAddSlots, recalcAddTotal);
}

function recalcAddTotal() {
  const total = addSlots.reduce((sum, s) => sum + (parseFloat(s.valorUnit) || 0) * slotQtd(s), 0);
  document.getElementById('add-valor').value = total ? fmt(total) : '';
}

// Expande as linhas (com qtd) em slots atômicas (uma por ocorrência),
// sequenciando os horários por data: cada ocorrência ocupa `duracao` minutos.
function expandRows(rows) {
  const valid = (rows || []).filter(r => r.servico);
  const byData = {};
  const ordem = [];
  valid.forEach(r => {
    const key = r.data || '';
    if (!byData[key]) { byData[key] = []; ordem.push(key); }
    byData[key].push(r);
  });
  const out = [];
  ordem.forEach(dataKey => {
    let cursor = '';
    byData[dataKey].forEach(r => {
      const qtd = slotQtd(r);
      const dur = parseInt(r.duracao) || getServiceDuration(r.servico);
      if (r.horario) cursor = r.horario;   // linha com horário próprio reposiciona o cursor
      for (let i = 0; i < qtd; i++) {
        out.push({
          servico: r.servico,
          valorUnit: parseFloat(r.valorUnit) || 0,
          data: r.data || '',
          horario: cursor || '',
          duracao: dur,
        });
        if (cursor) cursor = addMinutes(cursor, dur);
      }
    });
  });
  return out;
}

// Inverso: recolhe slots atômicas consecutivas e iguais em uma linha com qtd.
function collapseSlots(slots) {
  const rows = [];
  (slots || []).forEach(s => {
    const dur = parseInt(s.duracao) || getServiceDuration(s.servico);
    const val = parseFloat(s.valorUnit) || 0;
    const last = rows[rows.length - 1];
    if (last && last.servico === s.servico && last.data === (s.data || '') &&
        last.duracao === dur && last.valorUnit === val) {
      last.qtd += 1;
    } else {
      rows.push({
        id: Date.now() + Math.random(),
        servico: s.servico || '',
        valorUnit: val,
        data: s.data || '',
        horario: s.horario || '',
        duracao: dur,
        qtd: 1,
      });
    }
  });
  return rows;
}

function descreveSlots(slots) {
  if (!slots || !slots.length) return '';
  const grupos = {};
  const ordem = [];
  slots.forEach(s => {
    const key = s.servico || 'Serviço';
    if (!grupos[key]) { grupos[key] = { qtd: 0, datas: {} }; ordem.push(key); }
    grupos[key].qtd += slotQtd(s);
    if (s.data) grupos[key].datas[fmtDate(s.data)] = 1;
  });
  return ordem.map(nome => {
    const g = grupos[nome];
    const q = g.qtd > 1 ? ' ×' + g.qtd : '';
    const datas = Object.keys(g.datas);
    return nome + q + (datas.length ? ' (' + datas.join(', ') + ')' : '');
  }).join(', ');
}

async function saveNew() {
  const nome   = document.getElementById('add-nome').value.trim();
  const tel    = document.getElementById('add-tel').value.trim();
  const obs    = document.getElementById('add-obs').value.trim();
  const origem = document.getElementById('add-origem').value;
  const equipe = (document.getElementById('add-equipe') || {}).value?.trim() || '';

  const semTel = (document.getElementById('add-no-tel') || {}).checked;
  if (!nome) { toast('⚠️ Informe o nome do cliente'); return; }
  if (!tel && !semTel) { toast('⚠️ Informe o telefone'); return; }
  const slotsValidos = addSlots.filter(s => s.servico);
  if (!slotsValidos.length) { toast('⚠️ Adicione pelo menos um serviço'); return; }
  const dataInvalida = slotsValidos.find(s => s.data && !slotDateYearValid(s.data));
  if (dataInvalida) { toast('⚠️ Confira a data do serviço — ano fora do intervalo: ' + fmtDate(dataInvalida.data)); return; }

  const total = slotsValidos.reduce((s, x) => s + (parseFloat(x.valorUnit) || 0) * slotQtd(x), 0);
  const servicoDesc = descreveSlots(slotsValidos);
  const datasOrdenadas = slotsValidos.map(s => s.data).filter(Boolean).sort();
  const dataEvento = datasOrdenadas[0] || '';

  // Expande qtd → slots atômicas (uma por ocorrência, horários sequenciados)
  const slotsToStore = expandRows(slotsValidos);

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
    ValorFechado:'',
    Obs:          packSlots(obs, slotsToStore),
    Origem:       origem,
    Equipe:       equipe,
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
  const reqDateEl = document.getElementById('act-request-date');
  if (reqDateEl) reqDateEl.textContent = e.DataPedido ? 'Pedido em ' + fmtDateWeekFull(e.DataPedido) : '';
  const dataPedidoEl = document.getElementById('act-data-pedido');
  if (dataPedidoEl) dataPedidoEl.value = e.DataPedido || '';

  const badge = document.getElementById('act-badge');
  badge.textContent = e.Status || '—';
  badge.className = 'act-pill ' + (STATUS_CLASS[e.Status] || 'st-novo');

  // Vitais do summary card (data do evento, horário, valor, serviço)
  const _vslots = entrySlots(e);
  const _vhoras = _vslots.map(s => s.horario).filter(Boolean).sort();
  const _vData = document.getElementById('act-vital-data');
  const _vHora = document.getElementById('act-vital-hora');
  const _vVal  = document.getElementById('act-vital-valor');
  const _vSvc  = document.getElementById('act-vital-svc');
  if (_vData) _vData.textContent = e.DataEvento ? fmtDate(e.DataEvento) : '—';
  if (_vHora) _vHora.textContent = _vhoras.length ? fmtHorario(_vhoras[0]) : '—';
  const _vNum = parseFloat(e.Status === 'Fechado' ? (e.ValorFechado || e.ValorProp) : e.ValorProp) || 0;
  if (_vVal) _vVal.textContent = _vNum ? fmtVal(_vNum) : '—';
  if (_vSvc) _vSvc.textContent = e.Servico || '—';

  syncStatusSegUI(e.Status);

  document.getElementById('val-fechado-row').style.display = e.Status === 'Fechado' ? 'block' : 'none';
  document.getElementById('act-val-fechado').value = e.ValorFechado || '';
  document.getElementById('act-val-enviado').value = e.ValorProp || '';
  document.getElementById('act-obs').value      = entryCleanObs(e);
  const actEqChk = document.getElementById('act-eq-chk');
  const actEqInp = document.getElementById('act-equipe');
  if (actEqChk) actEqChk.checked = !!(e.Equipe);
  if (actEqInp) { actEqInp.value = e.Equipe || ''; actEqInp.style.display = e.Equipe ? '' : 'none'; if (e.Equipe) actEqInp.style.marginTop = '8px'; }
  toggleActEquipeInput(!!(e.Equipe));

  renderActEditSlots(e);
  renderActSlots(e);
  renderActGcalSection(e);
  renderActWaSection(e);
  renderActCompSection(String(id));
  renderActPropostaSection(e);
  openPanel('panel-action');
}

// Status como segmented control (4 segmentos; "Perdido" abre os submotivos)
async function applyStatusValue(newStatus) {
  const e = entries.find(x => String(x.ID) === String(activeId));
  if (!e) return;
  e.Status = newStatus;
  const badge = document.getElementById('act-badge');
  if (badge) { badge.textContent = newStatus; badge.className = 'act-pill ' + (STATUS_CLASS[newStatus] || 'st-novo'); }
  if (newStatus === 'Orçamento Enviado' && !e.DataEnvio) e.DataEnvio = todayStr();
  if (newStatus === 'Fechado' && !e.DataFechamento)     e.DataFechamento = todayStr();
  const vfr = document.getElementById('val-fechado-row');
  if (vfr) vfr.style.display = newStatus === 'Fechado' ? 'block' : 'none';
  // Seções que dependem do status (slots, Google Agenda, mensagem WhatsApp, botão Fechar)
  renderActEditSlots(e);
  renderActSlots(e);
  renderActGcalSection(e);
  renderActWaSection(e);
  cacheEntries();
  render();

  const fields = { Status: e.Status, DataEnvio: e.DataEnvio, DataFechamento: e.DataFechamento };
  const result = await postEntry({ action: 'update', id: e.ID, fields });
  if (!result.ok && result.error !== 'no-url') {
    toast('⚠️ Sincronização do status falhou');
  }
}

// Reflete o status atual no segmented control + submotivos
function syncStatusSegUI(status) {
  const isPerdido = PERDIDO_STATUS.includes(status);
  document.querySelectorAll('#status-seg button').forEach(b => {
    const on = isPerdido ? (b.dataset.seg === 'perdido') : (b.dataset.s === status);
    b.classList.toggle('on', on);
  });
  const sub = document.getElementById('status-sub');
  if (sub) {
    sub.classList.toggle('show', isPerdido);
    sub.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.s === status));
  }
}

function setStatusSeg(btn) {
  // "Perdido" só revela os submotivos — o status é aplicado ao escolher um
  if (btn.dataset.seg === 'perdido') {
    document.querySelectorAll('#status-seg button').forEach(b => b.classList.toggle('on', b === btn));
    const sub = document.getElementById('status-sub');
    if (sub) sub.classList.add('show');
    return;
  }
  applyStatusValue(btn.dataset.s);
  syncStatusSegUI(btn.dataset.s);
}

function setStatusSub(btn) {
  applyStatusValue(btn.dataset.s);
  syncStatusSegUI(btn.dataset.s);
}

// Accordion (seções recolhíveis) do action sheet
function toggleActAcc(head) {
  const acc = head.closest('.act-acc');
  if (acc) acc.classList.toggle('open');
}

// Edita a data de cadastro/recebimento do orçamento (DataPedido).
// Útil quando o orçamento é lançado dias depois de ter sido recebido.
async function updateDataPedido() {
  const e = entries.find(x => String(x.ID) === String(activeId));
  if (!e) return;
  const nova = document.getElementById('act-data-pedido').value;
  if (!nova) return;
  e.DataPedido = nova;
  const reqDateEl = document.getElementById('act-request-date');
  if (reqDateEl) reqDateEl.textContent = 'Pedido em ' + fmtDateWeekFull(e.DataPedido);
  cacheEntries();
  render();

  const result = await postEntry({ action: 'update', id: e.ID, fields: { DataPedido: e.DataPedido } });
  if (!result.ok && result.error !== 'no-url') {
    toast('⚠️ Sincronização da data falhou');
  } else if (result.ok) {
    toast('✅ Data do pedido atualizada');
  }
}

async function saveAction() {
  const e = entries.find(x => String(x.ID) === String(activeId));
  if (!e) return;
  const newObs = document.getElementById('act-obs').value;

  // Data / horário / serviço editados no cadastro (status ≠ Fechado).
  // Para fechados mantemos os slots atuais (o editor enxuto de data/horário já
  // repacka ao vivo, e alterar serviço/valor de um fechado não é feito por aqui).
  let slotsForPack = entrySlots(e);
  if (e.Status !== 'Fechado') {
    const validos = actEditSlots.filter(s => s.servico);
    if (validos.length) {
      const dataInvalida = validos.find(s => s.data && !slotDateYearValid(s.data));
      if (dataInvalida) { toast('⚠️ Confira a data do serviço — ano fora do intervalo: ' + fmtDate(dataInvalida.data)); return; }
      slotsForPack   = expandRows(validos);
      e.Servico      = descreveSlots(validos);
      const datas    = validos.map(s => s.data).filter(Boolean).sort();
      e.DataEvento   = datas[0] || '';
      const total    = validos.reduce((sum, s) => sum + (parseFloat(s.valorUnit) || 0) * slotQtd(s), 0);
      if (total) e.ValorProp = total;   // valor enviado acompanha o total dos serviços
    }
  }
  e.Obs = packSlots(newObs, slotsForPack);

  const dpEl = document.getElementById('act-data-pedido');
  if (dpEl && dpEl.value) e.DataPedido = dpEl.value;
  const vf = document.getElementById('act-val-fechado').value;
  const ve = document.getElementById('act-val-enviado').value;
  if (e.Status === 'Fechado' && vf) e.ValorFechado = vf;
  if (ve) e.ValorProp = ve;
  const actEqInp = document.getElementById('act-equipe');
  e.Equipe = (actEqInp && document.getElementById('act-eq-chk') && document.getElementById('act-eq-chk').checked)
    ? actEqInp.value.trim() : '';

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
    DataPedido:    e.DataPedido,
    DataEnvio:     e.DataEnvio,
    DataFechamento:e.DataFechamento,
    ValorFechado:  e.ValorFechado,
    ValorProp:     e.ValorProp,
    Servico:       e.Servico,
    DataEvento:    e.DataEvento || '',
    Obs:           e.Obs,
    Propostas:     Array.isArray(e.Propostas) ? e.Propostas : [],
    Equipe:        e.Equipe || '',
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
  slotCheckExcludeId = e.ID;   // não conflita com os próprios slots deste orçamento

  document.getElementById('fech-nome').textContent = e.Cliente || '';
  document.getElementById('fech-addr').value = '';
  document.getElementById('fech-obs').value  = entryCleanObs(e);
  document.getElementById('fech-origem').value = e.Origem || 'Produção Social';
  document.getElementById('fech-forma').value  = 'PIX';
  document.getElementById('fech-valor-enviado').value = e.ValorProp || '';

  // Recolhe slots atômicas em linhas com qtd (reabre já agrupado)
  const existingSlots = entrySlots(e);
  fechSlots = existingSlots.length
    ? collapseSlots(existingSlots)
    : [{ id: Date.now(), servico: (services[0] && services[0].nome) || '', valorUnit: (services[0] && services[0].valor) || 0, data: e.DataEvento || '', horario: '', qtd: 1, duracao: getServiceDuration((services[0] && services[0].nome) || '') }];
  renderFechSlots();

  const totalSlots = fechSlots.reduce((s, x) => s + (parseFloat(x.valorUnit) || 0) * slotQtd(x), 0);
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
    qtd: 1,
    duracao: getServiceDuration(first.nome || ''),
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
  document.getElementById('fech-slots-list').innerHTML =
    fechSlots.map((s, idx) => renderSlotRow(s, idx, fechSlots.length, 'syncFechSlot', 'removerFechSlot')).join('');
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
  if (campo === 'servico') autoDetectLocal(valor);
  syncSlotField(fechSlots, id, campo, valor, renderFechSlots, recalcFechTotalFromSlots);
}

function recalcFechTotalFromSlots() {
  const total = fechSlots.reduce((sum, s) => sum + (parseFloat(s.valorUnit) || 0) * slotQtd(s), 0);
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
  const dataInvalida = slotsValidos.find(s => s.data && !slotDateYearValid(s.data));
  if (dataInvalida) { toast('⚠️ Confira a data do serviço — ano fora do intervalo: ' + fmtDate(dataInvalida.data)); return; }

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
  // Expande qtd → slots atômicas (horários sequenciados por data)
  const slotsToStore = expandRows(slotsValidos);
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

  // 2) Sincroniza com o Supabase (com retry automático em caso de falha)
  const fechFields = {
    Status:         e.Status,
    ValorFechado:   e.ValorFechado,
    ValorProp:      e.ValorProp,
    DataFechamento: e.DataFechamento,
    DataEvento:     e.DataEvento,
    Servico:        e.Servico,
    Obs:            e.Obs,
    Origem:         e.Origem,
    Propostas:      Array.isArray(e.Propostas) ? e.Propostas : [],
  };
  let updResult = await postEntry({ action: 'update', id: e.ID, fields: fechFields });
  if (!updResult.ok) {
    await new Promise(r => setTimeout(r, 2500));
    updResult = await postEntry({ action: 'update', id: e.ID, fields: fechFields });
  }
  if (!updResult.ok) {
    // Salva como pendente — syncAll vai replicar ao reconectar
    try {
      const pending = safeJSON(localStorage.getItem('orca_pending_status'), {});
      pending[String(e.ID)] = fechFields;
      localStorage.setItem('orca_pending_status', JSON.stringify(pending));
    } catch(_) {}
  }

  setLoadingStep(1, 'Lançando no financeiro...', 'Registrando sinal e restante');

  // 3) Lança Sinal + Restante no Financeiro (Supabase)
  let finResult = { ok: true };
  const local = fechLocal === 'studio' ? 'Studio' : 'Domicílio';
  const dataEvento = e.DataEvento || todayStr();
  // Sinal sempre na data do fechamento (hoje), recebido ou a receber.
  // Só o status muda; o restante é que vai para o dia do evento.
  const dataPagSinal = todayStr();

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
      equipe: e.Equipe || '',
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
      equipe: e.Equipe || '',
      auto: true,
      createdAt: new Date().toISOString(),
      noivaId: ''
    };
    const r2 = await finEntryCreate(eSaldo);
    if (!r2.ok && finResult.ok) finResult = { ok: false, error: r2.error || 'saldo' };
  }

  setLoadingStep(2, 'Preparando confirmação...', 'Quase lá!');

  // 4) Prepara dados para Google Agenda + WhatsApp (usa slots expandidas)
  const eventos = buildEventos(e.Cliente, slotsToStore, endereco, total, sinal, saldo, e.Telefone, e.Equipe || '');
  const waText  = buildConfirmacaoMessage(e.Cliente, slotsToStore, total, sinal, saldo, endereco, fechLocal);

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
  else items.push({ tipo: 'warn', txt: '⚠️ Orçamento salvo localmente — será sincronizado automaticamente ao reconectar' });

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

function renderActSlots(e) {
  const section = document.getElementById('act-slots-section');
  if (!section) return;

  if (e.Status !== 'Fechado') { section.style.display = 'none'; return; }

  const slots = entrySlots(e);
  if (!slots.length) { section.style.display = 'none'; return; }

  section.style.display = 'block';
  const list = document.getElementById('act-slots-list');
  list.innerHTML = slots.map((s, idx) => {
    const horarioMissing = !s.horario;
    const dataMissing    = !s.data;
    const warnRow = horarioMissing || dataMissing;
    const warnMsgs = [];
    if (dataMissing)    warnMsgs.push('data');
    if (horarioMissing) warnMsgs.push('horário');
    return (
      '<div class="slot-row" style="margin-bottom:8px;' + (warnRow ? 'background:#fff8e1;border-radius:8px;padding:8px;' : '') + '">' +
        '<div class="slot-num">' + (idx + 1) + '</div>' +
        '<div class="slot-fields">' +
          '<div style="font-size:0.78rem; color:var(--brown); font-weight:700;">' + esc(s.servico || 'Serviço') + '</div>' +
          '<div class="form-row">' +
            '<input class="form-input" type="date" value="' + esc(s.data || '') + '" oninput="syncActSlot(' + idx + ', \'data\', this.value)">' +
            '<input class="form-input" type="time" placeholder="Horário" value="' + esc(s.horario || '') + '" oninput="syncActSlot(' + idx + ', \'horario\', this.value)">' +
          '</div>' +
          (warnRow ? '<div style="font-size:0.66rem; color:#c62828;">⚠️ Preencha ' + warnMsgs.join(' e ') + ' para poder agendar</div>' : '') +
        '</div>' +
      '</div>'
    );
  }).join('');
}

let _actSlotSyncTimer = null;
function syncActSlot(idx, campo, valor) {
  const e = entries.find(x => String(x.ID) === String(activeId));
  if (!e) return;
  const slots = entrySlots(e);
  if (!slots[idx]) return;

  slots[idx][campo] = valor;
  e.Obs = packSlots(entryCleanObs(e), slots);

  const datas = slots.map(s => s.data).filter(Boolean).sort();
  if (datas.length) e.DataEvento = datas[0];

  cacheEntries();
  renderActSlots(e);

  clearTimeout(_actSlotSyncTimer);
  _actSlotSyncTimer = setTimeout(() => {
    postEntry({ action: 'update', id: e.ID, fields: { Obs: e.Obs, DataEvento: e.DataEvento || '' } });
    render();
  }, 600);
}

// ══════════════════════════════════════════════════════════
//  EDIÇÃO DE DATA / HORÁRIO / SERVIÇO NO CADASTRO (status ≠ Fechado)
//  Reaproveita a UI de slots do "Novo"/"Fechar" (renderSlotRow/syncSlotField).
//  Fechados continuam usando o editor enxuto de data/horário (act-slots-section),
//  porque mexer em serviço/valor de um fechado afetaria financeiro/agenda já criados.
// ══════════════════════════════════════════════════════════
let actEditSlots = [];

function renderActEditSlots(e) {
  const acc = document.getElementById('act-edit-slots-acc');
  if (!acc) return;
  if (e.Status === 'Fechado') { acc.style.display = 'none'; return; }
  acc.style.display = 'block';

  slotCheckExcludeId = e.ID;   // não conflita com os próprios slots deste orçamento
  const existentes = collapseSlots(entrySlots(e));
  const first = services[0] || { nome: '', valor: 0 };
  actEditSlots = existentes.length ? existentes : [{
    id: Date.now() + Math.random(),
    servico:   e.Servico || first.nome || '',
    valorUnit: parseFloat(e.ValorProp) || first.valor || 0,
    data:      e.DataEvento || '',
    horario:   '',
    qtd:       1,
    duracao:   getServiceDuration(e.Servico || first.nome || ''),
  }];
  renderActEditSlotsList();
}

function renderActEditSlotsList() {
  const list = document.getElementById('act-edit-slots-list');
  if (!list) return;
  list.innerHTML = actEditSlots
    .map((s, idx) => renderSlotRow(s, idx, actEditSlots.length, 'syncActEditSlot', 'removerActEditSlot'))
    .join('');
}

function syncActEditSlot(id, campo, valor) {
  syncSlotField(actEditSlots, id, campo, valor, renderActEditSlotsList, recalcActEdit);
}

function addActEditSlot() {
  const first = services[0] || { nome: '', valor: 0 };
  actEditSlots.push({
    id: Date.now() + Math.random(),
    servico:   first.nome || '',
    valorUnit: first.valor || 0,
    data:      '',
    horario:   '',
    qtd:       1,
    duracao:   getServiceDuration(first.nome || ''),
  });
  renderActEditSlotsList();
  recalcActEdit();
}

function removerActEditSlot(id) {
  if (actEditSlots.length <= 1) { toast('⚠️ Pelo menos um serviço é necessário'); return; }
  actEditSlots = actEditSlots.filter(s => s.id !== id);
  renderActEditSlotsList();
  recalcActEdit();
}

// Prévia ao vivo: atualiza o cartão de vitais + o valor enviado (sem salvar).
function recalcActEdit() {
  const validos = actEditSlots.filter(s => s.servico);
  const total = validos.reduce((sum, s) => sum + (parseFloat(s.valorUnit) || 0) * slotQtd(s), 0);
  const datas = validos.map(s => s.data).filter(Boolean).sort();
  const horas = validos.map(s => s.horario).filter(Boolean).sort();

  const vData = document.getElementById('act-vital-data');
  const vHora = document.getElementById('act-vital-hora');
  const vVal  = document.getElementById('act-vital-valor');
  const vSvc  = document.getElementById('act-vital-svc');
  if (vData) vData.textContent = datas.length ? fmtDate(datas[0]) : '—';
  if (vHora) vHora.textContent = horas.length ? fmtHorario(horas[0]) : '—';
  if (vVal)  vVal.textContent  = total ? fmtVal(total) : '—';
  if (vSvc)  vSvc.textContent  = validos.length ? descreveSlots(validos) : '—';

  const enviado = document.getElementById('act-val-enviado');
  if (enviado) enviado.value = total || '';
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

// Reconstrói a mensagem de confirmação do WhatsApp de um orçamento já fechado,
// usando os dados gravados no fechamento (mesma lógica de confirmarFechamento).
function buildActWaText(e) {
  const slots     = entrySlots(e);
  const localTipo = e.LocalTipo || 'studio';
  const endereco  = e.EnderecoEvento || (localTipo === 'studio' ? END_STUDIO : '');
  const total = parseFloat(e.ValorFechado) || parseFloat(e.ValorProp) || 0;
  const sinal = (e.SinalFech !== undefined && e.SinalFech !== '')
    ? parseFloat(e.SinalFech) : Math.round(total * 0.30 * 100) / 100;
  const saldo = (e.SaldoFech !== undefined && e.SaldoFech !== '')
    ? parseFloat(e.SaldoFech) : Math.max(0, total - sinal);
  return buildConfirmacaoMessage(e.Cliente, slots, total, sinal, saldo, endereco, localTipo);
}

// Mostra a mensagem do WhatsApp no action sheet (só para fechados).
// Fica num accordion recolhido — reabre a mensagem mesmo depois de fechado.
function renderActWaSection(e) {
  const section = document.getElementById('act-wa-section');
  if (!section) return;
  if (e.Status !== 'Fechado') { section.style.display = 'none'; return; }
  section.style.display = 'block';
  section.classList.remove('open'); // começa recolhido — só abre ao clicar
  const bubble = document.getElementById('act-wa-text');
  if (bubble) bubble.textContent = buildActWaText(e);
}

function copiarMensagemAction() {
  const e = entries.find(x => String(x.ID) === String(activeId));
  if (!e) return;
  navigator.clipboard.writeText(buildActWaText(e)).then(() => toast('📋 Mensagem copiada'));
}

function sendWAAction() {
  const e = entries.find(x => String(x.ID) === String(activeId));
  if (!e) return;
  const phone = formatPhone(e.Telefone);
  const url = 'https://wa.me/' + phone + '?text=' + encodeURIComponent(buildActWaText(e));
  window.open(url, '_blank');
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

  const eventos = buildEventos(e.Cliente, slots, endereco, total, sinal, saldo, e.Telefone, e.Equipe || '');
  const validos = eventos.filter(ev => ev.startISO && ev.endISO);

  if (!validos.length) {
    toast('⚠️ Preencha data e horário acima — destacados em amarelo');
    const sec = document.getElementById('act-slots-section');
    if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

let currentCompCat = 'sinal'; // mantido por compat; uploads novos sempre 'sinal'

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

  // Sinal primeiro (sem rótulo — é o foco da aba)
  const sinalItems = arr.filter(ci => ci.categoria === 'sinal');
  sinalItems.forEach(item => { html += renderCompItem(id, item); });

  // Legados (restante/outros) — exibidos com rótulo, sem permitir adicionar novos
  const legacyCats = ['restante', 'outros'];
  legacyCats.forEach(cat => {
    const items = arr.filter(ci => ci.categoria === cat);
    if (!items.length) return;
    html += '<div class="comp-cat-lbl">' + catLabels[cat] + ' <span style="font-size:0.58rem;font-weight:600;color:var(--muted);text-transform:none;letter-spacing:0">(legado)</span></div>';
    items.forEach(item => { html += renderCompItem(id, item); });
  });
  // Sem categoria definida
  arr.filter(ci => !cats.includes(ci.categoria)).forEach(item => {
    html += renderCompItem(id, item);
  });

  html += '</div>';

  // Upload único — sempre vai como 'sinal'
  currentCompCat = 'sinal';
  html +=
    '<div class="comp-add-area">' +
      '<div class="comp-upload" onclick="document.getElementById(\'act-comp-input\').click()">' +
        '📎 Adicionar comprovante do sinal<br>' +
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

  const categoria = 'sinal';

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

// Deep-link: ?openId=<ID> abre direto o card do orçamento (usado pelos alertas
// do sino — ver shared/js/alerts.js). Roda após o syncAll para garantir que
// `entries` já esteja carregado.
function openFromUrl() {
  try {
    const id = new URLSearchParams(location.search).get('openId');
    if (!id) return;
    // limpa o param pra um refresh manual não reabrir o card
    history.replaceState(null, '', location.pathname);
    if (entries.find(x => String(x.ID) === String(id))) openAction(id);
  } catch (_) {}
}

(function init() {
  curFilter = localStorage.getItem('orca_cur_filter') || 'todos';
  curOrigem = localStorage.getItem('orca_cur_origem') || 'todos';
  curEquipe = localStorage.getItem('orca_cur_equipe') || 'todos';
  render();
  syncAll().then(openFromUrl);
})();