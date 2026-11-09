const fs=require('node:fs'),fsp=require('node:fs/promises'),path=require('node:path'),{createHash}=require('node:crypto');
const {readReference,PARSER_VERSION}=require('./drake-document-reference.cjs'),repository=require('./drake-document-reference-db.cjs');
async function hashFile(file){const hash=createHash('sha256');for await(const chunk of fs.createReadStream(file))hash.update(chunk);return hash.digest('hex');}
async function applyReferenceFile(db,file,context){
 const stat=await fsp.stat(file),ext=path.extname(file).toLowerCase();if(!stat.isFile()||!['.xlsx','.csv'].includes(ext)||stat.size>100*1024*1024)throw Error('ARQUIVO_NAO_SUPORTADO');
 const generated=context.generatedAt;if(!(generated instanceof Date)||!Number.isFinite(+generated)||+generated>Date.now()+300000||Date.now()-generated>48*3600000)throw Error('RELATORIO_DESATUALIZADO');
 const hash=await hashFile(file),root=path.resolve(context.storageDirectory),archive=path.join(root,hash+ext);await fsp.mkdir(root,{recursive:true,mode:0o700});try{await fsp.copyFile(file,archive,fs.constants.COPYFILE_EXCL);}catch(error){if(error.code!=='EEXIST')throw error;}await fsp.chmod(archive,0o600);if(await hashFile(archive)!==hash)throw Error('ARQUIVO_PRIVADO_DIVERGENTE');
 await context.onHash?.(hash);
 let load;try{
  load=await repository.beginLoad(db,{environment:context.environment,tenantId:context.tenantId,hash,parserVersion:PARSER_VERSION,filename:context.filename,archive,timeZone:'America/Sao_Paulo',retry:true,deliveryId:context.deliveryId,deliveryReservation:context.deliveryReservation});await context.onLoad?.(load.id);
  if(load.skipped){
   const repeatedRows=[];
   if(context.confirmSends)await readReference(archive,{timeZone:'America/Sao_Paulo',allowEmpty:true,onBatch:async rows=>{repeatedRows.push(rows.map(row=>({documentId:row.documentId,hash:row.hash})));}});
   await repository.refreshRepeatedReport(db,load,generated,{...context,repeatedRows});return {loadId:load.id,repeated:true};}
  const summary=await readReference(archive,{timeZone:'America/Sao_Paulo',allowEmpty:true,onBatch:async rows=>{await context.assertLease?.();if(rows.some(row=>Date.parse(row.updatedAtSource)>+generated+300000))throw Error('DATAS_DA_FONTE_INCONSISTENTES');await repository.stageBatch(db,load,rows,context);}});
  if(summary.invalid)throw Error('RELATORIO_COM_LINHAS_INVALIDAS');await context.assertLease?.();
  const result=await repository.applyLoad(db,load,summary,{...context,generatedAt:generated,incremental:true});return {loadId:load.id,...result};
 }catch(error){if(load&&!load.skipped)await repository.failLoad(db,load,{},'Falha no processamento incremental. Confira o recebimento.',context);throw error;}
}
module.exports={hashFile,applyReferenceFile};
