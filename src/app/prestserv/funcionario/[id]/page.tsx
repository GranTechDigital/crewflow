'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useToast } from '@/components/Toast';
import { RemanejamentoFuncionario, StatusPrestserv, TarefaRemanejamento, StatusTarefa } from '@/types/remanejamento-funcionario';
import TarefasPadraoModal from '@/components/TarefasPadraoModal';
import HistoricoSimplificado from '@/components/HistoricoSimplificado';



interface NovaObservacao {
  observacao: string;
}

interface NovaTarefa {
  tipo: string;
  descricao: string;
  responsavel: string;
  prioridade: 'Baixa' | 'Media' | 'Alta';
  dataLimite?: string;
}

interface ObservacaoTarefa {
  id: number;
  texto: string;
  dataCriacao: string;
  dataModificacao: string;
  criadoPor: string;
  modificadoPor: string;
}

interface NovaObservacaoTarefa {
  texto: string;
  criadoPor: string;
}

export default function DetalheFuncionario() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const funcionarioId = params.id as string;
  
  const [funcionario, setFuncionario] = useState<RemanejamentoFuncionario | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [atualizandoStatus, setAtualizandoStatus] = useState(false);
  const [criandoTarefa, setCriandoTarefa] = useState(false);
  const [mostrarFormTarefa, setMostrarFormTarefa] = useState(false);
  const [mostrarObservacao, setMostrarObservacao] = useState(false);
  const [acaoPrestserv, setAcaoPrestserv] = useState<'submeter' | 'aprovar' | 'rejeitar' | null>(null);
  const [novaTarefa, setNovaTarefa] = useState<NovaTarefa>({
    tipo: '',
    descricao: '',
    responsavel: '',
    prioridade: 'Media'
  });
  const [novaObservacao, setNovaObservacao] = useState<NovaObservacao>({ observacao: '' });
  const [observacoesTarefa, setObservacoesTarefa] = useState<{ [tarefaId: string]: ObservacaoTarefa[] }>({});
  const [mostrarObservacoesTarefa, setMostrarObservacoesTarefa] = useState<string | null>(null);
  const [novaObservacaoTarefa, setNovaObservacaoTarefa] = useState<NovaObservacaoTarefa>({ texto: '', criadoPor: 'Sistema' });
  const [editandoObservacao, setEditandoObservacao] = useState<number | null>(null);
  const [textoEdicaoObservacao, setTextoEdicaoObservacao] = useState('');
  const [editandoDataLimite, setEditandoDataLimite] = useState<string | null>(null);
  const [novaDataLimite, setNovaDataLimite] = useState('');
  const [mostrarTarefasPadrao, setMostrarTarefasPadrao] = useState(false);

  useEffect(() => {
    if (funcionarioId) {
      fetchFuncionario();
    }
  }, [funcionarioId]);

  useEffect(() => {
    // Carregar observações para todas as tarefas quando o funcionário é carregado
    if (funcionario && funcionario.tarefas && funcionario.tarefas.length > 0) {
      funcionario.tarefas.forEach(tarefa => {
        buscarObservacoesTarefa(tarefa.id, false); // false para não mostrar loading
      });
    }
  }, [funcionario?.tarefas]);

  const fetchFuncionario = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/logistica/funcionario/${funcionarioId}`);
      
      if (!response.ok) {
        throw new Error('Erro ao carregar dados do funcionário');
      }
      
      const data = await response.json();
      setFuncionario(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  const atualizarStatusPrestserv = async (novoStatus: StatusPrestserv, observacao?: string) => {
    if (!funcionario) return;
    
    try {
      setAtualizandoStatus(true);
      const response = await fetch(`/api/logistica/funcionario/${funcionarioId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          statusPrestserv: novoStatus,
          observacoesPrestserv: observacao 
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao atualizar status');
      }
      
      await fetchFuncionario();
      
      // Notificações específicas para cada status
      const mensagens = {
        'CRIADO': 'Rascunho criado com sucesso!',
        'SUBMETIDO': 'Prestserv submetido para aprovação com sucesso!',
        'APROVADO': 'Prestserv aprovado com sucesso!',
        'REJEITADO': 'Prestserv rejeitado com sucesso!'
      };
      
      const mensagem = mensagens[novoStatus] || 'Status atualizado com sucesso!';
      showToast(mensagem, 'success');
      
      setMostrarObservacao(false);
      setNovaObservacao({ observacao: '' });
      setAcaoPrestserv(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro desconhecido', 'error');
    } finally {
      setAtualizandoStatus(false);
    }
  };

  const criarTarefa = async () => {
    if (!funcionario || !novaTarefa.tipo || !novaTarefa.descricao || !novaTarefa.responsavel) {
      showToast('Preencha todos os campos obrigatórios', 'warning');
      return;
    }
    
    // Validar se é possível criar tarefas baseado no status do prestserv
    if (funcionario.statusPrestserv === 'SUBMETIDO' || funcionario.statusPrestserv === 'APROVADO') {
      showToast('Não é possível criar novas tarefas quando o prestserv está submetido ou aprovado', 'error');
      return;
    }
    
    if (criandoTarefa) {
      return; // Previne múltiplas submissões
    }
    
    setCriandoTarefa(true);
    
    try {
      const response = await fetch('/api/logistica/tarefas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          remanejamentoFuncionarioId: funcionario.id,
          ...novaTarefa
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao criar tarefa');
      }
      
      await fetchFuncionario();
      setMostrarFormTarefa(false);
      setNovaTarefa({
        tipo: '',
        descricao: '',
        responsavel: '',
        prioridade: 'Media'
      });
      showToast('Tarefa criada com sucesso', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro desconhecido', 'error');
    } finally {
      setCriandoTarefa(false);
    }
  };

  const atualizarTarefa = async (tarefaId: string, status: StatusTarefa) => {
    try {
      const response = await fetch(`/api/logistica/tarefas/${tarefaId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao atualizar tarefa');
      }
      
      await fetchFuncionario();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro desconhecido', 'error');
    }
  };

  const excluirTarefa = async (tarefaId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta tarefa?')) return;
    
    try {
      const response = await fetch(`/api/logistica/tarefas/${tarefaId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao excluir tarefa');
      }
      
      await fetchFuncionario();
      showToast('Tarefa excluída com sucesso', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro desconhecido', 'error');
    }
  };

  const buscarObservacoesTarefa = async (tarefaId: string, showErrors: boolean = true) => {
    try {
      const response = await fetch(`/api/logistica/tarefas/${tarefaId}/observacoes`);
      if (!response.ok) {
        throw new Error('Erro ao buscar observações');
      }
      const observacoes = await response.json();
      setObservacoesTarefa(prev => ({ ...prev, [tarefaId]: observacoes }));
    } catch (err) {
      if (showErrors) {
        showToast(err instanceof Error ? err.message : 'Erro desconhecido', 'error');
      }
    }
  };

  const adicionarObservacaoTarefa = async (tarefaId: string) => {
    if (!novaObservacaoTarefa.texto.trim()) {
      showToast('Digite uma observação', 'warning');
      return;
    }

    try {
      const response = await fetch(`/api/logistica/tarefas/${tarefaId}/observacoes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(novaObservacaoTarefa),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao adicionar observação');
      }

      setNovaObservacaoTarefa({ texto: '', criadoPor: 'Sistema' });
      await buscarObservacoesTarefa(tarefaId);
      showToast('Observação adicionada com sucesso', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro desconhecido', 'error');
    }
  };

  const editarObservacaoTarefa = async (observacaoId: number, tarefaId: string) => {
    if (!textoEdicaoObservacao.trim()) {
      showToast('Digite uma observação', 'warning');
      return;
    }

    try {
      const response = await fetch(`/api/logistica/tarefas/observacoes/${observacaoId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          texto: textoEdicaoObservacao,
          modificadoPor: 'Sistema'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao editar observação');
      }

      setEditandoObservacao(null);
      setTextoEdicaoObservacao('');
      await buscarObservacoesTarefa(tarefaId);
      showToast('Observação editada com sucesso', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro desconhecido', 'error');
    }
  };

  const excluirObservacaoTarefa = async (observacaoId: number, tarefaId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta observação?')) return;

    try {
      const response = await fetch(`/api/logistica/tarefas/observacoes/${observacaoId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao excluir observação');
      }

      await buscarObservacoesTarefa(tarefaId);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro desconhecido', 'error');
    }
  };

  const editarDataLimiteTarefa = async (tarefaId: string) => {
    try {
      const response = await fetch(`/api/logistica/tarefas/${tarefaId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dataLimite: novaDataLimite || null
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao atualizar data prevista');
      }

      setEditandoDataLimite(null);
      setNovaDataLimite('');
      await fetchFuncionario();
      showToast('Data prevista atualizada com sucesso', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro desconhecido', 'error');
    }
  };

  const getStatusTarefasColor = (status: string) => {
    const colors: { [key: string]: string } = {
      'PENDENTE': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'CONCLUIDO': 'bg-green-100 text-green-800 border-green-200'
    };
    return colors[status] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getStatusPrestservColor = (status: string) => {
    const colors: { [key: string]: string } = {
      'PENDENTE': 'bg-gray-100 text-gray-800 border-gray-200',
      'CRIADO': 'bg-blue-100 text-blue-800 border-blue-200',
      'SUBMETIDO': 'bg-purple-100 text-purple-800 border-purple-200',
      'APROVADO': 'bg-green-100 text-green-800 border-green-200',
      'REJEITADO': 'bg-red-100 text-red-800 border-red-200'
    };
    return colors[status] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getTarefaStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      'PENDENTE': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'EM_ANDAMENTO': 'bg-orange-100 text-orange-800 border-orange-200',
      'CONCLUIDO': 'bg-green-100 text-green-800 border-green-200',
      'CANCELADO': 'bg-gray-100 text-gray-800 border-gray-200'
    };
    return colors[status] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getPrioridadeColor = (prioridade: string) => {
    const colors: { [key: string]: string } = {
      'Alta': 'bg-red-100 text-red-800 border-red-200',
      'Media': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'Baixa': 'bg-green-100 text-green-800 border-green-200'
    };
    return colors[prioridade] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const isTaskOverdue = (dataLimite: string | null) => {
    if (!dataLimite) return false;
    return new Date(dataLimite) < new Date();
  };

  const podeSubmeterPrestserv = () => {
    return funcionario?.statusTarefas === 'CONCLUIDO' && (funcionario?.statusPrestserv === 'CRIADO' || funcionario?.statusPrestserv === 'REJEITADO');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando dados do funcionário...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">❌ Erro</div>
          <p className="text-gray-600">{error}</p>
          <div className="mt-4 space-x-2">
            <button 
              onClick={fetchFuncionario}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Tentar novamente
            </button>
            <button 
              onClick={() => router.back()}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Voltar
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!funcionario) {
    return <div>Funcionário não encontrado</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <button
                onClick={() => router.back()}
                className="text-blue-600 hover:text-blue-800 mb-2 flex items-center"
              >
                ← Voltar
              </button>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {funcionario.funcionario.nome}
              </h1>
              <p className="text-gray-600">
                Matrícula: {funcionario.funcionario.matricula} | Função: {funcionario.funcionario.funcao || 'Não informada'}
              </p>
            </div>
            <div className="flex flex-col space-y-2">
              <div className="flex space-x-2">
                <span className={`px-3 py-1 text-sm font-medium rounded-full border ${getStatusTarefasColor(funcionario.statusTarefas)}`}>
                  📋 Tarefas: {funcionario.statusTarefas}
                </span>
                <span className={`px-3 py-1 text-sm font-medium rounded-full border ${getStatusPrestservColor(funcionario.statusPrestserv)}`}>
                  📄 Prestserv: {funcionario.statusPrestserv.replace('_', ' ')}
                </span>
              </div>
              {/* Indicador de Progresso das Tarefas */}
              {funcionario.tarefas && funcionario.tarefas.length > 0 && (
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <span>📊 Progresso:</span>
                  <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-xs">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${(funcionario.tarefas.filter(t => t.status === 'CONCLUIDO').length / funcionario.tarefas.length) * 100}%`
                      }}
                    ></div>
                  </div>
                  <span className="font-medium">
                    {funcionario.tarefas.filter(t => t.status === 'CONCLUIDO').length}/{funcionario.tarefas.length} concluídas
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Coluna Principal - Informações e Tarefas */}
          <div className="lg:col-span-2 space-y-6">
            {/* Informações da Solicitação */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Informações da Solicitação</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Solicitação</p>
                  <p className="font-medium">#{funcionario.solicitacao.id}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Status da Solicitação</p>
                  <span className={`inline-block px-2 py-1 text-sm font-medium rounded border ${getStatusTarefasColor(funcionario.solicitacao.status)}`}>
                    🗂️ {funcionario.solicitacao.status.replace('_', ' ')}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Contrato Origem</p>
                  <div className="font-medium">
                    {funcionario.solicitacao.contratoOrigem ? (
                      <div>
                        <p className="text-gray-900">{funcionario.solicitacao.contratoOrigem.nome}</p>
                        <p className="text-sm text-gray-500">
                          Nº {funcionario.solicitacao.contratoOrigem.numero} - {funcionario.solicitacao.contratoOrigem.cliente}
                        </p>
                      </div>
                    ) : (
                      <span className="text-orange-600 font-medium">USUÁRIO NOVO - NÃO POSSUÍA CONTRATO</span>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Contrato Destino</p>
                  <div className="font-medium">
                    {funcionario.solicitacao.contratoDestino ? (
                      <div>
                        <p className="text-gray-900">{funcionario.solicitacao.contratoDestino.nome}</p>
                        <p className="text-sm text-gray-500">
                          Nº {funcionario.solicitacao.contratoDestino.numero} - {funcionario.solicitacao.contratoDestino.cliente}
                        </p>
                      </div>
                    ) : (
                      <span className="text-gray-500">Não informado</span>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Solicitante</p>
                  <p className="font-medium">{funcionario.solicitacao.solicitante?.nome}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Data da Solicitação</p>
                  <p className="font-medium">{formatDate(funcionario.solicitacao.dataSolicitacao)}</p>
                </div>
              </div>
              {funcionario.solicitacao.justificativa && (
                <div className="mt-4">
                  <p className="text-sm text-gray-600 mb-1">Justificativa</p>
                  <p className="text-gray-800 bg-gray-50 p-3 rounded">{funcionario.solicitacao.justificativa}</p>
                </div>
              )}
            </div>

            {/* Tarefas */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Tarefas</h2>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setMostrarFormTarefa(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  >
                    + Nova Tarefa
                  </button>
                  <button
                    onClick={() => setMostrarTarefasPadrao(true)}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                  >
                    Tarefas Padrões
                  </button>
                </div>
              </div>

              {/* Formulário de Nova Tarefa */}
              {mostrarFormTarefa && (
                <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
                  <h3 className="font-medium text-gray-900 mb-3">Nova Tarefa</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
                      <input
                        type="text"
                        value={novaTarefa.tipo}
                        onChange={(e) => setNovaTarefa({ ...novaTarefa, tipo: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Ex: Documentação, Exame médico..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Responsável *</label>
                      <select
                        value={novaTarefa.responsavel}
                        onChange={(e) => setNovaTarefa({ ...novaTarefa, responsavel: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Selecione o responsável</option>
                        <option value="RH">RH - Recursos Humanos</option>
                        <option value="MEDICINA">MEDICINA - Medicina do Trabalho</option>
                        <option value="TREINAMENTO">TREINAMENTO - Treinamento</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Prioridade</label>
                      <select
                        value={novaTarefa.prioridade}
                        onChange={(e) => setNovaTarefa({ ...novaTarefa, prioridade: e.target.value as 'Baixa' | 'Media' | 'Alta' })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="Baixa">Baixa</option>
                        <option value="Media">Média</option>
                        <option value="Alta">Alta</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Data Previsão</label>
                      <input
                        type="date"
                        value={novaTarefa.dataLimite || ''}
                        onChange={(e) => setNovaTarefa({ ...novaTarefa, dataLimite: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Descrição *</label>
                    <textarea
                      value={novaTarefa.descricao}
                      onChange={(e) => setNovaTarefa({ ...novaTarefa, descricao: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Descreva a tarefa..."
                    />
                  </div>
                  <div className="mt-4 flex space-x-2">
                    <button
                      onClick={criarTarefa}
                      disabled={criandoTarefa}
                      className={`px-4 py-2 text-white rounded transition-colors ${
                        criandoTarefa 
                          ? 'bg-gray-400 cursor-not-allowed' 
                          : 'bg-green-600 hover:bg-green-700'
                      }`}
                    >
                      {criandoTarefa ? 'Criando...' : 'Criar Tarefa'}
                    </button>
                    <button
                      onClick={() => setMostrarFormTarefa(false)}
                      className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {/* Lista de Tarefas */}
              <div className="space-y-4">
                {funcionario.tarefas.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">Nenhuma tarefa cadastrada</p>
                ) : (
                  funcionario.tarefas.map((tarefa) => (
                    <div key={tarefa.id} className={`border rounded-lg p-4 ${
                      isTaskOverdue(tarefa.dataLimite) && tarefa.status !== 'CONCLUIDO' ? 'border-red-300 bg-red-50' : 'border-gray-200'
                    }`}>
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-medium text-gray-900">{tarefa.tipo}</h3>
                          <p className="text-sm text-gray-600">{tarefa.descricao}</p>
                        </div>
                        <div className="flex space-x-2">
                          <span className={`px-2 py-1 text-xs font-medium rounded border ${getTarefaStatusColor(tarefa.status)}`}>
                            {tarefa.status.replace('_', ' ')}
                          </span>
                          <span className={`px-2 py-1 text-xs font-medium rounded border ${getPrioridadeColor(tarefa.prioridade)}`}>
                            {tarefa.prioridade}
                          </span>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-gray-600 mb-3">
                        <div>Responsável: {tarefa.responsavel}</div>
                        <div className={isTaskOverdue(tarefa.dataLimite) && tarefa.status !== 'CONCLUIDO' ? 'text-red-600 font-medium' : ''}>
                          {editandoDataLimite === tarefa.id ? (
                            <div className="flex items-center space-x-2">
                              <input
                                type="date"
                                value={novaDataLimite}
                                onChange={(e) => setNovaDataLimite(e.target.value)}
                                className="border border-gray-300 rounded px-2 py-1 text-sm"
                              />
                              <button
                                onClick={() => editarDataLimiteTarefa(tarefa.id)}
                                className="text-green-600 hover:text-green-800"
                              >
                                ✓
                              </button>
                              <button
                                onClick={() => {
                                  setEditandoDataLimite(null);
                                  setNovaDataLimite('');
                                }}
                                className="text-red-600 hover:text-red-800"
                              >
                                ✗
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-2">
                              <span>Previsão: {tarefa.dataLimite ? formatDate(tarefa.dataLimite) : 'Não definida'}</span>
                              <button
                                onClick={() => {
                                  setEditandoDataLimite(tarefa.id);
                                  setNovaDataLimite(tarefa.dataLimite ? new Date(tarefa.dataLimite).toISOString().split('T')[0] : '');
                                }}
                                className="text-blue-600 hover:text-blue-800 text-xs"
                                title="Editar data previsão"
                              >
                                ✏️
                              </button>
                            </div>
                          )}
                        </div>
                        {tarefa.dataConclusao && (
                          <div>Concluída: {formatDate(tarefa.dataConclusao)}</div>
                        )}
                      </div>

                      <div className="flex space-x-2">
                        {tarefa.status === 'PENDENTE' && (
                          <>
                            <button
                              onClick={() => atualizarTarefa(tarefa.id, 'EM_ANDAMENTO')}
                              className="px-3 py-1 text-sm bg-orange-600 text-white rounded hover:bg-orange-700"
                            >
                              Iniciar
                            </button>
                            <button
                              onClick={() => atualizarTarefa(tarefa.id, 'CONCLUIDO')}
                              className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                            >
                              Concluir
                            </button>
                          </>
                        )}
                        {tarefa.status === 'EM_ANDAMENTO' && (
                          <button
                            onClick={() => atualizarTarefa(tarefa.id, 'CONCLUIDO')}
                            className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            Concluir
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setMostrarObservacoesTarefa(tarefa.id);
                            buscarObservacoesTarefa(tarefa.id);
                          }}
                          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 relative"
                        >
                          Observações
                          {observacoesTarefa[tarefa.id] && (
                            <span className="ml-1 px-1.5 py-0.5 text-xs bg-blue-800 rounded-full">
                              {observacoesTarefa[tarefa.id].length}
                            </span>
                          )}
                          {!observacoesTarefa[tarefa.id] && (
                            <span className="ml-1 px-1.5 py-0.5 text-xs bg-gray-500 rounded-full">
                              0
                            </span>
                          )}
                        </button>
                        {tarefa.status !== 'CONCLUIDO' && (
                          <button
                            onClick={() => excluirTarefa(tarefa.id)}
                            className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                          >
                            Excluir
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Coluna Lateral - Controle do Prestserv */}
          <div className="space-y-6">
            {/* Controle do Prestserv */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Controle do Prestserv</h2>
              
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600 mb-2">Status Atual</p>
                  <span className={`inline-block px-3 py-2 text-sm font-medium rounded-lg border ${getStatusPrestservColor(funcionario.statusPrestserv)}`}>
                    {funcionario.statusPrestserv.replace('_', ' ')}
                  </span>
                </div>

                {funcionario.statusTarefas === 'PENDENTE' && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                    <p className="text-sm text-yellow-800">
                      ⚠️ Aguardando conclusão das tarefas para liberar o Prestserv
                    </p>
                  </div>
                )}

                {podeSubmeterPrestserv() && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded">
                    <p className="text-sm text-green-800">
                      ✅ Funcionário apto para submissão do Prestserv
                    </p>
                  </div>
                )}

                {/* Ações do Prestserv */}
                <div className="space-y-2">
                  {funcionario.statusPrestserv !== 'APROVADO' && (
                    <select
                      value=""
                      onChange={(e) => {
                        const acao = e.target.value;
                        
                        // Validações baseadas no status atual
                        if (acao === 'criar-rascunho') {
                          if (funcionario.statusPrestserv !== 'PENDENTE') {
                            showToast('Só é possível criar rascunho quando o status está PENDENTE', 'warning');
                            e.target.value = '';
                            return;
                          }
                          atualizarStatusPrestserv('CRIADO');
                        } else if (acao === 'submeter') {
                           if (funcionario.statusPrestserv !== 'CRIADO' && funcionario.statusPrestserv !== 'REJEITADO') {
                             showToast('Só é possível submeter quando o rascunho foi criado ou rejeitado', 'warning');
                             e.target.value = '';
                             return;
                           }
                           if (!podeSubmeterPrestserv()) {
                             showToast('Todas as tarefas devem estar concluídas antes de submeter', 'warning');
                             e.target.value = '';
                             return;
                           }
                           setAcaoPrestserv('submeter');
                           setNovaObservacao({ observacao: '' });
                           setMostrarObservacao(true);
                        } else if (acao === 'aprovar') {
                          if (funcionario.statusPrestserv !== 'SUBMETIDO') {
                            showToast('Só é possível aprovar quando o prestserv foi submetido', 'warning');
                            e.target.value = '';
                            return;
                          }
                          setAcaoPrestserv('aprovar');
                          setNovaObservacao({ observacao: '' });
                          setMostrarObservacao(true);
                        } else if (acao === 'rejeitar') {
                          if (funcionario.statusPrestserv !== 'SUBMETIDO') {
                            showToast('Só é possível rejeitar quando o prestserv foi submetido', 'warning');
                            e.target.value = '';
                            return;
                          }
                          setAcaoPrestserv('rejeitar');
                          setNovaObservacao({ observacao: '' });
                          setMostrarObservacao(true);
                        }
                        
                        e.target.value = ''; // Reset select
                      }}
                      disabled={atualizandoStatus}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      <option value="">📋 Ações do Prestserv</option>
                       <option value="criar-rascunho">📝 Criar Rascunho</option>
                       <option value="submeter">📤 Submeter para Aprovação</option>
                       <option value="aprovar">✅ Aprovar</option>
                       <option value="rejeitar">❌ Rejeitar</option>
                    </select>
                  )}
                  
                  {funcionario.statusPrestserv === 'REJEITADO' && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                    ⚠️ Prestserv rejeitado. Crie novas tarefas para tratar as pendências e submeta novamente.
                  </div>
                )}
                  
                  {funcionario.statusPrestserv === 'APROVADO' && (
                    <div className="w-full px-4 py-2 bg-green-100 text-green-800 rounded border border-green-300 text-center">
                      ✅ Prestserv Aprovado
                    </div>
                  )}
                </div>
              </div>

              {/* Histórico */}
               <div className="mt-6 pt-4 border-t border-gray-200">
                 <h3 className="font-medium text-gray-900 mb-3">Histórico</h3>
                 <HistoricoSimplificado funcionarioId={funcionario.id} />
               </div>

              {/* Observações */}
              {funcionario.observacoesPrestserv && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h3 className="font-medium text-gray-900 mb-2">Observações</h3>
                  <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded">
                    {funcionario.observacoesPrestserv}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal de Observação */}
        {mostrarObservacao && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg w-96">
              <h3 className="text-lg font-semibold mb-4">
                {acaoPrestserv === 'submeter' && '📤 Submeter para Aprovação'}
                {acaoPrestserv === 'aprovar' && '✅ Aprovar Prestserv'}
                {acaoPrestserv === 'rejeitar' && '❌ Rejeitar Prestserv'}
              </h3>
              <textarea
                value={novaObservacao.observacao}
                onChange={(e) => setNovaObservacao({ observacao: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Digite uma observação (opcional)..."
              />
              <div className="mt-4 flex space-x-2">
                <button
                  onClick={() => {
                    let novoStatus: StatusPrestserv;
                    
                    if (acaoPrestserv === 'submeter') {
                      novoStatus = 'SUBMETIDO';
                    } else if (acaoPrestserv === 'aprovar') {
                      novoStatus = 'APROVADO';
                    } else if (acaoPrestserv === 'rejeitar') {
                      novoStatus = 'REJEITADO';
                    } else {
                      return;
                    }
                    
                    atualizarStatusPrestserv(novoStatus, novaObservacao.observacao);
                  }}
                  disabled={atualizandoStatus}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {atualizandoStatus ? 'Salvando...' : 'Confirmar'}
                </button>
                <button
                  onClick={() => {
                    setMostrarObservacao(false);
                    setNovaObservacao({ observacao: '' });
                    setAcaoPrestserv(null);
                  }}
                  className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>


      {/* Modal de Observações da Tarefa */}
      {mostrarObservacoesTarefa && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Observações da Tarefa</h3>
              <button
                onClick={() => {
                  setMostrarObservacoesTarefa(null);
                  setEditandoObservacao(null);
                  setTextoEdicaoObservacao('');
                  setNovaObservacaoTarefa({ texto: '', criadoPor: 'Sistema' });
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            {/* Adicionar Nova Observação */}
            <div className="mb-6">
              <h4 className="font-medium mb-2">Adicionar Observação</h4>
              <div className="space-y-3">
                <textarea
                  value={novaObservacaoTarefa.texto}
                  onChange={(e) => setNovaObservacaoTarefa({ ...novaObservacaoTarefa, texto: e.target.value })}
                  placeholder="Digite sua observação..."
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
                <button
                  onClick={() => adicionarObservacaoTarefa(mostrarObservacoesTarefa)}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Adicionar Observação
                </button>
              </div>
            </div>

            {/* Lista de Observações */}
            <div>
              <h4 className="font-medium mb-3">Observações Existentes</h4>
              {observacoesTarefa[mostrarObservacoesTarefa]?.length > 0 ? (
                <div className="space-y-3">
                  {observacoesTarefa[mostrarObservacoesTarefa].map((obs) => (
                    <div key={obs.id} className="border border-gray-200 rounded-lg p-4">
                      {editandoObservacao === obs.id ? (
                        <div className="space-y-3">
                          <textarea
                            value={textoEdicaoObservacao}
                            onChange={(e) => setTextoEdicaoObservacao(e.target.value)}
                            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            rows={3}
                          />
                          <div className="flex space-x-2">
                            <button
                              onClick={() => editarObservacaoTarefa(obs.id, mostrarObservacoesTarefa)}
                              className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                            >
                              Salvar
                            </button>
                            <button
                              onClick={() => {
                                setEditandoObservacao(null);
                                setTextoEdicaoObservacao('');
                              }}
                              className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <p className="text-gray-800 mb-2">{obs.texto}</p>
                          <div className="flex justify-between items-center text-sm text-gray-500">
                            <div>
                              <span>Criado por: {obs.criadoPor}</span>
                              <span className="ml-4">Em: {new Date(obs.dataCriacao).toLocaleString('pt-BR')}</span>
                              {obs.dataModificacao !== obs.dataCriacao && (
                                <span className="ml-4">Modificado: {new Date(obs.dataModificacao).toLocaleString('pt-BR')}</span>
                              )}
                            </div>
                            <div className="flex space-x-2">
                              <button
                                onClick={() => {
                                  setEditandoObservacao(obs.id);
                                  setTextoEdicaoObservacao(obs.texto);
                                }}
                                className="text-blue-600 hover:text-blue-800 text-sm"
                              >
                                Editar
                              </button>
                              <button
                                onClick={() => excluirObservacaoTarefa(obs.id, mostrarObservacoesTarefa)}
                                className="text-red-600 hover:text-red-800 text-sm"
                              >
                                Excluir
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">Nenhuma observação encontrada.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Tarefas Padrões */}
      <TarefasPadraoModal
        isOpen={mostrarTarefasPadrao}
        onClose={() => setMostrarTarefasPadrao(false)}
        funcionario={funcionario}
        onSuccess={() => {
          fetchFuncionario();
          setMostrarTarefasPadrao(false);
        }}
      />
    </div>
  );
}