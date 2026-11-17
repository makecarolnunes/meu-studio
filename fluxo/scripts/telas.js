// ════════════════════════════════════════════════════════════
// fluxo/scripts/telas.js — renderização das telas
// Ordem de prioridade na tela: o que exige ação primeiro, detalhe depois.
// ════════════════════════════════════════════════════════════

function render() {
  document.getElementById('mes-label').textContent = UI.tab === 'plano' && UI.modelo ? 'Modelo do planejamento' : nomeMes(UI.mes);
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === UI.tab));
  const pend = contarPendencias();
  const bd = document.getElementById('badge-pend');
  if (bd) { bd.textContent = pend || ''; bd.style.display = pend ? '' : 'none'; }
  const el = document.getElementById('view');
  let html = avisosGerais();
  if (ST.migracaoOk !== false && ST.carregado && !ST.contas.length) html += telaSetup();
  else if (ST.migracaoOk !== false) {
    html += ({ mes: telaMes, plano: telaPlano, movs: telaMovs, caixinhas: telaCaixinhas,
      pendencias: telaPendencias, analises: telaAnalises, ajustes: telaAjustes, dividas: telaDividas }[UI.tab] || telaMes)();
  }
  el.innerHTML = html;
}

function seletorEnt() {
  return `<div class="seg">${['PF', 'PJ'].map(e => `<button class="${UI.ent === e ? 'on' : ''}" onclick="setEnt('${e}')">${e === 'PF' ? 'Pessoal (PF)' : 'Empresa (PJ)'}</button>`).join('')}</div>`;
}

function avisosGerais() {
  let h = '';
  if (ST.migracaoOk === false) h += `<div class="aviso erro"><b>Falta criar as tabelas do fluxo no Supabase.</b>
    Abra o Supabase › SQL Editor e rode o arquivo <code>sql/fluxo-financeiro.sql</code> do projeto. Ele só adiciona tabelas — nada existente é alterado. Depois toque em atualizar.</div>`;
  if (ST.erroCarga) h += `<div class="aviso">Alguns dados não carregaram: ${esc(ST.erroCarga)}. Mostrando o que está salvo neste aparelho.</div>`;
  return h;
}

function contarPendencias() {
  if (!ST.contas.length) return 0;
  const ctx = stCtx(UI.mes);
  return FX.itensDoMes(ST.itens, UI.mes, ctx.movs, ctx.hoje, ctx.cfg)
    .filter(i => (ST.pfLiberado || i.entidade === 'PJ') && /atrasado|hoje/.test(i._status)).length;
}

// ── SETUP ────────────────────────────────────────────────
function telaSetup() {
  const M = FX_MODELO;
  const n = e => M.contas.filter(c => c.entidade === e).length;
  return `<div class="card">
    <h2>Configurar a estrutura inicial</h2>
    <p class="muted">Vou criar a estrutura a partir da planilha da consultoria. Você pode editar tudo depois.</p>
    <ul class="lista-setup">
      <li><b>${n('PF')}</b> contas e caixinhas PF (Inter PF, Semanada, Despesas fixas, Faxineira, Sazonais, Dívidas, cartão de apoio, Nubank/Itaú em desativação)</li>
      <li><b>${n('PJ')}</b> contas e caixinhas PJ (Inter PJ, Semanada, Assinaturas no cartão, Cursos e investimentos, Reposição, MEI, cartão, espécie)</li>
      <li><b>${M.itens.length}</b> itens no modelo de planejamento (Acompanhamento mensal: pró-labore 01 e 15, semanadas, aportes e a composição das despesas fixas)</li>
      <li><b>${M.dividas.length}</b> dívidas da Tabulação, para você confirmar os saldos</li>
    </ul>
    <p class="muted"><b>Nenhum saldo é criado.</b> Depois você informa o saldo real de cada conta em Caixinhas › Conciliar.</p>
    <label class="fl">Primeiro mês do fluxo</label>
    <input class="fi" type="month" id="setup-mes" value="${UI.mes}">
    <label class="chk"><input type="checkbox" id="setup-zeradas" checked> As caixinhas são novas e começam zeradas (se alguma já tiver dinheiro, desmarque e informe o saldo depois)</label>
    <p class="muted sm">Depois disso o sistema cria sozinho o plano de cada mês a partir do modelo, fecha meses antigos, liga os lançamentos aos itens do plano e deduz a caixinha pela categoria.</p>
    <button class="btn" onclick="acSetup()">Criar estrutura</button>
  </div>`;
}

function cartaoPFBloqueado() {
  return `<div class="card pf-lock">
    <div><b>Financeiro pessoal protegido</b><div class="muted">Entre com o seu usuário pessoal para ver a PF.</div></div>
    <button class="btn sec" onclick="abrirLoginPF()">Entrar</button></div>`;
}

// ── VISÃO DO MÊS ─────────────────────────────────────────
function telaMes() {
  const ctx = stCtx(UI.mes);
  const im = FX.itensDoMes(ST.itens, UI.mes, ctx.movs, ctx.hoje, ctx.cfg).filter(i => ST.pfLiberado || i.entidade === 'PJ');
  const urgentes = im.filter(i => /atrasado|hoje/.test(i._status));
  const proximos = im.filter(i => i._status === 'futuro' || i._status === 'parcial').slice(0, 5);
  let h = '';
  if (!stPlano(UI.mes)) h += `<div class="aviso">Este mês ainda não tem planejamento. <button class="lnk" onclick="go('plano')">Criar agora</button></div>`;

  if (urgentes.length) {
    const aps = urgentes.filter(i => i.tipo === 'aporte');
    h += `<div class="sec-t">Precisa de você <span class="cnt">${urgentes.length}</span></div><div class="card lista">
      ${urgentes.map(i => linhaItem(i, true)).join('')}</div>
      ${aps.length > 1 ? `<button class="btn sec" onclick="acComoPlanejado(${esc(JSON.stringify(aps.map(i => i.id)))})">Já fiz os ${aps.length} aportes como planejado (${brl(aps.reduce((t, i) => t + i._falta, 0))})</button>` : ''}`;
  }
  const rm = FX.receitaMaquiagem(ctx);
  if (rm.atrasadosLista.length) {
    h += `<div class="aviso">${rm.atrasadosLista.length} recebimento(s) de cliente com data vencida e ainda “Previsto” (${brl(rm.caixa.atrasado)} neste mês).
      <button class="lnk" onclick="go('pendencias')">Ver</button></div>`;
  }

  h += `<div class="duo">`;
  h += ST.pfLiberado ? cartaoResumo('PF', ctx) : cartaoPFBloqueado();
  h += cartaoResumo('PJ', ctx);
  h += `</div>`;

  if (ST.pfLiberado) {
    const dist = FX.distribuicoesPF(FX.itensDoMes(ST.itens, UI.mes, ctx.movs, ctx.hoje, ctx.cfg), ctx.movs);
    if (dist.length) {
      h += `<div class="sec-t">Pró-labore → distribuição PF</div><div class="card">${dist.map(d => `
        <div class="dist-mini">
          <div class="row"><b>Dia ${dm(d.recebimento._data).slice(0, 2)} · ${esc(d.recebimento.descricao)}</b><span>${brl(d.recebido)} / ${brl(d.previsto)}</span></div>
          ${barra(d.distribuido, d.planejado)}
          <div class="row muted sm"><span>Distribuído ${brl(d.distribuido)} de ${brl(d.planejado)}</span>
          <span>${d.faltaDistribuir > 0 ? 'Falta ' + brl(d.faltaDistribuir) : '✓ distribuído'}</span></div>
        </div>`).join('')}</div>`;
    }
  }

  h += `<div class="card"><div class="row"><b>Maquiagem — ${nomeMes(UI.mes)}</b></div>
    <div class="kv"><span>Recebido no mês</span><b>${brl(rm.caixa.recebido)}</b></div>
    <div class="kv"><span>A receber (previsto)</span><b>${brl(rm.caixa.aReceber)}</b></div>
    ${rm.caixa.atrasado ? `<div class="kv neg"><span>Vencido sem confirmação</span><b>${brl(rm.caixa.atrasado)}</b></div>` : ''}
    <div class="kv muted"><span>Atendimentos do mês · contratado</span><span>${rm.servico.atendimentos} · ${brl(rm.servico.contratado)}</span></div>
  </div>`;

  if (proximos.length) h += `<div class="sec-t">Próximas datas</div><div class="card lista">${proximos.map(i => linhaItem(i, true)).join('')}</div>`;
  h += `<div class="acoes-rapidas">
    <button class="btn sec" onclick="formGasto()">+ Gasto</button>
    <button class="btn sec" onclick="formTransferencia()">↔ Transferir</button>
    <button class="btn sec" onclick="formExtrato()">⇪ Extrato</button></div>`;
  return h;
}

