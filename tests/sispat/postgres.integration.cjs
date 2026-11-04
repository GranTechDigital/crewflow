// Executa em schema descartável exclusivo, nunca nas tabelas públicas do app.
const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const ExcelJS = require('exceljs');
const { PrismaClient } = require('@prisma/client');
const { loader } = require('./loader.cjs');
if (!process.env.SISPAT_TEST_ENV_FILE) throw Error('Defina SISPAT_TEST_ENV_FILE apontando para o .env do banco local de desenvolvimento.');
process.loadEnvFile(process.env.SISPAT_TEST_ENV_FILE);
const url = new URL(process.env.DATABASE_URL);
if (!['postgres-dev', 'localhost', '127.0.0.1'].includes(url.hostname)) throw Error('Testes permitidos somente em PostgreSQL local.');
url.hostname = '127.0.0.1'; url.searchParams.set('connection_limit', '5');
const schema = 'sispat_test_' + crypto.randomBytes(8).toString('hex');
const admin = new PrismaClient({ datasources: { db: { url: url.toString() } } });
url.searchParams.set('schema', schema);
const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
const load = loader({ '@/lib/prisma': { prisma: db } });
const service = load('src/lib/sispat/imports.ts');
const { parseSispatWorkbook } = load('src/lib/sispat/workbook.ts');
const initial = new Date('2026-11-04T10:00:00Z');
async function parsed(rows) {
  const workbook = new ExcelJS.Workbook(); workbook.addWorksheet('SISPAT').addRows([['Matrícula', 'SISPAT'], ...rows]);
  return parseSispatWorkbook(Buffer.from(await workbook.xlsx.writeBuffer()), true);
}
async function employees(rows) {
  for (const [id,matricula,sispat] of rows) await db.$executeRaw`INSERT INTO "Funcionario" ("id","nome","matricula","sispat","atualizadoEm") VALUES (${id},${'Pessoa '+id},${matricula},${sispat},${initial})`;
}
async function current() { return db.$queryRaw`SELECT * FROM "Funcionario" ORDER BY "id"`; }
async function create(rows,actor=1) { return service.createSispatImport(await parsed(rows),'teste.xlsx',actor,'Operador local'); }
before(async()=>{
  assert.match(schema,/^sispat_test_[a-f0-9]{16}$/);
  await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  assert.equal((await db.$queryRaw`SELECT current_schema() AS schema`)[0].schema,schema);
  await db.$executeRaw`CREATE TABLE "Funcionario" ("id" INTEGER PRIMARY KEY,"nome" TEXT NOT NULL,"matricula" TEXT UNIQUE NOT NULL,"sispat" TEXT,"atualizadoEm" TIMESTAMP(3) NOT NULL)`;
  await db.$executeRaw`CREATE TABLE "Usuario" ("id" INTEGER PRIMARY KEY, "funcionarioId" INTEGER NOT NULL)`;
  for (const name of ['20261104180000_add_sispat_importacao','20261104190000_add_sispat_revisao']) {
    const sql=fs.readFileSync(`prisma/migrations/${name}/migration.sql`,'utf8').replace(/^\uFEFF/,'');
    for(const statement of sql.split(';').filter(s=>s.trim())) await db.$executeRawUnsafe(statement);
  }
});
beforeEach(async()=>{
  assert.equal((await db.$queryRaw`SELECT current_schema() AS schema`)[0].schema,schema);
  await db.$executeRaw`TRUNCATE "SispatImportacao", "Usuario", "Funcionario"`;
});
after(async()=>{await db.$disconnect();if(/^sispat_test_[a-f0-9]{16}$/.test(schema))await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);await admin.$disconnect();});

test('Backup existe antes da gravação; iguais não mudam nem timestamp; resultado persiste e desfazer restaura inclusive NULL',async()=>{
  await employees([[1,'IGUAL','000111'],[2,'ALTERAR','222'],[3,'NOVO',null]]);
  const run=await create([['IGUAL','000111'],['ALTERAR','333'],['NOVO','444'],['SEM','Sem SISPAT'],['AUSENTE','555']]);
  assert.equal(run.resumo.SEM_ALTERACAO,1);assert.equal(run.resumo.PENDENTE,2);assert.equal(run.resumo.IGNORADO,1);assert.equal(run.resumo.NAO_ENCONTRADO,1);
  const backup=await service.downloadSispatBackup(run.id);assert.equal(backup.registros.find(r=>r.matricula==='ALTERAR').anterior,'222');assert.equal(backup.registros.find(r=>r.matricula==='NOVO').anterior,null);
  assert.deepEqual((await current()).map(r=>r.sispat),['000111','222',null]);
  const applied=await service.confirmSispatImport(run.id,1);assert.equal(applied.resumo.ATUALIZADO,2);
  let rows=await current();assert.deepEqual(rows.map(r=>r.sispat),['000111','333','444']);assert.equal(rows[0].atualizadoEm.toISOString(),initial.toISOString());assert.ok(rows[1].atualizadoEm>initial);
  const reloaded=loader({'@/lib/prisma':{prisma:db}})('src/lib/sispat/imports.ts');assert.equal((await reloaded.getSispatImport(run.id)).status,'APLICADA');
  const undone=await service.revertSispatImport(run.id,2);assert.equal(undone.status,'DESFEITA');assert.equal(undone.resumo.DESFEITO,2);
  rows=await current();assert.deepEqual(rows.map(r=>r.sispat),['000111','222',null]);assert.equal(rows[0].atualizadoEm.toISOString(),initial.toISOString());
  await assert.rejects(service.revertSispatImport(run.id,2),/uma única vez/);
});
test('Todos já corretos: conclui sem UPDATE e sem habilitar restauração',async()=>{
  await employees([[1,'A','123']]);const run=await create([['A','123']]);const result=await service.confirmSispatImport(run.id,1);assert.equal(result.status,'CONCLUIDA');assert.equal((await current())[0].atualizadoEm.toISOString(),initial.toISOString());await assert.rejects(service.revertSispatImport(run.id,1));
});
test('Erros por linha ficam persistidos e paginados e bloqueiam confirmação inteira',async()=>{
  await employees([[1,'A','123']]);const run=await create([['A','444'],['DUP','1'],['DUP','2'],['INVALIDO','abc'],['SEM','']]);assert.equal(run.status,'INVALIDA');assert.equal(run.resumo.ERRO,3);
  const page1=await service.getSispatImport(run.id,1,2,'ERRO');const page2=await service.getSispatImport(run.id,2,2,'ERRO');assert.equal(page1.totalItens,3);assert.equal(page1.itens.length,2);assert.equal(page2.itens.length,1);assert.ok(page1.itens.every(r=>r.status==='ERRO'));
  await assert.rejects(service.confirmSispatImport(run.id,1));assert.equal((await current())[0].sispat,'123');
});
test('Conflito no segundo lote reverte o primeiro e registra cada linha como não aplicada',async()=>{
  await employees(Array.from({length:301},(_,i)=>[i+1,String(i),'100']));const run=await create(Array.from({length:301},(_,i)=>[String(i),'200']));
  await db.$executeRaw`UPDATE "Funcionario" SET "sispat"='999' WHERE "id"=301`;
  await assert.rejects(service.confirmSispatImport(run.id,1),/Nenhuma alteração/);
  const rows=await current();assert.ok(rows.slice(0,300).every(r=>r.sispat==='100'));assert.equal(rows[300].sispat,'999');const detail=await service.getSispatImport(run.id);assert.equal(detail.status,'ERRO');assert.equal(detail.resumo.NAO_APLICADO,301);assert.equal(detail.resumo.ATUALIZADO,0);
});
test('Desfazer bloqueia mudanças posteriores e preserva todas as linhas, sem restauração parcial',async()=>{
  await employees([[1,'A','100'],[2,'B','200']]);const run=await create([['A','111'],['B','222']]);await service.confirmSispatImport(run.id,1);await db.$executeRaw`UPDATE "Funcionario" SET "sispat"='999',"atualizadoEm"=clock_timestamp() WHERE "id"=2`;
  await assert.rejects(service.revertSispatImport(run.id,1),/Restauração bloqueada/);assert.deepEqual((await current()).map(r=>r.sispat),['111','999']);const detail=await service.getSispatImport(run.id);assert.equal(detail.status,'APLICADA');assert.match(detail.erro,/Nenhum SISPAT/);
});
test('Confirmação concorrente aplica uma única vez e replay não altera o resultado',async()=>{
  await employees([[1,'A','100']]);const run=await create([['A','200']]);const results=await Promise.allSettled([service.confirmSispatImport(run.id,1),service.confirmSispatImport(run.id,1)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);assert.equal((await service.getSispatImport(run.id)).status,'APLICADA');assert.equal((await current())[0].sispat,'200');
});
test('Autoria e validade da prévia são verificadas antes de qualquer atualização',async()=>{
  await employees([[1,'A','100']]);const run=await create([['A','200']]);await assert.rejects(service.confirmSispatImport(run.id,2),/Somente quem/);assert.equal((await service.getSispatImport(run.id)).status,'PREVIA');
  await db.$executeRaw`UPDATE "SispatImportacao" SET "criadoEm"=CURRENT_TIMESTAMP-interval '16 minutes' WHERE "id"=${run.id}`;await assert.rejects(service.confirmSispatImport(run.id,1),/expirou/);assert.equal((await current())[0].sispat,'100');
});
test('Se a gravação do resultado falhar, as alterações de funcionários também são desfeitas',async()=>{
  await employees([[1,'A','100']]);const run=await create([['A','200']]);
  await db.$executeRawUnsafe(`CREATE FUNCTION audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."status" = 'APLICADA' THEN RAISE EXCEPTION 'falha simulada no histórico'; END IF; RETURN NEW; END; $$`);
  await db.$executeRawUnsafe(`CREATE TRIGGER fail_audit BEFORE UPDATE ON "SispatImportacao" FOR EACH ROW EXECUTE FUNCTION audit_failure()`);
  try{await assert.rejects(service.confirmSispatImport(run.id,1));assert.equal((await current())[0].sispat,'100');assert.equal((await service.getSispatImport(run.id)).status,'ERRO');}
  finally{await db.$executeRawUnsafe('DROP TRIGGER fail_audit ON "SispatImportacao"');await db.$executeRawUnsafe('DROP FUNCTION audit_failure()');}
});
test('Paginação e filtro são aplicados no banco; histórico não envia os backups completos',async()=>{
  const run=await create(Array.from({length:125},(_,i)=>['A'+i,'123']));const page=await service.getSispatImport(run.id,2,50);assert.equal(page.itens.length,50);assert.equal(page.itens[0].linha,52);assert.equal(page.totalItens,125);assert.equal('registros' in page,false);
  for(let i=0;i<11;i++)await create([['A','123']]);const history=await service.listSispatImports(2,10);assert.equal(history.total,12);assert.equal(history.importacoes.length,2);assert.ok(history.importacoes.every(r=>!('registros'in r)));
  await assert.rejects(service.getSispatImport(run.id,1,50,'__proto__'),/Situação inválida/);
});

test('Separa preenchimentos e substituições e preserva nomes de autoria e restauração', async()=>{
 await employees([[1,'A',null],[2,'B','222']]);const run=await service.createSispatImport(await parsed([['A','111'],['B','333']]),'nomes.xlsx',1,'Maria da Logística');
 assert.equal(run.novosCadastros,1);assert.equal(run.substituicoes,1);assert.equal(run.criadoPorNome,'Maria da Logística');
 assert.equal((await service.getSispatImport(run.id,1,50,'CADASTRO')).itens[0].matricula,'A');assert.equal((await service.getSispatImport(run.id,1,50,'SUBSTITUICAO')).itens[0].matricula,'B');
 await service.confirmSispatImport(run.id,1);await service.revertSispatImport(run.id,2,'João Administrador');
 const detail=await service.getSispatImport(run.id);assert.equal(detail.restauradoPorNome,'João Administrador');assert.equal(detail.criadoPorNome,'Maria da Logística');assert.equal(detail.restauradoPorId,2);
 const history=await service.listSispatImports();assert.equal(history.importacoes[0].restauradoPorNome,'João Administrador');
});
test('Alerta de SISPAT compartilhado inclui funcionários fora da planilha, é paginado e não bloqueia', async()=>{
 await employees([[1,'ALVO',null],...Array.from({length:60},(_,i)=>[i+2,'EXISTENTE-'+i,'777'])]);const run=await create([['ALVO','777']]);assert.equal(run.linhasComAlerta,1);assert.equal(run.numerosDuplicados,1);
 const result=await service.getSispatImport(run.id,1,50,'DUPLICIDADE');assert.equal(result.itens.length,1);assert.equal(result.itens[0].alertaDuplicidade,true);
 const participants=await service.getSispatDuplicate(run.id,'777',2,50);assert.equal(participants.total,61);assert.equal(participants.itens.length,11);assert.ok(participants.itens.every(p=>p.origem==='CADASTRO'));
 await service.confirmSispatImport(run.id,1);assert.equal((await current())[0].sispat,'777');
 const issues=Buffer.from(await service.downloadSispatIssues(run.id));const wb=new ExcelJS.Workbook();await wb.xlsx.load(issues);assert.equal(wb.getWorksheet('Duplicidades').rowCount,62);assert.deepEqual(wb.getWorksheet('Corrigir e importar').getRow(1).values.slice(1),['Matrícula','SISPAT']);
});
test('Trocas que resolvem um vínculo não recebem falso alerta de duplicidade',async()=>{
 await employees([[1,'A','100'],[2,'B','200']]);const run=await create([['A','200'],['B','100']]);assert.equal(run.numerosDuplicados,0);assert.equal(run.linhasComAlerta,0);await service.confirmSispatImport(run.id,1);assert.deepEqual((await current()).map(r=>r.sispat),['200','100']);
});

test('Análises antigas sem tipoAlteracao mantêm resumo e filtros corretos',async()=>{
 await employees([[1,'A',null],[2,'B','100']]);const run=await create([['A','200'],['B','300']]);
 await db.$executeRaw`UPDATE "SispatImportacao" SET "registros"=(SELECT jsonb_agg(item-'tipoAlteracao') FROM jsonb_array_elements("registros") item) WHERE "id"=${run.id}`;
 const detail=await service.getSispatImport(run.id);assert.equal(detail.novosCadastros,1);assert.equal(detail.substituicoes,1);
 assert.equal((await service.getSispatImport(run.id,1,50,'SUBSTITUICAO')).itens[0].matricula,'B');assert.equal(detail.itens[0].tipoAlteracao,'CADASTRO');assert.equal((await service.downloadSispatBackup(run.id)).substituicoes,1);
});

test('Progresso informa lotes reais e aguarda confirmação final da transação', async()=>{
 await employees(Array.from({length:301},(_,i)=>[i+1,String(i),'100']));const run=await create(Array.from({length:301},(_,i)=>[String(i),'200']));
 const events=[];const result=await service.confirmSispatImport(run.id,1,event=>events.push(event));
 assert.deepEqual(events.map(e=>[e.fase,e.processados,e.total]),[['PROCESSANDO',0,301],['PROCESSANDO',300,301],['PROCESSANDO',301,301],['CONFIRMANDO',301,301]]);
 assert.equal(result.status,'APLICADA');assert.ok((await current()).every(row=>row.sispat==='200'));
});
