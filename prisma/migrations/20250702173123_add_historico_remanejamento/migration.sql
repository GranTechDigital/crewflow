-- CreateTable
CREATE TABLE "HistoricoRemanejamento" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "remanejamentoFuncionarioId" TEXT,
    "solicitacaoId" INTEGER,
    "tipoAcao" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "campoAlterado" TEXT,
    "valorAnterior" TEXT,
    "valorNovo" TEXT,
    "descricaoAcao" TEXT NOT NULL,
    "usuarioResponsavel" TEXT NOT NULL,
    "dataAcao" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observacoes" TEXT,
    CONSTRAINT "HistoricoRemanejamento_remanejamentoFuncionarioId_fkey" FOREIGN KEY ("remanejamentoFuncionarioId") REFERENCES "RemanejamentoFuncionario" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HistoricoRemanejamento_solicitacaoId_fkey" FOREIGN KEY ("solicitacaoId") REFERENCES "SolicitacaoRemanejamento" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "HistoricoRemanejamento_dataAcao_idx" ON "HistoricoRemanejamento"("dataAcao");

-- CreateIndex
CREATE INDEX "HistoricoRemanejamento_tipoAcao_idx" ON "HistoricoRemanejamento"("tipoAcao");

-- CreateIndex
CREATE INDEX "HistoricoRemanejamento_entidade_idx" ON "HistoricoRemanejamento"("entidade");

-- CreateIndex
CREATE INDEX "HistoricoRemanejamento_usuarioResponsavel_idx" ON "HistoricoRemanejamento"("usuarioResponsavel");
