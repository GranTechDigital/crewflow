'use client';

import { useState } from 'react';
import { useToast } from '@/components/Toast';
import {
  XMarkIcon,
  PlusIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

interface TarefaUnicaModalProps {
  isOpen: boolean;
  onClose: () => void;
  funcionarioId: string;
  funcionarioNome: string;
  onSuccess?: () => void;
}

interface NovaTarefa {
  tipo: string;
  descricao: string;
  responsavel: string;
  prioridade: 'Baixa' | 'Media' | 'Alta';
  dataLimite?: string;
  dataVencimento?: string;
}

export default function TarefaUnicaModal({ 
  isOpen, 
  onClose, 
  funcionarioId, 
  funcionarioNome,
  onSuccess 
}: TarefaUnicaModalProps) {
  const { showToast } = useToast();
  const [novaTarefa, setNovaTarefa] = useState<NovaTarefa>({
    tipo: '',
    descricao: '',
    responsavel: '',
    prioridade: 'Media',
    dataLimite: '',
    dataVencimento: ''
  });
  const [criandoTarefa, setCriandoTarefa] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!novaTarefa.tipo || !novaTarefa.descricao || !novaTarefa.responsavel) {
      showToast('Preencha todos os campos obrigatórios', 'warning');
      return;
    }
    
    if (criandoTarefa) {
      return;
    }
    
    setCriandoTarefa(true);
    
    try {
      const response = await fetch('/api/logistica/tarefas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          remanejamentoFuncionarioId: funcionarioId,
          ...novaTarefa,
          criadoPor: 'Sistema'
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao criar tarefa');
      }
      
      // Resetar formulário
      setNovaTarefa({
        tipo: '',
        descricao: '',
        responsavel: '',
        prioridade: 'Media',
        dataLimite: '',
        dataVencimento: ''
      });
      
      showToast('Tarefa criada com sucesso!', 'success');
      onSuccess?.();
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro desconhecido', 'error');
    } finally {
      setCriandoTarefa(false);
    }
  };

  const handleClose = () => {
    if (!criandoTarefa) {
      setNovaTarefa({
        tipo: '',
        descricao: '',
        responsavel: '',
        prioridade: 'Media',
        dataLimite: '',
        dataVencimento: ''
      });
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <PlusIcon className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Nova Tarefa</h2>
              <p className="text-sm text-gray-500">Criar tarefa individual</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={criandoTarefa}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Funcionário */}
          <div className="bg-gray-50 rounded-lg p-4">
            <label className="text-sm font-medium text-gray-500">Funcionário</label>
            <p className="text-gray-900 font-medium">{funcionarioNome}</p>
          </div>

          {/* Tipo */}
          <div>
            <label htmlFor="tipo" className="block text-sm font-medium text-gray-700 mb-2">
              Tipo da Tarefa *
            </label>
            <input
              type="text"
              id="tipo"
              value={novaTarefa.tipo}
              onChange={(e) => setNovaTarefa(prev => ({ ...prev, tipo: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Ex: Documentação, Treinamento, etc."
              required
            />
          </div>

          {/* Descrição */}
          <div>
            <label htmlFor="descricao" className="block text-sm font-medium text-gray-700 mb-2">
              Descrição *
            </label>
            <textarea
              id="descricao"
              value={novaTarefa.descricao}
              onChange={(e) => setNovaTarefa(prev => ({ ...prev, descricao: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Descreva detalhadamente a tarefa..."
              required
            />
          </div>

          {/* Responsável */}
          <div>
            <label htmlFor="responsavel" className="block text-sm font-medium text-gray-700 mb-2">
              Responsável *
            </label>
            <select
              id="responsavel"
              value={novaTarefa.responsavel}
              onChange={(e) => setNovaTarefa(prev => ({ ...prev, responsavel: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            >
              <option value="">Selecione o responsável</option>
              <option value="RH">RH</option>
              <option value="MEDICINA">Medicina</option>
              <option value="TREINAMENTO">Treinamento</option>
              <option value="LOGISTICA">Logística</option>
              <option value="PRESTSERV">Prestserv</option>
            </select>
          </div>

          {/* Prioridade */}
          <div>
            <label htmlFor="prioridade" className="block text-sm font-medium text-gray-700 mb-2">
              Prioridade
            </label>
            <select
              id="prioridade"
              value={novaTarefa.prioridade}
              onChange={(e) => setNovaTarefa(prev => ({ ...prev, prioridade: e.target.value as 'Baixa' | 'Media' | 'Alta' }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="Baixa">Baixa</option>
              <option value="Media">Média</option>
              <option value="Alta">Alta</option>
            </select>
          </div>

          {/* Data Limite */}
          <div>
            <label htmlFor="dataLimite" className="block text-sm font-medium text-gray-700 mb-2">
              Data Limite (Opcional)
            </label>
            <input
              type="date"
              id="dataLimite"
              value={novaTarefa.dataLimite}
              onChange={(e) => setNovaTarefa(prev => ({ ...prev, dataLimite: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Data Vencimento */}
          <div>
            <label htmlFor="dataVencimento" className="block text-sm font-medium text-gray-700 mb-2">
              Data Vencimento (Opcional)
            </label>
            <input
              type="date"
              id="dataVencimento"
              value={novaTarefa.dataVencimento}
              onChange={(e) => setNovaTarefa(prev => ({ ...prev, dataVencimento: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Warning */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div>
                <h3 className="text-sm font-medium text-yellow-800">Atenção</h3>
                <p className="text-sm text-yellow-700 mt-1">
                  Esta tarefa será criada individualmente para este funcionário específico.
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={criandoTarefa}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={criandoTarefa}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center"
            >
              {criandoTarefa ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Criando...
                </>
              ) : (
                <>
                  <PlusIcon className="w-4 h-4 mr-2" />
                  Criar Tarefa
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}