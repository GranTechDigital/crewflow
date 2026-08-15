import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type DbClient = PrismaClient | Prisma.TransactionClient;

type SetorCadastro = "RH" | "MEDICINA" | "TREINAMENTO" | "LOGISTICA";

type SincronizarCadastroOptions = {
  db?: DbClient;
  provedor?: string;
  ambiente?: string;
  remanejamentoFuncionarioId?: string;
  cicloId?: string;
  inicioMinimoAt?: Date;
  reenfileirarMesmoPayload?: boolean;
  dryRun?: boolean;
  now?: Date;
};

type ResultadoSincronizacaoCadastro = {
  ciclosElegiveis: number;
  eventosCriados: number;
  eventosAtualizados: number;
  outboxCriadas: number;
  outboxAtualizadas: number;
  eventosIgnorados?: number;
  outboxIgnoradas?: number;
  ignorados: number;
};

const PROVEDOR_DRAKE = "DRAKE";
const DOMINIO_CADASTRO = "CADASTRO_FUNCIONARIO";
const ENTIDADE_EVENTO_ADICIONAL = "EVENTO_ADICIONAL";

const IDENTIFICADORES_DRAKE_PADRAO: Record<SetorCadastro, string> = {
  RH: "MCD",
  MEDICINA: "MCMD",
  TREINAMENTO: "MCTR",
  LOGISTICA: "MCLG",
};

const NOMES_DRAKE: Record<SetorCadastro, string> = {
  RH: "Cadastro RH",
  MEDICINA: "Cadastro Medicina",
  TREINAMENTO: "Cadastro Treinamento",
  LOGISTICA: "Cadastro Logistica",
};

function isSetorCadastro(setor: string): setor is SetorCadastro {
  return Object.prototype.hasOwnProperty.call(IDENTIFICADORES_DRAKE_PADRAO, setor);
}

function identificadorOccurrenceType(setor: SetorCadastro) {
  const setorEnvKey = `DRAKE_OCCURRENCE_TYPE_IDENTIFIER_${setor}`;
  return (process.env[setorEnvKey] || IDENTIFICADORES_DRAKE_PADRAO[setor]).trim();
}

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

function inicioMinimoCadastro(options?: { inicioMinimoAt?: Date }) {
  if (options?.inicioMinimoAt) return options.inicioMinimoAt;

  const raw = process.env.DRAKE_CADASTRO_MIN_START_AT || "2026-01-01T00:00:00.000Z";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return new Date("2026-01-01T00:00:00.000Z");
  }
  return parsed;
}

function statusEvento(ciclo: {
  status: string;
  conclusaoAt: Date | null;
  cancelamentoAt: Date | null;
}) {
  if (ciclo.status === "CANCELADO" || ciclo.cancelamentoAt) return "CANCELADO";
  if (ciclo.status === "CONCLUIDO" || ciclo.conclusaoAt) return "CONCLUIDO";
  return "ABERTO";
}

function endDrake(ciclo: {
  conclusaoAt: Date | null;
  cancelamentoAt: Date | null;
}, now: Date) {
  return ciclo.conclusaoAt ?? ciclo.cancelamentoAt ?? now;
}

function externalIdCadastro(data: {
  ambiente: string;
  remanejamentoFuncionarioId: string;
  numeroCiclo: number;
  setor: SetorCadastro;
}) {
  return `crew:cadastro:${data.ambiente}:${data.remanejamentoFuncionarioId}:ciclo:${data.numeroCiclo}:setor:${data.setor}`;
}

