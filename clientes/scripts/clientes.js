// ══════════════════════════════════════════════════════════
//  CONSTANTES
// ══════════════════════════════════════════════════════════
const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DIAS   = ['domingo','segunda','terça','quarta','quinta','sexta','sábado'];
const SRV_ICON = {
  'Maquiagem':'💄', 'Cabelo':'💇‍♀️', 'Maquiagem e Cabelo':'✨',
  'Maquiagem no Studio':'💄', 'Maquiagem e Cabelo no Studio':'✨', 'Cabelo no Studio':'💇‍♀️',
  'Maquiagem em domicílio':'💄', 'Maquiagem e Cabelo em domicílio':'✨', 'Cabelo em domicílio':'💇‍♀️',
  'Curso de Automaquiagem':'📚'
};

const CAL_ID = 'c82d7e89c34b742daed656c5aa3113d25cb3feda4e8f159936750f2e17473b38@group.calendar.google.com';

// ── DATA ──────────────────────────────────────────────────
let entries        = JSON.parse(localStorage.getItem('mk_entries') || '[]');
let calMap         = {};
let selMonth       = new Date().getMonth();
let selYear        = new Date().getFullYear();
let curFilter      = 'todos';
let curEquipeFilter= 'todos';

// ── FOLLOW UP ─────────────────────────────────────────────
let fuEntryMap  = {};   // id → entry (populado em render)
let fuActiveId  = null; // id do entry aberto no modal
let fuActiveType= 'pos-imediato';

function safeJSONcli(s, fb) { try { return s ? JSON.parse(s) : fb; } catch(_) { return fb; } }

// ── UTILS ─────────────────────────────────────────────────
function todayStr() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
}

// ══════════════════════════════════════════════════════════
//  STATUS REAL DO ATENDIMENTO
//  Regra: se a data do serviço ainda não chegou → Previsto
//  independentemente de o pagamento já ter sido feito.
// ══════════════════════════════════════════════════════════
function statusDoAtendimento(entry) {
  const dateServ = entry.dataServ || entry.dataPag;
  if (dateServ && dateServ > todayStr()) return 'Previsto';
  return entry.status || 'Previsto';
}

function dot(state) {
  const labels = { syncing:'Carregando...', ok:'', offline:'Sem conexão' };
  const el = document.getElementById('hsub');
  if (el) el.textContent = labels[state] || '';
}

// ══════════════════════════════════════════════════════════
//  NAVEGAÇÃO
// ══════════════════════════════════════════════════════════
function chm(d) {
  selMonth += d;
  if (selMonth < 0)  { selMonth = 11; selYear--; }
  if (selMonth > 11) { selMonth = 0;  selYear++; }
  calMap = {};
  render();
  loadCalendar();
}

function setF(btn) {
  curFilter = btn.dataset.f;
  document.querySelectorAll('.ftab').forEach(b => b.classList.toggle('on', b === btn));
  render();
}

function setEquipeF(v) {
  curEquipeFilter = v;
  render();
}

function checkAuth() {
  const session = localStorage.getItem('mk_session');
  if (session) {
    try {
      const { expires } = JSON.parse(session);
      if (Date.now() < expires) return;
    } catch(_) {}
    localStorage.removeItem('mk_session');
  }
  window.location.href = '../';
}

function syncAll() {
  dot('syncing');
  calMap = {};
  loadFromSupabase();
  loadCalendar();
}

async function loadFromSupabase() {
  try {
    dot('syncing');
    const result = await DB.entries.list();
    if (Array.isArray(result)) {
      entries = result;
      localStorage.setItem('mk_entries', JSON.stringify(entries));
      dot('ok');
    } else {
      dot('offline');
    }
  } catch(e) {
    dot('offline');
  }
  render();
}

