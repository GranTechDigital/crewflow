import { NextRequest, NextResponse } from "next/server";
// Forçando atualização da rota
import { prisma } from "@/lib/prisma";
import { getPermissionsByTeam, PERMISSIONS } from "@/lib/permissions";

// GET - Buscar observações de um remanejamento
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const remanejamentoId = searchParams.get("remanejamentoId");

    if (!remanejamentoId) {
      return NextResponse.json(
        { error: "ID do remanejamento é obrigatório" },
        { status: 400 }
      );
    }

    console.log(
      "GET observacoes (flat) para remanejamentoId:",
      remanejamentoId
    );

    const observacoes = await prisma.observacaoRemanejamento.findMany({
      where: {
        remanejamentoFuncionarioId: remanejamentoId,
      },
      orderBy: {
        dataModificacao: "desc",
      },
    });

    // Mapear os campos do banco de dados para os nomes esperados pelo frontend
    const observacoesFormatadas = observacoes.map((obs) => ({
      id: String(obs.id),
      texto: obs.texto,
      criadoPor: obs.criadoPor,
      criadoPorId: obs.criadoPorId,
      criadoEm: obs.dataCriacao.toISOString(),
      modificadoPor: obs.modificadoPor,
      modificadoEm: obs.dataModificacao.toISOString(),
    }));

    return NextResponse.json(observacoesFormatadas);
  } catch (error) {
    console.error("Erro ao buscar observações:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

// POST - Criar nova observação
export async function POST(request: NextRequest) {
  try {
    // Obter o usuário autenticado
    const { getUserFromRequest } = await import("@/utils/authUtils");
    const usuarioAutenticado = await getUserFromRequest(request);

    if (!usuarioAutenticado) {
      return NextResponse.json(
        { error: "Usuário não autenticado" },
        { status: 401 }
      );
    }

    // Mapear permissões pelo nome da equipe (modelo centralizado)
    const nomeEquipe = usuarioAutenticado.equipe?.nome || "";
    let permissions = getPermissionsByTeam(nomeEquipe);
    // Fallback: administrador por matrícula
    const isAdminMatricula =
      usuarioAutenticado.funcionario?.matricula === "ADMIN001";
    if (isAdminMatricula && !permissions.includes(PERMISSIONS.ADMIN)) {
      permissions = [...permissions, PERMISSIONS.ADMIN];
    }
    const isAdmin = permissions.includes(PERMISSIONS.ADMIN);
    // Editores/Gestores do módulo Prestserv podem criar; visualizadores não
    const canCreateByModule =
      permissions.includes(PERMISSIONS.ACCESS_PREST_SERV) ||
      permissions.includes(PERMISSIONS.ACCESS_PREST_SERV_GESTOR);

    if (!isAdmin && !canCreateByModule) {
      return NextResponse.json(
        {
          error:
            "Permissão insuficiente. Apenas Editores ou superior podem criar observações.",
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { remanejamentoId, texto } = body;

    if (!remanejamentoId) {
      return NextResponse.json(
        { error: "ID do remanejamento é obrigatório" },
        { status: 400 }
      );
    }

    // Usar o nome do usuário autenticado
    const criadoPor = usuarioAutenticado.funcionario?.nome || "Sistema";

    if (!texto) {
      return NextResponse.json(
        { error: "Texto da observação é obrigatório" },
        { status: 400 }
      );
    }

    // Verificar se o remanejamento existe e buscar dados para histórico
    const remanejamento = await prisma.remanejamentoFuncionario.findUnique({
      where: { id: remanejamentoId },
      include: {
        funcionario: {
          select: {
            id: true,
            nome: true,
            matricula: true,
          },
        },
      },
    });

    if (!remanejamento) {
      return NextResponse.json(
        { error: "Remanejamento não encontrado" },
        { status: 404 }
      );
    }

    const observacao = await prisma.observacaoRemanejamento.create({
      data: {
        remanejamentoFuncionarioId: remanejamentoId,
        texto,
        criadoPor,
        criadoPorId: usuarioAutenticado.id,
        modificadoPor: criadoPor,
      },
    });

    // Registrar no histórico
    try {
      await prisma.historicoRemanejamento.create({
        data: {
          solicitacaoId: remanejamento.solicitacaoId,
          remanejamentoFuncionarioId: remanejamentoId,
          tipoAcao: "OBSERVACAO_CRIADA",
          entidade: "RemanejamentoFuncionario",
          descricaoAcao: `Observação adicionada: "${texto.substring(0, 50)}${
            texto.length > 50 ? "..." : ""
          }"`,
          usuarioResponsavel: criadoPor,
          usuarioResponsavelId: usuarioAutenticado.id,
        },
      });
    } catch (histError) {
      console.error("Erro ao criar histórico:", histError);
      // Não falhar a requisição se o histórico falhar
    }

    return NextResponse.json({
      id: String(observacao.id),
      texto: observacao.texto,
      criadoPor: observacao.criadoPor,
      criadoPorId: observacao.criadoPorId,
      criadoEm: observacao.dataCriacao.toISOString(),
      modificadoPor: observacao.modificadoPor,
      modificadoEm: observacao.dataModificacao.toISOString(),
    });
  } catch (error) {
    console.error("Erro ao criar observação:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
