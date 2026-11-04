ALTER TABLE "SispatImportacao"
  ADD COLUMN "criadoPorNome" TEXT,
  ADD COLUMN "restauradoPorNome" TEXT,
  ADD COLUMN "alertas" JSONB NOT NULL DEFAULT '[]';

UPDATE "SispatImportacao" AS i SET "criadoPorNome" = f."nome"
FROM "Usuario" AS u JOIN "Funcionario" AS f ON f."id" = u."funcionarioId"
WHERE u."id" = i."criadoPorId";

UPDATE "SispatImportacao" AS i SET "restauradoPorNome" = f."nome"
FROM "Usuario" AS u JOIN "Funcionario" AS f ON f."id" = u."funcionarioId"
WHERE u."id" = i."restauradoPorId";
