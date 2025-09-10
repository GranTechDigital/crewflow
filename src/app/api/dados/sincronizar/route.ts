// src/app/api/funcionarios/sincronizar/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function parseDate(dateStr: string): Date | null {
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

async function fetchExternalDataWithRetry(maxRetries = 3, timeout = 15000) {
  const url = "https://granihcservices145382.rm.cloudtotvs.com.br:8051/api/framework/v1/consultaSQLServer/RealizaConsulta/GS.INT.0005/1/P";
  const headers = { Authorization: 'Basic SW50ZWdyYS5BZG1pc3NhbzpHckBuIWhjMjAyMg==' };
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(url, { 
        headers,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.log(`Tentativa ${attempt}/${maxRetries} falhou:`, error instanceof Error ? error.message : 'Erro desconhecido');
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Aguardar antes da próxima tentativa (backoff exponencial)
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}

export async function POST() {
  try {
    console.log('Iniciando sincronização...');
    
    // Buscar dados da API externa com retry
    const dadosExternos = await fetchExternalDataWithRetry();
    console.log(`Dados externos obtidos: ${dadosExternos.length} registros`);

    // Buscar dados atuais do banco (excluindo o administrador do sistema)
    const dadosBanco = await prisma.funcionario.findMany({
      where: {
        matricula: {
          not: 'ADMIN001'
        }
      }
    });

    const now = new Date();

    // Criar maps para facilitar a comparação por matrícula
    const mapApi = new Map<string, any>();
    dadosExternos.forEach((item: any) => mapApi.set(item.MATRICULA, item));

    const mapBanco = new Map<string, any>();
    dadosBanco.forEach((item) => mapBanco.set(item.matricula, item));

    // 1) Atualizar status para "DEMITIDO" para funcionários que tem no banco mas NÃO tem na API
    // Excluir o administrador do sistema da sincronização
    const matriculasParaDemitir = dadosBanco
      .filter(f => !mapApi.has(f.matricula) && f.status !== 'DEMITIDO' && f.matricula !== 'ADMIN001')
      .map(f => f.matricula);

    if (matriculasParaDemitir.length > 0) {
      await prisma.funcionario.updateMany({
        where: { matricula: { in: matriculasParaDemitir } },
        data: {
          status: 'DEMITIDO',
          atualizadoEm: now,
          excluidoEm: now,
        },
      });
    }

    // 2) Inserir funcionários que tem na API mas NÃO tem no banco
    const novosFuncionarios = dadosExternos.filter((item: any) => !mapBanco.has(item.MATRICULA));

    if (novosFuncionarios.length > 0) {
      const dadosParaInserir = novosFuncionarios.map((item: any) => ({
        matricula: item.MATRICULA,
        cpf: item.CPF,
        nome: item.NOME,
        funcao: item.FUNCAO,
        
        rg: item.RG,
        orgaoEmissor: item['ORGÃO_EMISSOR'],
        uf: item.UF,
        dataNascimento: item.DATA_NASCIMENTO ? parseDate(item.DATA_NASCIMENTO) : null,
        email: item.EMAIL,
        telefone: item.TELEFONE,
        centroCusto: item.CENTRO_CUSTO,
        departamento: item.DEPARTAMENTO,
        status: item.STATUS, // Status da folha de pagamento
        statusPrestserv: 'SEM_CADASTRO', // Novos funcionários sempre começam com SEM_CADASTRO no Prestserv
        criadoEm: now,
        atualizadoEm: now,
        excluidoEm: null,
      }));

      await prisma.funcionario.createMany({ data: dadosParaInserir });
    }

    // 3) Atualizar funcionários cujo status mudou de "ADMISSÃO PROX.MÊS" para "ATIVO"
    // e também atualizar status se mudou na API (exceto casos já tratados acima)
    const paraAtualizar: any[] = [];

    dadosBanco.forEach((func) => {
      const dadosApi = mapApi.get(func.matricula);
      if (!dadosApi) return;

      const statusApi = dadosApi.STATUS;
      const statusBanco = func.status;

      // Se status é diferente e não é "DEMITIDO" (que já tratamos)
      if (statusBanco !== statusApi && statusApi !== 'DEMITIDO') {
        // Se mudou de ADMISSÃO PROX.MÊS para ATIVO, atualizar atualizadoEm
        if (statusBanco === 'ADMISSÃO PROX.MÊS' && statusApi === 'ATIVO') {
          paraAtualizar.push({
            matricula: func.matricula,
            status: 'ATIVO',
            atualizadoEm: now,
            excluidoEm: null,
          });
        } else {
          // Qualquer outra mudança de status que não demitido, só atualiza status e atualizadoEm
          paraAtualizar.push({
            matricula: func.matricula,
            status: statusApi,
            atualizadoEm: now,
            excluidoEm: null,
          });
        }
      }
    });

    // Atualizar os registros
    for (const f of paraAtualizar) {
      await prisma.funcionario.update({
        where: { matricula: f.matricula },
        data: {
          status: f.status,
          atualizadoEm: f.atualizadoEm,
          excluidoEm: f.excluidoEm,
        },
      });
    }

    console.log(`Sincronização concluída: ${matriculasParaDemitir.length} demitidos, ${novosFuncionarios.length} adicionados, ${paraAtualizar.length} atualizados`);
    
    return NextResponse.json({
      message: 'Sincronização concluída',
      demitidos: matriculasParaDemitir.length,
      adicionados: novosFuncionarios.length,
      atualizados: paraAtualizar.length,
    });
  } catch (error) {
    console.error('Erro na sincronização:', error);
    
    // Retornar erro mais específico
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    const isTimeoutError = errorMessage.includes('AbortError') || errorMessage.includes('timeout');
    const isNetworkError = errorMessage.includes('fetch') || errorMessage.includes('network');
    
    let userMessage = 'Erro interno na sincronização.';
    if (isTimeoutError) {
      userMessage = 'Timeout na sincronização. A API externa demorou muito para responder.';
    } else if (isNetworkError) {
      userMessage = 'Erro de conexão com a API externa.';
    }
    
    return NextResponse.json({ 
      error: userMessage,
      details: errorMessage 
    }, { status: 500 });
  }
}