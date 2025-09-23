-- AlterTable
ALTER TABLE "Funcionario" ADD COLUMN "embarcacaoAtual" TEXT;
ALTER TABLE "Funcionario" ADD COLUMN "observacoes" TEXT;
ALTER TABLE "Funcionario" ADD COLUMN "totalDias" INTEGER DEFAULT 0;
ALTER TABLE "Funcionario" ADD COLUMN "totalDiasPeriodo" INTEGER DEFAULT 0;

-- CreateTable
CREATE TABLE "UptimeUpload" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "dataUpload" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nomeArquivo" TEXT,
    "registros" INTEGER NOT NULL,
    "atualizados" INTEGER NOT NULL,
    "naoEncontrados" INTEGER NOT NULL,
    "uploadPor" TEXT NOT NULL,
    "funcionarioId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UptimeUpload_funcionarioId_fkey" FOREIGN KEY ("funcionarioId") REFERENCES "Funcionario" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "UptimeUpload_dataUpload_idx" ON "UptimeUpload"("dataUpload");
