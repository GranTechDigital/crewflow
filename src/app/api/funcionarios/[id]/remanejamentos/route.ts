import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const funcionarioId = parseInt(params.id);

    if (isNaN(funcionarioId)) {
      return NextResponse.json(
        { error: 'ID do funcionário inválido' },
        { status: 400 }
      );
    }

    // Buscar todos os remanejamentos do funcionário
    const remanejamentos = await prisma.remanejamentoFuncionario.findMany({
      where: {
        funcionarioId: funcionarioId,
      },
      include: {
        solicitacao: {
          include: {
            contratoOrigem: {
              select: {
                id: true,
                nome: true,
                numero: true,
                cliente: true,
              },
            },
            contratoDestino: {
              select: {
                id: true,
                nome: true,
                numero: true,
                cliente: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Formatar dados dos remanejamentos
    const remanejamentosFormatados = remanejamentos.map((rem) => ({
      idRemanejamento: rem.id,
      idSolicitacao: rem.solicitacaoId.toString(),
      contratoOrigem: rem.solicitacao.contratoOrigem ? {
        id: rem.solicitacao.contratoOrigem.id,
        nome: rem.solicitacao.contratoOrigem.nome,
        numero: rem.solicitacao.contratoOrigem.numero,
        cliente: rem.solicitacao.contratoOrigem.cliente,
      } : null,
      contratoDestino: rem.solicitacao.contratoDestino ? {
        id: rem.solicitacao.contratoDestino.id,
        nome: rem.solicitacao.contratoDestino.nome,
        numero: rem.solicitacao.contratoDestino.numero,
        cliente: rem.solicitacao.contratoDestino.cliente,
      } : null,
      tipoSolicitacao: rem.solicitacao.tipo,
      statusTarefas: rem.statusTarefas,
      statusPrestserv: rem.statusPrestserv,
      statusFuncionario: rem.statusFuncionario,
      dataCriacao: rem.createdAt.toISOString(),
      dataAtualizacao: rem.updatedAt.toISOString(),
      dataSolicitacao: rem.solicitacao.dataSolicitacao.toISOString(),
      justificativa: rem.solicitacao.justificativa,
      observacoesPrestserv: rem.observacoesPrestserv,
    }));

    return NextResponse.json({
      success: true,
      remanejamentos: remanejamentosFormatados,
      total: remanejamentosFormatados.length,
    });
  } catch (error) {
    console.error('Erro ao buscar histórico de remanejamentos:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}