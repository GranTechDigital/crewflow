const fs = require("fs");
const { PrismaClient } = require("@prisma/client");

const DEFAULT_DATABASE_URL =
  "postgresql://postgres:postgres@localhost:5432/projetogran?schema=public";
const IDENTIFICADORES = {
  RH: "MCD",
  MEDICINA: "MCMD",
  TREINAMENTO: "MCTR",
  LOGISTICA: "MCLG",
};

process.env.DATABASE_URL = process.env.DATABASE_URL || DEFAULT_DATABASE_URL;

const prisma = new PrismaClient();

function hasArg(name) {
  return process.argv.includes(name);
}

function argValue(name, fallback = "") {
  const prefix = `${name}=`;
  const arg = process.argv.find((item) => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : fallback;
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function pad3(value) {
  return String(value).padStart(3, "0");
}

function isoSaoPaulo(date) {
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

function parseIds(file) {
  return fs
    .readFileSync(file, "utf8")
    .trim()
    .split(/\s+/)
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0);
}

function payloadDrake({ externalId, setor, numeroCiclo, matricula, startAt, endAt }) {
  return {
    Header: {
      OnInsert: "Execute",
      OnUpdate: "Execute",
    },
    Selector: {
      ExternalId: externalId,
    },
    Payload: {
      Worker: {
        SyncStrategy: {
          OnInsert: "Reference",
          OnUpdate: "Reference",
        },
        Selector: {
          Registration: matricula,
        },
      },
      OccurrenceType: {
        SyncStrategy: {
          OnInsert: "Reference",
          OnUpdate: "Reference",
        },
        Selector: {
          Identifier: IDENTIFICADORES[setor],
        },
      },
      Start: {
        Value: isoSaoPaulo(startAt),
      },
      End: {
        Value: endAt ? isoSaoPaulo(endAt) : null,
      },
      Justification: {
        Value: `Setor Crew: ${setor} | Ciclo Crew: ${numeroCiclo}`,
      },
    },
  };
}

async function main() {
  const apply = hasArg("--apply");
  const idsFile = argValue("--ids-file");
  const outFile = argValue("--out-file", "tmp-reenfileirar-outbox-ids.txt");
  if (!idsFile) throw new Error("Informe --ids-file=<arquivo>");

  const ids = parseIds(idsFile);
  if (!ids.length) throw new Error("Arquivo de IDs vazio");

  const originais = await prisma.integracaoOutbox.findMany({
    where: {
      id: { in: ids },
      ambiente: "production",
      provedor: "DRAKE",
      acao: "SYNC_ADDITIONAL_EVENT",
      status: { in: ["AGENDADO_SESSAO", "ENVIADO"] },
    },
    include: {
      ciclo: {
        include: {
          remanejamentoFuncionario: {
            include: {
              funcionario: { select: { matricula: true, nome: true } },
            },
          },
        },
      },
      eventoExterno: true,
    },
    orderBy: { id: "asc" },
  });

  const stats = {
    modo: apply ? "apply" : "dry-run",
    idsInformados: ids.length,
    originaisElegiveis: originais.length,
    criariaOutbox: 0,
    jaPendente: 0,
    ignorados: 0,
    outFile: apply ? outFile : null,
    outboxIds: [],
  };
  const novosIds = [];

  for (const item of originais) {
    const ciclo = item.ciclo;
    const matricula = ciclo?.remanejamentoFuncionario?.funcionario?.matricula;
    if (!ciclo || ciclo.status === "IGNORADO" || !matricula || !IDENTIFICADORES[ciclo.setor]) {
      stats.ignorados += 1;
      continue;
    }

    const payload = payloadDrake({
      externalId: item.externalId,
      setor: ciclo.setor,
      numeroCiclo: ciclo.numeroCiclo,
      matricula,
      startAt: ciclo.inicioAt,
      endAt: ciclo.conclusaoAt || ciclo.cancelamentoAt || new Date(),
    });

    const pendente = await prisma.integracaoOutbox.findFirst({
      where: {
        provedor: "DRAKE",
        ambiente: "production",
        acao: "SYNC_ADDITIONAL_EVENT",
        externalId: item.externalId,
        status: "PENDENTE",
      },
      orderBy: { id: "desc" },
    });
    if (pendente) {
      stats.jaPendente += 1;
      novosIds.push(pendente.id);
      continue;
    }

    stats.criariaOutbox += 1;
    if (!apply) continue;

    const outbox = await prisma.integracaoOutbox.create({
      data: {
        eventoExternoId: item.eventoExternoId,
        provedor: "DRAKE",
        ambiente: "production",
        acao: "SYNC_ADDITIONAL_EVENT",
        externalId: item.externalId,
        remanejamentoFuncionarioId: item.remanejamentoFuncionarioId,
        cicloId: item.cicloId,
        payload,
        status: "PENDENTE",
      },
    });

    if (item.eventoExternoId) {
      await prisma.integracaoEventoExterno.update({
        where: { id: item.eventoExternoId },
        data: {
          payload,
          startAt: ciclo.inicioAt,
          endRealAt: ciclo.conclusaoAt || ciclo.cancelamentoAt || null,
          endPrevistoAt: ciclo.prazoPrevistoAt,
        },
      });
    }

    novosIds.push(outbox.id);
  }

  if (apply) fs.writeFileSync(outFile, `${novosIds.join("\n")}\n`, "utf8");
  stats.outboxIds = novosIds.slice(0, 20);
  stats.totalOutboxIds = novosIds.length;
  console.log(JSON.stringify(stats, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
