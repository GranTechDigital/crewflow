'use client';

import { useEffect, useState } from 'react';
import { getStatusColor } from '../../utils/statusColors';
import { getStatusBorder } from '../../utils/statusBorders';
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
  dataCriacao: string | null;
  dataAtualizacao: string | null;
  dataExclusao: string | null;
};

type Filters = {
  status: string;
  departamento: string;
  centroCusto: string;
  funcao: string;
};

// ✅ Função para formatar a data no formato brasileiro
function formatarDataBR(data: string) {
  return new Date(data).toLocaleDateString('pt-BR');
}

// Tipo para ordenação
type SortConfig = {
  key: keyof Pessoa | null;
  direction: 'asc' | 'desc';
};

export default function Home() {
  const [dados, setDados] = useState<Pessoa[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<Filters>({
    status: '',
    departamento: '',
    centroCusto: '',
    funcao: '',
  });
  const [showFilters, setShowFilters] = useState(true);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [selectedPessoa, setSelectedPessoa] = useState<Pessoa | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedPessoa, setEditedPessoa] = useState<Pessoa | null>(null);
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
        setDados(data);
    } catch (error) {
      alert('Erro ao carregar dados');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dados/import', { method: 'POST' });
      if (!res.ok) throw new Error('Erro ao importar dados');
      alert('Dados importados com sucesso!');
      await fetchDados();
    } catch (error) {
      alert('Erro ao importar dados');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Tem certeza que deseja excluir todos os dados?')) return;
    setLoading(true);
    try {
      const res = await fetch('/api/dados/delete', { method: 'DELETE' });
      if (!res.ok) throw new Error('Erro ao excluir dados');
      alert('Dados excluídos com sucesso!');
      setDados([]);
    } catch (error) {
      alert('Erro ao excluir dados');
      console.error(error);
    } finally {
        setLoading(false);
    }
  };

  const handleSincronizar = async () => {
    setSyncLoading(true);
    setSyncMsg(null);
    setSyncError(null);

    const { syncWithRetry, formatSyncMessage } = await import('@/utils/syncUtils');

    const result = await syncWithRetry({
      maxRetries: 3,
      retryDelay: 2000,
      timeout: 60000,
      onProgress: (message) => {
        setSyncMsg(message);
      }
    });

    if (result.success) {
      setSyncMsg(formatSyncMessage(result.data));
      await fetchDados();
    } else {
      setSyncError(result.error || 'Erro na sincronização após todas as tentativas');
    }

    setSyncLoading(false);
  };

  // Função para filtrar dados
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
    // Primeiro filtra os dados
    const filteredData = dados.filter(pessoa => {
      // Busca global
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm || 
        Object.values(pessoa).some(value => 
          value && value.toString().toLowerCase().includes(searchLower)
        );

      // Filtros específicos
      const matchesStatus = !filters.status || 
        (pessoa.status && pessoa.status.toLowerCase() === filters.status.toLowerCase());
      const matchesDepartamento = !filters.departamento || pessoa.departamento === filters.departamento;
      const matchesCentroCusto = !filters.centroCusto || pessoa.centroCusto === filters.centroCusto;
      const matchesFuncao = !filters.funcao || pessoa.funcao === filters.funcao;

      return matchesSearch && matchesStatus && matchesDepartamento && matchesCentroCusto && matchesFuncao;
    });
    
    // Depois ordena os dados filtrados se houver uma configuração de ordenação
    if (sortConfig.key) {
      return [...filteredData].sort((a, b) => {
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
        
        // Comparação de datas
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          // Verifica se as strings são datas válidas
          const dateA = new Date(aValue);
          const dateB = new Date(bValue);
          if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
            return sortConfig.direction === 'asc' 
              ? dateA.getTime() - dateB.getTime() 
              : dateB.getTime() - dateA.getTime();
          }
        }
        
        // Comparação padrão para outros tipos
        const comparison = aValue > bValue ? 1 : -1;
        return sortConfig.direction === 'asc' ? comparison : -comparison;
      });
    }
    
    return filteredData;
  };

  const handleRowClick = (pessoa: Pessoa) => {
    setSelectedPessoa(pessoa);
    setShowDetails(true);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilters({
      status: '',
      departamento: '',
      centroCusto: '',
      funcao: '',
    });
  };

  const filteredData = getFilteredData();
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const dadosPagina = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin shadow-lg"></div>
      </div>
    );
  }

  return (
    <ProtectedRoute requiredPermissions={ROUTE_PROTECTION.LOGISTICA.requiredPermissions} requiredEquipe={ROUTE_PROTECTION.LOGISTICA.requiredEquipe}>
      <div className="p-1 max-w-full">
      {/* Barra de ações */}
      <div className="mb-2 flex flex-wrap items-center justify-between bg-white p-2 rounded-lg border border-gray-100 shadow-sm">
        <div className="flex gap-2">
          <button
            onClick={handleImport}
            disabled={loading}
            className="inline-flex items-center px-3 py-1.5 bg-white text-gray-700 rounded-md border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 text-sm font-medium"
          >
            <svg className="w-4 h-4 mr-1.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Importar
          </button>
          <button
            onClick={handleDelete}
            disabled={loading}
            className="inline-flex items-center px-3 py-1.5 bg-white text-gray-700 rounded-md border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 text-sm font-medium"
          >
            <svg className="w-4 h-4 mr-1.5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Excluir
          </button>
          <button
            onClick={handleSincronizar}
            disabled={syncLoading}
            className="inline-flex items-center px-3 py-1.5 bg-white text-gray-700 rounded-md border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 text-sm font-medium"
          >
            <svg className="w-4 h-4 mr-1.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {syncLoading ? 'Sincronizando...' : 'Sincronizar'}
          </button>
          <button
            onClick={() => setShowLegend(!showLegend)}
            className="inline-flex items-center px-3 py-1.5 bg-white text-gray-700 rounded-md border border-gray-200 hover:bg-gray-50 transition-all duration-200 text-sm font-medium"
          >
            <svg className="w-4 h-4 mr-1.5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Legenda
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={clearFilters}
            className="inline-flex items-center px-3 py-1.5 bg-white text-gray-700 rounded-md border border-gray-200 hover:bg-gray-50 transition-all duration-200 text-sm font-medium"
          >
            <svg className="w-4 h-4 mr-1.5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Limpar Filtros
          </button>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className="inline-flex items-center px-3 py-1.5 bg-white text-gray-700 rounded-md border border-gray-200 hover:bg-gray-50 transition-all duration-200 text-sm font-medium"
          >
            <svg className="w-4 h-4 mr-1.5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filtros
          </button>

          <div className="flex items-center gap-1.5">
            <label className="text-xs text-gray-500">Linhas:</label>
        <select
              className="bg-white border border-gray-200 rounded-md px-2 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200 text-sm"
          value={itemsPerPage}
          onChange={(e) => {
            setItemsPerPage(Number(e.target.value));
            setCurrentPage(1);
          }}
        >
              {[10, 25, 50, 100].map((value) => (
                <option key={value} value={value}>
                  {value}
            </option>
          ))}
        </select>
      </div>
        </div>
      </div>

      {/* Filtros */}
      {showFilters && (
        <div className="mb-2 p-2 bg-white rounded-lg border border-gray-100 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Buscar</label>
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar..."
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200 text-sm"
                />
                <svg className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 transform -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Status Folha</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="w-full bg-white border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200"
              >
                <option value="">Todos</option>
                {Array.from(new Set(dados.map(p => p.status).filter(Boolean))).map((status) => (
                  <option key={status || ''} value={status || ''}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Função</label>
              <select
                value={filters.funcao}
                onChange={(e) => setFilters(prev => ({ ...prev, funcao: e.target.value }))}
                className="w-full bg-white border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200"
              >
                <option value="">Todas</option>
                {Array.from(new Set(dados.map(p => p.funcao).filter(Boolean))).map((funcao) => (
                  <option key={funcao || ''} value={funcao || ''}>
                    {funcao}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Centro de Custo</label>
              <select
                value={filters.departamento}
                onChange={(e) => setFilters(prev => ({ ...prev, departamento: e.target.value }))}
                className="w-full bg-white border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200"
              >
                <option value="">Todos</option>
                {Array.from(new Set(dados.map(p => p.departamento).filter(Boolean))).map((depto) => (
                  <option key={depto || ''} value={depto || ''}>
                    {depto}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Nº Centro de Custo</label>
              <select
                value={filters.centroCusto}
                onChange={(e) => setFilters(prev => ({ ...prev, centroCusto: e.target.value }))}
                className="w-full bg-white border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200"
              >
                <option value="">Todos</option>
                {Array.from(new Set(dados.map(p => p.centroCusto).filter(Boolean))).map((cc) => (
                  <option key={cc || ''} value={cc || ''}>
                    {cc}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Legenda de Status */}
      {showLegend && (
        <div className="my-3 p-1 bg-white rounded-lg border border-gray-100 shadow-sm">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Legenda de Status Folha</h3>
          <div className="flex flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-full bg-emerald-100 border border-emerald-200"></span>
              <span className="text-gray-600">Ativo</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-full bg-red-100 border border-red-200"></span>
              <span className="text-gray-600">Inativo</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-full bg-amber-100 border border-amber-200"></span>
              <span className="text-gray-600">Afastado</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-full bg-blue-100 border border-blue-200"></span>
              <span className="text-gray-600">Férias</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-full bg-slate-100 border border-slate-200"></span>
              <span className="text-gray-600">Demitido</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-full bg-purple-100 border border-purple-200"></span>
              <span className="text-gray-600">Admissão Próx. Mês</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-full bg-gray-100 border border-gray-200"></span>
              <span className="text-gray-600">Outros</span>
            </div>
          </div>
        </div>
      )}


      {/* Mensagens de sincronização */}
      {syncMsg && (
        <div className="mb-4 p-3 bg-green-50 border border-green-100 rounded-lg">
          <p className="text-green-700 text-sm">{syncMsg}</p>
        </div>
      )}
      {syncError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg">
          <p className="text-red-700 text-sm">{syncError}</p>
        </div>
      )}

      {/* Tabela */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-100">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr className="bg-gray-50">
                <th 
                  scope="col" 
                  className="px-0.5 py-0.5 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 group"
                  onClick={() => handleSort('matricula')}
                >
                  <div className="flex items-center">
                    Matrícula
                    {sortConfig.key === 'matricula' && (
                      <span className="ml-1">
                        {sortConfig.direction === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                    {sortConfig.key !== 'matricula' && (
                      <span className="ml-1 opacity-0 group-hover:opacity-30">↕</span>
                    )}
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="px-0.5 py-0.5 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 group"
                  onClick={() => handleSort('nome')}
                >
                  <div className="flex items-center">
                    Nome
                    {sortConfig.key === 'nome' && (
                      <span className="ml-1">
                        {sortConfig.direction === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                    {sortConfig.key !== 'nome' && (
                      <span className="ml-1 opacity-0 group-hover:opacity-30">↕</span>
                    )}
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="px-0.5 py-0.5 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 group"
                  onClick={() => handleSort('funcao')}
                >
                  <div className="flex items-center">
                    Função
                    {sortConfig.key === 'funcao' && (
                      <span className="ml-1">
                        {sortConfig.direction === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                    {sortConfig.key !== 'funcao' && (
                      <span className="ml-1 opacity-0 group-hover:opacity-30">↕</span>
                    )}
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="px-0.5 py-0.5 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 group"
                  onClick={() => handleSort('departamento')}
                >
                  <div className="flex items-center">
                    Centro de Custo
                    {sortConfig.key === 'departamento' && (
                      <span className="ml-1">
                        {sortConfig.direction === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                    {sortConfig.key !== 'departamento' && (
                      <span className="ml-1 opacity-0 group-hover:opacity-30">↕</span>
                    )}
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="px-0.5 py-0.5 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 group"
                  onClick={() => handleSort('centroCusto')}
                >
                  <div className="flex items-center">
                    Nº Centro de Custo
                    {sortConfig.key === 'centroCusto' && (
                      <span className="ml-1">
                        {sortConfig.direction === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                    {sortConfig.key !== 'centroCusto' && (
                      <span className="ml-1 opacity-0 group-hover:opacity-30">↕</span>
                    )}
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="px-0.5 py-0.5 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 group"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center">
                    Status Folha
                    {sortConfig.key === 'status' && (
                      <span className="ml-1">
                        {sortConfig.direction === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                    {sortConfig.key !== 'status' && (
                      <span className="ml-1 opacity-0 group-hover:opacity-30">↕</span>
                    )}
                  </div>
                </th>
            </tr>
          </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {dadosPagina.map((pessoa) => (
                <tr
                  key={pessoa.matricula}
                  className={`hover:bg-gray-50 cursor-pointer transition-colors duration-150 ${getStatusBorder(pessoa.status || undefined)}`}
                  onClick={() => handleRowClick(pessoa)}
                >
                  <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-900">{pessoa.matricula}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-900">{pessoa.nome}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-900">{pessoa.funcao}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-900">{pessoa.departamento}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-900">{pessoa.centroCusto}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-xs">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[11px] font-medium ${getStatusColor(pessoa.status || undefined, 'default')}`}>
                      {pessoa.status}
                    </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* Paginação */}
      <div className="mt-2 mb-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">
            {filteredData.length} registro{filteredData.length !== 1 ? 's' : ''} encontrado{filteredData.length !== 1 ? 's' : ''}
        </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 text-sm text-gray-700 shadow-sm hover:shadow"
          >
            Anterior
          </button>
          <span className="text-sm text-gray-600">
            Página {currentPage} de {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 text-sm text-gray-700 shadow-sm hover:shadow"
          >
            Próxima
          </button>
        </div>
      </div>

      
      {/* Modal de Detalhes */}
      {showDetails && selectedPessoa && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-gray-800">Detalhes do Funcionário</h2>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedPessoa.status || undefined, 'modal')}`}>
                  {selectedPessoa.status}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setIsEditing(true);
                    setEditedPessoa(selectedPessoa);
                  }}
                  disabled={true}
                  className="inline-flex items-center px-2.5 py-1.5 bg-white text-gray-700 rounded-md border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 text-sm font-medium"
                >
                  <svg className="w-4 h-4 mr-1.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Editar
                </button>
                <button
                  onClick={() => {
                    setShowDetails(false);
                    setIsEditing(false);
                    setEditedPessoa(null);
                  }}
                  className="inline-flex items-center justify-center w-8 h-8 text-gray-400 hover:text-gray-500 rounded-md hover:bg-gray-100 transition-colors duration-200"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(isEditing ? editedPessoa! : selectedPessoa).map(([key, value]) => {
                  if (key === 'id' || key === 'dataCriacao' || key === 'dataAtualizacao' || key === 'dataExclusao') return null;
                  
                  return (
                    <div key={key} className="bg-gray-50 rounded-md p-2.5">
                      <p className="text-xs font-medium text-gray-500 mb-1">
                        {key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}
                      </p>
                      {isEditing ? (
                        <input
                          type={key === 'dataNascimento' ? 'date' : 'text'}
                          value={value || ''}
                          onChange={(e) => setEditedPessoa(prev => prev ? {
                            ...prev,
                            [key]: e.target.value
                          } : null)}
                          className="w-full px-2 py-1 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        />
                      ) : (
                        <p className="text-sm text-gray-900">
                          {key === 'dataNascimento' ? (
                            value ? formatarDataBR(value as string) : '-'
                          ) : (
                            value || '-'
                          )}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Histórico de Alterações */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Histórico de Alterações</h3>
                <div className="space-y-2">
                  {selectedPessoa.dataCriacao && (
                    <div className="flex items-center gap-2 text-sm">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-gray-500">Criado em:</span>
                      <span className="text-gray-900">{formatarDataBR(selectedPessoa.dataCriacao)}</span>
                    </div>
                  )}
                  {selectedPessoa.dataAtualizacao && (
                    <div className="flex items-center gap-2 text-sm">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span className="text-gray-500">Última atualização:</span>
                      <span className="text-gray-900">{formatarDataBR(selectedPessoa.dataAtualizacao)}</span>
                    </div>
                  )}
                  {selectedPessoa.dataExclusao && (
                    <div className="flex items-center gap-2 text-sm">
                      <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      <span className="text-red-500 font-medium">Excluído em:</span>
                      <span className="text-red-600">{formatarDataBR(selectedPessoa.dataExclusao)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </ProtectedRoute>
  );
}
