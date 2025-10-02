'use client';

import { useState, useEffect } from 'react';

interface Treinamento {
  id: number;
  treinamento: string;
  cargaHoraria: number;
  validadeValor: number;
  validadeUnidade: string;
  criadoEm: string;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function TreinamentosPage() {
  const [treinamentos, setTreinamentos] = useState<Treinamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUnidade, setSelectedUnidade] = useState('');
  const [unidadesValidade, setUnidadesValidade] = useState<string[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  // Estados para modais
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedTreinamento, setSelectedTreinamento] = useState<Treinamento | null>(null);

  // Estados para formulário
  const [formData, setFormData] = useState({
    treinamento: '',
    cargaHoraria: '',
    validadeValor: '',
    validadeUnidade: 'mes',
  });

  // Estados para mensagens
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');

  // Carregar treinamentos
  const carregarTreinamentos = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      if (searchTerm) params.append('search', searchTerm);
      if (selectedUnidade) params.append('validadeUnidade', selectedUnidade);

      const response = await fetch(`/api/treinamentos?${params}`);
      const data = await response.json();

      if (data.success) {
        setTreinamentos(data.data);
        setPagination(data.pagination);
        setUnidadesValidade(data.unidadesValidade);
      } else {
        showMessage(data.message, 'error');
      }
    } catch (error) {
      showMessage('Erro ao carregar treinamentos', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Buscar treinamentos
  const buscarTreinamentos = async () => {
    setPagination(prev => ({ ...prev, page: 1 }));
    await carregarTreinamentos();
  };

  // Criar treinamento
  const criarTreinamento = async () => {
    try {
      const response = await fetch('/api/treinamentos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          treinamento: formData.treinamento,
          cargaHoraria: parseInt(formData.cargaHoraria),
          validadeValor: parseInt(formData.validadeValor),
          validadeUnidade: formData.validadeUnidade,
        }),
      });

      const data = await response.json();

      if (data.success) {
        showMessage('Treinamento criado com sucesso!', 'success');
        setShowCreateModal(false);
        resetForm();
        carregarTreinamentos();
      } else {
        showMessage(data.message, 'error');
      }
    } catch (error) {
      showMessage('Erro ao criar treinamento', 'error');
    }
  };

  // Atualizar treinamento
  const atualizarTreinamento = async () => {
    if (!selectedTreinamento) return;

    try {
      const response = await fetch(`/api/treinamentos/${selectedTreinamento.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          treinamento: formData.treinamento,
          cargaHoraria: parseInt(formData.cargaHoraria),
          validadeValor: parseInt(formData.validadeValor),
          validadeUnidade: formData.validadeUnidade,
        }),
      });

      const data = await response.json();

      if (data.success) {
        showMessage('Treinamento atualizado com sucesso!', 'success');
        setShowEditModal(false);
        resetForm();
        carregarTreinamentos();
      } else {
        showMessage(data.message, 'error');
      }
    } catch (error) {
      showMessage('Erro ao atualizar treinamento', 'error');
    }
  };

  // Excluir treinamento
  const excluirTreinamento = async () => {
    if (!selectedTreinamento) return;

    try {
      const response = await fetch(`/api/treinamentos/${selectedTreinamento.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        showMessage('Treinamento excluído com sucesso!', 'success');
        setShowDeleteModal(false);
        carregarTreinamentos();
      } else {
        showMessage(data.message, 'error');
      }
    } catch (error) {
      showMessage('Erro ao excluir treinamento', 'error');
    }
  };

  // Funções auxiliares
  const showMessage = (msg: string, type: 'success' | 'error') => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(''), 5000);
  };

  const resetForm = () => {
    setFormData({
      treinamento: '',
      cargaHoraria: '',
      validadeValor: '',
      validadeUnidade: 'mes',
    });
  };

  const openEditModal = (treinamento: Treinamento) => {
    setSelectedTreinamento(treinamento);
    setFormData({
      treinamento: treinamento.treinamento,
      cargaHoraria: treinamento.cargaHoraria.toString(),
      validadeValor: treinamento.validadeValor.toString(),
      validadeUnidade: treinamento.validadeUnidade,
    });
    setShowEditModal(true);
  };

  const openDeleteModal = (treinamento: Treinamento) => {
    setSelectedTreinamento(treinamento);
    setShowDeleteModal(true);
  };

  const formatValidadeUnidade = (unidade: string) => {
    const unidades: { [key: string]: string } = {
      'mes': 'Mês(es)',
      'ano': 'Ano(s)',
      'unico': 'Único',
    };
    return unidades[unidade] || unidade;
  };

  // Carregar dados iniciais
  useEffect(() => {
    carregarTreinamentos();
  }, [pagination.page]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Gerenciar Treinamentos</h1>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Novo Treinamento
          </button>
        </div>

        {/* Mensagem */}
        {message && (
          <div className={`mb-4 p-4 rounded-lg ${
            messageType === 'success' 
              ? 'bg-green-100 border border-green-400 text-green-700' 
              : 'bg-red-100 border border-red-400 text-red-700'
          }`}>
            {message}
          </div>
        )}

        {/* Filtros */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Buscar por nome
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Digite o nome do treinamento..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Unidade de Validade
            </label>
            <select
              value={selectedUnidade}
              onChange={(e) => setSelectedUnidade(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Todas as unidades</option>
              {unidadesValidade.map((unidade) => (
                <option key={unidade} value={unidade}>
                  {formatValidadeUnidade(unidade)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={buscarTreinamentos}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Buscar
            </button>
          </div>
        </div>

        {/* Tabela */}
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Treinamento
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Carga Horária
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Validade
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Criado em
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center">
                    Carregando...
                  </td>
                </tr>
              ) : treinamentos.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                    Nenhum treinamento encontrado
                  </td>
                </tr>
              ) : (
                treinamentos.map((treinamento) => (
                  <tr key={treinamento.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {treinamento.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {treinamento.treinamento}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {treinamento.cargaHoraria}h
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {treinamento.validadeValor === 0 
                        ? 'Único' 
                        : `${treinamento.validadeValor} ${formatValidadeUnidade(treinamento.validadeUnidade)}`
                      }
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(treinamento.criadoEm).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => openEditModal(treinamento)}
                        className="text-blue-600 hover:text-blue-900 mr-4"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => openDeleteModal(treinamento)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        {pagination.totalPages > 1 && (
          <div className="mt-6 flex justify-between items-center">
            <div className="text-sm text-gray-700">
              Mostrando {((pagination.page - 1) * pagination.limit) + 1} a{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} de{' '}
              {pagination.total} registros
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={pagination.page === 1}
                className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Anterior
              </button>
              <span className="px-3 py-1 bg-blue-600 text-white rounded">
                {pagination.page}
              </span>
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page === pagination.totalPages}
                className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Criar */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Novo Treinamento</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome do Treinamento *
                </label>
                <input
                  type="text"
                  value={formData.treinamento}
                  onChange={(e) => setFormData({ ...formData, treinamento: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: NR 10 BÁSICO"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Carga Horária (horas) *
                </label>
                <input
                  type="number"
                  value={formData.cargaHoraria}
                  onChange={(e) => setFormData({ ...formData, cargaHoraria: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: 480"
                  min="1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Valor de Validade *
                </label>
                <input
                  type="number"
                  value={formData.validadeValor}
                  onChange={(e) => setFormData({ ...formData, validadeValor: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: 24 (0 para único)"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Unidade de Validade *
                </label>
                <select
                  value={formData.validadeUnidade}
                  onChange={(e) => setFormData({ ...formData, validadeUnidade: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="mes">Mês(es)</option>
                  <option value="ano">Ano(s)</option>
                  <option value="unico">Único</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={criarTreinamento}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Criar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Editar Treinamento</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome do Treinamento *
                </label>
                <input
                  type="text"
                  value={formData.treinamento}
                  onChange={(e) => setFormData({ ...formData, treinamento: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Carga Horária (horas) *
                </label>
                <input
                  type="number"
                  value={formData.cargaHoraria}
                  onChange={(e) => setFormData({ ...formData, cargaHoraria: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Valor de Validade *
                </label>
                <input
                  type="number"
                  value={formData.validadeValor}
                  onChange={(e) => setFormData({ ...formData, validadeValor: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Unidade de Validade *
                </label>
                <select
                  value={formData.validadeUnidade}
                  onChange={(e) => setFormData({ ...formData, validadeUnidade: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="mes">Mês(es)</option>
                  <option value="ano">Ano(s)</option>
                  <option value="unico">Único</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  resetForm();
                }}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={atualizarTreinamento}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Atualizar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Excluir */}
      {showDeleteModal && selectedTreinamento && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Confirmar Exclusão</h2>
            <p className="text-gray-600 mb-6">
              Tem certeza que deseja excluir o treinamento "{selectedTreinamento.treinamento}"?
              Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={excluirTreinamento}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}