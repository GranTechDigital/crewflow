"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  XMarkIcon,
  PencilIcon,
  TrashIcon,
  PaperAirplaneIcon,
} from "@heroicons/react/24/outline";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/app/hooks/useAuth";
import { PERMISSIONS } from "@/lib/permissions";

interface Observacao {
  id: string;
  texto: string;
  criadoEm: string;
  criadoPor: string;
  criadoPorId?: number;
  modificadoPor: string;
}

interface ObservacoesRemanejamentoModalProps {
  isOpen: boolean;
  onClose: () => void;
  remanejamentoId: string;
  funcionarioNome: string;
  funcionarioMatricula: string;
  onObservationsChange?: (count: number) => void;
}

export default function ObservacoesRemanejamentoModal({
  isOpen,
  onClose,
  remanejamentoId,
  funcionarioNome,
  funcionarioMatricula,
  onObservationsChange,
}: ObservacoesRemanejamentoModalProps) {
  const { showToast } = useToast();
  const { usuario } = useAuth();
  const [observacoes, setObservacoes] = useState<Observacao[]>([]);
  const [loading, setLoading] = useState(false);
  const [novaObservacao, setNovaObservacao] = useState("");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [textoEdicao, setTextoEdicao] = useState("");

  // Helper para verificar permissões
  const canCreate = () => {
    if (!usuario) return false;
    const permissoes = usuario.permissoes || [];
    // Admin total ou editor/gestor do módulo Prestserv podem criar
    return (
      permissoes.includes(PERMISSIONS.ADMIN) ||
      permissoes.includes(PERMISSIONS.ACCESS_PREST_SERV) ||
      permissoes.includes(PERMISSIONS.ACCESS_PREST_SERV_GESTOR)
    );
  };

  const canEdit = (obs: Observacao) => {
    if (!usuario) return false;

    // Verificar permissão básica
    const permissoes = usuario.permissoes || [];

    // Admin bypass - Admins podem editar tudo sempre
    if (permissoes.includes(PERMISSIONS.ADMIN)) {
      return true;
    }

    // Editor/Gestor do módulo Prestserv podem editar (sujeito às regras abaixo)
    const isEditor =
      permissoes.includes(PERMISSIONS.ACCESS_PREST_SERV) ||
      permissoes.includes(PERMISSIONS.ACCESS_PREST_SERV_GESTOR);
    if (!isEditor) return false;

    // Verificar propriedade (se obs.criadoPorId existir)
    if (obs.criadoPorId && obs.criadoPorId !== usuario.id) return false;

    // Se não tiver ID (legado), ninguém edita (exceto admin acima)
    if (!obs.criadoPorId) return false;

    // Verificar tempo (1 hora)
    const created = new Date(obs.criadoEm).getTime();
    const now = new Date().getTime();
    const oneHour = 60 * 60 * 1000;

    return now - created < oneHour;
  };

  const fetchObservacoes = useCallback(async () => {
    setLoading(true);
    try {
      const url = `/api/prestserv/observacoes-remanejamento?remanejamentoId=${encodeURIComponent(
        remanejamentoId
      )}`;

      const res = await fetch(url);

      if (!res.ok) {
        throw new Error(
          `Falha ao carregar observações: ${res.status} ${res.statusText}`
        );
      }

      const data = await res.json();
      setObservacoes(data);
      if (onObservationsChange) {
        onObservationsChange(data.length);
      }
    } catch (error) {
      console.error("Erro ao buscar observações:", error);
      showToast("Erro ao carregar observações", "error");
    } finally {
      setLoading(false);
    }
  }, [remanejamentoId, onObservationsChange, showToast]);

  useEffect(() => {
    if (isOpen && remanejamentoId) {
      fetchObservacoes();
    }
  }, [isOpen, remanejamentoId, fetchObservacoes]);

  const handleSalvar = async () => {
    if (!novaObservacao.trim()) return;

    try {
      // Usando a nova rota simplificada
      const res = await fetch(`/api/prestserv/observacoes-remanejamento`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          remanejamentoId,
          texto: novaObservacao,
        }),
      });

      if (!res.ok) throw new Error("Falha ao salvar observação");

      setNovaObservacao("");
      fetchObservacoes();
      showToast("Observação adicionada", "success");
    } catch (error) {
      console.error("Erro ao salvar observação:", error);
      showToast("Erro ao salvar observação", "error");
    }
  };

  const handleEditar = async (id: string) => {
    if (!textoEdicao.trim()) return;

    try {
      const res = await fetch(
        `/api/prestserv/remanejamentos/observacoes/${id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            texto: textoEdicao,
            modificadoPor: usuario?.email || "Sistema",
          }),
        }
      );

      if (!res.ok) throw new Error("Falha ao atualizar observação");

      setEditandoId(null);
      fetchObservacoes();
      showToast("Observação atualizada", "success");
    } catch (error) {
      showToast("Erro ao atualizar observação", "error");
    }
  };

  const handleExcluir = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta observação?")) return;

    try {
      const res = await fetch(
        `/api/prestserv/remanejamentos/observacoes/${id}`,
        {
          method: "DELETE",
        }
      );

      if (!res.ok) throw new Error("Falha ao excluir observação");

      fetchObservacoes();
      showToast("Observação excluída", "success");
    } catch (error) {
      showToast("Erro ao excluir observação", "error");
    }
  };

  const formatarData = (dataString: string) => {
    if (!dataString) return "-";
    try {
      const data = new Date(dataString);
      if (isNaN(data.getTime())) return "Data inválida";

      return new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(data);
    } catch (error) {
      return "Data inválida";
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6">
      <div
        className="fixed inset-0 bg-gray-900/75 transition-opacity"
        aria-hidden="true"
        onClick={onClose}
      ></div>

      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">
            Observações - {funcionarioNome}
            <span className="block text-sm text-gray-500 font-normal">
              {funcionarioMatricula}
            </span>
          </h3>
          <button
            type="button"
            className="text-gray-400 hover:text-gray-500 focus:outline-none p-1 rounded-full hover:bg-gray-100"
            onClick={onClose}
          >
            <span className="sr-only">Fechar</span>
            <XMarkIcon className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="text-center py-4 text-gray-500">Carregando...</div>
          ) : observacoes.length === 0 ? (
            <div className="text-center py-4 text-gray-500">
              Nenhuma observação registrada.
            </div>
          ) : (
            observacoes.map((obs) => (
              <div
                key={obs.id}
                className="bg-gray-50 p-3 rounded-lg border border-gray-200"
              >
                {editandoId === obs.id ? (
                  <div className="space-y-2">
                    <textarea
                      className="w-full border rounded p-2 text-sm"
                      value={textoEdicao}
                      onChange={(e) => setTextoEdicao(e.target.value)}
                      rows={3}
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setEditandoId(null)}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => handleEditar(obs.id)}
                        className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                      >
                        Salvar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between items-start">
                      <div className="text-xs text-gray-500 mb-1">
                        {formatarData(obs.criadoEm)} por {obs.criadoPor}
                      </div>
                      {canEdit(obs) && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditandoId(obs.id);
                              setTextoEdicao(obs.texto);
                            }}
                            className="text-blue-600 hover:text-blue-800"
                            title="Editar"
                          >
                            <PencilIcon className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => handleExcluir(obs.id)}
                            className="text-red-600 hover:text-red-800"
                            title="Excluir"
                          >
                            <TrashIcon className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">
                      {obs.texto}
                    </p>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        {canCreate() ? (
          <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nova Observação
            </label>
            <div className="flex gap-2">
              <textarea
                className="flex-1 border rounded-md p-2 text-sm focus:ring-blue-500 focus:border-blue-500 resize-none"
                rows={2}
                placeholder="Digite aqui..."
                value={novaObservacao}
                onChange={(e) => setNovaObservacao(e.target.value)}
              />
              <button
                onClick={handleSalvar}
                disabled={!novaObservacao.trim()}
                className="self-end bg-blue-600 text-white p-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <PaperAirplaneIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-lg text-center text-sm text-gray-500">
            Apenas editores podem adicionar observações.
          </div>
        )}
      </div>
    </div>
  );
}
