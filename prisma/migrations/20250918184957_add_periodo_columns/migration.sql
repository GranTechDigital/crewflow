/*
  Warnings:

  - You are about to alter the column `downtime` on the `downtime_sheet` table. The data in that column could be lost. The data in that column will be cast from `String` to `Float`.
  - You are about to alter the column `percentAgEmbarque` on the `downtime_sheet` table. The data in that column could be lost. The data in that column will be cast from `String` to `Float`.
  - You are about to alter the column `percentAtestado` on the `downtime_sheet` table. The data in that column could be lost. The data in that column will be cast from `String` to `Float`.
  - You are about to alter the column `percentCadastro` on the `downtime_sheet` table. The data in that column could be lost. The data in that column will be cast from `String` to `Float`.
  - You are about to alter the column `percentDemissao` on the `downtime_sheet` table. The data in that column could be lost. The data in that column will be cast from `String` to `Float`.
  - You are about to alter the column `percentFalta` on the `downtime_sheet` table. The data in that column could be lost. The data in that column will be cast from `String` to `Float`.
  - You are about to alter the column `percentMedicina` on the `downtime_sheet` table. The data in that column could be lost. The data in that column will be cast from `String` to `Float`.
  - You are about to alter the column `percentTreinamento` on the `downtime_sheet` table. The data in that column could be lost. The data in that column will be cast from `String` to `Float`.
  - You are about to alter the column `uptime` on the `downtime_sheet` table. The data in that column could be lost. The data in that column will be cast from `String` to `Float`.

*/
-- AlterTable
ALTER TABLE "UptimeSheet" ADD COLUMN "periodoFinal" DATETIME;
ALTER TABLE "UptimeSheet" ADD COLUMN "periodoInicial" DATETIME;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_downtime_sheet" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "codProjeto" TEXT,
    "nomeProjeto" TEXT,
    "uptime" REAL,
    "downtime" REAL,
    "agEmbarque" INTEGER,
    "percentAgEmbarque" REAL,
    "cadastro" INTEGER,
    "percentCadastro" REAL,
    "medicina" INTEGER,
    "percentMedicina" REAL,
    "treinamento" INTEGER,
    "percentTreinamento" REAL,
    "atestado" INTEGER,
    "percentAtestado" REAL,
    "falta" INTEGER,
    "percentFalta" REAL,
    "demissao" INTEGER,
    "percentDemissao" REAL,
    "dataUpload" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nomeArquivo" TEXT,
    "uploadPor" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_downtime_sheet" ("agEmbarque", "atestado", "cadastro", "codProjeto", "createdAt", "dataUpload", "demissao", "downtime", "falta", "id", "medicina", "nomeArquivo", "nomeProjeto", "percentAgEmbarque", "percentAtestado", "percentCadastro", "percentDemissao", "percentFalta", "percentMedicina", "percentTreinamento", "treinamento", "uploadPor", "uptime") SELECT "agEmbarque", "atestado", "cadastro", "codProjeto", "createdAt", "dataUpload", "demissao", "downtime", "falta", "id", "medicina", "nomeArquivo", "nomeProjeto", "percentAgEmbarque", "percentAtestado", "percentCadastro", "percentDemissao", "percentFalta", "percentMedicina", "percentTreinamento", "treinamento", "uploadPor", "uptime" FROM "downtime_sheet";
DROP TABLE "downtime_sheet";
ALTER TABLE "new_downtime_sheet" RENAME TO "downtime_sheet";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
