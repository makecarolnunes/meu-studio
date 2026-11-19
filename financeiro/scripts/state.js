// ════════════════════════════════════════════════════════════
// financeiro/scripts/state.js
// Estado global + constantes + cache localStorage
// Carregar primeiro na ordem dos scripts do módulo
// ════════════════════════════════════════════════════════════

const MEI_LIMITE = 81000;
const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
// Lista canônica de tipos de despesa profissional — única fonte da verdade
const SAIDA_TIPOS_PROF = [
  'Assistente',
  'Cursos',
  'DAS',
  'Reposição',            // produtos e materiais do kit (caixinha Reposição)
  'Deslocamento',
  'Alimentação trabalho',
  'Investimentos',        // equipamentos/estrutura (caixinha Cursos e investimentos)
  'Modelos',
  'Assinaturas',
  'Marketing',
  'Equipe',
  'Outro',
];

// Uma lista só com o Meu dinheiro (shared/js/categorias.js): as categorias PJ
// editadas em Meu dinheiro › Ajustes › Categorias. Sem cache, usa a lista acima.
// Config do Meu dinheiro ainda sem a lista unificada (versão < 7, antes de abrir o
// Meu dinheiro): completa com os tipos que só existiam aqui, antes do 'Outro'.
function catsPJ() {
    const pj = window.CATEGORIAS && CATEGORIAS.PJ();
    if (!pj || CATEGORIAS.versao() >= 7) return pj;
    const falta = SAIDA_TIPOS_PROF.filter(n => n !== 'Outro' && !pj.some(c => c.nome === n)).map(n => ({ nome: n, grupo: 'Atendimento' }));
    const i = pj.findIndex(c => c.nome === 'Outro');
    return i < 0 ? pj.concat(falta) : pj.slice(0, i).concat(falta, pj.slice(i));
}
function getTiposProfissionais() {
    const pj = catsPJ();
    if (!pj) return SAIDA_TIPOS_PROF;
    const nomes = pj.map(c => c.nome).filter(n => n !== 'Outro');
    return nomes.concat(['Outro']);
}
// <option>s do "Tipo de despesa", agrupados como no Meu dinheiro (Semanada, Reposição…)
function optTiposDespesa(sel) {
    const pj = catsPJ();
    if (pj) return CATEGORIAS.opcoes(pj, sel);
    const lista = SAIDA_TIPOS_PROF.concat(sel && !SAIDA_TIPOS_PROF.includes(sel) ? [sel] : []);
    return lista.map(t => `<option value="${t}" ${sel === t ? 'selected' : ''}>${t}</option>`).join('');
}
// Categoria do gasto pessoal (PF), para a saída "Pessoal" já chegar organizada no Meu dinheiro
function optCategoriasPF(sel) {
    const pf = window.CATEGORIAS && CATEGORIAS.PF();
    return pf ? CATEGORIAS.opcoes(pf, sel, 'Categoria pessoal…') : '';
}

let entries        = JSON.parse(localStorage.getItem('mk_entries') || '[]');
let saidas         = JSON.parse(localStorage.getItem('mk_saidas')  || '[]');
let noivas         = JSON.parse(localStorage.getItem('mk_noivas')  || '[]');
let screen         = 'resumo';
let selMonth       = new Date().getMonth();
let selYear        = new Date().getFullYear();
let listFilter     = 'todos';
let listEquipeFilter = 'todos';
let saidasFormOpen = false;
let saidasNaturezaFilter = 'todas';  // 'todas' | 'PROFISSIONAL' | 'PESSOAL' | 'MISTA'
let saidasTipoFilter    = 'todas';  // 'todas' | nome da categoria
let saidasFormaFilter   = [];        // multi-seleção de forma de pagamento ([] = todas)
let saidasVerTodosMeses = false;    // ver categoria selecionada em todos os meses
// Visão das saídas no tempo: 'caixa' agrupa por competência (cartão pesa no mês
// anterior ao vencimento) · 'banco' agrupa pelo vencimento/movimento bancário.
let saidasVisao         = 'caixa';
let noivaDetail    = null;

// ── Resumo: filtro de período ─────────────────────────────
// Tipos: 'mes' | 'ultimos3' | 'ultimos6' | 'ano' | 'acumulado' | 'personalizado'
let resumoPeriodo  = 'mes';
let resumoDataIni  = '';   // ISO yyyy-mm-dd quando 'personalizado'
let resumoDataFim  = '';

function resumoRange() {
    const now  = new Date();
    const yNow = now.getFullYear();
    const mNow = now.getMonth();
    const fmt = (d) => {
        return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(d).replace('.','');
    };
    if (resumoPeriodo === 'mes') {
        const ini = new Date(selYear, selMonth, 1);
        const fim = new Date(selYear, selMonth + 1, 0, 23, 59, 59);
        return { ini, fim, titulo: `${MONTHS[selMonth]} ${selYear}`, mostrarNav: true };
    }
    if (resumoPeriodo === 'ultimos3') {
        const ini = new Date(yNow, mNow - 2, 1);
        const fim = new Date(yNow, mNow + 1, 0, 23, 59, 59);
        return { ini, fim, titulo: `Últimos 3 meses · ${fmt(ini)}–${fmt(fim)}`, mostrarNav: false };
    }
    if (resumoPeriodo === 'ultimos6') {
        const ini = new Date(yNow, mNow - 5, 1);
        const fim = new Date(yNow, mNow + 1, 0, 23, 59, 59);
        return { ini, fim, titulo: `Últimos 6 meses · ${fmt(ini)}–${fmt(fim)}`, mostrarNav: false };
    }
    if (resumoPeriodo === 'ano') {
        const ini = new Date(selYear, 0, 1);
        const fim = new Date(selYear, 11, 31, 23, 59, 59);
        return { ini, fim, titulo: `Ano de ${selYear}`, mostrarNav: false };
    }
    if (resumoPeriodo === 'acumulado') {
        const ini = new Date(yNow, 0, 1);
        const fim = new Date(yNow, mNow + 1, 0, 23, 59, 59);
        return { ini, fim, titulo: `Acumulado ${yNow}`, mostrarNav: false };
    }
    if (resumoPeriodo === 'personalizado' && resumoDataIni && resumoDataFim) {
        const ini = new Date(resumoDataIni);
        const fim = new Date(resumoDataFim);
        fim.setHours(23,59,59);
        return { ini, fim, titulo: `${fmt(ini)} → ${fmt(fim)}`, mostrarNav: false };
    }
    // fallback: mês
    const ini = new Date(selYear, selMonth, 1);
    const fim = new Date(selYear, selMonth + 1, 0, 23, 59, 59);
    return { ini, fim, titulo: `${MONTHS[selMonth]} ${selYear}`, mostrarNav: true };
}

// Helper: registro está no intervalo? (recebe yyyy-mm-dd ou Date)
function inResumoRange(dataStr, ini, fim) {
    if (!dataStr) return false;
    const d = new Date(dataStr);
    if (isNaN(d)) return false;
    return d >= ini && d <= fim;
}

// Quantos meses (incluindo bordas) o range cobre — pra anualizações e médias
function rangeMeses(ini, fim) {
    return (fim.getFullYear() - ini.getFullYear()) * 12 + (fim.getMonth() - ini.getMonth()) + 1;
}
let isSyncing        = false;
let selectedEntryId  = null;   // master-detail desktop: entrada selecionada
let F = {}, Fs = {};
let _pendingDelSaidaId = null;

function cacheEntries() { localStorage.setItem('mk_entries', JSON.stringify(entries)); }
function cacheSaidas()  { localStorage.setItem('mk_saidas',  JSON.stringify(saidas)); }
function cacheNoivas()  { localStorage.setItem('mk_noivas',  JSON.stringify(noivas)); }

function initF()  {
    F  = { dataPag: today(), dataServ: '', cliente: '', tipo: 'Pagamento',
           valor: '', valorTotal: '', servico: 'Maquiagem', local: 'Studio',
           forma: 'PIX', status: 'Realizado', origem: 'Produção Social', obs: '', equipe: '' };
}
function initFs() {
    Fs = { dataPag: today(), valor: '', tipo: 'Reposição',
           status: 'Pago', forma: 'PIX', obs: '', recorrencia: 'unica', meses: 2,
           natureza: 'PROFISSIONAL', transferenciaParaMim: false, catPF: '' };
}
