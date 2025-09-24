import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET - Buscar centro de custo por ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);

    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'ID inválido' },
        { status: 400 }
      );
    }

    const centroCusto = await prisma.centroCustoProjeto.findUnique({
      where: { id }
    });

    if (!centroCusto) {
      return NextResponse.json(
        { error: 'Centro de custo não encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json(centroCusto);

  } catch (error) {
    console.error('Erro ao buscar centro de custo:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// PUT - Atualizar centro de custo
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);

    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'ID inválido' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { cc, ccProjeto, nomeCc, ccNome, projeto, grupo1, grupo2, ativo } = body;

    if (!cc || !nomeCc) {
      return NextResponse.json(
        { error: 'CC e Nome CC são obrigatórios' },
        { status: 400 }
      );
    }

    const centroCusto = await prisma.centroCustoProjeto.update({
      where: { id },
      data: {
        cc,
        ccProjeto: ccProjeto || cc,
        nomeCc,
        ccNome: ccNome || `${cc} | ${nomeCc}`,
        projeto: projeto || '',
        grupo1: grupo1 || '',
        grupo2: grupo2 || '',
        ativo: ativo !== undefined ? ativo : true
      }
    });

    return NextResponse.json(centroCusto);

  } catch (error: any) {
    console.error('Erro ao atualizar centro de custo:', error);
    
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'CC já existe' },
        { status: 409 }
      );
    }

    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Centro de custo não encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// DELETE - Excluir centro de custo
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);

    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'ID inválido' },
        { status: 400 }
      );
    }

    await prisma.centroCustoProjeto.delete({
      where: { id }
    });

    return NextResponse.json({ message: 'Centro de custo excluído com sucesso' });

  } catch (error: any) {
    console.error('Erro ao excluir centro de custo:', error);
    
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Centro de custo não encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}