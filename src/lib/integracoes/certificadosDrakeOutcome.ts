import {reconcileAcrossFiles} from "../../../scripts/lib/certificate-outcomes.cjs";
import { certificateEnvironment } from "./certificadosDrakeEnvironment";
import { randomUUID } from "crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CertificadoDb, lockCertificadoEnvironment, resumirImportacaoCertificadosDrake } from "./certificadosDrakeDb";
import { assertCertificadoVersionEditable } from "./certificadosDrakeVersions";
import { CertificadoError, CERTIFICADO_CANCELABLE_STATUS } from "./certificadosDrakeShared";

type OutcomeRow={id:number;importacaoId:number;statusAnterior:string;motivoAnterior:string|null;fonteId?:number;fonteImportacaoId?:number};
async function audit(db:CertificadoDb,rows:OutcomeRow[],actor:{usuarioId:number;usuarioNome:string},status:string,motivo:string) {
  for(let offset=0;offset<rows.length;offset+=500){const values=rows.slice(offset,offset+500).map(row=>Prisma.sql`(${randomUUID()}::uuid,${row.id},${actor.usuarioId},${actor.usuarioNome},${JSON.stringify({status:row.statusAnterior,motivoErro:row.motivoAnterior})}::jsonb,${JSON.stringify({status,motivoErro:motivo,resolvidoPorItemId:row.fonteId??null,resolvidoPorImportacaoId:row.fonteImportacaoId??null})}::jsonb)`);await db.$executeRaw(Prisma.sql`INSERT INTO "DrakeCertificadoItemEdicao" (id,"itemId","usuarioId","usuarioNome",anterior,novo) VALUES ${Prisma.join(values)}`);}
}

/** Somente evidência de envio posterior: nunca esconde um envio incerto ou uma correção mais recente. */
export const reconciliarDesfechos = reconcileAcrossFiles;

export async function cancelarCertificados({importacaoId,itemId,motivo,confirmar,usuarioId,usuarioNome,db=prisma}:{importacaoId:number;itemId?:number;motivo:unknown;confirmar:unknown;usuarioId:number;usuarioNome:string;db?:PrismaClient}) {
  if(confirmar!==true)throw new CertificadoError("Confirme o cancelamento no Crew.");
  if(typeof motivo!=="string"||motivo.trim().length<3||motivo.length>1000)throw new CertificadoError("Informe um motivo de 3 a 1.000 caracteres.");
  if(itemId!==undefined&&(!Number.isSafeInteger(itemId)||itemId<1))throw new CertificadoError("Registro inválido.");
  return db.$transaction(async tx=>{
    await lockCertificadoEnvironment(tx,certificateEnvironment());await assertCertificadoVersionEditable(tx,importacaoId);
    const resolvidos=await reconciliarDesfechos(tx,{importacaoId,ambiente:certificateEnvironment(),usuarioId,usuarioNome});
    const rows=await tx.$queryRaw<OutcomeRow[]>(Prisma.sql`WITH alvos AS (
      SELECT i.id,i."importacaoId",i.status AS "statusAnterior",i."motivoErro" AS "motivoAnterior" FROM "ImportacaoCertificadoDrakeItem" i
      WHERE i."importacaoId"=${importacaoId} ${itemId?Prisma.sql`AND i.id=${itemId}`:Prisma.empty} AND i.status IN (${Prisma.join(CERTIFICADO_CANCELABLE_STATUS)})
      AND NOT EXISTS(SELECT 1 FROM "ImportacaoCertificadoDrakeTentativa" t WHERE t."itemId"=i.id AND t.status IN ('ENVIANDO','ENVIADO','CONFIRMADO','NAO_CONFIRMADO')) FOR UPDATE OF i
    ), alterados AS (UPDATE "ImportacaoCertificadoDrakeItem" i SET status='CANCELADO',"motivoErro"=${motivo.trim()},"updatedAt"=clock_timestamp() FROM alvos a WHERE i.id=a.id RETURNING i.id,i."importacaoId",a."statusAnterior",a."motivoAnterior") SELECT * FROM alterados`);
    if(itemId&&!rows.length&&(await tx.importacaoCertificadoDrakeItem.findFirst({where:{id:itemId,importacaoId},select:{status:true}}))?.status!=="RESOLVIDO_OUTRO_ARQUIVO")throw new CertificadoError("O registro não pode ser cancelado: já foi tratado, enviado ou tem resultado incerto. Atualize a tela.",409);
    await audit(tx,rows,{usuarioId,usuarioNome},"CANCELADO",motivo.trim());
    return {cancelados:rows.length,resolvidos,importacao:await resumirImportacaoCertificadosDrake(tx,importacaoId)};
  },{timeout:30000});
}

export async function outcomeCounts(db:CertificadoDb,ids:number[]) {
  const empty=()=>({totalCanceladas:0,totalResolvidasOutroArquivo:0,totalDuplicadasNoArquivo:0,totalJaProcessadas:0,totalLinhas:0,totalPendentes:0,totalEnviadas:0,totalConfirmadas:0,totalErroValidacao:0,totalErroDrake:0,totalConflitos:0,totalNaoConfirmadas:0,totalDuplicadas:0});
  const result=new Map<number,ReturnType<typeof empty>>();
  if(!ids.length)return result;
  // Todas as contagens vêm do mesmo snapshot SQL, sem misturar resumo anterior e desfechos novos.
  const rows=await db.importacaoCertificadoDrakeItem.groupBy({by:["importacaoId","status"],where:{importacaoId:{in:ids}},_count:{_all:true}});
  for(const row of rows){
    const entry=result.get(row.importacaoId)??empty(),count=row._count._all;entry.totalLinhas+=count;
    switch(row.status){
      case "CANCELADO":entry.totalCanceladas=count;break;
      case "RESOLVIDO_OUTRO_ARQUIVO":entry.totalResolvidasOutroArquivo=count;break;
      case "DUPLICADO_NO_ARQUIVO":entry.totalDuplicadasNoArquivo=count;entry.totalDuplicadas+=count;break;
      case "DUPLICADO_JA_PROCESSADO":entry.totalJaProcessadas=count;entry.totalDuplicadas+=count;break;
      case "PENDENTE_ENVIO":entry.totalPendentes=count;break;
      case "ENVIADO":entry.totalEnviadas=count;break;
      case "CONFIRMADO":entry.totalConfirmadas=count;break;
      case "ERRO_VALIDACAO":entry.totalErroValidacao=count;break;
      case "ERRO_DRAKE":entry.totalErroDrake=count;break;
      case "NAO_CONFIRMADO":entry.totalNaoConfirmadas=count;break;
      case "CONFLITO_ATUALIZACAO":case "POSSIVEL_DUPLICIDADE":case "REFERENCIA_INDISPONIVEL":entry.totalConflitos+=count;break;
    }
    result.set(row.importacaoId,entry);
  }
  return result;
}
