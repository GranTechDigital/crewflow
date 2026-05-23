import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/utils/authUtils";

const OBSERVACAO_TECNICA_OCULTA =
  "Prestserv resetado para CRIADO devido a novas tarefas sincronizadas/reativadas após sincronização de matriz/tarefas padrão.";

function normalizeText(value?: string | null) {
  return (value || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isObservacaoTecnicaOculta(texto?: string | null) {
  return normalizeText(texto) === normalizeText(OBSERVACAO_TECNICA_OCULTA);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const usuarioAutenticado = await getUserFromRequest(request);

    if (!usuarioAutenticado) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const observacoes =
      await prisma.observacaoRemanejamentoFuncionario.findMany({
        where: {
          remanejamentoFuncionarioId: id,
        },
        orderBy: {
          dataCriacao: "desc",
        },
      });

    const observacoesVisiveis = observacoes.filter(
      (obs) => !isObservacaoTecnicaOculta(obs.texto)
    );

    return NextResponse.json(observacoesVisiveis);
  } catch (error) {
    console.error("Erro ao buscar observações:", error);
    return NextResponse.json(
      { error: "Erro ao buscar observações" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const usuarioAutenticado = await getUserFromRequest(request);

    if (!usuarioAutenticado) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    // Regra: Perfil VISUALIZADOR não pode criar observações
    const nomeEquipe = usuarioAutenticado.equipe?.nome || "";
    if (nomeEquipe.toLowerCase().includes("visualizador")) {
      return NextResponse.json(
        { error: "Perfil de visualizador não pode criar observações" },
        { status: 403 }
      );
    }

    const { texto } = await request.json();

    if (!texto) {
      return NextResponse.json(
        { error: "Texto da observação é obrigatório" },
        { status: 400 }
      );
    }

    const observacao = await prisma.observacaoRemanejamentoFuncionario.create({
      data: {
        remanejamentoFuncionarioId: id,
        texto,
        criadoPor: usuarioAutenticado.funcionario.nome,
        modificadoPor: usuarioAutenticado.funcionario.nome,
      },
    });

    return NextResponse.json(observacao);
  } catch (error) {
    console.error("Erro ao criar observação:", error);
    return NextResponse.json(
      { error: "Erro ao criar observação" },
      { status: 500 }
    );
  }
}