// ══════════════════════════════════════════════════════════
//  GOOGLE AGENDA — busca horários dos eventos salvos
//  pelo sistema de Confirmação de Agendamento.
//  Formato do título: "10h00 - 11h00 | Nome | Serviço | Local"
// ══════════════════════════════════════════════════════════
async function loadCalendar() {
  if (!window.cowork) return;
  try {
    const start = new Date(selYear, selMonth, 1).toISOString();
    const end   = new Date(selYear, selMonth + 1, 0, 23, 59, 59).toISOString();
    const result = await window.cowork.callMcpTool(
      'mcp__26a09c15-4d33-4f5b-87c7-da8ae7d87b7c__list_events',
      { calendarId: CAL_ID, timeMin: start, timeMax: end }
    );
    const items = result?.items || result?.events || (Array.isArray(result) ? result : []);
    calMap = {};
    items.forEach(ev => {
      const title = ev.summary || ev.title || '';
      const parts = title.split(' | ');
      if (parts.length >= 2) {
        const rawTime   = parts[0].trim().split(' - ')[0].trim();
        const time      = rawTime.replace(/(\d{1,2})h(\d{2})/, '$1:$2').replace(/(\d{1,2})h$/, '$1:00');
        const rawClient = parts[1]?.trim();
        const dateStr   = (ev.start?.dateTime || ev.start?.date || '').split('T')[0];
        if (dateStr && rawClient && time) {
          if (!calMap[dateStr]) calMap[dateStr] = [];
          calMap[dateStr].push({ time, rawClient });
        }
      }
    });

    // Aviso se há entradas no mês mas nenhum horário encontrado no calendário
    const hasThisMonth = entries.some(e => {
      const date = e.dataServ || e.dataPag;
      if (!date) return false;
      const [y, m] = date.split('-');
      return parseInt(y) === selYear && parseInt(m) - 1 === selMonth;
    });
    const hasCalData = Object.keys(calMap).length > 0;
    document.getElementById('aviso').classList.toggle('show', hasThisMonth && !hasCalData);
    render();
  } catch(e) { /* Google Agenda não disponível */ }
}

function matchHorario(entry) {
  const date = entry.dataServ || entry.dataPag;
  if (!date || !calMap[date]?.length) return null;
  const cli = norm(entry.cliente);
  for (const ev of calMap[date]) {
    const ec = norm(ev.rawClient);
    if (ec === cli || ec.includes(cli) || cli.includes(ec)) return ev.time;
  }
  // fallback: primeiro nome (mínimo 3 caracteres)
  const first = cli.split(' ')[0];
  if (first.length >= 3) {
    for (const ev of calMap[date]) {
      if (norm(ev.rawClient).includes(first)) return ev.time;
    }
  }
  return null;
}

function norm(s) {
  return (s || '').toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// ══════════════════════════════════════════════════════════
//  RENDER
// ══════════════════════════════════════════════════════════
function render() {
  const hoje = todayStr();
  document.getElementById('mlab').textContent = `${MONTHS[selMonth]} ${selYear}`;

  // Filtrar por mês — usa dataServ como data do atendimento
  let list = entries.filter(e => {
    const date = e.dataServ || e.dataPag;
    if (!date) return false;
    const [y, m] = date.split('-');
    return parseInt(y) === selYear && parseInt(m) - 1 === selMonth;
  });

  // Deduplicar: mesmo cliente + mesma data → uma entrada por atendimento
  // Para decidir o status final: se alguma entrada para esse par é Realizado E a data já passou → Realizado
  const map = {};
  list.forEach(e => {
    const key = `${e.dataServ || e.dataPag}|${norm(e.cliente)}`;
    if (!map[key]) { map[key] = e; return; }
    // Prefere entrada com status Realizado (para datas passadas, o statusDoAtendimento vai usar isso)
    if (map[key].status === 'Previsto' && e.status === 'Realizado') map[key] = e;
  });
  let uniq = Object.values(map);

  // Aplicar filtro por tab
  if (curFilter === 'Noiva') {
    uniq = uniq.filter(e => e.origem === 'Noiva');
  } else if (curFilter !== 'todos') {
    uniq = uniq.filter(e => statusDoAtendimento(e) === curFilter);
  }

  // Aplicar filtro por equipe
  if (curEquipeFilter === '__sem__') uniq = uniq.filter(e => !e.equipe);
  else if (curEquipeFilter !== 'todos') uniq = uniq.filter(e => e.equipe === curEquipeFilter);

  // Montar filtro de equipe dinâmico
  const equipesNoMes = [...new Set(Object.values(map).map(e => e.equipe).filter(Boolean))];
  const equipeTabsEl = document.getElementById('equipe-tabs');
  if (equipeTabsEl) {
    if (equipesNoMes.length) {
      equipeTabsEl.style.display = '';
      const opts = [{eq:'todos',l:'Todas'},{eq:'__sem__',l:'Sem equipe'},...equipesNoMes.map(eq=>({eq,l:eq}))];
      equipeTabsEl.innerHTML = opts.map(o=>`<button class="ftab${curEquipeFilter===o.eq?' on':''}" onclick="setEquipeF('${o.eq}')">${o.l}</button>`).join('');
    } else {
      equipeTabsEl.style.display = 'none';
    }
  }

  const total      = uniq.length;
  const realizados = uniq.filter(e => statusDoAtendimento(e) === 'Realizado').length;
  const previstos  = uniq.filter(e => statusDoAtendimento(e) === 'Previsto').length;

  document.getElementById('msub').textContent = total
    ? `${total} atendimento${total !== 1 ? 's' : ''}`
    : '';

  document.getElementById('chips').innerHTML = total ? `
    <div class="chip">
      <div class="chip-lbl">Total</div>
      <div class="chip-val">${total}</div>
    </div>
    <div class="chip">
      <div class="chip-lbl" style="color:var(--ok)">Realizados</div>
      <div class="chip-val" style="color:var(--ok)">${realizados}</div>
    </div>
    <div class="chip">
      <div class="chip-lbl" style="color:#7c4a00">Previstos</div>
      <div class="chip-val" style="color:var(--amber)">${previstos}</div>
    </div>
  ` : '';

  const content = document.getElementById('content');

  if (total === 0) {
    content.innerHTML = `
      <div class="empty">
        <span class="ico">📋</span>
        <p>Nenhum atendimento em<br><strong>${MONTHS[selMonth]} ${selYear}</strong></p>
      </div>`;
    return;
  }

  // Ordenar por data → horário
  uniq.sort((a, b) => {
    const da = a.dataServ || a.dataPag || '';
    const db = b.dataServ || b.dataPag || '';
    if (da !== db) return da.localeCompare(db);
    return (matchHorario(a) || '99:99').localeCompare(matchHorario(b) || '99:99');
  });

  // Agrupar por data
  const byDate = {};
  uniq.forEach(e => {
    const d = e.dataServ || e.dataPag;
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(e);
  });

  content.innerHTML = Object.keys(byDate).sort().map(date => {
    const [y, m, d] = date.split('-').map(Number);
    const wd       = new Date(y, m - 1, d).getDay();
    const isToday  = date === hoje;
    const label    = `${String(d).padStart(2,'0')}/${String(m).padStart(2,'0')}`;
    const items    = byDate[date];

    const rows = items.map(e => {
      const status   = statusDoAtendimento(e);
      const isReal   = status === 'Realizado';
      const isNoiva  = e.origem === 'Noiva';
      const horario  = matchHorario(e);
      const icon     = SRV_ICON[e.servico] || '💅';
      const srv      = e.servico || '—';
      const localTag = e.local === 'Studio' || (e.servico||'').toLowerCase().includes('studio')
        ? 'Studio'
        : (e.local === 'Em Domicílio' || (e.servico||'').toLowerCase().includes('domicílio'))
          ? 'Domicílio' : (e.local || '');

      const equipeTag = e.equipe ? `<span style="display:inline-block;background:#e0f7fa;color:#006064;border-radius:8px;padding:1px 7px;font-size:.65rem;font-weight:600;margin-left:4px;vertical-align:middle">↑ ${e.equipe}</span>` : '';

      // Registro de follow ups já enviados para essa entry
      const eid   = e.id || (e.dataServ||e.dataPag||'') + '|' + (e.cliente||'').toLowerCase().trim();
      fuEntryMap[eid] = e;
      const fuHist   = fuGetHistory(eid);
      const fuBadge  = fuHist.length ? `<span class="fu-hist-dot">${fuHist.length}</span>` : '';
      const amanha   = new Date(); amanha.setDate(amanha.getDate() + 1);
      const amanhaStr = amanha.toISOString().split('T')[0];
      const fuLabel  = (e.dataServ || e.dataPag) === amanhaStr ? '📅 Confirmar amanhã' : '📲 Follow Up';

      return `
        <div class="entry ${isReal ? 'real' : 'prev'} ${isNoiva ? 'noiva' : ''} entry-fu">
          ${isNoiva ? `<div class="noiva-emoji">👰</div>` : ''}
          <div class="e-time">${horario
            ? `<div class="e-time-val">${horario}</div>`
            : `<div class="e-time-em">—</div>`}</div>
          <div class="e-info">
            <div class="e-name">${e.cliente || '(sem nome)'}${equipeTag}</div>
            <div class="e-srv">
              ${icon} ${srv}
              ${localTag ? `<span class="e-local">${localTag}</span>` : ''}
            </div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px;flex-shrink:0">
            ${isNoiva ? `<span class="noiva-tag">💍 Noiva</span>` : ''}
            <span class="badge ${isReal ? 'badge-real' : 'badge-prev'}">${isReal ? 'Realizado' : 'Previsto'}</span>
          </div>
          <div class="fu-row">
            <button class="fu-open-btn" onclick="event.stopPropagation(); openFuById('${eid.replace(/'/g, "\\'")}')">
              ${fuLabel}${fuBadge}
            </button>
          </div>
        </div>`;
    }).join('');

    return `
      <div class="dg ${isToday ? 'dg-today' : ''}">
        <div class="dg-hdr">
          <span class="dg-pill">${label}${isToday ? ' · hoje' : ''}</span>
          <span class="dg-wd">${DIAS[wd]}</span>
          ${items.length > 1 ? `<span class="dg-count">${items.length}</span>` : ''}
        </div>
        ${rows}
      </div>`;
  }).join('');
}

// ══════════════════════════════════════════════════════════
//  FOLLOW UP — Templates
// ══════════════════════════════════════════════════════════
const FU_TIPOS = {
  'd1': {
    label: 'Confirmar D-1',
    icon: '📅',
    hint: 'Enviar na véspera do atendimento',
    texto(nome, srv, horario, local) {
      const h = horario ? `, às ${horario}` : '';
      const l = local ? ` — ${local}` : '';
      return `Oi, ${nome}! 🤍\n\nPassei para lembrar que seu atendimento de ${srv||'make'} está confirmado para amanhã${h}${l}.\n\nSe tiver alguma dúvida de última hora, me chama aqui. Até amanhã!`;
    }
  },
  'pos-imediato': {
    label: 'Pós-atendimento',
    icon: '🌸',
    hint: 'Enviar no mesmo dia, logo após',
    texto(nome, srv) {
      return `Que lindo foi esse dia! Obrigada pela confiança, ${nome}. Foi uma alegria cuidar de você. 🤍\n\nManda foto quando puder — adoro ver o resultado no mundo real!`;
    }
  },
  'pos-24h': {
    label: 'Pós 24h',
    icon: '💬',
    hint: 'Enviar no dia seguinte',
    texto(nome, srv) {
      return `Oi, ${nome}! Tudo bem? Fiquei pensando em você — como foi o resto do dia? 💜`;
    }
  },
  'pos-7d': {
    label: 'Depoimento (7 dias)',
    icon: '🌟',
    hint: 'Pedir depoimento e feedback',
    texto(nome, srv) {
      return `Oi, ${nome}! Espero que esteja ótima. 🤍\n\nFicou curiosa — a make segurou bem? Ficaria muito feliz se você quisesse me contar como foi a experiência!\n\nE se quiser deixar um depoimento, adoraria — ajuda muito uma freelancer como eu. 🙏`;
    }
  },
  'indicacao': {
    label: 'Indicação',
    icon: '💛',
    hint: 'Pedir indicação de amigas',
    texto(nome, srv) {
      return `Oi, ${nome}! Espero que esteja ótima. 🤍\n\nSe você gostou do atendimento e tiver amigas que precisem de make para noiva ou evento, fico feliz que me indique!\n\nObrigada pela confiança. 🙏`;
    }
  },
  'reconexao': {
    label: 'Reconexão (30-60d)',
    icon: '💌',
    hint: 'Manter relacionamento ativo',
    texto(nome, srv) {
      return `Oi, ${nome}! Faz um tempinho que não falamos. Tudo bem? Se tiver algum evento chegando, me chama! 💜`;
    }
  }
};

// ══════════════════════════════════════════════════════════
//  FOLLOW UP — Storage
// ══════════════════════════════════════════════════════════
function fuGetHistory(eid) {
  const all = safeJSONcli(localStorage.getItem('mk_fu_history_cli'), {});
  return all[String(eid)] || [];
}
function fuAddHistory(eid, record) {
  const all = safeJSONcli(localStorage.getItem('mk_fu_history_cli'), {});
  const key = String(eid);
  if (!all[key]) all[key] = [];
  all[key].unshift(record);
  localStorage.setItem('mk_fu_history_cli', JSON.stringify(all));
}

// ══════════════════════════════════════════════════════════
//  FOLLOW UP — Lógica de abertura
// ══════════════════════════════════════════════════════════
function guessPhone(nome) {
  const orca = safeJSONcli(localStorage.getItem('orca_entries'), []);
  const n = (nome || '').toLowerCase().trim();
  let match = orca.find(o => (o.Cliente || '').toLowerCase().trim() === n);
  if (!match) {
    const first = n.split(' ')[0];
    if (first.length >= 3)
      match = orca.find(o => (o.Cliente || '').toLowerCase().startsWith(first));
  }
  return match ? (match.Telefone || '') : '';
}

function openFuById(eid) {
  const entry = fuEntryMap[eid];
  if (!entry) return;
  fuActiveId = eid;

  const amanha = new Date();
  amanha.setDate(amanha.getDate() + 1);
  const amanhaStr = amanha.toISOString().split('T')[0];
  const dataEntry = entry.dataServ || entry.dataPag || '';
  if (dataEntry === amanhaStr) fuActiveType = 'd1';
  else if (dataEntry > todayStr()) fuActiveType = 'd1';
  else fuActiveType = 'pos-imediato';

  const phone = guessPhone(entry.cliente);
  fuRenderModal(entry, phone);
}

function setFuType(tipo) {
  fuActiveType = tipo;
  const entry = fuEntryMap[fuActiveId];
  if (!entry) return;
  document.querySelectorAll('.fu-tipo-btn').forEach(b =>
    b.classList.toggle('on', b.dataset.tipo === tipo)
  );
  const nome    = (entry.cliente || '').split(' ')[0] || 'cliente';
  const srv     = entry.servico || '';
  const horario = matchHorario(entry) || '';
  const local   = entry.local || '';
  const tpl     = FU_TIPOS[tipo];
  const msgEl   = document.getElementById('fu-msg-preview');
  if (msgEl && tpl) msgEl.textContent = tpl.texto(nome, srv, horario, local);
  const hintEl = document.getElementById('fu-tipo-hint');
  if (hintEl && tpl) hintEl.textContent = tpl.hint;
}

function closeFu() {
  const m = document.getElementById('fu-modal');
  if (m) { m.classList.remove('show'); setTimeout(() => m.remove(), 200); }
  fuActiveId = null;
}

function fuGetCurrentText() {
  const el = document.getElementById('fu-msg-preview');
  return el ? (el.innerText || el.textContent || '') : '';
}

function fuSendWA() {
  const entry = fuEntryMap[fuActiveId];
  if (!entry) return;
  const text     = fuGetCurrentText();
  const rawPhone = (document.getElementById('fu-phone-input').value || '').replace(/\D/g, '');
  if (!rawPhone) { alert('Informe o telefone da cliente para abrir o WhatsApp!'); return; }
  const phone = rawPhone.startsWith('55') ? rawPhone : '55' + rawPhone;
  window.open('https://wa.me/' + phone + '?text=' + encodeURIComponent(text), '_blank');
  const tpl = FU_TIPOS[fuActiveType];
  fuAddHistory(fuActiveId, { date: todayStr(), tipo: 'wa', label: tpl ? tpl.icon + ' ' + tpl.label : fuActiveType });
  fuRefreshHistory(fuActiveId);
  render(); // atualiza badge do botão no card
}

function fuCopy() {
  const text = fuGetCurrentText();
  if (!text) return;
  const tpl = FU_TIPOS[fuActiveType];
  const doLog = () => {
    fuAddHistory(fuActiveId, { date: todayStr(), tipo: 'copy', label: tpl ? tpl.icon + ' ' + tpl.label + ' (copiado)' : fuActiveType });
    fuRefreshHistory(fuActiveId);
    render();
    const btn = document.querySelector('.fu-btn-copy');
    if (btn) { btn.textContent = '✅ Copiado!'; setTimeout(() => btn.textContent = '📋 Copiar', 2000); }
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(doLog).catch(() => { _fuFallbackCopy(text); doLog(); });
  } else { _fuFallbackCopy(text); doLog(); }
}
function _fuFallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); } catch(_) {}
  document.body.removeChild(ta);
}

function fuRefreshHistory(eid) {
  const hist  = fuGetHistory(eid);
  const el    = document.getElementById('fu-hist-list');
  if (!el) return;
  el.innerHTML = hist.length
    ? hist.slice(0, 8).map(h => `
        <div class="fu-hist-item">
          <span class="fu-hist-label">${h.label || h.tipo || '—'}</span>
          <span class="fu-hist-date">${fuFmtDate(h.date)}</span>
        </div>`).join('')
    : '<div class="fu-hist-empty">Nenhum follow up enviado ainda</div>';
}
function fuFmtDate(d) {
  if (!d) return '';
  const [, m, dd] = d.split('-');
  return `${dd}/${m}`;
}

// ══════════════════════════════════════════════════════════
//  FOLLOW UP — Render do modal
// ══════════════════════════════════════════════════════════
function fuRenderModal(entry, phone) {
  const existing = document.getElementById('fu-modal');
  if (existing) existing.remove();

  const nome    = (entry.cliente || '').split(' ')[0] || 'cliente';
  const srv     = entry.servico || '';
  const horario = matchHorario(entry) || '';
  const local   = entry.local || '';
  const tpl     = FU_TIPOS[fuActiveType];
  const msgText = tpl ? tpl.texto(nome, srv, horario, local) : '';
  const eid     = fuActiveId;
  const hist    = fuGetHistory(eid);

  const tipoTabs = Object.entries(FU_TIPOS).map(([k, v]) =>
    `<button class="fu-tipo-btn${fuActiveType === k ? ' on' : ''}" data-tipo="${k}" onclick="setFuType('${k}')">${v.icon} ${v.label}</button>`
  ).join('');

  const histHTML = hist.length
    ? hist.slice(0, 8).map(h => `
        <div class="fu-hist-item">
          <span class="fu-hist-label">${h.label || h.tipo || '—'}</span>
          <span class="fu-hist-date">${fuFmtDate(h.date)}</span>
        </div>`).join('')
    : '<div class="fu-hist-empty">Nenhum follow up enviado ainda</div>';

  const modal = document.createElement('div');
  modal.id = 'fu-modal';
  modal.className = 'fu-overlay';
  modal.innerHTML = `
    <div class="fu-box">
      <div class="fu-hdr">
        <div class="fu-hdr-left">
          <div class="fu-hdr-name">📲 Follow Up</div>
          <div class="fu-hdr-sub">${entry.cliente || '—'} · ${srv || '—'}</div>
        </div>
        <button class="fu-close-btn" onclick="closeFu()">✕</button>
      </div>
      <div class="fu-body">
        <div class="fu-tipos" id="fu-tipos">${tipoTabs}</div>
        <div class="fu-tipo-hint" id="fu-tipo-hint">${tpl ? tpl.hint : ''}</div>
        <div class="fu-preview-wrap">
          <div class="fu-preview-label">Mensagem</div>
          <div class="fu-msg-preview" id="fu-msg-preview" contenteditable="true">${msgText}</div>
        </div>
        <div class="fu-phone-row">
          <label class="fu-phone-label">Telefone</label>
          <input type="tel" id="fu-phone-input" class="fu-phone-input"
            value="${phone || ''}" placeholder="(21) 99999-9999">
        </div>
        <div class="fu-actions">
          <button class="fu-btn-wa" onclick="fuSendWA()">📲 Abrir no WhatsApp</button>
          <button class="fu-btn-copy" onclick="fuCopy()">📋 Copiar</button>
        </div>
        <div class="fu-hist-section">
          <div class="fu-hist-title">Histórico de envios</div>
          <div id="fu-hist-list">${histHTML}</div>
        </div>
      </div>
    </div>`;
  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add('show'));
  modal.addEventListener('click', ev => { if (ev.target === modal) closeFu(); });
}

