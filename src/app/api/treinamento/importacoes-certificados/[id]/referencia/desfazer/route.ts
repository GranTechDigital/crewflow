import { NextRequest,NextResponse } from "next/server";
import { authorizeCertificados,certificadoFailure,readCertificadoBody } from "@/lib/integracoes/certificadosDrakeApi";
import { restoreCertificateDeletion } from "@/lib/integracoes/certificadosDrakeDelete";
import { CertificadoError } from "@/lib/integracoes/certificadosDrakeShared";
export const dynamic="force-dynamic";
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  try{
    const user=await authorizeCertificados(request,true);let body;
    try{body=JSON.parse((await readCertificadoBody(request,2048)).toString("utf8"));}catch(error){if(error instanceof CertificadoError)throw error;throw new CertificadoError("JSON inválido.");}
    if(!body||typeof body!=="object"||Array.isArray(body))throw new CertificadoError("Solicitação inválida.");
    const result=await restoreCertificateDeletion({importacaoId:Number((await params).id),itemId:body.itemId,exclusaoId:body.exclusaoId,confirmar:body.confirmar,usuarioId:user.id,usuarioNome:user.funcionario.nome});
    return NextResponse.json(result,{headers:{"Cache-Control":"private, no-store"}});
  }catch(error){return certificadoFailure(error);}
}
