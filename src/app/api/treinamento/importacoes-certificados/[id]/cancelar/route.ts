import {NextRequest,NextResponse} from "next/server";
import {authorizeCertificados,certificadoFailure,readCertificadoBody} from "@/lib/integracoes/certificadosDrakeApi";
import {cancelarCertificados} from "@/lib/integracoes/certificadosDrakeOutcome";
import {CertificadoError,publicCertificadoBatch} from "@/lib/integracoes/certificadosDrakeShared";
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 try{const user=await authorizeCertificados(request,true),importacaoId=Number((await params).id);if(!Number.isSafeInteger(importacaoId)||importacaoId<1)throw new CertificadoError("Carregamento inválido.");
 const body=JSON.parse((await readCertificadoBody(request,8192)).toString("utf8"));if(!body||typeof body!=="object"||Array.isArray(body))throw new CertificadoError("Dados inválidos.");
 const result=await cancelarCertificados({importacaoId,itemId:body.itemId,motivo:body.motivo,confirmar:body.confirmar,usuarioId:user.id,usuarioNome:user.funcionario.nome});return NextResponse.json({...result,importacao:publicCertificadoBatch(result.importacao),mensagem:`${result.cancelados} registro(s) cancelado(s) somente no Crew; ${result.resolvidos} atendido(s) por outro carregamento. Nenhum documento foi excluído no Drake. Resultados incertos permanecem para conferência.`});
 }catch(error){return certificadoFailure(error instanceof SyntaxError?new CertificadoError("JSON inválido."):error);}
}
