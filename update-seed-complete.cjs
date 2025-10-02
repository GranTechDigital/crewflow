const fs = require("fs");
const path = require("path");

console.log("🔄 Atualizando seed-complete.cjs para usar os novos arquivos JSON...");

const seedFilePath = path.join(__dirname, "prisma", "seed-complete.cjs");

// Ler o arquivo atual
let seedContent = fs.readFileSync(seedFilePath, "utf8");

// Função para carregar dados dos arquivos JSON
const loadSeedDataFunction = `
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
  const funcionarioAdmin = JSON.parse(fs.readFileSync(path.join(seedsDir, "funcionario-admin.json"), "utf8"));

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
    funcionarioAdmin
  };
}`;

// Adicionar a função loadSeedData após os imports
const importSection = seedContent.match(/const.*?require.*?;/g);
const lastImport = importSection[importSection.length - 1];
const afterImports = seedContent.indexOf(lastImport) + lastImport.length;

seedContent = seedContent.slice(0, afterImports) + "\\n" + loadSeedDataFunction + "\\n" + seedContent.slice(afterImports);

// Substituir os arrays hardcoded por chamadas para loadSeedData
seedContent = seedContent.replace(
  /const centrosCusto = \[[\s\S]*?\];/,
  "const dadosOrganizados = loadSeedData();\\n  const centrosCusto = dadosOrganizados.centrosCusto;"
);

seedContent = seedContent.replace(
  /const contratos = \[[\s\S]*?\];/,
  "const contratos = dadosOrganizados.contratos.map(c => ({\\n    ...c,\\n    dataInicio: new Date(c.dataInicio),\\n    dataFim: new Date(c.dataFim)\\n  }));"
);

seedContent = seedContent.replace(
  /const vinculacoes = \[[\s\S]*?\];/,
  `const vinculacoes = dadosOrganizados.vinculacoes.map(v => {
    const contrato = contratosCriados.find(c => c.numero === v.contratoNumero);
    const centroCusto = centrosCustoCriados.find(cc => cc.num_centro_custo === v.centroCustoNum);
    return {
      contratoId: contrato?.id,
      centroCustoId: centroCusto?.id
    };
  }).filter(v => v.contratoId && v.centroCustoId);`
);

seedContent = seedContent.replace(
  /const equipes = \[[\s\S]*?\];/,
  "const equipes = dadosOrganizados.equipes;"
);

seedContent = seedContent.replace(
  /const treinamentosData = \[[\s\S]*?\];/,
  "const treinamentosData = dadosOrganizados.treinamentos;"
);

seedContent = seedContent.replace(
  /const tarefasPadrao = \[[\s\S]*?\];/,
  "const tarefasPadrao = dadosOrganizados.tarefasPadrao;"
);

// Substituir a criação do funcionário administrador
seedContent = seedContent.replace(
  /const adminFuncionario = await prisma\.funcionario\.upsert\(\{[\s\S]*?\}\);/,
  `const adminData = dadosOrganizados.funcionarioAdmin;
  const adminFuncionario = await prisma.funcionario.upsert({
    where: { matricula: adminData.matricula },
    update: {},
    create: {
      matricula: adminData.matricula,
      nome: adminData.nome,
      email: adminData.email,
      funcao: adminData.funcao,
      departamento: adminData.departamento,
      status: adminData.status,
    },
  });`
);

// Substituir os status hardcoded
seedContent = seedContent.replace(
  /const statusCategorias = \[[\s\S]*?\];/,
  "const statusCategorias = dadosOrganizados.status.map(s => s.categoria);"
);

// Remover a função loadSeedData antiga se existir
seedContent = seedContent.replace(
  /\/\/ Carregar dados estruturados dos arquivos organizados[\s\S]*?const dadosExcel = loadSeedData\(\);/,
  "// Dados já carregados na variável dadosOrganizados"
);

// Substituir referências aos dados do Excel
seedContent = seedContent.replace(
  /const projetos = \[[\s\S]*?dadosExcel\.projetos,[\s\S]*?\];/,
  `const projetos = [
    ...dadosOrganizados.projetos,
    "NÃO ENCONTRADO",
  ];`
);

seedContent = seedContent.replace(
  /const centrosCustoProjeto = \[[\s\S]*?dadosExcel\.centrosCustoProjeto,[\s\S]*?\];/,
  `const centrosCustoProjeto = [
    ...dadosOrganizados.centrosCustoProjeto,
    {
      centroCusto: "NÃO ENCONTRADO",
      nomeCentroCusto: "Centro de Custo Não Encontrado",
      projeto: "NÃO ENCONTRADO",
    },
  ];`
);

// Remover mapeamentos hardcoded e usar dados organizados
seedContent = seedContent.replace(
  /const mapeamentosCompletos = \{[\s\S]*?\};/,
  "const statusMappings = dadosOrganizados.statusMapping;"
);

seedContent = seedContent.replace(
  /for \(const \[statusGeral, categorias\] of Object\.entries\([\s\S]*?mapeamentosCompletos[\s\S]*?\)\) \{[\s\S]*?if \(statusCategorias\.includes\(categoria\)\) \{[\s\S]*?\}[\s\S]*?\}/,
  `for (const mapping of statusMappings) {
    const status = statusCriados.find(s => s.categoria === mapping.categoria);
    
    if (status) {
      const existing = await prisma.statusMapping.findUnique({
        where: { statusGeral: mapping.statusGeral },
      });

      if (!existing) {
        await prisma.statusMapping.create({
          data: {
            statusGeral: mapping.statusGeral,
            statusId: status.id,
          },
        });
        statusMappingsCriados++;
      }
    }
  }`
);

// Salvar o arquivo atualizado
fs.writeFileSync(seedFilePath, seedContent, "utf8");

console.log("✅ seed-complete.cjs atualizado com sucesso!");
console.log("📋 Alterações realizadas:");
console.log("  - Adicionada função loadSeedData() para carregar dados dos arquivos JSON");
console.log("  - Substituídos arrays hardcoded por dados dos arquivos organizados");
console.log("  - Centros de custo, contratos, vinculações, equipes agora vêm dos JSONs");
console.log("  - Treinamentos, tarefas padrão e funcionário admin agora vêm dos JSONs");
console.log("  - Status e status mappings agora vêm dos arquivos organizados");
console.log("  - Projetos e centros de custo projeto mantidos dos arquivos existentes");

console.log("\\n🎯 Próximos passos:");
console.log("  1. Executar validação dos seeds");
console.log("  2. Testar o processo de seed completo");
console.log("  3. Verificar se todos os dados são carregados corretamente");