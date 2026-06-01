// ════════════════════════════════════════════════════════════
// pessoal/scripts/views.js — renderização
// ════════════════════════════════════════════════════════════

function render() {
  // mês no header
  const ml = document.getElementById('month-label');
  if (ml) ml.textContent = `${MONTHS[selMonth]} ${selYear}`;
  // tabs ativas
  document.querySelectorAll('.ptabs button').forEach(b =>
    b.classList.toggle('on', b.dataset.tab === screen));

  const el = document.getElementById('view');
  if (!el) return;
  if (screen === 'resumo')        el.innerHTML = renderResumo();
  else if (screen === 'entradas') el.innerHTML = renderLista('entrada');
  else if (screen === 'saidas')   el.innerHTML = renderLista('saida');
  else if (screen === 'importar') el.innerHTML = renderImportar();
}

// ── RESUMO / DASHBOARD ───────────────────────────────────
function renderResumo() {
  const ents = entradas.filter(e => inSelectedMonth(e.data));
  const sais = saidas.filter(s => inSelectedMonth(s.data));
  const totIn  = ents.reduce((t, e) => t + Number(e.valor || 0), 0);
  const totOut = sais.reduce((t, s) => t + Number(s.valor || 0), 0);
  const saldo  = totIn - totOut;

  // breakdown saídas por categoria
  const porCat = {};
  sais.forEach(s => { porCat[s.categoria] = (porCat[s.categoria] || 0) + Number(s.valor || 0); });
  const cats = Object.entries(porCat).sort((a, b) => b[1] - a[1]);
  const maxCat = cats.length ? cats[0][1] : 1;

  // breakdown por forma de pagamento (saídas)
  const porForma = {};
  sais.forEach(s => { const f = s.forma || '—'; porForma[f] = (porForma[f] || 0) + Number(s.valor || 0); });
  const formas = Object.entries(porForma).sort((a, b) => b[1] - a[1]);

  return `
    <div class="sumgrid">
      <div class="sumcard in"><div class="lab">Entradas</div><div class="val">${brl(totIn)}</div></div>
      <div class="sumcard out"><div class="lab">Saídas</div><div class="val">${brl(totOut)}</div></div>
      <div class="sumcard saldo"><div class="lab">Saldo do mês</div><div class="val">${brl(saldo)}</div></div>
    </div>

    <div class="sec-title">Saídas por categoria</div>
    <div class="card">
      ${cats.length ? cats.map(([c, v]) => `
        <div class="catrow">
          <div style="flex:1">
            <div style="display:flex;justify-content:space-between">
              <span class="cn">${catIcon(c)} ${c}</span>
              <span class="cv">${brl(v)}</span>
            </div>
            <div class="catbar"><i style="width:${Math.round(v / maxCat * 100)}%"></i></div>
          </div>
        </div>`).join('')
        : `<p class="t-muted" style="text-align:center;margin:6px 0;font-size:13px">Nenhuma saída neste mês</p>`}
    </div>

    ${formas.length ? `
    <div class="sec-title">Por forma de pagamento</div>
    <div class="card">
      ${formas.map(([f, v]) => `
        <div class="catrow"><span class="cn">${f}</span><span class="cv">${brl(v)}</span></div>`).join('')}
    </div>` : ''}
  `;
}

