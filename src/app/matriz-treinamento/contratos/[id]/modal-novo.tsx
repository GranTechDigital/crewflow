'use client';

import { useState, useEffect } from 'react';
import { XMarkIcon, TrashIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

interface Treinamento {
  id: number;
  treinamento: string;
  cargaHoraria: number;
  validadeValor: number;
  validadeUnidade: string;
}

interface TreinamentoSelecionado extends Treinamento {
  tipoObrigatoriedade: string;
}

interface TipoObrigatoriedade {
  value: string;
  label: string;
}

interface Funcao {
  id: number;
  funcao: string;
  regime: string;
  matrizTreinamento: {
    id: number;
    tipoObrigatoriedade: string;
    treinamento: {
      id: number;
      treinamento: string;
      cargaHoraria: number;
      validadeValor: number;
      validadeUnidade: string;
    } | null;
  }[];
}

interface ModalTreinamentosProps {
  showModal: boolean;
  closeModal: () => void;
  treinamentos: Treinamento[];
  tiposObrigatoriedade: TipoObrigatoriedade[];
  funcoes: Funcao[];
  selectedFuncao: number | null;
  onSubmit: (treinamentosSelecionados: number[], tipoObrigatoriedadeGlobal: string) => Promise<void>;
  modalLoading?: boolean;
}

export default function ModalTreinamentos({
  showModal,
  closeModal,
  treinamentos,
  tiposObrigatoriedade,
  funcoes,
  selectedFuncao,
  onSubmit,
  modalLoading = false
}: ModalTreinamentosProps) {
  const [selecionados, setSelecionados] = useState<TreinamentoSelecionado[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (showModal) {
      setSelecionados([]);
      setSearchTerm('');
    }
  }, [showModal]);

  if (!showModal) return null;

  const funcaoAtual = funcoes.find(f => f.id === selectedFuncao);

  const handleSelect = (treinamento: Treinamento) => {
    // Padrão atualizado: 'AP' (Necessário/Obrigatório)
    setSelecionados(prev => [...prev, { ...treinamento, tipoObrigatoriedade: 'AP' }]);
  };

  const handleRemove = (treinamentoId: number) => {
    setSelecionados(prev => prev.filter(t => t.id !== treinamentoId));
  };

  const handleTipoChange = (treinamentoId: number, tipo: string) => {
    setSelecionados(prev => 
      prev.map(t => t.id === treinamentoId ? { ...t, tipoObrigatoriedade: tipo } : t)
    );
  };

  const handleSubmit = async () => {
    if (selecionados.length > 0) {
      // Para cada treinamento, vamos usar seu próprio tipo de obrigatoriedade
      for (const treinamento of selecionados) {
        await onSubmit([treinamento.id], treinamento.tipoObrigatoriedade);
      }
    }
  };

  const treinamentosDisponiveis = treinamentos.filter(t => {
    const jaExiste = funcaoAtual?.matrizTreinamento.some(mt => mt.treinamento?.id === t.id);
    const jaSelecionado = selecionados.some(s => s.id === t.id);
    const matchesSearch = searchTerm === '' || 
      t.treinamento.toLowerCase().includes(searchTerm.toLowerCase());
    return !jaExiste && !jaSelecionado && matchesSearch;
  });

  const isButtonEnabled = selecionados.length > 0 && !modalLoading;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Adicionar Treinamentos
          </h3>
          <button
            onClick={closeModal}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Content - Two Columns */}
        <div className="flex divide-x divide-gray-200">
          {/* Left Column - Available Trainings */}
          <div className="w-1/2 p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-medium text-gray-700">
                Treinamentos Disponíveis
              </h4>
              <span className="text-xs text-gray-500">
                {treinamentosDisponiveis.length} disponíveis
              </span>
            </div>
            
            {/* Campo de Pesquisa */}
            <div className="relative mb-4">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Pesquisar treinamentos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  <XMarkIcon className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>

            <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-4">
              {treinamentosDisponiveis.map((treinamento) => (
                <button
                  key={treinamento.id}
                  onClick={() => handleSelect(treinamento)}
                  className="w-full text-left p-3 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
                >
                  <div className="font-medium text-gray-900">
                    {treinamento.treinamento}
                  </div>
                  <div className="text-sm text-gray-500">
                    {treinamento.cargaHoraria}h - Validade: {treinamento.validadeValor} {treinamento.validadeUnidade}
                  </div>
                </button>
              ))}
              {treinamentosDisponiveis.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  {searchTerm ? (
                    <>
                      <p>Nenhum treinamento encontrado para "{searchTerm}"</p>
                      <button
                        onClick={() => setSearchTerm('')}
                        className="mt-2 text-blue-600 hover:text-blue-800 text-sm underline"
                      >
                        Limpar pesquisa
                      </button>
                    </>
                  ) : (
                    'Não há mais treinamentos disponíveis para adicionar'
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Selected Trainings */}
          <div className="w-1/2 p-6">
            <h4 className="text-sm font-medium text-gray-700 mb-4">
              Treinamentos Selecionados ({selecionados.length})
            </h4>

            {/* Selected Items */}
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-4">
              {selecionados.map((treinamento) => (
                <div
                  key={treinamento.id}
                  className="p-3 border border-blue-200 bg-blue-50 rounded-lg space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium text-blue-900">
                        {treinamento.treinamento}
                      </div>
                      <div className="text-sm text-blue-700">
                        {treinamento.cargaHoraria}h - Validade: {treinamento.validadeValor} {treinamento.validadeUnidade}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemove(treinamento.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Tipo de Obrigatoriedade Individual */}
                  <div className="flex items-center space-x-2">
                    <label className="text-sm font-medium text-blue-800">
                      Tipo:
                    </label>
                    <select
                      value={treinamento.tipoObrigatoriedade}
                      onChange={(e) => handleTipoChange(treinamento.id, e.target.value)}
                      className="flex-1 text-sm px-2 py-1 border border-blue-300 rounded bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {tiposObrigatoriedade.map((tipo) => (
                        <option key={tipo.value} value={tipo.value}>
                          {tipo.value} - {tipo.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
              {selecionados.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  Nenhum treinamento selecionado
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={closeModal}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
          >
            Cancelar
          </button>
          
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isButtonEnabled}
            className={`px-6 py-2 rounded-lg font-medium flex items-center ${
              isButtonEnabled
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {modalLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Adicionando...
              </>
            ) : (
              <>
                Adicionar {selecionados.length} Treinamento{selecionados.length !== 1 ? 's' : ''}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}