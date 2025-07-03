import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { NovasolicitacaoRemanejamento } from '@/types/remanejamento-funcionario';

// GET - Listar todas as solicitações de remanejamento
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const statusTarefas = searchParams.get('statusTarefas');
    const statusPrestserv = searchParams.get('statusPrestserv');

    const where: any = {};
    
    if (status) {
      where.status = status;
    }

    const solicitacoes = await prisma.solicitacaoRemanejamento.findMany({
      where,
      include: {
        contratoOrigem: {
          select: {
            id: true,
            numero: true,
            nome: true,
            cliente: true
          }
        },
        contratoDestino: {
          select: {
            id: true,
            numero: true,
            nome: true,
            cliente: true
          }
        },
        funcionarios: {
          where: {
            ...(statusTarefas && { statusTarefas: statusTarefas as any }),
            ...(statusPrestserv && { statusPrestserv: statusPrestserv as any })
          },
          include: {
            funcionario: {
              select: {
                id: true,
                nome: true,
                matricula: true,
                funcao: true,
                centroCusto: true
              }
            },
            tarefas: {
              select: {
                id: true,
                tipo: true,
                status: true,
                responsavel: true,
                dataCriacao: true,
                dataLimite: true,
                dataConclusao: true
              }
            }
          }
        }
      },
      orderBy: {
        dataSolicitacao: 'desc'
      }
    });

    return NextResponse.json(solicitacoes);
  } catch (error) {
    console.error('Erro ao buscar remanejamentos:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// POST - Criar nova solicitação de remanejamento
export async function POST(request: NextRequest) {
  try {
    const body: NovasolicitacaoRemanejamento = await request.json();
    
    const {
      funcionarioIds,
      contratoOrigemId,
      contratoDestinoId,
      justificativa,
      prioridade = 'Normal',
      solicitadoPor
    } = body;

    // Validações básicas
    if (!funcionarioIds || funcionarioIds.length === 0) {
      return NextResponse.json(
        { error: 'Pelo menos um funcionário deve ser selecionado' },
        { status: 400 }
      );
    }

    if (!solicitadoPor) {
      return NextResponse.json(
        { error: 'Solicitante é obrigatório' },
        { status: 400 }
      );
    }

    // Verificar se os funcionários existem
    const funcionarios = await prisma.funcionario.findMany({
      where: {
        id: {
          in: funcionarioIds
        }
      }
    });

    if (funcionarios.length !== funcionarioIds.length) {
      return NextResponse.json(
        { error: 'Um ou mais funcionários não foram encontrados' },
        { status: 400 }
      );
    }

    // Criar a solicitação de remanejamento
    const solicitacao = await prisma.solicitacaoRemanejamento.create({
      data: {
        contratoOrigemId,
        contratoDestinoId,
        justificativa,
        prioridade,
        solicitadoPor,
        funcionarios: {
          create: funcionarioIds.map(funcionarioId => ({
            funcionarioId,
            statusTarefas: 'PENDENTE',
            statusPrestserv: 'PENDENTE'
          }))
        }
      },
      include: {
        contratoOrigem: true,
        contratoDestino: true,
        funcionarios: {
          include: {
            funcionario: {
              select: {
                id: true,
                nome: true,
                matricula: true,
                funcao: true,
                centroCusto: true
              }
            }
          }
        }
      }
    });

    // Registrar no histórico para cada funcionário
    try {
      await Promise.all(
        solicitacao.funcionarios.map(async (funcionarioRem) => {
          await prisma.historicoRemanejamento.create({
            data: {
              solicitacaoId: solicitacao.id,
              remanejamentoFuncionarioId: funcionarioRem.id,
              tipoAcao: 'CRIACAO',
              entidade: 'SOLICITACAO',
              descricaoAcao: `Solicitação de remanejamento criada para ${funcionarioRem.funcionario.nome} (${funcionarioRem.funcionario.matricula})`,
              usuarioResponsavel: solicitadoPor,
              observacoes: `Contrato origem: ${solicitacao.contratoOrigem?.nome || 'N/A'} → Contrato destino: ${solicitacao.contratoDestino?.nome || 'N/A'}. Justificativa: ${justificativa}`
            }
          });
        })
      );
    } catch (historicoError) {
      console.error('Erro ao registrar histórico:', historicoError);
      // Não falha a criação da solicitação se o histórico falhar
    }

    return NextResponse.json(solicitacao, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar remanejamento:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}