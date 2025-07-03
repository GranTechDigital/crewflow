/*
  Warnings:

  - You are about to drop the column `centroCustoDestino` on the `SolicitacaoRemanejamento` table. All the data in the column will be lost.
  - You are about to drop the column `centroCustoOrigem` on the `SolicitacaoRemanejamento` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SolicitacaoRemanejamento" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "contratoOrigemId" INTEGER,
    "contratoDestinoId" INTEGER,
    "justificativa" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Pendente',
    "prioridade" TEXT NOT NULL DEFAULT 'Normal',
    "solicitadoPor" TEXT NOT NULL,
    "analisadoPor" TEXT,
    "dataSolicitacao" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataAnalise" DATETIME,
    "dataAprovacao" DATETIME,
    "dataConclusao" DATETIME,
    "observacoes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SolicitacaoRemanejamento_contratoOrigemId_fkey" FOREIGN KEY ("contratoOrigemId") REFERENCES "Contrato" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SolicitacaoRemanejamento_contratoDestinoId_fkey" FOREIGN KEY ("contratoDestinoId") REFERENCES "Contrato" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_SolicitacaoRemanejamento" ("analisadoPor", "contratoDestinoId", "contratoOrigemId", "createdAt", "dataAnalise", "dataAprovacao", "dataConclusao", "dataSolicitacao", "id", "justificativa", "observacoes", "prioridade", "solicitadoPor", "status", "updatedAt") SELECT "analisadoPor", "contratoDestinoId", "contratoOrigemId", "createdAt", "dataAnalise", "dataAprovacao", "dataConclusao", "dataSolicitacao", "id", "justificativa", "observacoes", "prioridade", "solicitadoPor", "status", "updatedAt" FROM "SolicitacaoRemanejamento";
DROP TABLE "SolicitacaoRemanejamento";
ALTER TABLE "new_SolicitacaoRemanejamento" RENAME TO "SolicitacaoRemanejamento";
CREATE INDEX "SolicitacaoRemanejamento_status_idx" ON "SolicitacaoRemanejamento"("status");
CREATE INDEX "SolicitacaoRemanejamento_dataSolicitacao_idx" ON "SolicitacaoRemanejamento"("dataSolicitacao");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
