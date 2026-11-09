CREATE TABLE "DrakeDocumentoEntrega" (
 id UUID PRIMARY KEY, ambiente TEXT NOT NULL CHECK (ambiente='hmg'), "tenantId" UUID NOT NULL,
 "hashRecebimento" TEXT NOT NULL,"nomeArquivo" TEXT NOT NULL,"urlCifrada" TEXT NOT NULL,
 "validoAte" TIMESTAMPTZ(3) NOT NULL,"geradoEm" TIMESTAMPTZ(3),"janelaInicio" TIMESTAMPTZ(3),"janelaFim" TIMESTAMPTZ(3),
 status TEXT NOT NULL DEFAULT 'PENDENTE',tentativas INTEGER NOT NULL DEFAULT 0,reserva UUID,"heartbeatEm" TIMESTAMPTZ(3),
 "cargaId" UUID,"hashArquivo" TEXT, "proximaTentativaEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "erroCodigo" TEXT,
 "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"concluidoEm" TIMESTAMPTZ(3),
 CONSTRAINT "DrakeDocumentoEntrega_recebimento_key" UNIQUE(ambiente,"tenantId","hashRecebimento")
);
CREATE INDEX "DrakeDocumentoEntrega_fila_idx" ON "DrakeDocumentoEntrega"(status,"proximaTentativaEm");
