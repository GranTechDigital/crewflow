'use client'

import { UserGroupIcon } from '@heroicons/react/16/solid';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';


interface Contrato {
  id: number;
  numero: string;
  nome: string;
  cliente: string;
  dataInicio: string;
  dataFim: string;
  centroDeCusto: string;
  status: string;
}

interface Funcionario {
  id: string;
  nome: string;
  centroCusto: string;
}

export default function ContratosPage() {
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingFuncionarios, setLoadingFuncionarios] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchContratos();
    fetchFuncionarios();
  }, []);

  async function fetchContratos() {
    try {
      const res = await fetch('/api/contratos');
      if (!res.ok) throw new Error('Erro ao carregar contratos');
      const data = await res.json();
      setContratos(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchFuncionarios() {
    try {
      const res = await fetch('/api/dados');
      const data = await res.json();
      setFuncionarios(data);
    } catch (error) {
      console.error('Erro ao buscar funcionários:', error);
    } finally {
      setLoadingFuncionarios(false);
    }
  }

  const getFuncionariosPorCentro = (centros: string[]) => {
    return centros.map((centro) => {
      const total = funcionarios.filter(f => f.centroCusto === centro).length;
      return { centro, total };
    });
  };

  const contratosUnicos = Object.values(
    contratos.reduce((acc, contrato) => {
      if (!acc[contrato.numero]) {
        acc[contrato.numero] = { ...contrato, centros: new Set<string>() };
      }
      (contrato.centroDeCusto ?? '')
        .split(',')
        .map(c => c.trim())
        .filter(c => c !== '')
        .forEach(c => acc[contrato.numero].centros.add(c));
      return acc;
    }, {} as Record<string, Contrato & { centros: Set<string> }>)
  );

  if (loading || loadingFuncionarios) {
    return <div className="p-6 text-gray-600">Carregando contratos...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Contratos</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {contratosUnicos.map((contrato) => {
          const centros = Array.from(contrato.centros);
          const funcionariosPorCentro = getFuncionariosPorCentro(centros);
          const totalFuncionarios = funcionariosPorCentro.reduce((sum, item) => sum + item.total, 0);
          console.log(funcionariosPorCentro);

          const dataInicioFormatada = new Date(contrato.dataInicio).toLocaleDateString('pt-BR');
          const dataFimFormatada = new Date(contrato.dataFim).toLocaleDateString('pt-BR');

          return (
            <div
              key={contrato.numero}
              className="rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-all duration-300 p-5 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-1">
                    {contrato.nome}
                  </h2>
                </div>
                <div className="text-xs text-right">
                  <span
                    className={`inline-block px-2 py-1 rounded-full font-medium ${contrato.status === 'Ativo'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-yellow-100 text-yellow-700'
                      }`}
                  >
                    {contrato.status}
                  </span>
                </div>
              </div>
              <div className="mb-3">
                <p className="text-sm text-gray-500">{contrato.cliente}</p>
                <p className="text-xs text-gray-400 mt-1">
                  Contrato #{contrato.numero}
                </p>
              </div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="text-sm text-gray-600 font-medium">
                    {dataInicioFormatada} até {dataFimFormatada}
                  </span>
                </div>
                <div className="flex items-center gap-2 bg-gray-100 px-3 py-1 rounded-lg text-gray-700 text-sm font-medium">
                  <UserGroupIcon className="w-4 h-4 text-gray-500" />
                  {totalFuncionarios} funcionário{totalFuncionarios !== 1 && 's'}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs mb-3">
                {funcionariosPorCentro.map(({ centro, total }) => (
                  <span
                    key={centro}
                    className="bg-gray-100 text-gray-700 border border-gray-300 rounded-full px-3 py-1"
                  >
                    {centro}: {total}
                  </span>
                ))}
              </div>
              <button
                onClick={() => router.push(`centro-custos/${contrato.id}`)}
                className="px-4 py-2 text-sm text-gray-800 bg-gray-200 rounded hover:bg-gray-400 shadow-md transition-all duration-300"
              >
                Ver contrato
              </button>

            </div>
          );
        })}
      </div>
    </div>
  );
}
