'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  BuildingOfficeIcon,
  UsersIcon,
  AcademicCapIcon,
  ChevronLeftIcon,
  PlusIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  CheckIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon
} from '@heroicons/react/24/outline';
import ProtectedRoute from '@/components/ProtectedRoute';
import { ROUTE_PROTECTION } from '@/lib/permissions';
import ModalTreinamentos from './modal-novo';

interface Contrato {
  id: number;
  nome: string;
  numero: string;
  cliente: string;
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

interface Treinamento {
  id: number;
  treinamento: string;
  cargaHoraria: number;
  validadeValor: number;
  validadeUnidade: string;
}

interface TipoObrigatoriedade {
  value: string;
  label: string;
}

interface ApiResponse {
  success: boolean;
  data: {
    contrato: Contrato;
    funcoes: Funcao[];
  };
  filters?: {
    treinamentos: Treinamento[];
    tiposObrigatoriedade: TipoObrigatoriedade[];
  };
  message?: string;
  error?: string;
}

export default function ContratoDetalhePage() {
  return (
    <ProtectedRoute 
      requiredPermissions={ROUTE_PROTECTION.MATRIZ_TREINAMENTO.requiredPermissions}
      requiredEquipe={ROUTE_PROTECTION.MATRIZ_TREINAMENTO.requiredEquipe}
    >
      <ContratoDetalheContent />
    </ProtectedRoute>
  );
}

function ContratoDetalheContent() {
  const params = useParams();
  const router = useRouter();
  const contratoId = parseInt(params.id as string);

  const [contrato, setContrato] = useState<Contrato | null>(null);
  const [funcoes, setFuncoes] = useState<Funcao[]>([]);
  const [todasFuncoes, setTodasFuncoes] = useState<{id: number, funcao: string, regime: string | null}[]>([]);
  const [treinamentos, setTreinamentos] = useState<Treinamento[]>([]);
  const [tiposObrigatoriedade, setTiposObrigatoriedade] = useState<TipoObrigatoriedade[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedFuncao, setExpandedFuncao] = useState<number | null>(null);
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [showAddFuncaoModal, setShowAddFuncaoModal] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [selectedFuncao, setSelectedFuncao] = useState<number | null>(null);
  const [funcoesSelecionadas, setFuncoesSelecionadas] = useState<number[]>([]);
  // Estados para filtros e busca
  const [buscaFuncao, setBuscaFuncao] = useState('');
  // Estado para upload
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Estados auxiliares
  const [savingObrigatoriedadeId, setSavingObrigatoriedadeId] = useState<number | null>(null);
  const [buscaTreinamento, setBuscaTreinamento] = useState('');
  const [filtroObrigatoriedade, setFiltroObrigatoriedade] = useState('');
  const [filtroRegime, setFiltroRegime] = useState('');



  // Exportar XLSX V2 (funções nas linhas, treinamentos nas colunas)
  const handleExportV2 = async () => {
    try {
      if (!contratoId) return;
      const res = await fetch(`/api/matriz-treinamento/contratos/${contratoId}/export-v2`, { cache: 'no-store' });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Falha ao exportar XLSX V2');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const nomeContrato = contrato?.nome ? contrato.nome.replace(/[^a-zA-Z0-9-_ ]/g, '') : `contrato-${contratoId}`;
      a.download = `matriz_treinamento_${nomeContrato}_v2.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Erro ao exportar XLSX V2:', err);
      alert(err instanceof Error ? err.message : 'Erro ao exportar XLSX V2');
    }
  };

  // Importar XLSX
  const triggerImportSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleImportChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/matriz-treinamento/contratos/${contratoId}/import`, {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || json.message || 'Falha ao importar XLSX');
      }
      const stats = json.stats || json.data?.stats || {};
      const criados = stats.criados ?? 0;
      const atualizados = stats.atualizados ?? 0;
      const removidos = stats.removidos ?? 0;
      const ignorados = stats.ignorados ?? 0;
      const erros = stats.erros ?? 0;
      const errosDetalhes: string[] = Array.isArray(json.errors) ? json.errors : [];

      console.log('Importação concluída. Estatísticas:', stats);
      if (errosDetalhes.length) {
        console.error('Erros na importação:', errosDetalhes);
      }

      const linhasResumo: string[] = [
        'Importação concluída:',
        `- Criados: ${criados}`,
        `- Atualizados: ${atualizados}`,
        `- Removidos: ${removidos}`,
        `- Ignorados: ${ignorados}`,
        `- Erros: ${erros}`,
      ];

      if (errosDetalhes.length) {
        const mostrados = errosDetalhes.slice(0, 20);
        linhasResumo.push('', 'Alguns erros:', ...mostrados.map((msg, i) => `${i + 1}. ${msg}`));
        if (errosDetalhes.length > mostrados.length) {
          linhasResumo.push(`... e mais ${errosDetalhes.length - mostrados.length} erro(s). Consulte o console para lista completa.`);
        }
      }

      alert(linhasResumo.join('\n'));
      await fetchContratoDetalhes();
    } catch (err) {
      console.error('Erro ao importar XLSX:', err);
      alert(err instanceof Error ? err.message : 'Erro ao importar XLSX');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  useEffect(() => {
    if (contratoId) {
      setLoading(true);
      fetchContratoDetalhes();
      fetchTodasFuncoes();
    }
  }, [contratoId]);

  const fetchContratoDetalhes = async () => {
    try {
      const response = await fetch(`/api/matriz-treinamento/contratos/${contratoId}`, { cache: 'no-store' });
      const data: ApiResponse = await response.json();
      if (!data.success) {
        console.error('Erro ao buscar detalhes do contrato:', data.error);
        alert(data.error || 'Erro ao buscar detalhes do contrato');
        setLoading(false);
        return;
      }
      setContrato(data.data.contrato);
      setFuncoes(data.data.funcoes);
      setTiposObrigatoriedade(data.filters?.tiposObrigatoriedade || []);
      setTreinamentos(data.filters?.treinamentos || []);
      setLoading(false);
    } catch (error) {
      console.error('Erro ao buscar detalhes do contrato:', error);
      alert('Erro ao buscar detalhes do contrato');
      setLoading(false);
    }
  };

  const fetchTodasFuncoes = async () => {
    try {
      // Buscar TODAS as funções (paginada), sem filtrar por ativo
      const response = await fetch('/api/funcoes?page=1&limit=10000', { cache: 'no-store' });
      // Clonar resposta para inspeção de texto bruto em caso de formato inesperado
      const responseClone = response.clone();
      let rawText: string | null = null;
      try {
        rawText = await responseClone.text();
      } catch {
        rawText = null;
      }

      let data: any = null;
      try {
        data = await response.json();
      } catch (parseErr) {
        console.error('Falha ao parsear JSON de /api/funcoes:', parseErr, '| status:', response.status, '| body:', rawText?.slice(0, 500));
        setTodasFuncoes([]);
        return;
      }

      // Aceitar diferentes formatos de resposta
      let funcoesLista: any[] = [];
      if (Array.isArray(data)) {
        funcoesLista = data;
      } else if (data && Array.isArray(data.data)) {
        funcoesLista = data.data;
      } else if (data && Array.isArray(data.funcoes)) {
        funcoesLista = data.funcoes;
      } else {
        console.error('Resposta inesperada ao buscar funções:', data, '| status:', response.status, '| body:', rawText?.slice(0, 500));
        setTodasFuncoes([]);
        return;
      }

      console.log('[Funcoes/ALL] total:', funcoesLista.length);
      setTodasFuncoes(funcoesLista);
    } catch (error) {
      console.error('Erro ao buscar funções:', error);
      setTodasFuncoes([]);
    }
  };

  // Definição duplicada de fetchContratoDetalhes removida para evitar conflitos.


  // Atualizar tipo de obrigatoriedade de um item da matriz
  const handleChangeObrigatoriedade = async (matrizId: number, novoTipo: string) => {
    try {
      setSavingObrigatoriedadeId(matrizId);
      const resp = await fetch(`/api/matriz-treinamento/${matrizId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipoObrigatoriedade: novoTipo })
      });
      const result = await resp.json();
      if (!resp.ok || !result.success) {
        throw new Error(result.message || 'Erro ao atualizar obrigatoriedade');
      }
      await fetchContratoDetalhes();
    } catch (err) {
      console.error('Falha ao atualizar obrigatoriedade:', err);
      alert(err instanceof Error ? err.message : 'Falha ao atualizar obrigatoriedade');
    } finally {
      setSavingObrigatoriedadeId(null);
    }
  };

  const openModal = (funcaoId: number) => {
    setSelectedFuncao(funcaoId);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedFuncao(null);
  };

  const closeFuncaoModal = () => {
    setShowAddFuncaoModal(false);
    setFuncoesSelecionadas([]);
    setModalLoading(false);
    setBuscaFuncao('');
    setFiltroRegime('');
  };

  // Função para confirmar seleção de funções
  const handleConfirmarSelecao = async () => {
    if (funcoesSelecionadas.length === 0) return;

    try {
      const funcoesNovas = funcoesSelecionadas.filter(id => 
        !funcoes.some(f => f.id === id)
      );

      let mensagem = '';

      // Se há funções novas para adicionar
      if (funcoesNovas.length > 0) {
        const response = await fetch(`/api/matriz-treinamento/contratos/${contrato?.id}/funcoes`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            funcaoIds: funcoesNovas
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Erro ao adicionar funções');
        }

        mensagem += `${data.data.adicionadas} função(ões) adicionada(s). `;
      }

      // Se há funções existentes para remover
      const funcoesParaRemover = funcoes
        .filter(f => !funcoesSelecionadas.includes(f.id))
        .map(f => f.id);

      if (funcoesParaRemover.length > 0) {
        const response = await fetch(`/api/matriz-treinamento/contratos/${contrato?.id}/funcoes`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            funcaoIds: funcoesParaRemover
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Erro ao remover funções');
        }

        mensagem += `${data.data.removidas} função(ões) removida(s). `;
      }

      // Recarregar dados
      await fetchContratoDetalhes();
      
      // Fechar modal
      closeFuncaoModal();

      // Mostrar mensagem de sucesso
      alert(mensagem || 'Funções atualizadas com sucesso!');

    } catch (error) {
      console.error('Erro ao confirmar seleção:', error);
      alert('Erro ao salvar alterações: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    }
  };

  // Função para abrir modal e carregar funções já existentes
  const openFuncaoModal = () => {
    setShowAddFuncaoModal(true);
    // Carregar funções que já estão na matriz
    const funcoesExistentes = funcoes.map(f => f.id);
    setFuncoesSelecionadas(funcoesExistentes);
  };

  const handleSubmit = async (treinamentosSelecionados: number[], tipoObrigatoriedadeGlobal: string) => {
    if (!selectedFuncao || treinamentosSelecionados.length === 0 || !tipoObrigatoriedadeGlobal) {
      alert('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    try {
      setModalLoading(true);
      
      // Criar múltiplos treinamentos
      const promises = treinamentosSelecionados.map(treinamentoId => 
        fetch('/api/matriz-treinamento', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contratoId,
            funcaoId: selectedFuncao,
            treinamentoId,
            tipoObrigatoriedade: tipoObrigatoriedadeGlobal
          }),
        })
      );

      const responses = await Promise.all(promises);
      const results = await Promise.all(responses.map(r => r.json()));
      
      const errors = results.filter(r => !r.success);
      if (errors.length > 0) {
        alert(`Erro ao adicionar ${errors.length} treinamento(s)`);
      } else {
        alert(`${treinamentosSelecionados.length} treinamento(s) adicionado(s) com sucesso!`);
        await fetchContratoDetalhes();
        closeModal();
      }
    } catch (error) {
      console.error('Erro ao adicionar treinamentos:', error);
      alert('Erro ao adicionar treinamentos');
    } finally {
      setModalLoading(false);
    }
  };

  // Função para alternar seleção de função
  const handleFuncaoToggle = (funcaoId: string) => {
    const funcaoIdNum = parseInt(funcaoId);
    setFuncoesSelecionadas(prev => {
      if (prev.includes(funcaoIdNum)) {
        // Remove a função e seus treinamentos
        return prev.filter(id => id !== funcaoIdNum);
      } else {
        // Adiciona a função
        return [...prev, funcaoIdNum];
      }
    });
  };

  const handleRemoveTreinamento = async (matrizId: number) => {
    if (!confirm('Tem certeza que deseja remover este treinamento?')) return;

    try {
      const response = await fetch(`/api/matriz-treinamento/${matrizId}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      
      if (data.success) {
        await fetchContratoDetalhes();
      } else {
        alert(data.error || 'Erro ao remover treinamento');
      }
    } catch (error) {
      console.error('Erro ao remover treinamento:', error);
      alert('Erro ao remover treinamento');
    }
  };

  const handleRemoveFuncao = async (funcaoId: number) => {
    if (!contrato?.id) return;
    if (!confirm('Tem certeza que deseja excluir esta função e todos os seus treinamentos?')) return;

    try {
      const response = await fetch(`/api/matriz-treinamento/contratos/${contrato.id}/funcoes`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ funcaoIds: [funcaoId] })
      });

      const data = await response.json();
      
      if (data.success) {
        setExpandedFuncao(null);
        await fetchContratoDetalhes();
      } else {
        alert(data.error || 'Erro ao remover função');
      }
    } catch (error) {
      console.error('Erro ao remover função:', error);
      alert('Erro ao remover função');
    }
  };