function cartaoResumo(ent, ctx) {
  const r = FX.resumo(ent, ctx);
  const naoConf = r.naoConferidas.length;
  return `<div class="card resumo ${ent.toLowerCase()}">
    <div class="row"><span class="tag-ent">${ent === 'PF' ? 'Pessoal' : 'Empresa'}</span>
      ${naoConf ? `<button class="lnk sm" onclick="setEnt('${ent}');go('caixinhas')">${naoConf} conta(s) sem saldo conferido</button>` : '<span class="ok sm">saldos conferidos</span>'}</div>
    <div class="big ${r.disponivel < 0 ? 'neg' : ''}">${brl(r.disponivel)}</div>
    <div class="muted sm">disponível sem comprometer reservas e compromissos do mês</div>
    <div class="grid2">
      <div><span>Em conta</span><b>${brl(r.saldoBancario)}</b></div>
      <div><span>Reservado</span><b>${brl(r.reservado)}</b></div>
      <div><span>Compromissos</span><b>${brl(r.compromissos)}</b></div>
      <div><span>Fatura aberta</span><b>${brl(r.faturaAberta)}</b></div>
      <div><span>Entrou no mês</span><b>${brl(r.entrou)}</b></div>
      <div><span>Gastos no mês</span><b>${brl(r.gastos)}</b></div>
    </div>
    ${r.disponivel < 0 ? `<div class="aviso erro sm">O saldo não cobre o que falta realizar no mês (${brl(-r.disponivel)} a descoberto). Reprograme itens em Plano.</div>` : ''}
    <button class="lnk" onclick="setEnt('${ent}');go('caixinhas')">Ver caixinhas ›</button>
  </div>`;
}

function linhaItem(i, comEnt) {
  const cx = i.caixinhaId ? stConta(i.caixinhaId) : null;
  const vivo = FX.PENDENTE(i._status);
  const sub = [comEnt ? i.entidade : '', TIPO_LABEL[i.tipo], cx ? cx.nome : (i.tipo === 'pagamento' ? 'direto da conta' : ''),
    i._realizado > 0 && vivo ? `${brl(i._realizado)} feito` : ''].filter(Boolean).join(' · ');
  return `<div class="it st-${i._status}">
    <div class="it-d">${dm(i._data)}<small>S${i._semana || ''}</small></div>
    <div class="it-m" onclick="formItem('${i.id}')"><div class="it-t">${esc(FX.nomeItem(i))}</div><div class="it-s">${esc(sub)}</div></div>
    <div class="it-v">${brl(i.valor)}${chip(i._status)}</div>
    ${vivo ? `<button class="btn mini" onclick="formExecutar('${i.id}')">${ACAO_LABEL[i.tipo]}</button>` : `<span class="mini-sp"></span>`}
  </div>`;
}

// ── PLANEJAMENTO ─────────────────────────────────────────
function telaPlano() {
  if (UI.modelo) return telaModelo();
  const ent = UI.ent;
  let h = seletorEnt();
  const plano = stPlano(UI.mes);
  if (!plano) {
    const temAnt = ST.itens.some(i => i.mes === FX.addMes(UI.mes, -1));
    return h + `<div class="card"><h2>${nomeMes(UI.mes)} sem planejamento</h2>
      <p class="muted">O mês é criado como cópia: alterar depois não muda outros meses nem o que já aconteceu.</p>
      <button class="btn" onclick="acCriarMes('modelo')">Criar a partir do modelo</button>
      ${temAnt ? `<button class="btn sec" onclick="acCriarMes('anterior')">Copiar de ${nomeMes(FX.addMes(UI.mes, -1))}</button>` : ''}
      <button class="lnk" onclick="UI.modelo=true;render()">Ver / editar o modelo</button></div>`;
  }
  if (ent === 'PF' && !ST.pfLiberado) return h + cartaoPFBloqueado();
  const ctx = stCtx(UI.mes);
  const todos = FX.itensDoMes(ST.itens, UI.mes, ctx.movs, ctx.hoje, ctx.cfg);
  const im = todos.filter(i => i.entidade === ent || (ent === 'PF' && i.tipo === 'prolabore'));
  const fechado = plano.status === 'fechado';
  const avisos = FX.checarPlano(todos.filter(i => i.entidade === ent || i.tipo === 'prolabore'), ST.contas.filter(c => c.entidade === ent));

  h += `<div class="row plano-top">
    <span class="muted sm">${fechado ? '🔒 Mês fechado' : 'Origem: ' + (plano.origem === 'modelo' ? 'modelo' : nomeMes(plano.origem || UI.mes))}</span>
    <span>${fechado ? `<button class="lnk" onclick="acFechar(false)">Reabrir</button>`
      : `<button class="lnk" onclick="formItem(null)">+ Item</button> · <button class="lnk" onclick="acFechar(true)">Fechar mês</button>`}
      · <button class="lnk" onclick="UI.modelo=true;render()">Modelo</button></span></div>`;
  if (avisos.length) h += `<div class="aviso">${avisos.map(a => esc(a.msg)).join('<br>')}</div>`;

  if (ent === 'PF') {
    const dist = FX.distribuicoesPF(todos, ctx.movs);
    dist.forEach(d => {
      const rc = d.recebimento;
      h += `<div class="card dist">
        <div class="dist-h">
          <div><div class="muted sm">Recebimento · dia ${dm(rc._data)}</div><b>${esc(FX.nomeItem(rc))}</b></div>
          <div class="r"><b>${brl(d.previsto)}</b>${chip(d.recebidoCompleto ? 'feito' : rc._status)}</div>
        </div>
        ${d.recebido > 0 && !d.recebidoCompleto ? `<div class="muted sm">Recebido até agora: ${brl(d.recebido)}</div>` : ''}
        ${!d.recebidoCompleto && FX.PENDENTE(rc._status) ? `<button class="btn mini" onclick="formExecutar('${rc.id}')">Registrar recebimento</button>` : ''}
        <div class="lista">${d.itens.map(i => linhaItem(i)).join('') || vazio('Nada distribuído a partir deste recebimento.')}</div>
        ${(() => { const aps = d.itens.filter(i => i.tipo === 'aporte' && FX.PENDENTE(i._status) && i._data <= ctx.hoje);
          return aps.length && d.recebido > 0 ? `<button class="btn sec" style="margin:8px 14px 0;width:calc(100% - 28px)" onclick="acComoPlanejado(${esc(JSON.stringify(aps.map(i => i.id)))})">Fiz os aportes como planejado (${brl(aps.reduce((t, i) => t + i._falta, 0))})</button>` : ''; })()}
        <div class="dist-f">
          <div class="kv"><span>Planejado distribuir</span><b>${brl(d.planejado)}</b></div>
          <div class="kv"><span>Já distribuído</span><b>${brl(d.distribuido)}</b></div>
          <div class="kv ${d.sobraPlanejada < 0 ? 'neg' : ''}"><span>Sobra planejada</span><b>${brl(d.sobraPlanejada)}</b></div>
          ${d.recebido > 0 ? `<div class="kv"><span>Sobra real (recebido − distribuído)</span><b>${brl(d.sobraReal)}</b></div>` : ''}
        </div></div>`;
    });
    const viaCx = im.filter(i => i.entidade === 'PF' && i.tipo === 'pagamento' && i.caixinhaId);
    if (viaCx.length) h += `<div class="sec-t">Pagamentos com dinheiro das caixinhas</div>
      <div class="card lista">${viaCx.map(i => linhaItem(i)).join('')}</div>`;
    const outros = im.filter(i => i.entidade === 'PF' && i.tipo === 'pagamento' && !i.caixinhaId && !dist.some(d => d.itens.includes(i)));
    if (outros.length) h += `<div class="card lista">${outros.map(i => linhaItem(i)).join('')}</div>`;
  } else {
    const r = FX.resumo('PJ', ctx);
    const rm = FX.receitaMaquiagem(ctx);
    const saidasPlan = im.filter(i => FX.consomeConta(i) && !['dispensado', 'reprogramado'].includes(i._status));
    const totPlan = saidasPlan.reduce((t, i) => t + Number(i.valor), 0);
    h += `<div class="card"><div class="kv"><span>Recebido de clientes no mês</span><b>${brl(rm.caixa.recebido)}</b></div>
      <div class="kv"><span>A receber no mês</span><b>${brl(rm.caixa.aReceber + rm.caixa.atrasado)}</b></div>
      <div class="kv"><span>Distribuições planejadas (pró-labore + caixinhas + pagamentos)</span><b>${brl(totPlan)}</b></div>
      <div class="kv"><span>Ainda a distribuir</span><b>${brl(r.compromissosPlano)}</b></div>
      <div class="kv ${r.saldoBancario < r.compromissosPlano ? 'neg' : ''}"><span>Saldo em conta agora</span><b>${brl(r.saldoBancario)}</b></div>
      ${r.saldoBancario < r.compromissosPlano ? `<div class="muted sm">O saldo atual não cobre todas as distribuições restantes — distribua conforme os recebimentos entram, na ordem das datas.</div>` : ''}</div>`;
    FX.semanas(UI.mes, ctx.cfg).forEach(w => {
      const its = im.filter(i => i._semana === w.n);
      if (!its.length) return;
      h += `<div class="sec-t">Semana ${w.n} · ${w.label}</div><div class="card lista">${its.map(i => linhaItem(i)).join('')}</div>`;
    });
  }
  return h;
}

