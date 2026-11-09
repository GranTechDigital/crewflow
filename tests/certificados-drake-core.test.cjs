process.env.DRAKE_ENVIRONMENT='hmg';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const ExcelJS=require('exceljs');
const {loader}=require('./certificados-loader.cjs');

function fixture() {
  const rows=[]; const db={
    funcionario:{findMany:async()=>[{id:1,matricula:'0001'}]},
    importacaoCertificadoDrake:{findUnique:async({where})=>{assert.equal(where.ambiente_hashArquivo.ambiente,'hmg');return null},findUniqueOrThrow:async()=>({envioToken:null}),create:async()=>({id:1}),update:async({data})=>({id:1,...data})},
    importacaoCertificadoDrakeItem:{findMany:async({where})=>{assert.equal(where.importacao.ambiente,'hmg');return []},createMany:async({data})=>{rows.push(...data)},groupBy:async()=>Object.entries(rows.reduce((acc,r)=>(acc[r.status]=(acc[r.status]||0)+1,acc),{})).map(([status,n])=>({status,_count:{_all:n}}))},
    $executeRaw:async()=>1,
    $transaction:async action=>action(db),
  };
  const load=loader({'@/lib/prisma':{prisma:db},'src/lib/integracoes/certificadosDrakeReference.ts':{checkReferenceBatch:async(_db,_environment,rows)=>new Map(rows.map(row=>[row.key,{status:'NOVO',motivo:null,origemId:null,versao:1,conferidoEm:new Date().toISOString(),totalCandidatos:0,candidatos:[]}])),saveReferenceChecks:async()=>{}},});
  return {rows,db,load,create:options=>load('src/lib/integracoes/certificadosDrakeImportacao.ts').criarImportacaoCertificadosDrake({descricao:'Teste de importação',...options})};
}
async function file(rows, {title=false,duplicateHeader=false,formula=false,numericMask=false}={}) {
  const w=new ExcelJS.Workbook(),s=w.addWorksheet('Dados');
  if(title){s.addRow(['Relatório de certificados']);s.addRow([])}
  s.addRow(['Extra','Validade','Matrícula','Recebimento','Nome','Tipo Documento','Emissao','Certificadora','Qualificacao',...(duplicateHeader?['Matricula']:[])]);
  for(const row of rows){const r=s.addRow(['Ignorado',row.validade??'31/12/2027',row.matricula??'0001',row.recebimento??'','Pessoa','Certificado',row.emissao??'01/01/2026','Certificadora',row.qualificacao??'NR 10']);if(formula)r.getCell(9).value={formula:'"NR 10"',result:'NR 10'};if(numericMask)r.getCell(3).numFmt='0000'}
  return new File([await w.xlsx.writeBuffer()],'certificados.xlsx');
}

test('Modelo XLSX válido, leitura por cabeçalho e dados originais preservados',async()=>{
  const f=fixture(),{certificadoWorkbook}=f.load('src/lib/integracoes/certificadosDrakeWorkbook.ts');
  const bytes=await certificadoWorkbook([]),w=new ExcelJS.Workbook();await w.xlsx.load(bytes);
  assert.equal(w.worksheets[0].rowCount,1);assert.equal(w.worksheets[0].columnCount,8);
  const result=await f.create({file:await file([{matricula:1}],{title:true,numericMask:true}),usuarioId:1,db:f.db});
  assert.equal(result.importacao.totalPendentes,1);assert.equal(f.rows[0].numeroLinha,4);assert.equal(f.rows[0].matricula,'0001');assert.equal(f.rows[0].dadosOriginais.Validade,'31/12/2027');
  assert.deepEqual(f.rows[0].payload.Payload.DocumentType.Selector,{WellKnownId:'Certificate'});
  for(const key of ['Worker','Qualification','DocumentType','IssueDate','ExpirationDate','ReceiptDate','OnlineTraining'])assert.deepEqual(f.rows[0].payload.Payload[key].SyncStrategy,{OnInsert:'Replace',OnUpdate:'Replace'});
  assert.equal(f.rows[0].payload.Payload.ExternalId.Value,f.rows[0].payload.Selector.ExternalId);
  assert.deepEqual(f.rows[0].payload.Payload.Attachments,{Value:[]});
  for(const key of ['Worker','Qualification','DocumentType'])assert.equal(f.rows[0].payload.Payload[key].OnError,'Fail');
  assert.equal(f.rows[0].payload.Payload.OnlineTraining.Value,false);assert.equal('FitForWork' in f.rows[0].payload.Payload,false);
});

