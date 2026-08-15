CREATE TABLE "IntegracaoSessao" (
    "id" SERIAL NOT NULL,
    "provedor" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ABERTA',
    "sessionIdExterno" TEXT,
    "remanejamentoFuncionarioId" TEXT,
    "totalItens" INTEGER NOT NULL DEFAULT 0,
    "totalLotes" INTEGER NOT NULL DEFAULT 0,
    "timeoutMs" INTEGER NOT NULL DEFAULT 3600000,
    "payload" JSONB,
    "respostaInicio" JSONB,
    "respostaFinalizacao" JSONB,
    "respostaStatus" JSONB,
    "ultimoErro" TEXT,
    "abertaAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizadaAt" TIMESTAMP(3),
    "concluidaAt" TIMESTAMP(3),
    "ultimaConsultaAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegracaoSessao_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "IntegracaoOutbox" ADD COLUMN "sessaoId" INTEGER;

CREATE INDEX "IntegracaoSessao_provedor_tipo_status_idx" ON "IntegracaoSessao"("provedor", "tipo", "status");
CREATE INDEX "IntegracaoSessao_sessionIdExterno_idx" ON "IntegracaoSessao"("sessionIdExterno");
CREATE INDEX "IntegracaoSessao_remanejamentoFuncionarioId_idx" ON "IntegracaoSessao"("remanejamentoFuncionarioId");
CREATE INDEX "IntegracaoSessao_abertaAt_idx" ON "IntegracaoSessao"("abertaAt");
CREATE INDEX "IntegracaoSessao_ultimaConsultaAt_idx" ON "IntegracaoSessao"("ultimaConsultaAt");
CREATE INDEX "IntegracaoOutbox_sessaoId_idx" ON "IntegracaoOutbox"("sessaoId");

ALTER TABLE "IntegracaoSessao" ADD CONSTRAINT "IntegracaoSessao_remanejamentoFuncionarioId_fkey" FOREIGN KEY ("remanejamentoFuncionarioId") REFERENCES "RemanejamentoFuncionario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "IntegracaoOutbox" ADD CONSTRAINT "IntegracaoOutbox_sessaoId_fkey" FOREIGN KEY ("sessaoId") REFERENCES "IntegracaoSessao"("id") ON DELETE SET NULL ON UPDATE CASCADE;
