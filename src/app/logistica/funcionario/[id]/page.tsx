'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeftIcon, UserIcon, ClockIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import HistoricoRemanejamento from '@/components/HistoricoRemanejamento';
import ProtectedRoute from '@/components/ProtectedRoute';

interface Funcionario {
  id: string;
  matricula: string;
  nome: string;
  funcao: string;
  cpf: string;
  rg: string;
  orgaoEmissor: string;
  uf: string;
  dataNascimento: string;
  email: string;
  telefone: string;
  centroCusto: string;
  departamento: string;
  status: string;
  contrato: {
    id: string;
    numero: string;
    nome: string;
  };
}

interface Tarefa {
  id: number;
  tipo: string;
  responsavel: string;
  prioridade: 'Baixa' | 'Media' | 'Alta';
  status: 'PENDENTE' | 'EM_ANDAMENTO' | 'CONCLUIDA';
  dataLimite?: string;
  dataCriacao: string;
  descricao: string;
}

interface RemanejamentoFuncionario {
  id: string;
  statusTarefas: string;
  statusPrestserv: string;
  dataRascunhoCriado: string;
  dataSubmetido: string;
  dataResposta: string;
  observacoesPrestserv: string;
  tarefas?: Tarefa[];
  solicitacao: {
    id: string;
    solicitante: string;
    dataRequisicao: string;
    status: string;
    prioridade: string;
    justificativa: string;
  };
}

export default function FuncionarioDetalhes() {
  return (
    <ProtectedRoute 
      requiredEquipe={['LOGISTICA', 'Administração']}
      requiredPermissions={['admin', 'canAccessLogistica']}
    >
      <FuncionarioDetalhesContent />
    </ProtectedRoute>
  );
}

