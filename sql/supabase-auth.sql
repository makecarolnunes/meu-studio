-- ============================================================
-- SUPABASE AUTH — Tabela de usuários + RPC de autenticação
-- Execute no: Supabase Dashboard > SQL Editor > New query
-- ============================================================

-- 1. Habilitar extensão pgcrypto (necessária para digest SHA-256)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Tabela de usuários
CREATE TABLE IF NOT EXISTS usuarios (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario    TEXT        NOT NULL UNIQUE,
  senha_hash TEXT        NOT NULL,
  nivel      TEXT        NOT NULL DEFAULT 'admin' CHECK (nivel IN ('admin', 'view')),
  ativo      BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. RLS — bloqueia SELECT/INSERT/UPDATE direto pela anon key
--    A autenticação acontece SOMENTE via função autenticar()
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

-- Nenhuma política de SELECT para anon → tabela inacessível diretamente
-- (a função usa SECURITY DEFINER, rodando como owner)

-- 4. Função RPC de autenticação (SECURITY DEFINER = roda como superuser)
CREATE OR REPLACE FUNCTION public.autenticar(p_usuario TEXT, p_senha_hash TEXT)
RETURNS TABLE(id UUID, usuario TEXT, nivel TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT u.id, u.usuario, u.nivel
    FROM usuarios u
    WHERE u.usuario    = lower(trim(p_usuario))
      AND u.senha_hash = lower(trim(p_senha_hash))
      AND u.ativo      = TRUE;
END;
$$;

-- Permitir que anon chame a função (mas não acesse a tabela diretamente)
GRANT EXECUTE ON FUNCTION public.autenticar(TEXT, TEXT) TO anon;

-- ============================================================
-- 5. Inserir usuário carol
--    Senha: makeup2025  →  SHA-256 via pgcrypto
-- ============================================================
INSERT INTO usuarios (usuario, senha_hash, nivel)
VALUES (
  'carol',
  encode(digest('makeup2025', 'sha256'), 'hex'),
  'admin'
)
ON CONFLICT (usuario) DO UPDATE
  SET senha_hash = encode(digest('makeup2025', 'sha256'), 'hex'),
      nivel      = 'admin',
      ativo      = TRUE;

-- ============================================================
-- Para adicionar outros usuários no futuro:
-- INSERT INTO usuarios (usuario, senha_hash, nivel) VALUES (
--   'nome',
--   encode(digest('senha_aqui', 'sha256'), 'hex'),
--   'view'   -- ou 'admin'
-- );
-- ============================================================
