# Planejamento: integracao Drake para eventos adicionais de cadastro

## Objetivo

Enviar para o Drake o acompanhamento dos setores envolvidos no cadastro/remanejamento de funcionarios no Prestserv, usando eventos adicionais.

O Crew continua sendo a origem do fluxo operacional. O Drake passa a receber os eventos para consolidar acompanhamento e relatorios.

## Escopo inicial

Integrar apenas eventos adicionais de cadastro:

- Cadastro RH
- Cadastro Medicina
- Cadastro Treinamento
- Cadastro Logistica

Fora do escopo inicial:

- envio de centro de custo;
- escolha dinamica de SLA da Logistica;
- outros tipos de evento alem de cadastro;
- alteracao estrutural do fluxo operacional atual do Crew.

## Documentacao Drake

Endpoint de referencia:

- `SyncAdditionalEvent`
- base homologacao: `https://hmg.drake.bz`
- path usado para evento adicional: `/api/v2/Integration/Sync/SyncAdditionalEvent`
- URL da documentacao: https://sapiensia.atlassian.net/wiki/spaces/SIA/pages/3333652613/SyncAdditionalEvent

Tipo de ocorrencia:

- `SyncOccurrenceType`
- A documentacao indica seletores como `Id`, `ExternalId`, `Identifier`, `Acronym` e `ExternalCode`.
- Validado em HMG: usar `Identifier`.

## Credenciais

O Drake forneceu:

- `tenantId`
- token `Bearer`

Variaveis de ambiente propostas:

```env
DRAKE_API_BASE_URL=https://hmg.drake.bz
DRAKE_SYNC_PATH=/api/v2/Integration/Sync/SyncAdditionalEvent
DRAKE_TENANT_ID=
DRAKE_TENANT_HEADER_NAME=X-SAPIENSIA-TenantId
DRAKE_AUTH_HEADER_NAME=Authorization
DRAKE_OCCURRENCE_TYPE_IDENTIFIER_RH=MCD
DRAKE_OCCURRENCE_TYPE_IDENTIFIER_MEDICINA=MCMD
DRAKE_OCCURRENCE_TYPE_IDENTIFIER_TREINAMENTO=MCTR
DRAKE_OCCURRENCE_TYPE_IDENTIFIER_LOGISTICA=MCLG
DRAKE_API_KEY=
DRAKE_ENVIRONMENT=prod
DRAKE_TIMEOUT_MS=30000
DRAKE_WEBHOOK_ENABLED=false
```

Header do tenant informado:

- `X-SAPIENSIA-TenantId`

O `DRAKE_API_KEY` deve ser enviado como Bearer token:

```http
Authorization: Bearer {DRAKE_API_KEY}
X-SAPIENSIA-TenantId: {DRAKE_TENANT_ID}
Content-Type: application/json
```

## Tipo de ocorrencia

O tipo de ocorrencia validado no Drake HMG usa seletor por `Identifier`.

| Setor Crew | Identifier atual |
| --- | --- |
| RH | MCD |
| Medicina | MCMD |
| Treinamento | MCTR |
| Logistica | MCLG |

Configurar por ambiente:

```env
DRAKE_OCCURRENCE_TYPE_IDENTIFIER_RH=MCD
DRAKE_OCCURRENCE_TYPE_IDENTIFIER_MEDICINA=MCMD
DRAKE_OCCURRENCE_TYPE_IDENTIFIER_TREINAMENTO=MCTR
DRAKE_OCCURRENCE_TYPE_IDENTIFIER_LOGISTICA=MCLG
```

## Identificacao do trabalhador

O `Worker` sera selecionado pela matricula do funcionario no Crew.

Exemplo conceitual:

```json
{
  "Worker": {
    "Selector": {
      "Registration": "FRI-01-00000"
    }
  }
}
```

Pendente validar na documentacao/ambiente Drake se o campo correto do seletor e `Registration`, `Identifier`, `ExternalId` ou outro nome equivalente.

## ExternalId do evento adicional

