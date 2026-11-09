import { certificateEnvironment } from "./certificadosDrakeEnvironment";
import { certificadoHistoryDecision } from "./certificadosDrakeEligibility";
import { randomUUID } from "crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { lockCertificadoEnvironment, resumirImportacaoCertificadosDrake } from "./certificadosDrakeDb";
import { CertificadoError, CERTIFICADO_EDITABLE_STATUS } from "./certificadosDrakeShared";
import { assertCertificadoVersionEditable } from "./certificadosDrakeVersions";
import { isUnspecifiedValidity, normalizeMatricula, normalizeText, parseDate, buildChaveIdempotencia, buildPayloadDrake, validarLinha, LinhaPlanilha } from "./certificadosDrakeValidation";
import { checkReferenceBatch, saveReferenceChecks } from "./certificadosDrakeReference";

const fields = ["matricula","nome","certificadora","qualificacao","tipoDocumento","emissao","validade","recebimento"] as const;
function snapshot(row:Record<string,unknown>) { return Object.fromEntries(fields.map(field=>[field,row[field] instanceof Date?(row[field] as Date).toISOString().slice(0,10):row[field]??null])); }

export async function editarCertificado({importacaoId,itemId,dados,atualizadoEm,usuarioId,usuarioNome,db=prisma}:{importacaoId:number;itemId:number;dados:unknown;atualizadoEm:unknown;usuarioId:number;usuarioNome:string;db?:PrismaClient}) {
  if(!dados||typeof dados!=="object"||Array.isArray(dados))throw new CertificadoError("Dados de edição inválidos.");
  if(typeof atualizadoEm!=="string"||!Number.isFinite(Date.parse(atualizadoEm)))throw new CertificadoError("Atualize o certificado antes de editar.",409);
  const input=dados as Record<string,unknown>;
  for(const field of fields)if(typeof input[field]!=="string"||(input[field] as string).length>500)throw new CertificadoError(`Campo ${field} inválido ou muito longo.`);
  const text=(key:typeof fields[number])=>(input[key] as string).trim().replace(/\s+/g," ");
  const data={matricula:normalizeMatricula(text("matricula")),nome:text("nome")||null,certificadora:text("certificadora")||null,qualificacao:text("qualificacao"),tipoDocumento:text("tipoDocumento"),emissao:parseDate(text("emissao")),validade:parseDate(text("validade")),recebimento:parseDate(text("recebimento"))};
  const linha:LinhaPlanilha={...data,numeroLinha:0,qualificacaoNormalizada:normalizeText(data.qualificacao),tipoDocumentoNormalizado:normalizeText(data.tipoDocumento),chaveIdempotencia:"",dadosOriginais:{},status:"PENDENTE_ENVIO",motivoErro:null};
  linha.chaveIdempotencia=buildChaveIdempotencia(linha);
  const errors=validarLinha(linha);
  if(!isUnspecifiedValidity(text("validade"))&&!data.validade)errors.push("Validade inválida");
  if(text("recebimento")&&!data.recebimento)errors.push("Recebimento inválido");
  if(errors.length)throw new CertificadoError(errors.join("; "));
  return db.$transaction(async tx=>{
    await lockCertificadoEnvironment(tx,certificateEnvironment());
    await assertCertificadoVersionEditable(tx,importacaoId);
    const item=await tx.importacaoCertificadoDrakeItem.findUnique({where:{id:itemId}});
    if(!item||item.importacaoId!==importacaoId)throw new CertificadoError("Certificado não encontrado neste carregamento.",404);
    if(!CERTIFICADO_EDITABLE_STATUS.includes(item.status))throw new CertificadoError("Não é permitido editar um certificado enviado, confirmado ou com processamento incerto.",409);
    if(item.updatedAt.getTime()!==new Date(atualizadoEm).getTime())throw new CertificadoError("Este certificado foi alterado. Atualize a página antes de salvar.",409);
    const uncertain=await tx.importacaoCertificadoDrakeTentativa.count({where:{itemId,status:{in:["ENVIANDO","ENVIADO","CONFIRMADO","NAO_CONFIRMADO"]}}});
    if(uncertain)throw new CertificadoError("Este registro possui uma tentativa aceita ou incerta. Confira o Drake antes de qualquer alteração.",409);
    const funcionario=await tx.funcionario.findUnique({where:{matricula:data.matricula},select:{id:true}});
    if(!funcionario)throw new CertificadoError("Funcionário não encontrado na base do Crew.");
    const others=await tx.importacaoCertificadoDrakeItem.findMany({where:{id:{not:itemId},chaveIdempotencia:linha.chaveIdempotencia,importacao:{ambiente:certificateEnvironment()}},select:{importacaoId:true,status:true,validade:true,recebimento:true}});
    const history=certificadoHistoryDecision(others,data,importacaoId);
    if(history){linha.status=history.status;linha.motivoErro=history.motivo;}
    const checks=await checkReferenceBatch(tx,certificateEnvironment(),[{...linha,key:String(itemId)}],true);
    await saveReferenceChecks(tx,importacaoId,checks,"id");
    const check=checks.get(String(itemId));
    if(linha.status==="PENDENTE_ENVIO"&&check&&check.status!=="NOVO"){linha.status=check.status;linha.motivoErro=check.motivo;}
    const updated=await tx.importacaoCertificadoDrakeItem.updateMany({where:{id:itemId,updatedAt:item.updatedAt},data:{...data,funcionarioId:funcionario.id,qualificacaoNormalizada:linha.qualificacaoNormalizada,tipoDocumentoNormalizado:linha.tipoDocumentoNormalizado,chaveIdempotencia:linha.chaveIdempotencia,status:linha.status,motivoErro:linha.motivoErro,payload:linha.status==="PENDENTE_ENVIO"?buildPayloadDrake(linha):Prisma.JsonNull}});
    if(updated.count!==1)throw new CertificadoError("Edição concorrente detectada. Atualize o certificado.",409);
    const anterior=JSON.stringify(snapshot(item)),novo=JSON.stringify(snapshot(data));
    await tx.$executeRaw`INSERT INTO "DrakeCertificadoItemEdicao" (id,"itemId","usuarioId","usuarioNome",anterior,novo) VALUES (${randomUUID()}::uuid,${itemId},${usuarioId},${usuarioNome},${anterior}::jsonb,${novo}::jsonb)`;
    const importacao=await resumirImportacaoCertificadosDrake(tx,importacaoId);
    return {item:await tx.importacaoCertificadoDrakeItem.findUniqueOrThrow({where:{id:itemId}}),importacao};
  },{timeout:30000});
}
