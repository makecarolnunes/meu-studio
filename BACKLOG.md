# Backlog · Meu Studio

> Última revisão: 2026-05-29 (9 quick wins concluídos em 3 fases)
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

---

## 🟢 P1 · Sugestões pequenas por módulo

Pool de melhorias pequenas (esforço ≤ 3h cada) baseadas em inspeção dos módulos e nas suas próprias sugestões. **Marque com `[x]` o que quer fazer próximo** — eu implemento na sequência marcada.

---

### 6.A · Velocidade e atalhos (cross-cutting)

- [ ] **6.A.1** · **Duplicar lançamento** (✨ sua ideia) — botão "Duplicar" no modal de editar entrada/saída. Esforço: ~30min
- [ ] **6.A.2** · **Lançar novamente neste mês** (✨ sua ideia) — botão pequeno em cada item da lista que copia o lançamento com data de hoje. Esforço: ~45min
- [x] **6.A.3** · ✅ Busca global · `/` ou ícone lupa · busca em entries/saidas/noivas
- [x] **6.A.4** · ✅ Notas rápidas · widget no Resumo · grava em anotacoes/ caderno "Notas rápidas"
- [ ] **6.A.5** · **Atalhos de teclado** — `/` busca, `N` nova entrada, `S` nova saída, `Esc` fecha modal. Esforço: ~30min
- [ ] **6.A.6** · **Templates de saída fixa** — "DAS de novembro", "Equipe Julia · sábado" — 1 clique preenche tudo. Esforço: ~1h
- [ ] **6.A.7** · **Long-press na lista** → menu rápido (duplicar / refazer no mês / pin). Esforço: ~1h
- [ ] **6.A.8** · **Repetir último PIX** — formulário de entrada pré-preenche valor + cliente da última realizada do mesmo serviço. Esforço: ~45min

### 6.B · Clientes (módulo somente-leitura hoje)

- [ ] **6.B.1** · **Migrar fonte de GAS → `DB.entries.list()`** — remover dependência do Apps Script. Esforço: ~2h. Risco baixo.
- [ ] **6.B.2** · **Adicionar `checkAuth()` no boot** — hoje qualquer URL acessa o módulo. Esforço: ~15min
- [ ] **6.B.3** · **Busca por nome do cliente** — caixa no topo, filtra a lista em tempo real. Esforço: ~30min
- [ ] **6.B.4** · **Tela de detalhe do cliente** — toca no nome → vê histórico completo (X atendimentos, R$ Y total, último em DD/MM, ticket médio). Esforço: ~2h
- [ ] **6.B.5** · **Top clientes do ano** — ranking por frequência e por receita. Esforço: ~1h
- [ ] **6.B.6** · **Cliente sem atender há X meses** — alerta no painel ("Ana não agenda há 4 meses"). Esforço: ~1h
- [ ] **6.B.7** · **Anotações por cliente** — campo livre (preferências: cor batom, alérgica a Y, gosta de chá). Esforço: ~1h30
- [ ] **6.B.8** · **Tags por cliente** — VIP, social, casamento, formatura. Filtro por tag. Esforço: ~1h30
- [ ] **6.B.9** · **Botão WhatsApp formatado** — gera link `wa.me/...` com mensagem pré-pronta ("Oi Maria! Confirmando seu atendimento amanhã 10h"). Esforço: ~45min

### 6.C · Orçamentos

- [ ] **6.C.1** · **Disable button durante submit** (já no roadmap antigo) — evita criar entries duplicadas se Carol clicar 2x rápido. Esforço: ~10min · **Bug fix**
- [x] **6.C.2** · ✅ Dashboard de conversão · botão 📊 nos chips · mês atual vs anterior vs últimos 3m vs ano
- [ ] **6.C.3** · **Filtro por serviço** (já no roadmap) — maquiagem, cabelo, noiva. Esforço: ~30min
- [ ] **6.C.4** · **Campo "como conheceu"** (já no roadmap) — Instagram, indicação, Google. Permite calcular ROI por canal. Esforço: ~1h
- [ ] **6.C.5** · **Tempo médio de resposta** — desde criação do orçamento até fechamento (ou perda). Esforço: ~45min
- [ ] **6.C.6** · **Orçamento abandonado** — sem resposta há > 7 dias → alerta com botão de follow-up automático. Esforço: ~1h30
- [ ] **6.C.7** · **Reapresentar orçamento** — botão "reenviar com novo valor" reusa template, gera novo `id`. Esforço: ~1h
- [ ] **6.C.8** · **Histórico de preços por cliente** — "Maria pagou R$ 350 nesse serviço da última vez". Esforço: ~1h

