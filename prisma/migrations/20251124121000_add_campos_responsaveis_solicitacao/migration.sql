-- Adicionar campos de responsáveis na tabela de solicitações sem perda de dados
-- Usa IF NOT EXISTS para garantir idempotência caso os campos já existam

ALTER TABLE "public"."SolicitacaoRemanejamento"
  ADD COLUMN IF NOT EXISTS "aprovadoPor" TEXT,
  ADD COLUMN IF NOT EXISTS "concluidoPor" TEXT,
  ADD COLUMN IF NOT EXISTS "atualizadoPor" TEXT;