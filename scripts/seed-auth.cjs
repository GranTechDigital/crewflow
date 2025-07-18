const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed de autenticação...');

  try {
    // Criar equipes padrão
    const equipes = [
      {
        nome: 'RH',
        descricao: 'Recursos Humanos - Gestão de pessoal e processos administrativos'
      },
      {
        nome: 'Treinamento',
        descricao: 'Capacitação e desenvolvimento de funcionários'
      },
      {
        nome: 'Medicina',
        descricao: 'Medicina do trabalho e saúde ocupacional'
      },
      {
        nome: 'Logística',
        descricao: 'Gestão logística e operacional'
      },
      {
        nome: 'Planejamento',
        descricao: 'Planejamento estratégico e gestão de contratos'
      },
      {
        nome: 'Administração',
        descricao: 'Administração geral do sistema'
      }
    ];

    console.log('📋 Criando equipes...');
    for (const equipeData of equipes) {
      const equipeExistente = await prisma.equipe.findUnique({
        where: { nome: equipeData.nome }
      });

      if (!equipeExistente) {
        await prisma.equipe.create({
          data: equipeData
        });
        console.log(`✅ Equipe "${equipeData.nome}" criada`);
      } else {
        console.log(`⚠️  Equipe "${equipeData.nome}" já existe`);
      }
    }

    // Criar funcionário administrador se não existir
    console.log('👤 Verificando funcionário administrador...');
    let adminFuncionario = await prisma.funcionario.findUnique({
      where: { matricula: 'ADMIN001' }
    });

    if (!adminFuncionario) {
      adminFuncionario = await prisma.funcionario.create({
        data: {
          matricula: 'ADMIN001',
          nome: 'Administrador do Sistema',
          email: 'admin@gransystem.com',
          funcao: 'Administrador',
          departamento: 'TI',
          status: 'Ativo'
        }
      });
      console.log('✅ Funcionário administrador criado');
    } else {
      console.log('⚠️  Funcionário administrador já existe');
    }

    // Criar usuário administrador
    console.log('🔐 Verificando usuário administrador...');
    const usuarioExistente = await prisma.usuario.findUnique({
      where: { funcionarioId: adminFuncionario.id }
    });

    if (!usuarioExistente) {
      const equipeAdmin = await prisma.equipe.findUnique({
        where: { nome: 'Administração' }
      });

      if (equipeAdmin) {
        const senhaHash = await bcrypt.hash('admin123', 12);
        
        await prisma.usuario.create({
          data: {
            funcionarioId: adminFuncionario.id,
            senha: senhaHash,
            equipeId: equipeAdmin.id
          }
        });
        console.log('✅ Usuário administrador criado');
        console.log('📝 Credenciais do administrador:');
        console.log('   Matrícula: ADMIN001');
        console.log('   Senha: admin123');
        console.log('   ⚠️  IMPORTANTE: Altere a senha após o primeiro login!');
      } else {
        console.error('❌ Equipe de Administração não encontrada');
      }
    } else {
      console.log('⚠️  Usuário administrador já existe');
    }

    console.log('\n🎉 Seed de autenticação concluído com sucesso!');
    console.log('\n📋 Resumo das equipes criadas:');
    const todasEquipes = await prisma.equipe.findMany({
      include: {
        _count: {
          select: { usuarios: true }
        }
      }
    });
    
    todasEquipes.forEach(equipe => {
      console.log(`   - ${equipe.nome}: ${equipe._count.usuarios} usuário(s)`);
    });

  } catch (error) {
    console.error('❌ Erro durante o seed:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });