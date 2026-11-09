import { certificateEnvironment, assertCertificateEnvironment } from "./certificadosDrakeEnvironment";
import { certificadoResponseOutcome } from "./certificadosDrakeResponse";
import { assertNoDestructiveOperation } from "./certificadosDrakeOperations";
import { certificadoHistoryDecision } from "./certificadosDrakeEligibility";
import { reconciliarDesfechos } from "./certificadosDrakeOutcome";
import { randomUUID } from "crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import { assertDrakeConfigReady, DrakeClientError, syncDocument } from "./drakeClient";
import { prisma } from "@/lib/prisma";
import { lockCertificadoEnvironment, resumirImportacaoCertificadosDrake } from "./certificadosDrakeDb";
import { CERTIFICADO_LEASE_MS, CERTIFICADO_MAX_ROWS, CertificadoError, CertificadoProgresso } from "./certificadosDrakeShared";
import { explicitCertificatePayload } from "./certificadosDrakePayload";
import { checkReferenceBatch, saveReferenceChecks } from "./certificadosDrakeReference";

type SendOptions = { importacaoId: number; usuarioId: number; usuarioNome?: string; limit?: number; itemIds?: number[]; todosPendentes?: boolean; totalEsperado?: number; db?: PrismaClient; onProgress?: (value: CertificadoProgresso) => void };
const errorText = (error: unknown) => error instanceof DrakeClientError
  ? [error.message, error.status && `HTTP ${error.status}`, error.responseText].filter(Boolean).join(" | ").slice(0, 4000)
  : error instanceof Error ? error.message.slice(0, 4000) : "Falha ao enviar certificado.";

export function assertCertificadoHmg(ambiente:string){
  if(ambiente!=="hmg")throw new CertificadoError("Exclusão e recriação permanecem restritas ao HMG.",409);
  return assertCertificadoDestination(ambiente);
}
export function assertCertificadoDestination(ambiente:string) {
  assertCertificateEnvironment(ambiente);
  const config = assertDrakeConfigReady();
  if (config.syncDocumentPath !== "/api/v2/Integration/Sync/SyncDocument") throw new CertificadoError("O endpoint de certificados deve ser SyncDocument.", 409);
  let url: URL;
  try { url = new URL(config.baseUrl); } catch { throw new CertificadoError("Destino HMG inválido.", 409); }
  if (url.origin !== (ambiente === "hmg" ? "https://hmg.drake.bz" : "https://drake.bz") || !["", "/"].includes(url.pathname) || url.search || url.hash || url.username || url.password) throw new CertificadoError("Envio bloqueado: o destino não corresponde ao ambiente selecionado.", 409);
  if (!config.enabled) throw new CertificadoError("Envio Drake desabilitado na configuração.", 409);
  const timeoutMs = Number(process.env.DRAKE_CERTIFICADOS_TIMEOUT_MS ?? Math.min(config.timeoutMs, 60000));
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 60000) throw new CertificadoError("Configure DRAKE_CERTIFICADOS_TIMEOUT_MS entre 1 e 60.000 ms.", 409);
  return { ...config, timeoutMs };
}

export async function recuperarEnvioCertificados({ importacaoId, usuarioId, usuarioNome, db = prisma }: Omit<SendOptions, "limit" | "onProgress">) {
  return db.$transaction(async tx => {
    const batch = await tx.importacaoCertificadoDrake.findUnique({ where: { id: importacaoId } });
    if (!batch) throw new CertificadoError("Importação não encontrada.", 404);
    if (batch.ambiente !== certificateEnvironment()) throw new CertificadoError("A recuperação está disponível somente para lotes HMG.", 409);
    await lockCertificadoEnvironment(tx, batch.ambiente);
    const locked = await tx.importacaoCertificadoDrake.findUniqueOrThrow({ where: { id: importacaoId } });
    if (!locked.envioToken) throw new CertificadoError("Não há envio interrompido para recuperar.", 409);
    if (locked.envioHeartbeatEm && Date.now() - locked.envioHeartbeatEm.getTime() < CERTIFICADO_LEASE_MS) throw new CertificadoError("O envio ainda está ativo. Aguarde antes de recuperar.", 409);
    const erro = `Execução interrompida; confira o Drake antes de reenviar. Recuperação por ${usuarioNome || `Usuário #${usuarioId}`}.`;
    const items = await tx.importacaoCertificadoDrakeItem.findMany({ where: { importacaoId, status: "ENVIANDO" }, select: { id: true } });
    await tx.importacaoCertificadoDrakeItem.updateMany({ where: { importacaoId, status: "ENVIANDO" }, data: { status: "NAO_CONFIRMADO", motivoErro: erro } });
    await tx.importacaoCertificadoDrakeTentativa.updateMany({ where: { itemId: { in: items.map(item => item.id) }, status: "ENVIANDO" }, data: { status: "NAO_CONFIRMADO", erro, finalizadoEm: new Date() } });
    await tx.importacaoCertificadoDrake.update({ where: { id: importacaoId }, data: { envioToken: null, envioHeartbeatEm: null, ultimoErro: erro } });
    return resumirImportacaoCertificadosDrake(tx, importacaoId);
  });
}

