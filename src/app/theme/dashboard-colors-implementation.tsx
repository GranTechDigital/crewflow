// Exemplo de implementação da paleta de cores no dashboard

import React from 'react';
import { colors } from './colors';
import { Bar, Doughnut, Line } from 'react-chartjs-2';

// Este é um componente de exemplo que demonstra como aplicar a paleta de cores
// ao dashboard de funcionários

export const DashboardExample = ({ dashboardData }: { dashboardData: any }) => {
  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Cards de Resumo com a nova paleta de cores */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6 border border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">Total de Solicitações</p>
              <p className="text-3xl font-bold text-slate-800">{dashboardData.totalSolicitacoes}</p>
            </div>
            <div className="p-2 bg-sky-100 rounded-md">
              <svg className="w-6 h-6 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6 border border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">Total de Funcionários</p>
              <p className="text-3xl font-bold text-slate-800">{dashboardData.totalFuncionarios}</p>
            </div>
            <div className="p-2 bg-purple-100 rounded-md">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">Funcionários Pendentes</p>
              <p className="text-3xl font-bold text-slate-800">{dashboardData.funcionariosPendentes}</p>
            </div>
            <div className="p-2 bg-slate-100 rounded-md">
              <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">Funcionários Aptos</p>
              <p className="text-3xl font-bold text-slate-800">{dashboardData.funcionariosAptos}</p>
            </div>
            <div className="p-2 bg-sky-100 rounded-md">
              <svg className="w-6 h-6 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Filtros Aplicados */}
      <div className="bg-white rounded-lg shadow border border-slate-100 p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-slate-700">Filtros Aplicados</h2>
          <div className="text-sm text-slate-500">
            Os dados abaixo refletem os filtros selecionados
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {/* Exemplo de tags de filtro */}
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
            Contrato: ABC123
          </span>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
            Status: Pendente
          </span>
        </div>
      </div>
      
      {/* Exemplo de gráfico com a nova paleta de cores */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Gráfico de Status das Tarefas */}
        <div className="bg-white rounded-lg shadow border border-slate-100">
          <div className="p-5 border-b border-slate-100">
            <h2 className="text-lg font-medium text-slate-700">Status das Tarefas</h2>
          </div>
          <div className="p-6">
            <div className="h-80">
              {dashboardData.funcionariosPorStatusTarefa && 
               Object.keys(dashboardData.funcionariosPorStatusTarefa).length > 0 ? (
                <Doughnut
                  data={{
                    labels: Object.keys(dashboardData.funcionariosPorStatusTarefa),
                    datasets: [{
                      data: Object.values(dashboardData.funcionariosPorStatusTarefa),
                      backgroundColor: [
                        '#94A3B8', // slate-400
                        '#0EA5E9', // sky-500
                        '#64748B', // slate-500
                        '#475569', // slate-600
                        '#0284C7', // sky-600
                      ],
                      borderWidth: 1,
                      borderColor: '#ffffff',
                      hoverBorderWidth: 2,
                      hoverBackgroundColor: [
                        '#64748B', // slate-500
                        '#0284C7', // sky-600
                        '#475569', // slate-600
                        '#334155', // slate-700
                        '#0369A1', // sky-700
                      ],
                    }]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '65%',
                    plugins: {
                      legend: {
                        position: 'bottom',
                        labels: {
                          padding: 15,
                          usePointStyle: true,
                          font: {
                            size: 11,
                            family: '"Inter", sans-serif'
                          },
                          color: '#64748B' // slate-500
                        }
                      },
                      tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.8)', // slate-900 com opacidade
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        bodyFont: {
                          family: '"Inter", sans-serif'
                        },
                        padding: 12,
                        cornerRadius: 4,
                        callbacks: {
                          label: function(context) {
                            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                            const percentage = ((context.parsed / total) * 100).toFixed(1);
                            return `${context.label}: ${context.parsed} (${percentage}%)`;
                          }
                        }
                      },
                      datalabels: {
                        formatter: (value: number, ctx) => {
                          const total = ctx.dataset.data.reduce((a: number, b: number) => a + b, 0);
                          const percentage = ((value / total) * 100).toFixed(0);
                          return value > 0 ? value : '';
                        },
                        color: '#ffffff',
                        font: {
                          weight: 'bold',
                          size: 11
                        },
                        textAlign: 'center'
                      }
                    },
                    animation: {
                      animateRotate: true,
                      duration: 1000
                    }
                  }}
                />
              ) : (
                <div className="h-full flex items-center justify-center">
                  <p className="text-slate-500">Nenhum dado disponível com os filtros atuais</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Gráfico de Status do Prestserv */}
        <div className="bg-white rounded-lg shadow border border-slate-100">
          <div className="p-5 border-b border-slate-100">
            <h2 className="text-lg font-medium text-slate-700">Status do Prestserv</h2>
          </div>
          <div className="p-6">
            <div className="h-80">
              {/* Conteúdo do gráfico */}
            </div>
          </div>
        </div>
      </div>

      {/* Botões com a nova paleta de cores */}
      <div className="flex space-x-4">
        <button className="inline-flex items-center px-4 py-2 text-sm font-medium text-slate-600 border border-slate-300 rounded-md hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2 shadow-sm transition-colors">
          Cancelar
        </button>
        <button className="inline-flex items-center px-4 py-2 text-sm font-bold text-white bg-sky-500 border border-transparent rounded-md hover:bg-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 shadow-sm transition-colors">
          Salvar
        </button>
      </div>
    </div>
  );
};