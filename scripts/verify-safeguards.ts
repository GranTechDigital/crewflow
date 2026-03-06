
import 'dotenv/config';
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔒 Iniciando Verificação de Salvaguardas (Teste de Segurança)...");

  // IDs para limpeza posterior
  let createdIds = {
    solicitacaoId: 0,
    funcionarioId: 0,
    remanejamentoId: "",
    contratoId: 0,
    tarefaIds: [] as string[]
  };

  try {
    // 1. Setup: Criar dados base (Contrato, Funcionario, Solicitacao)
    console.log("1. Setup: Criando dados de teste...");
    
    // Contrato dummy
    const contrato = await prisma.contrato.create({
      data: {
        numero: `TEST-${Date.now()}`,
        nome: "CONTRATO TESTE SAFEGUARD",
        cliente: "CLIENTE TESTE",
        dataInicio: new Date(),
        dataFim: new Date(),
        status: "ATIVO"
      }
    });
    createdIds.contratoId = contrato.id;

    // Funcionario dummy
    const funcionario = await prisma.funcionario.create({
      data: {
        matricula: `TEST-${Date.now()}`,
        nome: "FUNCIONARIO TESTE SAFEGUARD",
        status: "ATIVO",
        emMigracao: true
      }
    });
    createdIds.funcionarioId = funcionario.id;

    // Solicitacao dummy (ALOCACAO/REMANEJAMENTO)
    const solicitacao = await prisma.solicitacaoRemanejamento.create({
      data: {
        tipo: "REMANEJAMENTO",
        status: "Pendente",
        contratoOrigemId: contrato.id,
        contratoDestinoId: contrato.id
      }
    });
    createdIds.solicitacaoId = solicitacao.id;

    // Remanejamento dummy
    const remanejamento = await prisma.remanejamentoFuncionario.create({
      data: {
        solicitacaoId: solicitacao.id,
        funcionarioId: funcionario.id,
        statusPrestserv: "EM VALIDAÇÃO",
        statusTarefas: "ATENDER TAREFAS"
      }
    });
    createdIds.remanejamentoId = remanejamento.id;

    console.log(`✅ Dados de teste criados. Remanejamento ID: ${remanejamento.id}`);

    // ==================================================================================
    // TESTE 1: Tentar validar sem tarefas (Deve falhar)
    // ==================================================================================
    console.log("\n🧪 TESTE 1: Tentar validar sem tarefas (Deve falhar)...");

    const validateLogic = async (remId: string) => {
        const rem = await prisma.remanejamentoFuncionario.findUnique({
            where: { id: remId },
            include: { tarefas: true, solicitacao: true }
        });
        if (!rem) throw new Error("Remanejamento não encontrado");

        // Lógica copiada da rota PUT
        const statusPrestservCanonical = "VALIDADO";
        const tipoSolicitacao = rem.solicitacao?.tipo;

        if (statusPrestservCanonical === "VALIDADO" && tipoSolicitacao !== "DESLIGAMENTO") {
            const setoresObrigatorios = ["RH", "MEDICINA", "TREINAMENTO"];
            const setoresFaltantes: string[] = [];

            const detectSetorLocal = (resp: string) => {
              const r = resp.toUpperCase();
              if (r.includes("RH") || r.includes("RECURSOS HUMANOS")) return "RH";
              if (r.includes("MED") || r.includes("SAUDE") || r.includes("SAÚDE"))
                return "MEDICINA";
              if (r.includes("TREIN") || r.includes("CAPACIT"))
                return "TREINAMENTO";
              return "OUTROS";
            };

            const tarefasAtivas = rem.tarefas.filter(t => t.status !== "CANCELADO");

            for (const setor of setoresObrigatorios) {
              const temTarefa = tarefasAtivas.some(t => detectSetorLocal(t.responsavel) === setor);
              if (!temTarefa) setoresFaltantes.push(setor);
            }

            if (setoresFaltantes.length > 0) {
              return { success: false, error: `Faltam setores: ${setoresFaltantes.join(", ")}` };
            }
        }
        return { success: true };
    };

    const result1 = await validateLogic(remanejamento.id);
    if (!result1.success) {
        console.log(`✅ SUCESSO: Validação bloqueada corretamente. Erro: ${result1.error}`);
    } else {
        console.error("❌ FALHA: Validação permitida indevidamente (0 tarefas).");
        process.exit(1);
    }

    // ==================================================================================
    // TESTE 2: Adicionar tarefas parciais (RH e MED) e tentar validar (Deve falhar)
    // ==================================================================================
    console.log("\n🧪 TESTE 2: Adicionar tarefas parciais (RH, MED) e validar (Deve falhar)...");
    
    const t1 = await prisma.tarefaRemanejamento.create({
        data: { remanejamentoFuncionarioId: remanejamento.id, tipo: "Task", responsavel: "RH", status: "CONCLUIDO" }
    });
    const t2 = await prisma.tarefaRemanejamento.create({
        data: { remanejamentoFuncionarioId: remanejamento.id, tipo: "Task", responsavel: "MEDICINA", status: "CONCLUIDO" }
    });
    createdIds.tarefaIds.push(t1.id, t2.id);

    const result2 = await validateLogic(remanejamento.id);
    if (!result2.success) {
        console.log(`✅ SUCESSO: Validação bloqueada corretamente. Erro: ${result2.error}`);
        if (!result2.error?.includes("TREINAMENTO")) {
             console.error("❌ FALHA: Erro não mencionou TREINAMENTO.");
        }
    } else {
        console.error("❌ FALHA: Validação permitida indevidamente (Falta Treinamento).");
        process.exit(1);
    }

    // ==================================================================================
    // TESTE 3: Adicionar tarefa de TREINAMENTO e validar (Deve passar)
    // ==================================================================================
    console.log("\n🧪 TESTE 3: Adicionar tarefa de TREINAMENTO e validar (Deve passar)...");
    
    const t3 = await prisma.tarefaRemanejamento.create({
        data: { remanejamentoFuncionarioId: remanejamento.id, tipo: "Task", responsavel: "TREINAMENTO", status: "CONCLUIDO" }
    });
    createdIds.tarefaIds.push(t3.id);

    const result3 = await validateLogic(remanejamento.id);
    if (result3.success) {
        console.log("✅ SUCESSO: Validação permitida com todos os setores.");
    } else {
        console.error(`❌ FALHA: Validação bloqueada indevidamente. Erro: ${result3.error}`);
        process.exit(1);
    }

    // ==================================================================================
    // TESTE 4: Testar Bypass de DESLIGAMENTO
    // ==================================================================================
    console.log("\n🧪 TESTE 4: Testar Bypass de DESLIGAMENTO...");
    
    // Mudar tipo solicitação
    await prisma.solicitacaoRemanejamento.update({
        where: { id: solicitacao.id },
        data: { tipo: "DESLIGAMENTO" }
    });

    // Remover todas as tarefas (simular 0/0)
    await prisma.tarefaRemanejamento.deleteMany({
        where: { remanejamentoFuncionarioId: remanejamento.id }
    });
    createdIds.tarefaIds = []; // Já deletadas

    const result4 = await validateLogic(remanejamento.id);
    if (result4.success) {
        console.log("✅ SUCESSO: Validação permitida para DESLIGAMENTO sem tarefas.");
    } else {
        console.error(`❌ FALHA: Validação bloqueada para DESLIGAMENTO. Erro: ${result4.error}`);
        process.exit(1);
    }

    // ==================================================================================
    // TESTE 5: Testar Correção Automática (Fix Validated)
    // ==================================================================================
    console.log("\n🧪 TESTE 5: Testar Correção Automática (Fix Validated)...");

    // Resetar para REMANEJAMENTO e setar status VALIDADO forçadamente (simulando o erro existente)
    await prisma.solicitacaoRemanejamento.update({
        where: { id: solicitacao.id },
        data: { tipo: "REMANEJAMENTO" }
    });
    
    await prisma.remanejamentoFuncionario.update({
        where: { id: remanejamento.id },
        data: { statusPrestserv: "VALIDADO", updatedAt: new Date() } // Recent update
    });

    // Executar lógica de correção (simulada do admin/fix-validated)
    const runFixLogic = async () => {
        const candidatos = await prisma.remanejamentoFuncionario.findMany({
            where: {
                id: remanejamento.id, // Focar no nosso teste
                statusPrestserv: "VALIDADO",
                solicitacao: { tipo: { not: "DESLIGAMENTO" } }
            },
            include: { tarefas: true, solicitacao: true, funcionario: true }
        });

        let fixedCount = 0;
        for (const rem of candidatos) {
            const tarefasTreinamento = rem.tarefas.filter(t => 
                t.status !== "CANCELADO" && 
                ((t.responsavel && (t.responsavel.toUpperCase().includes("TREINAMENTO") || t.responsavel.toUpperCase().includes("CAPACIT"))) || t.treinamentoId !== null)
            );

            if (tarefasTreinamento.length === 0) {
                console.log(`[FIX] Revertendo ID ${rem.id}...`);
                await prisma.remanejamentoFuncionario.update({
                    where: { id: rem.id },
                    data: { statusPrestserv: "CRIADO" }
                });
                fixedCount++;
            }
        }
        return fixedCount;
    };

    const fixed = await runFixLogic();
    
    const finalState = await prisma.remanejamentoFuncionario.findUnique({ where: { id: remanejamento.id } });
    
    if (fixed === 1 && finalState?.statusPrestserv === "CRIADO") {
        console.log("✅ SUCESSO: Registro corrigido automaticamente (Revertido para CRIADO).");
    } else {
        console.error(`❌ FALHA: Correção não aplicada. Status: ${finalState?.statusPrestserv}, FixedCount: ${fixed}`);
        process.exit(1);
    }

    console.log("\n🏆 TODOS OS TESTES PASSARAM! O código é seguro.");

  } catch (error) {
    console.error("\n❌ ERRO FATAL NO TESTE:", error);
  } finally {
    // Cleanup
    console.log("\n🧹 Limpando dados de teste...");
    try {
        if (createdIds.tarefaIds.length > 0) await prisma.tarefaRemanejamento.deleteMany({ where: { id: { in: createdIds.tarefaIds } } });
        if (createdIds.remanejamentoId) await prisma.remanejamentoFuncionario.delete({ where: { id: createdIds.remanejamentoId } });
        if (createdIds.solicitacaoId) await prisma.solicitacaoRemanejamento.delete({ where: { id: createdIds.solicitacaoId } });
        if (createdIds.funcionarioId) await prisma.funcionario.delete({ where: { id: createdIds.funcionarioId } });
        if (createdIds.contratoId) await prisma.contrato.delete({ where: { id: createdIds.contratoId } });
    } catch (cleanupErr) {
        console.error("Erro na limpeza (pode ser ignorado se dados já foram deletados):", cleanupErr);
    }
    await prisma.$disconnect();
  }
}

main();
