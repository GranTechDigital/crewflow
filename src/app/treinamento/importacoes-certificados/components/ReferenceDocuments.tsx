"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ModalOverlay, Modal, Dialog, Heading } from "react-aria-components";
import { RefreshCw, FileCheck2, RotateCcw, Trash2 } from "lucide-react";
import { Action } from "./CertificateUi";
const formatDate = (value?: string | null) => value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "—";
const formatDateOnly = (value?: string | null) => value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" }).format(new Date(value)) : "—";

type DocumentCandidate = { id: string; qualificacao: string; tipo: string; emissao: string; validade: string | null; exclusao?: { id: string; status: string; usuarioNome: string; iniciadoEm: string; erro: string | null; restauravel: boolean; restauracao: { status: string; usuarioNome: string; iniciadoEm: string; erro: string | null } | null } | null };
export function ReferenceDocuments({ importacaoId, itemId, onBusyChange, allowDestructive=false }: { allowDestructive?:boolean; importacaoId: number; itemId: number; onBusyChange?: (busy: boolean) => void }) {
  const [data, setData] = useState<{ candidatos: DocumentCandidate[]; total: number; page: number; totalPages: number; versao: number | null; motivo: string | null; matricula: string; nome: string | null } | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<DocumentCandidate | null>(null), [operation, setOperation] = useState<"delete" | "restore">("delete"), [reason, setReason] = useState(""), [deleting, setDeleting] = useState(false), [feedback, setFeedback] = useState<string | null>(null);
  const deletionLock = useRef(false);
  async function load(page = 1, preserveError = false) {
    if (busy) return; setBusy(true); if (!preserveError) setError(null);
    try {
      const response = await fetch(`/api/treinamento/importacoes-certificados/${importacaoId}/referencia?itemId=${itemId}&page=${page}&limit=5`, { cache: "no-store" });
      const body = await response.json(); if (!response.ok) throw Error(body.error || "Não foi possível consultar a referência."); setData(body);
    } catch (error) { setError(error instanceof Error ? error.message : "Falha ao consultar referência."); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importacaoId, itemId]);
  async function requestDelete(event: FormEvent) {
    event.preventDefault(); if (!selected || !data?.versao || deletionLock.current) return;
    deletionLock.current = true; setDeleting(true); onBusyChange?.(true); setError(null); setFeedback(null);
    try {
      const response = await fetch(`/api/treinamento/importacoes-certificados/${importacaoId}/referencia/${operation === "delete" ? "excluir" : "desfazer"}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(operation === "delete" ? { itemId, documentoId: selected.id, confirmar: true, versaoReferencia: data.versao, justificativa: reason } : { itemId, exclusaoId: selected.exclusao?.id, confirmar: true }) });
      const result = await response.json(); if (!response.ok) throw Error(result.error || "Não foi possível solicitar a exclusão."); setFeedback(result.mensagem); setSelected(null);
    } catch (error) { setError(error instanceof Error ? error.message : "Retorno indisponível. Confira o histórico antes de repetir."); }
    finally { deletionLock.current = false; setDeleting(false); onBusyChange?.(false); await load(data.page, true); }
  }
  return <>
    <section aria-label="Documentos encontrados no Drake" className="space-y-4 text-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Documentos encontrados no Drake</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">Compare os registros antes de tomar uma ação.</p>
        </div>
        <Action variant="ghost" isDisabled={busy || deleting} onPress={() => void load(data?.page)} aria-label="Atualizar documentos correspondentes">
          <RefreshCw className="size-4" />
        </Action>
      </div>
      {busy && <p role="status" className="mt-2">Consultando referência…</p>}
      {error && <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      {feedback && <p role="status" className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">{feedback}</p>}
      {data && <div className="mt-2 space-y-2">
        <p className="text-xs text-slate-500">{data.total} registro(s) correspondente(s) · Referência v{data.versao}</p>
        {data.motivo && <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">{data.motivo}</p>}
        {!data.total && <p className="rounded-md bg-slate-50 p-4 text-sm text-slate-600">Nenhum documento corresponde à referência atual. Use “Conferir base” na tela principal para atualizar a análise.</p>}
        {data.candidatos.map(row => <article key={row.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="space-y-4 p-4">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
                <FileCheck2 className="size-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">{row.qualificacao}</p>
                <p className="mt-1 text-xs text-slate-500">{row.tipo}</p>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-slate-500">Emissão</dt>
                <dd className="mt-1 font-medium">{formatDateOnly(row.emissao)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Validade</dt>
                <dd className="mt-1 font-medium">{row.validade ? formatDateOnly(row.validade) : "Não informado"}</dd>
              </div>
            </dl>
            <div>
              <p className="text-xs text-slate-500">ID do documento</p>
              <p className="mt-1 break-all font-mono text-xs text-slate-600">{row.id}</p>
            </div>
            {row.exclusao && <p className="text-amber-800">{row.exclusao.status === "EXCLUSAO_ACEITA" ? "Comando aceito (HTTP 200); execução no Drake ainda precisa ser conferida" : row.exclusao.status === "NAO_CONFIRMADO" ? "Exclusão não confirmada; confira o Drake" : row.exclusao.status === "EM_EXECUCAO" ? "Processando exclusão; não repetir" : "Solicitação rejeitada pelo Drake"} · {row.exclusao.usuarioNome} · {formatDate(row.exclusao.iniciadoEm)}{row.exclusao.erro && <span className="block break-words">{row.exclusao.erro}</span>}</p>}
          </div>
          {allowDestructive && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 bg-slate-50/50 px-4 py-3">
            {row.exclusao?.status === "EXCLUSAO_ACEITA" && row.exclusao.restauravel && <Action isDisabled={busy || deleting || !!data.motivo || (!!row.exclusao.restauracao && row.exclusao.restauracao.status !== "ERRO_DRAKE")} onPress={() => { setSelected(row); setOperation("restore"); setError(null); }}>
              <RotateCcw className="size-3.5" />Desfazer exclusão</Action>}
            <Action variant="danger" isDisabled={busy || deleting || !!data.motivo || (!!row.exclusao && row.exclusao.status !== "ERRO_DRAKE")} onPress={() => { setSelected(row); setOperation("delete"); setReason(""); setError(null); }}>
              <Trash2 className="size-3.5" />Excluir no HMG</Action>
          </div>}
          {row.exclusao?.restauracao && <p className="border-t border-slate-100 p-4 text-xs leading-5 text-slate-600">{row.exclusao.restauracao.status === "RECRIACAO_ACEITA" ? "Comando de recriação aceito; aguardando conferência e reconciliação" : row.exclusao.restauracao.status === "EM_EXECUCAO" ? "Recriação em andamento" : row.exclusao.restauracao.status === "NAO_CONFIRMADO" ? "Recriação não confirmada; confira o Drake" : "Recriação rejeitada"} · {row.exclusao.restauracao.usuarioNome} · {formatDate(row.exclusao.restauracao.iniciadoEm)}{row.exclusao.restauracao.erro && <span className="block break-words">{row.exclusao.restauracao.erro}</span>}</p>}
        </article>)}
        {data.totalPages > 1 && <div className="flex items-center gap-3">
          <button type="button" disabled={busy || data.page <= 1} onClick={() => void load(data.page - 1)} className="disabled:opacity-40">Anterior</button>
          <span>{data.page}/{data.totalPages}</span>
          <button type="button" disabled={busy || data.page >= data.totalPages} onClick={() => void load(data.page + 1)} className="disabled:opacity-40">Próxima</button>
        </div>}
        <p className="text-xs leading-5 text-slate-500">Consultar não altera documentos. A exclusão exige confirmação individual e não libera automaticamente esta linha para envio.</p>
      </div>}
    </section>
    <ModalOverlay isOpen={!!selected} onOpenChange={open => { if (!open && !deleting) setSelected(null); }} isKeyboardDismissDisabled={deleting} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <Modal className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <Dialog className="outline-none">
          <Heading slot="title" className="text-lg font-semibold text-slate-900">{operation === "delete" ? "Excluir documento no Drake HMG" : "Desfazer exclusão no Drake HMG"}</Heading>
          <form onSubmit={requestDelete} aria-busy={deleting} className="mt-4 space-y-4 text-sm text-slate-700">
            <p>{operation === "delete" ? "Confira os dados antes de confirmar a exclusão do documento no HMG." : "O Desfazer cria um novo cadastro com os dados preservados. O ID original e os anexos não serão recuperados."}</p>
            {operation === "delete" && <p className="text-xs text-slate-500">O Desfazer recupera somente os campos disponíveis na cópia de referência, quando suficientes. Ele não recupera o ID original nem os anexos.</p>}
            <div className="space-y-1 rounded border border-slate-200 bg-slate-50 p-3">
              <p>{data?.matricula} · {data?.nome}</p>
              <p className="font-medium">{selected?.qualificacao}</p>
              <p>{selected?.tipo} · Emissão {formatDateOnly(selected?.emissao)} · Validade {selected?.validade ? formatDateOnly(selected.validade) : "Não informado"}</p>
              <p className="break-all font-mono text-xs">{selected?.id}</p>
            </div>
            {operation === "delete" && <label className="block">Justificativa (opcional)<textarea maxLength={1000} disabled={deleting} value={reason} onChange={e => setReason(e.target.value)} className="mt-1 block w-full rounded border border-slate-300 p-2" />
            </label>}
            {error && <p role="alert" className="text-rose-700">{error}</p>}
            {deleting && <p role="status" className="text-amber-800">{operation === "delete" ? "Processando exclusão… Aguardando o retorno do Drake." : "Processando recriação… Aguardando o retorno do Drake."}</p>}
            <p className="text-xs leading-5 text-amber-800">O HTTP 200 confirma o aceite do comando. A execução efetiva precisa ser conferida no Drake.</p>
            <div className="flex flex-wrap justify-end gap-2">
              <Action isDisabled={deleting} onPress={() => setSelected(null)}>Cancelar</Action>
              <Action type="submit" variant="primary" isDisabled={deleting}>{deleting ? "Processando…" : operation === "delete" ? "Confirmar exclusão no HMG" : "Confirmar recriação no HMG"}</Action>
            </div>
          </form>
        </Dialog>
      </Modal>
    </ModalOverlay>
  </>;
}
