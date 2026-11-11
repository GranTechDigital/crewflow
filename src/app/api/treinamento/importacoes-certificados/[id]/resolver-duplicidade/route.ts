import {NextRequest,NextResponse} from "next/server";
import {authorizeCertificados,certificadoFailure,readCertificadoBody} from "@/lib/integracoes/certificadosDrakeApi";
import {resolverDuplicidadeManualmente} from "@/lib/integracoes/certificadosDrakeOutcome";
import {CertificadoError,publicCertificadoBatch} from "@/lib/integracoes/certificadosDrakeShared";
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 try{const user=await authorizeCertificados(request,true),importacaoId=Number((await params).id);if(!Number.isSafeInteger(importacaoId)||importacaoId<1)throw new CertificadoError("Carregamento inválido.");
 const body=JSON.parse((await readCertificadoBody(request,8192)).toString("utf8"));if(!body||typeof body!=="object"||Array.isArray(body))throw new CertificadoError("Dados inválidos.");
 const result=await resolverDuplicidadeManualmente({importacaoId,itemId:body.itemId,confirmar:body.confirmar,usuarioId:user.id,usuarioNome:user.funcionario.nome});return NextResponse.json({importacao:publicCertificadoBatch(result.importacao),mensagem:"Pendência encerrada no Crew. A situação no Drake não foi verificada."});
 }catch(error){return certificadoFailure(error instanceof SyntaxError?new CertificadoError("JSON inválido."):error);}
}
