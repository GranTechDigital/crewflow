import React from 'react';
import { getStatusColor } from '../utils/statusColors';

interface StatusData {
  [status: string]: number;
}

interface StatusBadgesProps {
  statusCount: StatusData;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

const StatusBadges: React.FC<StatusBadgesProps> = ({ 
  statusCount, 
  size = 'xs',
  className = ''
}) => {
  // Filtrar apenas status com contagem > 0
  const activeStatuses = Object.entries(statusCount).filter(([_, count]) => count > 0);
  
  if (activeStatuses.length === 0) {
    return null;
  }

  const sizeClasses = {
    xs: 'px-1 py-0.5 text-[9px] min-w-[16px] h-4',
    sm: 'px-1.5 py-0.5 text-[10px] min-w-[18px] h-5',
    md: 'px-2 py-1 text-xs min-w-[20px] h-6'
  };

  return (
    <div className={`flex gap-0.5 flex-wrap ${className}`}>
      {activeStatuses.map(([status, count]) => {
        const colorClass = getStatusColor(status, 'badge');
        
        return (
          <span
            key={status}
            className={`inline-flex items-center rounded font-medium ${sizeClasses[size]} ${colorClass}`}
            title={`${status}: ${count} funcionário${count !== 1 ? 's' : ''}`}
          >
            {count}
          </span>
        );
      })}
    </div>
  );
};

export default StatusBadges;

// Componente específico para uso inline (uma linha)
export const InlineStatusBadges: React.FC<StatusBadgesProps> = (props) => {
  return <StatusBadges {...props} size="xs" />;
};

// Componente para exibição em bloco (múltiplas linhas se necessário)
export const BlockStatusBadges: React.FC<StatusBadgesProps> = (props) => {
  return <StatusBadges {...props} size="xs" className="mt-0.5" />;
};