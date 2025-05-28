/*
  Warnings:

  - You are about to drop the column `data_nascimento` on the `Funcionario` table. All the data in the column will be lost.
  - You are about to drop the column `orgao_emissor` on the `Funcionario` table. All the data in the column will be lost.
  - Added the required column `atualizadoEm` to the `Funcionario` table without a default value. This is not possible if the table is not empty.
  - Made the column `matricula` on table `Funcionario` required. This step will fail if there are existing NULL values in that column.

*/
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
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL,
    "excluidoEm" DATETIME
);
INSERT INTO "new_Funcionario" ("centroCusto", "cpf", "departamento", "email", "funcao", "id", "matricula", "nome", "rg", "status", "telefone", "uf") SELECT "centroCusto", "cpf", "departamento", "email", "funcao", "id", "matricula", "nome", "rg", "status", "telefone", "uf" FROM "Funcionario";
DROP TABLE "Funcionario";
ALTER TABLE "new_Funcionario" RENAME TO "Funcionario";
CREATE UNIQUE INDEX "Funcionario_matricula_key" ON "Funcionario"("matricula");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
