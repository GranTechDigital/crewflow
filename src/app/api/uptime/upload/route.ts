import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getUserFromRequest } from "@/utils/authUtils";

// Evitar múltiplas instâncias do Prisma no ambiente de desenvolvimento do Next.js
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/** ---------- Helpers ---------- **/

// aceita string única ou array de chaves (usa a primeira que existir)
const getCampo = (row: any, keys: string | string[]): any => {
  const arr = Array.isArray(keys) ? keys : [keys];
  for (const k of arr) {
    const v = row?.[k];
    if (v !== undefined && v !== null && v !== "") {
      if (typeof v === "string") {
        const t = v.trim();
        if (t !== "") return t;
      } else {
        return v;
      }
    }
  }
  return null;
};

// Função para calcular diferença em dias
const diffDias = (data1: Date, data2: Date): number => {
  // Criar novas datas apenas com ano, mês e dia (zerando horas)
  const date1 = new Date(data1.getFullYear(), data1.getMonth(), data1.getDate());
  const date2 = new Date(data2.getFullYear(), data2.getMonth(), data2.getDate());
  
  const msPorDia = 1000 * 60 * 60 * 24;
  return Math.floor((date2.getTime() - date1.getTime()) / msPorDia);
};

// Função para calcular total de dias no período (baseada na fórmula Excel)
const calcularTotalDiasPeriodo = (
  dataInicio: Date | null,
  dataFim: Date | null,
  periodoInicial: Date | null,
  periodoFinal: Date | null
): number | null => {
  if (!dataInicio || !dataFim || !periodoInicial || !periodoFinal) {
    return null;
  }

  // Normalizar todas as datas para ignorar horas
  const S = new Date(dataInicio.getFullYear(), dataInicio.getMonth(), dataInicio.getDate()); // Início do funcionário
  const T = new Date(dataFim.getFullYear(), dataFim.getMonth(), dataFim.getDate());    // Fim do funcionário
  const Q = new Date(periodoInicial.getFullYear(), periodoInicial.getMonth(), periodoInicial.getDate()); // Período inicial
  const R = new Date(periodoFinal.getFullYear(), periodoFinal.getMonth(), periodoFinal.getDate());   // Período final

  if (S >= Q && T <= R) {
    // S >= Q E T <= R
    return diffDias(S, T) + 1;
  } else if (S < Q && T <= R) {
    // S < Q E T <= R
    return diffDias(Q, T) + 1;
  } else if (S > Q && T > R) {
    // S > Q E T > R
    return diffDias(S, R) + 1;
  } else if (S < Q && T > R) {
    // S < Q E T > R
    return diffDias(Q, R) + 1;
  } else if (S.getTime() === Q.getTime() && T > R) {
    // S = Q E T > R
    return diffDias(Q, R) + 1;
  } else {
    return null; // "Falso"
  }
};

// Função para validar se as datas do período são iguais (relatório diário)
const validarPeriodoIguais = (periodoInicial: Date, periodoFinal: Date): boolean => {
  // Normalizar datas para ignorar horas
  const data1 = new Date(periodoInicial.getFullYear(), periodoInicial.getMonth(), periodoInicial.getDate());
  const data2 = new Date(periodoFinal.getFullYear(), periodoFinal.getMonth(), periodoFinal.getDate());
  return data1.getTime() === data2.getTime();
};

