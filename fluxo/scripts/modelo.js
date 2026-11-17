// ════════════════════════════════════════════════════════════
// fluxo/scripts/modelo.js — SEMENTE inicial vinda da planilha da
// consultoria ("Planejamento Financeiro_Carol Nunes.xlsx").
//
// Só é usada UMA vez, pelo assistente "Configurar estrutura inicial",
// para criar contas, caixinhas, dívidas e o MODELO de planejamento.
// Depois disso tudo vive no banco e é editável pela tela — nenhuma
// regra de cálculo lê este arquivo.
//
// Não cria saldo bancário: saldos só existem após a conciliação.
// Referências da planilha em cada item (aba · célula).
// ════════════════════════════════════════════════════════════

const FX_MODELO = {
  fonte: 'Planejamento Financeiro_Carol Nunes.xlsx',

  // ── Configuração (vai para configuracoes.chave = 'fluxo_config') ──
  config: {
    versao: 4,
    // Seus nomes como aparecem no extrato: Pix PJ → você = pró-labore
    nomesProprios: ['caroline nunes', 'carol nunes', 'caroline dos santos nunes'],
    // Acompanhamento mensal: S1 01–08 · S2 09–15 · S3 16–22 · S4 23–fim do mês
    semanas: [
      { n: 1, ini: 1,  fim: 8  },
      { n: 2, ini: 9,  fim: 15 },
      { n: 3, ini: 16, fim: 22 },
      { n: 4, ini: 23, fim: 31 },   // 31 = "último dia do mês" (ajustado por mês)
    ],
    toleranciaDias: 5,               // janela de datas p/ casar extrato × lançamento
    inicioFluxo: '',                 // preenchido no assistente (1º dia do 1º mês)
    categorias: {
      // Fotografia início consultoria — fixas / variáveis / sazonais
      PF: [
        { nome: 'Luz', grupo: 'Fixas' }, { nome: 'Gás', grupo: 'Fixas' },
        { nome: 'Academia e Jiu', grupo: 'Fixas' }, { nome: 'Assinaturas', grupo: 'Fixas' },
        { nome: 'Médico', grupo: 'Fixas' }, { nome: 'Telefone', grupo: 'Fixas' },
        { nome: 'Faxineira', grupo: 'Fixas' },
        { nome: 'Mercado', grupo: 'Variáveis' }, { nome: 'Delivery', grupo: 'Variáveis' },
        { nome: 'Alimentação', grupo: 'Variáveis' }, { nome: 'Transporte', grupo: 'Variáveis' },
        { nome: 'Gatos', grupo: 'Variáveis' }, { nome: 'Medicamentos', grupo: 'Variáveis' },
        { nome: 'Roupas', grupo: 'Sazonais' }, { nome: 'Cosméticos', grupo: 'Sazonais' },
        { nome: 'Presentes', grupo: 'Sazonais' }, { nome: 'Despesas da casa', grupo: 'Sazonais' },
        { nome: 'Procedimento estético', grupo: 'Sazonais' }, { nome: 'Viagem', grupo: 'Sazonais' },
        { nome: 'Consultoria financeira', grupo: 'Sazonais' },
        { nome: 'Dívidas', grupo: 'Dívidas' },
        // categorias do Financeiro Pessoal antigo (dados existentes continuam válidos)
        { nome: 'Moradia', grupo: 'Outras' }, { nome: 'Saúde', grupo: 'Outras' },
        { nome: 'Lazer', grupo: 'Outras' }, { nome: 'Educação', grupo: 'Outras' },
        { nome: 'Compras', grupo: 'Outras' }, { nome: 'Contas', grupo: 'Outras' },
        { nome: 'Outros', grupo: 'Outras' },
      ],
      // Só o RAIO X - PJ (nomes = tipos de saída do Financeiro). Tipos antigos
      // do Financeiro (Assistente, Modelos…) continuam válidos nos dados, só
      // não aparecem nas listas do fluxo.
      PJ: [
        { nome: 'Deslocamento', grupo: 'Semanada' },
        { nome: 'Alimentação trabalho', grupo: 'Semanada' },
        { nome: 'Reposição', grupo: 'Reposição' },                  // produtos e materiais do kit
        { nome: 'Cursos', grupo: 'Cursos e investimentos' },        // curso e aperfeiçoamento
        { nome: 'Investimentos', grupo: 'Cursos e investimentos' }, // equipamentos e estrutura
        { nome: 'Assinaturas', grupo: 'Assinaturas' },
        { nome: 'DAS', grupo: 'MEI' },
        { nome: 'Dívidas', grupo: 'Dívidas' },
        { nome: 'Outro', grupo: 'Outras' },
      ],
      receitasPF: ['Pró-labore', 'Transferência', 'Salário/Renda', 'Reembolso', 'Presente', 'Investimentos', 'Outros'],
    },
    // ── AUTOMAÇÃO ──
    // Caixinha deduzida pela categoria do gasto (sem precisar escolher)
    caixinhaPorGrupo: {
      PF: { 'Fixas': 'fixas', 'Variáveis': 'semanada', 'Sazonais': 'sazonais', 'Dívidas': 'dividas' },
      PJ: { 'Semanada': 'semanada', 'Reposição': 'reposicao', 'Cursos e investimentos': 'cursos',
            'Assinaturas': 'cartao', 'MEI': 'mei', 'Dívidas': 'dividas' },
    },
    caixinhaPorCategoria: { PF: { 'Faxineira': 'faxineira' }, PJ: { 'Cursos': 'cursos', 'Investimentos': 'cursos' } },
    // Nomes antigos (dados já lançados) → categoria atual, só para cálculo
    aliasCategorias: { PJ: { 'Reposição/Investimento de material': 'Reposição', 'Reposição de Material': 'Reposição',
      'Equipamentos': 'Investimentos', 'Investimento Material': 'Investimentos', 'Investimento Produto': 'Investimentos', 'Curso': 'Cursos' } },
    // Categoria sugerida pela descrição do extrato (regex sem acento, minúsculas)
    palavrasCategoria: {
      PF: [
        ['ifood|rappi|ze delivery|delivery|aiqfome', 'Delivery'],
        ['mercado|supermerc|carrefour|assai|atacad|pao de acucar|hortifruti|padaria|sacolao', 'Mercado'],
        ['uber|99app|99 pop|cabify|posto|combust|shell|ipiranga|petrobras|estacion|metro|bilhete', 'Transporte'],
        ['drogaria|farmacia|droga raia|drogasil|pague menos', 'Medicamentos'],
        ['petz|cobasi|petshop|pet shop|veterin|racao', 'Gatos'],
        ['enel|light|cemig|copel|celpe|coelba|energia|eletropaulo', 'Luz'],
        ['comgas|naturgy|ultragaz|liquigas|supergasbras', 'Gás'],
        ['vivo|claro|tim |oi movel|telefonica', 'Telefone'],
        ['netflix|spotify|prime video|amazon prime|disney|hbo|max|globoplay|youtube|icloud|apple.com', 'Assinaturas'],
        ['smartfit|smart fit|academia|bluefit|jiu', 'Academia e Jiu'],
        ['renner|riachuelo|c&a|zara|shein|hering|marisa', 'Roupas'],
        ['sephora|boticario|natura|epoca cosmeticos|beleza na web', 'Cosméticos'],
      ],
      PJ: [
        ['uber|99app|99 pop|cabify|posto|combust|shell|ipiranga|estacion|pedagio|sem parar|veloe', 'Deslocamento'],
        ['ifood|restaur|lanch|padaria|cafe|burger|almoco', 'Alimentação trabalho'],
        ['canva|openai|chatgpt|anthropic|claude|adobe|capcut|google storage|notion', 'Assinaturas'],
        ['das|simples nacional|receita federal|pgmei', 'DAS'],
        ['sephora|mac cosmetics|beleza na web|epoca|makeup|maquiagem|dermage|kryolan|vult|ruby rose|lojas rede', 'Reposição'],
        ['hotmart|kiwify|eduzz|curso|workshop|masterclass', 'Cursos'],
      ],
    },
    // Linhas de extrato que são movimentação interna (não gasto)
    palavrasTransferencia: {
      caixinha: 'porquinho|caixinha|cofrinho|aplicacao|resgate|poupanca|meu porquinho|guardar',
      fatura: 'pagamento fatura|pgto fatura|pag fatura|fatura cartao|pagamento cartao|pagto cartao',
    },
    diaCriarProximoMes: 20,       // a partir deste dia o plano do mês seguinte é criado sozinho
    fecharMesesAposMeses: 2,      // meses com 2+ meses de idade são fechados sozinhos (reabre quando quiser)
    regrasExtrato: { PF: [], PJ: [] },   // aprendidas a cada importação
    // Fotografia › SAZONAIS (valores anuais) — orçamento por finalidade
    sazonais: [
      { nome: 'Roupas', anual: 3000 },
      { nome: 'Cosméticos', anual: 1000 },
      { nome: 'Presentes', anual: 1500 },
      { nome: 'Despesas da casa', anual: 1200 },
      { nome: 'Procedimento estético', anual: 1500 },
      { nome: 'Consultoria financeira', anual: 1750 },
      { nome: 'Viagem', anual: 5000 },
    ],
  },

  // ── Contas (Nova Estruturação Bancária) ──
  // key = referência local; o assistente gera os ids reais.
  contas: [
    { key: 'pf_corrente', entidade: 'PF', tipo: 'corrente', nome: 'Inter PF', banco: 'Inter', padrao: true },
    { key: 'pf_semanada', entidade: 'PF', tipo: 'caixinha', nome: 'Semanada', finalidade: 'semanada', pai: 'pf_corrente' },
    { key: 'pf_fixas',    entidade: 'PF', tipo: 'caixinha', nome: 'Despesas fixas', finalidade: 'fixas', pai: 'pf_corrente' },
    { key: 'pf_faxineira',entidade: 'PF', tipo: 'caixinha', nome: 'Faxineira', finalidade: 'faxineira', pai: 'pf_corrente' },
    { key: 'pf_sazonais', entidade: 'PF', tipo: 'caixinha', nome: 'Sazonais', finalidade: 'sazonais', pai: 'pf_corrente' },
    { key: 'pf_dividas',  entidade: 'PF', tipo: 'caixinha', nome: 'Dívidas', finalidade: 'dividas', pai: 'pf_corrente' },
    { key: 'pf_cartao',   entidade: 'PF', tipo: 'cartao',   nome: 'Cartão de crédito de apoio', banco: '', padrao: true },
    { key: 'pf_nubank',   entidade: 'PF', tipo: 'antiga',   nome: 'Nubank PF (em desativação)', banco: 'Nubank' },
    { key: 'pf_itau',     entidade: 'PF', tipo: 'antiga',   nome: 'Itaú (empréstimo)', banco: 'Itaú' },

    { key: 'pj_corrente', entidade: 'PJ', tipo: 'corrente', nome: 'Inter PJ', banco: 'Inter', padrao: true },
    { key: 'pj_semanada', entidade: 'PJ', tipo: 'caixinha', nome: 'Semanada (deslocamento e alimentação)', finalidade: 'semanada', pai: 'pj_corrente' },
    { key: 'pj_assin',    entidade: 'PJ', tipo: 'caixinha', nome: 'Assinaturas no cartão', finalidade: 'cartao', pai: 'pj_corrente' },
    { key: 'pj_cursos',   entidade: 'PJ', tipo: 'caixinha', nome: 'Cursos e investimentos', finalidade: 'cursos', pai: 'pj_corrente' },
    { key: 'pj_reposicao',entidade: 'PJ', tipo: 'caixinha', nome: 'Reposição', finalidade: 'reposicao', pai: 'pj_corrente' },
    { key: 'pj_mei',      entidade: 'PJ', tipo: 'caixinha', nome: 'MEI', finalidade: 'mei', pai: 'pj_corrente' },
    { key: 'pj_dividas',  entidade: 'PJ', tipo: 'caixinha', nome: 'Dívidas PJ', finalidade: 'dividas', pai: 'pj_corrente' },
    { key: 'pj_cartao',   entidade: 'PJ', tipo: 'cartao',   nome: 'Cartão de crédito PJ', banco: '', padrao: true },
    { key: 'pj_especie',  entidade: 'PJ', tipo: 'especie',  nome: 'Dinheiro em espécie', padrao: true },
    { key: 'pj_nubank',   entidade: 'PJ', tipo: 'antiga',   nome: 'Nubank PJ (em desativação)', banco: 'Nubank' },
  ],

  // ── Dívidas (Tabulação de Dívidas + Fotografia › DÍVIDAS) ──
  // Valores da data da consultoria: data_saldo fica vazia até você confirmar.
  dividas: [
    { key: 'pole', entidade: 'PF', nome: 'Pole Dance', valorParcela: 361, diaVencimento: 15, situacao: 'no_plano',
      obs: 'Fotografia: parcela R$ 361, vence dia 15, última parcela prevista dez/2026. Única dívida com previsão no Acompanhamento mensal.' },
    { entidade: 'PF', nome: 'Parcelamento de fatura PF', taxaMes: 0.161, valorPrincipal: 4553.01,
      saldoDevedor: 2597, totalEmAberto: 3422, parcelasRestantes: 4, valorParcela: 855.40,
      obs: 'Tabulação de Dívidas. Sem previsão no Acompanhamento mensal.' },
    { entidade: 'PJ', nome: 'Parcelamento de fatura PJ', taxaMes: 0.161, valorPrincipal: 11058.57,
      saldoDevedor: 8902, totalEmAberto: 13497, parcelasRestantes: 7, valorParcela: 1928.17,
      obs: 'Tabulação de Dívidas. Custo total da planilha usa 10 parcelas (=K5*10), mas a coluna J diz 7. Sem previsão no Acompanhamento mensal.' },
    { entidade: 'PF', nome: 'Empréstimo pessoal Nubank', credor: 'Nubank', taxaMes: 0.0325, valorPrincipal: 20638.87,
      saldoDevedor: 16224.06, totalEmAberto: 23542.32, parcelasRestantes: 24, valorParcela: 980.93,
      obs: 'Tabulação de Dívidas. Sem previsão no Acompanhamento mensal.' },
    { entidade: 'PF', nome: 'Empréstimo pessoal Itaú', credor: 'Itaú', taxaMes: 0.0814, valorPrincipal: 4126.08,
      saldoDevedor: 4290, totalEmAberto: 10534.92, parcelasRestantes: 24, valorParcela: 458.04,
      obs: 'Tabulação de Dívidas. Total em aberto usa 23 parcelas (=23*K7), coluna J diz 24. Sem previsão no Acompanhamento mensal.' },
    { entidade: 'PF', nome: 'Fatura atual + parceladas cartão PF', saldoDevedor: 6210.56, totalEmAberto: 6210.56,
      obs: 'Tabulação de Dívidas.' },
    { entidade: 'PJ', nome: 'Fatura atual + parceladas cartão PJ', saldoDevedor: 5291.88, totalEmAberto: 5291.88,
      obs: 'Tabulação de Dívidas.' },
    { entidade: 'PF', nome: 'Guilherme', valorPrincipal: 2000, saldoDevedor: 2000,
      obs: 'Tabulação de Dívidas. Sem parcelas definidas.' },
  ],

  // ── Modelo de planejamento (Acompanhamento mensal) ──
  // tipo: prolabore (PJ paga → PF recebe) | aporte (conta → caixinha) | pagamento | receita
  // conta = de onde sai · caixinha = destino (aporte) ou reserva que paga (pagamento)
  itens: [
    // PJ › pró-labore (você definiu dias 01 e 15; a planilha põe a 2ª parcela na Semana 3)
    { entidade: 'PJ', tipo: 'prolabore', dia: 1,  descricao: 'Pró-labore — 1ª parcela', valor: 2000, conta: 'pj_corrente' },
    { entidade: 'PJ', tipo: 'prolabore', dia: 15, descricao: 'Pró-labore — 2ª parcela', valor: 2755, conta: 'pj_corrente' },

    // PF › recebido no dia 01 (D6..D8 e H7)
    { entidade: 'PF', tipo: 'aporte', dia: 1,  descricao: 'Semanada — semana 1', valor: 350,  caixinha: 'pf_semanada' },
    { entidade: 'PF', tipo: 'aporte', dia: 1,  descricao: 'Despesas fixas',      valor: 1245, caixinha: 'pf_fixas' },
    { entidade: 'PF', tipo: 'aporte', dia: 9,  descricao: 'Semanada — semana 2', valor: 350,  caixinha: 'pf_semanada' },
    // PF › recebido no dia 15 (D19..D23 e H19)
    { entidade: 'PF', tipo: 'aporte', dia: 15, descricao: 'Faxineira',           valor: 250,  caixinha: 'pf_faxineira' },
    { entidade: 'PF', tipo: 'aporte', dia: 15, descricao: 'Sazonais',            valor: 1245, caixinha: 'pf_sazonais' },
    { entidade: 'PF', tipo: 'aporte', dia: 15, descricao: 'Dívidas — Pole Dance', valor: 361,  caixinha: 'pf_dividas', mesFim: '2026-12', divida: 'pole' },
    { entidade: 'PF', tipo: 'aporte', dia: 16, descricao: 'Semanada — semana 3', valor: 350,  caixinha: 'pf_semanada' },
    { entidade: 'PF', tipo: 'aporte', dia: 23, descricao: 'Semanada — semana 4', valor: 350,  caixinha: 'pf_semanada' },

    // PF › composição das despesas fixas (Fotografia F5..I10) — pagas pela caixinha
    { entidade: 'PF', tipo: 'pagamento', dia: 5,  descricao: 'Gás',            valor: 150, caixinha: 'pf_fixas', categoria: 'Gás' },
    { entidade: 'PF', tipo: 'pagamento', dia: 7,  descricao: 'Telefone',       valor: 65,  caixinha: 'pf_fixas', categoria: 'Telefone' },
    { entidade: 'PF', tipo: 'pagamento', dia: 10, descricao: 'Luz',            valor: 250, caixinha: 'pf_fixas', categoria: 'Luz' },
    { entidade: 'PF', tipo: 'pagamento', dia: 10, descricao: 'Academia e Jiu', valor: 380, caixinha: 'pf_fixas', categoria: 'Academia e Jiu' },
    { entidade: 'PF', tipo: 'pagamento', dia: 10, descricao: 'Assinaturas',    valor: 100, caixinha: 'pf_fixas', categoria: 'Assinaturas' },
    { entidade: 'PF', tipo: 'pagamento', dia: 10, descricao: 'Médico',         valor: 300, caixinha: 'pf_fixas', categoria: 'Médico' },
    // Faxineira (Fotografia: vencimento "1 e 15" — ajuste se forem 2 pagamentos)
    { entidade: 'PF', tipo: 'pagamento', dia: 15, descricao: 'Faxineira',      valor: 250, caixinha: 'pf_faxineira', categoria: 'Faxineira' },
    // Dívida prevista (Fotografia D13/E13)
    { entidade: 'PF', tipo: 'pagamento', dia: 15, descricao: 'Pole Dance — parcela', valor: 361, caixinha: 'pf_dividas', categoria: 'Dívidas', divida: 'pole', mesFim: '2026-12' },
    // Consultoria financeira: 5 parcelas de R$ 350 pagas pela caixinha Sazonais.
    // mesInicio = 1º mês do fluxo (ajustável: se já pagou parcelas, recue o início).
    { entidade: 'PF', tipo: 'pagamento', dia: 15, descricao: 'Consultoria financeira', valor: 350, caixinha: 'pf_sazonais',
      categoria: 'Consultoria financeira', parcelas: 5, mesInicio: '@inicio', mesFim: '@inicio+4' },

    // PJ › semana 1 (L6..L9)
    { entidade: 'PJ', tipo: 'pagamento', dia: 1,  descricao: 'Curso (mensalidade)', valor: 97, categoria: 'Cursos' },
    { entidade: 'PJ', tipo: 'aporte', dia: 1,  descricao: 'Semanada — semana 1', valor: 250, caixinha: 'pj_semanada' },
    { entidade: 'PJ', tipo: 'aporte', dia: 1,  descricao: 'Assinaturas no cartão', valor: 245, caixinha: 'pj_assin' },
    { entidade: 'PJ', tipo: 'aporte', dia: 9,  descricao: 'Semanada — semana 2', valor: 250, caixinha: 'pj_semanada' },
    // PJ › semana 3 (L19..L23)
    { entidade: 'PJ', tipo: 'aporte', dia: 16, descricao: 'Semanada — semana 3', valor: 250, caixinha: 'pj_semanada' },
    { entidade: 'PJ', tipo: 'aporte', dia: 16, descricao: 'Cursos e investimentos', valor: 541, caixinha: 'pj_cursos' },
    { entidade: 'PJ', tipo: 'aporte', dia: 16, descricao: 'Reposição', valor: 400, caixinha: 'pj_reposicao' },
    { entidade: 'PJ', tipo: 'aporte', dia: 16, descricao: 'MEI', valor: 81, caixinha: 'pj_mei' },
    { entidade: 'PJ', tipo: 'pagamento', dia: 20, descricao: 'DAS MEI', valor: 81, caixinha: 'pj_mei', categoria: 'DAS' },
    // PJ › semana 4 (P20)
    { entidade: 'PJ', tipo: 'aporte', dia: 23, descricao: 'Semanada — semana 4', valor: 250, caixinha: 'pj_semanada' },
  ],
};

if (typeof module !== 'undefined') module.exports = FX_MODELO;
