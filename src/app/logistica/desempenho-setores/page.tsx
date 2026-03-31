import { redirect } from "next/navigation";

export default function DesempenhoSetoresPage() {
  redirect("/logistica/desempenho-usuarios?aba=setores&hideTabs=true");
}
