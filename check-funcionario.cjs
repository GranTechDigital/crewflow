const { PrismaClient } = require('@prisma/client');

async function checkFuncionario() {
  const prisma = new PrismaClient();
  
  try {
    const funcionario = await prisma.funcionario.findUnique({
      where: { id: 1 }
    });
    
    console.log('Funcionário encontrado:', funcionario);
  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkFuncionario();