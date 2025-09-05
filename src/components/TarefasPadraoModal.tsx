'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/Toast';

interface TarefasPadraoModalProps {
  isOpen: boolean;
  onClose: () => void;
  funcionario: {
    id: number | string;
    nome: string;
    matricula: string;
    statusPrestserv?: string;
  } | null;
  onSuccess?: () => void;
}

interface TarefaPadrao {
  tipo: string;
  descricao: string;
}

interface TarefasPadraoData {
  setores: string[];
  tarefasPadrao: {
    [setor: string]: TarefaPadrao[];
  };
}

export default function TarefasPadraoModal({ isOpen, onClose, funcionario, onSuccess }: TarefasPadraoModalProps) {
  const { showToast } = useToast();
  const [setoresSelecionados, setSetoresSelecionados] = useState<string[]>([]);
  const [tarefasPadrao, setTarefasPadrao] = useState<TarefasPadraoData | null>(null);
  const [loading, setLoading] = useState(false);
  const [criandoTarefas, setCriandoTarefas] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchTarefasPadrao();
    }
  }, [isOpen]);

  const fetchTarefasPadrao = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/tarefas-padrao');
      
      if (!response.ok) {
        throw new Error('Erro ao carregar tarefas padrões');
      }
      
      const data = await response.json();
      setTarefasPadrao(data);
    } catch (error) {
      console.error('Erro ao carregar tarefas padrões:', error);
      showToast('Erro ao carregar tarefas padrões', 'error');
    } finally {
      setLoading(false);
    }
  };

  const toggleSetor = (setor: string) => {
    setSetoresSelecionados(prev => {
      if (prev.includes(setor)) {
        return prev.filter(s => s !== setor);
      } else {
        return [...prev, setor];
      }
    });
  };

  const criarTarefasPadrao = async () => {
    if (!funcionario || setoresSelecionados.length === 0) {
      showToast('Selecione pelo menos um setor', 'warning');
      return;
    }

    // Validar se é possível criar tarefas baseado no status do prestserv
    if (funcionario.statusPrestserv === 'SUBMETIDO') {
      showToast('Não é possível criar novas tarefas quando o prestserv está submetido', 'error');
      return;
    }

    setCriandoTarefas(true);
    
    try {
      const response = await fetch('/api/tarefas/padrao', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          funcionarioId: funcionario.id,
          setores: setoresSelecionados,
          criadoPor: 'Sistema'
        }),
      });
      
      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (jsonError) {
          console.error('Failed to parse error response as JSON:', jsonError);
          const textResponse = await response.text();
          console.error('Raw error response:', textResponse);
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        console.error('API Error Details:', {
          status: response.status,
          statusText: response.statusText,
          errorData
        });
        throw new Error(errorData.error || 'Erro ao criar tarefas padrões');
      }
      
      const result = await response.json();
      
      // Sinalizar que tarefas foram criadas para atualizar a página principal
      localStorage.setItem('tarefasPadraoAtualizadas', Date.now().toString());
      
      showToast(result.message, 'success');
      
      // Resetar estado
      setSetoresSelecionados([]);
      
      // Chamar callback de sucesso
      if (onSuccess) {
        onSuccess();
      }
      
      // Fechar modal
      onClose();
    } catch (error) {
      console.error('Erro ao criar tarefas padrões:', error);
      showToast(error instanceof Error ? error.message : 'Erro desconhecido', 'error');
    } finally {
      setCriandoTarefas(false);
    }
  };

  const handleClose = () => {
    setSetoresSelecionados([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Tarefas Padrões por Setor</h2>
              {funcionario && (
                <p className="text-sm text-gray-600 mt-1">
                  Funcionário: {funcionario.nome} (Matrícula: {funcionario.matricula})
                </p>
              )}
            </div>
            <button
              onClick={handleClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ×
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Carregando tarefas padrões...</p>
            </div>
          ) : (
            <>
              {/* Seleção de Setores */}
              <div className="mb-6">
                <h3 className="text-lg font-medium text-gray-900 mb-3">Selecione os Setores:</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {tarefasPadrao?.setores.map((setor) => (
                    <div key={setor} className="border border-gray-200 rounded-lg p-4">
                      <label className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={setoresSelecionados.includes(setor)}
                          onChange={() => toggleSetor(setor)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <div>
                          <span className="font-medium text-gray-900">{setor}</span>
                          <p className="text-sm text-gray-600">
                            {tarefasPadrao.tarefasPadrao[setor]?.length || 0} tarefas
                          </p>
                        </div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Preview das Tarefas Selecionadas */}
              {setoresSelecionados.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-3">Tarefas que serão criadas:</h3>
                  <div className="space-y-4">
                    {setoresSelecionados.map((setor) => (
                      <div key={setor} className="border border-gray-200 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-2">{setor}</h4>
                        <div className="space-y-2">
                          {tarefasPadrao?.tarefasPadrao[setor]?.map((tarefa, index) => (
                            <div key={index} className="bg-gray-50 p-3 rounded">
                              <p className="font-medium text-sm text-gray-900">{tarefa.tipo}</p>
                              <p className="text-xs text-gray-600">{tarefa.descricao}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Ações */}
              <div className="flex justify-end space-x-3">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={criarTarefasPadrao}
                  disabled={criandoTarefas || setoresSelecionados.length === 0}
                  className={`px-4 py-2 text-white rounded transition-colors ${
                    criandoTarefas || setoresSelecionados.length === 0
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {criandoTarefas ? 'Criando...' : `Criar Tarefas (${setoresSelecionados.reduce((total, setor) => total + (tarefasPadrao?.tarefasPadrao[setor]?.length || 0), 0)})`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}