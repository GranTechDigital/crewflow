-- CreateTable
CREATE TABLE "Pendencia" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "funcionarioId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "descricao" TEXT,
    "equipe" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pendente',
    "prioridade" TEXT NOT NULL DEFAULT 'Média',
    "dataCriacao" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataAtualizacao" DATETIME NOT NULL,
    "dataLimite" DATETIME,
    "dataConclusao" DATETIME,
    "criadoPor" TEXT NOT NULL,
    "atualizadoPor" TEXT NOT NULL,
    CONSTRAINT "Pendencia_funcionarioId_fkey" FOREIGN KEY ("funcionarioId") REFERENCES "Funcionario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ObservacaoPendencia" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "pendenciaId" INTEGER NOT NULL,
    "texto" TEXT NOT NULL,
    "dataCriacao" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataModificacao" DATETIME NOT NULL,
    "criadoPor" TEXT NOT NULL,
    "modificadoPor" TEXT NOT NULL,
    CONSTRAINT "ObservacaoPendencia_pendenciaId_fkey" FOREIGN KEY ("pendenciaId") REFERENCES "Pendencia" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
