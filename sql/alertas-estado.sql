-- ══════════════════════════════════════════════════════════════
-- Tabela alertas_estado — estado das AÇÕES do usuário sobre alertas
-- Os alertas em si são DERIVADOS (recalculados pelo motor em
-- shared/js/alerts.js). Aqui só persiste o que o usuário fez com
-- cada alerta (resolver / adiar / ignorar), por chave estável.
-- Executar no: Supabase Dashboard > SQL Editor > New query
-- (ou via MCP apply_migration). Já aplicado em prod em 2026-05-30.
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS alertas_estado (
  alert_key    text PRIMARY KEY,
  status       text NOT NULL DEFAULT 'ativo',   -- 'resolvido' | 'adiado' | 'ignorado'
  snooze_until timestamptz,                       -- preenchido quando status='adiado'
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE alertas_estado ENABLE ROW LEVEL SECURITY;

-- Política permissiva p/ anon, espelhando as demais tabelas (app usa anon key)
DROP POLICY IF EXISTS anon_all_alertas_estado ON alertas_estado;
CREATE POLICY anon_all_alertas_estado ON alertas_estado
  FOR ALL TO anon
  USING (true) WITH CHECK (true);
