import { NextRequest, NextResponse } from "next/server";
import { PUT as concluirTarefaUnitaria } from "@/app/api/logistica/tarefas/[id]/concluir/route";

type ConcluirLoteItem = {
  id: string;
  dataVencimento?: string | null;
};

type ConcluirLotePayload = {
  itens?: ConcluirLoteItem[];
};

type FalhaLote = {
  id: string;
  error: string;
  status?: number;
};

type IdempotencyCacheEntry = {
  status: number;
  body: unknown;
  expiresAt: number;
};

const MAX_ITENS_LOTE = 200;
const LOTE_CONCURRENCY = 6;
const IDEMPOTENCY_TTL_MS = 5 * 60 * 1000;
const IDEMPOTENCY_MAX_ITEMS = 1000;

type ProcessResult =
  | { ok: true; id: string }
  | { ok: false; id: string; error: string; status?: number };

function getIdempotencyCache() {
  const globalRef = globalThis as unknown as {
    __tarefasConcluirLoteIdempotencyCache?: Map<string, IdempotencyCacheEntry>;
  };
  if (!globalRef.__tarefasConcluirLoteIdempotencyCache) {
    globalRef.__tarefasConcluirLoteIdempotencyCache = new Map();
  }
  return globalRef.__tarefasConcluirLoteIdempotencyCache;
}

function pruneIdempotencyCache(cache: Map<string, IdempotencyCacheEntry>) {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (entry.expiresAt <= now) cache.delete(key);
  }
  while (cache.size > IDEMPOTENCY_MAX_ITEMS) {
    const oldestKey = cache.keys().next().value;
    if (!oldestKey) break;
    cache.delete(oldestKey);
  }
}

export async function PUT(request: NextRequest) {
  const startedAt = Date.now();
  try {
    const idempotencyKey =
      request.headers.get("x-idempotency-key")?.trim() || "";
    const idempotencyCache = getIdempotencyCache();
    pruneIdempotencyCache(idempotencyCache);

    if (idempotencyKey) {
      const cached = idempotencyCache.get(idempotencyKey);
      if (cached && cached.expiresAt > Date.now()) {
        return NextResponse.json(cached.body, {
          status: cached.status,
          headers: { "x-idempotency-replayed": "1" },
        });
      }
    }

    const responder = (body: unknown, status = 200) => {
      if (idempotencyKey) {
        idempotencyCache.set(idempotencyKey, {
          status,
          body,
          expiresAt: Date.now() + IDEMPOTENCY_TTL_MS,
        });
      }
      return NextResponse.json(body, {
        status,
        headers: idempotencyKey ? { "x-idempotency-replayed": "0" } : undefined,
      });
    };

    const body = (await request.json().catch(() => ({}))) as ConcluirLotePayload;
    const itens = Array.isArray(body?.itens) ? body.itens : [];

    if (itens.length === 0) {
      return responder(
        { error: "Envie ao menos uma tarefa para conclusão em lote." },
        400,
      );
    }
    if (itens.length > MAX_ITENS_LOTE) {
      return responder(
        { error: `Limite de ${MAX_ITENS_LOTE} tarefas por lote.` },
        400,
      );
    }

    const cookie = request.headers.get("cookie");
    const authorization = request.headers.get("authorization");
    const processarItem = async (item: ConcluirLoteItem): Promise<ProcessResult> => {
      const id = String(item?.id || "").trim();
      if (!id) {
        return { ok: false, id: "", error: "ID de tarefa inválido." };
      }

      try {
        const internalHeaders = new Headers({ "Content-Type": "application/json" });
        if (cookie) internalHeaders.set("cookie", cookie);
        if (authorization) internalHeaders.set("authorization", authorization);
        if (idempotencyKey) {
          internalHeaders.set("x-idempotency-key", `${idempotencyKey}:item:${id}`);
        }

        const internalReq = new NextRequest(
          new Request(new URL(request.url), {
            method: "PUT",
            headers: internalHeaders,
            body: JSON.stringify({ dataVencimento: item?.dataVencimento || null }),
          }),
        );

        const response = await concluirTarefaUnitaria(internalReq, {
          params: Promise.resolve({ id }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          return {
            ok: false,
            id,
            error:
              (payload as { error?: string })?.error ||
              "Falha ao concluir tarefa no lote.",
            status: response.status,
          };
        }

        return { ok: true, id };
      } catch (error) {
        return {
          ok: false,
          id,
          error: error instanceof Error ? error.message : "Erro interno ao processar tarefa.",
        };
      }
    };

    const resultados: ProcessResult[] = [];
    // Concorrência limitada para reduzir latência total sem sobrecarregar o banco.
    for (let i = 0; i < itens.length; i += LOTE_CONCURRENCY) {
      const chunk = itens.slice(i, i + LOTE_CONCURRENCY);
      const chunkResults = await Promise.all(chunk.map((item) => processarItem(item)));
      resultados.push(...chunkResults);
    }

    const sucessoIds = resultados.filter((r) => r.ok).map((r) => r.id);
    const falhas: FalhaLote[] = resultados
      .filter((r): r is Extract<ProcessResult, { ok: false }> => !r.ok)
      .map((r) => ({ id: r.id, error: r.error, status: r.status }));

    return responder(
      {
        sucessoIds,
        falhas,
        totalSolicitado: itens.length,
        totalSucesso: sucessoIds.length,
        totalFalhas: falhas.length,
        durationMs: Date.now() - startedAt,
      },
      200,
    );
  } catch (error) {
    console.error("Erro em concluir-lote:", error);
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}
