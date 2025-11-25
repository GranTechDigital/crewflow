-- Adicionar campos de ação ao RemanejamentoFuncionario com FKs para Usuario
-- Idempotente e sem apagar dados

ALTER TABLE "public"."RemanejamentoFuncionario"
  ADD COLUMN IF NOT EXISTS "dataAprovado" TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "dataConcluido" TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "dataCancelado" TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "aprovadoPorId" INTEGER,
  ADD COLUMN IF NOT EXISTS "concluidoPorId" INTEGER,
  ADD COLUMN IF NOT EXISTS "canceladoPorId" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'RemanejamentoFuncionario'
      AND constraint_name = 'RemFunc_aprovadoPorId_fkey'
  ) THEN
    ALTER TABLE "public"."RemanejamentoFuncionario"
      ADD CONSTRAINT "RemFunc_aprovadoPorId_fkey"
      FOREIGN KEY ("aprovadoPorId") REFERENCES "public"."Usuario"("id")
      ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'RemanejamentoFuncionario'
      AND constraint_name = 'RemFunc_concluidoPorId_fkey'
  ) THEN
    ALTER TABLE "public"."RemanejamentoFuncionario"
      ADD CONSTRAINT "RemFunc_concluidoPorId_fkey"
      FOREIGN KEY ("concluidoPorId") REFERENCES "public"."Usuario"("id")
      ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'RemanejamentoFuncionario'
      AND constraint_name = 'RemFunc_canceladoPorId_fkey'
  ) THEN
    ALTER TABLE "public"."RemanejamentoFuncionario"
      ADD CONSTRAINT "RemFunc_canceladoPorId_fkey"
      FOREIGN KEY ("canceladoPorId") REFERENCES "public"."Usuario"("id")
      ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "RemFunc_aprovadoPorId_idx" ON "public"."RemanejamentoFuncionario" ("aprovadoPorId");
CREATE INDEX IF NOT EXISTS "RemFunc_concluidoPorId_idx" ON "public"."RemanejamentoFuncionario" ("concluidoPorId");
CREATE INDEX IF NOT EXISTS "RemFunc_canceladoPorId_idx" ON "public"."RemanejamentoFuncionario" ("canceladoPorId");