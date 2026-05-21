-- ══════════════════════════════════════════════════════════════
-- Adiciona coluna comprovante_url na tabela entries
-- Executar no: Supabase Dashboard > SQL Editor > New query
-- ══════════════════════════════════════════════════════════════
ALTER TABLE entries ADD COLUMN IF NOT EXISTS comprovante_url TEXT DEFAULT '';
