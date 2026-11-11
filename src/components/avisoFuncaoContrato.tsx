"use client";
import { useEffect, useMemo, useState } from "react";
import { EnvelopeIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { SiMicrosoftteams } from "react-icons/si";
import { MENSAGEM_FUNCAO_CONTRATO, MENSAGEM_FUNCAO_INDEFINIDA } from "@/lib/mensagensFuncaoContrato";

const contatosRH = [
  { nome: "Maryah de Sousa Cordeiro Areas Figueira", email: "maryah.figueira@granservices.com" },
  { nome: "Maria Luiza Cordeiro dos Santos Soares", email: "maria.soares@granservices.com" },
  { nome: "Mayara Balagna da Conceição", email: "Mayara.conceicao@granservices.com" },
  { nome: "Ynara Caroline de Jesus Tavares", email: "ynara.tavares@granservices.com" },
  { nome: "Hadrya Gabrielly Modesto Amaral", email: "hadrya.amaral@granservices.com" },
  { nome: "Cristiane Menezes de Souza", email: "cristiane.menezes@granservices.com" },
];

type Bloqueio = { id: number; nome: string; matricula: string; motivo: string };
export function useFuncoesContrato(contratoId: number | undefined, ids: number[]) {
  const [bloqueados, setBloqueados] = useState<Bloqueio[]>([]);
  const [estado, setEstado] = useState<"carregando" | "pronto" | "erro">("carregando");
  const [chaveConsultada, setChaveConsultada] = useState("");
  const chave = useMemo(() => [...new Set(ids)].sort((a, b) => a - b).join(","), [ids]);
  useEffect(() => {
    if (!contratoId) { setBloqueados([]); setEstado("carregando"); return; }
    const controller = new AbortController();
    setEstado("carregando");
    fetch("/api/remanejamentos/validar-funcoes", {
      method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
      body: JSON.stringify({ contratoId, funcionarioIds: chave ? chave.split(",").map(Number) : [] }),
    }).then(async response => {
      if (!response.ok) throw new Error("Falha na verificação");
      const data = await response.json();
      setBloqueados(data.bloqueados); setChaveConsultada(`${contratoId}:${chave}`); setEstado("pronto");
    }).catch(error => { if (error.name !== "AbortError") { setChaveConsultada(`${contratoId}:${chave}`); setEstado("erro"); } });
    return () => controller.abort();
  }, [contratoId, chave]);
  return { bloqueados, estado: chaveConsultada === `${contratoId}:${chave}` ? estado : "carregando" as const };
}
export function mensagemBloqueio(motivo?: string) {
  return motivo === "FUNCAO_INDEFINIDA" ? MENSAGEM_FUNCAO_INDEFINIDA : MENSAGEM_FUNCAO_CONTRATO;
}
export function IconeFuncaoBloqueada({ motivo }: { motivo?: string }) {
  return <span tabIndex={0} title={mensagemBloqueio(motivo)} aria-label={mensagemBloqueio(motivo)} className="inline-flex text-amber-600 cursor-help"><ExclamationTriangleIcon className="h-5 w-5" /></span>;
}
export function ModalFuncaoBloqueada({ motivo, onClose }: { motivo?: string; onClose: () => void }) {
  useEffect(() => {
    const fechar = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", fechar); return () => window.removeEventListener("keydown", fechar);
  }, [onClose]);
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation" onClick={onClose}>
    <div role="dialog" aria-modal="true" aria-labelledby="titulo-funcao-bloqueada" className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
      <h2 id="titulo-funcao-bloqueada" className="text-lg font-semibold text-gray-900">Função indisponível</h2>
      <p className="mt-4 text-sm leading-6 text-gray-700">{mensagemBloqueio(motivo)}</p>
      <div className="mt-5 border-t border-gray-100 pt-4">
        <p className="text-xs font-medium text-gray-500">Contatos RH/Treinamentos</p>
        <ul className="mt-2 divide-y divide-gray-100">
          {contatosRH.map((contato) => <li key={contato.email} className="flex items-center justify-between gap-3 py-2">
            <span className="text-xs text-slate-700">{contato.nome}</span>
            <span className="flex shrink-0 items-center gap-2">
              <a href={`msteams:/l/chat/0/0?users=${encodeURIComponent(contato.email)}`} title={`Conversar com ${contato.nome} no Teams`} aria-label={`Conversar com ${contato.nome} no Teams`} className="rounded p-1 text-indigo-600 hover:bg-indigo-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600">
                <SiMicrosoftteams aria-hidden="true" className="h-4 w-4" />
              </a>
              <a href={`https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(contato.email)}`} target="_blank" rel="noopener noreferrer" title={`Enviar e-mail para ${contato.nome}`} aria-label={`Enviar e-mail para ${contato.nome}`} className="rounded p-1 text-slate-500 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-600">
                <EnvelopeIcon aria-hidden="true" className="h-4 w-4" />
              </a>
            </span>
          </li>)}
        </ul>
      </div>
      <div className="mt-6 flex justify-end"><button autoFocus type="button" onClick={onClose} className="rounded-lg bg-slate-700 px-4 py-2 text-white hover:bg-slate-800">Entendi</button></div>
    </div>
  </div>;
}
