'use client';

import { StatusPrestserv } from '@/types/remanejamento-funcionario';
import { Timeline, TimelineItem, TimelinePoint, TimelineContent, TimelineTime, TimelineTitle, TimelineBody } from 'flowbite-react';
import { CheckCircleIcon, ClockIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';
import { log } from 'node:console';

interface StatusTimelineProps {
  currentStatus: StatusPrestserv;
  dataRascunhoCriado?: string;
  dataSubmetido?: string;
  dataResposta?: string;
  dataCriadoEm?: string;
}

const FlowbiteStatusTimeline: React.FC<StatusTimelineProps> = ({
  currentStatus,
  dataRascunhoCriado,
  dataSubmetido,
  dataResposta,
  dataCriadoEm,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Adiciona uma pequena animação de entrada quando o componente é montado
    setIsVisible(true);
  }, []);

  // Definir a ordem dos status para a timeline
  const statusOrder: StatusPrestserv[] = [
    "PENDENTE",
    "CRIADO",
    "EM VALIDAÇÃO",
    "VALIDADO",
    
  ];

  // Verificar se o status atual está cancelado
  const isCanceled = currentStatus === "CANCELADO";
  // Verificar se foi invalidado (reprovado)
  const isInvalidated = currentStatus === "INVALIDADO";

  // Formatar data para exibição
  const formatDate = (dateString?: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);

    // Formatar data de forma compacta
    const dia = date.getDate().toString().padStart(2, "0");
    const mes = (date.getMonth() + 1).toString().padStart(2, "0");

    return `${dia}/${mes}`;
  };

  // Determinar o status de cada etapa da timeline
  const getStepStatus = (step: StatusPrestserv) => {
    const currentIndex = statusOrder.indexOf(currentStatus);
    const stepIndex = statusOrder.indexOf(step);

    if (isCanceled && step === "EM VALIDAÇÃO") return "canceled";
    if (isInvalidated && step === "EM VALIDAÇÃO") return "invalidated";

    // Se o status atual é VALIDADO (validado), toda a linha fica verde
    if (currentStatus === "VALIDADO") {
      if (stepIndex <= currentIndex) return "completed";
      return "pending";
    }

    // Para outros status, azul até o status atual
    if (stepIndex < currentIndex) return "progress";
    if (stepIndex === currentIndex) return "current";
    return "pending";
  };

  // Obter ícone para cada etapa
  const getStepIcon = (step: StatusPrestserv) => {
    const status = getStepStatus(step);

    if (status === "completed")
      return <CheckCircleIcon className="w-5 h-5 text-green-600" />;
    if (status === "progress")
      return <CheckCircleIcon className="w-5 h-5 text-blue-600" />;
    if (status === "current")
      return <ClockIcon className="w-5 h-5 text-blue-600 animate-pulse" />;
    if (status === "canceled")
      return <XCircleIcon className="w-5 h-5 text-red-600" />;
    if (status === "invalidated")
      return <XCircleIcon className="w-5 h-5 text-orange-600" />;
    return <ClockIcon className="w-5 h-5 text-gray-400" />;
  };

  // Obter texto para cada etapa
  const getStepText = (step: StatusPrestserv) => {
    switch (step) {
      case "PENDENTE":
        return "Pendente";
      case "CRIADO":
        return "Criado";
      case "EM VALIDAÇÃO":
        return isCanceled
          ? "Cancelado"
          : isInvalidated
          ? "Invalidado"
          : "Em Validação";
      case "VALIDADO":
        return "Validado";
      default:
        return step.replace("_", " ");
    }
  };

  // Obter data para cada etapa
  const getStepDate = (step: StatusPrestserv) => {
    console.log("x",step," ",dataCriadoEm);
    switch (step) {
      
      case "PENDENTE":
        return formatDate(dataCriadoEm);
      case "CRIADO":
        return formatDate(dataRascunhoCriado);
      case "EM VALIDAÇÃO":
        return formatDate(dataSubmetido);
      case "VALIDADO":
        return formatDate(dataResposta);
      case "CANCELADO":
      case "INVALIDADO":
        return formatDate(dataResposta);
      default:
        return "";
    }
  };

  // Obter cor para cada etapa
  const getStepColor = (step: StatusPrestserv) => {
    const status = getStepStatus(step);

    if (status === "completed") return "text-green-600";
    if (status === "progress") return "text-blue-600";
    if (status === "current") return "text-blue-600";
    if (status === "canceled") return "text-red-600";
    if (status === "invalidated") return "text-orange-600";
    return "text-gray-400";
  };

  // Estilo personalizado para a timeline
  const timelineStyle = {
    "--connector-size": "3px",
    "--point-size": "32px",
  } as React.CSSProperties;

  // Não precisamos mais da função getPointStyle pois os estilos estão no CSS

  return (
    <div
      className={`py-1 overflow-x-auto transition-all duration-700 ease-in-out ${
        isVisible ? "opacity-100 transform-none" : "opacity-0 -translate-y-4"
      }`}
    >
      <div className="relative min-w-[400px] md:min-w-0 bg-gradient-to-r from-blue-50/50 via-white to-blue-50/50 rounded-lg p-3 shadow-sm timeline-container">
        <Timeline
          horizontal={true}
          className="timeline-custom"
          style={timelineStyle}
        >
          {statusOrder.map((step, index) => {
            const status = getStepStatus(step);
            const stepDate = getStepDate(step);
            // console.log(step," ",stepDate);
            
            const stepText = getStepText(step);
            const stepColor = getStepColor(step);

            return (
              <TimelineItem
                key={step}
                className={`timeline-item-custom ${status}`}
              >
                <TimelinePoint
                  icon={() => getStepIcon(step)}
                  className={`${stepColor} timeline-point-custom`}
                />
                <TimelineContent className="timeline-content-custom">
                  {stepDate && (
                    <TimelineTime className="text-xs font-medium">
                      {stepDate}
                    </TimelineTime>
                  )}
                  <TimelineTitle className="text-sm font-semibold">
                    {stepText}
                  </TimelineTitle>
                  {status === "current" && (
                    <TimelineBody>
                      <span className="inline-block bg-blue-100 text-blue-800 text-xs font-medium py-0.5 px-1.5 rounded-md shadow-sm animate-pulse">
                        Atual
                      </span>
                    </TimelineBody>
                  )}
                  {isCanceled && step === "EM VALIDAÇÃO" && (
                    <TimelineBody>
                      <span className="inline-block bg-red-100 text-red-800 text-xs font-medium py-0.5 px-1.5 rounded-md shadow-sm">
                        Cancelado
                      </span>
                    </TimelineBody>
                  )}
                  {isInvalidated && step === "INVALIDADO" && (
                    <TimelineBody>
                      <span className="inline-block bg-orange-100 text-orange-800 text-xs font-medium py-0.5 px-1.5 rounded-md shadow-sm">
                        Invalidado
                      </span>
                    </TimelineBody>
                  )}
                </TimelineContent>
              </TimelineItem>
            );
          })}
        </Timeline>

        {/* Legenda */}
        <div className="mt-2 pt-2 border-t border-gray-200 flex flex-wrap justify-center gap-2 text-xs text-gray-600 px-2">
          <div className="flex items-center bg-gray-50 px-2 py-1 rounded-md shadow-sm">
            <div className="w-3 h-3 rounded-full bg-green-500 mr-1.5 border border-green-600"></div>
            <span>Validado</span>
          </div>
          <div className="flex items-center bg-gray-50 px-2 py-1 rounded-md shadow-sm">
            <div className="w-3 h-3 rounded-full bg-blue-500 mr-1.5 border border-blue-600"></div>
            <span>Concluído</span>
          </div>
          <div className="flex items-center bg-gray-50 px-2 py-1 rounded-md shadow-sm">
            <div className="w-3 h-3 rounded-full bg-blue-500 mr-1.5 border border-blue-600 animate-pulse"></div>
            <span>Atual</span>
          </div>
          <div className="flex items-center bg-gray-50 px-2 py-1 rounded-md shadow-sm">
            <div className="w-3 h-3 rounded-full bg-red-500 mr-1.5 border border-red-600"></div>
            <span>Cancelado</span>
          </div>
          <div className="flex items-center bg-gray-50 px-2 py-1 rounded-md shadow-sm">
            <div className="w-3 h-3 rounded-full bg-orange-500 mr-1.5 border border-orange-600"></div>
            <span>Invalidado</span>
          </div>
          <div className="flex items-center bg-gray-50 px-2 py-1 rounded-md shadow-sm">
            <div className="w-3 h-3 rounded-full bg-gray-300 mr-1.5 border border-gray-400"></div>
            <span>Pendente</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FlowbiteStatusTimeline;