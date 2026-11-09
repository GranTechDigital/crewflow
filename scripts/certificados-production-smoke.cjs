// Apenas consultas internas. Não cria sessões, documentos ou tentativas no Drake.
const crypto=require('node:crypto'),{PrismaClient}=require('@prisma/client');
const p=new PrismaClient({log:[]});
function token(userId){const now=Math.floor(Date.now()/1000),payload=Buffer.from(JSON.stringify({userId,iat:now,exp:now+300})).toString('hex');return 'v1.'+payload+'.'+crypto.createHmac('sha256',process.env.JWT_SECRET).update('v1.'+payload).digest('hex');}
(async()=>{
 const actor=await p.usuario.findFirst({where:{ativo:true,equipe:{nome:{contains:'Administra',mode:'insensitive'}}},select:{id:true}});if(!actor)throw Error('ADMINISTRADOR_ATIVO_NAO_ENCONTRADO');
 const base='http://127.0.0.1:3001',headers={Cookie:'auth-token='+token(actor.id)};
 const result={};
 for(const path of ['/api/auth/me','/api/logistica/sispat?page=1&limit=1','/api/treinamento/importacoes-certificados?page=1&limit=1']){const r=await fetch(base+path,{headers});result[path]=r.status;if(r.status!==200)throw Error('CONSULTA_NAO_APROVADA: '+path);if(path.includes('importacoes-certificados')){const data=await r.json();if(data.ambiente!=='prd')throw Error('AMBIENTE_DIVERGENTE');}}
 const model=await fetch(base+'/api/treinamento/importacoes-certificados?modelo=1',{headers});if(model.status!==200||!(model.headers.get('content-type')||'').includes('spreadsheetml'))throw Error('MODELO_XLSX_INVALIDO');const bytes=new Uint8Array(await model.arrayBuffer());if(bytes[0]!==80||bytes[1]!==75)throw Error('MODELO_NAO_E_ZIP');result.modelo=200;
 const endpoint=base+'/api/integracoes/drake/documentos/webhook';
 const unauth=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});if(unauth.status!==401)throw Error('WEBHOOK_NAO_REJEITOU_SEM_TOKEN');
 const invalid=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+process.env.DRAKE_DOCUMENT_WEBHOOK_TOKEN},body:'{}'});if(invalid.status!==400)throw Error('WEBHOOK_NAO_VALIDOU_PAYLOAD');result.webhook={unauth:401,invalid:400};
 console.log(JSON.stringify({ok:true,checks:result}));
})().catch(error=>{console.error(error.message);process.exitCode=1}).finally(()=>p.$disconnect());
