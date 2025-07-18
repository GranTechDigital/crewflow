'use client'

import { useState } from 'react'
import { useAuth } from '@/app/hooks/useAuth'
import { User, Lock, Save } from 'lucide-react'
import { useToast } from '@/components/Toast'

export default function PerfilPage() {
  const { usuario } = useAuth()
  const { showToast } = useToast()
  const [senhaAtual, setSenhaAtual] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [loading, setLoading] = useState(false)

  const handleAlterarSenha = async (e: React.FormEvent) => {
    e.preventDefault()

    if (novaSenha !== confirmarSenha) {
      showToast('As senhas não coincidem', 'error')
      return
    }

    if (novaSenha.length < 6) {
      showToast('A nova senha deve ter pelo menos 6 caracteres', 'error')
      return
    }

    setLoading(true)

    try {
      const response = await fetch(`/api/usuarios/${usuario?.id}/alterar-senha`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          senhaAtual,
          novaSenha,
        }),
      })

      if (response.ok) {
        showToast('Senha alterada com sucesso!', 'success')
        setSenhaAtual('')
        setNovaSenha('')
        setConfirmarSenha('')
      } else {
        const data = await response.json()
        showToast(data.error || 'Erro ao alterar senha', 'error')
      }
    } catch (error) {
      console.error('Erro ao alterar senha:', error)
      showToast('Erro interno do servidor', 'error')
    } finally {
      setLoading(false)
    }
  }

  if (!usuario) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Carregando...</div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-md">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <User className="text-blue-600" />
            Meu Perfil
          </h1>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Informações do Usuário */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Informações Pessoais
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome Completo
                  </label>
                  <input
                    type="text"
                    value={usuario.nome}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                  />
                </div>

                <div className="mt-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    Minhas Permissões
                  </h2>
                  <div className="space-y-2">
                    {usuario.permissoes?.map((permissao, index) => (
                      <span
                        key={index}
                        className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full mr-2 mb-2"
                      >
                        {permissao}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Alterar Senha */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Lock className="text-blue-600" />
                Alterar Senha
              </h2>

              <form onSubmit={handleAlterarSenha} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Senha Atual
                  </label>
                  <input
                    type="password"
                    value={senhaAtual}
                    onChange={(e) => setSenhaAtual(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nova Senha
                  </label>
                  <input
                    type="password"
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    required
                    minLength={6}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Mínimo de 6 caracteres
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Confirmar Nova Senha
                  </label>
                  <input
                    type="password"
                    value={confirmarSenha}
                    onChange={(e) => setConfirmarSenha(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <Save size={16} />
                  )}
                  {loading ? 'Alterando...' : 'Alterar Senha'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}