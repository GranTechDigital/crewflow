-- CreateTable
CREATE TABLE "Contrato" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "numero" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cliente" TEXT NOT NULL,
    "dataInicio" DATETIME NOT NULL,
    "dataFim" DATETIME NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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

-- CreateTable
CREATE TABLE "Funcionario" (
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
    "statusPrestserv" TEXT,
    "emMigracao" BOOLEAN NOT NULL DEFAULT false,
    "contratoId" INTEGER,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL,
    "excluidoEm" DATETIME,
    "sispat" TEXT,
    CONSTRAINT "Funcionario_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "Contrato" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SolicitacaoRemanejamento" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tipo" TEXT NOT NULL DEFAULT 'REMANEJAMENTO',
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

-- CreateTable
CREATE TABLE "RemanejamentoFuncionario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "solicitacaoId" INTEGER NOT NULL,
    "funcionarioId" INTEGER NOT NULL,
    "statusTarefas" TEXT NOT NULL DEFAULT 'APROVAR SOLICITAÇÃO',
    "statusPrestserv" TEXT NOT NULL DEFAULT 'PENDENTE',
    "statusFuncionario" TEXT NOT NULL DEFAULT 'SEM_CADASTRO',
    "dataRascunhoCriado" DATETIME,
    "dataSubmetido" DATETIME,
    "dataResposta" DATETIME,
    "observacoesPrestserv" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RemanejamentoFuncionario_funcionarioId_fkey" FOREIGN KEY ("funcionarioId") REFERENCES "Funcionario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RemanejamentoFuncionario_solicitacaoId_fkey" FOREIGN KEY ("solicitacaoId") REFERENCES "SolicitacaoRemanejamento" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
    "dataVencimento" DATETIME,
    CONSTRAINT "TarefaRemanejamento_remanejamentoFuncionarioId_fkey" FOREIGN KEY ("remanejamentoFuncionarioId") REFERENCES "RemanejamentoFuncionario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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

-- CreateTable
CREATE TABLE "HistoricoRemanejamento" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "remanejamentoFuncionarioId" TEXT,
    "solicitacaoId" INTEGER,
    "tarefaId" TEXT,
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
    CONSTRAINT "HistoricoRemanejamento_solicitacaoId_fkey" FOREIGN KEY ("solicitacaoId") REFERENCES "SolicitacaoRemanejamento" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HistoricoRemanejamento_tarefaId_fkey" FOREIGN KEY ("tarefaId") REFERENCES "TarefaRemanejamento" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Equipe" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TarefaPadrao" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "setor" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "funcionarioId" INTEGER NOT NULL,
    "senha" TEXT NOT NULL,
    "equipeId" INTEGER NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ultimoLogin" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Usuario_funcionarioId_fkey" FOREIGN KEY ("funcionarioId") REFERENCES "Funcionario" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Usuario_equipeId_fkey" FOREIGN KEY ("equipeId") REFERENCES "Equipe" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Contrato_numero_key" ON "Contrato"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "CentroCusto_num_centro_custo_key" ON "CentroCusto"("num_centro_custo");

-- CreateIndex
CREATE UNIQUE INDEX "ContratosCentrosCusto_contratoId_centroCustoId_key" ON "ContratosCentrosCusto"("contratoId", "centroCustoId");

-- CreateIndex
CREATE UNIQUE INDEX "Funcionario_matricula_key" ON "Funcionario"("matricula");

-- CreateIndex
CREATE INDEX "SolicitacaoRemanejamento_status_idx" ON "SolicitacaoRemanejamento"("status");

-- CreateIndex
CREATE INDEX "SolicitacaoRemanejamento_dataSolicitacao_idx" ON "SolicitacaoRemanejamento"("dataSolicitacao");

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

-- CreateIndex
CREATE INDEX "HistoricoRemanejamento_dataAcao_idx" ON "HistoricoRemanejamento"("dataAcao");

-- CreateIndex
CREATE INDEX "HistoricoRemanejamento_tipoAcao_idx" ON "HistoricoRemanejamento"("tipoAcao");

-- CreateIndex
CREATE INDEX "HistoricoRemanejamento_entidade_idx" ON "HistoricoRemanejamento"("entidade");

-- CreateIndex
CREATE INDEX "HistoricoRemanejamento_usuarioResponsavel_idx" ON "HistoricoRemanejamento"("usuarioResponsavel");

-- CreateIndex
CREATE INDEX "HistoricoRemanejamento_tarefaId_idx" ON "HistoricoRemanejamento"("tarefaId");

-- CreateIndex
CREATE UNIQUE INDEX "Equipe_nome_key" ON "Equipe"("nome");

-- CreateIndex
CREATE INDEX "TarefaPadrao_setor_idx" ON "TarefaPadrao"("setor");

-- CreateIndex
CREATE INDEX "TarefaPadrao_ativo_idx" ON "TarefaPadrao"("ativo");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_funcionarioId_key" ON "Usuario"("funcionarioId");

-- CreateIndex
CREATE INDEX "Usuario_funcionarioId_idx" ON "Usuario"("funcionarioId");

-- CreateIndex
CREATE INDEX "Usuario_equipeId_idx" ON "Usuario"("equipeId");

-- CreateIndex
CREATE INDEX "Usuario_ativo_idx" ON "Usuario"("ativo");
