'use client'

import { useState, useEffect } from 'react'
import { Truck, Plus, Search, Filter, CheckCircle, Clock, AlertCircle } from 'lucide-react'
import { useToast } from '@/components/Toast'
import LoadingSpinner from '@/components/LoadingSpinner'

interface Tarefa {
  id: string
  titulo: string
  descricao: string
  status: 'PENDENTE' | 'EM_ANDAMENTO' | 'CONCLUIDA'
  prioridade: 'BAIXA' | 'MEDIA' | 'ALTA'
  setor: string
  criadoEm: string
  atualizadoEm: string
  prazo?: string
}

export default function TarefasLogisticaPage() {
  const [tarefas, setTarefas] = useState<Tarefa[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroStatus, setFiltroStatus] = useState<string>('')
  const [filtroPrioridade, setFiltroPrioridade] = useState<string>('')
  const [busca, setBusca] = useState('')
  const { showToast } = useToast()

  const carregarTarefas = async () => {
    try {
      const params = new URLSearchParams()
      params.append('setor', 'logistica')
      if (filtroStatus) params.append('status', filtroStatus)
      if (filtroPrioridade) params.append('prioridade', filtroPrioridade)
      if (busca) params.append('busca', busca)

      const response = await fetch(`/api/tarefas?${params}`)
      if (response.ok) {
        const data = await response.json()
        setTarefas(data.tarefas)
      } else {
        showToast('Erro ao carregar tarefas', 'error')
      }
    } catch (error) {
      console.error('Erro ao carregar tarefas:', error)
      showToast('Erro interno do servidor', 'error')
    } finally {
      setLoading(false)
    }
  }

  const atualizarStatusTarefa = async (id: string, novoStatus: string) => {
    try {
      const response = await fetch(`/api/tarefas/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: novoStatus }),
      })

      if (response.ok) {
        showToast('Status da tarefa atualizado!', 'success')
        carregarTarefas()
      } else {
        showToast('Erro ao atualizar tarefa', 'error')
      }
    } catch (error) {
      console.error('Erro ao atualizar tarefa:', error)
      showToast('Erro interno do servidor', 'error')
    }
  }

  useEffect(() => {
    carregarTarefas()
  }, [filtroStatus, filtroPrioridade, busca])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDENTE':
        return <Clock className="text-yellow-500" size={16} />
      case 'EM_ANDAMENTO':
        return <AlertCircle className="text-blue-500" size={16} />
      case 'CONCLUIDA':
        return <CheckCircle className="text-green-500" size={16} />
      default:
        return <Clock className="text-gray-500" size={16} />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDENTE':
        return 'bg-yellow-100 text-yellow-800'
      case 'EM_ANDAMENTO':
        return 'bg-blue-100 text-blue-800'
      case 'CONCLUIDA':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getPrioridadeColor = (prioridade: string) => {
    switch (prioridade) {
      case 'ALTA':
        return 'bg-red-100 text-red-800'
      case 'MEDIA':
        return 'bg-yellow-100 text-yellow-800'
      case 'BAIXA':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-md">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Truck className="text-blue-600" />
            Minhas Tarefas - Logística
          </h1>
        </div>

        {/* Filtros */}
        <div className="p-6 border-b border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Buscar
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="Buscar tarefas..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos os status</option>
                <option value="PENDENTE">Pendente</option>
                <option value="EM_ANDAMENTO">Em Andamento</option>
                <option value="CONCLUIDA">Concluída</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Prioridade
              </label>
              <select
                value={filtroPrioridade}
                onChange={(e) => setFiltroPrioridade(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todas as prioridades</option>
                <option value="ALTA">Alta</option>
                <option value="MEDIA">Média</option>
                <option value="BAIXA">Baixa</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={() => {
                  setFiltroStatus('')
                  setFiltroPrioridade('')
                  setBusca('')
                }}
                className="w-full bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600 flex items-center justify-center gap-2"
              >
                <Filter size={16} />
                Limpar Filtros
              </button>
            </div>
          </div>
        </div>

        {/* Lista de Tarefas */}
        <div className="p-6">
          {tarefas.length === 0 ? (
            <div className="text-center py-8">
              <Truck className="mx-auto text-gray-400 mb-4" size={48} />
              <p className="text-gray-500">Nenhuma tarefa encontrada</p>
            </div>
          ) : (
            <div className="space-y-4">
              {tarefas.map((tarefa) => (
                <div key={tarefa.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {getStatusIcon(tarefa.status)}
                        <h3 className="font-semibold text-gray-900">{tarefa.titulo}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(tarefa.status)}`}>
                          {tarefa.status.replace('_', ' ')}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPrioridadeColor(tarefa.prioridade)}`}>
                          {tarefa.prioridade}
                        </span>
                      </div>
                      <p className="text-gray-600 mb-2">{tarefa.descricao}</p>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>Criado em: {new Date(tarefa.criadoEm).toLocaleDateString('pt-BR')}</span>
                        {tarefa.prazo && (
                          <span>Prazo: {new Date(tarefa.prazo).toLocaleDateString('pt-BR')}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      {tarefa.status === 'PENDENTE' && (
                        <button
                          onClick={() => atualizarStatusTarefa(tarefa.id, 'EM_ANDAMENTO')}
                          className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                        >
                          Iniciar
                        </button>
                      )}
                      {tarefa.status === 'EM_ANDAMENTO' && (
                        <button
                          onClick={() => atualizarStatusTarefa(tarefa.id, 'CONCLUIDA')}
                          className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                        >
                          Concluir
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}