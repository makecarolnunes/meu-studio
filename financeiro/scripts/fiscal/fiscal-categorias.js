// ════════════════════════════════════════════════════════════
// fiscal-categorias.js — Categorias seed + regras embutidas
// Hardcoded em JS (não tabela) porque mudam pouco e simplifica.
// PROFISSIONAIS têm categoria; PESSOAIS não — só natureza.
// ════════════════════════════════════════════════════════════

window.FS_CATEGORIAS = [
  // PROFISSIONAIS
  { id: 'deslocamento',     nome: 'Deslocamento',     icone: '🚗', nat: 'PROFISSIONAL', dedutivel: true  },
  { id: 'combustivel',      nome: 'Combustível',      icone: '⛽', nat: 'MISTA',        dedutivel: false },
  { id: 'estacionamento',   nome: 'Estacionamento',   icone: '🅿️', nat: 'PROFISSIONAL', dedutivel: true  },
  { id: 'alimentacao',      nome: 'Alimentação trabalho', icone: '🍽️', nat: 'PROFISSIONAL', dedutivel: true },
  { id: 'produtos',         nome: 'Produtos',         icone: '💄', nat: 'PROFISSIONAL', dedutivel: true  },
  { id: 'equipamentos',     nome: 'Equipamentos',     icone: '🧳', nat: 'PROFISSIONAL', dedutivel: true  },
  { id: 'cursos',           nome: 'Cursos',           icone: '🎓', nat: 'PROFISSIONAL', dedutivel: true  },
  { id: 'fornecedores',     nome: 'Fornecedores',     icone: '📦', nat: 'PROFISSIONAL', dedutivel: true  },
  { id: 'marketing',        nome: 'Marketing',        icone: '📱', nat: 'PROFISSIONAL', dedutivel: true  },
  { id: 'das',              nome: 'DAS',              icone: '🧾', nat: 'PROFISSIONAL', dedutivel: false },
  { id: 'assistente',       nome: 'Assistente',       icone: '👥', nat: 'PROFISSIONAL', dedutivel: true  },
  { id: 'reposicao',        nome: 'Reposição de Material', icone: '🛒', nat: 'PROFISSIONAL', dedutivel: true },

  // PESSOAL — único bucket, sem subcategorias (combinado com a usuária)
  { id: 'pessoal',          nome: 'Pessoal',          icone: '👤', nat: 'PESSOAL',      dedutivel: false },

  // Estados especiais
  { id: 'transferencia',    nome: 'Transferência',    icone: '↔️', nat: 'IGNORAR',      dedutivel: false },
  { id: 'outro',            nome: 'Outro',            icone: '•',  nat: 'PROFISSIONAL', dedutivel: false },
];

// Regras seed (substring lowercase). Aplicadas antes da IA.
// Reduzem custo e dão match 100% confiança em casos óbvios.
window.FS_REGRAS_SEED = [
  // Deslocamento
  { padrao: 'uber',             categoria: 'Deslocamento',     natureza: 'PROFISSIONAL' },
  { padrao: '99 app',           categoria: 'Deslocamento',     natureza: 'PROFISSIONAL' },
  { padrao: '99taxi',           categoria: 'Deslocamento',     natureza: 'PROFISSIONAL' },
  { padrao: 'taxi',             categoria: 'Deslocamento',     natureza: 'PROFISSIONAL' },
  // Combustível (mista — pergunta)
  { padrao: 'shell',            categoria: 'Combustível',      natureza: 'MISTA' },
  { padrao: 'petrobras',        categoria: 'Combustível',      natureza: 'MISTA' },
  { padrao: 'ipiranga',         categoria: 'Combustível',      natureza: 'MISTA' },
  { padrao: 'br mania',         categoria: 'Combustível',      natureza: 'MISTA' },
  { padrao: 'posto ',           categoria: 'Combustível',      natureza: 'MISTA' },
  // Estacionamento
  { padrao: 'estapar',          categoria: 'Estacionamento',   natureza: 'PROFISSIONAL' },
  { padrao: 'estacion',         categoria: 'Estacionamento',   natureza: 'PROFISSIONAL' },
  { padrao: 'zona azul',        categoria: 'Estacionamento',   natureza: 'PROFISSIONAL' },
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
  // Pessoais comuns (a IA também pega — aqui só os super recorrentes)
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
// Categorias profissionais pra mostrar no seletor (exclui pessoal/ignorar/outro)
function fsCategoriasProfissionais() {
  return FS_CATEGORIAS.filter(c => c.nat === 'PROFISSIONAL' || c.nat === 'MISTA')
                      .filter(c => c.id !== 'das');
}
