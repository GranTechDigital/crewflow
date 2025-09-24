'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/app/hooks/useAuth';
import { useSearchParams } from 'next/navigation';

interface UptimeRegistro {
  id: number;
  matricula: string;
  dataInicio: string | null;
  dataFim: string | null;
  status: string | null;
  isAtual: boolean;
  dadosCompletos: any;
}

interface Funcionario {
  id: number;
  matricula: string;
  nome: string;
  funcao: string | null;
  status: string | null;
}

export default function FuncionarioUptimePage() {
  const { usuario } = useAuth();
  const searchParams = useSearchParams();
  const matricula = searchParams.get('matricula');
  const dataParam = searchParams.get('data');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [funcionario, setFuncionario] = useState<Funcionario | null>(null);
  const [registroAtual, setRegistroAtual] = useState<UptimeRegistro | null>(null);
  const [todosRegistros, setTodosRegistros] = useState<UptimeRegistro[]>([]);
  const [dataReferencia, setDataReferencia] = useState<string>(dataParam || new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (matricula) {
      fetchFuncionarioData();
    }
  }, [matricula, dataReferencia]);

  const fetchFuncionarioData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const url = `/api/uptime/funcionario?matricula=${matricula}&data=${dataReferencia}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao buscar dados do funcionário');
      }
      
      const data = await response.json();
      setFuncionario(data.funcionario);
      setRegistroAtual(data.registroAtual);
      setTodosRegistros(data.todosRegistros);
    } catch (err: any) {
      console.error('Erro ao buscar dados:', err);
      setError(err.message || 'Erro ao buscar dados do funcionário');
    } finally {
      setLoading(false);
    }
  };

  const handleDataChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDataReferencia(e.target.value);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('pt-BR');
    } catch (e) {
      return dateString;
    }
  };
  
  const getStatusColor = (status: string | null) => {
    if (!status) return 'bg-gray-100 text-gray-800';
    
    switch (status.toLowerCase()) {
      case 'embarcado':
        return 'bg-green-100 text-green-800';
      case 'desembarcado':
        return 'bg-yellow-100 text-yellow-800';
      case 'férias':
      case 'ferias':
        return 'bg-blue-100 text-blue-800';
      case 'afastado':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (!usuario) {
    return (
      <div className="p-8">
        Você precisa estar logado para acessar esta página.
      </div>
    );
  }

  if (!matricula) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Dados de Uptime do Funcionário</h1>
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
          Nenhuma matrícula especificada. Por favor, forneça uma matrícula válida.
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-4">
        <a href="/uptime" className="text-blue-600 hover:text-blue-800 inline-flex items-center">
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Voltar para Uptime
        </a>
      </div>
      <h1 className="text-2xl font-bold mb-6">Dados de Uptime do Funcionário</h1>
      
      {/* Seletor de data */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Data de Referência
        </label>
        <input
          type="date"
          value={dataReferencia}
          onChange={handleDataChange}
          className="p-2 border border-gray-300 rounded-md w-full max-w-xs"
        />
      </div>

      {/* Mensagens de erro */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      )}

      {/* Dados do funcionário */}
      {!loading && funcionario && (
        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Informações do Funcionário</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-gray-600">Matrícula:</p>
              <p className="font-medium">{funcionario.matricula}</p>
            </div>
            <div>
              <p className="text-gray-600">Nome:</p>
              <p className="font-medium">{funcionario.nome}</p>
            </div>
            <div>
              <p className="text-gray-600">Função:</p>
              <p className="font-medium">{funcionario.funcao || 'N/A'}</p>
            </div>
            <div>
              <p className="text-gray-600">Status no Sistema:</p>
              <p className="font-medium">{funcionario.status || 'N/A'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Status atual */}
      {!loading && registroAtual ? (
        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Status Atual (em {formatDate(dataReferencia)})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-gray-600">Status:</p>
              <p className="font-medium">
                <span className={`inline-block px-2 py-1 rounded ${getStatusColor(registroAtual.status)}`}>
                  {registroAtual.status || 'N/A'}
                </span>
              </p>
            </div>
            <div>
              <p className="text-gray-600">Período:</p>
              <p className="font-medium">{formatDate(registroAtual.dataInicio)} a {formatDate(registroAtual.dataFim)}</p>
            </div>
            {Object.entries(registroAtual.dadosCompletos).map(([key, value]) => {
              // Ignorar campos já exibidos ou que não são relevantes
              if (['matricula', 'Status', 'status', 'Data Início', 'Data Inicio', 'DataInicio', 'Data Fim', 'DataFim'].includes(key)) {
                return null;
              }
              return (
                <div key={key}>
                  <p className="text-gray-600">{key}:</p>
                  <p className="font-medium">{value?.toString() || 'N/A'}</p>
                </div>
              );
            })}
          </div>
        </div>
      ) : !loading && (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
          Nenhum registro encontrado para a data {formatDate(dataReferencia)}.
        </div>
      )}

      {/* Histórico de registros */}
      {!loading && todosRegistros.length > 0 && (
        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Histórico de Registros</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white">
              <thead>
                <tr className="bg-gray-100">
                  <th className="py-2 px-4 border-b text-left">Período</th>
                  <th className="py-2 px-4 border-b text-left">Status</th>
                  <th className="py-2 px-4 border-b text-left">Atual</th>
                </tr>
              </thead>
              <tbody>
                {todosRegistros.map((registro) => (
                  <tr key={registro.id} className={registro.isAtual ? 'bg-blue-50' : 'bg-white'}>
                    <td className="py-2 px-4 border-b">
                      {formatDate(registro.dataInicio)} a {formatDate(registro.dataFim)}
                    </td>
                    <td className="py-2 px-4 border-b">
                      <span className={`inline-block px-2 py-1 rounded ${getStatusColor(registro.status)}`}>
                        {registro.status || 'N/A'}
                      </span>
                    </td>
                    <td className="py-2 px-4 border-b">
                      {registro.isAtual ? (
                        <span className="inline-block px-2 py-1 rounded bg-green-100 text-green-800">Sim</span>
                      ) : (
                        <span className="inline-block px-2 py-1 rounded bg-gray-100 text-gray-800">Não</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}