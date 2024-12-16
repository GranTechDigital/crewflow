export type Funcionario = {
  id: number;
  matricula: string;
  nome: string;
  funcao: string | null;
  departamento: string | null;
  centroCusto: string | null;
  status: string | null;
};

export type Pendencia = {
  id: number;
  funcionarioId: number;
  funcionario?: Funcionario;
  tipo: string;
  descricao: string | null;
  equipe: string;
  status: string;
  prioridade: string;
  dataCriacao: Date;
  dataAtualizacao: Date;
  dataLimite: Date | null;
  dataConclusao: Date | null;
  criadoPor: string;
  atualizadoPor: string;
  observacoes: ObservacaoPendencia[];
};

export type ObservacaoPendencia = {
  id: number;
  pendenciaId: number;
  texto: string;
  dataCriacao: Date;
  dataModificacao: Date;
  criadoPor: string;
  modificadoPor: string;
}; 