import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    // 1. Definir janela de tempo (últimos 30 dias)
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - 30);

    // 2. Buscar candidatos (VALIDADO + atualizado recentemente + não é desligamento)
    const candidatos = await prisma.remanejamentoFuncionario.findMany({
      where: {
        statusPrestserv: { in: ["VALIDADO", "VALIDAO", "VALIDADA"] },
        updatedAt: { gte: dataLimite },
        solicitacao: {
          tipo: { not: "DESLIGAMENTO" },
        },
      },
      include: {
        tarefas: true,
        funcionario: true,
        solicitacao: true,
      },
    });

    const processados = [];

    // 3. Filtrar e atualizar
    for (const rem of candidatos) {
      // Verificar se tem tarefas de treinamento ativas (não canceladas)
      // Considera variações de nome de setor ou se tem treinamento vinculado
      const tarefasTreinamento = rem.tarefas.filter(
        (t) =>
          t.status !== "CANCELADO" &&
          ((t.responsavel &&
            (t.responsavel.toUpperCase().includes("TREINAMENTO") ||
              t.responsavel.toUpperCase().includes("CAPACIT"))) ||
            t.treinamentoId !== null),
      );

      // Se não tem tarefas de treinamento (0/0), precisa reverter
      if (tarefasTreinamento.length === 0) {
        // Atualizar status
        await prisma.remanejamentoFuncionario.update({
          where: { id: rem.id },
          data: {
            statusPrestserv: "CRIADO",
            statusTarefas: "ATENDER TAREFAS",
            // Forçar atualização do updatedAt para aparecer no topo se ordenar por data
            updatedAt: new Date(),
          },
        });

        // Registrar no histórico
        await prisma.historicoRemanejamento.create({
          data: {
            solicitacaoId: rem.solicitacaoId!,
            remanejamentoFuncionarioId: rem.id,
            tipoAcao: "ATUALIZACAO_STATUS",
            entidade: "STATUS_PRESTSERV",
            descricaoAcao:
              "Reversão automática de VALIDADO para CRIADO: Funcionário validado sem tarefas de treinamento (0/0).",
            campoAlterado: "statusPrestserv",
            valorAnterior: rem.statusPrestserv,
            valorNovo: "CRIADO",
            usuarioResponsavel: "Sistema (Correção)",
            observacoes:
              "Correção solicitada: validado incorretamente sem treinamentos.",
          },
        });

        // Registrar observação
        await prisma.observacaoRemanejamentoFuncionario.create({
          data: {
            remanejamentoFuncionarioId: rem.id,
            texto:
              "Reversão automática: Status retornado para CRIADO pois foi validado sem tarefas de treinamento. Necessário sincronizar/gerar matriz.",
            criadoPor: "Sistema (Correção)",
            modificadoPor: "Sistema (Correção)",
          },
        });

        processados.push({
          id: rem.id,
          funcionario: rem.funcionario.nome,
          matricula: rem.funcionario.matricula,
          dataValidacao: rem.updatedAt,
        });
      }
    }

    return NextResponse.json({
      success: true,
      totalEncontrados: candidatos.length,
      totalRevertidos: processados.length,
      revertidos: processados,
    });
  } catch (error) {
    console.error("Erro ao reverter validados:", error);
    return NextResponse.json(
      { error: "Erro interno", details: String(error) },
      { status: 500 },
    );
  }
}
