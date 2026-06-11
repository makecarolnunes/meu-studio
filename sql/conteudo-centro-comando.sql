-- ============================================================
-- SUPABASE — Centro de Comando de Conteúdo
-- Execute no: Supabase Dashboard > SQL Editor > New query
--
-- 1) Coluna gravar_date em conteudo_ideas (data de gravação,
--    separada da scheduled_date que é a data de publicação)
-- 2) Tabela conteudo_stories (checklist diário de stories)
--
-- ⚠ Rode este script ANTES de usar o novo painel "Hoje" —
--   sem ele, salvar uma ideia com data de gravação retorna
--   400 (PGRST204) e os stories ficam só no dispositivo.
-- ============================================================

-- 1) Data de gravação
ALTER TABLE conteudo_ideas ADD COLUMN IF NOT EXISTS gravar_date DATE;
CREATE INDEX IF NOT EXISTS idx_conteudo_gravar ON conteudo_ideas(gravar_date);

-- 2) Stories — itens leves de checklist por dia
CREATE TABLE IF NOT EXISTS conteudo_stories (
  id         TEXT        PRIMARY KEY,
  date       DATE        NOT NULL,
  texto      TEXT        NOT NULL DEFAULT '',
  idea_id    TEXT,                          -- opcional: vínculo com conteudo_ideas
  done       BOOLEAN     DEFAULT FALSE,
  ordem      INTEGER     DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stories_date ON conteudo_stories(date);

ALTER TABLE conteudo_stories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all_stories" ON conteudo_stories;
CREATE POLICY "anon_all_stories" ON conteudo_stories
  FOR ALL TO anon USING (true) WITH CHECK (true);