function telaModelo() {
  const its = ST.itens.filter(i => i.mes === 'modelo').sort((a, b) => a.dia - b.dia || (a.ordem || 0) - (b.ordem || 0));
  const bloco = ent => {
    const l = its.filter(i => i.entidade === ent);
    return `<div class="sec-t">${ent === 'PF' ? 'Pessoal' : 'Empresa'} · ${brl(l.filter(FX.consomeConta).reduce((t, i) => t + Number(i.valor), 0))} saindo da conta</div>
    <div class="card lista">${l.map(i => `<div class="it" onclick="formItem('${i.id}')">
      <div class="it-d">dia<small>${i.dia}</small></div>
      <div class="it-m"><div class="it-t">${esc(FX.nomeItem(i))}</div><div class="it-s">${TIPO_LABEL[i.tipo]}${i.caixinhaId ? ' · ' + esc(nomeConta(i.caixinhaId)) : ''}${i.mesInicio || i.mesFim ? ' · ' + (i.mesInicio ? nomeMesC(i.mesInicio) : '…') + ' → ' + (i.mesFim ? nomeMesC(i.mesFim) : '…') : ''}</div></div>
      <div class="it-v">${brl(i.valor)}</div></div>`).join('') || vazio('Sem itens')}</div>`;
  };
  return `<div class="aviso">Você está editando o <b>modelo</b>. Ele só é usado ao criar meses novos — não altera meses já criados.</div>
    <div class="row"><button class="lnk" onclick="UI.modelo=false;render()">‹ Voltar ao mês</button><button class="lnk" onclick="formItem(null)">+ Item no modelo</button></div>
    ${bloco('PJ')}${ST.pfLiberado ? bloco('PF') : cartaoPFBloqueado()}`;
}

// ── MOVIMENTAÇÕES ────────────────────────────────────────
function telaMovs() {
  const ent = UI.ent;
  let h = seletorEnt();
  if (ent === 'PF' && !ST.pfLiberado) return h + cartaoPFBloqueado();
  const movs = stMovs().filter(m => m.entidade === ent && FX.mesDe(m.data) === UI.mes);
  const f = UI.movFiltro;
  const filt = movs.filter(m => f === 'todos' ||
    (f === 'entradas' && m.natureza === 'entrada') || (f === 'saidas' && m.natureza === 'saida') ||
    (f === 'transf' && (m.natureza === 'transferencia' || m.natureza === 'ajuste')) ||
    (f === 'pendente' && !m.realizado) || (f === 'naoconc' && m.realizado && !m.conciliado && m.afetaSaldo))
    .sort((a, b) => b.data.localeCompare(a.data));
  const real = movs.filter(m => m.realizado);
  const ent$ = real.filter(m => m.natureza === 'entrada').reduce((t, m) => t + m.valor, 0);
  const sai$ = real.filter(m => m.natureza === 'saida' && m.afetaSaldo).reduce((t, m) => t + m.valor, 0);
  const tr$ = real.filter(m => m.natureza === 'transferencia').reduce((t, m) => t + m.valor, 0);
  h += `<div class="card"><div class="grid3"><div><span>Entrou</span><b class="pos">${brl(ent$)}</b></div>
    <div><span>Saiu</span><b class="neg">${brl(sai$)}</b></div><div><span>Transferências</span><b>${brl(tr$)}</b></div></div>
    <div class="muted sm">Transferências entre conta e caixinhas não contam como gasto.</div></div>
    <button class="btn sec" style="margin:0 0 10px" onclick="formExtrato()">⇪ Importar extrato do banco (OFX/CSV)</button>
    <div class="chips">${[['todos', 'Todos'], ['entradas', 'Entradas'], ['saidas', 'Saídas'], ['transf', 'Transferências'],
      ['pendente', 'Previstos'], ['naoconc', 'Não conciliados']].map(([k, l]) =>
      `<button class="${f === k ? 'on' : ''}" onclick="UI.movFiltro='${k}';render()">${l}</button>`).join('')}</div>
    <div class="card lista">${filt.map(linhaMov).join('') || vazio('Nada neste mês.')}</div>
    <div class="fab-wrap"><button class="fab" onclick="menuNovo()">+</button></div>`;
  return h;
}

