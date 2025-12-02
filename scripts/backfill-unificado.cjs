const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function parseArgs(argv) {
  const args = { apply: false, limit: 0, batch: 500, steps: [], skip: [] };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') args.apply = true;
    else if (a.startsWith('--limit=')) args.limit = parseInt(a.split('=')[1] || '0', 10) || 0;
    else if (a.startsWith('--batch=')) args.batch = parseInt(a.split('=')[1] || '500', 10) || 500;
    else if (a.startsWith('--only=')) args.steps = (a.split('=')[1] || '').split(',').map(s => s.trim()).filter(Boolean);
    else if (a.startsWith('--skip=')) args.skip = (a.split('=')[1] || '').split(',').map(s => s.trim()).filter(Boolean);
  }
  return args;
}

const norm = (s) => String(s || '').normalize('NFD').replace(/[^A-Za-z0-9\s]/g, '').trim().toUpperCase();
function detectSetorName(s) {
  const v = norm(s);
  if (!v) return '';
  if (v.includes('TREIN')) return 'TREINAMENTO';
  if (v.includes('MEDIC')) return 'MEDICINA';
  if (v.includes('RECURSOS') || v.includes('HUMANOS') || v.includes(' RH') || v === 'RH' || v.includes('RH')) return 'RH';
  return v;
}

async function buildEquipeFinder() {
  const equipes = await prisma.equipe.findMany({ where: { ativo: true }, select: { id: true, nome: true } });
  const index = new Map();
  for (const e of equipes) {
    index.set(norm(e.nome), e.id);
  }
  return {
    findBySetor(setor) {
      const s = norm(setor);
      if (!s) return null;
      if (s === 'RH') {
        for (const [k, id] of index.entries()) {
          if (k.includes('RH') || k.includes('RECURSOS') || k.includes('HUMANOS')) return id;
        }
        return null;
      }
      if (s === 'MEDICINA') {
        for (const [k, id] of index.entries()) { if (k.includes('MEDIC')) return id; }
        return null;
      }
      if (s === 'TREINAMENTO') {
        for (const [k, id] of index.entries()) { if (k.includes('TREIN')) return id; }
        return null;
      }
      return index.get(s) || null;
    }
  };
}

async function stepSetorOnTarefas(args, finder) {
  const total = await prisma.tarefaRemanejamento.count({ where: { setorId: null } });
  let remaining = args.limit && args.limit > 0 ? Math.min(args.limit, total) : total;
  const batchSize = Math.max(1, args.batch || 500);
  let skip = 0, processed = 0, updated = 0, unresolved = 0;
  while (remaining > 0) {
    const take = Math.min(batchSize, remaining);
    const tarefas = await prisma.tarefaRemanejamento.findMany({
      where: { setorId: null },
      orderBy: { id: 'asc' },
      skip, take,
      select: { id: true, tarefaPadraoId: true, treinamentoId: true, responsavel: true, tipo: true, descricao: true }
    });
    if (tarefas.length === 0) break;
    for (const t of tarefas) {
      let setor = '';
      if (t.treinamentoId) setor = 'TREINAMENTO';
      if (!setor && t.tarefaPadraoId) {
        try { const tp = await prisma.tarefaPadrao.findUnique({ where: { id: t.tarefaPadraoId }, select: { setor: true } }); setor = tp?.setor || ''; } catch {}
      }
      if (!setor) setor = detectSetorName(t.responsavel) || detectSetorName(t.tipo) || detectSetorName(t.descricao);
      const eqId = setor ? finder.findBySetor(setor) : null;
      if (eqId) {
        if (args.apply) { try { await prisma.tarefaRemanejamento.update({ where: { id: t.id }, data: { setorId: eqId } }); updated += 1; } catch { unresolved += 1; } }
        else { updated += 1; }
      } else { unresolved += 1; }
      processed += 1; remaining -= 1;
    }
    if (tarefas.length < take) break; skip += take;
  }
  return { total, processed, updated, unresolved };
}

async function stepEventosFromHistorico(args) {
  const tarefas = await prisma.tarefaRemanejamento.findMany({ select: { id: true, remanejamentoFuncionarioId: true, status: true, dataCriacao: true, dataConclusao: true } });
  let created = 0, skipped = 0;
  for (const tarefa of tarefas) {
    const historicos = await prisma.historicoRemanejamento.findMany({
      where: { tarefaId: tarefa.id, entidade: 'TAREFA', campoAlterado: 'status' },
      select: { valorAnterior: true, valorNovo: true, dataAcao: true, usuarioResponsavelId: true, descricaoAcao: true, remanejamentoFuncionarioId: true },
      orderBy: { dataAcao: 'asc' },
    });
    const existing = await prisma.tarefaStatusEvento.findMany({ where: { tarefaId: tarefa.id }, select: { id: true, dataEvento: true, statusNovo: true } });
    const exists = (dataEvento, statusNovo) => {
      const targetIso = dataEvento ? new Date(dataEvento).toISOString() : null;
      return existing.some((e) => { const iso = e.dataEvento ? new Date(e.dataEvento).toISOString() : null; return e.statusNovo === statusNovo && iso === targetIso; });
    };
    if (historicos.length > 0) {
      for (const h of historicos) {
        const dataEvento = h.dataAcao ?? tarefa.dataConclusao ?? tarefa.dataCriacao;
        const statusNovo = h.valorNovo ?? tarefa.status;
        const statusAnterior = h.valorAnterior ?? null;
        const rfId = h.remanejamentoFuncionarioId ?? tarefa.remanejamentoFuncionarioId;
        const observacoes = h.descricaoAcao ?? 'Backfill a partir de histórico';
        if (!exists(dataEvento, statusNovo)) {
          if (args.apply) { await prisma.tarefaStatusEvento.create({ data: { tarefaId: tarefa.id, remanejamentoFuncionarioId: rfId, statusAnterior, statusNovo, observacoes, dataEvento, usuarioResponsavelId: h.usuarioResponsavelId ?? null } }); }
          created += 1;
        } else { skipped += 1; }
      }
    } else {
      const dataEvento = tarefa.dataConclusao ?? tarefa.dataCriacao;
      const statusNovo = tarefa.status;
      if (!exists(dataEvento, statusNovo)) {
        if (args.apply) { await prisma.tarefaStatusEvento.create({ data: { tarefaId: tarefa.id, remanejamentoFuncionarioId: tarefa.remanejamentoFuncionarioId, statusAnterior: null, statusNovo, observacoes: 'Backfill inicial sem histórico', dataEvento, usuarioResponsavelId: null } }); }
        created += 1;
      } else { skipped += 1; }
    }
  }
  return { created, skipped };
}

async function stepFixEventosConclusao(args) {
  const total = await prisma.tarefaStatusEvento.count({ where: { statusNovo: { in: ['CONCLUIDO', 'CONCLUIDA'] } } });
  let remaining = args.limit && args.limit > 0 ? Math.min(args.limit, total) : total;
  const batchSize = Math.max(1, args.batch || 500);
  let skip = 0, processed = 0, updated = 0, skippedCnt = 0;
  while (remaining > 0) {
    const take = Math.min(batchSize, remaining);
    const eventos = await prisma.tarefaStatusEvento.findMany({ where: { statusNovo: { in: ['CONCLUIDO', 'CONCLUIDA'] } }, orderBy: { id: 'asc' }, skip, take, include: { tarefa: { select: { id: true, dataConclusao: true } } } });
    if (eventos.length === 0) break;
    for (const ev of eventos) {
      const concl = ev.tarefa?.dataConclusao ? new Date(ev.tarefa.dataConclusao) : null;
      const cur = ev.dataEvento ? new Date(ev.dataEvento) : null;
      if (!concl || (cur && cur.getTime() === concl.getTime())) { skippedCnt += 1; processed += 1; remaining -= 1; continue; }
      if (args.apply) { try { await prisma.tarefaStatusEvento.update({ where: { id: ev.id }, data: { dataEvento: concl } }); updated += 1; } catch { skippedCnt += 1; } } else { updated += 1; }
      processed += 1; remaining -= 1;
    }
    if (eventos.length < take) break; skip += take;
  }
  return { total, processed, updated, skipped: skippedCnt };
}

