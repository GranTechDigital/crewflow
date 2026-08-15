"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  AlertTriangle,
  Clock3,
  Filter,
  RefreshCw,
  Search,
} from "lucide-react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { ROUTE_PROTECTION } from "@/lib/permissions";

type CicloEvento = {
  id: number;
  tipo: string;
  dataEvento: string;
  origem: string;
};

type Ciclo = {
  id: string;
  remanejamentoFuncionarioId: string;
  numeroCiclo: number;
  setor: string;
  status: string;
  tipoCiclo: string;
  tituloCiclo: string | null;
  descricaoCiclo: string | null;
  origem: string;
  confianca: string;
  inicioAt: string | null;
  prazoPrevistoAt: string | null;
  conclusaoAt: string | null;
  cancelamentoAt: string | null;
  motivoAbertura: string | null;
  motivoFechamento: string | null;
  remanejamentoFuncionario: {
    id: string;
    statusTarefas: string;
    statusPrestserv: string;
    dataAprovado: string | null;
    dataConcluido: string | null;
    dataCancelado: string | null;
    funcionario: {
      id: number;
      nome: string;
      matricula: string;
      funcao: string | null;
    };
    solicitacao: {
      id: number;
      tipo: string;
    };
  };
  eventos: CicloEvento[];
};

type CiclosResponse = {
  total: number;
  totalGeral: number;
  resumo: {
    porStatus: Record<string, number>;
    porSetor: Record<string, number>;
    porOrigem: Record<string, number>;
  };
  ciclos: Ciclo[];
};

const setorOptions = [
  "TODOS",
  "SOLICITACAO",
  "RH",
  "MEDICINA",
  "TREINAMENTO",
  "LOGISTICA",
];
const setorSortOrder: Record<string, number> = {
  SOLICITACAO: 0,
  RH: 1,
  MEDICINA: 2,
  TREINAMENTO: 3,
  LOGISTICA: 4,
};
const statusOptions = ["TODOS", "ABERTO", "CONCLUIDO", "CANCELADO", "IGNORADO"];
const origemOptions = ["TODOS", "SISTEMA", "RECONSTRUIDO"];
const tipoOptions = [
  "TODOS",
  "APROVACAO_SOLICITACAO",
  "ATENDIMENTO_INICIAL",
  "CORRECAO_LOGISTICA",
  "AJUSTE_MATRIZ",
  "REATENDIMENTO_SETOR",
  "AVALIACAO_LOGISTICA",
  "RECONSTRUCAO_HISTORICA",
];

const statusClasses: Record<string, string> = {
  ABERTO: "bg-amber-50 text-amber-700 border-amber-200",
  CONCLUIDO: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CANCELADO: "bg-rose-50 text-rose-700 border-rose-200",
  IGNORADO: "bg-gray-50 text-gray-500 border-gray-200",
};

const setorClasses: Record<string, string> = {
  SOLICITACAO: "bg-gray-50 text-gray-700 border-gray-300",
  RH: "bg-sky-50 text-sky-700 border-sky-200",
  MEDICINA: "bg-teal-50 text-teal-700 border-teal-200",
  TREINAMENTO: "bg-violet-50 text-violet-700 border-violet-200",
  LOGISTICA: "bg-slate-100 text-slate-700 border-slate-300",
};

const PRAZO_SUSPEITO_DIAS = 60;

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function dateTime(value: string | null) {
  if (!value) return Number.POSITIVE_INFINITY;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY;
}

function cicloTimelineTime(ciclo: Ciclo) {
  return dateTime(ciclo.conclusaoAt || ciclo.cancelamentoAt || ciclo.inicioAt);
}

function diffDays(start: string | null, end: string | null) {
  if (!start || !end) return null;
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) return null;
  return Math.max(0, Math.ceil((endTime - startTime) / 86_400_000));
}

function cicloDurationDays(ciclo: Ciclo) {
  return diffDays(
    ciclo.inicioAt,
    ciclo.conclusaoAt || ciclo.cancelamentoAt || new Date().toISOString(),
  );
}

function formatDays(days: number | null) {
  if (days === null) return "-";
  if (days === 0) return "Mesmo dia";
  return `${days} dia${days === 1 ? "" : "s"}`;
}

function isPrazoVencido(ciclo: Ciclo) {
  if (!ciclo.prazoPrevistoAt || ciclo.status !== "ABERTO") return false;
  const prazo = new Date(ciclo.prazoPrevistoAt);
  prazo.setHours(23, 59, 59, 999);
  return prazo.getTime() < Date.now();
}

function isPrazoSuspeito(ciclo: Ciclo) {
  const diasPrazo = diffDays(ciclo.inicioAt, ciclo.prazoPrevistoAt);
  return diasPrazo !== null && diasPrazo > PRAZO_SUSPEITO_DIAS;
}

function badgeClass(base: string | undefined) {
  return `inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${base || "bg-gray-50 text-gray-700 border-gray-200"}`;
}

export default function RemanejamentoCiclosPage() {
  return (
    <ProtectedRoute
      requiredPermissions={ROUTE_PROTECTION.ADMIN.requiredPermissions}
      requiredEquipe={ROUTE_PROTECTION.ADMIN.requiredEquipe}
    >
      <RemanejamentoCiclosContent />
    </ProtectedRoute>
  );
}

function RemanejamentoCiclosContent() {
  const [data, setData] = useState<CiclosResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [matricula, setMatricula] = useState("");
  const [nome, setNome] = useState("");
  const [remanejamentoId, setRemanejamentoId] = useState("");
  const [setor, setSetor] = useState("TODOS");
  const [status, setStatus] = useState("TODOS");
  const [origem, setOrigem] = useState("TODOS");
  const [tipoCiclo, setTipoCiclo] = useState("TODOS");
  const [multiCiclo, setMultiCiclo] = useState(false);
  const [limit, setLimit] = useState(100);

  const ciclos = useMemo(
    () =>
      [...(data?.ciclos || [])].sort((a, b) => {
        const remanejamentoCompare = a.remanejamentoFuncionarioId.localeCompare(
          b.remanejamentoFuncionarioId,
        );
        if (remanejamentoCompare !== 0) return remanejamentoCompare;

        const timelineCompare = cicloTimelineTime(a) - cicloTimelineTime(b);
        if (timelineCompare !== 0) return timelineCompare;

        if (a.numeroCiclo !== b.numeroCiclo) return a.numeroCiclo - b.numeroCiclo;

        return (
          (setorSortOrder[a.setor] ?? 99) - (setorSortOrder[b.setor] ?? 99)
        );
      }),
    [data?.ciclos],
  );
  const abertosVencidos = useMemo(
    () => ciclos.filter((ciclo) => isPrazoVencido(ciclo)).length,
    [ciclos],
  );
  const prazosSuspeitos = useMemo(
    () => ciclos.filter((ciclo) => isPrazoSuspeito(ciclo)).length,
    [ciclos],
  );

  async function loadCiclos() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      if (matricula.trim()) params.set("matricula", matricula.trim());
      if (nome.trim()) params.set("nome", nome.trim());
      if (remanejamentoId.trim()) {
        params.set("remanejamentoId", remanejamentoId.trim());
      }
      if (setor !== "TODOS") params.set("setor", setor);
      if (status !== "TODOS") params.set("status", status);
      if (origem !== "TODOS") params.set("origem", origem);
      if (tipoCiclo !== "TODOS") params.set("tipoCiclo", tipoCiclo);
      if (multiCiclo) params.set("multiCiclo", "1");

      const response = await fetch(
        `/api/admin/remanejamento-ciclos?${params.toString()}`,
        { cache: "no-store" },
      );
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Erro ao carregar ciclos.");
      }
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCiclos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    loadCiclos();
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <header className="flex flex-col gap-3 border-b border-gray-200 pb-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
              Auditoria operacional
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-gray-950">
              Ciclos de remanejamento
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-gray-600">
              Conferencia dos ciclos internos do Crew antes da camada de
              integracao externa.
            </p>
          </div>
          <button
            type="button"
            onClick={loadCiclos}
            disabled={loading}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </button>
        </header>

        <section className="grid gap-3 md:grid-cols-5">
          <Metric label="Ciclos exibidos" value={data?.total ?? 0} />
          <Metric label="Total no filtro" value={data?.totalGeral ?? 0} />
          <Metric
            label="Abertos"
            value={data?.resumo?.porStatus?.ABERTO ?? 0}
          />
          <Metric
            label="Abertos vencidos"
            value={abertosVencidos}
            warning={abertosVencidos > 0}
          />
          <Metric
            label="Prazos suspeitos"
            value={prazosSuspeitos}
            warning={prazosSuspeitos > 0}
          />
        </section>

        <form
          onSubmit={handleSubmit}
          className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
        >
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800">
            <Filter className="h-4 w-4 text-gray-500" />
            Filtros
          </div>
          <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
            <TextFilter
              label="Matricula"
              value={matricula}
              onChange={setMatricula}
              placeholder="FRI-..."
            />
            <TextFilter
              label="Nome"
              value={nome}
              onChange={setNome}
              placeholder="Funcionario"
            />
            <TextFilter
              label="Remanejamento"
              value={remanejamentoId}
              onChange={setRemanejamentoId}
              placeholder="ID interno"
            />
            <SelectFilter
              label="Setor"
              value={setor}
              options={setorOptions}
              onChange={setSetor}
            />
            <SelectFilter
              label="Status"
              value={status}
              options={statusOptions}
              onChange={setStatus}
            />
            <SelectFilter
              label="Origem"
              value={origem}
              options={origemOptions}
              onChange={setOrigem}
            />
            <SelectFilter
              label="Tipo"
              value={tipoCiclo}
              options={tipoOptions}
              onChange={setTipoCiclo}
            />
            <label className="block">
              <span className="text-xs font-medium text-gray-600">Limite</span>
              <input
                type="number"
                min={1}
                max={200}
                value={limit}
                onChange={(event) => setLimit(Number(event.target.value))}
                className="mt-1 h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={multiCiclo}
                onChange={(event) => setMultiCiclo(event.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-red-700 focus:ring-red-500"
              />
              Somente multi-ciclo
            </label>
            <span className="text-xs text-gray-500">
              Prazo suspeito: mais de {PRAZO_SUSPEITO_DIAS} dias entre inicio e prazo.
            </span>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-red-700 px-4 text-sm font-medium text-white shadow-sm hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Search className="h-4 w-4" />
              Buscar
            </button>
          </div>
        </form>

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-100 text-xs uppercase text-gray-600">
                <tr>
                  <Th>Funcionario</Th>
                  <Th>Solicitacao</Th>
                  <Th>Ciclo</Th>
                  <Th>Setor</Th>
                  <Th>Status</Th>
                  <Th>Inicio</Th>
                  <Th>Prazo</Th>
                  <Th>Fim</Th>
                  <Th>Duração</Th>
                  <Th>Origem</Th>
                  <Th>Eventos</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-10 text-center text-gray-500">
                      Carregando ciclos...
                    </td>
                  </tr>
                ) : ciclos.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-10 text-center text-gray-500">
                      Nenhum ciclo encontrado para os filtros atuais.
                    </td>
                  </tr>
                ) : (
                  ciclos.map((ciclo) => (
                    <tr
                      key={ciclo.id}
                      className={
                        isPrazoVencido(ciclo) || isPrazoSuspeito(ciclo)
                          ? "bg-amber-50/60"
                          : "hover:bg-gray-50"
                      }
                    >
                      <Td>
                        <div className="font-medium text-gray-950">
                          {ciclo.remanejamentoFuncionario.funcionario.nome}
                        </div>
                        <div className="mt-0.5 font-mono text-xs text-gray-500">
                          {ciclo.remanejamentoFuncionario.funcionario.matricula}
                        </div>
                        <div className="mt-0.5 text-xs text-gray-500">
                          {ciclo.remanejamentoFuncionario.funcionario.funcao || "-"}
                        </div>
                      </Td>
                      <Td>
                        <div className="font-mono text-xs text-gray-700">
                          #{ciclo.remanejamentoFuncionario.solicitacao.id}
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                          {ciclo.remanejamentoFuncionario.solicitacao.tipo}
                        </div>
                        <div className="mt-1 max-w-[220px] truncate font-mono text-[11px] text-gray-400">
                          {ciclo.remanejamentoFuncionarioId}
                        </div>
                      </Td>
                      <Td>
                        <div className="font-semibold text-gray-900">
                          {ciclo.numeroCiclo}
                        </div>
                        <div className="mt-1 max-w-[180px] truncate text-xs text-gray-500">
                          {ciclo.tituloCiclo || ciclo.tipoCiclo}
                        </div>
                      </Td>
                      <Td>
                        <span className={badgeClass(setorClasses[ciclo.setor])}>
                          {ciclo.setor}
                        </span>
                      </Td>
                      <Td>
                        <span className={badgeClass(statusClasses[ciclo.status])}>
                          {ciclo.status}
                        </span>
                        <div className="mt-1 text-xs text-gray-500">
                          {ciclo.remanejamentoFuncionario.statusTarefas}
                        </div>
                      </Td>
                      <Td>{formatDate(ciclo.inicioAt)}</Td>
                      <Td>
                        <div
                          className={
                            isPrazoVencido(ciclo) || isPrazoSuspeito(ciclo)
                              ? "font-semibold text-amber-700"
                              : ""
                          }
                        >
                          {formatDate(ciclo.prazoPrevistoAt)}
                        </div>
                        {isPrazoVencido(ciclo) && (
                          <div className="mt-1 inline-flex items-center gap-1 text-xs text-amber-700">
                            <AlertTriangle className="h-3 w-3" />
                            Vencido
                          </div>
                        )}
                        {isPrazoSuspeito(ciclo) && (
                          <div className="mt-1 inline-flex items-center gap-1 text-xs text-amber-700">
                            <AlertTriangle className="h-3 w-3" />
                            Suspeito
                          </div>
                        )}
                      </Td>
                      <Td>
                        {formatDate(ciclo.conclusaoAt || ciclo.cancelamentoAt)}
                      </Td>
                      <Td>
                        <div className="text-xs font-medium text-gray-700">
                          {formatDays(cicloDurationDays(ciclo))}
                        </div>
                        {ciclo.status === "ABERTO" && (
                          <div className="mt-1 text-xs text-gray-500">em aberto</div>
                        )}
                      </Td>
                      <Td>
                        <div className="text-xs font-medium text-gray-700">
                          {ciclo.origem}
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                          {ciclo.confianca}
                        </div>
                      </Td>
                      <Td>
                        <div className="inline-flex items-center gap-1 text-xs text-gray-600">
                          <Clock3 className="h-3.5 w-3.5" />
                          {ciclo.eventos.length}
                        </div>
                        <div className="mt-1 max-w-[200px] truncate text-xs text-gray-500">
                          {ciclo.motivoFechamento || ciclo.motivoAbertura || "-"}
                        </div>
                      </Td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({
  label,
  value,
  warning,
}: {
  label: string;
  value: number;
  warning?: boolean;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium uppercase text-gray-500">{label}</div>
      <div className={warning ? "mt-2 text-2xl font-semibold text-amber-700" : "mt-2 text-2xl font-semibold text-gray-950"}>
        {value}
      </div>
    </div>
  );
}

function TextFilter({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-600">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
      />
    </label>
  );
}

function SelectFilter({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-600">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function Th({ children }: { children: ReactNode }) {
  return (
    <th className="whitespace-nowrap px-4 py-3 text-left font-semibold">
      {children}
    </th>
  );
}

function Td({ children }: { children: ReactNode }) {
  return <td className="align-top px-4 py-3 text-gray-700">{children}</td>;
}
