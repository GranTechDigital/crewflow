'use client';

import { useState } from 'react';
import HistoricoRemanejamento from '@/components/HistoricoRemanejamento';
import Link from 'next/link';

export default function HistoricoRemanejamentosPage() {
  const [filtros, setFiltros] = useState({
    solicitacaoId: '',
    funcionarioId: '',
    entidade: '',
    tipoAcao: ''
  });

  const handleFiltroChange = (campo: string, valor: string) => {
    setFiltros(prev => ({
      ...prev,
      [campo]: valor
    }));
  };

  const limparFiltros = () => {
    setFiltros({
      solicitacaoId: '',
      funcionarioId: '',
      entidade: '',
      tipoAcao: ''
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                📋 Histórico de Remanejamentos
              </h1>
              <p className="text-gray-600">
                Acompanhe todas as ações realizadas nos remanejamentos de funcionários
              </p>
            </div>
            <div className="flex space-x-3">
              <Link
                href="/prestserv/remanejamentos"
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                📋 Remanejamentos
              </Link>
              <Link
                href="/prestserv/remanejamentos/tabela"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                📊 Tabela
              </Link>
              <Link
                href="/prestserv/dashboard"
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                🏠 Dashboard
              </Link>
            </div>
          </div>
        </div>

        {/* Filtros Específicos */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">🔍 Filtros Avançados</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ID da Solicitação
              </label>
              <input
                type="number"
                value={filtros.solicitacaoId}
                onChange={(e) => handleFiltroChange('solicitacaoId', e.target.value)}
                placeholder="Ex: 123"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ID do Funcionário
              </label>
              <input
                type="text"
                value={filtros.funcionarioId}
                onChange={(e) => handleFiltroChange('funcionarioId', e.target.value)}
                placeholder="Ex: func-123"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Entidade
              </label>
              <select
                value={filtros.entidade}
                onChange={(e) => handleFiltroChange('entidade', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todas as entidades</option>
                <option value="SOLICITACAO">📄 Solicitação</option>
                <option value="FUNCIONARIO">👤 Funcionário</option>
                <option value="TAREFA">📋 Tarefa</option>
                <option value="OBSERVACAO">💬 Observação</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Ação
              </label>
              <select
                value={filtros.tipoAcao}
                onChange={(e) => handleFiltroChange('tipoAcao', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos os tipos</option>
                <option value="CRIACAO">✅ Criação</option>
                <option value="ATUALIZACAO_STATUS">🔄 Atualização de Status</option>
                <option value="ATUALIZACAO_CAMPO">✏️ Atualização de Campo</option>
                <option value="EXCLUSAO">❌ Exclusão</option>
              </select>
            </div>
          </div>
          
          <div className="mt-4 flex space-x-2">
            <button
              onClick={limparFiltros}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
            >
              🗑️ Limpar Filtros
            </button>
          </div>
        </div>

        {/* Componente de Histórico */}
        <div className="bg-white rounded-lg shadow p-6">
          <HistoricoRemanejamento
            solicitacaoId={filtros.solicitacaoId ? parseInt(filtros.solicitacaoId) : undefined}
            remanejamentoFuncionarioId={filtros.funcionarioId || undefined}
            entidade={filtros.entidade || undefined}
            tipoAcao={filtros.tipoAcao || undefined}
            showFilters={false}
          />
        </div>

        {/* Informações Adicionais */}
        <div className="mt-8 bg-blue-50 rounded-lg p-6 border border-blue-200">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">ℹ️ Sobre o Histórico</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800">
            <div>
              <h4 className="font-medium mb-2">📊 Tipos de Ação:</h4>
              <ul className="space-y-1">
                <li>• <strong>Criação:</strong> Registro de novas solicitações ou funcionários</li>
                <li>• <strong>Atualização de Status:</strong> Mudanças de status nas tarefas ou prestserv</li>
                <li>• <strong>Atualização de Campo:</strong> Modificações em dados específicos</li>
                <li>• <strong>Exclusão:</strong> Remoção de registros</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">🏷️ Entidades:</h4>
              <ul className="space-y-1">
                <li>• <strong>Solicitação:</strong> Ações na solicitação de remanejamento</li>
                <li>• <strong>Funcionário:</strong> Ações relacionadas aos funcionários</li>
                <li>• <strong>Tarefa:</strong> Ações nas tarefas de remanejamento</li>
                <li>• <strong>Observação:</strong> Ações em observações e comentários</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}