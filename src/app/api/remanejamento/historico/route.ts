import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const solicitacaoId = searchParams.get('solicitacaoId');
    const remanejamentoFuncionarioId = searchParams.get('remanejamentoFuncionarioId');
    const tarefaId = searchParams.get('tarefaId');
    const entidade = searchParams.get('entidade');
    const tipoAcao = searchParams.get('tipoAcao');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const where: any = {};
    
    if (solicitacaoId) {
      where.solicitacaoId = parseInt(solicitacaoId);
    }
    
    if (remanejamentoFuncionarioId) {
      where.remanejamentoFuncionarioId = remanejamentoFuncionarioId;
    }
    
    if (tarefaId) {
      where.tarefaId = tarefaId;
    }
    
    if (entidade) {
      where.entidade = entidade;
    }
    
    if (tipoAcao) {
      where.tipoAcao = tipoAcao;
    }

    const historico = await prisma.historicoRemanejamento.findMany({
      where,
      orderBy: {
        dataAcao: 'desc'
      },
      take: limit,
      skip: offset,
      include: {
        solicitacao: {
          select: {
            id: true,
            status: true,
            solicitadoPor: true
          }
        },
        remanejamentoFuncionario: {
          select: {
            id: true,
            statusTarefas: true,
            statusPrestserv: true,
            funcionario: {
              select: {
                nome: true,
                matricula: true
              }
            }
          }
        },
        tarefa: {
          select: {
            id: true,
            tipo: true,
            descricao: true,
            status: true,
            responsavel: true
          }
        }
      }
    });

    const total = await prisma.historicoRemanejamento.count({ where });

    return NextResponse.json({
      historico,
      total,
      limit,
      offset
    });
  } catch (error) {
    console.error('Erro ao buscar histórico:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      remanejamentoFuncionarioId,
      solicitacaoId,
      tarefaId,
      tipoAcao,
      entidade,
      campoAlterado,
      valorAnterior,
      valorNovo,
      descricaoAcao,
      usuarioResponsavel,
      observacoes
    } = body;

    // Validações básicas
    if (!tipoAcao || !entidade || !descricaoAcao || !usuarioResponsavel) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: tipoAcao, entidade, descricaoAcao, usuarioResponsavel' },
        { status: 400 }
      );
    }

    const novoHistorico = await prisma.historicoRemanejamento.create({
      data: {
        remanejamentoFuncionarioId,
        solicitacaoId,
        tarefaId,
        tipoAcao,
        entidade,
        campoAlterado,
        valorAnterior,
        valorNovo,
        descricaoAcao,
        usuarioResponsavel,
        observacoes
      },
      include: {
        solicitacao: {
          select: {
            id: true,
            status: true,
            solicitadoPor: true
          }
        },
        remanejamentoFuncionario: {
          select: {
            id: true,
            statusTarefas: true,
            statusPrestserv: true,
            funcionario: {
              select: {
                nome: true,
                matricula: true
              }
            }
          }
        },
        tarefa: {
          select: {
            id: true,
            tipo: true,
            descricao: true,
            status: true,
            responsavel: true
          }
        }
      }
    });

    return NextResponse.json(novoHistorico, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar histórico:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}