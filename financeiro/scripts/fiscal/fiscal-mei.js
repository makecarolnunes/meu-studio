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
    if (!e) continue;
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

  // ── Simulador / projeção: ritmo dos meses já COMPLETOS ──
  // O mês corrente é parcial (ainda está acontecendo). Se ele entrar na
  // média de ritmo, um mês recém-começado (≈ R$ 0) derruba a média
  // artificialmente — pior ainda na ponderada, onde ele teria o maior peso.
  // Por isso o ritmo considera só os meses já fechados.
  const mesesCompletos = ehAnoCorrente ? mesAtual : 12; // Jan..mês anterior
  const realizadoCompletos = ehAnoCorrente
    ? mesesRealizado.slice(0, mesAtual).reduce((s, v) => s + v, 0)
    : realizadoAno;

  // Média simples dos meses completos
  const mediaMensalRitmo = mesesCompletos > 0
    ? realizadoCompletos / mesesCompletos
    : realizadoAno; // fallback (janeiro): usa o parcial como estimativa

  // Média ponderada dos últimos 3 meses COMPLETOS (pesos 3,2,1)
  let mediaPonderada;
  if (ehAnoCorrente && mesesCompletos >= 1) {
    const w = [3, 2, 1];
    let soma = 0, peso = 0;
    for (let i = 0; i < 3; i++) {
      const idx = mesAtual - 1 - i; // último mês completo e os anteriores
      if (idx >= 0) { soma += mesesRealizado[idx] * w[i]; peso += w[i]; }
    }
    mediaPonderada = peso > 0 ? soma / peso : mediaMensalRitmo;
  } else {
    mediaPonderada = mediaMensalRitmo;
  }

  // Projeção = realizado nos meses completos + ritmo × meses restantes
  // (mesesRestantes = 12 - mesAtual = nº de meses ainda não fechados, incl. o atual)
  const projecaoRitmo = ehAnoCorrente
    ? realizadoCompletos + (mediaMensalRitmo * mesesRestantes)
    : realizadoAno;
  const pctRitmo = teto > 0 ? (projecaoRitmo / teto) * 100 : 0;
  const projecaoPonderada = ehAnoCorrente
    ? realizadoCompletos + (mediaPonderada * mesesRestantes)
    : realizadoAno;
  const pctPonderada = teto > 0 ? (projecaoPonderada / teto) * 100 : 0;

  // ── Previsão de fechamento (ritmo realista) ──
  // Usa a média ponderada (peso nos últimos meses) quando há histórico
  // suficiente; senão a média simples do ano.
  const mediaProjecao = (ehAnoCorrente && mesesCompletos >= 3) ? mediaPonderada : mediaMensalRitmo;
  const projecaoFechamento = ehAnoCorrente
    ? realizadoCompletos + (mediaProjecao * mesesRestantes)
    : realizadoAno;
  const pctProjecao = teto > 0 ? (projecaoFechamento / teto) * 100 : 0;
  const excessoProjecao = Math.max(projecaoFechamento - teto, 0);
  const folgaProjecao   = Math.max(teto - projecaoFechamento, 0);

  // Série mensal projetada: realizado nos meses completos + ritmo do mês
  // corrente em diante. Serve pra achar o mês provável de estouro.
  const mesesProjetados = mesesRealizado.map((v, i) => {
    if (!ehAnoCorrente) return v;
    return i < mesAtual ? v : mediaProjecao;
  });
  const estouroProjecao = fsMesEstouro(mesesProjetados, teto);

  // ── Nível de risco de desenquadramento (4 faixas) ──
  let riscoNivel, riscoMes = null;
  if (realizadoAno >= teto) {
    riscoNivel = 'estourado';
    riscoMes = (estouroConservador && estouroConservador.mes != null)
      ? estouroConservador.mes : mesAtual;
  } else if (projecaoFechamento > teto || provavel > teto) {
    riscoNivel = 'risco';
    riscoMes = estouroProjecao ? estouroProjecao.mes
             : (estouroProvavel ? estouroProvavel.mes : null);
  } else if (pctProvavel >= 75 || pctProjecao >= 85) {
    riscoNivel = 'atencao';
  } else {
    riscoNivel = 'ok';
  }

  // Nível de alerta baseado no PROVÁVEL (legado — mantido por compat.)
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
    mesesCompletos, realizadoCompletos,
    mediaMensalRitmo, projecaoRitmo, pctRitmo,
    mediaPonderada, projecaoPonderada, pctPonderada,
    mediaProjecao, projecaoFechamento, pctProjecao,
    excessoProjecao, folgaProjecao, estouroProjecao,
    riscoNivel, riscoMes,
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

  root.innerHTML = `
    ${fsRenderStatusCard(p)}
    ${fsRenderPrevisaoCard(p)}
    ${fsRenderAcoesCard(p)}
    ${fsRenderCenarios(p)}
    ${fsRenderMesesCard(p)}
  `;
}

