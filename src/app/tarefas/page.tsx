"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { read, utils, writeFile } from "xlsx";
import { toast } from "react-hot-toast";
import { useAuth } from "@/app/hooks/useAuth";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from "chart.js";
import { Doughnut, Bar } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);
import {
  MagnifyingGlassIcon,
  UserGroupIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
  ChevronRightIcon,
  DocumentArrowDownIcon,
  ChatBubbleLeftRightIcon,
  PencilIcon,
  TrashIcon,
  XMarkIcon,
  PlusIcon,
  EyeIcon,
} from "@heroicons/react/24/outline";
import ClipboardDocumentCheckIcon from "@heroicons/react/24/solid/ClipboardDocumentCheckIcon";

// Importando tipos corretos da estrutura hierárquica
import {
  SolicitacaoRemanejamento,
  RemanejamentoFuncionario,
  TarefaRemanejamento,
  StatusTarefa,
  StatusPrestserv,
  TipoSolicitacao,
} from "@/types/remanejamento-funcionario";

interface Observacao {
  id: string;
  texto: string;
  criadoPor: string;
  criadoEm: string;
  modificadoPor?: string;
  modificadoEm?: string;
}

// Interface para tarefa com estrutura hierárquica correta
// Removida interface Tarefa artificial - usando diretamente TarefaRemanejamento da API
// A estrutura hierárquica é: SolicitacaoRemanejamento > RemanejamentoFuncionario > TarefaRemanejamento

interface ProgressoGeral {
  total: number;
  pendentes: number;
  emAndamento: number;
  concluidas: number;
  atrasadas: number;
  reprovadas: number;
}

interface Funcionario {
  id: string;
  nome: string;
  matricula: string;
  funcao: string;
  status: string;
  statusPrestserv: string;
  emMigracao: boolean;
}

// Usando a interface correta da estrutura hierárquica
interface FuncionarioRemanejamento extends Omit<SolicitacaoRemanejamento, 'tipo'> {
  // Campos adicionais para compatibilidade se necessário
  tipo?: TipoSolicitacao;
}

// Usando a interface correta da estrutura hierárquica
interface NovaTarefa {
  tipo: string;
  descricao?: string;
  prioridade: string;
  dataLimite?: string;
  dataVencimento?: string;
  remanejamentoFuncionarioId: string;
  responsavel: string;
}

export default function TarefasPage() {
  const router = useRouter();
  const { usuario } = useAuth();
  const searchParams = useSearchParams();

  // Estados principais
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [setorAtual, setSetorAtual] = useState<string | null>(null);

  // Filtros
  const [filtroNome, setFiltroNome] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroPrioridade, setFiltroPrioridade] = useState("");
  const [filtroSetor, setFiltroSetor] = useState("");
  const [filtroContrato, setFiltroContrato] = useState("");
  // Novo: filtros por data de vencimento (intervalo)
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");
  // Novos filtros: tipo e categoria de data limite, e ordenação por data limite
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroDataCategoria, setFiltroDataCategoria] = useState<"" | "VENCIDOS" | "A_VENCER" | "NO_PRAZO" | "SEM_DATA">("");
  const [ordenacaoDataLimite, setOrdenacaoDataLimite] = useState<"" | "asc" | "desc">("");
  const [filtroDataExata, setFiltroDataExata] = useState("");

  // Refs para evitar re-renderizações
  const filtroNomeRef = useRef<HTMLInputElement>(null);

  // Paginação
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [itensPorPagina] = useState(20);

  // Estados para criação de tarefas
  const [mostrarFormTarefa, setMostrarFormTarefa] = useState(false);
  const [funcionariosRemanejamento, setFuncionariosRemanejamento] = useState<
    FuncionarioRemanejamento[]
  >([]);
  const [loadingFuncionarios, setLoadingFuncionarios] = useState(false);
  const [criandoTarefa, setCriandoTarefa] = useState(false);
  const [solicitacaoSelecionada, setSolicitacaoSelecionada] =
    useState<FuncionarioRemanejamento | null>(null);
  const [tiposTarefaPadrao, setTiposTarefaPadrao] = useState<{
    [setor: string]: { tipo: string; descricao: string }[];
  }>({});
  const [loadingTiposTarefa, setLoadingTiposTarefa] = useState(false);
  const [novaTarefa, setNovaTarefa] = useState<NovaTarefa>({
    tipo: "",
    descricao: "",
    prioridade: "MEDIA",
    dataLimite: "",
    remanejamentoFuncionarioId: "",
    responsavel: "RH", // Padrão inicial
  });

  // Ref para o campo de descrição
  const descricaoRef = useRef<HTMLTextAreaElement>(null);

  // Estados para modal de conclusão de tarefa
  const [tarefaSelecionada, setTarefaSelecionada] =
    useState<TarefaRemanejamento | null>(null);
  const [mostrarModalConcluir, setMostrarModalConcluir] = useState(false);
  const [concluindoTarefa, setConcluindoTarefa] = useState(false);

  // Estados para o modal de observações
  const [mostrarModalObservacoes, setMostrarModalObservacoes] = useState(false);
