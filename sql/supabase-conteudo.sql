-- ============================================================
-- SUPABASE — Tabela de Planejamento de Conteúdo
-- Execute no: Supabase Dashboard > SQL Editor > New query
-- ============================================================

CREATE TABLE IF NOT EXISTS conteudo_ideas (
  id             TEXT        PRIMARY KEY,
  title          TEXT        NOT NULL DEFAULT '',
  categories     JSONB       DEFAULT '[]',
  formatos       JSONB       DEFAULT '[]',
  status         TEXT        DEFAULT 'Nao',
  notes          TEXT        DEFAULT '',
  platforms      JSONB       DEFAULT '[]',
  scheduled_date DATE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conteudo_status        ON conteudo_ideas(status);
CREATE INDEX IF NOT EXISTS idx_conteudo_scheduled     ON conteudo_ideas(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_conteudo_created       ON conteudo_ideas(created_at DESC);

ALTER TABLE conteudo_ideas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_conteudo" ON conteudo_ideas
  FOR ALL TO anon USING (true) WITH CHECK (true);
