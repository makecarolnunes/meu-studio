# CLAUDE.md — Meu dinheiro (`/fluxo/`)

Planejamento, execução e conciliação do financeiro **PF + PJ**. Incorpora o
antigo `/pessoal/` (mesmas tabelas, mesmo login) e lê o Financeiro PJ sem
alterá-lo. Diagnóstico da planilha da consultoria: `DIAGNOSTICO.md`.

## Scripts (ordem obrigatória)

```
modelo.js         semente da planilha (só usada no assistente de estrutura inicial)
core.js           FX — cálculos PUROS (sem DOM/DB). Toda regra de negócio fica aqui.
store.js          ST — estado + leitura/gravação + fin_log
acoes.js          AC — execução (aporte, gasto, pró-labore, fatura, conciliação, extrato, plano)
extrato-parser.js ppParseArquivo() — OFX/CSV (veio do /pessoal/)
ia-extrato.js     iaExtrato() — IA (claude-haiku-5-5) pré-preenche linhas novas do extrato que as regras não reconheceram
ui.js · telas.js · forms.js · main.js
```

Testes (banco falso em memória, `tests/fake-db.js` — nada vai para o Supabase):
- `node fluxo/tests/cenarios.js` — regras + cenários V1–V7 da experiência + render de todas as telas.
- `node fluxo/tests/navegador.js [pasta-fotos]` — Chrome headless de verdade (`tests/cdp.js`): celular 390×844 e computador 1366×800, clique real em todas as seções, rolagem horizontal, erros de JS, fluxo de registrar gasto. Tira fotos das telas.
**Rodar os dois depois de mexer em core/store/acoes/ui/telas/forms/css.**

## Telas (sequência Planejar → Distribuir → Gastar → Acompanhar → Conciliar)

`NAV` em `ui.js` gera o menu lateral (computador ≥ 960px) e a barra inferior (celular, 5 botões: Hoje · Plano · Caixinhas · Movimentos · Mais). PF/PJ fica no cabeçalho e vale para todas as telas.

| Tela (`UI.tab`) | Mostra |
|---|---|
| `inicio` (Hoje) | semanada da semana (quanto ainda pode gastar) · Próximas ações · Como está o mês (receber, distribuir, gastar) · Dinheiro agora |
| `plano` | painel de decisão (`FX.quadroMes`), na ordem das perguntas: **Na conta hoje** (saldo + conferido/conferir → `formConciliar`; barra comprometido âmbar × livre verde; guardado nas caixinhas) · **Até o fim do mês** (hoje + entra − sai = fim; "Faltam X a partir de" ou "✓ fecha") · **Pró-labore** (ponte PJ→PF nas duas entidades) · **Para onde vai o dinheiro** (linha do tempo com ✓ conta cobre / ◷ cobre quando entrar / ! falta, botão registra) · **Itens do plano** (recolhido; editar/+ Item/Modelo/Fechar). Mês que não é o atual: só o planejado. Cores: grafite saldo · âmbar comprometido · verde livre · azul entra · vermelho falta |
| `caixinhas` | cada caixinha responde uma pergunta (`FX.modoCaixinha`): **semanada** → *pode gastar esta semana* (dinheiro para usar, não para guardar) · **contas** (fixas, faxineira, cartão, MEI, dívidas) → *falta pagar* (botão Pagar da próxima; parcial → "só isso este mês" dispensa o resto) · **guardar** (cursos, reposição, sazonais…) → *falta guardar*. Resumo do topo = só as de guardar. Sem "disponível do mês" nem "reservar" (palavra: **guardar**) |
| (caixinha anual) | Sazonais e Cursos e investimentos: bloco **No ano** (meta do ano, guardado, usado, ritmo, quanto por mês para fechar o ano) + mês a mês nos Detalhes. `Ajustar meta` → `formMetaAnual` |
| `movs` / `conciliar` | lançamentos / conferir com o banco (extrato, saldos, gastos sem caixinha, recebimentos vencidos) |
| `mais`, `dividas`, `analises`, `ajustes` | — |

**Textos:** telas objetivas — número + rótulo curto + status (`.pill`). Nenhuma frase explicativa na tela: explicação vai no ícone **i** (`info(texto)` em `ui.js`, abre balão ao tocar/clicar; `\n` quebra linha; fecha só no ×, no mesmo "i" ou Esc — nunca ao tocar fora). Nos formulários, `.nota` sem id e `p.muted` viram "i" no título automaticamente (`notasEmInfo`). Avisos de ação (erro/alerta) ficam visíveis, em uma linha curta. Detalhe secundário (ex.: categorias e atendimentos da semana) não fica no card: abre em folha ao tocar (`detalheSemana`).

