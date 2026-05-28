// ════════════════════════════════════════════════════════════
// fiscal-despesas.js — Tela de despesas (lista + filtros)
// Reaproveita a tabela `saidas` (com natureza) + fiscal_despesas
// como camada de metadados.
// ════════════════════════════════════════════════════════════

window.FS_DESP = {
  filtroNat: 'todas',      // todas | PROFISSIONAL | PESSOAL | MISTA
  filtroCat: 'todas',
  filtroPeriodo: 'mes',    // mes | ano | tudo
  filtroBusca: '',
  filtroOrigem: 'todas',   // todas | manual | ofx | csv
};

function fsRenderDespesas() {
  const root = document.getElementById('fs-content');
  if (!root) return;

  // Cruzamento: para cada saida, busca despesa fiscal se existir (mesmo saidaId)
  const desp = FS.despesas || [];
  const despPorSaida = new Map(desp.filter(d => d.saidaId).map(d => [String(d.saidaId), d]));

  // Lista base: TODAS as saidas (existentes + importadas) — mostradas como despesas
  const todasSaidas = (FS.saidas || []).slice();

  // Filtra período
  const hoje = new Date();
  const filtroMes = FS_DESP.filtroPeriodo === 'mes';
  const filtroAno = FS_DESP.filtroPeriodo === 'ano';

  let filtradas = todasSaidas.filter(s => {
    if (!s.dataPag) return false;
    const d = new Date(s.dataPag);
    if (isNaN(d)) return false;
    if (filtroMes) return d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear();
    if (filtroAno) return d.getFullYear() === hoje.getFullYear();
    return true;
  });

  // Filtra natureza
  if (FS_DESP.filtroNat !== 'todas') {
    filtradas = filtradas.filter(s => (s.natureza || 'PROFISSIONAL') === FS_DESP.filtroNat);
  }
  // Filtra categoria (tipo)
  if (FS_DESP.filtroCat !== 'todas') {
    filtradas = filtradas.filter(s => s.tipo === FS_DESP.filtroCat);
  }
  // Filtra origem (precisa olhar despesa fiscal correspondente)
  if (FS_DESP.filtroOrigem !== 'todas') {
    filtradas = filtradas.filter(s => {
      const d = despPorSaida.get(String(s.id));
      const ori = d ? d.origem : 'manual';
      return ori === FS_DESP.filtroOrigem;
    });
  }
  // Busca textual
  if (FS_DESP.filtroBusca.trim()) {
    const q = FS_DESP.filtroBusca.toLowerCase().trim();
    filtradas = filtradas.filter(s =>
      (s.tipo || '').toLowerCase().includes(q) ||
      (s.obs  || '').toLowerCase().includes(q)
    );
  }

  // Ordena por data desc
  filtradas.sort((a, b) => (b.dataPag || '').localeCompare(a.dataPag || ''));

  // Totais
  const totalProf  = filtradas.filter(s => (s.natureza||'PROFISSIONAL')==='PROFISSIONAL').reduce((t,s) => t + Number(s.valor||0), 0);
  const totalPess  = filtradas.filter(s => s.natureza==='PESSOAL').reduce((t,s) => t + Number(s.valor||0), 0);
  const totalMista = filtradas.filter(s => s.natureza==='MISTA').reduce((t,s) => t + Number(s.valor||0), 0);
  const totalGeral = totalProf + totalPess + totalMista;

  // Categorias únicas pro filtro
  const cats = Array.from(new Set(todasSaidas.map(s => s.tipo).filter(Boolean))).sort();

  root.innerHTML = `
    <!-- Filtros -->
    <div class="fs-desp-filters">
      <div class="fs-pill-row">
        <button class="fs-pill ${FS_DESP.filtroPeriodo==='mes'?'on':''}" onclick="fsDespFiltro('periodo','mes')">Mês</button>
        <button class="fs-pill ${FS_DESP.filtroPeriodo==='ano'?'on':''}" onclick="fsDespFiltro('periodo','ano')">Ano</button>
        <button class="fs-pill ${FS_DESP.filtroPeriodo==='tudo'?'on':''}" onclick="fsDespFiltro('periodo','tudo')">Tudo</button>
      </div>
      <div class="fs-pill-row">
        <button class="fs-pill ${FS_DESP.filtroNat==='todas'?'on':''}" onclick="fsDespFiltro('nat','todas')">Todas</button>
        <button class="fs-pill ${FS_DESP.filtroNat==='PROFISSIONAL'?'on':''}" onclick="fsDespFiltro('nat','PROFISSIONAL')">Profissional</button>
        <button class="fs-pill ${FS_DESP.filtroNat==='PESSOAL'?'on':''}" onclick="fsDespFiltro('nat','PESSOAL')">Pessoal</button>
        ${totalMista>0?`<button class="fs-pill ${FS_DESP.filtroNat==='MISTA'?'on':''}" onclick="fsDespFiltro('nat','MISTA')">Mista</button>`:''}
      </div>
      <input class="fs-search" type="text" placeholder="Buscar..." value="${FS_DESP.filtroBusca}" oninput="fsDespFiltro('busca', this.value)">
    </div>

    <!-- Totais -->
    <div class="fs-mini" style="margin-bottom:var(--space-3)">
      <div class="fs-mini-label">Total ${FS_DESP.filtroPeriodo==='mes'?'do mês':FS_DESP.filtroPeriodo==='ano'?'do ano':''}</div>
      <div class="fs-mini-value">${fsBrl(totalGeral)}</div>
      ${totalGeral>0?`
      <div style="display:flex;gap:var(--space-3);margin-top:var(--space-2);font-size:var(--text-xs);color:var(--text-muted)">
        <span>Profissional ${fsBrl(totalProf)}</span>
        <span>Pessoal ${fsBrl(totalPess)}</span>
        ${totalMista>0?`<span>Mista ${fsBrl(totalMista)}</span>`:''}
      </div>`:''}
    </div>

    <!-- Botão importar -->
    <button class="fs-btn fs-btn-primary fs-import-btn" onclick="fsImportAbrir()">
      <span style="font-size:18px">📥</span> Importar extrato bancário
    </button>

    <!-- Lista -->
    ${filtradas.length === 0 ? `
      <div class="fs-empty">
        <h3>Sem despesas nessa visão</h3>
        <p>Ajuste os filtros acima, ou importe um extrato bancário pra começar.</p>
      </div>
    ` : filtradas.map(s => fsDespCard(s, despPorSaida.get(String(s.id)))).join('')}
  `;
}

