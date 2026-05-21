import { redirect } from "next/navigation";

export default function RelatorioLogisticaStatusPage() {
  redirect("/logistica/desempenho-usuarios?aba=logistica&hideTabs=true&secao=status-remanejamentos");
}

