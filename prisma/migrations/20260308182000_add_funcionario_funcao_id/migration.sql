DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'Funcionario' AND column_name = 'funcaoId'
  ) THEN
    ALTER TABLE "public"."Funcionario" ADD COLUMN "funcaoId" INTEGER;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Funcionario_funcaoId_idx" ON "public"."Funcionario"("funcaoId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'Funcionario_funcaoId_fkey'
  ) THEN
    ALTER TABLE "public"."Funcionario"
      ADD CONSTRAINT "Funcionario_funcaoId_fkey"
      FOREIGN KEY ("funcaoId") REFERENCES "public"."Funcao"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
