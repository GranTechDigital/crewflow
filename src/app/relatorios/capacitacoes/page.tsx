'use client';

import { useEffect, useMemo, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { ROUTE_PROTECTION } from '@/lib/permissions';

interface ContratoResumo {
  id: number;
  numero: string;
  nome: string;
}

interface UltimaCapacitacaoResumo {
  tipo: string;
  responsavel: string;
  descricao: string | null;
  dataConclusao: string;
  dataVencimento: string | null;
  treinamento: string | null;
  tarefaPadrao: string | null;
}

interface FuncionarioCapResumo {
  id: number;
  nome: string;
  matricula: string;
  funcao: string | null;
  centroCusto: string | null;
  contrato: ContratoResumo | null;
  totalCapacitacoes: number;
  ultimaCapacitacao: UltimaCapacitacaoResumo | null;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface CapacitacaoDetalhe {
  id: number;
  tipo: string;
  responsavel: string;
  descricao?: string | null;
  tarefaPadraoId?: number | null;
  treinamentoId?: number | null;
  dataConclusao: string;
  dataVencimento?: string | null;
  origemRemanejamento?: { id: string; solicitacaoId: number } | null;
  tarefaPadrao?: { descricao: string } | null;
  treinamento?: { treinamento: string } | null;
}

function RelatorioCapacitacoesContent() {
  const [lista, setLista] = useState<FuncionarioCapResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState<PaginationInfo>({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [showModal, setShowModal] = useState(false);
  const [modalTitulo, setModalTitulo] = useState('');
  const [capacitacoesDetalhe, setCapacitacoesDetalhe] = useState<CapacitacaoDetalhe[]>([]);
  const [modalLoading, setModalLoading] = useState(false);

  const fetchLista = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ page: String(pagination.page), limit: String(pagination.limit) });
      if (search.trim()) params.set('search', search.trim());
      const res = await fetch(`/api/capacitacoes/funcionarios?${params.toString()}`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Falha na listagem');
      setLista(data.data as FuncionarioCapResumo[]);
      setPagination(data.pagination as PaginationInfo);
    } catch (e: any) {
      setError(e.message || 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLista();
  }, [pagination.page, pagination.limit]);

  const buscar = async () => {
    setPagination((p) => ({ ...p, page: 1 }));
    await fetchLista();
  };

  const abrirModal = async (f: FuncionarioCapResumo) => {
    try {
      setModalTitulo(`${f.nome} (${f.matricula})`);
      setShowModal(true);
      setModalLoading(true);
      const res = await fetch(`/api/funcionarios/${f.id}/capacitacoes`);
      const data = await res.json();
      if (res.ok) {
        const caps = (data.capacitacoes || []) as any[];
        const convert: CapacitacaoDetalhe[] = caps.map((c) => ({
          id: c.id,
          tipo: c.tipo,
          responsavel: c.responsavel,
          descricao: c.descricao ?? null,
          tarefaPadraoId: c.tarefaPadraoId ?? null,
          treinamentoId: c.treinamentoId ?? null,
          dataConclusao: c.dataConclusao,
          dataVencimento: c.dataVencimento ?? null,
          origemRemanejamento: c.origemRemanejamento ?? null,
          tarefaPadrao: c.tarefaPadrao ?? null,
          treinamento: c.treinamento ?? null,
        }));
        setCapacitacoesDetalhe(convert);
      } else {
        setCapacitacoesDetalhe([]);
      }
    } catch {
      setCapacitacoesDetalhe([]);
    } finally {
      setModalLoading(false);
    }
  };

  const fecharModal = () => {
    setShowModal(false);
    setCapacitacoesDetalhe([]);
  };

  const paginaInfo = useMemo(() => {
    const start = (pagination.page - 1) * pagination.limit + 1;
    const end = Math.min(pagination.page * pagination.limit, pagination.total);
    return { start, end };
  }, [pagination]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Funcionários com Capacitações</h1>
        </div>

        {error && (
          <div className="mb-4 p-4 rounded-lg bg-red-100 border border-red-400 text-red-700">{error}</div>
        )}

        <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Buscar</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nome, matrícula, função, contrato..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={buscar}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Buscar
            </button>
          </div>
          <div className="flex items-end">
            <select
              value={pagination.limit}
              onChange={(e) => setPagination((p) => ({ ...p, limit: parseInt(e.target.value, 10), page: 1 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value={10}>10 por página</option>
              <option value={20}>20 por página</option>
              <option value={50}>50 por página</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Matrícula</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Função</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contrato</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Centro de Custo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Última</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-4 text-center">Carregando...</td>
                </tr>
              ) : lista.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-4 text-center text-gray-500">Nenhum funcionário encontrado</td>
                </tr>
              ) : (
                lista.map((f) => (
                  <tr key={f.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{f.matricula}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{f.nome}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{f.funcao ?? '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{f.contrato ? `${f.contrato.numero} - ${f.contrato.nome}` : '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{f.centroCusto ?? '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{f.totalCapacitacoes}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {f.ultimaCapacitacao ? (
                        <div className="text-xs">
                          <div className="font-semibold">{f.ultimaCapacitacao.treinamento || f.ultimaCapacitacao.tarefaPadrao || f.ultimaCapacitacao.tipo}</div>
                          <div className="text-gray-600">{new Date(f.ultimaCapacitacao.dataConclusao).toLocaleDateString('pt-BR')}</div>
                        </div>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => abrirModal(f)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Ver histórico
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pagination.totalPages > 1 && (
          <div className="mt-6 flex justify-between items-center">
            <div className="text-sm text-gray-700">
              Mostrando {paginaInfo.start} a {paginaInfo.end} de {pagination.total} registros
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setPagination((p) => ({ ...p, page: Math.max(1, p.page - 1) }))}
                disabled={pagination.page === 1}
                className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Anterior
              </button>
              <span className="px-3 py-1 bg-blue-600 text-white rounded">{pagination.page}</span>
              <button
                onClick={() => setPagination((p) => ({ ...p, page: Math.min(p.totalPages, p.page + 1) }))}
                disabled={pagination.page === pagination.totalPages}
                className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-3xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">{modalTitulo}</h2>
              <button onClick={fecharModal} className="text-gray-600 hover:text-gray-900">Fechar</button>
            </div>
            {modalLoading ? (
              <div className="py-8 text-center">Carregando...</div>
            ) : capacitacoesDetalhe.length === 0 ? (
              <div className="py-8 text-center text-gray-500">Nenhuma capacitação encontrada</div>
            ) : (
              <div className="overflow-x-auto max-h-[60vh]">
                <table className="min-w-full bg-white border border-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Responsável</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Conclusão</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vencimento</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {capacitacoesDetalhe.map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-sm text-gray-900">{c.tipo}</td>
                        <td className="px-4 py-2 text-sm text-gray-900">{c.responsavel}</td>
                        <td className="px-4 py-2 text-sm text-gray-900">{c.treinamento?.treinamento || c.tarefaPadrao?.descricao || c.descricao || '-'}</td>
                        <td className="px-4 py-2 text-sm text-gray-900">{new Date(c.dataConclusao).toLocaleDateString('pt-BR')}</td>
                        <td className="px-4 py-2 text-sm text-gray-900">{c.dataVencimento ? new Date(c.dataVencimento).toLocaleDateString('pt-BR') : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function RelatorioCapacitacoesPage() {
  return (
    <ProtectedRoute
      requiredEquipe={ROUTE_PROTECTION.LOGISTICA.requiredEquipe}
      requiredPermissions={ROUTE_PROTECTION.LOGISTICA.requiredPermissions}
    >
      <RelatorioCapacitacoesContent />
    </ProtectedRoute>
  );
}