// ── LISTA (entradas ou saídas) ───────────────────────────
function renderLista(tipo) {
  const ehEntrada = tipo === 'entrada';
  const arr = ehEntrada ? entradas : saidas;
  const filtro = ehEntrada ? entFilter : saiFilter;
  const setFiltroFn = ehEntrada ? 'setEntFilter' : 'setSaiFilter';

  let list = arr.filter(x => inSelectedMonth(x.data));
  if (filtro !== 'todas') list = list.filter(x => (x.origem || 'manual') === filtro);
  list.sort((a, b) => (b.data || '').localeCompare(a.data || ''));

  const total = list.reduce((t, x) => t + Number(x.valor || 0), 0);
  const addFn = ehEntrada ? 'openFormEntrada()' : 'openFormSaida()';

  const filtros = ['todas', 'manual', 'sincronizado', 'importacao'];
  const filtroLabel = { todas: 'Todas', manual: 'Manuais', sincronizado: 'Da empresa', importacao: 'Importadas' };

  return `
    <div class="sumcard ${ehEntrada ? 'in' : 'out'}" style="margin-bottom:12px">
      <div class="lab">Total de ${ehEntrada ? 'entradas' : 'saídas'} — ${MONTHS[selMonth]}</div>
      <div class="val">${brl(total)}</div>
    </div>
    <div class="fbar">
      ${filtros.map(f => `<button class="${filtro === f ? 'on' : ''}" onclick="${setFiltroFn}('${f}')">${filtroLabel[f]}</button>`).join('')}
    </div>
    ${list.length ? list.map(x => itemHtml(x, tipo)).join('')
      : `<div class="empty"><div class="e-ico">${ehEntrada ? '💸' : '🧾'}</div><p>Nada em<br><strong>${MONTHS[selMonth]} ${selYear}</strong></p></div>`}
    <button class="fab" onclick="${addFn}">+</button>
  `;
}

function itemHtml(x, tipo) {
  const ehEntrada = tipo === 'entrada';
  const origem = x.origem || 'manual';
  const chip = origem === 'sincronizado' ? `<span class="chip sync">empresa</span>`
             : origem === 'importacao'   ? `<span class="chip imp">extrato</span>` : '';
  const dataFmt = x.data ? x.data.slice(8, 10) + '/' + x.data.slice(5, 7) : '';
  const podeEditar = origem !== 'sincronizado'; // sincronizadas: editar na empresa
  return `
    <div class="item ${ehEntrada ? 'in' : 'out'}">
      <div class="ico">${catIcon(x.categoria)}</div>
      <div class="mid">
        <div class="d1">${x.descricao || x.categoria}</div>
        <div class="d2">
          <span>${dataFmt}</span>
          <span class="chip">${x.categoria}</span>
          ${x.forma ? `<span class="chip">${x.forma}</span>` : ''}
          ${chip}
        </div>
      </div>
      <div class="amt">${ehEntrada ? '+' : '−'} ${brl(x.valor)}</div>
      <div class="item-actions">
        ${podeEditar
          ? `<button onclick="openFormEdit('${tipo}','${x.id}')" title="Editar">✎</button>
             <button onclick="confirmDelete('${tipo}','${x.id}')" title="Excluir">🗑</button>`
          : `<button onclick="toast('Editar no sistema da empresa')" title="Sincronizada" style="opacity:.3">🔒</button>`}
      </div>
    </div>`;
}

// ── FORM (modal) ─────────────────────────────────────────
function formHtml(tipo, isEdit) {
  const ehEntrada = tipo === 'entrada';
  const F = ehEntrada ? FE : FS;
  const cats = ehEntrada ? CAT_ENTRADAS : CAT_SAIDAS;
  const cor = ehEntrada ? 'in' : 'out';
  const saveFn = ehEntrada ? 'saveFormEntrada' : 'saveFormSaida';
  return `
    <h2>${isEdit ? 'Editar' : 'Nova'} ${ehEntrada ? 'entrada' : 'saída'}</h2>
    <div class="two">
      <div class="fg"><label class="fl">Data</label>
        <input class="fi" type="date" id="f-data" value="${F.data || today()}"></div>
      <div class="fg"><label class="fl">Valor</label>
        <div class="vwrap"><span class="vpfx">R$</span>
        <input class="fi" type="number" id="f-valor" step="0.01" min="0" inputmode="decimal" placeholder="0,00" value="${F.valor || ''}"></div></div>
    </div>
    <div class="fg"><label class="fl">Descrição</label>
      <input class="fi" type="text" id="f-desc" placeholder="Ex: ${ehEntrada ? 'Salário' : 'Mercado'}" value="${(F.descricao || '').replace(/"/g, '&quot;')}"></div>
    <div class="fg"><label class="fl">Categoria</label>
      <select class="fi" id="f-cat">${cats.map(c => `<option value="${c}" ${F.categoria === c ? 'selected' : ''}>${catIcon(c)} ${c}</option>`).join('')}</select></div>
    <div class="fg"><label class="fl">Forma</label>
      <div class="bg">${FORMAS.map(f => `<button type="button" class="bt ${F.forma === f ? 'on ' + cor : ''}" onclick="pickForma('${tipo}','${f}')">${f}</button>`).join('')}</div></div>
    <button class="bsub ${cor}" onclick="${saveFn}()">${isEdit ? 'Salvar alterações' : 'Adicionar'}</button>
    <button class="modal-cancel" onclick="closeModal()">Cancelar</button>
  `;
}

