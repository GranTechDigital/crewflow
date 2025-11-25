import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

function normalizarUnidadeValidade(unidade) {
  if (!unidade) return null;
  const u = String(unidade).trim().toLowerCase();
  if (["dia", "dias"].includes(u)) return "dias";
  if (["mes", "meses"].includes(u)) return "meses";
  if (["ano", "anos"].includes(u)) return "anos";
  return null;
}

function adicionarValidade(baseDate, valor, unidade) {
  if (!baseDate || !valor || valor <= 0 || !unidade) return null;
  const d = new Date(baseDate);
  switch (unidade) {
    case "dias":
      d.setDate(d.getDate() + valor);
      return d;
    case "meses":
      d.setMonth(d.getMonth() + valor);
      return d;
    case "anos":
      d.setFullYear(d.getFullYear() + valor);
      return d;
    default:
      return null;
  }
}

async function derivarTreinamento(tarefaTipo) {
  if (!tarefaTipo) return null;
  const nome = String(tarefaTipo).trim();
  const treino = await prisma.treinamentos.findFirst({
    where: { treinamento: { equals: nome, mode: 'insensitive' } },
  });
  if (!treino) return null;
  return treino;
}

async function derivarTarefaPadrao(tipo, setor) {
  if (!tipo || !setor) return null;
  const s = String(setor).trim().toUpperCase();
  const t = await prisma.tarefaPadrao.findFirst({
    where: {
      setor: s,
      tipo: { equals: String(tipo).trim(), mode: 'insensitive' },
      ativo: true,
    },
  });
  return t || null;
}

async function processarTarefaConcluida(tarefa, funcionarioId) {
  // Determinar base IDs
  let tarefaPadraoId = tarefa.tarefaPadraoId || null;
  let treinamentoId = tarefa.treinamentoId || null;
  let dataVencimentoCalculada = tarefa.dataVencimento || null;

  if (!treinamentoId && tarefa.responsavel === 'TREINAMENTO') {
    const treino = await derivarTreinamento(tarefa.tipo);
    if (treino) {
      treinamentoId = treino.id;
      const unidade = normalizarUnidadeValidade(treino.validadeUnidade);
      const validade = adicionarValidade(
        tarefa.dataConclusao || new Date(),
        treino.validadeValor,
        unidade
      );
      if (validade) dataVencimentoCalculada = validade;
    }
  }

  if (!tarefaPadraoId && (tarefa.responsavel === 'RH' || tarefa.responsavel === 'MEDICINA')) {
    const padrao = await derivarTarefaPadrao(tarefa.tipo, tarefa.responsavel);
    if (padrao) tarefaPadraoId = padrao.id;
  }

  const baseWhere = { funcionarioId };
  if (treinamentoId) baseWhere.treinamentoId = treinamentoId;
  else if (tarefaPadraoId) baseWhere.tarefaPadraoId = tarefaPadraoId;
  else {
    baseWhere.tipo = tarefa.tipo;
    baseWhere.responsavel = tarefa.responsavel;
  }

  const existente = await prisma.funcionarioCapacitacao.findFirst({ where: baseWhere });

  const novaConclusao = tarefa.dataConclusao || new Date();
  const novaValidade = dataVencimentoCalculada || tarefa.dataVencimento || null;
  const novaDescricao = tarefa.descricao || null;

  if (!existente) {
    await prisma.funcionarioCapacitacao.create({
      data: {
        funcionarioId,
        tarefaPadraoId,
        treinamentoId,
        tipo: tarefa.tipo,
        responsavel: tarefa.responsavel,
        descricao: novaDescricao,
        dataConclusao: novaConclusao,
        dataVencimento: novaValidade,
        origemRemanejamentoId: tarefa.remanejamentoFuncionarioId,
      },
    });
    return { created: 1, updated: 0 };
  } else {
    const deveAtualizarConclusao = !existente.dataConclusao || existente.dataConclusao < novaConclusao;
    const deveAtualizarValidade =
      (existente.dataVencimento == null && novaValidade != null) ||
      (existente.dataVencimento != null && novaValidade != null && existente.dataVencimento < novaValidade);
    const deveAtualizarDescricao =
      (existente.descricao == null && novaDescricao != null) ||
      (novaDescricao != null && existente.descricao !== novaDescricao);

    if (deveAtualizarConclusao || deveAtualizarValidade || deveAtualizarDescricao) {
      await prisma.funcionarioCapacitacao.update({
        where: { id: existente.id },
        data: {
          ...(deveAtualizarConclusao ? { dataConclusao: novaConclusao } : {}),
          ...(deveAtualizarValidade ? { dataVencimento: novaValidade } : {}),
          ...(deveAtualizarDescricao ? { descricao: novaDescricao } : {}),
          origemRemanejamentoId: tarefa.remanejamentoFuncionarioId,
        },
      });
      return { created: 0, updated: 1 };
    }
    return { created: 0, updated: 0 };
  }
}

async function main() {
  console.log('Iniciando backfill de capacitações...');
  const responsaveisValidos = ['RH', 'MEDICINA', 'TREINAMENTO'];

  // Buscar remanejamentos concluídos (status VALIDADO ou dataConcluido não nula)
  const remanejamentosConcluidos = await prisma.remanejamentoFuncionario.findMany({
    where: {
      OR: [
        { statusPrestserv: { in: ['VALIDADO', 'VALIDAO', 'VALIDADA'] } },
        { dataConcluido: { not: null } },
      ],
    },
    select: { id: true, funcionarioId: true },
  });

  if (remanejamentosConcluidos.length === 0) {
    console.log('Nenhum remanejamento concluído encontrado.');
    return;
  }

  const rfIds = remanejamentosConcluidos.map((r) => r.id);
  const rfToFuncionario = new Map(remanejamentosConcluidos.map((r) => [r.id, r.funcionarioId]));

  // Buscar tarefas concluídas dos setores alvo
  const tarefasConcluidas = await prisma.tarefaRemanejamento.findMany({
    where: {
      remanejamentoFuncionarioId: { in: rfIds },
      status: 'CONCLUIDO',
      responsavel: { in: responsaveisValidos },
    },
    select: {
      id: true,
      remanejamentoFuncionarioId: true,
      tarefaPadraoId: true,
      treinamentoId: true,
      tipo: true,
      descricao: true,
      responsavel: true,
      dataConclusao: true,
      dataVencimento: true,
    },
  });

  console.log(`Tarefas concluídas encontradas: ${tarefasConcluidas.length}`);
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const t of tarefasConcluidas) {
    const funcionarioId = rfToFuncionario.get(t.remanejamentoFuncionarioId);
    if (!funcionarioId) {
      skipped++;
      continue;
    }
    try {
      const res = await processarTarefaConcluida(t, funcionarioId);
      created += res.created;
      updated += res.updated;
    } catch (e) {
      console.error('Erro ao processar tarefa:', t.id, e);
      skipped++;
    }
  }

  console.log('Backfill concluído.');
  console.log(`Criadas: ${created} | Atualizadas: ${updated} | Ignoradas: ${skipped}`);
}

main()
  .catch((e) => {
    console.error('Falha no backfill:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });