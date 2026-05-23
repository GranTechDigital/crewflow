# Análise de Duplicidade em `Funcao` (IDs 206, 207, 435, 448)

Data da análise: 2026-05-22 (local)  
Ambiente analisado: banco `projetogran` no container `postgres-dev`

## Contexto

Foi identificada duplicidade semântica na tabela `Funcao` para dois pares:

- `206` e `435` (mesma função no mesmo regime)
- `207` e `448` (mesma função no mesmo regime)

Esses pares diferem por variações legadas de texto/slug (incluindo espaços finais e slug antigo), apesar de representarem a mesma função.

## Estrutura relevante

Tabela: `Funcao`  
Índices únicos:

- `("funcao","regime")`
- `("funcao_slug","regime")`

## Registros envolvidos

```text
id=206
regime=OFFSHORE
funcao=>INSPETOR DE SOLDA/END/ EQUIPAMENTOS/ ME  <
funcao_trim=>INSPETOR DE SOLDA/END/ EQUIPAMENTOS/ ME<
funcao_slug=inspetor-de-solda-end-equipamentos-me
createdAt=2025-10-21 13:50:46.424

id=435
regime=OFFSHORE
funcao=>INSPETOR DE SOLDA/END/ EQUIPAMENTOS/ ME<
funcao_trim=>INSPETOR DE SOLDA/END/ EQUIPAMENTOS/ ME<
funcao_slug=inspetor-de-soldaend-equipamentos-me
createdAt=2026-01-13 08:51:58.387

id=207
regime=OFFSHORE
funcao=>INSPETOR DE SOLDA/LP ESCALADOR NI <
funcao_trim=>INSPETOR DE SOLDA/LP ESCALADOR NI<
funcao_slug=inspetor-de-solda-lp-escalador-ni
createdAt=2025-10-21 13:50:46.425

id=448
regime=OFFSHORE
funcao=>INSPETOR DE SOLDA/LP ESCALADOR NI<
funcao_trim=>INSPETOR DE SOLDA/LP ESCALADOR NI<
funcao_slug=inspetor-de-soldalp-escalador-ni
createdAt=2026-01-13 08:51:58.387
updatedAt=2026-05-23 01:50:18.281
```

## Uso atual por tabela vinculada

### 1) Funcionários (`Funcionario.funcaoId`)

- `206`: 2 funcionários vinculados
- `207`: 0 funcionários vinculados
- `435`: 0 funcionários vinculados
- `448`: 1 funcionário vinculado

Funcionário atualmente em `448`:

- `Funcionario.id=3456`
- `matricula=FRI-01-11604`
- `nome=MARVIM QUEIROZ TADIM`
- `funcaoId=448`

### 2) Matriz de Treinamento (`MatrizTreinamento.funcaoId`)

- `206`: 73 registros
- `207`: 68 registros
- `435`: 0 registros
- `448`: 0 registros

## Decisão operacional desejada

Objetivo informado:

- Remover `435`
- Remover `448`
- Antes de remover `448`, migrar referências para `207`

## Plano de ação no banco (ordem sugerida)

1. Validar novamente vínculos de `435` e `448` imediatamente antes da execução.
2. Atualizar `Funcionario.funcaoId` de `448` para `207`.
3. Confirmar que `448` ficou sem referências.
4. Excluir `Funcao.id=448`.
5. Confirmar que `435` segue sem referências.
6. Excluir `Funcao.id=435`.
7. Validar consistência final:
   - nenhum funcionário com `funcaoId IN (435,448)`
   - nenhuma matriz com `funcaoId IN (435,448)`
   - consultas por função/regime retornando apenas o ID canônico.

## Consultas úteis (referência)