test('Validade vazia ou hifen permanece null no banco e no payload',async()=>{
  const f=fixture();await f.create({file:await file([{validade:'-',qualificacao:'NR 10'},{validade:'  -  ',qualificacao:'NR 20'},{validade:'',qualificacao:'NR 30'}]),usuarioId:1,db:f.db});
  assert.equal(f.rows.length,3);
  for(const row of f.rows){assert.equal(row.status,'PENDENTE_ENVIO');assert.equal(row.validade,null);assert.equal(row.payload.Payload.ExpirationDate.Value,null);}
  assert.equal(f.rows[0].dadosOriginais.Validade,'-');
});

test('Estratégias explícitas preservam dados, identidade, modalidade e o payload anterior',()=>{
  const {explicitCertificatePayload}=loader()('src/lib/integracoes/certificadosDrakePayload.ts');
  const original={Header:{OnInsert:'Execute',OnUpdate:'Execute'},Selector:{Worker:{Registration:'0001'}},Payload:{Worker:{Selector:{Registration:'0001'}},Qualification:{Selector:{Name:'NR 10'}},DocumentType:{Selector:{WellKnownId:'Certificate'}},IssueDate:{Value:'2026-01-01'},ExpirationDate:{Value:'2027-01-01'},ReceiptDate:{Value:null},OnlineTraining:{Value:false}}};
  const before=structuredClone(original),result=explicitCertificatePayload(original,'crew:certificado:teste');
  assert.deepEqual(original,before);assert.deepEqual(result.Header,original.Header);assert.deepEqual(result.Selector,{...original.Selector,ExternalId:'crew:certificado:teste'});assert.equal(result.Payload.ExternalId.Value,result.Selector.ExternalId);assert.deepEqual(result.Payload.Attachments,{Value:[]});assert.equal(result.Payload.OnlineTraining.Value,false);assert.equal('FitForWork' in result.Payload,false);assert.equal('Summary' in result.Payload,false);
  for(const [key,value] of Object.entries(original.Payload)){const actual={...result.Payload[key]};delete actual.SyncStrategy;delete actual.OnError;assert.deepEqual(actual,value)}
  assert.deepEqual(explicitCertificatePayload(result),result);
  const withAttachment=structuredClone(result);withAttachment.Payload.Attachments={Value:[{Id:'existente'}]};assert.deepEqual(explicitCertificatePayload(withAttachment).Payload.Attachments,withAttachment.Payload.Attachments);
});

test('Datas impossíveis, fórmulas e duplicidades ficam bloqueadas por linha',async()=>{
  const f=fixture();await f.create({file:await file([{validade:'31/02/2027'},{emissao:'29/02/2023',qualificacao:'NR 20'},{recebimento:'2026-02-30',qualificacao:'NR 30'}]),usuarioId:1,db:f.db});
  assert.equal(f.rows.filter(r=>r.status==='ERRO_VALIDACAO').length,3);assert.equal(f.rows[0].dadosOriginais.Validade,'31/02/2027');
  const duplicate=fixture();await duplicate.create({file:await file([{},{}]),usuarioId:1,db:duplicate.db});assert.ok(duplicate.rows.every(r=>r.status==='DUPLICADO_NO_ARQUIVO'));
  const formulas=fixture();await formulas.create({file:await file([{}],{formula:true}),usuarioId:1,db:formulas.db});assert.match(formulas.rows[0].motivoErro,/fórmulas/);
  const unsafe=fixture();await unsafe.create({file:await file([{matricula:9007199254740992}]),usuarioId:1,db:unsafe.db});assert.match(unsafe.rows[0].motivoErro,/inteiro seguro/);
});

test('Estrutura ambígua, arquivo inválido, modelo vazio e ambiente incorreto são recusados',async()=>{
  const f=fixture();await assert.rejects(f.create({file:await file([{}],{duplicateHeader:true}),usuarioId:1,db:f.db}),/repetidos/);
  await assert.rejects(f.create({file:new File(['inválido'],'arquivo.xlsx'),usuarioId:1,db:f.db}),/XLSX inválido/);
  const {certificadoWorkbook}=f.load('src/lib/integracoes/certificadosDrakeWorkbook.ts');await assert.rejects(f.create({file:new File([await certificadoWorkbook([])],'modelo.xlsx'),usuarioId:1,db:f.db}),/não contém certificados/);
  await assert.rejects(f.create({file:await file([{}]),usuarioId:1,ambiente:'prd',db:f.db}),/outro ambiente/);
});

