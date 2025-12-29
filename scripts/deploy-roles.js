import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const teams = [
  // Planejamento
  "Planejamento",
  "Planejamento (Gestor)",
  "Planejamento (Editor)",
  "Planejamento (Visualizador)",

  // Logística
  "Logística",
  "Logística (Gestor)",
  "Logística (Editor)",
  "Logística (Visualizador)",

  // RH
  "RH",
  "RH (Gestor)",
  "RH (Editor)",
  "RH (Visualizador)",

  // Medicina
  "Medicina",
  "Medicina (Gestor)",
  "Medicina (Editor)",
  "Medicina (Visualizador)",

  // Treinamento
  "Treinamento",
  "Treinamento (Gestor)",
  "Treinamento (Editor)",
  "Treinamento (Visualizador)",

  // Prestserv (caso seja diferente de Logística no banco, mas geralmente é mapeado)
  "Prestserv",
  "Prestserv (Gestor)",
  "Prestserv (Editor)",
  "Prestserv (Visualizador)",
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
