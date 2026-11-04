CREATE TABLE "SispatImportacao" (
    "id" TEXT NOT NULL,
    "nomeArquivo" TEXT NOT NULL,
    "aba" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "total" INTEGER NOT NULL,
    "resumo" JSONB NOT NULL,
    "registros" JSONB NOT NULL,
    "criadoPorId" INTEGER NOT NULL,
    "restauradoPorId" INTEGER,
    "erro" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aplicadoEm" TIMESTAMP(3),
    "desfeitoEm" TIMESTAMP(3),
    CONSTRAINT "SispatImportacao_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SispatImportacao_criadoEm_idx" ON "SispatImportacao"("criadoEm");
