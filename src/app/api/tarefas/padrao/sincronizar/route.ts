import { NextRequest, NextResponse } from "next/server";
import { sincronizarTarefasPadrao } from "@/lib/tarefasPadraoSync";
import { prisma } from "@/lib/prisma";

const SETORES_VALIDOS = ["RH", "MEDICINA", "TREINAMENTO"] as const;
type SetorValido = (typeof SETORES_VALIDOS)[number];

function normalizarSetor(setor: string): SetorValido | null {
  const s = (setor || "").toUpperCase();
  return SETORES_VALIDOS.includes(s as SetorValido) ? (s as SetorValido) : null;
}

// Monta chave única por tarefa-responsável
function chaveTarefa(tipo: string, responsavel: string) {
  return `${responsavel}|${tipo}`.toUpperCase();
}

export async function POST(request: NextRequest) {
  const { getUserFromRequest } = await import("@/utils/authUtils");
  const usuarioAutenticado = await getUserFromRequest(request);

  try {
    const body = await request.json().catch(() => ({}));
    const setoresInput: string[] = Array.isArray(body?.setores) ? body.setores : [];
    const remanejamentoIds: string[] = Array.isArray(body?.remanejamentoIds) ? body.remanejamentoIds : [];

    const resultado = await sincronizarTarefasPadrao({
      setores: setoresInput,
      usuarioResponsavel: usuarioAutenticado?.funcionario?.nome || "Sistema",
      remanejamentoIds,
    });

    return NextResponse.json(resultado);
  } catch (error) {
    console.error("Erro na sincronização de tarefas:", error);
    return NextResponse.json({ error: "Erro interno ao sincronizar tarefas" }, { status: 500 });
  }
}