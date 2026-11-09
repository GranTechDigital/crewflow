const fs=require('node:fs'),{PrismaClient}=require('@prisma/client');
const permitted=[
 '20261008100000_add_importacao_certificados_drake','20261105123000_harden_certificados_drake',
 '20261106150000_add_drake_document_reference','20261106170000_add_drake_document_check',
 '20261106190000_add_drake_document_delete','20261106200000_add_drake_document_restore',
 '20261106210000_certificados_versions_edits','20261109100000_drake_document_delivery',
 '20261109130000_drake_document_confirmation','20261109160000_certificados_production',
 '20261109170000_drake_document_receipt_audit','20261109180000_drake_document_receipt_error_body'
];
const p=new PrismaClient({log:[]});
(async()=>{
 if(require('./lib/certificate-environment.cjs').normalizeCertificateEnvironment(process.env.DRAKE_ENVIRONMENT)!=='prd')throw Error('PREFLIGHT_EXIGE_PRODUCAO');
 const applied=await p.$queryRaw`SELECT migration_name,finished_at,rolled_back_at FROM "_prisma_migrations"`;
 if(applied.some(row=>!row.finished_at&&!row.rolled_back_at))throw Error('MIGRACAO_INTERROMPIDA_EXISTENTE');
 const done=new Set(applied.filter(row=>row.finished_at&&!row.rolled_back_at).map(row=>row.migration_name));
 const pending=fs.readdirSync('prisma/migrations',{withFileTypes:true}).filter(row=>row.isDirectory()&&!done.has(row.name)).map(row=>row.name);
 if(pending.some(name=>!permitted.includes(name)))throw Error('MIGRACOES_FORA_DO_ESCOPO: '+pending.filter(name=>!permitted.includes(name)).join(','));
 console.log(JSON.stringify({pending,counts:{funcionarios:await p.funcionario.count(),usuarios:await p.usuario.count(),sispat:await p.$queryRaw`SELECT COUNT(*)::int AS n FROM "SispatImportacao"`},ambiente:'prd'}));
})().catch(error=>{console.error(error.message);process.exitCode=1}).finally(()=>p.$disconnect());
