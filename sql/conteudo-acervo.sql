-- ============================================================
-- SUPABASE — Acervo (Banco de Matéria-Prima de Conteúdo)
-- Execute no: Supabase Dashboard > SQL Editor > New query
--
-- 1) Tabela conteudo_materiais  (lotes de mídia: fotos, vídeos…)
-- 2) Colunas objetivo + material_id em conteudo_ideas
--    (vínculo da ideia promovida com o material de origem)
-- 3) Bucket PRIVADO "materiais" + políticas (URLs assinadas)
--
-- ⚠ Rode este script ANTES de usar a aba "🎞️ Acervo" — sem ele
--   o upload de mídia e o salvar material retornam 400 (PGRST204)
--   e as oportunidades ficam só no dispositivo.
-- ============================================================

-- ── 1) Materiais ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conteudo_materiais (
  id          TEXT        PRIMARY KEY,
  titulo      TEXT        NOT NULL DEFAULT '',
  origem_tipo TEXT        DEFAULT 'livre',   -- noiva | cliente | orcamento | livre
  origem_ref  TEXT        DEFAULT '',        -- id/nome da origem (livre)
  data        DATE,                          -- data de captura
  assets      JSONB       DEFAULT '[]',      -- [{path,kind,tipo,thumbPath,w,h}]
  sugestoes   JSONB       DEFAULT '[]',      -- [{id,titulo,formato,objetivo,roteiro,legenda,hashtags,status}]
  status      TEXT        DEFAULT 'novo',    -- novo | em_uso | esgotado
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_materiais_created ON conteudo_materiais(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_materiais_status  ON conteudo_materiais(status);

ALTER TABLE conteudo_materiais ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all_materiais" ON conteudo_materiais;
CREATE POLICY "anon_all_materiais" ON conteudo_materiais
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- ── 2) Vínculo ideia ↔ material + dimensão "objetivo" ───────
ALTER TABLE conteudo_ideas ADD COLUMN IF NOT EXISTS objetivo    TEXT; -- Autoridade|Relacionamento|Engajamento|Venda
ALTER TABLE conteudo_ideas ADD COLUMN IF NOT EXISTS material_id TEXT; -- FK lógica p/ conteudo_materiais
CREATE INDEX IF NOT EXISTS idx_conteudo_material ON conteudo_ideas(material_id);

-- ── 3) Bucket privado de mídias + políticas (URLs assinadas) ─
INSERT INTO storage.buckets (id, name, public)
VALUES ('materiais', 'materiais', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "anon_materiais_select" ON storage.objects;
DROP POLICY IF EXISTS "anon_materiais_insert" ON storage.objects;
DROP POLICY IF EXISTS "anon_materiais_update" ON storage.objects;
DROP POLICY IF EXISTS "anon_materiais_delete" ON storage.objects;

-- select é necessário para createSignedUrl funcionar
CREATE POLICY "anon_materiais_select" ON storage.objects
  FOR SELECT TO anon USING (bucket_id = 'materiais');
CREATE POLICY "anon_materiais_insert" ON storage.objects
  FOR INSERT TO anon WITH CHECK (bucket_id = 'materiais');
CREATE POLICY "anon_materiais_update" ON storage.objects
  FOR UPDATE TO anon USING (bucket_id = 'materiais');
CREATE POLICY "anon_materiais_delete" ON storage.objects
  FOR DELETE TO anon USING (bucket_id = 'materiais');
