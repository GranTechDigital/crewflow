# Planejamento: ciclos do Crew e integracoes externas

## Objetivo

Definir um modelo interno de ciclos do Crew para acompanhar o fluxo de cadastro/remanejamento por setor, sem prender a regra de negocio a uma integracao especifica.

A ideia e que o Crew tenha sua propria verdade operacional sobre os ciclos. Integracoes externas, como Drake ou futuras ferramentas, devem consumir essa verdade por uma camada separada.

## Principio principal

O ciclo pertence ao Crew.

O Drake, ou qualquer outro sistema externo, deve receber uma representacao desse ciclo, mas nao deve ditar como o ciclo existe dentro do Crew.

Separacao desejada:

1. Ciclo operacional do Crew.
2. Eventos internos derivados do ciclo.
3. Camada generica de integracao externa.
4. Adaptadores especificos por fornecedor, como Drake.

## Problema que queremos evitar

Se criarmos uma tabela diretamente chamada `DrakeCadastroEvento`, com regras de ciclo dentro dela, o modelo do Crew fica preso ao Drake.

Riscos:

- dificuldade para integrar outro sistema no futuro;
- externalId do Drake influenciando demais o desenho interno;
- mistura entre regra operacional e regra de envio;
- mais risco ao alterar API, credenciais ou formato do fornecedor;
- dificuldade para auditar o que aconteceu no Crew independentemente do envio externo.

## O que temos hoje

Hoje o Crew ja possui parte importante do dominio, mas ela esta espalhada em entidades e transicoes operacionais.

Elementos existentes:

- `RemanejamentoFuncionario`: representa o processo do funcionario dentro da solicitacao/remanejamento.
- `TarefaRemanejamento`: representa as tarefas criadas para RH, Medicina, Treinamento e outros responsaveis.
- `TarefaStatusEvento`: registra historico de mudanca de status de tarefas.
- `HistoricoRemanejamento`: registra algumas mudancas de campos do remanejamento.
- `statusTarefas`: indica estados macro do fluxo, como atendimento dos setores e retorno para Logistica.
- `dataAprovado`: indica a aprovacao que dispara a criacao/atendimento das tarefas.
- `dataLimite`: indica prazo de atendimento das tarefas.

O que esse modelo atende bem:

- controlar tarefas individuais;
- mostrar progresso operacional;
- permitir que setores concluam suas tarefas;
- permitir que o fluxo avance ou volte conforme tarefas e Logistica;
- guardar parte do historico.

O que ele ainda nao atende bem:

- representar formalmente um ciclo de atendimento;
- saber que uma devolucao abriu um novo ciclo;
- auditar inicio/fim por setor de forma consolidada;
- gerar uma identidade estavel para integracoes externas;
- reprocessar integracoes com seguranca;
- separar regra de negocio de regra de envio externo;
- reconstruir com confianca todos os ciclos antigos apenas pelo historico atual.

Resumo: o sistema tem as pecas operacionais, mas ainda nao tem a entidade de ciclo como conceito de negocio.

## Levantamento do que ja existe em relatorios

Existe uma logica relevante no relatorio de SLA:

- arquivo: `src/app/api/sla/relatorio/route.ts`;
- usa `TarefaStatusEvento` para montar segmentos de status das tarefas;
- usa `HistoricoRemanejamento` para identificar decisoes da Logistica/Prestserv;
- calcula `responsabilidadeTimeline`;
- calcula `periodosPorSetor`;
- calcula `segmentosPorSetor`;
- usa inicio/fim por setor e por fase;
- ja trabalha com a ideia de "ciclos", mas como inferencia de relatorio.

Essa logica considera, de forma resumida:

- tempo 1: aprovacao inicial da Logistica;
- tempo 2: execucao de pendencias pelos setores;
- tempo 3: analise da Logistica;
- tempo 4: correcao/reprovacao pelos setores;
- tempo 5: validacao final.

Tambem existem relatorios de desempenho/atuacao que usam as mesmas bases:

- `src/app/api/logistica/desempenho-usuarios/route.ts`;
- `src/app/api/logistica/atuacao-individual/route.ts`.

Esses relatorios usam:

- eventos de conclusao em `TarefaStatusEvento`;
- historico de alteracao em `HistoricoRemanejamento`;
- usuario responsavel;
- datas de acao/evento;
- status de Prestserv e status das tarefas.

Conclusao importante: ja existe conhecimento de inicio/fim no sistema, mas ele esta implementado como calculo derivado para relatorio, nao como entidade persistida e confiavel do dominio.

## Tabela `TarefaStatusEvento`

A tabela `TarefaStatusEvento` tem papel importante hoje.

Ela registra eventos de mudanca de status de tarefas:

```txt
tarefaId
remanejamentoFuncionarioId
statusAnterior
statusNovo
observacoes
dataEvento
usuarioResponsavelId
```

Ela e alimentada em pontos como:

- atualizacao individual de tarefa;
- conclusao de tarefa;
- aprovacao em lote de tarefas.

O que ela resolve bem:

- saber quando uma tarefa mudou de status;
- saber quem concluiu/reprovou uma tarefa;
- calcular tempos de execucao de tarefas;
- alimentar relatorios de desempenho;
- ajudar a inferir ciclos.

O que ela nao resolve sozinha:

- nao representa o ciclo do remanejamento;
- nao separa ciclo inicial de ciclo de correcao de forma explicita;
- nao guarda um estado consolidado por setor;
- nao tem numero de ciclo de negocio;
- nao diz diretamente quando Logistica abriu ou fechou um ciclo;
- nao e uma outbox de integracao;
- nao guarda payload, provider, externalId, tentativa ou erro de envio.

Portanto, ela deve ser considerada fonte de eventos de tarefa, nao tabela principal de ciclo.

## Tabela `HistoricoRemanejamento`

A tabela `HistoricoRemanejamento` tambem e usada hoje para inferir fases do fluxo.

Ela registra alteracoes como:

- mudanca de `statusTarefas`;
- mudanca de `statusPrestserv`;
- criacao, cancelamento, reativacao e sincronizacao;
- usuario responsavel;
- data da acao.

Pontos importantes encontrados:

- a aprovacao/geracao de tarefas grava `statusTarefas = ATENDER TAREFAS`;
- a conclusao das tarefas pode mudar para `SUBMETER RASCUNHO`;
- a Logistica/Prestserv gera historicos que os relatorios usam para detectar analise, validacao, invalidacao e reprovacao;
- em alguns caminhos, o historico nao grava `valorAnterior` de forma consistente.

Conclusao: `HistoricoRemanejamento` e muito util como trilha de auditoria, mas nao deve ser a unica fonte oficial de ciclo, porque alguns registros dependem de texto, status normalizado e inferencias.

## Aprendizado do levantamento

O sistema ja tem uma base boa para entender ciclos, mas hoje isso acontece em tres niveis misturados:

1. Estado atual:
   - `RemanejamentoFuncionario.statusTarefas`;
   - `RemanejamentoFuncionario.statusPrestserv`;
   - `TarefaRemanejamento.status`;
   - datas nas tarefas.

2. Eventos operacionais:
   - `TarefaStatusEvento`;
   - `HistoricoRemanejamento`.

3. Inferencia de relatorio:
   - SLA monta timeline e ciclos em memoria;
   - calcula inicio/fim por setor;
   - aplica fallbacks quando eventos estao incompletos.

Esse desenho atende relatorio, mas nao e o ideal como base para integracao externa.

Para relatorio, inferir e aceitavel.

Para integracao com outro sistema, o correto e persistir o ciclo no momento em que ele acontece.

## Equivalencia entre SLA atual e ciclo oficial

O relatorio de SLA trabalha com uma timeline de responsabilidade que pode orientar o novo modelo, mas a equivalencia nao deve ser copiada cegamente.

| SLA atual | Significado aproximado | Ciclo oficial sugerido |
| --- | --- | --- |
| Tempo 1 / ciclo 1 | Aprovacao inicial da Logistica, da criacao ate aprovacao/geracao de tarefas | Fora do ciclo operacional principal; pode virar metrica/evento separado |
| Tempo 2 / ciclo 2 | Execucao inicial dos setores apos aprovacao | Ciclos de setor `numeroCiclo = 1` para RH, Medicina e Treinamento |
| Tempo 3 / ciclo 3 | Analise da Logistica apos setores concluirem | Ciclo de Logistica do ciclo operacional atual |
| Tempo 4 / ciclo 4 | Correcao pelos setores apos reprovacao/devolucao | Novo ciclo de setor, por exemplo `numeroCiclo = 2` |
| Tempo 5 / ciclo 5 | Validacao final | Evento de conclusao do ciclo/processo, nao necessariamente um ciclo separado |

Decisao recomendada:

- O `numeroCiclo` oficial deve representar a rodada operacional do cadastro, nao o numero interno usado pelo relatorio.
- A fase de solicitacao/aprovacao deve ser registrada como `numeroCiclo = 0`, setor `SOLICITACAO`, tipo `APROVACAO_SOLICITACAO`.
- O prazo previsto da fase de solicitacao/aprovacao deve ser uma meta operacional, nao a data real de conclusao. Regra inicial: `dataSolicitacao + 5 dias`.
- Ciclo 1 oficial: primeira ida aos setores + retorno para Logistica.
- Ciclo 2 oficial: primeira devolucao para setores + novo retorno para Logistica.
- Ciclo 3 oficial: segunda devolucao, e assim por diante.
- Na reconstrucao historica, tarefas do mesmo remanejamento criadas em lotes muito distantes devem abrir novos ciclos. Regra inicial: se o novo lote de tarefas foi criado mais de 7 dias apos o lote anterior, ele representa nova rodada operacional.
- Quando um novo lote aparece depois de setores concluidos, a Logistica intermediaria deve ser reconstruida entre a conclusao dos setores anteriores e a criacao do novo lote.

Exemplo:

```txt
Ciclo oficial 0:
  Solicitacao/Aprovacao
  Prazo previsto: data da solicitacao + 5 dias

Ciclo oficial 1:
  RH
  Medicina
  Treinamento
  Logistica

Ciclo oficial 2:
  Treinamento
  Logistica
```

Com isso, evitamos que os numeros `1`, `2`, `3`, `4`, `5` do relatorio SLA virem contrato de negocio. Eles continuam sendo fases analiticas do relatorio.

## Modelo oficial sugerido de ciclo

O modelo mais claro neste momento e ter ciclo por setor dentro de uma rodada operacional.

Exemplo de registros:

```txt
remanejamentoFuncionarioId = abc123
numeroCiclo = 1
setor = RH
status = CONCLUIDO

remanejamentoFuncionarioId = abc123
numeroCiclo = 1
setor = TREINAMENTO
status = CONCLUIDO

remanejamentoFuncionarioId = abc123
numeroCiclo = 1
setor = LOGISTICA
status = ABERTO
```

Se a Logistica devolver para Treinamento:

```txt
remanejamentoFuncionarioId = abc123
numeroCiclo = 2
setor = TREINAMENTO
status = ABERTO
```

Quando Treinamento terminar novamente:

```txt
remanejamentoFuncionarioId = abc123
numeroCiclo = 2
setor = TREINAMENTO
status = CONCLUIDO

remanejamentoFuncionarioId = abc123
numeroCiclo = 2
setor = LOGISTICA
status = ABERTO
```

Essa estrutura conversa bem com o SLA, mas e mais simples para operacao, auditoria e integracao.

## Regras refinadas do ciclo operacional

Depois da analise dos gatilhos atuais, a aprovacao inicial deve ficar fora do ciclo operacional principal.

A aprovacao inicial tem este papel:

- liberar a geracao das tarefas;
- definir `dataAprovado`;
- iniciar o atendimento dos setores.

Ela nao deve ser contabilizada como rodada operacional principal de cadastro. Se precisarmos medir esse tempo, isso pode virar uma metrica separada de "tempo ate aprovacao inicial".

### Inicio do ciclo 1

Gatilho:

- geracao das tarefas padrao/matriz;
- transicao de `statusTarefas` para `ATENDER TAREFAS`;
- preenchimento de `dataAprovado`.

Acao esperada:

- criar `RemanejamentoCiclo` com `numeroCiclo = 1` para cada setor com tarefa ativa:
  - RH;
  - Medicina;
  - Treinamento.

Data de inicio:

- preferencialmente `dataAprovado`;
- fallback: menor `dataCriacao` das tarefas do setor.

Prazo previsto:

- maior `dataLimite` das tarefas ativas daquele setor.

### Fechamento de ciclo de setor

Gatilho:

- tarefa concluida, cancelada ou alterada;
- criacao de `TarefaStatusEvento`;
- recalculo do status geral das tarefas.

Regra:

- quando todas as tarefas ativas de um setor estiverem `CONCLUIDO`, `CONCLUIDA` ou `CANCELADO`, fechar o ciclo daquele setor;
- `conclusaoAt` deve ser a maior data de conclusao/evento entre as tarefas ativas do setor;
- se o setor nao tiver tarefas ativas, nao criar ciclo do setor.

### Abertura da etapa de Logistica

Gatilho atual:

- `statusTarefas` muda para `SUBMETER RASCUNHO`.

Significado operacional:

- setores terminaram;
- processo voltou para avaliacao da Logistica/Prestserv.

Acao esperada:

- fechar ciclos de setores ainda abertos, se estiverem completos;
- abrir `RemanejamentoCiclo` do setor `LOGISTICA` no mesmo `numeroCiclo`;
- `inicioAt` da Logistica deve ser a data da transicao para `SUBMETER RASCUNHO`.

Observacao:

- hoje `SUBMETER RASCUNHO` funciona como o "botao" indireto de envio para Logistica.
- isso deve ser mantido no primeiro momento, porque representa o fluxo real atual.

### Avaliacao da Logistica

Gatilho atual:

- alteracao de `statusPrestserv`.

Status relevantes:

- `EM VALIDAÇÃO`: processo submetido/em analise;
- `VALIDADO`: Logistica aprovou/finalizou;
- `INVALIDADO`: Logistica reprovou/devolveu;
- `CANCELADO`: processo cancelado;
- `CRIADO`: rascunho/reabertura/correcao operacional;
- `PENDENTE DE DESLIGAMENTO`: estado de espera, nao deve fechar ciclo como validado.

Regra:

- `VALIDADO` fecha o ciclo de Logistica e encerra o processo;
- `INVALIDADO` fecha a avaliacao da Logistica e deve abrir novo ciclo para os setores envolvidos na correcao;
- `CANCELADO` cancela todos os ciclos abertos;
- outros status devem ser avaliados com cuidado para nao abrir ciclo indevidamente.

### Inicio de novo ciclo apos devolucao

Gatilho atual mais confiavel:

- Logistica muda `statusPrestserv` para `INVALIDADO` ou equivalente;
- depois o sistema cria/reativa/reprova tarefas;
- `statusTarefas` volta para `ATENDER TAREFAS`.

Acao esperada:

- incrementar `numeroCiclo`;
- criar ciclos apenas para os setores que realmente precisam atuar;
- usar tarefas reprovadas, reativadas ou novas como evidencia dos setores envolvidos.

Setores envolvidos podem ser detectados por:

- tarefas com status `REPROVADO`;
- tarefas reativadas pela sincronizacao;
- tarefas novas criadas apos a devolucao;
- setor/responsavel da tarefa;
- eventos `TarefaStatusEvento` com `statusNovo = REPROVADO`.

### Cancelamento

Gatilho:

- `statusPrestserv = CANCELADO`;
- ou `statusTarefas = CANCELADO`;
- ou `dataCancelado` preenchida.

Acao esperada:

- cancelar ciclos abertos;
- registrar evento `CICLO_CANCELADO`;
- nao apagar ciclos ja concluidos;
- manter rastreabilidade do que aconteceu antes do cancelamento.

## Melhorias recomendadas no processo atual

Estas melhorias nao precisam bloquear a primeira implementacao, mas sao importantes para deixar o ciclo mais robusto.

### 1. Criar acao explicita de devolucao da Logistica

Hoje a devolucao acontece indiretamente por alteracao de `statusPrestserv`, geralmente para `INVALIDADO` ou equivalente.

Melhoria recomendada:

- criar uma acao clara: `devolver para setores`;
- permitir informar motivo;
- permitir indicar setores afetados;
- opcionalmente indicar tarefas reprovadas;
- a acao ja abriria o novo ciclo de forma objetiva.

Ganho:

- menos inferencia;
- menos dependencia de texto/status;
- melhor auditoria;
- integracao externa mais precisa.

### 2. Padronizar status de avaliacao da Logistica

Hoje existem variacoes e coercao de status, incluindo IDs numericos e textos equivalentes.

Melhoria recomendada:

- definir enum interno canonico para Prestserv/Logistica;
- normalizar na borda da API;
- persistir apenas valores canonicos.

Exemplo:

```txt
CRIADO
EM_VALIDACAO
VALIDADO
INVALIDADO
CANCELADO
PENDENTE_DESLIGAMENTO
```

Ganho:

- menos erro de grafia;
- menos fallback em relatorios;
- regras de ciclo mais simples.

### 3. Centralizar recalculo de `statusTarefas`

Hoje o recalculo aparece em varios pontos:

- conclusao individual;
- atualizacao individual;
- aprovacao em lote;
- deduplicacao;
- sincronizacao de matriz/tarefas.

Melhoria recomendada:

- criar uma funcao unica para recalcular status operacional;
- essa funcao tambem chama o servico de ciclo.

Ganho:

- evita divergencia entre rotas;
- reduz risco de um caminho esquecer de atualizar ciclo;
- melhora testes.

### 4. Sempre registrar `valorAnterior`

Alguns historicos de `statusTarefas` hoje registram `valorNovo`, mas nao registram `valorAnterior`.

Melhoria recomendada:

- toda transicao de status deve gravar anterior e novo;
- se nao houver anterior, gravar explicitamente `null`;
- incluir origem da transicao.

Ganho:

- backfill historico melhor;
- auditoria mais clara;
- relatorios menos dependentes de fallback.

### 5. Separar medicao de aprovacao inicial

A aprovacao inicial e importante, mas nao deve se misturar com o ciclo operacional dos setores.

Melhoria recomendada:

- medir aprovacao inicial como metrica separada:
  - `dataSolicitacao` ate `dataAprovado`;
- nao incluir isso no ciclo principal de cadastro.

Ganho:

- ciclo fica mais claro;
- SLA continua podendo medir a etapa inicial quando necessario.

## O que o modelo correto deve ter

Seguindo um padrao mais comum em empresas e sistemas com integracoes, o desenho recomendado e separar claramente:

1. Estado de negocio.
2. Historico/eventos de dominio.
3. Outbox/fila de integracao.
4. Adaptadores externos.

Essa separacao evita que o sistema fique fragil quando uma API externa muda, quando uma integracao falha ou quando outro fornecedor entra no futuro.

### Estado de negocio

O estado de negocio deve responder:

- qual remanejamento esta em qual ciclo;
- quais setores participam daquele ciclo;
- quando cada setor iniciou;
- qual o prazo previsto;
- quando concluiu;
- se foi cancelado;
- se a Logistica devolveu e abriu novo ciclo.

Esse estado pertence ao Crew.

### Eventos de dominio

Eventos de dominio devem registrar fatos relevantes do negocio.

Exemplos:

- `CICLO_SETOR_ABERTO`
- `CICLO_SETOR_PRAZO_ALTERADO`
- `CICLO_SETOR_CONCLUIDO`
- `CICLO_SETOR_CANCELADO`
- `CICLO_LOGISTICA_ABERTO`
- `CICLO_DEVOLVIDO_PARA_SETOR`

Eles devem ser escritos quando algo importante acontece, mesmo que nenhuma integracao externa exista.

### Outbox de integracao

A outbox deve registrar o que precisa ser enviado para fora do Crew.

Ela resolve problemas classicos:

- API externa fora do ar;
- timeout;
- resposta com erro;
- retry;
- auditoria do payload enviado;
- reprocessamento manual;
- idempotencia.

Regra importante: a operacao principal do Crew nao deve falhar porque o Drake, ou outro sistema externo, falhou.

### Adaptador externo

O adaptador externo traduz o evento interno para o formato do fornecedor.

No Drake, por exemplo:

- setor vira `OccurrenceType`;
- matricula vira seletor de trabalhador;
- ciclo vira parte do `ExternalId`;
- inicio e prazo/conclusao viram `Start` e `End`;
- credenciais e headers ficam isolados.

Se amanha existir outro fornecedor, ele deve ganhar outro adaptador, nao outra regra espalhada no fluxo operacional.

## O que vamos ter que fazer

### 1. Mapear as transicoes reais do fluxo atual

Antes de criar tabela, precisamos mapear com precisao onde o Crew hoje muda de fase.

Transicoes principais:

- aprovacao da solicitacao;
- geracao das tarefas;
- abertura de atendimento por setor;
- conclusao de todas as tarefas de um setor;
- conclusao de todos os setores;
- retorno para Logistica;
- devolucao da Logistica para um ou mais setores;
- cancelamento.

Esse mapa define os gatilhos corretos para abrir, atualizar e fechar ciclos.

### 2. Criar a entidade de ciclo do Crew

Criar uma tabela propria para o ciclo operacional.

Nome preferido neste momento:

```txt
RemanejamentoCiclo
```

Ela deve representar uma passagem de um remanejamento por um setor em um numero de ciclo.

Exemplo:

```txt
remanejamentoFuncionarioId = abc123
numeroCiclo = 1
setor = TREINAMENTO
status = ABERTO
inicioAt = dataAprovado
prazoPrevistoAt = maior dataLimite do setor
```

### 3. Criar eventos internos do ciclo

Criar uma tabela de eventos do ciclo.

Nome preferido:

```txt
RemanejamentoCicloEvento
```

Ela registra os fatos, nao apenas o estado final.

Isso ajuda em:

- auditoria;
- investigacao de problemas;
- geracao de integracoes;
- telas futuras;
- reprocessamento.

### 4. Criar camada generica de integracao

Criar uma outbox generica, nao uma outbox chamada apenas Drake.

Nome preferido:

```txt
IntegracaoEventoExterno
```

Campos importantes:

- provedor;
- tipo de entidade;
- id da entidade;
- evento interno relacionado;
- chave externa;
- payload;
- status;
- tentativas;
- erro;
- proxima tentativa;
- data de envio.

### 5. Criar adaptador Drake como primeira integracao

Depois do modelo interno pronto, criar o adaptador Drake.

Responsabilidades:

- montar payload do `SyncAdditionalEvent`;
- mapear acronimos;
- montar `ExternalId`;
- enviar com tenant e bearer token;
- registrar sucesso ou erro na outbox.

### 6. Implantar com feature flag

Para reduzir risco, a integracao deve nascer desligada ou em modo dry-run.

Fases seguras:

1. Criar tabelas sem mudar comportamento.
2. Comecar a registrar ciclos internamente.
3. Validar ciclos em ambiente real.
4. Gerar outbox sem enviar.
5. Ativar envio para Drake em ambiente controlado.
6. Ativar em producao.

## Recomendacao profissional

O caminho correto nao e comecar pelo webhook.

O caminho correto e:

1. formalizar o ciclo no dominio do Crew;
2. registrar eventos internos confiaveis;
3. criar uma outbox generica;
4. plugar o Drake como consumidor externo.

Isso segue um padrao conhecido de sistemas com integracao: dominio primeiro, integracao depois.

O principal ganho e que o Crew passa a ter rastreabilidade propria. Mesmo se o Drake mudar, ficar fora do ar ou for substituido, o Crew continua sabendo exatamente o que aconteceu.

## Modelo conceitual

### 1. Ciclo do Crew

Representa uma passagem operacional do remanejamento por um setor.

Exemplos:

- Ciclo 1 de Treinamento;
- Ciclo 1 de Medicina;
- Ciclo 1 de RH;
- Ciclo 1 de Logistica;
- Ciclo 2 de Treinamento, caso a Logistica devolva para o setor;
- Ciclo 2 de Logistica, quando retornar novamente para Logistica.

Essa entidade nao deve conhecer Drake, token, payload, externalId ou status HTTP.

Campos conceituais:

```txt
id
remanejamentoFuncionarioId
numeroCiclo
setor
status
inicioAt
prazoPrevistoAt
conclusaoAt
cancelamentoAt
origem
createdAt
updatedAt
```

Status conceituais:

- `ABERTO`
- `CONCLUIDO`
- `CANCELADO`

### 2. Evento interno do ciclo

Registra fatos importantes que aconteceram no ciclo.

Exemplos:

- ciclo aberto;
- prazo alterado;
- setor concluido;
- setor cancelado;
- processo devolvido para setores;
- fluxo retornou para Logistica.

Campos conceituais:

```txt
id
cicloId
tipo
dados
createdAt
usuarioId
```

Tipos possiveis:

- `CICLO_ABERTO`
- `PRAZO_ATUALIZADO`
- `CICLO_CONCLUIDO`
- `CICLO_CANCELADO`
- `DEVOLVIDO_PARA_SETOR`
- `RETORNOU_PARA_LOGISTICA`

Essa tabela serve como trilha interna e como fonte para integracoes.

### 3. Evento de integracao generico

