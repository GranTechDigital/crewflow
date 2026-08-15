-- AlterTable
ALTER TABLE "IntegracaoEventoExterno" ADD COLUMN "direcao" TEXT NOT NULL DEFAULT 'SAIDA';

-- CreateTable
CREATE TABLE "IntegracaoInbox" (
    "id" SERIAL NOT NULL,
    "eventoExternoId" INTEGER,
    "provedor" TEXT NOT NULL,
    "origemEvento" TEXT,
    "externalId" TEXT,
    "remanejamentoFuncionarioId" TEXT,
    "payload" JSONB NOT NULL,
    "headers" JSONB,
    "status" TEXT NOT NULL DEFAULT 'RECEBIDO',
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "ultimoErro" TEXT,
    "recebidoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processadoAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegracaoInbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IntegracaoEventoExterno_provedor_direcao_status_idx" ON "IntegracaoEventoExterno"("provedor", "direcao", "status");

-- CreateIndex
CREATE INDEX "IntegracaoInbox_eventoExternoId_idx" ON "IntegracaoInbox"("eventoExternoId");

-- CreateIndex
CREATE INDEX "IntegracaoInbox_provedor_status_idx" ON "IntegracaoInbox"("provedor", "status");

-- CreateIndex
CREATE INDEX "IntegracaoInbox_externalId_idx" ON "IntegracaoInbox"("externalId");

-- CreateIndex
CREATE INDEX "IntegracaoInbox_remanejamentoFuncionarioId_idx" ON "IntegracaoInbox"("remanejamentoFuncionarioId");

-- CreateIndex
CREATE INDEX "IntegracaoInbox_recebidoAt_idx" ON "IntegracaoInbox"("recebidoAt");

-- CreateIndex
CREATE INDEX "IntegracaoInbox_processadoAt_idx" ON "IntegracaoInbox"("processadoAt");

-- AddForeignKey
ALTER TABLE "IntegracaoInbox" ADD CONSTRAINT "IntegracaoInbox_eventoExternoId_fkey" FOREIGN KEY ("eventoExternoId") REFERENCES "IntegracaoEventoExterno"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegracaoInbox" ADD CONSTRAINT "IntegracaoInbox_remanejamentoFuncionarioId_fkey" FOREIGN KEY ("remanejamentoFuncionarioId") REFERENCES "RemanejamentoFuncionario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
