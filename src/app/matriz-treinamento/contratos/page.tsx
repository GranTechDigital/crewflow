'use client';

import { useState, useEffect } from 'react';
import { 
  BuildingOfficeIcon,
  UsersIcon,
  AcademicCapIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
  CalendarIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  FunnelIcon
} from '@heroicons/react/24/outline';
import ProtectedRoute from '@/components/ProtectedRoute';
import { ROUTE_PROTECTION } from '@/lib/permissions';
import Link from 'next/link';

interface Contrato {
  id: number;
  nome: string;
  numero: string;
  cliente: string;
  status: string;
  dataInicio: string | null;
  dataFim: string | null;
  totalFuncoes: number;
  _count: {
    matrizTreinamento: number;
  };
  funcoes: {
    id: number;
    funcao: string;
    _count: {
      matrizTreinamento: number;
    };
  }[];
}

interface ApiResponse {
  success: boolean;
  data: Contrato[];
  total: number;
  message?: string;
}

export default function MatrizTreinamentoContratosPage() {
  return (
    <ProtectedRoute 
      requiredPermissions={ROUTE_PROTECTION.MATRIZ_TREINAMENTO.requiredPermissions}
      requiredEquipe={ROUTE_PROTECTION.MATRIZ_TREINAMENTO.requiredEquipe}
    >
      <MatrizTreinamentoContratosContent />
    </ProtectedRoute>
  );
}

function MatrizTreinamentoContratosContent() {
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [clienteFilter, setClienteFilter] = useState('todos');

  useEffect(() => {
    fetchContratos();
  }, []);

  const fetchContratos = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/matriz-treinamento/contratos');
      const data: ApiResponse = await response.json();
      
      if (data.success) {
        setContratos(data.data);
      } else {
        console.error('Erro na API:', data.message);
      }
    } catch (error) {
      console.error('Erro ao buscar contratos:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'ativo':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'inativo':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'pendente':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'ativo':
        return <CheckCircleIcon className="h-4 w-4" />;
      case 'inativo':
        return <ExclamationTriangleIcon className="h-4 w-4" />;
      case 'pendente':
        return <ClockIcon className="h-4 w-4" />;
      default:
        return <ClockIcon className="h-4 w-4" />;
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const uniqueClientes = [...new Set(contratos.map(c => c.cliente))];

  const filteredContratos = contratos.filter(contrato => {
    const matchesSearch = 
      contrato.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contrato.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contrato.cliente.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'todos' || contrato.status?.toLowerCase() === statusFilter;
    const matchesCliente = clienteFilter === 'todos' || contrato.cliente === clienteFilter;
    
    return matchesSearch && matchesStatus && matchesCliente;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent mx-auto"></div>
          <p className="mt-6 text-lg text-gray-700 font-medium">Carregando contratos...</p>
          <p className="text-sm text-gray-500">Aguarde enquanto buscamos os dados</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Moderno */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-4 mb-4">
                <div className="p-3 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-lg">
                  <AcademicCapIcon className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold text-gray-900">Matriz de Treinamento</h1>
                  <p className="text-lg text-gray-600 mt-1">
                    Gerencie treinamentos obrigatórios por contrato e função
                  </p>
                </div>
              </div>
            </div>
            <div className="hidden lg:flex items-center space-x-4">
              <div className="bg-white rounded-lg px-4 py-2 shadow-sm border">
                <div className="flex items-center space-x-2">
                  <BuildingOfficeIcon className="h-5 w-5 text-blue-600" />
                  <span className="text-sm font-medium text-gray-700">{contratos.length} Contratos</span>
                </div>
              </div>
              <div className="bg-white rounded-lg px-4 py-2 shadow-sm border">
                <div className="flex items-center space-x-2">
                   <AcademicCapIcon className="h-5 w-5 text-green-600" />
                   <span className="text-sm font-medium text-gray-700">
                     {contratos.reduce((acc, c) => acc + c._count.matrizTreinamento, 0)} Treinamentos
                   </span>
                 </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filtros Modernos */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Busca */}
            <div className="flex-1">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por contrato, número ou cliente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
              </div>
            </div>
            
            {/* Filtro Status */}
            <div className="lg:w-48">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              >
                <option value="todos">Todos os Status</option>
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
                <option value="pendente">Pendente</option>
              </select>
            </div>
            
            {/* Filtro Cliente */}
            <div className="lg:w-48">
              <select
                value={clienteFilter}
                onChange={(e) => setClienteFilter(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              >
                <option value="todos">Todos os Clientes</option>
                {uniqueClientes.map(cliente => (
                  <option key={cliente} value={cliente}>{cliente}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Grid de Contratos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredContratos.map((contrato) => (
            <Link
              key={contrato.id}
              href={`/matriz-treinamento/contratos/${contrato.id}`}
              className="group"
            >
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-lg hover:border-blue-300 transition-all duration-300 overflow-hidden">
                {/* Header do Card */}
                <div className="p-6 border-b border-gray-100">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                        <BuildingOfficeIcon className="h-6 w-6 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2">
                          {contrato.nome}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">{contrato.numero}</p>
                      </div>
                    </div>
                    <ChevronRightIcon className="h-5 w-5 text-gray-400 group-hover:text-blue-600 transition-colors flex-shrink-0" />
                  </div>

                  {/* Status Badge */}
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(contrato.status)}`}>
                      {getStatusIcon(contrato.status)}
                      <span>{contrato.status || 'N/A'}</span>
                    </span>
                    <span className="text-sm font-medium text-gray-600">{contrato.cliente}</span>
                  </div>
                </div>

                {/* Conteúdo do Card */}
                <div className="p-6">
                  {/* Datas */}
                  <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
                    <div className="flex items-center space-x-1">
                      <CalendarIcon className="h-4 w-4" />
                      <span>Início: {formatDate(contrato.dataInicio)}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <CalendarIcon className="h-4 w-4" />
                      <span>Fim: {formatDate(contrato.dataFim)}</span>
                    </div>
                  </div>

                  {/* Estatísticas */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-center space-x-1 mb-1">
                        <UsersIcon className="h-4 w-4 text-gray-500" />
                        <span className="text-xs text-gray-500">Funções</span>
                      </div>
                      <span className="text-lg font-bold text-gray-900">{contrato.totalFuncoes}</span>
                    </div>
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-center justify-center space-x-1 mb-1">
                        <AcademicCapIcon className="h-4 w-4 text-blue-500" />
                        <span className="text-xs text-blue-500">Treinamentos</span>
                      </div>
                      <span className="text-lg font-bold text-blue-600">{contrato._count.matrizTreinamento}</span>
                    </div>
                  </div>

                  {/* Preview das Funções */}
                  {contrato.funcoes.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 mb-2 font-medium">Principais funções:</p>
                      <div className="space-y-1">
                        {contrato.funcoes.slice(0, 3).map((funcao) => (
                          <div key={funcao.id} className="flex items-center justify-between text-xs">
                            <span className="text-gray-700 truncate">{funcao.funcao}</span>
                            <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-medium">
                              {funcao._count.matrizTreinamento}
                            </span>
                          </div>
                        ))}
                        {contrato.totalFuncoes > 3 && (
                          <div className="text-xs text-gray-500 text-center pt-1">
                            +{contrato.totalFuncoes - 3} funções adicionais
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Estado Vazio */}
        {filteredContratos.length === 0 && !loading && (
          <div className="text-center py-16">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 max-w-md mx-auto">
              <BuildingOfficeIcon className="mx-auto h-16 w-16 text-gray-400 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {searchTerm || statusFilter !== 'todos' || clienteFilter !== 'todos' 
                  ? 'Nenhum contrato encontrado' 
                  : 'Nenhum contrato cadastrado'
                }
              </h3>
              <p className="text-gray-500 mb-6">
                {searchTerm || statusFilter !== 'todos' || clienteFilter !== 'todos'
                  ? 'Tente ajustar os filtros de busca.'
                  : 'Não há contratos cadastrados no sistema.'
                }
              </p>
              {(!searchTerm && statusFilter === 'todos' && clienteFilter === 'todos') && (
                <button className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                  <PlusIcon className="h-4 w-4" />
                  <span>Adicionar Contrato</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}