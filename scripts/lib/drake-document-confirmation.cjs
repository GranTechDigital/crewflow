const { randomUUID } = require('node:crypto');

const typeKey = value => ['CERTIFICADO', 'CERTIFICATE', 'CERTIFICADO / CERTIFICATE'].includes(value) ? 'CERTIFICADO' : value;
const date = value => value instanceof Date ? value.toISOString().slice(0, 10) : value ? String(value).slice(0, 10) : null;

function decision(item, candidates, previous) {
  const expected = { registration: item.matricula, qualification: item.qualificacaoNormalizada, type: typeKey(item.tipoDocumentoNormalizado), emission: date(item.emissao), expiration: date(item.validade), online: item.payloadEnviado?.Payload?.OnlineTraining?.Value };
  if (candidates.length !== 1) return { status: candidates.length ? 'AMBIGUO' : 'AGUARDANDO_RELATORIO', motivo: candidates.length ? 'Mais de um documento corresponde ao certificado; confira no Drake.' : 'O relatório ainda não trouxe um documento correspondente.', expected };
  const document = candidates[0];
  const after = item.finalizadoEm || item.enviadoEm || item.iniciadoEm;
  if (!after || !document.observadoEm || +document.observadoEm < +after) return { status: 'AGUARDANDO_RELATORIO', motivo: 'A observação disponível é anterior à tentativa de envio.', expected };
  if (previous?.documentoId && previous.documentoId !== document.documentoId) return { status: 'DIVERGENTE', motivo: 'O documento encontrado tem ID diferente do vínculo anterior. Confira no Drake.', expected };
  const data = document.dados;
  const mismatch = [];
  if (data.registration !== expected.registration || data.qualificationNormalized !== expected.qualification || typeKey(data.typeNormalized) !== expected.type || data.emission !== expected.emission) mismatch.push('identificação');
  if ((data.expiration || null) !== expected.expiration) mismatch.push('validade');
  if (typeof expected.online !== 'boolean' || typeof data.online !== 'boolean') return { status: 'DADOS_INSUFICIENTES', motivo: 'Modalidade online ausente no envio ou no relatório; confirmação automática indisponível.', expected };
  if (data.online !== expected.online) mismatch.push('modalidade online');
  return { status: mismatch.length ? 'DIVERGENTE' : 'CONFIRMADO', motivo: mismatch.length ? `Dados diferentes no Drake: ${mismatch.join(', ')}. Confira antes de qualquer ação.` : 'Documento observado no relatório do Drake com identificação, validade e modalidade conferidas.', expected };
}

