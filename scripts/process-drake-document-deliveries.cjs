// Worker da referência: apenas download e atualização local; nunca chama SyncDocument.
const path=require('node:path'),{configuration}=require('./lib/drake-document-delivery.cjs'),{runOne,recover}=require('./lib/drake-document-worker.cjs');
(async()=>{
 const argv=process.argv.slice(2);if(argv.includes('--help')){console.log('node scripts/process-drake-document-deliveries.cjs [--env-file caminho] --execute [--once | --recover UUID]');return;}
 const options={};for(let i=0;i<argv.length;i++){if(['--execute','--once'].includes(argv[i]))options[argv[i].slice(2)]=true;else if(['--env-file','--recover'].includes(argv[i])&&argv[i+1])options[argv[i].slice(2)]=argv[++i];else throw Error('ARGUMENTO_INVALIDO');}
 if(options['env-file'])process.loadEnvFile(path.resolve(options['env-file']));const config=configuration();
 const {PrismaClient}=require('@prisma/client'),db=new PrismaClient({log:[]});
 try{if(!options.execute){const rows=await db.$queryRaw`SELECT status,COUNT(*)::int AS quantidade FROM "DrakeDocumentoEntrega" WHERE ambiente=${config.environment} AND "tenantId"=${config.tenantId}::uuid GROUP BY status`;console.log(JSON.stringify({modo:'SOMENTE_LEITURA',recebimentos:rows}));return;}
  if(options.recover){console.log(JSON.stringify(await recover(db,config,options.recover)));return;}
  let stop=false;process.once('SIGINT',()=>{stop=true;});process.once('SIGTERM',()=>{stop=true;});
  do{const result=await runOne(db,config);if(result)console.log(JSON.stringify(result));if(process.env.DRAKE_DOCUMENT_WORKER_HEARTBEAT_FILE)require('node:fs').writeFileSync(process.env.DRAKE_DOCUMENT_WORKER_HEARTBEAT_FILE,String(Date.now()),{mode:0o600});if(!options.once&&!stop)await new Promise(resolve=>setTimeout(resolve,3000));}while(!options.once&&!stop);
 }finally{await db.$disconnect();}
})().catch(()=>{console.error('Worker de documentos não iniciado/concluído. Confira configuração e estados persistidos; nenhuma URL ou credencial é exibida.');process.exitCode=1;});
