const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function parseArgs(argv) {
  const args = { apply: false, limit: 0, batch: 500 };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') args.apply = true;
    else if (a.startsWith('--limit=')) args.limit = parseInt(a.split('=')[1] || '0', 10) || 0;
    else if (a.startsWith('--batch=')) args.batch = parseInt(a.split('=')[1] || '500', 10) || 500;
  }
  return args;
}

async function run() {
  const args = parseArgs(process.argv);
  const total = await prisma.tarefaStatusEvento.count({ where: { statusNovo: { in: ['CONCLUIDO', 'CONCLUIDA'] } } });
  let remaining = args.limit && args.limit > 0 ? Math.min(args.limit, total) : total;
  const batchSize = Math.max(1, args.batch || 500);
  let skip = 0;
  let processed = 0;
  let updated = 0;
  let skipped = 0;

  while (remaining > 0) {
    const take = Math.min(batchSize, remaining);
    const eventos = await prisma.tarefaStatusEvento.findMany({
      where: { statusNovo: { in: ['CONCLUIDO', 'CONCLUIDA'] } },
      orderBy: { id: 'asc' },
      skip,
      take,
      include: { tarefa: { select: { id: true, dataConclusao: true } } },
    });
    if (eventos.length === 0) break;

    for (const ev of eventos) {
      const concl = ev.tarefa?.dataConclusao ? new Date(ev.tarefa.dataConclusao) : null;
      const cur = ev.dataEvento ? new Date(ev.dataEvento) : null;
      if (!concl) { skipped += 1; processed += 1; remaining -= 1; continue; }
      if (cur && cur.getTime() === concl.getTime()) { skipped += 1; processed += 1; remaining -= 1; continue; }

      if (args.apply) {
        try {
          await prisma.tarefaStatusEvento.update({ where: { id: ev.id }, data: { dataEvento: concl } });
          updated += 1;
        } catch (e) {
          skipped += 1;
        }
      } else {
        updated += 1;
      }
      processed += 1;
      remaining -= 1;
    }

    if (eventos.length < take) break;
    skip += take;
  }

  console.log(JSON.stringify({ total, processed, updated, skipped, apply: args.apply }, null, 2));
}

run()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });