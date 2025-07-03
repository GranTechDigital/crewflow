'use client';

import { useState } from 'react';
import HistoricoRemanejamento from '@/components/HistoricoRemanejamento';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';

export default function HistoricoPage() {
  const [filtros, setFiltros] = useState({
    solicitacaoId: '',
    remanejamentoFuncionarioId: '',
    entidade: '',
    tipoAcao: ''
  });

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link
                href="/remanejamento"
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <ArrowLeftIcon className="h-4 w-4 mr-2" />
                Voltar
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Histórico de Remanejamentos
                </h1>
                <p className="mt-2 text-sm text-gray-600">
                  Visualize todas as ações e alterações realizadas nos remanejamentos de funcionários
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filtros Rápidos */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Filtros</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label htmlFor="solicitacaoId" className="block text-sm font-medium text-gray-700 mb-1">
                ID da Solicitação
              </label>
              <input
                type="number"
                id="solicitacaoId"
                value={filtros.solicitacaoId}
                onChange={(e) => setFiltros(prev => ({ ...prev, solicitacaoId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ex: 123"
              />
            </div>

            <div>
              <label htmlFor="remanejamentoId" className="block text-sm font-medium text-gray-700 mb-1">
                ID do Remanejamento
              </label>
              <input
                type="text"
                id="remanejamentoId"
                value={filtros.remanejamentoFuncionarioId}
                onChange={(e) => setFiltros(prev => ({ ...prev, remanejamentoFuncionarioId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ex: abc123"
              />
            </div>

            <div>
              <label htmlFor="entidade" className="block text-sm font-medium text-gray-700 mb-1">
                Entidade
              </label>
              <select
                id="entidade"
                value={filtros.entidade}
                onChange={(e) => setFiltros(prev => ({ ...prev, entidade: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Todas</option>
                <option value="SOLICITACAO">Solicitação</option>
                <option value="FUNCIONARIO">Funcionário</option>
                <option value="TAREFA">Tarefa</option>
              </select>
            </div>

            <div>
              <label htmlFor="tipoAcao" className="block text-sm font-medium text-gray-700 mb-1">
                Tipo de Ação
              </label>
              <select
                id="tipoAcao"
                value={filtros.tipoAcao}
                onChange={(e) => setFiltros(prev => ({ ...prev, tipoAcao: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Todas</option>
                <option value="CRIACAO">Criação</option>
                <option value="ATUALIZACAO_STATUS">Atualização de Status</option>
                <option value="ATUALIZACAO_CAMPO">Atualização de Campo</option>
                <option value="EXCLUSAO">Exclusão</option>
              </select>
            </div>
          </div>
        </div>

        {/* Componente de Histórico */}
        <div className="bg-white shadow rounded-lg">
          <HistoricoRemanejamento
            solicitacaoId={filtros.solicitacaoId ? parseInt(filtros.solicitacaoId) : undefined}
            remanejamentoFuncionarioId={filtros.remanejamentoFuncionarioId || undefined}
            entidade={filtros.entidade || undefined}
            tipoAcao={filtros.tipoAcao || undefined}
            showFilters={false}
          />
        </div>
      </div>
    </div>
  );
}