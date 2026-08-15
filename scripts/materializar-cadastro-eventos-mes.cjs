const fs = require("fs");
const { PrismaClient } = require("@prisma/client");

const DEFAULT_DATABASE_URL =
  "postgresql://postgres:postgres@localhost:5432/projetogran?schema=public";
const DEFAULT_BASE_FILE =
  "C:/Users/luanx/.codex/attachments/8d4727d7-7485-4b33-9ed5-2d85513a4cc1/pasted-text.txt";
const SETORES = ["RH", "MEDICINA", "TREINAMENTO", "LOGISTICA"];
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

function matriculasFromText(text) {
  const matches = text.match(/FRI-\d{2}-\d{3,5}/g) || [];
  return [...new Set(matches.map((item) => item.trim().toUpperCase()))];
}

function monthRange(month) {
  const match = String(month || "").match(/^(\d{4})-(\d{2})$/);
  if (!match) throw new Error("Informe --month=YYYY-MM");
  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  if (monthNumber < 1 || monthNumber > 12) throw new Error("Mes invalido");
  const start = new Date(Date.UTC(year, monthNumber - 1, 1, 3, 0, 0, 0));
  const end = new Date(Date.UTC(year, monthNumber, 1, 3, 0, 0, 0));
  return { start, end };
}

function statusEvento(ciclo) {
  if (ciclo.status === "CANCELADO" || ciclo.cancelamentoAt) return "CANCELADO";
  if (ciclo.status === "CONCLUIDO" || ciclo.conclusaoAt) return "CONCLUIDO";
  return "ABERTO";
}

function endDrake(ciclo, now) {
  return ciclo.conclusaoAt || ciclo.cancelamentoAt || now;
}

function externalId({ ambiente, remanejamentoFuncionarioId, numeroCiclo, setor }) {
  return `crew:cadastro:${ambiente}:${remanejamentoFuncionarioId}:ciclo:${numeroCiclo}:setor:${setor}`;
}

