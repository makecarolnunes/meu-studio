// ════════════════════════════════════════════════════════════
// fluxo/tests/navegador.js — teste no navegador de verdade (Chrome headless)
// Uso:  node fluxo/tests/navegador.js [pasta-para-as-fotos]
//
// Banco FALSO (fake-db.js) — nada vai para o Supabase. Valida:
//   • celular em pé (390×844): barra inferior, botão +, toque em todas as
//     seções e sub-seções, PF/PJ, mês, sem rolagem horizontal, nada coberto
//   • computador (1366×800): menu lateral esquerdo, todas as opções clicadas
//   • registrar um gasto pelo formulário e ver a semanada mudar na hora
// Cada clique é um clique REAL na coordenada do botão (pega botão coberto
// por outro elemento ou escondido).
// ════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os');
const { abrir, espera } = require('./cdp.js');

const SAIDA = process.argv[2] || path.join(os.tmpdir(), 'fluxo-telas');
fs.mkdirSync(SAIDA, { recursive: true });
let ok = 0, falhas = 0;
const check = (nome, cond, info) => {
  if (cond) { ok++; console.log(`   ✓ ${nome}`); }
  else { falhas++; console.log(`   ✗ ${nome}${info ? ' — ' + info : ''}`); }
};
const titulo = t => console.log('\n■ ' + t);

(async () => {
  const b = await abrir();
  const semOverflow = async () => b.js('document.documentElement.scrollWidth <= innerWidth + 1');
  const visivel = sel => b.js(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false;
    const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0; })()`);
  const tocar = async (sel, cel) => { const r = await b.clicar(sel, cel); await espera(80); return r; };
  const telaOk = async (nome, cel, tabEsperada) => {
    const tab = await b.js('UI.tab');
    const conteudo = await b.js(`document.getElementById('view').innerText.trim().length`);
    check(`${nome}: abre (${tabEsperada})`, tab === tabEsperada && conteudo > 20, `tab=${tab} conteúdo=${conteudo}`);
    check(`${nome}: sem rolagem horizontal`, await semOverflow(), await b.js('document.documentElement.scrollWidth + "px"'));
  };
  try {
    titulo('Preparando dados (banco falso, mês atual)');
    await b.tela(390, 844, true);
    await b.ir('/fluxo/');
    for (let i = 0; i < 40 && !(await b.js('ST.carregado')); i++) await espera(100);
    await b.js(`(async () => {
      const mes = stHoje().slice(0, 7);
      await AC.configurarInicial(mes); await AC.garantirMeses();
      for (const c of ST.contas.filter(c => c.tipo !== 'antiga'))
        await AC.conciliar(c.id, { data: FX.addDias(mes + '-01', -1), saldoBanco: c.tipo === 'corrente' ? '2500' : '0' });
      UI.ent = 'PF'; UI.tab = 'inicio'; render();
    })()`);
    check('estrutura criada', (await b.js('ST.contas.length')) > 10);

    // ── CELULAR ───────────────────────────────────────────
    titulo('Celular em pé (390×844)');
    check('barra inferior visível', await visivel('#tabs'));
    check('botão + visível', await visivel('.fab'));
    check('menu lateral escondido', !(await visivel('#lateral')));
    const alturaTab = await b.js(`Math.round(document.querySelector('#tabs button').getBoundingClientRect().height)`);
    check('botões da barra com área de toque ≥ 44px', alturaTab >= 44, alturaTab + 'px');
    const pfpj = await b.js(`(() => { const s = document.getElementById('seg-ent').getBoundingClientRect(), m = document.querySelector('.mes-nav').getBoundingClientRect(),
      bt = document.querySelector('#seg-ent button').getBoundingClientRect(); return { esq: s.left < 120 && (s.right <= m.left || s.bottom <= m.top), alt: Math.round(bt.height), dentro: s.right <= innerWidth && m.right <= innerWidth,
      nome: document.getElementById('seg-ent').innerText.includes('Pessoal') }; })()`);
    check('PF/PJ à esquerda, sem encostar no mês, com nome, botão ≥ 40px, tudo cabe na tela', pfpj.esq && pfpj.alt >= 40 && pfpj.dentro && pfpj.nome, JSON.stringify(pfpj));
    await b.foto(path.join(SAIDA, 'celular-hoje.png'));
    await b.foto(path.join(SAIDA, 'celular-hoje-inteira.png'), true);
    for (const [id, nome] of [['plano', 'Plano'], ['caixinhas', 'Caixinhas'], ['movs', 'Movimentos'], ['mais', 'Mais'], ['inicio', 'Hoje']]) {
      const r = await tocar(`#tabs button[data-tab="${id}"]`, true);
      check(`toque em "${nome}"`, r.ok, r.motivo);
      await telaOk(nome, true, id);
      await b.foto(path.join(SAIDA, `celular-${id}.png`), true);
    }
    // caixinha anual (Sazonais): mês + ano
    await tocar('#tabs button[data-tab="caixinhas"]', true);
    check('Sazonais mostra o bloco "No ano"', await b.js(`[...document.querySelectorAll('.cx-anual')].some(e => e.innerText.includes('Sazonais') && e.innerText.includes('No ano') && e.innerText.includes('Meta do mês'))`));
    await b.js(`(() => { const c = [...document.querySelectorAll('.cx-anual')].find(e => e.innerText.includes('Sazonais')); toggleAberto(c.id.slice(3)); })()`);
    await espera(80);
    check('Detalhes de Sazonais: mês a mês do ano', await b.js(`document.querySelectorAll('.ano-m').length >= 12`));
    check('Caixinhas com o ano: sem rolagem horizontal', await semOverflow());
    await b.js(`document.querySelector('.cx-anual').scrollIntoView()`);
    await b.foto(path.join(SAIDA, 'celular-caixinha-anual.png'), true);
    // "i" + balão
    let r = await tocar('.cx-anual .cx-ano-h .i-info', true);
    const bal = await b.js(`(() => { const e = document.getElementById('balao'); if (!e) return null; const q = e.getBoundingClientRect();
      return { on: e.classList.contains('on'), dentro: q.left >= 0 && q.right <= innerWidth && q.top >= 0 && q.bottom <= innerHeight, txt: e.innerText.length }; })()`);
    check('toque no "i" abre o balão de informação dentro da tela', r.ok && bal && bal.on && bal.dentro && bal.txt > 40, JSON.stringify(bal) + ' ' + (r.motivo || ''));
    await b.foto(path.join(SAIDA, 'celular-balao.png'));
    await b.js(`document.querySelector('.tela-t').dispatchEvent(new MouseEvent('click', { bubbles: true }))`);
    check('tocar fora NÃO fecha o balão', await b.js(`document.getElementById('balao').classList.contains('on')`));
    r = await tocar('#balao .balao-x', true);
    check('× fecha o balão', r.ok && !(await b.js(`document.getElementById('balao').classList.contains('on')`)), JSON.stringify(r) + ' ' + (await b.js(`(() => { const e = document.getElementById('balao'); return e.className + ' ' + e.style.cssText + ' ' + e.innerHTML.slice(0, 120); })()`)));
    check('bloco do ano sem frases longas', await b.js(`!/Para fechar o ano|Ainda pode usar|Em média/.test(document.querySelector('.cx-anual').innerText)`));
    r = await tocar('.cx-anual .cx-ano-h .lnk', true);
    check('"Ajustar meta" abre o formulário da meta do ano', r.ok && (await b.js(`!!document.getElementById('ma-valor')`)), r.motivo);
    await b.foto(path.join(SAIDA, 'celular-meta-anual.png'));
    r = await tocar('#modal-box h2 .i-info', true);
    check('"i" funciona dentro do formulário (balão por cima)', r.ok && (await b.js(`document.getElementById('balao').classList.contains('on')`)), r.motivo);
    await tocar('#modal-box .fl', true);
    await tocar('#modal-box .btn.ghost', true);
    check('fechar a folha fecha o balão de dentro dela', !(await b.js(`document.getElementById('balao').classList.contains('on')`)));
    // semana: card limpo, detalhes ao tocar
    check('semanas sem linha de categoria/atendimento no card', await b.js(`document.querySelectorAll('.sem').length > 0 && ![...document.querySelectorAll('.sem')].some(e => /atend\.|Deslocamento|Alimenta/.test(e.innerText))`));
    r = await tocar('.sem.atual', true);
    const det = await b.js(`(() => { const m = document.getElementById('modal-box'); return { on: document.getElementById('modal').classList.contains('on'), h: (m.querySelector('h2') || {}).innerText || '', txt: m.innerText }; })()`);
    check('tocar na semana abre os detalhes', r.ok && det.on && /^S[0-9]/.test(det.h) && /Por categoria/i.test(det.txt) && !/Reservad/i.test(det.txt), JSON.stringify(det).slice(0, 200));
    await b.foto(path.join(SAIDA, 'celular-semana.png'));
    await b.js(`document.getElementById('modal').dispatchEvent(new MouseEvent('click', { bubbles: true }))`);
    check('detalhe da semana não fecha ao tocar fora', await b.js(`document.getElementById('modal').classList.contains('on')`));
    await tocar('#modal-box .btn.ghost', true);
    // categorias: criar "Cuidados pessoais" (fixa) pela tela
    await b.js(`UI.ent='PF';formCategorias('PF')`); await espera(80);
    r = await tocar('#modal-box > .btn', true);
    check('Categorias › "+ Nova categoria" abre o formulário', r.ok && (await b.js(`!!document.getElementById('ct-nome')`)), r.motivo);
    await b.js(`document.getElementById('ct-nome').value='Cuidados pessoais';document.getElementById('ct-valor').value='120'`);
    await tocar('#modal-box .btn:not(.ghost)', true); await espera(300);
    check('categoria nova criada e conta fixa no plano', await b.js(`categorias('PF').some(c => c.nome === 'Cuidados pessoais') && ST.itens.some(i => i.mes === 'modelo' && i.descricao === 'Cuidados pessoais')`));
    check('categorias: sem rolagem horizontal', await semOverflow());
    await b.js(`fecharModal();UI.aberto={};go('inicio')`);
    // IA no extrato (resposta simulada — nenhuma chamada de verdade)
    await b.js(`(() => { localStorage.setItem('mk_claude_key', 'teste'); const f0 = window.fetch; window.__ia = 0;
      window.fetch = (u, o) => { if (!String(u).includes('api.anthropic.com')) return f0(u, o);
        window.__ia++; const body = JSON.parse(o.body), cat = body.output_config.format.schema.properties.linhas.items.properties.categoria.enum[0];
        const linhas = JSON.parse(body.messages[0].content).linhas.map(l => ({ i: l.i, decisao: 'gasto', categoria: cat, conta: '', item: '', cliente: '', confianca: 'alta', motivo: 'teste' }));
        return Promise.resolve(new Response(JSON.stringify({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ linhas }) }] }), { status: 200 })); }; })()`);
    await b.js(`(() => { const c = ST.contas.find(c => c.entidade === 'PF' && c.tipo === 'corrente'); UI.ent = 'PF'; UI.tab = 'conciliar';
      UI.extrato = { contaId: c.id, info: 'teste', propostas: AC.prepararExtrato(c.id, [{ data: stHoje(), descricao: 'ZZQX 7781 KWV', valor: -33 }]) }; render(); iaExtrato(); })()`);
    await espera(400);
    check('IA pré-preenche a linha do extrato (marca "pela IA")', await b.js(`window.__ia === 1 && UI.extrato.propostas.some(p => p.auto === 'ia') && !!document.querySelector('.ia-st.ia-ok') && document.body.innerText.includes('pela IA')`),
      await b.js(`JSON.stringify({ chamadas: window.__ia, ia: UI.extrato && UI.extrato.ia, auto: UI.extrato && UI.extrato.propostas.map(p => p.auto + '/' + p.acao) })`));
    await b.foto(path.join(SAIDA, 'celular-extrato-ia.png'));
    await b.js(`UI.extrato = null; localStorage.removeItem('mk_claude_key'); go('inicio')`);
    // sub-seções
    await tocar('#tabs button[data-tab="movs"]', true);
    r = await tocar('.seg.sub button:nth-child(2)', true);
    check('Movimentos › "Conferir com o banco" por toque', r.ok, r.motivo);
    await telaOk('Conferir com o banco', true, 'conciliar');
    check('barra inferior marca "Movimentos" na tela Conferir', await b.js(`document.querySelector('#tabs button[data-tab="movs"]').classList.contains('on')`));
    await b.foto(path.join(SAIDA, 'celular-conciliar.png'), true);
    for (const [k, alvo] of [[1, 'conciliar'], [2, 'dividas'], [3, 'analises'], [4, 'plano']]) {
      await tocar('#tabs button[data-tab="mais"]', true);
      r = await tocar(`#view .card.lista .aj:nth-child(${k})`, true);
      check(`Mais › item ${k} por toque`, r.ok, r.motivo);
      await telaOk(`Mais › ${alvo}`, true, alvo);
      await b.foto(path.join(SAIDA, `celular-mais-${k}-${alvo}.png`), true);
    }
    await b.js('UI.modelo=false;render()');
    // PF / PJ e mês
    await tocar('#tabs button[data-tab="inicio"]', true);
    r = await tocar('#seg-ent button:nth-child(2)', true);
    check('trocar para PJ por toque', r.ok && (await b.js('UI.ent')) === 'PJ', r.motivo);
    await telaOk('Hoje PJ', true, 'inicio');
    await b.foto(path.join(SAIDA, 'celular-hoje-pj.png'), true);
    await tocar('#seg-ent button:nth-child(1)', true);
    check('voltar para PF por toque', (await b.js('UI.ent')) === 'PF');
    const mes0 = await b.js('UI.mes');
    await tocar('.mes-nav button:last-child', true);
    check('próximo mês por toque', (await b.js('UI.mes')) !== mes0);
    await tocar('.mes-nav button:first-child', true);
    check('mês anterior por toque', (await b.js('UI.mes')) === mes0);
    // botão + e uma ação das próximas ações
    r = await tocar('.fab', true);
    check('botão + abre "Registrar"', r.ok && (await b.js(`document.getElementById('modal').classList.contains('on') && document.getElementById('modal-box').innerText.includes('Registrar')`)), r.motivo);
    await b.foto(path.join(SAIDA, 'celular-registrar.png'));
    r = await tocar('#modal-box .btn.ghost', true);
    check('Cancelar fecha o modal', !(await b.js(`document.getElementById('modal').classList.contains('on')`)), r.motivo);
    r = await tocar('.ac .btn.mini', true);
    check('botão de uma próxima ação abre o registro', r.ok && (await b.js(`document.getElementById('modal').classList.contains('on')`)), r.motivo);
    await tocar('#modal-box .btn.ghost', true);
    // ver mais / recolher
    const temMais = await b.js(`!!document.querySelector('.mais-l')`);
    if (temMais) {
      const antes = await b.js(`document.querySelectorAll('.ac').length`);
      await tocar('.mais-l', true);
      check('"Ver mais" mostra os outros itens', (await b.js(`document.querySelectorAll('.ac').length`)) > antes);
    }

    titulo('Cenário: registrar um gasto e ver a semanada mudar na hora');
    await b.js(`UI.aberto={};go('inicio')`);
    const antes = await b.js(`(() => { const w = painel().semana; return { gasto: w.gasto, pode: w.podeGastar, orc: w.orcamento }; })()`);
    r = await tocar('.hero .acoes2 .btn:first-child', true);
    check('"+ Gasto" no cartão da semanada abre o formulário', r.ok && (await b.js(`!!document.getElementById('g-valor')`)), r.motivo);
    const valor = Math.round(antes.pode + 70);   // passa 70 do orçamento
    await b.js(`document.getElementById('g-valor').value = '${valor}'; document.getElementById('g-desc').value = 'Mercado da semana'; document.getElementById('g-cat').value = 'Mercado'; gAtualiza();`);
    r = await tocar('#modal-box .btn:not(.ghost):not(.sec)', true);
    await espera(300);
    const depois = await b.js(`(() => { const w = painel().semana; return { gasto: w.gasto, acima: w.acima }; })()`);
    check('semanada atualizada na hora', Math.abs(depois.gasto - antes.gasto - valor) < 0.01, JSON.stringify({ antes, depois, valor }));
    check('cartão mostra "acima do orçamento"', await b.js(`document.querySelector('.hero').innerText.includes('acima')`));
    check('aviso confirma como ficou a semana', await b.js(`document.getElementById('toast').innerText.includes('acima do orçamento')`),
      await b.js(`document.getElementById('toast').innerText`));
    await b.foto(path.join(SAIDA, 'celular-semanada-estourou.png'));

    titulo('Tablet / celular deitado (800×600)');
    await b.tela(800, 600, true);
    for (const id of ['inicio', 'caixinhas', 'plano', 'conciliar']) { await b.js(`go('${id}')`); check(`${id}: sem rolagem horizontal`, await semOverflow()); }

    // ── COMPUTADOR ────────────────────────────────────────
    titulo('Computador (1366×800): menu lateral esquerdo');
    await b.tela(1366, 800, false);
    await b.js(`go('inicio')`);
    check('menu lateral visível', await visivel('#lateral'));
    check('barra inferior escondida', !(await visivel('#tabs')));
    check('botão + flutuante escondido', !(await visivel('.fab')));
    const ids = await b.js(`[...document.querySelectorAll('#lateral .lat-nav button[data-tab]')].map(x => x.dataset.tab)`);
    check('menu lateral tem todas as seções', ['inicio', 'plano', 'caixinhas', 'movs', 'conciliar', 'dividas', 'analises', 'ajustes'].every(i => ids.includes(i)), ids.join(','));
    for (const id of ids) {
      r = await tocar(`#lateral button[data-tab="${id}"]`, false);
      check(`clique em "${id}"`, r.ok, r.motivo);
      await telaOk(id, false, id);
      check(`"${id}" marcado como atual no menu`, await b.js(`document.querySelector('#lateral button[data-tab="${id}"]').classList.contains('on')`));
      await b.foto(path.join(SAIDA, `desktop-${id}.png`), true);
    }
    r = await tocar('#lateral .lat-novo', false);
    check('"+ Registrar" abre o menu de registro', r.ok && (await b.js(`document.getElementById('modal').classList.contains('on')`)), r.motivo);
    await tocar('#modal-box .btn.ghost', false);
    r = await tocar('#mk-sb-fab', false);
    check('menu geral do Meu Studio (☰) abre por cima', r.ok && (await b.js(`document.getElementById('mk-sidebar').classList.contains('mk-on')`)), r.motivo);
    await b.js('mkSidebarClose()');
    await b.js(`go('inicio')`);
    await espera(450);   // animação do menu geral fechando
    await b.foto(path.join(SAIDA, 'desktop-inicio.png'));

    titulo('Erros de JavaScript');
    check('nenhum erro no console', b.erros.length === 0, b.erros.slice(0, 3).join(' | '));
  } catch (e) {
    falhas++; console.log('   ✗ falhou: ' + (e.stack || e));
  } finally {
    await b.fechar();
  }
  console.log(`\n${falhas ? '✗' : '✓'} ${ok} verificações ok, ${falhas} falha(s) · fotos em ${SAIDA}`);
  process.exit(falhas ? 1 : 0);
})();
