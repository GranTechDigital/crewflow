import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

// GET - Listar todas as tarefas padrão
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const setor = searchParams.get('setor');
    const ativo = searchParams.get('ativo');

    const where: Prisma.TarefaPadraoWhereInput = {};
    
    if (setor) {
      where.setor = setor;
    }
    
    if (ativo !== null) {
      where.ativo = ativo === 'true';
    }

    const tarefasPadrao = await prisma.tarefaPadrao.findMany({
      where,
      orderBy: [
        { setor: 'asc' },
        { tipo: 'asc' }
      ]
    });

    return NextResponse.json(tarefasPadrao);
  } catch (error) {
    console.error('Erro ao buscar tarefas padrão:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// POST - Criar nova tarefa padrão
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { setor, tipo, descricao } = body;

    if (!setor || !tipo || !descricao) {
      return NextResponse.json(
        { error: 'Setor, tipo e descrição são obrigatórios' },
        { status: 400 }
      );
    }

    // Verificar se já existe uma tarefa com o mesmo setor e tipo
    const tarefaExistente = await prisma.tarefaPadrao.findFirst({
      where: {
        setor,
        tipo
      }
    });

    if (tarefaExistente) {
      return NextResponse.json(
        { error: 'Já existe uma tarefa padrão com este setor e tipo' },
        { status: 409 }
      );
    }

    const novaTarefa = await prisma.tarefaPadrao.create({
      data: {
        setor,
        tipo,
        descricao,
        ativo: true
      }
    });

    return NextResponse.json(novaTarefa, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar tarefa padrão:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}