function linhaMov(m) {
  const sinal = m.natureza === 'entrada' ? 1 : m.natureza === 'saida' ? -1 : 0;
  let titulo = m.descricao || m.categoria;
  let sub = [];
  if (m.natureza === 'transferencia' || m.natureza === 'ajuste') {
    titulo = m.natureza === 'ajuste' ? 'Ajuste de conciliação' : ({ aporte: 'Aporte', resgate: 'Resgate', fatura: 'Pagamento de fatura', entre_contas: 'Transferência' }[m.tipoTransf] || 'Transferência');
    sub.push(`${m.contaId ? nomeConta(m.contaId) : '—'} → ${m.destinoId ? nomeConta(m.destinoId) : '—'}`);
    if (m.descricao) sub.push(m.descricao);
  } else {
    sub.push(m.categoria);
    if (m.contaId) sub.push(nomeConta(m.contaId));
    if (m.caixinhaId && m.caixinhaId !== m.contaId) sub.push('💰 ' + nomeConta(m.caixinhaId) + (m.caixinhaAuto ? ' (auto)' : ''));
    if (m.pagoPelaPJ) sub.push('pago pela conta PJ');
    if (m.classe === 'prolabore') sub.push('pró-labore');
  }
  const tags = [!m.realizado ? '<span class="chip st-futuro">previsto</span>' : '',
    m.conciliado ? '<span class="chip ok">conciliado</span>' : '',
    m.planoItemId ? `<span class="chip">no plano${m.autoVinculo ? ' · auto' : ''}</span>` : ''].join('');
  return `<div class="mv ${m.realizado ? '' : 'prev'}" onclick="formMov('${esc(m.key)}')">
    <div class="it-d">${dm(m.data)}</div>
    <div class="it-m"><div class="it-t">${esc(titulo)}</div><div class="it-s">${esc(sub.filter(Boolean).join(' · '))}</div><div>${tags}</div></div>
    <div class="mv-v ${sinal > 0 ? 'pos' : sinal < 0 ? 'neg' : ''}">${sinal ? brl(sinal * m.valor, true) : brl(m.valor)}</div></div>`;
}

// ── CAIXINHAS ────────────────────────────────────────────
function telaCaixinhas() {
  const ent = UI.ent;
  let h = seletorEnt();
  if (ent === 'PF' && !ST.pfLiberado) return h + cartaoPFBloqueado();
  const ctx = stCtx(UI.mes);
  const r = FX.resumo(ent, ctx);
  h += `<div class="card"><div class="grid3"><div><span>Em conta</span><b>${brl(r.saldoBancario)}</b></div>
    <div><span>Reservado</span><b>${brl(r.reservado)}</b></div><div><span>Fatura</span><b>${brl(r.faturaAberta)}</b></div></div></div>`;

  // contas (corrente, espécie, cartões) + conciliação
  h += `<div class="sec-t">Contas</div><div class="card lista">${r.saldos.filter(s => s.conta.tipo !== 'caixinha').map(s => `
    <div class="ct conta">
      <div class="it-m"><div class="it-t">${esc(s.conta.nome)}</div>
        <div class="it-s">${s.conferido ? `conferido a partir de ${dm(s.desde)}` : `<span class="neg">saldo real não informado</span> — mostrando só movimentos desde ${dm(s.desde) || 'o início'}`}</div></div>
      <div class="it-v ${s.saldo < 0 ? 'neg' : ''}">${brl(s.saldo)}${s.conta.tipo === 'cartao' && s.saldo < 0 ? '<small>fatura aberta</small>' : ''}</div>
      <div class="ct-b">${s.conta.tipo === 'cartao' && s.saldo < 0 ? `<button class="btn mini" onclick="formFatura('${s.conta.id}')">Pagar</button>` : ''}
        <button class="btn mini sec" onclick="formConciliar('${s.conta.id}')">Conciliar</button>
        ${s.conta.tipo !== 'especie' ? `<button class="btn mini sec" onclick="formExtrato('${s.conta.id}')">Importar extrato</button>` : ''}</div>
    </div>`).join('')}</div>`;

  const cxs = contasDe(ent, ['caixinha']);
  h += `<div class="sec-t">Caixinhas</div>`;
  cxs.forEach(cx => {
    const c = FX.caixinha(cx, ctx);
    const aberto = UI.aberto[cx.id] !== false && (UI.aberto[cx.id] || ['semanada', 'fixas'].includes(cx.finalidade));
    h += `<div class="card cx">
      <div class="cx-h" onclick="toggleAberto('${cx.id}')">
        <div><b>${esc(cx.nome)}</b><div class="muted sm">${c.conferido ? '' : 'saldo não conferido · '}início do mês ${brl(c.saldoInicio)}</div></div>
        <div class="r"><div class="big2 ${c.saldoAtual < 0 ? 'neg' : ''}">${brl(c.saldoAtual)}</div><div class="muted sm">saldo atual</div></div>
      </div>
      <div class="kv sm"><span>Aportado no mês</span><b>${brl(c.aportado)} / ${brl(c.aportePrevisto)}</b></div>
      ${barra(c.aportado, c.aportePrevisto)}
      <div class="kv sm"><span>Usado no mês</span><b>${brl(c.usado)}${c.usoPrevisto ? ' / ' + brl(c.usoPrevisto) + ' previsto' : ''}</b></div>
      ${aberto ? detalheCaixinha(cx, c, ctx) : `<button class="lnk sm" onclick="toggleAberto('${cx.id}')">Detalhes ›</button>`}
      <div class="row cx-b"><button class="btn mini sec" onclick="formTransferencia('${ent}', null, '${cx.id}')">Aportar</button>
        <button class="btn mini sec" onclick="formGasto('${ent}', '${cx.id}')">Registrar gasto</button>
        <button class="btn mini sec" onclick="formConciliar('${cx.id}')">Conciliar</button></div>
    </div>`;
  });
  if (!cxs.length) h += vazio('Nenhuma caixinha cadastrada (Ajustes › Contas).');

  const dvs = ST.dividas.filter(d => d.entidade === ent && d.ativa !== false && d.situacao === 'no_plano');
  h += `<button class="lnk" onclick="go('dividas')">Ver todas as dívidas ›</button>`;
  if (dvs.length) h += `<div class="sec-t">Dívidas no plano</div><div class="card lista">${dvs.map(d => {
    const x = FX.divida(d, ctx.movs);
    return `<div class="ct" onclick="formDivida('${d.id}')"><div class="it-m"><div class="it-t">${esc(d.nome)}</div>
      <div class="it-s">${d.valorParcela ? brl(d.valorParcela) + '/mês' : ''}${d.diaVencimento ? ' · dia ' + d.diaVencimento : ''}
      ${x.parcelasRestantesEst != null ? ' · ' + x.parcelasRestantesEst + ' parcelas restantes (est.)' : ''}
      ${d.dataSaldo ? '' : ' · <span class="neg">saldo não confirmado</span>'}</div></div>
      <div class="it-v">${d.saldoDevedor != null ? brl(d.saldoDevedor) : '—'}<small>${d.dataSaldo ? 'quitação em ' + dm(d.dataSaldo) : 'valor da consultoria'}</small>
      ${x.pagoPosRef ? `<small>pago depois: ${brl(x.pagoPosRef)}</small>` : ''}</div></div>`;
  }).join('')}</div>`;
  return h;
}

