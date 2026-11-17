// ════════════════════════════════════════════════════════════
// fluxo/scripts/core.js — REGRAS DE CÁLCULO (puras: sem DOM, sem DB)
//
// Princípios (ver fluxo/CLAUDE.md):
//  • Previsto vive no PLANO (fin_plano_itens). Realizado vive nas
//    MOVIMENTAÇÕES (entries, saidas, entradas_pessoal, saidas_pessoal,
//    fin_transferencias). Um item só está "feito" se houver movimentação
//    real ligada a ele — nunca por estar previsto.
//  • Transferência (aporte, resgate, fatura, entre contas) NUNCA é
//    receita nem despesa. Só mexe em saldo de conta.
//  • Compra no cartão = despesa na data da compra (conta = cartão).
//    Pagar a fatura = transferência conta → cartão (não duplica).
//  • Saldo de conta = saldo informado na conciliação + movimentos
//    posteriores. Sem conciliação: só movimentos desde inicioFluxo
//    (sinalizado como "não conferido"). Nunca saldo inventado.
//
// Testado por fluxo/tests/cenarios.js (node fluxo/tests/cenarios.js)
// ════════════════════════════════════════════════════════════

const FX = (function () {
  'use strict';
  const EPS = 0.005;
  const r2 = n => Math.round((Number(n) || 0) * 100) / 100;
  const num = v => (v === '' || v == null || isNaN(Number(v))) ? 0 : Number(v);
  // Valor digitado: aceita "1.234,56", "1234,56", "1234.56", "-15,5"
  function parseValor(v) {
    if (typeof v === 'number') return v;
    let t = String(v == null ? '' : v).trim().replace(/R\$\s*/i, '').replace(/\s/g, '');
    if (!t) return NaN;
    if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');   // "2.000" = dois mil
    return Number(t);
  }

  // ── DATAS ───────────────────────────────────────────────
  function diasNoMes(mes) {
    const [y, m] = String(mes).split('-').map(Number);
    return new Date(y, m, 0).getDate();
  }
  function dataDoDia(mes, dia) {
    const d = Math.min(Math.max(1, Number(dia) || 1), diasNoMes(mes));
    return `${mes}-${String(d).padStart(2, '0')}`;
  }
  const mesDe = data => String(data || '').slice(0, 7);
  const diaDe = data => Number(String(data || '').slice(8, 10)) || 0;
  function addMes(mes, n) {
    let [y, m] = String(mes).split('-').map(Number);
    m += n;
    while (m > 12) { m -= 12; y++; }
    while (m < 1)  { m += 12; y--; }
    return `${y}-${String(m).padStart(2, '0')}`;
  }
  function addDias(data, n) {
    const d = new Date(data + 'T12:00:00');
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function difDias(a, b) {
    return Math.round((new Date(a + 'T12:00:00') - new Date(b + 'T12:00:00')) / 86400000);
  }
  const ultimoDia = mes => dataDoDia(mes, 31);

  // Semanas do mês a partir da config. A última termina no último dia
  // real do mês (28, 29, 30 ou 31).
  function semanas(mes, cfg) {
    const defs = (cfg && cfg.semanas && cfg.semanas.length) ? cfg.semanas
      : [{ n: 1, ini: 1, fim: 8 }, { n: 2, ini: 9, fim: 15 }, { n: 3, ini: 16, fim: 22 }, { n: 4, ini: 23, fim: 31 }];
    const ult = diasNoMes(mes);
    return defs.map((s, i) => {
      const ini = Math.min(s.ini, ult);
      const fim = i === defs.length - 1 ? ult : Math.min(s.fim, ult);
      return { n: s.n, ini: dataDoDia(mes, ini), fim: dataDoDia(mes, fim), diaIni: ini, diaFim: fim,
               label: `${String(ini).padStart(2, '0')} a ${String(fim).padStart(2, '0')}` };
    });
  }
  function semanaDe(data, cfg) {
    const s = semanas(mesDe(data), cfg).find(w => data >= w.ini && data <= w.fim);
    return s ? s.n : null;
  }

  // ── CONTAS ──────────────────────────────────────────────
  function contaPadrao(contas, entidade, tipo) {
    const cands = contas.filter(c => c.entidade === entidade && c.tipo === tipo && c.ativa !== false);
    return cands.find(c => c.padrao) || cands[0] || null;
  }
  function caixinhaPorFinalidade(contas, entidade, finalidade) {
    return contas.find(c => c.entidade === entidade && c.tipo === 'caixinha' && c.finalidade === finalidade && c.ativa !== false) || null;
  }

  // ── NORMALIZAÇÃO DAS MOVIMENTAÇÕES ──────────────────────
  // Converte as 5 fontes num formato único. Nada aqui altera dados.
  //   src = { entries, saidas, entradasPF, saidasPF, transferencias, meta }
  //   meta = { 'tabela:id': {contaId, caixinhaId, planoItemId, dividaId, conciliado, extratoRef} }
  function normalizar(src, contas) {
    const meta = src.meta || {};
    const out = [];
    const id = (cx) => cx ? cx.id : null;
    const pfCorr = id(contaPadrao(contas, 'PF', 'corrente'));
    const pjCorr = id(contaPadrao(contas, 'PJ', 'corrente'));
    const pfCart = id(contaPadrao(contas, 'PF', 'cartao'));
    const pjCart = id(contaPadrao(contas, 'PJ', 'cartao'));
    const pjEsp  = id(contaPadrao(contas, 'PJ', 'especie'));
    const pfEsp  = id(contaPadrao(contas, 'PF', 'especie'));
    const ehCredito = f => /cr[eé]dito/i.test(f || '');
    const ehDinheiro = f => /^dinheiro$/i.test(String(f || '').trim());

    const base = (tabela, r) => {
      const m = meta[`${tabela}:${r.id}`] || {};
      return { key: `${tabela}:${r.id}`, tabela, id: String(r.id), meta: m,
               // '-' = escolha explícita de "nenhum" (desliga a automação para este lançamento)
               caixinhaId: m.caixinhaId && m.caixinhaId !== '-' ? m.caixinhaId : null,
               planoItemId: m.planoItemId && m.planoItemId !== '-' ? m.planoItemId : null,
               semCaixinha: m.caixinhaId === '-', semVinculo: m.planoItemId === '-',
               dividaId: m.dividaId || null, conciliado: !!m.conciliado, extratoRef: m.extratoRef || null,
               vinculoId: m.vinculoId || null, raw: r };
    };

    // PJ — receitas de clientes (Orçamentos / Financeiro)
    (src.entries || []).forEach(e => {
      const b = base('entries', e);
      const realizado = e.status === 'Realizado';
      out.push(Object.assign(b, {
        entidade: 'PJ', natureza: 'entrada', classe: 'receita',
        data: e.dataPag || '', competencia: e.dataPag || '', valor: r2(Math.abs(num(e.valor))),
        contaId: b.meta.contaId || (ehDinheiro(e.forma) && pjEsp) || pjCorr,
        categoria: e.origem || e.tipo || 'Cliente', descricao: e.cliente || '', forma: e.forma || '',
        realizado, afetaSaldo: realizado, origem: 'financeiro',
        dataServ: e.dataServ || '', cliente: e.cliente || '', tipoEntrada: e.tipo || '', auto: !!e.auto,
      }));
    });

    // PJ — saídas (Financeiro). natureza PESSOAL = dinheiro que sai da PJ para a PF.
    const prolaborePJ = new Set();
    (src.saidas || []).forEach(s => {
      const b = base('saidas', s);
      const realizado = s.status === 'Pago' || s.status === 'Realizado';
      const pessoal = String(s.natureza || '').toUpperCase() === 'PESSOAL';
      const ehPro = pessoal && (s.tipo === 'Pró-labore' || s.transferenciaParaMim === true);
      if (ehPro) prolaborePJ.add(String(s.id));
      const credito = ehCredito(s.forma);
      out.push(Object.assign(b, {
        entidade: 'PJ', natureza: 'saida',
        classe: ehPro ? 'prolabore' : (pessoal ? 'retirada' : 'despesa'),
        data: s.dataPag || '', competencia: s.dataCaixa || s.dataPag || '', valor: r2(Math.abs(num(s.valor))),
        contaId: b.meta.contaId || (credito && pjCart) || (ehDinheiro(s.forma) && pjEsp) || pjCorr,
        categoria: s.tipo || 'Outro', descricao: s.obs || s.tipo || '', forma: s.forma || '',
        realizado, afetaSaldo: realizado, origem: 'financeiro', natPJ: s.natureza || 'PROFISSIONAL',
      }));
    });

    // PF — entradas (pró-labore sincronizado da PJ, manuais, importadas)
    (src.entradasPF || []).forEach(e => {
      const b = base('entradas_pessoal', e);
      const ehPro = e.categoria === 'Pró-labore' || (e.saidaOrigemId && prolaborePJ.has(String(e.saidaOrigemId)));
      out.push(Object.assign(b, {
        entidade: 'PF', natureza: 'entrada', classe: ehPro ? 'prolabore' : 'receita',
        data: e.data || '', competencia: e.data || '', valor: r2(Math.abs(num(e.valor))),
        contaId: b.meta.contaId || (ehDinheiro(e.forma) && pfEsp) || pfCorr,
        categoria: ehPro ? 'Pró-labore' : (e.categoria || 'Outros'), descricao: e.descricao || '', forma: e.forma || '',
        realizado: true, afetaSaldo: true, origem: e.origem || 'manual', saidaOrigemId: e.saidaOrigemId || null,
      }));
    });

    // PF — saídas. As 'sincronizado' foram pagas pela conta PJ: contam como
    // gasto pessoal, mas o saldo já saiu da PJ (não mexem em conta PF).
    (src.saidasPF || []).forEach(s => {
      const b = base('saidas_pessoal', s);
      const pagoPJ = s.origem === 'sincronizado';
      out.push(Object.assign(b, {
        entidade: 'PF', natureza: 'saida', classe: 'despesa',
        data: s.data || '', competencia: s.data || '', valor: r2(Math.abs(num(s.valor))),
        contaId: pagoPJ ? null : (b.meta.contaId || (ehCredito(s.forma) && pfCart) || (ehDinheiro(s.forma) && pfEsp) || pfCorr),
        categoria: s.categoria || 'Outros', descricao: s.descricao || '', forma: s.forma || '',
        realizado: true, afetaSaldo: !pagoPJ, pagoPelaPJ: pagoPJ, origem: s.origem || 'manual',
        saidaOrigemId: s.saidaOrigemId || null,
      }));
    });

    // Transferências internas e ajustes de conciliação
    (src.transferencias || []).forEach(t => {
      out.push({
        key: `fin_transferencias:${t.id}`, tabela: 'fin_transferencias', id: String(t.id), raw: t, meta: {},
        entidade: t.entidade, natureza: t.tipo === 'ajuste' ? 'ajuste' : 'transferencia',
        classe: t.tipo === 'ajuste' ? 'ajuste' : 'transferencia', tipoTransf: t.tipo,
        data: t.data || '', competencia: t.data || '', valor: r2(Math.abs(num(t.valor))),
        contaId: t.origemContaId || null, destinoId: t.destinoContaId || null,
        caixinhaId: null, planoItemId: t.planoItemId || null, dividaId: null,
        categoria: 'Transferência', descricao: t.descricao || '', forma: '',
        realizado: true, afetaSaldo: true, conciliado: !!t.conciliado, extratoRef: t.extratoRef || null,
        vinculoId: t.vinculoId || null, origem: t.origem || 'manual',
      });
    });
    return out;
  }

  // Efeito de um movimento no saldo de uma conta (+ entra, − sai, 0 não mexe)
  function efeito(m, contaId) {
    if (!m.afetaSaldo || !m.realizado) return 0;
    if (m.natureza === 'entrada') return m.contaId === contaId ? m.valor : 0;
    if (m.natureza === 'saida')   return m.contaId === contaId ? -m.valor : 0;
    let v = 0;                                   // transferência / ajuste
    if (m.contaId === contaId)   v -= m.valor;
    if (m.destinoId === contaId) v += m.valor;
    return v;
  }

  // ── SALDOS ──────────────────────────────────────────────
  // saldo ao FINAL do dia `ate`. Conciliação informa saldo ao final de
  // data_saldo_inicial → só entram movimentos com data > essa data.
  function saldoConta(conta, movs, ate, cfg) {
    const temMarco = conta.saldoInicial != null && conta.saldoInicial !== '' && !!conta.dataSaldoInicial;
    const desde = temMarco ? conta.dataSaldoInicial : ((cfg && cfg.inicioFluxo) || '');
    let saldo = temMarco ? num(conta.saldoInicial) : 0;
    if (temMarco && ate < conta.dataSaldoInicial) {
      // antes do marco não há como saber o saldo: reconstrói para trás
      movs.forEach(m => { if (m.data > ate && m.data <= conta.dataSaldoInicial) saldo -= efeito(m, conta.id); });
      return { saldo: r2(saldo), conferido: true, desde: conta.dataSaldoInicial };
    }
    movs.forEach(m => {
      if (!m.data || m.data > ate) return;
      if (temMarco ? m.data <= desde : (desde && m.data < desde)) return;
      saldo += efeito(m, conta.id);
    });
    return { saldo: r2(saldo), conferido: temMarco, desde };
  }

  // ── PLANO ───────────────────────────────────────────────
  function realizadoDoItem(item, movs) {
    const tipoNat = item.tipo === 'aporte' ? ['transferencia'] :
                    item.tipo === 'receita' ? ['entrada'] : ['saida'];
    const ligados = movs.filter(m => m.planoItemId === item.id && m.realizado && tipoNat.includes(m.natureza));
    return { valor: r2(ligados.reduce((t, m) => t + m.valor, 0)), movs: ligados };
  }

  function statusItem(item, real, hoje, mes) {
    if (item.dispensado) return 'dispensado';
    if (item.reprogramadoPara) return 'reprogramado';
    const valor = num(item.valor);
    if (valor <= EPS || real >= valor - EPS) return 'feito';
    const data = dataDoDia(mes, item.dia);
    if (real > EPS) return data < hoje ? 'parcial-atrasado' : 'parcial';
    if (data < hoje) return 'atrasado';
    if (data === hoje) return 'hoje';
    return 'futuro';
  }
  const PENDENTE = st => ['atrasado', 'hoje', 'futuro', 'parcial', 'parcial-atrasado'].includes(st);

  // Enriquecer itens de um mês com data, semana, realizado, falta e status
  function itensDoMes(itens, mes, movs, hoje, cfg) {
    return itens.filter(i => i.mes === mes).map(i => {
      const r = realizadoDoItem(i, movs);
      const st = statusItem(i, r.valor, hoje, mes);
      const data = dataDoDia(mes, i.dia);
      const vivo = PENDENTE(st);
      return Object.assign({}, i, {
        _data: data, _semana: semanaDe(data, cfg), _realizado: r.valor, _movs: r.movs, _status: st,
        _falta: vivo ? r2(Math.max(0, num(i.valor) - r.valor)) : 0,
        _excedente: r2(Math.max(0, r.valor - num(i.valor))),
      });
    }).sort((a, b) => (a._data.localeCompare(b._data)) || ((a.ordem || 0) - (b.ordem || 0)));
  }

  // Quanto a PF efetivamente recebeu de um item de pró-labore (via trigger
  // PJ→PF ou lançamento PF ligado ao item).
  function recebidoPF(itemPro, movs) {
    const saidasPJ = new Set(movs.filter(m => m.tabela === 'saidas' && m.planoItemId === itemPro.id).map(m => m.id));
    return r2(movs.filter(m => m.tabela === 'entradas_pessoal' &&
      ((m.saidaOrigemId && saidasPJ.has(String(m.saidaOrigemId))) || m.planoItemId === itemPro.id))
      .reduce((t, m) => t + m.valor, 0));
  }

  // O que sai do saldo da conta (não de caixinha) num item do plano.
  // Pagamento coberto por caixinha já foi reservado no aporte → não conta.
  const consomeConta = i => i.tipo === 'aporte' || i.tipo === 'prolabore' || (i.tipo === 'pagamento' && !i.caixinhaId);

  // Distribuição de cada recebimento da PF (pró-labore 01 e 15, ou outra
  // receita planejada): o que sai dele vai até o próximo recebimento.
  function distribuicoesPF(itensMes, movs) {
    const receb = itensMes.filter(i => i.tipo === 'prolabore' || (i.tipo === 'receita' && i.entidade === 'PF'))
      .sort((a, b) => a._data.localeCompare(b._data));
    const saidas = itensMes.filter(i => i.entidade === 'PF' && consomeConta(i) && i.tipo !== 'prolabore'
                                        && !['dispensado', 'reprogramado'].includes(i._status));
    return receb.map((rc, k) => {
      const ini = k === 0 ? '0000-00-00' : rc._data;
      const prox = receb[k + 1] ? receb[k + 1]._data : '9999-99-99';
      const its = saidas.filter(i => i._data >= ini && i._data < prox);
      const previsto = num(rc.valor);
      const recebido = rc.tipo === 'prolabore' ? recebidoPF(rc, movs) : rc._realizado;
      const planejado = r2(its.reduce((t, i) => t + num(i.valor), 0));
      const distribuido = r2(its.reduce((t, i) => t + Math.min(num(i.valor), i._realizado), 0));
      return {
        recebimento: rc, previsto, recebido, itens: its, planejado, distribuido,
        faltaDistribuir: r2(its.reduce((t, i) => t + i._falta, 0)),
        sobraPlanejada: r2(previsto - planejado),
        sobraReal: r2(recebido - distribuido),
        recebidoCompleto: recebido >= previsto - EPS,
      };
    });
  }

  // ── RESUMO POR ENTIDADE ─────────────────────────────────
  function resumo(entidade, ctx) {
    const { contas, movs, itens, mes, hoje, cfg } = ctx;
    const ate = hoje < ultimoDia(mes) ? hoje : ultimoDia(mes);
    const doEnt = contas.filter(c => c.entidade === entidade && c.ativa !== false && c.tipo !== 'antiga');
    const saldos = doEnt.map(c => Object.assign({ conta: c }, saldoConta(c, movs, ate, cfg)));
    const soma = tipos => r2(saldos.filter(s => tipos.includes(s.conta.tipo)).reduce((t, s) => t + s.saldo, 0));
    const saldoBancario = soma(['corrente', 'especie']);
    const reservado = soma(['caixinha']);
    const cartoes = saldos.filter(s => s.conta.tipo === 'cartao');
    const faturaAberta = r2(cartoes.reduce((t, s) => t + Math.max(0, -s.saldo), 0));
    const reservaCartao = r2(saldos.filter(s => s.conta.tipo === 'caixinha' && s.conta.finalidade === 'cartao')
      .reduce((t, s) => t + Math.max(0, s.saldo), 0));
    const faturaACobrir = r2(Math.max(0, faturaAberta - reservaCartao));

    const im = itensDoMes(itens, mes, movs, hoje, cfg).filter(i => i.entidade === entidade);
    const pend = im.filter(i => PENDENTE(i._status));
    const compromissosPlano = r2(pend.filter(consomeConta).reduce((t, i) => t + i._falta, 0));
    // PJ: saídas "Previsto" do Financeiro no mês que não são item do plano
    const ligadas = new Set(im.map(i => i.id));
    const saidasPrevistas = entidade === 'PJ'
      ? r2(movs.filter(m => m.tabela === 'saidas' && !m.realizado && mesDe(m.data) === mes &&
          m.data >= hoje && !(m.planoItemId && ligadas.has(m.planoItemId))).reduce((t, m) => t + m.valor, 0))
      : 0;
    const compromissos = r2(compromissosPlano + saidasPrevistas);
    const disponivel = r2(saldoBancario - compromissos - faturaACobrir);

    const doMes = movs.filter(m => m.entidade === entidade && m.realizado && mesDe(m.data) === mes);
    const entrou = r2(doMes.filter(m => m.natureza === 'entrada').reduce((t, m) => t + m.valor, 0));
    const gastos = r2(movs.filter(m => m.entidade === entidade && m.realizado && m.classe === 'despesa'
      && mesDe(m.competencia || m.data) === mes).reduce((t, m) => t + m.valor, 0));
    const retiradas = r2(doMes.filter(m => m.classe === 'prolabore' && m.natureza === 'saida' || m.classe === 'retirada')
      .reduce((t, m) => t + m.valor, 0));
    const aportado = r2(doMes.filter(m => m.natureza === 'transferencia' && m.tipoTransf === 'aporte')
      .reduce((t, m) => t + m.valor, 0));

    const previstoEntrar = entidade === 'PF'
      ? r2(im.filter(i => i.tipo === 'receita').reduce((t, i) => t + num(i.valor), 0) +
           itensDoMes(itens, mes, movs, hoje, cfg).filter(i => i.tipo === 'prolabore').reduce((t, i) => t + num(i.valor), 0))
      : r2(movs.filter(m => m.tabela === 'entries' && mesDe(m.data) === mes).reduce((t, m) => t + m.valor, 0));
    // planejado para gastar = reservas (aportes) + pagamentos diretos da conta.
    // Pagamento coberto por caixinha NÃO soma de novo (já está no aporte).
    const previstoGastar = r2(im.filter(i => consomeConta(i) && i.tipo !== 'prolabore').reduce((t, i) => t + num(i.valor), 0));

    return {
      entidade, mes, ate, saldos, saldoBancario, reservado, faturaAberta, reservaCartao, faturaACobrir,
      compromissos, compromissosPlano, saidasPrevistas, disponivel,
      entrou, gastos, retiradas, aportado, previstoEntrar, previstoGastar,
      pendentes: pend, atrasados: pend.filter(i => /atrasado/.test(i._status)),
      itens: im, naoConferidas: saldos.filter(s => !s.conferido),
    };
  }

  // ── CAIXINHAS ───────────────────────────────────────────
  function caixinha(cx, ctx) {
    const { movs, itens, mes, hoje, cfg } = ctx;
    const ini = addDias(`${mes}-01`, -1);
    const fim = ultimoDia(mes);
    const ate = hoje < fim ? hoje : fim;
    const saldoInicio = saldoConta(cx, movs, ini, cfg).saldo;
    const sAtual = saldoConta(cx, movs, ate, cfg);
    const noMes = m => mesDe(m.data) === mes && m.realizado;
    const aportes = movs.filter(m => noMes(m) && m.natureza !== 'entrada' && m.natureza !== 'saida' && m.destinoId === cx.id);
    const saidasCx = movs.filter(m => noMes(m) && (m.natureza === 'transferencia' || m.natureza === 'ajuste') && m.contaId === cx.id);
    const usos = movs.filter(m => mesDe(m.competencia || m.data) === mes && m.realizado && m.classe === 'despesa' && m.caixinhaId === cx.id);
    const im = itensDoMes(itens, mes, movs, hoje, cfg).filter(i => i.caixinhaId === cx.id);
    const aportePrevisto = r2(im.filter(i => i.tipo === 'aporte').reduce((t, i) => t + num(i.valor), 0));
    const usoPrevisto = r2(im.filter(i => i.tipo === 'pagamento').reduce((t, i) => t + num(i.valor), 0));
    const totalAportado = r2(aportes.reduce((t, m) => t + m.valor, 0));
    const totalUsado = r2(usos.reduce((t, m) => t + m.valor, 0));
    return {
      caixinha: cx, saldoInicio, saldoAtual: sAtual.saldo, conferido: sAtual.conferido,
      aportePrevisto, aportado: totalAportado, aporteFalta: r2(Math.max(0, aportePrevisto - totalAportado)),
      usoPrevisto, usado: totalUsado, aportes, usos, retiradas: saidasCx,
      composicao: im.filter(i => i.tipo === 'pagamento'), itensAporte: im.filter(i => i.tipo === 'aporte'),
    };
  }

  // Despesas fixas (e qualquer caixinha com pagamentos planejados):
  // previsto, vencimento, pago, data do pagamento, diferença.
  function composicao(cx, ctx) {
    const c = caixinha(cx, ctx);
    return c.composicao.map(i => {
      const pago = i._realizado;
      const datas = i._movs.map(m => m.data).sort();
      return {
        item: i, descricao: i.descricao, previsto: num(i.valor), vencimento: i._data,
        pago, dataPagamento: datas.length ? datas[datas.length - 1] : '',
        diferenca: pago > 0 ? r2(pago - num(i.valor)) : null, status: i._status,
      };
    });
  }

  // ── SEMANADAS ───────────────────────────────────────────
  function semanadas(entidade, ctx) {
    const { contas, movs, itens, mes, hoje, cfg } = ctx;
    const cx = caixinhaPorFinalidade(contas, entidade, 'semanada');
    if (!cx) return null;
    const im = itensDoMes(itens, mes, movs, hoje, cfg).filter(i => i.caixinhaId === cx.id && i.tipo === 'aporte');
    const atendimentos = entidade === 'PJ' ? atendimentosPorData(movs) : null;
    const linhas = semanas(mes, cfg).map(w => {
      const dentro = d => d >= w.ini && d <= w.fim;
      const itensW = im.filter(i => i._semana === w.n);
      const idsW = new Set(itensW.map(i => i.id));
      const previsto = r2(itensW.reduce((t, i) => t + num(i.valor), 0));
      // aporte ligado a item da semana conta para a semana do item;
      // aporte avulso conta pela data
      const reservado = r2(movs.filter(m => m.natureza === 'transferencia' && m.destinoId === cx.id && m.realizado &&
        (m.planoItemId ? idsW.has(m.planoItemId) : dentro(m.data))).reduce((t, m) => t + m.valor, 0));
      const gastosW = movs.filter(m => m.classe === 'despesa' && m.realizado && m.caixinhaId === cx.id && dentro(m.data));
      const porCategoria = {};
      gastosW.forEach(m => { porCategoria[m.categoria] = r2((porCategoria[m.categoria] || 0) + m.valor); });
      const gasto = r2(gastosW.reduce((t, m) => t + m.valor, 0));
      let atend = null;
      if (atendimentos) atend = Object.keys(atendimentos).filter(dentro).reduce((t, d) => t + atendimentos[d], 0);
      return {
        semana: w, previsto, reservado, gasto, porCategoria, gastos: gastosW,
        saldo: r2(reservado - gasto), diferenca: r2(previsto - gasto),
        estourou: gasto > (reservado || previsto) + EPS,
        atendimentos: atend, custoPorAtendimento: atend ? r2(gasto / atend) : null,
        passada: w.fim < hoje, atual: hoje >= w.ini && hoje <= w.fim,
      };
    });
    return { caixinha: cx, linhas,
      previsto: r2(linhas.reduce((t, l) => t + l.previsto, 0)),
      reservado: r2(linhas.reduce((t, l) => t + l.reservado, 0)),
      gasto: r2(linhas.reduce((t, l) => t + l.gasto, 0)) };
  }

  // atendimentos PJ por data de serviço: cliente+data únicos (sinal e
  // restante da mesma cliente no mesmo dia = 1 atendimento)
  function atendimentosPorData(movs) {
    const vistos = new Set(), porData = {};
    movs.filter(m => m.tabela === 'entries' && m.dataServ).forEach(m => {
      const k = `${(m.cliente || '').toLowerCase().trim()}|${m.dataServ}`;
      if (vistos.has(k)) return;
      vistos.add(k);
      porData[m.dataServ] = (porData[m.dataServ] || 0) + 1;
    });
    return porData;
  }

  // ── RECEITA DA MAQUIAGEM ────────────────────────────────
  // Duas leituras, sem misturar: pelo CAIXA (data do pagamento) e pelo
  // SERVIÇO (data do atendimento). Agendado ≠ recebido.
  function receitaMaquiagem(ctx) {
    const { movs, mes, hoje } = ctx;
    const ent = movs.filter(m => m.tabela === 'entries');
    const caixa = ent.filter(m => mesDe(m.data) === mes);
    const serv = ent.filter(m => mesDe(m.dataServ || m.data) === mes);
    const s = (arr, f) => r2(arr.filter(f).reduce((t, m) => t + m.valor, 0));
    return {
      caixa: {
        recebido: s(caixa, m => m.realizado),
        aReceber: s(caixa, m => !m.realizado && m.data >= hoje),
        atrasado: s(caixa, m => !m.realizado && m.data < hoje),
        naoConciliado: s(caixa, m => m.realizado && !m.conciliado),
      },
      servico: {
        contratado: s(serv, () => true),
        recebido: s(serv, m => m.realizado),
        pendente: s(serv, m => !m.realizado),
        atendimentos: Object.values(atendimentosPorData(serv)).reduce((a, b) => a + b, 0),
      },
      atrasadosLista: ent.filter(m => !m.realizado && m.data < hoje).sort((a, b) => a.data.localeCompare(b.data)),
    };
  }

  // ── DÍVIDAS ─────────────────────────────────────────────
  function divida(d, movs) {
    const pagos = movs.filter(m => m.dividaId === d.id && m.realizado && m.natureza === 'saida');
    const posRef = d.dataSaldo ? pagos.filter(m => m.data > d.dataSaldo) : pagos;
    const pagoPosRef = r2(posRef.reduce((t, m) => t + m.valor, 0));
    const parcelasPagas = posRef.length;
    const parcelasRest = d.parcelasRestantes != null && d.parcelasRestantes !== ''
      ? Math.max(0, Number(d.parcelasRestantes) - parcelasPagas) : null;
    const emAbertoEst = d.totalEmAberto != null && d.totalEmAberto !== ''
      ? r2(Math.max(0, num(d.totalEmAberto) - pagoPosRef)) : null;
    return { divida: d, pagamentos: pagos, totalPago: r2(pagos.reduce((t, m) => t + m.valor, 0)),
             pagoPosRef, parcelasRestantesEst: parcelasRest, emAbertoEstimado: emAbertoEst };
  }

  // ── CONCILIAÇÃO DE EXTRATO ──────────────────────────────
  // Para cada linha do extrato (valor com sinal), procura o lançamento
  // equivalente já registrado na mesma conta. Encontrou → concilia (não
  // cria outro). Recebimento de cliente "Previsto" também casa: vira
  // Realizado em vez de virar uma segunda receita.
  function casarExtrato(linhas, contaId, movs, cfg) {
    const tol = (cfg && cfg.toleranciaDias != null) ? cfg.toleranciaDias : 5;
    const usados = new Set();
    const refs = new Set(movs.map(m => m.extratoRef).filter(Boolean));
    return linhas.map(l => {
      const valor = r2(Math.abs(l.valor));
      const credito = l.valor > 0;
      if (l.ref && refs.has(l.ref)) return { linha: l, acao: 'duplicada', match: null };
      const cands = movs.filter(m => {
        if (usados.has(m.key) || m.conciliado) return false;
        if (Math.abs(m.valor - valor) > 0.009) return false;
        if (Math.abs(difDias(m.data || l.data, l.data)) > tol) return false;
        if (credito) {
          if (m.natureza === 'entrada') return m.contaId === contaId;
          return (m.natureza === 'transferencia' || m.natureza === 'ajuste') && m.destinoId === contaId;
        }
        if (m.natureza === 'saida') return m.contaId === contaId;   // inclui saída PJ "Previsto" (vira Pago)
        return (m.natureza === 'transferencia' || m.natureza === 'ajuste') && m.contaId === contaId;
      }).sort((a, b) => (Math.abs(difDias(a.data, l.data)) - Math.abs(difDias(b.data, l.data)))
                     || ((b.realizado ? 1 : 0) - (a.realizado ? 1 : 0)));
      const match = cands[0] || null;
      if (match) usados.add(match.key);
      return { linha: l, acao: match ? 'conciliar' : 'novo', match,
               viraRealizado: !!(match && !match.realizado) };
    });
  }

  // Chave estável de uma linha de extrato (dedup entre importações)
  function refExtrato(contaId, l, ordemNoDia) {
    const d = String(l.descricao || '').toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 40);
    return `${contaId}|${l.data}|${r2(l.valor).toFixed(2)}|${d}|${ordemNoDia || 0}`;
  }

  // ── ANÁLISES ────────────────────────────────────────────
  function analiseMes(entidade, ctx) {
    const im = itensDoMes(ctx.itens, ctx.mes, ctx.movs, ctx.hoje, ctx.cfg).filter(i => i.entidade === entidade);
    const vivos = im.filter(i => !['dispensado', 'reprogramado'].includes(i._status));
    const planejado = r2(vivos.reduce((t, i) => t + num(i.valor), 0));
    const executado = r2(vivos.reduce((t, i) => t + Math.min(num(i.valor), i._realizado), 0));
    const acima = im.filter(i => i._excedente > EPS);
    const sem = semanadas(entidade, ctx);
    const cxs = ctx.contas.filter(c => c.entidade === entidade && c.tipo === 'caixinha' && c.ativa !== false)
      .map(c => caixinha(c, ctx));
    // gastos fora de qualquer caixinha (não planejados)
    const foraCx = ctx.movs.filter(m => m.entidade === entidade && m.classe === 'despesa' && m.realizado &&
      !m.caixinhaId && !m.planoItemId && mesDe(m.competencia || m.data) === ctx.mes);
    const cumprimento = planejado > 0 ? r2(executado / planejado * 100) : null;
    return {
      planejado, executado, cumprimento, acima, semanadas: sem, caixinhas: cxs,
      foraDasCaixinhas: foraCx, totalForaCx: r2(foraCx.reduce((t, m) => t + m.valor, 0)),
      estouros: cxs.filter(c => c.usado > c.aportePrevisto + c.saldoInicio + EPS && c.usado > 0),
    };
  }

  // Série histórica (n meses até `mes`) de semanadas e plano × real
  function historico(entidade, ctx, n) {
    const out = [];
    for (let k = n - 1; k >= 0; k--) {
      const mes = addMes(ctx.mes, -k);
      const c = Object.assign({}, ctx, { mes });
      const a = analiseMes(entidade, c);
      out.push({ mes, planejado: a.planejado, executado: a.executado, cumprimento: a.cumprimento,
        semanadaPrevista: a.semanadas ? a.semanadas.previsto : 0,
        semanadaReservada: a.semanadas ? a.semanadas.reservado : 0,
        semanadaGasta: a.semanadas ? a.semanadas.gasto : 0,
        foraCx: a.totalForaCx });
    }
    return out;
  }

  // ── PLANO: criar mês a partir do modelo / mês anterior ──
  // Retorna NOVOS objetos (cópia). Itens do mês de origem não mudam.
  // Itens avulsos (pontuais / reprogramados) não se repetem.
  // Vigência: item com mesInicio/mesFim só entra nos meses dentro do intervalo
  // (parcelas, dívidas com fim, compromissos temporários).
  const vigente = (i, mes) => (!i.mesInicio || mes >= i.mesInicio) && (!i.mesFim || mes <= i.mesFim);
  function copiarItens(itensOrigem, mesDestino, planoId, novoId) {
    return itensOrigem.filter(i => !i.avulso && vigente(i, mesDestino)).map((i, k) => ({
      id: novoId(), planoId, mes: mesDestino, entidade: i.entidade, tipo: i.tipo,
      dia: Math.min(Number(i.dia) || 1, 31), descricao: i.descricao, valor: num(i.valor),
      contaId: i.contaId || null, caixinhaId: i.caixinhaId || null, categoria: i.categoria || '',
      dividaId: i.dividaId || null, ordem: i.ordem != null ? i.ordem : k, dispensado: false,
      reprogramadoPara: null, avulso: false, obs: '',
      mesInicio: i.mesInicio || null, mesFim: i.mesFim || null, parcelas: i.parcelas || null,
      origemItemId: i.mes === 'modelo' ? i.id : (i.origemItemId || null),
    }));
  }
  function difMeses(a, b) { const [ya, ma] = a.split('-').map(Number), [yb, mb] = b.split('-').map(Number); return (ya - yb) * 12 + (ma - mb); }
  // "Consultoria financeira (2/5)" — número da parcela calculado pelo mês
  function nomeItem(i) {
    if (!i.parcelas || !i.mesInicio) return i.descricao;
    if (i.mes === 'modelo') return i.descricao + ' (' + i.parcelas + 'x)';
    return i.descricao + ' (' + (difMeses(i.mes, i.mesInicio) + 1) + '/' + i.parcelas + ')';
  }

  // ── AUTOMAÇÃO (só leitura: não grava nada) ──────────────
  const semAcento = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  function grupoDaCategoria(ent, cat, cfg) {
    const c = ((cfg && cfg.categorias && cfg.categorias[ent]) || []).find(x => semAcento(x.nome) === semAcento(cat));
    return c ? c.grupo : null;
  }
  function finalidadeDaCategoria(ent, cat, cfg) {
    if (!cfg || !cat) return null;
    const porCat = (cfg.caixinhaPorCategoria || {})[ent] || {};
    const k = Object.keys(porCat).find(x => semAcento(x) === semAcento(cat));
    if (k) return porCat[k];
    const g = grupoDaCategoria(ent, cat, cfg);
    return g ? (((cfg.caixinhaPorGrupo || {})[ent] || {})[g] || null) : null;
  }
  function caixinhaDaCategoria(contas, ent, cat, cfg) {
    const f = finalidadeDaCategoria(ent, cat, cfg);
    return f ? caixinhaPorFinalidade(contas, ent, f) : null;
  }

  // Um lançamento sem item do plano casa com qual item? (mesmo mês)
  function itemCompativel(m, i) {
    if (i.tipo === 'aporte') return m.natureza === 'transferencia' && m.destinoId === i.caixinhaId && m.tipoTransf !== 'resgate';
    if (i.tipo === 'prolabore') return m.tabela === 'saidas' && m.classe === 'prolabore';
    if (i.tipo === 'pagamento') return m.natureza === 'saida' && m.classe === 'despesa' && m.entidade === i.entidade &&
      !!i.categoria && semAcento(m.categoria) === semAcento(i.categoria) && (!m.caixinhaId || !i.caixinhaId || m.caixinhaId === i.caixinhaId);
    if (i.tipo === 'receita') return m.natureza === 'entrada' && m.classe === 'receita' && m.entidade === 'PF' && i.entidade === 'PF' &&
      !!i.categoria && semAcento(m.categoria) === semAcento(i.categoria);
    return false;
  }

  // Aplica, em memória, o que dá para deduzir sem perguntar:
  //  1) liga lançamentos ao item do plano compatível (mesmo mês, com saldo a cumprir)
  //  2) herda caixinha e dívida do item ligado
  //  3) deduz a caixinha pela categoria (config caixinhaPorGrupo/Categoria)
  // Escolha explícita da Carol (inclusive "nenhum") sempre vence.
  function automatizar(movs, itens, contas, cfg) {
    const inicio = (cfg && cfg.inicioFluxo) || '';
    const porId = {};
    itens.forEach(i => { porId[i.id] = i; });
    const usado = {};
    movs.forEach(m => { if (m.planoItemId && porId[m.planoItemId] && m.realizado) usado[m.planoItemId] = (usado[m.planoItemId] || 0) + m.valor; });
    const cap = i => num(i.valor) - (usado[i.id] || 0);
    const porMes = {};
    itens.forEach(i => { if (i.mes !== 'modelo' && !i.dispensado && !i.reprogramadoPara) (porMes[i.mes] = porMes[i.mes] || []).push(i); });
    movs.filter(m => !m.planoItemId && !m.semVinculo && m.realizado && m.data >= inicio)
      .sort((a, b) => a.data.localeCompare(b.data)).forEach(m => {
        const cands = (porMes[mesDe(m.data)] || []).filter(i => cap(i) > EPS && itemCompativel(m, i));
        if (!cands.length) return;
        const exato = i => Math.abs(cap(i) - m.valor) < 0.01 ? 0 : 1;
        const dist = i => Math.abs(difDias(dataDoDia(i.mes, i.dia), m.data));
        cands.sort((a, b) => exato(a) - exato(b) || dist(a) - dist(b));
        m.planoItemId = cands[0].id; m.autoVinculo = true;
        usado[cands[0].id] = (usado[cands[0].id] || 0) + m.valor;
      });
    movs.forEach(m => {
      const i = m.planoItemId && porId[m.planoItemId];
      if (i) {
        if (!m.caixinhaId && !m.semCaixinha && i.caixinhaId && m.classe === 'despesa') { m.caixinhaId = i.caixinhaId; m.caixinhaAuto = true; }
        if (!m.dividaId && i.dividaId) m.dividaId = i.dividaId;
      }
      if (m.classe === 'despesa' && !m.caixinhaId && !m.semCaixinha && m.data >= inicio && !m.pagoPelaPJ) {
        const cx = caixinhaDaCategoria(contas, m.entidade, m.categoria, cfg);
        if (cx) { m.caixinhaId = cx.id; m.caixinhaAuto = true; }
      }
    });
    return movs;
  }

  // ── EXTRATO: sugestões automáticas ──────────────────────
  const PALAVRAS_VAZIAS = /\b(pix|ted|doc|enviado|enviada|recebido|recebida|transferencia|compra|debito|credito|cartao|pagamento|pgto|no|na|de|da|do|em|para|com)\b/g;
  function chaveExtrato(desc) {
    return semAcento(desc).replace(/[0-9]/g, ' ').replace(/[^a-z ]/g, ' ').replace(PALAVRAS_VAZIAS, ' ')
      .replace(/\s+/g, ' ').trim().slice(0, 40);
  }
  function sugerirCategoria(desc, ent, cfg) {
    const d = semAcento(desc);
    const lista = ((cfg && cfg.palavrasCategoria) || {})[ent] || [];
    for (const par of lista) { try { if (new RegExp(par[0]).test(d)) return par[1]; } catch (_) {} }
    return '';
  }
  function tipoInterno(desc, cfg) {
    const d = semAcento(desc), pt = (cfg && cfg.palavrasTransferencia) || {};
    try { if (pt.fatura && new RegExp(pt.fatura).test(d)) return 'fatura'; } catch (_) {}
    try { if (pt.caixinha && new RegExp(pt.caixinha).test(d)) return 'caixinha'; } catch (_) {}
    return null;
  }
  function regraAprendida(desc, ent, cfg) {
    const k = chaveExtrato(desc);
    if (!k) return null;
    const regras = ((cfg && cfg.regrasExtrato) || {})[ent] || [];
    return regras.find(r => r.chave === k) || regras.find(r => r.chave.length >= 5 && k.includes(r.chave)) || null;
  }

  // ── DÍVIDAS: visão geral e simulação ────────────────────
  function resumoDividas(dividas, movs, ents) {
    const ativas = dividas.filter(d => d.ativa !== false && d.situacao !== 'quitada' && (!ents || ents.includes(d.entidade)));
    const det = ativas.map(d => divida(d, movs));
    const s = (arr, f) => r2(arr.reduce((t, x) => t + (num(f(x)) || 0), 0));
    const fora = det.filter(x => (x.divida.situacao || 'fora_do_plano') === 'fora_do_plano');
    const plano = det.filter(x => x.divida.situacao === 'no_plano');
    return {
      detalhes: det, fora, plano,
      quitacao: s(det, x => x.divida.saldoDevedor),
      emAberto: s(det, x => x.emAbertoEstimado != null ? x.emAbertoEstimado : x.divida.saldoDevedor),
      parcelasMes: s(det, x => x.divida.valorParcela),
      parcelasNoPlano: s(plano, x => x.divida.valorParcela),
      parcelasForaPlano: s(fora, x => x.divida.valorParcela),
      quitacaoFora: s(fora, x => x.divida.saldoDevedor),
    };
  }
  // Simulação APROXIMADA: parte do valor de quitação, aplica os juros
  // mensais informados e joga todo o orçamento mensal na dívida prioritária.
  function simularDividas(dividas, orcamento, estrategia, mesInicio) {
    const lista = dividas.filter(d => num(d.saldoDevedor) > 0)
      .map(d => ({ d, saldo: num(d.saldoDevedor), taxa: num(d.taxaMes), pago: 0, juros: 0, quitaEm: null }));
    const ordens = {
      juros: (a, b) => b.taxa - a.taxa || a.saldo - b.saldo,
      saldo: (a, b) => a.saldo - b.saldo,
      prioridade: (a, b) => (num(a.d.prioridade) || 99) - (num(b.d.prioridade) || 99) || b.taxa - a.taxa,
    };
    const ordem = ordens[estrategia] || ordens.juros;
    if (!(orcamento > 0) || !lista.length) return { meses: null, mesFinal: null, insuficiente: !!lista.length, totalJuros: 0, lista: [] };
    let mes = mesInicio, k = 0;
    while (lista.some(x => x.saldo > EPS) && k < 240) {
      lista.forEach(x => { if (x.saldo > EPS) { const j = x.saldo * x.taxa; x.saldo += j; x.juros += j; } });
      let caixa = orcamento;
      lista.filter(x => x.saldo > EPS).sort(ordem).forEach(x => {
        const p = Math.min(caixa, x.saldo); x.saldo -= p; x.pago += p; caixa -= p;
        if (x.saldo <= EPS && !x.quitaEm) x.quitaEm = mes;
      });
      k++; mes = addMes(mes, 1);
    }
    const tudo = lista.every(x => x.saldo <= EPS);
    return { meses: tudo ? k : null, mesFinal: tudo ? addMes(mesInicio, k - 1) : null, insuficiente: !tudo,
             totalJuros: r2(lista.reduce((t, x) => t + x.juros, 0)),
             lista: lista.map(x => ({ divida: x.d, pago: r2(x.pago), juros: r2(x.juros), quitaEm: x.quitaEm })) };
  }

  // Verificação de coerência do plano (avisos, não bloqueia)
  function checarPlano(itensMes, contas) {
    const avisos = [];
    const pf = distribuicoesPF(itensMes, []);
    pf.forEach(d => { if (d.sobraPlanejada < -EPS) avisos.push({ tipo: 'deficit',
      msg: `${d.recebimento.descricao}: distribuição planejada (${d.planejado}) maior que o valor a receber (${d.previsto}).` }); });
    contas.filter(c => c.tipo === 'caixinha').forEach(c => {
      const ap = itensMes.filter(i => i.tipo === 'aporte' && i.caixinhaId === c.id).reduce((t, i) => t + num(i.valor), 0);
      const pg = itensMes.filter(i => i.tipo === 'pagamento' && i.caixinhaId === c.id).reduce((t, i) => t + num(i.valor), 0);
      if (pg > ap + EPS) avisos.push({ tipo: 'caixinha', caixinhaId: c.id,
        msg: `${c.nome}: pagamentos previstos (${r2(pg)}) maiores que os aportes (${r2(ap)}) — depende de saldo acumulado.` });
    });
    return avisos;
  }

  return {
    EPS, r2, num, parseValor, diasNoMes, dataDoDia, mesDe, diaDe, addMes, addDias, difDias, ultimoDia,
    semanas, semanaDe, contaPadrao, caixinhaPorFinalidade, normalizar, efeito, saldoConta,
    realizadoDoItem, statusItem, PENDENTE, itensDoMes, recebidoPF, consomeConta, distribuicoesPF,
    resumo, caixinha, composicao, semanadas, atendimentosPorData, receitaMaquiagem, divida,
    casarExtrato, refExtrato, analiseMes, historico, copiarItens, checarPlano,
    vigente, difMeses, nomeItem, semAcento, grupoDaCategoria, finalidadeDaCategoria, caixinhaDaCategoria,
    itemCompativel, automatizar, chaveExtrato, sugerirCategoria, tipoInterno, regraAprendida,
    resumoDividas, simularDividas,
  };
})();

if (typeof module !== 'undefined') module.exports = FX;
