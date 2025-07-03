-- Script para limpar e padronizar setores no banco de dados
-- Execute este script para padronizar os setores para apenas RH, MEDICINA e TREINAMENTO

-- 1. Atualizar tarefas com setores não padronizados
UPDATE Tarefa 
SET responsavel = CASE 
    WHEN UPPER(responsavel) LIKE '%RH%' OR UPPER(responsavel) LIKE '%RECURSOS%HUMANOS%' THEN 'RH'
    WHEN UPPER(responsavel) LIKE '%MEDIC%' OR UPPER(responsavel) LIKE '%SAUDE%' THEN 'MEDICINA'
    WHEN UPPER(responsavel) LIKE '%TREIN%' OR UPPER(responsavel) LIKE '%CAPACIT%' THEN 'TREINAMENTO'
    ELSE 'RH' -- Default para RH se não conseguir identificar
END
WHERE responsavel NOT IN ('RH', 'MEDICINA', 'TREINAMENTO');

-- 2. Verificar se existem tarefas com setores diferentes dos padrão
SELECT DISTINCT responsavel, COUNT(*) as quantidade
FROM Tarefa 
GROUP BY responsavel
ORDER BY responsavel;

-- 3. Opcional: Remover tarefas órfãs ou com dados inconsistentes
-- DELETE FROM Tarefa WHERE responsavel IS NULL OR responsavel = '';

-- 4. Verificação final - deve mostrar apenas RH, MEDICINA e TREINAMENTO
SELECT 
    responsavel as setor,
    COUNT(*) as total_tarefas,
    SUM(CASE WHEN status = 'CONCLUIDO' THEN 1 ELSE 0 END) as concluidas,
    ROUND(
        (SUM(CASE WHEN status = 'CONCLUIDO' THEN 1 ELSE 0 END) * 100.0 / COUNT(*)), 
        2
    ) as percentual_conclusao
FROM Tarefa 
GROUP BY responsavel
ORDER BY responsavel;