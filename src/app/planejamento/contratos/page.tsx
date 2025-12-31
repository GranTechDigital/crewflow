"use client";

import { useEffect, useState, Fragment } from "react";
import { Dialog, Transition, Menu, Listbox } from "@headlessui/react";
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ChevronDownIcon,
  CheckIcon,
  ChevronUpDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DocumentIcon,
  XMarkIcon,
  EllipsisVerticalIcon,
} from "@heroicons/react/24/outline";
import ProtectedRoute from "@/components/ProtectedRoute";
import { usePermissions } from "@/app/hooks/useAuth";
import { PERMISSIONS, ROUTE_PROTECTION } from "@/lib/permissions";

type Contrato = {
  id: number;
  numero: string;
  nome: string;
  cliente: string;
  dataInicio: string;
  dataFim: string;
  status: string;
};

const STATUS_OPTIONS = [
  { value: "Ativo", label: "Ativo", color: "bg-green-100 text-green-800" },
  { value: "Inativo", label: "Inativo", color: "bg-red-100 text-red-800" },
  {
    value: "Suspenso",
    label: "Suspenso",
    color: "bg-yellow-100 text-yellow-800",
  },
  {
    value: "Em Análise",
    label: "Em Análise",
    color: "bg-blue-100 text-blue-800",
  },
];

// Função para formatar datas ignorando o fuso UTC (para não subtrair um dia)
function formatDateWithoutTimezone(dateStr: string) {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("T")[0].split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("pt-BR");
}

function getStatusColor(status: string) {
  const statusOption = STATUS_OPTIONS.find((option) => option.value === status);
  return statusOption?.color || "bg-gray-100 text-gray-800";
}

