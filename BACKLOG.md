# Backlog · Meu Studio

> Última revisão: 2026-06-10 (Validador; consolidação dos roadmaps; + descrições em linguagem simples e novas sugestões 🆕 no pool por módulo)
> Fonte da verdade do que está pendente, em ordem de prioridade.
> Atualize ao concluir um item, mover prioridade ou adicionar novo escopo.

---

## ✅ Concluído (referência)

### Módulo Fiscal / MEI
- [x] **Sprint 1** · Fundação: tabelas Supabase + painel teto MEI + CRUD config
- [x] **Sprint 1.5** · Refinamentos: badge Profissional, ícones por categoria, filtros
- [x] **Sprint 2** · DAS + despesas manuais + import OFX/CSV
- [x] **Sprint 3** · Pipeline categorização IA (Haiku) + regras aprendidas + receitas em lote + dedup OFX
- [x] **Sprint 4 fase 1** · Resumo anual + Documentos (upload/list/delete) + Browser print
- [x] **Sprint 4 fase 2** · Checklist IR (7 itens canônicos, 3 estados, nota opcional)

### Design System
- [x] **Onda 1** · Botão "+ Novo" removido do header; tela inicial = Resumo; abas reordenadas
- [x] **Onda 2** · Entradas ↔ Saídas unificados (CTAs, filtros, hero desktop)
- [x] **Onda 3** · Resumo adota `.ftab` (filter pill único do sistema)
- [x] **Onda 4** · Noivas componentizado em CSS + tokens locais; modais limpos
- [x] **Onda 6** · Fiscal alinhado visualmente (gradient header, shadow cards, pills 1.5px, inputs padronizados)

### Bugs corrigidos
- [x] Race condition `delete + save` no Supabase (entradas sumiam após edição)
- [x] `_pick` global vazando entre modais (tipo errado em 2ª parcela de noiva)

### Limpezas
- [x] Módulo `confirmacao/` (Agendamentos) deletado — não estava em uso. Refs removidas de hub.js, sidebar.js, CLAUDE.md.

### Quick wins entregues (2026-05-29)
- [x] **6.H.1** · Soft delete + undo (entries + saidas não-grupo) — toast com botão Desfazer 5s
- [x] **6.E.4** · Salário-equivalente CLT no card Resultado do Resumo
- [x] **6.E.1** · Simulador teto MEI no Painel Fiscal (ritmo atual + ponderada 3 meses)
- [x] **6.E.2** · Meta mensal personalizável no Resumo (barra de progresso + cores semânticas)
- [x] **6.G.1** · WhatsApp em Clientes (tabela `cliente_contatos` + botão verde nos cards)
- [x] **6.G.2** · PIX QR Code (config em Financeiro + botão em entradas Previsto + BR Code EMV padrão BACEN)
- [x] **6.A.4** · Notas rápidas (widget no Resumo, reaproveita anotacoes/ via caderno auto-criado)
- [x] **6.A.3** · Busca global no Financeiro (tecla `/` ou botão lupa no header)
- [x] **6.C.2** · Dashboard de conversão em Orçamentos (mês atual vs anterior vs últimos 3m vs ano + delta)

### Sistema de Alertas Inteligentes (2026-05-30)
- [x] **Fase 1** · Motor de regras extensível + sino global + central priorizada (🔴/🟠/🔵) + persistência cross-device (`alertas_estado`). 7 regras: evento passado, orçamento parado, entrada vencida, DAS, teto MEI, tarefa atrasada, cliente fechada sem sinal.
- [x] **Fase 2** · +3 regras (fluxo do período, projeção teto MEI, faturamento abaixo da média) + alerta de agenda "dia cheio". Regra "despesa atípica" adiada (ruído contra dados reais).

### Conteúdo
- [x] Sincronização de categorias/plataformas personalizadas no Supabase (ideias já sincronizavam)

### Instagram · Validador de Post (2026-06-10)
- [x] **Reavaliar conteúdo** · reanálise iterativa mantendo o contexto da versão anterior · bloco `reavaliacao` (corrigidos / pendentes / novos problemas) + régua de progressão de score
- [x] **Chat de aprofundamento** · conversa acoplada a cada análise (questionar feedback, aprofundar, testar abordagens) sem perder histórico · `callClaudeChat` (texto livre)
- [x] Persistência: campos `revisions`/`chat` na validação · sync Supabase com upsert resiliente (`supabase-instagram-reavaliacao-chat.sql`) · refator `claudeRequest` (multi-turno + system)

---

## 🟢 P1 · Quick wins (esforço baixo, valor alto)

Polimentos que ficaram fora da Sprint 4 pra entregar MVP. Cada um tem retorno imediato.

### 1.1 · Auto-check do checklist
Marcar itens automaticamente quando a evidência existir:
- "Baixar e anexar DASN-SIMEI" → conclui quando houver doc tipo `DASN_SIMEI` do ano
- "Recibos de cursos e equipamentos" → em progresso com 1+ `RECIBO`, concluído com 3+
- "Comprovantes de bens" → em progresso com `OUTRO` valor > R$ 5.000

**Esforço**: ~30 min · **Arquivo**: `fiscal-ir.js:_fsIrChecklistItems()`

### 1.2 · Atalhos do checklist
Cada item linka pra ação:
- "Categorizar transações pendentes" → botão "Ir para Despesas" abre aba com filtro PENDENTE
- "Baixar e anexar DASN-SIMEI" → botão "Anexar agora" abre modal upload com tipo DASN pré-selecionado

**Esforço**: ~20 min · **Arquivo**: `fiscal-ir.js`

### 1.3 · Indicador "saúde" no Resumo IR
Cor semântica no card conforme `lucro_tributável`:
- 0 → verde (dentro dos 32%)
- > 0 → amarelo (vai pagar IR como PF)
- > 25% da receita → vermelho (rever despesas / considerar Simples)

**Esforço**: ~15 min · **Arquivo**: `fiscal-ir.js` + `fiscal.css`

### 1.4 · Card "Prazo IR" no Painel
Cartão no painel MEI que aparece em Jan–Abr com "Prazo IR se aproxima · faltam X dias" e link direto pra aba IR.

**Esforço**: ~30 min · **Arquivo**: `fiscal-mei.js`

---

## 🟢 P1 · Tech debt urgente

### 2.1 · Onda 5 · Refactor modais (`_pick` extraído)
Helper `openFormModal({title, fields, onSave})` substitui ~200 linhas duplicadas em 5 modais (`openEditEntry`, `openEditSaida`, `openAddNoiva`, `openNoivaPgto`, `openEditNoivaContrato`).

**Por que P1**: antes de criar modais novos pra Sprint 4 polishing (ex: "Marcar como pessoal" no atalho do checklist), refatorar evita escrever código que vai ser jogado fora.

**Esforço**: ~3h · **Risco**: médio (forms são onde mais escorrega).

**Quando NÃO fazer**: se não pretende adicionar modais novos tão cedo.

### 2.2 · `checkAuth()` no boot do Conteúdo
O módulo `conteudo/` carrega **sem guard de login** (diferente dos outros módulos). Qualquer um com a URL vê o planejamento. Adicionar `checkAuth()` no boot, igual ao Financeiro/Instagram.

**Por que P1**: gap de consistência/segurança, e é barato. **Esforço**: ~15min · **Arquivo**: `conteudo/scripts/conteudo.js` (boot).

---

## 🟡 P2 · Funcionalidades novas (Fiscal)

### 3.1 · Sprint 5 · Integração Pluggy (Open Finance)
Sync automático com bancos via Pluggy. Carol conecta Nubank/Inter uma vez e transações chegam sozinhas.

**Arquitetura**:
- Edge Function Supabase `pluggy-sync` (credencial só lá)
- Widget Pluggy Connect no front
- Cron diário (Supabase Cron) puxa novas transações pra `fiscal_transacoes_raw`
- Pipeline categorização IA roda automático

**Esforço**: ~2 semanas · **Custo**: ~R$ 3–5/mês (Pluggy cobra por conta) · **Pré-requisito**: criar conta Pluggy.

**Por que P2**: import OFX já funciona. Pluggy só elimina o passo manual.

### 3.2 · Sprint 6 · Multi-regime (Simples Nacional + Autônomo)
Generalizar painel teto MEI pra outros regimes:
- Simples Nacional: DAS varia por anexo (I, II, III...), teto R$ 4,8 mi
- Autônomo: carnê-leão mensal, IRPF mensal

**Esforço**: ~2 semanas · **Por que talvez P3**: só faz sentido se Carol mudar de regime.

