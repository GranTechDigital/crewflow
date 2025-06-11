'use client';

import { useEffect, useState } from 'react';

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
  const [showFilters, setShowFilters] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [selectedPessoa, setSelectedPessoa] = useState<Pessoa | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedPessoa, setEditedPessoa] = useState<Pessoa | null>(null);

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

    try {
      const res = await fetch('/api/dados/sincronizar', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        setSyncError(data.error || 'Erro desconhecido na sincronização');
      } else {
        setSyncMsg(`Sincronização concluída: ${data.demitidos} funcionários demitidos, ${data.adicionados} funcionários adicionados.`);
        await fetchDados();
      }
    } catch (error) {
      setSyncError('Erro ao conectar com o servidor');
      console.error(error);
    } finally {
      setSyncLoading(false);
    }
  };

  // Função para filtrar dados
  const getFilteredData = () => {
    return dados.filter(pessoa => {
      // Busca global
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm || 
        Object.values(pessoa).some(value => 
          value && value.toString().toLowerCase().includes(searchLower)
        );

      // Filtros específicos
      const matchesStatus = !filters.status || pessoa.status === filters.status;
      const matchesDepartamento = !filters.departamento || pessoa.departamento === filters.departamento;
      const matchesCentroCusto = !filters.centroCusto || pessoa.centroCusto === filters.centroCusto;
      const matchesFuncao = !filters.funcao || pessoa.funcao === filters.funcao;

      return matchesSearch && matchesStatus && matchesDepartamento && matchesCentroCusto && matchesFuncao;
    });
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
    <div className="p-1 max-w-full">
      {/* Barra de ações */}
      <div className="mb-3 flex flex-wrap items-center justify-between bg-white p-2 rounded-lg border border-gray-100 shadow-sm">
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
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar..."
              className="pl-8 pr-3 py-1.5 bg-white border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200 w-56 text-sm"
            />
            <svg className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 transform -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

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
        <div className="mb-3 p-3 bg-white rounded-lg border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-700">Filtros</h3>
            <button
              onClick={clearFilters}
              className="inline-flex items-center px-2 py-1 text-xs text-gray-500 hover:text-gray-700 transition-colors duration-200"
            >
              <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Limpar Filtros
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="w-full bg-white border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200"
              >
                <option value="">Todos</option>
                <option value="Ativo">Ativo</option>
                <option value="Inativo">Inativo</option>
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
              <label className="block text-xs font-medium text-gray-500 mb-1">Departamento</label>
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
              <label className="block text-xs font-medium text-gray-500 mb-1">Centro de Custo</label>
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
                <th scope="col" className="px-0.5 py-0.5 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                  Matrícula
                </th>
                <th scope="col" className="px-0.5 py-0.5 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                  Nome
                </th>
                <th scope="col" className="px-0.5 py-0.5 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                  Função
                </th>
                <th scope="col" className="px-0.5 py-0.5 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                  Departamento
                </th>
                <th scope="col" className="px-0.5 py-0.5 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                  Centro de Custo
                </th>
                <th scope="col" className="px-0.5 py-0.5 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {dadosPagina.map((pessoa) => (
                <tr
                  key={pessoa.matricula}
                  className={`hover:bg-gray-50 cursor-pointer transition-colors duration-150 ${
                    pessoa.status?.toLowerCase() === 'ativo' 
                      ? 'border-l-4 border-l-emerald-500' 
                      : pessoa.status?.toLowerCase() === 'inativo'
                      ? 'border-l-4 border-l-red-500'
                      : pessoa.status?.toLowerCase() === 'afastado'
                      ? 'border-l-4 border-l-amber-500'
                      : pessoa.status?.toLowerCase() === 'férias'
                      ? 'border-l-4 border-l-blue-500'
                      : 'border-l-4 border-l-gray-500'
                  }`}
                  onClick={() => handleRowClick(pessoa)}
                >
                  <td className="px-2 py-1.5 whitespace-nowrap text-sm text-gray-900">{pessoa.matricula}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-sm text-gray-900">{pessoa.nome}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-sm text-gray-900">{pessoa.funcao}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-sm text-gray-900">{pessoa.departamento}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-sm text-gray-900">{pessoa.centroCusto}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-sm">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[11px] font-medium ${
                      pessoa.status?.toLowerCase() === 'ativo' 
                        ? 'bg-emerald-100 text-emerald-800' 
                        : pessoa.status?.toLowerCase() === 'inativo'
                        ? 'bg-red-100 text-red-800'
                        : pessoa.status?.toLowerCase() === 'afastado'
                        ? 'bg-amber-100 text-amber-800'
                        : pessoa.status?.toLowerCase() === 'férias'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
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
      <div className="mt-4 flex items-center justify-between">
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
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  selectedPessoa.status?.toLowerCase() === 'ativo' 
                    ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20'
                    : selectedPessoa.status?.toLowerCase() === 'inativo'
                    ? 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20'
                    : selectedPessoa.status?.toLowerCase() === 'afastado'
                    ? 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20'
                    : selectedPessoa.status?.toLowerCase() === 'férias'
                    ? 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20'
                    : 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20'
                }`}>
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
  );
}
