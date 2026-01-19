"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import {
  // RemanejamentoFuncionario,
  // DashboardRemanejamento,
  // StatusPrestserv,
  StatusTarefa,
} from "@/types/remanejamento-funcionario";

import {
  EyeIcon,
  PlusIcon,
  DocumentArrowDownIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  ChevronRightIcon as ChevronRightIcon2,
  UsersIcon,
  DocumentTextIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
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
import ChartDataLabels from "chartjs-plugin-datalabels";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
  ChartDataLabels
);
import ProtectedRoute from "@/components/ProtectedRoute";
import { ROUTE_PROTECTION, PERMISSIONS } from "@/lib/permissions";
import { usePermissions } from "@/app/hooks/useAuth";
import ListaTarefasModal from "@/components/ListaTarefasModal";

interface ProgressoPorSetor {
  setor: string;
  total: number;
  concluidas: number;
  percentual: number;
}

interface FuncionarioTableData {
  id: string;
  remanejamentoId: string;
  nome: string;
  matricula: string;
  sispat?: string;
  funcao: string;
  statusTarefas: string;
  statusPrestserv: string;
  solicitacaoId: string;
  tipoSolicitacao: string;
  contratoOrigem: string;
  contratoDestino: string;
  totalTarefas: number;
  tarefasConcluidas: number;
  dataSolicitacao: string;
  dataConcluido?: string;
  dataResposta?: string;
  createdAt: string;
  updatedAt: string;
  progressoPorSetor: ProgressoPorSetor[];
  statusFuncionario?: string;
  responsavelAtual?: string;
}

export default function FuncionariosPage() {
  return (
    <ProtectedRoute
      requiredEquipe={ROUTE_PROTECTION.PLANEJAMENTO.requiredEquipe}
      requiredPermissions={ROUTE_PROTECTION.PLANEJAMENTO.requiredPermissions}
    >
      <FuncionariosPageContent />
    </ProtectedRoute>
  );
}

