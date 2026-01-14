// Sistema centralizado de permissões
export const PERMISSIONS = {
  // Permissões de administração
  ADMIN: "admin", // Acesso total ao sistema
  MANAGE_USERS: "gerenciar_usuarios",
  MANAGE_TEAMS: "gerenciar_equipes",

  // Permissões de acesso por módulo
  ACCESS_FUNCIONARIOS: "canAccessFuncionarios",
  ACCESS_PREST_SERV: "canAccessPrestServ",
  ACCESS_PLANEJAMENTO: "canAccessPlanejamento",
  ACCESS_PLANEJAMENTO_VISUALIZADOR: "canAccessPlanejamentoVisualizador",
  ACCESS_PLANEJAMENTO_GESTOR: "canAccessPlanejamentoGestor",

  ACCESS_LOGISTICA: "canAccessLogistica",
  ACCESS_LOGISTICA_VISUALIZADOR: "canAccessLogisticaVisualizador",
  ACCESS_LOGISTICA_GESTOR: "canAccessLogisticaGestor",

  ACCESS_PREST_SERV: "canAccessPrestServ",
  ACCESS_PREST_SERV_VISUALIZADOR: "canAccessPrestServVisualizador",
  ACCESS_PREST_SERV_GESTOR: "canAccessPrestServGestor",

  ACCESS_ADMIN: "canAccessAdmin",

  ACCESS_RH: "canAccessRH",
  ACCESS_RH_VISUALIZADOR: "canAccessRHVisualizador",
  ACCESS_RH_GESTOR: "canAccessRHGestor",

  ACCESS_TREINAMENTO: "canAccessTreinamento",
  ACCESS_TREINAMENTO_VISUALIZADOR: "canAccessTreinamentoVisualizador",
  ACCESS_TREINAMENTO_GESTOR: "canAccessTreinamentoGestor",

  ACCESS_MEDICINA: "canAccessMedicina",
  ACCESS_MEDICINA_VISUALIZADOR: "canAccessMedicinaVisualizador",
  ACCESS_MEDICINA_GESTOR: "canAccessMedicinaGestor",
} as const;

// Mapeamento de equipes para permissões
export const TEAM_PERMISSIONS: { [key: string]: string[] } = {
  Administração: [
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
  "Administração (Visualizador)": [
    PERMISSIONS.ACCESS_FUNCIONARIOS,
    PERMISSIONS.ACCESS_PREST_SERV_VISUALIZADOR,
    PERMISSIONS.ACCESS_PLANEJAMENTO_VISUALIZADOR,
    PERMISSIONS.ACCESS_LOGISTICA_VISUALIZADOR,
    PERMISSIONS.ACCESS_RH_VISUALIZADOR,
    PERMISSIONS.ACCESS_TREINAMENTO_VISUALIZADOR,
    PERMISSIONS.ACCESS_MEDICINA_VISUALIZADOR,
  ],

  // RH
  RH: [PERMISSIONS.ACCESS_FUNCIONARIOS, PERMISSIONS.ACCESS_RH],
  "RH (Editor)": [PERMISSIONS.ACCESS_FUNCIONARIOS, PERMISSIONS.ACCESS_RH],
  "RH (Visualizador)": [
    PERMISSIONS.ACCESS_FUNCIONARIOS,
    PERMISSIONS.ACCESS_RH_VISUALIZADOR,
  ],
  "RH (Gestor)": [
    PERMISSIONS.ACCESS_FUNCIONARIOS,
    PERMISSIONS.ACCESS_RH,
    PERMISSIONS.ACCESS_RH_GESTOR,
  ],

  // Logística
  Logística: [
    PERMISSIONS.ACCESS_FUNCIONARIOS,
    PERMISSIONS.ACCESS_LOGISTICA,
    PERMISSIONS.ACCESS_PREST_SERV,
  ],
  "Logística (Editor)": [
    PERMISSIONS.ACCESS_FUNCIONARIOS,
    PERMISSIONS.ACCESS_LOGISTICA,
    PERMISSIONS.ACCESS_PREST_SERV,
  ],
  "Logística (Visualizador)": [
    PERMISSIONS.ACCESS_FUNCIONARIOS,
    PERMISSIONS.ACCESS_LOGISTICA_VISUALIZADOR,
    PERMISSIONS.ACCESS_PREST_SERV_VISUALIZADOR,
  ],
  "Liderança (Visualizador)": [
    PERMISSIONS.ACCESS_FUNCIONARIOS,
    PERMISSIONS.ACCESS_LOGISTICA_VISUALIZADOR,
    PERMISSIONS.ACCESS_PREST_SERV_VISUALIZADOR,
  ],
  "Logística (Gestor)": [
    PERMISSIONS.ACCESS_FUNCIONARIOS,
    PERMISSIONS.ACCESS_LOGISTICA,
    PERMISSIONS.ACCESS_PREST_SERV,
    PERMISSIONS.ACCESS_LOGISTICA_GESTOR,
    PERMISSIONS.ACCESS_PREST_SERV_GESTOR,
  ],

  // Planejamento
  Planejamento: [
    PERMISSIONS.ACCESS_FUNCIONARIOS,
    PERMISSIONS.ACCESS_PLANEJAMENTO,
  ],
  "Planejamento (Editor)": [
    PERMISSIONS.ACCESS_FUNCIONARIOS,
    PERMISSIONS.ACCESS_PLANEJAMENTO,
  ],
  "Planejamento (Visualizador)": [
    PERMISSIONS.ACCESS_FUNCIONARIOS,
    PERMISSIONS.ACCESS_PLANEJAMENTO_VISUALIZADOR,
  ],
  "Planejamento (Gestor)": [
    PERMISSIONS.ACCESS_FUNCIONARIOS,
    PERMISSIONS.ACCESS_PLANEJAMENTO,
    PERMISSIONS.ACCESS_PLANEJAMENTO_GESTOR,
  ],

  // Prestserv
  Prestserv: [PERMISSIONS.ACCESS_FUNCIONARIOS, PERMISSIONS.ACCESS_PREST_SERV],
  "Prestserv (Editor)": [
    PERMISSIONS.ACCESS_FUNCIONARIOS,
    PERMISSIONS.ACCESS_PREST_SERV,
  ],
  "Prestserv (Visualizador)": [
    PERMISSIONS.ACCESS_FUNCIONARIOS,
    PERMISSIONS.ACCESS_PREST_SERV_VISUALIZADOR,
  ],
  "Prestserv (Gestor)": [
    PERMISSIONS.ACCESS_FUNCIONARIOS,
    PERMISSIONS.ACCESS_PREST_SERV,
    PERMISSIONS.ACCESS_PREST_SERV_GESTOR,
  ],

  // Treinamento
  Treinamento: [
    PERMISSIONS.ACCESS_FUNCIONARIOS,
    PERMISSIONS.ACCESS_TREINAMENTO,
  ],
  "Treinamento (Editor)": [
    PERMISSIONS.ACCESS_FUNCIONARIOS,
    PERMISSIONS.ACCESS_TREINAMENTO,
  ],
  "Treinamento (Visualizador)": [
    PERMISSIONS.ACCESS_FUNCIONARIOS,
    PERMISSIONS.ACCESS_TREINAMENTO_VISUALIZADOR,
  ],
  "Treinamento (Gestor)": [
    PERMISSIONS.ACCESS_FUNCIONARIOS,
    PERMISSIONS.ACCESS_TREINAMENTO,
    PERMISSIONS.ACCESS_TREINAMENTO_GESTOR,
  ],

  // Medicina
  Medicina: [PERMISSIONS.ACCESS_FUNCIONARIOS, PERMISSIONS.ACCESS_MEDICINA],
  "Medicina (Editor)": [
    PERMISSIONS.ACCESS_FUNCIONARIOS,
    PERMISSIONS.ACCESS_MEDICINA,
  ],
  "Medicina (Visualizador)": [
    PERMISSIONS.ACCESS_FUNCIONARIOS,
    PERMISSIONS.ACCESS_MEDICINA_VISUALIZADOR,
  ],
  "Medicina (Gestor)": [
    PERMISSIONS.ACCESS_FUNCIONARIOS,
    PERMISSIONS.ACCESS_MEDICINA,
    PERMISSIONS.ACCESS_MEDICINA_GESTOR,
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
export function hasModuleAccess(
  permissions: string[],
  modulePermission: string
): boolean {
  return hasFullAccess(permissions) || permissions.includes(modulePermission);
}

// Configurações de proteção de rotas por módulo
export const ROUTE_PROTECTION = {
  // Administração
  ADMIN: {
    requiredEquipe: ["Administração"] as string[],
    requiredPermissions: [
      PERMISSIONS.ADMIN,
      PERMISSIONS.MANAGE_USERS,
    ] as string[],
  },

  // Prestserv
  PRESTSERV: {
    requiredEquipe: [
      "Logística",
      "Logística (Gestor)",
      "Logística (Editor)",
      "Logística (Visualizador)",
      "Liderança (Visualizador)",
      "Prestserv",
      "Prestserv (Gestor)",
      "Prestserv (Editor)",
      "Prestserv (Visualizador)",
      "Administração",
    ] as string[],
    requiredPermissions: [
      PERMISSIONS.ADMIN,
      PERMISSIONS.ACCESS_PREST_SERV,
      PERMISSIONS.ACCESS_PREST_SERV_VISUALIZADOR,
      PERMISSIONS.ACCESS_PREST_SERV_GESTOR,
    ] as string[],
  },

  // Logística
  LOGISTICA: {
    requiredEquipe: [
      "Logística",
      "Logística (Gestor)",
      "Logística (Editor)",
      "Logística (Visualizador)",
      "Liderança (Visualizador)",
      "Administração",
    ] as string[],
    requiredPermissions: [
      PERMISSIONS.ADMIN,
      PERMISSIONS.ACCESS_LOGISTICA,
      PERMISSIONS.ACCESS_LOGISTICA_VISUALIZADOR,
      PERMISSIONS.ACCESS_LOGISTICA_GESTOR,
    ] as string[],
  },

  // Planejamento
  PLANEJAMENTO: {
    requiredEquipe: [
      "Planejamento",
      "Planejamento (Gestor)",
      "Planejamento (Editor)",
      "Planejamento (Visualizador)",
      "Administração",
    ] as string[],
    requiredPermissions: [
      PERMISSIONS.ADMIN,
      PERMISSIONS.ACCESS_PLANEJAMENTO,
      PERMISSIONS.ACCESS_PLANEJAMENTO_VISUALIZADOR,
      PERMISSIONS.ACCESS_PLANEJAMENTO_GESTOR,
    ] as string[],
  },

  // RH
  RH: {
    requiredEquipe: [
      "RH",
      "RH (Gestor)",
      "RH (Editor)",
      "RH (Visualizador)",
      "Administração",
    ] as string[],
    requiredPermissions: [
      PERMISSIONS.ADMIN,
      PERMISSIONS.ACCESS_RH,
      PERMISSIONS.ACCESS_RH_VISUALIZADOR,
      PERMISSIONS.ACCESS_RH_GESTOR,
    ] as string[],
  },

  // Treinamento
  TREINAMENTO: {
    requiredEquipe: [
      "Treinamento",
      "Treinamento (Gestor)",
      "Treinamento (Editor)",
      "Treinamento (Visualizador)",
      "Administração",
    ] as string[],
    requiredPermissions: [
      PERMISSIONS.ADMIN,
      PERMISSIONS.ACCESS_TREINAMENTO,
      PERMISSIONS.ACCESS_TREINAMENTO_VISUALIZADOR,
      PERMISSIONS.ACCESS_TREINAMENTO_GESTOR,
    ] as string[],
  },

  // Proteção para criação de remanejamentos (apenas editores e gestores)
  NOVO_REMANEJAMENTO: {
    requiredEquipe: [
      "Planejamento",
      "Planejamento (Gestor)",
      "Planejamento (Editor)",
      "Logística",
      "Logística (Gestor)",
      "Logística (Editor)",
      "Prestserv",
      "Prestserv (Gestor)",
      "Prestserv (Editor)",
      "Administração",
    ] as string[],
    requiredPermissions: [
      PERMISSIONS.ADMIN,
      PERMISSIONS.ACCESS_PLANEJAMENTO,
      PERMISSIONS.ACCESS_LOGISTICA,
      PERMISSIONS.ACCESS_PREST_SERV,
    ] as string[],
  },

  FUNCIONARIOS: {
    requiredEquipe: [
      "RH",
      "RH (Gestor)",
      "RH (Editor)",
      "RH (Visualizador)",
      "Administração",
      "Logística",
      "Logística (Gestor)",
      "Logística (Editor)",
      "Logística (Visualizador)",
      "Liderança (Visualizador)",
      "Planejamento",
      "Planejamento (Gestor)",
      "Planejamento (Editor)",
      "Planejamento (Visualizador)",
      "Prestserv",
      "Prestserv (Gestor)",
      "Prestserv (Editor)",
      "Prestserv (Visualizador)",
      "Treinamento",
      "Treinamento (Gestor)",
      "Treinamento (Editor)",
      "Treinamento (Visualizador)",
      "Medicina",
      "Medicina (Gestor)",
      "Medicina (Editor)",
      "Medicina (Visualizador)",
    ] as string[],
    requiredPermissions: [
      PERMISSIONS.ADMIN,
      PERMISSIONS.ACCESS_FUNCIONARIOS,
    ] as string[],
  },

  MATRIZ_TREINAMENTO: {
    requiredEquipe: [
      "Administração",
      "Logística",
      "Logística (Gestor)",
      "Logística (Editor)",
      "Logística (Visualizador)",
      "Liderança (Visualizador)",
      "Treinamento",
      "Treinamento (Gestor)",
      "Treinamento (Editor)",
      "Treinamento (Visualizador)",
    ] as string[],
    requiredPermissions: [
      PERMISSIONS.ADMIN,
      PERMISSIONS.ACCESS_TREINAMENTO,
      PERMISSIONS.ACCESS_TREINAMENTO_VISUALIZADOR,
      PERMISSIONS.ACCESS_TREINAMENTO_GESTOR,
      PERMISSIONS.ACCESS_LOGISTICA,
      PERMISSIONS.ACCESS_LOGISTICA_VISUALIZADOR,
      PERMISSIONS.ACCESS_LOGISTICA_GESTOR,
    ] as string[],
  },
};
