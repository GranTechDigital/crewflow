-- Evitar duplicação de tarefas por concorrência criando chave única composta
-- Pré-requisito: deduplicar dados existentes antes de aplicar em ambientes com duplicatas

DO $$
BEGIN
  -- Criar índice único para (remanejamentoFuncionarioId, tipo, responsavel)
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i'
      AND c.relname = 'TarefaRemanejamento_rem_tipo_resp_key'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX "TarefaRemanejamento_rem_tipo_resp_key" ON "TarefaRemanejamento" ("remanejamentoFuncionarioId", "tipo", "responsavel")';
  END IF;
END $$;