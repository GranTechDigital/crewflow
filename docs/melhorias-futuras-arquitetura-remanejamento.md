# Melhorias Futuras - Arquitetura de Remanejamento e Gatilhos

Este documento registra melhorias recomendadas para evoluir a arquitetura do fluxo de remanejamento, tarefas, matriz, logistica, ciclos e futuras integracoes.

O objetivo nao e alterar o processo atual imediatamente. O processo atual funciona e deve ser preservado enquanto a nova camada de ciclos e validada com dados reais.

## Diretriz principal

Prioridade atual:

1. manter o fluxo operacional funcionando;
2. registrar ciclos de forma paralela e auditavel;
3. comparar ciclos novos com relatorios e historicos existentes;
4. corrigir arquitetura aos poucos, sem troca brusca do processo;
5. so integrar sistemas externos depois que a camada interna estiver confiavel.

## Diagnostico atual

Hoje os gatilhos de negocio estao espalhados entre varias rotas e servicos:

- aprovacao inicial gera tarefas;
- conclusao de tarefa recalcula status geral;
- sincronizacao de matriz cria, cancela e reativa tarefas;
- logistica muda `statusPrestserv`;
- algumas rotas registram historico;
- outras ajustam observacoes;
- agora tambem existe reconciliacao dos ciclos.

Isso funciona, mas torna dificil garantir que todos os efeitos colaterais acontecam sempre.

Risco principal:

- uma rota atualizar status sem chamar os mesmos efeitos colaterais de outra rota;
- regra duplicada divergir com o tempo;
- auditoria depender de inferencia;
- integracao externa receber evento incompleto ou fora de ordem.

## Melhorias recomendadas

### 1. Criar um servico unico de workflow

Criar um servico central, por exemplo:

```txt
src/lib/remanejamentoWorkflow.ts
```

Responsabilidade:

- concentrar transicoes de estado do remanejamento;
- atualizar tarefas;
- recalcular status geral;
- registrar historico;
- registrar observacoes relevantes;
- reconciliar ciclos;
- emitir eventos internos para integracoes futuras.

Exemplos de funcoes:

```ts
await workflow.aprovarSolicitacao(remanejamentoId, usuarioId);
await workflow.concluirTarefa(tarefaId, usuarioId);
await workflow.cancelarTarefa(tarefaId, usuarioId, motivo);
await workflow.sincronizarMatriz(remanejamentoId, usuarioId);
await workflow.enviarParaLogistica(remanejamentoId, usuarioId);
await workflow.devolverParaSetor(remanejamentoId, usuarioId, motivo);
await workflow.validarLogistica(remanejamentoId, usuarioId);
await workflow.cancelarProcesso(remanejamentoId, usuarioId, motivo);
```

Beneficio:

- rotas ficam mais simples;
- regra fica centralizada;
- menos risco de um gatilho esquecer uma etapa;
- ciclos e integracoes passam a ouvir o mesmo ponto de verdade.

### 2. Padronizar status internos

Hoje muitos status sao textos soltos:

- `ATENDER TAREFAS`;
- `SUBMETER RASCUNHO`;
- `CRIADO`;
- `VALIDADO`;
- `INVALIDADO`;
- `CANCELADO`;
- variacoes antigas ou equivalentes.

Melhoria:

- criar constantes ou enums internos;
- criar normalizadores oficiais;
- evitar comparacao manual de string em varias rotas;
- manter compatibilidade com dados antigos.

Exemplo:

```ts
export const StatusTarefas = {
  APROVAR_SOLICITACAO: "APROVAR SOLICITAÇÃO",
  ATENDER_TAREFAS: "ATENDER TAREFAS",
  SUBMETER_RASCUNHO: "SUBMETER RASCUNHO",
  CONCLUIDO: "CONCLUIDO",
  CANCELADO: "CANCELADO",
} as const;
```

Beneficio:

- menos erro por acento, espaco ou variacao textual;
- regra mais legivel;
- migracoes futuras mais seguras.

### 3. Separar estado atual de evento ocorrido

O estado atual mostra onde o processo esta agora.

O evento mostra o que aconteceu e quando aconteceu.

Eventos recomendados:

- `SOLICITACAO_APROVADA`;
- `TAREFAS_GERADAS`;
- `TAREFA_CONCLUIDA`;
- `TAREFA_CANCELADA`;
- `TAREFA_REATIVADA`;
- `MATRIZ_SINCRONIZADA`;
- `PROCESSO_ENVIADO_LOGISTICA`;
- `LOGISTICA_DEVOLVEU`;
- `LOGISTICA_VALIDOU`;
- `PROCESSO_CANCELADO`;
- `CICLO_ABERTO`;
- `CICLO_CONCLUIDO`;
- `CICLO_CANCELADO`.

Beneficio:

- auditoria fica mais confiavel;
- relatorios conseguem explicar a historia do processo;
- backfill e comparacao ficam mais simples;
- integracoes podem consumir eventos sem depender de inferencia.

### 4. Usar transacoes nas acoes compostas

Algumas acoes mudam varias tabelas:

- tarefa;
- remanejamento;
- historico;
- observacao;
- ciclo;
- futuro outbox de integracao.

Melhoria:

- encapsular essas acoes em `prisma.$transaction`;
- evitar estado parcial quando uma etapa falha;
- manter a reconciliacao de ciclos segura.

Observacao:

- integracoes externas nao devem rodar dentro da transacao principal;
- a transacao deve gravar o fato interno;
- o envio externo deve ocorrer depois, via outbox/worker.

### 5. Criar outbox para integracoes externas

Para Drake e futuras integracoes, evitar chamada direta de webhook dentro da rota principal.

Criar tabela de eventos pendentes, por exemplo:

```txt
IntegrationOutbox
```

Campos sugeridos:

- `id`;
- `provider`;
- `eventType`;
- `aggregateType`;
- `aggregateId`;
- `payload`;
- `status`;
- `tentativas`;
- `ultimoErro`;
- `createdAt`;
- `processadoAt`.

Fluxo:

1. Crew executa regra interna;
2. Crew grava evento na outbox;
3. worker envia para sistema externo;
4. se falhar, reprocessa;
5. se concluir, marca como processado.

Beneficio:

- falha do Drake nao quebra o Crew;
- envio pode ser reprocessado;
- existe trilha de auditoria;
- fica preparado para outros provedores alem do Drake.

### 6. Reduzir regra de negocio dentro das rotas

Rotas devem preferencialmente:

- autenticar;
- validar entrada;
- chamar servico de dominio;
- retornar resposta.

Evitar:

- recalcular status inteiro dentro da rota;
- duplicar regra de matriz;
- duplicar regra de fechamento;
- chamar integracao externa diretamente.

### 7. Criar configuracao de parametros operacionais

Alguns prazos e regras hoje precisam comecar como constantes para permitir a validacao da camada de ciclos, mas o correto e evoluir para uma configuracao administrativa.

Parametros iniciais candidatos:

- prazo da fase de solicitacao/aprovacao: inicialmente 5 dias;
- prazo da avaliacao da Logistica: inicialmente 7 dias;
- prazos padrao por setor quando nao houver `dataLimite` nas tarefas;
- regras de prioridade e vencimento exibidas nas paginas de auditoria;
- parametros futuros de integracao externa, sem expor token ou segredo na tela operacional.

Melhoria sugerida:

- criar uma tabela de parametros por chave/valor, com historico de alteracao;
- criar uma pagina administrativa simples para RH/Logistica ou administradores ajustarem prazos;
- versionar a leitura desses parametros na camada de workflow/ciclos;
- manter fallback seguro em codigo caso o parametro nao exista.

Beneficio:

- reduz necessidade de deploy para ajustar regra operacional;
- deixa claro quem alterou prazos e quando;
- evita prazo fixo espalhado no codigo;
- prepara o Crew para regras diferentes por contrato, setor ou tipo de solicitacao.

Beneficio:

- rotas menores;
- testes mais simples;
- menos divergencia entre endpoints.

### 7. Melhorar rastreabilidade dos motivos

Para cada transicao relevante, registrar:

- usuario responsavel;
- data/hora;
- motivo tecnico;
- motivo de negocio;
- origem do gatilho;
- tarefa relacionada, quando houver;
- matriz/padrao relacionado, quando houver.

Exemplos de origem:

- `USUARIO`;
- `MATRIZ_SYNC`;
- `TAREFA_PADRAO_SYNC`;
- `DEDUP`;
- `BACKFILL`;
- `RECONCILIACAO_ADMIN`;
- `SISTEMA`.

Beneficio:

- o auditor entende por que o ciclo existe;
- treinamento/logistica conseguem explicar a fila;
- a integracao externa recebe contexto melhor.

### 8. Criar testes focados de workflow

Criar testes para cenarios criticos:

- aprovacao inicial gera ciclos de RH, Medicina e Treinamento;
- todas as tarefas concluidas enviam para Logistica;
- ultima tarefa pendente cancelada fecha setor sem pendencia ativa;
- matriz cria nova tarefa apos setor fechado e abre novo ciclo;
- Logistica devolve e abre ciclo de correcao;
- Logistica valida e fecha processo;
- processo cancelado cancela ciclos abertos sem apagar historico.

Beneficio:

- reduz medo de mexer no processo;
- permite refatorar aos poucos;
- protege regras que hoje estao implicitas.

## Caminho incremental sugerido

### Fase 1 - Observar sem substituir

- manter processo atual;
- registrar ciclos;
- criar endpoints de auditoria;
- reconciliar amostras reais;
- comparar com relatorios existentes.

### Fase 2 - Centralizar sem mudar comportamento

- criar `remanejamentoWorkflow`;
- mover uma rota por vez para o servico;
- manter as mesmas respostas e status atuais;
- validar com testes e dados reais.

### Fase 3 - Fortalecer eventos internos

- padronizar eventos de dominio;
- melhorar historico;
- reduzir inferencias;
- enriquecer ciclos com causas claras.

### Fase 4 - Preparar integracoes

- criar outbox;
- mapear eventos internos para eventos externos;
- implementar worker;
- testar reprocessamento.

### Fase 5 - Integrar Drake

- enviar eventos adicionais a partir da outbox;
- manter idempotencia por external id;
- registrar payload, resposta e erros;
- habilitar gradualmente.

## O que evitar agora

- reescrever todo o fluxo de remanejamento de uma vez;
- trocar status existentes antes de validar os ciclos;
- chamar Drake diretamente dentro das rotas;
- remover historicos/tabelas antigas;
- depender apenas de numero do ciclo para explicar o processo;
- assumir que uma sequencia fixa de ciclos sempre acontece.

## Decisao atual

Seguiremos com a camada de ciclos como trilha paralela e auditavel.

Melhorias estruturais devem ser feitas incrementalmente, com prioridade para:

1. confiabilidade operacional;
2. rastreabilidade;
3. idempotencia;
4. comparacao com dados antigos;
5. integracao externa apenas depois da validacao interna.