function chaveIdempotencia(data: {
  provedor: string;
  remanejamentoFuncionarioId: string;
  numeroCiclo: number;
  setor: SetorCadastro;
}) {
  return [
    data.provedor,
    DOMINIO_CADASTRO,
    data.remanejamentoFuncionarioId,
    `ciclo:${data.numeroCiclo}`,
    `setor:${data.setor}`,
  ].join(":");
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

async function ignorarIntegracoesDeCiclosIgnorados(
  db: DbClient,
  options: {
    provedor: string;
    remanejamentoFuncionarioId?: string;
    cicloId?: string;
  },
) {
  const whereEvento: Prisma.IntegracaoEventoExternoWhereInput = {
    provedor: options.provedor,
    ...(options.cicloId ? { cicloId: options.cicloId } : {}),
    ...(options.remanejamentoFuncionarioId
      ? { remanejamentoFuncionarioId: options.remanejamentoFuncionarioId }
      : {}),
    ciclo: { status: "IGNORADO" },
  };

  const eventos = await db.integracaoEventoExterno.updateMany({
    where: {
      ...whereEvento,
      status: { not: "IGNORADO" },
    },
    data: {
      status: "IGNORADO",
    },
  });

  const outbox = await db.integracaoOutbox.updateMany({
    where: {
      provedor: options.provedor,
      ...(options.cicloId ? { cicloId: options.cicloId } : {}),
      ...(options.remanejamentoFuncionarioId
        ? { remanejamentoFuncionarioId: options.remanejamentoFuncionarioId }
        : {}),
      ciclo: { status: "IGNORADO" },
      status: { in: ["PENDENTE", "IGNORADO", "ERRO"] },
    },
    data: {
      status: "IGNORADO",
      ultimoErro: "Ciclo ignorado por saneamento de reconstrucao historica",
      proximaTentativaAt: null,
    },
  });

  return {
    eventosIgnorados: eventos.count,
    outboxIgnoradas: outbox.count,
  };
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function pad3(value: number) {
  return String(value).padStart(3, "0");
}

function isoSaoPaulo(date: Date) {
  const localMs = date.getTime() - 3 * 60 * 60 * 1000;
  const local = new Date(localMs);
  return [
    local.getUTCFullYear(),
    "-",
    pad2(local.getUTCMonth() + 1),
    "-",
    pad2(local.getUTCDate()),
    "T",
    pad2(local.getUTCHours()),
    ":",
    pad2(local.getUTCMinutes()),
    ":",
    pad2(local.getUTCSeconds()),
    ".",
    pad3(local.getUTCMilliseconds()),
    "-03:00",
  ].join("");
}

function montarPayloadDrake(ciclo: {
  externalId: string;
  setor: SetorCadastro;
  numeroCiclo: number;
  matricula: string;
  startAt: Date;
  endAt: Date | null;
}) {
  return {
    Header: {
      OnInsert: "Execute",
      OnUpdate: "Execute",
    },
    Selector: {
      ExternalId: ciclo.externalId,
    },
    Payload: {
      Worker: {
        SyncStrategy: {
          OnInsert: "Reference",
          OnUpdate: "Reference",
        },
        Selector: {
          Registration: ciclo.matricula,
        },
      },
      OccurrenceType: {
        SyncStrategy: {
          OnInsert: "Reference",
          OnUpdate: "Reference",
        },
        Selector: {
          Identifier: identificadorOccurrenceType(ciclo.setor),
        },
      },
      Start: {
        Value: isoSaoPaulo(ciclo.startAt),
      },
      End: {
        Value: ciclo.endAt ? isoSaoPaulo(ciclo.endAt) : null,
      },
      Justification: {
        Value: `Setor Crew: ${ciclo.setor} | Ciclo Crew: ${ciclo.numeroCiclo}`,
      },
    },
  };
}

export async function sincronizarEventosCadastroExterno(
  options: SincronizarCadastroOptions = {},
): Promise<ResultadoSincronizacaoCadastro> {
  const db = options.db ?? prisma;
  const provedor = options.provedor ?? PROVEDOR_DRAKE;
  const ambiente = ambienteIntegracao(options);
  const inicioMinimoAt = inicioMinimoCadastro(options);
  const now = options.now ?? new Date();
  const resultado: ResultadoSincronizacaoCadastro = {
    ciclosElegiveis: 0,
    eventosCriados: 0,
    eventosAtualizados: 0,
    outboxCriadas: 0,
    outboxAtualizadas: 0,
    eventosIgnorados: 0,
    outboxIgnoradas: 0,
    ignorados: 0,
  };

  const ciclos = await db.remanejamentoCiclo.findMany({
    where: {
      status: { not: "IGNORADO" },
      inicioAt: { gte: inicioMinimoAt },
      ...(options.cicloId ? { id: options.cicloId } : {}),
      ...(options.remanejamentoFuncionarioId
        ? { remanejamentoFuncionarioId: options.remanejamentoFuncionarioId }
        : {}),
    },
    include: {
      remanejamentoFuncionario: {
        include: {
          funcionario: { select: { matricula: true, nome: true } },
          solicitacao: { select: { id: true, tipo: true } },
        },
      },
    },
    orderBy: [
      { remanejamentoFuncionarioId: "asc" },
      { numeroCiclo: "asc" },
      { inicioAt: "asc" },
    ],
  });

  for (const ciclo of ciclos) {
    if (!isSetorCadastro(ciclo.setor) || !ciclo.remanejamentoFuncionario.funcionario.matricula) {
      resultado.ignorados += 1;
      continue;
    }

    resultado.ciclosElegiveis += 1;

    const setor = ciclo.setor;
    const status = statusEvento(ciclo);
    const externalId = externalIdCadastro({
      ambiente,
      remanejamentoFuncionarioId: ciclo.remanejamentoFuncionarioId,
      numeroCiclo: ciclo.numeroCiclo,
      setor,
    });
    const chave = chaveIdempotencia({
      provedor,
      remanejamentoFuncionarioId: ciclo.remanejamentoFuncionarioId,
      numeroCiclo: ciclo.numeroCiclo,
      setor,
    });
    const fimPrevisto = ciclo.prazoPrevistoAt;
    const fimReal = ciclo.conclusaoAt ?? ciclo.cancelamentoAt ?? null;
    const payload = montarPayloadDrake({
      externalId,
      setor,
      numeroCiclo: ciclo.numeroCiclo,
      matricula: ciclo.remanejamentoFuncionario.funcionario.matricula,
      startAt: ciclo.inicioAt,
      endAt: endDrake(ciclo, now),
    }) satisfies Prisma.InputJsonValue;
    const metadata = {
      ambiente,
      funcionario: {
        matricula: ciclo.remanejamentoFuncionario.funcionario.matricula,
        nome: ciclo.remanejamentoFuncionario.funcionario.nome,
      },
      solicitacao: {
        id: ciclo.remanejamentoFuncionario.solicitacao.id,
        tipo: ciclo.remanejamentoFuncionario.solicitacao.tipo,
      },
      ciclo: {
        id: ciclo.id,
        numero: ciclo.numeroCiclo,
        setor,
        status: ciclo.status,
        origem: ciclo.origem,
        confianca: ciclo.confianca,
      },
    } satisfies Prisma.InputJsonValue;

    const existente = await db.integracaoEventoExterno.findUnique({
      where: { chaveIdempotencia: chave },
    });
    const payloadMudou = !existente || jsonStable(existente.payload) !== jsonStable(payload);

    if (options.dryRun) {
      if (existente) {
        if (payloadMudou) resultado.eventosAtualizados += 1;
      } else {
        resultado.eventosCriados += 1;
      }
      if (!existente || payloadMudou || options.reenfileirarMesmoPayload) {
        resultado.outboxCriadas += 1;
      }
      continue;
    }

    const evento = await db.integracaoEventoExterno.upsert({
      where: { chaveIdempotencia: chave },
      create: {
        provedor,
        dominio: DOMINIO_CADASTRO,
        entidade: ENTIDADE_EVENTO_ADICIONAL,
        direcao: "SAIDA",
        acao: "SYNC_ADDITIONAL_EVENT",
        externalId,
        status,
        remanejamentoFuncionarioId: ciclo.remanejamentoFuncionarioId,
        cicloId: ciclo.id,
        numeroCiclo: ciclo.numeroCiclo,
        setor,
        chaveIdempotencia: chave,
        startAt: ciclo.inicioAt,
        endPrevistoAt: fimPrevisto,
        endRealAt: fimReal,
        payload,
        metadata,
      },
      update: {
        externalId,
        status,
        remanejamentoFuncionarioId: ciclo.remanejamentoFuncionarioId,
        cicloId: ciclo.id,
        numeroCiclo: ciclo.numeroCiclo,
        setor,
        startAt: ciclo.inicioAt,
        endPrevistoAt: fimPrevisto,
        endRealAt: fimReal,
        payload,
        metadata,
      },
    });

    if (existente) {
      if (payloadMudou) resultado.eventosAtualizados += 1;
    } else {
      resultado.eventosCriados += 1;
    }

    if (!existente || payloadMudou || options.reenfileirarMesmoPayload) {
      const statusOutbox = process.env.DRAKE_WEBHOOK_ENABLED === "true" ? "PENDENTE" : "IGNORADO";
      const erroOutbox =
        process.env.DRAKE_WEBHOOK_ENABLED === "true"
          ? null
          : "Envio externo desabilitado por configuracao";
      const outboxPendente = await db.integracaoOutbox.findFirst({
        where: {
          eventoExternoId: evento.id,
          provedor,
          ambiente,
          acao: "SYNC_ADDITIONAL_EVENT",
          status: statusOutbox,
        },
        orderBy: { createdAt: "desc" },
      });

      if (outboxPendente && !options.reenfileirarMesmoPayload) {
        await db.integracaoOutbox.update({
          where: { id: outboxPendente.id },
          data: {
            externalId,
            remanejamentoFuncionarioId: ciclo.remanejamentoFuncionarioId,
            cicloId: ciclo.id,
            payload,
            ultimoErro: erroOutbox,
            proximaTentativaAt: null,
          },
        });
        resultado.outboxAtualizadas += 1;
      } else {
        await db.integracaoOutbox.create({
          data: {
            eventoExternoId: evento.id,
            provedor,
            ambiente,
            acao: "SYNC_ADDITIONAL_EVENT",
            externalId,
            remanejamentoFuncionarioId: ciclo.remanejamentoFuncionarioId,
            cicloId: ciclo.id,
            payload,
            status: statusOutbox,
            ultimoErro: erroOutbox,
          },
        });
        resultado.outboxCriadas += 1;
      }
    }
  }

  if (!options.dryRun) {
    const ignorados = await ignorarIntegracoesDeCiclosIgnorados(db, {
      provedor,
      remanejamentoFuncionarioId: options.remanejamentoFuncionarioId,
      cicloId: options.cicloId,
    });
    resultado.eventosIgnorados = ignorados.eventosIgnorados;
    resultado.outboxIgnoradas = ignorados.outboxIgnoradas;
  }

  return resultado;
}

export async function sincronizarEventosCadastroExternoSafe(
  options: Omit<SincronizarCadastroOptions, "dryRun"> = {},
) {
  try {
    return await sincronizarEventosCadastroExterno(options);
  } catch (error) {
    console.error("Erro ao preparar eventos externos de cadastro:", error);
    return null;
  }
}
