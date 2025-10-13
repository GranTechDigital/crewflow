-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MatrizTreinamento" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "contratoId" INTEGER NOT NULL,
    "funcaoId" INTEGER NOT NULL,
    "treinamentoId" INTEGER,
    "tipoObrigatoriedade" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MatrizTreinamento_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "Contrato" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MatrizTreinamento_funcaoId_fkey" FOREIGN KEY ("funcaoId") REFERENCES "Funcao" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MatrizTreinamento_treinamentoId_fkey" FOREIGN KEY ("treinamentoId") REFERENCES "Treinamentos" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_MatrizTreinamento" ("ativo", "contratoId", "createdAt", "funcaoId", "id", "tipoObrigatoriedade", "treinamentoId", "updatedAt") SELECT "ativo", "contratoId", "createdAt", "funcaoId", "id", "tipoObrigatoriedade", "treinamentoId", "updatedAt" FROM "MatrizTreinamento";
DROP TABLE "MatrizTreinamento";
ALTER TABLE "new_MatrizTreinamento" RENAME TO "MatrizTreinamento";
CREATE INDEX "MatrizTreinamento_contratoId_idx" ON "MatrizTreinamento"("contratoId");
CREATE INDEX "MatrizTreinamento_funcaoId_idx" ON "MatrizTreinamento"("funcaoId");
CREATE INDEX "MatrizTreinamento_treinamentoId_idx" ON "MatrizTreinamento"("treinamentoId");
CREATE INDEX "MatrizTreinamento_tipoObrigatoriedade_idx" ON "MatrizTreinamento"("tipoObrigatoriedade");
CREATE UNIQUE INDEX "MatrizTreinamento_contratoId_funcaoId_treinamentoId_key" ON "MatrizTreinamento"("contratoId", "funcaoId", "treinamentoId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
