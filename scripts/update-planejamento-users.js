import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const editors = [
  "FRI-02-00013",
  "FRI-01-11423",
  "FRI-01-11822",
  "FRI-01-12276",
  "FRI-01-12352",
  "FRI-01-1354",
  "FRI-02-00009",
  "FRI-02-00015",
  "FRI-01-6962",
  "FRI-01-7787",
  "FRI-01-9983",
  "FRI-02-00014",
  "FRI-02-00008",
  "FRI-02-00024",
];

const visualizers = [
  "FRI-01-11855",
  "FRI-05-01389",
  "FRI-01-2677",
  "FRI-05-01383",
  "FRI-01-3689",
  "FRI-01-6491",
  "FRI-01-6526",
  "FRI-01-2763",
  "FRI-01-1981",
  "FRI-01-5922",
  "FRI-01-3858",
  "FRI-01-5014",
  "FRI-05-01391",
  "FRI-05-01385",
  "FRI-01-1447",
  "FRI-01-3821",
  "FRI-05-01375",
  "FRI-01-11903",
  "FRI-01-1862",
  "FRI-01-5506",
];

async function main() {
  console.log("Iniciando atualização de usuários do Planejamento...");

  // Buscar IDs das equipes
  const editorTeam = await prisma.equipe.findUnique({
    where: { nome: "Planejamento (Editor)" },
  });

  const visualizerTeam = await prisma.equipe.findUnique({
    where: { nome: "Planejamento (Visualizador)" },
  });

  if (!editorTeam || !visualizerTeam) {
    console.error("Erro: Equipes 'Planejamento (Editor)' ou 'Planejamento (Visualizador)' não encontradas. Execute o script deploy-roles.js primeiro.");
    return;
  }

  console.log(`Equipe Editor ID: ${editorTeam.id}`);
  console.log(`Equipe Visualizador ID: ${visualizerTeam.id}`);

  // Atualizar Editores
  console.log("\nAtualizando Editores...");
  for (const matricula of editors) {
    const funcionario = await prisma.funcionario.findUnique({
      where: { matricula },
      include: { usuario: true },
    });

    if (funcionario && funcionario.usuario) {
      await prisma.usuario.update({
        where: { id: funcionario.usuario.id },
        data: { equipeId: editorTeam.id },
      });
      console.log(`[OK] ${matricula} - ${funcionario.nome} -> Planejamento (Editor)`);
    } else {
      console.log(`[ERRO] Funcionário ou Usuário não encontrado: ${matricula}`);
    }
  }

  // Atualizar Visualizadores
  console.log("\nAtualizando Visualizadores...");
  for (const matricula of visualizers) {
    const funcionario = await prisma.funcionario.findUnique({
      where: { matricula },
      include: { usuario: true },
    });

    if (funcionario && funcionario.usuario) {
      await prisma.usuario.update({
        where: { id: funcionario.usuario.id },
        data: { equipeId: visualizerTeam.id },
      });
      console.log(`[OK] ${matricula} - ${funcionario.nome} -> Planejamento (Visualizador)`);
    } else {
      console.log(`[ERRO] Funcionário ou Usuário não encontrado: ${matricula}`);
    }
  }

  console.log("\nAtualização concluída!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