### 6.D · Estoque

- [ ] **6.D.1** · **Busca por nome/obs** (já no roadmap) — input no topo. Esforço: ~20min · **Quick win**
- [ ] **6.D.2** · **Ordenação por status** (já no roadmap) — zerado → acabando → ok → wishlist. Esforço: ~30min
- [ ] **6.D.3** · **Quantidade + qtd mínima** (já no roadmap) — alerta automático ao atingir o mínimo. Esforço: ~2h
- [ ] **6.D.4** · **Exportar lista de compras WhatsApp** — botão gera texto "Lista de compras: 1. Base MAC, 2. Pincel BdellÚm..." → copia clipboard. Esforço: ~45min · **Quick win alto valor**
- [ ] **6.D.5** · **Foto do produto** (já no roadmap) — upload no card, vê thumb na lista. Esforço: ~2h
- [ ] **6.D.6** · **Link de compra externo** — URL no card (Amazon, Mercado Livre). 1 clique abre a página. Esforço: ~20min
- [ ] **6.D.7** · **Soma do estoque + soma da wishlist** — totais no header ("Custo do estoque: R$ X · Comprar tudo da wishlist: R$ Y"). Esforço: ~30min
- [ ] **6.D.8** · **Última compra + data** — vê quando foi a última reposição de cada produto. Esforço: ~45min

### 6.E · Insights de dinheiro (Financeiro/Fiscal)

- [x] **6.E.1** · ✅ Simulador de teto MEI · ritmo atual + ponderada 3 meses no Painel Fiscal
- [x] **6.E.2** · ✅ Meta mensal · barra de progresso no Resumo com cores semânticas
- [ ] **6.E.3** · **What-if no Fiscal** — "Se eu cobrar R$ X esse mês, sobro com R$ Y de margem". Esforço: ~1h
- [x] **6.E.4** · ✅ Salário-equivalente CLT · card Resultado do Resumo (fator 0,72)
- [ ] **6.E.5** · **Comparativo mesmo mês ano anterior** — "Maio 2026 vs Maio 2025: +18%". Esforço: ~45min
- [ ] **6.E.6** · **Streak de meses positivos** — "8 meses seguidos no lucro" (motivacional). Esforço: ~45min
- [ ] **6.E.7** · **Custo por atendimento** — despesas profissionais ÷ qtd entradas. Mostra "custo unitário R$ Z". Esforço: ~30min

### 6.F · Proatividade / lembretes

- [ ] **6.F.1** · **Pagamentos previstos vencendo essa semana** — badge no painel ("3 previstos · R$ 1.200"). Esforço: ~1h
- [ ] **6.F.2** · **Noivas com casamento ≤ 30d e contrato pendente** — alerta vermelho ("Maria casa em 22d, falta R$ 1.500"). Esforço: ~1h
- [ ] **6.F.3** · **Aniversário de clientes/noivas** — lembrete pra mandar mensagem (precisa adicionar campo aniversário). Esforço: ~1h30
- [ ] **6.F.4** · **Cobrança atrasada** — entrada Previsto com `dataServ` no passado → muda pra vermelho na lista. Esforço: ~30min

### 6.G · Comunicação rápida

- [x] **6.G.1** · ✅ WhatsApp em Clientes · botão verde nos cards · telefone salvo em `cliente_contatos`
- [x] **6.G.2** · ✅ PIX QR Code · config Financeiro + botão em entradas Previsto · BR Code EMV BACEN
- [ ] **6.G.3** · **Recibo PDF simples** — botão na entrada → gera PDF "Recibo de pagamento" pra enviar pra cliente. Esforço: ~1h

### 6.H · Confiança / audit

- [x] **6.H.1** · ✅ Soft delete com undo · toast 5s · entries e saídas não-grupo
- [ ] **6.H.2** · **Histórico de versões da entrada** — vê quem mudou o quê e quando (audit log básico). Esforço: ~3h
- [ ] **6.H.3** · **Indicador de sincronização visível** — "Sincronizado · 14:32" no header. Esforço: ~30min
- [ ] **6.H.4** · **Backup manual** — botão "Baixar tudo (JSON)" no config (peace of mind). Esforço: ~30min

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
