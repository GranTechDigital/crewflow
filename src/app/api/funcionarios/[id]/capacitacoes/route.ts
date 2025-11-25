import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const funcionarioId = parseInt(id, 10);
    if (isNaN(funcionarioId)) {
      return NextResponse.json(
        { error: "ID do funcionário inválido" },
        { status: 400 }
      );
    }

    const capacitacoes = await prisma.funcionarioCapacitacao.findMany({
      where: { funcionarioId },
      orderBy: [{ dataVencimento: "asc" }, { dataConclusao: "desc" }],
      include: {
        tarefaPadrao: true,
        treinamento: true,
        origemRemanejamento: {
          select: { id: true, solicitacaoId: true }
        },
      },
    });

    return NextResponse.json({ funcionarioId, capacitacoes });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json(
      { error: "Falha ao listar capacitações", details: message },
      { status: 500 }
    );
  }
}