// Mapa de risco → rótulo + classe de cor
const FS_RISCO_INFO = {
  ok:        { label: 'Dentro do limite',          cls: 'ok' },
  atencao:   { label: 'Atenção — chegando perto',  cls: 'warn' },
  risco:     { label: 'Risco de desenquadramento', cls: 'danger' },
  estourado: { label: 'Limite ultrapassado',       cls: 'danger' },
};

function fsCapMes(i) {
  const m = FS_MES_LONGO[i] || '';
  return m.charAt(0).toUpperCase() + m.slice(1);
}

// ── 1) Diagnóstico: onde estou agora ────────────────────────
function fsRenderStatusCard(p) {
  const info = FS_RISCO_INFO[p.riscoNivel] || FS_RISCO_INFO.ok;
  const pctReal = Math.min(p.pctRealizado, 100);
  const pctProv = Math.min(p.pctProvavel, 100);

  let resumo;
  if (p.riscoNivel === 'estourado') {
    resumo = `Você já passou <b>${fsBrl(p.realizadoAno - p.teto)}</b> do teto do MEI neste ano.`;
  } else if (p.riscoNivel === 'risco') {
    resumo = p.riscoMes != null
      ? `No ritmo atual, o teto deve estourar em <b>${fsCapMes(p.riscoMes)}</b>.`
      : `No ritmo atual, você deve ultrapassar o teto antes de dezembro.`;
  } else if (p.riscoNivel === 'atencao') {
    resumo = `Já comprometeu <b>${p.pctProvavel.toFixed(0)}%</b> do teto. Dá pra seguir, mas acompanhe de perto.`;
  } else {
    resumo = `Tranquilo: usou <b>${p.pctProvavel.toFixed(0)}%</b> do teto e tem folga até dezembro.`;
  }

  return `
    <div class="fs-card fs-status fs-status--${info.cls}">
      <div class="fs-status-badge fs-status-badge--${info.cls}">${info.label}</div>
      <div class="fs-status-resumo">${resumo}</div>

      <div class="fs-status-bignum">${fsBrl(p.realizadoAno)} <span>já recebido em ${p.ano}</span></div>

      <div class="fs-teto-bar-stack" style="margin-top:12px">
        <div class="fs-teto-fill-base ${info.cls}" style="width:${pctProv}%"></div>
        <div class="fs-teto-fill-real" style="width:${pctReal}%"></div>
      </div>
      <div class="fs-teto-legend">
        <span><i class="fs-dot fs-dot-real"></i>Recebido ${fsBrl(p.realizadoAno)}</span>
        <span><i class="fs-dot fs-dot-prev"></i>Previsto ${fsBrl(p.previstoAno)}</span>
      </div>

      <div class="fs-kpis">
        <div class="fs-kpi">
          <div class="fs-kpi-num ${p.pctProvavel >= 100 ? 'danger' : ''}">${p.pctProvavel.toFixed(0)}%</div>
          <div class="fs-kpi-lbl">do teto comprometido</div>
        </div>
        <div class="fs-kpi">
          <div class="fs-kpi-num ${p.restanteAteTeto > 0 ? 'ok' : 'danger'}">${fsBrl(p.restanteAteTeto)}</div>
          <div class="fs-kpi-lbl">ainda posso faturar</div>
        </div>
      </div>

      <div class="fs-status-foot">
        Teto MEI ${p.ano}: <b>${fsBrl(p.teto)}</b> · recebido + previsto = <b>${fsBrl(p.provavel)}</b>
      </div>
    </div>
  `;
}

