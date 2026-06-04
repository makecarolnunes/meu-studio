# CLAUDE.md — Financeiro

Módulo de controle financeiro (entradas, saídas, noivas, resumo). O mais complexo do sistema.

---

## Arquitetura de scripts (ordem obrigatória de carregamento)

```
state.js   → variáveis globais + constantes + localStorage cache
utils.js   → helpers: today(), brl(), genId(), toast(), updateDot()
auth.js    → checkAuth(), doLogin(), sessão mk_session
api.js     → loadFromSupabase(), sbCall(), normalizeE/S/N()
handlers.js→ postEntry(), postSaida(), deleteEntry(), deleteSaida()
noivas.js  → saveNoiva(), deleteNoiva(), recalcRestaNoiva(), toggleNoivaDetail()
modals.js  → openModal(), closeModal(), openConfig(), openChat()
views.js   → render(), renderNova(), renderLista(), renderSaidas(), renderNoivas(), renderResumo()
chat.js    → openChat(), sendChat(), renderChatMessages(), tool handlers
main.js    → go(), boot()
```

**Regra de ouro:** nunca reordenar os `<script>` no HTML — cada arquivo depende do anterior.

---

## Estado global (`state.js`)

| Variável | Tipo | Descrição |
|---|---|---|
| `entries` | `Entry[]` | Entradas financeiras (cache localStorage + fonte: Supabase) |
| `saidas` | `Saida[]` | Despesas (cache localStorage + fonte: Supabase) |
| `noivas` | `Noiva[]` | Contratos de noivas (cache localStorage + fonte: Supabase) |
| `screen` | `string` | Tab ativa: `'nova' \| 'lista' \| 'saidas' \| 'noivas' \| 'resumo'` |
| `selMonth`, `selYear` | `number` | Mês/ano selecionado na listagem |
| `listFilter` | `string` | Filtro da lista: `'todos' \| 'Realizado' \| 'Previsto' \| 'Noiva'` |
| `noivaDetail` | `string\|null` | ID da noiva com detalhe aberto |
| `F` | `object` | Form state da tela Nova Entrada |
| `Fs` | `object` | Form state da tela Nova Saída |
| `MEI_LIMITE` | `81000` | Limite anual MEI — usado no Resumo |

Cache keys localStorage: `mk_entries`, `mk_saidas`, `mk_noivas`.

---

## Fluxo de dados

```
Boot → checkAuth() → loadFromSupabase() → render()
                   ↘ falhou → usa localStorage (offline mode)

Write → array em memória (otimista) → render() → sbCall() async
Read  → Supabase via DB.entries/saidas/noivas.list()
```

### sbCall — wrapper de escrita

```js
sbCall({ action: 'save',   table: 'entries', data: encodeURIComponent(JSON.stringify(obj)) })
sbCall({ action: 'delete', table: 'entries', id: '123' })
sbCall({ action: 'update', table: 'entries', id: '123', field: 'status', value: 'Realizado' })
```

Sempre via `encodeURIComponent(JSON.stringify(...))` para `data`. Nunca chamar `DB.*` diretamente para writes — passar sempre por `sbCall`.

---

## Invariantes críticas — NUNCA violar

### Fluxo Noiva

1. `saveNoiva(noiva)` cria automaticamente:
   - Entrada **Sinal** (`auto: false`, `tipo: 'Sinal'`, `status: 'Previsto'` ou `'Realizado'`)
   - Entrada **Restante Previsto** (`auto: true`, `tipo: 'Pagamento'`, `status: 'Previsto'`)
2. Todo pagamento de noiva deve chamar `recalcRestaNoiva(noivaId)` — ela recalcula o restante e deleta se saldo = 0
3. Entradas com `auto: true` **nunca deletar manualmente** — o sistema remove quando saldo = 0
4. `recalcRestaNoiva` aceita tanto `id` quanto `nome` (fallback legacy)
5. Filtrar entradas de noiva: `entry.noivaId === n.id` **OU** `(entry.origem === 'Noiva' && entry.cliente.toLowerCase() === noiva.nome.toLowerCase())`

