-- ════════════════════════════════════════════════════════════════
-- Meu Studio — Módulo Fiscal/Tributário (Sprint 1)
--
-- Tabelas:
--   fiscal_config  → configuração fiscal (regime, teto, abertura)
--   fiscal_das     → controle DAS mensal MEI (usado a partir Sprint 2)
--
-- NÃO altera nenhuma tabela existente (entries, noivas, saidas,
-- orcamentos, usuarios). Pode ser revertido com DROP TABLE sem
-- afetar o sistema financeiro atual.
--
-- Como rodar: SQL Editor do Supabase, copiar e executar tudo.
-- Como reverter: DROP TABLE fiscal_das; DROP TABLE fiscal_config;
-- ════════════════════════════════════════════════════════════════

-- ── 1. fiscal_config (singleton por usuário) ────────────────────
CREATE TABLE IF NOT EXISTS fiscal_config (
  id            text PRIMARY KEY DEFAULT 'default',
  regime        text NOT NULL DEFAULT 'MEI'
                CHECK (regime IN ('MEI','SIMPLES','AUTONOMO')),
  teto_anual    numeric(12,2) NOT NULL DEFAULT 81000,
  data_abertura date,
  cnpj          text,
  atividade     text,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE fiscal_config IS
  'Singleton — id=default. Regime fiscal, teto anual configurável, data de abertura para cálculo proporcional no 1º ano.';

-- ── 2. fiscal_das (controle DAS mensal) ─────────────────────────
CREATE TABLE IF NOT EXISTS fiscal_das (
  id              text PRIMARY KEY,
  competencia     date NOT NULL,        -- sempre YYYY-MM-01
  valor           numeric(10,2) NOT NULL DEFAULT 0,
  vencimento      date NOT NULL,
  pago            boolean NOT NULL DEFAULT false,
  data_pagamento  date,
  comprovante_url text,
  observacao      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (competencia)
);

CREATE INDEX IF NOT EXISTS idx_fiscal_das_competencia
  ON fiscal_das (competencia DESC);

COMMENT ON TABLE fiscal_das IS
  'Histórico DAS mensal. competencia é a chave natural (1 DAS por mês).';

-- ── 3. RLS ──────────────────────────────────────────────────────
-- Padrão do projeto: tabelas abertas para a chave anon (mesma
-- abordagem de entries/noivas/saidas/orcamentos). Auth real é via
-- mk_session no front + RPC autenticar() para login.
ALTER TABLE fiscal_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_das    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon all" ON fiscal_config;
CREATE POLICY "anon all" ON fiscal_config
  FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon all" ON fiscal_das;
CREATE POLICY "anon all" ON fiscal_das
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- ── 4. Seed (config default — só se vazia) ──────────────────────
INSERT INTO fiscal_config (id, regime, teto_anual)
VALUES ('default', 'MEI', 81000)
ON CONFLICT (id) DO NOTHING;

-- ════════════════════════════════════════════════════════════════
-- SPRINT 1.5 — natureza em saidas
--
-- Coluna opcional e nullable. Linhas antigas continuam funcionando
-- (default 'PROFISSIONAL'). Reversível: ALTER TABLE saidas DROP
-- COLUMN natureza;
--
-- Possíveis valores: 'PROFISSIONAL' | 'PESSOAL' | 'MISTA'
-- ════════════════════════════════════════════════════════════════
ALTER TABLE saidas
  ADD COLUMN IF NOT EXISTS natureza text DEFAULT 'PROFISSIONAL';

-- Marca explicitamente as linhas existentes (idempotente).
UPDATE saidas SET natureza = 'PROFISSIONAL' WHERE natureza IS NULL;

-- ════════════════════════════════════════════════════════════════
-- SPRINT 2 — Import bancário + Despesas + Aprendizado
-- ════════════════════════════════════════════════════════════════

-- ── fiscal_transacoes_raw ───────────────────────────────────────
-- Transações brutas vindas do extrato. Camada isolada — nada aqui
-- modifica entries/saidas até o usuário aprovar.
CREATE TABLE IF NOT EXISTS fiscal_transacoes_raw (
  id                   text PRIMARY KEY,
  importacao_id        text NOT NULL,
  banco                text,
  conta                text,
  data                 date NOT NULL,
  descricao            text NOT NULL,
  valor                numeric(12,2) NOT NULL,          -- positivo=crédito, negativo=débito
  tipo_mov             text CHECK (tipo_mov IN ('CREDITO','DEBITO')),
  hash                 text NOT NULL,                    -- dedup
  status               text NOT NULL DEFAULT 'PENDENTE',
  categoria_sugerida   text,
  natureza_sugerida    text,
  confianca_ia         numeric(3,2),
  saida_id             text,                             -- quando vira saida nova
  saida_existente_id   text,                             -- quando vinculado a saida já existente
  despesa_id           text,                             -- quando vira fiscal_despesa
  raw_data             jsonb,
  created_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hash)
);

CREATE INDEX IF NOT EXISTS idx_fiscal_raw_imp     ON fiscal_transacoes_raw (importacao_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_raw_data    ON fiscal_transacoes_raw (data DESC);
CREATE INDEX IF NOT EXISTS idx_fiscal_raw_status  ON fiscal_transacoes_raw (status);

-- ── fiscal_despesas ─────────────────────────────────────────────
-- Espelho fiscal das saídas. 1 despesa = 1 saida (mesmo id ref). Tabela
-- separada pra guardar metadados fiscais (dedutível, categoria fiscal,
-- origem, link com raw) sem inchar saidas.
CREATE TABLE IF NOT EXISTS fiscal_despesas (
  id                text PRIMARY KEY,
  saida_id          text,                                -- FK lógica → saidas.id
  data              date NOT NULL,
  descricao         text,
  valor             numeric(12,2) NOT NULL,
  categoria         text,                                -- ex: 'Deslocamento'
  natureza          text NOT NULL DEFAULT 'PROFISSIONAL',-- PROFISSIONAL|PESSOAL|MISTA
  dedutivel         boolean NOT NULL DEFAULT false,
  origem            text NOT NULL DEFAULT 'manual',      -- manual|ofx|csv|pluggy
  transacao_raw_id  text,                                -- FK lógica → fiscal_transacoes_raw.id
  comprovante_url   text,
  obs               text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fiscal_desp_data ON fiscal_despesas (data DESC);
CREATE INDEX IF NOT EXISTS idx_fiscal_desp_cat  ON fiscal_despesas (categoria);
CREATE INDEX IF NOT EXISTS idx_fiscal_desp_saida ON fiscal_despesas (saida_id);

-- ── fiscal_regras (aprendizado) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS fiscal_regras (
  id          text PRIMARY KEY,
  padrao      text NOT NULL,                              -- substring lowercase, ex: 'uber'
  categoria   text NOT NULL,
  natureza    text NOT NULL,
  prioridade  int  NOT NULL DEFAULT 0,
  origem      text NOT NULL DEFAULT 'manual',             -- manual|ia
  acertos     int  NOT NULL DEFAULT 0,
  erros       int  NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fiscal_regras_padrao ON fiscal_regras (padrao);

-- ── RLS ─────────────────────────────────────────────────────────
ALTER TABLE fiscal_transacoes_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_despesas       ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_regras         ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon all" ON fiscal_transacoes_raw;
CREATE POLICY "anon all" ON fiscal_transacoes_raw
  FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon all" ON fiscal_despesas;
CREATE POLICY "anon all" ON fiscal_despesas
  FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon all" ON fiscal_regras;
CREATE POLICY "anon all" ON fiscal_regras
  FOR ALL TO anon USING (true) WITH CHECK (true);
