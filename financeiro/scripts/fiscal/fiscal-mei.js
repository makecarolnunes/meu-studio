// ════════════════════════════════════════════════════════════
// financeiro/scripts/fiscal/fiscal-mei.js
// Cálculos do teto MEI + 3 cenários + render do Painel.
//
// Cenários:
//   CONSERVADOR = Realizado (entries com status=Realizado, !auto)
//   PROVÁVEL    = Conservador + Previsto (entries com status=Previsto,
//                 inclui auto:true das noivas e previstos manuais)
//   OTIMISTA    = Provável + Orçamentos em negociação
//                 (Status: 'Novo Pedido', 'Orçamento Enviado')
//
// Anti-duplicação: orçamentos com Status='Fechado' viram entries
// automaticamente (finEntryCreate). Por isso são EXCLUÍDOS aqui —
// já estão contados via entries.
// ════════════════════════════════════════════════════════════

// ── Helpers de data ─────────────────────────────────────────
function fsParseDate(s) {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d) ? null : d;
}
function fsSameYear(d, ano)  { return d && d.getFullYear() === ano; }
function fsClampMonth(m)     { return Math.max(0, Math.min(11, m)); }

// ── Teto efetivo: delega à fonte única ──────────────────────
function fsTetoEfetivo(cfg, ano) {
  if (window.mkFiscal && window.mkFiscal.tetoEfetivo) {
    return window.mkFiscal.tetoEfetivo(cfg, ano);
  }
  // Fallback (não deveria ocorrer — calc-fiscal.js sempre carregado)
  const teto = Number(cfg && cfg.tetoAnual) || 81000;
  const abertura = fsParseDate(cfg && cfg.dataAbertura);
  if (!abertura || abertura.getFullYear() !== ano) return teto;
  return Math.round((teto / 12) * (12 - abertura.getMonth()) * 100) / 100;
}

// ── Coleta de movimentos por cenário ────────────────────────
// Realizado: 100% mesma regra do Resumo (fonte única calc-fiscal.js)
function fsMovimentosRealizado(entries, ano) {
  const out = [];
  if (!Array.isArray(entries)) return out;
  for (const e of entries) {
    if (!e || e.auto) continue;
    if (e.status !== 'Realizado') continue;
    const d = fsParseDate(e.dataPag);
    if (!fsSameYear(d, ano)) continue;
    const v = parseFloat(e.valor) || 0;
    if (v === 0) continue;
    out.push({ data: d, valor: v, fonte: 'realizado' });
  }
  return out;
}

function fsMovimentosPrevistos(entries, ano) {
  // status=Previsto, qualquer auto (auto=true são restantes de noivas)
  const out = [];
  if (!Array.isArray(entries)) return out;
  for (const e of entries) {
    if (!e) continue;
    if (e.status !== 'Previsto') continue;
    const d = fsParseDate(e.dataPag);
    if (!fsSameYear(d, ano)) continue;
    const v = parseFloat(e.valor) || 0;
    if (v === 0) continue;
    out.push({ data: d, valor: v, fonte: e.auto ? 'previsto-noiva' : 'previsto-manual' });
  }
  return out;
}

function fsMovimentosOrcamentos(orcamentos, ano) {
  // Status em negociação. Excluímos 'Fechado' (já em entries) e 'Perdido*'.
  const ABERTOS = ['Novo Pedido', 'Orçamento Enviado'];
  const out = [];
  for (const o of orcamentos || []) {
    if (!ABERTOS.includes(o.Status)) continue;
    // valor previsto: usa ValorProp (ValorFechado só existe quando já fechou)
    const v = parseFloat(o.ValorProp) || 0;
    if (v <= 0) continue;
    // data: prefere DataEvento; senão estima 30 dias após hoje
    const d = fsParseDate(o.DataEvento)
           || new Date(Date.now() + 30 * 24 * 3600 * 1000);
    if (!fsSameYear(d, ano)) continue;
    out.push({ data: d, valor: v, fonte: 'orcamento-aberto' });
  }
  return out;
}

// ── Agregação por mês ───────────────────────────────────────
function fsPorMes(movs) {
  const m = new Array(12).fill(0);
  for (const x of movs) m[x.data.getMonth()] += x.valor;
  return m;
}

// ── Mês de estouro (simulação cronológica) ──────────────────
// Recebe lista de mensalidades acumuladas; retorna { mes, ultrapasso } ou null.
function fsMesEstouro(mesesAcumValor, teto) {
  let acc = 0;
  for (let m = 0; m < 12; m++) {
    acc += mesesAcumValor[m];
    if (acc > teto) {
      return { mes: m, ultrapasso: acc - teto, acumuladoNoMes: acc };
    }
  }
  return null;
}

