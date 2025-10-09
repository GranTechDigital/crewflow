import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createAdminUser() {
  try {
    console.log('🔧 Criando usuário administrador...');

    // Primeiro, verificar se já existe
    const existingFuncionario = await prisma.funcionario.findUnique({
      where: { matricula: "ADMIN001" },
      include: { usuario: true }
    });

    if (existingFuncionario) {
      console.log('✅ Funcionário ADMIN001 já existe');
      
      if (existingFuncionario.usuario) {
        console.log('✅ Usuário já existe');
        
        // Atualizar senha para garantir que está correta
        const hashedPassword = await bcrypt.hash("admin123", 10);
        await prisma.usuario.update({
          where: { funcionarioId: existingFuncionario.id },
          data: {
            senha: hashedPassword,
            ativo: true
          }
        });
        console.log('✅ Senha atualizada para: admin123');
      } else {
        // Criar usuário se não existir
        const hashedPassword = await bcrypt.hash("admin123", 10);
        await prisma.usuario.create({
          data: {
            senha: hashedPassword,
            ativo: true,
            funcionarioId: existingFuncionario.id,
            equipeId: 1 // Assumindo que existe uma equipe com ID 1
          }
        });
        console.log('✅ Usuário criado para funcionário existente');
      }
    } else {
      // Criar funcionário e usuário
      const adminFuncionario = await prisma.funcionario.create({
        data: {
          nome: "Administrador do Sistema",
          cpf: "00000000000",
          email: "admin@gransystem.com",
          telefone: "(11) 99999-9999",
          matricula: "ADMIN001",
          funcao: "Administrador",
          departamento: "TI",
          centroCusto: "ADMIN",
          status: "ATIVO"
        }
      });

      const hashedPassword = await bcrypt.hash("admin123", 10);
      await prisma.usuario.create({
        data: {
          senha: hashedPassword,
          ativo: true,
          funcionarioId: adminFuncionario.id,
          equipeId: 1
        }
      });
      
      console.log('✅ Funcionário e usuário criados');
    }

    // Verificar se foi criado corretamente
    const verificacao = await prisma.funcionario.findUnique({
      where: { matricula: "ADMIN001" },
      include: { usuario: true }
    });

    console.log('\n=== VERIFICAÇÃO ===');
    console.log('Matrícula:', verificacao?.matricula);
    console.log('Nome:', verificacao?.nome);
    console.log('Email:', verificacao?.email);
    console.log('Usuário ativo:', verificacao?.usuario?.ativo);
    
    // Testar senha
    if (verificacao?.usuario?.senha) {
      const senhaCorreta = await bcrypt.compare("admin123", verificacao.usuario.senha);
      console.log('Senha "admin123" válida:', senhaCorreta);
    }

    console.log('\n🎉 Usuário administrador configurado com sucesso!');
    console.log('📋 CREDENCIAIS:');
    console.log('   Matrícula: ADMIN001');
    console.log('   Senha: admin123');

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdminUser();