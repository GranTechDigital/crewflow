import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sincronizarEventosCadastroExterno } from "@/lib/integracoes/cadastroEventos";

export const dynamic = "force-dynamic";

type Payload = {
  remanejamentoFuncionarioId?: string;
  cicloId?: string;
  ambiente?: string;
  dryRun?: boolean;
  reenfileirarMesmoPayload?: boolean;
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(Number(searchParams.get("limit") || 50), 1), 200);
    const remanejamentoFuncionarioId =
      searchParams.get("remanejamentoFuncionarioId")?.trim() || undefined;
    const status = searchParams.get("status")?.trim() || undefined;
    const provedor = searchParams.get("provedor")?.trim() || "DRAKE";
    const ambiente =
      searchParams.get("ambiente")?.trim().toLowerCase() ||
      process.env.DRAKE_ENVIRONMENT?.trim().toLowerCase() ||
      "dev";

    const where = {
      provedor,
      ...(remanejamentoFuncionarioId ? { remanejamentoFuncionarioId } : {}),
      ...(status && status !== "TODOS" ? { status } : {}),
    };

    const [total, eventos, outboxResumo, inboxResumo] = await Promise.all([
      prisma.integracaoEventoExterno.count({ where }),
      prisma.integracaoEventoExterno.findMany({
        where,
        include: {
          remanejamentoFuncionario: {
            include: {
              funcionario: {
                select: {
                  nome: true,
                  matricula: true,
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
          ciclo: {
            select: {
              numeroCiclo: true,
              setor: true,
              status: true,
              origem: true,
              confianca: true,
            },
          },
          outbox: {
            where: { ambiente },
            orderBy: { createdAt: "desc" },
            take: 3,
            select: {
              id: true,
              status: true,
              tentativas: true,
              ultimoErro: true,
              proximaTentativaAt: true,
              sentAt: true,
              createdAt: true,
              payload: true,
            },
          },
        },
        orderBy: [{ updatedAt: "desc" }],
        take: limit,
      }),
      prisma.integracaoOutbox.groupBy({
        by: ["status"],
        where: { provedor, ambiente },
        _count: { _all: true },
      }),
      prisma.integracaoInbox.groupBy({
        by: ["status"],
        where: { provedor },
        _count: { _all: true },
      }),
    ]);

    return NextResponse.json({
      total,
      resumoOutbox: outboxResumo.reduce<Record<string, number>>((acc, item) => {
        acc[item.status] = item._count._all;
        return acc;
      }, {}),
      resumoInbox: inboxResumo.reduce<Record<string, number>>((acc, item) => {
        acc[item.status] = item._count._all;
        return acc;
      }, {}),
      eventos,
    });
  } catch (error) {
    console.error("Erro ao consultar eventos externos de cadastro:", error);
    return NextResponse.json(
      { error: "Erro ao consultar eventos externos de cadastro" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Payload;
    const resultado = await sincronizarEventosCadastroExterno({
      remanejamentoFuncionarioId: body.remanejamentoFuncionarioId?.trim() || undefined,
      cicloId: body.cicloId?.trim() || undefined,
      ambiente: body.ambiente?.trim().toLowerCase() || undefined,
      dryRun: body.dryRun === true,
      reenfileirarMesmoPayload: body.reenfileirarMesmoPayload === true,
    });

    return NextResponse.json(resultado);
  } catch (error) {
    console.error("Erro ao sincronizar eventos externos de cadastro:", error);
    return NextResponse.json(
      { error: "Erro ao sincronizar eventos externos de cadastro" },
      { status: 500 },
    );
  }
}
