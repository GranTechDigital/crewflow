"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import ExcelJS from "exceljs";
import { toast } from "react-hot-toast";
import { useAuth } from "@/app/hooks/useAuth";
import { hasFullAccess } from "@/lib/permissions";

type Setor = "RH" | "MEDICINA" | "TREINAMENTO";
type StatusFiltro = "PENDENTE" | "CONCLUIDO" | "REPROVADO";
type DataCategoria = "" | "VENCIDOS" | "A_VENCER" | "NO_PRAZO" | "SEM_DATA" | "NOVO";
type OrdenacaoFuncionarios =
  | ""
  | "PENDENCIAS_DESC"
  | "PENDENCIAS_ASC"
  | "PROGRESSO_DESC"
  | "PROGRESSO_ASC"
  | "NOME_AZ"
  | "NOME_ZA"
  | "ATUALIZACAO_DESC"
  | "ATUALIZACAO_ASC";
type OrdenacaoDataLimite = "" | "asc" | "desc";

type ContratoOption = { id: number; numero: string; nome: string };
type Tarefa = {
  id: string;
  remanejamentoFuncionarioId: string;
  treinamentoId?: number | null;
  treinamento?: {
    validadeValor: number;
    validadeUnidade: string;
  } | null;
  tipo: string;
  descricao: string | null;
  responsavel: string;
  status: string;
  prioridade: string;
  dataCriacao: string;
  dataLimite: string | null;
  dataVencimento: string | null;
  dataConclusao: string | null;
  observacoes: string | null;
};

type HierarquiaItem = {
  id: string;
  statusTarefas: string;
  statusPrestserv: string;
  observacoesPrestserv: string | null;
  updatedAt: string;
  funcionario: {
    id: number;
    nome: string;
    matricula: string;
    funcao: string | null;
    contrato?: {
      id: number;
      numero: string;
      nome: string;
    } | null;
    regime?: string | null;
    dataAdmissao?: string | null;
    status: string | null;
    statusPrestserv: string | null;
    emMigracao: boolean;
  };
  solicitacao: {
    id: number;
    tipo: string;
    status: string;
    prioridade: string;
    contratoOrigemId: number | null;
    contratoDestinoId: number | null;
    contratoOrigem: { id: number; numero: string; nome: string } | null;
    contratoDestino: { id: number; numero: string; nome: string } | null;
  };
  resumo: {
    total: number;
    pendentes: number;
    concluidas: number;
    reprovadas: number;
    atrasadas: number;
    pendencias: number;
    progresso: number;
    ultimaAtualizacao: string;
    dataLimite: string | null;
  };
};

type HierarquiaResponse = {
  items: HierarquiaItem[];
  totalItems: number;
  totalPages: number;
  page: number;
  limit: number;
  resumoFiltrado?: {
    totalFuncionarios: number;
    totalPendencias: number;
    totalPendenciasNoPrazo?: number;
    totalPendenciasForaPrazo?: number;
    totalAtrasadas: number;
    totalConcluidas: number;
    totalReprovadas: number;
    totalTarefas: number;
  };
  resumoGeral?: {
    totalFuncionarios: number;
    totalPendencias: number;
    totalPendenciasNoPrazo?: number;
    totalPendenciasForaPrazo?: number;
    totalAtrasadas: number;
    totalConcluidas: number;
    totalReprovadas: number;
    totalTarefas: number;
  };
  metrics?: { durationMs?: number; payloadBytes?: number; totalTarefasFiltradas?: number };
};

type TarefasResponse = {
  items: Tarefa[];
  totalItems: number;
  metrics?: { durationMs?: number; payloadBytes?: number };
};

type ExportRow = {
  tipoSolicitacao: string;
  contratoOrigem: string;
  contratoDestino: string;
  regime: string;
  id: string;
  tipo: string;
  descricao: string;
  status: string;
  prioridade: string;
  dataLimite: string | null;
  dataConclusao: string | null;
  dataCriacao: string | null;
  funcionario: string;
  matricula: string;
  funcao: string;
  setorResponsavel: string;
  ultimaObservacao: string;
};

type ExportResponse = {
  rows: ExportRow[];
  totalRows: number;
  metrics?: { durationMs?: number; payloadBytes?: number };
};

type ConcluirLoteResponse = {
  sucessoIds: string[];
  falhas: { id: string; error: string; status?: number }[];
  totalSolicitado: number;
  totalSucesso: number;
  totalFalhas: number;
};

type Observacao = {
  id: string;
  texto: string;
  criadoPor: string;
  criadoEm: string;
  modificadoPor?: string;
  modificadoEm?: string;
};

type TaskBucket = {
  loading: boolean;
  error: string | null;
  items: Tarefa[];
  metrics?: { durationMs?: number; payloadBytes?: number };
};

type AppliedFilterTag = {
  id: string;
  label: string;
  kind:
    | "nome"
    | "status"
    | "prioridade"
    | "setor"
    | "tipo"
    | "contrato"
    | "dataCategoria"
    | "dataExata"
    | "ordenacaoFuncionarios"
    | "ordenacaoDataLimite";
  value: string | number;
};

type FilterState = {
  nomes: string[];
  statusList: StatusFiltro[];
  prioridadeList: string[];
  setorList: Setor[];
  contratoList: number[];
  tipoList: string[];
  dataCategoria: DataCategoria;
  dataExata: string;
  ordenacaoFuncionarios: OrdenacaoFuncionarios;
  ordenacaoDataLimite: OrdenacaoDataLimite;
  limit: number;
};

const STATUS_OPTIONS: StatusFiltro[] = ["PENDENTE", "CONCLUIDO", "REPROVADO"];
const PRIORIDADE_OPTIONS = ["ALTA", "MEDIA", "BAIXA", "Normal"] as const;
const SETOR_OPTIONS: Setor[] = ["RH", "MEDICINA", "TREINAMENTO"];
const LS_FILTERS_KEY = "tarefas_v2_hierarquia_filters_v1";

const SETOR_QUERY_MAP: Record<string, Setor | null> = {
  rh: "RH",
  medicina: "MEDICINA",
  treinamento: "TREINAMENTO",
};

