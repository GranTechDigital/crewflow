const { PrismaClient } = require("@prisma/client");

// Este script preenche a matriz de treinamento com TODAS as combinações de
// contrato x função x treinamento, marcando como obrigatórias (tipo "AP").
// Ele é independente do seed-complete e deve ser executado manualmente.

const prisma = new PrismaClient();

async function main() {
  console.log("🚀 Iniciando preenchimento da Matriz de Treinamento (contrato x função x treinamento)\n");

  // Buscar todos os contratos, funções (ativas) e treinamentos
  const [contratos, funcoes, treinamentos] = await Promise.all([
    prisma.contrato.findMany({ select: { id: true, nome: true, numero: true } }),
    prisma.funcao.findMany({ select: { id: true, funcao: true, ativo: true }, where: { ativo: true } }),
    prisma.treinamentos.findMany({ select: { id: true, treinamento: true } }),
  ]);

  console.log(`📋 Contratos: ${contratos.length}`);
  console.log(`📋 Funções ativas: ${funcoes.length}`);
  console.log(`📋 Treinamentos: ${treinamentos.length}`);

  if (contratos.length === 0 || funcoes.length === 0 || treinamentos.length === 0) {
    console.log("⚠️ Não há contratos, funções e/ou treinamentos suficientes para preencher a matriz.");
    return;
  }

  const totalPrevisto = contratos.length * funcoes.length * treinamentos.length;
  console.log(`🔢 Combinações previstas: ${totalPrevisto} (contratos x funções x treinamentos)\n`);

  // Função utilitária para dividir em chunks para createMany
  const chunk = (arr, size) => {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  };

  let totalInseridos = 0;
  let totalTentados = 0;

  // Processar contrato por contrato para evitar arrays gigantes
  for (const contrato of contratos) {
    console.log(`➡️  Processando contrato ${contrato.nome} (${contrato.numero}) [id=${contrato.id}]`);

    // Montar todos os registros de matriz para este contrato
    const registros = [];
    for (const funcao of funcoes) {
      for (const treinamento of treinamentos) {
        registros.push({
          contratoId: contrato.id,
          funcaoId: funcao.id,
          treinamentoId: treinamento.id,
          tipoObrigatoriedade: "AP", // Necessário / Obrigatório
          ativo: true,
        });
      }
    }

    totalTentados += registros.length;

    // Inserir em chunks para evitar limites de payload
    const CHUNK_SIZE = 1000;
    const partes = chunk(registros, CHUNK_SIZE);
    for (let idx = 0; idx < partes.length; idx++) {
      const parte = partes[idx];
      const res = await prisma.matrizTreinamento.createMany({
        data: parte,
        skipDuplicates: true, // evita erro ao tentar inserir combinação já existente
      });
      totalInseridos += res.count;
      console.log(
        `   ✔️  Lote ${idx + 1}/${partes.length}: inseridos ${res.count} de ${parte.length} (duplicatas ignoradas)`
      );
    }

    console.log(
      `✅ Contrato ${contrato.numero}: combinações processadas = ${registros.length}\n`
    );
  }

  console.log("\n🎯 Resumo do preenchimento:
  - Tentadas: " + totalTentados + " combinações
  - Inseridas: " + totalInseridos + " novas linhas (duplicatas ignoradas)");

  console.log("\n📌 Observação: todas as combinações foram marcadas como tipo 'AP' (Necessário/Obrigatório).\nVocê poderá ajustar posteriormente para 'RA', 'C', 'SD' ou 'N/A' conforme necessário.");
}

main()
  .catch((e) => {
    console.error("❌ Erro durante o preenchimento da matriz:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });