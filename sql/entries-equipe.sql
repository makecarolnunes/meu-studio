-- ══════════════════════════════════════════════════════════════
-- Atendimento pela equipe — migração
-- Executar no SQL Editor do Supabase
-- ══════════════════════════════════════════════════════════════

ALTER TABLE entries ADD COLUMN IF NOT EXISTS equipe TEXT;
