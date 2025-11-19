-- AlterTable
ALTER TABLE "public"."Usuario" ADD COLUMN     "emailSecundario" TEXT,
ADD COLUMN     "obrigarAdicionarEmail" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "obrigarTrocaSenha" BOOLEAN NOT NULL DEFAULT false;

-- RenameIndex
ALTER INDEX "public"."TarefaRemanejamento_rem_tipo_resp_key" RENAME TO "TarefaRemanejamento_remanejamentoFuncionarioId_tipo_respons_key";
