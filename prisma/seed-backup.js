import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const contratos = [
    {
      centroDeCusto: '6.21.01',
      nome: 'UN-BC-LOTE 2',
      numero: '4600677360',
      cliente: 'Petrobras',
      dataInicio: new Date('2025-01-01'),
      dataFim: new Date('2025-12-01'),
      status: 'Ativo',
      createdAt: new Date(),
    },
    {
      centroDeCusto: '6.21.02',
      nome: 'DESCOMISSIONAMENTO NO AÇU',
      numero: '4600677360',
      cliente: 'Petrobras',
      dataInicio: new Date('2025-01-01'),
      dataFim: new Date('2025-12-01'),
      status: 'Ativo',
      createdAt: new Date(),
    },
    {
      centroDeCusto: '6.21.03',
      nome: 'PERENCO - PCH-1 & PCH-2',
      numero: '4600677360',
      cliente: 'Petrobras',
      dataInicio: new Date('2025-01-01'),
      dataFim: new Date('2025-12-01'),
      status: 'Ativo',
      createdAt: new Date(),
    },
    {
      centroDeCusto: '6.24.01',
      nome: 'UN-BS-O&M SANTOS',
      numero: '4600679351',
      cliente: 'Petrobras',
      dataInicio: new Date('2025-01-01'),
      dataFim: new Date('2025-12-01'),
      status: 'Ativo',
      createdAt: new Date(),
    },
    {
      centroDeCusto: '6.24.02',
      nome: 'UN-BS | UMS/PAR',
      numero: '4600679351',
      cliente: 'Petrobras',
      dataInicio: new Date('2025-01-01'),
      dataFim: new Date('2025-12-01'),
      status: 'Ativo',
      createdAt: new Date(),
    },
    {
      centroDeCusto: '6.25.01',
      nome: 'TVD | UN-BC-LOTE 1',
      numero: '4600680673',
      cliente: 'Petrobras',
      dataInicio: new Date('2025-01-01'),
      dataFim: new Date('2025-12-01'),
      status: 'Ativo',
      createdAt: new Date(),
    },
  ]

  for (const contrato of contratos) {
    await prisma.contrato.create({ data: contrato })
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })