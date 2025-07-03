'use client';

import { useState, useEffect } from 'react';

interface HistoricoItem {
  id: number;
  tipoAcao: string;
  descricaoAcao: string;
  dataAcao: string;
}

interface HistoricoSimplificadoProps {
  funcionarioId: string;
}

export default function HistoricoSimplificado({ funcionarioId }: HistoricoSimplificadoProps) {
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistorico();
  }, [funcionarioId]);

  const fetchHistorico = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        remanejamentoFuncionarioId: funcionarioId,
        limit: '5' // Apenas os 5 mais recentes
      });

      const response = await fetch(`/api/remanejamento/historico?${params}`);
      
      if (response.ok) {
        const data = await response.json();
        setHistorico(data.historico || []);
      }
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTipoAcaoColor = (tipoAcao: string) => {
    switch (tipoAcao) {
      case 'CRIACAO':
        return 'bg-green-500';
      case 'ATUALIZACAO_STATUS':
        return 'bg-blue-500';
      case 'ATUALIZACAO_CAMPO':
        return 'bg-yellow-500';
      case 'EXCLUSAO':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const formatarData = (dataString: string) => {
    const data = new Date(dataString);
    const agora = new Date();
    const diffMs = agora.getTime() - data.getTime();
    const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHoras = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutos = Math.floor(diffMs / (1000 * 60));

    if (diffDias > 0) {
      return `Há ${diffDias} dia${diffDias > 1 ? 's' : ''}`;
    } else if (diffHoras > 0) {
      return `Há ${diffHoras} hora${diffHoras > 1 ? 's' : ''}`;
    } else if (diffMinutos > 0) {
      return `Há ${diffMinutos} minuto${diffMinutos > 1 ? 's' : ''}`;
    } else {
      return 'Agora mesmo';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (historico.length === 0) {
    return (
      <div className="text-sm text-gray-500 py-2">
        Nenhum histórico encontrado.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {historico.map((item) => (
        <div key={item.id} className="text-sm text-gray-600">
          <div className="flex items-center space-x-2">
            <span className={`w-2 h-2 rounded-full ${getTipoAcaoColor(item.tipoAcao)}`}></span>
            <span>{item.descricaoAcao}</span>
          </div>
          <div className="text-xs text-gray-400 ml-4">
            {formatarData(item.dataAcao)}
          </div>
        </div>
      ))}
    </div>
  );
}