// ── Cálculo principal ───────────────────────────────────────
function fsCalcPainel(entries, orcamentos, cfg) {
  const ano = FS.selYear;
  const hoje = new Date();
  const mesAtual = hoje.getMonth();
  const ehAnoCorrente = ano === hoje.getFullYear();

  const teto = fsTetoEfetivo(cfg, ano);

  const movRealizado = fsMovimentosRealizado(entries, ano);
  const movPrevisto  = fsMovimentosPrevistos(entries, ano);
  const movOrc       = fsMovimentosOrcamentos(orcamentos, ano);

  const mesesRealizado = fsPorMes(movRealizado);
  const mesesPrevisto  = fsPorMes(movPrevisto);
  const mesesOrc       = fsPorMes(movOrc);

  // Totais por cenário (ano todo)
  const realizadoAno  = mesesRealizado.reduce((s, v) => s + v, 0);
  const previstoAno   = mesesPrevisto.reduce((s, v) => s + v, 0);
  const orcamentoAno  = mesesOrc.reduce((s, v) => s + v, 0);

  const conservador   = realizadoAno;
  const provavel      = realizadoAno + previstoAno;
  const otimista      = realizadoAno + previstoAno + orcamentoAno;

  // Mês de estouro em cada cenário
  const mesesConservador = mesesRealizado.slice();
  const mesesProvavel    = mesesRealizado.map((v, i) => v + mesesPrevisto[i]);
  const mesesOtimista    = mesesProvavel.map((v, i) => v + mesesOrc[i]);

  const estouroConservador = fsMesEstouro(mesesConservador, teto);
  const estouroProvavel    = fsMesEstouro(mesesProvavel, teto);
  const estouroOtimista    = fsMesEstouro(mesesOtimista, teto);

  // Faturamento do mês atual (realizado) + delta
  const faturamentoMes         = mesesRealizado[ehAnoCorrente ? mesAtual : 11];
  const faturamentoMesAnterior = mesesRealizado[ehAnoCorrente ? Math.max(mesAtual - 1, 0) : 10];
  let delta = null;
  if (faturamentoMesAnterior > 0) {
    delta = ((faturamentoMes - faturamentoMesAnterior) / faturamentoMesAnterior) * 100;
  }

  // % de cada cenário sobre o teto
  const pctRealizado  = teto > 0 ? (realizadoAno / teto) * 100 : 0;
  const pctProvavel   = teto > 0 ? (provavel    / teto) * 100 : 0;
  const pctOtimista   = teto > 0 ? (otimista    / teto) * 100 : 0;
  const pctConservador= pctRealizado;

  // Restante até o teto + margem mensal (referência: cenário provável)
  const restanteAteTeto = Math.max(teto - provavel, 0);
  const mesesRestantes = ehAnoCorrente ? Math.max(12 - mesAtual, 1) : 0;
  const margemMensal = mesesRestantes > 0 ? restanteAteTeto / mesesRestantes : 0;

  // Nível de alerta baseado no PROVÁVEL
  let nivel = 'ok';
  if (pctProvavel >= 100 || pctRealizado >= 95) nivel = 'danger';
  else if (pctProvavel >= 85) nivel = 'warn';
  else if (pctProvavel >= 70) nivel = 'warn-leve';

  return {
    ano, teto, ehAnoCorrente, mesAtual,
    faturamentoMes, faturamentoMesAnterior, delta,
    realizadoAno, previstoAno, orcamentoAno,
    conservador, provavel, otimista,
    pctRealizado, pctConservador, pctProvavel, pctOtimista,
    estouroConservador, estouroProvavel, estouroOtimista,
    margemMensal, restanteAteTeto, mesesRestantes,
    nivel,
    mesesRealizado, mesesPrevisto, mesesOrc,
  };
}

// ── Render ──────────────────────────────────────────────────
const FS_MES_NOMES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const FS_MES_LONGO = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

function fsRenderPainel() {
  const root = document.getElementById('fs-content');
  if (!root) return;

  if (!FS.config) {
    root.innerHTML = `
      <div class="fs-empty">
        <h3>Vamos começar</h3>
        <p>Configure seu regime fiscal e o teto anual para acompanhar seu faturamento.</p>
        <button class="fs-btn fs-btn-primary" style="max-width:280px" onclick="fiscalOpenOnboarding()">Configurar</button>
      </div>
    `;
    return;
  }

  const p = fsCalcPainel(FS.entries, FS.orcamentos, FS.config);

  // Delta visual
  let deltaHtml = '';
  if (p.delta !== null && isFinite(p.delta)) {
    const cls = p.delta > 2 ? 'fs-delta-up' : p.delta < -2 ? 'fs-delta-down' : 'fs-delta-flat';
    const sign = p.delta > 0 ? '+' : '';
    const arrow = p.delta > 2 ? '↗' : p.delta < -2 ? '↘' : '→';
    deltaHtml = `<span class="fs-delta ${cls}">${arrow} ${sign}${p.delta.toFixed(0)}%</span>`;
  }

  const mesNome = FS_MES_LONGO[p.ehAnoCorrente ? p.mesAtual : 11];

  root.innerHTML = `
    ${fsRenderResumoTopo(p, mesNome, deltaHtml)}
    <div class="fs-card-row">
      ${fsRenderTetoCard(p)}
      ${fsRenderCenarios(p)}
    </div>
    ${fsRenderMesesCard(p)}
  `;
}

