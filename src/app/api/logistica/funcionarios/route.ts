import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Listar funcionários em remanejamento
export async function GET(request: NextRequest) {
  try {
    const funcionarios = await prisma.remanejamentoFuncionario.findMany({
      where: {
        statusPrestserv: {
          in: ['CRIADO', 'PENDENTE', 'EM_ANALISE', 'REJEITADO']
        }
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
        solicitacao: {
          select: {
            id: true,
            contratoOrigem: {
              select: {
                nome: true,
                cliente: true
              }
            },
            contratoDestino: {
              select: {
                nome: true,
                cliente: true
              }
            }
          }
        }
      },
      orderBy: {
        funcionario: {
          nome: 'asc'
        }
      }
    });

    // Formatar os dados para o frontend
    const funcionariosFormatados = funcionarios.map(rf => ({
      id: rf.id,
      funcionarioId: rf.funcionario.id,
      nome: rf.funcionario.nome,
      matricula: rf.funcionario.matricula,
      funcao: rf.funcionario.funcao,
      centroCusto: rf.funcionario.centroCusto,
      statusTarefas: rf.statusTarefas,
      statusPrestserv: rf.statusPrestserv,
      contratoOrigem: rf.solicitacao.contratoOrigem?.nome,
      contratoDestino: rf.solicitacao.contratoDestino?.nome
    }));

    return Response.json(funcionariosFormatados);
  } catch (error) {
    console.error('Erro ao buscar funcionários:', error);
    return Response.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}