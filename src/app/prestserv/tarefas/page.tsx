'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TarefaRemanejamento, StatusTarefa } from '@/types/remanejamento-funcionario';
import HistoricoRemanejamento from '@/components/HistoricoRemanejamento';

interface NovaTarefa {
  tipo: string;
  descricao: string;
  responsavel: string;
  prioridade: 'Baixa' | 'Media' | 'Alta';
  dataLimite?: string;
  remanejamentoFuncionarioId: string;
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

interface TarefaComFuncionario extends TarefaRemanejamento {
  remanejamentoFuncionario?: {
    funcionario: {
      nome: string;
      matricula: string;
    };
  };
}

export default function TarefasPage() {
  const router = useRouter();
  
  const [tarefas, setTarefas] = useState<TarefaComFuncionario[]>([]);
  const [funcionarios, setFuncionarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [criandoTarefa, setCriandoTarefa] = useState(false);
  const [mostrarFormTarefa, setMostrarFormTarefa] = useState(false);
  // const [mostrarTarefasPadrao, setMostrarTarefasPadrao] = useState(false);
  const [observacoesTarefa, setObservacoesTarefa] = useState<{ [tarefaId: string]: ObservacaoTarefa[] }>({});
  const [mostrarObservacoesTarefa, setMostrarObservacoesTarefa] = useState<string | null>(null);
  const [novaObservacaoTarefa, setNovaObservacaoTarefa] = useState<NovaObservacaoTarefa>({ texto: '', criadoPor: 'Sistema' });
  const [editandoObservacao, setEditandoObservacao] = useState<number | null>(null);
  const [textoEdicaoObservacao, setTextoEdicaoObservacao] = useState('');
  const [abaAtiva, setAbaAtiva] = useState<'observacoes' | 'historico'>('observacoes');
  const [editandoDataLimite, setEditandoDataLimite] = useState<string | null>(null);
  const [novaDataLimite, setNovaDataLimite] = useState('');
  const [editandoTarefa, setEditandoTarefa] = useState<string | null>(null);
  const [tarefaEditando, setTarefaEditando] = useState<NovaTarefa>({
    tipo: '',
    descricao: '',
    responsavel: '',
    prioridade: 'Media'
  });
  const [novaTarefa, setNovaTarefa] = useState<NovaTarefa>({
    tipo: '',
    descricao: '',
    responsavel: '',
    prioridade: 'Media',
    remanejamentoFuncionarioId: ''
  });

  // Filtros
  const [filtroStatus, setFiltroStatus] = useState<string>('TODOS');
  const [filtroPrioridade, setFiltroPrioridade] = useState<string>('TODOS');
  const [filtroResponsavel, setFiltroResponsavel] = useState<string>('');
  const [filtroTipo, setFiltroTipo] = useState<string>('');

  useEffect(() => {
    fetchTarefas();
    fetchFuncionarios();
  }, []);

  useEffect(() => {
    // Carregar observações para todas as tarefas quando as tarefas são carregadas
    if (tarefas.length > 0) {
      tarefas.forEach(tarefa => {
        buscarObservacoesTarefa(tarefa.id, false); // false para não mostrar loading
      });
    }
  }, [tarefas]);

  const fetchTarefas = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/logistica/tarefas');
      
      if (!response.ok) {
        throw new Error('Erro ao carregar tarefas');
      }
      
      const data = await response.json();
      setTarefas(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  const fetchFuncionarios = async () => {
    try {
      const response = await fetch('/api/logistica/funcionarios');
      if (response.ok) {
        const data = await response.json();
        setFuncionarios(data);
      }
    } catch (err) {
      console.error('Erro ao carregar funcionários:', err);
    }
  };

  const criarTarefa = async () => {
    if (!novaTarefa.tipo || !novaTarefa.descricao || !novaTarefa.responsavel || !novaTarefa.remanejamentoFuncionarioId) {
      alert('Preencha todos os campos obrigatórios (incluindo funcionário)');
      return;
    }
    
    // Validar se é possível criar tarefas baseado no status do prestserv
    const funcionarioSelecionado = funcionarios.find(f => f.id === novaTarefa.remanejamentoFuncionarioId);
    if (funcionarioSelecionado && (funcionarioSelecionado.statusPrestserv === 'SUBMETIDO' || funcionarioSelecionado.statusPrestserv === 'APROVADO')) {
      alert('Não é possível criar novas tarefas quando o prestserv está submetido ou aprovado');
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
        body: JSON.stringify(novaTarefa),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao criar tarefa');
      }
      
      await fetchTarefas();
      setMostrarFormTarefa(false);
      setNovaTarefa({
        tipo: '',
        descricao: '',
        responsavel: '',
        prioridade: 'Media',
        remanejamentoFuncionarioId: ''
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setCriandoTarefa(false);
    }
  };

  const editarTarefa = async (tarefaId: string) => {
    if (!tarefaEditando.tipo || !tarefaEditando.descricao || !tarefaEditando.responsavel) {
      alert('Preencha todos os campos obrigatórios');
      return;
    }
    
    try {
      const response = await fetch(`/api/logistica/tarefas/${tarefaId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tipo: tarefaEditando.tipo,
          descricao: tarefaEditando.descricao,
          responsavel: tarefaEditando.responsavel,
          prioridade: tarefaEditando.prioridade,
          dataLimite: tarefaEditando.dataLimite || null
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao editar tarefa');
      }
      
      await fetchTarefas();
      setEditandoTarefa(null);
      setTarefaEditando({
        tipo: '',
        descricao: '',
        responsavel: '',
        prioridade: 'Media'
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro desconhecido');
    }
  };

  const atualizarStatusTarefa = async (tarefaId: string, status: StatusTarefa) => {
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
      
      await fetchTarefas();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro desconhecido');
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
      
      await fetchTarefas();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro desconhecido');
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
      await fetchTarefas();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro desconhecido');
    }
  };

  // Funções de observações
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
        alert(err instanceof Error ? err.message : 'Erro desconhecido');
      }
    }
  };

  const adicionarObservacaoTarefa = async (tarefaId: string) => {
    if (!novaObservacaoTarefa.texto.trim()) {
      alert('Digite uma observação');
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
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro desconhecido');
    }
  };

  const editarObservacaoTarefa = async (observacaoId: number, tarefaId: string) => {
    if (!textoEdicaoObservacao.trim()) {
      alert('Digite uma observação');
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
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro desconhecido');
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
      alert(err instanceof Error ? err.message : 'Erro desconhecido');
    }
  };

  // Funções auxiliares
  const getStatusColor = (status: StatusTarefa) => {
    const colors = {
      'PENDENTE': 'bg-yellow-100 text-yellow-800',
      'EM_ANDAMENTO': 'bg-blue-100 text-blue-800',
      'CONCLUIDO': 'bg-green-100 text-green-800',
      'CANCELADO': 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getPrioridadeColor = (prioridade: string) => {
    const colors = {
      'Baixa': 'bg-green-100 text-green-800',
      'Media': 'bg-yellow-100 text-yellow-800',
      'Alta': 'bg-orange-100 text-orange-800'
    };
    return colors[prioridade] || 'bg-gray-100 text-gray-800';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const isTaskOverdue = (dataLimite: string | null) => {
    if (!dataLimite) return false;
    return new Date(dataLimite) < new Date();
  };

  // Filtrar tarefas
  const tarefasFiltradas = tarefas.filter(tarefa => {
    const matchStatus = filtroStatus === 'TODOS' || tarefa.status === filtroStatus;
    const matchPrioridade = filtroPrioridade === 'TODOS' || tarefa.prioridade === filtroPrioridade;
    const matchResponsavel = !filtroResponsavel || tarefa.responsavel.toLowerCase().includes(filtroResponsavel.toLowerCase());
    const matchTipo = !filtroTipo || tarefa.tipo.toLowerCase().includes(filtroTipo.toLowerCase());
    
    return matchStatus && matchPrioridade && matchResponsavel && matchTipo;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando tarefas...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold text-gray-900">Gerenciamento de Tarefas</h1>
            <div className="flex space-x-3">
              <button
                onClick={() => setMostrarFormTarefa(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Nova Tarefa
              </button>
            </div>
          </div>

          {/* Filtros */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="TODOS">Todos</option>
                <option value="PENDENTE">Pendente</option>
                <option value="EM_ANDAMENTO">Em Andamento</option>
                <option value="CONCLUIDO">Concluído</option>
                <option value="CANCELADO">Cancelado</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prioridade</label>
              <select
                value={filtroPrioridade}
                onChange={(e) => setFiltroPrioridade(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="TODOS">Todas</option>
                <option value="Baixa">Baixa</option>
                <option value="Media">Média</option>
                <option value="Alta">Alta</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Responsável</label>
              <input
                type="text"
                value={filtroResponsavel}
                onChange={(e) => setFiltroResponsavel(e.target.value)}
                placeholder="Filtrar por responsável"
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <input
                type="text"
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
                placeholder="Filtrar por tipo"
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Lista de Tarefas */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Tarefas ({tarefasFiltradas.length})
            </h2>
            
            {tarefasFiltradas.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">Nenhuma tarefa encontrada.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {tarefasFiltradas.map((tarefa) => (
                  <div key={tarefa.id} className="border border-gray-200 rounded-lg p-4">
                    {editandoTarefa === tarefa.id ? (
                      /* Formulário de Edição */
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                            <input
                              type="text"
                              value={tarefaEditando.tipo}
                              onChange={(e) => setTarefaEditando({ ...tarefaEditando, tipo: e.target.value })}
                              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Responsável</label>
                            <input
                              type="text"
                              value={tarefaEditando.responsavel}
                              onChange={(e) => setTarefaEditando({ ...tarefaEditando, responsavel: e.target.value })}
                              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Prioridade</label>
                            <select
                              value={tarefaEditando.prioridade}
                              onChange={(e) => setTarefaEditando({ ...tarefaEditando, prioridade: e.target.value as 'Baixa' | 'Media' | 'Alta' })}
                              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="Baixa">Baixa</option>
                              <option value="Media">Média</option>
                              <option value="Alta">Alta</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Data Prevista</label>
                            <input
                              type="date"
                              value={tarefaEditando.dataLimite || ''}
                              onChange={(e) => setTarefaEditando({ ...tarefaEditando, dataLimite: e.target.value })}
                              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                          <textarea
                            value={tarefaEditando.descricao}
                            onChange={(e) => setTarefaEditando({ ...tarefaEditando, descricao: e.target.value })}
                            rows={3}
                            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => editarTarefa(tarefa.id)}
                            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            Salvar
                          </button>
                          <button
                            onClick={() => {
                              setEditandoTarefa(null);
                              setTarefaEditando({
                                tipo: '',
                                descricao: '',
                                responsavel: '',
                                prioridade: 'Media'
                              });
                            }}
                            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Visualização da Tarefa */
                      <div>
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900">{tarefa.tipo}</h3>
                            <p className="text-gray-600 mt-1">{tarefa.descricao}</p>
                          </div>
                          <div className="flex space-x-2 ml-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(tarefa.status)}`}>
                              {tarefa.status.replace('_', ' ')}
                            </span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPrioridadeColor(tarefa.prioridade)}`}>
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
                                <span>Limite: {tarefa.dataLimite ? formatDate(tarefa.dataLimite) : 'Não definida'}</span>
                                <button
                                  onClick={() => {
                                    setEditandoDataLimite(tarefa.id);
                                    setNovaDataLimite(tarefa.dataLimite ? new Date(tarefa.dataLimite).toISOString().split('T')[0] : '');
                                  }}
                                  className="text-blue-600 hover:text-blue-800 text-xs"
                                  title="Editar data prevista"
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
                        
                        <div className="flex flex-wrap gap-2">
                          {tarefa.status !== 'CONCLUIDO' && (
                            <button
                              onClick={() => atualizarStatusTarefa(tarefa.id, 'CONCLUIDO')}
                              className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                            >
                              Concluir
                            </button>
                          )}
                          {tarefa.status === 'CONCLUIDO' && (
                            <button
                              onClick={() => atualizarStatusTarefa(tarefa.id, 'PENDENTE')}
                              className="px-3 py-1 text-sm bg-yellow-600 text-white rounded hover:bg-yellow-700"
                            >
                              Reabrir
                            </button>
                          )}
                          {tarefa.status === 'PENDENTE' && (
                            <button
                              onClick={() => atualizarStatusTarefa(tarefa.id, 'EM_ANDAMENTO')}
                              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                              Iniciar
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setMostrarObservacoesTarefa(tarefa.id);
                              buscarObservacoesTarefa(tarefa.id);
                            }}
                            className="px-3 py-1 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 relative"
                          >
                            Observações
                            {observacoesTarefa[tarefa.id] && (
                              <span className="ml-1 px-1.5 py-0.5 text-xs bg-purple-800 rounded-full">
                                {observacoesTarefa[tarefa.id].length}
                              </span>
                            )}
                            {!observacoesTarefa[tarefa.id] && (
                              <span className="ml-1 px-1.5 py-0.5 text-xs bg-gray-500 rounded-full">
                                0
                              </span>
                            )}
                          </button>
                          <button
                            onClick={() => {
                              setEditandoTarefa(tarefa.id);
                              setTarefaEditando({
                                tipo: tarefa.tipo,
                                descricao: tarefa.descricao,
                                responsavel: tarefa.responsavel,
                                prioridade: tarefa.prioridade as 'Baixa' | 'Media' | 'Alta',
                                dataLimite: tarefa.dataLimite ? new Date(tarefa.dataLimite).toISOString().split('T')[0] : ''
                              });
                            }}
                            className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => excluirTarefa(tarefa.id)}
                            className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                          >
                            Excluir
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Nova Tarefa */}
      {mostrarFormTarefa && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Nova Tarefa</h3>
              <button
                onClick={() => {
                  setMostrarFormTarefa(false);
                  setNovaTarefa({
                    tipo: '',
                    descricao: '',
                    responsavel: '',
                    prioridade: 'Media',
                    remanejamentoFuncionarioId: ''
                  });
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
                  <input
                    type="text"
                    value={novaTarefa.tipo}
                    onChange={(e) => setNovaTarefa({ ...novaTarefa, tipo: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: Admissão, Exame médico, Treinamento"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Setor Responsável *</label>
                  <select
                    value={novaTarefa.responsavel}
                    onChange={(e) => setNovaTarefa({ ...novaTarefa, responsavel: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Selecione o setor responsável</option>
                    <option value="RH">RH</option>
                    <option value="Medicina">Medicina</option>
                    <option value="Treinamento">Treinamento</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prioridade</label>
                  <select
                    value={novaTarefa.prioridade}
                    onChange={(e) => setNovaTarefa({ ...novaTarefa, prioridade: e.target.value as 'Baixa' | 'Media' | 'Alta' })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Baixa">Baixa</option>
                    <option value="Media">Média</option>
                    <option value="Alta">Alta</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data Prevista</label>
                  <input
                    type="date"
                    value={novaTarefa.dataLimite || ''}
                    onChange={(e) => setNovaTarefa({ ...novaTarefa, dataLimite: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Funcionário *</label>
                  <select
                    value={novaTarefa.remanejamentoFuncionarioId || ''}
                    onChange={(e) => setNovaTarefa({ ...novaTarefa, remanejamentoFuncionarioId: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Selecione um funcionário</option>
                      {funcionarios.map((func) => (
                        <option key={func.id} value={func.id}>
                          {func.nome} - {func.matricula}
                        </option>
                      ))}
                  </select>
                  {funcionarios.length === 0 && (
                    <p className="text-sm text-gray-500 mt-1">Nenhum funcionário em remanejamento encontrado</p>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição *</label>
                <textarea
                  value={novaTarefa.descricao}
                  onChange={(e) => setNovaTarefa({ ...novaTarefa, descricao: e.target.value })}
                  rows={3}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Descreva a tarefa..."
                />
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setMostrarFormTarefa(false);
                    setNovaTarefa({
                      tipo: '',
                      descricao: '',
                      responsavel: '',
                      prioridade: 'Media',
                      remanejamentoFuncionarioId: ''
                    });
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={criarTarefa}
                  disabled={criandoTarefa}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {criandoTarefa ? 'Criando...' : 'Criar Tarefa'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Tarefas Padrão - Removido temporariamente */}

      {/* Modal de Observações da Tarefa */}
      {mostrarObservacoesTarefa && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Detalhes da Tarefa</h3>
              <button
                onClick={() => {
                  setMostrarObservacoesTarefa(null);
                  setEditandoObservacao(null);
                  setTextoEdicaoObservacao('');
                  setNovaObservacaoTarefa({ texto: '', criadoPor: 'Sistema' });
                  setAbaAtiva('observacoes');
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            {/* Abas */}
            <div className="flex border-b border-gray-200 mb-6">
              <button
                onClick={() => setAbaAtiva('observacoes')}
                className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                  abaAtiva === 'observacoes'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Observações
              </button>
              <button
                onClick={() => setAbaAtiva('historico')}
                className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                  abaAtiva === 'historico'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Histórico
              </button>
            </div>

            {/* Conteúdo das Abas */}
            {abaAtiva === 'observacoes' && (
              <>
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
              </>
            )}

            {/* Aba de Histórico */}
            {abaAtiva === 'historico' && (
              <div>
                <h4 className="font-medium mb-3">Histórico da Tarefa</h4>
                <HistoricoRemanejamento
                  tarefaId={mostrarObservacoesTarefa}
                  entidade="tarefa"
                  showFilters={false}
                />
              </div>
            )}
          </div>
        </div>
      )}


    </div>
  );
}