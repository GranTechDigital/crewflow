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
  login: (matricula: string, senha: string, rememberMe?: boolean) => Promise<boolean>
  logout: () => Promise<void>
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

      const response = await fetch('/api/auth/verify', {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      });

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

  const login = async (matricula: string, senha: string, rememberMe: boolean = false): Promise<boolean> => {
    try {
      setLoading(true);
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ matricula, senha, rememberMe }),
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

  const logout = async () => {
    try {
      setLoading(true);
      console.log("Cookies antes do logout:", document.cookie);
      
      // Solução direta: limpar o cookie no cliente
      document.cookie = "auth-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      
      // Também tentar a API de logout, mas não depender dela
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          credentials: "include",
        });
      } catch (e) {
        console.log("Erro na API de logout, mas continuando com logout local:", e);
      }

      console.log("Cookies após o logout:", document.cookie);
      
      // Limpar o estado local independente da resposta da API
      setUsuario(null);
      
      if (typeof window !== 'undefined') {
        localStorage.removeItem('user');
        localStorage.removeItem('auth-token');
        sessionStorage.clear();
      }

      // Redirecionar para a página de login (navegação completa)
      window.location.replace("/login");
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
      
      // Mesmo com erro, tentar limpar o estado e redirecionar
      setUsuario(null);
      window.location.replace("/login");
    } finally {
      setLoading(false);
    }
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