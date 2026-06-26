-- ============================================================
-- SUPABASE — Notas livres por dia (Próximos dias do painel Hoje)
-- Execute no: Supabase Dashboard > SQL Editor > New query
--
-- Tabela conteudo_planos: anotações soltas digitadas direto
-- em cada dia de "Próximos dias". Não são ideias nem stories —
-- só um texto com ✓ por dia, sincronizado entre dispositivos.
--
-- ⚠ Sem este script, as notas do dia ficam só no localStorage
--   do aparelho (não sincronizam entre celular e computador).
-- ============================================================

CREATE TABLE IF NOT EXISTS conteudo_planos (
  id         TEXT        PRIMARY KEY,
  date       DATE        NOT NULL,
  texto      TEXT        NOT NULL DEFAULT '',
  done       BOOLEAN     DEFAULT FALSE,
  ordem      INTEGER     DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_planos_date ON conteudo_planos(date);

ALTER TABLE conteudo_planos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all_planos" ON conteudo_planos;
CREATE POLICY "anon_all_planos" ON conteudo_planos
  FOR ALL TO anon USING (true) WITH CHECK (true);
