# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview

**Meu Studio** — Gestão financeira e planejamento de beleza para maquiadora freelancer (Carol).

- **Type**: SPA multissistema, mobile-first (max-width 480px)
- **Language**: Portuguese (pt-BR)
- **Stack**: Vanilla HTML/CSS/JS — zero build step, zero bundler
- **Backend**: Supabase (PostgreSQL + Storage)
- **Storage**: Supabase como fonte da verdade + localStorage como cache
- **AI**: Claude API (Haiku) direto do browser com tool use

---

## Architecture

### Módulos e Rotas

| Módulo | Path (GitHub Pages) | Backend |
|--------|---------------------|---------|
| **Hub / Login** | `/` | Auth Supabase + estático |
| **Financeiro** | `/financeiro/` | Supabase `entries`, `noivas`, `saidas` |
| **Orçamentos** | `/orcamentos/` | Supabase `orcamentos` + Storage `comprovantes` |
| **Clientes** | `/clientes/` | HTML estático |
| **Agendamentos** | `/confirmacao/` | HTML estático |
| **Conteúdo** | `/conteudo/` | HTML estático |

> `hub.html` é o arquivo **editável** do hub. `index.html` é sempre uma cópia (`cp hub.html index.html`). Pastas sem `index.html` próprio têm um redirect para o arquivo ativo.

### Data Flow

```
Boot módulo → checkAuth() → sessão válida? → carrega dados
                          → inválida/ausente → redireciona para /

Hub → login → DB.auth.login() → RPC autenticar() Supabase
            → sessão criada em localStorage (mk_session)
            → todos os módulos passam a aceitar a sessão

Write → localStorage imediato (UI responsiva)
      → sbCall() / postEntry() → Supabase async
```

### Camada Supabase (`shared/js/db.js`)

Expõe `window.DB`:
- `DB.entries`, `DB.noivas`, `DB.saidas`, `DB.orcamentos` — CRUD com mapeadores camelCase ↔ snake_case
- `DB.storage.uploadComprovante()`, `DB.storage.deleteComprovante()` — Supabase Storage
- `DB.auth.login(usuario, senha)` — SHA-256 da senha + RPC `autenticar()`

Lê credenciais de `window.ENV` (definido em `config.js`, gitignored).
Em produção, `config.js` é gerado pelo GitHub Action a partir dos Secrets do repositório.

---

## Tabelas Supabase

| Tabela | Campos-chave | Obs |
|--------|-------------|-----|
| `usuarios` | `id, usuario, senha_hash, nivel, ativo` | Auth centralizada; acesso só via RPC `autenticar()` |
| `entries` | `id, data_pag, cliente, tipo, valor, auto, noiva_id` | `auto=true` → Restante Previsto gerado pelo sistema |
| `noivas` | `id, nome, data_casamento, valor_contrato` | FK em `entries.noiva_id` |
| `saidas` | `id, data_pag, tipo, valor, forma, status` | Despesas |
| `orcamentos` | `id, cliente, status, valor_prop, comprovantes (JSONB)` | — |
| **Storage** | bucket `comprovantes` | Público; path: `{orca_id}/{cat}_{ts}.ext` |

RLS ativo em todas as tabelas. `usuarios` não tem política para `anon` — acesso exclusivo via função `SECURITY DEFINER`.

### Gerenciar usuários (SQL Editor Supabase)
```sql
-- Adicionar usuário
INSERT INTO usuarios (usuario, senha_hash, nivel)
VALUES ('nome', encode(digest('senha', 'sha256'), 'hex'), 'view');

-- Desativar usuário
UPDATE usuarios SET ativo = FALSE WHERE usuario = 'nome';

-- Alterar senha
UPDATE usuarios SET senha_hash = encode(digest('nova_senha', 'sha256'), 'hex')
WHERE usuario = 'nome';
```
Níveis disponíveis: `'admin'` (acesso total) · `'view'` (reservado para uso futuro).

---

## Auth

### Fluxo completo
1. **Hub** (`/`) é o único ponto de login
2. `doLogin()` chama `DB.auth.login(usuario, senha)`
3. `shared/js/db.js` computa SHA-256 da senha via Web Crypto API e chama RPC `autenticar()`
4. Sucesso → `mk_session: {expires, usuario, nivel}` salvo no localStorage
5. Todos os módulos chamam `checkAuth()` no boot:
   - Sessão válida → carrega normalmente
   - Sem sessão ou expirada → `window.location.href = '../'`

### Sessão
- Duração: 8h padrão · 30 dias com "Lembrar"
- Chave localStorage: `mk_session` — **não armazena senha nem hash**
- Logout: remove `mk_session` → redireciona ao hub

### Chave Claude IA
- Armazenada em `mk_claude_key` (localStorage)
- Configurável em ⚙️ no módulo Financeiro
- Obrigatória para o chat IA funcionar

---

## Critical Rules

### Fluxo Noiva
1. `saveNoiva()` cria automaticamente: Sinal (`auto:false`) + Restante Previsto (`auto:true`)
2. Todo pagamento chama `recalcRestaNoiva(noivaId)` → recalcula a entrada `auto`
3. Pagamentos nunca ultrapassam `valorContrato`
4. Entradas `auto:true` **nunca deletar manualmente** — sistema remove se saldo = 0
5. Filtro: `noivaId === n.id` OR `(origem='Noiva' && cliente match nome)`