test('Relatório inclui resumo, autor, pendências e aba de correção reutilizável',async()=>{
  const f=fixture();await f.create({file:await file([{validade:'31/02/2027'}]),usuarioId:1,db:f.db});
  const {certificadoWorkbook}=f.load('src/lib/integracoes/certificadosDrakeWorkbook.ts');
  const bytes=await certificadoWorkbook(f.rows.map(r=>({...r,tentativasEnvio:[{usuarioNome:'Operador teste',usuarioId:1,iniciadoEm:new Date(),httpStatus:400}]})),{lote:1,ambiente:'hmg'});
  const w=new ExcelJS.Workbook();await w.xlsx.load(bytes);assert.equal(w.getWorksheet('Corrigir e importar').getCell('G2').value,'31/02/2027');
  assert.ok(w.getWorksheet('Resultado').getRow(2).values.includes('Operador teste'));
  const again=fixture();await again.create({file:new File([bytes],'pendencias.xlsx'),usuarioId:1,db:again.db});assert.equal(again.rows[0].status,'ERRO_VALIDACAO');
});

test('Timeout de certificados é limitado sem alterar a configuração de outras integrações',()=>{
  const env=process.env.DRAKE_ENVIRONMENT,previous=process.env.DRAKE_CERTIFICADOS_TIMEOUT_MS;
  const config={baseUrl:'https://hmg.drake.bz',enabled:true,syncDocumentPath:'/api/v2/Integration/Sync/SyncDocument',timeoutMs:3000000};
  const load=loader({'@/lib/prisma':{prisma:{}},'src/lib/integracoes/drakeClient.ts':{assertDrakeConfigReady:()=>config}});
  try{process.env.DRAKE_ENVIRONMENT='hmg';delete process.env.DRAKE_CERTIFICADOS_TIMEOUT_MS;const {assertCertificadoHmg}=load('src/lib/integracoes/certificadosDrakeSend.ts');assert.equal(assertCertificadoHmg('hmg').timeoutMs,60000);assert.equal(config.timeoutMs,3000000);process.env.DRAKE_CERTIFICADOS_TIMEOUT_MS='45000';assert.equal(assertCertificadoHmg('hmg').timeoutMs,45000);process.env.DRAKE_CERTIFICADOS_TIMEOUT_MS='70000';assert.throws(()=>assertCertificadoHmg('hmg'),/DRAKE_CERTIFICADOS_TIMEOUT_MS/)}
  finally{if(env===undefined)delete process.env.DRAKE_ENVIRONMENT;else process.env.DRAKE_ENVIRONMENT=env;if(previous===undefined)delete process.env.DRAKE_CERTIFICADOS_TIMEOUT_MS;else process.env.DRAKE_CERTIFICADOS_TIMEOUT_MS=previous;}
});

test('Progresso trata fragmentos e exige resultado final; downloads recusam JSON/HTML',async()=>{
  const {readCertificadoProgress,readCertificadoDownload}=loader()('src/lib/integracoes/certificadosDrakeShared.ts');
  const encoder=new TextEncoder(),bytes=encoder.encode(JSON.stringify({tipo:'progresso',progresso:{processados:1,total:2}})+'\n'+JSON.stringify({tipo:'concluido',resultado:{ok:'não duplicar'}})+'\n');
  const stream=new ReadableStream({start(c){for(let i=0;i<bytes.length;i+=3)c.enqueue(bytes.slice(i,i+3));c.close()}}),events=[];
  const result=await readCertificadoProgress(new Response(stream,{headers:{'content-type':'application/x-ndjson'}}),p=>events.push(p));assert.equal(events.length,1);assert.equal(result.ok,'não duplicar');
  await assert.rejects(readCertificadoProgress(new Response('{"tipo":"heartbeat"}\n',{headers:{'content-type':'application/x-ndjson'}}),()=>{}),/interrompida/);
  await assert.rejects(readCertificadoDownload(Response.json({error:'Login'},{status:401})),/Sessão expirada/);
  await assert.rejects(readCertificadoDownload(new Response('<html>Erro</html>')),/não retornou um XLSX/);
});
