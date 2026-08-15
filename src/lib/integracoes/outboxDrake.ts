import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  DrakeClientError,
  addAdditionalEventBulk,
  finalizeSyncSession,
  getDrakeConfig,
  startSyncSession,
} from "./drakeClient";

type DbClient = PrismaClient | Prisma.TransactionClient;

type ProcessarOutboxDrakeOptions = {
  db?: DbClient;
  ambiente?: string;
  limit?: number;
  outboxId?: number;
  eventoExternoId?: number;
  dryRun?: boolean;
  reenviarErros?: boolean;
  incluirIgnorados?: boolean;
  now?: Date;
};

type ReenfileirarOutboxDrakeOptions = {
  db?: DbClient;
  ambiente?: string;
  outboxId?: number;
  eventoExternoId?: number;
};

export type ResultadoProcessamentoOutboxDrake = {
  totalElegivel: number;
  enviados: number;
  falhas: number;
  ignorados: number;
  desabilitados: number;
  resultados: Array<{
    id: number;
    externalId: string;
    statusAnterior: string;
    statusNovo: string;
    ok: boolean;
    erro?: string;
  }>;
};

export type ResultadoReenfileiramentoOutboxDrake = {
  atualizados: number;
};

const PROVEDOR_DRAKE = "DRAKE";
const ACAO_SYNC_ADDITIONAL_EVENT = "SYNC_ADDITIONAL_EVENT";
const ACAO_SYNC_WORKER = "SYNC_WORKER";
const ACOES_SUPORTADAS = [ACAO_SYNC_ADDITIONAL_EVENT];
const MAX_TENTATIVAS = 5;
const SESSION_MAX_ITEMS = 1000;
const SESSION_TIMEOUT_MS = 60 * 60 * 1000;

function sessionEnabled() {
  return String(process.env.DRAKE_SYNC_SESSION_ENABLED || "false").toLowerCase() === "true";
}

function ambienteIntegracao(ambiente?: string) {
  return String(ambiente || process.env.DRAKE_ENVIRONMENT || process.env.NODE_ENV || "local")
    .trim()
    .toLowerCase();
}

function retryDelayMs(tentativas: number) {
  const minutes = Math.min(60, Math.max(1, 2 ** Math.max(tentativas - 1, 0)));
  return minutes * 60 * 1000;
}

function mensagemErro(error: unknown) {
  if (error instanceof DrakeClientError) {
    return [error.message, error.status ? `HTTP ${error.status}` : null, error.responseText]
      .filter(Boolean)
      .join(" | ")
      .slice(0, 4000);
  }
  if (error instanceof Error) return error.message.slice(0, 4000);
  return "Erro desconhecido".slice(0, 4000);
}

function jsonIgual(a: Prisma.JsonValue, b: Prisma.JsonValue) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function sessionIdFromResponse(data: unknown) {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  const value =
    record.SessionId ??
    record.SyncSessionId ??
    record.Id ??
    record.id ??
    record.sessionId ??
    record.syncSessionId;
  return value == null ? null : String(value);
}

function sessionRequestPayload(sessionIdExterno?: string | null) {
  return sessionIdExterno ? { SessionId: sessionIdExterno } : {};
}

function atualizarIgnorados(resultado: ResultadoProcessamentoOutboxDrake) {
  resultado.ignorados = Math.max(
    0,
    resultado.totalElegivel - resultado.enviados - resultado.falhas - resultado.desabilitados,
  );
}

export async function processarOutboxDrake(
  options: ProcessarOutboxDrakeOptions = {},
): Promise<ResultadoProcessamentoOutboxDrake> {
  const db = options.db ?? prisma;
  const now = options.now ?? new Date();
  const limit = Math.min(Math.max(Number(options.limit || 20), 1), SESSION_MAX_ITEMS);
  const ambiente = ambienteIntegracao(options.ambiente);
  const config = getDrakeConfig();
  const resultado: ResultadoProcessamentoOutboxDrake = {
    totalElegivel: 0,
    enviados: 0,
    falhas: 0,
    ignorados: 0,
    desabilitados: 0,
    resultados: [],
  };

  const statusElegiveis = ["PENDENTE"];
  if (options.reenviarErros) statusElegiveis.push("ERRO");
  if (options.incluirIgnorados) statusElegiveis.push("IGNORADO");

  const itemDireto = options.outboxId
    ? await db.integracaoOutbox.findUnique({
        where: { id: options.outboxId },
      })
    : null;
  const itens = itemDireto
    ? [itemDireto]
    : await db.integracaoOutbox.findMany({
        where: {
          provedor: PROVEDOR_DRAKE,
          ambiente,
          acao: { in: ACOES_SUPORTADAS },
          ...(options.eventoExternoId ? { eventoExternoId: options.eventoExternoId } : {}),
          status: { in: statusElegiveis },
          tentativas: { lt: MAX_TENTATIVAS },
          OR: [{ proximaTentativaAt: null }, { proximaTentativaAt: { lte: now } }],
        },
        orderBy: [{ createdAt: "asc" }],
        take: limit,
      });

  resultado.totalElegivel = itens.length;
  const itensParaSessao = itens.filter(
    (item) =>
      item.provedor === PROVEDOR_DRAKE &&
      item.ambiente === ambiente &&
      ACOES_SUPORTADAS.includes(item.acao) &&
      (Boolean(itemDireto) || statusElegiveis.includes(item.status)),
  );

  for (const item of itens) {
    if (
      item.provedor !== PROVEDOR_DRAKE ||
      item.ambiente !== ambiente ||
      !ACOES_SUPORTADAS.includes(item.acao) ||
      (!itemDireto && !statusElegiveis.includes(item.status))
    ) {
      resultado.ignorados += 1;
      resultado.resultados.push({
        id: item.id,
        externalId: item.externalId,
        statusAnterior: item.status,
        statusNovo: item.status,
        ok: false,
        erro:
          item.acao === ACAO_SYNC_WORKER
            ? "SYNC_WORKER fora do processamento por sessao nesta etapa"
            : "Item fora dos criterios de processamento Drake",
      });
      continue;
    }

    if (options.dryRun) {
      resultado.resultados.push({
        id: item.id,
        externalId: item.externalId,
        statusAnterior: item.status,
        statusNovo: item.status,
        ok: true,
      });
      continue;
    }

    if (!config.enabled || !sessionEnabled()) {
      resultado.desabilitados += 1;
      resultado.resultados.push({
        id: item.id,
        externalId: item.externalId,
        statusAnterior: item.status,
        statusNovo: item.status,
        ok: false,
        erro:
          !config.enabled
            ? "Envio Drake desabilitado por DRAKE_WEBHOOK_ENABLED=false"
            : "Sessao Drake desabilitada por DRAKE_SYNC_SESSION_ENABLED=false",
      });
      continue;
    }

    resultado.ignorados += 1;
  }

  if (options.dryRun || !config.enabled || !sessionEnabled() || itensParaSessao.length === 0) {
    atualizarIgnorados(resultado);
    return resultado;
  }

  const sessaoAberta = await db.integracaoSessao.findFirst({
    where: {
      provedor: PROVEDOR_DRAKE,
      ambiente,
      tipo: "SYNC_SESSION_ADDITIONAL_EVENT",
      status: { in: ["ABERTA", "ENVIANDO", "PROCESSANDO"] },
    },
    orderBy: { abertaAt: "desc" },
  });

  if (sessaoAberta) {
    resultado.desabilitados += itensParaSessao.length;
    resultado.resultados.push(...itensParaSessao.map((item) => ({
      id: item.id,
      externalId: item.externalId,
      statusAnterior: item.status,
      statusNovo: item.status,
      ok: false,
      erro: `Ja existe sessao Drake ativa no Crew: #${sessaoAberta.id}`,
    })));
    atualizarIgnorados(resultado);
    return resultado;
  }

  const sessao = await db.integracaoSessao.create({
    data: {
      provedor: PROVEDOR_DRAKE,
      ambiente,
      tipo: "SYNC_SESSION_ADDITIONAL_EVENT",
      status: "ABERTA",
      totalItens: itensParaSessao.length,
      totalLotes: 1,
      timeoutMs: Number(process.env.DRAKE_SYNC_SESSION_TIMEOUT_MS || SESSION_TIMEOUT_MS),
      payload: {
        acao: ACAO_SYNC_ADDITIONAL_EVENT,
        ambiente,
        loteMaximo: SESSION_MAX_ITEMS,
        outboxIds: itensParaSessao.map((item) => item.id),
      },
    },
  });

  try {
    const payloads = [];
    for (const item of itensParaSessao) {
      payloads.push(item.payload);
    }

    await db.integracaoSessao.update({
      where: { id: sessao.id },
      data: { status: "ENVIANDO" },
    });

    const inicio = await startSyncSession({
      TimeoutInMilliseconds: sessao.timeoutMs,
    });
    const sessionIdExterno = sessionIdFromResponse(inicio.data);

    await db.integracaoSessao.update({
      where: { id: sessao.id },
      data: {
        sessionIdExterno,
        respostaInicio: (inicio.data ?? inicio.text) as Prisma.InputJsonValue,
      },
    });

    await addAdditionalEventBulk({
      ...sessionRequestPayload(sessionIdExterno),
      Items: payloads,
    });

    const finalizacao = await finalizeSyncSession(sessionRequestPayload(sessionIdExterno));

    await db.integracaoSessao.update({
      where: { id: sessao.id },
      data: {
        status: "FINALIZADA",
        finalizadaAt: new Date(),
        respostaFinalizacao: (finalizacao.data ?? finalizacao.text) as Prisma.InputJsonValue,
      },
    });

    await db.integracaoOutbox.updateMany({
      where: { id: { in: itensParaSessao.map((item) => item.id) } },
      data: {
        sessaoId: sessao.id,
        status: "AGENDADO_SESSAO",
        tentativas: { increment: 1 },
        sentAt: new Date(),
        ultimoErro: null,
        proximaTentativaAt: null,
      },
    });

    await db.integracaoEventoExterno.updateMany({
      where: {
        id: { in: itensParaSessao.map((item) => item.eventoExternoId).filter(Boolean) as number[] },
      },
      data: {
        ultimaSincronizacaoAt: new Date(),
        ultimoErro: null,
      },
    });

    resultado.enviados += itensParaSessao.length;
    resultado.resultados.push(...itensParaSessao.map((item) => ({
      id: item.id,
      externalId: item.externalId,
      statusAnterior: item.status,
      statusNovo: "AGENDADO_SESSAO",
      ok: true,
    })));
    atualizarIgnorados(resultado);
  } catch (error) {
    const erro = mensagemErro(error);
    await db.integracaoSessao.update({
      where: { id: sessao.id },
      data: {
        status: "ERRO",
        ultimoErro: erro,
      },
    });

    for (const item of itensParaSessao) {
      const tentativas = item.tentativas + 1;
      const statusNovo = tentativas >= MAX_TENTATIVAS ? "ERRO" : "PENDENTE";
      const proximaTentativaAt =
        tentativas >= MAX_TENTATIVAS ? null : new Date(now.getTime() + retryDelayMs(tentativas));

      await db.integracaoOutbox.update({
        where: { id: item.id },
        data: {
          sessaoId: sessao.id,
          status: statusNovo,
          tentativas,
          ultimoErro: erro,
          proximaTentativaAt,
        },
      });

      if (item.eventoExternoId) {
        await db.integracaoEventoExterno.update({
          where: { id: item.eventoExternoId },
          data: { ultimoErro: erro },
        });
      }
    }

    resultado.falhas += itensParaSessao.length;
    resultado.resultados.push(...itensParaSessao.map((item) => ({
      id: item.id,
      externalId: item.externalId,
      statusAnterior: item.status,
      statusNovo: item.tentativas + 1 >= MAX_TENTATIVAS ? "ERRO" : "PENDENTE",
      ok: false,
      erro,
    })));
    atualizarIgnorados(resultado);
  }

  return resultado;
}

export async function reenfileirarOutboxDrake(
  options: ReenfileirarOutboxDrakeOptions = {},
): Promise<ResultadoReenfileiramentoOutboxDrake> {
  const db = options.db ?? prisma;
  const ambiente = ambienteIntegracao(options.ambiente);

  if (!options.outboxId && !options.eventoExternoId) {
    throw new Error("Informe outboxId ou eventoExternoId para reenfileirar.");
  }

  const resultado = await db.integracaoOutbox.updateMany({
    where: {
      provedor: PROVEDOR_DRAKE,
      ambiente,
      acao: { in: ACOES_SUPORTADAS },
      ...(options.outboxId ? { id: options.outboxId } : {}),
      ...(options.eventoExternoId ? { eventoExternoId: options.eventoExternoId } : {}),
    },
    data: {
      status: "PENDENTE",
      tentativas: 0,
      ultimoErro: null,
      proximaTentativaAt: null,
      sentAt: null,
      sessaoId: null,
    },
  });

  return { atualizados: resultado.count };
}
