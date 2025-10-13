/*
  Warnings:

  - You are about to drop the column `embarcacaoAtual` on the `Funcionario` table. All the data in the column will be lost.
  - You are about to drop the column `observacoes` on the `Funcionario` table. All the data in the column will be lost.
  - You are about to drop the column `totalDias` on the `Funcionario` table. All the data in the column will be lost.
  - You are about to drop the column `totalDiasPeriodo` on the `Funcionario` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "UptimeSheet" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "matricula" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UptimeSheet_matricula_fkey" FOREIGN KEY ("matricula") REFERENCES "Funcionario" ("matricula") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Funcionario" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "matricula" TEXT NOT NULL,
    "cpf" TEXT,
    "nome" TEXT NOT NULL,
    "funcao" TEXT,
    "rg" TEXT,
    "orgaoEmissor" TEXT,
    "uf" TEXT,
    "dataNascimento" DATETIME,
    "email" TEXT,
    "telefone" TEXT,
    "centroCusto" TEXT,
    "departamento" TEXT,
    "status" TEXT,
    "statusPrestserv" TEXT,
    "emMigracao" BOOLEAN NOT NULL DEFAULT false,
    "contratoId" INTEGER,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL,
    "excluidoEm" DATETIME,
    "sispat" TEXT,
    CONSTRAINT "Funcionario_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "Contrato" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Funcionario" ("atualizadoEm", "centroCusto", "contratoId", "cpf", "criadoEm", "dataNascimento", "departamento", "emMigracao", "email", "excluidoEm", "funcao", "id", "matricula", "nome", "orgaoEmissor", "rg", "sispat", "status", "statusPrestserv", "telefone", "uf") SELECT "atualizadoEm", "centroCusto", "contratoId", "cpf", "criadoEm", "dataNascimento", "departamento", "emMigracao", "email", "excluidoEm", "funcao", "id", "matricula", "nome", "orgaoEmissor", "rg", "sispat", "status", "statusPrestserv", "telefone", "uf" FROM "Funcionario";
DROP TABLE "Funcionario";
ALTER TABLE "new_Funcionario" RENAME TO "Funcionario";
CREATE UNIQUE INDEX "Funcionario_matricula_key" ON "Funcionario"("matricula");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
