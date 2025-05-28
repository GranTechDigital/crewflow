/*
  Warnings:

  - You are about to drop the column `nomeContrato` on the `Contrato` table. All the data in the column will be lost.
  - You are about to drop the column `numeroContrato` on the `Contrato` table. All the data in the column will be lost.
  - Added the required column `nome` to the `Contrato` table without a default value. This is not possible if the table is not empty.
  - Added the required column `numero` to the `Contrato` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Contrato" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "numero" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cliente" TEXT NOT NULL,
    "dataInicio" DATETIME NOT NULL,
    "dataFim" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Contrato" ("cliente", "dataFim", "dataInicio", "id") SELECT "cliente", "dataFim", "dataInicio", "id" FROM "Contrato";
DROP TABLE "Contrato";
ALTER TABLE "new_Contrato" RENAME TO "Contrato";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