### 3.3 · Sprint 4 cleanup · Funcionalidades menores
- **Recibo OCR**: foto recibo → Claude Vision extrai data/valor/categoria → preenche despesa. Esforço médio (~3h), ~$0.10 por recibo.
- **Detector de recorrência**: 3 ocorrências mesmo padrão → sugere despesa fixa. Esforço baixo (~1h).
- **Alertas inteligentes**: "Você gastou 40% a mais em deslocamento esse mês". Esforço baixo (~1h).

---

## 🟡 P2 · Design System (outros módulos)

### 4.1 · Onda 7 · Refactor visual de outros módulos
Não inspecionados nesta rodada. Cada um tem CSS próprio.

| Módulo | Path | Provável escopo |
|---|---|---|
| **Clientes** | `clientes/` | CTAs, listas, filtros — aplicar `.ftab`, `.add-btn--*` |
| **Orçamentos** | `orcamentos/` | Tem upload de comprovantes. Padronizar UI |
| **Confirmação** | `confirmacao/` | HTML estático com agendamentos |
| **Conteúdo** | `conteudo/` | Brand-brain, centro-de-marca, concorrentes, direcao-criativa |

**Esforço**: ~1–2h por módulo · **Por que P2**: Financeiro/Fiscal são uso diário; outros menos.

---

## 🔵 P3 · Polishing / nice-to-have

### 5.1 · PWA + push notifications
Instalável como app no celular + notificação de DAS vencendo dia 18.

**Esforço**: ~4h · **Por que P3**: e-mail/calendário já resolve.

### 5.2 · Métricas avançadas
- Ticket médio por serviço
- Custo por atendimento
- Lucro líquido por noiva
- Comparativo ano a ano

**Esforço**: ~3h

### 5.3 · Performance / paginação
Paginação se passar de 5.000 registros. Hoje ~290. Vale fazer quando ultrapassar 2.000.

### 5.4 · Testes
Setup Vitest/Playwright cobrindo fluxos críticos (Noiva, Import OFX, Save Entry).

**Esforço**: ~1 semana setup razoável · **Por que P3**: usuária única, mas valeria pra dormir tranquila.

### 5.5 · Modularização JS / build step (roadmap raiz)
Hoje é vanilla sem bundler. Arquivos grandes (`instagram.js` ~4k linhas, `conteudo.js` ~1.5k). Avaliar split em ES modules ou um build mínimo. **Por que P3**: funciona bem assim; só vale quando a manutenção pesar.

### 5.6 · Publicação direta no Instagram (roadmap Conteúdo)
Integrar com a Instagram Graph API pra publicar/agendar direto do módulo Conteúdo (hoje só planeja). **Grande** · depende de permissões de publishing da API · **Por que P3**: alto esforço/risco vs. ganho.

---

## 🟢 P1 · Sugestões pequenas por módulo

Pool de melhorias pequenas (esforço ≤ 3h cada). Cada item tem uma descrição em linguagem simples (**o que é** + **pra que serve no dia a dia**). 🆕 = sugestão nova. **Marque com `[x]` o que quer fazer próximo** — eu implemento na sequência marcada.

---

### 6.A · Velocidade e atalhos (cross-cutting)

- [ ] **6.A.1 · Duplicar lançamento** (✨ sua ideia) — botão "Duplicar" no modal de editar: clona o lançamento pra você só ajustar o que mudou, em vez de digitar tudo de novo. Bom pra serviços que se repetem. ~30min
- [ ] **6.A.2 · Lançar de novo neste mês** (✨ sua ideia) — botãozinho em cada item da lista que copia o lançamento já com a data de hoje. Ex.: cliente fixa voltou → 1 toque relança. ~45min
- [x] **6.A.3** · ✅ Busca global (`/` ou lupa, busca em entradas/saídas/noivas)
- [x] **6.A.4** · ✅ Notas rápidas (widget no Resumo)
- [ ] **6.A.5 · Atalhos de teclado** — no computador: `/` abre busca, `N` nova entrada, `S` nova saída, `Esc` fecha o modal. Acelera quando você lança em lote no desktop. ~30min
- [ ] **6.A.6 · Templates de saída fixa** — salva as despesas que se repetem ("DAS de novembro", "Equipe Julia · sábado") e 1 clique preenche valor, tipo e categoria. Acaba com a redigitação das contas do mês. ~1h
- [ ] **6.A.7 · Menu rápido ao segurar o item** — segurar o dedo num item da lista abre um mini-menu (duplicar / relançar no mês / fixar), sem precisar abrir o modal inteiro. ~1h
- [ ] **6.A.8 · Repetir último PIX** — ao abrir nova entrada, ela já sugere o valor + cliente do último atendimento igual. Pra cliente recorrente vira quase 1 toque. ~45min
- [ ] 🆕 **6.A.9 · Botão "Hoje" nos campos de data** — um toque em "Hoje" preenche a data atual, em vez de rolar o calendário. Tira uma fricção que acontece em todo lançamento. ~20min
- [ ] 🆕 **6.A.10 · Lembrar o último serviço usado** — a nova entrada já vem com o serviço que você mais lança pré-selecionado. Menos toques no caso mais comum. ~30min

