-- Migração segura para converter solicitadoPor (texto) em solicitadoPorId (FK para Usuario)
-- 1) Adiciona coluna solicitadoPorId
-- 2) Popula solicitadoPorId casando por matrícula e nome
-- 3) Fallback: se não encontrar, usa id=1 se existir; senão, usa o menor id
-- 4) Cria FK e índices
-- 5) Remove coluna antiga solicitadoPor

ALTER TABLE "public"."SolicitacaoRemanejamento"
  ADD COLUMN IF NOT EXISTS "solicitadoPorId" INTEGER;

-- Preencher por matrícula
UPDATE "public"."SolicitacaoRemanejamento" s
SET "solicitadoPorId" = u.id
FROM "public"."Usuario" u
JOIN "public"."Funcionario" f ON u."funcionarioId" = f.id
WHERE s."solicitadoPorId" IS NULL
  AND s."solicitadoPor" = f."matricula";

-- Preencher por nome
UPDATE "public"."SolicitacaoRemanejamento" s
SET "solicitadoPorId" = u.id
FROM "public"."Usuario" u
JOIN "public"."Funcionario" f ON u."funcionarioId" = f.id
WHERE s."solicitadoPorId" IS NULL
  AND s."solicitadoPor" = f."nome";

-- Fallback: usar id=1 se existir, caso contrário o menor id existente
UPDATE "public"."SolicitacaoRemanejamento" s
SET "solicitadoPorId" = COALESCE(
  (SELECT id FROM "public"."Usuario" WHERE id = 1 LIMIT 1),
  (SELECT MIN(id) FROM "public"."Usuario")
)
WHERE s."solicitadoPorId" IS NULL;

-- FK para Usuario
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'SolicitacaoRemanejamento'
      AND constraint_name = 'SolicitacaoRemanejamento_solicitadoPorId_fkey'
  ) THEN
    ALTER TABLE "public"."SolicitacaoRemanejamento"
      ADD CONSTRAINT "SolicitacaoRemanejamento_solicitadoPorId_fkey"
      FOREIGN KEY ("solicitadoPorId") REFERENCES "public"."Usuario"("id")
      ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
END $$;

-- Índice para consultas
CREATE INDEX IF NOT EXISTS "SolicitacaoRemanejamento_solicitadoPorId_idx"
  ON "public"."SolicitacaoRemanejamento" ("solicitadoPorId");

-- Remover coluna antiga (já migrada)
ALTER TABLE "public"."SolicitacaoRemanejamento"
  DROP COLUMN IF EXISTS "solicitadoPor";