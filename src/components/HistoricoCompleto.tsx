'use client';

import { useState, useEffect } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

interface HistoricoItem {
  id: number;
  tipoAcao: string;
  descricaoAcao: string;
  dataAcao: string;
  usuarioResponsavel: string;
  entidade: string;
  campoAlterado?: string;
  valorAnterior?: string;
  valorNovo?: string;
  observacoes?: string;
}

interface HistoricoCompletoProps {
  funcionarioId: string;
}

export default function HistoricoCompleto({ funcionarioId }: HistoricoCompletoProps) {
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchHistorico();
  }, [funcionarioId, currentPage]);

  const fetchHistorico = async () => {
    try {
      setLoading(true);
      const offset = (currentPage - 1) * itemsPerPage;
      const params = new URLSearchParams({
        remanejamentoFuncionarioId: funcionarioId,
        limit: itemsPerPage.toString(),
        offset: offset.toString()
      });

      const response = await fetch(`/api/remanejamento/historico?${params}`);
      
      if (response.ok) {
        const data = await response.json();
        setHistorico(data.historico || []);
        setTotal(data.total || 0);
      }
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTipoAcaoColor = (tipoAcao: string) => {
    switch (tipoAcao) {
      case 'CRIACAO':
        return 'bg-green-500';
      case 'ATUALIZACAO_STATUS':
        return 'bg-blue-500';
      case 'ATUALIZACAO_CAMPO':
        return 'bg-yellow-500';
      case 'EXCLUSAO':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getTipoAcaoIcon = (tipoAcao: string) => {
    switch (tipoAcao) {
      case 'CRIACAO':
        return '+';
      case 'ATUALIZACAO_STATUS':
        return '↻';
      case 'ATUALIZACAO_CAMPO':
        return '✎';
      case 'EXCLUSAO':
        return '×';
      default:
        return '•';
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

  const totalPages = Math.ceil(total / itemsPerPage);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (historico.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-6 text-center">
        <p className="text-gray-500">Nenhum histórico encontrado.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Histórico de Alterações</h3>
        <p className="text-sm text-gray-500 mt-1">
          {total} {total === 1 ? 'registro encontrado' : 'registros encontrados'}
        </p>
      </div>

      {/* Lista de histórico */}
      <div className="divide-y divide-gray-100">
        {historico.map((item) => (
          <div key={item.id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
            <div className="flex items-start space-x-3">
              {/* Ícone do tipo de ação */}
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold ${getTipoAcaoColor(item.tipoAcao)}`}>
                {getTipoAcaoIcon(item.tipoAcao)}
              </div>
              
              {/* Conteúdo */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {item.descricaoAcao}
                  </p>
                  <span className="text-xs text-gray-500 ml-2 whitespace-nowrap">
                    {formatarData(item.dataAcao)}
                  </span>
                </div>
                
                <div className="flex items-center space-x-4 mt-1">
                  <span className="text-xs text-gray-500">
                    por {item.usuarioResponsavel}
                  </span>
                  <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                    {item.entidade}
                  </span>
                </div>
                
                {/* Detalhes da mudança */}
                {(item.campoAlterado || item.observacoes) && (
                  <div className="mt-2 text-xs text-gray-600">
                    {item.campoAlterado && item.valorAnterior && item.valorNovo && (
                      <div className="bg-gray-50 rounded px-2 py-1">
                        <span className="font-medium">{item.campoAlterado}:</span>
                        <span className="text-red-600 line-through ml-1">{item.valorAnterior}</span>
                        <span className="mx-1">→</span>
                        <span className="text-green-600">{item.valorNovo}</span>
                      </div>
                    )}
                    {item.observacoes && (
                      <div className="mt-1 text-gray-500 italic">
                        {item.observacoes}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Página {currentPage} de {totalPages}
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-1 rounded border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              <ChevronLeftIcon className="w-4 h-4" />
            </button>
            
            {/* Números das páginas */}
            <div className="flex space-x-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => goToPage(pageNum)}
                    className={`px-2 py-1 text-xs rounded ${
                      currentPage === pageNum
                        ? 'bg-blue-600 text-white'
                        : 'border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            
            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="p-1 rounded border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}