"use client";
import { useRef, useState } from "react";
import { Save, Send, Loader2 } from "lucide-react";
import { Action, SurfaceDialog } from "./CertificateUi";

type EditableItem = { id: number; matricula: string; nome: string | null; certificadora?: string | null; qualificacao: string; tipoDocumento: string; emissao: string | null; validade: string | null; recebimento: string | null; updatedAt: string };
export function CertificateEditor({ item, importacaoId, onClose, onSaved, onBeforeSend }: { item: EditableItem; importacaoId: number; onClose: () => void; onSaved: (message: string) => Promise<void>; onBeforeSend?: () => Promise<void> }) {
  const [values, setValues] = useState({ matricula: item.matricula, nome: item.nome ?? "", certificadora: item.certificadora ?? "", qualificacao: item.qualificacao, tipoDocumento: item.tipoDocumento, emissao: item.emissao?.slice(0, 10) ?? "", validade: item.validade?.slice(0, 10) ?? "", recebimento: item.recebimento?.slice(0, 10) ?? "" });
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [feedback, setFeedback] = useState<string | null>(null);
  const lock = useRef(false), form = useRef<HTMLFormElement>(null);
  async function save(enviar: boolean) {
    if (lock.current || !form.current?.reportValidity()) return;
    lock.current = true; setBusy(true); setError(null);
    try {
      if (enviar) await onBeforeSend?.();
      const response = await fetch(`/api/treinamento/importacoes-certificados/${importacaoId}/itens/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dados: values, atualizadoEm: item.updatedAt, enviar, confirmar: enviar }) });
      const body = await response.json(); if (!response.ok) throw Error(body.error || "Não foi possível salvar a correção.");
      setFeedback(body.mensagem); await onSaved(body.mensagem);
    } catch (error) { setError(error instanceof Error ? error.message : "Falha ao salvar. Confira o histórico antes de enviar novamente."); }
    finally { lock.current = false; setBusy(false); }
  }
  const labels: Record<keyof typeof values, string> = { matricula: "Matrícula", nome: "Nome na planilha", certificadora: "Certificadora", qualificacao: "Qualificação", tipoDocumento: "Tipo de documento", emissao: "Emissão", validade: "Validade (opcional)", recebimento: "Recebimento" };
  return <SurfaceDialog open onOpenChange={open => { if (!open) onClose(); }} title="Editar certificado" description={`${item.matricula} · As correções passam por nova validação e conferência de duplicidades.`} busy={busy}>
    <form ref={form} onSubmit={event => { event.preventDefault(); void save(false); }} className="space-y-5 p-6">
      {error && <p role="alert" className="rounded-md bg-rose-50 p-3 text-sm leading-6 text-rose-800">{error}</p>}
      {feedback && <p role="status" className="rounded-md bg-slate-50 p-3 text-sm leading-6 text-slate-700">{feedback}</p>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{(Object.keys(values) as (keyof typeof values)[]).map(key =>
        <label key={key} className={`block text-xs font-medium text-slate-600 ${key === "qualificacao" ? "sm:col-span-2" : ""}`}>{labels[key]}<input type={["emissao", "validade", "recebimento"].includes(key) ? "date" : "text"} value={values[key]} maxLength={key === "matricula" ? 100 : key === "tipoDocumento" ? 200 : 500} required={["matricula", "qualificacao", "tipoDocumento", "emissao"].includes(key)} disabled={busy || !!feedback} onChange={event => setValues(current => ({ ...current, [key]: event.target.value }))} className="mt-1.5 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-normal text-slate-900 outline-none focus:border-[#af261d] disabled:bg-slate-50" />
        </label>)}</div>
      {!feedback && <p className="rounded-md bg-amber-50 p-3 text-xs leading-5 text-amber-900">Salvar apenas atualiza o Crew. Salvar e enviar solicita o envio deste certificado ao Drake, se ele ficar apto após a análise. O aceite não garante execução final.</p>}
      <div className="flex flex-wrap justify-end gap-2">{feedback ? <Action variant="primary" isDisabled={busy} onPress={onClose}>Concluir</Action> : <>
        <Action isDisabled={busy} onPress={onClose}>Cancelar</Action>
        <Action type="submit" isDisabled={busy}>
          <Save className="size-4" />Salvar</Action>
        <Action variant="primary" isDisabled={busy} onPress={() => void save(true)}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}{busy ? "Salvando / processando…" : "Salvar e enviar ao Drake"}</Action>
      </>}</div>
    </form>
  </SurfaceDialog>;
}
