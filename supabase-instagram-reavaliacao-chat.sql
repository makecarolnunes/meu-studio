-- ════════════════════════════════════════════════════════════════
--  Instagram Validador — Reavaliação + Chat
--  Adiciona o histórico de reavaliações e a conversa de cada análise
--  à tabela instagram_validations (sincroniza entre devices).
--
--  COMO RODAR:
--  1. Acesse o Supabase do projeto: https://supabase.com/dashboard
--  2. Vá em SQL Editor
--  3. Cole TODO o conteúdo deste arquivo
--  4. Clique em "Run"
--
--  Seguro rodar mais de uma vez (ADD COLUMN IF NOT EXISTS).
--  Enquanto este SQL NÃO roda, o app continua funcionando: o upsert
--  cai para o modo sem essas colunas e reavaliações/chat ficam só
--  no localStorage do dispositivo.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE instagram_validations
  ADD COLUMN IF NOT EXISTS revisions JSONB DEFAULT '[]'::jsonb;

ALTER TABLE instagram_validations
  ADD COLUMN IF NOT EXISTS chat JSONB DEFAULT '[]'::jsonb;

-- ── Verificação ──────────────────────────────────────────────
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'instagram_validations'
--   ORDER BY ordinal_position;
-- Devem aparecer, além das antigas: revisions, chat
