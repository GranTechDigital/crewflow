-- Adicionar colunas de IDs de usuário para responsáveis na solicitação
-- Não remove colunas antigas de texto; preserva dados existentes

ALTER TABLE "public"."SolicitacaoRemanejamento"
  ADD COLUMN IF NOT EXISTS "aprovadoPorId" INTEGER,
  ADD COLUMN IF NOT EXISTS "concluidoPorId" INTEGER,
  ADD COLUMN IF NOT EXISTS "atualizadoPorId" INTEGER;

-- Criar chaves estrangeiras para relacionar com Usuario
DO $$
BEGIN
  -- aprovadoPorId FK
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'SolicitacaoRemanejamento_aprovadoPorId_fkey'
      AND table_name = 'SolicitacaoRemanejamento'
      AND constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE "public"."SolicitacaoRemanejamento"
      ADD CONSTRAINT "SolicitacaoRemanejamento_aprovadoPorId_fkey"
      FOREIGN KEY ("aprovadoPorId") REFERENCES "public"."Usuario"("id")
      ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;

  -- concluidoPorId FK
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'SolicitacaoRemanejamento_concluidoPorId_fkey'
      AND table_name = 'SolicitacaoRemanejamento'
      AND constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE "public"."SolicitacaoRemanejamento"
      ADD CONSTRAINT "SolicitacaoRemanejamento_concluidoPorId_fkey"
      FOREIGN KEY ("concluidoPorId") REFERENCES "public"."Usuario"("id")
      ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;

  -- atualizadoPorId FK
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'SolicitacaoRemanejamento_atualizadoPorId_fkey'
      AND table_name = 'SolicitacaoRemanejamento'
      AND constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE "public"."SolicitacaoRemanejamento"
      ADD CONSTRAINT "SolicitacaoRemanejamento_atualizadoPorId_fkey"
      FOREIGN KEY ("atualizadoPorId") REFERENCES "public"."Usuario"("id")
      ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
END $$;

-- Indexes para performance em consultas
CREATE INDEX IF NOT EXISTS "SolicitacaoRemanejamento_aprovadoPorId_idx" ON "public"."SolicitacaoRemanejamento" ("aprovadoPorId");
CREATE INDEX IF NOT EXISTS "SolicitacaoRemanejamento_concluidoPorId_idx" ON "public"."SolicitacaoRemanejamento" ("concluidoPorId");
CREATE INDEX IF NOT EXISTS "SolicitacaoRemanejamento_atualizadoPorId_idx" ON "public"."SolicitacaoRemanejamento" ("atualizadoPorId");