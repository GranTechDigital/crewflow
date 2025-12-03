"use client";
import React, { useEffect, useMemo, useState, useCallback, Fragment } from "react";
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
  PieChart,
  Pie,
  Cell,
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

function fmtDias(ms: number) {
  const DAY = 24 * 60 * 60 * 1000;
  if (ms < DAY) return "< 1 dia";
  const dias = Math.floor(ms / DAY);
  return dias === 1 ? "1 dia" : `${dias} dias`;
}

export default function RelatorioSLA() {
  const [data, setData] = useState<KPISet | null>(null);
  const somenteConcluidos = true;
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"simples" | "detalhado" | "dias">(
    "detalhado"
  );
  const [page, setPage] = useState<number>(1);
  const rowsPerPage = 5;
  const [filtroSetores, setFiltroSetores] = useState<string[]>(["RH", "MEDICINA", "TREINAMENTO", "LOGISTICA"]);
  const [filtroBuckets, setFiltroBuckets] = useState<string[]>(["lt1", "d1to3", "d3to7", "gt7"]);
  const [filtroFuncionario, setFiltroFuncionario] = useState<string>("");

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

  const chartDataDias = useMemo(() => {
    return porSetorBase.map((s) => {
      const baseMs = s.tempoMedioConclusaoMs || s.duracaoMediaAtuacaoMs || 0;
      return { setor: s.setor, dias: Math.floor(baseMs / (24 * 60 * 60 * 1000)) };
    });
  }, [porSetorBase]);

  const donutMediaSetorDias = useMemo(() => {
    const DAY = 24 * 60 * 60 * 1000;
    const items = setoresDisponiveis.map((s) => {
      const item = porSetorBase.find(
        (x) => (x.setor || "").toUpperCase() === s.toUpperCase()
      );
      const ms = item
        ? item.tempoMedioConclusaoMs || item.duracaoMediaAtuacaoMs || 0
        : 0;
      const dias = ms / DAY;
      return { setor: s, dias };
    });
    const totalDias = items.reduce((acc, it) => acc + it.dias, 0) || 1;
    return items.map((it) => ({
      ...it,
      pct: (it.dias / totalDias) * 100,
    }));
  }, [porSetorBase, setoresDisponiveis]);

  const mediaGeralHoras = useMemo(() => {
    const total = chartData.reduce((acc, d) => acc + (d.horas || 0), 0);
    const count = chartData.length || 1;
    return Math.round(total / count);
  }, [chartData]);

  const mediaGeralDias = useMemo(() => {
    const DAY = 24 * 60 * 60 * 1000;
    const valoresMs = porSetorBase.map((s) => s.tempoMedioConclusaoMs || s.duracaoMediaAtuacaoMs || 0);
    const totalMs = valoresMs.reduce((acc, ms) => acc + ms, 0);
    const count = valoresMs.length || 1;
    const mediaDias = totalMs / count / DAY;
    return Math.round(mediaDias);
  }, [porSetorBase]);

  const pieSetoresDias = useMemo(() => {
    const durBySetor: Record<string, number> = {};
    porRemanejamentoValidos.forEach((r) => {
      (r.duracaoPorSetorMs || []).forEach((d) => {
        const key = (d.setor || "").toUpperCase();
        durBySetor[key] = (durBySetor[key] || 0) + (d.ms || 0);
      });
    });
    const DAY = 24 * 60 * 60 * 1000;
    const items = setoresDisponiveis.map((s) => {
      const ms = durBySetor[(s || "").toUpperCase()] || 0;
      const dias = ms / DAY;
      return { setor: s, dias };
    });
    const totalDias = items.reduce((acc, it) => acc + it.dias, 0) || 1;
    return items.map((it) => ({ ...it, pct: (it.dias / totalDias) * 100 }));
  }, [porRemanejamentoValidos, setoresDisponiveis]);

  const bucketDistribDias = useMemo(() => {
    const DAY = 24 * 60 * 60 * 1000;
    const counts = { lt1: 0, d1to3: 0, d3to7: 0, gt7: 0 };
    porRemanejamentoValidos.forEach((r) => {
      const ms = r.totalDurMs || 0;
      if (ms < DAY) counts.lt1++;
      else if (ms < 3 * DAY) counts.d1to3++;
      else if (ms < 7 * DAY) counts.d3to7++;
      else counts.gt7++;
    });
    return [
      { faixa: "< 1 dia", count: counts.lt1 },
      { faixa: "1–3 dias", count: counts.d1to3 },
      { faixa: "3–7 dias", count: counts.d3to7 },
      { faixa: "> 7 dias", count: counts.gt7 },
    ];
  }, [porRemanejamentoValidos]);

  const stackDistribBucketsSetores = useMemo(() => {
    const DAY = 24 * 60 * 60 * 1000;
    const initBucket = () => ({ faixa: "", RH: 0, MEDICINA: 0, TREINAMENTO: 0, LOGISTICA: 0, total: 0 });
    const buckets: Record<string, { faixa: string; RH: number; MEDICINA: number; TREINAMENTO: number; LOGISTICA: number; total: number }> = {
      lt1: { ...initBucket(), faixa: "< 1 dia" },
      d1to3: { ...initBucket(), faixa: "1–3 dias" },
      d3to7: { ...initBucket(), faixa: "3–7 dias" },
      gt7: { ...initBucket(), faixa: "> 7 dias" },
    } as any;
    porRemanejamentoValidos.forEach((r) => {
      const msTotal = r.totalDurMs || 0;
      const key = msTotal < DAY ? "lt1" : msTotal < 3 * DAY ? "d1to3" : msTotal < 7 * DAY ? "d3to7" : "gt7";
      const bySetor: Record<string, number> = {};
      let sumMs = 0;
      (r.duracaoPorSetorMs || []).forEach((d) => {
        const k = (d.setor || "").toUpperCase();
        if (setoresDisponiveis.includes(k)) {
          bySetor[k] = (bySetor[k] || 0) + (d.ms || 0);
          sumMs += d.ms || 0;
        }
      });
      if (sumMs > 0) {
        Object.entries(bySetor).forEach(([s, v]) => {
          const w = v / sumMs; // proporção do setor no total
          (buckets as any)[key][s] += w; // soma ponderada
        });
        (buckets as any)[key].total += 1;
      } else {
        // fallback: dividir igual entre setores presentes em periodos/tempos
        const presentes = new Set<string>();
        (r.periodosPorSetor || []).forEach((p) => presentes.add((p.setor || "").toUpperCase()));
        (r.temposMediosPorSetor || []).forEach((t) => presentes.add((t.setor || "").toUpperCase()));
        const list = Array.from(presentes).filter((s) => setoresDisponiveis.includes(s));
        const w = list.length ? 1 / list.length : 0;
        list.forEach((s) => {
          (buckets as any)[key][s] += w;
        });
        (buckets as any)[key].total += 1;
      }
    });
    // converter para array
    return [buckets.lt1, buckets.d1to3, buckets.d3to7, buckets.gt7];
  }, [porRemanejamentoValidos, setoresDisponiveis]);

  const distribPorSetorBuckets = useMemo(() => {
    const DAY = 24 * 60 * 60 * 1000;
    const init = () => ({ setor: "", lt1: 0, d1to3: 0, d3to7: 0, gt7: 0, total: 0 });
    const map: Record<string, { setor: string; lt1: number; d1to3: number; d3to7: number; gt7: number; total: number }> = {};
    setoresDisponiveis.forEach((s) => {
      map[s.toUpperCase()] = { ...init(), setor: s };
    });
    porRemanejamentoValidos.forEach((r) => {
      (r.duracaoPorSetorMs || []).forEach((d) => {
        const s = (d.setor || "").toUpperCase();
        const ms = d.ms || 0;
        if (!setoresDisponiveis.includes(s) || ms <= 0) return;
        const key = ms < DAY ? "lt1" : ms < 3 * DAY ? "d1to3" : ms < 7 * DAY ? "d3to7" : "gt7";
        const obj = map[s];
        (obj as any)[key] += 1;
        obj.total += 1;
      });
    });
    return setoresDisponiveis.map((s) => map[s.toUpperCase()] || { setor: s, lt1: 0, d1to3: 0, d3to7: 0, gt7: 0, total: 0 });
  }, [porRemanejamentoValidos, setoresDisponiveis]);

  const porRemanejamentoFiltrados = useMemo(() => {
    const DAY = 24 * 60 * 60 * 1000;
    const hasSetor = (r: KPISet["porRemanejamento"][number]) => {
      if (!filtroSetores.length) return true;
      const presentes = new Set<string>();
      (r.periodosPorSetor || []).forEach((p) => presentes.add((p.setor || "").toUpperCase()));
      (r.duracaoPorSetorMs || []).forEach((d) => presentes.add((d.setor || "").toUpperCase()));
      return filtroSetores.some((s) => presentes.has(s.toUpperCase()));
    };
    const bucketKey = (ms: number) => (ms < DAY ? "lt1" : ms < 3 * DAY ? "d1to3" : ms < 7 * DAY ? "d3to7" : "gt7");
    const matchFuncionario = (r: KPISet["porRemanejamento"][number]) => {
      if (!filtroFuncionario) return true;
      const q = filtroFuncionario.toLowerCase();
      const nome = (r.funcionario?.nome || "").toLowerCase();
      const mat = (r.funcionario?.matricula || "").toLowerCase();
      return nome.includes(q) || mat.includes(q) || String(r.remanejamentoId).toLowerCase().includes(q);
    };
    return porRemanejamentoValidos.filter((r) => {
      const okSetor = hasSetor(r);
      const okBucket = !filtroBuckets.length || filtroBuckets.includes(bucketKey(r.totalDurMs || 0));
      const okFunc = matchFuncionario(r);
      return okSetor && okBucket && okFunc;
    });
  }, [porRemanejamentoValidos, filtroSetores, filtroBuckets, filtroFuncionario]);

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

  const totalRows = porRemanejamentoFiltrados.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / rowsPerPage));
  const pageData = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    return porRemanejamentoFiltrados.slice(start, end);
  }, [porRemanejamentoFiltrados, page]);

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
          <h1 className="text-2xl font-bold text-gray-900">
            Relatório de atendimentos realizados
          </h1>
          <p className="text-sm text-gray-600">Visão por setor</p>
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
                    {
                      id: "dias",
                      name: "Overview em dias",
                      icon: ClockIcon,
                    },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`py-3 px-1 border-b-2 font-medium text-xs flex items-center space-x-2 transition-colors ${
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
            {activeTab === "dias" && (
                <div className="space-y-4">
                <div className="mb-4 rounded-xl bg-white border border-gray-200 p-4">
                  <div className="flex flex-wrap items-end gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Setor</label>
                      <div className="flex flex-wrap gap-2">
                        {["RH", "MEDICINA", "TREINAMENTO", "LOGISTICA"].map((s) => {
                          const active = filtroSetores.includes(s);
                          const cls = active ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700";
                          return (
                            <button
                              key={`fsetor-${s}`}
                              onClick={() => {
                                setPage(1);
                                setFiltroSetores((prev) => {
                                  const has = prev.includes(s);
                                  if (has) return prev.filter((x) => x !== s);
                                  return [...prev, s];
                                });
                              }}
                              className={`px-2 py-1 rounded text-xs ${cls}`}
                            >
                              {s}
                            </button>
                          );
                        })}
                        <button
                          onClick={() => {
                            setPage(1);
                            setFiltroSetores(["RH", "MEDICINA", "TREINAMENTO", "LOGISTICA"]);
                          }}
                          className="px-2 py-1 rounded text-xs bg-gray-200 text-gray-700"
                        >
                          Todos
                        </button>
                        <button
                          onClick={() => {
                            setPage(1);
                            setFiltroSetores([]);
                          }}
                          className="px-2 py-1 rounded text-xs bg-gray-200 text-gray-700"
                        >
                          Nenhum
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Faixa (dias)</label>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { key: "lt1", label: "< 1 dia" },
                          { key: "d1to3", label: "1–3 dias" },
                          { key: "d3to7", label: "3–7 dias" },
                          { key: "gt7", label: "> 7 dias" },
                        ].map((b) => {
                          const active = filtroBuckets.includes(b.key);
                          const cls = active ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-700";
                          return (
                            <button
                              key={`fbucket-${b.key}`}
                              onClick={() => {
                                setPage(1);
                                setFiltroBuckets((prev) => {
                                  const has = prev.includes(b.key);
                                  if (has) return prev.filter((x) => x !== b.key);
                                  return [...prev, b.key];
                                });
                              }}
                              className={`px-2 py-1 rounded text-xs ${cls}`}
                            >
                              {b.label}
                            </button>
                          );
                        })}
                        <button
                          onClick={() => {
                            setPage(1);
                            setFiltroBuckets(["lt1", "d1to3", "d3to7", "gt7"]);
                          }}
                          className="px-2 py-1 rounded text-xs bg-gray-200 text-gray-700"
                        >
                          Todas
                        </button>
                        <button
                          onClick={() => {
                            setPage(1);
                            setFiltroBuckets([]);
                          }}
                          className="px-2 py-1 rounded text-xs bg-gray-200 text-gray-700"
                        >
                          Nenhuma
                        </button>
                      </div>
                    </div>
                    <div className="flex-1 min-w-[180px]">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Funcionário / Matrícula / Remanejamento</label>
                      <input
                        value={filtroFuncionario}
                        onChange={(e) => {
                          setPage(1);
                          setFiltroFuncionario(e.target.value);
                        }}
                        placeholder="Digite para filtrar"
                        className="w-full px-2 py-1 rounded border border-gray-300 text-sm"
                      />
                    </div>
                    <div>
                      <button
                        onClick={() => {
                          setFiltroSetores(["RH", "MEDICINA", "TREINAMENTO", "LOGISTICA"]);
                          setFiltroBuckets(["lt1", "d1to3", "d3to7", "gt7"]);
                          setFiltroFuncionario("");
                          setPage(1);
                        }}
                        className="px-3 py-1.5 rounded text-xs bg-gray-100 text-gray-700 border"
                      >
                        Limpar filtros
                      </button>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-stretch">
                  <div className="flex flex-col gap-4 lg:col-span-1">
                    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-gray-600">Total de Remanejamentos Concluídos</p>
                        <p className="text-xl font-bold text-gray-900">{data?.porRemanejamento?.length ?? 0}</p>
                      </div>
                      <div className="p-3 bg-blue-500 rounded-full">
                        <UserGroupIcon className="w-6 h-6 text-white" />
                      </div>
                    </div>
                    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-gray-600">Média duração total</p>
                        <p className="text-xl font-bold text-gray-900">{fmtDias(detalhadoKPIs.mediaTotalMs)}</p>
                        <p className="text-xs text-gray-500">Por remanejamento</p>
                      </div>
                      <div className="p-3 bg-indigo-500 rounded-full">
                        <ClockIcon className="w-6 h-6 text-white" />
                      </div>
                    </div>
                    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-xs font-medium text-gray-600">Ranking por setor (rápido → lento)</p>
                          <p className="text-xs text-gray-500">Tempo médio de conclusão</p>
                        </div>
                        <div className="p-3 bg-yellow-500 rounded-full">
                          <TrophyIcon className="w-6 h-6 text-white" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        {rankingSetores.map((s, idx) => {
                          const isLast = idx === rankingSetores.length - 1;
                          return (
                            <div key={`rank-dias-${s.setor}`} className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {idx === 0 ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700"><TrophyIcon className="w-4 h-4" /> #{idx + 1}</span>
                                ) : idx === 1 ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-700"><StarIcon className="w-4 h-4" /> #{idx + 1}</span>
                                ) : idx === 2 ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700"><StarIcon className="w-4 h-4" /> #{idx + 1}</span>
                                ) : isLast ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-700"><ArrowTrendingUpIcon className="w-4 h-4" /> Precisa melhorar</span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">#{idx + 1}</span>
                                )}
                                <span className="text-sm font-medium text-gray-800">{s.setor}</span>
                              </div>
                              <span className="text-xs text-gray-600">{fmtDias(s.tempoMedioConclusaoMs || s.duracaoMediaAtuacaoMs || 0)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-xs font-medium text-gray-600">Distribuição por faixas (dias)</p>
                          <p className="text-xs text-gray-500">Resumo por remanejamento</p>
                        </div>
                        <div className="p-3 bg-sky-500 rounded-full">
                          <ChartBarIcon className="w-6 h-6 text-white" />
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(() => {
                          const total = bucketDistribDias.reduce((acc, x) => acc + x.count, 0) || 1;
                          return bucketDistribDias.map((b) => {
                            const pct = Math.round((b.count / total) * 100);
                            const cls =
                              b.faixa === '< 1 dia' ? 'bg-indigo-50 text-indigo-700' :
                              b.faixa === '1–3 dias' ? 'bg-emerald-50 text-emerald-700' :
                              b.faixa === '3–7 dias' ? 'bg-amber-50 text-amber-700' :
                              'bg-pink-50 text-pink-700';
                            return (
                              <span key={`chip-${b.faixa}`} className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${cls}`}>
                                {b.faixa}: {b.count} ({pct}%)
                              </span>
                            );
                          });
                        })()}
                      </div>
                    </div>
                    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-gray-600">Média de conclusão (geral)</p>
                        <p className="text-xl font-bold text-gray-900">{mediaGeralDias <= 0 ? "<1d" : `${mediaGeralDias}d`}</p>
                        <p className="text-xs text-gray-500">Tempo médio por setor</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {setoresDisponiveis.map((s) => {
                            const item = porSetorBase.find((x) => (x.setor || "").toUpperCase() === s.toUpperCase());
                            const ms = item ? item.tempoMedioConclusaoMs || item.duracaoMediaAtuacaoMs || 0 : 0;
                            const DAY = 24 * 60 * 60 * 1000;
                            const diasFloat = ms / DAY;
                            const textoDias = diasFloat > 0 && diasFloat < 1 ? "<1d" : `${Math.floor(diasFloat)}d`;
                            const cls = s === "RH" ? "bg-blue-50 text-blue-700" : s === "MEDICINA" ? "bg-emerald-50 text-emerald-700" : s === "TREINAMENTO" ? "bg-violet-50 text-violet-700" : "bg-pink-50 text-pink-700";
                            return (
                              <span key={`badge-dias-${s}`} className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs ${cls}`}>{s}: {textoDias}</span>
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
                          <p className="text-sm font-medium text-gray-600">Reprovações por tipo de tarefa</p>
                          <p className="text-xs text-gray-500">Top 5 mais reprovadas</p>
                        </div>
                        <div className="p-3 bg-red-500 rounded-full">
                          <ExclamationTriangleIcon className="w-6 h-6 text-white" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        {topReprovacoes.length > 0 ? (
                          topReprovacoes.map(([tipo, qtd]) => (
                            <div key={`rep-dias-${tipo}`} className="flex items-center justify-between">
                              <span className="text-sm text-gray-800">{tipo}</span>
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-xs">{qtd} reprovação(ões)</span>
                            </div>
                          ))
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded bg-gray-100 text-gray-600 text-xs">[0 reprovadas]</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-4 lg:col-span-3">
                    <div className="rounded-2xl bg-white shadow-xl p-6">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <ChartBarIcon className="h-5 w-5 text-indigo-600" />
                              <h3 className="text-base font-semibold text-gray-800">Participação por setor (dias)</h3>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs"><ClockIcon className="h-4 w-4" /> Média geral: {mediaGeralDias <= 0 ? "<1d" : `${mediaGeralDias}d`}</span>
                            </div>
                          </div>
                          <div className="h-[340px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie data={pieSetoresDias} dataKey="dias" nameKey="setor" cx="50%" cy="50%" outerRadius={90} label={({ pct }) => `${Number(pct).toFixed(1)}%`}>
                                  {pieSetoresDias.map((entry) => {
                                    const colorMap: Record<string, string> = {
                                      RH: "#60A5FA",
                                      MEDICINA: "#10B981",
                                      TREINAMENTO: "#8B5CF6",
                                      LOGISTICA: "#EC4899",
                                    };
                                    const c = colorMap[(entry.setor || "").toUpperCase()] || "#9CA3AF";
                                    return <Cell key={`cell-${entry.setor}`} fill={c} />;
                                  })}
                                </Pie>
                                <Tooltip formatter={(_, name, { payload }) => [`${Number(payload?.pct || 0).toFixed(1)}%`, payload?.setor ?? name]} />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="mt-3 flex flex-wrap justify-center gap-3">
                            {setoresDisponiveis.map((s) => {
                              const colorMap: Record<string, string> = {
                                RH: "#60A5FA",
                                MEDICINA: "#10B981",
                                TREINAMENTO: "#8B5CF6",
                                LOGISTICA: "#EC4899",
                              };
                              const c = colorMap[(s || "").toUpperCase()] || "#9CA3AF";
                              return (
                                <span key={`legend-pie-${s}`} className="inline-flex items-center gap-2 text-xs text-gray-700">
                                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c }}></span>
                                  <span>{s}</span>
                                </span>
                              );
                            })}
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <ChartBarIcon className="h-5 w-5 text-indigo-600" />
                              <h3 className="text-base font-semibold text-gray-800">Distribuição por faixas (dias)</h3>
                            </div>
                          </div>
                          <div className="h-[340px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={stackDistribBucketsSetores}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                                <XAxis dataKey="faixa" tick={{ fill: "#6B7280" }} />
                                <YAxis tick={{ fill: "#6B7280" }} />
                                <Tooltip formatter={(value, name, { payload }) => [`${(((Number(value) || 0) / (payload?.total || 1)) * 100).toFixed(1)}%`, name]} />
                                <Bar dataKey="RH" name="RH" stackId="stack" fill="#60A5FA" radius={[0, 0, 0, 0]} />
                                <Bar dataKey="MEDICINA" name="Medicina" stackId="stack" fill="#10B981" radius={[0, 0, 0, 0]} />
                                <Bar dataKey="TREINAMENTO" name="Treinamento" stackId="stack" fill="#8B5CF6" radius={[0, 0, 0, 0]} />
                                <Bar dataKey="LOGISTICA" name="Logística" stackId="stack" fill="#EC4899" radius={[8, 8, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="mt-3 flex flex-wrap justify-center gap-3">
                            {[
                              { key: "RH", label: "RH", color: "#60A5FA" },
                              { key: "MEDICINA", label: "Medicina", color: "#10B981" },
                              { key: "TREINAMENTO", label: "Treinamento", color: "#8B5CF6" },
                              { key: "LOGISTICA", label: "Logística", color: "#EC4899" },
                            ].map((it) => (
                              <span key={`legend-bar-${it.key}`} className="inline-flex items-center gap-2 text-xs text-gray-700">
                                <span className="w-2.5 h-2.5 rounded" style={{ backgroundColor: it.color }}></span>
                                <span>{it.label}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="lg:col-span-2">
                          <div className="rounded-2xl bg-white shadow-xl p-6 mt-4">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <ChartBarIcon className="h-5 w-5 text-indigo-600" />
                                    <h3 className="text-base font-semibold text-gray-800">Distribuição por setor e faixa (contagem)</h3>
                                  </div>
                                </div>
                                <div className="h-[360px]">
                                  <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={distribPorSetorBuckets}>
                                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                                      <XAxis dataKey="setor" tick={{ fill: "#6B7280" }} />
                                      <YAxis tick={{ fill: "#6B7280" }} />
                                      <Tooltip formatter={(value, name) => [String(Number(value || 0)), name as string]} />
                                      <Bar dataKey="lt1" name="< 1 dia" fill="#6366F1">
                                        <LabelList position="top" content={(props: any) => (
                                          <text x={props.x} y={props.y} dy={-4} fill="#374151" fontSize={11} textAnchor="middle">
                                            {String(Number(props.value || 0))}
                                          </text>
                                        )} />
                                      </Bar>
                                      <Bar dataKey="d1to3" name="1–3 dias" fill="#10B981">
                                        <LabelList position="top" content={(props: any) => (
                                          <text x={props.x} y={props.y} dy={-4} fill="#374151" fontSize={11} textAnchor="middle">
                                            {String(Number(props.value || 0))}
                                          </text>
                                        )} />
                                      </Bar>
                                      <Bar dataKey="d3to7" name="3–7 dias" fill="#F59E0B">
                                        <LabelList position="top" content={(props: any) => (
                                          <text x={props.x} y={props.y} dy={-4} fill="#374151" fontSize={11} textAnchor="middle">
                                            {String(Number(props.value || 0))}
                                          </text>
                                        )} />
                                      </Bar>
                                      <Bar dataKey="gt7" name="> 7 dias" fill="#EC4899">
                                        <LabelList position="top" content={(props: any) => (
                                          <text x={props.x} y={props.y} dy={-4} fill="#374151" fontSize={11} textAnchor="middle">
                                            {String(Number(props.value || 0))}
                                          </text>
                                        )} />
                                      </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                                </div>
                                <div className="mt-3 flex flex-wrap justify-center gap-3">
                                  {[
                                    { key: "lt1", label: "< 1 dia", color: "#6366F1" },
                                    { key: "d1to3", label: "1–3 dias", color: "#10B981" },
                                    { key: "d3to7", label: "3–7 dias", color: "#F59E0B" },
                                    { key: "gt7", label: "> 7 dias", color: "#EC4899" },
                                  ].map((it) => (
                                    <span key={`legend-sector-bucket-${it.key}`} className="inline-flex items-center gap-2 text-xs text-gray-700">
                                      <span className="w-2.5 h-2.5 rounded" style={{ backgroundColor: it.color }}></span>
                                      <span>{it.label}</span>
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <ChartBarIcon className="h-5 w-5 text-indigo-600" />
                                    <h3 className="text-base font-semibold text-gray-800">Tempo médio por setor (dias)</h3>
                                  </div>
                                  <div className="flex items-center gap-3 text-sm">
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs"><ClockIcon className="h-4 w-4" /> Média geral: {mediaGeralDias <= 0 ? "<1d" : `${mediaGeralDias}d`}</span>
                                  </div>
                                </div>
                                <div className="h-[360px]">
                                  <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                      <Pie data={donutMediaSetorDias} dataKey="dias" nameKey="setor" cx="50%" cy="50%" innerRadius={50} outerRadius={90} label={({ dias }) => (Number(dias) < 1 ? "<1" : String(Math.floor(Number(dias))))}>
                                        {donutMediaSetorDias.map((entry) => {
                                          const colorMap: Record<string, string> = {
                                            RH: "#60A5FA",
                                            MEDICINA: "#10B981",
                                            TREINAMENTO: "#8B5CF6",
                                            LOGISTICA: "#EC4899",
                                          };
                                          const c = colorMap[(entry.setor || "").toUpperCase()] || "#9CA3AF";
                                          return <Cell key={`cell-donut-${entry.setor}`} fill={c} />;
                                        })}
                                      </Pie>
                                      <Tooltip formatter={(_, name, { payload }) => [`${Number(payload?.pct || 0).toFixed(1)}%`, payload?.setor ?? name]} />
                                    </PieChart>
                                  </ResponsiveContainer>
                                </div>
                                <div className="mt-3 flex flex-wrap justify-center gap-3">
                                  {setoresDisponiveis.map((s) => {
                                    const colorMap: Record<string, string> = {
                                      RH: "#60A5FA",
                                      MEDICINA: "#10B981",
                                      TREINAMENTO: "#8B5CF6",
                                      LOGISTICA: "#EC4899",
                                    };
                                    const c = colorMap[(s || "").toUpperCase()] || "#9CA3AF";
                                    return (
                                      <span key={`legend-donut-${s}`} className="inline-flex items-center gap-2 text-xs text-gray-700">
                                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c }}></span>
                                        <span>{s}</span>
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-2xl bg-white shadow-xl w-full flex-1 overflow-hidden">
                      <div className="px-4 py-3 flex items-center justify-between bg-gray-50 rounded-t-2xl">
                        <div className="flex items-center gap-2">
                          <UserGroupIcon className="h-5 w-5 text-indigo-600" />
                          <h3 className="text-sm font-semibold text-gray-800">Período por setor — por remanejamento</h3>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-500">{porRemanejamentoFiltrados.length} linha(s)</span>
                          <button onClick={exportDetalhadoXLSX} className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded hover:bg-gray-100">Exportar</button>
                          <div className="flex items-center gap-2">
                            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className={`px-2 py-1 text-xs border rounded ${page <= 1 ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-100"}`}>Anterior</button>
                            <span className="text-xs text-gray-600">Página {page} de {totalPages}</span>
                            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className={`px-2 py-1 text-xs border rounded ${page >= totalPages ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-100"}`}>Próxima</button>
                          </div>
                        </div>
                      </div>
                      <div className="h-full overflow-y-auto">
                        <table className="min-w-full divide-y divide-gray-200 text-xs w-full">
                          <thead className="bg-gray-50 sticky top-0 z-10">
                            <tr>
                              <th className="text-left px-3 py-2 text-xs font-medium text-gray-600 uppercase tracking-wider">Funcionário</th>
                              {setoresDisponiveis.map((s) => {
                                const iconMap: Record<string, any> = { RH: BuildingOfficeIcon, MEDICINA: HeartIcon, TREINAMENTO: AcademicCapIcon, LOGISTICA: TruckIcon };
                                const Icon = iconMap[s] || ChartBarIcon;
                                return (
                                  <th key={`head-det-dias-${s}`} className="text-left px-3 py-2 text-xs font-medium text-gray-600 uppercase tracking-wider whitespace-nowrap">
                                    <span className="inline-flex items-center gap-1"><Icon className="h-4 w-4 text-gray-600" /> {s}</span>
                                  </th>
                                );
                              })}
                              <th className="text-left px-3 py-2 text-xs font-medium text-gray-600 uppercase tracking-wider whitespace-nowrap">
                                <span className="inline-flex items-center gap-1"><ClockIcon className="h-4 w-4 text-gray-600" /> Total</span>
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {pageData.map((r) => (
                              <tr key={`det-dias-${r.remanejamentoId}`} className="hover:bg-gray-50">
                                <td className="px-3 py-2 text-gray-800">
                                  <div className="flex flex-col">
                                    <span className="font-medium">{r.funcionario?.nome || ""}</span>
                                    <span className="text-xs text-gray-600">Matrícula: {r.funcionario?.matricula || ""}</span>
                                    <span className="text-xs text-gray-600">Remanejamento: {String(r.remanejamentoId)}</span>
                                  </div>
                                </td>
                                {setoresDisponiveis.map((s) => {
                                  const periodEntry = (r.periodosPorSetor || []).find((x) => x.setor.toUpperCase() === s.toUpperCase());
                                  const durEntry = (r.duracaoPorSetorMs || []).find((x) => x.setor.toUpperCase() === s.toUpperCase());
                                  return (
                                    <td key={`cell-dias-${r.remanejamentoId}-${s}`} className="px-3 py-2 text-gray-800 whitespace-nowrap">
                                      {periodEntry ? (
                                        <div className="flex flex-col gap-1">
                                          <span className="inline-flex items-center px-2 py-1 rounded-full bg-indigo-50 text-indigo-700">Início: {new Date(periodEntry.inicio).toLocaleDateString("pt-BR")}</span>
                                          <span className="inline-flex items-center px-2 py-1 rounded-full bg-purple-50 text-purple-700">Fim: {new Date(periodEntry.fim).toLocaleDateString("pt-BR")}</span>
                                          <span className="inline-flex items-center px-2 py-1 rounded-full bg-green-50 text-green-700">Duração: {durEntry?.ms ? fmtDias(durEntry.ms) : (() => { const ms = Math.max(0, new Date(periodEntry.fim).getTime() - new Date(periodEntry.inicio).getTime()); return ms ? fmtDias(ms) : "—"; })()}</span>
                                        </div>
                                      ) : (
                                        <span className="inline-flex items-center px-2 py-1 rounded-full bg-gray-100 text-gray-500">—</span>
                                      )}
                                    </td>
                                  );
                                })}
                                <td className="px-3 py-2 text-gray-800 whitespace-nowrap">
                                  <span className="inline-flex items-center px-2 py-1 rounded-full bg-blue-50 text-blue-700">{fmtDias(r.totalDurMs)}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
                </div>
            )}

            
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
                      <h3 className="text-base font-semibold text-gray-800">
                        Tempo médio de conclusão por setor (h)
                      </h3>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs">
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
                  <table className="min-w-full text-xs">
                    <thead className="bg-gray-100 sticky top-0 z-10">
                      <tr>
                        <th className="text-left px-2 py-1 text-xs">Remanejamento</th>
                        <th className="text-left px-2 py-1 text-xs">Funcionário</th>
                        <th className="text-left px-2 py-1 text-xs">
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
                              className="text-left px-2 py-1 text-xs"
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
                          <td className="px-2 py-1 text-gray-800 text-xs">
                            {String(r.remanejamentoId)}
                          </td>
                          <td className="px-2 py-1 text-gray-800 text-xs">
                            {r.funcionario?.nome} ({r.funcionario?.matricula})
                          </td>
                          <td className="px-2 py-1 text-gray-800 text-xs">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs">
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
                                className="px-2 py-1 text-gray-800 text-xs"
                              >
                                {show ? (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-green-50 text-green-700 text-xs">
                                    {fmtMs(ms)}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs">
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
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-stretch">
                  <div className="flex flex-col gap-4 lg:col-span-1">
                    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-gray-600">
                          Total de Remanejamentos Concluídos
                        </p>
                        <p className="text-xl font-bold text-gray-900">
                          {data?.porRemanejamento?.length ?? 0}
                        </p>
                      </div>
                      <div className="p-3 bg-blue-500 rounded-full">
                        <UserGroupIcon className="w-6 h-6 text-white" />
                      </div>
                    </div>
                    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-gray-600">
                          Média duração total
                        </p>
                        <p className="text-xl font-bold text-gray-900">
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
                          <p className="text-xs font-medium text-gray-600">
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
                        <p className="text-xs font-medium text-gray-600">
                          Média de conclusão (geral)
                        </p>
                        <p className="text-xl font-bold text-gray-900">
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
                                className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs ${cls}`}
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
                  <div className="flex flex-col gap-4 lg:col-span-3">
                    <div className="rounded-2xl bg-white shadow-xl p-4 h-[240px]">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <ChartBarIcon className="h-5 w-5 text-indigo-600" />
                          <h3 className="text-base font-semibold text-gray-800">
                            Tempo médio de conclusão por setor (h)
                          </h3>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs">
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
                        <table className="min-w-full divide-y divide-gray-200 text-xs w-full">
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