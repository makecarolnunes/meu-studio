-- ============================================================
-- SUPABASE MIGRATION — Meu Studio (Carol)
-- Execute no: Supabase Dashboard > SQL Editor > New query
-- ============================================================

-- 1. NOIVAS (antes de entries para a FK)
CREATE TABLE IF NOT EXISTS noivas (
  id              TEXT          PRIMARY KEY,
  nome            TEXT          NOT NULL,
  data_casamento  DATE,
  valor_contrato  NUMERIC(12,2),
  obs             TEXT          DEFAULT '',
  created_at      TIMESTAMPTZ   DEFAULT NOW()
);

-- 2. ENTRIES (receitas / entradas financeiras)
CREATE TABLE IF NOT EXISTS entries (
  id          TEXT          PRIMARY KEY,
  data_pag    DATE,
  data_serv   DATE,
  cliente     TEXT          DEFAULT '',
  tipo        TEXT          CHECK (tipo IN ('Sinal','Parcela','Pagamento','')),
  valor       NUMERIC(12,2),
  valor_total NUMERIC(12,2),
  servico     TEXT          DEFAULT '',
  local       TEXT          DEFAULT '',
  forma       TEXT          DEFAULT '',
  status      TEXT          CHECK (status IN ('Realizado','Previsto','')),
  origem      TEXT          DEFAULT '',
  obs         TEXT          DEFAULT '',
  auto        BOOLEAN       DEFAULT FALSE,
  noiva_id    TEXT          REFERENCES noivas(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ   DEFAULT NOW()
);

-- 3. SAIDAS (despesas)
CREATE TABLE IF NOT EXISTS saidas (
  id          TEXT          PRIMARY KEY,
  data_pag    DATE,
  tipo        TEXT          DEFAULT '',
  valor       NUMERIC(12,2),
  forma       TEXT          DEFAULT '',
  status      TEXT          CHECK (status IN ('Realizado','Previsto','')),
  obs         TEXT          DEFAULT '',
  created_at  TIMESTAMPTZ   DEFAULT NOW()
);

-- 4. ORCAMENTOS
CREATE TABLE IF NOT EXISTS orcamentos (
  id               TEXT          PRIMARY KEY,
  cliente          TEXT          DEFAULT '',
  telefone         TEXT          DEFAULT '',
  servico          TEXT          DEFAULT '',
  status           TEXT          DEFAULT 'Novo Pedido',
  data_pedido      DATE,
  data_envio       DATE,
  data_fechamento  DATE,
  data_evento      DATE,
  valor_prop       NUMERIC(12,2),
  valor_fechado    NUMERIC(12,2),
  origem           TEXT          DEFAULT '',
  endereco         TEXT          DEFAULT '',
  obs              TEXT          DEFAULT '',
  prox_followup    DATE,
  agenda_criada    TEXT          DEFAULT '',
  endereco_evento  TEXT          DEFAULT '',
  local_tipo       TEXT          DEFAULT '',
  sinal_fech       NUMERIC(12,2),
  saldo_fech       NUMERIC(12,2),
  comprovantes     JSONB         DEFAULT '[]',
  created_at       TIMESTAMPTZ   DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_entries_noiva_id  ON entries(noiva_id);
CREATE INDEX IF NOT EXISTS idx_entries_data_pag  ON entries(data_pag DESC);
CREATE INDEX IF NOT EXISTS idx_entries_status    ON entries(status);
CREATE INDEX IF NOT EXISTS idx_saidas_data_pag   ON saidas(data_pag DESC);
CREATE INDEX IF NOT EXISTS idx_orcamentos_status ON orcamentos(status);
CREATE INDEX IF NOT EXISTS idx_orcamentos_data   ON orcamentos(created_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY
-- App pessoal: políticas permissivas para anon key
-- (a tela de login do próprio app protege o acesso)
-- ============================================================
ALTER TABLE noivas     ENABLE ROW LEVEL SECURITY;
ALTER TABLE entries    ENABLE ROW LEVEL SECURITY;
ALTER TABLE saidas     ENABLE ROW LEVEL SECURITY;
ALTER TABLE orcamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all_noivas"     ON noivas     FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_entries"    ON entries    FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_saidas"     ON saidas     FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_orcamentos" ON orcamentos FOR ALL TO anon USING (true) WITH CHECK (true);