function ContratosContent() {
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(false);
  const { hasPermission } = usePermissions();
  const isEditor = hasPermission(PERMISSIONS.ACCESS_PLANEJAMENTO);

  // Filtros e busca
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [clienteFilter, setClienteFilter] = useState("");

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingContrato, setEditingContrato] = useState<Contrato | null>(null);
  const [form, setForm] = useState({
    numero: "",
    nome: "",
    cliente: "",
    dataInicio: "",
    dataFim: "",
    status: "Ativo",
  });
  const [selectedStatus, setSelectedStatus] = useState(STATUS_OPTIONS[0]);

  async function fetchContratos() {
    setLoading(true);
    try {
      const res = await fetch("/api/contratos");
      if (!res.ok) throw new Error("Erro ao carregar contratos");
      const data = await res.json();
      setContratos(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  // Filtrar contratos
  const filteredContratos = contratos.filter((contrato) => {
    const matchesSearch =
      contrato.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contrato.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contrato.cliente.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = !statusFilter || contrato.status === statusFilter;
    const matchesCliente =
      !clienteFilter ||
      contrato.cliente.toLowerCase().includes(clienteFilter.toLowerCase());

    return matchesSearch && matchesStatus && matchesCliente;
  });

  // Paginação
  const totalPages = Math.ceil(filteredContratos.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedContratos = filteredContratos.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  // Obter lista única de clientes para filtro
  const uniqueClientes = Array.from(
    new Set(contratos.map((c) => c.cliente))
  ).sort();

  useEffect(() => {
    fetchContratos();
  }, []);

  useEffect(() => {
    setCurrentPage(1); // Reset página quando filtros mudam
  }, [searchTerm, statusFilter, clienteFilter]);

  function openAddModal() {
    if (!isEditor) return;
    setEditingContrato(null);
    setForm({
      numero: "",
      nome: "",
      cliente: "",
      dataInicio: "",
      dataFim: "",
      status: "Ativo",
    });
    setSelectedStatus(STATUS_OPTIONS[0]);
    setModalOpen(true);
  }

  function openEditModal(contrato: Contrato) {
    if (!isEditor) return;
    setEditingContrato(contrato);
    const statusOption =
      STATUS_OPTIONS.find((s) => s.value === contrato.status) ||
      STATUS_OPTIONS[0];
    setSelectedStatus(statusOption);
    setForm({
      numero: contrato.numero,
      nome: contrato.nome,
      cliente: contrato.cliente,
      dataInicio: contrato.dataInicio.split("T")[0], // yyyy-mm-dd
      dataFim: contrato.dataFim.split("T")[0],
      status: contrato.status,
    });
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isEditor) return;

    const formData = { ...form, status: selectedStatus.value };

    if (
      !formData.numero ||
      !formData.nome ||
      !formData.cliente ||
      !formData.dataInicio ||
      !formData.dataFim ||
      !formData.status
    ) {
      alert("Preencha todos os campos");
      return;
    }

    try {
      let res;
      if (editingContrato) {
        res = await fetch(`/api/contratos/${editingContrato.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
      } else {
        res = await fetch("/api/contratos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
      }

      if (!res.ok) throw new Error("Erro ao salvar contrato");

      setModalOpen(false);
      fetchContratos();
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar contrato");
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Tem certeza que deseja excluir este contrato?")) return;
    if (!isEditor) return;

    try {
      const res = await fetch(`/api/contratos/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Erro ao deletar contrato");
      fetchContratos();
    } catch (error) {
      console.error(error);
      alert("Erro ao deletar contrato");
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Gestão de Contratos
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Gerencie todos os contratos da empresa de forma centralizada
          </p>
        </div>

        {/* Filtros e Ações */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Busca */}
            <div className="flex-1 max-w-lg">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por número, nome ou cliente..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {/* Filtros */}
            <div className="flex flex-wrap gap-3">
              {/* Filtro por Status */}
              <Menu as="div" className="relative">
                <Menu.Button className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <FunnelIcon className="h-4 w-4 mr-2" />
                  {statusFilter || "Todos os Status"}
                  <ChevronDownIcon className="h-4 w-4 ml-2" />
                </Menu.Button>
                <Transition
                  as={Fragment}
                  enter="transition ease-out duration-100"
                  enterFrom="transform opacity-0 scale-95"
                  enterTo="transform opacity-100 scale-100"
                  leave="transition ease-in duration-75"
                  leaveFrom="transform opacity-100 scale-100"
                  leaveTo="transform opacity-0 scale-95"
                >
                  <Menu.Items className="absolute right-0 z-10 mt-2 w-48 origin-top-right bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none rounded-lg">
                    <div className="py-1">
                      <Menu.Item>
                        {({ active }) => (
                          <button
                            onClick={() => setStatusFilter("")}
                            className={`${
                              active ? "bg-gray-100" : ""
                            } block w-full text-left px-4 py-2 text-sm text-gray-700`}
                          >
                            Todos os Status
                          </button>
                        )}
                      </Menu.Item>
                      {STATUS_OPTIONS.map((status) => (
                        <Menu.Item key={status.value}>
                          {({ active }) => (
                            <button
                              onClick={() => setStatusFilter(status.value)}
                              className={`${
                                active ? "bg-gray-100" : ""
                              } block w-full text-left px-4 py-2 text-sm text-gray-700`}
                            >
                              <span
                                className={`inline-block w-2 h-2 rounded-full mr-2 ${
                                  status.color.split(" ")[0]
                                }`}
                              ></span>
                              {status.label}
                            </button>
                          )}
                        </Menu.Item>
                      ))}
                    </div>
                  </Menu.Items>
                </Transition>
              </Menu>

              {/* Filtro por Cliente */}
              <Menu as="div" className="relative">
                <Menu.Button className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <FunnelIcon className="h-4 w-4 mr-2" />
                  {clienteFilter || "Todos os Clientes"}
                  <ChevronDownIcon className="h-4 w-4 ml-2" />
                </Menu.Button>
                <Transition
                  as={Fragment}
                  enter="transition ease-out duration-100"
                  enterFrom="transform opacity-0 scale-95"
                  enterTo="transform opacity-100 scale-100"
                  leave="transition ease-in duration-75"
                  leaveFrom="transform opacity-100 scale-100"
                  leaveTo="transform opacity-0 scale-95"
                >
                  <Menu.Items className="absolute right-0 z-10 mt-2 w-64 origin-top-right bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none rounded-lg max-h-60 overflow-auto">
                    <div className="py-1">
                      <Menu.Item>
                        {({ active }) => (
                          <button
                            onClick={() => setClienteFilter("")}
                            className={`${
                              active ? "bg-gray-100" : ""
                            } block w-full text-left px-4 py-2 text-sm text-gray-700`}
                          >
                            Todos os Clientes
                          </button>
                        )}
                      </Menu.Item>
                      {uniqueClientes.map((cliente) => (
                        <Menu.Item key={cliente}>
                          {({ active }) => (
                            <button
                              onClick={() => setClienteFilter(cliente)}
                              className={`${
                                active ? "bg-gray-100" : ""
                              } block w-full text-left px-4 py-2 text-sm text-gray-700 truncate`}
                            >
                              {cliente}
                            </button>
                          )}
                        </Menu.Item>
                      ))}
                    </div>
                  </Menu.Items>
                </Transition>
              </Menu>
            </div>

            {/* Botão Adicionar */}
            {isEditor && (
              <button
                onClick={openAddModal}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Novo Contrato
              </button>
            )}
          </div>

          {/* Estatísticas */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>
                Mostrando {paginatedContratos.length} de{" "}
                {filteredContratos.length} contratos
                {filteredContratos.length !== contratos.length &&
                  ` (${contratos.length} total)`}
              </span>
              {(searchTerm || statusFilter || clienteFilter) && (
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setStatusFilter("");
                    setClienteFilter("");
                  }}
                  className="text-blue-600 hover:text-blue-800 font-medium"
                >
                  Limpar filtros
                </button>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="bg-white shadow rounded-lg">
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Carregando contratos...</p>
            </div>
          </div>
        ) : filteredContratos.length === 0 ? (
          <div className="bg-white shadow rounded-lg">
            <div className="text-center py-12">
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                Nenhum contrato encontrado
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchTerm || statusFilter || clienteFilter
                  ? "Tente ajustar os filtros de busca."
                  : "Comece criando um novo contrato."}
              </p>
              {isEditor && !searchTerm && !statusFilter && !clienteFilter && (
                <div className="mt-6">
                  <button
                    onClick={openAddModal}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <PlusIcon className="h-4 w-4 mr-2" />
                    Criar primeiro contrato
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Tabela Desktop */}
            <div className="hidden lg:block bg-white shadow rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Número
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Nome
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cliente
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Período
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedContratos.map((contrato) => (
                    <tr
                      key={contrato.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {contrato.numero}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">
                          {contrato.nome}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {contrato.cliente}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {formatDateWithoutTimezone(contrato.dataInicio)} até{" "}
                          {formatDateWithoutTimezone(contrato.dataFim)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                            contrato.status
                          )}`}
                        >
                          {contrato.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {isEditor && (
                          <div className="flex justify-end space-x-2">
                            <button
                              onClick={() => openEditModal(contrato)}
                              className="inline-flex items-center p-2 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              <PencilIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(contrato.id)}
                              className="inline-flex items-center p-2 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cards Mobile */}
            <div className="lg:hidden space-y-4">
              {paginatedContratos.map((contrato) => (
                <div
                  key={contrato.id}
                  className="bg-white shadow rounded-lg p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h3 className="text-sm font-medium text-gray-900">
                          {contrato.nome}
                        </h3>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                            contrato.status
                          )}`}
                        >
                          {contrato.status}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-gray-600">
                        #{contrato.numero}
                      </p>
                      <p className="mt-1 text-sm text-gray-600">
                        {contrato.cliente}
                      </p>
                      <p className="mt-2 text-xs text-gray-500">
                        {formatDateWithoutTimezone(contrato.dataInicio)} até{" "}
                        {formatDateWithoutTimezone(contrato.dataFim)}
                      </p>
                    </div>
                    {isEditor && (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => openEditModal(contrato)}
                          className="p-2 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(contrato.id)}
                          className="p-2 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Paginação */}
        {filteredContratos.length > itemsPerPage && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 rounded-b-lg">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              <button
                onClick={() =>
                  setCurrentPage(Math.min(totalPages, currentPage + 1))
                }
                disabled={currentPage === totalPages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Próximo
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Mostrando{" "}
                  <span className="font-medium">
                    {(currentPage - 1) * itemsPerPage + 1}
                  </span>{" "}
                  até{" "}
                  <span className="font-medium">
                    {Math.min(
                      currentPage * itemsPerPage,
                      filteredContratos.length
                    )}
                  </span>{" "}
                  de{" "}
                  <span className="font-medium">
                    {filteredContratos.length}
                  </span>{" "}
                  resultados
                </p>
              </div>
              <div>
                <nav
                  className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px"
                  aria-label="Pagination"
                >
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeftIcon className="h-5 w-5" />
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNumber;
                    if (totalPages <= 5) {
                      pageNumber = i + 1;
                    } else if (currentPage <= 3) {
                      pageNumber = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNumber = totalPages - 4 + i;
                    } else {
                      pageNumber = currentPage - 2 + i;
                    }
                    return (
                      <button
                        key={pageNumber}
                        onClick={() => setCurrentPage(pageNumber)}
                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                          currentPage === pageNumber
                            ? "z-10 bg-blue-50 border-blue-500 text-blue-600"
                            : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"
                        }`}
                      >
                        {pageNumber}
                      </button>
                    );
                  })}
                  <button
                    onClick={() =>
                      setCurrentPage(Math.min(totalPages, currentPage + 1))
                    }
                    disabled={currentPage === totalPages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRightIcon className="h-5 w-5" />
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      <Transition appear show={modalOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => setModalOpen(false)}
        >
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title
                    as="h3"
                    className="text-lg font-medium leading-6 text-gray-900 mb-6"
                  >
                    <div className="flex items-center justify-between">
                      <span>
                        {editingContrato ? "Editar Contrato" : "Novo Contrato"}
                      </span>
                    </div>
                  </Dialog.Title>

                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Número do Contrato
                        </label>
                        <input
                          type="text"
                          value={form.numero}
                          onChange={(e) =>
                            setForm({ ...form, numero: e.target.value })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Ex: CT-2024-001"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Status
                        </label>
                        <Listbox
                          value={selectedStatus}
                          onChange={setSelectedStatus}
                        >
                          <div className="relative">
                            <Listbox.Button className="relative w-full cursor-default rounded-lg bg-white py-2 pl-3 pr-10 text-left border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                              <span className="flex items-center">
                                <span
                                  className={`inline-block w-2 h-2 rounded-full mr-2 ${
                                    selectedStatus.color.split(" ")[0]
                                  }`}
                                ></span>
                                <span className="block truncate">
                                  {selectedStatus.label}
                                </span>
                              </span>
                              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                                <ChevronUpDownIcon className="h-5 w-5 text-gray-400" />
                              </span>
                            </Listbox.Button>
                            <Transition
                              as={Fragment}
                              leave="transition ease-in duration-100"
                              leaveFrom="opacity-100"
                              leaveTo="opacity-0"
                            >
                              <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                                {STATUS_OPTIONS.map((status) => (
                                  <Listbox.Option
                                    key={status.value}
                                    className={({ active }) =>
                                      `relative cursor-default select-none py-2 pl-10 pr-4 ${
                                        active
                                          ? "bg-blue-100 text-blue-900"
                                          : "text-gray-900"
                                      }`
                                    }
                                    value={status}
                                  >
                                    {({ selected }) => (
                                      <>
                                        <span className="flex items-center">
                                          <span
                                            className={`inline-block w-2 h-2 rounded-full mr-2 ${
                                              status.color.split(" ")[0]
                                            }`}
                                          ></span>
                                          <span
                                            className={`block truncate ${
                                              selected
                                                ? "font-medium"
                                                : "font-normal"
                                            }`}
                                          >
                                            {status.label}
                                          </span>
                                        </span>
                                        {selected && (
                                          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-blue-600">
                                            <CheckIcon className="h-5 w-5" />
                                          </span>
                                        )}
                                      </>
                                    )}
                                  </Listbox.Option>
                                ))}
                              </Listbox.Options>
                            </Transition>
                          </div>
                        </Listbox>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Nome do Contrato
                      </label>
                      <input
                        type="text"
                        value={form.nome}
                        onChange={(e) =>
                          setForm({ ...form, nome: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Digite o nome do contrato"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Cliente
                      </label>
                      <input
                        type="text"
                        value={form.cliente}
                        onChange={(e) =>
                          setForm({ ...form, cliente: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Nome do cliente ou empresa"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Data de Início
                        </label>
                        <input
                          type="date"
                          value={form.dataInicio}
                          onChange={(e) =>
                            setForm({ ...form, dataInicio: e.target.value })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Data de Término
                        </label>
                        <input
                          type="date"
                          value={form.dataFim}
                          onChange={(e) =>
                            setForm({ ...form, dataFim: e.target.value })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required
                        />
                      </div>
                    </div>

                    <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
                      <button
                        type="button"
                        onClick={() => setModalOpen(false)}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                      >
                        {editingContrato
                          ? "Atualizar Contrato"
                          : "Criar Contrato"}
                      </button>
                    </div>
                  </form>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
}

export default function ContratosPage() {
  return (
    <ProtectedRoute
      requiredEquipe={ROUTE_PROTECTION.PLANEJAMENTO.requiredEquipe}
      requiredPermissions={ROUTE_PROTECTION.PLANEJAMENTO.requiredPermissions}
    >
      <ContratosContent />
    </ProtectedRoute>
  );
}
