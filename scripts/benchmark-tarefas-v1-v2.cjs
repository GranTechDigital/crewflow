#!/usr/bin/env node

/* eslint-disable no-console */
const { performance } = require("perf_hooks");

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = "true";
      continue;
    }
    args[key] = next;
    i += 1;
  }
  return args;
}

function toInt(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * p;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] === undefined) return sorted[base];
  return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
}

function summarize(results) {
  const durations = results.map((r) => r.durationMs);
  const bytes = results.map((r) => r.payloadBytes);
  const items = results.map((r) => r.itemsCount || 0);

  return {
    count: results.length,
    avgMs:
      durations.reduce((sum, current) => sum + current, 0) / results.length,
    minMs: Math.min(...durations),
    p50Ms: percentile(durations, 0.5),
    p95Ms: percentile(durations, 0.95),
    maxMs: Math.max(...durations),
    avgPayloadBytes:
      bytes.reduce((sum, current) => sum + current, 0) / results.length,
    avgItems: items.reduce((sum, current) => sum + current, 0) / results.length,
  };
}

function extractItemsCount(endpointType, body) {
  if (!body || typeof body !== "object") return 0;

  if (endpointType === "v2") {
    return Array.isArray(body.items) ? body.items.length : 0;
  }

  const solicitacoes = Array.isArray(body)
    ? body
    : Array.isArray(body.solicitacoes)
      ? body.solicitacoes
      : [];

  let total = 0;
  for (const solicitacao of solicitacoes) {
    const funcionarios = Array.isArray(solicitacao?.funcionarios)
      ? solicitacao.funcionarios
      : [];
    for (const funcionario of funcionarios) {
      const tarefas = Array.isArray(funcionario?.tarefas) ? funcionario.tarefas : [];
      total += tarefas.length;
    }
  }

  return total;
}

async function timedFetch(url, headers, endpointType) {
  const start = performance.now();
  const response = await fetch(url, {
    method: "GET",
    headers,
    cache: "no-store",
  });
  const text = await response.text();
  const end = performance.now();

  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  return {
    ok: response.ok,
    status: response.status,
    durationMs: end - start,
    payloadBytes: Buffer.byteLength(text, "utf8"),
    itemsCount: extractItemsCount(endpointType, json),
    errorBody: response.ok ? null : text,
  };
}

async function runScenario({
  name,
  endpointType,
  url,
  warmup,
  iterations,
  headers,
}) {
  console.log(`\n[${name}]`);
  console.log(`URL: ${url}`);
  console.log(`Warmup: ${warmup} | Iteracoes: ${iterations}`);

  for (let i = 0; i < warmup; i += 1) {
    try {
      await timedFetch(url, headers, endpointType);
    } catch (error) {
      console.log(`Warmup ${i + 1} falhou: ${String(error.message || error)}`);
    }
  }

  const success = [];
  const failures = [];

  for (let i = 0; i < iterations; i += 1) {
    try {
      const result = await timedFetch(url, headers, endpointType);
      if (result.ok) {
        success.push(result);
        continue;
      }
      failures.push(result);
    } catch (error) {
      failures.push({
        ok: false,
        status: 0,
        durationMs: 0,
        payloadBytes: 0,
        itemsCount: 0,
        errorBody: String(error.message || error),
      });
    }
  }

  if (success.length === 0) {
    return {
      name,
      endpointType,
      summary: null,
      failures,
    };
  }

  return {
    name,
    endpointType,
    summary: summarize(success),
    failures,
  };
}

function printSummary(report) {
  if (!report.summary) {
    console.log("Sem respostas OK.");
    if (report.failures[0]) {
      console.log(
        `Primeira falha: status=${report.failures[0].status} body=${String(report.failures[0].errorBody || "").slice(0, 300)}`,
      );
    }
    return;
  }

  const s = report.summary;
  console.table([
    {
      endpoint: report.name,
      ok: s.count,
      falhas: report.failures.length,
      avg_ms: Number(s.avgMs.toFixed(2)),
      p50_ms: Number(s.p50Ms.toFixed(2)),
      p95_ms: Number(s.p95Ms.toFixed(2)),
      min_ms: Number(s.minMs.toFixed(2)),
      max_ms: Number(s.maxMs.toFixed(2)),
      avg_payload_kb: Number((s.avgPayloadBytes / 1024).toFixed(2)),
      avg_tarefas: Number(s.avgItems.toFixed(2)),
    },
  ]);
}

function buildUrl(baseUrl, path, searchParams) {
  const url = new URL(path, baseUrl);
  for (const [key, value] of Object.entries(searchParams)) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help === "true") {
    console.log(`Uso:
node scripts/benchmark-tarefas-v1-v2.cjs --cookie "auth-token=..." --responsavel RH

Opcoes:
--baseUrl        Default: http://localhost:3000
--cookie         Cookie completo para autenticacao
--bearer         Authorization Bearer token (opcional)
--responsavel    RH|MEDICINA|TREINAMENTO|ALL (default RH)
--iterations     Default: 20
--warmup         Default: 3
--v2limit        Default: 60
--q              Busca textual (opcional)`);
    return;
  }

  const baseUrl = args.baseUrl || "http://localhost:3000";
  const responsavelRaw = (args.responsavel || "RH").toUpperCase();
  const responsavel = responsavelRaw === "ALL" ? "" : responsavelRaw;
  const iterations = toInt(args.iterations, 20);
  const warmup = toInt(args.warmup, 3);
  const v2limit = toInt(args.v2limit, 60);
  const q = args.q || "";

  const headers = {};
  if (args.cookie) headers.Cookie = args.cookie;
  if (args.bearer) headers.Authorization = `Bearer ${args.bearer}`;

  if (!args.cookie && !args.bearer) {
    console.log(
      "Aviso: sem --cookie/--bearer, os endpoints autenticados devem retornar 401.",
    );
  }

  const v1Url = buildUrl(baseUrl, "/api/logistica/remanejamentos", {
    filtrarProcesso: "false",
    responsavel: responsavel || undefined,
  });
  const v2Url = buildUrl(baseUrl, "/api/v2/tarefas", {
    limit: v2limit,
    responsavel: responsavel || undefined,
    q: q || undefined,
  });

  const v1 = await runScenario({
    name: "V1 /api/logistica/remanejamentos",
    endpointType: "v1",
    url: v1Url,
    warmup,
    iterations,
    headers,
  });

  const v2 = await runScenario({
    name: "V2 /api/v2/tarefas",
    endpointType: "v2",
    url: v2Url,
    warmup,
    iterations,
    headers,
  });

  printSummary(v1);
  printSummary(v2);

  if (v1.summary && v2.summary) {
    const latencyGain = ((v1.summary.avgMs - v2.summary.avgMs) / v1.summary.avgMs) * 100;
    const payloadGain =
      ((v1.summary.avgPayloadBytes - v2.summary.avgPayloadBytes) /
        v1.summary.avgPayloadBytes) *
      100;

    console.log("\nComparativo:");
    console.log(
      `Latencia media: V1=${v1.summary.avgMs.toFixed(2)}ms | V2=${v2.summary.avgMs.toFixed(2)}ms | ganho=${latencyGain.toFixed(2)}%`,
    );
    console.log(
      `Payload medio: V1=${(v1.summary.avgPayloadBytes / 1024).toFixed(2)}KB | V2=${(v2.summary.avgPayloadBytes / 1024).toFixed(2)}KB | ganho=${payloadGain.toFixed(2)}%`,
    );
  }
}

main().catch((error) => {
  console.error("Falha no benchmark:", error);
  process.exit(1);
});
