
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const notificacoes = await prisma.historicoRemanejamento.findMany({
      take: 20,
      orderBy: {
        dataAcao: "desc",
      },
      include: {
        solicitacao: {
          select: {
            id: true,
            contratoDestino: {
              select: {
                nome: true,
              },
            },
          },
        },
        remanejamentoFuncionario: {
          select: {
            id: true,
            funcionario: {
              select: {
                nome: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(notificacoes);
  } catch (error) {
    console.error("Erro ao buscar notificações:", error);
    return NextResponse.json(
      { error: "Erro ao buscar notificações" },
      { status: 500 }
    );
  }
}
