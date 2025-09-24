'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import UptimeStatusCard from '@/components/UptimeStatusCard';
import { Spinner } from 'flowbite-react';

interface Funcionario {
  id: string;
  matricula: string;
  nome: string;
  funcao: string;
  statusSistema: string;
  statusUptime: string | null;
  dataInicio: string | null;
  dataFim: string | null;
  embarcacao: string | null;
}

export default function UptimeStatusPage() {
  const searchParams = useSearchParams();
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataReferencia, setDataReferencia] = useState<string>(
    searchParams.get('data') || new Date().toISOString().split('T')[0]
  );

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/uptime/status?data=${dataReferencia}`);
        if (!response.ok) {
          throw new Error(`Erro ao buscar dados: ${response.status}`);
        }
        const data = await response.json();
        setFuncionarios(data.funcionarios);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [dataReferencia]);

  const handleDataChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDataReferencia(e.target.value);
  };

  // Filtrar funcionários por status
  const funcionariosEmbarcados = funcionarios.filter(
    (f) => f.statusUptime?.toLowerCase() === 'embarcado'
  );
  const funcionariosDesembarcados = funcionarios.filter(
    (f) => f.statusUptime?.toLowerCase() === 'desembarcado'
  );
  const funcionariosFerias = funcionarios.filter(
    (f) => f.statusUptime?.toLowerCase() === 'férias' || f.statusUptime?.toLowerCase() === 'ferias'
  );
  const funcionariosAfastados = funcionarios.filter(
    (f) => f.statusUptime?.toLowerCase() === 'afastado'
  );
  const funcionariosOutros = funcionarios.filter(
    (f) => !f.statusUptime || 
    (f.statusUptime.toLowerCase() !== 'embarcado' && 
     f.statusUptime.toLowerCase() !== 'desembarcado' && 
     f.statusUptime.toLowerCase() !== 'férias' && 
     f.statusUptime.toLowerCase() !== 'ferias' && 
     f.statusUptime.toLowerCase() !== 'afastado')
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Status dos Funcionários</h1>
      
      <div className="mb-6">
        <label htmlFor="dataReferencia" className="block text-sm font-medium text-gray-700 mb-1">
          Data de Referência
        </label>
        <div className="flex items-center gap-4">
          <input
            type="date"
            id="dataReferencia"
            value={dataReferencia}
            onChange={handleDataChange}
            className="px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-500">
            Mostrando status válidos para esta data
          </span>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Spinner size="xl" />
          <span className="ml-2">Carregando dados...</span>
        </div>
      ) : error ? (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Erro!</strong>
          <span className="block sm:inline"> {error}</span>
        </div>
      ) : (
        <div className="space-y-8">
          {funcionariosEmbarcados.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4 text-green-700">Embarcados ({funcionariosEmbarcados.length})</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {funcionariosEmbarcados.map((funcionario) => (
                  <UptimeStatusCard
                    key={funcionario.id}
                    matricula={funcionario.matricula}
                    nome={funcionario.nome}
                    status={funcionario.statusUptime}
                    dataInicio={funcionario.dataInicio}
                    dataFim={funcionario.dataFim}
                    embarcacao={funcionario.embarcacao}
                  />
                ))}
              </div>
            </div>
          )}

          {funcionariosDesembarcados.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4 text-yellow-700">Desembarcados ({funcionariosDesembarcados.length})</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {funcionariosDesembarcados.map((funcionario) => (
                  <UptimeStatusCard
                    key={funcionario.id}
                    matricula={funcionario.matricula}
                    nome={funcionario.nome}
                    status={funcionario.statusUptime}
                    dataInicio={funcionario.dataInicio}
                    dataFim={funcionario.dataFim}
                    embarcacao={funcionario.embarcacao}
                  />
                ))}
              </div>
            </div>
          )}

          {funcionariosFerias.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4 text-blue-700">Férias ({funcionariosFerias.length})</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {funcionariosFerias.map((funcionario) => (
                  <UptimeStatusCard
                    key={funcionario.id}
                    matricula={funcionario.matricula}
                    nome={funcionario.nome}
                    status={funcionario.statusUptime}
                    dataInicio={funcionario.dataInicio}
                    dataFim={funcionario.dataFim}
                    embarcacao={funcionario.embarcacao}
                  />
                ))}
              </div>
            </div>
          )}

          {funcionariosAfastados.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4 text-red-700">Afastados ({funcionariosAfastados.length})</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {funcionariosAfastados.map((funcionario) => (
                  <UptimeStatusCard
                    key={funcionario.id}
                    matricula={funcionario.matricula}
                    nome={funcionario.nome}
                    status={funcionario.statusUptime}
                    dataInicio={funcionario.dataInicio}
                    dataFim={funcionario.dataFim}
                    embarcacao={funcionario.embarcacao}
                  />
                ))}
              </div>
            </div>
          )}

          {funcionariosOutros.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4 text-gray-700">Outros ({funcionariosOutros.length})</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {funcionariosOutros.map((funcionario) => (
                  <UptimeStatusCard
                    key={funcionario.id}
                    matricula={funcionario.matricula}
                    nome={funcionario.nome}
                    status={funcionario.statusUptime}
                    dataInicio={funcionario.dataInicio}
                    dataFim={funcionario.dataFim}
                    embarcacao={funcionario.embarcacao}
                  />
                ))}
              </div>
            </div>
          )}

          {funcionarios.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500">Nenhum funcionário encontrado.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}