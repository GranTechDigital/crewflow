const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),{randomUUID}=require('node:crypto');
const repository=require('../scripts/lib/drake-document-reference-db.cjs');
const confirmation=require('../scripts/lib/drake-document-confirmation.cjs');

test('Relatorio confirma por evidencia, preserva HTTP e bloqueia divergencia, ambiguidade e outra origem',{skip:!process.env.DOC_CONFIRM_TEST_ENV_FILE},async()=>{
 process.loadEnvFile(process.env.DOC_CONFIRM_TEST_ENV_FILE);const url=new URL(process.env.DATABASE_URL);assert.ok(['127.0.0.1','localhost','postgres-dev'].includes(url.hostname));url.hostname='127.0.0.1';
 const {PrismaClient}=require('@prisma/client'),admin=new PrismaClient({datasources:{db:{url:url.href}},log:[]}),schema='docconfirm_'+randomUUID().replaceAll('-','');assert.match(schema,/^docconfirm_[a-f0-9]+$/);url.searchParams.set('schema',schema);const db=new PrismaClient({datasources:{db:{url:url.href}},log:[]});
 const tenant=randomUUID(),sent=new Date(Date.now()-120000),fresh=new Date();
 try{
  await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  await db.$executeRawUnsafe('CREATE TABLE "Usuario" (id INTEGER PRIMARY KEY)');await db.$executeRawUnsafe('CREATE TABLE "Funcionario" (id INTEGER PRIMARY KEY)');
  for(const migration of ['20261008100000_add_importacao_certificados_drake','20261105123000_harden_certificados_drake','20261106150000_add_drake_document_reference','20261106190000_add_drake_document_delete','20261106210000_certificados_versions_edits','20261109100000_drake_document_delivery','20261109130000_drake_document_confirmation']){
   const sql=(await fs.readFile('prisma/migrations/'+migration+'/migration.sql','utf8')).replace(/^--.*$/gm,'');for(const statement of sql.split(';').filter(x=>x.trim()))await db.$executeRawUnsafe(statement);
  }
  await db.$executeRawUnsafe('INSERT INTO "Usuario" VALUES(1)');
  const batch=await db.importacaoCertificadoDrake.create({data:{usuarioId:1,nomeArquivo:'fixture.xlsx',hashArquivo:randomUUID(),ambiente:'hmg',status:'PROCESSANDO_DRAKE'}});
  const items=[];
  for(let i=0;i<7;i++){
   const payload={Payload:{OnlineTraining:{Value:false}}};
   const item=await db.importacaoCertificadoDrakeItem.create({data:{importacaoId:batch.id,numeroLinha:i+2,matricula:'00'+i,qualificacao:'NR 10',qualificacaoNormalizada:'NR 10',tipoDocumento:'Certificado',tipoDocumentoNormalizado:'CERTIFICADO',emissao:new Date('2026-01-01Z'),validade:new Date('2027-01-01Z'),status:i===4?'NAO_CONFIRMADO':i===6?'CANCELADO':'ENVIADO',enviadoEm:sent,payload,chaveIdempotencia:randomUUID()}});items.push(item);
   const attempt=await db.importacaoCertificadoDrakeTentativa.create({data:{itemId:item.id,importacaoId:batch.id,status:i===4?'NAO_CONFIRMADO':'ENVIADO',httpStatus:i===4?null:200,payload,iniciadoEm:sent,finalizadoEm:sent}});
   const origin=i===5?randomUUID():tenant;await db.$executeRaw`UPDATE "ImportacaoCertificadoDrakeTentativa" SET "drakeTenantId"=${origin}::uuid WHERE id=${attempt.id}`;
  }
  const previousBatch=await db.importacaoCertificadoDrake.create({data:{usuarioId:1,nomeArquivo:'anterior.xlsx',hashArquivo:randomUUID(),ambiente:'hmg',status:'CONCLUIDO_COM_ERROS'}});
  const copy=Object.fromEntries(Object.entries(items[4]).filter(([key])=>!['id','importacaoId','createdAt','updatedAt'].includes(key)));
  const old=await db.importacaoCertificadoDrakeItem.create({data:{...copy,importacaoId:previousBatch.id,numeroLinha:2,status:'ERRO_VALIDACAO',enviadoEm:null,updatedAt:new Date(+sent-60000)}});
  const newer=await db.importacaoCertificadoDrakeItem.create({data:{...copy,importacaoId:previousBatch.id,numeroLinha:3,status:'ERRO_VALIDACAO',enviadoEm:null,updatedAt:new Date(+sent+30000)}});
  const doc=(i,id=randomUUID(),expiration='2027-01-01')=>({row:i+1,documentId:id,registration:'00'+i,qualification:'NR 10',qualificationNormalized:'NR 10',type:'Certificado / Certificate',typeNormalized:'CERTIFICADO / CERTIFICATE',emission:'2026-01-01',expiration,online:false,updatedAtSource:sent.toISOString(),hash:randomUUID()});
  const documents=Array.from({length:7},(_,i)=>doc(i));documents[1].expiration='2028-01-01';documents.push({...doc(2),row:9});
  const begin=()=>repository.beginLoad(db,{environment:'hmg',tenantId:tenant,hash:randomUUID(),parserVersion:'1',filename:'fixture.csv',archive:'fixture',timeZone:'America/Sao_Paulo'});
  let load=await begin();await repository.stageBatch(db,load,documents);await repository.applyLoad(db,load,{}, {confirmSends:true,generatedAt:fresh});
  // Observacao anterior ao envio nunca confirma um certificado.
  await db.$executeRaw`UPDATE "DrakeDocumentoReferencia" SET "observadoEm"=${new Date(+sent-60000)} WHERE matricula='003'`;
  await db.importacaoCertificadoDrakeItem.update({where:{id:items[3].id},data:{status:'ENVIADO',confirmadoEm:null}});
  const result=await confirmation.reconcileSource(db,'hmg',tenant);assert.equal(result.aguardando,1);
  const rows=await db.importacaoCertificadoDrakeItem.findMany({where:{importacaoId:batch.id},orderBy:{id:'asc'}});
  assert.deepEqual(rows.map(x=>x.status),['CONFIRMADO','NAO_CONFIRMADO','NAO_CONFIRMADO','ENVIADO','CONFIRMADO','ENVIADO','CANCELADO']);
  assert.equal((await db.importacaoCertificadoDrakeItem.findUniqueOrThrow({where:{id:old.id}})).status,'RESOLVIDO_OUTRO_ARQUIVO');
  assert.equal((await db.importacaoCertificadoDrakeItem.findUniqueOrThrow({where:{id:newer.id}})).status,'ERRO_VALIDACAO');
  assert.ok(rows[0].confirmadoEm);assert.match(rows[1].motivoErro,/validade/);assert.match(rows[2].motivoErro,/Mais de um/);
  const attempts=await db.importacaoCertificadoDrakeTentativa.findMany();assert.equal(attempts[0].status,'ENVIADO');assert.equal(attempts[0].httpStatus,200);assert.equal(attempts[4].status,'NAO_CONFIRMADO');
  const [count1]=await db.$queryRaw`SELECT COUNT(*)::int AS n FROM "DrakeCertificadoConfirmacao"`;await confirmation.reconcileSource(db,'hmg',tenant);assert.equal((await db.$queryRaw`SELECT COUNT(*)::int AS n FROM "DrakeCertificadoConfirmacao"`)[0].n,count1.n);
  const changed={...documents[0],expiration:'2029-01-01',updatedAtSource:new Date(+fresh+1000).toISOString(),hash:randomUUID()};load=await begin();await repository.stageBatch(db,load,[changed]);await repository.applyLoad(db,load,{}, {confirmSends:true,generatedAt:new Date(+fresh+2000)});
  assert.equal((await db.importacaoCertificadoDrakeItem.findUniqueOrThrow({where:{id:items[0].id}})).status,'NAO_CONFIRMADO');
  assert.equal((await db.$queryRaw`SELECT dados->>'expiration' AS value FROM "DrakeDocumentoReferencia" WHERE "documentoId"=${changed.documentId}::uuid`)[0].value,'2029-01-01');
  const before=await db.$queryRaw`SELECT COUNT(*)::int AS n FROM "DrakeCertificadoConfirmacao"`;await confirmation.reconcileSource(db,'hmg',tenant,{dryRun:true});assert.equal((await db.$queryRaw`SELECT COUNT(*)::int AS n FROM "DrakeCertificadoConfirmacao"`)[0].n,before[0].n);
 }finally{await db.$disconnect();await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);await admin.$disconnect();}
});
