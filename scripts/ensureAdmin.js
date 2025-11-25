import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function ensureAdmin() {
  const adminMatricula = process.env.ADMIN_USER || 'ADMIN001';
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@gransystem.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  let funcionario = await prisma.funcionario.findUnique({ where: { matricula: adminMatricula } });
  if (!funcionario) {
    funcionario = await prisma.funcionario.create({
      data: {
        matricula: adminMatricula,
        nome: 'Administrador do Sistema',
        cpf: '00000000000',
        email: adminEmail,
        telefone: '(11) 99999-9999',
        funcao: 'Administrador',
        departamento: 'TI',
        centroCusto: 'ADMIN',
        status: 'ATIVO',
      },
    });
  }

  const usuario = await prisma.usuario.findFirst({ where: { funcionarioId: funcionario.id } });
  if (!usuario) {
    const hash = await bcrypt.hash(adminPassword, 10);
    await prisma.usuario.create({
      data: {
        senha: hash,
        ativo: true,
        funcionarioId: funcionario.id,
      },
    });
  }

  console.log('✅ Admin ensured');
}

ensureAdmin()
  .catch((e) => {
    console.error('Erro ao garantir admin:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });