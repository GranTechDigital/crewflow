import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [tiposRaw, contratosRaw] = await Promise.all([
      prisma.tarefaRemanejamento.findMany({
        where: {
          status: { not: "CANCELADO" },
          remanejamentoFuncionario: {
            statusTarefas: "ATENDER TAREFAS",
          },
        },
        select: { tipo: true },
        distinct: ["tipo"],
        orderBy: { tipo: "asc" },
      }),
      prisma.contrato.findMany({
        select: { id: true, numero: true, nome: true },
        orderBy: { numero: "asc" },
      }),
    ]);

    return NextResponse.json({
      tipos: tiposRaw.map((item) => item.tipo).filter(Boolean),
      contratos: contratosRaw,
      setores: ["RH", "MEDICINA", "TREINAMENTO"],
      prioridades: ["ALTA", "MEDIA", "BAIXA", "Normal"],
      status: ["PENDENTE", "CONCLUIDO", "REPROVADO"],
    });
  } catch (error) {
    console.error("Erro ao carregar filtros da tarefas v2:", error);
    return NextResponse.json(
      { error: "Erro ao carregar filtros da tarefas v2" },
      { status: 500 },
    );
  }
}
