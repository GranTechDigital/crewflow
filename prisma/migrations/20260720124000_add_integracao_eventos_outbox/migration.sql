-- CreateTable
CREATE TABLE "IntegracaoEventoExterno" (
    "id" SERIAL NOT NULL,
    "provedor" TEXT NOT NULL,
    "dominio" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ABERTO',
    "remanejamentoFuncionarioId" TEXT,
    "cicloId" TEXT,
    "numeroCiclo" INTEGER,
    "setor" TEXT,
    "chaveIdempotencia" TEXT NOT NULL,
    "startAt" TIMESTAMP(3),
    "endPrevistoAt" TIMESTAMP(3),
    "endRealAt" TIMESTAMP(3),
    "payload" JSONB,
    "metadata" JSONB,
    "ultimoErro" TEXT,
    "ultimaSincronizacaoAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegracaoEventoExterno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegracaoOutbox" (
    "id" SERIAL NOT NULL,
    "eventoExternoId" INTEGER,
    "provedor" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "remanejamentoFuncionarioId" TEXT,
    "cicloId" TEXT,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "ultimoErro" TEXT,
    "proximaTentativaAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegracaoOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IntegracaoEventoExterno_provedor_externalId_key" ON "IntegracaoEventoExterno"("provedor", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "IntegracaoEventoExterno_chaveIdempotencia_key" ON "IntegracaoEventoExterno"("chaveIdempotencia");

-- CreateIndex
CREATE INDEX "IntegracaoEventoExterno_provedor_dominio_entidade_idx" ON "IntegracaoEventoExterno"("provedor", "dominio", "entidade");

-- CreateIndex
CREATE INDEX "IntegracaoEventoExterno_status_idx" ON "IntegracaoEventoExterno"("status");

-- CreateIndex
CREATE INDEX "IntegracaoEventoExterno_remanejamentoFuncionarioId_idx" ON "IntegracaoEventoExterno"("remanejamentoFuncionarioId");

-- CreateIndex
CREATE INDEX "IntegracaoEventoExterno_cicloId_idx" ON "IntegracaoEventoExterno"("cicloId");

-- CreateIndex
CREATE INDEX "IntegracaoEventoExterno_setor_idx" ON "IntegracaoEventoExterno"("setor");

-- CreateIndex
CREATE INDEX "IntegracaoEventoExterno_numeroCiclo_idx" ON "IntegracaoEventoExterno"("numeroCiclo");

-- CreateIndex
CREATE INDEX "IntegracaoOutbox_eventoExternoId_idx" ON "IntegracaoOutbox"("eventoExternoId");

-- CreateIndex
CREATE INDEX "IntegracaoOutbox_provedor_status_idx" ON "IntegracaoOutbox"("provedor", "status");

-- CreateIndex
CREATE INDEX "IntegracaoOutbox_externalId_idx" ON "IntegracaoOutbox"("externalId");

-- CreateIndex
CREATE INDEX "IntegracaoOutbox_remanejamentoFuncionarioId_idx" ON "IntegracaoOutbox"("remanejamentoFuncionarioId");

-- CreateIndex
CREATE INDEX "IntegracaoOutbox_cicloId_idx" ON "IntegracaoOutbox"("cicloId");

-- CreateIndex
CREATE INDEX "IntegracaoOutbox_proximaTentativaAt_idx" ON "IntegracaoOutbox"("proximaTentativaAt");

-- AddForeignKey
ALTER TABLE "IntegracaoEventoExterno" ADD CONSTRAINT "IntegracaoEventoExterno_remanejamentoFuncionarioId_fkey" FOREIGN KEY ("remanejamentoFuncionarioId") REFERENCES "RemanejamentoFuncionario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegracaoEventoExterno" ADD CONSTRAINT "IntegracaoEventoExterno_cicloId_fkey" FOREIGN KEY ("cicloId") REFERENCES "RemanejamentoCiclo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegracaoOutbox" ADD CONSTRAINT "IntegracaoOutbox_eventoExternoId_fkey" FOREIGN KEY ("eventoExternoId") REFERENCES "IntegracaoEventoExterno"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegracaoOutbox" ADD CONSTRAINT "IntegracaoOutbox_remanejamentoFuncionarioId_fkey" FOREIGN KEY ("remanejamentoFuncionarioId") REFERENCES "RemanejamentoFuncionario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegracaoOutbox" ADD CONSTRAINT "IntegracaoOutbox_cicloId_fkey" FOREIGN KEY ("cicloId") REFERENCES "RemanejamentoCiclo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
