/** Importação de certificados: Administração e Treinamento com edição. */
export function canManageDrakeCertificates(equipe: string | null | undefined): boolean {
  const nome = (equipe ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ");
  return /^(?:administracao|treinamento(?: \((?:editor|gestor)\))?)$/i.test(nome);
}
