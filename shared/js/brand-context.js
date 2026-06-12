/* ============================================================
   BRAND CONTEXT — cérebro de marca (fonte única)
   Expõe window.BRAND. Lido pelo Acervo/Conteúdo para gerar
   oportunidades alinhadas à estratégia (não genéricas).
   Centro de Marca e Brand Brain podem migrar para cá depois
   (hoje cada um tem sua própria cópia do DNA).
   ============================================================ */
(function () {
  var DNA = [
    'CAROL NUNES (@makecarolnunes) — DNA COMPLETO DE MARCA',
    '',
    '━━━ IDENTIDADE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    'Maquiadora freelancer profissional — especialista em noivas, pele negra, cachos/crespos',
    'Posicionamento central: "A marca premium não é fria — ela é segura, intencional e humana."',
    'Essência: Autoridade técnica real + presença humana genuína + sofisticação com acolhimento',
    'Diferencial único: a única que une expertise em pele negra + noivas premium + presença humana',
    '',
    '━━━ 5 PILARES ESTRATÉGICOS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    'I. NOIVAS PREMIUM (25% do conteúdo)',
    '   Especialização técnica e emocional em casamentos. Luxury feeling acessível.',
    '   Jornada completa — do primeiro contato ao grande dia. Relacionamento de confiança.',
    'II. PELE NEGRA (20%)',
    '   Representatividade real, não performática. Técnica inclusiva avançada.',
    '   Autoridade em subtons, texturas, produtos específicos para pele negra.',
    '   Missão: toda mulher negra merece make que a exalte, nunca apenas "atenda".',
    'III. CACHOS E CRESPOS (15%)',
    '   Cabelos naturais integrados ao atendimento. Abordagem integral: pele + cabelo + make.',
    '   Conexão com identidade cultural e autoimagem.',
    'IV. AUTORIDADE TÉCNICA (15%)',
    '   Credibilidade base para futuros cursos. Conteúdo educativo de alto valor.',
    '   Técnica como diferencial competitivo real. Confiança genuína, nunca arrogância.',
    'V. HUMANIZAÇÃO E PRESENÇA REAL (10-15%)',
    '   Bastidores, rotina, espontaneidade, humor genuíno, vulnerabilidade leve.',
    '   NÃO é virar influencer lifestyle. É criar intimidade, identificação e confiança.',
    '   O público premium quer acompanhar personalidade — autenticidade aproxima e converte.',
    '',
    '━━━ 4 PÚBLICOS-ALVO ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '1. Noiva premium (25-38 anos, classe AB) — quer a versão mais bonita de si mesma',
    '2. Mulher negra que se valoriza (20-40 anos) — cansada de makes inadequadas para seu tom',
    '3. Mulher com cabelo natural (20-45 anos) — identidade ligada aos cabelos',
    '4. Cliente eventual de evento (28-50) — busca qualidade e confiabilidade',
    '',
    '━━━ ARQUÉTIPOS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    'Primário: A CRIADORA — transforma, faz acontecer, cria beleza real',
    'Secundário: A SÁBIA/EXPERT — conhecimento profundo, orientação confiável',
    'Terciário: A PRESTATIVA/CUIDADORA — empatia, acolhimento, segurança emocional',
    '',
    '━━━ TOM DE VOZ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    'Segura sem arrogância | Especialista sem distância | Sofisticada sem frieza',
    'Acolhedora sem excesso de informalidade | Humana sem perder o posicionamento',
    'Direta e objetiva — zero floreados desnecessários | Entusiasmo genuíno',
    'NÃO É: genérica, fria, seca, excessivamente formal, artificialmente perfeita',
    '',
    '━━━ EQUILÍBRIO IDEAL DE CONTEÚDO ━━━━━━━━━━━━━━━━━━━━━━━━',
    'AUTORIDADE: técnico que impressiona e educa | CONVERSÃO: leva à contratação',
    'CONEXÃO: cria identificação | DESEJO: ativa aspiração | HUMANIZAÇÃO: Carol por trás da marca',
    'BASTIDORES: processo e preparação | TÉCNICA: demonstrações e tutoriais | PREMIUM: qualidade percebida',
    '',
    '━━━ OBJETIVOS ESTRATÉGICOS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    'Curto prazo: Agenda cheia de noivas premium + visibilidade em pele negra',
    'Médio prazo: Referência regional em noivas + pele negra + cachos',
    'Longo prazo: Curso VIP online (Formação VIP) + expansão de autoridade digital',
    'Transição atual: maquiadora freelancer → marca educadora premium',
    '',
    '━━━ PRODUTOS E SERVIÇOS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    'Atendimento de noiva premium (carro-chefe) | Maquiagem para eventos sociais',
    'Em construção: FORMAÇÃO VIP — curso online de maquiagem (autoridade → educação)',
    '',
    '━━━ DIFERENCIAÇÃO COMPETITIVA ━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '1. Especialização em pele negra + noivas (combinação raríssima no mercado)',
    '2. Metodologia própria desenvolvida na prática real',
    '3. Abordagem integral: pele + cabelo + make',
    '4. Marca pessoal genuína — não uma persona fabricada',
    '5. Posicionamento premium que não exclui — sofisticação acessível',
    '',
    '━━━ O QUE EVITAR ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    'Conteúdo lifestyle sem conexão com beleza | Humor forçado | Trends vazios',
    'Comparações negativas | Perfecionismo que cria distância | Rigidez estratégica',
    'Frieza excessiva | Excesso de técnica sem humanidade | "Parecer" premium de forma artificial'
  ].join('\n');

  window.BRAND = {
    nome: 'Carol Nunes (@makecarolnunes)',
    dna: DNA,
    // Pilares com peso ideal — usados para calcular lacunas de conteúdo.
    // aliases: termos que aparecem em categorias/títulos das ideias publicadas.
    pilares: [
      { nome: 'Noivas Premium',     peso: 25, aliases: ['noiva', 'noivas', 'casamento'] },
      { nome: 'Pele Negra',         peso: 20, aliases: ['pele negra', 'negra', 'subton', 'representativ'] },
      { nome: 'Cachos e Crespos',   peso: 15, aliases: ['cacho', 'crespo', 'cabelo natural', 'cabelo'] },
      { nome: 'Autoridade Técnica', peso: 15, aliases: ['autoridade', 'técnic', 'tecnic', 'tutorial', 'passo a passo', 'dica'] },
      { nome: 'Humanização',        peso: 15, aliases: ['bastidor', 'rotina', 'human', 'pessoal', 'vida', 'lifestyle', 'depoimento'] }
    ]
  };
})();
