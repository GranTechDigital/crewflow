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
};

type AbaDesempenho = "setores" | "logistica";

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
  const setorFiltroApi = abaAtiva === "logistica" ? "LOGISTICA" : "SETORES";

  useEffect(() => {
    if (abaDaUrl !== abaAtiva) {
      setAbaAtiva(abaDaUrl);
    }
  }, [abaDaUrl, abaAtiva]);

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
  }, [dataInicio, dataFim, setorFiltroApi]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const graficoUsuarios = useMemo(() => {
    const top = (dados?.graficos.atuacoesPorUsuario || []).slice(0, 10);
    return {
      labels: top.map((item) => item.usuario),
      datasets: [
        {
          label: "Atuações",
          data: top.map((item) => item.total),
          backgroundColor: "#2563eb",
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
          backgroundColor: ["#1d4ed8", "#16a34a", "#f59e0b", "#8b5cf6", "#ef4444"],
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
          borderColor: "#0f766e",
          backgroundColor: "#0f766e",
          tension: 0.2,
        },
      ],
    };
  }, [dados]);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-gray-900">
          {abaAtiva === "logistica" ? "Desempenho Logística" : "Desempenho Setores"}
        </h1>
        <p className="text-sm text-gray-600">
          {abaAtiva === "logistica"
            ? "Atendimento da logística por usuário."
            : "Desempenho dos setores por usuário."}
        </p>
      </div>

      {!hideTabs && (
        <div className="bg-white rounded-lg border border-gray-200 p-2">
          <nav className="flex gap-2">
            <button
              type="button"
              onClick={() => alterarAba("setores")}
              className={`px-4 py-2 text-sm font-medium rounded-md ${
                abaAtiva === "setores"
                  ? "bg-blue-600 text-white"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              Setores
            </button>
            <button
              type="button"
              onClick={() => alterarAba("logistica")}
              className={`px-4 py-2 text-sm font-medium rounded-md ${
                abaAtiva === "logistica"
                  ? "bg-blue-600 text-white"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              Logística
            </button>
          </nav>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 p-4 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Data inicial</label>
          <input
            type="date"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Data final</label>
          <input
            type="date"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Visão</label>
          <input
            type="text"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-gray-50 text-gray-700"
            value={abaAtiva === "logistica" ? "LOGÍSTICA" : "SETORES"}
            disabled
          />
        </div>
        <div className="flex items-end">
          <button
            type="button"
            onClick={carregar}
            className="w-full rounded-md bg-blue-600 text-white px-3 py-2 text-sm font-medium hover:bg-blue-700"
          >
            Atualizar
          </button>
        </div>
      </div>

      {loading && <div className="text-sm text-gray-600">Carregando dados...</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}
      {!loading && !error && dados && dados.tabela.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 text-sm text-gray-700">
          Nenhum dado encontrado para o período selecionado.
        </div>
      )}

      {!loading && !error && dados && dados.tabela.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-xs text-gray-500">Total de atuações</p>
              <p className="text-2xl font-bold text-gray-900">{dados.resumo.totalAtuacoes}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-xs text-gray-500">Usuários com atuação</p>
              <p className="text-2xl font-bold text-gray-900">{dados.resumo.totalUsuarios}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-xs text-gray-500">Setores de tarefas</p>
              <p className="text-2xl font-bold text-gray-900">{dados.resumo.totalSetores}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-xs text-gray-500">Tempo médio (h)</p>
              <p className="text-2xl font-bold text-gray-900">
                {dados.resumo.tempoMedioHorasGeral.toFixed(2)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h2 className="text-sm font-semibold text-gray-800 mb-3">Top usuários por atuação</h2>
              <Bar
                data={graficoUsuarios}
                options={{ responsive: true, plugins: { legend: { display: false } } }}
              />
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h2 className="text-sm font-semibold text-gray-800 mb-3">
                Top usuários por tempo médio de ação
              </h2>
              <Bar
                data={graficoTempoMedio}
                options={{ responsive: true, plugins: { legend: { display: false } } }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h2 className="text-sm font-semibold text-gray-800 mb-3">Atuações por tipo</h2>
              <div className="max-w-md">
                <Doughnut data={graficoTipos} options={{ responsive: true }} />
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h2 className="text-sm font-semibold text-gray-800 mb-3">Atuações por setor</h2>
              <Bar
                data={{
                  labels: (dados?.graficos.atuacoesPorSetor || []).map((item) => item.setor),
                  datasets: [
                    {
                      label: "Atuações",
                      data: (dados?.graficos.atuacoesPorSetor || []).map((item) => item.total),
                      backgroundColor: "#4f46e5",
                    },
                  ],
                }}
                options={{ responsive: true, plugins: { legend: { display: false } } }}
              />
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-gray-800 mb-3">Evolução diária de atuações</h2>
            <Line data={graficoSerie} options={{ responsive: true }} />
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4 overflow-x-auto">
            <h2 className="text-sm font-semibold text-gray-800 mb-3">Tabela de desempenho</h2>
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b border-gray-200 text-gray-600">
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
                  <tr key={`${item.usuarioId}-${item.setorTarefa}`} className="border-b border-gray-100">
                    <td className="px-2 py-2 font-medium text-gray-900">{item.usuario}</td>
                    <td className="px-2 py-2 text-gray-700">{item.matricula}</td>
                    <td className="px-2 py-2 text-gray-700">{item.setorTarefa}</td>
                    <td className="px-2 py-2 text-gray-900">{item.totalAtuacoes}</td>
                    <td className="px-2 py-2 text-gray-700">{item.alocacao}</td>
                    <td className="px-2 py-2 text-gray-700">{item.remanejamento}</td>
                    <td className="px-2 py-2 text-gray-700">{item.vinculoAdicional}</td>
                    <td className="px-2 py-2 text-gray-700">{item.desvinculoAdicional}</td>
                    <td className="px-2 py-2 text-gray-700">{item.desligamento}</td>
                    <td className="px-2 py-2 text-gray-700">{item.mediaTempoHoras.toFixed(2)}</td>
                    <td className="px-2 py-2 text-gray-700">{formatDateBr(item.ultimaAtuacao)}</td>
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
