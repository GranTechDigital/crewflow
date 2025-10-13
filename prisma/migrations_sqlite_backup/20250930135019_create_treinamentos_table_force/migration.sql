/*
  Warnings:

  - You are about to drop the column `centroCusto` on the `PeriodoSheet` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "Treinamentos" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "treinamento" TEXT NOT NULL,
    "dueDate" DATETIME NOT NULL
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
    CONSTRAINT "PeriodoSheet_projetoId_fkey" FOREIGN KEY ("projetoId") REFERENCES "Projeto" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PeriodoSheet_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "Status" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PeriodoSheet" ("anoReferencia", "codigo", "createdAt", "dataAdmissao", "dataDemissao", "dataFim", "dataInicio", "departamento", "embarcacao", "embarcacaoAtual", "funcao", "id", "matricula", "mesReferencia", "nome", "observacoes", "periodoFinal", "periodoInicial", "projetoId", "regimeTrabalho", "regimeTratado", "sispat", "statusFolha", "statusId", "totalDias", "totalDiasPeriodo") SELECT "anoReferencia", "codigo", "createdAt", "dataAdmissao", "dataDemissao", "dataFim", "dataInicio", "departamento", "embarcacao", "embarcacaoAtual", "funcao", "id", "matricula", "mesReferencia", "nome", "observacoes", "periodoFinal", "periodoInicial", "projetoId", "regimeTrabalho", "regimeTratado", "sispat", "statusFolha", "statusId", "totalDias", "totalDiasPeriodo" FROM "PeriodoSheet";
DROP TABLE "PeriodoSheet";
ALTER TABLE "new_PeriodoSheet" RENAME TO "PeriodoSheet";
CREATE INDEX "PeriodoSheet_mesReferencia_anoReferencia_idx" ON "PeriodoSheet"("mesReferencia", "anoReferencia");
CREATE INDEX "PeriodoSheet_matricula_idx" ON "PeriodoSheet"("matricula");
CREATE INDEX "PeriodoSheet_statusId_idx" ON "PeriodoSheet"("statusId");
CREATE INDEX "PeriodoSheet_projetoId_idx" ON "PeriodoSheet"("projetoId");
CREATE INDEX "PeriodoSheet_regimeTratado_idx" ON "PeriodoSheet"("regimeTratado");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Treinamentos_dueDate_idx" ON "Treinamentos"("dueDate");

-- CreateIndex
CREATE INDEX "Treinamentos_treinamento_idx" ON "Treinamentos"("treinamento");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Funcao_funcao_idx" ON "Funcao"("funcao");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Funcao_regime_idx" ON "Funcao"("regime");