### Sincronização Financeiro
- `sbCall({action, table, data|id|field})` — wrapper Supabase
- `action:'save'` → upsert · `action:'delete'` → delete · `action:'update'` → update parcial

### Orçamentos × Financeiro
- Ao fechar orçamento: `finEntryCreate(entry)` cria entradas direto no Supabase `entries`

### Arquivos duplicados obrigatórios
```bash
cp hub.html index.html                           # após editar hub
cp financeiro/index.html financeiro/entradas.html  # após editar financeiro
```

### File Truncation (Edit tool)
```powershell
$c = Get-Content 'financeiro/index.html' -Raw
if ($c -notmatch '</html>') { Write-Warning 'ARQUIVO TRUNCADO' }
```

---

## Claude AI Chat (Financeiro)

- **9 tools**: `add_entrada`, `add_saida`, `add_noiva`, `edit_entrada`, `delete_entrada`, `edit_saida`, `delete_saida`, `edit_noiva`, `delete_noiva`
- Nunca chamar `add_entrada` após `add_noiva` — sinal criado automaticamente
- `noivaId` obrigatório quando `origem='Noiva'`
- `disable_parallel_tool_use: true` — evita sinal duplicado
- Max 5 rounds de tool use por mensagem

---

## Estrutura de pastas

Padrão **Feature-Sliced**: cada módulo é uma fatia vertical (HTML +
`styles/` + `scripts/`). Infra reutilizável fica em `shared/`. Scripts
globais ordenados (sem build step, sem ES modules).

```
.
├── index.html / hub.html         ← Hub (entry point)
├── config.js / config.example.js ← credenciais (gitignored)
├── hub-assets/{styles,scripts}/  ← assets do Hub
├── shared/
│   ├── css/{tokens,base}.css     ← design tokens + reset global
│   └── js/
│       ├── db.js                 ← cliente Supabase (window.DB)
│       ├── icons.js              ← SVG icons (window.SVG)
│       └── sidebar.js            ← sidebar global
├── financeiro/
│   ├── index.html / entradas.html
│   ├── styles/financeiro.css
│   └── scripts/                  ← state, utils, auth, api, handlers,
│       └── … (10 arquivos)         noivas, modals, views, chat, main
├── orcamentos/
│   ├── orcamentos_novo.html
│   ├── styles/orcamentos.css
│   └── scripts/orcamentos.js
├── clientes/      ↳ styles/clientes.css      scripts/clientes.js
├── confirmacao/   ↳ styles/confirmacao.css   scripts/confirmacao.js
└── conteudo/      ↳ styles/conteudo.css      scripts/conteudo.js
```

**Regra de ordem dos `<script>`** em cada módulo:
1. `supabase-js` (CDN) — define `window.supabase`
2. `config.js` — define `window.ENV`
3. `shared/js/db.js` — usa `window.ENV` e expõe `window.DB`
4. `shared/js/icons.js` — define `window.SVG`
5. Scripts do módulo (state → utils → api → handlers → views → main)
6. `shared/js/sidebar.js` (último, depende do DOM pronto)

| Arquivo | Função |
|---------|--------|
| `hub.html` / `index.html` | Hub — sempre sincronizar (`cp hub.html index.html`) |
| `shared/js/db.js` | Cliente Supabase: CRUD, Storage, Auth |
| `shared/js/icons.js` | SVG icons reutilizáveis (window.SVG) |
| `config.js` | Credenciais locais — **gitignored, nunca commitar** |
| `config.example.js` | Template de credenciais |
| `.github/workflows/deploy.yml` | CI/CD: injeta `config.js` via Secrets → publica Pages |
| `supabase-migration.sql` | DDL: 4 tabelas de dados + RLS |
| `supabase-auth.sql` | DDL: tabela `usuarios` + função `autenticar()` |
| `supabase-bucket-setup.sql` | Storage: bucket `comprovantes` + políticas |
| `supabase-valores-servicos.sql` | DDL: tabela `valores_servicos` (preços) |
| `migracao/migrar-dados.html` | Ferramenta one-time de migração |
| `financeiro/index.html` | Financeiro — primário (entradas.html = cópia) |
| `orcamentos/orcamentos_novo.html` | Orçamentos — arquivo ativo |

---

## Deploy

- **Repositório**: GitHub privado — `makecarolnunes/meu-studio`
- **Produção**: GitHub Pages — URL em Settings → Pages do repositório
- **CI/CD**: push em `main` → Action cria `config.js` dos Secrets → publica
- **Secrets**: `SUPABASE_URL` e `SUPABASE_ANON` — configurar em Settings → Secrets → Actions

---

## Roadmap

| Status | Item |
|--------|------|
| ✅ | Migração Google Sheets → Supabase |
| ✅ | Comprovantes Google Drive → Supabase Storage |
| ✅ | GitHub Pages + GitHub Actions (CI/CD) |
| ✅ | Roteamento por pasta (URLs limpas) |
| ✅ | Auth centralizada no Hub — Supabase `usuarios` + SHA-256 |
| 🔄 | Testar app completo em produção |
| 🔄 | Modularização JS / build step |

---

<!-- AUTO: 2026-05-27 00:18 | main | fix(conteudo): corrige scroll do mouse no desktop -->