```sql
-- Conferir os 4 registros
SELECT id, regime, funcao, funcao_slug, "createdAt", "updatedAt"
FROM "Funcao"
WHERE id IN (206,207,435,448)
ORDER BY id;

-- Contagem de vínculos em Funcionario
SELECT "funcaoId", COUNT(*) AS total
FROM "Funcionario"
WHERE "funcaoId" IN (206,207,435,448)
GROUP BY "funcaoId"
ORDER BY "funcaoId";

-- Contagem de vínculos em MatrizTreinamento
SELECT "funcaoId", COUNT(*) AS total
FROM "MatrizTreinamento"
WHERE "funcaoId" IN (206,207,435,448)
GROUP BY "funcaoId"
ORDER BY "funcaoId";

-- Migração do vínculo 448 -> 207 (Funcionario)
UPDATE "Funcionario"
SET "funcaoId" = 207
WHERE "funcaoId" = 448;

-- Exclusões (somente após checagens)
DELETE FROM "Funcao" WHERE id = 448;
DELETE FROM "Funcao" WHERE id = 435;
```

## Observação importante

Há indícios de legado de normalização em textos de função (ex.: espaços externos e variações antigas de slug).  
Na auditoria atual, também foi detectado que existem registros em `Funcionario.funcao` com espaços externos (`22` casos). Isso reforça que as duplicidades vieram de dados históricos anteriores aos ajustes recentes.

---

## Análise adicional: divergência de regime em `Funcionario.funcaoId`

### Resumo

Foi identificado um conjunto de funcionários com:

- mesmo nome de função entre API externa e banco (após `TRIM + UPPER`)
- porém `funcaoId` apontando para regime diferente do que vem na API

Total encontrado: **108 funcionários**.

Distribuição do regime vindo da API nesses 108:

- `ONSHORE`: 103
- `OFFSHORE`: 5
- `EMPREGADO` vazio na API: 0

### Causa raiz (histórica)

Na lógica antiga da sync de funcionários, a troca de `funcaoId` ocorria apenas quando mudava o **texto da função**.  
Quando o texto era igual e mudava apenas o **regime** (`ONSHORE/OFFSHORE`), o vínculo não era atualizado.

### Situação de migração/processo

Dos 108:

- `emMigracao = true`: 7
- `emMigracao = false`: 101

Inicialmente apareceu “8 com remanejamento aberto”, mas 1 caso era falso positivo de filtro por `statusTarefas` isolado.

Caso fora do padrão (não em migração, mas com remanejamento que parecia aberto):

- `Funcionario.id=231`
- `matricula=FRI-01-4357`
- `nome=ALEXANDRE LIMA BRITO`
- `RemanejamentoFuncionario.id=cmmnst0q3005ima0qqfnscv0k`
- `statusTarefas=ATENDER TAREFAS`
- `statusPrestserv=CANCELADO`

Observação: como `statusPrestserv` está `CANCELADO`, esse remanejamento não deve ser tratado como processo aberto real.

### Exemplo representativo

- `matricula=FRI-01-10681`
- função: `TECNICO DE MECANICA` (mesmo texto)
- regime API: `OFFSHORE`
- regime do `funcaoId` no banco: `ONSHORE`

### Impacto prático

- Não é perda de referência na inserção de novos funcionários.
- É divergência de referência em funcionários já existentes (vínculo para o `funcaoId` de regime errado).

### Ajuste de código já aplicado (local)

A sync foi ajustada para atualizar `funcaoId` também quando:

1. muda a função (texto), **ou**
2. muda apenas o regime, **ou**
3. `funcaoId` está ausente.

Além disso, o retorno da sync agora inclui `funcoesCriadas`.

### Plano de ajuste no banco (quando decidirem executar)

1. Rodar a sync com a regra nova em ambiente controlado.
2. Recontar divergências de regime (`funcaoId` x API).
3. Para eventuais remanescentes:
   - recalcular `funcaoId` por (`slug da função normalizada`, `regime da API`)
   - atualizar `Funcionario.funcaoId`
4. Revalidar:
   - nenhum funcionário com função igual e regime divergente
   - sem quebra de remanejamentos em andamento/cancelados.

