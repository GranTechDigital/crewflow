import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

// GET - Listar funcionários baseado no tipo de solicitação
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get('tipo'); // 'alocacao', 'realocacao' ou 'desligamento'
    const contratoId = searchParams.get('contratoId');
    const search = searchParams.get('search');

    // Se não há parâmetro de tipo, retorna funcionários em remanejamento (comportamento antigo)
    if (!tipo) {
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
    }

    // Definir filtro baseado no tipo de solicitação
    const whereClause: Prisma.FuncionarioWhereInput = {
      // Excluir o administrador do sistema das listagens
      matricula: {
        not: 'ADMIN001'
      },
      // Excluir funcionários que estão em processo de migração
      emMigracao: false
    };

    if (tipo === 'alocacao') {
      // Para alocação: funcionários com statusPrestserv SEM_CADASTRO
      whereClause.statusPrestserv = 'SEM_CADASTRO';
      // Garantir que não possuem contrato vinculado
      whereClause.contratoId = null;
    } else if (tipo === 'realocacao') {
      // Para realocação: funcionários com statusPrestserv ATIVO ou INATIVO
      whereClause.statusPrestserv = {
        in: ['ATIVO', 'INATIVO']
      };
      // Garantir que já possuem contrato vinculado
      whereClause.contratoId = { not: null };
    } else if (tipo === 'desligamento') {
      // Para desligamento: apenas funcionários com statusPrestserv ATIVO
      whereClause.statusPrestserv = 'ATIVO';
      // Considerar apenas funcionários com contrato
      whereClause.contratoId = { not: null };
    }

    // Se contratoId for fornecido, filtrar por contrato
    if (contratoId) {
      whereClause.contratoId = parseInt(contratoId);
    }

    const funcionariosRaw = await prisma.funcionario.findMany({
      where: whereClause,
      select: {
        id: true,
        nome: true,
        matricula: true,
        funcao: true,
        centroCusto: true,
        status: true,
        statusPrestserv: true,
        contratoId: true,
        contrato: {
          select: {
            id: true,
            numero: true,
            nome: true,
            cliente: true
          }
        }
      },
      orderBy: {
        nome: 'asc'
      }
    });

    // Filtrar demitidos e admissões do próximo mês para não aparecerem na lista
    const funcionarios = funcionariosRaw.filter(f => {
      const s = (f.status ?? '').toLowerCase();
      const demitidoOuRescisao = s.includes('demit') || s.includes('rescis');
      const admissaoProxMes = s.includes('admiss') && (s.includes('prox') || s.includes('próx'));
      return !(demitidoOuRescisao || admissaoProxMes);
    });

    return Response.json(funcionarios);
  } catch (error) {
    console.error('Erro ao buscar funcionários:', error);
    return Response.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}