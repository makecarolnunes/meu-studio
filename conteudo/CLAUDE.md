# CLAUDE.md — Conteúdo

Módulo de planejamento de posts e ideias para redes sociais, reorganizado como **Centro de Comando** (2026-06): a home é o painel **Hoje** (o que gravar/publicar/editar + stories do dia + próximos dias); o acervo (lista/board/calendário) virou seção secundária.

## Views

| View | O que é | Acesso |
|---|---|---|
| `hoje` | Painel do dia (default). Desktop: 3 zonas (Hoje 45% · Stories 26% · Próximos dias 29%) + gaveta do banco de ideias. Mobile: herói "próxima ação" + seções empilhadas | tab ☀️ Hoje / sidebar |
| `stories` | Checklist de stories dos próximos 7 dias (mobile; no desktop a coluna da view Hoje cobre) | tab 📱 Stories |
| `cal` | Calendário mensal (inalterado) | tab/nav 📅 Agenda |
| `list` / `board` / `inbox` | Lista de ideias + quick notes (os antigos) | tab/nav 💡 Ideias · 📥 Inbox |
| `acervo` | **Acervo** — banco de matéria-prima: materiais (lotes de fotos/vídeos) → IA garima oportunidades classificadas por formato+objetivo → promove p/ Planejamento | tab/nav 🎞️ Acervo |

Navegação: **mobile** = tabs fixas inferiores (`.m-tabs`); **desktop** = nav na sidebar + pipeline com contadores (`buildSidebar`). O header mobile some no desktop (`.hdr{display:none}` ≥1024px).

### Regras do painel Hoje (`hojeData()` — seções mutuamente exclusivas)
1. 🔴 Atrasados: `scheduledDate < hoje` e não Publicado
2. 📤 Publicar hoje: `scheduledDate === hoje`
3. ✂️ Em edição: `status === 'Editando'`
4. ✅ Prontos sem data → alerta "agendar agora" na zona Próximos dias
5. 🎬 Gravar hoje: `gravarDate <= hoje`, OU Fila de Gravação sem gravarDate com publicação ≤ hoje+3d

Ações de 1 toque nos cards: `advanceTo(id, status)` (✓ Gravei → Editando · ✓ Editado → Pronto · ✓ Publiquei → Publicado), `openRoteiro` (modo gravação direto), `copyLegenda` (clipboard), `reagendarIdea`. Promover ideia: menu ⤴ (`openPromo`) em qualquer card do acervo/banco, ou drag-and-drop da gaveta (desktop) para Gravar hoje / Stories / um dia.

---

## Arquivos

| Arquivo | Papel |
|---|---|
| `index.html` | HTML principal |
| `styles/conteudo.css` | CSS do módulo |
| `scripts/conteudo.js` | Toda a lógica (monolítico, ~1500 LOC) |
| `Code.gs.txt` | Código Google Apps Script legado (referência, não usado ativamente) |

---

## Estado global (`conteudo.js`)

```js
var ideas      = [];       // array de ideas (fonte: Supabase ou localStorage)
var customCats = [];       // categorias personalizadas (localStorage)
var customPlats= [];       // plataformas personalizadas (localStorage)
var curView    = 'list';   // 'list' | 'calendar'
var curSF      = 'todos';  // filtro de status
var curCF      = [];       // filtro de categorias (multi-select)
var curPlat    = 'todos';  // filtro de plataforma
var calYear, calMonth;     // ano/mês do calendário
var editId     = null;     // idea em edição no modal
```

---

## Estrutura de uma Idea

```js
{
  id:            string,      // gerado em criação
  title:         string,
  categories:    string[],    // ex: ['Maquiagem Profissional', 'Noivas']
  formatos:      string[],    // ex: ['Reels', 'Carrossel']
  status:        string,      // ver STATUS_KEYS abaixo
  notes:         string,
  platforms:     string[],    // ex: ['Instagram', 'TikTok']
  scheduledDate: string,      // data de PUBLICAÇÃO — YYYY-MM-DD ou ''
  gravarDate:    string,      // data de GRAVAÇÃO — YYYY-MM-DD ou ''
  createdAt:     string,
}
```

### Status válidos (funil `ST_ORDER`)

```js
var ST = {
  'Nao Iniciado':     { bg, color, dot, cls: 's-nao'    },  // 💡 Ideia
  'Fila de Gravacao': { bg, color, dot, cls: 's-fila'   },  // 🎬 Gravar
  'Editando':         { bg, color, dot, cls: 's-edit'   },  // ✂️ Editando
  'Pronto':           { bg, color, dot, cls: 's-pronto' },  // ✅ Pronto p/ publicar
  'Publicado':        { bg, color, dot, cls: 's-pub'    },  // 📤 Publicado
}
```

`'Nao Iniciado'` é o default. Atenção: sem acento em `'Nao'` (legado).

---

## Estrutura de um Story (checklist diário)

```js
{ id, date: 'YYYY-MM-DD', texto, ideaId: '' /* opcional, vínculo c/ idea */, done: bool, ordem: int, createdAt }
```

- localStorage `mk_content_stories` + Supabase `conteudo_stories` (`DB.stories.list/upsert/delete`)
- ⚠ Requer a migration manual **`sql/conteudo-centro-comando.sql`** (cria a tabela + coluna `gravar_date` em `conteudo_ideas`). Sem ela, stories ficam só locais e salvar ideia com data de gravação falha silencioso (PGRST204).

