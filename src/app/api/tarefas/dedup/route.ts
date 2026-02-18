import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function chaveTarefa(tipo: string, responsavel: string) {
  const r = String(responsavel || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
  const t = String(tipo || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
  return `${r}|${t}`;
}

export async function GET() {
  return NextResponse.json({ status: "ok" });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const nomes: string[] = Array.isArray(body?.nomes) ? body.nomes : [];
    const usuarioResponsavel: string = body?.usuarioResponsavel || "Sistema";

    if (!nomes || nomes.length === 0) {
      return NextResponse.json(
        { message: "Informe 'nomes': string[] no body" },
        { status: 400 }
      );
    }

    // Buscar funcionários pelos nomes informados
    const funcionarios = await prisma.funcionario.findMany({
      where: { nome: { in: nomes } },
      select: { id: true, nome: true, matricula: true },
    });

    if (funcionarios.length === 0) {
      return NextResponse.json(
        {
          message: "Nenhum funcionário encontrado pelos nomes informados",
          nomes,
        },
        { status: 404 }
      );
    }

    const resultados: any[] = [];
    let totalCanceladas = 0;

    for (const func of funcionarios) {
      // Buscar todos os remanejamentos do funcionário com tarefas vinculadas
      const rems = await prisma.remanejamentoFuncionario.findMany({
        where: { funcionarioId: func.id },
        include: {
          tarefas: {
            select: {
              id: true,
              tipo: true,
              responsavel: true,
              status: true,
              treinamentoId: true,
              dataCriacao: true,
            },
          },
          solicitacao: true,
        },
      });

      let canceladasFuncionario = 0;
      const detalhesRems: any[] = [];

      for (const rem of rems) {
        // Mapear tarefas por chave e identificar duplicatas
        const tarefas = rem.tarefas || [];
        const grupos = new Map<string, typeof tarefas>();

        for (const t of tarefas) {
          const key =
            t.responsavel === "TREINAMENTO" &&
            typeof (t as any).treinamentoId === "number"
              ? `TREINAMENTO|ID:${(t as any).treinamentoId}`
              : chaveTarefa(t.tipo as string, t.responsavel as string);
          const arr = grupos.get(key) || [];
          arr.push(t);
          grupos.set(key, arr);
        }

        let canceladasNesteRem = 0;

        for (const [key, arr] of grupos.entries()) {
          if (arr.length <= 1) continue;

          // Preferir manter a primeira criada ativa; não cancelar CONCLUIDO
          const ativos = arr.filter(
            (t) => t.status !== "CANCELADO" && t.status !== "CONCLUIDO"
          );
          const concluidos = arr.filter((t) => t.status === "CONCLUIDO");

          // Se não há ativos, não cancelar concluídos automaticamente
          if (ativos.length === 0) continue;

          ativos.sort((a, b) => {
            const ad = (a as any).dataCriacao
              ? new Date((a as any).dataCriacao as Date).getTime()
              : 0;
            const bd = (b as any).dataCriacao
              ? new Date((b as any).dataCriacao as Date).getTime()
              : 0;
            return ad - bd;
          });

          const manter = ativos[0];
          const cancelar = [...ativos.slice(1)];

          for (const t of cancelar) {
            try {
              await prisma.tarefaRemanejamento.update({
                where: { id: t.id },
                data: { status: "CANCELADO" },
              });

              // Observação
              try {
                await prisma.observacaoTarefaRemanejamento.create({
                  data: {
                    tarefaId: t.id,
                    texto:
                      "Cancelada por deduplicação automática (tarefas duplicadas para mesmo responsável/tipo)",
                    criadoPor: usuarioResponsavel,
                    modificadoPor: usuarioResponsavel,
                  },
                });
              } catch (obsErr) {
                console.error(
                  "Erro ao registrar observação de deduplicação:",
                  obsErr
                );
              }

              // Histórico
              try {
                await prisma.historicoRemanejamento.create({
                  data: {
                    solicitacaoId: rem.solicitacao?.id,
                    remanejamentoFuncionarioId: rem.id,
                    tarefaId: t.id,
                    tipoAcao: "CANCELAMENTO",
                    entidade: "TAREFA",
                    campoAlterado: "status",
                    valorAnterior: t.status,
                    valorNovo: "CANCELADO",
                    descricaoAcao: `Cancelada por deduplicação (mantida 1 tarefa por chave: ${key})`,
                    usuarioResponsavel,
                  },
                });
              } catch (histErr) {
                console.error(
                  "Erro ao registrar histórico de deduplicação:",
                  histErr
                );
              }

              canceladasNesteRem += 1;
              totalCanceladas += 1;
            } catch (err) {
              console.error("Erro ao cancelar tarefa duplicada:", err);
            }
          }
        }

        detalhesRems.push({
          remanejamentoId: rem.id,
          canceladas: canceladasNesteRem,
        });
        canceladasFuncionario += canceladasNesteRem;

        // Atualizar statusTarefas do remanejamento conforme situação pós-deduplicação
        try {
          const tarefasAtual = await prisma.tarefaRemanejamento.findMany({
            where: { remanejamentoFuncionarioId: rem.id },
            select: { status: true },
          });
          const semPendentes =
            tarefasAtual.length === 0 ||
            tarefasAtual.every(
              (t) =>
                t.status === "CONCLUIDO" ||
                t.status === "CONCLUIDA" ||
                t.status === "CANCELADO"
            );
          const novoStatus = semPendentes
            ? "SUBMETER RASCUNHO"
            : "ATENDER TAREFAS";
          const statusAnterior = (rem as any).statusTarefas || null;
          await prisma.remanejamentoFuncionario.update({
            where: { id: rem.id },
            data: { statusTarefas: novoStatus },
          });
          // Histórico da atualização
          try {
            if (statusAnterior !== novoStatus) {
              await prisma.historicoRemanejamento.create({
                data: {
                  solicitacaoId: rem.solicitacao?.id,
                  remanejamentoFuncionarioId: rem.id,
                  tipoAcao: "ATUALIZACAO_STATUS",
                  entidade: "STATUS_TAREFAS",
                  descricaoAcao: `Status geral das tarefas atualizado para: ${novoStatus} (via deduplicação)`,
                  campoAlterado: "statusTarefas",
                  valorAnterior: statusAnterior,
                  valorNovo: novoStatus,
                  usuarioResponsavel,
                },
              });
            }
          } catch (histErr) {
            console.error(
              "Erro ao registrar histórico após deduplicação:",
              histErr
            );
          }
        } catch (statusErr) {
          console.error(
            "Erro ao atualizar statusTarefas após deduplicação:",
            statusErr
          );
        }
      }

      resultados.push({
        funcionarioId: func.id,
        nome: func.nome,
        matricula: func.matricula,
        remanejamentosProcessados: rems.length,
        tarefasCanceladas: canceladasFuncionario,
        detalhesRemanejamentos: detalhesRems,
      });
    }

    return NextResponse.json({
      message: `Deduplicação concluída. ${totalCanceladas} tarefas canceladas no total.`,
      resultados,
    });
  } catch (error) {
    console.error("Erro na deduplicação de tarefas:", error);
    return NextResponse.json({ message: "Erro interno" }, { status: 500 });
  }
}
