-- ============================================================
-- FLUXO FINANCEIRO PF + PJ — contas, caixinhas, planejamento,
-- transferências internas, dívidas, conciliação e auditoria.
-- Execute no: Supabase Dashboard > SQL Editor > New query
--
-- NÃO altera nem apaga nada das tabelas existentes (entries, saidas,
-- noivas, entradas_pessoal, saidas_pessoal). Só ADICIONA tabelas.
--
-- Pré-requisito: sql/pessoal.sql já aplicado (entradas_pessoal,
-- saidas_pessoal e o trigger trg_sync_saida_pessoal).
--
-- Idempotente: pode rodar de novo sem duplicar nada.
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- 1. CONTAS E CAIXINHAS
--    tipo: corrente | caixinha | cartao | especie | antiga
--    saldo_inicial / data_saldo_inicial: só preenchidos pela
--    CONCILIAÇÃO (saldo real informado). Nunca valores fictícios.
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fin_contas (
  id                 TEXT PRIMARY KEY,
  entidade           TEXT NOT NULL CHECK (entidade IN ('PF','PJ')),
  tipo               TEXT NOT NULL CHECK (tipo IN ('corrente','caixinha','cartao','especie','antiga')),
  nome               TEXT NOT NULL,
  banco              TEXT DEFAULT '',
  finalidade         TEXT DEFAULT '',          -- semanada | fixas | faxineira | sazonais | dividas | assinaturas | cursos | reposicao | mei | outra
  conta_pai_id       TEXT,                     -- caixinha pertence a uma conta corrente
  saldo_inicial      NUMERIC(12,2),            -- NULL = ainda não conciliado
  data_saldo_inicial DATE,
  padrao             BOOLEAN DEFAULT FALSE,    -- conta padrão da entidade p/ o tipo
  ativa              BOOLEAN DEFAULT TRUE,
  ordem              INT DEFAULT 0,
  obs                TEXT DEFAULT '',
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────
-- 2. TRANSFERÊNCIAS INTERNAS (nunca são despesa nem receita)
--    tipo: aporte (conta→caixinha) | resgate (caixinha→conta)
--          fatura (conta/caixinha→cartão) | entre_contas
--          ajuste (diferença de conciliação: origem OU destino nulo)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fin_transferencias (
  id               TEXT PRIMARY KEY,
  entidade         TEXT NOT NULL CHECK (entidade IN ('PF','PJ')),
  data             DATE NOT NULL,
  valor            NUMERIC(12,2) NOT NULL CHECK (valor > 0),
  origem_conta_id  TEXT,
  destino_conta_id TEXT,
  tipo             TEXT NOT NULL DEFAULT 'entre_contas'
                   CHECK (tipo IN ('aporte','resgate','fatura','entre_contas','ajuste')),
  descricao        TEXT DEFAULT '',
  plano_item_id    TEXT,
  vinculo_id       TEXT,          -- liga um resgate automático à saída que ele financiou
  conciliado       BOOLEAN DEFAULT FALSE,
  extrato_ref      TEXT,
  origem           TEXT DEFAULT 'manual',   -- manual | importacao | sistema
  criado_por       TEXT DEFAULT '',
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fin_transf_data ON fin_transferencias(data DESC);

-- ──────────────────────────────────────────────────────────
-- 3. PLANEJAMENTO MENSAL
--    fin_planos.mes = 'YYYY-MM' ou 'modelo' (o modelo base).
--    Cada mês é uma CÓPIA independente: editar o modelo ou um mês
--    futuro nunca altera meses anteriores nem movimentações.
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fin_planos (
  id         TEXT PRIMARY KEY,
  mes        TEXT NOT NULL UNIQUE,
  status     TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','fechado')),
  origem     TEXT DEFAULT '',          -- 'modelo' | 'YYYY-MM' copiado de
  reaberto   BOOLEAN DEFAULT FALSE,    -- reaberto à mão: não fecha sozinho de novo
  obs        TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE fin_planos ADD COLUMN IF NOT EXISTS reaberto BOOLEAN DEFAULT FALSE;

-- tipo: prolabore (PJ paga → PF recebe) | receita | aporte | pagamento
CREATE TABLE IF NOT EXISTS fin_plano_itens (
  id                TEXT PRIMARY KEY,
  plano_id          TEXT NOT NULL,
  mes               TEXT NOT NULL,
  entidade          TEXT NOT NULL CHECK (entidade IN ('PF','PJ')),
  tipo              TEXT NOT NULL CHECK (tipo IN ('prolabore','receita','aporte','pagamento')),
  dia               INT  NOT NULL CHECK (dia BETWEEN 1 AND 31),
  descricao         TEXT NOT NULL DEFAULT '',
  valor             NUMERIC(12,2) NOT NULL DEFAULT 0,
  conta_id          TEXT,          -- conta de onde o dinheiro sai (padrão: corrente)
  caixinha_id       TEXT,          -- aporte: destino · pagamento: reserva que paga
  categoria         TEXT DEFAULT '',
  divida_id         TEXT,
  ordem             INT DEFAULT 0,
  dispensado        BOOLEAN DEFAULT FALSE,
  reprogramado_para TEXT,          -- id do item que recebeu o saldo reprogramado
  avulso            BOOLEAN DEFAULT FALSE,  -- pontual: não é copiado para os meses seguintes
  mes_inicio        TEXT,          -- vigência (modelo): só entra nos meses >= mes_inicio
  mes_fim           TEXT,          --                     e <= mes_fim (ex.: última parcela)
  parcelas          INT,           -- nº total de parcelas → rótulo "(k/n)" calculado pelo mês
  origem_item_id    TEXT,          -- item do modelo que gerou este item do mês
  obs               TEXT DEFAULT '',
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fin_itens_mes ON fin_plano_itens(mes);
-- (se a tabela já existia de uma execução anterior)
ALTER TABLE fin_plano_itens ADD COLUMN IF NOT EXISTS mes_inicio     TEXT;
ALTER TABLE fin_plano_itens ADD COLUMN IF NOT EXISTS mes_fim        TEXT;
ALTER TABLE fin_plano_itens ADD COLUMN IF NOT EXISTS parcelas       INT;
ALTER TABLE fin_plano_itens ADD COLUMN IF NOT EXISTS origem_item_id TEXT;
ALTER TABLE fin_plano_itens ADD COLUMN IF NOT EXISTS avulso         BOOLEAN DEFAULT FALSE;

-- ──────────────────────────────────────────────────────────
-- 4. DÍVIDAS
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fin_dividas (
  id                 TEXT PRIMARY KEY,
  entidade           TEXT NOT NULL CHECK (entidade IN ('PF','PJ')),
  nome               TEXT NOT NULL,
  credor             TEXT DEFAULT '',
  taxa_mes           NUMERIC(8,4),
  valor_principal    NUMERIC(12,2),
  saldo_devedor      NUMERIC(12,2),     -- valor para quitação informado
  data_saldo         DATE,              -- data de referência do saldo
  total_em_aberto    NUMERIC(12,2),     -- total parcelado em aberto
  valor_parcela      NUMERIC(12,2),
  parcelas_restantes INT,
  dia_vencimento     INT,
  situacao           TEXT DEFAULT 'fora_do_plano',   -- fora_do_plano | no_plano | quitada
  prioridade         INT,
  ativa              BOOLEAN DEFAULT TRUE,
  obs                TEXT DEFAULT '',
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE fin_dividas ADD COLUMN IF NOT EXISTS situacao   TEXT DEFAULT 'fora_do_plano';
ALTER TABLE fin_dividas ADD COLUMN IF NOT EXISTS prioridade INT;

-- Histórico do saldo devedor (evolução da dívida)
CREATE TABLE IF NOT EXISTS fin_divida_saldos (
  id                 TEXT PRIMARY KEY,
  divida_id          TEXT NOT NULL,
  data               DATE NOT NULL,
  saldo_devedor      NUMERIC(12,2),
  total_em_aberto    NUMERIC(12,2),
  parcelas_restantes INT,
  obs                TEXT DEFAULT '',
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────
-- 5. CONCILIAÇÕES (saldo real × saldo do sistema)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fin_conciliacoes (
  id            TEXT PRIMARY KEY,
  conta_id      TEXT NOT NULL,
  data          DATE NOT NULL,
  saldo_banco   NUMERIC(12,2) NOT NULL,
  saldo_sistema NUMERIC(12,2),
  diferenca     NUMERIC(12,2),
  tipo          TEXT NOT NULL DEFAULT 'conferencia' CHECK (tipo IN ('abertura','conferencia','ajuste')),
  ajuste_id     TEXT,
  obs           TEXT DEFAULT '',
  criado_por    TEXT DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────
-- 6. METADADOS DE MOVIMENTAÇÃO
--    Liga qualquer lançamento existente (entries, saidas,
--    entradas_pessoal, saidas_pessoal) a conta, caixinha, item do
--    plano, dívida e conciliação — SEM alterar as tabelas originais.
--    id = '<tabela>:<registro_id>'
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fin_mov_meta (
  id            TEXT PRIMARY KEY,
  tabela        TEXT NOT NULL CHECK (tabela IN ('entries','saidas','entradas_pessoal','saidas_pessoal')),
  registro_id   TEXT NOT NULL,
  conta_id      TEXT,
  caixinha_id   TEXT,
  plano_item_id TEXT,
  divida_id     TEXT,
  conciliado    BOOLEAN DEFAULT FALSE,
  extrato_ref   TEXT,
  vinculo_id    TEXT,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fin_meta_item ON fin_mov_meta(plano_item_id);

-- ──────────────────────────────────────────────────────────
-- 7. LOG DE AUDITORIA (rastreabilidade de toda escrita do fluxo)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fin_log (
  id          TEXT PRIMARY KEY,
  em          TIMESTAMPTZ DEFAULT NOW(),
  usuario     TEXT DEFAULT '',
  acao        TEXT NOT NULL,
  tabela      TEXT DEFAULT '',
  registro_id TEXT DEFAULT '',
  dados       JSONB
);
CREATE INDEX IF NOT EXISTS idx_fin_log_em ON fin_log(em DESC);

-- ──────────────────────────────────────────────────────────
-- 8. RLS — mesmo modelo das demais tabelas (auth no app)
-- ──────────────────────────────────────────────────────────
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['fin_contas','fin_transferencias','fin_planos','fin_plano_itens',
                           'fin_dividas','fin_divida_saldos','fin_conciliacoes','fin_mov_meta','fin_log']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "anon_all_%s" ON %I', t, t);
    EXECUTE format('CREATE POLICY "anon_all_%s" ON %I FOR ALL TO anon USING (true) WITH CHECK (true)', t, t);
  END LOOP;
END $$;

-- ──────────────────────────────────────────────────────────
-- 9. PRÓ-LABORE no trigger PJ → PF
--    Mesma regra de sql/pessoal.sql; única mudança: quando a saída
--    PJ tem tipo 'Pró-labore', a entrada PF nasce com categoria
--    'Pró-labore' (em vez de 'Transferência').
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_saida_pessoal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user   UUID;
  v_eh_pessoal BOOLEAN;
  v_eh_transf_mim BOOLEAN;
  v_desc   TEXT;
  v_cat    TEXT;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    DELETE FROM entradas_pessoal WHERE saida_origem_id = OLD.id;
    DELETE FROM saidas_pessoal   WHERE saida_origem_id = OLD.id;
    RETURN OLD;
  END IF;

  SELECT id INTO v_user FROM usuarios_pessoal WHERE ativo = TRUE ORDER BY created_at LIMIT 1;

  v_eh_pessoal := (upper(coalesce(NEW.natureza, '')) = 'PESSOAL');

  IF NOT v_eh_pessoal THEN
    DELETE FROM entradas_pessoal WHERE saida_origem_id = NEW.id;
    DELETE FROM saidas_pessoal   WHERE saida_origem_id = NEW.id;
    RETURN NEW;
  END IF;

  v_eh_transf_mim := (lower(coalesce(NEW.forma, '')) LIKE '%transfer%')
                     AND (NEW.transferencia_para_mim = TRUE);
  v_desc := coalesce(NULLIF(trim(NEW.obs), ''), 'Lançado pelo Financeiro');
  v_cat  := CASE WHEN NEW.tipo = 'Pró-labore' THEN 'Pró-labore' ELSE 'Transferência' END;

  IF v_eh_transf_mim THEN
    DELETE FROM saidas_pessoal WHERE saida_origem_id = NEW.id;
    INSERT INTO entradas_pessoal (id, usuario_id, data, descricao, valor, categoria, forma, origem, saida_origem_id)
    VALUES ('sync_' || NEW.id, v_user, NEW.data_pag, v_desc, abs(coalesce(NEW.valor,0)),
            v_cat, coalesce(NEW.forma,''), 'sincronizado', NEW.id)
    ON CONFLICT (saida_origem_id) DO UPDATE
      SET data = EXCLUDED.data, valor = EXCLUDED.valor, descricao = EXCLUDED.descricao,
          forma = EXCLUDED.forma, categoria = EXCLUDED.categoria, usuario_id = EXCLUDED.usuario_id;
  ELSE
    DELETE FROM entradas_pessoal WHERE saida_origem_id = NEW.id;
    INSERT INTO saidas_pessoal (id, usuario_id, data, descricao, valor, categoria, forma, origem, saida_origem_id)
    VALUES ('sync_' || NEW.id, v_user, NEW.data_pag, v_desc, abs(coalesce(NEW.valor,0)),
            'Outros', coalesce(NEW.forma,''), 'sincronizado', NEW.id)
    ON CONFLICT (saida_origem_id) DO UPDATE
      SET data = EXCLUDED.data, valor = EXCLUDED.valor, descricao = EXCLUDED.descricao,
          forma = EXCLUDED.forma, usuario_id = EXCLUDED.usuario_id;
  END IF;

  RETURN NEW;
END;
$$;

-- O trigger em si já existe (sql/pessoal.sql); recriar garante que aponta p/ a
-- função nova. Só liga o trigger se as tabelas pessoais existirem — sem elas a
-- função falharia e QUEBRARIA o salvamento de saídas no Financeiro PJ.
DO $$
BEGIN
  IF to_regclass('public.entradas_pessoal') IS NOT NULL
     AND to_regclass('public.saidas_pessoal') IS NOT NULL
     AND to_regclass('public.usuarios_pessoal') IS NOT NULL
     AND EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'saidas' AND column_name = 'transferencia_para_mim') THEN
    DROP TRIGGER IF EXISTS trg_sync_saida_pessoal ON saidas;
    CREATE TRIGGER trg_sync_saida_pessoal
      AFTER INSERT OR UPDATE OR DELETE ON saidas
      FOR EACH ROW EXECUTE FUNCTION public.sync_saida_pessoal();
  ELSE
    RAISE NOTICE 'sql/pessoal.sql não aplicado: trigger PJ→PF não foi ligado. Rode pessoal.sql antes.';
  END IF;
END $$;