O `ExternalId` sera gerado pelo Crew e usado para idempotencia. O mesmo `ExternalId` deve ser reenviado quando precisarmos atualizar o evento no Drake.

Formato proposto:

```txt
crew:cadastro:{ambiente}:{remanejamentoFuncionarioId}:ciclo:{ciclo}:setor:{setor}
```

Exemplo:

```txt
crew:cadastro:prod:cmrabc123:ciclo:1:setor:TREINAMENTO
```

Regras:

- Um funcionario/remanejamento pode ter mais de um ciclo.
- Cada ciclo tem um evento por setor aplicavel.
- Atualizacoes de prazo e conclusao usam o mesmo `ExternalId`.
- Novo retorno da Logistica para os setores deve abrir novo ciclo.

## Datas

### RH, Medicina e Treinamento

Ao abrir o evento:

- `Start`: data/hora em que o remanejamento funcionario foi aprovado e as tarefas foram geradas.
- `End`: maior `dataLimite` das tarefas ativas do setor.

Enquanto o setor estiver em andamento:

- se a `dataLimite` de uma tarefa do setor mudar, recalcular o maior prazo do setor;
- reenviar o evento com o mesmo `ExternalId`;
- atualizar o `End` previsto no Drake.

Ao concluir o setor:

- `End`: data/hora real da conclusao da ultima tarefa ativa daquele setor.

### Logistica

Ao abrir o evento:

- `Start`: momento em que RH, Medicina e Treinamento terminam e o fluxo volta para Logistica.
- `End`: `Start + 7 dias`.

Regra temporaria:

- considerar 7 dias para Logistica por enquanto;
- essa regra sera ajustada futuramente.

Ao concluir, cancelar ou devolver:

- reenviar o mesmo `ExternalId` atualizando o `End` conforme o evento real.

## Ciclo operacional

### 1. Aprovacao da solicitacao / geracao de tarefas

Quando uma solicitacao for aprovada e as tarefas forem geradas:

1. Identificar os setores com tarefas criadas/ativas.
2. Criar eventos internos para:
   - RH, se houver tarefas de RH;
   - Medicina, se houver tarefas de Medicina;
   - Treinamento, se houver tarefas de Treinamento.
3. Enfileirar envio para o Drake.

Evento enviado:

```json
{
  "Header": {
    "OnInsert": "Execute",
    "OnUpdate": "Execute"
  },
  "Selector": {
    "ExternalId": "crew:cadastro:prod:{remanejamentoFuncionarioId}:ciclo:1:setor:RH"
  },
  "Payload": {
    "Worker": {
      "SyncStrategy": {
        "OnInsert": "Reference",
        "OnUpdate": "Reference"
      },
      "Selector": {
        "Registration": "{matricula}"
      }
    },
    "OccurrenceType": {
      "SyncStrategy": {
        "OnInsert": "Reference",
        "OnUpdate": "Reference"
      },
      "Selector": {
        "Identifier": "{identifierSetor}"
      }
    },
    "Start": {
      "Value": "{dataAprovado}"
    },
    "End": {
      "Value": "{maiorDataLimiteSetor}"
    }
  }
}
```

Decisao de payload:

- nao enviar `Metadata` para o Drake enquanto a documentacao nao declarar suporte a esse campo;
- manter contexto tecnico no banco do Crew em `IntegracaoEventoExterno.metadata`;
- enviar apenas campos previstos pela API de sincronizacao.

### 2. Conclusao de setor

Quando uma tarefa for concluida:

1. Identificar o setor da tarefa.
2. Verificar se todas as tarefas ativas daquele setor estao concluidas ou canceladas.
3. Se o setor terminou:
   - marcar evento interno como concluido;
   - reenfileirar atualizacao para o Drake com o mesmo `ExternalId`;
   - usar `End` real da conclusao.

### 3. Volta para Logistica

Quando todos os setores do ciclo estiverem concluidos:

1. Abrir evento `Cadastro Logistica`.
2. `Start`: momento em que o fluxo vai para Logistica.
3. `End`: `Start + 7 dias`.
4. Enfileirar envio para o Drake.

