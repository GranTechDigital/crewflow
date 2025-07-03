import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Tarefas padrões por setor
const TAREFAS_PADRAO = {
  RH: [
    { tipo: 'RG', descricao: 'Verificar e validar documento de identidade (RG)' },
    { tipo: 'CPF', descricao: 'Verificar e validar CPF do funcionário' },
    { tipo: 'CTPS (ADMISSÃO E PROMOÇÃO)', descricao: 'Processar Carteira de Trabalho para admissão e promoção' },
    { tipo: 'ESCOLARIDADE', descricao: 'Verificar e validar comprovantes de escolaridade' },
    { tipo: 'COMPROVANTE DE RESIDÊNCIA', descricao: 'Verificar e validar comprovante de residência atualizado' },
    { tipo: 'PIS', descricao: 'Verificar e processar PIS do funcionário' },
    { tipo: 'COMPROVANTE DE QUITAÇÃO DE ANUIDADE (CREA OU CFT)', descricao: 'Verificar quitação de anuidade do conselho profissional' },
    { tipo: 'CERTIFICADO DE FUNÇÃO (ADMISSÃO E PROMOÇÃO)', descricao: 'Processar certificado de função para admissão e promoção' }
  ],
  MEDICINA: [
    { tipo: 'ASO', descricao: 'Realizar Atestado de Saúde Ocupacional (ASO)' }
  ],
  TREINAMENTO: [
    { tipo: 'REGRAS DE OURO', descricao: 'Treinamento sobre Regras de Ouro' },
    { tipo: 'CUIDADO COM AS MÃOS', descricao: 'Treinamento de Cuidado com as Mãos' },
    { tipo: 'INTEGRAÇÃO DE SMS', descricao: 'Integração de Sistema de Gestão de SMS' },
    { tipo: 'CBSP - SALVATAGEM', descricao: 'Curso Básico de Segurança de Plataforma - Salvatagem' },
    { tipo: 'T-HUET', descricao: 'Treinamento de Escape Subaquático de Helicóptero' },
    { tipo: 'CESS - CURSO DE EMBARCAÇÕES DE SOBREVIVENCIA E SALVAMENTO', descricao: 'Curso de Embarcações de Sobrevivência e Salvamento' },
    { tipo: 'CERR - C de Embarc.Rápidas de Resgate', descricao: 'Curso de Embarcações Rápidas de Resgate' },
    { tipo: 'CACI - CURSO AVANÇADO DE COMBATE A INCENDIO', descricao: 'Curso Avançado de Combate a Incêndio' },
    { tipo: 'NR-10 - ELETRICIDADE', descricao: 'NR-10 - Segurança em Instalações e Serviços em Eletricidade' },
    { tipo: 'NR-10 - ATM. EXPLOSIVA', descricao: 'NR-10 - Atmosfera Explosiva' },
    { tipo: 'NR-12 - MAQUINAS E EQUIPAMENTOS', descricao: 'NR-12 - Segurança no Trabalho em Máquinas e Equipamentos' },
    { tipo: 'NR-33 - ESPAÇO CONFINADO', descricao: 'NR-33 - Segurança e Saúde nos Trabalhos em Espaços Confinados' },
    { tipo: 'NR-33 EMERGENCIA E RESGATE - LÍDER', descricao: 'NR-33 Emergência e Resgate - Líder' },
    { tipo: 'NR-33 EMERGENCIA E RESGATE - OPERACIONAL', descricao: 'NR-33 Emergência e Resgate - Operacional' },
    { tipo: 'NR-34 - ADMISSIONAL', descricao: 'NR-34 - Condições e Meio Ambiente de Trabalho na Indústria da Construção e Reparação Naval - Admissional' },
    { tipo: 'NR-34 - OBSERVADOR DE TRABALHO À QUENTE', descricao: 'NR-34 - Observador de Trabalho à Quente' },
    { tipo: 'NR-34 - CURSO BÁSICO PARA TRABALHOS À QUENTE', descricao: 'NR-34 - Curso Básico para Trabalhos à Quente' },
    { tipo: 'NR-34 - CURSO BÁSICO DE SEGURANÇA EM TESTE DE ESTANQUEIDADE', descricao: 'NR-34 - Curso Básico de Segurança em Teste de Estanqueidade' },
    { tipo: 'NR-34.11 - CERTIFICADO TREINAMENTO PARA MONTAGEM DE ANDAIMES', descricao: 'NR-34.11 - Certificado Treinamento para Montagem de Andaimes' },
    { tipo: 'NR-35 - TRABALHO EM ALTURA', descricao: 'NR-35 - Trabalho em Altura' },
    { tipo: 'NR-37 - BÁSICO', descricao: 'NR-37 - Segurança e Saúde em Plataformas de Petróleo - Básico' },
    { tipo: 'NR-37 - AVANÇADO', descricao: 'NR-37 - Segurança e Saúde em Plataformas de Petróleo - Avançado' },
    { tipo: 'NR-37 - MOVIMENTAÇÃO DE CARGA', descricao: 'NR-37 - Movimentação de Carga' },
    { tipo: 'PE-1PBR-00223 – MS MOVIMENTAÇÃO DE CARGAS (ANEXO J)', descricao: 'Procedimento de Movimentação de Cargas (Anexo J)' },
    { tipo: 'OPERAÇÃO COM PISTOLA HILTI', descricao: 'Treinamento de Operação com Pistola Hilti' },
    { tipo: 'OPERAÇÃO COM MÁQUINA DE TORQUE', descricao: 'Treinamento de Operação com Máquina de Torque' },
    { tipo: 'LIDERANÇA', descricao: 'Treinamento de Liderança' },
    { tipo: 'ACESSO POR CORDAS', descricao: 'Treinamento de Acesso por Cordas' },
    { tipo: 'Qualificação para Ajudantes', descricao: 'Qualificação para Ajudantes' },
    { tipo: 'Qualificação para Inspetores', descricao: 'Qualificação para Inspetores' },
    { tipo: 'Curso para Pintores emitido pelo CQ', descricao: 'Curso para Pintores emitido pelo Controle de Qualidade' },
    { tipo: 'FORMAÇÃO HIDROJATISTA', descricao: 'Formação de Hidrojatista' },
    { tipo: 'EMITENTE DE PT', descricao: 'Treinamento para Emitente de Permissão de Trabalho' },
    { tipo: 'PERMISSÃO DE TRABALHO - PT', descricao: 'Treinamento de Permissão de Trabalho' },
    { tipo: 'PROCEDIMENTOS GRANSERVICES', descricao: 'Treinamento de Procedimentos GranServices' },
    { tipo: 'PROCEDIMENTOS PETROBRAS', descricao: 'Treinamento de Procedimentos Petrobras' }
  ]
};

