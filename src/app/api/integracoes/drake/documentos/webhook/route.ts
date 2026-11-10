import { NextRequest,NextResponse } from "next/server";
import {prisma} from "@/lib/prisma";
import {readCertificadoBody,certificadoFailure} from "@/lib/integracoes/certificadosDrakeApi";
import {CertificadoError} from "@/lib/integracoes/certificadosDrakeShared";
import {configuration,authorized,receive,recordReceiptAttempt} from "../../../../../../../scripts/lib/drake-document-delivery.cjs";
export const runtime="nodejs";
export async function POST(request:NextRequest){
 let config:ReturnType<typeof configuration>|null=null,raw=Buffer.alloc(0),auditCode="FALHA_INTERNA";
 try{
  try{config=configuration();}catch{throw new CertificadoError("Recebimento de documentos não configurado.",503);}
  try{raw=await readCertificadoBody(request,65536);}catch(error){auditCode=error instanceof CertificadoError&&error.status===413?"CORPO_MUITO_GRANDE":"CORPO_INVALIDO";throw error;}
  if(!authorized(request.headers.get("authorization"),config.token)){auditCode="CREDENCIAL_INVALIDA";throw new CertificadoError("Credencial inválida.",401);}
  if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type")||'')||request.headers.get("content-encoding")){auditCode="CONTENT_TYPE_INVALIDO";throw new CertificadoError("Envie JSON sem compressão.",415);}
  let body;try{body=JSON.parse(raw.toString('utf8'));}catch{auditCode="JSON_INVALIDO";throw new CertificadoError("JSON inválido.");}
  try{
   const result=await receive(prisma,body,config);
   await recordReceiptAttempt(prisma,config,{route:request.nextUrl.pathname,status:200,code:"ACEITO",body:raw}).catch(()=>undefined);
   return NextResponse.json({received:true,...result},{status:200,headers:{"Cache-Control":"no-store"}});
  }catch(error){if(error instanceof Error&&/^[A-Z_]+$/.test(error.message)){auditCode=error.message;throw new CertificadoError(error.message);}throw error;}
 }catch(error){
  const response=certificadoFailure(error);
  if(config)await recordReceiptAttempt(prisma,config,{route:request.nextUrl.pathname,status:response.status,code:auditCode,body:raw}).catch(()=>undefined);
  return response;
 }
}
