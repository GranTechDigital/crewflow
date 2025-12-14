// Backfill de eventos de reprovação de tarefas
// Origem: HistoricoRemanejamento com tarefaId e valorNovo/descricaoAcao indicando reprovação
// Objetivo: criar entradas em TarefaStatusEvento com statusNovo='REPROVADO' na dataAcao

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function normUp(val) {
  return (val || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
}

async function eventosExistentesPorTarefa(tarefaId) {
  return prisma.tarefaStatusEvento.findMany({
    where: { tarefaId },
    select: { id: true, dataEvento: true, statusNovo: true },
  });
}

function isEventoReprovacaoMatch(existing, dataEvento) {
  const targetIso = dataEvento ? new Date(dataEvento).toISOString() : null;
  return existing.some((e) => {
    const s = normUp(e.statusNovo);
    const iso = e.dataEvento ? new Date(e.dataEvento).toISOString() : null;
    return (s.includes('REPROV') || s.includes('REJEIT') || s.includes('INVALID')) && iso === targetIso;
  });
}

async function criarEventoReprovacao({ tarefaId, remanejamentoFuncionarioId, dataEvento, usuarioResponsavelId }) {
  return prisma.tarefaStatusEvento.create({
    data: {
      tarefaId,
      remanejamentoFuncionarioId,
      statusAnterior: null,
      statusNovo: 'REPROVADO',
      observacoes: 'Backfill: reprovação a partir de HistoricoRemanejamento',
      dataEvento,
      usuarioResponsavelId: usuarioResponsavelId ?? null,
    },
  });
}

function extractTaskNameFromDescricao(descricao) {
  const txt = (descricao || '').toString();
  const m = txt.match(/tarefa\s+\"([^\"]+)\"/i) || txt.match(/tarefa\s+'([^']+)'/i);
  if (m && m[1]) return m[1];
  const m2 = txt.match(/tarefa\s+(.*?)\s+alterado/i);
  return m2 && m2[1] ? m2[1] : null;
}

function normContains(a, b) {
  const na = normUp(a);
  const nb = normUp(b);
  return !!na && !!nb && (na.includes(nb) || nb.includes(na));
}

async function resolverTarefaIdPorHistorico(h) {
  if (h.tarefaId) return h.tarefaId;
  const rfId = h.remanejamentoFuncionarioId;
  if (!rfId) return null;
  const nomeHistorico = extractTaskNameFromDescricao(h.descricaoAcao);
  const tarefas = await prisma.tarefaRemanejamento.findMany({
    where: { remanejamentoFuncionarioId: rfId },
    select: { id: true, tipo: true, descricao: true, responsavel: true },
  });
  if (!tarefas.length) return null;
  if (nomeHistorico) {
    const nomeClean = nomeHistorico.replace(/[\(\)\[\]\{\}]/g, ' ').trim();
    const candByTipo = tarefas.find((t) => normContains(t.tipo, nomeHistorico));
    if (candByTipo) return candByTipo.id;
    const candByDesc = tarefas.find((t) => normContains(t.descricao, nomeHistorico));
    if (candByDesc) return candByDesc.id;
    const candByTipo2 = tarefas.find((t) => normContains(t.tipo, nomeClean));
    if (candByTipo2) return candByTipo2.id;
    const candByDesc2 = tarefas.find((t) => normContains(t.descricao, nomeClean));
    if (candByDesc2) return candByDesc2.id;
  }
  // Fallback: tentativa por setor do nome (ASO -> MEDICINA, REGRAS DE OURO -> TREINAMENTO, CTPS -> RH)
  const nome = normUp(nomeHistorico || '');
  const guessSetor = () => {
    if (nome.includes('ASO') || nome.includes('EXAME') || nome.includes('MEDIC')) return 'MEDICINA';
    if (nome.includes('REGRAS') || nome.includes('INTEGRACAO') || nome.includes('TREIN')) return 'TREINAMENTO';
    if (nome.includes('CTPS') || nome.includes('ADMISS')) return 'RH';
    return '';
  };
  const setorGuess = guessSetor();
  if (setorGuess) {
    const candByResp = tarefas.find((t) => normUp(t.responsavel) === setorGuess);
    if (candByResp) return candByResp.id;
  }
  return null;
}

function extractMatriculaFromDescricao(descricao) {
  const txt = (descricao || '').toString();
  const m = txt.match(/\(([^\)]+)\)\s*$/);
  return m && m[1] ? m[1].trim() : null;
}

async function findUsuarioIdByMatricula(matricula) {
  if (!matricula) return null;
  const func = await prisma.funcionario.findFirst({ where: { matricula: matricula }, select: { id: true } });
  if (!func) return null;
  const user = await prisma.usuario.findFirst({ where: { funcionarioId: func.id }, select: { id: true } });
  return user?.id ?? null;
}

async function getAdminUsuarioId() {
  const adminMatricula = process.env.ADMIN_USER || 'ADMIN001';
  const func = await prisma.funcionario.findFirst({ where: { matricula: adminMatricula }, select: { id: true } });
  if (!func) return null;
  const user = await prisma.usuario.findFirst({ where: { funcionarioId: func.id }, select: { id: true } });
  return user?.id ?? null;
}

function detectSetorName(val) {
  const v = normUp(val);
  if (!v) return '';
  if (v.includes('TREIN')) return 'TREINAMENTO';
  if (v.includes('MEDIC') || v.includes('SAUDE') || v.includes('ASO') || v.includes('EXAME')) return 'MEDICINA';
  if (v.includes('RECURSOS') || v.includes('HUMANOS') || v.includes(' RH') || v === 'RH' || v.includes('ADMISS')) return 'RH';
  return v;
}

async function findEquipeIdBySetor(setor) {
  const s = detectSetorName(setor);
  if (!s) return null;
  if (s === 'RH') {
    const e = await prisma.equipe.findFirst({ where: { OR: [{ nome: { contains: 'RH', mode: 'insensitive' } }, { nome: { contains: 'RECURSOS', mode: 'insensitive' } }, { nome: { contains: 'HUMANOS', mode: 'insensitive' } }] }, select: { id: true } });
    return e?.id ?? null;
  }
  if (s === 'MEDICINA') {
    const e = await prisma.equipe.findFirst({ where: { nome: { contains: 'MEDIC', mode: 'insensitive' } }, select: { id: true } });
    return e?.id ?? null;
  }
  if (s === 'TREINAMENTO') {
    const e = await prisma.equipe.findFirst({ where: { nome: { contains: 'TREIN', mode: 'insensitive' } }, select: { id: true } });
    return e?.id ?? null;
  }
  const e = await prisma.equipe.findFirst({ where: { nome: { equals: s, mode: 'insensitive' } }, select: { id: true } });
  return e?.id ?? null;
}

async function main() {
  console.log('🔎 Buscando reprovações em HistoricoRemanejamento...');
  const historicos = await prisma.historicoRemanejamento.findMany({
    where: {
      OR: [
        { valorNovo: { contains: 'REPROV', mode: 'insensitive' } },
        { valorNovo: { contains: 'REJEIT', mode: 'insensitive' } },
        { valorNovo: { contains: 'INVALID', mode: 'insensitive' } },
        { descricaoAcao: { contains: 'REPROV', mode: 'insensitive' } },
        { descricaoAcao: { contains: 'REJEIT', mode: 'insensitive' } },
        { descricaoAcao: { contains: 'INVALID', mode: 'insensitive' } },
      ],
      entidade: { contains: 'TAREFA', mode: 'insensitive' },
      campoAlterado: { contains: 'status', mode: 'insensitive' },
    },
    select: {
      id: true,
      tarefaId: true,
      remanejamentoFuncionarioId: true,
      valorNovo: true,
      descricaoAcao: true,
      dataAcao: true,
      usuarioResponsavelId: true,
    },
    orderBy: { dataAcao: 'asc' },
  });

  console.log(`Total de entradas de reprovação encontradas: ${historicos.length}`);

  let created = 0;
  let skipped = 0;
  let errors = 0;
  let histUpdated = 0;

  for (const h of historicos) {
    try {
      let tarefaId = h.tarefaId;
      if (!tarefaId) {
        tarefaId = await resolverTarefaIdPorHistorico(h);
      }
      if (!tarefaId) {
        skipped++;
        continue;
      }
      // Correção do histórico: preencher tarefaId quando valorNovo indica REPROVADO
      const isReprov = normUp(h.valorNovo).includes('REPROV');
      if (isReprov && !h.tarefaId) {
        try {
          await prisma.historicoRemanejamento.update({
            where: { id: h.id },
            data: { tarefaId },
          });
          histUpdated++;
        } catch (e) {
          // Não bloquear a criação do evento caso update do histórico falhe
          console.error('Falha ao atualizar tarefaId no histórico', h.id, e);
        }
      }
      // Completar usuarioResponsavelId a partir da matrícula na descrição
      try {
        const matricula = extractMatriculaFromDescricao(h.descricaoAcao);
        if (!h.usuarioResponsavelId) {
          let uid = null;
          if (matricula) uid = await findUsuarioIdByMatricula(matricula);
          if (!uid) uid = await getAdminUsuarioId();
          if (uid) await prisma.historicoRemanejamento.update({ where: { id: h.id }, data: { usuarioResponsavelId: uid } });
        }
      } catch {}
      // Completar equipeId do histórico com base no setor da tarefa
      try {
        const tarefa = await prisma.tarefaRemanejamento.findUnique({ where: { id: tarefaId }, select: { tarefaPadraoId: true, treinamentoId: true, responsavel: true, tipo: true, descricao: true } });
        let setor = '';
        if (tarefa?.treinamentoId) setor = 'TREINAMENTO';
        if (!setor && tarefa?.tarefaPadraoId) {
          const tp = await prisma.tarefaPadrao.findUnique({ where: { id: tarefa.tarefaPadraoId }, select: { setor: true } });
          setor = tp?.setor || '';
        }
        if (!setor) setor = tarefa?.responsavel || tarefa?.tipo || tarefa?.descricao || '';
        const eqId = await findEquipeIdBySetor(setor);
        if (eqId) {
          await prisma.historicoRemanejamento.update({ where: { id: h.id }, data: { equipeId: eqId } });
        }
      } catch {}
      const rfId = h.remanejamentoFuncionarioId;
      const dataEvento = h.dataAcao;
      const existing = await eventosExistentesPorTarefa(tarefaId);
      if (!isEventoReprovacaoMatch(existing, dataEvento)) {
        // Garantir usuário responsável (fallback para admin)
        let usuarioIdEvento = h.usuarioResponsavelId ?? null;
        if (!usuarioIdEvento) {
          const matricula = extractMatriculaFromDescricao(h.descricaoAcao);
          usuarioIdEvento = matricula ? (await findUsuarioIdByMatricula(matricula)) : null;
        }
        if (!usuarioIdEvento) usuarioIdEvento = await getAdminUsuarioId();
        await criarEventoReprovacao({ tarefaId, remanejamentoFuncionarioId: rfId, dataEvento, usuarioResponsavelId: usuarioIdEvento });
        created++;
      } else {
        skipped++;
      }
    } catch (e) {
      errors++;
      console.error('Erro ao criar evento de reprovação para histórico', h.id, e);
    }
  }

  console.log('✅ Backfill de reprovações concluído.');
  console.log(`Criados: ${created} | Ignorados (já existentes na mesma data): ${skipped} | Históricos corrigidos (tarefaId preenchido): ${histUpdated} | Erros: ${errors}`);
}

main()
  .catch((e) => {
    console.error('Falha no backfill de reprovações:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });