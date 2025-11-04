-- DropIndex
DROP INDEX IF EXISTS "public"."Funcao_funcao_key";

-- AlterTable
ALTER TABLE "public"."Funcao" ADD COLUMN IF NOT EXISTS "funcao_slug" TEXT;
ALTER TABLE "public"."Funcao" ALTER COLUMN "regime" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Funcao_funcao_regime_key" ON "public"."Funcao"("funcao", "regime");