Representa que um evento interno do Crew precisa ser sincronizado com algum sistema externo.

Essa camada ainda nao deve ser Drake pura. Ela deve saber que existe um provedor externo, mas manter um formato generico.

Campos conceituais:

```txt
id
provider
entidadeTipo
entidadeId
eventoInternoId
chaveExterna
tipoEventoExterno
payload
status
tentativas
ultimoErro
proximaTentativaAt
enviadoAt
createdAt
updatedAt
```

Exemplos de `provider`:

- `DRAKE`
- `POWER_BI`
- `WEBHOOK_CLIENTE`
- `OUTRO_SISTEMA`

Status possiveis:

- `PENDENTE`
- `ENVIANDO`
- `ENVIADO`
- `ERRO`
- `IGNORADO`

### 4. Adaptador especifico

O adaptador converte o modelo generico para o formato do fornecedor.

No caso do Drake, ele cuidaria de:

- montar o `ExternalId`;
- mapear setor para `OccurrenceType`;
- usar matricula como seletor do trabalhador;
- enviar `Start` e `End`;
- tratar headers, tenant, bearer token e erros HTTP.

Esse adaptador nao deve decidir quando nasce ou fecha um ciclo. Ele apenas transforma e envia.

## Relacao com o Drake

O Drake deve consumir os ciclos do Crew.

Exemplo de derivacao:

```txt
Ciclo Crew:
  remanejamentoFuncionarioId = cmrabc123
  numeroCiclo = 2
  setor = TREINAMENTO

Evento externo Drake:
  provider = DRAKE
  chaveExterna = crew:prod:cmrabc123:c2:TREINAMENTO
  tipoEventoExterno = CTR
```

O formato da `chaveExterna` pode ser especifico do Drake, mas ela deve ser armazenada na camada de integracao, nao como identidade primaria do ciclo do Crew.

## Fluxo esperado

Observacao importante: este fluxo descreve o comportamento final desejado. A integracao externa nao deve ser ativada na primeira etapa. Primeiro o Crew deve registrar e validar seus ciclos internamente.

### Aprovacao da solicitacao

1. Solicitação e aprovada.
2. Crew gera tarefas.
3. Crew cria ciclos dos setores aplicaveis:
   - RH;
   - Medicina;
   - Treinamento.
4. Crew registra eventos internos `CICLO_ABERTO`.
5. Em fase futura, camada de integracao cria eventos pendentes para provedores habilitados.
6. Em fase futura, adaptador externo envia os eventos.

### Conclusao de setor

1. Tarefa e concluida.
2. Crew verifica se todas as tarefas ativas daquele setor terminaram.
3. Se terminou, Crew conclui o ciclo do setor.
4. Crew registra `CICLO_CONCLUIDO`.
5. Em fase futura, camada de integracao sincroniza a conclusao.

### Retorno para Logistica

1. Todos os setores do ciclo atual terminam.
2. Crew abre ciclo de Logistica.
3. Crew registra `CICLO_ABERTO` para Logistica.
4. Em fase futura, integracoes externas recebem esse novo evento.

### Devolucao da Logistica para setores

1. Logistica devolve o processo.
2. Crew fecha ou atualiza o ciclo de Logistica conforme a regra definida.
3. Crew incrementa o numero do ciclo.
4. Crew abre novos ciclos para os setores necessarios.
5. Em fase futura, integracoes recebem novos eventos, com novas chaves externas.

### Cancelamento

1. Processo e cancelado.
2. Crew localiza ciclos abertos.
3. Crew marca os ciclos como cancelados.
4. Crew registra eventos internos de cancelamento.
5. Em fase futura, integracoes recebem encerramento/cancelamento conforme capacidade de cada provedor.

## Estrategia de implantacao segura

A implantacao deve ser feita em paralelo ao modelo atual.

Nada deve ser excluido ou substituido no primeiro momento:

- `TarefaStatusEvento` continua existindo;
- `HistoricoRemanejamento` continua existindo;
- relatorios atuais continuam funcionando;
- calculos atuais do SLA continuam como referencia;
- novo modelo de ciclos nasce ao lado para comparacao.

Objetivo inicial: provar que a nova camada consegue representar o fluxo real com mais clareza e confiabilidade, sem quebrar o que ja funciona.

## Checklist de execucao

### Fase 0: levantamento e alinhamento

- [x] Identificar tabelas atuais relacionadas a eventos e historico.
- [x] Confirmar papel de `TarefaStatusEvento`.
- [x] Confirmar papel de `HistoricoRemanejamento`.
- [x] Identificar que o relatorio SLA ja infere inicio/fim e ciclos.
- [x] Mapear pontos principais do codigo que alteram `statusTarefas`.
- [x] Mapear pontos principais do codigo que alteram `statusPrestserv`.
- [x] Mapear pontos principais do codigo que criam, concluem, reprovam ou cancelam tarefas.
- [x] Documentar a equivalencia entre fases do SLA e ciclos oficiais do Crew.
- [x] Validar com dados reais 3 a 5 remanejamentos que tenham devolucao/reprovacao.
- [ ] Confirmar nomes finais de setores oficiais: RH, MEDICINA, TREINAMENTO, LOGISTICA.
- [x] Definir que aprovacao inicial fica fora do ciclo operacional principal.

## Mapa inicial de gatilhos encontrados

Este mapa ainda deve ser refinado antes da implementacao, mas ja mostra onde o ciclo oficial precisara ser alimentado.

### Criacao de solicitacao

Arquivo principal:

- `src/app/api/logistica/remanejamentos/route.ts`

Comportamento:

- cria `SolicitacaoRemanejamento`;
- cria `RemanejamentoFuncionario`;
- inicia `statusTarefas = APROVAR SOLICITAÇÃO`;
- inicia `statusPrestserv = PENDENTE`;
- registra historico de criacao.

Uso para ciclos:

- ainda nao abre ciclo de setor;
- serve como origem do processo;
- pode registrar evento interno futuro `PROCESSO_CRIADO`, se fizer sentido.

### Aprovacao e geracao de tarefas

Arquivo principal:

- `src/app/api/tarefas/padrao/route.ts`

Comportamento:

- gera tarefas padrao/matriz;
- muda `statusTarefas` para `ATENDER TAREFAS`;
- muda `statusPrestserv` para `PENDENTE`;
- define `dataAprovado`;
- registra historico de `statusTarefas` e `statusPrestserv`.

Uso para ciclos:

- este e o principal gatilho para abrir o primeiro ciclo de setores;
- abrir ciclos para RH, Medicina e Treinamento conforme tarefas ativas criadas;
- `inicioAt` do ciclo deve usar `dataAprovado` ou a data da transicao;
- `prazoPrevistoAt` deve ser calculado pela maior `dataLimite` do setor.

### Atualizacao/conclusao individual de tarefa

Arquivos principais:

- `src/app/api/logistica/tarefas/[id]/route.ts`;
- `src/app/api/logistica/tarefas/[id]/concluir/route.ts`.

Comportamento:

- atualiza status da tarefa;
- cria `TarefaStatusEvento`;
- pode registrar alteracao de `dataLimite`;
- recalcula `statusTarefas` do remanejamento;
- quando todas as tarefas estao resolvidas, muda para `SUBMETER RASCUNHO`;
- quando ainda existem pendencias, mantem ou volta para `ATENDER TAREFAS`;
- em alguns caminhos, o historico de `statusTarefas` nao grava `valorAnterior` de forma consistente.

Uso para ciclos:

- quando uma tarefa muda status, verificar se o setor inteiro concluiu;
- quando setor conclui, fechar `RemanejamentoCiclo` daquele setor;
- quando todos os setores concluem, abrir ciclo de Logistica;
- quando `dataLimite` muda, atualizar prazo previsto do ciclo do setor;
- `TarefaStatusEvento` continua sendo fonte de evento de tarefa.

### Aprovacao em lote

Arquivo principal:

- `src/app/api/tarefas/aprovar-todas/[funcionarioId]/route.ts`

Comportamento:

- conclui tarefas em lote;
- cria varios registros em `TarefaStatusEvento`;
- recalcula `statusTarefas`.

Uso para ciclos:

- deve passar pelo mesmo servico de ciclo usado pela conclusao individual;
- precisa ser idempotente para nao fechar ciclo duas vezes.

### Deduplicacao de tarefas

Arquivo principal:

- `src/app/api/tarefas/dedup/route.ts`

Comportamento:

- cancela/remaneja tarefas duplicadas;
- recalcula `statusTarefas`;
- se nao houver pendencias, muda para `SUBMETER RASCUNHO`;
- caso contrario, muda para `ATENDER TAREFAS`;
- registra historico quando ha mudanca.

Uso para ciclos:

- pode fechar ou reabrir ciclos indiretamente;
- deve acionar reconciliacao do ciclo do remanejamento apos deduplicacao.

### Sincronizacao de tarefas padrao/matriz

Arquivo principal:

- `src/lib/tarefasPadraoSync.ts`

Comportamento:

- corrige remanejamentos inconsistentes para `ATENDER TAREFAS`;
- cria, cancela ou reativa tarefas;
- recalcula `statusTarefas`;
- pode mudar `statusPrestserv` de volta para `CRIADO`;
- registra historico em muitos cenarios;
- pode representar devolucao operacional para setores.

Uso para ciclos:

- deve ser tratado como fonte importante de devolucao/reabertura;
- precisa chamar reconciliador ou servico de ciclo apos a sincronizacao;
- nao deve depender apenas de status final, pois pode haver varias alteracoes em lote.

### Decisao da Logistica/Prestserv

Arquivo principal:

- `src/app/api/logistica/funcionario/[id]/route.ts`

Comportamento:

- atualiza `statusPrestserv`;
- pode atualizar `statusTarefas`;
- define `dataRascunhoCriado`, `dataSubmetido`, `dataResposta`, `dataConcluido` e `dataCancelado`;
- `VALIDADO` marca conclusao;
- `CANCELADO` marca cancelamento;
- registra historico de `statusPrestserv` e `statusTarefas`.

Uso para ciclos:

- `VALIDADO` deve fechar ciclo de Logistica e/ou o processo;
- `INVALIDADO`, `REPROVADO` ou estados equivalentes devem abrir novo ciclo de setores quando houver devolucao;
- `CANCELADO` deve cancelar ciclos abertos;
- transicoes manuais devem passar pelo mesmo servico de ciclo.

## Diretriz tecnica apos o mapa

Nao devemos espalhar regras de ciclo diretamente nesses arquivos.

O padrao mais seguro e criar uma camada central, por exemplo:

```txt
remanejamentoCicloService
```

Funcoes esperadas:

```txt
onTarefasGeradas(remanejamentoFuncionarioId)
onTarefaStatusAlterado(tarefaId)
onDataLimiteAlterada(tarefaId)
onStatusTarefasAlterado(remanejamentoFuncionarioId, anterior, novo)
onStatusPrestservAlterado(remanejamentoFuncionarioId, anterior, novo)
onRemanejamentoCancelado(remanejamentoFuncionarioId)
reconciliarRemanejamento(remanejamentoFuncionarioId)
```

Os pontos do codigo atual chamariam esse servico. Assim, a regra de ciclo fica centralizada, testavel e idempotente.

### Fase 1: modelo interno de ciclos

- [x] Propor schema inicial de `RemanejamentoCiclo`.
- [x] Propor schema inicial de `RemanejamentoCicloEvento`.
- [x] Validar schema final de `RemanejamentoCiclo`.
- [x] Validar schema final de `RemanejamentoCicloEvento`.
- [x] Definir tipos/status internos iniciais.
- [x] Definir indices e constraints de idempotencia.
- [x] Criar migration sem alterar comportamento existente.
- [x] Criar camada de servico para abrir, atualizar, concluir e cancelar ciclos.
- [x] Garantir que operacoes de ciclo sejam idempotentes.
- [x] Garantir que erro ao registrar ciclo seja logado e controlado sem derrubar o fluxo principal.

## Schema inicial sugerido

Este schema ainda e proposta. A implementacao deve ocorrer apenas depois de validarmos os nomes e regras.

### `RemanejamentoCiclo`

Representa o estado consolidado de um setor dentro de uma rodada operacional.

```prisma
model RemanejamentoCiclo {
  id                         String   @id @default(cuid())
  remanejamentoFuncionarioId String
  numeroCiclo                Int
  setor                      String
  status                     String   @default("ABERTO")
  origem                     String   @default("SISTEMA")
  confianca                  String   @default("ALTA")
  inicioAt                   DateTime
  prazoPrevistoAt            DateTime?
  conclusaoAt                DateTime?
  cancelamentoAt             DateTime?
  motivoAbertura             String?
  motivoFechamento           String?
  criadoPorEventoId          Int?
  createdAt                  DateTime @default(now())
  updatedAt                  DateTime @updatedAt

  remanejamentoFuncionario   RemanejamentoFuncionario @relation(fields: [remanejamentoFuncionarioId], references: [id], onDelete: Cascade)
  eventos                    RemanejamentoCicloEvento[]

  @@unique([remanejamentoFuncionarioId, numeroCiclo, setor])
  @@index([remanejamentoFuncionarioId])
  @@index([numeroCiclo])
  @@index([setor])
  @@index([status])
  @@index([origem])
}
```

Status sugeridos:

- `ABERTO`
- `CONCLUIDO`
- `CANCELADO`
- `IGNORADO`

Origem sugerida:

- `SISTEMA`: criado em tempo real pelo novo fluxo;
- `RECONSTRUIDO`: criado por backfill historico;
- `MANUAL`: ajustado manualmente em ferramenta administrativa futura.

Confianca sugerida:

- `ALTA`: dados vieram de gatilho direto ou historico consistente;
- `MEDIA`: reconstruido com alguns fallbacks;
- `BAIXA`: reconstruido com inferencia fragil, precisa revisao.

### `RemanejamentoCicloEvento`

Representa fatos ocorridos dentro do ciclo.

```prisma
model RemanejamentoCicloEvento {
  id                         Int      @id @default(autoincrement())
  cicloId                    String
  remanejamentoFuncionarioId String
  tipo                       String
  dataEvento                 DateTime @default(now())
  origem                     String   @default("SISTEMA")
  dados                      Json?
  usuarioResponsavelId       Int?
  tarefaId                   String?
  historicoRemanejamentoId   Int?
  createdAt                  DateTime @default(now())

  ciclo                      RemanejamentoCiclo @relation(fields: [cicloId], references: [id], onDelete: Cascade)
  remanejamentoFuncionario   RemanejamentoFuncionario @relation(fields: [remanejamentoFuncionarioId], references: [id], onDelete: Cascade)
  usuario                    Usuario? @relation(fields: [usuarioResponsavelId], references: [id])
  tarefa                     TarefaRemanejamento? @relation(fields: [tarefaId], references: [id])
  historicoRemanejamento     HistoricoRemanejamento? @relation(fields: [historicoRemanejamentoId], references: [id])

  @@index([cicloId, dataEvento])
  @@index([remanejamentoFuncionarioId, dataEvento])
  @@index([tipo])
  @@index([tarefaId])
  @@index([historicoRemanejamentoId])
}
```

Tipos sugeridos:

- `CICLO_ABERTO`
- `PRAZO_ATUALIZADO`
- `TAREFA_CONCLUIDA`
- `SETOR_CONCLUIDO`
- `LOGISTICA_ABERTA`
- `DEVOLVIDO_PARA_SETOR`
- `CICLO_CANCELADO`
- `CICLO_RECONSTRUIDO`
- `AJUSTE_MANUAL`

### Observacoes sobre o schema

- `RemanejamentoCiclo` guarda o estado atual e facilita consulta.
- `RemanejamentoCicloEvento` guarda a trilha de fatos e facilita auditoria.
- A constraint `remanejamentoFuncionarioId + numeroCiclo + setor` evita duplicidade.
- `origem` e `confianca` permitem reconstruir dados antigos sem fingir que eles sao perfeitos.
- Os vinculos opcionais com tarefa e historico ajudam a explicar de onde veio cada evento.
- A camada de integracao externa deve referenciar `RemanejamentoCiclo` ou `RemanejamentoCicloEvento`, mas ficar em tabela separada.

### Fase 2: gravacao em paralelo daqui para frente

- [x] Ao aprovar e gerar tarefas, abrir ciclos dos setores aplicaveis.
- [x] Ao concluir todas as tarefas de um setor, concluir o ciclo do setor.
- [x] Ao todos os setores terminarem, abrir ciclo de Logistica.
- [x] Ao Logistica devolver para setores, abrir novo numero de ciclo.
- [x] Ao cancelar remanejamento, cancelar ciclos abertos.
- [x] Registrar eventos internos para cada transicao relevante.
- [x] Criar logs operacionais para divergencias e falhas de gravacao.

### Fase 3: auditoria e comparacao

- [x] Criar endpoint simples para consultar ciclos por remanejamento.
- [x] Mostrar ciclos por funcionario, setor, inicio, prazo, fim, status e tipo.
- [x] Criar tela simples de auditoria dos ciclos.
- [x] Esconder ciclos `IGNORADO` da timeline principal, mantendo filtro para auditoria.
- [ ] Comparar ciclos oficiais com `responsabilidadeTimeline` do SLA.
- [ ] Comparar ciclos oficiais com `periodosPorSetor` do SLA.
- [ ] Comparar ciclos oficiais com `segmentosPorSetor` do SLA.
- [ ] Registrar divergencias sem alterar dados antigos automaticamente.
- [ ] Validar casos reais de alocacao, remanejamento, multialocacao e cancelamento.

### Fase 3.1: backfill controlado e conferencia inicial

- [x] Rodar reconciliacao em lote controlado de 100 remanejamentos recentes.
- [x] Registrar total processado, sucessos, falhas e duracao.
- [x] Registrar distribuicao dos ciclos por setor, status, origem e tipo.
- [x] Identificar ciclos abertos antigos que precisem de revisao.
- [x] Separar exemplos reais para validacao manual.
- [x] Ajustar regra de reconciliacao apenas se a conferencia mostrar divergencia clara.

### Fase 4: reproducao dos dados antigos

- [x] Criar rotina inicial de backfill/reconstrucao por lote controlado.
- [x] Criar modo dry-run explicito para simular sem gravar.
- [ ] Usar a logica atual do SLA como uma das referencias para reconstruir ciclos antigos.
- [ ] Usar `TarefaStatusEvento` como fonte de eventos de tarefa.
- [ ] Usar `HistoricoRemanejamento` como fonte de transicoes macro.
- [x] Marcar ciclos reconstruidos com origem diferente, por exemplo `RECONSTRUIDO`.
- [x] Marcar inferencias reconstruidas antigas como `IGNORADO` quando a reconciliacao mais precisa mostrar que nao pertencem mais a timeline principal.
- [ ] Nunca excluir ou alterar historico antigo durante a reconstrucao.
- [ ] Permitir rodar por periodo, por remanejamento ou por funcionario.
- [ ] Gerar relatorio de confianca da reconstrucao.
- [ ] Separar casos reconstruidos com baixa confianca para revisao manual.

### Fase 5: robustez e prova de falhas

- [x] Criar reconciliador para corrigir ciclos faltantes em remanejamentos recentes.
- [x] Criar protecao contra ciclos duplicados.
- [ ] Criar protecao contra ciclos abertos indefinidamente sem motivo.
- [ ] Criar auditoria de inconsistencias.
- [ ] Criar testes automatizados dos cenarios principais.
- [ ] Testar falha parcial: tarefa conclui, mas ciclo nao grava.
- [ ] Testar reprocessamento idempotente.
- [ ] Validar performance em volume real.

### Fase 6: preparacao para integracoes

- [ ] Somente iniciar depois que ciclos internos estiverem confiaveis.
- [x] Definir schema generico de `IntegracaoEventoExterno`.
- [x] Criar outbox generica.
- [x] Criar inbox generica para recebimento futuro.
- [ ] Criar mecanismo de retry.
- [ ] Criar painel ou endpoint de monitoramento da outbox.
- [ ] Criar adaptador Drake como primeiro consumidor.
- [ ] Ativar primeiro em modo dry-run.
- [ ] Ativar envio real apenas depois da validacao.

## Criterios de aceite antes da integracao externa

Antes de iniciar a camada de integracao de fato, precisamos cumprir estes criterios:

- ciclos novos sao gravados corretamente em producao sem impactar o fluxo atual;
- relatorio SLA continua funcionando sem regressao;
- divergencias entre ciclo oficial e SLA estao entendidas;
- backfill de dados antigos consegue reproduzir boa parte do historico;
- casos com baixa confianca ficam identificados;
- cancelamentos nao deixam ciclos abertos indevidamente;
- devolucoes da Logistica geram novo ciclo corretamente;
- operacoes sao idempotentes;
- falhas sao registradas e reprocessaveis;
- existe forma simples de auditar o resultado.

## Implementacao inicial realizada

Primeira implementacao criada em paralelo ao modelo atual.

Arquivos principais:

- `prisma/schema.prisma`
- `prisma/migrations/20260717110000_add_remanejamento_ciclos/migration.sql`
- `src/lib/remanejamentoCiclos.ts`
- `src/app/api/admin/remanejamento-ciclos/route.ts`
- `src/app/api/admin/remanejamento-ciclos/reconciliar/route.ts`
- `src/app/admin/remanejamento-ciclos/page.tsx`

Gatilhos conectados:

- geracao de tarefas:
  - `src/app/api/tarefas/padrao/route.ts`
- conclusao individual de tarefa:
  - `src/app/api/logistica/tarefas/[id]/concluir/route.ts`
- atualizacao individual de tarefa:
  - `src/app/api/logistica/tarefas/[id]/route.ts`
- aprovacao em lote:
  - `src/app/api/tarefas/aprovar-todas/[funcionarioId]/route.ts`
- deduplicacao:
  - `src/app/api/tarefas/dedup/route.ts`
- sincronizacao de matriz/tarefas:
  - `src/lib/tarefasPadraoSync.ts`
- avaliacao/cancelamento da Logistica:
  - `src/app/api/logistica/funcionario/[id]/route.ts`

Regras de borda ja consideradas no servico:

- tarefa cancelada nao bloqueia o encerramento do setor;
- se a ultima pendencia ativa do setor for cancelada, o ciclo aberto do setor pode ser encerrado;
- nesse caso, o evento registrado e `SETOR_SEM_PENDENCIA_ATIVA`, para diferenciar de setor concluido por execucao normal;
- para encerrar setor, o servico olha todas as tarefas daquele setor, mas considera como pendencia apenas as nao canceladas;
- se todas as tarefas ativas do setor estiverem concluidas, ou se nao sobrar nenhuma tarefa ativa porque foram canceladas, o setor fica resolvido;
- se a matriz/tarefa padrao gerar nova tarefa pendente depois de um ciclo de setor ja concluido/cancelado, o servico abre novo `numeroCiclo` em vez de tentar reabrir o ciclo fechado;
- se a Logistica estiver aberta e o processo voltar para os setores, o ciclo de Logistica e fechado como devolucao e o proximo atendimento usa `numeroCiclo + 1`;
- se o processo antigo ja estiver `VALIDADO`/`CONCLUIDO`, e os ciclos dos setores ja estiverem fechados, a reconciliacao tambem deve reconstruir o ciclo historico da Logistica como concluido;
- a fase inicial `SOLICITACAO` representa o caminho desde a criacao da solicitacao ate a aprovacao/geracao das tarefas; fica em `numeroCiclo = 0` para preservar a leitura completa do remanejamento sem misturar com as rodadas operacionais;
- se o processo inteiro for cancelado, apenas ciclos ainda abertos sao cancelados; ciclos historicos concluidos permanecem preservados.
- ciclos reconstruidos que deixam de bater com os lotes reais de tarefas nao sao apagados; ficam com `status = IGNORADO` e saem apenas da timeline padrao.
- Logistica intermediaria reconstruida so entra na timeline principal quando houver evidencia historica de ida para Logistica, hoje representada por `statusTarefas -> SUBMETER RASCUNHO` entre o fim dos setores de um ciclo e o inicio do proximo lote de tarefas.
- Quando nao houver essa evidencia, a Logistica intermediaria reconstruida fica como `IGNORADO`, preservada para auditoria.

Validacao manual:

- exemplos inicialmente classificados como possiveis divergencias em `DESLIGAMENTO SOLICITADO` foram conferidos contra producao;
- os funcionarios analisados evoluiram status posteriormente em producao;
- decisao atual: nao alterar regra de reconciliacao por esse motivo neste momento;
- se novos casos aparecerem como divergencia real, registrar na tela de auditoria e comparar com SLA antes de mudar regra operacional.
- caso KAUE TELLES GONCALVES (`cmq9ld3g3028vnv0ojbilbq0p`) mostrou que processos antigos ja validados precisavam reconstruir tambem o ciclo historico da Logistica; regra ajustada para criar Logistica de `fim dos setores` ate `dataConcluido`/`dataResposta`.
- caso TAYRINE (`cmkpcml6w000rmm0qmbq2cuhz`) mostrou um reatendimento real de Treinamento apos novo lote de tarefas; o ciclo do setor fecha quando as tarefas ativas resolvem, mesmo que a Logistica ainda nao tenha finalizado o processo.
- caso SEVERINO (`cmp4b5ewp04gspk0qigjwd8ue`) mostrou que nem todo novo lote posterior implica Logistica intermediaria; sem historico de `SUBMETER RASCUNHO` entre os lotes, a Logistica intermediaria inferida deve ficar `IGNORADO`.

