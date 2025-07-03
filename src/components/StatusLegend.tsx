import React from 'react';
import { getStatusColor } from '../utils/statusColors';

interface CompactStatusLegendProps {
  presentStatuses: string[];
}

export const CompactStatusLegend: React.FC<CompactStatusLegendProps> = ({ presentStatuses }) => {
  if (presentStatuses.length === 0) {
    return null;
  }

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <h3 className="text-sm font-medium text-gray-700 mb-3">Legenda de Status</h3>
      <div className="flex flex-wrap gap-3">
        {presentStatuses.map((status) => {
          const colorClass = getStatusColor(status, 'badge');
          // Extract background color from the badge classes
          const bgColorMatch = colorClass.match(/bg-\w+-\d+/);
          const bgColor = bgColorMatch ? bgColorMatch[0] : 'bg-gray-200';
          
          return (
            <div key={status} className="flex items-center gap-2">
              <div 
                className={`w-3 h-3 rounded-full ${bgColor}`}
                title={status}
              />
              <span className="text-xs text-gray-600 capitalize">
                {status}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CompactStatusLegend;