import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { getUserFromRequest } from '@/utils/authUtils';
import { sincronizarTarefasPadrao } from '@/lib/tarefasPadraoSync';

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
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Token de autenticação necessário' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { tipo, descricao, setor } = body;

    // Validações
    if (!tipo || tipo.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Tipo é obrigatório' },
        { status: 400 }
      );
    }

    if (!setor || setor.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Setor é obrigatório' },
        { status: 400 }
      );
    }

    const setoresValidos = ['RH', 'MEDICINA'];
    if (!setoresValidos.includes(setor)) {
      return NextResponse.json(
        { success: false, error: 'Setor deve ser RH ou MEDICINA' },
        { status: 400 }
      );
    }

    // Verificar se já existe uma tarefa com o mesmo tipo no mesmo setor
    const tarefaExistente = await prisma.tarefaPadrao.findFirst({
      where: {
        tipo: tipo.trim(),
        setor
      }
    });

    if (tarefaExistente) {
      return NextResponse.json(
        { success: false, error: 'Já existe uma tarefa com este título no mesmo setor' },
        { status: 409 }
      );
    }

    const novaTarefa = await prisma.tarefaPadrao.create({
      data: {
        tipo: tipo.trim(),
        descricao: (descricao ?? '').trim(),
        setor,
        ativo: true
      }
    });

    // Sincronização automática após criação da tarefa padrão
    try {
      const setoresParaSincronizar = [setor]; // Sincronizar apenas o setor da nova tarefa
      await sincronizarTarefasPadrao({
        setores: setoresParaSincronizar,
        usuarioResponsavel: user?.funcionario?.nome || 'Sistema - Nova Tarefa Padrão',
      });
      console.log(`✅ Sincronização automática de ${setor} executada após criação da tarefa padrão`);
    } catch (syncError) {
      console.error('⚠️ Erro na sincronização automática após criação da tarefa padrão:', syncError);
      // Não falha a criação se a sincronização falhar
    }

    return NextResponse.json({
      success: true,
      message: 'Tarefa padrão criada com sucesso',
      data: novaTarefa,
    }, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar tarefa padrão:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}