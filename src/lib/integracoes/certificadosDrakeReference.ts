import { certificateEnvironment } from "./certificadosDrakeEnvironment";
import { Prisma } from "@prisma/client";
import { CertificadoDb } from "./certificadosDrakeDb";

export type ReferenceInput = { key: string; matricula: string; tipoDocumentoNormalizado: string; qualificacaoNormalizada: string; emissao: Date | null };
export type ReferenceCandidate = { id: string; qualificacao: string; tipo: string; emissao: string; validade: string | null };
export type ReferenceCheck = { status: "NOVO" | "POSSIVEL_DUPLICIDADE" | "REFERENCIA_INDISPONIVEL"; motivo: string | null; origemId: string | null; versao: number | null; conferidoEm: string; totalCandidatos: number; candidatos: ReferenceCandidate[] };
type Source = { id: string; status: string; versao: number; atualizadoEm: Date | null };
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toUpperCase();
const typeKey = (value: string) => {
  const text = normalize(value);
  if (["CERTIFICADO", "CERTIFICATE", "CERTIFICADO / CERTIFICATE"].includes(text)) return "CERTIFICADO";
  if (["ASO", "OCCUPATIONALHEALTH", "ASO / OCCUPATIONAL HEALTH"].includes(text)) return "ASO";
  return text;
};

export async function referenceSource(db: CertificadoDb, ambiente: string, lock = false): Promise<{ source: Source | null; reason: string | null }> {
  const tenant = process.env.DRAKE_TENANT_ID;
  if (ambiente !== certificateEnvironment() || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(tenant || "")) return { source: null, reason: "Referência indisponível: ambiente ou origem não configurados para este ambiente." };
  const hours = Number(process.env.DRAKE_REFERENCE_MAX_AGE_HOURS ?? 48);
  if (!Number.isFinite(hours) || hours < 1 || hours > 168) return { source: null, reason: "Referência indisponível: configure a validade da base entre 1 e 168 horas." };
  const rows = await db.$queryRaw<Source[]>(Prisma.sql`SELECT id,status,versao,"atualizadoEm" FROM "DrakeDocumentoOrigem" WHERE ambiente=${ambiente} AND "tenantId"=${tenant}::uuid ${lock ? Prisma.sql`FOR SHARE` : Prisma.empty}`);
  const source = rows[0] ?? null;
  if (!source || source.status !== "PRONTA" || source.versao < 1 || !source.atualizadoEm) return { source, reason: "Referência indisponível: a carga inicial ainda não foi concluída." };
  const age = Date.now() - source.atualizadoEm.getTime();
  if (age > hours * 3600000 || age < -300000) return { source, reason: `Referência desatualizada: última carga em ${source.atualizadoEm.toISOString()}. Atualize a base antes de enviar.` };
  return { source, reason: null };
}

export async function checkReferenceBatch(db: CertificadoDb, ambiente: string, inputs: ReferenceInput[], lock = false): Promise<Map<string, ReferenceCheck>> {
  const result = new Map<string, ReferenceCheck>();
  if (!inputs.length) return result;
  const { source, reason } = await referenceSource(db, ambiente, lock);
  const checked = new Date().toISOString();
  for (const input of inputs) result.set(input.key, { status: reason ? "REFERENCIA_INDISPONIVEL" : "NOVO", motivo: reason, origemId: source?.id ?? null, versao: source?.versao ?? null, conferidoEm: checked, totalCandidatos: 0, candidatos: [] });
  if (reason || !source) return result;
  for (let start = 0; start < inputs.length; start += 500) {
    const requested = inputs.slice(start, start + 500).map(row => ({ key: row.key, registration: normalize(row.matricula), qualification: normalize(row.qualificacaoNormalizada), type: typeKey(row.tipoDocumentoNormalizado), emission: row.emissao?.toISOString().slice(0, 10) ?? null }));
    const rows = await db.$queryRaw<{ key: string; documentoId: string; dados: { qualification: string; type: string; emission: string; expiration: string | null }; total: number }[]>(Prisma.sql`
      WITH requested AS (SELECT * FROM jsonb_to_recordset(${JSON.stringify(requested)}::jsonb) AS x(key text,registration text,qualification text,type text,emission date)),
      matches AS (SELECT x.key,r."documentoId",r.dados,COUNT(*) OVER (PARTITION BY x.key)::int AS total,
        ROW_NUMBER() OVER (PARTITION BY x.key ORDER BY r."documentoId") AS rn
        FROM requested x JOIN "DrakeDocumentoReferencia" r ON r."origemId"=${source.id}::uuid AND r.matricula=x.registration
          AND r."qualificacaoNormalizada"=x.qualification AND r.emissao=x.emission
          AND (CASE WHEN r."tipoNormalizado" IN ('CERTIFICADO','CERTIFICATE','CERTIFICADO / CERTIFICATE') THEN 'CERTIFICADO'
                    WHEN r."tipoNormalizado" IN ('ASO','OCCUPATIONALHEALTH','ASO / OCCUPATIONAL HEALTH') THEN 'ASO' ELSE r."tipoNormalizado" END)=x.type)
      SELECT key,"documentoId",dados,total FROM matches WHERE rn<=5`);
    for (const row of rows) {
      const check = result.get(row.key)!;
      check.status = "POSSIVEL_DUPLICIDADE"; check.totalCandidatos = row.total;
      check.motivo = `${row.total} documento(s) existente(s) no Drake com mesma matrícula, tipo, qualificação e emissão. Envio bloqueado; confira individualmente.`;
      check.candidatos.push({ id: row.documentoId, qualificacao: row.dados.qualification, tipo: row.dados.type, emissao: row.dados.emission, validade: row.dados.expiration });
    }
  }
  return result;
}

export async function saveReferenceChecks(db: CertificadoDb, importacaoId: number, checks: Map<string, ReferenceCheck>, key: "numeroLinha" | "id" = "numeroLinha") {
  if (!checks.size) return;
  const rows = Array.from(checks, ([id, value]) => ({ itemKey: Number(id), ...value }));
  for (let start = 0; start < rows.length; start += 500) {
    await db.$executeRaw(Prisma.sql`INSERT INTO "DrakeDocumentoConferencia" ("itemId","origemId",versao,status,motivo,"totalCandidatos",candidatos,"conferidoEm")
      SELECT i.id,(x->>'origemId')::uuid,(x->>'versao')::int,x->>'status',x->>'motivo',(x->>'totalCandidatos')::int,x->'candidatos',(x->>'conferidoEm')::timestamptz
      FROM jsonb_array_elements(${JSON.stringify(rows.slice(start, start + 500))}::jsonb) x
      JOIN "ImportacaoCertificadoDrakeItem" i ON i."importacaoId"=${importacaoId} AND ${key === "id" ? Prisma.sql`i.id` : Prisma.sql`i."numeroLinha"`}=(x->>'itemKey')::int
      ON CONFLICT ("itemId") DO UPDATE SET "origemId"=EXCLUDED."origemId",versao=EXCLUDED.versao,status=EXCLUDED.status,motivo=EXCLUDED.motivo,"totalCandidatos"=EXCLUDED."totalCandidatos",candidatos=EXCLUDED.candidatos,"conferidoEm"=EXCLUDED."conferidoEm"`);
  }
}

export async function referenceCandidatesPage(db: CertificadoDb, ambiente: string, input: ReferenceInput, page: number, limit: number, documentoId?: string) {
  const { source, reason } = await referenceSource(db, ambiente);
  if (!source) return { candidatos: [], total: 0, page, totalPages: 0, versao: null, motivo: reason };
  const condition = Prisma.sql`r."origemId"=${source.id}::uuid AND r.matricula=${normalize(input.matricula)} AND r."qualificacaoNormalizada"=${normalize(input.qualificacaoNormalizada)} AND r.emissao=${input.emissao?.toISOString().slice(0,10) ?? null}::date
    AND (CASE WHEN r."tipoNormalizado" IN ('CERTIFICADO','CERTIFICATE','CERTIFICADO / CERTIFICATE') THEN 'CERTIFICADO' WHEN r."tipoNormalizado" IN ('ASO','OCCUPATIONALHEALTH','ASO / OCCUPATIONAL HEALTH') THEN 'ASO' ELSE r."tipoNormalizado" END)=${typeKey(input.tipoDocumentoNormalizado)} ${documentoId ? Prisma.sql`AND r."documentoId"=${documentoId}::uuid` : Prisma.empty}`;
  const [count] = await db.$queryRaw<{ total: number }[]>(Prisma.sql`SELECT COUNT(*)::int AS total FROM "DrakeDocumentoReferencia" r WHERE ${condition}`);
  const rows = await db.$queryRaw<{ id: string; dados: { qualification: string; type: string; emission: string; expiration: string | null } }[]>(Prisma.sql`SELECT "documentoId" AS id,dados FROM "DrakeDocumentoReferencia" r WHERE ${condition} ORDER BY "documentoId" LIMIT ${limit} OFFSET ${(page-1)*limit}`);
  return { candidatos: rows.map(row => ({ id: row.id, qualificacao: row.dados.qualification, tipo: row.dados.type, emissao: row.dados.emission, validade: row.dados.expiration })), total: count.total, page, totalPages: Math.ceil(count.total/limit), versao: source.versao, motivo: reason };
}
