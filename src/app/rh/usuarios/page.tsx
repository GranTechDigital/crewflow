"use client";

import { useState, useEffect, useCallback } from "react";
import { PlusIcon } from "@heroicons/react/24/outline";
import ProtectedRoute from "@/components/ProtectedRoute";
import { ROUTE_PROTECTION } from "@/lib/permissions";
import { useAuth } from "@/app/hooks/useAuth";

interface Funcionario {
  id: number;
  matricula: string;
  nome: string;
  email: string;
  funcao: string;
  departamento: string;
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

export default function UsuariosRHPage() {
  return (
    <ProtectedRoute
      requiredPermissions={ROUTE_PROTECTION.RH.requiredPermissions}
      requiredEquipe={ROUTE_PROTECTION.RH.requiredEquipe}
    >
      <UsuariosEquipeContent sectorLabel="RH" />
    </ProtectedRoute>
  );
}

function UsuariosEquipeContent({ sectorLabel }: { sectorLabel: string }) {
  const { usuario } = useAuth();
  const deptName = usuario?.equipe?.includes(" (")
    ? usuario.equipe.split(" (")[0]
    : usuario?.equipe || "";
  const isAdmin = usuario?.equipe === "Administração";
  const isGestorRH =
    usuario?.equipe?.includes("RH") && usuario?.equipe?.includes("(Gestor)");
  // Cadastro de novos membros: exclusivamente Gestor do setor
  const canCreateUser = isGestorRH;

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedEquipe, setSelectedEquipe] = useState<string>("");
  const [search, setSearch] = useState("");

  const [formData, setFormData] = useState({
    funcionarioId: "",
    senha: "",
    equipeId: "",
  });
  const [funcionarioSearch, setFuncionarioSearch] = useState("");
  const [showFuncionarioDropdown, setShowFuncionarioDropdown] = useState(false);

  const [modalDept, setModalDept] = useState("");
  const [modalRole, setModalRole] = useState("");

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

  const teamStructure = getTeamStructure();
  const departments = Object.keys(teamStructure)
    .filter((d) => d !== "Prestserv")
    .sort();
  const rolesForSelectedDept =
    modalDept && teamStructure[modalDept]
      ? teamStructure[modalDept]
          .map((t) => t.role)
          .filter((r) => ["Editor", "Visualizador", "Gestor"].includes(r))
          .filter((r) => (isAdmin ? true : r !== "Gestor"))
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

  const fetchEquipes = useCallback(async () => {
    try {
      const response = await fetch("/api/equipes");
      const data = await response.json();
      if (data.success) {
        const onlyDept =
          !isAdmin && deptName && deptName.length > 0
            ? data.equipes.filter((e: Equipe) =>
                (e.nome || "").startsWith(deptName),
              )
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
        const funcionariosSemUsuario = data.filter(
          (func: Funcionario) =>
            !usuarios.some((user) => user.funcionarioId === func.id),
        );
        setFuncionarios(funcionariosSemUsuario);
      }
    } catch {}
  }, [usuarios]);

  useEffect(() => {
    fetchUsuarios();
    fetchEquipes();
    fetchFuncionarios();
  }, [fetchUsuarios, fetchEquipes, fetchFuncionarios]);

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
    if (modalDept && modalRole) {
      const deptTeams = teamStructure[modalDept];
      const team = deptTeams?.find((t) => t.role === modalRole);
      if (team) {
        setFormData((prev) => ({ ...prev, equipeId: team.id.toString() }));
      }
    }
  }, [modalDept, modalRole, teamStructure]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch("/api/usuarios", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          funcionarioId: parseInt(formData.funcionarioId),
          senha: formData.senha,
          equipeId: parseInt(formData.equipeId),
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
    } catch {
      alert("Erro ao criar usuário");
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
    const matchDept =
      isAdmin || (deptName ? u.equipe.nome.startsWith(deptName) : true);
    return matchSearch && matchEquipe && matchDept;
  });

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Usuários do {sectorLabel}
        </h1>
        <p className="text-gray-600">
          Gestão de usuários restrita ao setor de {sectorLabel}
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
              Criar Novo Usuário
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
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-gray-100"
                          >
                            <div className="font-medium">
                              {funcionario.nome}
                            </div>
                            <div className="text-xs text-gray-500">
                              {funcionario.matricula} • {funcionario.funcao}
                            </div>
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              </div>

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
                  required
                />
              </div>

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
                    !formData.senha ||
                    !formData.equipeId
                  }
                >
                  Criar Usuário
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
