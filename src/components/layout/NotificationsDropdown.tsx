"use client";

import { useState, useEffect, Fragment } from "react";
import { Menu, Transition } from "@headlessui/react";
import {
  Bell,
  Info,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type NotificationResponse = {
  recent: any[];
  priority: any[];
  overdue: any[];
};

export default function NotificationsDropdown() {
  const [data, setData] = useState<NotificationResponse>({
    recent: [],
    priority: [],
    overdue: [],
  });
  const [loading, setLoading] = useState(true);
  const [hasNew, setHasNew] = useState(false);
  const router = useRouter();

  const fetchNotifications = async () => {
    try {
      const response = await fetch("/api/notificacoes");
      if (response.ok) {
        const newData = await response.json();
        setData(newData);

        const totalCount =
          (newData.recent?.length || 0) +
          (newData.priority?.length || 0) +
          (newData.overdue?.length || 0);

        if (totalCount > 0) {
          // Check against last known state (simplified for now)
          // Logic: if priority items exist, always show red dot until resolved?
          // Or just if any data exists.
          setHasNew(true);
        } else {
          setHasNew(false);
        }
      }
    } catch (error) {
      console.error("Erro ao buscar notificações:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000); // Poll every 60s
    return () => clearInterval(interval);
  }, []);

  const handleOpen = () => {
    // We don't clear hasNew immediately if there are priority items, maybe?
    // For now, clear it on open to acknowledge.
    setHasNew(false);
  };

  const formatTimeAgo = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "agora";
    if (diffInSeconds < 3600) return `há ${Math.floor(diffInSeconds / 60)} min`;
    if (diffInSeconds < 86400)
      return `há ${Math.floor(diffInSeconds / 3600)} h`;
    return `há ${Math.floor(diffInSeconds / 86400)} dias`;
  };

  const hasNotifications =
    data.priority?.length > 0 ||
    data.overdue?.length > 0 ||
    data.recent?.length > 0;

  return (
    <Menu as="div" className="relative inline-block text-left">
      {({ open }) => (
        <>
          <Menu.Button
            onClick={handleOpen}
            className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-600 transition-colors relative text-gray-300 hover:text-white"
            aria-label="Notificações"
          >
            <Bell size={20} />
            {hasNew && (
              <span className="absolute top-0 right-0 block h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-gray-800" />
            )}
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
            <Menu.Items className="absolute right-0 mt-2 w-96 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50 max-h-[80vh] overflow-y-auto">
              <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <p className="text-sm font-bold text-gray-700">Notificações</p>
                <button
                  onClick={fetchNotifications}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Atualizar
                </button>
              </div>

              <div className="py-1">
                {loading ? (
                  <div className="px-4 py-4 text-center text-sm text-gray-500">
                    Carregando...
                  </div>
                ) : !hasNotifications ? (
                  <div className="px-4 py-8 text-center text-sm text-gray-500 flex flex-col items-center">
                    <CheckCircle className="w-8 h-8 text-green-500 mb-2" />
                    <p>Tudo em dia!</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Nenhuma pendência ou atividade recente.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Prioridade - Treinamentos 0/0 */}
                    {data.priority?.length > 0 && (
                      <div className="border-b-4 border-red-100">
                        {/* Removido o cabeçalho de texto "Prioridade" conforme solicitado, mantendo o destaque visual */}
                        {data.priority.map((item: any) => (
                          <Menu.Item key={`prio-${item.id}`}>
                            {({ active }) => (
                              <Link
                                href={
                                  item.solicitacao?.contratoDestino?.id
                                    ? `/matriz-treinamento/contratos/${
                                        item.solicitacao.contratoDestino.id
                                      }?search=${encodeURIComponent(
                                        item.funcionario?.funcao || ""
                                      )}`
                                    : "#"
                                }
                                className={`${
                                  active ? "bg-red-50" : "bg-red-50/50"
                                } block px-4 py-3 border-b border-red-100 last:border-0 transition-colors`}
                              >
                                <div className="flex items-start">
                                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
                                  <div>
                                    <p className="text-sm font-medium text-gray-900">
                                      {item.funcionario?.nome}
                                    </p>
                                    <p className="text-xs text-gray-700 mt-0.5">
                                      <span className="font-semibold">
                                        Contrato:
                                      </span>{" "}
                                      {item.solicitacao?.contratoDestino
                                        ?.numero || "N/A"}
                                    </p>
                                    <p className="text-xs text-gray-700 mt-0.5">
                                      <span className="font-semibold">
                                        Função:
                                      </span>{" "}
                                      {item.funcionario?.funcao || "N/A"}
                                    </p>
                                    <p className="text-xs text-red-600 font-bold mt-1 uppercase">
                                      Criar função na matriz
                                    </p>
                                  </div>
                                </div>
                              </Link>
                            )}
                          </Menu.Item>
                        ))}
                      </div>
                    )}

                    {/* Pendências - Tarefas Vencidas */}
                    {data.overdue?.length > 0 && (
                      <div className="border-b-4 border-amber-100">
                        {/* Removido cabeçalho de texto explicito para manter consistência se desejar, mas mantendo para categorizar se não for "prioridade" */}
                        <div className="px-4 py-2 bg-amber-50 text-xs font-bold text-amber-700 uppercase tracking-wide flex items-center">
                          <Clock size={14} className="mr-2" />
                          Tarefas Vencidas
                        </div>
                        {data.overdue.map((task: any) => (
                          <Menu.Item key={`overdue-${task.id}`}>
                            {({ active }) => (
                              <Link
                                href={`/prestserv/tarefas?status=PENDENTE${
                                  task.responsavel
                                    ? `&responsavel=${task.responsavel}`
                                    : ""
                                }`}
                                className={`${
                                  active ? "bg-amber-50" : ""
                                } block px-4 py-3 border-b border-gray-100 last:border-0 transition-colors`}
                              >
                                <div className="flex items-start">
                                  <Clock className="w-5 h-5 text-amber-500 mt-0.5 mr-3 flex-shrink-0" />
                                  <div>
                                    <p className="text-sm font-medium text-gray-900">
                                      {task.tarefaPadrao?.descricao ||
                                        task.descricao ||
                                        "Tarefa sem descrição"}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                      {
                                        task.remanejamentoFuncionario
                                          ?.funcionario?.nome
                                      }
                                    </p>
                                    <p className="text-xs text-red-500 font-medium mt-1">
                                      Venceu {formatTimeAgo(task.dataLimite)}
                                    </p>
                                  </div>
                                </div>
                              </Link>
                            )}
                          </Menu.Item>
                        ))}
                      </div>
                    )}

                    {/* Recentes - Novos Remanejamentos */}
                    {data.recent?.length > 0 && (
                      <div>
                        <div className="px-4 py-2 bg-blue-50 text-xs font-bold text-blue-700 uppercase tracking-wide flex items-center">
                          <Info size={14} className="mr-2" />
                          Atividade Recente
                        </div>
                        {data.recent.map((hist: any) => (
                          <Menu.Item key={`recent-${hist.id}`}>
                            {({ active }) => (
                              <Link
                                href={`/prestserv/remanejamentos?nome=${
                                  hist.remanejamentoFuncionario?.funcionario
                                    ?.nome || ""
                                }`}
                                className={`${
                                  active ? "bg-blue-50" : ""
                                } block px-4 py-3 border-b border-gray-100 last:border-0 transition-colors`}
                              >
                                <div className="flex items-start">
                                  <Info className="w-5 h-5 text-blue-500 mt-0.5 mr-3 flex-shrink-0" />
                                  <div>
                                    <p className="text-sm font-medium text-gray-900">
                                      Novo Remanejamento
                                    </p>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                      {hist.usuario?.funcionario?.nome ||
                                        "Sistema"}{" "}
                                      criou uma solicitação.
                                    </p>
                                    <p className="text-xs text-gray-400 mt-1">
                                      {formatTimeAgo(hist.dataAcao)}
                                    </p>
                                  </div>
                                </div>
                              </Link>
                            )}
                          </Menu.Item>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </Menu.Items>
          </Transition>
        </>
      )}
    </Menu>
  );
}
