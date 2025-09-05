// Interface mantida para compatibilidade - representa SolicitacaoRemanejamento
export interface Remanejamento {
  id: number;
  contratoOrigemId: number | null;
  contratoOrigem: {
    id: number;
    numero: string;
    nome: string;
    cliente: string;
  } | null;
  centroCustoOrigem: string;
  contratoDestinoId: number | null;
  contratoDestino: {
    id: number;
    numero: string;
    nome: string;
    cliente: string;
  } | null;
  centroCustoDestino: string;
  justificativa: string | null;
  status: StatusRemanejamento;
  prioridade: PrioridadeRemanejamento;
  solicitadoPor: string;
  analisadoPor: string | null;
  dataSolicitacao: string;
  dataAnalise: string | null;
  dataAprovacao: string | null;
  dataConclusao: string | null;
  observacoes: string | null;
  createdAt: string;
  updatedAt: string;

  // Novo relacionamento com funcionários
  funcionarios?: {
    id: string;
    funcionarioId: number;
    statusTarefas:
      | "APROVAR SOLICITACAO"
      | "CRIAR_TAREFAS"
      | "SUBMETER RASCUNHO";
    statusPrestserv:
      | "PENDENTE"
      | "CRIADO"
      | "SOLICITAR_DESLIGAMENTO"
      | "SUBMETIDO"
      | "APROVADO"
      | "REJEITADO";
    funcionario: {
      id: number;
      nome: string;
      matricula: string;
      funcao: string | null;
      centroCusto: string | null;
    };
  }[];
}

export type StatusRemanejamento =
  | "Pendente"
  | "Em_Analise"
  | "Aprovado"
  | "Rejeitado"
  | "Concluido";
export type PrioridadeRemanejamento = "baixa" | "media" | "alta" | "urgente";

export interface NovoRemanejamento {
  funcionarioIds: number[];
  contratoOrigemId?: number;
  centroCustoOrigem: string;
  contratoDestinoId?: number;
  centroCustoDestino: string;
  justificativa?: string;
  prioridade?: PrioridadeRemanejamento;
  solicitadoPor: string;
}

export interface AtualizarRemanejamento {
  id: number;
  status: StatusRemanejamento;
  analisadoPor?: string;
  observacoes?: string;
}

export interface FuncionarioSelecionado {
  id: number;
  nome: string;
  matricula: string;
  funcao: string | null;
  centroCusto: string | null;
  selecionado: boolean;
}

export interface ResumoRemanejamento {
  totalSelecionados: number;
  porFuncao: Record<string, number>;
  origem: {
    contrato?: string;
    centroCusto: string;
  };
  destino: {
    contrato?: string;
    centroCusto: string;
  };
}