function FuncionariosPageContent() {
  const router = useRouter();
  const { showToast } = useToast();
  const { hasAnyPermission } = usePermissions();
  const [funcionarios, setFuncionarios] = useState<FuncionarioTableData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<string>("TODOS");
  const [filtroNome, setFiltroNome] = useState("");
  const [filtroContratoOrigem, setFiltroContratoOrigem] = useState<string[]>(
    []
  );
  const [dropdownContratoOrigemOpen, setDropdownContratoOrigemOpen] =
    useState(false);
  const [filtroContratoDestino, setFiltroContratoDestino] = useState<string[]>(
    []
  );
  const [dropdownContratoDestinoOpen, setDropdownContratoDestinoOpen] =
    useState(false);
  const [filtroTipoSolicitacao, setFiltroTipoSolicitacao] = useState<string[]>(
    []
  );
  const [filtroNumeroSolicitacao, setFiltroNumeroSolicitacao] = useState<
    string[]
  >([]);
  const [dropdownNumeroSolicitacaoOpen, setDropdownNumeroSolicitacaoOpen] =
    useState(false);
  const [filtrosVisiveis, setFiltrosVisiveis] = useState(true);
  const [dropdownTipoSolicitacaoOpen, setDropdownTipoSolicitacaoOpen] =
    useState(false);
  const [filtroSispat, setFiltroSispat] = useState<string[]>([]);
  const [dropdownSispatOpen, setDropdownSispatOpen] = useState(false);
  const [filtroStatusRemanejamento, setFiltroStatusRemanejamento] = useState<
    string[]
  >([]);
  const [dropdownStatusRemanejamentoOpen, setDropdownStatusRemanejamentoOpen] =
    useState(false);
  const [filtroDataSolicitacaoInicio, setFiltroDataSolicitacaoInicio] =
    useState<string>("");
  const [filtroDataSolicitacaoFim, setFiltroDataSolicitacaoFim] =
    useState<string>("");
  const [syncingFuncionarios, setSyncingFuncionarios] = useState(false);
  const [filtroDataConclusaoInicio, setFiltroDataConclusaoInicio] =
    useState<string>("");
  const [filtroDataConclusaoFim, setFiltroDataConclusaoFim] =
    useState<string>("");
  const [setoresSelecionados, setSetoresSelecionados] = useState<string[]>([]);
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [itensPorPagina, setItensPorPagina] = useState(10);
  const [ordenacao, setOrdenacao] = useState<{
    campo: string;
    direcao: "asc" | "desc";
  }>({ campo: "solicitacaoId", direcao: "asc" });
  const [paginaAtualSolicitacoes, setPaginaAtualSolicitacoes] = useState(1);
  const [itensPorPaginaSolicitacoes] = useState(10);
  const [ordenacaoSolicitacoes, setOrdenacaoSolicitacoes] = useState<{
    campo: string;
    direcao: "asc" | "desc";
  }>({ campo: "solicitacaoId", direcao: "asc" });
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showTarefasModal, setShowTarefasModal] = useState(false);
  const [selectedFuncionario, setSelectedFuncionario] =
    useState<FuncionarioTableData | null>(null);
  const [selectedSetores, setSelectedSetores] = useState<string[]>([
    "RH",
    "MEDICINA",
    "TREINAMENTO",
  ]);
  const [generatingTarefas, setGeneratingTarefas] = useState(false);
  const [rejectingStatus, setRejectingStatus] = useState(false);
  const [approvingStatus, setApprovingStatus] = useState(false);
  const [showListaTarefasModal, setShowListaTarefasModal] = useState(false);
  const [funcionarioSelecionadoTarefas, setFuncionarioSelecionadoTarefas] =
    useState<FuncionarioTableData | null>(null);
  const [activeTab, setActiveTab] = useState<
    "nominal" | "solicitacao" | "dashboard"
  >("nominal");
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [isInitialized, setIsInitialized] = useState(false);
  // Filtros do Dashboard
  const [dashboardPeriodoInicio, setDashboardPeriodoInicio] =
    useState<string>("");
  const [dashboardPeriodoFim, setDashboardPeriodoFim] = useState<string>("");

  const criarSolicitacaoComSync = async () => {
    try {
      setSyncingFuncionarios(true);
      showToast(
        "Atualizando base de funcionários antes de criar a solicitação...",
        "info"
      );

      const { syncWithRetry, formatSyncMessage } = await import(
        "@/utils/syncUtils"
      );

      const result = await syncWithRetry({
        maxRetries: 3,
        retryDelay: 2000,
        timeout: 60000,
      });

      if (result.success) {
        const msg = formatSyncMessage(result.data);
        showToast(msg, "success");
      } else {
        showToast(
          result.error ||
            "Não foi possível atualizar a base de funcionários. Você ainda pode prosseguir com a criação da solicitação.",
          "error"
        );
      }
    } catch (error) {
      showToast(
        "Erro ao sincronizar funcionários. Você ainda pode prosseguir com a criação da solicitação.",
        "error"
      );
    } finally {
      setSyncingFuncionarios(false);
      router.push(
        "/prestserv/remanejamentos/novo?returnTo=/prestserv/funcionarios/planejamento"
      );
    }
  };

  // Função para carregar dados do dashboard com filtros aplicados
  const fetchDashboardData = async () => {
    try {
      setLoadingDashboard(true);

      // Obter todos os dados primeiro
      const response = await fetch("/api/logistica/dashboard");

      if (!response.ok) {
        throw new Error("Erro ao carregar dados do dashboard");
      }

      const data = await response.json();

      // Aplicar os mesmos filtros que são usados na tabela
      if (funcionarios.length > 0 && isInitialized) {
        // Filtrar funcionários que precisam de atenção com base nos filtros ativos
        if (data.funcionariosAtencao) {
          data.funcionariosAtencao = data.funcionariosAtencao.filter(
            (funcionario: any) => {
              // Aplicar filtros de nome
              if (
                filtroNome &&
                !funcionario.funcionario.nome
                  .toLowerCase()
                  .includes(filtroNome.toLowerCase())
              ) {
                return false;
              }

              // Aplicar filtros de contrato origem/destino se necessário
              if (
                filtroContratoOrigem.length > 0 &&
                !filtroContratoOrigem.includes(
                  funcionario.solicitacao.centroCustoOrigem
                )
              ) {
                return false;
              }

              if (
                filtroContratoDestino.length > 0 &&
                !filtroContratoDestino.includes(
                  funcionario.solicitacao.centroCustoDestino
                )
              ) {
                return false;
              }

              // Aplicar filtros de status
              if (filtroStatusRemanejamento.length > 0) {
                const stTarefas = String(funcionario.statusTarefas || "");
                const tarefasConcluidas = Number(
                  funcionario.tarefasConcluidas || 0
                );
                const totalTarefas = Number(funcionario.totalTarefas || 0);
                const dataConcluido =
                  funcionario.dataConcluido || funcionario.dataResposta || null;
                let st = "Pendente";
                if (stTarefas === "CANCELADO") st = "Cancelado";
                else if (dataConcluido) st = "Concluído";
                else if (tarefasConcluidas > 0) st = "Em andamento";
                if (!filtroStatusRemanejamento.includes(st)) return false;
              }

              return true;
            }
          );
        }

        // Filtrar tarefas em atraso com base nos filtros ativos
        if (data.tarefasEmAtraso) {
          // Mantemos sem filtro específico, pois removemos filtro de responsável
        }
      }

      setDashboardData(data);
    } catch (err) {
      setDashboardError(
        err instanceof Error ? err.message : "Erro desconhecido"
      );
    } finally {
      setLoadingDashboard(false);
    }
  };

  // Carregar dados do dashboard quando a aba for selecionada
  useEffect(() => {
    if (activeTab === "dashboard" && !dashboardData && !loadingDashboard) {
      fetchDashboardData();
    }
  }, [activeTab, dashboardData, fetchDashboardData, loadingDashboard]);

  // Carregar estado dos filtros do localStorage
  useEffect(() => {
    const savedFiltersVisible = localStorage.getItem(
      "funcionarios-filtros-visiveis"
    );
    if (savedFiltersVisible !== null) {
      setFiltrosVisiveis(JSON.parse(savedFiltersVisible));
    }

    const savedFilters = localStorage.getItem("funcionarios-filtros");
    if (savedFilters) {
      try {
        const filters = JSON.parse(savedFilters);
        setFiltroNome(filters.filtroNome || "");
        setFiltroContratoOrigem(filters.filtroContratoOrigem || []);
        setFiltroContratoDestino(filters.filtroContratoDestino || []);
        setFiltroTipoSolicitacao(filters.filtroTipoSolicitacao || []);
        setFiltroNumeroSolicitacao(filters.filtroNumeroSolicitacao || []);
        setFiltroSispat(filters.filtroSispat || []);
        setFiltroStatusRemanejamento(filters.filtroStatusRemanejamento || []);
        setFiltroDataSolicitacaoInicio(
          filters.filtroDataSolicitacaoInicio || ""
        );
        setFiltroDataSolicitacaoFim(filters.filtroDataSolicitacaoFim || "");
        setFiltroDataConclusaoInicio(filters.filtroDataConclusaoInicio || "");
        setFiltroDataConclusaoFim(filters.filtroDataConclusaoFim || "");
        setActiveTab(filters.activeTab || "solicitacao");
        setPaginaAtual(filters.paginaAtual || 1);
        setItensPorPagina(filters.itensPorPagina || 10);
        setOrdenacao(
          filters.ordenacao || { campo: "solicitacaoId", direcao: "asc" }
        );
      } catch (error) {
        console.error("Erro ao carregar filtros salvos:", error);
      }
    }

    setIsInitialized(true);
    fetchFuncionarios();
  }, []);

  // Fechar dropdowns quando clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest(".dropdown-container")) {
        setDropdownTipoSolicitacaoOpen(false);
        setDropdownContratoOrigemOpen(false);
        setDropdownContratoDestinoOpen(false);
        setDropdownNumeroSolicitacaoOpen(false);
        setDropdownSispatOpen(false);
        setDropdownStatusRemanejamentoOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Salvar estado dos filtros no localStorage
  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem(
        "funcionarios-filtros-visiveis",
        JSON.stringify(filtrosVisiveis)
      );
    }
  }, [filtrosVisiveis, isInitialized]);

  // Salvar valores dos filtros no localStorage
  useEffect(() => {
    if (isInitialized) {
      const filters = {
        filtroNome,
        filtroContratoOrigem,
        filtroContratoDestino,
        filtroTipoSolicitacao,
        filtroNumeroSolicitacao,
        filtroSispat,
        filtroStatusRemanejamento,
        filtroDataSolicitacaoInicio,
        filtroDataSolicitacaoFim,
        filtroDataConclusaoInicio,
        filtroDataConclusaoFim,
        activeTab,
        paginaAtual,
        itensPorPagina,
        ordenacao,
      };
      localStorage.setItem("funcionarios-filtros", JSON.stringify(filters));
    }
  }, [
    filtroNome,
    filtroContratoOrigem,
    filtroContratoDestino,
    filtroTipoSolicitacao,
    filtroNumeroSolicitacao,
    filtroSispat,
    filtroStatusRemanejamento,
    filtroDataSolicitacaoInicio,
    filtroDataSolicitacaoFim,
    filtroDataConclusaoInicio,
    filtroDataConclusaoFim,
    activeTab,
    paginaAtual,
    itensPorPagina,
    ordenacao,
    isInitialized,
  ]);

  // Verificar se houve atualização de tarefas padrão
  useEffect(() => {
    const checkForUpdates = () => {
      const lastUpdate = localStorage.getItem("tarefasPadraoAtualizadas");
      if (lastUpdate) {
        const updateTime = parseInt(lastUpdate);
        const now = Date.now();
        // Se a atualização foi nos últimos 5 segundos, recarregar dados
        if (now - updateTime < 5000) {
          fetchFuncionarios();
          localStorage.removeItem("tarefasPadraoAtualizadas");
        }
      }
    };

    // Verificar imediatamente
    checkForUpdates();

    // Verificar a cada 2 segundos
    const interval = setInterval(checkForUpdates, 2000);

    return () => clearInterval(interval);
  }, []);

  // Função para exibir status com numeração apenas no frontend
  const getStatusLabel = (status: string): string => {
    return getStatusDisplayText(status);
  };

  const getStatusGeralLabel = (status: string): string => {
    return status;
  };

  // Função para determinar quem deve agir baseado no fluxo
  const getResponsavelAtual = (funcionario: FuncionarioTableData): string => {
    const { statusTarefas, statusPrestserv } = funcionario;

    // Se o processo foi concluído ou cancelado, não há responsável
    if (statusTarefas === "CONCLUIDO" || statusTarefas === "CANCELADO") {
      return "N/A";
    }

    // Fluxo: Aprovar Solicitação → Setores → Logística → Fim

    if (statusTarefas === "ATENDER TAREFAS") {
      return "SETORES";
    }

    return "LOGÍSTICA"; // Default
  };

  // Função para obter cor do responsável
  const getResponsavelColor = (responsavel: string): string => {
    switch (responsavel) {
      case "LOGÍSTICA":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "SETORES":
        return "bg-green-100 text-green-800 border-green-200";
      case "N/A":
        return "bg-gray-100 text-gray-800 border-gray-200";
      default:
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
    }
  };

  // Função para exibir status do Prestserv com numeração (apenas para dropdown de ações)
  const getStatusDisplayText = (status: string): string => {
    const statusMap: { [key: string]: string } = {
      PENDENTE: "1. PENDENTE",
      APROVADO: "2. APROVADO",
      REPROVADO: "3. REPROVADO",
      CRIADO: "4. CRIADO",
      SUBMETIDO: "5. SUBMETIDO",
      "EM VALIDAÇÃO": "6. EM VALIDAÇÃO",
      VALIDADO: "8. VALIDADO",
      INVALIDADO: "9. CORREÇÃO",
      CANCELADO: "10. CANCELADO",
    };
    return statusMap[status] || status;
  };

  // Função para exibir status sem numeração (para filtros e exibição geral)
  const getStatusSemNumeracao = (status: string): string => {
    return status;
  };

  // Função para obter todos os status possíveis para o filtro
  const getAllStatusOptions = (): string[] => {
    const allStatus = new Set<string>();

    // Adicionar status dos funcionários existentes (valores do banco)
    funcionarios.forEach((f) => {
      if (f.statusTarefas) allStatus.add(f.statusTarefas);
      if (f.statusPrestserv) allStatus.add(f.statusPrestserv);
    });

    // Status prestserv padrão (valores do banco)
    const statusPrestserv = [
      "PENDENTE",
      "APROVADO",
      "REPROVADO",
      "CRIADO",
      "SUBMETIDO",
      "EM VALIDAÇÃO",
      "VALIDADO",
      "INVALIDADO",
      "CANCELADO",
    ];

    // Status de tarefas
    const statusTarefas = [
      "SUBMETER RASCUNHO",
      "TAREFAS PENDENTES",
      "ATENDER TAREFAS",
      "SOLICITAÇÃO CONCLUÍDA",
      "APROVAR SOLICITAÇÃO",
      "REPROVAR TAREFAS",
    ];

    // Adicionar todos os status
    statusPrestserv.forEach((status) => allStatus.add(status));
    statusTarefas.forEach((status) => allStatus.add(status));

    return Array.from(allStatus).sort();
  };

  const fetchFuncionarios = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        "/api/logistica/remanejamentos?filtrarProcesso=false"
      );

      if (!response.ok) {
        throw new Error("Erro ao carregar remanejamentos");
      }

      const data = await response.json();

      console.log("Dados da API:", data);

      // Transformar os dados da API para o formato esperado pela interface

      // Atualizar o dashboard se estiver na aba dashboard
      if (activeTab === "dashboard") {
        fetchDashboardData();
      }

      const funcionariosTransformados: FuncionarioTableData[] = data.flatMap(
        (solicitacao: any) =>
          solicitacao.funcionarios.map((rf: any) => ({
            id: rf.id,
            remanejamentoId: rf.id,
            nome: rf.funcionario.nome,
            matricula: rf.funcionario.matricula,
            sispat:
              rf.funcionario?.sispat !== null &&
              rf.funcionario?.sispat !== undefined
                ? String(rf.funcionario.sispat)
                : undefined,
            funcao: rf.funcionario.funcao,
            statusTarefas: rf.statusTarefas || "ATENDER TAREFAS",
            statusPrestserv: rf.statusPrestserv || "PENDENTE",
            solicitacaoId: solicitacao.id,
            tipoSolicitacao: solicitacao.tipo || "REMANEJAMENTO",
            contratoOrigem: solicitacao.contratoOrigem?.numero || "N/A",
            contratoDestino: solicitacao.contratoDestino?.numero || "N/A",
            totalTarefas: rf.tarefas?.length || 0,
            tarefasConcluidas:
              rf.tarefas?.filter((t: any) => t.status === "CONCLUIDO").length ||
              0,
            dataSolicitacao: solicitacao.dataSolicitacao,
            dataConcluido: rf.dataConcluido || undefined,
            dataResposta: rf.dataResposta || undefined,
            createdAt: solicitacao.createdAt,
            updatedAt: solicitacao.updatedAt,
            statusFuncionario: rf.statusFuncionario,
            progressoPorSetor: [
              {
                setor: "RH",
                total:
                  rf.tarefas?.filter((t: any) => t.responsavel === "RH")
                    .length || 0,
                concluidas:
                  rf.tarefas?.filter(
                    (t: any) =>
                      t.responsavel === "RH" && t.status === "CONCLUIDO"
                  ).length || 0,
                percentual: 0,
              },
              {
                setor: "MEDICINA",
                total:
                  rf.tarefas?.filter((t: any) => t.responsavel === "MEDICINA")
                    .length || 0,
                concluidas:
                  rf.tarefas?.filter(
                    (t: any) =>
                      t.responsavel === "MEDICINA" && t.status === "CONCLUIDO"
                  ).length || 0,
                percentual: 0,
              },
              {
                setor: "TREINAMENTO",
                total:
                  rf.tarefas?.filter(
                    (t: any) => t.responsavel === "TREINAMENTO"
                  ).length || 0,
                concluidas:
                  rf.tarefas?.filter(
                    (t: any) =>
                      t.responsavel === "TREINAMENTO" &&
                      t.status === "CONCLUIDO"
                  ).length || 0,
                percentual: 0,
              },
            ].map((progresso) => ({
              ...progresso,
              percentual:
                progresso.total > 0
                  ? Math.round((progresso.concluidas / progresso.total) * 100)
                  : 0,
            })),
          }))
      );

      setFuncionarios(funcionariosTransformados);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  };

  const estatisticasPorSetor = () => {
    const estatisticas = funcionarios.reduce((acc, funcionario) => {
      funcionario.progressoPorSetor?.forEach((progresso) => {
        if (!acc[progresso.setor]) {
          acc[progresso.setor] = { total: 0, concluidas: 0 };
        }
        acc[progresso.setor].total += progresso.total;
        acc[progresso.setor].concluidas += progresso.concluidas;
      });
      return acc;
    }, {} as Record<string, { total: number; concluidas: number }>);

    return Object.entries(estatisticas).map(([setor, dados]) => ({
      setor,
      total: dados.total,
      concluidas: dados.concluidas,
      percentual:
        dados.total > 0
          ? Math.round((dados.concluidas / dados.total) * 100)
          : 0,
    }));
  };

  const calcularProgresso = (concluidas: number, total: number) => {
    return total > 0 ? Math.round((concluidas / total) * 100) : 0;
  };

  const getSetorIcon = (setor: string) => {
    switch (setor.toUpperCase()) {
      case "RH":
        return "👥";
      case "MEDICINA":
        return "🏥";
      case "LOGISTICA":
        return "📦";
      case "TREINAMENTO":
        return "📚";
      default:
        return "📋";
    }
  };

  const getSetorColor = (percentual: number) => {
    if (percentual >= 80) return "bg-green-600";
    if (percentual >= 60) return "bg-gray-600";
    return "bg-gray-400";
  };

  const getProgressIcon = (concluidas: number, total: number) => {
    if (total === 0) {
      return "●"; // Sem tarefas
    } else if (concluidas === total) {
      return "●"; // Concluído
    } else if (concluidas > 0) {
      return "●"; // Em andamento
    } else {
      return "●"; // Pendente
    }
  };

  const getProgressColor = (concluidas: number, total: number) => {
    if (total === 0) {
      return "text-gray-300";
    } else if (concluidas === total) {
      return "text-green-600";
    } else if (concluidas > 0) {
      return "text-yellow-500";
    } else {
      return "text-gray-400";
    }
  };

  const isConcluido = (funcionario: FuncionarioTableData) => {
    return (
      funcionario.statusTarefas === "CONCLUIDO" || !!funcionario.dataConcluido
    );
  };

  const getRemanejamentoStatus = React.useCallback(
    (funcionario: FuncionarioTableData) => {
      if (funcionario.statusTarefas === "CANCELADO") return "Cancelado";
      if (isConcluido(funcionario)) return "Concluído";
      if (funcionario.tarefasConcluidas > 0) return "Em andamento";
      return "Pendente";
    },
    []
  );

  const getRemanejamentoStatusColor = (status: string) => {
    switch (status) {
      case "Concluído":
        return "bg-green-100 text-green-700";
      case "Cancelado":
        return "bg-red-100 text-red-700";
      case "Em andamento":
        return "bg-blue-100 text-blue-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  // Conclusão definitiva para contabilizar na visão por solicitação
  const isConclusaoDefinitiva = React.useCallback(
    (funcionario: FuncionarioTableData) => {
      const sispatStr = String(funcionario.sispat ?? "").trim();
      const hasSispat = sispatStr.length > 0; // considera "0" como válido

      const prestserv = String(funcionario.statusPrestserv ?? "")
        .trim()
        .toUpperCase();
      const statusFunc = String(funcionario.statusFuncionario ?? "")
        .trim()
        .toUpperCase();
      const prestservConcl =
        prestserv === "VALIDADO" ||
        prestserv === "APROVADO" ||
        prestserv === "ATIVO";
      const funcAtivo = statusFunc === "ATIVO";

      const remConcluido = getRemanejamentoStatus(funcionario) === "Concluído";

      return hasSispat && (prestservConcl || funcAtivo) && remConcluido;
    },
    []
  );

  const formatDateOrDash = (value?: string) => {
    if (!value) return "-";
    try {
      return new Date(value).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return "-";
    }
  };

  const getProgressoDisplay = (funcionario: FuncionarioTableData) => {
    const total = funcionario.totalTarefas;
    const concluidas = funcionario.tarefasConcluidas;
    if (total <= 0) return 0;
    const pct = Math.round((concluidas / total) * 100);
    if (pct >= 100 && !isConcluido(funcionario)) return 90;
    return pct;
  };

  const getDataEncerramento = React.useCallback(
    (funcionario: FuncionarioTableData): string | undefined => {
      if (isConcluido(funcionario)) {
        return (
          funcionario.dataConcluido || funcionario.dataResposta || undefined
        );
      }
      return undefined;
    },
    []
  );

  const getSolicitacaoStatusFromFuncionarios = React.useCallback(
    (lista: FuncionarioTableData[]) => {
      const todosEncerradosOuCancelados = lista.every((f) => {
        const st = getRemanejamentoStatus(f);
        return st === "Concluído" || st === "Cancelado";
      });
      if (todosEncerradosOuCancelados) return "Concluído";
      const algumEmAndamento = lista.some(
        (f) => getRemanejamentoStatus(f) === "Em andamento"
      );
      if (algumEmAndamento) return "Em andamento";
      return "Pendente";
    },
    [getRemanejamentoStatus]
  );

  const getSolicitacaoDataConclusao = React.useCallback(
    (lista: FuncionarioTableData[]) => {
      const datas = lista
        .map((f) => getDataEncerramento(f))
        .filter(Boolean)
        .map((d) => new Date(d as string).getTime());
      if (datas.length === 0) return undefined;
      return new Date(Math.max(...datas));
    },
    [getDataEncerramento]
  );

  const funcionariosPorStatusRemanejamento = React.useMemo(() => {
    const counts: Record<string, number> = {
      Pendente: 0,
      "Em andamento": 0,
      Concluído: 0,
      Cancelado: 0,
    };
    funcionarios.forEach((f) => {
      const st = getRemanejamentoStatus(f);
      counts[st] = (counts[st] || 0) + 1;
    });
    return [
      { status: "Pendente", count: counts["Pendente"] || 0 },
      { status: "Em andamento", count: counts["Em andamento"] || 0 },
      { status: "Concluído", count: counts["Concluído"] || 0 },
      { status: "Cancelado", count: counts["Cancelado"] || 0 },
    ];
  }, [funcionarios, getRemanejamentoStatus]);

  const toMonthKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const parseMonthKey = (key: string) => {
    const [y, m] = key.split("-");
    return new Date(Number(y), Number(m) - 1, 1);
  };
  const formatMonthLabel = (value: Date) =>
    value.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });

  const funcionariosPorContratoStatus = React.useMemo(() => {
    const mapa: Record<
      string,
      {
        concluido: number;
        andamento: number;
        pendente: number;
        cancelado: number;
      }
    > = {};
    funcionarios.forEach((f) => {
      const st = getRemanejamentoStatus(f);
      const contrato = f.contratoDestino || f.contratoOrigem || "N/A";
      if (!mapa[contrato]) {
        mapa[contrato] = {
          concluido: 0,
          andamento: 0,
          pendente: 0,
          cancelado: 0,
        };
      }
      if (st === "Concluído") mapa[contrato].concluido++;
      else if (st === "Em andamento") mapa[contrato].andamento++;
      else if (st === "Pendente") mapa[contrato].pendente++;
      else if (st === "Cancelado") mapa[contrato].cancelado++;
    });
    const arr = Object.entries(mapa).map(([contrato, s]) => ({
      contrato,
      ...s,
      total: s.concluido + s.andamento + s.pendente + s.cancelado,
    }));
    arr.sort((a, b) => b.total - a.total);
    return arr.slice(0, 10);
  }, [funcionarios, getRemanejamentoStatus]);

  const getTooltipMessage = (funcionario: FuncionarioTableData): string => {
    const statusGeral = funcionario.statusTarefas;
    const statusPrestserv = funcionario.statusPrestserv;
    const responsavel = getResponsavelAtual(funcionario);
    const pendingTasks =
      funcionario.progressoPorSetor?.filter((p) => p.percentual < 100) || [];

    let baseMessage = "";

    // Status Prestserv: CRIADO
    if (statusPrestserv === "CRIADO") {
      if (statusGeral === "ATENDER TAREFAS") {
        if (pendingTasks.length > 0) {
          const setoresPendentes = pendingTasks.map((p) => p.setor).join(", ");
          const totalTarefasPendentes = pendingTasks.reduce(
            (acc, p) => acc + (p.total - p.concluidas),
            0
          );
          baseMessage = `🔄 2. Criado - ATENDER TAREFAS ${setoresPendentes} concluir ${totalTarefasPendentes} ${
            totalTarefasPendentes === 1
              ? "tarefa pendente"
              : "tarefas pendentes"
          }. Não é possível submeter ainda.`;
        } else {
          baseMessage =
            "🔄 2. Criado - Aguardando conclusão de tarefas pendentes. Não é possível submeter ainda.";
        }
      } else if (statusGeral === "SUBMETER RASCUNHO") {
        baseMessage =
          '✅ 2. Criado - Todas as tarefas foram concluídas! Agora é possível avançar para "3. Submetido".';
      }
    }

    // Status Prestserv: SUBMETIDO
    else if (statusPrestserv === "SUBMETIDO") {
      if (statusGeral === "SUBMETER RASCUNHO") {
        baseMessage =
          '📋 3. Submetido - Solicitação submetida com SUBMETER RASCUNHO. Pode ser "Aprovado" ou "Rejeitado".';
      } else {
        baseMessage =
          "📋 3. Submetido - Solicitação foi submetida e está aguardando validação.";
      }
    }

    // Status Prestserv: APROVADO
    else if (statusPrestserv === "VALIDADO") {
      baseMessage =
        "✅ 4. Aprovado - Prestserv foi validado com sucesso! Processo aprovado.";
    }

    // Status Prestserv: REJEITADO
    else if (statusPrestserv === "INVALIDADO") {
      baseMessage =
        '❌ 5. Invalidado - Prestserv foi invalidado. Status geral alterado automaticamente para "Aguardando Logística".';
    }

    // Status Prestserv: PENDENTE
    else if (statusPrestserv === "PENDENTE") {
      baseMessage =
        "⏳ 1. Pendente - Solicitação pendente de aprovação inicial. Aguardando análise para liberação das tarefas.";
    }

    // Status Geral: AGUARDANDO_LOGISTICA
    else if (statusGeral === "REPROVAR TAREFAS") {
      baseMessage =
        "🔧 Aguardando ação da logística para prosseguir com o processo.";
    }

    // Mensagem padrão
    else {
      baseMessage =
        "📊 Acompanhe o progresso das tarefas e o status atual do funcionário nesta linha.";
    }

    // Adicionar informação do responsável
    const responsavelInfo =
      responsavel === "CONCLUÍDO"
        ? "🎉 Processo finalizado!"
        : `👤 Responsável atual: ${responsavel}`;

    return `${baseMessage}\n\n${responsavelInfo}`;
  };

  const getContratosOrigem = () => {
    return [
      ...new Set(funcionarios.map((f) => f.contratoOrigem).filter(Boolean)),
    ];
  };

  const getContratosDestino = () => {
    return [
      ...new Set(funcionarios.map((f) => f.contratoDestino).filter(Boolean)),
    ];
  };

  const getStatusRemanejamentoOptions = () => {
    const set = new Set<string>();
    funcionarios.forEach((f) => {
      set.add(getRemanejamentoStatus(f));
    });
    return Array.from(set).sort();
  };

  // Obter tipos de solicitação únicos
  const getTiposSolicitacao = () => {
    return [
      ...new Set(funcionarios.map((f) => f.tipoSolicitacao).filter(Boolean)),
    ].sort();
  };

  // Obter números de solicitação únicos
  const getNumerosSolicitacao = () => {
    return [
      ...new Set(funcionarios.map((f) => f.solicitacaoId).filter(Boolean)),
    ].sort();
  };

  const limparFiltros = () => {
    setFiltroStatus("TODOS");
    setFiltroNome("");
    setFiltroContratoOrigem([]);
    setFiltroContratoDestino([]);
    setFiltroTipoSolicitacao([]);
    setFiltroNumeroSolicitacao([]);
    setFiltroSispat([]);
    setFiltroStatusRemanejamento([]);
    setFiltroDataSolicitacaoInicio("");
    setFiltroDataSolicitacaoFim("");
    setFiltroDataConclusaoInicio("");
    setFiltroDataConclusaoFim("");
    setSetoresSelecionados([]);
    setPaginaAtual(1);
    setItensPorPagina(10);
    setOrdenacao({ campo: "solicitacaoId", direcao: "asc" });
  };

  const exportarParaExcel = async () => {
    const dadosParaExportar = funcionariosFiltrados.map((funcionario) => {
      // Função para determinar status do setor
      const getStatusSetor = (setor: string) => {
        const progressoSetor = funcionario.progressoPorSetor.find(
          (p) => p.setor === setor
        );
        if (!progressoSetor || progressoSetor.total === 0) {
          return "Sem Tarefas";
        }
        return progressoSetor.concluidas === progressoSetor.total
          ? "Concluído"
          : "Pendente";
      };

      return {
        ID: funcionario.remanejamentoId,
        "ID GRUPO": funcionario.solicitacaoId,
        Contratos: `${funcionario.contratoOrigem} → ${funcionario.contratoDestino}`,
        "FUNCIONÁRIO PRESTSERV": `${funcionario.nome} (${funcionario.matricula}) - ${funcionario.funcao}`,
        "AÇÃO NECESSÁRIA": funcionario.statusTarefas,
        Responsável: funcionario.responsavelAtual || "N/A",
        "Progresso Setores": `${funcionario.tarefasConcluidas}/${funcionario.totalTarefas}`,
        "RASCUNHO PRESTSERV": funcionario.statusPrestserv,
        RH: getStatusSetor("RH"),
        MEDICINA: getStatusSetor("MEDICINA"),
        TREINAMENTO: getStatusSetor("TREINAMENTO"),
        "Data Solicitação": new Date(
          funcionario.dataSolicitacao
        ).toLocaleDateString("pt-BR"),
        "Data Criação": new Date(funcionario.createdAt).toLocaleDateString(
          "pt-BR"
        ),
        "Data Atualização": new Date(funcionario.updatedAt).toLocaleDateString(
          "pt-BR"
        ),
      };
    });

    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet(dadosParaExportar);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Funcionários");

    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const data = new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = window.URL.createObjectURL(data);
    const link = document.createElement("a");
    link.href = url;
    link.download = `funcionarios_remanejamento_${
      new Date().toISOString().split("T")[0]
    }.xlsx`;
    link.click();
    window.URL.revokeObjectURL(url);

    showToast("Arquivo Excel exportado com sucesso!", "success");
  };

  // Funções para gerenciar tags de filtros ativos
  const removerFiltroIndividual = (tipoFiltro: string, valor?: string) => {
    switch (tipoFiltro) {
      case "status":
        setFiltroStatus("TODOS");
        break;
      case "nome":
        setFiltroNome("");
        break;
      case "contratoOrigem":
        if (valor) {
          setFiltroContratoOrigem((prev) =>
            prev.filter((contrato) => contrato !== valor)
          );
        } else {
          setFiltroContratoOrigem([]);
        }
        break;
      case "contratoDestino":
        if (valor) {
          setFiltroContratoDestino((prev) =>
            prev.filter((contrato) => contrato !== valor)
          );
        } else {
          setFiltroContratoDestino([]);
        }
        break;
      case "tipoSolicitacao":
        if (valor) {
          setFiltroTipoSolicitacao((prev) =>
            prev.filter((tipo) => tipo !== valor)
          );
        } else {
          setFiltroTipoSolicitacao([]);
        }
        break;
      case "numeroSolicitacao":
        if (valor) {
          setFiltroNumeroSolicitacao((prev) =>
            prev.filter((numero) => numero !== valor)
          );
        } else {
          setFiltroNumeroSolicitacao([]);
        }
        break;
      case "sispat":
        if (valor) {
          setFiltroSispat((prev) => prev.filter((v) => v !== valor));
        } else {
          setFiltroSispat([]);
        }
        break;
      case "statusRemanejamento":
        if (valor) {
          setFiltroStatusRemanejamento((prev) =>
            prev.filter((v) => v !== valor)
          );
        } else {
          setFiltroStatusRemanejamento([]);
        }
        break;
      case "dataSolicitacao":
        setFiltroDataSolicitacaoInicio("");
        setFiltroDataSolicitacaoFim("");
        break;
      case "dataConclusao":
        setFiltroDataConclusaoInicio("");
        setFiltroDataConclusaoFim("");
        break;
    }
  };

  const obterTagsFiltrosAtivos = () => {
    const tags: Array<{ tipo: string; valor: string; label: string }> = [];

    if (filtroStatus !== "TODOS") {
      tags.push({
        tipo: "status",
        valor: filtroStatus,
        label: `Status: ${getStatusDisplayText(filtroStatus)}`,
      });
    }

    if (filtroNome) {
      tags.push({
        tipo: "nome",
        valor: filtroNome,
        label: `Nome: ${filtroNome}`,
      });
    }

    filtroContratoOrigem.forEach((contrato) => {
      tags.push({
        tipo: "contratoOrigem",
        valor: contrato,
        label: `Origem: ${contrato}`,
      });
    });

    filtroContratoDestino.forEach((contrato) => {
      tags.push({
        tipo: "contratoDestino",
        valor: contrato,
        label: `Destino: ${contrato}`,
      });
    });

    filtroTipoSolicitacao.forEach((tipo) => {
      tags.push({
        tipo: "tipoSolicitacao",
        valor: tipo,
        label: `Tipo: ${tipo}`,
      });
    });

    filtroNumeroSolicitacao.forEach((numero) => {
      tags.push({
        tipo: "numeroSolicitacao",
        valor: numero,
        label: `Nº: ${numero}`,
      });
    });

    filtroSispat.forEach((v) => {
      const label = v === "COM" ? "Com" : v === "SEM" ? "Sem" : v;
      tags.push({ tipo: "sispat", valor: v, label: `Sispat: ${label}` });
    });

    filtroStatusRemanejamento.forEach((status) => {
      tags.push({
        tipo: "statusRemanejamento",
        valor: status,
        label: `Status Remanejamento: ${status}`,
      });
    });

    if (filtroDataSolicitacaoInicio || filtroDataSolicitacaoFim) {
      const inicioLabel = filtroDataSolicitacaoInicio
        ? new Date(filtroDataSolicitacaoInicio).toLocaleDateString("pt-BR")
        : "-";
      const fimLabel = filtroDataSolicitacaoFim
        ? new Date(filtroDataSolicitacaoFim).toLocaleDateString("pt-BR")
        : "-";
      tags.push({
        tipo: "dataSolicitacao",
        valor: `${filtroDataSolicitacaoInicio}|${filtroDataSolicitacaoFim}`,
        label: `Data Solicitação: ${inicioLabel} a ${fimLabel}`,
      });
    }

    if (filtroDataConclusaoInicio || filtroDataConclusaoFim) {
      const inicioLabel = filtroDataConclusaoInicio
        ? new Date(filtroDataConclusaoInicio).toLocaleDateString("pt-BR")
        : "-";
      const fimLabel = filtroDataConclusaoFim
        ? new Date(filtroDataConclusaoFim).toLocaleDateString("pt-BR")
        : "-";
      tags.push({
        tipo: "dataConclusao",
        valor: `${filtroDataConclusaoInicio}|${filtroDataConclusaoFim}`,
        label: `Data Conclusão: ${inicioLabel} a ${fimLabel}`,
      });
    }

    return tags;
  };

  const abrirModalConfirmacao = (funcionario: FuncionarioTableData) => {
    setSelectedFuncionario(funcionario);
    setShowConfirmModal(true);
  };

  const confirmarAprovacao = () => {
    setShowConfirmModal(false);
    setShowTarefasModal(true);
  };

  const rejeitarSolicitacao = async () => {
    if (!selectedFuncionario) return;

    setRejectingStatus(true);
    try {
      const response = await fetch(
        `/api/logistica/funcionario/${selectedFuncionario.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ statusTarefas: "REJEITADO" }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erro ao rejeitar solicitação");
      }

      // Atualizar o estado local
      setFuncionarios((prev) =>
        prev.map((func) =>
          func.id === selectedFuncionario.id
            ? { ...func, statusTarefas: "SOLICITAÇÃO REJEITADA" }
            : func
        )
      );

      // Atualizar o dashboard após rejeitar a solicitação
      if (activeTab === "dashboard") {
        fetchDashboardData();
      }

      showToast(
        `Solicitação de ${selectedFuncionario.nome} foi reprovada`,
        "success"
      );
      cancelarAprovacao();
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Erro ao reprovar a solicitação",
        "error"
      );
    } finally {
      setRejectingStatus(false);
    }
  };

  const aprovarSolicitacao = async () => {
    if (!selectedFuncionario || approvingStatus) return;

    setApprovingStatus(true);
    try {
      const response = await fetch(
        `/api/logistica/funcionario/${selectedFuncionario.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ statusTarefas: "REPROVAR TAREFAS" }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erro ao aprovar solicitação");
      }

      // Atualizar o estado local
      setFuncionarios((prev) =>
        prev.map((func) =>
          func.id === selectedFuncionario.id
            ? { ...func, statusTarefas: "REPROVAR TAREFAS" }
            : func
        )
      );

      showToast(
        `Solicitação de ${selectedFuncionario.nome} foi aprovada`,
        "success"
      );

      // Atualizar o dashboard após aprovar a solicitação
      if (activeTab === "dashboard") {
        fetchDashboardData();
      }

      // Perguntar se quer gerar tarefas
      setShowTarefasModal(true);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Erro ao aprovar solicitação",
        "error"
      );
    } finally {
      setApprovingStatus(false);
    }
  };

  const cancelarAprovacao = () => {
    setShowConfirmModal(false);
    setShowTarefasModal(false);
    setSelectedFuncionario(null);
    setSelectedSetores(["RH", "MEDICINA", "TREINAMENTO"]);
    setRejectingStatus(false);
  };

  const toggleSetor = (setor: string) => {
    setSelectedSetores((prev) =>
      prev.includes(setor) ? prev.filter((s) => s !== setor) : [...prev, setor]
    );
  };

  const gerarTarefasPadrao = async () => {
    if (!selectedFuncionario || selectedSetores.length === 0) {
      showToast("Selecione pelo menos um setor", "warning");
      return;
    }

    setGeneratingTarefas(true);
    try {
      const response = await fetch("/api/tarefas/padrao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          funcionarioId: selectedFuncionario.id,
          setores: selectedSetores,
          criadoPor: "Sistema",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        showToast(
          errorData.error || "Erro ao reprovar tarefas padrão",
          "error"
        );
        return;
      }

      const result = await response.json();
      showToast(
        `Tarefas padrão criadas com sucesso para ${selectedFuncionario.nome}!`,
        "success"
      );
      fetchFuncionarios();

      // Atualizar o dashboard após gerar tarefas
      if (activeTab === "dashboard") {
        fetchDashboardData();
      }

      setShowTarefasModal(false);
      setSelectedFuncionario(null);
      setSelectedSetores(["RH", "MEDICINA", "TREINAMENTO"]);
    } catch (error) {
      showToast("Erro ao reprovar tarefas padrão", "error");
    } finally {
      setGeneratingTarefas(false);
    }
  };

  // Função para abrir o modal de lista de tarefas
  const abrirListaTarefas = (
    funcionario: FuncionarioTableData,
    statusAtualizado?: string
  ) => {
    // Se um status atualizado for fornecido, usar ele; caso contrário, usar o status atual do funcionário
    const funcionarioParaModal = statusAtualizado
      ? {
          ...funcionario,
          statusPrestserv: statusAtualizado,
        }
      : funcionario;

    setFuncionarioSelecionadoTarefas(funcionarioParaModal);
    setShowListaTarefasModal(true);
  };

  // Função para fechar o modal de lista de tarefas
  const fecharListaTarefas = () => {
    setShowListaTarefasModal(false);
    setFuncionarioSelecionadoTarefas(null);
  };

  // Função de callback para atualizar a tabela quando uma tarefa for reprovada
  const handleTarefaReprovada = () => {
    // Recarregar os dados dos funcionários para refletir as mudanças
    fetchFuncionarios();

    // Se estiver na aba dashboard, também atualizar os dados do dashboard
    if (activeTab === "dashboard") {
      fetchDashboardData();
    }
  };

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (showListaTarefasModal) {
          fecharListaTarefas();
        } else if (showConfirmModal || showTarefasModal) {
          cancelarAprovacao();
        }
      }
    };

    if (showConfirmModal || showTarefasModal || showListaTarefasModal) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [showConfirmModal, showTarefasModal, showListaTarefasModal]);

  // Funções para visão por solicitação
  const toggleRow = (solicitacaoId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(solicitacaoId)) {
      newExpanded.delete(solicitacaoId);
    } else {
      newExpanded.add(solicitacaoId);
    }
    setExpandedRows(newExpanded);
  };

  const [expandedFilters, setExpandedFilters] = useState<
    Record<string, string | null>
  >({});
  const openRow = (solicitacaoId: string) => {
    const newExpanded = new Set(expandedRows);
    newExpanded.add(solicitacaoId);
    setExpandedRows(newExpanded);
  };
  const handleChipClick = (solicitacaoId: string, status: string) => {
    openRow(solicitacaoId);
    setExpandedFilters((prev) => {
      const current = prev[solicitacaoId] || null;
      const next = current === status ? null : status;
      return { ...prev, [solicitacaoId]: next };
    });
  };

  const getFuncionariosResumo = (funcionarios: FuncionarioTableData[]) => {
    // Pendentes com base no status de remanejamento
    const pendentes = funcionarios.filter(
      (f) => getRemanejamentoStatus(f) === "Pendente"
    ).length;

    // Em andamento com base no status de remanejamento
    const emAndamento = funcionarios.filter(
      (f) => getRemanejamentoStatus(f) === "Em andamento"
    ).length;

    // Concluídos definitivos: somente quem já tem sispat e está ATIVO no Prestserv
    const concluidos = funcionarios.filter((f) =>
      isConclusaoDefinitiva(f)
    ).length;

    return { pendentes, emAndamento, concluidos, total: funcionarios.length };
  };

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      // Status de tarefas
      "ATENDER TAREFAS": "bg-gray-100 text-gray-700",
      "SUBMETER RASCUNHO": "bg-gray-200 text-gray-800",
      "TAREFAS PENDENTES": "bg-yellow-100 text-yellow-700",

      // Status prestserv
      PENDENTE: "bg-gray-100 text-gray-700",
      CRIADO: "bg-gray-100 text-gray-700",
      SUBMETIDO: "bg-gray-100 text-gray-700",
      APROVADO: "bg-gray-200 text-gray-800",
      REJEITADO: "bg-red-100 text-red-700",
      INVALIDADO: "bg-red-100 text-red-700",
      CANCELADO: "bg-red-100 text-red-700",
      "EM VALIDAÇÃO": "bg-blue-100 text-blue-700",
      VALIDADO: "bg-green-100 text-green-700",

      // Status de solicitação
      Pendente: "bg-yellow-100 text-yellow-700",
      "Em Andamento": "bg-blue-100 text-blue-700",
      "Em andamento": "bg-blue-100 text-blue-700",
      Concluído: "bg-green-100 text-green-700",
    };
    return colors[status] || "bg-gray-100 text-gray-700";
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR");
  };

  const temFiltrosAtivos = () => {
    return (
      filtroStatus !== "TODOS" ||
      filtroNome ||
      filtroContratoOrigem.length > 0 ||
      filtroContratoDestino.length > 0 ||
      filtroTipoSolicitacao.length > 0 ||
      filtroNumeroSolicitacao.length > 0 ||
      filtroSispat.length > 0 ||
      filtroStatusRemanejamento.length > 0 ||
      !!filtroDataSolicitacaoInicio ||
      !!filtroDataSolicitacaoFim ||
      !!filtroDataConclusaoInicio ||
      !!filtroDataConclusaoFim
    );
  };

  // Aplicar filtros aos funcionários
  const funcionariosFiltrados = funcionarios.filter((funcionario) => {
    const matchNome =
      !filtroNome ||
      funcionario.nome.toLowerCase().includes(filtroNome.toLowerCase()) ||
      funcionario.matricula.toLowerCase().includes(filtroNome.toLowerCase());

    const matchStatus =
      filtroStatus === "TODOS" ||
      funcionario.statusTarefas === filtroStatus ||
      funcionario.statusPrestserv === filtroStatus;

    const matchContratoOrigem =
      filtroContratoOrigem.length === 0 ||
      filtroContratoOrigem.includes(funcionario.contratoOrigem);

    const matchContratoDestino =
      filtroContratoDestino.length === 0 ||
      filtroContratoDestino.includes(funcionario.contratoDestino);

    const matchTipoSolicitacao =
      filtroTipoSolicitacao.length === 0 ||
      filtroTipoSolicitacao.includes(funcionario.tipoSolicitacao);

    const matchNumeroSolicitacao =
      filtroNumeroSolicitacao.length === 0 ||
      filtroNumeroSolicitacao.includes(funcionario.solicitacaoId);

    const hasSispat = String(funcionario.sispat ?? "").trim().length > 0;
    const matchSispat =
      filtroSispat.length === 0 ||
      (filtroSispat.includes("COM") && hasSispat) ||
      (filtroSispat.includes("SEM") && !hasSispat);

    const statusRemanejamentoAtual = getRemanejamentoStatus(funcionario);
    const matchStatusRemanejamento =
      filtroStatusRemanejamento.length === 0 ||
      filtroStatusRemanejamento.includes(statusRemanejamentoAtual);

    const matchDataSolicitacao = (() => {
      if (!filtroDataSolicitacaoInicio && !filtroDataSolicitacaoFim)
        return true;
      const d = new Date(funcionario.dataSolicitacao);
      if (filtroDataSolicitacaoInicio) {
        const inicio = new Date(filtroDataSolicitacaoInicio);
        if (d < inicio) return false;
      }
      if (filtroDataSolicitacaoFim) {
        const fim = new Date(filtroDataSolicitacaoFim);
        if (d > fim) return false;
      }
      return true;
    })();

    const matchDataConclusao = (() => {
      if (!filtroDataConclusaoInicio && !filtroDataConclusaoFim) return true;
      const encerramento = getDataEncerramento(funcionario);
      if (!encerramento) return false;
      const d = new Date(encerramento);
      if (filtroDataConclusaoInicio) {
        const inicio = new Date(filtroDataConclusaoInicio);
        if (d < inicio) return false;
      }
      if (filtroDataConclusaoFim) {
        const fim = new Date(filtroDataConclusaoFim);
        if (d > fim) return false;
      }
      return true;
    })();

    return (
      matchNome &&
      matchStatus &&
      matchContratoOrigem &&
      matchContratoDestino &&
      matchTipoSolicitacao &&
      matchNumeroSolicitacao &&
      matchSispat &&
      matchStatusRemanejamento &&
      matchDataSolicitacao &&
      matchDataConclusao &&
      funcionario.statusTarefas !== "CANCELADO" &&
      funcionario.statusPrestserv !== "CANCELADO"
    );
  });

  // Aplicar ordenação
  const funcionariosOrdenados = [...funcionariosFiltrados].sort((a, b) => {
    const { campo, direcao } = ordenacao;
    let valorA: any;
    let valorB: any;

    switch (campo) {
      case "solicitacaoId":
        valorA = parseInt(a.solicitacaoId) || 0;
        valorB = parseInt(b.solicitacaoId) || 0;
        break;
      case "nome":
        valorA = a.nome.toLowerCase();
        valorB = b.nome.toLowerCase();
        break;
      case "matricula":
        valorA = a.matricula;
        valorB = b.matricula;
        break;
      case "statusTarefas":
        valorA = a.statusTarefas;
        valorB = b.statusTarefas;
        break;
      default:
        return 0;
    }

    if (valorA < valorB) return direcao === "asc" ? -1 : 1;
    if (valorA > valorB) return direcao === "asc" ? 1 : -1;
    return 0;
  });

  // Calcular paginação
  const totalPaginas = Math.ceil(funcionariosOrdenados.length / itensPorPagina);
  const indiceInicio = (paginaAtual - 1) * itensPorPagina;
  const indiceFim = indiceInicio + itensPorPagina;
  const funcionariosPaginados = funcionariosOrdenados.slice(
    indiceInicio,
    indiceFim
  );

  // Resetar página atual quando filtros mudarem
  useEffect(() => {
    if (paginaAtual > totalPaginas && totalPaginas > 0) {
      setPaginaAtual(1);
    }
  }, [funcionariosOrdenados.length, totalPaginas, paginaAtual]);

  // Função para alterar ordenação
  const alterarOrdenacao = (campo: string) => {
    setOrdenacao((prev) => ({
      campo,
      direcao: prev.campo === campo && prev.direcao === "asc" ? "desc" : "asc",
    }));
  };

  const alterarOrdenacaoSolicitacoes = (campo: string) => {
    setOrdenacaoSolicitacoes((prev) => ({
      campo,
      direcao: prev.campo === campo && prev.direcao === "asc" ? "desc" : "asc",
    }));
  };

  // Agrupar funcionários filtrados por solicitação
  const funcionariosAgrupados = funcionariosFiltrados.reduce(
    (acc, funcionario) => {
      const solicitacaoId = funcionario.solicitacaoId;
      if (!acc[solicitacaoId]) {
        acc[solicitacaoId] = {
          solicitacaoId,
          tipoSolicitacao: funcionario.tipoSolicitacao,
          contratoOrigem: funcionario.contratoOrigem,
          contratoDestino: funcionario.contratoDestino,
          dataSolicitacao: funcionario.dataSolicitacao,
          createdAtGroup: funcionario.createdAt,
          updatedAtGroup: funcionario.updatedAt,
          funcionarios: [],
        };
      }
      acc[solicitacaoId].funcionarios.push(funcionario);
      // Atualizar datas agregadas
      try {
        const curCreated = new Date(
          acc[solicitacaoId].createdAtGroup
        ).getTime();
        const fCreated = new Date(funcionario.createdAt).getTime();
        if (!curCreated || (fCreated && fCreated < curCreated)) {
          acc[solicitacaoId].createdAtGroup = funcionario.createdAt;
        }
      } catch {}
      try {
        const curUpdated = new Date(
          acc[solicitacaoId].updatedAtGroup
        ).getTime();
        const fUpdated = new Date(funcionario.updatedAt).getTime();
        if (!curUpdated || (fUpdated && fUpdated > curUpdated)) {
          acc[solicitacaoId].updatedAtGroup = funcionario.updatedAt;
        }
      } catch {}
      return acc;
    },
    {} as Record<string, any>
  );
  const todasSolicitacoes = Object.values(funcionariosAgrupados);
  const todasSolicitacoesOrdenadas = [...todasSolicitacoes].sort(
    (a: any, b: any) => {
      const { campo, direcao } = ordenacaoSolicitacoes;
      let valorA: any;
      let valorB: any;
      switch (campo) {
        case "solicitacaoId":
          valorA = parseInt(a.solicitacaoId) || 0;
          valorB = parseInt(b.solicitacaoId) || 0;
          break;
        case "dataSolicitacao":
          valorA = new Date(a.dataSolicitacao).getTime() || 0;
          valorB = new Date(b.dataSolicitacao).getTime() || 0;
          break;
        case "createdAt":
          valorA = new Date(a.createdAtGroup).getTime() || 0;
          valorB = new Date(b.createdAtGroup).getTime() || 0;
          break;
        case "updatedAt":
          valorA = new Date(a.updatedAtGroup).getTime() || 0;
          valorB = new Date(b.updatedAtGroup).getTime() || 0;
          break;
        default:
          valorA = 0;
          valorB = 0;
      }
      if (valorA < valorB) return direcao === "asc" ? -1 : 1;
      if (valorA > valorB) return direcao === "asc" ? 1 : -1;
      return 0;
    }
  );

  const totalSolicitacoesAgrupadas = todasSolicitacoesOrdenadas.length;
  const solicitacoesFiltradas =
    activeTab === "solicitacao"
      ? todasSolicitacoesOrdenadas.slice(
          (paginaAtualSolicitacoes - 1) * itensPorPaginaSolicitacoes,
          (paginaAtualSolicitacoes - 1) * itensPorPaginaSolicitacoes +
            itensPorPaginaSolicitacoes
        )
      : todasSolicitacoesOrdenadas;

  const solicitacoesStatusDistribuicao = React.useMemo(() => {
    const inicio = dashboardPeriodoInicio
      ? new Date(dashboardPeriodoInicio)
      : null;
    const fim = dashboardPeriodoFim ? new Date(dashboardPeriodoFim) : null;
    const counts: Record<string, number> = {
      Pendente: 0,
      "Em andamento": 0,
      Concluído: 0,
    };
    solicitacoesFiltradas.forEach((s: any) => {
      const d = new Date(s.dataSolicitacao);
      if (inicio && d < inicio) return;
      if (fim && d > fim) return;
      const st = getSolicitacaoStatusFromFuncionarios(s.funcionarios);
      counts[st] = (counts[st] || 0) + 1;
    });
    return [
      { status: "Pendente", count: counts["Pendente"] || 0 },
      { status: "Em andamento", count: counts["Em andamento"] || 0 },
      { status: "Concluído", count: counts["Concluído"] || 0 },
    ];
  }, [
    solicitacoesFiltradas,
    getSolicitacaoStatusFromFuncionarios,
    dashboardPeriodoInicio,
    dashboardPeriodoFim,
  ]);

  const solicitacoesPorMesData = React.useMemo(() => {
    const inicio = dashboardPeriodoInicio
      ? new Date(dashboardPeriodoInicio)
      : null;
    const fim = dashboardPeriodoFim ? new Date(dashboardPeriodoFim) : null;
    const createdMap = new Map<string, number>();
    const concludedMap = new Map<string, number>();
    solicitacoesFiltradas.forEach((s: any) => {
      const createdDate = new Date(s.dataSolicitacao);
      if (inicio && createdDate < inicio) return;
      if (fim && createdDate > fim) return;
      const createdKey = toMonthKey(createdDate);
      createdMap.set(createdKey, (createdMap.get(createdKey) || 0) + 1);
      const conclDate = getSolicitacaoDataConclusao(s.funcionarios);
      if (conclDate) {
        if (inicio && conclDate < inicio) return;
        if (fim && conclDate > fim) return;
        const conclKey = toMonthKey(conclDate);
        concludedMap.set(conclKey, (concludedMap.get(conclKey) || 0) + 1);
      }
    });
    const keysSet = new Set<string>([
      ...createdMap.keys(),
      ...concludedMap.keys(),
    ]);
    const keysSorted = Array.from(keysSet).sort(
      (a, b) => parseMonthKey(a).getTime() - parseMonthKey(b).getTime()
    );
    const labels = keysSorted.map((k) => formatMonthLabel(parseMonthKey(k)));
    const createdSeries = keysSorted.map((k) => createdMap.get(k) || 0);
    const concludedSeries = keysSorted.map((k) => concludedMap.get(k) || 0);
    return { labels, createdSeries, concludedSeries };
  }, [
    solicitacoesFiltradas,
    getSolicitacaoDataConclusao,
    dashboardPeriodoInicio,
    dashboardPeriodoFim,
  ]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando funcionários...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Erro ao carregar dados
          </h3>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            👥 Funcionários em Remanejamento
          </h1>
          <p className="text-gray-600 text-sm">
            Visualização completa de todos os funcionários em remanejamento
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setFiltrosVisiveis(!filtrosVisiveis)}
            className="flex items-center space-x-2 px-3 py-2 text-sm text-slate-600 hover:text-gray-800 border border-gray-300 shadow-sm rounded-md hover:bg-gray-50 transition-colors"
          >
            <FunnelIcon className="h-4 w-4" />
            <span>
              {filtrosVisiveis ? "Recolher Filtros" : "Expandir Filtros"}
            </span>
            <ChevronDownIcon
              className={`h-4 w-4 transition-transform ${
                filtrosVisiveis ? "rotate-180" : ""
              }`}
            />
          </button>
          {hasAnyPermission([
            PERMISSIONS.ADMIN,
            PERMISSIONS.ACCESS_PLANEJAMENTO,
            PERMISSIONS.ACCESS_PLANEJAMENTO_GESTOR,
          ]) && (
            <button
              onClick={exportarParaExcel}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-slate-600 border border-gray-300 rounded-md hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2 shadow-sm transition-colors"
            >
              <DocumentArrowDownIcon className="w-4 h-4 mr-2" />
              Exportar Excel
            </button>
          )}
          {hasAnyPermission([
            PERMISSIONS.ADMIN,
            PERMISSIONS.ACCESS_PLANEJAMENTO,
            PERMISSIONS.ACCESS_PLANEJAMENTO_GESTOR,
          ]) && (
            <button
              onClick={criarSolicitacaoComSync}
              disabled={syncingFuncionarios}
              className="inline-flex items-center px-4 py-2 text-sm font-bold text-white bg-sky-500 border border-transparent rounded-md hover:bg-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {syncingFuncionarios ? (
                <>
                  <ArrowPathIcon className="w-4 h-4 mr-2 animate-spin" />
                  Atualizando funcionários...
                </>
              ) : (
                <>
                  <PlusIcon className="w-4 h-4 mr-2" />
                  Criar Solicitação
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Abas de Visualização */}
      <div className="bg-linear-to-r from-gray-800 to-slate-600 rounded-lg p-6">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab("nominal")}
            className={`text-white py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
              activeTab === "nominal"
                ? "border-sky-500 text-sky-300"
                : "border-transparent text-gray-500 hover:text-white-700 hover:border-white-300"
            }`}
          >
            <UsersIcon className="h-4 w-4" />
            <span>Visão por Funcionários</span>
          </button>
          <button
            onClick={() => setActiveTab("solicitacao")}
            className={`text-white py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
              activeTab === "solicitacao"
                ? "border-sky-500 text-sky-300"
                : "border-transparent text-gray-500 hover:text-white-700 hover:border-white-300"
            }`}
          >
            <DocumentTextIcon className="h-4 w-4" />
            <span>Visão por Solicitação</span>
          </button>
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`text-white py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
              activeTab === "dashboard"
                ? "border-sky-500 text-sky-300"
                : "border-transparent text-gray-500 hover:text-white-700 hover:border-white-300"
            }`}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            <span>Dashboard</span>
          </button>
        </nav>
      </div>

      {/* Dashboard */}
      {activeTab === "dashboard" && (
        <div className="mt-6">
          {loadingDashboard ? (
            <div className="h-full flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-sky-500 mx-auto"></div>
                <p className="mt-4 text-gray-500">Carregando dashboard...</p>
              </div>
            </div>
          ) : dashboardError ? (
            <div className="h-full flex items-center justify-center py-12">
              <div className="text-center">
                <div className="text-gray-600 text-xl mb-4">
                  Erro ao carregar dados
                </div>
                <p className="text-gray-500">{dashboardError}</p>
                <button
                  onClick={fetchDashboardData}
                  className="mt-4 px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-800 transition-colors"
                >
                  Tentar novamente
                </button>
              </div>
            </div>
          ) : !dashboardData ? (
            <div className="py-12 text-center text-gray-500">
              Nenhum dado encontrado
            </div>
          ) : (
            <div className="space-y-8 max-w-7xl mx-auto">
              {/* Filtros do Dashboard */}
              <div className="bg-white rounded-lg shadow border border-slate-400 p-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Início
                    </label>
                    <input
                      type="date"
                      value={dashboardPeriodoInicio}
                      onChange={(e) =>
                        setDashboardPeriodoInicio(e.target.value)
                      }
                      className="w-full px-3 py-2 text-sm border-slate-800 bg-slate-100 text-slate-500 rounded-md shadow-sm focus:border-slate-300 focus:ring-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Fim
                    </label>
                    <input
                      type="date"
                      value={dashboardPeriodoFim}
                      onChange={(e) => setDashboardPeriodoFim(e.target.value)}
                      className="w-full px-3 py-2 text-sm border-slate-800 bg-slate-100 text-slate-500 rounded-md shadow-sm focus:border-slate-300 focus:ring-slate-300"
                    />
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => {
                        setDashboardPeriodoInicio("");
                        setDashboardPeriodoFim("");
                      }}
                      className="px-3 py-2 text-xs border border-gray-300 rounded-md bg-white hover:bg-gray-50"
                    >
                      Limpar
                    </button>
                    <button
                      onClick={() => setActiveTab("solicitacao")}
                      className="px-3 py-2 text-xs border border-sky-600 text-sky-700 rounded-md bg-sky-50 hover:bg-sky-100"
                    >
                      Ver Solicitações
                    </button>
                    <button
                      onClick={() => setActiveTab("nominal")}
                      className="px-3 py-2 text-xs border border-slate-600 text-slate-700 rounded-md bg-slate-50 hover:bg-slate-100"
                    >
                      Ver Funcionários
                    </button>
                  </div>
                </div>
              </div>
              {/* Cards de Resumo - Design Minimalista */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
                {[
                  {
                    label: "Solicitações",
                    value: solicitacoesFiltradas.length,
                  },
                  ...solicitacoesStatusDistribuicao.map((s) => ({
                    label: `Solicitações ${s.status}`,
                    value: s.count,
                  })),
                  { label: "Funcionários", value: funcionarios.length },
                  ...funcionariosPorStatusRemanejamento.map((s) => ({
                    label: `Func. ${s.status}`,
                    value: s.count,
                  })),
                ]
                  .slice(0, 6)
                  .map((item, index) => (
                    <div
                      key={index}
                      className="bg-white-300 p-5 rounded-lg shadow-lg min-h-[120px] flex items-center border-1 border-slate-400"
                    >
                      <div className="flex items-center justify-between w-full">
                        <div>
                          <p className="text-sm text-slate-500">{item.label}</p>
                          <p className="text-2xl font-semibold text-sky-400">
                            {item.value}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>

              {/* Gráficos e Estatísticas - Design Elegante */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Gráfico de Status das Tarefas */}
                <div className="bg-white-300 rounded-lg shadow-lg border border-slate-400">
                  <div className="p-5 border-b border-slate-500">
                    <h2 className="text-lg font-medium text-slate-500">
                      Funcionários por Status (Remanejamento)
                    </h2>
                  </div>
                  <div className="p-6">
                    <div className="h-80">
                      {Array.isArray(funcionariosPorStatusRemanejamento) &&
                      funcionariosPorStatusRemanejamento.length > 0 ? (
                        <Doughnut
                          data={{
                            labels: funcionariosPorStatusRemanejamento.map(
                              (item: any) => item.status
                            ),
                            datasets: [
                              {
                                data: funcionariosPorStatusRemanejamento.map(
                                  (item: any) =>
                                    typeof item.count === "number"
                                      ? item.count
                                      : Number(item.count) || 0
                                ),
                                backgroundColor: [
                                  "#94A3B8", // slate-400
                                  "#0EA5E9", // sky-500
                                  "#64748B", // slate-500
                                  "#475569", // slate-600
                                  "#0284C7", // sky-600
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
                                callbacks: {
                                  label: function (context) {
                                    const total = context.dataset.data.reduce(
                                      (a: number, b: any) =>
                                        a + (typeof b === "number" ? b : 0),
                                      0
                                    );
                                    const percentage =
                                      total > 0
                                        ? (
                                            (context.parsed / total) *
                                            100
                                          ).toFixed(1)
                                        : "0";
                                    return `${context.label}: ${context.parsed} (${percentage}%)`;
                                  },
                                },
                              },
                              datalabels: {
                                formatter: (value: number, ctx) => {
                                  const total = ctx.dataset.data.reduce(
                                    (a: number, b: any) =>
                                      a + (typeof b === "number" ? b : 0),
                                    0
                                  );
                                  const percentage =
                                    total > 0
                                      ? ((value / total) * 100).toFixed(0)
                                      : "0";
                                  return value > 0 ? value : "";
                                },
                                color: "#ffffff",
                                font: {
                                  weight: "bold",
                                  size: 11,
                                },
                                textAlign: "center",
                              },
                            },
                            animation: {
                              animateRotate: true,
                              duration: 1000,
                            },
                          }}
                        />
                      ) : (
                        <div className="h-full flex items-center justify-center">
                          <p className="text-gray-500">
                            Nenhum dado disponível com os filtros atuais
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Gráfico de Status do Prestserv */}
                <div className="bg-white-300 rounded-lg shadow-lg border border-slate-400">
                  <div className="p-5 border-b border-slate-500">
                    <h2 className="text-lg font-medium text-slate-500">
                      Solicitações por Status
                    </h2>
                  </div>
                  <div className="p-6">
                    <div className="h-80">
                      {Array.isArray(solicitacoesStatusDistribuicao) &&
                      solicitacoesStatusDistribuicao.length > 0 ? (
                        <Bar
                          data={{
                            labels: solicitacoesStatusDistribuicao.map(
                              (item: any) => item.status
                            ),
                            datasets: [
                              {
                                label: "Funcionários",
                                data: solicitacoesStatusDistribuicao.map(
                                  (item: any) =>
                                    typeof item.count === "number"
                                      ? item.count
                                      : Number(item.count) || 0
                                ),
                                backgroundColor: [
                                  "rgba(14, 165, 233, 0.7)", // sky-500
                                  "rgba(100, 116, 139, 0.7)", // slate-500
                                  "rgba(148, 163, 184, 0.7)", // slate-400
                                  "rgba(71, 85, 105, 0.7)", // slate-600
                                  "rgba(2, 132, 199, 0.7)", // sky-600
                                ],
                                borderColor: [
                                  "#0EA5E9", // sky-500
                                  "#64748B", // slate-500
                                  "#94A3B8", // slate-400
                                  "#475569", // slate-600
                                  "#0284C7", // sky-600
                                ],
                                borderWidth: 1,
                                borderRadius: 4,
                                borderSkipped: false,
                                hoverBackgroundColor: [
                                  "rgba(14, 165, 233, 0.9)", // sky-500
                                  "rgba(100, 116, 139, 0.9)", // slate-500
                                  "rgba(148, 163, 184, 0.9)", // slate-400
                                  "rgba(71, 85, 105, 0.9)", // slate-600
                                  "rgba(2, 132, 199, 0.9)", // sky-600
                                ],
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
                                anchor: "end",
                                align: "top",
                                formatter: (value: number) => value,
                                font: {
                                  weight: "bold",
                                  size: 11,
                                },
                                color: "#475569",
                              },
                            },
                            scales: {
                              y: {
                                beginAtZero: true,
                                ticks: {
                                  stepSize: 1,
                                  font: {
                                    family: '"Inter", sans-serif',
                                    size: 11,
                                  },
                                  color: "#64748B",
                                },
                                grid: {
                                  color: "rgba(226, 232, 240, 0.6)",
                                },
                              },
                              x: {
                                ticks: {
                                  font: {
                                    family: '"Inter", sans-serif',
                                    size: 11,
                                  },
                                  color: "#64748B",
                                },
                                grid: {
                                  display: false,
                                },
                              },
                            },
                            animation: {
                              duration: 1000,
                            },
                          }}
                        />
                      ) : (
                        <div className="h-full flex items-center justify-center">
                          <p className="text-gray-500">
                            Nenhum dado disponível com os filtros atuais
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-8 mt-8">
                <div className="bg-white-300 rounded-lg shadow-lg border border-slate-400">
                  <div className="p-5 border-b border-slate-500">
                    <h2 className="text-lg font-medium text-slate-500">
                      Solicitações por Mês (Criadas vs Concluídas)
                    </h2>
                  </div>
                  <div className="p-6">
                    <div className="h-80">
                      {solicitacoesPorMesData.labels.length > 0 ? (
                        <Line
                          data={{
                            labels: solicitacoesPorMesData.labels,
                            datasets: [
                              {
                                label: "Criadas",
                                data: solicitacoesPorMesData.createdSeries,
                                borderColor: "#0EA5E9",
                                backgroundColor: "rgba(14, 165, 233, 0.1)",
                                fill: true,
                                tension: 0.3,
                                borderWidth: 2,
                              },
                              {
                                label: "Concluídas",
                                data: solicitacoesPorMesData.concludedSeries,
                                borderColor: "#64748B",
                                backgroundColor: "rgba(100, 116, 139, 0.1)",
                                fill: true,
                                tension: 0.3,
                                borderWidth: 2,
                              },
                            ],
                          }}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                              legend: { position: "bottom" },
                              tooltip: {
                                backgroundColor: "rgba(15, 23, 42, 0.8)",
                                titleColor: "#ffffff",
                                bodyColor: "#ffffff",
                                padding: 12,
                                cornerRadius: 4,
                                mode: "index",
                                intersect: false,
                              },
                            },
                            scales: {
                              y: {
                                beginAtZero: true,
                                ticks: { stepSize: 1 },
                                grid: { color: "rgba(226, 232, 240, 0.6)" },
                              },
                              x: { grid: { display: false } },
                            },
                          }}
                        />
                      ) : (
                        <div className="h-full flex items-center justify-center">
                          <p className="text-gray-500">
                            Nenhum dado disponível
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="bg-white-300 rounded-lg shadow-lg border border-slate-400">
                  <div className="p-5 border-b border-slate-500">
                    <h2 className="text-lg font-medium text-slate-500">
                      Funcionários por Contrato (Top 10)
                    </h2>
                  </div>
                  <div className="p-6 overflow-x-auto">
                    {funcionariosPorContratoStatus.length > 0 ? (
                      <table className="min-w-full divide-y divide-gray-300 border-slate-800 rounded-lg shadow-md overflow-hidden">
                        <thead className="bg-slate-700">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                              Contrato
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                              Concluídos
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                              Em andamento
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                              Pendentes
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                              Cancelados
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                              Total
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {funcionariosPorContratoStatus.map((item, idx) => (
                            <tr
                              key={idx}
                              className={
                                idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                              }
                            >
                              <td className="px-6 py-3 text-sm text-gray-700 font-medium">
                                {item.contrato}
                              </td>
                              <td className="px-6 py-3 text-sm text-green-700">
                                {item.concluido}
                              </td>
                              <td className="px-6 py-3 text-sm text-blue-700">
                                {item.andamento}
                              </td>
                              <td className="px-6 py-3 text-sm text-gray-700">
                                {item.pendente}
                              </td>
                              <td className="px-6 py-3 text-sm text-red-700">
                                {item.cancelado}
                              </td>
                              <td className="px-6 py-3 text-sm text-gray-900 font-semibold">
                                {item.total}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="h-full flex items-center justify-center">
                        <p className="text-gray-500">Nenhum dado disponível</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Gráfico de Funcionários por Responsável */}
              {/* <div className="bg-gradient-to-r from-gray-800 to-slate-600 rounded-lg shadow-lg border border-slate-800">
                <div className="p-5 border-b border-gray-100">
                  <h2 className="text-lg font-medium text-gray-700">
                    Funcionários por Responsável
                  </h2>
                </div>
                <div className="p-6">
                  <div className="h-80">
                    {dashboardData.funcionariosPorResponsavel &&
                    Object.keys(dashboardData.funcionariosPorResponsavel)
                      .length > 0 ? (
                      <Bar
                        data={{
                          labels: Object.keys(
                            dashboardData.funcionariosPorResponsavel
                          ).map((resp) =>
                            resp === "LOGISTICA"
                              ? "Logística"
                              : resp === "SETOR"
                              ? "Setores"
                              : resp
                          ),
                          datasets: [
                            {
                              label: "Funcionários",
                              data: Object.values(
                                dashboardData.funcionariosPorResponsavel
                              ),
                              backgroundColor: [
                                "rgba(100, 116, 139, 0.9)", // sky-500 (Logística)
                              ],
                              borderColor: [
                                "#0EA5E9", 
                              ],
                              borderWidth: 1,
                              borderRadius: 4,
                              borderSkipped: false,
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
                              anchor: "end",
                              align: "top",
                              formatter: (value: number) => value,
                              font: {
                                weight: "bold",
                                size: 11,
                              },
                              color: "#475569",
                            },
                          },
                          scales: {
                            y: {
                              beginAtZero: true,
                              ticks: {
                                stepSize: 1,
                                font: {
                                  family: '"Inter", sans-serif',
                                  size: 11,
                                },
                                color: "#64748B",
                              },
                              grid: {
                                color: "rgba(226, 232, 240, 0.6)",
                              },
                            },
                            x: {
                              ticks: {
                                font: {
                                  family: '"Inter", sans-serif',
                                  size: 11,
                                },
                                color: "#64748B",
                              },
                              grid: {
                                display: false,
                              },
                            },
                          },
                          animation: {
                            duration: 1000,
                          },
                        }}
                      />
                    ) : (
                      <div className="h-full flex items-center justify-center">
                        <p className="text-gray-500">
                          Nenhum dado disponível com os filtros atuais
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div> */}

              {/* Gráfico de Pendências por Setor */}
              {/* <div className="bg-white rounded-lg shadow border border-gray-100">
                <div className="p-5 border-b border-gray-100">
                  <h2 className="text-lg font-medium text-gray-700">
                    Pendências por Setor
                  </h2>
                </div>
                <div className="p-6">
                  <div className="h-80">
                    {dashboardData.pendenciasPorSetor &&
                    Object.keys(dashboardData.pendenciasPorSetor).length > 0 ? (
                      <Bar
                        data={{
                          labels: Object.keys(dashboardData.pendenciasPorSetor).map(
                            (setor) =>
                              setor === "LOGISTICA"
                                ? "Logística"
                                : setor === "SETOR"
                                ? "Setores"
                                : setor
                          ),
                          datasets: [
                            {
                              label: "Pendências",
                              data: Object.values(dashboardData.pendenciasPorSetor),
                              backgroundColor: [
                                "rgba(239, 68, 68, 0.7)", // red-500
                              ],
                              borderColor: [
                                "#EF4444", // red-500
                              ],
                              borderWidth: 1,
                              borderRadius: 4,
                              borderSkipped: false,
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
                              anchor: "end",
                              align: "top",
                              formatter: (value: number) => value,
                              font: {
                                weight: "bold",
                                size: 11,
                              },
                              color: "#475569",
                            },
                          },
                          scales: {
                            y: {
                              beginAtZero: true,
                              ticks: {
                                stepSize: 1,
                                font: {
                                  family: '"Inter", sans-serif',
                                  size: 11,
                                },
                                color: "#64748B",
                              },
                              grid: {
                                color: "rgba(226, 232, 240, 0.6)",
                              },
                            },
                            x: {
                              ticks: {
                                font: {
                                  family: '"Inter", sans-serif',
                                  size: 11,
                                },
                                color: "#64748B",
                              },
                              grid: {
                                display: false,
                              },
                            },
                          },
                          animation: {
                            duration: 1000,
                          },
                        }}
                      />
                    ) : (
                      <div className="h-full flex items-center justify-center">
                        <p className="text-gray-500">
                          Nenhum dado disponível com os filtros atuais
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div> */}
            </div>
          )}
        </div>
      )}

      {/* Filtros */}
      {filtrosVisiveis && activeTab !== "dashboard" && (
        <div className="bg-white rounded-lg shadow p-6 border-slate-400 border-1">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Filtros</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {/* Filtro por Nome/Matrícula */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Nome/Matrícula
              </label>
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={filtroNome}
                  onChange={(e) => setFiltroNome(e.target.value)}
                  placeholder="Buscar..."
                  className="w-full pl-10 pr-3 py-2 text-sm border-slate-800 bg-slate-100 text-slate-500 rounded-md shadow-sm focus:border-slate-300 focus:ring-slate-300"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Contrato Origem
              </label>
              <div className="relative dropdown-container">
                <button
                  onClick={() =>
                    setDropdownContratoOrigemOpen(!dropdownContratoOrigemOpen)
                  }
                  className="w-full pl-8 pr-8 py-2 text-sm border-slate-800 bg-slate-100 text-slate-500 rounded-md shadow-sm focus:border-slate-300 focus:ring-slate-300 text-left flex items-center justify-between"
                >
                  <FunnelIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <span className="truncate">
                    {filtroContratoOrigem.length === 0
                      ? "Todos"
                      : filtroContratoOrigem.length === 1
                      ? filtroContratoOrigem[0]
                      : `${filtroContratoOrigem.length} selecionados`}
                  </span>
                  <svg
                    className={`w-4 h-4 transition-transform ${
                      dropdownContratoOrigemOpen ? "rotate-180" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                {dropdownContratoOrigemOpen && (
                  <div className="absolute z-10 w-full mt-1 bg-slate-100 border border-slate-800 rounded-md shadow-lg">
                    <div className="p-2 space-y-2 max-h-48 overflow-y-auto">
                      {getContratosOrigem().map((contrato) => (
                        <label
                          key={contrato}
                          className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded"
                        >
                          <input
                            type="checkbox"
                            checked={filtroContratoOrigem.includes(contrato)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFiltroContratoOrigem([
                                  ...filtroContratoOrigem,
                                  contrato,
                                ]);
                              } else {
                                setFiltroContratoOrigem(
                                  filtroContratoOrigem.filter(
                                    (c) => c !== contrato
                                  )
                                );
                              }
                            }}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">
                            {contrato}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Filtro por Contrato Destino */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Contrato Destino
              </label>
              <div className="relative dropdown-container">
                <button
                  onClick={() =>
                    setDropdownContratoDestinoOpen(!dropdownContratoDestinoOpen)
                  }
                  className="w-full pl-8 pr-8 py-2 text-sm border-slate-800 bg-slate-100 text-slate-500 rounded-md shadow-sm focus:border-slate-300 focus:ring-slate-300 text-left flex items-center justify-between"
                >
                  <FunnelIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <span className="truncate">
                    {filtroContratoDestino.length === 0
                      ? "Todos"
                      : filtroContratoDestino.length === 1
                      ? filtroContratoDestino[0]
                      : `${filtroContratoDestino.length} selecionados`}
                  </span>
                  <svg
                    className={`w-4 h-4 transition-transform ${
                      dropdownContratoDestinoOpen ? "rotate-180" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                {dropdownContratoDestinoOpen && (
                  <div className="absolute z-10 w-full mt-1 bg-slate-100 border border-slate-800 rounded-md shadow-lg">
                    <div className="p-2 space-y-2 max-h-48 overflow-y-auto">
                      {getContratosDestino().map((contrato) => (
                        <label
                          key={contrato}
                          className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded"
                        >
                          <input
                            type="checkbox"
                            checked={filtroContratoDestino.includes(contrato)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFiltroContratoDestino([
                                  ...filtroContratoDestino,
                                  contrato,
                                ]);
                              } else {
                                setFiltroContratoDestino(
                                  filtroContratoDestino.filter(
                                    (c) => c !== contrato
                                  )
                                );
                              }
                            }}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">
                            {contrato}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Filtro por Sispat */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Sispat
              </label>
              <div className="relative dropdown-container">
                <button
                  onClick={() => setDropdownSispatOpen(!dropdownSispatOpen)}
                  className="w-full pl-8 pr-8 py-2 text-sm border-slate-800 bg-slate-100 text-slate-500 rounded-md shadow-sm focus:border-slate-300 focus:ring-slate-300 text-left flex items-center justify-between"
                >
                  <FunnelIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <span className="truncate">
                    {filtroSispat.length === 0
                      ? "Todos"
                      : filtroSispat.length === 1
                      ? filtroSispat[0] === "COM"
                        ? "Com"
                        : "Sem"
                      : `${filtroSispat.length} selecionados`}
                  </span>
                  <svg
                    className={`w-4 h-4 transition-transform ${
                      dropdownSispatOpen ? "rotate-180" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                {dropdownSispatOpen && (
                  <div className="absolute z-10 w-full mt-1 bg-slate-100 border border-slate-800 rounded-md shadow-lg">
                    <div className="p-2 space-y-2 max-h-48 overflow-y-auto">
                      {["COM", "SEM"].map((opt) => (
                        <label
                          key={opt}
                          className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded"
                        >
                          <input
                            type="checkbox"
                            checked={filtroSispat.includes(opt)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFiltroSispat([...filtroSispat, opt]);
                              } else {
                                setFiltroSispat(
                                  filtroSispat.filter((s) => s !== opt)
                                );
                              }
                            }}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">
                            {opt === "COM" ? "Com" : "Sem"} Sispat
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Filtro por Status Remanejamento */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Status Remanejamento
              </label>
              <div className="relative dropdown-container">
                <button
                  onClick={() =>
                    setDropdownStatusRemanejamentoOpen(
                      !dropdownStatusRemanejamentoOpen
                    )
                  }
                  className="w-full pl-8 pr-8 py-2 text-sm border-slate-800 bg-slate-100 text-slate-500 rounded-md shadow-sm focus:border-slate-300 focus:ring-slate-300 text-left flex items-center justify-between"
                >
                  <FunnelIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <span className="truncate">
                    {filtroStatusRemanejamento.length === 0
                      ? "Todos"
                      : `${filtroStatusRemanejamento.length} selecionados`}
                  </span>
                  <svg
                    className={`w-4 h-4 transition-transform ${
                      dropdownStatusRemanejamentoOpen ? "rotate-180" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                {dropdownStatusRemanejamentoOpen && (
                  <div className="absolute z-10 w-full mt-1 bg-slate-100 border border-slate-800 rounded-md shadow-lg">
                    <div className="p-2 space-y-2 max-h-48 overflow-y-auto">
                      {getStatusRemanejamentoOptions().map((status) => (
                        <label
                          key={status}
                          className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded"
                        >
                          <input
                            type="checkbox"
                            checked={filtroStatusRemanejamento.includes(status)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFiltroStatusRemanejamento([
                                  ...filtroStatusRemanejamento,
                                  status,
                                ]);
                              } else {
                                setFiltroStatusRemanejamento(
                                  filtroStatusRemanejamento.filter(
                                    (s) => s !== status
                                  )
                                );
                              }
                            }}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">
                            {status}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Filtro por Tipo de Solicitação */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Tipo de Solicitação
              </label>
              <div className="relative dropdown-container">
                <button
                  onClick={() =>
                    setDropdownTipoSolicitacaoOpen(!dropdownTipoSolicitacaoOpen)
                  }
                  className="w-full pl-8 pr-8 py-2 text-sm border-slate-800 bg-slate-100 text-slate-500 rounded-md shadow-sm focus:border-slate-300 focus:ring-slate-300 text-left flex items-center justify-between"
                >
                  <FunnelIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <span className="truncate">
                    {filtroTipoSolicitacao.length === 0
                      ? "Todos"
                      : filtroTipoSolicitacao.length === 1
                      ? filtroTipoSolicitacao[0]
                      : `${filtroTipoSolicitacao.length} selecionados`}
                  </span>
                  <svg
                    className={`w-4 h-4 transition-transform ${
                      dropdownTipoSolicitacaoOpen ? "rotate-180" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                {dropdownTipoSolicitacaoOpen && (
                  <div className="absolute z-10 w-full mt-1 bg-slate-100 border border-slate-800 rounded-md shadow-lg">
                    <div className="p-2 space-y-2 max-h-48 overflow-y-auto">
                      {getTiposSolicitacao().map((tipo) => (
                        <label
                          key={tipo}
                          className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded"
                        >
                          <input
                            type="checkbox"
                            checked={filtroTipoSolicitacao.includes(tipo)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFiltroTipoSolicitacao([
                                  ...filtroTipoSolicitacao,
                                  tipo,
                                ]);
                              } else {
                                setFiltroTipoSolicitacao(
                                  filtroTipoSolicitacao.filter(
                                    (t) => t !== tipo
                                  )
                                );
                              }
                            }}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">{tipo}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Filtro por Número de Solicitação */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Nº da Solicitação
              </label>
              <div className="relative dropdown-container">
                <FunnelIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 z-10" />
                <button
                  type="button"
                  onClick={() =>
                    setDropdownNumeroSolicitacaoOpen(
                      !dropdownNumeroSolicitacaoOpen
                    )
                  }
                  className="w-full pl-8 pr-8 py-2 text-sm border-slate-800 bg-slate-100 text-slate-500 rounded-md shadow-sm focus:border-slate-300 focus:ring-slate-300 text-left flex items-center justify-between"
                >
                  <span className="truncate">
                    {filtroNumeroSolicitacao.length === 0
                      ? "Todos"
                      : filtroNumeroSolicitacao.length === 1
                      ? filtroNumeroSolicitacao[0]
                      : `${filtroNumeroSolicitacao.length} selecionados`}
                  </span>
                  <ChevronDownIcon className="h-4 w-4 text-gray-400" />
                </button>
                {dropdownNumeroSolicitacaoOpen && (
                  <div className="absolute z-50 mt-1 w-full bg-slate-100 border border-slate-800 rounded-md shadow-lg max-h-60 overflow-auto">
                    {getNumerosSolicitacao().map((numero) => (
                      <label
                        key={numero}
                        className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={filtroNumeroSolicitacao.includes(numero)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFiltroNumeroSolicitacao((prev) => [
                                ...prev,
                                numero,
                              ]);
                            } else {
                              setFiltroNumeroSolicitacao((prev) =>
                                prev.filter((n) => n !== numero)
                              );
                            }
                          }}
                          className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="text-sm text-gray-700">{numero}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Filtro por Data de Solicitação */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Data Solicitação
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={filtroDataSolicitacaoInicio}
                  onChange={(e) =>
                    setFiltroDataSolicitacaoInicio(e.target.value)
                  }
                  className="w-full px-3 py-2 text-sm border-slate-800 bg-slate-100 text-slate-500 rounded-md shadow-sm focus:border-slate-300 focus:ring-slate-300"
                  placeholder="Início"
                />
                <input
                  type="date"
                  value={filtroDataSolicitacaoFim}
                  onChange={(e) => setFiltroDataSolicitacaoFim(e.target.value)}
                  className="w-full px-3 py-2 text-sm border-slate-800 bg-slate-100 text-slate-500 rounded-md shadow-sm focus:border-slate-300 focus:ring-slate-300"
                  placeholder="Fim"
                />
              </div>
            </div>

            {/* Filtro por Data de Conclusão */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Data Conclusão
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={filtroDataConclusaoInicio}
                  onChange={(e) => setFiltroDataConclusaoInicio(e.target.value)}
                  className="w-full px-3 py-2 text-sm border-slate-800 bg-slate-100 text-slate-500 rounded-md shadow-sm focus:border-slate-300 focus:ring-slate-300"
                  placeholder="Início"
                />
                <input
                  type="date"
                  value={filtroDataConclusaoFim}
                  onChange={(e) => setFiltroDataConclusaoFim(e.target.value)}
                  className="w-full px-3 py-2 text-sm border-slate-800 bg-slate-100 text-slate-500 rounded-md shadow-sm focus:border-slate-300 focus:ring-slate-300"
                  placeholder="Fim"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tags de Filtros Ativos - Sempre visíveis */}
      {obterTagsFiltrosAtivos().length > 0 && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-700">
              Filtros Aplicados:
            </h3>
            <button
              onClick={limparFiltros}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              Limpar todos
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {obterTagsFiltrosAtivos().map((tag, index) => (
              <span
                key={index}
                className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full border border-blue-200"
              >
                <span className="mr-1">{tag.label}</span>
                <button
                  onClick={() => removerFiltroIndividual(tag.tipo, tag.valor)}
                  className="ml-1 inline-flex items-center justify-center w-3 h-3 text-blue-600 hover:text-blue-800 hover:bg-blue-200 rounded-full transition-colors"
                  title="Remover filtro"
                >
                  <XMarkIcon className="w-2 h-2" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Conteúdo das Abas */}
      {activeTab === "nominal" && (
        <div className="bg-white  border-slate-400 border-1 rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table
              className="w-full divide-y divide-gray-200 rounded-lg shadow-md overflow-hidden"
              style={{ minWidth: "1000px" }}
            >
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    <button
                      onClick={() => alterarOrdenacao("nome")}
                      className="flex items-center space-x-1 hover:text-blue-600 transition-colors"
                    >
                      <span className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                        Nome
                      </span>
                      {ordenacao.campo === "nome" && (
                        <span className="text-blue-600">
                          {ordenacao.direcao === "asc" ? "↑" : "↓"}
                        </span>
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Matrícula
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Sispat
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    ID Solicitação
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Contrato Origem
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Contrato Destino
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Status Remanejamento
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Data Solicitação
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Data Conclusão
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Ação Necessária
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Responsável
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Progresso Setores
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Progresso
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Detalhes
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {funcionariosPaginados.map((funcionario, index) => (
                  <tr
                    key={funcionario.id}
                    className={`hover:bg-gray-50 transition-colors duration-150 ${
                      index % 2 === 0 ? "bg-white" : "bg-gray-50"
                    }`}
                    title={getTooltipMessage(funcionario)}
                  >
                    <td className="px-3 py-2 text-xs text-gray-900">
                      <div className="font-medium text-xs">
                        {funcionario.nome}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600">
                      {funcionario.matricula}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600">
                      {funcionario.sispat ?? "-"}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-700">
                      <span className="font-mono">
                        {funcionario.solicitacaoId}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-700">
                      <span className="font-mono">
                        {funcionario.contratoOrigem}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-700">
                      <span className="font-mono">
                        {funcionario.contratoDestino}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-700">
                      <span
                        className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${getRemanejamentoStatusColor(
                          getRemanejamentoStatus(funcionario)
                        )}`}
                      >
                        {getRemanejamentoStatus(funcionario)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-700">
                      {formatDateOrDash(funcionario.dataSolicitacao)}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-700">
                      {formatDateOrDash(getDataEncerramento(funcionario))}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-700">
                      <span
                        className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${getStatusColor(
                          funcionario.statusTarefas
                        )}`}
                      >
                        {getStatusGeralLabel(funcionario.statusTarefas)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-700 text-center">
                      <span
                        className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${getResponsavelColor(
                          getResponsavelAtual(funcionario)
                        )}`}
                      >
                        {getResponsavelAtual(funcionario)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-700">
                      <div className="space-y-1">
                        {["RH", "MEDICINA", "TREINAMENTO"].map((setor) => {
                          const progresso = funcionario.progressoPorSetor?.find(
                            (p) => p.setor === setor
                          );
                          const hasData = !!progresso && progresso.total > 0;
                          const nomeSetor =
                            setor === "RH"
                              ? "Recursos Humanos"
                              : setor === "MEDICINA"
                              ? "Medicina"
                              : "Treinamento";
                          return (
                            <div
                              key={setor}
                              className="flex items-center justify-between py-0.5"
                              title={
                                hasData
                                  ? `${nomeSetor}: ${progresso!.concluidas}/${
                                      progresso!.total
                                    } (${
                                      progresso!.percentual
                                    }%)\n\nLegenda:\n● Verde: Concluído\n● Amarelo: Em progresso\n● Cinza: Pendente`
                                  : `${nomeSetor}: Sem tarefas\n\nLegenda:\n● Verde: Concluído\n● Amarelo: Em progresso\n● Cinza: Pendente`
                              }
                            >
                              <div className="flex items-center space-x-1">
                                <span className="text-xs">
                                  {getSetorIcon(setor)}
                                </span>
                                <span className="text-xs font-medium text-gray-700">
                                  {nomeSetor}
                                </span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <span className="text-xs font-mono text-gray-600 bg-gray-100 px-1 rounded">
                                  {hasData
                                    ? `${progresso!.concluidas}/${
                                        progresso!.total
                                      }`
                                    : "0/0"}
                                </span>
                                <span
                                  className={`text-sm ${
                                    hasData
                                      ? getProgressColor(
                                          progresso!.concluidas,
                                          progresso!.total
                                        )
                                      : "text-gray-300"
                                  }`}
                                >
                                  {hasData
                                    ? getProgressIcon(
                                        progresso!.concluidas,
                                        progresso!.total
                                      )
                                    : "●"}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-700">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">
                          {getProgressoDisplay(funcionario)}%
                        </span>
                        <div className="w-24 h-2 bg-gray-200 rounded overflow-hidden">
                          <div
                            className="h-2 bg-blue-500"
                            style={{
                              width: `${getProgressoDisplay(funcionario)}%`,
                            }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-700">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            router.push(
                              `/prestserv/remanejamentos/${funcionario.id}`
                            )
                          }
                          className="px-2 py-1 text-[11px] bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          Detalhes
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Componente de Paginação */}
          {funcionariosFiltrados.length > 0 && (
            <div className="bg-white px-4 py-3 border-t border-gray-200 sm:px-6">
              <div className="flex items-center justify-between">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={() => setPaginaAtual(Math.max(1, paginaAtual - 1))}
                    disabled={paginaAtual === 1}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeftIcon className="h-5 w-5 mr-1" />
                    Anterior
                  </button>
                  <button
                    onClick={() =>
                      setPaginaAtual(Math.min(totalPaginas, paginaAtual + 1))
                    }
                    disabled={paginaAtual === totalPaginas}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Próximo
                    <ChevronRightIcon className="h-5 w-5 ml-1" />
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div className="flex items-center space-x-4">
                    <p className="text-sm text-gray-700">
                      Mostrando{" "}
                      <span className="font-medium">{indiceInicio + 1}</span>{" "}
                      até{" "}
                      <span className="font-medium">
                        {Math.min(indiceFim, funcionariosOrdenados.length)}
                      </span>{" "}
                      de{" "}
                      <span className="font-medium">
                        {funcionariosOrdenados.length}
                      </span>{" "}
                      funcionários
                    </p>
                    <div className="flex items-center space-x-2">
                      <label
                        htmlFor="itensPorPagina"
                        className="text-sm text-gray-700"
                      >
                        Itens por página:
                      </label>
                      <select
                        id="itensPorPagina"
                        value={itensPorPagina}
                        onChange={(e) => {
                          setItensPorPagina(Number(e.target.value));
                          setPaginaAtual(1);
                        }}
                        className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <nav
                      className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px"
                      aria-label="Pagination"
                    >
                      <button
                        onClick={() =>
                          setPaginaAtual(Math.max(1, paginaAtual - 1))
                        }
                        disabled={paginaAtual === 1}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="sr-only">Anterior</span>
                        <ChevronLeftIcon
                          className="h-5 w-5"
                          aria-hidden="true"
                        />
                      </button>

                      {/* Números das páginas - compactos com reticências */}
                      {(() => {
                        const delta = 1;
                        const range: number[] = [];
                        const result: (number | string)[] = [];
                        let last: number | undefined;

                        for (let i = 1; i <= totalPaginas; i++) {
                          if (
                            i === 1 ||
                            i === totalPaginas ||
                            (i >= paginaAtual - delta &&
                              i <= paginaAtual + delta)
                          ) {
                            range.push(i);
                          }
                        }

                        for (const i of range) {
                          if (last !== undefined) {
                            if (i - last === 2) {
                              result.push(last + 1);
                            } else if (i - last > 2) {
                              result.push("...");
                            }
                          }
                          result.push(i);
                          last = i;
                        }

                        return result;
                      })().map((item, idx) =>
                        typeof item === "string" ? (
                          <span
                            key={`ellipsis-${idx}`}
                            className="relative inline-flex items-center px-2 py-1 text-xs text-gray-400 select-none"
                          >
                            …
                          </span>
                        ) : (
                          <button
                            key={item}
                            onClick={() => setPaginaAtual(item)}
                            className={`relative inline-flex items-center px-2 py-1 border text-xs font-medium ${
                              item === paginaAtual
                                ? "z-10 bg-blue-50 border-blue-500 text-blue-600"
                                : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"
                            }`}
                            aria-label={`Ir para página ${item}`}
                          >
                            {item}
                          </button>
                        )
                      )}

                      <button
                        onClick={() =>
                          setPaginaAtual(
                            Math.min(totalPaginas, paginaAtual + 1)
                          )
                        }
                        disabled={paginaAtual === totalPaginas}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
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
          )}

          {funcionariosFiltrados.length === 0 && (
            <div className="text-center py-8">
              <div className="text-gray-500">
                <p className="text-base">📭 Nenhum funcionário encontrado</p>
                <p className="text-sm mt-1">
                  Tente ajustar os filtros de busca
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "solicitacao" && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              Visão por Solicitação
            </h2>
            <p className="text-gray-600">
              Tabela agrupada por solicitação de remanejamento
            </p>

            {/* Tabela de Solicitações */}
            <div className="mt-6 overflow-x-auto">
              <table className="w-full divide-y divide-gray-300 rounded-lg shadow-md overflow-hidden">
                <thead className="bg-white-100 border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase tracking-wider">
                      <button
                        onClick={() =>
                          alterarOrdenacaoSolicitacoes("solicitacaoId")
                        }
                        className="flex items-center space-x-1 hover:text-blue-600 transition-colors"
                      >
                        <span>Solicitação</span>
                        {ordenacaoSolicitacoes.campo === "solicitacaoId" && (
                          <span className="text-blue-600">
                            {ordenacaoSolicitacoes.direcao === "asc"
                              ? "↑"
                              : "↓"}
                          </span>
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase tracking-wider">
                      Contratos
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase tracking-wider">
                      Funcionários
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase tracking-wider">
                      <button
                        onClick={() =>
                          alterarOrdenacaoSolicitacoes("dataSolicitacao")
                        }
                        className="flex items-center space-x-1 hover:text-blue-600 transition-colors"
                      >
                        <span>Data</span>
                        {ordenacaoSolicitacoes.campo === "dataSolicitacao" && (
                          <span className="text-blue-600">
                            {ordenacaoSolicitacoes.direcao === "asc"
                              ? "↑"
                              : "↓"}
                          </span>
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase tracking-wider">
                      <button
                        onClick={() =>
                          alterarOrdenacaoSolicitacoes("createdAt")
                        }
                        className="flex items-center space-x-1 hover:text-blue-600 transition-colors"
                      >
                        <span>Criado</span>
                        {ordenacaoSolicitacoes.campo === "createdAt" && (
                          <span className="text-blue-600">
                            {ordenacaoSolicitacoes.direcao === "asc"
                              ? "↑"
                              : "↓"}
                          </span>
                        )}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {solicitacoesFiltradas.map(
                    (solicitacao: any, index: number) => {
                      const resumo = getFuncionariosResumo(
                        solicitacao.funcionarios
                      );
                      const statusSolicitacao =
                        getSolicitacaoStatusFromFuncionarios(
                          solicitacao.funcionarios
                        );
                      const isExpanded = expandedRows.has(
                        solicitacao.solicitacaoId
                      );

                      return (
                        <React.Fragment key={solicitacao.solicitacaoId}>
                          {/* Linha Principal */}
                          <tr
                            className={`hover:bg-gray-100 transition-colors duration-150 ${
                              index % 2 === 0 ? "bg-white" : "bg-gray-50"
                            }`}
                          >
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <button
                                  onClick={() =>
                                    toggleRow(solicitacao.solicitacaoId)
                                  }
                                  className="mr-2 p-1 hover:bg-gray-200 rounded transition-colors"
                                >
                                  {isExpanded ? (
                                    <ChevronDownIcon className="h-4 w-4 text-gray-500" />
                                  ) : (
                                    <ChevronRightIcon2 className="h-4 w-4 text-gray-500" />
                                  )}
                                </button>
                                <div className="text-sm">
                                  <div className="font-medium text-gray-900">
                                    ID GRUPO: {solicitacao.solicitacaoId}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    Tipo: {solicitacao.tipoSolicitacao}
                                  </div>
                                  <div className="text-xs text-gray-500 mt-1">
                                    <div>
                                      Criado:{" "}
                                      {new Date(
                                        solicitacao.funcionarios[0]?.createdAt
                                      ).toLocaleDateString("pt-BR", {
                                        day: "2-digit",
                                        month: "2-digit",
                                        year: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </div>
                                    <div>
                                      Atualizado:{" "}
                                      {new Date(
                                        solicitacao.funcionarios[0]?.updatedAt
                                      ).toLocaleDateString("pt-BR", {
                                        day: "2-digit",
                                        month: "2-digit",
                                        year: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                              <div className="space-y-1">
                                <div className="text-xs">
                                  <span className="font-medium">De:</span>{" "}
                                  {solicitacao.contratoOrigem}
                                </div>
                                <div className="text-xs">
                                  <span className="font-medium">Para:</span>{" "}
                                  {solicitacao.contratoDestino}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="space-y-1">
                                <span
                                  className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                                    statusSolicitacao
                                  )}`}
                                >
                                  {statusSolicitacao}
                                </span>
                                <div className="space-y-1">
                                  <div className="flex items-center space-x-2">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleChipClick(
                                          solicitacao.solicitacaoId,
                                          "Pendente"
                                        )
                                      }
                                      title={`Pendentes: ${resumo.pendentes} (${
                                        resumo.total > 0
                                          ? Math.round(
                                              (resumo.pendentes /
                                                resumo.total) *
                                                100
                                            )
                                          : 0
                                      }%)`}
                                      className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded bg-amber-100 text-amber-700 hover:bg-amber-200"
                                    >
                                      P {resumo.pendentes}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleChipClick(
                                          solicitacao.solicitacaoId,
                                          "Em andamento"
                                        )
                                      }
                                      title={`Em andamento: ${
                                        resumo.emAndamento
                                      } (${
                                        resumo.total > 0
                                          ? Math.round(
                                              (resumo.emAndamento /
                                                resumo.total) *
                                                100
                                            )
                                          : 0
                                      }%)`}
                                      className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded bg-sky-100 text-sky-700 hover:bg-sky-200"
                                    >
                                      A {resumo.emAndamento}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleChipClick(
                                          solicitacao.solicitacaoId,
                                          "Concluído"
                                        )
                                      }
                                      title={`Concluídos: ${
                                        resumo.concluidos
                                      } (${
                                        resumo.total > 0
                                          ? Math.round(
                                              (resumo.concluidos /
                                                resumo.total) *
                                                100
                                            )
                                          : 0
                                      }%)`}
                                      className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                    >
                                      C {resumo.concluidos}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                              <div className="flex items-center space-x-2">
                                <UsersIcon className="h-4 w-4 text-gray-400" />
                                <span>{resumo.total} funcionários</span>
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatDate(solicitacao.dataSolicitacao)}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatDate(solicitacao.createdAtGroup)}
                            </td>
                          </tr>

                          {/* Linhas Expandidas */}
                          {isExpanded &&
                            (expandedFilters[solicitacao.solicitacaoId]
                              ? solicitacao.funcionarios.filter(
                                  (f: FuncionarioTableData) => {
                                    const filtro =
                                      expandedFilters[
                                        solicitacao.solicitacaoId
                                      ];
                                    if (filtro === "Concluído")
                                      return isConclusaoDefinitiva(f);
                                    return getRemanejamentoStatus(f) === filtro;
                                  }
                                )
                              : solicitacao.funcionarios
                            ).map(
                              (
                                funcionario: FuncionarioTableData,
                                funcIndex: number
                              ) => (
                                <tr
                                  key={`${solicitacao.solicitacaoId}-${funcionario.id}`}
                                  className="bg-gray-50"
                                >
                                  <td className="px-4 py-3 pl-8 text-xs text-gray-600">
                                    <div className="space-y-1">
                                      <div className="font-medium text-gray-900">
                                        {funcionario.nome}
                                      </div>
                                      <div className="text-[11px] text-gray-600">
                                        Matrícula:{" "}
                                        <span className="font-mono">
                                          {funcionario.matricula}
                                        </span>
                                      </div>
                                      <div className="text-[11px] text-gray-600">
                                        Sispat:{" "}
                                        <span className="font-mono">
                                          {funcionario.sispat ?? "-"}
                                        </span>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-xs text-gray-700">
                                    <div className="space-y-1">
                                      <div className="text-[11px]">
                                        <span className="font-medium">De:</span>{" "}
                                        {funcionario.contratoOrigem}
                                      </div>
                                      <div className="text-[11px]">
                                        <span className="font-medium">
                                          Para:
                                        </span>{" "}
                                        {funcionario.contratoDestino}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-xs text-gray-700">
                                    <span
                                      className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${getRemanejamentoStatusColor(
                                        getRemanejamentoStatus(funcionario)
                                      )}`}
                                    >
                                      {getRemanejamentoStatus(funcionario)}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-xs text-gray-700">
                                    <div className="space-y-1">
                                      <div className="text-[11px]">
                                        Solicitação:{" "}
                                        {formatDateOrDash(
                                          funcionario.dataSolicitacao
                                        )}
                                      </div>
                                      <div className="text-[11px]">
                                        Conclusão:{" "}
                                        {formatDateOrDash(
                                          getDataEncerramento(funcionario)
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-xs text-gray-700">
                                    <div className="flex items-center space-x-2">
                                      <span className="font-medium">
                                        {getProgressoDisplay(funcionario)}%
                                      </span>
                                      <div className="w-20 h-2 bg-gray-200 rounded overflow-hidden">
                                        <div
                                          className="h-2 bg-blue-500"
                                          style={{
                                            width: `${getProgressoDisplay(
                                              funcionario
                                            )}%`,
                                          }}
                                        ></div>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )
                            )}
                        </React.Fragment>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>

            {/* Paginação */}
            {totalSolicitacoesAgrupadas > 0 && (
              <div className="mt-4 px-4 pb-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-700">
                    <span>
                      Mostrando
                      <span className="font-medium ml-1">
                        {Math.min(
                          (paginaAtualSolicitacoes - 1) *
                            itensPorPaginaSolicitacoes +
                            1,
                          totalSolicitacoesAgrupadas
                        )}
                      </span>{" "}
                      até{" "}
                      <span className="font-medium">
                        {Math.min(
                          paginaAtualSolicitacoes * itensPorPaginaSolicitacoes,
                          totalSolicitacoesAgrupadas
                        )}
                      </span>{" "}
                      de{" "}
                      <span className="font-medium">
                        {totalSolicitacoesAgrupadas}
                      </span>{" "}
                      solicitações
                    </span>
                  </div>
                  <nav
                    className="inline-flex -space-x-px rounded-md shadow-sm"
                    aria-label="Pagination"
                  >
                    <button
                      onClick={() =>
                        setPaginaAtualSolicitacoes((prev) =>
                          Math.max(prev - 1, 1)
                        )
                      }
                      disabled={paginaAtualSolicitacoes === 1}
                      className="relative inline-flex items-center px-2 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-l-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="sr-only">Anterior</span>
                      <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
                    </button>
                    {Array.from(
                      {
                        length: Math.ceil(
                          totalSolicitacoesAgrupadas /
                            itensPorPaginaSolicitacoes
                        ),
                      },
                      (_, i) => i + 1
                    ).map((numeroPagina) => {
                      const totalPaginas = Math.ceil(
                        totalSolicitacoesAgrupadas / itensPorPaginaSolicitacoes
                      );
                      if (
                        numeroPagina === 1 ||
                        numeroPagina === totalPaginas ||
                        (numeroPagina >= paginaAtualSolicitacoes - 1 &&
                          numeroPagina <= paginaAtualSolicitacoes + 1)
                      ) {
                        return (
                          <button
                            key={numeroPagina}
                            onClick={() =>
                              setPaginaAtualSolicitacoes(numeroPagina)
                            }
                            className={`relative inline-flex items-center px-4 py-2 text-sm font-medium border ${
                              numeroPagina === paginaAtualSolicitacoes
                                ? "bg-blue-50 border-blue-500 text-blue-600"
                                : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"
                            }`}
                          >
                            {numeroPagina}
                          </button>
                        );
                      } else if (
                        numeroPagina === paginaAtualSolicitacoes - 2 ||
                        numeroPagina === paginaAtualSolicitacoes + 2
                      ) {
                        return (
                          <span
                            key={numeroPagina}
                            className="relative inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700"
                          >
                            ...
                          </span>
                        );
                      }
                      return null;
                    })}
                    <button
                      onClick={() =>
                        setPaginaAtualSolicitacoes((prev) =>
                          Math.min(
                            prev + 1,
                            Math.ceil(
                              totalSolicitacoesAgrupadas /
                                itensPorPaginaSolicitacoes
                            )
                          )
                        )
                      }
                      disabled={
                        paginaAtualSolicitacoes >=
                        Math.ceil(
                          totalSolicitacoesAgrupadas /
                            itensPorPaginaSolicitacoes
                        )
                      }
                      className="relative inline-flex items-center px-2 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-r-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
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
            )}
          </div>
        </div>
      )}

      {/* Modal de Confirmação */}
      {showConfirmModal && selectedFuncionario && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                  <PlusIcon className="w-5 h-5 text-gray-600" />
                </div>
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-gray-900">
                  Aprovar ou Rejeitar
                </h3>
                <p className="text-sm text-gray-500">
                  Decida sobre a solicitação do funcionário
                </p>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-sm text-gray-700 mb-4">
                Funcionário: <strong>{selectedFuncionario.nome}</strong>
              </p>
              <p className="text-sm text-gray-700">
                Escolha uma das opções abaixo:
              </p>
            </div>

            <div className="space-y-3 mb-6">
              <button
                onClick={aprovarSolicitacao}
                disabled={approvingStatus}
                className="w-full flex items-center p-3 border border-gray-200 rounded-lg hover:bg-green-50 hover:border-green-300 transition-colors focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex-shrink-0">
                  <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                    {approvingStatus ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                    ) : (
                      <PlusIcon className="w-4 h-4 text-green-600" />
                    )}
                  </div>
                </div>
                <div className="ml-3 flex-1 text-left">
                  <h4 className="text-sm font-medium text-gray-900">
                    {approvingStatus ? "Aprovando..." : "Aprovar"}
                  </h4>
                  <p className="text-xs text-gray-500">
                    Aprovar solicitação e gerar tarefas padrão
                  </p>
                </div>
              </button>

              <button
                onClick={rejeitarSolicitacao}
                disabled={rejectingStatus}
                className="w-full flex items-center p-3 border border-gray-200 rounded-lg hover:bg-red-50 hover:border-red-300 transition-colors focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex-shrink-0">
                  <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center">
                    {rejectingStatus ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                    ) : (
                      <XMarkIcon className="w-4 h-4 text-red-600" />
                    )}
                  </div>
                </div>
                <div className="ml-3 flex-1 text-left">
                  <h4 className="text-sm font-medium text-gray-900">
                    {rejectingStatus ? "Rejeitando..." : "Rejeitar"}
                  </h4>
                  <p className="text-xs text-gray-500">
                    Rejeitar solicitação sem gerar tarefas
                  </p>
                </div>
              </button>
            </div>

            <div className="flex justify-end">
              <button
                onClick={cancelarAprovacao}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Tarefas Padrão */}
      {showTarefasModal && selectedFuncionario && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                    <PlusIcon className="w-5 h-5 text-gray-600" />
                  </div>
                </div>
                <div className="ml-3">
                  <h3 className="text-lg font-medium text-gray-900">
                    Gerar Tarefas Padrão
                  </h3>
                  <p className="text-sm text-gray-500">
                    Solicitação aprovada! Selecione os setores para gerar
                    tarefas
                  </p>
                </div>
              </div>
              <button
                onClick={cancelarAprovacao}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-6">
              <p className="text-sm text-gray-700 mb-4">
                Selecione os setores para os quais deseja gerar tarefas padrão:
              </p>

              <div className="space-y-3">
                {["RH", "MEDICINA", "TREINAMENTO"].map((setor) => (
                  <label key={setor} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={selectedSetores.includes(setor)}
                      onChange={() => toggleSetor(setor)}
                      className="h-4 w-4 text-gray-600 focus:ring-gray-500 border-gray-300 rounded"
                    />
                    <span className="ml-3 text-sm text-gray-700">{setor}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={cancelarAprovacao}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1"
              >
                Não Gerar Tarefas
              </button>
              <button
                onClick={gerarTarefasPadrao}
                disabled={generatingTarefas || selectedSetores.length === 0}
                className="px-4 py-2 text-sm font-medium text-white bg-gray-600 border border-transparent rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {generatingTarefas ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Gerando...
                  </>
                ) : (
                  "Gerar Tarefas"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Lista de Tarefas */}
      <ListaTarefasModal
        isOpen={showListaTarefasModal}
        onClose={fecharListaTarefas}
        funcionario={
          funcionarioSelecionadoTarefas
            ? {
                id: funcionarioSelecionadoTarefas.id,
                nome: funcionarioSelecionadoTarefas.nome,
                matricula: funcionarioSelecionadoTarefas.matricula,
              }
            : null
        }
        statusPrestserv={funcionarioSelecionadoTarefas?.statusPrestserv}
        onTarefaReprovada={handleTarefaReprovada}
      />
    </div>
  );
}
