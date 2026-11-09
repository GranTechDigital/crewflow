const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const {loader}=require('./certificados-loader.cjs');

test('Envio seguro em PostgreSQL isolado e simulação HTTP local', {skip:!process.env.CERTIFICADO_TEST_ENV_FILE}, async t=>{
  const mockUrl=new URL(process.env.CERTIFICADO_MOCK_URL||'http://127.0.0.1:4198/drake');
  assert.equal(mockUrl.protocol,'http:');assert.ok(['127.0.0.1','localhost'].includes(mockUrl.hostname),'Mock precisa ser local');
  process.loadEnvFile(path.resolve(process.env.CERTIFICADO_TEST_ENV_FILE));
  const url=new URL(process.env.DATABASE_URL);assert.ok(['postgres-dev','localhost','127.0.0.1'].includes(url.hostname),'Banco precisa ser local');url.hostname='127.0.0.1';
  const {PrismaClient}=require('@prisma/client'),schema='cert_test_'+randomUUID().replaceAll('-','');assert.match(schema,/^cert_test_[a-f0-9]{32}$/);
  const adminUrl=new URL(url);adminUrl.searchParams.set('schema','public');const admin=new PrismaClient({datasources:{db:{url:adminUrl.toString()}}});
  url.searchParams.set('schema',schema);const db=new PrismaClient({datasources:{db:{url:url.toString()}}});
  const baseLoader=loader({'@/lib/prisma':{prisma:db}}),transport=baseLoader('src/lib/integracoes/drakeClient.ts');
  let timeoutMs=2500;
  const config={baseUrl:'https://hmg.drake.bz',syncDocumentPath:'/api/v2/Integration/Sync/SyncDocument',enabled:true,apiKey:'local-fixture-only',tenantId:'11111111-1111-4111-8111-111111111111',tenantHeaderName:'X-TenantId',authHeaderName:'Authentication',timeoutMs};
  process.env.DRAKE_ENVIRONMENT='hmg';
  const load=loader({'@/lib/prisma':{prisma:db},'src/lib/integracoes/certificadosDrakeOperations.ts':{assertNoDestructiveOperation:async()=>{}},'src/lib/integracoes/certificadosDrakeReference.ts':{checkReferenceBatch:async(_db,_environment,rows)=>new Map(rows.map(row=>[row.key,{status:'NOVO',motivo:null,origemId:null,versao:1,conferidoEm:new Date().toISOString(),totalCandidatos:0,candidatos:[]}])),saveReferenceChecks:async()=>{}},'src/lib/integracoes/drakeClient.ts':{
    DrakeClientError:transport.DrakeClientError,assertDrakeConfigReady:()=>({...config,timeoutMs}),
    syncDocument:(payload,options)=>transport.syncDocument(payload,{...options,baseUrl:mockUrl.toString().replace(/\/$/,''),apiKey:'local-fixture-only',timeoutMs}),
  }});
  const {enviarCertificadosPendentesDrake:send,recuperarEnvioCertificados:recover,assertCertificadoHmg}=load('src/lib/integracoes/certificadosDrakeSend.ts');
  const actor={usuarioId:1,usuarioNome:'Operador de teste',db};
  const control=async(route)=>{const r=await fetch(mockUrl+route);assert.equal(r.status,200);return r.json()};
  async function batch(modes=['ok'],key=randomUUID()){
    const b=await db.importacaoCertificadoDrake.create({data:{usuarioId:1,nomeArquivo:'teste.xlsx',hashArquivo:randomUUID(),ambiente:'hmg',status:'AGUARDANDO_CONFIRMACAO',totalPendentes:modes.length,totalLinhas:modes.length}});
    const items=[];
    for(const [i,mode] of modes.entries())items.push(await db.importacaoCertificadoDrakeItem.create({data:{importacaoId:b.id,numeroLinha:i+2,matricula:'0001',funcionarioId:1,qualificacao:'TESTE',qualificacaoNormalizada:'TESTE',tipoDocumento:'Certificado',tipoDocumentoNormalizado:'CERTIFICADO',emissao:new Date('2026-01-01Z'),validade:new Date('2027-01-01Z'),chaveIdempotencia:key+'-'+i,status:'PENDENTE_ENVIO',payload:{Header:{OnInsert:'Execute',OnUpdate:'Execute'},Selector:{ExternalId:mode+':'+key+'-'+i},Payload:{}}}}));
    return {b,items};
  }
  try {
    await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    const current=await db.$queryRaw`SELECT current_schema() AS name`;assert.equal(current[0].name,schema);
    await db.$executeRawUnsafe('CREATE TABLE "Usuario" (id INTEGER PRIMARY KEY)');
    await db.$executeRawUnsafe('CREATE TABLE "Funcionario" (id INTEGER PRIMARY KEY, matricula TEXT NOT NULL)');
    for(const migration of ['20261008100000_add_importacao_certificados_drake','20261105123000_harden_certificados_drake','20261106210000_certificados_versions_edits']){
      const sql=fs.readFileSync(path.resolve('prisma/migrations',migration,'migration.sql'),'utf8').replace(/^--.*$/gm,'');
      for(const statement of sql.split(';').filter(x=>x.trim()))await db.$executeRawUnsafe(statement);
    }
    await db.$executeRawUnsafe('ALTER TABLE "ImportacaoCertificadoDrakeTentativa" ADD COLUMN "drakeTenantId" UUID');
    await db.$executeRawUnsafe('INSERT INTO "Usuario" (id) VALUES (1)');await db.$executeRawUnsafe('INSERT INTO "Funcionario" (id,matricula) VALUES (1,\'0001\')');
    await control('/__stats');

    await t.test('Ambiente e destino incorretos bloqueiam antes de qualquer chamada',async()=>{
      await control('/__reset');assert.throws(()=>assertCertificadoHmg('prd'),/somente em HMG/);
      config.baseUrl='https://drake.bz';assert.throws(()=>assertCertificadoHmg('hmg'),/destino/);config.baseUrl='https://hmg.drake.bz';
      config.syncDocumentPath='/api/v2/Integration/Sync/SyncWorker';assert.throws(()=>assertCertificadoHmg('hmg'),/SyncDocument/);config.syncDocumentPath='/api/v2/Integration/Sync/SyncDocument';
      assert.equal((await control('/__stats')).calls,0);
    });

    await t.test('HTTP 200 ambiguo e 202 nao confirmam nem conciliam outro arquivo',async()=>{
      for(const [mode,status] of [['ignored200','NAO_CONFIRMADO'],['error200','ERRO_DRAKE'],['accepted202','NAO_CONFIRMADO']]){
        await control('/__reset');const key=randomUUID(),prior=await batch(['ok'],key),current=await batch([mode],key);
        await db.importacaoCertificadoDrakeItem.update({where:{id:prior.items[0].id},data:{status:'ERRO_VALIDACAO'}});
        const result=await send({...actor,importacaoId:current.b.id});assert.equal(result.enviados,0);
        assert.equal((await db.importacaoCertificadoDrakeItem.findUniqueOrThrow({where:{id:current.items[0].id}})).status,status);
        assert.equal((await db.importacaoCertificadoDrakeItem.findUniqueOrThrow({where:{id:prior.items[0].id}})).status,'ERRO_VALIDACAO');
        assert.equal((await control('/__stats')).calls,1);
      }
    });

    await t.test('Seleção envia apenas o documento solicitado e bloqueia IDs fora do lote',async()=>{
      await control('/__reset');const {b,items}=await batch(['ok','ok']);
      await assert.rejects(send({...actor,importacaoId:b.id,itemIds:[items[1].id,2147483647]}),/não está pendente neste lote/);assert.equal((await control('/__stats')).calls,0);
      const result=await send({...actor,importacaoId:b.id,itemIds:[items[1].id],limit:1});assert.equal(result.enviados,1);assert.equal((await control('/__stats')).calls,1);
      assert.equal((await db.importacaoCertificadoDrakeItem.findUnique({where:{id:items[0].id}})).status,'PENDENTE_ENVIO');
      assert.equal((await db.importacaoCertificadoDrakeItem.findUnique({where:{id:items[1].id}})).status,'ENVIADO');
      await assert.rejects(send({...actor,importacaoId:b.id,itemIds:[items[1].id]}),/não está pendente neste lote/);assert.equal((await control('/__stats')).calls,1);
    });

    await t.test('Uma confirmação envia todos os 51 aptos, exclui bloqueados e rejeita prévia desatualizada',async()=>{
      await control('/__reset');const {b,items}=await batch(Array(53).fill('ok'));
      await db.importacaoCertificadoDrakeItem.update({where:{id:items[51].id},data:{status:'POSSIVEL_DUPLICIDADE'}});
      await db.importacaoCertificadoDrakeItem.update({where:{id:items[52].id},data:{status:'ERRO_VALIDACAO'}});
      await assert.rejects(send({...actor,importacaoId:b.id,todosPendentes:true,totalEsperado:50}),/quantidade.*mudou/);
      assert.equal((await control('/__stats')).calls,0);
      const events=[],result=await send({...actor,importacaoId:b.id,todosPendentes:true,totalEsperado:51,onProgress:p=>events.push(p)});
      assert.equal(result.enviados,51);assert.equal(result.processados,51);assert.equal(result.totalSelecionado,51);assert.equal(result.resultados.length,50);
      assert.equal(events.at(-1).processados,51);assert.equal((await control('/__stats')).calls,51);
      assert.equal(await db.importacaoCertificadoDrakeTentativa.count({where:{importacaoId:b.id}}),51);
      assert.equal((await db.importacaoCertificadoDrakeItem.findUnique({where:{id:items[51].id}})).status,'POSSIVEL_DUPLICIDADE');
      assert.equal((await db.importacaoCertificadoDrakeItem.findUnique({where:{id:items[52].id}})).status,'ERRO_VALIDACAO');
      await assert.rejects(send({...actor,importacaoId:b.id,todosPendentes:true,totalEsperado:51}),/quantidade.*mudou/);
      assert.equal((await control('/__stats')).calls,51);
    });

    await t.test('Duas requisições no mesmo lote fazem apenas um envio e preservam autor',async()=>{
      await control('/__reset');const {b,items}=await batch(['slow']);const events=[];
      const results=await Promise.allSettled([send({...actor,importacaoId:b.id,onProgress:p=>events.push(p)}),send({...actor,importacaoId:b.id})]);
      assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.match(results.find(x=>x.status==='rejected').reason.message,/execução/);
      assert.equal((await control('/__stats')).calls,1);assert.ok(events.some(x=>x.processados===1));
      const attempt=await db.importacaoCertificadoDrakeTentativa.findFirst({where:{itemId:items[0].id}});assert.equal(attempt.usuarioNome,actor.usuarioNome);assert.equal(attempt.usuarioId,1);assert.equal(attempt.httpStatus,200);
      assert.equal((await db.importacaoCertificadoDrakeItem.findUnique({where:{id:items[0].id}})).status,'ENVIADO');
    });

    await t.test('Mesmo certificado em dois lotes concorrentes não é reenviado',async()=>{
      await control('/__reset');const key=randomUUID(),a=await batch(['slow'],key),b=await batch(['slow'],key);
      const results=await Promise.all([send({...actor,importacaoId:a.b.id}),send({...actor,importacaoId:b.b.id})]);
      assert.equal(results.reduce((n,x)=>n+x.enviados,0),1);assert.equal(results.reduce((n,x)=>n+x.ignorados,0),1);assert.equal((await control('/__stats')).calls,1);
    });

    await t.test('Arquivo e certificado de outro ambiente não bloqueiam nem se misturam ao HMG',async()=>{
      await control('/__reset');const key=randomUUID(),other=await batch(['ok'],key);
      await db.importacaoCertificadoDrake.update({where:{id:other.b.id},data:{ambiente:'prd'}});
      await db.importacaoCertificadoDrakeItem.update({where:{id:other.items[0].id},data:{status:'ENVIADO'}});
      const hmg=await batch(['ok'],key);await db.importacaoCertificadoDrake.update({where:{id:hmg.b.id},data:{hashArquivo:other.b.hashArquivo}});
      const result=await send({...actor,importacaoId:hmg.b.id});assert.equal(result.enviados,1);assert.equal((await control('/__stats')).calls,1);
      const unique=await db.importacaoCertificadoDrake.findUnique({where:{ambiente_hashArquivo:{ambiente:'hmg',hashArquivo:other.b.hashArquivo}}});assert.equal(unique.id,hmg.b.id);
    });

    await t.test('Rejeição HTTP é auditada sem repetir a chamada',async()=>{
      await control('/__reset');const {b}=await batch(['reject400']);const result=await send({...actor,importacaoId:b.id});
      assert.equal(result.falhas,1);assert.equal(result.naoConfirmados,0);assert.equal((await control('/__stats')).calls,1);
      await assert.rejects(send({...actor,importacaoId:b.id}),/não tem certificados pendentes/);assert.equal((await control('/__stats')).calls,1);
    });

    await t.test('Timeout após recebimento no mock fica incerto e interrompe o lote',async()=>{
      await control('/__reset');timeoutMs=100;const {b,items}=await batch(['slow','ok']);const result=await send({...actor,importacaoId:b.id});timeoutMs=2500;
      assert.equal(result.interrompido,true);assert.equal(result.naoConfirmados,1);assert.equal(result.processados,1);
      const state=await control('/__stats');assert.equal(state.calls,1);assert.equal(state.accepted.length,1);
      assert.equal((await db.importacaoCertificadoDrakeItem.findUnique({where:{id:items[0].id}})).status,'NAO_CONFIRMADO');
      assert.equal((await db.importacaoCertificadoDrakeItem.findUnique({where:{id:items[1].id}})).status,'PENDENTE_ENVIO');
    });

    await t.test('HTTP 500 tem resultado incerto e não é reenviado automaticamente',async()=>{
      await control('/__reset');const {b}=await batch(['error500']);const result=await send({...actor,importacaoId:b.id});assert.equal(result.naoConfirmados,1);assert.equal((await control('/__stats')).calls,1);
    });

    await t.test('Falha de auditoria após aceite mantém reserva para recuperação sem reenvio',async()=>{
      await control('/__reset');const {b,items}=await batch();let fail=true;
      const faulty=new Proxy(db,{get(target,key){if(key==='$transaction')return action=>target.$transaction(async tx=>action(new Proxy(tx,{get(t,k){if(k==='importacaoCertificadoDrakeTentativa')return new Proxy(t[k],{get(model,op){if(op==='update')return async args=>{if(fail){fail=false;throw Error('Falha de auditoria simulada')}return model.update(args)};return typeof model[op]==='function'?model[op].bind(model):model[op]}});return typeof t[k]==='function'?t[k].bind(t):t[k]}})));return typeof target[key]==='function'?target[key].bind(target):target[key]}});
      await assert.rejects(send({...actor,db:faulty,importacaoId:b.id}),/gravar o resultado/);assert.equal((await control('/__stats')).calls,1);
      await assert.rejects(send({...actor,importacaoId:b.id}),/execução/);
      await assert.rejects(recover({...actor,importacaoId:b.id}),/ainda está ativo/);
      await db.importacaoCertificadoDrake.update({where:{id:b.id},data:{envioHeartbeatEm:new Date(Date.now()-301000)}});
      const restored=await recover({...actor,importacaoId:b.id});assert.equal(restored.totalNaoConfirmadas,1);assert.equal(restored.envioToken,null);
      assert.equal((await db.importacaoCertificadoDrakeItem.findUnique({where:{id:items[0].id}})).status,'NAO_CONFIRMADO');assert.equal((await control('/__stats')).calls,1);
    });
  } finally {
    await db.$disconnect();
    if(/^cert_test_[a-f0-9]{32}$/.test(schema))await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.$disconnect();
  }
});
