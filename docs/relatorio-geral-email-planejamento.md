# Relatorio Geral de Pendencias - Envio por E-mail

## Objetivo
Registrar o que foi implementado para envio automatico do Relatorio Geral de Pendencias e qual deve ser a evolucao correta da solucao.

Por enquanto a funcionalidade fica operacional usando variaveis de ambiente e GitHub Secrets/Vars. Essa abordagem atende a necessidade imediata, mas nao e a arquitetura ideal para administracao de destinatarios e regras de envio.

## O que foi feito
1. Criado envio por e-mail do Relatorio Geral de Pendencias.
2. O e-mail envia um resumo executivo em HTML.
3. O Excel do relatorio e anexado ao e-mail.
4. O relatorio usa os filtros padrao do proprio Relatorio Geral de Pendencias:
- Solicitacoes a partir de `01/01/2026`.
- Cancelados desconsiderados.
5. Criado suporte a snapshot do relatorio em banco de dados.
6. Criado endpoint interno para disparo do relatorio.
7. Criado mecanismo para solicitacao manual do relatorio por e-mail.
8. Configuracoes sensiveis foram movidas para variaveis de ambiente/Secrets.
9. Removido uso de diretorio local para snapshots, evitando acumulo de arquivos no servidor.

## Como esta funcionando agora
As configuracoes operacionais ainda estao em variaveis de ambiente.

Principais variaveis:
- `REPORT_GENERAL_RECIPIENTS`: lista de destinatarios que recebem o relatorio.
- `REPORT_REQUEST_ALLOWED_SENDERS`: lista de remetentes autorizados a solicitar relatorio por e-mail.
- `RELATORIO_EMAIL_SERVICE_TOKEN`: token interno para proteger o endpoint de envio.
- `SMTP_*`: configuracoes tecnicas de envio.
- `IMAP_*`: configuracoes tecnicas para leitura de solicitacoes por e-mail.
- `ENABLE_REPORT_EMAIL_REQUESTS`: ativa ou desativa a rotina de solicitacao por e-mail.

Essa solucao permite manter o envio funcionando agora, mas qualquer alteracao de destinatario depende de ajuste em configuracao/deploy.

## Limite da solucao atual
1. Destinatarios nao sao administrados pela aplicacao.
2. Incluir ou remover destinatario exige alterar variavel de ambiente/GitHub Var.
3. Nao ha tela para ativar, desativar ou auditar quem recebe o relatorio.
4. A regra de quem pode solicitar relatorio por e-mail fica fora do banco.
5. A manutencao fica mais tecnica do que operacional.

## Caminho correto
O caminho correto e mover a administracao de destinatarios e permissoes para o banco de dados e expor isso em uma tela administrativa da aplicacao.

### 1. Criar tabela de inscricoes de relatorio
Sugestao de tabela: `report_subscriptions` ou `relatorio_destinatarios`.

Campos sugeridos:
- `id`
- `reportKey`
- `name`
- `email`
- `active`
- `receivesScheduledEmail`
- `canRequestByEmail`
- `frequency`
- `lastSentAt`
- `createdBy`
- `updatedBy`
- `createdAt`
- `updatedAt`

### 2. Criar tela administrativa
Sugestao de menu:
`Configuracoes > Relatorios > Destinatarios`

Funcionalidades:
1. Listar destinatarios.
2. Adicionar destinatario.
3. Editar nome/e-mail.
4. Ativar ou desativar envio automatico.
5. Autorizar ou bloquear solicitacao por e-mail.
6. Ver ultimo envio.
7. Auditar alteracoes.

### 3. Manter env apenas para infraestrutura
Variaveis de ambiente devem continuar existindo apenas para configuracoes tecnicas:
- SMTP host, porta, usuario e senha.
- IMAP host, porta, usuario e senha.
- Token interno de servico.
- Flags tecnicas de ativacao.

Destinatarios, permissoes e regras operacionais devem ficar no banco.

### 4. Ajustar o job de envio
O job semanal deve:
1. Buscar no banco os destinatarios ativos do relatorio.
2. Gerar ou recuperar o snapshot correto.
3. Enviar o e-mail para os destinatarios cadastrados.
4. Registrar log de envio.

### 5. Ajustar solicitacao por e-mail
A rotina de leitura por e-mail deve:
1. Validar se o remetente esta cadastrado e autorizado.
2. Interpretar a solicitacao.
3. Se a data for hoje, gerar relatorio em tempo real.
4. Se a data for anterior, buscar snapshot existente.
5. Se a data for invalida ou sem snapshot, responder com orientacao clara.
6. Aplicar limite de envio para evitar abuso ou loop.

### 6. Criar auditoria de envio
Sugestao de tabela: `report_delivery_logs`.

Campos sugeridos:
- `id`
- `reportKey`
- `snapshotId`
- `recipientEmail`
- `triggerType` (`scheduled`, `manual`, `email_request`)
- `status` (`sent`, `failed`, `skipped`)
- `errorMessage`
- `requestedBy`
- `sentAt`

## Decisao atual
Manter a implementacao atual funcionando por enquanto, usando variaveis de ambiente para destinatarios e autorizados.

Quando a rotina estiver validada em producao, evoluir para a arquitetura correta com cadastro em banco, tela administrativa e auditoria completa.

