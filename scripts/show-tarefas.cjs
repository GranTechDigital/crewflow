const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run(remId) {
  const ts = await prisma.tarefaRemanejamento.findMany({
    where: { remanejamentoFuncionarioId: remId },
    select: {
      id: true,
      tipo: true,
      responsavel: true,
      status: true,
      dataCriacao: true,
      dataConclusao: true,
      eventosStatus: { select: { id: true, statusAnterior: true, statusNovo: true, dataEvento: true } },
    },
    orderBy: { dataCriacao: 'asc' },
    take: 5,
  });
  console.log(JSON.stringify(ts, null, 2));
}

const remId = process.argv[2] || '';
run(remId)
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });