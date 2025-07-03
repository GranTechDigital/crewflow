-- AddColumn
ALTER TABLE "HistoricoRemanejamento" ADD COLUMN "tarefaId" TEXT;

-- CreateIndex
CREATE INDEX "HistoricoRemanejamento_tarefaId_idx" ON "HistoricoRemanejamento"("tarefaId");

-- AddForeignKey
ALTER TABLE "HistoricoRemanejamento" ADD CONSTRAINT "HistoricoRemanejamento_tarefaId_fkey" FOREIGN KEY ("tarefaId") REFERENCES "TarefaRemanejamento" ("id") ON DELETE CASCADE ON UPDATE CASCADE;