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

function chunk(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
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

function payloadComIdentifierAtualizado(item) {
  const payload = structuredClone(item.eventoExterno?.payload ?? item.payload);
  const setor = item.eventoExterno?.setor;
  const identifier = identifierForSetor(setor);
  if (payload?.Payload?.OccurrenceType?.Selector && identifier) {
    payload.Payload.OccurrenceType.Selector.Identifier = identifier;
  }
  if (payload?.Selector?.ExternalId) {
    payload.Selector.ExternalId = externalIdForEnvironment(payload.Selector.ExternalId);
  }
  return payload;
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

  const ids = argValue("ids")
    .split(",")
    .map((id) => Number(id.trim()))
    .filter((id) => Number.isInteger(id) && id > 0);
  if (ids.length === 0) throw new Error("Informe --ids=1,2,3");

  const batchSize = Math.min(Math.max(Number(argValue("batch-size", "1000")), 1), 1000);
  const timeoutMinutes = Math.min(Math.max(Number(argValue("timeout-minutes", "50")), 1), 50);
  const description = argValue("description", "Crew - teste agendado eventos cadastro");
  const ambiente = environmentName();
  const prisma = new PrismaClient();

  let sessao = null;
  try {
    const activeSession = await prisma.integracaoSessao.findFirst({
      where: {
        provedor: "DRAKE",
        ambiente,
        tipo: "SYNC_SESSION_ADDITIONAL_EVENT",
        status: { in: ["ABERTA", "ENVIANDO", "PROCESSANDO"] },
      },
      orderBy: { abertaAt: "desc" },
    });
    if (activeSession) {
      throw new Error(`Ja existe sessao ativa no Crew: #${activeSession.id}`);
    }

    const itens = await prisma.integracaoOutbox.findMany({
      where: {
        id: { in: ids },
        provedor: "DRAKE",
        ambiente,
        acao: "SYNC_ADDITIONAL_EVENT",
        status: "PENDENTE",
      },
      orderBy: { id: "asc" },
      include: { eventoExterno: true },
    });
    if (itens.length !== ids.length) {
      throw new Error(`Foram encontrados ${itens.length}/${ids.length} itens pendentes para envio.`);
    }

    sessao = await prisma.integracaoSessao.create({
      data: {
        provedor: "DRAKE",
        ambiente,
        tipo: "SYNC_SESSION_ADDITIONAL_EVENT",
        status: "ABERTA",
        totalItens: itens.length,
        totalLotes: Math.ceil(itens.length / batchSize),
        timeoutMs: timeoutMinutes * 60 * 1000,
        payload: {
          acao: "SYNC_ADDITIONAL_EVENT",
          origem: "scheduled-test",
          ambiente,
          outboxIds: itens.map((item) => item.id),
          batchSize,
          timeoutMinutes,
        },
      },
    });

    await prisma.integracaoSessao.update({
      where: { id: sessao.id },
      data: { status: "ENVIANDO" },
    });

    const inicio = await drakePost("Start", {
      Description: description,
      timeoutInMinutes: timeoutMinutes,
    });
    const sessionId = sessionIdFromResponse(inicio.data);
    if (!sessionId) throw new Error(`Nao foi possivel identificar SessionId: ${inicio.text}`);

    await prisma.integracaoSessao.update({
      where: { id: sessao.id },
      data: {
        sessionIdExterno: sessionId,
        respostaInicio: inicio.data ?? inicio.text,
      },
    });

    for (const [index, lote] of chunk(itens, batchSize).entries()) {
      const payloads = lote.map(payloadComIdentifierAtualizado);
      const respostaLote = await drakePost("AddAdditionalEventBulk", {
        SessionId: sessionId,
        Items: payloads,
      });
      await prisma.integracaoSessao.update({
        where: { id: sessao.id },
        data: {
          payload: {
            acao: "SYNC_ADDITIONAL_EVENT",
            origem: "scheduled-test",
            outboxIds: itens.map((item) => item.id),
            batchSize,
            timeoutMinutes,
            ultimoLoteEnviado: index + 1,
            ultimaRespostaLote: respostaLote.data ?? respostaLote.text,
          },
        },
      });
    }

    const finalizacao = await drakePost("SetFinalized", { SessionId: sessionId });
    const now = new Date();

    await prisma.integracaoSessao.update({
      where: { id: sessao.id },
      data: {
        status: "FINALIZADA",
        finalizadaAt: now,
        respostaFinalizacao: finalizacao.data ?? finalizacao.text,
      },
    });

    await prisma.integracaoOutbox.updateMany({
      where: { id: { in: itens.map((item) => item.id) } },
      data: {
        sessaoId: sessao.id,
        status: "AGENDADO_SESSAO",
        tentativas: { increment: 1 },
        sentAt: now,
        ultimoErro: null,
        proximaTentativaAt: null,
      },
    });

    await prisma.integracaoEventoExterno.updateMany({
      where: { id: { in: itens.map((item) => item.eventoExternoId).filter(Boolean) } },
      data: {
        ultimaSincronizacaoAt: now,
        ultimoErro: null,
      },
    });

    console.log(JSON.stringify({
      ok: true,
      sessaoCrewId: sessao.id,
      sessionIdExterno: sessionId,
      enviados: itens.map((item) => ({
        outboxId: item.id,
        externalId: externalIdForEnvironment(item.externalId),
      })),
    }, null, 2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (sessao) {
      await prisma.integracaoSessao.update({
        where: { id: sessao.id },
        data: { status: "ERRO", ultimoErro: message.slice(0, 4000) },
      }).catch(() => {});
    }
    console.error(JSON.stringify({ ok: false, erro: message }, null, 2));
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
