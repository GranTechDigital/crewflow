import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Agrupa por chave (responsavel|tipo), mantendo apenas uma tarefa ativa
function chaveTarefa(tipo: string, responsavel: string) {
  return `${(responsavel || "").toUpperCase()}|${(tipo || "").toUpperCase()}`;
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
      return NextResponse.json({ message: "Informe 'nomes': string[] no body" }, { status: 400 });
    }

    // Buscar funcionários pelos nomes informados
    const funcionarios = await prisma.funcionario.findMany({
      where: { nome: { in: nomes } },
      select: { id: true, nome: true, matricula: true },
    });

    if (funcionarios.length === 0) {
      return NextResponse.json({ message: "Nenhum funcionário encontrado pelos nomes informados", nomes }, { status: 404 });
    }

    const resultados: any[] = [];
    let totalCanceladas = 0;

    for (const func of funcionarios) {
      // Buscar todos os remanejamentos do funcionário com tarefas vinculadas
      const rems = await prisma.remanejamentoFuncionario.findMany({
        where: { funcionarioId: func.id },
        include: { tarefas: true, solicitacao: true },
      });

      let canceladasFuncionario = 0;
      const detalhesRems: any[] = [];

      for (const rem of rems) {
        // Mapear tarefas por chave e identificar duplicatas
        const tarefas = rem.tarefas || [];
        const grupos = new Map<string, typeof tarefas>();

        for (const t of tarefas) {
          const key = chaveTarefa(t.tipo, t.responsavel);
          const arr = grupos.get(key) || [];
          arr.push(t);
          grupos.set(key, arr);
        }

        let canceladasNesteRem = 0;

        for (const [key, arr] of grupos.entries()) {
          if (arr.length <= 1) continue;

          // Preferir manter a primeira criada ativa; não cancelar CONCLUIDO
          const ativos = arr.filter((t) => t.status !== "CANCELADO" && t.status !== "CONCLUIDO");
          const concluidos = arr.filter((t) => t.status === "CONCLUIDO");

          // Se não há ativos, não cancelar concluídos automaticamente
          if (ativos.length === 0) continue;

          // Ordenar por createdAt asc para manter o mais antigo ativo
          ativos.sort((a, b) => {
            const ad = (a as any).createdAt ? new Date((a as any).createdAt).getTime() : 0;
            const bd = (b as any).createdAt ? new Date((b as any).createdAt).getTime() : 0;
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
                    texto: "Cancelada por deduplicação automática (tarefas duplicadas para mesmo responsável/tipo)",
                    criadoPor: usuarioResponsavel,
                    modificadoPor: usuarioResponsavel,
                  },
                });
              } catch (obsErr) {
                console.error("Erro ao registrar observação de deduplicação:", obsErr);
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
                console.error("Erro ao registrar histórico de deduplicação:", histErr);
              }

              canceladasNesteRem += 1;
              totalCanceladas += 1;
            } catch (err) {
              console.error("Erro ao cancelar tarefa duplicada:", err);
            }
          }
        }

        detalhesRems.push({ remanejamentoId: rem.id, canceladas: canceladasNesteRem });
        canceladasFuncionario += canceladasNesteRem;
      }

      resultados.push({ funcionarioId: func.id, nome: func.nome, matricula: func.matricula, remanejamentosProcessados: rems.length, tarefasCanceladas: canceladasFuncionario, detalhesRemanejamentos: detalhesRems });
    }

    return NextResponse.json({ message: `Deduplicação concluída. ${totalCanceladas} tarefas canceladas no total.`, resultados });
  } catch (error) {
    console.error("Erro na deduplicação de tarefas:", error);
    return NextResponse.json({ message: "Erro interno" }, { status: 500 });
  }
}