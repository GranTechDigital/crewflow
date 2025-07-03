'use client';

import { useEffect, useState } from 'react';

type Contrato = {
  id: number;
  numero: string;
  nome: string;
  cliente: string;
  status: string;
};

type CentroCusto = {
  id: number;
  num_centro_custo: string;
  nome_centro_custo: string;
  status: string;
};

type Vinculacao = {
  id: number;
  contratoId: number;
  centroCustoId: number;
  contrato: Contrato;
  centroCusto: CentroCusto;
  createdAt: string;
};

export default function VinculacaoContratosPage() {
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [centrosCusto, setCentrosCusto] = useState<CentroCusto[]>([]);
  const [vinculacoes, setVinculacoes] = useState<Vinculacao[]>([]);
  const [loading, setLoading] = useState(false);

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    contratoId: '',
    centroCustoId: '',
  });

  // Filtros
  const [filtroContrato, setFiltroContrato] = useState('');
  const [filtroCentroCusto, setFiltroCentroCusto] = useState('');

  async function fetchData() {
    setLoading(true);
    try {
      const [contratosRes, centrosCustoRes, vinculacoesRes] = await Promise.all([
        fetch('/api/contratos'),
        fetch('/api/centros-custo'),
        fetch('/api/contratos-centros-custo')
      ]);

      if (!contratosRes.ok || !centrosCustoRes.ok || !vinculacoesRes.ok) {
        throw new Error('Erro ao carregar dados');
      }

      const [contratosData, centrosCustoData, vinculacoesData] = await Promise.all([
        contratosRes.json(),
        centrosCustoRes.json(),
        vinculacoesRes.json()
      ]);

      setContratos(contratosData);
      setCentrosCusto(centrosCustoData);
      setVinculacoes(vinculacoesData);
    } catch (error) {
      console.error(error);
      alert('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  function openAddModal() {
    setForm({ contratoId: '', centroCustoId: '' });
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.contratoId || !form.centroCustoId) {
      alert('Selecione um contrato e um centro de custo');
      return;
    }

    try {
      const res = await fetch('/api/contratos-centros-custo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contratoId: parseInt(form.contratoId),
          centroCustoId: parseInt(form.centroCustoId)
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Erro ao criar vinculação');
      }

      setModalOpen(false);
      fetchData();
    } catch (error: any) {
      console.error(error);
      alert(error.message || 'Erro ao criar vinculação');
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Tem certeza que deseja remover esta vinculação?')) return;

    try {
      const res = await fetch(`/api/contratos-centros-custo/${id}`, {
        method: 'DELETE',
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Erro ao remover vinculação');
      }
      
      fetchData();
    } catch (error: any) {
      console.error(error);
      alert(error.message || 'Erro ao remover vinculação');
    }
  }

  // Filtrar vinculações
  const vinculacoesFiltradas = vinculacoes.filter(v => {
    const matchContrato = !filtroContrato || 
      v.contrato.numero.toLowerCase().includes(filtroContrato.toLowerCase()) ||
      v.contrato.nome.toLowerCase().includes(filtroContrato.toLowerCase());
    
    const matchCentroCusto = !filtroCentroCusto || 
      v.centroCusto.num_centro_custo.toLowerCase().includes(filtroCentroCusto.toLowerCase()) ||
      v.centroCusto.nome_centro_custo.toLowerCase().includes(filtroCentroCusto.toLowerCase());
    
    return matchContrato && matchCentroCusto;
  });

  // Contratos disponíveis (que ainda não estão vinculados ao centro de custo selecionado)
  const contratosDisponiveis = contratos.filter(contrato => {
    if (!form.centroCustoId) return true;
    return !vinculacoes.some(v => 
      v.contratoId === contrato.id && 
      v.centroCustoId === parseInt(form.centroCustoId)
    );
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Vinculação Contratos x Centros de Custo</h1>
          <p className="text-gray-600 mt-2">Gerencie as vinculações entre contratos e centros de custo</p>
        </div>
        <button
          onClick={openAddModal}
          className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition"
        >
          Nova Vinculação
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Filtros</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Filtrar por Contrato
            </label>
            <input
              type="text"
              placeholder="Número ou nome do contrato..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filtroContrato}
              onChange={(e) => setFiltroContrato(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Filtrar por Centro de Custo
            </label>
            <input
              type="text"
              placeholder="Número ou nome do centro de custo..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filtroCentroCusto}
              onChange={(e) => setFiltroCentroCusto(e.target.value)}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-8">
          <p className="text-gray-600">Carregando vinculações...</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full table-auto">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contrato</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Centro de Custo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data Vinculação</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {vinculacoesFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                    {vinculacoes.length === 0 ? 'Nenhuma vinculação encontrada.' : 'Nenhuma vinculação corresponde aos filtros.'}
                  </td>
                </tr>
              ) : (
                vinculacoesFiltradas.map((vinculacao) => (
                  <tr key={vinculacao.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {vinculacao.contrato.numero}
                        </div>
                        <div className="text-sm text-gray-500">
                          {vinculacao.contrato.nome}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {vinculacao.contrato.cliente}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {vinculacao.centroCusto.num_centro_custo}
                        </div>
                        <div className="text-sm text-gray-500">
                          {vinculacao.centroCusto.nome_centro_custo}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(vinculacao.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button
                        onClick={() => handleDelete(vinculacao.id)}
                        className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition text-sm"
                      >
                        Remover
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg relative shadow-xl">
            <h2 className="text-xl font-bold mb-4">Nova Vinculação</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Centro de Custo
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={form.centroCustoId}
                  onChange={(e) => setForm({ ...form, centroCustoId: e.target.value, contratoId: '' })}
                >
                  <option value="">Selecione um centro de custo</option>
                  {centrosCusto
                    .filter(cc => cc.status === 'Ativo')
                    .map((cc) => (
                      <option key={cc.id} value={cc.id}>
                        {cc.num_centro_custo} - {cc.nome_centro_custo}
                      </option>
                    ))
                  }
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contrato
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={form.contratoId}
                  onChange={(e) => setForm({ ...form, contratoId: e.target.value })}
                  disabled={!form.centroCustoId}
                >
                  <option value="">Selecione um contrato</option>
                  {contratosDisponiveis
                    .filter(c => c.status === 'Ativo')
                    .map((contrato) => (
                      <option key={contrato.id} value={contrato.id}>
                        {contrato.numero} - {contrato.nome} ({contrato.cliente})
                      </option>
                    ))
                  }
                </select>
                {!form.centroCustoId && (
                  <p className="text-sm text-gray-500 mt-1">
                    Selecione primeiro um centro de custo
                  </p>
                )}
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
                  Criar Vinculação
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}