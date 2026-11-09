"use client";
import { useAuth } from "@/app/hooks/useAuth";
import { canManageDrakeCertificates } from "@/lib/integracoes/certificadosDrakeAccess";
import { CertificateWorkspace } from "./CertificateWorkspace";
export default function ImportacoesCertificadosPage() {
  const { usuario, loading } = useAuth();
  if (loading) return <div className="p-6" role="status">Verificando acesso…</div>;
  if (!usuario || !canManageDrakeCertificates(usuario.equipe)) return <div className="p-6" role="alert">Acesso permitido à Administração e ao Treinamento (Editor ou Gestor).</div>;
  return <CertificateWorkspace />;
}

