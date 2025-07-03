const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function cleanSetores() {
  try {
    console.log('🧹 Iniciando limpeza e padronização dos setores...');
    
    // 1. Verificar setores atuais
    console.log('\n📊 Setores atuais no banco (Tarefa):');
    const setoresAtuaisTarefa = await prisma.$queryRaw`
      SELECT DISTINCT equipe, COUNT(*) as quantidade
      FROM Tarefa 
      GROUP BY equipe
      ORDER BY equipe
    `;
    console.table(setoresAtuaisTarefa);
    
    console.log('\n📊 Setores atuais no banco (TarefaRemanejamento):');
    const setoresAtuaisRemanejamento = await prisma.$queryRaw`
      SELECT DISTINCT responsavel, COUNT(*) as quantidade
      FROM TarefaRemanejamento 
      GROUP BY responsavel
      ORDER BY responsavel
    `;
    console.table(setoresAtuaisRemanejamento);
    
    // 2. Atualizar setores não padronizados
    console.log('\n🔄 Padronizando setores...');
    
    // Atualizar Tarefa (equipe)
    const rhUpdatedTarefa = await prisma.$executeRaw`
      UPDATE Tarefa 
      SET equipe = 'RH'
      WHERE UPPER(equipe) LIKE '%RH%' 
         OR UPPER(equipe) LIKE '%RECURSOS%HUMANOS%'
         OR equipe = 'Recursos Humanos'
         OR equipe = 'rh'
    `;
    console.log(`✅ ${rhUpdatedTarefa} tarefas (Tarefa) atualizadas para RH`);
    
    const medicinaUpdatedTarefa = await prisma.$executeRaw`
      UPDATE Tarefa 
      SET equipe = 'MEDICINA'
      WHERE UPPER(equipe) LIKE '%MEDIC%' 
         OR UPPER(equipe) LIKE '%SAUDE%'
         OR equipe = 'Medicina'
         OR equipe = 'medicina'
         OR equipe = 'Medicina do Trabalho'
    `;
    console.log(`✅ ${medicinaUpdatedTarefa} tarefas (Tarefa) atualizadas para MEDICINA`);
    
    const treinamentoUpdatedTarefa = await prisma.$executeRaw`
      UPDATE Tarefa 
      SET equipe = 'TREINAMENTO'
      WHERE UPPER(equipe) LIKE '%TREIN%' 
         OR UPPER(equipe) LIKE '%CAPACIT%'
         OR equipe = 'Treinamento'
         OR equipe = 'treinamento'
    `;
    console.log(`✅ ${treinamentoUpdatedTarefa} tarefas (Tarefa) atualizadas para TREINAMENTO`);
    
    const defaultUpdatedTarefa = await prisma.$executeRaw`
      UPDATE Tarefa 
      SET equipe = 'RH'
      WHERE equipe NOT IN ('RH', 'MEDICINA', 'TREINAMENTO')
        AND equipe IS NOT NULL
        AND equipe != ''
    `;
    console.log(`✅ ${defaultUpdatedTarefa} tarefas restantes (Tarefa) atualizadas para RH (padrão)`);
    
    // Atualizar TarefaRemanejamento (responsavel)
    const rhUpdatedRemanejamento = await prisma.$executeRaw`
      UPDATE TarefaRemanejamento 
      SET responsavel = 'RH'
      WHERE UPPER(responsavel) LIKE '%RH%' 
         OR UPPER(responsavel) LIKE '%RECURSOS%HUMANOS%'
         OR responsavel = 'Recursos Humanos'
         OR responsavel = 'rh'
    `;
    console.log(`✅ ${rhUpdatedRemanejamento} tarefas (TarefaRemanejamento) atualizadas para RH`);
    
    const medicinaUpdatedRemanejamento = await prisma.$executeRaw`
      UPDATE TarefaRemanejamento 
      SET responsavel = 'MEDICINA'
      WHERE UPPER(responsavel) LIKE '%MEDIC%' 
         OR UPPER(responsavel) LIKE '%SAUDE%'
         OR responsavel = 'Medicina'
         OR responsavel = 'medicina'
         OR responsavel = 'Medicina do Trabalho'
    `;
    console.log(`✅ ${medicinaUpdatedRemanejamento} tarefas (TarefaRemanejamento) atualizadas para MEDICINA`);
    
    const treinamentoUpdatedRemanejamento = await prisma.$executeRaw`
      UPDATE TarefaRemanejamento 
      SET responsavel = 'TREINAMENTO'
      WHERE UPPER(responsavel) LIKE '%TREIN%' 
         OR UPPER(responsavel) LIKE '%CAPACIT%'
         OR responsavel = 'Treinamento'
         OR responsavel = 'treinamento'
    `;
    console.log(`✅ ${treinamentoUpdatedRemanejamento} tarefas (TarefaRemanejamento) atualizadas para TREINAMENTO`);
    
    const defaultUpdatedRemanejamento = await prisma.$executeRaw`
      UPDATE TarefaRemanejamento 
      SET responsavel = 'RH'
      WHERE responsavel NOT IN ('RH', 'MEDICINA', 'TREINAMENTO')
        AND responsavel IS NOT NULL
        AND responsavel != ''
    `;
    console.log(`✅ ${defaultUpdatedRemanejamento} tarefas restantes (TarefaRemanejamento) atualizadas para RH (padrão)`);
    
    // 4. Verificação final
    console.log('\n📊 Setores após padronização (Tarefa):');
    const setoresFinaisTarefa = await prisma.$queryRaw`
      SELECT 
        equipe as setor,
        COUNT(*) as total_tarefas,
        SUM(CASE WHEN status = 'CONCLUIDO' THEN 1 ELSE 0 END) as concluidas,
        ROUND(
          (SUM(CASE WHEN status = 'CONCLUIDO' THEN 1 ELSE 0 END) * 100.0 / COUNT(*)), 
          2
        ) as percentual_conclusao
      FROM Tarefa 
      GROUP BY equipe
      ORDER BY equipe
    `;
    console.table(setoresFinaisTarefa);
    
    console.log('\n📊 Setores após padronização (TarefaRemanejamento):');
    const setoresFinaisRemanejamento = await prisma.$queryRaw`
      SELECT 
        responsavel as setor,
        COUNT(*) as total_tarefas,
        SUM(CASE WHEN status = 'CONCLUIDO' THEN 1 ELSE 0 END) as concluidas,
        ROUND(
          (SUM(CASE WHEN status = 'CONCLUIDO' THEN 1 ELSE 0 END) * 100.0 / COUNT(*)), 
          2
        ) as percentual_conclusao
      FROM TarefaRemanejamento 
      GROUP BY responsavel
      ORDER BY responsavel
    `;
    console.table(setoresFinaisRemanejamento);
    
    console.log('\n✅ Limpeza e padronização concluída com sucesso!');
    console.log('🎯 Agora o sistema possui apenas os setores: RH, MEDICINA e TREINAMENTO');
    
  } catch (error) {
    console.error('❌ Erro durante a limpeza:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanSetores();