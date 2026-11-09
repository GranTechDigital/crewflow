import { certificateEnvironment, assertCertificateEnvironment } from "./certificadosDrakeEnvironment";
import { certificadoHistoryDecision } from "./certificadosDrakeEligibility";
import { assertNoDestructiveOperation } from "./certificadosDrakeOperations";
import { createHash } from "crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import { read, utils } from "xlsx";
import { prisma } from "@/lib/prisma";
import { lockCertificadoEnvironment, resumirImportacaoCertificadosDrake } from "./certificadosDrakeDb";
export { resumirImportacaoCertificadosDrake } from "./certificadosDrakeDb";
import { CERTIFICADO_COLUNAS, CERTIFICADO_MAX_ROWS, CertificadoError } from "./certificadosDrakeShared";
import { validateCertificadoArchive } from "./certificadosDrakeWorkbook";
import { isUnspecifiedValidity, LinhaPlanilha, normalizeText, rawText, normalizeMatricula, parseDate, buildChaveIdempotencia, buildPayloadDrake, validarLinha } from "./certificadosDrakeValidation";
export { normalizeText, rawText, normalizeMatricula, parseDate, buildChaveIdempotencia, buildPayloadDrake, validarLinha } from "./certificadosDrakeValidation";
import { reconciliarDesfechos } from "./certificadosDrakeOutcome";
import { assertCertificadoVersionEditable, linkCertificadoVersion, certificadoVersionInfo } from "./certificadosDrakeVersions";
import { checkReferenceBatch, saveReferenceChecks } from "./certificadosDrakeReference";



export const CERTIFICADO_IMPORT_STATUS = {
  SUBSTITUIDO: "SUBSTITUIDO",
  ANALISANDO: "ANALISANDO",
  AGUARDANDO_CONFIRMACAO: "AGUARDANDO_CONFIRMACAO",
  ENVIANDO: "ENVIANDO",
  PROCESSANDO_DRAKE: "PROCESSANDO_DRAKE",
  CONCLUIDO: "CONCLUIDO",
  CONCLUIDO_COM_ERROS: "CONCLUIDO_COM_ERROS",
  FALHOU: "FALHOU",
} as const;

export const CERTIFICADO_ITEM_STATUS = {
  PENDENTE_ENVIO: "PENDENTE_ENVIO",
  ENVIADO: "ENVIADO",
  CONFIRMADO: "CONFIRMADO",
  ERRO_DRAKE: "ERRO_DRAKE",
  NAO_CONFIRMADO: "NAO_CONFIRMADO",
  ERRO_VALIDACAO: "ERRO_VALIDACAO",
  DUPLICADO_NO_ARQUIVO: "DUPLICADO_NO_ARQUIVO",
  DUPLICADO_JA_PROCESSADO: "DUPLICADO_JA_PROCESSADO",
  CONFLITO_ATUALIZACAO: "CONFLITO_ATUALIZACAO",
  POSSIVEL_DUPLICIDADE: "POSSIVEL_DUPLICIDADE",
  REFERENCIA_INDISPONIVEL: "REFERENCIA_INDISPONIVEL",
} as const;

const ABA_CERTIFICADOS = "Certificados";
const COLUNAS_OBRIGATORIAS = CERTIFICADO_COLUNAS;

type ColunaCertificado = (typeof COLUNAS_OBRIGATORIAS)[number];

type CriarImportacaoOptions = {
  file: File;
  usuarioId: number;
  ambiente?: string;
  substituiImportacaoId?: number;
  usuarioNome?: string;
  descricao?: string;
  db?: PrismaClient;
};


function mapHeaders(headerRow: unknown[]) {
  const headers = new Map<string, number>();
  headerRow.forEach((cell, index) => {
    const normalized = normalizeText(cell);
    if (normalized) headers.set(normalized, index);
  });
  return headers;
}

function getCell(row: unknown[], headers: Map<string, number>, coluna: ColunaCertificado) {
  const index = headers.get(normalizeText(coluna));
  return index == null ? undefined : row[index];
}

export async function criarImportacaoCertificadosDrake({
  file,
  usuarioId,
  ambiente = certificateEnvironment(),
  substituiImportacaoId, usuarioNome, descricao,
  db = prisma,
}: CriarImportacaoOptions) {
  assertCertificateEnvironment(ambiente);
  ambiente = certificateEnvironment();
  if (substituiImportacaoId !== undefined) {
    if (!Number.isSafeInteger(substituiImportacaoId) || substituiImportacaoId <= 0) throw new CertificadoError("Carregamento anterior inválido.");
    await assertCertificadoVersionEditable(db, substituiImportacaoId);
    if(!(await certificadoVersionInfo(db,substituiImportacaoId)).comentario?.texto.trim())throw new CertificadoError("Defina e salve a descrição do carregamento antes de subir uma atualização.");
  }
  if (substituiImportacaoId === undefined && (typeof descricao !== "string" || !descricao.trim() || descricao.trim().length > 200)) throw new CertificadoError("Informe a descrição do novo carregamento (até 200 caracteres).");
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  validateCertificadoArchive(buffer);
  const hashArquivo = createHash("sha256").update(buffer).digest("hex");

  const importacaoExistente = await db.importacaoCertificadoDrake.findUnique({
    where: { ambiente_hashArquivo: { ambiente, hashArquivo } },
    select: { id: true, status: true, nomeArquivo: true, createdAt: true },
  });
  if (importacaoExistente) {
    if (substituiImportacaoId !== undefined) {
      const linked = await db.$queryRaw<{novaId:number}[]>`SELECT "novaId" FROM "DrakeCertificadoVersao" WHERE "anteriorId"=${substituiImportacaoId} AND "novaId"=${importacaoExistente.id}`;
      if (!linked.length) throw new CertificadoError("Este arquivo já pertence a outro carregamento ou é idêntico ao anterior. Use uma planilha corrigida diferente.",409);
    }
    return {
      importacao: importacaoExistente,
      jaExistia: true,
    };
  }

  let workbook: ReturnType<typeof read>;
  try { workbook = read(buffer, { type: "buffer", cellDates: true, cellNF: true }); }
  catch { throw new CertificadoError("Não foi possível ler o XLSX. Confira se o arquivo está íntegro."); }
  const candidates: { name: string; row: number; end: number; headers: Map<string, number>; duplicated: boolean }[] = [];
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    if (!sheet["!ref"]) continue;
    const range = utils.decode_range(sheet["!ref"]!);
    for (let row = range.s.r; row <= Math.min(range.e.r, 19); row++) {
      const header = Array.from({ length: Math.min(range.e.c + 1, 256) }, (_, column) => sheet[utils.encode_cell({ r: row, c: column })]?.v);
      const headers = mapHeaders(header);
      if (COLUNAS_OBRIGATORIAS.every(key => headers.has(normalizeText(key)))) candidates.push({ name, row, end: range.e.r, headers,
        duplicated: COLUNAS_OBRIGATORIAS.some(key => header.filter(cell => normalizeText(cell) === normalizeText(key)).length > 1) });
    }
  }
  const preferred = candidates.filter(candidate => candidate.name === ABA_CERTIFICADOS);
  const correction = candidates.filter(candidate => candidate.name === "Corrigir e importar");
  const matches = preferred.length ? preferred : correction.length ? correction : candidates;
  if (matches.length !== 1) throw new CertificadoError(matches.length ? "Mais de uma aba ou cabeçalho de certificados. Mantenha uma única aba para análise." : `Cabeçalhos não encontrados nas primeiras 20 linhas. Use: ${COLUNAS_OBRIGATORIAS.join(", ")}.`);
  const selected = matches[0], headers = selected.headers, worksheet = workbook.Sheets[selected.name];
  if (selected.duplicated) throw new CertificadoError("Há cabeçalhos obrigatórios repetidos. Corrija antes de importar.");
  if (selected.end - selected.row > CERTIFICADO_MAX_ROWS) throw new CertificadoError(`Limite de ${CERTIFICADO_MAX_ROWS} linhas por importação.`);

  const parsedRows: LinhaPlanilha[] = [];
  const chavesNoArquivo = new Set<string>();
  const matriculas = new Set<string>();

  for (let rowIndex = selected.row + 1; rowIndex <= selected.end; rowIndex += 1) {
    const row: unknown[] = [], dadosOriginais: Record<string, string> = {};
    let invalidCell = false, invalidMatricula = false;
    for (const key of COLUNAS_OBRIGATORIAS) {
      const column = headers.get(normalizeText(key))!;
      const cell = worksheet[utils.encode_cell({ r: rowIndex, c: column })];
      const value = cell?.v instanceof Date ? cell.v : key === "Matricula" && typeof cell?.v === "number" && /^0+$/.test(cell.z ?? "") ? String(cell.v).padStart(cell.z!.length, "0") : cell?.v;
      row[column] = value;
      dadosOriginais[key] = value instanceof Date ? Number.isNaN(value.getTime()) ? "Data inválida" : value.toISOString().slice(0, 10) : rawText(value);
      if (cell?.f || cell?.t === "e") invalidCell = true;
      if (key === "Matricula" && typeof cell?.v === "number" && (!Number.isSafeInteger(cell.v) || cell.v < 0)) invalidMatricula = true;
    }
    if (COLUNAS_OBRIGATORIAS.every(key => !rawText(getCell(row, headers, key)))) continue;

    const matricula = normalizeMatricula(getCell(row, headers, "Matricula"));
    const nome = rawText(getCell(row, headers, "Nome")) || null;
    const certificadora = rawText(getCell(row, headers, "Certificadora")) || null;
    const qualificacao = rawText(getCell(row, headers, "Qualificacao"));
    const tipoDocumento = rawText(getCell(row, headers, "Tipo Documento"));
    const emissao = parseDate(getCell(row, headers, "Emissao"));
    const validade = parseDate(getCell(row, headers, "Validade"));
    const recebimento = parseDate(getCell(row, headers, "Recebimento"));
    const qualificacaoNormalizada = normalizeText(qualificacao);
    const tipoDocumentoNormalizado = normalizeText(tipoDocumento);
    const chaveIdempotencia = buildChaveIdempotencia({
      matricula,
      qualificacaoNormalizada,
      tipoDocumentoNormalizado,
      emissao,
    });

    const base = {
      numeroLinha: rowIndex + 1,
      matricula,
      nome,
      certificadora,
      qualificacao,
      tipoDocumento,
      emissao,
      validade,
      recebimento,
      qualificacaoNormalizada,
      tipoDocumentoNormalizado,
      chaveIdempotencia,
      dadosOriginais,
    };
    const erros = validarLinha(base);
    if (invalidCell) erros.push("Use valores preenchidos, sem fórmulas ou erros nas colunas obrigatórias");
    if (!isUnspecifiedValidity(getCell(row, headers, "Validade")) && !validade) erros.push("Validade inválida");
    if (invalidMatricula) erros.push("Matrícula numérica inválida. Use texto ou um inteiro seguro.");
    if (rawText(getCell(row, headers, "Recebimento")) && !recebimento) erros.push("Recebimento inválido");

    let status: string = CERTIFICADO_ITEM_STATUS.PENDENTE_ENVIO;
    let motivoErro: string | null = null;
    if (erros.length > 0) {
      status = CERTIFICADO_ITEM_STATUS.ERRO_VALIDACAO;
      motivoErro = erros.join("; ");
    } else if (chavesNoArquivo.has(chaveIdempotencia)) {
      status = CERTIFICADO_ITEM_STATUS.DUPLICADO_NO_ARQUIVO;
      motivoErro = "Certificado duplicado dentro da planilha";
    }

    chavesNoArquivo.add(chaveIdempotencia);
    if (matricula) matriculas.add(matricula);

    parsedRows.push({
      ...base,
      status,
      motivoErro,
    });
  }

  if (!parsedRows.length) throw new CertificadoError("A planilha não contém certificados.");
  const repeated = new Map<string, number>();
  for (const row of parsedRows) repeated.set(row.chaveIdempotencia, (repeated.get(row.chaveIdempotencia) ?? 0) + 1);
  for (const row of parsedRows) if (repeated.get(row.chaveIdempotencia)! > 1 && row.status !== CERTIFICADO_ITEM_STATUS.ERRO_VALIDACAO) {
    row.status = CERTIFICADO_ITEM_STATUS.DUPLICADO_NO_ARQUIVO; row.motivoErro = "Certificado repetido na planilha. Nenhuma das linhas repetidas será enviada.";
  }

  const funcionarios: { id: number; matricula: string }[] = [];
  const matriculasList = Array.from(matriculas);
  for (let index = 0; index < matriculasList.length; index += 1000) funcionarios.push(...await db.funcionario.findMany({ where: { matricula: { in: matriculasList.slice(index, index + 1000) } }, select: { id: true, matricula: true } }));
  const funcionarioPorMatricula = new Map(
    funcionarios.map((funcionario) => [funcionario.matricula, funcionario.id]),
  );

  const chavesValidas = parsedRows
    .filter((linha) => linha.status === CERTIFICADO_ITEM_STATUS.PENDENTE_ENVIO)
    .map((linha) => linha.chaveIdempotencia);
  const itensAnteriores: { chaveIdempotencia: string; status: string; validade: Date | null; recebimento: Date | null }[] = [];
  for (let index = 0; index < chavesValidas.length; index += 1000) itensAnteriores.push(...await db.importacaoCertificadoDrakeItem.findMany({
          where: {
            chaveIdempotencia: { in: chavesValidas.slice(index, index + 1000) }, importacao: { ambiente },
            status: { in: ["ENVIANDO", "ENVIADO", "CONFIRMADO", "NAO_CONFIRMADO"] },
          },
          select: {
            chaveIdempotencia: true,
            status: true,
            validade: true,
            recebimento: true,
          },
        }));
  const anterioresPorChave = new Map<string, typeof itensAnteriores>();
  for (const item of itensAnteriores) {
    const current = anterioresPorChave.get(item.chaveIdempotencia) ?? [];
    current.push(item);
    anterioresPorChave.set(item.chaveIdempotencia, current);
  }

  for (const linha of parsedRows) {
    if (linha.status !== CERTIFICADO_ITEM_STATUS.PENDENTE_ENVIO) continue;

    if (!funcionarioPorMatricula.has(linha.matricula)) {
      linha.status = CERTIFICADO_ITEM_STATUS.ERRO_VALIDACAO;
      linha.motivoErro = "Funcionário não encontrado na base do Crew";
      continue;
    }

    const history=certificadoHistoryDecision(anterioresPorChave.get(linha.chaveIdempotencia)??[],linha);
    if(history){linha.status=history.status;linha.motivoErro=history.motivo;}

  }

  const referenceChecks = await checkReferenceBatch(db, ambiente, parsedRows.filter(row => row.status === CERTIFICADO_ITEM_STATUS.PENDENTE_ENVIO).map(row => ({ ...row, key: String(row.numeroLinha) })));
  for (const row of parsedRows) {
    const check = referenceChecks.get(String(row.numeroLinha));
    if (check && check.status !== "NOVO") { row.status = check.status; row.motivoErro = check.motivo; }
  }

  let importacao;
  try { importacao = await db.$transaction(async (tx) => {
    if (substituiImportacaoId !== undefined) {
      await lockCertificadoEnvironment(tx,ambiente);
      await assertCertificadoVersionEditable(tx,substituiImportacaoId);
    }
    const criada = await tx.importacaoCertificadoDrake.create({
      data: {
        usuarioId,
        nomeArquivo: file.name,
        hashArquivo,
        tamanhoArquivoBytes: buffer.length,
        ambiente: ambiente,
        status: CERTIFICADO_IMPORT_STATUS.ANALISANDO,
      },
    });

    for (let index = 0; index < parsedRows.length; index += 500) {
      await tx.importacaoCertificadoDrakeItem.createMany({
        data: parsedRows.slice(index, index + 500).map((linha) => ({
          importacaoId: criada.id,
          funcionarioId: funcionarioPorMatricula.get(linha.matricula) ?? null,
          numeroLinha: linha.numeroLinha,
          matricula: linha.matricula,
          nome: linha.nome,
          certificadora: linha.certificadora,
          qualificacao: linha.qualificacao,
          qualificacaoNormalizada: linha.qualificacaoNormalizada,
          tipoDocumento: linha.tipoDocumento,
          tipoDocumentoNormalizado: linha.tipoDocumentoNormalizado,
          emissao: linha.emissao,
          validade: linha.validade,
          recebimento: linha.recebimento,
          chaveIdempotencia: linha.chaveIdempotencia,
          status: linha.status,
          motivoErro: linha.motivoErro,
          dadosOriginais: linha.dadosOriginais,
          payload:
            linha.status === CERTIFICADO_ITEM_STATUS.PENDENTE_ENVIO
              ? buildPayloadDrake(linha)
              : Prisma.JsonNull,
        })),
      });
    }

    if (substituiImportacaoId === undefined) await tx.$executeRaw`INSERT INTO "DrakeCertificadoCarregamentoNota" ("raizId",texto,"usuarioId","usuarioNome") VALUES (${criada.id},${descricao!.trim()},${usuarioId},${usuarioNome || `Usuário #${usuarioId}`})`;
    if (substituiImportacaoId !== undefined) await linkCertificadoVersion(tx,substituiImportacaoId,criada.id,usuarioId,usuarioNome || `Usuário #${usuarioId}`);
    await saveReferenceChecks(tx, criada.id, referenceChecks);
    return resumirImportacaoCertificadosDrake(tx, criada.id);
  }, { timeout: 30000 }); }
  catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await db.importacaoCertificadoDrake.findUnique({ where: { ambiente_hashArquivo: { ambiente, hashArquivo } } });
      if (existing && substituiImportacaoId === undefined) return { importacao: existing, jaExistia: true };
      if (substituiImportacaoId !== undefined) throw new CertificadoError("Este carregamento já recebeu uma versão corrigida. Atualize a página.",409);
    }
    throw error;
  }

  return {
    importacao,
    jaExistia: false,
  };
}

