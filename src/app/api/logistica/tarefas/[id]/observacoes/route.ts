import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Buscar observações de uma tarefa
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const observacoes = await prisma.observacaoTarefaRemanejamento.findMany({
      where: {
        tarefaId: params.id
      },
      orderBy: {
        dataCriacao: 'desc'
      }
    });

    return NextResponse.json(observacoes);
  } catch (error) {
    console.error('Erro ao buscar observações:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// POST - Criar nova observação
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { texto, criadoPor } = body;

    if (!texto || !criadoPor) {
      return NextResponse.json(
        { error: 'Texto e criador são obrigatórios' },
        { status: 400 }
      );
    }

    // Verificar se a tarefa existe e buscar dados para histórico
    const tarefa = await prisma.tarefaRemanejamento.findUnique({
      where: { id: params.id },
      include: {
        remanejamentoFuncionario: {
          include: {
            funcionario: {
              select: {
                id: true,
                nome: true,
                matricula: true
              }
            }
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

    const observacao = await prisma.observacaoTarefaRemanejamento.create({
      data: {
        tarefaId: params.id,
        texto,
        criadoPor,
        modificadoPor: criadoPor
      }
    });

    // Registrar no histórico
    try {
      await prisma.historicoRemanejamento.create({
        data: {
          solicitacaoId: tarefa.remanejamentoFuncionario.solicitacaoId,
          remanejamentoFuncionarioId: tarefa.remanejamentoFuncionarioId,
          tipoAcao: 'CRIACAO',
          entidade: 'OBSERVACAO',
          descricaoAcao: `Nova observação adicionada à tarefa "${tarefa.tipo}" para ${tarefa.remanejamentoFuncionario.funcionario.nome} (${tarefa.remanejamentoFuncionario.funcionario.matricula})`,
          usuarioResponsavel: criadoPor,
          observacoes: texto
        }
      });
    } catch (historicoError) {
      console.error('Erro ao registrar histórico:', historicoError);
      // Não falha a criação da observação se o histórico falhar
    }

    return NextResponse.json(observacao, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar observação:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}