'use client'

import { UserGroupIcon, BuildingOfficeIcon, DocumentTextIcon, ChevronRightIcon, MagnifyingGlassIcon, ArrowsRightLeftIcon } from '@heroicons/react/24/solid';
import { useEffect, useState } from 'react';
import { getStatusColor } from '../../../utils/statusColors';
import { InlineStatusBadges, BlockStatusBadges } from '../../../components/StatusBadges';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import { usePermissions } from '@/app/hooks/useAuth';
import { PERMISSIONS, ROUTE_PROTECTION } from '@/lib/permissions';


interface Contrato {
  id: number;
  numero: string;
  nome: string;
  cliente: string;
  dataInicio: string;
  dataFim: string;
  centroDeCusto: string;
  status: string;
}

interface Funcionario {
  id: string;
  nome: string;
  centroCusto: string;
  funcao?: string;
  status?: string;
}

interface CentroCusto {
  nome: string;
  totalFuncionarios: number;
}

function CentroCustosContent() {
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingFuncionarios, setLoadingFuncionarios] = useState(true);
  const [contratoSelecionado, setContratoSelecionado] = useState<Contrato | null>(null);
  const [centroCustoSelecionado, setCentroCustoSelecionado] = useState<string | null>(null);
  const [buscaContrato, setBuscaContrato] = useState('');
  const [buscaCentroCusto, setBuscaCentroCusto] = useState('');
  const [buscaFuncionario, setBuscaFuncionario] = useState('');
  const [filtroFuncao, setFiltroFuncao] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [funcoesExpandidas, setFuncoesExpandidas] = useState<Set<string>>(new Set());
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const isEditor = hasPermission(PERMISSIONS.ACCESS_PLANEJAMENTO);

  // Função para agrupar funcionários por função
  const getFuncionariosPorFuncao = (funcionarios: Funcionario[]) => {
    const grupos = funcionarios.reduce((acc, funcionario) => {
      const funcao = funcionario.funcao || 'Sem função definida';
      if (!acc[funcao]) {
        acc[funcao] = [];
      }
      acc[funcao].push(funcionario);
      return acc;
    }, {} as Record<string, Funcionario[]>);

    return Object.entries(grupos).map(([funcao, funcionarios]) => {
      // Contar funcionários por status
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
    });
  };

  // Função para expandir/retrair funções
  const toggleFuncaoExpansao = (funcao: string) => {
    const novasFuncoesExpandidas = new Set(funcoesExpandidas);
    if (novasFuncoesExpandidas.has(funcao)) {
      novasFuncoesExpandidas.delete(funcao);
    } else {
      novasFuncoesExpandidas.add(funcao);
    }
    setFuncoesExpandidas(novasFuncoesExpandidas);
  };

  useEffect(() => {
    fetchContratos(); 
    fetchFuncionarios();
  }, []);

  async function fetchContratos() {
    try {
      const res = await fetch('/api/contratos');
      if (!res.ok) throw new Error('Erro ao carregar contratos');
      const data = await res.json();
      setContratos(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchFuncionarios() {
    try {
      const res = await fetch('/api/dados');
      const data = await res.json();
      setFuncionarios(data);
    } catch (error) {
      console.error('Erro ao buscar funcionários:', error);
    } finally {
      setLoadingFuncionarios(false);
    }
  }

  const getFuncionariosPorCentro = (centros: string[]) => {
    return centros.map((centro) => {
      const total = funcionarios.filter(f => f.centroCusto === centro).length;
      return { centro, total };
    });
  };

  const contratosUnicos = Object.values(
    contratos.reduce((acc, contrato) => {
      if (!acc[contrato.numero]) {
        acc[contrato.numero] = { ...contrato, centros: new Set<string>() };
      }
      (contrato.centroDeCusto ?? '')
        .split(',')
        .map(c => c.trim())
        .filter(c => c !== '')
        .forEach(c => acc[contrato.numero].centros.add(c));
      return acc;
    }, {} as Record<string, Contrato & { centros: Set<string> }>)
  );

  const getCentrosCustoDoContrato = (contrato: Contrato & { centros?: Set<string> }): (CentroCusto & { statusCount: Record<string, number> })[] => {
    // Se o contrato tem a propriedade centros (do contratosUnicos), use ela
    if (contrato.centros) {
      const centros = Array.from(contrato.centros);
      return centros.map(centro => {
        const funcionariosDoCentro = funcionarios.filter(f => f.centroCusto === centro);
        
        // Contar funcionários por status
        const statusCount = funcionariosDoCentro.reduce((acc, funcionario) => {
          const status = funcionario.status || 'sem status';
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        return {
          nome: centro,
          totalFuncionarios: funcionariosDoCentro.length,
          statusCount
        };
      });
    }
    
    // Fallback para contratos individuais
    const centros = (contrato.centroDeCusto ?? '')
      .split(',')
      .map(c => c.trim())
      .filter(c => c !== '');
    
    return centros.map(centro => {
      const funcionariosDoCentro = funcionarios.filter(f => f.centroCusto === centro);
      
      // Contar funcionários por status
      const statusCount = funcionariosDoCentro.reduce((acc, funcionario) => {
        const status = funcionario.status || 'sem status';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      return {
        nome: centro,
        totalFuncionarios: funcionariosDoCentro.length,
        statusCount
      };
    });
  };

  // Função para obter todos os centros de custo únicos que pertencem a contratos cadastrados
  const getTodosCentrosCusto = (): (CentroCusto & { statusCount: Record<string, number> })[] => {
    const centrosDeContratos = new Set<string>();
    
    // Coletar todos os centros de custo dos contratos cadastrados
    contratosUnicos.forEach(contrato => {
      if (contrato.centros) {
        contrato.centros.forEach(centro => centrosDeContratos.add(centro));
      }
    });
    
    return Array.from(centrosDeContratos).map(centro => {
      const funcionariosDoCentro = funcionarios.filter(f => f.centroCusto === centro);
      
      // Contar funcionários por status
      const statusCount = funcionariosDoCentro.reduce((acc, funcionario) => {
        const status = funcionario.status || 'sem status';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      return {
        nome: centro,
        totalFuncionarios: funcionariosDoCentro.length,
        statusCount
      };
    });
  };

  // Funções de filtro
  const contratosFiltrados = contratosUnicos.filter(contrato => {
    const termo = buscaContrato.toLowerCase();
    return contrato.nome.toLowerCase().includes(termo) ||
           contrato.cliente.toLowerCase().includes(termo) ||
           contrato.numero.toLowerCase().includes(termo);
  });

  const centrosCustoFiltrados = () => {
    const centros = contratoSelecionado 
      ? getCentrosCustoDoContrato(contratoSelecionado)
      : getTodosCentrosCusto();
    
    return centros.filter(centro => 
      centro.nome.toLowerCase().includes(buscaCentroCusto.toLowerCase())
    );
  };

  const funcionariosFiltrados = () => {
    let funcionariosBase = funcionarios;
    
    // Primeiro, filtrar apenas funcionários cujos centros de custo pertencem a contratos cadastrados
    const centrosDeContratos = new Set<string>();
    contratosUnicos.forEach(contrato => {
      if (contrato.centros) {
        contrato.centros.forEach(centro => centrosDeContratos.add(centro));
      }
    });
    funcionariosBase = funcionarios.filter(f => centrosDeContratos.has(f.centroCusto));
    
    // Filtrar por centro de custo selecionado
    if (centroCustoSelecionado) {
      funcionariosBase = funcionariosBase.filter(f => f.centroCusto === centroCustoSelecionado);
    }
    // Se não há centro selecionado mas há contrato, filtrar por centros do contrato
    else if (contratoSelecionado && !centroCustoSelecionado) {
      const centrosDoContrato = getCentrosCustoDoContrato(contratoSelecionado).map(c => c.nome);
      funcionariosBase = funcionariosBase.filter(f => centrosDoContrato.includes(f.centroCusto));
    }
    
    return funcionariosBase.filter(funcionario => {
      const termo = buscaFuncionario.toLowerCase();
      const matchesBusca = funcionario.nome.toLowerCase().includes(termo) ||
                           String(funcionario.id).toLowerCase().includes(termo);
      
      const matchesFuncao = !filtroFuncao || (funcionario.funcao || 'Sem função definida') === filtroFuncao;
      const matchesStatus = !filtroStatus || funcionario.status === filtroStatus;
      
      return matchesBusca && matchesFuncao && matchesStatus;
    });
  };

  const getFuncionariosDoCentroCusto = (centroCusto: string): Funcionario[] => {
    return funcionarios.filter(f => f.centroCusto === centroCusto);
  };

  // Função para obter todas as funções únicas dos funcionários disponíveis
  const getFuncoesUnicas = (): string[] => {
    let funcionariosBase = funcionarios;
    
    // Filtrar por centro de custo selecionado se houver
    if (centroCustoSelecionado) {
      funcionariosBase = funcionariosBase.filter(f => f.centroCusto === centroCustoSelecionado);
    } else if (contratoSelecionado) {
      const centrosDoContrato = getCentrosCustoDoContrato(contratoSelecionado).map(c => c.nome);
      funcionariosBase = funcionariosBase.filter(f => centrosDoContrato.includes(f.centroCusto));
    }
    
    const funcoes = new Set<string>();
    funcionariosBase.forEach(f => {
      funcoes.add(f.funcao || 'Sem função definida');
    });
    return Array.from(funcoes).sort();
  };

  // Função para obter todos os status únicos dos funcionários disponíveis
  const getStatusUnicos = (): string[] => {
    let funcionariosBase = funcionarios;
    
    // Filtrar por centro de custo selecionado se houver
    if (centroCustoSelecionado) {
      funcionariosBase = funcionariosBase.filter(f => f.centroCusto === centroCustoSelecionado);
    } else if (contratoSelecionado) {
      const centrosDoContrato = getCentrosCustoDoContrato(contratoSelecionado).map(c => c.nome);
      funcionariosBase = funcionariosBase.filter(f => centrosDoContrato.includes(f.centroCusto));
    }
    
    const status = new Set<string>();
    funcionariosBase.forEach(f => {
      if (f.status) status.add(f.status);
    });
    return Array.from(status).sort();
  };

  const handleContratoClick = (contrato: Contrato) => {
    if (contratoSelecionado?.numero === contrato.numero) {
      setContratoSelecionado(null);
      setCentroCustoSelecionado(null);
    } else {
      setContratoSelecionado(contrato);
      setCentroCustoSelecionado(null);
    }
  };

  const handleCentroCustoClick = (centroCusto: string) => {
    if (centroCustoSelecionado === centroCusto) {
      setCentroCustoSelecionado(null);
    } else {
      setCentroCustoSelecionado(centroCusto);
    }
  };



  if (loading || loadingFuncionarios) {
    return <div className="p-6 text-gray-600">Carregando contratos...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold text-gray-900">Centro de Custos</h1>
          {isEditor && (
            <button
              onClick={() => router.push('/planejamento/remanejamentos/novo?returnTo=/planejamento/centro-custos')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <ArrowsRightLeftIcon className="w-5 h-5" />
              Remanejar Funcionários
            </button>
          )}
        </div>
        <p className="text-gray-600">Navegue pelos contratos, centros de custos e funcionários</p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-[calc(100vh-200px)] lg:h-[calc(100vh-200px)]">
        {/* Painel de Contratos */}
        <div className="bg-white rounded-lg shadow-sm border border-blue-200 overflow-hidden flex flex-col">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex-shrink-0">
            <div className="flex items-center gap-2 mb-3">
              <DocumentTextIcon className="w-5 h-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">Contratos</h2>
              <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full">
                {contratosFiltrados.length}
              </span>
            </div>
            <div className="relative">
              <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nome, cliente ou número..."
                value={buscaContrato}
                onChange={(e) => setBuscaContrato(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="overflow-y-auto flex-1 min-h-0">
            {contratosFiltrados.map((contrato) => {
              const centros = Array.from(contrato.centros);
              const funcionariosPorCentro = getFuncionariosPorCentro(centros);
              const totalFuncionarios = funcionariosPorCentro.reduce((sum, item) => sum + item.total, 0);
              const isSelected = contratoSelecionado?.numero === contrato.numero;
              
              return (
                <div
                  key={contrato.numero}
                  onClick={() => handleContratoClick(contrato)}
                  className={`p-4 border-b border-gray-100 cursor-pointer transition-all duration-200 hover:bg-gray-50 ${
                    isSelected ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-gray-900 text-sm">{contrato.nome}</h3>
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-medium ${
                        contrato.status === 'Ativo'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {contrato.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">{contrato.cliente}</p>
                  <div className="flex items-center justify-end">
                    <div className="flex items-center gap-1 text-xs text-gray-600">
                      <UserGroupIcon className="w-3 h-3" />
                      {totalFuncionarios}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

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
              <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar centro de custo..."
                value={buscaCentroCusto}
                onChange={(e) => setBuscaCentroCusto(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
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

        {/* Painel de Funcionários */}
        <div className="bg-white rounded-lg shadow-sm border border-purple-200 overflow-hidden flex flex-col">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex-shrink-0">
            <div className="flex items-center gap-2 mb-3">
              <UserGroupIcon className="w-5 h-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">Funcionários</h2>
              <span className="bg-purple-100 text-purple-800 text-xs font-medium px-2 py-1 rounded-full">
                {funcionariosFiltrados().length}
              </span>
            </div>
            
            {/* Filtros por função e status */}
            <div className="space-y-2 mb-3">
              <div className="flex gap-2">
                <select
                  value={filtroFuncao}
                  onChange={(e) => setFiltroFuncao(e.target.value)}
                  className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-purple-500 focus:border-transparent bg-white min-w-0 max-w-full"
                >
                  <option value="">Todas as funções</option>
                  {getFuncoesUnicas().map(funcao => (
                    <option key={funcao} value={funcao}>{funcao}</option>
                  ))}
                </select>
                
                <select
                  value={filtroStatus}
                  onChange={(e) => setFiltroStatus(e.target.value)}
                  className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-purple-500 focus:border-transparent bg-white min-w-0 max-w-full"
                >
                  <option value="">Todos os status</option>
                  {getStatusUnicos().map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="relative">
              <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nome ou matrícula..."
                value={buscaFuncionario}
                onChange={(e) => setBuscaFuncionario(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="overflow-y-auto flex-1 min-h-0">
              {getFuncionariosPorFuncao(funcionariosFiltrados()).map((grupo) => (
                <div key={grupo.funcao} className="border-b border-gray-100">
                  {/* Header da função */}
                  <div
                    onClick={() => toggleFuncaoExpansao(grupo.funcao)}
                    className={`p-4 cursor-pointer transition-colors duration-200 flex items-center justify-between ${
                      funcoesExpandidas.has(grupo.funcao) 
                        ? 'bg-purple-50 border-l-4 border-l-purple-500' 
                        : 'bg-white hover:bg-gray-50 border-l-4 border-gray-300'
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <ChevronRightIcon
                          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
                            funcoesExpandidas.has(grupo.funcao) ? 'rotate-90' : ''
                          }`}
                        />
                        <span className="font-medium text-gray-900">{grupo.funcao}</span>
                        <span className="text-sm text-gray-500">({grupo.total})</span>
                      </div>
                      
                      {/* Badges de status por função */}
                      <div className="ml-7">
                        <BlockStatusBadges 
                          statusCount={grupo.statusCount}
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* Lista de funcionários */}
                  {funcoesExpandidas.has(grupo.funcao) && (
                    <div className="bg-gray-50">
                      {grupo.funcionarios.map((funcionario) => {
                        
                        return (
                          <div
                            key={funcionario.id}
                            className="p-3 mx-2 my-2 bg-white rounded-lg border border-gray-200 hover:shadow-sm transition-all duration-200"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-gray-900 text-sm">{funcionario.nome}</span>
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[11px] font-medium ${getStatusColor(funcionario.status, 'badge')}`}>
                                {funcionario.status}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      </div>


    </div>
  );
}

export default function ContratosPage() {
  return (
    <ProtectedRoute
      requiredEquipe={ROUTE_PROTECTION.PLANEJAMENTO.requiredEquipe}
      requiredPermissions={ROUTE_PROTECTION.PLANEJAMENTO.requiredPermissions}
    >
      <CentroCustosContent />
    </ProtectedRoute>
  );
}
