import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Função auxiliar para aceitar Promise ou objeto direto
async function getParams(params: { id: string } | Promise<{ id: string }>): Promise<{ id: string }> {
  return params instanceof Promise ? await params : params;
}

// GET /api/pendencias/[id]
export async function GET(
  request: NextRequest,
  context: { params: { id: string } } | { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await getParams(context.params);

    const pendencia = await prisma.pendencia.findUnique({
      where: { id: Number(id) },
      include: { observacoes: true },
    });

    if (!pendencia) {
      return NextResponse.json({ error: 'Pendência não encontrada' }, { status: 404 });
    }

    return NextResponse.json(pendencia);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: 'Erro ao buscar pendência', details: message }, { status: 500 });
  }
}

// PUT /api/pendencias/[id]
export async function PUT(
  request: NextRequest,
  context: { params: { id: string } } | { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await getParams(context.params);
    const data = await request.json();

    const pendenciaAtualizada = await prisma.pendencia.update({
      where: { id: Number(id) },
      data: {
        tipo: data.tipo,
        descricao: data.descricao,
        equipe: data.equipe,
        status: data.status,
        prioridade: data.prioridade,
        dataLimite: data.dataLimite ? new Date(data.dataLimite) : undefined,
        atualizadoPor: data.atualizadoPor || 'Sistema',
      },
    });

    return NextResponse.json(pendenciaAtualizada);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: 'Erro ao atualizar pendência', details: message }, { status: 500 });
  }
}

// PATCH /api/pendencias/[id]
export async function PATCH(
  request: NextRequest,
  context: { params: { id: string } } | { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await getParams(context.params);
    const data = await request.json();

    const pendenciaAtualizada = await prisma.pendencia.update({
      where: { id: Number(id) },
      data,
    });

    return NextResponse.json(pendenciaAtualizada);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: 'Erro ao aplicar patch na pendência', details: message }, { status: 500 });
  }
}

// DELETE /api/pendencias/[id]
export async function DELETE(
  request: NextRequest,
  context: { params: { id: string } } | { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await getParams(context.params);

    await prisma.pendencia.delete({
      where: { id: Number(id) },
    });

    return NextResponse.json({ message: 'Pendência removida com sucesso.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: 'Erro ao remover pendência', details: message }, { status: 500 });
  }
}
