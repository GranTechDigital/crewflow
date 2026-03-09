const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

function normalize(text) {
  return String(text || "")
    .trim()
    .toUpperCase();
}

function toSlug(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[^A-Za-z0-9\s]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}

async function normalizeFuncoes() {
  const funcoes = await prisma.funcao.findMany({
    select: { id: true, funcao: true, regime: true, funcao_slug: true },
  });
  const groups = new Map();
  for (const f of funcoes) {
    const key = `${normalize(f.funcao)}|${f.regime}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(f);
  }
  let atualizadas = 0;
  let fundidas = 0;
  for (const [key, list] of groups.entries()) {
    const [funcaoNorm, regime] = key.split("|");
    const slugNorm = toSlug(funcaoNorm);
    if (list.length === 1) {
      const f = list[0];
      if (funcaoNorm !== f.funcao || slugNorm !== f.funcao_slug) {
        await prisma.funcao.update({
          where: { id: f.id },
          data: { funcao: funcaoNorm, funcao_slug: slugNorm },
        });
        atualizadas += 1;
      }
    } else {
      // Merge duplicates: pick canonical (smallest id), redirect funcionarios, delete others
      const canonical = list.reduce(
        (min, cur) => (cur.id < min.id ? cur : min),
        list[0],
      );
      const duplicates = list.filter((x) => x.id !== canonical.id);
      // Redirect funcionarios
      await prisma.funcionario.updateMany({
        where: { funcaoId: { in: duplicates.map((d) => d.id) } },
        data: { funcaoId: canonical.id },
      });
      // Delete duplicates
      for (const d of duplicates) {
        await prisma.funcao.delete({ where: { id: d.id } });
      }
      // Normalize canonical
      await prisma.funcao.update({
        where: { id: canonical.id },
        data: { funcao: funcaoNorm, funcao_slug: slugNorm },
      });
      fundidas += duplicates.length;
      atualizadas += 1;
    }
  }
  return { atualizadas, fundidas };
}

async function normalizeFuncionarios() {
  const funcionarios = await prisma.funcionario.findMany({
    select: { id: true, funcao: true },
  });
  let atualizadas = 0;
  for (const f of funcionarios) {
    const funcaoNorm = normalize(f.funcao);
    if (funcaoNorm !== f.funcao) {
      await prisma.funcionario.update({
        where: { id: f.id },
        data: { funcao: funcaoNorm },
      });
      atualizadas += 1;
    }
  }
  return atualizadas;
}

async function main() {
  try {
    console.log("Normalizando funções (trim + uppercase) e slug...");
    const { atualizadas: funcoesAtualizadas, fundidas } =
      await normalizeFuncoes();
    console.log(
      `Funcoes atualizadas: ${funcoesAtualizadas} | duplicatas fundidas: ${fundidas}`,
    );

    console.log(
      "Normalizando campo funcao de Funcionarios (trim + uppercase)...",
    );
    const funcionariosAtualizados = await normalizeFuncionarios();
    console.log(`Funcionarios atualizados: ${funcionariosAtualizados}`);

    console.log(
      JSON.stringify(
        {
          funcoesAtualizadas,
          funcoesFundidas: fundidas,
          funcionariosAtualizados,
        },
        null,
        2,
      ),
    );
  } catch (e) {
    console.error("Erro ao normalizar:", e?.message || e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
