'use client'

import { useEffect, useState } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { usePermissions } from '@/app/hooks/useAuth'
import { PERMISSIONS, ROUTE_PROTECTION } from '@/lib/permissions'

type Funcionario = {
  id: number
  matricula: string | null
  cpf: string | null
  nome: string
  funcao: string | null
  rg: string | null
  orgaoEmissor: string | null
  uf: string | null
  dataNascimento: string | null
  email: string | null
  telefone: string | null
  centroCusto: string | null
  departamento: string | null
  status: string | null
  criadoEm: string | null
  atualizadoEm: string | null
  excluidoEm: string | null
}

function PlanejamentoGeralContent() {
  const [dados, setDados] = useState<Funcionario[]>([])
  const [loading, setLoading] = useState(false)

  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [syncLoading, setSyncLoading] = useState(false)

  const [sortColumn, setSortColumn] = useState<keyof Funcionario | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const { hasPermission } = usePermissions()
  const isEditor = hasPermission(PERMISSIONS.ACCESS_PLANEJAMENTO)

  const fetchDados = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/dados')
      if (!res.ok) throw new Error('Erro ao carregar dados')
      const data = await res.json()
      setDados(data)
    } catch (error) {
      alert('Erro ao carregar dados')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDados()
  }, [])

  const handleImport = async () => {
    if (!isEditor) return
    setLoading(true)
    try {
      const res = await fetch('/api/dados/import', { method: 'POST' })
      if (!res.ok) throw new Error('Erro ao importar dados')
      alert('Dados importados com sucesso!')
      await fetchDados()
    } catch (error) {
      alert('Erro ao importar dados')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Tem certeza que deseja excluir todos os dados?')) return
    if (!isEditor) return
    setLoading(true)
    try {
      const res = await fetch('/api/dados/delete', { method: 'DELETE' })
      if (!res.ok) throw new Error('Erro ao excluir dados')
      alert('Dados excluídos com sucesso!')
      setDados([])
    } catch (error) {
      alert('Erro ao excluir dados')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleSincronizar = async () => {
    if (!isEditor) return
    setSyncLoading(true)
    setSyncMsg(null)
    setSyncError(null)

    const { syncWithRetry, formatSyncMessage } = await import('@/utils/syncUtils')

    const result = await syncWithRetry({
      maxRetries: 3,
      retryDelay: 2000,
      timeout: 60000,
      onProgress: (message) => {
        setSyncMsg(message)
      }
    })

    if (result.success) {
      setSyncMsg(formatSyncMessage(result.data))
      await fetchDados()
    } else {
      setSyncError(result.error || 'Erro na sincronização após todas as tentativas')
    }

    setSyncLoading(false)
  }

  const handleSort = (column: keyof Funcionario) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  const sortedData = [...dados].sort((a, b) => {
    if (!sortColumn) return 0
    const aValue = a[sortColumn]
    const bValue = b[sortColumn]

    if (aValue === null) return 1
    if (bValue === null) return -1

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortDirection === 'asc'
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue)
    }

    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue
    }

    return 0
  })

  const totalPages = Math.ceil(dados.length / itemsPerPage)
  const paginatedData = sortedData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const renderHeader = (label: string, column: keyof Funcionario) => (
    <th
      onClick={() => handleSort(column)}
      className="border px-2 py-1 cursor-pointer hover:bg-gray-200 select-none"
    >
      {label} {sortColumn === column && (sortDirection === 'asc' ? '↑' : '↓')}
    </th>
  )

  return (
    <div className="p-4 max-w-full">
      <h1 className="text-2xl font-bold mb-4">Planejamento Geral</h1>

      <div className="mb-4 flex flex-wrap gap-2 items-center">
        {isEditor && (
          <>
            <button
              onClick={handleImport}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
            >
              Importar Dados
            </button>
            <button
              onClick={handleDelete}
              disabled={loading}
              className="px-4 py-2 bg-red-600 text-white rounded disabled:opacity-50"
            >
              Excluir Todos
            </button>
            <button
              onClick={handleSincronizar}
              disabled={syncLoading}
              className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50"
            >
              {syncLoading ? 'Sincronizando...' : 'Sincronizar Funcionários'}
            </button>
          </>
        )}

        <div className="ml-auto">
          <label className="mr-2">Linhas por página:</label>
          <select
            className="border rounded px-2 py-1"
            value={itemsPerPage}
            onChange={(e) => {
              setItemsPerPage(Number(e.target.value))
              setCurrentPage(1)
            }}
          >
            {[10, 25, 50, 100].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
      </div>

      {syncMsg && <p className="text-green-600 mb-4">{syncMsg}</p>}
      {syncError && <p className="text-red-600 mb-4">{syncError}</p>}

      {loading ? (
        <div className="flex justify-center items-center space-x-2">
          <div className="w-6 h-6 border-4 border-blue-600 border-dashed rounded-full animate-spin"></div>
          <span>Carregando...</span>
        </div>
      ) : dados.length === 0 ? (
        <p>Nenhum dado disponível.</p>
      ) : (
        <div className="overflow-x-auto max-w-full border rounded shadow-sm">
          <table className="min-w-[1300px] w-full border-collapse border border-gray-300 text-sm">
            <thead className="bg-gray-100">
              <tr>
                {renderHeader('Matrícula', 'matricula')}
                {renderHeader('CPF', 'cpf')}
                {renderHeader('Nome', 'nome')}
                {renderHeader('Função', 'funcao')}
                {renderHeader('RG', 'rg')}
                {renderHeader('Orgão Emissor', 'orgaoEmissor')}
                {renderHeader('UF', 'uf')}
                {renderHeader('Data Nasc.', 'dataNascimento')}
                {renderHeader('Email', 'email')}
                {renderHeader('Telefone', 'telefone')}
                {renderHeader('Centro Custo', 'centroCusto')}
                {renderHeader('Departamento', 'departamento')}
                {renderHeader('Status', 'status')}
                {renderHeader('Criado em', 'criadoEm')}
                {renderHeader('Atualizado em', 'atualizadoEm')}
                {renderHeader('Excluído em', 'excluidoEm')}
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="border px-2 py-1">{item.matricula}</td>
                  <td className="border px-2 py-1">{item.cpf}</td>
                  <td className="border px-2 py-1">{item.nome}</td>
                  <td className="border px-2 py-1">{item.funcao}</td>
                  <td className="border px-2 py-1">{item.rg}</td>
                  <td className="border px-2 py-1">{item.orgaoEmissor}</td>
                  <td className="border px-2 py-1">{item.uf}</td>
                  <td className="border px-2 py-1">
                    {item.dataNascimento ? new Date(item.dataNascimento).toLocaleDateString() : '-'}
                  </td>
                  <td className="border px-2 py-1">{item.email}</td>
                  <td className="border px-2 py-1">{item.telefone}</td>
                  <td className="border px-2 py-1">{item.centroCusto}</td>
                  <td className="border px-2 py-1">{item.departamento}</td>
                  <td className="border px-2 py-1">{item.status}</td>
                  <td className="border px-2 py-1">{item.criadoEm ? new Date(item.criadoEm).toLocaleString() : '-'}</td>
                  <td className="border px-2 py-1">{item.atualizadoEm ? new Date(item.atualizadoEm).toLocaleString() : '-'}</td>
                  <td className="border px-2 py-1">{item.excluidoEm ? new Date(item.excluidoEm).toLocaleString() : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dados.length > 0 && (
        <div className="flex justify-between items-center mt-4 text-sm">
          <span>
            Página {currentPage} de {totalPages}
          </span>
          <div className="space-x-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >
              Anterior
            </button>
            <button
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function PlanejamentoGeral() {
  return (
    <ProtectedRoute
      requiredEquipe={ROUTE_PROTECTION.PLANEJAMENTO.requiredEquipe}
      requiredPermissions={ROUTE_PROTECTION.PLANEJAMENTO.requiredPermissions}
    >
      <PlanejamentoGeralContent />
    </ProtectedRoute>
  )
}