### 6.B · Clientes (módulo somente-leitura hoje)

- [x] **6.B.1 / 6.B.2 / 6.B.9** · ✅ Feitos — lê do Financeiro, com login, e painel de Follow-up (WhatsApp + templates + histórico).
- [ ] **6.B.3 · Busca por nome** — caixa no topo que filtra a lista enquanto você digita. Acha a cliente sem rolar tudo. ~30min
- [ ] **6.B.4 · Tela de detalhe da cliente** — toca no nome e vê o histórico dela: quantos atendimentos, quanto já gastou no total, quando foi a última vez e o ticket médio. Atende sabendo o valor de cada uma. ~2h
- [ ] **6.B.5 · Top clientes do ano** — ranking de quem mais te procura e de quem mais gasta. Bom pra mimar as melhores e pensar em fidelização. ~1h
- [ ] **6.B.6 · Cliente sumida há X meses** — aviso no painel ("Ana não agenda há 4 meses") pra você mandar um oi e reativar. ~1h
- [ ] **6.B.7 · Anotações por cliente** — campo livre pra preferências (cor de batom, alérgica a X, gosta de chá, pele oleosa). Atendimento mais pessoal sem depender da memória. ~1h30
- [ ] **6.B.8 · Tags por cliente** — etiquetas (VIP, social, casamento, formatura) com filtro. Ex.: ver só as noivas, ou só as VIP. ~1h30
- [ ] **6.B.10 · Follow-up vira tarefa** — ao registrar um atendimento, oferece criar uma tarefa de retorno ("Chamar Ana em 30 dias"). Não deixa a cliente esfriar. ~1h30
- [ ] 🆕 **6.B.11 · Fixar/favoritar cliente** — prende as principais no topo da lista (estrelinha). As que você mais atende ficam sempre à mão. ~45min
- [ ] 🆕 **6.B.12 · Avatar com iniciais** — quem não tem foto ganha um círculo colorido com as iniciais, em vez de ícone genérico. Lista mais fácil de bater o olho. ~45min

### 6.C · Orçamentos

- [x] **6.C.1 / 6.C.2 / 6.C.6** · ✅ Feitos — trava de duplo-clique no fechamento, dashboard de conversão, alerta de orçamento parado.
- [ ] **6.C.3 · Filtro por serviço** — separar orçamentos por maquiagem, cabelo, noiva. Vê de onde vem mais pedido. ~30min
- [ ] **6.C.4 · Campo "como conheceu"** — Instagram, indicação, Google... Com o tempo mostra qual canal traz mais cliente (e onde vale investir). ~1h
- [ ] **6.C.5 · Tempo médio de resposta** — quanto tempo entre criar o orçamento e fechar (ou perder). Responder rápido fecha mais; isso te dá o número. ~45min
- [ ] **6.C.7 · Reapresentar orçamento** — botão "reenviar com novo valor" reaproveita o orçamento antigo e gera um novo. Pra quando a cliente volta meses depois. ~1h
- [ ] **6.C.8 · Histórico de preço por cliente** — na hora de orçar de novo, mostra "Maria pagou R$ 350 nesse serviço da última vez". Evita cobrar a menos sem querer. ~1h
- [ ] **6.C.9 · Preview do evento no Google Agenda** — antes de criar, mostra exatamente o(s) evento(s) que vão pra agenda (dia, horário início–fim, duração, local) pra você conferir. Evita evento torto que você só descobre depois. ~1h
- [ ] **6.C.10 · Histórico de status** — registra quando o orçamento passou de enviado → fechado/perdido. Linha do tempo de cada negociação. ~1h30
- [ ] **6.C.11 · Follow-up vira tarefa automática** — orçamento com data de retorno cria sozinho uma tarefa pra você não esquecer de cobrar. ~1h
- [ ] 🆕 **6.C.12 · Validade do orçamento** — "válido até DD/MM" no orçamento; depois disso ele marca como vencido. Cria senso de urgência e organiza os antigos. ~1h

