'use client';

import { useState, useEffect } from 'react';
import { DashboardRemanejamento, StatusTarefa, StatusPrestserv } from '@/types/remanejamento-funcionario';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
);

interface FuncionarioAtencao {
  id: string;
  statusTarefas: StatusTarefa;
  statusPrestserv: StatusPrestserv;
  funcionario: {
    id: number;
    nome: string;
    matricula: string;
    funcao: string | null;
  };
  solicitacao: {
    id: number;
    centroCustoOrigem: string;
    centroCustoDestino: string;
    dataSolicitacao: string;
  };
  tarefas: {
    id: string;
    tipo: string;
    responsavel: string;
    status: string;
    dataLimite: string | null;
  }[];
}

interface TarefaEmAtraso {
  id: string;
  tipo: string;
  responsavel: string;
  status: string;
  dataLimite: string | null;
  remanejamentoFuncionario: {
    funcionario: {
      id: number;
      nome: string;
      matricula: string;
    };
  };
}

interface DashboardData extends DashboardRemanejamento {
  funcionariosAtencao: FuncionarioAtencao[];
  tarefasEmAtraso: TarefaEmAtraso[];
}

export default function DashboardPrestserv() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/prestserv/dashboard');
      
      if (!response.ok) {
        throw new Error('Erro ao carregar dados do dashboard');
      }
      
      const data = await response.json();
      setDashboardData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      'PENDENTE': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'CONCLUIDO': 'bg-green-100 text-green-800 border-green-200',
      'CRIADO': 'bg-blue-100 text-blue-800 border-blue-200',
      'SUBMETIDO': 'bg-purple-100 text-purple-800 border-purple-200',
      'APROVADO': 'bg-green-100 text-green-800 border-green-200',
      'REJEITADO': 'bg-red-100 text-red-800 border-red-200',
      'EM_ANDAMENTO': 'bg-orange-100 text-orange-800 border-orange-200'
    };
    return colors[status] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const isTaskOverdue = (dataLimite: string | null) => {
    if (!dataLimite) return false;
    return new Date(dataLimite) < new Date();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando dashboard...</p>
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
            onClick={fetchDashboardData}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return <div>Nenhum dado encontrado</div>;
  }

  // Fallbacks robustos: garantir que os dados de status sejam arrays
  const funcionariosPorStatusTarefaArr: { status: string; count: number }[] = Array.isArray((dashboardData as any).funcionariosPorStatusTarefa)
    ? (dashboardData as any).funcionariosPorStatusTarefa
    : Object.entries(((dashboardData as any).funcionariosPorStatusTarefa || {})).map(([status, count]) => ({
        status,
        count: typeof count === 'number' ? count : Number(count) || 0,
      }));

  const funcionariosPorStatusPrestservArr: { status: string; count: number }[] = Array.isArray((dashboardData as any).funcionariosPorStatusPrestserv)
    ? (dashboardData as any).funcionariosPorStatusPrestserv
    : Object.entries(((dashboardData as any).funcionariosPorStatusPrestserv || {})).map(([status, count]) => ({
        status,
        count: typeof count === 'number' ? count : Number(count) || 0,
      }));

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard do Prestserv</h1>
          <p className="text-gray-600">Controle e monitoramento de remanejamentos</p>
        </div>

        {/* Cards de Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl shadow-lg p-6 border border-blue-200 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600 mb-1">Total de Solicitações</p>
                <p className="text-3xl font-bold text-blue-900">{dashboardData.totalSolicitacoes}</p>
                <p className="text-xs text-blue-500 mt-1">📊 Todas as solicitações</p>
              </div>
              <div className="p-3 bg-blue-500 rounded-full">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl shadow-lg p-6 border border-yellow-200 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-yellow-600 mb-1">Funcionários Pendentes</p>
                <p className="text-3xl font-bold text-yellow-900">{dashboardData.funcionariosPendentes}</p>
                <p className="text-xs text-yellow-500 mt-1">⏳ Aguardando processamento</p>
              </div>
              <div className="p-3 bg-yellow-500 rounded-full">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-lg p-6 border border-green-200 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600 mb-1">Funcionários Aptos</p>
                <p className="text-3xl font-bold text-green-900">{dashboardData.funcionariosAptos}</p>
                <p className="text-xs text-green-500 mt-1">✅ Prontos para trabalhar</p>
              </div>
              <div className="p-3 bg-green-500 rounded-full">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          {/* <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl shadow-lg p-6 border border-red-200 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-600 mb-1">Funcionários Rejeitados</p>
                <p className="text-3xl font-bold text-red-900">{dashboardData.funcionariosRejeitados}</p>
                <p className="text-xs text-red-500 mt-1">❌ Necessitam revisão</p>
              </div>
              <div className="p-3 bg-red-500 rounded-full">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
            </div>
          </div> */}
        </div>

        {/* Seções Principais */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1 min-h-0 overflow-y-auto">
          {/* Funcionários que Precisam de Atenção */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Funcionários que Precisam de Atenção</h2>
              <p className="text-sm text-gray-600 mt-1">Funcionários prontos para submissão ou rejeitados</p>
            </div>
            <div className="p-6">
              {dashboardData.funcionariosAtencao.length === 0 ? (
                <p className="text-gray-500 text-center py-4">Nenhum funcionário precisa de atenção no momento</p>
              ) : (
                <div className="space-y-4">
                  {dashboardData.funcionariosAtencao.map((funcionario) => (
                    <div key={funcionario.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-medium text-gray-900">{funcionario.funcionario.nome}</h3>
                          <p className="text-sm text-gray-600">Matrícula: {funcionario.funcionario.matricula}</p>
                        </div>
                        <div className="flex space-x-2">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(funcionario.statusTarefas)}`}>
                            {funcionario.statusTarefas}
                          </span>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(funcionario.statusPrestserv)}`}>
                            {funcionario.statusPrestserv}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600">
                        {funcionario.solicitacao.centroCustoOrigem} → {funcionario.solicitacao.centroCustoDestino}
                      </p>
                      {funcionario.tarefas.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs text-gray-500">Tarefas pendentes: {funcionario.tarefas.length}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Tarefas em Atraso */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Tarefas em Atraso</h2>
              <p className="text-sm text-gray-600 mt-1">Tarefas que passaram do prazo limite</p>
            </div>
            <div className="p-6">
              {dashboardData.tarefasEmAtraso.length === 0 ? (
                <p className="text-gray-500 text-center py-4">Nenhuma tarefa em atraso</p>
              ) : (
                <div className="space-y-4">
                  {dashboardData.tarefasEmAtraso.map((tarefa) => (
                    <div key={tarefa.id} className="border border-red-200 rounded-lg p-4 bg-red-50">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-medium text-gray-900">{tarefa.tipo}</h3>
                          <p className="text-sm text-gray-600">
                            {tarefa.remanejamentoFuncionario.funcionario.nome} - {tarefa.remanejamentoFuncionario.funcionario.matricula}
                          </p>
                        </div>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(tarefa.status)}`}>
                          📋 {tarefa.status}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <p className="text-sm text-gray-600">Responsável: {tarefa.responsavel}</p>
                        {tarefa.dataLimite && (
                          <p className="text-sm text-red-600 font-medium">
                            Venceu em: {formatDate(tarefa.dataLimite)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Gráficos e Estatísticas */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
          {/* Gráfico de Status das Tarefas */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-800">📋 Status das Tarefas</h2>
                <div className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                  {funcionariosPorStatusTarefaArr.reduce((acc, item) => acc + item.count, 0)} total
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="h-72">
                <Doughnut
                  data={{
                    labels: funcionariosPorStatusTarefaArr.map(item => item.status),
                    datasets: [{
                      data: funcionariosPorStatusTarefaArr.map(item => item.count),
                      backgroundColor: [
                        '#3B82F6', // blue
                        '#10B981', // green
                        '#F59E0B', // yellow
                        '#EF4444', // red
                        '#8B5CF6', // purple
                      ],
                      borderWidth: 3,
                      borderColor: '#ffffff',
                      hoverBorderWidth: 4,
                      hoverBackgroundColor: [
                        '#2563EB',
                        '#059669',
                        '#D97706',
                        '#DC2626',
                        '#7C3AED',
                      ],
                    }]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'bottom',
                        labels: {
                          padding: 20,
                          usePointStyle: true,
                          font: {
                            size: 12,
                            weight: 'bold'
                          }
                        }
                      },
                      tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: '#ffffff',
                        borderWidth: 1,
                        callbacks: {
                          label: function(context) {
                            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                            const percentage = ((context.parsed / total) * 100).toFixed(1);
                            return `${context.label}: ${context.parsed} (${percentage}%)`;
                          }
                        }
                      }
                    },
                    animation: {
                      animateRotate: true,
                      duration: 2000
                    }
                  }}
                />
              </div>
            </div>
          </div>

          {/* Gráfico de Status do Prestserv */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-800">👥 Status do Prestserv</h2>
                <div className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                  {funcionariosPorStatusPrestservArr.reduce((acc, item) => acc + item.count, 0)} funcionários
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="h-72">
                <Bar
                  data={{
                    labels: funcionariosPorStatusPrestservArr.map(item => item.status.replace('_', ' ')),
                    datasets: [{
                      label: 'Funcionários',
                      data: funcionariosPorStatusPrestservArr.map(item => item.count),
                      backgroundColor: [
                        'rgba(59, 130, 246, 0.8)',
                        'rgba(16, 185, 129, 0.8)',
                        'rgba(245, 158, 11, 0.8)',
                        'rgba(239, 68, 68, 0.8)',
                        'rgba(139, 92, 246, 0.8)',
                      ],
                      borderColor: [
                        '#3B82F6',
                        '#10B981',
                        '#F59E0B',
                        '#EF4444',
                        '#8B5CF6',
                      ],
                      borderWidth: 2,
                      borderRadius: 8,
                      borderSkipped: false,
                      hoverBackgroundColor: [
                        '#3B82F6',
                        '#10B981',
                        '#F59E0B',
                        '#EF4444',
                        '#8B5CF6',
                      ],
                    }]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        display: false,
                      },
                      tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: '#ffffff',
                        borderWidth: 1
                      }
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                        ticks: {
                          stepSize: 1,
                          font: {
                            weight: 'bold'
                          }
                        },
                        grid: {
                          color: 'rgba(0, 0, 0, 0.1)'
                        }
                      },
                      x: {
                        ticks: {
                          font: {
                            weight: 'bold'
                          }
                        },
                        grid: {
                          display: false
                        }
                      }
                    },
                    animation: {
                      duration: 2000,
                      easing: 'easeInOutQuart'
                    }
                  }}
                />
              </div>
            </div>
          </div>

          {/* Gráfico de Resumo Geral */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-800">📊 Resumo Geral</h2>
                <div className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
                  Dashboard
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="h-72">
                <Bar
                  data={{
                    labels: ['📋 Total', '⏳ Pendentes', '✅ Aptos', '❌ Rejeitados'],
                    datasets: [{
                      label: 'Funcionários',
                      data: [
                        dashboardData.totalSolicitacoes,
                        dashboardData.funcionariosPendentes,
                        dashboardData.funcionariosAptos,
                        dashboardData.funcionariosRejeitados
                      ],
                      backgroundColor: [
                        'rgba(107, 114, 128, 0.8)', // gray
                        'rgba(245, 158, 11, 0.8)', // yellow
                        'rgba(16, 185, 129, 0.8)', // green
                        'rgba(239, 68, 68, 0.8)', // red
                      ],
                      borderColor: [
                        '#6B7280',
                        '#F59E0B',
                        '#10B981',
                        '#EF4444',
                      ],
                      borderWidth: 2,
                      borderRadius: 8,
                      borderSkipped: false,
                      hoverBackgroundColor: [
                        '#6B7280',
                        '#F59E0B',
                        '#10B981',
                        '#EF4444',
                      ],
                    }]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        display: false,
                      },
                      tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: '#ffffff',
                        borderWidth: 1
                      }
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                        ticks: {
                          stepSize: 1,
                          font: {
                            weight: 'bold'
                          }
                        },
                        grid: {
                          color: 'rgba(0, 0, 0, 0.1)'
                        }
                      },
                      x: {
                        ticks: {
                          font: {
                            weight: 'bold'
                          }
                        },
                        grid: {
                          display: false
                        }
                      }
                    },
                    animation: {
                      duration: 2000,
                      easing: 'easeInOutQuart'
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* SLAs (Horas) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
          {/* Card: Tempo médio da solicitação (h) */}
          <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl shadow-lg p-6 border border-indigo-200 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-indigo-600 mb-1">Tempo médio da solicitação</p>
                <p className="text-3xl font-bold text-indigo-900">
                  {typeof dashboardData.slaTempoMedioSolicitacaoHoras === 'number'
                    ? dashboardData.slaTempoMedioSolicitacaoHoras.toFixed(1)
                    : '—'}
                </p>
                <p className="text-xs text-indigo-500 mt-1">⏱ Horas corridas (criação → conclusão)</p>
              </div>
              <div className="p-3 bg-indigo-500 rounded-full">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Card: Tempo médio de aprovação (h) */}
          <div className="bg-gradient-to-br from-pink-50 to-pink-100 rounded-xl shadow-lg p-6 border border-pink-200 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-pink-600 mb-1">Tempo médio de aprovação (Prestserv)</p>
                <p className="text-3xl font-bold text-pink-900">
                  {typeof dashboardData.slaLogisticaTempoMedioAprovacaoHoras === 'number'
                    ? dashboardData.slaLogisticaTempoMedioAprovacaoHoras.toFixed(1)
                    : '—'}
                </p>
                <p className="text-xs text-pink-500 mt-1">🧾 Horas corridas (submetido → resposta)</p>
              </div>
              <div className="p-3 bg-pink-500 rounded-full">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Gráfico: Tempo médio por setor (h) */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-800">⏳ Tempo médio por setor (h)</h2>
              <div className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm font-medium">SLA</div>
            </div>
            <div className="p-6">
              <div className="h-72">
                {dashboardData.slaTempoMedioPorSetorHoras && Object.keys(dashboardData.slaTempoMedioPorSetorHoras).length > 0 ? (
                  <Bar
                    data={{
                      labels: Object.keys(dashboardData.slaTempoMedioPorSetorHoras).map((setor) =>
                        setor === 'LOGISTICA' ? 'Logística' : setor
                      ),
                      datasets: [
                        {
                          label: 'Horas',
                          data: Object.keys(dashboardData.slaTempoMedioPorSetorHoras).map(
                            (setor) => dashboardData.slaTempoMedioPorSetorHoras![setor] ?? 0
                          ),
                          backgroundColor: 'rgba(59, 130, 246, 0.8)',
                          borderColor: '#3B82F6',
                          borderWidth: 2,
                          borderRadius: 8,
                          borderSkipped: false,
                          hoverBackgroundColor: '#3B82F6',
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { display: false },
                        tooltip: {
                          backgroundColor: 'rgba(0, 0, 0, 0.8)',
                          titleColor: '#ffffff',
                          bodyColor: '#ffffff',
                          borderColor: '#ffffff',
                          borderWidth: 1,
                        },
                      },
                      scales: {
                        y: {
                          beginAtZero: true,
                          ticks: { font: { weight: 'bold' } },
                          grid: { color: 'rgba(0, 0, 0, 0.1)' },
                        },
                        x: {
                          ticks: { font: { weight: 'bold' } },
                          grid: { display: false },
                        },
                      },
                      animation: { duration: 2000, easing: 'easeInOutQuart' },
                    }}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-gray-500">Nenhum dado de SLA por setor disponível</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Correções por Tipo (Reprovações) */}
        <div className="mt-8">
          <div className="bg-white rounded-xl shadow-lg border border-gray-100">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-800">🛠️ Correções por Tipo</h2>
              <div className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm font-medium">SLA simples</div>
            </div>
            <div className="p-6">
              <div className="h-72">
                {dashboardData.volumetriaCorrecoesPorTipo && Object.keys(dashboardData.volumetriaCorrecoesPorTipo).length > 0 ? (
                  <Bar
                    data={{
                      labels: Object.keys(dashboardData.volumetriaCorrecoesPorTipo),
                      datasets: [
                        {
                          label: 'Total de reprovações',
                          data: Object.values(dashboardData.volumetriaCorrecoesPorTipo),
                          backgroundColor: 'rgba(234, 179, 8, 0.8)',
                          borderColor: '#EAB308',
                          borderWidth: 2,
                          borderRadius: 8,
                          borderSkipped: false,
                          hoverBackgroundColor: '#EAB308',
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { display: false },
                        tooltip: {
                          backgroundColor: 'rgba(0, 0, 0, 0.8)',
                          titleColor: '#ffffff',
                          bodyColor: '#ffffff',
                          borderColor: '#ffffff',
                          borderWidth: 1,
                        },
                      },
                      scales: {
                        y: {
                          beginAtZero: true,
                          ticks: { font: { weight: 'bold' } },
                          grid: { color: 'rgba(0, 0, 0, 0.1)' },
                        },
                        x: {
                          ticks: { font: { weight: 'bold' } },
                          grid: { display: false },
                        },
                      },
                      animation: { duration: 2000, easing: 'easeInOutQuart' },
                    }}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-gray-500">Nenhum dado de correções disponível</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Botão de Atualização */}
        <div className="mt-8 text-center">
          <button
            onClick={fetchDashboardData}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            🔄 Atualizar Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}