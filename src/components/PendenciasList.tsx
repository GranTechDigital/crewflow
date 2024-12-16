"use client";

import { Pendencia } from "@/types/pendencias";

type Props = {
  pendencias?: Pendencia[]; // ← marcamos como opcional
  loading: boolean;
};

export default function PendenciasList({ pendencias = [], loading }: Props) {
  if (loading) return <p>Carregando pendências...</p>;
  if (!pendencias || pendencias.length === 0) return <p>Sem pendências.</p>;

  return (
    <table className="w-full bg-white shadow rounded divide-y">
      <thead className="bg-gray-100">
        <tr>
          {["Funcionário","Equipe","Tipo","Status","Prioridade","Data Limite","Descrição"].map(c => (
            <th key={c} className="p-2 text-left">{c}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {pendencias.map(p => (
          <tr key={p.id} className="hover:bg-gray-50">
            <td className="p-2">{p.funcionario?.nome || p.funcionarioId}</td>
            <td className="p-2">{p.equipe}</td>
            <td className="p-2">{p.tipo}</td>
            <td className="p-2">{p.status}</td>
            <td className="p-2">{p.prioridade}</td>
            <td className="p-2">{p.dataLimite ? new Date(p.dataLimite).toLocaleDateString() : "-"}</td>
            <td className="p-2">{p.descricao}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
