'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  UserGroupIcon,
  BuildingOfficeIcon,
  DocumentTextIcon,
  EyeIcon,
  PencilIcon,
  CogIcon,
  PlusIcon
} from '@heroicons/react/24/outline';
import { SolicitacaoRemanejamento, StatusRemanejamento, PrioridadeRemanejamento } from '@/types/remanejamento';

// Tipos já importados do arquivo de tipos

interface SolicitacaoCompleta extends Omit<SolicitacaoRemanejamento, 'contratoOrigem' | 'contratoDestino'> {
  funcionarios: {
    id: number;
    nome: string;
    matricula: string;
    funcao?: string;
  }[];
  contratoOrigem?: {
    nome: string;
    cliente: string;
  };
  contratoDestino?: {
    nome: string;
    cliente: string;
  };
}

export default function RemanejamentosPage() {
  const router = useRouter();
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoCompleta[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<StatusRemanejamento | 'Todos'>('Todos');
  const [filtroPrioridade, setFiltroPrioridade] = useState<PrioridadeRemanejamento | 'Todas'>('Todas');
  const [solicitacaoSelecionada, setSolicitacaoSelecionada] = useState<SolicitacaoCompleta | null>(null);
  const [modalDetalhesAberto, setModalDetalhesAberto] = useState(false);

  useEffect(() => {
    fetchSolicitacoes();
  }, []);

  const fetchSolicitacoes = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/remanejamentos');
      if (response.ok) {
        const data = await response.json();
        
        // Agrupar solicitações por características similares para simular múltiplos funcionários
        const solicitacoesAgrupadas = data.reduce((acc: any[], solicitacao: any) => {
          // Criar chave única baseada em origem, destino, data e solicitante
          const chave = `${solicitacao.centroCustoOrigem}-${solicitacao.centroCustoDestino}-${solicitacao.solicitadoPor}-${new Date(solicitacao.dataSolicitacao).toDateString()}`;
          
          const existente = acc.find(s => s.chaveAgrupamento === chave);
          
          if (existente) {
            // Adicionar funcionário à solicitação existente
            existente.funcionarios.push({
              id: solicitacao.funcionario.id,
              nome: solicitacao.funcionario.nome,
              matricula: solicitacao.funcionario.matricula,
              funcao: solicitacao.funcionario.funcao
            });
          } else {
            // Criar nova solicitação agrupada
            acc.push({
              ...solicitacao,
              chaveAgrupamento: chave,
              funcionarios: [{
                id: solicitacao.funcionario.id,
                nome: solicitacao.funcionario.nome,
                matricula: solicitacao.funcionario.matricula,
                funcao: solicitacao.funcionario.funcao
              }]
            });
          }
          
          return acc;
        }, []);
        
        setSolicitacoes(solicitacoesAgrupadas);
      } else {
        console.error('Erro ao carregar solicitações:', response.statusText);
        alert('Erro ao carregar solicitações. Tente novamente.');
      }
    } catch (error) {
      console.error('Erro ao carregar solicitações:', error);
      alert('Erro de conexão. Verifique sua internet e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const atualizarStatus = async (id: number, novoStatus: StatusRemanejamento, observacoes?: string) => {
    try {
      const response = await fetch('/api/remanejamentos', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id,
          status: novoStatus,
          observacoes,
          analisadoPor: 'Usuário Atual' // TODO: Implementar autenticação
        }),
      });

      if (response.ok) {
        await fetchSolicitacoes();
        const statusLabel = novoStatus === 'Processado' ? 'processada' : novoStatus.toLowerCase() + 'a';
        alert(`Solicitação ${statusLabel} com sucesso!`);
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Erro ao atualizar status');
      }
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      alert(`Erro ao atualizar status da solicitação: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  };

  const solicitacoesFiltradas = solicitacoes.filter(s => {
    if (filtroStatus !== 'Todos' && s.status !== filtroStatus) return false;
    if (filtroPrioridade !== 'Todas' && s.prioridade !== filtroPrioridade) return false;
    return true;
  });

  const getStatusColor = (status: StatusRemanejamento) => {
    switch (status) {
      case 'Pendente': return 'bg-yellow-100 text-yellow-800';
      case 'Aprovado': return 'bg-green-100 text-green-800';
      case 'Rejeitado': return 'bg-red-100 text-red-800';
      case 'Processado': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPrioridadeColor = (prioridade: PrioridadeRemanejamento) => {
    switch (prioridade) {
      case 'urgente': return 'bg-red-100 text-red-800';
      case 'alta': return 'bg-orange-100 text-orange-800';
      case 'media': return 'bg-blue-100 text-blue-800';
      case 'baixa': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPrioridadeLabel = (prioridade: PrioridadeRemanejamento) => {
    switch (prioridade) {
      case 'urgente': return 'Urgente';
      case 'alta': return 'Alta';
      case 'media': return 'Média';
      case 'baixa': return 'Baixa';
      default: return prioridade;
    }
  };

  const getStatusIcon = (status: StatusRemanejamento) => {
    switch (status) {
      case 'Pendente': return <ClockIcon className="w-4 h-4" />;
      case 'Aprovado': return <CheckCircleIcon className="w-4 h-4" />;
      case 'Rejeitado': return <XCircleIcon className="w-4 h-4" />;
      case 'Processado': return <CogIcon className="w-4 h-4" />;
      default: return <ClockIcon className="w-4 h-4" />;
    }
  };

  const abrirDetalhes = (solicitacao: SolicitacaoCompleta) => {
    setSolicitacaoSelecionada(solicitacao);
    setModalDetalhesAberto(true);
  };

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando solicitações...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Solicitações de Remanejamento</h1>
            <p className="text-gray-600">Gerencie as solicitações de transferência de funcionários</p>
          </div>
          <button
            onClick={() => router.push('/planejamento/remanejamentos/novo')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <PlusIcon className="w-5 h-5" />
            Nova Solicitação
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="Todos">Todos os status</option>
              <option value="Pendente">Pendente</option>
              <option value="Processado">Processado</option>
              <option value="Aprovado">Aprovado</option>
              <option value="Rejeitado">Rejeitado</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Prioridade
            </label>
            <select
              value={filtroPrioridade}
              onChange={(e) => setFiltroPrioridade(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="Todas">Todas as prioridades</option>
              <option value="urgente">Urgente</option>
              <option value="alta">Alta</option>
              <option value="media">Média</option>
              <option value="baixa">Baixa</option>
            </select>
          </div>

          <div className="flex items-end">
            <div className="text-sm text-gray-600">
              <p><strong>{solicitacoesFiltradas.length}</strong> solicitações encontradas</p>
              <p><strong>{solicitacoesFiltradas.filter(s => s.status === 'Pendente').length}</strong> pendentes</p>
            </div>
          </div>
        </div>
      </div>

      {/* Lista de Solicitações */}
      <div className="space-y-4">
        {solicitacoesFiltradas.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <UserGroupIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma solicitação encontrada</h3>
            <p className="text-gray-600">Não há solicitações de remanejamento com os filtros selecionados.</p>
          </div>
        ) : (
          solicitacoesFiltradas.map((solicitacao) => (
            <div key={solicitacao.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                      getStatusColor(solicitacao.status)
                    }`}>
                      {getStatusIcon(solicitacao.status)}
                      {solicitacao.status === 'Processado' ? 'Processado' : solicitacao.status}
                    </span>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      getPrioridadeColor(solicitacao.prioridade)
                    }`}>
                      {getPrioridadeLabel(solicitacao.prioridade)}
                    </span>
                    <span className="text-xs text-gray-500">
                      #{solicitacao.id} • {new Date(solicitacao.createdAt).toLocaleDateString('pt-BR')}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
                        <BuildingOfficeIcon className="w-4 h-4 text-blue-600" />
                        Origem
                      </h4>
                      <p className="text-sm text-gray-600">
                        <strong>Contrato:</strong> {solicitacao.contratoOrigem?.nome || 'Não especificado'}
                      </p>
                      <p className="text-sm text-gray-600">
                        <strong>Centro de Custo:</strong> {solicitacao.centroCustoOrigem}
                      </p>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
                        <BuildingOfficeIcon className="w-4 h-4 text-green-600" />
                        Destino
                      </h4>
                      <p className="text-sm text-gray-600">
                        <strong>Contrato:</strong> {solicitacao.contratoDestino?.nome || 'Não especificado'}
                      </p>
                      <p className="text-sm text-gray-600">
                        <strong>Centro de Custo:</strong> {solicitacao.centroCustoDestino}
                      </p>
                    </div>
                  </div>

                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
                      <UserGroupIcon className="w-4 h-4 text-purple-600" />
                      Funcionários ({solicitacao.funcionarios?.length || 0})
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {solicitacao.funcionarios?.slice(0, 3).map((funcionario) => (
                        <span key={funcionario.id} className="inline-flex items-center px-2 py-1 rounded-md bg-gray-100 text-xs text-gray-700">
                          {funcionario.nome}
                        </span>
                      ))}
                      {(solicitacao.funcionarios?.length || 0) > 3 && (
                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-gray-100 text-xs text-gray-700">
                          +{(solicitacao.funcionarios?.length || 0) - 3} mais
                        </span>
                      )}
                    </div>
                  </div>

                  {solicitacao.justificativa && (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-1 flex items-center gap-2">
                        <DocumentTextIcon className="w-4 h-4 text-gray-600" />
                        Justificativa
                      </h4>
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {solicitacao.justificativa}
                      </p>
                    </div>
                  )}

                  <div className="text-xs text-gray-500">
                    <p>Solicitado por: {solicitacao.solicitadoPor}</p>
                    {solicitacao.analisadoPor && (
                      <p>Analisado por: {solicitacao.analisadoPor}</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2 ml-4">
                  <button
                    onClick={() => abrirDetalhes(solicitacao)}
                    className="flex items-center gap-1 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                  >
                    <EyeIcon className="w-4 h-4" />
                    Ver Detalhes
                  </button>

                  {solicitacao.status === 'Pendente' && (
                    <>
                      <button
                        onClick={() => atualizarStatus(solicitacao.id, 'Processado')}
                        className="flex items-center gap-1 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                      >
                        <CogIcon className="w-4 h-4" />
                        Processar
                      </button>
                      <button
                        onClick={() => {
                          const observacoes = prompt('Observações (opcional):');
                          atualizarStatus(solicitacao.id, 'Aprovado', observacoes || undefined);
                        }}
                        className="flex items-center gap-1 px-3 py-1 text-sm text-green-600 hover:bg-green-50 rounded-md transition-colors"
                      >
                        <CheckCircleIcon className="w-4 h-4" />
                        Aprovar
                      </button>
                      <button
                        onClick={() => {
                          const observacoes = prompt('Motivo da rejeição:');
                          if (observacoes) {
                            atualizarStatus(solicitacao.id, 'Rejeitado', observacoes);
                          }
                        }}
                        className="flex items-center gap-1 px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      >
                        <XCircleIcon className="w-4 h-4" />
                        Rejeitar
                      </button>
                    </>
                  )}

                  {solicitacao.status === 'Processado' && (
                    <>
                      <button
                        onClick={() => {
                          const observacoes = prompt('Observações (opcional):');
                          atualizarStatus(solicitacao.id, 'Aprovado', observacoes || undefined);
                        }}
                        className="flex items-center gap-1 px-3 py-1 text-sm text-green-600 hover:bg-green-50 rounded-md transition-colors"
                      >
                        <CheckCircleIcon className="w-4 h-4" />
                        Aprovar
                      </button>
                      <button
                        onClick={() => {
                          const observacoes = prompt('Motivo da rejeição:');
                          if (observacoes) {
                            atualizarStatus(solicitacao.id, 'Rejeitado', observacoes);
                          }
                        }}
                        className="flex items-center gap-1 px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      >
                        <XCircleIcon className="w-4 h-4" />
                        Rejeitar
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal de Detalhes */}
      {modalDetalhesAberto && solicitacaoSelecionada && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">
                Detalhes da Solicitação #{solicitacaoSelecionada.id}
              </h2>
              <button
                onClick={() => setModalDetalhesAberto(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <XCircleIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[70vh]">
              <div className="space-y-6">
                {/* Status e Prioridade */}
                <div className="flex items-center gap-4">
                  <span className={`inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium ${
                    getStatusColor(solicitacaoSelecionada.status)
                  }`}>
                    {getStatusIcon(solicitacaoSelecionada.status)}
                    {solicitacaoSelecionada.status === 'Processado' ? 'Processado' : solicitacaoSelecionada.status}
                  </span>
                  <span className={`inline-flex items-center px-3 py-2 rounded-full text-sm font-medium ${
                    getPrioridadeColor(solicitacaoSelecionada.prioridade)
                  }`}>
                    Prioridade: {getPrioridadeLabel(solicitacaoSelecionada.prioridade)}
                  </span>
                </div>

                {/* Origem e Destino */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h3 className="font-medium text-blue-900 mb-3 flex items-center gap-2">
                      <BuildingOfficeIcon className="w-5 h-5" />
                      Origem
                    </h3>
                    <p className="text-sm text-blue-800 mb-1">
                      <strong>Contrato:</strong> {solicitacaoSelecionada.contratoOrigem?.nome || 'Não especificado'}
                    </p>
                    <p className="text-sm text-blue-800">
                      <strong>Centro de Custo:</strong> {solicitacaoSelecionada.centroCustoOrigem}
                    </p>
                  </div>

                  <div className="bg-green-50 p-4 rounded-lg">
                    <h3 className="font-medium text-green-900 mb-3 flex items-center gap-2">
                      <BuildingOfficeIcon className="w-5 h-5" />
                      Destino
                    </h3>
                    <p className="text-sm text-green-800 mb-1">
                      <strong>Contrato:</strong> {solicitacaoSelecionada.contratoDestino?.nome || 'Não especificado'}
                    </p>
                    <p className="text-sm text-green-800">
                      <strong>Centro de Custo:</strong> {solicitacaoSelecionada.centroCustoDestino}
                    </p>
                  </div>
                </div>

                {/* Funcionários */}
                <div>
                  <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <UserGroupIcon className="w-5 h-5" />
                    Funcionários ({solicitacaoSelecionada.funcionarios?.length || 0})
                  </h3>
                  <div className="bg-gray-50 rounded-lg overflow-hidden">
                    <div className="max-h-48 overflow-y-auto">
                      {solicitacaoSelecionada.funcionarios?.map((funcionario, index) => (
                        <div key={funcionario.id} className={`p-3 ${index > 0 ? 'border-t border-gray-200' : ''}`}>
                          <p className="font-medium text-gray-900">{funcionario.nome}</p>
                          <p className="text-sm text-gray-600">
                            {funcionario.matricula} • {funcionario.funcao || 'Sem função'}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Justificativa */}
                {solicitacaoSelecionada.justificativa && (
                  <div>
                    <h3 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                      <DocumentTextIcon className="w-5 h-5" />
                      Justificativa
                    </h3>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-700">{solicitacaoSelecionada.justificativa}</p>
                    </div>
                  </div>
                )}

                {/* Informações */}
                <div className="border-t border-gray-200 pt-4">
                  <h3 className="font-medium text-gray-900 mb-2">Informações</h3>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p><strong>Solicitado por:</strong> {solicitacaoSelecionada.solicitadoPor}</p>
                    <p><strong>Data da solicitação:</strong> {new Date(solicitacaoSelecionada.createdAt).toLocaleString('pt-BR')}</p>
                    {solicitacaoSelecionada.analisadoPor && (
                      <p><strong>Analisado por:</strong> {solicitacaoSelecionada.analisadoPor}</p>
                    )}
                    {solicitacaoSelecionada.updatedAt && (
                      <p><strong>Última atualização:</strong> {new Date(solicitacaoSelecionada.updatedAt).toLocaleString('pt-BR')}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setModalDetalhesAberto(false)}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}