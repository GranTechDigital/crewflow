const { randomUUID } = require('node:crypto');

async function bindDelivery(db,input,loadId){
 if(!input.deliveryId)return;
 const count=await db.$executeRaw`UPDATE "DrakeDocumentoEntrega" SET "cargaId"=${loadId}::uuid WHERE id=${input.deliveryId}::uuid AND reserva=${input.deliveryReservation}::uuid AND status='PROCESSANDO'`;
 if(count!==1)throw Error('RESERVA_DO_RECEBIMENTO_ALTERADA');
}
async function assertDelivery(db,context){
 if(!context.deliveryId)return;
 const rows=await db.$queryRaw`SELECT id FROM "DrakeDocumentoEntrega" WHERE id=${context.deliveryId}::uuid AND reserva=${context.deliveryReservation}::uuid AND status='PROCESSANDO' FOR UPDATE`;
 if(rows.length!==1)throw Error('RESERVA_DO_RECEBIMENTO_ALTERADA');
}
async function beginLoad(db, input) {
  return db.$transaction(async tx => {
    await tx.$executeRaw`INSERT INTO "DrakeDocumentoOrigem" (id, ambiente, "tenantId") VALUES (${randomUUID()}::uuid, ${input.environment}, ${input.tenantId}::uuid) ON CONFLICT (ambiente, "tenantId") DO NOTHING`;
    const [source] = await tx.$queryRaw`SELECT * FROM "DrakeDocumentoOrigem" WHERE ambiente=${input.environment} AND "tenantId"=${input.tenantId}::uuid FOR UPDATE`;
    if (source.cargaAtivaId) throw Error('Origem com carga ativa. Confira o heartbeat e recupere a carga interrompida antes de repetir.');
    const [previous] = await tx.$queryRaw`SELECT id, status FROM "DrakeDocumentoCarga" WHERE "origemId"=${source.id}::uuid AND "hashArquivo"=${input.hash} AND "parserVersao"=${input.parserVersion}`;
    if (previous?.status === 'CONCLUIDA') {await bindDelivery(tx,input,previous.id);return { id: previous.id, sourceId: source.id, skipped: true };}
    if (previous && !input.retry) throw Error('Arquivo já possui carga com falha. Confira o erro e use --retry para reprocessar.');
    const id = previous?.id || randomUUID();
    if (previous) {
      await tx.$executeRaw`DELETE FROM "DrakeDocumentoStaging" WHERE "cargaId"=${id}::uuid`;
      await tx.$executeRaw`UPDATE "DrakeDocumentoCarga" SET status='VALIDANDO', erro=NULL, resumo='{}', "iniciadoEm"=CURRENT_TIMESTAMP, "heartbeatEm"=CURRENT_TIMESTAMP, "concluidoEm"=NULL WHERE id=${id}::uuid`;
    } else {
      await tx.$executeRaw`INSERT INTO "DrakeDocumentoCarga" (id,"origemId","nomeArquivo","hashArquivo","parserVersao","fusoFonte","arquivoPrivado") VALUES (${id}::uuid,${source.id}::uuid,${input.filename},${input.hash},${input.parserVersion},${input.timeZone},${input.archive})`;
    }
    await tx.$executeRaw`UPDATE "DrakeDocumentoOrigem" SET "cargaAtivaId"=${id}::uuid WHERE id=${source.id}::uuid`;
    await bindDelivery(tx,input,id);
    return { id, sourceId: source.id, skipped: false };
  });
}
async function stageBatch(db, load, rows, context = {}) {
  const json = JSON.stringify(rows);
  await db.$transaction(async tx => {
    await assertDelivery(tx,context);
    const changed = await tx.$executeRaw`UPDATE "DrakeDocumentoCarga" SET "heartbeatEm"=CURRENT_TIMESTAMP WHERE id=${load.id}::uuid AND status='VALIDANDO' AND EXISTS (SELECT 1 FROM "DrakeDocumentoOrigem" WHERE id=${load.sourceId}::uuid AND "cargaAtivaId"=${load.id}::uuid)`;
    if (changed !== 1) throw Error('A reserva da carga mudou. Processamento interrompido.');
    await tx.$executeRaw`INSERT INTO "DrakeDocumentoStaging" ("cargaId","numeroLinha","documentoId","hashDados",dados)
      SELECT ${load.id}::uuid, (item->>'row')::int, (item->>'documentId')::uuid, item->>'hash', item - 'row' - 'hash'
      FROM jsonb_array_elements(${json}::jsonb) item`;
  });
}
async function failLoad(db, load, summary, error, context = {}) {
  await db.$transaction(async tx => {
    await assertDelivery(tx,context);
    await tx.$executeRaw`UPDATE "DrakeDocumentoCarga" SET status='ERRO', resumo=${JSON.stringify(summary)}::jsonb, erro=${String(error).slice(0,1000)}, "concluidoEm"=CURRENT_TIMESTAMP WHERE id=${load.id}::uuid AND status<>'CONCLUIDA'`;
    await tx.$executeRaw`UPDATE "DrakeDocumentoOrigem" SET "cargaAtivaId"=NULL WHERE id=${load.sourceId}::uuid AND "cargaAtivaId"=${load.id}::uuid`;
  });
}
async function applyLoad(db, load, summary, context = {}) {
  return db.$transaction(async tx => {
    if(context.confirmSends){const [origin]=await tx.$queryRaw`SELECT ambiente FROM "DrakeDocumentoOrigem" WHERE id=${load.sourceId}::uuid`;await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('crew-certificados'),hashtext(${origin.ambiente}))::text`;}

    const [source] = await tx.$queryRaw`SELECT * FROM "DrakeDocumentoOrigem" WHERE id=${load.sourceId}::uuid FOR UPDATE`;
    if (source.cargaAtivaId !== load.id) throw Error('A reserva da carga mudou antes da aplicação.');
    await assertDelivery(tx,context);
    if(context.incremental&&(source.status!=='PRONTA'||source.versao<1))throw Error('Carga inicial validada é obrigatória antes do incremental.');
    if(context.windowStart&&(!source.atualizadoEm||context.windowStart>source.atualizadoEm))throw Error('JANELA_NAO_COBRE_ULTIMA_REFERENCIA');
    if(context.generatedAt&&source.atualizadoEm&&context.generatedAt<source.atualizadoEm)throw Error('Relatório mais antigo que a referência ativa.');
    const [duplicates] = await tx.$queryRaw`SELECT COUNT(*)::int AS grupos, COALESCE(SUM(n-1),0)::int AS repeticoes, COUNT(*) FILTER (WHERE hashes>1)::int AS conflitos
      FROM (SELECT COUNT(*) n, COUNT(DISTINCT "hashDados") hashes FROM "DrakeDocumentoStaging" WHERE "cargaId"=${load.id}::uuid GROUP BY "documentoId" HAVING COUNT(*)>1) d`;
    if (duplicates.conflitos) throw Error(`${duplicates.conflitos} IDs repetidos com dados conflitantes. A referência não foi alterada.`);
    const [stats] = await tx.$queryRaw`WITH s AS (SELECT DISTINCT ON ("documentoId") * FROM "DrakeDocumentoStaging" WHERE "cargaId"=${load.id}::uuid ORDER BY "documentoId","numeroLinha")
      SELECT COUNT(*) FILTER (WHERE r."documentoId" IS NULL)::int AS novos,
        COUNT(*) FILTER (WHERE r."documentoId" IS NOT NULL AND (s.dados->>'updatedAtSource')::timestamptz>r."alteradoNaFonteEm")::int AS atualizados,
        COUNT(*) FILTER (WHERE (s.dados->>'updatedAtSource')::timestamptz<r."alteradoNaFonteEm")::int AS antigos,
        COUNT(*) FILTER (WHERE (s.dados->>'updatedAtSource')::timestamptz=r."alteradoNaFonteEm" AND s."hashDados"=r."hashDados")::int AS iguais,
        COUNT(*) FILTER (WHERE (s.dados->>'updatedAtSource')::timestamptz=r."alteradoNaFonteEm" AND s."hashDados"<>r."hashDados")::int AS conflitos
      FROM s LEFT JOIN "DrakeDocumentoReferencia" r ON r."origemId"=${load.sourceId}::uuid AND r."documentoId"=s."documentoId"`;
    if (stats.conflitos) throw Error(`${stats.conflitos} documentos têm mesma data de alteração e conteúdo diferente. A referência não foi alterada.`);
    await tx.$executeRaw`INSERT INTO "DrakeDocumentoRevisao" ("origemId","documentoId","cargaId","dadosAnteriores","dadosNovos")
      SELECT r."origemId", r."documentoId", ${load.id}::uuid, r.dados, s.dados FROM "DrakeDocumentoReferencia" r
      JOIN (SELECT DISTINCT ON ("documentoId") * FROM "DrakeDocumentoStaging" WHERE "cargaId"=${load.id}::uuid ORDER BY "documentoId","numeroLinha") s ON s."documentoId"=r."documentoId"
      WHERE r."origemId"=${load.sourceId}::uuid AND (s.dados->>'updatedAtSource')::timestamptz>r."alteradoNaFonteEm"`;
    await tx.$executeRaw`INSERT INTO "DrakeDocumentoReferencia" ("origemId","documentoId",matricula,"tipoNormalizado","qualificacaoNormalizada",emissao,"alteradoNaFonteEm","hashDados",dados,"primeiraCargaId","ultimaCargaId")
      SELECT ${load.sourceId}::uuid, s."documentoId", s.dados->>'registration', s.dados->>'typeNormalized', s.dados->>'qualificationNormalized', (s.dados->>'emission')::date,
        (s.dados->>'updatedAtSource')::timestamptz, s."hashDados", s.dados, ${load.id}::uuid, ${load.id}::uuid
      FROM (SELECT DISTINCT ON ("documentoId") * FROM "DrakeDocumentoStaging" WHERE "cargaId"=${load.id}::uuid ORDER BY "documentoId","numeroLinha") s
      ON CONFLICT ("origemId","documentoId") DO UPDATE SET matricula=EXCLUDED.matricula,"tipoNormalizado"=EXCLUDED."tipoNormalizado","qualificacaoNormalizada"=EXCLUDED."qualificacaoNormalizada",emissao=EXCLUDED.emissao,
        "alteradoNaFonteEm"=EXCLUDED."alteradoNaFonteEm","hashDados"=EXCLUDED."hashDados",dados=EXCLUDED.dados,"ultimaCargaId"=EXCLUDED."ultimaCargaId","atualizadoEm"=CURRENT_TIMESTAMP
      WHERE EXCLUDED."alteradoNaFonteEm">"DrakeDocumentoReferencia"."alteradoNaFonteEm"`;
    const [totals] = await tx.$queryRaw`SELECT COUNT(*)::int AS documentos, COUNT(DISTINCT matricula)::int AS matriculas FROM "DrakeDocumentoReferencia" WHERE "origemId"=${load.sourceId}::uuid`;
    const [ambiguous] = await tx.$queryRaw`SELECT COUNT(*)::int AS grupos FROM (SELECT 1 FROM "DrakeDocumentoReferencia" WHERE "origemId"=${load.sourceId}::uuid GROUP BY matricula,"tipoNormalizado","qualificacaoNormalizada",emissao HAVING COUNT(*)>1) d`;
    const result = { ...summary, ...stats, repeticoesNoArquivo: duplicates.repeticoes, ...totals, gruposPossivelDuplicidade: ambiguous.grupos };
    await tx.$executeRaw`UPDATE "DrakeDocumentoCarga" SET status='CONCLUIDA', resumo=${JSON.stringify(result)}::jsonb, erro=NULL,"concluidoEm"=CURRENT_TIMESTAMP,"heartbeatEm"=CURRENT_TIMESTAMP WHERE id=${load.id}::uuid`;
    await tx.$executeRaw`UPDATE "DrakeDocumentoOrigem" SET status='PRONTA', versao=versao+1,"atualizadoEm"=${context.generatedAt||new Date()},"cargaAtivaId"=NULL WHERE id=${load.sourceId}::uuid`;
    if(context.confirmSends){
      await tx.$executeRaw`UPDATE "DrakeDocumentoReferencia" r SET "observadoEm"=${context.generatedAt||new Date()},"ultimaCargaId"=${load.id}::uuid WHERE r."origemId"=${load.sourceId}::uuid AND EXISTS(SELECT 1 FROM "DrakeDocumentoStaging" s WHERE s."cargaId"=${load.id}::uuid AND s."documentoId"=r."documentoId" AND s."hashDados"=r."hashDados")`;
      result.confirmacao=await require('./drake-document-confirmation.cjs').reconcile(tx,load.sourceId);
      await tx.$executeRaw`UPDATE "DrakeDocumentoCarga" SET resumo=${JSON.stringify(result)}::jsonb WHERE id=${load.id}::uuid`;
    }
    await tx.$executeRaw`DELETE FROM "DrakeDocumentoStaging" WHERE "cargaId"=${load.id}::uuid`;
    return result;
  }, { timeout: 180000, maxWait: 10000 });
}
async function recoverLoad(db, id) {
  return db.$transaction(async tx => {
    const [load] = await tx.$queryRaw`SELECT * FROM "DrakeDocumentoCarga" WHERE id=${id}::uuid FOR UPDATE`;
    if (!load || load.status !== 'VALIDANDO' || Date.now() - load.heartbeatEm.getTime() < 20 * 60000) throw Error('Recuperação exige carga VALIDANDO sem heartbeat há pelo menos 20 minutos.');
    const changed = await tx.$executeRaw`UPDATE "DrakeDocumentoOrigem" SET "cargaAtivaId"=NULL WHERE id=${load.origemId}::uuid AND "cargaAtivaId"=${id}::uuid`;
    if (changed !== 1) throw Error('Reserva da carga não corresponde.');
    await tx.$executeRaw`UPDATE "DrakeDocumentoCarga" SET status='ERRO',erro='Carga interrompida recuperada explicitamente',"concluidoEm"=CURRENT_TIMESTAMP WHERE id=${id}::uuid`;
  });
}
async function refreshRepeatedReport(db,load,generatedAt,context={}){
 return db.$transaction(async tx=>{
  if(context.confirmSends){const [origin]=await tx.$queryRaw`SELECT ambiente FROM "DrakeDocumentoOrigem" WHERE id=${load.sourceId}::uuid`;await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('crew-certificados'),hashtext(${origin.ambiente}))::text`;}

  const [source]=await tx.$queryRaw`SELECT * FROM "DrakeDocumentoOrigem" WHERE id=${load.sourceId}::uuid FOR UPDATE`;
  await assertDelivery(tx,context);
  if(!source||source.status!=='PRONTA'||source.versao<1||source.cargaAtivaId)throw Error('Referência indisponível para atualizar o frescor.');
  if(context.windowStart&&(!source.atualizadoEm||context.windowStart>source.atualizadoEm))throw Error('JANELA_NAO_COBRE_ULTIMA_REFERENCIA');
  if(source.atualizadoEm&&generatedAt<source.atualizadoEm)throw Error('Relatório mais antigo que a referência ativa.');
  await tx.$executeRaw`UPDATE "DrakeDocumentoOrigem" SET "atualizadoEm"=${generatedAt} WHERE id=${source.id}::uuid`;
  if(context.confirmSends){
    // Arquivo id�ntico rec�m-gerado observa novamente somente seus pr�prios IDs.
    // A c�pia � relida pelo loader para n�o assumir que todos os documentos da origem estavam no relat�rio.
    if(context.repeatedRows)for(const rows of context.repeatedRows){await tx.$executeRaw`UPDATE "DrakeDocumentoReferencia" SET "observadoEm"=${generatedAt},"ultimaCargaId"=${load.id}::uuid WHERE "origemId"=${source.id}::uuid AND EXISTS (SELECT 1 FROM jsonb_array_elements(${JSON.stringify(rows)}::jsonb) x WHERE (x->>'documentId')::uuid="DrakeDocumentoReferencia"."documentoId" AND x->>'hash'="DrakeDocumentoReferencia"."hashDados")`;}
    await require('./drake-document-confirmation.cjs').reconcile(tx,source.id);
  }
 });
}
module.exports = { beginLoad, stageBatch, failLoad, applyLoad, recoverLoad, refreshRepeatedReport };