### 6.D · Estoque

- [x] **6.D.1** · ✅ Feito — busca por nome/observação.
- [ ] **6.D.2 · Ordenar por status** — a lista mostra primeiro o que zerou, depois acabando, depois ok e wishlist. Bate o olho e já sabe o que comprar. ~30min
- [ ] **6.D.3 · Quantidade + mínimo** — guarda quanto você tem de cada produto e avisa sozinho quando chega no mínimo ("Base MAC acabando"). ~2h
- [ ] **6.D.4 · Lista de compras pro WhatsApp** — botão junta tudo que está zerado/acabando num texto pronto ("1. Base MAC, 2. Pincel…") e copia. Manda pro fornecedor em 1 toque. ~45min · **alto valor**
- [ ] **6.D.5 · Foto do produto** — sobe a foto no card e vê a miniatura na lista. Mais fácil reconhecer na correria. ~2h
- [ ] **6.D.6 · Link de compra** — guarda o link (Amazon, Mercado Livre) no card; 1 toque abre a página pra recomprar. ~20min
- [ ] **6.D.7 · Totais no topo** — "Custo do estoque: R$ X · Comprar tudo da wishlist: R$ Y". Noção de quanto tem parado e quanto falta investir. ~30min
- [ ] **6.D.8 · Última compra + data** — quando foi a última reposição de cada item, pra saber o ritmo de gasto. ~45min
- [ ] **6.D.9 · Categorias personalizáveis** — criar e filtrar por categorias suas (base, pincel, skincare…), igual ao módulo Conteúdo. ~1h30
- [ ] **6.D.10 · Fornecedores/lojas** — cadastro de lojas com link, reaproveitável entre vários produtos (amplia o 6.D.6). ~1h30
- [ ] 🆕 **6.D.11 · "Comprei" → move da wishlist pro estoque** — 1 toque na wishlist passa o item pro estoque (e, se quiser, já lança como saída). Fecha o ciclo desejo → compra. ~1h
- [ ] 🆕 **6.D.12 · Validade dos produtos** — guarda a validade (maquiagem vence!) e avisa o que está perto de vencer. Evita levar produto vencido pra cliente. ~1h30

### 6.E · Insights de dinheiro (Financeiro/Fiscal)

- [x] **6.E.1 / 6.E.2 / 6.E.4** · ✅ Feitos — simulador de teto MEI, meta mensal, salário-CLT equivalente.
- [ ] **6.E.3 · Simulador "e se?"** — "se eu cobrar R$ X esse mês, sobra R$ Y de margem". Brinca com cenários antes de fechar a agenda. ~1h
- [ ] **6.E.5 · Mesmo mês, ano passado** — "Maio 2026 vs Maio 2025: +18%". Mostra se você está crescendo de verdade. ~45min
- [ ] **6.E.6 · Sequência de meses no lucro** — "8 meses seguidos no positivo". Motivacional e mostra consistência. ~45min
- [ ] **6.E.7 · Custo por atendimento** — despesas profissionais ÷ nº de atendimentos = "cada cliente te custa R$ Z". Ajuda a precificar com margem. ~30min
- [ ] 🆕 **6.E.8 · Quanto falta pra meta** — "faltam R$ 1.200 e 9 dias → ~R$ 134/dia". Transforma a meta do mês num ritmo diário fácil de mirar. ~45min
- [ ] 🆕 **6.E.9 · Previsão de fechamento do mês** — projeta onde o mês deve terminar no ritmo atual ("deve fechar ~R$ 7.800"). Antecipa mês fraco a tempo de agir. ~1h

### 6.F · Proatividade / lembretes

