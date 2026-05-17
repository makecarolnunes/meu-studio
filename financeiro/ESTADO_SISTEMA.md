# Estado Atual do Sistema — Financeiro da Maquiadora (Carol)

## Arquivos

- `index.html` — arquivo principal (sempre editar aqui)
- `entradas.html` — cópia idêntica (sempre sincronizar após editar)
- **~2023 linhas**, JS validado sem erros de sintaxe
- Caminho completo: `C:\Users\carol\OneDrive\Área de Trabalho\claude\Nova pasta\`

---

## Arquitetura

- **SPA single-file** HTML/CSS/JS, mobile-first, sem dependências externas
- **Backend**: Google Apps Script (GET-only, evita CORS preflight)
- **Storage**: `localStorage` como cache principal
- **IA**: Anthropic Claude API (`claude-haiku-4-5-20251001`) direto do browser com header `anthropic-dangerous-direct-browser-access: true`

### Chaves localStorage

| Chave | Conteúdo |
|-------|----------|
| `mk_entries` | array de entradas de receita |
| `mk_saidas` | array de saídas/despesas |
| `mk_noivas` | array de noivas |
| `mk_script_url` | URL do Google Apps Script |
| `mk_claude_key` | chave API Anthropic (`sk-ant-...`) |
| `mk_session` | `{expires: timestamp}` para controle de login |
| `mk_user` / `mk_pass` | credenciais customizadas (fallback padrão abaixo) |

---

## Login

- Tela de login protege o app (`id="login-screen"`; app começa `display:none`)
- **Credenciais padrão:** usuário `carol`, senha `makeup2025`
- `checkAuth()` roda no BOOT — sessão válida → `showApp()` direto
- `showApp()`: esconde login, mostra app, esconde spinner, chama `render()` + `loadFromSheets()`
- "Lembrar 30 dias" salva sessão longa; sem marcar = expira em 8h
- Logout: ⚙️ → "🚪 Sair da conta" → `doLogout()` → apaga `mk_session` → `location.reload()`

---

## Estrutura de Dados

### Entry (entrada de receita)
```js
{
  id,          // String — SEMPRE String (nunca Number)
  dataPag,     // YYYY-MM-DD
  dataServ,    // YYYY-MM-DD
  cliente,     // nome da cliente
  tipo,        // 'Sinal' | 'Parcela' | 'Pagamento'
  valor,       // String numérica
  valorTotal,  // String numérica (apenas para Sinal)
  servico,     // 'Maquiagem' etc
  local,       // 'Studio' etc
  forma,       // 'PIX' | 'Crédito' | 'Dinheiro'
  status,      // 'Realizado' | 'Previsto'
  origem,      // 'Produção Social' | 'Noiva' | 'Assistência' | 'Curso de Automaquiagem'
  obs,
  auto,        // Boolean — true = gerada pelo sistema (Restante Previsto)
  createdAt,   // ISO string
  noivaId      // String — ID da noiva vinculada (pode ser '' se não vinculado)
}
```

### Noiva
```js
{ id, nome, dataCasamento, valorContrato, obs, createdAt }
```

### Saída
```js
{ id, dataPag, tipo, valor, forma, status, obs, createdAt }
```

---

## Fluxo Noiva (crítico)

1. `saveNoiva()` ou `add_noiva` (chat) cria a noiva + entrada do sinal (`auto:false`) + entrada do restante previsto (`auto:true`)
2. A cada novo pagamento → `recalcRestaNoiva(noivaId ou nome)` recalcula e atualiza a entrada auto
3. Pagamentos nunca podem ultrapassar `valorContrato`
4. Entradas `auto:true` nunca devem ser excluídas manualmente — se recalc resultar em 0, ela é removida automaticamente

### Filtro renderNoivas (sem restrição de !e.noivaId)
```js
entries.filter(e =>
  e.noivaId === n.id ||
  (e.origem === 'Noiva' && e.cliente.trim().toLowerCase() === n.nome.trim().toLowerCase())
)
```

### buildContext — exclusão de auto em cálculos
```js
// Saldo restante exclui entradas auto
const pgM = pg.filter(e => !(e.auto === true || e.auto === 'true'));
```

---

## Chat IA — Tool Use

### 9 tools disponíveis
`add_entrada`, `add_saida`, `add_noiva`, `edit_entrada`, `delete_entrada`, `edit_saida`, `delete_saida`, `edit_noiva`, `delete_noiva`

### Regras críticas no system prompt
1. `add_noiva` cria sinal automaticamente — **nunca** chamar `add_entrada` logo depois
2. Para parcela de noiva já cadastrada: `add_entrada` com `noivaId` correto
3. Pagamentos de noiva nunca ultrapassam `saldoRestante` do contrato
4. `noivaId` obrigatório quando `origem="Noiva"`
5. Entradas `auto:true` (Restante Previsto) nunca devem ser excluídas diretamente
6. Para excluir/editar: usar o `id` exato listado nos dados (tipo diferencia entradas com mesmo valor)

### Configuração da API
```js
{
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 1024,
  tool_choice: { type: 'auto', disable_parallel_tool_use: true },
  // disable_parallel_tool_use evita duplicação de sinal ao cadastrar noiva
}
```

### Loop de tool use em sendChat()
```js
while (data.stop_reason === 'tool_use' && rounds < 5) {
  // executa tools, chama API novamente com resultados
}
```

### buildContext() injeta no system prompt
- Resumo do mês (faturamento real/previsto, despesas)
- Faturamento anual
- Todas as noivas com pagamentos **incluindo IDs e forma**
- Últimas 20 entradas (não-auto)
- Últimas 10 saídas

---

## Funções Importantes

| Função | Descrição |
|--------|-----------|
| `checkAuth()` | Verifica sessão no BOOT, mostra login ou app |
| `showApp()` | Esconde login, mostra app, chama render() + loadFromSheets() |
| `doLogin()` | Valida credenciais, salva sessão, chama showApp() |
| `doLogout()` | Remove sessão, recarrega página |
| `render()` | Renderiza a tela atual (screen = nova/lista/saidas/resumo/noivas) |
| `recalcRestaNoiva(idOuNome)` | Recalcula entrada auto de restante previsto |
| `executeChatTool(name, input)` | Executa tool do chat, retorna string de resultado |
| `buildContext()` | Monta JSON com dados financeiros para o system prompt |
| `callClaudeAPI(messages)` | Chama API Anthropic com tools |
| `sendChat()` | Loop completo de envio + tool use + resposta |
| `closeChat()` | Fecha modal do chat e chama render() |
| `normalizeE(e)` | Normaliza entrada: converte id para String, auto para Boolean |
| `normalizeS(s)` | Normaliza saída: converte id para String |
| `normalizeN(n)` | Normaliza noiva: converte id para String |

---

## BOOT (final do arquivo — nunca alterar)

```js
// BOOT
entries = entries.map(normalizeE);
noivas  = noivas.map(normalizeN);
initF(); initFs();
checkAuth();
</script>
</body>
</html>
```

---

## Problema Recorrente: Truncamento do Arquivo

O Edit tool tem limite de tamanho e trunca o final do arquivo a cada edição grande.

### Como verificar
```bash
python3 -c "
import re
with open('index.html', encoding='utf-8') as f: c = f.read()
match = re.search(r'<script>(.*?)</script>', c, re.DOTALL)
with open('/tmp/app.js','w') as f: f.write(match.group(1))
print('script tags:', c.count('<script>'), c.count('</script>'))
"
node --check /tmp/app.js
```

### Como corrigir truncamento
```python
with open('index.html', encoding='utf-8') as f:
    content = f.read()

