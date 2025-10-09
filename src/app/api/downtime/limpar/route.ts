import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getUserFromRequest } from "@/utils/authUtils";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export async function DELETE(request: NextRequest) {
  try {
    const usuario = await getUserFromRequest(request);
    if (!usuario) {
      return NextResponse.json(
        { message: "Você precisa estar logado para realizar esta ação" },
        { status: 401 }
      );
    }

    // Contar registros antes de deletar
    const count = await prisma.downtimeSheet.count();

    await prisma.$transaction(async (tx) => {
      // Deletar todos os registros de downtime
      await tx.downtimeSheet.deleteMany({});

      // Registrar no histórico
      await tx.historicoRemanejamento.create({
        data: {
          tipoAcao: "LIMPAR_DOWNTIME_PROJETO",
          entidade: "DowntimeSheet",
          descricaoAcao: `Limpeza de dados de Downtime por Projeto - ${count} registros removidos`,
          usuarioResponsavel: usuario.funcionario.nome || "Sistema",
          dataAcao: new Date(),
          observacoes: `Todos os registros de downtime por projeto foram removidos pelo usuário`,
        },
      });
    });

    return NextResponse.json({
      message: `${count} registros de downtime foram removidos com sucesso`,
      registrosRemovidos: count,
    });
  } catch (error: unknown) {
    console.error("Erro ao limpar dados de downtime:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json(
      { error: "Erro interno do servidor", details: errorMessage },
      { status: 500 }
    );
  }
}