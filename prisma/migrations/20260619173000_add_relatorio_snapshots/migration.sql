-- CreateTable
CREATE TABLE "public"."RelatorioSnapshot" (
    "id" SERIAL NOT NULL,
    "tipo" TEXT NOT NULL,
    "dataReferencia" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataCorte" TIMESTAMP(3) NOT NULL,
    "dataFim" TIMESTAMP(3),
    "resumo" JSONB NOT NULL,
    "filtros" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RelatorioSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RelatorioSnapshot_tipo_dataReferencia_idx" ON "public"."RelatorioSnapshot"("tipo", "dataReferencia");

-- CreateIndex
CREATE INDEX "RelatorioSnapshot_createdAt_idx" ON "public"."RelatorioSnapshot"("createdAt");
