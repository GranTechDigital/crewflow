import { redirect } from "next/navigation";

export default function RelatorioLogisticaDesempenhoPage() {
  redirect("/logistica/desempenho-usuarios?aba=logistica&hideTabs=true&secao=desempenho");
}

