import { assertNoDestructiveOperation } from "./certificadosDrakeOperations";
import { randomUUID } from "crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { lockCertificadoEnvironment } from "./certificadosDrakeDb";
import { referenceCandidatesPage, referenceSource } from "./certificadosDrakeReference";
import { assertCertificadoHmg } from "./certificadosDrakeSend";
import { DrakeClientError, syncDocument } from "./drakeClient";
import { CertificadoError } from "./certificadosDrakeShared";
import { explicitCertificatePayload } from "./certificadosDrakePayload";

export type DeleteCertificateInput = { importacaoId: number; itemId: number; documentoId: string; confirmar: boolean; versaoReferencia: number; justificativa?: string; usuarioId: number; usuarioNome: string; db?: PrismaClient };
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
export function certificateDeletePayload(id: string) {
  if (!uuid.test(id)) throw new CertificadoError("ID do documento inválido.");
  return { Header: { Deleted: true, OnInsert: "Ignore", OnUpdate: "Ignore", OnDelete: "Execute" }, Selector: { Id: id.toLowerCase() }, Payload: {} };
}

export async function deleteCertificateById(input: DeleteCertificateInput) {
  const { db = prisma } = input;
  if (![input.importacaoId,input.itemId].every(id => Number.isSafeInteger(id) && id > 0) || typeof input.documentoId !== "string" || !uuid.test(input.documentoId)) throw new CertificadoError("Importação, item ou documento inválido.");
  const documentoId = input.documentoId.toLowerCase();
  if (input.confirmar !== true) throw new CertificadoError("Confirme a exclusão após conferir os detalhes do documento.");
  const reason = (typeof input.justificativa === "string" ? input.justificativa.trim() : "") || "Exclusão confirmada na conferência de possível duplicidade.";
  if (reason.length > 1000 || !Number.isSafeInteger(input.versaoReferencia) || input.versaoReferencia < 1) throw new CertificadoError("Informe a versão da referência; a justificativa deve ter até 1.000 caracteres.");
  const batch = await db.importacaoCertificadoDrake.findUnique({ where: { id: input.importacaoId } });
  if (!batch) throw new CertificadoError("Importação não encontrada.",404);
  const config = assertCertificadoHmg(batch.ambiente);
  const payload = certificateDeletePayload(documentoId), id = randomUUID();
  await db.$transaction(async tx => {
    await lockCertificadoEnvironment(tx,batch.ambiente);
    const current = await tx.importacaoCertificadoDrake.findUniqueOrThrow({ where: { id: batch.id } });
    if (current.status === "SUBSTITUIDO") throw new CertificadoError("Use a versão atual deste carregamento.",409);
    if (current.envioToken) throw new CertificadoError("Aguarde o envio em andamento antes de solicitar exclusão.",409);
    await assertNoDestructiveOperation(tx,batch.id);
    const item = await tx.importacaoCertificadoDrakeItem.findFirst({ where: { id: input.itemId,importacaoId: batch.id } });
    if (!item || item.status !== "POSSIVEL_DUPLICIDADE") throw new CertificadoError("A exclusão exige um item bloqueado como possível duplicidade.",409);
    const { source,reason: unavailable } = await referenceSource(tx,batch.ambiente,true);
    if (!source || unavailable) throw new CertificadoError(unavailable || "Referência indisponível.",409);
    if (source.versao !== input.versaoReferencia) throw new CertificadoError("A referência mudou. Atualize os documentos e confira novamente.",409);
    const page = await referenceCandidatesPage(tx,batch.ambiente,{ ...item,key:String(item.id) },1,1,documentoId);
    if (page.total !== 1) throw new CertificadoError("O documento não corresponde a este funcionário, qualificação, tipo e emissão.",409);
    const prior = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "DrakeDocumentoExclusao" WHERE "origemId"=${source.id}::uuid AND "documentoId"=${documentoId}::uuid AND status IN ('EM_EXECUCAO','EXCLUSAO_ACEITA','NAO_CONFIRMADO') LIMIT 1`;
    if (prior.length) throw new CertificadoError("Já há uma exclusão em andamento, aceita ou não confirmada para este ID. Confira o Drake; não repita a solicitação.",409);
    const [reference] = await tx.$queryRaw<{ dados: Prisma.JsonValue; hashDados: string }[]>`SELECT dados,"hashDados" FROM "DrakeDocumentoReferencia" WHERE "origemId"=${source.id}::uuid AND "documentoId"=${documentoId}::uuid`;
    await tx.$executeRaw`INSERT INTO "DrakeDocumentoExclusao" (id,"origemId","documentoId","itemId","usuarioId","usuarioNome",justificativa,"versaoReferencia",referencia,payload,status)
      VALUES (${id}::uuid,${source.id}::uuid,${documentoId}::uuid,${item.id},${input.usuarioId},${input.usuarioNome},${reason},${source.versao},${JSON.stringify(reference)}::jsonb,${JSON.stringify(payload)}::jsonb,'EM_EXECUCAO')`;
  });

  let response: Awaited<ReturnType<typeof syncDocument>> | undefined, failure: unknown;
  try { response = await syncDocument(payload,config); } catch(error) { failure = error; }
  const data = response?.data as { type?: unknown; Type?: unknown } | undefined;
  const providerType = String(data?.type ?? data?.Type ?? "");
  const rejected = !response && failure instanceof DrakeClientError && Boolean(failure.status) && failure.status! >= 400 && failure.status! < 500 && failure.status !== 408;
  const status = response?.status === 200 && providerType.toLowerCase() === "deleted" ? "EXCLUSAO_ACEITA" : rejected ? "ERRO_DRAKE" : "NAO_CONFIRMADO";
  // Até Ignored exige conferência: não afirmar exclusão sem resposta explícita Deleted.
  const error = failure instanceof DrakeClientError ? [failure.message,failure.responseText].filter(Boolean).join(" | ").slice(0,4000)
    : failure instanceof Error ? failure.message.slice(0,1000) : status === "NAO_CONFIRMADO" ? "Resultado sem confirmação explícita de exclusão. Confira o Drake antes de qualquer nova tentativa." : null;
  try {
    const changed = await db.$executeRaw`UPDATE "DrakeDocumentoExclusao" SET status=${status},"httpStatus"=${response?.status ?? (failure instanceof DrakeClientError ? failure.status ?? null : null)},resposta=${JSON.stringify(response?.data ?? response?.text ?? null)}::jsonb,erro=${error},"finalizadoEm"=CURRENT_TIMESTAMP WHERE id=${id}::uuid AND status='EM_EXECUCAO'`;
    if (changed !== 1) throw new Error("A reserva de auditoria mudou.");
  } catch {
    // EM_EXECUCAO e índice único permanecem, impedindo reenvio após perda de auditoria.
    throw new CertificadoError("Não foi possível registrar o retorno. A exclusão pode ter ocorrido; confira o Drake e não repita a solicitação.",503);
  }
  return { id,documentoId,status,httpStatus:response?.status ?? (failure instanceof DrakeClientError ? failure.status : null),tipoRetorno:providerType || null,erro:error,
    mensagem:status === "EXCLUSAO_ACEITA" ? "Drake respondeu HTTP 200 com Deleted. Comando de exclusão aceito tecnicamente; isso não garante a execução bem-sucedida da ordem. Confira no Drake. A referência e o bloqueio permanecem até reconciliação." : status === "ERRO_DRAKE" ? "Drake rejeitou a solicitação. Consulte o erro antes de uma nova tentativa manual." : response?.status === 200 ? `Drake respondeu HTTP 200 com ${providerType || "retorno não reconhecido"}. Isso não garante a execução bem-sucedida da ordem. Exclusão não confirmada; confira no Drake e não repita automaticamente.` : "Resultado não confirmado. A ordem pode ter sido recebida sem retorno ao Crew; confira o Drake e não reenvie automaticamente." };
}

export async function latestDeletionStatuses(db: PrismaClient, ambiente: string, ids: string[]) {
  if (!ids.length) return [];
  const { source } = await referenceSource(db,ambiente);
  if (!source) return [];
  return db.$queryRaw<{ documentoId: string; id: string; status: string; usuarioNome: string; justificativa: string; httpStatus: number | null; erro: string | null; iniciadoEm: Date; restauravel: boolean; restauracao: {status:string;usuarioNome:string;iniciadoEm:string;erro:string|null} | null }[]>(Prisma.sql`SELECT DISTINCT ON (d."documentoId") d."documentoId",d.id,d.status,d."usuarioNome",d.justificativa,d."httpStatus",d.erro,d."iniciadoEm",(jsonb_typeof(d.referencia->'dados'->'online')='boolean' AND d.referencia->'dados'->>'typeNormalized' IN ('CERTIFICADO','CERTIFICATE','CERTIFICADO / CERTIFICATE')) AS restauravel,(SELECT jsonb_build_object('status',r.status,'usuarioNome',r."usuarioNome",'iniciadoEm',r."iniciadoEm",'erro',r.erro) FROM "DrakeDocumentoRestauracao" r WHERE r."exclusaoId"=d.id ORDER BY r."iniciadoEm" DESC,r.id DESC LIMIT 1) AS restauracao FROM "DrakeDocumentoExclusao" d WHERE d."origemId"=${source.id}::uuid AND d."documentoId" IN (${Prisma.join(ids.map(id=>Prisma.sql`${id}::uuid`))}) ORDER BY d."documentoId",d."iniciadoEm" DESC,d.id DESC`);
}

type RestoreSnapshot = { documentId: string; registration: string; qualification: string; typeNormalized: string; emission: string; expiration: string | null; online: boolean | null };
export function certificateRestorePayload(exclusaoId: string, data: RestoreSnapshot) {
  if (!data || !uuid.test(exclusaoId) || !["CERTIFICADO","CERTIFICATE","CERTIFICADO / CERTIFICATE"].includes(data.typeNormalized) || !data.registration || !data.qualification || !/^\d{4}-\d{2}-\d{2}$/.test(data.emission) || typeof data.online !== "boolean") throw new CertificadoError("A cópia não tem os campos mínimos para recriar este certificado com segurança. Faça a recuperação no Drake.",409);
  const externalId = `crew:certificado:restauracao:${exclusaoId}`;
  return explicitCertificatePayload({ Header:{OnInsert:"Execute",OnUpdate:"Ignore",OnDelete:"Ignore"},Selector:{ExternalId:externalId},Payload:{
    Worker:{Selector:{Registration:data.registration}},Qualification:{Selector:{Name:data.qualification}},DocumentType:{Selector:{WellKnownId:"Certificate"}},IssueDate:{Value:data.emission},
    ExpirationDate:{Value:data.expiration||null},OnlineTraining:{Value:data.online},
  }});
}

export async function restoreCertificateDeletion(input: {importacaoId:number;itemId:number;exclusaoId:string;confirmar:boolean;usuarioId:number;usuarioNome:string;db?:PrismaClient}) {
  const {db=prisma}=input;
  if (![input.importacaoId,input.itemId].every(id=>Number.isSafeInteger(id)&&id>0)||!uuid.test(input.exclusaoId||"")||input.confirmar!==true) throw new CertificadoError("Confirme a recriação do cadastro após conferir os detalhes.");
  const batch=await db.importacaoCertificadoDrake.findUnique({where:{id:input.importacaoId}});if(!batch)throw new CertificadoError("Importação não encontrada.",404);
  const config=assertCertificadoHmg(batch.ambiente),id=randomUUID();
  const payload=await db.$transaction(async tx=>{
    await lockCertificadoEnvironment(tx,batch.ambiente);
    const current=await tx.importacaoCertificadoDrake.findUniqueOrThrow({where:{id:batch.id}});if(current.status==="SUBSTITUIDO")throw new CertificadoError("Use a versão atual deste carregamento.",409);if(current.envioToken)throw new CertificadoError("Aguarde o envio em andamento.",409);
    await assertNoDestructiveOperation(tx,batch.id);
    const item=await tx.importacaoCertificadoDrakeItem.findFirst({where:{id:input.itemId,importacaoId:batch.id}});if(!item)throw new CertificadoError("Item não encontrado.",404);
    const {source,reason}=await referenceSource(tx,batch.ambiente,true);if(!source||reason)throw new CertificadoError(reason||"Referência indisponível.",409);
    const [deletion]=await tx.$queryRaw<{status:string;referencia:{dados:RestoreSnapshot}}[]>`SELECT status,referencia FROM "DrakeDocumentoExclusao" WHERE id=${input.exclusaoId}::uuid AND "origemId"=${source.id}::uuid AND "itemId"=${item.id}`;
    if(!deletion||deletion.status!=="EXCLUSAO_ACEITA")throw new CertificadoError("Só é possível desfazer uma exclusão que recebeu Deleted. Confira os resultados não confirmados no Drake.",409);
    const active=await tx.$queryRaw<{id:string}[]>`SELECT id FROM "DrakeDocumentoRestauracao" WHERE "exclusaoId"=${input.exclusaoId}::uuid AND status IN ('EM_EXECUCAO','RECRIACAO_ACEITA','NAO_CONFIRMADO') LIMIT 1`;
    if(active.length)throw new CertificadoError("Há recriação em andamento, aceita ou não confirmada. Confira o Drake antes de repetir.",409);
    const body=certificateRestorePayload(input.exclusaoId,deletion.referencia.dados);
    await tx.$executeRaw`INSERT INTO "DrakeDocumentoRestauracao" (id,"exclusaoId","usuarioId","usuarioNome",payload,status) VALUES (${id}::uuid,${input.exclusaoId}::uuid,${input.usuarioId},${input.usuarioNome},${JSON.stringify(body)}::jsonb,'EM_EXECUCAO')`;
    return body;
  });
  let response:Awaited<ReturnType<typeof syncDocument>>|undefined,failure:unknown;
  try{response=await syncDocument(payload,config);}catch(error){failure=error;}
  const data=response?.data as {type?:unknown;Type?:unknown}|undefined,providerType=String(data?.type??data?.Type??"");
  const rejected=!response&&failure instanceof DrakeClientError&&Boolean(failure.status)&&failure.status!>=400&&failure.status!<500&&failure.status!==408;
  const status=response?.status===200&&providerType.toLowerCase()==="inserted"?"RECRIACAO_ACEITA":rejected?"ERRO_DRAKE":"NAO_CONFIRMADO";
  const error=failure instanceof DrakeClientError?[failure.message,failure.responseText].filter(Boolean).join(" | ").slice(0,4000):failure instanceof Error?failure.message.slice(0,1000):status==="NAO_CONFIRMADO"?"Recriação sem confirmação explícita. Confira o Drake antes de repetir.":null;
  try{const changed=await db.$executeRaw`UPDATE "DrakeDocumentoRestauracao" SET status=${status},"httpStatus"=${response?.status??(failure instanceof DrakeClientError?failure.status??null:null)},resposta=${JSON.stringify(response?.data??response?.text??null)}::jsonb,erro=${error},"finalizadoEm"=CURRENT_TIMESTAMP WHERE id=${id}::uuid AND status='EM_EXECUCAO'`;if(changed!==1)throw new Error("A reserva de auditoria mudou.");}
  catch{throw new CertificadoError("Não foi possível registrar o retorno. A recriação pode ter ocorrido; não repita sem conferir o Drake.",503);}
  return {id,status,httpStatus:response?.status??(failure instanceof DrakeClientError?failure.status:null),tipoRetorno:providerType||null,erro:error,mensagem:status==="RECRIACAO_ACEITA"?"Drake respondeu HTTP 200 com Inserted. Comando de recriação aceito tecnicamente; confira a execução no Drake. O ID original e os anexos não são recuperados. Aguarde a reconciliação da referência.":status==="ERRO_DRAKE"?"Drake rejeitou a recriação. Confira o erro antes de nova solicitação manual.":"Recriação não confirmada. Confira o Drake antes de repetir."};
}
