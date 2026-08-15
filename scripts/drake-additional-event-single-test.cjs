const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

function loadEnv(file) {
  const fullPath = path.resolve(process.cwd(), file);
  const content = fs.readFileSync(fullPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index < 0) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

function argValue(name, fallback = "") {
  const prefix = `--${name}=`;
  const arg = process.argv.find((item) => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : fallback;
}

function cleanBaseUrl(url) {
  return String(url || "").replace(/\/+$/, "");
}

function cleanPath(value) {
  const pathValue = String(value || "");
  return pathValue.startsWith("/") ? pathValue : `/${pathValue}`;
}

function bearerValue(token) {
  const value = String(token || "").trim();
  if (!value) return "";
  return value.toLowerCase().startsWith("bearer ") ? value : `Bearer ${value}`;
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

function parseJsonSafe(text) {
  if (!String(text || "").trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function sessionIdFromResponse(data) {
  if (!data || typeof data !== "object") return null;
  for (const key of ["SessionId", "SyncSessionId", "Id", "id", "sessionId", "syncSessionId"]) {
    if (data[key]) return String(data[key]);
  }
  return null;
}

const IDENTIFICADORES_PADRAO = {
  RH: "MCD",
  MEDICINA: "MCMD",
  TREINAMENTO: "MCTR",
  LOGISTICA: "MCLG",
};

function identifierForSetor(setor) {
  const setorKey = String(setor || "").trim().toUpperCase();
  return (
    process.env[`DRAKE_OCCURRENCE_TYPE_IDENTIFIER_${setorKey}`] ||
    IDENTIFICADORES_PADRAO[setorKey] ||
    ""
  ).trim();
}

function environmentName() {
  return String(process.env.DRAKE_ENVIRONMENT || process.env.NODE_ENV || "local")
    .trim()
    .toLowerCase();
}

function externalIdForEnvironment(externalId) {
  return String(externalId || "").replace(
    /^crew:cadastro:[^:]+:/,
    `crew:cadastro:${environmentName()}:`,
  );
}

async function drakePost(action, body) {
  const baseUrl = cleanBaseUrl(process.env.DRAKE_API_BASE_URL);
  const basePath = cleanPath(process.env.DRAKE_SYNC_SESSION_BASE_PATH || "/api/v2/Integration/SyncSession").replace(/\/+$/, "");
  const response = await fetch(`${baseUrl}${basePath}/${action}`, {
    method: "POST",
    headers: {
      [process.env.DRAKE_AUTH_HEADER_NAME || "Authorization"]: bearerValue(process.env.DRAKE_API_KEY),
      [process.env.DRAKE_TENANT_HEADER_NAME || "X-SAPIENSIA-TenantId"]: String(process.env.DRAKE_TENANT_ID || ""),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Drake ${action} HTTP ${response.status}: ${text.slice(0, 2000)}`);
  }
  return { status: response.status, text, data: parseJsonSafe(text) };
}

async function main() {
  loadEnv(argValue("env-file", process.env.DRAKE_ENV_FILE || ".env.dev"));
  process.env.DATABASE_URL = String(process.env.DATABASE_URL || "").replace("@postgres-dev:", "@localhost:");

  const cicloId = argValue("ciclo-id");
  const addDays = Number(argValue("add-days", "0"));
  const ambiente = environmentName();
  if (!cicloId) throw new Error("Informe --ciclo-id=<id>");

  const prisma = new PrismaClient();
  try {
    const evento = await prisma.integracaoEventoExterno.findFirst({
      where: {
        provedor: "DRAKE",
        cicloId,
      },
      include: {
        remanejamentoFuncionario: {
          include: {
            funcionario: { select: { matricula: true, nome: true } },
          },
        },
        ciclo: true,
      },
    });
    if (!evento || !evento.ciclo || !evento.remanejamentoFuncionario?.funcionario?.matricula) {
      throw new Error(`Evento/ciclo nao encontrado para ciclo ${cicloId}`);
    }

    const now = new Date();
    const end = new Date(now.getTime() + addDays * 24 * 60 * 60 * 1000);
    const setor = evento.setor || evento.ciclo.setor;
    const numeroCiclo = evento.numeroCiclo || evento.ciclo.numeroCiclo;
    const externalId = externalIdForEnvironment(evento.externalId);
    const payload = {
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
            Registration: evento.remanejamentoFuncionario.funcionario.matricula,
          },
        },
        OccurrenceType: {
          SyncStrategy: {
            OnInsert: "Reference",
            OnUpdate: "Reference",
          },
          Selector: {
            Identifier: identifierForSetor(setor),
          },
        },
        Start: {
          Value: isoSaoPaulo(evento.startAt),
        },
        End: {
          Value: isoSaoPaulo(end),
        },
        Justification: {
          Value: `Setor Crew: ${setor} | Ciclo Crew: ${numeroCiclo}`,
        },
      },
    };

    const sessao = await prisma.integracaoSessao.create({
      data: {
        provedor: "DRAKE",
        ambiente,
        tipo: "SYNC_SESSION_ADDITIONAL_EVENT",
        status: "ABERTA",
        totalItens: 1,
        totalLotes: 1,
        timeoutMs: 50 * 60 * 1000,
        payload: {
          origem: "single-test",
          cicloId,
          externalId,
          addDays,
          payload,
        },
      },
    });

    await prisma.integracaoSessao.update({ where: { id: sessao.id }, data: { status: "ENVIANDO" } });
    const inicio = await drakePost("Start", {
      Description: `Crew - teste idempotencia ${setor}`,
      timeoutInMinutes: 50,
    });
    const sessionId = sessionIdFromResponse(inicio.data);
    if (!sessionId) throw new Error(`Nao foi possivel identificar SessionId: ${inicio.text}`);

    await drakePost("AddAdditionalEventBulk", {
      SessionId: sessionId,
      Items: [payload],
    });
    const finalizacao = await drakePost("SetFinalized", { SessionId: sessionId });

    await prisma.integracaoSessao.update({
      where: { id: sessao.id },
      data: {
        status: "FINALIZADA",
        sessionIdExterno: sessionId,
        respostaInicio: inicio.data ?? inicio.text,
        respostaFinalizacao: finalizacao.data ?? finalizacao.text,
        finalizadaAt: new Date(),
      },
    });

    console.log(JSON.stringify({
      ok: true,
      sessaoCrewId: sessao.id,
      sessionIdExterno: sessionId,
      externalId,
      setor,
      start: payload.Payload.Start.Value,
      end: payload.Payload.End.Value,
      justification: payload.Payload.Justification.Value,
    }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, erro: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exitCode = 1;
});
