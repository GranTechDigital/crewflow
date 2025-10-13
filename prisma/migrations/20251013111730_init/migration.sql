-- CreateTable
CREATE TABLE "public"."Contrato" (
    "id" SERIAL NOT NULL,
    "numero" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cliente" TEXT NOT NULL,
    "dataInicio" TIMESTAMP(3) NOT NULL,
    "dataFim" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contrato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CentroCusto" (
    "id" SERIAL NOT NULL,
    "num_centro_custo" TEXT NOT NULL,
    "nome_centro_custo" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CentroCusto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ContratosCentrosCusto" (
    "id" SERIAL NOT NULL,
    "contratoId" INTEGER NOT NULL,
    "centroCustoId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContratosCentrosCusto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Funcionario" (
    "id" SERIAL NOT NULL,
    "matricula" TEXT NOT NULL,
    "cpf" TEXT,
    "nome" TEXT NOT NULL,
    "funcao" TEXT,
    "rg" TEXT,
    "orgaoEmissor" TEXT,
    "uf" TEXT,
    "dataNascimento" TIMESTAMP(3),
    "email" TEXT,
    "telefone" TEXT,
    "centroCusto" TEXT,
    "departamento" TEXT,
    "status" TEXT,
    "statusPrestserv" TEXT,
    "emMigracao" BOOLEAN NOT NULL DEFAULT false,
    "contratoId" INTEGER,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "excluidoEm" TIMESTAMP(3),
    "sispat" TEXT,

    CONSTRAINT "Funcionario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UptimeSheet" (
    "id" SERIAL NOT NULL,
    "matricula" TEXT NOT NULL,
    "dataAdmissao" TIMESTAMP(3),
    "dataDemissao" TIMESTAMP(3),
    "dataInicio" TIMESTAMP(3),
    "dataFim" TIMESTAMP(3),
    "totalDias" INTEGER,
    "totalDiasPeriodo" INTEGER,
    "nome" TEXT,
    "funcao" TEXT,
    "status" TEXT,
    "embarcacao" TEXT,
    "observacoes" TEXT,
    "sispat" TEXT,
    "departamento" TEXT,
    "centroCusto" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "periodoFinal" TIMESTAMP(3),
    "periodoInicial" TIMESTAMP(3),

    CONSTRAINT "UptimeSheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."downtime_sheet" (
    "id" SERIAL NOT NULL,
    "codProjeto" TEXT,
    "nomeProjeto" TEXT,
    "uptime" DOUBLE PRECISION,
    "downtime" DOUBLE PRECISION,
    "agEmbarque" INTEGER,
    "percentAgEmbarque" DOUBLE PRECISION,
    "cadastro" INTEGER,
    "percentCadastro" DOUBLE PRECISION,
    "medicina" INTEGER,
    "percentMedicina" DOUBLE PRECISION,
    "treinamento" INTEGER,
    "percentTreinamento" DOUBLE PRECISION,
    "atestado" INTEGER,
    "percentAtestado" DOUBLE PRECISION,
    "falta" INTEGER,
    "percentFalta" DOUBLE PRECISION,
    "demissao" INTEGER,
    "percentDemissao" DOUBLE PRECISION,
    "dataUpload" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nomeArquivo" TEXT,
    "uploadPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "downtime_sheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SolicitacaoRemanejamento" (
    "id" SERIAL NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'REMANEJAMENTO',
    "contratoOrigemId" INTEGER,
    "contratoDestinoId" INTEGER,
    "justificativa" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Pendente',
    "prioridade" TEXT NOT NULL DEFAULT 'Normal',
    "solicitadoPor" TEXT NOT NULL,
    "analisadoPor" TEXT,
    "dataSolicitacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataAnalise" TIMESTAMP(3),
    "dataAprovacao" TIMESTAMP(3),
    "dataConclusao" TIMESTAMP(3),
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SolicitacaoRemanejamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RemanejamentoFuncionario" (
    "id" TEXT NOT NULL,
    "solicitacaoId" INTEGER NOT NULL,
    "funcionarioId" INTEGER NOT NULL,
    "statusTarefas" TEXT NOT NULL DEFAULT 'APROVAR SOLICITAÇÃO',
    "statusPrestserv" TEXT NOT NULL DEFAULT 'PENDENTE',
    "statusFuncionario" TEXT NOT NULL DEFAULT 'SEM_CADASTRO',
    "dataRascunhoCriado" TIMESTAMP(3),
    "dataSubmetido" TIMESTAMP(3),
    "dataResposta" TIMESTAMP(3),
    "observacoesPrestserv" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RemanejamentoFuncionario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TarefaRemanejamento" (
    "id" TEXT NOT NULL,
    "remanejamentoFuncionarioId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "descricao" TEXT,
    "responsavel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "prioridade" TEXT NOT NULL DEFAULT 'Normal',
    "dataCriacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataLimite" TIMESTAMP(3),
    "dataConclusao" TIMESTAMP(3),
    "observacoes" TEXT,
    "dataVencimento" TIMESTAMP(3),

    CONSTRAINT "TarefaRemanejamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ObservacaoTarefaRemanejamento" (
    "id" SERIAL NOT NULL,
    "tarefaId" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "dataCriacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataModificacao" TIMESTAMP(3) NOT NULL,
    "criadoPor" TEXT NOT NULL,
    "modificadoPor" TEXT NOT NULL,

    CONSTRAINT "ObservacaoTarefaRemanejamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."HistoricoRemanejamento" (
    "id" SERIAL NOT NULL,
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
    "dataAcao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observacoes" TEXT,

    CONSTRAINT "HistoricoRemanejamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Equipe" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Equipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TarefaPadrao" (
    "id" SERIAL NOT NULL,
    "setor" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TarefaPadrao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Usuario" (
    "id" SERIAL NOT NULL,
    "funcionarioId" INTEGER NOT NULL,
    "senha" TEXT NOT NULL,
    "equipeId" INTEGER NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ultimoLogin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UptimeUpload" (
    "id" SERIAL NOT NULL,
    "dataUpload" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nomeArquivo" TEXT,
    "registros" INTEGER NOT NULL,
    "atualizados" INTEGER NOT NULL,
    "naoEncontrados" INTEGER NOT NULL,
    "uploadPor" TEXT NOT NULL,
    "funcionarioId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataRelatorio" TIMESTAMP(3),

    CONSTRAINT "UptimeUpload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PeriodoSheet" (
    "id" SERIAL NOT NULL,
    "matricula" TEXT NOT NULL,
    "dataAdmissao" TIMESTAMP(3),
    "dataDemissao" TIMESTAMP(3),
    "dataInicio" TIMESTAMP(3),
    "dataFim" TIMESTAMP(3),
    "periodoInicial" TIMESTAMP(3),
    "periodoFinal" TIMESTAMP(3),
    "totalDias" INTEGER,
    "totalDiasPeriodo" INTEGER,
    "nome" TEXT,
    "funcao" TEXT,
    "embarcacao" TEXT,
    "statusFolha" TEXT,
    "codigo" TEXT,
    "observacoes" TEXT,
    "embarcacaoAtual" TEXT,
    "sispat" TEXT,
    "departamento" TEXT,
    "regimeTrabalho" TEXT,
    "regimeTratado" TEXT,
    "statusId" INTEGER,
    "projetoId" INTEGER,
    "mesReferencia" INTEGER NOT NULL,
    "anoReferencia" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PeriodoSheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PeriodoUpload" (
    "id" SERIAL NOT NULL,
    "dataUpload" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataRelatorio" TIMESTAMP(3),
    "nomeArquivo" TEXT,
    "registros" INTEGER NOT NULL,
    "atualizados" INTEGER NOT NULL,
    "naoEncontrados" INTEGER NOT NULL,
    "uploadPor" TEXT NOT NULL,
    "funcionarioId" INTEGER,
    "mesReferencia" INTEGER NOT NULL,
    "anoReferencia" INTEGER NOT NULL,
    "periodoInicial" TIMESTAMP(3) NOT NULL,
    "periodoFinal" TIMESTAMP(3) NOT NULL,
    "totalDiasPeriodo" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PeriodoUpload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Status" (
    "id" SERIAL NOT NULL,
    "categoria" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Projeto" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Projeto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StatusMapping" (
    "id" SERIAL NOT NULL,
    "statusGeral" TEXT NOT NULL,
    "statusId" INTEGER NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StatusMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CentroCustoProjeto" (
    "id" SERIAL NOT NULL,
    "centroCusto" TEXT NOT NULL,
    "nomeCentroCusto" TEXT NOT NULL,
    "projetoId" INTEGER NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CentroCustoProjeto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Funcao" (
    "id" SERIAL NOT NULL,
    "funcao" TEXT NOT NULL,
    "regime" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Funcao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Treinamentos" (
    "id" SERIAL NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "treinamento" TEXT NOT NULL,
    "cargaHoraria" INTEGER NOT NULL,
    "validadeValor" INTEGER NOT NULL,
    "validadeUnidade" TEXT NOT NULL,

    CONSTRAINT "Treinamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MatrizTreinamento" (
    "id" SERIAL NOT NULL,
    "contratoId" INTEGER NOT NULL,
    "funcaoId" INTEGER NOT NULL,
    "treinamentoId" INTEGER,
    "tipoObrigatoriedade" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatrizTreinamento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Contrato_numero_key" ON "public"."Contrato"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "CentroCusto_num_centro_custo_key" ON "public"."CentroCusto"("num_centro_custo");

-- CreateIndex
CREATE UNIQUE INDEX "ContratosCentrosCusto_contratoId_centroCustoId_key" ON "public"."ContratosCentrosCusto"("contratoId", "centroCustoId");

-- CreateIndex
CREATE UNIQUE INDEX "Funcionario_matricula_key" ON "public"."Funcionario"("matricula");

-- CreateIndex
CREATE INDEX "SolicitacaoRemanejamento_status_idx" ON "public"."SolicitacaoRemanejamento"("status");

-- CreateIndex
CREATE INDEX "SolicitacaoRemanejamento_dataSolicitacao_idx" ON "public"."SolicitacaoRemanejamento"("dataSolicitacao");

-- CreateIndex
CREATE INDEX "RemanejamentoFuncionario_statusTarefas_idx" ON "public"."RemanejamentoFuncionario"("statusTarefas");

-- CreateIndex
CREATE INDEX "RemanejamentoFuncionario_statusPrestserv_idx" ON "public"."RemanejamentoFuncionario"("statusPrestserv");

-- CreateIndex
CREATE UNIQUE INDEX "RemanejamentoFuncionario_solicitacaoId_funcionarioId_key" ON "public"."RemanejamentoFuncionario"("solicitacaoId", "funcionarioId");

-- CreateIndex
CREATE INDEX "TarefaRemanejamento_status_idx" ON "public"."TarefaRemanejamento"("status");

-- CreateIndex
CREATE INDEX "TarefaRemanejamento_responsavel_idx" ON "public"."TarefaRemanejamento"("responsavel");

-- CreateIndex
CREATE INDEX "HistoricoRemanejamento_dataAcao_idx" ON "public"."HistoricoRemanejamento"("dataAcao");

-- CreateIndex
CREATE INDEX "HistoricoRemanejamento_tipoAcao_idx" ON "public"."HistoricoRemanejamento"("tipoAcao");

-- CreateIndex
CREATE INDEX "HistoricoRemanejamento_entidade_idx" ON "public"."HistoricoRemanejamento"("entidade");

-- CreateIndex
CREATE INDEX "HistoricoRemanejamento_usuarioResponsavel_idx" ON "public"."HistoricoRemanejamento"("usuarioResponsavel");

-- CreateIndex
CREATE INDEX "HistoricoRemanejamento_tarefaId_idx" ON "public"."HistoricoRemanejamento"("tarefaId");

-- CreateIndex
CREATE UNIQUE INDEX "Equipe_nome_key" ON "public"."Equipe"("nome");

-- CreateIndex
CREATE INDEX "TarefaPadrao_setor_idx" ON "public"."TarefaPadrao"("setor");

-- CreateIndex
CREATE INDEX "TarefaPadrao_ativo_idx" ON "public"."TarefaPadrao"("ativo");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_funcionarioId_key" ON "public"."Usuario"("funcionarioId");

-- CreateIndex
CREATE INDEX "Usuario_funcionarioId_idx" ON "public"."Usuario"("funcionarioId");

-- CreateIndex
CREATE INDEX "Usuario_equipeId_idx" ON "public"."Usuario"("equipeId");

-- CreateIndex
CREATE INDEX "Usuario_ativo_idx" ON "public"."Usuario"("ativo");

-- CreateIndex
CREATE INDEX "UptimeUpload_dataUpload_idx" ON "public"."UptimeUpload"("dataUpload");

-- CreateIndex
CREATE INDEX "UptimeUpload_dataRelatorio_idx" ON "public"."UptimeUpload"("dataRelatorio");

-- CreateIndex
CREATE INDEX "PeriodoSheet_mesReferencia_anoReferencia_idx" ON "public"."PeriodoSheet"("mesReferencia", "anoReferencia");

-- CreateIndex
CREATE INDEX "PeriodoSheet_matricula_idx" ON "public"."PeriodoSheet"("matricula");

-- CreateIndex
CREATE INDEX "PeriodoSheet_statusId_idx" ON "public"."PeriodoSheet"("statusId");

-- CreateIndex
CREATE INDEX "PeriodoSheet_projetoId_idx" ON "public"."PeriodoSheet"("projetoId");

-- CreateIndex
CREATE INDEX "PeriodoSheet_regimeTratado_idx" ON "public"."PeriodoSheet"("regimeTratado");

-- CreateIndex
CREATE INDEX "PeriodoUpload_dataUpload_idx" ON "public"."PeriodoUpload"("dataUpload");

-- CreateIndex
CREATE INDEX "PeriodoUpload_dataRelatorio_idx" ON "public"."PeriodoUpload"("dataRelatorio");

-- CreateIndex
CREATE INDEX "PeriodoUpload_mesReferencia_anoReferencia_idx" ON "public"."PeriodoUpload"("mesReferencia", "anoReferencia");

-- CreateIndex
CREATE UNIQUE INDEX "Status_categoria_key" ON "public"."Status"("categoria");

-- CreateIndex
CREATE INDEX "Status_categoria_idx" ON "public"."Status"("categoria");

-- CreateIndex
CREATE INDEX "Status_ativo_idx" ON "public"."Status"("ativo");

-- CreateIndex
CREATE UNIQUE INDEX "Projeto_codigo_key" ON "public"."Projeto"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Projeto_nome_key" ON "public"."Projeto"("nome");

-- CreateIndex
CREATE INDEX "Projeto_codigo_idx" ON "public"."Projeto"("codigo");

-- CreateIndex
CREATE INDEX "Projeto_nome_idx" ON "public"."Projeto"("nome");

-- CreateIndex
CREATE INDEX "Projeto_ativo_idx" ON "public"."Projeto"("ativo");

-- CreateIndex
CREATE UNIQUE INDEX "StatusMapping_statusGeral_key" ON "public"."StatusMapping"("statusGeral");

-- CreateIndex
CREATE INDEX "StatusMapping_statusId_idx" ON "public"."StatusMapping"("statusId");

-- CreateIndex
CREATE INDEX "StatusMapping_ativo_idx" ON "public"."StatusMapping"("ativo");

-- CreateIndex
CREATE INDEX "CentroCustoProjeto_centroCusto_idx" ON "public"."CentroCustoProjeto"("centroCusto");

-- CreateIndex
CREATE INDEX "CentroCustoProjeto_projetoId_idx" ON "public"."CentroCustoProjeto"("projetoId");

-- CreateIndex
CREATE INDEX "CentroCustoProjeto_ativo_idx" ON "public"."CentroCustoProjeto"("ativo");

-- CreateIndex
CREATE UNIQUE INDEX "CentroCustoProjeto_centroCusto_projetoId_key" ON "public"."CentroCustoProjeto"("centroCusto", "projetoId");

-- CreateIndex
CREATE UNIQUE INDEX "Funcao_funcao_key" ON "public"."Funcao"("funcao");

-- CreateIndex
CREATE INDEX "Funcao_funcao_idx" ON "public"."Funcao"("funcao");

-- CreateIndex
CREATE INDEX "Funcao_regime_idx" ON "public"."Funcao"("regime");

-- CreateIndex
CREATE INDEX "Treinamentos_treinamento_idx" ON "public"."Treinamentos"("treinamento");

-- CreateIndex
CREATE INDEX "MatrizTreinamento_contratoId_idx" ON "public"."MatrizTreinamento"("contratoId");

-- CreateIndex
CREATE INDEX "MatrizTreinamento_funcaoId_idx" ON "public"."MatrizTreinamento"("funcaoId");

-- CreateIndex
CREATE INDEX "MatrizTreinamento_treinamentoId_idx" ON "public"."MatrizTreinamento"("treinamentoId");

-- CreateIndex
CREATE INDEX "MatrizTreinamento_tipoObrigatoriedade_idx" ON "public"."MatrizTreinamento"("tipoObrigatoriedade");

-- CreateIndex
CREATE UNIQUE INDEX "MatrizTreinamento_contratoId_funcaoId_treinamentoId_key" ON "public"."MatrizTreinamento"("contratoId", "funcaoId", "treinamentoId");

-- AddForeignKey
ALTER TABLE "public"."ContratosCentrosCusto" ADD CONSTRAINT "ContratosCentrosCusto_centroCustoId_fkey" FOREIGN KEY ("centroCustoId") REFERENCES "public"."CentroCusto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ContratosCentrosCusto" ADD CONSTRAINT "ContratosCentrosCusto_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "public"."Contrato"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Funcionario" ADD CONSTRAINT "Funcionario_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "public"."Contrato"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UptimeSheet" ADD CONSTRAINT "UptimeSheet_matricula_fkey" FOREIGN KEY ("matricula") REFERENCES "public"."Funcionario"("matricula") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SolicitacaoRemanejamento" ADD CONSTRAINT "SolicitacaoRemanejamento_contratoDestinoId_fkey" FOREIGN KEY ("contratoDestinoId") REFERENCES "public"."Contrato"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SolicitacaoRemanejamento" ADD CONSTRAINT "SolicitacaoRemanejamento_contratoOrigemId_fkey" FOREIGN KEY ("contratoOrigemId") REFERENCES "public"."Contrato"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RemanejamentoFuncionario" ADD CONSTRAINT "RemanejamentoFuncionario_solicitacaoId_fkey" FOREIGN KEY ("solicitacaoId") REFERENCES "public"."SolicitacaoRemanejamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RemanejamentoFuncionario" ADD CONSTRAINT "RemanejamentoFuncionario_funcionarioId_fkey" FOREIGN KEY ("funcionarioId") REFERENCES "public"."Funcionario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TarefaRemanejamento" ADD CONSTRAINT "TarefaRemanejamento_remanejamentoFuncionarioId_fkey" FOREIGN KEY ("remanejamentoFuncionarioId") REFERENCES "public"."RemanejamentoFuncionario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ObservacaoTarefaRemanejamento" ADD CONSTRAINT "ObservacaoTarefaRemanejamento_tarefaId_fkey" FOREIGN KEY ("tarefaId") REFERENCES "public"."TarefaRemanejamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HistoricoRemanejamento" ADD CONSTRAINT "HistoricoRemanejamento_tarefaId_fkey" FOREIGN KEY ("tarefaId") REFERENCES "public"."TarefaRemanejamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HistoricoRemanejamento" ADD CONSTRAINT "HistoricoRemanejamento_solicitacaoId_fkey" FOREIGN KEY ("solicitacaoId") REFERENCES "public"."SolicitacaoRemanejamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HistoricoRemanejamento" ADD CONSTRAINT "HistoricoRemanejamento_remanejamentoFuncionarioId_fkey" FOREIGN KEY ("remanejamentoFuncionarioId") REFERENCES "public"."RemanejamentoFuncionario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Usuario" ADD CONSTRAINT "Usuario_equipeId_fkey" FOREIGN KEY ("equipeId") REFERENCES "public"."Equipe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Usuario" ADD CONSTRAINT "Usuario_funcionarioId_fkey" FOREIGN KEY ("funcionarioId") REFERENCES "public"."Funcionario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UptimeUpload" ADD CONSTRAINT "UptimeUpload_funcionarioId_fkey" FOREIGN KEY ("funcionarioId") REFERENCES "public"."Funcionario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PeriodoSheet" ADD CONSTRAINT "PeriodoSheet_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "public"."Status"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PeriodoSheet" ADD CONSTRAINT "PeriodoSheet_projetoId_fkey" FOREIGN KEY ("projetoId") REFERENCES "public"."Projeto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PeriodoUpload" ADD CONSTRAINT "PeriodoUpload_funcionarioId_fkey" FOREIGN KEY ("funcionarioId") REFERENCES "public"."Funcionario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StatusMapping" ADD CONSTRAINT "StatusMapping_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "public"."Status"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CentroCustoProjeto" ADD CONSTRAINT "CentroCustoProjeto_projetoId_fkey" FOREIGN KEY ("projetoId") REFERENCES "public"."Projeto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MatrizTreinamento" ADD CONSTRAINT "MatrizTreinamento_treinamentoId_fkey" FOREIGN KEY ("treinamentoId") REFERENCES "public"."Treinamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MatrizTreinamento" ADD CONSTRAINT "MatrizTreinamento_funcaoId_fkey" FOREIGN KEY ("funcaoId") REFERENCES "public"."Funcao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MatrizTreinamento" ADD CONSTRAINT "MatrizTreinamento_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "public"."Contrato"("id") ON DELETE CASCADE ON UPDATE CASCADE;