function detalheCaixinha(cx, c, ctx) {
  let h = '';
  if (cx.finalidade === 'semanada') {
    const s = FX.semanadas(cx.entidade, ctx);
    if (s) h += `<table class="tb"><thead><tr><th>Semana</th><th>Reservado</th><th>Gasto</th><th>Saldo</th>${cx.entidade === 'PJ' ? '<th>Atend.</th>' : ''}</tr></thead><tbody>
      ${s.linhas.map(l => `<tr class="${l.atual ? 'atual' : ''} ${l.estourou ? 'neg' : ''}">
        <td>S${l.semana.n}<small>${l.semana.label}</small></td>
        <td>${brlc(l.reservado)}${l.previsto !== l.reservado ? `<small>prev. ${brlc(l.previsto)}</small>` : ''}</td>
        <td>${brlc(l.gasto)}<small>${Object.entries(l.porCategoria).map(([k, v]) => esc(k.replace(' trabalho', '')) + ' ' + brlc(v)).join('<br>')}</small></td>
        <td>${brlc(l.saldo)}</td>${cx.entidade === 'PJ' ? `<td>${l.atendimentos || 0}${l.custoPorAtendimento ? `<small>${brlc(l.custoPorAtendimento)}/atend.</small>` : ''}</td>` : ''}</tr>`).join('')}
      </tbody><tfoot><tr><td>Mês</td><td>${brlc(s.reservado)}</td><td>${brlc(s.gasto)}</td><td>${brlc(s.reservado - s.gasto)}</td>${cx.entidade === 'PJ' ? '<td></td>' : ''}</tr></tfoot></table>`;
  }
  const comp = FX.composicao(cx, ctx);
  if (comp.length) {
    h += `<table class="tb"><thead><tr><th>Item</th><th>Previsto</th><th>Pago</th><th>Dif.</th></tr></thead><tbody>
      ${comp.map(x => `<tr class="st-${x.status}" onclick="${FX.PENDENTE(x.status) ? `formExecutar('${x.item.id}')` : `formItem('${x.item.id}')`}">
        <td>${esc(x.descricao)}<small>vence ${dm(x.vencimento)} · ${ST_LABEL[x.status]}</small></td>
        <td>${brlc(x.previsto)}</td>
        <td>${x.pago ? brlc(x.pago) + `<small>${dm(x.dataPagamento)}</small>` : '—'}</td>
        <td class="${x.diferenca > 0 ? 'neg' : x.diferenca < 0 ? 'pos' : ''}">${x.diferenca == null ? '' : brlc(x.diferenca)}</td></tr>`).join('')}
      </tbody><tfoot><tr><td>Total</td><td>${brlc(comp.reduce((t, x) => t + x.previsto, 0))}</td><td>${brlc(comp.reduce((t, x) => t + x.pago, 0))}</td><td></td></tr></tfoot></table>`;
  }
  if (cx.finalidade === 'sazonais') {
    const cfg = ctx.cfg, ano = UI.mes.slice(0, 4);
    const gastosAno = ctx.movs.filter(m => m.caixinhaId === cx.id && m.classe === 'despesa' && m.realizado && String(m.competencia || m.data).startsWith(ano));
    const porCat = {}; gastosAno.forEach(m => { porCat[m.categoria] = (porCat[m.categoria] || 0) + m.valor; });
    const linhas = (cfg.sazonais || []).map(s => ({ nome: s.nome, anual: s.anual, gasto: porCat[s.nome] || 0 }));
    Object.keys(porCat).filter(k => !linhas.some(l => l.nome === k)).forEach(k => linhas.push({ nome: k, anual: 0, gasto: porCat[k] }));
    h += `<table class="tb"><thead><tr><th>Finalidade (${ano})</th><th>Orç. anual</th><th>Gasto</th><th>Resta</th></tr></thead><tbody>
      ${linhas.map(l => `<tr class="${l.gasto > l.anual && l.anual ? 'neg' : ''}"><td>${esc(l.nome)}</td><td>${l.anual ? brlc(l.anual) : '—'}</td><td>${brlc(l.gasto)}</td><td>${l.anual ? brlc(l.anual - l.gasto) : ''}</td></tr>`).join('')}
      </tbody></table>`;
  }
  if (c.usos.length && cx.finalidade !== 'semanada') {
    h += `<div class="muted sm" style="margin-top:8px">Usos no mês</div>${c.usos.map(m => `<div class="kv sm" onclick="formMov('${esc(m.key)}')"><span>${dm(m.data)} · ${esc(m.descricao || m.categoria)}</span><b>${brl(m.valor)}</b></div>`).join('')}`;
  }
  return h + `<button class="lnk sm" onclick="toggleAberto('${cx.id}')">Recolher</button>`;
}

// ── PENDÊNCIAS ───────────────────────────────────────────
function telaPendencias() {
  const ctx = stCtx(UI.mes);
  const im = FX.itensDoMes(ST.itens, UI.mes, ctx.movs, ctx.hoje, ctx.cfg).filter(i => ST.pfLiberado || i.entidade === 'PJ');
  const pend = im.filter(i => FX.PENDENTE(i._status));
  const grupos = [['Atrasados', pend.filter(i => /atrasado/.test(i._status))], ['Hoje', pend.filter(i => i._status === 'hoje')],
    ['Ainda neste mês', pend.filter(i => i._status === 'futuro' || i._status === 'parcial')]];
  let h = '';
  if (!pend.length) h += `<div class="card ok-card">Nenhuma movimentação planejada pendente em ${nomeMes(UI.mes)}.</div>`;
  grupos.forEach(([t, l]) => { if (l.length) h += `<div class="sec-t">${t} <span class="cnt">${l.length}</span> <span class="muted sm">${brl(l.reduce((s, i) => s + i._falta, 0))}</span></div><div class="card lista">${l.map(i => linhaItem(i, true)).join('')}</div>`; });

  const rm = FX.receitaMaquiagem(ctx);
  if (rm.atrasadosLista.length) h += `<div class="sec-t">Recebimentos de clientes vencidos (ainda “Previsto”)</div><div class="card lista">
    ${rm.atrasadosLista.slice(0, 30).map(m => `<div class="ct"><div class="it-m"><div class="it-t">${esc(m.cliente || m.descricao)}</div>
      <div class="it-s">${esc(m.tipoEntrada)} · venceu ${dm(m.data)}${m.dataServ ? ' · atendimento ' + dm(m.dataServ) : ''}</div></div>
      <div class="it-v">${brl(m.valor)}</div><button class="btn mini" onclick="formConfirmar('${m.id}')">Recebi</button></div>`).join('')}</div>`;

  const ents = ST.pfLiberado ? ['PF', 'PJ'] : ['PJ'];
  const semCx = ctx.movs.filter(m => ents.includes(m.entidade) && m.classe === 'despesa' && m.realizado && !m.caixinhaId && !m.planoItemId && FX.mesDe(m.data) === UI.mes);
  if (semCx.length) h += `<div class="sec-t">Gastos sem caixinha <span class="cnt">${semCx.length}</span></div>
    <div class="muted sm" style="margin:-4px 4px 8px">Diga de qual reserva saiu (ou deixe como “fora do plano”).</div>
    <div class="card lista">${semCx.slice(0, 40).map(linhaMov).join('')}</div>`;

  const naoConf = ST.contas.filter(c => ents.includes(c.entidade) && c.tipo !== 'antiga' && c.ativa !== false && (c.saldoInicial == null || !c.dataSaldoInicial));
  if (naoConf.length) h += `<div class="sec-t">Contas sem saldo conferido</div><div class="card lista">${naoConf.map(c =>
    `<div class="ct"><div class="it-m"><div class="it-t">${esc(c.nome)}</div><div class="it-s">${c.entidade}</div></div><button class="btn mini sec" onclick="formConciliar('${c.id}')">Informar saldo</button></div>`).join('')}</div>`;

  // dívidas no plano sem item neste mês (as "fora do plano" ficam só no módulo Dívidas, por decisão)
  const dvSemItem = ST.dividas.filter(d => ents.includes(d.entidade) && d.ativa !== false && d.situacao === 'no_plano' &&
    stPlano(UI.mes) && !im.some(i => i.dividaId === d.id) && !(d.parcelasRestantes === 0));
  if (dvSemItem.length) h += `<div class="sec-t">Dívidas no plano sem parcela neste mês</div><div class="card lista">${dvSemItem.map(d =>
    `<div class="ct" onclick="formDivida('${d.id}')"><div class="it-m"><div class="it-t">${esc(d.nome)}</div><div class="it-s">confira se terminou ou se a vigência precisa ser estendida</div></div></div>`).join('')}</div>`;
  return h;
}