---

## Persistência — dupla camada

### localStorage (cache local)
```
mk_content_ideas         → JSON das ideas
mk_content_stories       → JSON dos stories (checklist diário)
mk_content_materiais     → JSON dos materiais do Acervo
mk_content_cats          → categorias personalizadas
mk_content_platforms     → plataformas personalizadas
mk_content_cur_platform  → plataforma ativa no filtro
```

### Supabase (fonte de verdade)
- `DB.conteudo.list()` / `.upsert()` / `.delete()` — tabela `conteudo_ideas` (com `gravar_date`, `objetivo`, `material_id`)
- `DB.stories.list()` / `.upsert()` / `.delete()` — tabela `conteudo_stories`
- `DB.materiais.list()` / `.upsert()` / `.delete()` — tabela `conteudo_materiais` (Acervo)
- `DB.storage.uploadMaterial/signMaterials/deleteMaterial` — bucket **privado** `materiais` (URLs assinadas)

---

## Acervo (banco de matéria-prima) — `scripts/conteudo.js` (seção ACERVO)

Transforma mídia bruta em conteúdo publicável. Fluxo: **Material** (lote de fotos/vídeos) → `garimpar()` chama a Claude API com visão (`claude-sonnet-4-6`, `tool_choice` forçado p/ `registrar_ideias`) → **oportunidades** (`sugestoes` em JSONB) classificadas por `formato`×`objetivo` → `promoverOportunidade()` cria uma idea em `conteudo_ideas` (`status:'Fila de Gravacao'`, `materialId`, `objetivo`) — mesmo padrão do `saveAsIdea()` do Brand Brain.

- **Mídia:** redimensionada p/ JPEG ≤1280px no client; vídeo → extrai 1 frame (canvas) p/ IA/thumb + sobe o original. A API recebe imagens via `source:{type:'url'}` com URLs assinadas (sem vídeo direto).
- **Medidor de exploração:** chips de formato acendem conforme `ideias` geradas (`materialId`) e sugestões `planejada`s; `materialEsgotado()` = todos os formatos cobertos e sem pendentes.
- **Privacidade:** bucket `materiais` é privado (rosto de cliente) — só URLs assinadas, nunca público.
- ⚠ **Requer migration manual `sql/conteudo-acervo.sql`** (tabela + colunas em `conteudo_ideas` + bucket). Sem ela, upload/salvar retorna 400 e os materiais ficam só locais.

**Status atual:** integrado. `loadData()` renderiza do cache local primeiro e depois mescla do Supabase (servidor vence; itens só-locais sobem). Todo write é local imediato + `persistIdea()` / `persistStory()` async com catch silencioso.

### GAS (legado, desativado)

`pushToSheets()` ainda existe mas `HARDCODED_SCRIPT_URL = ''` — nunca executa. `scheduleSync()` retorna cedo se não há URL. Código pode ser removido após migração completa para Supabase.

---

## View: Lista

Cards por idea com:
- Badge de status (colorido)
- Categorias e formatos como tags
- Data agendada se houver
- Tap → abre modal de edição

Filtros: status (tab) + categoria (chip multi-select) + plataforma (tab)

---

## View: Calendário

- Grade mensal (semanas = linhas, dias = colunas)
- `colIdx` controla qual dia da semana começa (configurável, default segunda)
- Cada dia mostra dots coloridos por status das ideas agendadas
- Tap no dia → `curDayDate` + `dayPickerOpen = true` → lista de ideas do dia
- Arrastar idea para outro dia: `dragstart` / `dragover` / `drop` → atualiza `scheduledDate`

---

## Função de migração de dados legados

`migrate()` é chamada no boot para normalizar campos antigos:
- `platforms`: string → array
- `categories`: string → array
- `formatos`: campo legado → array
Mantida para compatibilidade com dados importados via GAS.

---

## Issues conhecidos

- ~~Sem auth guard~~ ✅ resolvido: guard inline no `<head>` de `index.html` e das 6 sub-páginas (redireciona ao Hub sem sessão)
- **Sem Supabase** — dados ficam apenas no localStorage do dispositivo
- Status `'Nao Iniciado'` sem acento — cuidado ao comparar (usar exatamente essa string)
- Drag-and-drop no calendário não funciona em iOS (touch events não implementados)
- `curCF` (filtro de categorias) é um array mas é serializado como JSON na URL — se a URL for copiada, os filtros não são restaurados

---

## Categorias padrão

```js
var CATS = [
  'Maquiagem Profissional', 'Cachos e Crespos', 'Penteados',
  'Noivas', 'Automaquiagem', 'Vida e Lifestyle', 'Compras e Produtos'
];
```

Categorias customizadas ficam em `customCats` (localStorage). A lista final é `CATS.concat(customCats)`.

---

## Roadmap

- [ ] Migrar persistência para Supabase (`DB.conteudo`)
- [x] Auth guard no boot (inline no `<head>` de index.html + 6 sub-páginas)
- [ ] Touch drag-and-drop no calendário (iOS)
- [ ] Exportar agenda do mês como imagem (canvas)
- [ ] Integração com Instagram API para publicação direta
- [ ] Campo de caption da publicação
- [ ] Notificação D-1 da data agendada
