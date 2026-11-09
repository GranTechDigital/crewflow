import ExcelJS from "exceljs";
import { CERTIFICADO_COLUNAS, CERTIFICADO_MAX_BYTES, CertificadoError } from "./certificadosDrakeShared";

export function validateCertificadoArchive(buffer: Buffer) {
  if (buffer.length > CERTIFICADO_MAX_BYTES) throw new CertificadoError("O arquivo deve ter no máximo 5 MB.", 413);
  let end = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50 && i + 22 + buffer.readUInt16LE(i + 20) === buffer.length) { end = i; break; }
  }
  if (end < 0) throw new CertificadoError("Arquivo XLSX inválido.");
  const count = buffer.readUInt16LE(end + 10); let pos = buffer.readUInt32LE(end + 16), expanded = 0;
  if (buffer.readUInt16LE(end + 4) || buffer.readUInt16LE(end + 6) || count > 2000 || pos >= end) throw new CertificadoError("XLSX não suportado.");
  for (let i = 0; i < count; i++) {
    if (pos + 46 > end || buffer.readUInt32LE(pos) !== 0x02014b50) throw new CertificadoError("Arquivo XLSX inválido.");
    const size = buffer.readUInt32LE(pos + 24); expanded += size;
    if (size === 0xffffffff || expanded > 40 * 1024 * 1024 || buffer.readUInt16LE(pos + 8) & 1) throw new CertificadoError("Planilha muito grande ou protegida por senha.");
    pos += 46 + buffer.readUInt16LE(pos + 28) + buffer.readUInt16LE(pos + 30) + buffer.readUInt16LE(pos + 32);
  }
  if (pos !== end) throw new CertificadoError("Arquivo XLSX inválido.");
}

type ReportRow = {
  numeroLinha: number; matricula: string; nome: string | null; certificadora: string | null; qualificacao: string; tipoDocumento: string;
  emissao: Date | null; validade: Date | null; recebimento: Date | null; status: string; motivoErro: string | null;
  dadosOriginais?: unknown; tentativasEnvio?: { usuarioNome: string | null; usuarioId: number | null; iniciadoEm: Date; httpStatus: number | null }[];
};
const date = (value: Date | null) => value?.toISOString().slice(0, 10) ?? "";
export async function certificadoWorkbook(rows: ReportRow[] = [], resumo?: Record<string, string | number | null>) {
  const workbook = new ExcelJS.Workbook();
  if (resumo) {
    const summary = workbook.addWorksheet("Resumo"); summary.addRows([["Campo", "Valor"], ...Object.entries(resumo)]);
    const report = workbook.addWorksheet("Resultado");
    report.addRow(["Linha original", ...CERTIFICADO_COLUNAS, "Situação", "Motivo", "Enviado por", "Última tentativa", "HTTP"]);
    for (const row of rows) {
      const attempt = row.tentativasEnvio?.[0];
      report.addRow([row.numeroLinha, row.matricula, row.nome, row.certificadora, row.qualificacao, row.tipoDocumento, date(row.emissao), date(row.validade), date(row.recebimento), row.status, row.motivoErro, attempt?.usuarioNome ?? (attempt?.usuarioId ? `Usuário #${attempt.usuarioId}` : ""), attempt?.iniciadoEm.toISOString() ?? "", attempt?.httpStatus ?? ""]);
    }
  }
  const correction = workbook.addWorksheet(resumo ? "Corrigir e importar" : "Certificados");
  correction.addRow([...CERTIFICADO_COLUNAS]);
  for (const row of rows.filter(row => ["ERRO_VALIDACAO", "DUPLICADO_NO_ARQUIVO", "CONFLITO_ATUALIZACAO", "POSSIVEL_DUPLICIDADE", "REFERENCIA_INDISPONIVEL"].includes(row.status))) {
    const original = row.dadosOriginais as Record<string, unknown> | null;
    const values = [row.matricula, row.nome, row.certificadora, row.qualificacao, row.tipoDocumento, date(row.emissao), date(row.validade), date(row.recebimento)];
    correction.addRow(CERTIFICADO_COLUNAS.map((key, index) => String(original?.[key] ?? values[index] ?? "")));
  }
  for (const sheet of workbook.worksheets) {
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF23364D" } };
    sheet.columns.forEach((column, index) => { column.width = index === 1 ? 32 : 24; column.numFmt = "@"; });
    sheet.autoFilter = { from: "A1", to: { row: Math.max(sheet.rowCount, 1), column: sheet.columnCount } };
  }
  return workbook.xlsx.writeBuffer();
}