// ── 2) Previsão de fechamento (substitui o simulador) ───────
function fsRenderPrevisaoCard(p) {
  if (!p.ehAnoCorrente) {
    return `
      <div class="fs-card">
        <div class="fs-card-title">Fechamento do ano</div>
        <div class="fs-prev-head">
          <div class="fs-prev-num">${fsBrl(p.realizadoAno)}</div>
          <div class="fs-prev-pct">${p.pctRealizado.toFixed(0)}%<span>do teto</span></div>
        </div>
        <p class="fs-cen-help" style="margin:8px 0 0">Ano encerrado.</p>
      </div>`;
  }

  const over = p.excessoProjecao > 0;
  const cor = over ? 'danger' : (p.pctProjecao >= 85 ? 'warn' : 'ok');

  let verdict;
  if (over) {
    verdict = `
      <div class="fs-prev-verdict danger">
        <div class="fs-prev-vrow">
          <span class="fs-prev-vlbl">Excesso previsto sobre o teto</span>
          <span class="fs-prev-vval">${fsBrl(p.excessoProjecao)}</span>
        </div>
        ${p.estouroProjecao ? `
        <div class="fs-prev-vrow">
          <span class="fs-prev-vlbl">Mês provável de estouro</span>
          <span class="fs-prev-vval">${fsCapMes(p.estouroProjecao.mes)}</span>
        </div>` : ''}
      </div>`;
  } else {
    verdict = `
      <div class="fs-prev-verdict ok">
        Você ainda pode faturar <b>${fsBrl(p.restanteAteTeto)}</b> sem ultrapassar o limite.
      </div>`;
  }

  return `
    <div class="fs-card">
      <div class="fs-card-title">Previsão de fechamento</div>
      <p class="fs-cen-help" style="margin-bottom:14px">Se você mantiver o ritmo atual de faturamento até dezembro.</p>

      <div class="fs-prev-head">
        <div class="fs-prev-num ${cor}">${fsBrl(p.projecaoFechamento)}</div>
        <div class="fs-prev-pct ${cor}">${p.pctProjecao.toFixed(0)}%<span>do teto</span></div>
      </div>

      ${verdict}

      <div class="fs-prev-foot">
        Base: média de <b>${fsBrl(p.mediaProjecao)}/mês</b>${p.mesesCompletos >= 3 ? ' (peso maior nos últimos 3 meses)' : ''}, calculada só com meses fechados
        × ${p.mesesRestantes} ${p.mesesRestantes === 1 ? 'mês restante' : 'meses restantes'}.
      </div>
    </div>
  `;
}

// ── 3) O que fazer agora (orientado a decisão) ──────────────
function fsRenderAcoesCard(p) {
  const acoes = fsAcoes(p);
  if (!acoes.length) return '';
  const info = FS_RISCO_INFO[p.riscoNivel] || FS_RISCO_INFO.ok;
  return `
    <div class="fs-card">
      <div class="fs-card-title">O que fazer agora</div>
      <ul class="fs-acoes fs-acoes--${info.cls}">
        ${acoes.map(a => `<li>${a}</li>`).join('')}
      </ul>
    </div>
  `;
}

function fsAcoes(p) {
  const mes = p.riscoMes != null ? fsCapMes(p.riscoMes) : null;
  const out = [];
  if (p.riscoNivel === 'estourado') {
    out.push(`Você ultrapassou o teto em <b>${fsBrl(p.realizadoAno - p.teto)}</b>. Evite registrar novos recebimentos como MEI até o fim do ano.`);
    out.push(`Procure um contador: o excedente costuma exigir migração para <b>ME (Simples Nacional)</b> e impostos sobre o que passou.`);
    out.push(`Separe uma reserva para o <b>DAS complementar</b> e tributos do excedente.`);
  } else if (p.riscoNivel === 'risco') {
    if (mes) out.push(`No ritmo atual o teto estoura em <b>${mes}</b>. Planeje os fechamentos a partir de agora com isso em mente.`);
    out.push(`Ainda há <b>${fsBrl(p.restanteAteTeto)}</b> de margem. Evite concentrar grandes recebimentos antes de ${mes || 'dezembro'}.`);
    out.push(`Se der, empurre recebimentos que excedam o teto para <b>janeiro do ano seguinte</b>.`);
    out.push(`Converse com um contador sobre migrar para <b>ME</b> antes de estourar.`);
  } else if (p.riscoNivel === 'atencao') {
    out.push(`Você já comprometeu <b>${p.pctProvavel.toFixed(0)}%</b> do teto. Dá pra seguir, mas acompanhe mês a mês.`);
    out.push(`Margem restante: <b>${fsBrl(p.restanteAteTeto)}</b>. Evite surpresas concentradas em dezembro.`);
  } else {
    out.push(`Tudo tranquilo: <b>${p.pctProvavel.toFixed(0)}%</b> do teto usado, com <b>${fsBrl(p.restanteAteTeto)}</b> de folga.`);
    out.push(`Continue registrando os recebimentos para a previsão ficar precisa.`);
  }
  return out;
}

function fsRenderCenarios(p) {
  const linha = (nome, formula, valor, pct, estouro, cor) => {
    const pctClamp = Math.min(pct, 100);
    const estouroTxt = estouro
      ? `<span class="fs-cen-estouro">estoura o teto em ${FS_MES_NOMES[estouro.mes]}</span>`
      : '';
    return `
      <div class="fs-cen-row">
        <div class="fs-cen-head">
          <span class="fs-cen-label">${nome}</span>
          <span class="fs-cen-val">${fsBrl(valor)} <span class="fs-cen-pct ${cor}">${pct.toFixed(0)}%</span></span>
        </div>
        <div class="fs-cen-bar"><div class="fs-cen-fill ${cor}" style="width:${pctClamp}%"></div></div>
        <div class="fs-cen-formula">${formula}</div>
        ${estouroTxt}
      </div>
    `;
  };

  const corDe = (pct) => pct >= 100 ? 'danger' : pct >= 85 ? 'warn' : 'ok';

  return `
    <div class="fs-card">
      <div class="fs-card-title">Cenários até dezembro</div>
      <div class="fs-cen-help">Três fechamentos possíveis, do mais garantido ao mais otimista. Cada um soma uma camada a mais.</div>
      ${linha(
        'Somente valores já recebidos',
        `O que já caiu na conta em ${p.ano}: <b>${fsBrl(p.realizadoAno)}</b>.`,
        p.conservador, p.pctConservador, p.estouroConservador, corDe(p.pctConservador))}
      ${linha(
        'Recebidos + previstos confirmados',
        `Recebido ${fsBrl(p.realizadoAno)} + previsto ${fsBrl(p.previstoAno)} (restante já contratado de noivas/clientes).`,
        p.provavel, p.pctProvavel, p.estouroProvavel, corDe(p.pctProvavel))}
      ${linha(
        'Recebidos + previstos + orçamentos em negociação',
        `Os dois acima + ${fsBrl(p.orcamentoAno)} em orçamentos ainda em aberto (podem ou não fechar).`,
        p.otimista, p.pctOtimista, p.estouroOtimista, corDe(p.pctOtimista))}
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
