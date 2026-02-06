// Tipos para o controle de remanejamento de funcionários

export interface RemanejamentoFuncionario {
  id: string;
  solicitacaoId: number;
  funcionarioId: number;
  statusTarefa: StatusTarefa;
  statusPrestserv: StatusPrestserv;
  statusFuncionario: StatusFuncionarioPrestserv;
  dataRascunhoCriado?: string;
  dataSubmetido?: string;
  dataResposta?: string;
  dataAprovado?: string;
  dataConcluido?: string;
  dataCancelado?: string;
  observacoesPrestserv?: string;
  createdAt: string;
  updatedAt: string;
  aprovadoPorId?: number;
  concluidoPorId?: number;
  canceladoPorId?: number;

  // Relacionamentos
  solicitacao?: SolicitacaoRemanejamento;
  funcionario?: {
    id: number;
    nome: string;
    matricula: string;
    funcao: string | null;
    centroCusto: string | null;
  };
  tarefas?: TarefaRemanejamento[];
}

export interface TarefaRemanejamento {
  id: string;
  remanejamentoFuncionarioId: string;
  tarefaPadraoId?: number | null;
  treinamentoId?: number | null;
  tipo: string;
  descricao?: string;
  responsavel: string;
  status: StatusTarefa;
  prioridade: string;
  dataCriacao: string;
  dataLimite?: string;
  dataVencimento?: string;
  dataConclusao?: string;
  observacoes?: string;
  setorId?: number | null;
}

export interface SolicitacaoRemanejamento {
  id: number;
  tipo: TipoSolicitacao;
  contratoOrigemId?: number;
  centroCustoOrigem: string;
  contratoDestinoId?: number;
  centroCustoDestino: string;
  justificativa?: string;
  status: string;
  prioridade: string;
  solicitadoPorId?: number;
  analisadoPor?: string;
  aprovadoPorId?: number;
  dataSolicitacao: string;
  dataAnalise?: string;
  dataAprovacao?: string;
  dataConclusao?: string;
  concluidoPorId?: number;
  observacoes?: string;
  createdAt: string;
  updatedAt: string;
  atualizadoPorId?: number;

  // Relacionamentos
  contratoOrigem?: {
    id: number;
    numero: string;
    nome: string;
    cliente: string;
  };
  contratoDestino?: {
    id: number;
    numero: string;
    nome: string;
    cliente: string;
  };
  funcionarios?: RemanejamentoFuncionario[];
}

// Enums
export type StatusFuncionarioPrestserv =
  | "SEM_CADASTRO"
  | "ATIVO"
  | "INATIVO"
  | "EM_MIGRACAO";
export type StatusPrestserv =
  | "PENDENTE"
  | "CRIADO"
  | "EM VALIDAÇÃO"
  | "INVALIDADO"
  | "VALIDADO"
  | "CANCELADO"
  | "SISPAT BLOQUEADO"
  | "PENDENTE DE DESLIGAMENTO"
  | "DESLIGAMENTO SOLICITADO";
export type StatusTarefa =
  | "APROVAR SOLICITACAO"
  | "REPROVADO"
  | "APROVADO"
  | "CRIAR_TAREFAS"
  | "PRONTO_PARA_ENVIO"
  | "SUBMETER RASCUNHO"
  | "CANCELADO"
  | "PENDENTE"
  | "EM_ANDAMENTO"
  | "CONCLUIDO"
  | "CONCLUIDA";
export type StatusSetor =
  | "APROVAR SOLICITACAO"
  | "EM_ANDAMENTO"
  | "SUBMETER RASCUNHO"
  | "CANCELADO";

export type TipoSolicitacao = "ALOCACAO" | "REMANEJAMENTO" | "DESLIGAMENTO";

// Interfaces para criação
export interface NovasolicitacaoRemanejamento {
  tipo: TipoSolicitacao;
  funcionarioIds: number[];
  contratoOrigemId?: number;
  contratoDestinoId?: number;
  justificativa?: string;
  prioridade?: string;
  solicitadoPor: string;
}

export interface NovaTarefaRemanejamento {
  remanejamentoFuncionarioId: string;
  tipo: string;
  descricao?: string;
  responsavel: string;
  prioridade?: string;
  dataLimite?: string;
  dataVencimento?: string;
}

export interface AtualizarStatusPrestserv {
  statusPrestserv: StatusPrestserv;
  dataRascunhoCriado?: string;
  dataSubmetido?: string;
  dataResposta?: string;
  observacoesPrestserv?: string;
  sispat?: string;
}

// Tipos para dashboard
export interface DashboardRemanejamento {
  totalSolicitacoes: number;
  funcionariosPendentes: number;
  funcionariosAptos: number;
  funcionariosSubmetidos: number;
  funcionariosAprovados: number;
  funcionariosRejeitados: number;
  funcionariosValidados?: number;
  funcionariosCancelados?: number;
  funcionariosEmProcesso?: number;

  solicitacoesPorStatus: {
    status: string;
    count: number;
  }[];

  funcionariosPorStatusTarefa: {
    status: StatusTarefa;
    count: number;
  }[];

  funcionariosPorStatusPrestserv: {
    status: StatusPrestserv;
    count: number;
  }[];

  // Novos campos para os gráficos adicionais
  solicitacoesPorTipo?: Record<string, number>;
  solicitacoesPorOrigemDestino?: Array<{
    origem: string;
    destino: string;
    count: number;
  }>;
  pendenciasPorSetor?: Record<string, number>;
  funcionariosPorResponsavel?: Record<string, number>;
  solicitacoesPorMes?: number[];

  // SLAs (novos campos)
  slaTempoMedioSolicitacaoDias?: number;
  slaTempoMedioSolicitacaoHoras?: number;
  slaTempoMedioPorSetorDias?: Record<string, number>;
  slaTempoMedioPorSetorHoras?: Record<string, number>;
  slaLogisticaTempoMedioAprovacaoHoras?: number;
  volumetriaCorrecoesPorTipo?: Record<string, number>;
}

// Tipos para filtros
export interface FiltrosRemanejamento {
  status?: string;
  statusTarefa?: StatusTarefa;
  statusPrestserv?: StatusPrestserv;
  contratoOrigem?: number;
  contratoDestino?: number;
  responsavel?: string;
  dataInicio?: string;
  dataFim?: string;
}
