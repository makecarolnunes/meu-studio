// ════════════════════════════════════════════════════════════
// pessoal/scripts/handlers.js — ações de UI (nav, CRUD, import)
// ════════════════════════════════════════════════════════════

// ── NAVEGAÇÃO ────────────────────────────────────────────
function go(tab) { screen = tab; render(); }
function chMonth(d) {
  selMonth += d;
  if (selMonth < 0)  { selMonth = 11; selYear--; }
  if (selMonth > 11) { selMonth = 0;  selYear++; }
  render();
}
function setEntFilter(f) { entFilter = f; render(); }
function setSaiFilter(f) { saiFilter = f; render(); }

// ── MODAL ────────────────────────────────────────────────
function openModal(html) {
  document.getElementById('modal-box').innerHTML = html;
  document.getElementById('modal-overlay').style.display = 'flex';
}
function closeModal() {
  document.getElementById('modal-overlay').style.display = 'none';
}

// ── FORM: abrir ──────────────────────────────────────────
let _editId = null;     // id em edição (null = novo)
function openFormEntrada() { initFE(); _editId = null; openModal(formHtml('entrada', false)); }
function openFormSaida()   { initFS(); _editId = null; openModal(formHtml('saida', false)); }

function openFormEdit(tipo, id) {
  const arr = tipo === 'entrada' ? entradas : saidas;
  const x = arr.find(i => String(i.id) === String(id));
  if (!x) return;
  _editId = id;
  const F = { data: x.data, valor: x.valor, descricao: x.descricao, categoria: x.categoria, forma: x.forma };
  if (tipo === 'entrada') FE = F; else FS = F;
  openModal(formHtml(tipo, true));
}

// captura inputs do form para o estado
function _syncForm(tipo) {
  const F = tipo === 'entrada' ? FE : FS;
  const g = id => { const el = document.getElementById(id); return el ? el.value : ''; };
  F.data = g('f-data'); F.valor = g('f-valor'); F.descricao = g('f-desc'); F.categoria = g('f-cat');
}
function pickForma(tipo, f) {
  _syncForm(tipo);
  if (tipo === 'entrada') FE.forma = f; else FS.forma = f;
  openModal(formHtml(tipo, _editId !== null));
}

// ── FORM: salvar ─────────────────────────────────────────
let _saving = false;
async function saveFormEntrada() { await _saveForm('entrada'); }
async function saveFormSaida()   { await _saveForm('saida'); }

async function _saveForm(tipo) {
  if (_saving) return;
  _syncForm(tipo);
  const F = tipo === 'entrada' ? FE : FS;
  if (!F.valor || Number(F.valor) <= 0) { toast('⚠️ Informe o valor'); return; }
  if (!F.data) { toast('⚠️ Informe a data'); return; }
  _saving = true;
  try {
    const ehEntrada = tipo === 'entrada';
    const arr = ehEntrada ? entradas : saidas;
    const cacheFn = ehEntrada ? cacheEntradas : cacheSaidas;
    const saveDb = ehEntrada ? saveEntrada : saveSaidaPess;

    if (_editId !== null) {
      const x = arr.find(i => String(i.id) === String(_editId));
      if (!x) { _saving = false; return; }
      Object.assign(x, { data: F.data, valor: Number(F.valor), descricao: F.descricao,
        categoria: F.categoria, forma: F.forma });
      cacheFn(); closeModal(); render();
      if (!await saveDb({ ...x, usuarioId: sessao && sessao.id })) await loadFromSupabase();
      toast('Atualizado!');
    } else {
      const novo = {
        id: genId(), usuarioId: sessao && sessao.id,
        data: F.data, valor: Number(F.valor), descricao: F.descricao,
        categoria: F.categoria, forma: F.forma, origem: 'manual', saidaOrigemId: null,
        createdAt: new Date().toISOString(),
      };
      arr.unshift(novo); cacheFn(); closeModal(); render();
      if (!await saveDb(novo)) {
        // rollback otimista
        const i = arr.findIndex(a => a.id === novo.id);
        if (i >= 0) arr.splice(i, 1);
        cacheFn(); render();
      } else {
        toast(ehEntrada ? 'Entrada adicionada!' : 'Saída adicionada!');
      }
    }
  } finally { _saving = false; _editId = null; }
}

