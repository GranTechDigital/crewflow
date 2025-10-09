'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  PlusIcon, 
  PencilIcon, 
  TrashIcon, 
  MagnifyingGlassIcon,
  AcademicCapIcon,
  XMarkIcon,
  CheckIcon
} from '@heroicons/react/24/outline';
import ProtectedRoute from '@/components/ProtectedRoute';
import { ROUTE_PROTECTION } from '@/lib/permissions';

interface Contrato {
  id: number;
  nome: string;
  numero: string;
  cliente: string;
}

interface Funcao {
  id: number;
  funcao: string;
  regime: string;
}

interface Treinamento {
  id: number;
  treinamento: string;
  cargaHoraria: number;
  validadeValor: number;
  validadeUnidade: string;
}

interface MatrizTreinamento {
  id: number;
  contratoId: number;
  funcaoId: number;
  treinamentoId: number;
  tipoObrigatoriedade: string;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
  contrato: Contrato;
  funcao: Funcao;
  treinamento: Treinamento;
}

interface TipoObrigatoriedade {
  value: string;
  label: string;
}

interface ApiResponse {
  success: boolean;
  data: MatrizTreinamento[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  filters: {
    contratos: Contrato[];
    funcoes: Funcao[];
    treinamentos: Treinamento[];
    tiposObrigatoriedade: TipoObrigatoriedade[];
  };
  message?: string;
}

export default function MatrizTreinamentoPage() {
  return (
    <ProtectedRoute 
      requiredPermissions={ROUTE_PROTECTION.MATRIZ_TREINAMENTO.requiredPermissions}
      requiredEquipe={ROUTE_PROTECTION.MATRIZ_TREINAMENTO.requiredEquipe}
    >
      <MatrizTreinamentoContent />
    </ProtectedRoute>
  );
}

function MatrizTreinamentoContent() {
  // Redirecionar para a nova estrutura organizada por contratos
  useEffect(() => {
    window.location.href = '/matriz-treinamento/contratos';
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Redirecionando...</p>
      </div>
    </div>
  );
}

function MatrizTreinamentoContentOld() {
  const [matrizes, setMatrizes] = useState<MatrizTreinamento[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [funcoes, setFuncoes] = useState<Funcao[]>([]);
  const [treinamentos, setTreinamentos] = useState<Treinamento[]>([]);
  const [tiposObrigatoriedade, setTiposObrigatoriedade] = useState<TipoObrigatoriedade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Estados para paginação e filtros
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [contratoFilter, setContratoFilter] = useState('');
  const [funcaoFilter, setFuncaoFilter] = useState('');
  const [treinamentoFilter, setTreinamentoFilter] = useState('');
  const [tipoObrigatoriedadeFilter, setTipoObrigatoriedadeFilter] = useState('');

  // Estados para modal
  const [showModal, setShowModal] = useState(false);
  const [editingMatriz, setEditingMatriz] = useState<MatrizTreinamento | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  // Estados do formulário
  const [formData, setFormData] = useState({
    contratoId: '',
    funcaoId: '',
    treinamentoId: '',
    tipoObrigatoriedade: '',
  });

  const fetchMatrizes = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '10',
      });

      if (searchTerm) params.append('search', searchTerm);
      if (contratoFilter) params.append('contratoId', contratoFilter);
      if (funcaoFilter) params.append('funcaoId', funcaoFilter);
      if (treinamentoFilter) params.append('treinamentoId', treinamentoFilter);
      if (tipoObrigatoriedadeFilter) params.append('tipoObrigatoriedade', tipoObrigatoriedadeFilter);

      const response = await fetch(`/api/matriz-treinamento?${params}`);
      const data: ApiResponse = await response.json();

      if (data.success) {
        setMatrizes(data.data);
        setTotalPages(data.pagination.totalPages);
        
        // Definir opções de filtro apenas na primeira carga
        if (currentPage === 1 && !searchTerm && !contratoFilter && !funcaoFilter && !treinamentoFilter && !tipoObrigatoriedadeFilter) {
          setContratos(data.filters.contratos);
          setFuncoes(data.filters.funcoes);
          setTreinamentos(data.filters.treinamentos);
          setTiposObrigatoriedade(data.filters.tiposObrigatoriedade);
        }
      } else {
        setError(data.message || 'Erro ao carregar matriz de treinamento');
      }
    } catch (error) {
      setError('Erro ao carregar matriz de treinamento');
      console.error('Erro:', error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchTerm, contratoFilter, funcaoFilter, treinamentoFilter, tipoObrigatoriedadeFilter]);

