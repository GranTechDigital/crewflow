-- CreateTable
CREATE TABLE "PeriodoSheet" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "matricula" TEXT NOT NULL,
    "dataAdmissao" DATETIME,
    "dataDemissao" DATETIME,
    "dataInicio" DATETIME,
    "dataFim" DATETIME,
    "periodoInicial" DATETIME,
    "periodoFinal" DATETIME,
    "totalDias" INTEGER,
    "totalDiasPeriodo" INTEGER,
    "nome" TEXT,
    "funcao" TEXT,
    "status" TEXT,
    "embarcacao" TEXT,
    "observacoes" TEXT,
    "sispat" TEXT,
    "departamento" TEXT,
    "centroCusto" TEXT,
    "mesReferencia" INTEGER NOT NULL,
    "anoReferencia" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PeriodoSheet_matricula_fkey" FOREIGN KEY ("matricula") REFERENCES "Funcionario" ("matricula") ON DELETE NO ACTION ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PeriodoUpload" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "dataUpload" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataRelatorio" DATETIME,
    "nomeArquivo" TEXT,
    "registros" INTEGER NOT NULL,
    "atualizados" INTEGER NOT NULL,
    "naoEncontrados" INTEGER NOT NULL,
    "uploadPor" TEXT NOT NULL,
    "funcionarioId" INTEGER,
    "mesReferencia" INTEGER NOT NULL,
    "anoReferencia" INTEGER NOT NULL,
    "periodoInicial" DATETIME NOT NULL,
    "periodoFinal" DATETIME NOT NULL,
    "totalDiasPeriodo" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PeriodoUpload_funcionarioId_fkey" FOREIGN KEY ("funcionarioId") REFERENCES "Funcionario" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PeriodoSheet_mesReferencia_anoReferencia_idx" ON "PeriodoSheet"("mesReferencia", "anoReferencia");

-- CreateIndex
CREATE INDEX "PeriodoSheet_matricula_idx" ON "PeriodoSheet"("matricula");

-- CreateIndex
CREATE INDEX "PeriodoUpload_dataUpload_idx" ON "PeriodoUpload"("dataUpload");

-- CreateIndex
CREATE INDEX "PeriodoUpload_dataRelatorio_idx" ON "PeriodoUpload"("dataRelatorio");

-- CreateIndex
CREATE INDEX "PeriodoUpload_mesReferencia_anoReferencia_idx" ON "PeriodoUpload"("mesReferencia", "anoReferencia");
