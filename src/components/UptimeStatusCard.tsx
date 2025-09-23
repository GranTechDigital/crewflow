import React from 'react';
import Link from 'next/link';

interface UptimeStatusCardProps {
  matricula: string;
  nome: string;
  status: string | null;
  dataInicio: string | null;
  dataFim: string | null;
  embarcacao: string | null;
}

export default function UptimeStatusCard({
  matricula,
  nome,
  status,
  dataInicio,
  dataFim,
  embarcacao
}: UptimeStatusCardProps) {
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('pt-BR');
    } catch (e) {
      return dateString;
    }
  };

  const getStatusColor = (status: string | null) => {
    if (!status) return 'bg-gray-100 text-gray-800';
    
    switch (status.toLowerCase()) {
      case 'embarcado':
        return 'bg-green-100 text-green-800';
      case 'desembarcado':
        return 'bg-yellow-100 text-yellow-800';
      case 'férias':
      case 'ferias':
        return 'bg-blue-100 text-blue-800';
      case 'afastado':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-semibold text-lg">{nome}</h3>
          <p className="text-sm text-gray-600">Matrícula: {matricula}</p>
        </div>
        <span className={`inline-block px-2 py-1 rounded text-sm ${getStatusColor(status)}`}>
          {status || 'N/A'}
        </span>
      </div>
      
      <div className="mb-3">
        <p className="text-sm text-gray-600">Período:</p>
        <p className="text-sm">{formatDate(dataInicio)} a {formatDate(dataFim)}</p>
      </div>
      
      {embarcacao && (
        <div className="mb-3">
          <p className="text-sm text-gray-600">Embarcação:</p>
          <p className="text-sm">{embarcacao}</p>
        </div>
      )}
      
      <Link 
        href={`/uptime/funcionario?matricula=${matricula}`}
        className="text-blue-600 hover:text-blue-800 text-sm font-medium inline-flex items-center"
      >
        Ver detalhes
        <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </div>
  );
}