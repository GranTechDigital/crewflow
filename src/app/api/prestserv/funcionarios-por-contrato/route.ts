import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    // Buscar todos os funcionários
    const todosFuncionarios = await prisma.funcionario.findMany({
      include: {
        contrato: {
          select: {
            id: true,
            nome: true,
            cliente: true,
          }
        }
      }
    });

    // Buscar remanejamentos em processo (não concluídos)
    const remanejamentosEmProcesso = await prisma.remanejamentoFuncionario.findMany({
      where: {
        OR: [
          { statusPrestserv: { not: 'APROVADO' } },
          {
            AND: [
              { statusPrestserv: 'APROVADO' },
              { statusTarefas: { not: 'CONCLUIDO' } }
            ]
          }
        ]
      },
      include: {
        funcionario: {
          select: {
            id: true,
            nome: true,
            matricula: true,
            funcao: true,
            centroCusto: true,
          }
        },
        solicitacao: {
          select: {
            id: true,
            contratoOrigem: {
              select: {
                id: true,
                nome: true,
                cliente: true,
              }
            },
            contratoDestino: {
              select: {
                id: true,
                nome: true,
                cliente: true,
              }
            }
          }
        },
        tarefas: {
          select: {
            id: true,
            status: true,
          }
        }
      }
    });

    // Criar mapa de funcionários em processo
    const funcionariosEmProcesso = new Set(remanejamentosEmProcesso.map(r => r.funcionarioId));

    // Agrupar funcionários por contrato atual (não de destino)
    const contratoMap = new Map();

    // Processar todos os funcionários
    todosFuncionarios.forEach(funcionario => {
      // Determinar o contrato atual do funcionário
      const contratoAtual = funcionario.contrato;
      const contratoId = contratoAtual ? contratoAtual.id : 'sem_contrato';
      const contratoNome = contratoAtual ? contratoAtual.nome : 'Sem contrato';
      const contratoCliente = contratoAtual ? contratoAtual.cliente : '-';
      
      // Criar entrada no mapa se não existir
      if (!contratoMap.has(contratoId)) {
        contratoMap.set(contratoId, {
          contratoId: contratoId,
          contratoNome: contratoNome,
          contratoCliente: contratoCliente,
          funcionarios: [],
          totalFuncionarios: 0,
          funcionariosAprovados: 0,
          funcionariosPendentes: 0,
          funcionariosRejeitados: 0,
        });
      }

      const contratoData = contratoMap.get(contratoId);
      
      // Verificar se funcionário está em processo de remanejamento
      const remanejamentoAtivo = remanejamentosEmProcesso.find(r => r.funcionarioId === funcionario.id);
      
      let statusTarefas = 'SEM_PROCESSO';
      let statusPrestserv = 'SEM_PROCESSO';
      let totalTarefas = 0;
      let tarefasConcluidas = 0;
      
      if (remanejamentoAtivo) {
        totalTarefas = remanejamentoAtivo.tarefas.length;
        tarefasConcluidas = remanejamentoAtivo.tarefas.filter(t => t.status === 'CONCLUIDA').length;
        
        // Determinar status das tarefas
        if (totalTarefas === 0) {
          statusTarefas = 'SEM_TAREFAS';
        } else if (tarefasConcluidas === totalTarefas) {
          statusTarefas = 'CONCLUIDO';
        } else if (tarefasConcluidas > 0) {
          statusTarefas = 'EM_ANDAMENTO';
        } else {
          statusTarefas = 'PENDENTE';
        }
        
        statusPrestserv = remanejamentoAtivo.statusPrestserv;
      }

      const funcionarioData = {
        id: funcionario.id,
        nome: funcionario.nome,
        matricula: funcionario.matricula,
        funcao: funcionario.funcao,
        centroCusto: funcionario.centroCusto,
        statusTarefas: statusTarefas,
        statusPrestserv: statusPrestserv,
        totalTarefas: totalTarefas,
        tarefasConcluidas: tarefasConcluidas,
        emProcesso: funcionariosEmProcesso.has(funcionario.id),
      };

      contratoData.funcionarios.push(funcionarioData);
      contratoData.totalFuncionarios++;

      // Contar por status apenas se estiver em processo
      if (remanejamentoAtivo) {
        switch (remanejamentoAtivo.statusPrestserv) {
          case 'APROVADO':
            contratoData.funcionariosAprovados++;
            break;
          case 'PENDENTE':
          case 'CRIADO':
          case 'EM_ANALISE':
            contratoData.funcionariosPendentes++;
            break;
          case 'REJEITADO':
            contratoData.funcionariosRejeitados++;
            break;
        }
      }
    });

    // Buscar todos os contratos para incluir os vazios
    const todosContratos = await prisma.contrato.findMany({
      select: {
        id: true,
        nome: true,
        cliente: true,
      }
    });

    // Adicionar contratos vazios ao mapa
    todosContratos.forEach(contrato => {
      if (!contratoMap.has(contrato.id)) {
        contratoMap.set(contrato.id, {
          contratoId: contrato.id,
          contratoNome: contrato.nome,
          contratoCliente: contrato.cliente,
          funcionarios: [],
          totalFuncionarios: 0,
          funcionariosAprovados: 0,
          funcionariosPendentes: 0,
          funcionariosRejeitados: 0,
        });
      }
    });

    // Converter Map para Array e ordenar por nome do contrato
    const contratos = Array.from(contratoMap.values()).sort((a, b) => 
      a.contratoNome.localeCompare(b.contratoNome)
    );

    // Ordenar funcionários dentro de cada contrato por nome
    contratos.forEach(contrato => {
      contrato.funcionarios.sort((a, b) => a.nome.localeCompare(b.nome));
    });

    return NextResponse.json(contratos);
  } catch (error) {
    console.error('Erro ao buscar funcionários por contrato:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}