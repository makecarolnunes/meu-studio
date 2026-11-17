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
ui.js · telas.js · forms.js · main.js
```

Testes: `node fluxo/tests/cenarios.js` (Supabase falso em memória + smoke da UI).
**Rodar sempre depois de mexer em core/store/acoes/telas/forms.**

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
4. **Pagamento com reserva:** saída na corrente + resgate automático caixinha → corrente (`vinculoId`). Gasto direto da caixinha: conta = caixinha, sem resgate.
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

## Auth

Hub (`mk_session`) libera o módulo e a PJ. PF exige o login pessoal antigo
(`mk_session_pessoal`, RPC `autenticar_pessoal`) — `ST.pfLiberado`.
Com PF bloqueada, `stMovs()` não inclui nada da PF.
