/*
  Warnings:

  - You are about to drop the column `centroCusto` on the `PeriodoSheet` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `PeriodoSheet` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "CentroCustoProjeto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cc" TEXT NOT NULL,
    "ccProjeto" TEXT NOT NULL,
    "nomeCc" TEXT NOT NULL,
    "ccNome" TEXT NOT NULL,
    "projeto" TEXT NOT NULL,
    "grupo1" TEXT NOT NULL,
    "grupo2" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PeriodoSheet" (
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
    "embarcacao" TEXT,
    "observacoes" TEXT,
    "sispat" TEXT,
    "departamento" TEXT,
    "regimeTrabalho" TEXT,
    "statusMappingId" INTEGER,
    "centroCustoProjetoId" INTEGER,
    "mesReferencia" INTEGER NOT NULL,
    "anoReferencia" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PeriodoSheet_matricula_fkey" FOREIGN KEY ("matricula") REFERENCES "Funcionario" ("matricula") ON DELETE NO ACTION ON UPDATE CASCADE,
    CONSTRAINT "PeriodoSheet_statusMappingId_fkey" FOREIGN KEY ("statusMappingId") REFERENCES "StatusMapping" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PeriodoSheet_centroCustoProjetoId_fkey" FOREIGN KEY ("centroCustoProjetoId") REFERENCES "CentroCustoProjeto" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PeriodoSheet" ("anoReferencia", "createdAt", "dataAdmissao", "dataDemissao", "dataFim", "dataInicio", "departamento", "embarcacao", "funcao", "id", "matricula", "mesReferencia", "nome", "observacoes", "periodoFinal", "periodoInicial", "sispat", "totalDias", "totalDiasPeriodo") SELECT "anoReferencia", "createdAt", "dataAdmissao", "dataDemissao", "dataFim", "dataInicio", "departamento", "embarcacao", "funcao", "id", "matricula", "mesReferencia", "nome", "observacoes", "periodoFinal", "periodoInicial", "sispat", "totalDias", "totalDiasPeriodo" FROM "PeriodoSheet";
DROP TABLE "PeriodoSheet";
ALTER TABLE "new_PeriodoSheet" RENAME TO "PeriodoSheet";
CREATE INDEX "PeriodoSheet_mesReferencia_anoReferencia_idx" ON "PeriodoSheet"("mesReferencia", "anoReferencia");
CREATE INDEX "PeriodoSheet_matricula_idx" ON "PeriodoSheet"("matricula");
CREATE INDEX "PeriodoSheet_statusMappingId_idx" ON "PeriodoSheet"("statusMappingId");
CREATE INDEX "PeriodoSheet_centroCustoProjetoId_idx" ON "PeriodoSheet"("centroCustoProjetoId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "CentroCustoProjeto_cc_key" ON "CentroCustoProjeto"("cc");

-- CreateIndex
CREATE INDEX "CentroCustoProjeto_cc_idx" ON "CentroCustoProjeto"("cc");

-- CreateIndex
CREATE INDEX "CentroCustoProjeto_projeto_idx" ON "CentroCustoProjeto"("projeto");

-- CreateIndex
CREATE INDEX "CentroCustoProjeto_grupo1_idx" ON "CentroCustoProjeto"("grupo1");

-- CreateIndex
CREATE INDEX "CentroCustoProjeto_grupo2_idx" ON "CentroCustoProjeto"("grupo2");

-- CreateIndex
CREATE INDEX "CentroCustoProjeto_ativo_idx" ON "CentroCustoProjeto"("ativo");
