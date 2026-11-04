/** Administração e Logística com edição; equipe legada Logística equivale a Editor. */
export function canManageSispat(equipe: string | null | undefined): boolean {
  const nome = (equipe ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ');
  return /^(?:administracao|logistica(?: \((?:editor|gestor)\))?)$/i.test(nome);
}

/** Download do backup detalhado reservado à Administração. */
export function canDownloadSispatBackup(equipe: string | null | undefined): boolean {
  return (equipe ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase() === 'administracao';
}

export type SispatFuncionario = {
  id: number;
  nome: string;
  matricula: string;
  sispat: string | null;
  atualizadoEm: string;
};
export type SispatLinha = { linha: number; matricula: string; sispat: string };
export type SispatAlteracao = SispatFuncionario & { novoSispat: string | null };
export type SispatSituacao = 'PENDENTE' | 'ATUALIZADO' | 'SEM_ALTERACAO' | 'IGNORADO' | 'NAO_ENCONTRADO' | 'ERRO' | 'NAO_APLICADO' | 'DESFEITO';
export const SISPAT_SITUACOES: Record<SispatSituacao, string> = {
  PENDENTE: 'A atualizar', ATUALIZADO: 'Atualizado', SEM_ALTERACAO: 'Já correto — desconsiderado',
  IGNORADO: 'Sem SISPAT — ignorado', NAO_ENCONTRADO: 'Matrícula não encontrada', ERRO: 'Erro na linha',
  NAO_APLICADO: 'Não atualizado', DESFEITO: 'Restaurado pelo backup',
};
export type SispatRegistro = {
  linha: number; matricula: string; recebido: string | null; status: SispatSituacao; motivo: string;
  tipoAlteracao?: 'CADASTRO' | 'SUBSTITUICAO'; alertaDuplicidade?: boolean;
  funcionarioId?: number; nome?: string; anterior?: string | null; versaoAntes?: string; versaoDepois?: string;
};
export type SispatImportacaoResumo = {
  id: string; nomeArquivo: string; aba: string; status: string; total: number;
  resumo: Record<SispatSituacao, number>; criadoPorId: number; criadoEm: string;
  criadoPorNome: string | null; restauradoPorNome: string | null; restauradoPorId: number | null;
  novosCadastros: number; substituicoes: number; linhasComAlerta: number; numerosDuplicados: number;
  aplicadoEm: string | null; desfeitoEm: string | null; erro: string | null;
};
export type SispatImportacaoPagina = SispatImportacaoResumo & { itens: SispatRegistro[]; totalItens: number; page: number; limit: number };

export type SispatParticipante = { matricula: string; nome: string | null; origem: 'PLANILHA' | 'CADASTRO' | 'PLANILHA_E_CADASTRO' };
export type SispatDuplicidade = { sispat: string; participantes: SispatParticipante[] };
export type SispatDuplicidadePagina = { sispat: string; itens: SispatParticipante[]; total: number; page: number; limit: number };
export type SispatProgresso = { fase: 'PREPARANDO' | 'PROCESSANDO' | 'CONFIRMANDO'; processados: number; total: number };
export type SispatEvento =
  | { tipo: 'progresso'; progresso: SispatProgresso }
  | { tipo: 'concluido'; resultado: SispatImportacaoResumo }
  | { tipo: 'erro'; erro: string };
