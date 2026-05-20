-- ══════════════════════════════════════════════════════════════
-- Corrige bug: saídas não salvavam por constraint de status inválida
-- O JS usa 'Pago' mas o CHECK só permitia 'Realizado'/'Previsto'/''
-- Executar no: Supabase Dashboard > SQL Editor > New query
-- ══════════════════════════════════════════════════════════════

-- 1. Garantir colunas de recorrência (se a migration anterior não rodou)
ALTER TABLE saidas ADD COLUMN IF NOT EXISTS recorrencia TEXT DEFAULT 'unica';
ALTER TABLE saidas ADD COLUMN IF NOT EXISTS grupo_id    TEXT;

-- 2. Corrigir constraint de status para incluir 'Pago'
ALTER TABLE saidas DROP CONSTRAINT IF EXISTS saidas_status_check;
ALTER TABLE saidas ADD CONSTRAINT saidas_status_check
  CHECK (status IN ('Pago', 'Previsto', 'Realizado', ''));
