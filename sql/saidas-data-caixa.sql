-- ══════════════════════════════════════════════════════════════
-- Saídas: data de competência (impacto no caixa) — migração
-- Executar no SQL Editor do Supabase (migrations NÃO rodam no deploy)
-- ══════════════════════════════════════════════════════════════
--
-- Contexto:
--   `data_pag`  = movimento bancário / vencimento (quando o dinheiro sai do banco).
--   `data_caixa`= competência: mês em que o gasto pesa no caixa.
--
-- Cartão de crédito: a fatura vence em data_pag, mas é paga com o dinheiro do
-- mês anterior — logo a competência é vencimento − 1 mês. Demais formas: igual.

ALTER TABLE saidas ADD COLUMN IF NOT EXISTS data_caixa DATE;

-- Backfill (decisão: corrigir também o histórico).
-- Crédito → mês anterior ao vencimento; demais → igual a data_pag.
-- (data_pag - INTERVAL '1 month')::date trata fim de mês corretamente
-- (ex.: 2025-05-31 → 2025-04-30), sem "vazar" pro mês errado.
UPDATE saidas
SET data_caixa = CASE
    WHEN forma = 'Crédito' THEN (data_pag - INTERVAL '1 month')::date
    ELSE data_pag
END
WHERE data_caixa IS NULL;

CREATE INDEX IF NOT EXISTS idx_saidas_data_caixa ON saidas(data_caixa DESC);
