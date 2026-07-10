"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Filter,
  GraduationCap,
  Loader2,
  Search,
} from "lucide-react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { ROUTE_PROTECTION } from "@/lib/permissions";

type FuncaoSemMatriz = {
  key: string;
  contratoId: number;
  contratoNumero: string;
  contratoNome: string;
  funcaoId: number | null;
  funcao: string;
  regime: string | null;
  origem: "REMANEJAMENTO" | "FUNCIONARIO_ATUAL";
  prioridade: 1 | 2 | 3;
  totalFuncionarios: number;
  totalEmRemanejamento: number;
  totalAprovados: number;
  totalAguardandoAprovacao: number;
  exemplos: {
    remanejamentoId?: string;
    funcionarioId: number;
    nome: string;
    matricula: string;
    statusTarefas?: string | null;
    statusPrestserv?: string | null;
    aprovado?: boolean;
  }[];
};

type ApiResponse = {
  success: boolean;
  data: FuncaoSemMatriz[];
  resumo: {
    total: number;
    offshore: number;
    offshoreEmRemanejamento: number;
    comRemanejamento: number;
    aprovados: number;
  };
  error?: string;
};

type FilterValue = "todos" | "offshore_remanejamento" | "offshore" | "aprovados";

function isOffshore(regime?: string | null) {
  return String(regime || "").toUpperCase().includes("OFFSHORE");
}

function prioridadeLabel(prioridade: number) {
  if (prioridade === 1) return "Offshore em remanejamento";
  if (prioridade === 2) return "Offshore";
  return "Demais funções";
}

function prioridadeClass(prioridade: number) {
  if (prioridade === 1) return "bg-red-50 text-red-700 border-red-200";
  if (prioridade === 2) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
}

export default function FuncoesSemMatrizPage() {
  return (
    <ProtectedRoute
      requiredPermissions={ROUTE_PROTECTION.MATRIZ_TREINAMENTO.requiredPermissions}
      requiredEquipe={ROUTE_PROTECTION.MATRIZ_TREINAMENTO.requiredEquipe}
    >
      <FuncoesSemMatrizContent />
    </ProtectedRoute>
  );
}

function FuncoesSemMatrizContent() {
  const [rows, setRows] = useState<FuncaoSemMatriz[]>([]);
  const [resumo, setResumo] = useState<ApiResponse["resumo"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterValue>("offshore_remanejamento");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialSearch = params.get("search");
    if (initialSearch) {
      setSearch(initialSearch);
      setFilter("todos");
    }

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch("/api/treinamento/funcoes-sem-matriz");
        const data: ApiResponse = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.error || "Erro ao carregar funções sem matriz");
        }
        setRows(data.data);
        setResumo(data.resumo);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro desconhecido");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesSearch =
        !term ||
        row.funcao.toLowerCase().includes(term) ||
        row.contratoNumero.toLowerCase().includes(term) ||
        row.contratoNome.toLowerCase().includes(term) ||
        row.exemplos.some((exemplo) =>
          `${exemplo.nome} ${exemplo.matricula}`.toLowerCase().includes(term),
        );

      const matchesFilter =
        filter === "todos" ||
        (filter === "offshore_remanejamento" && row.prioridade === 1) ||
        (filter === "offshore" && isOffshore(row.regime)) ||
        (filter === "aprovados" && row.totalAprovados > 0);

      return matchesSearch && matchesFilter;
    });
  }, [rows, search, filter]);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white">
                <GraduationCap className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-slate-950">
                  Funções Sem Matriz
                </h1>
                <p className="text-sm text-slate-600">
                  Fila de contrato/função sem matriz AP/RA ativa para Treinamento.
                </p>
              </div>
            </div>
          </div>

          <Link
            href="/matriz-treinamento/contratos"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800"
          >
            Abrir matriz
            <ExternalLink className="h-4 w-4" />
          </Link>
        </header>

        <section className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-5">
          {[
            ["Total", resumo?.total ?? 0],
            ["Offshore", resumo?.offshore ?? 0],
            ["Offshore em remanejamento", resumo?.offshoreEmRemanejamento ?? 0],
            ["Com remanejamento", resumo?.comRemanejamento ?? 0],
            ["Já aprovados", resumo?.aprovados ?? 0],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-lg border border-slate-200 bg-white px-4 py-3"
            >
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {label}
              </div>
              <div className="mt-1 text-2xl font-semibold text-slate-950">
                {value}
              </div>
            </div>
          ))}
        </section>

        <section className="mb-5 rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar função, contrato, matrícula ou funcionário"
                className="h-10 w-full rounded-md border border-slate-300 pl-9 pr-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-500" />
              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value as FilterValue)}
                className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              >
                <option value="offshore_remanejamento">
                  Offshore em remanejamento
                </option>
                <option value="offshore">Todas offshore</option>
                <option value="aprovados">Com solicitação aprovada</option>
                <option value="todos">Todas</option>
              </select>
            </div>
          </div>
        </section>

        {loading ? (
          <div className="flex h-56 items-center justify-center rounded-lg border border-slate-200 bg-white">
            <Loader2 className="mr-2 h-5 w-5 animate-spin text-slate-500" />
            <span className="text-sm text-slate-600">Carregando fila...</span>
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 text-sm text-emerald-800">
            Nenhuma função encontrada para os filtros selecionados.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">
                      Prioridade
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">
                      Contrato
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">
                      Função
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">
                      Remanejamento
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">
                      Solicitação inicial
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">
                      Funcionários
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">
                      Ação
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRows.map((row) => (
                    <tr key={row.key} className="align-top hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${prioridadeClass(row.prioridade)}`}
                        >
                          {prioridadeLabel(row.prioridade)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-950">
                          {row.contratoNumero}
                        </div>
                        <div className="max-w-xs truncate text-xs text-slate-500">
                          {row.contratoNome}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-950">
                          {row.funcao}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {row.regime || "Regime não identificado"}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-950">
                          {row.totalEmRemanejamento}
                        </div>
                        <div className="text-xs text-slate-500">
                          {row.origem === "REMANEJAMENTO"
                            ? "há funcionário em processo"
                            : "sem processo aberto"}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {row.totalAprovados > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {row.totalAprovados} liberada(s)
                          </span>
                        ) : row.totalAguardandoAprovacao > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            aguardando aprovação
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500">N/A</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-950">
                          {row.totalFuncionarios}
                        </div>
                        <div className="mt-1 max-w-sm text-xs text-slate-500">
                          {row.exemplos
                            .map((exemplo) => `${exemplo.nome} (${exemplo.matricula})`)
                            .join(", ")}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/matriz-treinamento/contratos/${row.contratoId}`}
                          className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 px-3 text-xs font-medium text-slate-700 hover:bg-slate-100"
                        >
                          Criar matriz
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