Nomes antigos (`mes`, `pendencias`) viram `inicio` via `TAB_ALIAS`. Os números das telas vêm de `FX.painelMes` (puro, testado); as telas só formatam.

## Modelo de dados (`sql/fluxo-financeiro.sql`)

| Tabela | Papel |
|---|---|
| `fin_contas` | corrente · caixinha · cartao · especie · antiga. `saldo_inicial`/`data_saldo_inicial` **só via conciliação** |
| `fin_transferencias` | aporte · resgate · fatura · entre_contas · ajuste — **nunca** receita/despesa |
| `fin_planos` / `fin_plano_itens` | plano por mês (`'YYYY-MM'`) + `'modelo'`. Item: tipo prolabore/receita/aporte/pagamento, dia, valor, caixinha |
| `fin_mov_meta` | id `'<tabela>:<id>'` — liga entries/saidas/entradas_pessoal/saidas_pessoal a conta, caixinha, item, dívida, conciliação **sem alterar as tabelas originais** |
| `fin_dividas`, `fin_conciliacoes`, `fin_log` | dívidas, conferências de saldo, auditoria |
| `configuracoes.fluxo_config` | semanas, categorias PF/PJ, sazonais (orçamento anual), tolerância do extrato |

`DB.fluxo` (db.js) = CRUD genérico camel↔snake **só para `fin_*`**. Não adicionar
colunas novas aos mapeadores de entries/saidas (`_ENTRY_KEYS`/`_SAIDA_KEYS`):
se a migration não estiver aplicada, o Financeiro e os Orçamentos quebrariam.

## Invariantes — NUNCA violar

