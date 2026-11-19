// ════════════════════════════════════════════════════════════
// fluxo/scripts/telas.js — telas
//
// Sequência do dia a dia: Planejar → Distribuir → Gastar → Acompanhar → Conciliar.
//   Hoje        como está o mês, quanto ainda posso gastar, o que falta fazer
//   Plano       o planejado do mês e a distribuição de cada recebimento
//   Caixinhas   meta · transferido · falta · usado · disponível (sem misturar)
//   Movimentos  o que aconteceu (registrado ou importado)
//   Conferir    extrato + saldo do banco (o extrato confere, não cria o plano)
// Cor só com função: verde = feito/dentro · âmbar = pendente/perto do limite ·
// vermelho = passou do orçamento/exige ação · neutro = previsto/histórico.
// ════════════════════════════════════════════════════════════

const TELAS = { inicio: telaInicio, plano: telaPlano, caixinhas: telaCaixinhas, movs: telaMovs, conciliar: telaConciliar,
  mais: telaMais, dividas: telaDividas, analises: telaAnalises, ajustes: telaAjustes };

function render() {
  UI.tab = TAB_ALIAS[UI.tab] || UI.tab;
  if (!TELAS[UI.tab]) UI.tab = 'inicio';
  UI._pn = {};
  fecharBalao();
  document.body.dataset.tab = UI.tab;
  document.body.classList.toggle('revisando', !!(UI.tab === 'conciliar' && UI.extrato));
  renderNav();
  document.getElementById('mes-label').innerHTML = UI.tab === 'plano' && UI.modelo ? 'Modelo'
    : `<span class="ml-longo">${nomeMes(UI.mes)}</span><span class="ml-curto">${MESES_C[Number(UI.mes.slice(5, 7)) - 1]} ${UI.mes.slice(0, 4)}</span>`;
  const el = document.getElementById('view');
  let html = avisosGerais();
  if (ST.migracaoOk !== false && ST.carregado && !ST.contas.length) html += telaSetup();
  else if (ST.migracaoOk !== false) html += TELAS[UI.tab]();
  el.innerHTML = html;
}

function avisosGerais() {
  let h = '';
  if (ST.migracaoOk === false) h += `<div class="aviso erro"><b>Falta criar as tabelas do fluxo no Supabase.</b>
    Abra o Supabase › SQL Editor e rode o arquivo <code>sql/fluxo-financeiro.sql</code> do projeto. Ele só adiciona tabelas — nada existente é alterado. Depois toque em atualizar.</div>`;
  if (ST.erroCarga) h += `<div class="aviso">Alguns dados não carregaram: ${esc(ST.erroCarga)}. Mostrando o que está salvo neste aparelho.</div>`;
  return h;
}
const pfTravada = () => UI.ent === 'PF' && !ST.pfLiberado;
const titulo = (t, sub) => `<div class="tela-t"><h2>${t}${info(sub)}</h2></div>`;

// ── SETUP ────────────────────────────────────────────────
function telaSetup() {
  const M = FX_MODELO;
  const n = e => M.contas.filter(c => c.entidade === e).length;
  return `<div class="card">
    <h2>Configurar a estrutura inicial${info('Vou criar a estrutura a partir da planilha da consultoria. Você pode editar tudo depois.')}</h2>
    <ul class="lista-setup">
      <li><b>${n('PF')}</b> contas e caixinhas PF (Inter PF, Semanada, Despesas fixas, Faxineira, Sazonais, Dívidas, cartão de apoio, Nubank/Itaú em desativação)</li>
      <li><b>${n('PJ')}</b> contas e caixinhas PJ (Inter PJ, Semanada, Assinaturas no cartão, Cursos e investimentos, Reposição, MEI, cartão, espécie)</li>
      <li><b>${M.itens.length}</b> itens no modelo de planejamento (pró-labore 01 e 15, semanadas, aportes e a composição das despesas fixas)</li>
      <li><b>${M.dividas.length}</b> dívidas da Tabulação, para você confirmar os saldos</li>
    </ul>
    <p><b>Nenhum saldo é criado.</b>${info('Depois você informa o saldo real de cada conta em Conferir com o banco.')}</p>
    <label class="fl">Primeiro mês do fluxo</label>
    <input class="fi" type="month" id="setup-mes" value="${UI.mes}">
    <label class="chk"><input type="checkbox" id="setup-zeradas" checked> Caixinhas começam zeradas${info('Se alguma já tiver dinheiro, desmarque e informe o saldo depois.')}</label>
    <button class="btn" onclick="acSetup()">Criar estrutura</button>
  </div>`;
}

function cartaoPFBloqueado() {
  return `<div class="card pf-lock">
    <div><b>PF protegida</b>${info('Entre com o seu usuário pessoal para ver a PF.')}</div>
    <button class="btn sec" onclick="abrirLoginPF()">Entrar</button></div>`;
}

// ══ HOJE ═════════════════════════════════════════════════
function telaInicio() {
  if (pfTravada()) return cartaoPFBloqueado() + linkOutraEnt();
  const P = painel();
  let h = '';
  if (!stPlano(UI.mes)) h += `<div class="aviso">Sem plano em ${nomeMes(UI.mes)}. <button class="lnk" onclick="go('plano')">Criar</button></div>`;
  return h + `<div class="cols">
    <div>${cartaoSemana(P)}${cartaoAcoes(P)}</div>
    <div>${cartaoComoEsta(P)}${cartaoDinheiro(P)}${linkOutraEnt()}</div>
  </div>`;
}

// 1º bloco: quanto ainda posso gastar (semanada da semana em foco)
function cartaoSemana(P) {
  const w = P.semana, cx = P.semanadas && P.semanadas.caixinha;
  if (!w) {
    const Q = P.quadro, livre = Q.atual ? Q.livre : P.resumo.disponivel;
    return `<section class="card hero">
      <div class="eyebrow">Livre para usar${info('Pode usar sem faltar para nada do mês, contando o que ainda vai entrar.')}</div>
      <div class="hero-v ${livre < 0 ? 'neg' : ''}">${brl(livre)}</div></section>`;
  }
  const passou = w.acima > FX.EPS;
  const nivel = passou ? 'erro' : (w.orcamento > 0 && w.gasto >= w.orcamento * 0.85 ? 'alerta' : 'ok');
  const quando = w.atual ? 'esta semana' : `semana ${w.semana.n}`;
  return `<section class="card hero hero-${nivel}">
    <div class="row"><div class="eyebrow">Semanada · ${quando} <span>${w.semana.label.replace(' a ', '–')}</span></div>
      <button class="lnk sm" onclick="abrirCaixinha('${cx.id}')">Semanas ›</button></div>
    <div class="hero-v ${passou ? 'neg' : ''}">${passou ? brl(w.acima) : brl(w.podeGastar)}</div>
    <div class="hero-s">${passou ? `<b class="neg">acima</b> do orçamento da semana` : w.atual ? 'ainda pode gastar nesta semana' : 'disponível nesta semana'}</div>
    ${barra(w.gasto, w.orcamento, nivel)}
    <div class="row sm hero-l"><span>Gasto <b>${brl(w.gasto)}</b> de ${brl(w.orcamento)}</span></div>
    <div class="acoes2"><button class="btn sec" onclick="formGasto('${UI.ent}','${cx.id}')">+ Gasto</button>
      <button class="btn sec" onclick="abrirCaixinha('${cx.id}')">Ver semanas</button></div>
  </section>`;
}

// 2º bloco: próximas ações (o que fazer, com o botão para registrar)
const GRUPO_ACAO = { atencao: 'Passou do orçamento', atrasado: 'Ficou para trás', hoje: 'Hoje', semana: 'Ainda esta semana',
  mes: 'Até o fim do mês', conferir: 'Conferir e organizar' };
const LIMITE_GRUPO = { atencao: 99, atrasado: 3, hoje: 99, semana: 4, mes: 3, conferir: 99 };
function cartaoAcoes(P) {
  const lista = P.acoes;
  const iAc = info('Nada é marcado como feito pela data: cada botão registra o que aconteceu de verdade.');
  if (!lista.length) return `<section class="card"><h3>Próximas ações${iAc}</h3><div class="ok-linha">✓ Nada pendente em ${nomeMes(UI.mes)}.</div></section>`;
  const grupos = {};
  lista.forEach(a => (grupos[a.grupo] = grupos[a.grupo] || []).push(a));
  let h = '';
  Object.keys(GRUPO_ACAO).forEach(g => {
    const arr = grupos[g];
    if (!arr) return;
    const k = 'ac-' + g, todos = UI.aberto[k], lim = LIMITE_GRUPO[g];
    const vis = todos ? arr : arr.slice(0, lim);
    const aps = g === 'atrasado' || g === 'hoje' ? arr.filter(a => a.tipo === 'item' && a.item.tipo === 'aporte') : [];
    h += `<div class="ac-g g-${g}">
      <div class="ac-gt"><span>${GRUPO_ACAO[g]} <span class="cnt">${arr.length}</span></span></div>
      ${vis.map(linhaAcao).join('')}
      ${arr.length > lim ? `<button class="lnk sm mais-l" onclick="UI.aberto['${k}']=!UI.aberto['${k}'];render()">${todos ? 'Mostrar menos' : `Ver mais ${arr.length - lim}`}</button>` : ''}
      ${aps.length > 1 ? `<button class="btn sec lote" onclick="acComoPlanejado(${esc(JSON.stringify(aps.map(a => a.item.id)))})">Fiz as ${aps.length} reservas como planejado · ${brlc(aps.reduce((t, a) => t + a.valor, 0))}</button>` : ''}
    </div>`;
  });
  const agora = lista.filter(a => ['atencao', 'atrasado', 'hoje'].includes(a.grupo)).length;
  return `<section class="card acoes"><div class="row"><h3>Próximas ações${iAc}</h3>${agora ? `<span class="cnt alerta">${agora} para agora</span>` : ''}</div>${h}</section>`;
}
function linhaAcao(a) {
  if (a.tipo === 'item') {
    const i = a.item, cx = i.caixinhaId ? stConta(i.caixinhaId) : null;
    const pf = UI.ent === 'PF';
    const verbo = { aporte: 'Guardar', pagamento: 'Pagar', prolabore: pf ? 'Recebi' : 'Transferir', receita: 'Recebi' }[i.tipo];
    const sub = i.tipo === 'aporte' ? `guardar em ${cx ? cx.nome : 'caixinha'}`
      : i.tipo === 'pagamento' ? (cx ? `pagar com a reserva de ${cx.nome}` : 'pagar direto da conta')
      : i.tipo === 'prolabore' ? (pf ? 'receber da empresa' : 'transferir para a sua conta pessoal') : 'receber';
    return linhaA({ nivel: a.nivel, data: dm(i._data), titulo: FX.nomeItem(i), valor: a.valor,
      sub: sub + (i._realizado > 0 ? ` · ${brl(i._realizado)} já feito` : ''), botao: verbo, acao: `formExecutar('${i.id}')`, abrir: `formItem('${i.id}')` });
  }
  if (a.tipo === 'semanada') return linhaA({ nivel: 'erro', titulo: `Semanada — semana ${a.semana.semana.n}`, valor: a.valor, valorTxt: '+' + brl(a.valor),
    sub: `gasto ${brl(a.semana.gasto)} de ${brl(a.semana.orcamento)}`, botao: 'Ver', acao: `abrirCaixinha('${painel().semanadas.caixinha.id}')` });
  if (a.tipo === 'caixinha') return linhaA({ nivel: 'erro', titulo: a.caixinha.nome, valor: a.valor, valorTxt: '+' + brl(a.valor),
    sub: a.metas.anual ? `usado no ano ${brl(a.metas.anual.usado)} · meta do ano ${brl(a.metas.anual.metaAnual)}`
      : `usado ${brl(a.metas.usado)} · planejado ${brl(Math.max(a.metas.meta, a.metas.usoPrevisto))}`, botao: 'Ver', acao: `abrirCaixinha('${a.caixinha.id}')` });
  if (a.tipo === 'clientes') return linhaA({ nivel: 'alerta', data: dm(a.data), titulo: `${a.qtd} recebimento${a.qtd > 1 ? 's' : ''} de cliente sem confirmar`,
    valor: a.valor, sub: 'a data passou e ainda está como previsto', botao: 'Conferir', acao: `go('conciliar')` });
  if (a.tipo === 'conferir') return linhaA({ nivel: 'neutro', titulo: `${a.qtd} conta${a.qtd > 1 ? 's' : ''} sem saldo conferido`,
    sub: a.contas.slice(0, 3).map(c => c.nome).join(', ') + (a.qtd > 3 ? '…' : ''), botao: 'Conferir', acao: `go('conciliar')` });
  if (a.tipo === 'classificar') return linhaA({ nivel: 'neutro', titulo: `${a.qtd} saída${a.qtd > 1 ? 's' : ''} sem categoria`, valor: a.valor,
    sub: 'escolha a categoria', botao: 'Organizar', acao: `go('conciliar')` });
  return '';
}
function linhaA(o) {
  return `<div class="ac nv-${o.nivel}">
    <div class="ac-d">${o.data || ''}</div>
    <div class="ac-m" ${o.abrir ? `onclick="${o.abrir}"` : ''}><div class="ac-t">${esc(o.titulo)}</div><div class="ac-s">${esc(o.sub || '')}</div></div>
    <div class="ac-r">${o.valor ? `<b>${o.valorTxt || brl(o.valor)}</b>` : ''}<button class="btn mini ${o.nivel === 'neutro' ? 'sec' : ''}" onclick="${o.acao}">${o.botao}</button></div>
  </div>`;
}

