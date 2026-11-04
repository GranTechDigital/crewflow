# SISPAT na Logística

A página `/logistica/sispat` aparece em **Logística → SISPAT dos Funcionários**. Seu foco é a gestão dos funcionários; **Importar / exportar** abre um modal Headless UI com abas Importar, Exportar e Histórico. A tela é somente clara, sem outra caixa de fundo dentro do contêiner existente. O histórico só é carregado ao abrir o modal. Lista todos os funcionários, com busca e paginação, e permite cadastrar, editar e excluir apenas `Funcionario.sispat`. Excluir o SISPAT não exclui o funcionário.

## Acesso

Administração e Logística (Editor/Gestor) têm acesso. A equipe legada Logística equivale a Editor. Logística (Visualizador), Liderança e outros setores são bloqueados na página, no menu e em todas as operações da API, incluindo histórico, backup e desfazer. Usuário e equipe devem estar ativos; a API verifica o vínculo atual no banco. A confirmação de uma prévia exige o mesmo usuário que enviou o arquivo.

## Formato e análise

- A importação prefere a aba do modelo com **Matrícula** e **SISPAT**, nessa ordem. Se ela não existir, localiza esses cabeçalhos nas primeiras 20 linhas, em qualquer ordem, e ignora colunas extras. Abas ou cabeçalhos ambíguos são recusados. Zeros e hífens são preservados. A exportação mantém apenas as duas colunas e contém todos os funcionários.
- Em arquivos com várias abas, o importador exige exatamente uma aba nesse formato e usa essa aba. O arquivo original fornecido usa `Planilha1`: 7.114 linhas, 6.214 números e 900 registros “Sem SISPAT”.
- Até 5 MB, 20.000 linhas e 40 MB declarados de conteúdo ZIP. Arquivo protegido, inválido ou sem cabeçalho reconhecível gera mensagem de erro sem alterar funcionários.
- A análise salva o resultado e o backup no servidor. Não altera funcionários nem cria funcionários ausentes.
- A matrícula é a chave de busca exata. SISPAT aceita 1 a 30 dígitos. Vazio e “Sem SISPAT” são ignorados.
- **SISPAT igual ao atual é desconsiderado: não executa UPDATE e não modifica a data de atualização.** Isso também vale para edição individual sem mudança.
- Fórmulas, links, erros de célula, matrícula vazia, coluna adicional, SISPAT inválido e duplicidade ficam registrados por linha. Todas as ocorrências de uma matrícula duplicada são marcadas como erro. A presença de qualquer erro bloqueia a confirmação do arquivo inteiro; as demais mudanças previstas ficam como “Não atualizado”. Corrigir e reenviar o arquivo.

## Revisão e pendências

- Na aba Importar, **Baixar modelo (.xlsx)** entrega um arquivo vazio com apenas Matrícula e SISPAT, sem dados de funcionários. A resposta é validada antes do download; falhas de sessão, JSON e HTML aparecem na página e não são salvos como planilha.
- A prévia distingue preenchimento de campo vazio e substituição de um número já existente, com contagens e filtros. Análises antigas também recebem essa classificação a partir de seus valores salvos.
- Duplicidade de SISPAT entre matrículas diferentes gera alerta informativo, sem bloqueio automático. A análise considera a planilha e os cadastros atuais, inclusive funcionários fora do arquivo; trocas previstas que retiram um vínculo antigo não geram falso alerta. Os envolvidos ficam salvos como fotografia da análise e podem ser consultados em páginas de 50.
- Nomes de quem enviou e desfez ficam preservados no histórico. IDs continuam disponíveis para auditoria; registros antigos recebem os nomes existentes na migração.
- **Baixar pendências (.xlsx)** gera um relatório separado com abas Pendências, Corrigir e importar (somente Matrícula/SISPAT) e Duplicidades. A aba de correção pode ser ajustada e reenviada; o leitor reconhece essa aba sem confundi-la com as demais. A exportação padrão continua com apenas as duas colunas.

## Interface

O modal usa Dialog/Tabs do Headless UI e Button/Card/Badge do Flowbite React, com tema claro local e ícones Lucide. A seleção de arquivo e a análise ficam alinhadas; quatro cards mostram alterações, registros corretos, ignorados e pendências. Os demais estados continuam acessíveis no filtro. Avisos de substituição/duplicidade são compactos e a barra de decisão separa os downloads da confirmação. A conferência visual desta revisão foi feita com uma prévia real de 7.114 linhas, sem confirmar nem alterar funcionários.

## Resultado e resumo

O resultado lista linha original, funcionário/matrícula, SISPAT anterior, SISPAT recebido e motivo da situação. Os grupos são: a atualizar, atualizado, já correto/desconsiderado, sem SISPAT/ignorado, matrícula não encontrada, erro na linha, não atualizado e restaurado pelo backup.

A paginação ocorre no servidor: 50 linhas por página, com filtro por situação. A API limita respostas a 100 linhas. O histórico mostra 10 importações por página e persiste após atualizar ou fechar o navegador. O resumo e os totais refletem a importação selecionada, inclusive casos sem nenhuma alteração necessária.

A prévia vale por 15 minutos. O botão de confirmação usa a análise persistida; não aceita um conjunto de alterações enviado pelo navegador. Não é necessário reenviar o XLSX para confirmar.

