"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ExcelJS from "exceljs";
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
import ChartDataLabels from "chartjs-plugin-datalabels";
import { Doughnut, Bar } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  ChartDataLabels,
);
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  ChevronDownIcon,
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
  EllipsisVerticalIcon,
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
  funcionariosPendentes: number;
}

interface Funcionario {
  id: string;
  nome: string;
  matricula: string;
  funcao: string;
  status: string;
  statusPrestserv: string;
  emMigracao: boolean;
  dataAdmissao?: string | null;
  regimeTratado?: string | null;
}

// Usando a interface correta da estrutura hierárquica
interface FuncionarioRemanejamento extends Omit<
  SolicitacaoRemanejamento,
  "tipo"
> {
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
  const [filtroNomeList, setFiltroNomeList] = useState<string[]>([]);
  const [filtroStatusList, setFiltroStatusList] = useState<string[]>([]);
  const [filtroPrioridadeList, setFiltroPrioridadeList] = useState<string[]>(
    [],
  );
  const [filtroSetorList, setFiltroSetorList] = useState<string[]>([]);
  const [filtroContratoList, setFiltroContratoList] = useState<string[]>([]);
  // Novo: filtros por data de vencimento (intervalo)
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");
  // Novos filtros: tipo e categoria de data limite, e ordenação por data limite
  const [filtroTipoList, setFiltroTipoList] = useState<string[]>([]);
  const [filtroDataCategoria, setFiltroDataCategoria] = useState<
    "" | "VENCIDOS" | "A_VENCER" | "NO_PRAZO" | "SEM_DATA" | "NOVO"
  >("");
  const [ordenacaoDataLimite, setOrdenacaoDataLimite] = useState<
    "" | "asc" | "desc"
  >("");
  const [filtroDataExata, setFiltroDataExata] = useState("");
  const [dropdownStatusOpen, setDropdownStatusOpen] = useState(false);
  const [dropdownPrioridadeOpen, setDropdownPrioridadeOpen] = useState(false);
  const [dropdownContratoOpen, setDropdownContratoOpen] = useState(false);
  const [dropdownSetorOpen, setDropdownSetorOpen] = useState(false);
  const [dropdownTipoOpen, setDropdownTipoOpen] = useState(false);
  const [dropdownNomeOpen, setDropdownNomeOpen] = useState(false);
  const [dropdownOrdenacaoOpen, setDropdownOrdenacaoOpen] = useState(false);
  const [dropdownDataCriacaoOpen, setDropdownDataCriacaoOpen] = useState(false);
  const [dropdownDataLimiteOpen, setDropdownDataLimiteOpen] = useState(false);
  const [nomeSearchDraft, setNomeSearchDraft] = useState("");
  const FILTERS_CACHE_KEY = "tarefas_filters_v1";
  const [ordenacaoFuncionarios, setOrdenacaoFuncionarios] = useState<
    | ""
    | "PENDENCIAS_DESC"
    | "PENDENCIAS_ASC"
    | "PROGRESSO_DESC"
    | "PROGRESSO_ASC"
    | "NOME_AZ"
    | "NOME_ZA"
    | "ATUALIZACAO_DESC"
    | "ATUALIZACAO_ASC"
  >("");

  // Novos filtros de data (Range)
  const [filtroDataCriacaoInicio, setFiltroDataCriacaoInicio] = useState("");
  const [filtroDataCriacaoFim, setFiltroDataCriacaoFim] = useState("");
  const [filtroDataLimiteInicio, setFiltroDataLimiteInicio] = useState("");
  const [filtroDataLimiteFim, setFiltroDataLimiteFim] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(FILTERS_CACHE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw || "{}");
      if (Array.isArray(data.filtroStatusList))
        setFiltroStatusList(data.filtroStatusList);
      if (Array.isArray(data.filtroPrioridadeList))
        setFiltroPrioridadeList(data.filtroPrioridadeList);
      if (Array.isArray(data.filtroSetorList))
        setFiltroSetorList(data.filtroSetorList);
      if (Array.isArray(data.filtroContratoList))
        setFiltroContratoList(data.filtroContratoList);
      if (Array.isArray(data.filtroTipoList))
        setFiltroTipoList(data.filtroTipoList);
      if (typeof data.filtroDataCategoria === "string")
        setFiltroDataCategoria(data.filtroDataCategoria as any);
      if (typeof data.filtroDataExata === "string")
        setFiltroDataExata(data.filtroDataExata);
      if (typeof data.filtroDataCriacaoInicio === "string")
        setFiltroDataCriacaoInicio(data.filtroDataCriacaoInicio);
      if (typeof data.filtroDataCriacaoFim === "string")
        setFiltroDataCriacaoFim(data.filtroDataCriacaoFim);
      if (typeof data.filtroDataLimiteInicio === "string")
        setFiltroDataLimiteInicio(data.filtroDataLimiteInicio);
      if (typeof data.filtroDataLimiteFim === "string")
        setFiltroDataLimiteFim(data.filtroDataLimiteFim);
      if (Array.isArray(data.filtroNomeList))
        setFiltroNomeList(data.filtroNomeList);
      if (typeof data.ordenacaoDataLimite === "string")
        setOrdenacaoDataLimite(data.ordenacaoDataLimite as any);
      if (typeof data.ordenacaoFuncionarios === "string")
        setOrdenacaoFuncionarios(data.ordenacaoFuncionarios as any);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const data = {
        filtroStatusList,
        filtroPrioridadeList,
        filtroSetorList,
        filtroContratoList,
        filtroTipoList,
        filtroDataCategoria,
        filtroDataExata,
        filtroDataCriacaoInicio,
        filtroDataCriacaoFim,
        filtroDataLimiteInicio,
        filtroDataLimiteFim,
        filtroNomeList,
        ordenacaoDataLimite,
        ordenacaoFuncionarios,
      };
      localStorage.setItem(FILTERS_CACHE_KEY, JSON.stringify(data));
    } catch {}
  }, [
    filtroStatusList,
    filtroPrioridadeList,
    filtroSetorList,
    filtroContratoList,
    filtroTipoList,
    filtroDataCategoria,
    filtroDataExata,
    filtroDataCriacaoInicio,
    filtroDataCriacaoFim,
    filtroDataLimiteInicio,
    filtroDataLimiteFim,
    filtroNomeList,
    ordenacaoDataLimite,
    ordenacaoFuncionarios,
  ]);

  // Refs para evitar re-renderizações
  const filtroNomeRef = useRef<HTMLInputElement>(null);
  const nomeSearchInputRef = useRef<HTMLInputElement>(null);
  const controladorFetchRef = useRef<AbortController | null>(null);
  const fetchEmAndamentoRef = useRef(0);
  const tarefasCacheRef = useRef<
    Map<string, { ts: number; data: SolicitacaoRemanejamento[] }>
  >(new Map());
  const ultimaAtualizacaoRef = useRef<{
    tarefaId: string;
    previous?: TarefaRemanejamento;
  } | null>(null);

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
  const [observacoesCount, setObservacoesCount] = useState<
    Record<string, number>
  >({});

  // Estados para exclusão de tarefa (apenas administradores)
  const [mostrarModalExcluir, setMostrarModalExcluir] = useState(false);
  const [excluindoTarefa, setExcluindoTarefa] = useState(false);
  const isAdmin = !!usuario?.permissoes?.includes("admin");

  const [funcionariosExpandidos, setFuncionariosExpandidos] = useState<
    Set<string>
  >(new Set());

  // Paginação específica para visão por funcionários
  const [paginaAtualFuncionarios, setPaginaAtualFuncionarios] = useState(1);
  const [itensPorPaginaFuncionarios, setItensPorPaginaFuncionarios] =
    useState(5);
  const [focoRemKey, setFocoRemKey] = useState<string | null>(null);
  const ordemBaseRef = useRef<string[]>([]);
  const scrollYRef = useRef<number>(0);
  const docScrollYRef = useRef<number>(0);
  const getDefaultScrollContainer = () => {
    const custom =
      (document.querySelector('[data-scroll="main"]') as HTMLElement | null) ||
      null;
    return (
      custom ||
      (document.scrollingElement as HTMLElement) ||
      (document.documentElement as HTMLElement)
    );
  };
  const getScrollContainerFor = (key?: string | null) => {
    try {
      if (key) {
        const el = document.querySelector(
          `[data-grupo="${key}"]`,
        ) as HTMLElement | null;
        if (el) {
          let p: HTMLElement | null = el.parentElement as HTMLElement | null;
          while (p) {
            const style = getComputedStyle(p);
            const canScroll =
              (style.overflowY === "auto" || style.overflowY === "scroll") &&
              p.scrollHeight > p.clientHeight;
            if (canScroll) return p;
            p = p.parentElement as HTMLElement | null;
          }
        }
      }
    } catch {}
    return getDefaultScrollContainer();
  };
  const frozenScrollYRef = useRef<number>(0);
  const freezeScroll = () => {
    try {
      const cont = getScrollContainerFor(focoRemKey);
      const y = cont.scrollTop || 0;
      frozenScrollYRef.current = y;
      const scrollbarWidth =
        window.innerWidth - document.documentElement.clientWidth;
      cont.style.overflow = "hidden";
      if (scrollbarWidth > 0) {
        cont.style.paddingRight = `${scrollbarWidth}px`;
      }
      cont.scrollTop = y;
    } catch {}
  };
  const unfreezeScroll = () => {
    try {
      const cont = getScrollContainerFor(focoRemKey);
      const y = frozenScrollYRef.current || cont.scrollTop || 0;
      cont.style.overflow = "";
      cont.style.paddingRight = "";
      cont.scrollTop = y;
    } catch {}
  };
  const saveAnchorPos = (key?: string | null) => {
    try {
      const cont = getScrollContainerFor(key);
      docScrollYRef.current =
        window.scrollY ||
        (document.scrollingElement as HTMLElement)?.scrollTop ||
        0;
      if (key) {
        const el = document.querySelector(
          `[data-grupo="${key}"]`,
        ) as HTMLElement | null;
        if (el) {
          const y =
            el.getBoundingClientRect().top -
            cont.getBoundingClientRect().top +
            cont.scrollTop;
          scrollYRef.current = y;
          return;
        }
      }
      scrollYRef.current = cont.scrollTop || 0;
    } catch {}
  };
  const restoreAnchorPos = () => {
    try {
      const cont = getScrollContainerFor(focoRemKey);
      const target = scrollYRef.current || cont.scrollTop || 0;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          cont.scrollTo({ top: target });
          window.scrollTo(0, docScrollYRef.current || 0);
        });
      });
    } catch {}
  };

  const setFocusRem = (key: string) => {
    setFocoRemKey(key);
  };

  // Estados para tabs
  const [activeTab, setActiveTab] = useState<
    "funcionarios" | "concluidos" | "dashboard"
  >("funcionarios");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  useEffect(() => {
    setPaginaAtualFuncionarios(1);
  }, [activeTab]);

  useEffect(() => {
    setFocoRemKey(null);
    ordemBaseRef.current = [];
  }, [
    filtroNomeList,
    filtroStatusList,
    filtroPrioridadeList,
    filtroSetorList,
    filtroContratoList,
    filtroTipoList,
    filtroDataCategoria,
    filtroDataExata,
    ordenacaoDataLimite,
    ordenacaoFuncionarios,
    activeTab,
  ]);

  // Estados para dashboard
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [observacaoEditando, setObservacaoEditando] = useState<string | null>(
    null,
  );
  const [textoEditado, setTextoEditado] = useState("");
  const [editandoObservacao, setEditandoObservacao] = useState(false);
  const [excluindoObservacao, setExcluindoObservacao] = useState(false);
  const [novaDataLimite, setNovaDataLimite] = useState("");
  const [justificativaDataLimite, setJustificativaDataLimite] = useState("");
  const [erroNovaDataLimite, setErroNovaDataLimite] = useState<string>("");
  const [erroJustificativaDataLimite, setErroJustificativaDataLimite] =
    useState<string>("");
  const [atualizandoDataLimite, setAtualizandoDataLimite] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState<"observacoes" | "dataLimite">(
    "observacoes",
  );

  const [menuFuncionarioAtivo, setMenuFuncionarioAtivo] = useState<
    string | null
  >(null);
  const [mostrarModalInconsistencia, setMostrarModalInconsistencia] =
    useState(false);
  const [textoInconsistencia, setTextoInconsistencia] = useState("");
  const [remanejamentoSelecionado, setRemanejamentoSelecionado] = useState<{
    id: string;
    nome: string;
    matricula?: string;
  } | null>(null);
  const [salvandoInconsistencia, setSalvandoInconsistencia] = useState(false);
  const [mostrarModalVerObs, setMostrarModalVerObs] = useState(false);
  const [textoVerObs, setTextoVerObs] = useState("");
  const [tituloVerObs, setTituloVerObs] = useState("");

  useEffect(() => {
    if (dropdownNomeOpen && nomeSearchInputRef.current) {
      nomeSearchInputRef.current.focus();
    }
  }, [dropdownNomeOpen]);

  useEffect(() => {
    if (dropdownNomeOpen && nomeSearchInputRef.current) {
      const el = nomeSearchInputRef.current;
      if (document.activeElement !== el) {
        el.focus();
        try {
          const len = el.value?.length ?? 0;
          el.setSelectionRange(len, len);
        } catch {}
      }
    }
  }, [nomeSearchDraft, dropdownNomeOpen]);

  useEffect(() => {
    // Detectar o setor com base nos parâmetros da URL atual
    const setorParam = searchParams.get("setor");

    if (setorParam === "rh") {
      setSetorAtual("RH");
    } else if (setorParam === "medicina") {
      setSetorAtual("MEDICINA");
    } else if (setorParam === "treinamento") {
      setSetorAtual("TREINAMENTO");
    } else {
      setSetorAtual(null);
    }
  }, [searchParams]);

  const filtroSetorServidor = setorAtual || "";
  const filtrosServidorRef = useRef<{ setor: string } | null>(null);

  // Efeito separado para buscar tarefas quando o setor muda
  useEffect(() => {
    const setorAtualizado = filtroSetorServidor || "";
    const filtrosAnteriores = filtrosServidorRef.current;

    if (!filtrosAnteriores || filtrosAnteriores.setor !== setorAtualizado) {
      filtrosServidorRef.current = {
        setor: setorAtualizado,
      };
      fetchTodasTarefas();
    }
  }, [filtroSetorServidor]); // Removed fetchTodasTarefas from dependency array

  useEffect(() => {
    setPaginaAtualFuncionarios(1);
  }, [
    filtroNomeList,
    filtroStatusList,
    filtroPrioridadeList,
    filtroSetorList,
    filtroContratoList,
    filtroTipoList,
    filtroDataCategoria,
    filtroDataExata,
    filtroDataCriacaoInicio,
    filtroDataCriacaoFim,
    filtroDataLimiteInicio,
    filtroDataLimiteFim,
  ]);

  // Trabalhar diretamente com dados hierárquicos da API
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoRemanejamento[]>(
    [],
  );

  const fetchTodasTarefas = async () => {
    const cacheKey = filtroSetorServidor || "ALL";
    const now = Date.now();
    const TTL_MS = 120000;
    const cached = tarefasCacheRef.current.get(cacheKey);
    if (cached && now - cached.ts < TTL_MS) {
      setSolicitacoes(cached.data);
      setLoading(false);
      setError(null);
      return;
    }
    let fetchId = 0;
    let controladorAtual!: AbortController;
    try {
      fetchEmAndamentoRef.current += 1;
      fetchId = fetchEmAndamentoRef.current;
      if (controladorFetchRef.current) {
        controladorFetchRef.current.abort();
      }
      controladorAtual = new AbortController();
      controladorFetchRef.current = controladorAtual;
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      params.set("filtrarProcesso", "false");
      if (filtroSetorServidor) {
        params.set("responsavel", filtroSetorServidor);
      }
      const response = await fetch(
        `/api/logistica/remanejamentos?${params.toString()}`,
        { signal: controladorAtual.signal },
      );
      if (!response.ok) {
        throw new Error("Erro ao carregar dados de remanejamentos");
      }
      const data = await response.json();
      const solicitacoes =
        data && Array.isArray(data.solicitacoes)
          ? data.solicitacoes
          : Array.isArray(data)
            ? data
            : [];
      if (fetchEmAndamentoRef.current === fetchId) {
        tarefasCacheRef.current.set(cacheKey, {
          ts: Date.now(),
          data: solicitacoes,
        });
        setSolicitacoes(solicitacoes);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      if (fetchEmAndamentoRef.current === fetchId) {
        setLoading(false);
      }
    }
  };

  const fetchFuncionariosRemanejamento = async () => {
    try {
      setLoadingFuncionarios(true);
      // Adicionar parâmetro filtrarProcesso=true para filtrar apenas funcionários em processo
      const response = await fetch(
        "/api/logistica/remanejamentos?filtrarProcesso=true",
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

  const stripAccents = (s: string) =>
    (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const normalizeStatus = (s: string) =>
    stripAccents(s || "")
      .toUpperCase()
      .replace(/\s+/g, "_")
      .trim();
  const normalizePlain = (s: string) =>
    stripAccents(s || "")
      .toUpperCase()
      .trim();

  const getRemanejamentosFiltrados = () => {
    if (!solicitacoes.length) return [];

    const remanejamentosFiltrados: RemanejamentoFuncionario[] = [];

    solicitacoes.forEach((solicitacao: SolicitacaoRemanejamento) => {
      solicitacao.funcionarios?.forEach(
        (remanejamento: RemanejamentoFuncionario) => {
          // Aplicar filtros no nível do funcionário
          const nomeFuncionario = remanejamento.funcionario?.nome || "";
          const nomeFuncNorm = stripAccents(nomeFuncionario).toLowerCase();
          const matchNome =
            filtroNomeList.length === 0 ||
            filtroNomeList.some((term) =>
              nomeFuncNorm.includes(stripAccents(term).toLowerCase()),
            );

          if (!matchNome) return;

          const matchContrato =
            filtroContratoList.length === 0 ||
            filtroContratoList.includes(
              solicitacao.contratoOrigemId?.toString() || "",
            ) ||
            filtroContratoList.includes(
              solicitacao.contratoDestinoId?.toString() || "",
            );

          if (!matchContrato) return;

          // Excluir remanejamentos cancelados (não devem exibir tarefas)
          if (remanejamento.statusPrestserv === "CANCELADO") {
            return;
          }

          // Apenas remover tarefas canceladas; filtros de tarefa são aplicados
          // exclusivamente na visão por funcionários para não afetar a aba Concluídos.
          const tarefasSemCanceladas =
            remanejamento.tarefas?.filter(
              (tarefa: TarefaRemanejamento) => tarefa.status !== "CANCELADO",
            ) || [];

          // Só incluir remanejamento se possui alguma tarefa não cancelada
          if (tarefasSemCanceladas.length > 0) {
            remanejamentosFiltrados.push({
              ...remanejamento,
              tarefas: tarefasSemCanceladas,
              // Manter referência à solicitação
              solicitacao: solicitacao,
            } as RemanejamentoFuncionario & {
              solicitacao: SolicitacaoRemanejamento;
            });
          }
        },
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
      },
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
      (t) => t.status === "PENDENTE",
    ).length;
    const emAndamento = todasTarefas.filter(
      (t) => t.status === "EM_ANDAMENTO",
    ).length;
    // Removido status EM_ANDAMENTO conforme solicitação
    const concluidas = todasTarefas.filter(
      (t) =>
        t.status === "CONCLUIDO" ||
        t.status === "CONCLUIDA" ||
        t.status === "APROVADO",
    ).length;
    const reprovadas = todasTarefas.filter(
      (t) => t.status === "REPROVADO",
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

    // Calcular total de funcionários com tarefas pendentes (exclui concluídos e reprovados que não têm pendências)
    const funcionariosPendentes = remanejamentosFiltrados.filter((r) => {
      const tarefas = r.tarefas || [];
      if (tarefas.length === 0) return true; // Sem tarefas conta como pendente de análise
      const temPendente = tarefas.some((t) => t.status === "PENDENTE");
      const temReprovado = tarefas.some((t) => t.status === "REPROVADO");
      // Se tudo concluído, não conta. Se tem pendente ou reprovado, conta.
      return temPendente || temReprovado;
    }).length;

    return {
      total,
      pendentes,
      emAndamento,
      concluidas,
      atrasadas,
      reprovadas,
      funcionariosPendentes,
    };
  };

  const getTarefasFiltradas = () => {
    const remanejamentosFiltrados = getRemanejamentosParaVisaoFuncionarios();

    // Extrair todas as tarefas dos remanejamentos filtrados
    const todasTarefas: (TarefaRemanejamento & { funcionario?: any })[] = [];
    remanejamentosFiltrados.forEach((item) => {
      if (item.tarefas) {
        // Add funcionario data to each tarefa
        const tarefasComFuncionario = item.tarefas.map((tarefa) => ({
          ...tarefa,
          funcionario: item.funcionario,
        }));
        todasTarefas.push(...tarefasComFuncionario);
      }
    });

    return todasTarefas;
  };

  const limparFiltros = () => {
    if (filtroNomeRef.current) {
      filtroNomeRef.current.value = "";
    }
    setFiltroNome("");
    setFiltroNomeList([]);
    setFiltroStatusList([]);
    setFiltroPrioridadeList([]);
    setFiltroSetorList([]);
    setFiltroContratoList([]);
    setFiltroDataInicio("");
    setFiltroDataFim("");
    setFiltroDataCriacaoInicio("");
    setFiltroDataCriacaoFim("");
    setFiltroDataLimiteInicio("");
    setFiltroDataLimiteFim("");
    setFiltroTipoList([]);
    setFiltroDataCategoria("");
    setOrdenacaoDataLimite("");
    setFiltroDataExata("");
    setPaginaAtualFuncionarios(1);
    try {
      localStorage.removeItem(FILTERS_CACHE_KEY);
    } catch {}
  };

  const removerFiltroIndividual = (tipoFiltro: string, valor?: string) => {
    switch (tipoFiltro) {
      case "status":
        if (valor) {
          setFiltroStatusList((prev) => prev.filter((s) => s !== valor));
        } else {
          setFiltroStatusList([]);
        }
        break;
      case "prioridade":
        if (valor) {
          setFiltroPrioridadeList((prev) => prev.filter((p) => p !== valor));
        } else {
          setFiltroPrioridadeList([]);
        }
        break;
      case "contrato":
        if (valor) {
          setFiltroContratoList((prev) => prev.filter((c) => c !== valor));
        } else {
          setFiltroContratoList([]);
        }
        break;
      case "setor":
        if (valor) {
          setFiltroSetorList((prev) => prev.filter((s) => s !== valor));
        } else {
          setFiltroSetorList([]);
        }
        break;
      case "tipo":
        if (valor) {
          setFiltroTipoList((prev) => prev.filter((t) => t !== valor));
        } else {
          setFiltroTipoList([]);
        }
        break;
      case "nome":
        if (valor) {
          setFiltroNomeList((prev) =>
            prev.filter(
              (v) =>
                stripAccents(v).toLowerCase() !==
                stripAccents(valor).toLowerCase(),
            ),
          );
        } else {
          setFiltroNomeList([]);
        }
        if (filtroNomeRef.current) filtroNomeRef.current.value = "";
        break;
      case "dataCategoria":
        setFiltroDataCategoria("");
        break;
      case "dataExata":
        setFiltroDataExata("");
        break;
      case "dataCriacao":
        setFiltroDataCriacaoInicio("");
        setFiltroDataCriacaoFim("");
        break;
      case "dataLimite":
        setFiltroDataLimiteInicio("");
        setFiltroDataLimiteFim("");
        break;
    }
  };

  const obterTagsFiltrosAtivos = () => {
    const tags: Array<{ tipo: string; valor: string; label: string }> = [];
    filtroNomeList.forEach((nome) => {
      tags.push({
        tipo: "nome",
        valor: nome,
        label: `Nome: ${nome}`,
      });
    });
    filtroStatusList.forEach((status) => {
      tags.push({
        tipo: "status",
        valor: status,
        label:
          status === "CONCLUIDO"
            ? "Status: Concluída"
            : status === "PENDENTE"
              ? "Status: Pendente"
              : "Status: Reprovado",
      });
    });
    filtroPrioridadeList.forEach((p) => {
      tags.push({ tipo: "prioridade", valor: p, label: `Prioridade: ${p}` });
    });
    filtroContratoList.forEach((id) => {
      const c = solicitacoes
        .flatMap(
          (s) => [s.contratoOrigem, s.contratoDestino].filter(Boolean) as any[],
        )
        .find((cc: any) => cc?.id?.toString() === id);
      const label = c && c.numero && c.nome ? `${c.numero} — ${c.nome}` : id;
      tags.push({ tipo: "contrato", valor: id, label: `Contrato: ${label}` });
    });
    if (!setorAtual) {
      filtroSetorList.forEach((s) => {
        tags.push({ tipo: "setor", valor: s, label: `Setor: ${s}` });
      });
    }
    filtroTipoList.forEach((t) => {
      tags.push({ tipo: "tipo", valor: t, label: `Tipo: ${t}` });
    });
    if (filtroDataCategoria) {
      const map: Record<string, string> = {
        VENCIDOS: "Vencidos",
        A_VENCER: "Próximo de vencer",
        NO_PRAZO: "No prazo",
        SEM_DATA: "Sem data",
        NOVO: "Novo",
      };
      tags.push({
        tipo: "dataCategoria",
        valor: filtroDataCategoria,
        label: `Categoria: ${map[filtroDataCategoria] || filtroDataCategoria}`,
      });
    }
    if (filtroDataExata) {
      tags.push({
        tipo: "dataExata",
        valor: filtroDataExata,
        label: `Data limite: ${filtroDataExata}`,
      });
    }
    if (filtroDataCriacaoInicio || filtroDataCriacaoFim) {
      let label = "Criação: ";
      if (filtroDataCriacaoInicio && filtroDataCriacaoFim) {
        label += `${new Date(filtroDataCriacaoInicio).toLocaleDateString("pt-BR")} até ${new Date(filtroDataCriacaoFim).toLocaleDateString("pt-BR")}`;
      } else if (filtroDataCriacaoInicio) {
        label += `após ${new Date(filtroDataCriacaoInicio).toLocaleDateString("pt-BR")}`;
      } else {
        label += `antes de ${new Date(filtroDataCriacaoFim).toLocaleDateString("pt-BR")}`;
      }
      tags.push({
        tipo: "dataCriacao",
        valor: "range",
        label,
      });
    }
    if (filtroDataLimiteInicio || filtroDataLimiteFim) {
      let label = "Limite: ";
      if (filtroDataLimiteInicio && filtroDataLimiteFim) {
        label += `${new Date(filtroDataLimiteInicio).toLocaleDateString("pt-BR")} até ${new Date(filtroDataLimiteFim).toLocaleDateString("pt-BR")}`;
      } else if (filtroDataLimiteInicio) {
        label += `após ${new Date(filtroDataLimiteInicio).toLocaleDateString("pt-BR")}`;
      } else {
        label += `antes de ${new Date(filtroDataLimiteFim).toLocaleDateString("pt-BR")}`;
      }
      tags.push({
        tipo: "dataLimite",
        valor: "range",
        label,
      });
    }
    return tags;
  };

  const exportarParaExcel = async () => {
    const tarefasFiltradas = getTarefasFiltradas();

    // Buscar últimas observações em um único request (POST)
    const ids = Array.from(new Set((tarefasFiltradas || []).map((t) => t.id)));
    let ultimaObsMap: Record<
      string,
      {
        texto?: string;
        criadoEm?: string;
        criadoPor?: string;
        modificadoEm?: string;
        modificadoPor?: string;
      }
    > = {};
    try {
      if (ids.length > 0) {
        const resp = await fetch(`/api/logistica/tarefas/observacoes/ultima`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids }),
        });
        if (resp.ok) {
          ultimaObsMap = await resp.json();
        } else {
          console.warn(
            "Falha ao obter última observação (status):",
            resp.status,
          );
        }
      }
    } catch (err) {
      console.error("Erro ao obter última observação para exportação:", err);
    }

    const dadosExcel = tarefasFiltradas.map((tarefa) => ({
      ID: tarefa.id,
      Tipo: tarefa.tipo,
      Descrição: tarefa.descricao,
      Status: tarefa.status,
      Prioridade: tarefa.prioridade,
      "Data Limite": tarefa.dataLimite
        ? new Date(tarefa.dataLimite).toLocaleDateString("pt-BR")
        : "N/A",
      "Data Conclusão": tarefa.dataConclusao
        ? new Date(tarefa.dataConclusao).toLocaleDateString("pt-BR")
        : "N/A",
      "Data Criação": new Date(tarefa.dataCriacao).toLocaleDateString("pt-BR"),
      Funcionário: tarefa.funcionario?.nome || "N/A",
      Matrícula: tarefa.funcionario?.matricula || "N/A",
      Função: tarefa.funcionario?.funcao || "N/A",
      "Setor Responsável": tarefa.responsavel,
      "Última Observação": ultimaObsMap[tarefa.id]?.texto || "N/A",
    }));

    // Gerar Excel com exceljs e auto largura de colunas
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Tarefas");

    const headers = [
      "ID",
      "Tipo",
      "Descrição",
      "Status",
      "Prioridade",
      "Data Limite",
      "Data Conclusão",
      "Data Criação",
      "Funcionário",
      "Matrícula",
      "Função",
      "Setor Responsável",
      "Última Observação",
    ];

    ws.addRow(headers);
    dadosExcel.forEach((row) => {
      ws.addRow(headers.map((h) => String((row as any)[h] ?? "")));
    });

    // Estilo simples do header
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true };
    headerRow.alignment = { vertical: "middle", horizontal: "left" } as any;

    // Auto largura baseado no maior conteúdo de cada coluna
    for (let colIndex = 1; colIndex <= headers.length; colIndex++) {
      let maxLen = String(headers[colIndex - 1] || "").length;
      ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        const cell = row.getCell(colIndex);
        const v = cell.value as
          | string
          | number
          | boolean
          | Date
          | null
          | undefined;
        const text =
          v instanceof Date ? v.toLocaleDateString("pt-BR") : String(v ?? "");
        if (text.length > maxLen) maxLen = text.length;
      });
      ws.getColumn(colIndex).width = Math.min(60, maxLen + 2);
    }

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Tarefas_Exportadas.xlsx";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);

    toast.success("Tarefas exportadas com sucesso!");
  };

  // Função para carregar contagem de observações sob demanda para as tarefas do grupo
  const carregarObservacoesCountParaGrupo = async (
    tarefas: TarefaRemanejamento[],
  ) => {
    const ids = Array.from(new Set((tarefas || []).map((t) => t.id)));
    if (ids.length === 0) return;
    try {
      const qs = encodeURIComponent(ids.join(","));
      const resp = await fetch(
        `/api/logistica/tarefas/observacoes/count?ids=${qs}`,
      );
      if (!resp.ok) throw new Error("Erro ao contar observações");
      const data = await resp.json();
      const normalized = Object.fromEntries(
        Object.entries(data || {}).map(([k, v]) => [String(k), v as number]),
      );
      setObservacoesCount((prev) => ({ ...prev, ...normalized }));
    } catch (err) {
      console.error("Erro ao contar observações:", err);
    }
  };

  // Função para expandir/contrair funcionários
  const toggleExpandirFuncionario = async (
    chaveGrupo: string,
    tarefas: TarefaRemanejamento[],
  ) => {
    const novoExpandido = new Set(funcionariosExpandidos);
    const isExpanded = novoExpandido.has(chaveGrupo);
    if (isExpanded) {
      novoExpandido.delete(chaveGrupo);
      if (focoRemKey === chaveGrupo) setFocoRemKey(null);
    } else {
      novoExpandido.add(chaveGrupo);
      // Carregar contagem de observações apenas ao expandir
      carregarObservacoesCountParaGrupo(tarefas);
      setFocusRem(chaveGrupo);
    }
    setFuncionariosExpandidos(novoExpandido);
  };

  // Função para obter remanejamentos com suas tarefas para a visão por funcionários
  const getRemanejamentosParaVisaoFuncionarios = () => {
    const remanejamentosFiltrados = getRemanejamentosFiltrados();

    const funcionariosComTarefas = remanejamentosFiltrados
      .map((remanejamento) => {
        // Filtrar tarefas SOMENTE para a visão por funcionários:
        // - Setor (quando setorAtual definido ou lista selecionada)
        // - Status (filtroStatusList)
        // - Prioridade, Tipo, Categoria de Data, Data Exata
        const tarefasFiltradas =
          (remanejamento.tarefas || []).filter(
            (tarefa: TarefaRemanejamento) => {
              // Setor
              const matchSetor = setorAtual
                ? normalizePlain(tarefa.responsavel) ===
                  normalizePlain(setorAtual)
                : filtroSetorList.length === 0 ||
                  filtroSetorList
                    .map((s) => normalizePlain(s))
                    .includes(normalizePlain(tarefa.responsavel));

              // Status (união dos selecionados)
              let matchStatus = true;
              if (filtroStatusList.length > 0) {
                const statusNorm = normalizeStatus(tarefa.status || "");
                matchStatus = filtroStatusList.some((sel) => {
                  if (sel === "CONCLUIDO") {
                    return (
                      statusNorm === "CONCLUIDO" || statusNorm === "CONCLUIDA"
                    );
                  }
                  if (sel === "PENDENTE") {
                    return (
                      statusNorm === "PENDENTE" || statusNorm === "EM_ANDAMENTO"
                    );
                  }
                  if (sel === "REPROVADO") {
                    return statusNorm === "REPROVADO";
                  }
                  return false;
                });
              }

              // Prioridade
              const matchPrioridade =
                filtroPrioridadeList.length === 0 ||
                filtroPrioridadeList.includes(tarefa.prioridade);

              // Tipo
              const matchTipo =
                filtroTipoList.length === 0 ||
                filtroTipoList.includes(tarefa.tipo || "");

              // Categoria de Data Limite
              let matchDataCategoria = true;
              if (filtroDataCategoria) {
                if (filtroDataCategoria === "NOVO") {
                  const criadoMs = tarefa.dataCriacao
                    ? new Date(tarefa.dataCriacao).getTime()
                    : 0;
                  const nowMs = Date.now();
                  matchDataCategoria =
                    !!tarefa.dataCriacao &&
                    criadoMs <= nowMs &&
                    nowMs - criadoMs <= 48 * 60 * 60 * 1000;
                } else {
                  const hoje = new Date();
                  hoje.setHours(0, 0, 0, 0);
                  const dataLimiteDate = tarefa.dataLimite
                    ? new Date(tarefa.dataLimite)
                    : null;
                  const notConcluida =
                    tarefa.status !== "CONCLUIDO" &&
                    tarefa.status !== "CONCLUIDA";

                  if (filtroDataCategoria === "SEM_DATA") {
                    matchDataCategoria = notConcluida && !dataLimiteDate;
                  } else if (!dataLimiteDate) {
                    matchDataCategoria = false;
                  } else {
                    const diffDias = Math.floor(
                      (dataLimiteDate.getTime() - hoje.getTime()) / 86400000,
                    );
                    const limiteA_Vencer = 7;
                    if (filtroDataCategoria === "VENCIDOS") {
                      matchDataCategoria =
                        notConcluida && dataLimiteDate < hoje;
                    } else if (filtroDataCategoria === "A_VENCER") {
                      matchDataCategoria =
                        notConcluida &&
                        diffDias >= 0 &&
                        diffDias <= limiteA_Vencer;
                    } else if (filtroDataCategoria === "NO_PRAZO") {
                      matchDataCategoria =
                        notConcluida && diffDias > limiteA_Vencer;
                    }
                  }
                }
              }

              // Data Limite Exata
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

              // Filtro Data Criação Range
              let matchDataCriacao = true;
              if (filtroDataCriacaoInicio || filtroDataCriacaoFim) {
                const dataCriacao = tarefa.dataCriacao
                  ? new Date(tarefa.dataCriacao)
                  : null;
                if (!dataCriacao) {
                  matchDataCriacao = false;
                } else {
                  dataCriacao.setHours(0, 0, 0, 0);
                  if (filtroDataCriacaoInicio) {
                    const inicio = new Date(filtroDataCriacaoInicio);
                    inicio.setHours(0, 0, 0, 0);
                    if (dataCriacao < inicio) matchDataCriacao = false;
                  }
                  if (matchDataCriacao && filtroDataCriacaoFim) {
                    const fim = new Date(filtroDataCriacaoFim);
                    fim.setHours(0, 0, 0, 0);
                    if (dataCriacao > fim) matchDataCriacao = false;
                  }
                }
              }

              // Filtro Data Limite Range
              let matchDataLimiteRange = true;
              if (filtroDataLimiteInicio || filtroDataLimiteFim) {
                const dataLimite = tarefa.dataLimite
                  ? new Date(tarefa.dataLimite)
                  : null;
                if (!dataLimite) {
                  matchDataLimiteRange = false;
                } else {
                  dataLimite.setHours(0, 0, 0, 0);
                  if (filtroDataLimiteInicio) {
                    const inicio = new Date(filtroDataLimiteInicio);
                    inicio.setHours(0, 0, 0, 0);
                    if (dataLimite < inicio) matchDataLimiteRange = false;
                  }
                  if (matchDataLimiteRange && filtroDataLimiteFim) {
                    const fim = new Date(filtroDataLimiteFim);
                    fim.setHours(0, 0, 0, 0);
                    if (dataLimite > fim) matchDataLimiteRange = false;
                  }
                }
              }

              return (
                matchSetor &&
                matchStatus &&
                matchPrioridade &&
                matchTipo &&
                matchDataCategoria &&
                matchDataExata &&
                matchDataCriacao &&
                matchDataLimiteRange
              );
            },
          ) || [];

        // Ordenação das tarefas do grupo (pular se estiver com foco neste funcionário)
        {
          const chaveGrupo = `${remanejamento.funcionario?.id}_${remanejamento.id}`;
          if (!focoRemKey || focoRemKey !== chaveGrupo) {
            tarefasFiltradas.sort(
              (a: TarefaRemanejamento, b: TarefaRemanejamento) => {
                if (ordenacaoDataLimite) {
                  const aTime = a.dataLimite
                    ? new Date(a.dataLimite).getTime()
                    : Number.POSITIVE_INFINITY;
                  const bTime = b.dataLimite
                    ? new Date(b.dataLimite).getTime()
                    : Number.POSITIVE_INFINITY;
                  const diff = aTime - bTime;
                  return ordenacaoDataLimite === "asc" ? diff : -diff;
                }
                // Função para obter prioridade do status
                const getStatusPriority = (status: string) => {
                  if (status === "REPROVADO") return 0;
                  if (status === "PENDENTE" || status === "EM_ANDAMENTO")
                    return 1;
                  if (status === "CONCLUIDA" || status === "CONCLUIDO")
                    return 2;
                  return 3;
                };

                const priorityA = getStatusPriority(a.status);
                const priorityB = getStatusPriority(b.status);

                return priorityA - priorityB;
              },
            );
          }
        }

        return {
          funcionario: remanejamento.funcionario!,
          tarefas: tarefasFiltradas,
          remanejamento: remanejamento,
          solicitacao: (remanejamento as any).solicitacao,
        };
      })
      .filter((item) => item.tarefas.length > 0);

    funcionariosComTarefas.sort((a, b) => {
      const concluidasA = a.tarefas.filter(
        (t) => t.status === "CONCLUIDA" || t.status === "CONCLUIDO",
      ).length;
      const concluidasB = b.tarefas.filter(
        (t) => t.status === "CONCLUIDA" || t.status === "CONCLUIDO",
      ).length;
      const totalA = a.tarefas.length;
      const totalB = b.tarefas.length;
      const reprovadasA = a.tarefas.filter(
        (t) => t.status === "REPROVADO",
      ).length;
      const reprovadasB = b.tarefas.filter(
        (t) => t.status === "REPROVADO",
      ).length;
      const pendentesA = a.tarefas.filter(
        (t) => t.status === "PENDENTE" || t.status === "EM_ANDAMENTO",
      ).length;
      const pendentesB = b.tarefas.filter(
        (t) => t.status === "PENDENTE" || t.status === "EM_ANDAMENTO",
      ).length;
      const pendenciasA = pendentesA + reprovadasA;
      const pendenciasB = pendentesB + reprovadasB;
      const progressoA = totalA > 0 ? concluidasA / totalA : 0;
      const progressoB = totalB > 0 ? concluidasB / totalB : 0;
      const nomeCmp = a.funcionario.nome.localeCompare(b.funcionario.nome);
      const maxTs = (it: typeof a) => {
        let max = 0;
        for (const t of it.tarefas) {
          const candidates: (string | null | undefined)[] = [
            (t as any).dataAtualizacao,
            t.dataConclusao,
            t.dataCriacao,
            t.dataLimite,
          ];
          for (const c of candidates) {
            if (!c) continue;
            const ts = new Date(c).getTime();
            if (Number.isFinite(ts)) {
              if (ts > max) max = ts;
            }
          }
        }
        return max;
      };
      if (ordenacaoFuncionarios === "PENDENCIAS_DESC")
        return pendenciasB - pendenciasA || nomeCmp;
      if (ordenacaoFuncionarios === "PENDENCIAS_ASC")
        return pendenciasA - pendenciasB || nomeCmp;
      if (ordenacaoFuncionarios === "PROGRESSO_DESC")
        return progressoB - progressoA || nomeCmp;
      if (ordenacaoFuncionarios === "PROGRESSO_ASC")
        return progressoA - progressoB || nomeCmp;
      if (ordenacaoFuncionarios === "NOME_AZ") return nomeCmp;
      if (ordenacaoFuncionarios === "NOME_ZA") return -nomeCmp;
      if (ordenacaoFuncionarios === "ATUALIZACAO_DESC")
        return maxTs(b) - maxTs(a) || nomeCmp;
      if (ordenacaoFuncionarios === "ATUALIZACAO_ASC")
        return maxTs(a) - maxTs(b) || nomeCmp;
      const hasReprovado_A = reprovadasA > 0;
      const hasReprovado_B = reprovadasB > 0;
      const isPendente_A = concluidasA === 0 && !hasReprovado_A;
      const isPendente_B = concluidasB === 0 && !hasReprovado_B;
      const isConcluido_A = concluidasA === totalA && totalA > 0;
      const isConcluido_B = concluidasB === totalB && totalB > 0;
      if (hasReprovado_A && !hasReprovado_B) return -1;
      if (!hasReprovado_A && hasReprovado_B) return 1;
      if (!hasReprovado_A && !hasReprovado_B) {
        if (isPendente_A && !isPendente_B) return -1;
        if (!isPendente_A && isPendente_B) return 1;
        if (isConcluido_A && !isConcluido_B) return 1;
        if (!isConcluido_A && isConcluido_B) return -1;
      }
      return nomeCmp;
    });

    const currentKeys = funcionariosComTarefas.map(
      (it) => `${it.funcionario.id}_${it.remanejamento.id}`,
    );
    if (!focoRemKey) {
      ordemBaseRef.current = currentKeys;
    } else {
      const baseIndex = new Map<string, number>();
      ordemBaseRef.current.forEach((k, i) => baseIndex.set(k, i));
      funcionariosComTarefas.sort((a, b) => {
        const ka = `${a.funcionario.id}_${a.remanejamento.id}`;
        const kb = `${b.funcionario.id}_${b.remanejamento.id}`;
        const ia = baseIndex.has(ka)
          ? baseIndex.get(ka)!
          : Number.MAX_SAFE_INTEGER;
        const ib = baseIndex.has(kb)
          ? baseIndex.get(kb)!
          : Number.MAX_SAFE_INTEGER;
        return ia - ib;
      });
    }

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
    [],
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
    saveAnchorPos(focoRemKey);
    setTarefaSelecionada(tarefa);
    setDataVencimento(""); // Resetar a data de vencimento
    setErroDataVencimento("");
    setMostrarModalConcluir(true);
    requestAnimationFrame(() => restoreAnchorPos());
  };

  const fecharModalConcluir = () => {
    setTarefaSelecionada(null);
    setDataVencimento("");
    setErroDataVencimento("");
    setMostrarModalConcluir(false);
    restoreAnchorPos();
  };

  const concluirTarefa = async () => {
    if (!tarefaSelecionada) return;
    try {
      // Preservar âncora visual do grupo em foco para evitar salto de rolagem
      saveAnchorPos(focoRemKey);
      if (dataVencimento) {
        const hoje = new Date();
        const dt = new Date(`${dataVencimento}T00:00:00`);
        const hojeDateOnly = new Date(
          `${hoje.toISOString().split("T")[0]}T00:00:00`,
        );
        const diffMs = dt.getTime() - hojeDateOnly.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays < 30) {
          setErroDataVencimento(
            "A data deve ser pelo menos 30 dias após hoje.",
          );
          return;
        }
      }
      const tarefaId = tarefaSelecionada.id;
      const cacheKey = filtroSetorServidor || "ALL";
      const concluidaEmIso = new Date().toISOString();
      const novoStatus = "CONCLUIDO";
      let snapshot: TarefaRemanejamento | null = null;
      setSolicitacoes((prev) =>
        prev.map((sol) => ({
          ...sol,
          funcionarios: (sol.funcionarios || []).map((rem) => ({
            ...rem,
            tarefas: (rem.tarefas || []).map((t) => {
              if (t.id === tarefaId) {
                snapshot = { ...t };
                return {
                  ...t,
                  status: novoStatus,
                  dataConclusao: concluidaEmIso,
                  dataVencimento: dataVencimento
                    ? dataVencimento
                    : t.dataVencimento,
                };
              }
              return t;
            }),
          })),
        })),
      );
      if (snapshot) {
        ultimaAtualizacaoRef.current = { tarefaId, previous: snapshot };
      }
      const cached = tarefasCacheRef.current.get(cacheKey);
      if (cached) {
        const updated = cached.data.map((sol) => ({
          ...sol,
          funcionarios: (sol.funcionarios || []).map((rem) => ({
            ...rem,
            tarefas: (rem.tarefas || []).map((t) =>
              t.id === tarefaId
                ? {
                    ...t,
                    status: novoStatus,
                    dataConclusao: concluidaEmIso,
                    dataVencimento: dataVencimento
                      ? dataVencimento
                      : t.dataVencimento,
                  }
                : t,
            ),
          })),
        }));
        tarefasCacheRef.current.set(cacheKey, {
          ts: Date.now(),
          data: updated,
        });
      }
      fecharModalConcluir();
      setConcluindoTarefa(true);
      // Restaurar rolagem após a atualização otimista mantendo a âncora
      restoreAnchorPos();
      const response = await fetch(
        `/api/logistica/tarefas/${tarefaSelecionada.id}/concluir`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dataVencimento: dataVencimento || null,
          }),
        },
      );
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const msg = errorData?.error || "Erro ao concluir tarefa";
        const last = ultimaAtualizacaoRef.current;
        if (last && last.tarefaId === tarefaId && last.previous) {
          setSolicitacoes((prev) =>
            prev.map((sol) => ({
              ...sol,
              funcionarios: (sol.funcionarios || []).map((rem) => ({
                ...rem,
                tarefas: (rem.tarefas || []).map((t) =>
                  t.id === last.tarefaId
                    ? (last.previous as TarefaRemanejamento)
                    : t,
                ),
              })),
            })),
          );
          const cached2 = tarefasCacheRef.current.get(cacheKey);
          if (cached2) {
            const reverted = cached2.data.map((sol) => ({
              ...sol,
              funcionarios: (sol.funcionarios || []).map((rem) => ({
                ...rem,
                tarefas: (rem.tarefas || []).map((t) =>
                  t.id === last.tarefaId
                    ? (last.previous as TarefaRemanejamento)
                    : t,
                ),
              })),
            }));
            tarefasCacheRef.current.set(cacheKey, {
              ts: Date.now(),
              data: reverted,
            });
          }
        }
        toast.error(msg);
        throw new Error(msg);
      }
      toast.success("Tarefa concluída com sucesso!");
    } catch (error) {
      console.error("Erro ao concluir tarefa:", error);
      if (
        error instanceof Error &&
        error.message.startsWith("Data de vencimento")
      ) {
      } else {
        toast.error("Erro ao concluir tarefa");
      }
    } finally {
      setConcluindoTarefa(false);
    }
  };

  // Funções para exclusão de tarefa (admin)
  const abrirModalExcluir = (tarefa: TarefaRemanejamento) => {
    saveAnchorPos(focoRemKey);
    setTarefaSelecionada(tarefa);
    setMostrarModalExcluir(true);
    requestAnimationFrame(() => restoreAnchorPos());
  };

  const fecharModalExcluir = () => {
    setMostrarModalExcluir(false);
    restoreAnchorPos();
  };

  const excluirTarefa = async () => {
    if (!tarefaSelecionada) return;
    try {
      const tarefaId = tarefaSelecionada.id;
      const cacheKey = filtroSetorServidor || "ALL";
      let snapshot: TarefaRemanejamento | null = null;
      setSolicitacoes((prev) =>
        prev.map((sol) => ({
          ...sol,
          funcionarios: (sol.funcionarios || []).map((rem) => ({
            ...rem,
            tarefas: (rem.tarefas || []).filter((t) => {
              if (t.id === tarefaId) snapshot = { ...t };
              return t.id !== tarefaId;
            }),
          })),
        })),
      );
      if (snapshot) {
        ultimaAtualizacaoRef.current = { tarefaId, previous: snapshot };
      }
      const cached = tarefasCacheRef.current.get(cacheKey);
      if (cached) {
        const updated = cached.data.map((sol) => ({
          ...sol,
          funcionarios: (sol.funcionarios || []).map((rem) => ({
            ...rem,
            tarefas: (rem.tarefas || []).filter((t) => t.id !== tarefaId),
          })),
        }));
        tarefasCacheRef.current.set(cacheKey, {
          ts: Date.now(),
          data: updated,
        });
      }
      setExcluindoTarefa(true);
      const resp = await fetch(
        `/api/logistica/tarefas/${tarefaSelecionada.id}`,
        {
          method: "DELETE",
        },
      );
      if (!resp.ok) {
        const errorData = await resp.json().catch(() => null);
        const msg = errorData?.error || "Erro ao excluir tarefa";
        const last = ultimaAtualizacaoRef.current;
        if (last && last.tarefaId === tarefaId && last.previous) {
          setSolicitacoes((prev) =>
            prev.map((sol) => ({
              ...sol,
              funcionarios: (sol.funcionarios || []).map((rem) => ({
                ...rem,
                tarefas: [
                  last.previous,
                  ...(rem.tarefas || []).filter((t) => t.id !== last.tarefaId),
                ],
              })),
            })),
          );
          const cached2 = tarefasCacheRef.current.get(cacheKey);
          if (cached2) {
            const reverted = cached2.data.map((sol) => ({
              ...sol,
              funcionarios: (sol.funcionarios || []).map((rem) => ({
                ...rem,
                tarefas: [
                  last.previous,
                  ...(rem.tarefas || []).filter((t) => t.id !== last.tarefaId),
                ],
              })),
            }));
            tarefasCacheRef.current.set(cacheKey, {
              ts: Date.now(),
              data: reverted,
            });
          }
        }
        toast.error(msg);
        throw new Error(msg);
      }
      toast.success("Tarefa excluída com sucesso!");
      fecharModalExcluir();
    } catch (error) {
      console.error("Erro ao excluir tarefa:", error);
      toast.error("Erro ao excluir tarefa");
    } finally {
      setExcluindoTarefa(false);
    }
  };

  // Funções para o modal de observações
  const abrirModalObservacoes = async (tarefa: TarefaRemanejamento) => {
    saveAnchorPos(focoRemKey);
    setTarefaSelecionada(tarefa);
    setMostrarModalObservacoes(true);
    requestAnimationFrame(() => restoreAnchorPos());
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
    // atualização de observações não necessita recarregar toda a lista
    restoreAnchorPos();
  };

  const buscarObservacoes = async (tarefaId: string) => {
    try {
      setCarregandoObservacoes(true);
      const response = await fetch(
        `/api/logistica/tarefas/${tarefaId}/observacoes`,
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
        },
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
        },
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
        },
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

  const salvarInconsistencia = async () => {
    if (!remanejamentoSelecionado || !textoInconsistencia.trim()) {
      toast.error("Descreva a inconsistência");
      return;
    }
    try {
      setSalvandoInconsistencia(true);
      const respGet = await fetch(
        `/api/logistica/funcionario/${remanejamentoSelecionado.id}`,
      );
      if (!respGet.ok) {
        toast.error("Falha ao carregar dados do funcionário");
        return;
      }
      const dados = await respGet.json();
      const anterior: string = dados?.observacoesPrestserv || "";
      const agora = new Date();
      const stamp = agora.toLocaleString("pt-BR", { hour12: false });
      const setor = usuario?.equipe || setorAtual || "SETOR";
      const header = `[${stamp}] ${setor} - ${usuario?.nome || ""} (${
        usuario?.matricula || ""
      })`;
      const entrada = `${header}\n${textoInconsistencia.trim()}`;
      const novoTexto = anterior ? `${anterior}\n\n---\n${entrada}` : entrada;
      const respPatch = await fetch(
        `/api/logistica/funcionario/${remanejamentoSelecionado.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ observacoesPrestserv: novoTexto }),
        },
      );
      if (!respPatch.ok) {
        const err = await respPatch.json().catch(() => ({}));
        toast.error(err?.error || "Falha ao salvar observação");
        return;
      }
      toast.success("Inconsistência notificada");
      setMostrarModalInconsistencia(false);
      setRemanejamentoSelecionado(null);
      setTextoInconsistencia("");
    } catch (e) {
      toast.error("Erro ao salvar observação");
    } finally {
      setSalvandoInconsistencia(false);
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
    const hojeStr = `${hoje.getFullYear()}-${pad(hoje.getMonth() + 1)}-${pad(
      hoje.getDate(),
    )}`;

    if (!novaDataLimite) {
      setErroNovaDataLimite("Selecione a nova data limite.");
      return;
    }
    if (novaDataLimite < hojeStr) {
      setErroNovaDataLimite(
        "A data limite não pode ser anterior à data atual.",
      );
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
      const dataLimiteUtcNoonIso = new Date(
        Date.UTC(y, m - 1, d, 12, 0, 0),
      ).toISOString();

      const responseDataLimite = await fetch(
        `/api/logistica/tarefas/${tarefaSelecionada.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dataLimite: dataLimiteUtcNoonIso,
          }),
        },
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
        },
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
        s.funcionarios?.some((f) => f?.id === remanejamentoFuncionarioId),
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

    // Cálculos para pendências por setor
    const remanejamentosFiltrados = getRemanejamentosFiltrados();
    const pendenciasPorSetor = remanejamentosFiltrados.reduce(
      (acc, r) => {
        const tarefas = r.tarefas || [];
        // Filtra tarefas pendentes ou reprovadas
        const pendentes = tarefas.filter(
          (t) => t.status === "PENDENTE" || t.status === "REPROVADO",
        );

        pendentes.forEach((t) => {
          if (t.responsavel) {
            acc[t.responsavel] = (acc[t.responsavel] || 0) + 1;
          }
        });
        return acc;
      },
      {} as Record<string, number>,
    );

    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {/* Card 1: Total de Funcionários Pendentes */}
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-l-blue-500 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 font-medium uppercase">
              Funcionários Pendentes
            </p>
            <p className="text-2xl font-bold text-gray-800 mt-1">
              {progresso.funcionariosPendentes}
            </p>
          </div>
          <div className="p-3 rounded-full bg-blue-50">
            <UserGroupIcon className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        {/* Card 2: Total de Tarefas Pendentes */}
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-l-amber-500 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 font-medium uppercase">
              Tarefas Pendentes
            </p>
            <div className="flex items-baseline gap-2 mt-1">
              <p className="text-2xl font-bold text-gray-800">
                {progresso.pendentes + progresso.reprovadas}
              </p>
              {progresso.atrasadas > 0 && (
                <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-100">
                  {progresso.atrasadas} atrasadas
                </span>
              )}
            </div>
          </div>
          <div className="p-3 rounded-full bg-amber-50">
            <ClockIcon className="h-8 w-8 text-amber-500" />
          </div>
        </div>

        {/* Card 3: Pendências por Setor */}
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-l-purple-500 md:col-span-2">
          <p className="text-sm text-gray-500 font-medium uppercase mb-2">
            Pendências por Setor
          </p>
          <div className="flex flex-wrap gap-3">
            {Object.entries(pendenciasPorSetor).length > 0 ? (
              Object.entries(pendenciasPorSetor).map(([setor, qtd]) => {
                let corBg = "bg-gray-100";
                let corTexto = "text-gray-700";
                let corBorda = "border-gray-200";

                if (setor === "RH") {
                  corBg = "bg-blue-50";
                  corTexto = "text-blue-700";
                  corBorda = "border-blue-200";
                } else if (setor === "MEDICINA") {
                  corBg = "bg-emerald-50";
                  corTexto = "text-emerald-700";
                  corBorda = "border-emerald-200";
                } else if (setor === "TREINAMENTO") {
                  corBg = "bg-violet-50";
                  corTexto = "text-violet-700";
                  corBorda = "border-violet-200";
                } else if (setor === "LOGISTICA") {
                  corBg = "bg-pink-50";
                  corTexto = "text-pink-700";
                  corBorda = "border-pink-200";
                }

                return (
                  <div
                    key={setor}
                    className={`flex items-center px-3 py-1.5 rounded-md border ${corBorda} ${corBg}`}
                  >
                    <span className={`text-xs font-bold mr-2 ${corTexto}`}>
                      {setor}
                    </span>
                    <span
                      className={`text-sm font-extrabold ${corTexto} bg-white bg-opacity-60 px-1.5 rounded`}
                    >
                      {qtd}
                    </span>
                  </div>
                );
              })
            ) : (
              <span className="text-sm text-gray-400 italic">
                Nenhuma pendência por setor
              </span>
            )}
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
      const map = new Map<
        number,
        { id: number; numero: string; nome: string }
      >();
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
      return Array.from(map.values()).sort((a, b) =>
        a.numero.localeCompare(b.numero),
      );
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

    const nameOptions = React.useMemo(() => {
      const set = new Set<string>();
      solicitacoes.forEach((s) => {
        s.funcionarios?.forEach((rem) => {
          const nome = rem.funcionario?.nome;
          if (nome) set.add(nome);
        });
      });
      return Array.from(set.values()).sort((a, b) => a.localeCompare(b));
    }, [solicitacoes]);

    const [dataExataDraft, setDataExataDraft] = useState(filtroDataExata);

    return (
      <div className="bg-white border-slate-400 border-1 p-4 rounded-lg shadow-lg mb-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-medium text-slate-800">Filtros</h3>
          <button
            className="hover:bg-gray-200 text-gray-400 px-3 py-1.5 rounded-md transition-colors duration-200 flex items-center gap-2"
            onClick={() => {
              limparFiltros();
              setDataExataDraft("");
              try {
                localStorage.removeItem(FILTERS_CACHE_KEY);
              } catch {}
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
            <div className="relative dropdown-container">
              <FunnelIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 z-10" />
              <button
                onClick={() => setDropdownStatusOpen(!dropdownStatusOpen)}
                className="w-full pl-8 pr-8 py-2 text-sm border-slate-800 bg-slate-100 text-slate-600 rounded-md shadow-sm focus:border-slate-300 focus:ring-slate-300 text-left flex items-center justify-between"
              >
                <span className="truncate">
                  {filtroStatusList.length === 0
                    ? "Todos"
                    : filtroStatusList.length === 1
                      ? filtroStatusList[0] === "CONCLUIDO"
                        ? "Concluída"
                        : filtroStatusList[0] === "PENDENTE"
                          ? "Pendente"
                          : "Reprovado"
                      : `${filtroStatusList.length} selecionados`}
                </span>
                <ChevronDownIcon className="h-4 w-4 text-gray-400" />
              </button>
              {dropdownStatusOpen && (
                <div className="absolute z-50 mt-1 w-full bg-slate-100 border border-slate-800 rounded-md shadow-lg max-h-60 overflow-auto">
                  {["PENDENTE", "CONCLUIDO", "REPROVADO"].map((status) => (
                    <label
                      key={status}
                      className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={filtroStatusList.includes(status)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFiltroStatusList((prev) => [...prev, status]);
                          } else {
                            setFiltroStatusList((prev) =>
                              prev.filter((s) => s !== status),
                            );
                          }
                        }}
                        className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="text-sm text-gray-700">
                        {status === "CONCLUIDO"
                          ? "Concluída"
                          : status === "PENDENTE"
                            ? "Pendente"
                            : "Reprovado"}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-800 mb-1">
              Data de Criação
            </label>
            <div className="relative dropdown-container">
              <ClockIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 z-10" />
              <button
                onClick={() =>
                  setDropdownDataCriacaoOpen(!dropdownDataCriacaoOpen)
                }
                className="w-full pl-8 pr-8 py-2 text-sm border-slate-800 bg-slate-100 text-slate-600 rounded-md shadow-sm focus:border-slate-300 focus:ring-slate-300 text-left flex items-center justify-between"
              >
                <span className="truncate">
                  {filtroDataCriacaoInicio || filtroDataCriacaoFim
                    ? "Filtrado"
                    : "Todas"}
                </span>
                <ChevronDownIcon className="h-4 w-4 text-gray-400" />
              </button>
              {dropdownDataCriacaoOpen && (
                <div className="absolute z-50 mt-1 w-full bg-slate-100 border border-slate-800 rounded-md shadow-lg p-3 min-w-[250px]">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">
                        De
                      </label>
                      <input
                        type="date"
                        value={filtroDataCriacaoInicio}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (
                            filtroDataCriacaoFim &&
                            val > filtroDataCriacaoFim
                          ) {
                            toast.error(
                              "Data inicial não pode ser maior que a final",
                            );
                            return;
                          }
                          setFiltroDataCriacaoInicio(val);
                        }}
                        className="w-full text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">
                        Até
                      </label>
                      <input
                        type="date"
                        value={filtroDataCriacaoFim}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (
                            filtroDataCriacaoInicio &&
                            val < filtroDataCriacaoInicio
                          ) {
                            toast.error(
                              "Data final não pode ser menor que a inicial",
                            );
                            return;
                          }
                          setFiltroDataCriacaoFim(val);
                        }}
                        className="w-full text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div className="flex justify-end pt-2 border-t border-gray-200">
                      <button
                        onClick={() => {
                          setFiltroDataCriacaoInicio("");
                          setFiltroDataCriacaoFim("");
                        }}
                        className="text-xs text-red-600 hover:text-red-800 mr-3"
                      >
                        Limpar
                      </button>
                      <button
                        onClick={() => setDropdownDataCriacaoOpen(false)}
                        className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                      >
                        Aplicar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-800 mb-1">
              Data Limite
            </label>
            <div className="relative dropdown-container">
              <ClockIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 z-10" />
              <button
                onClick={() =>
                  setDropdownDataLimiteOpen(!dropdownDataLimiteOpen)
                }
                className="w-full pl-8 pr-8 py-2 text-sm border-slate-800 bg-slate-100 text-slate-600 rounded-md shadow-sm focus:border-slate-300 focus:ring-slate-300 text-left flex items-center justify-between"
              >
                <span className="truncate">
                  {filtroDataLimiteInicio || filtroDataLimiteFim
                    ? "Filtrado"
                    : "Todas"}
                </span>
                <ChevronDownIcon className="h-4 w-4 text-gray-400" />
              </button>
              {dropdownDataLimiteOpen && (
                <div className="absolute z-50 mt-1 w-full bg-slate-100 border border-slate-800 rounded-md shadow-lg p-3 min-w-[250px]">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">
                        De
                      </label>
                      <input
                        type="date"
                        value={filtroDataLimiteInicio}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (
                            filtroDataLimiteFim &&
                            val > filtroDataLimiteFim
                          ) {
                            toast.error(
                              "Data inicial não pode ser maior que a final",
                            );
                            return;
                          }
                          setFiltroDataLimiteInicio(val);
                        }}
                        className="w-full text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">
                        Até
                      </label>
                      <input
                        type="date"
                        value={filtroDataLimiteFim}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (
                            filtroDataLimiteInicio &&
                            val < filtroDataLimiteInicio
                          ) {
                            toast.error(
                              "Data final não pode ser menor que a inicial",
                            );
                            return;
                          }
                          setFiltroDataLimiteFim(val);
                        }}
                        className="w-full text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div className="flex justify-end pt-2 border-t border-gray-200">
                      <button
                        onClick={() => {
                          setFiltroDataLimiteInicio("");
                          setFiltroDataLimiteFim("");
                        }}
                        className="text-xs text-red-600 hover:text-red-800 mr-3"
                      >
                        Limpar
                      </button>
                      <button
                        onClick={() => setDropdownDataLimiteOpen(false)}
                        className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                      >
                        Aplicar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-800 mb-1">
              Prioridade
            </label>
            <div className="relative dropdown-container">
              <FunnelIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 z-10" />
              <button
                onClick={() =>
                  setDropdownPrioridadeOpen(!dropdownPrioridadeOpen)
                }
                className="w-full pl-8 pr-8 py-2 text-sm border-slate-800 bg-slate-100 text-slate-600 rounded-md shadow-sm focus:border-slate-300 focus:ring-slate-300 text-left flex items-center justify-between"
              >
                <span className="truncate">
                  {filtroPrioridadeList.length === 0
                    ? "Todas"
                    : filtroPrioridadeList.length === 1
                      ? filtroPrioridadeList[0]
                      : `${filtroPrioridadeList.length} selecionadas`}
                </span>
                <ChevronDownIcon className="h-4 w-4 text-gray-400" />
              </button>
              {dropdownPrioridadeOpen && (
                <div className="absolute z-50 mt-1 w-full bg-slate-100 border border-slate-800 rounded-md shadow-lg max-h-60 overflow-auto">
                  {["BAIXA", "MEDIA", "ALTA", "URGENTE"].map((prioridade) => (
                    <label
                      key={prioridade}
                      className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={filtroPrioridadeList.includes(prioridade)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFiltroPrioridadeList((prev) => [
                              ...prev,
                              prioridade,
                            ]);
                          } else {
                            setFiltroPrioridadeList((prev) =>
                              prev.filter((p) => p !== prioridade),
                            );
                          }
                        }}
                        className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="text-sm text-gray-700">
                        {prioridade}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-800 mb-1">
              Contrato
            </label>
            <div className="relative dropdown-container">
              <FunnelIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 z-10" />
              <button
                onClick={() => setDropdownContratoOpen(!dropdownContratoOpen)}
                className="w-full pl-8 pr-8 py-2 text-sm border-slate-800 bg-slate-100 text-slate-600 rounded-md shadow-sm focus:border-slate-300 focus:ring-slate-300 text-left flex items-center justify-between"
              >
                <span className="truncate">
                  {filtroContratoList.length === 0
                    ? "Todos"
                    : filtroContratoList.length === 1
                      ? (() => {
                          const id = filtroContratoList[0];
                          const c = contratosOptions.find(
                            (x) => x.id.toString() === id,
                          );
                          return c ? `${c.numero} — ${c.nome}` : id;
                        })()
                      : `${filtroContratoList.length} selecionados`}
                </span>
                <ChevronDownIcon className="h-4 w-4 text-gray-400" />
              </button>
              {dropdownContratoOpen && (
                <div className="absolute z-50 mt-1 w-full bg-slate-100 border border-slate-800 rounded-md shadow-lg max-h-60 overflow-auto">
                  {contratosOptions.map((c) => (
                    <label
                      key={c.id}
                      className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={filtroContratoList.includes(c.id.toString())}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFiltroContratoList((prev) => [
                              ...prev,
                              c.id.toString(),
                            ]);
                          } else {
                            setFiltroContratoList((prev) =>
                              prev.filter((id) => id !== c.id.toString()),
                            );
                          }
                        }}
                        className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="text-sm text-gray-700">
                        {c.numero} — {c.nome}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {!setorAtual && (
            <div>
              <label className="block text-xs font-medium text-slate-800 mb-1">
                Setor Responsável
              </label>
              <div className="relative dropdown-container">
                <FunnelIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 z-10" />
                <button
                  onClick={() => setDropdownSetorOpen(!dropdownSetorOpen)}
                  className="w-full pl-8 pr-8 py-2 text-sm border-slate-800 bg-slate-100 text-slate-600 rounded-md shadow-sm focus:border-slate-300 focus:ring-slate-300 text-left flex items-center justify-between"
                >
                  <span className="truncate">
                    {filtroSetorList.length === 0
                      ? "Todos"
                      : filtroSetorList.length === 1
                        ? filtroSetorList[0]
                        : `${filtroSetorList.length} selecionados`}
                  </span>
                  <ChevronDownIcon className="h-4 w-4 text-gray-400" />
                </button>
                {dropdownSetorOpen && (
                  <div className="absolute z-50 mt-1 w-full bg-slate-100 border border-slate-800 rounded-md shadow-lg max-h-60 overflow-auto">
                    {["RH", "TREINAMENTO", "MEDICINA"].map((setor) => (
                      <label
                        key={setor}
                        className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={filtroSetorList.includes(setor)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFiltroSetorList((prev) => [...prev, setor]);
                            } else {
                              setFiltroSetorList((prev) =>
                                prev.filter((s) => s !== setor),
                              );
                            }
                          }}
                          className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="text-sm text-gray-700">{setor}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-800 mb-1">
              Tipo
            </label>
            <div className="relative dropdown-container">
              <FunnelIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 z-10" />
              <button
                onClick={() => setDropdownTipoOpen(!dropdownTipoOpen)}
                className="w-full pl-8 pr-8 py-2 text-sm border-slate-800 bg-slate-100 text-slate-600 rounded-md shadow-sm focus:border-slate-300 focus:ring-slate-300 text-left flex items-center justify-between"
              >
                <span className="truncate">
                  {filtroTipoList.length === 0
                    ? "Todos"
                    : filtroTipoList.length === 1
                      ? filtroTipoList[0]
                      : `${filtroTipoList.length} selecionados`}
                </span>
                <ChevronDownIcon className="h-4 w-4 text-gray-400" />
              </button>
              {dropdownTipoOpen && (
                <div className="absolute z-50 mt-1 w-full bg-slate-100 border border-slate-800 rounded-md shadow-lg max-h-60 overflow-auto">
                  {tiposOptions.map((t) => (
                    <label
                      key={t}
                      className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={filtroTipoList.includes(t)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFiltroTipoList((prev) => [...prev, t]);
                          } else {
                            setFiltroTipoList((prev) =>
                              prev.filter((x) => x !== t),
                            );
                          }
                        }}
                        className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="text-sm text-gray-700">{t}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-800 mb-1">
              Ordenar
            </label>
            <div className="relative dropdown-container">
              <FunnelIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 z-10" />
              <button
                onClick={() => setDropdownOrdenacaoOpen(!dropdownOrdenacaoOpen)}
                className="w-full pl-8 pr-8 py-2 text-sm border-slate-800 bg-slate-100 text-slate-600 rounded-md shadow-sm focus:border-slate-300 focus:ring-slate-300 text-left flex items-center justify-between"
              >
                <span className="truncate">
                  {ordenacaoFuncionarios === ""
                    ? "Padrão (Status)"
                    : ordenacaoFuncionarios === "PENDENCIAS_DESC"
                      ? "Mais pendências"
                      : ordenacaoFuncionarios === "PENDENCIAS_ASC"
                        ? "Menos pendências"
                        : ordenacaoFuncionarios === "PROGRESSO_DESC"
                          ? "Mais progresso"
                          : ordenacaoFuncionarios === "PROGRESSO_ASC"
                            ? "Menos progresso"
                            : ordenacaoFuncionarios === "NOME_AZ"
                              ? "Nome A–Z"
                              : ordenacaoFuncionarios === "NOME_ZA"
                                ? "Nome Z–A"
                                : ordenacaoFuncionarios === "ATUALIZACAO_DESC"
                                  ? "Atualização mais recente"
                                  : "Atualização mais antiga"}
                </span>
                <ChevronDownIcon className="h-4 w-4 text-gray-400" />
              </button>
              {dropdownOrdenacaoOpen && (
                <div className="absolute z-50 mt-1 w-full bg-slate-100 border border-slate-800 rounded-md shadow-lg max-h-60 overflow-auto">
                  {[
                    { v: "", label: "Padrão (Status)" },
                    {
                      v: "PENDENCIAS_DESC",
                      label: "Mais pendências (Pendente + Reprovadas)",
                    },
                    { v: "PENDENCIAS_ASC", label: "Menos pendências" },
                    { v: "PROGRESSO_DESC", label: "Mais progresso" },
                    { v: "PROGRESSO_ASC", label: "Menos progresso" },
                    { v: "NOME_AZ", label: "Nome A–Z" },
                    { v: "NOME_ZA", label: "Nome Z–A" },
                    {
                      v: "ATUALIZACAO_DESC",
                      label: "Atualização mais recente",
                    },
                    { v: "ATUALIZACAO_ASC", label: "Atualização mais antiga" },
                  ].map((opt) => (
                    <label
                      key={opt.v}
                      className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="radio"
                        name="ordenacaoFuncionarios"
                        checked={ordenacaoFuncionarios === opt.v}
                        onChange={() => {
                          setOrdenacaoFuncionarios(opt.v as any);
                          setDropdownOrdenacaoOpen(false);
                          setPaginaAtualFuncionarios(1);
                        }}
                        className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="text-sm text-gray-700">{opt.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-800 mb-1">
              Nome do Funcionário
            </label>
            <div className="relative dropdown-container">
              <FunnelIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 z-10" />
              <button
                onClick={() => setDropdownNomeOpen(!dropdownNomeOpen)}
                className="w-full pl-8 pr-8 py-2 text-sm border-slate-800 bg-slate-100 text-slate-600 rounded-md shadow-sm focus:border-slate-300 focus:ring-slate-300 text-left flex items-center justify-between"
              >
                <span className="truncate">
                  {filtroNomeList.length === 0
                    ? "Todos"
                    : filtroNomeList.length === 1
                      ? filtroNomeList[0]
                      : `${filtroNomeList.length} selecionados`}
                </span>
                <ChevronDownIcon className="h-4 w-4 text-gray-400" />
              </button>
              {dropdownNomeOpen && (
                <div className="absolute z-50 mt-1 w-full bg-slate-100 border border-slate-800 rounded-md shadow-lg max-h-60 overflow-auto">
                  <div className="p-2 border-b border-slate-300 bg-white">
                    <div className="flex items-center gap-2">
                      <MagnifyingGlassIcon className="h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        value={nomeSearchDraft}
                        onChange={(e) => setNomeSearchDraft(e.target.value)}
                        placeholder="Buscar..."
                        ref={nomeSearchInputRef}
                        className="w-full h-8 text-xs border border-slate-300 rounded px-2 bg-white text-slate-700"
                      />
                    </div>
                  </div>
                  {nameOptions
                    .filter((n) =>
                      stripAccents(n)
                        .toLowerCase()
                        .includes(stripAccents(nomeSearchDraft).toLowerCase()),
                    )
                    .map((n) => (
                      <label
                        key={n}
                        className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={filtroNomeList.some(
                            (v) =>
                              stripAccents(v).toLowerCase() ===
                              stripAccents(n).toLowerCase(),
                          )}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFiltroNomeList((prev) => {
                                const exists = prev.some(
                                  (v) =>
                                    stripAccents(v).toLowerCase() ===
                                    stripAccents(n).toLowerCase(),
                                );
                                return exists ? prev : [...prev, n];
                              });
                            } else {
                              removerFiltroIndividual("nome", n);
                            }
                            setPaginaAtualFuncionarios(1);
                          }}
                          className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="text-sm text-gray-700">{n}</span>
                      </label>
                    ))}
                </div>
              )}
            </div>
            {filtroNomeList.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {filtroNomeList.map((nome, idx) => (
                  <span
                    key={`${nome}-${idx}`}
                    className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full border border-blue-200"
                  >
                    <span className="mr-1">{nome}</span>
                    <button
                      onClick={() => removerFiltroIndividual("nome", nome)}
                      className="ml-1 inline-flex items-center justify-center w-3 h-3 text-blue-600 hover:text-blue-800 hover:bg-blue-200 rounded-full transition-colors"
                      title="Remover nome"
                    >
                      <XMarkIcon className="w-2 h-2" />
                    </button>
                  </span>
                ))}
              </div>
            )}
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
              <option value="NOVO">Novo</option>
            </select>
          </div>

          {/* Novo: Filtro por Data Limite Exata */}
          <div>
            <label className="block text-xs font-medium text-slate-800 mb-1">
              Data Limite
            </label>
            <div className="flex gap-2">
              <input
                type="date"
                className="w-full h-9 rounded-md border-slate-800 bg-slate-100 text-slate-600 shadow-sm focus:border-slate-300 focus:ring-slate-300"
                value={dataExataDraft}
                onChange={(e) => setDataExataDraft(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") {
                    setFiltroDataExata(dataExataDraft);
                  }
                }}
              />
              <button
                className="px-3 h-9 rounded-md bg-slate-500 hover:bg-slate-600 text-white transition-colors"
                onClick={() => setFiltroDataExata(dataExataDraft)}
                title="Aplicar data"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
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
      </div>
    );
  };

  // Função para determinar o status geral do funcionário baseado nas suas tarefas
  const getStatusGeralFuncionario = (tarefas: TarefaRemanejamento[]) => {
    if (tarefas.length === 0) return "PENDENTE";

    // Verificar se tem tarefas reprovadas
    const hasReprovado = tarefas.some((t) => t.status === "REPROVADO");
    if (hasReprovado) return "REPROVADO";

    // Calcular progresso
    const tarefasConcluidas = tarefas.filter(
      (t) => t.status === "CONCLUIDA" || t.status === "CONCLUIDO",
    ).length;
    const totalTarefas = tarefas.length;

    if (tarefasConcluidas === totalTarefas) return "CONCLUIDO";
    if (tarefasConcluidas === 0) return "PENDENTE";
    return "PENDENTE";
  };

  // Função para obter classes de borda baseadas no status
  const getBordaStatusClasses = (status: string) => {
    switch (status) {
      case "REPROVADO":
        return "border-l-4 border-l-red-500 bg-red-50/20";
      case "CONCLUIDO":
        return "border-l-4 border-l-green-500 bg-green-50/20";
      case "PENDENTE":
        return "border-l-4 border-l-gray-400 bg-gray-50/20";
      default:
        return "border-l-4 border-l-gray-400 bg-gray-50/20";
    }
  };

  // Componente para a lista de tarefas
  const ListaTarefas = () => {
    const remanejamentosComTarefas = React.useMemo(
      () => getRemanejamentosParaVisaoFuncionarios(),
      [
        solicitacoes,
        filtroNomeList,
        filtroStatusList,
        filtroPrioridadeList,
        filtroSetorList,
        filtroContratoList,
        setorAtual,
        filtroDataCategoria,
        ordenacaoDataLimite,
        ordenacaoFuncionarios,
        filtroTipoList,
        filtroDataExata,
        paginaAtualFuncionarios,
        itensPorPaginaFuncionarios,
      ],
    );
    const isConcluido = (item: {
      tarefas: TarefaRemanejamento[];
      remanejamento: RemanejamentoFuncionario;
    }) => {
      const todas = (item.remanejamento.tarefas || []) as TarefaRemanejamento[];
      const reprovadaLogistica = todas.some(
        (t) => t.responsavel === "LOGISTICA" && t.status === "REPROVADO",
      );
      if (reprovadaLogistica) return false;
      if (setorAtual) {
        const setorTs = todas.filter((t) => t.responsavel === setorAtual);
        if (setorTs.length === 0) return false;
        return setorTs.every(
          (t) => t.status === "CONCLUIDO" || t.status === "CONCLUIDA",
        );
      }
      if (todas.length === 0) return false;
      return todas.every(
        (t) => t.status === "CONCLUIDO" || t.status === "CONCLUIDA",
      );
    };
    const listaFiltrada =
      activeTab === "concluidos"
        ? remanejamentosComTarefas.filter((x) => isConcluido(x))
        : remanejamentosComTarefas.filter((x) => !isConcluido(x));

    // Paginação dos remanejamentos
    const totalRemanejamentos = listaFiltrada.length;
    const totalPaginas = Math.ceil(
      totalRemanejamentos / itensPorPaginaFuncionarios,
    );
    const inicio = (paginaAtualFuncionarios - 1) * itensPorPaginaFuncionarios;
    const fim = inicio + itensPorPaginaFuncionarios;
    const remanejamentosPaginados = listaFiltrada.slice(inicio, fim);

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

    if (listaFiltrada.length === 0) {
      return (
        <div className="text-center py-10">
          {activeTab === "concluidos"
            ? "Nenhum funcionário concluído."
            : "Nenhuma tarefa encontrada."}
        </div>
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
                  {!setorAtual && (
                    <th
                      scope="col"
                      className="px-6 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider"
                    >
                      Setores
                    </th>
                  )}
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider"
                  >
                    Contrato (De → Para)
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider"
                  >
                    Ações
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
                        t.status === "CONCLUIDA" || t.status === "CONCLUIDO",
                    );
                    const progresso =
                      tarefas.length > 0
                        ? Math.round(
                            (tarefasConcluidas.length / tarefas.length) * 100,
                          )
                        : 0;
                    const expandido = funcionariosExpandidos.has(chaveGrupo);

                    const dataAdmissaoRaw =
                      (funcionario as any)?.dataAdmissao || null;
                    const dataAdmissao: Date | null = dataAdmissaoRaw
                      ? new Date(dataAdmissaoRaw)
                      : null;
                    const dataAdmissaoFormatada =
                      dataAdmissao && !Number.isNaN(dataAdmissao.getTime())
                        ? dataAdmissao.toLocaleDateString("pt-BR")
                        : null;
                    const textoAdmissao =
                      dataAdmissaoFormatada || "Não informada";

                    const nowMs = Date.now();
                    const isAdmissaoFutura =
                      !!dataAdmissao && dataAdmissao.getTime() > nowMs;
                    // "Novo" se admitido há <= 48h
                    const grupoNovo =
                      !!dataAdmissao &&
                      !isAdmissaoFutura &&
                      nowMs - dataAdmissao.getTime() <= 48 * 60 * 60 * 1000;

                    // Determinar status geral e classes de borda
                    const statusGeral = getStatusGeralFuncionario(tarefas);
                    const bordaClasses = getBordaStatusClasses(statusGeral);

                    return (
                      <React.Fragment key={chaveGrupo}>
                        <tr
                          className={`group ${bordaClasses} cursor-pointer ${
                            expandido ? "bg-slate-50" : "hover:bg-gray-50"
                          }`}
                          data-grupo={chaveGrupo}
                          onClick={(e) => {
                            const target = e.target as HTMLElement;
                            if (
                              target &&
                              (target.closest("button") ||
                                target.closest("a") ||
                                target.closest("input") ||
                                target.closest("[data-no-expand]"))
                            ) {
                              return;
                            }
                            toggleExpandirFuncionario(chaveGrupo, tarefas);
                          }}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-3 relative">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleExpandirFuncionario(
                                    chaveGrupo,
                                    tarefas,
                                  );
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
                                <div className="text-[12px] font-medium text-gray-900 flex items-center gap-2">
                                  {funcionario.nome}
                                  {/* Matrícula como badge ao lado do nome para diferenciar nomes parecidos */}
                                  {funcionario.matricula && (
                                    <span
                                      className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono"
                                      title="Matrícula do funcionário"
                                    >
                                      Matrícula: {funcionario.matricula}
                                    </span>
                                  )}
                                  {isAdmissaoFutura ? (
                                    <span
                                      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-800"
                                      title="Admissão futura (ainda não admitido)"
                                    >
                                      Admissão futura
                                    </span>
                                  ) : (
                                    grupoNovo && (
                                      <span
                                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-800"
                                        title="Admitido há menos de 48h"
                                      >
                                        Novo
                                      </span>
                                    )
                                  )}
                                  {remanejamento?.observacoesPrestserv && (
                                    <button
                                      data-no-expand
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setTituloVerObs(
                                          `${funcionario.nome}${
                                            funcionario.matricula
                                              ? ` (${funcionario.matricula})`
                                              : ""
                                          }`,
                                        );
                                        setTextoVerObs(
                                          remanejamento.observacoesPrestserv ||
                                            "",
                                        );
                                        setMostrarModalVerObs(true);
                                      }}
                                      className="inline-flex items-center gap-1 text-yellow-700 bg-yellow-50 border border-yellow-200 px-1.5 py-0.5 rounded hover:bg-yellow-100"
                                      title="Inconsistência informada por setor"
                                    >
                                      <ExclamationTriangleIcon className="w-4 h-4" />
                                      <span className="text-[10px] font-semibold">
                                        Atenção
                                      </span>
                                    </button>
                                  )}
                                </div>
                                <div className="text-[11px] text-gray-500">
                                  <span>
                                    {funcionario.funcao ||
                                      "Função não informada"}
                                  </span>
                                  <span className="ml-2">
                                    • Admissão: {textoAdmissao}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Tipo de Solicitação */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {solicitacao?.tipo || "N/A"}
                            </span>
                          </td>

                          {/* Resumo das Tarefas */}
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span className="text-sm font-medium text-gray-900">
                              {tarefasConcluidas.length}/{tarefas.length}
                            </span>
                            <div className="text-xs text-gray-500">
                              {tarefasConcluidas.length} concluída
                              {tarefasConcluidas.length !== 1
                                ? "s"
                                : ""} de {tarefas.length}
                            </div>
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <div className="flex items-center justify-center">
                              <div className="w-14 h-14">
                                {(() => {
                                  const centerText = {
                                    id: `center-text-${chaveGrupo}`,
                                    afterDraw: (chart: any) => {
                                      const { ctx, chartArea } = chart;
                                      if (!chartArea) return;
                                      const x =
                                        (chartArea.left + chartArea.right) / 2;
                                      const y =
                                        (chartArea.top + chartArea.bottom) / 2;
                                      const size = Math.min(
                                        chart.width,
                                        chart.height,
                                      );
                                      const fontSize = Math.max(
                                        9,
                                        Math.floor(size / 3.8),
                                      );
                                      ctx.save();
                                      ctx.font = `600 ${fontSize}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto`;
                                      ctx.fillStyle = "#374151";
                                      ctx.textAlign = "center";
                                      ctx.textBaseline = "middle";
                                      ctx.fillText(`${progresso}%`, x, y);
                                      ctx.restore();
                                    },
                                  };
                                  return (
                                    <Doughnut
                                      data={{
                                        labels: ["Pendentes", "Concluídas"],
                                        datasets: [
                                          {
                                            data: [
                                              Math.max(
                                                tarefas.length -
                                                  tarefasConcluidas.length,
                                                0,
                                              ),
                                              tarefasConcluidas.length,
                                            ],
                                            backgroundColor: [
                                              "#f59e0b",
                                              "#10b981",
                                            ],
                                            borderWidth: 0,
                                          },
                                        ],
                                      }}
                                      options={{
                                        cutout: "65%",
                                        plugins: {
                                          legend: { display: false },
                                          tooltip: { enabled: true },
                                          datalabels: { display: false },
                                        },
                                        maintainAspectRatio: false,
                                      }}
                                      plugins={[centerText as any]}
                                    />
                                  );
                                })()}
                              </div>
                            </div>
                          </td>

                          {!setorAtual && (
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              {(() => {
                                const setores = [
                                  "RH",
                                  "MEDICINA",
                                  "TREINAMENTO",
                                ] as const;
                                const bySetor = setores.map((s) => {
                                  const ts = tarefas.filter(
                                    (t) => t.responsavel === s,
                                  );
                                  const concl = ts.filter(
                                    (t) =>
                                      t.status === "CONCLUIDO" ||
                                      t.status === "CONCLUIDA",
                                  ).length;
                                  return ts.length > 0 && concl === ts.length;
                                });
                                const completos =
                                  bySetor.filter(Boolean).length;
                                return (
                                  <div className="flex items-center justify-center gap-3">
                                    <div className="w-14 h-14">
                                      <Doughnut
                                        data={{
                                          labels: ["Concluídos", "Restantes"],
                                          datasets: [
                                            {
                                              data: [completos, 3 - completos],
                                              backgroundColor: [
                                                "#22c55e",
                                                "#e5e7eb",
                                              ],
                                              borderWidth: 0,
                                            },
                                          ],
                                        }}
                                        options={{
                                          cutout: "65%",
                                          plugins: {
                                            legend: { display: false },
                                            tooltip: { enabled: false },
                                            datalabels: { display: false },
                                          },
                                          maintainAspectRatio: false,
                                        }}
                                      />
                                    </div>
                                    <div className="flex gap-1">
                                      {setores.map((s, idx) => (
                                        <span
                                          key={s}
                                          className={`px-1.5 py-0.5 text-[10px] rounded-full border ${
                                            bySetor[idx]
                                              ? "bg-green-100 text-green-700 border-green-200"
                                              : "bg-gray-100 text-gray-500 border-gray-200"
                                          }`}
                                        >
                                          {s === "RH"
                                            ? "RH"
                                            : s === "MEDICINA"
                                              ? "MED"
                                              : "TREI"}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })()}
                            </td>
                          )}

                          {/* Contrato (De → Para) */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-900">
                              {solicitacao?.contratoOrigem?.numero || "-"} →{" "}
                              {solicitacao?.contratoDestino?.numero || "-"}
                            </span>
                          </td>
                          {/* Ações */}
                          <td
                            className="px-6 py-4 whitespace-nowrap text-right relative"
                            data-no-expand
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                          >
                            <button
                              type="button"
                              data-no-expand
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setMenuFuncionarioAtivo((prev) =>
                                  prev === chaveGrupo ? null : chaveGrupo,
                                );
                              }}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                              }}
                              className="inline-flex p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                              title="Mais ações"
                            >
                              <EllipsisVerticalIcon className="h-5 w-5" />
                            </button>
                            {menuFuncionarioAtivo === chaveGrupo && (
                              <div
                                className="absolute right-6 mt-2 z-20 bg-white border border-gray-200 rounded shadow-md w-56"
                                data-no-expand
                              >
                                <button
                                  type="button"
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setMenuFuncionarioAtivo(null);
                                    setRemanejamentoSelecionado({
                                      id: remanejamento.id,
                                      nome: funcionario.nome,
                                      matricula: (funcionario as any).matricula,
                                    });
                                    setTextoInconsistencia("");
                                    setMostrarModalInconsistencia(true);
                                  }}
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                  }}
                                >
                                  Notificar Inconsistência
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>

                        {/* Detalhes expandidos das tarefas */}
                        {expandido && (
                          <tr>
                            <td
                              colSpan={setorAtual ? 6 : 7}
                              className="px-0 py-0"
                            >
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
                                          {setorAtual !== "TREINAMENTO" && (
                                            <th
                                              scope="col"
                                              className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider"
                                            >
                                              Descrição
                                            </th>
                                          )}
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
                                                setOrdenacaoDataLimite(
                                                  (prev) =>
                                                    prev === "asc"
                                                      ? "desc"
                                                      : prev === "desc"
                                                        ? ""
                                                        : "asc",
                                                )
                                              }
                                            >
                                              Data Limite
                                              <span className="text-xs">
                                                {ordenacaoDataLimite === "asc"
                                                  ? "▲"
                                                  : ordenacaoDataLimite ===
                                                      "desc"
                                                    ? "▼"
                                                    : ""}
                                              </span>
                                            </button>
                                          </th>
                                          <th
                                            scope="col"
                                            className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider"
                                          >
                                            Data Conclusão
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
                                        {(focoRemKey === chaveGrupo
                                          ? tarefas
                                          : [...tarefas].sort((a, b) => {
                                              // Função para obter prioridade do status
                                              const getStatusPriority = (
                                                status: string,
                                              ) => {
                                                if (status === "REPROVADO")
                                                  return 0;
                                                if (
                                                  status === "PENDENTE" ||
                                                  status === "EM_ANDAMENTO"
                                                )
                                                  return 1;
                                                if (
                                                  status === "CONCLUIDA" ||
                                                  status === "CONCLUIDO"
                                                )
                                                  return 2;
                                                return 3;
                                              };

                                              const priorityA =
                                                getStatusPriority(a.status);
                                              const priorityB =
                                                getStatusPriority(b.status);

                                              return priorityA - priorityB;
                                            })
                                        ).map((tarefa, index) => {
                                          // Classes de status
                                          let statusClasses =
                                            "px-2 py-1 text-xs rounded-full";
                                          if (
                                            tarefa.status === "PENDENTE" ||
                                            tarefa.status === "EM_ANDAMENTO"
                                          )
                                            statusClasses +=
                                              " bg-yellow-100 text-yellow-800";
                                          else if (
                                            tarefa.status === "CONCLUIDA" ||
                                            tarefa.status === "CONCLUIDO"
                                          )
                                            statusClasses +=
                                              " bg-green-100 text-green-800";
                                          else if (
                                            tarefa.status === "REPROVADO"
                                          )
                                            statusClasses +=
                                              " bg-red-100 text-red-800";
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
                                          else if (tarefa.prioridade === "ALTA")
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
                                            tarefa.responsavel === "TREINAMENTO"
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

                                          const tarefaKey =
                                            tarefa.id ??
                                            `${chaveGrupo}-${index}`;

                                          return (
                                            <tr
                                              key={tarefaKey}
                                              className="hover:bg-gray-50"
                                            >
                                              <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">
                                                {tarefa.tipo}
                                              </td>
                                              {setorAtual !== "TREINAMENTO" && (
                                                <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">
                                                  {tarefa.descricao}
                                                </td>
                                              )}
                                              <td className="px-4 py-3 text-xs whitespace-nowrap">
                                                <span className={statusClasses}>
                                                  {tarefa.status ===
                                                    "PENDENTE" ||
                                                  tarefa.status ===
                                                    "EM_ANDAMENTO"
                                                    ? "Pendente"
                                                    : tarefa.status ===
                                                          "CONCLUIDA" ||
                                                        tarefa.status ===
                                                          "CONCLUIDO"
                                                      ? "Concluída"
                                                      : tarefa.status ===
                                                          "REPROVADO"
                                                        ? "Reprovado"
                                                        : tarefa.status}
                                                </span>
                                              </td>
                                              <td className="px-4 py-3 text-xs whitespace-nowrap">
                                                <span
                                                  className={prioridadeClasses}
                                                >
                                                  {tarefa.prioridade === "BAIXA"
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
                                                      tarefa.dataLimite,
                                                    ).toLocaleDateString(
                                                      "pt-BR",
                                                    )}
                                                    {atrasada && " (Atrasada)"}
                                                  </span>
                                                ) : (
                                                  "N/A"
                                                )}
                                              </td>
                                              <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">
                                                {tarefa.dataConclusao
                                                  ? new Date(
                                                      tarefa.dataConclusao,
                                                    ).toLocaleDateString(
                                                      "pt-BR",
                                                    )
                                                  : "-"}
                                              </td>
                                              {!setorAtual && (
                                                <td className="px-4 py-3 text-xs whitespace-nowrap">
                                                  <span
                                                    className={setorClasses}
                                                  >
                                                    {tarefa.responsavel === "RH"
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
                                                        `/prestserv/remanejamentos/${tarefa.remanejamentoFuncionarioId}`,
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
                                                        onClick={() => {
                                                          saveAnchorPos(
                                                            chaveGrupo,
                                                          );
                                                          setFocusRem(
                                                            chaveGrupo,
                                                          );
                                                          abrirModalConcluir(
                                                            tarefa,
                                                          );
                                                        }}
                                                      >
                                                        <CheckCircleIcon className="h-4 w-4" />
                                                      </button>
                                                    )}
                                                  <button
                                                    className="text-slate-500 hover:text-blue-600 relative"
                                                    title="Observações"
                                                    onClick={() => {
                                                      saveAnchorPos(chaveGrupo);
                                                      setFocusRem(chaveGrupo);
                                                      abrirModalObservacoes(
                                                        tarefa,
                                                      );
                                                    }}
                                                  >
                                                    <ChatBubbleLeftRightIcon className="h-4 w-4" />
                                                    <span
                                                      className={`absolute -top-2 -right-2 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center ${
                                                        (
                                                          observacoesCount as Record<
                                                            string,
                                                            number
                                                          >
                                                        )[tarefa.id] > 0
                                                          ? "bg-blue-500"
                                                          : "bg-gray-400"
                                                      }`}
                                                    >
                                                      {(
                                                        observacoesCount as Record<
                                                          string,
                                                          number
                                                        >
                                                      )[tarefa.id] ?? 0}
                                                    </span>
                                                  </button>
                                                  {isAdmin && (
                                                    <button
                                                      className="text-slate-500 hover:text-red-600"
                                                      title="Excluir tarefa"
                                                      onClick={() =>
                                                        abrirModalExcluir(
                                                          tarefa,
                                                        )
                                                      }
                                                    >
                                                      <TrashIcon className="h-4 w-4" />
                                                    </button>
                                                  )}
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
                  },
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
                onClick={() => setPaginaAtualFuncionarios(1)}
                disabled={paginaAtualFuncionarios === 1}
                className="px-4 py-2 text-xs font-medium border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                title="Ir para a primeira página"
              >
                Primeira
              </button>
              <button
                onClick={() =>
                  setPaginaAtualFuncionarios(
                    Math.max(1, paginaAtualFuncionarios - 1),
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
                    Math.min(totalPaginas, paginaAtualFuncionarios + 1),
                  )
                }
                disabled={paginaAtualFuncionarios === totalPaginas}
                className="px-4 py-2 text-xs font-medium border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                Próxima
              </button>
              <button
                onClick={() => setPaginaAtualFuncionarios(totalPaginas)}
                disabled={paginaAtualFuncionarios === totalPaginas}
                className="px-4 py-2 text-xs font-medium border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                title="Ir para a última página"
              >
                Última
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
      const stats = tarefasFiltradas.reduce(
        (acc, tarefa) => {
          const st = tarefa.status || "";
          let status: string;
          if (st === "CONCLUIDO" || st === "CONCLUIDA") status = "CONCLUIDA";
          else if (st === "REPROVADO") status = "REPROVADO";
          else if (st === "PENDENTE" || st === "EM_ANDAMENTO")
            status = "PENDENTE";
          else status = "OUTROS";
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      return {
        pendentes: stats.PENDENTE || 0,
        concluidas: stats.CONCLUIDA || 0,
        reprovados: stats.REPROVADO || 0,
        outros: stats.OUTROS || 0,
      };
    };

    // Estatísticas por prioridade
    const estatisticasPrioridade = () => {
      return tarefasFiltradas.reduce(
        (acc, tarefa) => {
          acc[tarefa.prioridade] = (acc[tarefa.prioridade] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );
    };

    // Estatísticas por setor responsável
    const estatisticasSetor = () => {
      return tarefasFiltradas.reduce(
        (acc, tarefa) => {
          acc[tarefa.responsavel] = (acc[tarefa.responsavel] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );
    };

    // Tarefas atrasadas
    const tarefasAtrasadas = () => {
      // Normalizar data de hoje para ignorar horas
      const hoje = new Date();
      const hojeNorm = new Date(
        hoje.getFullYear(),
        hoje.getMonth(),
        hoje.getDate(),
      );

      return tarefasFiltradas.filter((tarefa) => {
        if (
          !tarefa.dataLimite ||
          tarefa.status === "CONCLUIDO" ||
          tarefa.status === "CONCLUIDA"
        )
          return false;

        // Normalizar data limite para ignorar horas
        const dataLimite = new Date(tarefa.dataLimite);
        const dataLimiteNorm = new Date(
          dataLimite.getFullYear(),
          dataLimite.getMonth(),
          dataLimite.getDate(),
        );

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
        {/* Gráficos Linha 1: Status e Setor */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Distribuição por Status */}
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">
                Distribuição por Status
              </h3>
              <span className="px-2 py-1 text-xs rounded-full bg-indigo-50 text-indigo-700">
                Total: {tarefasFiltradas.length}
              </span>
            </div>
            <div className="h-64">
              <Doughnut
                data={{
                  labels: ["Pendentes", "Concluídas", "Pendente ( Reprovado )"],
                  datasets: [
                    {
                      data: [
                        statsStatus.pendentes,
                        statsStatus.concluidas,
                        statsStatus.reprovados,
                      ],
                      backgroundColor: [
                        "rgba(99,102,241,0.7)",
                        "rgba(59,130,246,0.7)",
                        "rgba(236,72,153,0.7)",
                      ],
                      borderWidth: 0,
                    },
                  ],
                }}
                options={{
                  plugins: {
                    legend: { position: "bottom" },
                    datalabels: {
                      display: true,
                      color: "#374151",
                      font: { weight: "bold" },
                      formatter: (v: number) => v,
                      align: "center",
                      anchor: "center",
                    },
                  },
                  maintainAspectRatio: false,
                  cutout: "55%",
                }}
              />
            </div>
          </div>

          {/* Distribuição por Setor */}
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">
                Distribuição por Setor
              </h3>
              <span className="px-2 py-1 text-xs rounded-full bg-indigo-50 text-indigo-700">
                Total: {tarefasFiltradas.length}
              </span>
            </div>
            <div className="h-64">
              <Bar
                data={{
                  labels: ["RH", "Medicina", "Treinamento"],
                  datasets: [
                    {
                      label: "Tarefas",
                      data: [
                        statsSetor.RH || 0,
                        statsSetor.MEDICINA || 0,
                        statsSetor.TREINAMENTO || 0,
                      ],
                      backgroundColor: [
                        "rgba(99,102,241,0.7)",
                        "rgba(59,130,246,0.7)",
                        "rgba(236,72,153,0.7)",
                      ],
                    },
                  ],
                }}
                options={{
                  plugins: {
                    legend: { display: false },
                    datalabels: {
                      display: true,
                      color: "#374151",
                      font: { weight: "bold" },
                      formatter: (v: number) => v,
                      anchor: "end",
                      align: "top",
                    },
                  },
                  maintainAspectRatio: false,
                  scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
                }}
              />
            </div>
          </div>
        </div>

        {/* Tabela Detalhada (Linha 2) */}
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">
              Detalhamento de Tarefas
            </h3>
            <span className="px-2 py-1 text-xs rounded-full bg-indigo-50 text-indigo-700">
              Total: {tarefasFiltradas.length}
            </span>
          </div>
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nome
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Função
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tipo
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tarefasFiltradas.map((tarefa, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-900">
                      {tarefa.funcionario?.nome || "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                      {tarefa.funcionario?.funcao || "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                      {tarefa.tipo}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {tarefasFiltradas.length === 0 && (
              <div className="text-center py-4 text-gray-500 text-sm">
                Nenhuma tarefa encontrada com os filtros atuais.
              </div>
            )}
          </div>
        </div>

        {/* Gráficos Linha 3: Prioridade e Concluídos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Distribuição por Prioridade */}
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">
                Distribuição por Prioridade
              </h3>
              <span className="px-2 py-1 text-xs rounded-full bg-indigo-50 text-indigo-700">
                Total: {tarefasFiltradas.length}
              </span>
            </div>
            <div className="h-64">
              <Bar
                data={{
                  labels: ["Baixa", "Média", "Alta", "Urgente"],
                  datasets: [
                    {
                      label: "Tarefas",
                      data: [
                        statsPrioridade.BAIXA || 0,
                        statsPrioridade.MEDIA || 0,
                        statsPrioridade.ALTA || 0,
                        statsPrioridade.URGENTE || 0,
                      ],
                      backgroundColor: [
                        "rgba(99,102,241,0.7)",
                        "rgba(59,130,246,0.7)",
                        "rgba(236,72,153,0.7)",
                        "rgba(147,197,253,0.7)",
                      ],
                    },
                  ],
                }}
                options={{
                  plugins: {
                    legend: { display: false },
                    datalabels: {
                      display: true,
                      color: "#374151",
                      font: { weight: "bold" },
                      formatter: (v: number) => v,
                      anchor: "end",
                      align: "top",
                    },
                  },
                  maintainAspectRatio: false,
                  scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
                }}
              />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">
                Funcionários concluídos por setor
              </h3>
              {(() => {
                const rems = getRemanejamentosParaVisaoFuncionarios();
                const setores = ["RH", "MEDICINA", "TREINAMENTO"] as const;
                const counts = setores.map(
                  (s) =>
                    rems.filter((r) => {
                      const ts = r.tarefas.filter(
                        (t) => (t.responsavel || "") === s,
                      );
                      if (ts.length === 0) return false;
                      const concl = ts.filter(
                        (t) =>
                          (t.status || "").toUpperCase() === "CONCLUIDO" ||
                          (t.status || "").toUpperCase() === "CONCLUIDA",
                      ).length;
                      return concl === ts.length;
                    }).length,
                );
                const total = counts.reduce((a, b) => a + b, 0);
                return (
                  <span className="px-2 py-1 text-xs rounded-full bg-indigo-50 text-indigo-700">
                    Total: {total}
                  </span>
                );
              })()}
            </div>
            <div className="h-64">
              {(() => {
                const rems = getRemanejamentosParaVisaoFuncionarios();
                const setores = ["RH", "MEDICINA", "TREINAMENTO"] as const;
                const counts = setores.map(
                  (s) =>
                    rems.filter((r) => {
                      const ts = r.tarefas.filter(
                        (t) => (t.responsavel || "") === s,
                      );
                      if (ts.length === 0) return false;
                      const concl = ts.filter(
                        (t) =>
                          (t.status || "").toUpperCase() === "CONCLUIDO" ||
                          (t.status || "").toUpperCase() === "CONCLUIDA",
                      ).length;
                      return concl === ts.length;
                    }).length,
                );

                return (
                  <Bar
                    data={{
                      labels: ["RH", "Medicina", "Treinamento"],
                      datasets: [
                        {
                          label: "Funcionários",
                          data: counts,
                          backgroundColor: [
                            "rgba(99,102,241,0.7)",
                            "rgba(59,130,246,0.7)",
                            "rgba(236,72,153,0.7)",
                          ],
                        },
                      ],
                    }}
                    options={{
                      plugins: {
                        legend: { display: false },
                        datalabels: {
                          display: true,
                          color: "#374151",
                          font: { weight: "bold" },
                          formatter: (v: number) => v,
                          anchor: "end",
                          align: "top",
                        },
                      },
                      maintainAspectRatio: false,
                      scales: {
                        y: { beginAtZero: true, ticks: { stepSize: 1 } },
                      },
                    }}
                  />
                );
              })()}
            </div>
          </div>

          {/* Resumo de Performance ocultado conforme solicitação */}
        </div>
      </div>
    );
  };

  const ModalInconsistencia = () => {
    if (!mostrarModalInconsistencia || !remanejamentoSelecionado) return null;
    return (
      <div
        className="fixed inset-0 z-30 flex items-center justify-center bg-black/40"
        onClick={() => setMostrarModalInconsistencia(false)}
        onMouseDownCapture={(e) => e.stopPropagation()}
      >
        <div
          className="bg-white rounded-lg shadow-lg w-full max-w-md p-4"
          onClick={(e) => e.stopPropagation()}
          onMouseDownCapture={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-800">
              Notificar Inconsistência
            </h3>
            <button
              className="text-gray-500 hover:text-gray-700"
              onClick={() => setMostrarModalInconsistencia(false)}
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
          <div className="text-xs text-gray-600 mb-3">
            {remanejamentoSelecionado.nome}
            {remanejamentoSelecionado.matricula
              ? ` (${remanejamentoSelecionado.matricula})`
              : ""}
          </div>
          <textarea
            value={textoInconsistencia}
            onChange={(e) => setTextoInconsistencia(e.target.value)}
            className="w-full border border-gray-300 rounded p-2 text-sm h-28"
            placeholder="Descreva a inconsistência de forma objetiva"
            autoFocus
            onBlur={(e) => {
              if (mostrarModalInconsistencia) {
                e.preventDefault();
                e.currentTarget.focus();
              }
            }}
            onKeyDownCapture={(e) => e.stopPropagation()}
            onInputCapture={(e) => e.stopPropagation()}
          />
          <div className="mt-3 flex justify-end gap-2">
            <button
              onClick={() => setMostrarModalInconsistencia(false)}
              className="px-3 py-1.5 text-xs rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={salvarInconsistencia}
              disabled={salvandoInconsistencia}
              className="px-3 py-1.5 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {salvandoInconsistencia ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const ModalVerObservacoes = () => {
    if (!mostrarModalVerObs) return null;
    return (
      <div
        className="fixed inset-0 z-30 flex items-center justify-center bg-black/40"
        onClick={() => setMostrarModalVerObs(false)}
        onMouseDownCapture={(e) => e.stopPropagation()}
      >
        <div
          className="bg-white rounded-lg shadow-lg w-full max-w-2xl p-4"
          onClick={(e) => e.stopPropagation()}
          onMouseDownCapture={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-800">
              Observações de Inconsistência
            </h3>
            <button
              className="text-gray-500 hover:text-gray-700"
              onClick={() => setMostrarModalVerObs(false)}
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
          <div className="text-xs text-gray-600 mb-3">{tituloVerObs}</div>
          <pre className="whitespace-pre-wrap text-xs text-gray-800 max-h-[60vh] overflow-auto border border-gray-200 rounded p-3 bg-gray-50">
            {textoVerObs}
          </pre>
          <div className="mt-3 flex justify-end">
            <button
              onClick={() => setMostrarModalVerObs(false)}
              className="px-3 py-1.5 text-xs rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Fechar
            </button>
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
              f.statusTarefa === "REPROVADO" ||
              f.statusTarefa === "EM_ANDAMENTO",
          )
          .map((f) => ({
            id: f.id,
            nome: f.funcionario?.nome || "",
            matricula: f.funcionario?.matricula || "",
            funcao: f.funcionario?.funcao || "",
          })),
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
                        (t) => t.tipo === selectedTipo,
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
                        descricaoRef.current.value = novaDescricao || "";
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
                      ),
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
                          solicitacaoSelecionada.dataSolicitacao,
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
                      {solicitacaoSelecionada &&
                        (solicitacaoSelecionada.funcionarios || []).find(
                          (f) => f.id === novaTarefa.remanejamentoFuncionarioId,
                        )?.funcionario && (
                          <>
                            <p className="text-xs text-gray-600">
                              <span className="font-medium">Nome:</span>{" "}
                              {
                                (
                                  solicitacaoSelecionada?.funcionarios || []
                                ).find(
                                  (f) =>
                                    f.id ===
                                    novaTarefa.remanejamentoFuncionarioId,
                                )?.funcionario?.nome
                              }
                            </p>
                            <p className="text-xs text-gray-600">
                              <span className="font-medium">Matrícula:</span>{" "}
                              {
                                (
                                  solicitacaoSelecionada?.funcionarios || []
                                ).find(
                                  (f) =>
                                    f.id ===
                                    novaTarefa.remanejamentoFuncionarioId,
                                )?.funcionario?.matricula
                              }
                            </p>
                            <p className="text-xs text-gray-600">
                              <span className="font-medium">Função:</span>{" "}
                              {
                                (
                                  solicitacaoSelecionada?.funcionarios || []
                                ).find(
                                  (f) =>
                                    f.id ===
                                    novaTarefa.remanejamentoFuncionarioId,
                                )?.funcionario?.funcao
                              }
                            </p>
                            <p className="text-xs text-gray-600">
                              <span className="font-medium">
                                Centro de Custo:
                              </span>{" "}
                              {
                                (
                                  solicitacaoSelecionada?.funcionarios || []
                                ).find(
                                  (f) =>
                                    f.id ===
                                    novaTarefa.remanejamentoFuncionarioId,
                                )?.funcionario?.centroCusto
                              }
                            </p>
                            <p className="text-xs text-gray-600">
                              <span className="font-medium">Status:</span>{" "}
                              {
                                (
                                  solicitacaoSelecionada?.funcionarios || []
                                ).find(
                                  (f) =>
                                    f.id ===
                                    novaTarefa.remanejamentoFuncionarioId,
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

  const concluidosCount = (() => {
    const itens = getRemanejamentosParaVisaoFuncionarios();
    return itens.filter((item) => {
      const todas = (item.remanejamento.tarefas || []) as TarefaRemanejamento[];
      const reprovadaLogistica = todas.some(
        (t) => t.responsavel === "LOGISTICA" && t.status === "REPROVADO",
      );
      if (reprovadaLogistica) return false;
      if (setorAtual) {
        const setorTs = todas.filter((t) => t.responsavel === setorAtual);
        if (setorTs.length === 0) return false;
        return setorTs.every(
          (t) => t.status === "CONCLUIDO" || t.status === "CONCLUIDA",
        );
      }
      if (todas.length === 0) return false;
      return todas.every(
        (t) => t.status === "CONCLUIDO" || t.status === "CONCLUIDA",
      );
    }).length;
  })();

  // Render do componente principal
  return (
    <div
      className="container mx-auto px-4 py-8"
      style={{ overflowAnchor: "none" as any }}
      data-scroll="main"
    >
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
            onClick={() => setActiveTab("concluidos")}
            className={`text-white py-2 px-1 border-b-2 font-medium text-xs flex items-center space-x-2 ${
              activeTab === "concluidos"
                ? "border-sky-500 text-sky-300"
                : "border-transparent text-gray-500 hover:text-white-700 hover:border-white-300"
            }`}
          >
            <CheckCircleIcon className="h-4 w-4" />
            <span>Concluídos</span>
            <span className="ml-2 inline-flex items-center justify-center rounded-full bg-sky-600 text-white text-[10px] font-bold px-2 py-0.5">
              {concluidosCount}
            </span>
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
      {(activeTab === "funcionarios" || activeTab === "concluidos") && (
        <ListaTarefas />
      )}
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
                  <span className="font-medium">Funcionário:</span> {"N/A"}
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
                    <p className="text-xs text-red-600 mt-1">
                      {erroDataVencimento}
                    </p>
                  )}
                  <p className="text-[10px] text-gray-500 mt-1">
                    Obrigatório para Treinamento e Medicina. Prazo mínimo d+30.
                  </p>
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

      {/* Modal para excluir tarefa (admin) */}
      {mostrarModalExcluir && tarefaSelecionada && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Excluir Tarefa</h3>
              <button
                onClick={fecharModalExcluir}
                className="text-gray-500 hover:text-gray-700"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-6">
              <p className="text-gray-700 mb-4">
                Tem certeza que deseja excluir esta tarefa? Esta ação não pode
                ser desfeita.
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
                  <span className="font-medium">Responsável:</span>{" "}
                  {tarefaSelecionada.responsavel}
                </p>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={fecharModalExcluir}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancelar
              </button>
              <button
                onClick={excluirTarefa}
                disabled={excluindoTarefa}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-xs font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:bg-red-300"
              >
                {excluindoTarefa ? "Excluindo..." : "Excluir Tarefa"}
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
                <span className="font-medium">Funcionário:</span> {"N/A"}
              </p>
              <p className="text-xs text-gray-600">
                <span className="font-medium">Data Limite Atual:</span>{" "}
                {tarefaSelecionada.dataLimite
                  ? new Date(tarefaSelecionada.dataLimite).toLocaleDateString(
                      "pt-BR",
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
                        <p className="text-xs text-red-600 mt-1">
                          {erroNovaDataLimite}
                        </p>
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
                        <p className="text-xs text-red-600 mt-1">
                          {erroJustificativaDataLimite}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={atualizarDataLimite}
                      disabled={atualizandoDataLimite}
                      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-green-300"
                    >
                      {atualizandoDataLimite ? "Atualizando..." : "Atualizar"}
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
                                        },
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
                                      new Date(
                                        obs.modificadoEm ?? "",
                                      ).getTime(),
                                    )
                                      ? new Date(
                                          obs.modificadoEm ?? "",
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
      <ModalVerObservacoes />
      <ModalInconsistencia />
    </div>
  );
}
