-- ════════════════════════════════════════════════════════════════
--  Instagram Dashboard — tabelas Supabase
--  Sincroniza Validações, Análise IA, Concorrentes e Inputs Manuais
--  entre devices (mobile + desktop) usando Supabase como fonte da verdade.
--
--  COMO RODAR:
--  1. Acesse o Supabase do projeto: https://supabase.com/dashboard
--  2. Vá em SQL Editor
--  3. Cole TODO o conteúdo deste arquivo
--  4. Clique em "Run"
-- ════════════════════════════════════════════════════════════════

-- ── Tabela: validações do Validador de Post ──────────────────
CREATE TABLE IF NOT EXISTS instagram_validations (
  id           TEXT PRIMARY KEY,
  generated_at TIMESTAMPTZ NOT NULL,
  inputs       JSONB NOT NULL,
  result       JSONB NOT NULL,
  usage_json   JSONB,
  revisions    JSONB DEFAULT '[]'::jsonb,  -- histórico de reavaliações (snapshots leves)
  chat         JSONB DEFAULT '[]'::jsonb,  -- conversa de aprofundamento da análise
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- Para tabelas já existentes (instalações antigas), rode também:
--   supabase-instagram-reavaliacao-chat.sql

CREATE INDEX IF NOT EXISTS idx_instagram_validations_generated_at
  ON instagram_validations (generated_at DESC);

-- RLS: leitura/escrita abertas para anon (mesmo padrão das outras tabelas do projeto)
ALTER TABLE instagram_validations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_all_validations" ON instagram_validations;
CREATE POLICY "anon_all_validations" ON instagram_validations
  FOR ALL USING (true) WITH CHECK (true);


-- ── Tabela: estado singleton (analysis, competitors, manual_inputs) ──
CREATE TABLE IF NOT EXISTS instagram_state (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE instagram_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_all_state" ON instagram_state;
CREATE POLICY "anon_all_state" ON instagram_state
  FOR ALL USING (true) WITH CHECK (true);


-- ── Verificação ──────────────────────────────────────────────
-- Após rodar, confira no painel se as tabelas aparecem em
-- Database → Tables. Devem aparecer:
--   • instagram_validations
--   • instagram_state