  const filteredFuncoes = funcoes.filter(funcao =>
    funcao.funcao.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTipoObrigatoriedadeLabel = (tipo: string) => {
    const tipoObj = tiposObrigatoriedade.find(t => t.value === tipo);
    return tipoObj ? `${tipo} - ${tipoObj.label}` : tipo;
  };

  const getTipoObrigatoriedadeColor = (tipo: string) => {
    switch (tipo) {
      case 'RA': return 'bg-red-100 text-red-800';
      case 'AP': return 'bg-blue-100 text-blue-800';
      case 'C': return 'bg-yellow-100 text-yellow-800';
      case 'SD': return 'bg-green-100 text-green-800';
      case 'N/A': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando detalhes do contrato...</p>
        </div>
      </div>
    );
  }

  if (!contrato) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <BuildingOfficeIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Contrato não encontrado</h3>
          <p className="mt-1 text-sm text-gray-500">O contrato solicitado não existe.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Moderno */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => router.back()} className="p-2 bg-white rounded-lg border hover:border-blue-300 shadow-sm">
                <ChevronLeftIcon className="h-5 w-5 text-gray-700" />
              </button>
              <div className="p-3 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-lg">
                <AcademicCapIcon className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Matriz do Contrato</h1>
                <p className="text-sm text-gray-600">Gerencie treinamentos obrigatórios por função</p>
                {/* Contrato info: número e descrição (nome) */}
                {contrato && (
                  <div className="mt-1 text-sm text-gray-700">
                    <span className="font-medium">Contrato:</span> {contrato.numero}
                    {contrato.nome ? (
                      <span> — {contrato.nome}</span>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
                <button onClick={handleExportV2} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700">
                <ArrowDownTrayIcon className="h-5 w-5" />
                Exportar Matriz
                </button>
                <button onClick={triggerImportSelect} disabled={uploading} className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg shadow hover:bg-green-700 disabled:opacity-50">
                <ArrowUpTrayIcon className="h-5 w-5" />
                {uploading ? 'Importando...' : 'Importar XLSX'}
              </button>
              <input ref={fileInputRef} type="file" accept=".xlsx" className="hidden" onChange={handleImportChange} />
            </div>
          </div>
        </div>

        {/* Search and Add Function */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar funções..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <button
            onClick={openFuncaoModal}
            className="flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 whitespace-nowrap"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Gerenciar Funções
          </button>
        </div>

        {/* Funções */}
        <div className="space-y-4">
          {filteredFuncoes.map((funcao) => (
            <div key={funcao.id} className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div 
                className="p-6 cursor-pointer hover:bg-gray-50"
                onClick={() => { setExpandedFuncao(expandedFuncao === funcao.id ? null : funcao.id); setBuscaTreinamento(''); setFiltroObrigatoriedade(''); }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <UsersIcon className="h-6 w-6 text-blue-600" />
                    <div>
                      <h3 className="font-semibold text-gray-900">{funcao.funcao}</h3>
                      <p className="text-sm text-gray-500">{funcao.regime}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className="text-sm text-gray-600">
                      {funcao.matrizTreinamento.filter(item => item.treinamento !== null).length} treinamentos
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openModal(funcao.id);
                      }}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                      title="Adicionar treinamento"
                    >
                      <PlusIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveFuncao(funcao.id);
                      }}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      title="Excluir função e todos os treinamentos"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>

              {expandedFuncao === funcao.id && (
                <div className="border-t border-gray-200 p-6">
                  {/* Filtro local de treinamentos */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="relative w-full max-w-md">
                      <MagnifyingGlassIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Buscar treinamento..."
                        value={buscaTreinamento}
                        onChange={(e) => setBuscaTreinamento(e.target.value)}
                        className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <select
                      value={filtroObrigatoriedade}
                      onChange={(e) => setFiltroObrigatoriedade(e.target.value)}
                      className="px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      title="Filtrar por obrigatoriedade"
                    >
                      <option value="">Todas</option>
                      {tiposObrigatoriedade.map((tipo) => (
                        <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                      ))}
                    </select>
                  </div>

                  {funcao.matrizTreinamento.some((item) => item.treinamento) ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-xs border-2 border-blue-900 rounded">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium text-gray-600">Treinamento</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-600">Carga Horária</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-600">Validade</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-600">Obrigatoriedade</th>
                            <th className="px-3 py-2 text-right font-medium text-gray-600">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {funcao.matrizTreinamento
                            .filter((item) => item.treinamento && item.treinamento.treinamento.toLowerCase().includes(buscaTreinamento.toLowerCase()) && (filtroObrigatoriedade === '' || item.tipoObrigatoriedade === filtroObrigatoriedade))
                            .map((item) => (
                              <tr key={item.id} className="hover:bg-gray-50">
                                <td className="px-3 py-2">
                                  <div className="font-medium text-gray-900 truncate max-w-[320px]">{item.treinamento!.treinamento}</div>
                                </td>
                                <td className="px-3 py-2 text-gray-900">{item.treinamento!.cargaHoraria}h</td>
                                <td className="px-3 py-2 text-gray-900">{item.treinamento!.validadeValor} {item.treinamento!.validadeUnidade}</td>
                                <td className="px-3 py-2">
                                  <select
                                    value={item.tipoObrigatoriedade}
                                    onChange={(e) => handleChangeObrigatoriedade(item.id, e.target.value)}
                                    disabled={savingObrigatoriedadeId === item.id}
                                    className="text-xs border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    title="Editar obrigatoriedade"
                                  >
                                    {tiposObrigatoriedade.map((tipo) => (
                                      <option key={tipo.value} value={tipo.value}>
                                        {tipo.label}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <button
                                    onClick={() => handleRemoveTreinamento(item.id)}
                                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                                    title="Remover treinamento"
                                  >
                                    <TrashIcon className="h-4 w-4" />
                                  </button>
                                </td>
                              </tr>
                            ))}

                          {funcao.matrizTreinamento.filter((item) => item.treinamento && item.treinamento.treinamento.toLowerCase().includes(buscaTreinamento.toLowerCase()) && (filtroObrigatoriedade === '' || item.tipoObrigatoriedade === filtroObrigatoriedade)).length === 0 && (
                            <tr>
                              <td colSpan={5} className="px-3 py-3 text-center text-gray-500">Nenhum treinamento encontrado para este filtro</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <AcademicCapIcon className="h-5 w-5 text-gray-300" />
                        <div>
                          <h4 className="font-medium text-gray-500 italic">Função sem treinamento</h4>
                          <p className="text-sm text-gray-400">Clique em [Adicionar Treinamento] para configurar</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => openModal(funcao.id)}
                          className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                        >
                          Adicionar Treinamento
                        </button>
                        <button
                          onClick={() => handleRemoveFuncao(funcao.id)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                          title="Excluir função"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {filteredFuncoes.length === 0 && (
          <div className="text-center py-12">
            <UsersIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhuma função encontrada</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm ? 'Tente ajustar os termos de busca.' : 'Não há funções cadastradas para este contrato.'}
            </p>
          </div>
        )}

        {/* Modal para adicionar treinamento - NOVO COMPONENTE */}
        <ModalTreinamentos
          showModal={showModal}
          closeModal={closeModal}
          treinamentos={treinamentos}
          tiposObrigatoriedade={tiposObrigatoriedade}
          funcoes={funcoes}
          selectedFuncao={selectedFuncao}
          onSubmit={handleSubmit}
          modalLoading={modalLoading}
        />

        {/* Modal Selecionar Funções */}
        {showAddFuncaoModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-6xl max-h-[85vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Selecionar Funções
                </h3>
                <button
                  onClick={closeFuncaoModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              <div className="flex-1 flex gap-4 min-h-0">
                {/* Painel Esquerdo - Funções Disponíveis */}
                <div className="w-3/5 flex flex-col">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-gray-900 text-sm">Funções Disponíveis</h4>
                    <div className="text-xs text-gray-500">
                      {todasFuncoes.filter(funcao => {
                        const searchTerm = buscaFuncao.toLowerCase();
                        return funcao.funcao.toLowerCase().includes(searchTerm) ||
                               (funcao.regime ?? '').toLowerCase().includes(searchTerm) ||
                               funcao.id.toString().includes(searchTerm);
                      }).filter(funcao => filtroRegime === '' || funcao.regime === filtroRegime).length} funções
                    </div>
                  </div>

                  <div className="flex gap-2 mb-3">
                    <div className="relative flex-1">
                      <MagnifyingGlassIcon className="h-4 w-4 absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Buscar por função ou ID..."
                        value={buscaFuncao}
                        onChange={(e) => setBuscaFuncao(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <select
                      value={filtroRegime}
                      onChange={(e) => setFiltroRegime(e.target.value)}
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Todos os regimes</option>
                      {Array.from(new Set(todasFuncoes.map(f => f.regime))).map(regime => (
                        <option key={String(regime)} value={String(regime)}>{String(regime)}</option>
                      ))}
                    </select>
                  </div>

                  {/* Lista de Funções - Uma coluna */}
                  <div className="flex-1 overflow-y-auto">
                    <div className="space-y-1.5">
                      {todasFuncoes
                        .filter(funcao => {
                          const searchTerm = buscaFuncao.toLowerCase();
                          return funcao.funcao.toLowerCase().includes(searchTerm) ||
                                 (funcao.regime ? funcao.regime.toLowerCase().includes(searchTerm) : false) ||
                                 funcao.id.toString().includes(searchTerm);
                        })
                        .filter(funcao => filtroRegime === '' || String(funcao.regime) === filtroRegime)
                        .map((funcao) => {
                          const jaExiste = funcoes.some(f => f.id === funcao.id);
                          return (
                            <div
                              key={funcao.id}
                              className={`p-2 border rounded cursor-pointer transition-all hover:shadow-sm ${
                                funcoesSelecionadas.includes(funcao.id)
                                  ? 'border-blue-500 bg-blue-50 shadow-sm'
                                  : jaExiste
                                  ? 'border-green-500 bg-green-50'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                              onClick={() => handleFuncaoToggle(funcao.id.toString())}
                            >
                              <div className="flex items-start space-x-2">
                                <input
                                  type="checkbox"
                                  checked={funcoesSelecionadas.includes(funcao.id)}
                                  onChange={() => handleFuncaoToggle(funcao.id.toString())}
                                  className="h-3.5 w-3.5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-0.5"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-gray-900 text-xs leading-tight flex items-center gap-2">
                                    {funcao.funcao}
                                    {jaExiste && (
                                      <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                                        Na matriz
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                                    <span>{funcao.regime ?? '—'}</span>
                                    <span className="text-gray-400">•</span>
                                    <span className="text-gray-600 font-mono">ID: {funcao.id}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                    
                    {todasFuncoes.filter(funcao => {
                      const searchTerm = buscaFuncao.toLowerCase();
                      return funcao.funcao.toLowerCase().includes(searchTerm) ||
                             (funcao.regime ?? '').toLowerCase().includes(searchTerm) ||
                             funcao.id.toString().includes(searchTerm);
                    }).filter(funcao => filtroRegime === '' || funcao.regime === filtroRegime).length === 0 && (
                      <div className="text-center py-6 text-gray-500">
                        <UsersIcon className="h-10 w-10 mx-auto mb-2 text-gray-400" />
                        <p className="text-sm">Nenhuma função encontrada</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Painel Direito - Funções Selecionadas */}
                <div className="w-2/5 flex flex-col border-l border-gray-200 pl-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-gray-900 text-sm">Selecionadas</h4>
                    <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                      {funcoesSelecionadas.length}
                    </div>
                  </div>

                  {funcoesSelecionadas.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center border-2 border-dashed border-gray-300 rounded">
                      <div className="text-center text-gray-500">
                        <CheckIcon className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                        <p className="text-xs">Nenhuma função selecionada</p>
                        <p className="text-xs mt-1 text-gray-400">Clique nas funções à esquerda</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 overflow-y-auto">
                      <div className="space-y-1.5">
                        {funcoesSelecionadas.map((funcaoId) => {
                          const funcao = todasFuncoes.find(f => f.id === funcaoId);
                          if (!funcao) return null;
                          
                          return (
                            <div
                              key={funcaoId}
                              className="p-2 bg-blue-50 border border-blue-200 rounded group hover:bg-blue-100 transition-colors"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-blue-900 text-xs leading-tight">
                                    {funcao.funcao}
                                  </div>
                                  <div className="text-xs text-blue-700 mt-0.5 flex items-center gap-2">
                                    <span>{funcao.regime}</span>
                                    <span className="text-blue-400">•</span>
                                    <span className="font-mono">ID: {funcao.id}</span>
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleFuncaoToggle(funcaoId.toString())}
                                  className="ml-2 text-blue-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <XMarkIcon className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Ações rápidas */}
                  {funcoesSelecionadas.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <button
                        onClick={() => setFuncoesSelecionadas([])}
                        className="w-full text-xs text-gray-500 hover:text-gray-700 py-1.5"
                      >
                        Limpar todas ({funcoesSelecionadas.length})
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Rodapé com botões */}
              <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-200">
                <div className="text-sm text-gray-600">
                  {funcoesSelecionadas.length} função(ões) selecionada(s)
                </div>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={closeFuncaoModal}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmarSelecao}
                    disabled={funcoesSelecionadas.length === 0}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center"
                  >
                    <CheckIcon className="h-4 w-4 mr-2" />
                    Confirmar ({funcoesSelecionadas.length})
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}