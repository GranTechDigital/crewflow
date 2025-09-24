"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";

interface StatusMapping {
  id: number;
  statusGeral: string;
  categoria: string;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
}

interface StatusForm {
  statusGeral: string;
  categoria: string;
  ativo: boolean;
}

export default function StatusPage() {
  const { usuario, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<StatusMapping[]>([]);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingStatus, setEditingStatus] = useState<StatusMapping | null>(null);
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroAtivo, setFiltroAtivo] = useState("all");
  const [busca, setBusca] = useState("");
  const [form, setForm] = useState<StatusForm>({
    statusGeral: "",
    categoria: "",
    ativo: true
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!authLoading && usuario) {
      fetchStatus();
    }
  }, [usuario, authLoading, filtroCategoria, filtroAtivo]);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filtroCategoria) params.append('categoria', filtroCategoria);
      if (filtroAtivo !== 'all') params.append('ativo', filtroAtivo);

      const response = await fetch(`/api/status-mapping?${params.toString()}`);
      const data = await response.json();

      if (response.ok) {
        setStatus(data.status || []);
        setCategorias(data.categorias || []);
      } else {
        setError(data.error || "Erro ao carregar status");
      }
    } catch (error) {
      setError("Erro ao conectar com o servidor");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!form.categoria.trim() || !form.statusGeral.trim()) {
      setError("Status geral e categoria são obrigatórios");
      return;
    }

    try {
      const url = editingStatus ? `/api/status-mapping/${editingStatus.id}` : '/api/status-mapping';
      const method = editingStatus ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(editingStatus ? "Status mapping atualizado com sucesso!" : "Status mapping criado com sucesso!");
        setShowModal(false);
        setEditingStatus(null);
        setForm({ statusGeral: "", categoria: "", ativo: true });
        fetchStatus();
      } else {
        setError(data.error || "Erro ao salvar status mapping");
      }
    } catch (error) {
      setError("Erro ao conectar com o servidor");
    }
  };

  const handleEdit = (status: StatusMapping) => {
    setEditingStatus(status);
    setForm({
      statusGeral: status.statusGeral,
      categoria: status.categoria,
      ativo: status.ativo
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Tem certeza que deseja excluir este status mapping?")) return;

    try {
      const response = await fetch(`/api/status-mapping/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setSuccess("Status mapping excluído com sucesso!");
        fetchStatus();
      } else {
        const data = await response.json();
        setError(data.error || "Erro ao excluir status");
      }
    } catch (error) {
      setError("Erro ao conectar com o servidor");
    }
  };

  const openCreateModal = () => {
    setEditingStatus(null);
    setForm({ statusGeral: "", categoria: "", ativo: true });
    setShowModal(true);
  };

  const statusFiltrados = status.filter(s => 
    s.statusGeral.toLowerCase().includes(busca.toLowerCase()) ||
    s.categoria.toLowerCase().includes(busca.toLowerCase())
  );

  const categoriasAgrupadas = statusFiltrados.reduce((acc, s) => {
    if (!acc[s.categoria]) acc[s.categoria] = [];
    acc[s.categoria].push(s);
    return acc;
  }, {} as Record<string, StatusMapping[]>);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            {/* Header */}
            <div className="mb-6 flex justify-between items-start">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Gerenciar Mapeamento de Status</h1>
                <p className="mt-2 text-gray-600">
                  Gerencie o mapeamento entre status específicos e suas categorias
                </p>
              </div>
              <button
                onClick={openCreateModal}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                ➕ Novo Mapeamento
              </button>
            </div>

            {/* Mensagens */}
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
                <p className="text-red-800">{error}</p>
              </div>
            )}

            {success && (
              <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md">
                <p className="text-green-800">{success}</p>
              </div>
            )}

            {/* Filtros */}
            <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Buscar
                </label>
                <input
                  type="text"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar status ou categoria..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Categoria
                </label>
                <select
                  value={filtroCategoria}
                  onChange={(e) => setFiltroCategoria(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Todas as categorias</option>
                  {categorias.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={filtroAtivo}
                  onChange={(e) => setFiltroAtivo(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Todos</option>
                  <option value="true">Ativos</option>
                  <option value="false">Inativos</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  onClick={fetchStatus}
                  className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  🔄 Atualizar
                </button>
              </div>
            </div>

            {/* Lista de Status Agrupados */}
            <div className="space-y-6">
              {Object.entries(categoriasAgrupadas).map(([categoria, statusList]) => (
                <div key={categoria} className="border border-gray-200 rounded-lg">
                  <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900">
                      📂 {categoria} ({statusList.length})
                    </h3>
                  </div>
                  <div className="divide-y divide-gray-200">
                    {statusList.map((s) => (
                      <div key={s.id} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              s.ativo 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {s.ativo ? '✅ Ativo' : '❌ Inativo'}
                            </span>
                            <span className="text-sm font-medium text-gray-900">
                              {s.statusGeral}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            Criado em: {new Date(s.createdAt).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleEdit(s)}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            ✏️ Editar
                          </button>
                          <button
                            onClick={() => handleDelete(s.id)}
                            className="text-red-600 hover:text-red-800 text-sm font-medium"
                          >
                            🗑️ Excluir
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {statusFiltrados.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">Nenhum status encontrado</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {editingStatus ? 'Editar Mapeamento de Status' : 'Novo Mapeamento de Status'}
              </h3>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status Geral *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.statusGeral}
                    onChange={(e) => setForm({...form, statusGeral: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: Aguardando Embarque/Programado"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Categoria *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.categoria}
                    onChange={(e) => setForm({...form, categoria: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: Aguardando embarque"
                    list="categorias-existentes"
                  />
                  <datalist id="categorias-existentes">
                    {categorias.map(cat => (
                      <option key={cat} value={cat} />
                    ))}
                  </datalist>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="ativo"
                    checked={form.ativo}
                    onChange={(e) => setForm({...form, ativo: e.target.checked})}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="ativo" className="ml-2 block text-sm text-gray-900">
                    Status ativo
                  </label>
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {editingStatus ? 'Atualizar' : 'Criar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}