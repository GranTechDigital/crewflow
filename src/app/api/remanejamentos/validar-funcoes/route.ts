import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/utils/authUtils";
import { verificarFuncoesContrato } from "@/lib/validacaoFuncaoContrato";

export async function POST(request: NextRequest) {
  try {
    if (!await getUserFromRequest(request)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    const { contratoId, funcionarioIds } = await request.json();
    if (!Number.isInteger(contratoId) || contratoId <= 0 || !Array.isArray(funcionarioIds) || funcionarioIds.some((id: unknown) => !Number.isInteger(id) || Number(id) <= 0)) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }
    return NextResponse.json({ bloqueados: await verificarFuncoesContrato(contratoId, funcionarioIds) });
  } catch (error) {
    console.error("Erro ao verificar funções do contrato:", error);
    return NextResponse.json({ error: "Não foi possível verificar as funções do contrato." }, { status: 500 });
  }
}
