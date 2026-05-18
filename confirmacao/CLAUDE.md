# CLAUDE.md — Confirmação de Agendamento

Módulo de geração de mensagens de confirmação e criação de eventos no Google Agenda. **Sem backend** — não lê nem escreve no Supabase. Formulário client-side puro.

---

## Arquivos

| Arquivo | Papel |
|---|---|
| `confirmacao.html` | Arquivo ativo |
| `index.html` | Redirect para `confirmacao.html` |
| `styles/confirmacao.css` | CSS do módulo |
| `scripts/confirmacao.js` | Toda a lógica |

---

## Dois modos de operação

### Modo Único (`modoAtual === 'unico'`)
- Um cliente, uma ou mais datas
- Campos: Nome, Telefone, Serviço, Datas[] (data + horário)
- `datas[]` array dinâmico — min 1, sem máximo

### Modo Múltiplos (`modoAtual === 'multiplos'`)
- Vários clientes em sequência (ex: dia de casamento com comitiva)
- `itens[]` array de `{ nome, telefone, servico, data, horario }`
- Cada item gera um evento separado no Google Agenda

---

## Estado global

```js
var modoAtual = 'unico';    // 'unico' | 'multiplos'
var tipoEnd   = 'studio';   // 'studio' | 'domicilio'
var datas     = [];         // [{ id, data, horario }] — modo único
var itens     = [];         // [{ id, nome, tel, serv, data, horario }] — modo múltiplos
```

---

## Endereço

```js
var END_STUDIO = 'Rua Barão de Itapagipe, 445, apt 702 bloco A, Tijuca';
```

**Fix necessário:** esse endereço está hardcoded. Considerar mover para localStorage com campo editável nas configurações, assim não precisa de deploy para atualizar.

---

## Duração dos serviços

```js
var DUR = { 'Maquiagem': 60, 'Cabelo': 60, 'Maquiagem e Cabelo': 120 }; // minutos
```

Usado para calcular o horário de término do evento. Se um serviço não estiver no mapa, a duração é `0` (evento instantâneo) — adicionar fallback.

---

## Formato do título do evento Google Agenda

```
10h00 - 11h00 | Nome Cliente | Serviço | Local
```

Este formato é **consumido pelo módulo Clientes** (`clientes.js`) para matching de horários. Não alterar o padrão sem atualizar o parser em `clientes.js`.

Parsing em `clientes.js`:
```js
const parts = title.split(' | ');
const rawTime = parts[0].trim().split(' - ')[0].trim();
const time = rawTime.replace(/(\d{1,2})h(\d{2})/, '$1:$2');
const rawClient = parts[1]?.trim();
```

---

## Google Agenda — dois modos de criação

### Modo Link (`btnModeLink`)
Gera URL `https://calendar.google.com/calendar/render?action=TEMPLATE&...` e abre em nova aba. Não requer MCP — sempre funciona.

### Modo Direto (`btnModeDireto`)
Usa `window.cowork.callMcpTool('mcp__...__create_event', {...})`. Requer Claude Code com integração Google Calendar ativa. O toggle `gcalModeToggle` é ocultado automaticamente se `!coworkDisponivel`.

`coworkDisponivel` é definido verificando `typeof window.cowork !== 'undefined'`.

---

## Geração da mensagem WhatsApp

`gerarMensagem()` retorna string formatada com:
- Saudação com nome
- Data(s) por extenso (ex: "sábado, 15 de junho de 2024")
- Horário, serviço, local/endereço
- Valores (se preenchidos)
- Texto fixo de confirmação

A mensagem é exibida em `.mensagem-preview` e copiada via `navigator.clipboard.writeText()`.

---

## Issues conhecidos

- Endereço do Studio hardcoded (`END_STUDIO`) — considerar configurável
- Duração sem fallback para serviços não mapeados (evento sem fim definido)
- O MCP ID do Google Calendar está hardcoded — se mudar, precisa de deploy
- Não há validação de sobreposição de horários — dois atendimentos podem ser agendados no mesmo horário sem aviso
- Modo Múltiplos não suporta datas diferentes por item (todos ficam na mesma data do slot)

---

## Roadmap

- [ ] Endereço configurável via localStorage/settings
- [ ] Verificação de conflito de horário via Google Calendar (listar eventos do dia antes de criar)
- [ ] Mensagem de lembrete automático (enviar D-1 via WhatsApp link)
- [ ] Integrar com módulo Orçamentos: puxar dados do orçamento fechado direto
- [ ] Salvar histórico de confirmações enviadas
