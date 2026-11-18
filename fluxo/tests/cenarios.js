// ════════════════════════════════════════════════════════════
// fluxo/tests/cenarios.js — validação dos cenários do planejamento
// Uso:  node fluxo/tests/cenarios.js
//
// Roda core.js + store.js + acoes.js contra um Supabase FALSO em memória
// (inclui a simulação do trigger saidas → entradas_pessoal). Os valores
// vêm da aba "Acompanhamento mensal" da planilha da consultoria.
// ════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), vm = require('vm');
const raiz = path.join(__dirname, '..', 'scripts');

// Supabase falso em memória (compartilhado com o teste no navegador)
const { criarDB } = require("./fake-db.js");

const store = {};
const ctx = vm.createContext({
  console, Date, Math, JSON, Number, String, Object, Array, Set, Promise, isNaN, Error,
  localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
  DB: criarDB(),
});
['modelo.js', 'core.js', 'store.js', 'acoes.js'].forEach(f =>
  vm.runInContext(fs.readFileSync(path.join(raiz, f), 'utf8').replace(/^if \(typeof module.*$/m, ''), ctx, { filename: f }));
const run = code => vm.runInContext(code, ctx);
const { FX, ST, AC } = { FX: run('FX'), ST: run('ST'), AC: run('AC') };
const DBT = run('DB').T;

// ── mini-asserts ──────────────────────────────────────────
let ok = 0, falhas = 0;
const igual = (nome, obtido, esperado) => {
  const passou = typeof esperado === 'number' ? Math.abs(obtido - esperado) < 0.005 : JSON.stringify(obtido) === JSON.stringify(esperado);
  if (passou) { ok++; console.log(`   ✓ ${nome}: ${JSON.stringify(obtido)}`); }
  else { falhas++; console.log(`   ✗ ${nome}: obtido ${JSON.stringify(obtido)} · esperado ${JSON.stringify(esperado)}`); }
};
const lanca = async (nome, fn) => {
  try { await fn(); falhas++; console.log(`   ✗ ${nome}: deveria ter bloqueado`); }
  catch (e) { ok++; console.log(`   ✓ ${nome}: bloqueado ("${e.message}")`); }
};
const titulo = t => console.log('\n■ ' + t);

const conta = (ent, tipo, fin) => ST.contas.find(c => c.entidade === ent && c.tipo === tipo && (!fin || c.finalidade === fin));
const itemDe = (mes, desc, ent) => ST.itens.find(i => i.mes === mes && i.descricao === desc && (!ent || i.entidade === ent));
const nomeC = id => (ST.contas.find(c => c.id === id) || {}).nome;
const saldo = (c, ate) => FX.saldoConta(c, run('stMovs()'), ate, ST.cfg).saldo;
const ctxM = (mes, hoje) => run(`stCtx(${JSON.stringify(mes)}, ${JSON.stringify(hoje)})`);

(async () => {
  ST.pfLiberado = true; ST.usuario = 'teste'; ST.migracaoOk = true;
  const DEZ = '2026-12';

  titulo('0. Estrutura inicial a partir da planilha');
  const r0 = await AC.configurarInicial(DEZ);
  igual('contas criadas', r0.contas, 19);
  igual('dívidas criadas', r0.dividas, 8);
  igual('nenhuma conta com saldo inventado', ST.contas.filter(c => c.saldoInicial != null).length, 0);
  igual('itens do mês copiados do modelo', ST.itens.filter(i => i.mes === DEZ).length, ST.itens.filter(i => i.mes === 'modelo').length);
  let im = FX.itensDoMes(ST.itens, DEZ, run('stMovs()'), '2026-11-30', ST.cfg);
  let dist = FX.distribuicoesPF(im, run('stMovs()'));
  igual('dia 01: a receber', dist[0].previsto, 2000);
  igual('dia 01: distribuição planejada (S1+fixas+S2)', dist[0].planejado, 1945);
  igual('dia 01: sobra planejada (planilha H15 = 55)', dist[0].sobraPlanejada, 55);
  igual('dia 15: a receber', dist[1].previsto, 2755);
  igual('dia 15: distribuição planejada', dist[1].planejado, 2556);
  igual('dia 15: sobra planejada (planilha "(200)")', dist[1].sobraPlanejada, 199);
  const saidasPJplan = im.filter(i => i.entidade === 'PJ').reduce((t, i) => t + i.valor, 0) - 81; // DAS é pago pela caixinha MEI
  igual('PJ: saídas planejadas no mês (planilha 7.119)', saidasPJplan, 7119);
  igual('nada conta como feito só por estar previsto', im.filter(i => i._status === 'feito').length, 0);
  const sem = FX.semanas('2027-02', ST.cfg);
  igual('fevereiro: semana 4 vai até 28', sem[3].label, '23 a 28');
  igual('dezembro: semana 4 vai até 31', FX.semanas(DEZ, ST.cfg)[3].label, '23 a 31');

  titulo('Conciliação de abertura (saldos reais informados — exemplo)');
  for (const c of ST.contas.filter(c => c.tipo !== 'antiga')) {
    const v = c.entidade === 'PJ' && c.tipo === 'corrente' ? 3000 : 0;
    await AC.conciliar(c.id, { data: '2026-11-30', saldoBanco: String(v) });
  }
  const pfC = conta('PF', 'corrente'), pjC = conta('PJ', 'corrente');
  igual('PF corrente abertura (planilha: saldo início 0)', saldo(pfC, '2026-11-30'), 0);
  igual('PJ corrente abertura', saldo(pjC, '2026-11-30'), 3000);

  titulo('1. Pró-labore dia 01 + distribuição');
  const pro1 = itemDe(DEZ, 'Pró-labore — 1ª parcela');
  await AC.pagarProlabore(pro1.id, { valor: 2000, data: '2026-12-01' });
  igual('saída PJ criada como pró-labore', DBT.saidas.filter(s => s.tipo === 'Pró-labore').length, 1);
  igual('entrada PF vinculada (uma só, mesmo com trigger)', DBT.entradas_pessoal.filter(e => e.categoria === 'Pró-labore').length, 1);
  igual('PJ corrente após pró-labore', saldo(pjC, '2026-12-01'), 1000);
  igual('PF corrente após receber', saldo(pfC, '2026-12-01'), 2000);
  im = FX.itensDoMes(ST.itens, DEZ, run('stMovs()'), '2026-12-01', ST.cfg);
  dist = FX.distribuicoesPF(im, run('stMovs()'));
  igual('recebido real dia 01', dist[0].recebido, 2000);
  igual('falta distribuir antes dos aportes', dist[0].faltaDistribuir, 1945);
  await AC.executarAporte(itemDe(DEZ, 'Semanada — semana 1', 'PF').id, { valor: 350, data: '2026-12-01' });
  await AC.executarAporte(itemDe(DEZ, 'Despesas fixas', 'PF').id, { valor: 1245, data: '2026-12-01' });
  igual('PF corrente fim semana 1 (planilha D15 = 405)', saldo(pfC, '2026-12-08'), 405);
  let rPF = FX.resumo('PF', ctxM(DEZ, '2026-12-01'));
  igual('reservado PF', rPF.reservado, 1595);
  igual('gastos PF (aporte não é despesa)', rPF.gastos, 0);
  dist = FX.distribuicoesPF(FX.itensDoMes(ST.itens, DEZ, run('stMovs()'), '2026-12-01', ST.cfg), run('stMovs()'));
  igual('falta distribuir do dia 01 (só a semanada S2)', dist[0].faltaDistribuir, 350);
  await AC.executarAporte(itemDe(DEZ, 'Semanada — semana 2', 'PF').id, { valor: 350, data: '2026-12-09' });
  igual('PF corrente fim semana 2 (planilha H15 = 55)', saldo(pfC, '2026-12-15') , 55);

  titulo('3. Semanada PF de R$ 350 + gastos reais (semana 1)');
  const pfSem = conta('PF', 'caixinha', 'semanada');
  await AC.registrarGasto({ entidade: 'PF', valor: 120, data: '2026-12-02', contaId: pfSem.id, categoria: 'Mercado', descricao: 'Mercado' });
  await AC.registrarGasto({ entidade: 'PF', valor: 80, data: '2026-12-04', contaId: pfC.id, caixinhaId: pfSem.id, categoria: 'Delivery', descricao: 'iFood' });
  await AC.registrarGasto({ entidade: 'PF', valor: 60, data: '2026-12-06', contaId: pfSem.id, categoria: 'Transporte', descricao: 'Uber' });
  let sm = FX.semanadas('PF', ctxM(DEZ, '2026-12-09'));
  igual('S1 reservado', sm.linhas[0].reservado, 350);
  igual('S1 gasto', sm.linhas[0].gasto, 260);
  igual('S1 saldo', sm.linhas[0].saldo, 90);
  const cat = sm.linhas[0].porCategoria;
  igual('S1 por categoria', [cat.Mercado, cat.Delivery, cat.Transporte], [120, 80, 60]);
  igual('gasto pago pela corrente com dinheiro da caixinha não mexe na corrente', saldo(pfC, '2026-12-08'), 405);
  igual('caixinha semanada após S1', saldo(pfSem, '2026-12-08'), 90);

  titulo('4. Semanada PJ de R$ 250 — deslocamento e alimentação');
  const pjSem = conta('PJ', 'caixinha', 'semanada');
  await AC.executarAporte(itemDe(DEZ, 'Semanada — semana 1', 'PJ').id, { valor: 250, data: '2026-12-01' });
  DBT.entries.push({ id: 'e1', dataPag: '2026-12-03', dataServ: '2026-12-03', cliente: 'Ana', tipo: 'Pagamento', valor: '400', status: 'Realizado', origem: 'Produção Social' });
  DBT.entries.push({ id: 'e2', dataPag: '2026-12-05', dataServ: '2026-12-05', cliente: 'Bia', tipo: 'Pagamento', valor: '500', status: 'Realizado', origem: 'Produção Social' });
  ST.entries = await run('DB').entries.list(); run('stInvalidar()');
  await AC.registrarGasto({ entidade: 'PJ', valor: 45, data: '2026-12-03', contaId: pjSem.id, categoria: 'Deslocamento', descricao: 'Uber ida' });
  await AC.registrarGasto({ entidade: 'PJ', valor: 38, data: '2026-12-03', contaId: pjSem.id, categoria: 'Alimentação trabalho', descricao: 'Almoço' });
  await AC.registrarGasto({ entidade: 'PJ', valor: 52, data: '2026-12-05', contaId: pjSem.id, categoria: 'Deslocamento', descricao: 'Uber' });
  sm = FX.semanadas('PJ', ctxM(DEZ, '2026-12-09'));
  const s1 = sm.linhas[0];
  igual('PJ S1 reservado', s1.reservado, 250);
  igual('PJ S1 deslocamento', s1.porCategoria['Deslocamento'], 97);
  igual('PJ S1 alimentação', s1.porCategoria['Alimentação trabalho'], 38);
  igual('PJ S1 saldo restante', s1.saldo, 115);
  igual('PJ S1 orçamento − gasto', s1.diferenca, 115);
  igual('PJ S1 atendimentos na semana', s1.atendimentos, 2);
  igual('PJ S1 custo por atendimento', s1.custoPorAtendimento, 67.5);
  igual('saída PJ gravada no Financeiro como Pago', DBT.saidas.filter(s => s.tipo === 'Deslocamento' && s.status === 'Pago').length, 2);

  titulo('5. Pagamento de cliente (Orçamentos) identificado no extrato');
  DBT.entries.push({ id: 'o1s', dataPag: '2026-11-28', dataServ: '2026-12-12', cliente: 'Carla', tipo: 'Sinal', valor: '150', status: 'Realizado', origem: 'Noiva' });
  DBT.entries.push({ id: 'o1r', dataPag: '2026-12-12', dataServ: '2026-12-12', cliente: 'Carla', tipo: 'Pagamento', valor: '350', status: 'Previsto', origem: 'Noiva', auto: true });
  ST.entries = await run('DB').entries.list(); run('stInvalidar()');
  let rm = FX.receitaMaquiagem(ctxM(DEZ, '2026-12-10'));
  igual('serviços de dez: contratado', rm.servico.contratado, 1400);
  igual('serviços de dez: recebido', rm.servico.recebido, 1050);
  igual('serviços de dez: pendente', rm.servico.pendente, 350);
  igual('caixa de dez: a receber', rm.caixa.aReceber, 350);
  const pjAntes = saldo(pjC, '2026-12-31');
  const nEntries = DBT.entries.length;
  const extrato = [{ data: '2026-12-13', descricao: 'PIX RECEBIDO CARLA S', valor: 350 }];
  let prop = AC.prepararExtrato(pjC.id, extrato);
  igual('extrato casou com o restante previsto', prop[0].acao + ':' + prop[0].match.id, 'conciliar:o1r');
  igual('vai virar Realizado (não nova receita)', prop[0].viraRealizado, true);
  await AC.aplicarExtrato(pjC.id, prop);
  igual('nenhuma receita nova criada', DBT.entries.length, nEntries);
  igual('restante agora Realizado na data do extrato', DBT.entries.find(e => e.id === 'o1r').status + ' ' + DBT.entries.find(e => e.id === 'o1r').dataPag, 'Realizado 2026-12-13');
  igual('PJ corrente subiu uma vez só', saldo(pjC, '2026-12-31') - pjAntes, 350);
  prop = AC.prepararExtrato(pjC.id, extrato);
  igual('reimportar o mesmo extrato = duplicada', prop[0].acao, 'duplicada');

  titulo('2. Pró-labore dia 15 + distribuição');
  await AC.pagarProlabore(itemDe(DEZ, 'Pró-labore — 2ª parcela').id, { valor: 2755, data: '2026-12-15' });
  for (const [d, dt] of [['Faxineira', '2026-12-15'], ['Sazonais', '2026-12-15'], ['Dívidas — Pole Dance', '2026-12-15'], ['Semanada — semana 3', '2026-12-16']]) {
    const it = itemDe(DEZ, d, 'PF'); await AC.executarAporte(it.id, { valor: it.valor, data: dt });
  }
  igual('PF corrente fim semana 3 (planilha D28 = 604)', saldo(pfC, '2026-12-22'), 604);
  await AC.executarAporte(itemDe(DEZ, 'Semanada — semana 4', 'PF').id, { valor: 350, data: '2026-12-23' });
  igual('PF corrente fim do mês (planilha H28 = 254)', saldo(pfC, '2026-12-31'), 254);
  dist = FX.distribuicoesPF(FX.itensDoMes(ST.itens, DEZ, run('stMovs()'), '2026-12-23', ST.cfg), run('stMovs()'));
  igual('dia 15: tudo distribuído', dist[1].faltaDistribuir, 0);
  igual('dia 15: sobra real', dist[1].sobraReal, 199);

  titulo('6. Transferência para caixinha não é despesa');
  const gastosAntes = FX.resumo('PF', ctxM(DEZ, '2026-12-31')).gastos;
  const pfSaz = conta('PF', 'caixinha', 'sazonais');
  await AC.transferir({ valor: 100, data: '2026-12-24', origemId: pfC.id, destinoId: pfSaz.id, descricao: 'Reforço sazonais' });
  igual('gastos PF inalterados', FX.resumo('PF', ctxM(DEZ, '2026-12-31')).gastos, gastosAntes);
  igual('corrente −100', saldo(pfC, '2026-12-31'), 154);
  igual('sazonais +100', saldo(pfSaz, '2026-12-31'), 1345);

  titulo('7. Pagar conta com dinheiro reservado (Luz pela caixinha Despesas fixas)');
  const pfFix = conta('PF', 'caixinha', 'fixas');
  await AC.pagarItem(itemDe(DEZ, 'Luz', 'PF').id, { valor: 262.40, data: '2026-12-10', contaId: pfC.id });
  const comp = FX.composicao(pfFix, ctxM(DEZ, '2026-12-31'));
  const luz = comp.find(c => c.descricao === 'Luz');
  igual('Luz previsto', luz.previsto, 250);
  igual('Luz pago', luz.pago, 262.40);
  igual('Luz diferença', luz.diferenca, 12.40);
  igual('Luz data do pagamento', luz.dataPagamento, '2026-12-10');
  igual('Luz status', luz.status, 'feito');
  igual('caixinha despesas fixas', saldo(pfFix, '2026-12-31'), 982.60);
  igual('corrente PF não muda (resgate automático)', saldo(pfC, '2026-12-31'), 154);
  igual('Gás ainda pendente e atrasado em 12/12', comp.find(c => c.descricao === 'Gás').status, 'atrasado');

  titulo('9. Fatura de cartão sem duplicar a despesa');
  const pfCart = conta('PF', 'cartao');
  await AC.registrarGasto({ entidade: 'PF', valor: 300, data: '2026-12-12', contaId: pfCart.id, caixinhaId: pfSaz.id, categoria: 'Roupas', descricao: 'Loja' });
  const g1 = FX.resumo('PF', ctxM(DEZ, '2026-12-31'));
  igual('fatura aberta', g1.faturaAberta, 300);
  await AC.pagarFatura({ cartaoId: pfCart.id, origemId: pfSaz.id, valor: 300, data: '2026-12-20' });
  const g2 = FX.resumo('PF', ctxM(DEZ, '2026-12-31'));
  igual('gastos iguais antes/depois de pagar a fatura', g2.gastos, g1.gastos);
  igual('fatura zerada', g2.faturaAberta, 0);
  igual('sazonais pagou a fatura', saldo(pfSaz, '2026-12-31'), 1045);

  titulo('10. Conciliação com o saldo real');
  const sis = saldo(pfC, '2026-12-31');
  let cc = await AC.conciliar(pfC.id, { data: '2026-12-31', saldoBanco: (sis - 15.5).toFixed(2).replace('.', ',') });
  igual('diferença detectada (ex.: tarifa não lançada)', cc.diferenca, -15.5);
  igual('conferência sem ajuste não muda saldo', saldo(pfC, '2026-12-31'), sis);
  cc = await AC.conciliar(pfC.id, { data: '2026-12-31', saldoBanco: String(sis - 15.5), ajustar: true, obs: 'tarifa' });
  igual('após ajuste, sistema = banco', saldo(pfC, '2026-12-31'), sis - 15.5);
  igual('ajuste não vira gasto', FX.resumo('PF', ctxM(DEZ, '2026-12-31')).gastos, g2.gastos);

  titulo('8. Mês seguinte com valores diferentes sem mudar o histórico');
  await AC.criarMes('2027-01', 'anterior');
  const jan = itemDe('2027-01', 'Semanada — semana 1', 'PF');
  await AC.salvarItem(Object.assign({}, jan, { valor: 300 }));
  igual('janeiro: semanada S1 = 300', itemDe('2027-01', 'Semanada — semana 1', 'PF').valor, 300);
  igual('dezembro continua 350', itemDe(DEZ, 'Semanada — semana 1', 'PF').valor, 350);
  igual('dezembro S1 continua feita', FX.itensDoMes(ST.itens, DEZ, run('stMovs()'), '2027-01-02', ST.cfg)
    .find(i => i.descricao === 'Semanada — semana 1' && i.entidade === 'PF')._status, 'feito');
  igual('janeiro começa sem nada realizado', FX.itensDoMes(ST.itens, '2027-01', run('stMovs()'), '2027-01-02', ST.cfg).filter(i => i._realizado > 0).length, 0);
  igual('saldos de caixinha passam para janeiro', saldo(pfFix, '2027-01-01'), 982.60);
  await AC.fecharMes(DEZ);
  await lanca('editar dezembro fechado', () => AC.salvarItem(Object.assign({}, itemDe(DEZ, 'Gás', 'PF'), { valor: 999 })));
  await lanca('excluir item com movimentação', async () => { await AC.reabrirMes(DEZ); await AC.removerItem(itemDe(DEZ, 'Luz', 'PF').id); });
  await AC.reprogramarItem(itemDe(DEZ, 'Gás', 'PF').id, {});
  igual('Gás pendente reprogramado p/ janeiro (avulso)', ST.itens.filter(i => i.mes === '2027-01' && /Gás \(reprogramado/.test(i.descricao)).length, 1);
  igual('Gás de dezembro não aparece mais como pendente', FX.itensDoMes(ST.itens, DEZ, run('stMovs()'), '2027-01-02', ST.cfg).find(i => i.descricao === 'Gás')._status, 'reprogramado');

  titulo('11. Consultoria: 5 parcelas de R$ 350 pela caixinha Sazonais (1/5 foi no mês antes do fluxo)');
  const consDez = ST.itens.find(i => i.mes === DEZ && i.descricao === 'Consultoria financeira');
  igual('1º mês do fluxo = parcela 2/5 (a 1/5 foi antes)', FX.nomeItem(consDez), 'Consultoria financeira (2/5)');
  igual('paga pela caixinha Sazonais', nomeC(consDez.caixinhaId), 'Sazonais');
  igual('janeiro = parcela 3/5', FX.nomeItem(ST.itens.find(i => i.mes === '2027-01' && i.descricao === 'Consultoria financeira')), 'Consultoria financeira (3/5)');
  const modelo = ST.itens.filter(i => i.mes === 'modelo');
  igual('março/27 ainda tem parcela (5/5)', FX.copiarItens(modelo, '2027-03', 'x', () => 'y').some(i => i.descricao === 'Consultoria financeira'), true);
  igual('abril/27 não tem mais parcela', FX.copiarItens(modelo, '2027-04', 'x', () => 'y').some(i => i.descricao === 'Consultoria financeira'), false);
  igual('Pole Dance some do plano depois de dez/26', ST.itens.filter(i => i.mes === '2027-01' && i.dividaId).length, 0);
  igual('não entra na distribuição do pró-labore (é paga pela reserva)',
    FX.distribuicoesPF(FX.itensDoMes(ST.itens, DEZ, run('stMovs()'), '2026-12-31', ST.cfg), run('stMovs()'))[1].planejado, 2556);

  titulo('12. Automático: plano do mês, fechamento e vínculos');
  let auto = await AC.garantirMeses('2027-01-21');
  igual('dia 21: cria fevereiro sozinho', auto.filter(f => f.acao === 'criado').map(f => f.mes), ['2027-02']);
  igual('fevereiro veio do modelo (consultoria 4/5)', FX.nomeItem(ST.itens.find(i => i.mes === '2027-02' && i.descricao === 'Consultoria financeira')), 'Consultoria financeira (4/5)');
  auto = await AC.garantirMeses('2027-03-02');
  igual('março criado, janeiro fechado sozinho', [auto.filter(f => f.acao === 'criado').map(f => f.mes).join(), run('stPlano("2027-01").status')], ['2027-03', 'fechado']);
  igual('dezembro reaberto à mão não fecha sozinho', run('stPlano("2026-12").status'), 'aberto');
  await AC.reabrirMes('2027-01');

  // gasto lançado só com a categoria → liga ao item e usa a caixinha certa
  const fixJanAntes = saldo(pfFix, '2027-01-31');
  const corrJanAntes = saldo(pfC, '2027-01-31');
  const rT = await AC.registrarGasto({ entidade: 'PF', valor: 65, data: '2027-01-07', contaId: pfC.id, categoria: 'Telefone', descricao: 'Vivo' });
  const telJan = ST.itens.find(i => i.mes === '2027-01' && i.descricao === 'Telefone');
  igual('Telefone ligado ao item do plano sozinho', rT.planoItemId, telJan.id);
  igual('caixinha deduzida: Despesas fixas', nomeC(rT.caixinhaId), 'Despesas fixas');
  igual('resgate automático da caixinha (corrente intacta)', saldo(pfC, '2027-01-31'), corrJanAntes);
  igual('caixinha Despesas fixas −65', saldo(pfFix, '2027-01-31'), fixJanAntes - 65);
  igual('item Telefone de janeiro feito', FX.itensDoMes(ST.itens, '2027-01', run('stMovs()'), '2027-01-08', ST.cfg).find(i => i.id === telJan.id)._status, 'feito');

  // lançamentos feitos fora do fluxo (Financeiro) também são reconhecidos
  DBT.saidas.push({ id: 'fin-das', dataPag: '2026-12-20', tipo: 'DAS', valor: '81', forma: 'PIX', status: 'Pago', natureza: 'PROFISSIONAL' });
  DBT.saidas.push({ id: 'fin-pro', dataPag: '2027-01-02', tipo: 'Pessoal', valor: '2000', forma: 'Transferência', status: 'Pago', natureza: 'PESSOAL', transferenciaParaMim: true });
  ST.saidas = await run('DB').saidas.list(); run('stInvalidar()');
  const imDez = FX.itensDoMes(ST.itens, DEZ, run('stMovs()'), '2026-12-31', ST.cfg);
  igual('DAS lançado no Financeiro → item "DAS MEI" feito', imDez.find(i => i.descricao === 'DAS MEI')._status, 'feito');
  igual('…e atribuído à caixinha MEI', nomeC(run('stMovs()').find(m => m.id === 'fin-das').caixinhaId), 'MEI');
  const imJan = FX.itensDoMes(ST.itens, '2027-01', run('stMovs()'), '2027-01-03', ST.cfg);
  igual('pró-labore lançado no Financeiro → item do dia 01 feito', imJan.find(i => i.tipo === 'prolabore' && i.dia === 1)._status, 'feito');
  igual('gastos antigos (antes do fluxo) não são reclassificados',
    run('stMovs()').filter(m => m.data < ST.cfg.inicioFluxo && m.caixinhaAuto).length, 0);

  // aportes de uma vez, como planejado
  const n = await AC.executarComoPlanejado(imJan.filter(i => i.tipo === 'aporte' && i.entidade === 'PF').map(i => i.id), '2027-01-09');
  igual('3 aportes PF de janeiro até o dia 09 registrados', n, 3);
  igual('e só eles (dia 15 em diante continuam pendentes)', FX.itensDoMes(ST.itens, '2027-01', run('stMovs()'), '2027-01-09', ST.cfg)
    .filter(i => i.tipo === 'aporte' && i.entidade === 'PF' && FX.PENDENTE(i._status)).length, 4);

  titulo('13. Extrato preenchido sozinho (plano, palavras e regras aprendidas)');
  const linhas = [
    { data: '2027-01-12', descricao: 'PIX ENVIADO ENEL DISTRIBUICAO SP', valor: -255.30 },
    { data: '2027-01-15', descricao: 'PIX RECEBIDO CAROL NUNES MEI', valor: 2755 },
    { data: '2027-01-16', descricao: 'APLICACAO MEU PORQUINHO', valor: -350 },
    { data: '2027-01-18', descricao: 'COMPRA CARTAO DEBITO PETZ', valor: -89.90 },
  ];
  let px = AC.prepararExtrato(pfC.id, linhas);
  igual('Enel → Luz (pela descrição) + caixinha Despesas fixas', [px[0].decisao, px[0].categoria, nomeC(px[0].caixinhaId), px[0].auto], ['gasto', 'Luz', 'Despesas fixas', 'palavra']);
  igual('crédito de 2.755 "CAROL NUNES" → pró-labore (pelo nome) ligado à parcela do dia 15', [px[1].decisao, px[1].auto, (ST.itens.find(i => i.id === px[1].planoItemId) || {}).dia], ['prolabore', 'palavra', 15]);
  igual('porquinho 350 → aporte da semanada S3', [px[2].decisao, nomeC(px[2].destinoId), px[2].auto], ['transferencia', 'Semanada', 'plano']);
  igual('Petz → Gatos → Semanada', [px[3].categoria, nomeC(px[3].caixinhaId)], ['Gatos', 'Semanada']);
  const nSaidasPJ = DBT.saidas.length;
  await AC.aplicarExtrato(pfC.id, px);
  const imJan2 = FX.itensDoMes(ST.itens, '2027-01', run('stMovs()'), '2027-01-20', ST.cfg);
  igual('pró-labore criou a saída PJ vinculada (1 só)', DBT.saidas.length - nSaidasPJ, 1);
  igual('item pró-labore dia 15 feito', imJan2.find(i => i.tipo === 'prolabore' && i.dia === 15)._status, 'feito');
  igual('Luz de janeiro feita (pago 255,30 · +5,30)', [imJan2.find(i => i.descricao === 'Luz')._status, imJan2.find(i => i.descricao === 'Luz')._excedente], ['feito', 5.3]);
  igual('semanada S3 de janeiro feita', imJan2.find(i => i.descricao === 'Semanada — semana 3' && i.entidade === 'PF')._status, 'feito');
  igual('regras aprendidas', (ST.cfg.regrasExtrato.PF || []).length >= 2, true);
  px = AC.prepararExtrato(pfC.id, [{ data: '2027-02-12', descricao: 'PIX ENVIADO ENEL DISTRIBUICAO SP', valor: -240.10 }]);
  igual('fevereiro: mesma descrição já vem pela regra aprendida', [px[0].auto, px[0].categoria], ['regra', 'Luz']);

  titulo('14. Módulo Dívidas');
  const nub = ST.dividas.find(d => d.nome === 'Empréstimo pessoal Nubank');
  let rd = FX.resumoDividas(ST.dividas, run('stMovs()'), ['PF', 'PJ']);
  igual('dívidas fora do plano', rd.fora.length, 7);
  igual('no plano (Pole Dance)', rd.plano.map(x => x.divida.nome), ['Pole Dance']);
  igual('parcelas/mês fora do plano (planilha mostra 3.367,14: a célula K4 está como texto e o SUM a ignora)', rd.parcelasForaPlano, 4222.54);
  await AC.atualizarSaldoDivida(nub.id, { data: '2027-01-20', saldoDevedor: '15.800,00', parcelasRestantes: '22', obs: 'app Nubank' });
  igual('saldo atualizado + histórico', [ST.dividas.find(d => d.id === nub.id).saldoDevedor, ST.dividaSaldos.filter(x => x.dividaId === nub.id).length], [15800, 1]);
  await AC.incluirDividaNoPlano(nub.id, { valor: '980,93', dia: 10, mesInicio: '2027-02', meses: 3 });
  igual('situação no plano', ST.dividas.find(d => d.id === nub.id).situacao, 'no_plano');
  igual('fevereiro (já criado) recebeu aporte + pagamento', ST.itens.filter(i => i.mes === '2027-02' && i.dividaId === nub.id).map(i => i.tipo).sort(), ['aporte', 'pagamento']);
  igual('março também', ST.itens.filter(i => i.mes === '2027-03' && i.dividaId === nub.id).length, 2);
  igual('maio não (vigência de 3 meses)', FX.copiarItens(ST.itens.filter(i => i.mes === 'modelo'), '2027-05', 'x', () => 'y').some(i => i.dividaId === nub.id), false);
  igual('parcela 2/3 em março', FX.nomeItem(ST.itens.find(i => i.mes === '2027-03' && i.dividaId === nub.id && i.tipo === 'pagamento')), 'Empréstimo pessoal Nubank — parcela (2/3)');
  await AC.registrarGasto({ entidade: 'PF', valor: 980.93, data: '2027-02-10', contaId: pfC.id, categoria: 'Dívidas', descricao: 'Parcela Nubank' });
  igual('pagamento com categoria Dívidas cai na parcela e abate a dívida', FX.divida(ST.dividas.find(d => d.id === nub.id), run('stMovs()')).parcelasRestantesEst, 21);
  await AC.tirarDividaDoPlano(nub.id);
  igual('tirar do plano: parcela de março dispensada, a paga fica', [
    ST.itens.find(i => i.mes === '2027-03' && i.dividaId === nub.id && i.tipo === 'pagamento').dispensado,
    FX.divida(ST.dividas.find(d => d.id === nub.id), run('stMovs()')).totalPago], [true, 980.93]);
  const sim = FX.simularDividas(rd.fora.map(x => x.divida), 3000, 'juros', '2027-03');
  igual('simulação quita tudo com R$ 3.000/mês', sim.insuficiente, false);
  igual('maior juros primeiro: parcelamento de fatura antes do Nubank', sim.lista.find(x => /fatura PF/.test(x.divida.nome)).quitaEm <= sim.lista.find(x => /Nubank/.test(x.divida.nome)).quitaEm, true);

  titulo('15. Categorias por conta + gasto pessoal pago pela PJ');
  const catPJ = ST.cfg.categorias.PJ.map(c => c.nome);
  igual('PJ só com RAIO X PJ', catPJ.includes('Assistente') || catPJ.includes('Mercado'), false);
  igual('PJ tem Deslocamento, Reposição, DAS', ['Deslocamento', 'Reposição', 'Investimentos', 'DAS'].every(c => catPJ.includes(c)), true);
  const cfgV1 = { versao: 1, categorias: { PJ: [{ nome: 'Assistente', grupo: 'Operação' }, { nome: 'Uniforme', grupo: 'Minhas' }], PF: [] } };
  run('stAtualizarCfg')(cfgV1);
  igual('config antiga atualizada mantendo a categoria criada por você', [cfgV1.versao, cfgV1.categorias.PJ.some(c => c.nome === 'Assistente'), cfgV1.categorias.PJ.some(c => c.nome === 'Uniforme')], [6, false, true]);
  const gastosPJantes = FX.resumo('PJ', ctxM('2027-01', '2027-01-31')).gastos;
  const gastosPFantes = FX.resumo('PF', ctxM('2027-01', '2027-01-31')).gastos;
  const pjAntesP = saldo(pjC, '2027-01-31');
  let pp = AC.prepararExtrato(pjC.id, [{ data: '2027-01-20', descricao: 'COMPRA SUPERMERCADO DIA', valor: -132.40 }]);
  pp[0].decisao = 'pessoal'; pp[0].categoria = 'Mercado';
  await AC.aplicarExtrato(pjC.id, pp);
  const sp = DBT.saidas.find(s => s.obs === 'COMPRA SUPERMERCADO DIA');
  igual('saída PJ natureza Pessoal', [sp.natureza, sp.tipo], ['PESSOAL', 'Pessoal']);
  igual('virou gasto PF na categoria Mercado (1 só)', DBT.saidas_pessoal.filter(x => x.saidaOrigemId === sp.id).map(x => x.categoria), ['Mercado']);
  igual('não conta como despesa da empresa', FX.resumo('PJ', ctxM('2027-01', '2027-01-31')).gastos, gastosPJantes);
  igual('conta como gasto pessoal', FX.r2(FX.resumo('PF', ctxM('2027-01', '2027-01-31')).gastos - gastosPFantes), 132.4);
  igual('saiu da conta PJ', FX.r2(pjAntesP - saldo(pjC, '2027-01-31')), 132.4);
  igual('não mexe na conta PF', run('stMovs()').find(m => m.tabela === 'saidas_pessoal' && m.saidaOrigemId === sp.id).afetaSaldo, false);
  pp = AC.prepararExtrato(pjC.id, [{ data: '2027-02-03', descricao: 'COMPRA SUPERMERCADO DIA', valor: -98 }]);
  igual('próxima vez já vem como pessoal/Mercado (regra aprendida)', [pp[0].decisao, pp[0].categoria], ['pessoal', 'Mercado']);

  titulo('16. Pix da PJ para mim = pró-labore (pago solto)');
  run('stAtualizarCfg')(ST.cfg);
  const pixMim = d => [{ data: d, descricao: 'Pix enviado: "00019 569248515 CAROLINE NUNES"', valor: -250 }];
  let pm = AC.prepararExtrato(pjC.id, pixMim('2027-02-05'));
  const proFev1 = ST.itens.find(i => i.mes === '2027-02' && i.tipo === 'prolabore' && i.dia === 1);
  igual('reconhecido como pró-labore (não semanada)', [pm[0].decisao, pm[0].planoItemId], ['prolabore', proFev1.id]);
  await AC.aplicarExtrato(pjC.id, pm);
  let imF = FX.itensDoMes(ST.itens, '2027-02', run('stMovs()'), '2027-02-06', ST.cfg);
  igual('soma na parcela do dia 01 (parcial)', [imF.find(i => i.id === proFev1.id)._realizado, imF.find(i => i.id === proFev1.id)._status], [250, 'parcial-atrasado']);
  igual('entrou na PF como pró-labore', DBT.entradas_pessoal.filter(e => e.categoria === 'Pró-labore' && e.data === '2027-02-05').length, 1);
  igual('semanada S3 PJ de fevereiro continua pendente', imF.find(i => i.entidade === 'PJ' && i.descricao === 'Semanada — semana 3')._realizado, 0);
  // revisão: linha que veio como aporte (mesmo valor) e foi trocada para pró-labore
  const semFev3 = ST.itens.find(i => i.mes === '2027-02' && i.entidade === 'PJ' && i.descricao === 'Semanada — semana 3');
  pm = AC.prepararExtrato(pjC.id, [{ data: '2027-02-09', descricao: 'Pix enviado: "00019 569248515 CAROLINE NUNES"', valor: -250 }]);
  Object.assign(pm[0], { decisao: 'prolabore', planoItemId: semFev3.id });
  await AC.aplicarExtrato(pjC.id, pm);
  imF = FX.itensDoMes(ST.itens, '2027-02', run('stMovs()'), '2027-02-10', ST.cfg);
  const pro09 = run('stMovs()').find(m => m.tabela === 'saidas' && m.data === '2027-02-09' && m.classe === 'prolabore');
  igual('pró-labore nunca fica ligado a aporte da semanada', [pro09.planoItemId, imF.find(i => i.id === semFev3.id)._realizado], [proFev1.id, 0]);
  pm = AC.prepararExtrato(pjC.id, pixMim('2027-01-28'));
  igual('mês já completo → pró-labore fora do plano', [pm[0].decisao, pm[0].planoItemId], ['prolabore', '']);
  await AC.aplicarExtrato(pjC.id, pm);
  const extra = DBT.saidas.find(s => s.tipo === 'Pró-labore' && s.dataPag === '2027-01-28');
  igual('extra não é ligado a nenhum item', run('stMovs()').find(m => m.id === extra.id).planoItemId, null);
  igual('extra não é despesa da empresa', run('stMovs()').find(m => m.id === extra.id).classe, 'prolabore');

  titulo('17. Reposição ≠ Investimentos');
  const cats17 = ST.cfg.categorias.PJ.map(c => c.nome);
  igual('sem a categoria combinada antiga', cats17.includes('Reposição/Investimento de material') || cats17.includes('Equipamentos'), false);
  igual('Reposição → caixinha Reposição', nomeC((FX.caixinhaDaCategoria(ST.contas, 'PJ', 'Reposição', ST.cfg) || {}).id), 'Reposição');
  igual('Investimentos → caixinha Cursos e investimentos', nomeC((FX.caixinhaDaCategoria(ST.contas, 'PJ', 'Investimentos', ST.cfg) || {}).id), 'Cursos e investimentos');
  const cfgV3 = { versao: 3, categorias: { PJ: [{ nome: 'Reposição/Investimento de material', grupo: 'Reposição' }, { nome: 'Equipamentos', grupo: 'Cursos e investimentos' }] },
    palavrasCategoria: { PJ: [['sephora', 'Reposição/Investimento de material']] }, regrasExtrato: { PJ: [{ chave: 'x', categoria: 'Equipamentos' }] } };
  run('stAtualizarCfg')(cfgV3);
  igual('config salva renomeada (categorias, palavras, regras)', [cfgV3.categorias.PJ.map(c => c.nome), cfgV3.palavrasCategoria.PJ[0][1], cfgV3.regrasExtrato.PJ[0].categoria],
    [['Reposição', 'Investimentos'], 'Reposição', 'Investimentos']);
  DBT.saidas.push({ id: 'velha-rep', dataPag: '2027-01-21', tipo: 'Reposição/Investimento de material', valor: '120', forma: 'PIX', status: 'Pago', natureza: 'PROFISSIONAL' });
  ST.saidas = await run('DB').saidas.list(); run('stInvalidar()');
  const mv = run('stMovs()').find(m => m.id === 'velha-rep');
  igual('lançamento antigo conta como Reposição (sem alterar o registro)', [mv.categoria, nomeC(mv.caixinhaId), DBT.saidas.find(s => s.id === 'velha-rep').tipo],
    ['Reposição', 'Reposição', 'Reposição/Investimento de material']);

  titulo('18. Pix devolvido (corrida não aceita) é ignorado sozinho');
  const ex18 = [
    { data: '2027-02-10', descricao: 'Pix enviado: UBER DO BRASIL', valor: -23.90 },
    { data: '2027-02-10', descricao: 'Pix recebido: UBER DO BRASIL', valor: 23.90 },
    { data: '2027-02-11', descricao: 'Pix enviado: 99 TECNOLOGIA', valor: -18.50 },
    { data: '2027-02-12', descricao: 'Devolução Pix', valor: 18.50 },
    { data: '2027-02-12', descricao: 'Pix enviado: UBER DO BRASIL', valor: -31.00 },
    { data: '2027-02-20', descricao: 'Pix recebido: UBER DO BRASIL', valor: 31.00 },
    { data: '2027-02-13', descricao: 'Pix enviado: UBER DO BRASIL', valor: -27.40 },
  ];
  const p18 = AC.prepararExtrato(pjC.id, ex18);
  igual('mesmo app, mesmo dia, mesmo valor → ignorados', [p18[0].acao, p18[0].decisao, p18[1].acao, p18[1].decisao], ['estorno', 'ignorar', 'estorno', 'ignorar']);
  igual('"Devolução Pix" no dia seguinte → ignorados', [p18[2].acao, p18[3].acao], ['estorno', 'estorno']);
  igual('devolução 8 dias depois não é casada (fora do prazo)', [p18[4].acao, p18[5].acao], ['novo', 'novo']);
  igual('corrida normal continua como gasto de Deslocamento', [p18[6].acao, p18[6].decisao, p18[6].categoria], ['novo', 'gasto', 'Deslocamento']);
  const nS18 = DBT.saidas.length, nE18 = DBT.entries.length;
  await AC.aplicarExtrato(pjC.id, p18.filter(p => p.acao === 'estorno'));
  igual('nada gravado para os pares devolvidos', [DBT.saidas.length - nS18, DBT.entries.length - nE18], [0, 0]);

  titulo('19. Pagamento de cliente com data/nome diferente do previsto');
  DBT.entries.push({ id: 'suz', dataPag: '2027-02-28', dataServ: '2027-02-28', cliente: 'Suzana Figueiredo', tipo: 'Pagamento', valor: '405', status: 'Previsto', origem: 'Produção Social', auto: true });
  DBT.entries.push({ id: 'ana', dataPag: '2027-03-10', dataServ: '2027-03-10', cliente: 'Ana Paula Lima', tipo: 'Pagamento', valor: '600', status: 'Previsto', origem: 'Noiva' });
  ST.entries = await run('DB').entries.list(); run('stInvalidar()');
  const nEnt19 = DBT.entries.length;
  let p19 = AC.prepararExtrato(pjC.id, [
    { data: '2027-02-14', descricao: 'Pix recebido: "Cp :90400888-SUZANA RODRIGUES FIGUEIREDO"', valor: 405 },
    { data: '2027-02-15', descricao: 'Pix recebido: "Cp :11122233-MARIA SOUZA"', valor: 300 },
  ]);
  igual('Suzana: 14 dias antes, achada pelo nome', [p19[0].decisao, p19[0].entryId, p19[0].auto], ['cliente', 'suz', 'nome']);
  igual('Maria (mãe) não é reconhecida sozinha, mas a lista oferece o previsto da Ana', [p19[1].decisao, (p19[1].candidatos || []).some(c => c.id === 'ana')], ['receita', true]);
  p19[1].decisao = 'cliente'; p19[1].entryId = 'ana';
  await AC.aplicarExtrato(pjC.id, p19);
  const suz = DBT.entries.find(e => e.id === 'suz');
  igual('Suzana confirmada na data do Pix, sem receita nova', [suz.status, suz.dataPag], ['Realizado', '2027-02-14']);
  const ana = DBT.entries.find(e => e.id === 'ana');
  const restoAna = DBT.entries.filter(e => e.cliente === 'Ana Paula Lima' && e.status === 'Previsto');
  igual('Ana: parcial — 300 recebido, 300 continua previsto', [ana.status, ana.valor, restoAna.map(e => e.valor)], ['Realizado', '300.00', ['300.00']]);
  igual('soma do contrato da Ana preservada (600)', DBT.entries.filter(e => e.cliente === 'Ana Paula Lima').reduce((t, e) => t + Number(e.valor), 0), 600);
  igual('só 1 lançamento novo (o restante da Ana)', DBT.entries.length - nEnt19, 1);
  p19 = AC.prepararExtrato(pjC.id, [{ data: '2027-03-05', descricao: 'Pix recebido: "Cp :11122233-MARIA SOUZA"', valor: 300 }]);
  igual('próximo Pix da Maria já vem ligado à Ana (pagador aprendido)', [p19[0].decisao, p19[0].entryId === restoAna[0].id, p19[0].auto], ['cliente', true, 'regra']);

  titulo('20. Lista com todos os recebimentos (também os já recebidos)');
  DBT.entries.push({ id: 'bia2', dataPag: '2027-02-02', dataServ: '2027-02-02', cliente: 'Beatriz Gomes', tipo: 'Pagamento', valor: '480', status: 'Realizado', origem: 'Produção Social' });
  ST.entries = await run('DB').entries.list(); run('stInvalidar()');
  let p20 = AC.prepararExtrato(pjC.id, [{ data: '2027-02-20', descricao: 'Pix recebido: "Cp :555-FULANO DE TAL"', valor: 480 }]);
  const c20 = p20[0].candidatos || [];
  igual('lista traz previstos e recebidos', [c20.some(c => c.id === 'bia2' && c.recebido), c20.some(c => !c.recebido)], [true, true]);
  igual('já conciliados não aparecem (evita contar 2x)', c20.some(c => c.id === 'o1r'), false);
  p20[0].decisao = 'cliente'; p20[0].entryId = 'bia2';
  const nE20 = DBT.entries.length;
  await AC.aplicarExtrato(pjC.id, p20);
  igual('escolher um já recebido só concilia (data do banco, sem receita nova)',
    [DBT.entries.length - nE20, DBT.entries.find(e => e.id === 'bia2').dataPag, run('stMovs()').find(m => m.id === 'bia2').conciliado], [0, '2027-02-20', true]);

  titulo('21. Aplicação/resgate em caixinha do Inter = movimentação interna');
  const g21 = FX.resumo('PJ', ctxM('2027-02', '2027-02-28')).gastos;
  const pj21 = saldo(pjC, '2027-02-28');
  let p21 = AC.prepararExtrato(pjC.id, [
    { data: '2027-02-16', descricao: 'Aplicacao: "CDB Porq Obj BANCO INTER S A"', valor: -400 },
    { data: '2027-02-17', descricao: 'Aplicacao: "CDB Porq Obj BANCO INTER S A"', valor: -123.45 },
    { data: '2027-02-18', descricao: 'Resgate: "CDB Porq Obj BANCO INTER S A"', valor: 50 },
  ]);
  igual('valor de aporte previsto (Reposição 400) → caixinha Reposição', [p21[0].decisao, nomeC(p21[0].destinoId), p21[0].auto], ['transferencia', 'Reposição', 'plano']);
  igual('sem aporte correspondente → Reserva não distribuída (nova)', [p21[1].decisao, p21[1].destinoId, p21[1].interno], ['transferencia', '__reserva__', true]);
  igual('resgate → transferência interna', [p21[2].decisao, p21[2].interno], ['transferencia', true]);
  await AC.aplicarExtrato(pjC.id, p21);
  const res21 = ST.contas.find(c => c.entidade === 'PJ' && c.finalidade === 'reserva');
  igual('Reserva Inter criada uma vez só', ST.contas.filter(c => c.entidade === 'PJ' && c.finalidade === 'reserva').length, 1);
  igual('reserva = 123,45 aplicado − 50 resgatado', saldo(res21, '2027-02-28'), 73.45);
  igual('não virou gasto', FX.resumo('PJ', ctxM('2027-02', '2027-02-28')).gastos, g21);
  igual('conta corrente acompanha o banco (−400 −123,45 +50)', FX.r2(saldo(pjC, '2027-02-28') - pj21), -473.45);
  igual('aporte de Reposição de fevereiro feito', FX.itensDoMes(ST.itens, '2027-02', run('stMovs()'), '2027-02-20', ST.cfg).find(i => i.entidade === 'PJ' && i.descricao === 'Reposição')._status, 'feito');

  // ══ Experiência do mês (validação da reorganização) ══════════
  const ABR = '2027-04';
  await AC.criarMes(ABR, 'modelo');
  const cA = h => ctxM(ABR, h);
  const semPF = conta('PF', 'caixinha', 'semanada'), fixasPF = conta('PF', 'caixinha', 'fixas'), faxPF = conta('PF', 'caixinha', 'faxineira');
  const itensA = h => FX.itensDoMes(ST.itens, ABR, run('stMovs()'), h, ST.cfg);

  titulo('V1. Mês sem nenhum extrato: o plano já mostra o mês inteiro');
  let PA = FX.painelMes('PF', cA('2027-04-02'));
  const recebPrev = itensA('2027-04-02').filter(i => i.tipo === 'prolabore' || (i.tipo === 'receita' && i.entidade === 'PF')).reduce((t, i) => t + i.valor, 0);
  igual('receber: previsto (pró-labore 01 + 15) e nada recebido', [PA.receber.previsto, PA.receber.recebido, PA.receber.falta], [recebPrev, 0, recebPrev]);
  igual('receber previsto = 2.000 + 2.755 da planilha', PA.receber.previsto, 4755);
  const metaFixas = PA.caixinhas.find(c => c.caixinha.id === fixasPF.id).meta;
  igual('reservar: metas por caixinha, nada transferido', [PA.reservar.meta > 0, PA.reservar.transferido, metaFixas > 0], [true, 0, true]);
  igual('semana em foco: S1, orçamento da semanada', [PA.semana.semana.n, PA.semana.orcamento, PA.semana.podeGastar, PA.semana.faltaReservar], [1, 350, 350, 350]);
  igual('próximas ações já trazem o pró-labore do dia 01', PA.acoes.some(a => a.tipo === 'item' && a.item.tipo === 'prolabore' && a.grupo === 'atrasado'), true);
  igual('compromissos próximos (resto do mês) aparecem', PA.acoes.some(a => a.grupo === 'mes'), true);
  igual('nada marcado como feito pela data (nem no fim do mês)', itensA('2027-04-30').filter(i => i._status === 'feito').length, 0);

  titulo('V2. Gasto registrado à mão atualiza a semanada na hora');
  await AC.registrarGasto({ entidade: 'PF', valor: '120', data: '2027-04-03', descricao: 'Mercado do bairro', categoria: 'Mercado', contaId: pfC.id });
  PA = FX.painelMes('PF', cA('2027-04-03'));
  igual('semanada: gasto 120 → pode gastar 230', [PA.semana.gasto, PA.semana.podeGastar, PA.semana.estourou], [120, 230, false]);
  igual('reservado ≠ gasto: gastou sem reservar ainda', [PA.semana.reservado, PA.semana.gastoSemReserva, PA.semana.faltaReservar], [0, 120, 350]);

  titulo('V3. Reserva parcial em caixinha atualiza o que falta');
  const itFix = itensA('2027-04-05').find(i => i.tipo === 'aporte' && i.caixinhaId === fixasPF.id);
  await AC.executarAporte(itFix.id, { valor: '900', data: '2027-04-05', origemId: pfC.id });
  PA = FX.painelMes('PF', cA('2027-04-05'));
  let mF = PA.caixinhas.find(c => c.caixinha.id === fixasPF.id);
  igual('despesas fixas: transferido 900, falta = meta − 900', [mF.transferido, mF.falta], [900, FX.r2(metaFixas - 900)]);
  igual('despesas fixas: guardar é opcional (não vira ação; as contas viram)', [!!PA.acoes.find(a => a.tipo === 'item' && a.item.id === itFix.id),
    PA.acoes.some(a => a.tipo === 'item' && a.item.tipo === 'pagamento' && a.item.caixinhaId === fixasPF.id)], [false, true]);
  // exemplo da Carol: planejou X, transferiu uma parte, gastou um pouco
  const metaFax = PA.caixinhas.find(c => c.caixinha.id === faxPF.id).meta;
  await AC.transferir({ valor: '100', data: '2027-04-06', origemId: pfC.id, destinoId: faxPF.id });
  await AC.registrarGasto({ entidade: 'PF', valor: '40', data: '2027-04-06', descricao: 'Produtos de limpeza', categoria: 'Faxineira', contaId: faxPF.id });
  const mX = FX.metasCaixinhas('PF', cA('2027-04-06')).find(c => c.caixinha.id === faxPF.id);
  igual('faxineira: meta · transferido · falta · usado · disponível do mês', [mX.meta, mX.transferido, mX.falta, mX.usado, mX.disponivelMes],
    [metaFax, 100, FX.r2(metaFax - 100), 40, 60]);

  titulo('V3b. Caixinhas de contas e semanada: guardar é opcional, sem desconto em dobro');
  igual('modo de cada caixinha', ['semanada', 'fixas', 'faxineira', 'cartao', 'mei', 'dividas', 'sazonais', 'cursos', 'reposicao'].map(f => FX.modoCaixinha({ finalidade: f })),
    ['semana', 'contas', 'contas', 'contas', 'contas', 'contas', 'guardar', 'guardar', 'guardar']);
  const PB = FX.painelMes('PF', cA('2027-04-06'));
  igual('nenhuma ação de guardar em semanada/contas', PB.acoes.filter(a => a.tipo === 'item' && FX.aporteOpcional(a.item, ST.contas)).length, 0);
  igual('"Guardar nas caixinhas" só soma as de guardar', PB.reservar.caixinhas.every(c => FX.modoCaixinha(c.caixinha) === 'guardar'), true);
  const itConta = itensA('2027-04-06').find(i => i.tipo === 'pagamento' && i.caixinhaId === fixasPF.id && FX.PENDENTE(i._status));
  const livreAntes = FX.resumo('PF', cA('2027-04-06')).disponivel;
  await AC.pagarItem(itConta.id, { valor: String(itConta.valor), data: '2027-04-06', contaId: pfC.id, resgatar: true });
  igual('conta paga com a reserva da caixinha: "Livre no mês" não muda', FX.r2(FX.resumo('PF', cA('2027-04-06')).disponivel - livreAntes), 0);
  const livreSem = FX.resumo('PF', cA('2027-04-06')).disponivel;
  await AC.registrarGasto({ entidade: 'PF', valor: '30', data: '2027-04-06', descricao: 'Lanche', categoria: 'Mercado', contaId: pfC.id });
  igual('semanada gasta direto da conta: "Livre no mês" não cai duas vezes', FX.r2(FX.resumo('PF', cA('2027-04-06')).disponivel - livreSem), 0);
  const itParc = itensA('2027-04-06').find(i => i.tipo === 'pagamento' && i.caixinhaId === fixasPF.id && FX.PENDENTE(i._status) && i.valor > 50);
  await AC.pagarItem(itParc.id, { valor: '50', data: '2027-04-06', contaId: pfC.id, resgatar: false });
  const stParc = itensA('2027-04-06').find(i => i.id === itParc.id);
  igual('conta paga com valor diferente do previsto fecha com o valor real', [stParc._status, stParc._realizado, FX.painelMes('PF', cA('2027-04-06')).acoes.some(a => a.item && a.item.id === itParc.id)], ['feito', 50, false]);
  const itR = itensA('2027-04-06').find(i => i.tipo === 'pagamento' && i.caixinhaId === fixasPF.id && FX.PENDENTE(i._status) && i.valor > 20);
  await AC.pagarItem(itR.id, { valor: '20', data: '2027-04-06', contaId: pfC.id, resgatar: false, resto: true });
  const resto = itensA('2027-04-06').find(i => i.descricao === itR.descricao + ' (resto)');
  igual('"ainda falta o resto": fecha a conta e cria o resto pendente', [itensA('2027-04-06').find(i => i.id === itR.id)._status, resto && resto.valor, resto && FX.PENDENTE(resto._status)], ['feito', FX.r2(itR.valor - 20), true]);

  titulo('V6. Semanada acima do orçamento');
  await AC.registrarGasto({ entidade: 'PF', valor: '300', data: '2027-04-07', descricao: 'Mercado', categoria: 'Mercado', contaId: pfC.id });
  PA = FX.painelMes('PF', cA('2027-04-07'));
  igual('semana 1: 450 gastos de 350 → 100 acima', [PA.semana.gasto, PA.semana.acima, PA.semana.podeGastar, PA.semana.estourou], [450, 100, -100, true]);
  igual('primeira das próximas ações: "passou do orçamento"', [PA.acoes[0].tipo, PA.acoes[0].grupo, PA.acoes[0].valor], ['semanada', 'atencao', 100]);

  titulo('V4. Extrato parcial não apaga as previsões futuras');
  const futuros = h => itensA(h).filter(i => i._data > '2027-04-10' && FX.PENDENTE(i._status)).map(i => i.id).sort();
  const fut0 = futuros('2027-04-10');
  const exParcial = [
    { data: '2027-04-03', descricao: 'Compra no debito MERCADO DO BAIRRO', valor: -120 },
    { data: '2027-04-05', descricao: 'Pix enviado: Carol Despesas fixas', valor: -900 },
    { data: '2027-04-08', descricao: 'Padaria Pao Quente', valor: -15 },
    { data: '2027-04-09', descricao: 'Tarifa avulsa', valor: -2 },
  ];
  let pxa = AC.prepararExtrato(pfC.id, exParcial);
  igual('o que já foi registrado à mão é só conferido', [pxa[0].acao, pxa[1].acao], ['conciliar', 'conciliar']);
  igual('linhas novas ficam para decidir', [pxa[2].acao, pxa[3].acao], ['novo', 'novo']);
  pxa[3].decisao = 'ignorar';
  const nPF = DBT.saidas_pessoal.length, nTr = (run('ST').transferencias || []).length;
  await AC.aplicarExtrato(pfC.id, pxa);
  igual('extrato parcial: 1 gasto novo, nenhuma transferência a mais', [DBT.saidas_pessoal.length - nPF, run('ST').transferencias.length - nTr], [1, 0]);
  igual('previsões depois do dia 10 continuam pendentes', futuros('2027-04-10'), fut0);
  igual('itens futuros não viraram "feito"', itensA('2027-04-10').filter(i => i._data > '2027-04-10' && i._status === 'feito').length, 0);

  titulo('V5. Importar de novo o mesmo período não duplica nada');
  const exCompleto = exParcial.concat([{ data: '2027-04-20', descricao: 'Farmacia Saude', valor: -30 }]);
  pxa = AC.prepararExtrato(pfC.id, exCompleto);
  igual('as 4 linhas do extrato parcial vêm como "já importadas"', pxa.slice(0, 4).map(p => p.acao), ['duplicada', 'duplicada', 'duplicada', 'duplicada']);
  igual('a linha que você mandou ignorar não volta', pxa[3].ignoradaAntes, true);
  igual('só a linha nova do resto do mês fica para decidir', pxa[4].acao, 'novo');
  const nPF2 = DBT.saidas_pessoal.length, nTr2 = run('ST').transferencias.length, nE2 = DBT.entradas_pessoal.length;
  await AC.aplicarExtrato(pfC.id, pxa);
  igual('aplicar: só 1 gasto novo (nenhuma duplicata)', [DBT.saidas_pessoal.length - nPF2, run('ST').transferencias.length - nTr2, DBT.entradas_pessoal.length - nE2], [1, 0, 0]);
  pxa = AC.prepararExtrato(pfC.id, exCompleto);
  igual('terceira importação igual: tudo já importado', pxa.every(p => p.acao === 'duplicada'), true);

  titulo('V7. Pró-labore pendente');
  const pro1A = itensA('2027-04-02').find(i => i.tipo === 'prolabore' && i.dia === 1);
  await AC.pagarProlabore(pro1A.id, { valor: 1200, data: '2027-04-01' });
  const PJA = FX.painelMes('PJ', cA('2027-04-07'));
  const proPrev = itensA('2027-04-07').filter(i => i.tipo === 'prolabore').reduce((t, i) => t + i.valor, 0);
  igual('PJ: pró-labore pago 1.200 · falta o resto', [PJA.prolabore.pago, PJA.prolabore.falta], [1200, FX.r2(proPrev - 1200)]);
  PA = FX.painelMes('PF', cA('2027-04-07'));
  igual('PF: recebido 1.200 · falta o resto', [PA.receber.recebido, PA.receber.falta], [1200, FX.r2(recebPrev - 1200)]);
  igual('ação do pró-labore do dia 01 mostra só os 800 que faltam', PA.acoes.find(a => a.tipo === 'item' && a.item.id === pro1A.id).valor, 800);

  titulo('Rastreabilidade');
  igual('toda escrita gerou log', ST.log.length > 30, true);

  titulo('Interface: todas as telas e formulários renderizam sem erro');
  const els = {};
  const el = id => els[id] || (els[id] = { id, innerHTML: '', textContent: '', value: '', checked: false, style: {}, files: [],
    classList: { add() {}, remove() {}, toggle() {} }, focus() {} });
  ctx.document = { getElementById: el, querySelectorAll: () => [], querySelector: () => null,
    body: { classList: { add() {}, remove() {}, toggle() {} }, dataset: {} }, addEventListener() {} };
  ctx.window = { scrollTo() {}, location: {} }; ctx.setTimeout = () => 0; ctx.clearTimeout = () => {};
  ctx.confirm = () => false; ctx.prompt = () => null; ctx.location = { search: '' }; ctx.URLSearchParams = URLSearchParams;
  ['extrato-parser.js', 'ui.js', 'telas.js', 'forms.js', 'ia-extrato.js'].forEach(f =>
    vm.runInContext(fs.readFileSync(path.join(raiz, f), 'utf8'), ctx, { filename: f }));
  titulo('IA no extrato: só sugere o que as regras não pegaram, e só com valores válidos');
  run(`UI.extrato = { contaId: '${pjC.id}', propostas: AC.prepararExtrato('${pjC.id}', [
    { data: '2027-04-12', descricao: 'Pix enviado: LOJA XPTO BELEZA', valor: -89.9 },
    { data: '2027-04-12', descricao: 'Pix enviado: FULANO DE TAL', valor: -40 },
    { data: '2027-04-12', descricao: 'Pix enviado: SICRANO', valor: -12 },
    { data: '2027-04-12', descricao: 'Pix enviado: BELTRANO', valor: -7 },
    { data: '2027-04-12', descricao: 'Pix enviado: OUTRA LOJA', valor: -55 } ]) }`);
  const cIA = run('iaContexto(UI.extrato)');
  cIA.alvo.forEach(a => { a.decisao0 = a.p.decisao; });
  const kIA = cIA.alvo.map(a => a.k);
  const catIA = cIA.cats.find(x => x.nome === 'Reposição') ? 'Reposição' : cIA.cats[0].nome;
  const cxPJ = cIA.contas.find(x => x.tipo === 'caixinha');
  const okIA = [
    run('iaAplicar')(cIA, { i: kIA[0], decisao: 'gasto', categoria: catIA, conta: '', item: '', cliente: '', confianca: 'alta', motivo: 'loja de produtos' }),
    run('iaAplicar')(cIA, { i: kIA[1], decisao: 'gasto', categoria: 'Inventada', conta: '', item: '', cliente: '', confianca: 'alta', motivo: 'x' }),
    run('iaAplicar')(cIA, { i: kIA[2], decisao: 'cliente', categoria: '', conta: '', item: '', cliente: '999', confianca: 'alta', motivo: 'x' }),
    run('iaAplicar')(cIA, { i: kIA[3], decisao: 'ignorar', categoria: '', conta: '', item: '', cliente: '', confianca: 'baixa', motivo: 'x' }),
    run('iaAplicar')(cIA, { i: kIA[4], decisao: 'transferencia', categoria: '', conta: cxPJ.id, item: '', cliente: '', confianca: 'media', motivo: 'caixinha' }),
  ];
  igual('aceita só sugestões válidas (categoria real, cliente da lista, ignorar só com certeza)', okIA, [true, false, false, false, true]);
  const pIA = run('UI.extrato.propostas')[kIA[0]];
  igual('linha sugerida pela IA: categoria e marca "pela IA", vai para "já sugeridos"', [pIA.decisao, pIA.categoria, pIA.auto, pIA.grupo], ['gasto', catIA, 'ia', 'sugerido']);
  const sch = run('iaSchema')(cIA);
  igual('schema só deixa escolher categorias e contas que existem', [sch.properties.linhas.items.properties.categoria.enum.includes('Inventada'), sch.properties.linhas.items.properties.conta.enum.includes(cxPJ.id)], [false, true]);
  run('UI.extrato = null');

  titulo('Semanada paga as despesas variáveis (mesmo pagas pela conta PJ)');
  const semAntes = FX.semanadas('PF', cA('2027-04-13')).gasto;
  await AC.registrarGasto({ entidade: 'PJ', pessoal: true, valor: '25', data: '2027-04-13', contaId: pjC.id, categoria: 'Mercado', descricao: 'Mercado pago pela PJ' });
  igual('mercado pago pela PJ entra no gasto da semanada PF', FX.r2(FX.semanadas('PF', cA('2027-04-13')).gasto - semAntes), 25);

  titulo('Categorias: criar uma fixa nova (Cuidados pessoais)');
  const cfgCat = JSON.parse(JSON.stringify(ST.cfg));
  cfgCat.categorias.PF.push({ nome: 'Cuidados pessoais', grupo: 'Fixas' });
  await AC.salvarConfig(cfgCat);
  await AC.criarContaFixa({ entidade: 'PF', nome: 'Cuidados pessoais', valor: '120', dia: 12 });
  const cpModelo = ST.itens.find(i => i.mes === 'modelo' && i.descricao === 'Cuidados pessoais');
  igual('entra no modelo como conta da caixinha Despesas fixas', [cpModelo && cpModelo.tipo, cpModelo && cpModelo.valor, nomeC(cpModelo && cpModelo.caixinhaId)], ['pagamento', 120, 'Despesas fixas']);
  igual('aparece na lista de categorias de saída', run("categorias('PF')").some(c => c.nome === 'Cuidados pessoais' && c.grupo === 'Fixas'), true);
  const mesAberto = ST.planos.filter(p => p.mes !== 'modelo' && p.mes >= FX.mesDe(run('stHoje()')) && p.status !== 'fechado').map(p => p.mes)[0];
  igual('e nos meses já criados (abertos)', !mesAberto || ST.itens.some(i => i.mes === mesAberto && i.descricao === 'Cuidados pessoais'), true);

  titulo("Pagar: ligar o que já foi pago");
  // pago por outro caminho (ex.: Pix pelo extrato): "Pagar" oferece ligar, sem criar outro
  const itTel = itensA('2027-04-06').find(i => i.tipo === 'pagamento' && i.caixinhaId === fixasPF.id && FX.PENDENTE(i._status) && i._realizado === 0);
  await AC.registrarGasto({ entidade: 'PF', valor: String(itTel.valor), data: '2027-04-06', descricao: 'Pix conta ' + itTel.descricao, categoria: 'Outros', contaId: pfC.id });
  const candT = run('candidatosPagamento')(itTel);
  igual('"Já pagou?" mostra o Pix que já está no app', candT.some(m => m.descricao === 'Pix conta ' + itTel.descricao), true);
  const nMovs = run('stMovs()').length, mT = candT.find(m => m.descricao === 'Pix conta ' + itTel.descricao);
  await AC.classificar(mT.tabela, mT.id, { planoItemId: itTel.id, caixinhaId: fixasPF.id });
  igual('ligar: conta feita, sem lançamento novo', [itensA('2027-04-06').find(i => i.id === itTel.id)._status, run('stMovs()').length], ['feito', nMovs]);
  await AC.registrarGasto({ entidade: 'PJ', valor: '400', data: '2027-04-08', descricao: 'Pix equipe', categoria: 'Equipe', contaId: pjC.id, caixinhaId: '-' });
  await AC.registrarGasto({ entidade: 'PJ', valor: '33', data: '2027-04-08', descricao: 'Pix sem nome', categoria: 'Outro', contaId: pjC.id });
  const clsPJ = (FX.painelMes('PJ', cA('2027-04-08')).acoes.find(a => a.tipo === 'classificar') || { movs: [] }).movs.map(m => m.descricao);
  igual('saída com categoria (equipe) sem caixinha não pede organizar; sem categoria pede', [clsPJ.includes('Pix equipe'), clsPJ.includes('Pix sem nome')], [false, true]);

  let erros = 0;
  const tenta = (nome, code) => { try { run(code); } catch (e) { erros++; console.log(`   ✗ ${nome}: ${e.stack.split('\n').slice(0, 3).join(' | ')}`); } };
  for (const mes of ['2026-12', '2027-01', '2026-11']) for (const ent of ['PF', 'PJ'])
    for (const tab of ['inicio', 'plano', 'caixinhas', 'movs', 'conciliar', 'mais', 'dividas', 'analises', 'ajustes', 'mes', 'pendencias'])
      tenta(`${tab}/${ent}/${mes}`, `UI.mes='${mes}';UI.ent='${ent}';UI.tab='${tab}';UI.modelo=false;UI.aberto={};render();`);
  tenta('modelo', `UI.tab='plano';UI.modelo=true;render();UI.modelo=false`);
  tenta('ajustes abertos', `UI.tab='ajustes';UI.aberto={contas:true,dividas:true};render()`);
  tenta('caixinhas abertas', `UI.tab='caixinhas';UI.mes='2026-12';ST.contas.forEach(c=>UI.aberto[c.id]=true);UI.ent='PF';render();UI.ent='PJ';render()`);
  run(`UI.mes='2026-12'`);
  const it1 = ST.itens.find(i => i.mes === '2027-01' && i.tipo === 'pagamento' && i.caixinhaId);
  const ap1 = ST.itens.find(i => i.mes === '2027-01' && i.tipo === 'aporte');
  const pr1 = ST.itens.find(i => i.mes === '2027-01' && i.tipo === 'prolabore');
  for (const id of [it1.id, ap1.id, pr1.id]) { tenta('formExecutar ' + id, `formExecutar('${id}')`); tenta('formItem ' + id, `formItem('${id}')`); tenta('formReprogramar', `formReprogramar('${id}')`); }
  tenta('formItem novo', `UI.mes='2027-01';formItem(null)`);
  ['menuNovo()', "formGasto('PF')", "formGasto('PJ', ST.contas.find(c=>c.finalidade==='semanada').id)", 'formEntradaPF()',
   "formTransferencia('PF')", 'formFatura()', 'formProlaboreAvulso()', "formConfirmar('o1s')", 'formExtrato()', 'formConfig()',
   'formConta(null)', 'formConta(ST.contas[0].id)', 'formDivida(null)', 'formDivida(ST.dividas[0].id)', 'abrirLoginPF()',
   "formConciliar(ST.contas[0].id)", "formConciliar(ST.contas.find(c=>c.tipo==='cartao').id)"].forEach(c => tenta(c, c));
  for (const m of run('stMovs()').slice(0, 40)) tenta('formMov ' + m.key, `formMov(${JSON.stringify(m.key)})`);
  tenta('extrato review', `UI.extrato={contaId:ST.contas[0].id,info:'x',propostas:AC.prepararExtrato(ST.contas[0].id,[{data:'2026-12-20',descricao:'Mercado X',valor:-42.5},{data:'2026-12-21',descricao:'Pix',valor:10}])};UI.extrato.propostas[0].decisao='transferencia';UI.tab='conciliar';render();UI.extrato=null`);
  tenta('setup vazio', `const c=ST.contas;ST.contas=[];render();ST.contas=c`);
  tenta('migração ausente', `ST.migracaoOk=false;render();ST.migracaoOk=true`);
  tenta('PF bloqueada', `ST.pfLiberado=false;run=0;stInvalidar();['inicio','plano','movs','caixinhas','conciliar','analises'].forEach(t=>{UI.tab=t;UI.ent='PF';render()});ST.pfLiberado=true;stInvalidar()`);
  igual('erros de renderização', erros, 0);
  for (const t of ['inicio', 'conciliar']) {
    run(`UI.tab='${t}';UI.mes='2027-01';UI.ent='PF';render()`);
    igual(`dívidas fora do plano não viram pendência (${t})`, el('view').innerHTML.includes('Empréstimo pessoal Itaú'), false);
  }
  tenta('tela dívidas com simulação', `UI.tab='dividas';UI.sim={orc:'6000',est:'juros',ini:'2027-03',quais:'todas'};render()`);
  igual('simulação aparece na tela', el('view').innerHTML.includes('Quita tudo em'), true);
  ['formSaldoDivida(ST.dividas[1].id)','formIncluirDivida(ST.dividas[1].id)','formDivida(ST.dividas.find(d=>d.situacao==="no_plano").id)'].forEach(c=>tenta(c,c));
  igual('erros de renderização (dívidas)', erros, 0);
  run(`UI.tab='inicio';UI.mes='2026-12';UI.ent='PF';render()`);
  igual('HTML do mês gerado', el('view').innerHTML.length > 500, true);
  if (process.env.HTML) console.log(el('view').innerHTML.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').slice(0, 2500));
  igual('texto do usuário escapado', run(`esc('<img onerror=x>')`), '&lt;img onerror=x&gt;');

  titulo('Telas dos cenários (o que aparece para a Carol)');
  const ver = (code) => { run(code); return el('view').innerHTML.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '); };
  run(`var _hojeReal = stHoje; stHoje = () => '2027-04-07'`);   // "hoje" = dia do cenário
  const w1 = FX.painelMes('PF', ctxM('2027-04', '2027-04-07')).semana;
  let txt = ver(`UI.tab='inicio';UI.ent='PF';UI.mes='2027-04';UI.aberto={};render()`);
  if (process.env.TXT) console.log(txt.slice(0, 2500));
  igual('Hoje: semanada desta semana acima do orçamento, em destaque', txt.includes(`Semanada · esta semana`) && txt.includes(`${run(`brl(${w1.acima})`)} acima do orçamento`), true);
  igual('Hoje: "Próximas ações" com o que passou do orçamento', txt.includes('Próximas ações') && txt.includes('Passou do orçamento'), true);
  igual('Hoje: receber / distribuir / gastar', ['Receber', 'Guardar', 'Gastar'].every(k => txt.includes(k)), true);
  igual('Hoje: pró-labore com o que falta', /faltam R\$ 3\.555,00/.test(txt), true);
  txt = ver(`UI.tab='caixinhas';render()`);
  igual('Caixinhas: meta, guardado, usado, saldo e o que falta guardar', ['Meta', 'Guardado', 'Usado', 'Saldo hoje', 'falta guardar'].every(k => txt.includes(k)) && !txt.includes('disponível do mês'), true);
  const cartao = fin => { const i = txt.indexOf(ST.contas.find(c => c.entidade === 'PF' && c.finalidade === fin).nome); const f = txt.indexOf('Detalhes', i); return txt.slice(i, f > i ? f : i + 200); };
  igual('Semanada = quanto pode gastar (não "falta guardar", sem "reservado")', /pode gastar esta semana|acima esta semana/.test(cartao('semanada')) && !/falta guardar|reservado/.test(cartao('semanada')), true);
  igual('Despesas fixas = quanto falta pagar das contas', /falta pagar|contas do mês pagas/.test(cartao('fixas')) && /Contas do mês/.test(cartao('fixas')) && !/falta guardar/.test(cartao('fixas')), true);
  igual('Caixinhas: semanada mostra a semana atual com o orçamento', txt.includes(`gasto ${run(`brlc(${w1.gasto})`)} de R$ 350`) && txt.includes('esta semana'), true);
  txt = ver(`UI.tab='inicio';UI.ent='PJ';render()`);
  igual('Hoje PJ: pró-labore para a conta pessoal com o que falta', /Pró-labore · para a sua conta pessoal[^]*faltam R\$ 3\.555,00/.test(txt), true);
  txt = ver(`UI.tab='plano';UI.ent='PF';UI.mes='2028-01';render()`);
  igual('mês sem plano: oferece criar a partir do modelo', txt.includes('Criar a partir do modelo'), true);
  txt = ver(`UI.tab='conciliar';UI.ent='PF';UI.mes='2027-04';render()`);
  igual('Conferir com o banco: importar extrato + contas', txt.includes('Importar extrato') && txt.includes('Conferir saldo'), true);
  run(`UI.extrato={contaId:'${pfC.id}',info:'x',propostas:AC.prepararExtrato('${pfC.id}',[{data:'2027-04-08',descricao:'Padaria Pao Quente',valor:-15},{data:'2027-04-25',descricao:'Loja X',valor:-50}])}`);
  txt = ver(`UI.tab='conciliar';render()`);
  igual('revisão do extrato separa já importados e o que precisa de você', txt.includes('Já importados antes') && txt.includes('Precisa de você'), true);
  run(`UI.extrato=null; stHoje = _hojeReal`);
  igual('erros de renderização (cenários)', erros, 0);

  titulo('V8. Caixinhas anuais (Sazonais PF, Cursos e investimentos PJ): o mês e o ano');
  const saz = conta('PF', 'caixinha', 'sazonais'), cur = conta('PJ', 'caixinha', 'cursos');
  igual('Sazonais e Cursos são anuais; Despesas fixas não', [FX.caixinhaAnual(saz, ST.cfg), FX.caixinhaAnual(cur, ST.cfg), FX.caixinhaAnual(fixasPF, ST.cfg)], [true, true, false]);
  let an = FX.anoCaixinha(saz, cA('2027-04-10'));
  igual('ano = 12 meses a partir do início do fluxo (dez/26 → nov/27)', [an.ciclo.inicio, an.ciclo.fim, an.meses.length], ['2026-12', '2027-11', 12]);
  igual('meta do ano = soma do orçamento das sazonais (14.950)', [an.metaAnual, an.fonteMeta], [14950, 'sazonais']);
  igual('mês ainda não criado usa a meta do modelo', [an.meses.find(x => x.mes === '2027-08').fonte, an.meses.find(x => x.mes === '2027-08').meta], ['modelo', 1245]);
  igual('guardado em dez = aporte 1.245 + reforço 100', an.meses[0].transferido, 1345);
  const venc10 = an.meses.find(x => x.mes === ABR).metaVencida;
  igual('reserva de abril (dia 15) ainda não conta como "atrás" no dia 10', venc10, 0);
  const an20 = FX.anoCaixinha(saz, cA('2027-04-20'));
  igual('no dia 20 já conta no ritmo', FX.r2(an20.planejadoAteAgora - an.planejadoAteAgora), 1245);
  igual('guardado do ano = soma dos meses; falta = meta − guardado', [an.guardado, an.faltaGuardar], [FX.r2(an.meses.reduce((t, x) => t + x.transferido, 0)), FX.r2(14950 - an.guardado)]);
  igual('sugestão para fechar o ano = falta ÷ meses que restam (abr → nov = 8)', [an.mesesRestantes, an.sugestaoMes], [8, FX.r2(an.faltaGuardar / 8)]);
  const usado0 = an.usado;
  await AC.registrarGasto({ entidade: 'PF', valor: '2000', data: '2027-04-08', descricao: 'Roupas de inverno', categoria: 'Roupas', contaId: saz.id });
  an = FX.anoCaixinha(saz, cA('2027-04-10'));
  igual('gasto da caixinha soma no usado do ano e na finalidade', [FX.r2(an.usado - usado0), an.categorias.find(c => c.nome === 'Roupas').resta], [2000, FX.r2(3000 - an.categorias.find(c => c.nome === 'Roupas').usado)]);
  let mS = FX.metasCaixinhas('PF', cA('2027-04-10')).find(c => c.caixinha.id === saz.id);
  igual('usar mais que o guardado no mês NÃO é "passou do orçamento" (é anual)', [mS.usado > mS.meta, mS.estourou], [true, false]);
  await AC.registrarGasto({ entidade: 'PF', valor: '13000', data: '2027-04-09', descricao: 'Viagem de férias', categoria: 'Viagem', contaId: saz.id });
  mS = FX.metasCaixinhas('PF', cA('2027-04-10')).find(c => c.caixinha.id === saz.id);
  igual('passou da meta do ANO → aí sim avisa', [mS.estourou, mS.acima], [true, FX.r2(mS.anual.usado - 14950)]);
  igual('vira ação "passou do orçamento"', FX.painelMes('PF', cA('2027-04-10')).acoes.some(a => a.tipo === 'caixinha' && a.caixinha.id === saz.id && a.grupo === 'atencao'), true);
  an = FX.anoCaixinha(cur, cA('2027-04-10'));
  igual('Cursos: sem meta definida = soma das metas dos meses (12 × 541)', [an.metaAnual, an.fonteMeta], [FX.r2(an.somaMetas), 'meses']);
  const cfgM = JSON.parse(JSON.stringify(ST.cfg)); cfgM.metaAnual = { [cur.id]: 6500 };
  await AC.salvarConfig(cfgM);
  an = FX.anoCaixinha(cur, cA('2027-04-10'));
  igual('Cursos: meta do ano definida (6.500) e média por mês', [an.metaAnual, an.fonteMeta, an.mediaMes], [6500, 'definida', 541.67]);
  igual('ano começando em janeiro', [FX.cicloAno('2027-04', { anoCaixinhas: { mesInicio: 1 } }).inicio, FX.cicloAno('2026-12', { anoCaixinhas: { mesInicio: 1 } }).inicio], ['2027-01', '2026-01']);
  run(`stHoje = () => '2027-04-10'`);
  txt = ver(`UI.tab='caixinhas';UI.ent='PF';UI.mes='2027-04';UI.aberto={'${saz.id}':true};render()`);
  igual('tela: Sazonais mostra meta do mês e o ano (meta, guardado, usado)', ['Meta do mês', 'No ano', 'Meta do ano', 'Guardado', 'R$ 14.950', 'Pode usar', 'p/ fechar', 'Mês a mês', 'Orçamento do ano por finalidade'].every(k => txt.includes(k)), true);
  igual('tela: sem frases longas (explicação no i)', !/Para fechar o ano|Ainda pode usar|Em média|sem contar o que sobrou/.test(txt) && el('view').innerHTML.includes('class="i-info"'), true);
  txt = ver(`UI.ent='PJ';UI.aberto={};render()`);
  igual('tela: Cursos e investimentos mostra a meta do ano 6.500', txt.includes('No ano') && txt.includes('R$ 6.500'), true);
  run(`formMetaAnual('${cur.id}')`);
  igual('formulário "Ajustar meta" abre com o valor', el('modal-box').innerHTML.includes('Meta do ano') && el('modal-box').innerHTML.includes('value="6500"'), true);
  run(`stHoje = _hojeReal`);
  igual('erros de renderização (anual)', erros, 0);

  console.log(`\n${falhas ? '✗' : '✓'} ${ok} verificações ok, ${falhas} falha(s)`);
  process.exit(falhas ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
