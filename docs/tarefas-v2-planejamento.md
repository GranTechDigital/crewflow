# Planejamento Tarefas V2

## Objetivo
Entregar uma versao de tarefas mais leve e performatica sem alterar o fluxo atual em producao.

## Estrategia
1. Isolar rota e API V2.
2. Medir performance (latencia e volume).
3. Validar com rollout gradual.
4. Migrar comportamentos do legado por etapas.

## Entregue nesta etapa
1. Nova API: `GET /api/v2/tarefas`.
2. Nova pagina: `/tarefas-v2`.
3. Atalhos no menu com label `V2 (Beta)`.
4. Reducao de payload no endpoint V2 para apenas campos exibidos na tela.
5. Ignorar busca textual com menos de 2 caracteres para evitar full scan sem valor.
6. Cancelamento de requests anteriores no frontend V2 quando filtros mudam rapido.
7. API V2 hierarquica por funcionario:
- `GET /api/v2/tarefas-hierarquia`
- `GET /api/v2/tarefas-hierarquia/:remanejamentoId/tarefas`
8. API de apoio para filtros:
- `GET /api/v2/tarefas-filtros`
9. Tela V2 hierarquica com carregamento progressivo:
- Resumo por funcionario (paginado)
- Tarefas sob demanda ao expandir linha
- Operacoes: criar, editar, concluir, excluir (admin), observacoes, aprovacao RH em lote

## Escopo da API V2 atual
1. Payload enxuto para listagem.
2. Filtros essenciais:
- `q` (nome, matricula, tipo, descricao)
- `status`
- `prioridade`
- `responsavel`
3. Paginacao por cursor (`cursor` + `limit`).
4. Metricas no retorno (`durationMs`, `hasMore`).

## Principios de performance aplicados
1. Consulta partindo de `TarefaRemanejamento` (modelo focado em leitura da tela).
2. `select` minimo de campos.
3. Eliminacao de processamento pesado no cliente.
4. Sem acoplamento com fluxos legados de aprovacao/observacoes nesta fase.

## Proximas fases recomendadas
1. Fase 2: acoes de tarefa (concluir/editar) na V2.
2. Fase 3: observacoes de tarefa na V2.
3. Fase 4: graficos e indicadores da V2.
4. Fase 5: migracao do remanejamento para V2 seguindo o mesmo padrao.

## Rollout sugerido
1. Semana 1: Beta para time interno (Logistica + lideranca).
2. Semana 2: 20% dos usuarios de setores.
3. Semana 3: 50% dos usuarios.
4. Semana 4: 100% + congelamento da tela antiga.

## Critérios de sucesso
1. Tempo de resposta do endpoint V2 menor que endpoint legado.
2. Tempo de abertura da tela menor que legado.
3. Sem regressao funcional para operacoes essenciais.
