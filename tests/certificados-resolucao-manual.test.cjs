const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loader}=require('./certificados-loader.cjs');
const {summarize}=require('../scripts/lib/certificate-batch-summary.cjs');
class CertificadoError extends Error { constructor(message,status=400){super(message);this.status=status;} }

function harness(status,confirmation){
 const item={id:4,importacaoId:3,status,motivoErro:'Duplicidade',updatedAt:new Date()};
 let saved=null,audits=0;
 const tx={importacaoCertificadoDrakeItem:{findFirst:async()=>item,updateMany:async({data})=>{saved=data;return {count:1}}},$queryRaw:async()=>confirmation?[{status:confirmation}]:[],$executeRaw:async()=>{audits++;}};
 const load=loader({'./certificadosDrakeEnvironment':{certificateEnvironment:()=> 'prd'},'./certificadosDrakeDb':{lockCertificadoEnvironment:async()=>{},resumirImportacaoCertificadosDrake:async()=>({id:3})},'./certificadosDrakeVersions':{assertCertificadoVersionEditable:async()=>{}},'./certificadosDrakeShared':{CertificadoError,CERTIFICADO_CANCELABLE_STATUS:[]},'@/lib/prisma':{prisma:{}},'../../../scripts/lib/certificate-outcomes.cjs':{reconcileAcrossFiles:async()=>0}});
 const {resolverDuplicidadeManualmente}=load('src/lib/integracoes/certificadosDrakeOutcome.ts');
 const input={importacaoId:3,itemId:4,confirmar:true,usuarioId:1,usuarioNome:'Teste',db:{$transaction:async fn=>fn(tx)}};
 return {run:()=>resolverDuplicidadeManualmente(input),state:()=>({saved,audits})};
}
test('decisão manual encerra duplicidade ambígua sem marcar como confirmada',async()=>{
 const h=harness('NAO_CONFIRMADO','AMBIGUO');await h.run();assert.equal(h.state().saved.status,'RESOLVIDO_MANUAL');assert.match(h.state().saved.motivoErro,/não foi verificada/);assert.equal(h.state().audits,1);
});
test('resultado incerto sem confirmação de duplicidade não pode ser encerrado',async()=>{
 const h=harness('NAO_CONFIRMADO','DIVERGENTE');await assert.rejects(h.run(),/não é uma duplicidade/);assert.equal(h.state().audits,0);
});
test('resumo não considera o item encerrado como erro ou confirmação Drake',()=>{
 const result=summarize([{status:'RESOLVIDO_MANUAL',_count:{_all:1}}],{status:'CONCLUIDO',envioToken:null});assert.equal(result.status,'CONCLUIDO');assert.equal(result.totalConfirmadas,0);assert.equal(result.totalNaoConfirmadas,0);
});
