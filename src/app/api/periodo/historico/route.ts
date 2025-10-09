import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  try {
    const uploads = await prisma.periodoUpload.findMany({
      orderBy: [
        { anoReferencia: 'desc' },
        { mesReferencia: 'desc' },
        { dataUpload: 'desc' }
      ],
      include: {
        funcionario: {
          select: {
            nome: true
          }
        }
      }
    });

    const uploadsFormatados = uploads.map(upload => ({
      id: upload.id,
      dataUpload: upload.dataUpload,
      dataRelatorio: upload.dataRelatorio,
      nomeArquivo: upload.nomeArquivo,
      registros: upload.registros,
      atualizados: upload.atualizados,
      naoEncontrados: upload.naoEncontrados,
      uploadPor: upload.funcionario?.nome || 'Sistema',
      mesReferencia: upload.mesReferencia,
      anoReferencia: upload.anoReferencia,
      periodoInicial: upload.periodoInicial,
      periodoFinal: upload.periodoFinal,
      totalDiasPeriodo: upload.totalDiasPeriodo
    }));

    return NextResponse.json(uploadsFormatados);
  } catch (error) {
    console.error("Erro ao buscar histórico de período:", error);
    return NextResponse.json(
      { message: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}