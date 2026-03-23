CREATE TABLE IF NOT EXISTS "FuncionarioContratoVinculo" (
    "id" SERIAL NOT NULL,
    "funcionarioId" INTEGER NOT NULL,
    "contratoId" INTEGER NOT NULL,
    "tipoVinculo" TEXT NOT NULL DEFAULT 'ADICIONAL',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "dataInicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataFim" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FuncionarioContratoVinculo_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'FuncionarioContratoVinculo_funcionarioId_contratoId_key'
  ) THEN
    ALTER TABLE "FuncionarioContratoVinculo"
    ADD CONSTRAINT "FuncionarioContratoVinculo_funcionarioId_contratoId_key"
    UNIQUE ("funcionarioId", "contratoId");
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'FuncionarioContratoVinculo_funcionarioId_fkey'
  ) THEN
    ALTER TABLE "FuncionarioContratoVinculo"
    ADD CONSTRAINT "FuncionarioContratoVinculo_funcionarioId_fkey"
    FOREIGN KEY ("funcionarioId") REFERENCES "Funcionario"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'FuncionarioContratoVinculo_contratoId_fkey'
  ) THEN
    ALTER TABLE "FuncionarioContratoVinculo"
    ADD CONSTRAINT "FuncionarioContratoVinculo_contratoId_fkey"
    FOREIGN KEY ("contratoId") REFERENCES "Contrato"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "FuncionarioContratoVinculo_funcionarioId_idx"
ON "FuncionarioContratoVinculo"("funcionarioId");

CREATE INDEX IF NOT EXISTS "FuncionarioContratoVinculo_contratoId_idx"
ON "FuncionarioContratoVinculo"("contratoId");

CREATE INDEX IF NOT EXISTS "FuncionarioContratoVinculo_ativo_idx"
ON "FuncionarioContratoVinculo"("ativo");

INSERT INTO "FuncionarioContratoVinculo" (
  "funcionarioId",
  "contratoId",
  "tipoVinculo",
  "ativo",
  "dataInicio",
  "dataFim",
  "createdAt",
  "updatedAt"
)
SELECT DISTINCT
  rf."funcionarioId",
  sr."contratoDestinoId",
  'ADICIONAL',
  true,
  COALESCE(sr."dataAprovacao", sr."dataSolicitacao", NOW()),
  NULL::timestamp,
  NOW(),
  NOW()
FROM "SolicitacaoRemanejamento" sr
INNER JOIN "RemanejamentoFuncionario" rf
  ON rf."solicitacaoId" = sr."id"
WHERE sr."tipo" = 'VINCULO_ADICIONAL'
  AND sr."contratoDestinoId" IS NOT NULL
  AND rf."statusPrestserv" = 'VALIDADO'
ON CONFLICT ("funcionarioId", "contratoId")
DO UPDATE SET
  "tipoVinculo" = EXCLUDED."tipoVinculo",
  "ativo" = true,
  "dataFim" = NULL,
  "updatedAt" = NOW();
