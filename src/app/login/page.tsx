'use client';

import { useState } from 'react';
import { useAuth } from '@/app/hooks/useAuth';
import Image from 'next/image';

export default function LoginPage() {
  const [matricula, setMatricula] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevenir múltiplos submits
    if (loading) return;
    
    setLoading(true);
    setError('');

    try {
      const success = await login(matricula, senha);
      
      if (!success) {
        setError('Credenciais inválidas. Verifique sua matrícula e senha.');
        setLoading(false); // Resetar loading apenas em caso de erro
      }
      // Se success for true, o loading será resetado pelo hook useAuth
    } catch (error) {
      console.error('Erro no login:', error);
      setError('Erro de conexão. Tente novamente.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="mx-auto h-16 w-auto mb-4">
              <Image
                src="/graservices-360x63-1.png"
                alt="Gran Services"
                width={200}
                height={35}
                className="mx-auto"
              />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Gran System
            </h2>
            <p className="text-gray-600">
              Sistema de Gestão Integrada
            </p>
          </div>

          {/* Formulário */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="matricula" className="block text-sm font-medium text-gray-700 mb-2">
                Matrícula
              </label>
              <input
                id="matricula"
                name="matricula"
                type="text"
                required
                value={matricula}
                onChange={(e) => setMatricula(e.target.value)}
                className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                placeholder="Digite sua matrícula"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="senha" className="block text-sm font-medium text-gray-700 mb-2">
                Senha
              </label>
              <input
                id="senha"
                name="senha"
                type="password"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                placeholder="Digite sua senha"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Entrando...
                </div>
              ) : (
                'Entrar'
              )}
            </button>
          </form>

          {/* Informações adicionais */}
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-600">
              Problemas para acessar?
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Entre em contato com o administrador do sistema
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500">
          <p>© 2024 Gran Services. Todos os direitos reservados.</p>
        </div>
      </div>
    </div>
  );
}