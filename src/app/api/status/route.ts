import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

// GET - Listar todos os status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categoria = searchParams.get('categoria');
    const ativo = searchParams.get('ativo');

    const where: Prisma.StatusWhereInput = {};
    
    if (categoria) {
      where.categoria = categoria;
    }
    
    if (ativo !== null) {
      where.ativo = ativo === 'true';
    }

    const status = await prisma.status.findMany({
      where,
      orderBy: [
        { categoria: 'asc' }
      ],
      include: {
        statusMappings: true // Incluir mapeamentos se necessário
      }
    });

    // Buscar categorias únicas para filtros
    const categorias = await prisma.status.findMany({
      select: { categoria: true },
      distinct: ['categoria'],
      orderBy: { categoria: 'asc' }
    });

    return NextResponse.json({
      status,
      categorias: categorias.map(c => c.categoria),
      total: status.length
    });
  } catch (error) {
    console.error("Erro ao buscar status:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

// POST - Criar novo status
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { categoria, statusGeral } = body;

    if (!categoria) {
      return NextResponse.json(
        { error: "Categoria é obrigatória" },
        { status: 400 }
      );
    }

    // Verificar se já existe
    const existente = await prisma.status.findUnique({
      where: { categoria }
    });

    if (existente) {
      return NextResponse.json(
        { error: "Status já existe" },
        { status: 409 }
      );
    }

    const novoStatus = await prisma.status.create({
      data: {
        categoria: categoria.trim()
      }
    });

    // Se statusGeral foi fornecido, criar o mapeamento
    if (statusGeral) {
      await prisma.statusMapping.create({
        data: {
          statusGeral: statusGeral.trim(),
          statusId: novoStatus.id
        }
      });
    }

    return NextResponse.json(novoStatus, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar status:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}