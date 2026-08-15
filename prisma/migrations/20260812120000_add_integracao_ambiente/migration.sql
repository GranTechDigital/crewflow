ALTER TABLE "IntegracaoOutbox"
ADD COLUMN "ambiente" TEXT NOT NULL DEFAULT 'dev';

ALTER TABLE "IntegracaoSessao"
ADD COLUMN "ambiente" TEXT NOT NULL DEFAULT 'dev';

CREATE INDEX "IntegracaoOutbox_provedor_ambiente_status_idx"
ON "IntegracaoOutbox"("provedor", "ambiente", "status");
