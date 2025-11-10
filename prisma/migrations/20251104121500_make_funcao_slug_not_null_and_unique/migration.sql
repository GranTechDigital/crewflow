-- AlterTable
ALTER TABLE "public"."Funcao" ALTER COLUMN "funcao_slug" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Funcao_funcao_slug_regime_key" ON "public"."Funcao"("funcao_slug", "regime");