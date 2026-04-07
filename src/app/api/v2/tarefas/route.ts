import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 60;
const MAX_LIMIT = 200;
const RESPONSAVEIS_PERMITIDOS = ["RH", "MEDICINA", "TREINAMENTO"] as const;
const MIN_SEARCH_LENGTH = 2;

type CursorPaginacao = {
  dataCriacao: Date;
  id: string;
};

function parseLimit(raw: string | null): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  if (parsed < 1) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
}

function parseLista(
  searchParams: URLSearchParams,
  key: string,
): string[] {
  const values = searchParams
    .getAll(key)
    .flatMap((entry) => entry.split(","))
    .map((entry) => entry.trim())
    .filter(Boolean);

  return Array.from(new Set(values));
}

function parseCursor(cursorRaw: string | null): CursorPaginacao | null {
  if (!cursorRaw) return null;
  const [rawDate, ...idParts] = cursorRaw.split("|");
  if (!rawDate || idParts.length === 0) return null;

  const dataCriacao = new Date(rawDate);
  if (Number.isNaN(dataCriacao.getTime())) return null;

  const id = idParts.join("|");
  if (!id) return null;

  return { dataCriacao, id };
}

function montarWhere(searchParams: URLSearchParams): {
  where: Prisma.TarefaRemanejamentoWhereInput;
  filtrosAplicados: Record<string, string | string[] | number | null>;
  limit: number;
} {
  const qRaw = searchParams.get("q")?.trim() || "";
  const q = qRaw.length >= MIN_SEARCH_LENGTH ? qRaw : "";
  const limit = parseLimit(searchParams.get("limit"));
  const statusList = parseLista(searchParams, "status");
  const prioridadeList = parseLista(searchParams, "prioridade");
  const responsavelList = parseLista(searchParams, "responsavel").filter((r) =>
    RESPONSAVEIS_PERMITIDOS.includes(
      r.toUpperCase() as (typeof RESPONSAVEIS_PERMITIDOS)[number],
    ),
  );
  const cursor = parseCursor(searchParams.get("cursor"));

  const andClauses: Prisma.TarefaRemanejamentoWhereInput[] = [
    { status: { not: "CANCELADO" } },
    {
      remanejamentoFuncionario: {
        statusTarefas: "ATENDER TAREFAS",
      },
    },
  ];

  if (statusList.length > 0) {
    andClauses.push({
      status: {
        in: statusList,
        not: "CANCELADO",
      } as Prisma.StringFilter,
    });
  }

  if (prioridadeList.length > 0) {
    andClauses.push({
      prioridade: { in: prioridadeList },
    });
  }

  if (responsavelList.length > 0) {
    andClauses.push({
      responsavel: {
        in: responsavelList.map((r) => r.toUpperCase()),
      },
    });
  }

  if (q) {
    andClauses.push({
      OR: [
        { tipo: { contains: q, mode: "insensitive" } },
        { descricao: { contains: q, mode: "insensitive" } },
        {
          remanejamentoFuncionario: {
            funcionario: {
              nome: { contains: q, mode: "insensitive" },
            },
          },
        },
        {
          remanejamentoFuncionario: {
            funcionario: {
              matricula: { contains: q, mode: "insensitive" },
            },
          },
        },
      ],
    });
  }

  if (cursor) {
    andClauses.push({
      OR: [
        { dataCriacao: { lt: cursor.dataCriacao } },
        {
          AND: [{ dataCriacao: cursor.dataCriacao }, { id: { lt: cursor.id } }],
        },
      ],
    });
  }

  return {
    where: andClauses.length === 1 ? andClauses[0] : { AND: andClauses },
    limit,
    filtrosAplicados: {
      q: q || null,
      qIgnoradoPorTamanho:
        qRaw && qRaw.length < MIN_SEARCH_LENGTH ? qRaw : null,
      status: statusList,
      prioridade: prioridadeList,
      responsavel: responsavelList.map((r) => r.toUpperCase()),
      limit,
      cursor: searchParams.get("cursor"),
    },
  };
}

export async function GET(request: NextRequest) {
  const startedAt = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const { where, limit, filtrosAplicados } = montarWhere(searchParams);

    const rows = await prisma.tarefaRemanejamento.findMany({
      where,
      take: limit + 1,
      orderBy: [{ dataCriacao: "desc" }, { id: "desc" }],
      select: {
        id: true,
        tipo: true,
        descricao: true,
        responsavel: true,
        status: true,
        dataCriacao: true,
        dataLimite: true,
        remanejamentoFuncionario: {
          select: {
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
      },
    });

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const ultimo = items[items.length - 1];
    const nextCursor =
      hasMore && ultimo
        ? `${ultimo.dataCriacao.toISOString()}|${ultimo.id}`
        : null;

    const durationMs = Date.now() - startedAt;
    const payloadBytes = Buffer.byteLength(JSON.stringify(items), "utf8");

    console.info(
      `[tarefas-v2] duration=${durationMs}ms items=${items.length} hasMore=${hasMore} payload=${payloadBytes}b filtros=${JSON.stringify(filtrosAplicados)}`,
    );

    return NextResponse.json(
      {
        items,
        nextCursor,
        hasMore,
        metrics: {
          durationMs,
          payloadBytes,
          generatedAt: new Date().toISOString(),
        },
        filtrosAplicados,
      },
      {
        headers: {
          "Cache-Control": "no-store",
          "Server-Timing": `db;dur=${durationMs}`,
        },
      },
    );
  } catch (error) {
    console.error("Erro ao carregar tarefas v2:", error);
    return NextResponse.json(
      { error: "Erro interno ao carregar tarefas V2" },
      { status: 500 },
    );
  }
}
