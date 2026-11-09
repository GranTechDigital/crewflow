// Receptor persistente e worker local. Não chama APIs de sincronização do Drake.
const http = require('node:http');
const path = require('node:path');
const { configuration, authorized, receive, recordReceiptAttempt } = require('./lib/drake-document-delivery.cjs');
const { runOne } = require('./lib/drake-document-worker.cjs');

async function serve(db, config, { port = 3110, worker = false } = {}) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('PORTA_INVALIDA');
  let stopping = false, processing = false;
  const paths = new Set(['/', '/api/intake/events', '/api/integracoes/drake/documentos/webhook']);
  const server = http.createServer(async (request, response) => {
    const reply = (status, body) => {
      response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      response.end(JSON.stringify(body));
    };
    let audit = null, raw = Buffer.alloc(0);
    audit = (status, code, body) => recordReceiptAttempt(db, config, { route: request.url, status, code, body }).catch(() => undefined);
    try {
      if (request.method === 'GET' && request.url === '/healthz') return reply(200, { ok: true, worker, processing });
      if (!paths.has(request.url)) { await audit(404, 'ROTA_NAO_ENCONTRADA'); return reply(404, { error: 'Rota não encontrada.' }); }
      if (request.method !== 'POST') { await audit(405, 'METODO_NAO_PERMITIDO'); return reply(405, { error: 'Use POST.' }); }
      if (Number(request.headers['content-length']) > 65536) { await audit(413, 'CORPO_MUITO_GRANDE'); return reply(413, { error: 'Limite de 64 KiB.' }); }
      let size = 0; const chunks = [];
      for await (const chunk of request) {
        size += chunk.length;
        if (size > 65536) { await audit(413, 'CORPO_MUITO_GRANDE'); return reply(413, { error: 'Limite de 64 KiB.' }); }
        chunks.push(chunk);
      }
      let body;
      raw = Buffer.concat(chunks);
      if (!authorized(request.headers.authorization, config.token)) { await audit(401, 'CREDENCIAL_INVALIDA', raw); return reply(401, { error: 'Credencial inválida.' }); }
      if (!/^application\/json(?:\s*;|$)/i.test(request.headers['content-type'] || '') || request.headers['content-encoding']) { await audit(415, 'CONTENT_TYPE_INVALIDO', raw); return reply(415, { error: 'Envie JSON sem compressão.' }); }
      try { body = JSON.parse(raw.toString('utf8')); }
      catch { await audit(400, 'JSON_INVALIDO', raw); return reply(400, { error: 'JSON inválido.' }); }
      const result = await receive(db, body, config);
      await audit(202, 'ACEITO', raw);
      return reply(202, result);
    } catch (error) {
      const code = /^[A-Z_]+$/.test(error.message) ? error.message : 'FALHA_INTERNA';
      if (typeof audit === 'function') await audit(code === 'FALHA_INTERNA' ? 500 : 400, code, raw);
      if (!response.headersSent && !response.destroyed) reply(code === 'FALHA_INTERNA' ? 500 : 400, { error: code === 'FALHA_INTERNA' ? 'Não foi possível guardar o recebimento.' : code });
    }
  });
  server.requestTimeout = 30000;
  server.headersTimeout = 15000;
  server.maxHeadersCount = 50;
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  const tick = async () => {
    if (stopping || processing || !worker) return;
    processing = true;
    try { const result = await runOne(db, config); if (result) console.log(JSON.stringify(result)); }
    catch { console.error('Falha no worker de referência; confira os estados persistidos.'); }
    finally { processing = false; }
  };
  const timer = worker ? setInterval(tick, 3000) : null;
  await tick();
  console.log(JSON.stringify({ service: 'drake-document-reference', port, worker, route: '/api/integracoes/drake/documentos/webhook' }));
  return { server, close: async () => {
    stopping = true;
    if (timer) clearInterval(timer);
    await new Promise(resolve => server.close(resolve));
    while (processing) await new Promise(resolve => setTimeout(resolve, 100));
  }};
}

if (require.main === module) (async () => {
  const args = process.argv.slice(2), i = args.indexOf('--env-file');
  if (args.some((arg, index) => !['--env-file', '--worker'].includes(arg) && index !== i + 1)) throw Error('ARGUMENTO_INVALIDO');
  if (i >= 0) process.loadEnvFile(path.resolve(args[i + 1]));
  const config = configuration();
  const { PrismaClient } = require('@prisma/client'), db = new PrismaClient({ log: [] });
  try {
    await db.$queryRaw`SELECT COUNT(*)::int FROM "DrakeDocumentoEntrega"`;
    const service = await serve(db, config, { port: Number(process.env.DRAKE_CAPTURE_PORT || 3110), worker: args.includes('--worker') });
    let closing = false;
    const shutdown = async () => { if (closing) return; closing = true; await service.close(); await db.$disconnect(); };
    process.once('SIGINT', shutdown); process.once('SIGTERM', shutdown);
  } catch (error) { await db.$disconnect(); throw error; }
})().catch(() => { console.error('Receptor não iniciado. Confira configuração, banco e porta.'); process.exitCode = 1; });

module.exports = { serve };
