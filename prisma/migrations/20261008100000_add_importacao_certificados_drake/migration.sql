-- CreateTable
CREATE TABLE "ImportacaoCertificadoDrake" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "nomeArquivo" TEXT NOT NULL,
    "hashArquivo" TEXT NOT NULL,
    "tamanhoArquivoBytes" INTEGER,
    "ambiente" TEXT NOT NULL DEFAULT 'hmg',
    "status" TEXT NOT NULL DEFAULT 'ANALISANDO',
    "totalLinhas" INTEGER NOT NULL DEFAULT 0,
    "totalValidas" INTEGER NOT NULL DEFAULT 0,
    "totalErroValidacao" INTEGER NOT NULL DEFAULT 0,
    "totalDuplicadas" INTEGER NOT NULL DEFAULT 0,
    "totalConflitos" INTEGER NOT NULL DEFAULT 0,
    "totalPendentes" INTEGER NOT NULL DEFAULT 0,
    "totalEnviadas" INTEGER NOT NULL DEFAULT 0,
    "totalConfirmadas" INTEGER NOT NULL DEFAULT 0,
    "totalErroDrake" INTEGER NOT NULL DEFAULT 0,
    "totalNaoConfirmadas" INTEGER NOT NULL DEFAULT 0,
    "drakeSessionId" TEXT,
    "ultimoErro" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportacaoCertificadoDrake_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportacaoCertificadoDrakeItem" (
    "id" SERIAL NOT NULL,
    "importacaoId" INTEGER NOT NULL,
    "funcionarioId" INTEGER,
    "numeroLinha" INTEGER NOT NULL,
    "matricula" TEXT NOT NULL,
    "nome" TEXT,
    "certificadora" TEXT,
    "qualificacao" TEXT NOT NULL,
    "qualificacaoNormalizada" TEXT NOT NULL,
    "tipoDocumento" TEXT NOT NULL,
    "tipoDocumentoNormalizado" TEXT NOT NULL,
    "emissao" TIMESTAMP(3),
    "validade" TIMESTAMP(3),
    "recebimento" TIMESTAMP(3),
    "chaveIdempotencia" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'VALIDO',
    "motivoErro" TEXT,
    "payload" JSONB,
    "respostaDrake" JSONB,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "enviadoEm" TIMESTAMP(3),
    "confirmadoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportacaoCertificadoDrakeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportacaoCertificadoDrakeTentativa" (
    "id" SERIAL NOT NULL,
    "itemId" INTEGER NOT NULL,
    "importacaoId" INTEGER NOT NULL,
    "modoEnvio" TEXT NOT NULL DEFAULT 'UNITARIO',
    "status" TEXT NOT NULL,
    "payload" JSONB,
    "resposta" JSONB,
    "erro" TEXT,
    "httpStatus" INTEGER,
    "sessionId" TEXT,
    "numeroLoteBulk" INTEGER,
    "iniciadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizadoEm" TIMESTAMP(3),
    "duracaoMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportacaoCertificadoDrakeTentativa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ImportacaoCertificadoDrake_hashArquivo_key" ON "ImportacaoCertificadoDrake"("hashArquivo");

-- CreateIndex
CREATE INDEX "ImportacaoCertificadoDrake_usuarioId_idx" ON "ImportacaoCertificadoDrake"("usuarioId");

-- CreateIndex
CREATE INDEX "ImportacaoCertificadoDrake_ambiente_idx" ON "ImportacaoCertificadoDrake"("ambiente");

-- CreateIndex
CREATE INDEX "ImportacaoCertificadoDrake_status_idx" ON "ImportacaoCertificadoDrake"("status");

-- CreateIndex
CREATE INDEX "ImportacaoCertificadoDrake_createdAt_idx" ON "ImportacaoCertificadoDrake"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ImportacaoCertificadoDrakeItem_importacaoId_numeroLinha_key" ON "ImportacaoCertificadoDrakeItem"("importacaoId", "numeroLinha");

-- CreateIndex
CREATE INDEX "ImportacaoCertificadoDrakeItem_importacaoId_status_idx" ON "ImportacaoCertificadoDrakeItem"("importacaoId", "status");

-- CreateIndex
CREATE INDEX "ImportacaoCertificadoDrakeItem_chaveIdempotencia_idx" ON "ImportacaoCertificadoDrakeItem"("chaveIdempotencia");

-- CreateIndex
CREATE INDEX "ImportacaoCertificadoDrakeItem_matricula_idx" ON "ImportacaoCertificadoDrakeItem"("matricula");

-- CreateIndex
CREATE INDEX "ImportacaoCertificadoDrakeItem_funcionarioId_idx" ON "ImportacaoCertificadoDrakeItem"("funcionarioId");

-- CreateIndex
CREATE INDEX "ImportacaoCertificadoDrakeItem_qualificacaoNormalizada_idx" ON "ImportacaoCertificadoDrakeItem"("qualificacaoNormalizada");

-- CreateIndex
CREATE INDEX "ImportacaoCertificadoDrakeTentativa_itemId_idx" ON "ImportacaoCertificadoDrakeTentativa"("itemId");

-- CreateIndex
CREATE INDEX "ImportacaoCertificadoDrakeTentativa_importacaoId_idx" ON "ImportacaoCertificadoDrakeTentativa"("importacaoId");

-- CreateIndex
CREATE INDEX "ImportacaoCertificadoDrakeTentativa_status_idx" ON "ImportacaoCertificadoDrakeTentativa"("status");

-- CreateIndex
CREATE INDEX "ImportacaoCertificadoDrakeTentativa_modoEnvio_idx" ON "ImportacaoCertificadoDrakeTentativa"("modoEnvio");

-- CreateIndex
CREATE INDEX "ImportacaoCertificadoDrakeTentativa_iniciadoEm_idx" ON "ImportacaoCertificadoDrakeTentativa"("iniciadoEm");

-- AddForeignKey
ALTER TABLE "ImportacaoCertificadoDrake" ADD CONSTRAINT "ImportacaoCertificadoDrake_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportacaoCertificadoDrakeItem" ADD CONSTRAINT "ImportacaoCertificadoDrakeItem_importacaoId_fkey" FOREIGN KEY ("importacaoId") REFERENCES "ImportacaoCertificadoDrake"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportacaoCertificadoDrakeItem" ADD CONSTRAINT "ImportacaoCertificadoDrakeItem_funcionarioId_fkey" FOREIGN KEY ("funcionarioId") REFERENCES "Funcionario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportacaoCertificadoDrakeTentativa" ADD CONSTRAINT "ImportacaoCertificadoDrakeTentativa_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ImportacaoCertificadoDrakeItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportacaoCertificadoDrakeTentativa" ADD CONSTRAINT "ImportacaoCertificadoDrakeTentativa_importacaoId_fkey" FOREIGN KEY ("importacaoId") REFERENCES "ImportacaoCertificadoDrake"("id") ON DELETE CASCADE ON UPDATE CASCADE;
