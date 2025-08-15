
'use client';

import { useState, useEffect } from 'react';
import { PlusIcon, PencilIcon, TrashIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useToast } from '@/components/Toast';
import ProtectedRoute from '@/components/ProtectedRoute';
import { ROUTE_PROTECTION } from '@/lib/permissions';

interface TarefaPadrao {
  id: number;
  setor: string;
  tipo: string;
  descricao: string;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
}

interface FormData {
  setor: string;
  tipo: string;
  descricao: string;
  ativo: boolean;
}

const SETORES_VALIDOS = ['RH', 'MEDICINA', 'TREINAMENTO'];

export default function TarefasPadraoAdminPage() {
  return (
    <ProtectedRoute 
      requiredPermissions={ROUTE_PROTECTION.ADMIN.requiredPermissions}
      requiredEquipe={ROUTE_PROTECTION.ADMIN.requiredEquipe}
    >
      <TarefasPadraoAdminContent />
    </ProtectedRoute>
  );
}

function TarefasPadraoAdminContent() {
  const { showToast } = useToast();
  const [tarefas, setTarefas] = useState<TarefaPadrao[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTarefa, setEditingTarefa] = useState<TarefaPadrao | null>(null);
  const [search, setSearch] = useState('');
  const [selectedSetor, setSelectedSetor] = useState('');
  const [formData, setFormData] = useState<FormData>({
    setor: '',
    tipo: '',
    descricao: '',
    ativo: true
  });

  useEffect(() => {
    fetchTarefas();
  }, []);

  const fetchTarefas = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/tarefas-padrao');
      
      if (!response.ok) {
        throw new Error('Erro ao carregar tarefas padrão');
      }
      
      const data = await response.json();
      setTarefas(data || []);
    } catch (error) {
      console.error('Erro ao carregar tarefas:', error);
      showToast('Erro ao carregar tarefas padrão', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.setor || !formData.tipo || !formData.descricao) {
      showToast('Todos os campos são obrigatórios', 'warning');
      return;
    }

    try {
      const url = editingTarefa 
        ? `/api/tarefas-padrao/${editingTarefa.id}`
        : '/api/tarefas-padrao';
      
      const method = editingTarefa ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao salvar tarefa');
      }

      showToast(
        editingTarefa 
          ? 'Tarefa padrão atualizada com sucesso!' 
          : 'Tarefa padrão criada com sucesso!', 
        'success'
      );
      
      fetchTarefas();
      handleCloseModal();
    } catch (error: any) {
      console.error('Erro ao salvar tarefa:', error);
      showToast(error.message || 'Erro ao salvar tarefa padrão', 'error');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir esta tarefa padrão?')) {
      return;
    }

    try {
      const response = await fetch(`/api/tarefas-padrao/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao excluir tarefa');
      }

      showToast('Tarefa padrão excluída com sucesso!', 'success');
      fetchTarefas();
    } catch (error: any) {
      console.error('Erro ao excluir tarefa:', error);
      showToast(error.message || 'Erro ao excluir tarefa padrão', 'error');
    }
  };

  const handleEdit = (tarefa: TarefaPadrao) => {
    setEditingTarefa(tarefa);
    setFormData({
      setor: tarefa.setor,
      tipo: tarefa.tipo,
      descricao: tarefa.descricao,
      ativo: tarefa.ativo
    });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingTarefa(null);
    setFormData({
      setor: '',
      tipo: '',
      descricao: '',
      ativo: true
    });
  };

  const filteredTarefas = tarefas.filter(tarefa => {
    const matchSearch = !search || 
      tarefa.tipo.toLowerCase().includes(search.toLowerCase()) ||
      tarefa.descricao.toLowerCase().includes(search.toLowerCase());
    
    const matchSetor = !selectedSetor || tarefa.setor === selectedSetor;
    
    return matchSearch && matchSetor;
  });

  const tarefasPorSetor = SETORES_VALIDOS.reduce((acc, setor) => {
    acc[setor] = filteredTarefas.filter(t => t.setor === setor);
    return acc;
  }, {} as Record<string, TarefaPadrao[]>);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gerenciar Tarefas Padrão</h1>
            <p className="text-gray-600 mt-1">Configure as tarefas padrão para cada setor</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <PlusIcon className="w-5 h-5 mr-2" />
            Nova Tarefa Padrão
          </button>
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por tipo ou descrição..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="sm:w-48">
            <select
              value={selectedSetor}
              onChange={(e) => setSelectedSetor(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Todos os setores</option>
              {SETORES_VALIDOS.map(setor => (
                <option key={setor} value={setor}>{setor}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <span className="text-2xl">📋</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total</p>
              <p className="text-2xl font-bold text-gray-900">{tarefas.length}</p>
            </div>
          </div>
        </div>
        
        {SETORES_VALIDOS.map(setor => {
          const count = tarefas.filter(t => t.setor === setor && t.ativo).length;
          const emoji = setor === 'RH' ? '👥' : setor === 'MEDICINA' ? '🏥' : '🎓';
          
          return (
            <div key={setor} className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <span className="text-2xl">{emoji}</span>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">{setor}</p>
                  <p className="text-2xl font-bold text-gray-900">{count}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Lista de Tarefas por Setor */}
      <div className="space-y-6">
        {SETORES_VALIDOS.map(setor => {
          const tarefasSetor = tarefasPorSetor[setor];
          const emoji = setor === 'RH' ? '👥' : setor === 'MEDICINA' ? '🏥' : '🎓';
          
          return (
            <div key={setor} className="bg-white rounded-lg shadow-sm">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <span className="text-2xl mr-3">{emoji}</span>
                  {setor}
                  <span className="ml-2 px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
                    {tarefasSetor.length} tarefas
                  </span>
                </h2>
              </div>
              
              <div className="p-6">
                {tarefasSetor.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">Nenhuma tarefa padrão encontrada para {setor}</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {tarefasSetor.map(tarefa => (
                      <div key={tarefa.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-medium text-gray-900">{tarefa.tipo}</h3>
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                tarefa.ativo 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {tarefa.ativo ? 'Ativo' : 'Inativo'}
                              </span>
                            </div>
                            <p className="text-gray-600 text-sm">{tarefa.descricao}</p>
                            <p className="text-xs text-gray-400 mt-2">
                              Criado em {new Date(tarefa.createdAt).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                          <div className="flex gap-2 ml-4">
                            <button
                              onClick={() => handleEdit(tarefa)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Editar"
                            >
                              <PencilIcon className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(tarefa.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Excluir"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingTarefa ? 'Editar Tarefa Padrão' : 'Nova Tarefa Padrão'}
              </h3>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Setor *
                  </label>
                  <select
                    value={formData.setor}
                    onChange={(e) => setFormData({ ...formData, setor: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Selecione um setor</option>
                    {SETORES_VALIDOS.map(setor => (
                      <option key={setor} value={setor}>{setor}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo *
                  </label>
                  <input
                    type="text"
                    value={formData.tipo}
                    onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ex: RG, CPF, Exame Médico..."
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descrição *
                  </label>
                  <textarea
                    value={formData.descricao}
                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Descreva a tarefa padrão..."
                    required
                  />
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="ativo"
                    checked={formData.ativo}
                    onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="ativo" className="ml-2 block text-sm text-gray-700">
                    Tarefa ativa
                  </label>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {editingTarefa ? 'Atualizar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}