"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link2, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { usePermissions } from "@/app/hooks/useAuth";
import { PERMISSIONS, ROUTE_PROTECTION } from "@/lib/permissions";

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

function normalizar(valor: string) {
  return valor.trim().toLowerCase();
}

function textoContrato(contrato: Contrato) {
  return `${contrato.numero} - ${contrato.nome} (${contrato.cliente})`;
}

function textoCentroCusto(centroCusto: CentroCusto) {
  return `${centroCusto.num_centro_custo} - ${centroCusto.nome_centro_custo}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR").format(new Date(value));
}

export default function VinculacaoContratosPage() {
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [centrosCusto, setCentrosCusto] = useState<CentroCusto[]>([]);
  const [vinculacoes, setVinculacoes] = useState<Vinculacao[]>([]);
  const [contratoId, setContratoId] = useState("");
  const [centroCustoId, setCentroCustoId] = useState("");
  const [filtroContrato, setFiltroContrato] = useState("");
  const [filtroCentroCusto, setFiltroCentroCusto] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { hasPermission } = usePermissions();
  const isEditor = hasPermission(PERMISSIONS.ACCESS_PLANEJAMENTO);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const [contratosRes, centrosCustoRes, vinculacoesRes] = await Promise.all([
        fetch("/api/contratos", { cache: "no-store" }),
        fetch("/api/centros-custo", { cache: "no-store" }),
        fetch("/api/contratos-centros-custo", { cache: "no-store" }),
      ]);

      if (!contratosRes.ok || !centrosCustoRes.ok || !vinculacoesRes.ok) {
        throw new Error("Erro ao carregar dados.");
      }

      const [contratosData, centrosCustoData, vinculacoesData] = await Promise.all([
        contratosRes.json(),
        centrosCustoRes.json(),
        vinculacoesRes.json(),
      ]);

      setContratos(contratosData);
      setCentrosCusto(centrosCustoData);
      setVinculacoes(vinculacoesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  const contratosAtivos = useMemo(
    () =>
      contratos
        .filter((contrato) => contrato.status === "Ativo")
        .sort((a, b) => a.numero.localeCompare(b.numero, "pt-BR")),
    [contratos],
  );

  const centrosCustoAtivos = useMemo(
    () =>
      centrosCusto
        .filter((centroCusto) => centroCusto.status === "Ativo")
        .sort((a, b) => a.num_centro_custo.localeCompare(b.num_centro_custo, "pt-BR")),
    [centrosCusto],
  );

  const vinculacoesFiltradas = useMemo(() => {
    const contratoQuery = normalizar(filtroContrato);
    const centroCustoQuery = normalizar(filtroCentroCusto);

    return vinculacoes.filter((vinculacao) => {
      const contratoTexto = normalizar(textoContrato(vinculacao.contrato));
      const centroCustoTexto = normalizar(textoCentroCusto(vinculacao.centroCusto));
      return (
        (!contratoQuery || contratoTexto.includes(contratoQuery)) &&
        (!centroCustoQuery || centroCustoTexto.includes(centroCustoQuery))
      );
    });
  }, [filtroCentroCusto, filtroContrato, vinculacoes]);

  const centrosCustoDisponiveis = useMemo(() => {
    if (!contratoId) return centrosCustoAtivos;
    const contratoSelecionado = Number(contratoId);
    const vinculados = new Set(
      vinculacoes
        .filter((vinculacao) => vinculacao.contratoId === contratoSelecionado)
        .map((vinculacao) => vinculacao.centroCustoId),
    );
    return centrosCustoAtivos.filter((centroCusto) => !vinculados.has(centroCusto.id));
  }, [centrosCustoAtivos, contratoId, vinculacoes]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!isEditor) return;
    if (!contratoId || !centroCustoId) {
      setError("Selecione um contrato e um centro de custo.");
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/contratos-centros-custo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contratoId: Number(contratoId),
          centroCustoId: Number(centroCustoId),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Erro ao criar vínculo.");

      setContratoId("");
      setCentroCustoId("");
      setMessage("Vínculo criado com sucesso.");
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(vinculacao: Vinculacao) {
    if (!isEditor) return;
    const ok = window.confirm(
      `Remover o vínculo ${vinculacao.contrato.numero} x ${vinculacao.centroCusto.num_centro_custo}?`,
    );
    if (!ok) return;

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/contratos-centros-custo/${vinculacao.id}`, {
        method: "DELETE",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Erro ao remover vínculo.");

      setMessage("Vínculo removido com sucesso.");
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ProtectedRoute
      requiredEquipe={ROUTE_PROTECTION.PLANEJAMENTO.requiredEquipe}
      requiredPermissions={ROUTE_PROTECTION.PLANEJAMENTO.requiredPermissions}
    >
      <main className="min-h-screen bg-slate-50 p-6 text-slate-800">
        <div className="mx-auto max-w-7xl space-y-5">
          <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-red-600">
                Planejamento
              </p>
              <h1 className="mt-1 text-2xl font-semibold text-slate-900">
                Contratos x Centros de Custo
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Relacionamento manual usado para identificar o contrato a partir do centro de custo.
              </p>
            </div>
            <button
              type="button"
              onClick={fetchData}
              disabled={loading}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </button>
          </header>

          <section className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium text-slate-500">Contratos ativos</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{contratosAtivos.length}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium text-slate-500">Centros de custo ativos</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">
                {centrosCustoAtivos.length}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium text-slate-500">Vínculos cadastrados</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{vinculacoes.length}</p>
            </div>
          </section>

          {(error || message) && (
            <div
              className={`rounded-lg border p-3 text-sm ${
                error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"
              }`}
            >
              {error || message}
            </div>
          )}

          {isEditor && (
            <form
              onSubmit={handleSubmit}
              className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Link2 className="h-4 w-4 text-slate-500" />
                Novo vínculo
              </div>
              <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                <label className="block">
                  <span className="text-xs font-medium text-slate-600">Contrato</span>
                  <select
                    value={contratoId}
                    onChange={(event) => {
                      setContratoId(event.target.value);
                      setCentroCustoId("");
                    }}
                    className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-slate-50 px-3 text-sm text-slate-700 outline-none focus:border-slate-500 focus:bg-white"
                  >
                    <option value="">Selecione</option>
                    {contratosAtivos.map((contrato) => (
                      <option key={contrato.id} value={contrato.id}>
                        {textoContrato(contrato)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs font-medium text-slate-600">Centro de custo</span>
                  <select
                    value={centroCustoId}
                    onChange={(event) => setCentroCustoId(event.target.value)}
                    className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-slate-50 px-3 text-sm text-slate-700 outline-none focus:border-slate-500 focus:bg-white"
                  >
                    <option value="">Selecione</option>
                    {centrosCustoDisponiveis.map((centroCusto) => (
                      <option key={centroCusto.id} value={centroCusto.id}>
                        {textoCentroCusto(centroCusto)}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="submit"
                  disabled={saving || !contratoId || !centroCustoId}
                  className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-md border border-red-700 bg-red-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Plus className="h-4 w-4" />
                  Vincular
                </button>
              </div>
            </form>
          )}

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Search className="h-4 w-4 text-slate-500" />
              Filtros
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="text-xs font-medium text-slate-600">Contrato</span>
                <input
                  value={filtroContrato}
                  onChange={(event) => setFiltroContrato(event.target.value)}
                  placeholder="Número, nome ou cliente"
                  className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-slate-50 px-3 text-sm text-slate-700 outline-none focus:border-slate-500 focus:bg-white"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-600">Centro de custo</span>
                <input
                  value={filtroCentroCusto}
                  onChange={(event) => setFiltroCentroCusto(event.target.value)}
                  placeholder="Código ou nome"
                  className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-slate-50 px-3 text-sm text-slate-700 outline-none focus:border-slate-500 focus:bg-white"
                />
              </label>
            </div>
          </section>

          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">
              Vínculos
            </div>
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-100 text-xs uppercase text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Contrato</th>
                  <th className="px-4 py-3 text-left font-semibold">Centro de custo</th>
                  <th className="px-4 py-3 text-left font-semibold">Cliente</th>
                  <th className="px-4 py-3 text-left font-semibold">Data</th>
                  <th className="px-4 py-3 text-right font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-500" colSpan={5}>
                      Carregando vínculos...
                    </td>
                  </tr>
                ) : vinculacoesFiltradas.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-500" colSpan={5}>
                      Nenhum vínculo encontrado.
                    </td>
                  </tr>
                ) : (
                  vinculacoesFiltradas.map((vinculacao) => (
                    <tr key={vinculacao.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">
                          {vinculacao.contrato.numero}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {vinculacao.contrato.nome}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">
                          {vinculacao.centroCusto.num_centro_custo}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {vinculacao.centroCusto.nome_centro_custo}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{vinculacao.contrato.cliente}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatDate(vinculacao.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isEditor && (
                          <button
                            type="button"
                            onClick={() => handleDelete(vinculacao)}
                            disabled={saving}
                            className="inline-flex h-8 items-center justify-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 text-xs font-medium text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Remover
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>
        </div>
      </main>
    </ProtectedRoute>
  );
}
