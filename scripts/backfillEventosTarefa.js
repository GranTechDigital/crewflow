import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function carregarHistoricosStatusTarefa(tarefaId) {
  return prisma.historicoRemanejamento.findMany({
    where: {
      tarefaId,
      entidade: 'TAREFA',
      campoAlterado: 'status',
    },
    select: {
      valorAnterior: true,
      valorNovo: true,
      dataAcao: true,
      usuarioResponsavelId: true,
      equipeId: true,
      descricaoAcao: true,
      remanejamentoFuncionarioId: true,
    },
    orderBy: { dataAcao: 'asc' },
  });
}

async function eventosExistentesPorTarefa(tarefaId) {
  return prisma.tarefaStatusEvento.findMany({
    where: { tarefaId },
    select: { id: true, dataEvento: true, statusNovo: true },
  });
}

function jaExisteEvento(existing, dataEvento, statusNovo) {
  const targetIso = dataEvento ? new Date(dataEvento).toISOString() : null;
  return existing.some((e) => {
    const iso = e.dataEvento ? new Date(e.dataEvento).toISOString() : null;
    return e.statusNovo === statusNovo && iso === targetIso;
  });
}

async function criarEvento({
  tarefaId,
  remanejamentoFuncionarioId,
  statusAnterior,
  statusNovo,
  observacoes,
  dataEvento,
  usuarioResponsavelId,
  equipeId,
}) {
  return prisma.tarefaStatusEvento.create({
    data: {
      tarefaId,
      remanejamentoFuncionarioId,
      statusAnterior: statusAnterior ?? null,
      statusNovo,
      observacoes: observacoes ?? undefined,
      dataEvento: dataEvento ?? undefined,
      usuarioResponsavelId: usuarioResponsavelId ?? null,
      equipeId: equipeId ?? null,
    },
  });
}

async function processarTarefa(tarefa) {
  const historicos = await carregarHistoricosStatusTarefa(tarefa.id);
  const existing = await eventosExistentesPorTarefa(tarefa.id);

  let created = 0;
  let skipped = 0;

  if (historicos.length > 0) {
    for (const h of historicos) {
      const dataEvento = h.dataAcao ?? tarefa.dataConclusao ?? tarefa.dataCriacao;
      const statusNovo = h.valorNovo ?? tarefa.status;
      const statusAnterior = h.valorAnterior ?? null;
      const rfId = h.remanejamentoFuncionarioId ?? tarefa.remanejamentoFuncionarioId;
      const observacoes = h.descricaoAcao ?? 'Backfill a partir de histórico';

      if (!jaExisteEvento(existing, dataEvento, statusNovo)) {
        await criarEvento({
          tarefaId: tarefa.id,
          remanejamentoFuncionarioId: rfId,
          statusAnterior,
          statusNovo,
          observacoes,
          dataEvento,
          usuarioResponsavelId: h.usuarioResponsavelId ?? null,
          equipeId: h.equipeId ?? null,
        });
        created++;
      } else {
        skipped++;
      }
    }
  } else {
    // Sem histórico: garantir pelo menos um evento com o status atual
    const dataEvento = tarefa.dataConclusao ?? tarefa.dataCriacao;
    const statusNovo = tarefa.status;
    if (!jaExisteEvento(existing, dataEvento, statusNovo)) {
      await criarEvento({
        tarefaId: tarefa.id,
        remanejamentoFuncionarioId: tarefa.remanejamentoFuncionarioId,
        statusAnterior: null,
        statusNovo,
        observacoes: 'Backfill inicial sem histórico',
        dataEvento,
        usuarioResponsavelId: null,
        equipeId: null,
      });
      created++;
    } else {
      skipped++;
    }
  }

  return { created, skipped };
}

async function main() {
  console.log('Iniciando backfill de eventos de status de tarefas...');
  const tarefas = await prisma.tarefaRemanejamento.findMany({
    select: {
      id: true,
      remanejamentoFuncionarioId: true,
      status: true,
      dataCriacao: true,
      dataConclusao: true,
    },
  });

  console.log(`Total de tarefas: ${tarefas.length}`);
  let totalCreated = 0;
  let totalSkipped = 0;

  for (const t of tarefas) {
    try {
      const { created, skipped } = await processarTarefa(t);
      totalCreated += created;
      totalSkipped += skipped;
    } catch (e) {
      console.error('Erro ao processar tarefa', t.id, e);
    }
  }

  console.log('Backfill de eventos concluído.');
  console.log(`Criados: ${totalCreated} | Ignorados/Existentes: ${totalSkipped}`);
}

main()
  .catch((e) => {
    console.error('Falha no backfill de eventos:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });