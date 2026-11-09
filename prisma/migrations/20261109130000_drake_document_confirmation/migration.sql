ALTER TABLE "ImportacaoCertificadoDrakeTentativa" ADD COLUMN "drakeTenantId" UUID;
ALTER TABLE "DrakeDocumentoReferencia" ADD COLUMN "observadoEm" TIMESTAMPTZ(3);
UPDATE "DrakeDocumentoReferencia" r SET "observadoEm"=COALESCE(
 (SELECT MAX(e."geradoEm") FROM "DrakeDocumentoEntrega" e WHERE e."cargaId"=r."ultimaCargaId" AND e.status='CONCLUIDO'),
 (SELECT c."concluidoEm" FROM "DrakeDocumentoCarga" c WHERE c.id=r."ultimaCargaId")
);
CREATE TABLE "DrakeCertificadoConfirmacao" (
 id UUID PRIMARY KEY,"itemId" INTEGER NOT NULL REFERENCES "ImportacaoCertificadoDrakeItem"(id),
 "origemId" UUID NOT NULL REFERENCES "DrakeDocumentoOrigem"(id),
 "cargaId" UUID NOT NULL REFERENCES "DrakeDocumentoCarga"(id),
 "documentoId" UUID,status TEXT NOT NULL,motivo TEXT NOT NULL,
 "referenciaEm" TIMESTAMPTZ(3) NOT NULL,evidencia JSONB NOT NULL,
 "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT clock_timestamp(),
 CONSTRAINT "DrakeCertConfirmacao_evento_key" UNIQUE("itemId","cargaId","referenciaEm")
);
CREATE INDEX "DrakeCertConfirmacao_item_idx" ON "DrakeCertificadoConfirmacao"("itemId","criadoEm" DESC);
