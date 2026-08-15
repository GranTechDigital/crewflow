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

function maxDate(...dates) {
  const valid = dates.filter((date) => date instanceof Date);
  if (!valid.length) return null;
  return new Date(Math.max(...valid.map((date) => date.getTime())));
}

function minDate(...dates) {
  const valid = dates.filter((date) => date instanceof Date);
  if (!valid.length) return null;
  return new Date(Math.min(...valid.map((date) => date.getTime())));
}

function fimCiclo(ciclo) {
  return ciclo.conclusaoAt || ciclo.cancelamentoAt || null;
}

function fmt(date) {
  return date
    ? new Date(date).toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        hour12: false,
      })
    : "-";
}

async function carregarGrupos(remanejamentoFuncionarioId) {
  const ciclos = await prisma.remanejamentoCiclo.findMany({
    where: {
      status: { not: "IGNORADO" },
      origem: "RECONSTRUIDO",
      setor: { in: [...SETORES_CADASTRO] },
      ...(remanejamentoFuncionarioId ? { remanejamentoFuncionarioId } : {}),
    },
    include: {
      remanejamentoFuncionario: {
        include: {
          funcionario: { select: { nome: true, matricula: true } },
        },
      },
    },
    orderBy: [
      { remanejamentoFuncionarioId: "asc" },
      { setor: "asc" },
      { inicioAt: "asc" },
      { numeroCiclo: "asc" },
    ],
  });

  const grupos = new Map();
  for (const ciclo of ciclos) {
    if (!SETORES_CADASTRO.has(ciclo.setor)) continue;
    const key = `${ciclo.remanejamentoFuncionarioId}:${ciclo.setor}`;
    const grupo = grupos.get(key) || [];
    grupo.push(ciclo);
    grupos.set(key, grupo);
  }
  return grupos;
}

async function sanearGrupo(tx, ciclos, apply) {
  const acoes = [];
  let atual = ciclos[0];

  for (let index = 1; index < ciclos.length; index += 1) {
    const proximo = ciclos[index];
    const fimAtual = fimCiclo(atual);

    if (!fimAtual || proximo.inicioAt <= fimAtual) {
      const novoInicio = minDate(atual.inicioAt, proximo.inicioAt);
      const novoFim = maxDate(fimAtual, fimCiclo(proximo));
      const novoPrazo = maxDate(atual.prazoPrevistoAt, proximo.prazoPrevistoAt);
      const motivo =
        "Ciclo reconstruido consolidado: tarefa/lote novo iniciou enquanto ciclo anterior do mesmo setor ainda estava em andamento.";

      acoes.push({
        manter: atual,
        ignorar: proximo,
        novoInicio,
        novoFim,
        novoPrazo,
        motivo,
      });

      if (apply) {
        await tx.remanejamentoCiclo.update({
          where: { id: atual.id },
          data: {
            inicioAt: novoInicio || atual.inicioAt,
            conclusaoAt: novoFim || atual.conclusaoAt,
            prazoPrevistoAt: novoPrazo || atual.prazoPrevistoAt,
            cancelamentoAt: null,
            status: novoFim ? "CONCLUIDO" : atual.status,
            motivoFechamento: motivo,
          },
        });

        await tx.remanejamentoCiclo.update({
          where: { id: proximo.id },
          data: {
            status: "IGNORADO",
            motivoFechamento:
              "Ciclo reconstruido ignorado por sobreposicao com ciclo anterior do mesmo setor.",
          },
        });

        await tx.remanejamentoCicloEvento.create({
          data: {
            cicloId: atual.id,
            remanejamentoFuncionarioId: atual.remanejamentoFuncionarioId,
            tipo: "CICLO_CONSOLIDADO",
            dataEvento: new Date(),
            origem: "RECONSTRUIDO",
            dados: {
              cicloMantidoId: atual.id,
              cicloIgnoradoId: proximo.id,
              setor: atual.setor,
              numeroCicloMantido: atual.numeroCiclo,
              numeroCicloIgnorado: proximo.numeroCiclo,
              motivo,
            },
          },
        });

        await tx.integracaoEventoExterno.updateMany({
          where: {
            cicloId: proximo.id,
            status: { not: "IGNORADO" },
          },
          data: {
            status: "IGNORADO",
            ultimoErro: "Ciclo ignorado por saneamento de sobreposicao",
          },
        });

        await tx.integracaoOutbox.updateMany({
          where: {
            cicloId: proximo.id,
            status: { in: ["PENDENTE", "IGNORADO", "ERRO"] },
          },
          data: {
            status: "IGNORADO",
            ultimoErro: "Ciclo ignorado por saneamento de sobreposicao",
            proximaTentativaAt: null,
          },
        });
      }

      atual = {
        ...atual,
        inicioAt: novoInicio || atual.inicioAt,
        conclusaoAt: novoFim || atual.conclusaoAt,
        cancelamentoAt: null,
        prazoPrevistoAt: novoPrazo || atual.prazoPrevistoAt,
      };
      continue;
    }

    atual = proximo;
  }

  return acoes;
}

async function corrigirLogisticasOrfas(tx, remanejamentoFuncionarioIds, apply) {
  const acoes = [];

  for (const remanejamentoFuncionarioId of remanejamentoFuncionarioIds) {
    const logisticas = await tx.remanejamentoCiclo.findMany({
      where: {
        remanejamentoFuncionarioId,
        setor: "LOGISTICA",
        status: { not: "IGNORADO" },
      },
      orderBy: { numeroCiclo: "asc" },
    });

    for (const logistica of logisticas) {
      const logisticaJaEnviada = await tx.integracaoOutbox.findFirst({
        where: {
          cicloId: logistica.id,
          status: { in: ["AGENDADO_SESSAO", "ENVIADO"] },
        },
        select: { id: true },
      });
      if (logisticaJaEnviada) {
        acoes.push({ logistica, tipo: "PRESERVAR_JA_ENVIADA" });
        continue;
      }

      const setoresMesmoCiclo = await tx.remanejamentoCiclo.findMany({
        where: {
          remanejamentoFuncionarioId,
          numeroCiclo: logistica.numeroCiclo,
          setor: { in: [...SETORES_CADASTRO] },
          status: { not: "IGNORADO" },
        },
      });
      if (setoresMesmoCiclo.length > 0) continue;

      const setoresCandidatos = await tx.remanejamentoCiclo.findMany({
        where: {
          remanejamentoFuncionarioId,
          setor: { in: [...SETORES_CADASTRO] },
          status: { not: "IGNORADO" },
          numeroCiclo: { lt: logistica.numeroCiclo },
        },
        orderBy: { numeroCiclo: "desc" },
      });
      const numeroDestino = setoresCandidatos[0]?.numeroCiclo;

      if (!numeroDestino) {
        acoes.push({ logistica, tipo: "IGNORAR_SEM_DESTINO" });
        if (apply) {
          await tx.remanejamentoCiclo.update({
            where: { id: logistica.id },
            data: {
              status: "IGNORADO",
              motivoFechamento:
                "Logistica reconstruida ignorada por nao haver ciclo de setores correspondente",
            },
          });
        }
        continue;
      }

      const logisticaDestino = await tx.remanejamentoCiclo.findUnique({
        where: {
          remanejamentoFuncionarioId_numeroCiclo_setor: {
            remanejamentoFuncionarioId,
            numeroCiclo: numeroDestino,
            setor: "LOGISTICA",
          },
        },
      });

      if (logisticaDestino && logisticaDestino.id !== logistica.id) {
        acoes.push({ logistica, tipo: "IGNORAR_DESTINO_EXISTE", numeroDestino });
        if (apply) {
          await tx.remanejamentoCiclo.update({
            where: { id: logistica.id },
            data: {
              status: "IGNORADO",
              motivoFechamento:
                "Logistica reconstruida ignorada por ja existir Logistica no ciclo de setores correspondente",
            },
          });
        }
        continue;
      }

      const setoresDestino = await tx.remanejamentoCiclo.findMany({
        where: {
          remanejamentoFuncionarioId,
          numeroCiclo: numeroDestino,
          setor: { in: [...SETORES_CADASTRO] },
          status: { not: "IGNORADO" },
        },
      });
      const inicioAt =
        maxDate(...setoresDestino.map((ciclo) => ciclo.conclusaoAt || ciclo.cancelamentoAt)) ||
        logistica.inicioAt;

      acoes.push({
        logistica,
        tipo: "REALOCAR",
        numeroDestino,
        inicioAt,
      });

      if (apply) {
        await tx.remanejamentoCiclo.update({
          where: { id: logistica.id },
          data: {
            numeroCiclo: numeroDestino,
            inicioAt,
            prazoPrevistoAt: new Date(inicioAt.getTime() + 7 * 24 * 60 * 60 * 1000),
            motivoAbertura:
              "Logistica realocada para o ciclo de setores correspondente apos saneamento de sobreposicao",
          },
        });

        await tx.remanejamentoCicloEvento.create({
          data: {
            cicloId: logistica.id,
            remanejamentoFuncionarioId,
            tipo: "LOGISTICA_REALOCADA",
            dataEvento: new Date(),
            origem: "RECONSTRUIDO",
            dados: {
              numeroCicloAnterior: logistica.numeroCiclo,
              numeroCicloNovo: numeroDestino,
              motivo:
                "Ciclo de setor sobreposto foi ignorado; Logistica foi movida para o ciclo valido correspondente.",
            },
          },
        });
      }
    }
  }

  return acoes;
}

async function contarSobrepostos() {
  const rows = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS total
    FROM "RemanejamentoCiclo" c1
    JOIN "RemanejamentoCiclo" c2 ON c2."remanejamentoFuncionarioId" = c1."remanejamentoFuncionarioId"
      AND c2.setor = c1.setor
      AND c2."numeroCiclo" > c1."numeroCiclo"
    WHERE c1.status <> 'IGNORADO'
      AND c2.status <> 'IGNORADO'
      AND c1.origem = 'RECONSTRUIDO'
      AND c2.origem = 'RECONSTRUIDO'
      AND c1.setor IN ('RH','MEDICINA','TREINAMENTO')
      AND COALESCE(c1."conclusaoAt", c1."cancelamentoAt") IS NOT NULL
      AND c2."inicioAt" < COALESCE(c1."conclusaoAt", c1."cancelamentoAt")
  `;
  return Number(rows[0]?.total || 0);
}

async function main() {
  const apply = hasArg("--apply");
  const remanejamentoFuncionarioId = argValue("--rem-id");

  const antes = await contarSobrepostos();
  const grupos = await carregarGrupos(remanejamentoFuncionarioId);
  const todasAcoes = [];
  let acoesLogistica = [];
  const remanejamentosAfetados = new Set();
  if (remanejamentoFuncionarioId) remanejamentosAfetados.add(remanejamentoFuncionarioId);

  if (apply) {
    await prisma.$transaction(
      async (tx) => {
        for (const ciclos of grupos.values()) {
          if (ciclos.length < 2) continue;
          const acoesGrupo = await sanearGrupo(tx, ciclos, true);
          for (const acao of acoesGrupo) {
            remanejamentosAfetados.add(acao.manter.remanejamentoFuncionarioId);
          }
          todasAcoes.push(...acoesGrupo);
        }
        acoesLogistica = await corrigirLogisticasOrfas(tx, remanejamentosAfetados, true);
      },
      { timeout: 120000 },
    );
  } else {
    for (const ciclos of grupos.values()) {
      if (ciclos.length < 2) continue;
      const acoesGrupo = await sanearGrupo(prisma, ciclos, false);
      for (const acao of acoesGrupo) {
        remanejamentosAfetados.add(acao.manter.remanejamentoFuncionarioId);
      }
      todasAcoes.push(...acoesGrupo);
    }
    acoesLogistica = await corrigirLogisticasOrfas(prisma, remanejamentosAfetados, false);
  }

  const depois = apply ? await contarSobrepostos() : antes;
  const exemplos = todasAcoes.slice(0, 20).map((acao) => ({
    funcionario: acao.manter.remanejamentoFuncionario.funcionario.nome,
    matricula: acao.manter.remanejamentoFuncionario.funcionario.matricula,
    remanejamentoFuncionarioId: acao.manter.remanejamentoFuncionarioId,
    setor: acao.manter.setor,
    cicloMantido: acao.manter.numeroCiclo,
    cicloIgnorado: acao.ignorar.numeroCiclo,
    inicioMantido: fmt(acao.manter.inicioAt),
    fimMantidoOriginal: fmt(fimCiclo(acao.manter)),
    inicioIgnorado: fmt(acao.ignorar.inicioAt),
    fimIgnorado: fmt(fimCiclo(acao.ignorar)),
    novoFimMantido: fmt(acao.novoFim),
  }));

  console.log(
    JSON.stringify(
      {
        modo: apply ? "apply" : "dry-run",
        remanejamentoFuncionarioId: remanejamentoFuncionarioId || null,
        sobrepostosAntes: antes,
        acoes: todasAcoes.length,
        acoesLogistica: acoesLogistica.length,
        sobrepostosDepois: depois,
        exemplos,
        exemplosLogistica: acoesLogistica.slice(0, 20).map((acao) => ({
          tipo: acao.tipo,
          remanejamentoFuncionarioId: acao.logistica.remanejamentoFuncionarioId,
          cicloLogisticaOriginal: acao.logistica.numeroCiclo,
          cicloDestino: acao.numeroDestino || null,
          inicioOriginal: fmt(acao.logistica.inicioAt),
          inicioNovo: fmt(acao.inicioAt),
        })),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
