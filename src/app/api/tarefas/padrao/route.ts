import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Setores válidos para validação
const SETORES_VALIDOS = ["RH", "MEDICINA", "TREINAMENTO"] as const;
type SetorValido = (typeof SETORES_VALIDOS)[number];

// Função para validar e normalizar setor
function normalizarSetor(setor: string): SetorValido | null {
  const setorUpper = setor.toUpperCase();
  return SETORES_VALIDOS.includes(setorUpper as SetorValido)
    ? (setorUpper as SetorValido)
    : null;
}

// POST: Gerar tarefas padrões para um funcionário
export async function POST(request: NextRequest) {
  try {
    const { funcionarioId, setores, criadoPor } = await request.json();

    // Debug: log dos dados recebidos
    console.log("Dados recebidos:", {
      funcionarioId,
      setores,
      criadoPor,
      tipo: typeof funcionarioId,
    });

    if (
      !funcionarioId ||
      !setores ||
      !Array.isArray(setores) ||
      setores.length === 0
    ) {
      return NextResponse.json(
        { error: "funcionarioId, setores (array) são obrigatórios" },
        { status: 400 }
      );
    }

    // Buscar o remanejamento do funcionário
    // Pode ser um número (id do funcionário) ou string UUID (id do RemanejamentoFuncionario)
    let remanejamentoFuncionario;
    let funcionario;

    // Debug: log dos dados recebidos
    console.log("Tentando buscar funcionário/remanejamento:", {
      funcionarioId,
      tipo: typeof funcionarioId,
    });

    // Primeiro, tentar como UUID (id do RemanejamentoFuncionario)
    if (typeof funcionarioId === "string" && funcionarioId.length > 10) {
      remanejamentoFuncionario =
        await prisma.remanejamentoFuncionario.findUnique({
          where: { id: funcionarioId },
          include: {
            funcionario: true,
          },
        });

      if (remanejamentoFuncionario) {
        funcionario = remanejamentoFuncionario.funcionario;
        console.log(
          "Encontrado por UUID do RemanejamentoFuncionario:",
          remanejamentoFuncionario.id
        );
      }
    }

    // Se não encontrou, tentar como número (id do funcionário)
    if (!remanejamentoFuncionario) {
      const funcionarioIdInt = parseInt(funcionarioId);

      if (!isNaN(funcionarioIdInt)) {
        // Verificar se o funcionário existe primeiro
        funcionario = await prisma.funcionario.findUnique({
          where: { id: funcionarioIdInt },
        });

        if (funcionario) {
          remanejamentoFuncionario =
            await prisma.remanejamentoFuncionario.findFirst({
              where: {
                funcionarioId: funcionarioIdInt,
              },
              orderBy: {
                createdAt: "desc",
              },
            });
          console.log("Encontrado por ID do funcionário:", funcionarioIdInt);
        }
      }
    }

    // Se ainda não encontrou, retornar erro
    if (!funcionario) {
      return NextResponse.json(
        { error: "Funcionário não encontrado" },
        { status: 404 }
      );
    }

    if (!remanejamentoFuncionario) {
      return NextResponse.json(
        { error: "Funcionário não possui remanejamento cadastrado" },
        { status: 404 }
      );
    }

    // Validar se é possível reprovar tarefas baseado no status do prestserv
    if (
      remanejamentoFuncionario.statusPrestserv === "EM_AVALIACAO" ||
      remanejamentoFuncionario.statusPrestserv === "CONCLUIDO" ||
      remanejamentoFuncionario.statusPrestserv === "CANCELADO"
    ) {
      return NextResponse.json(
        {
          error:
            "Não é possível criar novas tarefas quando o prestserv está em avaliação ou concluído",
        },
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
          {
            error: `Setor '${setor}' não é válido. Setores válidos: ${SETORES_VALIDOS.join(
              ", "
            )}`,
          },
          { status: 400 }
        );
      }
    }

    // Preparar todas as tarefas para criação em lote
    const tarefasParaCriar = [];

    for (const setor of setoresValidos) {
      // Buscar tarefas padrão do banco de dados para o setor
      const tarefasSetor = await prisma.tarefaPadrao.findMany({
        where: {
          setor,
          ativo: true,
        },
        select: {
          tipo: true,
          descricao: true,
        },
      });

      if (!tarefasSetor || tarefasSetor.length === 0) {
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
          status: "PENDENTE",
          prioridade: "Alta",
          dataLimite: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 dias
        });
      }
    }

    // Criar todas as tarefas de uma vez usando createMany (mais eficiente)
    if (tarefasParaCriar.length === 0) {
      return NextResponse.json({
        message:
          "Nenhuma tarefa foi criada - setores inválidos ou sem tarefas definidas",
        tarefas: [],
        funcionario,
        setoresProcessados: setoresValidos,
      });
    }

    const result = await prisma.tarefaRemanejamento.createMany({
      data: tarefasParaCriar,
    });

    // Buscar as tarefas criadas para retornar na resposta
    const tarefasCriadas = await prisma.tarefaRemanejamento.findMany({
      where: {
        remanejamentoFuncionarioId: remanejamentoFuncionario.id,
      },
      orderBy: {
        dataCriacao: "desc",
      },
      take: result.count,
    });

    // Atualizar status geral para ATENDER TAREFAS após criação das tarefas
    try {
      await prisma.remanejamentoFuncionario.update({
        where: { id: remanejamentoFuncionario.id },
        data: { statusTarefas: "ATENDER TAREFAS" },
      });
    } catch (statusError) {
      console.error("Erro ao atualizar status geral:", statusError);
      // Não falha a criação das tarefas se a atualização do status falhar
    }

    // Registrar no histórico a criação das tarefas padrão
    try {
      await prisma.historicoRemanejamento.create({
        data: {
          solicitacaoId: remanejamentoFuncionario.solicitacaoId,
          remanejamentoFuncionarioId: remanejamentoFuncionario.id,
          tipoAcao: "CRIACAO",
          entidade: "TAREFA",
          descricaoAcao: `${
            tarefasCriadas.length
          } tarefas padrão criadas para ${funcionario.nome} (${
            funcionario.matricula
          }) - Setores: ${setoresValidos.join(", ")}`,
          usuarioResponsavel: criadoPor || "Sistema",
          observacoes: `Tarefas criadas: ${tarefasCriadas
            .map((t) => t.tipo)
            .join(", ")}`,
        },
      });
    } catch (historicoError) {
      console.error("Erro ao registrar histórico:", historicoError);
      // Não falha a criação das tarefas se o histórico falhar
    }

    return NextResponse.json({
      message: `${tarefasCriadas.length} tarefas padrões criadas com sucesso`,
      tarefas: tarefasCriadas,
      funcionario: {
        id: funcionario.id,
        nome: funcionario.nome,
        matricula: funcionario.matricula,
      },
    });
  } catch (error) {
    console.error("Erro ao reprovar tarefas padrões:", error);
    console.error(
      "Error stack:",
      error instanceof Error ? error.stack : "No stack trace"
    );
    const message =
      error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json(
      {
        error: "Erro ao reprovar tarefas padrões",
        details: message,
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

// GET: Listar tarefas padrões disponíveis
export async function GET() {
  try {
    // Buscar todas as tarefas ativas do banco de dados
    const tarefas = await prisma.tarefaPadrao.findMany({
      where: {
        ativo: true,
      },
      select: {
        id: true,
        setor: true,
        tipo: true,
        descricao: true,
      },
      orderBy: [{ setor: "asc" }, { tipo: "asc" }],
    });

    // Organizar tarefas por setor
    const tarefasPorSetor = tarefas.reduce((acc, tarefa) => {
      if (!acc[tarefa.setor]) {
        acc[tarefa.setor] = [];
      }
      acc[tarefa.setor].push({
        id: tarefa.id,
        tipo: tarefa.tipo,
        descricao: tarefa.descricao,
      });
      return acc;
    }, {} as Record<string, any[]>);

    return NextResponse.json({
      setores: SETORES_VALIDOS,
      tarefasPadrao: tarefasPorSetor,
    });
  } catch (error) {
    console.error("Erro ao listar tarefas padrões:", error);
    return NextResponse.json(
      { error: "Erro ao listar tarefas padrões" },
      { status: 500 }
    );
  }
}
