'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';

interface CentroCustoProjeto {
  id: number;
  cc: string;
  ccProjeto: string;
  nomeCc: string;
  ccNome: string;
  projeto: string;
  grupo1: string;
  grupo2: string;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CentroCustoForm {
  cc: string;
  ccProjeto: string;
  nomeCc: string;
  ccNome: string;
  projeto: string;
  grupo1: string;
  grupo2: string;
  ativo: boolean;
}

interface Filtros {
  projetos: string[];
  grupos1: string[];
  grupos2: string[];
}

export default function CentrosCustoProjetosPage() {
  const { usuario, loading: authLoading } = useAuth();
  const [centrosCusto, setCentrosCusto] = useState<CentroCustoProjeto[]>([]);
  const [filtros, setFiltros] = useState<Filtros>({ projetos: [], grupos1: [], grupos2: [] });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  // Filtros
  const [filtroAtivo, setFiltroAtivo] = useState<string>('');
  const [filtroProjeto, setFiltroProjeto] = useState<string>('');
  const [filtroGrupo1, setFiltroGrupo1] = useState<string>('');
  const [filtroGrupo2, setFiltroGrupo2] = useState<string>('');
  const [busca, setBusca] = useState<string>('');

  const [form, setForm] = useState<CentroCustoForm>({
    cc: '',
    ccProjeto: '',
    nomeCc: '',
    ccNome: '',
    projeto: '',
    grupo1: '',
    grupo2: '',
    ativo: true
  });

  useEffect(() => {
    if (usuario && !authLoading) {
      fetchCentrosCusto();
    }
  }, [usuario, authLoading, filtroAtivo, filtroProjeto, filtroGrupo1, filtroGrupo2, busca]);

  const fetchCentrosCusto = async () => {
    try {
      const params = new URLSearchParams();
      if (filtroAtivo) params.append('ativo', filtroAtivo);
      if (filtroProjeto) params.append('projeto', filtroProjeto);
      if (filtroGrupo1) params.append('grupo1', filtroGrupo1);
      if (filtroGrupo2) params.append('grupo2', filtroGrupo2);
      if (busca) params.append('search', busca);

      const response = await fetch(`/api/centros-custo-projetos?${params}`);
      if (response.ok) {
        const data = await response.json();
        setCentrosCusto(data.centrosCusto);
        setFiltros(data.filtros);
      }
    } catch (error) {
      console.error('Erro ao buscar centros de custo:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const url = editingId 
        ? `/api/centros-custo-projetos/${editingId}`
        : '/api/centros-custo-projetos';
      
      const method = editingId ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
      });

      if (response.ok) {
        await fetchCentrosCusto();
        setShowModal(false);
        resetForm();
      } else {
        const error = await response.json();
        alert(error.error || 'Erro ao salvar centro de custo');
      }
    } catch (error) {
      console.error('Erro ao salvar centro de custo:', error);
      alert('Erro ao salvar centro de custo');
    }
  };

  const handleEdit = (centroCusto: CentroCustoProjeto) => {
    setForm({
      cc: centroCusto.cc,
      ccProjeto: centroCusto.ccProjeto,
      nomeCc: centroCusto.nomeCc,
      ccNome: centroCusto.ccNome,
      projeto: centroCusto.projeto,
      grupo1: centroCusto.grupo1,
      grupo2: centroCusto.grupo2,
      ativo: centroCusto.ativo
    });
    setEditingId(centroCusto.id);
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Tem certeza que deseja excluir este centro de custo?')) {
      try {
        const response = await fetch(`/api/centros-custo-projetos/${id}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          await fetchCentrosCusto();
        } else {
          const error = await response.json();
          alert(error.error || 'Erro ao excluir centro de custo');
        }
      } catch (error) {
        console.error('Erro ao excluir centro de custo:', error);
        alert('Erro ao excluir centro de custo');
      }
    }
  };

  const resetForm = () => {
    setForm({
      cc: '',
      ccProjeto: '',
      nomeCc: '',
      ccNome: '',
      projeto: '',
      grupo1: '',
      grupo2: '',
      ativo: true
    });
    setEditingId(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  if (authLoading || loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Centros de Custo - Projetos</h1>
        <button
          onClick={openCreateModal}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          Novo Centro de Custo
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <h3 className="text-lg font-semibold mb-4">Filtros</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Buscar</label>
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="CC, Nome, Projeto..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filtroAtivo}
              onChange={(e) => setFiltroAtivo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              <option value="true">Ativo</option>
              <option value="false">Inativo</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Projeto</label>
            <select
              value={filtroProjeto}
              onChange={(e) => setFiltroProjeto(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              {filtros.projetos.map(projeto => (
                <option key={projeto} value={projeto}>{projeto}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Grupo 1</label>
            <select
              value={filtroGrupo1}
              onChange={(e) => setFiltroGrupo1(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              {filtros.grupos1.map(grupo => (
                <option key={grupo} value={grupo}>{grupo}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Grupo 2</label>
            <select
              value={filtroGrupo2}
              onChange={(e) => setFiltroGrupo2(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              {filtros.grupos2.map(grupo => (
                <option key={grupo} value={grupo}>{grupo}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CC</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome CC</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Projeto</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Grupo 1</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Grupo 2</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {centrosCusto.map((centroCusto) => (
                <tr key={centroCusto.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {centroCusto.cc}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {centroCusto.nomeCc}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {centroCusto.projeto}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {centroCusto.grupo1}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {centroCusto.grupo2}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      centroCusto.ativo 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {centroCusto.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => handleEdit(centroCusto)}
                      className="text-indigo-600 hover:text-indigo-900 mr-3"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(centroCusto.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {editingId ? 'Editar Centro de Custo' : 'Novo Centro de Custo'}
              </h3>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      CC *
                    </label>
                    <input
                      type="text"
                      required
                      value={form.cc}
                      onChange={(e) => setForm({ ...form, cc: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      CC|Projeto
                    </label>
                    <input
                      type="text"
                      value={form.ccProjeto}
                      onChange={(e) => setForm({ ...form, ccProjeto: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nome CC *
                    </label>
                    <input
                      type="text"
                      required
                      value={form.nomeCc}
                      onChange={(e) => setForm({ ...form, nomeCc: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      CC & Nome
                    </label>
                    <input
                      type="text"
                      value={form.ccNome}
                      onChange={(e) => setForm({ ...form, ccNome: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Projeto
                    </label>
                    <input
                      type="text"
                      value={form.projeto}
                      onChange={(e) => setForm({ ...form, projeto: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Grupo 1
                    </label>
                    <input
                      type="text"
                      value={form.grupo1}
                      onChange={(e) => setForm({ ...form, grupo1: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Grupo 2
                    </label>
                    <input
                      type="text"
                      value={form.grupo2}
                      onChange={(e) => setForm({ ...form, grupo2: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Status
                    </label>
                    <select
                      value={form.ativo.toString()}
                      onChange={(e) => setForm({ ...form, ativo: e.target.value === 'true' })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="true">Ativo</option>
                      <option value="false">Inativo</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-md hover:bg-blue-600"
                  >
                    {editingId ? 'Atualizar' : 'Criar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Informações */}
      <div className="mt-6 text-sm text-gray-600">
        Total de registros: {centrosCusto.length}
      </div>
    </div>
  );
}