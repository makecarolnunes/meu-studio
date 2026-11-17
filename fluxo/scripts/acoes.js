// ════════════════════════════════════════════════════════════
// fluxo/scripts/acoes.js — EXECUÇÃO do planejamento
// Cada ação grava a movimentação REAL e (quando houver) liga ao item
// do plano. Nada é marcado como feito sem movimentação.
// ════════════════════════════════════════════════════════════

const AC = (function () {
  'use strict';
  const r2 = FX.r2, num = FX.num;

  function _erro(msg) { const e = new Error(msg); e.usuario = true; return e; }
  function _valor(v) {
    const n = FX.parseValor(v);
    if (!(n > 0)) throw _erro('Informe um valor maior que zero.');
    return r2(n);
  }
  function _data(d) { if (!/^\d{4}-\d{2}-\d{2}$/.test(d || '')) throw _erro('Informe a data.'); return d; }
  function _planoAberto(mes) {
    const p = stPlano(mes);
    if (p && p.status === 'fechado') throw _erro('Este mês está fechado. Reabra o planejamento para editar.');
    return p;
  }
  function _corrente(ent) {
    const c = FX.contaPadrao(ST.contas, ent, 'corrente');
    if (!c) throw _erro(`Cadastre a conta corrente ${ent} em Ajustes › Contas.`);
    return c;
  }
  function _formaDaConta(conta, forma) {
    if (!conta) return forma || 'PIX';
    if (conta.tipo === 'cartao') return 'Crédito';
    if (conta.tipo === 'especie') return 'Dinheiro';
    return forma && !/cr[eé]dito|dinheiro/i.test(forma) ? forma : 'PIX';
  }

  // ── ESTRUTURA INICIAL (a partir da planilha) ─────────────
  async function configurarInicial(mesInicial, opts) {
    opts = opts || {};
    if (ST.contas.length) throw _erro('A estrutura já foi criada. Edite pelas telas de Ajustes.');
    if (!/^\d{4}-\d{2}$/.test(mesInicial || '')) throw _erro('Escolha o mês inicial.');
    const M = FX_MODELO, ids = {};
    M.contas.forEach(c => { ids[c.key] = stId('ct'); });
    const contas = M.contas.map((c, k) => ({
      id: ids[c.key], entidade: c.entidade, tipo: c.tipo, nome: c.nome, banco: c.banco || '',
      finalidade: c.finalidade || '', contaPaiId: c.pai ? ids[c.pai] : null,
      saldoInicial: null, dataSaldoInicial: null,          // só a conciliação define saldo
      padrao: !!c.padrao, ativa: true, ordem: k, obs: '',
    }));
    await stSalvarVarios('fin_contas', contas, 'setup-contas');

    const dids = {};
    const dividas = M.dividas.map(d => {
      const id = stId('dv'); if (d.key) dids[d.key] = id;
      return { id, entidade: d.entidade, nome: d.nome, credor: d.credor || '', taxaMes: d.taxaMes ?? null,
        valorPrincipal: d.valorPrincipal ?? null, saldoDevedor: d.saldoDevedor ?? null, dataSaldo: null,
        totalEmAberto: d.totalEmAberto ?? null, valorParcela: d.valorParcela ?? null,
        parcelasRestantes: d.parcelasRestantes ?? null, diaVencimento: d.diaVencimento ?? null,
        situacao: d.situacao || 'fora_do_plano', prioridade: null, ativa: true, obs: d.obs || '' };
    });
    await stSalvarVarios('fin_dividas', dividas, 'setup-dividas');

    const modelo = await stSalvar('fin_planos', { id: stId('pl'), mes: 'modelo', status: 'aberto', origem: M.fonte, obs: '' }, 'setup-modelo');
    const itens = M.itens.map((i, k) => ({
      id: stId('it'), planoId: modelo.id, mes: 'modelo', entidade: i.entidade, tipo: i.tipo, dia: i.dia,
      descricao: i.descricao, valor: i.valor,
      contaId: i.conta ? ids[i.conta] : null, caixinhaId: i.caixinha ? ids[i.caixinha] : null,
      categoria: i.categoria || '', dividaId: i.divida ? dids[i.divida] : null,
      ordem: k, dispensado: false, reprogramadoPara: null, avulso: false, obs: '',
      mesInicio: _mesToken(i.mesInicio, mesInicial), mesFim: _mesToken(i.mesFim, mesInicial), parcelas: i.parcelas || null,
    }));
    await stSalvarVarios('fin_plano_itens', itens, 'setup-itens');

    const cfg = JSON.parse(JSON.stringify(M.config));
    cfg.inicioFluxo = `${mesInicial}-01`;
    await stSalvarCfg(cfg);
    await criarMes(mesInicial, 'modelo');
    // Caixinhas novas (Planos de Ação: "criar as caixinhas") começam em zero —
    // só se você confirmar no assistente. Contas correntes/cartões: saldo real depois.
    if (opts.caixinhasZeradas) {
      const vespera = FX.addDias(cfg.inicioFluxo, -1);
      for (const c of ST.contas.filter(c => c.tipo === 'caixinha'))
        await conciliar(c.id, { data: vespera, saldoBanco: '0', obs: 'Caixinha nova — começa zerada (confirmado no assistente)' });
    }
    return { contas: contas.length, dividas: dividas.length, itens: itens.length };
  }

  function _mesToken(v, base) {
    if (!v) return null;
    if (v === '@inicio') return base;
    const m = /^@inicio\+(\d+)$/.exec(v);
    return m ? FX.addMes(base, Number(m[1])) : v;
  }

  // ── AUTOMÁTICO AO ABRIR ──────────────────────────────────
  // Cria o plano do mês atual (e do próximo a partir do dia configurado)
  // a partir do modelo, e fecha meses antigos. Nada disso movimenta dinheiro.
  async function garantirMeses(hoje) {
    hoje = hoje || stHoje();
    if (ST.migracaoOk === false || !ST.contas.length || !ST.itens.some(i => i.mes === 'modelo')) return [];
    const cfg = ST.cfg || FX_MODELO.config, feitos = [];
    const atual = FX.mesDe(hoje);
    const alvo = [atual];
    if (FX.diaDe(hoje) >= (cfg.diaCriarProximoMes || 20)) alvo.push(FX.addMes(atual, 1));
    const inicio = cfg.inicioFluxo ? FX.mesDe(cfg.inicioFluxo) : atual;
    for (const mes of alvo) {
      if (mes < inicio || stPlano(mes)) continue;
      await criarMes(mes, 'modelo');
      feitos.push({ acao: 'criado', mes });
    }
    const limite = FX.addMes(atual, -(cfg.fecharMesesAposMeses || 2));
    for (const p of ST.planos.filter(p => p.mes !== 'modelo' && p.status === 'aberto' && p.mes <= limite && !p.reaberto)) {
      await stSalvar('fin_planos', Object.assign({}, p, { status: 'fechado' }), 'fechar-mes-auto');
      feitos.push({ acao: 'fechado', mes: p.mes });
    }
    return feitos;
  }

  // Confirma de uma vez os APORTES pendentes com data até hoje, pelos valores
  // planejados (um toque = sua confirmação de que transferiu como planejado).
  async function executarComoPlanejado(ids, hoje) {
    hoje = hoje || stHoje();
    let n = 0;
    for (const id of ids) {
      const it = stItem(id);
      if (!it || it.tipo !== 'aporte') continue;
      const r = FX.realizadoDoItem(it, stMovs());
      const falta = FX.r2(FX.num(it.valor) - r.valor);
      const data = FX.dataDoDia(it.mes, it.dia);
      if (falta <= FX.EPS || data > hoje || it.dispensado || it.reprogramadoPara) continue;
      await executarAporte(id, { valor: falta, data });
      n++;
    }
    return n;
  }

  // ── PLANEJAMENTO ─────────────────────────────────────────
  // Novo mês = CÓPIA do modelo ou do mês anterior. Mudanças depois
  // não afetam outros meses nem movimentações já feitas.
  async function criarMes(mes, origem) {
    if (stPlano(mes)) throw _erro('Este mês já tem planejamento.');
    let fonte;
    if (origem === 'anterior') {
      const ant = FX.addMes(mes, -1);
      fonte = ST.itens.filter(i => i.mes === ant);
      if (!fonte.length) throw _erro('O mês anterior não tem planejamento para copiar.');
    } else {
      fonte = ST.itens.filter(i => i.mes === 'modelo');
      if (!fonte.length) throw _erro('O modelo está vazio.');
    }
    const plano = await stSalvar('fin_planos', { id: stId('pl'), mes, status: 'aberto',
      origem: origem === 'anterior' ? FX.addMes(mes, -1) : 'modelo', obs: '' }, 'criar-mes');
    const novos = FX.copiarItens(fonte, mes, plano.id, () => stId('it'));
    await stSalvarVarios('fin_plano_itens', novos, 'criar-mes-itens');
    return { plano, itens: novos };
  }

  async function salvarItem(dados) {
    const mes = dados.mes;
    if (mes !== 'modelo') _planoAberto(mes);
    let plano = stPlano(mes);
    if (!plano) throw _erro('Crie o planejamento do mês primeiro.');
    if (!['prolabore', 'receita', 'aporte', 'pagamento'].includes(dados.tipo)) throw _erro('Tipo inválido.');
    if (dados.tipo === 'aporte' && !dados.caixinhaId) throw _erro('Escolha a caixinha que recebe o aporte.');
    const dia = Number(dados.dia);
    if (!(dia >= 1 && dia <= 31)) throw _erro('Dia inválido (1 a 31).');
    const atual = dados.id ? stItem(dados.id) : null;
    const reg = Object.assign({}, atual || { ordem: ST.itens.filter(i => i.mes === mes).length, dispensado: false,
      reprogramadoPara: null, avulso: mes !== 'modelo' && !!dados.avulso, obs: '' }, {
      id: dados.id || undefined, planoId: plano.id, mes, entidade: dados.tipo === 'prolabore' ? 'PJ' : dados.entidade,
      tipo: dados.tipo, dia, descricao: String(dados.descricao || '').trim() || 'Sem descrição',
      valor: r2(num(dados.valor)), contaId: dados.contaId || null, caixinhaId: dados.caixinhaId || null,
      categoria: dados.categoria || '', dividaId: dados.dividaId || null,
    });
    if ('avulso' in dados && mes !== 'modelo') reg.avulso = !!dados.avulso;
    ['mesInicio', 'mesFim'].forEach(k => { if (k in dados) reg[k] = dados[k] || null; });
    if ('parcelas' in dados) reg.parcelas = dados.parcelas ? Number(dados.parcelas) : null;
    const salvo = await stSalvar('fin_plano_itens', reg);
    if (dados.propagar && mes !== 'modelo') await _propagar(salvo);
    return salvo;
  }

  // "Aplicar também aos próximos meses": atualiza o item do modelo que gerou
  // este e os meses futuros já criados (só itens ainda sem movimentação).
  async function _propagar(item) {
    const campos = ['descricao', 'valor', 'dia', 'caixinhaId', 'contaId', 'categoria', 'dividaId', 'mesInicio', 'mesFim', 'parcelas'];
    const pegar = o => { const r = {}; campos.forEach(k => { r[k] = item[k] ?? null; }); return r; };
    let modelo = item.origemItemId ? stItem(item.origemItemId) : null;
    if (!modelo) {
      const plM = stPlano('modelo');
      modelo = await stSalvar('fin_plano_itens', Object.assign({ id: stId('it'), planoId: plM.id, mes: 'modelo', entidade: item.entidade,
        tipo: item.tipo, ordem: 999, dispensado: false, reprogramadoPara: null, avulso: false, obs: '' }, pegar(item)), 'propagar-modelo-novo');
      await stSalvar('fin_plano_itens', Object.assign({}, item, { origemItemId: modelo.id }), 'propagar-ligar');
    } else {
      await stSalvar('fin_plano_itens', Object.assign({}, modelo, pegar(item)), 'propagar-modelo');
    }
    const futuros = ST.itens.filter(i => i.mes !== 'modelo' && i.mes > item.mes && i.origemItemId === modelo.id &&
      (stPlano(i.mes) || {}).status !== 'fechado' && !FX.realizadoDoItem(i, stMovs()).movs.length);
    for (const f of futuros) await stSalvar('fin_plano_itens', Object.assign({}, f, pegar(item)), 'propagar-mes');
  }

  async function removerItem(id) {
    const it = stItem(id);
    if (!it) return;
    if (it.mes !== 'modelo') _planoAberto(it.mes);
    const r = FX.realizadoDoItem(it, stMovs());
    if (r.movs.length) throw _erro('Este item já tem movimentação registrada. Use "Dispensar" para manter o histórico.');
    await stRemover('fin_plano_itens', id);
  }

  async function dispensarItem(id, motivo) {
    const it = stItem(id);
    _planoAberto(it.mes);
    return stSalvar('fin_plano_itens', Object.assign({}, it, { dispensado: true,
      obs: [it.obs, 'Dispensado: ' + (motivo || 'sem motivo')].filter(Boolean).join(' · ') }), 'dispensar');
  }
  async function retomarItem(id) {
    const it = stItem(id);
    _planoAberto(it.mes);
    return stSalvar('fin_plano_itens', Object.assign({}, it, { dispensado: false }), 'retomar');
  }

  // Reprogramar: nova data no mesmo mês, ou o que falta vai para o mês
  // seguinte como item avulso (o original fica registrado como reprogramado).
  async function reprogramarItem(id, opt) {
    const it = stItem(id);
    if (!it) throw _erro('Item não encontrado.');
    _planoAberto(it.mes);
    if (opt && opt.novoDia) {
      return stSalvar('fin_plano_itens', Object.assign({}, it, { dia: Number(opt.novoDia),
        obs: [it.obs, `Reprogramado do dia ${it.dia}`].filter(Boolean).join(' · ') }), 'reprogramar-dia');
    }
    const prox = FX.addMes(it.mes, 1);
    if (!stPlano(prox)) await criarMes(prox, 'modelo');
    const r = FX.realizadoDoItem(it, stMovs());
    const falta = r2(Math.max(0, num(it.valor) - r.valor));
    if (falta <= 0) throw _erro('Nada a reprogramar: o item já foi realizado.');
    const novo = await salvarItem({ mes: prox, entidade: it.entidade, tipo: it.tipo, dia: opt && opt.dia ? opt.dia : 1,
      descricao: `${it.descricao} (reprogramado de ${it.mes.slice(5)}/${it.mes.slice(0, 4)})`, valor: falta,
      contaId: it.contaId, caixinhaId: it.caixinhaId, categoria: it.categoria, dividaId: it.dividaId, avulso: true });
    // o item original passa a valer o que foi realizado; o resto foi transportado
    await stSalvar('fin_plano_itens', Object.assign({}, it, { reprogramadoPara: novo.id,
      obs: [it.obs, `R$ ${falta.toFixed(2)} reprogramado para ${prox}`].filter(Boolean).join(' · ') }), 'reprogramar-mes');
    return novo;
  }

  async function fecharMes(mes) {
    const p = stPlano(mes); if (!p) return;
    return stSalvar('fin_planos', Object.assign({}, p, { status: 'fechado' }), 'fechar-mes');
  }
  async function reabrirMes(mes) {
    const p = stPlano(mes); if (!p) return;
    return stSalvar('fin_planos', Object.assign({}, p, { status: 'aberto', reaberto: true }), 'reabrir-mes');
  }

  // ── TRANSFERÊNCIAS (aporte, resgate, fatura) — nunca despesa ──
  async function transferir(d) {
    const valor = _valor(d.valor), data = _data(d.data);
    const o = d.origemId ? stConta(d.origemId) : null, de = d.destinoId ? stConta(d.destinoId) : null;
    if (d.tipo !== 'ajuste') {
      if (!o || !de) throw _erro('Escolha a conta de origem e a de destino.');
      if (o.id === de.id) throw _erro('Origem e destino iguais.');
      if (o.entidade !== de.entidade) throw _erro('Transferência PF ↔ PJ é pró-labore (ou retirada): use "Pagar pró-labore".');
    }
    let tipo = d.tipo;
    if (!tipo) tipo = de.tipo === 'caixinha' ? 'aporte' : de.tipo === 'cartao' ? 'fatura' : o.tipo === 'caixinha' ? 'resgate' : 'entre_contas';
    return stSalvar('fin_transferencias', {
      id: stId('tr'), entidade: (o || de).entidade, data, valor, origemContaId: o ? o.id : null,
      destinoContaId: de ? de.id : null, tipo, descricao: d.descricao || '', planoItemId: d.planoItemId || null,
      vinculoId: d.vinculoId || null, conciliado: !!d.conciliado, extratoRef: d.extratoRef || null,
      origem: d.origem || 'manual', criadoPor: ST.usuario || '',
    }, 'transferir-' + tipo);
  }

  async function executarAporte(itemId, d) {
    const it = stItem(itemId);
    if (!it || it.tipo !== 'aporte') throw _erro('Item de aporte não encontrado.');
    const origem = d.origemId || it.contaId || _corrente(it.entidade).id;
    return transferir({ valor: d.valor, data: d.data, origemId: origem, destinoId: it.caixinhaId,
      tipo: 'aporte', descricao: it.descricao, planoItemId: it.id });
  }

  async function pagarFatura(d) {
    const cartao = stConta(d.cartaoId);
    if (!cartao || cartao.tipo !== 'cartao') throw _erro('Escolha o cartão.');
    return transferir({ valor: d.valor, data: d.data, origemId: d.origemId || _corrente(cartao.entidade).id,
      destinoId: cartao.id, tipo: 'fatura', descricao: d.descricao || `Pagamento fatura ${cartao.nome}` });
  }

  // ── GASTOS (despesa real) ────────────────────────────────
  // contaId = de onde o dinheiro saiu (corrente, caixinha, cartão, espécie)
  // caixinhaId = qual reserva banca o gasto (finalidade)
  // resgatar = se saiu da corrente mas é dinheiro da caixinha, registra
  //            o resgate caixinha → corrente (como no app do banco).
  async function registrarGasto(d) {
    const ent = d.entidade;
    if (ent === 'PF' && !ST.pfLiberado) throw _erro('Entre no financeiro pessoal para lançar gastos PF.');
    const valor = _valor(d.valor), data = _data(d.data);
    const conta = d.contaId ? stConta(d.contaId) : _corrente(ent);
    if (!conta || conta.entidade !== ent) throw _erro('Conta inválida para ' + ent + '.');
    if (d.pessoal && ent === 'PJ') return _gastoPessoalNaPJ(d, valor, data, conta);
    // caixinha: escolhida > conta-caixinha > item do plano > dedução pela categoria. '-' = nenhuma.
    const cfg = ST.cfg || FX_MODELO.config;
    let planoItemId = d.planoItemId && d.planoItemId !== '-' ? d.planoItemId : null;
    if (!planoItemId && d.planoItemId !== '-') {
      const fake = { natureza: 'saida', classe: 'despesa', entidade: ent, categoria: d.categoria || '', caixinhaId: d.caixinhaId && d.caixinhaId !== '-' ? d.caixinhaId : null, valor };
      const im = FX.itensDoMes(ST.itens, FX.mesDe(data), stMovs(), stHoje(), cfg)
        .filter(i => i.tipo === 'pagamento' && FX.PENDENTE(i._status) && i._falta > FX.EPS && FX.itemCompativel(fake, i));
      if (im.length) planoItemId = im.sort((a, b) => Math.abs(a._falta - valor) - Math.abs(b._falta - valor))[0].id;
    }
    const itemPl = planoItemId ? stItem(planoItemId) : null;
    let caixinhaId = d.caixinhaId === '-' ? null
      : (d.caixinhaId || (conta.tipo === 'caixinha' ? conta.id : null) || (itemPl && itemPl.caixinhaId) ||
         ((FX.caixinhaDaCategoria(ST.contas, ent, d.categoria, cfg) || {}).id) || null);
    const dividaId = d.dividaId || (itemPl && itemPl.dividaId) || null;
    const forma = _formaDaConta(conta, d.forma);
    const desc = String(d.descricao || '').trim() || d.categoria || 'Gasto';
    let tabela, regId;
    if (ent === 'PF') {
      regId = stId('p');
      await stSalvarPF('saida', { id: regId, usuarioId: null, data, descricao: desc, valor,
        categoria: d.categoria || 'Outros', forma, origem: d.origem === 'importacao' ? 'importacao' : 'manual',
        saidaOrigemId: null, createdAt: new Date().toISOString() });
      tabela = 'saidas_pessoal';
    } else {
      regId = String(Date.now()) + Math.floor(Math.random() * 1000);
      await stSalvarSaidaPJ({ id: regId, dataPag: data, dataCaixa: data, tipo: d.categoria || 'Outro', valor: String(valor),
        forma, status: 'Pago', obs: desc, recorrencia: 'unica', grupoId: null, natureza: d.natureza || 'PROFISSIONAL',
        transferenciaParaMim: false, createdAt: new Date().toISOString() });
      tabela = 'saidas';
    }
    await stSalvarMeta(tabela, regId, { contaId: conta.id, caixinhaId: caixinhaId || (d.caixinhaId === '-' ? '-' : null),
      planoItemId: planoItemId || (d.planoItemId === '-' ? '-' : null),
      dividaId, conciliado: !!d.conciliado, extratoRef: d.extratoRef || null });
    let resgate = null;
    if (caixinhaId && caixinhaId !== conta.id && conta.tipo !== 'cartao' && d.resgatar !== false) {
      resgate = await transferir({ valor, data, origemId: caixinhaId, destinoId: conta.id, tipo: 'resgate',
        descricao: `Resgate p/ ${desc}`, vinculoId: `${tabela}:${regId}`, origem: 'sistema' });
    }
    return { tabela, id: regId, resgate, caixinhaId, planoItemId };
  }

  // Gasto PESSOAL pago com dinheiro da PJ: sai da conta PJ (saída natureza
  // PESSOAL, não é despesa da empresa) e vira gasto PF na categoria PF
  // escolhida (o trigger cria a saída PF 'sync_<id>'; aqui só garante a categoria).
  async function _gastoPessoalNaPJ(d, valor, data, conta) {
    const id = String(Date.now()) + Math.floor(Math.random() * 1000);
    const desc = String(d.descricao || '').trim() || d.categoria || 'Gasto pessoal';
    await stSalvarSaidaPJ({ id, dataPag: data, dataCaixa: data, tipo: 'Pessoal', valor: String(valor),
      forma: _formaDaConta(conta, d.forma), status: 'Pago', obs: desc, recorrencia: 'unica', grupoId: null,
      natureza: 'PESSOAL', transferenciaParaMim: false, createdAt: new Date().toISOString() });
    await stSalvarMeta('saidas', id, { contaId: conta.id, caixinhaId: '-', planoItemId: '-',
      conciliado: !!d.conciliado, extratoRef: d.extratoRef || null });
    if (ST.pfLiberado) {
      await stSalvarPF('saida', { id: 'sync_' + id, usuarioId: null, data, descricao: desc, valor,
        categoria: d.categoria || 'Outros', forma: _formaDaConta(conta, d.forma), origem: 'sincronizado',
        saidaOrigemId: id, createdAt: new Date().toISOString() });
    }
    return { tabela: 'saidas', id, pessoal: true };
  }

  async function pagarItem(itemId, d) {
    const it = stItem(itemId);
    if (!it || it.tipo !== 'pagamento') throw _erro('Item de pagamento não encontrado.');
    return registrarGasto({ entidade: it.entidade, valor: d.valor, data: d.data,
      contaId: d.contaId || it.contaId || null, caixinhaId: it.caixinhaId || null,
      categoria: it.categoria || it.descricao, descricao: d.descricao || it.descricao,
      planoItemId: it.id, dividaId: it.dividaId || null, resgatar: d.resgatar, forma: d.forma });
  }

  // ── PRÓ-LABORE: saída PJ + entrada PF vinculadas ─────────
  // Usa a ponte existente (trigger saidas → entradas_pessoal). A entrada PF
  // tem id 'sync_<id da saída>' — o mesmo que o trigger cria —, então
  // gravar aqui também nunca duplica (só garante, se o trigger falhar).
  async function pagarProlabore(itemId, d) {
    const it = itemId ? stItem(itemId) : null;
    const valor = _valor(d.valor), data = _data(d.data);
    const contaPJ = d.contaId ? stConta(d.contaId) : (it && it.contaId) ? stConta(it.contaId) : _corrente('PJ');
    if (!contaPJ || contaPJ.entidade !== 'PJ') throw _erro('Escolha a conta PJ de onde sai o pró-labore.');
    const id = String(Date.now()) + Math.floor(Math.random() * 1000);
    const desc = (it ? it.descricao : 'Pró-labore') + ` (${data.slice(8, 10)}/${data.slice(5, 7)})`;
    await stSalvarSaidaPJ({ id, dataPag: data, dataCaixa: data, tipo: 'Pró-labore', valor: String(valor),
      forma: 'Transferência', status: 'Pago', obs: desc, recorrencia: 'unica', grupoId: null,
      natureza: 'PESSOAL', transferenciaParaMim: true, createdAt: new Date().toISOString() });
    await stSalvarMeta('saidas', id, { contaId: contaPJ.id, planoItemId: it ? it.id : null });
    if (ST.pfLiberado) {
      await stSalvarPF('entrada', { id: 'sync_' + id, usuarioId: null, data, descricao: desc, valor,
        categoria: 'Pró-labore', forma: 'Transferência', origem: 'sincronizado', saidaOrigemId: id,
        createdAt: new Date().toISOString() });
      if (d.contaPFId) await stSalvarMeta('entradas_pessoal', 'sync_' + id, { contaId: d.contaPFId });
    }
    if (!it) {
      // fora do plano: marca explicitamente para a automação não ligar a outro item
      await stSalvarMeta('saidas', id, { contaId: contaPJ.id, planoItemId: '-' });
    }
    return { saidaId: id, entradaPFId: 'sync_' + id };
  }

  async function registrarEntradaPF(d) {
    if (!ST.pfLiberado) throw _erro('Entre no financeiro pessoal.');
    const valor = _valor(d.valor), data = _data(d.data);
    const id = stId('p');
    await stSalvarPF('entrada', { id, usuarioId: null, data, descricao: d.descricao || d.categoria || 'Entrada',
      valor, categoria: d.categoria || 'Outros', forma: d.forma || 'PIX', origem: d.origem || 'manual',
      saidaOrigemId: null, createdAt: new Date().toISOString() });
    if (d.contaId || d.planoItemId || d.extratoRef)
      await stSalvarMeta('entradas_pessoal', id, { contaId: d.contaId || null, planoItemId: d.planoItemId || null,
        conciliado: !!d.conciliado, extratoRef: d.extratoRef || null });
    return id;
  }

  // Recebimento de cliente previsto → confirmado (não cria outra receita)
  async function confirmarRecebimento(entryId, d) {
    const e = ST.entries.find(x => String(x.id) === String(entryId));
    if (!e) throw _erro('Recebimento não encontrado.');
    if (e.status === 'Realizado') throw _erro('Este recebimento já está confirmado.');
    await stAtualizarEntry(e.id, { status: 'Realizado', dataPag: _data(d.data || e.dataPag) });
    if (d.contaId || d.extratoRef)
      await stSalvarMeta('entries', e.id, { contaId: d.contaId || null, conciliado: !!d.conciliado, extratoRef: d.extratoRef || null });
    return e;
  }

  // Recebimento de cliente identificado no extrato (valor pode diferir):
  //  igual  → confirma; parcial → confirma o que entrou e o resto segue Previsto
  //  (mesma cliente/data, soma do contrato preservada); maior → confirma com o valor recebido.
  async function receberCliente(entryId, d) {
    const e = ST.entries.find(x => String(x.id) === String(entryId));
    if (!e) throw _erro('Recebimento não encontrado.');
    if (e.status === 'Realizado') throw _erro('Este recebimento já está confirmado.');
    const pago = _valor(d.valor), previsto = r2(num(e.valor)), data = _data(d.data);
    if (pago < previsto - FX.EPS) {
      const resto = r2(previsto - pago);
      await stAtualizarEntry(e.id, { status: 'Realizado', dataPag: data, valor: pago.toFixed(2),
        obs: [e.obs, `Pago parcial: R$ ${pago.toFixed(2)} de R$ ${previsto.toFixed(2)}`].filter(Boolean).join(' · ') });
      await stCriarEntry(Object.assign({}, e, { id: String(Date.now()) + Math.floor(Math.random() * 1000),
        valor: resto.toFixed(2), status: 'Previsto', valorTotal: '', createdAt: new Date().toISOString(),
        obs: `Restante após pagamento parcial de R$ ${pago.toFixed(2)} em ${data.slice(8, 10)}/${data.slice(5, 7)}` }));
    } else if (pago > previsto + FX.EPS) {
      await stAtualizarEntry(e.id, { status: 'Realizado', dataPag: data, valor: pago.toFixed(2),
        obs: [e.obs, `Recebido R$ ${pago.toFixed(2)} (previsto R$ ${previsto.toFixed(2)})`].filter(Boolean).join(' · ') });
    } else {
      await stAtualizarEntry(e.id, { status: 'Realizado', dataPag: data });
    }
    await stSalvarMeta('entries', e.id, { contaId: d.contaId || null, conciliado: !!d.conciliado, extratoRef: d.extratoRef || null });
    return e;
  }

  // ── CONCILIAÇÃO ──────────────────────────────────────────
  // 1ª vez numa conta: define o saldo de abertura (saldo real informado).
  // Depois: compara e, se você pedir, lança um AJUSTE explícito (fica
  // visível como "diferença não identificada", nunca como receita/despesa).
  async function conciliar(contaId, d) {
    const conta = stConta(contaId);
    if (!conta) throw _erro('Conta não encontrada.');
    const data = _data(d.data);
    const bruto = FX.parseValor(d.saldoBanco);
    if (isNaN(bruto)) throw _erro('Informe o saldo do banco.');
    const saldoBanco = r2(bruto);
    const cfg = ST.cfg || FX_MODELO.config;
    const calc = FX.saldoConta(conta, stMovs(), data, cfg);
    const dif = r2(saldoBanco - calc.saldo);
    if (!calc.conferido) {
      await stSalvar('fin_contas', Object.assign({}, conta, { saldoInicial: saldoBanco, dataSaldoInicial: data }), 'abertura');
      return stSalvar('fin_conciliacoes', { id: stId('cc'), contaId, data, saldoBanco, saldoSistema: calc.saldo,
        diferenca: dif, tipo: 'abertura', ajusteId: null, obs: d.obs || 'Saldo de abertura informado', criadoPor: ST.usuario || '' });
    }
    let ajusteId = null;
    if (d.ajustar && Math.abs(dif) > FX.EPS) {
      const aj = await transferir({ tipo: 'ajuste', valor: Math.abs(dif), data,
        origemId: dif < 0 ? contaId : null, destinoId: dif > 0 ? contaId : null,
        descricao: d.obs || 'Ajuste de conciliação (diferença não identificada)', origem: 'sistema', conciliado: true });
      ajusteId = aj.id;
    }
    return stSalvar('fin_conciliacoes', { id: stId('cc'), contaId, data, saldoBanco, saldoSistema: calc.saldo,
      diferenca: dif, tipo: ajusteId ? 'ajuste' : 'conferencia', ajusteId, obs: d.obs || '', criadoPor: ST.usuario || '' });
  }

  // Extrato → propostas (não grava nada)
  function prepararExtrato(contaId, transacoes) {
    const conta = stConta(contaId);
    if (!conta) throw _erro('Escolha a conta do extrato.');
    const contadorDia = {};
    const linhas = transacoes.map(t => {
      const k = `${t.data}|${t.valor}`; contadorDia[k] = (contadorDia[k] || 0) + 1;
      return Object.assign({}, t, { ref: FX.refExtrato(contaId, t, contadorDia[k]) });
    });
    const cfg = ST.cfg || FX_MODELO.config;
    const props = FX.casarExtrato(linhas, contaId, stMovs().filter(m => m.entidade === conta.entidade), cfg)
      .map(p => Object.assign(p, { decisao: p.acao === 'conciliar' ? 'conciliar' : p.acao === 'duplicada' ? 'ignorar' :
        (p.linha.valor < 0 ? 'gasto' : 'receita'), categoria: '', destinoId: '', caixinhaId: '', planoItemId: '', auto: '' }));
    // Saiu e voltou o mesmo valor (ex.: Pix da corrida devolvido) → ignora os dois
    const novas = props.map((p, i) => i).filter(i => props[i].acao === 'novo');
    FX.paresEstorno(novas.map(i => props[i].linha), cfg).forEach(([a, b]) => {
      const pa = props[novas[a]], pb = props[novas[b]];
      [pa, pb].forEach((p, k) => Object.assign(p, { acao: 'estorno', decisao: 'ignorar',
        par: k === 0 ? pb.linha : pa.linha }));
    });
    _sugerir(conta, props, cfg);
    return props;
  }

  // Preenche o que der para deduzir em cada linha nova do extrato:
  // regra aprendida > item do plano com o mesmo valor > transferência interna
  // (caixinha/fatura) > categoria pela descrição (+ caixinha pela categoria).
  function _sugerir(conta, props, cfg) {
    const ent = conta.entidade;
    const ctxIt = {};
    const pend = mes => ctxIt[mes] || (ctxIt[mes] = FX.itensDoMes(ST.itens, mes, stMovs(), stHoje(), cfg).filter(i => FX.PENDENTE(i._status)));
    const reservado = new Set();
    const tol = cfg.toleranciaDias != null ? cfg.toleranciaDias : 5;
    props.filter(p => p.acao === 'novo').forEach(p => {
      const l = p.linha, v = Math.abs(l.valor), debito = l.valor < 0;
      let rg = FX.regraAprendida(l.descricao, ent, cfg);
      if (_paraMimMesma(l.descricao, cfg) && ((ent === 'PJ' && debito) || (ent === 'PF' && !debito))) {
        Object.assign(p, { decisao: 'prolabore', planoItemId: _itemProlabore(l.data, v, reservado) || '', auto: 'palavra' });
        return;
      }
      if (ent === 'PJ' && !debito) {
        const cands = FX.candidatosRecebimento(l, stMovs(), rg && rg.decisao === 'cliente' ? rg.cliente : null)
          .filter(c => !reservado.has(c.mov.key));
        p.candidatos = cands.slice(0, 40).map(c => ({ id: c.mov.id, cliente: c.mov.cliente, tipo: c.mov.tipoEntrada,
          data: c.mov.data, valor: c.mov.valor }));
        const melhor = cands[0];
        if (melhor && melhor.forte) {
          reservado.add(melhor.mov.key);
          Object.assign(p, { decisao: 'cliente', entryId: melhor.mov.id, auto: melhor.regra ? 'regra' : melhor.comum ? 'nome' : 'valor' });
          return;
        }
      }
      if (rg && rg.decisao === 'cliente') rg = null;
      if (rg) {
        Object.assign(p, { decisao: rg.decisao, categoria: rg.categoria || '', caixinhaId: rg.caixinhaId || '', destinoId: rg.destinoId || '', auto: 'regra' });
        if (rg.decisao === 'transferencia' && !p.destinoId) p.decisao = debito ? 'gasto' : 'receita';
        return;
      }
      // item do plano com o mesmo valor e data próxima. Desempate: descrição
      // de caixinha → só aportes; categoria sugerida pela descrição; data.
      const tipoInt = FX.tipoInterno(l.descricao, cfg);
      const catDesc = FX.semAcento(FX.sugerirCategoria(l.descricao, ent, cfg));
      const cands = pend(FX.mesDe(l.data)).filter(i => !reservado.has(i.id) && Math.abs(i._falta - v) < 0.01 &&
        Math.abs(FX.difDias(i._data, l.data)) <= Math.max(tol, 7) && (
          (debito && i.tipo === 'prolabore' && ent === 'PJ' && !tipoInt) || (!debito && i.tipo === 'prolabore' && ent === 'PF') ||
          (debito && i.entidade === ent && i.tipo === 'aporte' && conta.tipo !== 'caixinha' && tipoInt !== 'fatura') ||
          (debito && i.entidade === ent && i.tipo === 'pagamento' && !tipoInt)))
        .sort((a, b) => ((catDesc && FX.semAcento(a.categoria) === catDesc) ? 0 : 1) - ((catDesc && FX.semAcento(b.categoria) === catDesc) ? 0 : 1)
          || Math.abs(FX.difDias(a._data, l.data)) - Math.abs(FX.difDias(b._data, l.data)));
      const it = cands[0];
      if (it) {
        reservado.add(it.id);
        if (it.tipo === 'prolabore') Object.assign(p, { decisao: 'prolabore', planoItemId: it.id, auto: 'plano' });
        else if (it.tipo === 'aporte') Object.assign(p, { decisao: 'transferencia', destinoId: it.caixinhaId, planoItemId: it.id, auto: 'plano' });
        else Object.assign(p, { decisao: 'gasto', categoria: it.categoria || it.descricao, caixinhaId: it.caixinhaId || '', planoItemId: it.id, auto: 'plano' });
        return;
      }
      if (tipoInt === 'fatura' && debito) {
        const c = FX.contaPadrao(ST.contas, ent, 'cartao');
        if (c) { Object.assign(p, { decisao: 'transferencia', destinoId: c.id, auto: 'palavra' }); return; }
      }
      if (tipoInt === 'caixinha') {
        const cxs = ST.contas.filter(c => c.entidade === ent && c.tipo === 'caixinha' && c.ativa !== false);
        const d = FX.semAcento(l.descricao);
        const cx = cxs.find(c => d.includes(FX.semAcento(c.nome).split(' ')[0])) || null;
        Object.assign(p, { decisao: 'transferencia', destinoId: cx ? cx.id : '', auto: 'palavra' });
        return;
      }
      const cat = FX.sugerirCategoria(l.descricao, ent, cfg);
      if (cat) {
        p.categoria = cat; p.auto = 'palavra';
        if (debito) p.caixinhaId = (FX.caixinhaDaCategoria(ST.contas, ent, cat, cfg) || {}).id || '';
      }
    });
  }

  function _paraMimMesma(desc, cfg) {
    const d = FX.semAcento(desc);
    return ((cfg && cfg.nomesProprios) || []).some(n => n && d.includes(FX.semAcento(n)));
  }
  // Pró-labore pago "solto": vai completando o item do plano do mês que ainda
  // tem saldo (o mais antigo primeiro). Mês já completo → fora do plano.
  function _itemProlabore(data, valor, reservado) {
    const cfg = ST.cfg || FX_MODELO.config;
    const its = FX.itensDoMes(ST.itens, FX.mesDe(data), stMovs(), stHoje(), cfg)
      .filter(i => i.tipo === 'prolabore' && FX.PENDENTE(i._status) && i._falta > FX.EPS && !(reservado && reservado.has(i.id)))
      .sort((a, b) => a._data.localeCompare(b._data));
    return its.length ? its[0].id : null;
  }
  function itensProlaboreDoMes(mes) {
    const cfg = ST.cfg || FX_MODELO.config;
    return FX.itensDoMes(ST.itens, mes, stMovs(), stHoje(), cfg).filter(i => i.tipo === 'prolabore');
  }

  async function _aprender(ent, props) {
    const cfg = JSON.parse(JSON.stringify(ST.cfg || FX_MODELO.config));
    cfg.regrasExtrato = cfg.regrasExtrato || { PF: [], PJ: [] };
    const lista = cfg.regrasExtrato[ent] = cfg.regrasExtrato[ent] || [];
    let mudou = false;
    props.filter(p => p.acao === 'novo' && ['gasto', 'receita', 'transferencia', 'pessoal', 'cliente'].includes(p.decisao) && !p.planoItemId).forEach(p => {
      const chave = FX.chaveExtrato(p.linha.descricao);
      if (!chave || chave.length < 3) return;
      let regra;
      if (p.decisao === 'cliente') {
        const e = ST.entries.find(x => String(x.id) === String(p.entryId));
        if (!e || !e.cliente) return;
        // só vale aprender quando o nome do Pix NÃO é o da cliente (mãe, noivo, empresa…)
        const comum = FX.tokensNome(e.cliente).filter(w => FX.tokensNome(p.linha.descricao).includes(w)).length;
        if (comum > 0) return;
        regra = { chave, decisao: 'cliente', cliente: e.cliente };
      } else {
        if (p.decisao !== 'transferencia' && !p.categoria) return;
        regra = { chave, decisao: p.decisao, categoria: p.categoria || '', caixinhaId: p.caixinhaId || '', destinoId: p.destinoId || '' };
      }
      const i = lista.findIndex(r => r.chave === chave);
      if (i >= 0) { if (JSON.stringify(lista[i]) === JSON.stringify(regra)) return; lista[i] = regra; } else lista.unshift(regra);
      mudou = true;
    });
    if (!mudou) return;
    if (lista.length > 400) lista.length = 400;
    await stSalvarCfg(cfg);
  }

  // Aplica as decisões da revisão. Conciliar = marcar o lançamento
  // existente (e confirmar se estava previsto). Novo = cria uma vez só.
  async function aplicarExtrato(contaId, propostas) {
    const conta = stConta(contaId);
    const ent = conta.entidade;
    const res = { conciliados: 0, confirmados: 0, criados: 0, transferencias: 0, ignorados: 0 };
    for (const p of propostas) {
      const l = p.linha, valor = Math.abs(l.valor), ref = l.ref;
      if (p.decisao === 'ignorar') { res.ignorados++; continue; }
      if (p.decisao === 'conciliar' && p.match) {
        const m = p.match;
        if (m.tabela === 'fin_transferencias') {
          await stSalvar('fin_transferencias', Object.assign({}, m.raw, { conciliado: true, extratoRef: ref }), 'conciliar');
        } else {
          if (m.tabela === 'entries' && !m.realizado) { await stAtualizarEntry(m.id, { status: 'Realizado', dataPag: l.data }); res.confirmados++; }
          if (m.tabela === 'saidas' && !m.realizado) { await stAtualizarSaidaPJ(m.id, { status: 'Pago', dataPag: l.data }); res.confirmados++; }
          await stSalvarMeta(m.tabela, m.id, { contaId, conciliado: true, extratoRef: ref });
        }
        res.conciliados++; continue;
      }
      if (p.decisao === 'prolabore') {
        const it = p.planoItemId ? stItem(p.planoItemId) : null;   // sem item = pró-labore fora do plano
        const r = await pagarProlabore(it ? it.id : null, { valor, data: l.data, contaId: ent === 'PJ' ? contaId : undefined,
          contaPFId: ent === 'PF' ? contaId : undefined });
        if (ent === 'PJ') await stSalvarMeta('saidas', r.saidaId, { contaId, conciliado: true, extratoRef: ref });
        else if (ST.pfLiberado) await stSalvarMeta('entradas_pessoal', r.entradaPFId, { contaId, conciliado: true, extratoRef: ref });
        res.criados++; continue;
      }
      if (p.decisao === 'transferencia') {
        if (!p.destinoId) continue;
        const credito = l.valor > 0;
        await transferir({ valor, data: l.data, origemId: credito ? p.destinoId : contaId,
          destinoId: credito ? contaId : p.destinoId, descricao: l.descricao, conciliado: true, extratoRef: ref, origem: 'importacao',
          planoItemId: p.planoItemId || null });
        res.transferencias++; continue;
      }
      if (p.decisao === 'pessoal' && ent === 'PJ') {
        await registrarGasto({ entidade: 'PJ', pessoal: true, valor, data: l.data, contaId, categoria: p.categoria || 'Outros',
          descricao: l.descricao, conciliado: true, extratoRef: ref });
        res.criados++; continue;
      }
      if (p.decisao === 'gasto') {
        await registrarGasto({ entidade: ent, valor, data: l.data, contaId, caixinhaId: p.caixinhaId || null, planoItemId: p.planoItemId || null,
          categoria: p.categoria || (ent === 'PF' ? 'Outros' : 'Outro'), descricao: l.descricao,
          conciliado: true, extratoRef: ref, origem: 'importacao', resgatar: false });
        res.criados++; continue;
      }
      if (p.decisao === 'cliente' && p.entryId) {
        await receberCliente(p.entryId, { valor, data: l.data, contaId, extratoRef: ref, conciliado: true });
        res.confirmados++; res.conciliados++; continue;
      }
      if (p.decisao === 'receita') {
        if (ent === 'PF') {
          await registrarEntradaPF({ valor, data: l.data, categoria: p.categoria || 'Outros', descricao: l.descricao,
            contaId, conciliado: true, extratoRef: ref, origem: 'importacao' });
        } else {
          const id = String(Date.now()) + Math.floor(Math.random() * 1000);
          await stCriarEntry({ id, dataPag: l.data, dataServ: '', cliente: l.descricao || 'Recebimento (extrato)',
            tipo: 'Pagamento', valor: valor.toFixed(2), valorTotal: '', servico: '', local: '', forma: 'PIX',
            status: 'Realizado', origem: p.categoria || 'Extrato', obs: 'Importado do extrato — identificar cliente',
            equipe: '', responsavel: '', auto: false, noivaId: '', createdAt: new Date().toISOString() });
          await stSalvarMeta('entries', id, { contaId, conciliado: true, extratoRef: ref });
        }
        res.criados++;
      }
    }
    await _aprender(ent, propostas);
    return res;
  }

  // ── CADASTROS ────────────────────────────────────────────
  async function salvarConta(d) {
    if (!d.nome) throw _erro('Dê um nome à conta.');
    const atual = d.id ? stConta(d.id) : null;
    const reg = Object.assign({ saldoInicial: null, dataSaldoInicial: null, ativa: true, ordem: ST.contas.length, obs: '' },
      atual || {}, d);
    if (reg.padrao) {   // só uma padrão por entidade+tipo
      for (const c of ST.contas.filter(c => c.id !== reg.id && c.entidade === reg.entidade && c.tipo === reg.tipo && c.padrao))
        await stSalvar('fin_contas', Object.assign({}, c, { padrao: false }));
    }
    return stSalvar('fin_contas', reg);
  }
  async function salvarDivida(d) {
    if (!d.nome) throw _erro('Dê um nome à dívida.');
    const atual = d.id ? ST.dividas.find(x => x.id === d.id) : null;
    return stSalvar('fin_dividas', Object.assign({ ativa: true, obs: '' }, atual || {}, d),
      atual && (atual.saldoDevedor !== d.saldoDevedor || atual.dataSaldo !== d.dataSaldo) ? 'atualizar-saldo-divida' : undefined);
  }
  async function salvarConfig(cfg) { return stSalvarCfg(cfg); }

  // Novo saldo devedor informado → atualiza a dívida e guarda no histórico
  async function atualizarSaldoDivida(id, d) {
    const dv = ST.dividas.find(x => x.id === id);
    if (!dv) throw _erro('Dívida não encontrada.');
    const data = _data(d.data);
    const saldo = FX.parseValor(d.saldoDevedor);
    if (isNaN(saldo)) throw _erro('Informe o valor para quitação.');
    const tot = d.totalEmAberto === '' || d.totalEmAberto == null ? null : FX.parseValor(d.totalEmAberto);
    const parc = d.parcelasRestantes === '' || d.parcelasRestantes == null ? null : Number(d.parcelasRestantes);
    await stSalvar('fin_divida_saldos', { id: stId('ds'), dividaId: id, data, saldoDevedor: r2(saldo),
      totalEmAberto: tot == null || isNaN(tot) ? null : r2(tot), parcelasRestantes: parc, obs: d.obs || '' }, 'saldo-divida');
    return stSalvar('fin_dividas', Object.assign({}, dv, { saldoDevedor: r2(saldo), dataSaldo: data,
      totalEmAberto: tot == null || isNaN(tot) ? dv.totalEmAberto : r2(tot), parcelasRestantes: parc == null ? dv.parcelasRestantes : parc,
      situacao: saldo <= 0 ? 'quitada' : dv.situacao }), 'atualizar-saldo-divida');
  }

  // Incluir no plano: cria no MODELO o aporte na caixinha Dívidas + o pagamento,
  // com vigência (mês inicial → nº de meses) e já insere nos meses abertos.
  async function incluirDividaNoPlano(id, d) {
    const dv = ST.dividas.find(x => x.id === id);
    if (!dv) throw _erro('Dívida não encontrada.');
    const valor = _valor(d.valor);
    const meses = Math.max(1, Number(d.meses) || 1);
    if (!/^\d{4}-\d{2}$/.test(d.mesInicio || '')) throw _erro('Escolha o mês inicial.');
    const dia = Math.min(31, Math.max(1, Number(d.dia) || dv.diaVencimento || 15));
    const cx = FX.caixinhaPorFinalidade(ST.contas, dv.entidade, 'dividas');
    if (!cx) throw _erro('Crie uma caixinha com finalidade "dividas" para ' + dv.entidade + ' (Ajustes › Contas).');
    const vig = { mesInicio: d.mesInicio, mesFim: FX.addMes(d.mesInicio, meses - 1) };
    const plM = stPlano('modelo');
    const base = { planoId: plM.id, mes: 'modelo', entidade: dv.entidade, dividaId: id, caixinhaId: cx.id, valor, ordem: 900,
      dispensado: false, reprogramadoPara: null, avulso: false, obs: 'Incluída pelo módulo Dívidas' };
    const ap = await stSalvar('fin_plano_itens', Object.assign({ id: stId('it'), tipo: 'aporte', dia: Math.min(dia, 15),
      descricao: 'Dívidas — ' + dv.nome, categoria: '' }, base, vig), 'divida-plano');
    const pg = await stSalvar('fin_plano_itens', Object.assign({ id: stId('it'), tipo: 'pagamento', dia,
      descricao: dv.nome + ' — parcela', categoria: 'Dívidas', parcelas: meses }, base, vig), 'divida-plano');
    for (const p of ST.planos.filter(p => p.mes !== 'modelo' && p.status !== 'fechado' && FX.vigente(vig, p.mes) && p.mes >= FX.mesDe(stHoje())))
      await stSalvarVarios('fin_plano_itens', FX.copiarItens([ap, pg], p.mes, p.id, () => stId('it')), 'divida-plano-mes');
    return stSalvar('fin_dividas', Object.assign({}, dv, { situacao: 'no_plano' }), 'divida-no-plano');
  }

  // Tirar do plano: encerra a vigência no mês anterior e dispensa os itens
  // ainda não pagos dos meses abertos. Pagamentos já feitos ficam no histórico.
  async function tirarDividaDoPlano(id) {
    const dv = ST.dividas.find(x => x.id === id);
    const atual = FX.mesDe(stHoje());
    for (const it of ST.itens.filter(i => i.dividaId === id || (i.mes === 'modelo' && i.descricao === 'Dívidas — ' + dv.nome))) {
      if (it.mes === 'modelo') await stSalvar('fin_plano_itens', Object.assign({}, it, { mesFim: FX.addMes(atual, -1) }), 'divida-fora-modelo');
      else if (it.mes >= atual && (stPlano(it.mes) || {}).status !== 'fechado' && !FX.realizadoDoItem(it, stMovs()).movs.length && !it.dispensado)
        await stSalvar('fin_plano_itens', Object.assign({}, it, { dispensado: true, obs: 'Dívida retirada do plano' }), 'divida-fora-mes');
    }
    return stSalvar('fin_dividas', Object.assign({}, dv, { situacao: 'fora_do_plano' }), 'divida-fora-plano');
  }

  // Ligar um lançamento existente a conta/caixinha/item/dívida
  async function classificar(tabela, id, campos) { return stSalvarMeta(tabela, id, campos); }

  async function excluirTransferencia(id) {
    const t = ST.transferencias.find(x => x.id === id);
    if (!t) return;
    await stRemover('fin_transferencias', id);
  }

  return { receberCliente, itensProlaboreDoMes, garantirMeses, executarComoPlanejado, atualizarSaldoDivida, incluirDividaNoPlano, tirarDividaDoPlano,
    configurarInicial, criarMes, salvarItem, removerItem, dispensarItem, retomarItem, reprogramarItem,
    fecharMes, reabrirMes, transferir, executarAporte, pagarFatura, registrarGasto, pagarItem, pagarProlabore,
    registrarEntradaPF, confirmarRecebimento, conciliar, prepararExtrato, aplicarExtrato,
    salvarConta, salvarDivida, salvarConfig, classificar, excluirTransferencia };
})();

if (typeof module !== 'undefined') module.exports = AC;
