import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const diasParam = searchParams.get("dias");
    const funcionarioParam = searchParams.get("funcionarioId");
    const dias = diasParam ? parseInt(diasParam, 10) : 30;
    const funcionarioId = funcionarioParam ? parseInt(funcionarioParam, 10) : undefined;
    if (dias <= 0) {
      return NextResponse.json({ error: "'dias' deve ser > 0" }, { status: 400 });
    }

    const agora = new Date();
    const limite = new Date(agora.getTime() + dias * 24 * 60 * 60 * 1000);

    const where: any = {
      dataVencimento: { gte: agora, lte: limite },
    };
    if (!isNaN(funcionarioId as number) && funcionarioId !== undefined) {
      where.funcionarioId = funcionarioId;
    }

    const proximos = await prisma.funcionarioCapacitacao.findMany({
      where,
      orderBy: [{ dataVencimento: "asc" }],
      include: {
        tarefaPadrao: true,
        treinamento: true,
        funcionario: { select: { id: true, nome: true, matricula: true } },
      },
    });

    const resultado = proximos.map((c) => {
      const diasRestantes = c.dataVencimento
        ? Math.ceil((c.dataVencimento.getTime() - agora.getTime()) / (24 * 60 * 60 * 1000))
        : null;
      return {
        id: c.id,
        funcionario: c.funcionario,
        tipo: c.tipo,
        responsavel: c.responsavel,
        tarefaPadraoId: c.tarefaPadraoId,
        treinamentoId: c.treinamentoId,
        dataVencimento: c.dataVencimento,
        diasRestantes,
      };
    });

    return NextResponse.json({ dias, resultado });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json(
      { error: "Falha ao listar vencimentos de capacitações", details: message },
      { status: 500 }
    );
  }
}