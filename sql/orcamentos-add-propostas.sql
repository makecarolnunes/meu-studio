-- ══════════════════════════════════════════════════════════════
-- Adiciona coluna propostas na tabela orcamentos
-- Executar no: Supabase Dashboard > SQL Editor > New query
-- ══════════════════════════════════════════════════════════════
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS propostas JSONB DEFAULT '[]';