## Progresso do processamento

A confirmação e a restauração enviam progresso por lotes reais (até 300 registros) via resposta NDJSON. A tela mostra quantidade, percentual e a etapa de confirmação. O percentual fica limitado a 99% até o commit; 100% e sucesso só aparecem após a transação terminar. Um erro de lote continua revertendo toda a operação.

Uma trava síncrona impede cliques duplicados antes mesmo da atualização visual dos botões. O modal permanece bloqueado enquanto processa. Se a conexão cair, a tela orienta consultar o histórico antes de repetir; o transporte não altera as garantias da transação nem dispara reenvio automático. Clientes que não solicitam o stream mantêm a resposta JSON anterior.

## Backup, gravação e desfazer

- O backup de campo fica salvo em `SispatImportacao.registros`, antes de qualquer mudança em funcionário. Contém os valores anteriores (inclusive nulos), valores recebidos, IDs, matrículas e versões dos cadastros. Não é um dump completo do banco.
- **Baixar backup e relatório** exporta um JSON com o resultado completo. O download é exclusivo da Administração e opcional: a cópia no servidor permanece disponível, mesmo sem baixar o JSON. Essa regra é aplicada na interface e na API; os demais fluxos da Logística continuam disponíveis.
- A aplicação usa SQL parametrizado e uma transação única, em lotes de até 300 funcionários. Só os registros diferentes são atualizados. Se houver conflito, expiração ou falha, nenhum lote da importação é confirmado. O histórico registra o erro e os registros não atualizados.
- A versão posterior de cada cadastro e o resultado são salvos na mesma transação dos SISPATs. Se não for possível salvar o resultado, a atualização dos funcionários também é revertida.
- **Desfazer importação** restaura os valores anteriores diretamente da cópia no servidor, com confirmação explícita. Não aceita um backup enviado pelo cliente. A ação fica disponível somente para uma importação aplicada e só pode concluir uma vez.
- O desfazer compara o SISPAT e a versão do cadastro com os que foram gravados pela importação. Qualquer alteração posterior, mesmo em outro campo do funcionário, bloqueia a restauração inteira. Não sobrescreve alterações posteriores nem restaura parte do lote.
- Autor da análise, autor da restauração, datas, valores e resultados ficam registrados. Os IDs de autoria são conservados mesmo se um usuário for removido. O histórico não possui exclusão automática.

## Migração e publicação isolada

A migração `20261104180000_add_sispat_importacao` cria a tabela de histórico/backup `SispatImportacao` e seu índice. `20261104190000_add_sispat_revisao` acrescenta os nomes dos responsáveis e os alertas de duplicidade; a atualização de nomes altera somente o histórico, nunca os funcionários. **Aplicar a migração antes de disponibilizar a versão nova.** Não há dependência de migrações ou código da importação de certificados Drake; não há chamadas externas ao Drake.

```powershell
npx prisma migrate deploy
```

Na validação local, foi conferido que essa era a única migração pendente do worktree antes de aplicá-la. Nenhum SISPAT de funcionário real foi alterado. Não houve implantação em produção.

Usar somente a branch `fix/logistica-sispat`, baseada em `main`, ou aplicar exclusivamente o commit de SISPAT. O trabalho de certificados continua separado na pasta/branch original. Revisar o diff contra `main` antes de publicar.

## Validação

```powershell
node --test tests/sispat/*.test.cjs
node node_modules/typescript/bin/tsc -p tests/sispat/tsconfig.json
node node_modules/eslint/bin/eslint.js src/lib/sispat src/app/api/logistica/sispat src/app/logistica/sispat
npx prisma validate

# PostgreSQL local: informar caminho do .env de desenvolvimento, sem expor credenciais.
$env:SISPAT_TEST_ENV_FILE = 'CAMINHO_DO_ENV_LOCAL'
node --test tests/sispat/postgres.integration.cjs
Remove-Item Env:SISPAT_TEST_ENV_FILE
```

17 testes de parser, rotas, autorização, CRUD, revisão e contratos, mais 14 testes em PostgreSQL real, totalizando 31. Na revisão do progresso foram executados somente os dois testes específicos de stream e contagem de lotes, além da checagem estática do escopo. O teste PostgreSQL cria um schema exclusivo `sispat_test_<id aleatório>`, verifica o namespace antes de manipular tabelas e remove somente esse schema ao terminar. Não acessa os funcionários reais do app. Verifica backup antes da gravação, campo nulo, ausência de UPDATE para iguais, erros por linha, paginação, concorrência, expiração, falha no segundo lote, falha ao gravar auditoria e bloqueio de restauração após alteração posterior.

No navegador, com respostas simuladas, foram conferidos resultado paginado (125 linhas), filtro, backup anterior à confirmação, aplicação, histórico após reload, restauração, bloqueio de arquivo com erros e histórico paginado. A versão clara foi conferida em 1440 e 1280 pixels, inclusive com o sistema no modo escuro; sem erros de JavaScript. No modal foram conferidos foco, Escape, abas, revisão, envolvidos e relatório de pendências. O modelo vazio foi conferido diretamente na API real. A API real do histórico também respondeu 200 no banco local. O layout global existente mantém largura mínima de 1200 pixels.

TypeScript e ESLint do escopo passam. O repositório completo já apresenta erros TypeScript preexistentes fora desta melhoria.
