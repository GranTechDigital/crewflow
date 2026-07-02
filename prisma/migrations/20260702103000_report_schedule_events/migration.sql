DROP INDEX IF EXISTS "public"."RelatorioAgenda_reportKey_key";

ALTER TABLE "public"."RelatorioAgenda"
  ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL DEFAULT 'Agenda de relatório',
  ADD COLUMN IF NOT EXISTS "filters" JSONB;

CREATE INDEX IF NOT EXISTS "RelatorioAgenda_active_frequency_idx"
  ON "public"."RelatorioAgenda"("active", "frequency");

CREATE TABLE IF NOT EXISTS "public"."RelatorioAgendaDestinatario" (
  "id" SERIAL NOT NULL,
  "agendaId" INTEGER NOT NULL,
  "destinatarioId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RelatorioAgendaDestinatario_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RelatorioAgendaDestinatario_agendaId_destinatarioId_key"
  ON "public"."RelatorioAgendaDestinatario"("agendaId", "destinatarioId");

CREATE INDEX IF NOT EXISTS "RelatorioAgendaDestinatario_destinatarioId_idx"
  ON "public"."RelatorioAgendaDestinatario"("destinatarioId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RelatorioAgendaDestinatario_agendaId_fkey'
  ) THEN
    ALTER TABLE "public"."RelatorioAgendaDestinatario"
      ADD CONSTRAINT "RelatorioAgendaDestinatario_agendaId_fkey"
      FOREIGN KEY ("agendaId") REFERENCES "public"."RelatorioAgenda"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RelatorioAgendaDestinatario_destinatarioId_fkey'
  ) THEN
    ALTER TABLE "public"."RelatorioAgendaDestinatario"
      ADD CONSTRAINT "RelatorioAgendaDestinatario_destinatarioId_fkey"
      FOREIGN KEY ("destinatarioId") REFERENCES "public"."RelatorioDestinatario"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

INSERT INTO "public"."RelatorioAgendaDestinatario" ("agendaId", "destinatarioId")
SELECT agenda."id", destinatario."id"
FROM "public"."RelatorioAgenda" agenda
JOIN "public"."RelatorioDestinatario" destinatario
  ON destinatario."reportKey" = agenda."reportKey"
WHERE destinatario."active" = TRUE
  AND destinatario."receivesScheduledEmail" = TRUE
ON CONFLICT ("agendaId", "destinatarioId") DO NOTHING;
