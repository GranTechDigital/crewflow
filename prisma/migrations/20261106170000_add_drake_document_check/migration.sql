CREATE TABLE "DrakeDocumentoConferencia" (
  "itemId" INTEGER PRIMARY KEY REFERENCES "ImportacaoCertificadoDrakeItem"("id") ON DELETE CASCADE,
  "origemId" UUID, "versao" INTEGER, "status" TEXT NOT NULL, "motivo" TEXT,
  "totalCandidatos" INTEGER NOT NULL DEFAULT 0, "candidatos" JSONB NOT NULL DEFAULT '[]',
  "conferidoEm" TIMESTAMPTZ(3) NOT NULL
);
