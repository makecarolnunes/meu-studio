// ════════════════════════════════════════════════════════════
// financeiro/scripts/state.js
// Estado global + constantes + cache localStorage
// Carregar primeiro na ordem dos scripts do módulo
// ════════════════════════════════════════════════════════════

const MEI_LIMITE = 81000;
const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const SAIDA_TIPOS = ['Reposição de Material','Curso','DAS','Assistente','Seguro de Celular','Investimento Produto','Investimento Material','Outro'];

let entries        = JSON.parse(localStorage.getItem('mk_entries') || '[]');
let saidas         = JSON.parse(localStorage.getItem('mk_saidas')  || '[]');
let noivas         = JSON.parse(localStorage.getItem('mk_noivas')  || '[]');
let screen         = 'nova';
let selMonth       = new Date().getMonth();
let selYear        = new Date().getFullYear();
let listFilter     = 'todos';
let saidasFormOpen = false;
let noivaDetail    = null;
let isSyncing      = false;
let F = {}, Fs = {};

function cacheEntries() { localStorage.setItem('mk_entries', JSON.stringify(entries)); }
function cacheSaidas()  { localStorage.setItem('mk_saidas',  JSON.stringify(saidas)); }
function cacheNoivas()  { localStorage.setItem('mk_noivas',  JSON.stringify(noivas)); }

function initF()  {
    F  = { dataPag: today(), dataServ: '', cliente: '', tipo: 'Pagamento',
           valor: '', valorTotal: '', servico: 'Maquiagem', local: 'Studio',
           forma: 'PIX', status: 'Realizado', origem: 'Produção Social', obs: '' };
}
function initFs() {
    Fs = { dataPag: today(), valor: '', tipo: 'Reposição de Material',
           status: 'Pago', forma: 'PIX', obs: '' };
}
