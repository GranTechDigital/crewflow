const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto'),ExcelJS=require('exceljs');
const {loader}=require('./certificados-loader.cjs');
test('Correções, versões e comentário único em PostgreSQL isolado',{skip:!process.env.CERTIFICADO_TEST_ENV_FILE},async t=>{
 process.loadEnvFile(path.resolve(process.env.CERTIFICADO_TEST_ENV_FILE));const url=new URL(process.env.DATABASE_URL);assert.ok(['postgres-dev','localhost','127.0.0.1'].includes(url.hostname));url.hostname='127.0.0.1';
 const {PrismaClient}=require('@prisma/client'),schema='cert_edit_'+randomUUID().replaceAll('-',''),adminUrl=new URL(url);adminUrl.searchParams.set('schema','public');url.searchParams.set('schema',schema);
 const admin=new PrismaClient({datasources:{db:{url:adminUrl.toString()}},log:[]}),db=new PrismaClient({datasources:{db:{url:url.toString()}},log:[]});
 const stubs={'@/lib/prisma':{prisma:db},'src/lib/integracoes/certificadosDrakeReference.ts':{checkReferenceBatch:async(_db,_env,rows)=>new Map(rows.map(row=>[row.key,{status:'NOVO',motivo:null,versao:1,totalCandidatos:0,candidatos:[]}])),saveReferenceChecks:async()=>{}}};
 const load=loader(stubs),{criarImportacaoCertificadosDrake:create}=load('src/lib/integracoes/certificadosDrakeImportacao.ts'),{editarCertificado:edit}=load('src/lib/integracoes/certificadosDrakeEditing.ts'),{certificadoVersionInfo:info,salvarComentarioCarregamento:note}=load('src/lib/integracoes/certificadosDrakeVersions.ts');
 const actor={usuarioId:1,usuarioNome:'Operador de teste',descricao:'Carga de teste',db};
 const data={matricula:'0001',nome:'Pessoa teste',certificadora:'Empresa',qualificacao:'NR 10',tipoDocumento:'Certificado',emissao:'2026-01-01',validade:'2027-01-01',recebimento:''};
 async function file(validade='',qualification='NR 10'){const w=new ExcelJS.Workbook(),s=w.addWorksheet('Certificados');s.addRow(['Matricula','Nome','Certificadora','Qualificacao','Tipo Documento','Emissao','Validade','Recebimento']);s.addRow(['0001','Pessoa teste','Empresa',qualification,'Certificado','2026-01-01',validade,'']);return new File([await w.xlsx.writeBuffer()],'corrigido.xlsx');}
 let original,version;
 try{
  await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);await db.$executeRawUnsafe('CREATE TABLE "Usuario" (id INTEGER PRIMARY KEY)');await db.$executeRawUnsafe('CREATE TABLE "Funcionario" (id INTEGER PRIMARY KEY, matricula TEXT UNIQUE NOT NULL)');
  for(const migration of ['20261008100000_add_importacao_certificados_drake','20261105123000_harden_certificados_drake','20261106150000_add_drake_document_reference','20261106170000_add_drake_document_check','20261106190000_add_drake_document_delete','20261106200000_add_drake_document_restore','20261106210000_certificados_versions_edits']){const sql=fs.readFileSync(path.resolve('prisma/migrations',migration,'migration.sql'),'utf8').replace(/^--.*$/gm,'');for(const statement of sql.split(';').filter(x=>x.trim()))await db.$executeRawUnsafe(statement);}
  await db.$executeRawUnsafe('INSERT INTO "Usuario" (id) VALUES (1)');await db.$executeRawUnsafe("INSERT INTO \"Funcionario\" (id,matricula) VALUES (1,'0001')");
  await t.test('Descrição da nova carga é obrigatória e persistida na criação',async()=>{
    await assert.rejects(create({...actor,descricao:'  ',file:await file()}),/descrição/);
    await assert.rejects(create({...actor,descricao:'x'.repeat(201),file:await file()}),/descrição/);
  });
  await t.test('Nova versão arquiva a antiga e conserva o mesmo comentário',async()=>{
   original=(await create({...actor,file:await file()})).importacao;
   const initial=await info(db,original.id);await note({...actor,importacaoId:original.id,texto:'Carga com correções em andamento',atualizadoEm:initial.comentario.atualizadoEm.toISOString()});
   version=(await create({...actor,file:await file('2027-01-01'),substituiImportacaoId:original.id})).importacao;
   assert.equal((await db.importacaoCertificadoDrake.findUnique({where:{id:original.id}})).status,'SUBSTITUIDO');
   const a=await info(db,original.id),b=await info(db,version.id);assert.equal(a.raizId,b.raizId);assert.equal(a.atualId,version.id);assert.equal(b.versoes.length,2);assert.equal(b.comentario.texto,'Carga com correções em andamento');
   const before=await db.importacaoCertificadoDrake.count();await assert.rejects(create({...actor,file:await file('2028-01-01'),substituiImportacaoId:original.id}),/substituído/);assert.equal(await db.importacaoCertificadoDrake.count(),before);
   const {enviarCertificadosPendentesDrake:send}=load('src/lib/integracoes/certificadosDrakeSend.ts');await assert.rejects(send({...actor,importacaoId:original.id}),/substituído/);
  });
  await t.test('Reserva destrutiva bloqueia substituição, edição e cancelamento até o retorno',async()=>{
    const {assertCertificadoVersionEditable:guard}=load('src/lib/integracoes/certificadosDrakeVersions.ts');
    const {cancelarCertificados:cancel}=load('src/lib/integracoes/certificadosDrakeOutcome.ts');
    const batch=(await create({...actor,file:await file('', 'NR 12')})).importacao;
    const item=await db.importacaoCertificadoDrakeItem.findFirst({where:{importacaoId:batch.id}});
    const sourceId=randomUUID(),operationId=randomUUID();
    await db.$executeRaw`INSERT INTO "DrakeDocumentoOrigem" (id,ambiente,"tenantId") VALUES (${sourceId}::uuid,'hmg',${randomUUID()}::uuid)`;
    await db.$executeRaw`INSERT INTO "DrakeDocumentoExclusao" (id,"origemId","documentoId","itemId","usuarioId","usuarioNome",justificativa,"versaoReferencia",referencia,payload,status) VALUES (${operationId}::uuid,${sourceId}::uuid,${randomUUID()}::uuid,${item.id},1,'Fixture','Fixture',1,'{}','{}','EM_EXECUCAO')`;
    await assert.rejects(guard(db,batch.id),/exclusão ou recriação/);
    await assert.rejects(create({...actor,file:await file('2028-01-01','NR 12'),substituiImportacaoId:batch.id}),/exclusão ou recriação/);
    await assert.rejects(edit({...actor,importacaoId:batch.id,itemId:item.id,atualizadoEm:item.updatedAt.toISOString(),dados:{...data,qualificacao:'NR 12'}}),/exclusão ou recriação/);
    await assert.rejects(cancel({...actor,importacaoId:batch.id,confirmar:true,motivo:'Fixture'}),/exclusão ou recriação/);
    await db.$executeRaw`UPDATE "DrakeDocumentoExclusao" SET status='EXCLUSAO_ACEITA' WHERE id=${operationId}::uuid`;
    const restore=randomUUID();await db.$executeRaw`INSERT INTO "DrakeDocumentoRestauracao" (id,"exclusaoId","usuarioId","usuarioNome",payload,status) VALUES (${restore}::uuid,${operationId}::uuid,1,'Fixture','{}','EM_EXECUCAO')`;
    await assert.rejects(guard(db,batch.id),/exclusão ou recriação/);
    await db.$executeRaw`UPDATE "DrakeDocumentoRestauracao" SET status='RECRIACAO_ACEITA' WHERE id=${restore}::uuid`;
    assert.equal((await guard(db,batch.id)).id,batch.id);
  });
  await t.test('Comentário é único e rejeita edição concorrente',async()=>{
   const previous=await info(db,version.id);const changed=await note({...actor,importacaoId:version.id,texto:'Comentário único atualizado',atualizadoEm:previous.comentario.atualizadoEm.toISOString()});
   assert.equal((await info(db,original.id)).comentario.texto,'Comentário único atualizado');assert.equal((await db.$queryRaw`SELECT COUNT(*)::int AS n FROM "DrakeCertificadoCarregamentoNota" WHERE "raizId"=${original.id}`)[0].n,1);
   await assert.rejects(note({...actor,importacaoId:version.id,texto:'Sobrescrita',atualizadoEm:previous.comentario.atualizadoEm.toISOString()}),/outra pessoa/);assert.equal(changed.comentario.texto,'Comentário único atualizado');
  });
  await t.test('Salvar corrige e audita sem apagar os dados originais; concorrência e datas inválidas bloqueiam',async()=>{
   const batch=(await create({...actor,file:await file('', 'NR 35')})).importacao;const item=await db.importacaoCertificadoDrakeItem.findFirst({where:{importacaoId:batch.id}});
   const result=await edit({...actor,importacaoId:batch.id,itemId:item.id,atualizadoEm:item.updatedAt.toISOString(),dados:{...data,qualificacao:'NR 35'}});assert.equal(result.item.status,'PENDENTE_ENVIO');assert.equal(result.item.dadosOriginais.Validade,'');assert.equal(result.item.tentativas,0);
   assert.equal((await db.$queryRaw`SELECT COUNT(*)::int AS n FROM "DrakeCertificadoItemEdicao" WHERE "itemId"=${item.id}`)[0].n,1);
   await assert.rejects(edit({...actor,importacaoId:batch.id,itemId:item.id,atualizadoEm:item.updatedAt.toISOString(),dados:{...data,qualificacao:'NR 35'}}),/alterado/);
   await assert.rejects(edit({...actor,importacaoId:batch.id,itemId:item.id,atualizadoEm:result.item.updatedAt.toISOString(),dados:{...data,emissao:'2026-02-31'}}),/Emissão/);
  });
  await t.test('Já enviado e resultado incerto não podem ser editados; duplicidade nunca libera envio',async()=>{
   const item=await db.importacaoCertificadoDrakeItem.findFirst({where:{importacaoId:version.id}});
   for(const status of ['ENVIADO','NAO_CONFIRMADO']){const row=await db.importacaoCertificadoDrakeItem.update({where:{id:item.id},data:{status}});await assert.rejects(edit({...actor,importacaoId:version.id,itemId:item.id,atualizadoEm:row.updatedAt.toISOString(),dados:data}),/Não é permitido/);}
   const row=await db.importacaoCertificadoDrakeItem.update({where:{id:item.id},data:{status:'ERRO_DRAKE'}});
   await db.importacaoCertificadoDrakeItem.create({data:{importacaoId:version.id,numeroLinha:5,matricula:'0001',qualificacao:'NR 10',qualificacaoNormalizada:'NR 10',tipoDocumento:'Certificado',tipoDocumentoNormalizado:'CERTIFICADO',emissao:new Date('2026-01-01Z'),validade:new Date('2027-01-01Z'),chaveIdempotencia:row.chaveIdempotencia,status:'PENDENTE_ENVIO'}});
   const result=await edit({...actor,importacaoId:version.id,itemId:item.id,atualizadoEm:row.updatedAt.toISOString(),dados:data});assert.equal(result.item.status,'DUPLICADO_NO_ARQUIVO');assert.equal(result.item.payload,null);
  });
  await t.test('Envio posterior concilia outra carga sem ocultar resultado incerto ou correção mais recente',async()=>{
    const {reconciliarDesfechos:reconcile}=load('src/lib/integracoes/certificadosDrakeOutcome.ts');
    const target=(await create({...actor,file:await file('', 'NR 33')})).importacao;
    const source=(await create({...actor,file:await file('2029-01-01','NR 33')})).importacao;
    const previous=await db.importacaoCertificadoDrakeItem.findFirst({where:{importacaoId:target.id}}),current=await db.importacaoCertificadoDrakeItem.findFirst({where:{importacaoId:source.id}});
    await db.importacaoCertificadoDrakeItem.update({where:{id:current.id},data:{status:'ENVIADO',enviadoEm:new Date(Date.now()+1000)}});
    await db.$transaction(async tx=>{assert.equal(await reconcile(tx,{...actor,ambiente:'hmg',fonteId:current.id,chave:current.chaveIdempotencia}),1);});
    const resolved=await db.importacaoCertificadoDrakeItem.findUnique({where:{id:previous.id}});assert.equal(resolved.status,'RESOLVIDO_OUTRO_ARQUIVO');assert.equal(resolved.dadosOriginais.Validade,'');assert.match(resolved.motivoErro,new RegExp('#'+source.id));
    const old=await db.importacaoCertificadoDrakeItem.create({data:{...Object.fromEntries(Object.entries(previous).filter(([key])=>!['id','createdAt','updatedAt'].includes(key))),numeroLinha:8,status:'NAO_CONFIRMADO'}});
    await db.$transaction(async tx=>{assert.equal(await reconcile(tx,{...actor,ambiente:'hmg',fonteId:current.id,chave:current.chaveIdempotencia}),0);});assert.equal((await db.importacaoCertificadoDrakeItem.findUnique({where:{id:old.id}})).status,'NAO_CONFIRMADO');
    await db.importacaoCertificadoDrakeItem.update({where:{id:previous.id},data:{status:'CONFLITO_ATUALIZACAO',updatedAt:new Date(Date.now()+5000)}});
    await db.$transaction(async tx=>{assert.equal(await reconcile(tx,{...actor,ambiente:'hmg',fonteId:current.id,chave:current.chaveIdempotencia}),0);});
    await db.importacaoCertificadoDrakeItem.update({where:{id:previous.id},data:{status:'ERRO_VALIDACAO',updatedAt:new Date(Date.now()-60000)}});
    const {cancelarCertificados:cancel}=load('src/lib/integracoes/certificadosDrakeOutcome.ts');
    const decision=await cancel({...actor,importacaoId:target.id,itemId:previous.id,confirmar:true,motivo:'Não necessário'});assert.equal(decision.cancelados,0);assert.equal(decision.resolvidos,1);assert.equal((await db.importacaoCertificadoDrakeItem.findUnique({where:{id:previous.id}})).status,'RESOLVIDO_OUTRO_ARQUIVO');
  });
  await t.test('Cancelamento exige motivo e confirmação, não toca incertos e mantém auditoria',async()=>{
    const {cancelarCertificados:cancel,outcomeCounts}=load('src/lib/integracoes/certificadosDrakeOutcome.ts');
    const batch=(await create({...actor,file:await file('', 'NR 20')})).importacao;
    const item=await db.importacaoCertificadoDrakeItem.findFirst({where:{importacaoId:batch.id}});
    await assert.rejects(cancel({...actor,importacaoId:batch.id,motivo:'Não necessário',confirmar:false}),/Confirme/);
    await assert.rejects(cancel({...actor,importacaoId:batch.id,motivo:'',confirmar:true}),/motivo/);
    await db.importacaoCertificadoDrakeItem.create({data:{...Object.fromEntries(Object.entries(item).filter(([key])=>!['id','createdAt','updatedAt'].includes(key))),numeroLinha:9,status:'NAO_CONFIRMADO'}});
    const result=await cancel({...actor,importacaoId:batch.id,motivo:'Registro não necessário',confirmar:true});assert.equal(result.cancelados,1);
    assert.equal((await db.importacaoCertificadoDrakeItem.findUnique({where:{id:item.id}})).status,'CANCELADO');assert.equal(result.importacao.totalNaoConfirmadas,1);
    assert.equal((await outcomeCounts(db,[batch.id])).get(batch.id).totalCanceladas,1);
    assert.equal((await db.$queryRaw`SELECT COUNT(*)::int AS n FROM "DrakeCertificadoItemEdicao" WHERE "itemId"=${item.id}`)[0].n,1);
  });
 }finally{await db.$disconnect();await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);await admin.$disconnect();}
});
