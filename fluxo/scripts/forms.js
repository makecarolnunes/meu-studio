// ════════════════════════════════════════════════════════════
// fluxo/scripts/forms.js — formulários (folha inferior) e handlers
// ════════════════════════════════════════════════════════════

function go(tab) { UI.tab = tab; if (tab !== 'plano') UI.modelo = false; if (tab !== 'ajustes') UI.extrato = null; uiPersist(); render(); window.scrollTo(0, 0); }
function setEnt(e) { UI.ent = e; uiPersist(); render(); }
function chMes(d) { UI.mes = FX.addMes(UI.mes, d); UI.modelo = false; render(); }
function toggleAberto(id) { UI.aberto[id] = !(UI.aberto[id] !== false && (UI.aberto[id] || ['semanada', 'fixas'].includes((stConta(id) || {}).finalidade))); render(); }

function dataPadrao(dataItem) {
  const hoje = stHoje();
  return FX.mesDe(hoje) === FX.mesDe(dataItem) || !dataItem ? hoje : dataItem;
}
const campo = (rotulo, input) => `<label class="fl">${rotulo}</label>${input}`;
const inValor = (id, v) => `<div class="vwrap"><span>R$</span><input class="fi" id="${id}" inputmode="decimal" placeholder="0,00" value="${valIn(v)}" autofocus></div>`;
const inData = (id, v) => `<input class="fi" type="date" id="${id}" value="${v || stHoje()}">`;
const rodape = (fnOk, rotulo, extra) => `<button class="btn" onclick="${fnOk}">${rotulo}</button>${extra || ''}<button class="btn ghost" onclick="fecharModal()">Cancelar</button>`;

// ── SETUP / MÊS ──────────────────────────────────────────
function acSetup() {
  const mes = $v('setup-mes');
  executar(async () => { const r = await AC.configurarInicial(mes, { caixinhasZeradas: $v('setup-zeradas') === true });
    UI.mes = mes; await AC.garantirMeses(); return r; }, 'Estrutura criada. Agora informe o saldo real das contas.');
}
function acComoPlanejado(ids) {
  executar(async () => { const n = await AC.executarComoPlanejado(ids); toast(n + ' aporte(s) registrado(s)'); return n; });
}
function acCriarMes(origem) { executar(() => AC.criarMes(UI.mes, origem), 'Planejamento do mês criado'); }
function acFechar(fechar) {
  if (fechar && !confirm('Fechar o mês? O planejamento fica só para consulta (dá para reabrir).')) return;
  executar(() => fechar ? AC.fecharMes(UI.mes) : AC.reabrirMes(UI.mes), fechar ? 'Mês fechado' : 'Mês reaberto');
}

// ── EXECUTAR ITEM DO PLANO ───────────────────────────────
function formExecutar(itemId) {
  const ctx = stCtx(UI.mes);
  const i = FX.itensDoMes(ST.itens, ST.itens.find(x => x.id === itemId).mes, ctx.movs, ctx.hoje, ctx.cfg).find(x => x.id === itemId);
  if (!i) return;
  if (i.entidade === 'PF' && !ST.pfLiberado && i.tipo !== 'prolabore') return abrirLoginPF();
  const falta = i._falta || i.valor;
  const cx = i.caixinhaId ? stConta(i.caixinhaId) : null;
  let corpo = '';
  if (i.tipo === 'aporte') {
    corpo = campo('De onde sai', `<select class="fi" id="ex-origem">${optContas(i.entidade, ['corrente', 'especie', 'caixinha'], i.contaId || (FX.contaPadrao(ST.contas, i.entidade, 'corrente') || {}).id)}</select>`) +
      `<div class="nota">Transferência para a caixinha <b>${esc(cx ? cx.nome : '')}</b>. Não conta como gasto — o dinheiro continua seu, reservado.</div>`;
  } else if (i.tipo === 'pagamento') {
    const contaPadr = cx ? (FX.contaPadrao(ST.contas, i.entidade, 'corrente') || {}).id : (i.contaId || (FX.contaPadrao(ST.contas, i.entidade, 'corrente') || {}).id);
    corpo = campo('Pago com', `<select class="fi" id="ex-conta" onchange="exAtualizaResgate()">${optContas(i.entidade, ['corrente', 'caixinha', 'cartao', 'especie'], contaPadr)}</select>`) +
      (cx ? `<label class="chk" id="ex-resg-wrap"><input type="checkbox" id="ex-resgatar" checked> Usar o dinheiro reservado em <b>${esc(cx.nome)}</b> (registra o resgate da caixinha para a conta)</label>` : '') +
      `<div class="nota" id="ex-nota-cartao" style="display:none">No cartão: a despesa entra hoje e a reserva continua na caixinha até você pagar a fatura (Caixinhas › cartão › Pagar).</div>`;
  } else if (i.tipo === 'prolabore') {
    corpo = `<div class="nota">Cria a <b>saída PJ</b> (Inter PJ → sua conta pessoal) e a <b>entrada PF</b> vinculada. No Financeiro aparece como saída “Pró-labore” de natureza Pessoal.</div>` +
      campo('Sai da conta PJ', `<select class="fi" id="ex-conta">${optContas('PJ', ['corrente'], i.contaId)}</select>`) +
      (ST.pfLiberado ? campo('Entra na conta PF', `<select class="fi" id="ex-contapf">${optContas('PF', ['corrente'], (FX.contaPadrao(ST.contas, 'PF', 'corrente') || {}).id)}</select>`) : '');
  } else {
    corpo = campo('Entra em', `<select class="fi" id="ex-conta">${optContas(i.entidade, ['corrente', 'especie'], i.contaId)}</select>`) +
      campo('Categoria', `<select class="fi" id="ex-cat">${(ST.cfg || FX_MODELO.config).categorias.receitasPF.map(c => `<option>${c}</option>`).join('')}</select>`);
  }
  abrirModal(`<h2>${ACAO_LABEL[i.tipo]} · ${esc(FX.nomeItem(i))}</h2>
    <div class="muted sm">Previsto ${brl(i.valor)} para ${dm(i._data)}${i._realizado ? ` · já feito ${brl(i._realizado)}` : ''}</div>
    <div class="two">${campo('Valor real', inValor('ex-valor', falta))}${campo('Data', inData('ex-data', dataPadrao(i._data)))}</div>
    ${corpo}
    ${rodape(`acExecutar('${i.id}')`, 'Registrar', FX.PENDENTE(i._status) ? `<div class="row"><button class="lnk sm" onclick="formReprogramar('${i.id}')">Reprogramar</button><button class="lnk sm" onclick="acDispensar('${i.id}')">Dispensar este mês</button></div>` : '')}`);
  exAtualizaResgate();
}
function exAtualizaResgate() {
  const sel = document.getElementById('ex-conta');
  if (!sel) return;
  const c = stConta(sel.value);
  const w = document.getElementById('ex-resg-wrap'), n = document.getElementById('ex-nota-cartao');
  if (w) w.style.display = c && (c.tipo === 'corrente' || c.tipo === 'especie') ? '' : 'none';
  if (n) n.style.display = c && c.tipo === 'cartao' ? '' : 'none';
}
function acExecutar(id) {
  const i = stItem(id);
  const d = { valor: $v('ex-valor'), data: $v('ex-data') };
  executar(async () => {
    if (i.tipo === 'aporte') return AC.executarAporte(id, Object.assign(d, { origemId: $v('ex-origem') }));
    if (i.tipo === 'pagamento') return AC.pagarItem(id, Object.assign(d, { contaId: $v('ex-conta'), resgatar: document.getElementById('ex-resgatar') ? $v('ex-resgatar') : false }));
    if (i.tipo === 'prolabore') return AC.pagarProlabore(id, Object.assign(d, { contaId: $v('ex-conta'), contaPFId: $v('ex-contapf') }));
    return AC.registrarEntradaPF(Object.assign(d, { contaId: $v('ex-conta'), categoria: $v('ex-cat'), descricao: i.descricao, planoItemId: id }));
  }, 'Registrado ✓');
}
function formReprogramar(id) {
  const i = stItem(id);
  abrirModal(`<h2>Reprogramar · ${esc(i.descricao)}</h2>
    <p class="muted sm">Quando o dinheiro não for suficiente, mude a data neste mês ou leve o que falta para o mês seguinte. O histórico fica registrado.</p>
    ${campo('Nova data neste mês (dia)', `<input class="fi" type="number" min="1" max="31" id="rp-dia" value="${Math.min(31, Number(i.dia) + 7)}">`)}
    <button class="btn" onclick="executar(()=>AC.reprogramarItem('${id}',{novoDia:$v('rp-dia')}),'Data alterada')">Mudar a data</button>
    <button class="btn sec" onclick="executar(()=>AC.reprogramarItem('${id}',{}),'O que falta foi para o mês seguinte')">Levar o que falta para ${nomeMes(FX.addMes(i.mes, 1))}</button>
    <button class="btn ghost" onclick="fecharModal()">Cancelar</button>`);
}
function acDispensar(id) {
  const motivo = prompt('Por que este item não vai acontecer neste mês? (fica no histórico)');
  if (motivo === null) return;
  executar(() => AC.dispensarItem(id, motivo), 'Item dispensado');
}

// ── ITEM DO PLANO (criar/editar) ─────────────────────────
function formItem(id) {
  const i = id ? stItem(id) : null;
  const mes = i ? i.mes : (UI.modelo ? 'modelo' : UI.mes);
  if (mes !== 'modelo' && !stPlano(mes)) return toast('Crie o planejamento do mês primeiro.', true);
  const ent = i ? i.entidade : UI.ent;
  const tipo = i ? i.tipo : 'pagamento';
  const fechado = mes !== 'modelo' && (stPlano(mes) || {}).status === 'fechado';
  const temMov = i && FX.realizadoDoItem(i, stMovs()).movs.length;
  abrirModal(`<h2>${i ? 'Item do plano' : 'Novo item'} · ${nomeMes(mes)}</h2>
    ${fechado ? '<div class="aviso sm">Mês fechado — só consulta. Reabra em Plano.</div>' : ''}
    <div class="two">${campo('Entidade', `<select class="fi" id="pi-ent" onchange="piAtualiza()">${['PF', 'PJ'].filter(e => e === 'PJ' || ST.pfLiberado).map(e => `<option ${e === ent ? 'selected' : ''}>${e}</option>`).join('')}</select>`)}
      ${campo('Tipo', `<select class="fi" id="pi-tipo" onchange="piAtualiza()">${[['pagamento', 'Pagamento'], ['aporte', 'Aporte em caixinha'], ['prolabore', 'Pró-labore (PJ → PF)'], ['receita', 'Receita PF']].map(([v, l]) => `<option value="${v}" ${v === tipo ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}</div>
    ${campo('Descrição', `<input class="fi" id="pi-desc" value="${esc(i ? i.descricao : '')}" placeholder="Ex.: Luz">`)}
    <div class="two">${campo('Dia do mês', `<input class="fi" type="number" min="1" max="31" id="pi-dia" value="${i ? i.dia : 10}">`)}${campo('Valor previsto', inValor('pi-valor', i ? i.valor : ''))}</div>
    <div id="pi-dyn"></div>
    <div class="two">${campo('Vale a partir de', `<input class="fi" type="month" id="pi-ini" value="${i && i.mesInicio || ''}">`)}${campo('Até (último mês)', `<input class="fi" type="month" id="pi-fim" value="${i && i.mesFim || ''}">`)}</div>
    ${campo('Nº de parcelas (mostra "2/5" no nome)', `<input class="fi" type="number" min="0" id="pi-parc" value="${i && i.parcelas || ''}" placeholder="—">`)}
    ${mes !== 'modelo' ? `<label class="chk"><input type="checkbox" id="pi-avulso" ${i && i.avulso ? 'checked' : ''}> Só neste mês (não copiar para os próximos)</label>
      <label class="chk"><input type="checkbox" id="pi-prop"> Aplicar também ao modelo e aos próximos meses</label>` : ''}
    ${fechado ? '<button class="btn ghost" onclick="fecharModal()">Fechar</button>' : rodape(`acSalvarItem(${i ? `'${i.id}'` : 'null'}, '${mes}')`, 'Salvar',
      i ? `<button class="btn ghost neg" onclick="acRemoverItem('${i.id}')">${temMov ? 'Excluir (bloqueado: tem movimentação)' : 'Excluir item'}</button>` : '')}`);
  window._piItem = i;
  piAtualiza();
}
function piAtualiza() {
  const ent = $v('pi-ent'), tipo = $v('pi-tipo'), i = window._piItem || {};
  let h = '';
  if (tipo === 'aporte' || tipo === 'pagamento')
    h += campo(tipo === 'aporte' ? 'Caixinha que recebe' : 'Pago com o dinheiro da caixinha', `<select class="fi" id="pi-cx">${optContas(ent, ['caixinha'], i.caixinhaId, tipo === 'pagamento' ? 'Nenhuma — direto da conta' : '')}</select>`);
  if (tipo === 'pagamento') {
    h += campo('Categoria', `<select class="fi" id="pi-cat">${optCategorias(ent, i.categoria)}</select>`);
    h += campo('Dívida (se for parcela)', `<select class="fi" id="pi-div"><option value="">—</option>${ST.dividas.filter(d => d.entidade === ent).map(d => `<option value="${d.id}" ${d.id === i.dividaId ? 'selected' : ''}>${esc(d.nome)}</option>`).join('')}</select>`);
  }
  if (tipo !== 'receita') h += campo('Sai da conta', `<select class="fi" id="pi-conta">${optContas(tipo === 'prolabore' ? 'PJ' : ent, ['corrente', 'especie', 'cartao'], i.contaId, 'Conta corrente padrão')}</select>`);
  document.getElementById('pi-dyn').innerHTML = h;
}
function acSalvarItem(id, mes) {
  executar(() => AC.salvarItem({ id: id || undefined, mes, entidade: $v('pi-ent'), tipo: $v('pi-tipo'), descricao: $v('pi-desc'),
    dia: $v('pi-dia'), valor: FX.parseValor($v('pi-valor')) || 0, caixinhaId: $v('pi-cx') || null, categoria: $v('pi-cat') || '',
    dividaId: $v('pi-div') || null, contaId: $v('pi-conta') || null, avulso: $v('pi-avulso') === true,
    mesInicio: $v('pi-ini') || null, mesFim: $v('pi-fim') || null, parcelas: $v('pi-parc') || null, propagar: $v('pi-prop') === true }), 'Plano atualizado');
}
function acRemoverItem(id) { if (confirm('Excluir este item do plano?')) executar(() => AC.removerItem(id), 'Item excluído'); }

// ── NOVO GASTO / ENTRADA / TRANSFERÊNCIA / FATURA ────────
function menuNovo() {
  abrirModal(`<h2>Registrar</h2><div class="menu">
    <button onclick="formGasto('${UI.ent}')"><b>Gasto</b><span>Despesa real (Pix, débito, cartão, dinheiro)</span></button>
    ${UI.ent === 'PF' ? `<button onclick="formEntradaPF()"><b>Entrada PF</b><span>Dinheiro que entrou na conta pessoal</span></button>` : `<button onclick="window.location.href='../financeiro/?tela=nova'"><b>Receita de cliente</b><span>Pelo Financeiro (mantém a integração com Orçamentos)</span></button>`}
    <button onclick="formTransferencia('${UI.ent}')"><b>Transferência</b><span>Aporte, resgate ou entre contas — não é gasto</span></button>
    <button onclick="formFatura()"><b>Pagar fatura do cartão</b><span>Quita compras já registradas, sem duplicar</span></button>
    ${UI.ent === 'PJ' ? `<button onclick="formProlaboreAvulso()"><b>Pró-labore fora do plano</b><span>Saída PJ + entrada PF vinculadas</span></button>` : ''}
  </div><button class="btn ghost" onclick="fecharModal()">Cancelar</button>`);
}

function formGasto(ent, caixinhaId) {
  ent = ent || UI.ent;
  if (ent === 'PF' && !ST.pfLiberado) return abrirLoginPF();
  const ctx = stCtx(UI.mes);
  const pend = FX.itensDoMes(ST.itens, UI.mes, ctx.movs, ctx.hoje, ctx.cfg).filter(i => i.entidade === ent && i.tipo === 'pagamento' && FX.PENDENTE(i._status));
  const cx = caixinhaId ? stConta(caixinhaId) : null;
  abrirModal(`<h2>Gasto ${ent}</h2>
    <div class="two">${campo('Valor', inValor('g-valor', ''))}${campo('Data', inData('g-data'))}</div>
    ${campo('Descrição', `<input class="fi" id="g-desc" placeholder="Ex.: Uber para atendimento">`)}
    ${campo('Categoria', `<select class="fi" id="g-cat" onchange="gAtualiza()">${optCategorias(ent, cx && cx.finalidade === 'semanada' ? (ent === 'PJ' ? 'Deslocamento' : 'Mercado') : '')}</select>`)}
    ${campo('De qual reserva (caixinha)', `<select class="fi" id="g-cx" onchange="gAtualiza()"><option value="">Automática pela categoria</option><option value="-">Nenhuma — fora do plano</option>${optContas(ent, ['caixinha'], caixinhaId)}</select>`)}
    <div class="muted sm" id="g-cx-auto"></div>
    ${campo('Pago com', `<select class="fi" id="g-conta" onchange="gAtualiza()">${optContas(ent, ['caixinha', 'corrente', 'cartao', 'especie'], caixinhaId || (FX.contaPadrao(ST.contas, ent, 'corrente') || {}).id)}</select>`)}
    <label class="chk" id="g-resg-wrap" style="display:none"><input type="checkbox" id="g-resgatar" checked> Registrar resgate da caixinha para a conta</label>
    ${pend.length ? campo('É um item do plano?', `<select class="fi" id="g-item"><option value="">Automático (pela categoria)</option><option value="-">Não</option>${pend.map(i => `<option value="${i.id}">${dm(i._data)} · ${esc(FX.nomeItem(i))} (${brl(i._falta)})</option>`).join('')}</select>`) : ''}
    ${rodape(`acGasto('${ent}')`, 'Registrar gasto')}`);
  window._gEnt = ent;
  gAtualiza();
}
function gAtualiza() {
  const ent = window._gEnt || UI.ent;
  let cx = $v('g-cx');
  const conta = stConta($v('g-conta'));
  const info = document.getElementById('g-cx-auto');
  if (!cx && info) {
    const auto = FX.caixinhaDaCategoria(ST.contas, ent, $v('g-cat'), ST.cfg || FX_MODELO.config);
    info.innerHTML = auto ? 'Vai usar: <b>' + esc(auto.nome) + '</b> ' + autoTag() : 'Sem caixinha para esta categoria (fica fora do plano).';
    cx = auto ? auto.id : '';
  } else if (info) info.innerHTML = '';
  if (cx === '-') cx = '';
  const w = document.getElementById('g-resg-wrap');
  if (w) w.style.display = cx && conta && cx !== conta.id && (conta.tipo === 'corrente' || conta.tipo === 'especie') ? '' : 'none';
}
function acGasto(ent) {
  const itemId = $v('g-item');
  const it = itemId ? stItem(itemId) : null;
  executar(() => AC.registrarGasto({ entidade: ent, valor: $v('g-valor'), data: $v('g-data'), descricao: $v('g-desc'),
    categoria: $v('g-cat'), caixinhaId: $v('g-cx') || (it && it.caixinhaId) || null, contaId: $v('g-conta'),
    resgatar: $v('g-resgatar') === true, planoItemId: itemId || null, dividaId: it ? it.dividaId : null }), 'Gasto registrado');
}

function formEntradaPF() {
  if (!ST.pfLiberado) return abrirLoginPF();
  abrirModal(`<h2>Entrada PF</h2>
    <div class="two">${campo('Valor', inValor('e-valor', ''))}${campo('Data', inData('e-data'))}</div>
    ${campo('Categoria', `<select class="fi" id="e-cat">${(ST.cfg || FX_MODELO.config).categorias.receitasPF.filter(c => c !== 'Pró-labore').map(c => `<option>${c}</option>`).join('')}</select>`)}
    ${campo('Descrição', `<input class="fi" id="e-desc">`)}
    ${campo('Conta', `<select class="fi" id="e-conta">${optContas('PF', ['corrente', 'especie'])}</select>`)}
    <div class="nota">Pró-labore não entra aqui: registre em Plano (ou Movimentos PJ) para ficar ligado à saída da PJ.</div>
    ${rodape(`executar(()=>AC.registrarEntradaPF({valor:$v('e-valor'),data:$v('e-data'),categoria:$v('e-cat'),descricao:$v('e-desc'),contaId:$v('e-conta')}),'Entrada registrada')`, 'Registrar')}`);
}

function formTransferencia(ent, origemId, destinoId) {
  ent = ent || UI.ent;
  if (ent === 'PF' && !ST.pfLiberado) return abrirLoginPF();
  const tipos = ['corrente', 'caixinha', 'especie', 'cartao', 'antiga'];
  abrirModal(`<h2>Transferência ${ent}</h2>
    <div class="nota">Mover dinheiro entre conta, caixinhas e cartão não é gasto nem receita.</div>
    <div class="two">${campo('Valor', inValor('t-valor', ''))}${campo('Data', inData('t-data'))}</div>
    ${campo('De', `<select class="fi" id="t-origem">${optContas(ent, tipos, origemId || (FX.contaPadrao(ST.contas, ent, 'corrente') || {}).id)}</select>`)}
    ${campo('Para', `<select class="fi" id="t-destino">${optContas(ent, tipos, destinoId, 'Escolha…')}</select>`)}
    ${campo('Descrição', `<input class="fi" id="t-desc" placeholder="Opcional">`)}
    ${rodape(`executar(()=>AC.transferir({valor:$v('t-valor'),data:$v('t-data'),origemId:$v('t-origem'),destinoId:$v('t-destino'),descricao:$v('t-desc')}),'Transferência registrada')`, 'Registrar')}`);
}

function formFatura(cartaoId) {
  const ent = cartaoId ? stConta(cartaoId).entidade : UI.ent;
  if (ent === 'PF' && !ST.pfLiberado) return abrirLoginPF();
  const ctx = stCtx(UI.mes);
  const cart = cartaoId ? stConta(cartaoId) : FX.contaPadrao(ST.contas, ent, 'cartao');
  if (!cart) return toast('Cadastre um cartão em Ajustes › Contas.', true);
  const aberto = Math.max(0, -FX.saldoConta(cart, ctx.movs, stHoje(), ctx.cfg).saldo);
  const reserva = FX.caixinhaPorFinalidade(ST.contas, ent, 'cartao');
  abrirModal(`<h2>Pagar fatura</h2>
    <div class="nota">As compras já estão registradas como gasto na data da compra. O pagamento da fatura é só uma transferência para o cartão — não soma de novo.</div>
    ${campo('Cartão', `<select class="fi" id="f-cartao">${optContas(ent, ['cartao'], cart.id)}</select>`)}
    <div class="muted sm">Em aberto no sistema: ${brl(aberto)}</div>
    <div class="two">${campo('Valor pago', inValor('f-valor', aberto || ''))}${campo('Data', inData('f-data'))}</div>
    ${campo('Pago com', `<select class="fi" id="f-origem">${optContas(ent, ['corrente', 'caixinha', 'especie'], (reserva && ent === 'PJ' ? reserva.id : (FX.contaPadrao(ST.contas, ent, 'corrente') || {}).id))}</select>`)}
    ${rodape(`executar(()=>AC.pagarFatura({cartaoId:$v('f-cartao'),valor:$v('f-valor'),data:$v('f-data'),origemId:$v('f-origem')}),'Fatura paga')`, 'Registrar pagamento')}`);
}

function formProlaboreAvulso() {
  abrirModal(`<h2>Pró-labore fora do plano</h2>
    <div class="two">${campo('Valor', inValor('pl-valor', ''))}${campo('Data', inData('pl-data'))}</div>
    <div class="nota">Prefira registrar pelo item do plano (dias 01 e 15) para acompanhar previsto × realizado.</div>
    ${rodape(`executar(()=>AC.pagarProlabore(null,{valor:$v('pl-valor'),data:$v('pl-data')}),'Pró-labore registrado')`, 'Registrar')}`);
}

// ── DETALHE DE MOVIMENTAÇÃO (classificar / confirmar) ────
function formMov(key) {
  const m = stMovs().find(x => x.key === key);
  if (!m) return;
  const ent = m.entidade;
  const ehTransf = m.tabela === 'fin_transferencias';
  const ctx = stCtx(FX.mesDe(m.data) || UI.mes);
  const pend = FX.itensDoMes(ST.itens, FX.mesDe(m.data), ctx.movs, ctx.hoje, ctx.cfg).filter(i => i.entidade === ent &&
    ((m.natureza === 'saida' && (i.tipo === 'pagamento' || i.tipo === 'prolabore')) || (m.natureza === 'entrada' && i.tipo === 'receita')));
  const origemTxt = { entries: 'Financeiro PJ · entrada', saidas: 'Financeiro PJ · saída', entradas_pessoal: 'Pessoal · entrada',
    saidas_pessoal: 'Pessoal · saída', fin_transferencias: 'Transferência interna' }[m.tabela];
  let h = `<h2>${esc(m.descricao || m.categoria)}</h2>
    <div class="kv"><span>Valor</span><b>${brl(m.valor)}</b></div>
    <div class="kv"><span>Data</span><b>${dm(m.data)}/${m.data.slice(0, 4)}</b></div>
    <div class="kv"><span>Origem</span><b>${origemTxt}${m.origem && m.origem !== 'financeiro' ? ' · ' + esc(m.origem) : ''}</b></div>
    <div class="kv"><span>Situação</span><b>${m.realizado ? 'realizado' : 'previsto'}${m.conciliado ? ' · conciliado' : ''}</b></div>`;
  if (ehTransf) {
    h += `<div class="kv"><span>De → para</span><b>${esc(m.contaId ? nomeConta(m.contaId) : '—')} → ${esc(m.destinoId ? nomeConta(m.destinoId) : '—')}</b></div>
      <button class="btn ghost neg" onclick="if(confirm('Excluir esta transferência?'))executar(()=>AC.excluirTransferencia('${m.id}'),'Excluída')">Excluir transferência</button>
      <button class="btn ghost" onclick="fecharModal()">Fechar</button>`;
    return abrirModal(h);
  }
  if (m.tabela === 'entries' && !m.realizado)
    h += `<button class="btn" onclick="formConfirmar('${m.id}')">Confirmar recebimento</button>`;
  if (m.pagoPelaPJ) h += `<div class="nota">Despesa pessoal paga pela conta PJ (lançada no Financeiro). Conta como gasto pessoal, mas o dinheiro saiu da PJ.</div>`;
  if (!m.pagoPelaPJ) {
    h += campo('Conta', `<select class="fi" id="mv-conta">${optContas(ent, ['corrente', 'caixinha', 'cartao', 'especie', 'antiga'], m.contaId)}</select>`);
  }
  if (m.natureza === 'saida' && m.classe === 'despesa') {
    const metaCx = (ST.meta[m.key] || {}).caixinhaId;
    h += campo('Reserva (caixinha)' + (m.caixinhaAuto ? ' ' + autoTag() : ''), `<select class="fi" id="mv-cx"><option value="" ${!metaCx ? 'selected' : ''}>Automática${m.caixinhaAuto ? ' (' + esc(nomeConta(m.caixinhaId)) + ')' : ''}</option><option value="-" ${metaCx === '-' ? 'selected' : ''}>Nenhuma — fora do plano</option>${optContas(ent, ['caixinha'], metaCx && metaCx !== '-' ? metaCx : '')}</select>`);
    h += campo('Dívida', `<select class="fi" id="mv-div"><option value="">—</option>${ST.dividas.filter(d => d.entidade === ent).map(d => `<option value="${d.id}" ${d.id === m.dividaId ? 'selected' : ''}>${esc(d.nome)}</option>`).join('')}</select>`);
  }
  if (pend.length || m.planoItemId) {
    const metaIt = (ST.meta[m.key] || {}).planoItemId;
    const auto = m.autoVinculo && stItem(m.planoItemId);
    h += campo('Item do plano' + (auto ? ' ' + autoTag() : ''), `<select class="fi" id="mv-item"><option value="" ${!metaIt ? 'selected' : ''}>Automático${auto ? ' (' + esc(FX.nomeItem(auto)) + ')' : ''}</option><option value="-" ${metaIt === '-' ? 'selected' : ''}>Nenhum</option>${pend.map(i => `<option value="${i.id}" ${i.id === metaIt ? 'selected' : ''}>${dm(i._data)} · ${esc(FX.nomeItem(i))}</option>`).join('')}</select>`);
  }
  h += `<label class="chk"><input type="checkbox" id="mv-conc" ${m.conciliado ? 'checked' : ''}> Conferido no extrato</label>`;
  h += rodape(`acClassificar('${esc(m.key)}')`, 'Salvar',
    m.tabela === 'saidas_pessoal' && m.origem !== 'sincronizado' ? `<button class="btn ghost neg" onclick="acExcluirPF('saida','${m.id}')">Excluir gasto</button>` :
    m.tabela === 'entradas_pessoal' && m.origem !== 'sincronizado' ? `<button class="btn ghost neg" onclick="acExcluirPF('entrada','${m.id}')">Excluir entrada</button>` :
    (m.tabela === 'entries' || m.tabela === 'saidas') ? `<div class="muted sm center">Valor, data e exclusão: editar no <a href="../financeiro/">Financeiro</a>.</div>` : '');
  abrirModal(h);
}
function acClassificar(key) {
  const m = stMovs().find(x => x.key === key);
  const campos = { conciliado: $v('mv-conc') === true };
  if (document.getElementById('mv-conta')) campos.contaId = $v('mv-conta') || null;
  if (document.getElementById('mv-cx')) campos.caixinhaId = $v('mv-cx') || null;
  if (document.getElementById('mv-div')) campos.dividaId = $v('mv-div') || null;
  if (document.getElementById('mv-item')) campos.planoItemId = $v('mv-item') || null;
  executar(() => AC.classificar(m.tabela, m.id, campos), 'Atualizado');
}
function acExcluirPF(tipo, id) { if (confirm('Excluir?')) executar(() => stRemoverPF(tipo, id), 'Excluído'); }

function formConfirmar(entryId) {
  const e = ST.entries.find(x => String(x.id) === String(entryId));
  abrirModal(`<h2>Confirmar recebimento</h2>
    <div class="kv"><span>${esc(e.cliente)} · ${esc(e.tipo)}</span><b>${brl(e.valor)}</b></div>
    <div class="nota">Marca este lançamento previsto como recebido — não cria uma receita nova. Para valor diferente ou parcial, ajuste no Financeiro.</div>
    ${campo('Data em que o dinheiro entrou', inData('cf-data', e.dataPag <= stHoje() ? stHoje() : e.dataPag))}
    ${campo('Conta', `<select class="fi" id="cf-conta">${optContas('PJ', ['corrente', 'especie'], (FX.contaPadrao(ST.contas, 'PJ', 'corrente') || {}).id)}</select>`)}
    ${rodape(`executar(()=>AC.confirmarRecebimento('${e.id}',{data:$v('cf-data'),contaId:$v('cf-conta')}),'Recebimento confirmado')`, 'Confirmar')}`);
}

// ── CONCILIAÇÃO ──────────────────────────────────────────
function formConciliar(contaId) {
  const c = stConta(contaId);
  if (c.entidade === 'PF' && !ST.pfLiberado) return abrirLoginPF();
  const ctx = stCtx(UI.mes);
  const hist = ST.conciliacoes.filter(x => x.contaId === contaId).sort((a, b) => b.data.localeCompare(a.data)).slice(0, 5);
  const primeira = c.saldoInicial == null || !c.dataSaldoInicial;
  abrirModal(`<h2>Conciliar · ${esc(c.nome)}</h2>
    <div class="nota">${primeira ? 'Primeira conferência: o saldo que você informar vira o <b>saldo de abertura</b> da conta. Lançamentos até essa data não mexem mais no saldo.'
      : 'Compare com o app do banco. Se houver diferença, procure lançamentos esquecidos ou registre um ajuste (fica visível como diferença não identificada).'}
      ${c.tipo === 'cartao' ? '<br>Cartão: informe a fatura em aberto como valor <b>negativo</b> (ex.: −850,00).' : ''}</div>
    <div class="two">${campo('Data (saldo ao fim do dia)', `<input class="fi" type="date" id="cc-data" value="${stHoje()}" onchange="ccAtualiza('${contaId}')">`)}
      ${campo('Saldo no banco', `<div class="vwrap"><span>R$</span><input class="fi" id="cc-saldo" inputmode="decimal" oninput="ccAtualiza('${contaId}')" autofocus></div>`)}</div>
    <div id="cc-cmp" class="card sm"></div>
    ${primeira ? rodape(`acConciliar('${contaId}', false)`, 'Definir saldo de abertura')
      : rodape(`acConciliar('${contaId}', false)`, 'Registrar conferência', `<button class="btn sec" onclick="acConciliar('${contaId}', true)">Registrar e lançar ajuste da diferença</button>`)}
    ${hist.length ? `<div class="muted sm" style="margin-top:10px">Últimas conferências</div>${hist.map(x => `<div class="kv sm"><span>${dm(x.data)} · ${x.tipo}</span><b>${brl(x.saldoBanco)}${Math.abs(x.diferenca || 0) > 0.004 ? ` (dif. ${brl(x.diferenca)})` : ''}</b></div>`).join('')}` : ''}`);
  ccAtualiza(contaId);
}
function ccAtualiza(contaId) {
  const c = stConta(contaId), ctx = stCtx(UI.mes);
  const data = $v('cc-data') || stHoje();
  const s = FX.saldoConta(c, ctx.movs, data, ctx.cfg);
  const banco = FX.parseValor($v('cc-saldo'));
  const dif = isNaN(banco) ? null : FX.r2(banco - s.saldo);
  document.getElementById('cc-cmp').innerHTML = `<div class="kv"><span>Saldo calculado pelo sistema</span><b>${brl(s.saldo)}</b></div>
    ${s.conferido ? '' : '<div class="muted sm">Ainda sem saldo de abertura — calculado só com movimentos desde ' + (dm(s.desde) || 'o início') + '.</div>'}
    ${dif == null ? '' : `<div class="kv ${Math.abs(dif) > 0.004 ? 'neg' : 'pos'}"><span>Diferença (banco − sistema)</span><b>${brl(dif)}</b></div>`}`;
}
function acConciliar(contaId, ajustar) {
  executar(() => AC.conciliar(contaId, { data: $v('cc-data'), saldoBanco: $v('cc-saldo'), ajustar }), ajustar ? 'Conciliado com ajuste' : 'Conferência registrada');
}

// ── EXTRATO ──────────────────────────────────────────────
function formExtrato() {
  const ents = ST.pfLiberado ? ['PF', 'PJ'] : ['PJ'];
  abrirModal(`<h2>Importar extrato</h2>
    <div class="nota">O que já foi lançado (pelo fluxo, pelo Financeiro ou pelos Orçamentos) é só <b>conciliado</b>. Recebimento de cliente “Previsto” que aparece no extrato vira “Realizado” — sem criar outra receita. Linhas já importadas são ignoradas.</div>
    ${campo('Conta do extrato', `<select class="fi" id="x-conta">${ents.map(e => `<optgroup label="${e}">${optContas(e, ['corrente', 'cartao', 'caixinha'])}</optgroup>`).join('')}</select>`)}
    ${campo('Arquivo OFX ou CSV', `<input class="fi" type="file" id="x-arq" accept=".ofx,.csv,.txt">`)}
    ${rodape('acLerExtrato()', 'Ler extrato')}`);
}
async function acLerExtrato() {
  const contaId = $v('x-conta'), f = document.getElementById('x-arq').files[0];
  if (!f) return toast('Escolha o arquivo.', true);
  try {
    const r = await ppParseArquivo(f);
    if (!r.transacoes.length) return toast('Nenhuma transação encontrada.', true);
    UI.extrato = { contaId, propostas: AC.prepararExtrato(contaId, r.transacoes),
      info: `${r.banco} · ${dm(r.periodoIni)} a ${dm(r.periodoFim)} · ${r.transacoes.length} linhas` };
    fecharModal(); UI.tab = 'ajustes'; render();
  } catch (e) { toast(e.message || 'Erro ao ler o arquivo', true); }
}
function exDecisao(k, v) { UI.extrato.propostas[k].decisao = v; render(); }
function acAplicarExtrato() {
  const x = UI.extrato;
  const semDestino = x.propostas.filter(p => p.decisao === 'transferencia' && !p.destinoId).length;
  if (semDestino) return toast(`${semDestino} transferência(s) sem conta de destino.`, true);
  executar(async () => { const r = await AC.aplicarExtrato(x.contaId, x.propostas); UI.extrato = null;
    toast(`${r.conciliados} conciliados (${r.confirmados} confirmados) · ${r.criados} novos · ${r.transferencias} transferências`); return r; });
}

// ── CADASTROS ────────────────────────────────────────────
function formConta(id) {
  const c = id ? stConta(id) : { entidade: UI.ent, tipo: 'caixinha', ativa: true };
  abrirModal(`<h2>${id ? 'Conta' : 'Nova conta'}</h2>
    ${campo('Nome', `<input class="fi" id="ct-nome" value="${esc(c.nome || '')}">`)}
    <div class="two">${campo('Entidade', `<select class="fi" id="ct-ent">${['PF', 'PJ'].filter(e => e === 'PJ' || ST.pfLiberado).map(e => `<option ${e === c.entidade ? 'selected' : ''}>${e}</option>`).join('')}</select>`)}
      ${campo('Tipo', `<select class="fi" id="ct-tipo">${[['corrente', 'Conta corrente'], ['caixinha', 'Caixinha'], ['cartao', 'Cartão de crédito'], ['especie', 'Dinheiro em espécie'], ['antiga', 'Conta antiga']].map(([v, l]) => `<option value="${v}" ${v === c.tipo ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}</div>
    <div class="two">${campo('Banco', `<input class="fi" id="ct-banco" value="${esc(c.banco || '')}">`)}
      ${campo('Finalidade (caixinha)', `<select class="fi" id="ct-fin">${['', 'semanada', 'fixas', 'faxineira', 'sazonais', 'dividas', 'cartao', 'cursos', 'reposicao', 'mei', 'outra'].map(f => `<option ${f === (c.finalidade || '') ? 'selected' : ''}>${f}</option>`).join('')}</select>`)}</div>
    <label class="chk"><input type="checkbox" id="ct-padrao" ${c.padrao ? 'checked' : ''}> Conta padrão deste tipo</label>
    <label class="chk"><input type="checkbox" id="ct-ativa" ${c.ativa !== false ? 'checked' : ''}> Ativa</label>
    ${c.saldoInicial != null ? `<div class="muted sm">Saldo de abertura ${brl(c.saldoInicial)} em ${dm(c.dataSaldoInicial)} (alterável só pela conciliação).</div>` : ''}
    ${rodape(`executar(()=>AC.salvarConta({id:${id ? `'${id}'` : 'undefined'},nome:$v('ct-nome'),entidade:$v('ct-ent'),tipo:$v('ct-tipo'),banco:$v('ct-banco'),finalidade:$v('ct-fin'),padrao:$v('ct-padrao'),ativa:$v('ct-ativa')}),'Conta salva')`, 'Salvar')}`);
}

function formDivida(id) {
  const d = id ? ST.dividas.find(x => x.id === id) : { entidade: UI.ent, ativa: true };
  const x = id ? FX.divida(d, stMovs()) : null;
  const n = v => v == null ? '' : valIn(v);
  const hist = id ? ST.dividaSaldos.filter(s => s.dividaId === id).sort((a, b) => b.data.localeCompare(a.data)) : [];
  abrirModal(`<h2>${id ? esc(d.nome) : 'Nova dívida'}</h2>
    ${id ? `<div class="row"><span class="dv-sit ${d.situacao || 'fora_do_plano'}">${{ no_plano: 'no plano', fora_do_plano: 'fora do plano', quitada: 'quitada' }[d.situacao || 'fora_do_plano']}</span>
      <span><button class="lnk sm" onclick="formSaldoDivida('${id}')">Atualizar saldo</button> ·
      ${d.situacao === 'no_plano' ? `<button class="lnk sm" onclick="if(confirm('Tirar do plano? Parcelas já pagas continuam no histórico.'))executar(()=>AC.tirarDividaDoPlano('${id}'),'Dívida fora do plano')">Tirar do plano</button>`
        : `<button class="lnk sm" onclick="formIncluirDivida('${id}')">Incluir no plano</button>`}</span></div>` : ''}
    ${x ? `<div class="card sm"><div class="kv"><span>Pago (registrado)</span><b>${brl(x.totalPago)}</b></div>
      ${x.parcelasRestantesEst != null ? `<div class="kv"><span>Parcelas restantes (estimado)</span><b>${x.parcelasRestantesEst}</b></div>` : ''}
      ${x.emAbertoEstimado != null ? `<div class="kv"><span>Em aberto (estimado)</span><b>${brl(x.emAbertoEstimado)}</b></div>` : ''}</div>` : ''}
    ${campo('Nome', `<input class="fi" id="dv-nome" value="${esc(d.nome || '')}">`)}
    <div class="two">${campo('Entidade', `<select class="fi" id="dv-ent">${['PF', 'PJ'].map(e => `<option ${e === d.entidade ? 'selected' : ''}>${e}</option>`).join('')}</select>`)}
      ${campo('Credor', `<input class="fi" id="dv-cred" value="${esc(d.credor || '')}">`)}</div>
    <div class="two">${campo('Valor p/ quitação', `<input class="fi" id="dv-saldo" inputmode="decimal" value="${n(d.saldoDevedor)}">`)}
      ${campo('Data desse saldo', `<input class="fi" type="date" id="dv-data" value="${d.dataSaldo || ''}">`)}</div>
    <div class="two">${campo('Total parcelado em aberto', `<input class="fi" id="dv-total" inputmode="decimal" value="${n(d.totalEmAberto)}">`)}
      ${campo('Parcelas restantes', `<input class="fi" type="number" id="dv-parc" value="${d.parcelasRestantes ?? ''}">`)}</div>
    <div class="two">${campo('Valor da parcela', `<input class="fi" id="dv-vparc" inputmode="decimal" value="${n(d.valorParcela)}">`)}
      ${campo('Dia de vencimento', `<input class="fi" type="number" min="1" max="31" id="dv-dia" value="${d.diaVencimento ?? ''}">`)}</div>
    <div class="two">${campo('Juros ao mês (%)', `<input class="fi" id="dv-taxa" inputmode="decimal" value="${d.taxaMes != null ? valIn(d.taxaMes * 100) : ''}">`)}
      ${campo('Valor principal', `<input class="fi" id="dv-princ" inputmode="decimal" value="${n(d.valorPrincipal)}">`)}</div>
    ${campo('Observações', `<textarea class="fi" id="dv-obs" rows="2">${esc(d.obs || '')}</textarea>`)}
    <label class="chk"><input type="checkbox" id="dv-ativa" ${d.ativa !== false ? 'checked' : ''}> Ativa (desmarque quando quitar)</label>
    ${rodape(`acSalvarDivida(${id ? `'${id}'` : 'null'})`, 'Salvar')}
    ${x && x.pagamentos.length ? `<div class="muted sm" style="margin-top:10px">Pagamentos ligados</div>${x.pagamentos.map(m => `<div class="kv sm"><span>${dm(m.data)}/${m.data.slice(2, 4)}</span><b>${brl(m.valor)}</b></div>`).join('')}` : ''}
    ${hist.length ? `<div class="muted sm" style="margin-top:10px">Evolução do saldo</div>${hist.map(s => `<div class="kv sm"><span>${dm(s.data)}/${s.data.slice(2, 4)}${s.obs ? ' · ' + esc(s.obs) : ''}</span><b>${brl(s.saldoDevedor)}</b></div>`).join('')}` : ''}`);
}
function acSalvarDivida(id) {
  const nn = k => { const v = FX.parseValor($v(k)); return isNaN(v) ? null : v; };
  const taxa = nn('dv-taxa');
  executar(() => AC.salvarDivida({ id: id || undefined, nome: $v('dv-nome'), entidade: $v('dv-ent'), credor: $v('dv-cred'),
    saldoDevedor: nn('dv-saldo'), dataSaldo: $v('dv-data') || null, totalEmAberto: nn('dv-total'),
    parcelasRestantes: $v('dv-parc') === '' ? null : Number($v('dv-parc')), valorParcela: nn('dv-vparc'),
    diaVencimento: $v('dv-dia') === '' ? null : Number($v('dv-dia')), taxaMes: taxa == null ? null : FX.r2(taxa) / 100,
    valorPrincipal: nn('dv-princ'), obs: $v('dv-obs'), ativa: $v('dv-ativa'),
    situacao: $v('dv-ativa') ? ((ST.dividas.find(x => x.id === id) || {}).situacao || 'fora_do_plano') : 'quitada' }), 'Dívida salva');
}

function formSaldoDivida(id) {
  const d = ST.dividas.find(x => x.id === id);
  abrirModal(`<h2>Atualizar saldo · ${esc(d.nome)}</h2>
    <div class="nota">Use o valor que o banco/credor informa para quitação. Fica no histórico para acompanhar a evolução.</div>
    <div class="two">${campo('Valor para quitação', `<div class="vwrap"><span>R$</span><input class="fi" id="ds-saldo" inputmode="decimal" autofocus></div>`)}${campo('Data', inData('ds-data'))}</div>
    <div class="two">${campo('Total parcelado em aberto', `<input class="fi" id="ds-total" inputmode="decimal" value="${d.totalEmAberto != null ? valIn(d.totalEmAberto) : ''}">`)}${campo('Parcelas restantes', `<input class="fi" type="number" id="ds-parc" value="${d.parcelasRestantes ?? ''}">`)}</div>
    ${campo('Observação', `<input class="fi" id="ds-obs">`)}
    ${rodape(`executar(()=>AC.atualizarSaldoDivida('${id}',{saldoDevedor:$v('ds-saldo'),data:$v('ds-data'),totalEmAberto:$v('ds-total'),parcelasRestantes:$v('ds-parc'),obs:$v('ds-obs')}),'Saldo atualizado')`, 'Salvar')}`);
}
function formIncluirDivida(id) {
  const d = ST.dividas.find(x => x.id === id);
  const prox = FX.addMes(FX.mesDe(stHoje()), 1);
  abrirModal(`<h2>Incluir no plano · ${esc(d.nome)}</h2>
    <div class="nota">Cria no modelo o aporte na caixinha Dívidas e o pagamento da parcela, só durante os meses escolhidos. Os meses já criados a partir de agora recebem os itens automaticamente.</div>
    <div class="two">${campo('Valor por mês', inValor('id-valor', d.valorParcela || ''))}${campo('Dia do pagamento', `<input class="fi" type="number" min="1" max="31" id="id-dia" value="${d.diaVencimento || 15}">`)}</div>
    <div class="two">${campo('Primeiro mês', `<input class="fi" type="month" id="id-ini" value="${prox}">`)}${campo('Quantos meses', `<input class="fi" type="number" min="1" id="id-meses" value="${d.parcelasRestantes || 12}">`)}</div>
    ${rodape(`executar(()=>AC.incluirDividaNoPlano('${id}',{valor:$v('id-valor'),dia:$v('id-dia'),mesInicio:$v('id-ini'),meses:$v('id-meses')}),'Dívida incluída no plano')`, 'Incluir no plano')}`);
}

function formConfig() {
  const cfg = ST.cfg || FX_MODELO.config;
  const cats = e => (cfg.categorias[e] || []).map(c => `${c.nome} | ${c.grupo || ''}`).join('\n');
  abrirModal(`<h2>Semanas, categorias e sazonais</h2>
    <label class="fl">Semanas (dia inicial e final; a última vai até o fim do mês)</label>
    ${cfg.semanas.map((s, k) => `<div class="two"><input class="fi" type="number" id="sw-i${k}" value="${s.ini}" min="1" max="31"><input class="fi" type="number" id="sw-f${k}" value="${s.fim}" min="1" max="31"></div>`).join('')}
    ${campo('Tolerância de datas ao conciliar extrato (dias)', `<input class="fi" type="number" id="cf-tol" value="${cfg.toleranciaDias}">`)}
    ${campo('Categorias PF (uma por linha: Nome | Grupo)', `<textarea class="fi" id="cf-pf" rows="6">${esc(cats('PF'))}</textarea>`)}
    ${campo('Categorias PJ (uma por linha: Nome | Grupo)', `<textarea class="fi" id="cf-pj" rows="6">${esc(cats('PJ'))}</textarea>`)}
    ${campo('Sazonais (uma por linha: Nome | valor anual)', `<textarea class="fi" id="cf-saz" rows="5">${esc((cfg.sazonais || []).map(s => `${s.nome} | ${valIn(s.anual)}`).join('\n'))}</textarea>`)}
    ${rodape('acSalvarConfig()', 'Salvar')}`);
}
function acSalvarConfig() {
  const cfg = JSON.parse(JSON.stringify(ST.cfg || FX_MODELO.config));
  cfg.semanas = cfg.semanas.map((s, k) => ({ n: s.n, ini: Number($v('sw-i' + k)), fim: Number($v('sw-f' + k)) }));
  cfg.toleranciaDias = Number($v('cf-tol')) || 0;
  const linhas = id => $v(id).split('\n').map(l => l.split('|').map(x => x.trim())).filter(p => p[0]);
  cfg.categorias.PF = linhas('cf-pf').map(p => ({ nome: p[0], grupo: p[1] || 'Outras' }));
  cfg.categorias.PJ = linhas('cf-pj').map(p => ({ nome: p[0], grupo: p[1] || 'Outras' }));
  cfg.sazonais = linhas('cf-saz').map(p => ({ nome: p[0], anual: FX.parseValor(p[1] || '0') || 0 }));
  executar(() => AC.salvarConfig(cfg), 'Configurações salvas');
}

async function verLog() {
  abrirModal('<h2>Histórico de alterações</h2><div class="muted">Carregando…</div>');
  try {
    const regs = (await DB.fluxo.list('fin_log')).sort((a, b) => String(b.em).localeCompare(String(a.em))).slice(0, 80);
    document.getElementById('modal-box').innerHTML = `<h2>Histórico de alterações</h2>${regs.map(r => `<div class="kv sm"><span>${esc(String(r.em).slice(0, 16).replace('T', ' '))} · ${esc(r.acao)}</span><b>${esc(r.tabela)}</b></div>`).join('') || vazio('Nada ainda.')}
      <button class="btn ghost" onclick="fecharModal()">Fechar</button>`;
  } catch (e) { toast('Não foi possível carregar o histórico', true); }
}

// ── LOGIN PESSOAL (mesmo usuário do antigo /pessoal/) ─────
function abrirLoginPF() {
  abrirModal(`<h2>Financeiro pessoal</h2><p class="muted sm">Acesso privado — mesmo usuário do antigo módulo Pessoal.</p>
    ${campo('Usuário', `<input class="fi" id="lp-user" autocomplete="username" autocapitalize="off" autofocus>`)}
    ${campo('Senha', `<input class="fi" type="password" id="lp-pass" autocomplete="current-password" onkeydown="if(event.key==='Enter')acLoginPF()">`)}
    <label class="chk"><input type="checkbox" id="lp-lembrar"> Lembrar neste aparelho (30 dias)</label>
    <div id="lp-err" class="neg sm"></div>
    ${rodape('acLoginPF()', 'Entrar')}`);
}
async function acLoginPF() {
  const u = $v('lp-user').trim(), p = $v('lp-pass');
  if (!u || !p) return;
  try {
    const user = await DB.pessoal.auth.login(u, p);
    if (!user) { document.getElementById('lp-err').textContent = 'Usuário ou senha incorretos'; return; }
    const dur = $v('lp-lembrar') ? 30 * 864e5 : 8 * 36e5;
    localStorage.setItem('mk_session_pessoal', JSON.stringify({ id: user.id, usuario: user.usuario, expires: Date.now() + dur }));
    ST.pfLiberado = true;
    fecharModal(); toast('Pessoal liberado');
    await recarregar();
  } catch (e) { document.getElementById('lp-err').textContent = 'Erro de conexão'; }
}
function sairPF() {
  localStorage.removeItem('mk_session_pessoal');
  ST.pfLiberado = false; ST.entradasPF = []; ST.saidasPF = []; stInvalidar();
  UI.ent = 'PJ'; render(); toast('Pessoal bloqueado neste aparelho');
}
