"use client";

import { useState, useEffect, Fragment } from "react";
import { Menu, Transition } from "@headlessui/react";
import { Bell, Info, CheckCircle, AlertTriangle, XCircle, Clock } from "lucide-react";
import { useRouter } from "next/navigation";

interface Notificacao {
  id: number;
  tipoAcao: string;
  descricaoAcao: string;
  dataAcao: string;
  usuarioResponsavel: string;
  remanejamentoFuncionario?: {
    id: string;
    funcionario: {
      nome: string;
    };
  };
}

export default function NotificationsDropdown() {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchNotificacoes = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/notificacoes");
      if (res.ok) {
        const data = await res.json();
        setNotificacoes(data);
      }
    } catch (error) {
      console.error("Erro ao buscar notificações", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotificacoes();
    // Atualizar a cada 60 segundos
    const interval = setInterval(fetchNotificacoes, 60000);
    return () => clearInterval(interval);
  }, []);

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "agora mesmo";
    if (diffInSeconds < 3600) return `há ${Math.floor(diffInSeconds / 60)} min`;
    if (diffInSeconds < 86400) return `há ${Math.floor(diffInSeconds / 3600)} h`;
    return `há ${Math.floor(diffInSeconds / 86400)} dias`;
  };

  const getIcon = (tipo: string) => {
    const t = tipo.toUpperCase();
    if (t.includes("CRIACAO") || t.includes("CRIADO")) return <Info className="text-blue-500" size={16} />;
    if (t.includes("APROVADO") || t.includes("CONCLUIDO") || t.includes("VALIDADO")) return <CheckCircle className="text-green-500" size={16} />;
    if (t.includes("CANCELADO") || t.includes("REJEITADO") || t.includes("REPROVADO")) return <XCircle className="text-red-500" size={16} />;
    if (t.includes("ATUALIZACAO") || t.includes("ALTERADO")) return <Clock className="text-amber-500" size={16} />;
    return <AlertTriangle className="text-gray-500" size={16} />;
  };

  return (
    <Menu as="div" className="relative inline-block text-left mr-4">
      <Menu.Button className="relative p-2 text-gray-300 hover:text-white transition-colors rounded-full hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-sky-500">
        <Bell size={20} />
        {/* Indicador de novidade (simulado por enquanto, poderia ser baseado em lido/não lido) */}
        <span className="absolute top-1 right-1 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-gray-800" />
      </Menu.Button>

      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <Menu.Items className="absolute right-0 mt-2 w-80 origin-top-right divide-y divide-gray-100 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50 max-h-96 overflow-y-auto">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <p className="text-sm font-medium text-gray-900">Últimas Atividades</p>
          </div>
          
          {loading ? (
            <div className="p-4 text-center text-sm text-gray-500">Carregando...</div>
          ) : notificacoes.length === 0 ? (
            <div className="p-4 text-center text-sm text-gray-500">Nenhuma atividade recente.</div>
          ) : (
            <div className="py-1">
              {notificacoes.map((notificacao) => (
                <Menu.Item key={notificacao.id}>
                  {({ active }) => (
                    <div
                      className={`${
                        active ? "bg-gray-50" : ""
                      } px-4 py-3 cursor-pointer border-b border-gray-100 last:border-0`}
                    >
                      <div className="flex items-start">
                        <div className="flex-shrink-0 mt-0.5 mr-3">
                          {getIcon(notificacao.tipoAcao)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-900 truncate">
                            {notificacao.remanejamentoFuncionario?.funcionario.nome || "Sistema"}
                          </p>
                          <p className="text-xs text-gray-600 line-clamp-2 mt-0.5">
                            {notificacao.descricaoAcao}
                          </p>
                          <div className="flex items-center mt-1 space-x-2">
                            <span className="text-[10px] text-gray-400">
                              {formatTimeAgo(notificacao.dataAcao)}
                            </span>
                            <span className="text-[10px] text-gray-400">•</span>
                            <span className="text-[10px] text-gray-500 font-medium">
                              {notificacao.usuarioResponsavel}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </Menu.Item>
              ))}
            </div>
          )}
          
          <div className="py-2 text-center bg-gray-50 border-t border-gray-200">
             {/* Link para histórico completo futuramente */}
            <span className="text-xs text-sky-600 font-medium cursor-pointer hover:underline">
              Ver histórico completo
            </span>
          </div>
        </Menu.Items>
      </Transition>
    </Menu>
  );
}