- [ ] **6.F.1 · Previstos vencendo essa semana** — selo no painel ("3 a receber · R$ 1.200") pra você cobrar antes de esquecer. ~1h
- [ ] **6.F.2 · Noiva perto do casamento com saldo** — alerta vermelho ("Maria casa em 22d, falta R$ 1.500"). Não chega o dia com pagamento em aberto. ~1h
- [ ] **6.F.3 · Aniversário de clientes/noivas** — lembrete pra mandar uma mensagem no dia (precisa do campo aniversário). Carinho que fideliza. ~1h30
- [ ] **6.F.4 · Cobrança atrasada em vermelho** — entrada prevista com data já passada fica vermelha na lista. O atraso salta aos olhos. ~30min
- [ ] 🆕 **6.F.5 · Resumo da semana (domingo)** — um cartão "essa semana: R$ X em N atendimentos · vem aí: 3 noivas, 2 a receber". Fecha e abre a semana com clareza. ~1h30

### 6.G · Comunicação rápida

- [x] **6.G.1 / 6.G.2** · ✅ Feitos — WhatsApp nos cards de Clientes e PIX QR Code no Financeiro.
- [ ] **6.G.3 · Recibo em PDF** — botão na entrada gera um "Recibo de pagamento" bonitinho pra mandar pra cliente. Profissionaliza e serve de comprovante. ~1h
- [ ] 🆕 **6.G.4 · Mensagem de confirmação pronta** — template "Confirmo seu horário dia X às Y 💄" que você copia e manda. Padroniza a confirmação e economiza digitação. ~45min
- [ ] 🆕 **6.G.5 · Cobrança pelo WhatsApp** — 1 botão monta a mensagem com o valor + sua chave PIX pra enviar pra cliente. Cobrar fica mais rápido e menos constrangedor. ~1h

### 6.H · Confiança / audit

- [x] **6.H.1** · ✅ Feito — desfazer exclusão (toast de 5s).
- [ ] **6.H.2 · Histórico de versões da entrada** — vê o que mudou e quando (registro básico). Tira a dúvida de "será que eu já tinha alterado isso?". ~3h
- [ ] **6.H.3 · Selo de sincronização** — "Sincronizado · 14:32" no topo, pra ter certeza que salvou na nuvem. ~30min
- [ ] **6.H.4 · Backup manual** — botão "Baixar tudo (JSON)" pra guardar uma cópia sua de vez em quando. Paz de espírito. ~30min

### 6.I · Instagram / Validador

- [ ] **6.I.1** · **Chat na aba Insights IA** — levar o mesmo chat de aprofundamento (já feito no Validador) para a Análise Estratégica, pra aprofundar/contestar insights sem refazer a análise. Reaproveita `callClaudeChat` + componente de thread. Esforço: ~1h30
- [ ] **6.I.2** · **Guardar mídia das reavaliações no Storage** — hoje a mídia (carrossel/reel) precisa ser reanexada a cada reavaliação. Persistir no Supabase Storage pra comparar versões com imagem. Esforço: ~2h

### 6.J · Financeiro · lista / resumo / export

> Recuperados do roadmap em `financeiro/CLAUDE.md`.

- [ ] **6.J.1** · **Filtro por serviço/tipo na tela Lista** — filtrar entradas por tipo de serviço. Esforço: ~45min
- [ ] **6.J.2** · **Export CSV do Resumo** — botão "Baixar CSV" pra abrir no Excel/Sheets. Esforço: ~45min
- [ ] **6.J.3** · **Gráfico mensal no Resumo** — linha de faturamento ao longo do ano (Chart.js já usado no Instagram). Esforço: ~1h30
- [ ] **6.J.4** · **Comissão de assistente** — campo `comissao_assistente` em entries pra descontar do bruto e ver líquido real. Esforço: ~1h30
- [ ] 🆕 **6.J.5 · Marcar como recebido com 1 toque** — botãozinho na entrada prevista pra confirmar o recebimento sem abrir o modal. Atualiza o caixa na hora. ~45min

### 6.K · Tarefas

> Recuperados do roadmap em `tarefas/CLAUDE.md`.

