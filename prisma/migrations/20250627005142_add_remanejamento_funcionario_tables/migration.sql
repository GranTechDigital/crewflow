/*
  Warnings:

  - You are about to drop the column `funcionarioId` on the `SolicitacaoRemanejamento` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "RemanejamentoFuncionario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "solicitacaoId" INTEGER NOT NULL,
    "funcionarioId" INTEGER NOT NULL,
    "statusTarefas" TEXT NOT NULL DEFAULT 'PENDENTE',
    "statusPrestserv" TEXT NOT NULL DEFAULT 'NAO_INICIADO',
    "dataRascunhoCriado" DATETIME,
    "dataSubmetido" DATETIME,
    "dataResposta" DATETIME,
    "observacoesPrestserv" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RemanejamentoFuncionario_solicitacaoId_fkey" FOREIGN KEY ("solicitacaoId") REFERENCES "SolicitacaoRemanejamento" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RemanejamentoFuncionario_funcionarioId_fkey" FOREIGN KEY ("funcionarioId") REFERENCES "Funcionario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TarefaRemanejamento" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "remanejamentoFuncionarioId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "descricao" TEXT,
    "responsavel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "prioridade" TEXT NOT NULL DEFAULT 'Normal',
    "dataCriacao" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataLimite" DATETIME,
    "dataConclusao" DATETIME,
    "observacoes" TEXT,
    CONSTRAINT "TarefaRemanejamento_remanejamentoFuncionarioId_fkey" FOREIGN KEY ("remanejamentoFuncionarioId") REFERENCES "RemanejamentoFuncionario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SolicitacaoRemanejamento" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
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
    "dataConclusao" DATETIME,
    "observacoes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SolicitacaoRemanejamento_contratoOrigemId_fkey" FOREIGN KEY ("contratoOrigemId") REFERENCES "Contrato" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SolicitacaoRemanejamento_contratoDestinoId_fkey" FOREIGN KEY ("contratoDestinoId") REFERENCES "Contrato" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_SolicitacaoRemanejamento" ("analisadoPor", "centroCustoDestino", "centroCustoOrigem", "contratoDestinoId", "contratoOrigemId", "createdAt", "dataAnalise", "dataAprovacao", "dataSolicitacao", "id", "justificativa", "observacoes", "prioridade", "solicitadoPor", "status", "updatedAt") SELECT "analisadoPor", "centroCustoDestino", "centroCustoOrigem", "contratoDestinoId", "contratoOrigemId", "createdAt", "dataAnalise", "dataAprovacao", "dataSolicitacao", "id", "justificativa", "observacoes", "prioridade", "solicitadoPor", "status", "updatedAt" FROM "SolicitacaoRemanejamento";
DROP TABLE "SolicitacaoRemanejamento";
ALTER TABLE "new_SolicitacaoRemanejamento" RENAME TO "SolicitacaoRemanejamento";
CREATE INDEX "SolicitacaoRemanejamento_status_idx" ON "SolicitacaoRemanejamento"("status");
CREATE INDEX "SolicitacaoRemanejamento_dataSolicitacao_idx" ON "SolicitacaoRemanejamento"("dataSolicitacao");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "RemanejamentoFuncionario_statusTarefas_idx" ON "RemanejamentoFuncionario"("statusTarefas");

-- CreateIndex
CREATE INDEX "RemanejamentoFuncionario_statusPrestserv_idx" ON "RemanejamentoFuncionario"("statusPrestserv");

-- CreateIndex
CREATE UNIQUE INDEX "RemanejamentoFuncionario_solicitacaoId_funcionarioId_key" ON "RemanejamentoFuncionario"("solicitacaoId", "funcionarioId");

-- CreateIndex
CREATE INDEX "TarefaRemanejamento_status_idx" ON "TarefaRemanejamento"("status");

-- CreateIndex
CREATE INDEX "TarefaRemanejamento_responsavel_idx" ON "TarefaRemanejamento"("responsavel");