export async function enviarCertificadosPendentesDrake({ importacaoId, usuarioId, usuarioNome, limit = 5, itemIds, todosPendentes = false, totalEsperado, db = prisma, onProgress }: SendOptions) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) throw new CertificadoError("Informe de 1 a 50 certificados por envio.");
  if (itemIds !== undefined && (!Array.isArray(itemIds) || itemIds.length < 1 || itemIds.length > 50 || itemIds.some(id => !Number.isSafeInteger(id) || id <= 0) || new Set(itemIds).size !== itemIds.length)) throw new CertificadoError("Selecione de 1 a 50 certificados distintos.");
  if (todosPendentes && (itemIds !== undefined || typeof totalEsperado !== "number" || !Number.isSafeInteger(totalEsperado) || totalEsperado < 1 || totalEsperado > CERTIFICADO_MAX_ROWS)) throw new CertificadoError("Confirme a quantidade de certificados aptos do arquivo, sem seleção individual.");
  const batch = await db.importacaoCertificadoDrake.findUnique({ where: { id: importacaoId } });
  if (!batch) throw new CertificadoError("Importação não encontrada.", 404);
  if (batch.status === "SUBSTITUIDO") throw new CertificadoError("Este arquivo foi substituído. Use a versão atual.",409);
  const config = assertCertificadoDestination(batch.ambiente), token = randomUUID();
  const stats: CertificadoProgresso = { fase: "PREPARANDO", processados: 0, total: 0, enviados: 0, falhas: 0, naoConfirmados: 0, ignorados: 0 };
  const report = () => { try { onProgress?.({ ...stats }); } catch { /* A desconexão do navegador não interrompe a auditoria. */ } };
  const items = await db.$transaction(async tx => {
    await lockCertificadoEnvironment(tx, batch.ambiente);
    const current = await tx.importacaoCertificadoDrake.findUniqueOrThrow({ where: { id: importacaoId } });
    if (current.status === "SUBSTITUIDO") throw new CertificadoError("Este arquivo foi substituído. Use a versão atual.",409);
    if (current.envioToken) throw new CertificadoError("Já existe uma execução neste lote. Atualize o resultado; se estiver interrompida, use Recuperar execução.", 409);
    await assertNoDestructiveOperation(tx,importacaoId);
    const pending = await tx.importacaoCertificadoDrakeItem.findMany({ where: { importacaoId, status: "PENDENTE_ENVIO", ...(itemIds ? { id: { in: itemIds } } : {}) }, orderBy: { numeroLinha: "asc" }, take: todosPendentes ? CERTIFICADO_MAX_ROWS + 1 : itemIds?.length ?? limit, select: { id: true } });
    if (todosPendentes && pending.length !== totalEsperado) throw new CertificadoError("A quantidade de certificados aptos mudou. Atualize a análise e confirme novamente.", 409);
    if (itemIds && pending.length !== itemIds.length) throw new CertificadoError("Algum certificado selecionado não está pendente neste lote. Atualize a seleção antes de enviar.", 409);
    if (!pending.length) throw new CertificadoError("O lote não tem certificados pendentes para envio.", 409);
    await tx.importacaoCertificadoDrake.update({ where: { id: importacaoId }, data: { envioToken: token, envioHeartbeatEm: new Date(), status: "ENVIANDO", ultimoErro: null } });
    return pending;
  });
  stats.total = items.length; report();
  let interrompido = false;
  const resultados: { itemId: number; statusNovo: string; erro?: string }[] = [];
  try {
    for (const candidate of items) {
      // O mesmo certificado em outro lote HMG também é reservado sob esta trava curta.
      const reserved = await db.$transaction(async tx => {
        await lockCertificadoEnvironment(tx, batch.ambiente);
        const owned = await tx.importacaoCertificadoDrake.updateMany({ where: { id: importacaoId, envioToken: token }, data: { envioHeartbeatEm: new Date() } });
        if (owned.count !== 1) throw new CertificadoError("A execução perdeu a reserva. Consulte o histórico.", 409);
        const item = await tx.importacaoCertificadoDrakeItem.findUniqueOrThrow({ where: { id: candidate.id } });
        if (item.status !== "PENDENTE_ENVIO") return null;
        const previous = await tx.importacaoCertificadoDrakeItem.findMany({ where: { id: { not: item.id }, chaveIdempotencia: item.chaveIdempotencia, importacao: { ambiente: batch.ambiente }, status: { in: ["ENVIANDO", "ENVIADO", "CONFIRMADO", "NAO_CONFIRMADO"] } }, select: { status: true, validade: true, recebimento: true } });
        const history=certificadoHistoryDecision(previous,item);
        if(history){await tx.importacaoCertificadoDrakeItem.update({where:{id:item.id},data:{status:history.status,motivoErro:history.motivo}});return null;}
        if (!item.payload) {
          await tx.importacaoCertificadoDrakeItem.update({ where: { id: item.id }, data: { status: "ERRO_VALIDACAO", motivoErro: "Certificado sem payload. Analise o arquivo novamente." } });
          return null;
        }
        const checks = await checkReferenceBatch(tx, batch.ambiente, [{ ...item, key: String(item.id) }], true);
        await saveReferenceChecks(tx, importacaoId, checks, "id");
        const check = checks.get(String(item.id))!;
        if (check.status !== "NOVO") {
          await tx.importacaoCertificadoDrakeItem.update({ where: { id: item.id }, data: { status: check.status, motivoErro: check.motivo } });
          return null;
        }
        const payload = explicitCertificatePayload(item.payload, `crew:certificado:${item.chaveIdempotencia}`);
        await tx.importacaoCertificadoDrakeItem.update({ where: { id: item.id }, data: { status: "ENVIANDO", payload, tentativas: { increment: 1 } } });
        const attempt = await tx.importacaoCertificadoDrakeTentativa.create({ data: { importacaoId, itemId: item.id, status: "ENVIANDO", payload, usuarioId, usuarioNome: usuarioNome ?? null } });
        await tx.$executeRaw`UPDATE "ImportacaoCertificadoDrakeTentativa" SET "drakeTenantId"=${config.tenantId}::uuid WHERE id=${attempt.id}`;
        return { item: { ...item, payload }, attempt };
      });
      if (!reserved) { stats.ignorados++; stats.processados++; report(); continue; }
      stats.fase = "ENVIANDO"; report();
      const { item, attempt } = reserved;
      let response: Awaited<ReturnType<typeof syncDocument>> | undefined, failure: unknown;
      try { response = await syncDocument(item.payload, config); } catch (error) { failure = error; }
      const outcome=response?certificadoResponseOutcome(response):null;
      const accepted=outcome?.accepted===true;
      const uncertain=outcome?outcome.status==="NAO_CONFIRMADO":!(failure instanceof DrakeClientError)||!failure.status||failure.status>=500||failure.status===408;
      const status=outcome?.status??(uncertain?"NAO_CONFIRMADO":"ERRO_DRAKE");
      const erro=failure?errorText(failure):outcome?.error??null,finished=new Date();
      try {
        await db.$transaction(async tx => {
          await lockCertificadoEnvironment(tx,batch.ambiente);
          const changed = await tx.importacaoCertificadoDrakeItem.updateMany({ where: { id: item.id, status: "ENVIANDO" }, data: { status, motivoErro: erro, ...(response ? { respostaDrake: (response.data ?? response.text) as Prisma.InputJsonValue, ...(accepted?{enviadoEm:finished}:{}) } : {}) } });
          if (changed.count !== 1) throw new CertificadoError("O estado do item mudou durante o envio. Confira o histórico.", 409);
          await tx.importacaoCertificadoDrakeTentativa.update({ where: { id: attempt.id }, data: { status, erro, httpStatus: response?.status ?? (failure instanceof DrakeClientError ? failure.status : null), resposta: response ? (response.data ?? response.text) as Prisma.InputJsonValue : Prisma.JsonNull, finalizadoEm: finished, duracaoMs: finished.getTime() - attempt.iniciadoEm.getTime() } });
          if(accepted)await reconciliarDesfechos(tx,{ambiente:batch.ambiente,usuarioId,usuarioNome:usuarioNome??`Usuário #${usuarioId}`,fonteId:item.id,chave:item.chaveIdempotencia});
          await tx.importacaoCertificadoDrake.updateMany({ where: { id: importacaoId, envioToken: token }, data: { envioHeartbeatEm: finished } });
        },{timeout:30000});
      } catch {
        // Mantém a reserva e ENVIANDO para recuperação segura, sem transformar uma falha de auditoria em reenvio.
        throw new CertificadoError("Não foi possível gravar o resultado do envio. Consulte o histórico e recupere a execução interrompida antes de continuar.", 503);
      }
      stats.processados++; if (accepted) stats.enviados++; else if (uncertain) stats.naoConfirmados++; else stats.falhas++;
      if (!todosPendentes || resultados.length < 50) resultados.push({ itemId: item.id, statusNovo: status, ...(erro ? { erro } : {}) }); report();
      if (uncertain) { interrompido = true; break; }
    }
    stats.fase = "FINALIZANDO"; report();
    const importacao = await db.$transaction(async tx => {
      await tx.importacaoCertificadoDrake.updateMany({ where: { id: importacaoId, envioToken: token }, data: { envioToken: null, envioHeartbeatEm: null } });
      return resumirImportacaoCertificadosDrake(tx, importacaoId);
    });
    return { importacao, totalSelecionado: items.length, processados: stats.processados, enviados: stats.enviados, falhas: stats.falhas, naoConfirmados: stats.naoConfirmados, ignorados: stats.ignorados, interrompido, resultados };
  } catch (error) {
    await db.importacaoCertificadoDrake.updateMany({ where: { id: importacaoId, envioToken: token }, data: { ultimoErro: errorText(error) } }).catch(() => {});
    throw error;
  }
}
