const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID,randomBytes}=require('node:crypto');
const {loader}=require('./certificados-loader.cjs');
const {normalizeCertificateEnvironment}=require('../scripts/lib/certificate-environment.cjs');
test('Production usa prd apenas nos certificados e impede cruzar destinos ou habilitar exclusao',()=>{
 const original=process.env.DRAKE_ENVIRONMENT;process.env.DRAKE_ENVIRONMENT='production';
 const config={baseUrl:'https://drake.bz',syncDocumentPath:'/api/v2/Integration/Sync/SyncDocument',enabled:true,timeoutMs:30000};
 const load=loader({'src/lib/integracoes/drakeClient.ts':{assertDrakeConfigReady:()=>config,DrakeClientError:class extends Error{}}});
 try{assert.equal(normalizeCertificateEnvironment('production'),'prd');assert.equal(normalizeCertificateEnvironment('hmg'),'hmg');assert.equal(normalizeCertificateEnvironment('dev'),null);
 const env=load('src/lib/integracoes/certificadosDrakeEnvironment.ts'),send=load('src/lib/integracoes/certificadosDrakeSend.ts');
 assert.equal(env.certificateEnvironment(),'prd');assert.throws(()=>env.assertCertificateEnvironment('hmg'),/outro ambiente/);
 assert.equal(send.assertCertificadoDestination('prd').baseUrl,'https://drake.bz');assert.throws(()=>send.assertCertificadoHmg('prd'),/restritas/);
 config.baseUrl='https://hmg.drake.bz';assert.throws(()=>send.assertCertificadoDestination('prd'),/destino/);
 config.baseUrl='https://drake.bz';config.enabled=false;assert.throws(()=>send.assertCertificadoDestination('prd'),/desabilitado/);assert.equal(process.env.DRAKE_ENVIRONMENT,'production');
 }finally{if(original===undefined)delete process.env.DRAKE_ENVIRONMENT;else process.env.DRAKE_ENVIRONMENT=original;}
});
test('Primeiro storage desconhecido fica em quarentena sem download',async()=>{
 const core=require('../scripts/lib/drake-document-delivery.cjs');
 const config=core.configuration({DRAKE_ENVIRONMENT:'production',DRAKE_TENANT_ID:randomUUID(),DRAKE_DOCUMENT_WEBHOOK_TOKEN:'private-fixture-'.repeat(3),DRAKE_DOCUMENT_URL_KEY:randomBytes(32).toString('base64'),DRAKE_DOCUMENT_CAPTURE_UNKNOWN_STORAGE:'true',DRAKE_DOCUMENT_REPORT_NAME:'certificados.csv',DRAKE_DOCUMENT_REPORT_WINDOW_HOURS:'72'});
 let status;const db={$queryRaw:async(_strings,...values)=>{status=values.at(-1);return [{id:randomUUID(),status}]},$executeRaw:async()=>{throw Error('Nao deve promover destino desconhecido')}};
 const response=await core.receive(db,{name:'certificados.csv',url:'https://fixtureaccount.blob.core.windows.net/report.csv?sig=fixture',validUntil:new Date(Date.now()+3600000).toISOString()},config);
 assert.equal(config.environment,'prd');assert.equal(status,'AGUARDANDO_DESTINO');assert.equal(response.status,status);
 await assert.rejects(core.receive(db,{name:'certificados.csv',url:'https://169.254.169.254/x',validUntil:new Date(Date.now()+3600000).toISOString()},config),/PERMITIDA/);
});
