# CLAUDE.md — Estoque

Módulo de controle de produtos, equipamentos e wishlist. Criado em 2026-05.

---

## Arquivos

| Arquivo | Papel |
|---|---|
| `index.html` | HTML + carregamento de scripts |
| `styles/estoque.css` | CSS do módulo |
| `scripts/estoque.js` | Toda a lógica |

SQL: `sql/estoque-tarefas.sql` (criar tabela) + `sql/estoque-add-valor.sql` (adicionar coluna valor).

---

## Supabase

**Tabela:** `estoque`

| Campo | Tipo | Observação |
|---|---|---|
| `id` | TEXT PK | String do `Date.now()` |
| `nome` | TEXT NOT NULL | Nome do produto/item |
| `categoria` | TEXT | Maquiagem / Cabelo / Skin / Equipamentos / Consumíveis / Outros |
| `status` | TEXT | `ok \| acabando \| zerado \| investir \| wishlist` |
| `obs` | TEXT | Notas livres (marca preferida, onde comprar...) |
| `valor` | NUMERIC(10,2) | Preço de referência — pode ser 0 |
| `created_at` | TIMESTAMPTZ | Auto |

RLS: `anon` tem acesso total (`FOR ALL TO anon`).

---

## DB.estoque (shared/js/db.js)

```js
DB.estoque.list()          // → Item[]  (ordem: created_at DESC)
DB.estoque.upsert(item)    // → id      (INSERT OR UPDATE por id)
DB.estoque.delete(id)      // → void
```

`valor` é mapeado como `Number` no fromDb (nunca null — default 0).

---

## Estado (`estoque.js`)

```js
var items     = [];       // array em memória
var curFilter = 'todos';  // 'todos' | 'repor' | 'acabando' | 'investir' | 'wishlist'
var editId    = null;     // id do item em edição (null = novo)
```

---

## STATUS_CFG — mapa de cores

```js
var STATUS_CFG = {
  ok:       { label: 'OK',       color: '#3B6D11', bg: '#EAF3DE' },
  acabando: { label: 'Acabando', color: '#BA7517', bg: '#FAEEDA' },
  zerado:   { label: 'Zerado',   color: '#C62828', bg: '#FCE7E7' },
  investir: { label: 'Investir', color: '#6A1B9A', bg: '#F3E5F5' },
  wishlist: { label: 'Wishlist', color: '#1565C0', bg: '#E3F2FD' },
};
```

Esses valores são injetados inline via `style` nos cards (não via classe CSS) — manter sincronizado se cores mudarem.

---

## Filtro "Repor"

O filtro `repor` agrega dois status:
```js
items.filter(i => i.status === 'zerado' || i.status === 'acabando')
```

Os chips mostram contagens separadas (Repor = só zerado, Acabando = só acabando).

---

## Valor no card

O valor só aparece no card se `item.valor > 0`:
```js
(i.valor > 0 ? 'R$ ' + i.valor.toLocaleString('pt-BR', {minimumFractionDigits:2}) : '')
```

No formulário, o campo `f-valor` aceita número decimal. `parseFloat(...) || 0` no save — nunca null.

---

## Auth

`checkAuth()` verifica `mk_session` em localStorage e redireciona para `../` se inválida ou expirada.

---

## Issues conhecidos

- Sem busca/filtro por texto — para muitos itens fica difícil de achar. Adicionar `<input type="search">` filtrando `nome` e `obs`.
- Sem ordenação customizável — sempre `created_at DESC`. Considerar ordenar por `status` (zerado primeiro) ou por nome.
- `categoria` é texto livre via `<select>` fixo. Se quiser adicionar nova categoria, precisa de deploy.

---

## Roadmap

- [ ] Busca por texto (nome / obs)
- [ ] Ordenação: por status (zerado → acabando → ok → investir → wishlist) ou alfabética
- [ ] Campo `quantidade` (inteiro) + campo `quantidade_minima` para alertar quando atingir
- [ ] Categorias personalizáveis (igual ao módulo Conteúdo)
- [ ] Exportar lista de compras (itens zerado/acabando) como texto para WhatsApp
- [ ] Foto do produto (Supabase Storage, similar a comprovantes)
- [ ] Lista de fornecedores/lojas com link de compra
