/*
  Warnings:

  - You are about to drop the column `descricao` on the `Funcao` table. All the data in the column will be lost.
  - You are about to drop the column `tipoTreinamento` on the `Treinamentos` table. All the data in the column will be lost.
  - Added the required column `codigo` to the `Projeto` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "MatrizTreinamento" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "contratoId" INTEGER NOT NULL,
    "funcaoId" INTEGER NOT NULL,
    "treinamentoId" INTEGER NOT NULL,
    "tipoObrigatoriedade" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MatrizTreinamento_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "Contrato" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MatrizTreinamento_funcaoId_fkey" FOREIGN KEY ("funcaoId") REFERENCES "Funcao" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MatrizTreinamento_treinamentoId_fkey" FOREIGN KEY ("treinamentoId") REFERENCES "Treinamentos" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Funcao" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "funcao" TEXT NOT NULL,
    "regime" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Funcao" ("ativo", "createdAt", "funcao", "id", "regime", "updatedAt") SELECT "ativo", "createdAt", "funcao", "id", "regime", "updatedAt" FROM "Funcao";
DROP TABLE "Funcao";
ALTER TABLE "new_Funcao" RENAME TO "Funcao";
CREATE UNIQUE INDEX "Funcao_funcao_key" ON "Funcao"("funcao");
CREATE INDEX "Funcao_funcao_idx" ON "Funcao"("funcao");
CREATE INDEX "Funcao_regime_idx" ON "Funcao"("regime");
CREATE TABLE "new_Projeto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Projeto" ("ativo", "createdAt", "id", "nome", "updatedAt") SELECT "ativo", "createdAt", "id", "nome", "updatedAt" FROM "Projeto";
DROP TABLE "Projeto";
ALTER TABLE "new_Projeto" RENAME TO "Projeto";
CREATE UNIQUE INDEX "Projeto_codigo_key" ON "Projeto"("codigo");
CREATE UNIQUE INDEX "Projeto_nome_key" ON "Projeto"("nome");
CREATE INDEX "Projeto_codigo_idx" ON "Projeto"("codigo");
CREATE INDEX "Projeto_nome_idx" ON "Projeto"("nome");
CREATE INDEX "Projeto_ativo_idx" ON "Projeto"("ativo");
CREATE TABLE "new_Treinamentos" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "treinamento" TEXT NOT NULL,
    "cargaHoraria" INTEGER NOT NULL,
    "validadeValor" INTEGER NOT NULL,
    "validadeUnidade" TEXT NOT NULL
);
INSERT INTO "new_Treinamentos" ("cargaHoraria", "criadoEm", "id", "treinamento", "validadeUnidade", "validadeValor") SELECT "cargaHoraria", "criadoEm", "id", "treinamento", "validadeUnidade", "validadeValor" FROM "Treinamentos";
DROP TABLE "Treinamentos";
ALTER TABLE "new_Treinamentos" RENAME TO "Treinamentos";
CREATE INDEX "Treinamentos_treinamento_idx" ON "Treinamentos"("treinamento");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "MatrizTreinamento_contratoId_idx" ON "MatrizTreinamento"("contratoId");

-- CreateIndex
CREATE INDEX "MatrizTreinamento_funcaoId_idx" ON "MatrizTreinamento"("funcaoId");

-- CreateIndex
CREATE INDEX "MatrizTreinamento_treinamentoId_idx" ON "MatrizTreinamento"("treinamentoId");

-- CreateIndex
CREATE INDEX "MatrizTreinamento_tipoObrigatoriedade_idx" ON "MatrizTreinamento"("tipoObrigatoriedade");

-- CreateIndex
CREATE UNIQUE INDEX "MatrizTreinamento_contratoId_funcaoId_treinamentoId_key" ON "MatrizTreinamento"("contratoId", "funcaoId", "treinamentoId");