1. **Previsto ≠ realizado.** Item do plano só fica `feito` com movimentação ligada (`planoItemId`). Nunca marcar feito por data.
2. **Transferência não é despesa.** `classe:'transferencia'|'ajuste'` fica fora de gastos/receitas.
3. **Cartão:** compra = despesa (conta = cartão, data da compra). Fatura = transferência conta/caixinha → cartão.
4. **Pagamento com reserva:** saída na corrente + resgate caixinha → corrente (`vinculoId`) só quando ela marca que resgatou (ver 36). Gasto direto da caixinha: conta = caixinha, sem resgate.
5. **Pró-labore:** `AC.pagarProlabore` grava saída PJ (`tipo 'Pró-labore'`, `natureza 'PESSOAL'`, `transferenciaParaMim`) e a entrada PF com id `'sync_'+saidaId` — o mesmo do trigger. Nunca criar entrada PF de pró-labore com outro id.
6. **Saldo:** `saldo_inicial` (conciliação) + movimentos com `data > data_saldo_inicial`. Sem conciliação → só movimentos desde `cfg.inicioFluxo`, marcado "não conferido". Nunca semear saldo.
7. **PF `saidas_pessoal` com `origem='sincronizado'`** = paga pela conta PJ: conta como gasto PF, não mexe em conta PF.
8. **Extrato:** casar antes de criar. Entrada de cliente `Previsto` casada vira `Realizado` (não cria receita). `extrato_ref` impede reimportar.
9. **Histórico:** mês novo = cópia (`FX.copiarItens`). Mês `fechado` bloqueia edição. Item com movimentação não se exclui (dispensar/reprogramar). Toda escrita → `stLog`.
10. **Semanas:** vêm da config; a última termina no último dia real do mês (`FX.semanas`).
11. **Automação é só leitura** (`FX.automatizar` em `stMovs()`): liga lançamento → item do plano e deduz caixinha/dívida, sem gravar. Escolha explícita vence; `'-'` em `fin_mov_meta.plano_item_id`/`caixinha_id` = "nenhum" (desliga a automação). Só vale para movimentos com data >= `cfg.inicioFluxo`.
12. **Vigência:** `mes_inicio`/`mes_fim`/`parcelas` no item; `FX.copiarItens` respeita; nome com parcela via `FX.nomeItem` (não gravar "(k/n)" na descrição).
13. **Automático ao abrir:** `AC.garantirMeses()` cria o mês atual (e o seguinte a partir de `cfg.diaCriarProximoMes`) e fecha meses antigos (`cfg.fecharMesesAposMeses`; `reaberto` impede refechar).
14. **Dívidas:** `situacao` fora_do_plano | no_plano | quitada. Fora do plano não gera pendência do mês. `AC.incluirDividaNoPlano` cria aporte + pagamento no modelo com vigência e insere nos meses abertos; histórico em `fin_divida_saldos`.
15. **Extrato:** `_sugerir` (regra aprendida > item do plano de mesmo valor > palavras de caixinha/fatura > categoria por palavras). `_aprender` grava em `cfg.regrasExtrato`.
16. **Categorias por entidade:** listas do fluxo vêm de `cfg.categorias[PF|PJ]`. PJ = só RAIO X PJ (tipos antigos do Financeiro continuam válidos nos dados, só não aparecem). Config salva sobe de versão em `stAtualizarCfg` (preserva categorias criadas pela Carol).
17. **Gasto pessoal pago pela PJ:** `registrarGasto({pessoal:true})` / decisão `pessoal` no extrato → saída PJ natureza PESSOAL tipo 'Pessoal' (classe retirada, não é despesa da empresa) + saída PF `sync_<id>` com a categoria PF escolhida (o trigger não sobrescreve a categoria).
18. **Pix PJ → Carol = pró-labore:** descrição com um dos `cfg.nomesProprios` (débito PJ / crédito PF) vira decisão `prolabore`; soma no item de pró-labore pendente mais antigo do mês (parcial até completar) ou fica fora do plano (`plano_item_id = '-'`).
19. **Reposição ≠ Investimentos:** Reposição → caixinha Reposição; Investimentos e Cursos → caixinha Cursos e investimentos. Nomes antigos do Financeiro são lidos via `cfg.aliasCategorias` (em `FX.automatizar`), sem alterar o registro.
20. **Saiu e voltou (estorno):** `FX.paresEstorno` casa, só entre linhas novas do mesmo extrato, saída + entrada de mesmo valor em até `cfg.estorno.dias` com palavra de estorno na entrada ou mesmo app/pessoa nas duas (`cfg.estorno.palavras/apps`), ou ida e volta entre as contas dela (nome de `cfg.nomesProprios` nas duas linhas, até 1 dia — não vira pró-labore). Ambas viram `acao:'estorno'` + decisão ignorar (editável). Nada é gravado.
21. **Pagamento de cliente no extrato:** crédito PJ sem casamento exato → `FX.candidatosRecebimento` (TODOS os `entries` não conciliados — previstos e recebidos —, ordenados por nome parecido, valor igual, data; busca por nome na tela). Sugere sozinho só com sinal forte (nome, valor igual em 90 dias ou pagador aprendido). `AC.receberCliente`: igual confirma; parcial confirma o pago e cria Previsto com o resto (soma do contrato preservada); maior confirma com o valor do extrato; já recebido só concilia (acerta a data do banco, valor diferente fica anotado). Pagador com nome diferente da cliente vira regra `decisao:'cliente'`.
22. **Aplicação/resgate em caixinha do banco** (`palavrasTransferencia.caixinha`, ex. "Aplicacao: CDB Porq Obj"): sempre transferência interna (nunca gasto/receita), para o saldo da corrente seguir o banco. Destino: aporte já registrado (concilia) > aporte previsto de mesmo valor > caixinha pelo nome > `Reserva Inter (não distribuída)` (`finalidade:'reserva'`, criada sozinha, abertura 0 na véspera do fluxo).

23. **Painel do mês** (`FX.painelMes`): funciona só com plano + registros, sem extrato. Semanada: `orcamento` = previsto da semana (sem plano, o reservado); reservado e gasto separados (`faltaReservar`, `gastoSemReserva`); `estourou` = gasto > orçamento. Caixinha: `disponivelMes` = transferido − usado no mês, sem saldo anterior.
24. **Próximas ações** (`FX.proximasAcoes`): atenção (passou do orçamento) > atrasado > hoje > semana > mês > conferir. Vermelho só para orçamento estourado e conta a pagar vencida; reserva/pró-labore atrasados são âmbar. Cada ação abre o registro — nunca marca feito sozinha.
25. **Extrato ignorado não volta:** linhas com decisão `ignorar` ficam em `cfg.extratoIgnorados[contaId]` (hash `FX.hashRef`, até 3000 por conta) e reaparecem como `duplicada` (`ignoradaAntes`) ao importar o mesmo período de novo.
26. **Caixinha anual** (`FX.caixinhaAnual`: finalidade sazonais/cursos ou `cfg.metaAnual[id]` > 0; `0` desliga): meta do mês = ritmo; meta do ano = `cfg.metaAnual[id]` > soma de `cfg.sazonais` > soma das metas dos 12 meses (mês sem plano usa o modelo). Ano = 12 meses desde `cfg.anoCaixinhas.mesInicio` (padrão: mês de `inicioFluxo`). Ritmo só conta reservas cujo dia já passou. "Passou do orçamento" só quando o usado no ANO passa da meta do ano.
27. **Guardar é opcional em semanada e contas** (`FX.aporteOpcional`): aporte para essas caixinhas não vira ação nem entra em "Guardar nas caixinhas"; o dinheiro pode sair direto da conta. No "Livre no mês" (`resumo`), o compromisso delas é: contas = pagamentos pendentes − saldo da caixinha; semanada = o que ainda dá para gastar nas semanas que faltam − saldo da caixinha. Nunca somar o aporte e o pagamento (desconto em dobro).
28. **Pagar = primeiro ligar o que já existe** (`candidatosPagamento` em forms.js): o formulário de pagar um item lista saídas já registradas (extrato, pago pela PJ…) da mesma entidade, até 20 dias, valor ≤ o que falta e sem item. Tocar liga (`AC.classificar`) em vez de criar outro lançamento.
29. **Saída não precisa de caixinha** (Carol, 2026-11-18): basta estar em saídas com categoria (ex.: Equipe sai direto da conta). "Organizar" (`classificar`) só pede saída **sem categoria** (vazia/Outro/Outros) e sem caixinha/item. Nos textos: "direto da conta", nunca "fora do plano" para gasto.
30. **Conta: valor do plano é previsão** (`statusItem`): pagamento ligado de verdade (Pagar, extrato, ligar — não o `autoVinculo` por categoria) fecha o item com o valor real, maior ou menor. "Ainda vou pagar o resto" (`AC.pagarItem({resto})`) cria o resto como outra conta "(resto)" no mês. `registrarGasto` não grava o item que ele mesmo deduziu pela categoria (fica `autoVinculo`). "Usar a reserva" só vem marcado se a caixinha tem saldo.
31. **Categorias** (Ajustes › Categorias, `formCategorias`): criar/editar grupo e caixinha (`cfg.caixinhaPorCategoria[ent][nome]` = finalidade, `-` = direto da conta) e tirar da lista. Categoria nova do grupo Fixas com valor → `AC.criarContaFixa` (modelo a partir do mês atual + meses abertos já criados).
32. **IA no extrato** (`ia-extrato.js`): depois de `prepararExtrato`, `iaExtrato()` manda só as linhas `novo` **sem** sugestão das regras (`!p.auto`) para o Claude Haiku 5.5 (mesma chave `mk_claude_key`/`configuracoes.claude_api_key` e mesma chamada do Colar do WhatsApp). O schema da resposta (`iaSchema`) só permite categorias, contas, itens pendentes e recebimentos que existem; `iaAplicar` valida de novo (sinal da linha, `ignorar` só com confiança alta, não sobrescreve linha que a Carol já mexeu). Marca `auto: "ia"` ("pela IA", motivo no i). Nada é gravado até aplicar; o confirmado vira regra (`_aprender`), então a IA é chamada cada vez menos. Sem chave ou com erro, a revisão segue só com as regras.
33. **Semanada paga as despesas variáveis** (Carol, 2026-11-19): toda saída de categoria do grupo Variáveis (PF; Deslocamento/Alimentação trabalho na PJ) sai da semanada, inclusive gasto pessoal pago pela conta PJ (a dedução automática de caixinha vale para `pagoPelaPJ` também). Não é caixinha de guardar: o que sobrar ela guarda. O i de cada caixinha lista as categorias que saem dela (`infoCaixinha`).

34. **Quadro do mês** (`FX.quadroMes`, Carol 2026-11-19; Plano e "Dinheiro agora" do Hoje usam os mesmos números): `necessidades` = o que ainda sai da conta (itens que consomem a conta, sem aporte opcional; caixinha de contas = contas pendentes − saldo dela, ou sem contas no plano: planejado − usado; semanada = semanas que faltam − saldo; PJ: saídas Previsto do Financeiro). `resumo.compromissos` vem da mesma função. `entradasPrevistas` = PF: pró-labore/receitas que faltam; PJ: clientes Previsto (até 31 dias de atraso). Atrasado conta como hoje. `linhaDoTempo` ordena por data (entra antes de sai; mesmo dia: vencimento, depois conta > pró-labore > caixinha > semanada). **Livre** = menor saldo do mês (≥ 0, nunca acima do que está na conta); comprometido = na conta − livre. **Pró-labore** (`ponteProlabore`): dinheiro da PJ repartido nessa ordem — `podeHoje` (só a conta) e `podeNoMes` (+ clientes previstos); a PF só conta como entrada o pró-labore que a PJ consegue pagar (`proSemDinheiro` aparece à parte).

## Auth

Hub (`mk_session`) libera o módulo e a PJ. **PF:** usuário com `nivel = admin` no Hub
(a Carol) entra direto; demais usuários precisam do login pessoal antigo
(`mk_session_pessoal`, RPC `autenticar_pessoal`). "Sair do pessoal" grava
`mk_fluxo_pf_bloqueado` para esconder a PF naquele aparelho. Com PF bloqueada,
`stMovs()` não inclui nada da PF.

Modal não fecha ao tocar fora (só Cancelar/Fechar ou Esc) — toda folha precisa ter botão de fechar.
35. **Editar gasto** (`formMov`): campo Categoria grava no próprio registro (`AC.classificar` → `saidas_pessoal.categoria` / `saidas.tipo`; gasto pessoal da PJ fica 'Pessoal'). Escolher a categoria ajusta a caixinha; escolher a caixinha traz as categorias dela primeiro (`optCategoriasDaCaixinha`). Na revisão do extrato, a conta do plano ligada aparece ("paga a conta X · não é essa"), e trocar a categoria desliga a conta de outro assunto.
36. **Resgate só quando ela diz que resgatou** (Carol, 2026-11-19): `registrarGasto` só cria resgate com `resgatar === true` (nunca por padrão), e no máximo o saldo da caixinha. O "+ Gasto" não tem opção de resgate (o gasto só conta no orçamento da caixinha; resgate real vem do extrato ou de Caixinhas › Tirar dinheiro). No "Pagar" do item, "Tirei da caixinha X" aparece desmarcado e só se a caixinha tem saldo.
37. **Caixinha = orçamento** (Carol, 2026-11-19): o gasto pertence à caixinha pela categoria/conta do plano, saia dela ou direto da conta. `FX.automatizar` separa `valorDaCaixinha` (pago da caixinha ou com resgate ligado) e `valorDireto`. **Contas/semanada:** pagar direto da conta não deixa nada devendo para a caixinha (Pago = de qualquer jeito). **Juntar** (modo guardar: sazonais, cursos, reposição…): **destinado** = guardado na caixinha + gasto direto da conta nas categorias dela; o gasto direto abate o aporte do mês (`itensDoMes` → `_direto`, na ordem das datas) e o "falta juntar" do ano (`anoCaixinha.destinado`). "Na caixinha" = só o dinheiro separado de verdade (opcional).
38. **Conta com data numa caixinha de juntar** (ex.: Consultoria financeira na Sazonais — Carol, 2026-11-19): é obrigatória. Em `necessidades` vira saída própria `obrigatoria` (menos o que já está na caixinha; aparece mesmo coberta, com valor 0 na conta) e o aporte da caixinha fica só com o resto (`semContas`, "se sobrar") — nunca soma as duas. No card: "A pagar" em destaque + botão Pagar primeiro.
39. **Pró-labore: parcela anterior encerra** (Carol, 2026-11-19): quando chega a data da parcela seguinte do mês, a anterior pendente vira `encerrado` (`itensDoMes`): fecha com o que foi pago, `_faltou` fica anotado ("encerrada · faltou R$ X"), sai das pendências/linha do tempo/entradas da PF, e a ponte separa `faltou` de `falta`. Pró-labore registrado depois conta na parcela atual (`_itemProlabore` olha a partir da data do Pix: Pix de 10/11 ainda é da 1ª). Nada é excluído; outros meses não mudam.
40. **Categorias = uma lista só com o Financeiro** (Carol, 2026-11-19): `shared/js/categorias.js` (`window.CATEGORIAS`, cache `mk_categorias`) publica `cfg.categorias` (PJ/PF) do Meu dinheiro; o Financeiro usa no "Tipo de despesa" (agrupado, `optTiposDespesa`) e, na saída **Pessoal**, pede a categoria PF e grava no gasto espelhado `sync_<id>` (`gravarCategoriaPF`). Config v7 traz Equipe, Assistente, Modelos (grupo Atendimento) e Marketing para a PJ (sem caixinha). Criar/editar categoria = Meu dinheiro › Ajustes › Categorias.
41. **Navegação Financeiro ↔ Meu dinheiro:** chave `.mod-sw` (Financeiro | Meu dinheiro) logo abaixo do cabeçalho nos dois módulos.
