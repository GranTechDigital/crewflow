-- CreateTable
CREATE TABLE "SolicitacaoRemanejamento" (
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
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SolicitacaoRemanejamento_funcionarioId_fkey" FOREIGN KEY ("funcionarioId") REFERENCES "Funcionario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SolicitacaoRemanejamento_contratoOrigemId_fkey" FOREIGN KEY ("contratoOrigemId") REFERENCES "Contrato" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SolicitacaoRemanejamento_contratoDestinoId_fkey" FOREIGN KEY ("contratoDestinoId") REFERENCES "Contrato" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SolicitacaoRemanejamento_funcionarioId_idx" ON "SolicitacaoRemanejamento"("funcionarioId");
CREATE INDEX "SolicitacaoRemanejamento_status_idx" ON "SolicitacaoRemanejamento"("status");
CREATE INDEX "SolicitacaoRemanejamento_dataSolicitacao_idx" ON "SolicitacaoRemanejamento"("dataSolicitacao");