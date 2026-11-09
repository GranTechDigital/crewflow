const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const {randomUUID}=require('node:crypto');
const {loader}=require('./certificados-loader.cjs');
const repository=require('../scripts/lib/drake-document-reference-db.cjs');

test('Exclusão por ID: confirmação, escopo, concorrência e retorno ambíguo sem repetir', {skip:!process.env.DOC_DELETE_TEST_ENV_FILE},async()=>{
  process.loadEnvFile(process.env.DOC_DELETE_TEST_ENV_FILE);
  const mock=new URL(process.env.CERTIFICADO_MOCK_URL||'http://127.0.0.1:4198/drake');assert.equal(mock.protocol,'http:');assert.ok(['localhost','127.0.0.1'].includes(mock.hostname));
  const url=new URL(process.env.DATABASE_URL);assert.ok(['postgres-dev','localhost','127.0.0.1'].includes(url.hostname));url.hostname='127.0.0.1';
  const {PrismaClient}=require('@prisma/client'),admin=new PrismaClient({datasources:{db:{url:url.toString()}},log:[]});
  const schema='certdel_test_'+randomUUID().replaceAll('-','');assert.match(schema,/^certdel_test_[a-f0-9]+$/);await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);url.searchParams.set('schema',schema);
  const db=new PrismaClient({datasources:{db:{url:url.toString()}},log:[]});const old={tenant:process.env.DRAKE_TENANT_ID,environment:process.env.DRAKE_ENVIRONMENT};process.env.DRAKE_TENANT_ID=randomUUID();process.env.DRAKE_ENVIRONMENT='hmg';
  const base=loader({'@/lib/prisma':{prisma:db}}),transport=base('src/lib/integracoes/drakeClient.ts');let timeout=3000;
  const load=loader({'@/lib/prisma':{prisma:db},'src/lib/integracoes/drakeClient.ts':{DrakeClientError:transport.DrakeClientError,assertDrakeConfigReady:()=>({baseUrl:'https://hmg.drake.bz',enabled:true,syncDocumentPath:'/api/v2/Integration/Sync/SyncDocument',timeoutMs:timeout}),syncDocument:(payload,options)=>transport.syncDocument(payload,{...options,baseUrl:mock.toString(),apiKey:'local-only',tenantId:'local-only',authHeaderName:'Authorization',tenantHeaderName:'X-Tenant'})}});
  const {deleteCertificateById:remove,certificateDeletePayload,restoreCertificateDeletion:undo,certificateRestorePayload}=load('src/lib/integracoes/certificadosDrakeDelete.ts');
  const stats=async()=>{const r=await fetch(mock+'/__stats');assert.equal(r.status,200);return r.json()};
  try{
    await db.$executeRawUnsafe('CREATE TABLE "Usuario" (id INTEGER PRIMARY KEY)');await db.$executeRawUnsafe('CREATE TABLE "Funcionario" (id INTEGER PRIMARY KEY,matricula TEXT NOT NULL)');
    for(const name of ['20261008100000_add_importacao_certificados_drake','20261105123000_harden_certificados_drake','20261106150000_add_drake_document_reference','20261106170000_add_drake_document_check','20261106190000_add_drake_document_delete','20261106200000_add_drake_document_restore']){
      const sql=(await fs.readFile('prisma/migrations/'+name+'/migration.sql','utf8')).replace(/^--.*$/gm,'');for(const statement of sql.split(';').filter(x=>x.trim()))await db.$executeRawUnsafe(statement);
    }
    await db.$executeRawUnsafe('INSERT INTO "Usuario" VALUES (1)');
    const batch=await db.importacaoCertificadoDrake.create({data:{usuarioId:1,nomeArquivo:'fixture.xlsx',hashArquivo:randomUUID(),ambiente:'hmg'}});
    const item=await db.importacaoCertificadoDrakeItem.create({data:{importacaoId:batch.id,numeroLinha:2,matricula:'0001',qualificacao:'NR 10',qualificacaoNormalizada:'NR 10',tipoDocumento:'Certificado',tipoDocumentoNormalizado:'CERTIFICADO',emissao:new Date('2026-01-01Z'),chaveIdempotencia:'fixture',status:'POSSIVEL_DUPLICIDADE'}});
    const id=randomUUID(),auditId=randomUUID(),retryId='00000000-0000-4000-8000-000000000400',unknownId='00000000-0000-4000-8000-000000000500',slowId='00000000-0000-4000-8000-000000000408',ignoredId='00000000-0000-4000-8000-000000000999';
    const origin=await repository.beginLoad(db,{environment:'hmg',tenantId:process.env.DRAKE_TENANT_ID,hash:randomUUID(),parserVersion:'1',timeZone:'America/Sao_Paulo',filename:'fixture.xlsx',archive:'fixture.xlsx'});
    await repository.stageBatch(db,origin,[id,auditId,retryId,unknownId,slowId,ignoredId].map((documentId,i)=>({row:i+1,documentId,registration:'0001',qualification:'NR 10',qualificationNormalized:'NR 10',type:'Certificado',typeNormalized:'CERTIFICADO',emission:'2026-01-01',expiration:'2027-01-01',online:false,updatedAtSource:new Date().toISOString(),hash:randomUUID()})));await repository.applyLoad(db,origin,{});
    const input=documentoId=>({importacaoId:batch.id,itemId:item.id,documentoId,confirmacaoId:documentoId,confirmar:true,versaoReferencia:1,justificativa:'Conferência manual de documento duplicado',usuarioId:1,usuarioNome:'Operador fixture',db});
    const callsBefore=(await stats()).calls;
    await assert.rejects(remove({...input(id),confirmar:false}),/Confirme/);
    await assert.rejects(remove({...input(id),versaoReferencia:2}),/referência mudou/);await assert.rejects(remove(input(randomUUID())),/não corresponde/);
    await db.importacaoCertificadoDrake.update({where:{id:batch.id},data:{ambiente:'prd'}});await assert.rejects(remove(input(id)),/somente em HMG/);await db.importacaoCertificadoDrake.update({where:{id:batch.id},data:{ambiente:'hmg'}});
    assert.equal((await stats()).calls,callsBefore);
    const payload=certificateDeletePayload(id);assert.deepEqual(payload,{Header:{Deleted:true,OnInsert:'Ignore',OnUpdate:'Ignore',OnDelete:'Execute'},Selector:{Id:id},Payload:{}});
    let result=await remove(input(id));assert.equal(result.status,'EXCLUSAO_ACEITA');assert.equal(result.tipoRetorno,'Deleted');assert.equal((await stats()).calls,callsBefore+1);
    await assert.rejects(remove(input(id)),/Já há uma exclusão/);assert.equal((await stats()).calls,callsBefore+1);
    const [saved]=await db.$queryRaw`SELECT * FROM "DrakeDocumentoExclusao" WHERE "documentoId"=${id}::uuid`;assert.equal(saved.usuarioNome,'Operador fixture');assert.deepEqual(saved.payload,payload);assert.ok(saved.referencia.dados);assert.equal(saved.httpStatus,200);
    assert.match(result.mensagem,/não garante/);
    const restoreInput={importacaoId:batch.id,itemId:item.id,exclusaoId:saved.id,confirmar:true,usuarioId:1,usuarioNome:'Operador fixture',db};
    await assert.rejects(undo({...restoreInput,confirmar:false}),/Confirme/);
    const restorePayload=certificateRestorePayload(saved.id,saved.referencia.dados);assert.equal(restorePayload.Header.OnUpdate,'Ignore');assert.equal(restorePayload.Selector.Id,undefined);assert.equal(restorePayload.Payload.Worker.Selector.Registration,'0001');assert.equal(restorePayload.Payload.OnlineTraining.Value,false);assert.deepEqual(restorePayload.Payload.Attachments,{Value:[]});
    await assert.rejects(async()=>certificateRestorePayload(saved.id,{...saved.referencia.dados,online:null}),/campos mínimos/);
    let restored=await undo(restoreInput);assert.equal(restored.status,'RECRIACAO_ACEITA');const afterRestore=(await stats()).calls;await assert.rejects(undo(restoreInput),/Há recriação/);assert.equal((await stats()).calls,afterRestore);
    result=await remove(input(retryId));assert.equal(result.status,'ERRO_DRAKE');const afterRejection=(await stats()).calls;await remove(input(retryId));assert.equal((await stats()).calls,afterRejection+1); // Somente nova confirmação explícita repete uma rejeição 4xx.
    result=await remove(input(unknownId));assert.equal(result.status,'NAO_CONFIRMADO');await assert.rejects(remove(input(unknownId)),/Já há uma exclusão/);
    await assert.rejects(undo({...restoreInput,exclusaoId:result.id}),/Só é possível desfazer/);
    result=await remove(input(ignoredId));assert.equal(result.status,'NAO_CONFIRMADO');
    timeout=100;const concurrent=await Promise.allSettled([remove(input(slowId)),remove(input(slowId))]);assert.equal(concurrent.filter(x=>x.status==='rejected').length,1);assert.equal(concurrent.find(x=>x.status==='fulfilled').value.status,'NAO_CONFIRMADO');timeout=3000;
    const failing=new Proxy(db,{get(target,property){if(property==='$executeRaw')return async(strings,...values)=>{if(strings.join(' ').includes('UPDATE "DrakeDocumentoExclusao"'))throw Error('Falha de auditoria simulada');return target.$executeRaw(strings,...values)};const value=target[property];return typeof value==='function'?value.bind(target):value;}});
    await assert.rejects(remove({...input(auditId),db:failing}),/pode ter ocorrido/);await assert.rejects(remove(input(auditId)),/andamento|exclus/i);
    // Fixture isolada: encerra reserva apos falha de auditoria simulada.
    await db.$executeRaw`UPDATE "DrakeDocumentoExclusao" SET status='NAO_CONFIRMADO' WHERE "documentoId"=${auditId}::uuid AND status='EM_EXECUCAO'`;
    // Uma recriação interrompida não pode produzir múltiplos novos cadastros.
    const timeoutDeletionId=randomUUID();await db.$executeRaw`INSERT INTO "DrakeDocumentoExclusao" (id,"origemId","documentoId","itemId","usuarioId","usuarioNome",justificativa,"versaoReferencia",referencia,payload,status) VALUES (${timeoutDeletionId}::uuid,${origin.sourceId}::uuid,${randomUUID()}::uuid,${item.id},1,'Fixture','Fixture',1,${JSON.stringify(saved.referencia)}::jsonb,'{}','EXCLUSAO_ACEITA')`;
    await fetch(mock+'/__restore-mode?mode=slow');timeout=100;restored=await undo({...restoreInput,exclusaoId:timeoutDeletionId});assert.equal(restored.status,'NAO_CONFIRMADO');timeout=3000;await assert.rejects(undo({...restoreInput,exclusaoId:timeoutDeletionId}),/Há recriação/);await fetch(mock+'/__restore-mode?mode=ok');
    const [counts]=await db.$queryRaw`SELECT (SELECT COUNT(*)::int FROM "DrakeDocumentoReferencia") AS referencias,(SELECT COUNT(*)::int FROM "ImportacaoCertificadoDrakeTentativa") AS envios`;assert.equal(counts.referencias,6);assert.equal(counts.envios,0);
    const unchanged=await db.importacaoCertificadoDrakeItem.findUniqueOrThrow({where:{id:item.id}});assert.equal(unchanged.status,'POSSIVEL_DUPLICIDADE');
  }finally{
    if(old.tenant===undefined)delete process.env.DRAKE_TENANT_ID;else process.env.DRAKE_TENANT_ID=old.tenant;if(old.environment===undefined)delete process.env.DRAKE_ENVIRONMENT;else process.env.DRAKE_ENVIRONMENT=old.environment;
    await db.$disconnect();await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);await admin.$disconnect();
  }
});
