"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowPathIcon,
  SignalIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";
import ProtectedRoute from "@/components/ProtectedRoute";
import { ROUTE_PROTECTION } from "@/lib/permissions";

type OnlineUser = {
  usuarioId: number;
  nome: string;
  matricula: string;
  email?: string | null;
  equipe: string;
  ativo: boolean;
  ultimoLogin?: string | null;
  sessionStart?: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  currentPath?: string | null;
};

type OnlineUsersResponse = {
  success: boolean;
  meta: {
    fetchedAt: string;
    onlineWindowMinutes: number;
    onlineCount: number;
    trackedCount: number;
    totalUsuariosAtivos: number;
  };
  onlineUsers: OnlineUser[];
};

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR");
}

function formatRelative(value?: string | null) {
  if (!value) return "-";
  const diffMs = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) return "agora";
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s atrás`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}min atrás`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h atrás`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}d atrás`;
}

function UsuariosOnlineContent() {
  const [data, setData] = useState<OnlineUsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [windowMinutes, setWindowMinutes] = useState("2");

  const fetchOnlineUsers = useCallback(
    async (soft = false) => {
      try {
        if (soft) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }
        setError(null);

        const response = await fetch(
          `/api/admin/usuarios-online?window=${encodeURIComponent(windowMinutes)}`,
          {
            cache: "no-store",
          },
        );

        if (!response.ok) {
          const message =
            response.status === 403
              ? "Acesso negado para visualizar presença online."
              : "Erro ao carregar usuários online.";
          throw new Error(message);
        }

        const payload = (await response.json()) as OnlineUsersResponse;
        setData(payload);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro inesperado");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [windowMinutes],
  );

  useEffect(() => {
    fetchOnlineUsers();
  }, [fetchOnlineUsers]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchOnlineUsers(true);
    }, 20 * 1000);
    return () => clearInterval(intervalId);
  }, [fetchOnlineUsers]);

  const onlineUsers = useMemo(() => data?.onlineUsers || [], [data]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Usuários Online
          </h1>
          <p className="text-sm text-slate-600">
            Monitoramento em tempo real de sessões ativas no sistema.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={windowMinutes}
            onChange={(e) => setWindowMinutes(e.target.value)}
            className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700"
          >
            <option value="1">Janela 1 min</option>
            <option value="2">Janela 2 min</option>
            <option value="5">Janela 5 min</option>
          </select>
          <button
            type="button"
            onClick={() => fetchOnlineUsers(true)}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50"
          >
            <ArrowPathIcon
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
            Atualizar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Online Agora
          </p>
          <p className="mt-1 text-2xl font-semibold text-emerald-600">
            {data?.meta.onlineCount ?? 0}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Usuários Ativos
          </p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {data?.meta.totalUsuariosAtivos ?? 0}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Atualizado Em
          </p>
          <p className="mt-1 text-sm font-medium text-slate-700">
            {formatDateTime(data?.meta.fetchedAt)}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-600">
            Carregando usuários online...
          </div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-rose-600">{error}</div>
        ) : onlineUsers.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-600">
            Nenhum usuário online no momento.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Usuário</th>
                  <th className="px-3 py-2">Equipe</th>
                  <th className="px-3 py-2">Última Atividade</th>
                  <th className="px-3 py-2">Sessão</th>
                  <th className="px-3 py-2">Rota</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-sm text-slate-700">
                {onlineUsers.map((user) => (
                  <tr key={user.usuarioId} className="hover:bg-slate-50/60">
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                        <SignalIcon className="h-3.5 w-3.5" />
                        Online
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-900">{user.nome}</div>
                      <div className="text-xs text-slate-500">{user.matricula}</div>
                    </td>
                    <td className="px-3 py-2">{user.equipe || "-"}</td>
                    <td className="px-3 py-2">
                      <div>{formatRelative(user.lastSeenAt)}</div>
                      <div className="text-xs text-slate-500">
                        {formatDateTime(user.lastSeenAt)}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="inline-flex items-center gap-1 text-slate-600">
                        <ClockIcon className="h-3.5 w-3.5" />
                        {formatDateTime(user.sessionStart)}
                      </div>
                      <div className="text-xs text-slate-500">
                        Login: {formatDateTime(user.ultimoLogin)}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      {user.currentPath || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function UsuariosOnlinePage() {
  return (
    <ProtectedRoute
      requiredPermissions={ROUTE_PROTECTION.ADMIN.requiredPermissions}
      requiredEquipe={ROUTE_PROTECTION.ADMIN.requiredEquipe}
    >
      <UsuariosOnlineContent />
    </ProtectedRoute>
  );
}

