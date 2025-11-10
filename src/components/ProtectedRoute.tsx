'use client';

import { useAuth, usePermissions } from '@/app/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermissions?: string[];
  requiredEquipe?: string[];
  fallback?: React.ReactNode;
}

export default function ProtectedRoute({ 
  children, 
  requiredPermissions = [], 
  requiredEquipe = [],
  fallback 
}: ProtectedRouteProps) {
  const { usuario, loading } = useAuth();
  const { hasAnyPermission } = usePermissions();
  const router = useRouter();

  const normalize = (str: string) =>
    str
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  useEffect(() => {
    if (!loading) {
      // Se não há usuário, redirecionar para login
      if (!usuario) {
        router.push('/login');
        return;
      }

      // Verificar permissões se especificadas
      if (requiredPermissions.length > 0 && !hasAnyPermission(requiredPermissions)) {
        // Não navegar para /unauthorized; deixar o fallback/inlined UI assumir
        return;
      }

      // Verificar equipe se especificada (comparação normalizada, case/acentos-insensível)
      if (requiredEquipe.length > 0) {
        const equipesNormalizadas = requiredEquipe.map(normalize);
        const usuarioEquipeNormalizada = normalize(usuario.equipe);
        if (!equipesNormalizadas.includes(usuarioEquipeNormalizada)) {
          // Não navegar para /unauthorized; deixar o fallback/inlined UI assumir
          return;
        }
      }
    }
  }, [usuario, loading, requiredPermissions, requiredEquipe, hasAnyPermission, router]);

  // Mostrar loading enquanto verifica autenticação
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  // Se não há usuário, não renderizar nada (será redirecionado)
  if (!usuario) {
    return null;
  }

  // Verificar permissões
  if (requiredPermissions.length > 0 && !hasAnyPermission(requiredPermissions)) {
    return fallback || (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">❌ Acesso Negado</div>
          <p className="text-gray-600">Você não tem permissão para acessar esta página.</p>
          <button 
            onClick={() => router.push('/')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Voltar ao Início
          </button>
        </div>
      </div>
    );
  }

  // Verificar equipe (comparação normalizada)
  if (requiredEquipe.length > 0) {
    const equipesNormalizadas = requiredEquipe.map(normalize);
    const usuarioEquipeNormalizada = normalize(usuario.equipe);
    if (!equipesNormalizadas.includes(usuarioEquipeNormalizada)) {
      return fallback || (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="text-red-600 text-xl mb-4">❌ Acesso Negado</div>
            <p className="text-gray-600">Esta página é restrita para sua equipe.</p>
            <button 
              onClick={() => router.push('/')}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Voltar ao Início
            </button>
          </div>
        </div>
      );
    }
  }

  // Se passou por todas as verificações, renderizar o conteúdo
  return <>{children}</>;
}