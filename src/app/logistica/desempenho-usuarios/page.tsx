"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
  Title,
} from "chart.js";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import { ChatBubbleLeftRightIcon, XMarkIcon } from "@heroicons/react/24/outline";
import * as XLSX from "xlsx";
import ProtectedRoute from "@/components/ProtectedRoute";
import { ROUTE_PROTECTION } from "@/lib/permissions";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
  Title,
);

type ApiData = {
  resumo: {
    totalAtuacoes: number;
    totalUsuarios: number;
    totalSetores: number;
    tempoMedioHorasGeral: number;
    slaHoras?: number;
    percentualDentroSla?: number;
  };
  opcoes: {
    setores: string[];
  };
  graficos: {
    atuacoesPorUsuario: { usuarioId: number; usuario: string; total: number }[];
    tempoMedioPorUsuario: {
      usuarioId: number;
      usuario: string;
      mediaHoras: number;
    }[];
    atuacoesPorTipo: { tipo: string; total: number }[];
    atuacoesPorSetor: { setor: string; total: number }[];
    serieDiaria: { data: string; total: number }[];
  };
  metricasRemanejamento: {
    pendenteLogistica: number;
    pendenteDependenteOutros: number;
    concluido: number;
    total: number;
  } | null;
  listaRemanejamentos: {
    id: string;
    solicitacaoId: number;
    funcionarioNome: string;
    funcionarioMatricula: string;
    tipoSolicitacao: string;
    statusPrestserv: string;
    statusTarefas: string;
    contratoOrigem: string;
    contratoDestino: string;
    dataCriacao: string;
    dataAtualizacao: string;
    observacoesRemanejamentoCount: number;
    categoriaPrincipal:
      | "PENDENTE_LOGISTICA"
      | "PENDENTE_DEPENDENTE_OUTROS"
      | "CONCLUIDO";
  }[];
  tabela: {
    usuarioId: number;
    usuario: string;
    matricula: string;
    setorTarefa: string;
    totalAtuacoes: number;
    alocacao: number;
    remanejamento: number;
    desligamento: number;
    vinculoAdicional: number;
    desvinculoAdicional: number;
    tempoTotalHoras: number;
    mediaTempoHoras: number;
    primeiraAtuacao: string | null;
    ultimaAtuacao: string | null;
  }[];
  colaboradores?: {
    usuarioId: number;
    usuario: string;
    matricula: string;
    totalAtuacoes: number;
    mediaTempoHoras: number;
    produtividade: number;
    percentualDentroSla: number;
    contratosAtuados: string[];
    contratosOrigem: string[];
    contratosDestino: string[];
    acoesOutrosContratos: number;
    destaque: "ALTA_PRODUTIVIDADE" | "TEMPO_MEDIO_ALTO" | "VOLUME_BAIXO" | "SATISFATORIO";
    detalhesAtuacoes?: {
      remanejamentoId: string | null;
      solicitacaoId: number | null;
      statusPrestserv: string;
      statusTarefas: string;
      dataInicio: string;
      dataFim: string | null;
      tempoHoras: number;
      contratoOrigem: string;
      contratoDestino: string;
      tipoSolicitacao: string;
    }[];
  }[];
};

type ObservacaoRemanejamento = {
  id: number;
  texto: string;
  dataCriacao: string;
  dataModificacao: string;
  criadoPor: string;
  modificadoPor: string;
};

type AbaDesempenho = "setores" | "logistica";
type SecaoPagina = "desempenho" | "status-remanejamentos";
type VisaoPeriodo = "mensal" | "semestral" | "anual";
type FiltroCardPrincipal =
  | "TOTAL"
  | "PENDENTE_LOGISTICA"
  | "PENDENTE_DEPENDENTE_OUTROS"
  | "CONCLUIDO";

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateBr(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("pt-BR");
}

