-- Adiciona coluna comprado na tabela estoque
ALTER TABLE estoque ADD COLUMN IF NOT EXISTS comprado BOOLEAN DEFAULT false;
