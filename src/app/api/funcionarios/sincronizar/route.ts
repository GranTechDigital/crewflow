// src/app/api/funcionarios/sincronizar/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sincronizarTarefasPadrao } from "@/lib/tarefasPadraoSync";

const RM_API_URL =
  process.env.RM_API_URL ||
  "https://granihcservices145382.rm.cloudtotvs.com.br:8051/api/framework/v1/consultaSQLServer/RealizaConsulta/GS.INT.0005/1/P";
const RM_API_AUTH =
  process.env.RM_API_AUTH ||
  "Basic SW50ZWdyYS5BZG1pc3NhbzpHckBuIWhjMjAyMg==";

function parseDate(dateStr: string): Date | null {
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

// Fonte de data de admissão: tenta várias chaves comuns da API externa
function getDataAdmissaoFromApi(item: Record<string, unknown>): Date | null {
  const possibleKeys = [
    "DATA_ADMISSAO",
    "DT_ADMISSAO",
    "DATA_ADM",
    "ADMISSAO",
  ];
  for (const k of possibleKeys) {
    const v = (item as any)[k];
    if (v) {
      const d = parseDate(String(v));
      if (d) return d;
    }
  }
  return null;
}

async function fetchExternalDataWithRetry(maxRetries = 3, timeout = 15000) {
  const url = RM_API_URL;
  const headers = {
    Authorization: RM_API_AUTH,
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

export async function POST() {
  try {
    console.log("Iniciando sincronização de funcionários...");

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

    const mapBanco = new Map<
      string,
      { matricula: string; status: string | null }
    >();
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
          // nova coluna: data de admissão
          dataAdmissao: getDataAdmissaoFromApi(item),
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
    }

    // 3) Atualizar funcionários cujo status mudou e/ou função mudou
    const paraAtualizar: Array<{
      matricula: string;
      status: string;
      statusPrestserv?: string;
      funcao?: string | null;
      // nova coluna: data de admissão opcional em updates
      dataAdmissao?: Date | null;
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

      // data de admissão vinda da API
      const admApi = getDataAdmissaoFromApi(dadosApi as any);
      const admBanco = func.dataAdmissao || null;

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

      // Atualizar data de admissão quando disponível na API e diferente do banco
      if (admApi && (!admBanco || admBanco.getTime() !== admApi.getTime())) {
        paraAtualizar.push({
          matricula: func.matricula,
          status: func.status || "ATIVO",
          dataAdmissao: admApi,
          atualizadoEm: now,
          excluidoEm: null,
        });
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
          // nova coluna
          dataAdmissao: f.dataAdmissao !== undefined ? f.dataAdmissao : undefined,
          atualizadoEm: f.atualizadoEm,
          excluidoEm: f.excluidoEm,
        },
      });
    }
    console.log("[SYNC] total atualizações aplicadas:", paraAtualizar.length);

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

    // Backfill: preencher dataAdmissao a partir de UptimeSheet para quem estiver nulo
    let backfillAtualizados = 0;
    const semAdmissao = await prisma.funcionario.findMany({
      where: { dataAdmissao: null },
      select: { id: true, matricula: true },
    });
    for (const f of semAdmissao) {
      const ultimoComAdmissao = await prisma.uptimeSheet.findFirst({
        where: { matricula: f.matricula, NOT: { dataAdmissao: null } },
        orderBy: { createdAt: "desc" },
        select: { dataAdmissao: true },
      });
      if (ultimoComAdmissao?.dataAdmissao) {
        await prisma.funcionario.update({
          where: { id: f.id },
          data: { dataAdmissao: ultimoComAdmissao.dataAdmissao },
        });
        backfillAtualizados++;
      }
    }

    console.log(
      `Sincronização de funcionários concluída: ${matriculasParaDemitir.length} demitidos, ${novosFuncionarios.length} adicionados, ${paraAtualizar.length} atualizados, ${backfillAtualizados} backfill`
    );

    return NextResponse.json({
      message: "Sincronização concluída",
      demitidos: matriculasParaDemitir.length,
      adicionados: novosFuncionarios.length,
      atualizados: paraAtualizar.length,
      backfill: backfillAtualizados,
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

    return NextResponse.json(
      {
        error: userMessage,
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
