const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function criarHistoricoTeste() {
  try {
    // Buscar um funcionário de remanejamento existente
    const funcionario = await prisma.remanejamentoFuncionario.findFirst();
    
    if (!funcionario) {
      console.log('Nenhum funcionário de remanejamento encontrado. Criando dados de teste...');
      
      // Criar uma solicitação de teste
      const solicitacao = await prisma.solicitacaoRemanejamento.create({
        data: {
          justificativa: 'Teste de histórico',
          solicitadoPor: 'Sistema',
          status: 'APROVADO'
        }
      });
      
      // Buscar um funcionário existente
      const funcionarioExistente = await prisma.funcionario.findFirst();
      
      if (!funcionarioExistente) {
        console.log('Nenhum funcionário encontrado. Criando funcionário de teste...');
        const novoFuncionario = await prisma.funcionario.create({
          data: {
            matricula: 'TEST001',
            nome: 'Funcionário Teste',
            funcao: 'Analista'
          }
        });
        
        // Criar remanejamento funcionário
        const remanejamentoFuncionario = await prisma.remanejamentoFuncionario.create({
          data: {
            solicitacaoId: solicitacao.id,
            funcionarioId: novoFuncionario.id,
            statusTarefas: 'PENDENTE',
            statusPrestserv: 'PENDENTE'
          }
        });
        
        console.log('Funcionário de remanejamento criado:', remanejamentoFuncionario.id);
        
        // Criar histórico de teste
        await criarHistorico(remanejamentoFuncionario.id, solicitacao.id);
      } else {
        // Criar remanejamento funcionário com funcionário existente
        const remanejamentoFuncionario = await prisma.remanejamentoFuncionario.create({
          data: {
            solicitacaoId: solicitacao.id,
            funcionarioId: funcionarioExistente.id,
            statusTarefas: 'PENDENTE',
            statusPrestserv: 'PENDENTE'
          }
        });
        
        console.log('Funcionário de remanejamento criado:', remanejamentoFuncionario.id);
        
        // Criar histórico de teste
        await criarHistorico(remanejamentoFuncionario.id, solicitacao.id);
      }
    } else {
      console.log('Funcionário de remanejamento encontrado:', funcionario.id);
      await criarHistorico(funcionario.id, funcionario.solicitacaoId);
    }
    
  } catch (error) {
    console.error('Erro ao criar dados de teste:', error);
  } finally {
    await prisma.$disconnect();
  }
}

async function criarHistorico(remanejamentoFuncionarioId, solicitacaoId) {
  try {
    const historicos = await prisma.historicoRemanejamento.createMany({
      data: [
        {
          remanejamentoFuncionarioId,
          solicitacaoId,
          tipoAcao: 'CRIACAO',
          entidade: 'FUNCIONARIO',
          descricaoAcao: 'Funcionário adicionado ao remanejamento',
          usuarioResponsavel: 'Sistema',
          dataAcao: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 dias atrás
        },
        {
          remanejamentoFuncionarioId,
          solicitacaoId,
          tipoAcao: 'ATUALIZACAO_STATUS',
          entidade: 'FUNCIONARIO',
          campoAlterado: 'statusPrestserv',
          valorAnterior: 'PENDENTE',
          valorNovo: 'EM_ANDAMENTO',
          descricaoAcao: 'Status do prestserv alterado para Em Andamento',
          usuarioResponsavel: 'Admin',
          dataAcao: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1 dia atrás
        },
        {
          remanejamentoFuncionarioId,
          solicitacaoId,
          tipoAcao: 'ATUALIZACAO_CAMPO',
          entidade: 'FUNCIONARIO',
          campoAlterado: 'observacoesPrestserv',
          valorAnterior: '',
          valorNovo: 'Documentação enviada',
          descricaoAcao: 'Observações do prestserv atualizadas',
          usuarioResponsavel: 'Operador',
          dataAcao: new Date(Date.now() - 6 * 60 * 60 * 1000) // 6 horas atrás
        }
      ]
    });

    console.log(`${historicos.count} registros de histórico criados com sucesso!`);
    
    // Verificar se os dados foram criados
    const historicosCriados = await prisma.historicoRemanejamento.findMany({
      where: {
        remanejamentoFuncionarioId
      },
      orderBy: {
        dataAcao: 'desc'
      }
    });
    
    console.log('Históricos encontrados:', historicosCriados.length);
    historicosCriados.forEach(h => {
      console.log(`- ${h.descricaoAcao} (${h.dataAcao})`);
    });
    
  } catch (error) {
    console.error('Erro ao criar histórico:', error);
  }
}

criarHistoricoTeste();