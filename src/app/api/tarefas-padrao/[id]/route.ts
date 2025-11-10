import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/utils/authUtils';
import { sincronizarTarefasPadrao } from '@/lib/tarefasPadraoSync';

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
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Token de autenticação necessário' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const tarefaId = parseInt(id);

    if (isNaN(tarefaId)) {
      return NextResponse.json(
        { success: false, error: 'ID da tarefa inválido' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { tipo, descricao, setor, ativo } = body;

    // Verificar se a tarefa existe
    const tarefaExistente = await prisma.tarefaPadrao.findUnique({
      where: { id: tarefaId },
    });

    if (!tarefaExistente) {
      return NextResponse.json(
        { success: false, error: 'Tarefa padrão não encontrada' },
        { status: 404 }
      );
    }

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

    // Verificar se já existe uma tarefa com o mesmo tipo no mesmo setor (exceto a atual)
    const tarefaDuplicada = await prisma.tarefaPadrao.findFirst({
      where: {
        tipo: tipo.trim(),
        setor,
        id: { not: tarefaId },
      },
    });

    if (tarefaDuplicada) {
      return NextResponse.json(
        { success: false, error: 'Já existe uma tarefa com este tipo no mesmo setor' },
        { status: 409 }
      );
    }

    // Atualizar tarefa
    const tarefaAtualizada = await prisma.tarefaPadrao.update({
      where: { id: tarefaId },
      data: {
        tipo: tipo.trim(),
        descricao: (descricao ?? '').trim(),
        setor,
        ativo: ativo !== undefined ? Boolean(ativo) : undefined,
      },
    });

    // Sincronização automática após atualização da tarefa padrão
    try {
      const setoresParaSincronizar = [setor]; // Sincronizar apenas o setor da tarefa atualizada
      await sincronizarTarefasPadrao({
        setores: setoresParaSincronizar,
        usuarioResponsavel: user?.funcionario?.nome || 'Sistema - Tarefa Padrão Atualizada',
      });
      console.log(`✅ Sincronização automática de ${setor} executada após atualização da tarefa padrão`);
    } catch (syncError) {
      console.error('⚠️ Erro na sincronização automática após atualização da tarefa padrão:', syncError);
      // Não falha a atualização se a sincronização falhar
    }

    return NextResponse.json({
      success: true,
      message: 'Tarefa padrão atualizada com sucesso',
      data: tarefaAtualizada,
    });
  } catch (error) {
    console.error('Erro ao atualizar tarefa padrão:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
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