boot_idx = content.rfind('\n// BOOT')
after = content[boot_idx:]

if '</html>' not in after:
    base = content[:boot_idx]
    ending = """
// BOOT
entries = entries.map(normalizeE);
noivas  = noivas.map(normalizeN);
initF(); initFs();
checkAuth();
</script>
</body>
</html>
"""
    content = base + ending
    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(content)
```

### Regra para evitar truncamento
- **Nunca usar Edit tool para substituições longas** (mais de ~30 linhas de new_string)
- **Usar Python** para appends e reconstruções de final de arquivo
- Sempre validar com `node --check` após qualquer edição
- Sempre copiar para `entradas.html` após validar

---

## Bugs Corrigidos (histórico desta sessão)

1. **Arquivo truncado repetidamente** — Edit tool cortava o arquivo; solução: Python reconstrói o final
2. **JS não carregava** — `}` duplicada no `executeChatTool` travava o script inteiro
3. **Login não funcionava** — `doLogin()` não existia; `showApp()` não chamava `render()`
4. **Spinner eterno** — `loadFromSheets()` não escondia o overlay quando sem URL configurada
5. **`logout` vs `doLogout`** — nome inconsistente entre HTML e JS
6. **Parcela excluída via chat não refletia no card** — `closeChat()` não chamava `render()`
7. **IDs do Sheets vinham como Number** — comparação `===` falhava silenciosamente; corrigido com `String(id)`
8. **`normalizeE/S/N`** — agora convertem `id` para String na carga de dados
9. **sendChat() truncado** — bloco `catch/finally` estava faltando; corrigido com Python