// ── IMPORTAR ─────────────────────────────────────────────
function renderImportar() {
  if (importParsed.length) return renderImportPreview();
  return `
    <div class="sec-title">Importar extrato</div>
    <input type="file" id="import-file" accept=".ofx,.csv" style="display:none" onchange="onImportFile(this.files[0])">
    <div class="import-drop" onclick="document.getElementById('import-file').click()">
      <div class="di">📄</div>
      <p>Toque para escolher o arquivo</p>
      <small>Extrato em <strong>OFX</strong> ou <strong>CSV</strong><br>(cartão de crédito, débito, transferências)</small>
    </div>
    <div class="card" style="margin-top:14px">
      <div class="t-caption" style="line-height:1.6">
        💡 Baixe o extrato do app do banco em <strong>OFX</strong> (recomendado) ou CSV.
        Valores positivos viram <strong>entradas</strong>, negativos viram <strong>saídas</strong>.
        Você revisa tudo antes de salvar.
      </div>
    </div>
  `;
}

function renderImportPreview() {
  const novas = importParsed.filter(t => !t.dup);
  const dups  = importParsed.length - novas.length;
  const totEnt = novas.filter(t => t.tipo === 'entrada').length;
  const totSai = novas.filter(t => t.tipo === 'saida').length;

  return `
    <div class="sec-title">
      <span>Revisar ${importParsed.length} transações</span>
      <button class="bt" onclick="cancelImport()">✕</button>
    </div>
    <div class="card" style="margin-bottom:10px">
      <div class="t-caption">
        ${importInfo ? `<strong>${importInfo.banco}</strong> · ${importInfo.periodoIni} a ${importInfo.periodoFim}<br>` : ''}
        ${totEnt} entrada(s) · ${totSai} saída(s) ${dups ? `· <span class="pdup">${dups} duplicada(s) ignoradas</span>` : ''}
      </div>
    </div>
    ${importParsed.map((t, i) => {
      const ehEnt = t.tipo === 'entrada';
      const cats = ehEnt ? CAT_ENTRADAS : CAT_SAIDAS;
      return `
      <div class="preview-row" style="${t.dup ? 'opacity:.45' : ''}">
        <span class="pd">${t.data.slice(8, 10)}/${t.data.slice(5, 7)}</span>
        <span class="pn">${t.descricao || '(sem descrição)'}</span>
        ${t.dup ? `<span class="pdup">dup</span>` :
          `<select onchange="setImportCat(${i}, this.value)">
            ${cats.map(c => `<option ${t.categoria === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>`}
        <span class="pv ${ehEnt ? 'in' : 'out'}">${ehEnt ? '+' : '−'}${brl(t.valor).replace('R$ ', '')}</span>
      </div>`;
    }).join('')}
    <button class="bsub in" style="margin-top:14px" onclick="confirmImport()">
      Importar ${novas.length} transação(ões)
    </button>
    <button class="modal-cancel" onclick="cancelImport()">Cancelar</button>
  `;
}
