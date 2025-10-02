"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { toast } from "react-hot-toast";
import {
  DocumentArrowDownIcon,
  UserGroupIcon,
  XCircleIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  EyeIcon,
  UserIcon,
  BriefcaseIcon,
  PaintBrushIcon,
  ChartBarIcon,
  ChartPieIcon,
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
} from "@heroicons/react/24/outline";
import PlusIcon from "@heroicons/react/24/solid/PlusIcon";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
} from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { Pie, Doughnut, Bar } from "react-chartjs-2";

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  ChartDataLabels
);

interface FuncionarioContrato {
  id: string;
  nome: string;
  matricula: string;
  funcao: string;
  centroCusto: string;
  status: string;
  statusPrestserv: string;
  statusPeoplelog?: string;
  emMigracao: boolean;
  contrato?: string;
  sispat?: string;
  observacoes?: string;
  dataInicio?: string;
  dataFim?: string;
  totalDiasPeriodo?: number;
  embarcacao?: string;
  // Novas colunas de período
  periodoInicial?: string;
  periodoFinal?: string;
}

interface DashboardData {
  funcionariosPorContrato: {
    contrato: string;
    count: number;
  }[];
  funcionariosPorStatusFolha: {
    status: string;
    count: number;
  }[];
  funcionariosPorStatusPrestserv: Record<string, number>;
  funcionariosPorFuncao: {
    funcao: string;
    count: number;
  }[];
  funcionariosPorCentroCusto: {
    centroCusto: string;
    count: number;
  }[];
  funcionariosPorMigracao: {
    migracao: string;
    count: number;
  }[];
}

interface ContratoInfo {
  total: number;
  aprovados: number;
  pendentes: number;
  rejeitados: number;
  totalOriginal?: number;
  aprovadosOriginal?: number;
  pendentesOriginal?: number;
  rejeitadosOriginal?: number;
}

