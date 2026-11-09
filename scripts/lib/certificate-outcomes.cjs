const {randomUUID}=require('node:crypto');
const {Prisma}=require('@prisma/client');
const {summarize}=require('./certificate-batch-summary.cjs');
const {cancelableStatuses:CERTIFICADO_CANCELABLE_STATUS}=require('./certificate-status.cjs');
async function reconcileAcrossFiles(db,input){
  const rows=await db.$queryRaw(Prisma.sql`WITH alvos AS (
    SELECT i.id,i."importacaoId",i.status AS "statusAnterior",i."motivoErro" AS "motivoAnterior",f.id AS "fonteId",f."importacaoId" AS "fonteImportacaoId"
    FROM "ImportacaoCertificadoDrakeItem" i JOIN "ImportacaoCertificadoDrake" b ON b.id=i."importacaoId"
    JOIN LATERAL (SELECT s.id,s."importacaoId",COALESCE(s."enviadoEm",s."updatedAt") AS aceite FROM "ImportacaoCertificadoDrakeItem" s JOIN "ImportacaoCertificadoDrake" sb ON sb.id=s."importacaoId"
      WHERE sb.ambiente=b.ambiente
      ${input.tenantId?Prisma.sql`AND EXISTS(SELECT 1 FROM "ImportacaoCertificadoDrakeTentativa" st WHERE st."itemId"=s.id AND st."drakeTenantId"=${input.tenantId}::uuid AND st.id=(SELECT MAX(latest.id) FROM "ImportacaoCertificadoDrakeTentativa" latest WHERE latest."itemId"=s.id))`:Prisma.empty}
       AND s."importacaoId"<>i."importacaoId" AND s."chaveIdempotencia"=i."chaveIdempotencia" AND s.status IN ('ENVIADO','CONFIRMADO') ${input.fonteId?Prisma.sql`AND s.id=${input.fonteId}`:Prisma.empty}
      ${input.sourceIds?Prisma.sql`AND s.id IN (${Prisma.join(input.sourceIds)})`:Prisma.empty}
      ORDER BY COALESCE(s."enviadoEm",s."updatedAt") DESC,s.id DESC LIMIT 1) f ON f.aceite>=i."updatedAt"
    WHERE b.ambiente=${input.ambiente} AND i.status IN (${Prisma.join(CERTIFICADO_CANCELABLE_STATUS)})
      ${input.importacaoId?Prisma.sql`AND i."importacaoId"=${input.importacaoId}`:Prisma.empty} ${input.chave?Prisma.sql`AND i."chaveIdempotencia"=${input.chave}`:Prisma.empty}
      AND NOT EXISTS(SELECT 1 FROM "ImportacaoCertificadoDrakeTentativa" t WHERE t."itemId"=i.id AND t.status IN ('ENVIANDO','ENVIADO','CONFIRMADO','NAO_CONFIRMADO'))
    FOR UPDATE OF i
  ), alterados AS (UPDATE "ImportacaoCertificadoDrakeItem" i SET status='RESOLVIDO_OUTRO_ARQUIVO',"motivoErro"='Atendido pelo carregamento #'||a."fonteImportacaoId"||' (registro '||a."fonteId"||'). Sem novo envio.',"updatedAt"=clock_timestamp() FROM alvos a WHERE i.id=a.id RETURNING i.id,i."importacaoId",a."statusAnterior",a."motivoAnterior",a."fonteId",a."fonteImportacaoId") SELECT * FROM alterados`);

  for(const row of rows){await db.$executeRaw`INSERT INTO "DrakeCertificadoItemEdicao" (id,"itemId","usuarioId","usuarioNome",anterior,novo) VALUES (${randomUUID()}::uuid,${row.id},${input.usuarioId},${input.usuarioNome},${JSON.stringify({status:row.statusAnterior,motivoErro:row.motivoAnterior})}::jsonb,${JSON.stringify({status:'RESOLVIDO_OUTRO_ARQUIVO',motivoErro:'Atendido por certificado equivalente em outro carregamento.',resolvidoPorItemId:row.fonteId,resolvidoPorImportacaoId:row.fonteImportacaoId})}::jsonb)`;}
  for(const id of new Set(rows.map(row=>row.importacaoId))){const groups=await db.importacaoCertificadoDrakeItem.groupBy({by:['status'],where:{importacaoId:id},_count:{_all:true}});const batch=await db.importacaoCertificadoDrake.findUniqueOrThrow({where:{id}});await db.importacaoCertificadoDrake.update({where:{id},data:summarize(groups,batch)});}
  return rows.length;
}
module.exports={reconcileAcrossFiles};