function parseSetorFromQuery(raw: string | null): Setor | null {
  if (!raw) return null;
  return SETOR_QUERY_MAP[raw.toLowerCase()] ?? null;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDateInput(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateOnly(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function extrairDetalhesComplementares(descricao: string | null | undefined): string[] {
  if (!descricao) return [];

  const texto = String(descricao).trim();
  if (!texto) return [];

  const partes = texto
    .split(/\r?\n|\s+[|•]\s+|;\s+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const reDetalhe =
    /(treinamento|carga\s*hor[aá]ria|carga\s*hor|validade|contrato|nr\s*\d+|reciclagem|certifica|tipo\s*de\s*validade)/i;

  const seen = new Set<string>();
  const detalhes: string[] = [];

  for (const parte of partes) {
    if (!reDetalhe.test(parte)) continue;
    const key = parte.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    detalhes.push(parte);
  }

  if (detalhes.length === 0 && reDetalhe.test(texto)) {
    return [texto];
  }

  return detalhes;
}

function extractRegimeFromFuncao(funcao: string | null | undefined): string {
  const raw = (funcao || "").trim();
  if (!raw) return "-";
  const separators = [" - ", " / ", "|", "(", ")"];

  for (const sep of separators) {
    if (raw.includes(sep)) {
      const parts = raw
        .split(sep)
        .map((p) => p.trim())
        .filter(Boolean);
      if (parts.length >= 2) {
        return parts[parts.length - 1];
      }
    }
  }

  const upper = raw.toUpperCase();
  if (upper.includes("12X36")) return "12x36";
  if (upper.includes("ADM")) return "ADM";
  if (upper.includes("OPERACIONAL")) return "OPERACIONAL";
  return "-";
}

function resolveRegime(funcao: string | null | undefined, regime?: string | null): string {
  if (regime && String(regime).trim()) return String(regime).trim();
  return extractRegimeFromFuncao(funcao);
}

function normalizarTipoSolicitacao(tipo: string | null | undefined): string {
  return String(tipo || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function formatarTipoSolicitacao(tipo: string | null | undefined): string {
  const t = normalizarTipoSolicitacao(tipo);
  if (t.includes("ALOCACAO")) return "ALOCACAO";
  if (t.includes("VINCULOADICIONAL")) return "VINCULO ADICIONAL";
  if (t.includes("REMANEJAMENTO")) return "REMANEJAMENTO";
  return (tipo || "-").toUpperCase();
}

function getContratoOrigemNumero(item: HierarquiaItem): string {
  const tipo = normalizarTipoSolicitacao(item.solicitacao?.tipo);
  if (tipo.includes("ALOCACAO")) return "-";
  return (
    item.funcionario?.contrato?.numero ||
    item.solicitacao?.contratoOrigem?.numero ||
    "-"
  );
}

function getContratoOrigemDescricao(item: HierarquiaItem): string {
  const tipo = normalizarTipoSolicitacao(item.solicitacao?.tipo);
  if (tipo.includes("ALOCACAO")) return "-";
  if (item.funcionario?.contrato?.numero) {
    const nome = item.funcionario.contrato.nome || "";
    return nome
      ? `${item.funcionario.contrato.numero} - ${nome}`
      : item.funcionario.contrato.numero;
  }
  if (item.solicitacao?.contratoOrigem?.numero) {
    const nome = item.solicitacao.contratoOrigem.nome || "";
    return nome
      ? `${item.solicitacao.contratoOrigem.numero} - ${nome}`
      : item.solicitacao.contratoOrigem.numero;
  }
  return "-";
}

function getContratoDestinoNumero(item: HierarquiaItem): string {
  return item.solicitacao?.contratoDestino?.numero || "-";
}

function getContratoDestinoDescricao(item: HierarquiaItem): string {
  if (!item.solicitacao?.contratoDestino?.numero) return "-";
  const numero = item.solicitacao.contratoDestino.numero;
  const nome = item.solicitacao.contratoDestino.nome || "";
  return nome ? `${numero} - ${nome}` : numero;
}

function toggleArrayValue<T extends string | number>(current: T[], value: T): T[] {
  if (current.includes(value)) return current.filter((item) => item !== value);
  return [...current, value];
}

function treinamentoExigeValidade(task: Tarefa): boolean {
  if (!task.treinamentoId) return false;
  if (!task.treinamento) return true;

  const unidade = (task.treinamento.validadeUnidade || "").trim().toLowerCase();
  const valor = Number(task.treinamento.validadeValor);
  const isUnico = unidade.includes("unico") || unidade.includes("único");
  const isMesZero =
    (unidade.includes("mes") || unidade.includes("mês") || unidade.includes("meses")) &&
    Number.isFinite(valor) &&
    valor <= 0;

  return !(isUnico || isMesZero);
}

function precisaDataVencimento(task: Tarefa): boolean {
  const responsavel = (task.responsavel || "").toUpperCase();
  return responsavel === "MEDICINA" || (responsavel === "TREINAMENTO" && treinamentoExigeValidade(task));
}

function validarDataVencimentoMinimoD30(dataVencimento: string): string | null {
  if (!dataVencimento) return "Informe a data de vencimento para concluir.";
  const dt = new Date(`${dataVencimento}T00:00:00`);
  if (Number.isNaN(dt.getTime())) {
    return "Data inválida. Use uma data com no mínimo d+30.";
  }
  const hoje = new Date();
  const hojeDateOnly = new Date(`${hoje.toISOString().split("T")[0]}T00:00:00`);
  const diffMs = dt.getTime() - hojeDateOnly.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 30) return "Data inválida. Use uma data com no mínimo d+30.";
  return null;
}

function statusBarClass(status: string | null | undefined): string {
  const s = (status || "").toUpperCase();
  if (s === "CONCLUIDO" || s === "CONCLUIDA") return "border-l-emerald-300";
  if (s === "REPROVADO") return "border-l-rose-300";
  return "border-l-slate-300";
}

function isConcluidaStatus(status: string | null | undefined): boolean {
  const s = (status || "").toUpperCase();
  return s === "CONCLUIDO" || s === "CONCLUIDA" || s === "CANCELADO";
}

function isTarefaVencida(task: Tarefa): boolean {
  if (!task.dataLimite) return false;
  if (isConcluidaStatus(task.status)) return false;
  const limite = new Date(task.dataLimite);
  if (Number.isNaN(limite.getTime())) return false;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return limite.getTime() < hoje.getTime();
}

function getTaskUltimaAtualizacao(task: Tarefa): string | null {
  const created = task.dataCriacao ? new Date(task.dataCriacao).getTime() : 0;
  const concluida = task.dataConclusao ? new Date(task.dataConclusao).getTime() : 0;
  const ts = Math.max(created, concluida);
  if (!ts || Number.isNaN(ts)) return null;
  return new Date(ts).toISOString();
}

function calcularResumoTarefas(
  tarefas: Tarefa[],
  fallbackUltimaAtualizacao?: string | null,
): HierarquiaItem["resumo"] {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const hojeMs = hoje.getTime();

  let pendentes = 0;
  let concluidas = 0;
  let reprovadas = 0;
  let atrasadas = 0;
  let ultimaAtualizacaoMs = fallbackUltimaAtualizacao
    ? new Date(fallbackUltimaAtualizacao).getTime()
    : 0;
  let menorDataLimiteMs: number | null = null;

  for (const tarefa of tarefas) {
    const status = (tarefa.status || "").toUpperCase();
    const concluida = isConcluidaStatus(status);

    if (status === "REPROVADO") reprovadas += 1;
    if (status === "PENDENTE") pendentes += 1;
    if (status === "CONCLUIDO" || status === "CONCLUIDA") concluidas += 1;

    if (tarefa.dataLimite) {
      const limiteMs = new Date(tarefa.dataLimite).getTime();
      if (!Number.isNaN(limiteMs)) {
        if (status === "PENDENTE" && limiteMs < hojeMs) {
          atrasadas += 1;
        }
        if (!concluida && (menorDataLimiteMs === null || limiteMs < menorDataLimiteMs)) {
          menorDataLimiteMs = limiteMs;
        }
      }
    }

    const ultimaAtualizacaoTarefa = getTaskUltimaAtualizacao(tarefa);
    const tarefaMs = ultimaAtualizacaoTarefa ? new Date(ultimaAtualizacaoTarefa).getTime() : 0;
    if (!Number.isNaN(tarefaMs) && tarefaMs > ultimaAtualizacaoMs) {
      ultimaAtualizacaoMs = tarefaMs;
    }
  }

  const total = tarefas.length;
  const pendencias = pendentes + reprovadas;
  const progresso = total > 0 ? Math.round((concluidas / total) * 100) : 0;

  return {
    total,
    pendentes,
    concluidas,
    reprovadas,
    atrasadas,
    pendencias,
    progresso,
    ultimaAtualizacao: new Date(
      Number.isFinite(ultimaAtualizacaoMs) && ultimaAtualizacaoMs > 0
        ? ultimaAtualizacaoMs
        : Date.now(),
    ).toISOString(),
    dataLimite: menorDataLimiteMs ? new Date(menorDataLimiteMs).toISOString() : null,
  };
}

function getAdmissaoMeta(dataAdmissao?: string | null): {
  texto: string;
  isFutura: boolean;
  isNovo: boolean;
} {
  if (!dataAdmissao) return { texto: "-", isFutura: false, isNovo: false };

  const dt = new Date(dataAdmissao);
  if (Number.isNaN(dt.getTime())) return { texto: "-", isFutura: false, isNovo: false };

  const nowMs = Date.now();
  const admMs = dt.getTime();
  const isFutura = admMs > nowMs;
  const isNovo = !isFutura && nowMs - admMs <= 48 * 60 * 60 * 1000;

  return {
    texto: dt.toLocaleDateString("pt-BR"),
    isFutura,
    isNovo,
  };
}

async function parseApiError(response: Response, fallbackMessage: string): Promise<string> {
  const contentType = response.headers.get("content-type") || "";
  const isHtml = contentType.includes("text/html");

  if (isHtml) {
    if (response.status === 404) {
      return "API V2 indisponível (404). Reinicie o servidor para carregar as novas rotas.";
    }
    return `Falha na API V2 (status ${response.status}).`;
  }

  try {
    const json = await response.json();
    if (json?.error && typeof json.error === "string") return json.error;
  } catch {}

  return fallbackMessage;
}

export default function TarefasV2Page() {
  const { usuario } = useAuth();
  const isAdmin = hasFullAccess(usuario?.permissoes || []);
  const searchParams = useSearchParams();
  const setorFixo = parseSetorFromQuery(searchParams.get("setor"));

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<HierarquiaItem[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [resumoFiltrado, setResumoFiltrado] = useState({
    totalFuncionarios: 0,
    totalPendencias: 0,
    totalPendenciasNoPrazo: 0,
    totalPendenciasForaPrazo: 0,
    totalAtrasadas: 0,
    totalConcluidas: 0,
    totalReprovadas: 0,
    totalTarefas: 0,
  });
  const [resumoGeral, setResumoGeral] = useState({
    totalFuncionarios: 0,
    totalPendencias: 0,
    totalPendenciasNoPrazo: 0,
    totalPendenciasForaPrazo: 0,
    totalAtrasadas: 0,
    totalConcluidas: 0,
    totalReprovadas: 0,
    totalTarefas: 0,
  });
  const [apiDurationMs, setApiDurationMs] = useState<number | null>(null);
  const [payloadBytes, setPayloadBytes] = useState<number | null>(null);
  const [totalTarefasFiltradas, setTotalTarefasFiltradas] = useState<number | null>(null);
  const [exportingExcel, setExportingExcel] = useState(false);

  const [nomeList, setNomeList] = useState<string[]>([]);
  const [statusList, setStatusList] = useState<StatusFiltro[]>([]);
  const [prioridadeList, setPrioridadeList] = useState<string[]>([]);
  const [setorList, setSetorList] = useState<Setor[]>([]);
  const [contratoList, setContratoList] = useState<number[]>([]);
  const [tipoList, setTipoList] = useState<string[]>([]);
  const [dataCategoria, setDataCategoria] = useState<DataCategoria>("");
  const [dataExata, setDataExata] = useState("");
  const [ordenacaoFuncionarios, setOrdenacaoFuncionarios] =
    useState<OrdenacaoFuncionarios>("");
  const [ordenacaoDataLimite, setOrdenacaoDataLimite] =
    useState<OrdenacaoDataLimite>("");
  const [appliedFilters, setAppliedFilters] = useState<FilterState>({
    nomes: [],
    statusList: [],
    prioridadeList: [],
    setorList: [],
    contratoList: [],
    tipoList: [],
    dataCategoria: "",
    dataExata: "",
    ordenacaoFuncionarios: "",
    ordenacaoDataLimite: "",
    limit: 20,
  });

  const [filtrosOptionsLoading, setFiltrosOptionsLoading] = useState(false);
  const [contratosOptions, setContratosOptions] = useState<ContratoOption[]>([]);
  const [tiposOptions, setTiposOptions] = useState<string[]>([]);
  const [nomesOptions, setNomesOptions] = useState<string[]>([]);
  const [nomeContratosMap, setNomeContratosMap] = useState<Record<string, number[]>>({});
  const [nomeSearch, setNomeSearch] = useState("");
  const [tipoSearch, setTipoSearch] = useState("");
  const [contratoSearch, setContratoSearch] = useState("");
  const [filtrosCollapsed, setFiltrosCollapsed] = useState(false);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [tasksByRemId, setTasksByRemId] = useState<Record<string, TaskBucket>>({});
  const [tarefasSelecionadasLoteRh, setTarefasSelecionadasLoteRh] = useState<
    Record<string, string[]>
  >({});
  const [aprovandoLoteRh, setAprovandoLoteRh] = useState<Record<string, boolean>>({});
  const [falhasLotePorRemId, setFalhasLotePorRemId] = useState<Record<string, string[]>>({});
  const [dataVencimentoPorTarefa, setDataVencimentoPorTarefa] = useState<
    Record<string, string>
  >({});
  const [erroDataPorTarefa, setErroDataPorTarefa] = useState<Record<string, string>>({});
  const [observacoesCountMap, setObservacoesCountMap] = useState<Record<string, number>>({});
  const [funcionarioDetalhesModalOpen, setFuncionarioDetalhesModalOpen] = useState(false);
  const [funcionarioDetalhes, setFuncionarioDetalhes] = useState<HierarquiaItem | null>(null);
  const [detalhesTasksByRemId, setDetalhesTasksByRemId] = useState<Record<string, TaskBucket>>({});
  const [detalhesModalOpen, setDetalhesModalOpen] = useState(false);
  const [taskDetalhes, setTaskDetalhes] = useState<Tarefa | null>(null);

  const [obsModalOpen, setObsModalOpen] = useState(false);
  const [taskObs, setTaskObs] = useState<Tarefa | null>(null);
  const [obsLoading, setObsLoading] = useState(false);
  const [observacoes, setObservacoes] = useState<Observacao[]>([]);
  const [savingObs, setSavingObs] = useState(false);
  const [obsEditId, setObsEditId] = useState<string | null>(null);
  const [obsEditTexto, setObsEditTexto] = useState("");
  const [obsNovaDataLimite, setObsNovaDataLimite] = useState("");
  const [obsJustificativaDataLimite, setObsJustificativaDataLimite] = useState("");
  const [obsErroDataLimite, setObsErroDataLimite] = useState("");
  const [obsErroJustificativa, setObsErroJustificativa] = useState("");

  const requestHierarchyRef = useRef(0);
  const abortHierarchyRef = useRef<AbortController | null>(null);
  const scrollYRef = useRef<number>(0);
  const docScrollYRef = useRef<number>(0);
  const refreshDebounceByRemRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const selectedNamesRef = useRef<string[]>([]);

  useEffect(() => {
    selectedNamesRef.current = Array.from(
      new Set([...(nomeList || []), ...(appliedFilters.nomes || [])]),
    );
  }, [nomeList, appliedFilters.nomes]);

  const getDefaultScrollContainer = () => {
    return (
      (document.querySelector('[data-scroll="main"]') as HTMLElement | null) ||
      (document.scrollingElement as HTMLElement) ||
      (document.documentElement as HTMLElement)
    );
  };

  const getScrollContainerFor = (remId?: string | null) => {
    try {
      if (remId) {
        const row = document.querySelector(`[data-rem-id="${remId}"]`) as HTMLElement | null;
        if (row) {
          let parent = row.parentElement as HTMLElement | null;
          while (parent) {
            const style = getComputedStyle(parent);
            const canScroll =
              (style.overflowY === "auto" || style.overflowY === "scroll") &&
              parent.scrollHeight > parent.clientHeight;
            if (canScroll) return parent;
            parent = parent.parentElement as HTMLElement | null;
          }
        }
      }
    } catch {}
    return getDefaultScrollContainer();
  };

  const saveAnchorPos = (remId?: string | null) => {
    try {
      const cont = getScrollContainerFor(remId);
      docScrollYRef.current =
        window.scrollY || (document.scrollingElement as HTMLElement)?.scrollTop || 0;
      if (remId) {
        const row = document.querySelector(`[data-rem-id="${remId}"]`) as HTMLElement | null;
        if (row) {
          const y =
            row.getBoundingClientRect().top - cont.getBoundingClientRect().top + cont.scrollTop;
          scrollYRef.current = y;
          return;
        }
      }
      scrollYRef.current = cont.scrollTop || 0;
    } catch {}
  };

  const restoreAnchorPos = (remId?: string | null) => {
    try {
      const cont = getScrollContainerFor(remId);
      const target = scrollYRef.current || cont.scrollTop || 0;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          cont.scrollTo({ top: target });
          window.scrollTo(0, docScrollYRef.current || 0);
        });
      });
    } catch {}
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_FILTERS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw || "{}");
      const restored: FilterState = {
        nomes: Array.isArray(parsed.nomes)
          ? parsed.nomes
          : typeof parsed.nomeListaTexto === "string"
            ? parsed.nomeListaTexto
                .split(",")
                .map((n: string) => n.trim())
                .filter(Boolean)
            : [],
        statusList: Array.isArray(parsed.statusList) ? parsed.statusList : [],
        prioridadeList: Array.isArray(parsed.prioridadeList) ? parsed.prioridadeList : [],
        setorList: Array.isArray(parsed.setorList) ? parsed.setorList : [],
        contratoList: Array.isArray(parsed.contratoList) ? parsed.contratoList : [],
        tipoList: Array.isArray(parsed.tipoList) ? parsed.tipoList : [],
        dataCategoria: typeof parsed.dataCategoria === "string" ? parsed.dataCategoria : "",
        dataExata: typeof parsed.dataExata === "string" ? parsed.dataExata : "",
        ordenacaoFuncionarios:
          typeof parsed.ordenacaoFuncionarios === "string"
            ? parsed.ordenacaoFuncionarios
            : "",
        ordenacaoDataLimite:
          typeof parsed.ordenacaoDataLimite === "string"
            ? parsed.ordenacaoDataLimite
            : "",
        limit: typeof parsed.limit === "number" ? parsed.limit : 20,
      };
      setNomeList(restored.nomes);
      setStatusList(restored.statusList);
      setPrioridadeList(restored.prioridadeList);
      setSetorList(restored.setorList);
      setContratoList(restored.contratoList);
      setTipoList(restored.tipoList);
      setDataCategoria(restored.dataCategoria);
      setDataExata(restored.dataExata);
      setOrdenacaoFuncionarios(restored.ordenacaoFuncionarios);
      setOrdenacaoDataLimite(restored.ordenacaoDataLimite);
      setLimit(restored.limit);
      setAppliedFilters(restored);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        LS_FILTERS_KEY,
        JSON.stringify({
          nomes: nomeList,
          statusList,
          prioridadeList,
          setorList,
          contratoList,
          tipoList,
          dataCategoria,
          dataExata,
          ordenacaoFuncionarios,
          ordenacaoDataLimite,
          limit,
        }),
      );
    } catch {}
  }, [
    nomeList,
    statusList,
    prioridadeList,
    setorList,
    contratoList,
    tipoList,
    dataCategoria,
    dataExata,
    ordenacaoFuncionarios,
    ordenacaoDataLimite,
    limit,
  ]);

  useEffect(() => {
    if (setorFixo) {
      setSetorList([setorFixo]);
      setAppliedFilters((prev) => ({ ...prev, setorList: [setorFixo] }));
    }
  }, [setorFixo]);

  const appliedNomeList = useMemo(() => appliedFilters.nomes, [appliedFilters.nomes]);

  const filtrosSetorQuery = useMemo(() => {
    const params = new URLSearchParams();
    const setoresAtivos = setorFixo ? [setorFixo] : setorList;
    setoresAtivos.forEach((setor) => params.append("setor", setor));
    return params.toString();
  }, [setorFixo, setorList]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(appliedFilters.limit));
    appliedNomeList.forEach((nome) => params.append("nome", nome));
    appliedFilters.statusList.forEach((status) => params.append("status", status));
    appliedFilters.prioridadeList.forEach((prioridade) => params.append("prioridade", prioridade));
    const setoresAtivos = setorFixo ? [setorFixo] : appliedFilters.setorList;
    setoresAtivos.forEach((setor) => params.append("setor", setor));
    appliedFilters.contratoList.forEach((contratoId) =>
      params.append("contrato", String(contratoId)),
    );
    appliedFilters.tipoList.forEach((tipo) => params.append("tipo", tipo));
    if (appliedFilters.dataCategoria) params.set("dataCategoria", appliedFilters.dataCategoria);
    if (appliedFilters.dataExata) params.set("dataExata", appliedFilters.dataExata);
    if (appliedFilters.ordenacaoFuncionarios)
      params.set("ordenacaoFuncionarios", appliedFilters.ordenacaoFuncionarios);
    if (appliedFilters.ordenacaoDataLimite)
      params.set("ordenacaoDataLimite", appliedFilters.ordenacaoDataLimite);
    return params.toString();
  }, [
    page,
    appliedFilters,
    appliedNomeList,
    setorFixo,
  ]);

  const carregarFiltros = useCallback(async () => {
    setFiltrosOptionsLoading(true);
    try {
      const url = filtrosSetorQuery
        ? `/api/v2/tarefas-filtros?${filtrosSetorQuery}`
        : "/api/v2/tarefas-filtros";
      const respFiltros = await fetch(url, {
        cache: "no-store",
      });

      if (!respFiltros.ok) {
        throw new Error(
          await parseApiError(respFiltros, "Falha ao carregar filtros da V2"),
        );
      }
      const filtrosData = await respFiltros.json();
      const nomesFromApi: string[] = Array.isArray(filtrosData.nomes)
        ? filtrosData.nomes
            .map((item: unknown) => String(item || "").trim())
            .filter(Boolean)
        : [];
      const tiposFromApi: string[] = Array.isArray(filtrosData.tipos)
        ? filtrosData.tipos
            .map((item: unknown) => String(item || "").trim())
            .filter(Boolean)
        : [];
      const contratosFromApi: ContratoOption[] = Array.isArray(filtrosData.contratos)
        ? filtrosData.contratos.filter(
            (item: unknown): item is ContratoOption =>
              Boolean(item) &&
              typeof item === "object" &&
              item !== null &&
              "id" in item &&
              "numero" in item &&
              "nome" in item,
          )
        : [];
      setNomesOptions(
        Array.from(
          new Set(
            [...nomesFromApi, ...selectedNamesRef.current]
              .map((n) => (n || "").trim())
              .filter(Boolean),
          ),
        ).sort((a, b) => a.localeCompare(b, "pt-BR")),
      );
      setTiposOptions(
        Array.from(new Set(tiposFromApi)).sort((a, b) => a.localeCompare(b, "pt-BR")),
      );
      setContratosOptions(contratosFromApi);
      setNomeContratosMap(
        filtrosData?.nomeContratos && typeof filtrosData.nomeContratos === "object"
          ? filtrosData.nomeContratos
          : {},
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao carregar filtros";
      toast.error(message);
    } finally {
      setFiltrosOptionsLoading(false);
    }
  }, [filtrosSetorQuery]);

  const carregarHierarquia = useCallback(async () => {
    const currentRequest = ++requestHierarchyRef.current;
    setLoading(true);
    setError(null);

    if (abortHierarchyRef.current) abortHierarchyRef.current.abort();
    const controller = new AbortController();
    abortHierarchyRef.current = controller;

    try {
      const response = await fetch(`/api/v2/tarefas-hierarquia?${queryString}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(
          await parseApiError(response, "Falha ao carregar hierarquia da V2"),
        );
      }
      const data: HierarquiaResponse = await response.json();
      if (currentRequest !== requestHierarchyRef.current) return;
      setItems(data.items || []);
      setTotalItems(data.totalItems || 0);
      setTotalPages(data.totalPages || 0);
      setResumoFiltrado({
        totalFuncionarios: data.resumoFiltrado?.totalFuncionarios ?? data.totalItems ?? 0,
        totalPendencias: data.resumoFiltrado?.totalPendencias ?? 0,
        totalPendenciasNoPrazo: data.resumoFiltrado?.totalPendenciasNoPrazo ?? 0,
        totalPendenciasForaPrazo: data.resumoFiltrado?.totalPendenciasForaPrazo ?? 0,
        totalAtrasadas: data.resumoFiltrado?.totalAtrasadas ?? 0,
        totalConcluidas: data.resumoFiltrado?.totalConcluidas ?? 0,
        totalReprovadas: data.resumoFiltrado?.totalReprovadas ?? 0,
        totalTarefas: data.resumoFiltrado?.totalTarefas ?? 0,
      });
      setResumoGeral({
        totalFuncionarios: data.resumoGeral?.totalFuncionarios ?? data.totalItems ?? 0,
        totalPendencias: data.resumoGeral?.totalPendencias ?? 0,
        totalPendenciasNoPrazo: data.resumoGeral?.totalPendenciasNoPrazo ?? 0,
        totalPendenciasForaPrazo: data.resumoGeral?.totalPendenciasForaPrazo ?? 0,
        totalAtrasadas: data.resumoGeral?.totalAtrasadas ?? 0,
        totalConcluidas: data.resumoGeral?.totalConcluidas ?? 0,
        totalReprovadas: data.resumoGeral?.totalReprovadas ?? 0,
        totalTarefas: data.resumoGeral?.totalTarefas ?? 0,
      });
      setApiDurationMs(data.metrics?.durationMs ?? null);
      setPayloadBytes(data.metrics?.payloadBytes ?? null);
      setTotalTarefasFiltradas(data.metrics?.totalTarefasFiltradas ?? null);
      setExpandedIds(new Set());
      setTasksByRemId({});
      setTarefasSelecionadasLoteRh({});
      setAprovandoLoteRh({});
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (currentRequest !== requestHierarchyRef.current) return;
      const message = err instanceof Error ? err.message : "Erro ao carregar hierarquia";
      setError(message);
    } finally {
      if (currentRequest === requestHierarchyRef.current) setLoading(false);
    }
  }, [queryString]);

  const exportarParaExcel = useCallback(async () => {
    if (exportingExcel) return;

    setExportingExcel(true);
    try {
      const response = await fetch(`/api/v2/tarefas-export?${queryString}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(await parseApiError(response, "Falha ao exportar tarefas da V2"));
      }

      const data: ExportResponse = await response.json();
      const rows = Array.isArray(data.rows) ? data.rows : [];
      if (rows.length === 0) {
        toast("Nenhuma tarefa encontrada para exportação.");
        return;
      }

      const dadosExcel = rows.map((row) => ({
        "Tipo Solicitação": row.tipoSolicitacao || "REMANEJAMENTO",
        "Contrato Origem": row.contratoOrigem || "N/A",
        "Contrato Destino": row.contratoDestino || "N/A",
        Regime: row.regime || "N/A",
        ID: row.id || "N/A",
        Tipo: row.tipo || "N/A",
        "Descrição": row.descricao || "",
        Status: row.status || "N/A",
        Prioridade: row.prioridade || "N/A",
        "Data Limite": formatDateOnly(row.dataLimite),
        "Data Conclusão": formatDateOnly(row.dataConclusao),
        "Data Criação": formatDateOnly(row.dataCriacao),
        "Funcionário": row.funcionario || "N/A",
        "Matrícula": row.matricula || "N/A",
        "Função": row.funcao || "N/A",
        "Setor Responsável": row.setorResponsavel || "N/A",
        "Última Observação": row.ultimaObservacao || "N/A",
      }));

      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Tarefas");

      const headers = [
        "Tipo Solicitação",
        "Contrato Origem",
        "Contrato Destino",
        "Regime",
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

      ws.addTable({
        name: "TabelaTarefasV2",
        ref: "A1",
        headerRow: true,
        totalsRow: false,
        style: {
          theme: "TableStyleMedium2",
          showRowStripes: true,
          showColumnStripes: false,
        },
        columns: headers.map((h) => ({ name: h, filterButton: true })),
        rows: dadosExcel.map((row) => headers.map((h) => String((row as Record<string, string>)[h] ?? ""))),
      });

      ws.views = [{ state: "frozen", ySplit: 1 }];

      for (let colIndex = 1; colIndex <= headers.length; colIndex += 1) {
        let maxLen = String(headers[colIndex - 1] || "").length;
        for (const row of dadosExcel) {
          const text = String((row as Record<string, string>)[headers[colIndex - 1]] ?? "");
          if (text.length > maxLen) maxLen = text.length;
        }
        ws.getColumn(colIndex).width = Math.min(60, maxLen + 2);
      }

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Tarefas_V2_Exportadas.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      toast.success("Tarefas exportadas com sucesso!");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao exportar tarefas";
      toast.error(message);
    } finally {
      setExportingExcel(false);
    }
  }, [exportingExcel, queryString]);

  useEffect(() => {
    void carregarFiltros();
  }, [carregarFiltros]);

  useEffect(() => {
    void carregarHierarquia();
  }, [carregarHierarquia]);

  const carregarTarefasDoFuncionario = useCallback(
    async (remanejamentoId: string, forceRefresh = false) => {
      if (!forceRefresh && tasksByRemId[remanejamentoId]?.items) return;
      setTasksByRemId((prev) => ({
        ...prev,
        [remanejamentoId]: { loading: true, error: null, items: prev[remanejamentoId]?.items || [] },
      }));
      try {
        const response = await fetch(
          `/api/v2/tarefas-hierarquia/${remanejamentoId}/tarefas?${queryString}`,
          { cache: "no-store" },
        );
        if (!response.ok) {
          throw new Error(
            await parseApiError(
              response,
              "Falha ao carregar tarefas do funcionário na V2",
            ),
          );
        }
        const data: TarefasResponse = await response.json();
        const loadedItems = data.items || [];
        setTasksByRemId((prev) => ({
          ...prev,
          [remanejamentoId]: {
            loading: false,
            error: null,
            items: loadedItems,
            metrics: data.metrics,
          },
        }));
        setItems((prev) =>
          prev.map((item) =>
            item.id === remanejamentoId
              ? {
                  ...item,
                  resumo: calcularResumoTarefas(loadedItems, item.resumo?.ultimaAtualizacao),
                }
              : item,
          ),
        );
        const ids = loadedItems.map((item) => item.id).filter(Boolean);
        if (ids.length > 0) {
          try {
            const qs = encodeURIComponent(ids.join(","));
            const countResp = await fetch(
              `/api/logistica/tarefas/observacoes/count?ids=${qs}`,
              { cache: "no-store" },
            );
            if (countResp.ok) {
              const counts = await countResp.json();
              if (counts && typeof counts === "object") {
                setObservacoesCountMap((prev) => ({ ...prev, ...counts }));
              }
            }
          } catch {
            // Falha de contagem não pode quebrar carregamento da lista
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro ao carregar tarefas";
        setTasksByRemId((prev) => ({
          ...prev,
          [remanejamentoId]: { loading: false, error: message, items: prev[remanejamentoId]?.items || [] },
        }));
      }
    },
    [queryString, tasksByRemId],
  );

  const agendarRefreshFuncionario = useCallback(
    (remanejamentoId: string, delayMs = 900) => {
      const timers = refreshDebounceByRemRef.current;
      if (timers[remanejamentoId]) clearTimeout(timers[remanejamentoId]);
      timers[remanejamentoId] = setTimeout(() => {
        delete timers[remanejamentoId];
        void carregarTarefasDoFuncionario(remanejamentoId, true);
      }, delayMs);
    },
    [carregarTarefasDoFuncionario],
  );

  useEffect(() => {
    return () => {
      const timers = refreshDebounceByRemRef.current;
      Object.values(timers).forEach((timerId) => clearTimeout(timerId));
    };
  }, []);

  const toggleExpand = (remanejamentoId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(remanejamentoId)) {
        next.delete(remanejamentoId);
        return next;
      }
      next.add(remanejamentoId);
      return next;
    });
    void carregarTarefasDoFuncionario(remanejamentoId);
  };

  const obterDataVencimentoEfetiva = useCallback(
    (task: Tarefa) =>
      ((dataVencimentoPorTarefa[task.id] ?? formatDateInput(task.dataVencimento)) || "").trim(),
    [dataVencimentoPorTarefa],
  );

  const getErroDataParaConclusao = useCallback(
    (task: Tarefa, dataVencimento?: string) => {
      const dataEfetiva = (dataVencimento ?? obterDataVencimentoEfetiva(task)).trim();
      if (precisaDataVencimento(task)) {
        return validarDataVencimentoMinimoD30(dataEfetiva);
      }
      if (dataEfetiva) {
        return validarDataVencimentoMinimoD30(dataEfetiva);
      }
      return null;
    },
    [obterDataVencimentoEfetiva],
  );

  const podeSelecionarEmLote = useCallback(
    (task: Tarefa) => !isConcluidaStatus(task.status) && !getErroDataParaConclusao(task),
    [getErroDataParaConclusao],
  );

  const concluirTarefa = async (task: Tarefa) => {
    if (isConcluidaStatus(task.status)) return;

    const dataVencimentoDraft = obterDataVencimentoEfetiva(task);
    const erroData = getErroDataParaConclusao(task, dataVencimentoDraft);

    if (erroData) {
      setErroDataPorTarefa((prev) => ({ ...prev, [task.id]: erroData }));
      toast.error(
        erroData.includes("obrigatória") || erroData.includes("Informe")
          ? "Data de vencimento é obrigatória para esta tarefa."
          : "A data deve ser pelo menos 30 dias após hoje.",
      );
      return;
    }

    setErroDataPorTarefa((prev) => {
      const next = { ...prev };
      delete next[task.id];
      return next;
    });
    saveAnchorPos(task.remanejamentoFuncionarioId);

    try {
      const response = await fetch(`/api/logistica/tarefas/${task.id}/concluir`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataVencimento: dataVencimentoDraft || null,
        }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error || "Erro ao concluir tarefa");
      }
      toast.success("Tarefa concluída.");
      setDataVencimentoPorTarefa((prev) => {
        const next = { ...prev };
        delete next[task.id];
        return next;
      });
      setErroDataPorTarefa((prev) => {
        const next = { ...prev };
        delete next[task.id];
        return next;
      });
      setTarefasSelecionadasLoteRh((prev) => ({
        ...prev,
        [task.remanejamentoFuncionarioId]: (prev[task.remanejamentoFuncionarioId] || []).filter(
          (id) => id !== task.id,
        ),
      }));
      const concluidaEm = new Date().toISOString();
      let tarefasAtualizadas: Tarefa[] | null = null;
      setTasksByRemId((prev) => {
        const bucket = prev[task.remanejamentoFuncionarioId];
        if (!bucket?.items?.length) return prev;
        const itemsAtualizados = bucket.items.map((current) =>
          current.id === task.id
            ? {
                ...current,
                status: "CONCLUIDO",
                dataConclusao: concluidaEm,
                dataVencimento: dataVencimentoDraft || current.dataVencimento,
              }
            : current,
        );
        tarefasAtualizadas = itemsAtualizados;
        return {
          ...prev,
          [task.remanejamentoFuncionarioId]: {
            ...bucket,
            items: itemsAtualizados,
          },
        };
      });
      if (tarefasAtualizadas) {
        setItems((prev) =>
          prev.map((item) =>
            item.id === task.remanejamentoFuncionarioId
              ? {
                  ...item,
                  resumo: calcularResumoTarefas(
                    tarefasAtualizadas || [],
                    item.resumo?.ultimaAtualizacao,
                  ),
                }
              : item,
          ),
        );
      }
      agendarRefreshFuncionario(task.remanejamentoFuncionarioId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao concluir tarefa";
      toast.error(message);
    } finally {
      restoreAnchorPos(task.remanejamentoFuncionarioId);
    }
  };

  const toggleSelecionarTarefaRh = (remanejamentoId: string, tarefaId: string, checked: boolean) => {
    setTarefasSelecionadasLoteRh((prev) => {
      const current = prev[remanejamentoId] || [];
      if (checked) {
        if (current.includes(tarefaId)) return prev;
        return { ...prev, [remanejamentoId]: [...current, tarefaId] };
      }
      return { ...prev, [remanejamentoId]: current.filter((id) => id !== tarefaId) };
    });
  };

  const toggleSelecionarTodasRh = (remanejamentoId: string, tarefas: Tarefa[], checked: boolean) => {
    const idsRhPendentes = tarefas.filter((task) => podeSelecionarEmLote(task)).map((task) => task.id);
    setTarefasSelecionadasLoteRh((prev) => ({
      ...prev,
      [remanejamentoId]: checked ? idsRhPendentes : [],
    }));
  };

  const aprovarRhEmLote = async (remanejamentoId: string) => {
    if (!isAdmin) {
      toast.error("Aprovação em lote disponível apenas para Administrador.");
      return;
    }

    const bucket = tasksByRemId[remanejamentoId];
    const pendentesRh = (bucket?.items || []).filter((task) => !isConcluidaStatus(task.status));
    if (pendentesRh.length === 0) {
      toast("Nenhuma tarefa pendente para aprovação.");
      return;
    }

    const idsRhPendentes = pendentesRh.map((task) => task.id);
    const selecionadas = (tarefasSelecionadasLoteRh[remanejamentoId] || []).filter((id) =>
      idsRhPendentes.includes(id),
    );
    if (selecionadas.length === 0) {
      toast.error("Selecione pelo menos uma tarefa pendente.");
      return;
    }

    setAprovandoLoteRh((prev) => ({ ...prev, [remanejamentoId]: true }));
    setFalhasLotePorRemId((prev) => ({ ...prev, [remanejamentoId]: [] }));
    saveAnchorPos(remanejamentoId);

    const tarefasMap = new Map((bucket?.items || []).map((task) => [task.id, task]));
    const falhasLocais: string[] = [];
    const itensParaLote: { id: string; dataVencimento: string | null }[] = [];

    for (const tarefaId of selecionadas) {
      const tarefa = tarefasMap.get(tarefaId);
      if (!tarefa) {
        falhasLocais.push(`#${tarefaId}: tarefa não encontrada no lote atual.`);
        continue;
      }

      const dataVencimentoDraft = obterDataVencimentoEfetiva(tarefa);
      const erroData = getErroDataParaConclusao(tarefa, dataVencimentoDraft);
      if (erroData) {
        setErroDataPorTarefa((prev) => ({ ...prev, [tarefa.id]: erroData }));
        falhasLocais.push(`${tarefa.tipo}: ${erroData}`);
        continue;
      }

      itensParaLote.push({
        id: tarefa.id,
        dataVencimento: dataVencimentoDraft || null,
      });
    }

    if (itensParaLote.length === 0) {
      if (falhasLocais.length > 0) {
        setFalhasLotePorRemId((prev) => ({ ...prev, [remanejamentoId]: falhasLocais }));
        toast.error(
          `${falhasLocais.length} tarefa(s) não foram concluídas. Verifique os detalhes no quadro de tarefas.`,
        );
      }
      setAprovandoLoteRh((prev) => ({ ...prev, [remanejamentoId]: false }));
      restoreAnchorPos(remanejamentoId);
      return;
    }

    const idsParaLote = new Set(itensParaLote.map((item) => item.id));
    const dataVencimentoPorId = new Map(
      itensParaLote.map((item) => [item.id, item.dataVencimento]),
    );
    const snapshotById = new Map<string, Tarefa>();
    for (const item of itensParaLote) {
      const tarefa = tarefasMap.get(item.id);
      if (tarefa) snapshotById.set(item.id, tarefa);
    }

    const concluidaEmOtimizacao = new Date().toISOString();
    let tarefasOtimizadas: Tarefa[] | null = null;
    setTasksByRemId((prev) => {
      const curr = prev[remanejamentoId];
      if (!curr?.items?.length) return prev;
      let changed = false;
      const itemsAtualizados = curr.items.map((current) => {
        if (!idsParaLote.has(current.id)) return current;
        changed = true;
        return {
          ...current,
          status: "CONCLUIDO",
          dataConclusao: concluidaEmOtimizacao,
          dataVencimento: dataVencimentoPorId.get(current.id) || current.dataVencimento,
        };
      });
      if (!changed) return prev;
      tarefasOtimizadas = itemsAtualizados;
      return {
        ...prev,
        [remanejamentoId]: {
          ...curr,
          items: itemsAtualizados,
        },
      };
    });
    if (tarefasOtimizadas) {
      setItems((prev) =>
        prev.map((item) =>
          item.id === remanejamentoId
            ? {
                ...item,
                resumo: calcularResumoTarefas(
                  tarefasOtimizadas || [],
                  item.resumo?.ultimaAtualizacao,
                ),
              }
            : item,
        ),
      );
    }

    try {
      const response = await fetch("/api/logistica/tarefas/concluir-lote", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itens: itensParaLote }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error || "Falha ao concluir lote de tarefas.");
      }

      const result = (await response.json()) as ConcluirLoteResponse;
      const sucessoIds = new Set(result?.sucessoIds || []);
      const falhasApi = Array.isArray(result?.falhas) ? result.falhas : [];
      const falhasApiIds = new Set(falhasApi.map((f) => f.id));

      for (const item of itensParaLote) {
        if (!sucessoIds.has(item.id) && !falhasApiIds.has(item.id)) {
          falhasApi.push({
            id: item.id,
            error: "Sem confirmação de conclusão no lote.",
          });
          falhasApiIds.add(item.id);
        }
      }

      const falhasFormatadas = [
        ...falhasLocais,
        ...falhasApi.map((f) => {
          const tarefa = tarefasMap.get(f.id);
          return `${tarefa?.tipo || `#${f.id}`}: ${f.error}`;
        }),
      ];
      setFalhasLotePorRemId((prev) => ({ ...prev, [remanejamentoId]: falhasFormatadas }));

      if (sucessoIds.size > 0) {
        toast.success(`${sucessoIds.size} tarefa(s) aprovada(s).`);
        setErroDataPorTarefa((prev) => {
          const next = { ...prev };
          for (const id of sucessoIds) {
            if (next[id]) delete next[id];
          }
          return next;
        });
      }
      if (falhasFormatadas.length > 0) {
        toast.error(
          `${falhasFormatadas.length} tarefa(s) não foram concluídas. Verifique os detalhes no quadro de tarefas.`,
        );
      }

      if (falhasApi.length > 0) {
        for (const falha of falhasApi) {
          const tarefa = tarefasMap.get(falha.id);
          if (!tarefa) continue;
          if (precisaDataVencimento(tarefa)) {
            setErroDataPorTarefa((prev) => ({ ...prev, [falha.id]: falha.error }));
          }
        }
      }

      const idsFalhaApi = new Set(falhasApi.map((f) => f.id));
      if (idsFalhaApi.size > 0) {
        let tarefasRollback: Tarefa[] | null = null;
        setTasksByRemId((prev) => {
          const curr = prev[remanejamentoId];
          if (!curr?.items?.length) return prev;
          let changed = false;
          const itemsRollback = curr.items.map((current) => {
            if (!idsFalhaApi.has(current.id)) return current;
            const anterior = snapshotById.get(current.id);
            if (!anterior) return current;
            changed = true;
            return anterior;
          });
          if (!changed) return prev;
          tarefasRollback = itemsRollback;
          return {
            ...prev,
            [remanejamentoId]: {
              ...curr,
              items: itemsRollback,
            },
          };
        });
        if (tarefasRollback) {
          setItems((prev) =>
            prev.map((item) =>
              item.id === remanejamentoId
                ? {
                    ...item,
                    resumo: calcularResumoTarefas(
                      tarefasRollback || [],
                      item.resumo?.ultimaAtualizacao,
                    ),
                  }
                : item,
            ),
          );
        }
      }

      const pendentesSet = new Set(idsRhPendentes);
      setTarefasSelecionadasLoteRh((prev) => ({
        ...prev,
        [remanejamentoId]: (prev[remanejamentoId] || []).filter(
          (id) => !sucessoIds.has(id) && pendentesSet.has(id),
        ),
      }));

      if (sucessoIds.size > 0) agendarRefreshFuncionario(remanejamentoId, 1800);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro na aprovação em lote";
      toast.error(message);

      // Rollback total quando o endpoint de lote falha por completo.
      const idsRollback = new Set(itensParaLote.map((item) => item.id));
      if (idsRollback.size > 0) {
        let tarefasRollback: Tarefa[] | null = null;
        setTasksByRemId((prev) => {
          const curr = prev[remanejamentoId];
          if (!curr?.items?.length) return prev;
          let changed = false;
          const itemsRollback = curr.items.map((current) => {
            if (!idsRollback.has(current.id)) return current;
            const anterior = snapshotById.get(current.id);
            if (!anterior) return current;
            changed = true;
            return anterior;
          });
          if (!changed) return prev;
          tarefasRollback = itemsRollback;
          return {
            ...prev,
            [remanejamentoId]: {
              ...curr,
              items: itemsRollback,
            },
          };
        });
        if (tarefasRollback) {
          setItems((prev) =>
            prev.map((item) =>
              item.id === remanejamentoId
                ? {
                    ...item,
                    resumo: calcularResumoTarefas(
                      tarefasRollback || [],
                      item.resumo?.ultimaAtualizacao,
                    ),
                  }
                : item,
            ),
          );
        }
      }
    } finally {
      setAprovandoLoteRh((prev) => ({ ...prev, [remanejamentoId]: false }));
      restoreAnchorPos(remanejamentoId);
    }
  };

  const carregarObservacoes = async (task: Tarefa) => {
    setTaskObs(task);
    setObsModalOpen(true);
    setObsLoading(true);
    setObservacoes([]);
    setObsEditId(null);
    setObsEditTexto("");
    setObsJustificativaDataLimite("");
    setObsErroDataLimite("");
    setObsErroJustificativa("");
    setObsNovaDataLimite(formatDateInput(task.dataLimite));

    try {
      const response = await fetch(`/api/logistica/tarefas/${task.id}/observacoes`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Erro ao carregar observações");
      const data = await response.json();
      const list = Array.isArray(data) ? data : [];
      setObservacoes(list);
      setObservacoesCountMap((prev) => ({ ...prev, [task.id]: list.length }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao carregar observações";
      toast.error(message);
    } finally {
      setObsLoading(false);
    }
  };

  const adicionarObservacao = async () => {
    if (!taskObs) return;

    setObsErroDataLimite("");
    setObsErroJustificativa("");

    const textoInformado = obsJustificativaDataLimite.trim();
    const dataAtualInput = formatDateInput(taskObs.dataLimite);
    const alterouDataLimite = Boolean(
      obsNovaDataLimite && obsNovaDataLimite !== dataAtualInput,
    );

    const hoje = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const hojeStr = `${hoje.getFullYear()}-${pad(hoje.getMonth() + 1)}-${pad(hoje.getDate())}`;

    if (alterouDataLimite) {
      if (obsNovaDataLimite < hojeStr) {
        setObsErroDataLimite("A data limite não pode ser anterior à data atual.");
        return;
      }
      if (!textoInformado) {
        setObsErroJustificativa("A justificativa é obrigatória.");
        return;
      }
    }

    if (!textoInformado && !alterouDataLimite) {
      setObsErroJustificativa("Digite a observação.");
      return;
    }

    setSavingObs(true);
    if (alterouDataLimite) {
      saveAnchorPos(taskObs.remanejamentoFuncionarioId);
    }
    try {
      let novaDataLimiteIso: string | null = null;

      if (alterouDataLimite) {
        const [y, m, d] = obsNovaDataLimite.split("-").map(Number);
        novaDataLimiteIso = new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).toISOString();

        const responseDataLimite = await fetch(`/api/logistica/tarefas/${taskObs.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dataLimite: novaDataLimiteIso }),
        });
        if (!responseDataLimite.ok) {
          const err = await responseDataLimite.json().catch(() => ({}));
          throw new Error(err?.error || "Erro ao atualizar data limite");
        }
      }

      let textoObservacao = textoInformado;
      if (alterouDataLimite && novaDataLimiteIso) {
        const dataAnterior = taskObs.dataLimite
          ? formatDateOnly(taskObs.dataLimite)
          : "Não definida";
        const dataNova = formatDateOnly(novaDataLimiteIso);
        textoObservacao = `Data limite alterada: ${dataAnterior} -> ${dataNova}\n\nJustificativa: ${textoInformado}`;
      }

      const response = await fetch(`/api/logistica/tarefas/${taskObs.id}/observacoes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          texto: textoObservacao,
          criadoPor: usuario?.nome || "Sistema",
        }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error || "Erro ao adicionar observação");
      }

      if (alterouDataLimite && novaDataLimiteIso) {
        setTaskObs((prev) => (prev ? { ...prev, dataLimite: novaDataLimiteIso } : prev));
        setObsJustificativaDataLimite("");
        setObsNovaDataLimite(formatDateInput(novaDataLimiteIso));

        let tarefasAtualizadas: Tarefa[] | null = null;
        setTasksByRemId((prev) => {
          const bucket = prev[taskObs.remanejamentoFuncionarioId];
          if (!bucket?.items?.length) return prev;
          const itemsAtualizados = bucket.items.map((current) =>
            current.id === taskObs.id ? { ...current, dataLimite: novaDataLimiteIso } : current,
          );
          tarefasAtualizadas = itemsAtualizados;
          return {
            ...prev,
            [taskObs.remanejamentoFuncionarioId]: {
              ...bucket,
              items: itemsAtualizados,
            },
          };
        });
        if (tarefasAtualizadas) {
          setItems((prev) =>
            prev.map((item) =>
              item.id === taskObs.remanejamentoFuncionarioId
                ? {
                    ...item,
                    resumo: calcularResumoTarefas(
                      tarefasAtualizadas || [],
                      item.resumo?.ultimaAtualizacao,
                    ),
                  }
                : item,
            ),
          );
        }
        agendarRefreshFuncionario(taskObs.remanejamentoFuncionarioId);
      }

      setObsJustificativaDataLimite("");
      await carregarObservacoes(
        alterouDataLimite && novaDataLimiteIso
          ? { ...taskObs, dataLimite: novaDataLimiteIso }
          : taskObs,
      );
      toast.success(
        alterouDataLimite
          ? "Data limite atualizada e observação salva com sucesso."
          : "Observação adicionada com sucesso.",
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao adicionar observação";
      toast.error(message);
    } finally {
      setSavingObs(false);
      if (alterouDataLimite) {
        restoreAnchorPos(taskObs.remanejamentoFuncionarioId);
      }
    }
  };

  const salvarEdicaoObservacao = async () => {
    if (!taskObs || !obsEditId) return;
    if (!obsEditTexto.trim()) {
      toast.error("Digite uma observação.");
      return;
    }
    setSavingObs(true);
    try {
      const response = await fetch(
        `/api/logistica/tarefas/${taskObs.id}/observacoes/${obsEditId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ texto: obsEditTexto.trim() }),
        },
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error || "Erro ao editar observação");
      }
      setObsEditId(null);
      setObsEditTexto("");
      await carregarObservacoes(taskObs);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao editar observação";
      toast.error(message);
    } finally {
      setSavingObs(false);
    }
  };

  const excluirObservacao = async (obsId: string) => {
    if (!taskObs || !confirm("Tem certeza que deseja excluir esta observação?")) return;
    setSavingObs(true);
    try {
      const response = await fetch(`/api/logistica/tarefas/${taskObs.id}/observacoes/${obsId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error || "Erro ao excluir observação");
      }
      await carregarObservacoes(taskObs);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao excluir observação";
      toast.error(message);
    } finally {
      setSavingObs(false);
    }
  };

  const abrirDetalhes = (task: Tarefa) => {
    setTaskDetalhes(task);
    setDetalhesModalOpen(true);
  };

  const abrirDetalhesFuncionario = (item: HierarquiaItem) => {
    setFuncionarioDetalhes(item);
    setFuncionarioDetalhesModalOpen(true);
  };

  const carregarTarefasDetalhesFuncionario = useCallback(
    async (remanejamentoId: string, forceRefresh = false) => {
      if (!forceRefresh && detalhesTasksByRemId[remanejamentoId]?.items) return;
      setDetalhesTasksByRemId((prev) => ({
        ...prev,
        [remanejamentoId]: {
          loading: true,
          error: null,
          items: prev[remanejamentoId]?.items || [],
        },
      }));

      try {
        const params = new URLSearchParams();
        if (setorFixo) params.set("setor", setorFixo);
        if (ordenacaoDataLimite) params.set("ordenacaoDataLimite", ordenacaoDataLimite);
        const qs = params.toString();
        const url = qs
          ? `/api/v2/tarefas-hierarquia/${remanejamentoId}/tarefas?${qs}`
          : `/api/v2/tarefas-hierarquia/${remanejamentoId}/tarefas`;

        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(
            await parseApiError(
              response,
              "Falha ao carregar tarefas de detalhes do funcionário na V2",
            ),
          );
        }

        const data: TarefasResponse = await response.json();
        setDetalhesTasksByRemId((prev) => ({
          ...prev,
          [remanejamentoId]: {
            loading: false,
            error: null,
            items: data.items || [],
            metrics: data.metrics,
          },
        }));
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erro ao carregar tarefas de detalhes";
        setDetalhesTasksByRemId((prev) => ({
          ...prev,
          [remanejamentoId]: {
            loading: false,
            error: message,
            items: prev[remanejamentoId]?.items || [],
          },
        }));
      }
    },
    [detalhesTasksByRemId, ordenacaoDataLimite, setorFixo],
  );

  const taxaEfetivaMbps = useMemo(() => {
    if (!payloadBytes || !apiDurationMs || apiDurationMs <= 0) return null;
    const bits = payloadBytes * 8;
    const segundos = apiDurationMs / 1000;
    const mbps = bits / segundos / 1_000_000;
    return Number.isFinite(mbps) ? mbps : null;
  }, [payloadBytes, apiDurationMs]);

  const buildCleanFilters = useCallback(
    (nextLimit: number): FilterState => ({
      nomes: [],
      statusList: [],
      prioridadeList: [],
      setorList: setorFixo ? [setorFixo] : [],
      contratoList: [],
      tipoList: [],
      dataCategoria: "",
      dataExata: "",
      ordenacaoFuncionarios: "",
      ordenacaoDataLimite: "",
      limit: nextLimit,
    }),
    [setorFixo],
  );

  const limparFiltros = () => {
    const clean = buildCleanFilters(limit);
    setNomeList(clean.nomes);
    setStatusList(clean.statusList);
    setPrioridadeList(clean.prioridadeList);
    setSetorList(clean.setorList);
    setContratoList(clean.contratoList);
    setTipoList(clean.tipoList);
    setDataCategoria(clean.dataCategoria);
    setDataExata(clean.dataExata);
    setOrdenacaoFuncionarios(clean.ordenacaoFuncionarios);
    setOrdenacaoDataLimite(clean.ordenacaoDataLimite);
    setNomeSearch("");
    setTipoSearch("");
    setContratoSearch("");
    setAppliedFilters(clean);
    try {
      localStorage.setItem(LS_FILTERS_KEY, JSON.stringify(clean));
    } catch {}
    setPage(1);
  };

  const hasPendingFilterChanges = useMemo(() => {
    const currentSetorList = setorFixo ? [setorFixo] : setorList;
    const appliedSetorList = setorFixo ? [setorFixo] : appliedFilters.setorList;
    return JSON.stringify({
      nomes: nomeList,
      statusList,
      prioridadeList,
      setorList: currentSetorList,
      contratoList,
      tipoList,
      dataCategoria,
      dataExata,
      ordenacaoFuncionarios,
      ordenacaoDataLimite,
      limit,
    }) !==
      JSON.stringify({
        nomes: appliedFilters.nomes,
        statusList: appliedFilters.statusList,
        prioridadeList: appliedFilters.prioridadeList,
        setorList: appliedSetorList,
        contratoList: appliedFilters.contratoList,
        tipoList: appliedFilters.tipoList,
        dataCategoria: appliedFilters.dataCategoria,
        dataExata: appliedFilters.dataExata,
        ordenacaoFuncionarios: appliedFilters.ordenacaoFuncionarios,
        ordenacaoDataLimite: appliedFilters.ordenacaoDataLimite,
        limit: appliedFilters.limit,
      });
  }, [
    nomeList,
    statusList,
    prioridadeList,
    setorList,
    contratoList,
    tipoList,
    dataCategoria,
    dataExata,
    ordenacaoFuncionarios,
    ordenacaoDataLimite,
    limit,
    appliedFilters,
    setorFixo,
  ]);

  const aplicarFiltros = () => {
    if (!hasPendingFilterChanges) {
      void carregarHierarquia();
      return;
    }

    setAppliedFilters({
      nomes: nomeList,
      statusList,
      prioridadeList,
      setorList: setorFixo ? [setorFixo] : setorList,
      contratoList,
      tipoList,
      dataCategoria,
      dataExata,
      ordenacaoFuncionarios,
      ordenacaoDataLimite,
      limit,
    });
    setPage(1);
  };

  const contratoLabelMap = useMemo(() => {
    const map = new Map<number, string>();
    contratosOptions.forEach((c) => map.set(c.id, `${c.numero} - ${c.nome}`));
    return map;
  }, [contratosOptions]);

  const removerFiltroAplicado = useCallback(
    (tag: AppliedFilterTag) => {
      if (tag.kind === "setor" && setorFixo) return;

      const removeFromArray = <T extends string | number>(list: T[], value: T): T[] =>
        list.filter((item) => item !== value);

      if (tag.kind === "nome") {
        setNomeList((prev) => removeFromArray(prev, String(tag.value)));
        setAppliedFilters((prev) => ({
          ...prev,
          nomes: removeFromArray(prev.nomes, String(tag.value)),
        }));
      } else if (tag.kind === "status") {
        setStatusList((prev) => removeFromArray(prev, String(tag.value) as StatusFiltro));
        setAppliedFilters((prev) => ({
          ...prev,
          statusList: removeFromArray(prev.statusList, String(tag.value) as StatusFiltro),
        }));
      } else if (tag.kind === "prioridade") {
        setPrioridadeList((prev) => removeFromArray(prev, String(tag.value)));
        setAppliedFilters((prev) => ({
          ...prev,
          prioridadeList: removeFromArray(prev.prioridadeList, String(tag.value)),
        }));
      } else if (tag.kind === "setor") {
        setSetorList((prev) => removeFromArray(prev, String(tag.value) as Setor));
        setAppliedFilters((prev) => ({
          ...prev,
          setorList: removeFromArray(prev.setorList, String(tag.value) as Setor),
        }));
      } else if (tag.kind === "tipo") {
        setTipoList((prev) => removeFromArray(prev, String(tag.value)));
        setAppliedFilters((prev) => ({
          ...prev,
          tipoList: removeFromArray(prev.tipoList, String(tag.value)),
        }));
      } else if (tag.kind === "contrato") {
        const id = Number(tag.value);
        setContratoList((prev) => removeFromArray(prev, id));
        setAppliedFilters((prev) => ({
          ...prev,
          contratoList: removeFromArray(prev.contratoList, id),
        }));
      } else if (tag.kind === "dataCategoria") {
        setDataCategoria("");
        setAppliedFilters((prev) => ({ ...prev, dataCategoria: "" }));
      } else if (tag.kind === "dataExata") {
        setDataExata("");
        setAppliedFilters((prev) => ({ ...prev, dataExata: "" }));
      } else if (tag.kind === "ordenacaoFuncionarios") {
        setOrdenacaoFuncionarios("");
        setAppliedFilters((prev) => ({ ...prev, ordenacaoFuncionarios: "" }));
      } else if (tag.kind === "ordenacaoDataLimite") {
        setOrdenacaoDataLimite("");
        setAppliedFilters((prev) => ({ ...prev, ordenacaoDataLimite: "" }));
      }

      setPage(1);
    },
    [setorFixo],
  );

  const appliedFilterTags = useMemo(() => {
    const tags: AppliedFilterTag[] = [];

    appliedFilters.nomes.forEach((nome) => {
      tags.push({ id: `nome-${nome}`, label: `Nome: ${nome}`, kind: "nome", value: nome });
    });
    appliedFilters.statusList.forEach((status) => {
      tags.push({
        id: `status-${status}`,
        label: `Status: ${status}`,
        kind: "status",
        value: status,
      });
    });
    appliedFilters.prioridadeList.forEach((prioridade) => {
      tags.push({
        id: `prioridade-${prioridade}`,
        label: `Prioridade: ${prioridade}`,
        kind: "prioridade",
        value: prioridade,
      });
    });
    appliedFilters.setorList.forEach((setor) => {
      tags.push({ id: `setor-${setor}`, label: `Setor: ${setor}`, kind: "setor", value: setor });
    });
    appliedFilters.tipoList.forEach((tipo) => {
      tags.push({ id: `tipo-${tipo}`, label: `Tipo: ${tipo}`, kind: "tipo", value: tipo });
    });
    appliedFilters.contratoList.forEach((contratoId) => {
      tags.push({
        id: `contrato-${contratoId}`,
        label: `Contrato: ${contratoLabelMap.get(contratoId) || contratoId}`,
        kind: "contrato",
        value: contratoId,
      });
    });
    if (appliedFilters.dataCategoria) {
      const categoriaLabel: Record<DataCategoria, string> = {
        "": "",
        NOVO: "Novo",
        VENCIDOS: "Vencidos",
        A_VENCER: "Próximo de vencer",
        NO_PRAZO: "No prazo",
        SEM_DATA: "Sem data",
      };
      tags.push({
        id: `dataCategoria-${appliedFilters.dataCategoria}`,
        label: `Categoria: ${categoriaLabel[appliedFilters.dataCategoria]}`,
        kind: "dataCategoria",
        value: appliedFilters.dataCategoria,
      });
    }
    if (appliedFilters.dataExata) {
      tags.push({
        id: `dataExata-${appliedFilters.dataExata}`,
        label: `Data exata: ${appliedFilters.dataExata}`,
        kind: "dataExata",
        value: appliedFilters.dataExata,
      });
    }
    if (appliedFilters.ordenacaoFuncionarios) {
      tags.push({
        id: `ordFunc-${appliedFilters.ordenacaoFuncionarios}`,
        label: `Ord. func.: ${appliedFilters.ordenacaoFuncionarios}`,
        kind: "ordenacaoFuncionarios",
        value: appliedFilters.ordenacaoFuncionarios,
      });
    }
    if (appliedFilters.ordenacaoDataLimite) {
      tags.push({
        id: `ordTask-${appliedFilters.ordenacaoDataLimite}`,
        label: `Ord. tarefas: ${appliedFilters.ordenacaoDataLimite}`,
        kind: "ordenacaoDataLimite",
        value: appliedFilters.ordenacaoDataLimite,
      });
    }
    return tags;
  }, [appliedFilters, contratoLabelMap]);

  const nomesFiltrados = useMemo(() => {
    let base = nomesOptions;
    if (contratoList.length > 0) {
      base = base.filter((nome) => {
        const contratosDoNome = nomeContratosMap[nome] || [];
        return contratosDoNome.some((id) => contratoList.includes(id));
      });
    }

    const term = nomeSearch.trim().toLowerCase();
    if (!term) return base;
    return base.filter((nome) => nome.toLowerCase().includes(term));
  }, [nomesOptions, nomeSearch, contratoList, nomeContratosMap]);

  const tiposFiltrados = useMemo(() => {
    const term = tipoSearch.trim().toLowerCase();
    if (!term) return tiposOptions;
    return tiposOptions.filter((tipo) => tipo.toLowerCase().includes(term));
  }, [tiposOptions, tipoSearch]);

  const contratosFiltrados = useMemo(() => {
    const term = contratoSearch.trim().toLowerCase();
    if (!term) return contratosOptions;
    return contratosOptions.filter((contrato) =>
      `${contrato.numero} ${contrato.nome}`.toLowerCase().includes(term),
    );
  }, [contratosOptions, contratoSearch]);

  const filterInputClass =
    "rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-400";
  const filterSectionClass = "rounded-lg border border-slate-200 bg-slate-50/70 p-2.5";
  const filterTitleClass =
    "mb-1.5 inline-flex rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600";
  const filterChipBaseClass =
    "inline-flex cursor-pointer items-center rounded-md border px-2 py-0.5 text-[11px] leading-4 transition-colors";
  const filterMenuTriggerClass =
    "cursor-pointer list-none rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300";
  const filterMenuListClass =
    "mt-1.5 max-h-36 overflow-auto rounded-md border border-slate-200 bg-white p-1.5 space-y-0.5";

  return (
    <div className="tarefas-v2-root p-4 md:p-6 space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-slate-900">
              Tarefas V2 Hierárquica
            </h1>
            <p className="text-sm text-slate-600">
              Resumo por funcionário com tarefas sob demanda e operações completas.
            </p>
          </div>
          <div className="text-xs text-slate-500 text-right">
            <div>{apiDurationMs !== null ? `API: ${apiDurationMs}ms` : "API: -"}</div>
            <div>{payloadBytes !== null ? `Payload: ${payloadBytes} bytes` : "Payload: -"}</div>
            <div>
              {totalTarefasFiltradas !== null
                ? `Tarefas filtradas: ${totalTarefasFiltradas}`
                : "Tarefas filtradas: -"}
            </div>
            <div>
              {taxaEfetivaMbps !== null
                ? `Taxa efetiva (API): ${taxaEfetivaMbps.toFixed(2)} Mbps`
                : "Taxa efetiva (API): -"}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-300 bg-white p-3 space-y-2 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 items-start">
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 py-2 flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700">
              {resumoFiltrado.totalFuncionarios} funcionários com pendências
            </span>
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700">
              {resumoFiltrado.totalPendencias} tarefas pendentes
              {" "}
              (
              {resumoFiltrado.totalPendenciasNoPrazo} no prazo |{" "}
              {resumoFiltrado.totalPendenciasForaPrazo} fora do prazo |{" "}
              {resumoFiltrado.totalReprovadas} reprovadas
              )
            </span>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 flex items-center justify-end gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void exportarParaExcel()}
                disabled={exportingExcel}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-400 bg-white px-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="h-3.5 w-3.5"
                  aria-hidden="true"
                >
                  <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                  <path d="M14 3v6h6" />
                  <path d="m8 14 2 3 2-3 2 3 2-3" />
                </svg>
                {exportingExcel ? "Exportando..." : "Exportar Excel"}
              </button>
              <button
                type="button"
                onClick={() => setFiltrosCollapsed((prev) => !prev)}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border-2 border-blue-500 bg-white px-2.5 text-xs font-medium text-blue-800 shadow-sm hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-300"
                aria-expanded={!filtrosCollapsed}
                aria-label={filtrosCollapsed ? "Expandir filtros" : "Recolher filtros"}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="h-3.5 w-3.5"
                  aria-hidden="true"
                >
                  <path d="M3 5h18l-7 8v5l-4 2v-7z" />
                </svg>
                <span>{filtrosCollapsed ? "Expandir filtros" : "Recolher filtros"}</span>
                <span>{filtrosCollapsed ? "▾" : "▴"}</span>
              </button>
            </div>
          </div>
        </div>
        {!filtrosCollapsed && (
          <>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2 text-sm">
          <div className={filterSectionClass}>
            <div className={filterTitleClass}>Contratos</div>
            <details className="group">
              <summary className={filterMenuTriggerClass}>
                {contratoList.length > 0
                  ? `${contratoList.length} contrato(s) selecionado(s)`
                  : "Selecionar contratos"}
              </summary>
              <div className={filterMenuListClass}>
                <input
                  value={contratoSearch}
                  onChange={(e) => setContratoSearch(e.target.value)}
                  placeholder="Pesquisar contrato..."
                  className="mb-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
                />
                {contratosFiltrados.map((contrato) => (
                  <label
                    key={contrato.id}
                    className="flex items-center gap-2 rounded px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={contratoList.includes(contrato.id)}
                      onChange={() =>
                        setContratoList((prev) => toggleArrayValue(prev, contrato.id))
                      }
                      className="h-3 w-3 accent-slate-600"
                    />
                    <span>{contrato.numero} - {contrato.nome}</span>
                  </label>
                ))}
                {contratosFiltrados.length === 0 && (
                  <div className="px-2 py-1 text-[11px] text-slate-400">Nenhum contrato encontrado</div>
                )}
              </div>
            </details>
          </div>

          <div className={filterSectionClass}>
            <div className={filterTitleClass}>Status</div>
            <details className="group">
              <summary className={filterMenuTriggerClass}>
                {statusList.length > 0
                  ? `${statusList.length} status selecionado(s)`
                  : "Selecionar status"}
              </summary>
              <div className={filterMenuListClass}>
                {STATUS_OPTIONS.map((status) => (
                  <label
                    key={status}
                    className="flex items-center gap-2 rounded px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={statusList.includes(status)}
                      onChange={() => setStatusList((prev) => toggleArrayValue(prev, status))}
                      className="h-3 w-3 accent-slate-600"
                    />
                    <span>{status}</span>
                  </label>
                ))}
              </div>
            </details>
          </div>

          <div className={`${filterSectionClass} space-y-2`}>
            <div className={filterTitleClass}>Ordenação</div>
            <select
              value={ordenacaoFuncionarios}
              onChange={(e) => {
                setOrdenacaoFuncionarios(e.target.value as OrdenacaoFuncionarios);
              }}
              className={`w-full ${filterInputClass}`}
            >
              <option value="">Funcionários</option>
              <option value="PENDENCIAS_DESC">Pendências desc</option>
              <option value="PENDENCIAS_ASC">Pendências asc</option>
              <option value="PROGRESSO_DESC">Progresso desc</option>
              <option value="PROGRESSO_ASC">Progresso asc</option>
              <option value="NOME_AZ">Nome A-Z</option>
              <option value="NOME_ZA">Nome Z-A</option>
              <option value="ATUALIZACAO_DESC">Atualização desc</option>
              <option value="ATUALIZACAO_ASC">Atualização asc</option>
            </select>
            <select
              value={ordenacaoDataLimite}
              onChange={(e) => {
                setOrdenacaoDataLimite(e.target.value as OrdenacaoDataLimite);
              }}
              className={`w-full ${filterInputClass}`}
            >
              <option value="">Tarefas</option>
              <option value="asc">Data limite asc</option>
              <option value="desc">Data limite desc</option>
            </select>
          </div>

          <div className={filterSectionClass}>
            <div className={filterTitleClass}>Setor</div>
            {setorFixo ? (
              <div className="text-slate-600 text-xs">{setorFixo} (fixo)</div>
            ) : (
              <details className="group">
                <summary className={filterMenuTriggerClass}>
                  {setorList.length > 0
                    ? `${setorList.length} setor(es) selecionado(s)`
                    : "Selecionar setor"}
                </summary>
                <div className={filterMenuListClass}>
                {SETOR_OPTIONS.map((setor) => (
                  <label
                    key={setor}
                    className="flex items-center gap-2 rounded px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={setorList.includes(setor)}
                      onChange={() => setSetorList((prev) => toggleArrayValue(prev, setor))}
                      className="h-3 w-3 accent-slate-600"
                    />
                    <span>{setor}</span>
                  </label>
                ))}
                </div>
              </details>
            )}
          </div>

          <div className={filterSectionClass}>
            <div className={filterTitleClass}>Prioridade</div>
            <details className="group">
              <summary className={filterMenuTriggerClass}>
                {prioridadeList.length > 0
                  ? `${prioridadeList.length} prioridade(s) selecionada(s)`
                  : "Selecionar prioridade"}
              </summary>
              <div className={filterMenuListClass}>
                {PRIORIDADE_OPTIONS.map((prioridade) => (
                  <label
                    key={prioridade}
                    className="flex items-center gap-2 rounded px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={prioridadeList.includes(prioridade)}
                      onChange={() =>
                        setPrioridadeList((prev) => toggleArrayValue(prev, prioridade))
                      }
                      className="h-3 w-3 accent-slate-600"
                    />
                    <span>{prioridade}</span>
                  </label>
                ))}
              </div>
            </details>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
          <div className={filterSectionClass}>
            <div className={filterTitleClass}>Nomes</div>
            <details className="group">
              <summary className={filterMenuTriggerClass}>
                {nomeList.length > 0 ? `${nomeList.length} nome(s) selecionado(s)` : "Selecionar nomes"}
              </summary>
              <div className={filterMenuListClass}>
                <input
                  value={nomeSearch}
                  onChange={(e) => setNomeSearch(e.target.value)}
                  placeholder="Pesquisar nome..."
                  className="mb-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
                />
                {nomesFiltrados.map((nome, idx) => (
                  <label
                    key={`${nome}-${idx}`}
                    className="flex items-center gap-2 rounded px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={nomeList.includes(nome)}
                      onChange={() => setNomeList((prev) => toggleArrayValue(prev, nome))}
                      className="h-3 w-3 accent-slate-600"
                    />
                    <span>{nome}</span>
                  </label>
                ))}
                {nomesFiltrados.length === 0 && (
                  <div className="px-2 py-1 text-[11px] text-slate-400">Nenhum nome encontrado</div>
                )}
              </div>
            </details>
          </div>

          <div className={filterSectionClass}>
            <div className={filterTitleClass}>Tipos</div>
            <details className="group">
              <summary className={filterMenuTriggerClass}>
                {tipoList.length > 0 ? `${tipoList.length} tipo(s) selecionado(s)` : "Selecionar tipos"}
              </summary>
              <div className={filterMenuListClass}>
                <input
                  value={tipoSearch}
                  onChange={(e) => setTipoSearch(e.target.value)}
                  placeholder="Pesquisar tipo..."
                  className="mb-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
                />
                {tiposFiltrados.map((tipo) => (
                  <label key={tipo} className="flex items-center gap-2 rounded px-2 py-1 text-xs text-slate-700 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={tipoList.includes(tipo)}
                      onChange={() => setTipoList((prev) => toggleArrayValue(prev, tipo))}
                      className="h-3 w-3 accent-slate-600"
                    />
                    <span>{tipo}</span>
                  </label>
                ))}
                {tiposFiltrados.length === 0 && (
                  <div className="px-2 py-1 text-[11px] text-slate-400">Nenhum tipo encontrado</div>
                )}
              </div>
            </details>
          </div>

          <div className={filterSectionClass}>
            <div className={filterTitleClass}>Data Exata</div>
            <input
              type="date"
              value={dataExata}
              onChange={(e) => {
                setDataExata(e.target.value);
              }}
              className={`w-full ${filterInputClass}`}
            />
          </div>

          <div className={filterSectionClass}>
            <div className={filterTitleClass}>Categoria de Data</div>
            <select
              value={dataCategoria}
              onChange={(e) => {
                setDataCategoria(e.target.value as DataCategoria);
              }}
              className={`w-full ${filterInputClass}`}
            >
              <option value="">Todas</option>
              <option value="VENCIDOS">Vencidos</option>
              <option value="A_VENCER">Próximo de vencer</option>
              <option value="NO_PRAZO">No prazo</option>
              <option value="NOVO">Novo</option>
            </select>
          </div>

          <div className={filterSectionClass}>
            <div className={filterTitleClass}>Itens por Página</div>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
              }}
              className={`w-full ${filterInputClass}`}
            >
              <option value={10}>10 / página</option>
              <option value={20}>20 / página</option>
              <option value={30}>30 / página</option>
              <option value={50}>50 / página</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm border-t border-slate-200 pt-2">
          <button
            type="button"
            onClick={aplicarFiltros}
            className="rounded-md border border-slate-700 bg-slate-700 text-white px-2.5 py-1.5 text-xs hover:bg-slate-800 transition-colors"
          >
            Aplicar
          </button>
          <button
            type="button"
            onClick={limparFiltros}
            className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs bg-white text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Limpar filtros
          </button>
          {hasPendingFilterChanges && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-900 bg-amber-100 border border-amber-300 rounded px-2.5 py-1 shadow-sm">
              <span aria-hidden="true">!</span>
              <span>Filtros alterados. Clique em Aplicar para que os filtros sejam aplicados.</span>
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-slate-500">Aplicados:</span>
          {appliedFilterTags.length === 0 ? (
            <span className="text-[11px] text-slate-400">Nenhum filtro ativo</span>
          ) : (
            appliedFilterTags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-0.5 text-[11px] text-slate-700"
              >
                <span>{tag.label}</span>
                {!(tag.kind === "setor" && setorFixo) && (
                  <button
                    type="button"
                    onClick={() => removerFiltroAplicado(tag)}
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[11px] font-semibold leading-none text-slate-600 hover:bg-slate-100 hover:text-slate-800"
                    aria-label={`Remover filtro ${tag.label}`}
                    title={`Remover ${tag.label}`}
                  >
                    ×
                  </button>
                )}
              </span>
            ))
          )}
        </div>
          </>
        )}
      </div>

      <div className="rounded-xl border border-slate-300 bg-white shadow-sm overflow-x-auto">
        {loading ? (
          <div className="p-6 text-sm text-slate-600">Carregando hierarquia...</div>
        ) : error ? (
          <div className="p-6 text-sm text-rose-700">{error}</div>
        ) : items.length === 0 ? (
          <div className="p-6 text-sm text-slate-600">Nenhum funcionário encontrado.</div>
        ) : (
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-100/80">
              <tr>
                <th className="px-2 py-1.5 text-left">Funcionário</th>
                <th className="px-2 py-1.5 text-left">Matrícula</th>
                <th className="px-2 py-1.5 text-left">Função</th>
                <th className="px-2 py-1.5 text-left">Regime</th>
                <th className="px-2 py-1.5 text-left">Admissão</th>
                <th className="px-2 py-1.5 text-left">Tipo</th>
                <th className="px-2 py-1.5 text-left">Contrato origem</th>
                <th className="px-2 py-1.5 text-left">Contrato destino</th>
                <th className="px-2 py-1.5 text-left">Pendências</th>
                <th className="px-2 py-1.5 text-left">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {items.map((item, itemIndex) => {
                const expanded = expandedIds.has(item.id);
                const bucket = tasksByRemId[item.id];
                const admissaoMeta = getAdmissaoMeta(item.funcionario.dataAdmissao);
                return (
                  <Fragment key={item.id}>
                    <tr
                      key={item.id}
                      data-rem-id={item.id}
                      className={`border-l-4 ${
                        expanded ? "border-l-slate-500 bg-slate-100" : "border-l-transparent bg-white"
                      } ${!expanded && itemIndex % 2 === 1 ? "bg-slate-50/40" : ""} hover:bg-slate-50 transition-colors`}
                    >
                      <td className="px-2 py-1.5 align-top">
                        <div className="font-semibold text-slate-800">{item.funcionario.nome}</div>
                      </td>
                      <td className="px-2 py-1.5 align-top text-slate-600">
                        {item.funcionario.matricula || "-"}
                      </td>
                      <td className="px-2 py-1.5 align-top text-slate-600">
                        {item.funcionario.funcao || "-"}
                      </td>
                      <td className="px-2 py-1.5 align-top text-slate-600">
                        {resolveRegime(item.funcionario.funcao, item.funcionario.regime)}
                      </td>
                      <td className="px-2 py-1.5 align-top text-slate-600">
                        <div>{admissaoMeta.texto}</div>
                        {admissaoMeta.isFutura ? (
                          <span
                            className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800"
                            title="Admissão futura (ainda não admitido)"
                          >
                            Admissão futura
                          </span>
                        ) : (
                          admissaoMeta.isNovo && (
                            <span
                              className="inline-flex items-center rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800"
                              title="Admitido há menos de 48h"
                            >
                              Novo
                            </span>
                          )
                        )}
                      </td>
                      <td className="px-2 py-1.5 align-top text-slate-600">
                        {formatarTipoSolicitacao(item.solicitacao?.tipo)}
                      </td>
                      <td className="px-2 py-1.5 align-top text-slate-600">
                        {getContratoOrigemNumero(item)}
                      </td>
                      <td className="px-2 py-1.5 align-top text-slate-600">
                        {getContratoDestinoNumero(item)}
                      </td>
                      <td className="px-2 py-1.5 align-top">
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                          {item.resumo.pendencias}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 align-top">
                        <div className="flex flex-wrap gap-1">
                          <button
                            type="button"
                            onClick={() => abrirDetalhesFuncionario(item)}
                            className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 hover:text-slate-700"
                          >
                            Detalhes
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleExpand(item.id)}
                            className="rounded border border-blue-400 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.2)] hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
                          >
                            {expanded ? "Ocultar" : "Ver tarefas"}
                          </button>
                        </div>
                      </td>
                    </tr>

                    {expanded && (
                      <tr key={`${item.id}-expanded`}>
                        <td
                          colSpan={10}
                          className={`px-5 py-4 border-y border-slate-200 ${
                            itemIndex % 2 === 1 ? "bg-slate-100/60" : "bg-slate-50"
                          }`}
                        >
                          {bucket?.loading ? (
                            <div className="text-sm text-slate-600">Carregando tarefas...</div>
                          ) : bucket?.error ? (
                            <div className="text-sm text-rose-700">{bucket.error}</div>
                          ) : !bucket?.items?.length ? (
                            <div className="text-sm text-slate-600">Nenhuma tarefa encontrada para este funcionário.</div>
                          ) : (
                            <div className="rounded-lg border border-slate-300 bg-white shadow-sm p-3 space-y-3">
                              {(() => {
                                const tarefasPendentes = (bucket.items || []).filter(
                                  (task) => !isConcluidaStatus(task.status),
                                );
                                const idsPendentes = tarefasPendentes.map((task) => task.id);
                                const idsPendentesSet = new Set(idsPendentes);
                                const idsSelecionaveis = tarefasPendentes
                                  .filter((task) => podeSelecionarEmLote(task))
                                  .map((task) => task.id);
                                const selecionadasGrupo = (tarefasSelecionadasLoteRh[item.id] || []).filter(
                                  (id) => idsPendentesSet.has(id),
                                );
                                const todasRhPendentesSelecionadas =
                                  idsSelecionaveis.length > 0 &&
                                  idsSelecionaveis.every((id) => selecionadasGrupo.includes(id));
                                const aprovandoGrupo = !!aprovandoLoteRh[item.id];
                                const falhasLoteGrupo = falhasLotePorRemId[item.id] || [];
                                const showSetorColumn = !setorFixo;

                                return (
                                  <>
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                                <div className="text-sm font-semibold text-slate-800">
                                  Tarefas de {item.funcionario.nome}
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="text-xs text-slate-500">
                                    {bucket.metrics?.durationMs
                                      ? `API detalhes: ${bucket.metrics.durationMs}ms`
                                      : ""}
                                  </div>
                                  {isAdmin && (
                                    <button
                                      type="button"
                                      onClick={() => void aprovarRhEmLote(item.id)}
                                      disabled={selecionadasGrupo.length === 0 || aprovandoGrupo}
                                      className="rounded-md bg-blue-600 text-white px-2 py-1 text-[11px] font-medium hover:bg-blue-700 disabled:opacity-50"
                                    >
                                      {aprovandoGrupo
                                        ? "Aprovando..."
                                        : `Aprovar selecionados (${selecionadasGrupo.length})`}
                                    </button>
                                  )}
                                </div>
                              </div>
                              {isAdmin && falhasLoteGrupo.length > 0 && (
                                <div className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
                                  Falhas no lote: {falhasLoteGrupo.slice(0, 3).join(" | ")}
                                  {falhasLoteGrupo.length > 3
                                    ? ` | +${falhasLoteGrupo.length - 3} item(ns)`
                                    : ""}
                                </div>
                              )}
                              <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-slate-200 text-xs">
                                  <thead className="bg-slate-100">
                                    <tr>
                                      {isAdmin && (
                                        <th className="px-2 py-1.5 text-left font-semibold text-slate-700">
                                          <input
                                            type="checkbox"
                                            checked={todasRhPendentesSelecionadas}
                                            onChange={(e) =>
                                              toggleSelecionarTodasRh(item.id, bucket.items, e.target.checked)
                                            }
                                            disabled={idsSelecionaveis.length === 0 || aprovandoGrupo}
                                            className="h-3.5 w-3.5 accent-blue-600"
                                            title="Selecionar todas as tarefas elegíveis do lote"
                                          />
                                        </th>
                                      )}
                                      <th className="px-2 py-1.5 text-left font-semibold text-slate-700">Tarefa</th>
                                      {showSetorColumn && (
                                        <th className="px-2 py-1.5 text-left font-semibold text-slate-700">Setor</th>
                                      )}
                                      <th className="px-2 py-1.5 text-left font-semibold text-slate-700">Status</th>
                                      <th className="px-2 py-1.5 text-left font-semibold text-slate-700">Data limite</th>
                                      <th className="px-2 py-1.5 text-left font-semibold text-slate-700">Data vencimento</th>
                                      <th className="px-2 py-1.5 text-left font-semibold text-slate-700">Ações</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {bucket.items.map((task, taskIndex) => (
                                      (() => {
                                        const vencida = isTarefaVencida(task);
                                        const concluida = isConcluidaStatus(task.status);
                                        const exigeDataVencimento = precisaDataVencimento(task);
                                        const dataVencimentoAtual = obterDataVencimentoEfetiva(task);
                                        const dataValidaParaLote = !validarDataVencimentoMinimoD30(
                                          dataVencimentoAtual,
                                        );
                                        const checkboxHabilitado =
                                          !concluida &&
                                          (!exigeDataVencimento || dataValidaParaLote);
                                        return (
                                      <tr
                                        key={task.id}
                                        className={`border-l-4 ${statusBarClass(task.status)} ${
                                          taskIndex % 2 === 0 ? "bg-white" : "bg-slate-50"
                                        } ${vencida ? "bg-amber-50/60" : ""}`}
                                      >
                                        {isAdmin && (
                                          <td className="px-2 py-1 align-middle text-center">
                                            <div className="flex items-center justify-center">
                                              <input
                                                type="checkbox"
                                                checked={
                                                  checkboxHabilitado
                                                    ? selecionadasGrupo.includes(task.id)
                                                    : false
                                                }
                                                onChange={(e) =>
                                                  toggleSelecionarTarefaRh(item.id, task.id, e.target.checked)
                                                }
                                                disabled={aprovandoGrupo || !checkboxHabilitado}
                                                className="h-3.5 w-3.5 accent-blue-600"
                                                title={
                                                  checkboxHabilitado
                                                    ? "Selecionar tarefa"
                                                    : "Preencha uma data de vencimento válida para habilitar"
                                                }
                                              />
                                            </div>
                                          </td>
                                        )}
                                        <td className="px-2 py-1 align-top">
                                          <div className="font-medium text-slate-800">{task.tipo}</div>
                                        </td>
                                        {showSetorColumn && (
                                          <td className="px-2 py-1 align-top">{task.responsavel}</td>
                                        )}
                                        <td className="px-2 py-1 align-top">{task.status}</td>
                                        <td className="px-2 py-1 align-top text-[11px]">
                                          <span className="text-slate-700">
                                            {formatDateOnly(task.dataLimite)}
                                          </span>
                                          {vencida && (
                                            <span className="ml-1 text-amber-700 font-medium">
                                              (Vencida)
                                            </span>
                                          )}
                                        </td>
                                        <td className="px-2 py-1 align-top">
                                          {exigeDataVencimento ? (
                                            <div className="space-y-1">
                                              <input
                                                type="date"
                                                value={dataVencimentoAtual}
                                                onChange={(e) => {
                                                  const valor = e.target.value;
                                                  if (concluida) return;
                                                  setDataVencimentoPorTarefa((prev) => ({
                                                    ...prev,
                                                    [task.id]: valor,
                                                  }));

                                                  if (!valor) {
                                                    setErroDataPorTarefa((prev) => {
                                                      if (!prev[task.id]) return prev;
                                                      const next = { ...prev };
                                                      delete next[task.id];
                                                      return next;
                                                    });
                                                    toggleSelecionarTarefaRh(item.id, task.id, false);
                                                    return;
                                                  }

                                                  const erro = validarDataVencimentoMinimoD30(valor);
                                                  if (erro) {
                                                    setErroDataPorTarefa((prev) => ({
                                                      ...prev,
                                                      [task.id]: erro,
                                                    }));
                                                    toggleSelecionarTarefaRh(item.id, task.id, false);
                                                    return;
                                                  }

                                                  setErroDataPorTarefa((prev) => {
                                                    if (!prev[task.id]) return prev;
                                                    const next = { ...prev };
                                                    delete next[task.id];
                                                    return next;
                                                  });
                                                  if (isAdmin) {
                                                    toggleSelecionarTarefaRh(item.id, task.id, true);
                                                  }
                                                }}
                                                readOnly={concluida}
                                                disabled={concluida}
                                                className={`w-[150px] rounded border px-2 py-1 text-xs ${
                                                  concluida
                                                    ? "border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed"
                                                    : "border-slate-300"
                                                }`}
                                              />
                                              {erroDataPorTarefa[task.id] && (
                                                <div className="text-[10px] text-rose-600">
                                                  {erroDataPorTarefa[task.id]}
                                                </div>
                                              )}
                                            </div>
                                          ) : (
                                            <span className="text-slate-400">-</span>
                                          )}
                                        </td>
                                        <td className="px-2 py-1 align-top">
                                          <div className="flex items-center gap-1">
                                            {!isConcluidaStatus(task.status) && (
                                              <button
                                                type="button"
                                                onClick={() => void concluirTarefa(task)}
                                                className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-300 text-slate-700 hover:bg-slate-100"
                                                title="Concluir tarefa"
                                                aria-label="Concluir tarefa"
                                              >
                                                <svg
                                                  xmlns="http://www.w3.org/2000/svg"
                                                  viewBox="0 0 24 24"
                                                  fill="none"
                                                  stroke="currentColor"
                                                  strokeWidth="2"
                                                  strokeLinecap="round"
                                                  strokeLinejoin="round"
                                                  className="h-4 w-4"
                                                >
                                                  <path d="M20 6 9 17l-5-5" />
                                                </svg>
                                              </button>
                                            )}
                                            <button
                                              type="button"
                                              onClick={() => abrirDetalhes(task)}
                                              className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-300 text-slate-700 hover:bg-slate-100"
                                              title="Ver detalhes"
                                              aria-label="Ver detalhes"
                                            >
                                              <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                className="h-4 w-4"
                                              >
                                                <circle cx="12" cy="12" r="10" />
                                                <path d="M12 16v-4" />
                                                <path d="M12 8h.01" />
                                              </svg>
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => void carregarObservacoes(task)}
                                              className="relative inline-flex h-7 w-7 items-center justify-center rounded border border-slate-300 text-slate-700 hover:bg-slate-100"
                                              title="Observações"
                                              aria-label="Observações"
                                            >
                                              <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                className="h-4 w-4"
                                              >
                                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                              </svg>
                                              {(observacoesCountMap[task.id] || 0) > 0 && (
                                                <span className="absolute -top-1 -right-1 min-w-4 rounded-full bg-rose-500 px-1 text-[10px] leading-4 text-white text-center">
                                                  {observacoesCountMap[task.id]}
                                                </span>
                                              )}
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                        );
                                      })()
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                                  </>
                                );
                              })()}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex items-center justify-between text-sm">
        <div className="text-slate-600">
          Total: {totalItems} funcionários | Página {page} de {Math.max(totalPages, 1)}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
            className="rounded-lg border border-slate-300 px-3 py-1 disabled:opacity-50"
          >
            Anterior
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((prev) => prev + 1)}
            className="rounded-lg border border-slate-300 px-3 py-1 disabled:opacity-50"
          >
            Próxima
          </button>
        </div>
      </div>

      {funcionarioDetalhesModalOpen && funcionarioDetalhes && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Detalhes do funcionário</h2>
              <button
                type="button"
                onClick={() => setFuncionarioDetalhesModalOpen(false)}
                className="rounded-lg border border-slate-300 px-3 py-1 text-sm"
              >
                Fechar
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              <div>
                <div className="text-slate-500 text-xs">Funcionário</div>
                <div className="text-slate-800">{funcionarioDetalhes.funcionario.nome || "-"}</div>
              </div>
              <div>
                <div className="text-slate-500 text-xs">Matrícula</div>
                <div className="text-slate-800">{funcionarioDetalhes.funcionario.matricula || "-"}</div>
              </div>
              <div>
                <div className="text-slate-500 text-xs">Função</div>
                <div className="text-slate-800">{funcionarioDetalhes.funcionario.funcao || "-"}</div>
              </div>
              <div>
                <div className="text-slate-500 text-xs">Regime</div>
                <div className="text-slate-800">
                  {resolveRegime(
                    funcionarioDetalhes.funcionario.funcao,
                    funcionarioDetalhes.funcionario.regime,
                  )}
                </div>
              </div>
              <div>
                <div className="text-slate-500 text-xs">Data admissão</div>
                <div className="text-slate-800">
                  {formatDateOnly(funcionarioDetalhes.funcionario.dataAdmissao)}
                </div>
              </div>
              <div>
                <div className="text-slate-500 text-xs">Última atualização</div>
                <div className="text-slate-800">
                  {formatDateTime(funcionarioDetalhes.resumo.ultimaAtualizacao)}
                </div>
              </div>
              <div>
                <div className="text-slate-500 text-xs">ID solicitação</div>
                <div className="text-slate-800">#{funcionarioDetalhes.solicitacao.id}</div>
              </div>
              <div>
                <div className="text-slate-500 text-xs">Tipo solicitação</div>
                <div className="text-slate-800">{funcionarioDetalhes.solicitacao.tipo || "-"}</div>
              </div>
              <div>
                <div className="text-slate-500 text-xs">Contrato origem</div>
                <div className="text-slate-800">
                  {getContratoOrigemDescricao(funcionarioDetalhes)}
                </div>
              </div>
              <div>
                <div className="text-slate-500 text-xs">Contrato destino</div>
                <div className="text-slate-800">
                  {getContratoDestinoDescricao(funcionarioDetalhes)}
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-medium text-slate-700 mb-2">Resumo de tarefas</div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                <div className="rounded bg-white border border-slate-200 p-2">
                  <div className="text-slate-500">Pendentes</div>
                  <div className="font-semibold text-slate-800">{funcionarioDetalhes.resumo.pendentes}</div>
                </div>
                <div className="rounded bg-white border border-slate-200 p-2">
                  <div className="text-slate-500">Reprovadas</div>
                  <div className="font-semibold text-slate-800">{funcionarioDetalhes.resumo.reprovadas}</div>
                </div>
                <div className="rounded bg-white border border-slate-200 p-2">
                  <div className="text-slate-500">Concluídas</div>
                  <div className="font-semibold text-slate-800">{funcionarioDetalhes.resumo.concluidas}</div>
                </div>
                <div className="rounded bg-white border border-slate-200 p-2">
                  <div className="text-slate-500">Atrasadas</div>
                  <div className="font-semibold text-slate-800">{funcionarioDetalhes.resumo.atrasadas}</div>
                </div>
                <div className="rounded bg-white border border-slate-200 p-2">
                  <div className="text-slate-500">Total</div>
                  <div className="font-semibold text-slate-800">{funcionarioDetalhes.resumo.total}</div>
                </div>
              </div>
            </div>

            {(() => {
              const bucket = detalhesTasksByRemId[funcionarioDetalhes.id];
              const tarefas = bucket?.items || [];
              const concluidas = tarefas.filter((task) => {
                const status = (task.status || "").toUpperCase();
                return status === "CONCLUIDO" || status === "CONCLUIDA" || status === "APROVADO";
              });
              const carregado = Boolean(bucket);

              return (
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-medium text-slate-700">
                      Tarefas concluídas (aprovadas)
                    </h3>
                    <button
                      type="button"
                      onClick={() =>
                        void carregarTarefasDetalhesFuncionario(funcionarioDetalhes.id, true)
                      }
                      className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                    >
                      {carregado ? "Recarregar" : "Carregar"}
                    </button>
                  </div>

                  {bucket?.loading ? (
                    <div className="text-xs text-slate-600">Carregando tarefas...</div>
                  ) : !carregado ? (
                    <div className="text-xs text-slate-600">
                      Clique em Carregar para buscar as tarefas concluídas.
                    </div>
                  ) : bucket?.error ? (
                    <div className="text-xs text-rose-700">{bucket.error}</div>
                  ) : tarefas.length === 0 ? (
                    <div className="text-xs text-slate-600">
                      Nenhuma tarefa encontrada para este funcionário.
                    </div>
                  ) : concluidas.length === 0 ? (
                    <div className="text-xs text-slate-600">
                      Nenhuma tarefa concluída no escopo atual.
                    </div>
                  ) : (
                    <div className="max-h-56 overflow-auto rounded border border-slate-200">
                      <table className="min-w-full divide-y divide-slate-200 text-xs">
                        <thead className="bg-slate-100">
                          <tr>
                            <th className="px-2 py-1.5 text-left font-medium text-slate-700">
                              Tarefa
                            </th>
                            <th className="px-2 py-1.5 text-left font-medium text-slate-700">
                              Setor
                            </th>
                            <th className="px-2 py-1.5 text-left font-medium text-slate-700">
                              Status
                            </th>
                            <th className="px-2 py-1.5 text-left font-medium text-slate-700">
                              Concluída em
                            </th>
                            <th className="px-2 py-1.5 text-left font-medium text-slate-700">
                              Data limite
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {concluidas.map((task) => (
                            <tr key={`detalhes-conc-${task.id}`}>
                              <td className="px-2 py-1 text-slate-700">{task.tipo || "-"}</td>
                              <td className="px-2 py-1 text-slate-600">{task.responsavel || "-"}</td>
                              <td className="px-2 py-1 text-slate-600">{task.status || "-"}</td>
                              <td className="px-2 py-1 text-slate-600">
                                {formatDateTime(task.dataConclusao)}
                              </td>
                              <td className="px-2 py-1 text-slate-600">
                                {formatDateTime(task.dataLimite)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {detalhesModalOpen && taskDetalhes && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-xl rounded-xl bg-white p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Detalhes da tarefa</h2>
              <button
                type="button"
                onClick={() => setDetalhesModalOpen(false)}
                className="rounded-lg border border-slate-300 px-3 py-1 text-sm"
              >
                Fechar
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              <div>
                <div className="text-slate-500 text-xs">Tipo</div>
                <div className="text-slate-800">{taskDetalhes.tipo || "-"}</div>
              </div>
              <div>
                <div className="text-slate-500 text-xs">Setor</div>
                <div className="text-slate-800">{taskDetalhes.responsavel || "-"}</div>
              </div>
              <div>
                <div className="text-slate-500 text-xs">Status</div>
                <div className="text-slate-800">{taskDetalhes.status || "-"}</div>
              </div>
              <div>
                <div className="text-slate-500 text-xs">Última atualização</div>
                <div className="text-slate-800">
                  {formatDateTime(getTaskUltimaAtualizacao(taskDetalhes))}
                </div>
              </div>
              <div>
                <div className="text-slate-500 text-xs">Prioridade</div>
                <div className="text-slate-800">{taskDetalhes.prioridade || "-"}</div>
              </div>
              <div>
                <div className="text-slate-500 text-xs">Concluído em</div>
                <div className="text-slate-800">{formatDateTime(taskDetalhes.dataConclusao)}</div>
              </div>
              <div>
                <div className="text-slate-500 text-xs">Data limite</div>
                <div className="text-slate-800">{formatDateTime(taskDetalhes.dataLimite)}</div>
              </div>
              <div>
                <div className="text-slate-500 text-xs">Data vencimento</div>
                <div className="text-slate-800">{formatDateTime(taskDetalhes.dataVencimento)}</div>
              </div>
            </div>

            <div>
              <div className="text-slate-500 text-xs">Descrição</div>
              <div className="text-sm text-slate-800">{taskDetalhes.descricao || "-"}</div>
            </div>
            {(() => {
              const detalhesComplementares = extrairDetalhesComplementares(taskDetalhes.descricao);
              if (detalhesComplementares.length === 0) return null;
              return (
                <div>
                  <div className="text-slate-500 text-xs">Informações complementares</div>
                  <div className="mt-1 space-y-1">
                    {detalhesComplementares.map((linha, idx) => (
                      <div
                        key={`${taskDetalhes.id}-extra-${idx}`}
                        className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700"
                      >
                        {linha}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {obsModalOpen && taskObs && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-4 space-y-3">
            <div className="flex justify-between items-start gap-3">
              <div>
                <h2 className="text-lg font-semibold">Observações da tarefa</h2>
                <p className="text-sm text-slate-600">{taskObs.tipo}</p>
              </div>
              <button
                type="button"
                onClick={() => setObsModalOpen(false)}
                className="rounded-lg border border-slate-300 px-3 py-1 text-sm"
              >
                Fechar
              </button>
            </div>

            <div className="space-y-2">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <h3 className="text-sm font-medium text-slate-700 mb-2">Detalhes da tarefa</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 text-xs text-slate-600">
                  <div>
                    <span className="font-medium text-slate-700">Tipo:</span> {taskObs.tipo || "-"}
                  </div>
                  <div>
                    <span className="font-medium text-slate-700">Setor:</span>{" "}
                    {taskObs.responsavel || "-"}
                  </div>
                  <div>
                    <span className="font-medium text-slate-700">Status:</span> {taskObs.status || "-"}
                  </div>
                  <div>
                    <span className="font-medium text-slate-700">Prioridade:</span>{" "}
                    {taskObs.prioridade || "-"}
                  </div>
                </div>
                <div className="mt-2 text-xs text-slate-600">
                  <span className="font-medium text-slate-700">Descrição:</span>{" "}
                  {taskObs.descricao || "-"}
                </div>
                {(() => {
                  const detalhesComplementares = extrairDetalhesComplementares(taskObs.descricao);
                  if (detalhesComplementares.length === 0) return null;
                  return (
                    <div className="mt-2 space-y-1">
                      <div className="text-[11px] font-medium text-slate-700">
                        Informações complementares
                      </div>
                      {detalhesComplementares.map((linha, idx) => (
                        <div
                          key={`${taskObs.id}-extra-${idx}`}
                          className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700"
                        >
                          {linha}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                <div className="text-xs text-slate-500">
                  Data limite atual:{" "}
                  <span className="font-medium text-slate-700">{formatDateOnly(taskObs.dataLimite)}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Nova data limite
                    </label>
                    <input
                      type="date"
                      value={obsNovaDataLimite}
                      onChange={(e) => {
                        setObsNovaDataLimite(e.target.value);
                        if (obsErroDataLimite) setObsErroDataLimite("");
                      }}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    />
                    {obsErroDataLimite && (
                      <p className="mt-1 text-xs text-rose-600">{obsErroDataLimite}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Justificativa / observação
                    </label>
                    <textarea
                      value={obsJustificativaDataLimite}
                      onChange={(e) => {
                        setObsJustificativaDataLimite(e.target.value);
                        if (obsErroJustificativa) setObsErroJustificativa("");
                      }}
                      rows={3}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                      placeholder="Escreva a observação. Se alterar a data, informe a justificativa aqui."
                    />
                    {obsErroJustificativa && (
                      <p className="mt-1 text-xs text-rose-600">{obsErroJustificativa}</p>
                    )}
                  </div>
                </div>
              </div>
              <button
                type="button"
                disabled={savingObs}
                onClick={() => void adicionarObservacao()}
                className="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm disabled:opacity-60"
              >
                {savingObs ? "Salvando..." : "Salvar observação"}
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto space-y-2">
              {obsLoading ? (
                <div className="text-sm text-slate-600">Carregando observações...</div>
              ) : observacoes.length === 0 ? (
                <div className="text-sm text-slate-600">Nenhuma observação encontrada.</div>
              ) : (
                observacoes.map((obs) => (
                  <div key={obs.id} className="rounded-lg border border-slate-200 p-3">
                    {obsEditId === obs.id ? (
                      <div className="space-y-2">
                        <textarea
                          value={obsEditTexto}
                          onChange={(e) => setObsEditTexto(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          rows={3}
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={savingObs}
                            onClick={() => void salvarEdicaoObservacao()}
                            className="rounded border border-slate-300 px-2 py-1 text-xs"
                          >
                            Salvar
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setObsEditId(null);
                              setObsEditTexto("");
                            }}
                            className="rounded border border-slate-300 px-2 py-1 text-xs"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="text-sm whitespace-pre-wrap">{obs.texto}</div>
                        <div className="text-xs text-slate-500 mt-2">
                          {obs.criadoPor} • {formatDateTime(obs.criadoEm)}
                        </div>
                        <div className="flex gap-2 mt-2">
                          <button
                            type="button"
                            onClick={() => {
                              setObsEditId(obs.id);
                              setObsEditTexto(obs.texto);
                            }}
                            className="rounded border border-slate-300 px-2 py-1 text-xs"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => void excluirObservacao(obs.id)}
                            className="rounded border border-rose-300 text-rose-700 px-2 py-1 text-xs"
                          >
                            Excluir
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
