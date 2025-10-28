import React from 'react';
import { getStatusColor } from '../utils/statusColors';

interface StatusData {
  [status: string]: number;
}

interface StatusChartProps {
  statusCount: StatusData;
  totalFuncionarios: number;
  showLabels?: boolean;
  height?: 'sm' | 'md' | 'lg';
}

const StatusChart: React.FC<StatusChartProps> = ({ 
  statusCount, 
  totalFuncionarios, 
  showLabels = false,
  height = 'sm'
}) => {
  // Filtrar apenas status com contagem > 0
  const activeStatuses = Object.entries(statusCount).filter(([_, count]) => count > 0);
  
  if (activeStatuses.length === 0) {
    return (
      <div className="text-xs text-gray-400 italic">
        Nenhum funcionário
      </div>
    );
  }

  const heightClasses = {
    sm: 'h-2',
    md: 'h-3',
    lg: 'h-4'
  };

  return (
    <div className="w-full">
      {/* Barra de progresso segmentada */}
      <div className={`w-full ${heightClasses[height]} bg-gray-200 rounded-full overflow-hidden flex`}>
        {activeStatuses.map(([status, count], index) => {
          const percentage = (count / totalFuncionarios) * 100;
          const colorClass = getStatusColor(status, 'default');
          
          return (
            <div
              key={status}
              className={`${colorClass} transition-all duration-300 hover:opacity-80`}
              style={{ width: `${percentage}%` }}
              title={`${status}: ${count} funcionário${count !== 1 ? 's' : ''} (${percentage.toFixed(1)}%)`}
            />
          );
        })}
      </div>
      
      {/* Números compactos sempre visíveis */}
      <div className="flex gap-1 mt-1 flex-wrap">
        {activeStatuses.map(([status, count]) => {
          const colorClass = getStatusColor(status, 'badge');
          
          return (
            <span
              key={status}
              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${colorClass}`}
              title={`${status}: ${count} funcionário${count !== 1 ? 's' : ''}`}
            >
              {count}
            </span>
          );
        })}
      </div>
      
      {/* Labels detalhados opcionais */}
      {showLabels && (
        <div className="flex gap-2 mt-2 flex-wrap">
          {activeStatuses.map(([status, count]) => {
            const percentage = (count / totalFuncionarios) * 100;
            const colorClass = getStatusColor(status, 'default');
            
            return (
              <div key={status} className="flex items-center gap-1">
                <div 
                  className={`w-2 h-2 rounded-full ${getStatusColor(status, 'default')}`}
                />
                <span className={`text-xs ${colorClass} font-medium`}>
                  {status}: {count}
                </span>
                <span className="text-xs text-gray-400">
                  ({percentage.toFixed(0)}%)
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StatusChart;

// Componente compacto para uso em cards pequenos
export const CompactStatusChart: React.FC<StatusChartProps> = (props) => {
  return <StatusChart {...props} height="sm" showLabels={false} />;
};

// Componente detalhado para uso em áreas maiores
export const DetailedStatusChart: React.FC<StatusChartProps> = (props) => {
  return <StatusChart {...props} height="md" showLabels={true} />;
};