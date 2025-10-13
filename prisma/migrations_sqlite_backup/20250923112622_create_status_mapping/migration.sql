-- CreateTable
CREATE TABLE "StatusMapping" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "statusGeral" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "StatusMapping_statusGeral_key" ON "StatusMapping"("statusGeral");

-- CreateIndex
CREATE INDEX "StatusMapping_categoria_idx" ON "StatusMapping"("categoria");

-- CreateIndex
CREATE INDEX "StatusMapping_ativo_idx" ON "StatusMapping"("ativo");
