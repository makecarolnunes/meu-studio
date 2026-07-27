-- ─────────────────────────────────────────────────────────────
--  DDL: valores_servicos
--  Rodar manualmente no SQL Editor do Supabase
--
--  Tabela unificada de preços usada por:
--    • financeiro/  → lookup auto-fill por (servico, local) via "nome composto"
--    • orcamentos/  → lista de serviços com duração
--
--  ATENÇÃO: se a tabela antiga já existia, este script a recria.
--  Faça backup antes se tiver dados importantes lá.
-- ─────────────────────────────────────────────────────────────

DROP TABLE IF EXISTS valores_servicos CASCADE;

CREATE TABLE valores_servicos (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       TEXT         NOT NULL UNIQUE,
  valor      NUMERIC(10,2) NOT NULL DEFAULT 0,
  duracao    INTEGER,                                  -- minutos (opcional, usado p/ orçamentos)
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- RLS — o app usa anon key com auth própria (tabela usuarios + RPC autenticar)
ALTER TABLE valores_servicos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_select" ON valores_servicos
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_insert" ON valores_servicos
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_update" ON valores_servicos
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "anon_delete" ON valores_servicos
  FOR DELETE TO anon USING (true);

-- ─────────────────────────────────────────────────────────────
--  Dados iniciais — mesmas linhas dos DEFAULT_SERVICES do orçamentos
--  + variações usadas pelo financeiro
-- ─────────────────────────────────────────────────────────────
INSERT INTO valores_servicos (nome, valor, duracao) VALUES
  ('Maquiagem no Studio',                0,   60),
  ('Maquiagem em domicílio',             0,   60),
  ('Cabelo no Studio',                   0,   60),
  ('Cabelo em domicílio',                0,   60),
  ('Maquiagem e Cabelo no Studio',       0,  150),
  ('Maquiagem e Cabelo em domicílio',    0,  150),
  ('Curso de Automaquiagem no Studio',   0,  120),
  ('Curso de Automaquiagem em domicílio',0,  120),
  ('Noiva',                              0,  180)
ON CONFLICT (nome) DO NOTHING;