const [observacoes, setObservacoes] = useState<Observacao[]>([]);
const [carregandoObservacoes, setCarregandoObservacoes] = useState(false);
const [novaObservacao, setNovaObservacao] = useState("");
const [adicionandoObservacao, setAdicionandoObservacao] = useState(false);
// Mapa de contagem de observações por tarefa
const [observacoesCount, setObservacoesCount] = useState<Record<string, number>>({});

  const [funcionariosExpandidos, setFuncionariosExpandidos] = useState<
    Set<string>
  >(new Set());

  // Paginação específica para visão por funcionários
  const [paginaAtualFuncionarios, setPaginaAtualFuncionarios] = useState(1);
  const [itensPorPaginaFuncionarios, setItensPorPaginaFuncionarios] = useState(5);

  // Estados para tabs
  const [activeTab, setActiveTab] = useState<"funcionarios" | "dashboard">(
    "funcionarios"
  );
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Estados para dashboard
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [observacaoEditando, setObservacaoEditando] = useState<string | null>(
    null
  );
  const [textoEditado, setTextoEditado] = useState("");
  const [editandoObservacao, setEditandoObservacao] = useState(false);
  const [excluindoObservacao, setExcluindoObservacao] = useState(false);
  const [novaDataLimite, setNovaDataLimite] = useState("");
  const [justificativaDataLimite, setJustificativaDataLimite] = useState("");
  const [erroNovaDataLimite, setErroNovaDataLimite] = useState<string>("");
  const [erroJustificativaDataLimite, setErroJustificativaDataLimite] = useState<string>("");
  const [atualizandoDataLimite, setAtualizandoDataLimite] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState<"observacoes" | "dataLimite">(
    "observacoes"
  );

  useEffect(() => {
    // Detectar o setor com base nos parâmetros da URL atual
    const setorParam = searchParams.get("setor");

    if (setorParam === "rh") {
      setSetorAtual("RH");
      setFiltroSetor("RH");
    } else if (setorParam === "medicina") {
      setSetorAtual("MEDICINA");
      setFiltroSetor("MEDICINA");
    } else if (setorParam === "treinamento") {
      setSetorAtual("TREINAMENTO");
      setFiltroSetor("TREINAMENTO");
    } else {
      setSetorAtual(null);
    }
  }, [searchParams]);

  // Efeito separado para buscar tarefas quando o setor muda
  useEffect(() => {
    fetchTodasTarefas();
  }, [setorAtual]); // Removed fetchTodasTarefas from dependency array

  useEffect(() => {
    setPaginaAtual(1);
  }, [filtroNome, filtroStatus, filtroPrioridade, filtroSetor, filtroContrato]);

  // Trabalhar diretamente com dados hierárquicos da API
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoRemanejamento[]>(
    []
  );

  const fetchTodasTarefas = async () => {
    try {
      setLoading(true);

      const response = await fetch(
        "/api/logistica/remanejamentos?filtrarProcesso=false"
      );

      if (!response.ok) {
        throw new Error("Erro ao carregar dados de remanejamentos");
      }

      const data = await response.json();
      // console.log("Dados da API:", data);

      // Armazenar dados hierárquicos diretamente sem transformação
      setSolicitacoes(data);
    } catch (err) {
      console.error("Erro ao buscar dados:", err);
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  };

  const fetchFuncionariosRemanejamento = async () => {
    try {
      setLoadingFuncionarios(true);
      // Adicionar parâmetro filtrarProcesso=true para filtrar apenas funcionários em processo
      const response = await fetch(
        "/api/logistica/remanejamentos?filtrarProcesso=true"
      );
      if (!response.ok) {
        throw new Error("Erro ao carregar funcionários");
      }
      const data = await response.json();
      setFuncionariosRemanejamento(data || []);
    } catch (error) {
      console.error("Erro ao buscar funcionários:", error);
      toast.error("Erro ao carregar funcionários de remanejamento");
    } finally {
      setLoadingFuncionarios(false);
    }
  };

  const criarTarefa = async () => {
    try {
      setCriandoTarefa(true);
      const response = await fetch("/api/logistica/tarefas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(novaTarefa),
      });

      if (!response.ok) {
        throw new Error("Erro ao criar tarefa");
      }

      toast.success("Tarefa criada com sucesso!");
      fecharFormTarefa();
      fetchTodasTarefas();
    } catch (error) {
      console.error("Erro ao criar tarefa:", error);
      toast.error("Erro ao criar tarefa");
    } finally {
      setCriandoTarefa(false);
    }
  };

  const fetchTiposTarefaPadrao = async () => {
    try {
      setLoadingTiposTarefa(true);
      const response = await fetch("/api/tarefas-padrao?ativo=true");
      if (!response.ok) {
        throw new Error("Erro ao carregar tipos de tarefa");
      }
      const data = await response.json();

      // Organizar por setor
      const tiposPorSetor: {
        [setor: string]: { tipo: string; descricao: string }[];
      } = {};
      data.forEach((tarefa: any) => {
        if (!tiposPorSetor[tarefa.setor]) {
          tiposPorSetor[tarefa.setor] = [];
        }
        tiposPorSetor[tarefa.setor].push({
          tipo: tarefa.tipo,
          descricao: tarefa.descricao,
        });
      });

      setTiposTarefaPadrao(tiposPorSetor);
    } catch (error) {
      console.error("Erro ao buscar tipos de tarefa:", error);
      toast.error("Erro ao carregar tipos de tarefa");
    } finally {
      setLoadingTiposTarefa(false);
    }
  };

  const fecharFormTarefa = () => {
    setMostrarFormTarefa(false);
    setSolicitacaoSelecionada(null);
    setNovaTarefa({
      tipo: "",
      descricao: "",
      prioridade: "MEDIA",
      dataLimite: "",
      remanejamentoFuncionarioId: "",
      responsavel: "RH",
    });
  };

  const getRemanejamentosFiltrados = () => {
    if (!solicitacoes.length) return [];

    const remanejamentosFiltrados: RemanejamentoFuncionario[] = [];

    solicitacoes.forEach((solicitacao: SolicitacaoRemanejamento) => {
      solicitacao.funcionarios?.forEach(
        (remanejamento: RemanejamentoFuncionario) => {
          // Aplicar filtros no nível do funcionário
          const nomeFuncionario = remanejamento.funcionario?.nome || "";
          const matchNome = nomeFuncionario
            .toLowerCase()
            .includes(filtroNome.toLowerCase());

          if (!matchNome) return;

          // Filtro por contrato (origem ou destino)
          const matchContrato =
            !filtroContrato ||
            solicitacao.contratoOrigemId?.toString() === filtroContrato ||
            solicitacao.contratoDestinoId?.toString() === filtroContrato;

          if (!matchContrato) return;

          // Filtrar tarefas dentro do remanejamento
          const tarefasFiltradas =
            remanejamento.tarefas?.filter((tarefa: TarefaRemanejamento) => {
              // Lógica especial para status concluído
              let matchStatus = !filtroStatus;
              if (filtroStatus === "CONCLUIDO") {
                matchStatus =
                  tarefa.status === "CONCLUIDO" ||
                  tarefa.status === "CONCLUIDA";
              } else if (filtroStatus) {
                matchStatus = tarefa.status === filtroStatus;
              }

              const matchPrioridade =
                !filtroPrioridade || tarefa.prioridade === filtroPrioridade;
              const matchSetor =
                !filtroSetor || tarefa.responsavel === filtroSetor;

              // Novo: filtro por categoria de data limite (aplica apenas a PENDENTES)
              let matchDataCategoria = true;
              if (filtroDataCategoria) {
                if (tarefa.status !== "PENDENTE") {
                  matchDataCategoria = true;
                } else {
                  const hoje = new Date();
                  hoje.setHours(0, 0, 0, 0);
                  const dataLimiteDate = tarefa.dataLimite
                    ? new Date(tarefa.dataLimite)
                    : null;

                  if (filtroDataCategoria === "SEM_DATA") {
                    matchDataCategoria = !dataLimiteDate;
                  } else if (!dataLimiteDate) {
                    matchDataCategoria = false;
                  } else {
                    const diffDias = Math.floor(
                      (dataLimiteDate.getTime() - hoje.getTime()) / 86400000
                    );
                    const limiteA_Vencer = 7; // próximos 7 dias
                    if (filtroDataCategoria === "VENCIDOS") {
                      matchDataCategoria = dataLimiteDate < hoje;
                    } else if (filtroDataCategoria === "A_VENCER") {
                      matchDataCategoria = diffDias >= 0 && diffDias <= limiteA_Vencer;
                    } else if (filtroDataCategoria === "NO_PRAZO") {
                      matchDataCategoria = diffDias > limiteA_Vencer;
                    }
                  }
                }
              }

              // Novo: filtro por tipo
              const matchTipo = !filtroTipo || tarefa.tipo === filtroTipo;

              // Novo: filtro por data limite exata (compara dia civil em UTC)
              let matchDataExata = true;
              if (filtroDataExata) {
                if (!tarefa.dataLimite) {
                  matchDataExata = false;
                } else {
                  const d = new Date(tarefa.dataLimite);
                  const y = d.getUTCFullYear();
                  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
                  const day = String(d.getUTCDate()).padStart(2, "0");
                  const dataSomenteDia = `${y}-${m}-${day}`;
                  matchDataExata = dataSomenteDia === filtroDataExata;
                }
              }

              return (
                matchStatus &&
                matchPrioridade &&
                matchSetor &&
                matchDataCategoria &&
                matchTipo &&
                matchDataExata
              );
            }) || [];

          // Só incluir remanejamento se tem tarefas após filtro
          if (tarefasFiltradas.length > 0) {
            remanejamentosFiltrados.push({
              ...remanejamento,
              tarefas: tarefasFiltradas,
              // Manter referência à solicitação
              solicitacao: solicitacao,
            } as RemanejamentoFuncionario & { solicitacao: SolicitacaoRemanejamento });
          }
        }
      );
    });

    return remanejamentosFiltrados;
  };

  const getRemanejamentosPaginados = () => {
    const remanejamentosFiltrados = getRemanejamentosFiltrados();

    // Ordenar remanejamentos por nome do funcionário
    const remanejamentosOrdenados = [...remanejamentosFiltrados].sort(
      (a, b) => {
        const nomeA = a.funcionario?.nome || "";
        const nomeB = b.funcionario?.nome || "";
        return nomeA.localeCompare(nomeB);
      }
    );

    const inicio = (paginaAtual - 1) * itensPorPagina;
    const fim = inicio + itensPorPagina;
    return remanejamentosOrdenados.slice(inicio, fim);
  };

  const getProgressoGeral = (): ProgressoGeral => {
    const remanejamentosFiltrados = getRemanejamentosFiltrados();

    // Extrair todas as tarefas dos remanejamentos filtrados
    const todasTarefas: TarefaRemanejamento[] = [];
    remanejamentosFiltrados.forEach((remanejamento) => {
      if (remanejamento.tarefas) {
        todasTarefas.push(...remanejamento.tarefas);
      }
    });

    const total = todasTarefas.length;
    const pendentes = todasTarefas.filter(
      (t) => t.status === "PENDENTE"
    ).length;
    const emAndamento = todasTarefas.filter(
      (t) => t.status === "EM_ANDAMENTO"
    ).length;
    // Removido status EM_ANDAMENTO conforme solicitação
    const concluidas = todasTarefas.filter(
      (t) => t.status === "CONCLUIDO" || t.status === "CONCLUIDA"
    ).length;
    const reprovadas = todasTarefas.filter(
      (t) => t.status === "REPROVADO"
    ).length;

    // Calcular tarefas atrasadas (pendentes ou em andamento com data limite no passado)
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0); // Normalizar para início do dia

    const atrasadas = todasTarefas.filter((tarefa) => {
      if (
        tarefa.status === "CONCLUIDO" ||
        tarefa.status === "CONCLUIDA" ||
        !tarefa.dataLimite
      )
        return false;
      const dataLimite = new Date(tarefa.dataLimite);
      dataLimite.setHours(0, 0, 0, 0); // Normalizar para início do dia
      return dataLimite < hoje;
    }).length;

    return { total, pendentes, emAndamento, concluidas, atrasadas, reprovadas };
  };

  const getTarefasFiltradas = () => {
    const remanejamentosFiltrados = getRemanejamentosFiltrados();

    // Extrair todas as tarefas dos remanejamentos filtrados
    const todasTarefas: (TarefaRemanejamento & { funcionario?: any })[] = [];
    remanejamentosFiltrados.forEach((remanejamento) => {
      if (remanejamento.tarefas) {
        // Add funcionario data to each tarefa
        const tarefasComFuncionario = remanejamento.tarefas.map(tarefa => ({
          ...tarefa,
          funcionario: remanejamento.funcionario
        }));
        todasTarefas.push(...tarefasComFuncionario);
      }
    });

    return todasTarefas;
  };

  const exportarParaExcel = () => {
    const tarefasFiltradas = getTarefasFiltradas();

    const dadosExcel = tarefasFiltradas.map((tarefa) => ({
      ID: tarefa.id,
      Tipo: tarefa.tipo,
      Descrição: tarefa.descricao,
      Status: tarefa.status,
      Prioridade: tarefa.prioridade,
      "Data Limite": tarefa.dataLimite
        ? new Date(tarefa.dataLimite).toLocaleDateString("pt-BR")
        : "N/A",
      "Data Criação": new Date(tarefa.dataCriacao).toLocaleDateString("pt-BR"),
      Funcionário:
        tarefa.funcionario?.nome ||
        "N/A",
      Matrícula:
        tarefa.funcionario?.matricula ||
        "N/A",
      Função:
        tarefa.funcionario?.funcao ||
        "N/A",
      "Setor Responsável": tarefa.responsavel,
    }));

    const wb = utils.book_new();
      const ws = utils.json_to_sheet(dadosExcel);
      utils.book_append_sheet(wb, ws, "Tarefas");
      writeFile(wb, "Tarefas_Exportadas.xlsx");

    toast.success("Tarefas exportadas com sucesso!");
  };

  // Função para carregar contagem de observações sob demanda para as tarefas do grupo
  const carregarObservacoesCountParaGrupo = async (tarefas: TarefaRemanejamento[]) => {
    const ids = Array.from(new Set((tarefas || []).map((t) => t.id)));
    if (ids.length === 0) return;
    try {
      const qs = encodeURIComponent(ids.join(","));
      const resp = await fetch(`/api/logistica/tarefas/observacoes/count?ids=${qs}`);
      if (!resp.ok) throw new Error("Erro ao contar observações");
      const data = await resp.json();
      const normalized = Object.fromEntries(
        Object.entries(data || {}).map(([k, v]) => [String(k), v as number])
      );
      setObservacoesCount((prev) => ({ ...prev, ...normalized }));
    } catch (err) {
      console.error("Erro ao contar observações:", err);
    }
  };

  // Função para expandir/contrair funcionários
  const toggleExpandirFuncionario = async (chaveGrupo: string, tarefas: TarefaRemanejamento[]) => {
    const novoExpandido = new Set(funcionariosExpandidos);
    const isExpanded = novoExpandido.has(chaveGrupo);
    if (isExpanded) {
      novoExpandido.delete(chaveGrupo);
    } else {
      novoExpandido.add(chaveGrupo);
      // Carregar contagem de observações apenas ao expandir
      carregarObservacoesCountParaGrupo(tarefas);
    }
    setFuncionariosExpandidos(novoExpandido);
  };

  // Função para obter remanejamentos com suas tarefas para a visão por funcionários
  const getRemanejamentosParaVisaoFuncionarios = () => {
    const remanejamentosFiltrados = getRemanejamentosFiltrados();

    const funcionariosComTarefas = remanejamentosFiltrados
      .map((remanejamento) => {
        // Filtrar tarefas por setor se especificado
        const tarefasFiltradas =
          remanejamento.tarefas?.filter(
            (tarefa: TarefaRemanejamento) =>
              !setorAtual || tarefa.responsavel === setorAtual
          ) || [];

        // Ordenar tarefas: por Data Limite quando selecionado; caso contrário, por status
        tarefasFiltradas.sort(
          (a: TarefaRemanejamento, b: TarefaRemanejamento) => {
            if (ordenacaoDataLimite) {
              const aTime = a.dataLimite ? new Date(a.dataLimite).getTime() : Number.POSITIVE_INFINITY;
              const bTime = b.dataLimite ? new Date(b.dataLimite).getTime() : Number.POSITIVE_INFINITY;
              const diff = aTime - bTime;
              return ordenacaoDataLimite === "asc" ? diff : -diff;
            }
            // Função para obter prioridade do status
            const getStatusPriority = (status: string) => {
              if (status === "REPROVADO") return 0; // Maior prioridade
              if (status === "EM_ANDAMENTO") return 1;
              if (status === "PENDENTE") return 2;
              if (status === "CONCLUIDA" || status === "CONCLUIDO") return 3; // Menor prioridade
              return 4; // Outros status
            };

            const priorityA = getStatusPriority(a.status);
            const priorityB = getStatusPriority(b.status);
            
            return priorityA - priorityB;
          }
        );

        return {
          funcionario: remanejamento.funcionario!,
          tarefas: tarefasFiltradas,
          remanejamento: remanejamento,
          solicitacao: (remanejamento as any).solicitacao,
        };
      })
      .filter((item) => item.tarefas.length > 0);

    // Ordenar funcionários baseado no status das suas tarefas
    funcionariosComTarefas.sort((a, b) => {
      const tarefasConcluidas_A = a.tarefas.filter(t => t.status === "CONCLUIDA" || t.status === "CONCLUIDO").length;
      const tarefasConcluidas_B = b.tarefas.filter(t => t.status === "CONCLUIDA" || t.status === "CONCLUIDO").length;
      
      const totalTarefas_A = a.tarefas.length;
      const totalTarefas_B = b.tarefas.length;
      
      // Verificar se tem tarefas reprovadas
      const hasReprovado_A = a.tarefas.some(t => t.status === "REPROVADO");
      const hasReprovado_B = b.tarefas.some(t => t.status === "REPROVADO");
      
      // Calcular se está concluído (todas as tarefas concluídas)
      const isConcluido_A = tarefasConcluidas_A === totalTarefas_A && totalTarefas_A > 0;
      const isConcluido_B = tarefasConcluidas_B === totalTarefas_B && totalTarefas_B > 0;
      
      // Calcular se está em andamento (algumas tarefas concluídas, mas não todas)
      const isEmAndamento_A = tarefasConcluidas_A > 0 && tarefasConcluidas_A < totalTarefas_A && !hasReprovado_A;
      const isEmAndamento_B = tarefasConcluidas_B > 0 && tarefasConcluidas_B < totalTarefas_B && !hasReprovado_B;
      
      // Calcular se está pendente (nenhuma tarefa concluída e não tem reprovadas)
      const isPendente_A = tarefasConcluidas_A === 0 && !hasReprovado_A;
      const isPendente_B = tarefasConcluidas_B === 0 && !hasReprovado_B;
      
      // Prioridade de ordenação:
      // 1. Reprovado (tem pelo menos uma tarefa reprovada)
      // 2. Em andamento (algumas tarefas concluídas, mas não todas, sem reprovadas)
      // 3. Pendente (nenhuma tarefa concluída e não tem reprovadas)
      // 4. Concluído (todas as tarefas concluídas)
      
      if (hasReprovado_A && !hasReprovado_B) return -1;
      if (!hasReprovado_A && hasReprovado_B) return 1;
      
      if (!hasReprovado_A && !hasReprovado_B) {
        if (isEmAndamento_A && !isEmAndamento_B) return -1;
        if (!isEmAndamento_A && isEmAndamento_B) return 1;
        
        if (!isEmAndamento_A && !isEmAndamento_B) {
          if (isPendente_A && !isPendente_B) return -1;
          if (!isPendente_A && isPendente_B) return 1;
          
          if (isConcluido_A && !isConcluido_B) return 1;
          if (!isConcluido_A && isConcluido_B) return -1;
        }
      }
      
      // Se mesmo status, ordenar por nome
      return a.funcionario.nome.localeCompare(b.funcionario.nome);
    });

    return funcionariosComTarefas;
  };

  // Função para verificar se funcionário demitido precisa de atenção
  const funcionarioDemitidoPrecisaAtencao = useCallback(
    (funcionario: Funcionario) => {
      if (funcionario?.status === "DEMITIDO") {
        return (
          funcionario.emMigracao || funcionario.statusPrestserv === "ATIVO"
        );
      }
      return false;
    },
    []
  );

  // Função para obter o tipo de alerta para funcionário demitido
  const getTipoAlertaDemitido = useCallback((funcionario: any) => {
    // Removido check de status pois funcionario não tem essa propriedade
    return null;
  }, []);

  // Estado para data de vencimento no modal de conclusão
  const [dataVencimento, setDataVencimento] = useState("");
  const [erroDataVencimento, setErroDataVencimento] = useState<string>("");

  // Funções para o modal de conclusão de tarefa
  const abrirModalConcluir = (tarefa: TarefaRemanejamento) => {
    setTarefaSelecionada(tarefa);
    setDataVencimento(""); // Resetar a data de vencimento
    setErroDataVencimento("");
    setMostrarModalConcluir(true);
  };

  const fecharModalConcluir = () => {
    setTarefaSelecionada(null);
    setDataVencimento("");
    setErroDataVencimento("");
    setMostrarModalConcluir(false);
  };

  const concluirTarefa = async () => {
    if (!tarefaSelecionada) return;

    try {
      // Validação local da data de vencimento (apenas se não for responsabilidade do RH)
      if (tarefaSelecionada.responsavel !== "RH") {
        if (!dataVencimento) {
           setErroDataVencimento("Informe a data de vencimento.");
           return;
         }
         const hoje = new Date();
         const dt = new Date(`${dataVencimento}T00:00:00`);
         const hojeDateOnly = new Date(`${hoje.toISOString().split("T")[0]}T00:00:00`);
         const diffMs = dt.getTime() - hojeDateOnly.getTime();
         const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
         if (diffDays < 30) {
           setErroDataVencimento("A data deve ser pelo menos 30 dias após hoje.");
           return;
         }
      }

      setConcluindoTarefa(true);
      const response = await fetch(
        `/api/logistica/tarefas/${tarefaSelecionada.id}/concluir`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dataVencimento: tarefaSelecionada.responsavel !== "RH" ? (dataVencimento || null) : null,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const msg = errorData?.error || "Erro ao concluir tarefa";
        toast.error(msg);
        throw new Error(msg);
      }

      toast.success("Tarefa concluída com sucesso!");
      fecharModalConcluir();
      fetchTodasTarefas(); // Atualizar a lista de tarefas
    } catch (error) {
      console.error("Erro ao concluir tarefa:", error);
      // Evitar mensagem duplicada se já mostramos a do backend
      if (error instanceof Error && error.message.startsWith("Data de vencimento")) {
        // já mostrado
      } else {
        toast.error("Erro ao concluir tarefa");
      }
    } finally {
      setConcluindoTarefa(false);
    }
  };

  // Funções para o modal de observações
  const abrirModalObservacoes = async (tarefa: TarefaRemanejamento) => {
    setTarefaSelecionada(tarefa);
    setMostrarModalObservacoes(true);
    // Definir a aba ativa como "dataLimite" por padrão (ocultando Adicionar Observação por enquanto)
    setAbaAtiva("dataLimite");
    // Inicializar a data limite atual (se existir)
    if (tarefa.dataLimite) {
      const dt = new Date(tarefa.dataLimite);
      const y = dt.getUTCFullYear();
      const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
      const d = String(dt.getUTCDate()).padStart(2, "0");
      setNovaDataLimite(`${y}-${m}-${d}`);
    } else {
      setNovaDataLimite("");
    }
    setJustificativaDataLimite("");
    setErroNovaDataLimite("");
    setErroJustificativaDataLimite("");
    await buscarObservacoes(tarefa.id);
  };

  const fecharModalObservacoes = () => {
    setTarefaSelecionada(null);
    setMostrarModalObservacoes(false);
    setObservacoes([]);
    setNovaObservacao("");
    setNovaDataLimite("");
    setJustificativaDataLimite("");
    setErroNovaDataLimite("");
    setErroJustificativaDataLimite("");
    // Atualizar a lista de tarefas para refletir as mudanças nas observações
    fetchTodasTarefas();
  };

  const buscarObservacoes = async (tarefaId: string) => {
    try {
      setCarregandoObservacoes(true);
      const response = await fetch(
        `/api/logistica/tarefas/${tarefaId}/observacoes`
      );

      if (!response.ok) {
        throw new Error("Erro ao buscar observações");
      }

      const data = await response.json();
      setObservacoes(data);
    } catch (error) {
      console.error("Erro ao buscar observações:", error);
      toast.error("Erro ao carregar observações");
    } finally {
      setCarregandoObservacoes(false);
    }
  };

  const adicionarObservacao = async () => {
    if (!tarefaSelecionada || !novaObservacao.trim()) {
      toast.error("Digite uma observação");
      return;
    }

    try {
      setAdicionandoObservacao(true);
      const response = await fetch(
        `/api/logistica/tarefas/${tarefaSelecionada.id}/observacoes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            texto: novaObservacao,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Erro na resposta:", errorData);
        toast.error(errorData.error || "Erro ao adicionar observação");
        return;
      }

      toast.success("Observação adicionada com sucesso!");
      setNovaObservacao("");
      await buscarObservacoes(tarefaSelecionada.id);
      // Não fechamos o modal, apenas atualizamos as observações
    } catch (error) {
      console.error("Erro ao adicionar observação:", error);
      toast.error("Erro ao adicionar observação");
    } finally {
      setAdicionandoObservacao(false);
    }
  };

  const iniciarEdicaoObservacao = (observacao: Observacao) => {
    setObservacaoEditando(observacao.id);
    setTextoEditado(observacao.texto);
  };

  const cancelarEdicaoObservacao = () => {
    setObservacaoEditando(null);
    setTextoEditado("");
  };

  const salvarEdicaoObservacao = async (observacaoId: string) => {
    if (!tarefaSelecionada || !textoEditado.trim()) {
      toast.error("Digite uma observação");
      return;
    }

    try {
      setEditandoObservacao(true);
      const response = await fetch(
        `/api/logistica/tarefas/${tarefaSelecionada.id}/observacoes/${observacaoId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            texto: textoEditado,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Erro na resposta:", errorData);
        toast.error(errorData.error || "Erro ao editar observação");
        return;
      }

      toast.success("Observação editada com sucesso!");
      setObservacaoEditando(null);
      setTextoEditado("");
      await buscarObservacoes(tarefaSelecionada.id);
    } catch (error) {
      console.error("Erro ao editar observação:", error);
      toast.error("Erro ao editar observação");
    } finally {
      setEditandoObservacao(false);
    }
  };

  const excluirObservacao = async (observacaoId: string) => {
    if (!tarefaSelecionada) return;

    if (!confirm("Tem certeza que deseja excluir esta observação?")) {
      return;
    }

    try {
      setExcluindoObservacao(true);
      const response = await fetch(
        `/api/logistica/tarefas/${tarefaSelecionada.id}/observacoes/${observacaoId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Erro na resposta:", errorData);
        toast.error(errorData.error || "Erro ao excluir observação");
        return;
      }

      toast.success("Observação excluída com sucesso!");
      await buscarObservacoes(tarefaSelecionada.id);
    } catch (error) {
      console.error("Erro ao excluir observação:", error);
      toast.error("Erro ao excluir observação");
    } finally {
      setExcluindoObservacao(false);
    }
  };

  const atualizarDataLimite = async () => {
    if (!tarefaSelecionada) return;

    // Reset erros
    setErroNovaDataLimite("");
    setErroJustificativaDataLimite("");

    // Validar data mínima (hoje) e campo obrigatório
    const hoje = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    const hojeStr = `${hoje.getFullYear()}-${pad(hoje.getMonth() + 1)}-${pad(hoje.getDate())}`;

    if (!novaDataLimite) {
      setErroNovaDataLimite("Selecione a nova data limite.");
      return;
    }
    if (novaDataLimite < hojeStr) {
      setErroNovaDataLimite("A data limite não pode ser anterior à data atual.");
      return;
    }

    if (!justificativaDataLimite.trim()) {
      setErroJustificativaDataLimite("A justificativa é obrigatória.");
      return;
    }

    try {
      setAtualizandoDataLimite(true);

      // Formatar as datas para exibição
      const dataAnterior = tarefaSelecionada.dataLimite
        ? (() => {
            const dt = new Date(tarefaSelecionada.dataLimite);
            const dd = String(dt.getUTCDate()).padStart(2, "0");
            const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
            const yyyy = String(dt.getUTCFullYear());
            return `${dd}/${mm}/${yyyy}`;
          })()
        : "Não definida";
      const partes = novaDataLimite.split("-");
      const dataNova = `${partes[2]}/${partes[1]}/${partes[0]}`;

      // Criar texto da observação automática
      const textoObservacao = `Data limite alterada: ${dataAnterior} → ${dataNova}\n\nJustificativa: ${justificativaDataLimite}`;

      // Atualizar a data limite da tarefa
      const [y, m, d] = novaDataLimite.split("-").map(Number);
      const dataLimiteUtcNoonIso = new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).toISOString();

      const responseDataLimite = await fetch(
        `/api/logistica/tarefas/${tarefaSelecionada.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dataLimite: dataLimiteUtcNoonIso,
          }),
        }
      );

      if (!responseDataLimite.ok) {
        throw new Error("Erro ao atualizar data limite");
      }

      // Adicionar observação automática
      const responseObservacao = await fetch(
        `/api/logistica/tarefas/${tarefaSelecionada.id}/observacoes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            texto: textoObservacao,
            criadoPor: usuario?.nome || "Sistema",
          }),
        }
      );

      if (!responseObservacao.ok) {
        throw new Error("Erro ao adicionar observação");
      }

      toast.success("Data limite atualizada com sucesso!");

      // Atualizar a tarefa selecionada com a nova data
      if (tarefaSelecionada) {
        setTarefaSelecionada({
          ...tarefaSelecionada,
          dataLimite: dataLimiteUtcNoonIso,
        });
      }

      // Limpar campos
      setJustificativaDataLimite("");

      // Atualizar observações
      await buscarObservacoes(tarefaSelecionada.id);
    } catch (error) {
      console.error("Erro ao atualizar data limite:", error);
      toast.error("Erro ao atualizar data limite");
    } finally {
      setAtualizandoDataLimite(false);
    }
  };

  const handleSelecionarFuncionario = (remanejamentoFuncionarioId: string) => {
    // Encontrar a solicitação que contém este funcionário
    const funcionarioSelecionado = funcionariosRemanejamento
      .flatMap((solicitacao) => solicitacao.funcionarios)
      .find((f) => f?.id === remanejamentoFuncionarioId);

    if (funcionarioSelecionado) {
      // Encontrar a solicitação que contém este funcionário
      const solicitacao = funcionariosRemanejamento.find((s) =>
        s.funcionarios?.some((f) => f?.id === remanejamentoFuncionarioId)
      );

      if (solicitacao) {
        setSolicitacaoSelecionada(solicitacao);
        setNovaTarefa((prev) => ({
          ...prev,
          remanejamentoFuncionarioId,
        }));
      }
    }
  };

  const handleSubmitTarefa = (e: React.FormEvent) => {
    e.preventDefault();

    // Validações básicas
    if (!novaTarefa.tipo) {
      toast.error("Selecione um tipo de tarefa");
      return;
    }

    if (!novaTarefa.descricao) {
      toast.error("Informe uma descrição para a tarefa");
      return;
    }

    if (!novaTarefa.remanejamentoFuncionarioId) {
      toast.error("Selecione um funcionário");
      return;
    }

    criarTarefa();
  };
  // Componente de UI para o progresso geral
  const ProgressoGeralComponent = () => {
    const progresso = getProgressoGeral();

    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-linear-to-r from-gray-100 to-slate-100 p-4 rounded-lg shadow-lg min-h-[96px] flex items-center border-1 border-slate-400">
          <div className="flex items-center justify-between w-full">
            <div>
              <p className="text-xs text-slate-300">Pendentes</p>
              <p className="text-2xl font-semibold text-sky-300">
                {progresso.pendentes}
                {progresso.atrasadas > 0 ? (
                  <span className="text-xs text-red-200 ml-2">
                    ( {progresso.atrasadas} atrasada
                    {progresso.atrasadas !== 1 ? "s" : ""} )
                  </span>
                ) : (
                  <span className="text-xs text-slate-400 mt-1 opacity-0 block">
                    Nenhuma atrasada
                  </span>
                )}
              </p>
            </div>
            <ClockIcon className="h-10 w-10 text-slate-400" />
          </div>
        </div>

        <div className="bg-linear-to-r from-gray-100 to-slate-100 p-4 rounded-lg shadow-lg min-h-[96px] flex items-center border-1 border-slate-400">
          <div className="flex items-center justify-between w-full">
            <div>
              <p className="text-xs text-slate-300">Concluídas</p>
              <p className="text-2xl font-semibold text-sky-300">
                {progresso.concluidas}
              </p>
            </div>
            <CheckCircleIcon className="h-10 w-10 text-slate-400" />
          </div>
        </div>

        <div className="bg-linear-to-r from-gray-100 to-slate-100 p-4 rounded-lg shadow-lg min-h-[96px] flex items-center border-1 border-slate-400">
          <div className="flex items-center justify-between w-full">
            <div>
              <p className="text-xs text-slate-300">Reprovadas</p>
              <p className="text-2xl font-semibold text-sky-300">
                {progresso.reprovadas}
              </p>
            </div>
            <ExclamationCircleIcon className="h-10 w-10 text-red-400" />
          </div>
        </div>

        <div className="bg-linear-to-r from-gray-100 to-slate-100 p-4 rounded-lg shadow-lg min-h-[96px] flex items-center border-1 border-slate-400">
          <div className="flex items-center justify-between w-full">
            <div>
              <p className="text-xs text-slate-300">Total</p>
              <p className="text-2xl font-semibold text-sky-300">
                {progresso.total}
              </p>
            </div>
            <UserGroupIcon className="h-10 w-10 text-slate-400" />
          </div>
        </div>
      </div>
    );
  };
  // Componente para o filtro de tarefas
  const FiltroTarefas = () => {
    // Determinar o número de colunas com base na presença do filtro de setor
    const numColunas = setorAtual ? 4 : 5;

    // Contratos disponíveis (origem/destino) para seleção
    const contratosOptions = React.useMemo(() => {
      const map = new Map<number, { id: number; numero: string; nome: string }>();
      solicitacoes.forEach((s) => {
        if (s.contratoOrigem) {
          map.set(s.contratoOrigem.id, {
            id: s.contratoOrigem.id,
            numero: s.contratoOrigem.numero,
            nome: s.contratoOrigem.nome,
          });
        }
        if (s.contratoDestino) {
          map.set(s.contratoDestino.id, {
            id: s.contratoDestino.id,
            numero: s.contratoDestino.numero,
            nome: s.contratoDestino.nome,
          });
        }
      });
      return Array.from(map.values()).sort((a, b) => a.numero.localeCompare(b.numero));
    }, [solicitacoes]);

    // Tipos de tarefas disponíveis (para filtro de Tipo)
    const tiposOptions = React.useMemo(() => {
      const set = new Set<string>();
      solicitacoes.forEach((s) => {
        s.funcionarios?.forEach((rem) => {
          rem.tarefas?.forEach((t) => {
            if (t.tipo) set.add(t.tipo);
          });
        });
      });
      return Array.from(set.values()).sort((a, b) => a.localeCompare(b));
    }, [solicitacoes]);

    return (
      <div className="bg-white border-slate-400 border-1 p-4 rounded-lg shadow-lg mb-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-medium text-slate-800">Filtros</h3>
          <button
            className="hover:bg-gray-200 text-gray-400 px-3 py-1.5 rounded-md transition-colors duration-200 flex items-center gap-2"
            onClick={() => {
              // Limpar todos os filtros
              if (filtroNomeRef.current) {
                filtroNomeRef.current.value = "";
              }
              setFiltroNome("");
              setFiltroStatus("");
              setFiltroPrioridade("");
              setFiltroSetor("");
              setFiltroContrato("");
              // Limpar filtros antigos de intervalo
              setFiltroDataInicio("");
              setFiltroDataFim("");
              // Limpar novos filtros
              setFiltroTipo("");
              setFiltroDataCategoria("");
              setOrdenacaoDataLimite("");
              setFiltroDataExata("");
              setPaginaAtual(1);
            }}
          >
            <XMarkIcon className="h-5 w-5" />
            Limpar Filtros
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-800 mb-1">
               Status
             </label>
             <select
               className="w-full h-9 rounded-md border-slate-800 bg-slate-100 text-slate-600 shadow-sm focus:border-slate-300 focus:ring-slate-300"
               value={filtroStatus}
               onChange={(e) => setFiltroStatus(e.target.value)}
            >
              <option value="">Todos</option>
              <option value="PENDENTE">Pendente</option>
              <option value="CONCLUIDO">Concluída</option>
              <option value="REPROVADO">Reprovado</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-800 mb-1">
              Prioridade
            </label>
            <select
              className="w-full h-9 rounded-md border-slate-800 bg-slate-100 text-slate-600 shadow-sm focus:border-slate-300 focus:ring-slate-300"
              value={filtroPrioridade}
              onChange={(e) => setFiltroPrioridade(e.target.value)}
            >
              <option value="">Todas</option>
              <option value="BAIXA">Baixa</option>
              <option value="MEDIA">Média</option>
              <option value="ALTA">Alta</option>
              <option value="URGENTE">Urgente</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-800 mb-1">
              Contrato
            </label>
            <select
              className="w-full h-9 rounded-md border-slate-800 bg-slate-100 text-slate-600 shadow-sm focus:border-slate-300 focus:ring-slate-300"
              value={filtroContrato}
              onChange={(e) => setFiltroContrato(e.target.value)}
            >
              <option value="">Todos</option>
              {contratosOptions.map((c) => (
                <option key={c.id} value={c.id.toString()}>{`${c.numero} — ${c.nome}`}</option>
              ))}
            </select>
          </div>

          {/* Mostrar o filtro de setor apenas quando não estiver em uma rota específica de setor */}
          {!setorAtual && (
            <div>
              <label className="block text-xs font-medium text-slate-800 mb-1">
                Setor Responsável
              </label>
              <select
                className="w-full h-9 rounded-md border-slate-800 bg-slate-100 text-slate-600 shadow-sm focus:border-slate-300 focus:ring-slate-300"
                value={filtroSetor}
                onChange={(e) => setFiltroSetor(e.target.value)}
              >
                <option value="">Todos</option>
                <option value="RH">RH</option>
                <option value="TREINAMENTO">Treinamento</option>
                <option value="MEDICINA">Medicina</option>
              </select>
            </div>
          )}

          {/* Novo: filtro por Tipo */}
          <div>
            <label className="block text-xs font-medium text-slate-800 mb-1">
              Tipo
            </label>
            <select
              className="w-full h-9 rounded-md border-slate-800 bg-slate-100 text-slate-600 shadow-sm focus:border-slate-300 focus:ring-slate-300"
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
            >
              <option value="">Todos</option>
              {tiposOptions.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-800 mb-1">
              Nome do Funcionário
            </label>
            <div className="relative flex">
              <input
                type="text"
                className="pl-8 w-full h-9 rounded-l-md border-slate-500 bg-slate-100 text-slate-600 shadow-sm focus:border-slate-300 focus:ring-slate-300"
                placeholder="Buscar por nome..."
                ref={filtroNomeRef}
                defaultValue={filtroNome}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter" && filtroNomeRef.current) {
                    setFiltroNome(filtroNomeRef.current.value);
                  }
                }}
              />
              <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-4 w-4 text-slate-400" />
              </div>
              <div className="flex">
                <button
                  className="bg-slate-500 hover:bg-slate-600 text-white px-3 rounded-r-md transition-colors duration-200"
                  onClick={() => {
                    if (filtroNomeRef.current) {
                      setFiltroNome(filtroNomeRef.current.value);
                    }
                  }}
                >
                  <MagnifyingGlassIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Filtro por Categoria de Data Limite */}
          <div>
            <label className="block text-xs font-medium text-slate-800 mb-1">
              Data Limite por Categoria
            </label>
            <select
              className="w-full h-9 rounded-md border-slate-800 bg-slate-100 text-slate-600 shadow-sm focus:border-slate-300 focus:ring-slate-300"
              value={filtroDataCategoria}
              onChange={(e) => setFiltroDataCategoria(e.target.value as any)}
            >
              <option value="">Todas</option>
              <option value="VENCIDOS">Vencidos</option>
              <option value="A_VENCER">Próximo de vencer</option>
              <option value="NO_PRAZO">No prazo</option>
              <option value="SEM_DATA">Pendentes (sem data)</option>
            </select>
          </div>

          {/* Novo: Filtro por Data Limite Exata */}
          <div>
            <label className="block text-xs font-medium text-slate-800 mb-1">
              Data Limite
            </label>
            <input
              type="date"
              className="w-full h-9 rounded-md border-slate-800 bg-slate-100 text-slate-600 shadow-sm focus:border-slate-300 focus:ring-slate-300"
              value={filtroDataExata}
              onChange={(e) => setFiltroDataExata(e.target.value)}
            />
          </div>
        </div>
      </div>
    );
  };

  // Função para determinar o status geral do funcionário baseado nas suas tarefas
  const getStatusGeralFuncionario = (tarefas: TarefaRemanejamento[]) => {
    if (tarefas.length === 0) return 'PENDENTE';
    
    // Verificar se tem tarefas reprovadas
    const hasReprovado = tarefas.some(t => t.status === "REPROVADO");
    if (hasReprovado) return 'REPROVADO';
    
    // Calcular progresso
    const tarefasConcluidas = tarefas.filter(t => t.status === "CONCLUIDA" || t.status === "CONCLUIDO").length;
    const totalTarefas = tarefas.length;
    
    // Se todas concluídas
    if (tarefasConcluidas === totalTarefas) return 'CONCLUIDO';
    
    // Se nenhuma concluída
    if (tarefasConcluidas === 0) return 'PENDENTE';
    
    // Se algumas concluídas (em andamento)
    return 'EM_ANDAMENTO';
  };

  // Função para obter classes de borda baseadas no status
  const getBordaStatusClasses = (status: string) => {
    switch (status) {
      case 'REPROVADO':
        return 'border-l-4 border-l-red-500 bg-red-50/20';
      case 'EM_ANDAMENTO':
        return 'border-l-4 border-l-blue-500 bg-blue-50/20';
      case 'CONCLUIDO':
        return 'border-l-4 border-l-green-500 bg-green-50/20';
      case 'PENDENTE':
        return 'border-l-4 border-l-gray-400 bg-gray-50/20';
      default:
        return 'border-l-4 border-l-gray-400 bg-gray-50/20';
    }
  };

  // Componente para a lista de tarefas
  const ListaTarefas = () => {
    const remanejamentosComTarefas = getRemanejamentosParaVisaoFuncionarios();

    // Paginação dos remanejamentos
    const totalRemanejamentos = remanejamentosComTarefas.length;
    const totalPaginas = Math.ceil(
      totalRemanejamentos / itensPorPaginaFuncionarios
    );
    const inicio = (paginaAtualFuncionarios - 1) * itensPorPaginaFuncionarios;
    const fim = inicio + itensPorPaginaFuncionarios;
    const remanejamentosPaginados = remanejamentosComTarefas.slice(inicio, fim);

// Contagem de observações será carregada sob demanda ao expandir uma linha

    if (loading) {
      return <div className="text-center py-10">Carregando tarefas...</div>;
    }

    if (error) {
      return (
        <div className="text-center py-10 text-red-500">
          Erro ao carregar tarefas: {error}
        </div>
      );
    }

    if (remanejamentosComTarefas.length === 0) {
      return (
        <div className="text-center py-10">Nenhuma tarefa encontrada.</div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Informações de paginação */}
        <div className="flex justify-between items-center bg-slate-100 px-6 py-3 rounded-lg border border-slate-300 shadow-sm">
          <div className="text-xs font-medium text-gray-700">
            Mostrando {inicio + 1} a {Math.min(fim, totalRemanejamentos)} de{" "}
            {totalRemanejamentos} remanejamentos
          </div>
          <div className="text-xs font-medium text-gray-700">
            Página {paginaAtualFuncionarios} de {totalPaginas}
          </div>
        </div>

        {/* Tabela de funcionários */}
        <div className="bg-white rounded-lg shadow-lg border border-slate-300 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-slate-100">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider"
                  >
                    Funcionário
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider"
                  >
                    Tipo de Solicitação
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider"
                  >
                    Tarefas
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider"
                  >
                    Progresso
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider"
                  >
                    Contrato (De → Para)
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {remanejamentosPaginados.map(
                  ({ funcionario, tarefas, remanejamento, solicitacao }) => {
                    // Debug logs removidos para produção

                    const chaveGrupo = `${funcionario.id}_${remanejamento.id}`;
                    // const tarefasPendentes = tarefas.filter(
                    //   (t: Tarefa) =>
                    //     t.status !== "CONCLUIDA" && t.status !== "CONCLUIDO"
                    // );
                    const tarefasConcluidas = tarefas.filter(
                      (t: TarefaRemanejamento) =>
                        t.status === "CONCLUIDA" || t.status === "CONCLUIDO"
                    );
                    const progresso =
                      tarefas.length > 0
                        ? Math.round(
                            (tarefasConcluidas.length / tarefas.length) * 100
                          )
                        : 0;
                    const expandido = funcionariosExpandidos.has(chaveGrupo);
                    
                    // Determinar status geral e classes de borda
                    const statusGeral = getStatusGeralFuncionario(tarefas);
                    const bordaClasses = getBordaStatusClasses(statusGeral);
                    
                    return (
                      <React.Fragment key={chaveGrupo}>
                        <tr
                          className={`group ${bordaClasses} cursor-pointer ${expandido ? 'bg-slate-50' : 'hover:bg-gray-50'}`}
                          onClick={(e) => {
                            const target = e.target as HTMLElement;
                            if (target && (target.closest('button') || target.closest('a') || target.closest('input') || target.closest('[data-no-expand]'))) {
                              return;
                            }
                            toggleExpandirFuncionario(chaveGrupo, tarefas);
                          }}
                        >
                          <td
                            className="px-6 py-4 whitespace-nowrap"
                          >
                            <div className="flex items-center space-x-3">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleExpandirFuncionario(chaveGrupo, tarefas);
                                }}
                                className="text-gray-500 hover:text-gray-700"
                              >
                                <ChevronRightIcon
                                  className={`h-4 w-4 transform transition-transform ${
                                    expandido ? "rotate-90" : ""
                                  }`}
                                />
                              </button>
                              <div className="flex flex-col">
                                <div className="text-[12px] font-medium text-gray-900">
                                  {funcionario.nome}
                                </div>
                                <div className="text-[11px] text-gray-500">
                                  {funcionario.funcao || 'Função não informada'}
                                </div>
                              </div>
                            </div>
                          </td>
                          
                          {/* Tipo de Solicitação */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {solicitacao?.tipo || 'N/A'}
                            </span>
                          </td>
                          
                          {/* Resumo das Tarefas */}
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span className="text-sm font-medium text-gray-900">
                              {tarefasConcluidas.length}/{tarefas.length}
                            </span>
                            <div className="text-xs text-gray-500">
                              {tarefasConcluidas.length} concluída{tarefasConcluidas.length !== 1 ? 's' : ''} de {tarefas.length}
                            </div>
                          </td>
                          
                          {/* Barra de Progresso */}
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <div className="flex items-center justify-center space-x-2">
                              <div className="w-16 bg-gray-200 rounded-full h-2">
                                <div 
                                  className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                                  style={{ width: `${progresso}%` }}
                                ></div>
                              </div>
                              <span className="text-xs font-medium text-gray-700">
                                {progresso}%
                              </span>
                            </div>
                          </td>
                          
                          {/* Contrato (De → Para) */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-900">
                              {solicitacao?.contratoOrigem?.numero || '-'} → {solicitacao?.contratoDestino?.numero || '-'}
                            </span>
                          </td>
                        </tr>

                        {/* Detalhes expandidos das tarefas */}
                        {expandido && (
                          <tr>
                            <td colSpan={5} className="px-0 py-0">
                              <div className="bg-gray-50 border-t border-gray-200">
                                <div className="px-6 py-4">
                                  <div className="mb-3">
                                    <h4 className="text-xm font-medium text-gray-900">
                                      Tarefas do Funcionário
                                    </h4>
                                  </div>
                                  <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                      <thead className="bg-gray-100">
                                        <tr>
                                          <th
                                            scope="col"
                                            className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider"
                                          >
                                            Tipo
                                          </th>
                                          <th
                                            scope="col"
                                            className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider"
                                          >
                                            Descrição
                                          </th>
                                          <th
                                            scope="col"
                                            className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider"
                                          >
                                            Status
                                          </th>
                                          <th
                                            scope="col"
                                            className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider"
                                          >
                                            Prioridade
                                          </th>
                                          <th
                                            scope="col"
                                            className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider"
                                          >
                                            <button
                                              type="button"
                                              className="inline-flex items-center gap-2 text-gray-700 hover:text-gray-900"
                                              onClick={() =>
                                                setOrdenacaoDataLimite((prev) =>
                                                  prev === "asc" ? "desc" : prev === "desc" ? "" : "asc"
                                                )
                                              }
                                            >
                                              Data Limite
                                              <span className="text-xs">
                                                {ordenacaoDataLimite === "asc"
                                                  ? "▲"
                                                  : ordenacaoDataLimite === "desc"
                                                  ? "▼"
                                                  : ""}
                                              </span>
                                            </button>
                                          </th>
                                          {!setorAtual && (
                                            <th
                                              scope="col"
                                              className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider"
                                            >
                                              Setor
                                            </th>
                                          )}
                                          <th
                                            scope="col"
                                            className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider"
                                          >
                                            Ações
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody className="bg-white divide-y divide-gray-200">
                                        {tarefas
                                          .sort((a, b) => {
                                            // Função para obter prioridade do status
                                            const getStatusPriority = (status: string) => {
                                              if (status === "REPROVADO") return 0; // Maior prioridade
                                              if (status === "EM_ANDAMENTO") return 1;
                                              if (status === "PENDENTE") return 2;
                                              if (status === "CONCLUIDA" || status === "CONCLUIDO") return 3; // Menor prioridade
                                              return 4; // Outros status
                                            };

                                            const priorityA = getStatusPriority(a.status);
                                            const priorityB = getStatusPriority(b.status);
                                            
                                            return priorityA - priorityB;
                                          })
                                          .map((tarefa) => {
                                            // Classes de status
                                            let statusClasses =
                                              "px-2 py-1 text-xs rounded-full";
                                            if (tarefa.status === "PENDENTE")
                                              statusClasses +=
                                                " bg-yellow-100 text-yellow-800";
                                            else if (
                                              tarefa.status === "CONCLUIDA" ||
                                              tarefa.status === "CONCLUIDO"
                                            )
                                              statusClasses +=
                                                " bg-green-100 text-green-800";
                                            else if (tarefa.status === "REPROVADO")
                                              statusClasses +=
                                                " bg-red-100 text-red-800";
                                            else if (tarefa.status === "EM_ANDAMENTO")
                                              statusClasses +=
                                                " bg-blue-100 text-blue-800";
                                            else
                                              statusClasses +=
                                                " bg-slate-100 text-slate-800";

                                            // Classes de prioridade
                                            let prioridadeClasses =
                                              "px-2 py-1 text-xs rounded-full";
                                            if (tarefa.prioridade === "BAIXA")
                                              prioridadeClasses +=
                                                " bg-gray-100 text-gray-800";
                                            else if (
                                              tarefa.prioridade === "MEDIA"
                                            )
                                              prioridadeClasses +=
                                                " bg-blue-100 text-blue-800";
                                            else if (
                                              tarefa.prioridade === "ALTA"
                                            )
                                              prioridadeClasses +=
                                                " bg-orange-100 text-orange-800";
                                            else if (
                                              tarefa.prioridade === "URGENTE"
                                            )
                                              prioridadeClasses +=
                                                " bg-red-100 text-red-800";

                                            // Classes de setor
                                            let setorClasses =
                                              "px-2 py-1 text-xs rounded-full";
                                            if (tarefa.responsavel === "RH")
                                              setorClasses +=
                                                " bg-purple-100 text-purple-800";
                                            else if (
                                              tarefa.responsavel ===
                                              "TREINAMENTO"
                                            )
                                              setorClasses +=
                                                " bg-indigo-100 text-indigo-800";
                                            else if (
                                              tarefa.responsavel === "MEDICINA"
                                            )
                                              setorClasses +=
                                                " bg-teal-100 text-teal-800";

                                            // Verificar se está atrasada
                                            const hoje = new Date();
                                            hoje.setHours(0, 0, 0, 0);
                                            const dataLimite = tarefa.dataLimite
                                              ? new Date(tarefa.dataLimite)
                                              : null;
                                            if (dataLimite)
                                              dataLimite.setHours(0, 0, 0, 0);
                                            const atrasada =
                                              dataLimite &&
                                              dataLimite < hoje &&
                                              tarefa.status !== "CONCLUIDA" &&
                                              tarefa.status !== "CONCLUIDO";

                                            return (
                                              <tr
                                                key={tarefa.id}
                                                className="hover:bg-gray-50"
                                              >
                                                <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">
                                                  {tarefa.tipo}
                                                </td>
                                                <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">
                                                  {tarefa.descricao}
                                                </td>
                                                <td className="px-4 py-3 text-xs whitespace-nowrap">
                                                  <span
                                                    className={statusClasses}
                                                  >
                                                    {tarefa.status ===
                                                    "PENDENTE"
                                                      ? "Pendente"
                                                      : tarefa.status ===
                                                          "CONCLUIDA" ||
                                                        tarefa.status ===
                                                          "CONCLUIDO"
                                                      ? "Concluída"
                                                      : tarefa.status}
                                                  </span>
                                                </td>
                                                <td className="px-4 py-3 text-xs whitespace-nowrap">
                                                  <span
                                                    className={
                                                      prioridadeClasses
                                                    }
                                                  >
                                                    {tarefa.prioridade ===
                                                    "BAIXA"
                                                      ? "Baixa"
                                                      : tarefa.prioridade ===
                                                        "MEDIA"
                                                      ? "Média"
                                                      : tarefa.prioridade ===
                                                        "ALTA"
                                                      ? "Alta"
                                                      : tarefa.prioridade ===
                                                        "URGENTE"
                                                      ? "Urgente"
                                                      : tarefa.prioridade}
                                                  </span>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">
                                                  {tarefa.dataLimite ? (
                                                    <span
                                                      className={
                                                        atrasada
                                                          ? "text-red-600 font-medium"
                                                          : ""
                                                      }
                                                    >
                                                      {new Date(
                                                        tarefa.dataLimite
                                                      ).toLocaleDateString(
                                                        "pt-BR"
                                                      )}
                                                      {atrasada &&
                                                        " (Atrasada)"}
                                                    </span>
                                                  ) : (
                                                    "N/A"
                                                  )}
                                                </td>
                                                {!setorAtual && (
                                                  <td className="px-4 py-3 text-xs whitespace-nowrap">
                                                    <span
                                                      className={setorClasses}
                                                    >
                                                      {tarefa.responsavel ===
                                                      "RH"
                                                        ? "RH"
                                                        : tarefa.responsavel ===
                                                          "TREINAMENTO"
                                                        ? "Treinamento"
                                                        : tarefa.responsavel ===
                                                          "MEDICINA"
                                                        ? "Medicina"
                                                        : tarefa.responsavel}
                                                    </span>
                                                  </td>
                                                )}
                                                <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">
                                                  <div className="flex space-x-2">
                                                    <button
                                                      className="text-slate-500 hover:text-sky-600"
                                                      title="Ver detalhes"
                                                      onClick={() =>
                                                        router.push(
                                                          `/prestserv/remanejamentos/${tarefa.remanejamentoFuncionarioId}`
                                                        )
                                                      }
                                                    >
                                                      <EyeIcon className="h-4 w-4" />
                                                    </button>
                                                    {tarefa.status !==
                                                      "CONCLUIDO" &&
                                                      tarefa.status !==
                                                        "CONCLUIDA" && (
                                                        <button
                                                          className="text-slate-500 hover:text-green-600"
                                                          title="Concluir tarefa"
                                                          onClick={() =>
                                                            abrirModalConcluir(
                                                              tarefa
                                                            )
                                                          }
                                                        >
                                                          <CheckCircleIcon className="h-4 w-4" />
                                                        </button>
                                                      )}
                                                    <button
                                                      className="text-slate-500 hover:text-blue-600 relative"
                                                      title="Observações"
                                                      onClick={() =>
                                                        abrirModalObservacoes(
                                                          tarefa
                                                        )
                                                      }
                                                    >
                                                      <ChatBubbleLeftRightIcon className="h-4 w-4" />
<span
  className={`absolute -top-2 -right-2 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center ${
    (observacoesCount as Record<string, number>)[tarefa.id] > 0 ? "bg-blue-500" : "bg-gray-400"
  }`}
>
  {(observacoesCount as Record<string, number>)[tarefa.id] ?? 0}
</span>
                                                    </button>
                                                  </div>
                                                </td>
                                              </tr>
                                            );
                                          })}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Controles de paginação */}
        {totalPaginas > 1 && (
          <div className="flex items-center justify-between bg-slate-100 px-6 py-4 rounded-lg mt-4 border border-slate-300 shadow-sm">
            <div className="flex items-center space-x-3">
              <label className="text-xs font-medium text-gray-700">
                Funcionários por página:
              </label>
              <select
                value={itensPorPaginaFuncionarios}
                onChange={(e) => {
                  setItensPorPaginaFuncionarios(Number(e.target.value));
                  setPaginaAtualFuncionarios(1);
                }}
                className="border border-gray-300 rounded-md px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value={3}>3</option>
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={15}>15</option>
              </select>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={() =>
                  setPaginaAtualFuncionarios(
                    Math.max(1, paginaAtualFuncionarios - 1)
                  )
                }
                disabled={paginaAtualFuncionarios === 1}
                className="px-4 py-2 text-xs font-medium border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                Anterior
              </button>

              <div className="flex items-center space-x-1">
                {Array.from({ length: Math.min(5, totalPaginas) }, (_, i) => {
                  let pageNum;
                  if (totalPaginas <= 5) {
                    pageNum = i + 1;
                  } else if (paginaAtualFuncionarios <= 3) {
                    pageNum = i + 1;
                  } else if (paginaAtualFuncionarios >= totalPaginas - 2) {
                    pageNum = totalPaginas - 4 + i;
                  } else {
                    pageNum = paginaAtualFuncionarios - 2 + i;
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPaginaAtualFuncionarios(pageNum)}
                      className={`px-4 py-2 text-xs font-medium border rounded-lg shadow-sm ${
                        pageNum === paginaAtualFuncionarios
                          ? "bg-blue-600 text-white border-blue-600"
                          : "border-gray-300 hover:bg-gray-100"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() =>
                  setPaginaAtualFuncionarios(
                    Math.min(totalPaginas, paginaAtualFuncionarios + 1)
                  )
                }
                disabled={paginaAtualFuncionarios === totalPaginas}
                className="px-4 py-2 text-xs font-medium border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const DashboardTarefas = () => {
    const tarefasFiltradas = getTarefasFiltradas();

    // Estatísticas por status
    const estatisticasStatus = () => {
      const stats = tarefasFiltradas.reduce((acc, tarefa) => {
        const status =
          tarefa.status === "CONCLUIDO" || tarefa.status === "CONCLUIDA"
            ? "CONCLUIDA"
            : tarefa.status === "PENDENTE"
            ? "PENDENTE"
            : tarefa.status === "EM_ANDAMENTO"
            ? "EM_ANDAMENTO"
            : "OUTROS";
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return {
        pendentes: stats.PENDENTE || 0,
        emAndamento: stats.EM_ANDAMENTO || 0,
        concluidas: stats.CONCLUIDA || 0,
        outros: stats.OUTROS || 0,
      };
    };

    // Estatísticas por prioridade
    const estatisticasPrioridade = () => {
      return tarefasFiltradas.reduce((acc, tarefa) => {
        acc[tarefa.prioridade] = (acc[tarefa.prioridade] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
    };

    // Estatísticas por setor responsável
    const estatisticasSetor = () => {
      return tarefasFiltradas.reduce((acc, tarefa) => {
        acc[tarefa.responsavel] = (acc[tarefa.responsavel] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
    };

    // Tarefas atrasadas
    const tarefasAtrasadas = () => {
      // Normalizar data de hoje para ignorar horas
      const hoje = new Date();
      const hojeNorm = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
      
      return tarefasFiltradas.filter((tarefa) => {
        if (
          !tarefa.dataLimite ||
          tarefa.status === "CONCLUIDO" ||
          tarefa.status === "CONCLUIDA"
        )
          return false;
        
        // Normalizar data limite para ignorar horas
        const dataLimite = new Date(tarefa.dataLimite);
        const dataLimiteNorm = new Date(dataLimite.getFullYear(), dataLimite.getMonth(), dataLimite.getDate());
        
        return dataLimiteNorm < hojeNorm;
      }).length;
    };

    const statsStatus = estatisticasStatus();
    const statsPrioridade = estatisticasPrioridade();
    const statsSetor = estatisticasSetor();
    const atrasadas = tarefasAtrasadas();

    if (loading) {
      return <div className="text-center py-10">Carregando dashboard...</div>;
    }

    if (error) {
      return (
        <div className="text-center py-10 text-red-500">
          Erro ao carregar dashboard: {error}
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Distribuição por Status */}
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Distribuição por Status
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600">Pendentes</span>
                <div className="flex items-center space-x-2">
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-yellow-500 h-2 rounded-full"
                      style={{
                        width: `${
                          tarefasFiltradas.length > 0
                            ? (statsStatus.pendentes /
                                tarefasFiltradas.length) *
                              100
                            : 0
                        }%`,
                      }}
                    ></div>
                  </div>
                  <span className="text-xs font-medium text-gray-800">
                    {statsStatus.pendentes}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600">Em Andamento</span>
                <div className="flex items-center space-x-2">
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-purple-500 h-2 rounded-full"
                      style={{
                        width: `${
                          tarefasFiltradas.length > 0
                            ? (statsStatus.emAndamento /
                                tarefasFiltradas.length) *
                              100
                            : 0
                        }%`,
                      }}
                    ></div>
                  </div>
                  <span className="text-xs font-medium text-gray-800">
                    {statsStatus.emAndamento}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600">Concluídas</span>
                <div className="flex items-center space-x-2">
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full"
                      style={{
                        width: `${
                          tarefasFiltradas.length > 0
                            ? (statsStatus.concluidas /
                                tarefasFiltradas.length) *
                              100
                            : 0
                        }%`,
                      }}
                    ></div>
                  </div>
                  <span className="text-xs font-medium text-gray-800">
                    {statsStatus.concluidas}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Distribuição por Prioridade */}
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Distribuição por Prioridade
            </h3>
            <div className="space-y-3">
              {Object.entries(statsPrioridade).map(([prioridade, count]) => {
                const cores = {
                  BAIXA: "bg-green-400",
                  MEDIA: "bg-yellow-400",
                  ALTA: "bg-orange-400",
                  URGENTE: "bg-red-500",
                };
                const cor =
                  cores[prioridade as keyof typeof cores] || "bg-gray-400";

                return (
                  <div
                    key={prioridade}
                    className="flex items-center justify-between"
                  >
                    <span className="text-xs text-gray-600">
                      {prioridade === "BAIXA"
                        ? "Baixa"
                        : prioridade === "MEDIA"
                        ? "Média"
                        : prioridade === "ALTA"
                        ? "Alta"
                        : prioridade === "URGENTE"
                        ? "Urgente"
                        : prioridade}
                    </span>
                    <div className="flex items-center space-x-2">
                      <div className="w-32 bg-gray-200 rounded-full h-2">
                        <div
                          className={`${cor} h-2 rounded-full`}
                          style={{
                            width: `${
                              tarefasFiltradas.length > 0
                                ? (count / tarefasFiltradas.length) * 100
                                : 0
                            }%`,
                          }}
                        ></div>
                      </div>
                      <span className="text-xs font-medium text-gray-800">
                        {count}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Distribuição por Setor */}
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Distribuição por Setor
            </h3>
            <div className="space-y-3">
              {Object.entries(statsSetor).map(([setor, count]) => {
                const cores = {
                  RH: "bg-blue-500",
                  MEDICINA: "bg-red-500",
                  TREINAMENTO: "bg-green-500",
                };
                const cor = cores[setor as keyof typeof cores] || "bg-gray-400";

                return (
                  <div
                    key={setor}
                    className="flex items-center justify-between"
                  >
                    <span className="text-xs text-gray-600">
                      {setor === "RH"
                        ? "RH"
                        : setor === "MEDICINA"
                        ? "Medicina"
                        : setor === "TREINAMENTO"
                        ? "Treinamento"
                        : setor}
                    </span>
                    <div className="flex items-center space-x-2">
                      <div className="w-32 bg-gray-200 rounded-full h-2">
                        <div
                          className={`${cor} h-2 rounded-full`}
                          style={{
                            width: `${
                              tarefasFiltradas.length > 0
                                ? (count / tarefasFiltradas.length) * 100
                                : 0
                            }%`,
                          }}
                        ></div>
                      </div>
                      <span className="text-xs font-medium text-gray-800">
                        {count}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Resumo de Performance */}
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Resumo de Performance
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-xs text-gray-600">Taxa de Conclusão</span>
                <span className="text-lg font-semibold text-green-600">
                  {tarefasFiltradas.length > 0
                    ? Math.round(
                        (statsStatus.concluidas / tarefasFiltradas.length) * 100
                      )
                    : 0}
                  %
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-xs text-gray-600">Tarefas Atrasadas</span>
                <span className="text-lg font-semibold text-red-600">
                  {atrasadas}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-xs text-gray-600">
                  Funcionários Envolvidos
                </span>
                <span className="text-lg font-semibold text-blue-600">
                  {
                    new Set(
                      tarefasFiltradas.map(
                        (t) =>
                          t.funcionario?.id
                      )
                    ).size
                  }
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Modal para criar nova tarefa
  const NovaTarefaModal = () => {
    if (!mostrarFormTarefa) return null;

    // Filtrar funcionários únicos (sem duplicatas)
    const funcionariosUnicos = funcionariosRemanejamento
      .flatMap((solicitacao) =>
        (solicitacao.funcionarios || [])
          .filter(
            (f) =>
              (f.statusTarefa === "REPROVADO" ||
                f.statusTarefa === "EM_ANDAMENTO")
          )
          .map((f) => ({
            id: f.id,
            nome: f.funcionario?.nome || '',
            matricula: f.funcionario?.matricula || '',
            funcao: f.funcionario?.funcao || '',
          }))
      )
      .reduce((acc: any[], curr) => {
        // Verificar se já existe um funcionário com o mesmo ID
        if (!acc.some((f) => f.id === curr.id)) {
          acc.push(curr);
        }
        return acc;
      }, []);

    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-800">
                Nova Tarefa
              </h2>
              <button
                onClick={fecharFormTarefa}
                className="text-gray-500 hover:text-gray-700"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmitTarefa}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Seleção do Funcionário */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Funcionário
                  </label>
                  <select
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    value={novaTarefa.remanejamentoFuncionarioId}
                    onChange={(e) =>
                      handleSelecionarFuncionario(e.target.value)
                    }
                    disabled={loadingFuncionarios}
                  >
                    <option value="">Selecione um funcionário...</option>
                    {funcionariosUnicos.map((funcionario) => (
                      <option key={funcionario.id} value={funcionario.id}>
                        {funcionario.nome} - {funcionario.matricula} -{" "}
                        {funcionario.funcao}
                      </option>
                    ))}
                  </select>
                  {loadingFuncionarios && (
                    <p className="text-xs text-gray-500 mt-1">
                      Carregando funcionários...
                    </p>
                  )}
                </div>

                {/* Seleção do Setor Responsável */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Setor Responsável
                  </label>
                  <select
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    value={novaTarefa.responsavel}
                    onChange={(e) => {
                      // Ao mudar o setor, limpa o tipo selecionado
                      setNovaTarefa({
                        ...novaTarefa,
                        responsavel: e.target.value,
                        tipo: "",
                      });
                    }}
                  >
                    <option value="RH">RH</option>
                    <option value="TREINAMENTO">Treinamento</option>
                    <option value="MEDICINA">Medicina</option>
                  </select>
                </div>

                {/* Tipo de Tarefa */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Tipo de Tarefa
                  </label>
                  <select
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    value={novaTarefa.tipo}
                    onChange={(e) => {
                      const selectedTipo = e.target.value;
                      const selectedSetor = novaTarefa.responsavel;
                      const tipoInfo = tiposTarefaPadrao[selectedSetor]?.find(
                        (t) => t.tipo === selectedTipo
                      );

                      const novaDescricao =
                        tipoInfo?.descricao || novaTarefa.descricao;
                      setNovaTarefa({
                        ...novaTarefa,
                        tipo: selectedTipo,
                        descricao: novaDescricao,
                      });

                      // Atualizar o valor do textarea
                      if (descricaoRef.current) {
                        descricaoRef.current.value = novaDescricao || '';
                      }
                    }}
                    disabled={loadingTiposTarefa}
                  >
                    <option value="">Selecione um tipo...</option>
                    {tiposTarefaPadrao[novaTarefa.responsavel]?.map(
                      (tipo, index) => (
                        <option key={index} value={tipo.tipo}>
                          {tipo.tipo}
                        </option>
                      )
                    )}
                  </select>
                  {loadingTiposTarefa && (
                    <p className="text-xs text-gray-500 mt-1">
                      Carregando tipos de tarefa...
                    </p>
                  )}
                </div>

                {/* Prioridade */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Prioridade
                  </label>
                  <select
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    value={novaTarefa.prioridade}
                    onChange={(e) =>
                      setNovaTarefa({
                        ...novaTarefa,
                        prioridade: e.target.value,
                      })
                    }
                  >
                    <option value="BAIXA">Baixa</option>
                    <option value="MEDIA">Média</option>
                    <option value="ALTA">Alta</option>
                    <option value="URGENTE">Urgente</option>
                  </select>
                </div>

                {/* Data Limite */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Data Limite
                  </label>
                  <input
                    type="date"
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    value={novaTarefa.dataLimite}
                    onChange={(e) =>
                      setNovaTarefa({
                        ...novaTarefa,
                        dataLimite: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              {/* Descrição */}
              <div className="mb-6">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Descrição
                </label>
                <textarea
                  className="w-full rounded-md border-slate-600 bg-white-700 shadow-sm focus:border-slate-500 focus:ring-slate-500"
                  rows={4}
                  placeholder="Descreva a tarefa..."
                  ref={descricaoRef}
                  defaultValue={novaTarefa.descricao}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    // Atualizar ao pressionar Tab
                    if (e.key === "Tab" && descricaoRef.current) {
                      setNovaTarefa((prev) => ({
                        ...prev,
                        descricao: descricaoRef.current?.value || "",
                      }));
                    }
                  }}
                  onBlur={() => {
                    if (descricaoRef.current) {
                      setNovaTarefa((prev) => ({
                        ...prev,
                        descricao: descricaoRef.current?.value || "",
                      }));
                    }
                  }}
                />
              </div>

              {/* Dados da Solicitação e Funcionário */}
              {solicitacaoSelecionada &&
                novaTarefa.remanejamentoFuncionarioId && (
                  <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h3 className="font-medium text-gray-700 mb-2">
                        Dados da Solicitação
                      </h3>
                      <p className="text-xs text-gray-600">
                        <span className="font-medium">Tipo:</span>{" "}
                        {solicitacaoSelecionada.tipo || "N/A"}
                      </p>
                      <p className="text-xs text-gray-600">
                        <span className="font-medium">Status:</span>{" "}
                        {solicitacaoSelecionada.status}
                      </p>
                      <p className="text-xs text-gray-600">
                        <span className="font-medium">Data:</span>{" "}
                        {new Date(
                          solicitacaoSelecionada.dataSolicitacao
                        ).toLocaleDateString("pt-BR")}
                      </p>
                      {solicitacaoSelecionada.contratoOrigem && (
                        <p className="text-xs text-gray-600">
                          <span className="font-medium">Contrato Origem:</span>{" "}
                          {solicitacaoSelecionada.contratoOrigem.nome}
                        </p>
                      )}
                      {solicitacaoSelecionada.contratoDestino && (
                        <p className="text-xs text-gray-600">
                          <span className="font-medium">Contrato Destino:</span>{" "}
                          {solicitacaoSelecionada.contratoDestino.nome}
                        </p>
                      )}
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h3 className="font-medium text-gray-700 mb-2">
                        Detalhes do Funcionário
                      </h3>
                      {solicitacaoSelecionada && (solicitacaoSelecionada.funcionarios || []).find(
                        (f) => f.id === novaTarefa.remanejamentoFuncionarioId
                      )?.funcionario && (
                        <>
                          <p className="text-xs text-gray-600">
                            <span className="font-medium">Nome:</span>{" "}
                            {
                              (solicitacaoSelecionada?.funcionarios || []).find(
                                (f) =>
                                  f.id === novaTarefa.remanejamentoFuncionarioId
                              )?.funcionario?.nome
                            }
                          </p>
                          <p className="text-xs text-gray-600">
                            <span className="font-medium">Matrícula:</span>{" "}
                            {
                              (solicitacaoSelecionada?.funcionarios || []).find(
                                (f) =>
                                  f.id === novaTarefa.remanejamentoFuncionarioId
                              )?.funcionario?.matricula
                            }
                          </p>
                          <p className="text-xs text-gray-600">
                            <span className="font-medium">Função:</span>{" "}
                            {
                              (solicitacaoSelecionada?.funcionarios || []).find(
                                (f) =>
                                  f.id === novaTarefa.remanejamentoFuncionarioId
                              )?.funcionario?.funcao
                            }
                          </p>
                          <p className="text-xs text-gray-600">
                            <span className="font-medium">
                              Centro de Custo:
                            </span>{" "}
                            {
                              (solicitacaoSelecionada?.funcionarios || []).find(
                                (f) =>
                                  f.id === novaTarefa.remanejamentoFuncionarioId
                              )?.funcionario?.centroCusto
                            }
                          </p>
                          <p className="text-xs text-gray-600">
                            <span className="font-medium">Status:</span>{" "}
                            {
                              (solicitacaoSelecionada?.funcionarios || []).find(
                                (f) =>
                                  f.id === novaTarefa.remanejamentoFuncionarioId
                              )?.funcionario?.nome
                            }
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                )}

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={fecharFormTarefa}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={criandoTarefa}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300"
                >
                  {criandoTarefa ? "Criando..." : "Criar Tarefa"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  };

  // Função para obter o título da página com base no setor atual
  const getTituloPagina = () => {
    if (setorAtual === "RH") {
      return "Gerenciamento de Tarefas - RH";
    } else if (setorAtual === "MEDICINA") {
      return "Gerenciamento de Tarefas - Medicina";
    } else if (setorAtual === "TREINAMENTO") {
      return "Gerenciamento de Tarefas - Treinamento";
    } else {
      return "Gerenciamento de Tarefas";
    }
  };

  // Render do componente principal
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-600">
          {getTituloPagina()}
        </h1>
        <div className="flex space-x-2">
          <button
            onClick={exportarParaExcel}
            className="flex items-center px-4 py-2 border border-slate-500 rounded-md shadow-sm text-xs font-medium text-slate-500 hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500"
          >
            <DocumentArrowDownIcon className="h-5 w-5 mr-2" />
            Exportar Excel
          </button>
        </div>
      </div>

      {/* Abas de Visualização */}
      <div className="bg-linear-to-r from-gray-800 to-slate-600 rounded-lg p-6 mb-6">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab("funcionarios")}
            className={`text-white py-2 px-1 border-b-2 font-medium text-xs flex items-center space-x-2 ${
              activeTab === "funcionarios"
                ? "border-sky-500 text-sky-300"
                : "border-transparent text-gray-500 hover:text-white-700 hover:border-white-300"
            }`}
          >
            <UserGroupIcon className="h-4 w-4" />
            <span>Visão por Funcionários</span>
          </button>
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`text-white py-2 px-1 border-b-2 font-medium text-xs flex items-center space-x-2 ${
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

      <ProgressoGeralComponent />
      <FiltroTarefas />
      <NovaTarefaModal />

      {/* Conteúdo baseado na tab ativa */}
      {activeTab === "funcionarios" && <ListaTarefas />}
      {activeTab === "dashboard" && <DashboardTarefas />}

      {/* Modal para concluir tarefa */}
      {mostrarModalConcluir && tarefaSelecionada && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Concluir Tarefa</h3>
              <button
                onClick={fecharModalConcluir}
                className="text-gray-500 hover:text-gray-700"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-6">
              <p className="text-gray-700 mb-4">
                Tem certeza que deseja concluir esta tarefa?
              </p>

              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <h4 className="font-medium text-gray-700 mb-2">
                  Detalhes da Tarefa
                </h4>
                <p className="text-xs text-gray-600">
                  <span className="font-medium">Tipo:</span>{" "}
                  {tarefaSelecionada.tipo}
                </p>
                <p className="text-xs text-gray-600">
                  <span className="font-medium">Descrição:</span>{" "}
                  {tarefaSelecionada.descricao}
                </p>
                <p className="text-xs text-gray-600">
                  <span className="font-medium">Funcionário:</span>{" "}
                  {"N/A"}
                </p>
              </div>

              {/* Campo de Data de Vencimento - Oculto para RH */}
              {tarefaSelecionada.responsavel !== "RH" && (
                <div className="mt-4">
                  <label
                    htmlFor="dataVencimento"
                    className="block text-xs font-medium text-gray-700 mb-2"
                  >
                    Data de Vencimento
                  </label>
                  <input
                    type="date"
                    id="dataVencimento"
                    value={dataVencimento}
                    onChange={(e) => setDataVencimento(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {erroDataVencimento && (
                    <p className="text-xs text-red-600 mt-1">{erroDataVencimento}</p>
                  )}
                  <p className="text-[10px] text-gray-500 mt-1">Obrigatório para Treinamento e Medicina. Prazo mínimo d+30.</p>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={fecharModalConcluir}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancelar
              </button>
              <button
                onClick={concluirTarefa}
                disabled={concluindoTarefa}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-xs font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-green-300"
              >
                {concluindoTarefa ? "Concluindo..." : "Concluir Tarefa"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para adicionar observações */}
      {mostrarModalObservacoes && tarefaSelecionada && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Observações da Tarefa</h3>
              <button
                onClick={fecharModalObservacoes}
                className="text-gray-500 hover:text-gray-700"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg mb-6">
              <h4 className="font-medium text-gray-700 mb-2">
                Detalhes da Tarefa
              </h4>
              <p className="text-xs text-gray-600">
                <span className="font-medium">Tipo:</span>{" "}
                {tarefaSelecionada.tipo}
              </p>
              <p className="text-xs text-gray-600">
                <span className="font-medium">Descrição:</span>{" "}
                {tarefaSelecionada.descricao}
              </p>
              <p className="text-xs text-gray-600">
                <span className="font-medium">Status:</span>{" "}
                {tarefaSelecionada.status}
              </p>
              <p className="text-xs text-gray-600">
                <span className="font-medium">Funcionário:</span>{" "}
                {"N/A"}
              </p>
              <p className="text-xs text-gray-600">
                <span className="font-medium">Data Limite Atual:</span>{" "}
                {tarefaSelecionada.dataLimite
                  ? new Date(tarefaSelecionada.dataLimite).toLocaleDateString(
                      "pt-BR"
                    )
                  : "Não definida"}
              </p>
            </div>

            {/* Abas para Observações e Data Limite */}
            <div className="mb-6">
              <div className="flex border-b border-gray-200">
                {/* Aba de 'Adicionar Observação' oculta temporariamente */}
                <button
                  onClick={() => setAbaAtiva("dataLimite")}
                  className={`py-2 px-4 font-medium text-xs ${
                    abaAtiva === "dataLimite"
                      ? "border-b-2 border-blue-500 text-blue-600"
                      : "text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  Alterar Data Limite
                </button>
              </div>

              {/* Conteúdo da aba de Observações oculto temporariamente */}

              {/* Conteúdo da aba de Data Limite */}
              {abaAtiva === "dataLimite" && (
                <div className="mt-4 border border-gray-200 rounded-lg p-4">
                  <h4 className="font-medium text-gray-700 mb-3">
                    Adicionar Observaação
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Nova Data Limite
                      </label>
                      <input
                        type="date"
                        value={novaDataLimite}
                        onChange={(e) => setNovaDataLimite(e.target.value)}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      {erroNovaDataLimite && (
                        <p className="text-xs text-red-600 mt-1">{erroNovaDataLimite}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Justificativa da Alteração
                      </label>
                      <textarea
                        value={justificativaDataLimite}
                        onChange={(e) =>
                          setJustificativaDataLimite(e.target.value)
                        }
                        placeholder="Informe o motivo da alteração da data limite..."
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={2}
                      />
                      {erroJustificativaDataLimite && (
                        <p className="text-xs text-red-600 mt-1">{erroJustificativaDataLimite}</p>
                      )}
                    </div>
                    <button
                      onClick={atualizarDataLimite}
                      disabled={atualizandoDataLimite}
                      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-green-300"
                    >
                      {atualizandoDataLimite
                        ? "Atualizando..."
                        : "Atualizar"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Lista de Observações */}
            <div>
              <h4 className="font-medium mb-3">Observações Existentes</h4>
              {carregandoObservacoes ? (
                <div className="flex items-center justify-center py-4">
                  <ClockIcon className="animate-spin h-5 w-5 mr-2 text-gray-500" />
                  <span className="text-gray-500">
                    Carregando observações...
                  </span>
                </div>
              ) : observacoes.length > 0 ? (
                <div className="space-y-3">
                  {observacoes.map((obs) => (
                    <div
                      key={obs.id}
                      className="border border-gray-200 rounded-lg p-4"
                    >
                      {observacaoEditando === obs.id ? (
                        <div className="space-y-3">
                          <textarea
                            value={textoEditado}
                            onChange={(e) => setTextoEditado(e.target.value)}
                            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            rows={3}
                          />
                          <div className="flex justify-end space-x-2">
                            <button
                              onClick={cancelarEdicaoObservacao}
                              className="px-3 py-1 text-xs border border-gray-300 rounded-md shadow-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={() => salvarEdicaoObservacao(obs.id)}
                              disabled={editandoObservacao}
                              className="px-3 py-1 text-xs border border-transparent rounded-md shadow-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300"
                            >
                              {editandoObservacao ? "Salvando..." : "Salvar"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-xs text-gray-800 whitespace-pre-wrap">
                              {obs.texto}
                            </p>
                            <div className="mt-2 text-xs text-gray-500">
                              <p>
                                <span className="mx-2">•</span>
                                <span>Criado por: {obs.criadoPor} em </span>
                                <span>
                                  {obs.criadoEm &&
                                  !isNaN(new Date(obs.criadoEm).getTime())
                                    ? new Date(obs.criadoEm).toLocaleDateString(
                                        "pt-BR",
                                        {
                                          day: "2-digit",
                                          month: "2-digit",
                                          year: "numeric",
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        }
                                      )
                                    : "Data não disponível"}
                                </span>
                              </p>
                              {obs.modificadoPor && (
                                <p>
                                  <span className="mx-2">•</span>
                                  <span>
                                    Editado por: {obs.modificadoPor} em{" "}
                                  </span>
                                  <span>
                                    {obs.modificadoEm &&
                                    !isNaN(
                                      new Date(obs.modificadoEm ?? "").getTime()
                                    )
                                      ? new Date(
                                          obs.modificadoEm ?? ""
                                        ).toLocaleDateString("pt-BR", {
                                          day: "2-digit",
                                          month: "2-digit",
                                          year: "numeric",
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })
                                      : "Data não disponível"}
                                  </span>
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => iniciarEdicaoObservacao(obs)}
                              className="text-gray-500 hover:text-blue-600"
                              title="Editar observação"
                            >
                              <PencilIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => excluirObservacao(obs.id)}
                              className="text-gray-500 hover:text-red-600"
                              title="Excluir observação"
                              disabled={excluindoObservacao}
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">
                  Nenhuma observação encontrada.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
