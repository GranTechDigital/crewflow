const { test } = require('node:test');
const assert = require('node:assert/strict');
const { NextRequest, NextResponse } = require('next/server');
const { loader } = require('./certificados-loader.cjs');

class CertificadoError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

test('Webhook grava auditoria para credencial inválida, JSON inválido e aceite', async () => {
  const attempts = [], config = { token: 'token-de-teste', key: Buffer.alloc(32) };
  const delivery = {
    configuration: () => config,
    authorized: (header, token) => header === `Bearer ${token}`,
    receive: async () => ({ id: 'recebimento-1', status: 'PENDENTE' }),
    recordReceiptAttempt: async (_db, _config, attempt) => attempts.push(attempt),
  };
  const load = loader({
    '@/lib/prisma': { prisma: {} },
    '@/lib/integracoes/certificadosDrakeShared': { CertificadoError },
    '@/lib/integracoes/certificadosDrakeApi': {
      readCertificadoBody: async request => Buffer.from(await request.text()),
      certificadoFailure: error => NextResponse.json({ error: error.message }, { status: error instanceof CertificadoError ? error.status : 500 }),
    },
    '../../../../../../../scripts/lib/drake-document-delivery.cjs': delivery,
  });
  const route = load('src/app/api/integracoes/drake/documentos/webhook/route.ts');
  const request = (body, authorization) => new NextRequest('https://crew.test/api/integracoes/drake/documentos/webhook', {
    method: 'POST', headers: { 'content-type': 'application/json', ...(authorization ? { authorization } : {}) }, body,
  });

  assert.equal((await route.POST(request('{"a":1}', 'Bearer invalido'))).status, 401);
  assert.equal((await route.POST(request('{', 'Bearer token-de-teste'))).status, 400);
  const accepted = await route.POST(request('{"name":"arquivo"}', 'Bearer token-de-teste'));
  assert.equal(accepted.status, 200);
  assert.deepEqual(await accepted.json(), { received: true, id: 'recebimento-1', status: 'PENDENTE' });
  assert.deepEqual(attempts.map(item => [item.status, item.code, item.body.toString('utf8')]), [
    [401, 'CREDENCIAL_INVALIDA', '{"a":1}'],
    [400, 'JSON_INVALIDO', '{'],
    [200, 'ACEITO', '{"name":"arquivo"}'],
  ]);
});
