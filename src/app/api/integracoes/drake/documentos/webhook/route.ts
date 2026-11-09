import { NextRequest,NextResponse } from "next/server";
import {prisma} from "@/lib/prisma";
import {readCertificadoBody,certificadoFailure} from "@/lib/integracoes/certificadosDrakeApi";
import {CertificadoError} from "@/lib/integracoes/certificadosDrakeShared";
import {configuration,authorized,receive} from "../../../../../../../scripts/lib/drake-document-delivery.cjs";
export const runtime="nodejs";
export async function POST(request:NextRequest){
 try{
  let config;try{config=configuration();}catch{throw new CertificadoError("Recebimento de documentos não configurado.",503);}
  if(!authorized(request.headers.get("authorization"),config.token))throw new CertificadoError("Credencial inválida.",401);
  if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type")||'')||request.headers.get("content-encoding"))throw new CertificadoError("Envie JSON sem compressão.",415);
  let body;try{body=JSON.parse((await readCertificadoBody(request,65536)).toString('utf8'));}catch(error){if(error instanceof CertificadoError)throw error;throw new CertificadoError("JSON inválido.");}
  try{return NextResponse.json(await receive(prisma,body,config),{status:202,headers:{"Cache-Control":"no-store"}});}catch(error){if(error instanceof Error&&/^[A-Z_]+$/.test(error.message))throw new CertificadoError(error.message);throw error;}
 }catch(error){return certificadoFailure(error);}
}
