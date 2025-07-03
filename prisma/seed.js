import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Primeiro, criar os centros de custo
  const centrosCusto = [
    {
      num_centro_custo: '6.21.01',
      nome_centro_custo: 'Centro de Custo UN-BC-LOTE 2',
      status: 'Ativo',
    },
    {
      num_centro_custo: '6.21.02',
      nome_centro_custo: 'Centro de Custo Descomissionamento',
      status: 'Ativo',
    },
    {
      num_centro_custo: '6.21.03',
      nome_centro_custo: 'Centro de Custo PERENCO',
      status: 'Ativo',
    },
    {
      num_centro_custo: '6.24.01',
      nome_centro_custo: 'Centro de Custo UN-BS-O&M',
      status: 'Ativo',
    },
    {
      num_centro_custo: '6.24.02',
      nome_centro_custo: 'Centro de Custo UN-BS UMS/PAR',
      status: 'Ativo',
    },
    {
      num_centro_custo: '6.25.01',
      nome_centro_custo: 'Centro de Custo TVD UN-BC',
      status: 'Ativo',
    },
  ]

  console.log('Criando centros de custo...')
  const centrosCustoCriados = []
  for (const centroCusto of centrosCusto) {
    const created = await prisma.centroCusto.create({ data: centroCusto })
    centrosCustoCriados.push(created)
    console.log(`Centro de custo criado: ${created.num_centro_custo} - ${created.nome_centro_custo}`)
  }

  // Depois, criar os contratos (sem centro de custo)
  const contratos = [
    {
      nome: 'UN-BC-LOTE 2',
      numero: '4600677360',
      cliente: 'Petrobras',
      dataInicio: new Date('2025-01-01'),
      dataFim: new Date('2025-12-01'),
      status: 'Ativo',
    },
    {
      nome: 'DESCOMISSIONAMENTO NO AÇU',
      numero: '4600677361',
      cliente: 'Petrobras',
      dataInicio: new Date('2025-01-01'),
      dataFim: new Date('2025-12-01'),
      status: 'Ativo',
    },
    {
      nome: 'PERENCO - PCH-1 & PCH-2',
      numero: '4600677362',
      cliente: 'Petrobras',
      dataInicio: new Date('2025-01-01'),
      dataFim: new Date('2025-12-01'),
      status: 'Ativo',
    },
    {
      nome: 'UN-BS-O&M SANTOS',
      numero: '4600679351',
      cliente: 'Petrobras',
      dataInicio: new Date('2025-01-01'),
      dataFim: new Date('2025-12-01'),
      status: 'Ativo',
    },
    {
      nome: 'UN-BS | UMS/PAR',
      numero: '4600679352',
      cliente: 'Petrobras',
      dataInicio: new Date('2025-01-01'),
      dataFim: new Date('2025-12-01'),
      status: 'Ativo',
    },
    {
      nome: 'TVD | UN-BC-LOTE 1',
      numero: '4600680673',
      cliente: 'Petrobras',
      dataInicio: new Date('2025-01-01'),
      dataFim: new Date('2025-12-01'),
      status: 'Ativo',
    },
  ]

  console.log('Criando contratos...')
  const contratosCriados = []
  for (const contrato of contratos) {
    const created = await prisma.contrato.create({ data: contrato })
    contratosCriados.push(created)
    console.log(`Contrato criado: ${created.numero} - ${created.nome}`)
  }

  // Por fim, criar as vinculações entre contratos e centros de custo
  const vinculacoes = [
    { contratoId: contratosCriados[0].id, centroCustoId: centrosCustoCriados[0].id }, // UN-BC-LOTE 2 -> 6.21.01
    { contratoId: contratosCriados[1].id, centroCustoId: centrosCustoCriados[1].id }, // DESCOMISSIONAMENTO -> 6.21.02
    { contratoId: contratosCriados[2].id, centroCustoId: centrosCustoCriados[2].id }, // PERENCO -> 6.21.03
    { contratoId: contratosCriados[3].id, centroCustoId: centrosCustoCriados[3].id }, // UN-BS-O&M -> 6.24.01
    { contratoId: contratosCriados[4].id, centroCustoId: centrosCustoCriados[4].id }, // UN-BS UMS/PAR -> 6.24.02
    { contratoId: contratosCriados[5].id, centroCustoId: centrosCustoCriados[5].id }, // TVD -> 6.25.01
  ]

  console.log('Criando vinculações...')
  for (const vinculacao of vinculacoes) {
    const created = await prisma.contratosCentrosCusto.create({ data: vinculacao })
    console.log(`Vinculação criada: Contrato ${vinculacao.contratoId} <-> Centro de Custo ${vinculacao.centroCustoId}`)
  }

  console.log('Seed concluído com sucesso!')
  console.log(`- ${centrosCustoCriados.length} centros de custo criados`)
  console.log(`- ${contratosCriados.length} contratos criados`)
  console.log(`- ${vinculacoes.length} vinculações criadas`)
}

main()
  .catch((e) => {
    console.error('Erro durante o seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })