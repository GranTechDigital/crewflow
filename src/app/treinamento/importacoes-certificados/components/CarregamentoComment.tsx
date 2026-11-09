"use client";
import { useId } from "react";
import { Save } from "lucide-react";
import { Action } from "./CertificateUi";
export function CarregamentoComment({ value, onChange, onSave, disabled = false, saving = false, dirty = false, author }: { value: string; onChange: (value: string) => void; onSave: () => void; disabled?: boolean; saving?: boolean; dirty?: boolean; author?: string }) {
  const inputId = useId();
  return <section className="space-y-2" aria-label="Descrição do carregamento">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <label htmlFor={inputId} className="text-sm font-semibold">Descrição do carregamento</label>
      <Action className="!h-8 !text-xs" isDisabled={disabled || saving || !dirty || !value.trim()} onPress={onSave}>
        <Save className="size-3.5" />{saving ? "Salvando…" : "Salvar descrição"}</Action>
    </div>
    <input type="text" id={inputId} value={value} onChange={event => onChange(event.target.value)} maxLength={200} required disabled={disabled || saving} placeholder="Ex.: Certificados NR-35 • equipe de novembro" className="block h-10 w-full rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-800 outline-none focus:border-[#af261d] disabled:bg-slate-50" />
    <p className="text-xs leading-5 text-slate-500">Identificador compartilhado por todas as versões. Pode ser editado e fica apenas no Crew.{author ? ` Última edição: ${author}.` : ""}</p>
  </section>;
}
