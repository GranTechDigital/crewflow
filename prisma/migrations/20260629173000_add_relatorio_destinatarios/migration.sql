CREATE TABLE "public"."RelatorioDestinatario" (
    "id" SERIAL NOT NULL,
    "reportKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "receivesScheduledEmail" BOOLEAN NOT NULL DEFAULT true,
    "canRequestByEmail" BOOLEAN NOT NULL DEFAULT false,
    "frequency" TEXT NOT NULL DEFAULT 'weekly',
    "lastSentAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RelatorioDestinatario_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RelatorioDestinatario_reportKey_email_key" ON "public"."RelatorioDestinatario"("reportKey", "email");
CREATE INDEX "RelatorioDestinatario_reportKey_active_idx" ON "public"."RelatorioDestinatario"("reportKey", "active");
CREATE INDEX "RelatorioDestinatario_email_idx" ON "public"."RelatorioDestinatario"("email");