// Setores válidos para validação
const SETORES_VALIDOS = ['RH', 'MEDICINA', 'TREINAMENTO'] as const;
type SetorValido = typeof SETORES_VALIDOS[number];

// Função para validar e normalizar setor
function normalizarSetor(setor: string): SetorValido | null {
  const setorUpper = setor.toUpperCase();
  return SETORES_VALIDOS.includes(setorUpper as SetorValido) ? setorUpper as SetorValido : null;
}

// POST: Gerar tarefas padrões para um funcionário
export async function POST(request: NextRequest) {
  try {
    const { funcionarioId, setores, criadoPor } = await request.json();

    // Debug: log dos dados recebidos
    console.log('Dados recebidos:', { funcionarioId, setores, criadoPor, tipo: typeof funcionarioId });

    if (!funcionarioId || !setores || !Array.isArray(setores) || setores.length === 0) {
      return NextResponse.json(
        { error: 'funcionarioId, setores (array) são obrigatórios' },
        { status: 400 }
      );
    }

    // Buscar o remanejamento do funcionário
    // Pode ser um número (id do funcionário) ou string UUID (id do RemanejamentoFuncionario)
    let remanejamentoFuncionario;
    let funcionario;
    
    // Debug: log dos dados recebidos
    console.log('Tentando buscar funcionário/remanejamento:', { funcionarioId, tipo: typeof funcionarioId });
    
    // Primeiro, tentar como UUID (id do RemanejamentoFuncionario)
    if (typeof funcionarioId === 'string' && funcionarioId.length > 10) {
      remanejamentoFuncionario = await prisma.remanejamentoFuncionario.findUnique({
        where: { id: funcionarioId },
        include: {
          funcionario: true
        }
      });
      
      if (remanejamentoFuncionario) {
        funcionario = remanejamentoFuncionario.funcionario;
        console.log('Encontrado por UUID do RemanejamentoFuncionario:', remanejamentoFuncionario.id);
      }
    }
    
    // Se não encontrou, tentar como número (id do funcionário)
    if (!remanejamentoFuncionario) {
      const funcionarioIdInt = parseInt(funcionarioId);
      
      if (!isNaN(funcionarioIdInt)) {
        // Verificar se o funcionário existe primeiro
        funcionario = await prisma.funcionario.findUnique({
          where: { id: funcionarioIdInt }
        });
        
        if (funcionario) {
          remanejamentoFuncionario = await prisma.remanejamentoFuncionario.findFirst({
            where: {
              funcionarioId: funcionarioIdInt
            },
            orderBy: {
              createdAt: 'desc'
            }
          });
          console.log('Encontrado por ID do funcionário:', funcionarioIdInt);
        }
      }
    }
    
    // Se ainda não encontrou, retornar erro
    if (!funcionario) {
      return NextResponse.json(
        { error: 'Funcionário não encontrado' },
        { status: 404 }
      );
    }

    if (!remanejamentoFuncionario) {
      return NextResponse.json(
        { error: 'Funcionário não possui remanejamento cadastrado' },
        { status: 404 }
      );
    }

    // Validar se é possível criar tarefas baseado no status do prestserv
    if (remanejamentoFuncionario.statusPrestserv === 'SUBMETIDO' || remanejamentoFuncionario.statusPrestserv === 'APROVADO') {
      return NextResponse.json(
        { error: 'Não é possível criar novas tarefas quando o prestserv está submetido ou aprovado' },
        { status: 400 }
      );
    }

    // Validar e normalizar setores
    const setoresValidos = [];
    for (const setor of setores) {
      const setorNormalizado = normalizarSetor(setor);
      if (setorNormalizado) {
        setoresValidos.push(setorNormalizado);
      } else {
        return NextResponse.json(
          { error: `Setor '${setor}' não é válido. Setores válidos: ${SETORES_VALIDOS.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Preparar todas as tarefas para criação em lote
    const tarefasParaCriar = [];
    
    for (const setor of setoresValidos) {
      const tarefasSetor = TAREFAS_PADRAO[setor];

      if (!tarefasSetor) {
        console.warn(`Setor ${setor} não possui tarefas padrões definidas`);
        continue;
      }

      // Adicionar cada tarefa do setor ao array
      for (const tarefaPadrao of tarefasSetor) {
        tarefasParaCriar.push({
          remanejamentoFuncionarioId: remanejamentoFuncionario.id,
          tipo: tarefaPadrao.tipo,
          descricao: tarefaPadrao.descricao,
          responsavel: setor,
          status: 'PENDENTE',
          prioridade: 'Alta',
          dataLimite: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 dias
        });
      }
    }

    // Criar todas as tarefas de uma vez usando createMany (mais eficiente)
    if (tarefasParaCriar.length === 0) {
      return NextResponse.json({
        message: 'Nenhuma tarefa foi criada - setores inválidos ou sem tarefas definidas',
        tarefas: [],
        funcionario,
        setoresProcessados: setoresValidos
      });
    }

    const result = await prisma.tarefaRemanejamento.createMany({
      data: tarefasParaCriar
    });

    // Buscar as tarefas criadas para retornar na resposta
    const tarefasCriadas = await prisma.tarefaRemanejamento.findMany({
      where: {
        remanejamentoFuncionarioId: remanejamentoFuncionario.id
      },
      orderBy: {
        dataCriacao: 'desc'
      },
      take: result.count
    });

    // Registrar no histórico a criação das tarefas padrão
    try {
      await prisma.historicoRemanejamento.create({
        data: {
          solicitacaoId: remanejamentoFuncionario.solicitacaoId,
          remanejamentoFuncionarioId: remanejamentoFuncionario.id,
          tipoAcao: 'CRIACAO',
          entidade: 'TAREFA',
          descricaoAcao: `${tarefasCriadas.length} tarefas padrão criadas para ${funcionario.nome} (${funcionario.matricula}) - Setores: ${setoresValidos.join(', ')}`,
          usuarioResponsavel: criadoPor || 'Sistema',
          observacoes: `Tarefas criadas: ${tarefasCriadas.map(t => t.tipo).join(', ')}`
        }
      });
    } catch (historicoError) {
      console.error('Erro ao registrar histórico:', historicoError);
      // Não falha a criação das tarefas se o histórico falhar
    }

    return NextResponse.json({
      message: `${tarefasCriadas.length} tarefas padrões criadas com sucesso`,
      tarefas: tarefasCriadas,
      funcionario: {
        id: funcionario.id,
        nome: funcionario.nome,
        matricula: funcionario.matricula
      }
    });

  } catch (error) {
    console.error('Erro ao criar tarefas padrões:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json(
      { error: 'Erro ao criar tarefas padrões', details: message, stack: error instanceof Error ? error.stack : undefined },
      { status: 500 }
    );
  }
}

// GET: Listar tarefas padrões disponíveis
export async function GET() {
  try {
    return NextResponse.json({
      setores: Object.keys(TAREFAS_PADRAO),
      tarefasPadrao: TAREFAS_PADRAO
    });
  } catch (error) {
    console.error('Erro ao listar tarefas padrões:', error);
    return NextResponse.json(
      { error: 'Erro ao listar tarefas padrões' },
      { status: 500 }
    );
  }
}