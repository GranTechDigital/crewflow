// Utilitário centralizado para cores de status
// Garante consistência visual em todo o sistema

export interface StatusColorConfig {
  background: string;
  text: string;
  ring?: string;
}

// Mapeamento completo de cores para cada status
export const STATUS_COLORS: Record<string, StatusColorConfig> = {
  // Status ativo
  'ativo': {
    background: 'bg-emerald-100',
    text: 'text-emerald-700',
    ring: 'ring-emerald-600/20'
  },
  
  // Status de férias
  'férias': {
    background: 'bg-sky-100',
    text: 'text-sky-700',
    ring: 'ring-sky-600/20'
  },
  
  // Status de afastamentos previdenciários
  'af.previdência': {
    background: 'bg-amber-100',
    text: 'text-amber-700',
    ring: 'ring-amber-600/20'
  },
  
  // Status de afastamento por acidente de trabalho
  'af.ac.trabalho': {
    background: 'bg-orange-100',
    text: 'text-orange-700',
    ring: 'ring-orange-600/20'
  },
  
  // Status de licenças
  'licença mater.': {
    background: 'bg-pink-100',
    text: 'text-pink-700',
    ring: 'ring-pink-600/20'
  },
  
  'licença s/venc': {
    background: 'bg-purple-100',
    text: 'text-purple-700',
    ring: 'ring-purple-600/20'
  },
  
  // Status final
  'demitido': {
    background: 'bg-slate-100',
    text: 'text-slate-700',
    ring: 'ring-slate-600/20'
  },
  
  // Status genéricos (para compatibilidade)
  'inativo': {
    background: 'bg-red-100',
    text: 'text-red-700',
    ring: 'ring-red-600/20'
  },
  
  'afastado': {
    background: 'bg-yellow-100',
    text: 'text-yellow-700',
    ring: 'ring-yellow-600/20'
  },
  
  'licença': {
    background: 'bg-cyan-100',
    text: 'text-cyan-700',
    ring: 'ring-cyan-600/20'
  },
  
  'suspenso': {
    background: 'bg-rose-100',
    text: 'text-rose-700',
    ring: 'ring-rose-600/20'
  },
  
  // Status de transição
  'admissão': {
    background: 'bg-violet-100',
    text: 'text-violet-700',
    ring: 'ring-violet-600/20'
  },
  
  'admissão prox.mês': {
    background: 'bg-indigo-100',
    text: 'text-indigo-700',
    ring: 'ring-indigo-600/20'
  },
  
  'treinamento': {
    background: 'bg-blue-100',
    text: 'text-blue-700',
    ring: 'ring-blue-600/20'
  },
  
  'transferido': {
    background: 'bg-teal-100',
    text: 'text-teal-700',
    ring: 'ring-teal-600/20'
  },
  
  'aposentado': {
    background: 'bg-stone-100',
    text: 'text-stone-700',
    ring: 'ring-stone-600/20'
  },
  
  // Status padrão
  'sem status': {
    background: 'bg-gray-100',
    text: 'text-gray-700',
    ring: 'ring-gray-600/20'
  }
};

/**
 * Retorna as classes CSS para um status específico
 * @param status - O status do funcionário
 * @param variant - Variante do estilo ('default' | 'badge' | 'modal')
 * @returns String com as classes CSS do Tailwind
 */
export function getStatusColor(status: string | undefined, variant: 'default' | 'badge' | 'modal' = 'default'): string {
  if (!status) {
    return getStatusColorClasses('sem status', variant);
  }
  
  const statusLower = status.toLowerCase().trim();
  
  // Busca exata primeiro
  if (STATUS_COLORS[statusLower]) {
    return getStatusColorClasses(statusLower, variant);
  }
  
  // Busca por inclusão para casos como "admissão prox.mês"
  const matchedStatus = Object.keys(STATUS_COLORS).find(key => 
    statusLower.includes(key) || key.includes(statusLower)
  );
  
  if (matchedStatus) {
    return getStatusColorClasses(matchedStatus, variant);
  }
  
  // Fallback para status desconhecido
  return getStatusColorClasses('sem status', variant);
}

/**
 * Gera as classes CSS baseadas no status e variante
 */
function getStatusColorClasses(statusKey: string, variant: 'default' | 'badge' | 'modal'): string {
  const config = STATUS_COLORS[statusKey];
  
  if (!config) {
    return STATUS_COLORS['sem status'].background + ' ' + STATUS_COLORS['sem status'].text;
  }
  
  switch (variant) {
    case 'badge':
      return `${config.background} ${config.text}`;
    
    case 'modal':
      return `${config.background.replace('-100', '-50')} ${config.text} ring-1 ring-inset ${config.ring || 'ring-gray-600/20'}`;
    
    case 'default':
    default:
      return `${config.background} ${config.text.replace('-700', '-800')}`;
  }
}

/**
 * Retorna todos os status disponíveis
 */
export function getAllStatusOptions(): string[] {
  return Object.keys(STATUS_COLORS).filter(status => status !== 'sem status');
}

/**
 * Retorna a configuração de cor para um status
 */
export function getStatusConfig(status: string): StatusColorConfig {
  const statusLower = status?.toLowerCase().trim() || 'sem status';
  return STATUS_COLORS[statusLower] || STATUS_COLORS['sem status'];
}