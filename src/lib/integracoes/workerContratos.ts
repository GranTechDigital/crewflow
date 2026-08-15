import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type DbClient = PrismaClient | Prisma.TransactionClient;

type SincronizarWorkerContratoOptions = {
  db?: DbClient;
  provedor?: string;
  ambiente?: string;
  matriculas?: string[];
  limit?: number;
  reenfileirarMesmoPayload?: boolean;
  dryRun?: boolean;
};

export type ResultadoSincronizacaoWorkerContrato = {
  funcionariosAvaliados: number;
  elegiveis: number;
  eventosCriados: number;
  eventosAtualizados: number;
  outboxCriadas: number;
  ignorados: number;
  semCentroCusto: number;
  semVinculoContrato: number;
  vinculoAmbiguo: number;
};

const PROVEDOR_DRAKE = "DRAKE";
const DOMINIO_WORKER = "WORKER";
const ENTIDADE_WORKER = "WORKER";
const ACAO_SYNC_WORKER = "SYNC_WORKER";

function ambienteIntegracao(options?: { ambiente?: string }) {
  return (
    options?.ambiente ||
    process.env.DRAKE_ENVIRONMENT ||
    process.env.NODE_ENV ||
    "local"
  )
    .trim()
    .toLowerCase();
}

function seletorContratoDrake() {
  return (
    process.env.DRAKE_CONTRACT_SELECTOR_FIELD ||
    process.env.DRAKE_WORKER_CONTRACT_SELECTOR_FIELD ||
    "ExternalId"
  ).trim();
}

function valorSeletorContratoDrake(numeroContrato: string) {
  return `${process.env.DRAKE_CONTRACT_EXTERNAL_ID_PREFIX || ""}${numeroContrato}`.trim();
}

function normalizarCentroCusto(value: unknown) {
  return String(value || "").trim();
}

function externalIdWorkerContrato(data: { ambiente: string; matricula: string }) {
  return `crew:worker-contract:${data.ambiente}:${data.matricula}`;
}

function chaveIdempotencia(data: { provedor: string; matricula: string }) {
  return [data.provedor, DOMINIO_WORKER, ENTIDADE_WORKER, "CONTRATO", data.matricula].join(":");
}

function ordenarJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(ordenarJson);
  if (!value || typeof value !== "object" || value instanceof Date) return value;

  return Object.keys(value)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = ordenarJson((value as Record<string, unknown>)[key]);
      return acc;
    }, {});
}

function jsonStable(value: unknown) {
  return JSON.stringify(ordenarJson(value));
}

function montarPayloadWorkerContrato(params: {
  matricula: string;
  numeroContrato: string;
  seletorContrato: string;
}) {
  const valorSeletorContrato = valorSeletorContratoDrake(params.numeroContrato);

  return {
    Header: {
      OnInsert: "Ignore",
      OnUpdate: "Execute",
    },
    Selector: {
      Registration: params.matricula,
    },
    Payload: {
      Contracts: [
        {
          Selector: {
            [params.seletorContrato]: valorSeletorContrato,
          },
          Main: true,
          Deleted: false,
        },
      ],
    },
  };
}