function formatTipo(tipo: string) {
  return tipo
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

function formatStatusFiltroLabel(status: string) {
  const normalized = status.trim().toUpperCase();
  if (normalized === "PENDENTE") return "APROVAR";
  if (normalized === "CRIADO") return "ANALISAR";
  if (normalized === "PENDENTE DE DESLIGAMENTO") return "DESLIGAR";
  return status;
}

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export default function DesempenhoUsuariosPage() {
  return (
    <ProtectedRoute
      requiredPermissions={ROUTE_PROTECTION.LOGISTICA.requiredPermissions}
      requiredEquipe={ROUTE_PROTECTION.LOGISTICA.requiredEquipe}
    >
      <DesempenhoUsuariosContent />
    </ProtectedRoute>
  );
}

function DesempenhoUsuariosContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const hideTabs = searchParams.get("hideTabs") === "true";
  const abaDaUrl = searchParams.get("aba") === "logistica" ? "logistica" : "setores";
  const secaoDaUrl = searchParams.get("secao") === "status-remanejamentos"
    ? "status-remanejamentos"
    : "desempenho";
  const today = useMemo(() => new Date(), []);
  const firstDayMonth = useMemo(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
    [today],
  );
  const firstDayYear = useMemo(() => new Date(today.getFullYear(), 0, 1), [today]);
  const dataFimPadrao = useMemo(() => formatDateInput(today), [today]);
  const dataInicioMesPadrao = useMemo(() => formatDateInput(firstDayMonth), [firstDayMonth]);
  const dataInicioAnoPadrao = useMemo(() => formatDateInput(firstDayYear), [firstDayYear]);

  const [abaAtiva, setAbaAtiva] = useState<AbaDesempenho>(abaDaUrl);
  const [dataInicio, setDataInicio] = useState(
    abaDaUrl === "logistica" ? dataInicioAnoPadrao : dataInicioMesPadrao,
  );
  const [dataFim, setDataFim] = useState(dataFimPadrao);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dados, setDados] = useState<ApiData | null>(null);
  const [secaoAtiva, setSecaoAtiva] = useState<SecaoPagina>(secaoDaUrl);
  const [filtroCardPrincipal, setFiltroCardPrincipal] = useState<FiltroCardPrincipal>("TOTAL");
  const [filtroStatusReal, setFiltroStatusReal] = useState<string>("TODOS");
  const [showObsModal, setShowObsModal] = useState(false);
  const [obsLoading, setObsLoading] = useState(false);
  const [obsList, setObsList] = useState<ObservacaoRemanejamento[]>([]);
  const [obsRemanejamentoId, setObsRemanejamentoId] = useState<string | null>(null);
  const [obsFuncionarioNome, setObsFuncionarioNome] = useState<string>("");
  const [visaoPeriodo, setVisaoPeriodo] = useState<VisaoPeriodo>("mensal");
  const [slaHoras, setSlaHoras] = useState<number>(4);
  const [comparativoResumo, setComparativoResumo] = useState<{
    atual: number;
    anterior: number;
    variacaoPct: number;
    tempoAtual: number;
    tempoAnterior: number;
    variacaoTempoPct: number;
  }>({
    atual: 0,
    anterior: 0,
    variacaoPct: 0,
    tempoAtual: 0,
    tempoAnterior: 0,
    variacaoTempoPct: 0,
  });
  const [serieComparativa, setSerieComparativa] = useState<{
    labels: string[];
    atual: number[];
    anterior: number[];
  }>({ labels: [], atual: [], anterior: [] });
  const [paginaAtualRemanejamentos, setPaginaAtualRemanejamentos] = useState(1);
  const [itensPorPaginaRemanejamentos, setItensPorPaginaRemanejamentos] = useState(20);
  const [colaboradoresExpandidos, setColaboradoresExpandidos] = useState<Record<number, boolean>>({});
  const setorFiltroApi = abaAtiva === "logistica" ? "LOGISTICA" : "SETORES";

  useEffect(() => {
    if (abaDaUrl !== abaAtiva) {
      setAbaAtiva(abaDaUrl);
    }
  }, [abaDaUrl, abaAtiva]);

  useEffect(() => {
    if (secaoDaUrl !== secaoAtiva) {
      setSecaoAtiva(secaoDaUrl);
    }
  }, [secaoDaUrl, secaoAtiva]);

  useEffect(() => {
    if (
      abaAtiva === "logistica" &&
      dataInicio === dataInicioMesPadrao &&
      dataFim === dataFimPadrao
    ) {
      setDataInicio(dataInicioAnoPadrao);
    }
  }, [abaAtiva, dataInicio, dataFim, dataInicioMesPadrao, dataInicioAnoPadrao, dataFimPadrao]);

  const alterarAba = useCallback(
    (novaAba: AbaDesempenho) => {
      setAbaAtiva(novaAba);
      const params = new URLSearchParams(searchParams.toString());
      params.set("aba", novaAba);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (dataInicio) params.set("startDate", dataInicio);
      if (dataFim) params.set("endDate", dataFim);
      params.set("setor", setorFiltroApi);
      params.set("slaHoras", String(slaHoras));

      const response = await fetch(`/api/logistica/desempenho-usuarios?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Não foi possível carregar os dados de desempenho.");
      }
      const json = (await response.json()) as ApiData;
      setDados(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado ao carregar dados.");
    } finally {
      setLoading(false);
    }
  }, [dataInicio, dataFim, setorFiltroApi, slaHoras]);

  useEffect(() => {
    const now = new Date();
    if (visaoPeriodo === "mensal") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setDataInicio(formatDateInput(start));
      setDataFim(formatDateInput(end));
      return;
    }
    if (visaoPeriodo === "semestral") {
      const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      const end = now;
      setDataInicio(formatDateInput(start));
      setDataFim(formatDateInput(end));
      return;
    }
    const start = new Date(now.getFullYear(), 0, 1);
    setDataInicio(formatDateInput(start));
    setDataFim(formatDateInput(now));
  }, [visaoPeriodo]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    async function carregarComparativos() {
      if (abaAtiva !== "logistica" || secaoAtiva !== "desempenho") return;

      const now = new Date();
      let atualInicio = startOfDay(now);
      let atualFim = endOfDay(now);
      let anteriorInicio = startOfDay(now);
      let anteriorFim = endOfDay(now);

      if (visaoPeriodo === "mensal") {
        atualInicio = new Date(now.getFullYear(), now.getMonth(), 1);
        atualFim = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
        anteriorInicio = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        anteriorFim = endOfDay(new Date(now.getFullYear(), now.getMonth(), 0));
      } else if (visaoPeriodo === "semestral") {
        atualInicio = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        atualFim = endOfDay(now);
        anteriorInicio = new Date(now.getFullYear(), now.getMonth() - 11, 1);
        anteriorFim = endOfDay(new Date(now.getFullYear(), now.getMonth() - 6, 0));
      } else {
        atualInicio = new Date(now.getFullYear(), 0, 1);
        atualFim = endOfDay(now);
        anteriorInicio = new Date(now.getFullYear() - 1, 0, 1);
        anteriorFim = endOfDay(new Date(now.getFullYear() - 1, 11, 31));
      }

      const montarUrl = (ini: Date, fim: Date) =>
        `/api/logistica/desempenho-usuarios?setor=LOGISTICA&startDate=${formatDateInput(ini)}&endDate=${formatDateInput(fim)}&slaHoras=${slaHoras}`;

      const [atualResp, anteriorResp, mesAtualResp, mesAnteriorResp] = await Promise.all([
        fetch(montarUrl(atualInicio, atualFim)),
        fetch(montarUrl(anteriorInicio, anteriorFim)),
        fetch(
          montarUrl(
            new Date(now.getFullYear(), now.getMonth(), 1),
            endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
          ),
        ),
        fetch(
          montarUrl(
            new Date(now.getFullYear(), now.getMonth() - 1, 1),
            endOfDay(new Date(now.getFullYear(), now.getMonth(), 0)),
          ),
        ),
      ]);

      const atualJson = (await atualResp.json()) as ApiData;
      const anteriorJson = (await anteriorResp.json()) as ApiData;
      const mesAtualJson = (await mesAtualResp.json()) as ApiData;
      const mesAnteriorJson = (await mesAnteriorResp.json()) as ApiData;

      const atual = atualJson?.resumo?.totalAtuacoes || 0;
      const anterior = anteriorJson?.resumo?.totalAtuacoes || 0;
      const variacaoPct = anterior > 0 ? ((atual - anterior) / anterior) * 100 : 0;
      const tempoAtual = atualJson?.resumo?.tempoMedioHorasGeral || 0;
      const tempoAnterior = anteriorJson?.resumo?.tempoMedioHorasGeral || 0;
      const variacaoTempoPct = tempoAnterior > 0 ? ((tempoAtual - tempoAnterior) / tempoAnterior) * 100 : 0;

      setComparativoResumo({
        atual,
        anterior,
        variacaoPct: Number(variacaoPct.toFixed(1)),
        tempoAtual,
        tempoAnterior,
        variacaoTempoPct: Number(variacaoTempoPct.toFixed(1)),
      });

      const atualMap = new Map((mesAtualJson.graficos?.serieDiaria || []).map((d) => [d.data.slice(8, 10), d.total]));
      const anteriorMap = new Map((mesAnteriorJson.graficos?.serieDiaria || []).map((d) => [d.data.slice(8, 10), d.total]));
      const dias = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0"));
      setSerieComparativa({
        labels: dias,
        atual: dias.map((dia) => atualMap.get(dia) || 0),
        anterior: dias.map((dia) => anteriorMap.get(dia) || 0),
      });
    }
    carregarComparativos();
  }, [abaAtiva, secaoAtiva, visaoPeriodo, slaHoras]);

  const graficoUsuarios = useMemo(() => {
    const top = (dados?.graficos.atuacoesPorUsuario || []).slice(0, 10);
    return {
      labels: top.map((item) => item.usuario),
      datasets: [
        {
          label: "Atuações",
          data: top.map((item) => item.total),
          backgroundColor: "#334155",
          borderRadius: 6,
        },
      ],
    };
  }, [dados]);

  const graficoTempoMedio = useMemo(() => {
    const top = (dados?.graficos.tempoMedioPorUsuario || []).slice(0, 10);
    return {
      labels: top.map((item) => item.usuario),
      datasets: [
        {
          label: "Tempo médio (h)",
          data: top.map((item) => item.mediaHoras),
          backgroundColor: "#0f766e",
          borderRadius: 6,
        },
      ],
    };
  }, [dados]);

  const graficoTipos = useMemo(() => {
    const items = dados?.graficos.atuacoesPorTipo || [];
    return {
      labels: items.map((item) => formatTipo(item.tipo)),
      datasets: [
        {
          data: items.map((item) => item.total),
          backgroundColor: ["#334155", "#0f766e", "#475569", "#64748b", "#94a3b8"],
          borderColor: "#ffffff",
          borderWidth: 1,
        },
      ],
    };
  }, [dados]);

  const graficoSerie = useMemo(() => {
    const items = dados?.graficos.serieDiaria || [];
    return {
      labels: items.map((item) => new Date(`${item.data}T00:00:00`).toLocaleDateString("pt-BR")),
      datasets: [
        {
          label: "Atuações por dia",
          data: items.map((item) => item.total),
          borderColor: "#334155",
          backgroundColor: "#334155",
          tension: 0.25,
        },
      ],
    };
  }, [dados]);

  const chartOptionsCompact = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { boxWidth: 10, color: "#334155" } },
      },
      scales: {
        x: { ticks: { color: "#64748b" }, grid: { display: false } },
        y: { ticks: { color: "#64748b" }, grid: { color: "#e2e8f0" } },
      },
    }),
    [],
  );

  const listaBasePorCard = useMemo(() => {
    const lista = dados?.listaRemanejamentos || [];
    if (filtroCardPrincipal === "TOTAL") return lista;
    return lista.filter((item) => item.categoriaPrincipal === filtroCardPrincipal);
  }, [dados, filtroCardPrincipal]);

  const subcardsStatus = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of listaBasePorCard) {
      const status = (item.statusPrestserv || "N/A").trim() || "N/A";
      map.set(status, (map.get(status) || 0) + 1);
    }
    const items = Array.from(map.entries()).map(([status, total]) => ({ status, total }));
    const ordemPendenciaLogistica: Record<string, number> = {
      PENDENTE: 0,
      CRIADO: 1,
      "PENDENTE DE DESLIGAMENTO": 2,
    };

    return items.sort((a, b) => {
      if (filtroCardPrincipal === "PENDENTE_LOGISTICA") {
        const aKey = a.status.trim().toUpperCase();
        const bKey = b.status.trim().toUpperCase();
        const aRank = ordemPendenciaLogistica[aKey];
        const bRank = ordemPendenciaLogistica[bKey];
        const aIn = Number.isInteger(aRank);
        const bIn = Number.isInteger(bRank);
        if (aIn && bIn) return aRank - bRank;
        if (aIn) return -1;
        if (bIn) return 1;
      }
      return b.total - a.total;
    });
  }, [listaBasePorCard, filtroCardPrincipal]);

  const listaRemanejamentosFiltrada = useMemo(() => {
    if (filtroStatusReal === "TODOS") return listaBasePorCard;
    return listaBasePorCard.filter((item) => item.statusPrestserv === filtroStatusReal);
  }, [listaBasePorCard, filtroStatusReal]);

  const totalPaginasRemanejamentos = useMemo(() => {
    const total = Math.ceil(listaRemanejamentosFiltrada.length / itensPorPaginaRemanejamentos);
    return Math.max(total, 1);
  }, [listaRemanejamentosFiltrada.length, itensPorPaginaRemanejamentos]);

  const listaRemanejamentosPaginada = useMemo(() => {
    const inicio = (paginaAtualRemanejamentos - 1) * itensPorPaginaRemanejamentos;
    const fim = inicio + itensPorPaginaRemanejamentos;
    return listaRemanejamentosFiltrada.slice(inicio, fim);
  }, [listaRemanejamentosFiltrada, paginaAtualRemanejamentos, itensPorPaginaRemanejamentos]);

  useEffect(() => {
    setPaginaAtualRemanejamentos(1);
  }, [filtroCardPrincipal, filtroStatusReal, dataInicio, dataFim]);

  useEffect(() => {
    if (paginaAtualRemanejamentos > totalPaginasRemanejamentos) {
      setPaginaAtualRemanejamentos(totalPaginasRemanejamentos);
    }
  }, [paginaAtualRemanejamentos, totalPaginasRemanejamentos]);

  const totaisCards = useMemo(() => {
    const total = dados?.metricasRemanejamento?.total || 0;
    const diretos = dados?.metricasRemanejamento?.pendenteLogistica || 0;
    const indiretos = dados?.metricasRemanejamento?.pendenteDependenteOutros || 0;
    const concluidos = dados?.metricasRemanejamento?.concluido || 0;
    const pct = (v: number) => (total > 0 ? (v / total) * 100 : 0);
    return {
      total,
      diretos,
      indiretos,
      concluidos,
      pctDiretos: pct(diretos),
      pctIndiretos: pct(indiretos),
      pctConcluidos: pct(concluidos),
    };
  }, [dados]);

  const rankingColaboradores = useMemo(() => dados?.colaboradores || [], [dados]);
  const topEntregadores = useMemo(
    () => rankingColaboradores.filter((c) => c.destaque === "ALTA_PRODUTIVIDADE"),
    [rankingColaboradores],
  );
  const satisfatorios = useMemo(
    () => rankingColaboradores.filter((c) => c.destaque === "SATISFATORIO"),
    [rankingColaboradores],
  );
  const baixaPerformance = useMemo(
    () =>
      rankingColaboradores.filter(
        (c) => c.destaque === "TEMPO_MEDIO_ALTO" || c.destaque === "VOLUME_BAIXO",
      ),
    [rankingColaboradores],
  );

  const exportarListaRemanejamentos = useCallback(() => {
    const rows = listaRemanejamentosFiltrada.map((item) => ({
      "ID Remanejamento": item.id,
      "ID Grupo": item.solicitacaoId,
      Funcionário: item.funcionarioNome,
      Matrícula: item.funcionarioMatricula,
      Tipo: item.tipoSolicitacao,
      "Contrato Origem": item.contratoOrigem,
      "Contrato Destino": item.contratoDestino,
      "Status Prestserv": item.statusPrestserv,
      "Status Tarefas": item.statusTarefas,
      "Data Criação": new Date(item.dataCriacao).toLocaleString("pt-BR"),
      "Última Atualização": new Date(item.dataAtualizacao).toLocaleString("pt-BR"),
      "Observações (qtd)": item.observacoesRemanejamentoCount || 0,
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Remanejamentos");
    const sufixo = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `logistica_status_remanejamentos_${sufixo}.xlsx`);
  }, [listaRemanejamentosFiltrada]);

  const carregarObservacoesRemanejamento = useCallback(async (remanejamentoId: string) => {
    try {
      setObsLoading(true);
      const response = await fetch(`/api/logistica/remanejamentos/${remanejamentoId}/observacoes`);
      if (!response.ok) {
        throw new Error("Erro ao carregar observações do remanejamento.");
      }
      const json = (await response.json()) as ObservacaoRemanejamento[];
      setObsList(json);
    } catch {
      setObsList([]);
    } finally {
      setObsLoading(false);
    }
  }, []);

  const abrirObservacoes = useCallback(
    (item: ApiData["listaRemanejamentos"][number]) => {
      setObsRemanejamentoId(item.id);
      setObsFuncionarioNome(item.funcionarioNome);
      setShowObsModal(true);
      setObsList([]);
      carregarObservacoesRemanejamento(item.id);
    },
    [carregarObservacoesRemanejamento],
  );

  return (
    <div className="p-4 md:p-6 space-y-6 bg-slate-50 min-h-screen">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
          {abaAtiva === "logistica" ? "Desempenho Logística" : "Desempenho Setores"}
        </h1>
        <p className="text-sm text-slate-600">
          {abaAtiva === "logistica"
            ? "Atendimento da logística por usuário."
            : "Desempenho dos setores por usuário."}
        </p>
      </div>

      {!hideTabs && (
        <div className="bg-white rounded-xl border border-slate-200 p-2 shadow-sm">
          <nav className="flex gap-2">
            <button
              type="button"
              onClick={() => alterarAba("setores")}
              className={`px-4 py-2 text-sm font-medium rounded-md ${
                abaAtiva === "setores"
                  ? "bg-slate-900 text-white"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              Setores
            </button>
            <button
              type="button"
              onClick={() => alterarAba("logistica")}
              className={`px-4 py-2 text-sm font-medium rounded-md ${
                abaAtiva === "logistica"
                  ? "bg-slate-900 text-white"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              Logística
            </button>
          </nav>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-4 grid grid-cols-1 md:grid-cols-4 gap-4 shadow-sm">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Data inicial</label>
          <input
            type="date"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Data final</label>
          <input
            type="date"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Visão</label>
          <input
            type="text"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-slate-50 text-slate-700"
            value={abaAtiva === "logistica" ? "LOGÍSTICA" : "SETORES"}
            disabled
          />
        </div>
        <div className="flex items-end">
          <button
            type="button"
            onClick={carregar}
            className="w-full rounded-md bg-slate-900 text-white px-3 py-2 text-sm font-medium hover:bg-slate-800"
          >
            Atualizar
          </button>
        </div>
      </div>

      {loading && <div className="text-sm text-slate-600">Carregando dados...</div>}
      {error && <div className="text-sm text-rose-700">{error}</div>}
      {!loading && !error && dados && secaoAtiva === "desempenho" && dados.tabela.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 text-sm text-slate-700">
          Nenhum dado encontrado para o período selecionado.
        </div>
      )}

      {!loading &&
        !error &&
        dados &&
        secaoAtiva === "status-remanejamentos" &&
        abaAtiva === "logistica" &&
        dados.metricasRemanejamento && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <button
            type="button"
            onClick={() => {
              setFiltroCardPrincipal("PENDENTE_LOGISTICA");
              setFiltroStatusReal("TODOS");
            }}
            className={`bg-white border rounded-xl p-4 text-left shadow-sm ${
              filtroCardPrincipal === "PENDENTE_LOGISTICA"
                ? "border-slate-900 ring-1 ring-slate-300"
                : "border-slate-200"
            } cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition`}
          >
            <p className="text-xs text-slate-600">Pendentes Diretos</p>
            <p className="text-2xl font-semibold text-slate-900">
              {dados.metricasRemanejamento.pendenteLogistica}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {totaisCards.pctDiretos.toFixed(1)}% do total
            </p>
          </button>
          <button
            type="button"
            onClick={() => {
              setFiltroCardPrincipal("PENDENTE_DEPENDENTE_OUTROS");
              setFiltroStatusReal("TODOS");
            }}
            className={`bg-white border rounded-xl p-4 text-left shadow-sm ${
              filtroCardPrincipal === "PENDENTE_DEPENDENTE_OUTROS"
                ? "border-slate-900 ring-1 ring-slate-300"
                : "border-slate-200"
            } cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition`}
          >
            <p className="text-xs text-slate-600">Pendentes Indiretos</p>
            <p className="text-2xl font-semibold text-slate-900">
              {dados.metricasRemanejamento.pendenteDependenteOutros}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {totaisCards.pctIndiretos.toFixed(1)}% do total
            </p>
          </button>
          <button
            type="button"
            onClick={() => {
              setFiltroCardPrincipal("CONCLUIDO");
              setFiltroStatusReal("TODOS");
            }}
            className={`bg-white border rounded-xl p-4 text-left shadow-sm ${
              filtroCardPrincipal === "CONCLUIDO"
                ? "border-slate-900 ring-1 ring-slate-300"
                : "border-slate-200"
            } cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition`}
          >
            <p className="text-xs text-slate-600">Concluído</p>
            <p className="text-2xl font-semibold text-slate-900">
              {dados.metricasRemanejamento.concluido}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {totaisCards.pctConcluidos.toFixed(1)}% do total
            </p>
          </button>
          <button
            type="button"
            onClick={() => {
              setFiltroCardPrincipal("TOTAL");
              setFiltroStatusReal("TODOS");
            }}
            className={`bg-white border rounded-xl p-4 text-left shadow-sm ${
              filtroCardPrincipal === "TOTAL"
                ? "border-slate-900 ring-1 ring-slate-300"
                : "border-slate-200"
            } cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition`}
          >
            <p className="text-xs text-slate-600">Total</p>
            <p className="text-2xl font-semibold text-slate-900">
              {dados.metricasRemanejamento.total}
            </p>
          </button>
        </div>
      )}

      {!loading &&
        !error &&
        dados &&
        secaoAtiva === "status-remanejamentos" &&
        abaAtiva !== "logistica" && (
          <div className="bg-white border border-slate-200 rounded-lg p-6 text-sm text-slate-700">
            Esta seção de status é exibida na visão de logística.
          </div>
        )}

      {!loading &&
        !error &&
        dados &&
        secaoAtiva === "status-remanejamentos" &&
        abaAtiva === "logistica" && (
          <>
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setFiltroStatusReal("TODOS")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium border ${
                  filtroStatusReal === "TODOS"
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-700 border-slate-300"
                }`}
              >
                Todos ({listaBasePorCard.length})
              </button>
              {subcardsStatus.map((item) => (
                <button
                  key={item.status}
                  type="button"
                  onClick={() => setFiltroStatusReal(item.status)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium border ${
                    filtroStatusReal === item.status
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-700 border-slate-300"
                  }`}
                >
                  {formatStatusFiltroLabel(item.status)} ({item.total})
                </button>
              ))}
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 overflow-x-auto shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-800">Lista de remanejamentos</h2>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-600">
                  {listaRemanejamentosFiltrada.length} item(ns)
                </span>
                <select
                  value={itensPorPaginaRemanejamentos}
                  onChange={(e) => {
                    setItensPorPaginaRemanejamentos(Number(e.target.value));
                    setPaginaAtualRemanejamentos(1);
                  }}
                  className="px-2 py-1.5 text-xs rounded-md border border-slate-300 text-slate-700 bg-white"
                >
                  <option value={10}>10 / página</option>
                  <option value={20}>20 / página</option>
                  <option value={50}>50 / página</option>
                  <option value={100}>100 / página</option>
                </select>
                <button
                  type="button"
                  onClick={exportarListaRemanejamentos}
                  className="px-3 py-1.5 text-xs font-medium rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  Exportar Excel
                </button>
              </div>
            </div>
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b border-slate-200 text-slate-600">
                  <th className="px-2 py-2">ID Grupo</th>
                  <th className="px-2 py-2">Funcionário</th>
                  <th className="px-2 py-2">Matrícula</th>
                  <th className="px-2 py-2">Tipo</th>
                  <th className="px-2 py-2">Origem</th>
                  <th className="px-2 py-2">Destino</th>
                  <th className="px-2 py-2">Status Prestserv</th>
                  <th className="px-2 py-2">Status Tarefas</th>
                  <th className="px-2 py-2">Data criação</th>
                  <th className="px-2 py-2">Última atualização</th>
                  <th className="px-2 py-2">Observações</th>
                </tr>
              </thead>
              <tbody>
                {listaRemanejamentosPaginada.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100 odd:bg-slate-50/40">
                    <td className="px-2 py-2 text-slate-900">{item.solicitacaoId}</td>
                    <td className="px-2 py-2 text-slate-900 font-medium">{item.funcionarioNome}</td>
                    <td className="px-2 py-2 text-slate-700">{item.funcionarioMatricula}</td>
                    <td className="px-2 py-2 text-slate-700">{item.tipoSolicitacao}</td>
                    <td className="px-2 py-2 text-slate-700">{item.contratoOrigem}</td>
                    <td className="px-2 py-2 text-slate-700">{item.contratoDestino}</td>
                    <td className="px-2 py-2 text-slate-700">{item.statusPrestserv}</td>
                    <td className="px-2 py-2 text-slate-700">{item.statusTarefas}</td>
                    <td className="px-2 py-2 text-slate-700">
                      {new Date(item.dataCriacao).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-2 py-2 text-slate-700">
                      {new Date(item.dataAtualizacao).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        onClick={() => abrirObservacoes(item)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 text-slate-700 hover:bg-slate-50"
                        title="Ver observações"
                      >
                        <ChatBubbleLeftRightIcon className="w-4 h-4" />
                        <span className="text-xs font-medium">{item.observacoesRemanejamentoCount || 0}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {listaRemanejamentosFiltrada.length > 0 && (
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="text-xs text-slate-600">
                  Página {paginaAtualRemanejamentos} de {totalPaginasRemanejamentos}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPaginaAtualRemanejamentos((p) => Math.max(1, p - 1))}
                    disabled={paginaAtualRemanejamentos === 1}
                    className="px-2.5 py-1.5 text-xs rounded-md border border-slate-300 text-slate-700 disabled:opacity-50"
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setPaginaAtualRemanejamentos((p) => Math.min(totalPaginasRemanejamentos, p + 1))
                    }
                    disabled={paginaAtualRemanejamentos === totalPaginasRemanejamentos}
                    className="px-2.5 py-1.5 text-xs rounded-md border border-slate-300 text-slate-700 disabled:opacity-50"
                  >
                    Próxima
                  </button>
                </div>
              </div>
            )}
            {listaRemanejamentosFiltrada.length === 0 && (
              <div className="text-sm text-slate-600 py-4">
                Nenhum remanejamento encontrado para o filtro selecionado.
              </div>
            )}
          </div>
          </>
        )}

      {showObsModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Observações do Remanejamento</h3>
                <p className="text-xs text-slate-600">{obsFuncionarioNome}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowObsModal(false)}
                className="p-1 rounded hover:bg-slate-100 text-slate-600"
                title="Fechar"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[65vh] space-y-3">
              {obsLoading && <p className="text-sm text-slate-600">Carregando observações...</p>}
              {!obsLoading && obsList.length === 0 && (
                <p className="text-sm text-slate-600">Nenhuma observação registrada para este remanejamento.</p>
              )}
              {!obsLoading &&
                obsList.map((obs) => (
                  <div key={obs.id} className="border border-slate-200 rounded-md p-3">
                    <p className="text-sm text-slate-900 whitespace-pre-wrap">{obs.texto}</p>
                    <p className="text-xs text-slate-500 mt-2">
                      {new Date(obs.dataModificacao || obs.dataCriacao).toLocaleString("pt-BR")} •{" "}
                      {obs.modificadoPor || obs.criadoPor || "Sistema"}
                    </p>
                  </div>
                ))}
            </div>
            {obsRemanejamentoId && (
              <div className="px-4 py-2 border-t border-slate-200 text-xs text-slate-500">
                ID Remanejamento: {obsRemanejamentoId}
              </div>
            )}
          </div>
        </div>
      )}

      {!loading && !error && dados && secaoAtiva === "desempenho" && dados.tabela.length > 0 && (
        <>
          {abaAtiva === "logistica" && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 space-y-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-2 md:gap-3">
                <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
                  {(["mensal", "semestral", "anual"] as VisaoPeriodo[]).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setVisaoPeriodo(v)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        visaoPeriodo === v ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {v === "mensal" ? "Mensal" : v === "semestral" ? "Semestral" : "Anual"}
                    </button>
                  ))}
                </div>
                <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5">
                  <span className="text-xs text-slate-500">SLA (h)</span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={slaHoras}
                    onChange={(e) => setSlaHoras(Number(e.target.value) || 4)}
                    className="w-14 rounded border border-slate-300 px-2 py-0.5 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs text-slate-600">SLA definido</p>
                  <p className="text-2xl font-semibold text-slate-900">{dados.resumo.slaHoras || slaHoras}h</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs text-slate-600">% atendido</p>
                  <p className="text-2xl font-semibold text-slate-900">{(dados.resumo.percentualDentroSla || 0).toFixed(1)}%</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-xs text-slate-500">Total de atuações</p>
                  <p className="text-2xl font-semibold text-slate-900">{dados.resumo.totalAtuacoes}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-xs text-slate-500">Tempo médio</p>
                  <p className="text-2xl font-semibold text-slate-900">{dados.resumo.tempoMedioHorasGeral.toFixed(2)}h</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-xs text-slate-500">Volume do período</p>
                  <p className="text-lg font-bold text-slate-900">{comparativoResumo.atual}</p>
                  <p className={`text-xs ${comparativoResumo.variacaoPct >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                    {comparativoResumo.variacaoPct >= 0 ? "↑" : "↓"} {Math.abs(comparativoResumo.variacaoPct)}% vs anterior
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-xs text-slate-500">Volume anterior</p>
                  <p className="text-lg font-bold text-slate-900">{comparativoResumo.anterior}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-xs text-slate-500">Variação tempo médio</p>
                  <p className={`text-lg font-bold ${comparativoResumo.variacaoTempoPct > 0 ? "text-rose-700" : "text-emerald-700"}`}>
                    {comparativoResumo.variacaoTempoPct > 0 ? "+" : ""}{comparativoResumo.variacaoTempoPct}%
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                <div className="rounded-lg border border-slate-200 bg-white/80 p-2 text-slate-700">
                  Volume {comparativoResumo.variacaoPct >= 0 ? "aumentou" : "caiu"} {Math.abs(comparativoResumo.variacaoPct)}% vs período anterior.
                </div>
                <div className="rounded-lg border border-slate-200 bg-white/80 p-2 text-slate-700">
                  Tempo médio {comparativoResumo.variacaoTempoPct > 0 ? "piorou" : "melhorou"} {Math.abs(comparativoResumo.variacaoTempoPct)}%.
                </div>
                <div className="rounded-lg border border-slate-200 bg-white/80 p-2 text-slate-700">
                  {comparativoResumo.variacaoPct > 0 && comparativoResumo.variacaoTempoPct > 0
                    ? "Demanda maior, mas eficiência caiu."
                    : "Evolução estável de produtividade."}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <h3 className="text-sm font-semibold text-slate-800 mb-2">Volume diário: mês atual vs anterior</h3>
                <div className="h-52">
                  <Line
                    data={{
                      labels: serieComparativa.labels,
                      datasets: [
                        { label: "Mês atual", data: serieComparativa.atual, borderColor: "#1e293b", backgroundColor: "#1e293b", tension: 0.25 },
                        { label: "Mês anterior", data: serieComparativa.anterior, borderColor: "#64748b", backgroundColor: "#64748b", tension: 0.25 },
                      ],
                    }}
                    options={chartOptionsCompact}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <h3 className="text-sm font-semibold text-slate-900 mb-2">Alta produtividade</h3>
                  <div className="space-y-2">
                    {topEntregadores.slice(0, 5).map((c, idx) => (
                      <div key={c.usuarioId} className="rounded-lg border border-slate-200 bg-white p-2">
                        <p className="text-xs font-semibold text-slate-800">{idx + 1}. {c.usuario}</p>
                        <p className="text-xs text-slate-600">{c.totalAtuacoes} atuações • {c.produtividade.toFixed(2)} prod.</p>
                      </div>
                    ))}
                    {topEntregadores.length === 0 && <p className="text-xs text-slate-600">Sem registros no período.</p>}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <h3 className="text-sm font-semibold text-slate-900 mb-2">Satisfatórios</h3>
                  <div className="space-y-2">
                    {satisfatorios.slice(0, 5).map((c, idx) => (
                      <div key={c.usuarioId} className="rounded-lg border border-slate-200 bg-white p-2">
                        <p className="text-xs font-semibold text-slate-800">{idx + 1}. {c.usuario}</p>
                        <p className="text-xs text-slate-600">{c.totalAtuacoes} atuações • {c.mediaTempoHoras.toFixed(2)}h</p>
                      </div>
                    ))}
                    {satisfatorios.length === 0 && <p className="text-xs text-slate-600">Sem registros no período.</p>}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <h3 className="text-sm font-semibold text-slate-900 mb-2">Baixa performance</h3>
                  <div className="space-y-2">
                    {baixaPerformance.slice(0, 5).map((c, idx) => (
                      <div key={c.usuarioId} className="rounded-lg border border-slate-200 bg-white p-2">
                        <p className="text-xs font-semibold text-slate-800">{idx + 1}. {c.usuario}</p>
                        <p className="text-xs text-slate-600">{c.mediaTempoHoras.toFixed(2)}h • {c.totalAtuacoes} atuações</p>
                      </div>
                    ))}
                    {baixaPerformance.length === 0 && <p className="text-xs text-slate-600">Sem registros no período.</p>}
                  </div>
                </div>
              </div>
              {!!rankingColaboradores.length && (
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-3">
                  <h3 className="text-sm font-semibold text-slate-800 mb-2">Eficiência por colaborador</h3>
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left border-b border-slate-200 text-slate-600">
                        <th className="px-2 py-2">Colaborador</th>
                        <th className="px-2 py-2">Atuações</th>
                        <th className="px-2 py-2">Tempo médio</th>
                        <th className="px-2 py-2">% SLA</th>
                        <th className="px-2 py-2">Produtividade</th>
                        <th className="px-2 py-2">Contratos</th>
                        <th className="px-2 py-2">Outros contratos</th>
                        <th className="px-2 py-2">Destaque</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rankingColaboradores.flatMap((c) => {
                        const linhas = [
                          <tr key={`base-${c.usuarioId}`} className="border-b border-slate-100">
                          <td className="px-2 py-2 font-medium">
                            <button
                              type="button"
                              onClick={() =>
                                setColaboradoresExpandidos((prev) => ({
                                  ...prev,
                                  [c.usuarioId]: !prev[c.usuarioId],
                                }))
                              }
                              className="inline-flex items-center gap-2 text-left text-slate-900 hover:text-slate-700"
                            >
                              <span className="text-xs">{colaboradoresExpandidos[c.usuarioId] ? "▾" : "▸"}</span>
                              <span>{c.usuario}</span>
                            </button>
                          </td>
                          <td className="px-2 py-2">{c.totalAtuacoes}</td>
                          <td className="px-2 py-2">{c.mediaTempoHoras.toFixed(2)}h</td>
                          <td className="px-2 py-2">{c.percentualDentroSla.toFixed(1)}%</td>
                          <td className="px-2 py-2">{c.produtividade.toFixed(2)}</td>
                          <td className="px-2 py-2">{c.contratosAtuados.length}</td>
                          <td className="px-2 py-2">{c.acoesOutrosContratos}</td>
                          <td className="px-2 py-2">
                            {c.destaque === "TEMPO_MEDIO_ALTO" && <span className="text-rose-700">Tempo médio alto</span>}
                            {c.destaque === "VOLUME_BAIXO" && <span className="text-amber-700">Volume baixo</span>}
                            {c.destaque === "ALTA_PRODUTIVIDADE" && <span className="text-emerald-700">Alta produtividade</span>}
                            {c.destaque === "SATISFATORIO" && <span className="text-slate-600">Satisfatório</span>}
                          </td>
                        </tr>,
                        ];
                        if (colaboradoresExpandidos[c.usuarioId]) {
                          linhas.push(
                          <tr key={`exp-${c.usuarioId}`} className="bg-slate-50/60 border-b border-slate-100">
                            <td colSpan={8} className="px-3 py-3">
                              <div className="rounded-lg border border-slate-200 bg-white p-3">
                                <p className="text-xs font-semibold text-slate-700 mb-2">Auditoria de atuações</p>
                                <div className="overflow-x-auto">
                                  <table className="min-w-full text-xs">
                                    <thead>
                                      <tr className="text-left border-b border-slate-200 text-slate-500">
                                        <th className="px-2 py-1.5">Remanejamento</th>
                                        <th className="px-2 py-1.5">ID Grupo</th>
                                        <th className="px-2 py-1.5">Tipo</th>
                                        <th className="px-2 py-1.5">Status Prestserv</th>
                                        <th className="px-2 py-1.5">Status Tarefas</th>
                                        <th className="px-2 py-1.5">Início</th>
                                        <th className="px-2 py-1.5">Fim</th>
                                        <th className="px-2 py-1.5">Tempo (h)</th>
                                        <th className="px-2 py-1.5">Origem</th>
                                        <th className="px-2 py-1.5">Destino</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(c.detalhesAtuacoes || []).map((d, idx) => (
                                        <tr key={`${c.usuarioId}-${d.remanejamentoId || idx}`} className="border-b border-slate-100">
                                          <td className="px-2 py-1.5 text-slate-700">{d.remanejamentoId || "-"}</td>
                                          <td className="px-2 py-1.5 text-slate-700">{d.solicitacaoId || "-"}</td>
                                          <td className="px-2 py-1.5 text-slate-700">{d.tipoSolicitacao}</td>
                                          <td className="px-2 py-1.5 text-slate-700">{d.statusPrestserv}</td>
                                          <td className="px-2 py-1.5 text-slate-700">{d.statusTarefas}</td>
                                          <td className="px-2 py-1.5 text-slate-700">{new Date(d.dataInicio).toLocaleString("pt-BR")}</td>
                                          <td className="px-2 py-1.5 text-slate-700">{d.dataFim ? new Date(d.dataFim).toLocaleString("pt-BR") : "-"}</td>
                                          <td className="px-2 py-1.5 text-slate-700">{d.tempoHoras.toFixed(2)}</td>
                                          <td className="px-2 py-1.5 text-slate-700">{d.contratoOrigem}</td>
                                          <td className="px-2 py-1.5 text-slate-700">{d.contratoDestino}</td>
                                        </tr>
                                      ))}
                                      {(c.detalhesAtuacoes || []).length === 0 && (
                                        <tr>
                                          <td colSpan={10} className="px-2 py-2 text-slate-500">
                                            Sem detalhes de atuação para o período.
                                          </td>
                                        </tr>
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>,
                          );
                        }
                        return linhas;
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <p className="text-xs text-slate-500">Total de atuações</p>
              <p className="text-2xl font-bold text-slate-900">{dados.resumo.totalAtuacoes}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <p className="text-xs text-slate-500">Usuários com atuação</p>
              <p className="text-2xl font-bold text-slate-900">{dados.resumo.totalUsuarios}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <p className="text-xs text-slate-500">Setores de tarefas</p>
              <p className="text-2xl font-bold text-slate-900">{dados.resumo.totalSetores}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <p className="text-xs text-slate-500">Tempo médio (h)</p>
              <p className="text-2xl font-bold text-slate-900">
                {dados.resumo.tempoMedioHorasGeral.toFixed(2)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <h2 className="text-sm font-semibold text-slate-800 mb-3">Top usuários por atuação</h2>
              <div className="h-56">
                <Bar
                  data={graficoUsuarios}
                  options={{ ...chartOptionsCompact, plugins: { legend: { display: false } } }}
                />
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <h2 className="text-sm font-semibold text-slate-800 mb-3">
                Top usuários por tempo médio de ação
              </h2>
              <div className="h-56">
                <Bar
                  data={graficoTempoMedio}
                  options={{ ...chartOptionsCompact, plugins: { legend: { display: false } } }}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <h2 className="text-sm font-semibold text-slate-800 mb-3">Atuações por tipo</h2>
              <div className="h-56 max-w-md">
                <Doughnut data={graficoTipos} options={chartOptionsCompact} />
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <h2 className="text-sm font-semibold text-slate-800 mb-3">Atuações por setor</h2>
              <div className="h-56">
                <Bar
                  data={{
                    labels: (dados?.graficos.atuacoesPorSetor || []).map((item) => item.setor),
                    datasets: [
                      {
                        label: "Atuações",
                        data: (dados?.graficos.atuacoesPorSetor || []).map((item) => item.total),
                        backgroundColor: "#475569",
                        borderRadius: 6,
                      },
                    ],
                  }}
                  options={{ ...chartOptionsCompact, plugins: { legend: { display: false } } }}
                />
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-slate-800 mb-3">Evolução diária de atuações</h2>
            <div className="h-56">
              <Line data={graficoSerie} options={chartOptionsCompact} />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-4 overflow-x-auto">
            <h2 className="text-sm font-semibold text-slate-800 mb-3">Tabela de desempenho</h2>
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b border-slate-200 text-slate-600">
                  <th className="px-2 py-2">Usuário</th>
                  <th className="px-2 py-2">Matrícula</th>
                  <th className="px-2 py-2">Setor da tarefa</th>
                  <th className="px-2 py-2">Total</th>
                  <th className="px-2 py-2">Alocação</th>
                  <th className="px-2 py-2">Remanejamento</th>
                  <th className="px-2 py-2">Vinculação</th>
                  <th className="px-2 py-2">Desvinculação</th>
                  <th className="px-2 py-2">Desligamento</th>
                  <th className="px-2 py-2">Tempo médio (h)</th>
                  <th className="px-2 py-2">Última atuação</th>
                </tr>
              </thead>
              <tbody>
                {dados.tabela.map((item) => (
                  <tr key={`${item.usuarioId}-${item.setorTarefa}`} className="border-b border-slate-100">
                    <td className="px-2 py-2 font-medium text-slate-900">{item.usuario}</td>
                    <td className="px-2 py-2 text-slate-700">{item.matricula}</td>
                    <td className="px-2 py-2 text-slate-700">{item.setorTarefa}</td>
                    <td className="px-2 py-2 text-slate-900">{item.totalAtuacoes}</td>
                    <td className="px-2 py-2 text-slate-700">{item.alocacao}</td>
                    <td className="px-2 py-2 text-slate-700">{item.remanejamento}</td>
                    <td className="px-2 py-2 text-slate-700">{item.vinculoAdicional}</td>
                    <td className="px-2 py-2 text-slate-700">{item.desvinculoAdicional}</td>
                    <td className="px-2 py-2 text-slate-700">{item.desligamento}</td>
                    <td className="px-2 py-2 text-slate-700">{item.mediaTempoHoras.toFixed(2)}</td>
                    <td className="px-2 py-2 text-slate-700">{formatDateBr(item.ultimaAtuacao)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

