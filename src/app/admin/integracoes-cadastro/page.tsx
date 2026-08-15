"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Code2,
  Database,
  Eye,
  Play,
  RefreshCw,
  Search,
  Send,
  UploadCloud,
} from "lucide-react";

type EventoExterno = {
  id: number;
  provedor: string;
  externalId: string;
  status: string;
  setor: string | null;
  numeroCiclo: number | null;
  startAt: string | null;
  endPrevistoAt: string | null;
  endRealAt: string | null;
  updatedAt: string;
  remanejamentoFuncionarioId: string | null;
  remanejamentoFuncionario: {
    funcionario: {
      nome: string;
      matricula: string;
    };
    solicitacao: {
      id: number;
      tipo: string;
    };
  } | null;
  ciclo: {
    numeroCiclo: number;
    setor: string;
    status: string;
    origem: string;
    confianca: string;
  } | null;
  outbox: Array<{
    id: number;
    status: string;
    tentativas: number;
    ultimoErro: string | null;
    proximaTentativaAt: string | null;
    sentAt: string | null;
    createdAt: string;
    payload: unknown;
  }>;
};

type ApiData = {
  total: number;
  resumoOutbox: Record<string, number>;
  resumoInbox: Record<string, number>;
  eventos: EventoExterno[];
};

type SyncResult = {
  ciclosElegiveis: number;
  eventosCriados: number;
  eventosAtualizados: number;
  outboxCriadas: number;
  ignorados: number;
};

type ProcessResult = {
  totalElegivel: number;
  enviados: number;
  falhas: number;
  ignorados: number;
  desabilitados: number;
  resultados: Array<{
    id: number;
    externalId: string;
    statusAnterior: string;
    statusNovo: string;
    ok: boolean;
    erro?: string;
  }>;
};

const statusOptions = ["TODOS", "ABERTO", "CONCLUIDO", "CANCELADO"];

const statusClasses: Record<string, string> = {
  ABERTO: "border-blue-200 bg-blue-50 text-blue-700",
  CONCLUIDO: "border-emerald-200 bg-emerald-50 text-emerald-700",
  CANCELADO: "border-red-200 bg-red-50 text-red-700",
};

const outboxClasses: Record<string, string> = {
  PENDENTE: "border-amber-200 bg-amber-50 text-amber-700",
  ENVIANDO: "border-blue-200 bg-blue-50 text-blue-700",
  ENVIADO: "border-emerald-200 bg-emerald-50 text-emerald-700",
  AGENDADO_SESSAO: "border-indigo-200 bg-indigo-50 text-indigo-700",
  ERRO: "border-red-200 bg-red-50 text-red-700",
  IGNORADO: "border-gray-200 bg-gray-100 text-gray-700",
};

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function Badge({ value, className = "" }: { value: string; className?: string }) {
  return (
    <span
      className={`inline-flex h-6 items-center rounded-md border px-2 text-xs font-medium ${className}`}
    >
      {value}
    </span>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 font-mono text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

export default function IntegracoesCadastroPage() {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [processResult, setProcessResult] = useState<ProcessResult | null>(null);
  const [remanejamentoFuncionarioId, setRemanejamentoFuncionarioId] = useState("");
  const [status, setStatus] = useState("TODOS");
  const [ambiente, setAmbiente] = useState("dev");
  const [limit, setLimit] = useState(50);
  const [incluirIgnorados, setIncluirIgnorados] = useState(false);
  const [selectedEvento, setSelectedEvento] = useState<EventoExterno | null>(null);

  async function loadEventos() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      if (remanejamentoFuncionarioId.trim()) {
        params.set("remanejamentoFuncionarioId", remanejamentoFuncionarioId.trim());
      }
      if (status !== "TODOS") params.set("status", status);
      params.set("ambiente", ambiente);

      const response = await fetch(`/api/admin/integracoes/cadastro-eventos?${params}`, {
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Erro ao carregar eventos.");
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido.");
    } finally {
      setLoading(false);
    }
  }

  async function sincronizar(dryRun: boolean) {
    setSyncing(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch("/api/admin/integracoes/cadastro-eventos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          remanejamentoFuncionarioId: remanejamentoFuncionarioId.trim() || undefined,
          ambiente,
          dryRun,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Erro ao gerar eventos.");
      setResult(payload);
      if (!dryRun) await loadEventos();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido.");
    } finally {
      setSyncing(false);
    }
  }

  async function processarOutbox(dryRun: boolean) {
    setSyncing(true);
    setError(null);
    setProcessResult(null);
    try {
      const response = await fetch("/api/admin/integracoes/drake/outbox/processar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          limit,
          ambiente,
          dryRun,
          reenviarErros: true,
          incluirIgnorados,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Erro ao processar sessão.");
      setProcessResult(payload);
      if (!dryRun) await loadEventos();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido.");
    } finally {
      setSyncing(false);
    }
  }

  async function processarItem(evento: EventoExterno, dryRun: boolean) {
    const outboxId = evento.outbox[0]?.id;
    if (!outboxId) {
      setError("Este evento ainda nao tem item de outbox.");
      return;
    }

    setSyncing(true);
    setError(null);
    setProcessResult(null);
    try {
      const response = await fetch("/api/admin/integracoes/drake/outbox/processar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outboxId,
          ambiente,
          dryRun,
          incluirIgnorados: true,
          reenviarErros: true,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Erro ao processar item em sessão.");
      setProcessResult(payload);
      if (!dryRun) await loadEventos();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido.");
    } finally {
      setSyncing(false);
    }
  }

  async function reenfileirarItem(evento: EventoExterno) {
    const outboxId = evento.outbox[0]?.id;
    if (!outboxId) {
      setError("Este evento ainda nao tem item de outbox neste ambiente.");
      return;
    }

    setSyncing(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/integracoes/drake/outbox/reenfileirar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outboxId, ambiente }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Erro ao reenfileirar item.");
      await loadEventos();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido.");
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    loadEventos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    loadEventos();
  }

  const totalOutbox = useMemo(
    () => Object.values(data?.resumoOutbox || {}).reduce((acc, value) => acc + value, 0),
    [data?.resumoOutbox],
  );
  const totalInbox = useMemo(
    () => Object.values(data?.resumoInbox || {}).reduce((acc, value) => acc + value, 0),
    [data?.resumoInbox],
  );

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-800">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-red-600">
              Integracoes
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">
              Integração Drake de cadastro
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-500">
              Prepare, confira e agrupe eventos de cadastro em sessão de sincronismo Drake.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => sincronizar(true)}
              disabled={syncing}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Play className="h-4 w-4" />
              Simular preparação
            </button>
            <button
              type="button"
              onClick={() => sincronizar(false)}
              disabled={syncing}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-red-700 bg-red-600 px-3 text-sm font-medium text-white shadow-sm hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Send className="h-4 w-4" />
              Preparar eventos
            </button>
            <button
              type="button"
              onClick={() => processarOutbox(true)}
              disabled={syncing}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <UploadCloud className="h-4 w-4" />
              Simular sessão
            </button>
            <button
              type="button"
              onClick={() => processarOutbox(false)}
              disabled={syncing}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 text-sm font-medium text-amber-800 shadow-sm hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <UploadCloud className="h-4 w-4" />
              Processar sessão
            </button>
            <button
              type="button"
              onClick={loadEventos}
              disabled={loading}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </button>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-6">
          <Metric label="Eventos preparados" value={data?.total ?? 0} />
          <Metric label="Fila de envio" value={totalOutbox} />
          <Metric label="Inbox entrada" value={totalInbox} />
          <Metric label="Aguardando sessão" value={data?.resumoOutbox?.PENDENTE ?? 0} />
          <Metric label="Não enviados" value={data?.resumoOutbox?.IGNORADO ?? 0} />
          <Metric label="Falhas de envio" value={data?.resumoOutbox?.ERRO ?? 0} />
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <p className="font-semibold text-slate-900">1. Preparar eventos</p>
              <p className="mt-1">Cria ou atualiza no banco os eventos vindos dos ciclos do Crew.</p>
            </div>
            <div>
              <p className="font-semibold text-slate-900">2. Conferir fila</p>
              <p className="mt-1">Mostra o payload e permite simular a sessão sem chamar o Drake.</p>
            </div>
            <div>
              <p className="font-semibold text-slate-900">3. Processar sessão</p>
              <p className="mt-1">
                Só abre sessão de verdade quando as travas do ambiente estiverem habilitadas.
              </p>
            </div>
          </div>
        </section>

        <form
          onSubmit={handleSubmit}
          className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Search className="h-4 w-4 text-slate-400" />
            Filtros
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_160px_180px_120px_auto]">
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Remanejamento</span>
              <input
                value={remanejamentoFuncionarioId}
                onChange={(event) => setRemanejamentoFuncionarioId(event.target.value)}
                placeholder="ID interno"
                className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-slate-50 px-3 text-sm text-slate-700 outline-none focus:border-slate-500 focus:bg-white"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Ambiente</span>
              <select
                value={ambiente}
                onChange={(event) => setAmbiente(event.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-slate-50 px-3 text-sm text-slate-700 outline-none focus:border-slate-500 focus:bg-white"
              >
                <option value="dev">HMG</option>
                <option value="production">Produção</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Status</span>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-slate-50 px-3 text-sm text-slate-700 outline-none focus:border-slate-500 focus:bg-white"
              >
                {statusOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Limite</span>
              <input
                type="number"
                min={1}
                max={200}
                value={limit}
                onChange={(event) => setLimit(Number(event.target.value))}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-slate-50 px-3 text-sm text-slate-700 outline-none focus:border-slate-500 focus:bg-white"
              />
            </label>
            <button
              type="submit"
              className="mt-5 inline-flex h-9 items-center justify-center rounded-md border border-slate-700 bg-slate-800 px-4 text-sm font-medium text-white shadow-sm hover:bg-slate-900"
            >
              Filtrar
            </button>
          </div>
          <label className="mt-3 flex items-center gap-2 text-xs font-medium text-slate-600">
            <input
              type="checkbox"
              checked={incluirIgnorados}
              onChange={(event) => setIncluirIgnorados(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-red-600"
            />
            Incluir itens marcados como não enviados no envio manual
          </label>
        </form>

        {result && (
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Database className="h-4 w-4 text-red-600" />
              Resultado da preparação
            </div>
            <div className="grid gap-3 md:grid-cols-5">
              <Metric label="Ciclos elegíveis" value={result.ciclosElegiveis} />
              <Metric label="Eventos novos" value={result.eventosCriados} />
              <Metric label="Eventos atualizados" value={result.eventosAtualizados} />
              <Metric label="Itens na fila" value={result.outboxCriadas} />
              <Metric label="Fora do Drake" value={result.ignorados} />
            </div>
          </section>
        )}

        {processResult && (
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <UploadCloud className="h-4 w-4 text-amber-600" />
              Resultado da sessão
            </div>
            <div className="grid gap-3 md:grid-cols-5">
              <Metric label="Itens avaliados" value={processResult.totalElegivel} />
              <Metric label="Agendados" value={processResult.enviados} />
              <Metric label="Falhas" value={processResult.falhas} />
              <Metric label="Sessão desligada" value={processResult.desabilitados} />
              <Metric label="Não enviados" value={processResult.ignorados} />
            </div>
            {processResult.resultados.length > 0 && (
              <div className="mt-3 max-h-44 overflow-auto rounded-md border border-slate-200">
                {processResult.resultados.slice(0, 20).map((item) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-[90px_120px_120px_1fr] gap-3 border-b border-slate-100 px-3 py-2 text-xs last:border-b-0"
                  >
                    <span className="font-mono text-slate-500">#{item.id}</span>
                    <span className={item.ok ? "text-emerald-700" : "text-amber-700"}>
                      {`${item.statusAnterior} -> ${item.statusNovo}`}
                    </span>
                    <span className={item.ok ? "text-emerald-700" : "text-red-700"}>
                      {item.ok ? "OK" : "Falha"}
                    </span>
                    <span className="truncate font-mono text-slate-500">
                      {item.erro || item.externalId}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {selectedEvento && (
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Code2 className="h-4 w-4 text-slate-500" />
                  Payload do evento
                </div>
                <p className="mt-1 font-mono text-xs text-slate-500">
                  {selectedEvento.externalId}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEvento(null)}
                className="h-8 rounded-md border border-slate-300 px-3 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                Fechar
              </button>
            </div>
            <pre className="max-h-96 overflow-auto rounded-md border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
              {JSON.stringify(selectedEvento.outbox[0]?.payload ?? {}, null, 2)}
            </pre>
            {selectedEvento.outbox[0]?.ultimoErro && (
              <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {selectedEvento.outbox[0].ultimoErro}
              </div>
            )}
          </section>
        )}

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 text-xs text-slate-500">
            <span>Ações por evento</span>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <Eye className="h-3.5 w-3.5" /> ver payload
              </span>
              <span className="inline-flex items-center gap-1">
                <Play className="h-3.5 w-3.5" /> simular envio
              </span>
              <span className="inline-flex items-center gap-1">
                <UploadCloud className="h-3.5 w-3.5" /> enviar ao Drake
              </span>
              <span className="inline-flex items-center gap-1">
                <RefreshCw className="h-3.5 w-3.5" /> reenfileirar
              </span>
            </div>
          </div>
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-100 text-xs uppercase text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Funcionario</th>
                <th className="px-4 py-3 text-left font-semibold">Ciclo</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-left font-semibold">Inicio</th>
                <th className="px-4 py-3 text-left font-semibold">Fim</th>
                <th className="px-4 py-3 text-left font-semibold">Sessão Drake</th>
                <th className="px-4 py-3 text-left font-semibold">ExternalId</th>
                <th className="px-4 py-3 text-right font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-500" colSpan={8}>
                    Carregando eventos...
                  </td>
                </tr>
              ) : !data?.eventos?.length ? (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-500" colSpan={8}>
                    Nenhum evento encontrado.
                  </td>
                </tr>
              ) : (
                data.eventos.map((evento) => {
                  const ultimaOutbox = evento.outbox[0];
                  return (
                    <tr key={evento.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">
                          {evento.remanejamentoFuncionario?.funcionario.nome || "-"}
                        </div>
                        <div className="mt-1 font-mono text-xs text-slate-500">
                          {evento.remanejamentoFuncionario?.funcionario.matricula || "-"} · #
                          {evento.remanejamentoFuncionario?.solicitacao.id || "-"}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-mono text-slate-700">
                          {evento.numeroCiclo ?? "-"} / {evento.setor ?? "-"}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {evento.ciclo?.origem || "-"} · {evento.ciclo?.confianca || "-"}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          value={evento.status}
                          className={statusClasses[evento.status] || "border-slate-300 text-slate-700"}
                        />
                      </td>
                      <td className="px-4 py-3 text-slate-600">{formatDate(evento.startAt)}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatDate(evento.endRealAt || evento.endPrevistoAt)}
                      </td>
                      <td className="px-4 py-3">
                        {ultimaOutbox ? (
                          <div className="space-y-1">
                            <Badge
                              value={ultimaOutbox.status}
                              className={
                                outboxClasses[ultimaOutbox.status] ||
                                "border-slate-300 text-slate-700"
                              }
                            />
                            <div className="text-xs text-slate-500">
                              {formatDate(ultimaOutbox.createdAt)}
                            </div>
                            <div className="text-xs text-slate-400">
                              {ultimaOutbox.tentativas} tentativa(s)
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>
                      <td className="max-w-[360px] px-4 py-3">
                        <div className="truncate font-mono text-xs text-slate-500">
                          {evento.externalId}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedEvento(evento)}
                            className="inline-flex h-8 items-center justify-center rounded-md border border-slate-300 px-2 text-slate-600 hover:bg-slate-100"
                            title="Ver payload"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => processarItem(evento, true)}
                            disabled={syncing || !ultimaOutbox}
                            className="inline-flex h-8 items-center justify-center rounded-md border border-slate-300 px-2 text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                            title="Simular este evento em sessão"
                          >
                            <Play className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => processarItem(evento, false)}
                            disabled={syncing || !ultimaOutbox}
                            className="inline-flex h-8 items-center justify-center rounded-md border border-amber-300 bg-amber-50 px-2 text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                            title="Processar este evento em sessão"
                          >
                            <UploadCloud className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => reenfileirarItem(evento)}
                            disabled={syncing || !ultimaOutbox}
                            className="inline-flex h-8 items-center justify-center rounded-md border border-slate-300 px-2 text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                            title="Tornar este item pendente novamente"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