  useEffect(() => {
    fetchMatrizes();
  }, [fetchMatrizes]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalLoading(true);
    setError('');
    setSuccess('');

    try {
      const url = editingMatriz 
        ? `/api/matriz-treinamento/${editingMatriz.id}`
        : '/api/matriz-treinamento';
      
      const method = editingMatriz ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(data.message);
        setShowModal(false);
        setEditingMatriz(null);
        setFormData({
          contratoId: '',
          funcaoId: '',
          treinamentoId: '',
          tipoObrigatoriedade: '',
        });
        fetchMatrizes();
      } else {
        setError(data.message);
      }
    } catch (error) {
      setError('Erro ao salvar matriz de treinamento');
      console.error('Erro:', error);
    } finally {
      setModalLoading(false);
    }
  };

  const handleEdit = (matriz: MatrizTreinamento) => {
    setEditingMatriz(matriz);
    setFormData({
      contratoId: matriz.contratoId.toString(),
      funcaoId: matriz.funcaoId.toString(),
      treinamentoId: matriz.treinamentoId.toString(),
      tipoObrigatoriedade: matriz.tipoObrigatoriedade,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir esta entrada da matriz?')) {
      return;
    }

    try {
      const response = await fetch(`/api/matriz-treinamento/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(data.message);
        fetchMatrizes();
      } else {
        setError(data.message);
      }
    } catch (error) {
      setError('Erro ao excluir entrada da matriz');
      console.error('Erro:', error);
    }
  };

  const resetFilters = () => {
    setSearchTerm('');
    setContratoFilter('');
    setFuncaoFilter('');
    setTreinamentoFilter('');
    setTipoObrigatoriedadeFilter('');
    setCurrentPage(1);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingMatriz(null);
    setFormData({
      contratoId: '',
      funcaoId: '',
      treinamentoId: '',
      tipoObrigatoriedade: '',
    });
    setError('');
  };

  const getTipoObrigatoriedadeLabel = (tipo: string) => {
    const tipoObj = tiposObrigatoriedade.find(t => t.value === tipo);
    return tipoObj ? tipoObj.label : tipo;
  };

  const getTipoObrigatoriedadeBadgeColor = (tipo: string) => {
    switch (tipo) {
      case 'RA': return 'bg-red-100 text-red-800';
      case 'AP': return 'bg-orange-100 text-orange-800';
      case 'C': return 'bg-blue-100 text-blue-800';
      case 'SD': return 'bg-yellow-100 text-yellow-800';
      case 'N/A': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <AcademicCapIcon className="h-8 w-8 mr-3 text-blue-600" />
                Matriz de Treinamento
              </h1>
              <p className="mt-2 text-gray-600">
                Gerencie a relação entre contratos, funções e treinamentos
              </p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center transition-colors"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Nova Entrada
            </button>
          </div>
        </div>

        {/* Mensagens */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
            {success}
          </div>
        )}

        {/* Filtros */}
        <div className="bg-white rounded-lg shadow mb-6 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {/* Busca */}
            <div className="xl:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Buscar
              </label>
              <div className="relative">
                <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por contrato, função ou treinamento..."
                  className="pl-10 w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Filtro por Contrato */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contrato
              </label>
              <select
                value={contratoFilter}
                onChange={(e) => setContratoFilter(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Todos os contratos</option>
                {contratos.map((contrato) => (
                  <option key={contrato.id} value={contrato.id}>
                    {contrato.nome}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro por Função */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Função
              </label>
              <select
                value={funcaoFilter}
                onChange={(e) => setFuncaoFilter(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Todas as funções</option>
                {funcoes.map((funcao) => (
                  <option key={funcao.id} value={funcao.id}>
                    {funcao.funcao}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro por Treinamento */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Treinamento
              </label>
              <select
                value={treinamentoFilter}
                onChange={(e) => setTreinamentoFilter(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Todos os treinamentos</option>
                {treinamentos.map((treinamento) => (
                  <option key={treinamento.id} value={treinamento.id}>
                    {treinamento.treinamento}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro por Tipo de Obrigatoriedade */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo
              </label>
              <select
                value={tipoObrigatoriedadeFilter}
                onChange={(e) => setTipoObrigatoriedadeFilter(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Todos os tipos</option>
                {tiposObrigatoriedade.map((tipo) => (
                  <option key={tipo.value} value={tipo.value}>
                    {tipo.value} - {tipo.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Botão para limpar filtros */}
          <div className="mt-4 flex justify-end">
            <button
              onClick={resetFilters}
              className="text-gray-600 hover:text-gray-800 text-sm flex items-center"
            >
              <XMarkIcon className="h-4 w-4 mr-1" />
              Limpar filtros
            </button>
          </div>
        </div>

        {/* Tabela */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Carregando...</p>
            </div>
          ) : matrizes.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <AcademicCapIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>Nenhuma entrada encontrada na matriz de treinamento</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Contrato
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Função
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Treinamento
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tipo
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Carga Horária
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Validade
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {matrizes.map((matriz) => (
                      <tr key={matriz.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {matriz.contrato.nome}
                            </div>
                            <div className="text-sm text-gray-500">
                              {matriz.contrato.numero} - {matriz.contrato.cliente}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{matriz.funcao.funcao}</div>
                          {matriz.funcao.regime && (
                            <div className="text-sm text-gray-500">{matriz.funcao.regime}</div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">{matriz.treinamento.treinamento}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getTipoObrigatoriedadeBadgeColor(matriz.tipoObrigatoriedade)}`}>
                            {matriz.tipoObrigatoriedade}
                          </span>
                          <div className="text-xs text-gray-500 mt-1">
                            {getTipoObrigatoriedadeLabel(matriz.tipoObrigatoriedade)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {matriz.treinamento.cargaHoraria}h
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {matriz.treinamento.validadeValor} {matriz.treinamento.validadeUnidade}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => handleEdit(matriz)}
                            className="text-blue-600 hover:text-blue-900 mr-3"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(matriz.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Paginação */}
              {totalPages > 1 && (
                <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                  <div className="flex-1 flex justify-between sm:hidden">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Anterior
                    </button>
                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Próxima
                    </button>
                  </div>
                  <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-700">
                        Página <span className="font-medium">{currentPage}</span> de{' '}
                        <span className="font-medium">{totalPages}</span>
                      </p>
                    </div>
                    <div>
                      <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                        <button
                          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                          disabled={currentPage === 1}
                          className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Anterior
                        </button>
                        <button
                          onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                          disabled={currentPage === totalPages}
                          className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Próxima
                        </button>
                      </nav>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    {editingMatriz ? 'Editar Entrada' : 'Nova Entrada'}
                  </h3>
                  <button
                    onClick={closeModal}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                {error && (
                  <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Contrato */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Contrato *
                    </label>
                    <select
                      value={formData.contratoId}
                      onChange={(e) => setFormData({ ...formData, contratoId: e.target.value })}
                      required
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Selecione um contrato</option>
                      {contratos.map((contrato) => (
                        <option key={contrato.id} value={contrato.id}>
                          {contrato.nome} - {contrato.cliente}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Função */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Função *
                    </label>
                    <select
                      value={formData.funcaoId}
                      onChange={(e) => setFormData({ ...formData, funcaoId: e.target.value })}
                      required
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Selecione uma função</option>
                      {funcoes.map((funcao) => (
                        <option key={funcao.id} value={funcao.id}>
                          {funcao.funcao} {funcao.regime && `(${funcao.regime})`}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Treinamento */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Treinamento *
                    </label>
                    <select
                      value={formData.treinamentoId}
                      onChange={(e) => setFormData({ ...formData, treinamentoId: e.target.value })}
                      required
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Selecione um treinamento</option>
                      {treinamentos.map((treinamento) => (
                        <option key={treinamento.id} value={treinamento.id}>
                          {treinamento.treinamento} ({treinamento.cargaHoraria}h)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Tipo de Obrigatoriedade */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tipo de Obrigatoriedade *
                    </label>
                    <select
                      value={formData.tipoObrigatoriedade}
                      onChange={(e) => setFormData({ ...formData, tipoObrigatoriedade: e.target.value })}
                      required
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Selecione o tipo</option>
                      {tiposObrigatoriedade.map((tipo) => (
                        <option key={tipo.value} value={tipo.value}>
                          {tipo.value} - {tipo.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Botões */}
                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={modalLoading}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                    >
                      {modalLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Salvando...
                        </>
                      ) : (
                        <>
                          <CheckIcon className="h-4 w-4 mr-2" />
                          {editingMatriz ? 'Atualizar' : 'Criar'}
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}