'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/Toast';
import { RemanejamentoFuncionario } from '@/types/remanejamento-funcionario';
import * as XLSX from 'xlsx';
import { 
  EyeIcon, 
  PlusIcon, 
  DocumentArrowDownIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  ChevronRightIcon as ChevronRightIcon2,
  UsersIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline';

interface ProgressoPorSetor {
  setor: string;
  total: number;
  concluidas: number;
  percentual: number;
}

interface FuncionarioTableData {
  id: string;
  nome: string;
  matricula: string;
  funcao: string;
  statusTarefas: string;
  statusPrestserv: string;
  solicitacaoId: string;
  contratoOrigem: string;
  contratoDestino: string;
  totalTarefas: number;
  tarefasConcluidas: number;
  dataSolicitacao: string;
  progressoPorSetor: ProgressoPorSetor[];
  statusFuncionario?: string;
}

export default function FuncionariosPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [funcionarios, setFuncionarios] = useState<FuncionarioTableData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<string>('TODOS');
  const [filtroNome, setFiltroNome] = useState('');
  const [filtroContratoOrigem, setFiltroContratoOrigem] = useState<string>('');
  const [filtroContratoDestino, setFiltroContratoDestino] = useState<string>('');
  const [filtroStatusGeral, setFiltroStatusGeral] = useState<string>("");
  const [filtroAcaoNecessaria, setFiltroAcaoNecessaria] = useState<string>("");
  const [filtroTipoSolicitacao, setFiltroTipoSolicitacao] = useState<string>("");
  const [filtroNumeroSolicitacao, setFiltroNumeroSolicitacao] = useState<string>("");
  const [setoresSelecionados, setSetoresSelecionados] = useState<string[]>([]);
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [itensPorPagina] = useState(10);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showTarefasModal, setShowTarefasModal] = useState(false);
  const [selectedFuncionario, setSelectedFuncionario] = useState<FuncionarioTableData | null>(null);
  const [selectedSetores, setSelectedSetores] = useState<string[]>(['RH', 'MEDICINA', 'TREINAMENTO']);
  const [generatingTarefas, setGeneratingTarefas] = useState(false);
  const [activeTab, setActiveTab] = useState<'nominal' | 'solicitacao'>('nominal');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchFuncionarios();
  }, []);

  const updatePrestservStatus = async (funcionarioId: string, novoStatus: string) => {
    try {
      setUpdatingStatus(funcionarioId);
      
      // Buscar dados do funcionário para notificação
      const funcionario = funcionarios.find(f => f.id === funcionarioId);
      if (!funcionario) {
        throw new Error('Funcionário não encontrado');
      }
      
      const response = await fetch(`/api/logistica/funcionario/${funcionarioId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ statusPrestserv: novoStatus }),
      });

      if (!response.ok) {
        throw new Error('Erro ao atualizar status');
      }

      // Atualizar o estado local
      setFuncionarios(prev => prev.map(func => 
        func.id === funcionarioId 
          ? { ...func, statusPrestserv: novoStatus }
          : func
      ));
      
      // Notificar funcionário sobre mudança de status
      const statusMessages = {
        'PENDENTE': 'Status alterado para Pendente',
        'CRIADO': 'Rascunho do Prestserv foi criado',
        'SUBMETIDO': 'Prestserv foi submetido para aprovação',
        'APROVADO': 'Prestserv foi aprovado! ✅',
        'REJEITADO': 'Prestserv foi rejeitado. Verifique as observações e corrija as pendências.'
      };
      
      const message = statusMessages[novoStatus as keyof typeof statusMessages] || 'Status atualizado';
      
      // Simular notificação ao funcionário (aqui você pode integrar com sistema de notificações real)
      console.log(`📧 Notificação enviada para ${funcionario.nome} (${funcionario.matricula}): ${message}`);
      
      showToast(`Status atualizado com sucesso! Funcionário ${funcionario.nome} foi notificado.`, 'success');
    } catch (err) {
      console.error('Erro ao atualizar status:', err);
      showToast('Erro ao atualizar status. Tente novamente.', 'error');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const canUpdateStatus = (funcionario: FuncionarioTableData, novoStatus: string) => {
    const statusAtual = funcionario.statusPrestserv;
    
    // Só pode submeter se as tarefas estiverem concluídas
    if (novoStatus === 'SUBMETIDO' && funcionario.statusTarefas !== 'CONCLUIDO') {
      return false;
    }
    
    // APROVADO e REJEITADO só podem acontecer após SUBMETIDO
    if ((novoStatus === 'APROVADO' || novoStatus === 'REJEITADO') && 
        statusAtual !== 'SUBMETIDO' && statusAtual !== 'APROVADO' && statusAtual !== 'REJEITADO') {
      return false;
    }
    
    return true;
  };

  const podeSubmeterPrestserv = (funcionario: FuncionarioTableData): boolean => {
    return funcionario.statusTarefas === 'CONCLUIDO' && (funcionario.statusPrestserv === 'CRIADO' || funcionario.statusPrestserv === 'REJEITADO');
  };

  const getValidStatusOptions = (funcionario: FuncionarioTableData): string[] => {
    const currentStatus = funcionario.statusPrestserv;
    const options: string[] = [];
    
    // Sempre incluir o status atual
    options.push(currentStatus);
    
    // Lógica de transições válidas baseada na página individual
    switch (currentStatus) {
      case 'PENDENTE':
        options.push('CRIADO'); // Criar rascunho
        break;
      case 'CRIADO':
        if (podeSubmeterPrestserv(funcionario)) {
          options.push('SUBMETIDO'); // Submeter para aprovação
        }
        break;
      case 'REJEITADO':
        if (podeSubmeterPrestserv(funcionario)) {
          options.push('SUBMETIDO'); // Submeter novamente
        }
        break;
      case 'SUBMETIDO':
        options.push('APROVADO'); // Aprovar
        options.push('REJEITADO'); // Rejeitar
        break;
      case 'APROVADO':
        // Status final, não permite mudanças
        break;
    }
    
    return [...new Set(options)]; // Remove duplicatas
  };

  // Função para exibir status do Prestserv com numeração (apenas para dropdown de ações)
  const getStatusDisplayText = (status: string): string => {
    const statusMap: { [key: string]: string } = {
      "PENDENTE": "1. PENDENTE",
      "APROVADO": "2. APROVADO",
      "REPROVADO": "3. REPROVADO",
      "CRIADO": "4. CRIADO",
      "SUBMETIDO": "5. SUBMETIDO",
      "EM VALIDAÇÃO": "6. EM VALIDAÇÃO",
      "VALIDADO": "7. VALIDADO",
      "INVALIDADO": "8. INVALIDADO",
      "CANCELADO": "9. CANCELADO",
      "REJEITADO": "10. REJEITADO"
    };
    return statusMap[status] || status;
  };

  // Função para exibir status sem numeração (para filtros e exibição geral)
  const getStatusSemNumeracao = (status: string): string => {
    return status;
  };

  const fetchFuncionarios = async () => {
    try {
      setLoading(true);

      const response = await fetch('/api/logistica/remanejamentos');
      
      if (!response.ok) {
        throw new Error('Erro ao carregar funcionários');
      }
      
      const data = await response.json();
      
      // Transformar dados para formato de tabela
      const funcionariosTable: FuncionarioTableData[] = [];
      console.log('data');
      console.log(data);
      
      data.forEach((solicitacao: any) => {
        solicitacao.funcionarios.forEach((func: RemanejamentoFuncionario) => {
          // Calcular progresso por setor
          const tarefasPorSetor: { [key: string]: { total: number; concluidas: number } } = {};
          console.log(func);
          func.tarefas?.forEach((tarefa: any) => {
            const setor = tarefa.responsavel || 'Outros';
            if (!tarefasPorSetor[setor]) {
              tarefasPorSetor[setor] = { total: 0, concluidas: 0 };
            }
            tarefasPorSetor[setor].total++;
            if (tarefa.status === 'CONCLUIDO') {
              tarefasPorSetor[setor].concluidas++;
            }
          });

          const progressoPorSetor: ProgressoPorSetor[] = Object.entries(tarefasPorSetor).map(([setor, dados]) => ({
            setor,
            total: dados.total,
            concluidas: dados.concluidas,
            percentual: dados.total > 0 ? (dados.concluidas / dados.total) * 100 : 0
          }));

          
          funcionariosTable.push({
            id: func.id,
            nome: func.funcionario?.nome || 'Nome não informado',
            matricula: func.funcionario?.matricula || 'Matrícula não informada',
            funcao: func.funcionario?.funcao || 'Não informado',
            statusTarefas: func.statusTarefas,
            statusPrestserv: func.statusPrestserv,
            solicitacaoId: solicitacao.id,
            contratoOrigem: solicitacao.contratoOrigem?.nome || 'N/A',
            contratoDestino: solicitacao.contratoDestino?.nome || 'N/A',
            totalTarefas: func.tarefas?.length || 0,
            tarefasConcluidas: func.tarefas?.filter((t: any) => t.status === 'CONCLUIDO').length || 0,
            dataSolicitacao: new Date(solicitacao.dataSolicitacao).toLocaleDateString('pt-BR'),
            progressoPorSetor,
            statusFuncionario: func.statusFuncionario || 'NÃO INFORMADO',
          });
        });
      });
      
      setFuncionarios(funcionariosTable);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  // Função para verificar se funcionário demitido precisa de atenção
  const funcionarioDemitidoPrecisaAtencao = (funcionario: FuncionarioTableData): boolean => {
    // Verifica se o funcionário está em migração ou tem status Prestserv ativo
    const statusPrestservAtivo = funcionario.statusPrestserv === 'ATIVO' || funcionario.statusPrestserv === 'APROVADO';
    const emMigracao = funcionario.statusFuncionario === 'INATIVO'; // Considerando INATIVO como demitido
    
    return emMigracao || statusPrestservAtivo;
  };

  // Função para determinar o tipo de alerta
  const getTipoAlertaDemitido = (funcionario: FuncionarioTableData): 'critico' | 'processo' | 'aviso' => {
    if (funcionario.statusFuncionario === 'INATIVO' && funcionario.statusPrestserv === 'ATIVO') {
      return 'critico'; // Funcionário demitido mas ainda ativo no Prestserv
    }
    if (funcionario.statusFuncionario === 'INATIVO') {
      return 'processo'; // Funcionário demitido em processo
    }
    if (funcionario.statusPrestserv === 'APROVADO') {
      return 'aviso'; // Status Prestserv aprovado
    }
    return 'aviso';
  };

  const funcionariosFiltrados = funcionarios.filter(func => {
    const matchStatus = filtroStatus === 'TODOS' || func.statusTarefas === filtroStatus || func.statusPrestserv === filtroStatus;
    const matchNome = (func.nome?.toLowerCase() || '').includes(filtroNome.toLowerCase()) || 
                     (func.matricula || '').includes(filtroNome);
    const matchContratoOrigem = !filtroContratoOrigem || func.contratoOrigem === filtroContratoOrigem;
    const matchContratoDestino = !filtroContratoDestino || func.contratoDestino === filtroContratoDestino;
    const matchStatusGeral = !filtroStatusGeral || func.statusTarefas === filtroStatusGeral;
    const matchAcaoNecessaria = !filtroAcaoNecessaria || func.statusTarefas === filtroAcaoNecessaria;
    const matchTipoSolicitacao = !filtroTipoSolicitacao || func.tipoSolicitacao === filtroTipoSolicitacao;
    const matchNumeroSolicitacao = !filtroNumeroSolicitacao || func.solicitacaoId === filtroNumeroSolicitacao;
    // Filtrar por setores selecionados (se nenhum selecionado, mostra todos)
    const matchSetor = setoresSelecionados.length === 0 || func.progressoPorSetor?.some(progresso => setoresSelecionados.includes(progresso.setor));
    return matchStatus && matchNome && matchContratoOrigem && matchContratoDestino && matchStatusGeral && matchAcaoNecessaria && matchTipoSolicitacao && matchNumeroSolicitacao && matchSetor;
  });

  // Paginação
  const totalPaginas = Math.ceil(funcionariosFiltrados.length / itensPorPagina);
  const indiceInicio = (paginaAtual - 1) * itensPorPagina;
  const indiceFim = indiceInicio + itensPorPagina;
  const funcionariosPaginados = funcionariosFiltrados.slice(indiceInicio, indiceFim);
  
  // Reset página quando filtros mudam
  useEffect(() => {
    setPaginaAtual(1);
  }, [filtroStatus, filtroNome, filtroContratoOrigem, filtroContratoDestino, filtroStatusGeral, setoresSelecionados]);

  // Calcular estatísticas gerais por setor
  const estatisticasPorSetor = () => {

    const setores: { [key: string]: { total: number; concluidas: number; funcionarios: Set<string> } } = {};
    
    funcionarios.forEach(func => {
      func.progressoPorSetor.forEach(progresso => {
        if (!setores[progresso.setor]) {
          setores[progresso.setor] = { total: 0, concluidas: 0, funcionarios: new Set() };
        }
        setores[progresso.setor].total += progresso.total;
        setores[progresso.setor].concluidas += progresso.concluidas;
        setores[progresso.setor].funcionarios.add(func.id);
      });
    });

    return Object.entries(setores).map(([setor, dados]) => ({
      setor,
      total: dados.total,
      concluidas: dados.concluidas,
      percentual: dados.total > 0 ? (dados.concluidas / dados.total) * 100 : 0,
      funcionarios: dados.funcionarios.size
    })).sort((a, b) => a.setor.localeCompare(b.setor));
  };

  const calcularProgresso = (concluidas: number, total: number) => {
    if (total === 0) return 0;
    return (concluidas / total) * 100;
  };

  const getSetorIcon = (setor: string) => {
    switch (setor.toUpperCase()) {
      case 'RH': return '👥';
      case 'MEDICINA': return '🏥';
      case 'LOGISTICA': return '📦';
      case 'TREINAMENTO': return '📚';
      default: return '📋';
    }
  };

  const getSetorColor = (percentual: number) => {
    if (percentual === 100) return 'bg-gray-600';
    if (percentual >= 50) return 'bg-gray-500';
    return 'bg-gray-400';
  };

  const getContratosOrigem = () => {
    const contratos = new Set(funcionarios.map(f => f.contratoOrigem).filter(Boolean));
    return Array.from(contratos).sort();
  };

  const getContratosDestino = () => {
    const contratos = new Set(funcionarios.map(f => f.contratoDestino).filter(Boolean));
    return Array.from(contratos).sort();
  };

  // Filtro Status Geral - APENAS statusTarefas (Status Geral do processo)
  const getStatusGerais = () => {
    const statusTarefas = new Set<string>();
    funcionarios.forEach((f) => {
      if (f.statusTarefas) statusTarefas.add(f.statusTarefas);
    });
    return Array.from(statusTarefas).sort();
  };

  // Filtro Ação Necessária - APENAS statusTarefas que requerem ação
  const getStatusAcaoNecessaria = () => {
    const statusAcaoNecessaria = [
      "SUBMETER RASCUNHO", "TAREFAS PENDENTES", "ATENDER TAREFAS", "APROVAR SOLICITAÇÃO", "REPROVAR TAREFAS"
    ];
    
    const statusExistentes = new Set<string>();
    funcionarios.forEach((f) => {
      if (f.statusTarefas && statusAcaoNecessaria.includes(f.statusTarefas)) {
        statusExistentes.add(f.statusTarefas);
      }
    });
    
    return Array.from(statusExistentes).sort();
  };

  // Filtro Tipo de Solicitação
  const getTiposSolicitacao = () => {
    const tipos = new Set(funcionarios.map(f => f.tipoSolicitacao).filter(Boolean));
    return Array.from(tipos).sort();
  };

  // Filtro Número de Solicitação
  const getNumerosSolicitacao = () => {
    const numeros = new Set(funcionarios.map(f => f.solicitacaoId).filter(Boolean));
    return Array.from(numeros).sort();
  };

  const limparFiltros = () => {
    setFiltroStatus('TODOS');
    setFiltroNome('');
    setFiltroContratoOrigem('');
    setFiltroContratoDestino('');
    setFiltroStatusGeral('');
    setFiltroAcaoNecessaria('');
    setFiltroTipoSolicitacao('');
    setFiltroNumeroSolicitacao('');
    setSetoresSelecionados([]);
  };

  const temFiltrosAtivos = () => {
    return filtroStatus !== 'TODOS' || filtroNome || filtroContratoOrigem || 
           filtroContratoDestino || filtroStatusGeral || filtroAcaoNecessaria || 
           filtroTipoSolicitacao || filtroNumeroSolicitacao || setoresSelecionados.length > 0;
  };

  const exportarParaExcel = () => {
    try {
      // Identificar todos os setores únicos
      const setoresUnicos = new Set<string>();
      funcionariosFiltrados.forEach(funcionario => {
        funcionario.progressoPorSetor.forEach(progresso => {
          setoresUnicos.add(progresso.setor);
        });
      });
      const setoresOrdenados = Array.from(setoresUnicos).sort();
      
      // Preparar dados para exportação
      const dadosParaExportar = funcionariosFiltrados.map(funcionario => {
        // Calcular progresso geral
        const progressoGeral = funcionario.totalTarefas > 0 
          ? ((funcionario.tarefasConcluidas / funcionario.totalTarefas) * 100).toFixed(1)
          : '0';
        
        // Criar objeto base
        const dadosFuncionario: any = {
          'Nome': funcionario.nome,
          'Matrícula': funcionario.matricula,
          'Função': funcionario.funcao,
          'Status Tarefas': funcionario.statusTarefas,
          'Status Prestserv': funcionario.statusPrestserv,
          'Progresso Geral': `${funcionario.tarefasConcluidas}/${funcionario.totalTarefas} (${progressoGeral}%)`,
        };
        
        // Adicionar colunas para cada setor
        setoresOrdenados.forEach(setor => {
          const progressoSetor = funcionario.progressoPorSetor.find(p => p.setor === setor);
          if (progressoSetor) {
            dadosFuncionario[`${setor} - Tarefas`] = `${progressoSetor.concluidas}/${progressoSetor.total}`;
            dadosFuncionario[`${setor} - %`] = `${progressoSetor.percentual.toFixed(1)}%`;
          } else {
            dadosFuncionario[`${setor} - Tarefas`] = '0/0';
            dadosFuncionario[`${setor} - %`] = '0%';
          }
        });
        
        // Adicionar informações de contrato e data
        dadosFuncionario['Contrato Origem'] = funcionario.contratoOrigem;
        dadosFuncionario['Contrato Destino'] = funcionario.contratoDestino;
        dadosFuncionario['Data Solicitação'] = funcionario.dataSolicitacao;
        
        return dadosFuncionario;
      });
      
      // Criar workbook
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(dadosParaExportar);
      
      // Ajustar largura das colunas dinamicamente
      const colWidths = [
        { wch: 25 }, // Nome
        { wch: 15 }, // Matrícula
        { wch: 20 }, // Função
        { wch: 15 }, // Status Tarefas
        { wch: 15 }, // Status Prestserv
        { wch: 20 }, // Progresso Geral
      ];
      
      // Adicionar larguras para colunas de setores
      setoresOrdenados.forEach(() => {
        colWidths.push({ wch: 15 }); // Setor - Tarefas
        colWidths.push({ wch: 10 }); // Setor - %
      });
      
      // Adicionar larguras para colunas finais
      colWidths.push(
        { wch: 20 }, // Contrato Origem
        { wch: 20 }, // Contrato Destino
        { wch: 15 }  // Data Solicitação
      );
      
      ws['!cols'] = colWidths;
      
      // Adicionar worksheet ao workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Funcionários');
      
      // Gerar nome do arquivo com data atual
      const dataAtual = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
      const nomeArquivo = `funcionarios-prestserv-${dataAtual}.xlsx`;
      
      // Fazer download do arquivo
      XLSX.writeFile(wb, nomeArquivo);
      
      showToast(`Arquivo ${nomeArquivo} exportado com sucesso!`, 'success');
    } catch (error) {
      console.error('Erro ao exportar para Excel:', error);
      showToast('Erro ao exportar arquivo. Tente novamente.', 'error');
    }
  };

  const abrirModalConfirmacao = (funcionario: FuncionarioTableData) => {
    setSelectedFuncionario(funcionario);
    setShowConfirmModal(true);
  };

  const confirmarAprovacao = () => {
    setShowConfirmModal(false);
    setShowTarefasModal(true);
  };

  const cancelarAprovacao = () => {
    setShowConfirmModal(false);
    setShowTarefasModal(false);
    setSelectedFuncionario(null);
    setSelectedSetores(['RH', 'MEDICINA', 'TREINAMENTO']);
  };

  const toggleSetor = (setor: string) => {
    setSelectedSetores(prev => 
      prev.includes(setor) 
        ? prev.filter(s => s !== setor)
        : [...prev, setor]
    );
  };

  const gerarTarefasPadrao = async () => {
    if (!selectedFuncionario || selectedSetores.length === 0) {
      showToast('Selecione pelo menos um setor', 'warning');
      return;
    }

    setGeneratingTarefas(true);
    try {
      const response = await fetch('/api/tarefas/padrao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          funcionarioId: selectedFuncionario.id, 
          setores: selectedSetores, 
          criadoPor: 'Sistema' 
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        showToast(errorData.error || 'Erro ao reprovar tarefas padrão', 'error');
        return;
      }
      
      const result = await response.json();
      showToast(`Tarefas padrão criadas com sucesso para ${selectedFuncionario.nome}!`, 'success');
      fetchFuncionarios();
      setShowTarefasModal(false);
      setSelectedFuncionario(null);
      setSelectedSetores(['RH', 'MEDICINA', 'TREINAMENTO']);
    } catch (error) {
      showToast('Erro ao reprovar tarefas padrão', 'error');
    } finally {
      setGeneratingTarefas(false);
    }
  };

  // Funções para visão por solicitação
  const toggleRow = (solicitacaoId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(solicitacaoId)) {
      newExpanded.delete(solicitacaoId);
    } else {
      newExpanded.add(solicitacaoId);
    }
    setExpandedRows(newExpanded);
  };

  const getFuncionariosResumo = (funcionarios: FuncionarioTableData[]) => {
    const pendentes = funcionarios.filter(f => f.statusTarefas === 'PENDENTE').length;
    const concluidos = funcionarios.filter(f => f.statusTarefas === 'CONCLUIDO').length;
    return { pendentes, concluidos, total: funcionarios.length };
  };

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      'PENDENTE': 'bg-gray-100 text-gray-700',
      'CONCLUIDO': 'bg-gray-200 text-gray-800',
      'CRIADO': 'bg-gray-100 text-gray-700',
      'SUBMETIDO': 'bg-gray-100 text-gray-700',
      'APROVADO': 'bg-gray-200 text-gray-800',
      'REJEITADO': 'bg-gray-100 text-gray-700'
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  // Agrupar funcionários por solicitação
  const funcionariosAgrupados = funcionarios.reduce((acc, funcionario) => {
    const solicitacaoId = funcionario.solicitacaoId;
    if (!acc[solicitacaoId]) {
      acc[solicitacaoId] = {
        solicitacaoId,
        contratoOrigem: funcionario.contratoOrigem,
        contratoDestino: funcionario.contratoDestino,
        dataSolicitacao: funcionario.dataSolicitacao,
        funcionarios: []
      };
    }
    acc[solicitacaoId].funcionarios.push(funcionario);
    return acc;
  }, {} as Record<string, any>);

  const solicitacoesFiltradas = Object.values(funcionariosAgrupados).filter((solicitacao: any) => {
    const matchStatus = filtroStatus === 'TODOS' || 
      solicitacao.funcionarios.some((f: FuncionarioTableData) => 
        f.statusTarefas === filtroStatus || f.statusPrestserv === filtroStatus
      );
    const matchNome = !filtroNome || 
      solicitacao.funcionarios.some((f: FuncionarioTableData) => 
        (f.nome?.toLowerCase() || '').includes(filtroNome.toLowerCase()) || 
        (f.matricula || '').includes(filtroNome)
      );
    const matchContratoOrigem = !filtroContratoOrigem || solicitacao.contratoOrigem === filtroContratoOrigem;
    const matchContratoDestino = !filtroContratoDestino || solicitacao.contratoDestino === filtroContratoDestino;
    const matchStatusGeral = !filtroStatusGeral || 
      solicitacao.funcionarios.some((f: FuncionarioTableData) => 
        f.statusTarefas === filtroStatusGeral || f.statusPrestserv === filtroStatusGeral
      );
    const matchSetor = setoresSelecionados.length === 0 || 
      solicitacao.funcionarios.some((f: FuncionarioTableData) => 
        f.progressoPorSetor?.some(progresso => setoresSelecionados.includes(progresso.setor))
      );
    
    return matchStatus && matchNome && matchContratoOrigem && matchContratoDestino && matchStatusGeral && matchSetor;
  });

  // Fechar modal com Escape
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && (showConfirmModal || showTarefasModal)) {
        cancelarAprovacao();
      }
    };

    if (showConfirmModal || showTarefasModal) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [showConfirmModal, showTarefasModal]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
        <p className="text-gray-800">Erro: {error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex justify-between items-center mb-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">👥 Funcionários em Remanejamento</h1>
            <p className="text-gray-600 text-sm">Visualização completa de todos os funcionários em remanejamento</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-500">
              Total: {activeTab === 'nominal' ? funcionariosFiltrados.length : solicitacoesFiltradas.length} {activeTab === 'nominal' ? 'funcionários' : 'solicitações'} | Página {paginaAtual} de {totalPaginas}
            </div>
            <button
              onClick={exportarParaExcel}
              disabled={funcionariosFiltrados.length === 0}
              className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
              title="Exportar dados filtrados para Excel"
            >
              <DocumentArrowDownIcon className="w-4 h-4 mr-2" />
              Exportar Excel
            </button>
          </div>
        </div>

        {/* Abas de Visualização */}
        <div className="border-b border-gray-200 mb-4">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('nominal')}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                activeTab === 'nominal'
                  ? 'border-gray-500 text-gray-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <UsersIcon className="h-4 w-4" />
              <span>Visão Nominal</span>
            </button>
            <button
              onClick={() => setActiveTab('solicitacao')}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                activeTab === 'solicitacao'
                  ? 'border-gray-500 text-gray-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <DocumentTextIcon className="h-4 w-4" />
              <span>Visão por Solicitação</span>
            </button>
          </nav>
        </div>

        {/* Estatísticas por Setor */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
          {estatisticasPorSetor().filter(est => ['RH', 'MEDICINA', 'TREINAMENTO'].includes(est.setor)).map((estatistica) => (
            <div 
              key={estatistica.setor} 
              onClick={() => {
                setSetoresSelecionados(prev => 
                  prev.includes(estatistica.setor)
                    ? prev.filter(s => s !== estatistica.setor)
                    : [...prev, estatistica.setor]
                );
              }}
              className={`cursor-pointer transition-all duration-200 rounded-lg p-3 border-2 hover:shadow-md transform hover:scale-102 ${
                setoresSelecionados.includes(estatistica.setor)
                  ? 'bg-gradient-to-r from-gray-100 to-gray-200 border-gray-400 shadow-md' 
                  : 'bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center space-x-2">
                  <span className="text-base">{getSetorIcon(estatistica.setor)}</span>
                  <h3 className="font-semibold text-gray-900 text-sm">{estatistica.setor}</h3>
                </div>
                <span className="text-xs bg-gray-200 text-gray-800 px-2 py-1 rounded-full">
                  {estatistica.funcionarios} func.
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Progresso:</span>
                  <span className="font-medium">{estatistica.concluidas}/{estatistica.total}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-500 ${
                      getSetorColor(estatistica.percentual)
                    }`}
                    style={{
                      width: `${estatistica.percentual}%`
                    }}
                  ></div>
                </div>
                <div className="text-right">
                  <span className={`text-sm font-bold ${
                    estatistica.percentual === 100 ? 'text-gray-800' :
                    estatistica.percentual >= 50 ? 'text-gray-700' : 'text-gray-600'
                  }`}>
                    {estatistica.percentual.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700">🔍 Filtros</h3>
            {temFiltrosAtivos() && (
              <button
                onClick={limparFiltros}
                className="inline-flex items-center text-xs text-gray-600 hover:text-gray-800 underline"
              >
                <XMarkIcon className="w-3 h-3 mr-1" />
                Limpar todos os filtros
              </button>
            )}
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2">
              {/* Campo de busca com mais espaço */}
              <div className="lg:col-span-2 relative">
                <MagnifyingGlassIcon className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                <input
                  type="text"
                  value={filtroNome}
                  onChange={(e) => setFiltroNome(e.target.value)}
                  placeholder="Buscar por nome ou matrícula..."
                  className="w-full pl-10 pr-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-500 text-sm"
                />
              </div>
              
              {/* Filtro de Contrato de Origem */}
              <div className="relative">
                <FunnelIcon className="h-4 w-4 text-gray-400 absolute left-2 top-1/2 transform -translate-y-1/2 pointer-events-none" />
                <select
                  value={filtroContratoOrigem}
                  onChange={(e) => setFiltroContratoOrigem(e.target.value)}
                  className="w-full pl-8 pr-2 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-500 text-sm appearance-none bg-white"
                >
                  <option value="">Contrato Origem</option>
                  {getContratosOrigem().map(contrato => (
                    <option key={contrato} value={contrato}>{contrato}</option>
                  ))}
                </select>
              </div>
              
              {/* Filtro de Contrato de Destino */}
              <div className="relative">
                <FunnelIcon className="h-4 w-4 text-gray-400 absolute left-2 top-1/2 transform -translate-y-1/2 pointer-events-none" />
                <select
                  value={filtroContratoDestino}
                  onChange={(e) => setFiltroContratoDestino(e.target.value)}
                  className="w-full pl-8 pr-2 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-500 text-sm appearance-none bg-white"
                >
                  <option value="">Contrato Destino</option>
                  {getContratosDestino().map(contrato => (
                    <option key={contrato} value={contrato}>{contrato}</option>
                  ))}
                </select>
              </div>
              
              {/* Filtro de Status Geral */}
              <div className="relative">
                <FunnelIcon className="h-4 w-4 text-gray-400 absolute left-2 top-1/2 transform -translate-y-1/2 pointer-events-none" />
                <select
                  value={filtroStatusGeral}
                  onChange={(e) => setFiltroStatusGeral(e.target.value)}
                  className="w-full pl-8 pr-2 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-500 text-sm appearance-none bg-white"
                >
                  <option value="">Status Geral</option>
                  {getStatusGerais().map(status => (
                    <option key={String(status)} value={String(status)}>{getStatusSemNumeracao(String(status))}</option>
                  ))}
                </select>
              </div>
              
              {/* Filtro de Tipo de Solicitação */}
              <div className="relative">
                <FunnelIcon className="h-4 w-4 text-gray-400 absolute left-2 top-1/2 transform -translate-y-1/2 pointer-events-none" />
                <select
                  value={filtroTipoSolicitacao}
                  onChange={(e) => setFiltroTipoSolicitacao(e.target.value)}
                  className="w-full pl-8 pr-2 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-500 text-sm appearance-none bg-white"
                >
                  <option value="">Tipo de Solicitação</option>
                  {getTiposSolicitacao().map(tipo => (
                    <option key={tipo} value={tipo}>{tipo}</option>
                  ))}
                </select>
              </div>
              
              {/* Filtro de Número de Solicitação */}
              <div className="relative">
                <FunnelIcon className="h-4 w-4 text-gray-400 absolute left-2 top-1/2 transform -translate-y-1/2 pointer-events-none" />
                <select
                  value={filtroNumeroSolicitacao}
                  onChange={(e) => setFiltroNumeroSolicitacao(e.target.value)}
                  className="w-full pl-8 pr-2 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-500 text-sm appearance-none bg-white"
                >
                  <option value="">Nº da Solicitação</option>
                  {getNumerosSolicitacao().map(numero => (
                    <option key={numero} value={numero}>{numero}</option>
                  ))}
                </select>
              </div>
            </div>
            
            {/* Informação sobre setores selecionados */}
            {setoresSelecionados.length > 0 && (
              <div className="flex items-center text-sm text-gray-600 mt-2">
                📍 {setoresSelecionados.length} setor(es) selecionado(s)
              </div>
            )}
        </div>
      </div>

            {/* Visão Nominal - Tabela de Funcionários */}
      {activeTab === 'nominal' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full divide-y divide-gray-200" style={{ minWidth: '1400px' }}>
              <thead className="bg-gray-200 border-b border-gray-300">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase tracking-wider bg-gray-200">
                    ID Remanejamento
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase tracking-wider bg-gray-200">
                    Status Funcionário
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase tracking-wider bg-gray-200">
                    Funcionário
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase tracking-wider bg-gray-200">
                    Status Geral
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase tracking-wider bg-gray-200">
                    Progresso por Setor
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase tracking-wider bg-gray-200">
                    Status Prestserv
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase tracking-wider bg-gray-200">
                    Contratos
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase tracking-wider bg-gray-200">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {funcionariosPaginados.map((funcionario, index) => (
                  <tr key={funcionario.id} className={`hover:bg-gray-100 transition-colors duration-150 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                  <td className="px-4 py-4 text-xs text-gray-700 font-mono">
                    {funcionario.solicitacaoId}
                  </td>
                  <td className="px-4 py-4">
                    <select
                      value={funcionario.statusFuncionario || 'NAO_INFORMADO'}
                      onChange={async (e) => {
                        const novoStatus = e.target.value;
                        // Chamada API para atualizar statusFuncionario
                        try {
                          const res = await fetch(`/api/logistica/funcionario/${funcionario.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ statusFuncionario: novoStatus })
                          });
                          if (!res.ok) throw new Error('Erro ao atualizar status do funcionário');
                          setFuncionarios(prev => prev.map(f => f.id === funcionario.id ? { ...f, statusFuncionario: novoStatus } : f));
                          showToast('Status do funcionário atualizado com sucesso!', 'success');
                        } catch (err) {
                          showToast('Erro ao atualizar status do funcionário', 'error');
                        }
                      }}
                      className="px-2 py-1 text-xs rounded border focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="ATIVO">ATIVO</option>
                      <option value="INATIVO">INATIVO</option>
                      <option value="NAO_INFORMADO">NÃO INFORMADO</option>
                    </select>
                  </td>
                  <td className="px-4 py-4">
                    {(() => {
                      const precisaAtencao = funcionarioDemitidoPrecisaAtencao(funcionario);
                      const tipoAlerta = getTipoAlertaDemitido(funcionario);
                      
                      return (
                        <div className={`flex items-center ${
                          precisaAtencao 
                            ? tipoAlerta === 'critico' 
                              ? 'border-l-4 border-red-500 bg-red-50 pl-2 -ml-2' 
                              : tipoAlerta === 'processo' 
                              ? 'border-l-4 border-orange-500 bg-orange-50 pl-2 -ml-2'
                              : 'border-l-4 border-yellow-500 bg-yellow-50 pl-2 -ml-2'
                            : ''
                        }`}>
                          <div className="flex-shrink-0 h-8 w-8">
                            <div className="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center">
                              <span className="text-xs font-medium text-gray-700">
                                 {(funcionario.nome || 'N/A').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                               </span>
                            </div>
                          </div>
                          <div className="ml-3 flex-1">
                            <div className="flex items-center gap-2">
                              <div className="text-sm font-medium text-gray-900">{funcionario.nome}</div>
                              {precisaAtencao && (
                                <div className="group relative">
                                  {tipoAlerta === 'critico' ? (
                                    <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />
                                  ) : tipoAlerta === 'processo' ? (
                                    <ExclamationCircleIcon className="h-4 w-4 text-orange-500" />
                                  ) : (
                                    <ExclamationCircleIcon className="h-4 w-4 text-yellow-500" />
                                  )}
                                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                                    {tipoAlerta === 'critico' 
                                      ? 'Funcionário demitido com status Prestserv ativo - Ação urgente necessária'
                                      : tipoAlerta === 'processo' 
                                      ? 'Funcionário demitido em processo de migração'
                                      : 'Funcionário com status Prestserv aprovado - Verificar situação'
                                    }
                                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="text-xs text-gray-500">Mat: {funcionario.matricula}</div>
                            <div className="text-xs text-gray-400">{funcionario.funcao}</div>
                          </div>
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      funcionario.statusTarefas === 'CONCLUIDO' ? 'bg-gray-200 text-gray-800' :
                      funcionario.statusTarefas === 'PENDENTE' ? 'bg-gray-100 text-gray-700' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {funcionario.statusTarefas}
                    </span>
                    <div className="mt-1 text-xs text-gray-500">
                      {funcionario.tarefasConcluidas}/{funcionario.totalTarefas} tarefas
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="space-y-2">
                      {funcionario.progressoPorSetor.map((progresso) => (
                        <div key={progresso.setor} className="flex flex-col space-y-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-1">
                              <span className="text-xs">{getSetorIcon(progresso.setor)}</span>
                              <span className="text-xs font-medium text-gray-700">{progresso.setor}</span>
                            </div>
                            <span className="text-xs font-medium text-gray-700">
                              {progresso.percentual.toFixed(0)}%
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full transition-all duration-300 ${
                                getSetorColor(progresso.percentual)
                              }`}
                              style={{ width: `${progresso.percentual}%` }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <select
                          value={funcionario.statusPrestserv}
                          onChange={(e) => {
                            const novoStatus = e.target.value;
                            const statusAtual = funcionario.statusPrestserv;
                            
                            // Se não mudou o status, não faz nada
                            if (novoStatus === statusAtual) {
                              return;
                            }
                            
                            // Validações específicas baseadas na página individual
                            if (novoStatus === 'CRIADO' && statusAtual !== 'PENDENTE') {
                              showToast('Só é possível criar rascunho quando o status está PENDENTE', 'warning');
                              e.target.value = statusAtual;
                              return;
                            }
                            
                            if (novoStatus === 'SUBMETIDO') {
                              if (statusAtual !== 'CRIADO' && statusAtual !== 'REJEITADO') {
                                showToast('Só é possível submeter quando o rascunho foi criado ou rejeitado', 'warning');
                                e.target.value = statusAtual;
                                return;
                              }
                              if (!podeSubmeterPrestserv(funcionario)) {
                                showToast('Todas as tarefas devem estar concluídas antes de submeter', 'warning');
                                e.target.value = statusAtual;
                                return;
                              }
                            }
                            
                            if ((novoStatus === 'APROVADO' || novoStatus === 'REJEITADO') && statusAtual !== 'SUBMETIDO') {
                              showToast('Só é possível aprovar/rejeitar quando o prestserv foi submetido', 'warning');
                              e.target.value = statusAtual;
                              return;
                            }
                            
                            // Se passou por todas as validações, atualiza o status
                            updatePrestservStatus(funcionario.id, novoStatus);
                          }}
                          disabled={updatingStatus === funcionario.id}
                          className={`px-2 py-1 text-xs rounded border focus:outline-none focus:ring-1 focus:ring-gray-500 ${
                            funcionario.statusPrestserv === 'APROVADO' ? 'bg-gray-200 text-gray-800' :
                            funcionario.statusPrestserv === 'PENDENTE' ? 'bg-gray-100 text-gray-700' :
                            funcionario.statusPrestserv === 'REJEITADO' ? 'bg-gray-100 text-gray-800' :
                            funcionario.statusPrestserv === 'CRIADO' ? 'bg-gray-100 text-gray-800' :
                            funcionario.statusPrestserv === 'SUBMETIDO' ? 'bg-gray-100 text-gray-800' :
                            'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {getValidStatusOptions(funcionario).map(status => (
                            <option key={status} value={status}>{getStatusDisplayText(status)}</option>
                          ))}
                        </select>
                        {funcionario.statusPrestserv === 'REJEITADO' && (
                                                  <span className="text-gray-500 text-sm animate-pulse" title="Status Rejeitado - Atenção Necessária">
                          🚨
                        </span>
                        )}
                        {updatingStatus === funcionario.id && (
                          <span className="text-gray-500 text-xs">
                            ⏳
                          </span>
                        )}
                      </div>
                      
                      {/* Indicadores de status */}
                      {funcionario.statusTarefas === 'PENDENTE' && (
                        <div className="text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded border border-gray-200">
                          ⚠️ Aguardando conclusão das tarefas
                        </div>
                      )}
                      
                      {podeSubmeterPrestserv(funcionario) && (
                        <div className="text-xs text-gray-700 bg-gray-100 px-2 py-1 rounded border border-gray-300">
                          ✅ Apto para submissão
                        </div>
                      )}
                      
                      {funcionario.statusPrestserv === 'REJEITADO' && (
                        <div className="text-xs text-gray-700 bg-gray-100 px-2 py-1 rounded border border-gray-300">
                          ❌ Rejeitado - Corrija pendências
                        </div>
                      )}
                      
                      {funcionario.statusPrestserv === 'APROVADO' && (
                        <div className="text-xs text-gray-700 bg-gray-100 px-2 py-1 rounded border border-gray-300">
                          ✅ Prestserv Aprovado
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-900">
                    <div className="space-y-0.5">
                      <div className="text-xs">
                        <span className="font-medium">De:</span> {funcionario.contratoOrigem}
                      </div>
                      <div className="text-xs">
                        <span className="font-medium">Para:</span> {funcionario.contratoDestino}
                      </div>
                      <div className="text-xs text-gray-500">
                        {funcionario.dataSolicitacao}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm font-medium">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => router.push(`/prestserv/funcionario/${funcionario.id}`)}
                        className="inline-flex items-center px-2 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:text-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1"
                        title="Ver detalhes do funcionário"
                      >
                        <EyeIcon className="w-3 h-3 mr-1" />
                        Ver
                      </button>
                      <button
                        onClick={() => abrirModalConfirmacao(funcionario)}
                        className="inline-flex items-center px-2 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 hover:text-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1"
                        title="Aprovar e gerar tarefas padrão"
                      >
                        <PlusIcon className="w-3 h-3 mr-1" />
                        Aprovar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {activeTab === 'nominal' && funcionariosFiltrados.length === 0 && (
          <div className="text-center py-8">
            <div className="text-gray-500">
              <p className="text-base">📭 Nenhum funcionário encontrado</p>
              <p className="text-sm mt-1">Tente ajustar os filtros de busca</p>
            </div>
          </div>
        )}

        {/* Visão por Solicitação */}
        {activeTab === 'solicitacao' && (
          <div className="overflow-x-auto">
            <table className="w-full divide-y divide-gray-200" style={{ minWidth: '1200px' }}>
              <thead className="bg-gray-200 border-b border-gray-300">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase tracking-wider bg-gray-200">
                    Solicitação
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase tracking-wider bg-gray-200">
                    Contratos
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase tracking-wider bg-gray-200">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase tracking-wider bg-gray-200">
                    Funcionários
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase tracking-wider bg-gray-200">
                    Data
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase tracking-wider bg-gray-200">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {solicitacoesFiltradas.map((solicitacao: any, index: number) => {
                  const resumo = getFuncionariosResumo(solicitacao.funcionarios);
                  const isExpanded = expandedRows.has(solicitacao.solicitacaoId);
                  
                  return (
                    <React.Fragment key={solicitacao.solicitacaoId}>
                      {/* Linha Principal */}
                      <tr className={`hover:bg-gray-100 transition-colors duration-150 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <button
                              onClick={() => toggleRow(solicitacao.solicitacaoId)}
                              className="mr-2 p-1 hover:bg-gray-200 rounded transition-colors"
                            >
                              {isExpanded ? (
                                <ChevronDownIcon className="h-4 w-4 text-gray-500" />
                              ) : (
                                <ChevronRightIcon2 className="h-4 w-4 text-gray-500" />
                              )}
                            </button>
                            <span className="text-sm font-medium text-gray-900">
                              {solicitacao.solicitacaoId}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div className="space-y-1">
                            <div className="text-xs">
                              <span className="font-medium">De:</span> {solicitacao.contratoOrigem}
                            </div>
                            <div className="text-xs">
                              <span className="font-medium">Para:</span> {solicitacao.contratoDestino}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="space-y-1">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(resumo.pendentes > 0 ? 'PENDENTE' : 'CONCLUIDO')}`}>
                              {resumo.pendentes > 0 ? 'PENDENTE' : 'CONCLUIDO'}
                            </span>
                            <div className="text-xs text-gray-500">
                              {resumo.concluidos}/{resumo.total} concluídos
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div className="flex items-center space-x-2">
                            <UsersIcon className="h-4 w-4 text-gray-400" />
                            <span>{resumo.total} funcionários</span>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(solicitacao.dataSolicitacao)}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => {
                                // Expandir/colapsar para ver detalhes
                                toggleRow(solicitacao.solicitacaoId);
                              }}
                              className="inline-flex items-center px-2 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:text-gray-800 transition-colors"
                            >
                              <EyeIcon className="w-3 h-3 mr-1" />
                              Detalhes
                            </button>
                          </div>
                        </td>
                      </tr>
                      
                      {/* Linhas Expandidas */}
                      {isExpanded && solicitacao.funcionarios.map((funcionario: FuncionarioTableData, funcIndex: number) => (
                        <tr key={`${solicitacao.solicitacaoId}-${funcionario.id}`} className="bg-gray-50">
                          <td className="px-4 py-3 pl-8 text-xs text-gray-600">
                            {funcionario.nome}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600">
                            {funcionario.funcao}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(funcionario.statusTarefas)}`}>
                              {funcionario.statusTarefas}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600">
                            {funcionario.tarefasConcluidas}/{funcionario.totalTarefas} tarefas
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(funcionario.statusPrestserv)}`}>
                              {funcionario.statusPrestserv}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => {
                                  setSelectedFuncionario(funcionario);
                                  setShowTarefasModal(true);
                                }}
                                className="inline-flex items-center px-2 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                              >
                                <PlusIcon className="w-3 h-3 mr-1" />
                                Aprovar
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'solicitacao' && solicitacoesFiltradas.length === 0 && (
          <div className="text-center py-8">
            <div className="text-gray-500">
              <p className="text-base">📭 Nenhuma solicitação encontrada</p>
              <p className="text-sm mt-1">Tente ajustar os filtros de busca</p>
            </div>
          </div>
        )}
        
        {/* Controles de Paginação */}
        {totalPaginas > 1 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setPaginaAtual(Math.max(1, paginaAtual - 1))}
                disabled={paginaAtual === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeftIcon className="w-4 h-4 mr-1" />
                Anterior
              </button>
              <button
                onClick={() => setPaginaAtual(Math.min(totalPaginas, paginaAtual + 1))}
                disabled={paginaAtual === totalPaginas}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Próxima
                <ChevronRightIcon className="w-4 h-4 ml-1" />
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Mostrando <span className="font-medium">{indiceInicio + 1}</span> até{' '}
                  <span className="font-medium">{Math.min(indiceFim, funcionariosFiltrados.length)}</span> de{' '}
                  <span className="font-medium">{funcionariosFiltrados.length}</span> resultados
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <button
                    onClick={() => setPaginaAtual(Math.max(1, paginaAtual - 1))}
                    disabled={paginaAtual === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeftIcon className="w-4 h-4" />
                  </button>
                  {Array.from({ length: totalPaginas }, (_, i) => i + 1)
                    .filter(page => {
                      if (totalPaginas <= 7) return true;
                      if (page === 1 || page === totalPaginas) return true;
                      if (page >= paginaAtual - 1 && page <= paginaAtual + 1) return true;
                      return false;
                    })
                    .map((page, index, array) => {
                      const showEllipsis = index > 0 && page - array[index - 1] > 1;
                      return (
                        <div key={page} className="flex">
                          {showEllipsis && (
                            <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                              ...
                            </span>
                          )}
                          <button
                            onClick={() => setPaginaAtual(page)}
                            className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                              page === paginaAtual
                                ? 'z-10 bg-gray-100 border-gray-500 text-gray-800'
                                : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                            }`}
                          >
                            {page}
                          </button>
                        </div>
                      );
                    })}
                  <button
                    onClick={() => setPaginaAtual(Math.min(totalPaginas, paginaAtual + 1))}
                    disabled={paginaAtual === totalPaginas}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRightIcon className="w-4 h-4" />
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Confirmação */}
      {showConfirmModal && selectedFuncionario && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50" onClick={cancelarAprovacao}>
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white" onClick={(e) => e.stopPropagation()}>
            <div className="absolute top-2 right-2">
              <button
                onClick={cancelarAprovacao}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-3 text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-gray-100">
                <PlusIcon className="h-6 w-6 text-gray-600" />
              </div>
              <h3 className="text-lg leading-6 font-medium text-gray-900 mt-4">
                Aprovar Funcionário
              </h3>
              <div className="mt-2 px-7 py-3">
                <p className="text-sm text-gray-500">
                  Deseja aprovar e gerar tarefas padrão para <strong>{selectedFuncionario.nome}</strong>?
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  Você poderá selecionar quais setores gerar tarefas.
                </p>
              </div>
              <div className="items-center px-4 py-3">
                <div className="flex justify-center space-x-3">
                  <button
                    onClick={cancelarAprovacao}
                    className="px-4 py-2 bg-gray-300 text-gray-700 text-base font-medium rounded-md w-24 shadow-sm hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmarAprovacao}
                    className="px-4 py-2 bg-gray-600 text-white text-base font-medium rounded-md w-24 shadow-sm hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
                  >
                    Confirmar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Tarefas Padrão */}
      {showTarefasModal && selectedFuncionario && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50" onClick={cancelarAprovacao}>
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white" onClick={(e) => e.stopPropagation()}>
            <div className="absolute top-2 right-2">
              <button
                onClick={cancelarAprovacao}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-3">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-gray-100">
                <PlusIcon className="h-6 w-6 text-gray-600" />
              </div>
              <h3 className="text-lg leading-6 font-medium text-gray-900 mt-4 text-center">
                Gerar Tarefas Padrão
              </h3>
              <div className="mt-4">
                <p className="text-sm text-gray-600 text-center mb-4">
                  Selecione os setores para gerar tarefas para <strong>{selectedFuncionario.nome}</strong>:
                </p>
                
                <div className="space-y-3">
                  {[
                    { key: 'RH', label: 'Recursos Humanos', icon: '👥' },
                    { key: 'MEDICINA', label: 'Medicina', icon: '🏥' },
                    { key: 'TREINAMENTO', label: 'Treinamento', icon: '📚' }
                  ].map((setor) => (
                    <label key={setor.key} className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedSetores.includes(setor.key)}
                        onChange={() => toggleSetor(setor.key)}
                        className="h-4 w-4 text-gray-600 focus:ring-gray-500 border-gray-300 rounded"
                      />
                      <div className="ml-3 flex items-center">
                        <span className="text-lg mr-2">{setor.icon}</span>
                        <span className="text-sm font-medium text-gray-700">{setor.label}</span>
                      </div>
                    </label>
                  ))}
                </div>

                <div className="mt-6 flex justify-center space-x-3">
                  <button
                    onClick={cancelarAprovacao}
                    disabled={generatingTarefas}
                    className="px-4 py-2 bg-gray-300 text-gray-700 text-base font-medium rounded-md w-24 shadow-sm hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={gerarTarefasPadrao}
                    disabled={generatingTarefas || selectedSetores.length === 0}
                    className="px-4 py-2 bg-gray-600 text-white text-base font-medium rounded-md w-24 shadow-sm hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {generatingTarefas ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Gerando...
                      </div>
                    ) : (
                      'Gerar'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}