// ── ANÁLISES ─────────────────────────────────────────────
function telaAnalises() {
  const ent = UI.ent;
  let h = seletorEnt();
  if (ent === 'PF' && !ST.pfLiberado) return h + cartaoPFBloqueado();
  const ctx = stCtx(UI.mes);
  const a = FX.analiseMes(ent, ctx);
  const hist = FX.historico(ent, ctx, 6);
  h += `<div class="card"><div class="row"><b>Plano × realizado — ${nomeMes(UI.mes)}</b><span class="big2">${a.cumprimento == null ? '—' : a.cumprimento.toFixed(0) + '%'}</span></div>
    ${barra(a.executado, a.planejado)}
    <div class="kv sm"><span>Planejado</span><b>${brl(a.planejado)}</b></div>
    <div class="kv sm"><span>Executado (até o previsto de cada item)</span><b>${brl(a.executado)}</b></div>
    <div class="kv sm ${a.totalForaCx ? 'neg' : ''}"><span>Gastos fora das caixinhas e do plano</span><b>${brl(a.totalForaCx)}</b></div></div>`;

  if (a.semanadas) {
    const l = a.semanadas.linhas.filter(x => x.passada || x.atual);
    const media = hist.filter(x => x.semanadaReservada > 0);
    h += `<div class="sec-t">Semanadas — estão sendo suficientes?</div><div class="card">
      ${l.map(x => `<div class="kv sm ${x.estourou ? 'neg' : ''}"><span>S${x.semana.n} (${x.semana.label})</span>
        <b>${brlc(x.gasto)} de ${brlc(x.reservado || x.previsto)} · ${x.saldo >= 0 ? 'sobrou ' + brlc(x.saldo) : 'faltou ' + brlc(-x.saldo)}</b></div>`).join('') || vazio('Nenhuma semana encerrada ainda.')}
      <div class="hist">${hist.map(x => `<div class="hb"><div class="hb-bars">
        <i class="res" style="height:${pct(x.semanadaReservada, hist)}%"></i><i class="gas" style="height:${pct(x.semanadaGasta, hist)}%"></i></div>
        <small>${nomeMesC(x.mes)}</small></div>`).join('')}</div>
      <div class="legenda"><span><i class="res"></i>reservado</span><span><i class="gas"></i>gasto</span></div>
      ${media.length >= 2 ? `<div class="muted sm">Média dos últimos ${media.length} meses: reservado ${brlc(media.reduce((t, x) => t + x.semanadaReservada, 0) / media.length)} · gasto ${brlc(media.reduce((t, x) => t + x.semanadaGasta, 0) / media.length)}</div>` : ''}
    </div>`;
  }

  const desvios = [];
  a.acima.forEach(i => desvios.push(`<div class="kv sm neg"><span>${esc(i.descricao)} (${dm(i._data)})</span><b>+${brl(i._excedente)} acima</b></div>`));
  a.estouros.forEach(c => desvios.push(`<div class="kv sm neg"><span>Caixinha ${esc(c.caixinha.nome)}</span><b>usou ${brl(c.usado)} · tinha ${brl(c.saldoInicio + c.aportado)}</b></div>`));
  if (a.semanadas) a.semanadas.linhas.filter(x => x.estourou).forEach(x => desvios.push(`<div class="kv sm neg"><span>Semanada S${x.semana.n}</span><b>gastou ${brl(x.gasto)} de ${brl(x.reservado || x.previsto)}</b></div>`));
  h += `<div class="sec-t">Desvios do mês</div><div class="card">${desvios.join('') || '<div class="ok sm">Nenhum gasto acima do planejado.</div>'}</div>`;

  const fixas = FX.caixinhaPorFinalidade(ST.contas, ent, 'fixas');
  if (fixas) {
    const comp = FX.composicao(fixas, ctx);
    const prev = comp.reduce((t, x) => t + x.previsto, 0), pago = comp.reduce((t, x) => t + x.pago, 0);
    h += `<div class="card"><div class="row"><b>Despesas fixas</b><span>${brl(pago)} de ${brl(prev)}</span></div>${barra(pago, prev)}
      <div class="muted sm">${comp.filter(x => x.status === 'feito').length} de ${comp.length} pagas · diferença acumulada ${brl(comp.reduce((t, x) => t + (x.diferenca || 0), 0))}</div></div>`;
  }

  if (ent === 'PJ') {
    const rm = FX.receitaMaquiagem(ctx);
    h += `<div class="sec-t">Maquiagem — quanto entrou e quanto ainda vai entrar</div><div class="card">
      <div class="muted sm">Pela data do atendimento (${rm.servico.atendimentos} atendimentos)</div>
      <div class="kv sm"><span>Contratado</span><b>${brl(rm.servico.contratado)}</b></div>
      <div class="kv sm"><span>Já recebido</span><b class="pos">${brl(rm.servico.recebido)}</b></div>
      <div class="kv sm"><span>Pendente</span><b>${brl(rm.servico.pendente)}</b></div>
      <div class="muted sm" style="margin-top:8px">Pela data do pagamento</div>
      <div class="kv sm"><span>Recebido no mês</span><b>${brl(rm.caixa.recebido)}</b></div>
      <div class="kv sm"><span>A receber</span><b>${brl(rm.caixa.aReceber)}</b></div>
      <div class="kv sm ${rm.caixa.atrasado ? 'neg' : ''}"><span>Vencido sem confirmação</span><b>${brl(rm.caixa.atrasado)}</b></div>
      <div class="kv sm"><span>Recebido e ainda não conciliado com o extrato</span><b>${brl(rm.caixa.naoConciliado)}</b></div></div>`;
  }

  h += `<div class="sec-t">Evolução (6 meses)</div><div class="card"><table class="tb"><thead><tr><th>Mês</th><th>Planejado</th><th>Executado</th><th>Fora do plano</th></tr></thead><tbody>
    ${hist.map(x => `<tr><td>${nomeMesC(x.mes)}</td><td>${x.planejado ? brlc(x.planejado) : '—'}</td><td>${x.planejado ? brlc(x.executado) + `<small>${x.cumprimento != null ? x.cumprimento.toFixed(0) + '%' : ''}</small>` : '—'}</td><td>${brlc(x.foraCx)}</td></tr>`).join('')}
    </tbody></table></div>`;
  return h;
}
function pct(v, hist) {
  const max = Math.max(1, ...hist.map(x => Math.max(x.semanadaReservada, x.semanadaGasta)));
  return Math.round(v / max * 100);
}

// ── AJUSTES ──────────────────────────────────────────────
function telaAjustes() {
  if (UI.extrato) return telaExtrato();
  const item = (t, d, fn) => `<button class="aj" onclick="${fn}"><b>${t}</b><span>${d}</span></button>`;
  return `<div class="card lista">
    ${item('Importar extrato (OFX/CSV)', 'Concilia com o que já foi lançado — sem duplicar', 'formExtrato()')}
    ${item('Contas e caixinhas', 'Inter PF/PJ, caixinhas, cartões, contas antigas', "UI.aberto.contas=!UI.aberto.contas;render()")}
    ${UI.aberto.contas ? listaContas() : ''}
    ${item('Dívidas', 'Saldo devedor, parcelas, vencimentos', "UI.aberto.dividas=!UI.aberto.dividas;render()")}
    ${UI.aberto.dividas ? listaDividas() : ''}
    ${item('Modelo do planejamento', 'Base para criar os próximos meses', "UI.modelo=true;go('plano')")}
    ${item('Semanas, categorias e sazonais', 'Datas das semanas, listas de categorias, orçamento anual das sazonais', 'formConfig()')}
    ${item('Histórico de alterações', 'Tudo o que foi gravado pelo fluxo', 'verLog()')}
    ${ST.pfLiberado ? item('Sair do pessoal', 'Bloqueia a PF neste aparelho', 'sairPF()') : item('Entrar no pessoal', 'Libera a PF', 'abrirLoginPF()')}
  </div>
  <div class="muted sm" style="padding:0 6px">Fonte do modelo inicial: ${esc(FX_MODELO.fonte)}. Diagnóstico e diferenças da planilha em <code>fluxo/DIAGNOSTICO.md</code>.</div>`;
}
function listaContas() {
  const ents = ST.pfLiberado ? ['PF', 'PJ'] : ['PJ'];
  return `<div class="sub">${ents.map(e => `<div class="muted sm">${e}</div>${ST.contas.filter(c => c.entidade === e).map(c =>
    `<div class="kv sm" onclick="formConta('${c.id}')"><span>${esc(c.nome)} ${c.ativa === false ? '(inativa)' : ''}</span><b>${c.tipo}${c.padrao ? ' · padrão' : ''}${c.finalidade ? ' · ' + c.finalidade : ''}</b></div>`).join('')}`).join('')}
    <button class="lnk sm" onclick="formConta(null)">+ Nova conta ou caixinha</button></div>`;
}
function listaDividas() {
  const ents = ST.pfLiberado ? ['PF', 'PJ'] : ['PJ'];
  return `<div class="sub">${ST.dividas.filter(d => ents.includes(d.entidade)).map(d =>
    `<div class="kv sm" onclick="formDivida('${d.id}')"><span>${esc(d.nome)} · ${d.entidade}${d.ativa === false ? ' (quitada)' : ''}</span><b>${d.saldoDevedor != null ? brl(d.saldoDevedor) : '—'}</b></div>`).join('')}
    <button class="lnk sm" onclick="formDivida(null)">+ Nova dívida</button></div>`;
}

