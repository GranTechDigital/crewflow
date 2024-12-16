'use client'

import { UserGroupIcon, BuildingOfficeIcon, DocumentTextIcon, ChevronRightIcon } from '@heroicons/react/24/solid';
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

  const getFuncionariosDoCentroCusto = (centroCusto: string): Funcionario[] => {
    return funcionarios.filter(f => f.centroCusto === centroCusto);
  };

  const handleContratoClick = (contrato: Contrato) => {
    setContratoSelecionado(contrato);
    setCentroCustoSelecionado(null);
  };

  const handleCentroCustoClick = (centroCusto: string) => {
    setCentroCustoSelecionado(centroCusto);
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
            <div className="flex items-center gap-2">
              <DocumentTextIcon className="w-5 h-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">Contratos</h2>
              <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full">
                {contratosUnicos.length}
              </span>
            </div>
          </div>
          <div className="overflow-y-auto h-full">
            {contratosUnicos.map((contrato) => {
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
            <div className="flex items-center gap-2">
              <BuildingOfficeIcon className="w-5 h-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">Centros de Custo</h2>
              {contratoSelecionado && (
                <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded-full">
                  {getCentrosCustoDoContrato(contratoSelecionado).length}
                </span>
              )}
            </div>
            {contratoSelecionado && (
              <p className="text-sm text-gray-600 mt-1">{contratoSelecionado.nome}</p>
            )}
          </div>
          <div className="overflow-y-auto h-full">
            {!contratoSelecionado ? (
              <div className="flex items-center justify-center h-32 text-gray-500">
                <div className="text-center">
                  <BuildingOfficeIcon className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">Selecione um contrato</p>
                </div>
              </div>
            ) : (
              getCentrosCustoDoContrato(contratoSelecionado).map((centro) => {
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
              })
            )}
          </div>
        </div>

        {/* Painel de Funcionários */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <UserGroupIcon className="w-5 h-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">Funcionários</h2>
              {centroCustoSelecionado && (
                <span className="bg-purple-100 text-purple-800 text-xs font-medium px-2 py-1 rounded-full">
                  {getFuncionariosDoCentroCusto(centroCustoSelecionado).length}
                </span>
              )}
            </div>
            {centroCustoSelecionado && (
              <p className="text-sm text-gray-600 mt-1">{centroCustoSelecionado}</p>
            )}
          </div>
          <div className="overflow-y-auto h-full">
            {!centroCustoSelecionado ? (
              <div className="flex items-center justify-center h-32 text-gray-500">
                <div className="text-center">
                  <UserGroupIcon className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">Selecione um centro de custo</p>
                </div>
              </div>
            ) : (
              getFuncionariosDoCentroCusto(centroCustoSelecionado).map((funcionario) => (
                <div
                  key={funcionario.id}
                  className="p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors duration-200"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900 text-sm">{funcionario.nome}</h3>
                      <p className="text-xs text-gray-500 mt-1">ID: {funcionario.id}</p>
                    </div>
                    <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                      <span className="text-xs font-medium text-gray-600">
                        {funcionario.nome.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
