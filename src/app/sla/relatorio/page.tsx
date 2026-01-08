"use client";
import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  Fragment,
} from "react";
import { Transition } from "@headlessui/react";
import { useSearchParams } from "next/navigation";
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
  ChevronDownIcon,
  ChevronRightIcon,
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
    reprovacoes: number;
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
    responsabilidadeTimeline?: {
      responsavel: string;
      inicio: string;
      fim: string;
      ms: number;
      ciclo?: number;
      tipo?: string;
    }[];
    segmentosPorSetor?: Record<
      string,
      { inicio: string; fim: string; ms: number; ciclo?: number }[]
    >;
    teveReprovacao?: boolean;
    reprovacoesPorSetor?: { setor: string; count: number }[];
    reprovEvents?: {
      setor: string;
      data: string | null;
      source?: string;
      tarefaId?: string | number;
    }[];
  }[];
  reprovacoesPorTipo?: Record<string, number>;
};

function fmtMs(ms: number) {
  if (ms < 60 * 1000) return "<1m";
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

function totalMsNow(r: KPISet["porRemanejamento"][number]) {
  const start = r.solicitacaoDataCriacao
    ? new Date(r.solicitacaoDataCriacao).getTime()
    : 0;
  const end = r.remanejamentoDataConclusao
    ? new Date(r.remanejamentoDataConclusao).getTime()
    : Date.now();
  const fallback = start && end ? Math.max(0, end - start) : 0;
  return Math.max(r.totalDurMs || 0, fallback);
}

export default function RelatorioSLA() {
  const [data, setData] = useState<KPISet | null>(null);
  const [dataAll, setDataAll] = useState<KPISet | null>(null);
  const somenteConcluidos = true;
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "simples" | "detalhado" | "dias" | "dias_all"
  >("dias");
  const [page, setPage] = useState<number>(1);
  const rowsPerPage = 5;
  // visaoTodos agora é derivado diretamente
  const visaoTodos = activeTab === "dias_all";
  const [filtroSetores, setFiltroSetores] = useState<string[]>([
    "RH",
    "MEDICINA",
    "TREINAMENTO",
    "LOGISTICA",
  ]);
  const [filtroBuckets, setFiltroBuckets] = useState<string[]>([
    "lt1",
    "d1to3",
    "d3to7",
    "gt7",
  ]);
  const [filtroFuncionario, setFiltroFuncionario] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [hideTabs, setHideTabs] = useState<boolean>(false);
  const [expandedRows, setExpandedRows] = useState<Set<string | number>>(
    new Set()
  );

  const toggleRow = (id: string | number) => {
    const newSet = new Set(expandedRows);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedRows(newSet);
  };

  const searchParams = useSearchParams();

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (somenteConcluidos) params.set("concluidos", "true");

      const todayStr = new Date().toISOString().split("T")[0];
      if (startDate) {
        params.set("start", startDate);
        // Se escolheu inicio mas nao fim, considera hoje
        if (!endDate) {
          params.set("end", todayStr);
        }
      }
      if (endDate) params.set("end", endDate);

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
  }, [somenteConcluidos, startDate, endDate]);

  const carregarAll = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      const todayStr = new Date().toISOString().split("T")[0];
      if (startDate) {
        params.set("start", startDate);
        if (!endDate) {
          params.set("end", todayStr);
        }
      }
      if (endDate) params.set("end", endDate);
      const resp = await fetch(`/api/sla/relatorio?${params.toString()}`, {
        credentials: "include",
      });
      if (!resp.ok) return;
      const json = await resp.json();
      setDataAll(json as KPISet);
    } catch {}
  }, [startDate, endDate]);

  useEffect(() => {
    try {
      const tabParam = searchParams.get("tab");
      const hideParam = searchParams.get("hideTabs");
      if (tabParam === "dias" || tabParam === "dias_all") {
        setActiveTab(tabParam as any);
      }
      setHideTabs(hideParam === "true");
    } catch {}
  }, [searchParams]);

  useEffect(() => {
    if (activeTab === "dias") {
      carregar();
    } else if (activeTab === "dias_all") {
      carregarAll();
    }
  }, [activeTab, carregar, carregarAll]);

  const setoresDisponiveis = useMemo(() => {
    // Fixar colunas principais para consistência e incluir logística
    return ["RH", "MEDICINA", "TREINAMENTO", "LOGISTICA"];
  }, []);

  const setoresVisiveis = useMemo(() => {
    // Quando há setores selecionados, mostramos apenas eles; caso contrário, todos
    return filtroSetores && filtroSetores.length
      ? filtroSetores.map((s) => s.toUpperCase())
      : setoresDisponiveis;
  }, [filtroSetores, setoresDisponiveis]);

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

  const porRemanejamentoValidosAll = useMemo(() => {
    if (!dataAll) return [] as KPISet["porRemanejamento"];
    return dataAll.porRemanejamento;
  }, [dataAll]);

  const porSetorBase = useMemo(() => {
    if (!data) return [] as KPISet["porSetor"];
    return data.porSetor;
  }, [data]);

  const porSetorBaseAll = useMemo(() => {
    if (!dataAll) return [] as KPISet["porSetor"];
    return dataAll.porSetor;
  }, [dataAll]);

  const porRemanejamentoFiltrados = useMemo(() => {
    const DAY = 24 * 60 * 60 * 1000;
    const hasSetor = (r: KPISet["porRemanejamento"][number]) => {
      if (!filtroSetores.length) return true;
      const presentes = new Set<string>();
      (r.periodosPorSetor || []).forEach((p) =>
        presentes.add((p.setor || "").toUpperCase())
      );
      (r.duracaoPorSetorMs || []).forEach((d) =>
        presentes.add((d.setor || "").toUpperCase())
      );
      return filtroSetores.some((s) => presentes.has(s.toUpperCase()));
    };
    const bucketKey = (ms: number) =>
      ms < DAY
        ? "lt1"
        : ms < 3 * DAY
        ? "d1to3"
        : ms < 7 * DAY
        ? "d3to7"
        : "gt7";
    const matchFuncionario = (r: KPISet["porRemanejamento"][number]) => {
      if (!filtroFuncionario) return true;
      const q = filtroFuncionario.toLowerCase();
      const nome = (r.funcionario?.nome || "").toLowerCase();
      const mat = (r.funcionario?.matricula || "").toLowerCase();
      return (
        nome.includes(q) ||
        mat.includes(q) ||
        String(r.remanejamentoId).toLowerCase().includes(q)
      );
    };
    return porRemanejamentoValidos.filter((r) => {
      const okSetor = hasSetor(r);
      const okBucket =
        !filtroBuckets.length ||
        filtroBuckets.includes(bucketKey(r.totalDurMs || 0));
      const okFunc = matchFuncionario(r);
      return okSetor && okBucket && okFunc;
    });
  }, [
    porRemanejamentoValidos,
    filtroSetores,
    filtroBuckets,
    filtroFuncionario,
  ]);

  const porRemanejamentoFiltradosAll = useMemo(() => {
    const DAY = 24 * 60 * 60 * 1000;
    const bucketKey = (ms: number) =>
      ms < DAY
        ? "lt1"
        : ms < 3 * DAY
        ? "d1to3"
        : ms < 7 * DAY
        ? "d3to7"
        : "gt7";
    const matchFuncionario = (r: KPISet["porRemanejamento"][number]) => {
      if (!filtroFuncionario) return true;
      const q = filtroFuncionario.toLowerCase();
      const nome = (r.funcionario?.nome || "").toLowerCase();
      const mat = (r.funcionario?.matricula || "").toLowerCase();
      return (
        nome.includes(q) ||
        mat.includes(q) ||
        String(r.remanejamentoId).toLowerCase().includes(q)
      );
    };
    return porRemanejamentoValidosAll.filter((r) => {
      const msTotal = totalMsNow(r);
      const okBucket =
        !filtroBuckets.length || filtroBuckets.includes(bucketKey(msTotal));
      const okFunc = matchFuncionario(r);
      return okBucket && okFunc;
    });
  }, [porRemanejamentoValidosAll, filtroBuckets, filtroFuncionario]);

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
      return {
        setor: s.setor,
        dias: Math.floor(baseMs / (24 * 60 * 60 * 1000)),
      };
    });
  }, [porSetorBase]);

  const chartDataDiasAll = useMemo(() => {
    return porSetorBaseAll.map((s) => {
      const baseMs = s.tempoMedioConclusaoMs || s.duracaoMediaAtuacaoMs || 0;
      return {
        setor: s.setor,
        dias: Math.floor(baseMs / (24 * 60 * 60 * 1000)),
      };
    });
  }, [porSetorBaseAll]);

  const donutMediaSetorDias = useMemo(() => {
    const DAY = 24 * 60 * 60 * 1000;
    const acc: Record<string, { sum: number; count: number }> = {};
    setoresVisiveis.forEach(
      (s) => (acc[s.toUpperCase()] = { sum: 0, count: 0 })
    );
    porRemanejamentoFiltrados.forEach((r) => {
      (r.duracaoPorSetorMs || []).forEach((d) => {
        const k = (d.setor || "").toUpperCase();
        if (!setoresVisiveis.includes(k)) return;
        const ms = d.ms || 0;
        if (ms <= 0) return;
        acc[k].sum += ms;
        acc[k].count += 1;
      });
    });
    const items = setoresVisiveis.map((s) => {
      const k = s.toUpperCase();
      const { sum, count } = acc[k] || { sum: 0, count: 0 };
      const dias = count > 0 ? sum / count / DAY : 0;
      return { setor: s, dias };
    });
    const totalDias = items.reduce((acc, it) => acc + it.dias, 0) || 1;
    return items.map((it) => ({ ...it, pct: (it.dias / totalDias) * 100 }));
  }, [porRemanejamentoFiltrados, setoresVisiveis]);

  const donutMediaSetorDiasAll = useMemo(() => {
    const DAY = 24 * 60 * 60 * 1000;
    const acc: Record<string, { sum: number; count: number }> = {};
    setoresVisiveis.forEach(
      (s) => (acc[s.toUpperCase()] = { sum: 0, count: 0 })
    );
    porRemanejamentoFiltradosAll.forEach((r) => {
      (r.duracaoPorSetorMs || []).forEach((d) => {
        const k = (d.setor || "").toUpperCase();
        if (!setoresVisiveis.includes(k)) return;
        const ms = d.ms || 0;
        if (ms <= 0) return;
        acc[k].sum += ms;
        acc[k].count += 1;
      });
    });
    const items = setoresVisiveis.map((s) => {
      const k = s.toUpperCase();
      const { sum, count } = acc[k] || { sum: 0, count: 0 };
      const dias = count > 0 ? sum / count / DAY : 0;
      return { setor: s, dias };
    });
    const totalDias = items.reduce((acc, it) => acc + it.dias, 0) || 1;
    return items.map((it) => ({ ...it, pct: (it.dias / totalDias) * 100 }));
  }, [porRemanejamentoFiltradosAll, setoresVisiveis]);

  // Visão dinâmica para donut (respeita visaoTodos)
  const donutMediaSetorDiasView = useMemo(() => {
    return visaoTodos ? donutMediaSetorDiasAll : donutMediaSetorDias;
  }, [visaoTodos, donutMediaSetorDias, donutMediaSetorDiasAll]);

  const mediaGeralHoras = useMemo(() => {
    const total = chartData.reduce((acc, d) => acc + (d.horas || 0), 0);
    const count = chartData.length || 1;
    return Math.round(total / count);
  }, [chartData]);

  const mediaGeralDias = useMemo(() => {
    const DAY = 24 * 60 * 60 * 1000;
    const total = porRemanejamentoFiltrados.length;
    const totalMs = porRemanejamentoFiltrados.reduce(
      (acc, r) => acc + (r.totalDurMs || 0),
      0
    );
    const mediaDias = total ? totalMs / total / DAY : 0;
    return Math.round(mediaDias);
  }, [porRemanejamentoFiltrados]);

  const mediaGeralDiasAll = useMemo(() => {
    const DAY = 24 * 60 * 60 * 1000;
    const total = porRemanejamentoFiltradosAll.length;
    const totalMs = porRemanejamentoFiltradosAll.reduce(
      (acc, r) => acc + totalMsNow(r),
      0
    );
    const mediaDias = total ? totalMs / total / DAY : 0;
    return Math.round(mediaDias);
  }, [porRemanejamentoFiltradosAll]);

  // Visão dinâmica para média geral em dias
  const mediaGeralDiasView = useMemo(() => {
    return visaoTodos ? mediaGeralDiasAll : mediaGeralDias;
  }, [visaoTodos, mediaGeralDias, mediaGeralDiasAll]);

  const pieSetoresDias = useMemo(() => {
    const durBySetor: Record<string, number> = {};
    porRemanejamentoFiltrados.forEach((r) => {
      (r.duracaoPorSetorMs || []).forEach((d) => {
        const key = (d.setor || "").toUpperCase();
        durBySetor[key] = (durBySetor[key] || 0) + (d.ms || 0);
      });
    });
    const DAY = 24 * 60 * 60 * 1000;
    const items = setoresVisiveis.map((s) => {
      const ms = durBySetor[(s || "").toUpperCase()] || 0;
      const dias = ms / DAY;
      return { setor: s, dias };
    });
    const totalDias = items.reduce((acc, it) => acc + it.dias, 0) || 1;
    return items.map((it) => ({ ...it, pct: (it.dias / totalDias) * 100 }));
  }, [porRemanejamentoFiltrados, setoresVisiveis]);

  const pieSetoresDiasAll = useMemo(() => {
    const durBySetor: Record<string, number> = {};
    porRemanejamentoFiltradosAll.forEach((r) => {
      (r.duracaoPorSetorMs || []).forEach((d) => {
        const key = (d.setor || "").toUpperCase();
        durBySetor[key] = (durBySetor[key] || 0) + (d.ms || 0);
      });
    });
    const DAY = 24 * 60 * 60 * 1000;
    const items = setoresVisiveis.map((s) => {
      const ms = durBySetor[(s || "").toUpperCase()] || 0;
      const dias = ms / DAY;
      return { setor: s, dias };
    });
    const totalDias = items.reduce((acc, it) => acc + it.dias, 0) || 1;
    return items.map((it) => ({ ...it, pct: (it.dias / totalDias) * 100 }));
  }, [porRemanejamentoFiltradosAll, setoresVisiveis]);

  // Visão dinâmica para pie de setores
  const pieSetoresDiasView = useMemo(() => {
    return visaoTodos ? pieSetoresDiasAll : pieSetoresDias;
  }, [visaoTodos, pieSetoresDias, pieSetoresDiasAll]);

  const bucketDistribDias = useMemo(() => {
    const DAY = 24 * 60 * 60 * 1000;
    const counts = { lt1: 0, d1to3: 0, d3to7: 0, gt7: 0 };
    porRemanejamentoFiltrados.forEach((r) => {
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
  }, [porRemanejamentoFiltrados]);

  const bucketDistribDiasAll = useMemo(() => {
    const DAY = 24 * 60 * 60 * 1000;
    const counts = { lt1: 0, d1to3: 0, d3to7: 0, gt7: 0 };
    porRemanejamentoFiltradosAll.forEach((r) => {
      const ms = totalMsNow(r);
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
  }, [porRemanejamentoFiltradosAll]);

  // Visão dinâmica para distribuição de faixas (chips)
  const bucketDistribDiasView = useMemo(() => {
    return visaoTodos ? bucketDistribDiasAll : bucketDistribDias;
  }, [visaoTodos, bucketDistribDias, bucketDistribDiasAll]);

  const stackDistribBucketsSetores = useMemo(() => {
    const DAY = 24 * 60 * 60 * 1000;
    const initBucket = () => ({
      faixa: "",
      RH: 0,
      MEDICINA: 0,
      TREINAMENTO: 0,
      LOGISTICA: 0,
      total: 0,
    });
    const buckets: Record<
      string,
      {
        faixa: string;
        RH: number;
        MEDICINA: number;
        TREINAMENTO: number;
        LOGISTICA: number;
        total: number;
      }
    > = {
      lt1: { ...initBucket(), faixa: "< 1 dia" },
      d1to3: { ...initBucket(), faixa: "1–3 dias" },
      d3to7: { ...initBucket(), faixa: "3–7 dias" },
      gt7: { ...initBucket(), faixa: "> 7 dias" },
    } as any;
    porRemanejamentoFiltrados.forEach((r) => {
      const msTotal = r.totalDurMs || 0;
      const key =
        msTotal < DAY
          ? "lt1"
          : msTotal < 3 * DAY
          ? "d1to3"
          : msTotal < 7 * DAY
          ? "d3to7"
          : "gt7";
      const bySetor: Record<string, number> = {};
      let sumMs = 0;
      (r.duracaoPorSetorMs || []).forEach((d) => {
        const k = (d.setor || "").toUpperCase();
        if (setoresVisiveis.includes(k)) {
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
        (r.periodosPorSetor || []).forEach((p) =>
          presentes.add((p.setor || "").toUpperCase())
        );
        (r.temposMediosPorSetor || []).forEach((t) =>
          presentes.add((t.setor || "").toUpperCase())
        );
        const list = Array.from(presentes).filter((s) =>
          setoresVisiveis.includes(s)
        );
        const w = list.length ? 1 / list.length : 0;
        list.forEach((s) => {
          (buckets as any)[key][s] += w;
        });
        (buckets as any)[key].total += 1;
      }
    });
    // converter para array
    return [buckets.lt1, buckets.d1to3, buckets.d3to7, buckets.gt7];
  }, [porRemanejamentoFiltrados, setoresVisiveis]);

  const stackDistribBucketsSetoresAll = useMemo(() => {
    const DAY = 24 * 60 * 60 * 1000;
    const initBucket = () => ({
      faixa: "",
      RH: 0,
      MEDICINA: 0,
      TREINAMENTO: 0,
      LOGISTICA: 0,
      total: 0,
    });
    const buckets: Record<
      string,
      {
        faixa: string;
        RH: number;
        MEDICINA: number;
        TREINAMENTO: number;
        LOGISTICA: number;
        total: number;
      }
    > = {
      lt1: { ...initBucket(), faixa: "< 1 dia" },
      d1to3: { ...initBucket(), faixa: "1–3 dias" },
      d3to7: { ...initBucket(), faixa: "3–7 dias" },
      gt7: { ...initBucket(), faixa: "> 7 dias" },
    } as any;
    porRemanejamentoFiltradosAll.forEach((r) => {
      const msTotal = totalMsNow(r);
      const key =
        msTotal < DAY
          ? "lt1"
          : msTotal < 3 * DAY
          ? "d1to3"
          : msTotal < 7 * DAY
          ? "d3to7"
          : "gt7";
      const bySetor: Record<string, number> = {};
      let sumMs = 0;
      (r.duracaoPorSetorMs || []).forEach((d) => {
        const k = (d.setor || "").toUpperCase();
        if (setoresVisiveis.includes(k)) {
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
        const presentes = new Set<string>();
        (r.periodosPorSetor || []).forEach((p) =>
          presentes.add((p.setor || "").toUpperCase())
        );
        (r.temposMediosPorSetor || []).forEach((t) =>
          presentes.add((t.setor || "").toUpperCase())
        );
        const list = Array.from(presentes).filter((s) =>
          setoresVisiveis.includes(s)
        );
        const w = list.length ? 1 / list.length : 0;
        list.forEach((s) => {
          (buckets as any)[key][s] += w;
        });
        (buckets as any)[key].total += 1;
      }
    });
    return [buckets.lt1, buckets.d1to3, buckets.d3to7, buckets.gt7];
  }, [porRemanejamentoFiltradosAll, setoresVisiveis]);

  // Visão dinâmica para barras empilhadas por faixa
  const stackDistribBucketsSetoresView = useMemo(() => {
    return visaoTodos
      ? stackDistribBucketsSetoresAll
      : stackDistribBucketsSetores;
  }, [visaoTodos, stackDistribBucketsSetores, stackDistribBucketsSetoresAll]);

  const distribPorSetorBuckets = useMemo(() => {
    const DAY = 24 * 60 * 60 * 1000;
    const init = () => ({
      setor: "",
      lt1: 0,
      d1to3: 0,
      d3to7: 0,
      gt7: 0,
      total: 0,
    });
    const map: Record<
      string,
      {
        setor: string;
        lt1: number;
        d1to3: number;
        d3to7: number;
        gt7: number;
        total: number;
      }
    > = {};
    setoresVisiveis.forEach((s) => {
      map[s.toUpperCase()] = { ...init(), setor: s };
    });
    porRemanejamentoFiltrados.forEach((r) => {
      (r.duracaoPorSetorMs || []).forEach((d) => {
        const s = (d.setor || "").toUpperCase();
        const ms = d.ms || 0;
        if (!setoresVisiveis.includes(s) || ms <= 0) return;
        const key =
          ms < DAY
            ? "lt1"
            : ms < 3 * DAY
            ? "d1to3"
            : ms < 7 * DAY
            ? "d3to7"
            : "gt7";
        const obj = map[s];
        (obj as any)[key] += 1;
        obj.total += 1;
      });
    });
    return setoresVisiveis.map(
      (s) =>
        map[s.toUpperCase()] || {
          setor: s,
          lt1: 0,
          d1to3: 0,
          d3to7: 0,
          gt7: 0,
          total: 0,
        }
    );
  }, [porRemanejamentoFiltrados, setoresVisiveis]);

  const distribPorSetorBucketsAll = useMemo(() => {
    const DAY = 24 * 60 * 60 * 1000;
    const init = () => ({
      setor: "",
      lt1: 0,
      d1to3: 0,
      d3to7: 0,
      gt7: 0,
      total: 0,
    });
    const map: Record<
      string,
      {
        setor: string;
        lt1: number;
        d1to3: number;
        d3to7: number;
        gt7: number;
        total: number;
      }
    > = {};
    setoresVisiveis.forEach((s) => {
      map[s.toUpperCase()] = { ...init(), setor: s };
    });
    porRemanejamentoFiltradosAll.forEach((r) => {
      (r.duracaoPorSetorMs || []).forEach((d) => {
        const s = (d.setor || "").toUpperCase();
        const ms = d.ms || 0;
        if (!setoresVisiveis.includes(s) || ms <= 0) return;
        const key =
          ms < DAY
            ? "lt1"
            : ms < 3 * DAY
            ? "d1to3"
            : ms < 7 * DAY
            ? "d3to7"
            : "gt7";
        const obj = map[s];
        (obj as any)[key] += 1;
        obj.total += 1;
      });
    });
    return setoresVisiveis.map(
      (s) =>
        map[s.toUpperCase()] || {
          setor: s,
          lt1: 0,
          d1to3: 0,
          d3to7: 0,
          gt7: 0,
          total: 0,
        }
    );
  }, [porRemanejamentoFiltradosAll, setoresVisiveis]);

  // Visão dinâmica para distribuição por setor e faixa (contagem)
  const distribPorSetorBucketsView = useMemo(() => {
    return visaoTodos ? distribPorSetorBucketsAll : distribPorSetorBuckets;
  }, [visaoTodos, distribPorSetorBuckets, distribPorSetorBucketsAll]);

  // Lista dinâmica de setores para legends/colunas
  const setoresView = useMemo(() => {
    return visaoTodos ? setoresDisponiveis : setoresVisiveis;
  }, [visaoTodos, setoresDisponiveis, setoresVisiveis]);

  // Distribuição de status (VALIDADO, REJEITADO, INVALIDADO, CONCLUIDO, EM_ANDAMENTO)
  const statusDistribView = useMemo(() => {
    const rows = visaoTodos
      ? porRemanejamentoFiltradosAll
      : porRemanejamentoFiltrados;
    const counts: Record<string, number> = {};
    rows.forEach((r) => {
      const logSegs = (r.responsabilidadeTimeline || []).filter(
        (seg) => (seg.responsavel || "").toUpperCase() === "LOGISTICA"
      );
      const sorted = [...logSegs].sort((a, b) => {
        const ta = a.fim
          ? new Date(a.fim).getTime()
          : a.inicio
          ? new Date(a.inicio).getTime()
          : 0;
        const tb = b.fim
          ? new Date(b.fim).getTime()
          : b.inicio
          ? new Date(b.inicio).getTime()
          : 0;
        return ta - tb;
      });
      const last = sorted.length ? sorted[sorted.length - 1] : null;
      let status = "EM_ANDAMENTO";
      if (last?.tipo) {
        const t = (last.tipo || "").toUpperCase();
        if (t === "VALIDADO") status = "VALIDADO";
        else if (t === "REJEITADO") status = "REJEITADO";
        else if (t === "INVALIDADO") status = "INVALIDADO";
        else if (r.remanejamentoDataConclusao) status = "CONCLUIDO";
        else status = "EM_ANDAMENTO";
      } else if (r.remanejamentoDataConclusao) {
        status = "CONCLUIDO";
      }
      counts[status] = (counts[status] || 0) + 1;
    });
    const total = rows.length || 1;
    const items = Object.entries(counts).map(([status, count]) => ({
      status,
      count,
      pct: (count / total) * 100,
    }));
    const order = [
      "VALIDADO",
      "REJEITADO",
      "INVALIDADO",
      "CONCLUIDO",
      "EM_ANDAMENTO",
    ];
    items.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
    return items;
  }, [visaoTodos, porRemanejamentoFiltrados, porRemanejamentoFiltradosAll]);

  // Distribuição de status — somente concluídos (Overview em dias)
  const statusDistribDias = useMemo(() => {
    const rows = porRemanejamentoFiltrados;
    const counts: Record<string, number> = {};
    rows.forEach((r) => {
      const logSegs = (r.responsabilidadeTimeline || []).filter(
        (seg) => (seg.responsavel || "").toUpperCase() === "LOGISTICA"
      );
      const sorted = [...logSegs].sort((a, b) => {
        const ta = a.fim
          ? new Date(a.fim).getTime()
          : a.inicio
          ? new Date(a.inicio).getTime()
          : 0;
        const tb = b.fim
          ? new Date(b.fim).getTime()
          : b.inicio
          ? new Date(b.inicio).getTime()
          : 0;
        return ta - tb;
      });
      const last = sorted.length ? sorted[sorted.length - 1] : null;
      let status = "EM_ANDAMENTO";
      if (last?.tipo) {
        const t = (last.tipo || "").toUpperCase();
        if (t === "VALIDADO") status = "VALIDADO";
        else if (t === "REJEITADO") status = "REJEITADO";
        else if (t === "INVALIDADO") status = "INVALIDADO";
        else if (r.remanejamentoDataConclusao) status = "CONCLUIDO";
        else status = "EM_ANDAMENTO";
      } else if (r.remanejamentoDataConclusao) {
        status = "CONCLUIDO";
      }
      counts[status] = (counts[status] || 0) + 1;
    });
    const total = rows.length || 1;
    const items = Object.entries(counts).map(([status, count]) => ({
      status,
      count,
      pct: (count / total) * 100,
    }));
    const order = [
      "VALIDADO",
      "REJEITADO",
      "INVALIDADO",
      "CONCLUIDO",
      "EM_ANDAMENTO",
    ];
    items.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
    return items;
  }, [porRemanejamentoFiltrados]);

  const rankingSetoresAll = useMemo(() => {
    const fixed = setoresDisponiveis.map((s) => s.toUpperCase());
    const items = (porSetorBaseAll || []).filter((s) =>
      fixed.includes((s.setor || "").toUpperCase())
    );
    return [...items].sort((a, b) => {
      const valA = a.tempoMedioConclusaoMs || a.duracaoMediaAtuacaoMs || 0;
      const valB = b.tempoMedioConclusaoMs || b.duracaoMediaAtuacaoMs || 0;
      return valA - valB;
    });
  }, [porSetorBaseAll, setoresDisponiveis]);

  const exportDetalhadoXLSX = useCallback(() => {
    const usandoAll = activeTab === "dias_all";
    const rems = usandoAll
      ? dataAll?.porRemanejamento || []
      : data?.porRemanejamento || [];
    if (!rems.length) return;
    const rows: any[] = [];
    const rowsResumo: any[] = [];
    const rowsEventos: any[] = [];
    const rowsCiclos: any[] = [];
    const rowsDiag: any[] = [];
    rems.forEach((r) => {
      let diagReprovCount = 0;
      let diagSetorEventosCount = 0;
      let diagLogisticaEventosCount = 0;

      // Segmentos cronológicos com início pela Logística e término pela Logística
      const segsLogAll = (r.responsabilidadeTimeline || [])
        .filter((seg) => (seg.responsavel || "").toUpperCase() === "LOGISTICA")
        .map((seg) => ({
          setor: "LOGISTICA",
          inicio: seg.inicio,
          fim: seg.fim,
          ms: seg.ms,
          ciclo: seg.ciclo,
          tipo: seg.tipo,
        }));
      const preCandidates = segsLogAll.filter((s) => {
        const t = (s.tipo || "").toUpperCase();
        return (
          t === "PRE_SETOR_APROVACAO" ||
          t === "PRE_SETOR_APROVACAO_TAREFAS" ||
          t === "PRE_SETOR_FALLBACK"
        );
      });
      const preLog = preCandidates.length
        ? preCandidates.sort(
            (a, b) =>
              new Date(a.inicio).getTime() - new Date(b.inicio).getTime()
          )[0]
        : segsLogAll.length
        ? segsLogAll.sort(
            (a, b) =>
              new Date(a.inicio).getTime() - new Date(b.inicio).getTime()
          )[0]
        : undefined;
      const finalCandidates = segsLogAll.filter((s) => {
        const t = (s.tipo || "").toUpperCase();
        return t === "VALIDADO";
      });
      const finalLog = finalCandidates.length
        ? finalCandidates.sort(
            (a, b) => new Date(a.fim).getTime() - new Date(b.fim).getTime()
          )[finalCandidates.length - 1]
        : segsLogAll.length
        ? segsLogAll.sort(
            (a, b) => new Date(a.fim).getTime() - new Date(b.fim).getTime()
          )[segsLogAll.length - 1]
        : undefined;

      const segsSetores: {
        setor: string;
        inicio: string;
        fim: string;
        ms: number;
        ciclo?: number;
        tipo?: string;
      }[] = [];
      const mapSegs =
        r.segmentosPorSetor ||
        ({} as Record<
          string,
          {
            inicio: string;
            fim: string;
            ms: number;
            ciclo?: number;
            tipo?: string;
          }[]
        >);
      setoresDisponiveis
        .filter((s) => s.toUpperCase() !== "LOGISTICA")
        .forEach((s) => {
          const key = s.toUpperCase();
          (mapSegs[key] || []).forEach((seg) => {
            segsSetores.push({
              setor: s,
              inicio: seg.inicio,
              fim: seg.fim,
              ms: seg.ms,
              ciclo: seg.ciclo,
            });
          });
        });
      // Dividir segmentos de setores por eventos de reprovação dentro do intervalo
      const segsSetoresExpanded: {
        setor: string;
        inicio: string;
        fim: string;
        ms: number;
        ciclo?: number;
        tipo?: string;
      }[] = [];
      segsSetores.forEach((seg) => {
        const start = seg.inicio ? new Date(seg.inicio) : null;
        const end = seg.fim ? new Date(seg.fim) : null;
        if (!start || !end || end <= start) {
          segsSetoresExpanded.push(seg);
          return;
        }
        const evs = (r.reprovEvents || [])
          .filter((ev) => {
            const evSetor = (ev.setor || "").toUpperCase();
            const segSetor = (seg.setor || "").toUpperCase();
            const dt = ev.data ? new Date(ev.data) : null;
            return evSetor === segSetor && dt && dt > start && dt < end;
          })
          .map((ev) => new Date(ev.data as string))
          .sort((a, b) => a.getTime() - b.getTime());
        if (!evs.length) {
          segsSetoresExpanded.push(seg);
          return;
        }
        let curStart = start;
        for (const evDate of evs) {
          const ms = Math.max(0, evDate.getTime() - curStart.getTime());
          if (ms > 0) {
            segsSetoresExpanded.push({
              setor: seg.setor,
              inicio: curStart.toISOString(),
              fim: evDate.toISOString(),
              ms,
              ciclo: seg.ciclo,
              tipo: "SETOR_REPROVACAO_STEP",
            });
          }
          curStart = evDate;
        }
        const lastMs = Math.max(0, end.getTime() - curStart.getTime());
        if (lastMs > 0) {
          segsSetoresExpanded.push({
            setor: seg.setor,
            inicio: curStart.toISOString(),
            fim: end.toISOString(),
            ms: lastMs,
            ciclo: seg.ciclo,
            tipo: "SETOR_REPROVACAO_STEP",
          });
        }
      });
      const segsLogMid = segsLogAll.filter((s) => {
        const isPre =
          preLog && s.inicio === preLog.inicio && s.fim === preLog.fim;
        const isEnd =
          finalLog && s.inicio === finalLog.inicio && s.fim === finalLog.fim;
        return !isPre && !isEnd;
      });
      const middleSegs = [...segsSetoresExpanded, ...segsLogMid].sort(
        (a, b) => {
          const ta = a.inicio ? new Date(a.inicio).getTime() : 0;
          const tb = b.inicio ? new Date(b.inicio).getTime() : 0;
          return ta - tb;
        }
      );
      // Fallbacks: garantir início em Logística e término em Logística quando timeline não trouxe segmentos
      const earliestMiddleStart = middleSegs.length
        ? middleSegs[0].inicio
        : undefined;
      const latestMiddleEnd = middleSegs.length
        ? middleSegs.reduce((acc, seg) => {
            const t = seg.fim ? new Date(seg.fim).getTime() : 0;
            return t > acc ? t : acc;
          }, 0)
        : 0;
      const latestMiddleEndISO = latestMiddleEnd
        ? new Date(latestMiddleEnd).toISOString()
        : undefined;
      const syntheticPre =
        !preLog && r.solicitacaoDataCriacao && earliestMiddleStart
          ? {
              setor: "LOGISTICA",
              inicio: r.solicitacaoDataCriacao,
              fim: earliestMiddleStart,
              ms: Math.max(
                0,
                new Date(earliestMiddleStart).getTime() -
                  new Date(r.solicitacaoDataCriacao).getTime()
              ),
              ciclo: 0,
              tipo: "PRE_SETOR_EXPORT_FALLBACK",
            }
          : undefined;
      const syntheticFinal =
        !finalLog && r.remanejamentoDataConclusao && latestMiddleEndISO
          ? {
              setor: "LOGISTICA",
              inicio: latestMiddleEndISO,
              fim: r.remanejamentoDataConclusao,
              ms: Math.max(
                0,
                new Date(r.remanejamentoDataConclusao).getTime() -
                  new Date(latestMiddleEndISO).getTime()
              ),
              ciclo: undefined,
              tipo: "FINAL_EXPORT_FALLBACK",
            }
          : undefined;
      let segIdx = 0;
      const toPartsStr = (iso?: string | null) => {
        if (!iso) return { data: "", hora: "" };
        const d = new Date(iso);
        return {
          data: d.toLocaleDateString("pt-BR"),
          hora: d.toLocaleTimeString("pt-BR"),
        };
      };
      const pushSeg = (seg: {
        setor: string;
        inicio: string;
        fim: string;
        ms: number;
        ciclo?: number;
        tipo?: string;
      }) => {
        const partsInicio = toPartsStr(seg.inicio);
        const partsFim = toPartsStr(seg.fim);
        const partsIniRem = toPartsStr(r.solicitacaoDataCriacao || null);
        const partsFimRem = toPartsStr(r.remanejamentoDataConclusao || null);
        rows.push({
          TipoLinha: "SEGMENTO",
          Remanejamento: String(r.remanejamentoId),
          Funcionario: r.funcionario?.nome || "",
          Matricula: r.funcionario?.matricula || "",
          InicioRemanejamentoData: partsIniRem.data,
          InicioRemanejamentoHora: partsIniRem.hora,
          FimRemanejamentoData: partsFimRem.data,
          FimRemanejamentoHora: partsFimRem.hora,
          Setor: seg.setor,
          Segmento: ++segIdx,
          Ciclo: typeof seg.ciclo === "number" ? seg.ciclo : "",
          Tipo:
            seg.tipo ||
            (seg.setor.toUpperCase() === "LOGISTICA" ? "LOGISTICA" : ""),
          InicioData: partsInicio.data,
          InicioHora: partsInicio.hora,
          FimData: partsFim.data,
          FimHora: partsFim.hora,
          Duracao: seg.ms ? fmtMs(seg.ms) : "",
          TotalRemanejamento: fmtMs(r.totalDurMs),
        });
      };
      if (preLog) pushSeg(preLog);
      else if (syntheticPre) pushSeg(syntheticPre as any);
      middleSegs.forEach(pushSeg);
      if (
        finalLog &&
        (!preLog ||
          finalLog.inicio !== preLog.inicio ||
          finalLog.fim !== preLog.fim)
      )
        pushSeg(finalLog);
      else if (syntheticFinal) pushSeg(syntheticFinal as any);

      // Resumo por remanejamento: totais por setor + total do remanejamento
      const durBySetor: Record<string, number> = {};
      (r.duracaoPorSetorMs || []).forEach((d) => {
        const k = (d.setor || "").toUpperCase();
        durBySetor[k] = (durBySetor[k] || 0) + (d.ms || 0);
      });
      rowsResumo.push({
        Remanejamento: String(r.remanejamentoId),
        Funcionario: r.funcionario?.nome || "",
        Matricula: r.funcionario?.matricula || "",
        RH: durBySetor["RH"] ? fmtMs(durBySetor["RH"]) : "",
        MEDICINA: durBySetor["MEDICINA"] ? fmtMs(durBySetor["MEDICINA"]) : "",
        TREINAMENTO: durBySetor["TREINAMENTO"]
          ? fmtMs(durBySetor["TREINAMENTO"])
          : "",
        LOGISTICA: durBySetor["LOGISTICA"]
          ? fmtMs(durBySetor["LOGISTICA"])
          : "",
        TotalRemanejamento: fmtMs(r.totalDurMs),
      });

      // Eventos/ciclos explicados: fonte responsabilidadeTimeline
      // Eventos/ciclos explicados: fonte responsabilidadeTimeline (ordenados por início)
      [...(r.responsabilidadeTimeline || [])]
        .sort((a, b) => {
          const ta = a.inicio ? new Date(a.inicio).getTime() : 0;
          const tb = b.inicio ? new Date(b.inicio).getTime() : 0;
          return ta - tb;
        })
        .forEach((seg) => {
          const partsInicio = seg.inicio
            ? {
                data: new Date(seg.inicio).toLocaleDateString("pt-BR"),
                hora: new Date(seg.inicio).toLocaleTimeString("pt-BR"),
              }
            : { data: "", hora: "" };
          const partsFim = seg.fim
            ? {
                data: new Date(seg.fim).toLocaleDateString("pt-BR"),
                hora: new Date(seg.fim).toLocaleTimeString("pt-BR"),
              }
            : { data: "", hora: "" };
          const explicacao = (() => {
            const t = (seg.tipo || "").toUpperCase();
            const resp = (seg.responsavel || "").toUpperCase();
            if (resp === "LOGISTICA" && t === "PRE_SETOR_APROVACAO")
              return "Pré-setores: Logística da criação até a aprovação inicial.";
            if (resp === "LOGISTICA" && t === "PRE_SETOR_APROVACAO_TAREFAS")
              return "Pré-setores: Logística da criação até a criação da primeira tarefa (fallback sem dataAprovado).";
            if (resp === "LOGISTICA" && t === "PRE_SETOR_FALLBACK")
              return "Pré-setores: fallback usando submetido/resposta/primeira decisão quando não há aprovação.";
            if (
              resp === "LOGISTICA" &&
              (t === "VALIDADO" || t === "REJEITADO" || t === "INVALIDADO")
            )
              return `Pós-setores: Logística entre a conclusão de todas as tarefas e a decisão ${t}.`;
            if (resp === "LOGISTICA" && t === "RESPOSTA")
              return "Pós-setores: janela até a resposta de Prestserv (fallback).";
            if (resp === "LOGISTICA" && t === "SUBMETIDO")
              return "Pós-setores: janela usando data de submetido (fallback).";
            if (resp === "LOGISTICA" && t === "FALLBACK_SUB_RESP_VALIDADO")
              return "Fallback: Submetido até Validado/Conclusão quando não há eventos suficientes.";
            return resp === "LOGISTICA"
              ? "Logística ativa."
              : "Setores ativos.";
          })();
          rowsEventos.push({
            Remanejamento: String(r.remanejamentoId),
            Funcionario: r.funcionario?.nome || "",
            Matricula: r.funcionario?.matricula || "",
            Ciclo: typeof seg.ciclo === "number" ? seg.ciclo : "",
            Responsavel: seg.responsavel,
            Tipo: seg.tipo || "",
            InicioData: partsInicio.data,
            InicioHora: partsInicio.hora,
            FimData: partsFim.data,
            FimHora: partsFim.hora,
            Duracao: fmtMs(seg.ms || 0),
            Explicacao: explicacao,
          });
          if ((seg.responsavel || "").toUpperCase() === "LOGISTICA")
            diagLogisticaEventosCount++;
        });

      const mapSetorEventos =
        r.segmentosPorSetor ||
        ({} as Record<
          string,
          { inicio: string; fim: string; ms: number; ciclo?: number }[]
        >);
      Object.entries(mapSetorEventos)
        .filter(([setor]) => (setor || "").toUpperCase() !== "LOGISTICA")
        .forEach(([setor, arr]) => {
          [...(arr || [])]
            .sort((a, b) => {
              const ta = a.inicio ? new Date(a.inicio).getTime() : 0;
              const tb = b.inicio ? new Date(b.inicio).getTime() : 0;
              return ta - tb;
            })
            .forEach((seg) => {
              const partsInicio = seg.inicio
                ? {
                    data: new Date(seg.inicio).toLocaleDateString("pt-BR"),
                    hora: new Date(seg.inicio).toLocaleTimeString("pt-BR"),
                  }
                : { data: "", hora: "" };
              const partsFim = seg.fim
                ? {
                    data: new Date(seg.fim).toLocaleDateString("pt-BR"),
                    hora: new Date(seg.fim).toLocaleTimeString("pt-BR"),
                  }
                : { data: "", hora: "" };
              rowsEventos.push({
                Remanejamento: String(r.remanejamentoId),
                Funcionario: r.funcionario?.nome || "",
                Matricula: r.funcionario?.matricula || "",
                Ciclo: typeof seg.ciclo === "number" ? seg.ciclo : "",
                Responsavel: setor,
                Tipo: "SETOR",
                InicioData: partsInicio.data,
                InicioHora: partsInicio.hora,
                FimData: partsFim.data,
                FimHora: partsFim.hora,
                Duracao: fmtMs(seg.ms || 0),
                Explicacao: `Atuação do setor ${setor} no ciclo ${
                  typeof seg.ciclo === "number" ? seg.ciclo : ""
                }`,
              });
              diagSetorEventosCount++;
            });
        });

      // Eventos de reprovação por setor (detalhe de steps)
      [...(r.reprovEvents || [])]
        .sort((a, b) => {
          const ta = a.data ? new Date(a.data).getTime() : 0;
          const tb = b.data ? new Date(b.data).getTime() : 0;
          return ta - tb;
        })
        .forEach((ev) => {
          const parts = ev.data
            ? {
                data: new Date(ev.data).toLocaleDateString("pt-BR"),
                hora: new Date(ev.data).toLocaleTimeString("pt-BR"),
              }
            : { data: "", hora: "" };
          rowsEventos.push({
            Remanejamento: String(r.remanejamentoId),
            Funcionario: r.funcionario?.nome || "",
            Matricula: r.funcionario?.matricula || "",
            Ciclo: "",
            Responsavel: ev.setor,
            Tipo: "REPROVACAO",
            InicioData: parts.data,
            InicioHora: parts.hora,
            FimData: "",
            FimHora: "",
            Duracao: "",
            Explicacao: `Tarefa reprovada no setor ${ev.setor}${
              ev.source ? ` (${ev.source})` : ""
            }`,
          });
          diagReprovCount++;
        });

      rowsDiag.push({
        Remanejamento: String(r.remanejamentoId),
        TeveReprovacao: r.teveReprovacao ? "SIM" : "NAO",
        ReprovEventsAPI: (r.reprovEvents || []).length,
        ReprovEventsExport: diagReprovCount,
        EventosSetorExport: diagSetorEventosCount,
        EventosLogisticaExport: diagLogisticaEventosCount,
      });

      // Planilha de ciclos: início/fim por ciclo, decisão e reprovações
      const segsMap = (r.segmentosPorSetor || {}) as Record<
        string,
        { inicio: string; fim: string; ms: number; ciclo?: number }[]
      >;
      const cyclesDurBySetor: Record<number, Record<string, number>> = {};
      const cyclesStart: Record<number, Date> = {};
      const cyclesEnd: Record<number, Date> = {};
      Object.entries(segsMap).forEach(([setor, arr]) => {
        (arr || []).forEach((seg) => {
          const c = Number(seg.ciclo || 0);
          if (!c) return;
          const start = seg.inicio ? new Date(seg.inicio) : null;
          const end = seg.fim ? new Date(seg.fim) : null;
          if (start && (!cyclesStart[c] || start < cyclesStart[c]))
            cyclesStart[c] = start;
          if (end && (!cyclesEnd[c] || end > cyclesEnd[c])) cyclesEnd[c] = end;
          const ksetor = (setor || "").toUpperCase();
          const dmap = cyclesDurBySetor[c] || (cyclesDurBySetor[c] = {});
          dmap[ksetor] = (dmap[ksetor] || 0) + (seg.ms || 0);
        });
      });
      const decisions: Record<
        number,
        { tipo: string; inicio: Date | null; fim: Date | null; ms: number }
      > = {};
      (r.responsabilidadeTimeline || []).forEach((seg) => {
        if (
          (seg.responsavel || "").toUpperCase() === "LOGISTICA" &&
          (seg as any).ciclo
        ) {
          const c = Number((seg as any).ciclo);
          decisions[c] = {
            tipo: seg.tipo || "",
            inicio: seg.inicio ? new Date(seg.inicio) : null,
            fim: seg.fim ? new Date(seg.fim) : null,
            ms: seg.ms || 0,
          };
        }
      });
      const reprovCountByCycle: Record<number, number> = {};
      const reprovStartByCycle: Record<number, Date | null> = {};
      const reprovEndByCycle: Record<number, Date | null> = {};
      (r.reprovEvents || []).forEach((ev) => {
        const d = ev.data ? new Date(ev.data) : null;
        if (!d) return;
        Object.keys(cyclesStart).forEach((ck) => {
          const ci = Number(ck);
          const cs = cyclesStart[ci];
          const ce = (decisions[ci]?.fim as Date | null) || cyclesEnd[ci];
          if (cs && ce && d >= cs && d <= ce) {
            reprovCountByCycle[ci] = (reprovCountByCycle[ci] || 0) + 1;
            const rs = reprovStartByCycle[ci];
            const re = reprovEndByCycle[ci];
            if (!rs || d < rs) reprovStartByCycle[ci] = d;
            if (!re || d > re) reprovEndByCycle[ci] = d;
          }
        });
      });
      const toPartsAny = (iso?: Date | string | null) => {
        if (!iso) return { data: "", hora: "" };
        const d = typeof iso === "string" ? new Date(iso) : (iso as Date);
        return {
          data: d.toLocaleDateString("pt-BR"),
          hora: d.toLocaleTimeString("pt-BR"),
        };
      };
      Object.keys(cyclesStart)
        .map((ck) => Number(ck))
        .sort((a, b) => a - b)
        .forEach((ci) => {
          const start = cyclesStart[ci];
          const end = (decisions[ci]?.fim as Date | null) || cyclesEnd[ci];
          if (!start || !end) return;
          const partsInicio = toPartsAny(start);
          const partsFim = toPartsAny(end);
          const durMs = Math.max(0, end.getTime() - start.getTime());
          const bySet = cyclesDurBySetor[ci] || {};
          rowsCiclos.push({
            Remanejamento: String(r.remanejamentoId),
            Funcionario: r.funcionario?.nome || "",
            Matricula: r.funcionario?.matricula || "",
            Ciclo: ci,
            InicioData: partsInicio.data,
            InicioHora: partsInicio.hora,
            FimData: partsFim.data,
            FimHora: partsFim.hora,
            DuracaoCiclo: fmtMs(durMs),
            DecisaoTipo: decisions[ci]?.tipo || "",
            ReprovacoesNoCiclo: reprovCountByCycle[ci] || 0,
            ReprovInicioData: toPartsAny(reprovStartByCycle[ci]).data,
            ReprovInicioHora: toPartsAny(reprovStartByCycle[ci]).hora,
            ReprovFimData: toPartsAny(reprovEndByCycle[ci]).data,
            ReprovFimHora: toPartsAny(reprovEndByCycle[ci]).hora,
            ReprovDuracao: (() => {
              const rs = reprovStartByCycle[ci];
              const re = reprovEndByCycle[ci];
              if (rs && re)
                return fmtMs(Math.max(0, re.getTime() - rs.getTime()));
              return "";
            })(),
            RH: bySet["RH"] ? fmtMs(bySet["RH"]) : "",
            MEDICINA: bySet["MEDICINA"] ? fmtMs(bySet["MEDICINA"]) : "",
            TREINAMENTO: bySet["TREINAMENTO"]
              ? fmtMs(bySet["TREINAMENTO"])
              : "",
            LOGISTICA: bySet["LOGISTICA"] ? fmtMs(bySet["LOGISTICA"]) : "",
          });
        });
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Detalhado");
    const wsResumo = XLSX.utils.json_to_sheet(rowsResumo);
    XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");
    const wsEventos = XLSX.utils.json_to_sheet(rowsEventos);
    XLSX.utils.book_append_sheet(wb, wsEventos, "Eventos");
    const wsCiclos = XLSX.utils.json_to_sheet(rowsCiclos);
    XLSX.utils.book_append_sheet(wb, wsCiclos, "Ciclos");
    const wsDiag = XLSX.utils.json_to_sheet(rowsDiag);
    XLSX.utils.book_append_sheet(wb, wsDiag, "Diagnostico");
    XLSX.writeFile(wb, "Relatorio_SLA_Detalhado.xlsx");
  }, [
    activeTab,
    porRemanejamentoValidos,
    porRemanejamentoValidosAll,
    setoresDisponiveis,
    data?.porRemanejamento,
    dataAll?.porRemanejamento,
  ]);

  type DetalhadoKPIs = {
    total: number;
    mediaTotalMs: number;
    setorMaisLento: { setor: string; ms: number } | null;
    reprovsTotal: number;
    setorMaiorConclusao: { setor: string; ms: number } | null;
    percentLogistica: number;
  };

  const detalhadoKPIs = useMemo<DetalhadoKPIs>(() => {
    const datasetRows = visaoTodos
      ? porRemanejamentoFiltradosAll
      : porRemanejamentoFiltrados;
    const datasetSetor = visaoTodos ? porSetorBaseAll : porSetorBase;
    const total = datasetRows.length;
    const mediaTotalMs = total
      ? Math.round(
          datasetRows.reduce((a, r) => a + (r.totalDurMs || 0), 0) / total
        )
      : 0;
    const durBySetor: Record<string, number> = {};
    let logisticCount = 0;
    datasetRows.forEach((r) => {
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
    const reprovsTotal = datasetSetor.reduce(
      (acc, s) => acc + (s.reprovacoes || 0),
      0
    );
    const setorMaiorConclusao = datasetSetor.reduce<{
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
  }, [
    visaoTodos,
    porRemanejamentoFiltrados,
    porRemanejamentoFiltradosAll,
    porSetorBase,
    porSetorBaseAll,
  ]);

  const mediaTotalFiltradaMs = useMemo(() => {
    const datasetRows = visaoTodos
      ? porRemanejamentoFiltradosAll
      : porRemanejamentoFiltrados;
    const total = datasetRows.length;
    const totalMs = datasetRows.reduce(
      (acc, r) => acc + (r.totalDurMs || 0),
      0
    );
    return total ? Math.round(totalMs / total) : 0;
  }, [visaoTodos, porRemanejamentoFiltrados, porRemanejamentoFiltradosAll]);

  const totalRows = (
    visaoTodos ? porRemanejamentoFiltradosAll : porRemanejamentoFiltrados
  ).length;
  const totalPages = Math.max(1, Math.ceil(totalRows / rowsPerPage));
  const pageData = useMemo(() => {
    const datasetRows = visaoTodos
      ? porRemanejamentoFiltradosAll
      : porRemanejamentoFiltrados;
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    return datasetRows.slice(start, end);
  }, [
    visaoTodos,
    porRemanejamentoFiltrados,
    porRemanejamentoFiltradosAll,
    page,
  ]);

  const totalRowsAll = porRemanejamentoFiltradosAll.length;
  const totalPagesAll = Math.max(1, Math.ceil(totalRowsAll / rowsPerPage));
  const pageDataAll = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    return porRemanejamentoFiltradosAll.slice(start, end);
  }, [porRemanejamentoFiltradosAll, page]);

  const rankingSetores = useMemo(() => {
    const datasetSetor = visaoTodos ? porSetorBaseAll : porSetorBase;
    const fixed = setoresVisiveis.map((s) => s.toUpperCase());
    const items = datasetSetor.filter((s) =>
      fixed.includes((s.setor || "").toUpperCase())
    );
    return [...items].sort((a, b) => {
      const valA = a.tempoMedioConclusaoMs || a.duracaoMediaAtuacaoMs || 0;
      const valB = b.tempoMedioConclusaoMs || b.duracaoMediaAtuacaoMs || 0;
      return valA - valB;
    });
  }, [visaoTodos, porSetorBase, porSetorBaseAll, setoresVisiveis]);

  const topReprovacoes = useMemo(() => {
    const entries = Object.entries(
      (visaoTodos ? dataAll?.reprovacoesPorTipo : data?.reprovacoesPorTipo) ||
        {}
    );
    entries.sort((a, b) => (b[1] || 0) - (a[1] || 0));
    return entries.slice(0, 5);
  }, [visaoTodos, data, dataAll]);

  const ChartsAndKpis: React.FC = () => {
    const porSetorView = visaoTodos ? porSetorBaseAll : porSetorBase;
    const totalRems = visaoTodos
      ? porRemanejamentoFiltradosAll.length
      : porRemanejamentoFiltrados.length;
    return (
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-stretch">
        <div className="flex flex-col gap-4 lg:col-span-1">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-600">
                Total de Remanejamentos ({visaoTodos ? "Todos" : "Concluídos"})
              </p>
              <p className="text-xl font-bold text-gray-900">{totalRems}</p>
            </div>
            <div className="p-3 bg-blue-500 rounded-full">
              <UserGroupIcon className="w-6 h-6 text-white" />
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
                    key={`rank-view-${s.setor}`}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      {idx === 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700">
                          <TrophyIcon className="w-4 h-4" /> #{idx + 1}
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
                          <ArrowTrendingUpIcon className="w-4 h-4" /> Precisa
                          melhorar
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
                      {fmtDias(
                        s.tempoMedioConclusaoMs || s.duracaoMediaAtuacaoMs || 0
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
                {mediaGeralDiasView <= 0 ? "<1d" : `${mediaGeralDiasView}d`}
              </p>
              <p className="text-xs text-gray-500">Tempo médio por setor</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {setoresDisponiveis.map((s) => {
                  const item = porSetorView.find(
                    (x) => (x.setor || "").toUpperCase() === s.toUpperCase()
                  );
                  const ms = item
                    ? item.tempoMedioConclusaoMs ||
                      item.duracaoMediaAtuacaoMs ||
                      0
                    : 0;
                  const DAY = 24 * 60 * 60 * 1000;
                  const diasFloat = ms / DAY;
                  const textoDias =
                    diasFloat > 0 && diasFloat < 1
                      ? "<1d"
                      : `${Math.floor(diasFloat)}d`;
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
                      key={`badge-view-${s}`}
                      className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs ${cls}`}
                    >
                      {s}: {textoDias}
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
                <p className="text-xs font-medium text-gray-600">
                  Distribuição por faixas (dias)
                </p>
                <p className="text-xs text-gray-500">
                  Resumo por remanejamento
                </p>
              </div>
              <div className="p-3 bg-sky-500 rounded-full">
                <ChartBarIcon className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {(() => {
                const total =
                  bucketDistribDiasView.reduce((acc, x) => acc + x.count, 0) ||
                  1;
                return bucketDistribDiasView.map((b) => {
                  const pct = Math.round((b.count / total) * 100);
                  const cls =
                    b.faixa === "< 1 dia"
                      ? "bg-indigo-50 text-indigo-700"
                      : b.faixa === "1–3 dias"
                      ? "bg-emerald-50 text-emerald-700"
                      : b.faixa === "3–7 dias"
                      ? "bg-amber-50 text-amber-700"
                      : "bg-pink-50 text-pink-700";
                  return (
                    <span
                      key={`chip-view-${b.faixa}`}
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${cls}`}
                    >
                      {b.faixa}: {b.count} ({pct}%)
                    </span>
                  );
                });
              })()}
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Reprovações por tipo de tarefa
                </p>
                <p className="text-xs text-gray-500">Top 5 mais reprovadas</p>
              </div>
              <div className="p-3 bg-red-500 rounded-full">
                <ExclamationTriangleIcon className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="space-y-2">
              {topReprovacoes.length > 0 ? (
                topReprovacoes.map(([tipo, qtd]) => (
                  <div
                    key={`rep-view-${tipo}`}
                    className="flex items-center justify-between"
                  >
                    <span className="text-sm text-gray-800">{tipo}</span>
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
          <div className="rounded-2xl bg-white shadow-xl p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <ChartBarIcon className="h-5 w-5 text-indigo-600" />
                    <h3 className="text-base font-semibold text-gray-800">
                      Participação por setor (dias)
                    </h3>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs">
                      <ClockIcon className="h-4 w-4" /> Média geral:{" "}
                      {mediaGeralDiasView <= 0
                        ? "<1d"
                        : `${mediaGeralDiasView}d`}
                    </span>
                  </div>
                </div>
                <div className="h-[340px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieSetoresDiasView}
                        dataKey="dias"
                        nameKey="setor"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        label={({ pct }) => `${Number(pct).toFixed(1)}%`}
                      >
                        {pieSetoresDiasView.map((entry) => {
                          const colorMap: Record<string, string> = {
                            RH: "#60A5FA",
                            MEDICINA: "#10B981",
                            TREINAMENTO: "#8B5CF6",
                            LOGISTICA: "#EC4899",
                          };
                          const c =
                            colorMap[(entry.setor || "").toUpperCase()] ||
                            "#9CA3AF";
                          return (
                            <Cell
                              key={`cell-view-pie-${entry.setor}`}
                              fill={c}
                            />
                          );
                        })}
                      </Pie>
                      <Tooltip
                        formatter={(_, name, { payload }) => [
                          `${Number(payload?.pct || 0).toFixed(1)}%`,
                          payload?.setor ?? name,
                        ]}
                      />
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
                      <span
                        key={`legend-view-pie-${s}`}
                        className="inline-flex items-center gap-2 text-xs text-gray-700"
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: c }}
                        ></span>
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
                    <h3 className="text-base font-semibold text-gray-800">
                      Distribuição por faixas (dias)
                    </h3>
                  </div>
                </div>
                <div className="h-[340px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stackDistribBucketsSetoresView}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis dataKey="faixa" tick={{ fill: "#6B7280" }} />
                      <YAxis tick={{ fill: "#6B7280" }} />
                      <Tooltip
                        formatter={(value, name, { payload }) => [
                          `${(
                            ((Number(value) || 0) / (payload?.total || 1)) *
                            100
                          ).toFixed(1)}%`,
                          name,
                        ]}
                      />
                      <Bar
                        dataKey="RH"
                        name="RH"
                        stackId="stack"
                        fill="#60A5FA"
                        radius={[0, 0, 0, 0]}
                      />
                      <Bar
                        dataKey="MEDICINA"
                        name="Medicina"
                        stackId="stack"
                        fill="#10B981"
                        radius={[0, 0, 0, 0]}
                      />
                      <Bar
                        dataKey="TREINAMENTO"
                        name="Treinamento"
                        stackId="stack"
                        fill="#8B5CF6"
                        radius={[0, 0, 0, 0]}
                      />
                      <Bar
                        dataKey="LOGISTICA"
                        name="Logística"
                        stackId="stack"
                        fill="#EC4899"
                        radius={[8, 8, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 flex flex-wrap justify-center gap-3">
                  {[
                    { key: "RH", label: "RH", color: "#60A5FA" },
                    { key: "MEDICINA", label: "Medicina", color: "#10B981" },
                    {
                      key: "TREINAMENTO",
                      label: "Treinamento",
                      color: "#8B5CF6",
                    },
                    { key: "LOGISTICA", label: "Logística", color: "#EC4899" },
                  ].map((it) => (
                    <span
                      key={`legend-view-bar-${it.key}`}
                      className="inline-flex items-center gap-2 text-xs text-gray-700"
                    >
                      <span
                        className="w-2.5 h-2.5 rounded"
                        style={{ backgroundColor: it.color }}
                      ></span>
                      <span>{it.label}</span>
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <ChartBarIcon className="h-5 w-5 text-indigo-600" />
                    <h3 className="text-base font-semibold text-gray-800">
                      Distribuição por setor e faixa (contagem)
                    </h3>
                  </div>
                </div>
                <div className="h-[360px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={distribPorSetorBucketsView}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis dataKey="setor" tick={{ fill: "#6B7280" }} />
                      <YAxis tick={{ fill: "#6B7280" }} />
                      <Tooltip
                        formatter={(value, name) => [
                          String(Number(value || 0)),
                          name as string,
                        ]}
                      />
                      <Bar dataKey="lt1" name="< 1 dia" fill="#6366F1">
                        <LabelList
                          position="top"
                          content={(props: any) => (
                            <text
                              x={props.x}
                              y={props.y}
                              dy={-4}
                              fill="#374151"
                              fontSize={11}
                              textAnchor="middle"
                            >
                              {String(Number(props.value || 0))}
                            </text>
                          )}
                        />
                      </Bar>
                      <Bar dataKey="d1to3" name="1–3 dias" fill="#10B981">
                        <LabelList
                          position="top"
                          content={(props: any) => (
                            <text
                              x={props.x}
                              y={props.y}
                              dy={-4}
                              fill="#374151"
                              fontSize={11}
                              textAnchor="middle"
                            >
                              {String(Number(props.value || 0))}
                            </text>
                          )}
                        />
                      </Bar>
                      <Bar dataKey="d3to7" name="3–7 dias" fill="#F59E0B">
                        <LabelList
                          position="top"
                          content={(props: any) => (
                            <text
                              x={props.x}
                              y={props.y}
                              dy={-4}
                              fill="#374151"
                              fontSize={11}
                              textAnchor="middle"
                            >
                              {String(Number(props.value || 0))}
                            </text>
                          )}
                        />
                      </Bar>
                      <Bar dataKey="gt7" name="> 7 dias" fill="#EC4899">
                        <LabelList
                          position="top"
                          content={(props: any) => (
                            <text
                              x={props.x}
                              y={props.y}
                              dy={-4}
                              fill="#374151"
                              fontSize={11}
                              textAnchor="middle"
                            >
                              {String(Number(props.value || 0))}
                            </text>
                          )}
                        />
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
                    <span
                      key={`legend-view-sector-bucket-${it.key}`}
                      className="inline-flex items-center gap-2 text-xs text-gray-700"
                    >
                      <span
                        className="w-2.5 h-2.5 rounded"
                        style={{ backgroundColor: it.color }}
                      ></span>
                      <span>{it.label}</span>
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <ChartBarIcon className="h-5 w-5 text-indigo-600" />
                    <h3 className="text-base font-semibold text-gray-800">
                      Tempo médio por setor (dias)
                    </h3>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs">
                      <ClockIcon className="h-4 w-4" /> Média geral:{" "}
                      {mediaGeralDiasView <= 0
                        ? "<1d"
                        : `${mediaGeralDiasView}d`}
                    </span>
                  </div>
                </div>
                <div className="h-[360px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={donutMediaSetorDiasView}
                        dataKey="dias"
                        nameKey="setor"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={90}
                        label={({ dias }) =>
                          Number(dias) < 1
                            ? "<1"
                            : String(Math.floor(Number(dias)))
                        }
                      >
                        {donutMediaSetorDiasView.map((entry) => {
                          const colorMap: Record<string, string> = {
                            RH: "#60A5FA",
                            MEDICINA: "#10B981",
                            TREINAMENTO: "#8B5CF6",
                            LOGISTICA: "#EC4899",
                          };
                          const c =
                            colorMap[(entry.setor || "").toUpperCase()] ||
                            "#9CA3AF";
                          return (
                            <Cell
                              key={`cell-view-donut-${entry.setor}`}
                              fill={c}
                            />
                          );
                        })}
                      </Pie>
                      <Tooltip
                        formatter={(_, name, { payload }) => [
                          `${Number(payload?.pct || 0).toFixed(1)}%`,
                          payload?.setor ?? name,
                        ]}
                      />
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
                      <span
                        key={`legend-view-donut-${s}`}
                        className="inline-flex items-center gap-2 text-xs text-gray-700"
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: c }}
                        ></span>
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
    );
  };

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
                {!hideTabs && (
                  <nav className="flex space-x-8 px-6" aria-label="Tabs">
                    {[
                      { id: "dias", name: "Concluídos", icon: ClockIcon },
                      { id: "dias_all", name: "Todos", icon: ClockIcon },
                    ].map((tab) => {
                      const Icon = tab.icon as any;
                      const isActive = activeTab === (tab.id as any);
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id as any)}
                          className={`py-3 px-1 border-b-2 font-medium text-xs flex items-center space-x-2 transition-colors ${
                            isActive
                              ? "border-blue-500 text-blue-600"
                              : "border-transparent text-gray-500 hover:text-gray-300"
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          <span>{tab.name}</span>
                        </button>
                      );
                    })}
                  </nav>
                )}
              </div>
            </div>
            {activeTab === "dias" && (
              <div className="flex flex-col space-y-4">
                <div className="mb-4 rounded-xl bg-white border border-gray-200 p-4">
                  <div className="flex flex-wrap items-end gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Setor
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {["RH", "MEDICINA", "TREINAMENTO", "LOGISTICA"].map(
                          (s) => {
                            const active = filtroSetores.includes(s);
                            const cls = active
                              ? "bg-blue-600 text-white"
                              : "bg-gray-100 text-gray-700";
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
                          }
                        )}
                        <button
                          onClick={() => {
                            setPage(1);
                            setFiltroSetores([
                              "RH",
                              "MEDICINA",
                              "TREINAMENTO",
                              "LOGISTICA",
                            ]);
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
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Faixa (dias)
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { key: "lt1", label: "< 1 dia" },
                          { key: "d1to3", label: "1–3 dias" },
                          { key: "d3to7", label: "3–7 dias" },
                          { key: "gt7", label: "> 7 dias" },
                        ].map((b) => {
                          const active = filtroBuckets.includes(b.key);
                          const cls = active
                            ? "bg-indigo-600 text-white"
                            : "bg-gray-100 text-gray-700";
                          return (
                            <button
                              key={`fbucket-${b.key}`}
                              onClick={() => {
                                setPage(1);
                                setFiltroBuckets((prev) => {
                                  const has = prev.includes(b.key);
                                  if (has)
                                    return prev.filter((x) => x !== b.key);
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
                    <div className="flex flex-col gap-1">
                      <label className="block text-xs font-medium text-gray-600">
                        Período de Criação
                      </label>
                      <div className="flex gap-2 items-center">
                        <input
                          type="date"
                          max={
                            endDate || new Date().toISOString().split("T")[0]
                          }
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="px-2 py-1 rounded border border-gray-300 text-sm"
                        />
                        <span className="text-gray-500 text-xs">até</span>
                        <input
                          type="date"
                          min={startDate}
                          max={new Date().toISOString().split("T")[0]}
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="px-2 py-1 rounded border border-gray-300 text-sm"
                        />
                      </div>
                    </div>
                    <div className="flex-1 min-w-[180px]">
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Funcionário / Matrícula / Remanejamento
                      </label>
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
                          setFiltroSetores([
                            "RH",
                            "MEDICINA",
                            "TREINAMENTO",
                            "LOGISTICA",
                          ]);
                          setFiltroBuckets(["lt1", "d1to3", "d3to7", "gt7"]);
                          setFiltroFuncionario("");
                          setStartDate("");
                          setEndDate("");
                          setPage(1);
                        }}
                        className="px-3 py-1.5 rounded text-xs bg-gray-100 text-gray-700 border"
                      >
                        Limpar filtros
                      </button>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-stretch order-1">
                  <div className="flex flex-col gap-4 lg:col-span-1">
                    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-gray-600">
                          Total de Remanejamentos (Concluídos)
                        </p>
                        <p className="text-xl font-bold text-gray-900">
                          {porRemanejamentoFiltrados.length}
                        </p>
                      </div>
                      <div className="p-3 bg-blue-500 rounded-full">
                        <UserGroupIcon className="w-6 h-6 text-white" />
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
                              key={`rank-all-${s.setor}`}
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
                                {fmtDias(
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
                          {mediaGeralDias <= 0 ? "<1d" : `${mediaGeralDias}d`}
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
                            const DAY = 24 * 60 * 60 * 1000;
                            const diasFloat = ms / DAY;
                            const textoDias =
                              diasFloat > 0 && diasFloat < 1
                                ? "<1d"
                                : `${Math.floor(diasFloat)}d`;
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
                                key={`badge-all-${s}`}
                                className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs ${cls}`}
                              >
                                {s}: {textoDias}
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
                          <p className="text-xs font-medium text-gray-600">
                            Distribuição por faixas (dias)
                          </p>
                          <p className="text-xs text-gray-500">
                            Resumo por remanejamento
                          </p>
                        </div>
                        <div className="p-3 bg-sky-500 rounded-full">
                          <ChartBarIcon className="w-6 h-6 text-white" />
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(() => {
                          const total =
                            bucketDistribDias.reduce(
                              (acc, x) => acc + x.count,
                              0
                            ) || 1;
                          return bucketDistribDias.map((b) => {
                            const pct = Math.round((b.count / total) * 100);
                            const cls =
                              b.faixa === "< 1 dia"
                                ? "bg-indigo-50 text-indigo-700"
                                : b.faixa === "1–3 dias"
                                ? "bg-emerald-50 text-emerald-700"
                                : b.faixa === "3–7 dias"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-pink-50 text-pink-700";
                            return (
                              <span
                                key={`chip-all-${b.faixa}`}
                                className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${cls}`}
                              >
                                {b.faixa}: {b.count} ({pct}%)
                              </span>
                            );
                          });
                        })()}
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
                              key={`rep-all-${tipo}`}
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
                    <div className="rounded-2xl bg-white shadow-xl p-6">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <ChartBarIcon className="h-5 w-5 text-indigo-600" />
                              <h3 className="text-base font-semibold text-gray-800">
                                Participação por setor (dias)
                              </h3>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs">
                                <ClockIcon className="h-4 w-4" /> Média geral:{" "}
                                {mediaGeralDias <= 0
                                  ? "<1d"
                                  : `${mediaGeralDias}d`}
                              </span>
                            </div>
                          </div>
                          <div className="h-[340px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  isAnimationActive={false}
                                  data={pieSetoresDias}
                                  dataKey="dias"
                                  nameKey="setor"
                                  cx="50%"
                                  cy="50%"
                                  outerRadius={90}
                                  label={({ pct }) =>
                                    `${Number(pct).toFixed(1)}%`
                                  }
                                >
                                  {pieSetoresDias.map((entry) => {
                                    const colorMap: Record<string, string> = {
                                      RH: "#60A5FA",
                                      MEDICINA: "#10B981",
                                      TREINAMENTO: "#8B5CF6",
                                      LOGISTICA: "#EC4899",
                                    };
                                    const c =
                                      colorMap[
                                        (entry.setor || "").toUpperCase()
                                      ] || "#9CA3AF";
                                    return (
                                      <Cell
                                        key={`cell-pie-${entry.setor}`}
                                        fill={c}
                                      />
                                    );
                                  })}
                                </Pie>
                                <Tooltip
                                  formatter={(_, name, { payload }) => [
                                    `${Number(payload?.pct || 0).toFixed(1)}%`,
                                    payload?.setor ?? name,
                                  ]}
                                />
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
                              const c =
                                colorMap[(s || "").toUpperCase()] || "#9CA3AF";
                              return (
                                <span
                                  key={`legend-pie-${s}`}
                                  className="inline-flex items-center gap-2 text-xs text-gray-700"
                                >
                                  <span
                                    className="w-2.5 h-2.5 rounded-full"
                                    style={{ backgroundColor: c }}
                                  ></span>
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
                              <h3 className="text-base font-semibold text-gray-800">
                                Distribuição por faixas (dias)
                              </h3>
                            </div>
                          </div>
                          <div className="h-[340px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={stackDistribBucketsSetores}>
                                <CartesianGrid
                                  strokeDasharray="3 3"
                                  stroke="#E5E7EB"
                                />
                                <XAxis
                                  dataKey="faixa"
                                  tick={{ fill: "#6B7280" }}
                                />
                                <YAxis tick={{ fill: "#6B7280" }} />
                                <Tooltip
                                  formatter={(value, name, { payload }) => [
                                    `${(
                                      ((Number(value) || 0) /
                                        (payload?.total || 1)) *
                                      100
                                    ).toFixed(1)}%`,
                                    name,
                                  ]}
                                />
                                <Bar
                                  dataKey="RH"
                                  name="RH"
                                  stackId="stack"
                                  fill="#60A5FA"
                                  radius={[0, 0, 0, 0]}
                                />
                                <Bar
                                  dataKey="MEDICINA"
                                  name="Medicina"
                                  stackId="stack"
                                  fill="#10B981"
                                  radius={[0, 0, 0, 0]}
                                />
                                <Bar
                                  dataKey="TREINAMENTO"
                                  name="Treinamento"
                                  stackId="stack"
                                  fill="#8B5CF6"
                                  radius={[0, 0, 0, 0]}
                                />
                                <Bar
                                  dataKey="LOGISTICA"
                                  name="Logística"
                                  stackId="stack"
                                  fill="#EC4899"
                                  radius={[8, 8, 0, 0]}
                                />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="mt-3 flex flex-wrap justify-center gap-3">
                            {[
                              { key: "RH", label: "RH", color: "#60A5FA" },
                              {
                                key: "MEDICINA",
                                label: "Medicina",
                                color: "#10B981",
                              },
                              {
                                key: "TREINAMENTO",
                                label: "Treinamento",
                                color: "#8B5CF6",
                              },
                              {
                                key: "LOGISTICA",
                                label: "Logística",
                                color: "#EC4899",
                              },
                            ].map((it) => (
                              <span
                                key={`legend-bar-${it.key}`}
                                className="inline-flex items-center gap-2 text-xs text-gray-700"
                              >
                                <span
                                  className="w-2.5 h-2.5 rounded"
                                  style={{ backgroundColor: it.color }}
                                ></span>
                                <span>{it.label}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <ChartBarIcon className="h-5 w-5 text-indigo-600" />
                              <h3 className="text-base font-semibold text-gray-800">
                                Distribuição por setor e faixa (contagem)
                              </h3>
                            </div>
                          </div>
                          <div className="h-[360px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={distribPorSetorBuckets}>
                                <CartesianGrid
                                  strokeDasharray="3 3"
                                  stroke="#E5E7EB"
                                />
                                <XAxis
                                  dataKey="setor"
                                  tick={{ fill: "#6B7280" }}
                                />
                                <YAxis tick={{ fill: "#6B7280" }} />
                                <Tooltip
                                  formatter={(value, name) => [
                                    String(Number(value || 0)),
                                    name as string,
                                  ]}
                                />
                                <Bar
                                  dataKey="lt1"
                                  name="< 1 dia"
                                  fill="#6366F1"
                                >
                                  <LabelList
                                    position="top"
                                    content={(props: any) => (
                                      <text
                                        x={props.x}
                                        y={props.y}
                                        dy={-4}
                                        fill="#374151"
                                        fontSize={11}
                                        textAnchor="middle"
                                      >
                                        {String(Number(props.value || 0))}
                                      </text>
                                    )}
                                  />
                                </Bar>
                                <Bar
                                  dataKey="d1to3"
                                  name="1–3 dias"
                                  fill="#10B981"
                                >
                                  <LabelList
                                    position="top"
                                    content={(props: any) => (
                                      <text
                                        x={props.x}
                                        y={props.y}
                                        dy={-4}
                                        fill="#374151"
                                        fontSize={11}
                                        textAnchor="middle"
                                      >
                                        {String(Number(props.value || 0))}
                                      </text>
                                    )}
                                  />
                                </Bar>
                                <Bar
                                  dataKey="d3to7"
                                  name="3–7 dias"
                                  fill="#F59E0B"
                                >
                                  <LabelList
                                    position="top"
                                    content={(props: any) => (
                                      <text
                                        x={props.x}
                                        y={props.y}
                                        dy={-4}
                                        fill="#374151"
                                        fontSize={11}
                                        textAnchor="middle"
                                      >
                                        {String(Number(props.value || 0))}
                                      </text>
                                    )}
                                  />
                                </Bar>
                                <Bar
                                  dataKey="gt7"
                                  name="> 7 dias"
                                  fill="#EC4899"
                                >
                                  <LabelList
                                    position="top"
                                    content={(props: any) => (
                                      <text
                                        x={props.x}
                                        y={props.y}
                                        dy={-4}
                                        fill="#374151"
                                        fontSize={11}
                                        textAnchor="middle"
                                      >
                                        {String(Number(props.value || 0))}
                                      </text>
                                    )}
                                  />
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="mt-3 flex flex-wrap justify-center gap-3">
                            {[
                              {
                                key: "lt1",
                                label: "< 1 dia",
                                color: "#6366F1",
                              },
                              {
                                key: "d1to3",
                                label: "1–3 dias",
                                color: "#10B981",
                              },
                              {
                                key: "d3to7",
                                label: "3–7 dias",
                                color: "#F59E0B",
                              },
                              {
                                key: "gt7",
                                label: "> 7 dias",
                                color: "#EC4899",
                              },
                            ].map((it) => (
                              <span
                                key={`legend-sector-bucket-${it.key}`}
                                className="inline-flex items-center gap-2 text-xs text-gray-700"
                              >
                                <span
                                  className="w-2.5 h-2.5 rounded"
                                  style={{ backgroundColor: it.color }}
                                ></span>
                                <span>{it.label}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <ChartBarIcon className="h-5 w-5 text-indigo-600" />
                              <h3 className="text-base font-semibold text-gray-800">
                                Tempo médio por setor (dias)
                              </h3>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs">
                                <ClockIcon className="h-4 w-4" /> Média geral:{" "}
                                {mediaGeralDias <= 0
                                  ? "<1d"
                                  : `${mediaGeralDias}d`}
                              </span>
                            </div>
                          </div>
                          <div className="h-[360px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={donutMediaSetorDias}
                                  dataKey="dias"
                                  nameKey="setor"
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={50}
                                  outerRadius={90}
                                  label={({ dias }) =>
                                    Number(dias) < 1
                                      ? "<1"
                                      : String(Math.floor(Number(dias)))
                                  }
                                >
                                  {donutMediaSetorDias.map((entry) => {
                                    const colorMap: Record<string, string> = {
                                      RH: "#60A5FA",
                                      MEDICINA: "#10B981",
                                      TREINAMENTO: "#8B5CF6",
                                      LOGISTICA: "#EC4899",
                                    };
                                    const c =
                                      colorMap[
                                        (entry.setor || "").toUpperCase()
                                      ] || "#9CA3AF";
                                    return (
                                      <Cell
                                        key={`cell-donut-${entry.setor}`}
                                        fill={c}
                                      />
                                    );
                                  })}
                                </Pie>
                                <Tooltip
                                  formatter={(_, name, { payload }) => [
                                    `${Number(payload?.pct || 0).toFixed(1)}%`,
                                    payload?.setor ?? name,
                                  ]}
                                />
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
                              const c =
                                colorMap[(s || "").toUpperCase()] || "#9CA3AF";
                              return (
                                <span
                                  key={`legend-donut-${s}`}
                                  className="inline-flex items-center gap-2 text-xs text-gray-700"
                                >
                                  <span
                                    className="w-2.5 h-2.5 rounded-full"
                                    style={{ backgroundColor: c }}
                                  ></span>
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
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4 flex-1 overflow-hidden order-2">
                  <div className="px-4 py-3 flex items-center justify-between bg-gray-50 rounded-t-2xl">
                    <div className="flex items-center gap-2">
                      <UserGroupIcon className="h-5 w-5 text-indigo-600" />
                      <h3 className="text-sm font-semibold text-gray-800">
                        Período por setor — por remanejamento
                      </h3>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500">
                        {porRemanejamentoFiltrados.length} linha(s)
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
                          {setoresVisiveis.map((s) => {
                            const iconMap: Record<string, any> = {
                              RH: BuildingOfficeIcon,
                              MEDICINA: HeartIcon,
                              TREINAMENTO: AcademicCapIcon,
                              LOGISTICA: TruckIcon,
                            };
                            const Icon = iconMap[s] || ChartBarIcon;
                            return (
                              <th
                                key={`head-det-dias-${s}`}
                                className="text-left px-3 py-2 text-xs font-medium text-gray-600 uppercase tracking-wider whitespace-nowrap"
                              >
                                <span className="inline-flex items-center gap-1">
                                  <Icon className="h-4 w-4 text-gray-600" /> {s}
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
                            key={`det-dias-${r.remanejamentoId}`}
                            className="hover:bg-gray-50"
                          >
                            <td className="px-3 py-2 text-gray-800">
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  {r.funcionario?.nome || ""}
                                </span>
                                <span className="text-xs text-gray-600">
                                  Matrícula: {r.funcionario?.matricula || ""}
                                </span>
                                <span className="text-xs text-gray-600">
                                  Remanejamento: {String(r.remanejamentoId)}
                                </span>
                              </div>
                            </td>
                            {setoresVisiveis.map((s) => {
                              const periodEntry = (
                                r.periodosPorSetor || []
                              ).find(
                                (x) => x.setor.toUpperCase() === s.toUpperCase()
                              );
                              const durEntry = (r.duracaoPorSetorMs || []).find(
                                (x) => x.setor.toUpperCase() === s.toUpperCase()
                              );
                              return (
                                <td
                                  key={`cell-dias-${r.remanejamentoId}-${s}`}
                                  className="px-3 py-2 text-gray-800 whitespace-nowrap"
                                >
                                  {periodEntry ? (
                                    <div className="flex flex-col gap-1">
                                      <span className="inline-flex items-center px-2 py-1 rounded-full bg-indigo-50 text-indigo-700">
                                        Início:{" "}
                                        {new Date(
                                          periodEntry.inicio
                                        ).toLocaleDateString("pt-BR")}
                                      </span>
                                      <span className="inline-flex items-center px-2 py-1 rounded-full bg-purple-50 text-purple-700">
                                        Fim:{" "}
                                        {new Date(
                                          periodEntry.fim
                                        ).toLocaleDateString("pt-BR")}
                                      </span>
                                      <span className="inline-flex items-center px-2 py-1 rounded-full bg-green-50 text-green-700">
                                        Duração:{" "}
                                        {durEntry?.ms
                                          ? fmtDias(durEntry.ms)
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
                                              return ms ? fmtDias(ms) : "—";
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
                                {fmtDias(r.totalDurMs)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "dias_all" && (
              <div className="space-y-4">
                <div className="mb-4 rounded-xl bg-white border border-gray-200 p-4">
                  <div className="flex flex-wrap items-end gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Setor
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {["RH", "MEDICINA", "TREINAMENTO", "LOGISTICA"].map(
                          (s) => {
                            const active = filtroSetores.includes(s);
                            const cls = active
                              ? "bg-blue-600 text-white"
                              : "bg-gray-100 text-gray-700";
                            return (
                              <button
                                key={`fsetor-all-${s}`}
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
                          }
                        )}
                        <button
                          onClick={() => {
                            setPage(1);
                            setFiltroSetores([
                              "RH",
                              "MEDICINA",
                              "TREINAMENTO",
                              "LOGISTICA",
                            ]);
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
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Faixa (dias)
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { key: "lt1", label: "< 1 dia" },
                          { key: "d1to3", label: "1–3 dias" },
                          { key: "d3to7", label: "3–7 dias" },
                          { key: "gt7", label: "> 7 dias" },
                        ].map((b) => {
                          const active = filtroBuckets.includes(b.key);
                          const cls = active
                            ? "bg-indigo-600 text-white"
                            : "bg-gray-100 text-gray-700";
                          return (
                            <button
                              key={`fbucket-all-${b.key}`}
                              onClick={() => {
                                setPage(1);
                                setFiltroBuckets((prev) => {
                                  const has = prev.includes(b.key);
                                  if (has)
                                    return prev.filter((x) => x !== b.key);
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
                    <div className="flex flex-col gap-1">
                      <label className="block text-xs font-medium text-gray-600">
                        Período de Criação
                      </label>
                      <div className="flex gap-2 items-center">
                        <input
                          type="date"
                          max={
                            endDate || new Date().toISOString().split("T")[0]
                          }
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="px-2 py-1 rounded border border-gray-300 text-sm"
                        />
                        <span className="text-gray-500 text-xs">até</span>
                        <input
                          type="date"
                          min={startDate}
                          max={new Date().toISOString().split("T")[0]}
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="px-2 py-1 rounded border border-gray-300 text-sm"
                        />
                      </div>
                    </div>
                    <div className="flex-1 min-w-[180px]">
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Funcionário / Matrícula / Remanejamento
                      </label>
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
                          setFiltroSetores([
                            "RH",
                            "MEDICINA",
                            "TREINAMENTO",
                            "LOGISTICA",
                          ]);
                          setFiltroBuckets(["lt1", "d1to3", "d3to7", "gt7"]);
                          setFiltroFuncionario("");
                          setStartDate("");
                          setEndDate("");
                          setPage(1);
                        }}
                        className="px-3 py-1.5 rounded text-xs bg-gray-100 text-gray-700 border"
                      >
                        Limpar filtros
                      </button>
                    </div>
                  </div>
                </div>
                <ChartsAndKpis />
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4 flex-1 overflow-hidden">
                  <div className="px-4 py-3 flex items-center justify-between bg-gray-50 rounded-t-2xl">
                    <div className="flex items-center gap-2">
                      <UserGroupIcon className="h-5 w-5 text-indigo-600" />
                      <h3 className="text-sm font-semibold text-gray-800">
                        Período por setor — por remanejamento (Todos)
                      </h3>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500">
                        {porRemanejamentoFiltradosAll.length} linha(s)
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
                          Página {page} de {totalPagesAll}
                        </span>
                        <button
                          onClick={() =>
                            setPage((p) => Math.min(totalPagesAll, p + 1))
                          }
                          disabled={page >= totalPagesAll}
                          className={`px-2 py-1 text-xs border rounded ${
                            page >= totalPagesAll
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
                                key={`head-det-all-${s}`}
                                className="text-left px-3 py-2 text-xs font-medium text-gray-600 uppercase tracking-wider whitespace-nowrap"
                              >
                                <span className="inline-flex items-center gap-1">
                                  <Icon className="h-4 w-4 text-gray-600" /> {s}
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
                        {pageDataAll.map((r) => {
                          const isExpanded = expandedRows.has(
                            r.remanejamentoId
                          );
                          return (
                            <Fragment key={`frag-all-${r.remanejamentoId}`}>
                              <tr className="hover:bg-gray-50">
                                <td className="px-3 py-2 text-gray-800 whitespace-nowrap align-top">
                                  <div className="flex items-start gap-2">
                                    <button
                                      onClick={() =>
                                        toggleRow(r.remanejamentoId)
                                      }
                                      className="mt-1 p-1 text-gray-500 hover:text-gray-700 rounded focus:outline-none"
                                    >
                                      {isExpanded ? (
                                        <ChevronDownIcon className="h-4 w-4" />
                                      ) : (
                                        <ChevronRightIcon className="h-4 w-4" />
                                      )}
                                    </button>
                                    <div className="flex flex-col">
                                      <span className="font-medium">
                                        {r.funcionario?.nome || ""}
                                      </span>
                                      <span className="text-xs text-gray-600">
                                        Matrícula:{" "}
                                        {r.funcionario?.matricula || ""}
                                      </span>
                                      <span className="text-xs text-gray-600">
                                        Remanejamento:{" "}
                                        {String(r.remanejamentoId)}
                                      </span>
                                    </div>
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

                                  let durationText = "—";
                                  if (durEntry?.ms) {
                                    durationText = fmtDias(durEntry.ms);
                                  } else if (periodEntry) {
                                    const ms = Math.max(
                                      0,
                                      new Date(periodEntry.fim).getTime() -
                                        new Date(periodEntry.inicio).getTime()
                                    );
                                    if (ms > 0) durationText = fmtDias(ms);
                                  }

                                  return (
                                    <td
                                      key={`cell-all-${r.remanejamentoId}-${s}`}
                                      className="px-3 py-2 text-gray-800 whitespace-nowrap align-top"
                                    >
                                      {durEntry || periodEntry ? (
                                        <span className="inline-flex items-center px-2 py-1 rounded-full bg-green-50 text-green-700">
                                          {durationText}
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center px-2 py-1 rounded-full bg-gray-100 text-gray-500">
                                          —
                                        </span>
                                      )}
                                    </td>
                                  );
                                })}
                                <td className="px-3 py-2 text-gray-800 whitespace-nowrap align-top">
                                  <span className="inline-flex items-center px-2 py-1 rounded-full bg-blue-50 text-blue-700">
                                    {fmtDias(totalMsNow(r))}
                                  </span>
                                </td>
                              </tr>
                              {isExpanded && (
                                <tr className="bg-gray-50">
                                  <td
                                    colSpan={setoresDisponiveis.length + 2}
                                    className="px-4 py-3"
                                  >
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                      {setoresDisponiveis.map((s) => {
                                        const segs =
                                          r.segmentosPorSetor?.[s] || [];
                                        if (segs.length === 0) return null;
                                        return (
                                          <div
                                            key={`det-seg-${r.remanejamentoId}-${s}`}
                                            className="border rounded bg-white p-2 text-xs shadow-sm"
                                          >
                                            <strong className="block mb-1 text-gray-700 border-b pb-1">
                                              {s}
                                            </strong>
                                            <ul className="space-y-2 mt-1">
                                              {segs.map((seg, idx) => (
                                                <li
                                                  key={idx}
                                                  className="flex flex-col text-gray-600 border-b border-dashed last:border-0 pb-1 last:pb-0"
                                                >
                                                  <span className="font-semibold text-indigo-600">
                                                    Ciclo {seg.ciclo || idx + 1}
                                                  </span>
                                                  <div className="flex gap-2">
                                                    <span>
                                                      Início:{" "}
                                                      {new Date(
                                                        seg.inicio
                                                      ).toLocaleDateString(
                                                        "pt-BR"
                                                      )}
                                                    </span>
                                                    <span>
                                                      Fim:{" "}
                                                      {new Date(
                                                        seg.fim
                                                      ).toLocaleDateString(
                                                        "pt-BR"
                                                      )}
                                                    </span>
                                                  </div>
                                                  <span className="text-gray-500">
                                                    Duração: {fmtDias(seg.ms)}
                                                  </span>
                                                </li>
                                              ))}
                                            </ul>
                                          </div>
                                        );
                                      })}
                                      {(!r.segmentosPorSetor ||
                                        Object.values(
                                          r.segmentosPorSetor
                                        ).every((v) => v.length === 0)) && (
                                        <div className="text-gray-500 italic col-span-full text-center py-2">
                                          Sem detalhes de ciclos disponíveis
                                          para exibição.
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "simples" && null}

            {activeTab === "simples" && null}

            {activeTab === "detalhado" && null}
          </div>
        )}
      </div>
    </div>
  );
}
