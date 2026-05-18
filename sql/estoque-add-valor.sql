-- Adiciona coluna valor ao estoque (execute se a tabela já existir)
ALTER TABLE estoque ADD COLUMN IF NOT EXISTS valor NUMERIC(10,2) DEFAULT 0;
