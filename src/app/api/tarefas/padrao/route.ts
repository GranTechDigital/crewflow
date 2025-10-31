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

// Função para gerar tarefas de treinamento baseadas na matriz
async function gerarTarefasTreinamento(
  remanejamentoFuncionario: Record<string, unknown>,
  funcionario: Record<string, unknown>,
  tarefasParaCriar: Record<string, unknown>[],
  prioridadeSolicitacao: string
) {
  console.log("=== INICIANDO GERAÇÃO DE TAREFAS DE TREINAMENTO ===");
  console.log("RemanejamentoFuncionario ID:", remanejamentoFuncionario?.id);
  console.log("Funcionario ID:", funcionario?.id);
  console.log("Funcionario Nome:", funcionario?.nome);
  console.log("Funcionario Funcao:", funcionario?.funcao);

  try {
    // Buscar a solicitação de remanejamento para obter o contrato de destino
    const solicitacao = await prisma.solicitacaoRemanejamento.findUnique({
      where: { id: remanejamentoFuncionario.solicitacaoId as number },
      include: {
        contratoDestino: true,
      },
    });

    console.log("Solicitacao encontrada:", !!solicitacao);
    console.log("Contrato destino ID:", solicitacao?.contratoDestinoId);

    if (!solicitacao || !solicitacao.contratoDestinoId) {
      console.log("❌ Solicitação ou contrato de destino não encontrado");
      return;
    }

    const contratoId = solicitacao.contratoDestinoId;
    const funcaoNome = funcionario.funcao;

    if (!funcaoNome) {
      console.log("❌ Função do funcionário não encontrada");
      return;
    }

    // Buscar a função na tabela Funcao (não Funcoes)
    const funcao = await prisma.funcao.findFirst({
      where: { funcao: funcaoNome },
    });

    console.log("Funcao encontrada:", !!funcao);
    console.log("Funcao ID:", funcao?.id);

    if (!funcao) {
      console.log("❌ Função não encontrada na tabela Funcoes");
      return;
    }

    // Buscar treinamentos na matriz baseado no contrato e função
    const matrizTreinamento = await prisma.matrizTreinamento.findMany({
      where: {
        contratoId: contratoId,
        funcaoId: funcao.id,
        ativo: true,
        tipoObrigatoriedade: 'AP',
      },
      include: {
        treinamento: true,
        contrato: true,
      },
    });

    console.log("Registros encontrados na matriz:", matrizTreinamento.length);

    if (matrizTreinamento.length === 0) {
      console.log("❌ Nenhum treinamento encontrado na matriz");
      console.log("Parâmetros da busca:");
      console.log("- contratoId:", contratoId);
      console.log("- funcaoId:", funcao.id);
      console.log("- ativo: true");
      return;
    }

    // Gerar tarefas baseadas na matriz de treinamento
    let tarefasGeradas = 0;
    for (const matriz of matrizTreinamento) {
      const treinamento = matriz.treinamento;
      
      if (!treinamento) {
        console.log("⚠️ Treinamento não encontrado para matriz:", matriz.id);
        continue;
      }

      // Usar a prioridade da solicitação de remanejamento, normalizada em maiúsculas
      const prioridade = (() => {
        const v = (prioridadeSolicitacao || "media").toLowerCase();
        if (v === "baixa") return "BAIXA";
        if (v === "media") return "MEDIA";
        if (v === "alta") return "ALTA";
        if (v === "urgente") return "URGENTE";
        return "MEDIA";
      })();

      // Criar descrição detalhada
      const descricao = `Treinamento: ${treinamento.treinamento}
Carga Horária: ${treinamento.cargaHoraria || "N/A"}
Validade: ${treinamento.validadeValor || "N/A"} ${treinamento.validadeUnidade || ""}
Tipo: ${matriz.tipoObrigatoriedade}
Contrato: ${matriz.contrato?.nome || "N/A"}`;

      const novaTarefa = {
        remanejamentoFuncionarioId: remanejamentoFuncionario.id,
        tipo: treinamento.treinamento,
        descricao: descricao,
        responsavel: "TREINAMENTO",
        status: "PENDENTE",
        prioridade: prioridade,
        dataLimite: new Date(Date.now() + 48 * 60 * 60 * 1000),
      };

      tarefasParaCriar.push(novaTarefa);
      tarefasGeradas++;
      console.log(`✅ Tarefa ${tarefasGeradas} criada:`, treinamento.treinamento);
    }

    console.log(`✅ Total de tarefas de treinamento geradas: ${tarefasGeradas}`);
  } catch (error) {
    console.error("❌ Erro ao gerar tarefas de treinamento:", error);
  }
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
            solicitacao: true,
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
              include: {
                solicitacao: true,
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
      if (setor === "TREINAMENTO") {
        // Para o setor TREINAMENTO, usar a matriz de treinamento
        await gerarTarefasTreinamento(
          remanejamentoFuncionario,
          funcionario,
          tarefasParaCriar,
          remanejamentoFuncionario.solicitacao?.prioridade || "media"
        );
      } else {
        // Para RH e MEDICINA, usar tarefas padrão como antes
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
            prioridade: (() => {
               const v = (remanejamentoFuncionario.solicitacao?.prioridade || "media").toLowerCase();
               if (v === "baixa") return "BAIXA";
               if (v === "media") return "MEDIA";
               if (v === "alta") return "ALTA";
               if (v === "urgente") return "URGENTE";
               return "MEDIA";
             })(),
            dataLimite: new Date(Date.now() + 48 * 60 * 60 * 1000),
          });
        }
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

    // Bloco de registro de eventos SLA removido para manter independência

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
    }, {} as Record<string, Record<string, unknown>[]>);

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
