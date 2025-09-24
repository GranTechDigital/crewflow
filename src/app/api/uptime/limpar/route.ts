import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getUserFromRequest } from "@/utils/authUtils";

// Evitar múltiplas instâncias do Prisma no ambiente de desenvolvimento do Next.js
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

    // Limpar todos os registros da tabela UptimeSheet
    const deletedCount = await prisma.uptimeSheet.deleteMany({});

    // Registrar no histórico
    await prisma.historicoRemanejamento.create({
      data: {
        tipoAcao: "LIMPEZA_UPTIME",
        entidade: "UptimeSheet",
        descricaoAcao: `Limpeza de todos os registros da tabela UptimeSheet`,
        usuarioResponsavel: usuario.funcionario.nome || "Sistema",
        dataAcao: new Date(),
        observacoes: `${deletedCount.count} registros removidos`,
      },
    });

    return NextResponse.json({
      message: "Dados de Uptime limpos com sucesso",
      registrosRemovidos: deletedCount.count,
    });
  } catch (error: any) {
    console.error("Erro ao limpar dados de Uptime:", error);
    return NextResponse.json(
      { message: `Erro ao limpar dados: ${error.message}` },
      { status: 500 }
    );
  }
}