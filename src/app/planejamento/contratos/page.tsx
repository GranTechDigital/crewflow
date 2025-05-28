'use client';

import { useEffect, useState } from 'react';

type Contrato = {
  id: number;
  numero: string;
  nome: string;
  cliente: string;
  dataInicio: string;
  dataFim: string;
  centroDeCusto: string; // Nova coluna
  status: string;        // Nova coluna
};

// Função para formatar datas ignorando o fuso UTC (para não subtrair um dia)
function formatDateWithoutTimezone(dateStr: string) {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString();
}

export default function ContratosPage() {
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(false);

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingContrato, setEditingContrato] = useState<Contrato | null>(null);
  const [form, setForm] = useState({
    numero: '',
    nome: '',
    cliente: '',
    dataInicio: '',
    dataFim: '',
    centroDeCusto: '',
    status: '',
  });

  async function fetchContratos() {
    setLoading(true);
    try {
      const res = await fetch('/api/contratos');
      if (!res.ok) throw new Error('Erro ao carregar contratos');
      const data = await res.json();
      setContratos(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchContratos();
  }, []);

  function openAddModal() {
    setEditingContrato(null);
    setForm({ numero: '', nome: '', cliente: '', dataInicio: '', dataFim: '', centroDeCusto: '', status: '' });
    setModalOpen(true);
  }

  function openEditModal(contrato: Contrato) {
    setEditingContrato(contrato);
    setForm({
      numero: contrato.numero,
      nome: contrato.nome,
      cliente: contrato.cliente,
      dataInicio: contrato.dataInicio.split('T')[0], // yyyy-mm-dd
      dataFim: contrato.dataFim.split('T')[0],
      centroDeCusto: contrato.centroDeCusto,
      status: contrato.status,
    });
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.numero || !form.nome || !form.cliente || !form.dataInicio || !form.dataFim || !form.centroDeCusto || !form.status) {
      alert('Preencha todos os campos');
      return;
    }

    try {
      let res;
      if (editingContrato) {
        res = await fetch(`/api/contratos/${editingContrato.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
      } else {
        res = await fetch('/api/contratos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
      }

      if (!res.ok) throw new Error('Erro ao salvar contrato');

      setModalOpen(false);
      fetchContratos();
    } catch (error) {
      console.error(error);
      alert('Erro ao salvar contrato');
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Tem certeza que deseja excluir este contrato?')) return;

    try {
      const res = await fetch(`/api/contratos/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Erro ao deletar contrato');
      fetchContratos();
    } catch (error) {
      console.error(error);
      alert('Erro ao deletar contrato');
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold">Gestão de Contratos</h1>

      <button
        onClick={openAddModal}
        className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition"
      >
        Adicionar Contrato
      </button>

      {loading ? (
        <p>Carregando contratos...</p>
      ) : (
        <table className="min-w-full table-auto border-collapse border border-gray-300">
          <thead className="bg-gray-200">
            <tr>
              <th className="border px-4 py-2 text-left">Número</th>
              <th className="border px-4 py-2 text-left">Nome</th>
              <th className="border px-4 py-2 text-left">Cliente</th>
              <th className="border px-4 py-2 text-left">Início</th>
              <th className="border px-4 py-2 text-left">Fim</th>
              <th className="border px-4 py-2 text-left">Centro de Custo</th>
              <th className="border px-4 py-2 text-left">Status</th>
              <th className="border px-4 py-2 text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {contratos.length === 0 ? (
              <tr>
                <td colSpan={8} className="border px-4 py-2 text-center">
                  Nenhum contrato encontrado.
                </td>
              </tr>
            ) : (
              contratos.map((c) => (
                <tr key={c.id} className="hover:bg-gray-100">
                  <td className="border px-4 py-2">{c.numero}</td>
                  <td className="border px-4 py-2">{c.nome}</td>
                  <td className="border px-4 py-2">{c.cliente}</td>
                  <td className="border px-4 py-2">{formatDateWithoutTimezone(c.dataInicio)}</td>
                  <td className="border px-4 py-2">{formatDateWithoutTimezone(c.dataFim)}</td>
                  <td className="border px-4 py-2">{c.centroDeCusto}</td>
                  <td className="border px-4 py-2">{c.status}</td>
                  <td className="border px-4 py-2 text-center space-x-2">
                    <button
                      onClick={() => openEditModal(c)}
                      className="px-3 py-1 bg-yellow-400 rounded hover:bg-yellow-500 transition"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition"
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white rounded-md p-6 w-full max-w-lg relative shadow-lg">
            <h2 className="text-xl font-bold mb-4">
              {editingContrato ? 'Editar Contrato' : 'Adicionar Contrato'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="text"
                placeholder="Número"
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.numero}
                onChange={(e) => setForm({ ...form, numero: e.target.value })}
              />
              <input
                type="text"
                placeholder="Nome"
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
              />
              <input
                type="text"
                placeholder="Cliente"
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.cliente}
                onChange={(e) => setForm({ ...form, cliente: e.target.value })}
              />
              <div className="flex gap-4">
                <input
                  type="date"
                  className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.dataInicio}
                  onChange={(e) => setForm({ ...form, dataInicio: e.target.value })}
                />
                <input
                  type="date"
                  className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.dataFim}
                  onChange={(e) => setForm({ ...form, dataFim: e.target.value })}
                />
              </div>
              <input
                type="text"
                placeholder="Centro de Custo"
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.centroDeCusto}
                onChange={(e) => setForm({ ...form, centroDeCusto: e.target.value })}
              />
              <input
                type="text"
                placeholder="Status"
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              />
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                >
                  {editingContrato ? 'Salvar Alterações' : 'Adicionar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
