import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET - Listar todos os status mappings
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categoria = searchParams.get('categoria');
    const ativo = searchParams.get('ativo');

    const where: any = {};
    
    if (categoria) {
      where.status = {
        categoria: categoria
      };
    }
    
    if (ativo !== null) {
      where.ativo = ativo === 'true';
    }

    const statusMappings = await prisma.statusMapping.findMany({
      where,
      include: {
        status: true
      },
      orderBy: [
        { statusGeral: 'asc' }
      ]
    });

    // Buscar categorias únicas para filtros
    const categorias = await prisma.status.findMany({
      select: { categoria: true },
      distinct: ['categoria'],
      orderBy: { categoria: 'asc' }
    });

    // Transformar dados para o formato esperado pela página
    const statusMappingsFormatted = statusMappings.map(sm => ({
      id: sm.id,
      statusGeral: sm.statusGeral,
      categoria: sm.status.categoria,
      ativo: sm.ativo,
      createdAt: sm.createdAt.toISOString(),
      updatedAt: sm.updatedAt.toISOString()
    }));

    return NextResponse.json({
      status: statusMappingsFormatted,
      categorias: categorias.map(c => c.categoria),
      total: statusMappingsFormatted.length
    });
  } catch (error) {
    console.error("Erro ao buscar status mappings:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

// POST - Criar novo status mapping
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { statusGeral, categoria, ativo = true } = body;

    if (!statusGeral || !categoria) {
      return NextResponse.json(
        { error: "Status geral e categoria são obrigatórios" },
        { status: 400 }
      );
    }

    // Verificar se já existe
    const existente = await prisma.statusMapping.findUnique({
      where: { statusGeral }
    });

    if (existente) {
      return NextResponse.json(
        { error: "Status mapping já existe" },
        { status: 409 }
      );
    }

    // Buscar ou criar o status (categoria)
    let status = await prisma.status.findUnique({
      where: { categoria }
    });

    if (!status) {
      status = await prisma.status.create({
        data: { categoria: categoria.trim() }
      });
    }

    // Criar o status mapping
    const novoStatusMapping = await prisma.statusMapping.create({
      data: {
        statusGeral: statusGeral.trim(),
        statusId: status.id,
        ativo
      },
      include: {
        status: true
      }
    });

    // Retornar no formato esperado
    const formatted = {
      id: novoStatusMapping.id,
      statusGeral: novoStatusMapping.statusGeral,
      categoria: novoStatusMapping.status.categoria,
      ativo: novoStatusMapping.ativo,
      createdAt: novoStatusMapping.createdAt.toISOString(),
      updatedAt: novoStatusMapping.updatedAt.toISOString()
    };

    return NextResponse.json(formatted, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar status mapping:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}