-- ============================================================
-- Tarefas → Studio Flow (redesign)
-- Execute no Supabase Dashboard > SQL Editor > New query
-- Aditivo / não-destrutivo. Já aplicado em produção via MCP em 2026-06-26.
-- feita continua sincronizado com status p/ compat do widget do Hub.
-- ============================================================

-- 1. Novas colunas em tarefas
ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS area       TEXT    NOT NULL DEFAULT 'admin';
ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS projeto_id TEXT;
ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS status     TEXT    NOT NULL DEFAULT 'a_fazer';
ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS foco       BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Prioridade: amplia o CHECK p/ urgente/importante (mantém legados alta/normal/baixa)
ALTER TABLE tarefas DROP CONSTRAINT IF EXISTS tarefas_prioridade_check;
ALTER TABLE tarefas ADD  CONSTRAINT tarefas_prioridade_check
  CHECK (prioridade IN ('urgente','importante','normal','alta','baixa'));

-- 3. Status: novo CHECK (fluxo Kanban)
ALTER TABLE tarefas DROP CONSTRAINT IF EXISTS tarefas_status_check;
ALTER TABLE tarefas ADD  CONSTRAINT tarefas_status_check
  CHECK (status IN ('ideia','a_fazer','fazendo','feita'));

-- 4. Back-fill: status a partir de feita; legado alta -> importante
UPDATE tarefas SET status = 'feita'   WHERE feita = TRUE  AND status <> 'feita';
UPDATE tarefas SET status = 'a_fazer' WHERE feita = FALSE AND status = 'feita';
UPDATE tarefas SET prioridade = 'importante' WHERE prioridade = 'alta';

-- 5. Índices úteis
CREATE INDEX IF NOT EXISTS idx_tarefas_status     ON tarefas(status);
CREATE INDEX IF NOT EXISTS idx_tarefas_projeto_id ON tarefas(projeto_id);

-- 6. Tabela projetos
CREATE TABLE IF NOT EXISTS projetos (
  id         TEXT         PRIMARY KEY,
  nome       TEXT         NOT NULL DEFAULT '',
  area       TEXT         NOT NULL DEFAULT 'admin',
  cor        TEXT                  DEFAULT '',
  meta_data  DATE,
  arquivado  BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ           DEFAULT NOW()
);

ALTER TABLE projetos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all_projetos" ON projetos;
CREATE POLICY "anon_all_projetos" ON projetos
  FOR ALL TO anon USING (true) WITH CHECK (true);
