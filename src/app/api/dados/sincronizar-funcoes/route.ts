// src/app/api/dados/sincronizar-funcoes/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

export async function POST() {
  try {
    console.log("Iniciando sincronização de funções...");

    // Buscar dados da API externa com retry
    const dadosExternos = await fetchExternalDataWithRetry();
    console.log(`Dados externos obtidos: ${dadosExternos.length} registros`);

    // Extrair funções distintas considerando o regime de trabalho (campo EMPREGADO)
    const funcoesDistintas = new Map<string, { funcao: string; regime: string }>();
    
    dadosExternos.forEach((item: Record<string, unknown>) => {
      if (item.FUNCAO && item.EMPREGADO) {
        // Normalizar o regime: se contém "OFFSHORE" então OFFSHORE, caso contrário ONSHORE
        const regimeNormalizado = String(item.EMPREGADO).toUpperCase().includes('OFFSHORE') ? 'OFFSHORE' : 'ONSHORE';
        
        const chave = `${item.FUNCAO}_${regimeNormalizado}`;
        if (!funcoesDistintas.has(chave)) {
          funcoesDistintas.set(chave, {
            funcao: String(item.FUNCAO),
            regime: regimeNormalizado
          });
        }
      }
    });

    console.log(`Funções distintas encontradas: ${funcoesDistintas.size}`);

    // Buscar funções existentes no banco
    const funcoesExistentes = await prisma.funcao.findMany({
      select: {
        funcao: true,
        regime: true
      }
    });

    // Criar um Set para verificação rápida de existência
    const funcoesExistentesSet = new Set(
      funcoesExistentes.map(f => `${f.funcao}_${f.regime || ''}`)
    );

    // Preparar dados para inserção (apenas funções que não existem)
    const funcoesParaInserir: Array<{
      funcao: string;
      regime: string;
      ativo: boolean;
    }> = [];

    funcoesDistintas.forEach(({ funcao, regime }) => {
      const chave = `${funcao}_${regime}`;
      if (!funcoesExistentesSet.has(chave)) {
        funcoesParaInserir.push({
          funcao,
          regime,
          ativo: true
        });
      }
    });

    // Inserir novas funções
    let funcoesInseridas = 0;
    if (funcoesParaInserir.length > 0) {
      // Inserir uma por uma para evitar problemas com duplicatas
      for (const funcaoData of funcoesParaInserir) {
        try {
          await prisma.funcao.create({
            data: funcaoData
          });
          funcoesInseridas++;
        } catch (error) {
          // Ignorar erros de duplicata (unique constraint)
          console.log(`Função já existe: ${funcaoData.funcao} - ${funcaoData.regime}`);
        }
      }
    }

    console.log(`Sincronização de funções concluída: ${funcoesInseridas} novas funções inseridas`);

    return NextResponse.json({
      message: "Sincronização de funções concluída",
      totalFuncoesDistintas: funcoesDistintas.size,
      funcoesExistentes: funcoesExistentes.length,
      novasFuncoesInseridas: funcoesInseridas,
      funcoes: Array.from(funcoesDistintas.values()).sort((a, b) => 
        a.funcao.localeCompare(b.funcao) || a.regime.localeCompare(b.regime)
      )
    });

  } catch (error) {
    console.error("Erro na sincronização de funções:", error);

    // Retornar erro mais específico
    const errorMessage =
      error instanceof Error ? error.message : "Erro desconhecido";
    const isTimeoutError =
      errorMessage.includes("AbortError") || errorMessage.includes("timeout");
    const isNetworkError =
      errorMessage.includes("fetch") || errorMessage.includes("network");

    let userMessage = "Erro interno na sincronização de funções.";
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