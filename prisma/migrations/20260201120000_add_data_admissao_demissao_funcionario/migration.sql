-- Tornar idempotente para evitar falha em ambientes já atualizados via SSH
ALTER TABLE "public"."Funcionario" ADD COLUMN IF NOT EXISTS "dataAdmissao" TIMESTAMP(3);
ALTER TABLE "public"."Funcionario" ADD COLUMN IF NOT EXISTS "dataDemissao" TIMESTAMP(3);
