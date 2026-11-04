import ExcelJS from 'exceljs';
import { SispatLinha, SispatRegistro } from './shared';

export class SispatError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_ROWS = 20000;
const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

// Inspecionar o diretório ZIP antes de descompactar evita arquivos XLSX desproporcionais.
export function validateXlsxArchive(buffer: Buffer) {
  if (buffer.length > MAX_FILE_BYTES) throw new SispatError('O arquivo deve ter no máximo 5 MB.');
  let end = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50 && i + 22 + buffer.readUInt16LE(i + 20) === buffer.length) { end = i; break; }
  }
  if (end < 0) throw new SispatError('Arquivo XLSX inválido.');
  const count = buffer.readUInt16LE(end + 10);
  let pos = buffer.readUInt32LE(end + 16);
  if (buffer.readUInt16LE(end + 4) || buffer.readUInt16LE(end + 6) || count > 2000 || pos >= end) throw new SispatError('Arquivo XLSX não suportado.');
  let expanded = 0;
  for (let i = 0; i < count; i++) {
    if (pos + 46 > end || buffer.readUInt32LE(pos) !== 0x02014b50) throw new SispatError('Arquivo XLSX inválido.');
    const size = buffer.readUInt32LE(pos + 24);
    expanded += size;
    if (size === 0xffffffff || expanded > 40 * 1024 * 1024 || (buffer.readUInt16LE(pos + 8) & 1)) throw new SispatError('Planilha muito grande ou protegida por senha.');
    pos += 46 + buffer.readUInt16LE(pos + 28) + buffer.readUInt16LE(pos + 30) + buffer.readUInt16LE(pos + 32);
  }
  if (pos !== end) throw new SispatError('Arquivo XLSX inválido.');
}

function identifier(cell: ExcelJS.Cell, linha: number): string {
  const value = cell.value;
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) {
    // Identificadores numéricos com máscara 000... conservam os zeros à esquerda.
    if (/^0+$/.test(cell.numFmt)) return String(value).padStart(cell.numFmt.length, '0');
    return String(value);
  }
  throw new SispatError(`Linha ${linha}: use texto ou número inteiro, sem fórmulas, links ou erros.`);
}

export function validateSispat(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{1,30}$/.test(value.trim())) throw new SispatError('Informe um SISPAT com 1 a 30 dígitos.');
  return value.trim();
}

export async function parseSispatWorkbook(buffer: Buffer, collectErrors = false) {
  validateXlsxArchive(buffer);
  const workbook = new ExcelJS.Workbook();
  try { await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer); }
  catch { throw new SispatError('Não foi possível ler o XLSX. Verifique se o arquivo está íntegro.'); }
  const candidates: { sheet: ExcelJS.Worksheet; headerRow: number; matriculas: number[]; sispats: number[]; preferred: boolean }[] = [];
  for (const sheet of workbook.worksheets) {
    for (let number = 1; number <= Math.min(20, sheet.rowCount); number++) {
      const row = sheet.getRow(number), matriculas: number[] = [], sispats: number[] = [];
      row.eachCell((cell, column) => {
        const name = normalize(cell.text);
        if (name === 'matricula') matriculas.push(column);
        if (name === 'sispat') sispats.push(column);
      });
      if (matriculas.length && sispats.length) candidates.push({ sheet, headerRow: number, matriculas, sispats,
        preferred: number === 1 && row.actualCellCount === 2 && matriculas[0] === 1 && sispats[0] === 2 });
    }
  }
  const preferred = candidates.filter(candidate => candidate.preferred);
  const matches = preferred.length ? preferred : candidates;
  if (matches.length !== 1) throw new SispatError(matches.length ? 'Há mais de uma aba ou linha de cabeçalho com Matrícula e SISPAT. Mantenha uma única aba de importação para evitar ambiguidades.' : 'Não foram encontradas as colunas Matrícula e SISPAT nas primeiras 20 linhas. Confira os nomes dos cabeçalhos.');
  const { sheet, headerRow, matriculas, sispats } = matches[0];
  if (matriculas.length !== 1 || sispats.length !== 1) throw new SispatError('Os cabeçalhos Matrícula e SISPAT não podem estar repetidos na mesma aba.');
  if (sheet.rowCount > MAX_ROWS + headerRow) throw new SispatError(`Limite de ${MAX_ROWS} linhas por importação.`);
  const registros: SispatRegistro[] = [];
  const duplicates = new Map<string, SispatRegistro[]>();
  sheet.eachRow((row, number) => {
    if (number <= headerRow || !row.hasValues) return;
    const item: SispatRegistro = { linha: number, matricula: '', recebido: null, status: 'PENDENTE', motivo: '' };
    try {
      item.matricula = identifier(row.getCell(matriculas[0]), number);
      item.recebido = identifier(row.getCell(sispats[0]), number);
      if (!item.matricula && !item.recebido) return;
      if (!item.matricula || item.matricula.length > 100) throw new SispatError(`Linha ${number}: matrícula vazia ou inválida.`);
      const same = duplicates.get(item.matricula) ?? []; same.push(item); duplicates.set(item.matricula, same);
      if (!item.recebido || normalize(item.recebido) === 'sem sispat') {
        item.status = 'IGNORADO'; item.motivo = 'Sem número de SISPAT na planilha. Cadastro preservado.';
      } else item.recebido = validateSispat(item.recebido);
    } catch (error) {
      item.status = 'ERRO'; item.motivo = error instanceof Error ? error.message : 'Linha inválida.';
      item.matricula = item.matricula.slice(0, 100); item.recebido = item.recebido?.slice(0, 200) ?? null;
    }
    registros.push(item);
  });
  for (const items of duplicates.values()) if (items.length > 1) {
    const lines = items.slice(0, 10).map(i => i.linha).join(', ') + (items.length > 10 ? ` e mais ${items.length - 10}` : '');
    for (const item of items) { item.status = 'ERRO'; item.motivo = `Matrícula ${item.matricula} repetida nas linhas ${lines}.`; }
  }
  const erro = registros.find(r => r.status === 'ERRO');
  if (erro && !collectErrors) throw new SispatError(erro.motivo);
  if (!registros.length) throw new SispatError('A planilha não contém funcionários.');
  const linhas: SispatLinha[] = registros.filter(r => r.status === 'PENDENTE').map(r => ({ linha: r.linha, matricula: r.matricula, sispat: r.recebido! }));
  return { aba: sheet.name, total: registros.length, ignorados: registros.filter(r => r.status === 'IGNORADO').length, linhas, registros };
}

