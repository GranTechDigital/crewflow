import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  try {
    console.log('Verificando valores únicos de status no banco de dados...')
    
    const statusValues = await prisma.funcionario.findMany({
      select: {
        status: true
      },
      distinct: ['status']
    })
    
    console.log('\nValores únicos de status encontrados:')
    statusValues.forEach(item => {
      console.log(`- "${item.status || 'null'}"`)
    })
    
    console.log('\nContagem por status:')
    const statusCounts = await prisma.funcionario.groupBy({
      by: ['status'],
      _count: {
        id: true
      }
    })
    
    statusCounts.forEach(item => {
      console.log(`- "${item.status || 'null'}": ${item._count.id} funcionários`)
    })
    
  } catch (error) {
    console.error('Erro:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()