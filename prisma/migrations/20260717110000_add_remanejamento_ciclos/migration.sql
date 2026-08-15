CREATE TABLE IF NOT EXISTS "public"."RemanejamentoCiclo" (
  "id" TEXT NOT NULL,
  "remanejamentoFuncionarioId" TEXT NOT NULL,
  "numeroCiclo" INTEGER NOT NULL,
  "setor" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ABERTO',
  "origem" TEXT NOT NULL DEFAULT 'SISTEMA',
  "confianca" TEXT NOT NULL DEFAULT 'ALTA',
  "inicioAt" TIMESTAMP(3) NOT NULL,
  "prazoPrevistoAt" TIMESTAMP(3),
  "conclusaoAt" TIMESTAMP(3),
  "cancelamentoAt" TIMESTAMP(3),
  "motivoAbertura" TEXT,
  "motivoFechamento" TEXT,
  "criadoPorEventoId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RemanejamentoCiclo_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."RemanejamentoCicloEvento" (
  "id" SERIAL NOT NULL,
  "cicloId" TEXT NOT NULL,
  "remanejamentoFuncionarioId" TEXT NOT NULL,
  "tipo" TEXT NOT NULL,
  "dataEvento" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "origem" TEXT NOT NULL DEFAULT 'SISTEMA',
  "dados" JSONB,
  "usuarioResponsavelId" INTEGER,
  "tarefaId" TEXT,
  "historicoRemanejamentoId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RemanejamentoCicloEvento_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RemanejamentoCiclo_remanejamentoFuncionarioId_numeroCiclo_setor_key"
  ON "public"."RemanejamentoCiclo"("remanejamentoFuncionarioId", "numeroCiclo", "setor");

CREATE INDEX IF NOT EXISTS "RemanejamentoCiclo_remanejamentoFuncionarioId_idx"
  ON "public"."RemanejamentoCiclo"("remanejamentoFuncionarioId");

CREATE INDEX IF NOT EXISTS "RemanejamentoCiclo_numeroCiclo_idx"
  ON "public"."RemanejamentoCiclo"("numeroCiclo");

CREATE INDEX IF NOT EXISTS "RemanejamentoCiclo_setor_idx"
  ON "public"."RemanejamentoCiclo"("setor");

CREATE INDEX IF NOT EXISTS "RemanejamentoCiclo_status_idx"
  ON "public"."RemanejamentoCiclo"("status");

CREATE INDEX IF NOT EXISTS "RemanejamentoCiclo_origem_idx"
  ON "public"."RemanejamentoCiclo"("origem");

CREATE INDEX IF NOT EXISTS "RemanejamentoCicloEvento_cicloId_dataEvento_idx"
  ON "public"."RemanejamentoCicloEvento"("cicloId", "dataEvento");

CREATE INDEX IF NOT EXISTS "RemanejamentoCicloEvento_remanejamentoFuncionarioId_dataEvento_idx"
  ON "public"."RemanejamentoCicloEvento"("remanejamentoFuncionarioId", "dataEvento");

CREATE INDEX IF NOT EXISTS "RemanejamentoCicloEvento_tipo_idx"
  ON "public"."RemanejamentoCicloEvento"("tipo");

CREATE INDEX IF NOT EXISTS "RemanejamentoCicloEvento_tarefaId_idx"
  ON "public"."RemanejamentoCicloEvento"("tarefaId");

CREATE INDEX IF NOT EXISTS "RemanejamentoCicloEvento_historicoRemanejamentoId_idx"
  ON "public"."RemanejamentoCicloEvento"("historicoRemanejamentoId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RemanejamentoCiclo_remanejamentoFuncionarioId_fkey'
  ) THEN
    ALTER TABLE "public"."RemanejamentoCiclo"
      ADD CONSTRAINT "RemanejamentoCiclo_remanejamentoFuncionarioId_fkey"
      FOREIGN KEY ("remanejamentoFuncionarioId") REFERENCES "public"."RemanejamentoFuncionario"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RemanejamentoCicloEvento_cicloId_fkey'
  ) THEN
    ALTER TABLE "public"."RemanejamentoCicloEvento"
      ADD CONSTRAINT "RemanejamentoCicloEvento_cicloId_fkey"
      FOREIGN KEY ("cicloId") REFERENCES "public"."RemanejamentoCiclo"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RemanejamentoCicloEvento_remanejamentoFuncionarioId_fkey'
  ) THEN
    ALTER TABLE "public"."RemanejamentoCicloEvento"
      ADD CONSTRAINT "RemanejamentoCicloEvento_remanejamentoFuncionarioId_fkey"
      FOREIGN KEY ("remanejamentoFuncionarioId") REFERENCES "public"."RemanejamentoFuncionario"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RemanejamentoCicloEvento_usuarioResponsavelId_fkey'
  ) THEN
    ALTER TABLE "public"."RemanejamentoCicloEvento"
      ADD CONSTRAINT "RemanejamentoCicloEvento_usuarioResponsavelId_fkey"
      FOREIGN KEY ("usuarioResponsavelId") REFERENCES "public"."Usuario"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RemanejamentoCicloEvento_tarefaId_fkey'
  ) THEN
    ALTER TABLE "public"."RemanejamentoCicloEvento"
      ADD CONSTRAINT "RemanejamentoCicloEvento_tarefaId_fkey"
      FOREIGN KEY ("tarefaId") REFERENCES "public"."TarefaRemanejamento"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RemanejamentoCicloEvento_historicoRemanejamentoId_fkey'
  ) THEN
    ALTER TABLE "public"."RemanejamentoCicloEvento"
      ADD CONSTRAINT "RemanejamentoCicloEvento_historicoRemanejamentoId_fkey"
      FOREIGN KEY ("historicoRemanejamentoId") REFERENCES "public"."HistoricoRemanejamento"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
