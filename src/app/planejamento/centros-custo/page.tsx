'use client';

import { useEffect, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { usePermissions } from '@/app/hooks/useAuth';
import { PERMISSIONS, ROUTE_PROTECTION } from '@/lib/permissions';

type CentroCusto = {
  id: number;
  num_centro_custo: string;
  nome_centro_custo: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  contratos?: {
    contrato: {
      id: number;
      numero: string;
      nome: string;
    };
  }[];
};

export default function CentrosCustoPage() {
  const [centrosCusto, setCentrosCusto] = useState<CentroCusto[]>([]);
  const [loading, setLoading] = useState(false);
  const { hasPermission } = usePermissions();
  const isEditor = hasPermission(PERMISSIONS.ACCESS_PLANEJAMENTO);

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCentroCusto, setEditingCentroCusto] = useState<CentroCusto | null>(null);
  const [form, setForm] = useState({
    num_centro_custo: '',
    nome_centro_custo: '',
    status: 'Ativo',
  });

  async function fetchCentrosCusto() {
    setLoading(true);
    try {
      const res = await fetch('/api/centros-custo');
      if (!res.ok) throw new Error('Erro ao carregar centros de custo');
      const data = await res.json();
      setCentrosCusto(data);
    } catch (error) {
      console.error(error);
      alert('Erro ao carregar centros de custo');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCentrosCusto();
  }, []);

  function openAddModal() {
    if (!isEditor) return;
    setEditingCentroCusto(null);
    setForm({ num_centro_custo: '', nome_centro_custo: '', status: 'Ativo' });
    setModalOpen(true);
  }

  function openEditModal(centroCusto: CentroCusto) {
    if (!isEditor) return;
    setEditingCentroCusto(centroCusto);
    setForm({
      num_centro_custo: centroCusto.num_centro_custo,
      nome_centro_custo: centroCusto.nome_centro_custo,
      status: centroCusto.status,
    });
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isEditor) return;

    if (!form.num_centro_custo || !form.nome_centro_custo || !form.status) {
      alert('Preencha todos os campos');
      return;
    }

    try {
      let res;
      if (editingCentroCusto) {
        res = await fetch(`/api/centros-custo/${editingCentroCusto.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
      } else {
        res = await fetch('/api/centros-custo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
      }

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Erro ao salvar centro de custo');
      }

      setModalOpen(false);
      fetchCentrosCusto();
    } catch (error: any) {
      console.error(error);
      alert(error.message || 'Erro ao salvar centro de custo');
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Tem certeza que deseja excluir este centro de custo?')) return;
    if (!isEditor) return;

    try {
      const res = await fetch(`/api/centros-custo/${id}`, {
        method: 'DELETE',
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Erro ao deletar centro de custo');
      }
      
      fetchCentrosCusto();
    } catch (error: any) {
      console.error(error);
      alert(error.message || 'Erro ao deletar centro de custo');
    }
  }

  return (
    <ProtectedRoute
      requiredEquipe={ROUTE_PROTECTION.PLANEJAMENTO.requiredEquipe}
      requiredPermissions={ROUTE_PROTECTION.PLANEJAMENTO.requiredPermissions}
    >
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Gestão de Centros de Custo</h1>
        {isEditor && (
          <button
            onClick={openAddModal}
            className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition"
          >
            Adicionar Centro de Custo
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-8">
          <p className="text-gray-600">Carregando centros de custo...</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full table-auto">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Número</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contratos Vinculados</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {centrosCusto.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                    Nenhum centro de custo encontrado.
                  </td>
                </tr>
              ) : (
                centrosCusto.map((cc) => (
                  <tr key={cc.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {cc.num_centro_custo}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {cc.nome_centro_custo}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        cc.status === 'Ativo' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {cc.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {cc.contratos && cc.contratos.length > 0 ? (
                        <div className="space-y-1">
                          {cc.contratos.slice(0, 2).map((vinculacao, index) => (
                            <div key={index} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                              {vinculacao.contrato.numero} - {vinculacao.contrato.nome}
                            </div>
                          ))}
                          {cc.contratos.length > 2 && (
                            <div className="text-xs text-gray-500">
                              +{cc.contratos.length - 2} mais
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">Nenhum contrato vinculado</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center space-x-2">
                      {isEditor && (
                        <>
                          <button
                            onClick={() => openEditModal(cc)}
                            className="px-3 py-1 bg-yellow-400 text-yellow-900 rounded hover:bg-yellow-500 transition text-sm"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleDelete(cc.id)}
                            className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition text-sm"
                          >
                            Excluir
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {isEditor && modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg relative shadow-xl">
            <h2 className="text-xl font-bold mb-4">
              {editingCentroCusto ? 'Editar Centro de Custo' : 'Adicionar Centro de Custo'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Número do Centro de Custo
                </label>
                <input
                  type="text"
                  placeholder="Ex: CC001"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={form.num_centro_custo}
                  onChange={(e) => setForm({ ...form, num_centro_custo: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome do Centro de Custo
                </label>
                <input
                  type="text"
                  placeholder="Ex: Departamento de TI"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={form.nome_centro_custo}
                  onChange={(e) => setForm({ ...form, nome_centro_custo: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  <option value="Ativo">Ativo</option>
                  <option value="Inativo">Inativo</option>
                </select>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                >
                  {editingCentroCusto ? 'Salvar Alterações' : 'Adicionar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </ProtectedRoute>
  );
}