### Regra atual da timeline principal

A timeline principal deve representar o melhor desenho operacional disponivel do remanejamento, sem perder a trilha de auditoria.

Entram na timeline principal:

- fase `SOLICITACAO` no ciclo 0;
- ciclos de setor com tarefas ativas associadas ao lote correspondente;
- ciclos de Logistica criados por gatilho atual do sistema;
- ciclos de Logistica reconstruidos quando ha evidencia historica de ida para Logistica;
- ciclos concluidos, abertos ou cancelados que ainda representem uma etapa real do processo.

Ficam fora da timeline principal, mas permanecem no banco:

- ciclos reconstruidos sem tarefa correspondente ao lote atual;
- Logistica intermediaria reconstruida sem evidencia de `SUBMETER RASCUNHO`;
- qualquer inferencia antiga substituida por uma reconciliacao mais precisa.

Esses casos recebem `status = IGNORADO`. A tela padrao esconde esses registros para evitar confusao na leitura do processo, mas o filtro por status permite auditar o que foi descartado e por qual motivo.

Identificacao amigavel dos ciclos:

Cada ciclo passa a ter:

- `tipoCiclo`: codigo estavel para filtro, relatorio e integracao;
- `tituloCiclo`: texto curto para tela/auditoria;
- `descricaoCiclo`: explicacao do motivo do ciclo existir.

Tipos iniciais:

| Tipo | Quando usar | Exemplo de titulo |
| --- | --- | --- |
| `ATENDIMENTO_INICIAL` | primeiro atendimento apos aprovacao inicial | `Atendimento inicial - TREINAMENTO` |
| `AJUSTE_MATRIZ` | criacao, reativacao ou cancelamento por matriz/tarefa padrao | `Ajuste de matriz - TREINAMENTO` |
| `CORRECAO_LOGISTICA` | Logistica devolveu para correcao do setor | `Correcao apos devolucao - RH` |
| `REATENDIMENTO_SETOR` | surgiu pendencia depois de ciclo do setor ja fechado | `Reatendimento do setor - MEDICINA` |
| `AVALIACAO_LOGISTICA` | ciclo da Logistica apos setores resolverem pendencias | `Avaliacao da Logistica - ciclo 1` |
| `RECONSTRUCAO_HISTORICA` | ciclo inferido a partir de dados antigos | `Ciclo reconstruido - TREINAMENTO` |

## Servico central criado

Foi criado o servico:

```txt
src/lib/remanejamentoCiclos.ts
```

Responsabilidade:

- detectar setor das tarefas;
- abrir ciclos de setores;
- fechar ciclos quando o setor conclui;
- abrir ciclo de Logistica quando `statusTarefas = SUBMETER RASCUNHO`;
- fechar Logistica quando `statusPrestserv = VALIDADO`;
- cancelar ciclos abertos quando o processo e cancelado;
- reconciliar ciclos de remanejamentos antigos ou recentes;
- registrar eventos internos do ciclo;
- executar de forma idempotente.

As chamadas operacionais usam versoes `Safe`, ou seja:

- se o ciclo falhar, o erro e logado;
- o fluxo principal do Crew nao deve quebrar por falha no registro do ciclo.

## Endpoints administrativos criados

### Consultar ciclos

```http
GET /api/admin/remanejamento-ciclos?remanejamentoId={id}
```

Filtros disponiveis:

- `remanejamentoId`
- `funcionarioId`
- `matricula`
- `limit`

Uso:

- auditar ciclos;
- comparar com SLA;
- validar backfill;
- investigar um funcionario/remanejamento especifico.

### Reconciliar ciclos

```http
POST /api/admin/remanejamento-ciclos/reconciliar
```

Payload por IDs:

```json
{
  "remanejamentoIds": ["cmr..."]
}
```

Payload por lote recente:

```json
{
  "limit": 100
}
```

Payload incluindo cancelados:

```json
{
  "limit": 100,
  "incluirCancelados": true
}
```

Payload em modo simulacao:

```json
{
  "remanejamentoIds": ["cmr..."],
  "dryRun": true
}
```

No `dryRun`, o endpoint executa a mesma reconciliacao dentro de uma transacao e faz rollback proposital ao final. A resposta informa contadores antes/depois e quantos ciclos/eventos teriam sido criados, sem persistir alteracao.

Uso:

- backfill gradual;
- reconciliacao manual;
- validacao controlada;
- correcao de ciclos faltantes.

## Resultado de validacao local

Migration aplicada localmente com sucesso.

Comando usado:

```bash
npx prisma migrate deploy
```

Tabelas criadas:

- `RemanejamentoCiclo`
- `RemanejamentoCicloEvento`

Validacao feita:

- reconciliado 1 remanejamento real em `SUBMETER RASCUNHO`;
- o sistema reconstruiu RH, Medicina e Treinamento como concluidos;
- abriu Logistica no mesmo ciclo;
- depois foi reconciliado lote de 10 remanejamentos recentes;
- resultado: 10 sucessos, 0 falhas;
- foram gerados 31 ciclos e 61 eventos no banco local.

### Backfill controlado de 100 remanejamentos

Execucao local em 2026-07-17:

```json
{
  "totalProcessado": 100,
  "totalSucesso": 100,
  "totalFalha": 0,
  "durationMs": 12904
}
```

Totais apos a execucao no banco local:

- `RemanejamentoCiclo`: 344 registros;
- `RemanejamentoCicloEvento`: 585 registros.

Distribuicao por setor, status, origem e tipo:

| Setor | Status | Origem | Tipo | Total |
| --- | --- | --- | --- | ---: |
| LOGISTICA | ABERTO | SISTEMA | AVALIACAO_LOGISTICA | 45 |
| MEDICINA | ABERTO | SISTEMA | ATENDIMENTO_INICIAL | 19 |
| MEDICINA | CONCLUIDO | RECONSTRUIDO | ATENDIMENTO_INICIAL | 9 |
| MEDICINA | CONCLUIDO | RECONSTRUIDO | RECONSTRUCAO_HISTORICA | 61 |
| MEDICINA | CONCLUIDO | SISTEMA | ATENDIMENTO_INICIAL | 11 |
| RH | ABERTO | SISTEMA | ATENDIMENTO_INICIAL | 15 |
| RH | CONCLUIDO | RECONSTRUIDO | ATENDIMENTO_INICIAL | 9 |
| RH | CONCLUIDO | RECONSTRUIDO | RECONSTRUCAO_HISTORICA | 61 |
| RH | CONCLUIDO | SISTEMA | ATENDIMENTO_INICIAL | 15 |
| TREINAMENTO | ABERTO | SISTEMA | ATENDIMENTO_INICIAL | 25 |
| TREINAMENTO | CONCLUIDO | RECONSTRUIDO | ATENDIMENTO_INICIAL | 9 |
| TREINAMENTO | CONCLUIDO | RECONSTRUIDO | RECONSTRUCAO_HISTORICA | 61 |
| TREINAMENTO | CONCLUIDO | SISTEMA | ATENDIMENTO_INICIAL | 4 |

Pontos de atencao identificados:

- existem 27 ciclos `RECONSTRUIDO` ainda classificados como `ATENDIMENTO_INICIAL`; esses ciclos foram gerados antes da inclusao de `tipoCiclo` e precisam ser normalizados por reprocessamento ou rotina de ajuste controlada;
- existem ciclos de `LOGISTICA` abertos desde abril/maio com `statusPrestserv = DESLIGAMENTO SOLICITADO`; esses casos devem ser revisados para entender se deveriam ser cancelados, encerrados ou permanecer como pendencia real;
- a execucao foi idempotente em lote: nao houve falha e a constraint de unicidade evitou duplicidade por `remanejamentoFuncionarioId + numeroCiclo + setor`.

Analise inicial dos pontos de atencao:

1. Ciclos `RECONSTRUIDO` com `tipoCiclo = ATENDIMENTO_INICIAL`
   - Nao indicam necessariamente erro do processo antigo.
   - Sao ciclos criados no primeiro teste local, antes de adicionarmos `tipoCiclo`, `tituloCiclo` e `descricaoCiclo`.
   - A correcao recomendada e uma normalizacao controlada, marcando esses registros como `RECONSTRUCAO_HISTORICA` quando `origem = RECONSTRUIDO`.
   - Nao exige alteracao do fluxo operacional.

