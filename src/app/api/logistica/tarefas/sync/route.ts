import { NextRequest, NextResponse } from "next/server";
import { sincronizarTarefasPadrao } from "@/lib/tarefasPadraoSync";
import { prisma } from "@/lib/prisma";
/**
 * POST - Sincronizar tarefas dos remanejamentos com matriz/padrões
 * Body opcional:
 * - setores?: string[] (default: ["TREINAMENTO", "RH", "MEDICINA"])
 * - funcionarioIds?: number[]
 * - remanejamentoIds?: string[]
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const setores: string[] =
      Array.isArray(body?.setores) && body.setores.length > 0
        ? body.setores
        : ["TREINAMENTO", "RH", "MEDICINA"];
    const funcionarioIds: number[] | undefined = Array.isArray(
      body?.funcionarioIds
    )
      ? body.funcionarioIds
      : undefined;
    const remanejamentoIds: string[] | undefined = Array.isArray(
      body?.remanejamentoIds
    )
      ? body.remanejamentoIds
      : undefined;

    const { getUserFromRequest } = await import("@/utils/authUtils");
    const user = await getUserFromRequest(request).catch(() => null);

    const result = await sincronizarTarefasPadrao({
      setores,
      usuarioResponsavel:
        user?.funcionario?.nome || "Sistema - Sincronização Manual",
      usuarioResponsavelId: user?.id,
      equipeId: user?.equipeId,
      funcionarioIds,
      remanejamentoIds,
      // Sincronização manual não cria tarefas novas; apenas alinha com a matriz/padrões (cancelar/reativar)
      criarFaltantes: false,
      verbose: true,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Erro na sincronização de tarefas:", error);
    return NextResponse.json(
      { message: "Erro interno ao sincronizar tarefas" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ status: "ok" });
}
