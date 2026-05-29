// ════════════════════════════════════════════════════════════
// fiscal-categorias.js — Categorias seed + regras embutidas
// Hardcoded em JS (não tabela) porque mudam pouco e simplifica.
// PROFISSIONAIS têm categoria; PESSOAIS não — só natureza.
// ════════════════════════════════════════════════════════════

window.FS_CATEGORIAS = [
  // PROFISSIONAIS — lista canônica (mesma ordem de SAIDA_TIPOS_PROF em state.js)
  { id: 'assistente',   nome: 'Assistente',                      icone: '👥', nat: 'PROFISSIONAL', dedutivel: true  },
  { id: 'cursos',       nome: 'Cursos',                          icone: '🎓', nat: 'PROFISSIONAL', dedutivel: true  },
  { id: 'das',          nome: 'DAS',                             icone: '🧾', nat: 'PROFISSIONAL', dedutivel: false },
  { id: 'reposicao',    nome: 'Reposição/Investimento de material', icone: '🛒', nat: 'PROFISSIONAL', dedutivel: true },
  { id: 'deslocamento', nome: 'Deslocamento',                    icone: '🚗', nat: 'PROFISSIONAL', dedutivel: true  },
  { id: 'alimentacao',  nome: 'Alimentação trabalho',            icone: '🍽️', nat: 'PROFISSIONAL', dedutivel: true  },
  { id: 'equipamentos', nome: 'Equipamentos',                    icone: '🧳', nat: 'PROFISSIONAL', dedutivel: true  },
  { id: 'modelos',      nome: 'Modelos',                         icone: '💆', nat: 'PROFISSIONAL', dedutivel: true  },
  { id: 'assinaturas',  nome: 'Assinaturas',                     icone: '📋', nat: 'PROFISSIONAL', dedutivel: true  },
  { id: 'marketing',    nome: 'Marketing',                       icone: '📱', nat: 'PROFISSIONAL', dedutivel: true  },
  { id: 'equipe',       nome: 'Equipe',                          icone: '🤝', nat: 'PROFISSIONAL', dedutivel: true  },
  { id: 'outro',        nome: 'Outro',                           icone: '•',  nat: 'PROFISSIONAL', dedutivel: false },

  // PESSOAL — sem subcategorias
  { id: 'pessoal',      nome: 'Pessoal',                         icone: '👤', nat: 'PESSOAL',      dedutivel: false },

  // Estado especial — nunca vira saída
  { id: 'transferencia', nome: 'Transferência',                  icone: '↔️', nat: 'IGNORAR',      dedutivel: false },
];

// Regras seed (substring lowercase). Aplicadas antes da IA.
window.FS_REGRAS_SEED = [
  // Deslocamento
  { padrao: 'uber',             categoria: 'Deslocamento',     natureza: 'PROFISSIONAL' },
  { padrao: '99 app',           categoria: 'Deslocamento',     natureza: 'PROFISSIONAL' },
  { padrao: '99taxi',           categoria: 'Deslocamento',     natureza: 'PROFISSIONAL' },
  { padrao: 'taxi',             categoria: 'Deslocamento',     natureza: 'PROFISSIONAL' },
  // Marketing
  { padrao: 'meta plat',        categoria: 'Marketing',        natureza: 'PROFISSIONAL' },
  { padrao: 'facebook',         categoria: 'Marketing',        natureza: 'PROFISSIONAL' },
  { padrao: 'google ads',       categoria: 'Marketing',        natureza: 'PROFISSIONAL' },
  // DAS / impostos
  { padrao: 'das mei',          categoria: 'DAS',              natureza: 'PROFISSIONAL' },
  { padrao: 'simples nacional', categoria: 'DAS',              natureza: 'PROFISSIONAL' },
  // Transferências (ignorar)
  { padrao: 'transf pix env',   categoria: 'Transferência',    natureza: 'IGNORAR' },
  { padrao: 'transferencia entre contas', categoria: 'Transferência', natureza: 'IGNORAR' },
  { padrao: 'transf entre contas', categoria: 'Transferência', natureza: 'IGNORAR' },
  // Pessoais comuns
  { padrao: 'netflix',          categoria: 'Pessoal',          natureza: 'PESSOAL' },
  { padrao: 'spotify',          categoria: 'Pessoal',          natureza: 'PESSOAL' },
  { padrao: 'amazon prime',     categoria: 'Pessoal',          natureza: 'PESSOAL' },
];

function fsCategoriaById(id) {
  return FS_CATEGORIAS.find(c => c.id === id) || FS_CATEGORIAS.find(c => c.nome === id);
}
function fsCategoriaByNome(nome) {
  return FS_CATEGORIAS.find(c => c.nome === nome);
}
function fsCategoriaIcone(nome) {
  const c = fsCategoriaByNome(nome);
  return c ? c.icone : '•';
}
// Categorias profissionais pra mostrar no seletor (exclui pessoal e ignorar)
function fsCategoriasProfissionais() {
  return FS_CATEGORIAS.filter(c => c.nat === 'PROFISSIONAL');
}
