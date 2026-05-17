# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview

**Meu Studio** — Gestão financeira e planejamento de beleza para maquiadora freelancer (Carol).

- **Type**: SPA multissistema, mobile-first (max-width 480px)
- **Language**: Portuguese (pt-BR)
- **Stack**: Vanilla HTML/CSS/JS — zero build step, zero bundler
- **Backend**: Supabase (PostgreSQL + Storage) — migração do GAS concluída
- **Storage**: Supabase como fonte da verdade + localStorage como cache
- **AI**: Claude API (Haiku) direto do browser com tool use

---

## Architecture

### Módulos

| Módulo | Path | Backend |
|--------|------|---------|
| **Hub** | `index.html` / `hub.html` | Estático |
| **Financeiro** | `financeiro/index.html` | Supabase `entries`, `noivas`, `saidas` |
| **Orçamentos** | `orcamentos/orcamentos_novo.html` | Supabase `orcamentos` + Storage `comprovantes` |
| **Clientes / Conteúdo** | `clientes/`, `conteudo/` | HTML estático (mínimo) |

### Data Flow (pós-migração)

```
Boot → localStorage (cache) → render()
     → loadFromSupabase() → Supabase → atualiza cache → render()

Write → localStorage imediato (UI responsiva)
      → sbCall() / postEntry() → Supabase async (fire-and-forget)
```

### Camada Supabase (`supabase-client.js`)

- Expõe `window.DB` com CRUD para cada tabela
- Mapeia camelCase JS ↔ snake_case DB automaticamente
- `DB.entries`, `DB.noivas`, `DB.saidas`, `DB.orcamentos`, `DB.storage`
- Lê credenciais de `window.ENV` (definido em `config.js`)

### Credenciais (`config.js` — gitignored)

```js
window.ENV = {
  SUPABASE_URL:  'https://xxx.supabase.co',
  SUPABASE_ANON: 'sb_publishable_...',
};
```
Template em `config.example.js`. **Nunca commitar `config.js`.**

---

## Tabelas Supabase

| Tabela | Campos-chave | Obs |
|--------|-------------|-----|
| `entries` | `id, data_pag, cliente, tipo, valor, auto, noiva_id` | `auto=true` → Restante Previsto gerado pelo sistema |
| `noivas` | `id, nome, data_casamento, valor_contrato` | FK referenciada por `entries.noiva_id` |
| `saidas` | `id, data_pag, tipo, valor, forma, status` | Despesas |
| `orcamentos` | `id, cliente, status, valor_prop, comprovantes (JSONB)` | — |
| **Storage bucket** | `comprovantes` | Bucket público; path: `{orca_id}/{cat}_{ts}.ext` |

RLS ativado com políticas permissivas para `anon` (proteção via tela de login do app).

---

## Critical Rules

### Fluxo Noiva
1. `saveNoiva()` cria automaticamente: entrada Sinal (`auto:false`) + Restante Previsto (`auto:true`)
2. Todo pagamento chama `recalcRestaNoiva(noivaId)` → recalcula a entrada `auto`
3. Pagamentos nunca ultrapassam `valorContrato`
4. Entradas `auto:true` **nunca deletar manualmente** — sistema remove se saldo = 0
5. Filtro de pagamentos noiva: `noivaId === n.id` OR `(origem='Noiva' && cliente match nome)`

### Sincronização Financeiro
- `sbCall({action, table, data|id|field})` — equivalente ao antigo `sheetCall`
- `action:'save'` → `upsert`; `action:'delete'` → delete; `action:'update'` → update parcial

### Orçamentos × Financeiro
- Ao fechar orçamento, `finEntryCreate(entry)` cria entradas de sinal/restante direto no Supabase entries
- Sem dependência do GAS financeiro

### Arquivo duplicado obrigatório
- `financeiro/index.html` é o arquivo **primário** (sempre editar aqui)
- `financeiro/entradas.html` é **cópia idêntica** — sincronizar após toda edição:
  ```
  cp financeiro/index.html financeiro/entradas.html
  ```

### File Truncation (Edit tool)
Para edições grandes, verificar integridade com PowerShell:
```powershell
$c = Get-Content 'financeiro/index.html' -Raw
if ($c -notmatch '</html>') { Write-Warning 'ARQUIVO TRUNCADO' }
```

---

## Login / Auth

- Credenciais em localStorage: `mk_user` (default: `carol`), `mk_pass` (default: `makeup2025`)
- Sessão: `mk_session: {expires: timestamp}` — 8h normal, 30 dias com "Lembrar"
- **Sem GAS** — autenticação é local, não usa rede

### Chave Claude IA
- Armazenada em `mk_claude_key` (localStorage)
- Configurada pelo usuário em ⚙️ → campo "Chave Claude IA"
- Obrigatória para o chat do Financeiro funcionar

---

## Claude AI Chat (Financeiro)

- **9 tools**: `add_entrada`, `add_saida`, `add_noiva`, `edit_entrada`, `delete_entrada`, `edit_saida`, `delete_saida`, `edit_noiva`, `delete_noiva`
- Nunca chamar `add_entrada` após `add_noiva` — sinal criado automaticamente
- `noivaId` obrigatório quando `origem='Noiva'`
- `disable_parallel_tool_use: true` — evita sinal duplicado
- Max 5 rounds de tool use por mensagem

---

## Key Files

| Arquivo | Função |
|---------|--------|
| `supabase-client.js` | Cliente Supabase compartilhado + mapeadores |
| `config.js` | Credenciais locais (gitignored) |
| `config.example.js` | Template de credenciais |
| `supabase-migration.sql` | DDL das 4 tabelas + RLS |
| `supabase-bucket-setup.sql` | Criação do bucket `comprovantes` + políticas |
| `migracao/migrar-dados.html` | Ferramenta one-time de migração de dados |
| `financeiro/index.html` | Financeiro — arquivo primário |
| `financeiro/entradas.html` | Financeiro — cópia (sempre sincronizar) |
| `orcamentos/orcamentos_novo.html` | Orçamentos — arquivo ativo |
| `financeiro/ESTADO_SISTEMA.md` | Histórico técnico detalhado |

---

## Roadmap

| Status | Item |
|--------|------|
| ✅ Concluído | Migração Google Sheets → Supabase |
| ✅ Concluído | Comprovantes Google Drive → Supabase Storage |
| ✅ Concluído | Login/auth desacoplado do GAS |
| 🔄 Próximo | GitHub + deploy Netlify (testes sem servidor local) |
| 🔄 Próximo | GitHub Actions + GitHub Pages (produção) |
| 🔄 Futuro | Modularização JS / build step |
