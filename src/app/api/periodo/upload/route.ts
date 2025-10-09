import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getUserFromRequest } from "@/utils/authUtils";
import { read, utils, WorkSheet } from "xlsx";
import {
  initProgress,
  updateProgress,
  completeProgress,
  errorProgress,
} from "./progressManager";

// Type definitions
interface ExcelRowData {
  [key: string]: string | number | Date | null | undefined;
}

interface UltimoUpload {
  id: number;
  dataUpload: Date;
  dataRelatorio: Date | null;
  nomeArquivo: string | null;
  periodoInicial: Date;
  periodoFinal: Date;
  totalDiasPeriodo: number;
  uploadPor: string;
}

interface DadoExtraido {
  rowObj: ExcelRowData;
  matricula?: string;
  sispat?: string;
  index: number;
}

interface PeriodoSheetData {
  matricula: string;
  dataAdmissao: Date | null;
  dataDemissao: Date | null;
  dataInicio: Date | null;
  dataFim: Date | null;
  periodoInicial: Date;
  periodoFinal: Date;
  totalDias: number | null;
  totalDiasPeriodo: number | null;
  nome: string | null;
  funcao: string | null;
  embarcacao: string | null;
  statusFolha: string | null;
  codigo: string | null;
  observacoes: string | null;
  embarcacaoAtual: string | null;
  sispat: string | null;
  departamento: string | null;
  regimeTrabalho: string | null;
  regimeTratado: string | null;
  statusId: number;
  projetoId: number;
  mesReferencia: number;
  anoReferencia: number;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/* -------------------------
   Helpers (mantive e otimizei)
   ------------------------- */

const getCampo = (row: ExcelRowData, keys: string | string[]): string | number | Date | null => {
  const keyArray = Array.isArray(keys) ? keys : [keys];
  for (const key of keyArray) {
    if (
      Object.prototype.hasOwnProperty.call(row, key) &&
      row[key] !== undefined &&
      row[key] !== null &&
      row[key] !== ""
    ) {
      return row[key];
    }
  }
  return null;
};

const diffDias = (data1: Date, data2: Date): number => {
  const date1 = new Date(
    data1.getFullYear(),
    data1.getMonth(),
    data1.getDate()
  );
  const date2 = new Date(
    data2.getFullYear(),
    data2.getMonth(),
    data2.getDate()
  );
  return Math.ceil((date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24));
};

const calcularTotalDiasPeriodo = (
  dataInicio: Date | null,
  dataFim: Date | null,
  periodoInicial: Date | null,
  periodoFinal: Date | null
): number | null => {
  if (!dataInicio || !dataFim || !periodoInicial || !periodoFinal) {
    return null;
  }
  const dataInicioNorm = new Date(
    dataInicio.getFullYear(),
    dataInicio.getMonth(),
    dataInicio.getDate()
  );
  const dataFimNorm = new Date(
    dataFim.getFullYear(),
    dataFim.getMonth(),
    dataFim.getDate()
  );
  const periodoInicialNorm = new Date(
    periodoInicial.getFullYear(),
    periodoInicial.getMonth(),
    periodoInicial.getDate()
  );
  const periodoFinalNorm = new Date(
    periodoFinal.getFullYear(),
    periodoFinal.getMonth(),
    periodoFinal.getDate()
  );

  const inicioEfetivo =
    dataInicioNorm > periodoInicialNorm ? dataInicioNorm : periodoInicialNorm;
  const fimEfetivo =
    dataFimNorm < periodoFinalNorm ? dataFimNorm : periodoFinalNorm;

  if (inicioEfetivo > fimEfetivo) return 0;
  return diffDias(inicioEfetivo, fimEfetivo) + 1;
};

const validarPeriodo = (
  periodoInicial: Date,
  periodoFinal: Date
): { valido: boolean; erro?: string } => {
  if (periodoInicial.getDate() !== 1) {
    return {
      valido: false,
      erro: `A data inicial deve ser sempre dia 1º do mês. Data recebida: ${periodoInicial.toLocaleDateString(
        "pt-BR"
      )}`,
    };
  }
  if (
    periodoInicial.getMonth() !== periodoFinal.getMonth() ||
    periodoInicial.getFullYear() !== periodoFinal.getFullYear()
  ) {
    return {
      valido: false,
      erro: `O período deve ser sempre no mesmo mês. Período recebido: ${periodoInicial.toLocaleDateString(
        "pt-BR"
      )} a ${periodoFinal.toLocaleDateString("pt-BR")}`,
    };
  }
  const totalDias = diffDias(periodoInicial, periodoFinal) + 1;
  if (totalDias < 7) {
    return {
      valido: false,
      erro: `O período deve ter pelo menos 7 dias. Período atual tem ${totalDias} dias.`,
    };
  }
  return { valido: true };
};

const verificarRelatorioMesExistente = async (
  mesReferencia: number,
  anoReferencia: number
): Promise<{ podeUpload: boolean; ultimoUpload?: UltimoUpload; mensagem?: string }> => {
  try {
    const ultimoUpload = await prisma.periodoUpload.findFirst({
      where: { mesReferencia, anoReferencia },
      orderBy: { dataUpload: "desc" },
      select: {
        id: true,
        dataUpload: true,
        dataRelatorio: true,
        nomeArquivo: true,
        periodoInicial: true,
        periodoFinal: true,
        totalDiasPeriodo: true,
        uploadPor: true,
      },
    });

    if (ultimoUpload) {
      return {
        podeUpload: true,
        ultimoUpload,
        mensagem: `Será substituído o relatório anterior de ${ultimoUpload.periodoInicial.toLocaleDateString(
          "pt-BR"
        )} a ${ultimoUpload.periodoFinal.toLocaleDateString("pt-BR")} (${
          ultimoUpload.totalDiasPeriodo
        } dias), enviado em ${ultimoUpload.dataUpload.toLocaleDateString(
          "pt-BR"
        )} às ${ultimoUpload.dataUpload.toLocaleTimeString("pt-BR")} por ${
          ultimoUpload.uploadPor
        }.`,
      };
    }
    return { podeUpload: true };
  } catch (error) {
    console.error("Erro ao verificar relatório do mês:", error);
    return { podeUpload: true };
  }
};

const extrairPeriodoDaCelulaA1 = (
  worksheet: WorkSheet
): {
  periodoInicial: Date;
  periodoFinal: Date;
  mesReferencia: number;
  anoReferencia: number;
} | null => {
  try {
    const celulaA1 = worksheet["A1"];
    if (!celulaA1 || !celulaA1.v) {
      return null;
    }
    const valorA1 = celulaA1.v.toString();
    // Padrão: "01/Sep/2025 to 15/Sep/2025"
    const regex =
      /(\d{1,2})\/(\w{3})\/(\d{4})\s+to\s+(\d{1,2})\/(\w{3})\/(\d{4})/i;
    const match = valorA1.match(regex);
    if (!match) {
      return null;
    }
    const [, diaInicial, mesInicial, anoInicial, diaFinal, mesFinal, anoFinal] =
      match;
    const meses: { [key: string]: number } = {
      jan: 0,
      feb: 1,
      mar: 2,
      apr: 3,
      may: 4,
      jun: 5,
      jul: 6,
      aug: 7,
      sep: 8,
      oct: 9,
      nov: 10,
      dec: 11,
    };
    const mesInicialNum = meses[mesInicial.toLowerCase()];
    const mesFinalNum = meses[mesFinal.toLowerCase()];
    if (mesInicialNum === undefined || mesFinalNum === undefined) {
      return null;
    }
    const periodoInicial = new Date(
      parseInt(anoInicial),
      mesInicialNum,
      parseInt(diaInicial)
    );
    const periodoFinal = new Date(
      parseInt(anoFinal),
      mesFinalNum,
      parseInt(diaFinal)
    );
    const mesReferencia = periodoInicial.getMonth() + 1;
    const anoReferencia = periodoInicial.getFullYear();
    return { periodoInicial, periodoFinal, mesReferencia, anoReferencia };
  } catch (error) {
    console.error("Erro ao extrair período da célula A1:", error);
    return null;
  }
};

const fromExcelSerial = (serial: number): Date => {
  const excelEpoch = new Date(1900, 0, 1);
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  const adjustedSerial = serial > 59 ? serial - 1 : serial;
  const targetDate = new Date(
    excelEpoch.getTime() + (adjustedSerial - 1) * millisecondsPerDay
  );
  return new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate()
  );
};

