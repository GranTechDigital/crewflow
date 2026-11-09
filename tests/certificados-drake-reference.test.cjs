const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const {randomUUID}=require('node:crypto');
const ExcelJS=require('exceljs');
const {loader}=require('./certificados-loader.cjs');
const repository=require('../scripts/lib/drake-document-reference-db.cjs');

test('Referência real: classifica upload, pagina candidatos e bloqueia envio após mudança ou expiração', {skip:!process.env.DOC_REF_TEST_ENV_FILE},async()=>{
  process.loadEnvFile(process.env.DOC_REF_TEST_ENV_FILE);
  const url=new URL(process.env.DATABASE_URL);assert.ok(['postgres-dev','localhost','127.0.0.1'].includes(url.hostname));url.hostname='127.0.0.1';
  const {PrismaClient}=require('@prisma/client'),admin=new PrismaClient({datasources:{db:{url:url.toString()}},log:[]});
  const schema='certref_test_'+randomUUID().replaceAll('-','');assert.match(schema,/^certref_test_[a-f0-9]+$/);
  await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);url.searchParams.set('schema',schema);
  const db=new PrismaClient({datasources:{db:{url:url.toString()}},log:[]});
  const before={tenant:process.env.DRAKE_TENANT_ID,environment:process.env.DRAKE_ENVIRONMENT};
  process.env.DRAKE_TENANT_ID=randomUUID();process.env.DRAKE_ENVIRONMENT='hmg';
  let sends=0;
  const load=loader({'@/lib/prisma':{prisma:db},'src/lib/integracoes/drakeClient.ts':{
    assertDrakeConfigReady:()=>({baseUrl:'https://hmg.drake.bz',enabled:true,syncDocumentPath:'/api/v2/Integration/Sync/SyncDocument',timeoutMs:60000}),
    syncDocument:async()=>{sends++;throw Error('Não deve chamar transporte em itens bloqueados');},DrakeClientError:class extends Error{},
  }});
  try{
    await db.$executeRawUnsafe('CREATE TABLE "Usuario" (id INTEGER PRIMARY KEY)');
    await db.$executeRawUnsafe('CREATE TABLE "Funcionario" (id INTEGER PRIMARY KEY,matricula TEXT NOT NULL)');
    for(const name of ['20261008100000_add_importacao_certificados_drake','20261105123000_harden_certificados_drake','20261106150000_add_drake_document_reference','20261106170000_add_drake_document_check','20261106190000_add_drake_document_delete','20261106200000_add_drake_document_restore','20261106210000_certificados_versions_edits']){
      const sql=(await fs.readFile('prisma/migrations/'+name+'/migration.sql','utf8')).replace(/^--.*$/gm,'');
      for(const statement of sql.split(';').filter(x=>x.trim()))await db.$executeRawUnsafe(statement);
    }
    await db.$executeRawUnsafe('INSERT INTO "Usuario" VALUES (1)');await db.$executeRawUnsafe("INSERT INTO \"Funcionario\" VALUES (1,'0001'),(2,'0002')");
    const seed=async(registration,documents)=>{
      const job=await repository.beginLoad(db,{environment:'hmg',tenantId:process.env.DRAKE_TENANT_ID,hash:randomUUID(),parserVersion:'1',timeZone:'America/Sao_Paulo',filename:'fixture.xlsx',archive:'fixture.xlsx'});
      await repository.stageBatch(db,job,Array.from({length:documents},(_,i)=>({row:i+1,documentId:randomUUID(),registration,name:'Fixture',qualification:'NR 10',qualificationNormalized:'NR 10',type:'Certificado / Certificate',typeNormalized:'CERTIFICADO / CERTIFICATE',emission:'2026-01-01',expiration:'2027-01-01',updatedAtSource:new Date().toISOString(),hash:randomUUID()})));
      await repository.applyLoad(db,job,{});return job;
    };
    const origin=await seed('0001',2);
    const workbook=new ExcelJS.Workbook(),sheet=workbook.addWorksheet('Certificados');sheet.addRow(['Matricula','Nome','Certificadora','Qualificacao','Tipo Documento','Emissao','Validade','Recebimento']);
    for(const registration of ['0001','0002'])sheet.addRow([registration,'Fixture','','NR 10','Certificado','2026-01-01','2027-01-01','']);
    const api=load('src/lib/integracoes/certificadosDrakeImportacao.ts');
    const uploaded=await api.criarImportacaoCertificadosDrake({file:new File([await workbook.xlsx.writeBuffer()],'fixture.xlsx'),usuarioId:1,descricao:"Carga fixture",db});
    let items=await db.importacaoCertificadoDrakeItem.findMany({where:{importacaoId:uploaded.importacao.id},orderBy:{matricula:'asc'}});
    assert.equal(items[0].status,'POSSIVEL_DUPLICIDADE');assert.equal(items[1].status,'PENDENTE_ENVIO');assert.equal(uploaded.importacao.totalConflitos,1);
    const reference=load('src/lib/integracoes/certificadosDrakeReference.ts');
    let page=await reference.referenceCandidatesPage(db,'hmg',{...items[0],key:String(items[0].id)},1,1);assert.equal(page.total,2);assert.equal(page.candidatos.length,1);assert.equal(page.totalPages,2);
    const page2=await reference.referenceCandidatesPage(db,'hmg',{...items[0],key:String(items[0].id)},2,1);assert.notEqual(page.candidatos[0].id,page2.candidatos[0].id);
    await db.$executeRaw`UPDATE "DrakeDocumentoOrigem" SET "atualizadoEm"=CURRENT_TIMESTAMP-INTERVAL '72 hours' WHERE id=${origin.sourceId}::uuid`;
    let result=await api.enviarCertificadosPendentesDrake({importacaoId:uploaded.importacao.id,itemIds:[items[1].id],limit:1,usuarioId:1,db});assert.equal(result.enviados,0);assert.equal(result.ignorados,1);assert.equal(sends,0);
    let item=await db.importacaoCertificadoDrakeItem.findUniqueOrThrow({where:{id:items[1].id}});assert.equal(item.status,'REFERENCIA_INDISPONIVEL');assert.equal(item.tentativas,0);
    await db.$executeRaw`UPDATE "DrakeDocumentoOrigem" SET "atualizadoEm"=CURRENT_TIMESTAMP WHERE id=${origin.sourceId}::uuid`;
    await api.reanalisarReferenciaCertificados(uploaded.importacao.id,db);
    item=await db.importacaoCertificadoDrakeItem.findUniqueOrThrow({where:{id:item.id}});assert.equal(item.status,'PENDENTE_ENVIO');assert.ok(item.payload);
    await seed('0002',1); // Referência mudou depois da análise: não pode enviar como novo.
    result=await api.enviarCertificadosPendentesDrake({importacaoId:uploaded.importacao.id,itemIds:[item.id],limit:1,usuarioId:1,db});assert.equal(result.enviados,0);assert.equal(sends,0);
    item=await db.importacaoCertificadoDrakeItem.findUniqueOrThrow({where:{id:item.id}});assert.equal(item.status,'POSSIVEL_DUPLICIDADE');assert.equal(item.tentativas,0);
    const [snapshot]=await db.$queryRaw`SELECT versao,"totalCandidatos" FROM "DrakeDocumentoConferencia" WHERE "itemId"=${item.id}`;assert.equal(snapshot.versao,2);assert.equal(snapshot.totalCandidatos,1);
    process.env.DRAKE_TENANT_ID=randomUUID();const missing=await reference.checkReferenceBatch(db,'hmg',[{...item,key:String(item.id)}]);assert.equal(missing.get(String(item.id)).status,'REFERENCIA_INDISPONIVEL');
  }finally{
    if(before.tenant===undefined)delete process.env.DRAKE_TENANT_ID;else process.env.DRAKE_TENANT_ID=before.tenant;
    if(before.environment===undefined)delete process.env.DRAKE_ENVIRONMENT;else process.env.DRAKE_ENVIRONMENT=before.environment;
    await db.$disconnect();await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);await admin.$disconnect();
  }
});
