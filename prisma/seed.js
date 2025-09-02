import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

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
    const created = await prisma.centroCusto.upsert({
      where: { num_centro_custo: centroCusto.num_centro_custo },
      update: {},
      create: centroCusto,
    })
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
    const created = await prisma.contrato.upsert({
      where: { numero: contrato.numero },
      update: {},
      create: contrato,
    })
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
    await prisma.contratosCentrosCusto.upsert({
      where: {
        contratoId_centroCustoId: {
          contratoId: vinculacao.contratoId,
          centroCustoId: vinculacao.centroCustoId,
        },
      },
      update: {},
      create: vinculacao,
    })
    console.log(`Vinculação criada: Contrato ${vinculacao.contratoId} <-> Centro de Custo ${vinculacao.centroCustoId}`)
  }

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
  ]

  console.log('📋 Criando equipes...')
  const equipesCriadas = []
  for (const equipeData of equipes) {
    const equipe = await prisma.equipe.upsert({
      where: { nome: equipeData.nome },
      update: {},
      create: equipeData
    })
    equipesCriadas.push(equipe)
    console.log(`✅ Equipe "${equipe.nome}" criada`)
  }

  // Criar funcionário administrador
  console.log('👤 Criando funcionário administrador...')
  const adminFuncionario = await prisma.funcionario.upsert({
    where: { matricula: 'ADMIN001' },
    update: {},
    create: {
      matricula: 'ADMIN001',
      nome: 'Administrador do Sistema',
      email: 'admin@gransystem.com',
      funcao: 'Administrador',
      departamento: 'TI',
      status: 'ATIVO'
    }
  })
  console.log('✅ Funcionário administrador criado')



  // Criar usuário administrador
  console.log('🔐 Criando usuário administrador...')
  const equipeAdmin = equipesCriadas.find(e => e.nome === 'Administração')
  
  if (equipeAdmin) {
    const senhaHash = await bcrypt.hash('admin123', 12)
    
    await prisma.usuario.upsert({
      where: { funcionarioId: adminFuncionario.id },
      update: {},
      create: {
        funcionarioId: adminFuncionario.id,
        senha: senhaHash,
        equipeId: equipeAdmin.id
      }
    })
    console.log('✅ Usuário administrador criado')
    console.log('📝 Credenciais do administrador:')
    console.log('   Matrícula: ADMIN001')
    console.log('   Senha: admin123')
    console.log('   ⚠️  IMPORTANTE: Altere a senha após o primeiro login!')
  }

  // Criar tarefas padrão
  const tarefasPadrao = [
    // RH
    { setor: 'RH', tipo: 'RG', descricao: 'Verificar e validar documento de identidade (RG)' },
    { setor: 'RH', tipo: 'CPF', descricao: 'Verificar e validar CPF do funcionário' },
    { setor: 'RH', tipo: 'CTPS (ADMISSÃO E PROMOÇÃO)', descricao: 'Processar Carteira de Trabalho para admissão e promoção' },
    { setor: 'RH', tipo: 'ESCOLARIDADE', descricao: 'Verificar e validar comprovantes de escolaridade' },
    { setor: 'RH', tipo: 'COMPROVANTE DE RESIDÊNCIA', descricao: 'Verificar e validar comprovante de residência atualizado' },
    { setor: 'RH', tipo: 'PIS', descricao: 'Verificar e processar PIS do funcionário' },
    { setor: 'RH', tipo: 'COMPROVANTE DE QUITAÇÃO DE ANUIDADE (CREA OU CFT)', descricao: 'Verificar quitação de anuidade do conselho profissional' },
    { setor: 'RH', tipo: 'CERTIFICADO DE FUNÇÃO (ADMISSÃO E PROMOÇÃO)', descricao: 'Processar certificado de função para admissão e promoção' },
    
    // MEDICINA
    { setor: 'MEDICINA', tipo: 'ASO', descricao: 'Realizar Atestado de Saúde Ocupacional (ASO)' },
    
    // TREINAMENTO
    { setor: 'TREINAMENTO', tipo: 'REGRAS DE OURO', descricao: 'Treinamento sobre Regras de Ouro' },
    { setor: 'TREINAMENTO', tipo: 'CUIDADO COM AS MÃOS', descricao: 'Treinamento de Cuidado com as Mãos' },
    { setor: 'TREINAMENTO', tipo: 'INTEGRAÇÃO DE SMS', descricao: 'Integração de Sistema de Gestão de SMS' },
    { setor: 'TREINAMENTO', tipo: 'CBSP - SALVATAGEM', descricao: 'Curso Básico de Segurança de Plataforma - Salvatagem' },
    { setor: 'TREINAMENTO', tipo: 'T-HUET', descricao: 'Treinamento de Escape Subaquático de Helicóptero' },
    { setor: 'TREINAMENTO', tipo: 'CESS - CURSO DE EMBARCAÇÕES DE SOBREVIVENCIA E SALVAMENTO', descricao: 'Curso de Embarcações de Sobrevivência e Salvamento' },
    { setor: 'TREINAMENTO', tipo: 'CERR - C de Embarc.Rápidas de Resgate', descricao: 'Curso de Embarcações Rápidas de Resgate' },
    { setor: 'TREINAMENTO', tipo: 'CACI - CURSO AVANÇADO DE COMBATE A INCENDIO', descricao: 'Curso Avançado de Combate a Incêndio' },
    { setor: 'TREINAMENTO', tipo: 'NR-10 - ELETRICIDADE', descricao: 'NR-10 - Segurança em Instalações e Serviços em Eletricidade' },
    { setor: 'TREINAMENTO', tipo: 'NR-10 - ATM. EXPLOSIVA', descricao: 'NR-10 - Atmosfera Explosiva' },
    { setor: 'TREINAMENTO', tipo: 'NR-12 - MAQUINAS E EQUIPAMENTOS', descricao: 'NR-12 - Segurança no Trabalho em Máquinas e Equipamentos' },
    { setor: 'TREINAMENTO', tipo: 'NR-33 - ESPAÇO CONFINADO', descricao: 'NR-33 - Segurança e Saúde nos Trabalhos em Espaços Confinados' },
    { setor: 'TREINAMENTO', tipo: 'NR-33 EMERGENCIA E RESGATE - LÍDER', descricao: 'NR-33 Emergência e Resgate - Líder' },
    { setor: 'TREINAMENTO', tipo: 'NR-33 EMERGENCIA E RESGATE - OPERACIONAL', descricao: 'NR-33 Emergência e Resgate - Operacional' },
    { setor: 'TREINAMENTO', tipo: 'NR-34 - ADMISSIONAL', descricao: 'NR-34 - Condições e Meio Ambiente de Trabalho na Indústria da Construção e Reparação Naval - Admissional' },
    { setor: 'TREINAMENTO', tipo: 'NR-34 - OBSERVADOR DE TRABALHO À QUENTE', descricao: 'NR-34 - Observador de Trabalho à Quente' },
    { setor: 'TREINAMENTO', tipo: 'NR-34 - CURSO BÁSICO PARA TRABALHOS À QUENTE', descricao: 'NR-34 - Curso Básico para Trabalhos à Quente' },
    { setor: 'TREINAMENTO', tipo: 'NR-34 - CURSO BÁSICO DE SEGURANÇA EM TESTE DE ESTANQUEIDADE', descricao: 'NR-34 - Curso Básico de Segurança em Teste de Estanqueidade' },
    { setor: 'TREINAMENTO', tipo: 'NR-34.11 - CERTIFICADO TREINAMENTO PARA MONTAGEM DE ANDAIMES', descricao: 'NR-34.11 - Certificado Treinamento para Montagem de Andaimes' },
    { setor: 'TREINAMENTO', tipo: 'NR-35 - TRABALHO EM ALTURA', descricao: 'NR-35 - Trabalho em Altura' },
    { setor: 'TREINAMENTO', tipo: 'NR-37 - BÁSICO', descricao: 'NR-37 - Segurança e Saúde em Plataformas de Petróleo - Básico' },
    { setor: 'TREINAMENTO', tipo: 'NR-37 - AVANÇADO', descricao: 'NR-37 - Segurança e Saúde em Plataformas de Petróleo - Avançado' },
    { setor: 'TREINAMENTO', tipo: 'NR-37 - MOVIMENTAÇÃO DE CARGA', descricao: 'NR-37 - Movimentação de Carga' },
    { setor: 'TREINAMENTO', tipo: 'PE-1PBR-00223 – MS MOVIMENTAÇÃO DE CARGAS (ANEXO J)', descricao: 'Procedimento de Movimentação de Cargas (Anexo J)' },
    { setor: 'TREINAMENTO', tipo: 'OPERAÇÃO COM PISTOLA HILTI', descricao: 'Treinamento de Operação com Pistola Hilti' },
    { setor: 'TREINAMENTO', tipo: 'OPERAÇÃO COM MÁQUINA DE TORQUE', descricao: 'Treinamento de Operação com Máquina de Torque' },
    { setor: 'TREINAMENTO', tipo: 'LIDERANÇA', descricao: 'Treinamento de Liderança' },
    { setor: 'TREINAMENTO', tipo: 'ACESSO POR CORDAS', descricao: 'Treinamento de Acesso por Cordas' },
    { setor: 'TREINAMENTO', tipo: 'Qualificação para Ajudantes', descricao: 'Qualificação para Ajudantes' },
    { setor: 'TREINAMENTO', tipo: 'Qualificação para Inspetores', descricao: 'Qualificação para Inspetores' },
    { setor: 'TREINAMENTO', tipo: 'Curso para Pintores emitido pelo CQ', descricao: 'Curso para Pintores emitido pelo Controle de Qualidade' },
    { setor: 'TREINAMENTO', tipo: 'FORMAÇÃO HIDROJATISTA', descricao: 'Formação de Hidrojatista' },
    { setor: 'TREINAMENTO', tipo: 'EMITENTE DE PT', descricao: 'Treinamento para Emitente de Permissão de Trabalho' },
    { setor: 'TREINAMENTO', tipo: 'PERMISSÃO DE TRABALHO - PT', descricao: 'Treinamento de Permissão de Trabalho' },
    { setor: 'TREINAMENTO', tipo: 'PROCEDIMENTOS GRANSERVICES', descricao: 'Treinamento de Procedimentos GranServices' },
    { setor: 'TREINAMENTO', tipo: 'PROCEDIMENTOS PETROBRAS', descricao: 'Treinamento de Procedimentos Petrobras' }
  ]

  console.log('\nCriando tarefas padrão...')
  let tarefasPadraoCriadas = 0
  for (const tarefa of tarefasPadrao) {
    const existing = await prisma.tarefaPadrao.findFirst({
      where: {
        setor: tarefa.setor,
        tipo: tarefa.tipo
      }
    })
    
    if (!existing) {
      await prisma.tarefaPadrao.create({
        data: tarefa
      })
      tarefasPadraoCriadas++
    }
  }
  console.log(`${tarefasPadraoCriadas} tarefas padrão criadas`)

  console.log('\n🎉 Seed concluído com sucesso!')
  console.log(`- ${centrosCustoCriados.length} centros de custo criados`)
  console.log(`- ${contratosCriados.length} contratos criados`)
  console.log(`- ${vinculacoes.length} vinculações criadas`)
  console.log(`- ${equipesCriadas.length} equipes criadas`)
  console.log(`- ${tarefasPadraoCriadas} tarefas padrão criadas`)
  console.log('- 1 funcionário administrador criado')
  console.log('- 1 usuário administrador criado')
}

main()
  .catch((e) => {
    console.error('Erro durante o seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })