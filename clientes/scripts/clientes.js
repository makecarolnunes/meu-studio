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

const DEFAULT_URL = 'https://script.google.com/macros/s/AKfycbw8ShiDfpUvpRe8TwLuLn6jre02F0lFCvSq0mqk7brhHtBSVJ1rj3vh5UWAnCl89M9UEw/exec';
const CAL_ID      = 'c82d7e89c34b742daed656c5aa3113d25cb3feda4e8f159936750f2e17473b38@group.calendar.google.com';
const SCRIPT_URL  = localStorage.getItem('mk_script_url') || DEFAULT_URL;

// ── DATA ──────────────────────────────────────────────────
let entries        = JSON.parse(localStorage.getItem('mk_entries') || '[]');
let calMap         = {};
let selMonth       = new Date().getMonth();
let selYear        = new Date().getFullYear();
let curFilter      = 'todos';
let curEquipeFilter= 'todos';

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

function syncAll() {
  dot('syncing');
  calMap = {};
  loadSheets();
  loadCalendar();
}

// ══════════════════════════════════════════════════════════
//  GOOGLE SHEETS — mesmos dados do sistema financeiro
// ══════════════════════════════════════════════════════════
async function loadSheets() {
  if (!SCRIPT_URL) { dot('offline'); render(); return; }
  try {
    dot('syncing');
    const r = await fetch(`${SCRIPT_URL}?action=load&_=${Date.now()}`);
    const d = await r.json();
    if (d.ok) {
      entries = d.entries || [];
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
      return `
        <div class="entry ${isReal ? 'real' : 'prev'} ${isNoiva ? 'noiva' : ''}">
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
//  INIT
// ══════════════════════════════════════════════════════════
if (entries.length > 0) { render(); dot('syncing'); }
loadSheets();
loadCalendar();