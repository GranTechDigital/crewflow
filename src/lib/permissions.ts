// Sistema centralizado de permissões
export const PERMISSIONS = {
  // Permissões de administração
  ADMIN: 'admin', // Acesso total ao sistema
  MANAGE_USERS: 'gerenciar_usuarios',
  MANAGE_TEAMS: 'gerenciar_equipes',
  
  // Permissões de acesso por módulo
  ACCESS_FUNCIONARIOS: 'canAccessFuncionarios',
  ACCESS_PREST_SERV: 'canAccessPrestServ',
  ACCESS_PLANEJAMENTO: 'canAccessPlanejamento',
  ACCESS_LOGISTICA: 'canAccessLogistica',
  ACCESS_ADMIN: 'canAccessAdmin',
  ACCESS_RH: 'canAccessRH',
  ACCESS_TREINAMENTO: 'canAccessTreinamento',
  ACCESS_MEDICINA: 'canAccessMedicina',
} as const;

// Mapeamento de equipes para permissões
export const TEAM_PERMISSIONS: { [key: string]: string[] } = {
  'Administração': [
    PERMISSIONS.ADMIN,
    PERMISSIONS.ACCESS_FUNCIONARIOS,
    PERMISSIONS.ACCESS_PREST_SERV,
    PERMISSIONS.ACCESS_PLANEJAMENTO,
    PERMISSIONS.ACCESS_LOGISTICA,
    PERMISSIONS.ACCESS_ADMIN,
    PERMISSIONS.ACCESS_RH,
    PERMISSIONS.ACCESS_TREINAMENTO,
    PERMISSIONS.ACCESS_MEDICINA,
    PERMISSIONS.MANAGE_USERS,
    PERMISSIONS.MANAGE_TEAMS,
  ],
  'RH': [
    PERMISSIONS.ACCESS_FUNCIONARIOS,
    PERMISSIONS.ACCESS_RH,
  ],
  'Logística': [
    PERMISSIONS.ACCESS_FUNCIONARIOS,
    PERMISSIONS.ACCESS_LOGISTICA,
  ],
  'Planejamento': [
    PERMISSIONS.ACCESS_FUNCIONARIOS,
    PERMISSIONS.ACCESS_PLANEJAMENTO,
  ],
  'Prestserv': [
    PERMISSIONS.ACCESS_FUNCIONARIOS,
    PERMISSIONS.ACCESS_PREST_SERV,
  ],
  'Treinamento': [
    PERMISSIONS.ACCESS_FUNCIONARIOS,
    PERMISSIONS.ACCESS_TREINAMENTO,
  ],
  'Medicina': [
    PERMISSIONS.ACCESS_FUNCIONARIOS,
    PERMISSIONS.ACCESS_MEDICINA,
  ],
} as const;

// Função para obter permissões baseadas na equipe
export function getPermissionsByTeam(teamName: string): string[] {
  return TEAM_PERMISSIONS[teamName] || [PERMISSIONS.ACCESS_FUNCIONARIOS];
}

// Função para verificar se uma permissão é de administração
export function isAdminPermission(permission: string): boolean {
  return permission === PERMISSIONS.ADMIN;
}

// Função para verificar se um usuário tem acesso total (admin)
export function hasFullAccess(permissions: string[]): boolean {
  return permissions.includes(PERMISSIONS.ADMIN);
}

// Função para verificar se um usuário tem acesso a um módulo específico
export function hasModuleAccess(permissions: string[], modulePermission: string): boolean {
  return hasFullAccess(permissions) || permissions.includes(modulePermission);
}

// Configurações de proteção de rotas por módulo
export const ROUTE_PROTECTION = {
  // Administração
  ADMIN: {
    requiredEquipe: ['Administração'] as string[],
    requiredPermissions: [PERMISSIONS.ADMIN, PERMISSIONS.MANAGE_USERS] as string[],
  },
  
  // Prestserv
  PRESTSERV: {
    requiredEquipe: ['Logística', 'Prestserv', 'Administração'] as string[],
    requiredPermissions: [PERMISSIONS.ADMIN, PERMISSIONS.ACCESS_PREST_SERV] as string[],
  },
  
  // Logística
  LOGISTICA: {
    requiredEquipe: ['Logística', 'Administração'] as string[],
    requiredPermissions: [PERMISSIONS.ADMIN, PERMISSIONS.ACCESS_LOGISTICA] as string[],
  },
  
  // Planejamento
  PLANEJAMENTO: {
    requiredEquipe: ['Planejamento', 'Administração'] as string[],
    requiredPermissions: [PERMISSIONS.ADMIN, PERMISSIONS.ACCESS_PLANEJAMENTO] as string[],
  },

  // RH
  RH: {
    requiredEquipe: ['RH', 'Administração'] as string[],
    requiredPermissions: [PERMISSIONS.ADMIN, PERMISSIONS.ACCESS_RH] as string[],
  },

  // Treinamento
  TREINAMENTO: {
    requiredEquipe: ['Treinamento', 'Administração'] as string[],
    requiredPermissions: [PERMISSIONS.ADMIN, PERMISSIONS.ACCESS_TREINAMENTO] as string[],
  },

  FUNCIONARIOS: {
    requiredEquipe: ['RH', 'Administração', 'Logística', 'Planejamento', 'Prestserv', 'Treinamento', 'Medicina'] as string[],
    requiredPermissions: [PERMISSIONS.ADMIN, PERMISSIONS.ACCESS_FUNCIONARIOS] as string[],
  },

  MATRIZ_TREINAMENTO: {
    requiredEquipe: ['Administração', 'Logística', 'Treinamento'] as string[],
    requiredPermissions: [PERMISSIONS.ADMIN, PERMISSIONS.ACCESS_TREINAMENTO, PERMISSIONS.ACCESS_LOGISTICA] as string[],
  },
};