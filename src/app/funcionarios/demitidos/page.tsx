'use client';

import { useEffect, useState } from 'react';
import { getStatusColor } from '../../../utils/statusColors';
import { getStatusBorder } from '../../../utils/statusBorders';
import Link from 'next/link';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import ProtectedRoute from '@/components/ProtectedRoute';
import { ROUTE_PROTECTION } from '@/lib/permissions';

type Pessoa = {
  id: number;
  matricula: string;
  cpf: string;
  nome: string;
  funcao: string | null;
  rg: string | null;
  orgaoEmissor: string | null;
  uf: string | null;
  dataNascimento: string | null;
  email: string | null;
  telefone: string | null;
  centroCusto: string | null;
  departamento: string | null;
  status: string | null;
  statusPrestserv?: string | null;
  emMigracao?: boolean;
  dataCriacao: string | null;
  dataAtualizacao: string | null;
  dataExclusao: string | null;
};

// Função para formatar a data no formato brasileiro
function formatarDataBR(data: string) {
  return new Date(data).toLocaleDateString('pt-BR');
}

// Tipo para ordenação
type SortConfig = {
  key: keyof Pessoa | null;
  direction: 'asc' | 'desc';
};

export default function FuncionariosDemitidos() {
  return (
    <ProtectedRoute 
      requiredPermissions={ROUTE_PROTECTION.FUNCIONARIOS.requiredPermissions}
      requiredEquipe={ROUTE_PROTECTION.FUNCIONARIOS.requiredEquipe}
    >
      <FuncionariosDemitidosContent />
    </ProtectedRoute>
  );
}

