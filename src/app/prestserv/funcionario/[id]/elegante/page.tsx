'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useToast } from '@/components/Toast';
import { RemanejamentoFuncionario, StatusPrestserv, TarefaRemanejamento, StatusTarefa } from '@/types/remanejamento-funcionario';
import TarefasPadraoModal from '@/components/TarefasPadraoModal';
import HistoricoSimplificado from '@/components/HistoricoSimplificado';
import {
  ArrowLeftIcon,
  UserIcon,
  DocumentTextIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
  ChatBubbleLeftRightIcon
} from '@heroicons/react/24/outline';

interface NovaTarefa {
  tipo: string;
  descricao: string;
  responsavel: string;
  prioridade: 'Baixa' | 'Media' | 'Alta';
  dataLimite?: string;
}

interface ObservacaoTarefa {
  id: number;
  texto: string;
  dataCriacao: string;
  dataModificacao: string;
  criadoPor: string;
  modificadoPor: string;
}

interface NovaObservacaoTarefa {
  texto: string;
  criadoPor: string;
}

export default function DetalheFuncionarioElegante() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const funcionarioId = params.id as string;
  
  const [funcionario, setFuncionario] = useState<RemanejamentoFuncionario | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mostrarFormTarefa, setMostrarFormTarefa] = useState(false);
  const [mostrarTarefasPadrao, setMostrarTarefasPadrao] = useState(false);
  const [novaTarefa, setNovaTarefa] = useState<NovaTarefa>({
    tipo: '',
    descricao: '',
    responsavel: '',
    prioridade: 'Media'
  });
  const [observacoesTarefa, setObservacoesTarefa] = useState<{ [tarefaId: string]: ObservacaoTarefa[] }>({});
  const [mostrarObservacoesTarefa, setMostrarObservacoesTarefa] = useState<string | null>(null);
  const [novaObservacaoTarefa, setNovaObservacaoTarefa] = useState<NovaObservacaoTarefa>({ texto: '', criadoPor: 'Sistema' });
  
  // Estados para paginação e filtros
  const [currentPage, setCurrentPage] = useState(1);
  const [tarefasPerPage] = useState(5);
  const [filtroStatus, setFiltroStatus] = useState<string>('');
  const [filtroResponsavel, setFiltroResponsavel] = useState<string>('');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  useEffect(() => {
    if (funcionarioId) {
      fetchFuncionario();
    }
  }, [funcionarioId]);

  const fetchFuncionario = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/logistica/funcionario/${funcionarioId}`);
      
      if (!response.ok) {
        throw new Error('Erro ao carregar dados do funcionário');
      }
      
      const data = await response.json();
      setFuncionario(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  const atualizarTarefa = async (tarefaId: string, status: StatusTarefa) => {
    try {
      const response = await fetch(`/api/logistica/tarefas/${tarefaId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      
      if (!response.ok) {
        throw new Error('Erro ao atualizar tarefa');
      }
      
      await fetchFuncionario();
      showToast('Tarefa atualizada com sucesso', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro desconhecido', 'error');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'CONCLUIDO':
      case 'APROVADO':
        return <CheckCircleIcon className="w-5 h-5 text-green-600" />;
      case 'PENDENTE':
        return <ClockIcon className="w-5 h-5 text-yellow-600" />;
      case 'REJEITADO':
        return <XCircleIcon className="w-5 h-5 text-red-600" />;
      case 'EM_ANDAMENTO':
        return <ExclamationTriangleIcon className="w-5 h-5 text-blue-600" />;
      default:
        return <ClockIcon className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CONCLUIDO':
      case 'APROVADO':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'PENDENTE':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'REJEITADO':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'EM_ANDAMENTO':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const getProgresso = () => {
    if (!funcionario?.tarefas) return 0;
    const concluidas = funcionario.tarefas.filter(t => t.status === 'CONCLUIDO').length;
    return (concluidas / funcionario.tarefas.length) * 100;
  };

  // Filtrar tarefas
  const tarefasFiltradas = funcionario?.tarefas?.filter(tarefa => {
    const matchStatus = !filtroStatus || tarefa.status === filtroStatus;
    const matchResponsavel = !filtroResponsavel || tarefa.responsavel === filtroResponsavel;
    return matchStatus && matchResponsavel;
  }) || [];

  // Paginar tarefas
  const indexOfLastTarefa = currentPage * tarefasPerPage;
  const indexOfFirstTarefa = indexOfLastTarefa - tarefasPerPage;
  const currentTarefas = tarefasFiltradas.slice(indexOfFirstTarefa, indexOfLastTarefa);
  const totalPages = Math.ceil(tarefasFiltradas.length / tarefasPerPage);

  // Reset página quando filtros mudam
  useEffect(() => {
    setCurrentPage(1);
  }, [filtroStatus, filtroResponsavel]);

  const getStatusOptions = () => {
    // Status prestserv (valores do banco)
    const statusPrestserv = [
      "PENDENTE", "APROVADO", "REPROVADO", "CRIADO", "SUBMETIDO",
      "EM VALIDAÇÃO", "VALIDADO", "INVALIDADO", "CANCELADO"
    ];
    
    // Status de tarefas
    const statusTarefas = [
      "SUBMETER RASCUNHO", "TAREFAS PENDENTES", "ATENDER TAREFAS", 
      "SOLICITAÇÃO CONCLUÍDA", "APROVAR SOLICITAÇÃO", "REPROVAR TAREFAS"
    ];
    
    // Combinar status das tarefas existentes
    const statusExistentes = funcionario?.tarefas ? [...new Set(funcionario.tarefas.map(t => t.status))] : [];
    const todosStatus = new Set([...statusPrestserv, ...statusTarefas, ...statusExistentes]);
    
    return Array.from(todosStatus).sort();
  };

  // Função para mapear status do banco para exibição com numeração
  const getStatusDisplayText = (status: string): string => {
    const statusMap: { [key: string]: string } = {
      "PENDENTE": "1. PENDENTE",
      "APROVADO": "2. APROVADO",
      "REPROVADO": "3. REPROVADO",
      "CRIADO": "4. CRIADO",
      "SUBMETIDO": "5. SUBMETIDO",
      "EM VALIDAÇÃO": "6. EM VALIDAÇÃO",
      "VALIDADO": "7. VALIDADO",
      "INVALIDADO": "8. INVALIDADO",
      "CANCELADO": "9. CANCELADO"
    };
    return statusMap[status] || status;
  };

  const getResponsavelOptions = () => {
    if (!funcionario?.tarefas) return [];
    return [...new Set(funcionario.tarefas.map(t => t.responsavel))];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando dados...</p>
        </div>
      </div>
    );
  }

  if (error || !funcionario) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">❌ Erro</div>
          <p className="text-gray-600">{error || 'Funcionário não encontrado'}</p>
          <button 
            onClick={() => router.back()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.back()}
                className="flex items-center text-gray-600 hover:text-gray-900"
              >
                <ArrowLeftIcon className="w-5 h-5 mr-2" />
                Voltar
              </button>
              <div className="h-6 w-px bg-gray-300"></div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  {funcionario.funcionario?.nome}
                </h1>
                <p className="text-sm text-gray-500">
                  {funcionario.funcionario?.matricula} • {funcionario.funcionario?.funcao}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                {getStatusIcon(funcionario.statusTarefas)}
                <span className={`px-3 py-1 text-sm font-medium rounded-full border ${getStatusColor(funcionario.statusTarefas)}`}>
                  {funcionario.statusTarefas.replace('_', ' ')}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                {getStatusIcon(funcionario.statusPrestserv)}
                <span className={`px-3 py-1 text-sm font-medium rounded-full border ${getStatusColor(funcionario.statusPrestserv)}`}>
                  {funcionario.statusPrestserv.replace('_', ' ')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Informações da Solicitação */}
          <div className="lg:col-span-2 space-y-6">
            {/* Card de Informações */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <DocumentTextIcon className="w-5 h-5 mr-2" />
                  Informações da Solicitação
                </h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Solicitação</p>
                    <p className="text-lg font-semibold text-gray-900">#{funcionario.solicitacao?.id}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Data da Solicitação</p>
                    <p className="text-lg text-gray-900">
                      {funcionario.solicitacao?.dataSolicitacao ? formatDate(funcionario.solicitacao.dataSolicitacao) : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Contrato Origem</p>
                    <p className="text-lg text-gray-900">
                      {funcionario.solicitacao?.contratoOrigem?.numero || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Contrato Destino</p>
                    <p className="text-lg text-gray-900">
                      {funcionario.solicitacao?.contratoDestino?.numero || 'N/A'}
                    </p>
                  </div>
                </div>
                {funcionario.solicitacao?.justificativa && (
                  <div className="mt-6">
                    <p className="text-sm font-medium text-gray-500 mb-2">Justificativa</p>
                    <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">
                      {funcionario.solicitacao.justificativa}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Card de Tarefas */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                    <ClockIcon className="w-5 h-5 mr-2" />
                    Tarefas ({tarefasFiltradas.length})
                  </h2>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setMostrarFormTarefa(true)}
                      className="inline-flex items-center px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100"
                    >
                      <PlusIcon className="w-4 h-4 mr-1" />
                      Nova Tarefa
                    </button>
                    <button
                      onClick={() => setMostrarTarefasPadrao(true)}
                      className="inline-flex items-center px-3 py-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-md hover:bg-green-100"
                    >
                      <DocumentTextIcon className="w-4 h-4 mr-1" />
                      Padrões
                    </button>
                  </div>
                </div>
              </div>
              <div className="p-6">
                {/* Progresso */}
                {funcionario.tarefas && funcionario.tarefas.length > 0 && (
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Progresso</span>
                      <span className="text-sm text-gray-500">
                        {funcionario.tarefas.filter(t => t.status === 'CONCLUIDO').length} de {funcionario.tarefas.length} concluídas
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${getProgresso()}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {/* Filtros e Controles */}
                {funcionario.tarefas && funcionario.tarefas.length > 0 && (
                  <div className="mb-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex space-x-4">
                        <select
                          value={filtroStatus}
                          onChange={(e) => setFiltroStatus(e.target.value)}
                          className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Todos os Status</option>
                          {getStatusOptions().map(status => (
                            <option key={status} value={status}>{getStatusDisplayText(status)}</option>
                          ))}
                        </select>
                        <select
                          value={filtroResponsavel}
                          onChange={(e) => setFiltroResponsavel(e.target.value)}
                          className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Todos os Responsáveis</option>
                          {getResponsavelOptions().map(responsavel => (
                            <option key={responsavel} value={responsavel}>{responsavel}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setViewMode('cards')}
                          className={`px-3 py-2 text-sm rounded-md ${
                            viewMode === 'cards' 
                              ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                              : 'bg-gray-100 text-gray-700 border border-gray-200'
                          }`}
                        >
                          Cards
                        </button>
                        <button
                          onClick={() => setViewMode('table')}
                          className={`px-3 py-2 text-sm rounded-md ${
                            viewMode === 'table' 
                              ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                              : 'bg-gray-100 text-gray-700 border border-gray-200'
                          }`}
                        >
                          Tabela
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Lista de Tarefas */}
                <div className="space-y-4">
                  {!funcionario.tarefas || funcionario.tarefas.length === 0 ? (
                    <div className="text-center py-8">
                      <ClockIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">Nenhuma tarefa cadastrada</p>
                    </div>
                  ) : tarefasFiltradas.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-500">Nenhuma tarefa encontrada com os filtros aplicados</p>
                    </div>
                  ) : viewMode === 'cards' ? (
                    // Modo Cards
                    currentTarefas.map((tarefa) => (
                      <div key={tarefa.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h3 className="font-medium text-gray-900">{tarefa.tipo}</h3>
                            <p className="text-sm text-gray-600 mt-1">{tarefa.descricao}</p>
                          </div>
                          <div className="flex items-center space-x-2">
                            {getStatusIcon(tarefa.status)}
                            <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(tarefa.status)}`}>
                              {tarefa.status.replace('_', ' ')}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
                          <span>Responsável: {tarefa.responsavel}</span>
                          <span>Prioridade: {tarefa.prioridade}</span>
                          {tarefa.dataLimite && (
                            <span>Previsão: {formatDate(tarefa.dataLimite)}</span>
                          )}
                        </div>

                        <div className="flex items-center space-x-2">
                          {tarefa.status === 'PENDENTE' && (
                            <>
                              <button
                                onClick={() => atualizarTarefa(tarefa.id, 'EM_ANDAMENTO')}
                                className="inline-flex items-center px-3 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100"
                              >
                                Iniciar
                              </button>
                              <button
                                onClick={() => atualizarTarefa(tarefa.id, 'CONCLUIDO')}
                                className="inline-flex items-center px-3 py-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded hover:bg-green-100"
                              >
                                Concluir
                              </button>
                            </>
                          )}
                          {tarefa.status === 'EM_ANDAMENTO' && (
                            <button
                              onClick={() => atualizarTarefa(tarefa.id, 'CONCLUIDO')}
                              className="inline-flex items-center px-3 py-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded hover:bg-green-100"
                            >
                              Concluir
                            </button>
                          )}
                          <button
                            onClick={() => setMostrarObservacoesTarefa(tarefa.id)}
                            className="inline-flex items-center px-3 py-1 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded hover:bg-gray-100"
                          >
                            <ChatBubbleLeftRightIcon className="w-3 h-3 mr-1" />
                            Observações
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    // Modo Tabela
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tarefa</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Responsável</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prioridade</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Previsão</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {currentTarefas.map((tarefa) => (
                            <tr key={tarefa.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div>
                                  <div className="text-sm font-medium text-gray-900">{tarefa.tipo}</div>
                                  <div className="text-sm text-gray-500">{tarefa.descricao}</div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{tarefa.responsavel}</td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center space-x-2">
                                  {getStatusIcon(tarefa.status)}
                                  <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(tarefa.status)}`}>
                                    {tarefa.status.replace('_', ' ')}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{tarefa.prioridade}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {tarefa.dataLimite ? formatDate(tarefa.dataLimite) : '-'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <div className="flex space-x-2">
                                  {tarefa.status === 'PENDENTE' && (
                                    <>
                                      <button
                                        onClick={() => atualizarTarefa(tarefa.id, 'EM_ANDAMENTO')}
                                        className="text-blue-600 hover:text-blue-900 text-xs"
                                      >
                                        Iniciar
                                      </button>
                                      <button
                                        onClick={() => atualizarTarefa(tarefa.id, 'CONCLUIDO')}
                                        className="text-green-600 hover:text-green-900 text-xs"
                                      >
                                        Concluir
                                      </button>
                                    </>
                                  )}
                                  {tarefa.status === 'EM_ANDAMENTO' && (
                                    <button
                                      onClick={() => atualizarTarefa(tarefa.id, 'CONCLUIDO')}
                                      className="text-green-600 hover:text-green-900 text-xs"
                                    >
                                      Concluir
                                    </button>
                                  )}
                                  <button
                                    onClick={() => setMostrarObservacoesTarefa(tarefa.id)}
                                    className="text-gray-600 hover:text-gray-900 text-xs"
                                  >
                                    Obs
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Paginação */}
                {totalPages > 1 && (
                  <div className="mt-6 flex items-center justify-between">
                    <div className="text-sm text-gray-700">
                      Mostrando {indexOfFirstTarefa + 1} a {Math.min(indexOfLastTarefa, tarefasFiltradas.length)} de {tarefasFiltradas.length} tarefas
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setCurrentPage(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="px-3 py-2 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Anterior
                      </button>
                      <span className="px-3 py-2 text-sm text-gray-700">
                        Página {currentPage} de {totalPages}
                      </span>
                      <button
                        onClick={() => setCurrentPage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="px-3 py-2 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Próxima
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Status Geral */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <UserIcon className="w-5 h-5 mr-2" />
                  Status Geral
                </h3>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-2">Status das Tarefas</p>
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(funcionario.statusTarefas)}
                    <span className={`px-3 py-1 text-sm font-medium rounded-full border ${getStatusColor(funcionario.statusTarefas)}`}>
                      {funcionario.statusTarefas.replace('_', ' ')}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-2">Status do Prestserv</p>
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(funcionario.statusPrestserv)}
                    <span className={`px-3 py-1 text-sm font-medium rounded-full border ${getStatusColor(funcionario.statusPrestserv)}`}>
                      {funcionario.statusPrestserv.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Histórico */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Histórico</h3>
              </div>
              <div className="p-6">
                <HistoricoSimplificado funcionarioId={funcionario.id} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Tarefas Padrões */}
      <TarefasPadraoModal
        isOpen={mostrarTarefasPadrao}
        onClose={() => setMostrarTarefasPadrao(false)}
        funcionario={funcionario.funcionario || null}
        onSuccess={() => {
          fetchFuncionario();
          setMostrarTarefasPadrao(false);
        }}
      />
    </div>
  );
}