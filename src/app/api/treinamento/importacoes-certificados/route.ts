import {certificateEnvironment} from "@/lib/integracoes/certificadosDrakeEnvironment";
import { Prisma } from "@prisma/client";
import { certificadoDescricoes } from "@/lib/integracoes/certificadosDrakeVersions";
import { outcomeCounts } from "@/lib/integracoes/certificadosDrakeOutcome";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { criarImportacaoCertificadosDrake } from "@/lib/integracoes/certificadosDrakeImportacao";
import { authorizeCertificados, certificadoFailure, certificadoXlsx, readCertificadoBody } from "@/lib/integracoes/certificadosDrakeApi";
import { CERTIFICADO_MAX_BYTES, CertificadoError, certificadoPage, publicCertificadoBatch } from "@/lib/integracoes/certificadosDrakeShared";
import { certificadoWorkbook } from "@/lib/integracoes/certificadosDrakeWorkbook";

export const dynamic = "force-dynamic";

function pagination(searchParams: URLSearchParams) {
  const page = certificadoPage(searchParams.get("page"), 1, 1000000);
  const limit = certificadoPage(searchParams.get("limit"), 20, 100);
  return { page, limit, skip: (page - 1) * limit };
}

function containsInsensitive(value: string) {
  return { contains: value, mode: "insensitive" as const };
}

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    "arrayBuffer" in value &&
    typeof value.arrayBuffer === "function" &&
    "name" in value &&
    typeof value.name === "string"
  );
}

export async function GET(request: NextRequest) {
  try {
    await authorizeCertificados(request);
    const { searchParams } = new URL(request.url);
    if (searchParams.get("modelo") === "1") return certificadoXlsx(await certificadoWorkbook([]), "modelo-certificados.xlsx");
    const { page, limit, skip } = pagination(searchParams);
    const status = searchParams.get("status")?.trim();
    const ambiente = searchParams.get("ambiente")?.trim().toLowerCase() || certificateEnvironment();
    if (ambiente !== certificateEnvironment()) throw new CertificadoError("A consulta de certificados está disponível no ambiente configurado.");
    const q = searchParams.get("q")?.trim().slice(0, 100);
    const usuarioId = Number(searchParams.get("usuarioId") || 0);

    const descriptionMatches=q?await prisma.$queryRaw<{id:number}[]>(Prisma.sql`WITH RECURSIVE familia(id) AS (SELECT "raizId" FROM "DrakeCertificadoCarregamentoNota" WHERE texto ILIKE ${"%"+q+"%"} UNION ALL SELECT v."novaId" FROM "DrakeCertificadoVersao" v JOIN familia f ON v."anteriorId"=f.id) SELECT id FROM familia`):[];
    const where = {
      ...(status && status !== "TODOS" ? { status } : { status: { not: "SUBSTITUIDO" } }),
      ambiente,
      ...(usuarioId > 0 ? { usuarioId } : {}),
      ...(q
        ? {
            OR: [
              { nomeArquivo: containsInsensitive(q) },
              { hashArquivo: containsInsensitive(q) },
              { id: { in: descriptionMatches.map(row=>row.id) } },
            ],
          }
        : {}),
    };

    const [total, importacoes] = await Promise.all([
      prisma.importacaoCertificadoDrake.count({ where }),
      prisma.importacaoCertificadoDrake.findMany({
        where,
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
        orderBy: [{ createdAt: "desc" }],
        skip,
        take: limit,
      }),
    ]);

    const [descricoes,desfechos]=await Promise.all([certificadoDescricoes(prisma,importacoes.map(batch=>batch.id)),outcomeCounts(prisma,importacoes.map(batch=>batch.id))]);
    return NextResponse.json({
      ambiente,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      importacoes: importacoes.map(batch=>({...publicCertificadoBatch(batch),descricao:descricoes.get(batch.id)??"",...desfechos.get(batch.id)})),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return certificadoFailure(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authorizeCertificados(request, true);
    const bytes = await readCertificadoBody(request, CERTIFICADO_MAX_BYTES + 65536);
    let formData: FormData;
    try { formData = await new Request(request.url, { method: "POST", headers: { "Content-Type": request.headers.get("content-type") ?? "" }, body: new Uint8Array(bytes) }).formData(); }
    catch { throw new CertificadoError("Envie a planilha como formulário multipart."); }
    const file = formData.get("file");
    const ambiente = String(formData.get("ambiente") || certificateEnvironment()).trim().toLowerCase();
    if (!isUploadedFile(file)) {
      return NextResponse.json({ error: "Nenhum arquivo foi enviado" }, { status: 400 });
    }
    if (file.size > CERTIFICADO_MAX_BYTES) throw new CertificadoError("O arquivo deve ter no máximo 5 MB.", 413);

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      return NextResponse.json(
        { error: "Formato inválido. Envie uma planilha .xlsx" },
        { status: 400 },
      );
    }

    const correction = formData.get("substituiImportacaoId");
    const substituiImportacaoId = correction === null ? undefined : Number(correction);
    if (substituiImportacaoId !== undefined && (!Number.isSafeInteger(substituiImportacaoId) || substituiImportacaoId <= 0)) throw new CertificadoError("Carregamento anterior inválido.");
    const resultado = await criarImportacaoCertificadosDrake({
      file,
      usuarioId: user.id,
      usuarioNome: user.funcionario.nome,
      substituiImportacaoId,
      descricao: typeof formData.get("descricao")==="string" ? String(formData.get("descricao")) : undefined,
      ambiente: ambiente || certificateEnvironment(),
    });

    return NextResponse.json(resultado, { status: resultado.jaExistia ? 200 : 201 });
  } catch (error) {
    return certificadoFailure(error);
  }
}
