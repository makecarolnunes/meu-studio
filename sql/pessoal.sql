-- ============================================================
-- SISTEMA FINANCEIRO PESSOAL — tabelas, RLS, auth e sincronização
-- Execute no: Supabase Dashboard > SQL Editor > New query
--
-- Totalmente isolado do sistema da empresa. Compartilha apenas o
-- mesmo projeto Supabase. Auth própria (usuarios_pessoal).
--
-- Sincronização (empresa -> pessoal), via trigger em `saidas`:
--   saida natureza='PESSOAL' + forma transferência + para mim  -> ENTRADA pessoal
--   saida natureza='PESSOAL' (qualquer outro caso)             -> SAÍDA  pessoal
--   saida profissional/mista                                    -> ignorada
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ──────────────────────────────────────────────────────────
-- 1. AUTENTICAÇÃO PESSOAL (isolada de `usuarios` da empresa)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usuarios_pessoal (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario    TEXT        NOT NULL UNIQUE,
  senha_hash TEXT        NOT NULL,
  ativo      BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE usuarios_pessoal ENABLE ROW LEVEL SECURITY;
-- Sem política para anon → tabela inacessível direto. Acesso só via RPC.

CREATE OR REPLACE FUNCTION public.autenticar_pessoal(p_usuario TEXT, p_senha_hash TEXT)
RETURNS TABLE(id UUID, usuario TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT u.id, u.usuario
    FROM usuarios_pessoal u
    WHERE u.usuario    = lower(trim(p_usuario))
      AND u.senha_hash = lower(trim(p_senha_hash))
      AND u.ativo      = TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.autenticar_pessoal(TEXT, TEXT) TO anon;

-- ──────────────────────────────────────────────────────────
-- 2. ENTRADAS PESSOAIS (receitas)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS entradas_pessoal (
  id              TEXT        PRIMARY KEY,
  usuario_id      UUID        REFERENCES usuarios_pessoal(id) ON DELETE SET NULL,
  data            DATE        NOT NULL,
  descricao       TEXT        NOT NULL DEFAULT '',
  valor           NUMERIC(12,2) NOT NULL DEFAULT 0,
  categoria       TEXT        NOT NULL DEFAULT 'Outros',
  forma           TEXT        DEFAULT '',
  origem          TEXT        NOT NULL DEFAULT 'manual', -- manual | importacao | sincronizado
  saida_origem_id TEXT,        -- FK lógica p/ saidas.id quando origem='sincronizado'
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────
-- 3. SAÍDAS PESSOAIS (despesas)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS saidas_pessoal (
  id              TEXT        PRIMARY KEY,
  usuario_id      UUID        REFERENCES usuarios_pessoal(id) ON DELETE SET NULL,
  data            DATE        NOT NULL,
  descricao       TEXT        NOT NULL DEFAULT '',
  valor           NUMERIC(12,2) NOT NULL DEFAULT 0,
  categoria       TEXT        NOT NULL DEFAULT 'Outros',
  forma           TEXT        DEFAULT '',
  origem          TEXT        NOT NULL DEFAULT 'manual', -- manual | importacao | sincronizado
  saida_origem_id TEXT,        -- FK lógica p/ saidas.id quando origem='sincronizado'
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ent_pess_data  ON entradas_pessoal(data DESC);
CREATE INDEX IF NOT EXISTS idx_sai_pess_data  ON saidas_pessoal(data DESC);
-- Únicos: 1 linha sincronizada por saída de origem (upsert idempotente no trigger).
-- NÃO usar índice parcial (WHERE ... IS NOT NULL): o ON CONFLICT do trigger exige
-- índice não-parcial. NULLs são distintos no Postgres, então linhas manuais (NULL) ok.
CREATE UNIQUE INDEX IF NOT EXISTS uq_ent_pess_origem ON entradas_pessoal(saida_origem_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sai_pess_origem ON saidas_pessoal(saida_origem_id);

-- RLS permissivo p/ anon (mesmo modelo das tabelas da empresa)
ALTER TABLE entradas_pessoal ENABLE ROW LEVEL SECURITY;
ALTER TABLE saidas_pessoal   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_all_entradas_pessoal" ON entradas_pessoal;
DROP POLICY IF EXISTS "anon_all_saidas_pessoal"   ON saidas_pessoal;
CREATE POLICY "anon_all_entradas_pessoal" ON entradas_pessoal FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_saidas_pessoal"   ON saidas_pessoal   FOR ALL TO anon USING (true) WITH CHECK (true);

-- ──────────────────────────────────────────────────────────
-- 4. COLUNA `transferencia_para_mim` em `saidas` (empresa)
--    Marca: transferência pessoal destinada à MINHA conta pessoal.
-- ──────────────────────────────────────────────────────────
ALTER TABLE saidas ADD COLUMN IF NOT EXISTS transferencia_para_mim BOOLEAN DEFAULT FALSE;

-- ──────────────────────────────────────────────────────────
-- 5. TRIGGER DE SINCRONIZAÇÃO  saidas -> (entradas|saidas)_pessoal
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
BEGIN
  -- DELETE: remove qualquer linha sincronizada que aponte p/ esta saída
  IF (TG_OP = 'DELETE') THEN
    DELETE FROM entradas_pessoal WHERE saida_origem_id = OLD.id;
    DELETE FROM saidas_pessoal   WHERE saida_origem_id = OLD.id;
    RETURN OLD;
  END IF;

  -- Usuário pessoal único (single-user). Se não houver, fica NULL.
  SELECT id INTO v_user FROM usuarios_pessoal WHERE ativo = TRUE ORDER BY created_at LIMIT 1;

  v_eh_pessoal := (upper(coalesce(NEW.natureza, '')) = 'PESSOAL');

  -- Não é pessoal → garante que nada sincronizado sobre essa saída persista
  IF NOT v_eh_pessoal THEN
    DELETE FROM entradas_pessoal WHERE saida_origem_id = NEW.id;
    DELETE FROM saidas_pessoal   WHERE saida_origem_id = NEW.id;
    RETURN NEW;
  END IF;

  v_eh_transf_mim := (lower(coalesce(NEW.forma, '')) LIKE '%transfer%')
                     AND (NEW.transferencia_para_mim = TRUE);
  v_desc := coalesce(NULLIF(trim(NEW.obs), ''), 'Lançado pelo Financeiro');

  IF v_eh_transf_mim THEN
    -- Transferência para mim mesma → ENTRADA pessoal
    DELETE FROM saidas_pessoal WHERE saida_origem_id = NEW.id;       -- limpa lado errado
    INSERT INTO entradas_pessoal (id, usuario_id, data, descricao, valor, categoria, forma, origem, saida_origem_id)
    VALUES ('sync_' || NEW.id, v_user, NEW.data_pag, v_desc, abs(coalesce(NEW.valor,0)),
            'Transferência', coalesce(NEW.forma,''), 'sincronizado', NEW.id)
    ON CONFLICT (saida_origem_id) DO UPDATE
      SET data = EXCLUDED.data, valor = EXCLUDED.valor, descricao = EXCLUDED.descricao,
          forma = EXCLUDED.forma, usuario_id = EXCLUDED.usuario_id;
  ELSE
    -- Despesa pessoal de verdade → SAÍDA pessoal
    DELETE FROM entradas_pessoal WHERE saida_origem_id = NEW.id;     -- limpa lado errado
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

DROP TRIGGER IF EXISTS trg_sync_saida_pessoal ON saidas;
CREATE TRIGGER trg_sync_saida_pessoal
  AFTER INSERT OR UPDATE OR DELETE ON saidas
  FOR EACH ROW EXECUTE FUNCTION public.sync_saida_pessoal();

-- ──────────────────────────────────────────────────────────
-- 6. USUÁRIO INICIAL
--    Usuário: carol  |  Senha: pessoal2025  (TROQUE depois!)
-- ──────────────────────────────────────────────────────────
INSERT INTO usuarios_pessoal (usuario, senha_hash)
VALUES ('carol', encode(digest('pessoal2025', 'sha256'), 'hex'))
ON CONFLICT (usuario) DO UPDATE
  SET senha_hash = encode(digest('pessoal2025', 'sha256'), 'hex'),
      ativo = TRUE;

-- Para trocar a senha depois:
--   UPDATE usuarios_pessoal SET senha_hash = encode(digest('NOVA_SENHA','sha256'),'hex') WHERE usuario='carol';
