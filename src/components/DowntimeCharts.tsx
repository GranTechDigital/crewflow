"use client";

import { useState } from 'react';

interface Projeto {
  nome: string;
  codigo: string;
  agEmbarque: number;
  cadastro: number;
  medicina: number;
  treinamento: number;
  atestado: number;
  falta: number;
  demissao: number;
  percentAgEmbarque: number;
  percentCadastro: number;
  percentMedicina: number;
  percentTreinamento: number;
  percentAtestado: number;
  percentFalta: number;
  percentDemissao: number;
  uptime: number;
  downtime: number;
}

interface DowntimeChartsProps {
  projetos: Projeto[];
  distribuicaoCategorias: {
    agEmbarque: number;
    cadastro: number;
    medicina: number;
    treinamento: number;
    atestado: number;
    falta: number;
    demissao: number;
  };
}

export default function DowntimeCharts({ 
  projetos = [], 
  distribuicaoCategorias = {
    agEmbarque: 0,
    cadastro: 0,
    medicina: 0,
    treinamento: 0,
    atestado: 0,
    falta: 0,
    demissao: 0
  } 
}: DowntimeChartsProps) {
  const [selectedProject, setSelectedProject] = useState<string>('');

  // Verificar se os dados estão disponíveis
  if (!projetos || !distribuicaoCategorias) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Carregando dados dos gráficos...</p>
      </div>
    );
  }

  // Calcular total geral para porcentagens
  const totalGeral = Object.values(distribuicaoCategorias).reduce((sum, val) => sum + (val || 0), 0);

  // Dados para gráfico de pizza (distribuição por categoria)
  const categorias = [
    { nome: 'Ag. Embarque', valor: distribuicaoCategorias.agEmbarque || 0, cor: '#3B82F6' },
    { nome: 'Cadastro', valor: distribuicaoCategorias.cadastro || 0, cor: '#10B981' },
    { nome: 'Medicina', valor: distribuicaoCategorias.medicina || 0, cor: '#F59E0B' },
    { nome: 'Treinamento', valor: distribuicaoCategorias.treinamento || 0, cor: '#8B5CF6' },
    { nome: 'Atestado', valor: distribuicaoCategorias.atestado || 0, cor: '#EF4444' },
    { nome: 'Falta', valor: distribuicaoCategorias.falta || 0, cor: '#F97316' },
    { nome: 'Demissão', valor: distribuicaoCategorias.demissao || 0, cor: '#6B7280' }
  ].filter(cat => cat.valor > 0);

  // Todos os projetos ordenados por downtime
  const todosProjetos = projetos
    .sort((a, b) => b.downtime - a.downtime);

  const maxDowntime = Math.max(...todosProjetos.map(p => p.downtime), 1);

  // Função para criar gráfico de pizza SVG
  const createPieChart = () => {
    if (categorias.length === 0) {
      return (
        <div className="w-64 h-64 mx-auto flex items-center justify-center bg-gray-100 rounded-full">
          <p className="text-gray-500">Sem dados</p>
        </div>
      );
    }

    let cumulativePercentage = 0;
    const radius = 80;
    const centerX = 100;
    const centerY = 100;

    return (
      <div className="w-64 h-64 mx-auto">
        <svg viewBox="0 0 200 200" className="w-full h-full">
          {categorias.map((categoria, index) => {
            const percentage = (categoria.valor / totalGeral) * 100;
            const startAngle = (cumulativePercentage / 100) * 360;
            const endAngle = ((cumulativePercentage + percentage) / 100) * 360;
            
            const startAngleRad = (startAngle - 90) * (Math.PI / 180);
            const endAngleRad = (endAngle - 90) * (Math.PI / 180);
            
            const x1 = centerX + radius * Math.cos(startAngleRad);
            const y1 = centerY + radius * Math.sin(startAngleRad);
            const x2 = centerX + radius * Math.cos(endAngleRad);
            const y2 = centerY + radius * Math.sin(endAngleRad);
            
            const largeArcFlag = percentage > 50 ? 1 : 0;
            
            const pathData = [
              `M ${centerX} ${centerY}`,
              `L ${x1} ${y1}`,
              `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
              'Z'
            ].join(' ');
            
            cumulativePercentage += percentage;
            
            return (
              <path
                key={categoria.nome}
                d={pathData}
                fill={categoria.cor}
                stroke="white"
                strokeWidth="2"
                className="hover:opacity-80 transition-opacity cursor-pointer"
              >
                <title>{`${categoria.nome}: ${categoria.valor} (${percentage.toFixed(1)}%)`}</title>
              </path>
            );
          })}
        </svg>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Gráfico de Distribuição por Categoria */}
      <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-lg border border-gray-100 p-4 hover:shadow-xl transition-all duration-300">
        <div className="flex items-center space-x-2 mb-3">
          <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
            Distribuição de Downtime por Categoria
          </h3>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Gráfico de Pizza */}
          <div className="flex flex-col items-center">
            {createPieChart()}
            <p className="text-sm text-gray-600 mt-2">Total: {totalGeral} ocorrências</p>
          </div>
          
          {/* Legenda */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
            {categorias.map((categoria, index) => {
              const percentage = totalGeral > 0 ? (categoria.valor / totalGeral) * 100 : 0;
              return (
                <div key={categoria.nome} className="bg-white rounded-lg p-3 shadow-md hover:shadow-lg transition-all duration-300 hover:scale-[1.02] border border-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full shadow-sm"
                        style={{ backgroundColor: categoria.cor }}
                      />
                      <span className="font-medium text-gray-700 text-sm">{categoria.nome}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-bold text-gray-900">{percentage.toFixed(1)}%</div>
                      <div className="text-xs text-gray-500">{categoria.valor} ocorrências</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Análise Detalhada por Projeto */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Análise Detalhada por Projeto
          </h3>
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="text-sm border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos os projetos</option>
            {projetos.map((projeto) => (
              <option key={projeto.codigo} value={projeto.codigo}>
                {projeto.nome || projeto.codigo}
              </option>
            ))}
          </select>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Projeto
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Uptime / Downtime
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ag. Embarque
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cadastro
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Medicina
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Treinamento
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Atestado
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Falta
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Demissão
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {projetos
                .filter(projeto => !selectedProject || projeto.codigo === selectedProject)
                .slice(0, 10)
                .map((projeto) => (
                <tr key={projeto.codigo} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                    <div>
                      <div className="font-semibold">{projeto.nome || projeto.codigo}</div>
                      <div className="text-xs text-gray-500">{projeto.codigo}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-green-600 font-medium text-xs">↑ {projeto.uptime.toFixed(1)}%</span>
                        <span className="text-red-600 font-medium text-xs">↓ {projeto.downtime.toFixed(1)}%</span>
                      </div>
                      <div className="w-20 bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div className="h-full flex">
                          <div
                            className="bg-green-500"
                            style={{ width: `${projeto.uptime}%` }}
                          ></div>
                          <div
                            className="bg-red-500"
                            style={{ width: `${projeto.downtime}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    <div className="text-center font-medium">
                      {projeto.percentAgEmbarque?.toFixed(1)}%
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    <div className="text-center font-medium">
                      {projeto.percentCadastro?.toFixed(1)}%
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    <div className="text-center font-medium">
                      {projeto.percentMedicina?.toFixed(1)}%
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    <div className="text-center font-medium">
                      {projeto.percentTreinamento?.toFixed(1)}%
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    <div className="text-center font-medium">
                      {projeto.percentAtestado?.toFixed(1)}%
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    <div className="text-center font-medium">
                      {projeto.percentFalta?.toFixed(1)}%
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    <div className="text-center font-medium">
                      {projeto.percentDemissao?.toFixed(1)}%
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}