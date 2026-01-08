import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPermissionsByTeam, PERMISSIONS } from "@/lib/permissions";

// PUT - Atualizar observação
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ obsId: string }> }
) {
  try {
    const { obsId } = await params;

    // Obter o usuário autenticado
    const { getUserFromRequest } = await import("@/utils/authUtils");
    const usuarioAutenticado = await getUserFromRequest(request);

    if (!usuarioAutenticado) {
      return NextResponse.json(
        { error: "Usuário não autenticado" },
        { status: 401 }
      );
    }

    // Verificar permissões
    const nomeEquipe = usuarioAutenticado.equipe?.nome || "";
    let permissions = getPermissionsByTeam(nomeEquipe);
    const isAdminMatricula =
      usuarioAutenticado.funcionario?.matricula === "ADMIN001";
    if (isAdminMatricula && !permissions.includes(PERMISSIONS.ADMIN)) {
      permissions = [...permissions, PERMISSIONS.ADMIN];
    }
    const isAdmin = permissions.includes(PERMISSIONS.ADMIN);
    const canEditByModule =
      permissions.includes(PERMISSIONS.ACCESS_PREST_SERV) ||
      permissions.includes(PERMISSIONS.ACCESS_PREST_SERV_GESTOR);

    if (!isAdmin && !canEditByModule) {
      return NextResponse.json(
        { error: "Permissão insuficiente." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { texto } = body;

    if (!texto) {
      return NextResponse.json(
        { error: "Texto é obrigatório" },
        { status: 400 }
      );
    }

    // Verificar se a observação existe e buscar dados para histórico
    const observacaoExistente = await prisma.observacaoRemanejamento.findUnique(
      {
        where: { id: parseInt(obsId) },
        include: {
          remanejamentoFuncionario: {
            include: {
              funcionario: {
                select: {
                  id: true,
                  nome: true,
                  matricula: true,
                },
              },
            },
          },
        },
      }
    );

    if (!observacaoExistente) {
      return NextResponse.json(
        { error: "Observação não encontrada" },
        { status: 404 }
      );
    }

    // Se não for admin, aplicar restrições estritas de propriedade e tempo
    if (!isAdmin) {
      // Verificar propriedade
      if (observacaoExistente.criadoPorId !== usuarioAutenticado.id) {
        return NextResponse.json(
          { error: "Apenas o autor pode editar esta observação." },
          { status: 403 }
        );
      }

      // Verificar tempo (1 hora)
      const agora = new Date();
      const diferencaMs =
        agora.getTime() - observacaoExistente.dataCriacao.getTime();
      const umaHoraMs = 60 * 60 * 1000;

      if (diferencaMs > umaHoraMs) {
        return NextResponse.json(
          { error: "O tempo limite de 1 hora para edição expirou." },
          { status: 403 }
        );
      }
    }

    const observacao = await prisma.observacaoRemanejamento.update({
      where: {
        id: parseInt(obsId),
      },
      data: {
        texto,
        modificadoPor: usuarioAutenticado.funcionario?.nome || "Sistema",
        dataModificacao: new Date(),
      },
    });

    // Registrar no histórico se o texto foi alterado
    if (observacaoExistente.texto !== texto) {
      try {
        await prisma.historicoRemanejamento.create({
          data: {
            solicitacaoId:
              observacaoExistente.remanejamentoFuncionario.solicitacaoId,
            remanejamentoFuncionarioId:
              observacaoExistente.remanejamentoFuncionarioId,
            tipoAcao: "ATUALIZACAO",
            entidade: "OBSERVACAO",
            descricaoAcao: `Observação do remanejamento de ${observacaoExistente.remanejamentoFuncionario.funcionario.nome} (${observacaoExistente.remanejamentoFuncionario.funcionario.matricula}) atualizada`,
            campoAlterado: "texto",
            valorAnterior: observacaoExistente.texto,
            valorNovo: texto,
            usuarioResponsavel:
              usuarioAutenticado.funcionario?.nome || "Sistema",
            usuarioResponsavelId: usuarioAutenticado.id,
            observacoes: `Observação atualizada`,
          },
        });
      } catch (historicoError) {
        console.error("Erro ao registrar histórico:", historicoError);
        // Não falha a atualização se o histórico falhar
      }
    }

    return NextResponse.json(observacao);
  } catch (error) {
    console.error("Erro ao atualizar observação:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

// DELETE - Excluir observação
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ obsId: string }> }
) {
  try {
    const { obsId } = await params;

    // Obter o usuário autenticado
    const { getUserFromRequest } = await import("@/utils/authUtils");
    const usuarioAutenticado = await getUserFromRequest(request);

    if (!usuarioAutenticado) {
      return NextResponse.json(
        { error: "Usuário não autenticado" },
        { status: 401 }
      );
    }

    // Verificar permissões
    const nomeEquipe = usuarioAutenticado.equipe?.nome || "";
    let permissions = getPermissionsByTeam(nomeEquipe);
    const isAdminMatricula =
      usuarioAutenticado.funcionario?.matricula === "ADMIN001";
    if (isAdminMatricula && !permissions.includes(PERMISSIONS.ADMIN)) {
      permissions = [...permissions, PERMISSIONS.ADMIN];
    }
    const isAdmin = permissions.includes(PERMISSIONS.ADMIN);
    const canEditByModule =
      permissions.includes(PERMISSIONS.ACCESS_PREST_SERV) ||
      permissions.includes(PERMISSIONS.ACCESS_PREST_SERV_GESTOR);

    if (!isAdmin && !canEditByModule) {
      return NextResponse.json(
        { error: "Permissão insuficiente." },
        { status: 403 }
      );
    }

    // Verificar se a observação existe e buscar dados para histórico
    const observacao = await prisma.observacaoRemanejamento.findUnique({
      where: { id: parseInt(obsId) },
      include: {
        remanejamentoFuncionario: {
          include: {
            funcionario: {
              select: {
                id: true,
                nome: true,
                matricula: true,
              },
            },
          },
        },
      },
    });

    if (!observacao) {
      return NextResponse.json(
        { error: "Observação não encontrada" },
        { status: 404 }
      );
    }

    if (!isAdmin) {
      // Verificar propriedade
      if (observacao.criadoPorId !== usuarioAutenticado.id) {
        return NextResponse.json(
          { error: "Apenas o autor pode excluir esta observação." },
          { status: 403 }
        );
      }

      // Verificar tempo (1 hora)
      const agora = new Date();
      const diferencaMs = agora.getTime() - observacao.dataCriacao.getTime();
      const umaHoraMs = 60 * 60 * 1000;

      if (diferencaMs > umaHoraMs) {
        return NextResponse.json(
          { error: "O tempo limite de 1 hora para exclusão expirou." },
          { status: 403 }
        );
      }
    }

    // Registrar no histórico antes de excluir
    try {
      await prisma.historicoRemanejamento.create({
        data: {
          solicitacaoId: observacao.remanejamentoFuncionario.solicitacaoId,
          remanejamentoFuncionarioId: observacao.remanejamentoFuncionarioId,
          tipoAcao: "EXCLUSAO",
          entidade: "OBSERVACAO",
          descricaoAcao: `Observação do remanejamento de ${observacao.remanejamentoFuncionario.funcionario.nome} (${observacao.remanejamentoFuncionario.funcionario.matricula}) excluída`,
          usuarioResponsavel: usuarioAutenticado.funcionario?.nome || "Sistema",
          usuarioResponsavelId: usuarioAutenticado.id,
          observacoes: observacao.texto,
        },
      });
    } catch (historicoError) {
      console.error("Erro ao registrar histórico:", historicoError);
      // Não falha a exclusão se o histórico falhar
    }

    await prisma.observacaoRemanejamento.delete({
      where: {
        id: parseInt(obsId),
      },
    });

    return NextResponse.json({ message: "Observação excluída com sucesso" });
  } catch (error) {
    console.error("Erro ao excluir observação:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
