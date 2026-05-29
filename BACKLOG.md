# Backlog · Meu Studio

> Última revisão: 2026-05-29
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