// ── EXCLUIR ──────────────────────────────────────────────
function confirmDelete(tipo, id) {
  openModal(`
    <h2>Excluir?</h2>
    <p class="t-muted" style="font-size:14px;margin:0 0 18px">Essa ação não pode ser desfeita.</p>
    <button class="bsub out" onclick="doDelete('${tipo}','${id}')">Excluir</button>
    <button class="modal-cancel" onclick="closeModal()">Cancelar</button>
  `);
}
async function doDelete(tipo, id) {
  const ehEntrada = tipo === 'entrada';
  const arr = ehEntrada ? entradas : saidas;
  const cacheFn = ehEntrada ? cacheEntradas : cacheSaidas;
  const delDb = ehEntrada ? removeEntrada : removeSaidaPess;
  const i = arr.findIndex(x => String(x.id) === String(id));
  if (i < 0) { closeModal(); return; }
  const [removed] = arr.splice(i, 1);
  cacheFn(); closeModal(); render();
  if (!await delDb(id)) { arr.splice(i, 0, removed); cacheFn(); render(); }
  else toast('Excluído');
}

// ── IMPORTAÇÃO ───────────────────────────────────────────
async function onImportFile(file) {
  if (!file) return;
  toast('Lendo arquivo...');
  try {
    const res = await ppParseArquivo(file);
    if (!res.transacoes.length) { toast('Nenhuma transação encontrada'); return; }
    importInfo = { banco: res.banco, periodoIni: res.periodoIni, periodoFim: res.periodoFim };
    // monta preview com dedup contra dados já existentes
    const existentes = new Set([...entradas, ...saidas].map(x => _dedupKey(x.data, x.valor, x.descricao)));
    importParsed = res.transacoes.map(t => {
      const ehEntrada = t.valor >= 0;
      const valor = Math.abs(t.valor);
      const key = _dedupKey(t.data, valor, t.descricao);
      return {
        data: t.data, descricao: t.descricao, valor,
        tipo: ehEntrada ? 'entrada' : 'saida',
        categoria: ppSugereCategoria(t.descricao, ehEntrada),
        dup: existentes.has(key),
      };
    });
    render();
  } catch (err) {
    console.error('[pessoal] import', err);
    toast('⚠️ ' + (err.message || 'Erro ao ler arquivo'));
  }
}
function _dedupKey(data, valor, desc) {
  return `${data}|${Number(valor).toFixed(2)}|${String(desc || '').toLowerCase().replace(/\s+/g, ' ').trim()}`;
}
function setImportCat(i, cat) { if (importParsed[i]) importParsed[i].categoria = cat; }
function cancelImport() { importParsed = []; importInfo = null; render(); }

let _importing = false;
async function confirmImport() {
  if (_importing) return;
  const novas = importParsed.filter(t => !t.dup);
  if (!novas.length) { toast('Nada novo para importar'); return; }
  _importing = true;
  toast('Importando...');
  try {
    const novasEnt = [], novasSai = [];
    novas.forEach(t => {
      const reg = {
        id: genId(), usuarioId: sessao && sessao.id,
        data: t.data, valor: t.valor, descricao: t.descricao,
        categoria: t.categoria, forma: '', origem: 'importacao', saidaOrigemId: null,
        createdAt: new Date().toISOString(),
      };
      if (t.tipo === 'entrada') novasEnt.push(reg); else novasSai.push(reg);
    });
    if (novasEnt.length) await DB.pessoal.entradas.insertBatch(novasEnt);
    if (novasSai.length) await DB.pessoal.saidas.insertBatch(novasSai);
    importParsed = []; importInfo = null;
    await loadFromSupabase();
    screen = 'resumo'; render();
    toast(`${novas.length} transação(ões) importadas!`);
  } catch (err) {
    console.error('[pessoal] confirmImport', err);
    toast('⚠️ Erro ao importar');
  } finally { _importing = false; }
}
