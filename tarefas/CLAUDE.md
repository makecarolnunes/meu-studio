# CLAUDE.md — Tarefas (Studio Flow)

Sistema de produtividade para pessoa criativa/autônoma: projetos com progresso,
fluxo Kanban, foco do dia e backlog de ideias. Redesign "Studio Flow" em 2026-06
(substituiu a to-do list plana original).

---

## Arquivos

| Arquivo | Papel |
|---|---|
| `index.html` | Estrutura: sidebar desktop + 5 vistas + painéis (tarefa/projeto) |
| `styles/tarefas.css` | CSS completo (usa tokens de `shared/css/tokens.css`) |
| `scripts/tarefas.js` | Toda a lógica |
| `prototipo-studio-flow.html` | Protótipo navegável do redesign (dados fake, não toca no DB) |

SQL: `sql/tarefas-studio-flow.sql` (migration aditiva — já aplicada em produção).

---

## Supabase

### Tabela `tarefas` (estendida)

| Campo | Tipo | Observação |
|---|---|---|
| `id` | TEXT PK | String do `Date.now()` |
| `titulo` | TEXT | Texto da tarefa |
| `prazo` | DATE | Opcional |
| `prioridade` | TEXT | `urgente \| importante \| normal` (CHECK aceita legados `alta/baixa`) |
| `feita` | BOOLEAN | **Sincronizado** com `status='feita'` — mantido p/ compat do widget do Hub |
| `area` | TEXT | `conteudo \| cursos \| clientes \| producao \| admin` |
| `projeto_id` | TEXT | FK lógica → `projetos.id` (null = sem projeto) |
| `status` | TEXT | `ideia \| a_fazer \| fazendo \| feita` (fonte da verdade do estado) |
| `foco` | BOOLEAN | `true` = escolhida para o "Foco de hoje" |
| `created_at` | TIMESTAMPTZ | Auto |

### Tabela `projetos`

| Campo | Tipo | Observação |
|---|---|---|
| `id` | TEXT PK | `'proj-'+Date.now()` |
| `nome` | TEXT | — |
| `area` | TEXT | mesma enum de `tarefas.area` |
| `cor` | TEXT | reservado (cor deriva da área hoje) |
| `meta_data` | DATE | meta/prazo do projeto |
| `arquivado` | BOOLEAN | — |

RLS: `anon` tem acesso total em ambas.

> **status × feita:** `status` é a fonte da verdade. `DB.tarefas.upsert` deriva
> `feita = (status==='feita')` e, se o chamador setar `feita` explicitamente
> (ex: `hubToggle` no Hub), ajusta o `status`. Nunca gravar os dois divergentes.

---

## DB (shared/js/db.js)

```js
DB.tarefas.list()    // → Tarefa[] (created_at DESC) — inclui area, projetoId, status, foco
DB.tarefas.upsert(t) // status fonte da verdade; sincroniza feita
DB.tarefas.delete(id)
DB.projetos.list()   // → Projeto[] (created_at ASC)
DB.projetos.upsert(p)
DB.projetos.delete(id)
```

---

## Estado (`tarefas.js`)

```js
var tasks    = [];      // tarefas em memória
var projetos = [];      // projetos em memória
var curView  = 'hoje';  // 'hoje'|'projetos'|'kanban'|'ideias'|'feitas'
var editId   = null;    // tarefa em edição
var editProj = null;    // projeto em edição
```

`FLOW = ['ideia','a_fazer','fazendo','feita']` · `AREAS{}` define label/cor/bg/ico por área.

---

## Vistas

| Vista | Conteúdo |
|---|---|
| **Hoje** | Foco de hoje (`foco=true`) + A fazer (resto pendente) + Feitos. Captura rápida com parser `#area`/`#projeto` + `!urgente`/`!importante`. |
| **Projetos** | Cards com barra de progresso (`projStats`) e "próxima ação". |
| **Kanban** | Colunas Ideia→A fazer→Fazendo→Concluído de **um projeto** (select `#kb-select`). WIP no "Fazendo". |
| **Ideias** | Tarefas com `status='ideia'`. `promote()` → `a_fazer` + `foco`. |
| **Feitas** | Todas concluídas + card de destaque com total. |

`renderCurrent()` despacha por `curView`. `go(v)` troca de vista (sincroniza nav mobile **e** sidebar desktop).

---

## Layout responsivo

- **Mobile**: topbar + conteúdo empilhado + **bottom nav** (5 abas) + FAB.
  `padding-left:100px` no topbar evita o FAB global de `sidebar.js`.
- **Desktop (≥980px)**: `.tar-app` vira grid `252px 1fr`. Sidebar própria de vistas
  (`.d-side`, com `padding-top:58px` p/ não cobrir o FAB global). O **Hoje** vira
  dashboard de 3 colunas (Foco | A fazer | trilho Projetos+Feitos). Painéis viram modais centrais.

---

## Otimismo / sync

- `complete`, `toggleFoco`, `kbMove`, `capture`, `addIdea`, `promote`: mutam o array,
  re-renderizam na hora e fazem `DB.tarefas.upsert` async com **rollback** em erro.
- `saveTask`, `deleteTask`, `saveProj`, `deleteProj`: `await DB` + `load()` (refetch).
- `complete` anima (`.leaving` + check `.done`) antes de re-renderizar (340ms).

---

## Widget no Hub (`hub-assets/scripts/hub.js`)

- `loadTodoWidget()` filtra `!feita && status!=='ideia'` (ideias não contam como pendência).
- Indicador de prioridade aparece p/ `urgente`/`importante`.
- `hubToggle()` seta `feita=true` → `upsert` marca `status='feita'`.

---

## Issues conhecidos / próximos passos

- Sem `feita_em` (timestamp de conclusão): "Feitos hoje" mostra todas as concluídas
  (não filtra por dia). Streak na vista Feitas mostra total, não sequência real de dias.
- Kanban tem drag-and-drop (HTML5) no desktop; botão "mover →" mantido como alternativa no toque/mobile. `kbSetStatus(id,status)` é o ponto único (drop e botão chamam ele).
- Sem tarefas recorrentes.
- Excluir projeto desvincula as tarefas uma a uma (loop de upserts) — ok p/ volumes pequenos.
- Vista Calendário ainda não existe (estava no conceito; backlog).
