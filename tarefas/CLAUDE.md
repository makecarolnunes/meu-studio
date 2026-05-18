# CLAUDE.md — Tarefas

Módulo de to-do list com agrupamento visual por urgência e widget no Hub. Criado em 2026-05.

---

## Arquivos

| Arquivo | Papel |
|---|---|
| `index.html` | HTML + barra de progresso + quick-add + painel |
| `styles/tarefas.css` | CSS completo do módulo |
| `scripts/tarefas.js` | Toda a lógica |

SQL: `sql/estoque-tarefas.sql` (criar tabela `tarefas`).

---

## Supabase

**Tabela:** `tarefas`

| Campo | Tipo | Observação |
|---|---|---|
| `id` | TEXT PK | String do `Date.now()` |
| `titulo` | TEXT NOT NULL | Texto da tarefa |
| `prazo` | DATE | Opcional — null = sem prazo |
| `prioridade` | TEXT | `'alta' \| 'normal'` |
| `feita` | BOOLEAN | Default: false |
| `created_at` | TIMESTAMPTZ | Auto |

RLS: `anon` tem acesso total.

Ordenação padrão em `DB.tarefas.list()`: `prazo ASC NULLS LAST` — tarefas sem prazo ficam no final.

---

## DB.tarefas (shared/js/db.js)

```js
DB.tarefas.list()         // → Tarefa[]  (prazo ASC, nulls last)
DB.tarefas.upsert(t)      // → id        (INSERT OR UPDATE)
DB.tarefas.delete(id)     // → void
```

---

## Estado (`tarefas.js`)

```js
var tasks     = [];           // array em memória
var curFilter = 'pendentes';  // 'pendentes' | 'hoje' | 'semana' | 'feitas'
var editId    = null;         // id em edição (null = nova)
```

---

## Agrupamento visual (`buildGroups`)

Grupos em ordem de exibição (apenas os com tarefas aparecem):

| Grupo | Critério | Estilo |
|---|---|---|
| Atrasadas | `prazo < hoje` | Badge vermelho, fundo `#fff9f9` |
| Hoje | `prazo === hoje` | Badge âmbar, fundo `#fffbf5` |
| Amanhã | `prazo === hoje+1` | Badge azul |
| Esta semana | `prazo <= weekEnd()` | Badge brand |
| Depois | `prazo > weekEnd() \|\| !prazo` | Badge cinza |

`weekEnd()` retorna o próximo domingo (não o sábado — semana começa na segunda-feira portuguesa).

---

## Quick-add

`quickAdd()` cria uma tarefa com apenas o título (sem painel), de forma otimista:
1. Insere `tmp` no array `tasks` localmente
2. Chama `render()` imediatamente (UI atualizada antes do Supabase)
3. Chama `DB.tarefas.upsert()` async
4. Se falhar: remove o `tmp` e chama `render()` de volta (rollback)
5. Se suceder: chama `load()` para sincronizar o ID real

O `FAB (+)` abre o painel completo (com prazo e prioridade). O quick-add é só para o campo fixo no topo.

---

## Toggle otimista (`toggleDone`)

Mesma estratégia do quick-add:
1. Muta `t.feita` no array
2. `render()`
3. `DB.tarefas.upsert(t)` async
4. Se falhar: reverte `t.feita` + `render()` + toast

---

## Widget no Hub (`hub-assets/scripts/hub.js`)

Funções relevantes em `hub.js`:
- `loadTodoWidget()` — busca `DB.tarefas.list()` e renderiza `#todo-widget`
- `hubToggle(id, btn)` — marca como feita direto do Hub sem navegar para o módulo

O widget aparece somente se houver tarefas pendentes (`pend.length > 0`). Exibe no máximo 5 itens. Se houver mais: link "+ N mais — ver todas →".

O widget renderiza dentro de `#todo-hub-card` (div com classe `todo-hub-card`), posicionado logo após os cards de operação no Hub.

**Alerta de atrasadas:** se `atrs.length > 0`, exibe strip vermelho com contagem.

---

## `prazoLabel(prazo, hoje)` — normalização de datas

```js
prazoLabel('2026-05-18', '2026-05-18') // → { txt: 'Hoje',   cls: 'hoje'    }
prazoLabel('2026-05-19', '2026-05-18') // → { txt: 'Amanhã', cls: 'amanha'  }
prazoLabel('2026-05-10', '2026-05-18') // → { txt: 'seg 10/05', cls: 'atrasada' }
```

Os badges coloridos nos cards usam `prazoLabel` — não comparar datas de forma diferente em outros pontos.

---

## Issues conhecidos

- `quickAdd()` usa `tmp.id = 'tmp-' + Date.now()` — se o usuário fechar o módulo antes do Supabase responder, o item fictício desaparece. Na reabertura, o item real estará lá (o DB.upsert provavelmente já terminou).
- Sem suporte a tarefas recorrentes (diária, semanal).
- Sem categorias — todas as tarefas ficam em um único pool. Com muitas tarefas, fica confuso.
- O filtro "Semana" mostra tarefas atrasadas também (para não sumir do radar). Isso pode ser não-intuitivo.

---

## Roadmap

- [ ] Tarefas recorrentes (diária, semanal, mensal) — campo `recorrencia` + lógica de geração
- [ ] Categorias/projetos (ex: Studio, Pessoal, Finanças) com filtro
- [ ] Subnotes por tarefa (campo `notas` textarea no painel)
- [ ] Arrastar para reordenar (drag-and-drop na lista Pendentes)
- [ ] Notificação push quando prazo chega (service worker / PWA)
- [ ] Integração com Orçamentos: criar tarefa de follow-up automático ao salvar um orçamento com `prox_followup`
- [ ] Marcar como feita com animação de confetti (pequeno detalhe de UX)
