/*
  Warnings:

  - You are about to drop the column `data` on the `UptimeSheet` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_UptimeSheet" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "matricula" TEXT NOT NULL,
    "dataAdmissao" DATETIME,
    "dataDemissao" DATETIME,
    "dataInicio" DATETIME,
    "dataFim" DATETIME,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UptimeSheet_matricula_fkey" FOREIGN KEY ("matricula") REFERENCES "Funcionario" ("matricula") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_UptimeSheet" ("createdAt", "id", "matricula") SELECT "createdAt", "id", "matricula" FROM "UptimeSheet";
DROP TABLE "UptimeSheet";
ALTER TABLE "new_UptimeSheet" RENAME TO "UptimeSheet";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
