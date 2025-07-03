import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    // Buscar todos os remanejamentos de funcionários
    const remanejamentos = await prisma.remanejamentoFuncionario.findMany({
      include: {
        funcionario: true,
        solicitacao: true,
        tarefas: true,
      },
    });

    // Calcular estatísticas gerais
    const totalSolicitacoes = await prisma.solicitacaoRemanejamento.count();
    
    // Contar funcionários por status de tarefas
    const funcionariosPorStatusTarefas = await prisma.remanejamentoFuncionario.groupBy({
      by: ['statusTarefas'],
      _count: {
        id: true,
      },
    });

    // Contar funcionários por status de prestserv
    const funcionariosPorStatusPrestserv = await prisma.remanejamentoFuncionario.groupBy({
      by: ['statusPrestserv'],
      _count: {
        id: true,
      },
    });

    // Calcular contadores específicos
    const funcionariosPendentes = remanejamentos.filter(
      r => r.statusTarefas === 'PENDENTE' || r.statusPrestserv === 'PENDENTE'
    ).length;

    const funcionariosAptos = remanejamentos.filter(
      r => r.statusTarefas === 'CONCLUIDO' && r.statusPrestserv === 'APROVADO'
    ).length;

    const funcionariosRejeitados = remanejamentos.filter(
      r => r.statusPrestserv === 'REJEITADO'
    ).length;

    // Funcionários que precisam de atenção (prontos para submissão ou rejeitados)
    const funcionariosAtencao = remanejamentos.filter(
      r => (r.statusTarefas === 'CONCLUIDO' && r.statusPrestserv === 'PENDENTE') ||
           r.statusPrestserv === 'REJEITADO'
    ).map(r => ({
      id: r.id,
      statusTarefas: r.statusTarefas,
      statusPrestserv: r.statusPrestserv,
      funcionario: {
        id: r.funcionario.id,
        nome: r.funcionario.nome,
        matricula: r.funcionario.matricula,
        funcao: r.funcionario.funcao,
      },
      solicitacao: {
        id: r.solicitacao.id,
        centroCustoOrigem: r.solicitacao.centroCustoOrigem,
        centroCustoDestino: r.solicitacao.centroCustoDestino,
        dataSolicitacao: r.solicitacao.dataSolicitacao.toISOString(),
      },
      tarefas: r.tarefas.map(t => ({
        id: t.id,
        tipo: t.tipo,
        responsavel: t.responsavel,
        status: t.status,
        dataLimite: t.dataLimite?.toISOString() || null,
      })),
    }));

    // Tarefas em atraso
    const hoje = new Date();
    const tarefasEmAtraso = await prisma.tarefaRemanejamento.findMany({
      where: {
        dataLimite: {
          lt: hoje,
        },
        status: {
          not: 'CONCLUIDO',
        },
      },
      include: {
        remanejamentoFuncionario: {
          include: {
            funcionario: true,
          },
        },
      },
    });

    const response = {
      totalSolicitacoes,
      funcionariosPendentes,
      funcionariosAptos,
      funcionariosRejeitados,
      funcionariosPorStatusTarefas: funcionariosPorStatusTarefas.map(item => ({
        status: item.statusTarefas,
        count: item._count.id,
      })),
      funcionariosPorStatusPrestserv: funcionariosPorStatusPrestserv.map(item => ({
        status: item.statusPrestserv,
        count: item._count.id,
      })),
      funcionariosAtencao,
      tarefasEmAtraso: tarefasEmAtraso.map(t => ({
        id: t.id,
        tipo: t.tipo,
        responsavel: t.responsavel,
        status: t.status,
        dataLimite: t.dataLimite?.toISOString() || null,
        remanejamentoFuncionario: {
          funcionario: {
            id: t.remanejamentoFuncionario.funcionario.id,
            nome: t.remanejamentoFuncionario.funcionario.nome,
            matricula: t.remanejamentoFuncionario.funcionario.matricula,
          },
        },
      })),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Erro ao buscar dados do dashboard:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}