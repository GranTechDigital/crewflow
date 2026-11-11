import { prisma } from "@/lib/prisma";

export { MENSAGEM_FUNCAO_CONTRATO, MENSAGEM_FUNCAO_INDEFINIDA } from "@/lib/mensagensFuncaoContrato";

export async function verificarFuncoesContrato(contratoId: number, funcionarioIds: number[]) {
  const funcionarios = await prisma.funcionario.findMany({
    where: { id: { in: funcionarioIds } },
    select: { id: true, nome: true, matricula: true, funcaoId: true, funcaoRef: { select: { ativo: true } } },
  });
  const funcoes = await prisma.matrizTreinamento.findMany({
    where: { contratoId, funcaoId: { in: funcionarios.flatMap(f => f.funcaoId && f.funcaoRef?.ativo ? [f.funcaoId] : []) } },
    select: { funcaoId: true }, distinct: ["funcaoId"],
  });
  const cadastradas = new Set(funcoes.map(f => f.funcaoId));
  return funcionarios.filter(f => !f.funcaoId || !f.funcaoRef?.ativo || !cadastradas.has(f.funcaoId))
    .map(f => ({ id: f.id, nome: f.nome, matricula: f.matricula, motivo: !f.funcaoId || !f.funcaoRef?.ativo ? "FUNCAO_INDEFINIDA" : "FUNCAO_NAO_CADASTRADA" }));
}
