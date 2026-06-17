"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardList,
  GraduationCap,
  HeartPulse,
  Hourglass,
  Truck,
} from "lucide-react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { ROUTE_PROTECTION } from "@/lib/permissions";

type Setor = "LOGISTICA" | "MEDICINA" | "TREINAMENTO" | "RH";
type SituacaoFiltro = "TODOS" | "ABERTOS" | "CONCLUIDOS";
type DiasOperador = ">" | "<" | "=";

type RelatorioItem = {
  id: string;
  solicitacaoId: number;
  funcionario: string;
  matricula: string;
  funcao: string | null;
  centroCusto: string | null;
  tipo: string;
  prioridade: string;
  solicitante: string;
  contratoOrigem: string;
  contratoDestino: string;
  statusTarefas: string;
  statusPrestserv: string;
  concluido: boolean;
  pendencias: Record<Setor, number>;
  tarefasPendentes: Record<Setor, number>;
  dataCriacao: string;
  diasDesdeCriacao: number;
  dataSolicitacao: string;
  atualizadoEm: string;
};

type RelatorioResponse = {
  success: boolean;
  dataCorte: string | null;
  dataFim: string | null;
  incluirCancelados: boolean;
  resumo: {
    total: number;
    concluidos: number;
    emAberto: number;
    pendencias: Record<Setor, number>;
    tarefasPendentes: Record<Setor, number>;
  };
  itens: RelatorioItem[];
  message?: string;
};

const SETORES: Array<{ key: Setor; label: string }> = [
  { key: "LOGISTICA", label: "Logística" },
  { key: "MEDICINA", label: "Medicina" },
  { key: "TREINAMENTO", label: "Treinamento" },
  { key: "RH", label: "RH" },
];

const SETOR_ICONS = {
  LOGISTICA: Truck,
  MEDICINA: HeartPulse,
  TREINAMENTO: GraduationCap,
  RH: BriefcaseBusiness,
} satisfies Record<Setor, typeof Truck>;

const STORAGE_KEY = "relatorio-geral-filtros";
const DATA_INICIO_PADRAO = "2026-01-01";

const SITUACOES: Array<{ value: SituacaoFiltro; label: string }> = [
  { value: "TODOS", label: "Todos" },
  { value: "ABERTOS", label: "Em aberto" },
  { value: "CONCLUIDOS", label: "Concluídos" },
];

function uniqueOptions(items: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      items
        .map((item) => (item || "").trim())
        .filter((item) => item.length > 0 && item !== "-"),
    ),
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function sanitizeSheetName(value: string) {
  return value.replace(/[*?:\\/[\]]/g, "").slice(0, 31) || "Relatorio";
}

function funcionarioOption(item: Pick<RelatorioItem, "funcionario" | "matricula">) {
  return `${item.funcionario} (${item.matricula})`;
}

function toggleArrayValue<T>(items: T[], value: T) {
  return items.includes(value) ? items.filter((item) => item !== value) : [...items, value];
}

function parseStoredList(value: unknown) {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  return typeof value === "string" && value !== "TODOS" && value ? [value] : [];
}

function sameList(a: string[], b: string[]) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function MultiCheckboxFilter({
  label,
  options,
  selected,
  onChange,
  placeholder = "Pesquisar...",
  searchable = false,
  getOptionLabel = (value) => value,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  searchable?: boolean;
  getOptionLabel?: (value: string) => string;
}) {
  const [term, setTerm] = useState("");
  const filteredOptions = useMemo(() => {
    const normalizedTerm = term.trim().toLowerCase();
    if (!searchable || !normalizedTerm) return options;
    return options.filter((option) => getOptionLabel(option).toLowerCase().includes(normalizedTerm));
  }, [getOptionLabel, options, searchable, term]);

  return (
    <div>
      <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</label>
      <details className="group relative">
        <summary className="flex min-h-[30px] cursor-pointer list-none items-center justify-between gap-2 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-slate-200">
          <span className="truncate">
            {selected.length > 0 ? `${selected.length} selecionado(s)` : `Selecionar ${label.toLowerCase()}`}
          </span>
          <span className="text-xs text-gray-400 group-open:rotate-180">▾</span>
        </summary>
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-gray-200 bg-white p-1.5 shadow-lg">
          {searchable && (
            <input
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder={placeholder}
              className="mb-1 w-full rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 placeholder:text-gray-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
            />
          )}
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="mb-1 w-full rounded px-2 py-0.5 text-left text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Limpar seleção
            </button>
          )}
          <div className="space-y-0.5">
            {filteredOptions.map((option) => (
              <label key={option} className="flex items-center gap-2 rounded px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={selected.includes(option)}
                  onChange={() => onChange(toggleArrayValue(selected, option))}
                  className="h-3.5 w-3.5 accent-slate-700"
                />
                <span className="truncate" title={getOptionLabel(option)}>
                  {getOptionLabel(option)}
                </span>
              </label>
            ))}
            {filteredOptions.length === 0 && (
              <div className="px-2 py-1 text-xs text-gray-400">Nenhuma opção encontrada</div>
            )}
          </div>
        </div>
      </details>
    </div>
  );
}

function RelatorioGeralContent() {
  const [data, setData] = useState<RelatorioResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [funcionarioList, setFuncionarioList] = useState<string[]>([]);
  const [situacaoList, setSituacaoList] = useState<string[]>([]);
  const [setorList, setSetorList] = useState<string[]>([]);
  const [solicitanteList, setSolicitanteList] = useState<string[]>([]);
  const [origemList, setOrigemList] = useState<string[]>([]);
  const [destinoList, setDestinoList] = useState<string[]>([]);
  const [statusTarefasList, setStatusTarefasList] = useState<string[]>([]);
  const [statusPrestservList, setStatusPrestservList] = useState<string[]>([]);
  const [dataSolicitacaoInicio, setDataSolicitacaoInicio] = useState("");
  const [dataSolicitacaoFim, setDataSolicitacaoFim] = useState("");
  const [diasOperador, setDiasOperador] = useState<DiasOperador>(">");
  const [diasValor, setDiasValor] = useState("");
  const [appliedFuncionarioList, setAppliedFuncionarioList] = useState<string[]>([]);
  const [appliedSituacaoList, setAppliedSituacaoList] = useState<string[]>([]);
  const [appliedSetorList, setAppliedSetorList] = useState<string[]>([]);
  const [appliedSolicitanteList, setAppliedSolicitanteList] = useState<string[]>([]);
  const [appliedOrigemList, setAppliedOrigemList] = useState<string[]>([]);
  const [appliedDestinoList, setAppliedDestinoList] = useState<string[]>([]);
  const [appliedStatusTarefasList, setAppliedStatusTarefasList] = useState<string[]>([]);
  const [appliedStatusPrestservList, setAppliedStatusPrestservList] = useState<string[]>([]);
  const [appliedDataSolicitacaoInicio, setAppliedDataSolicitacaoInicio] = useState("");
  const [appliedDataSolicitacaoFim, setAppliedDataSolicitacaoFim] = useState("");
  const [appliedDiasOperador, setAppliedDiasOperador] = useState<DiasOperador>(">");
  const [appliedDiasValor, setAppliedDiasValor] = useState("");
  const [exportando, setExportando] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as {
        search?: string;
        funcionarioList?: string[];
        situacao?: SituacaoFiltro;
        situacaoList?: string[];
        setorFiltro?: string;
        setorList?: string[];
        solicitanteFiltro?: string;
        solicitanteList?: string[];
        origemFiltro?: string;
        origemList?: string[];
        destinoFiltro?: string;
        destinoList?: string[];
        statusTarefasFiltro?: string;
        statusTarefasList?: string[];
        statusPrestservFiltro?: string;
        statusPrestservList?: string[];
        dataSolicitacaoInicio?: string;
        dataSolicitacaoFim?: string;
        diasOperador?: DiasOperador;
        diasValor?: string;
      };

      const storedFuncionarioList = parseStoredList(parsed.funcionarioList || parsed.search);
      const storedSituacaoList = parseStoredList(parsed.situacaoList || parsed.situacao);
      const storedSetorList = parseStoredList(parsed.setorList || parsed.setorFiltro);
      const storedSolicitanteList = parseStoredList(parsed.solicitanteList || parsed.solicitanteFiltro);
      const storedOrigemList = parseStoredList(parsed.origemList || parsed.origemFiltro);
      const storedDestinoList = parseStoredList(parsed.destinoList || parsed.destinoFiltro);
      const storedStatusTarefasList = parseStoredList(parsed.statusTarefasList || parsed.statusTarefasFiltro);
      const storedStatusPrestservList = parseStoredList(parsed.statusPrestservList || parsed.statusPrestservFiltro);
      const storedDataInicio = parsed.dataSolicitacaoInicio || "";
      const storedDataFim = parsed.dataSolicitacaoFim || "";
      const storedDiasOperador = parsed.diasOperador === "<" || parsed.diasOperador === "=" ? parsed.diasOperador : ">";
      const storedDiasValor = parsed.diasValor || "";

      setFuncionarioList(storedFuncionarioList);
      setSituacaoList(storedSituacaoList);
      setSetorList(storedSetorList);
      setSolicitanteList(storedSolicitanteList);
      setOrigemList(storedOrigemList);
      setDestinoList(storedDestinoList);
      setStatusTarefasList(storedStatusTarefasList);
      setStatusPrestservList(storedStatusPrestservList);
      setDataSolicitacaoInicio(storedDataInicio);
      setDataSolicitacaoFim(storedDataFim);
      setDiasOperador(storedDiasOperador);
      setDiasValor(storedDiasValor);
      setAppliedFuncionarioList(storedFuncionarioList);
      setAppliedSituacaoList(storedSituacaoList);
      setAppliedSetorList(storedSetorList);
      setAppliedSolicitanteList(storedSolicitanteList);
      setAppliedOrigemList(storedOrigemList);
      setAppliedDestinoList(storedDestinoList);
      setAppliedStatusTarefasList(storedStatusTarefasList);
      setAppliedStatusPrestservList(storedStatusPrestservList);
      setAppliedDataSolicitacaoInicio(storedDataInicio);
      setAppliedDataSolicitacaoFim(storedDataFim);
      setAppliedDiasOperador(storedDiasOperador);
      setAppliedDiasValor(storedDiasValor);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        funcionarioList,
        situacaoList,
        setorList,
        solicitanteList,
        origemList,
        destinoList,
        statusTarefasList,
        statusPrestservList,
        dataSolicitacaoInicio,
        dataSolicitacaoFim,
        diasOperador,
        diasValor,
      }),
    );
  }, [
    funcionarioList,
    situacaoList,
    setorList,
    solicitanteList,
    origemList,
    destinoList,
    statusTarefasList,
    statusPrestservList,
    dataSolicitacaoInicio,
    dataSolicitacaoFim,
    diasOperador,
    diasValor,
  ]);

  const carregar = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (appliedDataSolicitacaoInicio) params.set("inicio", appliedDataSolicitacaoInicio);
      if (appliedDataSolicitacaoFim) params.set("fim", appliedDataSolicitacaoFim);
      const response = await fetch(`/api/relatorios/geral?${params.toString()}`, { cache: "no-store" });
      const payload = (await response.json()) as RelatorioResponse;

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || "Falha ao carregar relatório.");
      }

      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }, [appliedDataSolicitacaoInicio, appliedDataSolicitacaoFim]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const opcoes = useMemo(() => {
    const itens = data?.itens || [];
    return {
      funcionarios: uniqueOptions(itens.map((item) => funcionarioOption(item))),
      solicitantes: uniqueOptions(itens.map((item) => item.solicitante)),
      origens: uniqueOptions(itens.map((item) => item.contratoOrigem)),
      destinos: uniqueOptions(itens.map((item) => item.contratoDestino)),
      statusTarefas: uniqueOptions(itens.map((item) => item.statusTarefas)),
      statusPrestserv: uniqueOptions(itens.map((item) => item.statusPrestserv)),
    };
  }, [data?.itens]);

  const itensFiltrados = useMemo(() => {
    const itens = data?.itens || [];

    return itens.filter((item) => {
      const situacaoItem = item.concluido ? "CONCLUIDOS" : "ABERTOS";
      if (appliedFuncionarioList.length > 0 && !appliedFuncionarioList.includes(funcionarioOption(item))) return false;
      if (appliedSituacaoList.length > 0 && !appliedSituacaoList.includes(situacaoItem)) return false;
      if (appliedSetorList.length > 0 && !appliedSetorList.some((setor) => (item.pendencias[setor as Setor] || 0) > 0)) return false;
      if (appliedSolicitanteList.length > 0 && !appliedSolicitanteList.includes(item.solicitante)) return false;
      if (appliedOrigemList.length > 0 && !appliedOrigemList.includes(item.contratoOrigem)) return false;
      if (appliedDestinoList.length > 0 && !appliedDestinoList.includes(item.contratoDestino)) return false;
      if (appliedStatusTarefasList.length > 0 && !appliedStatusTarefasList.includes(item.statusTarefas)) return false;
      if (appliedStatusPrestservList.length > 0 && !appliedStatusPrestservList.includes(item.statusPrestserv)) return false;
      if (appliedDiasValor) {
        const numericValue = Number(appliedDiasValor);
        if (Number.isFinite(numericValue)) {
          if (appliedDiasOperador === ">" && !(item.diasDesdeCriacao > numericValue)) return false;
          if (appliedDiasOperador === "<" && !(item.diasDesdeCriacao < numericValue)) return false;
          if (appliedDiasOperador === "=" && !(item.diasDesdeCriacao === numericValue)) return false;
        }
      }
      return true;
    });
  }, [
    data?.itens,
    appliedFuncionarioList,
    appliedSituacaoList,
    appliedSetorList,
    appliedSolicitanteList,
    appliedOrigemList,
    appliedDestinoList,
    appliedStatusTarefasList,
    appliedStatusPrestservList,
    appliedDiasOperador,
    appliedDiasValor,
  ]);

  const resumoFiltrado = useMemo(() => {
    const resumo = {
      total: itensFiltrados.length,
      concluidos: 0,
      emAberto: 0,
      pendencias: Object.fromEntries(SETORES.map((setor) => [setor.key, 0])) as Record<Setor, number>,
      linhasComPendencia: Object.fromEntries(SETORES.map((setor) => [setor.key, 0])) as Record<Setor, number>,
      tarefasPendentes: Object.fromEntries(SETORES.map((setor) => [setor.key, 0])) as Record<Setor, number>,
    };

    for (const item of itensFiltrados) {
      if (item.concluido) {
        resumo.concluidos += 1;
      } else {
        resumo.emAberto += 1;
      }

      for (const setor of SETORES) {
        const pendenciasSetor = item.pendencias[setor.key] || 0;
        resumo.pendencias[setor.key] += pendenciasSetor;
        if (pendenciasSetor > 0) {
          resumo.linhasComPendencia[setor.key] += 1;
        }
        resumo.tarefasPendentes[setor.key] += item.tarefasPendentes?.[setor.key] || 0;
      }
    }

    return resumo;
  }, [itensFiltrados]);

  const filtrosAplicados = useMemo(() => {
    const filtros: Array<{ key: string; label: string; onRemove: () => void }> = [];

    const addLista = (
      key: string,
      name: string,
      values: string[],
      setDraftValues: (next: string[]) => void,
      setAppliedValues: (next: string[]) => void,
      labelFor?: (value: string) => string,
    ) => {
      values.forEach((value) => {
        filtros.push({
          key: `${key}-${value}`,
          label: `${name}: ${labelFor ? labelFor(value) : value}`,
          onRemove: () => {
            const next = values.filter((item) => item !== value);
            setDraftValues(next);
            setAppliedValues(next);
          },
        });
      });
    };

    addLista("funcionario", "Funcionário", appliedFuncionarioList, setFuncionarioList, setAppliedFuncionarioList);
    addLista("situacao", "Situação", appliedSituacaoList, setSituacaoList, setAppliedSituacaoList, (value) => SITUACOES.find((item) => item.value === value)?.label || value);
    addLista("setor", "Pendência", appliedSetorList, setSetorList, setAppliedSetorList, (value) => SETORES.find((item) => item.key === value)?.label || value);
    addLista("solicitante", "Solicitante", appliedSolicitanteList, setSolicitanteList, setAppliedSolicitanteList);
    addLista("origem", "Origem", appliedOrigemList, setOrigemList, setAppliedOrigemList);
    addLista("destino", "Destino", appliedDestinoList, setDestinoList, setAppliedDestinoList);
    addLista("statusTarefas", "Status tarefas", appliedStatusTarefasList, setStatusTarefasList, setAppliedStatusTarefasList);
    addLista("statusPrestserv", "Status Prestserv", appliedStatusPrestservList, setStatusPrestservList, setAppliedStatusPrestservList);
    if (appliedDataSolicitacaoInicio) {
      filtros.push({
        key: "dataSolicitacaoInicio",
        label: `Solicitação de: ${formatDate(`${appliedDataSolicitacaoInicio}T00:00:00`)}`,
        onRemove: () => {
          setDataSolicitacaoInicio("");
          setAppliedDataSolicitacaoInicio("");
        },
      });
    }
    if (appliedDataSolicitacaoFim) {
      filtros.push({
        key: "dataSolicitacaoFim",
        label: `Solicitação até: ${formatDate(`${appliedDataSolicitacaoFim}T00:00:00`)}`,
        onRemove: () => {
          setDataSolicitacaoFim("");
          setAppliedDataSolicitacaoFim("");
        },
      });
    }
    if (appliedDiasValor) {
      filtros.push({
        key: "diasCorridos",
        label: `Dias corridos ${appliedDiasOperador} ${appliedDiasValor}`,
        onRemove: () => {
          setDiasValor("");
          setAppliedDiasValor("");
        },
      });
    }
    return filtros;
  }, [
    appliedFuncionarioList,
    appliedSituacaoList,
    appliedSetorList,
    appliedSolicitanteList,
    appliedOrigemList,
    appliedDestinoList,
    appliedStatusTarefasList,
    appliedStatusPrestservList,
    appliedDataSolicitacaoInicio,
    appliedDataSolicitacaoFim,
    appliedDiasOperador,
    appliedDiasValor,
  ]);

  const limparFiltros = () => {
    setFuncionarioList([]);
    setSituacaoList([]);
    setSetorList([]);
    setSolicitanteList([]);
    setOrigemList([]);
    setDestinoList([]);
    setStatusTarefasList([]);
    setStatusPrestservList([]);
    setDataSolicitacaoInicio("");
    setDataSolicitacaoFim("");
    setDiasOperador(">");
    setDiasValor("");
    setAppliedFuncionarioList([]);
    setAppliedSituacaoList([]);
    setAppliedSetorList([]);
    setAppliedSolicitanteList([]);
    setAppliedOrigemList([]);
    setAppliedDestinoList([]);
    setAppliedStatusTarefasList([]);
    setAppliedStatusPrestservList([]);
    setAppliedDataSolicitacaoInicio("");
    setAppliedDataSolicitacaoFim("");
    setAppliedDiasOperador(">");
    setAppliedDiasValor("");
  };

  const hasPendingFilters = useMemo(
    () =>
      !sameList(funcionarioList, appliedFuncionarioList) ||
      !sameList(situacaoList, appliedSituacaoList) ||
      !sameList(setorList, appliedSetorList) ||
      !sameList(solicitanteList, appliedSolicitanteList) ||
      !sameList(origemList, appliedOrigemList) ||
      !sameList(destinoList, appliedDestinoList) ||
      !sameList(statusTarefasList, appliedStatusTarefasList) ||
      !sameList(statusPrestservList, appliedStatusPrestservList) ||
      dataSolicitacaoInicio !== appliedDataSolicitacaoInicio ||
      dataSolicitacaoFim !== appliedDataSolicitacaoFim ||
      (Boolean(diasValor || appliedDiasValor) && diasOperador !== appliedDiasOperador) ||
      diasValor !== appliedDiasValor,
    [
      funcionarioList,
      appliedFuncionarioList,
      situacaoList,
      appliedSituacaoList,
      setorList,
      appliedSetorList,
      solicitanteList,
      appliedSolicitanteList,
      origemList,
      appliedOrigemList,
      destinoList,
      appliedDestinoList,
      statusTarefasList,
      appliedStatusTarefasList,
      statusPrestservList,
      appliedStatusPrestservList,
      dataSolicitacaoInicio,
      appliedDataSolicitacaoInicio,
      dataSolicitacaoFim,
      appliedDataSolicitacaoFim,
      diasOperador,
      appliedDiasOperador,
      diasValor,
      appliedDiasValor,
    ],
  );

  const aplicarFiltros = () => {
    setAppliedFuncionarioList(funcionarioList);
    setAppliedSituacaoList(situacaoList);
    setAppliedSetorList(setorList);
    setAppliedSolicitanteList(solicitanteList);
    setAppliedOrigemList(origemList);
    setAppliedDestinoList(destinoList);
    setAppliedStatusTarefasList(statusTarefasList);
    setAppliedStatusPrestservList(statusPrestservList);
    setAppliedDataSolicitacaoInicio(dataSolicitacaoInicio);
    setAppliedDataSolicitacaoFim(dataSolicitacaoFim);
    setAppliedDiasOperador(diasOperador);
    setAppliedDiasValor(diasValor);
  };

  const exportarExcel = async () => {
    if (!data || exportando) return;

    try {
      setExportando(true);
      const ExcelJS = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "GranServices";
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet(sanitizeSheetName("Pendencias"));
      worksheet.views = [{ state: "frozen", ySplit: 4 }];

      const columns = [
        { header: "Funcionário", key: "funcionario" },
        { header: "Matrícula", key: "matricula" },
        { header: "Função", key: "funcao" },
        { header: "Centro de custo", key: "centroCusto" },
        { header: "Tipo", key: "tipo" },
        { header: "Solicitante", key: "solicitante" },
        { header: "Data da solicitação", key: "dataSolicitacao" },
        { header: "Dias corridos", key: "diasDesdeCriacao" },
        { header: "Origem", key: "contratoOrigem" },
        { header: "Destino", key: "contratoDestino" },
        { header: "Status tarefas", key: "statusTarefas" },
        { header: "Status Prestserv", key: "statusPrestserv" },
        { header: "Logística", key: "logistica" },
        { header: "Medicina", key: "medicina" },
        { header: "Treinamento", key: "treinamento" },
        { header: "RH", key: "rh" },
        { header: "Situação", key: "situacao" },
        { header: "Atualizado em", key: "atualizadoEm" },
      ];

      const rows = itensFiltrados.map((item) => [
        item.funcionario,
        item.matricula,
        item.funcao || "-",
        item.centroCusto || "-",
        item.tipo,
        item.solicitante,
        formatDate(item.dataSolicitacao),
        item.diasDesdeCriacao,
        item.contratoOrigem,
        item.contratoDestino,
        item.statusTarefas,
        item.statusPrestserv,
        item.pendencias.LOGISTICA || 0,
        item.pendencias.MEDICINA || 0,
        item.pendencias.TREINAMENTO || 0,
        item.pendencias.RH || 0,
        item.concluido ? "Concluído" : "Em aberto",
        formatDate(item.atualizadoEm),
      ]);

      worksheet.mergeCells("A1:R1");
      const titleCell = worksheet.getCell("A1");
      titleCell.value = "Relatório Geral de Pendências";
      titleCell.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
      titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };
      titleCell.alignment = { vertical: "middle", horizontal: "center" };
      worksheet.getRow(1).height = 24;

      worksheet.mergeCells("A2:R2");
      const subtitleCell = worksheet.getCell("A2");
      const periodoSolicitacaoUsuario =
        appliedDataSolicitacaoInicio || appliedDataSolicitacaoFim
          ? `Filtro de solicitação: ${appliedDataSolicitacaoInicio ? `de ${formatDate(`${appliedDataSolicitacaoInicio}T00:00:00`)}` : "sem início"} ${
              appliedDataSolicitacaoFim ? `até ${formatDate(`${appliedDataSolicitacaoFim}T00:00:00`)}` : "sem fim"
            }`
          : "Sem filtro adicional de solicitação";
      subtitleCell.value = `Critérios fixos: solicitações desde ${formatDate(`${DATA_INICIO_PADRAO}T00:00:00`)} e cancelados desconsiderados | ${periodoSolicitacaoUsuario} | Exportado em ${new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date())}`;
      subtitleCell.font = { size: 10, color: { argb: "FF475569" } };
      subtitleCell.alignment = { vertical: "middle", horizontal: "center" };

      worksheet.addTable({
        name: "RelatorioGeralRemanejamentos",
        ref: "A4",
        headerRow: true,
        totalsRow: false,
        style: {
          theme: "TableStyleMedium2",
          showRowStripes: true,
          showColumnStripes: false,
        },
        columns: columns.map((column) => ({ name: column.header, filterButton: true })),
        rows,
      });

      const allRows = [
        columns.map((column) => column.header),
        ...rows.map((row) => row.map((value) => String(value ?? ""))),
      ];

      columns.forEach((_, index) => {
        const maxLength = allRows.reduce((max, row) => {
          const value = row[index] || "";
          return Math.max(max, String(value).length);
        }, 0);
        worksheet.getColumn(index + 1).width = Math.min(Math.max(maxLength + 2, 9), 42);
      });

      worksheet.eachRow((row, rowNumber) => {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: "thin", color: { argb: "FFE5E7EB" } },
            left: { style: "thin", color: { argb: "FFE5E7EB" } },
            bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
            right: { style: "thin", color: { argb: "FFE5E7EB" } },
          };
          cell.alignment = { vertical: "middle", wrapText: rowNumber >= 4 };
        });
      });

      const headerRow = worksheet.getRow(4);
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
      headerRow.alignment = { vertical: "middle", horizontal: "center" };
      headerRow.height = 20;

      for (let rowNumber = 5; rowNumber <= worksheet.rowCount; rowNumber += 1) {
        const row = worksheet.getRow(rowNumber);
        row.height = 18;
        [8, 13, 14, 15, 16].forEach((columnNumber) => {
          row.getCell(columnNumber).alignment = { vertical: "middle", horizontal: "center" };
        });
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer as BlobPart], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Relatorio_Geral_Pendencias_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao exportar Excel.");
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="w-full space-y-3">
        <div className="flex flex-col gap-2 border-b border-gray-100 pb-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Relatório Geral de Pendências</h1>
            <p className="mt-0.5 text-[11px] text-gray-500">
              Visão consolidada dos remanejamentos em aberto e das tarefas pendentes por setor.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={exportarExcel}
              disabled={loading || exportando || !data}
              className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-emerald-300"
            >
              {exportando ? "Exportando..." : "Exportar Excel"}
            </button>
            <button
              type="button"
              onClick={carregar}
              disabled={loading}
              className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-900 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {loading ? "Atualizando..." : "Atualizar"}
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-2 text-xs text-red-700">
            {error}
          </div>
        )}

        {loading && !data ? (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-600">
            Carregando relatório...
          </div>
        ) : data ? (
          <>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-7">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Tabela</p>
                  <span className="rounded-md border border-slate-200 bg-white p-1 text-slate-500">
                    <ClipboardList size={14} />
                  </span>
                </div>
                <p className="mt-1 text-xl font-bold leading-none text-slate-950">{resumoFiltrado.total}</p>
                <p className="mt-0.5 text-[10px] text-slate-500">linhas filtradas</p>
              </div>
              <div className="rounded-md border border-amber-200 bg-amber-50/70 p-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">Em aberto</p>
                  <span className="rounded-md border border-amber-200 bg-white/80 p-1 text-amber-700">
                    <Hourglass size={14} />
                  </span>
                </div>
                <p className="mt-1 text-xl font-bold leading-none text-amber-800">{resumoFiltrado.emAberto}</p>
                <p className="mt-0.5 text-[10px] text-amber-700/80">não concluídos</p>
              </div>
              <div className="rounded-md border border-emerald-200 bg-emerald-50/70 p-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Concluídos</p>
                  <span className="rounded-md border border-emerald-200 bg-white/80 p-1 text-emerald-700">
                    <CheckCircle2 size={14} />
                  </span>
                </div>
                <p className="mt-1 text-xl font-bold leading-none text-emerald-800">{resumoFiltrado.concluidos}</p>
                <p className="mt-0.5 text-[10px] text-emerald-700/80">no filtro atual</p>
              </div>
              {SETORES.map((setor) => {
                const linhasComPendencia = resumoFiltrado.linhasComPendencia[setor.key] || 0;
                const tarefasPendentes = resumoFiltrado.tarefasPendentes[setor.key] || 0;
                const SetorIcon = SETOR_ICONS[setor.key];

                return (
                  <div key={setor.key} className="rounded-md border border-gray-200 bg-gray-50 p-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{setor.label}</p>
                      <span className="rounded-md border border-gray-200 bg-white p-1 text-gray-500">
                        <SetorIcon size={14} />
                      </span>
                    </div>
                    <div className="mt-1 flex items-end justify-between gap-2">
                      <p className="text-xl font-bold leading-none text-gray-900">{linhasComPendencia}</p>
                      <span className="pb-0.5 text-[10px] font-medium text-gray-500">
                        {tarefasPendentes} tarefas
                      </span>
                    </div>
                    <p className="mt-0.5 text-[10px] text-gray-500">linhas com pendência</p>
                  </div>
                );
              })}
            </div>

            <div className="rounded-md border border-gray-200 bg-gray-50/80 p-2">
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xs font-bold uppercase tracking-wide text-gray-700">Filtros</h2>
                  {hasPendingFilters ? (
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                      Alterações pendentes
                    </span>
                  ) : (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                      Aplicado
                    </span>
                  )}
                  <span className="text-[11px] text-gray-500">
                    {itensFiltrados.length} de {data.itens.length}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={aplicarFiltros}
                  disabled={!hasPendingFilters || loading}
                  className="rounded-md bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  Aplicar filtros
                </button>
              </div>

              <div className="grid gap-1.5 md:grid-cols-3 xl:grid-cols-6 2xl:grid-cols-8">
                <MultiCheckboxFilter
                  label="Funcionário/matrícula"
                  options={opcoes.funcionarios}
                  selected={funcionarioList}
                  onChange={setFuncionarioList}
                  placeholder="Pesquisar nome ou matrícula..."
                  searchable
                />
                <MultiCheckboxFilter
                  label="Solicitante"
                  options={opcoes.solicitantes}
                  selected={solicitanteList}
                  onChange={setSolicitanteList}
                  placeholder="Pesquisar solicitante..."
                  searchable
                />
                <div>
                  <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-gray-500">Solicitação de</label>
                  <input
                    type="date"
                    min={DATA_INICIO_PADRAO}
                    value={dataSolicitacaoInicio}
                    onChange={(event) => setDataSolicitacaoInicio(event.target.value)}
                    className="min-h-[30px] w-full rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  />
                </div>
                <div>
                  <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-gray-500">Solicitação até</label>
                  <input
                    type="date"
                    min={DATA_INICIO_PADRAO}
                    value={dataSolicitacaoFim}
                    onChange={(event) => setDataSolicitacaoFim(event.target.value)}
                    className="min-h-[30px] w-full rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  />
                </div>
                <div>
                  <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-gray-500">Dias corridos</label>
                  <div className="grid min-h-[30px] grid-cols-[48px_1fr] overflow-hidden rounded-md border border-gray-300 bg-white">
                    <select
                      value={diasOperador}
                      onChange={(event) => setDiasOperador(event.target.value as DiasOperador)}
                      className="border-r border-gray-300 bg-gray-50 px-1.5 py-1 text-xs font-semibold text-gray-700 focus:outline-none"
                      aria-label="Operador dias corridos"
                    >
                      <option value=">">&gt;</option>
                      <option value="<">&lt;</option>
                      <option value="=">=</option>
                    </select>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={diasValor}
                      onChange={(event) => setDiasValor(event.target.value.replace(/\D/g, ""))}
                      placeholder="dias"
                      className="w-full px-2 py-1 text-xs text-gray-700 placeholder:text-gray-400 focus:outline-none"
                    />
                  </div>
                </div>
                <MultiCheckboxFilter
                  label="Situação"
                  options={SITUACOES.filter((item) => item.value !== "TODOS").map((item) => item.value)}
                  selected={situacaoList}
                  onChange={setSituacaoList}
                  placeholder="Pesquisar situação..."
                  getOptionLabel={(value) => SITUACOES.find((item) => item.value === value)?.label || value}
                />
                <MultiCheckboxFilter
                  label="Setor"
                  options={SETORES.map((setor) => setor.key)}
                  selected={setorList}
                  onChange={setSetorList}
                  placeholder="Pesquisar setor..."
                  getOptionLabel={(value) => SETORES.find((item) => item.key === value)?.label || value}
                />
                <MultiCheckboxFilter
                  label="Origem"
                  options={opcoes.origens}
                  selected={origemList}
                  onChange={setOrigemList}
                  placeholder="Pesquisar origem..."
                />
                <MultiCheckboxFilter
                  label="Destino"
                  options={opcoes.destinos}
                  selected={destinoList}
                  onChange={setDestinoList}
                  placeholder="Pesquisar destino..."
                />
                <MultiCheckboxFilter
                  label="Status tarefas"
                  options={opcoes.statusTarefas}
                  selected={statusTarefasList}
                  onChange={setStatusTarefasList}
                  placeholder="Pesquisar status..."
                />
                <MultiCheckboxFilter
                  label="Status Prestserv"
                  options={opcoes.statusPrestserv}
                  selected={statusPrestservList}
                  onChange={setStatusPrestservList}
                  placeholder="Pesquisar status..."
                />
              </div>
            </div>

            <div className="flex min-h-8 flex-wrap items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2 py-1.5 shadow-sm">
              <span className="text-xs font-semibold uppercase text-gray-500">Critérios e filtros</span>
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                Data da solicitação: desde {formatDate(`${DATA_INICIO_PADRAO}T00:00:00`)}
              </span>
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                Cancelados: desconsiderados
              </span>
              {filtrosAplicados.length === 0 ? (
                <span className="text-xs text-gray-400">Nenhum filtro do usuário</span>
              ) : (
                <>
                  {filtrosAplicados.map((filtro) => (
                    <button
                      key={filtro.key}
                      type="button"
                      onClick={filtro.onRemove}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      title="Remover filtro"
                    >
                      {filtro.label}
                      <span aria-hidden="true" className="text-slate-400">
                        x
                      </span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={limparFiltros}
                    className="text-xs font-medium text-slate-600 underline-offset-2 hover:underline"
                  >
                    Limpar todos
                  </button>
                </>
              )}
            </div>

            <div className="max-h-[calc(100vh-300px)] min-h-[300px] overflow-auto rounded-md border border-gray-200">
              <table className="min-w-[1320px] w-full border-collapse text-left text-[10.5px] leading-tight">
                <thead className="sticky top-0 z-10 bg-gray-100 text-[10px] uppercase leading-tight text-gray-600 shadow-[0_1px_0_#e5e7eb]">
                  <tr>
                    <th className="px-1.5 py-1.5 align-bottom">Funcionário</th>
                    <th className="px-1.5 py-1.5 align-bottom">Matrícula</th>
                    <th className="px-1.5 py-1.5 align-bottom">Tipo</th>
                    <th className="px-1.5 py-1.5 align-bottom">Solicitante</th>
                    <th className="max-w-[78px] px-1.5 py-1.5 align-bottom">Data da solicitação</th>
                    <th className="max-w-[64px] px-1.5 py-1.5 text-center align-bottom">Dias corridos</th>
                    <th className="px-1.5 py-1.5 align-bottom">Origem</th>
                    <th className="px-1.5 py-1.5 align-bottom">Destino</th>
                    <th className="px-1.5 py-1.5 align-bottom">Status tarefas</th>
                    <th className="px-1.5 py-1.5 align-bottom">Status Prestserv</th>
                    {SETORES.map((setor) => (
                      <th key={setor.key} className="px-1.5 py-1.5 text-center align-bottom">
                        {setor.label}
                      </th>
                    ))}
                    <th className="max-w-[76px] px-1.5 py-1.5 align-bottom">Última atualização</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {itensFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={15} className="px-2 py-6 text-center text-gray-500">
                        Nenhum remanejamento encontrado.
                      </td>
                    </tr>
                  ) : (
                    itensFiltrados.map((item) => (
                      <tr key={item.id} className="odd:bg-white even:bg-gray-50 hover:bg-slate-50">
                        <td className="max-w-[142px] truncate px-1.5 py-1.5 font-semibold text-gray-900" title={item.funcionario}>
                          {item.funcionario}
                        </td>
                        <td className="whitespace-nowrap px-1.5 py-1.5 text-gray-700">{item.matricula}</td>
                        <td className="max-w-[100px] truncate px-1.5 py-1.5 text-gray-700" title={item.tipo}>
                          {item.tipo}
                        </td>
                        <td className="max-w-[136px] truncate px-1.5 py-1.5 text-gray-700" title={item.solicitante}>
                          {item.solicitante}
                        </td>
                        <td className="whitespace-nowrap px-1.5 py-1.5 text-gray-700">{formatDate(item.dataSolicitacao)}</td>
                        <td className="whitespace-nowrap px-1.5 py-1.5 text-center font-mono text-gray-700">
                          {item.diasDesdeCriacao}
                        </td>
                        <td className="max-w-[138px] truncate px-1.5 py-1.5 text-gray-700" title={item.contratoOrigem}>
                          {item.contratoOrigem}
                        </td>
                        <td className="max-w-[138px] truncate px-1.5 py-1.5 text-gray-700" title={item.contratoDestino}>
                          {item.contratoDestino}
                        </td>
                        <td className="max-w-[124px] truncate px-1.5 py-1.5 text-gray-700" title={item.statusTarefas}>
                          {item.statusTarefas}
                        </td>
                        <td className="max-w-[118px] truncate px-1.5 py-1.5 text-gray-700" title={item.statusPrestserv}>
                          {item.statusPrestserv}
                        </td>
                        {SETORES.map((setor) => {
                          const value = item.pendencias[setor.key] || 0;
                          return (
                            <td key={setor.key} className="whitespace-nowrap px-1.5 py-1.5 text-center">
                              <span
                                className={
                                  value > 0
                                    ? "inline-flex min-w-5 justify-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800"
                                    : "text-gray-400"
                                }
                              >
                                {value}
                              </span>
                            </td>
                          );
                        })}
                        <td className="whitespace-nowrap px-1.5 py-1.5 text-gray-700">{formatDate(item.atualizadoEm)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
    </div>
  );
}

export default function RelatorioGeralPage() {
  return (
    <ProtectedRoute
      requiredEquipe={ROUTE_PROTECTION.LOGISTICA.requiredEquipe}
      requiredPermissions={ROUTE_PROTECTION.LOGISTICA.requiredPermissions}
    >
      <RelatorioGeralContent />
    </ProtectedRoute>
  );
}