function telaExtrato() {
  const x = UI.extrato, conta = stConta(x.contaId);
  const cont = k => x.propostas.filter(p => p.acao === k).length;
  const cats = categorias(conta.entidade);
  const opcoesDecisao = p => [['conciliar', 'Já lançado — conciliar', !!p.match], ['prolabore', 'Pró-labore (PJ → PF)', (conta.entidade === 'PJ' && p.linha.valor < 0) || (conta.entidade === 'PF' && p.linha.valor > 0)], ['gasto', conta.entidade === 'PJ' ? 'Gasto da empresa' : 'Novo gasto', p.linha.valor < 0],
    ['pessoal', 'Gasto pessoal pago pela PJ', conta.entidade === 'PJ' && p.linha.valor < 0],
    ['cliente', 'Pagamento de cliente (já lançado)', conta.entidade === 'PJ' && p.linha.valor > 0 && (p.candidatos || []).length],
    ['receita', conta.entidade === 'PJ' ? 'Nova receita (não estava prevista)' : 'Nova entrada', p.linha.valor > 0], ['transferencia', 'Transferência interna', true], ['ignorar', 'Ignorar', true]]
    .filter(o => o[2]).map(([v, l]) => `<option value="${v}" ${p.decisao === v ? 'selected' : ''}>${l}</option>`).join('');
  return `<div class="row"><button class="lnk" onclick="UI.extrato=null;render()">‹ Cancelar</button><b>${esc(conta.nome)}</b></div>
    <div class="card sm">${esc(x.info || '')}<br><b>${cont('conciliar')}</b> já lançados (serão só conciliados) · <b>${cont('novo')}</b> novos · <b>${cont('duplicada')}</b> já importados${cont('estorno') ? ` · <b>${cont('estorno')}</b> devolvidos (ignorados)` : ''}</div>
    ${x.propostas.map((p, k) => `<div class="card ex ${p.acao}">
      <div class="row"><span>${dm(p.linha.data)} · ${esc(p.linha.descricao || '(sem descrição)')}</span><b class="${p.linha.valor > 0 ? 'pos' : 'neg'}">${brl(p.linha.valor, true)}</b></div>
      ${p.match ? `<div class="muted sm">≈ ${esc(p.match.descricao || p.match.categoria)} · ${dm(p.match.data)}${p.viraRealizado ? ' · <b>previsto → será confirmado</b>' : ''}</div>` : ''}
      ${p.auto ? `<div class="muted sm">${autoTag({ regra: 'aprendido', plano: 'do plano', palavra: 'pela descrição', nome: 'pelo nome', valor: 'pelo valor' }[p.auto])} ${p.planoItemId && stItem(p.planoItemId) ? esc(FX.nomeItem(stItem(p.planoItemId))) : ''}</div>` : ''}
      ${p.acao === 'estorno' ? `<div class="muted sm">${autoTag('devolvido')} ${p.linha.valor < 0 ? 'Voltou' : 'Devolução do Pix de'} ${brl(Math.abs(p.par.valor))} em ${dm(p.par.data)} — os dois se anulam e serão ignorados.</div>` : ''}
      ${p.acao === 'duplicada' ? '<div class="muted sm">Já importado antes.</div>' : `
      <select class="fi sm" onchange="exDecisao(${k}, this.value)">${opcoesDecisao(p)}</select>
      ${p.decisao === 'cliente' ? (() => {
        const c = (p.candidatos || []).find(x => String(x.id) === String(p.entryId));
        const dif = c ? FX.r2(Math.abs(p.linha.valor) - c.valor) : 0;
        return `<input class="fi sm" placeholder="Buscar cliente…" value="${esc(p.busca || '')}" oninput="exBuscaCliente(${k}, this.value)">
        <select class="fi sm" id="ex-cli-${k}" onchange="UI.extrato.propostas[${k}].entryId=this.value;render()">${opcoesCliente(p)}</select>
        <div class="muted sm">${!c ? '' : c.recebido ? `Já estava como recebido no Financeiro: só será conciliado${Math.abs(dif) >= 0.01 ? ` (valor diferente do lançado, ${brl(c.valor)} — fica anotado para conferir)` : ''}.`
          : Math.abs(dif) < 0.01 ? 'Confirma este recebimento (previsto → realizado), sem criar receita nova.'
          : dif < 0 ? `Pagamento parcial: ${brl(Math.abs(p.linha.valor))} fica como recebido e ${brl(-dif)} continua previsto.`
          : `Recebeu ${brl(dif)} a mais que o previsto: o recebimento é confirmado com o valor do extrato.`}
          ${p.auto === 'regra' ? ' Pagador reconhecido de antes.' : ''}</div>`; })() : ''}
      ${p.decisao === 'prolabore' ? `<select class="fi sm" onchange="UI.extrato.propostas[${k}].planoItemId=this.value">
          ${AC.itensProlaboreDoMes(FX.mesDe(p.linha.data)).map(i => `<option value="${i.id}" ${p.planoItemId === i.id ? 'selected' : ''}>Conta para: ${esc(FX.nomeItem(i))} — falta ${brl(i._falta)}</option>`).join('')}
          <option value="" ${!p.planoItemId ? 'selected' : ''}>Fora do plano (pró-labore extra)</option></select>
        <div class="muted sm">Sai da PJ e entra na sua conta pessoal. Não é despesa da empresa. Pagamentos soltos vão somando na parcela até completar.</div>` : ''}
      ${p.decisao === 'pessoal' ? `<select class="fi sm" onchange="UI.extrato.propostas[${k}].categoria=this.value"><option value="">Categoria pessoal…</option>${optCategorias('PF', p.categoria)}</select>
        <div class="muted sm">Sai da conta PJ, não conta como despesa da empresa e entra no seu pessoal.</div>` : ''}
      ${p.decisao === 'gasto' || p.decisao === 'receita' ? `<select class="fi sm" onchange="UI.extrato.propostas[${k}].categoria=this.value">
        ${p.decisao === 'receita' && conta.entidade === 'PF' ? (ST.cfg || FX_MODELO.config).categorias.receitasPF.map(c => `<option ${p.categoria === c ? 'selected' : ''}>${c}</option>`).join('')
          : p.decisao === 'receita' ? '<option>Extrato</option>' : `<option value="">Categoria…</option>${optCategorias(conta.entidade, p.categoria)}`}</select>` : ''}
      ${p.decisao === 'gasto' ? `<select class="fi sm" onchange="UI.extrato.propostas[${k}].caixinhaId=this.value">${optContas(conta.entidade, ['caixinha'], p.caixinhaId, 'Sem caixinha (fora do plano)')}</select>` : ''}
      ${p.decisao === 'transferencia' ? `<select class="fi sm" onchange="UI.extrato.propostas[${k}].destinoId=this.value"><option value="">${p.linha.valor > 0 ? 'Veio de…' : 'Foi para…'}</option>${optContas(conta.entidade, ['caixinha', 'cartao', 'corrente', 'especie'].filter(Boolean), p.destinoId).replace(`value="${conta.id}"`, `value="${conta.id}" disabled`)}</select>` : ''}`}
    </div>`).join('')}
    <button class="btn" onclick="acAplicarExtrato()">Aplicar</button>
    <div class="muted sm center">O que você decidir aqui vira regra: na próxima importação essas descrições já vêm preenchidas.</div>`;
}

