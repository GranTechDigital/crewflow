"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { read, utils } from "xlsx";

interface UptimeData {
  data: string;
  sistema: string;
  status: string;
  uptime: number;
  observacoes?: string;
}

interface FuncionarioUptime {
  matricula: string;
  sispat: string;
  totalDias: number;
  totalDiasPeriodo: number;
  embarcacaoAtual: string;
  observacoes: string;
  status: string;
}

export default function UptimePage() {
  const { usuario } = useAuth();
  const [uptimeData, setUptimeData] = useState<UptimeData[]>([]);
  const [funcionariosData, setFuncionariosData] = useState<FuncionarioUptime[]>(
    []
  );
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [limpando, setLimpando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"upload" | "status">("upload");
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  const limparDados = async () => {
    try {
      setLimpando(true);
      setError(null);
      setSuccessMessage(null);

      const response = await fetch("/api/uptime/limpar", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Erro ao limpar dados");
      }

      const result = await response.json();
      setSuccessMessage(
        `Dados limpos com sucesso! ${result.registrosRemovidos} registros foram removidos.`
      );
      setFuncionariosData([]);
    } catch (err: any) {
      console.error("Erro ao limpar dados:", err);
      setError(err.message || "Erro ao limpar dados");
    } finally {
      setLimpando(false);
    }
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      setError(null);
      setSuccessMessage(null);
      setUploadProgress(0);

      // Ler o arquivo Excel
      const reader = new FileReader();
      reader.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(percent);
        }
      };
      reader.onload = async (e) => {
        try {
          const data = e.target?.result;
          const workbook = read(data, { type: "array" });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = utils.sheet_to_json<any>(worksheet, {
            raw: false,
            defval: "",
            range: 1,
          });
          if (!jsonData || jsonData.length === 0) {
            throw new Error("Nenhum dado encontrado no arquivo Excel");
          }

          // Verificar estrutura dos dados
          console.log("Exemplo de linha do Excel:", jsonData[0]);
          console.log("Colunas disponíveis:", Object.keys(jsonData[0]));

          // Filtrar apenas linhas com matrícula válida
          const matriculas = jsonData
            .map((row: any) => {
              const matricula =
                row["Matrícula"] ||
                row["matricula"] ||
                row["MAT"] ||
                row["mat"] ||
                row["MATRICULA"] ||
                row["Matricula"];

              // Se não encontrou matrícula em nenhum formato conhecido, tentar buscar em qualquer campo que contenha 'mat'
              if (!matricula) {
                for (const key of Object.keys(row)) {
                  if (key.toLowerCase().includes("mat") && row[key]) {
                    console.log(
                      `Encontrada possível matrícula no campo '${key}':`,
                      row[key]
                    );
                    return row[key];
                  }
                }
              }

              return matricula;
            })
            .filter((m: any) => m && m.toString().trim() !== "");

          console.log(
            "Primeiras 5 matrículas encontradas:",
            matriculas.slice(0, 5)
          );
          if (matriculas.length === 0) {
            throw new Error(
              'Nenhum funcionário com matrícula válida encontrado no arquivo. Verifique se a coluna "Matrícula" existe e está preenchida.'
            );
          }
          // Normalizar os dados antes de enviar, garantindo que cada linha tenha um campo matricula padronizado
          const dadosNormalizados = jsonData.map((row: any) => {
            // Encontrar a matrícula em qualquer formato possível
            const matriculaOriginal =
              row["Matrícula"] ||
              row["matricula"] ||
              row["MAT"] ||
              row["mat"] ||
              row["MATRICULA"] ||
              row["Matricula"];
            let matricula = matriculaOriginal;

            // Se não encontrou matrícula em nenhum formato conhecido, tentar buscar em qualquer campo que contenha 'mat'
            if (!matricula) {
              for (const key of Object.keys(row)) {
                if (key.toLowerCase().includes("mat") && row[key]) {
                  matricula = row[key];
                  break;
                }
              }
            }

            // Criar uma cópia do objeto com a matrícula normalizada
            return {
              ...row,
              matricula: matricula ? matricula.toString().trim() : "",
            };
          });

          console.log(
            "Dados normalizados (primeiros 2):",
            dadosNormalizados.slice(0, 80)
          );

          // Enviar todos os dados da planilha, mas só importar no backend os que têm matrícula válida
          setFuncionariosData(dadosNormalizados);
          
          console.log("Enviando dados para API, incluindo worksheet para extração de período...");
          
          const response = await fetch("/api/uptime/upload", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              funcionarios: dadosNormalizados,
              dataUpload: new Date().toISOString(),
              nomeArquivo: file.name,
              worksheet: worksheet, // Enviar a worksheet para extração do período
            }),
          });
          if (!response.ok) {
            const errorData = await response.json();
            let errorMessage = errorData.message || "Erro ao processar o arquivo";
            
            // Se há detalhes da validação de período, incluir na mensagem
            if (errorData.detalhes) {
              errorMessage += `\n\nDetalhes:\n`;
              errorMessage += `• Data inicial: ${errorData.detalhes.dataInicial}\n`;
              errorMessage += `• Data final: ${errorData.detalhes.dataFinal}\n`;
              errorMessage += `• Valor da célula A1: "${errorData.detalhes.valorA1}"`;
            }
            
            throw new Error(errorMessage);
          }
          const result = await response.json();
          setSuccessMessage(
            `Arquivo processado com sucesso! ${result.importados} registros importados de um total de ${result.total}.`
          );
        } catch (err: any) {
          setError(err.message || "Erro ao processar o arquivo");
        } finally {
          setUploading(false);
          setUploadProgress(0);
        }
      };

      reader.readAsArrayBuffer(file);
    } catch (err: any) {
      console.error("Erro ao fazer upload:", err);
      setError(err.message || "Erro ao fazer upload do arquivo");
      setUploading(false);
    }
  };

  if (!usuario) {
    return (
      <div className="p-8">
        Você precisa estar logado para acessar esta página.
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Upload </h1>
      {/* Tabs de navegação */}
      <div className="flex border-b mb-6">
        <button
          className={`py-2 px-4 mr-2 ${
            activeTab === "upload"
              ? "border-b-2 border-blue-500 font-medium"
              : "text-gray-500"
          }`}
          onClick={() => setActiveTab("upload")}
        >
          Upload de Arquivo
        </button>
      </div>

      {/* Mensagens de erro */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <pre className="whitespace-pre-wrap font-sans">{error}</pre>
        </div>
      )}

      {/* Mensagens de sucesso */}
      {successMessage && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {successMessage}
        </div>
      )}

      {/* Conteúdo da tab de upload */}
      {activeTab === "upload" && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">
            Upload de Arquivo Uptime
          </h2>
          <p className="mb-4 text-gray-600">
            Faça o upload do arquivo Excel contendo os dados de funcionários. O
            sistema irá extrair as informações de Matrícula, SISPAT, Total Dias,
            Total Dias no período, Embarcação Atual, Observações e Status.
          </p>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Selecione o arquivo Excel
            </label>
            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={handleFileUpload}
              disabled={uploading}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100
                disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {uploading && (
            <div className="flex flex-col items-center justify-center mb-4">
              <div className="w-full bg-gray-200 rounded-full h-4 mb-2">
                <div
                  className="bg-blue-500 h-4 rounded-full"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
              <span className="text-sm text-gray-700">
                Carregando arquivo... {uploadProgress}%
              </span>
            </div>
          )}

          {/* <div className="mt-6 pt-4 border-t border-gray-200">
            <h3 className="text-lg font-medium mb-2">Limpar Dados</h3>
            <p className="mb-4 text-gray-600">
              Limpe todos os dados de Uptime do banco de dados para realizar novos testes.
            </p>
            <button
              onClick={limparDados}
              disabled={limpando}
              className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {limpando ? "Limpando..." : "Limpar Dados de Uptime"}
            </button>
          </div> */}
        </div>
      )}
    </div>
  );
}
