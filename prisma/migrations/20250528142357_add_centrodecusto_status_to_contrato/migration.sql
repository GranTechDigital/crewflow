/*
  Warnings:

  - Added the required column `centroDeCusto` to the `Contrato` table without a default value. This is not possible if the table is not empty.
  - Added the required column `status` to the `Contrato` table without a default value. This is not possible if the table is not empty.

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
    "centroDeCusto" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Contrato" ("cliente", "createdAt", "dataFim", "dataInicio", "id", "nome", "numero") SELECT "cliente", "createdAt", "dataFim", "dataInicio", "id", "nome", "numero" FROM "Contrato";
DROP TABLE "Contrato";
ALTER TABLE "new_Contrato" RENAME TO "Contrato";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
