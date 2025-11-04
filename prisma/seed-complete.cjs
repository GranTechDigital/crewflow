const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

function normalizeRegime(regime) {
  const r = String(regime || "ONSHORE").toUpperCase();
  return r.includes("OFFSHORE") ? "OFFSHORE" : "ONSHORE";
}

function formatFuncaoNome(funcao, regime) {
  const r = normalizeRegime(regime);
  return `${funcao} (${r})`;
}

// Função para carregar dados dos arquivos JSON organizados
function loadSeedData() {
  const seedsDir = path.join(__dirname, "..", "seeds", "data");
  
  const status = JSON.parse(fs.readFileSync(path.join(seedsDir, "status.json"), "utf8"));
  const statusMapping = JSON.parse(fs.readFileSync(path.join(seedsDir, "status-mapping.json"), "utf8"));
  const projetos = JSON.parse(fs.readFileSync(path.join(seedsDir, "projetos.json"), "utf8"));
  const centrosCustoProjeto = JSON.parse(fs.readFileSync(path.join(seedsDir, "centros-custo-projeto.json"), "utf8"));
  const centrosCusto = JSON.parse(fs.readFileSync(path.join(seedsDir, "centros-custo.json"), "utf8"));
  const contratos = JSON.parse(fs.readFileSync(path.join(seedsDir, "contratos.json"), "utf8"));
  const vinculacoes = JSON.parse(fs.readFileSync(path.join(seedsDir, "vinculacoes.json"), "utf8"));
  const equipes = JSON.parse(fs.readFileSync(path.join(seedsDir, "equipes.json"), "utf8"));
  const treinamentos = JSON.parse(fs.readFileSync(path.join(seedsDir, "treinamentos.json"), "utf8"));
  const tarefasPadrao = JSON.parse(fs.readFileSync(path.join(seedsDir, "tarefas-padrao.json"), "utf8"));
  const funcoes = JSON.parse(fs.readFileSync(path.join(seedsDir, "funcoes.json"), "utf8"));

  return {
    status,
    statusMapping,
    projetos,
    centrosCustoProjeto,
    centrosCusto,
    contratos,
    vinculacoes,
    equipes,
    treinamentos,
    tarefasPadrao,
    funcoes
  };
}

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Iniciando seed completo...");
  
  // Carregar dados organizados
  const dadosOrganizados = loadSeedData();

  // Criar Status (categorias)
  console.log("\nCriando status (categorias)...");
  const statusCriados = [];
  for (const statusData of dadosOrganizados.status) {
    const status = await prisma.status.upsert({
      where: { categoria: statusData.categoria },
      update: {},
      create: {
        categoria: statusData.categoria,
        ativo: statusData.ativo,
      },
    });
    statusCriados.push(status);
  }
  console.log(`${statusCriados.length} status criados`);

  // Criar Status Mappings
  console.log("\nCriando status mappings...");
  let statusMappingsCriados = 0;
  for (const mappingData of dadosOrganizados.statusMapping) {
    // Buscar o status pelo ID fornecido no mapping
    const statusGeral = statusCriados.find(s => s.id === mappingData.statusId);
    if (statusGeral) {
      const existing = await prisma.statusMapping.findFirst({
        where: {
          statusGeral: mappingData.statusGeral,
        },
      });

      if (!existing) {
        await prisma.statusMapping.create({
          data: {
            statusGeral: mappingData.statusGeral,
            statusId: mappingData.statusId,
          },
        });
        statusMappingsCriados++;
      }
    } else {
      console.log(`⚠️  Status com ID ${mappingData.statusId} não encontrado para mapping: ${mappingData.statusGeral}`);
    }
  }
  console.log(`${statusMappingsCriados} status mappings criados`);

  // Criar Projetos
  console.log("\nCriando projetos...");
  const projetosData = [...dadosOrganizados.projetos, { codigo: "NE", nome: "NÃO ENCONTRADO" }];
  const projetosCriados = [];
  for (const projetoData of projetosData) {
    const projeto = await prisma.projeto.upsert({
      where: { nome: projetoData.nome },
      update: {},
      create: { 
        codigo: projetoData.codigo,
        nome: projetoData.nome 
      },
    });
    projetosCriados.push(projeto);
  }
  console.log(`${projetosCriados.length} projetos criados`);

  // Criar CentroCustoProjeto
  console.log("\nCriando centros de custo projeto...");
  const centrosCustoProjeto = [
    ...dadosOrganizados.centrosCustoProjeto,
    {
      centroCusto: "NÃO ENCONTRADO",
      nomeCentroCusto: "Centro de Custo Não Encontrado",
      projeto: "NÃO ENCONTRADO",
    },
  ];

  let centrosCustoProjetoCriados = 0;
  for (const centroCustoData of centrosCustoProjeto) {
    const projeto = projetosCriados.find(p => p.nome === centroCustoData.projeto);
    if (!projeto) {
      console.warn(`Projeto não encontrado: ${centroCustoData.projeto}`);
      continue;
    }

    const existing = await prisma.centroCustoProjeto.findUnique({
      where: {
        centroCusto_projetoId: {
          centroCusto: centroCustoData.centroCusto,
          projetoId: projeto.id,
        },
      },
    });

    if (!existing) {
      await prisma.centroCustoProjeto.create({
        data: {
          centroCusto: centroCustoData.centroCusto,
          nomeCentroCusto: centroCustoData.nomeCentroCusto,
          projetoId: projeto.id,
        },
      });
      centrosCustoProjetoCriados++;
    }
  }
  console.log(`${centrosCustoProjetoCriados} centros de custo projeto criados`);

  // Criar Centros de Custo
  console.log("\nCriando centros de custo...");
  const centrosCustoCriados = [];
  for (const centroCustoData of dadosOrganizados.centrosCusto) {
    const centroCusto = await prisma.centroCusto.upsert({
      where: { num_centro_custo: centroCustoData.num_centro_custo },
      update: {},
      create: {
        num_centro_custo: centroCustoData.num_centro_custo,
        nome_centro_custo: centroCustoData.nome_centro_custo,
        status: centroCustoData.status,
      },
    });
    centrosCustoCriados.push(centroCusto);
  }
  console.log(`${centrosCustoCriados.length} centros de custo criados`);

  // Criar Contratos
  console.log("\nCriando contratos...");
  const contratosCriados = [];
  for (const contratoData of dadosOrganizados.contratos) {
    const contrato = await prisma.contrato.upsert({
      where: { numero: contratoData.numero },
      update: {},
      create: {
        numero: contratoData.numero,
        nome: contratoData.nome,
        cliente: contratoData.cliente,
        dataInicio: new Date(contratoData.dataInicio),
        dataFim: new Date(contratoData.dataFim),
        status: contratoData.status,
      },
    });
    contratosCriados.push(contrato);
  }
  console.log(`${contratosCriados.length} contratos criados`);

  // Criar Vinculações (ContratosCentrosCusto)
  console.log("\nCriando vinculações...");
  let vinculacoesCriadas = 0;
  for (const vinculacaoData of dadosOrganizados.vinculacoes) {
    const contrato = contratosCriados.find(c => c.numero === vinculacaoData.contratoNumero);
    const centroCusto = centrosCustoCriados.find(cc => cc.num_centro_custo === vinculacaoData.centroCustoNum);
    
    if (contrato && centroCusto) {
      const existing = await prisma.contratosCentrosCusto.findFirst({
        where: {
          contratoId: contrato.id,
          centroCustoId: centroCusto.id,
        },
      });

      if (!existing) {
        await prisma.contratosCentrosCusto.create({
          data: {
            contratoId: contrato.id,
            centroCustoId: centroCusto.id,
          },
        });
        vinculacoesCriadas++;
      }
    }
  }
  console.log(`${vinculacoesCriadas} vinculações criadas`);

  // Criar Equipes
  console.log("\nCriando equipes...");
  const equipesCriadas = [];
  for (const equipeData of dadosOrganizados.equipes) {
    const equipe = await prisma.equipe.upsert({
      where: { nome: equipeData.nome },
      update: {},
      create: {
        nome: equipeData.nome,
        descricao: equipeData.descricao,
      },
    });
    equipesCriadas.push(equipe);
  }
  console.log(`${equipesCriadas.length} equipes criadas`);

  // Criar Treinamentos
  console.log("\nCriando treinamentos...");
  let treinamentosCriados = 0;
  for (const treinamentoData of dadosOrganizados.treinamentos) {
    const existing = await prisma.treinamentos.findFirst({
      where: { treinamento: treinamentoData.treinamento },
    });

    if (!existing) {
      await prisma.treinamentos.create({
        data: {
          treinamento: treinamentoData.treinamento,
          cargaHoraria: treinamentoData.cargaHoraria,
          validadeValor: treinamentoData.validadeValor,
          validadeUnidade: treinamentoData.validadeUnidade,
        },
      });
      treinamentosCriados++;
    }
  }
  console.log(`${treinamentosCriados} treinamentos criados`);

  // Criar Tarefas Padrão
  console.log("\nCriando tarefas padrão...");
  let tarefasPadraoCriadas = 0;
  for (const tarefaData of dadosOrganizados.tarefasPadrao) {
    const existing = await prisma.tarefaPadrao.findFirst({
      where: {
        tipo: tarefaData.tipo,
        setor: tarefaData.setor,
      },
    });

    if (!existing) {
      await prisma.tarefaPadrao.create({
        data: {
          tipo: tarefaData.tipo,
          setor: tarefaData.setor,
          descricao: tarefaData.descricao,
        },
      });
      tarefasPadraoCriadas++;
    }
  }
  console.log(`${tarefasPadraoCriadas} tarefas padrão criadas`);

  // Criar Funções
  console.log("\nCriando funções...");
  let funcoesCriadas = 0;
  for (const funcaoData of dadosOrganizados.funcoes) {
    const nome = String(funcaoData.funcao).trim();
    const regimeNormalizado = normalizeRegime(funcaoData.regime);
    const funcaoSlug = toSlug(nome);

    const existing = await prisma.funcao.findFirst({
      where: {
        funcao_slug: funcaoSlug,
        regime: regimeNormalizado,
      },
    });

    if (!existing) {
      await prisma.funcao.create({
        data: {
          funcao: nome,
          regime: regimeNormalizado,
          funcao_slug: funcaoSlug,
          ativo: true,
        },
      });
      funcoesCriadas++;
    }
  }
  console.log(`${funcoesCriadas} funções criadas`);

  // Criar Funcionário e Usuário Administrador
  console.log("\nCriando funcionário e usuário administrador...");
  
  const adminMatricula = process.env.ADMIN_USER || "ADMIN001";
  const adminEmail = process.env.ADMIN_EMAIL || "admin@gransystem.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
  
  const adminFuncionario = await prisma.funcionario.upsert({
    where: { matricula: adminMatricula },
    update: {},
    create: {
      nome: "Administrador do Sistema",
      cpf: "00000000000",
      email: adminEmail,
      telefone: "(11) 99999-9999",
      matricula: adminMatricula,
      funcao: "Administrador",
      departamento: "TI",
      centroCusto: "ADMIN",
      status: "ATIVO",
      contratoId: contratosCriados[0]?.id,
    },
  });

  const hashedPassword = await bcrypt.hash(adminPassword, 10);
  await prisma.usuario.upsert({
    where: { funcionarioId: adminFuncionario.id },
    update: {},
    create: {
      senha: hashedPassword,
      equipeId: equipesCriadas[0]?.id || 1,
      ativo: true,
      funcionarioId: adminFuncionario.id,
    },
  });

  console.log("\n🎉 Seed concluído com sucesso!");
  console.log(`- ${statusCriados.length} status (categorias) criados`);
  console.log(`- ${statusMappingsCriados} status mappings criados`);
  console.log(`- ${projetosCriados.length} projetos criados`);
  console.log(`- ${centrosCustoProjetoCriados} centros de custo projeto criados`);
  console.log(`- ${centrosCustoCriados.length} centros de custo criados`);
  console.log(`- ${contratosCriados.length} contratos criados`);
  console.log(`- ${vinculacoesCriadas.length} vinculações criadas`);
  console.log(`- ${equipesCriadas.length} equipes criadas`);
  console.log(`- ${treinamentosCriados} treinamentos criados`);
  console.log(`- ${tarefasPadraoCriadas} tarefas padrão criadas`);
  console.log(`- ${funcoesCriadas} funções criadas`);
  console.log("- 1 funcionário administrador criado");
  console.log("- 1 usuário administrador criado");
}

main()
  .catch((e) => {
    console.error("Erro durante o seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

function toSlug(input) {
  return String(input || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}
