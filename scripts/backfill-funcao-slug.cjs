const { PrismaClient } = require("@prisma/client");

function toSlug(input) {
  return String(input || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

const prisma = new PrismaClient();

async function main() {
  console.log("Iniciando backfill de funcao_slug...");
  const funcoes = await prisma.funcao.findMany({
    select: { id: true, funcao: true, regime: true, funcao_slug: true },
  });

  let atualizados = 0;
  for (const f of funcoes) {
    const slug = toSlug(f.funcao);
    if (!f.funcao_slug || f.funcao_slug !== slug) {
      try {
        await prisma.funcao.update({
          where: { id: f.id },
          data: { funcao_slug: slug },
        });
        atualizados++;
      } catch (e) {
        console.error(
          `Erro ao atualizar funcao ${f.funcao} (${f.regime}):`,
          e?.message || e
        );
      }
    }
  }

  console.log(
    `Backfill concluído. Registros atualizados: ${atualizados}/${funcoes.length}`
  );
}

main()
  .catch((e) => {
    console.error("Falha no backfill:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
