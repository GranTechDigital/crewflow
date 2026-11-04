const { test } = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const { loader } = require('./loader.cjs');
const load = loader({ '@/lib/prisma': { prisma: {} } });
const { canManageSispat } = load('src/lib/sispat/shared.ts');
const { parseSispatWorkbook, exportSispatWorkbook } = load('src/lib/sispat/workbook.ts');
const { applySispatChanges } = load('src/lib/sispat/service.ts');
async function xlsx(rows, other = false) {
  const wb = new ExcelJS.Workbook();
  if (other) wb.addWorksheet('Completa').addRows([['Nome', 'Matrícula', 'CPF', 'SISPAT'], ['Nome', 'A', '123', '1']]);
  wb.addWorksheet('Planilha1').addRows([['Matrícula', 'SISPAT'], ...rows]);
  return Buffer.from(await wb.xlsx.writeBuffer());
}
const cadastro = { id: 1, nome: 'Funcionário teste', matricula: 'FRI-01-0001', sispat: '123', atualizadoEm: new Date('2026-11-04T10:00:00Z') };
const linha = { linha: 2, matricula: cadastro.matricula, sispat: '456' };

test('Administração e Logística Editor/Gestor acessam; Visualizador e outros setores não', () => {
  for (const team of ['Administração', 'Logística', 'Logística (Editor)', 'Logística (Gestor)', ' logistica (gestor) ']) assert.equal(canManageSispat(team), true, team);
  for (const team of ['Logística (Visualizador)', 'Administração (Visualizador)', 'Liderança (Visualizador)', 'RH', 'Logística externa', 'LogísticaMaliciosa', null]) assert.equal(canManageSispat(team), false, team);
});
test('Escolhe a aba de duas colunas em arquivo com duas abas e preserva zeros', async () => {
  const parsed = await parseSispatWorkbook(await xlsx([['0000123', '000456'], ['A', 'Sem SISPAT'], ['B', '']], true));
  assert.equal(parsed.aba, 'Planilha1'); assert.equal(parsed.total, 3); assert.equal(parsed.ignorados, 2);
  assert.deepEqual(parsed.linhas, [{ linha: 2, matricula: '0000123', sispat: '000456' }]);
});
test('Exportação e importação usam exatamente o mesmo formato, sem fórmulas', async () => {
  const rows = [{ matricula: '0001', sispat: '00001234' }, { matricula: '=COMANDO()', sispat: '123' }, { matricula: 'A', sispat: null }];
  const bytes = Buffer.from(await exportSispatWorkbook(rows));
  const parsed = await parseSispatWorkbook(bytes);
  assert.deepEqual(parsed.linhas.map(r => [r.matricula, r.sispat]), rows.slice(0,2).map(r => [r.matricula,r.sispat]));
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(bytes);
  assert.equal(wb.worksheets[0].getCell('A3').type, ExcelJS.ValueType.String);
});
test('Rejeita duplicidade, fórmula, valor inválido e ZIP inválido', async () => {
  for (const rows of [[['A','1'],['A','2']], [['A',{ formula: '1+1', result: 2 }]], [['A','abc']], [['','123']]]) await assert.rejects(parseSispatWorkbook(await xlsx(rows)));
  await assert.rejects(parseSispatWorkbook(Buffer.from('não é xlsx')));
});
test('Rejeita múltiplas abas candidatas em vez de adivinhar', async () => {
  const wb = new ExcelJS.Workbook(); for (const name of ['Uma','Outra']) wb.addWorksheet(name).addRows([['Matricula','SISPAT'],['A','1']]);
  await assert.rejects(parseSispatWorkbook(Buffer.from(await wb.xlsx.writeBuffer())), /única aba/);
});
test('Prioriza o modelo e encontra cabeçalhos fora de ordem com colunas extras e título', async () => {
  assert.equal((await parseSispatWorkbook(await xlsx([['0001','123']],true))).aba,'Planilha1');
  const wb=new ExcelJS.Workbook();wb.addWorksheet('Completa').addRows([['Relatório'],[],['Nome',' SISPAT ','CPF',' MATRICULA '],['Pessoa','000123',{formula:'1+1'},'0001'],['Sem identificadores']]);
  const parsed=await parseSispatWorkbook(Buffer.from(await wb.xlsx.writeBuffer()));
  assert.equal(parsed.total,1);assert.deepEqual(parsed.linhas,[{linha:4,matricula:'0001',sispat:'000123'}]);
});

test('Rejeita cabeçalhos repetidos e múltiplas abas completas sem modelo preferencial', async () => {
  const wb=new ExcelJS.Workbook();wb.addWorksheet('Repetida').addRows([['Nome','Matrícula','SISPAT','SISPAT'],['Pessoa','A','1','2']]);
  await assert.rejects(parseSispatWorkbook(Buffer.from(await wb.xlsx.writeBuffer())),/repetidos/);
  wb.removeWorksheet('Repetida');for(const name of ['Uma','Outra'])wb.addWorksheet(name).addRows([['Nome','SISPAT','Matrícula'],['Pessoa','1','A']]);
  await assert.rejects(parseSispatWorkbook(Buffer.from(await wb.xlsx.writeBuffer())),/ambiguidades/);
});

test('Download aceita o XLSX real e recusa erros JSON, HTML e conteúdo inválido', async () => {
  const {readSispatWorkbookDownload}=load('src/lib/sispat/download.ts');
  const type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const blob=await readSispatWorkbookDownload(new Response(await exportSispatWorkbook([]),{headers:{'content-type':type}}));
  const wb=new ExcelJS.Workbook();await wb.xlsx.load(Buffer.from(await blob.arrayBuffer()));assert.deepEqual(wb.worksheets[0].getRow(1).values.slice(1),['Matrícula','SISPAT']);assert.equal(wb.worksheets[0].rowCount,1);
  await assert.rejects(readSispatWorkbookDownload(Response.json({error:'Sem sessão'},{status:401})),/Sessão expirada/);
  await assert.rejects(readSispatWorkbookDownload(Response.json({error:'Acesso negado'},{status:403})),/Acesso negado/);
  await assert.rejects(readSispatWorkbookDownload(new Response('<html>Login</html>',{headers:{'content-type':'text/html'}})),/não retornou/);
  await assert.rejects(readSispatWorkbookDownload(new Response('erro',{headers:{'content-type':type}})),/não é um XLSX válido/);
});

test('Atualização em lotes usa parâmetros e recusa conflito em qualquer lote', async () => {
  const changes = Array.from({length:301}, (_,i)=>({...cadastro,id:i+1,atualizadoEm:cadastro.atualizadoEm.toISOString(),novoSispat:'456'}));
  let calls=0;
  await assert.rejects(applySispatChanges({ $queryRaw: async sql => { calls++; assert.match(sql.sql,/IS NOT DISTINCT FROM/); assert.equal(sql.values[2],'456'); return calls===1 ? Array.from({length:300},(_,i)=>({id:i+1})) : []; } },changes), /Nenhuma alteração/);
  assert.equal(calls,2);
});
