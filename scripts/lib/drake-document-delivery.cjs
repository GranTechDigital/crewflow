const {randomUUID,createHash,randomBytes,createCipheriv,createDecipheriv,timingSafeEqual}=require('node:crypto');
const net=require('node:net');
function configuration(env=process.env){
 const environment=require('./certificate-environment.cjs').normalizeCertificateEnvironment(env.DRAKE_ENVIRONMENT);
 const tenant=env.DRAKE_TENANT_ID,token=env.DRAKE_DOCUMENT_WEBHOOK_TOKEN||'',key=Buffer.from(env.DRAKE_DOCUMENT_URL_KEY||'','base64');
 const captureUnknownStorage=env.DRAKE_DOCUMENT_CAPTURE_UNKNOWN_STORAGE==='true',allowAzureBlob=env.DRAKE_DOCUMENT_ALLOW_AZURE_BLOB==='true';
 const hosts=(env.DRAKE_DOCUMENT_ALLOWED_HOSTS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
 if(!environment||!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(tenant||'')||token.length<32||key.length!==32||(!hosts.length&&!captureUnknownStorage&&!allowAzureBlob)||hosts.some(h=>net.isIP(h)||!h.includes('.')||h.includes('*')||h.includes('/')||h.endsWith('.local')||h.endsWith('.internal')))throw Error('CONFIGURACAO_DOCUMENTOS_INCOMPLETA');
 const reportName=env.DRAKE_DOCUMENT_REPORT_NAME||null,windowHours=Number(env.DRAKE_DOCUMENT_REPORT_WINDOW_HOURS||0);
 if((reportName||windowHours)&&(!reportName||windowHours!==72))throw Error('PERFIL_DO_RELATORIO_INVALIDO');
 return {environment,tenantId:tenant,token,key,hosts,reportName,windowHours,captureUnknownStorage,allowAzureBlob};
}
function authorized(header,token){const match=/^Bearer ([^\s]+)$/i.exec(header||'');if(!match)return false;const a=Buffer.from(match[1]),b=Buffer.from(token);return a.length===b.length&&timingSafeEqual(a,b);}
function azureBlobHost(host){return /^[a-z0-9]{3,24}\.blob\.core\.windows\.net$/i.test(host);}
function validateUrl(value,config){let url;try{url=new URL(value)}catch{throw Error('URL_NAO_PERMITIDA')};const host=url.hostname.toLowerCase(),allowed=config.hosts.includes(host)||(config.allowAzureBlob&&azureBlobHost(host));if(typeof value!=='string'||value.length>16000||url.protocol!=='https:'||url.username||url.password||url.hash||(url.port&&url.port!=='443')||net.isIP(url.hostname)||!allowed)throw Error('URL_NAO_PERMITIDA');return url;}
function awareDate(value){if(typeof value!=='string'||!/(Z|[+-]\d{2}:\d{2})$/.test(value)||!Number.isFinite(Date.parse(value)))throw Error('DATA_COM_FUSO_OBRIGATORIA');return new Date(value);}
function envelope(body,config,now=new Date()){
 if(!body||typeof body!=='object'||Array.isArray(body))throw Error('OBJETO_JSON_OBRIGATORIO');
 if(typeof body.name!=='string'||body.name.length>250||!(/\.(xlsx|csv)$/i.test(body.name)))throw Error('NOME_DE_RELATORIO_INVALIDO');
 const url=validateUrl(body.url,config),validUntil=awareDate(body.validUntil);if(validUntil<=now)throw Error('LINK_EXPIRADO');
 if(body.tenantId&&String(body.tenantId).toLowerCase()!==config.tenantId.toLowerCase()||body.environment&&body.environment!==config.environment)throw Error('ORIGEM_DIVERGENTE');
 let generatedAt=null,windowStart=null,windowEnd=null;
 if(body.generatedAt!==undefined||body.windowStart!==undefined||body.windowEnd!==undefined){
  generatedAt=awareDate(body.generatedAt);windowStart=awareDate(body.windowStart);windowEnd=awareDate(body.windowEnd);
  const hours=(windowEnd-windowStart)/3600000;if(generatedAt>new Date(+now+300000)||+now-generatedAt>48*3600000||windowEnd>new Date(+generatedAt+300000)||generatedAt-windowEnd>3600000||hours<48||hours>96)throw Error('JANELA_OU_GERACAO_INVALIDA');
 }
 if(body.scope!==undefined&&body.scope!=='certificates')throw Error('ESCOPO_INVALIDO');
 const ready=!!generatedAt&&body.scope==='certificates'||!generatedAt&&config.windowHours===72&&body.name===config.reportName;
 return {name:body.name,url:url.href,validUntil,generatedAt,windowStart,windowEnd,ready};
}
function encrypt(value,key){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);return Buffer.concat([iv,cipher.update(value,'utf8'),cipher.final(),cipher.getAuthTag()]).toString('base64');}
function decrypt(value,key){const b=Buffer.from(value,'base64');if(b.length<29)throw Error('URL_CIFRADA_INVALIDA');const decipher=createDecipheriv('aes-256-gcm',key,b.subarray(0,12));decipher.setAuthTag(b.subarray(-16));return Buffer.concat([decipher.update(b.subarray(12,-16)),decipher.final()]).toString('utf8');}
async function recordReceiptAttempt(db,config,{route,status,code,body}){
 const bytes=Buffer.isBuffer(body)?body:Buffer.alloc(0);
 const hash=bytes.length?createHash('sha256').update(bytes).digest('hex'):null,corpo=status>=400&&bytes.length?encrypt(bytes.toString('utf8'),config.key):null;
 await db.$executeRaw`INSERT INTO "DrakeDocumentoTentativaRecebimento" (id,ambiente,rota,"httpStatus",codigo,"tamanhoCorpo","hashCorpo","corpoCifrado") VALUES (${randomUUID()}::uuid,${config.environment},${route},${status},${code},${bytes.length},${hash},${corpo})`;
}
async function receive(db,body,config){
 let quarantine=false,validationConfig=config;
 if(config.captureUnknownStorage&&body&&typeof body.url==='string'){
  let candidate;try{candidate=new URL(body.url)}catch{}
  if(candidate&&!config.hosts.includes(candidate.hostname)&&/^[a-z0-9]{3,24}\.blob\.core\.windows\.net$/.test(candidate.hostname)){
   quarantine=true;validationConfig={...config,hosts:[candidate.hostname]};
  }
 }
 const input=envelope(body,validationConfig),id=randomUUID(),fingerprint=createHash('sha256').update(JSON.stringify({...input,url:input.url,tenant:config.tenantId,env:config.environment})).digest('hex');const status=quarantine?'AGUARDANDO_DESTINO':input.ready?'PENDENTE':'AGUARDANDO_METADADOS';
 const inserted=await db.$queryRaw`INSERT INTO "DrakeDocumentoEntrega" (id,ambiente,"tenantId","hashRecebimento","nomeArquivo","urlCifrada","validoAte","geradoEm","janelaInicio","janelaFim",status) VALUES (${id}::uuid,${config.environment},${config.tenantId}::uuid,${fingerprint},${input.name},${encrypt(input.url,config.key)},${input.validUntil},${input.generatedAt},${input.windowStart},${input.windowEnd},${status}) ON CONFLICT (ambiente,"tenantId","hashRecebimento") DO NOTHING RETURNING id,status`;
 if(!quarantine&&input.ready)await db.$executeRaw`UPDATE "DrakeDocumentoEntrega" SET status='PENDENTE' WHERE ambiente=${config.environment} AND "tenantId"=${config.tenantId}::uuid AND "hashRecebimento"=${fingerprint} AND status='AGUARDANDO_DESTINO'`;
 const row=inserted[0]||(await db.$queryRaw`SELECT id,status FROM "DrakeDocumentoEntrega" WHERE ambiente=${config.environment} AND "tenantId"=${config.tenantId}::uuid AND "hashRecebimento"=${fingerprint}`)[0];
 return {id:row.id,status:row.status,repetido:!inserted.length,pendencia:row.status==='AGUARDANDO_DESTINO'?'Recebimento guardado; armazenamento aguarda validacao. Nenhum download foi realizado.':row.status==='AGUARDANDO_METADADOS'?'Informe generatedAt, windowStart, windowEnd com fuso e scope=certificates. O recebimento foi guardado, mas não atualizará a referência.':null};
}
module.exports={configuration,authorized,validateUrl,envelope,encrypt,decrypt,receive,recordReceiptAttempt};
