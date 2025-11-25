'use client'; 

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/app/hooks/useAuth';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function LoginPage() {
  const [matricula, setMatricula] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [logoError, setLogoError] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [spinLogo, setSpinLogo] = useState(false);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const prefersReduced = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;
    let raf = 0;
    let t = 0;
    const animate = () => {
      t += 1;
      const el = overlayRef.current;
      if (el) {
        const x = Math.sin(t / 400) * 6;
        const y = Math.cos(t / 480) * 4;
        el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      }
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  const { login, usuario, loading: authLoading } = useAuth();
  const router = useRouter();

  // Redirecionar se o usuário já está logado
  useEffect(() => {
    if (!authLoading && usuario) {
      router.push('/');
    }
  }, [usuario, authLoading, router]);

  // Mostrar loading enquanto verifica autenticação
  if (authLoading) {
    return (
      <div className="relative min-h-screen flex items-center justify-center p-6 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
            <defs>
              <pattern id="hex-bg" width="2" height="1.732" patternUnits="userSpaceOnUse">
                <g opacity="0.15">
                  <line x1="1" y1="0" x2="2" y2="0.577" stroke="#ffffff" strokeWidth="0.2" />
                  <line x1="0" y1="0.577" x2="1" y2="0" stroke="#ffffff" strokeWidth="0.2" />
                  <line x1="2" y1="0.577" x2="2" y2="1.155" stroke="#dbd1d1" strokeWidth="0.2" />
                  <line x1="2" y1="1.155" x2="1" y2="1.732" stroke="#d1d5db" strokeWidth="0.2" />
                  <line x1="0" y1="1.155" x2="0" y2="0.577" stroke="#d1d5db" strokeWidth="0.2" />
                  <line x1="1" y1="1.732" x2="0" y2="1.155" stroke="#d1d5db" strokeWidth="0.2" />
                </g>
              </pattern>
            </defs>
            <rect x="0" y="0" width="100" height="100" fill="url(#hex-bg)" />
          </svg>
        </div>
        <div id="login-content" className="relative z-10 max-w-md w-full">
          <div className="p-[2px] rounded-2xl bg-gradient-to-br from-gray-200 via-white to-gray-100">
            <div className="rounded-2xl bg-white/80 backdrop-blur-sm shadow-xl p-8">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
                <p className="text-gray-700">Verificando autenticação...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Se já está logado, não mostrar o formulário
  if (usuario) {
    return null;
  }

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
    <div className="relative min-h-screen flex items-center justify-center p-6 overflow-hidden">
      <div ref={overlayRef} className="absolute inset-0 pointer-events-none">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
          <defs>
            <pattern id="hex-bg" width="2" height="1.732" patternUnits="userSpaceOnUse">
              <g opacity="0.15">
                <line x1="1" y1="0" x2="2" y2="0.577" stroke="#ffffff" strokeWidth="0.2" />
                <line x1="0" y1="0.577" x2="1" y2="0" stroke="#ffffff" strokeWidth="0.2" />
                <line x1="2" y1="0.577" x2="2" y2="1.155" stroke="#d1d5db" strokeWidth="0.2" />
                <line x1="2" y1="1.155" x2="1" y2="1.732" stroke="#d1d5db" strokeWidth="0.2" />
                <line x1="0" y1="1.155" x2="0" y2="0.577" stroke="#d1d5db" strokeWidth="0.2" />
                <line x1="1" y1="1.732" x2="0" y2="1.155" stroke="#d1d5db" strokeWidth="0.2" />
              </g>
            </pattern>
          </defs>
          <rect x="0" y="0" width="100" height="100" fill="url(#hex-bg)" />
        </svg>
      </div>
      <div id="login-content" className="relative z-10 max-w-md w-full space-y-6">
        <style>{`@keyframes spinOnce{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
        <div className="relative group p-[2px] rounded-2xl bg-gradient-to-br from-gray-200 via-white to-gray-100 transition-all duration-500 ease-out">
          <div className="rounded-2xl bg-white/80 backdrop-blur-sm shadow-2xl p-8 transition-all duration-500 ease-out hover:scale-[1.008] hover:shadow-xl focus-within:shadow-xl ring-0 group-focus-within:ring-1 group-focus-within:ring-red-600/25 group-focus-within:ring-offset-2 group-focus-within:ring-offset-white/60" onMouseEnter={() => setSpinLogo(true)}>
            <div className="text-center mb-6">
              {!logoError ? (
                <div className="mx-auto h-10 w-10" style={spinLogo ? { animation: 'spinOnce 600ms ease-out' } : undefined} onAnimationEnd={() => setSpinLogo(false)}>
                  <Image
                    src="/favicon.ico"
                    alt="CrewControl"
                    width={40}
                    height={40}
                    className="h-10 w-10"
                    onError={() => setLogoError(true)}
                    priority
                  />
                </div>
              ) : (
                <div className="text-3xl font-bold tracking-tight text-gray-900">CrewControl</div>
              )}
              <h2 className="mt-3 text-2xl font-semibold text-gray-900">Bem-vindo</h2>
              <p className="text-gray-600">Acesse o CrewControl</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}
              <div className="space-y-4">
                <div className="relative">
                  <input
                    id="matricula"
                    name="matricula"
                    type="text"
                    required
                    value={matricula}
                    onChange={(e) => setMatricula(e.target.value)}
                    placeholder=" "
                    disabled={loading}
                    className="peer w-full rounded-xl border border-gray-300 bg-white/85 px-4 pt-6 pb-2 text-gray-900 placeholder-transparent focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent"
                  />
                  <label htmlFor="matricula" className="absolute left-4 top-3 text-gray-500 transition-all duration-200 origin-left pointer-events-none peer-placeholder-shown:top-4 peer-placeholder-shown:text-gray-500 peer-focus:top-3 peer-focus:text-red-700 peer-placeholder-shown:scale-100 peer-focus:scale-90">
                    Matrícula ou e-mail
                  </label>
                </div>

                <div className="relative">
                  <input
                    id="senha"
                    name="senha"
                    type={showPwd ? 'text' : 'password'}
                    required
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder=" "
                    disabled={loading}
                    className="peer w-full rounded-xl border border-gray-300 bg-white/85 px-4 pt-6 pb-2 text-gray-900 placeholder-transparent focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent"
                  />
                  <label htmlFor="senha" className="absolute left-4 top-3 text-gray-500 transition-all duration-200 origin-left pointer-events-none peer-placeholder-shown:top-4 peer-placeholder-shown:text-gray-500 peer-focus:top-3 peer-focus:text-red-700 peer-placeholder-shown:scale-100 peer-focus:scale-90">
                    Senha
                  </label>
                  <button type="button" onClick={() => setShowPwd((v) => !v)} disabled={loading} className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-red-700 hover:text-red-800">
                    {showPwd ? 'Ocultar' : 'Mostrar'}
                  </button>
          </div>
        </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl text-white py-3 px-4 shadow-md shadow-black/10 hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 transition-transform duration-200 ease-out hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                style={{ backgroundImage: 'linear-gradient(to right, #8a0000, #c40000, #ff0000)' }}
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

            <div className="mt-6 text-center">
              <p className="text-sm 4*.text-gray-600">Problemas para acessar?</p>
              <p className="text-sm text-gray-500 mt-1">Entre em contato com o administrador do sistema</p>
            </div>
          </div>
          
        </div>

        <div className="text-center text-xs text-gray-500">
          <p>© 2025 GranServices. Todos os direitos reservados.</p>
        </div>
      </div>
    </div>
  );
}