- [ ] **6.K.1** · **Tarefas recorrentes** — campo `recorrencia` (diária/semanal/mensal) + geração automática. Esforço: ~2h
- [ ] **6.K.2** · **Categorias/projetos** — agrupar (Studio, Pessoal, Finanças) com filtro. Esforço: ~1h30
- [ ] **6.K.3** · **Subnotes por tarefa** — textarea de notas no painel. Esforço: ~45min
- [ ] **6.K.4** · **Arrastar pra reordenar** — drag-and-drop na lista Pendentes. Esforço: ~1h30
- [ ] **6.K.5** · **Confetti ao concluir** — micro-detalhe de UX ao marcar feita. Esforço: ~30min
- [ ] **6.K.6** · **Push quando o prazo chega** — notificação no celular quando a tarefa vence (depende do PWA, item 5.1). incluído no 5.1
- [ ] 🆕 **6.K.7 · Tarefa rápida pelo Hub** — adicionar uma tarefa direto da tela inicial, sem entrar no módulo. Anota a ideia antes de esquecer. ~45min

### 6.L · Conteúdo (planejamento de posts)

> Recuperados do roadmap em `conteudo/CLAUDE.md`. (Migração p/ Supabase **já feita** — removida da lista.)

- [ ] **6.L.1** · **Campo de caption** — texto da legenda na ideia do post. Esforço: ~45min
- [ ] **6.L.2** · **Exportar agenda do mês como imagem** — render do calendário em canvas pra compartilhar. Esforço: ~2h
- [ ] **6.L.3** · **Notificação D-1 da data agendada** — lembrete na véspera *(depende do 5.1 PWA)*. Esforço: ~1h
- [ ] **6.L.4** · **Drag-and-drop no calendário em iOS** — hoje só funciona no computador; faltam os toques pra arrastar no iPhone. Esforço: ~2h
- [ ] 🆕 **6.L.5 · Banco de ideias rápidas** — joga uma ideia solta (só o título) sem preencher tudo, pra organizar e agendar depois. Não perde insight de conteúdo na correria. ~45min

---

## 📋 Tabela resumida

| # | Item | Prioridade | Esforço | Impacto |
|---|---|---|---|---|
| 1.1 | Auto-check do checklist | 🟢 P1 | 30min | Alto |
| 1.2 | Atalhos do checklist | 🟢 P1 | 20min | Alto |
| 1.3 | Indicador "saúde" no Resumo | 🟢 P1 | 15min | Médio |
| 1.4 | Card "Prazo IR" no painel | 🟢 P1 | 30min | Alto |
| 2.1 | Onda 5: refactor modais | 🟢 P1 | 3h | Médio (técnico) |
| 3.1 | Sprint 5: Pluggy | 🟡 P2 | 2 sem | Alto |
| 3.2 | Sprint 6: Multi-regime | 🟡 P2 | 2 sem | Baixo (só se mudar) |
| 3.3 | Recibo OCR + recorrência + alertas | 🟡 P2 | ~5h total | Médio |
| 4.1 | Onda 7: outros módulos | 🟡 P2 | 1–2h cada | Médio |
| 5.1 | PWA + push | 🔵 P3 | 4h | Baixo |
| 5.2 | Métricas avançadas | 🔵 P3 | 3h | Médio |
| 5.3 | Paginação | 🔵 P3 | depois | — |
| 5.4 | Testes | 🔵 P3 | 1 sem | Médio (qualidade) |

---

## 🎯 Sugestão de ordem

**Curto prazo (próximas 1–2 sessões)** — fechar bem a Sprint 4:
1. **1.1 → 1.2 → 1.3 → 1.4** (todos os quick wins, ~1h30 somados)
2. Testar em produção ~1 semana usando de verdade

**Médio prazo (próximo mês)** — escolher 1:
- **Caminho A · Tech debt**: Onda 5 → base sólida pra novas features
- **Caminho B · Novidade**: Sprint 5 (Pluggy) → tira passo manual do OFX
- **Caminho C · Consistência**: Onda 7 começa por Conteúdo

**Longo prazo (Q3+)**: Sprint 6, métricas avançadas, testes.

**NUNCA fazer agora**: paginação, multi-regime, PWA. Só quando gatilho aparecer (uso massivo ou mudança de regime).

---

## Convenções deste arquivo

- **🟢 P1**: alta prioridade — fazer em breve
- **🟡 P2**: prioridade média — fazer quando der
- **🔵 P3**: nice-to-have — só quando gatilho aparecer
- Marque `[x]` quando concluir
- Mova itens concluídos para a seção "✅ Concluído" no topo
- Atualize "Última revisão" no topo ao mexer no arquivo