// 3º bloco: como está o mês (receber → distribuir → gastar)
function cartaoComoEsta(P) {
  const pf = P.entidade === 'PF';
  let h = `<section class="card"><h3>Como está ${nomeMes(UI.mes).split(' ')[0].toLowerCase()}</h3>`;
  h += progresso({ rotulo: pf ? 'Receber · pró-labore e entradas' : 'Receber · clientes', feito: P.receber.recebido, total: P.receber.previsto,
    modo: 'meta', verbo: 'recebido',
    extra: [pf && P.receber.foraDoPlano > FX.EPS ? `<span class="muted">+ ${brl(P.receber.foraDoPlano)} fora do plano</span>` : '',
      !pf && P.receber.vencido > FX.EPS ? `<span class="t-alerta">${brl(P.receber.vencido)} vencido sem confirmar</span>` : ''].join(''),
    chave: 'pg-rec', rotDetalhe: 'Ver recebimentos',
    detalhe: pf && P.receber.itens.length ? P.receber.itens.map(x => miniLinha(FX.nomeItem(x.item) + ' · dia ' + dm(x.item._data),
      x.recebido, x.previsto, x.falta > FX.EPS ? `falta ${brl(x.falta)}` : '✓', x.falta > FX.EPS ? 'alerta' : 'ok')).join('') : '' });
  if (!pf) h += progresso({ rotulo: 'Pró-labore · para a sua conta pessoal', feito: P.prolabore.pago, total: P.prolabore.previsto,
    modo: 'meta', verbo: 'transferido', chave: 'pg-pro', rotDetalhe: 'Ver parcelas',
    detalhe: P.prolabore.itens.map(i => miniLinha(FX.nomeItem(i) + ' · dia ' + dm(i._data), Math.min(i._realizado, i.valor), i.valor,
      i._falta > FX.EPS ? `falta ${brl(i._falta)}` : '✓', i._falta > FX.EPS ? 'alerta' : 'ok')).join('') });
  h += progresso({ rotulo: 'Juntar nas caixinhas', feito: P.reservar.transferido, total: P.reservar.meta, modo: 'meta',
    verbo: 'destinado', chave: 'pg-res', rotDetalhe: 'Ver por caixinha',
    detalhe: P.reservar.caixinhas.map(c => miniLinha(c.caixinha.nome, Math.min(c.destinado, c.meta), c.meta,
      c.falta > FX.EPS ? `falta ${brl(c.falta)}` : '✓', c.falta > FX.EPS ? 'alerta' : 'ok', `abrirCaixinha('${c.caixinha.id}')`)).join('') });
  h += progresso({ rotulo: 'Gastar · gastos do mês', feito: P.gastar.gasto, total: P.gastar.planejado, modo: 'limite', verbo: 'gasto',
    extra: P.gastar.foraDoPlano > FX.EPS ? `<span class="muted">${brl(P.gastar.foraDoPlano)} direto da conta${info('Saídas sem caixinha e sem conta do plano (ex.: equipe).')}</span>` : '' });
  return h + `</section>`;
}
function miniLinha(rot, feito, total, st, nivel, acao) {
  return `<div class="mini-l" ${acao ? `onclick="${acao}"` : ''}><span>${esc(rot)}</span><span class="muted">${brlc(feito)} / ${brlc(total)}</span><b class="t-${nivel}">${st}</b></div>`;
}

// 4º bloco: dinheiro agora (saldo real — depende de saldo conferido)
// Mesmos números do Plano (FX.quadroMes): na conta · nas caixinhas · livre
function cartaoDinheiro(P) {
  const r = P.resumo, Q = P.quadro, nc = r.naoConferidas.length;
  const livre = Q.atual ? Q.livre : r.disponivel;
  return `<section class="card">
    <div class="row"><h3>Dinheiro agora</h3>${nc ? `<button class="tag-btn alerta" onclick="go('conciliar')">${nc} sem saldo conferido ›</button>` : '<span class="t-ok sm">✓ saldos conferidos</span>'}</div>
    <div class="grid3"><div><span>Na conta</span><b>${brl(r.saldoBancario)}</b></div>
      <div><span>Nas caixinhas</span><b>${brl(r.reservado)}</b></div>
      <div><span>Livre${info('Pode usar sem faltar para nada do mês, contando o que ainda vai entrar.')}</span><b class="${livre > 0.01 ? 't-ok' : ''}">${brl(livre)}</b></div></div>
    ${Q.atual && Q.falta ? `<div class="t-erro sm" style="margin-top:6px">Faltam ${brl(Q.falta.valor)} a partir de ${dm(Q.falta.data)} <button class="lnk sm" onclick="go('plano')">Ver no Plano ›</button></div>` : ''}
  </section>`;
}
function linkOutraEnt() {
  const o = UI.ent === 'PF' ? 'PJ' : 'PF';
  if (o === 'PF' && !ST.pfLiberado) return '';
  const n = painel(o).acoes.filter(a => ['atencao', 'atrasado', 'hoje'].includes(a.grupo)).length;
  return `<button class="outra" onclick="setEnt('${o}')"><span>${o === 'PF' ? 'Pessoal (PF)' : 'Empresa (PJ)'}</span>
    <span class="${n ? 't-alerta' : 'muted'}">${n ? n + ' para agora' : 'nada urgente'} ›</span></button>`;
}

// ══ PLANO ════════════════════════════════════════════════
function linhaItem(i, comEnt) {
  const cx = i.caixinhaId ? stConta(i.caixinhaId) : null;
  const vivo = FX.PENDENTE(i._status);
  const sub = [comEnt ? i.entidade : '', TIPO_LABEL[i.tipo], cx ? cx.nome : (i.tipo === 'pagamento' ? 'direto da conta' : ''),
    i._realizado > 0 && vivo ? `${brl(i._realizado)} feito` : ''].filter(Boolean).join(' · ');
  return `<div class="it st-${i._status}">
    <div class="it-d">${dm(i._data)}<small>S${i._semana || ''}</small></div>
    <div class="it-m" onclick="formItem('${i.id}')"><div class="it-t">${esc(FX.nomeItem(i))}</div><div class="it-s">${esc(sub)}</div></div>
    <div class="it-r"><b>${brl(i.valor)}</b>${chip(i._status, i.tipo)}
      ${vivo ? `<button class="btn mini" onclick="formExecutar('${i.id}')">${ACAO_LABEL[i.tipo]}</button>` : ''}</div>
  </div>`;
}

function telaPlano() {
  if (UI.modelo) return telaModelo();
  const ent = UI.ent;
  const plano = stPlano(UI.mes);
  let h = titulo('Plano do mês', 'Quanto você tem, quanto já tem destino, para onde vai e se o mês fecha.\nUsa o plano e o que foi registrado: funciona antes e depois de importar o extrato.\nCada item só fica ✓ quando você registra o que aconteceu.');
  if (!plano) {
    const temAnt = ST.itens.some(i => i.mes === FX.addMes(UI.mes, -1));
    return h + `<div class="card"><h3>${nomeMes(UI.mes)} sem plano${info('O mês é criado como cópia: alterar depois não muda outros meses nem o que já aconteceu.')}</h3>
      <button class="btn" onclick="acCriarMes('modelo')">Criar a partir do modelo</button>
      ${temAnt ? `<button class="btn sec" onclick="acCriarMes('anterior')">Copiar de ${nomeMes(FX.addMes(UI.mes, -1))}</button>` : ''}
      <button class="lnk" onclick="UI.modelo=true;render()">Ver / editar o modelo</button></div>`;
  }
  if (pfTravada()) return h + cartaoPFBloqueado();
  const ctx = stCtx(UI.mes);
  const Q = painel().quadro;
  const todos = FX.itensDoMes(ST.itens, UI.mes, ctx.movs, ctx.hoje, ctx.cfg);
  const im = todos.filter(i => i.entidade === ent || (ent === 'PF' && i.tipo === 'prolabore'));
  const fechado = plano.status === 'fechado';
  const avisos = FX.checarPlano(todos.filter(i => i.entidade === ent || i.tipo === 'prolabore'), ST.contas.filter(c => c.entidade === ent));
  if (avisos.length) h += `<div class="aviso">${avisos.map(a => esc(a.msg)).join('<br>')}</div>`;

  // Ordem = as perguntas: 1-2 quanto tenho e quanto já tem destino ·
  // 5 o mês fecha? · ponte PJ→PF · 3-4 para onde vai e o que entra/sai
  h += Q.atual ? `<div class="cols">
      <div>${cartaoTenho(Q)}${cartaoFecha(Q)}${cartaoPonte(Q)}</div>
      <div>${cartaoCaminho(Q)}${cartaoItens(im, fechado, plano)}</div>
    </div>`
    : `<div class="cols"><div>${cartaoPlanejado(Q)}${cartaoPonte(Q)}</div><div>${cartaoItens(im, fechado, plano, true)}</div></div>`;
  return h;
}

// Cores do Plano (só com função): grafite = saldo · âmbar = comprometido ·
// verde = livre / fecha · azul = vai entrar · vermelho = falta dinheiro.