2. Logistica aberta com `statusPrestserv = DESLIGAMENTO SOLICITADO`
   - Foram encontrados 31 remanejamentos nessa condicao:
     - 16 ja com ciclo de Logistica aberto;
     - 15 ainda sem ciclo de Logistica porque ficaram fora do lote de 100 processado.
   - Todos os casos analisados estao com `statusTarefas = SUBMETER RASCUNHO`.
   - As tarefas dos setores aparecem concluidas.
   - `dataCancelado` e `dataConcluido` estao vazias.
   - Pelo codigo atual, `DESLIGAMENTO SOLICITADO` nao e tratado como terminal. Apenas `VALIDADO` e `CANCELADO` fecham/concluem formalmente.
   - Portanto, o ciclo aberto de Logistica esta coerente com o codigo atual, mas pode divergir da leitura desejada em relatorios.
   - O relatorio SLA exclui explicitamente `PENDENTE DE DESLIGAMENTO` e `EM VALIDACAO`, mas nao exclui de forma clara `DESLIGAMENTO SOLICITADO`. Isso pode explicar parte das divergencias do fluxo antigo.

Decisao pendente:

- Confirmar regra de negocio para `DESLIGAMENTO SOLICITADO`.
- Possibilidades:
  1. tratar como pendencia real de Logistica, mantendo ciclo aberto;
  2. tratar como estado terminal de desligamento solicitado, fechando ciclo de Logistica com tipo/evento especifico;
  3. tratar como fila paralela de desligamento, excluindo dos indicadores de ciclo operacional comum;
  4. ajustar apenas relatorios/SLA para nao misturar desligamento solicitado com pendencia comum.

Recomendacao tecnica provisoria:

- Nao alterar automaticamente esses ciclos agora.
- Criar uma classificacao explicita para desligamento na camada de auditoria antes de decidir se fecha ou exclui.
- Validar 3 a 5 casos com Logistica/Prestserv para entender se `DESLIGAMENTO SOLICITADO` significa fim da atuacao do Crew ou uma pendencia em aberto.

Exemplos separados para validacao manual por ciclos de Logistica abertos antigos:

| Funcionario | Matricula | Inicio ciclo | Status tarefas | Status Prestserv |
| --- | --- | --- | --- | --- |
| JOCEMY OLIVEIRA MESQUITA | FRI-05-01159 | 2026-04-06 | SUBMETER RASCUNHO | DESLIGAMENTO SOLICITADO |
| CLAYTON PALMARES DOS SANTOS | FRI-05-01173 | 2026-04-08 | SUBMETER RASCUNHO | DESLIGAMENTO SOLICITADO |
| DEILSON DOS SANTOS SILVA | FRI-05-00537 | 2026-04-08 | SUBMETER RASCUNHO | DESLIGAMENTO SOLICITADO |
| JHONATAN SAMPAIO PESSANHA | FRI-05-01222 | 2026-04-08 | SUBMETER RASCUNHO | DESLIGAMENTO SOLICITADO |
| ISAC TEIXEIRA DE SOUZA | FRI-05-02719 | 2026-05-06 | SUBMETER RASCUNHO | EM VALIDAÇÃO |

Exemplo validado:

```txt
numeroCiclo = 1
RH          CONCLUIDO  RECONSTRUIDO
MEDICINA    CONCLUIDO  RECONSTRUIDO
TREINAMENTO CONCLUIDO  RECONSTRUIDO
LOGISTICA   ABERTO     SISTEMA
```

## Observacoes da primeira implementacao

- A primeira reconciliacao de remanejamentos antigos pode criar ciclos de setores como `RECONSTRUIDO` e `confianca = MEDIA`.
- Ciclos criados por gatilho real usam `origem = SISTEMA` e `confianca = ALTA`.
- O endpoint de reconciliacao permite executar o backfill aos poucos.
- Nenhuma tabela antiga foi excluida.
- Nenhum relatorio atual foi substituido.
- A integracao externa continua fora do escopo ate validarmos os ciclos.

## Saneamento de ciclos sobrepostos

Problema identificado em 13/08/2026:

- A reconstrucao historica separava novos lotes de tarefas por intervalo de criacao maior que 7 dias.
- Isso criava falso novo ciclo quando uma tarefa nova do mesmo setor surgia enquanto ainda havia tarefa antiga aberta.
- Exemplo validado: GABRIEL RODRIGUES DA CONCEICAO (`FRI-01-11004`) teve `PLANO DE SAUDE` criado em 09/02/2026, mas o RH ainda tinha `CTPS` aberta ate 18/02/2026.
- Portanto, nao era novo ciclo; era ampliacao do ciclo do mesmo setor.

Regra adotada:

- Novo lote do mesmo setor so vira novo ciclo quando o ciclo anterior daquele setor ja terminou antes do inicio do novo lote.
- Se houver sobreposicao temporal, o lote novo e consolidado no ciclo anterior.
- O ciclo reconstruido excedente e mantido no banco com `status = IGNORADO`, para auditoria.
- Logistica reconstruida que ficou sem ciclo de setores correspondente pode ser realocada para o ciclo valido anterior.
- Excecao de seguranca: se a Logistica ja tiver outbox enviada/agendada, o numero do ciclo e preservado para manter idempotencia com o `ExternalId` ja usado no Drake.

Validacao local:

- Sobreposicoes antes do saneamento: 119.
- Gabriel saneado isoladamente: 1 ciclo RH ignorado e Logistica realocada para o ciclo correto.
- Saneamento global aplicado localmente: sobreposicoes restantes = 0.
- Outbox production enviada para ciclo ignorado: 0.
- `ExternalId` production divergente do numero atual do ciclo: 0.

Ferramenta administrativa:

```bash
node scripts/sanear-ciclos-sobrepostos.cjs
node scripts/sanear-ciclos-sobrepostos.cjs --apply
node scripts/sanear-ciclos-sobrepostos.cjs --rem-id=<remanejamentoFuncionarioId>
```

O script roda em `dry-run` por padrao e so altera dados com `--apply`.

## Tabelas candidatas

Nomes ainda em amadurecimento:

### Opcao mais explicita

- `RemanejamentoCiclo`
- `RemanejamentoCicloEvento`
- `IntegracaoEventoExterno`

### Opcao mais generica

- `FluxoCiclo`
- `FluxoCicloEvento`
- `IntegracaoOutbox`

### Opcao intermediaria

- `CadastroCiclo`
- `CadastroCicloEvento`
- `IntegracaoEvento`

Preferencia atual: `RemanejamentoCiclo`, porque o fluxo nasce no contexto do remanejamento de funcionario e fica claro para o dominio atual.

## Pontos em aberto

1. Confirmar se todo ciclo deve ser por setor ou se Logistica deve ser um tipo especial.
2. Definir se `numeroCiclo` e global por remanejamento ou sequencial por setor.
3. Definir como detectar formalmente a devolucao da Logistica para setor.
4. Definir nivel de confianca e regras de excecao para reconstrucao de ciclos antigos.
5. Definir se os ciclos devem aparecer em alguma tela administrativa.
6. Definir se a camada generica de integracao tera uma unica outbox ou tabelas separadas por provedor.

## Decisoes preliminares

1. O modelo do ciclo deve ser interno ao Crew.
2. A integracao com Drake deve ser uma camada consumidora do ciclo, nao a origem do desenho.
3. A matricula identifica o funcionario no sistema externo.
4. O `remanejamentoFuncionarioId` identifica o processo interno do Crew.
5. O ciclo deve existir porque um mesmo remanejamento pode voltar aos setores mais de uma vez.
6. O `externalId` do Drake deve ser derivado do ciclo, mas armazenado na camada de integracao.
7. Falha de integracao nao pode quebrar o fluxo operacional do Crew.
8. O novo modelo deve nascer em paralelo ao modelo atual, sem excluir historicos ou relatorios existentes.
9. Dados antigos devem ser reproduzidos/backfillados depois, com origem e nivel de confianca.
10. A camada de integracao externa so deve ser iniciada depois que o ciclo interno estiver validado.

## Proximo passo sugerido

Antes de implementar, mapear exatamente onde o Crew hoje muda o fluxo entre:

- aprovacao e geracao de tarefas;
- atendimento dos setores;
- retorno para Logistica;
- devolucao da Logistica para setores;
- cancelamento.

Com esse mapa, definimos a criacao automatica dos ciclos com menor risco.
