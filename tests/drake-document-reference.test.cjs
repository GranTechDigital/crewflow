const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const ExcelJS = require('exceljs');
const core = require('../scripts/lib/drake-document-reference.cjs');
const repo = require('../scripts/lib/drake-document-reference-db.cjs');
const headers = ['ID DO DOCUMENTO','DATA DE EMISSÃO DO DOCUMENTO','DATA DE VALIDADE DO DOCUMENTO','NOME DA QUALIFICAÇÃO','SIGLA DA QUALIFICAÇÃO','TIPO DE DOCUMENTO','MATRICULA DO TRABALHADOR','NOME DO TRABALHADOR','DATA DE CRIAÇÃO DO DOCUMENTO','ÚLTIMA ALTERAÇÃO DO DOCUMENTO'];

test('Leitura em fluxo preserva identidade, datas civis, fuso e rejeita fórmulas', async () => {
  const dir = await fs.mkdtemp(path.resolve('tmp/doc-ref-test-'));
  try {
    const file = path.join(dir,'sample.xlsx'), workbook = new ExcelJS.Workbook(), sheet = workbook.addWorksheet('Dados');
    sheet.addRow(headers);
    sheet.addRow([randomUUID(),'2025-06-24','2028-06-24','ACESSO POR CORDAS','APC','Certificado / Certificate','FRI-01-11174','Teste','2026-11-05T13:17:29-03:00','2026-11-06T10:00:00-03:00']);
    sheet.addRow([randomUUID(),'2025-02-30',null,'NR 10',null,'Certificado','2',null,null,'2026-11-06T10:00:00']);
    sheet.addRow([randomUUID(),{formula:'TODAY()',result:46000},null,'NR 10',null,'Certificado','3',null,null,'2026-11-06T10:00:00']);
    await workbook.xlsx.writeFile(file);
    const items=[]; const summary=await core.readReference(file,{timeZone:'America/Sao_Paulo',batchSize:1,onBatch:async batch=>items.push(...batch)});
    assert.equal(summary.rows,3);assert.equal(summary.valid,1);assert.equal(summary.invalid,2);
    assert.equal(items[0].emission,'2025-06-24');assert.equal(items[0].expiration,'2028-06-24');assert.equal(items[0].updatedAtSource,'2026-11-06T13:00:00.000Z');
    assert.equal(core.instant(new Date('2026-11-06T10:00:00Z'),'America/Sao_Paulo'),'2026-11-06T13:00:00.000Z');
    assert.equal(core.instant('2018-07-01T10:00:00','America/Sao_Paulo'),'2018-07-01T13:00:00.000Z');
    assert.equal(core.instant('2018-01-01T10:00:00','America/Sao_Paulo'),'2018-01-01T12:00:00.000Z');
  } finally { for (const name of await fs.readdir(dir)) await fs.unlink(path.join(dir,name)); await fs.rmdir(dir); }
});

test('Relatorio aceita hifen como validade nao informada sem ocultar data invalida',()=>{
  const columns={id:0,emission:1,expiration:2,qualification:3,type:4,registration:5,updated:6};
  const row=[randomUUID(),'2026-01-01',' - ','NR 10','Certificado','0001','2026-11-09T09:00:00-03:00'];
  assert.equal(core.parseDocument(row,columns,'America/Sao_Paulo').expiration,null);
  row[2]='2026-02-30';assert.throws(()=>core.parseDocument(row,columns,'America/Sao_Paulo'),/impossível/);
});

test('PostgreSQL: idempotência, versões, duplicidades, isolamento e aplicação atômica', {skip:!process.env.DOC_REF_TEST_ENV_FILE}, async () => {
  process.loadEnvFile(process.env.DOC_REF_TEST_ENV_FILE);
  const url = new URL(process.env.DATABASE_URL);
  assert.ok(['postgres-dev','localhost','127.0.0.1'].includes(url.hostname));url.hostname='127.0.0.1';
  const { PrismaClient }=require('@prisma/client'), admin=new PrismaClient({datasources:{db:{url:url.toString()}},log:[]});
  const schema='docref_test_'+randomUUID().replaceAll('-','');
  assert.match(schema,/^docref_test_[a-f0-9]+$/);
  await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  url.searchParams.set('schema',schema);const db=new PrismaClient({datasources:{db:{url:url.toString()}},log:[]});
  try {
    const migration=await fs.readFile('prisma/migrations/20261106150000_add_drake_document_reference/migration.sql','utf8');
    for(const sql of migration.split(';').filter(x=>x.trim()))await db.$executeRawUnsafe(sql);
    const tenantId=randomUUID(), id=randomUUID(), id2=randomUUID();
    const doc=(documentId,updated='2026-11-06T13:00:00.000Z',expiration='2028-06-24')=>({row:1,documentId,registration:'0001',qualification:'NR 10',qualificationNormalized:'NR 10',type:'Certificado',typeNormalized:'CERTIFICADO',emission:'2025-06-24',expiration,updatedAtSource:updated,hash:updated+'|'+expiration});
    const begin=hash=>repo.beginLoad(db,{environment:'hmg',tenantId,hash,parserVersion:'1',timeZone:'America/Sao_Paulo',filename:'fixture.xlsx',archive:'fixture.xlsx'});
    let load=await begin('initial');await assert.rejects(begin('concurrent'),/carga ativa/);
    await repo.stageBatch(db,load,[doc(id),{...doc(id2),row:2},{...doc(id),row:3}]);
    let result=await repo.applyLoad(db,load,{rows:3});assert.equal(result.novos,2);assert.equal(result.gruposPossivelDuplicidade,1);assert.equal(result.repeticoesNoArquivo,1);
    assert.equal((await begin('initial')).skipped,true);
    load=await begin('newer');await repo.stageBatch(db,load,[doc(id,'2026-11-07T13:00:00.000Z','2029-06-24')]);result=await repo.applyLoad(db,load,{});assert.equal(result.atualizados,1);
    const [revisions]=await db.$queryRaw`SELECT COUNT(*)::int AS n FROM "DrakeDocumentoRevisao"`;assert.equal(revisions.n,1);
    load=await begin('old');await repo.stageBatch(db,load,[doc(id)]);result=await repo.applyLoad(db,load,{});assert.equal(result.antigos,1);assert.equal(result.atualizados,0);
    load=await begin('conflicting');await repo.stageBatch(db,load,[doc(id,'2026-11-07T13:00:00.000Z','2030-06-24'),{...doc(randomUUID()),row:2}]);await assert.rejects(repo.applyLoad(db,load,{}),/conteúdo diferente/);await repo.failLoad(db,load,{},'Teste de conflito');
    const [reference]=await db.$queryRaw`SELECT dados FROM "DrakeDocumentoReferencia" WHERE "documentoId"=${id}::uuid`;assert.equal(reference.dados.expiration,'2029-06-24');
    const [count]=await db.$queryRaw`SELECT COUNT(*)::int AS n FROM "DrakeDocumentoReferencia"`;assert.equal(count.n,2);
    const other=await repo.beginLoad(db,{environment:'prd',tenantId,hash:'initial',parserVersion:'1',timeZone:'America/Sao_Paulo',filename:'fixture.xlsx',archive:'fixture.xlsx'});await repo.stageBatch(db,other,[doc(id)]);result=await repo.applyLoad(db,other,{});assert.equal(result.novos,1);assert.equal(result.documentos,1);
  } finally {
    await db.$disconnect();await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);await admin.$disconnect();
  }
});
