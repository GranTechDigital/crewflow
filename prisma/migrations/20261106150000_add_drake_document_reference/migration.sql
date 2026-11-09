CREATE TABLE "DrakeDocumentoOrigem" (
  "id" UUID PRIMARY KEY, "ambiente" TEXT NOT NULL, "tenantId" UUID NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'SEM_CARGA', "versao" INTEGER NOT NULL DEFAULT 0,
  "cargaAtivaId" UUID, "atualizadoEm" TIMESTAMPTZ(3),
  CONSTRAINT "DrakeDocumentoOrigem_ambiente_tenantId_key" UNIQUE ("ambiente", "tenantId"),
  CONSTRAINT "DrakeDocumentoOrigem_ambiente_check" CHECK ("ambiente" IN ('hmg', 'prd'))
);
CREATE TABLE "DrakeDocumentoCarga" (
  "id" UUID PRIMARY KEY, "origemId" UUID NOT NULL REFERENCES "DrakeDocumentoOrigem"("id"),
  "nomeArquivo" TEXT NOT NULL, "hashArquivo" TEXT NOT NULL, "parserVersao" TEXT NOT NULL,
  "fusoFonte" TEXT NOT NULL, "arquivoPrivado" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'VALIDANDO',
  "resumo" JSONB NOT NULL DEFAULT '{}', "erro" TEXT,
  "iniciadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "heartbeatEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "concluidoEm" TIMESTAMPTZ(3),
  CONSTRAINT "DrakeDocumentoCarga_origemId_hashArquivo_parserVersao_key" UNIQUE ("origemId", "hashArquivo", "parserVersao")
);
CREATE INDEX "DrakeDocumentoCarga_origemId_status_idx" ON "DrakeDocumentoCarga"("origemId", "status");
CREATE TABLE "DrakeDocumentoStaging" (
  "cargaId" UUID NOT NULL REFERENCES "DrakeDocumentoCarga"("id") ON DELETE CASCADE,
  "numeroLinha" INTEGER NOT NULL, "documentoId" UUID NOT NULL, "hashDados" TEXT NOT NULL, "dados" JSONB NOT NULL,
  PRIMARY KEY ("cargaId", "numeroLinha")
);
CREATE INDEX "DrakeDocumentoStaging_cargaId_documentoId_idx" ON "DrakeDocumentoStaging"("cargaId", "documentoId");
CREATE TABLE "DrakeDocumentoReferencia" (
  "origemId" UUID NOT NULL REFERENCES "DrakeDocumentoOrigem"("id"), "documentoId" UUID NOT NULL,
  "matricula" TEXT NOT NULL, "tipoNormalizado" TEXT NOT NULL, "qualificacaoNormalizada" TEXT NOT NULL,
  "emissao" DATE NOT NULL, "alteradoNaFonteEm" TIMESTAMPTZ(3) NOT NULL, "hashDados" TEXT NOT NULL, "dados" JSONB NOT NULL,
  "primeiraCargaId" UUID NOT NULL, "ultimaCargaId" UUID NOT NULL REFERENCES "DrakeDocumentoCarga"("id"),
  "atualizadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("origemId", "documentoId")
);
CREATE INDEX "DrakeDocRef_correspondencia_idx" ON "DrakeDocumentoReferencia"("origemId", "matricula", "tipoNormalizado", "qualificacaoNormalizada", "emissao");
CREATE TABLE "DrakeDocumentoRevisao" (
  "id" BIGSERIAL PRIMARY KEY, "origemId" UUID NOT NULL, "documentoId" UUID NOT NULL,
  "cargaId" UUID NOT NULL REFERENCES "DrakeDocumentoCarga"("id"),
  "dadosAnteriores" JSONB NOT NULL, "dadosNovos" JSONB NOT NULL,
  "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "DrakeDocumentoRevisao_origemId_documentoId_idx" ON "DrakeDocumentoRevisao"("origemId", "documentoId");
