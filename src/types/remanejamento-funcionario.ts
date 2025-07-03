// Tipos para o controle de remanejamento de funcionários

export interface RemanejamentoFuncionario {
  id: string;
  solicitacaoId: number;
  funcionarioId: number;
  statusTarefas: StatusTarefas;
  statusPrestserv: StatusPrestserv;
  dataRascunhoCriado?: string;
  dataSubmetido?: string;
  dataResposta?: string;
  observacoesPrestserv?: string;
  createdAt: string;
  updatedAt: string;
  
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
  tipo: string;
  descricao?: string;
  responsavel: string;
  status: StatusTarefa;
  prioridade: string;
  dataCriacao: string;
  dataLimite?: string;
  dataConclusao?: string;
  observacoes?: string;
}

export interface SolicitacaoRemanejamento {
  id: number;
  contratoOrigemId?: number;
  centroCustoOrigem: string;
  contratoDestinoId?: number;
  centroCustoDestino: string;
  justificativa?: string;
  status: string;
  prioridade: string;
  solicitadoPor: string;
  analisadoPor?: string;
  dataSolicitacao: string;
  dataAnalise?: string;
  dataAprovacao?: string;
  dataConclusao?: string;
  observacoes?: string;
  createdAt: string;
  updatedAt: string;
  
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
export type StatusTarefas = 'PENDENTE' | 'CONCLUIDO';
export type StatusPrestserv = 'PENDENTE' | 'CRIADO' | 'SUBMETIDO' | 'APROVADO' | 'REJEITADO';
export type StatusTarefa = 'PENDENTE' | 'EM_ANDAMENTO' | 'CONCLUIDO' | 'CANCELADO';

// Interfaces para criação
export interface NovasolicitacaoRemanejamento {
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
}

export interface AtualizarStatusPrestserv {
  statusPrestserv: StatusPrestserv;
  dataRascunhoCriado?: string;
  dataSubmetido?: string;
  dataResposta?: string;
  observacoesPrestserv?: string;
}

// Tipos para dashboard
export interface DashboardRemanejamento {
  totalSolicitacoes: number;
  funcionariosPendentes: number;
  funcionariosAptos: number;
  funcionariosSubmetidos: number;
  funcionariosAprovados: number;
  funcionariosRejeitados: number;
  
  solicitacoesPorStatus: {
    status: string;
    count: number;
  }[];
  
  funcionariosPorStatusTarefas: {
    status: StatusTarefas;
    count: number;
  }[];
  
  funcionariosPorStatusPrestserv: {
    status: StatusPrestserv;
    count: number;
  }[];
}

// Tipos para filtros
export interface FiltrosRemanejamento {
  status?: string;
  statusTarefas?: StatusTarefas;
  statusPrestserv?: StatusPrestserv;
  contratoOrigem?: number;
  contratoDestino?: number;
  responsavel?: string;
  dataInicio?: string;
  dataFim?: string;
}