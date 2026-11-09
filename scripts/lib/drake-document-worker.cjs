const {randomUUID}=require('node:crypto'),path=require('node:path'),fsp=require('node:fs/promises');
const core=require('./drake-document-delivery.cjs'),{download}=require('./drake-document-download.cjs'),{applyReferenceFile}=require('./drake-document-load.cjs'),repository=require('./drake-document-reference-db.cjs');
async function claim(db,config){return db.$transaction(async tx=>{
 await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('drake-reference-delivery'),hashtext(${config.environment+config.tenantId}))::text`;
 await tx.$executeRaw`UPDATE "DrakeDocumentoEntrega" SET status='EXPIRADO',"erroCodigo"='LINK_EXPIRADO',"concluidoEm"=CURRENT_TIMESTAMP WHERE status IN ('PENDENTE','REPETIR_DOWNLOAD') AND ambiente=${config.environment} AND "tenantId"=${config.tenantId}::uuid AND "validoAte"<=CURRENT_TIMESTAMP`;
 const rows=await tx.$queryRaw`WITH fila AS (SELECT d.id FROM "DrakeDocumentoEntrega" d WHERE d.ambiente=${config.environment} AND d."tenantId"=${config.tenantId}::uuid AND d.status IN ('PENDENTE','REPETIR_DOWNLOAD') AND EXISTS(SELECT 1 FROM "DrakeDocumentoOrigem" origin WHERE origin.ambiente=d.ambiente AND origin."tenantId"=d."tenantId" AND origin.status='PRONTA' AND origin.versao>0) AND d.tentativas<3 AND d."proximaTentativaEm"<=CURRENT_TIMESTAMP AND d."validoAte">CURRENT_TIMESTAMP AND NOT EXISTS(SELECT 1 FROM "DrakeDocumentoEntrega" active WHERE active.ambiente=d.ambiente AND active."tenantId"=d."tenantId" AND active.status='PROCESSANDO') ORDER BY d."geradoEm",d."criadoEm" FOR UPDATE SKIP LOCKED LIMIT 1) UPDATE "DrakeDocumentoEntrega" d SET status='PROCESSANDO',reserva=${randomUUID()}::uuid,tentativas=tentativas+1,"heartbeatEm"=CURRENT_TIMESTAMP FROM fila f WHERE d.id=f.id RETURNING d.*`;
 return rows[0]??null;
});}
async function finish(db,job,status,errorCode=null){const n=await db.$executeRaw`UPDATE "DrakeDocumentoEntrega" SET status=${status},"erroCodigo"=${errorCode},reserva=NULL,"heartbeatEm"=CURRENT_TIMESTAMP,"concluidoEm"=CASE WHEN ${status}='REPETIR_DOWNLOAD' THEN NULL ELSE CURRENT_TIMESTAMP END,"proximaTentativaEm"=CURRENT_TIMESTAMP+INTERVAL '60 seconds' WHERE id=${job.id}::uuid AND reserva=${job.reserva}::uuid AND status='PROCESSANDO'`;if(n!==1)throw Error('RESERVA_DO_RECEBIMENTO_ALTERADA');}
async function runOne(db,config,options={}){
 const job=await claim(db,config);if(!job)return null;
 const root=path.resolve(options.storageDirectory||process.env.DRAKE_DOCUMENT_STORAGE_DIR||'backups/drake-documentos'),temp=path.join(root,'recebimentos',job.id+'-'+job.reserva+path.extname(job.nomeArquivo).toLowerCase());await fsp.mkdir(path.dirname(temp),{recursive:true,mode:0o700});
 const controller=new AbortController();let lease=true;
 const heartbeat=setInterval(()=>{db.$executeRaw`UPDATE "DrakeDocumentoEntrega" SET "heartbeatEm"=CURRENT_TIMESTAMP WHERE id=${job.id}::uuid AND reserva=${job.reserva}::uuid AND status='PROCESSANDO'`.then(n=>{if(n!==1){lease=false;controller.abort();}}).catch(()=>{lease=false;controller.abort();});},15000);
 try{
  const url=core.decrypt(job.urlCifrada,config.key);let generatedAt=job.geradoEm,windowStart=job.janelaInicio;
  core.envelope({name:job.nomeArquivo,url,validUntil:job.validoAte.toISOString(),generatedAt:generatedAt?.toISOString(),windowStart:windowStart?.toISOString(),windowEnd:job.janelaFim?.toISOString(),scope:'certificates'},config);
  const downloaded=await (options.download||download)(url,temp,config,{signal:controller.signal});
  if(!generatedAt){
   if(config.windowHours!==72||job.nomeArquivo!==config.reportName)throw Error('PERFIL_DO_RELATORIO_NAO_CONFIGURADO');
   generatedAt=new Date(downloaded?.lastModified||'');
   if(!Number.isFinite(+generatedAt)||generatedAt>Date.now()+300000||Date.now()-generatedAt>48*3600000)throw Error('DATA_DO_ARQUIVO_AUSENTE_OU_ANTIGA');
   windowStart=new Date(+generatedAt-config.windowHours*3600000);
   const updated=await db.$executeRaw`UPDATE "DrakeDocumentoEntrega" SET "geradoEm"=${generatedAt},"janelaInicio"=${windowStart},"janelaFim"=${generatedAt} WHERE id=${job.id}::uuid AND reserva=${job.reserva}::uuid AND status='PROCESSANDO'`;
   if(updated!==1)throw Error('RESERVA_DO_RECEBIMENTO_ALTERADA');
  }
  const result=await applyReferenceFile(db,temp,{environment:config.environment,tenantId:config.tenantId,deliveryId:job.id,deliveryReservation:job.reserva,filename:job.nomeArquivo,generatedAt,windowStart,confirmSends:options.confirmSends!==false,storageDirectory:root,
   assertLease:async()=>{if(!lease)throw Error('RESERVA_DO_RECEBIMENTO_ALTERADA');},
   onHash:hash=>db.$executeRaw`UPDATE "DrakeDocumentoEntrega" SET "hashArquivo"=${hash} WHERE id=${job.id}::uuid AND reserva=${job.reserva}::uuid`,
   onLoad:id=>db.$executeRaw`UPDATE "DrakeDocumentoEntrega" SET "cargaId"=${id}::uuid WHERE id=${job.id}::uuid AND reserva=${job.reserva}::uuid`});
  await finish(db,job,'CONCLUIDO');return {id:job.id,status:'CONCLUIDO',cargaId:result.loadId};
 }catch(error){
  const transient=['DOWNLOAD_TRANSITORIO','DOWNLOAD_REDE','DOWNLOAD_DNS','DOWNLOAD_TIMEOUT'].includes(error.message),retry=transient&&job.tentativas<3&&job.validoAte>Date.now()+60000;
  const code=/^[A-Z_]+$/.test(error.message)?error.message:'PROCESSAMENTO_NAO_CONCLUIDO';
  if(lease)await finish(db,job,retry?'REPETIR_DOWNLOAD':'ERRO',code);
  return {id:job.id,status:retry?'REPETIR_DOWNLOAD':'ERRO',erroCodigo:code};
 }finally{clearInterval(heartbeat);await fsp.rm(temp,{force:true});}
}
async function recover(db,config,id){if(!/^[0-9a-f-]{36}$/i.test(id))throw Error('ID_INVALIDO');
 const [job]=await db.$queryRaw`SELECT * FROM "DrakeDocumentoEntrega" WHERE id=${id}::uuid AND ambiente=${config.environment} AND "tenantId"=${config.tenantId}::uuid`;
 if(!job||job.status!=='PROCESSANDO'||!job.heartbeatEm||Date.now()-job.heartbeatEm<20*60000)throw Error('RECUPERACAO_EXIGE_20_MINUTOS_SEM_HEARTBEAT');
 if(job.cargaId){const [load]=await db.$queryRaw`SELECT status,"heartbeatEm" FROM "DrakeDocumentoCarga" WHERE id=${job.cargaId}::uuid`;if(load?.status==='VALIDANDO')await repository.recoverLoad(db,job.cargaId);}
 const n=await db.$executeRaw`UPDATE "DrakeDocumentoEntrega" SET status=CASE WHEN "validoAte">CURRENT_TIMESTAMP THEN 'PENDENTE' ELSE 'EXPIRADO' END,reserva=NULL,"heartbeatEm"=NULL,"proximaTentativaEm"=CURRENT_TIMESTAMP WHERE id=${id}::uuid AND reserva=${job.reserva}::uuid AND "heartbeatEm"=${job.heartbeatEm}`;if(n!==1)throw Error('RECEBIMENTO_MUDOU_DURANTE_RECUPERACAO');return {id,status:'RECUPERADO'};
}
module.exports={claim,runOne,recover};
