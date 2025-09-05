'use client'

import { useAuth } from '@/app/hooks/useAuth'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import Sidebar from './Sidebar'
import Navbar from './Navbar'
import LoadingSpinner from '@/components/LoadingSpinner'

interface LayoutContentProps {
  children: React.ReactNode
}

export default function LayoutContent({ children }: LayoutContentProps) {
  const { usuario, loading } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  // Redirecionar usuários logados que tentem acessar /login
  useEffect(() => {
    if (!loading && usuario && pathname === '/login') {
      router.push('/');
    }
  }, [usuario, loading, pathname, router]);

  // Se estiver na página de login, mostrar apenas o conteúdo
  if (pathname === '/login') {
    return <div>{children}</div>
  }

  // Mostrar loading enquanto verifica autenticação
  if (loading) {
    return (
      <div className="h-screen flex flex-col overflow-hidden bg-gray-100">
        <div className="flex flex-1">
          <Sidebar />
          <div className="flex-1 flex flex-col">
            <Navbar />
            <main className="flex-1 bg-white border border-gray-300 rounded-xl shadow-xl m-4 relative z-10 overflow-auto custom-scrollbar flex items-center justify-center">
              <LoadingSpinner size="lg" />
            </main>
          </div>
        </div>
      </div>
    )
  }

  // Se não tiver usuário após o loading, redirecionar
  if (!usuario) {
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    return null;
  }

  // Layout completo com navbar
  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-100 min-h-0">
      <div className="flex flex-1 min-h-0 overflow-x-auto" style={{ minWidth: '1200px' }}>
        <div className="sidebar-container">
          <Sidebar key={usuario?.id || 'no-user'} />
        </div>
        <div className="flex-1 flex flex-col min-h-0 main-content">
          <Navbar />
          <main className="flex-1 bg-gray-50 border border-gray-300 rounded-xl shadow-xl m-4 relative z-10 overflow-auto custom-scrollbar flex flex-col min-h-0">
            <div className="p-2 flex-1 min-h-0 overflow-y-auto">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}