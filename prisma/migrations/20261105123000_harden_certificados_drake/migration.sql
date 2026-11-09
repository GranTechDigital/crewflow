-- Histórico separado por ambiente; preserva os lotes e tentativas existentes.
DROP INDEX "ImportacaoCertificadoDrake_hashArquivo_key";
CREATE UNIQUE INDEX "ImportacaoCertificadoDrake_ambiente_hashArquivo_key" ON "ImportacaoCertificadoDrake"("ambiente", "hashArquivo");
ALTER TABLE "ImportacaoCertificadoDrake" ADD COLUMN "envioToken" TEXT, ADD COLUMN "envioHeartbeatEm" TIMESTAMP(3);
ALTER TABLE "ImportacaoCertificadoDrakeItem" ADD COLUMN "dadosOriginais" JSONB;
ALTER TABLE "ImportacaoCertificadoDrakeTentativa" ADD COLUMN "usuarioId" INTEGER, ADD COLUMN "usuarioNome" TEXT;
