'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useRouter } from 'next/navigation'

export interface Usuario {
  id: number
  nome: string
  email: string
  equipe: string
  matricula: string
  permissoes: string[]
}

interface AuthContextType {
  usuario: Usuario | null
  loading: boolean
  login: (matricula: string, senha: string) => Promise<boolean>
  logout: () => void
  checkAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const checkAuth = async () => {
    try {
      setLoading(true);
      console.log('Checking auth...');

      const response = await fetch('/api/auth/verify');

      console.log('Auth response status:', response.status);
      if (response.ok) {
        const userData = await response.json();
        console.log('Auth verified, user:', userData);
        setUsuario(userData.user);
      } else {
        console.log('Auth failed, clearing user');
        setUsuario(null);
      }
    } catch (error) {
      console.error('Erro ao verificar autenticação:', error);
      setUsuario(null);
    } finally {
      setLoading(false);
    }
  }

  const login = async (matricula: string, senha: string): Promise<boolean> => {
    try {
      setLoading(true);
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ matricula, senha }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Login successful, setting user:', data.user);
        setUsuario(data.user);
        
        // Forçar revalidação do estado
        await checkAuth();
        
        // Usar window.location para forçar navegação completa
        window.location.href = '/';
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error('Erro no login:', error);
      return false;
    } finally {
      setLoading(false);
    }
  }

  const logout = () => {
    setUsuario(null);
    fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  useEffect(() => {
    checkAuth()
  }, [])

  const value = {
    usuario,
    loading,
    login,
    logout,
    checkAuth
  }

  return (
  <AuthContext.Provider value={value}>
    {children}
  </AuthContext.Provider>
)
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider')
  }
  return context
}

export function usePermissions() {
  const { usuario } = useAuth()
  
  const hasPermission = (permission: string): boolean => {
    if (!usuario || !usuario.permissoes) return false
    return usuario.permissoes.includes(permission) || usuario.permissoes.includes('admin')
  }

  const hasAnyPermission = (permissions: string[]): boolean => {
    return permissions.some(permission => hasPermission(permission))
  }

  return {
    hasPermission,
    hasAnyPermission,
    permissions: usuario?.permissoes || []
  }
}