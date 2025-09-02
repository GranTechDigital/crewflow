import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  try {
    console.log('Verificando todas as funções disponíveis no banco de dados...')
    
    const funcoes = await prisma.funcionario.findMany({
      select: {
        funcao: true
      },
      distinct: ['funcao'],
      where: {
        funcao: {
          not: null
        }
      }
    })
    
    console.log('\nFunções únicas encontradas:')
    const funcoesOrdenadas = funcoes
      .map(item => item.funcao)
      .filter(Boolean)
      .sort()
    
    funcoesOrdenadas.forEach(funcao => {
      console.log(`- "${funcao}"`)
    })
    
    console.log(`\nTotal de funções únicas: ${funcoesOrdenadas.length}`)
    
    console.log('\nContagem por função (top 20):')
    const funcaoCounts = await prisma.funcionario.groupBy({
      by: ['funcao'],
      _count: {
        id: true
      },
      where: {
        funcao: {
          not: null
        }
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      },
      take: 20
    })
    
    funcaoCounts.forEach(item => {
      console.log(`- "${item.funcao}": ${item._count.id} funcionários`)
    })
    
  } catch (error) {
    console.error('Erro:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()