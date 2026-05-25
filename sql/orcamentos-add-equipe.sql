-- ══════════════════════════════════════════════════════════════
-- Atendimento por equipe — orcamentos
-- Executar no SQL Editor do Supabase
-- ══════════════════════════════════════════════════════════════
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS equipe TEXT;
