-- ══════════════════════════════════════════════════════════════
-- Saídas fixas e recorrentes — migração
-- Executar no SQL Editor do Supabase
-- ══════════════════════════════════════════════════════════════

ALTER TABLE saidas ADD COLUMN IF NOT EXISTS recorrencia TEXT DEFAULT 'unica';
ALTER TABLE saidas ADD COLUMN IF NOT EXISTS grupo_id    TEXT;
