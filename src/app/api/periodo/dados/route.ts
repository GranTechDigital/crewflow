import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    console.log("=== DEBUG: Verificando dados da periodoSheet ===");
    
    // Contar registros
    const countSheets = await prisma.periodoSheet.count();
    const countUploads = await prisma.periodoUpload.count();
    
    console.log(`Total PeriodoSheets: ${countSheets}`);
    console.log(`Total PeriodoUploads: ${countUploads}`);
    
    // Buscar alguns dados da periodoSheet (usando tabelas otimizadas)
    const periodoSheets = await prisma.periodoSheet.findMany({
      take: 5,
      include: {
        status: true,
        projeto: true
      },
      orderBy: [
        { anoReferencia: 'desc' },
        { mesReferencia: 'desc' },
        { matricula: 'asc' }
      ]
    });

    // Buscar todos os uploads
    const periodoUploads = await prisma.periodoUpload.findMany({
      orderBy: [
        { anoReferencia: 'desc' },
        { mesReferencia: 'desc' },
        { dataUpload: 'desc' }
      ]
    });

    return NextResponse.json({
      success: true,
      data: {
        totalSheets: countSheets,
        totalUploads: countUploads,
        sampleSheets: periodoSheets,
        uploads: periodoUploads
      }
    });
  } catch (error) {
    console.error("Erro ao buscar dados de período:", error);
    return NextResponse.json(
      { message: "Erro interno do servidor", error: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    );
  }
}