export { enviarCertificadosPendentesDrake, recuperarEnvioCertificados } from "./certificadosDrakeSend";

export async function reanalisarReferenciaCertificados(importacaoId: number, db: PrismaClient = prisma) {
  return db.$transaction(async tx => {
    const batch = await tx.importacaoCertificadoDrake.findUnique({ where: { id: importacaoId } });
    if (!batch || batch.ambiente !== certificateEnvironment()) throw new CertificadoError("Importação HMG não encontrada.", 404);
    await lockCertificadoEnvironment(tx, batch.ambiente);
    const current = await tx.importacaoCertificadoDrake.findUniqueOrThrow({ where: { id: importacaoId } });
    if (current.status === "SUBSTITUIDO") throw new CertificadoError("Use a versão atual deste carregamento.",409);
    if (current.envioToken) throw new CertificadoError("Aguarde o envio em andamento antes de conferir a referência.", 409);
    await assertNoDestructiveOperation(tx,importacaoId);
    await reconciliarDesfechos(tx,{importacaoId,ambiente:batch.ambiente,usuarioId:0,usuarioNome:"Conferência automática do Crew"});
    const items = await tx.importacaoCertificadoDrakeItem.findMany({ where: { importacaoId, status: { in: ["PENDENTE_ENVIO", "POSSIVEL_DUPLICIDADE", "REFERENCIA_INDISPONIVEL"] } } });
    const checks = await checkReferenceBatch(tx, batch.ambiente, items.map(item => ({ ...item, key: String(item.id) })), true);
    await saveReferenceChecks(tx, importacaoId, checks, "id");
    const previous = await tx.importacaoCertificadoDrakeItem.findMany({ where: { importacao: { ambiente: batch.ambiente }, importacaoId: { not: importacaoId }, chaveIdempotencia: { in: items.map(item => item.chaveIdempotencia) }, status: { in: ["ENVIANDO", "ENVIADO", "CONFIRMADO", "NAO_CONFIRMADO"] } }, select: { chaveIdempotencia: true, status: true, validade: true, recebimento: true } });
    const historyByKey = new Map<string, typeof previous>();
    for (const row of previous) { const group = historyByKey.get(row.chaveIdempotencia) ?? []; group.push(row); historyByKey.set(row.chaveIdempotencia, group); }
    const updates = items.map(item => {
      const check = checks.get(String(item.id))!;
      let status: string = check.status === "NOVO" ? "PENDENTE_ENVIO" : check.status, motivo = check.motivo;
      const decision=certificadoHistoryDecision(historyByKey.get(item.chaveIdempotencia)??[],item);
      if(decision){status=decision.status;motivo=decision.motivo;}
      return { id: item.id, status, motivo, payload: status === "PENDENTE_ENVIO" ? buildPayloadDrake({ ...item, dadosOriginais: {} }) : item.payload };
    });
    for (let start = 0; start < updates.length; start += 500) {
      await tx.$executeRaw(Prisma.sql`UPDATE "ImportacaoCertificadoDrakeItem" i SET status=x->>'status',"motivoErro"=x->>'motivo',payload=x->'payload',"updatedAt"=CURRENT_TIMESTAMP
        FROM jsonb_array_elements(${JSON.stringify(updates.slice(start, start + 500))}::jsonb) x WHERE i.id=(x->>'id')::int AND i."importacaoId"=${importacaoId}`);
    }
    return { importacao: await resumirImportacaoCertificadosDrake(tx, importacaoId), analisados: items.length };
  }, { timeout: 30000 });
}
