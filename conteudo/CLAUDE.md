# CLAUDE.md — Conteúdo

Módulo de planejamento de posts e ideias para redes sociais. Duas views: lista e calendário mensal.

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
  scheduledDate: string,      // YYYY-MM-DD ou ''
  createdAt:     string,
}
```

### Status válidos

```js
var ST = {
  'Nao Iniciado':     { bg, color, dot, cls: 's-nao'  },
  'Fila de Gravacao': { bg, color, dot, cls: 's-fila' },
  'Editando':         { bg, color, dot, cls: 's-edit' },
  'Publicado':        { bg, color, dot, cls: 's-pub'  },
}
```

`'Nao Iniciado'` é o default. Atenção: sem acento em `'Nao'` (legado).

---

## Persistência — dupla camada

### localStorage (cache local)
```
mk_content_ideas         → JSON das ideas
mk_content_cats          → categorias personalizadas
mk_content_platforms     → plataformas personalizadas
mk_content_cur_platform  → plataforma ativa no filtro
```

### Supabase (fonte de verdade)
`DB.conteudo.list()` / `DB.conteudo.upsert()` / `DB.conteudo.delete()` — definidos em `shared/js/db.js`, tabela `conteudo_ideas`.

**Status atual:** `conteudo.js` usa `readLS()` / `writeLS()` para localStorage. A integração com Supabase via `DB.conteudo` está definida no `db.js` mas **ainda não chamada** em `conteudo.js`. A migração está pendente.

### Para migrar conteudo.js → Supabase

1. Substituir `readLS()` por `await DB.conteudo.list()` no boot
2. Substituir `saveIdeas()` por `await DB.conteudo.upsert(idea)` em saves
3. Substituir delete local por `await DB.conteudo.delete(id)`
4. Adicionar `checkAuth()` (atualmente sem auth guard)

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

- **Sem auth guard** — `checkAuth()` não é chamado no boot
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
- [ ] Adicionar `checkAuth()` no boot
- [ ] Touch drag-and-drop no calendário (iOS)
- [ ] Exportar agenda do mês como imagem (canvas)
- [ ] Integração com Instagram API para publicação direta
- [ ] Campo de caption da publicação
- [ ] Notificação D-1 da data agendada
