'use client';

import { useState, useEffect } from 'react';
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';

interface Equipe {
  id: number;
  nome: string;
  descricao?: string;
  ativo: boolean;
  totalUsuarios: number;
  createdAt: string;
  updatedAt: string;
}

export default function EquipesAdminPage() {
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEquipe, setEditingEquipe] = useState<Equipe | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    descricao: ''
  });

  useEffect(() => {
    fetchEquipes();
  }, []);

  const fetchEquipes = async () => {
    try {
      const response = await fetch('/api/equipes');
      const data = await response.json();
      if (data.success) {
        setEquipes(data.equipes);
      }
    } catch (error) {
      console.error('Erro ao buscar equipes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingEquipe ? `/api/equipes/${editingEquipe.id}` : '/api/equipes';
      const method = editingEquipe ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (data.success) {
        setShowModal(false);
        setEditingEquipe(null);
        setFormData({ nome: '', descricao: '' });
        fetchEquipes();
      } else {
        alert(data.error);
      }
    } catch (error) {
      console.error('Erro ao salvar equipe:', error);
      alert('Erro ao salvar equipe');
    }
  };

  const handleEdit = (equipe: Equipe) => {
    setEditingEquipe(equipe);
    setFormData({
      nome: equipe.nome,
      descricao: equipe.descricao || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir esta equipe?')) {
      return;
    }

    try {
      const response = await fetch(`/api/equipes/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (data.success) {
        fetchEquipes();
      } else {
        alert(data.error);
      }
    } catch (error) {
      console.error('Erro ao excluir equipe:', error);
      alert('Erro ao excluir equipe');
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingEquipe(null);
    setFormData({ nome: '', descricao: '' });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Administração de Equipes</h1>
        <p className="text-gray-600">Gerencie as equipes do sistema</p>
      </div>

      {/* Ações */}
      <div className="mb-6 flex justify-end">
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <PlusIcon className="h-5 w-5" />
          Nova Equipe
        </button>
      </div>

      {/* Lista de Equipes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {equipes.map((equipe) => (
          <div key={equipe.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{equipe.nome}</h3>
                {equipe.descricao && (
                  <p className="text-gray-600 text-sm mt-1">{equipe.descricao}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleEdit(equipe)}
                  className="text-blue-600 hover:text-blue-900"
                  title="Editar"
                >
                  <PencilIcon className="h-5 w-5" />
                </button>
                {equipe.totalUsuarios === 0 && (
                  <button
                    onClick={() => handleDelete(equipe.id)}
                    className="text-red-600 hover:text-red-900"
                    title="Excluir"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Usuários:</span>
                <span className="text-sm font-medium text-gray-900">{equipe.totalUsuarios}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Status:</span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  equipe.ativo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {equipe.ativo ? 'Ativa' : 'Inativa'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Criada em:</span>
                <span className="text-sm text-gray-900">
                  {new Date(equipe.createdAt).toLocaleDateString('pt-BR')}
                </span>
              </div>
            </div>

            {equipe.totalUsuarios > 0 && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-xs text-yellow-800">
                  Esta equipe possui usuários ativos e não pode ser excluída.
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {equipes.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">Nenhuma equipe cadastrada</p>
          <p className="text-gray-400 text-sm mt-2">Clique em "Nova Equipe" para começar</p>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {editingEquipe ? 'Editar Equipe' : 'Nova Equipe'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome da Equipe *
                </label>
                <input
                  type="text"
                  value={formData.nome}
                  onChange={(e) => setFormData({...formData, nome: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                  placeholder="Ex: RH, Treinamento, Medicina..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descrição
                </label>
                <textarea
                  value={formData.descricao}
                  onChange={(e) => setFormData({...formData, descricao: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Descrição opcional da equipe..."
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingEquipe ? 'Atualizar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}