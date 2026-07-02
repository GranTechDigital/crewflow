CREATE TABLE "public"."RelatorioAgenda" (
    "id" SERIAL NOT NULL,
    "reportKey" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "frequency" TEXT NOT NULL DEFAULT 'weekly',
    "weekdays" JSONB,
    "dayOfMonth" INTEGER,
    "timeOfDay" TEXT NOT NULL DEFAULT '17:30',
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "sendEmail" BOOLEAN NOT NULL DEFAULT true,
    "saveSnapshot" BOOLEAN NOT NULL DEFAULT true,
    "lastRunKey" TEXT,
    "lastRunAt" TIMESTAMP(3),
    "lastSnapshotKey" TEXT,
    "lastSnapshotAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RelatorioAgenda_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RelatorioAgenda_reportKey_key" ON "public"."RelatorioAgenda"("reportKey");
CREATE INDEX "RelatorioAgenda_reportKey_active_idx" ON "public"."RelatorioAgenda"("reportKey", "active");