export async function sincronizarContratosWorkerDrake(
  options: SincronizarWorkerContratoOptions = {},
): Promise<ResultadoSincronizacaoWorkerContrato> {
  const db = options.db ?? prisma;
  const provedor = options.provedor ?? PROVEDOR_DRAKE;
  const ambiente = ambienteIntegracao(options);
  const seletorContrato = seletorContratoDrake();
  const matriculas = (options.matriculas || [])
    .map((matricula) => String(matricula || "").trim())
    .filter(Boolean);
  const resultado: ResultadoSincronizacaoWorkerContrato = {
    funcionariosAvaliados: 0,
    elegiveis: 0,
    eventosCriados: 0,
    eventosAtualizados: 0,
    outboxCriadas: 0,
    ignorados: 0,
    semCentroCusto: 0,
    semVinculoContrato: 0,
    vinculoAmbiguo: 0,
  };

  const funcionarios = await db.funcionario.findMany({
    where: {
      matricula: {
        not: "ADMIN001",
        ...(matriculas.length > 0 ? { in: matriculas } : {}),
      },
      status: { not: "DEMITIDO" },
    },
    select: {
      id: true,
      matricula: true,
      nome: true,
      centroCusto: true,
      status: true,
    },
    orderBy: { matricula: "asc" },
    ...(options.limit ? { take: Math.max(1, Math.min(options.limit, 5000)) } : {}),
  });

  resultado.funcionariosAvaliados = funcionarios.length;

  const centrosCusto = Array.from(
    new Set(
      funcionarios
        .map((funcionario) => normalizarCentroCusto(funcionario.centroCusto))
        .filter(Boolean),
    ),
  );

  const vinculos = centrosCusto.length
    ? await db.contratosCentrosCusto.findMany({
        where: {
          centroCusto: {
            num_centro_custo: { in: centrosCusto },
          },
        },
        include: {
          contrato: { select: { id: true, numero: true, nome: true, status: true } },
          centroCusto: {
            select: { id: true, num_centro_custo: true, nome_centro_custo: true, status: true },
          },
        },
      })
    : [];

  const vinculosPorCentro = new Map<string, typeof vinculos>();
  for (const vinculo of vinculos) {
    const key = vinculo.centroCusto.num_centro_custo;
    const lista = vinculosPorCentro.get(key) || [];
    lista.push(vinculo);
    vinculosPorCentro.set(key, lista);
  }

  for (const funcionario of funcionarios) {
    const centroCusto = normalizarCentroCusto(funcionario.centroCusto);
    if (!centroCusto) {
      resultado.semCentroCusto += 1;
      resultado.ignorados += 1;
      continue;
    }

    const vinculosCentro = vinculosPorCentro.get(centroCusto) || [];
    if (vinculosCentro.length === 0) {
      resultado.semVinculoContrato += 1;
      resultado.ignorados += 1;
      continue;
    }
    if (vinculosCentro.length > 1) {
      resultado.vinculoAmbiguo += 1;
      resultado.ignorados += 1;
      continue;
    }

    const vinculo = vinculosCentro[0];
    const numeroContrato = String(vinculo.contrato.numero || "").trim();
    if (!numeroContrato) {
      resultado.semVinculoContrato += 1;
      resultado.ignorados += 1;
      continue;
    }

    resultado.elegiveis += 1;

    const externalId = externalIdWorkerContrato({ ambiente, matricula: funcionario.matricula });
    const chave = chaveIdempotencia({ provedor, matricula: funcionario.matricula });
    const payload = montarPayloadWorkerContrato({
      matricula: funcionario.matricula,
      numeroContrato,
      seletorContrato,
    }) satisfies Prisma.InputJsonValue;
    const metadata = {
      ambiente,
      seletorContrato,
      valorSeletorContrato: valorSeletorContratoDrake(numeroContrato),
      funcionario: {
        id: funcionario.id,
        matricula: funcionario.matricula,
        nome: funcionario.nome,
        status: funcionario.status,
        centroCusto,
      },
      contrato: {
        id: vinculo.contrato.id,
        numero: vinculo.contrato.numero,
        nome: vinculo.contrato.nome,
        status: vinculo.contrato.status,
      },
      centroCusto: {
        id: vinculo.centroCusto.id,
        numero: vinculo.centroCusto.num_centro_custo,
        nome: vinculo.centroCusto.nome_centro_custo,
        status: vinculo.centroCusto.status,
      },
    } satisfies Prisma.InputJsonValue;

    const existente = await db.integracaoEventoExterno.findUnique({
      where: { chaveIdempotencia: chave },
      include: {
        outbox: {
          where: { ambiente },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });
    const payloadMudou = !existente || jsonStable(existente.payload) !== jsonStable(payload);
    const ultimaOutbox = existente?.outbox[0];
    const jaTemOutboxPendenteIgual =
      ultimaOutbox &&
      ["PENDENTE", "IGNORADO", "ENVIANDO"].includes(ultimaOutbox.status) &&
      jsonStable(ultimaOutbox.payload) === jsonStable(payload);

    if (options.dryRun) {
      if (existente) {
        if (payloadMudou) resultado.eventosAtualizados += 1;
      } else {
        resultado.eventosCriados += 1;
      }
      if (
        (!existente || payloadMudou || options.reenfileirarMesmoPayload) &&
        !jaTemOutboxPendenteIgual
      ) {
        resultado.outboxCriadas += 1;
      }
      continue;
    }

    const evento = await db.integracaoEventoExterno.upsert({
      where: { chaveIdempotencia: chave },
      create: {
        provedor,
        dominio: DOMINIO_WORKER,
        entidade: ENTIDADE_WORKER,
        direcao: "SAIDA",
        acao: ACAO_SYNC_WORKER,
        externalId,
        status: "ABERTO",
        chaveIdempotencia: chave,
        payload,
        metadata,
      },
      update: {
        externalId,
        status: "ABERTO",
        payload,
        metadata,
      },
    });

    if (existente) {
      if (payloadMudou) resultado.eventosAtualizados += 1;
    } else {
      resultado.eventosCriados += 1;
    }

    if (
      (!existente || payloadMudou || options.reenfileirarMesmoPayload) &&
      !jaTemOutboxPendenteIgual
    ) {
      await db.integracaoOutbox.create({
        data: {
          eventoExternoId: evento.id,
          provedor,
          ambiente,
          acao: ACAO_SYNC_WORKER,
          externalId,
          payload,
          status: process.env.DRAKE_WEBHOOK_ENABLED === "true" ? "PENDENTE" : "IGNORADO",
          ultimoErro:
            process.env.DRAKE_WEBHOOK_ENABLED === "true"
              ? null
              : "Envio externo desabilitado por configuracao",
        },
      });
      resultado.outboxCriadas += 1;
    }
  }

  return resultado;
}

export async function sincronizarContratosWorkerDrakeSafe(
  options: Omit<SincronizarWorkerContratoOptions, "dryRun"> = {},
) {
  try {
    return await sincronizarContratosWorkerDrake(options);
  } catch (error) {
    console.error("Erro ao preparar sincronizacao de contrato do worker:", error);
    return null;
  }
}
