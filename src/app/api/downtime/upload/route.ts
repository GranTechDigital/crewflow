import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getUserFromRequest } from "@/utils/authUtils";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Função auxiliar para extrair campo do objeto
function getCampo(obj: any, campo: string): string {
  return obj[campo] || "";
}

// Função para extrair número de uma string
function getNumero(value: any): number | null {
  //console.log("Inicio - value:", value);
  if (typeof value === "number") {
    //console.log("getNumero - number:", value);
    return value;
  }
  if (typeof value === "string") {
    const num = parseFloat(value.replace(/[^\d.-]/g, ""));
  //  console.log("getNumero - string:", value, "->", num);
    return isNaN(num) ? null : num;
  }
//  console.log("getNumero - unknown:", value);
  return null;
}

// Função para extrair número float de uma string ou número
function getFloat(value: any): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const num = parseFloat(value.replace(/[^\d.-]/g, ""));
    return isNaN(num) ? null : num;
  }
  return null;
}

// Função específica para processar porcentagens que vêm da planilha
function getPorcentagem(value: any): number | null {
  // if (typeof value === "number") {
  //   // Se já é um número, pode estar como decimal (0.15) ou como porcentagem (15)
  //   // Assumimos que se for menor que 1, já está em decimal
  //   return value > 1 ? value : value * 100;
  // }
  if (typeof value === "string") {
    // Remove o símbolo % e outros caracteres não numéricos, exceto ponto e vírgula
    const cleanValue = value.replace(/%/g, "").replace(/,/g, ".").trim();
    const num = parseFloat(cleanValue);
    return isNaN(num) ? null : num;
  }
  return null;
}

// Função para extrair dados de uma linha de projeto
// Função para normalizar cabeçalhos das colunas (remove espaços e caracteres especiais)
function normalizarCabecalhos(row: any): any {
  const rowNormalizado: any = {};
  
  for (const [chave, valor] of Object.entries(row)) {
    // Remove espaços no início e fim, e normaliza a chave
    const chaveNormalizada = chave.trim();
    rowNormalizado[chaveNormalizada] = valor;
  }
  
  return rowNormalizado;
}

// Função auxiliar para buscar campo normalizado
function buscarCampoNormalizado(rowNormalizado: any, campo: string): any {
  // Primeiro tenta buscar exatamente como está
  if (rowNormalizado[campo] !== undefined) {
    return rowNormalizado[campo];
  }
  
  // Se não encontrar, tenta buscar variações comuns
  const variacoes = [
    campo,
    campo.trim(),
    ` ${campo}`, // Com espaço no início
    `${campo} `, // Com espaço no final
    ` ${campo} `, // Com espaços em ambos os lados
    `Processo de ${campo}`, // Para casos como "Processo de Demissão"
  ];
  
  // Para colunas de porcentagem, adiciona variações específicas
  if (campo.startsWith("% ")) {
    const campoSemPorcentagem = campo.substring(2); // Remove "% "
    variacoes.push(
      `%${campoSemPorcentagem}`, // Sem espaço após %
      `% ${campoSemPorcentagem} `, // Com espaço no final
      ` % ${campoSemPorcentagem}`, // Com espaço no início
      ` % ${campoSemPorcentagem} 
      `, // Com espaços em ambos os lados
    );
  }
  
  for (const variacao of variacoes) {
    if (rowNormalizado[variacao] !== undefined) {
      //console.log(`Campo encontrado: "${campo}" -> "${variacao}" = ${rowNormalizado[variacao]}`);
      return rowNormalizado[variacao];
    }
  }
  
 // console.log(`Campo não encontrado: "${campo}". Chaves disponíveis:`, Object.keys(rowNormalizado));
  return null;
}

function validarEstruturaPlanilha(headers: string[]): { valida: boolean; tipo: string; erro?: string } {
  // Verificar se é arquivo de downtime
  const camposDowntime = ["COD.PROJETO", "NOME_PROJETO", "Uptime", "Downtime"];
  const temCamposDowntime = camposDowntime.some(campo => 
    headers.some(header => header.includes(campo) || header.includes(campo.replace(".", "")))
  );
  
  // Verificar se é arquivo de uptime (funcionários)
  const camposUptime = ["Matrícula", "SISPAT", "Admissão", "Demissão"];
  const temCamposUptime = camposUptime.some(campo => 
    headers.some(header => header.includes(campo))
  );
  
  if (temCamposUptime) {
    return {
      valida: false,
      tipo: "uptime",
      erro: "Este arquivo parece ser de Uptime (funcionários). Por favor, use a página de Uptime para fazer o upload deste arquivo."
    };
  }
  
  if (!temCamposDowntime) {
    return {
      valida: false,
      tipo: "desconhecido",
      erro: `Estrutura de arquivo não reconhecida. Para Downtime, o arquivo deve conter as colunas: ${camposDowntime.join(", ")}. Colunas encontradas: ${headers.join(", ")}`
    };
  }
  
  return { valida: true, tipo: "downtime" };
}

function getProjetoData(row: any): any {
  // Normalizar cabeçalhos removendo espaços extras
  // console.log(row);
  
  const rowNormalizado = normalizarCabecalhos(row);
  
  // Extrair valores absolutos
  const agEmbarque = getNumero(buscarCampoNormalizado(rowNormalizado, "Ag. Embarque"));
  const cadastro = getNumero(buscarCampoNormalizado(rowNormalizado, "Cadastro"));
  const medicina = getNumero(buscarCampoNormalizado(rowNormalizado, "Medicina"));
  const treinamento = getNumero(buscarCampoNormalizado(rowNormalizado, "Treinamento"));
  const atestado = getNumero(buscarCampoNormalizado(rowNormalizado, "Atestado"));
  const falta = getNumero(buscarCampoNormalizado(rowNormalizado, "Falta"));
  const demissao = getNumero(buscarCampoNormalizado(rowNormalizado, "Demissão"));
  
  // Extrair porcentagens diretamente da planilha
  const percentAgEmbarque = getNumero(
    buscarCampoNormalizado(rowNormalizado, "% Ag. Embarque")
  );
  const percentCadastro = getNumero(
    buscarCampoNormalizado(rowNormalizado, "% Cadastro")
  );
  const percentMedicina = getNumero(
    buscarCampoNormalizado(rowNormalizado, "% Medicina")
  );
  const percentTreinamento = getNumero(
    buscarCampoNormalizado(rowNormalizado, "% Treinamento")
  );
  const percentAtestado = getNumero(
    buscarCampoNormalizado(rowNormalizado, "% Atestado")
  );
  const percentFalta = getNumero(
    buscarCampoNormalizado(rowNormalizado, "% Falta")
  );
  const percentDemissao = getNumero(
    buscarCampoNormalizado(rowNormalizado, "% Demissão")
  );
  
  const resultado = {
    codProjeto: getCampo(rowNormalizado, "COD.PROJETO"),              // texto
    nomeProjeto: getCampo(rowNormalizado, "NOME_PROJETO"),            // texto
    uptime: getFloat(rowNormalizado["Uptime"]),                       // float
    downtime: getFloat(rowNormalizado["Downtime"]),                   // float
    agEmbarque: agEmbarque,                                           // int
    percentAgEmbarque: percentAgEmbarque,                             // float da planilha
    cadastro: cadastro,                                               // int
    percentCadastro: percentCadastro,                                 // float da planilha
    medicina: medicina,                                               // int
    percentMedicina: percentMedicina,                                 // float da planilha
    treinamento: treinamento,                                         // int
    percentTreinamento: percentTreinamento,                           // float da planilha
    atestado: atestado,                                               // int
    percentAtestado: percentAtestado,                                 // float da planilha
    falta: falta,                                                     // int
    percentFalta: percentFalta,                                       // float da planilha
    demissao: demissao,                                               // int
    percentDemissao: percentDemissao,                                 // float da planilha
  };
  
  return resultado;
}

export async function POST(request: NextRequest) {
  try {
    const usuario = await getUserFromRequest(request);
    if (!usuario) {
      return NextResponse.json(
        { message: "Você precisa estar logado para realizar esta ação" },
        { status: 401 }
      );
    }

    const { projetos, dataUpload, nomeArquivo } = await request.json();

    if (!Array.isArray(projetos) || projetos.length === 0) {
      return NextResponse.json(
        { message: "Nenhum dado de projeto encontrado no arquivo" },
        { status: 400 }
      );
    }

    let importados = 0;
    let ignorados = 0;

    await prisma.$transaction(async (tx) => {
      // Limpa os dados de downtime antes de inserir o novo arquivo
      await tx.downtimeSheet.deleteMany({});

      const aInserir: any[] = [];

      for (const row of projetos) {
        const projetoData = getProjetoData(row);
        // console.log("projetoData:");
        // console.log("projetoData:", row);
        // Verifica se tem pelo menos código ou nome do projeto
        if (!projetoData.codProjeto && !projetoData.nomeProjeto) {
          ignorados++;
          continue;
        }

        aInserir.push({
          ...projetoData,
          dataUpload: new Date(dataUpload),
          nomeArquivo: nomeArquivo || "downtime.xlsx",
          uploadPor: usuario.funcionario.nome || "Sistema",
        });

        importados++;
      }

      if (aInserir.length > 0) {
        // Inserção em lote — mais rápido e consistente
        await tx.downtimeSheet.createMany({ data: aInserir });
      }

      // Registrar histórico
      await tx.historicoRemanejamento.create({
        data: {
          tipoAcao: "UPLOAD_DOWNTIME_SHEET",
          entidade: "DowntimeSheet",
          descricaoAcao: `Upload de arquivo Downtime com ${projetos.length} registros`,
          usuarioResponsavel: usuario.funcionario.nome || "Sistema",
          dataAcao: new Date(dataUpload),
          observacoes: `Importados: ${importados}, Ignorados: ${ignorados}`,
        },
      });
    });

    return NextResponse.json({
      message: "Arquivo processado com sucesso",
      importados,
      ignorados,
      total: projetos.length,
    });
  } catch (error: any) {
    console.error("Erro ao processar upload de Downtime:", error);
    return NextResponse.json(
      { message: `Erro ao processar o arquivo: ${error.message}` },
      { status: 500 }
    );
  }
}