const parseDate = (value: string | number | Date | null | undefined): Date | null => {
  if (!value && value !== 0) return null;
  if (typeof value === "number") return fromExcelSerial(value);
  if (typeof value === "string") {
    const trimmedValue = value.trim();
    if (
      trimmedValue === "" ||
      trimmedValue === "-" ||
      trimmedValue.toUpperCase() === "N/A"
    )
      return null;
    const formats = [
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
      /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
      /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
    ];
    for (const format of formats) {
      const match = trimmedValue.match(format);
      if (match) {
        let day: string, month: string, year: string;
        if (format === formats[1]) {
          [, year, month, day] = match;
        } else {
          [, day, month, year] = match;
        }
        const date = new Date(
          parseInt(year),
          parseInt(month) - 1,
          parseInt(day)
        );
        if (!isNaN(date.getTime())) return date;
      }
    }
    const parsedDate = new Date(trimmedValue);
    if (!isNaN(parsedDate.getTime())) return parsedDate;
  }
  if (value instanceof Date && !isNaN(value.getTime())) return value;
  return null;
};

const getData = (row: ExcelRowData, keys: string | string[]): Date | null =>
  parseDate(getCampo(row, keys));

const getNumero = (row: ExcelRowData, keys: string | string[]): number | null => {
  const valor = getCampo(row, keys);
  if (valor === null || valor === undefined || valor === "" || valor === "-")
    return null;
  const numero =
    typeof valor === "number"
      ? valor
      : parseFloat(valor.toString().replace(",", "."));
  return isNaN(numero) ? null : numero;
};

const processarCodigoCentroCustoSync = (
  codigo: string | null | undefined
): string | null => {
  if (!codigo) return null;
  const codigoStr = codigo.toString().trim();
  if (
    codigoStr.length > 3 &&
    codigoStr.charAt(2) === "5" &&
    codigoStr.charAt(3) === "."
  ) {
    return codigoStr.substring(4);
  }
  // Também remover prefixo '005.' se existir (variante)
  if (codigoStr.startsWith("005.")) return codigoStr.substring(4);
  return codigoStr;
};

/* -------------------------
   POST handler (otimizado)
   ------------------------- */

export async function POST(request: NextRequest) {
  let uploadId: string | undefined;
  try {

    const formData = await request.formData();
    const file = formData.get("file") as File;
    uploadId = formData.get("uploadId") as string | undefined;

    if (!file) {
      return NextResponse.json(
        { message: "Nenhum arquivo enviado" },
        { status: 400 }
      );
    }
    if (!uploadId) {
      return NextResponse.json(
        { message: "ID de upload não fornecido" },
        { status: 400 }
      );
    }

    updateProgress(uploadId, {
      stage: "auth",
      message: "Verificando autenticação...",
    });
    const user = await getUserFromRequest(request);
    if (!user) {
      errorProgress(uploadId, "Usuário não autenticado");
      return NextResponse.json(
        { message: "Usuário não autenticado" },
        { status: 401 }
      );
    }

    updateProgress(uploadId, {
      stage: "file",
      message: "Processando arquivo...",
    });

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Extrair período da célula A1
    const periodoInfo = extrairPeriodoDaCelulaA1(worksheet);
    if (!periodoInfo) {
      return NextResponse.json(
        {
          message: "Não foi possível extrair o período da célula A1",
          detalhes: {
            valorA1: worksheet["A1"]?.v?.toString() || "Não encontrado",
            formatoEsperado: "01/Sep/2025 to 15/Sep/2025",
          },
        },
        { status: 400 }
      );
    }

    const { periodoInicial, periodoFinal, mesReferencia, anoReferencia } =
      periodoInfo;

    // Validar período
    const validacao = validarPeriodo(periodoInicial, periodoFinal);
    if (!validacao.valido) {
      return NextResponse.json(
        {
          message: validacao.erro,
          detalhes: {
            dataInicial: periodoInicial.toLocaleDateString("pt-BR"),
            dataFinal: periodoFinal.toLocaleDateString("pt-BR"),
            totalDias: diffDias(periodoInicial, periodoFinal) + 1,
            valorA1: worksheet["A1"]?.v?.toString() || "Não encontrado",
          },
        },
        { status: 400 }
      );
    }

    const totalDiasPeriodo = diffDias(periodoInicial, periodoFinal) + 1;

    const verificacaoMes = await verificarRelatorioMesExistente(
      mesReferencia,
      anoReferencia
    );

    // Converter worksheet para JSON (mantendo estrutura header:1 para respeitar A1 e header na linha 2)
    const jsonData: (string | number | Date | null)[][] = utils.sheet_to_json(worksheet, {
      header: 1,
      defval: null,
    });
    const headers = jsonData[1] as string[]; // linha 2
    const rows = jsonData.slice(2); // a partir da linha 3

    // Inicializar progresso
    initProgress(uploadId, rows.length);
    updateProgress(uploadId, {
      stage: "processing",
      message: `Processando ${rows.length} registros...`,
    });

    // Se existe relatório anterior, remover dados antigos
    if (verificacaoMes.ultimoUpload) {
  
      await prisma.periodoSheet.deleteMany({
        where: { mesReferencia, anoReferencia },
      });
     
      await prisma.periodoUpload.deleteMany({
        where: { mesReferencia, anoReferencia },
      });
    
    }

    // 1º PASSO: Extrair dados e coletar sets únicos (status, _sispat, matricula, centros de custo)
    const dadosExtraidos: DadoExtraido[] = [];
    const statusSet = new Set<string>();
    const centroCustoSet = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] as (string | number | Date | null)[];
      const rowObj = headers.reduce(
        (obj: ExcelRowData, header: string, index: number) => {
          obj[header] = row[index];
          return obj;
        },
        {} as ExcelRowData
      );

      const matricula = getCampo(rowObj, [
        "Matrícula",
        "MATRICULA",
        "Matricula",
        "matricula",
      ]);

      let sispat = null;
      if (!matricula) {
        sispat = getCampo(rowObj, ["SISPAT", "Sispat", "sispat"]);
        if (!sispat) {
          sispat = getCampo(rowObj, ["Código", "CODIGO", "Codigo", "codigo"]);
        }
      }

      const statusRaw = getCampo(rowObj, ["Status", "STATUS", "status"]);
      if (statusRaw) statusSet.add(statusRaw.toString().trim());

      // coletar possíveis códigos de centro de custo
      const codigoCC = getCampo(rowObj, [
        "Código do Centro de Custo",
        "CÓDIGO DO CENTRO DE CUSTO",
        "Centro de Custo",
        "CENTRO CUSTO",
        "centro_custo",
      ]);
      if (codigoCC)
        centroCustoSet.add(
          processarCodigoCentroCustoSync(codigoCC?.toString()) ||
            codigoCC.toString()
        );

      dadosExtraidos.push({
        rowObj,
        matricula: matricula?.toString(),
        sispat: sispat?.toString(),
        index: i,
      });
    }

    // 2º PASSO: Carregar dados auxiliares do banco (em massa)
    // Carregar todos os status (tabela pequena - aceitável) e montar cache case-insensitive
    const statusCache = new Map<string, number>();
    const todosStatus = await prisma.status.findMany({
      select: { id: true, categoria: true },
    });
    todosStatus.forEach((s) =>
      statusCache.set(s.categoria.toLowerCase(), s.id)
    );

    // Garantir que exista "NÃO ENCONTRADO" nos caches
    if (!statusCache.has("não encontrado")) {
      const naoEncontradoStatus = await prisma.status.upsert({
        where: { categoria: "NÃO ENCONTRADO" },
        update: {},
        create: {
          categoria: "NÃO ENCONTRADO",
          ativo: true,
        },
        select: { id: true, categoria: true },
      });
      statusCache.set(
        naoEncontradoStatus.categoria.toLowerCase(),
        naoEncontradoStatus.id
      );
    }

    // NÃO criar novos status automaticamente - usar apenas os status corretos e mapeamentos
    const missingStatuses = Array.from(statusSet).filter(
      (s) => !statusCache.has(s.toLowerCase())
    );
    if (missingStatuses.length > 0) {
      console.log(`⚠️  Status não mapeados encontrados (${missingStatuses.length}):`, missingStatuses);
      console.log(`💡 Estes status serão mapeados para "Não encontrado" automaticamente`);
      // NÃO criar novos status - deixar que sejam mapeados para "Não encontrado"
    }

    // Carregar projetos e centros de custo - MELHORADO
    const projetoCache = new Map<string, number>();
    const centroCustoProjetoCache = new Map<string, number>();
    const todosProjetos = await prisma.projeto.findMany({
      select: { id: true, nome: true },
    });
    todosProjetos.forEach((p) => projetoCache.set(p.nome.toLowerCase(), p.id));

    // Garantir "NÃO ENCONTRADO" em projetos
    if (!projetoCache.has("não encontrado")) {
      const naoProj = await prisma.projeto.upsert({
        where: { nome: "NÃO ENCONTRADO" },
        update: {},
        create: { nome: "NÃO ENCONTRADO", codigo: "NAO_ENCONTRADO", ativo: true },
        select: { id: true, nome: true },
      });
      projetoCache.set(naoProj.nome.toLowerCase(), naoProj.id);
    }

    // Carregar todos centros de custo e mapear para projetoId - MELHORADO
    const todosCentrosCusto = await prisma.centroCustoProjeto.findMany({
      select: {
        centroCusto: true,
        projeto: { select: { id: true, nome: true } },
      },
    });
    
    console.log(`📋 Carregando ${todosCentrosCusto.length} mapeamentos de centro de custo`);
    
    todosCentrosCusto.forEach((cc) => {
      const key = cc.centroCusto;
      if (key) {
        centroCustoProjetoCache.set(key, cc.projeto.id);
        
        // Mapear variações do centro de custo
        // 1. Com prefixo '005.'
        if (key.startsWith("005.")) {
          const semPrefix = key.substring(4);
          if (!centroCustoProjetoCache.has(semPrefix))
            centroCustoProjetoCache.set(semPrefix, cc.projeto.id);
        } else {
          // 2. Adicionar versão com prefixo se não tiver
          const comPrefix = `005.${key}`;
          if (!centroCustoProjetoCache.has(comPrefix))
            centroCustoProjetoCache.set(comPrefix, cc.projeto.id);
        }
        
        // 3. Versões normalizadas (sem pontos, espaços, etc.)
        const normalizado = key.replace(/[.\s-]/g, '');
        if (normalizado !== key && !centroCustoProjetoCache.has(normalizado))
          centroCustoProjetoCache.set(normalizado, cc.projeto.id);
        
        // garantir projetoCache tenha esse projeto
        if (!projetoCache.has(cc.projeto.nome.toLowerCase()))
          projetoCache.set(cc.projeto.nome.toLowerCase(), cc.projeto.id);
      }
    });

    // Verificar se há StatusMapping e usar para mapear status mais específicos
    const statusMappingCache = new Map<string, number>();
    try {
      const statusMappings = await prisma.statusMapping.findMany({
        where: { ativo: true },
        select: { statusGeral: true, statusId: true },
      });
      
      statusMappings.forEach((sm) => {
        statusMappingCache.set(sm.statusGeral.toLowerCase(), sm.statusId);
      });
      
      console.log(`📋 Carregando ${statusMappings.length} mapeamentos de status específicos`);
    } catch {
      console.log('⚠️  StatusMapping não disponível, usando apenas Status direto');
    }

    // 3º PASSO: Montar todos os registros em memória usando os caches (sem awaits dentro do loop)
    const registrosArray: PeriodoSheetData[] = [];
    let registrosProcessados = 0;
    let registrosAtualizados = 0;
    const registrosNaoEncontrados = 0;

    for (const dadoExtraido of dadosExtraidos) {
      const { rowObj, matricula: matriculaOriginal } = dadoExtraido;

      // Nota: PeriodoSheet não tem relacionamento direto com Funcionario
      // Apenas armazena a matricula como string

      registrosProcessados++;

      const dataAdmissao = getData(rowObj, [
        "Admissão",
        "DATA ADMISSÃO",
        "Data Admissão",
        "DATA_ADMISSAO",
      ]);
      const dataDemissao = getData(rowObj, [
        "Demissão",
        "DATA DEMISSÃO",
        "Data Demissão",
        "DATA_DEMISSAO",
      ]);
      const dataInicio = getData(rowObj, [
        "Início",
        "DATA INÍCIO",
        "Data Início",
        "DATA_INICIO",
      ]);
      const dataFim = getData(rowObj, [
        "Fim",
        "DATA FIM",
        "Data Fim",
        "DATA_FIM",
      ]);
      const totalDias = getNumero(rowObj, [
        "Total Dias",
        "TOTAL DIAS",
        "TOTAL_DIAS",
      ]);
      const totalDiasPeriodoCalculado = calcularTotalDiasPeriodo(
        dataInicio,
        dataFim,
        periodoInicial,
        periodoFinal
      );

      // statusId via cache (case-insensitive) - MELHORADO com StatusMapping
      const statusRaw = getCampo(rowObj, [
        "Status",
        "STATUS",
        "status",
      ])?.toString();
      
      let statusId: number;
      if (statusRaw) {
        const statusLower = statusRaw.toLowerCase();
        
        // 1. Primeiro tentar StatusMapping (mais específico)
        if (statusMappingCache.has(statusLower)) {
          statusId = statusMappingCache.get(statusLower)!;
        }
        // 2. Depois tentar Status direto
        else if (statusCache.has(statusLower)) {
          statusId = statusCache.get(statusLower)!;
        }
        // 3. Fallback para "não encontrado"
        else {
          statusId = statusCache.get("não encontrado")!;
        }
      } else {
        statusId = statusCache.get("não encontrado")!;
      }

      // projetoId via centro de custo (cache) - MELHORADO com múltiplas tentativas
      let codigoRaw = getCampo(rowObj, [
        "Código do Centro de Custo",
        "CÓDIGO DO CENTRO DE CUSTO",
        "Centro de Custo",
        "CENTRO CUSTO",
        "centro_custo",
      ]);
      if (!codigoRaw) {
        codigoRaw = getCampo(rowObj, [
          "Centro Custo",
          "CENTRO_CUSTO",
          "codigo_centro_custo",
        ]);
      }
      
      let projetoId: number = projetoCache.get("não encontrado")!; // Initialize with default value
      if (codigoRaw) {
        const codigoProcessado = processarCodigoCentroCustoSync(codigoRaw?.toString());
        const codigoOriginal = codigoRaw.toString().trim();
        
        // Tentar múltiplas variações do código
        const tentativas = [
          codigoProcessado,
          codigoOriginal,
          `005.${codigoProcessado}`,
          codigoProcessado?.replace(/[.\s-]/g, ''),
          codigoOriginal.replace(/[.\s-]/g, '')
        ].filter(Boolean);
        
        let encontrado = false;
        for (const tentativa of tentativas) {
          if (centroCustoProjetoCache.has(tentativa!)) {
            projetoId = centroCustoProjetoCache.get(tentativa!)!;
            encontrado = true;
            break;
          }
        }
        
        if (!encontrado) {
          projetoId = projetoCache.get("não encontrado")!;
        }
      } else {
        projetoId = projetoCache.get("não encontrado")!;
      }

      registrosArray.push({
        matricula: matriculaOriginal || "", // campo string
        dataAdmissao,
        dataDemissao,
        dataInicio,
        dataFim,
        periodoInicial,
        periodoFinal,
        totalDias,
        totalDiasPeriodo: totalDiasPeriodoCalculado,
        nome: getCampo(rowObj, ["Nome", "NOME", "nome"])?.toString() || "",
        funcao: getCampo(rowObj, [
          "Função",
          "FUNÇÃO",
          "FUNCAO",
          "funcao",
        ])?.toString() || "",
        statusId,
        embarcacao: getCampo(rowObj, [
          "Embarcação",
          "EMBARCAÇÃO",
          "EMBARCACAO",
          "embarcacao",
        ])?.toString() || "",
        statusFolha: getCampo(rowObj, [
          "Status Folha",
          "STATUS FOLHA",
          "status_folha",
          "STATUS_FOLHA",
        ])?.toString() || "",
        codigo: getCampo(rowObj, [
          "Código",
          "CÓDIGO",
          "CODIGO",
          "codigo",
        ])?.toString()  || "",
        observacoes: getCampo(rowObj, [
          "Observações",
          "OBSERVAÇÕES",
          "OBSERVACOES",
          "observacoes",
        ])?.toString() || "",
        embarcacaoAtual: getCampo(rowObj, [
          "Embarcação Atual",
          "EMBARCAÇÃO ATUAL",
          "EMBARCACAO ATUAL",
          "embarcacao_atual",
        ])?.toString() || "",
        sispat: getCampo(rowObj, ["SISPAT", "Sispat", "sispat"])?.toString() || "",
        departamento: null,
        regimeTrabalho: getCampo(rowObj, [
          "Regime de Trabalho",
          "REGIME DE TRABALHO",
          "Regime Trabalho",
          "REGIME TRABALHO",
        ])?.toString() || "",
        regimeTratado: (() => {
          const regime = getCampo(rowObj, [
            "Regime de Trabalho",
            "REGIME DE TRABALHO",
            "Regime Trabalho",
            "REGIME TRABALHO",
          ])?.toString();
          if (!regime) return null;
          return regime.toUpperCase().startsWith("OFFSHORE")
            ? "OFFSHORE"
            : "ONSHORE";
        })(),
        projetoId,
        mesReferencia,
        anoReferencia,
      });

      registrosAtualizados++;

      if (registrosProcessados % 100 === 0) {
        updateProgress(uploadId, {
          processed: registrosProcessados,
          message: `Processados ${registrosProcessados} de ${rows.length} registros...`,
        });
      }
    }

    // 4º PASSO: Inserir em chunks com createMany
    updateProgress(uploadId, {
      stage: "saving",
      message: "Salvando dados no banco...",
    });
    const chunkSize = 1000;
    for (let i = 0; i < registrosArray.length; i += chunkSize) {
      const chunk = registrosArray.slice(i, i + chunkSize);
      await prisma.periodoSheet.createMany({
        data: chunk,
      });
      const processed = Math.min(i + chunk.length, registrosArray.length);
      updateProgress(uploadId, {
        processed,
        message: `Salvando lote ${Math.floor(i / chunkSize) + 1} de ${Math.ceil(
          registrosArray.length / chunkSize
        )}...`,
      });
    }

    // 5º PASSO: Registrar o upload
    const periodoUpload = await prisma.periodoUpload.create({
      data: {
        dataRelatorio: periodoInicial,
        nomeArquivo: file.name,
        registros: registrosProcessados,
        atualizados: registrosAtualizados,
        naoEncontrados: registrosNaoEncontrados,
        uploadPor: user.funcionario?.nome || "Desconhecido",
        funcionarioId: user.funcionario?.id || user.id,
        mesReferencia,
        anoReferencia,
        periodoInicial,
        periodoFinal,
        totalDiasPeriodo,
      },
    });

    completeProgress(uploadId, "Upload concluído com sucesso!");

    return NextResponse.json({
      message: verificacaoMes.ultimoUpload
        ? `Relatório de período substituído com sucesso! ${verificacaoMes.mensagem}`
        : "Upload de período realizado com sucesso!",
      detalhes: {
        periodo: `${periodoInicial.toLocaleDateString(
          "pt-BR"
        )} a ${periodoFinal.toLocaleDateString("pt-BR")}`,
        totalDiasPeriodo,
        mesReferencia: `${mesReferencia}/${anoReferencia}`,
        registrosProcessados,
        atualizados: registrosAtualizados,
        naoEncontrados: registrosNaoEncontrados,
        uploadId: periodoUpload.id,
        substituicao: !!verificacaoMes.ultimoUpload,
      },
    });
  } catch (error) {
    console.error("Erro no upload de período:", error);
    if (uploadId)
      errorProgress(
        uploadId,
        error instanceof Error ? error.message : "Erro desconhecido"
      );
    return NextResponse.json(
      {
        message: "Erro interno do servidor",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 }
    );
  }
}

/* Configurações */
export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutos
export const dynamic = "force-dynamic";
