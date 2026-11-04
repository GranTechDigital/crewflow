const { test } = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const { loader } = require('./loader.cjs');
const load = loader();
const { findSispatDuplicates } = load('src/lib/sispat/review.ts');
const { exportSispatIssues, parseSispatWorkbook } = load('src/lib/sispat/workbook.ts');

test('Duplicidades dentro da planilha agrupam matrículas diferentes, sem copiar o grupo em cada linha', () => {
 const rows=Array.from({length:1000},(_,i)=>({linha:i+2,matricula:String(i),recebido:'00123',status:'PENDENTE',motivo:''}));
 const groups=findSispatDuplicates(rows,[]);assert.equal(groups.length,1);assert.equal(groups[0].participantes.length,1000);
 assert.equal(findSispatDuplicates([rows[0],{...rows[0],linha:3}],[]).length,0);
});
test('Relatório preserva texto literal, zeros e formato da aba de correção para reimportar', async()=>{
 const rows=[{linha:2,matricula:'00001',recebido:'0000023',status:'NAO_ENCONTRADO',motivo:'Matrícula ausente'},{linha:3,matricula:'=COMANDO()',recebido:'001',status:'NAO_ENCONTRADO',motivo:'Revisar'}];
 const buffer=Buffer.from(await exportSispatIssues(rows,[]));const wb=new ExcelJS.Workbook();await wb.xlsx.load(buffer);
 assert.deepEqual(wb.worksheets.map(s=>s.name),['Pendências','Corrigir e importar','Duplicidades']);assert.equal(wb.getWorksheet('Corrigir e importar').getCell('A3').type,ExcelJS.ValueType.String);
 const parsed=await parseSispatWorkbook(buffer);assert.equal(parsed.aba,'Corrigir e importar');assert.equal(parsed.linhas[0].matricula,'00001');assert.equal(parsed.linhas[0].sispat,'0000023');
});
