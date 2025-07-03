'use client';

import { useState, useEffect } from 'react';
import { SolicitacaoRemanejamento, StatusRemanejamento, StatusTarefas, StatusPrestserv } from '@/types/remanejamento-funcionario';
import Link from 'next/link';

interface FiltrosRemanejamento {
  status?: StatusRemanejamento;
  statusTarefas?: StatusTarefas;
  statusPrestserv?: StatusPrestserv;
}

export default function ListaRemanejamentos() {
  const [remanejamentos, setRemanejamentos] = useState<SolicitacaoRemanejamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtros, setFiltros] = useState<FiltrosRemanejamento>({});

  useEffect(() => {
    fetchRemanejamentos();
  }, [filtros]);

  const fetchRemanejamentos = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      if (filtros.status) params.append('status', filtros.status);
      if (filtros.statusTarefas) params.append('statusTarefas', filtros.statusTarefas);
      if (filtros.statusPrestserv) params.append('statusPrestserv', filtros.statusPrestserv);
      
      const response = await fetch(`/api/logistica/remanejamentos?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Erro ao carregar remanejamentos');
      }
      
      const data = await response.json();
      setRemanejamentos(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      'Pendente': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'Em_Analise': 'bg-blue-100 text-blue-800 border-blue-200',
      'Aprovado': 'bg-green-100 text-green-800 border-green-200',
      'Rejeitado': 'bg-red-100 text-red-800 border-red-200',
      'Concluido': 'bg-gray-100 text-gray-800 border-gray-200',
      'PENDENTE': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'CONCLUIDO': 'bg-green-100 text-green-800 border-green-200',
      'PENDENTE': 'bg-gray-100 text-gray-800 border-gray-200',
      'CRIADO': 'bg-blue-100 text-blue-800 border-blue-200',
      'SUBMETIDO': 'bg-purple-100 text-purple-800 border-purple-200',
      'APROVADO': 'bg-green-100 text-green-800 border-green-200',
      'REJEITADO': 'bg-red-100 text-red-800 border-red-200'
    };
    return colors[status] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const clearFiltros = () => {
    setFiltros({});
  };

  const getFuncionariosResumo = (funcionarios: any[]) => {
    const pendentes = funcionarios.filter(f => f.statusTarefas === 'PENDENTE').length;
    const concluidos = funcionarios.filter(f => f.statusTarefas === 'CONCLUIDO').length;
    return { pendentes, concluidos, total: funcionarios.length };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando remanejamentos...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">❌ Erro</div>
          <p className="text-gray-600">{error}</p>
          <button 
            onClick={fetchRemanejamentos}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Remanejamentos</h1>
              <p className="text-gray-600">Gerencie todas as solicitações de remanejamento</p>
            </div>
            <div className="flex space-x-2">
              <Link
                href="/prestserv/remanejamentos/historico"
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                📋 Histórico
              </Link>
              <Link
                href="/logistica/dashboard"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                📊 Dashboard
              </Link>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Filtros</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status da Solicitação
              </label>
              <select
                value={filtros.status || ''}
                onChange={(e) => setFiltros({ ...filtros, status: e.target.value as StatusRemanejamento || undefined })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos</option>
                <option value="Pendente">Pendente</option>
                <option value="Em_Analise">Em Análise</option>
                <option value="Aprovado">Aprovado</option>
                <option value="Rejeitado">Rejeitado</option>
                <option value="Concluido">Concluído</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status das Tarefas
              </label>
              <select
                value={filtros.statusTarefas || ''}
                onChange={(e) => setFiltros({ ...filtros, statusTarefas: e.target.value as StatusTarefas || undefined })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos</option>
                <option value="PENDENTE">Pendente</option>
                <option value="CONCLUIDO">Concluído</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status do Prestserv
              </label>
              <select
                value={filtros.statusPrestserv || ''}
                onChange={(e) => setFiltros({ ...filtros, statusPrestserv: e.target.value as StatusPrestserv || undefined })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos</option>
                <option value="PENDENTE">Pendente</option>
                <option value="CRIADO">Criado</option>
                <option value="SUBMETIDO">Submetido</option>
                <option value="APROVADO">Aprovado</option>
                <option value="REJEITADO">Rejeitado</option>
              </select>
            </div>
          </div>
          
          <div className="mt-4 flex space-x-2">
            <button
              onClick={clearFiltros}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
            >
              Limpar Filtros
            </button>
            <button
              onClick={fetchRemanejamentos}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              🔄 Atualizar
            </button>
          </div>
        </div>

        {/* Lista de Remanejamentos */}
        <div className="space-y-6">
          {remanejamentos.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <div className="text-gray-400 text-6xl mb-4">📋</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum remanejamento encontrado</h3>
              <p className="text-gray-600">Não há remanejamentos que correspondam aos filtros selecionados.</p>
            </div>
          ) : (
            remanejamentos.map((remanejamento) => {
              const resumo = getFuncionariosResumo(remanejamento.funcionarios);
              
              return (
                <div key={remanejamento.id} className="bg-white rounded-lg shadow hover:shadow-md transition-shadow">
                  <div className="p-6">
                    {/* Header do Card */}
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-1">
                          Solicitação #{remanejamento.id}
                        </h3>
                        <p className="text-gray-600">
                          {remanejamento.contratoOrigem?.nome} → {remanejamento.contratoDestino?.nome}
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        <span className={`px-3 py-1 text-sm font-medium rounded-full border ${getStatusColor(remanejamento.status)}`}>
                          🗂️ {remanejamento.status.replace('_', ' ')}
                        </span>
                        {remanejamento.prioridade && (
                          <span className={`px-3 py-1 text-sm font-medium rounded-full border ${
                            remanejamento.prioridade === 'Alta' ? 'bg-red-100 text-red-800 border-red-200' :
                            remanejamento.prioridade === 'Media' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                            'bg-green-100 text-green-800 border-green-200'
                          }`}>
                            {remanejamento.prioridade}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Informações dos Contratos */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-sm text-gray-600 mb-1">📤 Contrato de Origem</p>
                        <p className="font-medium text-gray-900">{remanejamento.contratoOrigem?.nome}</p>
                        <p className="text-sm text-gray-600">Nº {remanejamento.contratoOrigem?.numero}</p>
                        <p className="text-sm text-blue-600">{remanejamento.contratoOrigem?.cliente}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">📥 Contrato de Destino</p>
                        <p className="font-medium text-gray-900">{remanejamento.contratoDestino?.nome}</p>
                        <p className="text-sm text-gray-600">Nº {remanejamento.contratoDestino?.numero}</p>
                        <p className="text-sm text-blue-600">{remanejamento.contratoDestino?.cliente}</p>
                      </div>
                    </div>

                    {/* Informações da Solicitação */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-gray-600">Solicitante</p>
                        <p className="font-medium">{remanejamento.solicitante?.nome}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Data da Solicitação</p>
                        <p className="font-medium">{formatDate(remanejamento.dataSolicitacao)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Funcionários</p>
                        <div>
                          <p className="font-medium mb-1">
                            👥 {resumo.total} funcionário{resumo.total !== 1 ? 's' : ''}
                          </p>
                          <div className="flex items-center space-x-2">
                            <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-xs">
                              <div 
                                className="bg-green-600 h-2 rounded-full transition-all duration-300"
                                style={{
                                  width: `${resumo.total > 0 ? (resumo.concluidos / resumo.total) * 100 : 0}%`
                                }}
                              ></div>
                            </div>
                            <span className="text-sm text-gray-600">
                              {resumo.concluidos}/{resumo.total} prontos
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Justificativa */}
                    {remanejamento.justificativa && (
                      <div className="mb-4">
                        <p className="text-sm text-gray-600 mb-1">Justificativa</p>
                        <p className="text-gray-800 bg-gray-50 p-3 rounded">{remanejamento.justificativa}</p>
                      </div>
                    )}

                    {/* Lista de Funcionários */}
                    <div className="border-t pt-4">
                      <h4 className="font-medium text-gray-900 mb-3">Funcionários</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {remanejamento.funcionarios.map((funcionarioRem) => (
                          <Link
                            key={funcionarioRem.id}
                            href={`/prestserv/funcionario/${funcionarioRem.id}`}
                            className="block p-3 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
                          >
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <p className="font-medium text-gray-900">{funcionarioRem.funcionario.nome}</p>
                                <p className="text-sm text-gray-600">Mat: {funcionarioRem.funcionario.matricula}</p>
                              </div>
                              <div className="flex flex-col space-y-1">
                                <span className={`px-2 py-1 text-xs font-medium rounded border ${getStatusColor(funcionarioRem.statusTarefas)}`}>
                                  📋 {funcionarioRem.statusTarefas}
                                </span>
                                <span className={`px-2 py-1 text-xs font-medium rounded border ${getStatusColor(funcionarioRem.statusPrestserv)}`}>
                                  📄 {funcionarioRem.statusPrestserv.replace('_', ' ')}
                                </span>
                              </div>
                            </div>
                            {funcionarioRem.funcionario.funcao && (
                              <p className="text-xs text-gray-500">{funcionarioRem.funcionario.funcao}</p>
                            )}
                          </Link>
                        ))}
                      </div>
                    </div>

                    {/* Data de Conclusão */}
                    {remanejamento.dataConclusao && (
                      <div className="border-t pt-4 mt-4">
                        <p className="text-sm text-gray-600">
                          Concluído em: <span className="font-medium">{formatDate(remanejamento.dataConclusao)}</span>
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Estatísticas no Rodapé */}
        {remanejamentos.length > 0 && (
          <div className="mt-8 bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Resumo</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-blue-600">{remanejamentos.length}</p>
                <p className="text-sm text-gray-600">Total de Solicitações</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-600">
                  {remanejamentos.reduce((acc, r) => acc + r.funcionarios.filter(f => f.statusTarefas === 'PENDENTE').length, 0)}
                </p>
                <p className="text-sm text-gray-600">Funcionários Pendentes</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">
                  {remanejamentos.reduce((acc, r) => acc + r.funcionarios.filter(f => f.statusTarefas === 'CONCLUIDO').length, 0)}
                </p>
                <p className="text-sm text-gray-600">Funcionários Prontos</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-600">
                  {remanejamentos.reduce((acc, r) => acc + r.funcionarios.length, 0)}
                </p>
                <p className="text-sm text-gray-600">Total de Funcionários</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}