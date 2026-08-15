# Planejamento: integracao Drake para contrato do trabalhador

## Objetivo

Atualizar no Drake o numero do contrato do trabalhador a partir do centro de custo recebido no Crew.

O Crew recebe o funcionario com `centroCusto`, mas a integracao original nao informa diretamente o contrato. A tabela `ContratosCentrosCusto` passa a ser o resolvedor interno:

```txt
Funcionario.centroCusto -> CentroCusto -> ContratosCentrosCusto -> Contrato.numero -> Drake Worker
```

## Escopo inicial

- Resolver contrato por centro de custo.
- Enfileirar atualizacao do Worker no Drake.
- Usar o mesmo modelo generico de integracao ja criado:
  - `IntegracaoEventoExterno`
  - `IntegracaoOutbox`
  - `IntegracaoInbox`
- Nao chamar o Drake diretamente dentro da sincronizacao principal de funcionarios.

Fora do escopo inicial:

- envio em massa por sessao dentro do app;
- consulta posterior no Drake para confirmar sucesso item a item;
- tela dedicada de auditoria de Worker;
- suporte a centro de custo vinculado a mais de um contrato sem uma regra de desempate.

## Endpoint Drake

Endpoint usado:

```txt
/api/v2/Integration/Sync/SyncWorker
```

Variavel:

```env
DRAKE_SYNC_WORKER_PATH=/api/v2/Integration/Sync/SyncWorker
```

## Payload

Estrutura equivalente ao script de Sispat, usando matricula como seletor:

```json
{
  "Header": {
    "OnInsert": "Ignore",
    "OnUpdate": "Execute"
  },
  "Selector": {
    "Registration": "FRI-01-00000"
  },
  "Payload": {
    "Contracts": [
      {
        "Selector": {
          "ExternalId": "4600677360"
        },
        "Main": true,
        "Deleted": false
      }
    ]
  }
}
```

Pela documentacao do `SyncWorker`, `Contracts` e uma lista de referencias de contratos, com suporte a marcar o contrato principal. O exemplo da documentacao usa `Selector.ExternalId`.

O seletor do contrato fica configuravel:

```env
DRAKE_CONTRACT_SELECTOR_FIELD=ExternalId
DRAKE_CONTRACT_EXTERNAL_ID_PREFIX=
```

Se o contrato no Drake estiver cadastrado por outro seletor ou com prefixo no mapa de integracao, trocar as variaveis e materializar novamente.

## Idempotencia

Cada funcionario tem um evento consolidado por matricula:

```txt
crew:worker-contract:{ambiente}:{matricula}
```

Chave de idempotencia interna:

```txt
DRAKE:WORKER:WORKER:CONTRATO:{matricula}
```

Regras:

- se nao existir evento, cria e enfileira;
- se o contrato resolvido mudar, atualiza o evento e enfileira novo payload;
- se o payload for igual e ja houver outbox pendente igual, nao duplica;
- se `DRAKE_WEBHOOK_ENABLED=false`, cria outbox como `IGNORADO`;
- falha no Drake nao quebra a sincronizacao de funcionarios.

## Gatilhos implementados

1. `POST /api/funcionarios/sincronizar`
   - funcionario novo: cria funcionario e materializa contrato para o Drake;
   - funcionario existente com centro de custo alterado: atualiza centro de custo e materializa contrato.

2. `POST /api/funcionarios/import`
   - funcionario novo: materializa contrato;
   - funcionario existente com centro de custo alterado: materializa contrato.

3. `POST /api/admin/integracoes/drake/worker-contratos`
   - endpoint administrativo para simular ou materializar manualmente.

## Processamento

O processador generico `processarOutboxDrake` agora aceita:

- `SYNC_ADDITIONAL_EVENT`
- `SYNC_WORKER`

Para `SYNC_WORKER`, envia pelo `SyncWorker`.

## Casos ignorados

A materializacao nao envia ao Drake quando:

- funcionario nao tem centro de custo;
- centro de custo nao tem vinculo com contrato;
- centro de custo tem mais de um contrato vinculado.

Centro de custo com mais de um contrato precisa de regra futura, por exemplo:

- marcar contrato principal;
- limitar vinculo ativo unico por centro de custo;
- adicionar vigencia no vinculo.

## Teste manual

Simular para uma matricula:

```http
POST /api/admin/integracoes/drake/worker-contratos
{
  "matricula": "FRI-01-00000",
  "dryRun": true
}
```

Materializar:

```http
POST /api/admin/integracoes/drake/worker-contratos
{
  "matricula": "FRI-01-00000"
}
```

Processar outbox:

```http
POST /api/admin/integracoes/drake/outbox/processar
{
  "limit": 1
}
```
