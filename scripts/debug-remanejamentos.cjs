const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function normalizarNome(s) {
  return (s || "")
    .normalize("NFD")
    .replace(/[^A-Za-z0-9\s]/g, "")
    .trim()
    .toUpperCase();
}

function detectSetor(responsavel) {
  const v = normalizarNome(responsavel);
  if (!v) return "";
  if (v.includes("TREIN")) return "TREINAMENTO";
  if (v.includes("MEDIC")) return "MEDICINA";
  if (
    v.includes("RECURSOS") ||
    v.includes("HUMANOS") ||
    v.includes(" RH") ||
    v === "RH" ||
    v.includes("RH")
  )
    return "RH";
  return v;
}

async function main() {
  const nomeParts = process.argv.slice(2).map(normalizarNome).filter(Boolean);

  const rems = await prisma.remanejamentoFuncionario.findMany({
    where: {
      statusTarefas: "SUBMETER RASCUNHO",
    },
    include: {
      funcionario: true,
      tarefas: true,
    },
  });

  const filtrados =
    nomeParts.length === 0
      ? rems
      : rems.filter((r) => {
          const nome = normalizarNome(r.funcionario?.nome);
          return nomeParts.every((p) => nome.includes(p));
        });

  const resultado = filtrados.map((r) => {
    const totalTarefas = r.tarefas.length;
    const tarefasPorResponsavel = {};
    let tarefasTreinamento = 0;

    for (const t of r.tarefas) {
      const resp = t.responsavel || "N/A";
      tarefasPorResponsavel[resp] = (tarefasPorResponsavel[resp] || 0) + 1;
      if (detectSetor(resp) === "TREINAMENTO" && t.status !== "CANCELADO") {
        tarefasTreinamento += 1;
      }
    }

    return {
      id: r.id,
      solicitacaoId: r.solicitacaoId,
      funcionarioId: r.funcionarioId,
      funcionario: r.funcionario?.nome || null,
      statusTarefas: r.statusTarefas,
      statusPrestserv: r.statusPrestserv,
      statusFuncionario: r.statusFuncionario,
      totalTarefas,
      tarefasTreinamentoAtivas: tarefasTreinamento,
      tarefasPorResponsavel,
    };
  });

  console.log(JSON.stringify(resultado, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

