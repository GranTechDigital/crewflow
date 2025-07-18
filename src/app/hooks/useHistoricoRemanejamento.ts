import { useState } from 'react';

interface RegistrarHistoricoParams {
  remanejamentoFuncionarioId?: string;
  solicitacaoId?: number;
  tipoAcao: 'CRIACAO' | 'ATUALIZACAO_STATUS' | 'ATUALIZACAO_CAMPO' | 'EXCLUSAO';
  entidade: 'SOLICITACAO' | 'FUNCIONARIO' | 'TAREFA';
  campoAlterado?: string;
  valorAnterior?: string;
  valorNovo?: string;
  descricaoAcao: string;
  usuarioResponsavel: string;
  observacoes?: string;
}

export function useHistoricoRemanejamento() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const registrarAcao = async (params: RegistrarHistoricoParams) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/remanejamento/historico', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao registrar ação no histórico');
      }

      const result = await response.json();
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMessage);
      console.error('Erro ao registrar histórico:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Funções de conveniência para ações comuns
  const registrarCriacao = async (
    entidade: 'SOLICITACAO' | 'FUNCIONARIO' | 'TAREFA',
    descricaoAcao: string,
    usuarioResponsavel: string,
    solicitacaoId?: number,
    remanejamentoFuncionarioId?: string,
    observacoes?: string
  ) => {
    return registrarAcao({
      tipoAcao: 'CRIACAO',
      entidade,
      descricaoAcao,
      usuarioResponsavel,
      solicitacaoId,
      remanejamentoFuncionarioId,
      observacoes
    });
  };

  const registrarMudancaStatus = async (
    entidade: 'SOLICITACAO' | 'FUNCIONARIO' | 'TAREFA',
    statusAnterior: string,
    statusNovo: string,
    usuarioResponsavel: string,
    solicitacaoId?: number,
    remanejamentoFuncionarioId?: string,
    observacoes?: string
  ) => {
    return registrarAcao({
      tipoAcao: 'ATUALIZACAO_STATUS',
      entidade,
      campoAlterado: 'status',
      valorAnterior: statusAnterior,
      valorNovo: statusNovo,
      descricaoAcao: `Status alterado de "${statusAnterior}" para "${statusNovo}"`,
      usuarioResponsavel,
      solicitacaoId,
      remanejamentoFuncionarioId,
      observacoes
    });
  };

  const registrarAtualizacaoCampo = async (
    entidade: 'SOLICITACAO' | 'FUNCIONARIO' | 'TAREFA',
    campo: string,
    valorAnterior: string,
    valorNovo: string,
    usuarioResponsavel: string,
    solicitacaoId?: number,
    remanejamentoFuncionarioId?: string,
    observacoes?: string
  ) => {
    return registrarAcao({
      tipoAcao: 'ATUALIZACAO_CAMPO',
      entidade,
      campoAlterado: campo,
      valorAnterior,
      valorNovo,
      descricaoAcao: `Campo "${campo}" alterado de "${valorAnterior}" para "${valorNovo}"`,
      usuarioResponsavel,
      solicitacaoId,
      remanejamentoFuncionarioId,
      observacoes
    });
  };

  const registrarExclusao = async (
    entidade: 'SOLICITACAO' | 'FUNCIONARIO' | 'TAREFA',
    descricaoAcao: string,
    usuarioResponsavel: string,
    solicitacaoId?: number,
    remanejamentoFuncionarioId?: string,
    observacoes?: string
  ) => {
    return registrarAcao({
      tipoAcao: 'EXCLUSAO',
      entidade,
      descricaoAcao,
      usuarioResponsavel,
      solicitacaoId,
      remanejamentoFuncionarioId,
      observacoes
    });
  };

  return {
    registrarAcao,
    registrarCriacao,
    registrarMudancaStatus,
    registrarAtualizacaoCampo,
    registrarExclusao,
    loading,
    error
  };
}