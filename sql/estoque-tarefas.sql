-- ============================================================
-- Estoque + Tarefas — Meu Studio
-- Execute no Supabase Dashboard > SQL Editor > New query
-- ============================================================

-- 1. ESTOQUE
CREATE TABLE IF NOT EXISTS estoque (
  id         TEXT         PRIMARY KEY,
  nome       TEXT         NOT NULL DEFAULT '',
  categoria  TEXT         NOT NULL DEFAULT '',
  status     TEXT         NOT NULL DEFAULT 'ok'
             CHECK (status IN ('ok','acabando','zerado','investir','wishlist')),
  obs        TEXT                  DEFAULT '',
  created_at TIMESTAMPTZ           DEFAULT NOW()
);

ALTER TABLE estoque ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_estoque" ON estoque
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- 2. TAREFAS
CREATE TABLE IF NOT EXISTS tarefas (
  id         TEXT         PRIMARY KEY,
  titulo     TEXT         NOT NULL DEFAULT '',
  prazo      DATE,
  prioridade TEXT         NOT NULL DEFAULT 'normal'
             CHECK (prioridade IN ('alta','normal')),
  feita      BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ           DEFAULT NOW()
);

ALTER TABLE tarefas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_tarefas" ON tarefas
  FOR ALL TO anon USING (true) WITH CHECK (true);
