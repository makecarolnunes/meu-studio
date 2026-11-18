// ═══════════════════════════════════════════════════════════
// IA no extrato: pré-preenche as linhas que as regras não reconheceram
// ═══════════════════════════════════════════════════════════
// Ordem: regras do sistema primeiro (plano, aprendido, pró-labore,
// transferências) → a IA só sugere as linhas que ficariam em "Precisa de
// você". Ela só pode escolher valores que existem (categorias, caixinhas,
// contas do plano, recebimentos previstos): o schema da resposta é montado
// com essas listas. Nada é gravado — a Carol confere e aplica.
// Mesma chave e mesma forma de chamada do "Colar do WhatsApp" (Orçamentos).

const IA_MODELO = 'claude-haiku-5-5';

async function iaChave() {
  let k = '';
  try { k = localStorage.getItem('mk_claude_key') || ''; } catch (_) {}
  if (!k && window.DB && DB.config) {
    try { k = (await DB.config.get('claude_api_key')) || ''; } catch (_) {}
    if (k) try { localStorage.setItem('mk_claude_key', k); } catch (_) {}
  }
  return k;
}

// Linhas que a IA pode sugerir: novas e sem nenhuma sugestão das regras
const iaAlvo = p => p.acao === 'novo' && !p.auto && !p.interno;

function iaContexto(x) {
  const conta = stConta(x.contaId), ent = conta.entidade, cfg = ST.cfg || FX_MODELO.config;
  const alvo = x.propostas.map((p, k) => ({ p, k })).filter(({ p }) => iaAlvo(p));
  const meses = [...new Set(alvo.map(({ p }) => FX.mesDe(p.linha.data)))];
  const cats = categorias(ent).map(c => ({ nome: c.nome, grupo: c.grupo || 'Outras' }));
  const catsPF = ent === 'PJ' && ST.pfLiberado ? categorias('PF').map(c => ({ nome: c.nome, grupo: c.grupo || 'Outras' })) : [];
  const contas = ST.contas.filter(c => c.entidade === ent && c.id !== conta.id && c.ativa !== false && ['caixinha', 'cartao', 'corrente', 'especie'].includes(c.tipo))
    .map(c => ({ id: c.id, nome: c.nome, tipo: c.tipo }));
  const itens = meses.flatMap(m => FX.itensDoMes(ST.itens, m, stMovs(), stHoje(), cfg))
    .filter(i => i.entidade === ent && i.tipo === 'pagamento' && FX.PENDENTE(i._status))
    .map(i => ({ id: i.id, conta: FX.nomeItem(i), valor: i._falta, vence: i._data, categoria: i.categoria || '' }));
  const clientes = {};
  alvo.forEach(({ p }) => (p.candidatos || []).forEach(c => { clientes[c.id] = { id: String(c.id), cliente: c.cliente, tipo: c.tipo, valor: c.valor, data: c.data }; }));
  return { conta, ent, alvo, cats, catsPF, contas, itens, clientes: Object.values(clientes).slice(0, 120) };
}

function iaSchema(c) {
  const uniq = a => [...new Set(a)];
  const decisoes = c.ent === 'PJ' ? ['gasto', 'pessoal', 'receita', 'cliente', 'transferencia', 'ignorar'] : ['gasto', 'receita', 'transferencia', 'ignorar'];
  return { type: 'object', additionalProperties: false, required: ['linhas'], properties: { linhas: { type: 'array', items: {
    type: 'object', additionalProperties: false,
    required: ['i', 'decisao', 'categoria', 'conta', 'item', 'cliente', 'confianca', 'motivo'],
    properties: {
      i: { type: 'integer' },
      decisao: { type: 'string', enum: decisoes },
      categoria: { type: 'string', enum: uniq([...c.cats.map(x => x.nome), ...c.catsPF.map(x => x.nome), '']) },
      conta: { type: 'string', enum: uniq([...c.contas.map(x => x.id), '']) },
      item: { type: 'string', enum: uniq([...c.itens.map(x => x.id), '']) },
      cliente: { type: 'string', enum: uniq([...c.clientes.map(x => x.id), '']) },
      confianca: { type: 'string', enum: ['alta', 'media', 'baixa'] },
      motivo: { type: 'string' },
    } } } } };
}

