/*
  Warnings:

  - You are about to drop the `ObservacaoTarefa` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Tarefa` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "ObservacaoTarefa";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Tarefa";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "ObservacaoTarefaRemanejamento" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tarefaId" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "dataCriacao" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataModificacao" DATETIME NOT NULL,
    "criadoPor" TEXT NOT NULL,
    "modificadoPor" TEXT NOT NULL,
    CONSTRAINT "ObservacaoTarefaRemanejamento_tarefaId_fkey" FOREIGN KEY ("tarefaId") REFERENCES "TarefaRemanejamento" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
