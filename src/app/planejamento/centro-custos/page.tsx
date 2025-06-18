'use client'

import { UserGroupIcon, BuildingOfficeIcon, DocumentTextIcon, ChevronRightIcon, MagnifyingGlassIcon } from '@heroicons/react/24/solid';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';


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
}

interface CentroCusto {
  nome: string;
  totalFuncionarios: number;
}

export default function ContratosPage() {
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingFuncionarios, setLoadingFuncionarios] = useState(true);
  const [contratoSelecionado, setContratoSelecionado] = useState<Contrato | null>(null);
  const [centroCustoSelecionado, setCentroCustoSelecionado] = useState<string | null>(null);
  const [buscaContrato, setBuscaContrato] = useState('');
  const [buscaCentroCusto, setBuscaCentroCusto] = useState('');
  const [buscaFuncionario, setBuscaFuncionario] = useState('');
  const router = useRouter();

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

  const getCentrosCustoDoContrato = (contrato: Contrato & { centros?: Set<string> }): CentroCusto[] => {
    // Se o contrato tem a propriedade centros (do contratosUnicos), use ela
    if (contrato.centros) {
      const centros = Array.from(contrato.centros);
      return centros.map(centro => ({
        nome: centro,
        totalFuncionarios: funcionarios.filter(f => f.centroCusto === centro).length
      }));
    }
    
    // Fallback para contratos individuais
    const centros = (contrato.centroDeCusto ?? '')
      .split(',')
      .map(c => c.trim())
      .filter(c => c !== '');
    
    return centros.map(centro => ({
      nome: centro,
      totalFuncionarios: funcionarios.filter(f => f.centroCusto === centro).length
    }));
  };

  // Função para obter todos os centros de custo únicos que pertencem a contratos cadastrados
  const getTodosCentrosCusto = (): CentroCusto[] => {
    const centrosDeContratos = new Set<string>();
    
    // Coletar todos os centros de custo dos contratos cadastrados
    contratosUnicos.forEach(contrato => {
      if (contrato.centros) {
        contrato.centros.forEach(centro => centrosDeContratos.add(centro));
      }
    });
    
    return Array.from(centrosDeContratos).map(centro => ({
      nome: centro,
      totalFuncionarios: funcionarios.filter(f => f.centroCusto === centro).length
    }));
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
      return funcionario.nome.toLowerCase().includes(termo) ||
             String(funcionario.id).toLowerCase().includes(termo);
    });
  };

  const getFuncionariosDoCentroCusto = (centroCusto: string): Funcionario[] => {
    return funcionarios.filter(f => f.centroCusto === centroCusto);
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Centro de Custos</h1>
        <p className="text-gray-600">Navegue pelos contratos, centros de custos e funcionários</p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
        {/* Painel de Contratos */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
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
          <div className="overflow-y-auto h-full">
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
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">#{contrato.numero}</span>
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
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
            <div className="flex items-center gap-2 mb-3">
              <BuildingOfficeIcon className="w-5 h-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">Centros de Custo</h2>
              <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded-full">
                {centrosCustoFiltrados().length}
              </span>
            </div>
            {contratoSelecionado && (
              <p className="text-sm text-gray-600 mb-3">{contratoSelecionado.nome}</p>
            )}
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
          <div className="overflow-y-auto h-full">
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
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900 text-sm">{centro.nome}</h3>
                      <div className="flex items-center gap-1 text-xs text-gray-600 mt-1">
                        <UserGroupIcon className="w-3 h-3" />
                        {centro.totalFuncionarios} funcionário{centro.totalFuncionarios !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Painel de Funcionários */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
            <div className="flex items-center gap-2 mb-3">
              <UserGroupIcon className="w-5 h-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">Funcionários</h2>
              <span className="bg-purple-100 text-purple-800 text-xs font-medium px-2 py-1 rounded-full">
                {funcionariosFiltrados().length}
              </span>
            </div>
            {centroCustoSelecionado && (
              <p className="text-sm text-gray-600 mb-3">{centroCustoSelecionado}</p>
            )}
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
          <div className="overflow-y-auto h-full">
            {funcionariosFiltrados().map((funcionario) => (
              <div
                key={funcionario.id}
                className="p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors duration-200"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900 text-sm">{funcionario.nome}</h3>
                    <p className="text-xs text-gray-500 mt-1">ID: {funcionario.id}</p>
                    <p className="text-xs text-gray-400 mt-1">Centro: {funcionario.centroCusto}</p>
                  </div>
                  <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                    <span className="text-xs font-medium text-gray-600">
                      {funcionario.nome.charAt(0).toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
