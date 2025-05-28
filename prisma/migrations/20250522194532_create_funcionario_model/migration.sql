-- CreateTable
CREATE TABLE "Funcionario" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "matricula" TEXT,
    "cpf" TEXT,
    "nome" TEXT NOT NULL,
    "funcao" TEXT,
    "rg" TEXT,
    "orgao_emissor" TEXT,
    "uf" TEXT,
    "data_nascimento" DATETIME,
    "email" TEXT,
    "telefone" TEXT,
    "centroCusto" TEXT,
    "departamento" TEXT,
    "status" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "Funcionario_cpf_key" ON "Funcionario"("cpf");
