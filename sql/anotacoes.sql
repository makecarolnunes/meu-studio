-- ══════════════════════════════════════════════════════════════
-- Módulo Anotações — tabelas cadernos + anotacoes + storage
-- Executar no SQL Editor do Supabase
-- ══════════════════════════════════════════════════════════════

-- ── Cadernos (notebooks) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS cadernos (
  id         TEXT PRIMARY KEY,
  nome       TEXT NOT NULL DEFAULT '',
  emoji      TEXT DEFAULT '📓',
  cor        TEXT DEFAULT '#a36844',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE cadernos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all_cadernos" ON cadernos;
CREATE POLICY "anon_all_cadernos" ON cadernos
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- ── Anotações (notes inside notebooks) ───────────────────────
CREATE TABLE IF NOT EXISTS anotacoes (
  id          TEXT PRIMARY KEY,
  caderno_id  TEXT REFERENCES cadernos(id) ON DELETE CASCADE,
  titulo      TEXT NOT NULL DEFAULT '',
  conteudo    TEXT DEFAULT '',
  tags        TEXT[] DEFAULT '{}',
  imagens     JSONB DEFAULT '[]',
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE anotacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all_anotacoes" ON anotacoes;
CREATE POLICY "anon_all_anotacoes" ON anotacoes
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- ── Storage bucket "anotacoes" ────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('anotacoes', 'anotacoes', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Upload anotacoes imgs" ON storage.objects;
CREATE POLICY "Upload anotacoes imgs" ON storage.objects
  FOR INSERT TO anon WITH CHECK (bucket_id = 'anotacoes');

DROP POLICY IF EXISTS "Read anotacoes imgs" ON storage.objects;
CREATE POLICY "Read anotacoes imgs" ON storage.objects
  FOR SELECT TO anon USING (bucket_id = 'anotacoes');

DROP POLICY IF EXISTS "Delete anotacoes imgs" ON storage.objects;
CREATE POLICY "Delete anotacoes imgs" ON storage.objects
  FOR DELETE TO anon USING (bucket_id = 'anotacoes');