async function stepHistoricoUsuarios(args) {
  // Adaptado de backfill-historico-usuarios.js
  const funcionarios = await prisma.funcionario.findMany({ select: { id: true, nome: true } });
  const nomeToIds = new Map(); for (const f of funcionarios) { const n = (f.nome || '').trim(); if (!n) continue; if (!nomeToIds.has(n)) nomeToIds.set(n, []); nomeToIds.get(n).push(f.id); }
  const nomeToUsuario = new Map();
  for (const [nome, ids] of nomeToIds.entries()) {
    if (ids.length !== 1) continue;
    const u = await prisma.usuario.findUnique({ where: { funcionarioId: ids[0] }, select: { id: true, equipeId: true } });
    if (u) nomeToUsuario.set(nome, u);
  }
  const withActor = await prisma.historicoRemanejamento.findMany({ where: { usuarioResponsavelId: { not: null } }, select: { usuarioResponsavelId: true, equipeId: true, remanejamentoFuncionarioId: true, solicitacaoId: true, dataAcao: true }, orderBy: { dataAcao: 'asc' } });
  const mapRF = new Map(), mapSol = new Map();
  for (const h of withActor) { if (h.remanejamentoFuncionarioId) mapRF.set(h.remanejamentoFuncionarioId, h); if (typeof h.solicitacaoId === 'number') mapSol.set(h.solicitacaoId, h); }

  const batchSize = Math.max(1, args.batch || 1000);
  let cursor = null, totalUpdates = 0;
  for (;;) {
    const historicos = await prisma.historicoRemanejamento.findMany({ where: { OR: [{ usuarioResponsavelId: null }, { equipeId: null }] }, orderBy: { id: 'asc' }, take: batchSize, ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}), select: { id: true, usuarioResponsavel: true, usuarioResponsavelId: true, equipeId: true, solicitacaoId: true, remanejamentoFuncionarioId: true } });
    if (historicos.length === 0) break;
    const ops = [];
    for (const h of historicos) {
      let actor = null; const nome = (h.usuarioResponsavel || '').trim();
      if (!h.usuarioResponsavelId && nome && !nome.toLowerCase().includes('sistema')) { actor = nomeToUsuario.get(nome) || null; }
      if (!actor) { const chain = (h.remanejamentoFuncionarioId && mapRF.get(h.remanejamentoFuncionarioId)) || (typeof h.solicitacaoId === 'number' && mapSol.get(h.solicitacaoId)); if (chain) actor = { id: chain.usuarioResponsavelId, equipeId: chain.equipeId }; }
      if (!actor) continue;
      const data = { usuarioResponsavelId: actor.id ?? undefined, equipeId: actor.equipeId ?? undefined };
      if (args.apply) ops.push(prisma.historicoRemanejamento.update({ where: { id: h.id }, data })); else totalUpdates += 1;
    }
    if (ops.length > 0) { await prisma.$transaction(ops, { timeout: 60000 }); totalUpdates += ops.length; }
    cursor = historicos[historicos.length - 1].id;
  }
  return { updated: totalUpdates };
}

async function stepCapacitacoes(args) {
  const responsaveisValidos = ['RH', 'MEDICINA', 'TREINAMENTO'];
  const remConcl = await prisma.remanejamentoFuncionario.findMany({ where: { OR: [{ statusPrestserv: { in: ['VALIDADO', 'VALIDAO', 'VALIDADA'] } }, { dataConcluido: { not: null } }] }, select: { id: true, funcionarioId: true } });
  if (remConcl.length === 0) return { created: 0, updated: 0, skipped: 0 };
  const rfIds = remConcl.map(r => r.id); const rfToFuncionario = new Map(remConcl.map(r => [r.id, r.funcionarioId]));
  const tarefas = await prisma.tarefaRemanejamento.findMany({ where: { remanejamentoFuncionarioId: { in: rfIds }, status: 'CONCLUIDO', responsavel: { in: responsaveisValidos } }, select: { id: true, remanejamentoFuncionarioId: true, tarefaPadraoId: true, treinamentoId: true, tipo: true, descricao: true, responsavel: true, dataConclusao: true, dataVencimento: true } });
  let created = 0, updated = 0, skipped = 0;
  function normalizarUnidadeValidade(unidade) { if (!unidade) return null; const u = String(unidade).trim().toLowerCase(); if (["dia","dias"].includes(u)) return "dias"; if (["mes","meses"].includes(u)) return "meses"; if (["ano","anos"].includes(u)) return "anos"; return null; }
  function adicionarValidade(baseDate, valor, unidade) { if (!baseDate || !valor || valor <= 0 || !unidade) return null; const d = new Date(baseDate); switch (unidade) { case 'dias': d.setDate(d.getDate() + valor); return d; case 'meses': d.setMonth(d.getMonth() + valor); return d; case 'anos': d.setFullYear(d.getFullYear() + valor); return d; default: return null; } }
  for (const t of tarefas) {
    const funcionarioId = rfToFuncionario.get(t.remanejamentoFuncionarioId); if (!funcionarioId) { skipped++; continue; }
    let tarefaPadraoId = t.tarefaPadraoId || null; let treinamentoId = t.treinamentoId || null; let dataVencimentoCalculada = t.dataVencimento || null;
    if (!treinamentoId && t.responsavel === 'TREINAMENTO') { const treino = await prisma.treinamentos.findFirst({ where: { treinamento: { equals: String(t.tipo).trim(), mode: 'insensitive' } } }); if (treino) { treinamentoId = treino.id; const unidade = normalizarUnidadeValidade(treino.validadeUnidade); const validade = adicionarValidade(t.dataConclusao || new Date(), treino.validadeValor, unidade); if (validade) dataVencimentoCalculada = validade; } }
    if (!tarefaPadraoId && (t.responsavel === 'RH' || t.responsavel === 'MEDICINA')) { const padrao = await prisma.tarefaPadrao.findFirst({ where: { setor: String(t.responsavel).trim().toUpperCase(), tipo: { equals: String(t.tipo).trim(), mode: 'insensitive' }, ativo: true } }); if (padrao) tarefaPadraoId = padrao.id; }
    const baseWhere = { funcionarioId }; if (treinamentoId) baseWhere.treinamentoId = treinamentoId; else if (tarefaPadraoId) baseWhere.tarefaPadraoId = tarefaPadraoId; else { baseWhere.tipo = t.tipo; baseWhere.responsavel = t.responsavel; }
    const existente = await prisma.funcionarioCapacitacao.findFirst({ where: baseWhere });
    const novaConclusao = t.dataConclusao || new Date(); const novaValidade = dataVencimentoCalculada || t.dataVencimento || null; const novaDescricao = t.descricao || null;
    if (!existente) { if (args.apply) { await prisma.funcionarioCapacitacao.create({ data: { funcionarioId, tarefaPadraoId, treinamentoId, tipo: t.tipo, responsavel: t.responsavel, descricao: novaDescricao, dataConclusao: novaConclusao, dataVencimento: novaValidade, origemRemanejamentoId: t.remanejamentoFuncionarioId } }); } created += 1; }
    else {
      const deveAtualizarConclusao = !existente.dataConclusao || existente.dataConclusao < novaConclusao;
      const deveAtualizarValidade = (existente.dataVencimento == null && novaValidade != null) || (existente.dataVencimento != null && novaValidade != null && existente.dataVencimento < novaValidade);
      const deveAtualizarDescricao = (existente.descricao == null && novaDescricao != null) || (novaDescricao != null && existente.descricao !== novaDescricao);
      if (deveAtualizarConclusao || deveAtualizarValidade || deveAtualizarDescricao) { if (args.apply) { await prisma.funcionarioCapacitacao.update({ where: { id: existente.id }, data: { ...(deveAtualizarConclusao ? { dataConclusao: novaConclusao } : {}), ...(deveAtualizarValidade ? { dataVencimento: novaValidade } : {}), ...(deveAtualizarDescricao ? { descricao: novaDescricao } : {}), origemRemanejamentoId: t.remanejamentoFuncionarioId } }); } updated += 1; } else { skipped += 1; }
    }
  }
  return { created, updated, skipped };
}

async function main() {
  const args = parseArgs(process.argv);
  console.log(JSON.stringify({ args }, null, 2));
  const finder = await buildEquipeFinder();

  const shouldRun = (name) => {
    if (args.steps.length > 0) return args.steps.includes(name);
    if (args.skip.length > 0) return !args.skip.includes(name);
    return true;
  };

  const results = {};
  if (shouldRun('setor-tarefas')) {
    results.setorTarefas = await stepSetorOnTarefas(args, finder);
    console.log('[setor-tarefas]', results.setorTarefas);
  }
  if (shouldRun('eventos-historico')) {
    results.eventosHistorico = await stepEventosFromHistorico(args);
    console.log('[eventos-historico]', results.eventosHistorico);
  }
  if (shouldRun('fix-eventos-conclusao')) {
    results.fixEventosConclusao = await stepFixEventosConclusao(args);
    console.log('[fix-eventos-conclusao]', results.fixEventosConclusao);
  }
  if (shouldRun('historico-usuarios')) {
    results.historicoUsuarios = await stepHistoricoUsuarios(args);
    console.log('[historico-usuarios]', results.historicoUsuarios);
  }
  if (shouldRun('capacitacoes')) {
    results.capacitacoes = await stepCapacitacoes(args);
    console.log('[capacitacoes]', results.capacitacoes);
  }

  console.log('Resumo:', JSON.stringify(results, null, 2));
}

main()
  .catch((e) => { console.error('Erro no backfill unificado:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });