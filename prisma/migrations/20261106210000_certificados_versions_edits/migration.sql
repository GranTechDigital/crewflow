CREATE TABLE "DrakeCertificadoVersao" (
  id UUID PRIMARY KEY,
  "anteriorId" INTEGER NOT NULL UNIQUE REFERENCES "ImportacaoCertificadoDrake"(id) ON DELETE RESTRICT,
  "novaId" INTEGER NOT NULL UNIQUE REFERENCES "ImportacaoCertificadoDrake"(id) ON DELETE RESTRICT,
  "usuarioId" INTEGER NOT NULL, "usuarioNome" TEXT NOT NULL,
  "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DrakeCertificadoVersao_ordem_check" CHECK ("novaId" > "anteriorId")
);
CREATE TABLE "DrakeCertificadoCarregamentoNota" (
  "raizId" INTEGER PRIMARY KEY REFERENCES "ImportacaoCertificadoDrake"(id) ON DELETE RESTRICT,
  texto TEXT NOT NULL DEFAULT '', "usuarioId" INTEGER NOT NULL, "usuarioNome" TEXT NOT NULL,
  "atualizadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "DrakeCertificadoItemEdicao" (
  id UUID PRIMARY KEY, "itemId" INTEGER NOT NULL REFERENCES "ImportacaoCertificadoDrakeItem"(id) ON DELETE RESTRICT,
  "usuarioId" INTEGER NOT NULL, "usuarioNome" TEXT NOT NULL,
  anterior JSONB NOT NULL, novo JSONB NOT NULL,
  "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "DrakeCertificadoItemEdicao_item_criado_idx" ON "DrakeCertificadoItemEdicao"("itemId","criadoEm");