function iaSistema(c) {
  return `Você classifica linhas de extrato bancário para a Carol, maquiadora autônoma (MEI). Responda só com o JSON pedido.
Conta do extrato: ${c.conta.nome} (${c.ent === 'PJ' ? 'empresa' : 'pessoal'}).
Para cada linha (campo i), escolha:
- decisao: gasto (saída), receita (entrada nova)${c.ent === 'PJ' ? ', cliente (entrada que é pagamento de um recebimento previsto da lista "clientes"), pessoal (gasto pessoal da Carol pago com a conta da empresa: mercado, farmácia, roupas, coisas da casa)' : ''}, transferencia (entre contas dela: caixinha, cartão, outra conta) ou ignorar (só se for claramente sem efeito).
- categoria: só da lista; em gasto, a categoria de saída; ${c.ent === 'PJ' ? 'em pessoal, uma categoria da lista "categoriasPessoais"; ' : ''}vazio se não souber.
- conta: em transferencia, a conta de destino/origem; em gasto, a caixinha só se for óbvio — senão vazio (sai direto da conta).
- item: em gasto, a conta do plano que esta linha paga (mesmo assunto e valor próximo); senão vazio.
- cliente: em cliente, o id do recebimento previsto (nome parecido com o do Pix, valor e data próximos); senão vazio.
- confianca: alta só quando a descrição deixa claro; baixa quando é chute.
- motivo: até 8 palavras, em português.
Use só valores das listas. Não invente. Pix de corrida (Uber, 99) e delivery são gastos; Pix recebido de pessoa${c.ent === 'PJ' ? ' costuma ser cliente' : ''}.`;
}

function iaUsuario(c) {
  return JSON.stringify({
    categorias: c.cats, ...(c.ent === 'PJ' ? { categoriasPessoais: c.catsPF, clientes: c.clientes } : {}),
    contas: c.contas, contasDoPlano: c.itens,
    linhas: c.alvo.map(({ p, k }) => ({ i: k, data: p.linha.data, valor: p.linha.valor, descricao: p.linha.descricao })),
  });
}

async function iaChamar(c) {
  const key = await iaChave();
  if (!key) throw new Error('sem-chave');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true' },
    body: JSON.stringify({
      model: IA_MODELO, max_tokens: 16000,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: iaSchema(c) } },
      system: iaSistema(c),
      messages: [{ role: 'user', content: iaUsuario(c) }],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err.error && err.error.message) || res.statusText);
  }
  const data = await res.json();
  if (data.stop_reason === 'refusal') throw new Error('A IA não conseguiu ler este extrato.');
  if (data.stop_reason === 'max_tokens') throw new Error('Extrato longo demais para a IA.');
  const txt = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  const out = JSON.parse(txt);
  return Array.isArray(out.linhas) ? out.linhas : [];
}

// Aplica uma sugestão, validando de novo tudo o que veio (nunca confiar só no schema)
function iaAplicar(c, s) {
  const a = c.alvo.find(x => x.k === s.i);
  if (!a) return false;
  const p = a.p, deb = p.linha.valor < 0;
  if (!iaAlvo(p) || p.decisao !== a.decisao0) return false;          // a Carol já mexeu nesta linha
  const okDec = deb ? ['gasto', 'pessoal', 'transferencia', 'ignorar'] : ['receita', 'cliente', 'transferencia', 'ignorar'];
  if (!okDec.includes(s.decisao) || (s.decisao === 'pessoal' && c.ent !== 'PJ') || (s.decisao === 'cliente' && c.ent !== 'PJ')) return false;
  if (s.decisao === 'ignorar' && s.confianca !== 'alta') return false;
  const temCat = n => c.cats.some(x => x.nome === n), temCatPF = n => c.catsPF.some(x => x.nome === n);
  const conta = c.contas.find(x => x.id === s.conta);
  const novo = { decisao: s.decisao, categoria: '', caixinhaId: '', destinoId: '', planoItemId: '' };
  if (s.decisao === 'gasto') {
    novo.categoria = temCat(s.categoria) ? s.categoria : '';
    const it = c.itens.find(x => x.id === s.item);
    if (it) novo.planoItemId = it.id;
    const itc = it && stItem(it.id);
    novo.caixinhaId = conta && conta.tipo === 'caixinha' ? conta.id : (itc && itc.caixinhaId) || '';
    if (!novo.categoria && !it) return false;                          // nada útil para sugerir
  } else if (s.decisao === 'pessoal') {
    if (!temCatPF(s.categoria)) return false;
    novo.categoria = s.categoria;
  } else if (s.decisao === 'cliente') {
    if (!(p.candidatos || []).some(x => String(x.id) === s.cliente)) return false;
    novo.entryId = s.cliente;
  } else if (s.decisao === 'transferencia') {
    if (!conta) return false;
    novo.destinoId = conta.id;
  }
  Object.assign(p, novo, { auto: 'ia', iaMotivo: String(s.motivo || '').slice(0, 80), iaConf: s.confianca });
  p.grupo = grupoExtrato(p);
  return true;
}

async function iaExtrato() {
  const x = UI.extrato;
  if (!x) return;
  const c = iaContexto(x);
  if (!c.alvo.length) return;
  c.alvo.forEach(a => { a.decisao0 = a.p.decisao; });
  x.ia = { estado: 'lendo', n: c.alvo.length };
  render();
  try {
    const sug = await iaChamar(c);
    if (UI.extrato !== x) return;                                      // importação cancelada no meio
    const n = sug.filter(s => iaAplicar(c, s)).length;
    x.ia = { estado: 'ok', n };
  } catch (e) {
    if (UI.extrato !== x) return;
    x.ia = { estado: e.message === 'sem-chave' ? 'sem-chave' : 'erro', erro: e.message };
  }
  if (UI.tab === 'conciliar') render();
}
