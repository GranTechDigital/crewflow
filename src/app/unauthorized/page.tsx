'use client';

import { useRouter } from 'next/navigation';
import { ShieldExclamationIcon, HomeIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';

export default function UnauthorizedPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="mb-6">
          <ShieldExclamationIcon className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Acesso Negado</h1>
          <p className="text-gray-600">
            Você não tem permissão para acessar esta página ou esta funcionalidade não está disponível para sua equipe.
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => router.push('/')}
            className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <HomeIcon className="w-4 h-4 mr-2" />
            Voltar ao Início
          </button>
          
          <button
            onClick={() => router.back()}
            className="w-full flex items-center justify-center px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
          >
            <ArrowLeftIcon className="w-4 h-4 mr-2" />
            Voltar à Página Anterior
          </button>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            Se você acredita que deveria ter acesso a esta página, entre em contato com o administrador do sistema.
          </p>
        </div>
      </div>
    </div>
  );
} 