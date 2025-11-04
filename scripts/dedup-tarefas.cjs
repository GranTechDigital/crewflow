const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

function chaveTarefa(tipo, responsavel) {
  return `${(responsavel || "").toUpperCase()}|${(tipo || "").toUpperCase()}`;
}

async function dedupPorFuncionarios(nomes, usuarioResponsavel = "Sistema") {
  const whereOr = nomes.map((n) => ({ nome: { contains: n, mode: 'insensitive' } }));
  const funcionarios = await prisma.funcionario.findMany({
    where: { OR: whereOr },
    select: { id: true, nome: true, matricula: true },
  });
  if (funcionarios.length === 0) {
    console.log("Nenhum funcionário encontrado", nomes);
    return { totalCanceladas: 0 };
  }
  let totalCanceladas = 0;
  for (const func of funcionarios) {
    const rems = await prisma.remanejamentoFuncionario.findMany({
      where: { funcionarioId: func.id, statusTarefas: "ATENDER TAREFAS" },
      include: { tarefas: true, solicitacao: true },
    });
    for (const rem of rems) {
      const grupos = new Map();
      for (const t of rem.tarefas || []) {
        const key = chaveTarefa(t.tipo, t.responsavel);
        const arr = grupos.get(key) || [];
        arr.push(t);
        grupos.set(key, arr);
      }
      for (const [key, arr] of grupos.entries()) {
        if (arr.length <= 1) continue;
        const ativos = arr.filter((t) => t.status !== "CANCELADO" && t.status !== "CONCLUIDO" && t.status !== "CONCLUIDA");
        if (ativos.length === 0) continue;
        ativos.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        const cancelar = ativos.slice(1);
        for (const t of cancelar) {
          await prisma.tarefaRemanejamento.update({ where: { id: t.id }, data: { status: "CANCELADO" } });
          try {
            await prisma.observacaoTarefaRemanejamento.create({
              data: {
                tarefaId: t.id,
                texto: "Cancelada por deduplicação automática (script)",
                criadoPor: usuarioResponsavel,
                modificadoPor: usuarioResponsavel,
              },
            });
          } catch {}
          try {
            await prisma.historicoRemanejamento.create({
              data: {
                solicitacaoId: rem.solicitacao?.id,
                remanejamentoFuncionarioId: rem.id,
                tarefaId: t.id,
                tipoAcao: "CANCELAMENTO",
                entidade: "TAREFA",
                campoAlterado: "status",
                valorAnterior: t.status,
                valorNovo: "CANCELADO",
                descricaoAcao: `Cancelada por deduplicação (mantida 1 por chave: ${key})`,
                usuarioResponsavel,
              },
            });
          } catch {}
          totalCanceladas += 1;
        }
      }
    }
    console.log(`Funcionario ${func.nome} (${func.matricula}) processado.`);
  }
  return { totalCanceladas };
}

async function dedupTodos(usuarioResponsavel = "Sistema") {
  const rems = await prisma.remanejamentoFuncionario.findMany({ where: { statusTarefas: "ATENDER TAREFAS" }, include: { tarefas: true, solicitacao: true } });
  let totalCanceladas = 0;
  for (const rem of rems) {
    const grupos = new Map();
    for (const t of rem.tarefas || []) {
      const key = chaveTarefa(t.tipo, t.responsavel);
      const arr = grupos.get(key) || [];
      arr.push(t);
      grupos.set(key, arr);
    }
    for (const [key, arr] of grupos.entries()) {
      if (arr.length <= 1) continue;
      const ativos = arr.filter((t) => t.status !== "CANCELADO" && t.status !== "CONCLUIDO" && t.status !== "CONCLUIDA");
      if (ativos.length === 0) continue;
      ativos.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      const cancelar = ativos.slice(1);
      for (const t of cancelar) {
        await prisma.tarefaRemanejamento.update({ where: { id: t.id }, data: { status: "CANCELADO" } });
        try {
          await prisma.observacaoTarefaRemanejamento.create({
            data: {
              tarefaId: t.id,
              texto: "Cancelada por deduplicação automática (script)",
              criadoPor: usuarioResponsavel,
              modificadoPor: usuarioResponsavel,
            },
          });
        } catch {}
        try {
          await prisma.historicoRemanejamento.create({
            data: {
              solicitacaoId: rem.solicitacao?.id,
              remanejamentoFuncionarioId: rem.id,
              tarefaId: t.id,
              tipoAcao: "CANCELAMENTO",
              entidade: "TAREFA",
              campoAlterado: "status",
              valorAnterior: t.status,
              valorNovo: "CANCELADO",
              descricaoAcao: `Cancelada por deduplicação (mantida 1 por chave: ${key})`,
              usuarioResponsavel,
            },
          });
        } catch {}
        totalCanceladas += 1;
      }
    }
  }
  return { totalCanceladas };
}

(async () => {
  const nomes = process.argv.slice(2);
  try {
    let result;
    if (nomes.length === 0) {
      console.log("Nenhum nome fornecido, deduplicando TODOS os remanejamentos (apenas 'ATENDER TAREFAS')...");
      result = await dedupTodos("Manutenção");
    } else {
      result = await dedupPorFuncionarios(nomes, "Manutenção");
    }
    console.log(`Deduplicação concluída. ${result.totalCanceladas} tarefas canceladas no total.`);
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
})();