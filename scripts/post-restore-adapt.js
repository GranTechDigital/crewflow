import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Garantir equipe padrão se banco não tiver nenhuma
  const equipesCount = await prisma.equipe.count()
  if (equipesCount === 0) {
    await prisma.equipe.create({ data: { nome: 'Administração', descricao: null } })
  }

  // Obrigar todos os usuários a cadastrar e-mail e trocar a senha
  await prisma.usuario.updateMany({
    data: {
      obrigarAdicionarEmail: true,
      obrigarTrocaSenha: true,
    },
  })
}

main()
  .catch((e) => {
    console.error('Erro no pós-restauração:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })