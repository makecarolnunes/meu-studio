# Diagnóstico — reestruturação do financeiro PF + PJ

Base: `Planejamento Financeiro_Carol Nunes.xlsx` (9 abas) × sistema Meu Studio em 16/11/2026.

---

## 1. O que existia no sistema

| Parte | Situação encontrada | O que foi feito |
|---|---|---|
| **Financeiro PJ** (`/financeiro/`) | Funcionando: `entries` (Previsto/Realizado), `saidas` (Pago/Previsto, natureza PROFISSIONAL/PESSOAL/MISTA, competência do cartão), `noivas`, import OFX, Fiscal. | **Preservado.** Só ganhou: etiqueta "Pró-labore" e um atalho para o fluxo no cabeçalho. Nenhuma tabela ou coluna alterada. |
| **Orçamentos → Financeiro** | Fechar orçamento cria Sinal + Restante (`auto`) em `entries`; equipe = uma entrada só com o lucro. | **Preservado.** O fluxo lê essas entradas: Previsto = a receber, Realizado = recebido. |
| **Financeiro Pessoal** (`/pessoal/`, jun/2026) | Código e tabelas intactos (`entradas_pessoal`, `saidas_pessoal`, login próprio `usuarios_pessoal`), mas **escondido de todos os menus** (acesso só por URL). | **Recuperado** dentro do novo módulo `/fluxo/` — mesmas tabelas, mesmo login. `/pessoal/` redireciona. Parser de extrato reaproveitado. |
| **Ponte PJ → PF** | Trigger `sync_saida_pessoal`: saída PJ "Pessoal + Transferência para mim" vira entrada PF. | **Reaproveitada para o pró-labore.** Trigger só passou a marcar a categoria "Pró-labore". |
| Contas, caixinhas, planejamento, conciliação, dívidas, cartão como passivo | Não existiam. | Novas tabelas `fin_*` (`sql/fluxo-financeiro.sql`). |
| Integração bancária automática | **Não existe** (nem API de banco). | Importação de extrato OFX/CSV + conciliação manual. |

---

## 2. Diferenças entre as abas (não tratadas como metas automaticamente)

| # | Onde | Diferença | Decisão no sistema |
|---|---|---|---|
| 1 | Acompanhamento × Tabulação de Dívidas | O plano só reserva **R$ 361** (Pole Dance). A Tabulação tem parcelas (fatura PF 855,40 · fatura PJ 1.928,17 · Nubank 980,93 · Itaú 458,04) + faturas atuais PF 6.210,56 / PJ 5.291,88 + Guilherme 2.000 — **nenhuma no plano**. | **Decisão (16/11):** ficam fora do plano por enquanto, no módulo **Dívidas** (saldo, histórico, simulador e botão “Incluir no plano”). Não aparecem como pendência do mês. |
| 1b | Tabulação de Dívidas, célula K11 | Total de parcelas mostra **R$ 3.367,14**, mas a célula K4 (fatura PF) está digitada como **texto** (“R$ 855,40”) e o `SUM` a ignora. Total real: **R$ 4.222,54/mês**. G4 também está como texto. | O módulo Dívidas soma o valor certo. |
| 2 | Acompanhamento × sua instrução | 2º pró-labore está na **Semana 3 (16–22)** na planilha; você definiu **dia 15**, que pela regra das semanas é **Semana 2 (09–15)**. | Pró-labore no dia 15. Faxineira, Sazonais e Dívida também no 15 (Pole Dance vence dia 15); Semanada S3 e itens PJ da semana 3 no dia 16. |
| 3 | Acompanhamento PJ, célula P28 | Fórmula `=P18-P20` **soma** R$ 250 em vez de subtrair: mostra −6.619, o correto é **−7.119**. | Corrigido no cálculo (o sistema soma os itens; não copia a fórmula). |
| 4 | Acompanhamento PJ × Raio-X PJ | Saídas planejadas da PJ = **R$ 7.119/mês**; entrada média do Raio-X = **R$ 7.120,25**. Margem ≈ 0 — qualquer mês abaixo da média não fecha. | O fluxo mostra "Ainda a distribuir × saldo em conta" e permite **reprogramar**. Distribuições PJ seguem a ordem das datas conforme os recebimentos entram. |
| 5 | Fotografia × Acompanhamento | Variáveis: **R$ 1.500/mês** (375/semana) na Fotografia × **4 × R$ 350 = R$ 1.400** nas semanadas. | Usada a semanada de 350 (plano atual). A Análise de semanadas mostra se está suficiente. |
| 6 | Fotografia × Acompanhamento | Faxineira com vencimento **"1 e 15"**; plano tem um aporte único de R$ 250 na semana 3. | Um pagamento de 250 no dia 15. Se forem 2 × 125 (dias 1 e 15), ajuste o modelo. |
| 7 | Fotografia (Sazonais) | R$ 1.245,83/mês = 14.950/ano **incluindo Consultoria financeira R$ 1.750**. | **Confirmado (16/11):** consultoria é sazonal — **5 parcelas de R$ 350** pagas pela caixinha Sazonais (item com vigência de 5 meses a partir do 1º mês do fluxo, mostrado como “1/5 … 5/5”). Se alguma parcela já foi paga, recue o “Vale a partir de” do item no modelo. |
| 8 | Raio-X PJ × Acompanhamento | "Curso" R$ 97 (mensalidade) e "Caixinha cursos" R$ 541 = aperfeiçoamento 125 (1.500/ano) + investimentos 416,67 (5.000/ano). | **Sem duplicar:** R$ 97 = pagamento direto mensal (categoria Cursos); R$ 541 = **uma** caixinha "Cursos e investimentos" (categorias Cursos e Equipamentos). |
| 9 | Raio-X PJ | "Cartão (assinaturas)" R$ 245 = Canva 24,17 (290/ano) + Claude/ChatGPT 221. | Caixinha "Assinaturas no cartão" (finalidade cartão): a reserva é descontada da fatura em aberto no cálculo do disponível. |
| 10 | Acompanhamento | Saldo inicial da conta = 0 e saldos finais (405, 55, 604, 254) são **projeções**, não saldo bancário. Rótulo "(200)" = sobra do 2º pró-labore (2.755 − 2.556 = 199). | **Nenhum saldo criado.** Saldo só existe depois que você informa o saldo real (conciliação). Os testes reproduzem 405 / 55 / 604 / 254 a partir de saldo 0. |
| 11 | Tabulação de Dívidas | Itaú: J = 24 parcelas, mas total em aberto usa 23 (`=23*K7`). Fatura PJ: custo total usa 10 parcelas (`=K5*10`), J = 7. | Registrado nas observações de cada dívida. |
| 12 | Fotografia (Pole Dance) | Coluna C = 46357 é data do Excel = **dez/2026** (última parcela). | Aporte e parcela do Pole Dance têm vigência até **dez/2026**: a partir de jan/2027 saem do plano sozinhos (sobra +R$ 361 no 2º pró-labore). |
| 13 | Estruturação × Nova Estruturação | Nubank/Itaú em desativação, mas com empréstimos e faturas ativas. | Cadastradas como contas "antigas" (fora dos saldos do dia a dia, mas disponíveis para pagamentos de dívida e conciliação). |

---

## 3. Mapeamento de categorias

**PF (Fotografia início consultoria)**

| Planilha | Sistema | Caixinha |
|---|---|---|
| Luz, Gás, Academia e Jiu, Assinaturas, Médico, Telefone | mesmas categorias (grupo Fixas) — cada uma é um **item de pagamento** com vencimento | Despesas fixas (aporte 1.245 no dia 01) |
| Faxineira | Faxineira | Faxineira |
| Gatos, Mercado, Delivery, Transporte, Medicamentos | grupo Variáveis (+ "Alimentação") | Semanada |
| Roupas, Cosméticos, Presentes, Despesas da casa, Procedimento estético, Consultoria, Viagem | grupo Sazonais, com **orçamento anual** | Sazonais |
| Dívida (Pole Dance) | Dívidas | Dívidas |
| Categorias do Pessoal antigo (Moradia, Saúde, Lazer, …) | mantidas (grupo Outras) — dados antigos continuam válidos | — |

**PJ (RAIO X - PJ)** — reaproveita os tipos que o Financeiro já usa (`SAIDA_TIPOS_PROF`):

| Planilha | Tipo de saída no Financeiro | Caixinha |
|---|---|---|
| Deslocamento (600) | Deslocamento | Semanada |
| Alimentação (400) | Alimentação trabalho | Semanada |
| Reposição (400) | Reposição/Investimento de material | Reposição |
| Curso (97) | Cursos | — (pagamento direto) |
| Curso e aperfeiçoamento (125) + Investimentos (416,67) | Cursos / Equipamentos | Cursos e investimentos |
| Canva + Claude/ChatGPT | Assinaturas | Assinaturas no cartão |
| Guia MEI (81) | DAS | MEI |
| Pró-labore (2.000 + 2.755) | Pró-labore (natureza Pessoal) | — (sai da conta PJ, entra na PF) |

---

## 4. Fluxo implementado

```
PLANO (previsto)                       MOVIMENTAÇÕES (realizado)
fin_planos / fin_plano_itens           entries · saidas · entradas_pessoal · saidas_pessoal
  mês = cópia do modelo                fin_transferencias (aporte/resgate/fatura/ajuste)
  item: dia, valor, caixinha     ◄──── ligadas ao item por fin_mov_meta.plano_item_id
                                       (ou plano_item_id da transferência)
status do item = soma das movimentações ligadas (feito / parcial / atrasado / previsto)
```

- **Transferência ≠ despesa.** Aporte, resgate e pagamento de fatura só mudam saldo de conta.
- **Cartão:** compra = despesa na data da compra (conta = cartão); fatura = transferência → não duplica.
- **Pagar com dinheiro reservado:** a despesa sai da conta corrente e o sistema registra o resgate da caixinha (como no app do Inter).
- **Pró-labore:** saída PJ (`tipo = Pró-labore`, natureza Pessoal) + entrada PF `sync_<id>` — o mesmo id do trigger, então nunca duplica.
- **Cliente:** recebimento previsto que aparece no extrato é **confirmado**, não recriado.
- **Saldo:** saldo real informado na conciliação + movimentos posteriores. Diferença pode virar **ajuste explícito** (não conta como receita/despesa).
- **Histórico:** mês criado é cópia; mês fechado bloqueia edição; item com movimentação não pode ser excluído (só dispensado ou reprogramado); toda gravação vai para `fin_log`.

## 5. Validação

`node fluxo/tests/cenarios.js` — 135 verificações com os valores da planilha (Supabase simulado em memória, incluindo o trigger PJ→PF):

1. Pró-labore dia 01 → PF 2.000; aportes semanada + fixas → conta **405** (planilha D15) → semana 2 **55** (H15).
2. Pró-labore dia 15 → conta **604** (D28) → **254** no fim do mês (H28); sobra do 2º recebimento **199**.
3. Semanada PF 350: Mercado 120 + Delivery 80 + Transporte 60 → saldo 90, por categoria.
4. Semanada PJ 250: deslocamento 97 + alimentação 38 → saldo 115, 2 atendimentos, R$ 67,50/atendimento.
5. Restante de cliente previsto + extrato → vira Realizado, nenhuma receita nova, reimportar = duplicada.
6. Aporte de 100 em Sazonais → gastos inalterados.
7. Luz paga com a caixinha Despesas fixas: previsto 250, pago 262,40, diferença +12,40, conta corrente intacta.
8. Janeiro com semanada 300 → dezembro continua 350 e “feito”; saldos de caixinha passam de mês; mês fechado bloqueia edição.
9. Compra de 300 no cartão + pagamento da fatura → gasto contado uma vez, fatura zerada.
10. Saldo do banco 15,50 abaixo → diferença detectada; ajuste iguala sem virar gasto.

## 6. Automação (o que acontece sem você digitar)

| O quê | Como |
|---|---|
| Plano do mês | Criado sozinho ao abrir o app (mês atual; o seguinte a partir do dia 20), a partir do modelo, respeitando vigências e parcelas. |
| Fechar meses antigos | Meses com 2+ meses de idade são fechados sozinhos (só consulta). Reabrir à mão impede de fechar de novo. |
| Ligar ao plano | Todo lançamento — do fluxo, do Financeiro, dos Orçamentos ou do extrato — que bate com um item pendente do mês (mesma categoria, mesma caixinha, pró-labore, aporte na caixinha) é ligado ao item. Ex.: DAS lançado no Financeiro → item “DAS MEI” feito. |
| Caixinha pelo gasto | Categoria → caixinha (Variáveis → Semanada, Fixas → Despesas fixas, Sazonais → Sazonais, Deslocamento/Alimentação trabalho → Semanada PJ…). Configurável em `caixinhaPorGrupo`. |
| Resgate | Gasto da corrente bancado por caixinha registra o resgate sozinho. |
| Aportes | “Fiz os aportes como planejado”: um toque registra todos os aportes vencidos pelos valores do plano. |
| Extrato | Casa com o que já existe; o resto vem preenchido: item do plano com o mesmo valor (pró-labore cria saída PJ + entrada PF), caixinha/fatura pela descrição, categoria por palavras (Enel → Luz, iFood → Delivery, Uber → Transporte/Deslocamento…) e **regras aprendidas** com as suas decisões anteriores. |
| Dívidas | Parcelas restantes e término estimados pelos pagamentos; pagamento com categoria Dívidas cai na parcela do plano. |

O que **continua dependendo de você** (não dá para deduzir sem inventar): saldo real das contas, o valor real de cada conta paga, confirmar que fez as transferências, e decisões (reprogramar, dispensar, incluir dívida). Não há API bancária: o extrato OFX do Inter é a fonte automática.

## 7. Dependências / pendências

1. **Rodar `sql/fluxo-financeiro.sql`** no Supabase (SQL Editor). Sem isso o módulo mostra o aviso e não grava.
2. **Informar o saldo real** de cada conta/caixinha (Caixinhas › Conciliar) — o sistema não presume saldos.
3. Atualizar o “valor para quitação” de cada dívida quando tiver o número do banco (módulo Dívidas › Atualizar saldo).
4. Confirmar faxineira (1 × 250 ou 2 × 125) e se as 5 parcelas da consultoria começam no 1º mês do fluxo.
5. Não há API bancária: atualização real = extrato OFX/CSV (Inter exporta OFX).
