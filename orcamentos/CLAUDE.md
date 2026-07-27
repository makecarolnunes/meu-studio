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
let profissionais = []        // minha equipe (Supabase `profissionais` + cache local)
let curFilter   = 'todos'     // filtro ativo
let curMonth    = null        // mês selecionado (null = todos)
let curEquipe   = 'todos'     // filtro: equipe de TERCEIROS
let curResp     = 'todos'     // filtro: quem atende ('__carol__' | nome)
let editOrcId   = null        // ID do orçamento aberto no panel-action
let fechSlots   = []          // slots do panel-fechar (data+serviço+horário)
let addSlots    = []          // slots do panel-add
let followupTpls= []          // templates de follow-up (localStorage)
let serviceMap  = {}          // preços: { 'Maquiagem no Studio': { valor, duracao } }
let fechSinalManual = false   // flag: usuário editou o sinal manualmente
```

---

## Equipe: dois conceitos distintos — **não confundir**

| Campo | Significado | Efeito |
|---|---|---|
| `Equipe` | **Trabalho para equipe de terceiros** — eu atendo para a equipe de outra pessoa | Só rotula orçamento, card e evento |
| `Responsavel` | **Profissional da minha equipe** que executa o atendimento (`''` = Carol) | Muda o título do evento, gera repasse no financeiro |
| `Repasse` | Valor pago ao profissional da minha equipe | Vira **saída** `'Repasse para equipe'` |
| `Cacheada` | Cliente cacheada | Sugere 3h de duração (editável) |

Helpers: `respDe(e)`, `isEquipeEntry(e)`, `repasseDe(e)`, `valorCobradoDe(e)`, `lucroDe(e)`.

Profissionais são cadastrados em **⚙️ Configurações › 👥 Equipe** (`DB.profissionais`,
tabela `profissionais`). `repassePadrao` é só sugestão de preenchimento — o
repasse real é definido em cada orçamento.

---

## Duração dos atendimentos

- **Armazenada em minutos**, **sempre exibida e editada em horas** (`fmtDur(150) === '2h30'`).
- O seletor (`durOptionsHTML`) vai de 15 min a 8h em passos de 15 min e preserva
  qualquer duração fora da grade que já esteja gravada.
- Padrões: Maquiagem + Cabelo = **150** (`DUR_MAKE_CABELO`) · Noiva = 180 ·
  demais = 60 · cliente cacheada sugere **180** (`DUR_CACHEADA`).
- `defaultDuracao(servico, cacheada)` é a única fonte da sugestão. Trocar o
  serviço só sobrescreve a duração se `_durManual` for falso — ou seja, um ajuste
  manual nunca é desfeito pelo sistema.
- A duração real do serviço vem de `valores_servicos.duracao` (editável em
  ⚙️ › Serviços) e **vence** o `DEFAULT_SERVICES` hardcoded.
- Alterar a duração recalcula em cascata: resumo da linha → sequenciamento de
  horários (`expandRows`) → detecção de conflito (`findSlotConflicts`) → fim do
  evento no Google Agenda (`buildEventos`) → mensagem de WhatsApp.

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
    5. finSaidaCreate(repasse) → DB.saidas.upsert() [só se Responsavel ≠ Carol]
    6. Gera mensagem WhatsApp
    7. Tenta criar eventos Google Agenda via MCP
    8. Exibe panel-confirmacao
```

### `finSaidaCreate(saida)` — repasse da equipe

Quando `Responsavel` é um profissional da minha equipe e `Repasse > 0`, o
fechamento lança uma **despesa** para o repasse não ser confundido com lucro:

```js
{ tipo: 'Repasse para equipe',   // = SAIDA_REPASSE (bate com SAIDA_TIPOS_PROF)
  dataPag: dataEvento, dataCaixa: dataEvento,
  valor: repasse, forma, status: 'Pendente', natureza: 'PROFISSIONAL',
  obs: 'Repasse {profissional} — {cliente} — Orçamento {id}' }
```

O sinal e o restante levam `responsavel` para o Financeiro conseguir mostrar
quem executou. Assim: **entrada** (cliente) − **saída** (repasse) = lucro real.

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
  (`qtd` = quantidade de atendimentos iguais; `duracao` em minutos, escolhida em
  horas no seletor). Flags internas (prefixo `_`, nunca persistidas):
  `_manual` (valor editado), `_durManual` (duração editada), `_cacheada`.
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
HHhMM - HHhMM | Nome Cliente | Serviço | Local          ← atendimento da Carol
EQUIPE | Juliana | HHhMM | Cliente: Nome | Serviço | Local   ← minha equipe
```

> ⚠️ O módulo Clientes lê `parts[0]` (horário) e `parts[1]` (nome). No formato
> EQUIPE essas posições mudam — o matching de horário **não** funciona para
> atendimentos da equipe. É aceitável (Clientes só exibe horário), mas se algum
> dia o matching passar a importar, ajustar `clientes.js` para detectar o prefixo.

`buildEventos(ctx)` recebe um objeto:
`{ nome, slots, endereco, total, sinal, saldo, telefone, equipe, responsavel,
   repasse, forma, obs, localTipo }`. A descrição sempre traz cliente, serviço,
data, horário, endereço, valores, forma de pagamento, sinal/restante, contato e
observações; nos atendimentos da equipe acrescenta **valor cobrado, repasse e
lucro** (`linhasRepasse`).

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