// Função para verificar se o relatório é mais recente que o último upload
const verificarRelatorioMaisRecente = async (dataRelatorio: Date): Promise<{ podeUpload: boolean; ultimaData?: Date; mensagem?: string }> => {
  try {
    // Buscar o último upload com data de relatório
    const ultimoUpload = await prisma.uptimeUpload.findFirst({
      where: {
        dataRelatorio: {
          not: null
        }
      },
      orderBy: {
        dataRelatorio: 'desc'
      },
      select: {
        dataRelatorio: true,
        nomeArquivo: true,
        dataUpload: true
      }
    });

    if (!ultimoUpload || !ultimoUpload.dataRelatorio) {
      // Primeiro upload ou nenhum upload anterior com data de relatório
      return { podeUpload: true };
    }

    const ultimaDataRelatorio = ultimoUpload.dataRelatorio;
    
    // Normalizar datas para ignorar horas
    const dataRelatorioNorm = new Date(dataRelatorio.getFullYear(), dataRelatorio.getMonth(), dataRelatorio.getDate());
    const ultimaDataNorm = new Date(ultimaDataRelatorio.getFullYear(), ultimaDataRelatorio.getMonth(), ultimaDataRelatorio.getDate());
    
    if (dataRelatorioNorm.getTime() > ultimaDataNorm.getTime()) {
      // Relatório mais recente - pode fazer upload
      return { podeUpload: true, ultimaData: ultimaDataRelatorio };
    } else if (dataRelatorioNorm.getTime() === ultimaDataNorm.getTime()) {
      // Mesma data - não pode fazer upload
      return {
        podeUpload: false,
        ultimaData: ultimaDataRelatorio,
        mensagem: `Já existe um relatório para esta data (${dataRelatorio.toLocaleDateString('pt-BR')}). O relatório anterior com a mesma data foi enviado em ${ultimoUpload.dataUpload.toLocaleDateString('pt-BR')} às ${ultimoUpload.dataUpload.toLocaleTimeString('pt-BR')}.`
      };
    } else {
      // Relatório mais antigo - não pode fazer upload
      return {
        podeUpload: false,
        ultimaData: ultimaDataRelatorio,
        mensagem: `O relatório que você está tentando enviar (${dataRelatorio.toLocaleDateString('pt-BR')}) é mais antigo que o último relatório no servidor (${ultimaDataRelatorio.toLocaleDateString('pt-BR')}). Por favor, verifique se você está enviando o arquivo correto.`
      };
    }
  } catch (error) {
    console.error('Erro ao verificar último upload:', error);
    // Em caso de erro, permitir o upload para não bloquear o sistema
    return { podeUpload: true };
  }
};

// Função para extrair período da célula A1 da planilha
const extrairPeriodoDaCelulaA1 = (worksheet: any): { periodoInicial: Date; periodoFinal: Date; periodosIguais: boolean } | null => {
  try {
    // Tentar ler a célula A1
    const celulaA1 = worksheet['A1'];
    if (!celulaA1 || !celulaA1.v) {
      console.log('Célula A1 não encontrada ou vazia');
      return null;
    }

    const valorA1 = celulaA1.v.toString();
    console.log(`Valor da célula A1: "${valorA1}"`);

    // Padrão esperado: "01/Sep/2025 to 18/Sep/2025"
    const regex = /(\d{1,2})\/(\w{3})\/(\d{4})\s+to\s+(\d{1,2})\/(\w{3})\/(\d{4})/i;
    const match = valorA1.match(regex);

    if (!match) {
      console.log('Formato de período não reconhecido na célula A1');
      console.log('Formato esperado: "01/Sep/2025 to 18/Sep/2025"');
      return null;
    }

    const [, diaInicial, mesInicial, anoInicial, diaFinal, mesFinal, anoFinal] = match;

    // Mapear nomes de meses para números
    const meses: { [key: string]: number } = {
      'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
      'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
    };

    const mesInicialNum = meses[mesInicial.toLowerCase()];
    const mesFinalNum = meses[mesFinal.toLowerCase()];

    if (mesInicialNum === undefined || mesFinalNum === undefined) {
      console.log('Mês não reconhecido no período');
      return null;
    }

    const periodoInicial = new Date(parseInt(anoInicial), mesInicialNum, parseInt(diaInicial));
    const periodoFinal = new Date(parseInt(anoFinal), mesFinalNum, parseInt(diaFinal));

    // Verificar se as datas são iguais
    const periodosIguais = validarPeriodoIguais(periodoInicial, periodoFinal);

    console.log(`Período extraído:`);
    console.log(`Inicial: ${periodoInicial.toLocaleDateString('pt-BR')}`);
    console.log(`Final: ${periodoFinal.toLocaleDateString('pt-BR')}`);
    console.log(`Períodos são iguais: ${periodosIguais ? 'SIM' : 'NÃO'}`);

    return { periodoInicial, periodoFinal, periodosIguais };
  } catch (error) {
    console.error('Erro ao extrair período da célula A1:', error);
    return null;
  }
};

// converte serial do Excel (base 1900) em Date
const fromExcelSerial = (serial: number): Date => {
  // Excel armazena datas como número de dias desde 1900-01-01
  // Mas há um bug histórico: Excel considera 1900 como ano bissexto (não é)
  const excelEpoch = new Date(1900, 0, 1); // 1 de janeiro de 1900
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  
  // Ajustar para o bug do Excel (considera 1900 como bissexto)
  const adjustedSerial = serial > 59 ? serial - 1 : serial;
  
  // Calcular a data diretamente sem conversão UTC
  const targetDate = new Date(excelEpoch.getTime() + (adjustedSerial - 1) * millisecondsPerDay);
  
  // Retornar uma nova data com apenas ano, mês e dia (sem horas)
  return new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
};

