// app/page.tsx
import Link from 'next/link';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function Home() {
  return (
    <ProtectedRoute 
      requiredEquipe={['LOGISTICA', 'PRESTSERV', 'Administração']}
      requiredPermissions={['admin', 'canAccessPrestServ']}
    >
      <HomeContent />
    </ProtectedRoute>
  );
}

function HomeContent() {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Logística - Geral</h1>
          <p className="text-gray-600">Central de controle e monitoramento de remanejamentos</p>
        </div>

        {/* Cards de Navegação */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Dashboard */}
          <Link
            href="/prestserv/dashboard"
            className="block bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6 border-l-4 border-blue-500"
          >
            <div className="flex items-center mb-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 ml-3">Dashboard</h2>
            </div>
            <p className="text-gray-600 mb-4">
              Visão geral dos remanejamentos, estatísticas e funcionários que precisam de atenção.
            </p>
            <div className="flex items-center text-blue-600 font-medium">
              Acessar Dashboard
              <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>

          {/* Remanejamentos */}
          <Link
            href="/prestserb/remanejamentos"
            className="block bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6 border-l-4 border-green-500"
          >
            <div className="flex items-center mb-4">
              <div className="p-2 bg-green-100 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 ml-3">Remanejamentos</h2>
            </div>
            <p className="text-gray-600 mb-4">
              Lista completa de solicitações de remanejamento com filtros e controles avançados.
            </p>
            <div className="flex items-center text-green-600 font-medium">
              Ver Remanejamentos
              <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>

          {/* Minhas Demandas */}
          <Link
            href="/prestserv/minhas-demandas"
            className="block bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6 border-l-4 border-purple-500"
          >
            <div className="flex items-center mb-4">
              <div className="p-2 bg-purple-100 rounded-lg">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 ml-3">Minhas Demandas</h2>
            </div>
            <p className="text-gray-600 mb-4">
              Tarefas e demandas específicas atribuídas ao usuário logado.
            </p>
            <div className="flex items-center text-purple-600 font-medium">
              Ver Minhas Demandas
              <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>
        </div>

        {/* Seção de Estatísticas Rápidas */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Acesso Rápido</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Funcionalidades */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Funcionalidades Principais</h3>
              <ul className="space-y-3">
                <li className="flex items-center text-gray-700">
                  <svg className="w-5 h-5 text-green-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Controle manual do status Prestserv
                </li>
                <li className="flex items-center text-gray-700">
                  <svg className="w-5 h-5 text-green-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Gerenciamento de tarefas por funcionário
                </li>
                <li className="flex items-center text-gray-700">
                  <svg className="w-5 h-5 text-green-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Monitoramento de prazos e alertas
                </li>
                <li className="flex items-center text-gray-700">
                  <svg className="w-5 h-5 text-green-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Filtros avançados e relatórios
                </li>
              </ul>
            </div>

            {/* Fluxo de Trabalho */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Fluxo de Trabalho</h3>
              <div className="space-y-3">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium mr-3">
                    1
                  </div>
                  <span className="text-gray-700">Solicitação de remanejamento criada</span>
                </div>
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center text-sm font-medium mr-3">
                    2
                  </div>
                  <span className="text-gray-700">Tarefas criadas para cada funcionário</span>
                </div>
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center text-sm font-medium mr-3">
                    3
                  </div>
                  <span className="text-gray-700">Conclusão das tarefas pelos setores</span>
                </div>
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-sm font-medium mr-3">
                    4
                  </div>
                  <span className="text-gray-700">Controle manual do Prestserv</span>
                </div>
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm font-medium mr-3">
                    5
                  </div>
                  <span className="text-gray-700">Remanejamento concluído</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
