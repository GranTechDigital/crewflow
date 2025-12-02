import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// PUT - Atualizar observação existente
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; obsId: string }> }
) {
  try {
    const { id, obsId } = await params;
    // Obter o usuário autenticado
    const { getUserFromRequest } = await import('@/utils/authUtils');
    const usuarioAutenticado = await getUserFromRequest(request);
    
    if (!usuarioAutenticado) {
      return NextResponse.json(
        { error: 'Usuário não autenticado' },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    const { texto } = body;
    
    // Usar o nome do funcionário do usuário autenticado para modificação
    const modificadoPor = usuarioAutenticado.funcionario.nome;

    if (!texto) {
      return NextResponse.json(
        { error: 'Texto da observação é obrigatório' },
        { status: 400 }
      );
    }

    // Verificar se a observação existe
    const observacaoExistente = await prisma.observacaoTarefaRemanejamento.findUnique({
      where: { id: parseInt(obsId) }
    });

    if (!observacaoExistente) {
      return NextResponse.json(
        { error: 'Observação não encontrada' },
        { status: 404 }
      );
    }

    // Buscar dados da tarefa para o histórico
    const tarefa = await prisma.tarefaRemanejamento.findUnique({
      where: { id },
      select: {
        id: true,
        remanejamentoFuncionarioId: true,
        tipo: true,
      },
      include: {
        remanejamentoFuncionario: {
          include: {
            funcionario: { select: { id: true, nome: true, matricula: true } }
          }
        }
      }
    });

    if (!tarefa) {
      return NextResponse.json(
        { error: 'Tarefa não encontrada' },
        { status: 404 }
      );
    }

    // Atualizar a observação
    const observacaoAtualizada = await prisma.observacaoTarefaRemanejamento.update({
      where: { id: parseInt(obsId) },
      data: {
        texto,
        modificadoPor
      }
    });

    // Registrar no histórico
    try {
      await prisma.historicoRemanejamento.create({
        data: {
          solicitacaoId: tarefa.remanejamentoFuncionario.solicitacaoId,
          remanejamentoFuncionarioId: tarefa.remanejamentoFuncionarioId,
          tipoAcao: 'EDICAO',
          entidade: 'OBSERVACAO',
          campoAlterado: 'texto',
          valorAnterior: observacaoExistente.texto,
          valorNovo: texto,
          descricaoAcao: `Observação editada na tarefa "${tarefa.tipo}" para ${tarefa.remanejamentoFuncionario.funcionario.nome} (${tarefa.remanejamentoFuncionario.funcionario.matricula})`,
          usuarioResponsavel: modificadoPor,
          observacoes: `Texto anterior: "${observacaoExistente.texto}"
Novo texto: "${texto}"`
        }
      });
    } catch (historicoError) {
      console.error('Erro ao registrar histórico:', historicoError);
      // Não falha a atualização da observação se o histórico falhar
    }

    // Mapear para o formato esperado pelo frontend
    const observacaoFormatada = {
      id: String(observacaoAtualizada.id),
      texto: observacaoAtualizada.texto,
      criadoPor: observacaoAtualizada.criadoPor,
      criadoEm: observacaoAtualizada.dataCriacao.toISOString(),
      modificadoPor: observacaoAtualizada.modificadoPor,
      modificadoEm: observacaoAtualizada.dataModificacao.toISOString()
    };

    return NextResponse.json(observacaoFormatada);
  } catch (error) {
    console.error('Erro ao atualizar observação:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// DELETE - Excluir observação
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; obsId: string }> }
) {
  try {
    const { id, obsId } = await params;
    // Obter o usuário autenticado
    const { getUserFromRequest } = await import('@/utils/authUtils');
    const usuarioAutenticado = await getUserFromRequest(request);
    
    if (!usuarioAutenticado) {
      return NextResponse.json(
        { error: 'Usuário não autenticado' },
        { status: 401 }
      );
    }

    // Verificar se a observação existe
    const observacaoExistente = await prisma.observacaoTarefaRemanejamento.findUnique({
      where: { id: parseInt(obsId) }
    });

    if (!observacaoExistente) {
      return NextResponse.json(
        { error: 'Observação não encontrada' },
        { status: 404 }
      );
    }

    // Buscar dados da tarefa para o histórico
    const tarefa = await prisma.tarefaRemanejamento.findUnique({
      where: { id },
      select: {
        id: true,
        remanejamentoFuncionarioId: true,
        tipo: true,
      },
      include: {
        remanejamentoFuncionario: {
          include: {
            funcionario: { select: { id: true, nome: true, matricula: true } }
          }
        }
      }
    });

    if (!tarefa) {
      return NextResponse.json(
        { error: 'Tarefa não encontrada' },
        { status: 404 }
      );
    }

    // Excluir a observação
    await prisma.observacaoTarefaRemanejamento.delete({
      where: { id: parseInt(obsId) }
    });

    // Registrar no histórico
    try {
      await prisma.historicoRemanejamento.create({
        data: {
          solicitacaoId: tarefa.remanejamentoFuncionario.solicitacaoId,
          remanejamentoFuncionarioId: tarefa.remanejamentoFuncionarioId,
          tipoAcao: 'EXCLUSAO',
          entidade: 'OBSERVACAO',
          descricaoAcao: `Observação excluída da tarefa "${tarefa.tipo}" para ${tarefa.remanejamentoFuncionario.funcionario.nome} (${tarefa.remanejamentoFuncionario.funcionario.matricula})`,
          usuarioResponsavel: usuarioAutenticado.funcionario.nome,
          observacoes: `Texto da observação excluída: "${observacaoExistente.texto}"`
        }
      });
    } catch (historicoError) {
      console.error('Erro ao registrar histórico:', historicoError);
      // Não falha a exclusão da observação se o histórico falhar
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao excluir observação:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}