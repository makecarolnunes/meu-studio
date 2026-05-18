# CLAUDE.md — Clientes

Módulo de visualização de atendimentos por mês. **Somente leitura** — não escreve dados, apenas consome entries do financeiro e eventos do Google Agenda.

---

## Arquivos

| Arquivo | Papel |
|---|---|
| `index.html` | HTML + carregamento de scripts |
| `styles/clientes.css` | CSS do módulo |
| `scripts/clientes.js` | Toda a lógica: load, render, matching de horário |

---

## Fontes de dados

| Dado | Origem | Como carrega |
|---|---|---|
| Atendimentos | `localStorage['mk_entries']` + fallback GAS | `loadSheets()` via fetch ao GAS URL |
| Horários | Google Agenda via MCP `list_events` | `loadCalendar()` |

### Migração pendente: GAS → Supabase

`loadSheets()` ainda busca entries via Google Apps Script (`SCRIPT_URL`). O objetivo é migrar para `DB.entries.list()` diretamente. Quando feito:
1. Remover `SCRIPT_URL` e `DEFAULT_URL`
2. Substituir `loadSheets()` por `await DB.entries.list()`
3. Adicionar `checkAuth()` no boot (atualmente não tem auth)

---

## Deduplicação de atendimentos

Um cliente pode ter múltiplas entries no mesmo dia (sinal + restante + pagamento parcelado). A visão de Clientes mostra **um card por atendimento** (par cliente+data).

```js
const key = `${entry.dataServ || entry.dataPag}|${norm(entry.cliente)}`;
```

Critério de preferência quando há múltiplas entries para o mesmo par:
- Se qualquer entry tem `status === 'Realizado'` → o atendimento é Realizado
- Caso contrário → Previsto

---

## Matching de horário (Google Agenda)

`matchHorario(entry)` tenta associar um horário do calendário ao atendimento:

1. Busca eventos do mês via MCP com `calendarId = CAL_ID`
2. Formatos de título do evento esperados: `"HHhMM - HHhMM | Nome | Serviço | Local"`
3. Match por nome: exact → contains → first-name fallback (mínimo 3 chars)
4. Resultado armazenado em `calMap[dateStr] = [{ time, rawClient }]`

Se o MCP não estiver disponível (`!window.cowork`), `loadCalendar()` retorna sem fazer nada — atendimentos ficam sem horário (exibe `—`).

O `CAL_ID` está hardcoded em `clientes.js`. Se a agenda mudar, atualizar lá.

---

## Status do atendimento

```js
function statusDoAtendimento(entry) {
  const dateServ = entry.dataServ || entry.dataPag;
  if (dateServ && dateServ > todayStr()) return 'Previsto';  // data futura = sempre Previsto
  return entry.status || 'Previsto';
}
```

**Regra:** data futura sempre é Previsto, independente do status salvo (pode ter pago o sinal mas o serviço ainda não aconteceu).

---

## SRV_ICON — ícones de serviço

```js
const _I = { star: '...svg...', scissors: '...svg...', book: '...svg...' };
const SRV_ICON = {
  'Maquiagem': _I.star, 'Cabelo': _I.scissors, 'Maquiagem e Cabelo': _I.star,
  // ...demais variações
};
```

Default quando serviço não está no map: `'💅'` (emoji) — considerar padronizar para SVG.

---

## Issues conhecidos

- **Sem auth guard:** `clientes.js` não chama `checkAuth()` — qualquer pessoa com a URL pode ver a página (a sessão não é verificada). Adicionar ao boot.
- **GAS dependency:** se o `SCRIPT_URL` falhar ou expirar, o módulo exibe dados do localStorage ou fica em branco. Migrar para `DB.entries` resolve.
- Filtro "Noiva" usa `e.origem === 'Noiva'` — entries criadas pelo orçamento usam `origem: 'Noiva'`, mas entries antigas do GAS podem ter variações. `norm()` não é aplicado aqui.
- A variável `curFilter` é inicializada como `'todos'` e o filtro "Noiva" usa comparação direta com `origem`, não com o status.

---

## Roadmap

- [ ] Migrar fonte de dados de GAS → `DB.entries.list()`
- [ ] Adicionar `checkAuth()` no boot
- [ ] Tela de detalhe do cliente (histórico de visitas ao longo do tempo)
- [ ] Estatísticas: cliente mais frequente, ticket médio por serviço
- [ ] Busca por nome de cliente
- [ ] Integrar com módulo Tarefas (ex: criar follow-up automático)
