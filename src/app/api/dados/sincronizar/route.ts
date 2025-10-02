// src/app/api/funcionarios/sincronizar/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function parseDate(dateStr: string): Date | null {
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

async function fetchExternalDataWithRetry(maxRetries = 3, timeout = 30000) {
  const url =
    "https://granihcservices145382.rm.cloudtotvs.com.br:8051/api/framework/v1/consultaSQLServer/RealizaConsulta/GS.INT.0005/1/P";
  const headers = {
    Authorization: "Basic SW50ZWdyYS5BZG1pc3NhbzpHckBuIWhjMjAyMg==",
  };

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Tentativa ${attempt} de ${maxRetries} para buscar dados externos`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
        console.log('Requisição abortada por timeout');
      }, timeout);

      const response = await fetch(url, {
        headers,
        signal: controller.signal,
        cache: 'no-store',
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`Dados recebidos com sucesso: ${data.length} registros`);
      return data;
    } catch (error) {
      console.error(
        `Tentativa ${attempt}/${maxRetries} falhou:`,
        error instanceof Error ? error.message : "Erro desconhecido"
      );

      if (attempt === maxRetries) {
        throw new Error(`Falha após ${maxRetries} tentativas: ${error instanceof Error ? error.message : "Erro desconhecido"}`);
      }

      // Backoff exponencial
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      console.log(`Aguardando ${delay}ms antes da próxima tentativa`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error("Não foi possível obter os dados externos");
}

export async function POST() {
  try {
    console.log("Iniciando sincronização...");

    // Buscar dados da API externa com retry
    let dadosExternos;
    try {
      dadosExternos = await fetchExternalDataWithRetry();
      if (!Array.isArray(dadosExternos)) {
        throw new Error("Dados externos inválidos: não é um array");
      }
      console.log(`Dados externos obtidos: ${dadosExternos.length} registros`);
    } catch (error) {
      console.error("Erro ao buscar dados externos:", error);
      return NextResponse.json(
        { error: "Erro ao buscar dados externos: " + (error instanceof Error ? error.message : "Erro desconhecido") },
        { status: 500 }
      );
    }

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
    const mapApi = new Map<string, any>();
    dadosExternos.forEach((item: any) => mapApi.set(item.MATRICULA, item));

    const mapBanco = new Map<string, any>();
    dadosBanco.forEach((item) => mapBanco.set(item.matricula, item));

    // Contadores para o relatório
    let contadores = {
      demitidos: 0,
      atualizados: 0,
      adicionados: 0
    };

    // 1) Atualizar status para "DEMITIDO" para funcionários que tem no banco mas NÃO tem na API
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
      contadores.demitidos = matriculasParaDemitir.length;
    }

    // 2) Inserir funcionários que tem na API mas NÃO tem no banco
    const novosFuncionarios = [];
    for (const item of dadosExternos) {
      if (!mapBanco.has(item.MATRICULA)) {
        novosFuncionarios.push({
          matricula: item.MATRICULA,
          nome: item.NOME,
          cpf: item.CPF,
          funcao: item.FUNCAO,
          rg: item.RG,
          orgaoEmissor: item.ORGAOEMISSOR,
          uf: item.UF,
          dataNascimento: parseDate(item.DATANASCIMENTO),
          email: item.EMAIL,
          telefone: item.TELEFONE,
          centroCusto: item.CENTROCUSTO,
          departamento: item.DEPARTAMENTO,
          status: item.STATUS,
          criadoEm: now,
          atualizadoEm: now,
        });
      }
    }

    if (novosFuncionarios.length > 0) {
      await prisma.funcionario.createMany({
        data: novosFuncionarios,
        skipDuplicates: true,
      });
      contadores.adicionados = novosFuncionarios.length;
    }

    // 3) Atualizar funcionários que existem em ambos
    for (const [matricula, dadosBD] of mapBanco) {
      const dadoAPI = mapApi.get(matricula);
      if (dadoAPI && matricula !== "ADMIN001") {
        const needsUpdate =
          dadosBD.nome !== dadoAPI.NOME ||
          dadosBD.cpf !== dadoAPI.CPF ||
          dadosBD.funcao !== dadoAPI.FUNCAO ||
          dadosBD.rg !== dadoAPI.RG ||
          dadosBD.orgaoEmissor !== dadoAPI.ORGAOEMISSOR ||
          dadosBD.uf !== dadoAPI.UF ||
          dadosBD.email !== dadoAPI.EMAIL ||
          dadosBD.telefone !== dadoAPI.TELEFONE ||
          dadosBD.centroCusto !== dadoAPI.CENTROCUSTO ||
          dadosBD.departamento !== dadoAPI.DEPARTAMENTO ||
          dadosBD.status !== dadoAPI.STATUS;

        if (needsUpdate) {
          await prisma.funcionario.update({
            where: { matricula },
            data: {
              nome: dadoAPI.NOME,
              cpf: dadoAPI.CPF,
              funcao: dadoAPI.FUNCAO,
              rg: dadoAPI.RG,
              orgaoEmissor: dadoAPI.ORGAOEMISSOR,
              uf: dadoAPI.UF,
              dataNascimento: parseDate(dadoAPI.DATANASCIMENTO),
              email: dadoAPI.EMAIL,
              telefone: dadoAPI.TELEFONE,
              centroCusto: dadoAPI.CENTROCUSTO,
              departamento: dadoAPI.DEPARTAMENTO,
              status: dadoAPI.STATUS,
              atualizadoEm: now,
            },
          });
          contadores.atualizados++;
        }
      }
    }

    console.log("Sincronização concluída com sucesso", contadores);
    return NextResponse.json(contadores);
  } catch (error) {
    console.error("Erro durante a sincronização:", error);
    return NextResponse.json(
      { error: "Erro durante a sincronização: " + (error instanceof Error ? error.message : "Erro desconhecido") },
      { status: 500 }
    );
  }
}