function FuncionariosDemitidosContent() {
  const [dados, setDados] = useState<Pessoa[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPessoa, setSelectedPessoa] = useState<Pessoa | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: 'asc' });

  useEffect(() => {
    fetchDados();
  }, []);

  const fetchDados = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dados');
      if (!res.ok) throw new Error('Erro ao carregar dados');
      const data = await res.json();
      console.log('Dados recebidos da API:', data.length, 'registros');
      
      // Filtrar funcionários com status de demitido (várias variações)
      const funcionariosDemitidos = data.filter((pessoa: Pessoa) => {
        if (!pessoa.status) return false;
        
        const statusLower = pessoa.status.toLowerCase();
        const isDemitido = statusLower.includes('demitido') || 
                          statusLower.includes('demissão') || 
                          statusLower.includes('folha demitido') ||
                          statusLower.includes('desligado') ||
                          statusLower.includes('rescisão');
        
        if (isDemitido) {
          console.log('Funcionário demitido encontrado:', pessoa.nome, pessoa.status);
        }
        return isDemitido;
      });
      
      console.log('Funcionários demitidos filtrados:', funcionariosDemitidos.length);
      setDados(funcionariosDemitidos);
    } catch (error) {
      alert('Erro ao carregar dados');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Função para ordenar os dados
  const handleSort = (key: keyof Pessoa) => {
    let direction: 'asc' | 'desc' = 'asc';
    
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    } else if (sortConfig.key === key && sortConfig.direction === 'desc') {
      // Se clicar na mesma coluna pela terceira vez, remove a ordenação
      return setSortConfig({ key: null, direction: 'asc' });
    }
    
    setSortConfig({ key, direction });
    setCurrentPage(1); // Volta para a primeira página ao ordenar
  };

  // Função para filtrar dados
  const getFilteredData = () => {
    // Primeiro filtra os dados pela busca
    const filteredData = dados.filter(pessoa => {
      // Busca global
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm || 
        Object.values(pessoa).some(value => 
          value && value.toString().toLowerCase().includes(searchLower)
        );

      return matchesSearch;
    });
    
    // Adiciona propriedade de prioridade para funcionários que precisam de atenção
    const dataWithPriority = filteredData.map(pessoa => ({
      ...pessoa,
      needsAttention: pessoa.statusPrestserv?.toUpperCase() === 'ATIVO' || pessoa.emMigracao === true
    }));
    
    // Primeiro ordena por prioridade (funcionários que precisam de atenção no topo)
    const prioritySorted = dataWithPriority.sort((a, b) => {
      if (a.needsAttention && !b.needsAttention) return -1;
      if (!a.needsAttention && b.needsAttention) return 1;
      return 0;
    });
    
    // Depois aplica a ordenação personalizada se houver
    if (sortConfig.key) {
      return [...prioritySorted].sort((a, b) => {
        // Mantém a prioridade mesmo com ordenação personalizada
        if (a.needsAttention && !b.needsAttention) return -1;
        if (!a.needsAttention && b.needsAttention) return 1;
        
        const aValue = a[sortConfig.key as keyof Pessoa];
        const bValue = b[sortConfig.key as keyof Pessoa];
        
        // Tratamento para valores nulos
        if (aValue === null && bValue === null) return 0;
        if (aValue === null) return sortConfig.direction === 'asc' ? 1 : -1;
        if (bValue === null) return sortConfig.direction === 'asc' ? -1 : 1;
        
        // Comparação de strings (case insensitive)
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortConfig.direction === 'asc' 
            ? aValue.localeCompare(bValue, 'pt-BR', { sensitivity: 'base' })
            : bValue.localeCompare(aValue, 'pt-BR', { sensitivity: 'base' });
        }
        
        // Comparação de números
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
        }
        
        // Fallback para outros tipos
        return 0;
      });
    }
    
    return prioritySorted;
  };

  const filteredData = getFilteredData();
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentData = filteredData.slice(startIndex, endIndex);
  
  console.log('Debug tabela:', {
    dadosOriginais: dados.length,
    dadosFiltrados: filteredData.length,
    dadosAtuais: currentData.length,
    loading,
    searchTerm
  });

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (items: number) => {
    setItemsPerPage(items);
    setCurrentPage(1);
  };

  const handleViewDetails = (pessoa: Pessoa) => {
    setSelectedPessoa(pessoa);
    setShowDetails(true);
  };

  const getSortIcon = (key: keyof Pessoa) => {
    if (sortConfig.key !== key) {
      return '↕️'; // Ícone neutro
    }
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link 
                href="/funcionarios" 
                className="flex items-center text-gray-600 hover:text-gray-800 transition-colors"
              >
                <ArrowLeftIcon className="h-5 w-5 mr-2" />
                Voltar
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Funcionários Desligados</h1>
                <p className="text-gray-600 mt-1">
                  Lista de funcionários com status [Folha Desligado]
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Total de registros</p>
              <p className="text-2xl font-bold text-red-600">{filteredData.length}</p>
            </div>
          </div>
        </div>

        {/* Filtros e Busca */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Buscar funcionário
              </label>
              <input
                type="text"
                placeholder="Digite nome, matrícula, CPF..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  setSearchTerm('');
                  setCurrentPage(1);
                }}
                className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
              >
                Limpar
              </button>
            </div>
          </div>
        </div>

        {/* Tabela */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('matricula')}
                      >
                        Matrícula {getSortIcon('matricula')}
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('nome')}
                      >
                        Nome {getSortIcon('nome')}
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('funcao')}
                      >
                        Função {getSortIcon('funcao')}
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('centroCusto')}
                      >
                        Centro de Custo {getSortIcon('centroCusto')}
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('departamento')}
                      >
                        Departamento {getSortIcon('departamento')}
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('dataExclusao')}
                      >
                        Data Exclusão {getSortIcon('dataExclusao')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status Prestserv
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {currentData.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                          {loading ? (
                            <div className="flex justify-center items-center">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
                              Carregando dados...
                            </div>
                          ) : dados.length === 0 ? (
                            <div>
                              <p className="text-lg font-medium mb-2">Nenhum funcionário desligado encontrado</p>
                              <p className="text-sm">Não há funcionários com status [folha desligado] no sistema.</p>
                            </div>
                          ) : (
                            <div>
                              <p className="text-lg font-medium mb-2">Nenhum resultado encontrado</p>
                              <p className="text-sm">Tente ajustar os filtros de busca.</p>
                            </div>
                          )}
                        </td>
                      </tr>
                    ) : (
                      currentData.map((pessoa) => {
                         const needsAttention = pessoa.statusPrestserv?.toUpperCase() === 'ATIVO' || pessoa.emMigracao === true;
                         return (
                         <tr key={pessoa.id} className={`hover:bg-gray-50 ${
                           needsAttention ? 'bg-red-50 border-l-4 border-red-500' : ''
                         }`}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {pessoa.matricula}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {pessoa.nome}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {pessoa.funcao || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {pessoa.centroCusto || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {pessoa.departamento || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {pessoa.dataExclusao ? formatarDataBR(pessoa.dataExclusao) : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span 
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border-2 ${
                              getStatusColor(pessoa.status || '')
                            } ${
                              getStatusBorder(pessoa.status || '')
                            }`}
                          >
                            {pessoa.status || 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span 
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border-2 ${
                              getStatusColor(pessoa.statusPrestserv || '')
                            } ${
                              getStatusBorder(pessoa.statusPrestserv || '')
                            }`}
                          >
                            {pessoa.statusPrestserv || 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => handleViewDetails(pessoa)}
                            className="text-blue-600 hover:text-blue-900 transition-colors"
                          >
                            Ver detalhes
                          </button>
                        </td>
                      </tr>
                     );
                     }))}
                  </tbody>
                </table>
              </div>

              {/* Paginação */}
              {totalPages > 1 && (
                <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                  <div className="flex-1 flex justify-between sm:hidden">
                    <button
                      onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Anterior
                    </button>
                    <button
                      onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Próximo
                    </button>
                  </div>
                  <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div className="flex items-center space-x-2">
                      <p className="text-sm text-gray-700">
                        Mostrando <span className="font-medium">{startIndex + 1}</span> a{' '}
                        <span className="font-medium">{Math.min(endIndex, filteredData.length)}</span> de{' '}
                        <span className="font-medium">{filteredData.length}</span> resultados
                      </p>
                      <select
                        value={itemsPerPage}
                        onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                        className="ml-4 border border-gray-300 rounded-md px-2 py-1 text-sm"
                      >
                        <option value={10}>10 por página</option>
                        <option value={25}>25 por página</option>
                        <option value={50}>50 por página</option>
                        <option value={100}>100 por página</option>
                      </select>
                    </div>
                    <div>
                      <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                        <button
                          onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                          disabled={currentPage === 1}
                          className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Anterior
                        </button>
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNum;
                          if (totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i;
                          } else {
                            pageNum = currentPage - 2 + i;
                          }
                          
                          return (
                            <button
                              key={pageNum}
                              onClick={() => handlePageChange(pageNum)}
                              className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                currentPage === pageNum
                                  ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                                  : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                        <button
                          onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                          disabled={currentPage === totalPages}
                          className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Próximo
                        </button>
                      </nav>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal de Detalhes */}
      {showDetails && selectedPessoa && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">Detalhes do Funcionário</h3>
                <button
                  onClick={() => setShowDetails(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="sr-only">Fechar</span>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Matrícula</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedPessoa.matricula}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">CPF</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedPessoa.cpf}</p>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Nome</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedPessoa.nome}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Função</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedPessoa.funcao || '-'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">RG</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedPessoa.rg || '-'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Órgão Emissor</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedPessoa.orgaoEmissor || '-'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">UF</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedPessoa.uf || '-'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Data de Nascimento</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {selectedPessoa.dataNascimento ? formatarDataBR(selectedPessoa.dataNascimento) : '-'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedPessoa.email || '-'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Telefone</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedPessoa.telefone || '-'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Centro de Custo</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedPessoa.centroCusto || '-'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Departamento</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedPessoa.departamento || '-'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Status</label>
                  <p className="mt-1">
                    <span 
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border-2 ${
                        getStatusColor(selectedPessoa.status || '')
                      } ${
                        getStatusBorder(selectedPessoa.status || '')
                      }`}
                    >
                      {selectedPessoa.status || 'N/A'}
                    </span>
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Data de Exclusão</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {selectedPessoa.dataExclusao ? formatarDataBR(selectedPessoa.dataExclusao) : '-'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Data de Criação</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {selectedPessoa.dataCriacao ? formatarDataBR(selectedPessoa.dataCriacao) : '-'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Data de Atualização</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {selectedPessoa.dataAtualizacao ? formatarDataBR(selectedPessoa.dataAtualizacao) : '-'}
                  </p>
                </div>
              </div>
              
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowDetails(false)}
                  className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}