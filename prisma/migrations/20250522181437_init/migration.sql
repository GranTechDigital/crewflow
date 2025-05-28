-- CreateTable
CREATE TABLE "Contrato" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "numeroContrato" TEXT NOT NULL,
    "nomeContrato" TEXT NOT NULL,
    "dataInicio" DATETIME NOT NULL,
    "dataFim" DATETIME NOT NULL,
    "cliente" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Contrato_numeroContrato_key" ON "Contrato"("numeroContrato");
