/*
  Warnings:

  - You are about to drop the column `dueDate` on the `Treinamentos` table. All the data in the column will be lost.
  - Added the required column `cargaHoraria` to the `Treinamentos` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tipoTreinamento` to the `Treinamentos` table without a default value. This is not possible if the table is not empty.
  - Added the required column `validadeUnidade` to the `Treinamentos` table without a default value. This is not possible if the table is not empty.
  - Added the required column `validadeValor` to the `Treinamentos` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Treinamentos" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "treinamento" TEXT NOT NULL,
    "cargaHoraria" INTEGER NOT NULL,
    "validadeValor" INTEGER NOT NULL,
    "validadeUnidade" TEXT NOT NULL,
    "tipoTreinamento" TEXT NOT NULL
);
INSERT INTO "new_Treinamentos" ("criadoEm", "id", "treinamento") SELECT "criadoEm", "id", "treinamento" FROM "Treinamentos";
DROP TABLE "Treinamentos";
ALTER TABLE "new_Treinamentos" RENAME TO "Treinamentos";
CREATE INDEX "Treinamentos_treinamento_idx" ON "Treinamentos"("treinamento");
CREATE INDEX "Treinamentos_tipoTreinamento_idx" ON "Treinamentos"("tipoTreinamento");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
