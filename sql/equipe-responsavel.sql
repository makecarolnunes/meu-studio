-- ══════════════════════════════════════════════════════════════
-- Responsável pelo atendimento (minha equipe) + cliente cacheada
-- Executar no SQL Editor do Supabase
-- ══════════════════════════════════════════════════════════════

-- ── Duração padrão de Maquiagem + Cabelo: 2h → 2h30 ───────────
-- Só toca nas linhas que ainda estão no antigo padrão de 120 min;
-- durações já ajustadas à mão ficam como estão.
UPDATE valores_servicos
   SET duracao = 150
 WHERE duracao = 120
   AND nome ILIKE '%maquiagem%'
   AND nome ILIKE '%cabelo%';

-- ── Orçamentos ────────────────────────────────────────────────
-- `equipe` (já existente) = TRABALHO PARA EQUIPE DE TERCEIROS.
-- `responsavel`           = quem executa o atendimento ('' / NULL = Carol).
-- `repasse`               = valor repassado ao profissional da minha equipe.
-- `cacheada`              = cliente cacheada (sugere 3h de duração).
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS responsavel TEXT;
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS repasse     NUMERIC;
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS cacheada    BOOLEAN DEFAULT FALSE;

-- ── Entradas ──────────────────────────────────────────────────
-- Permite ver no Financeiro quem executou o atendimento pago pela cliente.
ALTER TABLE entries ADD COLUMN IF NOT EXISTS responsavel TEXT;

-- ── Profissionais da minha equipe ─────────────────────────────
CREATE TABLE IF NOT EXISTS profissionais (
  id             TEXT PRIMARY KEY,
  nome           TEXT NOT NULL,
  repasse_padrao NUMERIC,
  ativo          BOOLEAN DEFAULT TRUE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS profissionais_nome_idx ON profissionais (nome);

ALTER TABLE profissionais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profissionais_all" ON profissionais;
CREATE POLICY "profissionais_all" ON profissionais
  FOR ALL USING (true) WITH CHECK (true);