// parse seguro de data: aceita Date, número (serial Excel), ISO, dd/mm/yyyy, dd-mm-yyyy
const parseDate = (value: any): Date | null => {
  if (value === null || value === undefined || value === "") return null;

  // já é Date
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  // número -> serial Excel
  if (typeof value === "number") {
    const d = fromExcelSerial(value);
    return isNaN(d.getTime()) ? null : d;
  }

  // string
  if (typeof value === "string") {
    const s = value.trim();
    if (!s) return null;

    // dd/mm/yyyy ou dd-mm-yyyy (aceita 2 ou 4 dígitos de ano)
    const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2}|\d{4})$/);
    if (m) {
      let [, ddStr, mmStr, yyStr] = m;
      const dd = parseInt(ddStr, 10);
      const mm = parseInt(mmStr, 10) - 1; // 0-based
      let yyyy = parseInt(yyStr, 10);
      if (yyStr.length === 2) yyyy += yyyy >= 70 ? 1900 : 2000; // heurística
      const d = new Date(yyyy, mm, dd);
      return isNaN(d.getTime()) ? null : d;
    }

    // ISO (2024-01-10...)
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      const d = new Date(s);
      return isNaN(d.getTime()) ? null : d;
    }

    // fallback
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
};

const getData = (row: any, keys: string | string[]): Date | null => {
  return parseDate(getCampo(row, keys));
};

const getNumero = (row: any, keys: string | string[]): number | null => {
  const v = getCampo(row, keys);
  if (v === null) return null;
  if (typeof v === "number") return Math.trunc(v);
  if (typeof v === "string") {
    const cleaned = v.replace(/[^\d\-]/g, "");
    const n = parseInt(cleaned, 10);
    return Number.isNaN(n) ? null : n;
  }
  return null;
};

/** ---------- Handler ---------- **/

export async function POST(request: NextRequest) {
  try {
    const usuario = await getUserFromRequest(request);
    if (!usuario) {
      return NextResponse.json(
        { message: "Você precisa estar logado para realizar esta ação" },
        { status: 401 }
      );
    }

    const { funcionarios, dataUpload, nomeArquivo, worksheet } = await request.json();

    if (!Array.isArray(funcionarios) || funcionarios.length === 0) {
      return NextResponse.json(
        { message: "Nenhum dado de funcionário encontrado no arquivo" },
        { status: 400 }
      );
    }

    // Extrair período da célula A1
    let periodoInfo = null;
    let dataRelatorio = null;
    
    if (worksheet) {
      periodoInfo = extrairPeriodoDaCelulaA1(worksheet);
      if (!periodoInfo) {
        console.log("Aviso: Não foi possível extrair período da célula A1. Continuando sem período...");
      } else {
        // Se as datas são iguais, é um relatório diário (correto)
        if (periodoInfo.periodosIguais) {
          dataRelatorio = periodoInfo.periodoInicial;
          console.log(`✅ Relatório diário detectado - Data: ${dataRelatorio.toLocaleDateString('pt-BR')}`);
          
          // Verificar se este relatório é mais recente que o último upload
          const validacaoRecente = await verificarRelatorioMaisRecente(dataRelatorio);
          
          if (!validacaoRecente.podeUpload) {
            return NextResponse.json(
              { 
                message: validacaoRecente.mensagem,
                detalhes: {
                  dataInicial: periodoInfo.periodoInicial.toLocaleDateString('pt-BR'),
                  dataFinal: periodoInfo.periodoFinal.toLocaleDateString('pt-BR'),
                  dataRelatorio: dataRelatorio.toLocaleDateString('pt-BR'),
                  ultimaDataServidor: validacaoRecente.ultimaData?.toLocaleDateString('pt-BR'),
                  valorA1: worksheet['A1']?.v?.toString() || 'Não encontrado'
                }
              },
              { status: 400 }
            );
          }
          
          if (validacaoRecente.ultimaData) {
            console.log(`✅ Relatório mais recente que o anterior (${validacaoRecente.ultimaData.toLocaleDateString('pt-BR')})`);
          } else {
            console.log(`✅ Primeiro relatório com data extraída`);
          }
        } else {
          // Datas diferentes - relatório de período (BLOQUEADO)
          console.log(`❌ Relatório de período detectado (não permitido):`);
          console.log(`   Início: ${periodoInfo.periodoInicial.toLocaleDateString('pt-BR')}`);
          console.log(`   Fim: ${periodoInfo.periodoFinal.toLocaleDateString('pt-BR')}`);
          
          return NextResponse.json(
            { 
              message: "Relatórios de período não são permitidos nesta funcionalidade",
              detalhes: {
                dataInicial: periodoInfo.periodoInicial.toLocaleDateString('pt-BR'),
                dataFinal: periodoInfo.periodoFinal.toLocaleDateString('pt-BR'),
                valorA1: worksheet['A1']?.v?.toString() || 'Não encontrado',
                tipoRelatorio: 'Período (datas diferentes)',
                motivoBloqueio: 'Esta funcionalidade aceita apenas relatórios diários (mesma data de início e fim). Relatórios de período serão utilizados em outra funcionalidade.'
              }
            },
            { status: 400 }
          );
        }
      }
    }

    // Buscar todas as matrículas válidas no banco
    const funcionariosDb = await prisma.funcionario.findMany({
      select: { matricula: true },
    });
    const matriculasValidas = new Set(
      funcionariosDb.map((f) => f.matricula.toString().trim())
    );

    let importados = 0;
    let naoEncontrados = 0;

    await prisma.$transaction(async (tx) => {
      // Limpa a staging de Uptime antes de inserir o novo arquivo
      await tx.uptimeSheet.deleteMany({});

      const aInserir: any[] = [];

      for (const row of funcionarios) {
        // Matrícula (usa exatamente a coluna "Matrícula")
        const matValue = getCampo(row, "Matrícula");
        const matricula = matValue ? matValue.toString().trim() : null;

        if (!matricula || !matriculasValidas.has(matricula)) {
          naoEncontrados++;
          continue;
        }

        // Datas conforme cabeçalho
        const dataInicio = getData(row, "Início");
        const dataFim = getData(row, "Fim");
        const dataAdmissao = getData(row, "Admissão");
        const dataDemissao = getData(row, "Demissão");

        // Calcular totalDiasPeriodo automaticamente se temos período
        let totalDiasPeriodoCalculado = null;
        if (periodoInfo && dataInicio && dataFim) {
          totalDiasPeriodoCalculado = calcularTotalDiasPeriodo(
            dataInicio,
            dataFim,
            periodoInfo.periodoInicial,
            periodoInfo.periodoFinal
          );
        }

        aInserir.push({
          matricula,
          nome: getCampo(row, "Nome") ?? null,
          funcao: getCampo(row, "Função") ?? null,
          status: getCampo(row, "Status") ?? null,
          // Preferir "Embarcação Atual"; se vazio, usar "Embarcação"
          embarcacao: getCampo(row, ["Embarcação Atual", "Embarcação"]) ?? null,
          observacoes: getCampo(row, "Observações") ?? null,
          sispat: getCampo(row, "SISPAT") ?? null,
          // Caso seu schema tenha "departamento", deixe aqui; caso não exista, remova esta linha
          departamento: null,
          centroCusto: getCampo(row, "Centro de Custo") ?? null,

          dataInicio,
          dataFim,
          dataAdmissao,
          dataDemissao,
          totalDias: getNumero(row, "Total Dias"),
          // Usar o valor calculado automaticamente ou fallback para o valor da planilha
          totalDiasPeriodo: totalDiasPeriodoCalculado ?? getNumero(row, "Total Dias no período"),
          
          // Adicionar as colunas de período se disponíveis
          periodoInicial: periodoInfo?.periodoInicial ?? null,
          periodoFinal: periodoInfo?.periodoFinal ?? null,
        });

        importados++;
      }

      if (aInserir.length > 0) {
        // Inserção em lote — mais rápido e consistente
        await tx.uptimeSheet.createMany({ data: aInserir });
      }

      // Registrar o upload
      await tx.uptimeUpload.create({
        data: {
          dataUpload: parseDate(dataUpload),
          dataRelatorio: dataRelatorio, // Data real do relatório extraída da célula A1
          nomeArquivo: nomeArquivo || "Uptime.xlsx",
          registros: funcionarios.length,
          atualizados: importados,
          naoEncontrados,
          uploadPor: usuario.funcionario.nome || "Sistema",
          funcionarioId: usuario.funcionarioId,
        },
      });

      // Registrar histórico
      await tx.historicoRemanejamento.create({
        data: {
          tipoAcao: "UPLOAD_UPTIME",
          entidade: "UptimeSheet",
          descricaoAcao: `Upload de arquivo Uptime com ${funcionarios.length} registros`,
          usuarioResponsavel: usuario.funcionario.nome || "Sistema",
          dataAcao: parseDate(dataUpload),
          observacoes: `Importados: ${importados}, Não encontrados: ${naoEncontrados}`,
        },
      });
    });

    return NextResponse.json({
      message: "Arquivo processado com sucesso",
      importados,
      naoEncontrados,
      total: funcionarios.length,
    });
  } catch (error: any) {
    console.error("Erro ao processar upload de Uptime:", error);
    return NextResponse.json(
      { message: `Erro ao processar o arquivo: ${error.message}` },
      { status: 500 }
    );
  }
}
