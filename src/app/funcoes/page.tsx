'use client';

import React, { useState, useEffect } from 'react';

interface Funcao {
  id: number;
  criadoEm: string;
  funcao: string;
  regime: string;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function FuncoesPage() {
  const [funcoes, setFuncoes] = useState<Funcao[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const [regimes, setRegimes] = useState<string[]>([]);
  
  // Filtros
  const [search, setSearch] = useState('');
  const [regimeFilter, setRegimeFilter] = useState('');
  
  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingFuncao, setEditingFuncao] = useState<Funcao | null>(null);
  
  // Form states
  const [formData, setFormData] = useState({
    funcao: '',
    regime: '',
  });

  // Toast function
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    alert(`${type.toUpperCase()}: ${message}`);
  };

  // Carregar funções
  const carregarFuncoes = async (page = 1) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
      });

      if (search) params.append('search', search);
      if (regimeFilter) params.append('regime', regimeFilter);

      const response = await fetch(`/api/funcoes?${params}`);
      const data = await response.json();

      if (data.success) {
        setFuncoes(data.data);
        setPagination(data.pagination);
        setRegimes(data.regimes);
      } else {
        showToast(data.message || 'Erro ao carregar funções', 'error');
      }
    } catch (error) {
      console.error('Erro ao carregar funções:', error);
      showToast('Erro ao carregar funções', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Sincronizar funções
  const sincronizarFuncoes = async () => {
    try {
      setLoading(true);
      showToast('Iniciando sincronização...', 'info');

      const response = await fetch('/api/dados/sincronizar-funcoes', {
        method: 'POST',
      });

      let data: any = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        const msg = data?.error || data?.message || `Erro na sincronização (status ${response.status})`;
        showToast(msg, 'error');
        return;
      }

      const novas = data?.novasFuncoesInseridas ?? data?.dados?.novasFuncoes ?? 0;
      showToast(`Sincronização concluída: ${novas} novas funções adicionadas`, 'success');
      carregarFuncoes();
    } catch (error) {
      console.error('Erro na sincronização:', error);
      showToast('Erro na sincronização', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Criar função
  const criarFuncao = async () => {
    try {
      const response = await fetch('/api/funcoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await response.json();

      if (data.success) {
        showToast('Função criada com sucesso', 'success');
        setIsCreateModalOpen(false);
        setFormData({ funcao: '', regime: '' });
        carregarFuncoes();
      } else {
        showToast(data.message || 'Erro ao criar função', 'error');
      }
    } catch (error) {
      console.error('Erro ao criar função:', error);
      showToast('Erro ao criar função', 'error');
    }
  };

  // Atualizar função
  const atualizarFuncao = async () => {
    if (!editingFuncao) return;

    try {
      const response = await fetch(`/api/funcoes/${editingFuncao.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await response.json();

      if (data.success) {
        showToast('Função atualizada com sucesso', 'success');
        setIsEditModalOpen(false);
        setEditingFuncao(null);
        setFormData({ funcao: '', regime: '' });
        carregarFuncoes();
      } else {
        showToast(data.message || 'Erro ao atualizar função', 'error');
      }
    } catch (error) {
      console.error('Erro ao atualizar função:', error);
      showToast('Erro ao atualizar função', 'error');
    }
  };

  // Excluir função
  const excluirFuncao = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir esta função?')) return;

    try {
      const response = await fetch(`/api/funcoes/${id}`, {
        method: 'DELETE',
      });
      const data = await response.json();

      if (data.success) {
        showToast('Função excluída com sucesso', 'success');
        carregarFuncoes();
      } else {
        showToast(data.message || 'Erro ao excluir função', 'error');
      }
    } catch (error) {
      console.error('Erro ao excluir função:', error);
      showToast('Erro ao excluir função', 'error');
    }
  };

  // Abrir modal de edição
  const abrirEdicao = (funcao: Funcao) => {
    setEditingFuncao(funcao);
    setFormData({
      funcao: funcao.funcao,
      regime: funcao.regime,
    });
    setIsEditModalOpen(true);
  };

  // Limpar filtros
  const limparFiltros = () => {
    setSearch('');
    setRegimeFilter('');
  };

  // Effects
  useEffect(() => {
    carregarFuncoes();
  }, [search, regimeFilter]);

  const getRegimeBadgeColor = (regime: string) => {
    return regime === 'OFFSHORE' ? 'bg-blue-500 text-white' : 'bg-green-500 text-white';
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Gerenciamento de Funções</h1>
          <p className="text-gray-600">
            Gerencie as funções e regimes dos funcionários
          </p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={sincronizarFuncoes} 
            disabled={loading}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            {loading ? '🔄' : '🔄'} Sincronizar
          </button>
          <button 
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            ➕ Nova Função
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold mb-4">🔍 Filtros</h3>
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
              Buscar Função
            </label>
            <input
              id="search"
              type="text"
              placeholder="Digite o nome da função..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="w-48">
            <label htmlFor="regime-filter" className="block text-sm font-medium text-gray-700 mb-1">
              Regime
            </label>
            <select 
              value={regimeFilter} 
              onChange={(e) => setRegimeFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos os regimes</option>
              {regimes.map((regime) => (
                <option key={regime} value={regime}>
                  {regime}
                </option>
              ))}
            </select>
          </div>
          <button 
            onClick={limparFiltros}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            ❌ Limpar
          </button>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="text-lg font-semibold">
            Funções ({pagination.total} total)
          </h3>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="text-lg">🔄 Carregando...</div>
            </div>
          ) : (
            <>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Função
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Regime
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Criado em
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {funcoes.map((funcao) => (
                    <tr key={funcao.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {funcao.id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {funcao.funcao}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRegimeBadgeColor(funcao.regime)}`}>
                          {funcao.regime}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(funcao.criadoEm).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => abrirEdicao(funcao)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => excluirFuncao(funcao.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Paginação */}
              {pagination.totalPages > 1 && (
                <div className="flex justify-center gap-2 p-4">
                  <button
                    disabled={pagination.page === 1}
                    onClick={() => carregarFuncoes(pagination.page - 1)}
                    className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50"
                  >
                    Anterior
                  </button>
                  <span className="flex items-center px-4">
                    Página {pagination.page} de {pagination.totalPages}
                  </span>
                  <button
                    disabled={pagination.page === pagination.totalPages}
                    onClick={() => carregarFuncoes(pagination.page + 1)}
                    className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50"
                  >
                    Próxima
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal de Criação */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h2 className="text-xl font-bold mb-4">Criar Nova Função</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="funcao" className="block text-sm font-medium text-gray-700 mb-1">
                  Função
                </label>
                <input
                  id="funcao"
                  type="text"
                  value={formData.funcao}
                  onChange={(e) => setFormData({ ...formData, funcao: e.target.value })}
                  placeholder="Nome da função"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="regime" className="block text-sm font-medium text-gray-700 mb-1">
                  Regime
                </label>
                <select
                  value={formData.regime}
                  onChange={(e) => setFormData({ ...formData, regime: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecione o regime</option>
                  <option value="ONSHORE">ONSHORE</option>
                  <option value="OFFSHORE">OFFSHORE</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button 
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button 
                  onClick={criarFuncao}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Criar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edição */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h2 className="text-xl font-bold mb-4">Editar Função</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="edit-funcao" className="block text-sm font-medium text-gray-700 mb-1">
                  Função
                </label>
                <input
                  id="edit-funcao"
                  type="text"
                  value={formData.funcao}
                  onChange={(e) => setFormData({ ...formData, funcao: e.target.value })}
                  placeholder="Nome da função"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="edit-regime" className="block text-sm font-medium text-gray-700 mb-1">
                  Regime
                </label>
                <select
                  value={formData.regime}
                  onChange={(e) => setFormData({ ...formData, regime: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecione o regime</option>
                  <option value="ONSHORE">ONSHORE</option>
                  <option value="OFFSHORE">OFFSHORE</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button 
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button 
                  onClick={atualizarFuncao}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}