export default function FuncionariosPorContratoPage() {
  const router = useRouter();
  const [funcionarios, setFuncionarios] = useState<FuncionarioContrato[]>([]);
  const [contratos, setContratos] = useState<any[]>([]);
  const [contratosOriginais, setContratosOriginais] = useState<
    Record<string, ContratoInfo>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estados para filtros e paginacao
  const [selectedContrato, setSelectedContrato] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [statusPrestservFilter, setStatusPrestservFilter] = useState("");
  const [funcaoFilter, setFuncaoFilter] = useState("");
  const [centroCustoFilter, setCentroCustoFilter] = useState("");
  const [funcaoSearch, setFuncaoSearch] = useState("");
  const [centroCustoSearch, setCentroCustoSearch] = useState("");
  const [migracaoFilter, setMigracaoFilter] = useState("");
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [itemsPerPage] = useState(50);

  // Estado para controle de abas
  const [activeTab, setActiveTab] = useState("lista");

  // Estado para dados do dashboard
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(
    null
  );
  const [loadingDashboard, setLoadingDashboard] = useState(false);

  // Estado para todas as funções disponíveis no banco
  const [todasFuncoes, setTodasFuncoes] = useState<string[]>([]);

  // Estado para todos os centros de custo disponíveis no banco
  const [todosCentrosCusto, setTodosCentrosCusto] = useState<string[]>([]);

  // Estado para todos os status disponíveis no banco
  const [todosStatus, setTodosStatus] = useState<string[]>([]);

  // Estado para todos os status prestserv disponíveis
  const [todosStatusPrestserv, setTodosStatusPrestserv] = useState<string[]>([]);

  // Função para carregar dados do dashboard
  const fetchDashboardData = async () => {
    try {
      setLoadingDashboard(true);
      setError(null);
      const response = await fetch("/api/prestserv/funcionarios-dashboard");
      if (!response.ok) {
        throw new Error("Erro ao carregar dados do dashboard");
      }
      const data = await response.json();
      setDashboardData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoadingDashboard(false);
    }
  };

  // Carregar todas as funções disponíveis do banco
  useEffect(() => {
    const fetchFuncoes = async () => {
      try {
        const response = await fetch("/api/prestserv/funcoes");
        if (!response.ok) {
          throw new Error("Erro ao carregar funções");
        }
        const data = await response.json();
        setTodasFuncoes(data);
      } catch (err) {
        console.error("Erro ao carregar funções:", err);
      }
    };

    fetchFuncoes();
  }, []);

  // Carregar todos os centros de custo disponíveis do banco
  useEffect(() => {
    const fetchCentrosCusto = async () => {
      try {
        const response = await fetch("/api/prestserv/centros-custo");
        if (!response.ok) {
          throw new Error("Erro ao carregar centros de custo");
        }
        const data = await response.json();
        setTodosCentrosCusto(data);
      } catch (err) {
        console.error("Erro ao carregar centros de custo:", err);
      }
    };

    fetchCentrosCusto();
  }, []);

  // Extrair status únicos dos funcionários carregados (Status Folha)
  useEffect(() => {
    if (funcionarios.length > 0) {
      const statusUnicos = Array.from(new Set(funcionarios.map(f => f.status).filter(Boolean))).sort();
      setTodosStatus(statusUnicos);
      
      const statusPrestservUnicos = Array.from(new Set(funcionarios.map(f => f.statusPrestserv).filter(Boolean))).sort();
      setTodosStatusPrestserv(statusPrestservUnicos);
    }
  }, [funcionarios]);

  // Efeito para debounce do termo de busca
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Carregar dados iniciais
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Buscar dados dos contratos com funcionários
        const response = await fetch("/api/prestserv/funcionarios-por-contrato");
        if (!response.ok) {
          throw new Error("Erro ao carregar dados dos contratos");
        }
        const data = await response.json();
        
        // Extrair funcionários de todos os contratos
        const todosFuncionarios: FuncionarioContrato[] = [];
        data.contratos.forEach((contrato: any) => {
          contrato.funcionarios.forEach((func: any) => {
            todosFuncionarios.push({
              ...func,
              contrato: contrato.contratoNome
            });
          });
        });
        
        setFuncionarios(todosFuncionarios);
        
        // Processar contratos para exibição em cards
        const contratosArray = data.contratos.map((contrato: any) => ({
          nome: contrato.contratoNome,
          contratoId: contrato.contratoId,
          cliente: contrato.contratoCliente,
          total: contrato.totalFuncionarios,
          aprovados: contrato.funcionariosAprovados,
          pendentes: contrato.funcionariosPendentes,
          rejeitados: contrato.funcionariosRejeitados,
          totalOriginal: contrato.totalOriginal || contrato.totalFuncionarios,
          aprovadosOriginal: contrato.aprovadosOriginal || contrato.funcionariosAprovados,
          pendentesOriginal: contrato.pendentesOriginal || contrato.funcionariosPendentes,
          rejeitadosOriginal: contrato.rejeitadosOriginal || contrato.funcionariosRejeitados,
        })).sort((a, b) => {
          // Ordenar por ID do contrato
          if (a.contratoId === 'sem_contrato') return 1;
          if (b.contratoId === 'sem_contrato') return -1;
          return a.contratoId - b.contratoId;
        });

        setContratos(contratosArray);
        
        // Criar mapa de contratos originais
        const contratosMap: Record<string, ContratoInfo> = {};
        contratosArray.forEach(contrato => {
          contratosMap[contrato.nome] = {
            total: contrato.total,
            aprovados: contrato.aprovados,
            pendentes: contrato.pendentes,
            rejeitados: contrato.rejeitados,
            totalOriginal: contrato.totalOriginal,
            aprovadosOriginal: contrato.aprovadosOriginal,
            pendentesOriginal: contrato.pendentesOriginal,
            rejeitadosOriginal: contrato.rejeitadosOriginal,
          };
        });
        setContratosOriginais(contratosMap);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro desconhecido");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Filtrar funcionários com base nos filtros aplicados
  const funcionariosFiltrados = useMemo(() => {
    let filtrados = [...funcionarios];

    // Filtrar por contrato selecionado
    if (selectedContrato) {
      filtrados = filtrados.filter(
        (f) => (f.contrato || "Sem Contrato") === selectedContrato
      );
    }

    // Filtrar por termo de busca
    if (debouncedSearchTerm) {
      const searchLower = debouncedSearchTerm.toLowerCase();
      filtrados = filtrados.filter(
        (f) =>
          f.nome.toLowerCase().includes(searchLower) ||
          f.matricula.toLowerCase().includes(searchLower) ||
          (f.sispat && f.sispat.toLowerCase().includes(searchLower))
      );
    }

    // Filtrar por status
    if (statusFilter) {
      filtrados = filtrados.filter((f) => f.status === statusFilter);
    }

    // Filtrar por status prestserv
    if (statusPrestservFilter) {
      filtrados = filtrados.filter(
        (f) => f.statusPrestserv === statusPrestservFilter
      );
    }

    // Filtrar por função
    if (funcaoFilter) {
      filtrados = filtrados.filter((f) => f.funcao === funcaoFilter);
    }

    // Filtrar por centro de custo
    if (centroCustoFilter) {
      filtrados = filtrados.filter((f) => f.centroCusto === centroCustoFilter);
    }

    // Filtrar por migração
    if (migracaoFilter) {
      const emMigracao = migracaoFilter === "SIM";
      filtrados = filtrados.filter((f) => f.emMigracao === emMigracao);
    }

    return filtrados;
  }, [
    funcionarios,
    selectedContrato,
    debouncedSearchTerm,
    statusFilter,
    statusPrestservFilter,
    funcaoFilter,
    centroCustoFilter,
    migracaoFilter,
  ]);

  // Atualizar contratos com base nos filtros
  useEffect(() => {
    // Se não houver filtros aplicados, restaurar os valores originais
    if (
      !debouncedSearchTerm &&
      !statusFilter &&
      !statusPrestservFilter &&
      !funcaoFilter &&
      !centroCustoFilter &&
      !migracaoFilter
    ) {
      const contratosArray = Object.entries(contratosOriginais).map(
        ([nome, info]) => ({
          nome,
          ...info,
          total: info.total,
          aprovados: info.aprovados,
          pendentes: info.pendentes,
          rejeitados: info.rejeitados,
        })
      );
      contratosArray.sort((a, b) => b.total - a.total);
      setContratos(contratosArray);
      return;
    }

    // Recalcular contratos com base nos funcionários filtrados
    const contratosMap: Record<string, ContratoInfo> = {};
    funcionariosFiltrados.forEach((funcionario) => {
      const contrato = funcionario.contrato || "Sem Contrato";
      if (!contratosMap[contrato]) {
        const original = contratosOriginais[contrato] || {
          total: 0,
          aprovados: 0,
          pendentes: 0,
          rejeitados: 0,
        };
        contratosMap[contrato] = {
          ...original,
          total: 0,
          aprovados: 0,
          pendentes: 0,
          rejeitados: 0,
          totalOriginal: original.total,
          aprovadosOriginal: original.aprovados,
          pendentesOriginal: original.pendentes,
          rejeitadosOriginal: original.rejeitados,
        };
      }

      contratosMap[contrato].total++;

      if (funcionario.statusPrestserv === "APROVADO") {
        contratosMap[contrato].aprovados++;
      } else if (funcionario.statusPrestserv === "PENDENTE") {
        contratosMap[contrato].pendentes++;
      } else if (funcionario.statusPrestserv === "REJEITADO") {
        contratosMap[contrato].rejeitados++;
      }
    });

    // Converter para array e ordenar por total
    const contratosArray = Object.entries(contratosMap).map(([nome, info]) => ({
      nome,
      ...info,
    }));

    contratosArray.sort((a, b) => b.total - a.total);
    setContratos(contratosArray);
  }, [
    funcionariosFiltrados,
    contratosOriginais,
    debouncedSearchTerm,
    statusFilter,
    statusPrestservFilter,
    funcaoFilter,
    centroCustoFilter,
    migracaoFilter,
  ]);

  // Calcular paginação
  useEffect(() => {
    const total = funcionariosFiltrados.length;
    const pages = Math.ceil(total / itemsPerPage);
    setTotalPages(pages || 1);
    setTotalItems(total);

    // Ajustar página atual se necessário
    if (currentPage > pages && pages > 0) {
      setCurrentPage(pages);
    }
  }, [funcionariosFiltrados, itemsPerPage, currentPage]);

  // Dados para a página atual
  const funcionariosPaginados = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return funcionariosFiltrados.slice(startIndex, startIndex + itemsPerPage);
  }, [funcionariosFiltrados, currentPage, itemsPerPage]);

  // Função para exportar dados para Excel
  const exportToExcel = useCallback(() => {
    try {
      // Preparar dados para exportação
      const dataToExport = funcionariosFiltrados.map((f) => ({
        Nome: f.nome,
        Matrícula: f.matricula,
        Sispat: f.sispat || "",
        Função: f.funcao,
        "Centro de Custo": f.centroCusto,
        "Status Folha": f.status,
        "Status Prestserv": f.statusPrestserv,
        "Status PeopleLog": f.statusPeoplelog || "",
        "Em Migração": f.emMigracao ? "SIM" : "NÃO",
        Contrato: f.contrato || "Sem Contrato",
        "Data Início": f.dataInicio ? new Date(f.dataInicio).toLocaleDateString('pt-BR') : "",
        "Data Fim": f.dataFim ? new Date(f.dataFim).toLocaleDateString('pt-BR') : "",
        "Total Dias": f.totalDiasPeriodo || "",
        "Período Inicial": f.periodoInicial ? new Date(f.periodoInicial).toLocaleDateString('pt-BR') : "",
        "Período Final": f.periodoFinal ? new Date(f.periodoFinal).toLocaleDateString('pt-BR') : "",
        Embarcação: f.embarcacao || "",
        Observações: f.observacoes || "",
      }));

      // Criar workbook e worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(dataToExport);

      // Adicionar worksheet ao workbook
      XLSX.utils.book_append_sheet(wb, ws, "Funcionários");

      // Gerar nome do arquivo com data atual
      const date = new Date();
      const dateStr = `${date.getDate().toString().padStart(2, "0")}-${(
        date.getMonth() + 1
      )
        .toString()
        .padStart(2, "0")}-${date.getFullYear()}`;
      const fileName = `funcionarios_${dateStr}.xlsx`;

      // Salvar arquivo
      XLSX.writeFile(wb, fileName);
      toast.success("Dados exportados com sucesso!");
    } catch (err) {
      console.error("Erro ao exportar dados:", err);
      toast.error("Erro ao exportar dados");
    }
  }, [funcionariosFiltrados]);

  // Função para obter a classe de cor do badge de status
  const getStatusBadgeClass = useCallback((status: string) => {
    const statusConfig: Record<string, { bg: string; text: string }> = {
      ATIVO: { bg: "bg-green-100", text: "text-green-700" },
      INATIVO: { bg: "bg-red-100", text: "text-red-700" },
      PENDENTE: { bg: "bg-yellow-100", text: "text-yellow-700" },
      FERIAS: { bg: "bg-blue-100", text: "text-blue-700" },
      AFASTADO: { bg: "bg-purple-100", text: "text-purple-700" },
      LICENCA: { bg: "bg-indigo-100", text: "text-indigo-700" },
    };
    return statusConfig[status] || { bg: "bg-gray-100", text: "text-gray-700" };
  }, []);

  // Função para obter a classe de cor do badge de status prestserv
  const getStatusPrestservBadge = useCallback((status: string) => {
    const statusConfig: Record<
      string,
      { bg: string; text: string; label: string }
    > = {
      APROVADO: {
        bg: "bg-green-100",
        text: "text-green-700",
        label: "Aprovado",
      },
      PENDENTE: {
        bg: "bg-yellow-100",
        text: "text-yellow-700",
        label: "Pendente",
      },
      REJEITADO: { bg: "bg-red-100", text: "text-red-700", label: "Rejeitado" },
      SEM_CADASTRO: {
        bg: "bg-gray-100",
        text: "text-gray-700",
        label: "Sem Cadastro",
      },
      ATIVO: { bg: "bg-green-100", text: "text-green-700", label: "Ativo" },
      INATIVO: { bg: "bg-red-100", text: "text-red-700", label: "Inativo" },
      EM_MIGRACAO: {
        bg: "bg-gray-100",
        text: "text-gray-700",
        label: "Em Migracao",
      },
    };
    const config = statusConfig[status as keyof typeof statusConfig] || {
      bg: "bg-gray-100",
      text: "text-gray-700",
      label: status,
    };
    return `${config.bg} ${config.text}`;
  }, []);

  // Função para verificar se funcionário demitido precisa de atenção
  const funcionarioDemitidoPrecisaAtencao = useCallback((funcionario: FuncionarioContrato) => {
    if (funcionario.status === "DEMITIDO") {
      return funcionario.emMigracao || funcionario.statusPrestserv === "ATIVO";
    }
    return false;
  }, []);

  // Função para obter o tipo de alerta para funcionário demitido
  const getTipoAlertaDemitido = useCallback((funcionario: FuncionarioContrato) => {
    if (funcionario.status === "DEMITIDO") {
      if (funcionario.emMigracao && funcionario.statusPrestserv === "ATIVO") {
        return {
          tipo: "critico",
          mensagem: "Funcionário demitido em migração e com status ativo",
          icon: ExclamationCircleIcon,
          classes: "text-red-600 bg-red-50 border-red-200"
        };
      } else if (funcionario.emMigracao) {
        return {
          tipo: "alerta",
          mensagem: "Funcionário demitido em migração",
          icon: ExclamationTriangleIcon,
          classes: "text-orange-600 bg-orange-50 border-orange-200"
        };
      } else if (funcionario.statusPrestserv === "ATIVO") {
        return {
          tipo: "aviso",
          mensagem: "Funcionário demitido com status ativo",
          icon: ExclamationTriangleIcon,
          classes: "text-yellow-600 bg-yellow-50 border-yellow-200"
        };
      }
    }
    return null;
  }, []);

  const handleFilterChange = useCallback(
    (filterType: string, value: string) => {
      switch (filterType) {
        case "status":
          setStatusFilter(value);
          break;
        case "statusPrestserv":
          setStatusPrestservFilter(value);
          break;
        case "funcao":
          setFuncaoFilter(value);
          break;
        case "centroCusto":
          setCentroCustoFilter(value);
          break;
        case "migracao":
          setMigracaoFilter(value);
          break;
      }
    },
    []
  );

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchTerm(e.target.value);
    },
    []
  );

  const clearFilters = useCallback(() => {
    setSearchTerm("");
    setStatusFilter("");
    setStatusPrestservFilter("");
    setFuncaoFilter("");
    setCentroCustoFilter("");
    setMigracaoFilter("");
    setSelectedContrato(null);
    setCurrentPage(1);
    setFuncaoSearch("");
    setCentroCustoSearch("");
  }, []);

  const handleContratoClick = useCallback(
    (contratoNome: string) => {
      setSelectedContrato(
        selectedContrato === contratoNome ? null : contratoNome
      );
    },
    [selectedContrato]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">
            Carregando funcionarios...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <XCircleIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Erro ao carregar dados
          </h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-full mx-auto px-3 sm:px-4 lg:px-6 py-4">
        <div className="space-y-4">
          {/* Header */}
          <div className="mb-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                  <UserGroupIcon className="h-7 w-7 text-slate-600" />
                  Funcionários por Contrato
                </h1>
              </div>
              <div className="flex items-center gap-3 px-4 py-2 rounded-lg">
                <BriefcaseIcon className="h-5 w-5 text-slate-600" />
                <div>
                  <h2 className="text-sm font-semibold text-slate-800">
                    Total de Funcionários:{" "}
                    <span className="text-blue-600">{totalItems}</span>
                  </h2>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-linear-to-r from-gray-800 to-slate-600 rounded-lg p-6">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab("lista")}
                className={`text-white py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                  activeTab === "lista"
                    ? "border-sky-500 text-sky-300"
                    : "border-transparent text-gray-500 hover:text-white-700 hover:border-white-300"
                }`}
              >
                <UserGroupIcon className="h-5 w-5 mr-2" />
                Lista de Funcionários
              </button>
              <button
                onClick={() => {
                  setActiveTab("dashboard");
                  if (!dashboardData) {
                    fetchDashboardData();
                  }
                }}
                className={` text-white py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                  activeTab === "dashboard"
                    ? "border-sky-500 text-sky-300"
                    : "border-transparent text-gray-500 hover:text-white-700 hover:border-white-300"
                }`}
              >
                <ChartBarIcon className="h-5 w-5 mr-2" />
                Dashboard
              </button>
              <button
                onClick={() => {
                  setActiveTab("uptime");
                  if (!dashboardData) {
                    fetchDashboardData();
                  }
                }}
                className={` text-white py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                  activeTab === "uptime"
                    ? "border-sky-500 text-sky-300"
                    : "border-transparent text-gray-500 hover:text-white-700 hover:border-white-300"
                }`}
              >
                <ChartPieIcon className="h-5 w-5 mr-2" />
                Uptime
              </button>
            </nav>
          </div>

          {/* Filtros e Botões */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <FunnelIcon className="h-4 w-4 mr-2 text-gray-500" />
                  Limpar Filtros
                </button>
                <button
                  onClick={exportToExcel}
                  className="inline-flex items-center px-3 py-2 border border-transparent shadow-sm text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
                  Exportar Excel
                </button>
              </div>

              {/* Barra de busca */}
              <div className="relative flex-1 max-w-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={handleSearchChange}
                  placeholder="Buscar por nome, matrícula ou sispat"
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
            </div>

            {/* Filtros adicionais */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Filtro de Status */}
              <div>
                <label
                  htmlFor="status-filter"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Status
                </label>
                <select
                  id="status-filter"
                  value={statusFilter}
                  onChange={(e) => handleFilterChange("status", e.target.value)}
                  className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                >
                  <option value="">Todos</option>
                  {todosStatus.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filtro de Status Prestserv */}
              <div>
                <label
                  htmlFor="status-prestserv-filter"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Status Prestserv
                </label>
                <select
                  id="status-prestserv-filter"
                  value={statusPrestservFilter}
                  onChange={(e) =>
                    handleFilterChange("statusPrestserv", e.target.value)
                  }
                  className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                >
                  <option value="">Todos</option>
                  {todosStatusPrestserv.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filtro de Função */}
              <div>
                <label
                  htmlFor="funcao-filter"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Função
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="🔍 Buscar e selecionar função..."
                    value={funcaoSearch || funcaoFilter}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFuncaoSearch(value);
                      // Se o valor digitado corresponde exatamente a uma função, seleciona ela
                      const funcaoExata = todasFuncoes.find(
                        (f) => f.toLowerCase() === value.toLowerCase()
                      );
                      if (funcaoExata) {
                        handleFilterChange("funcao", funcaoExata);
                      } else if (value === "") {
                        handleFilterChange("funcao", "");
                      }
                    }}
                    className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                    list="funcoes-list"
                  />
                  <datalist id="funcoes-list">
                    {todasFuncoes
                      .filter(
                        (funcao) =>
                          funcaoSearch === "" ||
                          funcao
                            .toLowerCase()
                            .includes(funcaoSearch.toLowerCase())
                      )
                      .map((funcao, index) => (
                        <option key={`funcao-${index}-${funcao}`} value={funcao} />
                      ))}
                  </datalist>
                  {(funcaoFilter || funcaoSearch) && (
                    <button
                      type="button"
                      onClick={() => {
                        setFuncaoSearch("");
                        handleFilterChange("funcao", "");
                      }}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                    >
                      <XCircleIcon className="h-5 w-5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Filtro de Centro de Custo */}
              <div>
                <label
                  htmlFor="centro-custo-filter"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Centro de Custo
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="🔍 Buscar e selecionar centro de custo..."
                    value={centroCustoSearch || centroCustoFilter}
                    onChange={(e) => {
                      const value = e.target.value;
                      setCentroCustoSearch(value);
                      // Se o valor digitado corresponde exatamente a um centro de custo, seleciona ele
                      const centroCustoExato = todosCentrosCusto.find(
                        (c) => c.toLowerCase() === value.toLowerCase()
                      );
                      if (centroCustoExato) {
                        handleFilterChange("centroCusto", centroCustoExato);
                      } else if (value === "") {
                        handleFilterChange("centroCusto", "");
                      }
                    }}
                    className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                    list="centros-custo-list"
                  />
                  <datalist id="centros-custo-list">
                    {todosCentrosCusto
                      .filter(
                        (centroCusto) =>
                          centroCustoSearch === "" ||
                          centroCusto
                            .toLowerCase()
                            .includes(centroCustoSearch.toLowerCase())
                      )
                      .map((centroCusto, index) => (
                        <option key={`centro-custo-${index}-${centroCusto}`} value={centroCusto} />
                      ))}
                  </datalist>
                  {(centroCustoFilter || centroCustoSearch) && (
                    <button
                      type="button"
                      onClick={() => {
                        setCentroCustoSearch("");
                        handleFilterChange("centroCusto", "");
                      }}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                    >
                      <XCircleIcon className="h-5 w-5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Filtro de Migração */}
              <div>
                <label
                  htmlFor="migracao-filter"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Em Migração
                </label>
                <select
                  id="migracao-filter"
                  value={migracaoFilter}
                  onChange={(e) =>
                    handleFilterChange("migracao", e.target.value)
                  }
                  className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                >
                  <option value="">Todos</option>
                  <option value="SIM">Sim</option>
                  <option value="NAO">Não</option>
                </select>
              </div>
            </div>
          </div>

          {/* Conteúdo da aba ativa */}
          {activeTab === "lista" && (
            <>
              {/* Lista de Contratos como Cards */}
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="px-4 py-5 sm:px-6 bg-gray-50 border-b border-gray-200">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 flex items-center">
                    <BriefcaseIcon className="h-5 w-5 mr-2 text-gray-500" />
                    Contratos ({contratos.length})
                  </h3>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-8 gap-6">
                    {contratos.map((contrato, index) => (
                      <div
                        key={`${contrato.nome}-${index}`}
                        onClick={() => handleContratoClick(contrato.nome)}
                        className={`cursor-pointer rounded-xl p-6 transition-all duration-300 hover:shadow-lg transform hover:-translate-y-1 ${
                          selectedContrato === contrato.nome
                            ? "bg-slate-100 shadow-lg border-2 border-slate-400"
                            : "bg-white shadow-md border border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <div className="text-center">
                          {/* Ícone do contrato */}
                          <div className="mx-auto w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                            <BriefcaseIcon className="h-6 w-6 text-slate-600" />
                          </div>

                          {/* Nome do contrato */}
                          <h4
                            className="text-sm font-semibold text-gray-900 mb-2 line-clamp-2 min-h-[2.5rem]"
                            title={contrato.nome}
                          >
                            {contrato.nome}
                          </h4>

                          {/* Cliente */}
                          {contrato.cliente && contrato.cliente !== "-" && (
                            <p
                              className="text-xs text-gray-500 mb-3 truncate"
                              title={contrato.cliente}
                            >
                              {contrato.cliente}
                            </p>
                          )}

                          {/* Total de funcionários */}
                          <div className="bg-slate-50 rounded-lg p-3 mt-4">
                            <div className="text-2xl font-bold text-slate-700 mb-1">
                              {contrato.total}
                            </div>
                            <div className="text-xs text-slate-500 uppercase tracking-wide">
                              Funcionários
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Lista de Funcionários */}
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="px-4 py-5 sm:px-6 bg-gray-50 border-b border-gray-200">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 flex items-center">
                    <UserIcon className="h-5 w-5 mr-2 text-gray-500" />
                    Funcionários ({totalItems})
                    {selectedContrato && (
                      <span className="ml-2 text-sm text-gray-500">
                        - Filtrando por:{" "}
                        <span className="font-semibold">
                          {selectedContrato}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedContrato(null);
                          }}
                          className="ml-2 text-blue-600 hover:text-blue-800"
                        >
                          (Limpar)
                        </button>
                      </span>
                    )}
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Nome
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Matrícula
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Sispat
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Função
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Centro de Custo
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Status Folha
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Status Prestserv
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Status PeopleLog
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Em Migração
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Contrato
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Data Início
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Data Fim
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Total Dias
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Período Inicial
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Período Final
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Embarcação
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Observações
                        </th>
                        <th scope="col" className="relative px-6 py-3">
                          <span className="sr-only">Ações</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {funcionariosPaginados.map((funcionario, index) => {
                        const alertaDemitido =
                          getTipoAlertaDemitido(funcionario);
                        const precisaAtencao =
                          funcionarioDemitidoPrecisaAtencao(funcionario);

                        return (
                          <tr
                            key={`funcionario-${index}-${funcionario.id}`}
                            className={`hover:bg-gray-50 ${
                              precisaAtencao
                                ? "border-l-4 border-l-red-500 bg-red-50/30"
                                : ""
                            }`}
                          >
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              <div className="flex items-center space-x-2">
                                <span>{funcionario.nome}</span>
                                {alertaDemitido && (
                                  <div className="group relative">
                                    <alertaDemitido.icon
                                      className={`h-5 w-5 ${
                                        alertaDemitido.classes.split(" ")[0]
                                      } cursor-help`}
                                    />
                                    <div
                                      className={`absolute z-10 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity duration-200 bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 text-sm rounded-lg border shadow-lg max-w-xs ${alertaDemitido.classes}`}
                                    >
                                      <div className="font-medium mb-1">
                                        ⚠️ Atenção Necessária
                                      </div>
                                      <div>{alertaDemitido.mensagem}</div>
                                      <div
                                        className={`absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent ${
                                          alertaDemitido.classes.includes("red")
                                            ? "border-t-red-200"
                                            : alertaDemitido.classes.includes(
                                                "orange"
                                              )
                                            ? "border-t-orange-200"
                                            : "border-t-yellow-200"
                                        }`}
                                      ></div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {funcionario.matricula}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {funcionario.sispat || "-"}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {funcionario.funcao}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {funcionario.centroCusto}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                  getStatusBadgeClass(funcionario.status).bg
                                } ${
                                  getStatusBadgeClass(funcionario.status).text
                                }`}
                              >
                                {funcionario.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusPrestservBadge(
                                  funcionario.statusPrestserv
                                )}`}
                              >
                                {funcionario.statusPrestserv}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                  funcionario.statusPeoplelog
                                    ? getStatusBadgeClass(
                                        funcionario.statusPeoplelog
                                      ).bg +
                                      " " +
                                      getStatusBadgeClass(
                                        funcionario.statusPeoplelog
                                      ).text
                                    : "bg-gray-100 text-gray-800"
                                }`}
                              >
                                {funcionario.statusPeoplelog || "N/A"}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {funcionario.emMigracao ? "SIM" : "NÃO"}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {funcionario.contrato || "Sem Contrato"}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {funcionario.dataInicio
                                ? new Date(
                                    funcionario.dataInicio
                                  ).toLocaleDateString("pt-BR")
                                : "-"}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {funcionario.dataFim
                                ? new Date(
                                    funcionario.dataFim
                                  ).toLocaleDateString("pt-BR")
                                : "-"}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {funcionario.totalDiasPeriodo || "-"}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {funcionario.periodoInicial
                                ? new Date(
                                    funcionario.periodoInicial
                                  ).toLocaleDateString("pt-BR")
                                : "-"}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {funcionario.periodoFinal
                                ? new Date(
                                    funcionario.periodoFinal
                                  ).toLocaleDateString("pt-BR")
                                : "-"}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {funcionario.embarcacao || "-"}
                            </td>
                            <td
                              className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 max-w-xs truncate"
                              title={funcionario.observacoes}
                            >
                              {funcionario.observacoes || "-"}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <button
                                onClick={() =>
                                  router.push(
                                    `/prestserv/funcionarios/${funcionario.id}`
                                  )
                                }
                                className="text-blue-600 hover:text-blue-900"
                              >
                                <EyeIcon className="h-5 w-5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Paginação */}
                <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                  <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-700">
                        Mostrando{" "}
                        <span className="font-medium">
                          {(currentPage - 1) * itemsPerPage + 1}
                        </span>{" "}
                        a{" "}
                        <span className="font-medium">
                          {Math.min(currentPage * itemsPerPage, totalItems)}
                        </span>{" "}
                        de <span className="font-medium">{totalItems}</span>{" "}
                        resultados
                      </p>
                    </div>
                    <div>
                      <nav
                        className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px"
                        aria-label="Pagination"
                      >
                        <button
                          onClick={() =>
                            setCurrentPage((prev) => Math.max(prev - 1, 1))
                          }
                          disabled={currentPage === 1}
                          className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium ${
                            currentPage === 1
                              ? "text-gray-300 cursor-not-allowed"
                              : "text-gray-500 hover:bg-gray-50"
                          }`}
                        >
                          <span className="sr-only">Anterior</span>
                          <ChevronLeftIcon
                            className="h-5 w-5"
                            aria-hidden="true"
                          />
                        </button>

                        {/* Números de página */}
                        {Array.from(
                          { length: Math.min(5, totalPages) },
                          (_, i) => {
                            let pageNum;
                            if (totalPages <= 5) {
                              pageNum = i + 1;
                            } else if (currentPage <= 3) {
                              pageNum = i + 1;
                            } else if (currentPage >= totalPages - 2) {
                              pageNum = totalPages - 4 + i;
                            } else {
                              pageNum = currentPage - 2 + i;
                            }

                            return (
                              <button
                                key={`page-${pageNum}`}
                                onClick={() => setCurrentPage(pageNum)}
                                className={`relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium ${
                                  currentPage === pageNum
                                    ? "z-10 bg-blue-50 border-blue-500 text-blue-600"
                                    : "text-gray-500 hover:bg-gray-50"
                                }`}
                              >
                                {pageNum}
                              </button>
                            );
                          }
                        )}

                        <button
                          onClick={() =>
                            setCurrentPage((prev) =>
                              Math.min(prev + 1, totalPages)
                            )
                          }
                          disabled={currentPage === totalPages}
                          className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium ${
                            currentPage === totalPages
                              ? "text-gray-300 cursor-not-allowed"
                              : "text-gray-500 hover:bg-gray-50"
                          }`}
                        >
                          <span className="sr-only">Próximo</span>
                          <ChevronRightIcon
                            className="h-5 w-5"
                            aria-hidden="true"
                          />
                        </button>
                      </nav>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
          {activeTab === "dashboard" && (
            /* Dashboard */
            <div className="bg-white rounded-lg shadow p-6">
              {loadingDashboard ? (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600 font-medium">
                      Carregando dashboard...
                    </p>
                  </div>
                </div>
              ) : error ? (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <XCircleIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">
                      Erro ao carregar dados
                    </h2>
                    <p className="text-gray-600 mb-4">{error}</p>
                    <button
                      onClick={fetchDashboardData}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Tentar novamente
                    </button>
                  </div>
                </div>
              ) : dashboardData ? (
                <div className="space-y-8">
                  <h2 className="text-xl font-bold text-gray-900 mb-6">
                    Dashboard de Funcionários
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 grid-rows-2">
                    {/* Gráfico de Funcionários por Contrato */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                      <h3 className="text-lg font-semibold text-gray-800 mb-4">
                        Funcionários por Contrato
                      </h3>
                      <div className="h-64">
                        <Bar
                          data={{
                            labels:
                              dashboardData?.funcionariosPorContrato?.map(
                                (item, index) => item.contrato
                              ) || [],
                            datasets: [
                              {
                                label: "Funcionários",
                                data:
                                  dashboardData?.funcionariosPorContrato?.map(
                                    (item, index) => item.count
                                  ) || [],
                                backgroundColor: "rgba(14, 165, 233, 0.7)",
                                borderColor: "#0EA5E9",
                                borderWidth: 1,
                                borderRadius: 4,
                                borderSkipped: false,
                                hoverBackgroundColor: "#0EA5E9",
                                hoverBorderColor: "#0284C7",
                                hoverBorderWidth: 2,
                              },
                            ],
                          }}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                              legend: {
                                display: false,
                              },
                              tooltip: {
                                backgroundColor: "rgba(15, 23, 42, 0.8)",
                                titleColor: "#ffffff",
                                bodyColor: "#ffffff",
                                bodyFont: {
                                  family: '"Inter", sans-serif',
                                },
                                padding: 12,
                                cornerRadius: 4,
                              },
                            },
                            scales: {
                              y: {
                                beginAtZero: true,
                                ticks: {
                                  color: "#64748B",
                                  font: {
                                    size: 11,
                                    family: '"Inter", sans-serif',
                                  },
                                },
                                grid: {
                                  color: "rgba(148, 163, 184, 0.1)",
                                },
                              },
                              x: {
                                ticks: {
                                  color: "#64748B",
                                  font: {
                                    size: 11,
                                    family: '"Inter", sans-serif',
                                  },
                                  maxRotation: 45,
                                },
                                grid: {
                                  display: false,
                                },
                              },
                            },
                          }}
                        />
                      </div>
                    </div>

                    {/* Gráfico de Funcionários por Status Prestserv */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                      <h3 className="text-lg font-semibold text-gray-800 mb-4">
                        Por Status Prestserv
                      </h3>
                      <div className="h-64">
                        <Doughnut
                          data={{
                            labels:
                              dashboardData?.funcionariosPorStatusPrestserv
                                ? Object.keys(
                                    dashboardData.funcionariosPorStatusPrestserv
                                  ).map((key, index) => `${key}-${index}`)
                                : [],
                            datasets: [
                              {
                                data: dashboardData?.funcionariosPorStatusPrestserv
                                  ? Object.values(
                                      dashboardData.funcionariosPorStatusPrestserv
                                    ).map((value, index) => value)
                                  : [],
                                backgroundColor: [
                                  "#94A3B8", // slate-400
                                  "#0EA5E9", // sky-500
                                  "#64748B", // slate-500
                                  "#475569", // slate-600
                                  "#0284C7", // sky-600
                                  "#334155", // slate-700
                                  "#1E293B", // slate-800
                                ],
                                borderWidth: 1,
                                borderColor: "#ffffff",
                                hoverBorderWidth: 2,
                                hoverBackgroundColor: [
                                  "#64748B", // slate-500
                                  "#0284C7", // sky-600
                                  "#475569", // slate-600
                                  "#334155", // slate-700
                                  "#0369A1", // sky-700
                                  "#1E293B", // slate-800
                                  "#0F172A", // slate-900
                                ],
                              },
                            ],
                          }}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            cutout: "65%",
                            plugins: {
                              legend: {
                                position: "bottom",
                                labels: {
                                  padding: 15,
                                  usePointStyle: true,
                                  font: {
                                    size: 11,
                                    family: '"Inter", sans-serif',
                                  },
                                  color: "#64748B",
                                },
                              },
                              tooltip: {
                                backgroundColor: "rgba(15, 23, 42, 0.8)",
                                titleColor: "#ffffff",
                                bodyColor: "#ffffff",
                                bodyFont: {
                                  family: '"Inter", sans-serif',
                                },
                                padding: 12,
                                cornerRadius: 4,
                              },
                              datalabels: {
                                color: "#1f2937",
                                backgroundColor: "#ffffff",
                                borderColor: "#e5e7eb",
                                borderWidth: 1,
                                borderRadius: 4,
                                padding: 4,
                                font: {
                                  size: 11,
                                  weight: "bold",
                                  family: '"Inter", sans-serif',
                                },
                                formatter: (value: number) => value,
                              },
                            },
                          }}
                        />
                      </div>
                    </div>

                    {/* Gráfico de Funcionários por Status Folha */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 row-span-2">
                      <h3 className="text-lg font-semibold text-gray-800 mb-4">
                        Por Status Folha
                      </h3>
                      <div className="h-160">
                        <Bar
                          data={{
                            labels:
                              dashboardData?.funcionariosPorStatusFolha?.map(
                                (item, index) => item.status
                              ) || [],
                            datasets: [
                              {
                                label: "Funcionários",
                                data:
                                  dashboardData?.funcionariosPorStatusFolha?.map(
                                    (item, index) => item.count
                                  ) || [],
                                backgroundColor: "rgba(14, 165, 233, 0.7)",
                                borderColor: "#0EA5E9",
                                borderWidth: 1,
                                hoverBackgroundColor: "rgba(14, 165, 233, 0.9)",
                                hoverBorderColor: "#0284C7",
                              },
                            ],
                          }}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            indexAxis: "y",
                            plugins: {
                              legend: {
                                display: false,
                              },
                              tooltip: {
                                backgroundColor: "rgba(15, 23, 42, 0.8)",
                                titleColor: "#ffffff",
                                bodyColor: "#ffffff",
                                bodyFont: {
                                  family: '"Inter", sans-serif',
                                },
                                padding: 12,
                                cornerRadius: 4,
                              },
                              datalabels: {
                                color: "#1f2937",
                                backgroundColor: "#ffffff",
                                borderColor: "#e5e7eb",
                                borderWidth: 1,
                                borderRadius: 4,
                                padding: 4,
                                font: {
                                  size: 11,
                                  weight: "bold",
                                  family: '"Inter", sans-serif',
                                },
                                formatter: (value: number) => value,
                                anchor: "end",
                                align: "top",
                              },
                            },
                            scales: {
                              y: {
                                beginAtZero: true,
                                ticks: {
                                  precision: 0,
                                  color: "#64748B",
                                  font: {
                                    family: '"Inter", sans-serif',
                                    size: 11,
                                  },
                                },
                                grid: {
                                  color: "rgba(148, 163, 184, 0.2)",
                                },
                              },
                              x: {
                                ticks: {
                                  color: "#64748B",
                                  font: {
                                    family: '"Inter", sans-serif',
                                    size: 9,
                                  },
                                },
                                grid: {
                                  display: false,
                                },
                              },
                            },
                          }}
                        />
                      </div>
                    </div>

                    {/* Gráfico de Funcionários por Status Peoplelog */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 col-span-2">
                      <h3 className="text-lg font-semibold text-gray-800 mb-4">
                        Por Status Peoplelog
                      </h3>
                      <div className="h-64">
                        <Bar
                          data={{
                            labels:
                              dashboardData?.funcionariosPorStatusPeoplelog?.map(
                                (item, index) => item.status
                              ) || [],
                            datasets: [
                              {
                                label: "Funcionários",
                                data:
                                  dashboardData?.funcionariosPorStatusPeoplelog?.map(
                                    (item, index) => item.count
                                  ) || [],
                                backgroundColor: "rgba(14, 165, 233, 0.7)",
                                borderColor: "#0EA5E9",
                                borderWidth: 1,
                                hoverBackgroundColor: "rgba(15, 165, 233, 0.4)",
                                hoverBorderColor: "#0EA5E9",
                              },
                            ],
                          }}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                              legend: {
                                display: false,
                              },
                              tooltip: {
                                backgroundColor: "rgba(15, 23, 42, 0.8)",
                                titleColor: "#ffffff",
                                bodyColor: "#ffffff",
                                bodyFont: {
                                  family: '"Inter", sans-serif',
                                },
                                padding: 12,
                                cornerRadius: 4,
                              },
                              datalabels: {
                                color: "#1f2937",
                                backgroundColor: "#ffffff",
                                borderColor: "#e5e7eb",
                                borderWidth: 1,
                                borderRadius: 4,
                                padding: 4,
                                font: {
                                  size: 11,
                                  weight: "bold",
                                  family: '"Inter", sans-serif',
                                },
                                formatter: (value: number) => value,
                                anchor: "end",
                                align: "top",
                              },
                            },
                            scales: {
                              y: {
                                beginAtZero: true,
                                ticks: {
                                  precision: 0,
                                  color: "#64748B",
                                  font: {
                                    family: '"Inter", sans-serif',
                                    size: 11,
                                  },
                                },
                                grid: {
                                  color: "rgba(148, 163, 184, 0.2)",
                                },
                              },
                              x: {
                                ticks: {
                                  color: "#64748B",
                                  font: {
                                    family: '"Inter", sans-serif',
                                    size: 9,
                                  },
                                },
                                grid: {
                                  display: false,
                                },
                              },
                            },
                          }}
                        />
                      </div>
                    </div>
                    {/* Gráfico de Funcionários por Migração */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                      <h3 className="text-lg font-semibold text-gray-800 mb-4">
                        Por Migração
                      </h3>
                      <div className="h-64">
                        <Pie
                          data={{
                            labels:
                              dashboardData?.funcionariosPorMigracao?.map(
                                (item, index) =>
                                  `${item.migracao === "SIM" ? "Em Migração" : "Não em Migração"}-${index}`
                              ) || [],
                            datasets: [
                              {
                                data:
                                  dashboardData?.funcionariosPorMigracao?.map(
                                    (item, index) => item.count
                                  ) || [],
                                backgroundColor: [
                                  "#94A3B8", // slate-400
                                  "#0EA5E9", // sky-500
                                ],
                                borderWidth: 1,
                                borderColor: "#ffffff",
                                hoverBorderWidth: 2,
                                hoverBackgroundColor: [
                                  "#64748B", // slate-500
                                  "#0284C7", // sky-600
                                ],
                              },
                            ],
                          }}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                              legend: {
                                position: "bottom",
                                labels: {
                                  padding: 15,
                                  usePointStyle: true,
                                  font: {
                                    size: 11,
                                    family: '"Inter", sans-serif',
                                  },
                                  color: "#64748B",
                                },
                              },
                              tooltip: {
                                backgroundColor: "rgba(15, 23, 42, 0.8)",
                                titleColor: "#ffffff",
                                bodyColor: "#ffffff",
                                bodyFont: {
                                  family: '"Inter", sans-serif',
                                },
                                padding: 12,
                                cornerRadius: 4,
                              },
                              datalabels: {
                                color: "#1f2937",
                                backgroundColor: "#ffffff",
                                borderColor: "#e5e7eb",
                                borderWidth: 1,
                                borderRadius: 4,
                                padding: 4,
                                font: {
                                  size: 11,
                                  weight: "bold",
                                  family: '"Inter", sans-serif',
                                },
                                formatter: (value: number) => value,
                              },
                            },
                          }}
                        />
                      </div>
                    </div>

                    {/* Tabela de Funcionários por Função */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 col-span-2">
                      <h3 className="text-lg font-semibold text-gray-800 mb-4">
                        Por Função
                      </h3>
                      <div className="h-[280px] overflow-y-auto border border-gray-200 rounded">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Função
                              </th>
                              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Qtd
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200 h-180">
                            {dashboardData?.funcionariosPorFuncao?.map(
                              (item, index) => (
                                <tr key={index} className="hover:bg-gray-50">
                                  <td className="px-3 py-2 text-sm text-gray-900">
                                    {item.funcao}
                                  </td>
                                  <td className="px-3 py-2 text-sm text-gray-900 text-right font-medium">
                                    {item.count}
                                  </td>
                                </tr>
                              )
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-120">
                  <div className="text-center">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">
                      Nenhum dado disponível
                    </h2>
                    <button
                      onClick={fetchDashboardData}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Carregar Dados
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          {activeTab === "uptime" && (
             /* Dashboard */
             <div className="bg-white rounded-lg shadow p-6 h-200">
               <iframe
                 title="Uptime Dashboard"
                 width="1200"
                 height="747"
                 src="https://app.powerbi.com/view?r=eyJrIjoiNGU5MjFmNWUtNTNjZi00ZTMxLWI0NmUtODgwM2QyZTc5YzMyIiwidCI6ImNhNmEwZTdiLTUzZTktNDNjMi04YTkyLTVmNzkyZDY4ZWMwNCJ9"
                 frameBorder="0"
                 allowFullScreen={true}
                 style={{ width: '100%', height: '100%' }}
               ></iframe>
             </div>
           )}
        </div>
      </div>
    </div>
  );
}
