'use client';

import { StatusPrestserv } from '@/types/remanejamento-funcionario';
import { CheckCircleIcon, ClockIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';

interface StatusTimelineProps {
  currentStatus: StatusPrestserv;
  dataRascunhoCriado?: string;
  dataSubmetido?: string;
  dataResposta?: string;
}

const StatusTimeline: React.FC<StatusTimelineProps> = ({
  currentStatus,
  dataRascunhoCriado,
  dataSubmetido,
  dataResposta
}) => {
  const [isVisible, setIsVisible] = useState(false);
  
  useEffect(() => {
    // Adiciona uma pequena animação de entrada quando o componente é montado
    setIsVisible(true);
  }, []);
  // Definir a ordem dos status para a timeline
  const statusOrder: StatusPrestserv[] = ['PENDENTE', 'CRIADO', 'EM VALIDAÇÃO', 'VALIDADO'];
  
  // Verificar se o status atual está rejeitado
  const isRejected = currentStatus === 'INVALIDADO';
  
  // Formatar data para exibição
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    
    // Formatar data de forma compacta
    const dia = date.getDate().toString().padStart(2, '0');
    const mes = (date.getMonth() + 1).toString().padStart(2, '0');
    
    return `${dia}/${mes}`;
  };

  // Determinar o status de cada etapa da timeline
  const getStepStatus = (step: StatusPrestserv) => {
    const currentIndex = statusOrder.indexOf(currentStatus);
    const stepIndex = statusOrder.indexOf(step);
    
    if (isRejected && step === 'EM VALIDAÇÃO') return 'rejected';
    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'current';
    return 'pending';
  };

  // Obter ícone para cada etapa
  const getStepIcon = (step: StatusPrestserv) => {
    const status = getStepStatus(step);
    
    if (status === 'completed') return <CheckCircleIcon className="w-5 h-5 text-green-600" />;
    if (status === 'current') return <ClockIcon className="w-5 h-5 text-blue-600 animate-pulse" />;
    if (status === 'rejected') return <XCircleIcon className="w-5 h-5 text-red-600" />;
    return <ClockIcon className="w-5 h-5 text-gray-400" />;
  };

  // Obter cor para cada etapa
  const getStepColor = (step: StatusPrestserv) => {
    const status = getStepStatus(step);
    
    if (status === 'completed') return 'bg-green-100 border-green-500 shadow-green-100';
    if (status === 'current') return 'bg-blue-100 border-blue-500 shadow-blue-100';
    if (status === 'rejected') return 'bg-red-100 border-red-500 shadow-red-100';
    return 'bg-gray-50 border-gray-200 shadow-none';
  };

  // Obter cor para o conector
  const getConnectorColor = (step: StatusPrestserv, nextStep: StatusPrestserv) => {
    const currentStepStatus = getStepStatus(step);
    const nextStepStatus = getStepStatus(nextStep);
    
    if (currentStepStatus === 'completed' && nextStepStatus === 'completed') return 'bg-green-500';
    if (currentStepStatus === 'completed' && nextStepStatus === 'current') return 'bg-blue-500';
    if (currentStepStatus === 'completed' && nextStepStatus === 'rejected') return 'bg-red-500';
    if (currentStepStatus === 'rejected') return 'bg-red-500';
    return 'bg-gray-200';
  };

  // Obter texto para cada etapa
  const getStepText = (step: StatusPrestserv) => {
    switch (step) {
      case 'PENDENTE': return 'Pendente';
      case 'CRIADO': return 'Rascunho';
      case 'EM VALIDAÇÃO': return isRejected ? 'Rejeitado' : 'Em Validação';
      case 'VALIDADO': return 'Validado';
      default: return step.replace('_', ' ');
    }
  };

  // Obter data para cada etapa
  const getStepDate = (step: StatusPrestserv) => {
    switch (step) {
      case 'CRIADO': return formatDate(dataRascunhoCriado);
      case 'EM VALIDAÇÃO': return formatDate(dataSubmetido);
      case 'VALIDADO': 
      case 'INVALIDADO': 
        return formatDate(dataResposta);
      default: return '';
    }
  };

  return (
    <div className="py-2 overflow-x-auto">
      <div className="relative min-w-[400px] md:min-w-0 bg-gradient-to-r from-blue-50/50 via-white to-blue-50/50 rounded-lg p-4">
        
        {/* Etapas da timeline */}
        <div className={`flex justify-between px-8 py-4 transition-all duration-700 ease-in-out ${isVisible ? 'opacity-100 transform-none' : 'opacity-0 -translate-y-4'}`}>
          
          {/* Pontos da timeline com conectores */}
          {statusOrder.map((step, index) => (
            <div key={step} className="relative flex flex-col items-center">
              
              {/* Conector à esquerda (exceto para o primeiro item) */}
              {index > 0 && (
                <div 
                  className={`absolute h-1 ${getConnectorColor(statusOrder[index-1], step)}`}
                  style={{
                    top: 'calc(50% - 0.5px)', // Centraliza com o círculo (metade da altura da linha)
                    right: 'calc(50% + 12px)', // Metade da largura do círculo (24px/2)
                    width: 'calc(50% - 12px)', // Ajusta para cobrir a distância exata até o próximo círculo
                    zIndex: 1
                  }}
                ></div>
              )}
              
              {/* Conector à direita (exceto para o último item) */}
              {index < statusOrder.length - 1 && (
                <div 
                  className={`absolute h-1 ${getConnectorColor(step, statusOrder[index+1])}`}
                  style={{
                    top: 'calc(50% - 0.5px)', // Centraliza com o círculo (metade da altura da linha)
                    left: 'calc(50% + 12px)', // Metade da largura do círculo (24px/2)
                    width: 'calc(50% - 12px)', // Ajusta para cobrir a distância exata até o próximo círculo
                    zIndex: 1
                  }}
                ></div>
              )}
              
              {/* Círculo do ícone */}
              <div 
                className={`flex items-center justify-center w-12 h-12 rounded-full border-2 ${getStepColor(step)} hover:scale-110 cursor-pointer`}
                style={{ 
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)', 
                  transition: 'all 0.3s ease-in-out',
                  transitionDelay: `${index * 0.15}s`,
                  position: 'relative',
                  zIndex: 10,
                  transform: 'translateZ(0)' // Força o hardware acceleration para evitar problemas de renderização
                }}
                title={`Status: ${getStepText(step)}${getStepDate(step) ? ` - ${formatDate(getStepDate(step))}` : ''}`}
              >
                {getStepIcon(step)}
              </div>
              
              {/* Conteúdo da etapa */}
              <div 
                className="mt-2 text-center px-1 max-w-[100px]"
                style={{ 
                  transition: 'all 0.3s ease-in-out',
                  transitionDelay: `${index * 0.2}s`
                }}
              >
                <div className="text-xs font-semibold text-gray-800">
                  {getStepText(step)}
                </div>
                
                {/* Data da etapa */}
                {getStepDate(step) && (
                  <div className="text-[10px] text-gray-500 mt-0.5">
                    {getStepDate(step)}
                  </div>
                )}
                
                {/* Indicador de status atual */}
                {getStepStatus(step) === 'current' && (
                  <div className="mt-1 inline-block bg-blue-100 text-blue-800 text-[10px] font-medium py-0.5 px-1.5 rounded-md shadow-sm animate-pulse">
                    Atual
                  </div>
                )}
                
                {/* Indicador de status rejeitado */}
                {isRejected && step === 'EM VALIDAÇÃO' && (
                  <div className="mt-1 inline-block bg-red-100 text-red-800 text-[10px] font-medium py-0.5 px-1.5 rounded-md shadow-sm">
                    Rejeitado
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        
        {/* Legenda */}
        <div className="mt-3 pt-2 border-t border-gray-200 flex flex-wrap justify-center gap-2 text-[10px] text-gray-600 px-2">
          <div className="flex items-center">
            <div className="w-2 h-2 rounded-full bg-green-500 mr-1"></div>
            <span>Concluído</span>
          </div>
          <div className="flex items-center">
            <div className="w-2 h-2 rounded-full bg-blue-500 mr-1 animate-pulse"></div>
            <span>Atual</span>
          </div>
          <div className="flex items-center">
            <div className="w-2 h-2 rounded-full bg-red-500 mr-1"></div>
            <span>Rejeitado</span>
          </div>
          <div className="flex items-center">
            <div className="w-2 h-2 rounded-full bg-gray-300 mr-1"></div>
            <span>Pendente</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatusTimeline;