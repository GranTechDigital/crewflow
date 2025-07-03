'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeftIcon, UserIcon, BuildingOfficeIcon, BriefcaseIcon, CalendarIcon, PhoneIcon, EnvelopeIcon, IdentificationIcon } from '@heroicons/react/24/outline';

interface Funcionario {
  id: number;
  matricula: string;
  cpf?: string;
  nome: string;
  funcao?: string;
  rg?: string;
  orgaoEmissor?: string;
  uf?: string;
  dataNascimento?: string;
  email?: string;
  telefone?: string;
  centroCusto?: string;
  departamento?: string;
  status?: string;
  contratoId?: number;
  criadoEm: string;
  atualizadoEm: string;
  contrato?: {
    id: number;
    nome: string;
    cliente: string;
    numero: string;
  };
}

export default function FuncionarioDetalhePage() {
  const params = useParams();
  const router = useRouter();
  const [funcionario, setFuncionario] = useState<Funcionario | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const funcionarioId = params.id as string;

  useEffect(() => {
    if (funcionarioId) {
      fetchFuncionario();
    }
  }, [funcionarioId]);

  const fetchFuncionario = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/funcionarios/${funcionarioId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Funcionário não encontrado');
        }
        throw new Error('Erro ao carregar dados do funcionário');
      }
      
      const data = await response.json();
      setFuncionario(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('pt-BR');
    } catch {
      return 'Data inválida';
    }
  };

  const getStatusColor = (status?: string) => {
    if (!status) return 'bg-gray-100 text-gray-800';
    
    switch (status.toLowerCase()) {
      case 'ativo':
        return 'bg-green-100 text-green-800';
      case 'inativo':
        return 'bg-red-100 text-red-800';
      case 'pendente':
        return 'bg-yellow-100 text-yellow-800';
      case 'suspenso':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="text-red-800">
            <strong>Erro:</strong> {error}
          </div>
          <button
            onClick={() => router.push('/planejamento/funcionarios')}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Voltar para Lista
          </button>
        </div>
      </div>
    );
  }

  if (!funcionario) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-8">
          <p className="text-gray-500">Funcionário não encontrado.</p>
          <button
            onClick={() => router.push('/planejamento/funcionarios')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Voltar para Lista
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/planejamento/funcionarios')}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-4"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Voltar para Lista de Funcionários
        </button>
        
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{funcionario.nome}</h1>
            <div className="flex items-center gap-4 mt-2">
              <span className="text-gray-600">Matrícula: {funcionario.matricula}</span>
              {funcionario.status && (
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(funcionario.status)}`}>
                  {funcionario.status}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => router.push(`/planejamento/funcionarios/${funcionario.id}/editar`)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Editar
            </button>
          </div>
        </div>
      </div>

      {/* Cards de Informações */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Informações Pessoais */}
        <div className="bg-white rounded-lg shadow border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <UserIcon className="w-5 h-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">Informações Pessoais</h2>
            </div>
          </div>
          <div className="px-6 py-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Nome Completo</label>
                <p className="mt-1 text-sm text-gray-900">{funcionario.nome}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Matrícula</label>
                <p className="mt-1 text-sm text-gray-900">{funcionario.matricula}</p>
              </div>
            </div>
            
            {funcionario.cpf && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">CPF</label>
                  <p className="mt-1 text-sm text-gray-900">{funcionario.cpf}</p>
                </div>
                {funcionario.rg && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">RG</label>
                    <p className="mt-1 text-sm text-gray-900">{funcionario.rg}</p>
                  </div>
                )}
              </div>
            )}
            
            {funcionario.orgaoEmissor && funcionario.uf && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Órgão Emissor</label>
                  <p className="mt-1 text-sm text-gray-900">{funcionario.orgaoEmissor}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">UF</label>
                  <p className="mt-1 text-sm text-gray-900">{funcionario.uf}</p>
                </div>
              </div>
            )}
            
            {funcionario.dataNascimento && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Data de Nascimento</label>
                <p className="mt-1 text-sm text-gray-900">{formatDate(funcionario.dataNascimento)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Informações de Contato */}
        <div className="bg-white rounded-lg shadow border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <PhoneIcon className="w-5 h-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">Contato</h2>
            </div>
          </div>
          <div className="px-6 py-4 space-y-4">
            {funcionario.email && (
              <div>
                <label className="block text-sm font-medium text-gray-700">E-mail</label>
                <div className="mt-1 flex items-center gap-2">
                  <EnvelopeIcon className="w-4 h-4 text-gray-400" />
                  <a href={`mailto:${funcionario.email}`} className="text-sm text-blue-600 hover:text-blue-800">
                    {funcionario.email}
                  </a>
                </div>
              </div>
            )}
            
            {funcionario.telefone && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Telefone</label>
                <div className="mt-1 flex items-center gap-2">
                  <PhoneIcon className="w-4 h-4 text-gray-400" />
                  <a href={`tel:${funcionario.telefone}`} className="text-sm text-blue-600 hover:text-blue-800">
                    {funcionario.telefone}
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Informações Profissionais */}
        <div className="bg-white rounded-lg shadow border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <BriefcaseIcon className="w-5 h-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">Informações Profissionais</h2>
            </div>
          </div>
          <div className="px-6 py-4 space-y-4">
            {funcionario.funcao && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Função</label>
                <p className="mt-1 text-sm text-gray-900">{funcionario.funcao}</p>
              </div>
            )}
            
            {funcionario.centroCusto && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Centro de Custo</label>
                <p className="mt-1 text-sm text-gray-900">{funcionario.centroCusto}</p>
              </div>
            )}
            
            {funcionario.departamento && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Departamento</label>
                <p className="mt-1 text-sm text-gray-900">{funcionario.departamento}</p>
              </div>
            )}
          </div>
        </div>

        {/* Informações do Contrato */}
        {funcionario.contrato && (
          <div className="bg-white rounded-lg shadow border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <BuildingOfficeIcon className="w-5 h-5 text-gray-600" />
                <h2 className="text-lg font-semibold text-gray-900">Contrato</h2>
              </div>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Nome do Contrato</label>
                <p className="mt-1 text-sm text-gray-900">{funcionario.contrato.nome}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Cliente</label>
                <p className="mt-1 text-sm text-gray-900">{funcionario.contrato.cliente}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Número do Contrato</label>
                <p className="mt-1 text-sm text-gray-900">{funcionario.contrato.numero}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Informações do Sistema */}
      <div className="mt-6 bg-white rounded-lg shadow border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Informações do Sistema</h2>
          </div>
        </div>
        <div className="px-6 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Data de Criação</label>
              <p className="mt-1 text-sm text-gray-900">{formatDate(funcionario.criadoEm)}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Última Atualização</label>
              <p className="mt-1 text-sm text-gray-900">{formatDate(funcionario.atualizadoEm)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}