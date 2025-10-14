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
    console.log('Iniciando sincronização de funcionários...');
    
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
    const mapApi = new Map<string, Record<string, unknown>>();
    dadosExternos.forEach((item: Record<string, unknown>) => mapApi.set(String(item.MATRICULA), item));

    const mapBanco = new Map<string, { matricula: string; status: string | null }>();
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
    const novosFuncionarios = dadosExternos.filter((item: Record<string, unknown>) => !mapBanco.has(String(item.MATRICULA)));

    if (novosFuncionarios.length > 0) {
      const dadosParaInserir = novosFuncionarios.map((item: Record<string, unknown>) => ({
        matricula: String(item.MATRICULA),
        cpf: item.CPF ? String(item.CPF) : null,
        nome: String(item.NOME),
        funcao: item.FUNCAO ? String(item.FUNCAO) : null,
        rg: item.RG ? String(item.RG) : null,
        orgaoEmissor: item['ORGÃO_EMISSOR'] ? String(item['ORGÃO_EMISSOR']) : null,
        uf: item.UF ? String(item.UF) : null,
        dataNascimento: item.DATA_NASCIMENTO ? parseDate(String(item.DATA_NASCIMENTO)) : null,
        email: item.EMAIL ? String(item.EMAIL) : null,
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
    const paraAtualizar: Array<{
      matricula: string;
      status: string;
      statusPrestserv?: string;
      atualizadoEm: Date;
      excluidoEm?: Date | null;
    }> = [];

    dadosBanco.forEach((func) => {
      const dadosApi = mapApi.get(func.matricula);
      if (!dadosApi) return;

      const statusApi = String(dadosApi.STATUS);
      const statusBanco = func.status;

      // Verificar se o funcionário precisa ter o statusPrestserv atualizado para SEM_CADASTRO
      if (func.statusPrestserv === null || func.statusPrestserv === undefined) {
        paraAtualizar.push({
          matricula: func.matricula,
          status: func.status, // Mantém o status atual
          statusPrestserv: 'SEM_CADASTRO', // Define o statusPrestserv como SEM_CADASTRO
          atualizadoEm: now,
          excluidoEm: null,
        });
        return; // Continua para o próximo funcionário
      }

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
          statusPrestserv: f.statusPrestserv, // Incluir statusPrestserv se estiver definido
          atualizadoEm: f.atualizadoEm,
          excluidoEm: f.excluidoEm,
        },
      });
    }

    console.log(`Sincronização de funcionários concluída: ${matriculasParaDemitir.length} demitidos, ${novosFuncionarios.length} adicionados, ${paraAtualizar.length} atualizados`);
    
    return NextResponse.json({
      message: 'Sincronização concluída',
      demitidos: matriculasParaDemitir.length,
      adicionados: novosFuncionarios.length,
      atualizados: paraAtualizar.length,
    });
  } catch (error) {
    console.error('Erro na sincronização de funcionários:', error);
    
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