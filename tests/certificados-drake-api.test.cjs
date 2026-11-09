process.env.DRAKE_ENVIRONMENT='hmg';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {NextRequest}=require('next/server');
const ExcelJS=require('exceljs');
const {loader}=require('./certificados-loader.cjs');

test('APIs validam confirmação, origem e tamanho, entregam modelo e stream com resultado',async()=>{
  let sends=0,lastSelection,lastAll;
  const load=loader({
    '@/utils/authUtils':{getUserFromRequest:async()=>({id:1,funcionario:{nome:'Operador'},equipe:{nome:'Treinamento (Editor)',ativo:true}})},
    '@/lib/prisma':{prisma:{}},
    '@/lib/integracoes/certificadosDrakeImportacao':{
      enviarCertificadosPendentesDrake:async({onProgress,itemIds,todosPendentes,totalEsperado})=>{sends++;lastSelection=itemIds;lastAll={todosPendentes,totalEsperado};onProgress?.({fase:'ENVIANDO',processados:1,total:1,enviados:1,falhas:0,naoConfirmados:0,ignorados:0});return {importacao:{id:1,envioToken:null,envioHeartbeatEm:null},totalSelecionado:1,processados:1,enviados:1,falhas:0,naoConfirmados:0,ignorados:0,interrompido:false}},
    },
  });
  const send=load('src/app/api/treinamento/importacoes-certificados/[id]/enviar/route.ts');
  const base=load('src/app/api/treinamento/importacoes-certificados/route.ts');
  const params={params:Promise.resolve({id:'1'})};
  const request=(body,headers={})=>new NextRequest('http://localhost:3108/api/treinamento/importacoes-certificados/1/enviar',{method:'POST',headers:{host:'localhost:3108',origin:'http://localhost:3108','content-type':'application/json',...headers},body:JSON.stringify(body)});
  assert.equal((await send.POST(request({limit:5}),params)).status,400);
  assert.equal((await send.POST(request({confirmar:true,limit:NaN}),params)).status,400);
  assert.equal((await send.POST(request({confirmar:true},{origin:'https://outro-site.invalid'}),params)).status,403);
  assert.equal((await send.POST(request({confirmar:true,padding:'x'.repeat(5000)}),params)).status,413);assert.equal(sends,0);
  assert.equal((await send.POST(request({confirmar:true,itemIds:[8,8]}),params)).status,400);
  const streamed=await send.POST(request({confirmar:true,limit:1,itemIds:[8]},{accept:'application/x-ndjson'}),params);
  assert.match(streamed.headers.get('content-type'),/ndjson/);
  const events=(await streamed.text()).trim().split('\n').map(line=>JSON.parse(line));assert.equal(events[0].progresso.processados,1);assert.equal(events.at(-1).tipo,'concluido');assert.equal('envioToken' in events.at(-1).resultado.importacao,false);assert.equal(sends,1);
  assert.deepEqual(lastSelection,[8]);
  for(const body of [
    {todosPendentes:true,totalEsperado:51},
    {confirmar:true,todosPendentes:'true',totalEsperado:51},
    {confirmar:true,todosPendentes:true},
    {confirmar:true,todosPendentes:true,totalEsperado:20001},
    {confirmar:true,todosPendentes:true,totalEsperado:51,itemIds:[8]},
    {confirmar:true,todosPendentes:true,totalEsperado:51,limit:50},
  ])assert.equal((await send.POST(request(body),params)).status,400);
  assert.equal(sends,1);
  const all=await send.POST(request({confirmar:true,todosPendentes:true,totalEsperado:51},{accept:'application/x-ndjson'}),params);
  assert.match(all.headers.get('content-type'),/ndjson/);await all.text();assert.equal(sends,2);assert.deepEqual(lastAll,{todosPendentes:true,totalEsperado:51});assert.equal(lastSelection,undefined);
  const model=await base.GET(new NextRequest('http://localhost:3108/api/treinamento/importacoes-certificados?modelo=1'));
  assert.equal(model.status,200);assert.match(model.headers.get('content-disposition'),/modelo-certificados\.xlsx/);
  const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(Buffer.from(await model.arrayBuffer()));assert.equal(workbook.worksheets[0].rowCount,1);assert.equal(workbook.worksheets[0].columnCount,8);
});


test('Salvar é separado do envio unitário; bloqueios não enviam e falha preserva a correção salva',async()=>{
 let sends=0,saves=0,blocked=false,fail=false;
 const load=loader({
  '@/utils/authUtils':{getUserFromRequest:async()=>({id:1,funcionario:{nome:'Operador'},equipe:{nome:'Treinamento (Editor)',ativo:true}})},
  '@/lib/prisma':{prisma:{}},
  '@/lib/integracoes/certificadosDrakeEditing':{editarCertificado:async()=>{saves++;return {item:{id:8,status:blocked?'POSSIVEL_DUPLICIDADE':'PENDENTE_ENVIO',motivoErro:'Conferir documento existente'},importacao:{id:1}}}},
  '@/lib/integracoes/certificadosDrakeSend':{enviarCertificadosPendentesDrake:async options=>{sends++;assert.deepEqual(options.itemIds,[8]);assert.equal(options.limit,1);if(fail)throw Error('indisponível');return {importacao:{id:1},enviados:1,falhas:0,naoConfirmados:0,ignorados:0}}},
 });
 const route=load('src/app/api/treinamento/importacoes-certificados/[id]/itens/[itemId]/route.ts'),params={params:Promise.resolve({id:'1',itemId:'8'})};
 const request=body=>new NextRequest('http://localhost/itens/8',{method:'PATCH',headers:{host:'localhost',origin:'http://localhost','content-type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await route.PATCH(request({enviar:true}),params)).status,400);assert.equal(saves,0);
 let response=await route.PATCH(request({enviar:false}),params);assert.equal(response.status,200);assert.equal(sends,0);assert.equal((await response.json()).salvo,true);
 blocked=true;response=await route.PATCH(request({enviar:true,confirmar:true}),params);assert.equal(sends,0);assert.match((await response.json()).mensagem,/bloqueado/);
 blocked=false;response=await route.PATCH(request({enviar:true,confirmar:true}),params);assert.equal(sends,1);assert.equal((await response.json()).salvo,true);
 fail=true;response=await route.PATCH(request({enviar:true,confirmar:true}),params);assert.equal(response.status,200);assert.equal((await response.json()).salvo,true);assert.equal(sends,2);
});
