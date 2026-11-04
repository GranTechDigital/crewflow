const { test } = require('node:test');
const assert = require('node:assert/strict');
const { NextRequest } = require('next/server');
const ExcelJS = require('exceljs');
const { loader } = require('./loader.cjs');
function fixture() {
  let rows = [{ id:1, nome:'Pessoa teste', matricula:'0001', sispat:null, atualizadoEm:new Date('2026-11-04T10:00:00Z'), status:'ATIVO' }];
  const users = new Map(); let rawCalls=0; let conflictAt=0;
  const db = {
    usuario: { findUnique: async ({where}) => users.get(where.id) || null },
    funcionario: {
      findMany: async ({where,skip=0,take,orderBy}) => {
        let found=rows;
        if(where?.matricula?.in)found=found.filter(r=>where.matricula.in.includes(r.matricula));
        return found.slice(skip,take?skip+take:undefined).map(r=>({...r}));
      },
      count: async()=>rows.length,
      findFirst: async ({where})=>rows.find(r=>r.id===where.id&&r.sispat===where.sispat&&r.atualizadoEm.getTime()===where.atualizadoEm.getTime())??null,
      updateMany: async ({where,data})=> {
        const found=rows.find(r=>r.id===where.id&&r.sispat===where.sispat&&r.atualizadoEm.getTime()===where.atualizadoEm.getTime());
        if(!found)return{count:0}; Object.assign(found,data,{atualizadoEm:new Date()});return{count:1};
      },
    },
    $queryRaw: async sql => {
      rawCalls++; if(rawCalls===conflictAt)return [];
      const ids=[]; for(let i=0;i<sql.values.length;i+=4){const [id,old,next,version]=sql.values.slice(i,i+4);const row=rows.find(r=>r.id===id&&r.sispat===old&&r.atualizadoEm.getTime()===version.getTime());if(row){row.sispat=next;row.atualizadoEm=new Date();ids.push({id});}}
      return ids;
    },
    $transaction: async action => {
      if(Array.isArray(action))return Promise.all(action);
      const old=structuredClone(rows);
      try{return await action(db)}catch(e){rows=old;throw e}
    },
  };
  const importCalls=[];
  const importsService={
    createSispatImport:async(parsed,name,actor,actorNome)=>{importCalls.push({action:'preview',parsed,name,actor,actorNome});return{id:'11111111-1111-4111-8111-111111111111',total:parsed.total};},
    confirmSispatImport:async(id,actor)=>{importCalls.push({action:'confirm',id,actor});return{id,status:'APLICADA'};},
    revertSispatImport:async(id,actor,actorNome)=>{importCalls.push({action:'revert',id,actor,actorNome});return{id,status:'DESFEITA'};},
    getSispatImport:async(id,page,limit,situacao)=>({id,page,limit,situacao,itens:[]}),
    listSispatImports:async(page,limit)=>({page,limit,total:0,importacoes:[]}),
    getSispatDuplicate:async(id,sispat,page,limit)=>({id,sispat,page,limit,itens:[]}),
    downloadSispatIssues:async()=>Buffer.from('xlsx-test'),
    downloadSispatBackup:async(id)=>({id,versaoBackup:1,registros:[]}),
  };
  const load=loader({'@/lib/prisma':{prisma:db},'@/lib/sispat/imports':importsService});
  const route=load('src/app/api/logistica/sispat/route.ts');
  const auth=load('src/lib/authToken.ts');
  async function user(team='Logística', opts={}){
    const id=users.size+1;users.set(id,{id,funcionario:{nome:'Operador teste'},ativo:opts.ativo??true,equipe:{nome:team,ativo:opts.equipeAtiva??true}});
    return auth.signAuthToken({userId:id});
  }
  function request(method,token,body,headers={}){
    return new NextRequest('http://localhost:3107/api/logistica/sispat',{method,headers:{host:'localhost:3107',origin:'http://localhost:3107',...(token?{cookie:`auth-token=${token}`} : {}),...headers},body});
  }
  async function sheet(data=[['0001','000123']]){const w=new ExcelJS.Workbook();w.addWorksheet('Completa').addRows([['Nome','Matrícula','CPF','SISPAT'],['Pessoa teste','0001','123','1']]);w.addWorksheet('Planilha1').addRows([['Matrícula','SISPAT'],...data]);return new File([await w.xlsx.writeBuffer()],'teste.xlsx');}
  function form(file,action,token){const f=new FormData();f.set('file',file);f.set('action',action);if(token)f.set('token',token);return f;}
  return {route,auth,user,request,sheet,form,db,importCalls,importsService,get rows(){return rows},set rows(v){rows=v},set conflict(v){conflictAt=v}};
}

test('Todas as operações bloqueiam não autenticado, outros setores, inativos e equipe inativa', async()=>{
  const f=fixture();
  const tokens=[null,await f.user('Logística (Visualizador)'),await f.user('Liderança (Visualizador)'),await f.user('RH'),await f.user('Logística',{ativo:false}),await f.user('Logística',{equipeAtiva:false})];
  for(const token of tokens)for(const method of ['GET','POST','PUT','DELETE']){
    const res=await f.route[method](f.request(method,token));assert.ok([401,403].includes(res.status),`${method} ${res.status}`);
  }
  assert.equal(f.rows[0].sispat,null);
});
test('Administração e Logística Editor/Gestor acessam lista, exportação e CRUD com conflito de versão', async()=>{
  for(const team of ['Administração','Logística','Logística (Editor)','Logística (Gestor)']){
    const f=fixture(),token=await f.user(team);let res=await f.route.GET(f.request('GET',token));assert.equal(res.status,200);assert.equal((await res.json()).total,1);
    res=await f.route.GET(new NextRequest('http://localhost:3107/api/logistica/sispat?export=1',{headers:{cookie:`auth-token=${token}`}}));assert.equal(res.status,200);const wb=new ExcelJS.Workbook();await wb.xlsx.load(Buffer.from(await res.arrayBuffer()));assert.deepEqual(wb.worksheets[0].getRow(1).values.slice(1),['Matrícula','SISPAT']);
    const old={...f.rows[0]};const body=JSON.stringify({id:1,anterior:null,atualizadoEm:old.atualizadoEm.toISOString(),sispat:'000123'});
    res=await f.route.PUT(f.request('PUT',token,body));assert.equal(res.status,200);assert.equal(f.rows[0].sispat,'000123');assert.equal(f.rows[0].status,'ATIVO');
    assert.equal((await f.route.PUT(f.request('PUT',token,body))).status,409);
    res=await f.route.DELETE(f.request('DELETE',token,JSON.stringify({id:1,anterior:'000123',atualizadoEm:f.rows[0].atualizadoEm.toISOString()})));assert.equal(res.status,200);assert.equal(f.rows.length,1);assert.equal(f.rows[0].sispat,null);
  }
});
test('Rejeita CSRF e payload inválido; exclusão não remove o funcionário', async()=>{
  const f=fixture(),token=await f.user();
  assert.equal((await f.route.PUT(f.request('PUT',token,'{}',{origin:'https://outro-site.example'}))).status,403);
  assert.equal((await f.route.PUT(f.request('PUT',token,'{}'))).status,400);
  assert.equal((await f.route.PUT(f.request('PUT',token,'null'))).status,400);
  assert.equal((await f.route.PUT(f.request('PUT',token,JSON.stringify({id:1,anterior:null,atualizadoEm:f.rows[0].atualizadoEm.toISOString(),sispat:'Sem SISPAT'})))).status,400);
});

test('Preview persiste a aba de duas colunas e erros por linha, sem alterar funcionários', async()=>{
 const f=fixture(),token=await f.user();const file=await f.sheet([['0001','000123'],['AUSENTE','999'],['SEM','Sem SISPAT'],['ERRO','abc']]);
 const res=await f.route.POST(f.request('POST',token,f.form(file,'preview')));assert.equal(res.status,201);assert.equal(f.importCalls.length,1);
 const parsed=f.importCalls[0].parsed;assert.equal(parsed.aba,'Planilha1');assert.equal(parsed.total,4);assert.equal(parsed.registros.filter(r=>r.status==='ERRO').length,1);assert.equal(parsed.ignorados,1);assert.equal(f.rows[0].sispat,null);
});
test('Upload funciona sem File global no Node 18 e rejeita campo textual ou ausente', async()=>{
 const f=fixture(),token=await f.user(),file=await f.sheet();
 const original=Object.getOwnPropertyDescriptor(globalThis,'File');
 try {
  Object.defineProperty(globalThis,'File',{value:undefined,configurable:true,writable:true});
  const res=await f.route.POST(f.request('POST',token,f.form(file,'preview')));
  assert.equal(res.status,201);assert.equal(f.importCalls.length,1);assert.equal(f.rows[0].sispat,null);
  for(const value of [null,'teste.xlsx']){const form=new FormData();form.set('action','preview');if(value!==null)form.set('file',value);assert.equal((await f.route.POST(f.request('POST',token,form))).status,400);}
 } finally { if(original)Object.defineProperty(globalThis,'File',original);else delete globalThis.File; }
});

test('Confirmar e desfazer exigem autenticação, origem e ID e encaminham autoria ao serviço', async()=>{
 const f=fixture(),token=await f.user('Administração'),id='11111111-1111-4111-8111-111111111111';
 for(const action of ['confirm','revert']){const response=await f.route.POST(f.request('POST',token,JSON.stringify({action,importacaoId:id}),{'content-type':'application/json'}));assert.equal(response.status,200);assert.deepEqual(f.importCalls.at(-1),{action,id,actor:1,...(action==='revert'?{actorNome:'Operador teste'}:{})});}
 const body=JSON.stringify({action:'revert',importacaoId:id});
 assert.equal((await f.route.POST(f.request('POST',token,body,{'content-type':'application/json',origin:'https://externo.example'}))).status,403);
 assert.equal((await f.route.POST(f.request('POST',token,JSON.stringify({action:'confirm',importacaoId:'invalido'}),{'content-type':'application/json'}))).status,400);
});
test('Resultado e histórico têm paginação limitada; backup JSON é exclusivo de Administração', async()=>{
 const f=fixture(),token=await f.user('Administração');const id='11111111-1111-4111-8111-111111111111';
 const request=url=>new NextRequest('http://localhost:3107/api/logistica/sispat'+url,{headers:{cookie:`auth-token=${token}`}});
 let response=await f.route.GET(request(`?importacao=${id}&page=2&limit=999&situacao=ERRO`));let body=await response.json();assert.equal(body.limit,100);assert.equal(body.page,2);assert.equal(body.situacao,'ERRO');
 response=await f.route.GET(request('?historico=1&page=3'));body=await response.json();assert.equal(body.page,3);assert.equal(body.limit,10);
 response=await f.route.GET(request(`?importacao=${id}&download=1`));assert.equal(response.status,200);assert.match(response.headers.get('content-disposition'),/attachment/);assert.equal((await response.json()).versaoBackup,1);
 for(const team of ['Logística','Logística (Editor)','Logística (Gestor)']) {
   const restricted=await f.user(team);const denied=await f.route.GET(new NextRequest(`http://localhost:3107/api/logistica/sispat?importacao=${id}&download=1`,{headers:{cookie:`auth-token=${restricted}`}}));assert.equal(denied.status,403);
 }
});

test('Edição individual igual ao atual também não grava nem altera a versão', async()=>{
 const f=fixture(),token=await f.user();f.rows[0].sispat='123';const old=f.rows[0].atualizadoEm.toISOString();
 const response=await f.route.PUT(f.request('PUT',token,JSON.stringify({id:1,anterior:'123',sispat:'123',atualizadoEm:old})));
 assert.equal(response.status,200);assert.equal((await response.json()).semAlteracao,true);assert.equal(f.rows[0].atualizadoEm.toISOString(),old);
});

test('Pendências e envolvidos exigem acesso e a paginação de duplicidade fica limitada', async()=>{
 const f=fixture(),token=await f.user(),viewer=await f.user('Logística (Visualizador)'),id='11111111-1111-4111-8111-111111111111';
 const request=(query,t=token)=>new NextRequest('http://localhost:3107/api/logistica/sispat'+query,{headers:{cookie:`auth-token=${t}`}});
 let response=await f.route.GET(request(`?importacao=${id}&duplicidade=000123&page=2&limit=999`));assert.equal(response.status,200);const body=await response.json();assert.equal(body.sispat,'000123');assert.equal(body.page,2);assert.equal(body.limit,100);
 response=await f.route.GET(request(`?importacao=${id}&pendencias=1`));assert.equal(response.status,200);assert.match(response.headers.get('content-disposition'),/pendencias.*xlsx/);
 for(const query of [`?importacao=${id}&pendencias=1`,`?importacao=${id}&duplicidade=000123`])assert.equal((await f.route.GET(request(query,viewer))).status,403);
});

test('Progresso via stream distingue commit de erro e suporta pacotes fragmentados',async()=>{
 const f=fixture(),token=await f.user(),id='11111111-1111-4111-8111-111111111111';
 const {readSispatProgress}=loader()('src/lib/sispat/progress.ts');
 const request=()=>f.request('POST',token,JSON.stringify({action:'confirm',importacaoId:id}),{'content-type':'application/json',accept:'application/x-ndjson'});
 f.importsService.confirmSispatImport=async(id,actor,report)=>{report({fase:'PROCESSANDO',processados:300,total:301});report({fase:'CONFIRMANDO',processados:301,total:301});return{id,status:'APLICADA'};};
 const events=[];const response=await f.route.POST(request());assert.match(response.headers.get('content-type'),/ndjson/);const result=await readSispatProgress(response,event=>events.push(event));assert.equal(result.status,'APLICADA');assert.equal(events.at(-1).fase,'CONFIRMANDO');
 f.importsService.confirmSispatImport=async(id,actor,report)=>{report({fase:'PROCESSANDO',processados:1,total:1});throw new Error('simulated rollback');};
 await assert.rejects(readSispatProgress(await f.route.POST(request()),()=>{}),/Consulte o histórico/);
 const bytes=new TextEncoder().encode(JSON.stringify({tipo:'concluido',resultado:{id,status:'APLICADA',nomeArquivo:'acentuação.xlsx'}})+'\n');
 const fragmented=new ReadableStream({start(c){for(let i=0;i<bytes.length;i+=3)c.enqueue(bytes.slice(i,i+3));c.close();}});
 assert.equal((await readSispatProgress(new Response(fragmented,{headers:{'content-type':'application/x-ndjson'}}),()=>{})).nomeArquivo,'acentuação.xlsx');
});
