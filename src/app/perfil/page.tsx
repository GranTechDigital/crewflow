'use client'

import { useState, useEffect } from 'react'
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
  const [emailPrincipal, setEmailPrincipal] = useState('')
  const [emailAlternativo, setEmailAlternativo] = useState('')
  const [savingEmail, setSavingEmail] = useState(false)
  const [obrigarAdicionarEmail, setObrigarAdicionarEmail] = useState(false)
  const [tab, setTab] = useState<'dados' | 'senha'>('dados')

  useEffect(() => {
    const load = async () => {
      if (!usuario?.id) return
      try {
        const res = await fetch(`/api/usuarios/${usuario.id}`)
        if (res.ok) {
          const data = await res.json()
          setEmailPrincipal(data.usuario?.email || '')
          setEmailAlternativo(data.usuario?.emailSecundario || '')
          setObrigarAdicionarEmail(!!data.usuario?.obrigarAdicionarEmail)
        }
      } catch {}
    }
    load()
  }, [usuario?.id])

  const handleAlterarSenha = async (e: React.FormEvent) => {
    e.preventDefault()

    if (novaSenha !== confirmarSenha) {
      showToast('As senhas não coincidem', 'error')
      return
    }

    if (!(novaSenha.length >= 8 && /[A-Z]/.test(novaSenha) && /[a-z]/.test(novaSenha) && /\d/.test(novaSenha))) {
      showToast('A nova senha deve ter 8+ caracteres, com maiúsculas, minúsculas e números', 'error')
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
    <div className="max-w-4xl mx-auto p-6 relative">
      {(savingEmail || loading) && (
        <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center z-20">
          <div className="bg-white rounded-xl px-5 py-3 shadow-md flex items-center gap-3">
            <div className="h-4 w-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-800">
              {savingEmail ? 'Salvando e-mails...' : 'Alterando senha...'}
            </span>
          </div>
        </div>
      )}
      <div className="bg-white rounded-lg shadow-md relative">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <User className="text-red-700" />
            Meu Perfil
          </h1>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTab('dados')}
              className={`px-4 py-2 rounded-md text-sm font-medium ${tab==='dados' ? 'text-white' : 'text-gray-700'} shadow-md shadow-black/10 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 transition ${tab==='dados' ? '' : 'hover:opacity-90'}`}
              style={{ backgroundImage: tab==='dados' ? 'linear-gradient(to right, #8a0000, #c40000, #ff0000)' : undefined, backgroundColor: tab==='dados' ? undefined : '#f3f4f6' }}
            >
              Informações Pessoais
            </button>
            <button
              type="button"
              onClick={() => setTab('senha')}
              className={`px-4 py-2 rounded-md text-sm font-medium ${tab==='senha' ? 'text-white' : 'text-gray-700'} shadow-md shadow-black/10 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 transition ${tab==='senha' ? '' : 'hover:opacity-90'}`}
              style={{ backgroundImage: tab==='senha' ? 'linear-gradient(to right, #8a0000, #c40000, #ff0000)' : undefined, backgroundColor: tab==='senha' ? undefined : '#f3f4f6' }}
            >
              Alterar Senha
            </button>
          </div>
        </div>

        <div className="p-6">
          {tab === 'dados' ? (
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

                {/* E-mail principal oculto conforme diretriz – manter apenas alternativo */}

                <div className={savingEmail ? 'opacity-70 pointer-events-none' : ''}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    E-mail alternativo
                  </label>
                  <input
                    type="email"
                    value={emailAlternativo}
                    onChange={(e) => setEmailAlternativo(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                  />
                </div>

                <button
                  type="button"
                  disabled={savingEmail}
                  onClick={async () => {
                    try {
                      if (obrigarAdicionarEmail && !emailAlternativo) {
                        showToast('Informe o e-mail alternativo obrigatório', 'error')
                        return
                      }
                      setSavingEmail(true)
                      const res = await fetch(`/api/usuarios/${usuario?.id}/email`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ emailAlternativo })
                      })
                      if (res.ok) {
                        showToast('E-mails atualizados com sucesso!', 'success')
                      } else {
                        const d = await res.json().catch(() => ({ error: 'Erro ao salvar e-mails' }))
                        showToast(d.error || 'Erro ao salvar e-mails', 'error')
                      }
                    } catch {
                      showToast('Erro interno ao salvar e-mails', 'error')
                    } finally {
                      setSavingEmail(false)
                    }
                  }}
                  className="mt-2 w-full text-white py-2 px-4 rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md shadow-black/10 hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 transition-transform duration-200 ease-out hover:scale-[1.02] active:scale-[0.98]"
                  style={{ backgroundImage: 'linear-gradient(to right, #8a0000, #c40000, #ff0000)' }}
                >
                  {savingEmail ? 'Salvando...' : 'Salvar e-mails'}
                </button>

                <div className="mt-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    Minhas Permissões
                  </h2>
                  <div className="space-y-2">
                    {usuario.permissoes?.map((permissao, index) => {
                      const clean = permissao.replace(/^canAcc?ess/i, '')
                      const spaced = clean
                        .replace(/_/g, ' ')
                        .replace(/-+/g, ' ')
                        .replace(/([a-z])([A-Z])/g, '$1 $2')
                        .trim()
                      const label = spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : 'Acesso'
                      return (
                        <span
                          key={index}
                          className="inline-block bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full mr-2 mb-2"
                        >
                          {label}
                        </span>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>

          ) : (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Lock className="text-red-700" />
                Alterar Senha
              </h2>

              <form onSubmit={handleAlterarSenha} className="space-y-4">
                <div className={loading ? 'opacity-70 pointer-events-none' : ''}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Senha Atual
                  </label>
                  <input
                    type="password"
                    value={senhaAtual}
                    onChange={(e) => setSenhaAtual(e.target.value)}
                    required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>

                <div className={loading ? 'opacity-70 pointer-events-none' : ''}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nova Senha
                  </label>
                  <input
                    type="password"
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    required
                    minLength={8}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                  />
                  <p className="text-xs text-gray-600 mt-1">
                    Mínimo de 8 caracteres, com maiúsculas, minúsculas e números
                  </p>
                </div>

                <div className={loading ? 'opacity-70 pointer-events-none' : ''}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Confirmar Nova Senha
                  </label>
                  <input
                    type="password"
                    value={confirmarSenha}
                    onChange={(e) => setConfirmarSenha(e.target.value)}
                    required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>

                <button
                  type="submit"
                  disabled={loading}
                className="w-full text-white py-2 px-4 rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md shadow-black/10 hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 transition-transform duration-200 ease-out hover:scale-[1.02] active:scale-[0.98]"
                style={{ backgroundImage: 'linear-gradient(to right, #8a0000, #c40000, #ff0000)' }}
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
          )}
        </div>
      </div>
    </div>
  )
}
