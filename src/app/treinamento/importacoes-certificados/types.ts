export type Importacao = {
  descricao?: string;
  totalCanceladas?: number;
  totalResolvidasOutroArquivo?: number;
  totalDuplicadasNoArquivo?: number;
  totalJaProcessadas?: number;
  id: number;
  ambiente: string;
  nomeArquivo: string;
  hashArquivo: string;
  status: string;
  totalLinhas: number;
  totalValidas: number;
  totalErroValidacao: number;
  totalDuplicadas: number;
  totalConflitos: number;
  totalPendentes: number;
  totalEnviadas: number;
  totalConfirmadas: number;
  totalErroDrake: number;
  totalNaoConfirmadas: number;
  envioEmAndamento: boolean;
  envioInterrompido: boolean;
  ultimoErro: string | null;
  createdAt: string;
  updatedAt: string;
  usuario: {
    funcionario: {
      nome: string;
      matricula: string;
    };
    equipe: {
      nome: string;
    };
  };
};

export type ItemImportacao = {
  confirmacaoDrake?: {status:string;documentoId:string|null;referenciaEm:string;motivo:string}|null;
  certificadora: string | null;
  updatedAt: string;
  historicoEdicoes?: { id: string; usuarioNome: string; criadoEm: string; camposAlterados: string[] }[];
  conferenciaReferencia?: { status: string; versao: number | null; totalCandidatos: number; conferidoEm: string } | null;
  id: number;
  numeroLinha: number;
  matricula: string;
  nome: string | null;
  qualificacao: string;
  tipoDocumento: string;
  emissao: string | null;
  validade: string | null;
  recebimento: string | null;
  status: string;
  motivoErro: string | null;
  tentativas: number;
  tentativasEnvio: { id: number; status: string; usuarioNome: string | null; usuarioId: number | null; iniciadoEm: string; httpStatus: number | null; erro: string | null }[];
  funcionario: {
    nome: string;
    matricula: string;
    status: string | null;
    statusPrestserv: string | null;
  } | null;
};

export type ImportacoesResponse = {
  ambiente: "hmg" | "prd";
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  importacoes: Importacao[];
};

export type DetalheResponse = {
  historico?: { raizId: number; atualId: number; versoes: { id: number; nomeArquivo: string; status: string; createdAt: string; usuarioNome: string | null }[]; comentario: { texto: string; atualizadoEm: string; usuarioNome: string } | null };
  referencia?: { disponivel: boolean; motivo: string | null; versao: number | null; atualizadoEm: string | null };
  importacao: Importacao;
  itens: ItemImportacao[];
  totalItens: number;
  page: number;
  limit: number;
  totalPages: number;
};
