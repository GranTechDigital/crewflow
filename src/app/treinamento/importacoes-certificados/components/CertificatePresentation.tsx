import { Importacao } from "../types";
import { CheckCircle2, ListChecks, Trophy, Ban, Link2 } from "lucide-react";
export const statusImportacao = [
  "SUBSTITUIDO",
  "TODOS",
  "AGUARDANDO_CONFIRMACAO",
  "ENVIANDO",
  "PROCESSANDO_DRAKE",
  "CONCLUIDO",
  "CONCLUIDO_COM_ERROS",
  "ANALISANDO",
  "FALHOU",
  "CANCELADO",
];

export const statusItens = [
  "CANCELADO", "RESOLVIDO_OUTRO_ARQUIVO",
  "TODOS",
  "PENDENCIAS",
  "PENDENTE_ENVIO",
  "ERRO_VALIDACAO",
  "DUPLICADO_NO_ARQUIVO",
  "DUPLICADO_JA_PROCESSADO",
  "CONFLITO_ATUALIZACAO",
  "POSSIVEL_DUPLICIDADE",
  "REFERENCIA_INDISPONIVEL",
  "ENVIADO",
  "CONFIRMADO",
  "ERRO_DRAKE",
  "NAO_CONFIRMADO",
  "ENVIANDO",
];

const statusClass: Record<string, string> = {
  CANCELADO: "border-slate-200 bg-slate-100 text-slate-600",
  RESOLVIDO_OUTRO_ARQUIVO: "border-teal-200 bg-teal-50 text-teal-800",
  SUBSTITUIDO: "border-slate-200 bg-slate-100 text-slate-500",
  POSSIVEL_DUPLICIDADE: "bg-amber-50 text-amber-800 border-amber-200",
  REFERENCIA_INDISPONIVEL: "bg-orange-50 text-orange-800 border-orange-200",
  AGUARDANDO_CONFIRMACAO: "bg-blue-50 text-blue-700 border-blue-200",
  CONCLUIDO_COM_ERROS: "bg-amber-50 text-amber-700 border-amber-200",
  ANALISANDO: "bg-slate-50 text-slate-700 border-slate-200",
  ENVIANDO: "bg-blue-50 text-blue-700 border-blue-200",
  PROCESSANDO_DRAKE: "bg-indigo-50 text-indigo-700 border-indigo-200",
  CONCLUIDO: "bg-emerald-50 text-emerald-700 border-emerald-200",
  FALHOU: "bg-red-50 text-red-700 border-red-200",
  PENDENTE_ENVIO: "bg-blue-50 text-blue-700 border-blue-200",
  ERRO_VALIDACAO: "bg-red-50 text-red-700 border-red-200",
  DUPLICADO_NO_ARQUIVO: "bg-slate-100 text-slate-700 border-slate-200",
  DUPLICADO_JA_PROCESSADO: "bg-slate-100 text-slate-700 border-slate-200",
  CONFLITO_ATUALIZACAO: "bg-orange-50 text-orange-700 border-orange-200",
  CONFIRMADO: "bg-emerald-50 text-emerald-700 border-emerald-200",
  ENVIADO: "bg-emerald-50 text-emerald-700 border-emerald-200",
  ERRO_DRAKE: "bg-red-50 text-red-700 border-red-200",
  NAO_CONFIRMADO: "bg-amber-50 text-amber-700 border-amber-200",
};

export function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatDateOnly(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function validityLabel(validade: string | null, status: string) {
  if (validade) return formatDateOnly(validade);
  return ["ENVIADO", "CONFIRMADO"].includes(status) ? "Enviado sem data de validade" : "Não informado";
}

export function statusLabel(value: string) {
  const labels: Record<string, string> = {
    SUBSTITUIDO: "Versão anterior — substituída",
    RESOLVIDO_OUTRO_ARQUIVO: "Resolvido em outro arquivo",
    PENDENCIAS: "Pendências",
    AGUARDANDO_CONFIRMACAO: "Pronto para envio",
    ENVIANDO: "Enviando ao Drake",
    PROCESSANDO_DRAKE: "Aguardando Drake",
    CONCLUIDO: "Concluído",
    CONCLUIDO_COM_ERROS: "Requer revisão",
    ANALISANDO: "Analisando arquivo",
    FALHOU: "Falha na importação",
    CANCELADO: "Cancelado",
    PENDENTE_ENVIO: "Pronto para envio",
    ERRO_VALIDACAO: "Corrigir dados",
    DUPLICADO_NO_ARQUIVO: "Duplicado no arquivo",
    DUPLICADO_JA_PROCESSADO: "Já importado",
    CONFLITO_ATUALIZACAO: "Conferir conflito",
    POSSIVEL_DUPLICIDADE: "Possível duplicidade",
    REFERENCIA_INDISPONIVEL: "Conferir base Drake",
    CONFIRMADO: "Confirmado no Drake",
    ENVIADO: "Enviado ao Drake",
    ERRO_DRAKE: "Erro Drake",
    NAO_CONFIRMADO: "Não confirmado — conferir Drake",
  };
  return labels[value] || value.replaceAll("_", " ");
}


export function reviewCount(batch: Importacao) {
  return batch.totalErroValidacao + batch.totalErroDrake + batch.totalConflitos + batch.totalNaoConfirmadas + (batch.totalDuplicadasNoArquivo ?? 0);
}

export function FileProgress({ batch, compact = false }: { batch: Importacao; compact?: boolean }) {
  const sent = batch.totalEnviadas + batch.totalConfirmadas;
  const resolved = (batch.totalResolvidasOutroArquivo ?? 0) + (batch.totalJaProcessadas ?? Math.max(0, batch.totalDuplicadas - (batch.totalDuplicadasNoArquivo ?? 0)));
  const cancelled = batch.totalCanceladas ?? 0, review = reviewCount(batch), closed = sent + resolved + cancelled;
  const total = Math.max(batch.totalLinhas, closed + batch.totalPendentes + review, 1), percent = Math.min(batch.totalLinhas > 0 && closed >= batch.totalLinhas ? 100 : 99, Math.floor(closed / total * 100));
  const groups = [{ label: "Enviados", value: sent, color: "bg-emerald-500", text: "text-emerald-700" }, { label: "Resolvidos em outro arquivo", value: resolved, color: "bg-teal-400", text: "text-teal-700" }, { label: "Cancelados", value: cancelled, color: "bg-slate-400", text: "text-slate-600" }, { label: "Aptos aguardando", value: batch.totalPendentes, color: "bg-blue-400", text: "text-blue-700" }, { label: "Para revisão", value: review, color: "bg-amber-400", text: "text-amber-800" }];
  const done = batch.totalLinhas > 0 && closed >= batch.totalLinhas;
  if (compact) return <div className="min-w-0 space-y-1.5" title={groups.map(group => `${group.label}: ${group.value}`).join(" · ")}>
    <div className="flex items-center justify-between gap-2 text-[11px] tabular-nums"><span className="text-slate-500">{closed}/{batch.totalLinhas} tratados</span><span className={`font-semibold ${done ? "text-emerald-700" : "text-slate-700"}`}>{percent}%</span></div>
    <div role="img" aria-label={`${percent}% tratados no Crew. ` + groups.map(group => `${group.label}: ${group.value}`).join("; ")} className="flex h-1.5 overflow-hidden rounded-full bg-slate-100">{groups.filter(group => group.value > 0).map(group => <span key={group.label} className={group.color} style={{ width: `${group.value / total * 100}%` }} />)}</div>
  </div>;
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
      <span className="inline-flex items-center gap-1.5 font-medium text-slate-600">
        <ListChecks className="size-3.5" />{closed} de {batch.totalLinhas} tratados</span>
      <span className={`inline-flex items-center gap-1.5 font-semibold tabular-nums ${done ? "text-emerald-700" : "text-slate-700"}`}>{done && <Trophy className="size-4" />}{percent}% concluído</span>
    </div>
    <div role="img" aria-label={`${percent}% tratados no Crew. ` + groups.map(group => `${group.label}: ${group.value}`).join("; ")} className="flex h-2.5 overflow-hidden rounded-full bg-slate-100">{groups.filter(group => group.value > 0).map(group =>
      <span key={group.label} className={`${group.color} transition-[width] motion-reduce:transition-none`} style={{ width: `${group.value / total * 100}%` }} />)}</div>
    <dl className="flex flex-wrap gap-x-4 gap-y-2">{groups.filter(group => group.value > 0 || ["Enviados", "Para revisão"].includes(group.label)).map(group =>
      <div key={group.label} className="flex items-center gap-1.5 text-xs">
        <span className={`size-1.5 rounded-full ${group.color}`} />
        <dt className="text-slate-500">{group.label}</dt>
        <dd className={`font-semibold tabular-nums ${group.text}`}>{group.value}</dd>
      </div>)}</dl>
    {done && <p className="inline-flex items-center gap-1.5 text-xs text-emerald-700">
      <CheckCircle2 className="size-3.5" />Todas as decisões deste arquivo estão registradas.</p>}
  </div>;
}

export function Badge({ value }: { value: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium leading-4 ${statusClass[value] || "border-slate-200 bg-slate-50 text-slate-700"
        }`}
    >
      {value === "CANCELADO" ? <Ban className="size-3" /> : value === "RESOLVIDO_OUTRO_ARQUIVO" ? <Link2 className="size-3" /> : ["ENVIADO", "CONFIRMADO"].includes(value) ? <CheckCircle2 className="size-3" /> : null}{statusLabel(value)}
    </span>
  );
}

