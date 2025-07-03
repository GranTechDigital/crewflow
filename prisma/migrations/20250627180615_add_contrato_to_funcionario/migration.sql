-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Funcionario" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "matricula" TEXT NOT NULL,
    "cpf" TEXT,
    "nome" TEXT NOT NULL,
    "funcao" TEXT,
    "rg" TEXT,
    "orgaoEmissor" TEXT,
    "uf" TEXT,
    "dataNascimento" DATETIME,
    "email" TEXT,
    "telefone" TEXT,
    "centroCusto" TEXT,
    "departamento" TEXT,
    "status" TEXT,
    "contratoId" INTEGER,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL,
    "excluidoEm" DATETIME,
    CONSTRAINT "Funcionario_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "Contrato" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Funcionario" ("atualizadoEm", "centroCusto", "cpf", "criadoEm", "dataNascimento", "departamento", "email", "excluidoEm", "funcao", "id", "matricula", "nome", "orgaoEmissor", "rg", "status", "telefone", "uf") SELECT "atualizadoEm", "centroCusto", "cpf", "criadoEm", "dataNascimento", "departamento", "email", "excluidoEm", "funcao", "id", "matricula", "nome", "orgaoEmissor", "rg", "status", "telefone", "uf" FROM "Funcionario";
DROP TABLE "Funcionario";
ALTER TABLE "new_Funcionario" RENAME TO "Funcionario";
CREATE UNIQUE INDEX "Funcionario_matricula_key" ON "Funcionario"("matricula");
CREATE TABLE "new_RemanejamentoFuncionario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "solicitacaoId" INTEGER NOT NULL,
    "funcionarioId" INTEGER NOT NULL,
    "statusTarefas" TEXT NOT NULL DEFAULT 'PENDENTE',
    "statusPrestserv" TEXT NOT NULL DEFAULT 'PENDENTE',
    "dataRascunhoCriado" DATETIME,
    "dataSubmetido" DATETIME,
    "dataResposta" DATETIME,
    "observacoesPrestserv" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RemanejamentoFuncionario_solicitacaoId_fkey" FOREIGN KEY ("solicitacaoId") REFERENCES "SolicitacaoRemanejamento" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RemanejamentoFuncionario_funcionarioId_fkey" FOREIGN KEY ("funcionarioId") REFERENCES "Funcionario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_RemanejamentoFuncionario" ("createdAt", "dataRascunhoCriado", "dataResposta", "dataSubmetido", "funcionarioId", "id", "observacoesPrestserv", "solicitacaoId", "statusPrestserv", "statusTarefas", "updatedAt") SELECT "createdAt", "dataRascunhoCriado", "dataResposta", "dataSubmetido", "funcionarioId", "id", "observacoesPrestserv", "solicitacaoId", "statusPrestserv", "statusTarefas", "updatedAt" FROM "RemanejamentoFuncionario";
DROP TABLE "RemanejamentoFuncionario";
ALTER TABLE "new_RemanejamentoFuncionario" RENAME TO "RemanejamentoFuncionario";
CREATE INDEX "RemanejamentoFuncionario_statusTarefas_idx" ON "RemanejamentoFuncionario"("statusTarefas");
CREATE INDEX "RemanejamentoFuncionario_statusPrestserv_idx" ON "RemanejamentoFuncionario"("statusPrestserv");
CREATE UNIQUE INDEX "RemanejamentoFuncionario_solicitacaoId_funcionarioId_key" ON "RemanejamentoFuncionario"("solicitacaoId", "funcionarioId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
