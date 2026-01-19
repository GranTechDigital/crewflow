DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'ObservacaoRemanejamentoFuncionario'
  ) THEN
    CREATE TABLE "public"."ObservacaoRemanejamentoFuncionario" (
      "id" SERIAL NOT NULL,
      "remanejamentoFuncionarioId" TEXT NOT NULL,
      "texto" TEXT NOT NULL,
      "dataCriacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "dataModificacao" TIMESTAMP(3) NOT NULL,
      "criadoPor" TEXT NOT NULL,
      "modificadoPor" TEXT NOT NULL,
      CONSTRAINT "ObservacaoRemanejamentoFuncionario_pkey" PRIMARY KEY ("id")
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "ObservacaoRemanejamentoFuncionario_remanejamentoFuncionarioId_idx"
  ON "public"."ObservacaoRemanejamentoFuncionario" ("remanejamentoFuncionarioId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'ObservacaoRemanejamentoFuncionario'
      AND constraint_name = 'ObservacaoRemanejamentoFuncionario_remanejamentoFuncionarioId_fkey'
  ) THEN
    ALTER TABLE "public"."ObservacaoRemanejamentoFuncionario"
      ADD CONSTRAINT "ObservacaoRemanejamentoFuncionario_remanejamentoFuncionarioId_fkey"
      FOREIGN KEY ("remanejamentoFuncionarioId") REFERENCES "public"."RemanejamentoFuncionario"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

INSERT INTO "public"."ObservacaoRemanejamentoFuncionario"
  ("remanejamentoFuncionarioId", "texto", "dataCriacao", "dataModificacao", "criadoPor", "modificadoPor")
SELECT
  rf."id" AS "remanejamentoFuncionarioId",
  rf."observacoesPrestserv" AS "texto",
  NOW() AS "dataCriacao",
  NOW() AS "dataModificacao",
  'Sistema' AS "criadoPor",
  'Sistema' AS "modificadoPor"
FROM "public"."RemanejamentoFuncionario" rf
WHERE rf."observacoesPrestserv" IS NOT NULL
  AND btrim(rf."observacoesPrestserv") <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM "public"."ObservacaoRemanejamentoFuncionario" o
    WHERE o."remanejamentoFuncionarioId" = rf."id"
  );