// 1-2. Quanto tenho hoje e quanto disso já tem destino
function cartaoTenho(Q) {
  const pc = Q.principal;
  const pLivre = Q.naConta > 0 ? Math.round(Q.livre / Q.naConta * 100) : 0;
  // última conferência com o banco (não só o saldo de abertura)
  const ult = pc && ST.conciliacoes.filter(x => x.contaId === pc.id)
    .sort((a, b) => b.data.localeCompare(a.data) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')))[0];
  const quando = ult && ult.data > (Q.conferidoEm || '') ? ult.data : Q.conferidoEm;
  const dif = ult && ult.data === quando && ult.tipo === 'conferencia' ? Number(ult.diferenca) || 0 : 0;
  const tag = pc ? (Q.conferido
    ? `<button class="tag-btn ${Math.abs(dif) > 0.004 ? 'alerta' : ''}" onclick="formConciliar('${pc.id}')">${Math.abs(dif) > 0.004 ? `diferença ${brl(dif)}` : `conferido ${quando === stHoje() ? 'hoje' : dm(quando)}`}</button>`
    : `<button class="tag-btn alerta" onclick="formConciliar('${pc.id}')">conferir com o banco</button>`) : '';
  return `<section class="card q-tenho">
    <div class="row"><span class="eyebrow">Na conta hoje${info('Saldo da conta ' + (pc ? pc.nome : '') + ': último saldo conferido com o banco + o que foi registrado depois.\nToque em "conferido" para comparar com o app do banco e ver a diferença.')}</span>${tag}</div>
    <div class="hero-v ${Q.naConta < 0 ? 'neg' : ''}">${brl(Q.naConta)}</div>
    ${Q.naConta > 0 ? `<div class="q-bar" role="img" aria-label="Comprometido e livre"><i class="q-comp" style="width:${100 - pLivre}%"></i><i class="q-livre" style="width:${pLivre}%"></i></div>` : ''}
    <div class="q-leg">
      <span><i class="dot comp"></i>Comprometido${info('Já tem destino neste mês: contas, caixinhas, semanada' + (Q.entidade === 'PJ' ? ' e pró-labore' : '') + ' que vencem antes de entrar mais dinheiro.')}<b>${brl(Q.comprometido)}</b></span>
      <span><i class="dot livre"></i>Livre${info('Pode usar sem faltar para nada do mês, contando o que ainda vai entrar.')}<b class="t-ok">${brl(Q.livre)}</b></span>
    </div>
    <button class="q-cx" onclick="go('caixinhas')"><span>Guardado nas caixinhas</span>
      <span>${Q.caixinhasNegativas.length ? `<span class="t-erro xs">${Q.caixinhasNegativas.length} negativa${Q.caixinhasNegativas.length > 1 ? 's' : ''}</span> ` : ''}<b>${brl(Q.caixinhas)}</b> ›</span></button>
  </section>`;
}

// 5. O mês fecha? (hoje + entra − sai = fim do mês)
function cartaoFecha(Q) {
  const pro = Q.proSemDinheiro > 0.01;
  return `<section class="card q-fecha">
    <h3>Até o fim do mês${info('Hoje + o que ainda vai entrar − o que ainda vai sair, pelo plano e pelo que já foi registrado.\nImportar o extrato só deixa os números mais certos.')}</h3>
    <div class="q-conta">
      <div><span>Na conta hoje</span><b>${brl(Q.naConta)}</b></div>
      <div><span>Vai entrar</span><b class="q-in">${brl(Q.entra, true)}</b></div>
      <div><span>Vai sair</span><b>${brl(-Q.sai, true)}</b></div>
      <div class="tot"><span>Fim do mês</span><b class="${Q.fimMes < 0 ? 'neg' : 't-ok'}">${brl(Q.fimMes)}</b></div>
    </div>
    ${Q.falta ? `<div class="q-st erro"><span><b>Faltam ${brl(Q.falta.valor)}</b> a partir de ${Q.falta.data === stHoje() ? 'hoje' : dm(Q.falta.data)}</span>${info('Para fechar o plano: receber ou transferir esse valor até essa data, ou reprogramar/dispensar algum item (toque nele na lista).')}</div>`
      : `<div class="q-st ok">✓ O plano do mês fecha</div>`}
    ${pro ? `<div class="q-st alerta"><span>${brl(Q.proSemDinheiro)} do pró-labore sem dinheiro na PJ</span>${info('Não entram na conta acima: a PJ não tem esse valor nem com os clientes previstos no mês.')}</div>` : ''}
  </section>`;
}

// Pró-labore: ponte PJ → PF (aparece nas duas)
function cartaoPonte(Q) {
  const p = Q.ponte;
  if (!p || p.previsto <= 0.01) return '';
  const pf = Q.entidade === 'PF', completo = p.falta <= 0.01;
  const detalhe = p.naContaPJ != null && !completo;
  return `<section class="card q-ponte">
    <div class="row"><h3>Pró-labore${info(pf ? 'O que a empresa transfere para você no mês.' : 'O que vai da conta PJ para a sua conta pessoal no mês.')}</h3>
      <span class="sm ${completo ? 't-ok' : 'muted'}">${completo ? '✓ completo' : `falta ${brl(p.falta)}`}</span></div>
    <div class="pg-v"><b>${brl(p.transferido)}</b><span> ${pf ? 'recebido' : 'transferido'} de ${brl(p.previsto)}</span></div>
    ${barra(p.transferido, p.previsto, completo ? 'ok' : 'andamento')}
    ${detalhe ? `<div class="q-ponte-l">
      <div class="kv"><span>Dá para transferir hoje${info('O que está na conta PJ hoje, depois das contas da PJ que vencem antes (ordem do plano).')}</span><b class="${p.podeHoje > 0.01 ? 't-ok' : ''}">${brl(p.podeHoje)}</b></div>
      <div class="kv"><span>Com os clientes previstos${info('Na PJ hoje: ' + brl(p.naContaPJ) + '\nClientes previstos no mês: ' + brl(p.aReceberPJ) + '\nRepartido na ordem do plano (contas, pró-labore, caixinhas, semanada).')}</span><b>${brl(p.podeNoMes)}</b></div>
      ${p.semDinheiro > 0.01 ? `<div class="kv neg"><span>Sem dinheiro na PJ</span><b>${brl(p.semDinheiro)}</b></div>` : ''}
    </div>` : ''}
    ${!completo && p.proximo && p.podeHoje > 0.01 ? `<button class="btn sec" onclick="formExecutar('${p.proximo.id}')">${pf ? 'Registrar o que recebi' : 'Transferir para o pessoal'}</button>` : ''}
  </section>`;
}

// 3-4. Para onde vai o dinheiro: linha do tempo até o fim do mês
const COB = { agora: ['✓', 'a conta já cobre'], depois: ['◷', 'cobre quando entrar o previsto'], falta: ['!', 'falta dinheiro'] };
function cartaoCaminho(Q) {
  const ev = Q.eventos || [];
  const k = 'q-ev', todos = UI.aberto[k], lim = 6;
  const vis = todos ? ev : ev.slice(0, lim);
  return `<section class="card q-cam">
    <h3>Para onde vai o dinheiro${info('Tudo o que ainda entra e sai neste mês, na ordem das datas (atrasado conta como hoje).\n✓ a conta já cobre\n◷ cobre quando entrar o previsto\n! falta dinheiro\nNada é marcado como feito sozinho: o botão registra o que aconteceu.')}</h3>
    ${ev.length ? vis.map(linhaEvento).join('') : `<div class="ok-linha">✓ Nada mais para entrar ou sair em ${nomeMes(UI.mes).split(' ')[0].toLowerCase()}.</div>`}
    ${ev.length > lim ? `<button class="lnk sm mais-l" onclick="UI.aberto['${k}']=!UI.aberto['${k}'];render()">${todos ? 'Mostrar menos' : `Ver o mês todo · mais ${ev.length - lim}`}</button>` : ''}
  </section>`;
}
function linhaEvento(e) {
  const entra = e.lado === 'entra', hoje = stHoje();
  const atras = e.venc && e.venc < hoje ? `venceu ${dm(e.venc)}` : '';
  let sub = '', botao = '', abrir = '';
  const it = e.item;
  if (entra) {
    sub = e.tipo === 'cliente' ? [e.sub, atras].filter(Boolean).join(' · ') : e.tipo === 'prolabore' ? 'da empresa' : 'receber';
    if (e.tipo === 'cliente') botao = `<button class="btn mini sec" onclick="formReceberCliente('${e.mov.id}')">Recebi</button>`;
    else if (it) { botao = `<button class="btn mini sec" onclick="formExecutar('${it.id}')">Recebi</button>`; abrir = `formItem('${it.id}')`; }
  } else {
    const cx = e.caixinha;
    sub = e.tipo === 'aporte' ? `guardar em ${cx ? cx.nome : 'caixinha'}`
      : e.tipo === 'prolabore' ? 'para o pessoal'
      : e.tipo === 'semanada' ? 'para gastar na semana'
      : e.tipo === 'caixinha' ? 'contas do mês'
      : e.tipo === 'fatura' ? 'sem reserva no cartão'
      : e.tipo === 'previsto' ? 'previsto no Financeiro' : 'pagar';
    if (e.coberto > 0.01) sub += ` · ${brl(e.coberto)} já na caixinha`;
    if (atras) sub += ' · ' + atras;
    if (e.tipo === 'semanada' || e.tipo === 'caixinha') { botao = `<button class="btn mini sec" onclick="abrirCaixinha('${cx.id}')">Ver</button>`; }
    else if (it) { botao = `<button class="btn mini" onclick="formExecutar('${it.id}')">${ACAO_LABEL[it.tipo] === 'Pagar' && it.tipo === 'prolabore' ? 'Transferir' : ACAO_LABEL[it.tipo]}</button>`; abrir = `formItem('${it.id}')`; }
  }
  const c = !entra && COB[e.cobertura];
  return `<div class="q-ev ${entra ? 'ev-in' : 'ev-out cob-' + e.cobertura}">
    <div class="q-d">${e.data === hoje ? 'hoje' : dm(e.data)}</div>
    <div class="q-m" ${abrir ? `onclick="${abrir}"` : ''}><div class="q-t">${c ? `<span class="q-ic" title="${c[1]}">${c[0]}</span>` : '<span class="q-ic">+</span>'}${esc(e.titulo)}</div><div class="q-s">${esc(sub)}</div></div>
    <div class="q-r"><b>${brl(entra ? e.valor : -e.valor, true)}</b>${botao}</div>
  </div>`;
}

// Mês que não é o atual: só o planejado (sem saldo de hoje)
function cartaoPlanejado(Q) {
  return `<section class="card q-fecha">
    <h3>Planejado em ${nomeMes(UI.mes).split(' ')[0].toLowerCase()}${info('Mês que não é o atual: mostra só o plano.' + (Q.entidade === 'PJ' ? '\nEntra = recebimentos de clientes do mês.' : ''))}</h3>
    <div class="q-conta">
      <div><span>Entra</span><b class="q-in">${brl(Q.planejado.entra, true)}</b></div>
      <div><span>Sai</span><b>${brl(-Q.planejado.sai, true)}</b></div>
      <div class="tot"><span>Sobra</span><b class="${Q.planejado.sobra < 0 ? 'neg' : 't-ok'}">${brl(Q.planejado.sobra)}</b></div>
    </div></section>`;
}

// Todos os itens do plano (editar, dispensar, reprogramar) — recolhido
function cartaoItens(im, fechado, plano, aberto) {
  const feitos = im.filter(i => !FX.PENDENTE(i._status)).length;
  const k = 'q-itens', open = UI.aberto[k] != null ? UI.aberto[k] : !!aberto;
  return `<details class="card q-itens" ${open ? 'open' : ''} ontoggle="UI.aberto['${k}']=this.open">
    <summary><span>Itens do plano</span><span class="muted sm">${feitos} de ${im.length} feitos</span></summary>
    <div class="lista">${im.map(i => linhaItem(i)).join('') || vazio('Sem itens.')}</div>
    <div class="toolbar q-tb"><span class="muted sm">${fechado ? '🔒 Mês fechado' : 'Origem: ' + (plano.origem === 'modelo' ? 'modelo' : nomeMes(plano.origem || UI.mes))}</span>
      <span>${fechado ? `<button class="lnk" onclick="acFechar(false)">Reabrir</button>`
        : `<button class="lnk" onclick="formItem(null)">+ Item</button><button class="lnk" onclick="acFechar(true)">Fechar mês</button>`}
        <button class="lnk" onclick="UI.modelo=true;render()">Modelo</button></span></div>
  </details>`;
}

function telaModelo() {
  const its = ST.itens.filter(i => i.mes === 'modelo').sort((a, b) => a.dia - b.dia || (a.ordem || 0) - (b.ordem || 0));
  const bloco = ent => {
    const l = its.filter(i => i.entidade === ent);
    return `<div class="sec-t">${ent === 'PF' ? 'Pessoal' : 'Empresa'} · ${brl(l.filter(FX.consomeConta).reduce((t, i) => t + Number(i.valor), 0))} saindo da conta</div>
    <div class="card lista">${l.map(i => `<div class="it" onclick="formItem('${i.id}')">
      <div class="it-d">dia<small>${i.dia}</small></div>
      <div class="it-m"><div class="it-t">${esc(FX.nomeItem(i))}</div><div class="it-s">${TIPO_LABEL[i.tipo]}${i.caixinhaId ? ' · ' + esc(nomeConta(i.caixinhaId)) : ''}${i.mesInicio || i.mesFim ? ' · ' + (i.mesInicio ? nomeMesC(i.mesInicio) : '…') + ' → ' + (i.mesFim ? nomeMesC(i.mesFim) : '…') : ''}</div></div>
      <div class="it-r"><b>${brl(i.valor)}</b></div></div>`).join('') || vazio('Sem itens')}</div>`;
  };
  return `<div class="aviso">Editando o <b>modelo</b>${info('Ele só é usado ao criar meses novos — não altera meses já criados.')}</div>
    <div class="toolbar"><button class="lnk" onclick="UI.modelo=false;render()">‹ Voltar ao mês</button><button class="lnk" onclick="formItem(null)">+ Item no modelo</button></div>
    ${bloco('PJ')}${ST.pfLiberado ? bloco('PF') : cartaoPFBloqueado()}`;
}

// ══ CAIXINHAS ════════════════════════════════════════════
const FINALIDADE_LABEL = { semanada: 'pagar as despesas variáveis da semana (o que sobrar, você guarda)', fixas: 'contas fixas do mês', faxineira: 'faxina',
  sazonais: 'gastos do ano, guardados todo mês', dividas: 'parcelas de dívidas', cartao: 'assinaturas e fatura do cartão',
  cursos: 'cursos e investimentos', reposicao: 'reposição de material', mei: 'imposto (DAS)', reserva: 'aplicações fora do plano' };
function telaCaixinhas() {
  if (pfTravada()) return cartaoPFBloqueado();
  const P = painel();
  const cxs = P.caixinhas.slice().sort((a, b) => (a.caixinha.finalidade === 'semanada' ? -1 : 0) - (b.caixinha.finalidade === 'semanada' ? -1 : 0)
    || (a.caixinha.finalidade === 'reserva' ? 1 : 0) - (b.caixinha.finalidade === 'reserva' ? 1 : 0) || b.meta - a.meta);
  // Resumo só das caixinhas de guardar (semanada = gastar; fixas = pagar contas)
  const g = cxs.filter(c => modoCaixinha(c.caixinha) === 'guardar' && c.meta > 0);
  const meta = g.reduce((t, c) => t + c.meta, 0), guardado = g.reduce((t, c) => t + Math.min(c.destinado, c.meta), 0);
  const falta = Math.max(0, meta - guardado);
  let h = titulo('Caixinhas', 'Cada caixinha é um orçamento: o gasto pertence a ela pela categoria, mesmo saindo direto da conta.\n\nSemanada: quanto ainda pode gastar na semana.\nContas (fixas, faxineira, MEI…): quanto falta pagar no mês. Pagar direto da conta não deixa nada devendo para a caixinha.\nJuntar (sazonais, cursos, reposição…): quanto falta destinar. Destinado = guardado na caixinha + gasto direto da conta nas categorias dela.\n\nNa caixinha = dinheiro separado nela de verdade (opcional).');
  if (g.length) h += `<div class="card"><div class="grid3">
      <div><span>Juntar no mês</span><b>${brlc(meta)}</b></div>
      <div><span>Destinado</span><b>${brlc(guardado)}</b></div>
      <div><span>Falta guardar</span><b class="${falta > 0.01 ? 't-alerta' : 't-ok'}">${falta > 0.01 ? brlc(falta) : '✓'}</b></div></div>
    ${barra(guardado, meta, falta > 0.01 ? 'andamento' : 'ok')}</div>`;
  h += cxs.length ? `<div class="cx-grid">${cxs.map(c => cartaoCaixinha(c, P)).join('')}</div>` : vazio('Nenhuma caixinha cadastrada (Ajustes › Contas e caixinhas).');
  return h;
}
// Cada caixinha responde uma pergunta:
//   semanada → quanto ainda posso gastar esta semana (não é para guardar)
//   fixas    → quanto falta pagar das contas do mês (o dinheiro pode sair direto da conta)
//   demais   → quanto falta guardar no mês
const modoCaixinha = cx => FX.modoCaixinha(cx);
const destaque = (valor, rotulo, cls) => `<div class="cx-v ${cls || ''}">${valor}</div><div class="muted xs">${rotulo}</div>`;
function cartaoCaixinha(c, P) {
  const cx = c.caixinha, modo = modoCaixinha(cx), sem = modo === 'semana';
  const aberto = UI.aberto[cx.id] != null ? UI.aberto[cx.id] : sem;
  const ano = c.anual;
  // Na caixinha = dinheiro separado de verdade (opcional: pagar/usar direto da conta também vale)
  const saldoHoje = `<div><span>Na caixinha${info('Dinheiro separado nela de verdade hoje. É opcional: o que você paga ou usa direto da conta também conta para esta caixinha.')}${c.conferido ? '' : ' <i class="t-alerta" title="não conferido com o banco">*</i>'}</span><b class="${c.saldoAtual < -0.01 ? 't-erro' : ''}">${brlc(c.saldoAtual)}</b></div>`;
  const deOnde = c.usado > 0.01 ? `<div class="muted xs cx-orig">${c.usadoDireto > 0.01 ? `${brlc(c.usadoDireto)} direto da conta` : ''}${c.usadoDireto > 0.01 && c.usadoDaCaixinha > 0.01 ? ' · ' : ''}${c.usadoDaCaixinha > 0.01 ? `${brlc(c.usadoDaCaixinha)} com o dinheiro da caixinha` : ''}</div>` : '';
  let topo, corpo, botao = '', erro = false;
  if (modo === 'semana') {
    const S = cx.entidade === P.entidade ? P.semanadas : FX.semanadas(cx.entidade, stCtx(UI.mes));
    const linhas = S ? S.linhas : [];
    const orc = FX.r2(linhas.reduce((t, l) => t + l.orcamento, 0)), gasto = S ? S.gasto : c.usado;
    const atual = linhas.find(l => l.atual);
    erro = atual ? atual.estourou : gasto > orc + 0.01;
    topo = atual ? (atual.estourou ? destaque(brl(atual.acima), 'acima esta semana', 't-erro') : destaque(brl(atual.podeGastar), 'pode gastar esta semana', 't-ok'))
      : gasto > orc + 0.01 ? destaque(brl(gasto - orc), 'acima no mês', 't-erro') : destaque(brl(orc - gasto), 'sobrou no mês');
    corpo = `<div class="grid3 cx-n">
        <div><span>Orçamento</span><b>${brlc(orc)}</b></div>
        <div><span>Gasto</span><b class="${gasto > orc + 0.01 ? 't-erro' : ''}">${brlc(gasto)}</b></div>
        <div><span>${gasto > orc + 0.01 ? 'Acima' : 'Sobra'}</span><b>${brlc(Math.abs(orc - gasto))}</b></div></div>
      ${orc > 0 ? barra(gasto, orc, gasto > orc + 0.01 ? 'erro' : gasto >= orc * 0.85 ? 'alerta' : 'ok') : ''}
      ${blocoSemanas(P, cx)}`;
  } else if (modo === 'contas') {
    // contas do mês: pago parcial com o resto dispensado vale o que foi pago;
    // sem conta no plano (ex.: assinaturas no cartão), vale a meta × o usado
    const comp = FX.composicao(cx, stCtx(UI.mes)).filter(x => x.status !== 'reprogramado');
    const pendentes = comp.filter(x => FX.PENDENTE(x.status));
    const semItens = !comp.length;
    const total = FX.r2(semItens ? c.meta : comp.reduce((t, x) => t + (x.status === 'dispensado' ? x.pago : x.previsto), 0));
    const pago = FX.r2(semItens ? c.usado : comp.reduce((t, x) => t + x.pago, 0));
    const falta = FX.r2(semItens ? Math.max(0, total - pago) : pendentes.reduce((t, x) => t + Math.max(0, x.previsto - x.pago), 0));
    const prox = pendentes.slice().sort((a, b) => (a.vencimento < b.vencimento ? -1 : 1))[0];
    topo = falta > 0.01 ? destaque(brl(falta), 'falta pagar', 't-alerta') : total > 0 ? destaque('✓', 'contas do mês pagas', 't-ok') : destaque(brl(c.saldoAtual), 'na caixinha');
    corpo = `<div class="grid4 cx-n">
        <div><span>Contas do mês</span><b>${brlc(total)}</b></div>
        <div><span>Pago${info('Pago de qualquer jeito: direto da conta ou com o dinheiro da caixinha. Pagar direto da conta não deixa nada devendo para a caixinha.')}</span><b>${brlc(pago)}</b></div>
        <div><span>Falta pagar</span><b class="${falta > 0.01 ? 't-alerta' : ''}">${falta > 0.01 ? brlc(falta) : '✓'}</b></div>
        ${saldoHoje}</div>
      ${total > 0 ? barra(pago, total, falta > 0.01 ? 'andamento' : 'ok') : ''}${deOnde}
      ${prox ? `<div class="muted xs">Próxima: <b>${esc(prox.descricao)}</b> · ${dm(prox.vencimento)} · ${brlc(prox.previsto - prox.pago)}</div>` : ''}`;
    if (prox) botao = `<button class="btn mini" onclick="formExecutar('${prox.item.id}')">Pagar ${esc(prox.descricao)}</button>`;
  } else {
    const pend = P.acoes.filter(a => a.tipo === 'item' && a.item.tipo === 'aporte' && a.item.caixinhaId === cx.id);
    const reservar = pend.length ? `formExecutar('${pend[0].item.id}')` : `formTransferencia('${cx.entidade}', null, '${cx.id}')`;
    erro = c.estourou;
    topo = c.falta > 0.01 ? destaque(brl(c.falta), 'falta guardar', 't-alerta')
      : c.meta > 0 ? destaque('✓ ' + brl(c.destinado), 'destinado no mês', 't-ok') : destaque(brl(c.saldoAtual), 'na caixinha');
    corpo = `<div class="grid4 cx-n">
        <div><span>${ano ? 'Meta do mês' : 'Meta'}</span><b>${brlc(c.meta)}</b></div>
        <div><span>Destinado${info('Dinheiro do mês que já foi para esta finalidade:\nguardado na caixinha ' + brlc(c.transferido) + '\n+ gasto direto da conta nas categorias dela ' + brlc(c.usadoDireto) + '\n\nGastar direto da conta já conta: não precisa guardar de novo.')}</span><b>${brlc(c.destinado)}</b></div>
        <div><span>Usado</span><b class="${!ano && c.estourou ? 't-erro' : ''}">${brlc(c.usado)}</b></div>
        ${saldoHoje}</div>
      ${c.meta > 0 ? barra(c.destinado, c.meta, c.falta > 0.01 ? 'andamento' : 'ok') : ''}${deOnde}
      ${c.estourou && !ano ? `<div class="t-erro sm">Usou ${brl(c.acima)} além do planejado para esta caixinha.</div>` : ''}
      ${ano ? blocoAno(ano) : ''}`;
    if (c.falta > 0.01 || !c.meta) botao = `<button class="btn mini" onclick="${reservar}">Guardar${c.falta > 0.01 ? ' ' + brlc(pend.length ? pend[0].item._falta : c.falta) : ''}</button>`;
  }
  return `<section class="card cx ${erro ? 'cx-erro' : ''} ${ano ? 'cx-anual' : ''}" id="cx-${cx.id}">
    <div class="cx-h" onclick="toggleAberto('${cx.id}')">
      <div><h3>${esc(cx.nome)}${info(infoCaixinha(cx))}</h3></div>
      <div class="r">${topo}</div>
    </div>
    ${corpo}
    ${aberto ? detalheCaixinha(cx, c, ano) : ''}
    <div class="cx-b">
      ${botao}
      <button class="btn mini sec" onclick="formGasto('${cx.entidade}', '${cx.id}')">+ Gasto</button>
      <button class="btn mini sec" onclick="toggleAberto('${cx.id}')">${aberto ? 'Menos' : 'Detalhes'}</button>
    </div>
  </section>`;
}
// Caixinha anual (Sazonais, Cursos e investimentos): o ano ao lado do mês.
// A meta mensal é só o ritmo; há meses de guardar/usar mais, menos ou nada.
function blocoAno(a) {
  const cx = a.caixinha;
  const ritmo = Math.abs(a.ritmo) < 1 ? (a.planejadoAteAgora > 0 ? '<span class="pill ok">✓ em dia</span>' : '')
    : a.ritmo > 0 ? `<span class="pill ok">${brlc(a.ritmo)} adiantada</span>`
    : `<span class="pill alerta">${brlc(-a.ritmo)} atrás</span>`;
  const fechar = a.faltaGuardar <= 0.01 ? '<span class="pill ok">✓ meta guardada</span>'
    : a.mesesRestantes ? `<span class="pill">${brlc(a.sugestaoMes)}/mês p/ fechar</span>` : '';
  const txt = 'O valor do mês é só o ritmo: tem mês de guardar ou usar mais, menos ou nada. O que vale é o ano.'
    + '\n\nMédia: ' + brlc(a.mediaMes) + '/mês' + (Math.abs(a.somaMetas - a.metaAnual) >= 1 ? ' (o plano mês a mês soma ' + brlc(a.somaMetas) + ')' : '') + '.'
    + '\nDestinado: guardado na caixinha ' + brlc(a.guardado) + ' + gasto direto da conta nas categorias dela ' + brlc(a.usadoDireto) + '.'
    + '\nAdiantada / atrás: destinado × o que o plano previa até hoje (' + brlc(a.planejadoAteAgora) + ').'
    + (a.mesesRestantes ? '\nPara fechar: quanto destinar por mês nos ' + a.mesesRestantes + ' meses que faltam (contando este).' : '')
    + '\nPode usar: meta do ano − usado.';
  return `<div class="cx-ano" onclick="event.stopPropagation()">
    <div class="cx-ano-h"><b>No ano</b><span class="muted xs">${nomeMesC(a.ciclo.inicio)} → ${nomeMesC(a.ciclo.fim)}</span>${info(txt)}
      <button class="lnk sm" onclick="formMetaAnual('${cx.id}')">Ajustar meta</button></div>
    <div class="grid4">
      <div><span>Meta do ano</span><b>${brlc(a.metaAnual)}</b></div>
      <div><span>Destinado</span><b>${brlc(a.destinado)}</b></div>
      <div><span>Usado</span><b>${brlc(a.usado)}</b></div>
      <div><span>Pode usar</span><b class="${a.estourou ? 't-erro' : ''}">${brlc(a.restaGastar)}</b></div>
    </div>
    ${barra(a.destinado, a.metaAnual, a.faltaGuardar <= 0.01 ? 'ok' : 'andamento')}
    ${ritmo || fechar ? `<div class="pills">${ritmo}${fechar}</div>` : ''}
  </div>`;
}
function detalheAno(a) {
  const linhas = a.meses.filter(x => !x.antes).map(x => `
    <div class="ano-m ${x.atual ? 'atual' : ''} ${x.passado ? 'passado' : ''}">
      <span class="ano-mes">${nomeMesC(x.mes)}${x.atual ? ' ·' : ''}</span>
      <span><small>meta</small>${x.meta ? brlc(x.meta) : '—'}${x.fonte === 'modelo' ? '<i>*</i>' : ''}</span>
      <span><small>destinado</small>${x.destinado ? brlc(x.destinado) : x.passado || x.atual ? brlc(0) : '—'}</span>
      <span><small>usado</small>${x.usado ? brlc(x.usado) : x.passado || x.atual ? brlc(0) : '—'}</span>
    </div>`).join('');
  const temModelo = a.meses.some(x => x.fonte === 'modelo');
  let h = `<div class="sub-t">Mês a mês${temModelo ? info('* = mês ainda não criado: meta vinda do modelo. Para mudar a meta de um mês, edite no Plano daquele mês.') : ''}</div><div class="ano-lista">${linhas}</div>`;
  if (a.categorias.length) {
    const comOrc = a.categorias.some(c => c.anual);
    h += `<div class="sub-t">${comOrc ? 'Orçamento do ano por finalidade' : 'Usado no ano por categoria'}</div>${a.categorias.map(c => {
      const nv = c.anual && c.usado > c.anual ? 'erro' : c.anual && c.usado >= c.anual * 0.85 ? 'alerta' : 'ok';
      return `<div class="mini-l"><span>${esc(c.nome)}</span><span class="muted">${brlc(c.usado)}${c.anual ? ' / ' + brlc(c.anual) : ''}</span>
        <b class="t-${nv}">${c.anual ? (c.usado > c.anual ? brlc(c.usado - c.anual) + ' acima' : 'resta ' + brlc(c.anual - c.usado)) : ''}</b></div>`; }).join('')}
      ${a.caixinha.finalidade === 'sazonais' ? `<div class="cx-links"><button class="lnk sm" onclick="formConfig()">Editar orçamento por finalidade</button></div>` : ''}`;
  }
  return h;
}

// Semanada: semana a semana, com a atual em destaque
function blocoSemanas(P, cx) {
  const s = cx.entidade === P.entidade ? P.semanadas : FX.semanadas(cx.entidade, stCtx(UI.mes));
  if (!s) return '';
  return `<div class="semanas">${s.linhas.map(l => {
    const nivel = l.estourou ? 'erro' : l.orcamento > 0 && l.gasto >= l.orcamento * 0.85 ? 'alerta' : l.gasto > 0 ? 'ok' : 'neutro';
    return `<div class="sem ${l.atual ? 'atual' : ''} ${l.passada ? 'passada' : ''}" role="button" tabindex="0" aria-label="Detalhes da semana ${l.semana.n}"
      onclick="detalheSemana('${cx.entidade}', ${l.semana.n})" onkeydown="if(event.key==='Enter')detalheSemana('${cx.entidade}', ${l.semana.n})">
      <div class="sem-h"><b>S${l.semana.n}</b><span class="muted">${l.semana.label}${l.atual ? ' · esta semana' : ''}</span>
        <span class="sem-st t-${nivel}">${l.estourou ? brlc(l.acima) + ' acima' : l.gasto > 0 || l.atual || l.passada ? 'sobra ' + brlc(l.podeGastar) : 'previsto'}</span></div>
      <div class="sem-v"><span>gasto <b>${brlc(l.gasto)}</b> de ${brlc(l.orcamento)}</span></div>
      ${barra(l.gasto, l.orcamento, nivel)}
    </div>`; }).join('')}</div>`;
}
// Detalhes de uma semana (abre ao tocar na semana): categorias, atendimentos,
// gastos e reservas. Folha comum: só fecha no botão ou Esc.
function detalheSemana(ent, n) {
  const s = FX.semanadas(ent, stCtx(UI.mes));
  const l = s && s.linhas.find(x => x.semana.n === n);
  if (!l) return;
  const cx = s.caixinha;
  const cats = Object.entries(l.porCategoria).sort((a, b) => b[1] - a[1]);
  const lista = (arr, vazio, fn) => arr.length ? arr.map(fn).join('') : `<div class="muted sm">${vazio}</div>`;
  const gastos = l.gastos.slice().sort((a, b) => (a.data < b.data ? -1 : 1));
  abrirModal(`<h2>S${n} · ${l.semana.label}</h2>
    <div class="grid3 sem-g">
      <div><span>Orçamento</span><b>${brlc(l.orcamento)}</b></div>
      <div><span>Gasto</span><b>${brlc(l.gasto)}</b></div>
      <div><span>${l.estourou ? 'Acima' : 'Sobra'}</span><b class="t-${l.estourou ? 'erro' : 'ok'}">${brlc(l.estourou ? l.acima : l.podeGastar)}</b></div>
    </div>
    ${l.atendimentos ? `<div class="mini-l"><span>Atendimentos</span><span class="muted">${l.atendimentos}</span><b>${l.custoPorAtendimento ? brlc(l.custoPorAtendimento) + '/atend.' : ''}</b></div>` : ''}
    <div class="sub-t">Por categoria</div>
    ${lista(cats, 'Nenhum gasto nesta semana.', ([k, v]) => `<div class="mini-l"><span>${esc(k)}</span><span></span><b>${brlc(v)}</b></div>`)}
    ${gastos.length ? `<div class="sub-t">Gastos</div>${gastos.map(m => `<div class="mini-l lnk-l" onclick="formMov('${esc(m.key)}')"><span>${dm(m.data)} · ${esc(m.descricao || m.categoria)}</span><span></span><b>${brlc(m.valor)}</b></div>`).join('')}` : ''}
    ${l.reservas.length ? `<div class="sub-t">Na caixinha</div>${l.reservas.map(m => `<div class="mini-l lnk-l" onclick="formMov('${esc(m.key)}')"><span>${dm(m.data)} · ${esc(m.descricao || 'Transferência')}</span><span></span><b>${brlc(m.valor)}</b></div>`).join('')}` : ''}
    <button class="btn ghost" onclick="fecharModal()">Fechar</button>`);
}
function detalheCaixinha(cx, c, ano) {
  const ctx = stCtx(UI.mes);
  let h = '';
  const comp = FX.composicao(cx, ctx);
  if (comp.length) {
    h += `<div class="sub-t">Contas</div><div class="lista-c">${comp.map(x => `
      <div class="lc st-${x.status}">
        <div class="lc-m" onclick="formItem('${x.item.id}')"><div class="lc-t">${esc(x.descricao)}</div>
          <div class="lc-s">vence ${dm(x.vencimento)}${x.pago ? ` · pago ${brlc(x.pago)} em ${dm(x.dataPagamento)}` : ''}${x.diferenca && x.status !== 'dispensado' && !FX.PENDENTE(x.status) ? ` · <span class="${x.diferenca > 0 ? 't-erro' : 't-ok'}">${x.diferenca > 0 ? '+' : ''}${brlc(x.diferenca)}</span>` : ''}${FX.PENDENTE(x.status) && x.pago > 0.01 ? ` · <button class="lnk xs" onclick="event.stopPropagation();acSoIsso('${x.item.id}')">só isso este mês</button>` : ''}</div></div>
        <div class="lc-v">${brlc(x.previsto)}${chip(x.status, 'pagamento')}</div>
        ${FX.PENDENTE(x.status) ? `<button class="btn mini" onclick="formExecutar('${x.item.id}')">Pagar</button>` : '<span class="mini-sp">✓</span>'}
      </div>`).join('')}</div>`;
  }
  if (ano) h += detalheAno(ano);
  if (c.usos.length && cx.finalidade !== 'semanada') {
    h += `<div class="sub-t">Usado neste mês${info('Tudo o que pertence a esta caixinha no mês, pela categoria ou pela conta do plano — saindo dela ou direto da conta.')}</div>${c.usos.map(m => `<div class="mini-l" onclick="formMov('${esc(m.key)}')"><span>${dm(m.data)} · ${esc(m.descricao || m.categoria)}<small class="muted"> · ${esc(m.categoria)} · ${m.valorDireto > 0.01 && m.valorDaCaixinha > 0.01 ? 'parte da caixinha' : m.valorDaCaixinha > 0.01 ? 'da caixinha' : m.pagoPelaPJ ? 'pago pela PJ' : 'direto da conta'}</small></span><span></span><b>${brl(m.valor)}</b></div>`).join('')}`;
  }
  if (c.saldoInicio) h += `<div class="mini-l"><span>Sobrou de meses anteriores</span><span></span><b>${brl(c.saldoInicio)}</b></div>`;
  h += `<div class="cx-links"><button class="lnk sm" onclick="formConciliar('${cx.id}')">Conferir saldo com o banco</button>
    <button class="lnk sm" onclick="formTransferencia('${cx.entidade}', '${cx.id}')">Tirar dinheiro (resgate)</button></div>`;
  return h;
}

// ══ MOVIMENTOS ═══════════════════════════════════════════
function segMovs() {
  return `<div class="seg sub">${[['movs', 'Lançamentos'], ['conciliar', 'Conferir com o banco']].map(([k, l]) =>
    `<button class="${UI.tab === k ? 'on' : ''}" onclick="go('${k}')">${l}</button>`).join('')}</div>`;
}
function telaMovs() {
  let h = segMovs();
  if (pfTravada()) return h + cartaoPFBloqueado();
  const ent = UI.ent;
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
    <div><span>Saiu</span><b>${brl(sai$)}</b></div><div><span>Entre contas${info('Aportes, resgates e fatura do cartão são transferências — não contam como gasto.')}</span><b class="muted">${brl(tr$)}</b></div></div></div>
    <div class="chips">${[['todos', 'Todos'], ['saidas', 'Saídas'], ['entradas', 'Entradas'], ['transf', 'Transferências'],
      ['pendente', 'Previstos'], ['naoconc', 'Não conferidos']].map(([k, l]) =>
      `<button class="${f === k ? 'on' : ''}" onclick="UI.movFiltro='${k}';render()">${l}</button>`).join('')}</div>`;
  if (!filt.length) return h + `<div class="card">${vazio('Nada neste mês.')}</div>`;
  let dia = null, bloco = [];
  const blocos = [];
  filt.forEach(m => { if (m.data !== dia) { if (bloco.length) blocos.push([dia, bloco]); dia = m.data; bloco = []; } bloco.push(m); });
  if (bloco.length) blocos.push([dia, bloco]);
  return h + blocos.map(([d, arr]) => `<div class="dia-t">${d === stHoje() ? 'Hoje' : dm(d)}</div><div class="card lista">${arr.map(linhaMov).join('')}</div>`).join('');
}

function linhaMov(m) {
  const sinal = m.natureza === 'entrada' ? 1 : m.natureza === 'saida' ? -1 : 0;
  let tit = m.descricao || m.categoria;
  let sub = [];
  if (m.natureza === 'transferencia' || m.natureza === 'ajuste') {
    tit = m.natureza === 'ajuste' ? 'Ajuste de conciliação' : ({ aporte: 'Reserva em caixinha', resgate: 'Resgate de caixinha', fatura: 'Pagamento de fatura', entre_contas: 'Transferência' }[m.tipoTransf] || 'Transferência');
    sub.push(`${m.contaId ? nomeConta(m.contaId) : '—'} → ${m.destinoId ? nomeConta(m.destinoId) : '—'}`);
    if (m.descricao) sub.push(m.descricao);
  } else {
    sub.push(m.categoria);
    if (m.caixinhaId && m.caixinhaId !== m.contaId) sub.push(nomeConta(m.caixinhaId) + (m.caixinhaAuto ? ' (auto)' : ''));
    else if (m.contaId) sub.push(nomeConta(m.contaId));
    if (m.pagoPelaPJ) sub.push('pago pela conta PJ');
    if (m.classe === 'prolabore') sub.push('pró-labore');
  }
  const tags = [!m.realizado ? '<span class="chip st-futuro">previsto</span>' : '',
    m.conciliado ? '<span class="chip ok">conferido</span>' : '',
    m.planoItemId ? `<span class="chip">no plano${m.autoVinculo ? ' · auto' : ''}</span>` : ''].join('');
  return `<div class="mv ${m.realizado ? '' : 'prev'}" onclick="formMov('${esc(m.key)}')">
    <div class="it-m"><div class="it-t">${esc(tit)}</div><div class="it-s">${esc(sub.filter(Boolean).join(' · '))}</div>${tags ? `<div>${tags}</div>` : ''}</div>
    <div class="mv-v ${sinal > 0 ? 'pos' : ''}">${sinal ? brl(sinal * m.valor, true) : brl(m.valor)}</div></div>`;
}

// ══ CONFERIR COM O BANCO ═════════════════════════════════
function telaConciliar() {
  if (UI.extrato) return telaExtrato();
  let h = segMovs();
  if (pfTravada()) return h + cartaoPFBloqueado();
  const ent = UI.ent, ctx = stCtx(UI.mes), P = painel();
  h += `<section class="card passos"><h3>Extrato do banco${info('1. Registre no dia a dia (ou não): o plano funciona sem extrato.\n2. Importe o extrato — parcial ou do mês inteiro. O que já foi registrado só é conferido, nada é duplicado.\n3. Confira o saldo de cada conta com o app do banco.')}</h3>
      <button class="btn" onclick="formExtrato()">⇪ Importar extrato (OFX ou CSV)</button>
    </section>`;

  const contas = P.resumo.saldos.filter(s => s.conta.tipo !== 'caixinha');
  h += `<div class="sec-t">Contas</div><div class="card lista">${contas.map(s => linhaConta(s)).join('') || vazio('Nenhuma conta.')}</div>`;
  const cxs = P.resumo.saldos.filter(s => s.conta.tipo === 'caixinha');
  if (cxs.length) {
    const nc = cxs.filter(s => !s.conferido).length;
    h += `<details class="card det" ${UI.aberto.cxConf ? 'open' : ''} ontoggle="UI.aberto.cxConf=this.open"><summary><b>Caixinhas</b> <span class="muted sm">${cxs.length}${nc ? ` · <span class="t-alerta">${nc} sem saldo conferido</span>` : ''}</span></summary>
      <div class="lista">${cxs.map(s => linhaConta(s, true)).join('')}</div></details>`;
  }

  // Para organizar: o que o sistema não conseguiu decidir sozinho
  const semCx = (P.acoes.find(a => a.tipo === 'classificar') || {}).movs || [];
  if (semCx.length) h += `<div class="sec-t">Saídas sem categoria <span class="cnt">${semCx.length}</span>${info('Toque e escolha a categoria. Caixinha é opcional: saída pode sair direto da conta.')}</div>
    <div class="card lista">${semCx.slice(0, 40).map(linhaMov).join('')}</div>`;
  if (ent === 'PJ') {
    const venc = (P.acoes.find(a => a.tipo === 'clientes') || {}).lista || [];
    if (venc.length) h += `<div class="sec-t">Clientes sem confirmar <span class="cnt">${venc.length}</span>${info('A data passou e ainda estão como “Previsto”. Confirme só o que entrou de verdade (ou importe o extrato).')}</div>
      <div class="card lista">${venc.slice(0, 30).map(m => `<div class="ct"><div class="it-m"><div class="it-t">${esc(m.cliente || m.descricao)}</div>
        <div class="it-s">${esc(m.tipoEntrada)} · venceu ${dm(m.data)}${m.dataServ ? ' · atendimento ' + dm(m.dataServ) : ''}</div></div>
        <div class="it-v">${brl(m.valor)}</div><button class="btn mini" onclick="formConfirmar('${m.id}')">Recebi</button></div>`).join('')}</div>`;
  }
  const im = FX.itensDoMes(ST.itens, UI.mes, ctx.movs, ctx.hoje, ctx.cfg);
  const dvSemItem = ST.dividas.filter(d => d.entidade === ent && d.ativa !== false && d.situacao === 'no_plano' &&
    stPlano(UI.mes) && !im.some(i => i.dividaId === d.id) && !(d.parcelasRestantes === 0));
  if (dvSemItem.length) h += `<div class="sec-t">Dívidas sem parcela no mês${info('Estão no plano, mas não têm parcela neste mês. Confira se terminou ou se a vigência precisa ser estendida.')}</div><div class="card lista">${dvSemItem.map(d =>
    `<div class="ct" onclick="formDivida('${d.id}')"><div class="it-m"><div class="it-t">${esc(d.nome)}</div><div class="it-s">conferir vigência</div></div></div>`).join('')}</div>`;
  const naoConc = ctx.movs.filter(m => m.entidade === ent && FX.mesDe(m.data) === UI.mes && m.realizado && !m.conciliado && m.afetaSaldo).length;
  if (naoConc) h += `<button class="outra" onclick="UI.movFiltro='naoconc';go('movs')"><span>${naoConc} lançamento${naoConc > 1 ? 's' : ''} do mês ainda sem extrato</span><span class="muted">ver ›</span></button>`;
  return h;
}
function linhaConta(s, caixinha) {
  const c = s.conta;
  const ult = ST.conciliacoes.filter(x => x.contaId === c.id).sort((a, b) => b.data.localeCompare(a.data))[0];
  return `<div class="ct conta">
    <div class="it-m"><div class="it-t">${esc(c.nome)}</div>
      <div class="it-s">${s.conferido ? `<span class="t-ok">✓ conferido</span> ${ult ? 'em ' + dm(ult.data) : ''}` : `<span class="t-alerta">saldo não conferido</span> · só movimentos desde ${dm(s.desde) || 'o início'}`}</div></div>
    <div class="it-v ${s.saldo < 0 && c.tipo !== 'cartao' ? 'neg' : ''}">${brl(s.saldo)}${c.tipo === 'cartao' && s.saldo < 0 ? '<small>fatura aberta</small>' : ''}</div>
    <div class="ct-b">${c.tipo === 'cartao' && s.saldo < 0 ? `<button class="btn mini" onclick="formFatura('${c.id}')">Pagar fatura</button>` : ''}
      ${!caixinha && c.tipo !== 'especie' ? `<button class="btn mini sec" onclick="formExtrato('${c.id}')">Importar extrato</button>` : ''}
      <button class="btn mini sec" onclick="formConciliar('${c.id}')">Conferir saldo</button></div>
  </div>`;
}

// Revisão do extrato: separado pelo que precisa de você
const GRUPO_EX = [
  ['decidir', 'Precisa de você', 'Linhas novas que o sistema não reconheceu.'],
  ['sugerido', 'Novos, já sugeridos', 'Reconhecidos pelo plano, pelo nome ou por importações anteriores — confira.'],
  ['interno', 'Transferências entre as suas contas', 'Não são gasto nem receita.'],
  ['conciliar', 'Já registrados', 'Serão só conferidos — nada é criado de novo.'],
  ['estorno', 'Saiu e voltou', 'Mesmo valor devolvido: os dois são ignorados.'],
  ['duplicada', 'Já importados antes', 'Ignorados para não duplicar.'],
];
function grupoExtrato(p) {
  if (p.acao === 'conciliar' || p.acao === 'duplicada' || p.acao === 'estorno') return p.acao;
  if (p.decisao === 'transferencia' && (p.interno || p.auto)) return 'interno';
  return p.auto ? 'sugerido' : 'decidir';
}
function telaExtrato() {
  const x = UI.extrato, conta = stConta(x.contaId);
  x.propostas.forEach(p => { if (!p.grupo) p.grupo = grupoExtrato(p); });
  const opcoesDecisao = p => [['conciliar', 'Já lançado — conferir', !!p.match], ['prolabore', 'Pró-labore (PJ → PF)', (conta.entidade === 'PJ' && p.linha.valor < 0) || (conta.entidade === 'PF' && p.linha.valor > 0)], ['gasto', conta.entidade === 'PJ' ? 'Gasto da empresa' : 'Novo gasto', p.linha.valor < 0],
    ['pessoal', 'Gasto pessoal pago pela PJ', conta.entidade === 'PJ' && p.linha.valor < 0],
    ['cliente', 'Pagamento de cliente (já lançado)', conta.entidade === 'PJ' && p.linha.valor > 0 && (p.candidatos || []).length],
    ['receita', conta.entidade === 'PJ' ? 'Nova receita (não estava prevista)' : 'Nova entrada', p.linha.valor > 0], ['transferencia', 'Transferência interna', true], ['ignorar', 'Ignorar', true]]
    .filter(o => o[2]).map(([v, l]) => `<option value="${v}" ${p.decisao === v ? 'selected' : ''}>${l}</option>`).join('');
  const cartao = (p, k) => `<div class="card ex ${p.acao}">
      <div class="row ex-h"><span>${dm(p.linha.data)} · ${esc(p.linha.descricao || '(sem descrição)')}</span><b class="${p.linha.valor > 0 ? 'pos' : ''}">${brl(p.linha.valor, true)}</b></div>
      ${p.match ? `<div class="muted sm">≈ ${esc(p.match.descricao || p.match.categoria)} · ${dm(p.match.data)}${p.viraRealizado ? ' · <b>previsto → será confirmado</b>' : ''}</div>` : ''}
      ${p.auto ? `<div class="muted sm">${autoTag({ regra: 'aprendido', plano: 'do plano', palavra: 'pela descrição', nome: 'pelo nome', valor: 'pelo valor', ia: p.iaConf === 'baixa' ? 'IA · confira' : 'pela IA' }[p.auto])} ${p.planoItemId && stItem(p.planoItemId) ? esc(FX.nomeItem(stItem(p.planoItemId))) : ''}${p.auto === 'ia' && p.iaMotivo ? info(p.iaMotivo) : ''}</div>` : ''}
      ${p.acao === 'estorno' ? `<div class="muted sm">${autoTag('devolvido')} ${p.linha.valor < 0 ? 'voltou' : 'devolução de'} ${brl(Math.abs(p.par.valor))} em ${dm(p.par.data)}${info('Os dois se anulam e serão ignorados.')}</div>` : ''}
      ${p.acao === 'duplicada' ? `<div class="muted sm">${p.ignoradaAntes ? 'ignorado antes' : 'já importado'}</div>` : `
      <select class="fi sm" onchange="exDecisao(${k}, this.value)">${opcoesDecisao(p)}</select>
      ${p.decisao === 'cliente' ? (() => {
        const c = (p.candidatos || []).find(y => String(y.id) === String(p.entryId));
        const dif = c ? FX.r2(Math.abs(p.linha.valor) - c.valor) : 0;
        return `<input class="fi sm" placeholder="Buscar cliente…" value="${esc(p.busca || '')}" oninput="exBuscaCliente(${k}, this.value)">
        <select class="fi sm" id="ex-cli-${k}" onchange="UI.extrato.propostas[${k}].entryId=this.value;render()">${opcoesCliente(p)}</select>
        <div class="muted sm">${!c ? '' : c.recebido ? `só conferir${Math.abs(dif) >= 0.01 ? ' · valor diferente' : ''}${info('Já estava como recebido no Financeiro: só será conferido.' + (Math.abs(dif) >= 0.01 ? ' Valor lançado: ' + brl(c.valor) + ' — fica anotado para conferir.' : ''))}`
          : Math.abs(dif) < 0.01 ? `confirma recebimento${info('Previsto → realizado, sem criar receita nova.')}`
          : dif < 0 ? `parcial · falta ${brl(-dif)}${info(brl(Math.abs(p.linha.valor)) + ' fica como recebido e ' + brl(-dif) + ' continua previsto.')}`
          : `+${brl(dif)} a mais${info('O recebimento é confirmado com o valor do extrato.')}`}
          ${p.auto === 'regra' ? ' · pagador conhecido' : ''}</div>`; })() : ''}
      ${p.decisao === 'prolabore' ? `<select class="fi sm" onchange="UI.extrato.propostas[${k}].planoItemId=this.value">
          ${AC.itensProlaboreDoMes(FX.mesDe(p.linha.data)).map(i => `<option value="${i.id}" ${p.planoItemId === i.id ? 'selected' : ''}>Conta para: ${esc(FX.nomeItem(i))} — falta ${brl(i._falta)}</option>`).join('')}
          <option value="" ${!p.planoItemId ? 'selected' : ''}>Fora do plano (pró-labore extra)</option></select>
        <div class="muted sm">PJ → sua conta pessoal${info('Não é despesa da empresa. Pagamentos soltos vão somando na parcela até completar.')}</div>` : ''}
      ${p.decisao === 'pessoal' ? `<select class="fi sm" onchange="UI.extrato.propostas[${k}].categoria=this.value"><option value="">Categoria pessoal…</option>${optCategorias('PF', p.categoria)}</select>
        <div class="muted sm">PJ → pessoal${info('Sai da conta PJ, não conta como despesa da empresa e entra no seu pessoal.')}</div>` : ''}
      ${p.decisao === 'gasto' || p.decisao === 'receita' ? `<select class="fi sm" onchange="exCategoria(${k}, this.value)">
        ${p.decisao === 'receita' && conta.entidade === 'PF' ? (ST.cfg || FX_MODELO.config).categorias.receitasPF.map(c => `<option ${p.categoria === c ? 'selected' : ''}>${c}</option>`).join('')
          : p.decisao === 'receita' ? '<option>Extrato</option>' : `<option value="">Categoria…</option>${optCategorias(conta.entidade, p.categoria)}`}</select>` : ''}
      ${p.decisao === 'gasto' ? `<select class="fi sm" id="ex-cx-${k}" onchange="UI.extrato.propostas[${k}].caixinhaId=this.value">${optContas(conta.entidade, ['caixinha'], p.caixinhaId, 'Sem caixinha')}</select>` : ''}
      ${p.decisao === 'gasto' && p.planoItemId && stItem(p.planoItemId) ? `<div class="muted sm">paga a conta <b>${esc(FX.nomeItem(stItem(p.planoItemId)))}</b>${info('Esta linha vai dar baixa nessa conta do plano.')} <button class="lnk sm" onclick="UI.extrato.propostas[${k}].planoItemId='';render()">não é essa</button></div>` : ''}
      ${p.decisao === 'transferencia' ? `<select class="fi sm" onchange="UI.extrato.propostas[${k}].destinoId=this.value"><option value="">${p.linha.valor > 0 ? 'Veio de…' : 'Foi para…'}</option>${optContas(conta.entidade, ['caixinha', 'cartao', 'corrente', 'especie'], p.destinoId).replace(`value="${conta.id}"`, `value="${conta.id}" disabled`)}${!ST.contas.some(c => c.entidade === conta.entidade && c.finalidade === 'reserva') ? `<option value="${AC.RESERVA_NOVA}" ${p.destinoId === AC.RESERVA_NOVA ? 'selected' : ''}>Reserva Inter (não distribuída) — será criada</option>` : ''}</select>
        ${p.interno ? `<div class="muted sm">movimento interno${info('Entre a conta e as caixinhas do banco: não é gasto nem receita (só mantém o saldo da conta igual ao do banco).')}</div>` : ''}` : ''}`}
    </div>`;
  let h = `<div class="toolbar"><button class="lnk" onclick="UI.extrato=null;render()">‹ Cancelar importação</button><b>${esc(conta.nome)}</b></div>
    <div class="card"><div class="muted sm">${esc(x.info || '')}</div>
      <div class="ex-resumo">${GRUPO_EX.map(([g, t]) => { const n = x.propostas.filter(p => p.grupo === g).length;
        return n ? `<span class="ex-cnt g-${g}"><b>${n}</b> ${t.toLowerCase()}</span>` : ''; }).join('')}</div>
      ${x.ia ? `<div class="ia-st ia-${x.ia.estado}">${x.ia.estado === 'lendo' ? `<span class="ia-pulso"></span>IA lendo ${x.ia.n} linha${x.ia.n === 1 ? '' : 's'}…`
        : x.ia.estado === 'ok' ? `IA sugeriu ${x.ia.n} linha${x.ia.n === 1 ? '' : 's'} · confira${info('A IA só preenche o que as regras não reconheceram. Nada é gravado até você aplicar; o que você confirmar vira regra.')}`
        : x.ia.estado === 'sem-chave' ? `IA desligada${info('Falta a chave da Claude: ⚙️ no Financeiro › Claude IA.')}`
        : `IA indisponível${info(x.ia.erro || '')} <button class="lnk sm" onclick="iaExtrato()">tentar de novo</button>`}</div>` : ''}</div>`;
  GRUPO_EX.forEach(([g, t, d]) => {
    const idx = x.propostas.map((p, k) => k).filter(k => x.propostas[k].grupo === g);
    if (!idx.length) return;
    const recolhido = ['conciliar', 'estorno', 'duplicada'].includes(g);
    const corpo = idx.map(k => cartao(x.propostas[k], k)).join('');
    h += recolhido
      ? `<details class="ex-g" ${UI.aberto['ex-' + g] ? 'open' : ''} ontoggle="UI.aberto['ex-${g}']=this.open"><summary class="sec-t">${t} <span class="cnt">${idx.length}</span>${info(d)}</summary>${corpo}</details>`
      : `<div class="sec-t">${t} <span class="cnt">${idx.length}</span>${info(d)}</div>${corpo}`;
  });
  return h + `<div class="aplicar"><div class="aplicar-l"><button class="btn" onclick="acAplicarExtrato()">Aplicar ${x.propostas.length} linhas</button>${info('O que você decidir vira regra: na próxima importação essas descrições já vêm preenchidas.')}</div></div>`;
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

// ══ MAIS / AJUSTES ═══════════════════════════════════════
const itemMenu = (t, d, fn, ico) => `<button class="aj" onclick="${fn}">${ico ? ICO[ico] : ''}<span><b>${t}</b><span>${d}</span></span><i>›</i></button>`;
function telaMais() {
  return titulo('Mais') + `<div class="card lista">
    ${itemMenu('Conferir com o banco', 'Importar extrato e conferir saldos', "go('conciliar')", 'banco')}
    ${itemMenu('Dívidas', 'Saldos, parcelas e simulação de quitação', "go('dividas')", 'cartao')}
    ${itemMenu('Análises', 'Plano × realizado, semanadas, evolução', "go('analises')", 'grafico')}
    ${itemMenu('Modelo do planejamento', 'Base para criar os próximos meses', "UI.modelo=true;go('plano')", 'plano')}
  </div>${telaAjustes(true)}`;
}
function telaAjustes(dentroDoMais) {
  const iAj = 'Modelo inicial: ' + FX_MODELO.fonte + '. Diagnóstico da planilha em fluxo/DIAGNOSTICO.md.';
  return (dentroDoMais ? `<div class="sec-t">Ajustes${info(iAj)}</div>` : titulo('Ajustes', iAj)) + `<div class="card lista">
    ${itemMenu('Contas e caixinhas', 'Inter PF/PJ, caixinhas, cartões, contas antigas', "UI.aberto.contas=!UI.aberto.contas;render()")}
    ${UI.aberto.contas ? listaContas() : ''}
    ${!dentroDoMais ? itemMenu('Modelo do planejamento', 'Base para criar os próximos meses', "UI.modelo=true;go('plano')") : ''}
    ${itemMenu('Categorias', 'Criar e organizar as categorias de saídas', 'formCategorias()')}
    ${itemMenu('Semanas e sazonais', 'Datas das semanas, orçamento anual das sazonais', 'formConfig()')}
    ${itemMenu('Histórico de alterações', 'Tudo o que foi gravado pelo fluxo', 'verLog()')}
    ${ST.pfLiberado ? itemMenu('Sair do pessoal', 'Esconde a PF neste aparelho', 'sairPF()') : itemMenu('Entrar no pessoal', 'Libera a PF', 'abrirLoginPF()')}
  </div>`;
}
function listaContas() {
  const ents = ST.pfLiberado ? ['PF', 'PJ'] : ['PJ'];
  return `<div class="sub">${ents.map(e => `<div class="sub-t">${e}</div>${ST.contas.filter(c => c.entidade === e).map(c =>
    `<div class="kv sm" onclick="formConta('${c.id}')"><span>${esc(c.nome)} ${c.ativa === false ? '(inativa)' : ''}</span><b>${c.tipo}${c.padrao ? ' · padrão' : ''}${c.finalidade ? ' · ' + c.finalidade : ''}</b></div>`).join('')}`).join('')}
    <button class="lnk sm" onclick="formConta(null)">+ Nova conta ou caixinha</button></div>`;
}

// ══ ANÁLISES ═════════════════════════════════════════════
function telaAnalises() {
  const ent = UI.ent;
  let h = titulo('Análises', 'Como o mês está em relação ao plano e como as semanadas vêm se comportando.');
  if (pfTravada()) return h + cartaoPFBloqueado();
  const ctx = stCtx(UI.mes);
  const a = FX.analiseMes(ent, ctx);
  const hist = FX.historico(ent, ctx, 6);
  h += `<div class="card"><div class="row"><h3>Plano × realizado</h3><span class="big2">${a.cumprimento == null ? '—' : a.cumprimento.toFixed(0) + '%'}</span></div>
    ${barra(a.executado, a.planejado, a.cumprimento >= 99.5 ? 'ok' : 'andamento')}
    <div class="kv sm"><span>Planejado</span><b>${brl(a.planejado)}</b></div>
    <div class="kv sm"><span>Executado (até o previsto de cada item)</span><b>${brl(a.executado)}</b></div>
    <div class="kv sm ${a.totalForaCx ? 't-alerta' : ''}"><span>Gastos fora das caixinhas e do plano</span><b>${brl(a.totalForaCx)}</b></div></div>`;

  if (a.semanadas) {
    const l = a.semanadas.linhas.filter(x => x.passada || x.atual);
    const media = hist.filter(x => x.semanadaReservada > 0);
    h += `<div class="sec-t">Semanadas — estão sendo suficientes?</div><div class="card">
      ${l.map(x => `<div class="kv sm ${x.estourou ? 'neg' : ''}"><span>S${x.semana.n} (${x.semana.label})</span>
        <b>${brlc(x.gasto)} de ${brlc(x.orcamento)} · ${x.estourou ? 'faltou ' + brlc(x.acima) : 'sobrou ' + brlc(x.podeGastar)}</b></div>`).join('') || vazio('Nenhuma semana encerrada ainda.')}
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
  if (a.semanadas) a.semanadas.linhas.filter(x => x.estourou).forEach(x => desvios.push(`<div class="kv sm neg"><span>Semanada S${x.semana.n}</span><b>gastou ${brl(x.gasto)} de ${brl(x.orcamento)}</b></div>`));
  h += `<div class="sec-t">Desvios do mês</div><div class="card">${desvios.join('') || '<div class="t-ok sm">Nenhum gasto acima do planejado.</div>'}</div>`;

  const fixas = FX.caixinhaPorFinalidade(ST.contas, ent, 'fixas');
  if (fixas) {
    const comp = FX.composicao(fixas, ctx);
    const prev = comp.reduce((t, x) => t + x.previsto, 0), pago = comp.reduce((t, x) => t + x.pago, 0);
    h += `<div class="card">${progresso({ rotulo: 'Despesas fixas pagas', feito: pago, total: prev, modo: 'meta', verbo: 'pago' })}
      <div class="muted sm">${comp.filter(x => x.status === 'feito').length} de ${comp.length} pagas · diferença acumulada ${brl(comp.reduce((t, x) => t + (x.diferenca || 0), 0))}</div></div>`;
  }

  if (ent === 'PJ') {
    const rm = FX.receitaMaquiagem(ctx);
    h += `<div class="sec-t">Maquiagem — quanto entrou e quanto ainda vai entrar</div><div class="card">
      <div class="sub-t">Pela data do atendimento (${rm.servico.atendimentos} atendimentos)</div>
      <div class="kv sm"><span>Contratado</span><b>${brl(rm.servico.contratado)}</b></div>
      <div class="kv sm"><span>Já recebido</span><b class="pos">${brl(rm.servico.recebido)}</b></div>
      <div class="kv sm"><span>Pendente</span><b>${brl(rm.servico.pendente)}</b></div>
      <div class="sub-t">Pela data do pagamento</div>
      <div class="kv sm"><span>Recebido no mês</span><b>${brl(rm.caixa.recebido)}</b></div>
      <div class="kv sm"><span>A receber</span><b>${brl(rm.caixa.aReceber)}</b></div>
      <div class="kv sm ${rm.caixa.atrasado ? 't-alerta' : ''}"><span>Vencido sem confirmação</span><b>${brl(rm.caixa.atrasado)}</b></div>
      <div class="kv sm"><span>Recebido e ainda não conferido com o extrato</span><b>${brl(rm.caixa.naoConciliado)}</b></div></div>`;
  }

  h += `<div class="sec-t">Evolução (6 meses)</div><div class="card">${hist.map(x => `<div class="mini-l evo">
      <span><b>${nomeMesC(x.mes)}</b></span>
      <span class="muted">${x.planejado ? `${brlc(x.executado)} de ${brlc(x.planejado)}` : 'sem plano'}</span>
      <b class="${x.cumprimento != null && x.cumprimento >= 99.5 ? 't-ok' : ''}">${x.cumprimento != null ? x.cumprimento.toFixed(0) + '%' : '—'}</b>
      ${x.foraCx ? `<small class="muted">direto da conta ${brlc(x.foraCx)}</small>` : ''}</div>`).join('')}</div>`;
  return h;
}
function pct(v, hist) {
  const max = Math.max(1, ...hist.map(x => Math.max(x.semanadaReservada, x.semanadaGasta)));
  return Math.round(v / max * 100);
}

// ══ DÍVIDAS ══════════════════════════════════════════════
function telaDividas() {
  const ents = ST.pfLiberado ? ['PF', 'PJ'] : ['PJ'];
  const ctx = stCtx(UI.mes);
  const r = FX.resumoDividas(ST.dividas, ctx.movs, ents);
  const atual = FX.mesDe(ctx.hoje);
  let h = titulo('Dívidas', 'As que estão no plano têm parcela no mês. As de fora ficam aqui até você decidir como pagar.');
  h += `<div class="card"><div class="grid3"><div><span>Para quitar${info('Valores sem data são os da consultoria — atualize quando tiver o saldo do banco.')}</span><b>${brl(r.quitacao)}</b></div>
    <div><span>Parcelado em aberto</span><b>${brl(r.emAberto)}</b></div><div><span>Parcelas/mês</span><b>${brl(r.parcelasMes)}</b></div></div>
    <div class="kv sm"><span>No plano</span><b>${r.plano.length} · ${brl(r.parcelasNoPlano)}/mês</b></div>
    <div class="kv sm"><span>Fora do plano (aguardando)</span><b>${r.fora.length} · ${brl(r.quitacaoFora)} para quitar</b></div></div>`;
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
  const grupo = (t, arr) => arr.length ? `<div class="sec-t">${t} <span class="cnt">${arr.length}</span></div><div class="card lista">${arr.map(linha).join('')}</div>` : '';
  h += grupo('No plano', r.plano);
  h += grupo('Fora do plano — para planejar', r.fora);

  const sim = UI.sim || (UI.sim = { orc: '', est: 'juros', ini: FX.addMes(atual, 1), quais: 'fora' });
  const alvo = (sim.quais === 'todas' ? r.detalhes : r.fora).map(x => x.divida);
  const res = FX.parseValor(sim.orc) > 0 ? FX.simularDividas(alvo, FX.parseValor(sim.orc), sim.est, sim.ini) : null;
  h += `<div class="sec-t">Planejar a quitação${info('Estimativa a partir do valor para quitação e dos juros mensais informados. Para colocar no plano, abra a dívida › Incluir no plano.')}</div><div class="card sim">
    <div class="two"><div><label class="fl">Quanto dá para separar por mês</label><div class="vwrap"><span>R$</span><input class="fi" id="sim-orc" inputmode="decimal" value="${esc(sim.orc)}" onchange="UI.sim.orc=this.value;render()"></div></div>
      <div><label class="fl">A partir de</label><input class="fi" type="month" value="${sim.ini}" onchange="UI.sim.ini=this.value;render()"></div></div>
    <div class="two"><div><label class="fl">Prioridade</label><select class="fi" onchange="UI.sim.est=this.value;render()">
      ${[['juros', 'Maior juros primeiro'], ['saldo', 'Menor saldo primeiro'], ['prioridade', 'Minha ordem (prioridade)']].map(([v, l]) => `<option value="${v}" ${sim.est === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div><label class="fl">Dívidas</label><select class="fi" onchange="UI.sim.quais=this.value;render()">
      <option value="fora" ${sim.quais === 'fora' ? 'selected' : ''}>Só as fora do plano</option><option value="todas" ${sim.quais === 'todas' ? 'selected' : ''}>Todas</option></select></div></div>
    ${res ? (res.insuficiente ? `<div class="aviso erro sm sim-res">Com ${brl(FX.parseValor(sim.orc))}/mês os juros não deixam quitar em 20 anos.</div>`
      : `<div class="sim-res"><div class="kv"><span>Quita tudo em</span><b>${res.meses} meses (${nomeMes(res.mesFinal)})</b></div>
        <div class="kv sm"><span>Juros estimados no período</span><b>${brl(res.totalJuros)}</b></div>
        ${res.lista.slice().sort((a, b) => (a.quitaEm || '9').localeCompare(b.quitaEm || '9')).map(x => `<div class="mini-l"><span>${esc(x.divida.nome)}</span><span class="muted">juros ${brlc(x.juros)}</span><b>${x.quitaEm ? nomeMesC(x.quitaEm) : '—'}</b></div>`).join('')}
        </div>`) : '<div class="muted sm" style="margin-top:8px">Informe quanto dá por mês.</div>'}
  </div>`;

  const quit = ST.dividas.filter(d => ents.includes(d.entidade) && (d.situacao === 'quitada' || d.ativa === false));
  if (quit.length) h += `<div class="sec-t">Quitadas</div><div class="card lista">${quit.map(d => `<div class="ct" onclick="formDivida('${d.id}')"><div class="it-m"><div class="it-t">${esc(d.nome)}</div></div></div>`).join('')}</div>`;
  h += `<button class="btn sec" onclick="formDivida(null)">+ Nova dívida</button>`;
  return h;
}

// "i" da caixinha: para que serve + as categorias de saída que saem dela
function infoCaixinha(cx) {
  const cfg = ST.cfg || FX_MODELO.config;
  const cats = categorias(cx.entidade).filter(c => (FX.caixinhaDaCategoria(ST.contas, cx.entidade, c.nome, cfg) || {}).id === cx.id).map(c => c.nome);
  return [FINALIDADE_LABEL[cx.finalidade] ? 'Para ' + FINALIDADE_LABEL[cx.finalidade] + '.' : '',
    cats.length ? 'Categorias: ' + cats.join(', ') + '.' : ''].filter(Boolean).join('\n');
}
