CREATE TABLE "DrakeDocumentoExclusao" (
  id UUID PRIMARY KEY, "origemId" UUID NOT NULL REFERENCES "DrakeDocumentoOrigem"(id), "documentoId" UUID NOT NULL,
  "itemId" INTEGER NOT NULL, "usuarioId" INTEGER NOT NULL, "usuarioNome" TEXT NOT NULL,
  justificativa TEXT NOT NULL, "versaoReferencia" INTEGER NOT NULL, referencia JSONB NOT NULL, payload JSONB NOT NULL,
  status TEXT NOT NULL, "httpStatus" INTEGER, resposta JSONB, erro TEXT,
  "iniciadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "finalizadoEm" TIMESTAMPTZ(3)
);
CREATE INDEX "DrakeDocExclusao_documento_idx" ON "DrakeDocumentoExclusao"("origemId","documentoId","iniciadoEm");
CREATE INDEX "DrakeDocumentoExclusao_itemId_idx" ON "DrakeDocumentoExclusao"("itemId");
CREATE UNIQUE INDEX "DrakeDocExclusao_reserva_key" ON "DrakeDocumentoExclusao"("origemId","documentoId") WHERE status IN ('EM_EXECUCAO','EXCLUSAO_ACEITA','NAO_CONFIRMADO');
