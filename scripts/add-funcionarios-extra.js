const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const lista = [
  { matricula: 'FRI-01-11269', nome: 'JOAO VICTOR FURTADO FREIRE', setor: 'LOGISTICA' },
  { matricula: 'FRI-01-11603', nome: 'MARIANA MOTA SILVA', setor: 'LOGISTICA' },
  { matricula: 'FRI-01-2635', nome: 'GUSTAVO GODIM MACHADO', setor: 'LOGISTICA' },
  { matricula: 'FRI-01-5398', nome: 'SERGIO BARBOZA JUNIOR', setor: 'LOGISTICA' },
  { matricula: 'FRI-01-5757', nome: 'DIEGO NASCIMENTO DE OLIVEIRA', setor: 'LOGISTICA' },
  { matricula: 'FRI-01-8825', nome: 'PALOMA BARBOSA GUIMARAES', setor: 'LOGISTICA' },
  { matricula: 'FRI-01-8826', nome: 'PAMELA CAMILA SANTOS DE ARAUJO', setor: 'LOGISTICA' },
  { matricula: 'FRI-01-8828', nome: 'RAIANE MACHADO TAVARES', setor: 'LOGISTICA' },
  { matricula: 'FRI-01-8829', nome: 'RAYSSA KEYLLANE CONCEICAO SANTOS', setor: 'LOGISTICA' },
  { matricula: 'FRI-01-9778', nome: 'GIOVANNA MARTINS DA SILVA ALVES', setor: 'LOGISTICA' },
  { matricula: 'FRI-01-10103', nome: 'TACIANA VIEIRA DE SOUZA MARQUES', setor: 'MEDICINA' },
  { matricula: 'FRI-01-11509', nome: 'MILENA CARLOS EMERICH', setor: 'MEDICINA' },
  { matricula: 'FRI-01-11880', nome: 'POLIANA LOPES E SILVA KOHLER', setor: 'MEDICINA' },
  { matricula: 'FRI-01-2740', nome: 'MAYARA BALAGNA DA CONCEICAO', setor: 'RH' },
  { matricula: 'FRI-01-8308', nome: 'LUANA RIBEIRO DE SOUZA', setor: 'RH' },
  { matricula: 'FRI-01-11408', nome: 'ANA CAROLINA ARAUJO SOUZA GRAIN', setor: 'TREINAMENTO' },
  { matricula: 'FRI-01-2497', nome: 'MONISE NASCIMENTO DE OLIVEIRA', setor: 'TREINAMENTO' },
  { matricula: 'FRI-01-11682', nome: 'PEDRO GONCALVES CARVALHO', setor: 'TREINAMENTO' },
  { matricula: 'FRI-01-10275', nome: 'ROSEANE FERREIRA DOS SANTOS SOUZA', setor: 'TREINAMENTO' },
  { matricula: 'FRI-01-5613', nome: 'AQUILA QUEREN DE SOUZA SILVA', setor: 'TREINAMENTO' },
  { matricula: 'FRI-01-5756', nome: 'THUANY GRIJO DE BRITO', setor: 'TREINAMENTO' },
  { matricula: 'FRI-02-00025', nome: 'CRISTIANE MENEZES DE SOUZA', setor: 'TREINAMENTO' },
];

function mapSetorToEquipeNome(setor) {
  const s = setor.trim().toUpperCase();
  switch (s) {
    case 'LOGISTICA': return 'Logística';
    case 'MEDICINA': return 'Medicina';
    case 'RH': return 'RH';
    case 'TREINAMENTO': return 'Treinamento';
    default: return 'Planejamento';
  }
}

async function ensureEquipe(nome) {
  const existente = await prisma.equipe.findUnique({ where: { nome } });
  if (existente) return existente;
  return prisma.equipe.create({ data: { nome, descricao: `Equipe ${nome}` } });
}

async function addFuncionarios() {
  console.log('➕ Cadastrando funcionários extras e vinculando às equipes...');

  try {
    for (const item of lista) {
      const equipeNome = mapSetorToEquipeNome(item.setor);
      const equipe = await ensureEquipe(equipeNome);

      const funcionario = await prisma.funcionario.upsert({
        where: { matricula: item.matricula },
        update: {
          nome: item.nome,
          departamento: equipeNome,
          status: 'ATIVO',
        },
        create: {
          matricula: item.matricula,
          nome: item.nome,
          departamento: equipeNome,
          status: 'ATIVO',
        },
      });

      const senhaHash = await bcrypt.hash('123456', 10);
      await prisma.usuario.upsert({
        where: { funcionarioId: funcionario.id },
        update: {
          senha: senhaHash,
          equipeId: equipe.id,
          ativo: true,
        },
        create: {
          funcionarioId: funcionario.id,
          senha: senhaHash,
          equipeId: equipe.id,
          ativo: true,
        },
      });

      console.log(`✅ ${item.matricula} - ${item.nome} (${equipeNome})`);
    }

    console.log('🎉 Cadastro de funcionários extras concluído.');
    console.log('🔐 Senha padrão definida: 123456');
  } catch (error) {
    console.error('❌ Erro ao cadastrar funcionários extras:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

addFuncionarios();