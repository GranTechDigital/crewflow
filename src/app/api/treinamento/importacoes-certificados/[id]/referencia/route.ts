import {certificateEnvironment} from "@/lib/integracoes/certificadosDrakeEnvironment";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeCertificados, certificadoFailure } from "@/lib/integracoes/certificadosDrakeApi";
import { certificadoPage, CertificadoError } from "@/lib/integracoes/certificadosDrakeShared";
import { referenceCandidatesPage } from "@/lib/integracoes/certificadosDrakeReference";
import { latestDeletionStatuses } from "@/lib/integracoes/certificadosDrakeDelete";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await authorizeCertificados(request);
    const importacaoId = Number((await params).id), itemId = Number(request.nextUrl.searchParams.get("itemId"));
    if (![importacaoId,itemId].every(id => Number.isSafeInteger(id) && id > 0)) throw new CertificadoError("Importação ou item inválido.");
    const item = await prisma.importacaoCertificadoDrakeItem.findFirst({ where: { id: itemId, importacaoId }, include: { importacao: { select: { ambiente: true } } } });
    if (!item || item.importacao.ambiente !== certificateEnvironment()) throw new CertificadoError("Item não encontrado.", 404);
    const page = certificadoPage(request.nextUrl.searchParams.get("page"),1,100000), limit = certificadoPage(request.nextUrl.searchParams.get("limit"),5,20);
    const result = await referenceCandidatesPage(prisma,item.importacao.ambiente,{ ...item,key:String(item.id) },page,limit);
    const deletions = await latestDeletionStatuses(prisma,item.importacao.ambiente,result.candidatos.map(row=>row.id));
    return NextResponse.json({ ...result,matricula:item.matricula,nome:item.nome,ambiente:item.importacao.ambiente,candidatos:result.candidatos.map(row=>({ ...row,exclusao:deletions.find(deletion=>deletion.documentoId===row.id) ?? null })) },{ headers: { "Cache-Control":"private, no-store" } });
  } catch (error) { return certificadoFailure(error); }
}
