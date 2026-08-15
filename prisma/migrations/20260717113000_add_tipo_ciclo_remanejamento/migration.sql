ALTER TABLE "RemanejamentoCiclo"
ADD COLUMN IF NOT EXISTS "tipoCiclo" TEXT NOT NULL DEFAULT 'ATENDIMENTO_INICIAL',
ADD COLUMN IF NOT EXISTS "tituloCiclo" TEXT,
ADD COLUMN IF NOT EXISTS "descricaoCiclo" TEXT;

CREATE INDEX IF NOT EXISTS "RemanejamentoCiclo_tipoCiclo_idx"
ON "RemanejamentoCiclo"("tipoCiclo");
