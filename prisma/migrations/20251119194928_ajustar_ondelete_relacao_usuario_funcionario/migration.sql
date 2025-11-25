-- DropForeignKey
ALTER TABLE "public"."Usuario" DROP CONSTRAINT "Usuario_funcionarioId_fkey";

-- AddForeignKey
ALTER TABLE "public"."Usuario" ADD CONSTRAINT "Usuario_funcionarioId_fkey" FOREIGN KEY ("funcionarioId") REFERENCES "public"."Funcionario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
