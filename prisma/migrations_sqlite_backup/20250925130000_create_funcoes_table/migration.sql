-- CreateTable: Funcao
-- Recria a tabela de funções com campos básicos e índices úteis

CREATE TABLE IF NOT EXISTS "Funcao" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "funcao" TEXT NOT NULL UNIQUE,
    "regime" TEXT,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Funcao_funcao_idx" ON "Funcao"("funcao");
CREATE INDEX IF NOT EXISTS "Funcao_regime_idx" ON "Funcao"("regime");