// Deve executar sob a mesma trava de ambiente usada pelo envio e pela aplicação da referência.
async function reconcile(tx, sourceId) {
  const [source] = await tx.$queryRaw`SELECT * FROM "DrakeDocumentoOrigem" WHERE id=${sourceId}::uuid`;
  if (!source || !['hmg','prd'].includes(source.ambiente) || source.status !== 'PRONTA') throw Error('ORIGEM_DE_CONFIRMACAO_INVALIDA');
  const items = await tx.$queryRaw`SELECT i.*,t.id AS "tentativaId",t.payload AS "payloadEnviado",t."iniciadoEm",t."finalizadoEm"
    FROM "ImportacaoCertificadoDrakeItem" i JOIN "ImportacaoCertificadoDrake" b ON b.id=i."importacaoId"
    JOIN LATERAL (SELECT * FROM "ImportacaoCertificadoDrakeTentativa" a WHERE a."itemId"=i.id ORDER BY a.id DESC LIMIT 1) t ON true
    WHERE b.ambiente= ${source.ambiente} AND i.status IN ('ENVIADO','CONFIRMADO','NAO_CONFIRMADO')
      AND t."drakeTenantId"=${source.tenantId}::uuid AND t.status IN ('ENVIADO','CONFIRMADO','NAO_CONFIRMADO') AND b."envioToken" IS NULL
      AND NOT EXISTS(SELECT 1 FROM "DrakeDocumentoExclusao" e WHERE e."itemId"=i.id AND e.status IN ('EM_EXECUCAO','EXCLUSAO_ACEITA','NAO_CONFIRMADO'))
    ORDER BY i.id FOR UPDATE OF i`;
  const result = { confirmados: 0, divergentes: 0, ambiguos: 0, aguardando: 0 }, batches = new Set(), confirmedIds=[];
  for (const item of items) {
    const [previous] = await tx.$queryRaw`SELECT * FROM "DrakeCertificadoConfirmacao" WHERE "itemId"=${item.id} ORDER BY "criadoEm" DESC,id DESC LIMIT 1`;
    if (previous && previous.origemId !== source.id) continue;
    const matches = await tx.$queryRaw`SELECT * FROM "DrakeDocumentoReferencia" WHERE "origemId"=${source.id}::uuid AND matricula=${item.matricula} AND "qualificacaoNormalizada"=${item.qualificacaoNormalizada} AND emissao=${item.emissao}::date AND "tipoNormalizado" IN (${item.tipoDocumentoNormalizado},'CERTIFICADO','CERTIFICATE','CERTIFICADO / CERTIFICATE') ORDER BY "documentoId" LIMIT 2`;
    // Um vínculo já conhecido também detecta alterações de identificação no documento original.
    if (previous?.documentoId && !matches.some(row => row.documentoId === previous.documentoId)) {
      const [linked] = await tx.$queryRaw`SELECT * FROM "DrakeDocumentoReferencia" WHERE "origemId"=${source.id}::uuid AND "documentoId"=${previous.documentoId}::uuid`;
      if (linked) matches.push(linked);
    }
    const outcome = decision(item, matches, previous);
    if (outcome.status === 'AGUARDANDO_RELATORIO') { result.aguardando++; continue; }
    const document = matches.length === 1 ? matches[0] : null;
    const observedAt = document?.observadoEm || source.atualizadoEm;
    const loadId = document?.ultimaCargaId || matches[0]?.ultimaCargaId;
    if (!observedAt || !loadId) continue;
    const evidence = { tentativaId: item.tentativaId, esperado: outcome.expected, observado: document?.dados || null, candidatos: matches.map(row => row.documentoId), camposConferidos: ['matricula', 'tipo', 'qualificacao', 'emissao', 'validade', 'online'], camposNaoDisponiveis: ['recebimento', 'anexos', 'comentarios'] };
    await tx.$executeRaw`INSERT INTO "DrakeCertificadoConfirmacao" (id,"itemId","origemId","cargaId","documentoId",status,motivo,"referenciaEm",evidencia)
      VALUES (${randomUUID()}::uuid,${item.id},${source.id}::uuid,${loadId}::uuid,${document?.documentoId || previous?.documentoId || null}::uuid,${outcome.status},${outcome.motivo},${observedAt},${JSON.stringify(evidence)}::jsonb)
      ON CONFLICT ("itemId","cargaId","referenciaEm") DO NOTHING`;
    if (outcome.status === 'CONFIRMADO') {
      result.confirmados++;confirmedIds.push(item.id);
      if (item.status !== 'CONFIRMADO') {
        await tx.$executeRaw`UPDATE "ImportacaoCertificadoDrakeItem" SET status='CONFIRMADO',"enviadoEm"=COALESCE("enviadoEm",${item.finalizadoEm||item.iniciadoEm}),"confirmadoEm"=clock_timestamp(),"motivoErro"=NULL,"updatedAt"=clock_timestamp() WHERE id=${item.id}`;
        batches.add(item.importacaoId);
      }
    } else {
      if (outcome.status === 'AMBIGUO') result.ambiguos++; else result.divergentes++;
      if (item.status !== 'NAO_CONFIRMADO' || item.motivoErro !== outcome.motivo) {
        await tx.$executeRaw`UPDATE "ImportacaoCertificadoDrakeItem" SET status='NAO_CONFIRMADO',"confirmadoEm"=NULL,"motivoErro"=${outcome.motivo},"updatedAt"=clock_timestamp() WHERE id=${item.id}`;
        batches.add(item.importacaoId);
      }
    }
  }
  result.resolvidosEmOutrosArquivos=confirmedIds.length?await require('./certificate-outcomes.cjs').reconcileAcrossFiles(tx,{ambiente:source.ambiente,tenantId:source.tenantId,usuarioId:0,usuarioNome:'Conferencia automatica por relatorio do Drake',sourceIds:confirmedIds}):0;
  // Preserva o histórico HTTP das tentativas. Apenas o estado derivado do carregamento muda.
  for (const id of batches) {
    const groups = await tx.importacaoCertificadoDrakeItem.groupBy({ by: ['status'], where: { importacaoId: id }, _count: { _all: true } });
    const batch = await tx.importacaoCertificadoDrake.findUniqueOrThrow({ where: { id } });
    await tx.importacaoCertificadoDrake.update({ where: { id }, data: require('./certificate-batch-summary.cjs').summarize(groups,batch) });
  }
  return result;
}

async function reconcileSource(db, environment, tenantId, {dryRun=false}={}) {
  class Preview extends Error {constructor(result){super('PREVIA');this.result=result;}}
  try{return await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('crew-certificados'),hashtext(${environment}))::text`;
    const [source] = await tx.$queryRaw`SELECT id FROM "DrakeDocumentoOrigem" WHERE ambiente=${environment} AND "tenantId"=${tenantId}::uuid FOR SHARE`;
    if (!source) throw Error('ORIGEM_DE_CONFIRMACAO_INVALIDA');
    const result=await reconcile(tx, source.id);if(dryRun)throw new Preview(result);return result;
  }, { timeout: 60000 });}catch(error){if(error instanceof Preview)return error.result;throw error;}
}
module.exports = { decision, reconcile, reconcileSource };
