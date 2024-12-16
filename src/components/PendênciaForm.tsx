"use client";

import { useState, useMemo } from "react";
import { Funcionario } from "@/types/pendencias";
import {
  Combobox,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
  ComboboxButton
} from "@headlessui/react";

type Props = {
  funcionarios: Funcionario[];
  onSubmitSuccess: () => void;
};

export default function PendenciaForm({ funcionarios, onSubmitSuccess }: Props) {
  const [form, setForm] = useState({
    funcionarioId: null as number | null,
    tipo: "",
    descricao: "",
    equipe: "RH",
    status: "Pendente",
    prioridade: "Média",
    dataLimite: "",
  });
  const [query, setQuery] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() =>
    funcionarios.filter(f =>
      f.nome.toLowerCase().includes(query.toLowerCase()) ||
      f.matricula.toLowerCase().includes(query.toLowerCase())
    )
  , [funcionarios, query]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.funcionarioId) {
      setMsg("Selecione um funcionário.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        dataLimite: form.dataLimite ? new Date(form.dataLimite) : undefined,
        criadoPor: "Logistica",
        atualizadoPor: "Logistica",
      };
      const res = await fetch("/api/pendencias", {
        method: "POST",
        headers: { "Content-Type": "application/json"},
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setMsg("Pendência criada!");
        setForm({
          funcionarioId: null,
          tipo: "",
          descricao: "",
          equipe: "RH",
          status: "Pendente",
          prioridade: "Média",
          dataLimite: "",
        });
        setQuery("");
        onSubmitSuccess();
      } else {
        const err = await res.json();
        setMsg(err.error || "Erro!");
      }
    } catch {
      setMsg("Problemas ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white p-4 shadow rounded border space-y-4">
      <h2 className="text-lg font-semibold">Nova Pendência</h2>

      <div>
        <label>Funcionário</label>
        <Combobox
          value={form.funcionarioId}
          onChange={(value: number) => setForm(f => ({ ...f, funcionarioId: value }))}
        >
          <div className="relative">
            <ComboboxInput
              className="w-full border rounded px-2"
              placeholder="Digite nome ou matrícula..."
              onChange={e => setQuery(e.target.value)}
              displayValue={(id) => {
                const sel = funcionarios.find(f => f.id === id);
                return sel ? `${sel.nome} (${sel.matricula})` : "";
              }}
            />
            <ComboboxButton className="absolute inset-y-0 right-0 pr-2">⌄</ComboboxButton>
          </div>

          {filtered.length > 0 && (
            <ComboboxOptions className="border max-h-60 overflow-auto mt-1 bg-white shadow rounded">
              {filtered.map(f => (
                <ComboboxOption key={f.id} value={f.id} className="p-2 hover:bg-blue-500 hover:text-white">
                  {f.nome} ({f.matricula})
                </ComboboxOption>
              ))}
            </ComboboxOptions>
          )}
        </Combobox>
      </div>

      <div>
        <label>Tipo</label>
        <input
          className="w-full border rounded px-2"
          required
          value={form.tipo}
          onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label>Prioridade</label>
          <select
            className="w-full border rounded px-2"
            value={form.prioridade}
            onChange={e => setForm(f => ({ ...f, prioridade: e.target.value }))}
          >
            {["Baixa","Média","Alta","Urgente"].map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label>Equipe</label>
          <select
            className="w-full border rounded px-2"
            value={form.equipe}
            onChange={e => setForm(f => ({ ...f, equipe: e.target.value }))}
          >
            {["Medicina","RH","Treinamento"].map(eq => <option key={eq}>{eq}</option>)}
          </select>
        </div>
        <div>
          <label>Status</label>
          <select
            className="w-full border rounded px-2"
            value={form.status}
            onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
          >
            {["Pendente","Em Andamento","Concluída","Cancelada"].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label>Data Limite</label>
        <input
          type="date"
          className="w-full border rounded px-2"
          value={form.dataLimite}
          onChange={e => setForm(f => ({ ...f, dataLimite: e.target.value }))}
        />
      </div>

      <div>
        <label>Descrição</label>
        <textarea
          className="w-full border rounded px-2"
          rows={2}
          value={form.descricao}
          onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
        />
      </div>

      <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded" disabled={saving}>
        {saving ? "Salvando..." : "Criar Pendência"}
      </button>

      {msg && <p className="text-red-600">{msg}</p>}
    </form>
  );
}
