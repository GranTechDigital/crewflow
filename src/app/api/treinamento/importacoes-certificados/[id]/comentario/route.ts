import { NextRequest, NextResponse } from "next/server";
import { authorizeCertificados, certificadoFailure, readCertificadoBody } from "@/lib/integracoes/certificadosDrakeApi";
import { CertificadoError } from "@/lib/integracoes/certificadosDrakeShared";
import { salvarComentarioCarregamento } from "@/lib/integracoes/certificadosDrakeVersions";
export async function PATCH(request:NextRequest,{params}:{params:Promise<{id:string}>}) {
  try {
    const user=await authorizeCertificados(request,true),importacaoId=Number((await params).id);
    if(!Number.isSafeInteger(importacaoId)||importacaoId<=0)throw new CertificadoError("Carregamento inválido.");
    const body=JSON.parse((await readCertificadoBody(request,20000)).toString("utf8"));
    if(!body||typeof body!=="object"||Array.isArray(body))throw new CertificadoError("Dados inválidos.");
    const historico=await salvarComentarioCarregamento({importacaoId,texto:body.texto,atualizadoEm:body.atualizadoEm,usuarioId:user.id,usuarioNome:user.funcionario.nome});
    return NextResponse.json({historico,mensagem:"Descrição do carregamento salva. Ela é compartilhada por todas as versões e não é enviada ao Drake."});
  }catch(error){return certificadoFailure(error instanceof SyntaxError?new CertificadoError("JSON inválido."):error);}
}