// Opções do seletor de recebimentos: filtra pela busca; sem busca mostra os 80 mais prováveis
function opcoesCliente(p) {
  const termos = FX.tokensNome(p.busca || '');
  let lista = (p.candidatos || []);
  if (termos.length) lista = lista.filter(x => { const n = FX.tokensNome(x.cliente).join(' '); return termos.every(t => n.includes(t)); });
  const sel = lista.find(x => String(x.id) === String(p.entryId)) || (p.candidatos || []).find(x => String(x.id) === String(p.entryId));
  const vis = lista.slice(0, termos.length ? 200 : 80);
  if (sel && !vis.includes(sel)) vis.unshift(sel);
  return vis.map(x => `<option value="${esc(x.id)}" ${String(x.id) === String(p.entryId) ? 'selected' : ''}>${esc(x.cliente)} · ${esc(x.tipo)} · ${dm(x.data)}/${String(x.data).slice(2, 4)} · ${brl(x.valor)} · ${x.recebido ? 'recebido' : 'previsto'}</option>`).join('')
    || '<option value="">Nenhum recebimento com esse nome</option>';
}

// ── DÍVIDAS ──────────────────────────────────────────────
function telaDividas() {
  const ents = ST.pfLiberado ? ['PF', 'PJ'] : ['PJ'];
  const ctx = stCtx(UI.mes);
  const r = FX.resumoDividas(ST.dividas, ctx.movs, ents);
  const atual = FX.mesDe(ctx.hoje);
  let h = `<div class="card"><div class="grid3"><div><span>Para quitar</span><b>${brl(r.quitacao)}</b></div>
    <div><span>Parcelado em aberto</span><b>${brl(r.emAberto)}</b></div><div><span>Parcelas/mês</span><b>${brl(r.parcelasMes)}</b></div></div>
    <div class="kv sm"><span>No plano</span><b>${r.plano.length} · ${brl(r.parcelasNoPlano)}/mês</b></div>
    <div class="kv sm"><span>Fora do plano (aguardando)</span><b>${r.fora.length} · ${brl(r.quitacaoFora)} para quitar</b></div>
    <div class="muted sm">Valores sem data são os da consultoria — atualize quando tiver o saldo do banco.</div></div>`;
  if (!ST.pfLiberado) h += cartaoPFBloqueado();
  const linha = x => {
    const d = x.divida;
    const rest = x.parcelasRestantesEst;
    const fim = rest != null && rest > 0 ? FX.addMes(atual, rest - 1) : null;
    return `<div class="ct" onclick="formDivida('${d.id}')">
      <div class="it-m"><div class="it-t">${esc(d.nome)} <span class="muted sm">${d.entidade}</span></div>
        <div class="it-s">${[d.taxaMes ? (d.taxaMes * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + '% a.m.' : '',
          d.valorParcela ? brlc(d.valorParcela) + (rest != null ? ' × ' + rest : '') : '', fim ? 'termina ~' + nomeMesC(fim) : '',
          d.dataSaldo ? 'saldo de ' + dm(d.dataSaldo) : 'saldo da consultoria'].filter(Boolean).join(' · ')}</div>
        ${x.pagoPosRef ? `<div class="it-s pos">pago depois do saldo: ${brl(x.pagoPosRef)}</div>` : ''}</div>
      <div class="it-v">${d.saldoDevedor != null ? brl(d.saldoDevedor) : '—'}<small>para quitar</small></div></div>`;
  };
  const grupo = (t, arr, extra) => arr.length ? `<div class="sec-t">${t} <span class="cnt">${arr.length}</span></div><div class="card lista">${arr.map(linha).join('')}</div>${extra || ''}` : '';
  h += grupo('No plano', r.plano);
  h += grupo('Fora do plano — para planejar', r.fora);

  // simulador
  const sim = UI.sim || (UI.sim = { orc: '', est: 'juros', ini: FX.addMes(atual, 1), quais: 'fora' });
  const alvo = (sim.quais === 'todas' ? r.detalhes : r.fora).map(x => x.divida);
  const res = FX.parseValor(sim.orc) > 0 ? FX.simularDividas(alvo, FX.parseValor(sim.orc), sim.est, sim.ini) : null;
  h += `<div class="sec-t">Planejar a quitação</div><div class="card sim">
    <div class="two"><div><label class="fl">Quanto dá para separar por mês</label><div class="vwrap"><span>R$</span><input class="fi" id="sim-orc" inputmode="decimal" value="${esc(sim.orc)}" onchange="UI.sim.orc=this.value;render()"></div></div>
      <div><label class="fl">A partir de</label><input class="fi" type="month" value="${sim.ini}" onchange="UI.sim.ini=this.value;render()"></div></div>
    <div class="two"><div><label class="fl">Prioridade</label><select class="fi" onchange="UI.sim.est=this.value;render()">
      ${[['juros', 'Maior juros primeiro'], ['saldo', 'Menor saldo primeiro'], ['prioridade', 'Minha ordem (prioridade)']].map(([v, l]) => `<option value="${v}" ${sim.est === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div><label class="fl">Dívidas</label><select class="fi" onchange="UI.sim.quais=this.value;render()">
      <option value="fora" ${sim.quais === 'fora' ? 'selected' : ''}>Só as fora do plano</option><option value="todas" ${sim.quais === 'todas' ? 'selected' : ''}>Todas</option></select></div></div>
    ${res ? (res.insuficiente ? `<div class="aviso erro sm sim-res">Com ${brl(FX.parseValor(sim.orc))}/mês os juros não deixam quitar em 20 anos.</div>`
      : `<div class="sim-res"><div class="kv"><span>Quita tudo em</span><b>${res.meses} meses (${nomeMes(res.mesFinal)})</b></div>
        <div class="kv sm"><span>Juros estimados no período</span><b>${brl(res.totalJuros)}</b></div>
        <table class="tb"><thead><tr><th>Ordem</th><th>Quita em</th><th>Juros</th></tr></thead><tbody>
        ${res.lista.slice().sort((a, b) => (a.quitaEm || '9').localeCompare(b.quitaEm || '9')).map(x => `<tr><td>${esc(x.divida.nome)}</td><td>${x.quitaEm ? nomeMesC(x.quitaEm) : '—'}</td><td>${brlc(x.juros)}</td></tr>`).join('')}
        </tbody></table></div>`) : '<div class="muted sm" style="margin-top:8px">Informe um valor mensal para ver em quanto tempo quita cada dívida.</div>'}
    <div class="muted sm" style="margin-top:8px">Estimativa: parte do valor para quitação e dos juros mensais informados. Para colocar no plano, abra a dívida › Incluir no plano.</div>
  </div>`;

  const quit = ST.dividas.filter(d => ents.includes(d.entidade) && (d.situacao === 'quitada' || d.ativa === false));
  if (quit.length) h += `<div class="sec-t">Quitadas</div><div class="card lista">${quit.map(d => `<div class="ct" onclick="formDivida('${d.id}')"><div class="it-m"><div class="it-t">${esc(d.nome)}</div></div></div>`).join('')}</div>`;
  h += `<button class="btn sec" onclick="formDivida(null)">+ Nova dívida</button>`;
  return h;
}
