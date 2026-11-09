import { NextRequest, NextResponse } from "next/server";
import { authorizeCertificados, certificadoFailure, readCertificadoBody } from "@/lib/integracoes/certificadosDrakeApi";
import { CertificadoError, publicCertificadoBatch } from "@/lib/integracoes/certificadosDrakeShared";
import { editarCertificado } from "@/lib/integracoes/certificadosDrakeEditing";
import { enviarCertificadosPendentesDrake } from "@/lib/integracoes/certificadosDrakeSend";
export async function PATCH(request:NextRequest,{params}:{params:Promise<{id:string;itemId:string}>}) {
  try {
    const user=await authorizeCertificados(request,true),ids=await params,importacaoId=Number(ids.id),itemId=Number(ids.itemId);
    if(!Number.isSafeInteger(importacaoId)||importacaoId<=0||!Number.isSafeInteger(itemId)||itemId<=0)throw new CertificadoError("Certificado inválido.");
    const body=JSON.parse((await readCertificadoBody(request,20000)).toString("utf8"));
    if(!body||typeof body!=="object"||Array.isArray(body))throw new CertificadoError("Dados inválidos.");
    if(body.enviar!==undefined&&typeof body.enviar!=="boolean")throw new CertificadoError("Ação inválida.");
    if(body.enviar===true&&body.confirmar!==true)throw new CertificadoError("Confirme o envio ao Drake.");
    const actor={importacaoId,usuarioId:user.id,usuarioNome:user.funcionario.nome};
    const saved=await editarCertificado({...actor,itemId,dados:body.dados,atualizadoEm:body.atualizadoEm});
    if(body.enviar===true&&saved.item.status==="PENDENTE_ENVIO") {
      try { const envio=await enviarCertificadosPendentesDrake({...actor,itemIds:[itemId],limit:1});return NextResponse.json({salvo:true,envio,importacao:publicCertificadoBatch(envio.importacao),mensagem:`Correção salva. ${envio.enviados} enviado(s), ${envio.falhas} erro(s), ${envio.naoConfirmados} não confirmado(s) e ${envio.ignorados} desconsiderado(s). Confira o resultado no Drake.`}); }
      catch(error){return NextResponse.json({salvo:true,envioIncompleto:true,mensagem:`Correção salva. Não foi possível concluir o envio: ${error instanceof CertificadoError?error.message:"Consulte o histórico antes de repetir."}`});}
    }
    return NextResponse.json({salvo:true,item:saved.item,importacao:publicCertificadoBatch(saved.importacao),mensagem:body.enviar===true?`Correção salva, mas o envio ficou bloqueado: ${saved.item.motivoErro}`:"Correção salva e reanalisada. Nenhum envio foi realizado."});
  }catch(error){return certificadoFailure(error instanceof SyntaxError?new CertificadoError("JSON inválido."):error);}
}