### 4. Devolucao da Logistica para setores

Quando a Logistica devolver o processo para os setores:

1. Atualizar/fechar evento de Logistica do ciclo atual.
2. Criar novo ciclo.
3. Abrir novos eventos para os setores necessarios.
4. Enviar ao Drake com novos `ExternalId`.

Exemplo:

```txt
ciclo 1:
  Cadastro RH
  Cadastro Medicina
  Cadastro Treinamento
  Cadastro Logistica

ciclo 2:
  Cadastro Treinamento
  Cadastro Logistica
```

### 5. Cancelamento

Se o processo for cancelado em qualquer ponto:

1. Localizar eventos internos abertos daquele `remanejamentoFuncionarioId`.
2. Marcar como cancelados internamente.
3. Enfileirar atualizacao para o Drake.
4. Atualizar `End` com a data/hora do cancelamento.

Pendente validar com o Drake se existe campo especifico para cancelamento ou se encerramos apenas com `End` e observacao.

## Arquitetura recomendada

Nao chamar o Drake diretamente dentro das rotas principais do Crew.

Criar uma camada isolada:

1. `drakeClient`
   - conhece URL, tenant, token e headers;
   - executa HTTP;
   - trata timeout e resposta.

2. `drakeCadastroService`
   - entende o fluxo de cadastro do Crew;
   - calcula setor, ciclo, datas, externalId e payload.

3. Outbox
   - armazena envios pendentes;
   - permite retry;
   - impede que falha do Drake quebre o Crew.

## Tabelas propostas

### Tabelas implementadas

A implementacao inicial seguiu o desenho generico, para evitar prender a arquitetura ao Drake:

- `IntegracaoEventoExterno`: estado logico do evento externo por provedor, dominio, entidade e `externalId`;
- `IntegracaoOutbox`: fila de envio/retry desacoplada do fluxo principal;
- `IntegracaoInbox`: fila/log de recebimento, validacao e processamento de eventos vindos de sistemas externos.

O Drake entra inicialmente como `provedor = DRAKE`, `dominio = CADASTRO_FUNCIONARIO`, `entidade = EVENTO_ADICIONAL`.

Decisao arquitetural:

- `IntegracaoEventoExterno` nao deve ser a fila de processamento.
- `IntegracaoEventoExterno` representa o estado consolidado da entidade integrada.
- `IntegracaoOutbox` e usada apenas para saida do Crew.
- `IntegracaoInbox` e usada apenas para entrada no Crew.
- A coluna `direcao` em `IntegracaoEventoExterno` permite classificar eventos como `SAIDA`, `ENTRADA` ou futuramente `BIDIRECIONAL`.
- Adaptadores especificos, como Drake, devem transformar payloads externos para esse modelo generico.
- Regras do dominio Crew continuam fora dos adaptadores de provedor.

Esse desenho permite integrar com o Drake agora, mas tambem receber dados de outro sistema no futuro sem misturar entrada, saida, retry e estado consolidado na mesma tabela.

### DrakeCadastroEvento

Controla o estado logico do evento por funcionario, setor e ciclo.

Campos sugeridos:

```prisma
model DrakeCadastroEvento {
  id                         Int      @id @default(autoincrement())
  remanejamentoFuncionarioId String
  setor                      String
  ciclo                      Int
  externalId                 String   @unique
  occurrenceAcronym          String
  status                     String   @default("ABERTO")
  startAt                    DateTime
  endPrevistoAt              DateTime?
  endRealAt                  DateTime?
  ultimoPayload              Json?
  createdAt                  DateTime @default(now())
  updatedAt                  DateTime @updatedAt
}
```

Status sugeridos:

- `ABERTO`
- `CONCLUIDO`
- `CANCELADO`

### DrakeOutbox

Controla os envios para o Drake.

Campos sugeridos:

```prisma
model DrakeOutbox {
  id                         Int      @id @default(autoincrement())
  eventoId                   Int?
  remanejamentoFuncionarioId String?
  externalId                 String
  acao                       String
  payload                    Json
  status                     String   @default("PENDENTE")
  tentativas                 Int      @default(0)
  ultimoErro                 String?
  proximaTentativaAt         DateTime?
  sentAt                     DateTime?
  createdAt                  DateTime @default(now())
  updatedAt                  DateTime @updatedAt
}
```

Status sugeridos:

- `PENDENTE`
- `ENVIANDO`
- `ENVIADO`
- `ERRO`
- `IGNORADO`

## Pontos de integracao no codigo atual

Pontos provaveis:

1. Aprovacao/geracao de tarefas:
   - `src/app/api/tarefas/padrao/route.ts`
   - onde o `statusTarefas` vira `ATENDER TAREFAS` e `dataAprovado` e definida.

2. Conclusao de tarefa:
   - `src/app/api/logistica/tarefas/[id]/concluir/route.ts`
   - `src/app/api/logistica/tarefas/[id]/route.ts`

3. Mudanca de prazo:
   - `src/app/api/logistica/tarefas/[id]/route.ts`
   - quando `dataLimite` muda.

4. Sincronizacao que pode devolver para setores:
   - `src/lib/tarefasPadraoSync.ts`
   - quando `statusTarefas` muda entre `SUBMETER RASCUNHO` e `ATENDER TAREFAS`.

5. Cancelamento:
   - `src/app/api/logistica/remanejamentos/route.ts`
   - `src/app/api/logistica/remanejamentos/[id]/route.ts`

## Regras de setor

Setor da tarefa:

- se `treinamentoId` existe: `TREINAMENTO`;
- senao, usar `tarefaPadrao.setor`;
- fallback: normalizar `responsavel`.

Mapeamento atual:

| Setor Crew | Evento Drake | Identifier |
| --- | --- | --- |
| RH | Cadastro RH | MCD |
| MEDICINA | Cadastro Medicina | MCMD |
| TREINAMENTO | Cadastro Treinamento | MCTR |
| LOGISTICA | Cadastro Logistica | MCLG |

## Idempotencia

1. Criar `externalId` deterministico.
2. Antes de criar evento interno, procurar por `remanejamentoFuncionarioId + setor + ciclo`.
3. Se existir, atualizar evento e reenfileirar envio.
4. O Drake tambem deve atualizar pelo mesmo `ExternalId`.
5. Outbox deve evitar duplicar envio pendente identico para o mesmo `externalId`.

## Tratamento de erro

Falha no Drake nao pode falhar a operacao principal do Crew.

Regras:

- Rotas do Crew gravam evento/outbox e continuam.
- Worker/job tenta enviar.
- Se falhar, grava erro e agenda nova tentativa.
- Depois de limite de tentativas, manter como `ERRO` para analise manual.
- Criar logs claros com `externalId`, `remanejamentoFuncionarioId`, setor e status HTTP.

## Plano de implementacao sugerido

### Fase 1: estrutura

1. [x] Criar migrations das tabelas genericas.
2. [x] Separar estado consolidado, outbox de saida e inbox de entrada.
3. [x] Criar `drakeClient`.
4. [x] Criar servico generico para materializar eventos de cadastro.
5. [x] Criar funcao para montar payload preliminar do Drake.
6. [x] Criar outbox sem ainda enviar automaticamente se `DRAKE_WEBHOOK_ENABLED=false`.
7. [x] Criar endpoint administrativo para consultar e materializar eventos.
8. [x] Criar tela administrativa inicial em `/admin/integracoes-cadastro`.

### Fase 2: gatilhos internos

1. Ao aprovar/gerar tarefas, criar eventos RH/Medicina/Treinamento.
2. Ao concluir setor, atualizar evento.
3. Ao mudar data limite, atualizar evento.
4. Ao ir para Logistica, criar evento Logistica.
5. Ao cancelar, marcar eventos abertos como cancelados.

### Fase 3: envio

