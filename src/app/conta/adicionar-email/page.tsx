'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdicionarEmailPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/account/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (res.ok) {
        router.push('/conta/trocar-senha')
      } else {
        const data = await res.json().catch(() => ({ error: 'Erro ao salvar e-mail' }))
        setError(data.error || 'Erro ao salvar e-mail')
      }
    } catch (err) {
      setError('Erro de conexão')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="p-[2px] rounded-2xl bg-gradient-to-br from-gray-200 via-white to-gray-100">
          <div className="rounded-2xl bg-white/80 backdrop-blur-sm shadow-xl p-8">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-semibold text-gray-900">Adicionar e-mail</h2>
              <p className="text-gray-600">Informe um e-mail alternativo para sua conta</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>
              )}
              <div className="relative">
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder=" "
                  disabled={loading}
                  className="peer w-full rounded-xl border border-gray-300 bg-white/85 px-4 pt-6 pb-2 text-gray-900 placeholder-transparent focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent"
                />
                <label htmlFor="email" className="absolute left-4 top-3 text-gray-500 transition-all duration-200 origin-left pointer-events-none peer-placeholder-shown:top-4 peer-placeholder-shown:text-gray-500 peer-focus:top-3 peer-focus:text-red-700 peer-placeholder-shown:scale-100 peer-focus:scale-90">
                  E-mail alternativo
                </label>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl text-white py-3 px-4 shadow-md shadow-black/10 hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 transition-transform duration-200 ease-out hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                style={{ backgroundImage: 'linear-gradient(to right, #8a0000, #c40000, #ff0000)' }}
              >
                {loading ? 'Salvando...' : 'Salvar e continuar'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
