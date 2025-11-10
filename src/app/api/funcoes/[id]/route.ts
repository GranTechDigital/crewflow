import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET - Buscar função por ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    const id = parseInt(idParam);

    if (isNaN(id)) {
      return NextResponse.json(
        {
          success: false,
          message: 'ID inválido',
        },
        { status: 400 }
      );
    }

    const funcao = await prisma.funcao.findUnique({
      where: { id },
    });

    if (!funcao) {
      return NextResponse.json(
        {
          success: false,
          message: 'Função não encontrada',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: funcao,
    });

  } catch (error) {
    console.error('Erro ao buscar função:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Erro ao buscar função',
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}

// PUT - Atualizar função
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    const id = parseInt(idParam);
    const body = await request.json();
    const { funcao, regime } = body;

    if (isNaN(id)) {
      return NextResponse.json(
        {
          success: false,
          message: 'ID inválido',
        },
        { status: 400 }
      );
    }

    // Validações
    if (!funcao || !regime) {
      return NextResponse.json(
        {
          success: false,
          message: 'Função e regime são obrigatórios',
        },
        { status: 400 }
      );
    }

    // Verificar se a função existe
    const funcaoAtual = await prisma.funcao.findUnique({
      where: { id },
    });

    if (!funcaoAtual) {
      return NextResponse.json(
        {
          success: false,
          message: 'Função não encontrada',
        },
        { status: 404 }
      );
    }

    // Verificar se já existe outra função com o mesmo nome e regime
    const funcaoExistente = await prisma.funcao.findFirst({
      where: {
        funcao: funcao.trim(),
        regime: regime.trim(),
        NOT: { id: Number(id) },
      },
    });

    if (funcaoExistente) {
      return NextResponse.json(
        {
          success: false,
          message: 'Já existe outra função com este nome e regime',
        },
        { status: 409 }
      );
    }

    // Atualizar função
    const funcaoAtualizada = await prisma.funcao.update({
      where: { id },
      data: {
        funcao: funcao.trim(),
        regime: regime.trim(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Função atualizada com sucesso',
      data: funcaoAtualizada,
    });

  } catch (error) {
    console.error('Erro ao atualizar função:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Erro ao atualizar função',
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}

// DELETE - Excluir função
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    const id = parseInt(idParam);

    if (isNaN(id)) {
      return NextResponse.json(
        {
          success: false,
          message: 'ID inválido',
        },
        { status: 400 }
      );
    }

    // Verificar se a função existe
    const funcaoExistente = await prisma.funcao.findUnique({
      where: { id },
    });

    if (!funcaoExistente) {
      return NextResponse.json(
        {
          success: false,
          message: 'Função não encontrada',
        },
        { status: 404 }
      );
    }

    // Excluir função
    await prisma.funcao.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Função excluída com sucesso',
    });

  } catch (error) {
    console.error('Erro ao excluir função:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Erro ao excluir função',
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}