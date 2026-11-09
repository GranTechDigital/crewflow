import {certificateEnvironment} from "@/lib/integracoes/certificadosDrakeEnvironment";
import { outcomeCounts } from "@/lib/integracoes/certificadosDrakeOutcome";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeCertificados, certificadoFailure, certificadoXlsx } from "@/lib/integracoes/certificadosDrakeApi";
import { CERTIFICADO_MAX_ROWS, CertificadoError, certificadoPage, publicCertificadoBatch } from "@/lib/integracoes/certificadosDrakeShared";
import { certificadoWorkbook } from "@/lib/integracoes/certificadosDrakeWorkbook";
import { Prisma } from "@prisma/client";
import { certificadoVersionInfo, certificadoEdicoes } from "@/lib/integracoes/certificadosDrakeVersions";
import { referenceSource } from "@/lib/integracoes/certificadosDrakeReference";

export const dynamic = "force-dynamic";

function pagination(searchParams: URLSearchParams) {
  const page = certificadoPage(searchParams.get("page"), 1, 1000000);
  const limit = certificadoPage(searchParams.get("limit"), 50, 100);
  return { page, limit, skip: (page - 1) * limit };
}

function containsInsensitive(value: string) {
  return { contains: value, mode: "insensitive" as const };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await authorizeCertificados(request);
    const { id } = await params;
    const importacaoId = Number(id);
    if (!Number.isInteger(importacaoId) || importacaoId <= 0) {
      return NextResponse.json({ error: "Importação inválida" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = pagination(searchParams);
    const status = searchParams.get("status")?.trim();
    const q = searchParams.get("q")?.trim();

    const importacao = await prisma.importacaoCertificadoDrake.findUnique({
      where: { id: importacaoId },
      include: {
        usuario: {
          select: {
            id: true,
            funcionario: {
              select: {
                nome: true,
                matricula: true,
              },
            },
            equipe: {
              select: {
                nome: true,
              },
            },
          },
        },
      },
    });

    if (!importacao) {
      return NextResponse.json({ error: "Importação não encontrada" }, { status: 404 });
    }
    if (importacao.ambiente !== certificateEnvironment()) throw new CertificadoError("Consulta permitida somente a lotes deste ambiente.", 403);

    if (searchParams.has("relatorio")) {
      const report = searchParams.get("relatorio");
      if (!["resultado", "pendencias"].includes(report ?? "")) throw new CertificadoError("Relatório inválido.");
      if (importacao.totalLinhas > CERTIFICADO_MAX_ROWS) throw new CertificadoError("O lote excede o limite para exportação.");
      const filter = { importacaoId, ...(report === "pendencias" ? { status: { in: ["ERRO_VALIDACAO", "ERRO_DRAKE", "NAO_CONFIRMADO", "CONFLITO_ATUALIZACAO", "POSSIVEL_DUPLICIDADE", "REFERENCIA_INDISPONIVEL", "DUPLICADO_NO_ARQUIVO"] } } : {}) };
      const rows = [];
      for (let skip = 0; skip < CERTIFICADO_MAX_ROWS; skip += 500) {
        const chunk = await prisma.importacaoCertificadoDrakeItem.findMany({ where: filter, orderBy: { numeroLinha: "asc" }, skip, take: 500, include: { tentativasEnvio: { orderBy: { iniciadoEm: "desc" }, take: 1 } } });
        rows.push(...chunk); if (chunk.length < 500) break;
      }
      const versionInfo = await certificadoVersionInfo(prisma, importacaoId);
      const edited = await prisma.$queryRaw<{itemId:number}[]>`SELECT DISTINCT e."itemId" FROM "DrakeCertificadoItemEdicao" e JOIN "ImportacaoCertificadoDrakeItem" i ON i.id=e."itemId" WHERE i."importacaoId"=${importacaoId}`;
      const editedIds = new Set(edited.map(row=>row.itemId));
      const terminal=(await outcomeCounts(prisma,[importacaoId])).get(importacaoId);
      const reportRows = rows.map(row=>editedIds.has(row.id)?{...row,dadosOriginais:null}:row);
      return certificadoXlsx(await certificadoWorkbook(reportRows, { descricaoCarregamento: versionInfo.comentario?.texto ?? "", cancelados:terminal?.totalCanceladas??0,resolvidosEmOutroArquivo:terminal?.totalResolvidasOutroArquivo??0, carregamentoOriginal: versionInfo.raizId, lote: importacao.id, ambiente: importacao.ambiente, arquivo: importacao.nomeArquivo, situacao: importacao.status, total: importacao.totalLinhas, pendentes: importacao.totalPendentes, enviados: importacao.totalEnviadas, confirmados: importacao.totalConfirmadas, naoConfirmados: importacao.totalNaoConfirmadas, erros: importacao.totalErroValidacao + importacao.totalErroDrake, observacao: "ENVIADO não é confirmação no Drake. Itens não confirmados exigem conferência antes de reenviar." }), `certificados-${report}-${importacaoId}.xlsx`);
    }

    const where = {
      importacaoId,
      ...(status && status !== "TODOS" ? { status: status === "PENDENCIAS" ? { in: ["ERRO_VALIDACAO", "ERRO_DRAKE", "NAO_CONFIRMADO", "CONFLITO_ATUALIZACAO", "POSSIVEL_DUPLICIDADE", "REFERENCIA_INDISPONIVEL", "DUPLICADO_NO_ARQUIVO"] } : status } : {}),
      ...(q
        ? {
            OR: [
              { matricula: containsInsensitive(q) },
              { nome: containsInsensitive(q) },
              { qualificacao: containsInsensitive(q) },
              { tipoDocumento: containsInsensitive(q) },
            ],
          }
        : {}),
    };

    const [totalItens, itens] = await Promise.all([
      prisma.importacaoCertificadoDrakeItem.count({ where }),
      prisma.importacaoCertificadoDrakeItem.findMany({
        where,
        orderBy: [{ numeroLinha: "asc" }],
        skip,
        take: limit,
        include: {
          funcionario: {
            select: {
              id: true,
              nome: true,
              matricula: true,
              status: true,
              statusPrestserv: true,
            },
          },
          tentativasEnvio: {
            orderBy: { iniciadoEm: "desc" },
            take: 3,
            select: { id: true, status: true, usuarioId: true, usuarioNome: true, iniciadoEm: true, finalizadoEm: true, httpStatus: true, duracaoMs: true, erro: true },
          },
        },
      }),
    ]);

    const checks = itens.length ? await prisma.$queryRaw<{ itemId: number; status: string; versao: number | null; motivo: string | null; totalCandidatos: number; candidatos: unknown; conferidoEm: Date }[]>(Prisma.sql`SELECT "itemId",status,versao,motivo,"totalCandidatos",candidatos,"conferidoEm" FROM "DrakeDocumentoConferencia" WHERE "itemId" IN (${Prisma.join(itens.map(item => item.id))})`) : [];
    const [reference,historico,edicoes] = await Promise.all([referenceSource(prisma, importacao.ambiente),certificadoVersionInfo(prisma,importacaoId),certificadoEdicoes(prisma,itens.map(item=>item.id))]);
    const confirmations = reference.source && itens.length ? await prisma.$queryRaw<{itemId:number;status:string;documentoId:string|null;referenciaEm:Date;motivo:string}[]>(Prisma.sql`SELECT DISTINCT ON ("itemId") "itemId",status,"documentoId","referenciaEm",motivo FROM "DrakeCertificadoConfirmacao" WHERE "origemId"=${reference.source.id}::uuid AND "itemId" IN (${Prisma.join(itens.map(item=>item.id))}) ORDER BY "itemId","criadoEm" DESC,id DESC`) : [];
    const desfechos=await outcomeCounts(prisma,[importacaoId]);
    return NextResponse.json({
      importacao: {...publicCertificadoBatch(importacao),descricao:historico.comentario?.texto??"",...desfechos.get(importacaoId)},
      historico,
      itens: itens.map(item => ({ ...item, confirmacaoDrake: confirmations.find(row=>row.itemId===item.id)??null, historicoEdicoes: edicoes.filter(edicao=>edicao.itemId===item.id).map(edicao=>({id:edicao.id,usuarioNome:edicao.usuarioNome,criadoEm:edicao.criadoEm,camposAlterados:Object.keys(edicao.novo).filter(key=>JSON.stringify(edicao.anterior[key])!==JSON.stringify(edicao.novo[key]))})), conferenciaReferencia: checks.find(check => check.itemId === item.id) ?? null })),
      referencia: { disponivel: !reference.reason, motivo: reference.reason, versao: reference.source?.versao ?? null, atualizadoEm: reference.source?.atualizadoEm ?? null },
      totalItens,
      page,
      limit,
      totalPages: Math.ceil(totalItens / limit),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return certificadoFailure(error);
  }
}
