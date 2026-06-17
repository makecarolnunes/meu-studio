# CLAUDE.md — Orçamentos

Módulo central do fluxo comercial: recebe pedido → negocia → fecha → sincroniza financeiro + agenda + WhatsApp.

---

## Arquivos

| Arquivo | Papel |
|---|---|
| `orcamentos_novo.html` | Arquivo ativo (HTML + CSS + JS inline via `<script src>`) |
| `styles/orcamentos.css` | CSS do módulo |
| `scripts/orcamentos.js` | Toda a lógica JS |

> Não existe `index.html` próprio — há um redirect em `orcamentos/index.html` apontando para `orcamentos_novo.html`.

---

## Estado global (em `orcamentos.js`)

```js
let orcamentos  = []          // array em memória (fonte: Supabase)
let curFilter   = 'todos'     // filtro ativo
let curMonth    = null        // mês selecionado (null = todos)
let editOrcId   = null        // ID do orçamento aberto no panel-action
let fechSlots   = []          // slots do panel-fechar (data+serviço+horário)
let addSlots    = []          // slots do panel-add
let followupTpls= []          // templates de follow-up (localStorage)
let serviceMap  = {}          // preços: { 'Maquiagem no Studio': { valor, duracao } }
let fechSinalManual = false   // flag: usuário editou o sinal manualmente
```

---

## Fluxo de fechamento (`abrirFechamento → confirmarFechamento`)

```
panel-action → [btn Fechar e Agendar Tudo]
  → abrirFechamento()
    → panel-fechar (slots, valores, local, forma, origem)
  → confirmarFechamento()
    1. Valida campos obrigatórios
    2. setStatus(orçamento, 'Fechado') → Supabase
    3. finEntryCreate(sinal) → DB.entries.create() [sinal]
    4. finEntryCreate(restante) → DB.entries.create() [restante previsto]
    5. Gera mensagem WhatsApp
    6. Tenta criar eventos Google Agenda via MCP
    7. Exibe panel-confirmacao
```

### `finEntryCreate(entry)` — crítico

Cria entry diretamente em `DB.entries.create()`. Não passa por `sbCall`. O mapeamento:
```js
{
  id: genId(),           dataPag: data_do_slot,
  cliente: nome,         tipo: 'Sinal' | 'Pagamento',
  valor: valor_num,      valorTotal: total_num,
  servico: servico,      local: local_tipo,
  forma: forma,          status: 'Realizado' | 'Previsto',
  origem: origem,        obs: obs,
  auto: tipo === 'Pagamento',  // restante = auto:true
  noivaId: ''
}
```

**Regra:** se `origem === 'Noiva'`, o `finEntryCreate` do restante deve ter `auto: true` para o financeiro reconhecer como "Restante Previsto" gerenciado.

---

## Comprovantes (Supabase Storage)

- Bucket: `comprovantes` (público)
- Path: `{orca_id}/{cat}_{timestamp}.ext`
- Campo no DB: `comprovantes JSONB` — array de `{ fileId, link, nome, categoria }`
- Upload via `DB.storage.uploadComprovante()` (lê o arquivo como base64)
- Delete via `DB.storage.deleteComprovante(fileId)` — só funciona se `fileId` contém `/` (IDs legados do Drive não têm)

---

## Follow-up templates

Armazenados em `localStorage` key `mk_followup_templates` como:
```js
[{ id: string, titulo: string, mensagem: string }]
```
Variáveis interpoladas em tempo real: `[NOME]`, `[SERVIÇO]`, `[VALOR]`.

---

## Slots (datas/serviços)

Os formulários "Novo orçamento" e "Fechar" usam slots dinâmicos:
- `addSlots[]` → gerenciado por `addAddSlot()` / `removeAddSlot()`
- `fechSlots[]` → gerenciado por `addFechSlot()` / `removeFechSlot()`
- Cada **linha** de UI: `{ id, servico, valorUnit, data, horario, qtd, duracao }`
  (`qtd` = quantidade de atendimentos iguais; `duracao` em minutos, editável)
- Renderização compartilhada: `renderSlotRow()` + `syncSlotField()` (add e fech)
- Valor total = `Σ(valorUnit × qtd)`
- Sinal padrão = 30% do total (sobrescrito se `fechSinalManual = true`)

### Quantidade → slots atômicas (expand / collapse)
O modelo persistido continua **uma slot = uma ocorrência**. A `qtd` é só
conveniência de UI:
- `expandRows(rows)` → expande cada linha em `qtd` slots atômicas, **sequenciando
  os horários por data** (cada ocorrência ocupa `duracao` min; uma linha com
  horário próprio reposiciona o cursor). Usado em `saveNew()` e
  `confirmarFechamento()`.
- `collapseSlots(atomicSlots)` → recolhe slots consecutivas iguais de volta em
  uma linha com `qtd`. Usado em `abrirFechamento()` ao reabrir.
- Mantém intactos: contagens (`contarServicosGrupo`), financeiro (1 Sinal + 1
  Restante usando o total), `entrySlots`, filtros e o matching do Clientes.

---

## Google Agenda (MCP)

Usa `window.cowork.callMcpTool('mcp__...__create_event', {...})`. O MCP ID muda por ambiente — o ID está hardcoded em `orcamentos.js`. Se a integração quebrar, verificar o ID do MCP no settings do Claude Code.

Formato do título do evento (usado pelo módulo Clientes para matching):
```
HHhMM - HHhMM | Nome Cliente | Serviço | Local
```

`buildEventos()` **agrupa as slots por data**: vários serviços na mesma data
viram **um único evento** (início = menor horário, fim = maior horário + duração;
título com resumo `6 Make e Cabelo` e descrição agrupada via
`buildGrupoDescricao`). Datas diferentes continuam gerando eventos separados. O
módulo Clientes só lê `parts[0]` (horário) e `parts[1]` (nome) — mesclar é seguro.

---

## Issues conhecidos / Tech debt

- `serviceMap` usa `DB.valoresServicos.load()` — se a tabela `valores_servicos` não existir no Supabase, silencia e usa `DEFAULT_SERVICES` hardcoded em `orcamentos.js`. Verificar se a tabela foi criada.
- O painel de fechamento não verifica duplicatas: se o botão for clicado duas vezes rapidamente, pode criar entries duplicadas no financeiro. **Fix:** desabilitar o botão após o primeiro clique (já existe `btn-fechar` com id `fech-confirm-btn`, adicionar `disabled` no início de `confirmarFechamento()`).
- Filtros de agenda (`agenda-pend`, `agenda-ok`) verificam `o.AgendaCriada === 'sim'` — campo legado. Novos orçamentos fechados pelo fluxo atual usam `agenda_criada` vindo do Supabase.
- Status `'Novo Pedido'` é o default — orçamentos sem status explícito devem ser tratados como `'Novo Pedido'`.

---

## Roadmap / Melhorias planejadas

- [ ] Desabilitar `fech-confirm-btn` durante `confirmarFechamento()` para evitar double-submit
- [ ] Preview do evento Google Agenda antes de criar
- [ ] Histórico de mudanças de status por orçamento
- [ ] Filtro por serviço (maquiagem, cabelo, noiva)
- [ ] Dashboard de conversão mensal (total enviados × fechados × perdidos)
- [ ] Notificação automática de follow-up vencendo (integrar com módulo Tarefas)
- [ ] Campo "como nos conheceu" para análise de origem
