/**
 * Worker periodico da outbox Drake.
 *
 * Chama o endpoint interno de processamento em sessao de sincronismo.
 * O envio fica protegido por DRAKE_OUTBOX_WORKER_ENABLED=true no compose/env.
 */

const TARGET_URL =
  process.env.DRAKE_OUTBOX_TARGET_URL ||
  "http://app:3001/api/admin/integracoes/drake/outbox/processar";
const SERVICE_TOKEN = process.env.DRAKE_OUTBOX_SERVICE_TOKEN || "";
const INTERVAL_MINUTES = Math.max(
  Number(process.env.DRAKE_OUTBOX_INTERVAL_MINUTES || 60),
  1,
);
const LIMIT = Math.min(
  Math.max(Number(process.env.DRAKE_OUTBOX_LIMIT || 1000), 1),
  5000,
);
const AMBIENTE = String(process.env.DRAKE_ENVIRONMENT || "hmg")
  .trim()
  .toLowerCase();
const INITIAL_DELAY_MS = Math.max(
  Number(process.env.DRAKE_OUTBOX_INITIAL_DELAY_MS || 60000),
  5000,
);

if (!SERVICE_TOKEN) {
  console.error("[drake-outbox-worker] ERRO: DRAKE_OUTBOX_SERVICE_TOKEN nao configurado.");
  process.exit(1);
}

let timer = null;
let running = false;

async function processOutbox() {
  if (running) {
    console.log("[drake-outbox-worker] Execucao anterior ainda em andamento; pulando.");
    return;
  }

  running = true;
  const startedAt = new Date().toISOString();
  console.log(
    `[drake-outbox-worker] Processando outbox @ ${startedAt} ambiente=${AMBIENTE} limit=${LIMIT}`,
  );

  try {
    const response = await fetch(TARGET_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_TOKEN}`,
      },
      body: JSON.stringify({
        ambiente: AMBIENTE,
        limit: LIMIT,
      }),
    });
    const text = await response.text();
    if (!response.ok) {
      console.error(
        `[drake-outbox-worker] Falha no processamento: status=${response.status} body=${text}`,
      );
      return;
    }

    const data = JSON.parse(text);
    console.log(
      "[drake-outbox-worker] Resultado:",
      JSON.stringify({
        totalElegivel: data.totalElegivel,
        enviados: data.enviados,
        falhas: data.falhas,
        ignorados: data.ignorados,
        desabilitados: data.desabilitados,
        primeiro: data.resultados?.[0]
          ? {
              id: data.resultados[0].id,
              statusNovo: data.resultados[0].statusNovo,
              ok: data.resultados[0].ok,
            }
          : null,
        ultimo: data.resultados?.length
          ? {
              id: data.resultados[data.resultados.length - 1].id,
              statusNovo: data.resultados[data.resultados.length - 1].statusNovo,
              ok: data.resultados[data.resultados.length - 1].ok,
            }
          : null,
      }),
    );
  } catch (error) {
    console.error("[drake-outbox-worker] Erro ao chamar endpoint:", error);
  } finally {
    running = false;
  }
}

function scheduleNext(delayMs) {
  timer = setTimeout(async () => {
    await processOutbox();
    scheduleNext(INTERVAL_MINUTES * 60 * 1000);
  }, delayMs);
}

process.on("SIGINT", () => {
  if (timer) clearTimeout(timer);
  console.log("[drake-outbox-worker] Encerrado via SIGINT");
  process.exit(0);
});

process.on("SIGTERM", () => {
  if (timer) clearTimeout(timer);
  console.log("[drake-outbox-worker] Encerrado via SIGTERM");
  process.exit(0);
});

console.log("[drake-outbox-worker] Iniciado.");
console.log("[drake-outbox-worker] TARGET_URL=", TARGET_URL);
console.log(`[drake-outbox-worker] Intervalo: ${INTERVAL_MINUTES} minuto(s)`);
scheduleNext(INITIAL_DELAY_MS);
