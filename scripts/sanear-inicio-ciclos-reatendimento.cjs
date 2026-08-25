const { PrismaClient } = require("@prisma/client");

const DEFAULT_DATABASE_URL =
  "postgresql://postgres:postgres@localhost:5432/projetogran?schema=public";
const SETORES_CADASTRO = new Set(["RH", "MEDICINA", "TREINAMENTO"]);

process.env.DATABASE_URL = process.env.DATABASE_URL || DEFAULT_DATABASE_URL;

const prisma = new PrismaClient();

function hasArg(name) {
  return process.argv.includes(name);
}

function argValue(name) {
  const prefix = `${name}=`;
  const arg = process.argv.find((item) => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : undefined;
}

function normalizeText(input) {
  return String(input || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function detectSetorFromText(input) {
  const text = normalizeText(input);
  if (!text) return null;
  if (
    text === "RH" ||
    text.includes("RECURSOS HUMANOS") ||
    text.includes("DEPARTAMENTO PESSOAL") ||
    text.includes("ADMISS") ||
    text.includes("DOCUMENTACAO RH") ||
    text.includes("DOC RH")
  ) {
    return "RH";
  }
  if (
    text.includes("MEDIC") ||
    text.includes("SAUDE") ||
    text.includes("ENFERM") ||
    text.includes("AMBULATORIO") ||
    text.includes("ASO") ||
    text.includes("EXAME")
  ) {
    return "MEDICINA";
  }
  if (
    text.includes("TREIN") ||
    text.includes("CAPACIT") ||
    text.includes("CURSO") ||
    text.includes("INSTRU") ||
    text.includes("CERTIFIC")
  ) {
    return "TREINAMENTO";
  }
  return null;
}

function detectSetorTarefa(tarefa) {
  if (tarefa.treinamentoId) return "TREINAMENTO";
  return (
    detectSetorFromText(tarefa.setor && tarefa.setor.nome) ||
    detectSetorFromText(tarefa.responsavel) ||
    detectSetorFromText(tarefa.tipo) ||
    detectSetorFromText(tarefa.descricao)
  );
}

function isTarefaFinal(status) {
  return new Set(["CONCLUIDO", "CONCLUIDA", "CANCELADO"]).has(normalizeText(status));
}

function isTarefaPendenteDeAtuacao(status) {
  const normalized = normalizeText(status);
  return normalized === "REPROVADO" || !isTarefaFinal(normalized);
}

function minDate(dates) {
  const valid = dates.filter((date) => date instanceof Date);
  if (!valid.length) return null;
  return new Date(Math.min(...valid.map((date) => date.getTime())));
}

function fimCiclo(ciclo) {
  return ciclo.conclusaoAt || ciclo.cancelamentoAt || ciclo.updatedAt || null;
}

function fmt(date) {
  return date
    ? new Date(date).toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      })
    : "-";
}

function inicioAtuacaoTarefa(tarefa, depoisDe) {
  const eventosReabertura = tarefa.eventosStatus
    .filter((evento) => isTarefaPendenteDeAtuacao(evento.statusNovo))
    .map((evento) => evento.dataEvento)
    .filter((data) => data > depoisDe);

  return minDate(eventosReabertura) || (tarefa.dataCriacao > depoisDe ? tarefa.dataCriacao : null);
}

async function carregarCiclos({ desde, remanejamentoId }) {
  return prisma.remanejamentoCiclo.findMany({
    where: {
      status: { not: "IGNORADO" },
      numeroCiclo: { gt: 1 },
      setor: { in: [...SETORES_CADASTRO] },
      inicioAt: { gte: desde },
      ...(remanejamentoId ? { remanejamentoFuncionarioId: remanejamentoId } : {}),
    },
    include: {
      remanejamentoFuncionario: {
        include: {
          funcionario: { select: { nome: true, matricula: true } },
          tarefas: {
            include: {
              setor: { select: { nome: true } },
              eventosStatus: {
                orderBy: { dataEvento: "asc" },
                select: { statusNovo: true, dataEvento: true },
              },
            },
          },
        },
      },
    },
    orderBy: [
      { remanejamentoFuncionarioId: "asc" },
      { setor: "asc" },
      { numeroCiclo: "asc" },
    ],
  });
}

async function calcularAcoes(ciclos) {
  const acoes = [];

  for (const ciclo of ciclos) {
    const anterior = await prisma.remanejamentoCiclo.findFirst({
      where: {
        remanejamentoFuncionarioId: ciclo.remanejamentoFuncionarioId,
        setor: ciclo.setor,
        numeroCiclo: { lt: ciclo.numeroCiclo },
        status: { not: "IGNORADO" },
      },
      orderBy: { numeroCiclo: "desc" },
    });
    const referencia = anterior ? fimCiclo(anterior) : null;
    if (!referencia) continue;

    const tarefasSetor = ciclo.remanejamentoFuncionario.tarefas.filter(
      (tarefa) => detectSetorTarefa(tarefa) === ciclo.setor,
    );
    const candidatos = tarefasSetor
      .map((tarefa) => inicioAtuacaoTarefa(tarefa, referencia))
      .filter(Boolean);
    const novoInicio = minDate(candidatos) || (ciclo.createdAt > referencia ? ciclo.createdAt : null);
    if (!novoInicio) {
      if (anterior.inicioAt.getTime() === ciclo.inicioAt.getTime()) {
        acoes.push({
          tipo: "IGNORAR_SEM_EVIDENCIA",
          ciclo,
          anterior,
          novoInicio: null,
          referencia,
          funcionario: ciclo.remanejamentoFuncionario.funcionario,
        });
      }
      continue;
    }

    const difMs = Math.abs(ciclo.inicioAt.getTime() - novoInicio.getTime());
    if (difMs < 1000) continue;
    if (novoInicio <= ciclo.inicioAt) continue;
    if (novoInicio < referencia) continue;

    acoes.push({
      tipo: "AJUSTAR_INICIO",
      ciclo,
      anterior,
      novoInicio,
      referencia,
      funcionario: ciclo.remanejamentoFuncionario.funcionario,
    });
  }

  return acoes;
}

async function aplicarAcoes(acoes) {
  for (const acao of acoes) {
    await prisma.$transaction(async (tx) => {
      if (acao.tipo === "IGNORAR_SEM_EVIDENCIA") {
        await tx.remanejamentoCiclo.update({
          where: { id: acao.ciclo.id },
          data: {
            status: "IGNORADO",
            motivoFechamento:
              "Ciclo de reatendimento ignorado por falta de evidencia posterior ao fechamento do ciclo anterior.",
          },
        });

        await tx.integracaoEventoExterno.updateMany({
          where: { cicloId: acao.ciclo.id },
          data: {
            status: "IGNORADO",
            ultimoErro:
              "Evento ignorado porque o ciclo de reatendimento nao possui evidencia posterior ao ciclo anterior.",
          },
        });

        await tx.integracaoOutbox.updateMany({
          where: { cicloId: acao.ciclo.id, status: "PENDENTE" },
          data: {
            status: "IGNORADO",
            ultimoErro:
              "Outbox ignorada porque o ciclo de reatendimento nao possui evidencia posterior ao ciclo anterior.",
          },
        });

        await tx.remanejamentoCicloEvento.create({
          data: {
            cicloId: acao.ciclo.id,
            remanejamentoFuncionarioId: acao.ciclo.remanejamentoFuncionarioId,
            tipo: "CICLO_IGNORADO_SEM_EVIDENCIA",
            dataEvento: new Date(),
            origem: "SISTEMA",
            dados: {
              numeroCicloIgnorado: acao.ciclo.numeroCiclo,
              numeroCicloAnterior: acao.anterior.numeroCiclo,
              inicioIgnorado: acao.ciclo.inicioAt.toISOString(),
              referenciaCicloAnterior: acao.referencia.toISOString(),
              motivo:
                "Ciclo de reatendimento sem tarefa nova ou evento de reabertura posterior ao ciclo anterior.",
            },
          },
        });
        return;
      }

      await tx.remanejamentoCiclo.update({
        where: { id: acao.ciclo.id },
        data: { inicioAt: acao.novoInicio },
      });

      await tx.remanejamentoCicloEvento.updateMany({
        where: { cicloId: acao.ciclo.id, tipo: "CICLO_ABERTO" },
        data: { dataEvento: acao.novoInicio },
      });

      await tx.integracaoEventoExterno.updateMany({
        where: { cicloId: acao.ciclo.id },
        data: { startAt: acao.novoInicio },
      });

      await tx.integracaoOutbox.updateMany({
        where: {
          cicloId: acao.ciclo.id,
          status: "PENDENTE",
        },
        data: {
          ultimoErro:
            "Payload pendente deve ser rematerializado apos saneamento de inicio do ciclo.",
        },
      });

      await tx.remanejamentoCicloEvento.create({
        data: {
          cicloId: acao.ciclo.id,
          remanejamentoFuncionarioId: acao.ciclo.remanejamentoFuncionarioId,
          tipo: "CICLO_INICIO_AJUSTADO",
          dataEvento: new Date(),
          origem: "SISTEMA",
          dados: {
            inicioAnterior: acao.ciclo.inicioAt.toISOString(),
            inicioNovo: acao.novoInicio.toISOString(),
            referenciaCicloAnterior: acao.referencia.toISOString(),
            motivo:
              "Inicio do reatendimento ajustado para a primeira evidencia posterior ao fechamento do ciclo anterior.",
          },
        },
      });
    });
  }
}

async function main() {
  const apply = hasArg("--apply");
  const desde = new Date(argValue("--desde") || "2026-01-01T00:00:00.000Z");
  const remanejamentoId = argValue("--remanejamento") || null;
  const limit = Number(argValue("--limit") || "0");

  const ciclos = await carregarCiclos({ desde, remanejamentoId });
  const acoes = await calcularAcoes(ciclos);
  const selecionadas = limit > 0 ? acoes.slice(0, limit) : acoes;

  console.log(`Modo: ${apply ? "apply" : "dry-run"}`);
  console.log(`Desde: ${desde.toISOString()}`);
  console.log(`Ciclos analisados: ${ciclos.length}`);
  console.log(`Ajustes encontrados: ${acoes.length}`);
  console.log(`Ajustes selecionados: ${selecionadas.length}`);

  for (const acao of selecionadas.slice(0, 50)) {
    console.log(
      [
        acao.funcionario.matricula,
        acao.funcionario.nome,
        acao.ciclo.remanejamentoFuncionarioId,
        `ciclo ${acao.ciclo.numeroCiclo}`,
        acao.ciclo.setor,
        acao.tipo,
        `inicio atual ${fmt(acao.ciclo.inicioAt)}`,
        `inicio novo ${fmt(acao.novoInicio)}`,
        `fim anterior ${fmt(acao.referencia)}`,
      ].join(" | "),
    );
  }

  if (apply) {
    await aplicarAcoes(selecionadas);
    console.log("Ajustes aplicados.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
