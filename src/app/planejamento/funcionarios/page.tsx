'use client';

import { UserGroupIcon, BuildingOfficeIcon, ChevronRightIcon, MagnifyingGlassIcon, ArrowsRightLeftIcon } from '@heroicons/react/24/solid';
import { useEffect, useState } from 'react';
import { getStatusColor } from '../../../utils/statusColors';
import { InlineStatusBadges, BlockStatusBadges } from '../../../components/StatusBadges';
import { CompactStatusLegend } from '../../../components/StatusLegend';
import { useRouter } from 'next/navigation';

interface Funcionario {
  id: string;
  nome: string;
  centroCusto: string;
  funcao?: string;
  status?: string;
  departamento?: string;
}

interface CentroCusto {
  nome: string;
  totalFuncionarios: number;
  statusCount: Record<string, number>;
  departamentos?: string[];
}

interface Funcao {
  nome: string;
  totalFuncionarios: number;
  statusCount: Record<string, number>;
}

export default function FuncionariosPage() {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [contratos, setContratos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [centroCustoSelecionado, setCentroCustoSelecionado] = useState<string | null>(null);
  const [funcaoSelecionada, setFuncaoSelecionada] = useState<string | null>(null);
  const [buscaCentroCusto, setBuscaCentroCusto] = useState('');
  const [buscaFuncao, setBuscaFuncao] = useState('');
  const [buscaFuncionario, setBuscaFuncionario] = useState('');
  const [funcoesExpandidas, setFuncoesExpandidas] = useState<Set<string>>(new Set());
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch funcionarios
        const funcionariosResponse = await fetch('/api/funcionarios');
        if (!funcionariosResponse.ok) {
          throw new Error('Erro ao carregar funcionários');
        }
        const funcionariosData = await funcionariosResponse.json();
        setFuncionarios(funcionariosData);

        // Fetch contratos
        const contratosResponse = await fetch('/api/contratos');
        if (!contratosResponse.ok) {
          throw new Error('Erro ao carregar contratos');
        }
        const contratosData = await contratosResponse.json();
        setContratos(contratosData);
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Função utilitária para filtrar funcionários válidos (com centro de custo)
  const funcionariosValidos = funcionarios.filter(f => f.centroCusto && f.centroCusto !== 'Sem centro de custo');

  // Atualize getCentrosCusto para usar apenas funcionários válidos
  const getCentrosCusto = (): CentroCusto[] => {
    const centrosMap = new Map<string, { total: number; statusCount: Record<string, number>; departamentos: Set<string> }>();
    
    funcionariosValidos.forEach(funcionario => {
      const centro = funcionario.centroCusto;
      const status = funcionario.status || 'sem status';
      const departamento = funcionario.departamento || 'Sem departamento';
      
      if (!centrosMap.has(centro)) {
        centrosMap.set(centro, { total: 0, statusCount: {}, departamentos: new Set() });
      }
      
      const centroData = centrosMap.get(centro)!;
      centroData.total += 1;
      centroData.statusCount[status] = (centroData.statusCount[status] || 0) + 1;
      centroData.departamentos.add(departamento);
    });
    
    return Array.from(centrosMap.entries()).map(([nome, data]) => ({
      nome,
      totalFuncionarios: data.total,
      statusCount: data.statusCount,
      departamentos: Array.from(data.departamentos)
    }));
  };

  // Altere getFuncoes para aceitar uma lista de funcionários
  const getFuncoes = (funcionariosList: Funcionario[] = funcionarios) => {
    const funcoesMap = new Map<string, { total: number; statusCount: Record<string, number> }>();
    
    funcionariosList.forEach(funcionario => {
      const funcao = funcionario.funcao || 'Sem função';
      const status = funcionario.status || 'sem status';
      
      if (!funcoesMap.has(funcao)) {
        funcoesMap.set(funcao, { total: 0, statusCount: {} });
      }
      
      const funcaoData = funcoesMap.get(funcao)!;
      funcaoData.total += 1;
      funcaoData.statusCount[status] = (funcaoData.statusCount[status] || 0) + 1;
    });
    
    return Array.from(funcoesMap.entries()).map(([nome, data]) => ({
      nome,
      totalFuncionarios: data.total,
      statusCount: data.statusCount
    }));
  };

  const centrosCustoFiltrados = () => {
    return getCentrosCusto().filter(centro =>
      centro.nome.toLowerCase().includes(buscaCentroCusto.toLowerCase())
    );
  };

  // Atualize funcoesFiltradas para usar funcionários válidos
  const funcoesFiltradas = () => {
    // Se o filtro for explicitamente 'Sem centro de custo', mostre nada
    if (centroCustoSelecionado === 'Sem centro de custo') return [];
    const funcionariosParaFuncoes = centroCustoSelecionado
      ? funcionariosValidos.filter(f => f.centroCusto === centroCustoSelecionado)
      : funcionariosValidos;
    return getFuncoes(funcionariosParaFuncoes).filter(funcao =>
      funcao.nome.toLowerCase().includes(buscaFuncao.toLowerCase())
    );
  };

  // Atualize funcionariosFiltrados para ocultar sem centro de custo, exceto se explicitamente filtrado
  const funcionariosFiltrados = () => {
    return funcionarios.filter(funcionario => {
      // Se o filtro for explicitamente 'Sem centro de custo', mostre apenas esses
      if (centroCustoSelecionado === 'Sem centro de custo') {
        return funcionario.centroCusto === 'Sem centro de custo';
      }
      // Caso contrário, oculte os sem centro de custo
      if (!funcionario.centroCusto || funcionario.centroCusto === 'Sem centro de custo') return false;
      const matchCentro = !centroCustoSelecionado || funcionario.centroCusto === centroCustoSelecionado;
      const matchFuncao = !funcaoSelecionada || funcionario.funcao === funcaoSelecionada;
      const matchBusca = funcionario.nome.toLowerCase().includes(buscaFuncionario.toLowerCase()) ||
                        funcionario.id.toString().toLowerCase().includes(buscaFuncionario.toLowerCase());
      return matchCentro && matchFuncao && matchBusca;
    });
  };

  const handleCentroCustoClick = (centroCusto: string) => {
    setCentroCustoSelecionado(centroCustoSelecionado === centroCusto ? null : centroCusto);
  };

  const handleFuncaoClick = (funcao: string) => {
    setFuncaoSelecionada(funcaoSelecionada === funcao ? null : funcao);
  };

  const getFuncoesUnicas = () => {
    const funcoes = new Set(funcionarios.map(f => f.funcao).filter(Boolean));
    return Array.from(funcoes).sort();
  };

  const getStatusPresentes = () => {
    const statusesPresentes = new Set<string>();
    funcionariosFiltrados().forEach(funcionario => {
      if (funcionario.status) {
        statusesPresentes.add(funcionario.status);
      }
    });
    return Array.from(statusesPresentes);
  };

  const limparFiltros = () => {
    setBuscaFuncionario('');
    setCentroCustoSelecionado(null);
    setFuncaoSelecionada(null);
  };

  const temFiltrosAtivos = () => {
    return buscaFuncionario || centroCustoSelecionado || funcaoSelecionada;
  };

  const getFuncionariosPorFuncao = (funcionariosList: Funcionario[]) => {
    const funcionariosPorFuncao = funcionariosList.reduce((acc, funcionario) => {
      const funcao = funcionario.funcao || 'Sem função';
      if (!acc[funcao]) {
        acc[funcao] = [];
      }
      acc[funcao].push(funcionario);
      return acc;
    }, {} as Record<string, Funcionario[]>);

    return Object.entries(funcionariosPorFuncao).map(([funcao, funcionarios]) => {
      const statusCount = funcionarios.reduce((acc, funcionario) => {
        const status = funcionario.status || 'sem status';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return {
        funcao,
        funcionarios,
        total: funcionarios.length,
        statusCount
      };
    }).sort((a, b) => a.funcao.localeCompare(b.funcao));
  };



  const toggleFuncaoExpansao = (funcao: string) => {
    const novasFuncoesExpandidas = new Set(funcoesExpandidas);
    if (novasFuncoesExpandidas.has(funcao)) {
      novasFuncoesExpandidas.delete(funcao);
    } else {
      novasFuncoesExpandidas.add(funcao);
    }
    setFuncoesExpandidas(novasFuncoesExpandidas);
  };



  if (loading) {
    return <div className="p-6 text-gray-600">Carregando funcionários...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold text-gray-900">Gestão de Funcionários</h1>
          <button
            onClick={() => router.push('/planejamento/remanejamentos/novo?returnTo=/planejamento/funcionarios')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <ArrowsRightLeftIcon className="w-5 h-5" />
            Remanejar Funcionários
          </button>
        </div>
        <p className="text-gray-600">Gerencie funcionários por centro de custo</p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-[calc(100vh-200px)] lg:h-[calc(100vh-200px)]">
        {/* Painel de Centros de Custo */}
        <div className="bg-white rounded-lg shadow-sm border border-green-200 overflow-hidden flex flex-col">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex-shrink-0">
            <div className="flex items-center gap-2 mb-3">
              <BuildingOfficeIcon className="w-5 h-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">Centros de Custo</h2>
              <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded-full">
                {centrosCustoFiltrados().length}
              </span>
            </div>
            <div className="relative">
              <MagnifyingGlassIcon className="w-3 h-3 absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar centro de custo..."
                value={buscaCentroCusto}
                onChange={(e) => setBuscaCentroCusto(e.target.value)}
                className="w-full pl-7 pr-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="overflow-y-auto flex-1 min-h-0">
            {centrosCustoFiltrados().map((centro) => {
              const isSelected = centroCustoSelecionado === centro.nome;
              
              return (
                <div
                  key={centro.nome}
                  onClick={() => handleCentroCustoClick(centro.nome)}
                  className={`p-4 border-b border-gray-100 cursor-pointer transition-all duration-200 hover:bg-gray-50 ${
                    isSelected ? 'bg-green-50 border-l-4 border-l-green-500' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-gray-900 text-sm">{centro.nome}</h3>
                        <div className="flex items-center gap-1 text-xs text-gray-600">
                          <UserGroupIcon className="w-3 h-3" />
                          <span>{centro.totalFuncionarios}</span>
                        </div>
                      </div>
                      
                      {/* Departamentos */}
                      {centro.departamentos && centro.departamentos.length > 0 && (
                        <div className="mt-1">
                          <p className="text-xs text-gray-500">
                            Depto: {centro.departamentos.join(', ')}
                          </p>
                        </div>
                      )}
                      
                      {/* Badges de status */}
                      <InlineStatusBadges 
                        statusCount={centro.statusCount}
                        className="mt-2"
                      />
                    </div>
                    <ChevronRightIcon className="w-4 h-4 text-gray-400 ml-2" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Painel de Funções */}
        <div className="bg-white rounded-lg shadow-sm border border-blue-200 overflow-hidden flex flex-col">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex-shrink-0">
            <div className="flex items-center gap-2 mb-3">
              <UserGroupIcon className="w-5 h-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">Funções</h2>
              <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full">
                {funcoesFiltradas().length}
              </span>
            </div>
            <div className="relative">
              <MagnifyingGlassIcon className="w-3 h-3 absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar função..."
                value={buscaFuncao}
                onChange={(e) => setBuscaFuncao(e.target.value)}
                className="w-full pl-7 pr-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="overflow-y-auto flex-1 min-h-0">
            {funcoesFiltradas().map((funcao) => {
              const isSelected = funcaoSelecionada === funcao.nome;
              
              return (
                <div
                  key={funcao.nome}
                  onClick={() => handleFuncaoClick(funcao.nome)}
                  className={`p-4 border-b border-gray-100 cursor-pointer transition-all duration-200 hover:bg-gray-50 ${
                    isSelected ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-gray-900 text-sm">{funcao.nome}</h3>
                        <div className="flex items-center gap-1 text-xs text-gray-600">
                          <UserGroupIcon className="w-3 h-3" />
                          <span>{funcao.totalFuncionarios}</span>
                        </div>
                      </div>
                      
                      {/* Badges de status */}
                      <InlineStatusBadges 
                        statusCount={funcao.statusCount}
                        className="mt-2"
                      />
                    </div>
                    <ChevronRightIcon className="w-4 h-4 text-gray-400 ml-2" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Painel de Funcionários */}
        <div className="bg-white rounded-lg shadow-sm border border-purple-200 overflow-hidden flex flex-col">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <UserGroupIcon className="w-5 h-5 text-gray-600" />
                <h2 className="text-lg font-semibold text-gray-900">Funcionários</h2>
                <span className="bg-purple-100 text-purple-800 text-xs font-medium px-2 py-1 rounded-full">
                  {funcionariosFiltrados().length}
                </span>
              </div>
              {temFiltrosAtivos() && (
                <button
                  onClick={limparFiltros}
                  className="text-xs text-purple-600 hover:text-purple-800 underline"
                >
                  Limpar filtros
                </button>
              )}
            </div>
            
            {/* Campo de busca */}
            <div className="relative">
              <MagnifyingGlassIcon className="w-3 h-3 absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar..."
                value={buscaFuncionario}
                onChange={(e) => setBuscaFuncionario(e.target.value)}
                className="w-full pl-7 pr-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="overflow-y-auto flex-1 min-h-0">
            {funcionariosFiltrados().map((funcionario) => (
              <div
                key={funcionario.id}
                className="px-6 py-3 border-b border-gray-100 hover:bg-gray-100 transition-colors cursor-pointer"
                onClick={() => router.push(`/planejamento/funcionarios/${funcionario.id}`)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 text-sm">{funcionario.nome}</span>
                      <span className="text-xs text-gray-500">#{funcionario.id}</span>
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      {funcionario.centroCusto} • {funcionario.funcao}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {funcionario.status && (
                      <span
                        className={`text-xs px-2 py-1 rounded-full font-medium ${
                          getStatusColor(funcionario.status)
                        }`}
                      >
                        {funcionario.status}
                      </span>
                    )}
                    <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legenda de Status */}
      <div className="mt-6">
        <CompactStatusLegend presentStatuses={getStatusPresentes()} />
      </div>


    </div>
  );
}