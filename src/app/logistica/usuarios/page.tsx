"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  PlusIcon,
  PencilIcon,
  KeyIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import ProtectedRoute from "@/components/ProtectedRoute";
import { ROUTE_PROTECTION, PERMISSIONS } from "@/lib/permissions";
import { useAuth, usePermissions } from "@/app/hooks/useAuth";

interface Funcionario {
  id: number;
  matricula: string;
  nome: string;
  email: string;
  funcao: string;
  departamento: string;
  usuario?: {
    id: number;
    equipe: Equipe;
  } | null;
}

interface Equipe {
  id: number;
  nome: string;
  descricao?: string;
}

interface Usuario {
  id: number;
  funcionarioId: number;
  matricula: string;
  nome: string;
  email?: string | null;
  emailSecundario?: string | null;
  funcao: string;
  departamento: string;
  equipe: Equipe;
  ativo: boolean;
  ultimoLogin: string;
  createdAt: string;
  updatedAt: string;
}

export default function UsuariosLogisticaPage() {
  return (
    <ProtectedRoute
      requiredPermissions={ROUTE_PROTECTION.LOGISTICA.requiredPermissions}
      requiredEquipe={ROUTE_PROTECTION.LOGISTICA.requiredEquipe}
    >
      <UsuariosEquipeContent />
    </ProtectedRoute>
  );
}

function UsuariosEquipeContent() {
  const { usuario } = useAuth();
  const { hasPermission } = usePermissions();
  const normalize = (str: string) =>
    (str || "")
      .trim()
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  const deptName = usuario?.equipe?.includes(" (")
    ? usuario.equipe.split(" (")[0]
    : usuario?.equipe || "";
  const isAdmin = hasPermission(PERMISSIONS.ADMIN);
  const canManageTeam =
    isAdmin || hasPermission(PERMISSIONS.ACCESS_LOGISTICA_GESTOR);
  const canCreateUser = hasPermission(PERMISSIONS.ACCESS_LOGISTICA_GESTOR);

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showEditEquipeModal, setShowEditEquipeModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Usuario | null>(null);
  const [selectedEquipe, setSelectedEquipe] = useState<string>("");
  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<
    "ativos" | "inativos" | "todos"
  >("ativos");

  const [formData, setFormData] = useState({
    funcionarioId: "",
    senha: "",
    equipeId: "",
  });
  const [funcionarioSearch, setFuncionarioSearch] = useState("");
  const [showFuncionarioDropdown, setShowFuncionarioDropdown] = useState(false);

  const [modalDept, setModalDept] = useState("");
  const [modalRole, setModalRole] = useState("");
  const [editEquipeData, setEditEquipeData] = useState({ equipeId: "" });
  const [passwordData, setPasswordData] = useState({
    novaSenha: "",
    confirmarSenha: "",
  });
  const [transferMode, setTransferMode] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState<Record<number, boolean>>(
    {},
  );

  const getTeamStructure = () => {
    const structure: Record<
      string,
      { id: number; role: string; originalName: string }[]
    > = {};
    equipes.forEach((equipe) => {
      let dept = equipe.nome;
      let role = "Padrão";
      const match = equipe.nome.match(/^(.+?)\s*\((.+?)\)$/);
      if (match) {
        dept = match[1];
        role = match[2];
      } else {
        if (equipe.nome === "Administração") {
          role = "Total";
        } else {
          role = "Geral";
        }
      }
      if (!structure[dept]) {
        structure[dept] = [];
      }
      structure[dept].push({ id: equipe.id, role, originalName: equipe.nome });
    });
    return structure;
  };

  const teamStructure = useMemo(() => getTeamStructure(), [equipes]);
  const departments = Object.keys(teamStructure)
    .filter((d) => d !== "Prestserv")
    .sort();
  const rolesForSelectedDept =
    modalDept && teamStructure[modalDept]
      ? teamStructure[modalDept]
          .map((t) => t.role)
          .filter((r) => ["Editor", "Visualizador", "Gestor"].includes(r))
      : [];

  const fetchUsuarios = useCallback(async () => {
    try {
      const response = await fetch("/api/usuarios?limit=1000");
      const data = await response.json();
      if (data.success) {
        setUsuarios(data.usuarios);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin && deptName) {
      setModalDept(deptName);
    }
  }, [isAdmin, deptName, showModal]);

  useEffect(() => {
    if (showModal) {
      setModalRole("");
      setModalDept(isAdmin ? "" : deptName);
    }
  }, [showModal, isAdmin, deptName]);

  useEffect(() => {
    if (!modalDept || !modalRole) return;
    const deptTeams = teamStructure[modalDept];
    const team = deptTeams?.find((t) => t.role === modalRole);
    if (!team) return;
    const targetId = team.id.toString();
    if (showModal) {
      setFormData((prev) =>
        prev.equipeId === targetId ? prev : { ...prev, equipeId: targetId },
      );
    }
    if (showEditEquipeModal) {
      setEditEquipeData((prev) =>
        prev.equipeId === targetId ? prev : { ...prev, equipeId: targetId },
      );
    }
  }, [modalDept, modalRole, showModal, showEditEquipeModal, teamStructure]);

  useEffect(() => {
    if (showEditEquipeModal && selectedUser) {
      let dept = selectedUser.equipe.nome;
      let role = "Padrão";
      const match = selectedUser.equipe.nome.match(/^(.+?)\s*\((.+?)\)$/);
      if (match) {
        dept = match[1];
        role = match[2];
      } else {
        if (selectedUser.equipe.nome === "Administração") {
          role = "Total";
        } else {
          role = "Geral";
        }
      }
      setModalDept(isAdmin ? dept : deptName);
      setModalRole(role);
      setEditEquipeData({ equipeId: selectedUser.equipe.id.toString() });
    }
  }, [showEditEquipeModal, selectedUser, isAdmin, deptName]);

  const fetchEquipes = useCallback(async () => {
    try {
      const response = await fetch("/api/equipes");
      const data = await response.json();
      if (data.success) {
        const onlyDept =
          !isAdmin && deptName && deptName.length > 0
            ? data.equipes.filter((e: Equipe) => {
                const en = normalize(e.nome || "");
                const dn = normalize(deptName);
                return en.startsWith(dn);
              })
            : data.equipes;
        setEquipes(
          (onlyDept as Equipe[])
            .filter((e) => !e.nome.startsWith("Prestserv"))
            .filter((e) => (isAdmin ? true : !e.nome.includes("(Gestor)"))),
        );
      }
    } catch {}
  }, [deptName, isAdmin]);

  const fetchFuncionarios = useCallback(async () => {
    try {
      const response = await fetch("/api/funcionarios");
      const data = await response.json();
      if (Array.isArray(data)) {
        setFuncionarios(data as Funcionario[]);
      }
    } catch {}
  }, [usuarios]);

  useEffect(() => {
    fetchUsuarios();
    fetchEquipes();
    fetchFuncionarios();
  }, [fetchUsuarios, fetchEquipes, fetchFuncionarios]);

  const selectedFuncionario = formData.funcionarioId
    ? funcionarios.find((f) => f.id === parseInt(formData.funcionarioId))
    : undefined;
  const targetTeamName =
    modalDept && modalRole
      ? teamStructure[modalDept]?.find((t) => t.role === modalRole)
          ?.originalName || ""
      : "";

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const funcId = parseInt(formData.funcionarioId);
      const equipeIdNum = parseInt(formData.equipeId);
      const selectedFuncionario = funcionarios.find((f) => f.id === funcId);
      const existingUserId = selectedFuncionario?.usuario?.id;

      if (existingUserId) {
        // Transferir usuário existente para a equipe selecionada
        const response = await fetch(`/api/usuarios/${existingUserId}/equipe`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ equipeId: equipeIdNum }),
        });
        const data = await response.json();
        if (data.success) {
          setShowModal(false);
          setFormData({ funcionarioId: "", senha: "", equipeId: "" });
          setFuncionarioSearch("");
          setShowFuncionarioDropdown(false);
          setTransferMode(false);
          fetchUsuarios();
          fetchFuncionarios();
        } else {
          alert(data.error || "Falha ao mover usuário de equipe");
        }
      } else {
        // Criar novo usuário
        const response = await fetch("/api/usuarios", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            funcionarioId: funcId,
            senha: formData.senha,
            equipeId: equipeIdNum,
          }),
        });
        const data = await response.json();
        if (data.success) {
          setShowModal(false);
          setFormData({ funcionarioId: "", senha: "", equipeId: "" });
          setFuncionarioSearch("");
          setShowFuncionarioDropdown(false);
          fetchUsuarios();
          fetchFuncionarios();
        } else {
          alert(data.error || "Falha ao criar usuário");
        }
      }
    } catch {
      alert("Erro ao criar usuário");
    }
  };

  const handleEditEquipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    try {
      const response = await fetch(`/api/usuarios/${selectedUser.id}/equipe`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ equipeId: parseInt(editEquipeData.equipeId) }),
      });
      const data = await response.json();
      if (data.success) {
        setShowEditEquipeModal(false);
        setSelectedUser(null);
        setEditEquipeData({ equipeId: "" });
        fetchUsuarios();
      } else {
        alert(data.error || "Falha ao atualizar equipe");
      }
    } catch {
      alert("Erro ao atualizar equipe do usuário");
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.novaSenha !== passwordData.confirmarSenha) {
      alert("Senhas não coincidem");
      return;
    }
    try {
      const response = await fetch(
        `/api/usuarios/${selectedUser?.id}/resetar-senha`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ novaSenha: passwordData.novaSenha }),
        },
      );
      const data = await response.json();
      if (data.success) {
        setShowPasswordModal(false);
        setPasswordData({ novaSenha: "", confirmarSenha: "" });
        setSelectedUser(null);
        alert("Senha resetada com sucesso!");
      } else {
        alert(data.error || "Falha ao resetar senha");
      }
    } catch {
      alert("Erro ao resetar senha");
    }
  };

  const handleToggleActive = async (user: Usuario) => {
    setStatusUpdating((prev) => ({ ...prev, [user.id]: true }));
    try {
      const resp = await fetch(`/api/usuarios/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativo: !user.ativo }),
      });
      const data = await resp.json();
      if (data.success) {
        fetchUsuarios();
      } else {
        alert(data.error || "Falha ao atualizar status");
      }
    } catch {
      alert("Erro ao atualizar status do usuário");
    } finally {
      setStatusUpdating((prev) => ({ ...prev, [user.id]: false }));
    }
  };

  const filteredUsuarios = usuarios.filter((u) => {
    const matchSearch =
      u.nome.toLowerCase().includes(search.toLowerCase()) ||
      u.matricula.toLowerCase().includes(search.toLowerCase()) ||
      (u.emailSecundario || "").toLowerCase().includes(search.toLowerCase()) ||
      (u.email || "").toLowerCase().includes(search.toLowerCase());
    const matchEquipe =
      selectedEquipe === "" || u.equipe.id.toString() === selectedEquipe;
    // Visualização por setor: não-admin vê membros do próprio setor
    const matchDept =
      isAdmin ||
      (deptName
        ? normalize(u.equipe.nome).startsWith(normalize(deptName))
        : true);
    const matchStatus =
      selectedStatus === "todos"
        ? true
        : selectedStatus === "ativos"
          ? u.ativo
          : !u.ativo;
    return matchSearch && matchEquipe && matchDept && matchStatus;
  });

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Usuários da Logística
        </h1>
        <p className="text-gray-600">
          Gestão de usuários restrita ao setor de Logística
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-4 flex-1">
            <input
              type="text"
              placeholder="Buscar por nome, matrícula ou email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1"
            />
            <select
              value={selectedEquipe}
              onChange={(e) => setSelectedEquipe(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todas as equipes do setor</option>
              {equipes.map((equipe) => (
                <option key={equipe.id} value={equipe.id}>
                  {equipe.nome}
                </option>
              ))}
            </select>
            <select
              value={selectedStatus}
              onChange={(e) =>
                setSelectedStatus(
                  e.target.value as "ativos" | "inativos" | "todos",
                )
              }
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              title="Filtrar por status"
            >
              <option value="ativos">Ativos</option>
              <option value="inativos">Inativos</option>
              <option value="todos">Todos</option>
            </select>
          </div>
          {canCreateUser && (
            <button
              onClick={() => setShowModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <PlusIcon className="h-5 w-5" />
              Novo Usuário
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Funcionário
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Equipe
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Perfil
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Último Login
                </th>
                {canManageTeam && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsuarios.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {u.nome}
                      </div>
                      <div className="text-sm text-gray-500">{u.matricula}</div>
                      <div className="text-sm text-gray-500">
                        {u.email || "—"}
                      </div>
                      <div className="text-sm text-gray-500">
                        {u.emailSecundario || "—"}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {u.equipe.nome.split(" (")[0]}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      {u.equipe.nome.includes("(")
                        ? u.equipe.nome.split("(")[1].replace(")", "")
                        : u.equipe.nome === "Administração"
                          ? "Total"
                          : "Editor"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        u.ativo
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {u.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {u.ultimoLogin
                      ? new Date(u.ultimoLogin).toLocaleString("pt-BR")
                      : "Nunca"}
                  </td>
                  {canManageTeam && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedUser(u);
                            setEditEquipeData({
                              equipeId: u.equipe.id.toString(),
                            });
                            setShowEditEquipeModal(true);
                          }}
                          className="text-green-600 hover:text-green-900"
                          title="Editar equipe"
                        >
                          <PencilIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedUser(u);
                            setShowPasswordModal(true);
                          }}
                          className="text-blue-600 hover:text-blue-900"
                          title="Resetar senha"
                        >
                          <KeyIcon className="h-5 w-5" />
                        </button>
                        <div className="flex items-center gap-2">
                          {statusUpdating[u.id] && (
                            <ArrowPathIcon className="h-3 w-3 animate-spin text-gray-500" />
                          )}
                          <button
                            onClick={() => handleToggleActive(u)}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full ${
                              u.ativo ? "bg-green-500" : "bg-gray-300"
                            }`}
                            title={u.ativo ? "Desativar" : "Ativar"}
                            disabled={!!statusUpdating[u.id]}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                                u.ativo ? "translate-x-4" : "translate-x-1"
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {transferMode ? "Mover Usuário Existente" : "Criar Novo Usuário"}
            </h3>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="relative funcionario-dropdown">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Funcionário
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={funcionarioSearch}
                    onChange={(e) => {
                      setFuncionarioSearch(e.target.value);
                      setShowFuncionarioDropdown(true);
                      if (!e.target.value) {
                        setFormData({ ...formData, funcionarioId: "" });
                        setTransferMode(false);
                      }
                    }}
                    onFocus={() => setShowFuncionarioDropdown(true)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Digite o nome ou matrícula do funcionário..."
                    required={!formData.funcionarioId}
                  />
                  {showFuncionarioDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {funcionarios
                        .filter(
                          (funcionario) =>
                            funcionario.nome
                              .toLowerCase()
                              .includes(funcionarioSearch.toLowerCase()) ||
                            funcionario.matricula
                              .toLowerCase()
                              .includes(funcionarioSearch.toLowerCase()),
                        )
                        .slice(0, 50)
                        .map((funcionario) => (
                          <button
                            type="button"
                            key={funcionario.id}
                            onClick={() => {
                              setFormData({
                                ...formData,
                                funcionarioId: funcionario.id.toString(),
                              });
                              setFuncionarioSearch(
                                `${funcionario.nome} (${funcionario.matricula})`,
                              );
                              setShowFuncionarioDropdown(false);
                              setTransferMode(!!funcionario.usuario);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-gray-100"
                          >
                            <div className="font-medium">
                              {funcionario.nome}
                            </div>
                            <div className="text-xs text-gray-500">
                              {funcionario.matricula} • {funcionario.funcao}
                              {funcionario.usuario
                                ? ` • já possui usuário (${funcionario.usuario.equipe.nome})`
                                : ""}
                            </div>
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              {transferMode && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 text-sm text-yellow-800">
                  <div>
                    Origem:{" "}
                    <span className="font-semibold">
                      {selectedFuncionario?.usuario?.equipe?.nome || "—"}
                    </span>
                  </div>
                  <div>
                    Destino:{" "}
                    <span className="font-semibold">
                      {targetTeamName || "—"}
                    </span>
                  </div>
                </div>
              )}

              {!transferMode && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Senha inicial
                  </label>
                  <input
                    type="password"
                    value={formData.senha}
                    onChange={(e) =>
                      setFormData({ ...formData, senha: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Informe a senha inicial"
                    required={!transferMode}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Setor
                  </label>
                  <select
                    value={modalDept}
                    onChange={(e) => setModalDept(e.target.value)}
                    disabled={!isAdmin}
                    required
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg ${
                      isAdmin
                        ? "focus:outline-none focus:ring-2 focus:ring-blue-500"
                        : "bg-gray-100 cursor-not-allowed"
                    }`}
                  >
                    {!isAdmin ? (
                      <option value={modalDept}>{modalDept || "—"}</option>
                    ) : (
                      <>
                        <option value="">Selecione</option>
                        {departments.map((dept) => (
                          <option key={dept} value={dept}>
                            {dept}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Perfil
                  </label>
                  <select
                    value={modalRole}
                    onChange={(e) => setModalRole(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Selecione</option>
                    {rolesForSelectedDept.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setFormData({ funcionarioId: "", senha: "", equipeId: "" });
                    setFuncionarioSearch("");
                    setShowFuncionarioDropdown(false);
                    setModalRole("");
                    setTransferMode(false);
                  }}
                  className="px-4 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                  disabled={
                    !formData.funcionarioId ||
                    !formData.equipeId ||
                    (!transferMode && !formData.senha)
                  }
                >
                  {transferMode ? "Mover Usuário" : "Criar Usuário"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditEquipeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Editar equipe do usuário
            </h3>
            <form onSubmit={handleEditEquipe} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Setor
                  </label>
                  <select
                    value={modalDept}
                    onChange={(e) => setModalDept(e.target.value)}
                    disabled={!isAdmin}
                    required
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg ${
                      isAdmin
                        ? "focus:outline-none focus:ring-2 focus:ring-blue-500"
                        : "bg-gray-100 cursor-not-allowed"
                    }`}
                  >
                    {!isAdmin ? (
                      <option value={modalDept}>{modalDept || "—"}</option>
                    ) : (
                      <>
                        <option value="">Selecione</option>
                        {departments.map((dept) => (
                          <option key={dept} value={dept}>
                            {dept}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Perfil
                  </label>
                  <select
                    value={modalRole}
                    onChange={(e) => setModalRole(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Selecione</option>
                    {rolesForSelectedDept.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditEquipeModal(false);
                    setSelectedUser(null);
                    setEditEquipeData({ equipeId: "" });
                    setModalRole("");
                  }}
                  className="px-4 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700"
                  disabled={!editEquipeData.equipeId}
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Resetar senha do usuário
            </h3>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nova senha
                </label>
                <input
                  type="password"
                  value={passwordData.novaSenha}
                  onChange={(e) =>
                    setPasswordData((prev) => ({
                      ...prev,
                      novaSenha: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirmar senha
                </label>
                <input
                  type="password"
                  value={passwordData.confirmarSenha}
                  onChange={(e) =>
                    setPasswordData((prev) => ({
                      ...prev,
                      confirmarSenha: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordModal(false);
                    setPasswordData({ novaSenha: "", confirmarSenha: "" });
                    setSelectedUser(null);
                  }}
                  className="px-4 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                >
                  Resetar Senha
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