function chaveIdempotencia({ remanejamentoFuncionarioId, numeroCiclo, setor }) {
  return [
    "DRAKE",
    "CADASTRO_FUNCIONARIO",
    remanejamentoFuncionarioId,
    `ciclo:${numeroCiclo}`,
    `setor:${setor}`,
  ].join(":");
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
  const month = argValue("--month");
  const ambiente = argValue("--ambiente", "production").trim().toLowerCase();
  const baseFile = argValue("--base-file", DEFAULT_BASE_FILE);
  const outFile = argValue("--out-file", `tmp-${month}-prod-ids.txt`);
  const { start, end } = monthRange(month);
  const matriculas = matriculasFromText(fs.readFileSync(baseFile, "utf8"));
  const now = new Date();

  const ciclos = await prisma.remanejamentoCiclo.findMany({
    where: {
      status: { not: "IGNORADO" },
      setor: { in: SETORES },
      inicioAt: { gte: start, lt: end },
      remanejamentoFuncionario: {
        funcionario: {
          matricula: { in: matriculas },
        },
      },
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
      { inicioAt: "asc" },
      { remanejamentoFuncionarioId: "asc" },
      { numeroCiclo: "asc" },
      { setor: "asc" },
    ],
  });

  const stats = {
    modo: apply ? "apply" : "dry-run",
    month,
    ambiente,
    baseMatriculas: matriculas.length,
    ciclosElegiveis: ciclos.length,
    eventosCriados: 0,
    eventosAtualizados: 0,
    outboxCriadas: 0,
    outboxJaExistentes: 0,
    ignorados: 0,
    outFile: apply ? outFile : null,
  };
  const outboxIds = [];

  for (const ciclo of ciclos) {
    const matricula = ciclo.remanejamentoFuncionario.funcionario.matricula;
    if (!matricula || !IDENTIFICADORES[ciclo.setor]) {
      stats.ignorados += 1;
      continue;
    }

    const ext = externalId({
      ambiente,
      remanejamentoFuncionarioId: ciclo.remanejamentoFuncionarioId,
      numeroCiclo: ciclo.numeroCiclo,
      setor: ciclo.setor,
    });
    const chave = chaveIdempotencia({
      remanejamentoFuncionarioId: ciclo.remanejamentoFuncionarioId,
      numeroCiclo: ciclo.numeroCiclo,
      setor: ciclo.setor,
    });
    const payload = payloadDrake({
      externalId: ext,
      setor: ciclo.setor,
      numeroCiclo: ciclo.numeroCiclo,
      matricula,
      startAt: ciclo.inicioAt,
      endAt: endDrake(ciclo, now),
    });
    const fimReal = ciclo.conclusaoAt || ciclo.cancelamentoAt || null;
    const metadata = {
      ambiente,
      funcionario: {
        matricula,
        nome: ciclo.remanejamentoFuncionario.funcionario.nome,
      },
      solicitacao: {
        id: ciclo.remanejamentoFuncionario.solicitacao.id,
        tipo: ciclo.remanejamentoFuncionario.solicitacao.tipo,
      },
      ciclo: {
        id: ciclo.id,
        numero: ciclo.numeroCiclo,
        setor: ciclo.setor,
        status: ciclo.status,
        origem: ciclo.origem,
        confianca: ciclo.confianca,
      },
    };

    const existente = await prisma.integracaoEventoExterno.findUnique({
      where: { chaveIdempotencia: chave },
    });
    const outboxExistente = await prisma.integracaoOutbox.findFirst({
      where: {
        provedor: "DRAKE",
        ambiente,
        acao: "SYNC_ADDITIONAL_EVENT",
        externalId: ext,
        status: { in: ["PENDENTE", "AGENDADO_SESSAO", "ENVIADO"] },
      },
      orderBy: { id: "desc" },
    });

    if (existente) stats.eventosAtualizados += 1;
    else stats.eventosCriados += 1;

    if (outboxExistente) {
      stats.outboxJaExistentes += 1;
      if (["PENDENTE"].includes(outboxExistente.status)) outboxIds.push(outboxExistente.id);
      continue;
    }

    if (!apply) {
      stats.outboxCriadas += 1;
      continue;
    }

    const evento = await prisma.integracaoEventoExterno.upsert({
      where: { chaveIdempotencia: chave },
      create: {
        provedor: "DRAKE",
        dominio: "CADASTRO_FUNCIONARIO",
        entidade: "EVENTO_ADICIONAL",
        direcao: "SAIDA",
        acao: "SYNC_ADDITIONAL_EVENT",
        externalId: ext,
        status: statusEvento(ciclo),
        remanejamentoFuncionarioId: ciclo.remanejamentoFuncionarioId,
        cicloId: ciclo.id,
        numeroCiclo: ciclo.numeroCiclo,
        setor: ciclo.setor,
        chaveIdempotencia: chave,
        startAt: ciclo.inicioAt,
        endPrevistoAt: ciclo.prazoPrevistoAt,
        endRealAt: fimReal,
        payload,
        metadata,
      },
      update: {
        externalId: ext,
        status: statusEvento(ciclo),
        remanejamentoFuncionarioId: ciclo.remanejamentoFuncionarioId,
        cicloId: ciclo.id,
        numeroCiclo: ciclo.numeroCiclo,
        setor: ciclo.setor,
        startAt: ciclo.inicioAt,
        endPrevistoAt: ciclo.prazoPrevistoAt,
        endRealAt: fimReal,
        payload,
        metadata,
      },
    });

    const outbox = await prisma.integracaoOutbox.create({
      data: {
        eventoExternoId: evento.id,
        provedor: "DRAKE",
        ambiente,
        acao: "SYNC_ADDITIONAL_EVENT",
        externalId: ext,
        remanejamentoFuncionarioId: ciclo.remanejamentoFuncionarioId,
        cicloId: ciclo.id,
        payload,
        status: "PENDENTE",
      },
    });
    outboxIds.push(outbox.id);
    stats.outboxCriadas += 1;
  }

  if (apply) fs.writeFileSync(outFile, `${outboxIds.join("\n")}\n`, "utf8");
  stats.outboxIds = outboxIds.slice(0, 20);
  stats.totalOutboxIds = outboxIds.length;
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