1. [x] Criar endpoint/job interno para processar outbox.
2. Testar em ambiente controlado.
3. Ativar `DRAKE_WEBHOOK_ENABLED=true`.
4. Monitorar erros.

Processamento implementado:

- servico: `src/lib/integracoes/outboxDrake.ts`;
- endpoint administrativo: `POST /api/admin/integracoes/drake/outbox/processar`;
- tela administrativa: `/admin/integracoes-cadastro`.

Regras atuais:

- processa apenas `IntegracaoOutbox` do provedor `DRAKE` e acao `SYNC_ADDITIONAL_EVENT`;
- por padrao pega status `PENDENTE`;
- opcionalmente permite reenviar `ERRO`;
- opcionalmente permite incluir `IGNORADO`, util para reativar materializacoes feitas com envio desligado;
- respeita `DRAKE_WEBHOOK_ENABLED`;
- se envio estiver desligado, nao chama o Drake e registra o item como desabilitado no resultado do lote;
- em sucesso, marca outbox como `ENVIADO`, grava `sentAt`, incrementa `tentativas` e atualiza `ultimaSincronizacaoAt` no evento externo;
- em falha, grava `ultimoErro`, incrementa `tentativas` e agenda `proximaTentativaAt`;
- apos o limite de tentativas, mantem status `ERRO` para analise manual.

Os logs de auditoria e reprocessamento ficam no banco:

- `IntegracaoOutbox.status`;
- `IntegracaoOutbox.tentativas`;
- `IntegracaoOutbox.ultimoErro`;
- `IntegracaoOutbox.proximaTentativaAt`;
- `IntegracaoOutbox.sentAt`;
- `IntegracaoEventoExterno.ultimaSincronizacaoAt`;
- `IntegracaoEventoExterno.ultimoErro`.

### Fase 4: melhorias futuras

1. Enviar centro de custo.
2. Ajustar regra de prazo da Logistica.
3. Criar painel interno de status da outbox.
4. Permitir reprocessar eventos com erro pela interface.

## Testes essenciais

1. Aprovar remanejamento com tarefas dos tres setores cria tres eventos.
2. Concluir apenas RH fecha apenas `Cadastro RH`.
3. Alterar data limite de Medicina atualiza `End` previsto de `Cadastro Medicina`.
4. Concluir todos os setores abre `Cadastro Logistica`.
5. Devolver da Logistica para Treinamento abre novo ciclo de `Cadastro Treinamento`.
6. Cancelar processo encerra eventos abertos.
7. Reexecutar o mesmo gatilho nao duplica evento.
8. Drake fora do ar nao quebra a conclusao de tarefas no Crew.
9. Outbox registra erro e permite retry.

## Pendencias de validacao

1. Confirmado header do tenant na API Drake: `X-SAPIENSIA-TenantId`.
2. Confirmar nome correto do campo seletor do `Worker` por matricula.
3. Confirmar payload exato aceito pelo `SyncAdditionalEvent` para `ExternalId`.
4. Confirmar como representar cancelamento no Drake.
5. Validar se os identifiers por setor existem em todos os ambientes do Drake antes de ativar envio automatico.

## Decisoes ja tomadas

1. Usar camada separada, nao chamada direta espalhada nas rotas.
2. Usar outbox para seguranca e retry.
3. Usar `ExternalId` gerado pelo Crew.
4. Atualizar evento do Drake reenviando o mesmo `ExternalId`.
5. Usar matricula para localizar `Worker`.
6. Usar `Identifier` para localizar `OccurrenceType`; valores atuais: RH `MCD`, Medicina `MCMD`, Treinamento `MCTR`, Logistica `MCLG`.
7. Usar `Start` na aprovacao/abertura do ciclo.
8. Usar `End` previsto pela maior `dataLimite` do setor.
9. Ao concluir setor, atualizar `End` para data real.
10. Para Logistica, usar prazo inicial de 7 dias.
## Decisao 2026-07-30: sessao de sincronismo

Decidimos usar apenas sessao de sincronismo para o envio automatico dos eventos de cadastro, inclusive quando houver apenas 1 item. O envio item a item fica fora do caminho automatico.

Regras:

- usar `SyncSession` para `SYNC_ADDITIONAL_EVENT`;
- enviar lotes com ate 1000 eventos por sessao;
- usar timeout padrao de 60 minutos (`3600000` ms);
- manter `IntegracaoOutbox` como fila interna;
- criar `IntegracaoSessao` para auditar abertura, finalizacao, retorno e erro da sessao;
- vincular itens da outbox a sessao por `IntegracaoOutbox.sessaoId`;
- apos `AddAdditionalEventBulk` e `SetFinalized`, marcar outbox como `AGENDADO_SESSAO`;
- nao processar `SYNC_WORKER` nesta etapa, pois Sispat e contrato serao reavaliados depois;
- manter `DRAKE_SYNC_SESSION_ENABLED=false` ate homologacao.

Variaveis:

```env
DRAKE_SYNC_SESSION_BASE_PATH=/api/v2/Integration/SyncSession
DRAKE_SYNC_SESSION_TIMEOUT_MS=3600000
DRAKE_SYNC_SESSION_ENABLED=false
```

Para abrir sessao de verdade, o ambiente deve ter as duas travas ligadas:

```env
DRAKE_WEBHOOK_ENABLED=true
DRAKE_SYNC_SESSION_ENABLED=true
```

Enquanto `DRAKE_SYNC_SESSION_ENABLED=false`, a tela pode preparar e simular, mas nao chama o Drake.

## Decisao 2026-07-31: regra de datas enviada ao Drake

O Drake nao deve receber a data limite/SLA do Crew como `End`.

Motivo: o `SyncAdditionalEvent` possui apenas um campo final (`End`) e ele nao diferencia prazo previsto de fim real. Se usarmos a data limite enquanto aberto e depois substituirmos pela conclusao, o Drake perde a leitura do prazo original. Se mantivermos sempre a data limite, o Drake perde a leitura do fim real.

A decisao e tratar o Drake como acompanhamento operacional do ciclo:

- `Start`: inicio real do ciclo/setor no Crew;
- `End` com ciclo aberto: data/hora atual da sincronizacao;
- `End` com ciclo concluido: data/hora real de conclusao do ciclo;
- `End` com ciclo cancelado: data/hora real de cancelamento do ciclo.
- formato enviado ao Drake: ISO-8601 com offset `-03:00`, para evitar exibicao deslocada em UTC na tela do Drake;
- `Justification`: enviar o setor Crew, por exemplo `Setor Crew: LOGISTICA`, para facilitar analise visual no Drake.

O SLA continua sendo responsabilidade do Crew:

- `RemanejamentoCiclo.prazoPrevistoAt` guarda a data limite calculada;
- `IntegracaoEventoExterno.endPrevistoAt` deve refletir esse prazo interno, para auditoria;
- `IntegracaoEventoExterno.endRealAt` guarda conclusao/cancelamento real;
- o payload enviado ao Drake usa apenas a regra operacional acima.

Para ciclos repetidos no mesmo remanejamento, o `Start` continua sendo por ciclo, pois o `externalId` contem `numeroCiclo` e `setor`:

```txt
crew:cadastro:{ambiente}:{remanejamentoFuncionarioId}:ciclo:{numeroCiclo}:setor:{setor}
```

Assim, um retorno para treinamento em outro ciclo cria/atualiza outro evento no Drake, com outro `Start`.

Validacao importante: para ciclos 2+, o inicio do ciclo deve usar as tarefas pendentes/reativadas daquele novo atendimento, nao a data de aprovacao original do remanejamento nem tarefas antigas ja concluidas. Isso evita enviar ao Drake um novo ciclo com `Start` antigo.

## Decisao 2026-07-31: envio periodico por hora

O envio automatico dos eventos adicionais de cadastro deve acontecer de forma periodica, para reduzir chamadas ao Drake e evitar que cada aprovacao/conclusao de tarefa gere uma requisicao imediata.

