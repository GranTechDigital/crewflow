import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/utils/authUtils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const usuarioAutenticado = await getUserFromRequest(request);

    if (!usuarioAutenticado) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const observacoes = await prisma.observacaoRemanejamentoFuncionario.findMany({
      where: {
        remanejamentoFuncionarioId: id
      },
      orderBy: {
        dataCriacao: 'desc'
      }
    });

    return NextResponse.json(observacoes);
  } catch (error) {
    console.error('Erro ao buscar observações:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar observações' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const usuarioAutenticado = await getUserFromRequest(request);

    if (!usuarioAutenticado) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { texto } = await request.json();

    if (!texto) {
      return NextResponse.json(
        { error: 'Texto da observação é obrigatório' },
        { status: 400 }
      );
    }

    const observacao = await prisma.observacaoRemanejamentoFuncionario.create({
      data: {
        remanejamentoFuncionarioId: id,
        texto,
        criadoPor: usuarioAutenticado.funcionario.nome,
        modificadoPor: usuarioAutenticado.funcionario.nome
      }
    });

    return NextResponse.json(observacao);
  } catch (error) {
    console.error('Erro ao criar observação:', error);
    return NextResponse.json(
      { error: 'Erro ao criar observação' },
      { status: 500 }
    );
  }
}
