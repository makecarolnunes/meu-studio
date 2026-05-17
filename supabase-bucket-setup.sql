-- ============================================================
-- SUPABASE STORAGE — Criar bucket "comprovantes"
-- Execute no: Supabase Dashboard > SQL Editor > New query
-- ============================================================

-- 1. Criar bucket público
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'comprovantes',
  'comprovantes',
  true,
  10485760,  -- 10 MB por arquivo
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760;

-- 2. Política: upload (anon pode enviar)
DROP POLICY IF EXISTS "anon_upload_comprovantes" ON storage.objects;
CREATE POLICY "anon_upload_comprovantes" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (bucket_id = 'comprovantes');

-- 3. Política: leitura pública
DROP POLICY IF EXISTS "anon_read_comprovantes" ON storage.objects;
CREATE POLICY "anon_read_comprovantes" ON storage.objects
  FOR SELECT TO anon
  USING (bucket_id = 'comprovantes');

-- 4. Política: exclusão (anon pode deletar)
DROP POLICY IF EXISTS "anon_delete_comprovantes" ON storage.objects;
CREATE POLICY "anon_delete_comprovantes" ON storage.objects
  FOR DELETE TO anon
  USING (bucket_id = 'comprovantes');
