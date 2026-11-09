import { Prisma } from "@prisma/client";
import { SSF } from "xlsx";
import { explicitCertificatePayload } from "./certificadosDrakePayload";
export type LinhaPlanilha = {
  numeroLinha: number;
  matricula: string;
  nome: string | null;
  certificadora: string | null;
  qualificacao: string;
  tipoDocumento: string;
  emissao: Date | null;
  validade: Date | null;
  recebimento: Date | null;
  qualificacaoNormalizada: string;
  tipoDocumentoNormalizado: string;
  chaveIdempotencia: string;
  status: string;
  motivoErro: string | null;
  dadosOriginais: Prisma.InputJsonObject;
};

export function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

export function rawText(value: unknown) {
  const text = String(value ?? "").trim().replace(/\s+/g, " ");
  return text.length > 0 ? text : "";
}

export function normalizeMatricula(value: unknown) {
  return rawText(value).toUpperCase();
}

function toUtcDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  return year >= 1900 && year <= 9999 && date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null;
}

export function parseDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return toUtcDate(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = SSF.parse_date_code(value);
    if (parsed?.y && parsed?.m && parsed?.d) {
      return toUtcDate(parsed.y, parsed.m, parsed.d);
    }
  }

  const text = rawText(value);
  if (!text) return null;

  const br = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  if (br) {
    const day = Number(br[1]);
    const month = Number(br[2]);
    let year = Number(br[3]);
    if (year < 100) year += 2000;
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return toUtcDate(year, month, day);
    }
  }

  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    return toUtcDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }

  return null;
}

function dateKey(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : "SEM_EMISSAO";
}

export function optionalDateKey(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : "";
}

export function isUnspecifiedValidity(value: unknown) {
  return ["", "-"].includes(rawText(value));
}

export function buildChaveIdempotencia(params: {
  matricula: string;
  qualificacaoNormalizada: string;
  tipoDocumentoNormalizado: string;
  emissao: Date | null;
}) {
  return [
    params.matricula,
    params.qualificacaoNormalizada,
    params.tipoDocumentoNormalizado,
    dateKey(params.emissao),
  ].join("|");
}

export function buildPayloadDrake(linha: LinhaPlanilha): Prisma.InputJsonObject {
  return explicitCertificatePayload({
    Header: {
      OnInsert: "Execute",
      OnUpdate: "Execute",
    },
    Selector: {
      ExternalId: `crew:certificado:${linha.chaveIdempotencia}`,
      Worker: { Registration: linha.matricula },
      Qualification: { Name: linha.qualificacao },
      DocumentType: documentTypeSelector(linha.tipoDocumentoNormalizado),
      IssueDate: dateKey(linha.emissao),
    },
    Payload: {
      Worker: { Selector: { Registration: linha.matricula } },
      Qualification: { Selector: { Name: linha.qualificacao } },
      DocumentType: { Selector: documentTypeSelector(linha.tipoDocumentoNormalizado) },
      OnlineTraining: { Value: false },
      IssueDate: { Value: dateKey(linha.emissao) },
      ExpirationDate: { Value: optionalDateKey(linha.validade) || null },
      ReceiptDate: { Value: optionalDateKey(linha.recebimento) || null },
    },
  });
}

function documentTypeSelector(tipoDocumentoNormalizado: string): Prisma.InputJsonObject {
  if (tipoDocumentoNormalizado === "CERTIFICADO") {
    return { WellKnownId: "Certificate" };
  }
  return { Name: tipoDocumentoNormalizado };
}

export function validarLinha(linha: Omit<LinhaPlanilha, "status" | "motivoErro">) {
  const erros: string[] = [];

  if (!linha.matricula) erros.push("Matrícula obrigatória");
  if (!linha.qualificacao) erros.push("Qualificação obrigatória");
  if (!linha.tipoDocumento) erros.push("Tipo de documento obrigatório");
  if (linha.matricula.length > 100) erros.push("Matrícula deve ter até 100 caracteres");
  if (linha.qualificacao.length > 500 || linha.tipoDocumento.length > 200) erros.push("Qualificação ou tipo de documento muito longo");
  if (!linha.emissao) erros.push("Emissão obrigatória ou inválida");
  if (linha.emissao && linha.validade && linha.validade < linha.emissao) {
    erros.push("Validade menor que emissão");
  }
  if (linha.emissao && linha.recebimento && linha.recebimento < linha.emissao) {
    erros.push("Recebimento menor que emissão");
  }

  return erros;
}

