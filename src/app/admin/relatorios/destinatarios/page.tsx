"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { CalendarClock, Mail, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { ROUTE_PROTECTION } from "@/lib/permissions";

type ReportRecipient = {
  id: number;
  name: string;
  email: string;
  active: boolean;
  receivesScheduledEmail: boolean;
  frequency: string;
  lastSentAt: string | null;
  updatedAt: string;
};

type ReportSchedule = {
  id: number | null;
  name: string;
  active: boolean;
  frequency: "daily" | "weekly" | "monthly";
  weekdays: number[];
  dayOfMonth: number | null;
  timeOfDay: string;
  timezone: string;
  sendEmail: boolean;
  saveSnapshot: boolean;
  recipientIds: number[];
  lastRunAt: string | null;
  lastSnapshotAt: string | null;
};

type RecipientForm = {
  name: string;
  email: string;
  active: boolean;
  receivesScheduledEmail: boolean;
};

const emptyRecipientForm: RecipientForm = {
  name: "",
  email: "",
  active: true,
  receivesScheduledEmail: true,
};

const emptyScheduleForm: ReportSchedule = {
  id: null,
  name: "Diretoria semanal",
  active: true,
  frequency: "weekly",
  weekdays: [5],
  dayOfMonth: 1,
  timeOfDay: "17:30",
  timezone: "America/Sao_Paulo",
  sendEmail: true,
  saveSnapshot: true,
  recipientIds: [],
  lastRunAt: null,
  lastSnapshotAt: null,
};

const weekDays = [
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sab" },
  { value: 0, label: "Dom" },
];

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
  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
  const [recipientForm, setRecipientForm] = useState<RecipientForm>(emptyRecipientForm);
  const [scheduleForm, setScheduleForm] = useState<ReportSchedule>(emptyScheduleForm);
  const [editingRecipientId, setEditingRecipientId] = useState<number | null>(null);
  const [editingScheduleId, setEditingScheduleId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingRecipient, setSavingRecipient] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const activeRecipients = recipients.filter((recipient) => recipient.active && recipient.receivesScheduledEmail);
  const activeSchedules = schedules.filter((schedule) => schedule.active && schedule.sendEmail);

  const filteredRecipients = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return recipients;
    return recipients.filter(
      (recipient) =>
        recipient.name.toLowerCase().includes(term) ||
        recipient.email.toLowerCase().includes(term),
    );
  }, [recipients, search]);

  async function loadAll() {
    setLoading(true);
    setMessage(null);
    try {
      const [recipientsResponse, schedulesResponse] = await Promise.all([
        fetch("/api/admin/relatorios/destinatarios", { cache: "no-store" }),
        fetch("/api/admin/relatorios/agenda", { cache: "no-store" }),
      ]);
      const recipientsData = await recipientsResponse.json();
      const schedulesData = await schedulesResponse.json();

      if (!recipientsResponse.ok || !recipientsData.success) {
        throw new Error(recipientsData.message || "Erro ao carregar destinatários.");
      }
      if (!schedulesResponse.ok || !schedulesData.success) {
        throw new Error(schedulesData.message || "Erro ao carregar agendas.");
      }

      setRecipients(recipientsData.recipients);
      setSchedules(schedulesData.schedules || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao carregar configurações.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  function resetRecipientForm() {
    setRecipientForm(emptyRecipientForm);
    setEditingRecipientId(null);
  }

  function resetScheduleForm() {
    setScheduleForm({
      ...emptyScheduleForm,
      recipientIds: activeRecipients.map((recipient) => recipient.id),
    });
    setEditingScheduleId(null);
  }

  function startEditRecipient(recipient: ReportRecipient) {
    setEditingRecipientId(recipient.id);
    setRecipientForm({
      name: recipient.name,
      email: recipient.email,
      active: recipient.active,
      receivesScheduledEmail: recipient.receivesScheduledEmail,
    });
    setMessage(null);
  }

  function startEditSchedule(schedule: ReportSchedule) {
    setEditingScheduleId(schedule.id);
    setScheduleForm({
      ...schedule,
      dayOfMonth: schedule.dayOfMonth || 1,
      recipientIds: schedule.recipientIds || [],
    });
    setMessage(null);
  }

  async function submitRecipient(event: FormEvent) {
    event.preventDefault();
    setSavingRecipient(true);
    setMessage(null);

    const endpoint = editingRecipientId
      ? `/api/admin/relatorios/destinatarios/${editingRecipientId}`
      : "/api/admin/relatorios/destinatarios";
    const method = editingRecipientId ? "PATCH" : "POST";

    try {
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(recipientForm),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Erro ao salvar destinatário.");
      resetRecipientForm();
      await loadAll();
      setMessage(editingRecipientId ? "Destinatário atualizado." : "Destinatário cadastrado.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao salvar destinatário.");
    } finally {
      setSavingRecipient(false);
    }
  }

  async function submitSchedule(event: FormEvent) {
    event.preventDefault();
    setSavingSchedule(true);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/relatorios/agenda", {
        method: editingScheduleId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...scheduleForm,
          id: editingScheduleId,
          sendEmail: scheduleForm.active,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Erro ao salvar agenda.");
      resetScheduleForm();
      await loadAll();
      setMessage(editingScheduleId ? "Agenda atualizada." : "Agenda criada.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao salvar agenda.");
    } finally {
      setSavingSchedule(false);
    }
  }

  function toggleWeekday(day: number) {
    setScheduleForm((current) => {
      const exists = current.weekdays.includes(day);
      const weekdays = exists
        ? current.weekdays.filter((item) => item !== day)
        : [...current.weekdays, day];
      return { ...current, weekdays: weekdays.length > 0 ? weekdays : [day] };
    });
  }

  function toggleScheduleRecipient(recipientId: number) {
    setScheduleForm((current) => {
      const exists = current.recipientIds.includes(recipientId);
      return {
        ...current,
        recipientIds: exists
          ? current.recipientIds.filter((id) => id !== recipientId)
          : [...current.recipientIds, recipientId],
      };
    });
  }

  async function toggleRecipient(recipient: ReportRecipient, field: keyof Pick<ReportRecipient, "active" | "receivesScheduledEmail">) {
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
      if (editingRecipientId === recipient.id) resetRecipientForm();
      await loadAll();
      setMessage("Destinatário removido.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao remover destinatário.");
    }
  }

  async function removeSchedule(schedule: ReportSchedule) {
    if (!schedule.id || !window.confirm(`Remover a agenda "${schedule.name}"?`)) return;
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/relatorios/agenda?id=${schedule.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Erro ao remover agenda.");
      if (editingScheduleId === schedule.id) resetScheduleForm();
      await loadAll();
      setMessage("Agenda removida.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao remover agenda.");
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-900">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <header className="flex flex-col justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm md:flex-row md:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Configurações de relatórios</p>
            <h1 className="text-xl font-bold text-slate-950">Envios programados</h1>
          </div>
          <button
            type="button"
            onClick={loadAll}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw size={15} />
            Atualizar
          </button>
        </header>

        <section className="grid gap-3 md:grid-cols-3">
          <MetricCard label="Destinatários ativos" value={activeRecipients.length} />
          <MetricCard label="Agendas ativas" value={activeSchedules.length} />
          <MetricCard label="Total cadastrado" value={recipients.length} />
        </section>

        {message && (
          <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm">
            {message}
          </div>
        )}

        <section className="grid gap-4 xl:grid-cols-[420px_1fr]">
          <form onSubmit={submitSchedule} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <SectionHeader icon={<CalendarClock size={16} />} title={editingScheduleId ? "Editar agenda" : "Nova agenda"} subtitle="Tipo de relatório, frequência e destinatários." />

            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Nome da agenda</span>
                <input
                  value={scheduleForm.name}
                  onChange={(event) => setScheduleForm((current) => ({ ...current, name: event.target.value }))}
                  className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                  placeholder="Ex.: Diretoria semanal"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Tipo de relatório</span>
                <select
                  value="RELATORIO_GERAL_PENDENCIAS"
                  disabled
                  className="h-9 w-full rounded-md border border-slate-300 bg-slate-50 px-2 text-sm text-slate-600"
                >
                  <option value="RELATORIO_GERAL_PENDENCIAS">Relatório Geral de Pendências</option>
                </select>
              </label>

              <div className="grid grid-cols-[1fr_120px] gap-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-slate-600">Frequência</span>
                  <select
                    value={scheduleForm.frequency}
                    onChange={(event) => setScheduleForm((current) => ({ ...current, frequency: event.target.value as ReportSchedule["frequency"] }))}
                    className="h-9 w-full rounded-md border border-slate-300 px-2 text-sm outline-none focus:border-slate-500"
                  >
                    <option value="daily">Diário</option>
                    <option value="weekly">Semanal</option>
                    <option value="monthly">Mensal</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-slate-600">Horário</span>
                  <input
                    type="time"
                    value={scheduleForm.timeOfDay}
                    onChange={(event) => setScheduleForm((current) => ({ ...current, timeOfDay: event.target.value }))}
                    className="h-9 w-full rounded-md border border-slate-300 px-2 text-sm outline-none focus:border-slate-500"
                  />
                </label>
              </div>

              {scheduleForm.frequency === "weekly" ? (
                <div>
                  <span className="mb-1 block text-xs font-semibold text-slate-600">Dias da semana</span>
                  <div className="flex flex-wrap gap-1">
                    {weekDays.map((day) => (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => toggleWeekday(day.value)}
                        className={`h-8 rounded-md border px-3 text-xs font-bold ${
                          scheduleForm.weekdays.includes(day.value)
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : scheduleForm.frequency === "monthly" ? (
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-slate-600">Dia do mês</span>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={scheduleForm.dayOfMonth || 1}
                    onChange={(event) => setScheduleForm((current) => ({ ...current, dayOfMonth: Number(event.target.value) }))}
                    className="h-9 w-28 rounded-md border border-slate-300 px-2 text-sm outline-none focus:border-slate-500"
                  />
                </label>
              ) : null}

              <div className="grid grid-cols-2 gap-2">
                <ToggleField
                  label="Ativa"
                  checked={scheduleForm.active}
                  onChange={(checked) => setScheduleForm((current) => ({ ...current, active: checked }))}
                />
                <ToggleField
                  label="Salvar snapshot"
                  checked={scheduleForm.saveSnapshot}
                  onChange={(checked) => setScheduleForm((current) => ({ ...current, saveSnapshot: checked }))}
                />
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600">Destinatários desta agenda</span>
                  <button
                    type="button"
                    onClick={() => setScheduleForm((current) => ({ ...current, recipientIds: activeRecipients.map((recipient) => recipient.id) }))}
                    className="text-xs font-semibold text-slate-600 hover:text-slate-950"
                  >
                    marcar ativos
                  </button>
                </div>
                <div className="max-h-44 overflow-y-auto rounded-md border border-slate-200">
                  {activeRecipients.length === 0 ? (
                    <div className="px-3 py-6 text-center text-xs text-slate-500">Cadastre destinatários ativos para montar uma agenda.</div>
                  ) : (
                    activeRecipients.map((recipient) => (
                      <label key={recipient.id} className="flex cursor-pointer items-center gap-2 border-b border-slate-100 px-3 py-2 text-xs last:border-b-0 hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={scheduleForm.recipientIds.includes(recipient.id)}
                          onChange={() => toggleScheduleRecipient(recipient.id)}
                          className="h-4 w-4 accent-slate-900"
                        />
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-slate-800">{recipient.name}</span>
                          <span className="block truncate font-mono text-[11px] text-slate-500">{recipient.email}</span>
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="submit"
                disabled={savingSchedule}
                className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-md bg-slate-900 px-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save size={15} />
                {savingSchedule ? "Salvando..." : editingScheduleId ? "Salvar agenda" : "Criar agenda"}
              </button>
              {editingScheduleId && (
                <button
                  type="button"
                  onClick={resetScheduleForm}
                  className="h-9 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>

          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-3">
              <SectionHeader icon={<CalendarClock size={16} />} title="Agendas cadastradas" subtitle="Cada agenda dispara seu próprio grupo de destinatários." />
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-[11px] font-bold uppercase text-slate-500">Agenda</th>
                    <th className="px-3 py-2 text-left text-[11px] font-bold uppercase text-slate-500">Frequência</th>
                    <th className="px-3 py-2 text-center text-[11px] font-bold uppercase text-slate-500">Dest.</th>
                    <th className="px-3 py-2 text-center text-[11px] font-bold uppercase text-slate-500">Status</th>
                    <th className="px-3 py-2 text-right text-[11px] font-bold uppercase text-slate-500">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr><td className="px-3 py-8 text-center text-slate-500" colSpan={5}>Carregando agendas...</td></tr>
                  ) : schedules.length === 0 ? (
                    <tr><td className="px-3 py-8 text-center text-slate-500" colSpan={5}>Nenhuma agenda cadastrada.</td></tr>
                  ) : (
                    schedules.map((schedule) => (
                      <tr key={schedule.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2">
                          <div className="font-semibold text-slate-950">{schedule.name}</div>
                          <div className="text-xs text-slate-500">Último envio: {formatDateTime(schedule.lastRunAt)}</div>
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-600">{formatSchedule(schedule)}</td>
                        <td className="px-3 py-2 text-center font-mono text-xs">{schedule.recipientIds.length}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${schedule.active && schedule.sendEmail ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                            {schedule.active && schedule.sendEmail ? "Ativa" : "Pausada"}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => startEditSchedule(schedule)}
                            className="mr-2 rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => removeSchedule(schedule)}
                            className="inline-flex items-center rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                            aria-label={`Remover ${schedule.name}`}
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

        <section className="grid gap-4 xl:grid-cols-[420px_1fr]">
          <form onSubmit={submitRecipient} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <SectionHeader icon={<Mail size={16} />} title={editingRecipientId ? "Editar destinatário" : "Novo destinatário"} subtitle="Cadastro base usado nas agendas." />

            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Nome</span>
                <input
                  value={recipientForm.name}
                  onChange={(event) => setRecipientForm((current) => ({ ...current, name: event.target.value }))}
                  className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                  placeholder="Nome do destinatário"
                  required
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600">E-mail</span>
                <input
                  type="email"
                  value={recipientForm.email}
                  onChange={(event) => setRecipientForm((current) => ({ ...current, email: event.target.value }))}
                  className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                  placeholder="nome@empresa.com"
                  required
                />
              </label>

              <div className="grid grid-cols-2 gap-2">
                <ToggleField
                  label="Ativo"
                  checked={recipientForm.active}
                  onChange={(checked) => setRecipientForm((current) => ({ ...current, active: checked }))}
                />
                <ToggleField
                  label="Elegível para agenda"
                  checked={recipientForm.receivesScheduledEmail}
                  onChange={(checked) => setRecipientForm((current) => ({ ...current, receivesScheduledEmail: checked }))}
                />
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="submit"
                disabled={savingRecipient}
                className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-md bg-slate-900 px-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {editingRecipientId ? <Save size={15} /> : <Plus size={15} />}
                {savingRecipient ? "Salvando..." : editingRecipientId ? "Salvar" : "Adicionar"}
              </button>
              {editingRecipientId && (
                <button
                  type="button"
                  onClick={resetRecipientForm}
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
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-[11px] font-bold uppercase text-slate-500">Nome</th>
                    <th className="px-3 py-2 text-left text-[11px] font-bold uppercase text-slate-500">E-mail</th>
                    <th className="px-3 py-2 text-center text-[11px] font-bold uppercase text-slate-500">Ativo</th>
                    <th className="px-3 py-2 text-center text-[11px] font-bold uppercase text-slate-500">Elegível</th>
                    <th className="px-3 py-2 text-right text-[11px] font-bold uppercase text-slate-500">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr><td className="px-3 py-8 text-center text-slate-500" colSpan={5}>Carregando destinatários...</td></tr>
                  ) : filteredRecipients.length === 0 ? (
                    <tr><td className="px-3 py-8 text-center text-slate-500" colSpan={5}>Nenhum destinatário encontrado.</td></tr>
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
                        <td className="whitespace-nowrap px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => startEditRecipient(recipient)}
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

function formatDateTime(value: string | null) {
  if (!value) return "nunca";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function formatSchedule(schedule: ReportSchedule) {
  const time = schedule.timeOfDay;
  if (schedule.frequency === "daily") return `Diário às ${time}`;
  if (schedule.frequency === "monthly") return `Dia ${schedule.dayOfMonth || 1}, às ${time}`;
  const labels = weekDays.filter((day) => schedule.weekdays.includes(day.value)).map((day) => day.label).join(", ");
  return `${labels || "Sem dia"} às ${time}`;
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 font-mono text-2xl font-bold text-slate-950">{value}</p>
    </div>
  );
}

function SectionHeader({ icon, title, subtitle }: { icon: ReactNode; title: string; subtitle: string }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-900 text-white">
        {icon}
      </div>
      <div>
        <h2 className="text-sm font-bold text-slate-950">{title}</h2>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </div>
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
