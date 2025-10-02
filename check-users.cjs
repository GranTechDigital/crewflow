const { PrismaClient } = require('@prisma/client');

async function checkUsers() {
  const prisma = new PrismaClient();
  
  try {
    const users = await prisma.usuario.findMany();
    console.log('Usuários encontrados:', users.length);
    
    if (users.length > 0) {
      console.log('Primeiro usuário:', users[0]);
    }
  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();