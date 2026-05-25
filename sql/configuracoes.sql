-- Tabela de configurações persistidas (chave-valor)
-- Usada para armazenar a chave Claude API entre sessões/devices

CREATE TABLE IF NOT EXISTS configuracoes (
  chave      TEXT PRIMARY KEY,
  valor      TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE configuracoes ENABLE ROW LEVEL SECURITY;

-- App usa auth customizada (não Supabase Auth), anon key é privada ao projeto
CREATE POLICY "allow_all" ON configuracoes
  FOR ALL TO anon USING (true) WITH CHECK (true);