function fsRenderResumoTopo(p, mesNome, deltaHtml) {
  return `
    <div class="fs-grid-2">
      <div class="fs-mini">
        <div class="fs-mini-label">${mesNome}</div>
        <div class="fs-mini-value">${fsBrl(p.faturamentoMes)}</div>
        ${deltaHtml ? `<div style="margin-top:6px">${deltaHtml}</div>` : ''}
      </div>
      <div class="fs-mini">
        <div class="fs-mini-label">Ano ${p.ano} · realizado</div>
        <div class="fs-mini-value">${fsBrl(p.realizadoAno)}</div>
        <div style="margin-top:6px;font-size:var(--text-xs);color:var(--text-muted)">
          ${p.pctRealizado.toFixed(1)}% do teto
        </div>
      </div>
    </div>
  `;
}

function fsRenderTetoCard(p) {
  // Cores baseadas no nível
  const corBarra =
    p.nivel === 'danger' ? 'danger'
    : (p.nivel === 'warn' || p.nivel === 'warn-leve') ? 'warn'
    : 'ok';

  const pctRealClamp    = Math.min(p.pctRealizado, 100);
  const pctProvavelClamp = Math.min(p.pctProvavel, 100);

  // Alert principal (baseado no cenário provável)
  let alertCls = '', alertText = '', alertIcon = '';
  if (p.estouroProvavel) {
    alertCls = 'danger';
    alertIcon = '⚠';
    alertText = `Pelo ritmo atual e previstos, o teto deve ser estourado em <b>${FS_MES_LONGO[p.estouroProvavel.mes]}</b>.`;
  } else if (p.nivel === 'warn') {
    alertCls = 'warn';
    alertIcon = '●';
    alertText = `Ritmo de atenção: <b>${fsBrl(p.provavel)}</b> projetado para o ano (${p.pctProvavel.toFixed(0)}%).`;
  } else if (p.nivel === 'warn-leve') {
    alertCls = 'warn';
    alertIcon = '●';
    alertText = `Já comprometeu ${p.pctProvavel.toFixed(0)}% do teto contando previstos.`;
  } else if (p.realizadoAno > 0 || p.previstoAno > 0) {
    alertCls = 'ok';
    alertIcon = '✓';
    alertText = `Margem confortável. Restam <b>${fsBrl(p.restanteAteTeto)}</b> até o teto.`;
  }

  return `
    <div class="fs-card">
      <div class="fs-card-title">Teto MEI · ${p.ano}</div>

      <div class="fs-teto-row">
        <div>
          <div class="fs-teto-pct ${corBarra}">${p.pctProvavel.toFixed(0)}%</div>
          <div style="font-size:var(--text-xs);color:var(--text-muted);margin-top:2px">previsto + realizado</div>
        </div>
        <div class="fs-teto-total" style="text-align:right">
          ${fsBrl(p.provavel)}<br>
          <span style="color:var(--text-subtle)">de ${fsBrl(p.teto)}</span>
        </div>
      </div>

      <!-- Barra dupla: realizado sólido + previsto translúcido -->
      <div class="fs-teto-bar-stack">
        <div class="fs-teto-fill-base ${corBarra}" style="width:${pctProvavelClamp}%"></div>
        <div class="fs-teto-fill-real" style="width:${pctRealClamp}%"></div>
      </div>

      <div class="fs-teto-legend">
        <span><i class="fs-dot fs-dot-real"></i>Realizado ${fsBrl(p.realizadoAno)}</span>
        <span><i class="fs-dot fs-dot-prev"></i>Previsto ${fsBrl(p.previstoAno)}</span>
      </div>

      ${p.ehAnoCorrente && p.mesesRestantes > 0 ? `
        <div class="fs-teto-info">
          <span>Restam ${fsBrl(p.restanteAteTeto)}</span>
          <span>≈ ${fsBrl(p.margemMensal)}/mês</span>
        </div>
      ` : ''}

      ${alertText ? `
        <div class="fs-teto-alert ${alertCls}">
          <span style="font-weight:bold;font-size:14px">${alertIcon}</span>
          <span>${alertText}</span>
        </div>
      ` : ''}
    </div>
  `;
}

