const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const directors = [
  { email: 'Clarice.Garcia@granservices.com', nome: 'Clarice Garcia' },
  { email: 'Rodrigo.Dantas@granservices.com', nome: 'Rodrigo Dantas' },
  { email: 'mariana.sitta@granservices.com', nome: 'Mariana Sitta' },
  { email: 'ricardo.cunha@granservices.com', nome: 'Ricardo Cunha' },
];

async function main() {
  console.log('🔧 Criando usuários para diretores...');

  // 1. Buscar a equipe "Administração (Visualizador)" (ou Liderança/Logística como fallback)
  // Prioridade: Administração (Visualizador) > Liderança (Visualizador) > Logística (Visualizador)
  let equipe = await prisma.equipe.findFirst({
    where: { 
        nome: "Administração (Visualizador)"
    }
  });

  if (!equipe) {
    console.log('⚠️ Equipe "Administração (Visualizador)" não encontrada. Tentando "Liderança (Visualizador)"...');
    equipe = await prisma.equipe.findFirst({
        where: { nome: "Liderança (Visualizador)" }
    });
  }

  if (!equipe) {
    console.log('⚠️ Equipe "Liderança (Visualizador)" não encontrada. Tentando "Logística (Visualizador)"...');
    equipe = await prisma.equipe.findFirst({
        where: { nome: "Logística (Visualizador)" }
    });
  }

  // Se ainda não achou, criar Administração (Visualizador)
  if (!equipe) {
      console.log('⚠️ Nenhuma equipe encontrada. Criando "Administração (Visualizador)"...');
      equipe = await prisma.equipe.create({
          data: {
              nome: "Administração (Visualizador)",
              descricao: "Perfil de visualização global para diretoria",
              ativo: true
          }
      });
  }

  console.log(`✅ Usando equipe: ${equipe.nome} (ID: ${equipe.id})`);

  // Senha padrão inicial
  const defaultPassword = "Mudar@123";
  const hashedPassword = await bcrypt.hash(defaultPassword, 10);

  let matriculaCounter = 90001; // Começar de uma série alta para não conflitar

  for (const director of directors) {
    // Verificar se já existe funcionário com este email
    let funcionario = await prisma.funcionario.findFirst({
      where: { email: { equals: director.email, mode: 'insensitive' } }
    });

    if (funcionario) {
      console.log(`ℹ️ Funcionário já existe: ${director.nome} (${director.email})`);
    } else {
      // Gerar matrícula única
      let matricula = `DIR-${matriculaCounter}`;
      while (await prisma.funcionario.findUnique({ where: { matricula } })) {
        matriculaCounter++;
        matricula = `DIR-${matriculaCounter}`;
      }

      console.log(`➕ Criando funcionário: ${director.nome} (Matrícula: ${matricula})`);
      funcionario = await prisma.funcionario.create({
        data: {
          nome: director.nome,
          email: director.email,
          matricula: matricula,
          funcao: "Diretoria",
          departamento: "Administração",
          centroCusto: "ADM",
          status: "ATIVO"
        }
      });
      matriculaCounter++;
    }

    // Verificar/Criar Usuário
    const usuario = await prisma.usuario.findUnique({
      where: { funcionarioId: funcionario.id }
    });

    if (usuario) {
      console.log(`   ✅ Usuário já existe para ${director.nome}. Atualizando equipe...`);
      await prisma.usuario.update({
        where: { id: usuario.id },
        data: { 
            equipeId: equipe.id,
            ativo: true
        }
      });
    } else {
      console.log(`   ✨ Criando usuário para ${director.nome}...`);
      await prisma.usuario.create({
        data: {
          funcionarioId: funcionario.id,
          equipeId: equipe.id,
          senha: hashedPassword,
          ativo: true,
          obrigarTrocaSenha: true // Forçar troca na primeira vez
        }
      });
      console.log(`      Senha inicial definida: ${defaultPassword}`);
    }
  }

  console.log('\n✅ Processo concluído!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
