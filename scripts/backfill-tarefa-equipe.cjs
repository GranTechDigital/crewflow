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

function norm(s) {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
}

function detectSetorName(s) {
  const v = norm(s);
  if (!v) return '';
  if (v.includes('TREIN')) return 'TREINAMENTO';
  if (v.includes('MEDIC')) return 'MEDICINA';
  if (v.includes('RECURSOS HUMANOS') || v.includes('HUMANOS') || v.includes('RECURSOS') || v === 'RH' || v.includes(' RH')) return 'RH';
  if (v.includes('RH')) return 'RH';
  return '';
}

function buildEquipeFinder(equipes) {
  const list = (equipes || []).map(e => ({ id: e.id, nome: norm(e.nome) }));
  function findBySetor(setor) {
    const s = norm(setor);
    if (!s) return null;
    if (s === 'RH') {
      const m = list.find(e => e.nome.includes('RH') || e.nome.includes('RECURSOS') || e.nome.includes('HUMANOS'));
      return m ? m.id : null;
    }
    if (s === 'MEDICINA') {
      const m = list.find(e => e.nome.includes('MEDIC'));
      return m ? m.id : null;
    }
    if (s === 'TREINAMENTO') {
      const m = list.find(e => e.nome.includes('TREIN'));
      return m ? m.id : null;
    }
    const m = list.find(e => e.nome === s);
    return m ? m.id : null;
  }
  return { findBySetor };
}

async function resolveEquipeIdForEvento(ev, cache) {
  if (ev.equipeId) return ev.equipeId;
  if (!cache) cache = {};

  if (ev.usuarioResponsavelId) {
    const k = `usuario:${ev.usuarioResponsavelId}`;
    if (!(k in cache)) {
      try {
        const u = await prisma.usuario.findUnique({ where: { id: ev.usuarioResponsavelId }, select: { equipeId: true } });
        cache[k] = u?.equipeId || null;
      } catch {
        cache[k] = null;
      }
    }
    if (cache[k]) return cache[k];
  }

  {
    const k = `tarefa-eq:${ev.tarefaId}`;
    if (!(k in cache)) {
      try {
        const other = await prisma.tarefaStatusEvento.findFirst({ where: { tarefaId: ev.tarefaId, equipeId: { not: null } }, orderBy: { dataEvento: 'desc' }, select: { equipeId: true } });
        cache[k] = other?.equipeId || null;
      } catch {
        cache[k] = null;
      }
    }
    if (cache[k]) return cache[k];
  }

  if (ev.tarefa && ev.tarefa.responsavel) {
    const setor = detectSetorName(ev.tarefa.responsavel);
    if (setor && cache.findEquipeBySetor) {
      const id = cache.findEquipeBySetor(setor);
      if (id) return id;
    }
  }

  if (ev.remanejamentoFuncionarioId) {
    const k = `hist:${ev.remanejamentoFuncionarioId}`;
    if (!(k in cache)) {
      try {
        const h = await prisma.historicoRemanejamento.findFirst({ where: { remanejamentoFuncionarioId: ev.remanejamentoFuncionarioId, equipeId: { not: null } }, orderBy: { dataAcao: 'desc' }, select: { equipeId: true } });
        cache[k] = h?.equipeId || null;
      } catch {
        cache[k] = null;
      }
    }
    if (cache[k]) return cache[k];
  }

  return null;
}

async function run() {
  const args = parseArgs(process.argv);
  const equipes = await prisma.equipe.findMany({ where: { ativo: true }, select: { id: true, nome: true } });
  const finder = buildEquipeFinder(equipes);
  const cache = { findEquipeBySetor: finder.findBySetor };
  const batchSize = Math.max(1, args.batch || 500);

  // Eventos não são mais backfillados com equipe; apenas tarefas

  // Backfill para TarefaRemanejamento.equipeId
  const totalTasksMissing = await prisma.tarefaRemanejamento.count({ where: { equipeId: null } });
  let tRemaining = args.limit && args.limit > 0 ? Math.min(args.limit, totalTasksMissing) : totalTasksMissing;
  let tSkip = 0;
  let tProcessed = 0;
  let tUpdated = 0;
  let tUnresolved = 0;

  while (tRemaining > 0) {
    const tTake = Math.min(batchSize, tRemaining);
    const tarefas = await prisma.tarefaRemanejamento.findMany({
      where: { equipeId: null },
      orderBy: { id: 'asc' },
      skip: tSkip,
      take: tTake,
      select: { id: true, tarefaPadraoId: true, treinamentoId: true, responsavel: true, tipo: true, descricao: true }
    });
    if (tarefas.length === 0) break;

    for (const t of tarefas) {
      let setor = '';
      if (t.treinamentoId) setor = 'TREINAMENTO';
      if (!setor && t.tarefaPadraoId) {
        try {
          const tp = await prisma.tarefaPadrao.findUnique({ where: { id: t.tarefaPadraoId }, select: { setor: true } });
          setor = tp?.setor || '';
        } catch {}
      }
      if (!setor) setor = detectSetorName(t.responsavel) || detectSetorName(t.tipo) || detectSetorName(t.descricao);
      const eqId = setor ? cache.findEquipeBySetor(setor) : null;
      if (eqId) {
        if (args.apply) {
          try {
            await prisma.tarefaRemanejamento.update({ where: { id: t.id }, data: { equipeId: eqId, setorId: eqId } });
            tUpdated += 1;
          } catch {
            tUnresolved += 1;
          }
        } else {
          tUpdated += 1;
        }
      } else {
        tUnresolved += 1;
      }
      tProcessed += 1;
      tRemaining -= 1;
    }

    if (tarefas.length < tTake) break;
    tSkip += tTake;
  }

  console.log(JSON.stringify({ totalTasksMissing, tProcessed, tUpdated, tUnresolved, apply: args.apply }, null, 2));
}

run()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });