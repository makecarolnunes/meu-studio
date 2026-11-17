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

// ── Supabase falso ────────────────────────────────────────
function criarDB() {
  const T = { entries: [], saidas: [], entradas_pessoal: [], saidas_pessoal: [], configuracoes: {} };
  const clone = o => JSON.parse(JSON.stringify(o));
  const up = (arr, o) => { const i = arr.findIndex(x => String(x.id) === String(o.id)); if (i >= 0) arr[i] = Object.assign({}, arr[i], clone(o)); else arr.push(clone(o)); };
  const fluxo = {};
  const trigger = s => {    // réplica de sync_saida_pessoal()
    const pess = String(s.natureza || '').toUpperCase() === 'PESSOAL';
    T.entradas_pessoal = T.entradas_pessoal.filter(e => e.saidaOrigemId !== s.id || pess);
    if (!pess) return;
    if (/transfer/i.test(s.forma || '') && s.transferenciaParaMim) {
      up(T.entradas_pessoal, { id: 'sync_' + s.id, data: s.dataPag, descricao: s.obs, valor: Number(s.valor),
        categoria: s.tipo === 'Pró-labore' ? 'Pró-labore' : 'Transferência', forma: s.forma, origem: 'sincronizado', saidaOrigemId: s.id });
    } else {
      const ex = T.saidas_pessoal.find(x => x.id === 'sync_' + s.id);   // ON CONFLICT não mexe na categoria
      up(T.saidas_pessoal, { id: 'sync_' + s.id, data: s.dataPag, descricao: s.obs, valor: Number(s.valor),
        categoria: ex ? ex.categoria : 'Outros', forma: s.forma, origem: 'sincronizado', saidaOrigemId: s.id });
    }
  };
  return {
    T,
    entries: { list: async () => clone(T.entries), upsert: async e => up(T.entries, e),
               update: async (id, f) => up(T.entries, Object.assign({ id }, f)) },
    saidas: { list: async () => clone(T.saidas), upsert: async s => { up(T.saidas, s); trigger(s); },
              update: async (id, f) => { up(T.saidas, Object.assign({ id }, f)); trigger(T.saidas.find(x => x.id === id)); } },
    pessoal: {
      entradas: { list: async () => clone(T.entradas_pessoal), upsert: async e => up(T.entradas_pessoal, e),
                  delete: async id => { T.entradas_pessoal = T.entradas_pessoal.filter(x => x.id !== id); } },
      saidas: { list: async () => clone(T.saidas_pessoal), upsert: async e => up(T.saidas_pessoal, e),
                delete: async id => { T.saidas_pessoal = T.saidas_pessoal.filter(x => x.id !== id); } },
    },
    fluxo: {
      list: async t => clone(fluxo[t] || []),
      upsert: async (t, o) => { fluxo[t] = fluxo[t] || []; up(fluxo[t], o); },
      upsertMany: async (t, arr) => { fluxo[t] = fluxo[t] || []; arr.forEach(o => up(fluxo[t], o)); },
      remove: async (t, id) => { fluxo[t] = (fluxo[t] || []).filter(x => x.id !== id); },
    },
    config: { get: async k => T.configuracoes[k] || null, set: async (k, v) => { T.configuracoes[k] = v; } },
  };
}

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

  titulo('11. Consultoria: 5 parcelas de R$ 350 pela caixinha Sazonais');
  const consDez = ST.itens.find(i => i.mes === DEZ && i.descricao === 'Consultoria financeira');
  igual('dezembro = parcela 1/5', FX.nomeItem(consDez), 'Consultoria financeira (1/5)');
  igual('paga pela caixinha Sazonais', nomeC(consDez.caixinhaId), 'Sazonais');
  igual('janeiro = parcela 2/5', FX.nomeItem(ST.itens.find(i => i.mes === '2027-01' && i.descricao === 'Consultoria financeira')), 'Consultoria financeira (2/5)');
  const modelo = ST.itens.filter(i => i.mes === 'modelo');
  igual('abril/27 ainda tem parcela (5/5)', FX.copiarItens(modelo, '2027-04', 'x', () => 'y').some(i => i.descricao === 'Consultoria financeira'), true);
  igual('maio/27 não tem mais parcela', FX.copiarItens(modelo, '2027-05', 'x', () => 'y').some(i => i.descricao === 'Consultoria financeira'), false);
  igual('Pole Dance some do plano depois de dez/26', ST.itens.filter(i => i.mes === '2027-01' && i.dividaId).length, 0);
  igual('não entra na distribuição do pró-labore (é paga pela reserva)',
    FX.distribuicoesPF(FX.itensDoMes(ST.itens, DEZ, run('stMovs()'), '2026-12-31', ST.cfg), run('stMovs()'))[1].planejado, 2556);

  titulo('12. Automático: plano do mês, fechamento e vínculos');
  let auto = await AC.garantirMeses('2027-01-21');
  igual('dia 21: cria fevereiro sozinho', auto.filter(f => f.acao === 'criado').map(f => f.mes), ['2027-02']);
  igual('fevereiro veio do modelo (consultoria 3/5)', FX.nomeItem(ST.itens.find(i => i.mes === '2027-02' && i.descricao === 'Consultoria financeira')), 'Consultoria financeira (3/5)');
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
  igual('config antiga atualizada mantendo a categoria criada por você', [cfgV1.versao, cfgV1.categorias.PJ.some(c => c.nome === 'Assistente'), cfgV1.categorias.PJ.some(c => c.nome === 'Uniforme')], [5, false, true]);
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

  titulo('Rastreabilidade');
  igual('toda escrita gerou log', ST.log.length > 30, true);

  titulo('Interface: todas as telas e formulários renderizam sem erro');
  const els = {};
  const el = id => els[id] || (els[id] = { id, innerHTML: '', textContent: '', value: '', checked: false, style: {}, files: [],
    classList: { add() {}, remove() {}, toggle() {} }, focus() {} });
  ctx.document = { getElementById: el, querySelectorAll: () => [], querySelector: () => null,
    body: { classList: { add() {}, remove() {} } }, addEventListener() {} };
  ctx.window = { scrollTo() {}, location: {} }; ctx.setTimeout = () => 0; ctx.clearTimeout = () => {};
  ctx.confirm = () => false; ctx.prompt = () => null; ctx.location = { search: '' }; ctx.URLSearchParams = URLSearchParams;
  ['extrato-parser.js', 'ui.js', 'telas.js', 'forms.js'].forEach(f =>
    vm.runInContext(fs.readFileSync(path.join(raiz, f), 'utf8'), ctx, { filename: f }));
  let erros = 0;
  const tenta = (nome, code) => { try { run(code); } catch (e) { erros++; console.log(`   ✗ ${nome}: ${e.stack.split('\n').slice(0, 3).join(' | ')}`); } };
  for (const mes of ['2026-12', '2027-01', '2026-11']) for (const ent of ['PF', 'PJ'])
    for (const tab of ['mes', 'plano', 'movs', 'caixinhas', 'pendencias', 'analises', 'ajustes', 'dividas'])
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
  tenta('extrato review', `UI.extrato={contaId:ST.contas[0].id,info:'x',propostas:AC.prepararExtrato(ST.contas[0].id,[{data:'2026-12-20',descricao:'Mercado X',valor:-42.5},{data:'2026-12-21',descricao:'Pix',valor:10}])};UI.extrato.propostas[0].decisao='transferencia';UI.tab='ajustes';render();UI.extrato=null`);
  tenta('setup vazio', `const c=ST.contas;ST.contas=[];render();ST.contas=c`);
  tenta('migração ausente', `ST.migracaoOk=false;render();ST.migracaoOk=true`);
  tenta('PF bloqueada', `ST.pfLiberado=false;run=0;stInvalidar();['mes','plano','movs','caixinhas','pendencias','analises'].forEach(t=>{UI.tab=t;UI.ent='PF';render()});ST.pfLiberado=true;stInvalidar()`);
  igual('erros de renderização', erros, 0);
  run(`UI.tab='pendencias';UI.mes='2027-01';render()`);
  igual('dívidas fora do plano não viram pendência do mês', el('view').innerHTML.includes('Empréstimo pessoal Itaú'), false);
  tenta('tela dívidas com simulação', `UI.tab='dividas';UI.sim={orc:'6000',est:'juros',ini:'2027-03',quais:'todas'};render()`);
  igual('simulação aparece na tela', el('view').innerHTML.includes('Quita tudo em'), true);
  ['formSaldoDivida(ST.dividas[1].id)','formIncluirDivida(ST.dividas[1].id)','formDivida(ST.dividas.find(d=>d.situacao==="no_plano").id)'].forEach(c=>tenta(c,c));
  igual('erros de renderização (dívidas)', erros, 0);
  run(`UI.tab='mes';UI.mes='2026-12';UI.ent='PF';render()`);
  igual('HTML do mês gerado', el('view').innerHTML.length > 500, true);
  if (process.env.HTML) console.log(el('view').innerHTML.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').slice(0, 2500));
  igual('texto do usuário escapado', run(`esc('<img onerror=x>')`), '&lt;img onerror=x&gt;');

  console.log(`\n${falhas ? '✗' : '✓'} ${ok} verificações ok, ${falhas} falha(s)`);
  process.exit(falhas ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
