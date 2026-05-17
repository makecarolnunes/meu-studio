-- ─────────────────────────────────────────────────────────────
--  DDL: valores_servicos
--  Rodar manualmente no SQL Editor do Supabase
--  Armazena a tabela de preços por serviço × local
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS valores_servicos (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  servico    TEXT         NOT NULL,
  local      TEXT         NOT NULL,
  valor      NUMERIC(10,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT valores_servicos_unico UNIQUE (servico, local)
);

-- Índice para leitura rápida por serviço
CREATE INDEX IF NOT EXISTS idx_valores_servicos_servico ON valores_servicos (servico);

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
--  Dados iniciais (preços zerados para todos os serviços)
--  Remova ou ajuste os valores conforme necessário
-- ─────────────────────────────────────────────────────────────
INSERT INTO valores_servicos (servico, local, valor) VALUES
  ('Maquiagem',              'Studio',       0),
  ('Maquiagem',              'Em Domicílio', 0),
  ('Cabelo',                 'Studio',       0),
  ('Cabelo',                 'Em Domicílio', 0),
  ('Maquiagem e Cabelo',     'Studio',       0),
  ('Maquiagem e Cabelo',     'Em Domicílio', 0),
  ('Curso de Automaquiagem', 'Studio',       0),
  ('Curso de Automaquiagem', 'Em Domicílio', 0)
ON CONFLICT (servico, local) DO NOTHING;