function FuncionarioDetalhesContent() {
  const params = useParams();
  const router = useRouter();
  const funcionarioId = params.id as string;
  
  const [funcionario, setFuncionario] = useState<Funcionario | null>(null);
  const [remanejamento, setRemanejamento] = useState<RemanejamentoFuncionario | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [atualizandoStatus, setAtualizandoStatus] = useState(false);

  useEffect(() => {
    const fetchFuncionario = async () => {
      try {
        const response = await fetch(`/api/logistica/funcionario/${funcionarioId}`);
        if (!response.ok) {
          throw new Error('Funcionário não encontrado');
        }
        const data = await response.json();
        // The API returns a remanejamentoFuncionario object directly
        setRemanejamento(data);
        // Extract funcionario data from the remanejamento object
        if (data.funcionario) {
          setFuncionario({
            ...data.funcionario,
            // Add missing fields with default values
            cpf: data.funcionario.cpf || '',
            rg: data.funcionario.rg || '',
            orgaoEmissor: data.funcionario.orgaoEmissor || '',
            uf: data.funcionario.uf || '',
            dataNascimento: data.funcionario.dataNascimento || '',
            departamento: data.funcionario.departamento || '',
            status: data.funcionario.status || '',
            contrato: data.solicitacao?.contratoOrigem || {
              id: '',
              numero: 'N/A',
              nome: 'Não informado'
            }
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar funcionário');
      } finally {
        setLoading(false);
      }
    };

    if (funcionarioId) {
      fetchFuncionario();
    }
  }, [funcionarioId]);



  const atualizarStatusPrestserv = async (novoStatus: string) => {
    if (!remanejamento) return;

    setAtualizandoStatus(true);
    try {
      const response = await fetch(`/api/logistica/funcionario/${remanejamento.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          statusPrestserv: novoStatus
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao atualizar status');
      }

      // Recarregar dados
      window.location.reload();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      alert(error instanceof Error ? error.message : 'Erro ao atualizar status');
    } finally {
      setAtualizandoStatus(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const formatDateTime = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('pt-BR');
  };



  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'CONCLUIDO':
      case 'APROVADO':
        return 'text-green-600 bg-green-100';
      case 'PENDENTE':
      case 'EM_ANALISE':
        return 'text-yellow-600 bg-yellow-100';
      case 'REJEITADO':
      case 'CANCELADO':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toUpperCase()) {
      case 'CONCLUIDO':
      case 'APROVADO':
        return <CheckCircleIcon className="h-4 w-4" />;
      case 'PENDENTE':
      case 'EM_ANALISE':
        return <ClockIcon className="h-4 w-4" />;
      case 'REJEITADO':
      case 'CANCELADO':
        return <XCircleIcon className="h-4 w-4" />;
      default:
        return <ClockIcon className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando detalhes do funcionário...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <XCircleIcon className="h-12 w-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Erro ao carregar</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => router.back()}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Voltar
          </button>
        </div>
      </div>
    );
  }

  if (!funcionario) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <UserIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Funcionário não encontrado</h2>
          <p className="text-gray-600 mb-4">O funcionário solicitado não foi encontrado.</p>
          <button
            onClick={() => router.back()}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Voltar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.back()}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                <ArrowLeftIcon className="h-4 w-4 mr-2" />
                Voltar
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Detalhes do Funcionário</h1>
                <p className="text-sm text-gray-600">Informações completas e status do remanejamento</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Informações do Funcionário */}
          <div className="lg:col-span-2">
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900 flex items-center">
                  <UserIcon className="h-5 w-5 mr-2 text-blue-600" />
                  Informações Pessoais
                </h3>
              </div>
              <div className="px-6 py-4">
                <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Nome</dt>
                    <dd className="mt-1 text-sm text-gray-900">{funcionario.nome}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Matrícula</dt>
                    <dd className="mt-1 text-sm text-gray-900">{funcionario.matricula}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Função</dt>
                    <dd className="mt-1 text-sm text-gray-900">{funcionario.funcao}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">CPF</dt>
                    <dd className="mt-1 text-sm text-gray-900">{funcionario.cpf}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">RG</dt>
                    <dd className="mt-1 text-sm text-gray-900">{funcionario.rg}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Órgão Emissor</dt>
                    <dd className="mt-1 text-sm text-gray-900">{funcionario.orgaoEmissor} - {funcionario.uf}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Data de Nascimento</dt>
                    <dd className="mt-1 text-sm text-gray-900">{formatDate(funcionario.dataNascimento)}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Email</dt>
                    <dd className="mt-1 text-sm text-gray-900">{funcionario.email}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Telefone</dt>
                    <dd className="mt-1 text-sm text-gray-900">{funcionario.telefone}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Centro de Custo</dt>
                    <dd className="mt-1 text-sm text-gray-900">{funcionario.centroCusto}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Departamento</dt>
                    <dd className="mt-1 text-sm text-gray-900">{funcionario.departamento}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Contrato</dt>
                    <dd className="mt-1 text-sm text-gray-900">{funcionario.contrato?.numero || 'N/A'} - {funcionario.contrato?.nome || 'Não informado'}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>

          {/* Status do Remanejamento */}
          <div className="lg:col-span-1">
            {remanejamento && (
              <div className="bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Status do Remanejamento</h3>
                </div>
                <div className="px-6 py-4 space-y-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500 mb-2">Status das Tarefas</dt>
                    <dd className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(remanejamento.statusTarefas)}`}>
                      {getStatusIcon(remanejamento.statusTarefas)}
                      <span className="ml-1">{remanejamento.statusTarefas}</span>
                    </dd>
                  </div>
                  
                  <div>
                    <dt className="text-sm font-medium text-gray-500 mb-2">Status Prestserv</dt>
                    <dd className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(remanejamento.statusPrestserv)}`}>
                      {getStatusIcon(remanejamento.statusPrestserv)}
                      <span className="ml-1">{remanejamento.statusPrestserv}</span>
                    </dd>
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">Datas Importantes</h4>
                    <div className="space-y-2">
                      <div>
                        <dt className="text-xs text-gray-500">Rascunho Criado</dt>
                        <dd className="text-sm text-gray-900">{formatDate(remanejamento.dataRascunhoCriado)}</dd>
                      </div>
                      {remanejamento.dataSubmetido && (
                        <div>
                          <dt className="text-xs text-gray-500">Data Submetido</dt>
                          <dd className="text-sm text-gray-900">{formatDate(remanejamento.dataSubmetido)}</dd>
                        </div>
                      )}
                      {remanejamento.dataResposta && (
                        <div>
                          <dt className="text-xs text-gray-500">Data Resposta</dt>
                          <dd className="text-sm text-gray-900">{formatDate(remanejamento.dataResposta)}</dd>
                        </div>
                      )}
                    </div>
                  </div>

                  {remanejamento.observacoesPrestserv && (
                    <div className="border-t pt-4">
                      <dt className="text-sm font-medium text-gray-500 mb-2">Observações Prestserv</dt>
                      <dd className="text-sm text-gray-900 bg-gray-50 p-3 rounded">{remanejamento.observacoesPrestserv}</dd>
                    </div>
                  )}

                  {remanejamento.solicitacao && (
                    <div className="border-t pt-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-3">Solicitação</h4>
                      <div className="space-y-2">
                        <div>
                          <dt className="text-xs text-gray-500">Solicitante</dt>
                          <dd className="text-sm text-gray-900">{remanejamento.solicitacao.solicitante}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-gray-500">Data Requisição</dt>
                          <dd className="text-sm text-gray-900">{formatDate(remanejamento.solicitacao.dataRequisicao)}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-gray-500">Prioridade</dt>
                          <dd className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                            remanejamento.solicitacao.prioridade === 'ALTA' ? 'bg-red-100 text-red-800' :
                            remanejamento.solicitacao.prioridade === 'MEDIA' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {remanejamento.solicitacao.prioridade}
                          </dd>
                        </div>
                        {remanejamento.solicitacao.justificativa && (
                          <div>
                            <dt className="text-xs text-gray-500">Justificativa</dt>
                            <dd className="text-sm text-gray-900 bg-gray-50 p-3 rounded mt-1">{remanejamento.solicitacao.justificativa}</dd>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Seção de Tarefas */}
        {remanejamento && (
          <div className="mt-8">
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">Tarefas de Remanejamento</h3>
                    <p className="text-sm text-gray-600">Total: {remanejamento.tarefas?.length || 0} tarefas</p>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => window.location.href = `/logistica/funcionario/${funcionarioId}/tarefas`}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                      📋 Gerenciar Tarefas
                    </button>
                  </div>
                </div>
              </div>

              {/* Resumo das Tarefas */}
              <div className="p-6">
                {!remanejamento.tarefas || remanejamento.tarefas.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-gray-400 mb-2">📋</div>
                    <p className="text-gray-500">Nenhuma tarefa cadastrada</p>
                    <p className="text-sm text-gray-400 mt-1">Clique em "Gerenciar Tarefas" para começar</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="text-red-600 font-semibold text-lg">
                        {remanejamento.tarefas.filter(t => t.status === 'PENDENTE').length}
                      </div>
                      <div className="text-red-700 text-sm">Pendentes</div>
                    </div>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <div className="text-yellow-600 font-semibold text-lg">
                        {remanejamento.tarefas.filter(t => t.status === 'EM_ANDAMENTO').length}
                      </div>
                      <div className="text-yellow-700 text-sm">Em Andamento</div>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="text-green-600 font-semibold text-lg">
                        {remanejamento.tarefas.filter(t => t.status === 'CONCLUIDA').length}
                      </div>
                      <div className="text-green-700 text-sm">Concluídas</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Seção de Prestserv */}
        {remanejamento && (
          <div className="mt-8">
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Prestserv</h3>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500 mb-2">Status Prestserv</dt>
                    <dd className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(remanejamento.statusPrestserv)}`}>
                      {getStatusIcon(remanejamento.statusPrestserv)}
                      <span className="ml-1">{remanejamento.statusPrestserv}</span>
                    </dd>
                  </div>

                  {remanejamento.statusTarefas === 'PENDENTE' && (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                      <p className="text-sm text-yellow-800">
                        ⚠️ Aguardando conclusão das tarefas
                      </p>
                    </div>
                  )}

                  {remanejamento.statusTarefas === 'CONCLUIDO' && remanejamento.statusPrestserv === 'PENDENTE' && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded">
                      <p className="text-sm text-green-800">
                        ✅ Funcionário apto para criação do Prestserv
                      </p>
                    </div>
                  )}

                  {/* Controle do Status Prestserv */}
                  <div className="space-y-3">
                    <div>
                      <label htmlFor="statusPrestserv" className="block text-sm font-medium text-gray-700 mb-2">
                        Alterar Status do Prestserv
                      </label>
                      <select
                         id="statusPrestserv"
                         value={remanejamento.statusPrestserv}
                         onChange={(e) => atualizarStatusPrestserv(e.target.value)}
                         disabled={atualizandoStatus}
                         className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:bg-gray-100"
                       >
                         <option value="PENDENTE">📋 Pendente</option>
                         <option value="RASCUNHO_CRIADO">📝 Criado</option>
                         <option value="SUBMETIDO">📤 Submetido</option>
                         <option value="APROVADO">✅ Aprovado</option>
                         <option value="REJEITADO">❌ Rejeitado</option>
                       </select>
                    </div>
                    
                    {atualizandoStatus && (
                      <div className="w-full px-3 py-2 bg-blue-50 text-blue-700 rounded border border-blue-200 text-sm text-center">
                        🔄 Atualizando status...
                      </div>
                    )}
                    
                    {remanejamento.statusTarefas === 'PENDENTE' && remanejamento.statusPrestserv !== 'PENDENTE' && (
                      <div className="w-full px-3 py-2 bg-yellow-50 text-yellow-700 rounded border border-yellow-200 text-sm">
                        ⚠️ Aguardando conclusão das tarefas para liberar o Prestserv
                      </div>
                    )}
                    
                    {remanejamento.statusPrestserv === 'REJEITADO' && (
                       <div className="w-full px-3 py-2 bg-red-50 text-red-700 rounded border border-red-200 text-sm">
                         <div className="font-medium mb-1">⚠️ Prestserv Rejeitado</div>
                         <div>Crie tarefas específicas para tratar as pendências informadas na rejeição antes de alterar o status.</div>
                         {remanejamento.observacoesPrestserv && (
                           <div className="mt-2 p-2 bg-red-100 rounded text-xs">
                             <strong>Motivo da rejeição:</strong> {remanejamento.observacoesPrestserv}
                           </div>
                         )}
                       </div>
                     )}
                    
                    {remanejamento.statusPrestserv === 'APROVADO' && (
                      <div className="w-full px-3 py-2 bg-green-50 text-green-700 rounded border border-green-200 text-sm">
                        ✅ Prestserv aprovado com sucesso!
                      </div>
                    )}
                  </div>

                  {/* Histórico de Datas */}
                  <div className="mt-6 pt-4 border-t border-gray-200">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">Histórico</h4>
                    <div className="space-y-2 text-sm">
                      {remanejamento.dataRascunhoCriado && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">📝 Rascunho Criado:</span>
                          <span className="font-medium">{formatDateTime(remanejamento.dataRascunhoCriado)}</span>
                        </div>
                      )}
                      {remanejamento.dataSubmetido && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">📤 Submetido:</span>
                          <span className="font-medium">{formatDateTime(remanejamento.dataSubmetido)}</span>
                        </div>
                      )}
                      {remanejamento.dataResposta && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">📋 Resposta:</span>
                          <span className="font-medium">{formatDateTime(remanejamento.dataResposta)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Seção de Histórico Detalhado */}
        {remanejamento && (
          <div className="mt-8">
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Histórico Detalhado</h3>
                <p className="text-sm text-gray-600">Todas as ações realizadas neste funcionário</p>
              </div>
              <div className="p-6">
                <HistoricoRemanejamento 
                  remanejamentoFuncionarioId={remanejamento.id}
                  showFilters={false}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}