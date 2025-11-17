// src/app/api/funcionarios/sincronizar/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sincronizarTarefasPadrao } from "@/lib/tarefasPadraoSync";
 

function parseDate(dateStr: string): Date | null {
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

async function fetchExternalDataWithRetry(maxRetries = 3, timeout = 15000) {
  const url =
    "https://granihcservices145382.rm.cloudtotvs.com.br:8051/api/framework/v1/consultaSQLServer/RealizaConsulta/GS.INT.0005/1/P";
  const headers = {
    Authorization: "Basic SW50ZWdyYS5BZG1pc3NhbzpHckBuIWhjMjAyMg==",
  };

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.log(
        `Tentativa ${attempt}/${maxRetries} falhou:`,
        error instanceof Error ? error.message : "Erro desconhecido"
      );

      if (attempt === maxRetries) {
        throw error;
      }

      // Aguardar antes da próxima tentativa (backoff exponencial)
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
}

export async function POST(req: Request) {
  let runId: string | null = null;
  try {
    console.log("Iniciando sincronização de funcionários...");
    let source: "worker" | "auto" | "manual" = "manual";
    let requestId: string | undefined = undefined;
    try {
      const body = await req.json();
      if (body && (body.source === "worker" || body.source === "auto")) {
        source = body.source;
      }
      if (body && typeof body.requestId === "string" && body.requestId.length > 0) {
        requestId = body.requestId;
      }
    } catch {}
    const syncRun = await prisma.funcionarioSyncRun.create({
      data: {
        source,
        status: "EM_ANDAMENTO",
        requestId,
      },
    });
    runId = syncRun.id;

    // Buscar dados da API externa com retry
    const dadosExternos = await fetchExternalDataWithRetry();
    console.log(`Dados externos obtidos: ${dadosExternos.length} registros`);

    // Buscar dados atuais do banco (excluindo o administrador do sistema)
    const dadosBanco = await prisma.funcionario.findMany({
      where: {
        matricula: {
          not: "ADMIN001",
        },
      },
    });

    const now = new Date();

    // Criar maps para facilitar a comparação por matrícula
    const mapApi = new Map<string, Record<string, unknown>>();
    dadosExternos.forEach((item: Record<string, unknown>) =>
      mapApi.set(String(item.MATRICULA), item)
    );

    const mapBanco = new Map<string, (typeof dadosBanco)[number]>();
    dadosBanco.forEach((item) => mapBanco.set(item.matricula, item));

    // 1) Atualizar status para "DEMITIDO" para funcionários que tem no banco mas NÃO tem na API
    // Excluir o administrador do sistema da sincronização
    const matriculasParaDemitir = dadosBanco
      .filter(
        (f) =>
          !mapApi.has(f.matricula) &&
          f.status !== "DEMITIDO" &&
          f.matricula !== "ADMIN001"
      )
      .map((f) => f.matricula);

    if (matriculasParaDemitir.length > 0) {
      await prisma.funcionario.updateMany({
        where: { matricula: { in: matriculasParaDemitir } },
        data: {
          status: "DEMITIDO",
          atualizadoEm: now,
          excluidoEm: now,
        },
      });
      const demitidosItemsData = matriculasParaDemitir.map((m) => {
        const prev = mapBanco.get(m);
        return {
          runId: syncRun.id,
          funcionarioId: prev?.id,
          matricula: m,
          tipo: "DEMITIDO",
          changes: {
            campos: [
              { campo: "status", antes: prev?.status ?? null, depois: "DEMITIDO" },
              { campo: "excluidoEm", antes: null, depois: now.toISOString() },
            ],
          },
        } as const;
      });
      await prisma.funcionarioSyncItem.createMany({ data: demitidosItemsData as any });
    }

    // 2) Inserir funcionários que tem na API mas NÃO tem no banco
    const novosFuncionarios = dadosExternos.filter(
      (item: Record<string, unknown>) => !mapBanco.has(String(item.MATRICULA))
    );

    if (novosFuncionarios.length > 0) {
      const dadosParaInserir = novosFuncionarios.map(
        (item: Record<string, unknown>) => ({
          matricula: String(item.MATRICULA),
          cpf: item.CPF ? String(item.CPF) : null,
          nome: String(item.NOME),
          funcao: item.FUNCAO ? String(item.FUNCAO).trim() : null,
          rg: item.RG ? String(item.RG) : null,
          orgaoEmissor: item["ORGÃO_EMISSOR"]
            ? String(item["ORGÃO_EMISSOR"])
            : null,
          uf: item.UF ? String(item.UF) : null,
          dataNascimento: item.DATA_NASCIMENTO
            ? parseDate(String(item.DATA_NASCIMENTO))
            : null,
          email: item.EMAIL ? String(item.EMAIL) : null,
          telefone: item.TELEFONE,
          centroCusto: item.CENTRO_CUSTO,
          departamento: item.DEPARTAMENTO,
          status: item.STATUS, // Status da folha de pagamento
          statusPrestserv: "SEM_CADASTRO", // Novos funcionários sempre começam com SEM_CADASTRO no Prestserv
          criadoEm: now,
          atualizadoEm: now,
          excluidoEm: null,
        })
      );

      await prisma.funcionario.createMany({ data: dadosParaInserir });
      const novasMatriculas = novosFuncionarios.map((i: any) => String(i.MATRICULA));
      const inseridos = await prisma.funcionario.findMany({
        where: { matricula: { in: novasMatriculas } },
        select: { id: true, matricula: true },
      });
      const itemsData = inseridos.map((f) => ({
        runId: syncRun.id,
        funcionarioId: f.id,
        matricula: f.matricula,
        tipo: "ADICIONADO",
        changes: null,
      }));
      await prisma.funcionarioSyncItem.createMany({ data: itemsData });
    }

    // 3) Atualizar funcionários cujo status mudou e/ou função mudou
    const paraAtualizar: Array<{
      matricula: string;
      status: string;
      statusPrestserv?: string;
      funcao?: string | null;
      atualizadoEm: Date;
      excluidoEm?: Date | null;
    }> = [];

    const funcionariosFuncaoAlteradaIds = new Set<number>();

    dadosBanco.forEach((func) => {
      const dadosApi = mapApi.get(func.matricula);
      if (!dadosApi) return;

      const statusApi = String((dadosApi as any).STATUS);
      const statusBanco = func.status;
      const funcaoApiRaw = (dadosApi as any).FUNCAO
        ? String((dadosApi as any).FUNCAO)
        : null;
      const funcaoApi = funcaoApiRaw ? funcaoApiRaw.trim() : null;
      const funcaoBancoNorm = (func.funcao || "").trim();

      const isRhudson = (func.nome || "").toLowerCase().includes("rhudson");
      if (isRhudson) {
        console.log(
          "[SYNC rhudson] matricula=",
          func.matricula,
          "statusBanco=",
          statusBanco,
          "statusApi=",
          statusApi,
          "funcaoBancoNorm=",
          funcaoBancoNorm,
          "funcaoApi=",
          funcaoApi
        );
      }

      // Verificar se o funcionário precisa ter o statusPrestserv atualizado para SEM_CADASTRO
      if (func.statusPrestserv === null || func.statusPrestserv === undefined) {
        paraAtualizar.push({
          matricula: func.matricula,
          status: func.status || "ATIVO",
          statusPrestserv: "SEM_CADASTRO",
          atualizadoEm: now,
          excluidoEm: null,
        });
        // não retorna; segue para avaliar mudança de função e status
      }

      // Mudança de status (exceto DEMITIDO que já foi tratado)
      if (statusBanco !== statusApi && statusApi !== "DEMITIDO") {
        if (statusBanco === "ADMISSÃO PROX.MÊS" && statusApi === "ATIVO") {
          paraAtualizar.push({
            matricula: func.matricula,
            status: "ATIVO",
            atualizadoEm: now,
            excluidoEm: null,
          });
        } else {
          paraAtualizar.push({
            matricula: func.matricula,
            status: statusApi,
            atualizadoEm: now,
            excluidoEm: null,
          });
        }
      }

      // Mudança de função (normalizada com trim)
      if (funcaoApi && funcaoBancoNorm !== funcaoApi) {
        if (isRhudson)
          console.log("[SYNC rhudson] função será atualizada para", funcaoApi);
        paraAtualizar.push({
          matricula: func.matricula,
          status: func.status || "ATIVO",
          funcao: funcaoApi,
          atualizadoEm: now,
          excluidoEm: null,
        });
        if (typeof func.id === "number") {
          funcionariosFuncaoAlteradaIds.add(func.id);
        }
      } else {
        if (isRhudson)
          console.log("[SYNC rhudson] função permanece inalterada");
      }
    });

    // Atualizar os registros
    for (const f of paraAtualizar) {
      await prisma.funcionario.update({
        where: { matricula: f.matricula },
        data: {
          status: f.status,
          statusPrestserv: f.statusPrestserv, // Incluir statusPrestserv se estiver definido
          funcao: f.funcao !== undefined ? f.funcao : undefined,
          atualizadoEm: f.atualizadoEm,
          excluidoEm: f.excluidoEm,
        },
      });
    }
    console.log("[SYNC] total atualizações aplicadas:", paraAtualizar.length);
    const changesByMatricula = new Map<string, Array<{ campo: string; antes: any; depois: any }>>();
    for (const f of paraAtualizar) {
      const prev = mapBanco.get(f.matricula);
      const arr = changesByMatricula.get(f.matricula) ?? [];
      if (f.status !== undefined && prev?.status !== f.status) {
        arr.push({ campo: "status", antes: prev?.status ?? null, depois: f.status });
      }
      if (f.statusPrestserv !== undefined && prev?.statusPrestserv !== f.statusPrestserv) {
        arr.push({ campo: "statusPrestserv", antes: prev?.statusPrestserv ?? null, depois: f.statusPrestserv });
      }
      if (f.funcao !== undefined && prev?.funcao !== f.funcao) {
        arr.push({ campo: "funcao", antes: prev?.funcao ?? null, depois: f.funcao });
      }
      if (arr.length > 0) changesByMatricula.set(f.matricula, arr);
    }
    if (changesByMatricula.size > 0) {
      const itemsData = Array.from(changesByMatricula.entries()).map(([matricula, campos]) => {
        const prev = mapBanco.get(matricula);
        return {
          runId: syncRun.id,
          funcionarioId: prev?.id,
          matricula,
          tipo: "ATUALIZADO",
          changes: { campos },
        };
      });
      await prisma.funcionarioSyncItem.createMany({ data: itemsData });
    }

    // Re-sync de treinamentos apenas para funcionários com função alterada e remanejamentos em "ATENDER TAREFAS"
    if (funcionariosFuncaoAlteradaIds.size > 0) {
      try {
        const resultado = await sincronizarTarefasPadrao({
          setores: ["TREINAMENTO"],
          usuarioResponsavel: "Sistema - Sincronização de Função",
          funcionarioIds: Array.from(funcionariosFuncaoAlteradaIds),
        });
        console.log(
          `Re-sync de TREINAMENTO executado para ${funcionariosFuncaoAlteradaIds.size} funcionário(s):`,
          resultado.message
        );
      } catch (syncError) {
        console.error(
          "Erro ao re-sincronizar treinamentos após mudança de função:",
          syncError
        );
      }
    }

    console.log(
      `Sincronização de funcionários concluída: ${matriculasParaDemitir.length} demitidos, ${novosFuncionarios.length} adicionados, ${changesByMatricula.size} atualizados`
    );
    await prisma.funcionarioSyncRun.update({
      where: { id: syncRun.id },
      data: {
        finishedAt: new Date(),
        status: "SUCESSO",
        adicionados: novosFuncionarios.length,
        atualizados: changesByMatricula.size,
        demitidos: matriculasParaDemitir.length,
      },
    });

    return NextResponse.json({
      message: "Sincronização concluída",
      demitidos: matriculasParaDemitir.length,
      adicionados: novosFuncionarios.length,
      atualizados: changesByMatricula.size,
      runId: syncRun.id,
    });
  } catch (error) {
    console.error("Erro na sincronização de funcionários:", error);

    // Retornar erro mais específico
    const errorMessage =
      error instanceof Error ? error.message : "Erro desconhecido";
    const isTimeoutError =
      errorMessage.includes("AbortError") || errorMessage.includes("timeout");
    const isNetworkError =
      errorMessage.includes("fetch") || errorMessage.includes("network");

    let userMessage = "Erro interno na sincronização.";
    if (isTimeoutError) {
      userMessage =
        "Timeout na sincronização. A API externa demorou muito para responder.";
    } else if (isNetworkError) {
      userMessage = "Erro de conexão com a API externa.";
    }

    if (runId) {
      try {
        await prisma.funcionarioSyncRun.update({
          where: { id: runId },
          data: {
            finishedAt: new Date(),
            status: "FALHA",
            errorMessage,
          },
        });
      } catch {}
    }
    return NextResponse.json({ error: userMessage, details: errorMessage }, { status: 500 });
  }
}
