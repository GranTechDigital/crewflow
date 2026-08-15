import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const remanejamentoId = searchParams.get("remanejamentoId")?.trim();
    const funcionarioIdRaw = searchParams.get("funcionarioId")?.trim();
    const funcionarioId = funcionarioIdRaw ? Number(funcionarioIdRaw) : null;
    const matricula = searchParams.get("matricula")?.trim();
    const nome = searchParams.get("nome")?.trim();
    const setor = searchParams.get("setor")?.trim();
    const status = searchParams.get("status")?.trim();
    const origem = searchParams.get("origem")?.trim();
    const tipoCiclo = searchParams.get("tipoCiclo")?.trim();
    const confianca = searchParams.get("confianca")?.trim();
    const multiCiclo = searchParams.get("multiCiclo") === "1";
    const limitRaw = Number(searchParams.get("limit") || "50");
    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(limitRaw, 1), 200)
      : 50;

    const where: any = {};
    if (remanejamentoId) where.remanejamentoFuncionarioId = remanejamentoId;
    if (setor && setor !== "TODOS") where.setor = setor;
    if (status && status !== "TODOS") {
      where.status = status;
    } else {
      where.status = { not: "IGNORADO" };
    }
    if (origem && origem !== "TODOS") where.origem = origem;
    if (tipoCiclo && tipoCiclo !== "TODOS") where.tipoCiclo = tipoCiclo;
    if (confianca && confianca !== "TODOS") where.confianca = confianca;

    if (multiCiclo) {
      const remanejamentosMultiCiclo = await prisma.remanejamentoCiclo.groupBy({
        by: ["remanejamentoFuncionarioId"],
        where: { status: { not: "IGNORADO" } },
        _max: { numeroCiclo: true },
        orderBy: { remanejamentoFuncionarioId: "asc" },
        having: {
          numeroCiclo: {
            _max: { gt: 1 },
          },
        },
      });
      const idsMultiCiclo = remanejamentosMultiCiclo.map(
        (item) => item.remanejamentoFuncionarioId,
      );

      where.remanejamentoFuncionarioId = remanejamentoId
        ? { in: idsMultiCiclo.filter((id) => id === remanejamentoId) }
        : { in: idsMultiCiclo };
    }

    if (funcionarioId || matricula || nome) {
      where.remanejamentoFuncionario = {
        funcionario: {
          ...(funcionarioId ? { id: funcionarioId } : {}),
          ...(matricula ? { matricula } : {}),
          ...(nome ? { nome: { contains: nome, mode: "insensitive" } } : {}),
        },
      };
    }

    const [totalGeral, ciclos] = await Promise.all([
      prisma.remanejamentoCiclo.count({ where }),
      prisma.remanejamentoCiclo.findMany({
        where,
        orderBy: [
          { remanejamentoFuncionarioId: "asc" },
          { numeroCiclo: "asc" },
          { setor: "asc" },
        ],
        take: limit,
        include: {
          remanejamentoFuncionario: {
            select: {
              id: true,
              statusTarefas: true,
              statusPrestserv: true,
              dataAprovado: true,
              dataConcluido: true,
              dataCancelado: true,
              funcionario: {
                select: {
                  id: true,
                  nome: true,
                  matricula: true,
                  funcao: true,
                },
              },
              solicitacao: {
                select: {
                  id: true,
                  tipo: true,
                },
              },
            },
          },
          eventos: {
            orderBy: { dataEvento: "asc" },
            take: 50,
          },
        },
      }),
    ]);

    const resumo = ciclos.reduce(
      (acc, ciclo) => {
        acc.porStatus[ciclo.status] = (acc.porStatus[ciclo.status] || 0) + 1;
        acc.porSetor[ciclo.setor] = (acc.porSetor[ciclo.setor] || 0) + 1;
        acc.porOrigem[ciclo.origem] = (acc.porOrigem[ciclo.origem] || 0) + 1;
        return acc;
      },
      {
        porStatus: {} as Record<string, number>,
        porSetor: {} as Record<string, number>,
        porOrigem: {} as Record<string, number>,
      },
    );

    return NextResponse.json({
      total: ciclos.length,
      totalGeral,
      resumo,
      ciclos,
    });
  } catch (error) {
    console.error("Erro ao consultar ciclos de remanejamento:", error);
    return NextResponse.json(
      { error: "Erro ao consultar ciclos de remanejamento" },
      { status: 500 },
    );
  }
}
