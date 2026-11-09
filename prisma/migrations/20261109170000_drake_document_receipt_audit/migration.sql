CREATE TABLE "DrakeDocumentoTentativaRecebimento" (
  id UUID PRIMARY KEY,
  ambiente TEXT NOT NULL CHECK (ambiente IN ('hmg','prd')),
  rota TEXT NOT NULL,
  "httpStatus" INTEGER NOT NULL CHECK ("httpStatus" BETWEEN 100 AND 599),
  codigo TEXT NOT NULL,
  "tamanhoCorpo" INTEGER NOT NULL CHECK ("tamanhoCorpo" >= 0 AND "tamanhoCorpo" <= 65536),
  "hashCorpo" TEXT,
  "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "DrakeDocumentoTentativaRecebimento_ambiente_criado_idx"
  ON "DrakeDocumentoTentativaRecebimento" (ambiente, "criadoEm");
CREATE INDEX "DrakeDocumentoTentativaRecebimento_codigo_criado_idx"
  ON "DrakeDocumentoTentativaRecebimento" (codigo, "criadoEm");
