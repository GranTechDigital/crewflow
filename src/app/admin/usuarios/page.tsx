'use client';

import { useState, useEffect } from 'react';
import { PlusIcon, PencilIcon, TrashIcon, KeyIcon } from '@heroicons/react/24/outline';
import ProtectedRoute from '@/components/ProtectedRoute';
import { ROUTE_PROTECTION } from '@/lib/permissions';

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
  email: string;
  funcao: string;
  departamento: string;
  equipe: Equipe;
  ativo: boolean;
  ultimoLogin: string;
  createdAt: string;
  updatedAt: string;
}

export default function UsuariosAdminPage() {
  return (
    <ProtectedRoute 
      requiredPermissions={ROUTE_PROTECTION.ADMIN.requiredPermissions}
      requiredEquipe={ROUTE_PROTECTION.ADMIN.requiredEquipe}
    >
      <UsuariosAdminContent />
    </ProtectedRoute>
  );
}

function UsuariosAdminContent() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Usuario | null>(null);
  const [search, setSearch] = useState('');
  const [selectedEquipe, setSelectedEquipe] = useState('');
  const [formData, setFormData] = useState({
    funcionarioId: '',
    senha: '',
    equipeId: ''
  });
  const [passwordData, setPasswordData] = useState({
    novaSenha: '',
    confirmarSenha: ''
  });

  useEffect(() => {
    fetchUsuarios();
    fetchEquipes();
    fetchFuncionarios();
  }, []);

  const fetchUsuarios = async () => {
    try {
      const response = await fetch('/api/usuarios');
      const data = await response.json();
      if (data.success) {
        setUsuarios(data.usuarios);
      }
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEquipes = async () => {
    try {
      const response = await fetch('/api/equipes');
      const data = await response.json();
      if (data.success) {
        setEquipes(data.equipes);
      }
    } catch (error) {
      console.error('Erro ao buscar equipes:', error);
    }
  };

  const fetchFuncionarios = async () => {
    try {
      const response = await fetch('/api/funcionarios');
      const data = await response.json();
      
      // A API retorna os dados diretamente, não em um objeto com 'success'
      if (Array.isArray(data)) {
        // Filtrar apenas funcionários que não possuem usuário
        const funcionariosSemUsuario = data.filter(
          (func: Funcionario) => !usuarios.some(user => user.funcionarioId === func.id)
        );
        setFuncionarios(funcionariosSemUsuario);
      } else {
        console.error('Formato de resposta inesperado:', data);
      }
    } catch (error) {
      console.error('Erro ao buscar funcionários:', error);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/usuarios', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          funcionarioId: parseInt(formData.funcionarioId),
          senha: formData.senha,
          equipeId: parseInt(formData.equipeId)
        }),
      });

      const data = await response.json();
      if (data.success) {
        setShowModal(false);
        setFormData({ funcionarioId: '', senha: '', equipeId: '' });
        fetchUsuarios();
        fetchFuncionarios();
      } else {
        alert(data.error);
      }
    } catch (error) {
      console.error('Erro ao criar usuário:', error);
      alert('Erro ao criar usuário');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.novaSenha !== passwordData.confirmarSenha) {
      alert('Senhas não coincidem');
      return;
    }

    try {
      const response = await fetch(`/api/usuarios/${selectedUser?.id}/resetar-senha`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ novaSenha: passwordData.novaSenha }),
      });

      const data = await response.json();
      if (data.success) {
        setShowPasswordModal(false);
        setPasswordData({ novaSenha: '', confirmarSenha: '' });
        setSelectedUser(null);
        alert('Senha resetada com sucesso!');
      } else {
        alert(data.error);
      }
    } catch (error) {
      console.error('Erro ao resetar senha:', error);
      alert('Erro ao resetar senha');
    }
  };

  const toggleUserStatus = async (userId: number, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/usuarios/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ativo: !currentStatus }),
      });

      const data = await response.json();
      if (data.success) {
        fetchUsuarios();
      } else {
        alert(data.error);
      }
    } catch (error) {
      console.error('Erro ao alterar status:', error);
      alert('Erro ao alterar status do usuário');
    }
  };

  const filteredUsuarios = usuarios.filter(usuario => {
    const matchSearch = usuario.nome.toLowerCase().includes(search.toLowerCase()) ||
                       usuario.matricula.toLowerCase().includes(search.toLowerCase()) ||
                       usuario.email?.toLowerCase().includes(search.toLowerCase());
    const matchEquipe = selectedEquipe === '' || usuario.equipe.id.toString() === selectedEquipe;
    return matchSearch && matchEquipe;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Administração de Usuários</h1>
        <p className="text-gray-600">Gerencie usuários e permissões do sistema</p>
      </div>

      {/* Filtros e Ações */}
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
              <option value="">Todas as equipes</option>
              {equipes.map(equipe => (
                <option key={equipe.id} value={equipe.id}>{equipe.nome}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <PlusIcon className="h-5 w-5" />
            Novo Usuário
          </button>
        </div>
      </div>

      {/* Tabela de Usuários */}
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
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Último Login
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsuarios.map((usuario) => (
                <tr key={usuario.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{usuario.nome}</div>
                      <div className="text-sm text-gray-500">{usuario.matricula}</div>
                      <div className="text-sm text-gray-500">{usuario.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {usuario.equipe.nome}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      usuario.ativo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {usuario.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {usuario.ultimoLogin ? new Date(usuario.ultimoLogin).toLocaleString('pt-BR') : 'Nunca'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedUser(usuario);
                          setShowPasswordModal(true);
                        }}
                        className="text-blue-600 hover:text-blue-900"
                        title="Resetar senha"
                      >
                        <KeyIcon className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => toggleUserStatus(usuario.id, usuario.ativo)}
                        className={`${usuario.ativo ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'}`}
                        title={usuario.ativo ? 'Desativar' : 'Ativar'}
                      >
                        {usuario.ativo ? 'Desativar' : 'Ativar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Novo Usuário */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Criar Novo Usuário</h3>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Funcionário
                </label>
                <select
                  value={formData.funcionarioId}
                  onChange={(e) => setFormData({...formData, funcionarioId: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Selecione um funcionário</option>
                  {funcionarios.map(funcionario => (
                    <option key={funcionario.id} value={funcionario.id}>
                      {funcionario.nome} - {funcionario.matricula}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Senha
                </label>
                <input
                  type="password"
                  value={formData.senha}
                  onChange={(e) => setFormData({...formData, senha: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                  minLength={6}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Equipe
                </label>
                <select
                  value={formData.equipeId}
                  onChange={(e) => setFormData({...formData, equipeId: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Selecione uma equipe</option>
                  {equipes.map(equipe => (
                    <option key={equipe.id} value={equipe.id}>{equipe.nome}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Criar Usuário
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Resetar Senha */}
      {showPasswordModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Resetar Senha - {selectedUser.nome}
            </h3>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nova Senha
                </label>
                <input
                  type="password"
                  value={passwordData.novaSenha}
                  onChange={(e) => setPasswordData({...passwordData, novaSenha: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                  minLength={6}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirmar Nova Senha
                </label>
                <input
                  type="password"
                  value={passwordData.confirmarSenha}
                  onChange={(e) => setPasswordData({...passwordData, confirmarSenha: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                  minLength={6}
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordModal(false);
                    setSelectedUser(null);
                    setPasswordData({ novaSenha: '', confirmarSenha: '' });
                  }}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
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