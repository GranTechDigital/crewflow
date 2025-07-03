'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  UserGroupIcon,
  DocumentTextIcon,
  ChartBarIcon,
  ClockIcon as HistoryIcon
} from '@heroicons/react/24/outline';

interface DashboardStats {
  totalSolicitacoes: number;
  pendentes: number;
  aprovadas: number;
  rejeitadas: number;
  emAndamento: number;
}

export default function RemanejamentoDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalSolicitacoes: 0,
    pendentes: 0,
    aprovadas: 0,
    rejeitadas: 0,
    emAndamento: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      // Simular dados por enquanto - pode ser conectado a uma API real
      setTimeout(() => {
        setStats({
          totalSolicitacoes: 45,
          pendentes: 12,
          aprovadas: 28,
          rejeitadas: 3,
          emAndamento: 2
        });
        setLoading(false);
      }, 1000);
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
      setLoading(false);
    }
  };

  const cards = [
    {
      title: 'Total de Solicitações',
      value: stats.totalSolicitacoes,
      icon: DocumentTextIcon,
      color: 'bg-blue-500',
      textColor: 'text-blue-600'
    },
    {
      title: 'Pendentes',
      value: stats.pendentes,
      icon: ClockIcon,
      color: 'bg-yellow-500',
      textColor: 'text-yellow-600'
    },
    {
      title: 'Aprovadas',
      value: stats.aprovadas,
      icon: CheckCircleIcon,
      color: 'bg-green-500',
      textColor: 'text-green-600'
    },
    {
      title: 'Em Andamento',
      value: stats.emAndamento,
      icon: ExclamationTriangleIcon,
      color: 'bg-orange-500',
      textColor: 'text-orange-600'
    }
  ];

  const menuItems = [
    {
      title: 'Planejamento',
      description: 'Gerenciar solicitações de remanejamento',
      href: '/planejamento/remanejamentos',
      icon: UserGroupIcon,
      color: 'bg-blue-500'
    },
    {
      title: 'Prestação de Serviços',
      description: 'Acompanhar remanejamentos em execução',
      href: '/prestserv/remanejamentos',
      icon: ChartBarIcon,
      color: 'bg-green-500'
    },
    {
      title: 'Histórico de Ações',
      description: 'Visualizar histórico completo de alterações',
      href: '/remanejamento/historico',
      icon: HistoryIcon,
      color: 'bg-purple-500'
    }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Dashboard de Remanejamentos
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Gerencie e acompanhe todos os remanejamentos de funcionários
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {cards.map((card, index) => {
            const Icon = card.icon;
            return (
              <div key={index} className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className={`${card.color} p-3 rounded-md`}>
                        <Icon className="h-6 w-6 text-white" />
                      </div>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          {card.title}
                        </dt>
                        <dd className={`text-lg font-medium ${card.textColor}`}>
                          {card.value}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Menu de Navegação */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">
              Módulos de Remanejamento
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Acesse as diferentes áreas do sistema de remanejamento
            </p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {menuItems.map((item, index) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={index}
                    href={item.href}
                    className="group relative bg-white p-6 border border-gray-200 rounded-lg hover:border-gray-300 hover:shadow-md transition-all duration-200"
                  >
                    <div className="flex items-center space-x-4">
                      <div className={`${item.color} p-3 rounded-lg group-hover:scale-110 transition-transform duration-200`}>
                        <Icon className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-medium text-gray-900 group-hover:text-blue-600 transition-colors duration-200">
                          {item.title}
                        </h3>
                        <p className="mt-1 text-sm text-gray-500">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* Ações Recentes */}
        <div className="mt-8 bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900">
                Ações Recentes
              </h2>
              <Link
                href="/remanejamento/historico"
                className="text-sm text-blue-600 hover:text-blue-500"
              >
                Ver histórico completo →
              </Link>
            </div>
          </div>
          <div className="p-6">
            <div className="text-center py-8">
              <HistoryIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                Histórico de Ações
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Visualize todas as alterações e ações realizadas nos remanejamentos
              </p>
              <div className="mt-6">
                <Link
                  href="/remanejamento/historico"
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <HistoryIcon className="-ml-1 mr-2 h-5 w-5" />
                  Acessar Histórico
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}