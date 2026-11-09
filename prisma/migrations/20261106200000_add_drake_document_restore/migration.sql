CREATE TABLE "DrakeDocumentoRestauracao" (
  id UUID PRIMARY KEY, "exclusaoId" UUID NOT NULL REFERENCES "DrakeDocumentoExclusao"(id),
  "usuarioId" INTEGER NOT NULL, "usuarioNome" TEXT NOT NULL, payload JSONB NOT NULL, status TEXT NOT NULL,
  "httpStatus" INTEGER, resposta JSONB, erro TEXT,
  "iniciadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"finalizadoEm" TIMESTAMPTZ(3)
);
CREATE INDEX "DrakeDocumentoRestauracao_exclusaoId_iniciadoEm_idx" ON "DrakeDocumentoRestauracao"("exclusaoId","iniciadoEm");
CREATE UNIQUE INDEX "DrakeDocRestauracao_reserva_key" ON "DrakeDocumentoRestauracao"("exclusaoId") WHERE status IN ('EM_EXECUCAO','RECRIACAO_ACEITA','NAO_CONFIRMADO');
