process.env.DRAKE_ENVIRONMENT='hmg';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { NextRequest } = require('next/server');
const {loader}=require('./certificados-loader.cjs');

test('Certificados restringem lista, upload, detalhe e envio a Administração e Treinamento com edição', async () => {
  const stubs = {}, load = loader(stubs);
  const access = load('src/lib/integracoes/certificadosDrakeAccess.ts');
  let user = null, databaseCalls = 0;
  Object.assign(stubs, {
    '@/lib/integracoes/certificadosDrakeAccess': access,
    '@/utils/authUtils': { getUserFromRequest: async () => user },
    '@/lib/prisma': { prisma: { importacaoCertificadoDrake: {
      count: async () => { databaseCalls++; return 0; }, findMany: async () => [],
    } } },
    '@/lib/integracoes/certificadosDrakeImportacao': {
      criarImportacaoCertificadosDrake: () => { throw new Error('Não deve importar durante teste de acesso'); },
      enviarCertificadosPendentesDrake: () => { throw new Error('Não deve enviar ao Drake durante teste de acesso'); },
    },
  });
  const base = 'src/app/api/treinamento/importacoes-certificados/';
  const list = load(base + 'route.ts');
  const detail = load(base + '[id]/route.ts');
  const send = load(base + '[id]/enviar/route.ts');
  const reference = load(base + '[id]/referencia/route.ts');
  const remove = load(base + '[id]/referencia/excluir/route.ts');
  const undo = load(base + '[id]/referencia/desfazer/route.ts');
  const cancel = load(base + '[id]/cancelar/route.ts');
  const edit = load(base + '[id]/itens/[itemId]/route.ts');
  const comment = load(base + '[id]/comentario/route.ts');
  const handlers = [
    // A consulta de candidatos usa a mesma restrição do fluxo de certificados.
    () => list.GET(new NextRequest('http://localhost/api/treinamento/importacoes-certificados')),
    () => list.POST(new NextRequest('http://localhost/api/treinamento/importacoes-certificados', { method: 'POST', body: new FormData() })),
    () => detail.GET(new NextRequest('http://localhost/api/treinamento/importacoes-certificados/invalido'), { params: Promise.resolve({ id: 'invalido' }) }),
    () => send.POST(new NextRequest('http://localhost/api/treinamento/importacoes-certificados/invalido/enviar', { method: 'POST' }), { params: Promise.resolve({ id: 'invalido' }) }),
    () => reference.GET(new NextRequest('http://localhost/api/treinamento/importacoes-certificados/invalido/referencia'), { params: Promise.resolve({ id: 'invalido' }) }),
    () => remove.POST(new NextRequest('http://localhost/api/treinamento/importacoes-certificados/invalido/referencia/excluir',{method:'POST'}), {params:Promise.resolve({id:'invalido'})}),
    () => undo.POST(new NextRequest('http://localhost/api/treinamento/importacoes-certificados/invalido/referencia/desfazer',{method:'POST'}), {params:Promise.resolve({id:'invalido'})}),
    () => cancel.POST(new NextRequest('http://localhost/api/treinamento/importacoes-certificados/invalido/cancelar',{method:'POST'}),{params:Promise.resolve({id:'invalido'})}),
    () => edit.PATCH(new NextRequest('http://localhost/api/treinamento/importacoes-certificados/invalido/itens/invalido',{method:'PATCH'}), {params:Promise.resolve({id:'invalido',itemId:'invalido'})}),
    () => comment.PATCH(new NextRequest('http://localhost/api/treinamento/importacoes-certificados/invalido/comentario',{method:'PATCH'}), {params:Promise.resolve({id:'invalido'})}),
  ];
  for (const entry of [null, 'Treinamento (Visualizador)', 'Logística', 'RH', 'Treinamento externo', 'Administração (Visualizador)', 'inativa']) {
    user = entry === null ? null : { id: 1, equipe: { nome: entry === 'inativa' ? 'Treinamento' : entry, ativo: entry !== 'inativa' } };
    for (const handler of handlers) assert.equal((await handler()).status, entry === null ? 401 : 403, String(entry));
  }
  assert.equal(databaseCalls, 0);
  for (const team of ['Administração', 'Treinamento', 'Treinamento (Editor)', 'Treinamento (Gestor)']) {
    user = { id: 1, equipe: { nome: team, ativo: true } };
    assert.equal(access.canManageDrakeCertificates(team), true);
    for (const [index, handler] of handlers.entries()) assert.equal((await handler()).status, index === 0 ? 200 : 400, team);
  }
});
