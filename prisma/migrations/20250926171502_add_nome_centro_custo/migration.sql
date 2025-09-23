/*
  Warnings:

  - You are about to drop the column `cc` on the `CentroCustoProjeto` table. All the data in the column will be lost.
  - You are about to drop the column `ccNome` on the `CentroCustoProjeto` table. All the data in the column will be lost.
  - You are about to drop the column `ccProjeto` on the `CentroCustoProjeto` table. All the data in the column will be lost.
  - You are about to drop the column `grupo1` on the `CentroCustoProjeto` table. All the data in the column will be lost.
  - You are about to drop the column `grupo2` on the `CentroCustoProjeto` table. All the data in the column will be lost.
  - You are about to drop the column `nomeCc` on the `CentroCustoProjeto` table. All the data in the column will be lost.
  - You are about to drop the column `projeto` on the `CentroCustoProjeto` table. All the data in the column will be lost.
  - You are about to drop the column `centroCusto` on the `PeriodoSheet` table. All the data in the column will be lost.
  - You are about to drop the column `centroCustoProjetoId` on the `PeriodoSheet` table. All the data in the column will be lost.
  - You are about to drop the column `codigoCentroCusto` on the `PeriodoSheet` table. All the data in the column will be lost.
  - You are about to drop the column `empresa` on the `PeriodoSheet` table. All the data in the column will be lost.
  - You are about to drop the column `formula` on the `PeriodoSheet` table. All the data in the column will be lost.
  - You are about to drop the column `lider` on the `PeriodoSheet` table. All the data in the column will be lost.
  - You are about to drop the column `observacoesAnterior` on the `PeriodoSheet` table. All the data in the column will be lost.
  - You are about to drop the column `plataforma` on the `PeriodoSheet` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `PeriodoSheet` table. All the data in the column will be lost.
  - You are about to drop the column `statusMappingId` on the `PeriodoSheet` table. All the data in the column will be lost.
  - You are about to drop the column `categoria` on the `StatusMapping` table. All the data in the column will be lost.
  - Added the required column `centroCusto` to the `CentroCustoProjeto` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nomeCentroCusto` to the `CentroCustoProjeto` table without a default value. This is not possible if the table is not empty.
  - Added the required column `projetoId` to the `CentroCustoProjeto` table without a default value. This is not possible if the table is not empty.
  - Added the required column `statusId` to the `StatusMapping` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "Status" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "categoria" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Projeto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CentroCustoProjeto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "centroCusto" TEXT NOT NULL,
    "nomeCentroCusto" TEXT NOT NULL,
    "projetoId" INTEGER NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CentroCustoProjeto_projetoId_fkey" FOREIGN KEY ("projetoId") REFERENCES "Projeto" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_CentroCustoProjeto" ("ativo", "createdAt", "id", "updatedAt") SELECT "ativo", "createdAt", "id", "updatedAt" FROM "CentroCustoProjeto";
DROP TABLE "CentroCustoProjeto";
ALTER TABLE "new_CentroCustoProjeto" RENAME TO "CentroCustoProjeto";
CREATE INDEX "CentroCustoProjeto_centroCusto_idx" ON "CentroCustoProjeto"("centroCusto");
CREATE INDEX "CentroCustoProjeto_projetoId_idx" ON "CentroCustoProjeto"("projetoId");
CREATE INDEX "CentroCustoProjeto_ativo_idx" ON "CentroCustoProjeto"("ativo");
CREATE UNIQUE INDEX "CentroCustoProjeto_centroCusto_projetoId_key" ON "CentroCustoProjeto"("centroCusto", "projetoId");
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
    "statusFolha" TEXT,
    "codigo" TEXT,
    "observacoes" TEXT,
    "embarcacaoAtual" TEXT,
    "sispat" TEXT,
    "departamento" TEXT,
    "regimeTrabalho" TEXT,
    "regimeTratado" TEXT,
    "statusId" INTEGER,
    "projetoId" INTEGER,
    "mesReferencia" INTEGER NOT NULL,
    "anoReferencia" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PeriodoSheet_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "Status" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PeriodoSheet_projetoId_fkey" FOREIGN KEY ("projetoId") REFERENCES "Projeto" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PeriodoSheet" ("anoReferencia", "codigo", "createdAt", "dataAdmissao", "dataDemissao", "dataFim", "dataInicio", "departamento", "embarcacao", "embarcacaoAtual", "funcao", "id", "matricula", "mesReferencia", "nome", "observacoes", "periodoFinal", "periodoInicial", "regimeTrabalho", "sispat", "statusFolha", "totalDias", "totalDiasPeriodo") SELECT "anoReferencia", "codigo", "createdAt", "dataAdmissao", "dataDemissao", "dataFim", "dataInicio", "departamento", "embarcacao", "embarcacaoAtual", "funcao", "id", "matricula", "mesReferencia", "nome", "observacoes", "periodoFinal", "periodoInicial", "regimeTrabalho", "sispat", "statusFolha", "totalDias", "totalDiasPeriodo" FROM "PeriodoSheet";
DROP TABLE "PeriodoSheet";
ALTER TABLE "new_PeriodoSheet" RENAME TO "PeriodoSheet";
CREATE INDEX "PeriodoSheet_mesReferencia_anoReferencia_idx" ON "PeriodoSheet"("mesReferencia", "anoReferencia");
CREATE INDEX "PeriodoSheet_matricula_idx" ON "PeriodoSheet"("matricula");
CREATE INDEX "PeriodoSheet_statusId_idx" ON "PeriodoSheet"("statusId");
CREATE INDEX "PeriodoSheet_projetoId_idx" ON "PeriodoSheet"("projetoId");
CREATE INDEX "PeriodoSheet_regimeTratado_idx" ON "PeriodoSheet"("regimeTratado");
CREATE TABLE "new_StatusMapping" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "statusGeral" TEXT NOT NULL,
    "statusId" INTEGER NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StatusMapping_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "Status" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_StatusMapping" ("ativo", "createdAt", "id", "statusGeral", "updatedAt") SELECT "ativo", "createdAt", "id", "statusGeral", "updatedAt" FROM "StatusMapping";
DROP TABLE "StatusMapping";
ALTER TABLE "new_StatusMapping" RENAME TO "StatusMapping";
CREATE UNIQUE INDEX "StatusMapping_statusGeral_key" ON "StatusMapping"("statusGeral");
CREATE INDEX "StatusMapping_statusId_idx" ON "StatusMapping"("statusId");
CREATE INDEX "StatusMapping_ativo_idx" ON "StatusMapping"("ativo");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Status_categoria_key" ON "Status"("categoria");

-- CreateIndex
CREATE INDEX "Status_categoria_idx" ON "Status"("categoria");

-- CreateIndex
CREATE INDEX "Status_ativo_idx" ON "Status"("ativo");

-- CreateIndex
CREATE UNIQUE INDEX "Projeto_nome_key" ON "Projeto"("nome");

-- CreateIndex
CREATE INDEX "Projeto_nome_idx" ON "Projeto"("nome");

-- CreateIndex
CREATE INDEX "Projeto_ativo_idx" ON "Projeto"("ativo");
