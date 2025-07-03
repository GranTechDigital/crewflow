/*
  Warnings:

  - You are about to drop the `ObservacaoPendencia` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Pendencia` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "ObservacaoPendencia";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Pendencia";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "Tarefa" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "funcionarioId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "descricao" TEXT,
    "equipe" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pendente',
    "prioridade" TEXT NOT NULL DEFAULT 'Média',
    "dataCriacao" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataAtualizacao" DATETIME NOT NULL,
    "dataLimite" DATETIME,
    "dataConclusao" DATETIME,
    "criadoPor" TEXT NOT NULL,
    "atualizadoPor" TEXT NOT NULL,
    CONSTRAINT "Tarefa_funcionarioId_fkey" FOREIGN KEY ("funcionarioId") REFERENCES "Funcionario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ObservacaoTarefa" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tarefaId" INTEGER NOT NULL,
    "texto" TEXT NOT NULL,
    "dataCriacao" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataModificacao" DATETIME NOT NULL,
    "criadoPor" TEXT NOT NULL,
    "modificadoPor" TEXT NOT NULL,
    CONSTRAINT "ObservacaoTarefa_tarefaId_fkey" FOREIGN KEY ("tarefaId") REFERENCES "Tarefa" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