export async function exportSispatWorkbook(rows: { matricula: string; sispat: string | null }[]) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('SISPAT', { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = [{ header: 'Matrícula', key: 'matricula', width: 24 }, { header: 'SISPAT', key: 'sispat', width: 20 }];
  rows.forEach(row => sheet.addRow({ matricula: row.matricula, sispat: row.sispat ?? '' }));
  sheet.getColumn(1).numFmt = '@';
  sheet.getColumn(2).numFmt = '@';
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF23364D' } };
  sheet.autoFilter = { from: 'A1', to: 'B1' };
  return workbook.xlsx.writeBuffer();
}

/** Relatório separado da exportação padrão; a aba de correção mantém o formato de importação. */
export async function exportSispatIssues(rows: import('./shared').SispatRegistro[], alertas: import('./shared').SispatDuplicidade[]) {
  const { SISPAT_SITUACOES } = await import('./shared');
  const workbook = new ExcelJS.Workbook();
  const issues = workbook.addWorksheet('Pendências', { views: [{ state: 'frozen', ySplit: 1 }] });
  issues.columns = [
    { header: 'Linha original', width: 15 }, { header: 'Funcionário', width: 36 }, { header: 'Matrícula', width: 24 },
    { header: 'SISPAT recebido', width: 22 }, { header: 'Situação', width: 32 }, { header: 'Motivo', width: 70 }, { header: 'Duplicidade', width: 18 },
  ];
  issues.addRows(rows.map(row => [row.linha, row.nome ?? '', row.matricula, row.recebido ?? '', SISPAT_SITUACOES[row.status], row.motivo, row.alertaDuplicidade ? 'Conferir envolvidos' : '']));
  const correction = workbook.addWorksheet('Corrigir e importar', { views: [{ state: 'frozen', ySplit: 1 }] });
  correction.columns = [{ header: 'Matrícula', width: 24 }, { header: 'SISPAT', width: 20 }];
  correction.addRows(rows.map(row => [row.matricula, row.recebido ?? '']));
  const duplicates = workbook.addWorksheet('Duplicidades', { views: [{ state: 'frozen', ySplit: 1 }] });
  duplicates.columns = [{ header: 'SISPAT compartilhado', width: 24 }, { header: 'Matrícula', width: 24 }, { header: 'Funcionário', width: 36 }, { header: 'Origem', width: 25 }];
  const origins = { PLANILHA: 'Planilha', CADASTRO: 'Cadastro atual', PLANILHA_E_CADASTRO: 'Planilha e cadastro' };
  for (const group of alertas) duplicates.addRows(group.participantes.map(p => [group.sispat, p.matricula, p.nome ?? '', origins[p.origem]]));
  for (const sheet of workbook.worksheets) {
    for (const column of sheet.columns) column.numFmt = '@';
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF23364D' } };
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, sheet.rowCount), column: sheet.columnCount } };
  }
  issues.getColumn(1).numFmt = '0';
  return workbook.xlsx.writeBuffer();
}
