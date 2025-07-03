'use client';

import { useState, useEffect } from 'react';
import { ClockIcon, UserIcon, DocumentTextIcon } from '@heroicons/react/24/outline';

interface HistoricoItem {
  id: number;
  tipoAcao: string;
  entidade: string;
  campoAlterado?: string;
  valorAnterior?: string;
  valorNovo?: string;
  descricaoAcao: string;
  usuarioResponsavel: string;
  dataAcao: string;
  observacoes?: string;
  solicitacao?: {
    id: number;
    status: string;
    solicitadoPor: string;
  };
  remanejamentoFuncionario?: {
    id: string;
    statusTarefas: string;
    statusPrestserv: string;
    funcionario: {
      nome: string;
      matricula: string;
    };
  };
}

interface HistoricoRemanejamentoProps {
  solicitacaoId?: number;
  remanejamentoFuncionarioId?: string;
  tarefaId?: string;
  entidade?: string;
  tipoAcao?: string;
  showFilters?: boolean;
}

export default function HistoricoRemanejamento({ 
  solicitacaoId, 
  remanejamentoFuncionarioId, 
  tarefaId,
  entidade,
  tipoAcao,
  showFilters = true 
}: HistoricoRemanejamentoProps) {
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtroTipoAcao, setFiltroTipoAcao] = useState(tipoAcao || '');
  const [filtroEntidade, setFiltroEntidade] = useState(entidade || '');
  const [limit] = useState(20);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetchHistorico();
  }, [solicitacaoId, remanejamentoFuncionarioId, tarefaId, filtroEntidade, filtroTipoAcao, offset]);

  const fetchHistorico = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString()
      });

      if (solicitacaoId) params.append('solicitacaoId', solicitacaoId.toString());
      if (remanejamentoFuncionarioId) params.append('remanejamentoFuncionarioId', remanejamentoFuncionarioId);
      if (tarefaId) params.append('tarefaId', tarefaId);
      if (filtroTipoAcao) params.append('tipoAcao', filtroTipoAcao);
      if (filtroEntidade) params.append('entidade', filtroEntidade);

      const response = await fetch(`/api/remanejamento/historico?${params}`);
      
      if (!response.ok) {
        throw new Error('Erro ao carregar histórico');
      }
      
      const data = await response.json();
      setHistorico(data.historico);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  const getTipoAcaoColor = (tipoAcao: string) => {
    switch (tipoAcao) {
      case 'CRIACAO':
        return 'bg-green-100 text-green-800';
      case 'ATUALIZACAO_STATUS':
        return 'bg-blue-100 text-blue-800';
      case 'ATUALIZACAO_CAMPO':
        return 'bg-yellow-100 text-yellow-800';
      case 'EXCLUSAO':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getEntidadeIcon = (entidade: string) => {
    switch (entidade) {
      case 'SOLICITACAO':
        return <DocumentTextIcon className="h-4 w-4" />;
      case 'FUNCIONARIO':
        return <UserIcon className="h-4 w-4" />;
      case 'TAREFA':
        return <ClockIcon className="h-4 w-4" />;
      default:
        return <DocumentTextIcon className="h-4 w-4" />;
    }
  };

  const formatarData = (dataString: string) => {
    const data = new Date(dataString);
    return data.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="text-red-800">
          <strong>Erro:</strong> {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">Histórico de Ações</h3>
        <span className="text-sm text-gray-500">{total} registro(s)</span>
      </div>

      {showFilters && (
        <div className="bg-white p-4 rounded-lg shadow space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo de Ação
              </label>
              <select
                value={filtroTipoAcao}
                onChange={(e) => setFiltroTipoAcao(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos os tipos</option>
                <option value="CRIACAO">Criação</option>
                <option value="ATUALIZACAO_STATUS">Atualização de Status</option>
                <option value="ATUALIZACAO_CAMPO">Atualização de Campo</option>
                <option value="EXCLUSAO">Exclusão</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Entidade
              </label>
              <select
                value={filtroEntidade}
                onChange={(e) => setFiltroEntidade(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todas as entidades</option>
                <option value="SOLICITACAO">Solicitação</option>
                <option value="FUNCIONARIO">Funcionário</option>
                <option value="TAREFA">Tarefa</option>
              </select>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {historico.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">Nenhum registro de histórico encontrado.</p>
          </div>
        ) : (
          historico.map((item) => (
            <div key={item.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3 flex-1">
                  <div className="flex-shrink-0 mt-1">
                    {getEntidadeIcon(item.entidade)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className={`px-2 py-1 text-xs rounded-full ${getTipoAcaoColor(item.tipoAcao)}`}>
                        {item.tipoAcao.replace('_', ' ')}
                      </span>
                      <span className="text-xs text-gray-500">
                        {item.entidade}
                      </span>
                    </div>
                    <p className="text-sm text-gray-900 mb-2">{item.descricaoAcao}</p>
                    
                    {item.campoAlterado && (
                      <div className="text-xs text-gray-600 mb-2">
                        <strong>Campo:</strong> {item.campoAlterado}
                        {item.valorAnterior && (
                          <span className="ml-2">
                            <span className="text-red-600">De: {item.valorAnterior}</span>
                            {item.valorNovo && (
                              <span className="ml-2 text-green-600">Para: {item.valorNovo}</span>
                            )}
                          </span>
                        )}
                      </div>
                    )}
                    
                    {item.remanejamentoFuncionario && (
                      <div className="text-xs text-gray-600 mb-2">
                        <strong>Funcionário:</strong> {item.remanejamentoFuncionario.funcionario.nome} 
                        ({item.remanejamentoFuncionario.funcionario.matricula})
                      </div>
                    )}
                    
                    {item.observacoes && (
                      <div className="text-xs text-gray-600 mb-2">
                        <strong>Observações:</strong> {item.observacoes}
                      </div>
                    )}
                    
                    <div className="flex items-center space-x-4 text-xs text-gray-500">
                      <div className="flex items-center space-x-1">
                        <UserIcon className="h-3 w-3" />
                        <span>{item.usuarioResponsavel}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <ClockIcon className="h-3 w-3" />
                        <span>{formatarData(item.dataAcao)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {total > limit && (
        <div className="flex justify-center space-x-2">
          <button
            onClick={() => setOffset(Math.max(0, offset - limit))}
            disabled={offset === 0}
            className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Anterior
          </button>
          <span className="px-3 py-1 text-sm text-gray-600">
            {Math.floor(offset / limit) + 1} de {Math.ceil(total / limit)}
          </span>
          <button
            onClick={() => setOffset(offset + limit)}
            disabled={offset + limit >= total}
            className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Próximo
          </button>
        </div>
      )}
    </div>
  );
}