function fsRenderCenarios(p) {
  const linha = (label, valor, pct, estouro, cor) => {
    const pctClamp = Math.min(pct, 100);
    const ultrapasse = pct > 100;
    const estouroTxt = estouro
      ? `<span class="fs-cen-estouro">estoura em ${FS_MES_NOMES[estouro.mes]}</span>`
      : '';
    return `
      <div class="fs-cen-row">
        <div class="fs-cen-head">
          <span class="fs-cen-label">${label}</span>
          <span class="fs-cen-val">${fsBrl(valor)} <span class="fs-cen-pct ${cor}">${pct.toFixed(0)}%</span></span>
        </div>
        <div class="fs-cen-bar"><div class="fs-cen-fill ${cor}" style="width:${pctClamp}%"></div></div>
        ${estouroTxt}
      </div>
    `;
  };

  const corC = p.pctConservador >= 100 ? 'danger' : p.pctConservador >= 85 ? 'warn' : 'ok';
  const corP = p.pctProvavel    >= 100 ? 'danger' : p.pctProvavel    >= 85 ? 'warn' : 'ok';
  const corO = p.pctOtimista    >= 100 ? 'danger' : p.pctOtimista    >= 85 ? 'warn' : 'ok';

  return `
    <div class="fs-card">
      <div class="fs-card-title">Cenários até dezembro</div>
      <div class="fs-cen-help">Considerando o que já entrou, os previstos e os orçamentos em aberto.</div>
      ${linha('Conservador',  p.conservador, p.pctConservador, p.estouroConservador, corC)}
      ${linha('Provável',     p.provavel,    p.pctProvavel,    p.estouroProvavel,    corP)}
      ${linha('Otimista',     p.otimista,    p.pctOtimista,    p.estouroOtimista,    corO)}
      <div class="fs-cen-foot">
        <span>Conservador = só já recebido</span>
        <span>Provável = + previstos confirmados</span>
        <span>Otimista = + orçamentos em negociação</span>
      </div>
    </div>
  `;
}

function fsRenderMesesCard(p) {
  // Barras empilhadas: realizado (sólido) + previsto (médio) + orçamento (claro)
  const refMensal = p.teto / 12;
  const max = Math.max(
    refMensal,
    ...p.mesesRealizado.map((v, i) => v + p.mesesPrevisto[i] + p.mesesOrc[i])
  );
  const mesAtual = p.ehAnoCorrente ? p.mesAtual : 11;

  const barras = p.mesesRealizado.map((vR, i) => {
    const vP = p.mesesPrevisto[i];
    const vO = p.mesesOrc[i];
    const total = vR + vP + vO;
    const hR = max > 0 ? (vR / max) * 100 : 0;
    const hP = max > 0 ? (vP / max) * 100 : 0;
    const hO = max > 0 ? (vO / max) * 100 : 0;
    const isFuturo = p.ehAnoCorrente && i > p.mesAtual;
    const isAtual  = p.ehAnoCorrente && i === p.mesAtual;
    const labelCor = isAtual ? 'var(--brand-dark)' : 'var(--text-subtle)';
    const labelWeight = isAtual ? '600' : '400';

    return `
      <div class="fs-mb-col" title="${FS_MES_NOMES[i]}: realizado ${fsBrl(vR)}${vP > 0 ? `, previsto ${fsBrl(vP)}` : ''}${vO > 0 ? `, orçamento ${fsBrl(vO)}` : ''}">
        <div class="fs-mb-stack">
          ${vO > 0 ? `<div class="fs-mb-seg fs-mb-orc"   style="height:${hO}%"></div>` : ''}
          ${vP > 0 ? `<div class="fs-mb-seg fs-mb-prev"  style="height:${hP}%"></div>` : ''}
          ${vR > 0 ? `<div class="fs-mb-seg fs-mb-real"  style="height:${hR}%"></div>` : ''}
          ${total === 0 ? `<div class="fs-mb-seg fs-mb-empty"></div>` : ''}
        </div>
        <div class="fs-mb-label" style="color:${labelCor};font-weight:${labelWeight}">${FS_MES_NOMES[i]}</div>
      </div>
    `;
  }).join('');

  return `
    <div class="fs-card">
      <div class="fs-card-title">Mês a mês · ${p.ano}</div>
      <div class="fs-mb-bars">${barras}</div>
      <div class="fs-mb-legend">
        <span><i class="fs-dot fs-dot-real"></i>Realizado</span>
        <span><i class="fs-dot fs-dot-prev"></i>Previsto</span>
        <span><i class="fs-dot fs-dot-orc"></i>Orçamento</span>
      </div>
    </div>
  `;
}
