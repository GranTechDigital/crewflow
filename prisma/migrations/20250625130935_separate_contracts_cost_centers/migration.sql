/*
  Warnings:

  - You are about to drop the column `centroDeCusto` on the `Contrato` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "CentroCusto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "num_centro_custo" TEXT NOT NULL,
    "nome_centro_custo" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ContratosCentrosCusto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "contratoId" INTEGER NOT NULL,
    "centroCustoId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContratosCentrosCusto_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "Contrato" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ContratosCentrosCusto_centroCustoId_fkey" FOREIGN KEY ("centroCustoId") REFERENCES "CentroCusto" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Contrato" ("cliente", "createdAt", "dataFim", "dataInicio", "id", "nome", "numero", "status") SELECT "cliente", "createdAt", "dataFim", "dataInicio", "id", "nome", "numero", "status" FROM "Contrato";
DROP TABLE "Contrato";
ALTER TABLE "new_Contrato" RENAME TO "Contrato";
CREATE TABLE "new_SolicitacaoRemanejamento" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "funcionarioId" INTEGER NOT NULL,
    "contratoOrigemId" INTEGER,
    "centroCustoOrigem" TEXT NOT NULL,
    "contratoDestinoId" INTEGER,
    "centroCustoDestino" TEXT NOT NULL,
    "justificativa" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Pendente',
    "prioridade" TEXT NOT NULL DEFAULT 'Normal',
    "solicitadoPor" TEXT NOT NULL,
    "analisadoPor" TEXT,
    "dataSolicitacao" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataAnalise" DATETIME,
    "dataAprovacao" DATETIME,
    "observacoes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SolicitacaoRemanejamento_funcionarioId_fkey" FOREIGN KEY ("funcionarioId") REFERENCES "Funcionario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SolicitacaoRemanejamento_contratoOrigemId_fkey" FOREIGN KEY ("contratoOrigemId") REFERENCES "Contrato" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SolicitacaoRemanejamento_contratoDestinoId_fkey" FOREIGN KEY ("contratoDestinoId") REFERENCES "Contrato" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_SolicitacaoRemanejamento" ("analisadoPor", "centroCustoDestino", "centroCustoOrigem", "contratoDestinoId", "contratoOrigemId", "createdAt", "dataAnalise", "dataAprovacao", "dataSolicitacao", "funcionarioId", "id", "justificativa", "observacoes", "prioridade", "solicitadoPor", "status", "updatedAt") SELECT "analisadoPor", "centroCustoDestino", "centroCustoOrigem", "contratoDestinoId", "contratoOrigemId", "createdAt", "dataAnalise", "dataAprovacao", "dataSolicitacao", "funcionarioId", "id", "justificativa", "observacoes", "prioridade", "solicitadoPor", "status", "updatedAt" FROM "SolicitacaoRemanejamento";
DROP TABLE "SolicitacaoRemanejamento";
ALTER TABLE "new_SolicitacaoRemanejamento" RENAME TO "SolicitacaoRemanejamento";
CREATE INDEX "SolicitacaoRemanejamento_funcionarioId_idx" ON "SolicitacaoRemanejamento"("funcionarioId");
CREATE INDEX "SolicitacaoRemanejamento_status_idx" ON "SolicitacaoRemanejamento"("status");
CREATE INDEX "SolicitacaoRemanejamento_dataSolicitacao_idx" ON "SolicitacaoRemanejamento"("dataSolicitacao");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "CentroCusto_num_centro_custo_key" ON "CentroCusto"("num_centro_custo");

-- CreateIndex
CREATE UNIQUE INDEX "ContratosCentrosCusto_contratoId_centroCustoId_key" ON "ContratosCentrosCusto"("contratoId", "centroCustoId");