### postEntry / postSaida

- Sempre chamar `cacheEntries()` / `cacheSaidas()` depois de mutar o array
- Sempre chamar `render()` depois do cache
- Sempre chamar `sbCall()` depois do render (write é async, UI não espera)

---

## Claude AI Chat (`chat.js`)

**9 ferramentas disponíveis:**
- `add_entrada`, `add_saida`, `add_noiva`
- `edit_entrada`, `delete_entrada`
- `edit_saida`, `delete_saida`
- `edit_noiva`, `delete_noiva`

**Regras:**
- `disable_parallel_tool_use: true` — obrigatório, evita criar sinal duplicado
- Nunca chamar `add_entrada` após `add_noiva` — o sinal é criado automaticamente
- `noivaId` obrigatório em `add_entrada`/`edit_entrada` quando `origem === 'Noiva'`
- Máximo 5 rounds de tool use por mensagem
- Modelo: Claude Haiku (rápido, barato). API key em `mk_claude_key` (localStorage)

---

## Arquivos duplicados obrigatórios

```bash
cp financeiro/index.html financeiro/entradas.html   # após qualquer edição
```

Verificar truncamento antes do copy:
```powershell
$c = Get-Content 'financeiro/index.html' -Raw
if ($c -notmatch '</html>') { Write-Warning 'ARQUIVO TRUNCADO' }
```

---

## Saídas: duas datas (competência × banco)

Cada saída tem **duas datas** — não confundir:

| Campo | Significado |
|---|---|
| `dataPag` | **Vencimento / movimento bancário** — quando o dinheiro sai da conta. |
| `dataCaixa` | **Competência** — mês em que a despesa pesa no fluxo de caixa. |

- **Cartão (`forma === 'Crédito'`)**: a fatura vence em `dataPag`, mas é paga com o dinheiro do mês anterior → `dataCaixa = dataPag − 1 mês` (helper `defaultDataCaixa`/`prevMonth` em `utils.js`).
- **Demais formas**: `dataCaixa = dataPag`.
- O import OFX de fatura carimba `dataPag = data de pagamento da fatura` em todas as compras e deriva `dataCaixa` (mês anterior) em `fiscal-import.js`.
- **Toda agregação por mês de saída** usa `saidaBucketDate(s)` (respeita o toggle `saidasVisao`: `'caixa'` = competência, padrão · `'banco'` = vencimento). Nunca voltar a `getMonthYear(s.dataPag)` direto em Resumo/Saídas/Visão Anual.
- `saidaDataCaixa(s)` tem **fallback**: registro antigo sem `dataCaixa` recalcula na hora — o display fica correto mesmo antes do backfill.
- Migration: `sql/saidas-data-caixa.sql` (rodar manual no SQL Editor — migrations não rodam no deploy).

---

## Issues conhecidos / Tech debt

- `loadServicePricesFromSupabase()` em `api.js` busca preços da tabela `valores_servicos` mas não bloqueia o render (fire-and-forget). Se falhar, usa preços padrão hardcoded em `state.js`.
- O campo `dataServ` (data do atendimento) é diferente de `dataPag` (data do pagamento) — `views.js` usa `dataPag` para o mês mas `dataServ` para ordenação. Manter essa distinção ao editar filtros.
- `normalizeE(e)` garante que `auto` seja `boolean` (vem como string `'true'` da API legada).
- Não há paginação — todos os entries são carregados. OK até ~5000 registros.

---

## Roadmap / Melhorias planejadas

- [ ] Filtro por serviço/tipo na tela Lista
- [ ] Export CSV da tela Resumo
- [ ] Gráfico mensal no Resumo (linha de faturamento)
- [ ] Notificação de pagamentos Previstos vencendo
- [ ] Migrar `clientes/` para ler de `DB.entries` diretamente (atualmente lê de GAS)
- [ ] Adicionar campo `comissao_assistente` em entries para descontar do bruto
