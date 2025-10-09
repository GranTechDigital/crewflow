import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Buscar tarefa padrão por ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    const id = parseInt(idParam);
    
    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'ID inválido' },
        { status: 400 }
      );
    }

    const tarefaPadrao = await prisma.tarefaPadrao.findUnique({
      where: { id }
    });

    if (!tarefaPadrao) {
      return NextResponse.json(
        { error: 'Tarefa padrão não encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json(tarefaPadrao);
  } catch (error) {
    console.error('Erro ao buscar tarefa padrão:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// PUT - Atualizar tarefa padrão
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    const id = parseInt(idParam);
    
    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'ID inválido' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { setor, tipo, descricao, ativo } = body;

    // Verificar se a tarefa existe
    const tarefaExistente = await prisma.tarefaPadrao.findUnique({
      where: { id }
    });

    if (!tarefaExistente) {
      return NextResponse.json(
        { error: 'Tarefa padrão não encontrada' },
        { status: 404 }
      );
    }

    // Se setor ou tipo foram alterados, verificar se não há conflito
    if ((setor && setor !== tarefaExistente.setor) || (tipo && tipo !== tarefaExistente.tipo)) {
      const conflito = await prisma.tarefaPadrao.findFirst({
        where: {
          setor: setor || tarefaExistente.setor,
          tipo: tipo || tarefaExistente.tipo,
          id: { not: id }
        }
      });

      if (conflito) {
        return NextResponse.json(
          { error: 'Já existe uma tarefa padrão com este setor e tipo' },
          { status: 409 }
        );
      }
    }

    const tarefaAtualizada = await prisma.tarefaPadrao.update({
      where: { id },
      data: {
        ...(setor && { setor }),
        ...(tipo && { tipo }),
        ...(descricao && { descricao }),
        ...(ativo !== undefined && { ativo })
      }
    });

    return NextResponse.json(tarefaAtualizada);
  } catch (error) {
    console.error('Erro ao atualizar tarefa padrão:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// DELETE - Excluir tarefa padrão
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    const id = parseInt(idParam);
    
    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'ID inválido' },
        { status: 400 }
      );
    }

    // Verificar se a tarefa existe
    const tarefaExistente = await prisma.tarefaPadrao.findUnique({
      where: { id }
    });

    if (!tarefaExistente) {
      return NextResponse.json(
        { error: 'Tarefa padrão não encontrada' },
        { status: 404 }
      );
    }

    await prisma.tarefaPadrao.delete({
      where: { id }
    });

    return NextResponse.json(
      { message: 'Tarefa padrão excluída com sucesso' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Erro ao excluir tarefa padrão:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}