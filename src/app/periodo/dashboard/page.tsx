"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
} from "chart.js";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import {
  CalendarIcon,
  UsersIcon,
  DocumentTextIcon,
  ClockIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
} from "@heroicons/react/24/outline";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
);

interface DashboardData {
  resumo: {
    totalRegistros: number;
    totalUploads: number;
    ultimoUpload: any;
    mediaDias: {
      totalDias: number;
      totalDiasPeriodo: number;
    };
  };
  estatisticas: {
    porPeriodo: any[];
    porStatus: any[];
    porFuncao: any[];
    porEmbarcacao: any[];
    distribuicaoDias: any[];
  };
  historico: any[];
}

export default function PeriodoDashboard() {
  const { usuario } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/periodo/dashboard");
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Erro ao carregar dados");
      }

      setData(result.data);
    } catch (err: any) {
      console.error("Erro ao carregar dashboard:", err);
      setError(err.message || "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const formatarData = (dataString: string) => {
    return new Date(dataString).toLocaleDateString("pt-BR");
  };

  const formatarMes = (mes: number, ano: number) => {
    const meses = [
      "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
      "Jul", "Ago", "Set", "Out", "Nov", "Dez"
    ];
    return `${meses[mes - 1]}/${ano}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={carregarDados}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // Preparar dados para gráficos
  const statusData = {
    labels: data.estatisticas.porStatus.map((item: any) => item.status || "Não informado"),
    datasets: [
      {
        data: data.estatisticas.porStatus.map((item: any) => item._count.id),
        backgroundColor: [
          "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
          "#06B6D4", "#84CC16", "#F97316", "#EC4899", "#6B7280"
        ],
        borderWidth: 2,
        borderColor: "#ffffff",
      },
    ],
  };

  const funcaoData = {
    labels: data.estatisticas.porFuncao.slice(0, 8).map((item: any) => 
      item.funcao?.substring(0, 20) + (item.funcao?.length > 20 ? "..." : "") || "Não informado"
    ),
    datasets: [
      {
        label: "Funcionários",
        data: data.estatisticas.porFuncao.slice(0, 8).map((item: any) => item._count.id),
        backgroundColor: "#3B82F6",
        borderColor: "#1D4ED8",
        borderWidth: 1,
      },
    ],
  };

  const embarcacaoData = {
    labels: data.estatisticas.porEmbarcacao.slice(0, 8).map((item: any) => 
      item.embarcacao || "Não informado"
    ),
    datasets: [
      {
        label: "Funcionários",
        data: data.estatisticas.porEmbarcacao.slice(0, 8).map((item: any) => item._count.id),
        backgroundColor: "#10B981",
        borderColor: "#059669",
        borderWidth: 1,
      },
    ],
  };

  const distribuicaoDiasData = {
    labels: data.estatisticas.distribuicaoDias.map((item: any) => item.faixa),
    datasets: [
      {
        data: data.estatisticas.distribuicaoDias.map((item: any) => Number(item.quantidade)),
        backgroundColor: [
          "#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6"
        ],
        borderWidth: 2,
        borderColor: "#ffffff",
      },
    ],
  };

  const historicoData = {
    labels: data.historico.slice().reverse().map((item: any) => 
      formatarMes(item.mesReferencia, item.anoReferencia)
    ),
    datasets: [
      {
        label: "Registros Processados",
        data: data.historico.slice().reverse().map((item: any) => item.registros),
        borderColor: "#3B82F6",
        backgroundColor: "rgba(59, 130, 246, 0.1)",
        tension: 0.4,
      },
      {
        label: "Registros Atualizados",
        data: data.historico.slice().reverse().map((item: any) => item.atualizados),
        borderColor: "#10B981",
        backgroundColor: "rgba(16, 185, 129, 0.1)",
        tension: 0.4,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: "top" as const,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  const doughnutOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: "right" as const,
      },
    },
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard - Período</h1>
            <p className="mt-2 text-gray-600">
              Visão geral dos dados de período dos funcionários
            </p>
          </div>
          <div className="flex space-x-3">
            <a
              href="/periodo"
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              ← Voltar para Upload
            </a>
          </div>
        </div>

        {/* Cards de Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <UsersIcon className="h-8 w-8 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total de Registros</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {data.resumo.totalRegistros.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <DocumentTextIcon className="h-8 w-8 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total de Uploads</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {data.resumo.totalUploads}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ClockIcon className="h-8 w-8 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Média Dias Período</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {data.resumo.mediaDias.totalDiasPeriodo.toFixed(1)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CalendarIcon className="h-8 w-8 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Último Upload</p>
                <p className="text-lg font-semibold text-gray-900">
                  {data.resumo.ultimoUpload 
                    ? formatarData(data.resumo.ultimoUpload.dataUpload)
                    : "Nenhum"
                  }
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Informações do Último Upload */}
        {data.resumo.ultimoUpload && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Último Upload</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-500">Período de Referência</p>
                <p className="font-medium">
                  {formatarMes(data.resumo.ultimoUpload.mesReferencia, data.resumo.ultimoUpload.anoReferencia)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Período</p>
                <p className="font-medium">
                  {formatarData(data.resumo.ultimoUpload.periodoInicial)} - {formatarData(data.resumo.ultimoUpload.periodoFinal)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Arquivo</p>
                <p className="font-medium">{data.resumo.ultimoUpload.nomeArquivo}</p>
              </div>
            </div>
          </div>
        )}

        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Status dos Funcionários */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Status dos Funcionários</h2>
            <div className="h-64">
              <Doughnut data={statusData} options={doughnutOptions} />
            </div>
          </div>

          {/* Distribuição de Dias */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Distribuição de Dias Trabalhados</h2>
            <div className="h-64">
              <Doughnut data={distribuicaoDiasData} options={doughnutOptions} />
            </div>
          </div>
        </div>

        {/* Gráficos de Barras */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Top Funções */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Funções</h2>
            <div className="h-64">
              <Bar data={funcaoData} options={chartOptions} />
            </div>
          </div>

          {/* Top Embarcações */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Embarcações</h2>
            <div className="h-64">
              <Bar data={embarcacaoData} options={chartOptions} />
            </div>
          </div>
        </div>

        {/* Histórico de Uploads */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Histórico de Uploads</h2>
          <div className="h-64">
            <Line data={historicoData} options={chartOptions} />
          </div>
        </div>
      </div>
    </div>
  );
}