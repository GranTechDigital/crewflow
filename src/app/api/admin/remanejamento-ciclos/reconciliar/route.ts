import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { reconciliarCiclosRemanejamento } from "@/lib/remanejamentoCiclos";
import { getUserFromRequest } from "@/utils/authUtils";

export const dynamic = "force-dynamic";

type Payload = {
  remanejamentoIds?: string[];
  limit?: number;
  incluirCancelados?: boolean;
  dryRun?: boolean;
};

type ResultadoReconciliacao = {
  id: string;
  ok: boolean;
  dryRun?: boolean;
  ciclosAntes?: number;
  ciclosDepois?: number;
  eventosAntes?: number;
  eventosDepois?: number;
  ciclosCriados?: number;
  eventosCriados?: number;
  error?: string;
};

class DryRunRollback extends Error {
  constructor(readonly resultado: ResultadoReconciliacao) {
    super("DRY_RUN_ROLLBACK");
  }
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  try {
    const usuario = await getUserFromRequest(request);
    const body = (await request.json().catch(() => ({}))) as Payload;
    const idsInformados = Array.isArray(body.remanejamentoIds)
      ? body.remanejamentoIds.map((id) => String(id).trim()).filter(Boolean)
      : [];

    const limit = Number.isFinite(Number(body.limit))
      ? Math.min(Math.max(Number(body.limit), 1), 500)
      : 100;
    const dryRun = body.dryRun === true;

    const remanejamentos =
      idsInformados.length > 0
        ? await prisma.remanejamentoFuncionario.findMany({
            where: { id: { in: idsInformados } },
            select: { id: true },
            orderBy: { updatedAt: "desc" },
          })
        : await prisma.remanejamentoFuncionario.findMany({
            where: body.incluirCancelados
              ? undefined
              : {
                  statusTarefas: { not: "CANCELADO" },
                  statusPrestserv: { not: "CANCELADO" },
                },
            select: { id: true },
            orderBy: { updatedAt: "desc" },
            take: limit,
          });

    const resultados: ResultadoReconciliacao[] = [];

    for (const rem of remanejamentos) {
      try {
        if (dryRun) {
          await prisma.$transaction(async (tx) => {
            const [ciclosAntes, eventosAntes] = await Promise.all([
              tx.remanejamentoCiclo.count({
                where: { remanejamentoFuncionarioId: rem.id },
              }),
              tx.remanejamentoCicloEvento.count({
                where: { remanejamentoFuncionarioId: rem.id },
              }),
            ]);

            await reconciliarCiclosRemanejamento(rem.id, {
              db: tx,
              usuarioResponsavelId: usuario?.id ?? null,
              motivo: "Dry-run de reconciliacao administrativa de ciclos",
            });

            const [ciclosDepois, eventosDepois] = await Promise.all([
              tx.remanejamentoCiclo.count({
                where: { remanejamentoFuncionarioId: rem.id },
              }),
              tx.remanejamentoCicloEvento.count({
                where: { remanejamentoFuncionarioId: rem.id },
              }),
            ]);

            throw new DryRunRollback({
              id: rem.id,
              ok: true,
              dryRun: true,
              ciclosAntes,
              ciclosDepois,
              eventosAntes,
              eventosDepois,
              ciclosCriados: Math.max(ciclosDepois - ciclosAntes, 0),
              eventosCriados: Math.max(eventosDepois - eventosAntes, 0),
            });
          });
        } else {
          await reconciliarCiclosRemanejamento(rem.id, {
            usuarioResponsavelId: usuario?.id ?? null,
            motivo: "Reconciliacao administrativa de ciclos",
          });
          resultados.push({ id: rem.id, ok: true });
        }
      } catch (error) {
        if (error instanceof DryRunRollback) {
          resultados.push(error.resultado);
          continue;
        }

        resultados.push({
          id: rem.id,
          ok: false,
          error: error instanceof Error ? error.message : "Erro desconhecido",
        });
      }
    }

    const totalSucesso = resultados.filter((item) => item.ok).length;
    const totalFalha = resultados.length - totalSucesso;

    return NextResponse.json({
      totalProcessado: resultados.length,
      totalSucesso,
      totalFalha,
      dryRun,
      durationMs: Date.now() - startedAt,
      resultados,
    });
  } catch (error) {
    console.error("Erro ao reconciliar ciclos administrativamente:", error);
    return NextResponse.json(
      { error: "Erro ao reconciliar ciclos" },
      { status: 500 },
    );
  }
}
