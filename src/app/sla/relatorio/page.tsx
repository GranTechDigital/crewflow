"use client";
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Transition } from "@headlessui/react";
import {
  ChartBarIcon,
  UserGroupIcon,
  AcademicCapIcon,
  HeartIcon,
  BuildingOfficeIcon,
  TruckIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  TrophyIcon,
  StarIcon,
  ArrowTrendingUpIcon,
} from "@heroicons/react/24/outline";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LabelList,
} from "recharts";
import * as XLSX from "xlsx";

type KPISet = {
  periodoDias: number;
  porSetor: {
    setor: string;
    qtdTarefas: number;
    duracaoMediaAtuacaoMs: number;
    tempoMedioConclusaoMs: number;
    reprovações: number;
  }[];
  porRemanejamento: {
    remanejamentoId: string | number;
    solicitacaoId: number;
    funcionario: { id: number; nome: string; matricula: string } | null;
    totalDurMs: number;
    temposMediosPorSetor: { setor: string; tempoMedioMs: number }[];
    periodosPorSetor?: { setor: string; inicio: string; fim: string }[];
    duracaoPorSetorMs?: { setor: string; ms: number }[];
    solicitacaoDataCriacao?: string | null;
    remanejamentoDataConclusao?: string | null;
  }[];
  reprovacoesPorTipo?: Record<string, number>;
};

function fmtMs(ms: number) {
  const d = Math.floor(ms / (24 * 60 * 60 * 1000));
  const h = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const m = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  return `${d}d ${h}h ${m}m`;
}

export default function RelatorioSLA() {
  const [data, setData] = useState<KPISet | null>(null);
  const somenteConcluidos = true;
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"simples" | "detalhado">(
    "detalhado"
  );
  const [page, setPage] = useState<number>(1);
  const rowsPerPage = 5;

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (somenteConcluidos) params.set("concluidos", "true");
      const resp = await fetch(`/api/sla/relatorio?${params.toString()}`, {
        credentials: "include",
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();
      setData(json as KPISet);
    } catch (e: any) {
      setError(e?.message || "Falha ao carregar");
    } finally {
      setLoading(false);
    }
  }, [somenteConcluidos]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const setoresDisponiveis = useMemo(() => {
    // Fixar colunas principais para consistência e incluir logística
    return ["RH", "MEDICINA", "TREINAMENTO", "LOGISTICA"];
  }, []);

  const requiredSetores = useMemo(
    () => ["RH", "MEDICINA", "TREINAMENTO", "LOGISTICA"],
    []
  );
  const MIN_VALID_MS = 1 * 1000; // 1s

  const porRemanejamentoValidos = useMemo(() => {
    if (!data) return [] as KPISet["porRemanejamento"];
    return data.porRemanejamento.filter((r) =>
      requiredSetores.some((s) => {
        const entry = (r.temposMediosPorSetor || []).find(
          (x) => x.setor.toUpperCase() === s.toUpperCase()
        );
        const dur = (r.duracaoPorSetorMs || []).find(
          (x) => x.setor.toUpperCase() === s.toUpperCase()
        );
        const okMedia =
          entry && entry.tempoMedioMs && entry.tempoMedioMs >= MIN_VALID_MS;
        const okDur = dur && (dur.ms || 0) >= MIN_VALID_MS;
        return okMedia || okDur;
      })
    );
  }, [data, requiredSetores, MIN_VALID_MS]);

  const porSetorBase = useMemo(() => {
    if (!data) return [] as KPISet["porSetor"];
    return data.porSetor;
  }, [data]);

  // gráfico de downtime removido (foque no tempo médio)

  const chartData = useMemo(() => {
    return porSetorBase.map((s) => {
      const baseMs = s.tempoMedioConclusaoMs || s.duracaoMediaAtuacaoMs || 0;
      return { setor: s.setor, horas: Math.round(baseMs / (60 * 60 * 1000)) };
    });
  }, [porSetorBase]);

  const mediaGeralHoras = useMemo(() => {
    const total = chartData.reduce((acc, d) => acc + (d.horas || 0), 0);
    const count = chartData.length || 1;
    return Math.round(total / count);
  }, [chartData]);

  const exportDetalhadoXLSX = useCallback(() => {
    if (!data) return;
    const rows: any[] = [];
    porRemanejamentoValidos.forEach((r) => {
      setoresDisponiveis.forEach((s) => {
        const per = (r.periodosPorSetor || []).find(
          (x) => x.setor.toUpperCase() === s.toUpperCase()
        );
        const durEntry = (r.duracaoPorSetorMs || []).find(
          (x) => x.setor.toUpperCase() === s.toUpperCase()
        );
        const mediaEntry = (r.temposMediosPorSetor || []).find(
          (x) => x.setor.toUpperCase() === s.toUpperCase()
        );
        rows.push({
          Remanejamento: String(r.remanejamentoId),
          Funcionario: r.funcionario?.nome || "",
          Matricula: r.funcionario?.matricula || "",
          Setor: s,
          Inicio: per?.inicio
            ? new Date(per.inicio).toLocaleString("pt-BR")
            : "",
          Fim: per?.fim ? new Date(per.fim).toLocaleString("pt-BR") : "",
          Duracao: durEntry?.ms ? fmtMs(durEntry.ms) : "",
          MediaConclusao: mediaEntry?.tempoMedioMs
            ? fmtMs(mediaEntry.tempoMedioMs)
            : "",
          TotalRemanejamento: fmtMs(r.totalDurMs),
        });
      });
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Detalhado");
    XLSX.writeFile(wb, "Relatorio_SLA_Detalhado.xlsx");
  }, [data, porRemanejamentoValidos, setoresDisponiveis]);

  type DetalhadoKPIs = {
    total: number;
    mediaTotalMs: number;
    setorMaisLento: { setor: string; ms: number } | null;
    reprovsTotal: number;
    setorMaiorConclusao: { setor: string; ms: number } | null;
    percentLogistica: number;
  };

  const detalhadoKPIs = useMemo<DetalhadoKPIs>(() => {
    const total = porRemanejamentoValidos.length;
    const mediaTotalMs = total
      ? Math.round(
          porRemanejamentoValidos.reduce((a, r) => a + (r.totalDurMs || 0), 0) /
            total
        )
      : 0;
    const durBySetor: Record<string, number> = {};
    let logisticCount = 0;
    porRemanejamentoValidos.forEach((r) => {
      let hasLog = false;
      (r.duracaoPorSetorMs || []).forEach((d) => {
        const key = (d.setor || "").toUpperCase();
        durBySetor[key] = (durBySetor[key] || 0) + (d.ms || 0);
        if (key === "LOGISTICA" && (d.ms || 0) > 0) hasLog = true;
      });
      if (
        !hasLog &&
        (r.periodosPorSetor || []).some(
          (p) => (p.setor || "").toUpperCase() === "LOGISTICA"
        )
      )
        logisticCount++;
      else if (hasLog) logisticCount++;
    });
    let setorMaisLento: { setor: string; ms: number } | null = null;
    Object.entries(durBySetor).forEach(([setor, ms]) => {
      if (!setorMaisLento || ms > setorMaisLento.ms)
        setorMaisLento = { setor, ms };
    });
    const reprovsTotal = porSetorBase.reduce(
      (acc, s) => acc + (s.reprovações || 0),
      0
    );
    const setorMaiorConclusao = porSetorBase.reduce<{
      setor: string;
      ms: number;
    } | null>((acc, s) => {
      const ms = s.tempoMedioConclusaoMs || 0;
      if (!acc || ms > acc.ms) return { setor: s.setor, ms };
      return acc;
    }, null);
    const percentLogistica = total
      ? Math.round((logisticCount / total) * 100)
      : 0;
    return {
      total,
      mediaTotalMs,
      setorMaisLento,
      reprovsTotal,
      setorMaiorConclusao,
      percentLogistica,
    };
  }, [porRemanejamentoValidos, porSetorBase]);

  const totalRows = porRemanejamentoValidos.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / rowsPerPage));
  const pageData = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    return porRemanejamentoValidos.slice(start, end);
  }, [porRemanejamentoValidos, page]);

  const rankingSetores = useMemo(() => {
    const fixed = setoresDisponiveis.map((s) => s.toUpperCase());
    const items = porSetorBase.filter((s) =>
      fixed.includes((s.setor || "").toUpperCase())
    );
    return [...items].sort((a, b) => {
      const valA = a.tempoMedioConclusaoMs || a.duracaoMediaAtuacaoMs || 0;
      const valB = b.tempoMedioConclusaoMs || b.duracaoMediaAtuacaoMs || 0;
      return valA - valB;
    });
  }, [porSetorBase, setoresDisponiveis]);

  const topReprovacoes = useMemo(() => {
    const entries = Object.entries(data?.reprovacoesPorTipo || {});
    entries.sort((a, b) => (b[1] || 0) - (a[1] || 0));
    return entries.slice(0, 5);
  }, [data]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="w-full max-w-none mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            Relatório de atendimentos realizados
          </h1>
          <p className="text-gray-600">Visão por setor</p>
        </div>

        {loading && (
          <div className="text-center py-10">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        )}
        {error && <div className="text-center py-6 text-red-600">{error}</div>}

        {data && (
          <div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-4">
              <div className="border-b border-gray-200">
                <nav className="flex space-x-8 px-6" aria-label="Tabs">
                  {[
                    { id: "detalhado", name: "Visão Geral", icon: ClockIcon },
                    {
                      id: "simples",
                      name: "Visão Simples",
                      icon: ChartBarIcon,
                    },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 transition-colors ${
                        activeTab === (tab.id as any)
                          ? "border-blue-500 text-blue-600"
                          : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                      }`}
                    >
                      <tab.icon className="w-4 h-4" />
                      <span>{tab.name}</span>
                    </button>
                  ))}
                </nav>
              </div>
            </div>
            {activeTab === "simples" && (
              <Transition
                appear
                show={!!data}
                enter="transform transition duration-300"
                enterFrom="opacity-0 translate-y-2"
                enterTo="opacity-100 translate-y-0"
              >
                <div className="rounded-2xl bg-white shadow-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <ChartBarIcon className="h-5 w-5 text-indigo-600" />
                      <h3 className="text-lg font-semibold text-gray-800">
                        Tempo médio de conclusão por setor (h)
                      </h3>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-50 text-blue-700">
                        <ClockIcon className="h-4 w-4" /> Média geral:{" "}
                        {mediaGeralHoras}h
                      </span>
                    </div>
                  </div>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <defs>
                          <linearGradient
                            id="barGrad"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop offset="0%" stopColor="#60A5FA" />
                            <stop offset="100%" stopColor="#8B5CF6" />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                        <XAxis dataKey="setor" tick={{ fill: "#6B7280" }} />
                        <YAxis tick={{ fill: "#6B7280" }} />
                        <Tooltip />
                        <Legend />
                        <Bar
                          dataKey="horas"
                          fill="url(#barGrad)"
                          radius={[8, 8, 0, 0]}
                        >
                          <LabelList dataKey="horas" position="top" />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </Transition>
            )}

            {activeTab === "simples" && (
              <Transition
                appear
                show={!!data}
                enter="transform transition duration-300"
                enterFrom="opacity-0 translate-y-2"
                enterTo="opacity-100 translate-y-0"
              >
                <div className="mt-6 rounded-2xl bg-white shadow-xl overflow-x-auto">
                  <div className="px-4 py-3 flex items-center justify-between bg-gray-50 rounded-t-2xl">
                    <div className="flex items-center gap-2">
                      <UserGroupIcon className="h-5 w-5 text-indigo-600" />
                      <h3 className="text-sm font-semibold text-gray-800">
                        Tempo médio por setor — por remanejamento
                      </h3>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500">
                        {porRemanejamentoValidos.length} linha(s)
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          disabled={page <= 1}
                          className={`px-2 py-1 text-xs border rounded ${
                            page <= 1
                              ? "opacity-50 cursor-not-allowed"
                              : "hover:bg-gray-100"
                          }`}
                        >
                          Anterior
                        </button>
                        <span className="text-xs text-gray-600">
                          Página {page} de {totalPages}
                        </span>
                        <button
                          onClick={() =>
                            setPage((p) => Math.min(totalPages, p + 1))
                          }
                          disabled={page >= totalPages}
                          className={`px-2 py-1 text-xs border rounded ${
                            page >= totalPages
                              ? "opacity-50 cursor-not-allowed"
                              : "hover:bg-gray-100"
                          }`}
                        >
                          Próxima
                        </button>
                      </div>
                    </div>
                  </div>
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-100 sticky top-0 z-10">
                      <tr>
                        <th className="text-left px-3 py-2">Remanejamento</th>
                        <th className="text-left px-3 py-2">Funcionário</th>
                        <th className="text-left px-3 py-2">
                          <span className="inline-flex items-center gap-1">
                            <ClockIcon className="h-4 w-4 text-blue-600" />{" "}
                            Total
                          </span>
                        </th>
                        {setoresDisponiveis.map((s) => {
                          const iconMap: Record<string, any> = {
                            RH: BuildingOfficeIcon,
                            MEDICINA: HeartIcon,
                            TREINAMENTO: AcademicCapIcon,
                            LOGISTICA: TruckIcon,
                          };
                          const Icon = iconMap[s] || ChartBarIcon;
                          return (
                            <th
                              key={`head-${s}`}
                              className="text-left px-3 py-2"
                            >
                              <span className="inline-flex items-center gap-1">
                                <Icon className="h-4 w-4 text-gray-600" /> {s}
                              </span>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {pageData.map((r) => (
                        <tr
                          key={`det-${r.remanejamentoId}`}
                          className="border-t odd:bg-gray-50 hover:bg-gray-50"
                        >
                          <td className="px-3 py-2 text-gray-800">
                            {String(r.remanejamentoId)}
                          </td>
                          <td className="px-3 py-2 text-gray-800">
                            {r.funcionario?.nome} ({r.funcionario?.matricula})
                          </td>
                          <td className="px-3 py-2 text-gray-800">
                            <span className="inline-flex items-center px-2 py-1 rounded-full bg-blue-50 text-blue-700">
                              {fmtMs(r.totalDurMs)}
                            </span>
                          </td>
                          {setoresDisponiveis.map((s) => {
                            const entry = (r.temposMediosPorSetor || []).find(
                              (x) => x.setor.toUpperCase() === s.toUpperCase()
                            );
                            const ms = entry ? entry.tempoMedioMs : 0;
                            const show = ms >= MIN_VALID_MS;
                            return (
                              <td
                                key={`cell-${r.remanejamentoId}-${s}`}
                                className="px-3 py-2 text-gray-800"
                              >
                                {show ? (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full bg-green-50 text-green-700">
                                    {fmtMs(ms)}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full bg-gray-100 text-gray-500">
                                    —
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Transition>
            )}

            {activeTab === "detalhado" && (
              <Transition
                appear
                show={!!data}
                enter="transform transition duration-300"
                enterFrom="opacity-0 translate-y-2"
                enterTo="opacity-100 translate-y-0"
              >
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
                  <div className="flex flex-col gap-4 lg:col-span-1">
                    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">
                          Total de Remanejamentos Concluídos
                        </p>
                        <p className="text-2xl font-bold text-gray-900">
                          {data?.porRemanejamento?.length ?? 0}
                        </p>
                      </div>
                      <div className="p-3 bg-blue-500 rounded-full">
                        <UserGroupIcon className="w-6 h-6 text-white" />
                      </div>
                    </div>
                    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">
                          Média duração total
                        </p>
                        <p className="text-2xl font-bold text-gray-900">
                          {fmtMs(detalhadoKPIs.mediaTotalMs)}
                        </p>
                        <p className="text-xs text-gray-500">
                          Por remanejamento
                        </p>
                      </div>
                      <div className="p-3 bg-indigo-500 rounded-full">
                        <ClockIcon className="w-6 h-6 text-white" />
                      </div>
                    </div>
                    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-sm font-medium text-gray-600">
                            Ranking por setor (rápido → lento)
                          </p>
                          <p className="text-xs text-gray-500">
                            Tempo médio de conclusão
                          </p>
                        </div>
                        <div className="p-3 bg-yellow-500 rounded-full">
                          <TrophyIcon className="w-6 h-6 text-white" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        {rankingSetores.map((s, idx) => {
                          const isLast = idx === rankingSetores.length - 1;
                          return (
                            <div
                              key={`rank-${s.setor}`}
                              className="flex items-center justify-between"
                            >
                              <div className="flex items-center gap-2">
                                {idx === 0 ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700">
                                    <TrophyIcon className="w-4 h-4" /> #
                                    {idx + 1}
                                  </span>
                                ) : idx === 1 ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                                    <StarIcon className="w-4 h-4" /> #{idx + 1}
                                  </span>
                                ) : idx === 2 ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                                    <StarIcon className="w-4 h-4" /> #{idx + 1}
                                  </span>
                                ) : isLast ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-700">
                                    <ArrowTrendingUpIcon className="w-4 h-4" />{" "}
                                    Precisa melhorar
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">
                                    #{idx + 1}
                                  </span>
                                )}
                                <span className="text-sm font-medium text-gray-800">
                                  {s.setor}
                                </span>
                              </div>
                              <span className="text-xs text-gray-600">
                                {fmtMs(
                                  s.tempoMedioConclusaoMs ||
                                    s.duracaoMediaAtuacaoMs ||
                                    0
                                )}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">
                          Média de conclusão (geral)
                        </p>
                        <p className="text-2xl font-bold text-gray-900">
                          {mediaGeralHoras}h
                        </p>
                        <p className="text-xs text-gray-500">
                          Tempo médio por setor
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {setoresDisponiveis.map((s) => {
                            const item = porSetorBase.find(
                              (x) =>
                                (x.setor || "").toUpperCase() ===
                                s.toUpperCase()
                            );
                            const ms = item
                              ? item.tempoMedioConclusaoMs ||
                                item.duracaoMediaAtuacaoMs ||
                                0
                              : 0;
                            const h = Math.round(ms / (60 * 60 * 1000));
                            const cls =
                              s === "RH"
                                ? "bg-blue-50 text-blue-700"
                                : s === "MEDICINA"
                                ? "bg-emerald-50 text-emerald-700"
                                : s === "TREINAMENTO"
                                ? "bg-violet-50 text-violet-700"
                                : "bg-pink-50 text-pink-700";
                            return (
                              <span
                                key={`badge-${s}`}
                                className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${cls}`}
                              >
                                {s}: {h}h
                              </span>
                            );
                          })}
                        </div>
                      </div>
                      <div className="p-3 bg-green-500 rounded-full">
                        <CheckCircleIcon className="w-6 h-6 text-white" />
                      </div>
                    </div>
                    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-sm font-medium text-gray-600">
                            Reprovações por tipo de tarefa
                          </p>
                          <p className="text-xs text-gray-500">
                            Top 5 mais reprovadas
                          </p>
                        </div>
                        <div className="p-3 bg-red-500 rounded-full">
                          <ExclamationTriangleIcon className="w-6 h-6 text-white" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        {topReprovacoes.length > 0 ? (
                          topReprovacoes.map(([tipo, qtd]) => (
                            <div
                              key={`rep-${tipo}`}
                              className="flex items-center justify-between"
                            >
                              <span className="text-sm text-gray-800">
                                {tipo}
                              </span>
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-xs">
                                {qtd} reprovação(ões)
                              </span>
                            </div>
                          ))
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded bg-gray-100 text-gray-600 text-xs">
                            [0 reprovadas]
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-4 lg:col-span-2">
                    <div className="rounded-2xl bg-white shadow-xl p-4 h-[240px]">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <ChartBarIcon className="h-5 w-5 text-indigo-600" />
                          <h3 className="text-lg font-semibold text-gray-800">
                            Tempo médio de conclusão por setor (h)
                          </h3>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-50 text-blue-700">
                            <ClockIcon className="h-4 w-4" /> Média geral:{" "}
                            {mediaGeralHoras}h
                          </span>
                        </div>
                      </div>
                      <div className="h-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData}>
                            <defs>
                              <linearGradient
                                id="barGrad2"
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                              >
                                <stop offset="0%" stopColor="#60A5FA" />
                                <stop offset="100%" stopColor="#8B5CF6" />
                              </linearGradient>
                            </defs>
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke="#E5E7EB"
                            />
                            <XAxis dataKey="setor" tick={{ fill: "#6B7280" }} />
                            <YAxis tick={{ fill: "#6B7280" }} />
                            <Tooltip />
                            <Legend />
                            <Bar
                              dataKey="horas"
                              fill="url(#barGrad2)"
                              radius={[8, 8, 0, 0]}
                            >
                              <LabelList dataKey="horas" position="top" />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <div className="rounded-2xl bg-white shadow-xl w-full flex-1 overflow-hidden">
                      <div className="px-4 py-3 flex items-center justify-between bg-gray-50 rounded-t-2xl">
                        <div className="flex items-center gap-2">
                          <UserGroupIcon className="h-5 w-5 text-indigo-600" />
                          <h3 className="text-sm font-semibold text-gray-800">
                            Período por setor — por remanejamento
                          </h3>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-500">
                            {porRemanejamentoValidos.length} linha(s)
                          </span>
                          <button
                            onClick={exportDetalhadoXLSX}
                            className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded hover:bg-gray-100"
                          >
                            Exportar
                          </button>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setPage((p) => Math.max(1, p - 1))}
                              disabled={page <= 1}
                              className={`px-2 py-1 text-xs border rounded ${
                                page <= 1
                                  ? "opacity-50 cursor-not-allowed"
                                  : "hover:bg-gray-100"
                              }`}
                            >
                              Anterior
                            </button>
                            <span className="text-xs text-gray-600">
                              Página {page} de {totalPages}
                            </span>
                            <button
                              onClick={() =>
                                setPage((p) => Math.min(totalPages, p + 1))
                              }
                              disabled={page >= totalPages}
                              className={`px-2 py-1 text-xs border rounded ${
                                page >= totalPages
                                  ? "opacity-50 cursor-not-allowed"
                                  : "hover:bg-gray-100"
                              }`}
                            >
                              Próxima
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="h-full overflow-y-auto">
                        <table className="min-w-full divide-y divide-gray-200 text-sm w-full">
                          <thead className="bg-gray-50 sticky top-0 z-10">
                            <tr>
                              <th className="text-left px-3 py-2 text-xs font-medium text-gray-600 uppercase tracking-wider">
                                Funcionário
                              </th>
                              {setoresDisponiveis.map((s) => {
                                const iconMap: Record<string, any> = {
                                  RH: BuildingOfficeIcon,
                                  MEDICINA: HeartIcon,
                                  TREINAMENTO: AcademicCapIcon,
                                  LOGISTICA: TruckIcon,
                                };
                                const Icon = iconMap[s] || ChartBarIcon;
                                return (
                                  <th
                                    key={`head-det-${s}`}
                                    className="text-left px-3 py-2 text-xs font-medium text-gray-600 uppercase tracking-wider whitespace-nowrap"
                                  >
                                    <span className="inline-flex items-center gap-1">
                                      <Icon className="h-4 w-4 text-gray-600" />{" "}
                                      {s}
                                    </span>
                                  </th>
                                );
                              })}
                              <th className="text-left px-3 py-2 text-xs font-medium text-gray-600 uppercase tracking-wider whitespace-nowrap">
                                <span className="inline-flex items-center gap-1">
                                  <ClockIcon className="h-4 w-4 text-gray-600" />{" "}
                                  Total
                                </span>
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {pageData.map((r) => (
                              <tr
                                key={`det-d-${r.remanejamentoId}`}
                                className="hover:bg-gray-50"
                              >
                                <td className="px-3 py-2 text-gray-800">
                                  <div className="flex flex-col">
                                    <span className="font-medium">
                                      {r.funcionario?.nome || ""}
                                    </span>
                                    <span className="text-xs text-gray-600">
                                      Matrícula:{" "}
                                      {r.funcionario?.matricula || ""}
                                    </span>
                                    <span className="text-xs text-gray-600">
                                      Remanejamento: {String(r.remanejamentoId)}
                                    </span>
                                  </div>
                                </td>
                                {setoresDisponiveis.map((s) => {
                                  const periodEntry = (
                                    r.periodosPorSetor || []
                                  ).find(
                                    (x) =>
                                      x.setor.toUpperCase() === s.toUpperCase()
                                  );
                                  const durEntry = (
                                    r.duracaoPorSetorMs || []
                                  ).find(
                                    (x) =>
                                      x.setor.toUpperCase() === s.toUpperCase()
                                  );
                                  return (
                                    <td
                                      key={`cell-d-${r.remanejamentoId}-${s}`}
                                      className="px-3 py-2 text-gray-800 whitespace-nowrap"
                                    >
                                      {periodEntry ? (
                                        <div className="flex flex-col gap-1">
                                          <span className="inline-flex items-center px-2 py-1 rounded-full bg-indigo-50 text-indigo-700">
                                            Início:{" "}
                                            {new Date(
                                              periodEntry.inicio
                                            ).toLocaleString("pt-BR")}
                                          </span>
                                          <span className="inline-flex items-center px-2 py-1 rounded-full bg-purple-50 text-purple-700">
                                            Fim:{" "}
                                            {new Date(
                                              periodEntry.fim
                                            ).toLocaleString("pt-BR")}
                                          </span>
                                          <span className="inline-flex items-center px-2 py-1 rounded-full bg-green-50 text-green-700">
                                            Duração:{" "}
                                            {durEntry?.ms
                                              ? fmtMs(durEntry.ms)
                                              : (() => {
                                                  const ms = Math.max(
                                                    0,
                                                    new Date(
                                                      periodEntry.fim
                                                    ).getTime() -
                                                      new Date(
                                                        periodEntry.inicio
                                                      ).getTime()
                                                  );
                                                  return ms ? fmtMs(ms) : "—";
                                                })()}
                                          </span>
                                        </div>
                                      ) : (
                                        <span className="inline-flex items-center px-2 py-1 rounded-full bg-gray-100 text-gray-500">
                                          —
                                        </span>
                                      )}
                                    </td>
                                  );
                                })}
                                <td className="px-3 py-2 text-gray-800 whitespace-nowrap">
                                  <span className="inline-flex items-center px-2 py-1 rounded-full bg-blue-50 text-blue-700">
                                    {fmtMs(r.totalDurMs)}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </Transition>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
