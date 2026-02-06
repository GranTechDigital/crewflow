// src/app/api/funcionarios/sincronizar/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sincronizarTarefasPadrao } from "@/lib/tarefasPadraoSync";

function parseDate(dateStr: string): Date | null {
  const s = String(dateStr || "").trim();
  if (!s) return null;

  // Suporta formatos brasileiros: DD/MM/YYYY e DD-MM-YYYY, com ou sem horário
  const br = s.match(
    /^(\d{2})[\/\-\.](\d{2})[\/\-\.](\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (br) {
    const day = parseInt(br[1], 10);
    const month = parseInt(br[2], 10);
    const year = parseInt(br[3], 10);
    const hh = br[4] ? parseInt(br[4], 10) : 0;
    const mm = br[5] ? parseInt(br[5], 10) : 0;
    const ss = br[6] ? parseInt(br[6], 10) : 0;
    const d = new Date(Date.UTC(year, month - 1, day, hh, mm, ss));
    return isNaN(d.getTime()) ? null : d;
  }

  // Suporta formatos ISO comuns: YYYY-MM-DD e variações com horário
  const iso = s.match(
    /^(\d{4})[\/\-\.](\d{2})[\/\-\.](\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (iso) {
    const year = parseInt(iso[1], 10);
    const month = parseInt(iso[2], 10);
    const day = parseInt(iso[3], 10);
    const hh = iso[4] ? parseInt(iso[4], 10) : 0;
    const mm = iso[5] ? parseInt(iso[5], 10) : 0;
    const ss = iso[6] ? parseInt(iso[6], 10) : 0;
    const d = new Date(Date.UTC(year, month - 1, day, hh, mm, ss));
    return isNaN(d.getTime()) ? null : d;
  }

  // Fallback para Date parser nativo
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function getDateField(
  item: Record<string, unknown>,
  keys: string[],
): Date | null {
  for (const key of keys) {
    const value = (item as any)[key];
    if (value) return parseDate(String(value));
  }
  return null;
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
        error instanceof Error ? error.message : "Erro desconhecido",
      );

      if (attempt === maxRetries) {
        throw error;
      }

      // Aguardar antes da próxima tentativa (backoff exponencial)
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
}

export async function POST(request: Request) {
  try {
    console.log("Iniciando sincronização de funcionários...");
    // Opções da requisição
    let forceUpdateAdmissao = false;
    try {
      const body = await request.json().catch(() => null);
      if (body && typeof body === "object") {
        forceUpdateAdmissao =
          (body as any).forceUpdateAdmissao === true ||
          (body as any).fullRefreshAdmissao === true ||
          (body as any).forceAdmissao === true;
      }
    } catch {}

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
      mapApi.set(String(item.MATRICULA), item),
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
          f.matricula !== "ADMIN001",
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
      (item: Record<string, unknown>) => !mapBanco.has(String(item.MATRICULA)),
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
          dataAdmissao: getDateField(item, [
            "DATA_ADMISSAO",
            "DATA_ADMISSÃO",
            "DATAADMISSAO",
            "DT_ADMISSAO",
            "DTADMISSAO",
            "ADMISSAO",
            "dataAdmissao",
          ]),
          dataDemissao: getDateField(item, [
            "DATA_DEMISSAO",
            "DATA_DEMISSÃO",
            "DATADEMISSAO",
            "DT_DEMISSAO",
            "DTDEMISSAO",
            "DEMISSAO",
            "dataDemissao",
          ]),
          email: item.EMAIL ? String(item.EMAIL) : null,
          telefone: item.TELEFONE,
          centroCusto: item.CENTRO_CUSTO,
          departamento: item.DEPARTAMENTO,
          status: item.STATUS, // Status da folha de pagamento
          statusPrestserv: "SEM_CADASTRO", // Novos funcionários sempre começam com SEM_CADASTRO no Prestserv
          criadoEm: now,
          atualizadoEm: now,
          excluidoEm: null,
        }),
      );

      await prisma.funcionario.createMany({ data: dadosParaInserir });
    }

    // 3) Atualizar funcionários cujo status mudou e/ou função mudou
    const paraAtualizar: Array<{
      matricula: string;
      status: string;
      statusPrestserv?: string;
      funcao?: string | null;
      atualizadoEm: Date;
      excluidoEm?: Date | null;
      dataAdmissao?: Date | null;
      dataDemissao?: Date | null;
    }> = [];

    const funcionariosFuncaoAlteradaIds = new Set<number>();
    const funcoesAlteradasDetalhes: Array<{
      funcionarioId: number;
      valorAnterior: string;
      valorNovo: string;
    }> = [];

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
      const dataAdmissaoApi = getDateField(
        dadosApi as Record<string, unknown>,
        [
          "DATA_ADMISSAO",
          "DATA_ADMISSÃO",
          "DATAADMISSAO",
          "DT_ADMISSAO",
          "DTADMISSAO",
          "ADMISSAO",
          "dataAdmissao",
        ],
      );
      const dataDemissaoApi = getDateField(
        dadosApi as Record<string, unknown>,
        [
          "DATA_DEMISSAO",
          "DATA_DEMISSÃO",
          "DATADEMISSAO",
          "DT_DEMISSAO",
          "DTDEMISSAO",
          "DEMISSAO",
          "dataDemissao",
        ],
      );
      const dataAdmissaoBanco = (func as any).dataAdmissao
        ? new Date((func as any).dataAdmissao)
        : null;
      const dataDemissaoBanco = (func as any).dataDemissao
        ? new Date((func as any).dataDemissao)
        : null;
      const dataAdmissaoDiff =
        (dataAdmissaoApi?.getTime() ?? null) !==
        (dataAdmissaoBanco?.getTime() ?? null);
      const dataDemissaoDiff =
        (dataDemissaoApi?.getTime() ?? null) !==
        (dataDemissaoBanco?.getTime() ?? null);

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
          funcaoApi,
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
          funcoesAlteradasDetalhes.push({
            funcionarioId: func.id,
            valorAnterior: funcaoBancoNorm,
            valorNovo: funcaoApi,
          });
        }
      } else {
        if (isRhudson)
          console.log("[SYNC rhudson] função permanece inalterada");
      }

      // Atualização de datas:
      // - Se forceUpdateAdmissao: atualiza dataAdmissao quando existir na API, mesmo sem diff
      // - dataDemissao atualiza apenas quando houver diff
      const shouldUpdateAdmissao = forceUpdateAdmissao
        ? !!dataAdmissaoApi
        : dataAdmissaoDiff;
      const shouldUpdateDemissao = dataDemissaoDiff;
      if (shouldUpdateAdmissao || shouldUpdateDemissao) {
        paraAtualizar.push({
          matricula: func.matricula,
          status: func.status || "ATIVO",
          atualizadoEm: now,
          excluidoEm: null,
          dataAdmissao: shouldUpdateAdmissao ? dataAdmissaoApi : undefined,
          dataDemissao: shouldUpdateDemissao ? dataDemissaoApi : undefined,
        });
      }
    });

    // Atualizar os registros
    for (const f of paraAtualizar) {
      await prisma.funcionario.update({
        where: { matricula: f.matricula },
        data: {
          status: f.status,
          statusPrestserv:
            f.statusPrestserv !== undefined ? f.statusPrestserv : undefined,
          funcao: f.funcao !== undefined ? f.funcao : undefined,
          atualizadoEm: f.atualizadoEm,
          excluidoEm: f.excluidoEm,
          dataAdmissao:
            f.dataAdmissao !== undefined ? f.dataAdmissao : undefined,
          dataDemissao:
            f.dataDemissao !== undefined ? f.dataDemissao : undefined,
        },
      });
    }
    console.log("[SYNC] total atualizações aplicadas:", paraAtualizar.length);

    // Registrar histórico de mudança de função para RFs em processo
    if (funcoesAlteradasDetalhes.length > 0) {
      try {
        const ids = Array.from(funcionariosFuncaoAlteradaIds);
        const rems = await prisma.remanejamentoFuncionario.findMany({
          where: {
            funcionarioId: { in: ids },
            statusTarefas: { notIn: ["CONCLUIDO", "CANCELADO"] },
          },
          select: { id: true, solicitacaoId: true, funcionarioId: true },
        });
        const detMap = new Map<
          number,
          { valorAnterior: string; valorNovo: string }
        >();
        for (const d of funcoesAlteradasDetalhes)
          detMap.set(d.funcionarioId, {
            valorAnterior: d.valorAnterior,
            valorNovo: d.valorNovo,
          });
        const toCreate = rems
          .map((rf) => {
            const det = detMap.get(rf.funcionarioId);
            if (!det) return null;
            return {
              solicitacaoId: rf.solicitacaoId,
              remanejamentoFuncionarioId: rf.id,
              tipoAcao: "ATUALIZACAO_CAMPO",
              entidade: "FUNCIONARIO",
              campoAlterado: "funcao",
              valorAnterior: det.valorAnterior || null,
              valorNovo: det.valorNovo || null,
              descricaoAcao: `Função alterada de "${det.valorAnterior}" para "${det.valorNovo}"`,
              usuarioResponsavel: "Sistema - Sincronização de Função",
            } as const;
          })
          .filter(Boolean) as any[];
        if (toCreate.length > 0) {
          for (let i = 0; i < toCreate.length; i += 100) {
            await prisma.historicoRemanejamento.createMany({
              data: toCreate.slice(i, i + 100),
            });
          }
        }
      } catch (e) {
        console.error("Erro ao registrar histórico de mudança de função:", e);
      }
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
          resultado.message,
        );
      } catch (syncError) {
        console.error(
          "Erro ao re-sincronizar treinamentos após mudança de função:",
          syncError,
        );
      }
    }

    console.log(
      `Sincronização de funcionários concluída: ${matriculasParaDemitir.length} demitidos, ${novosFuncionarios.length} adicionados, ${paraAtualizar.length} atualizados`,
    );

    return NextResponse.json({
      message: "Sincronização concluída",
      demitidos: matriculasParaDemitir.length,
      adicionados: novosFuncionarios.length,
      atualizados: paraAtualizar.length,
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
      { status: 500 },
    );
  }
}
