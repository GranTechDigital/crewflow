'use client';

import { useAuth, usePermissions } from '@/app/hooks/useAuth';

export default function DebugPermissions() {
  const { usuario, loading } = useAuth();
  const { hasPermission, hasAnyPermission, permissions } = usePermissions();

  if (loading) {
    return <div className="p-4 bg-yellow-100 border border-yellow-300 rounded">Carregando...</div>;
  }

  if (!usuario) {
    return <div className="p-4 bg-red-100 border border-red-300 rounded">Usuário não logado</div>;
  }

  return (
    <div className="p-4 bg-blue-100 border border-blue-300 rounded mb-4">
      <h3 className="font-bold mb-2">Debug - Permissões do Usuário</h3>
      <div className="text-sm space-y-1">
        <p><strong>Nome:</strong> {usuario.nome}</p>
        <p><strong>Matrícula:</strong> {usuario.matricula}</p>
        <p><strong>Equipe:</strong> {usuario.equipe}</p>
        <p><strong>Permissões:</strong> {permissions.join(', ')}</p>
        <p><strong>Tem admin:</strong> {hasPermission('admin') ? 'Sim' : 'Não'}</p>
        <p><strong>Tem canAccessPrestServ:</strong> {hasPermission('canAccessPrestServ') ? 'Sim' : 'Não'}</p>
        <p><strong>Tem canAccessLogistica:</strong> {hasPermission('canAccessLogistica') ? 'Sim' : 'Não'}</p>
        <p><strong>Tem canAccessPlanejamento:</strong> {hasPermission('canAccessPlanejamento') ? 'Sim' : 'Não'}</p>
      </div>
    </div>
  );
} 