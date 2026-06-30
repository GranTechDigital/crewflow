"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Mail, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { ROUTE_PROTECTION } from "@/lib/permissions";

type ReportRecipient = {
  id: number;
  name: string;
  email: string;
  active: boolean;
  receivesScheduledEmail: boolean;
  canRequestByEmail: boolean;
  frequency: string;
  lastSentAt: string | null;
  updatedAt: string;
};

type RecipientForm = {
  name: string;
  email: string;
  active: boolean;
  receivesScheduledEmail: boolean;
  canRequestByEmail: boolean;
};

const emptyForm: RecipientForm = {
  name: "",
  email: "",
  active: true,
  receivesScheduledEmail: true,
  canRequestByEmail: false,
};

export default function ReportRecipientsPage() {
  return (
    <ProtectedRoute
      requiredPermissions={ROUTE_PROTECTION.ADMIN.requiredPermissions}
      requiredEquipe={ROUTE_PROTECTION.ADMIN.requiredEquipe}
    >
      <ReportRecipientsContent />
    </ProtectedRoute>
  );
}

function ReportRecipientsContent() {
  const [recipients, setRecipients] = useState<ReportRecipient[]>([]);
  const [form, setForm] = useState<RecipientForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const filteredRecipients = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return recipients;
    return recipients.filter(
      (recipient) =>
        recipient.name.toLowerCase().includes(term) ||
        recipient.email.toLowerCase().includes(term),
    );
  }, [recipients, search]);

  const scheduledCount = recipients.filter((recipient) => recipient.active && recipient.receivesScheduledEmail).length;
  const requestCount = recipients.filter((recipient) => recipient.active && recipient.canRequestByEmail).length;

  async function loadRecipients() {
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/relatorios/destinatarios", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Erro ao carregar destinatários.");
      setRecipients(data.recipients);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao carregar destinatários.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRecipients();
  }, []);

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  function startEdit(recipient: ReportRecipient) {
    setEditingId(recipient.id);
    setForm({
      name: recipient.name,
      email: recipient.email,
      active: recipient.active,
      receivesScheduledEmail: recipient.receivesScheduledEmail,
      canRequestByEmail: recipient.canRequestByEmail,
    });
    setMessage(null);
  }

  async function submitForm(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    const endpoint = editingId
      ? `/api/admin/relatorios/destinatarios/${editingId}`
      : "/api/admin/relatorios/destinatarios";
    const method = editingId ? "PATCH" : "POST";

    try {
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Erro ao salvar destinatário.");
      setMessage(editingId ? "Destinatário atualizado." : "Destinatário cadastrado.");
      resetForm();
      await loadRecipients();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao salvar destinatário.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleRecipient(recipient: ReportRecipient, field: keyof Pick<ReportRecipient, "active" | "receivesScheduledEmail" | "canRequestByEmail">) {
    setMessage(null);
    const previous = recipients;
    setRecipients((items) =>
      items.map((item) =>
        item.id === recipient.id ? { ...item, [field]: !item[field] } : item,
      ),
    );

    try {
      const response = await fetch(`/api/admin/relatorios/destinatarios/${recipient.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: !recipient[field] }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Erro ao atualizar destinatário.");
    } catch (error) {
      setRecipients(previous);
      setMessage(error instanceof Error ? error.message : "Erro ao atualizar destinatário.");
    }
  }

  async function removeRecipient(recipient: ReportRecipient) {
    if (!window.confirm(`Remover ${recipient.email} dos destinatários do relatório?`)) return;
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/relatorios/destinatarios/${recipient.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Erro ao remover destinatário.");
      if (editingId === recipient.id) resetForm();
      await loadRecipients();
      setMessage("Destinatário removido.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao remover destinatário.");
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-900">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <header className="flex flex-col justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm md:flex-row md:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Configurações de relatórios</p>
            <h1 className="text-xl font-bold text-slate-950">Destinatários do Relatório Geral</h1>
          </div>
          <button
            type="button"
            onClick={loadRecipients}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw size={15} />
            Atualizar
          </button>
        </header>

        <section className="grid gap-3 md:grid-cols-3">
          <MetricCard label="Destinatários ativos" value={scheduledCount} />
          <MetricCard label="Podem solicitar por e-mail" value={requestCount} />
          <MetricCard label="Total cadastrado" value={recipients.length} />
        </section>

        <section className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <form onSubmit={submitForm} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-900 text-white">
                <Mail size={16} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-950">{editingId ? "Editar destinatário" : "Novo destinatário"}</h2>
                <p className="text-xs text-slate-500">Controle operacional, sem deploy.</p>
              </div>
            </div>

            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Nome</span>
                <input
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                  placeholder="Nome do destinatário"
                  required
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600">E-mail</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                  placeholder="nome@empresa.com"
                  required
                />
              </label>

              <ToggleField
                label="Ativo"
                checked={form.active}
                onChange={(checked) => setForm((current) => ({ ...current, active: checked }))}
              />
              <ToggleField
                label="Recebe envio semanal"
                checked={form.receivesScheduledEmail}
                onChange={(checked) => setForm((current) => ({ ...current, receivesScheduledEmail: checked }))}
              />
              <ToggleField
                label="Pode solicitar por e-mail"
                checked={form.canRequestByEmail}
                onChange={(checked) => setForm((current) => ({ ...current, canRequestByEmail: checked }))}
              />
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-md bg-slate-900 px-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {editingId ? <Save size={15} /> : <Plus size={15} />}
                {saving ? "Salvando..." : editingId ? "Salvar" : "Adicionar"}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="h-9 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>

          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-2 border-b border-slate-200 p-3 md:flex-row md:items-center md:justify-between">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500 md:max-w-sm"
                placeholder="Buscar por nome ou e-mail"
              />
              {message && <span className="text-xs font-semibold text-slate-600">{message}</span>}
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-[11px] font-bold uppercase text-slate-500">Nome</th>
                    <th className="px-3 py-2 text-left text-[11px] font-bold uppercase text-slate-500">E-mail</th>
                    <th className="px-3 py-2 text-center text-[11px] font-bold uppercase text-slate-500">Ativo</th>
                    <th className="px-3 py-2 text-center text-[11px] font-bold uppercase text-slate-500">Semanal</th>
                    <th className="px-3 py-2 text-center text-[11px] font-bold uppercase text-slate-500">Solicita</th>
                    <th className="px-3 py-2 text-right text-[11px] font-bold uppercase text-slate-500">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td className="px-3 py-8 text-center text-slate-500" colSpan={6}>Carregando destinatários...</td>
                    </tr>
                  ) : filteredRecipients.length === 0 ? (
                    <tr>
                      <td className="px-3 py-8 text-center text-slate-500" colSpan={6}>Nenhum destinatário encontrado.</td>
                    </tr>
                  ) : (
                    filteredRecipients.map((recipient) => (
                      <tr key={recipient.id} className="hover:bg-slate-50">
                        <td className="whitespace-nowrap px-3 py-2 font-semibold text-slate-900">{recipient.name}</td>
                        <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-slate-600">{recipient.email}</td>
                        <td className="px-3 py-2 text-center">
                          <MiniToggle checked={recipient.active} onClick={() => toggleRecipient(recipient, "active")} />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <MiniToggle checked={recipient.receivesScheduledEmail} onClick={() => toggleRecipient(recipient, "receivesScheduledEmail")} />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <MiniToggle checked={recipient.canRequestByEmail} onClick={() => toggleRecipient(recipient, "canRequestByEmail")} />
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => startEdit(recipient)}
                            className="mr-2 rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => removeRecipient(recipient)}
                            className="inline-flex items-center rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                            aria-label={`Remover ${recipient.email}`}
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 font-mono text-2xl font-bold text-slate-950">{value}</p>
    </div>
  );
}

function ToggleField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
      {label}
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-slate-900" />
    </label>
  );
}

function MiniToggle({ checked, onClick }: { checked: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`mx-auto flex h-5 w-9 items-center rounded-full p-0.5 transition ${checked ? "bg-emerald-600" : "bg-slate-300"}`}
      aria-pressed={checked}
    >
      <span className={`h-4 w-4 rounded-full bg-white shadow transition ${checked ? "translate-x-4" : "translate-x-0"}`} />
    </button>
  );
}