Regra operacional:

- a cada 60 minutos, o Crew verifica se existem itens pendentes na `IntegracaoOutbox`;
- se nao houver pendencias, o worker apenas registra que nao havia trabalho;
- se houver pendencias, abre uma sessao de sincronismo no Drake;
- envia os eventos em lotes de ate 1000 itens;
- finaliza a sessao ao terminar de adicionar os lotes;
- marca os itens como `AGENDADO_SESSAO`, vinculando cada item a `IntegracaoSessao`;
- mantem o envio manual unitario ou limitado pela tela administrativa para teste, suporte e reprocessamento controlado.

Configuracao definida:

```env
DRAKE_SYNC_SESSION_ENABLED=true
DRAKE_SYNC_SESSION_TIMEOUT_MS=3000000
DRAKE_OUTBOX_WORKER_INTERVAL_MINUTES=60
DRAKE_OUTBOX_WORKER_BATCH_SIZE=1000
```

Observacao: o timeout fica em 50 minutos, abaixo do intervalo de 60 minutos do worker, para reduzir risco de uma sessao ainda estar aberta quando a proxima execucao tentar iniciar.

### Situacao encontrada no codigo

O app ja possui:

- `IntegracaoOutbox` como fila interna;
- `IntegracaoSessao` para auditar sessoes;
- cliente Drake em `src/lib/integracoes/drakeClient.ts`;
- processamento de outbox em `src/lib/integracoes/outboxDrake.ts`;
- endpoint manual `POST /api/admin/integracoes/drake/outbox/processar`;
- tela administrativa `/admin/integracoes-cadastro`;
- suporte inicial a `Start`, `AddAdditionalEventBulk` e `SetFinalized`.

Pontos que precisam ser ajustados:

- trocar o payload de abertura de sessao para usar o formato validado pela documentacao/exemplo operacional, com `Description` e timeout em minutos quando aplicavel;
- garantir que o timeout configurado seja 50 minutos;
- deixar o processamento explicitamente orientado a lote de ate 1000 itens;
- criar um worker/agendador dedicado para a outbox Drake;
- expor variaveis de configuracao no `.env.example` e no compose;
- manter o envio manual da tela, mas deixando claro que ele e operacional/teste, nao o fluxo principal;
- melhorar o tratamento de sessao ainda ativa para nao gerar erro ruidoso em execucoes periodicas;
- registrar no banco quando o worker rodou e encontrou sessao ativa ou fila vazia, se necessario para auditoria.

### Checklist de implementacao

- [x] Definir regra de datas do Drake sem usar data limite/SLA como `End`.
- [x] Ajustar materializador para manter `endPrevistoAt` como SLA interno e enviar `End` operacional.
- [x] Evitar duplicar outbox pendente do mesmo evento externo; atualizar a pendencia existente quando aplicavel.
- [x] Enviar `Start`/`End` em ISO-8601 com offset `-03:00`.
- [x] Enviar `Justification` com o setor Crew.
- [x] Corrigir `Start` de ciclos 2+ para usar a criacao das tarefas do novo atendimento.
- [ ] Ajustar `drakeClient`/`outboxDrake` para abertura de sessao com descricao e timeout de 50 minutos.
- [ ] Confirmar se o endpoint correto para eventos adicionais em sessao permanece `AddAdditionalEventBulk`.
- [ ] Ajustar `processarOutboxDrake` para trabalhar como lote automatico de ate 1000 itens por execucao.
- [ ] Criar endpoint interno protegido para o worker periodico, reaproveitando `processarOutboxDrake`.
- [ ] Criar script `scripts/drake-outbox-worker.js` inspirado no worker de funcionarios.
- [ ] Configurar o worker no `docker-compose.dev.yml`.
- [ ] Preparar variaveis no `.env.example`.
- [ ] Validar em dry-run.
- [ ] Testar envio real com limite 5 em HMG.
- [ ] Conferir no Drake se os 5 eventos entraram corretamente.
- [ ] So depois habilitar envio periodico em producao.