function fsDespCard(s, despFiscal) {
  const nat = s.natureza || 'PROFISSIONAL';
  const ico = fsCategoriaIcone(s.tipo) || '•';
  const origem = despFiscal ? despFiscal.origem : 'manual';
  const origemLbl =
    origem === 'ofx' ? 'OFX' :
    origem === 'csv' ? 'CSV' :
    origem === 'pluggy' ? 'Banco' : '';

  const natBadge =
    nat === 'PESSOAL' ? `<span class="fs-natchip pess">Pessoal</span>` :
    nat === 'MISTA'   ? `<span class="fs-natchip mista">Mista</span>` : '';

  return `
    <div class="fs-desp-item">
      <div class="fs-desp-ico">${ico}</div>
      <div class="fs-desp-body">
        <div class="fs-desp-titulo">${s.tipo}${natBadge}</div>
        <div class="fs-desp-meta">
          ${fsFmtDataBr(s.dataPag)}${origemLbl?` · <span class="fs-origem">${origemLbl}</span>`:''}
        </div>
        ${s.obs && origem !== 'manual' ? `<div class="fs-desp-obs">${s.obs}</div>` : ''}
      </div>
      <div class="fs-desp-valor">${fsBrl(s.valor)}</div>
    </div>
  `;
}

function fsDespFiltro(key, value) {
  if (key === 'periodo')  FS_DESP.filtroPeriodo = value;
  if (key === 'nat')      FS_DESP.filtroNat = value;
  if (key === 'cat')      FS_DESP.filtroCat = value;
  if (key === 'busca')    FS_DESP.filtroBusca = value;
  if (key === 'origem')   FS_DESP.filtroOrigem = value;
  fsRenderDespesas();
}
