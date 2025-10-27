const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function cleanupRemanejamentos() {
  console.log('🧹 Iniciando limpeza de remanejamentos e relacionados (staging)...');

  try {
    const results = await prisma.$transaction([
      prisma.observacaoTarefaRemanejamento.deleteMany({}),
      prisma.historicoRemanejamento.deleteMany({}),
      prisma.tarefaRemanejamento.deleteMany({}),
      prisma.remanejamentoFuncionario.deleteMany({}),
      prisma.solicitacaoRemanejamento.deleteMany({}),
    ]);

    console.log('✅ Remoções realizadas:');
    console.log(`- Observações de tarefas removidas: ${results[0].count}`);
    console.log(`- Histórico removido: ${results[1].count}`);
    console.log(`- Tarefas removidas: ${results[2].count}`);
    console.log(`- Remanejamentos de funcionário removidos: ${results[3].count}`);
    console.log(`- Solicitações de remanejamento removidas: ${results[4].count}`);

    const resetMigracao = await prisma.funcionario.updateMany({
      where: { emMigracao: true },
      data: { emMigracao: false }
    });
    console.log(`- Funcionários com emMigracao resetado: ${resetMigracao.count}`);

    console.log('🎉 Limpeza concluída com sucesso.');
  } catch (error) {
    console.error('❌ Erro durante a limpeza:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

cleanupRemanejamentos();