// Utilitário para bordas laterais baseadas em status
// Complementa o sistema de cores de status

import { STATUS_COLORS } from './statusColors';

/**
 * Mapeamento de cores de status para classes de borda lateral
 */
const STATUS_BORDER_MAPPING: Record<string, string> = {
  // Status específicos do sistema
  'ativo': 'border-l-4 border-l-emerald-500',
  'férias': 'border-l-4 border-l-sky-500',
  'af.previdência': 'border-l-4 border-l-amber-500',
  'af.ac.trabalho': 'border-l-4 border-l-orange-500',
  'licença mater.': 'border-l-4 border-l-pink-500',
  'licença s/venc': 'border-l-4 border-l-purple-500',
  'demitido': 'border-l-4 border-l-slate-500',
  
  // Status genéricos (compatibilidade)
  'inativo': 'border-l-4 border-l-red-500',
  'afastado': 'border-l-4 border-l-yellow-500',
  'licença': 'border-l-4 border-l-cyan-500',
  'suspenso': 'border-l-4 border-l-rose-500',
  'admissão': 'border-l-4 border-l-violet-500',
  'admissão prox.mês': 'border-l-4 border-l-indigo-500',
  'treinamento': 'border-l-4 border-l-blue-500',
  'transferido': 'border-l-4 border-l-teal-500',
  'aposentado': 'border-l-4 border-l-stone-500',
  
  // Padrão
  'sem status': 'border-l-4 border-l-gray-500'
};

/**
 * Retorna as classes CSS para borda lateral baseada no status
 * @param status - O status do funcionário
 * @returns String com as classes CSS do Tailwind para borda lateral
 */
export function getStatusBorder(status: string | undefined): string {
  if (!status) {
    return STATUS_BORDER_MAPPING['sem status'];
  }
  
  const statusLower = status.toLowerCase().trim();
  
  // Busca exata primeiro
  if (STATUS_BORDER_MAPPING[statusLower]) {
    return STATUS_BORDER_MAPPING[statusLower];
  }
  
  // Busca por inclusão para casos como "admissão prox.mês"
  const matchedStatus = Object.keys(STATUS_BORDER_MAPPING).find(key => 
    statusLower.includes(key) || key.includes(statusLower)
  );
  
  if (matchedStatus) {
    return STATUS_BORDER_MAPPING[matchedStatus];
  }
  
  // Fallback para status desconhecido
  return STATUS_BORDER_MAPPING['sem status'];
}

/**
 * Retorna todos os status com suas respectivas classes de borda
 */
export function getAllStatusBorders(): Record<string, string> {
  return { ...STATUS_BORDER_MAPPING };
}

/**
 * Verifica se um status tem borda definida
 */
export function hasStatusBorder(status: string): boolean {
  const statusLower = status?.toLowerCase().trim();
  return statusLower ? STATUS_BORDER_MAPPING.hasOwnProperty(statusLower) : false;
}