// ══════════════════════════════════════════════════════════
//  GUIA ESTRATÉGICO DE FOLLOW UP
// ══════════════════════════════════════════════════════════
function openGuia() {
  const existing = document.getElementById('guia-modal');
  if (existing) { existing.remove(); return; }
  const modal = document.createElement('div');
  modal.id = 'guia-modal';
  modal.className = 'fu-overlay';
  modal.innerHTML = `
    <div class="fu-box guia-box">
      <div class="fu-hdr">
        <div class="fu-hdr-left">
          <div class="fu-hdr-name">📖 Guia de Follow Up</div>
          <div class="fu-hdr-sub">Referência estratégica</div>
        </div>
        <button class="fu-close-btn" onclick="this.closest('#guia-modal').remove()">✕</button>
      </div>
      <div class="fu-body">

        <div class="guia-section">
          <div class="guia-title">⏱ Timing ideal</div>
          <div class="guia-item"><span class="guia-badge guia-badge-fu">FU-1</span>48-72h após enviar orçamento</div>
          <div class="guia-item"><span class="guia-badge guia-badge-fu">FU-2</span>5-7 dias sem resposta</div>
          <div class="guia-item"><span class="guia-badge guia-badge-enc">ENC</span>7-10 dias após FU-2 — encerrar elegante</div>
          <div class="guia-item"><span class="guia-badge guia-badge-pos">D-1</span>Véspera do atendimento</div>
          <div class="guia-item"><span class="guia-badge guia-badge-pos">POS</span>Mesmo dia (imediato) + 24h + 7 dias</div>
        </div>

        <div class="guia-section">
          <div class="guia-title">🚫 Quando NÃO enviar</div>
          <div class="guia-item guia-danger">Mais de 2 follow ups sem resposta — pare</div>
          <div class="guia-item guia-danger">Logo após a cliente ter respondido (menos de 24h)</div>
          <div class="guia-item guia-danger">Fora do horário: antes das 9h ou após as 19h</div>
          <div class="guia-item guia-danger">Segunda de manhã cedo ou sexta à noite</div>
        </div>

        <div class="guia-section">
          <div class="guia-title">💬 Resposta às objeções</div>
          <div class="guia-item"><strong>"Vou pensar"</strong> → Abra espaço sem pressionar. Mencione agenda se data próxima.</div>
          <div class="guia-item"><strong>"Ficou caro"</strong> → Pergunte o orçamento dela antes de propor qualquer ajuste.</div>
          <div class="guia-item"><strong>"Outra cobra menos"</strong> → Explique seu diferencial com calma e confiança. Não compita.</div>
          <div class="guia-item"><strong>"Vou ver com meu marido"</strong> → Ofereça um resumo por escrito para facilitar a conversa.</div>
          <div class="guia-item"><strong>"Estou pesquisando"</strong> → "Faz sentido! Se tiver dúvidas sobre como funciona meu atendimento, me chama."</div>
        </div>

        <div class="guia-section">
          <div class="guia-title">🕐 Melhores horários</div>
          <div class="guia-item guia-ok">✅ 10h–11h30 · 14h–16h</div>
          <div class="guia-item guia-danger">❌ Antes das 9h · Após as 19h</div>
          <div class="guia-item guia-danger">❌ Segunda cedo · Sexta à noite</div>
        </div>

        <div class="guia-section">
          <div class="guia-title">🎯 Encerramento elegante</div>
          <div class="guia-tip">"Oi, [Nome]! Como não tivemos retorno, vou liberar o espaço na minha agenda. Se em outro momento quiser conversar, estarei por aqui. Boa sorte com tudo! 🤍"</div>
          <div class="guia-tip-sub">Esse texto tem alta taxa de retorno — quem estava hesitando frequentemente responde.</div>
        </div>

        <div class="guia-section">
          <div class="guia-title">💡 Princípio central</div>
          <div class="guia-tip">O follow up premium não persegue — ele cuida. Você não é ansiosa. Você é organizada e presente. A cliente que se sente lembrada, não cobrada, é a que fecha e indica.</div>
        </div>

      </div>
    </div>`;
  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add('show'));
  modal.addEventListener('click', ev => { if (ev.target === modal) modal.remove(); });
}

// ══════════════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════════════
checkAuth();
if (entries.length > 0) { render(); dot('syncing'); }
loadFromSupabase();
loadCalendar();