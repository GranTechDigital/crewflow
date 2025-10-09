import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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

    const treinamento = await prisma.treinamentos.findUnique({
      where: { id },
    });

    if (!treinamento) {
      return NextResponse.json(
        {
          success: false,
          message: 'Treinamento não encontrado',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: treinamento,
    });
  } catch (error) {
    console.error('Erro ao buscar treinamento:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Erro ao buscar treinamento',
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    const id = parseInt(idParam);
    const body = await request.json();
    const { treinamento, cargaHoraria, validadeValor, validadeUnidade } = body;

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
    if (!treinamento || !cargaHoraria || validadeValor === undefined || !validadeUnidade) {
      return NextResponse.json(
        {
          success: false,
          message: 'Todos os campos são obrigatórios',
        },
        { status: 400 }
      );
    }

    if (cargaHoraria <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'Carga horária deve ser maior que zero',
        },
        { status: 400 }
      );
    }

    if (validadeValor < 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'Valor de validade não pode ser negativo',
        },
        { status: 400 }
      );
    }

    // Verificar se o treinamento existe
    const treinamentoAtual = await prisma.treinamentos.findUnique({
      where: { id },
    });

    if (!treinamentoAtual) {
      return NextResponse.json(
        {
          success: false,
          message: 'Treinamento não encontrado',
        },
        { status: 404 }
      );
    }

    // Verificar se já existe outro treinamento com o mesmo nome
    const treinamentoExistente = await prisma.treinamentos.findFirst({
      where: {
        treinamento: treinamento.trim(),
        NOT: { id: id },
      },
    });

    if (treinamentoExistente) {
      return NextResponse.json(
        {
          success: false,
          message: 'Já existe outro treinamento com este nome',
        },
        { status: 409 }
      );
    }

    // Atualizar treinamento
    const treinamentoAtualizado = await prisma.treinamentos.update({
      where: { id },
      data: {
        treinamento: treinamento.trim(),
        cargaHoraria: parseInt(cargaHoraria),
        validadeValor: parseInt(validadeValor),
        validadeUnidade: validadeUnidade.trim(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Treinamento atualizado com sucesso',
      data: treinamentoAtualizado,
    });
  } catch (error) {
    console.error('Erro ao atualizar treinamento:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Erro ao atualizar treinamento',
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}

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

    // Verificar se o treinamento existe
    const treinamento = await prisma.treinamentos.findUnique({
      where: { id },
    });

    if (!treinamento) {
      return NextResponse.json(
        {
          success: false,
          message: 'Treinamento não encontrado',
        },
        { status: 404 }
      );
    }

    // Excluir treinamento
    await prisma.treinamentos.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Treinamento excluído com sucesso',
    });
  } catch (error) {
    console.error('Erro ao excluir treinamento:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Erro ao excluir treinamento',
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}