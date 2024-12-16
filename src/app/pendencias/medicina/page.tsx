"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from "@headlessui/react";
import { Fragment } from "react";
import { PlusIcon, PencilIcon, TrashIcon } from "lucide-react";
import { Funcionario, Pendencia } from "@/types/pendencias";
import { usePathname } from "next/navigation";

const EQUIPES = ["Medicina", "RH", "Treinamento"];
const STATUS = ["Pendente", "Em Andamento", "Concluída", "Cancelada"];
const PRIORIDADES = ["Baixa", "Média", "Alta", "Urgente"];

type FormData = {
  id?: number;
  funcionarioId: number | null;
  tipo: string;
  descricao: string;
  equipe: string;
  status: string;
  prioridade: string;
  dataLimite: string;
};

type PendenciaEnriquecida = Pendencia & {
  nomeFuncionario?: string;
};

export default function Pendencias() {
  const pathname = usePathname();
  
  // Função para extrair o departamento da rota atual
  const getDepartamentoFromPath = (path: string | null): string | null => {
    if (!path) return null;
    
    // Extrair o primeiro segmento da rota após a barra inicial
    const segments = path.split('/');
    const lastSegment = segments[segments.length - 1];
    
    // Mapear o segmento da rota para o nome do departamento
    if (lastSegment === 'medicina') return 'Medicina';
    if (lastSegment === 'rh') return 'RH';
    if (lastSegment === 'treinamento') return 'Treinamento';
    if (lastSegment === 'logistica') return null; // Logística vê tudo
    
    return null;
  };
  
  // Obter o departamento atual com base na rota
  const departamentoAtual = getDepartamentoFromPath(pathname);
  
  const [pendencias, setPendencias] = useState<Pendencia[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [loadingPendencias, setLoadingPendencias] = useState(false);
  const [loadingFuncionarios, setLoadingFuncionarios] = useState(false);
  const [pendenciasEnriquecidas, setPendenciasEnriquecidas] = useState<PendenciaEnriquecida[]>([]);

  const [filtros, setFiltros] = useState({
    equipe: '',
    status: '',
    prioridade: ''
  });

  useEffect(() => {
    fetchFuncionarios();
  }, []);

  useEffect(() => {
    fetchPendencias();
  }, [filtros, departamentoAtual]);

  useEffect(() => {
    if (pendencias.length && funcionarios.length) {
      const funcionarioMap = new Map(funcionarios.map(f => [f.id, f.nome]));

      const enriquecidas = pendencias.map(p => ({
        ...p,
        nomeFuncionario: funcionarioMap.get(p.funcionarioId) || ''
      }));

      setPendenciasEnriquecidas(enriquecidas);
    }
  }, [pendencias, funcionarios]);

  const [form, setForm] = useState<FormData>({
    funcionarioId: null,
    tipo: "",
    descricao: "",
    equipe: "RH",
    status: "Pendente",
    prioridade: "Média",
    dataLimite: "",
  });

  const [msg, setMsg] = useState<string | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [pendenciaParaExcluir, setPendenciaParaExcluir] = useState<Pendencia | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);

  async function fetchPendencias() {
    setLoadingPendencias(true);
    try {
      const params = new URLSearchParams();
      
      // Se houver um filtro de equipe selecionado pelo usuário, use-o
      if (filtros.equipe) {
        params.append('equipe', filtros.equipe);
      } 
      // Caso contrário, se estiver em uma rota de departamento específico, filtre por esse departamento
      else if (departamentoAtual) {
        params.append('equipe', departamentoAtual);
      }
      
      if (filtros.status) params.append('status', filtros.status);
      if (filtros.prioridade) params.append('prioridade', filtros.prioridade);

      const res = await fetch(`/api/pendencias?${params.toString()}`);
      const data = await res.json();
      setPendencias(data);
    } catch (error) {
      console.error('Erro ao buscar pendências:', error);
    } finally {
      setLoadingPendencias(false);
    }
  }

  async function fetchFuncionarios() {
    setLoadingFuncionarios(true);
    try {
      const res = await fetch("/api/dados");
      const data = await res.json();
      setFuncionarios(data);
    } catch (error) {
      console.error("Erro ao buscar funcionários:", error);
    } finally {
      setLoadingFuncionarios(false);
    }
  }

  function resetForm() {
    // Define a equipe padrão com base no departamento atual da rota
    const equipeDefault = departamentoAtual || "RH";
    
    setForm({
      funcionarioId: null,
      tipo: "",
      descricao: "",
      equipe: equipeDefault,
      status: "Pendente",
      prioridade: "Média",
      dataLimite: "",
    });
    setMsg(null);
  }

  // Criação e edição usam o mesmo handler, só muda se tem id ou não
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (!form.funcionarioId) {
      setMsg("Selecione um funcionário.");
      return;
    }
    if (!form.tipo.trim()) {
      setMsg("Informe o tipo.");
      return;
    }

    const payload = {
      ...form,
      dataLimite: form.dataLimite ? new Date(form.dataLimite).toISOString() : null,
      atualizadoPor: "Logistica",
      criadoPor: form.id ? undefined : "Logistica",
    };

    try {
      const url = form.id ? `/api/pendencias/${form.id}` : "/api/pendencias";
      const method = form.id ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        fetchPendencias();
        if (form.id) {
          setIsEditOpen(false);
        } else {
          setIsCreateOpen(false);
        }
        resetForm();
      } else {
        const err = await res.json();
        setMsg(err.error || "Erro ao salvar pendência");
      }
    } catch (error) {
      console.error("Erro no submit:", error);
      setMsg("Erro ao salvar pendência");
    }
  }

  async function handleDelete() {
    if (!pendenciaParaExcluir) return;

    try {
      const res = await fetch(`/api/pendencias/${pendenciaParaExcluir.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchPendencias();
        setIsDeleteOpen(false);
        setPendenciaParaExcluir(null);
      } else {
        alert("Erro ao excluir pendência");
      }
    } catch (error) {
      console.error("Erro ao excluir pendência:", error);
      // alert("Erro ao excluir pendência");
    }
  }

  // Atualiza só o status da pendência
  async function handleStatusChange(pendenciaId: number, novoStatus: string) {
    try {
      const res = await fetch(`/api/pendencias/${pendenciaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: novoStatus, atualizadoPor: "Logistica" }),
      });
      if (res.ok) {
        fetchPendencias();
      } else {
        alert("Erro ao atualizar status");
      }
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      alert("Erro ao atualizar status");
    }
  }

  function getBadgeColor(value: string, type: "prioridade" | "status") {
    const map = {
      prioridade: {
        Baixa: "bg-green-100 text-green-700",
        Média: "bg-yellow-100 text-yellow-700",
        Alta: "bg-orange-100 text-orange-700",
        Urgente: "bg-red-100 text-red-700",
      },
      status: {
        Pendente: "bg-yellow-100 text-yellow-800",
        "Em Andamento": "bg-blue-100 text-blue-800",
        Concluída: "bg-green-100 text-green-800",
        Cancelada: "bg-gray-200 text-gray-800",
      },
    };
    return (map[type] as Record<string, string>)[value] || "bg-gray-100 text-gray-700";
  }

  function openEditModal(p: Pendencia) {
    setForm({
      id: p.id,
      funcionarioId: p.funcionarioId,
      tipo: p.tipo,
      descricao: p.descricao || "",
      equipe: p.equipe,
      status: p.status,
      prioridade: p.prioridade,
      dataLimite: p.dataLimite ? new Date(p.dataLimite).toISOString().slice(0, 10) : "",
    });
    setMsg(null);
    setIsEditOpen(true);
  }

  // Função para filtrar dados
  const getFilteredData = () => {
    const searchLower = searchTerm.toLowerCase();

    return pendenciasEnriquecidas.filter(p => {
      const matchesSearch = !searchTerm || (
        Object.values(p).some(value =>
          value && value.toString().toLowerCase().includes(searchLower)
        ) ||
        (p.nomeFuncionario && p.nomeFuncionario.toLowerCase().includes(searchLower))
      );

      const matchesStatus = !filtros.status || p.status === filtros.status;
      
      // Verifica se corresponde ao filtro de equipe selecionado pelo usuário
      const matchesEquipe = !filtros.equipe || p.equipe === filtros.equipe;
      
      const matchesPrioridade = !filtros.prioridade || p.prioridade === filtros.prioridade;

      return matchesSearch && matchesEquipe && matchesPrioridade;
    });
  };


  const clearFilters = () => {
    setSearchTerm('');
    setFiltros({
      status: '',
      equipe: '',
      prioridade: '',
    });
  };

  const filteredData = getFilteredData();
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const dadosPagina = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);


  return (
    <div className="max-w-7xl mx-auto p-4">
      <header className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-semibold">Pendências</h1>
          {departamentoAtual && (
            <p className="text-gray-600 mt-1">Visualizando pendências do departamento: {departamentoAtual}</p>
          )}
          {!departamentoAtual && pathname?.includes('logistica') && (
            <p className="text-gray-600 mt-1">Visualizando todas as pendências</p>
          )}
        </div>
        <button
          onClick={() => {
            resetForm();
            setIsCreateOpen(true);
          }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
        >
          <PlusIcon size={18} /> Nova Pendência
        </button>
      </header>

      <div className="bg-white shadow rounded p-2 mb-2">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Busca</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar..."
                className="pl-8 pr-3 py-1.5 bg-white w-full h-8 border border-gray-300 rounded px-3 text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <svg className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 transform -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {/* <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Equipe</label>
            <select
              value={filtros.equipe}
              onChange={(e) => setFiltros(f => ({ ...f, equipe: e.target.value }))}
              className="w-full h-8 border border-gray-300 rounded px-3 text-sm"
              disabled={departamentoAtual !== null && !pathname?.includes('logistica')}
              title={departamentoAtual && !pathname?.includes('logistica') ? `Filtro fixado em ${departamentoAtual}` : ""}
            >
              <option value="">Todas</option>
              {EQUIPES.map((eq) => (
                <option key={eq} value={eq}>{eq}</option>
              ))}
            </select>
            {departamentoAtual && !pathname?.includes('logistica') && (
              <p className="text-xs text-gray-500 mt-1">Filtro fixado pelo departamento atual</p>
            )}
          </div> */}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filtros.status}
              onChange={(e) => setFiltros(f => ({ ...f, status: e.target.value }))}
              className="w-full h-8 border border-gray-300 rounded px-3 text-sm"
            >
              <option value="">Todos</option>
              {STATUS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Prioridade</label>
            <select
              value={filtros.prioridade}
              onChange={(e) => setFiltros(f => ({ ...f, prioridade: e.target.value }))}
              className="w-full h-8 border border-gray-300 rounded px-3 text-sm"
            >
              <option value="">Todas</option>
              {PRIORIDADES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Botão alinhado visualmente com os campos */}
          <div className="flex items-end">
            <button
              onClick={clearFilters}
              className="w-full h-8 flex items-center justify-center border border-gray-300 rounded px-3 text-sm text-gray-600 hover:text-gray-800 hover:border-gray-400 transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Limpar Filtros
            </button>
          </div>
        </div>
      </div>


      <section className="bg-white shadow rounded p-2 overflow-x-auto">
        {loadingPendencias ? (
          <p>Carregando pendências...</p>
        ) : pendencias.length === 0 ? (
          <p>Sem pendências cadastradas.</p>
        ) : (
          <table className="min-w-full table-auto border-collapse border border-gray-300">
            <thead className="bg-gray-50">
              <tr>
                <th className="border border-gray-300 px-3 py-2 text-left">Funcionário</th>
                <th className="border border-gray-300 px-3 py-2 text-left">Equipe</th>
                <th className="border border-gray-300 px-3 py-2 text-left">Tipo</th>
                <th className="border border-gray-300 px-3 py-2 text-left">Status</th>
                <th className="border border-gray-300 px-3 py-2 text-left">Prioridade</th>
                <th className="border border-gray-300 px-3 py-2 text-left">Data Prevista</th>
                <th className="border border-gray-300 px-3 py-2 text-left max-w-xs">Descrição</th>
                <th className="border border-gray-300 px-3 py-2 text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {dadosPagina.map((p) => (
                <tr
                  key={p.id}
                  className="hover:bg-gray-50 text-sm align-top"
                >
                  <td className="border border-gray-300 px-3 py-2 max-w-[150px] truncate">
                    {funcionarios.find((f) => f.id === p.funcionarioId)?.nome || p.funcionarioId}
                  </td>
                  <td className="border border-gray-300 px-3 py-2 max-w-[110px]">{p.equipe}</td>
                  <td className="border border-gray-300 px-3 py-2 max-w-[120px] truncate">{p.tipo}</td>
                  <td className="border border-gray-300 px-3 py-2 max-w-[120px]">
                    <select
                      className="border border-gray-300 rounded px-2 py-1 text-sm w-full"
                      value={p.status}
                      onChange={(e) => handleStatusChange(p.id, e.target.value)}
                    >
                      {STATUS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="border border-gray-300 px-3 py-2 max-w-[110px]">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${getBadgeColor(p.prioridade, "prioridade")}`}>
                      {p.prioridade}
                    </span>
                  </td>
                  <td className="border border-gray-300 px-3 py-2 max-w-[120px]">
                    {p.dataLimite ? new Date(p.dataLimite).toLocaleDateString() : "-"}
                  </td>
                  <td className="border border-gray-300 px-3 py-2 max-w-[300px] break-words">{p.descricao}</td>
                  <td className="border border-gray-300 px-3 py-2 text-center space-x-2">
                    <button
                      onClick={() => openEditModal(p)}
                      className="text-blue-600 hover:text-blue-800"
                      title="Editar"
                      aria-label="Editar pendência"
                    >
                      <PencilIcon size={18} />
                    </button>
                    <button
                      onClick={() => {
                        setPendenciaParaExcluir(p);
                        setIsDeleteOpen(true);
                      }}
                      className="text-red-600 hover:text-red-800"
                      title="Excluir"
                      aria-label="Excluir pendência"
                    >
                      <TrashIcon size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Modal Criar */}
      <Transition appear show={isCreateOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setIsCreateOpen(false)}>
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-50"
            leave="ease-in duration-200"
            leaveFrom="opacity-50"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-50" />
          </TransitionChild>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <TransitionChild
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95 translate-y-4"
                enterTo="opacity-100 scale-100 translate-y-0"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100 translate-y-0"
                leaveTo="opacity-0 scale-95 translate-y-4"
              >
                <DialogPanel className="w-full max-w-lg transform overflow-hidden rounded bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <DialogTitle
                    as="h3"
                    className="text-lg font-semibold leading-6 text-gray-900 mb-4"
                  >
                    Nova Pendência
                  </DialogTitle>

                  <form onSubmit={handleSubmit} className="space-y-4 text-sm">
                    <div>
                      <label className="block font-medium mb-1" htmlFor="funcionarioId">Funcionário</label>
                      <select
                        id="funcionarioId"
                        value={form.funcionarioId ?? ""}
                        onChange={(e) => setForm((f) => ({ ...f, funcionarioId: e.target.value ? Number(e.target.value) : null }))}
                        className="w-full border border-gray-300 rounded px-3 py-2"
                        required
                      >
                        <option value="">Selecione...</option>
                        {funcionarios.map((f) => (
                          <option key={f.id} value={f.id}>{f.nome}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-medium mb-1" htmlFor="tipo">Tipo</label>
                      <input
                        type="text"
                        id="tipo"
                        value={form.tipo}
                        onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}
                        className="w-full border border-gray-300 rounded px-3 py-2"
                        placeholder="Ex: Suspensão de equipe"
                        required
                      />
                    </div>

                    <div>
                      <label className="block font-medium mb-1" htmlFor="descricao">Descrição</label>
                      <textarea
                        id="descricao"
                        value={form.descricao}
                        onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                        rows={3}
                        className="w-full border border-gray-300 rounded px-3 py-2 resize-y"
                      />
                    </div>

                    <div>
                      <label className="block font-medium mb-1" htmlFor="equipe">Equipe</label>
                      <select
                        id="equipe"
                        value={form.equipe}
                        onChange={(e) => setForm((f) => ({ ...f, equipe: e.target.value }))}
                        className="w-full border border-gray-300 rounded px-3 py-2"
                        disabled={departamentoAtual !== null && !pathname?.includes('logistica')}
                        title={departamentoAtual && !pathname?.includes('logistica') ? `Equipe fixada em ${departamentoAtual}` : ""}
                      >
                        {EQUIPES.map((eq) => (
                          <option key={eq} value={eq}>{eq}</option>
                        ))}
                      </select>
                      {departamentoAtual && !pathname?.includes('logistica') && (
                        <p className="text-xs text-gray-500 mt-1">Equipe fixada pelo departamento atual</p>
                      )}
                    </div>

                    <div>
                      <label className="block font-medium mb-1" htmlFor="status">Status</label>
                      <select
                        id="status"
                        value={form.status}
                        onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                        className="w-full border border-gray-300 rounded px-3 py-2"
                      >
                        {STATUS.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-medium mb-1" htmlFor="prioridade">Prioridade</label>
                      <select
                        id="prioridade"
                        value={form.prioridade}
                        onChange={(e) => setForm((f) => ({ ...f, prioridade: e.target.value }))}
                        className="w-full border border-gray-300 rounded px-3 py-2"
                      >
                        {PRIORIDADES.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-medium mb-1" htmlFor="dataLimite">Data Prevista</label>
                      <input
                        type="date"
                        id="dataLimite"
                        value={form.dataLimite}
                        onChange={(e) => setForm((f) => ({ ...f, dataLimite: e.target.value }))}
                        className="w-full border border-gray-300 rounded px-3 py-2"
                      />
                    </div>

                    {msg && (
                      <p className="text-sm text-red-600">{msg}</p>
                    )}

                    <div className="mt-6 flex justify-end gap-3">
                      <button
                        type="button"
                        className="px-4 py-2 rounded border border-gray-300 hover:bg-gray-100"
                        onClick={() => setIsCreateOpen(false)}
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                      >
                        Salvar
                      </button>
                    </div>
                  </form>
                </DialogPanel>
              </TransitionChild>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Modal Editar - igual ao criar, só com dados preenchidos */}
      <Transition appear show={isEditOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setIsEditOpen(false)}>
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-50"
            leave="ease-in duration-200"
            leaveFrom="opacity-50"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-50" />
          </TransitionChild>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <TransitionChild
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95 translate-y-4"
                enterTo="opacity-100 scale-100 translate-y-0"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100 translate-y-0"
                leaveTo="opacity-0 scale-95 translate-y-4"
              >
                <DialogPanel className="w-full max-w-lg transform overflow-hidden rounded bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <DialogTitle
                    as="h3"
                    className="text-lg font-semibold leading-6 text-gray-900 mb-4"
                  >
                    Editar Pendência
                  </DialogTitle>

                  <form onSubmit={handleSubmit} className="space-y-4 text-sm">
                    {/* mesmo formulário do criar */}
                    <div>
                      <label className="block font-medium mb-1" htmlFor="funcionarioIdEdit">Funcionário</label>
                      <select
                        id="funcionarioIdEdit"
                        value={form.funcionarioId ?? ""}
                        onChange={(e) => setForm((f) => ({ ...f, funcionarioId: e.target.value ? Number(e.target.value) : null }))}
                        className="w-full border border-gray-300 rounded px-3 py-2"
                        required
                      >
                        <option value="">Selecione...</option>
                        {funcionarios.map((f) => (
                          <option key={f.id} value={f.id}>{f.nome}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-medium mb-1" htmlFor="tipoEdit">Tipo</label>
                      <input
                        type="text"
                        id="tipoEdit"
                        value={form.tipo}
                        onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}
                        className="w-full border border-gray-300 rounded px-3 py-2"
                        placeholder="Ex: Suspensão de equipe"
                        required
                      />
                    </div>

                    <div>
                      <label className="block font-medium mb-1" htmlFor="descricaoEdit">Descrição</label>
                      <textarea
                        id="descricaoEdit"
                        value={form.descricao}
                        onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                        rows={3}
                        className="w-full border border-gray-300 rounded px-3 py-2 resize-y"
                      />
                    </div>

                    <div>
                      <label className="block font-medium mb-1" htmlFor="equipeEdit">Equipe</label>
                      <select
                        id="equipeEdit"
                        value={form.equipe}
                        onChange={(e) => setForm((f) => ({ ...f, equipe: e.target.value }))}
                        className="w-full border border-gray-300 rounded px-3 py-2"
                      >
                        {EQUIPES.map((eq) => (
                          <option key={eq} value={eq}>{eq}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-medium mb-1" htmlFor="statusEdit">Status</label>
                      <select
                        id="statusEdit"
                        value={form.status}
                        onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                        className="w-full border border-gray-300 rounded px-3 py-2"
                      >
                        {STATUS.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-medium mb-1" htmlFor="prioridadeEdit">Prioridade</label>
                      <select
                        id="prioridadeEdit"
                        value={form.prioridade}
                        onChange={(e) => setForm((f) => ({ ...f, prioridade: e.target.value }))}
                        className="w-full border border-gray-300 rounded px-3 py-2"
                      >
                        {PRIORIDADES.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-medium mb-1" htmlFor="dataLimiteEdit">Data Prevista</label>
                      <input
                        type="date"
                        id="dataLimiteEdit"
                        value={form.dataLimite}
                        onChange={(e) => setForm((f) => ({ ...f, dataLimite: e.target.value }))}
                        className="w-full border border-gray-300 rounded px-3 py-2"
                      />
                    </div>

                    {msg && (
                      <p className="text-sm text-red-600">{msg}</p>
                    )}

                    <div className="mt-6 flex justify-end gap-3">
                      <button
                        type="button"
                        className="px-4 py-2 rounded border border-gray-300 hover:bg-gray-100"
                        onClick={() => setIsEditOpen(false)}
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                      >
                        Salvar
                      </button>
                    </div>
                  </form>
                </DialogPanel>
              </TransitionChild>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Modal Excluir */}
      <Transition appear show={isDeleteOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setIsDeleteOpen(false)}>
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-50"
            leave="ease-in duration-200"
            leaveFrom="opacity-50"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-50" />
          </TransitionChild>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <TransitionChild
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95 translate-y-4"
                enterTo="opacity-100 scale-100 translate-y-0"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100 translate-y-0"
                leaveTo="opacity-0 scale-95 translate-y-4"
              >
                <DialogPanel className="w-full max-w-md transform overflow-hidden rounded bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <DialogTitle
                    as="h3"
                    className="text-lg font-semibold leading-6 text-gray-900 mb-4"
                  >
                    Confirmar Exclusão
                  </DialogTitle>

                  <p className="mb-6 text-sm">
                    Tem certeza que deseja excluir esta pendência?
                  </p>

                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      className="px-4 py-2 rounded border border-gray-300 hover:bg-gray-100"
                      onClick={() => setIsDeleteOpen(false)}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                      onClick={handleDelete}
                    >
                      Excluir
                    </button>
                  </div>
                </DialogPanel>
              </TransitionChild>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
}
