import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const teams = [
  "Administração",
  "Liderança (Visualizador)",
  "Planejamento",
  "Planejamento (Gestor)",
  "Planejamento (Editor)",
  "Planejamento (Visualizador)",
  "Logística",
  "Logística (Gestor)",
  "Logística (Editor)",
  "Logística (Visualizador)",
  "RH",
  "RH (Gestor)",
  "RH (Editor)",
  "RH (Visualizador)",
  "Medicina",
  "Medicina (Gestor)",
  "Medicina (Editor)",
  "Medicina (Visualizador)",
  "Treinamento",
  "Treinamento (Gestor)",
  "Treinamento (Editor)",
  "Treinamento (Visualizador)",
];

async function main() {
  console.log("Iniciando cadastro de equipes...");

  for (const teamName of teams) {
    const existingTeam = await prisma.equipe.findUnique({
      where: { nome: teamName },
    });

    if (!existingTeam) {
      await prisma.equipe.create({
        data: {
          nome: teamName,
          descricao: `Equipe de ${teamName}`,
        },
      });
      console.log(`+ Equipe criada: ${teamName}`);
    } else {
      console.log(`= Equipe já existe: ${teamName}`);
    }
  }

  console.log("Concluído!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
