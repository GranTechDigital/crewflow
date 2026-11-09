"use client";

import type { ReactNode, ComponentProps } from "react";
import { Button as AriaButton, ModalOverlay, Modal, Dialog, Heading, Checkbox } from "react-aria-components";
import { Check, Minus, X } from "lucide-react";

type ActionProps = Omit<ComponentProps<typeof AriaButton>, "className"> & { className?: string; variant?: "primary" | "secondary" | "ghost" | "danger" };
export function Action({ variant = "secondary", className = "", ...props }: ActionProps) {
  const tones = { primary: "border-[#841d15] bg-[#af261d] text-white hover:bg-[#841d15]", secondary: "border-slate-200 bg-white text-slate-700 hover:bg-slate-50", ghost: "border-transparent text-slate-600 hover:bg-slate-100", danger: "border-rose-200 bg-white text-rose-700 hover:bg-rose-50" };
  return <AriaButton {...props} className={`inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md border px-2.5 text-xs font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-[#af261d]/30 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 ${tones[variant]} ${className}`} />;
}

export function CheckControl({ label, selected, indeterminate, disabled, onChange }: { label: string; selected: boolean; indeterminate?: boolean; disabled?: boolean; onChange: (selected: boolean) => void }) {
  return <Checkbox aria-label={label} isSelected={selected} isIndeterminate={indeterminate} isDisabled={disabled} onChange={onChange} className="group inline-flex cursor-pointer items-center p-1 outline-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-30">
    <span className="flex size-4 items-center justify-center rounded border border-slate-300 bg-white text-white group-data-[selected]:border-[#af261d] group-data-[selected]:bg-[#af261d] group-data-[indeterminate]:bg-[#af261d] group-data-[focus-visible]:ring-2 group-data-[focus-visible]:ring-[#af261d]/30">
      {indeterminate ? <Minus className="size-3" /> : selected ? <Check className="size-3" /> : null}
    </span>
  </Checkbox>;
}

export function SurfaceDialog({ open, onOpenChange, title, description, children, wide = false, busy = false, drawer = false }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; description?: string; children: ReactNode; wide?: boolean; busy?: boolean; drawer?: boolean }) {
  return <ModalOverlay isOpen={open} onOpenChange={value => { if (!busy) onOpenChange(value); }} isDismissable={!busy} isKeyboardDismissDisabled={busy} className={`fixed inset-0 z-[90] flex bg-slate-950/30 ${drawer ? "justify-end" : "items-center justify-center p-4"}`}>
    <Modal className={drawer ? "h-[100dvh] w-full max-w-2xl bg-white shadow-2xl" : "max-h-[90dvh] w-full overflow-y-auto rounded-xl bg-white shadow-xl " + (wide ? "max-w-4xl" : "max-w-xl")}>
      <Dialog className={`flex min-h-0 flex-col outline-none ${drawer ? "h-full" : ""}`}>
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-3">
          <div>
            <Heading slot="title" className="text-base font-semibold text-slate-950">{title}</Heading>{description && <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>}</div>
          <Action aria-label={`Fechar ${title}`} variant="ghost" className="size-8 !p-0" isDisabled={busy} onPress={() => onOpenChange(false)}>
            <X className="size-4" />
          </Action>
        </header>
        <div className={`min-h-0 ${drawer ? "flex-1 overflow-y-auto" : ""}`}>{children}</div>
      </Dialog>
    </Modal>
  </ModalOverlay>;
}

export function FieldValue({ label, children }: { label: string; children: ReactNode }) {
  return <div>
    <dt className="text-xs font-medium text-slate-500">{label}</dt>
    <dd className="mt-1 text-sm text-slate-900">{children ?? "—"}</dd>
  </div>;
}
