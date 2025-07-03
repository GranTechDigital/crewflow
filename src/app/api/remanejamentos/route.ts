import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Listar todas as solicitações de remanejamento
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const funcionarioId = searchParams.get('funcionarioId');
    
    const where: any = {};
    if (status) where.status = status;
    if (funcionarioId) where.funcionarioId = parseInt(funcionarioId);

    const remanejamentos = await prisma.solicitacaoRemanejamento.findMany({
      where,
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
        }
      },
      orderBy: {
        dataSolicitacao: 'desc'
      }
    });

    return NextResponse.json(remanejamentos);
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
    const body = await request.json();
    const {
      funcionarioIds,
      contratoOrigemId,
      centroCustoOrigem,
      contratoDestinoId,
      centroCustoDestino,
      justificativa,
      prioridade = 'Normal',
      solicitadoPor
    } = body;

    // Validações básicas
    if (!funcionarioIds || !Array.isArray(funcionarioIds) || funcionarioIds.length === 0) {
      return NextResponse.json(
        { error: 'Lista de funcionários é obrigatória' },
        { status: 400 }
      );
    }

    if (!centroCustoOrigem || !centroCustoDestino) {
      return NextResponse.json(
        { error: 'Centro de custo origem e destino são obrigatórios' },
        { status: 400 }
      );
    }

    if (!solicitadoPor) {
      return NextResponse.json(
        { error: 'Solicitante é obrigatório' },
        { status: 400 }
      );
    }

    // Criar múltiplas solicitações (uma para cada funcionário)
    const remanejamentos = await Promise.all(
      funcionarioIds.map(async (funcionarioId: number) => {
        const solicitacao = await prisma.solicitacaoRemanejamento.create({
          data: {
            funcionarioId,
            contratoOrigemId: contratoOrigemId || null,
            centroCustoOrigem,
            contratoDestinoId: contratoDestinoId || null,
            centroCustoDestino,
            justificativa,
            prioridade,
            solicitadoPor,
            status: 'Pendente'
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
            }
          }
        });

        // Registrar no histórico
        try {
          await prisma.historicoRemanejamento.create({
            data: {
              solicitacaoId: solicitacao.id,
              tipoAcao: 'CRIACAO',
              entidade: 'SOLICITACAO',
              descricaoAcao: `Solicitação de remanejamento criada para ${solicitacao.funcionario.nome} (${solicitacao.funcionario.matricula})`,
              usuarioResponsavel: solicitadoPor,
              observacoes: `Centro de custo: ${centroCustoOrigem} → ${centroCustoDestino}. Justificativa: ${justificativa}`
            }
          });
        } catch (historicoError) {
          console.error('Erro ao registrar histórico:', historicoError);
          // Não falha a criação da solicitação se o histórico falhar
        }

        return solicitacao;
      })
    );

    return NextResponse.json({
      message: `${remanejamentos.length} solicitação(ões) de remanejamento criada(s) com sucesso`,
      remanejamentos
    }, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar remanejamento:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// PUT - Atualizar status de uma solicitação
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      status,
      analisadoPor,
      observacoes
    } = body;

    if (!id || !status) {
      return NextResponse.json(
        { error: 'ID e status são obrigatórios' },
        { status: 400 }
      );
    }

    const updateData: any = {
      status,
      dataAnalise: new Date(),
      updatedAt: new Date()
    };

    if (analisadoPor) updateData.analisadoPor = analisadoPor;
    if (observacoes) updateData.observacoes = observacoes;
    if (status === 'Aprovado') updateData.dataAprovacao = new Date();

    // Buscar dados atuais antes da atualização para o histórico
    const remanejamentoAtual = await prisma.solicitacaoRemanejamento.findUnique({
      where: { id: parseInt(id) },
      include: {
        funcionario: {
          select: {
            nome: true,
            matricula: true
          }
        }
      }
    });

    const remanejamento = await prisma.solicitacaoRemanejamento.update({
      where: { id: parseInt(id) },
      data: updateData,
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
        }
      }
    });

    // Registrar no histórico
    try {
      await prisma.historicoRemanejamento.create({
        data: {
          solicitacaoId: remanejamento.id,
          tipoAcao: 'ATUALIZACAO_STATUS',
          entidade: 'SOLICITACAO',
          campoAlterado: 'status',
          valorAnterior: remanejamentoAtual?.status || '',
          valorNovo: status,
          descricaoAcao: `Status da solicitação alterado de "${remanejamentoAtual?.status}" para "${status}" para ${remanejamento.funcionario.nome} (${remanejamento.funcionario.matricula})`,
          usuarioResponsavel: analisadoPor || 'Sistema',
          observacoes: observacoes || undefined
        }
      });
    } catch (historicoError) {
      console.error('Erro ao registrar histórico:', historicoError);
      // Não falha a atualização se o histórico falhar
    }

    return NextResponse.json({
      message: 'Solicitação atualizada com sucesso',
      remanejamento
    });
  } catch (error) {
    console.error('Erro ao atualizar remanejamento:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}