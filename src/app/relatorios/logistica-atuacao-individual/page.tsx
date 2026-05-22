"use client";

import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar, Line } from "react-chartjs-2";
import ProtectedRoute from "@/components/ProtectedRoute";
import { ROUTE_PROTECTION } from "@/lib/permissions";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
);
const barValueLabelsPlugin = {
  id: "barValueLabelsPlugin",
  afterDatasetsDraw: (chart: any) => {
    if (chart.config.type !== "bar") return;
    const { ctx } = chart;
    const dataset = chart.data.datasets?.[0];
    if (!dataset) return;
    const meta = chart.getDatasetMeta(0);
    ctx.save();
    ctx.fillStyle = "#334155";
    ctx.font = "600 11px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    meta.data.forEach((bar: any, i: number) => {
      const raw = dataset.data[i];
      const value = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(value)) return;
      const label = value.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
      ctx.fillText(label, bar.x, bar.y - 4);
    });
    ctx.restore();
  },
};
ChartJS.register(barValueLabelsPlugin);

type ApiData = {
  resumo: {
    totalColaboradores: number;
    throughputTime: number;
    throughputMedio: number;
  };
  serieDiaria?: { data: string; total: number }[];
  colaboradores: {
    usuarioId: number;
    usuario: string;
    matricula: string;
    throughputPeriodo: number;
    cadenciaMediaMin: number;
    produtividadeHoraAtiva: number;
    mixTrabalho: Record<string, number>;
    taxaConclusaoLogisticaPct: number;
    backlogPessoal: number;
    agingBacklogMedioHoras: number;
    agingBacklogP95Horas: number;
    regularidadePct: number;
    eficienciaRelativaPct: number;
    toquesPorItem: number;
    itensDistintosAtuados: number;
  }[];
};
type ColaboradorRow = ApiData["colaboradores"][number];

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function endOfMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0);
}

function formatNumberBr(value: number) {
  return value.toLocaleString("pt-BR");
}
function shortUserLabel(name: string) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return name;
  const first = parts[0];
  const second = parts[1];
  return `${first} ${second[0]}.`;
}
function formatDateBr(date: Date) {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}
function parseYmdUtc(ymd: string) {
  return new Date(`${ymd}T00:00:00.000Z`);
}
function formatYmdUtc(date: Date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function addDaysUtc(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}
function daysDiffInclusive(startYmd: string, endYmd: string) {
  const start = parseYmdUtc(startYmd).getTime();
  const end = parseYmdUtc(endYmd).getTime();
  return Math.max(1, Math.floor((end - start) / 86400000) + 1);
}
function DeltaTag({
  value,
  invert = false,
  suffix = "",
  minAbs = 0,
}: {
  value: number | null;
  invert?: boolean;
  suffix?: string;
  minAbs?: number;
}) {
  if (value === null || Number.isNaN(value)) return <span className="text-[10px] text-slate-400">-</span>;
  if (Math.abs(value) < minAbs) {
    return (
      <span className="relative inline-flex group">
        <span className="text-[10px] font-medium text-slate-500 cursor-help">→ 0{suffix}</span>
        <span className="pointer-events-none absolute right-0 top-5 z-20 hidden group-hover:block w-52 rounded-md border border-slate-200 bg-white text-slate-700 text-[11px] leading-4 p-2 shadow-md">
          Estável vs período anterior equivalente.
        </span>
      </span>
    );
  }
  const isUp = value > 0;
  const isDown = value < 0;
  const good = invert ? isDown : isUp;
  const cls = !isUp && !isDown ? "text-slate-500" : good ? "text-emerald-700" : "text-rose-700";
  const arrow = isUp ? "↑" : isDown ? "↓" : "→";
  const hint = good
    ? `Melhora vs período anterior equivalente (${invert ? "menor é melhor" : "maior é melhor"}).`
    : `Piora vs período anterior equivalente (${invert ? "menor é melhor" : "maior é melhor"}).`;
  return (
    <span className="relative inline-flex group">
      <span className={`text-[10px] font-medium ${cls} cursor-help`}>
        {arrow} {Math.abs(value).toFixed(1)}
        {suffix}
      </span>
      <span className="pointer-events-none absolute right-0 top-5 z-20 hidden group-hover:block w-56 rounded-md border border-slate-200 bg-white text-slate-700 text-[11px] leading-4 p-2 shadow-md">
        {hint}
      </span>
    </span>
  );
}

function KpiCard({
  title,
  value,
  delta,
}: {
  title: string;
  value: string | number;
  delta?: ReactNode;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
      <p className="text-xs text-slate-500">{title}</p>
      <div className="mt-1 flex items-end justify-between gap-2">
        <p className="text-2xl font-semibold text-slate-900">{value}</p>
        {delta ? <div className="shrink-0 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5">{delta}</div> : null}
      </div>
    </div>
  );
}

const MONTH_LABELS_PT_BR = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

function InfoTip({ text }: { text: string }) {
  return (
    <span className="relative inline-flex group ml-1">
      <span className="w-4 h-4 rounded-full border border-slate-300 text-slate-500 text-[10px] leading-4 text-center cursor-help bg-white">
        i
      </span>
      <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-5 z-20 hidden group-hover:block w-64 rounded-md border border-slate-200 bg-white text-slate-700 text-[11px] leading-4 p-2 shadow-md">
        {text}
      </span>
    </span>
  );
}

function SkeletonBox({ className }: { className: string }) {
  return <div className={`animate-pulse bg-slate-200 rounded ${className}`} />;
}

export default function RelatorioLogisticaAtuacaoIndividualPage() {
  return (
    <ProtectedRoute
      requiredPermissions={ROUTE_PROTECTION.LOGISTICA.requiredPermissions}
      requiredEquipe={ROUTE_PROTECTION.LOGISTICA.requiredEquipe}
    >
      <Content />
    </ProtectedRoute>
  );
}

function Content() {
  const today = useMemo(() => new Date(), []);
  const inicioPadrao = useMemo(
    () => formatDateInput(new Date(today.getFullYear(), today.getMonth(), 1)),
    [today],
  );
  const fimPadrao = useMemo(() => formatDateInput(today), [today]);
  const [inicio, setInicio] = useState(inicioPadrao);
  const [fim, setFim] = useState(fimPadrao);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [dados, setDados] = useState<ApiData | null>(null);
  const [modoVisao, setModoVisao] = useState<"operacional" | "executivo">("operacional");
  const [mesExecutivo, setMesExecutivo] = useState<number>(today.getMonth() + 1);
  const [anoExecutivo, setAnoExecutivo] = useState<number>(today.getFullYear());
  const [comparativos, setComparativos] = useState<{
    mensalAtual: number;
    mensalAnterior: number;
    mensalPct: number;
    triAtual: number;
    triAnterior: number;
    triPct: number;
    semAtual: number;
    semAnterior: number;
    semPct: number;
    anualAtual: number;
    anualAnterior: number;
    anualPct: number;
  }>({
    mensalAtual: 0,
    mensalAnterior: 0,
    mensalPct: 0,
    triAtual: 0,
    triAnterior: 0,
    triPct: 0,
    semAtual: 0,
    semAnterior: 0,
    semPct: 0,
    anualAtual: 0,
    anualAnterior: 0,
    anualPct: 0,
  });
  const [serieMesComparativa, setSerieMesComparativa] = useState<{
    labels: string[];
    atual: number[];
    anterior: number[];
  }>({ labels: [], atual: [], anterior: [] });
  const [comparativoOperacional, setComparativoOperacional] = useState<{
    prevByUser: Record<number, ColaboradorRow>;
    prevRankByUser: Record<number, number>;
    intervaloLabel: string;
  }>({
    prevByUser: {},
    prevRankByUser: {},
    intervaloLabel: "",
  });
  const [filtroAplicado, setFiltroAplicado] = useState<{
    modo: "operacional" | "executivo";
    inicio: string;
    fim: string;
    mes: number;
    ano: number;
  }>({
    modo: "operacional",
    inicio: inicioPadrao,
    fim: fimPadrao,
    mes: today.getMonth() + 1,
    ano: today.getFullYear(),
  });

  const chartOptionsCompact = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        x: {
          ticks: {
            color: "#475569",
            maxRotation: 15,
            minRotation: 15,
            autoSkip: true,
            font: { size: 11 },
          },
          grid: { display: false },
        },
        y: {
          ticks: {
            color: "#475569",
            font: { size: 11 },
            callback: (value: number | string) => Number(value).toLocaleString("pt-BR"),
          },
          grid: { color: "#e2e8f0" },
        },
      },
    }),
    [],
  );
  const chartOptionsBarCompact = useMemo(
    () => ({
      ...chartOptionsCompact,
      layout: { padding: { top: 20 } },
    }),
    [chartOptionsCompact],
  );

  const topThroughput = useMemo(() => (dados?.colaboradores || []).slice(0, 8), [dados]);
  const chartThroughput = useMemo(
    () => ({
      labels: topThroughput.map((c) => shortUserLabel(c.usuario)),
      datasets: [
        {
          data: topThroughput.map((c) => c.throughputPeriodo),
          backgroundColor: "#334155",
          borderRadius: 6,
        },
      ],
    }),
    [topThroughput],
  );
  const chartCadencia = useMemo(
    () => ({
      labels: topThroughput.map((c) => shortUserLabel(c.usuario)),
      datasets: [
        {
          data: topThroughput.map((c) => c.cadenciaMediaMin),
          backgroundColor: "#64748b",
          borderRadius: 6,
        },
      ],
    }),
    [topThroughput],
  );
  const chartRegularidade = useMemo(
    () => ({
      labels: topThroughput.map((c) => shortUserLabel(c.usuario)),
      datasets: [
        {
          data: topThroughput.map((c) => c.regularidadePct),
          backgroundColor: "#0f172a",
          borderRadius: 6,
        },
      ],
    }),
    [topThroughput],
  );

  const mixResumo = useMemo(() => {
    const mix: Record<string, number> = {};
    for (const c of dados?.colaboradores || []) {
      for (const [k, v] of Object.entries(c.mixTrabalho)) {
        mix[k] = (mix[k] || 0) + v;
      }
    }
    const entries = Object.entries(mix).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const total = entries.reduce((acc, [, v]) => acc + v, 0);
    return entries.map(([tipo, qtd]) => ({
      tipo,
      qtd,
      pct: total > 0 ? Number(((qtd / total) * 100).toFixed(1)) : 0,
    }));
  }, [dados]);

  const chartMesAtualVsAnterior = useMemo(
    () => ({
      labels: serieMesComparativa.labels,
      datasets: [
        {
          label: "Mês atual",
          data: serieMesComparativa.atual,
          borderColor: "#1e293b",
          backgroundColor: "#1e293b",
          pointRadius: 1.5,
          tension: 0.25,
        },
        {
          label: "Mês anterior",
          data: serieMesComparativa.anterior,
          borderColor: "#64748b",
          backgroundColor: "#64748b",
          pointRadius: 1.5,
          tension: 0.25,
        },
      ],
    }),
    [serieMesComparativa],
  );

  const top3Throughput = useMemo(
    () => [...(dados?.colaboradores || [])].sort((a, b) => b.throughputPeriodo - a.throughputPeriodo).slice(0, 3),
    [dados],
  );
  const top3Eficiencia = useMemo(
    () =>
      [...(dados?.colaboradores || [])]
        .sort((a, b) => b.eficienciaRelativaPct - a.eficienciaRelativaPct)
        .slice(0, 3),
    [dados],
  );
  const top3Regularidade = useMemo(
    () => [...(dados?.colaboradores || [])].sort((a, b) => b.regularidadePct - a.regularidadePct).slice(0, 3),
    [dados],
  );
  const resumoOperacionalProd = useMemo(() => {
    const cols = dados?.colaboradores || [];
    const total = cols.length;
    if (!total) {
      return {
        cadenciaMedia: 0,
        prodHoraMedia: 0,
        conclusaoMedia: 0,
        regularidadeMedia: 0,
      };
    }
    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / total;
    return {
      cadenciaMedia: Number(avg(cols.map((c) => c.cadenciaMediaMin)).toFixed(1)),
      prodHoraMedia: Number(avg(cols.map((c) => c.produtividadeHoraAtiva)).toFixed(2)),
      conclusaoMedia: Number(avg(cols.map((c) => c.taxaConclusaoLogisticaPct)).toFixed(1)),
      regularidadeMedia: Number(avg(cols.map((c) => c.regularidadePct)).toFixed(1)),
    };
  }, [dados]);
  const resumoOperacionalAnterior = useMemo(() => {
    const prevCols = Object.values(comparativoOperacional.prevByUser);
    const totalColabs = prevCols.length;
    const throughputTotal = prevCols.reduce((acc, c) => acc + c.throughputPeriodo, 0);
    const throughputMedio = totalColabs > 0 ? throughputTotal / totalColabs : 0;
    const avg = (arr: number[]) => (totalColabs > 0 ? arr.reduce((a, b) => a + b, 0) / totalColabs : 0);
    return {
      totalColabs,
      throughputTotal,
      throughputMedio,
      cadenciaMedia: avg(prevCols.map((c) => c.cadenciaMediaMin)),
      prodHoraMedia: avg(prevCols.map((c) => c.produtividadeHoraAtiva)),
      conclusaoMedia: avg(prevCols.map((c) => c.taxaConclusaoLogisticaPct)),
      regularidadeMedia: avg(prevCols.map((c) => c.regularidadePct)),
    };
  }, [comparativoOperacional.prevByUser]);
  const periodoExecutivoLabel = useMemo(() => {
    const refIni = new Date(anoExecutivo, mesExecutivo - 1, 1);
    const refFim = endOfMonth(anoExecutivo, mesExecutivo - 1);
    const antIni = new Date(anoExecutivo, mesExecutivo - 2, 1);
    const antFim = endOfMonth(anoExecutivo, mesExecutivo - 2);
    return `Variação comparada ao período anterior equivalente (${formatDateBr(
      antIni,
    )} a ${formatDateBr(antFim)}). Referência atual: ${formatDateBr(refIni)} a ${formatDateBr(
      refFim,
    )}.`;
  }, [anoExecutivo, mesExecutivo]);
  const periodoOperacionalLabel = useMemo(() => {
    const baseInicio = filtroAplicado.inicio || inicio;
    const baseFim = filtroAplicado.fim || fim;
    if (!baseInicio || !baseFim) return "";
    const diasPeriodo = daysDiffInclusive(baseInicio, baseFim);
    const inicioAtual = parseYmdUtc(baseInicio);
    const fimAtual = parseYmdUtc(baseFim);
    const fimAnterior = addDaysUtc(inicioAtual, -1);
    const inicioAnterior = addDaysUtc(fimAnterior, -(diasPeriodo - 1));
    return `Variação comparada ao período anterior equivalente (${formatDateBr(
      inicioAnterior,
    )} a ${formatDateBr(fimAnterior)}). Referência atual: ${formatDateBr(
      inicioAtual,
    )} a ${formatDateBr(fimAtual)}.`;
  }, [filtroAplicado.inicio, filtroAplicado.fim, inicio, fim]);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      let dataInicioQuery = filtroAplicado.inicio;
      let dataFimQuery = filtroAplicado.fim;
      if (filtroAplicado.modo === "executivo") {
        const ini = new Date(filtroAplicado.ano, filtroAplicado.mes - 1, 1);
        const fimMes = endOfMonth(filtroAplicado.ano, filtroAplicado.mes - 1);
        dataInicioQuery = formatDateInput(ini);
        dataFimQuery = formatDateInput(fimMes);
      }
      const params = new URLSearchParams();
      if (dataInicioQuery) params.set("startDate", dataInicioQuery);
      if (dataFimQuery) params.set("endDate", dataFimQuery);
      const resp = await fetch(`/api/logistica/atuacao-individual?${params.toString()}`);
      if (!resp.ok) throw new Error("Não foi possível carregar os indicadores.");
      const dadosAtuais = (await resp.json()) as ApiData;
      setDados(dadosAtuais);

      if (filtroAplicado.modo === "operacional" && filtroAplicado.inicio && filtroAplicado.fim) {
        const diasPeriodo = daysDiffInclusive(filtroAplicado.inicio, filtroAplicado.fim);
        const inicioAtual = parseYmdUtc(filtroAplicado.inicio);
        const fimAnterior = addDaysUtc(inicioAtual, -1);
        const inicioAnterior = addDaysUtc(fimAnterior, -(diasPeriodo - 1));
        const prevParams = new URLSearchParams({
          startDate: formatYmdUtc(inicioAnterior),
          endDate: formatYmdUtc(fimAnterior),
        });
        const prevResp = await fetch(`/api/logistica/atuacao-individual?${prevParams.toString()}`);
        if (prevResp.ok) {
          const prevDados = (await prevResp.json()) as ApiData;
          const prevByUser: Record<number, ColaboradorRow> = {};
          const prevRankByUser: Record<number, number> = {};
          prevDados.colaboradores.forEach((c, idx) => {
            prevByUser[c.usuarioId] = c;
            prevRankByUser[c.usuarioId] = idx + 1;
          });
          setComparativoOperacional({
            prevByUser,
            prevRankByUser,
            intervaloLabel: `${formatYmdUtc(inicioAnterior)} a ${formatYmdUtc(fimAnterior)}`,
          });
        } else {
          setComparativoOperacional({ prevByUser: {}, prevRankByUser: {}, intervaloLabel: "" });
        }
      } else {
        setComparativoOperacional({ prevByUser: {}, prevRankByUser: {}, intervaloLabel: "" });
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }, [filtroAplicado]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    async function carregarComparativos() {
      try {
        const refDate = new Date(anoExecutivo, mesExecutivo - 1, 1);
        const y = refDate.getFullYear();
        const m = refDate.getMonth();
        const mkUrl = (ini: Date, fim: Date) =>
          `/api/logistica/atuacao-individual?startDate=${formatDateInput(ini)}&endDate=${formatDateInput(fim)}`;

        const mensalAtualIni = new Date(y, m, 1);
        const mensalAtualFim = new Date(y, m + 1, 0);
        const mensalAntIni = new Date(y, m - 1, 1);
        const mensalAntFim = new Date(y, m, 0);

        const semAtualIni = new Date(y, m - 5, 1);
        const semAtualFim = new Date(y, m + 1, 0);
        const semAntIni = new Date(y, m - 11, 1);
        const semAntFim = new Date(y, m - 6, 0);

        const triAtualIni = new Date(y, m - 2, 1);
        const triAtualFim = new Date(y, m + 1, 0);
        const triAntIni = new Date(y, m - 5, 1);
        const triAntFim = new Date(y, m - 3, 0);

        const anualAtualIni = new Date(y, 0, 1);
        const anualAtualFim = new Date(y, 11, 31);
        const anualAntIni = new Date(y - 1, 0, 1);
        const anualAntFim = new Date(y - 1, 11, 31);

        const responses = await Promise.allSettled([
          fetch(mkUrl(mensalAtualIni, mensalAtualFim)),
          fetch(mkUrl(mensalAntIni, mensalAntFim)),
          fetch(mkUrl(triAtualIni, triAtualFim)),
          fetch(mkUrl(triAntIni, triAntFim)),
          fetch(mkUrl(semAtualIni, semAtualFim)),
          fetch(mkUrl(semAntIni, semAntFim)),
          fetch(mkUrl(anualAtualIni, anualAtualFim)),
          fetch(mkUrl(anualAntIni, anualAntFim)),
        ]);
        const jsonFromSettled = async (idx: number): Promise<ApiData | null> => {
          const item = responses[idx];
          if (item.status !== "fulfilled") return null;
          if (!item.value.ok) return null;
          try {
            return (await item.value.json()) as ApiData;
          } catch {
            return null;
          }
        };
        const mensalAtual = await jsonFromSettled(0);
        const mensalAnterior = await jsonFromSettled(1);
        const triAtual = await jsonFromSettled(2);
        const triAnterior = await jsonFromSettled(3);
        const semAtual = await jsonFromSettled(4);
        const semAnterior = await jsonFromSettled(5);
        const anualAtual = await jsonFromSettled(6);
        const anualAnterior = await jsonFromSettled(7);

        const mAtual = mensalAtual?.resumo?.throughputTime || 0;
        const mAnt = mensalAnterior?.resumo?.throughputTime || 0;
        const tAtual = triAtual?.resumo?.throughputTime || 0;
        const tAnt = triAnterior?.resumo?.throughputTime || 0;
        const sAtual = semAtual?.resumo?.throughputTime || 0;
        const sAnt = semAnterior?.resumo?.throughputTime || 0;
        const aAtual = anualAtual?.resumo?.throughputTime || 0;
        const aAnt = anualAnterior?.resumo?.throughputTime || 0;
        const pct = (cur: number, prev: number) => (prev > 0 ? ((cur - prev) / prev) * 100 : 0);

        setComparativos({
          mensalAtual: mAtual,
          mensalAnterior: mAnt,
          mensalPct: Number(pct(mAtual, mAnt).toFixed(1)),
          triAtual: tAtual,
          triAnterior: tAnt,
          triPct: Number(pct(tAtual, tAnt).toFixed(1)),
          semAtual: sAtual,
          semAnterior: sAnt,
          semPct: Number(pct(sAtual, sAnt).toFixed(1)),
          anualAtual: aAtual,
          anualAnterior: aAnt,
          anualPct: Number(pct(aAtual, aAnt).toFixed(1)),
        });

        const atualMap = new Map(
          (mensalAtual?.serieDiaria || []).map((d) => [d.data.slice(8, 10), d.total]),
        );
        const anteriorMap = new Map(
          (mensalAnterior?.serieDiaria || []).map((d) => [d.data.slice(8, 10), d.total]),
        );
        const dias = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0"));
        setSerieMesComparativa({
          labels: dias,
          atual: dias.map((d) => atualMap.get(d) || 0),
          anterior: dias.map((d) => anteriorMap.get(d) || 0),
        });
      } catch {
        setComparativos({
          mensalAtual: 0,
          mensalAnterior: 0,
          mensalPct: 0,
          triAtual: 0,
          triAnterior: 0,
          triPct: 0,
          semAtual: 0,
          semAnterior: 0,
          semPct: 0,
          anualAtual: 0,
          anualAnterior: 0,
          anualPct: 0,
        });
        setSerieMesComparativa({
          labels: Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0")),
          atual: Array.from({ length: 31 }, () => 0),
          anterior: Array.from({ length: 31 }, () => 0),
        });
      }
    }
    if (modoVisao === "executivo") carregarComparativos();
  }, [modoVisao, mesExecutivo, anoExecutivo]);

  return (
    <div className="p-3 md:p-4 space-y-4 bg-slate-50 min-h-screen">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
          Atuação Individual da Logística
        </h1>
        <p className="text-sm text-slate-600">
          Indicadores operacionais por pessoa com foco em throughput e eficiência.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-3 grid grid-cols-1 md:grid-cols-3 gap-3 shadow-sm">
        {modoVisao === "operacional" ? (
          <>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Data inicial</label>
              <input
                type="date"
                className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
                value={inicio}
                onChange={(e) => setInicio(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Data final</label>
              <input
                type="date"
                className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
                value={fim}
                onChange={(e) => setFim(e.target.value)}
              />
            </div>
          </>
        ) : (
          <>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Mês de referência</label>
              <div className="grid grid-cols-6 gap-1.5">
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMesExecutivo(m)}
                    className={`rounded-md border px-2 py-1 text-xs ${
                      mesExecutivo === m
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {MONTH_LABELS_PT_BR[m - 1]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Ano de referência</label>
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: 6 }, (_, i) => today.getFullYear() - i).map((ano) => (
                  <button
                    key={ano}
                    type="button"
                    onClick={() => setAnoExecutivo(ano)}
                    className={`rounded-md border px-2.5 py-1 text-xs ${
                      anoExecutivo === ano
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {ano}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
        <div className="flex items-end">
          <button
            type="button"
            onClick={() =>
              setFiltroAplicado({
                modo: modoVisao,
                inicio,
                fim,
                mes: mesExecutivo,
                ano: anoExecutivo,
              })
            }
            disabled={loading}
            className="w-full rounded-md bg-slate-900 text-white px-3 py-1.5 text-sm font-medium hover:bg-slate-800"
          >
            {loading ? "Atualizando..." : "Atualizar"}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-2 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => setModoVisao("operacional")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md ${
                modoVisao === "operacional" ? "bg-slate-900 text-white" : "text-slate-700"
              }`}
            >
              Operacional
            </button>
            <button
              type="button"
              onClick={() => setModoVisao("executivo")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md ${
                modoVisao === "executivo" ? "bg-slate-900 text-white" : "text-slate-700"
              }`}
            >
              Executivo
            </button>
          </div>
          <p className="text-xs text-slate-500 text-right">
            {modoVisao === "executivo" ? periodoExecutivoLabel : periodoOperacionalLabel}
          </p>
        </div>
      </div>

      {loading && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
              <SkeletonBox className="h-3 w-28 mb-2" />
              <SkeletonBox className="h-7 w-20" />
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
              <SkeletonBox className="h-3 w-36 mb-2" />
              <SkeletonBox className="h-7 w-24" />
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
              <SkeletonBox className="h-3 w-40 mb-2" />
              <SkeletonBox className="h-7 w-16" />
            </div>
          </div>
          {modoVisao === "executivo" && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={`cmp-sk-${i}`} className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
                  <SkeletonBox className="h-3 w-20 mb-2" />
                  <SkeletonBox className="h-3 w-28 mb-1.5" />
                  <SkeletonBox className="h-3 w-24 mb-1.5" />
                  <SkeletonBox className="h-3 w-12" />
                </div>
              ))}
            </div>
          )}
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
            <SkeletonBox className="h-4 w-44 mb-3" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={`rank-sk-${i}`} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <SkeletonBox className="h-3 w-28 mb-2" />
                  <SkeletonBox className="h-16 w-full" />
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-3">
            <div className="bg-white border border-slate-200 rounded-xl p-2.5 shadow-sm">
              <SkeletonBox className="h-3 w-32 mb-2" />
              <SkeletonBox className="h-32 w-full" />
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-2.5 shadow-sm">
              <SkeletonBox className="h-3 w-28 mb-2" />
              <SkeletonBox className="h-32 w-full" />
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-2.5 shadow-sm">
              <SkeletonBox className="h-3 w-24 mb-2" />
              <SkeletonBox className="h-32 w-full" />
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-2.5 shadow-sm">
              <SkeletonBox className="h-3 w-24 mb-2" />
              <SkeletonBox className="h-32 w-full" />
            </div>
          </div>
          {modoVisao === "executivo" && (
            <div className="bg-white border border-slate-200 rounded-xl p-2.5 shadow-sm">
              <SkeletonBox className="h-3 w-36 mb-2" />
              <SkeletonBox className="h-36 w-full" />
            </div>
          )}
          {modoVisao === "operacional" && (
            <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
              <SkeletonBox className="h-4 w-52 mb-3" />
              <SkeletonBox className="h-44 w-full" />
            </div>
          )}
        </div>
      )}
      {erro && <p className="text-sm text-rose-700">{erro}</p>}

      {!loading && !erro && dados && (
        <>
          {modoVisao === "executivo" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              <KpiCard
                title="Atendimentos totais do time"
                value={dados.resumo.throughputTime}
                delta={<DeltaTag value={dados.resumo.throughputTime - resumoOperacionalAnterior.throughputTotal} minAbs={1} />}
              />
              <KpiCard
                title="Produtividade média por pessoa"
                value={dados.resumo.throughputMedio}
                delta={<DeltaTag value={dados.resumo.throughputMedio - resumoOperacionalAnterior.throughputMedio} minAbs={0.1} />}
              />
              <KpiCard
                title="Cadência média (min)"
                value={resumoOperacionalProd.cadenciaMedia}
                delta={<DeltaTag value={resumoOperacionalProd.cadenciaMedia - resumoOperacionalAnterior.cadenciaMedia} invert minAbs={5} />}
              />
              <KpiCard
                title="Regularidade média (%)"
                value={`${resumoOperacionalProd.regularidadeMedia}%`}
                delta={<DeltaTag value={resumoOperacionalProd.regularidadeMedia - resumoOperacionalAnterior.regularidadeMedia} suffix="%" minAbs={1} />}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7 gap-3">
              <div>
                <KpiCard
                  title="Atendimentos totais do time"
                  value={dados.resumo.throughputTime}
                  delta={<DeltaTag value={dados.resumo.throughputTime - resumoOperacionalAnterior.throughputTotal} minAbs={1} />}
                />
              </div>
              <div>
                <KpiCard
                  title="Produtividade média por pessoa"
                  value={dados.resumo.throughputMedio}
                  delta={<DeltaTag value={dados.resumo.throughputMedio - resumoOperacionalAnterior.throughputMedio} minAbs={0.1} />}
                />
              </div>
              <div>
                <KpiCard
                  title="Cadência média (min)"
                  value={resumoOperacionalProd.cadenciaMedia}
                  delta={<DeltaTag value={resumoOperacionalProd.cadenciaMedia - resumoOperacionalAnterior.cadenciaMedia} invert minAbs={5} />}
                />
              </div>
              <div>
                <KpiCard
                  title="Produtividade/hora média"
                  value={resumoOperacionalProd.prodHoraMedia}
                  delta={<DeltaTag value={resumoOperacionalProd.prodHoraMedia - resumoOperacionalAnterior.prodHoraMedia} minAbs={0.1} />}
                />
              </div>
              <div>
                <KpiCard
                  title="Colaboradores no período"
                  value={dados.resumo.totalColaboradores}
                  delta={<DeltaTag value={dados.resumo.totalColaboradores - resumoOperacionalAnterior.totalColabs} minAbs={1} />}
                />
              </div>
              <div>
                <KpiCard
                  title="Conclusão média (%)"
                  value={`${resumoOperacionalProd.conclusaoMedia}%`}
                  delta={<DeltaTag value={resumoOperacionalProd.conclusaoMedia - resumoOperacionalAnterior.conclusaoMedia} suffix="%" minAbs={1} />}
                />
              </div>
              <div>
                <KpiCard
                  title="Regularidade média (%)"
                  value={`${resumoOperacionalProd.regularidadeMedia}%`}
                  delta={<DeltaTag value={resumoOperacionalProd.regularidadeMedia - resumoOperacionalAnterior.regularidadeMedia} suffix="%" minAbs={1} />}
                />
              </div>
            </div>
          )}

          {modoVisao === "executivo" && (
            <div className="space-y-2">
              <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-slate-700">Comparativos Executivos</p>
                  <span className="text-[11px] text-slate-500">Atual vs anterior equivalente</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[
                    { titulo: "Mensal", atual: comparativos.mensalAtual, delta: comparativos.mensalPct },
                    { titulo: "Trimestral", atual: comparativos.triAtual, delta: comparativos.triPct },
                    { titulo: "Semestral", atual: comparativos.semAtual, delta: comparativos.semPct },
                    { titulo: "Anual", atual: comparativos.anualAtual, delta: comparativos.anualPct },
                  ].map((item) => (
                    <div key={item.titulo} className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                      <p className="text-[11px] text-slate-500">{item.titulo}</p>
                      <p className="text-lg font-semibold text-slate-900 leading-6">{formatNumberBr(item.atual)}</p>
                      <DeltaTag value={item.delta} suffix="%" minAbs={0.1} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-800">Rankings por Indicador</h2>
              <span className="text-xs text-slate-500">Top 3 por métrica</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {[
                {
                  titulo: "Produtividade (Atendimentos)",
                  info: "Quantidade de atuações registradas no período filtrado.",
                  itens: top3Throughput,
                  valor: (c: ApiData["colaboradores"][number]) => `${c.throughputPeriodo}`,
                },
                {
                  titulo: "Eficiência Relativa",
                  info: "Compara a produtividade da pessoa com a média do time. 100% = na média, acima de 100% = acima da média.",
                  itens: top3Eficiencia,
                  valor: (c: ApiData["colaboradores"][number]) => `${c.eficienciaRelativaPct}%`,
                },
                {
                  titulo: "Regularidade",
                  info: "Regularidade diária: dias úteis com atuação dividido pelos dias úteis do período.",
                  itens: top3Regularidade,
                  valor: (c: ApiData["colaboradores"][number]) => `${c.regularidadePct}%`,
                },
              ].map((bloco) => (
                <div key={bloco.titulo} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <p className="text-xs font-semibold text-slate-700 mb-2 inline-flex items-center">
                    {bloco.titulo}
                    <InfoTip text={bloco.info} />
                  </p>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr className="text-left text-slate-500 border-b border-slate-200">
                          <th className="py-1 pr-2">Pos.</th>
                          <th className="py-1 pr-2">Nome</th>
                          <th className="py-1 text-right">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bloco.itens.map((c, idx) => (
                          <tr key={`${bloco.titulo}-${c.usuarioId}`} className="border-b border-slate-100 last:border-b-0">
                            <td className="py-1 pr-2 text-slate-700">
                              {idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉"}
                            </td>
                            <td className="py-1 pr-2 text-slate-800 truncate max-w-[140px]" title={c.usuario}>
                              {c.usuario}
                            </td>
                            <td className="py-1 text-right text-slate-900 font-medium">{bloco.valor(c)}</td>
                          </tr>
                        ))}
                        {bloco.itens.length === 0 && (
                          <tr>
                            <td colSpan={3} className="py-2 text-slate-500">
                              Sem dados no período.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {modoVisao === "executivo" && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
                <div className="bg-white border border-slate-200 rounded-xl p-2.5 shadow-sm">
                  <p className="text-xs text-slate-500 mb-2 inline-flex items-center">
                    Produtividade (Top 8)
                    <InfoTip text="Ranking dos 8 colaboradores com maior volume de atuações no período." />
                  </p>
                  <div className="h-32">
                    <Bar data={chartThroughput} options={chartOptionsBarCompact} />
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-2.5 shadow-sm">
                  <p className="text-xs text-slate-500 mb-2 inline-flex items-center">
                    Cadência média (Top 8)
                    <InfoTip text="Tempo médio entre atuações por colaborador (minutos)." />
                  </p>
                  <div className="h-32">
                    <Bar data={chartCadencia} options={chartOptionsBarCompact} />
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-2.5 shadow-sm">
                  <p className="text-xs text-slate-500 mb-2 inline-flex items-center">
                    Regularidade (Top 8)
                    <InfoTip text="Percentual de dias úteis com atuação por colaborador." />
                  </p>
                  <div className="h-32">
                    <Bar data={chartRegularidade} options={chartOptionsBarCompact} />
                  </div>
                </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                <div className="bg-white border border-slate-200 rounded-xl p-2.5 shadow-sm">
                  <p className="text-xs text-slate-500 mb-2 inline-flex items-center">
                    Distribuição por tipo de trabalho
                    <InfoTip text="Participação de cada tipo no volume do período." />
                  </p>
                  <div className="space-y-2">
                    {mixResumo.map((item) => (
                      <div key={item.tipo}>
                        <div className="flex items-center justify-between text-[11px] text-slate-600">
                          <span className="truncate mr-2">{item.tipo}</span>
                          <span className="font-medium text-slate-800">
                            {item.qtd} ({item.pct}%)
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 w-full rounded-full bg-slate-200">
                          <div className="h-1.5 rounded-full bg-slate-700" style={{ width: `${Math.min(100, Math.max(4, item.pct))}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-2.5 shadow-sm">
                  <p className="text-xs text-slate-500 mb-2 inline-flex items-center">
                    Mês atual x mês anterior
                    <InfoTip text="Comparativo diário de volume entre o mês de referência e o mês anterior." />
                  </p>
                  <div className="h-36">
                    <Line data={chartMesAtualVsAnterior} options={{ ...chartOptionsCompact, plugins: { legend: { display: true } } }} />
                  </div>
                </div>
                </div>
              </div>
            )}

          {modoVisao === "operacional" && (
          <div className="bg-white border border-slate-200 rounded-xl p-3 overflow-x-auto shadow-sm">
            <h2 className="text-sm font-semibold text-slate-800 mb-3">
              Indicadores Individuais (10 métricas)
            </h2>
            {comparativoOperacional.intervaloLabel && (
              <p className="text-xs text-slate-500 mb-2">
                Variação comparada ao período anterior equivalente ({comparativoOperacional.intervaloLabel})
              </p>
            )}
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b border-slate-200 text-slate-600">
                  <th className="px-2 py-2">
                    <span className="inline-flex items-center">Colaborador<InfoTip text="Nome e matrícula do analista da logística." /></span>
                  </th>
                  <th className="px-2 py-2">
                    <span className="inline-flex items-center">Produtividade<InfoTip text="Total de atuações registradas no período." /></span>
                  </th>
                  <th className="px-2 py-2">
                    <span className="inline-flex items-center">Cadência (min)<InfoTip text="Tempo médio entre uma atuação e a próxima, em minutos." /></span>
                  </th>
                  <th className="px-2 py-2">
                    <span className="inline-flex items-center">Prod./hora<InfoTip text="Atuações por hora ativa no período (total/janela ativa)." /></span>
                  </th>
                  <th className="px-2 py-2">
                    <span className="inline-flex items-center">Conclusão (%)<InfoTip text="Percentual de atuações em status conclusivo (validado/invalidado/reprovado/rejeitado)." /></span>
                  </th>
                  <th className="px-2 py-2">
                    <span className="inline-flex items-center">Regularidade (%)<InfoTip text="Dias úteis com atuação / dias úteis do período * 100." /></span>
                  </th>
                  <th className="px-2 py-2">
                    <span className="inline-flex items-center">Eficiência relativa (%)<InfoTip text="Produtividade da pessoa comparada à média do time (100% = média)." /></span>
                  </th>
                  <th className="px-2 py-2">
                    <span className="inline-flex items-center">Δ Ranking<InfoTip text="Diferença da posição no ranking de produtividade versus período anterior equivalente." /></span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {dados.colaboradores.map((c) => (
                  <tr key={c.usuarioId} className="border-b border-slate-100 odd:bg-slate-50/40">
                    <td className="px-2 py-2">
                      <div className="font-medium text-slate-900 flex items-center gap-2">
                        <span className="text-xs inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-2 py-0.5">
                          #{dados.colaboradores.findIndex((it) => it.usuarioId === c.usuarioId) + 1}
                        </span>
                        <span>{c.usuario}</span>
                      </div>
                      <div className="text-xs text-slate-500">{c.matricula}</div>
                    </td>
                    <td className="px-2 py-2 text-slate-700">
                      <div>{c.throughputPeriodo}</div>
                      <DeltaTag
                        value={
                          comparativoOperacional.prevByUser[c.usuarioId]
                            ? c.throughputPeriodo - comparativoOperacional.prevByUser[c.usuarioId].throughputPeriodo
                            : null
                        }
                        minAbs={1}
                      />
                    </td>
                    <td className="px-2 py-2 text-slate-700">
                      <div>{c.cadenciaMediaMin}</div>
                      <DeltaTag
                        value={
                          comparativoOperacional.prevByUser[c.usuarioId]
                            ? c.cadenciaMediaMin - comparativoOperacional.prevByUser[c.usuarioId].cadenciaMediaMin
                            : null
                        }
                        invert
                        minAbs={5}
                      />
                    </td>
                    <td className="px-2 py-2 text-slate-700">
                      <div>{c.produtividadeHoraAtiva}</div>
                      <DeltaTag
                        value={
                          comparativoOperacional.prevByUser[c.usuarioId]
                            ? c.produtividadeHoraAtiva - comparativoOperacional.prevByUser[c.usuarioId].produtividadeHoraAtiva
                            : null
                        }
                        minAbs={0.1}
                      />
                    </td>
                    <td className="px-2 py-2 text-slate-700">
                      <div>{c.taxaConclusaoLogisticaPct}</div>
                      <DeltaTag
                        value={
                          comparativoOperacional.prevByUser[c.usuarioId]
                            ? c.taxaConclusaoLogisticaPct - comparativoOperacional.prevByUser[c.usuarioId].taxaConclusaoLogisticaPct
                            : null
                        }
                        suffix="%"
                        minAbs={1}
                      />
                    </td>
                    <td className="px-2 py-2 text-slate-700">
                      <div>{c.regularidadePct}</div>
                      <DeltaTag
                        value={
                          comparativoOperacional.prevByUser[c.usuarioId]
                            ? c.regularidadePct - comparativoOperacional.prevByUser[c.usuarioId].regularidadePct
                            : null
                        }
                        suffix="%"
                        minAbs={1}
                      />
                    </td>
                    <td className="px-2 py-2 text-slate-700">
                      <div className="w-28">
                        <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                          <span>{c.eficienciaRelativaPct}%</span>
                          <span>{c.eficienciaRelativaPct >= 100 ? "Acima" : "Abaixo"}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-200">
                          <div
                            className={`h-1.5 rounded-full ${c.eficienciaRelativaPct >= 100 ? "bg-emerald-600" : "bg-amber-600"}`}
                            style={{ width: `${Math.max(6, Math.min(100, c.eficienciaRelativaPct))}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-2 text-slate-700">
                      {(() => {
                        const rankAtual = dados.colaboradores.findIndex((it) => it.usuarioId === c.usuarioId) + 1;
                        const rankPrev = comparativoOperacional.prevRankByUser[c.usuarioId];
                        if (!rankPrev) return <span className="text-xs text-slate-400">Novo</span>;
                        const delta = rankPrev - rankAtual;
                        return <DeltaTag value={delta} minAbs={1} />;
                      })()}
                    </td>
                  </tr>
                ))}
                {dados.colaboradores.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-2 py-4 text-slate-500">
                      Sem dados para o período selecionado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          )}
        </>
      )}
    </div>
  );
}
