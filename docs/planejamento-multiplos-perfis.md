# Planejamento: suporte a multiplos perfis por usuario

## Objetivo

Permitir que um usuario tenha mais de um grupo de acesso no sistema, por exemplo `RH (Gestor)` e `Treinamento (Gestor)`, sem perder acesso atual, sem quebrar login, navegacao, rotas protegidas, notificacoes ou auditoria.

O sistema atual foi desenhado com uma relacao simples:

- `Usuario.equipeId` aponta para uma unica `Equipe`.
- As permissoes sao calculadas a partir de uma unica equipe.
- As telas de cadastro/edicao de usuarios permitem escolher apenas um perfil.

O novo desenho precisa aceitar multiplos perfis, mas manter compatibilidade com o modelo atual durante a transicao.

## Principios de seguranca

1. Nenhum usuario deve perder acesso durante a migracao.
2. O campo atual `Usuario.equipeId` deve continuar existindo inicialmente.
3. O `equipeId` atual deve virar a equipe principal do usuario.
4. Todo usuario existente deve receber automaticamente uma associacao equivalente na nova tabela.
5. Rotas protegidas devem validar permissoes agregadas, nao apenas o nome de uma equipe.
6. A mudanca deve ser liberada em etapas pequenas, com verificacoes antes e depois do deploy.
7. Deve existir rollback simples para voltar ao comportamento anterior.

## Diagnostico atual

### Banco

Modelo atual:

```prisma
model Usuario {
  id            Int     @id @default(autoincrement())
  funcionarioId Int     @unique
  senha         String
  equipeId      Int
  ativo         Boolean @default(true)
  equipe        Equipe  @relation(fields: [equipeId], references: [id])
}

model Equipe {
  id       Int       @id @default(autoincrement())
  nome     String    @unique
  usuarios Usuario[]
}
```

Isso limita cada usuario a uma unica equipe.

### Codigo

Pontos principais que dependem de uma unica equipe:

- `src/app/api/auth/login/route.ts`
- `src/app/api/auth/verify/route.ts`
- `src/app/api/auth/me/route.ts`
- `src/app/api/auth/refresh/route.ts`
- `src/app/hooks/useAuth.tsx`
- `src/components/ProtectedRoute.tsx`
- `src/components/layout/Sidebar.tsx`
- telas de usuarios por setor:
  - `src/app/admin/usuarios/page.tsx`
  - `src/app/rh/usuarios/page.tsx`
  - `src/app/treinamento/usuarios/page.tsx`
  - `src/app/logistica/usuarios/page.tsx`
  - `src/app/medicina/usuarios/page.tsx`
  - `src/app/planejamento/usuarios/page.tsx`
- APIs de usuarios:
  - `src/app/api/usuarios/route.ts`
  - `src/app/api/usuarios/[id]/route.ts`
  - `src/app/api/usuarios/[id]/equipe/route.ts`

## Modelo proposto

Criar uma tabela de relacionamento muitos-para-muitos:

```prisma
model UsuarioEquipe {
  id        Int      @id @default(autoincrement())
  usuarioId Int
  equipeId  Int
  principal Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  usuario Usuario @relation(fields: [usuarioId], references: [id], onDelete: Cascade)
  equipe  Equipe  @relation(fields: [equipeId], references: [id], onDelete: Restrict)

  @@unique([usuarioId, equipeId])
  @@index([usuarioId])
  @@index([equipeId])
  @@index([principal])
}
```

Adicionar relacoes:

```prisma
model Usuario {
  // manter equipeId e equipe atuais na fase 1
  equipes UsuarioEquipe[]
}

model Equipe {
  usuariosVinculados UsuarioEquipe[]
}
```

Importante: na fase inicial, `Usuario.equipeId` continua sendo a equipe principal. Isso reduz risco porque historicos, notificacoes e trechos antigos continuam funcionando.

## Fase 0: preparacao e inventario

Antes de alterar comportamento:

1. Listar todos os usuarios ativos e suas equipes atuais.
2. Listar equipes cadastradas e quantidade de usuarios.
3. Confirmar se existe algum usuario sem equipe valida.
4. Confirmar se ha equipes cadastradas que nao estao mapeadas em `TEAM_PERMISSIONS`.
5. Corrigir o caso de `Administracao (Visualizador)`, que hoje pode ser interpretado como Administracao completa se cair na normalizacao generica.

Consultas sugeridas:

```sql
select u.id, f.nome, f.matricula, e.id as equipe_id, e.nome as equipe
from "Usuario" u
join "Funcionario" f on f.id = u."funcionarioId"
join "Equipe" e on e.id = u."equipeId"
where u.ativo = true
order by e.nome, f.nome;
```

```sql
select e.id, e.nome, count(u.id) as usuarios
from "Equipe" e
left join "Usuario" u on u."equipeId" = e.id
group by e.id, e.nome
order by e.nome;
```

## Fase 1: migracao estrutural sem mudar comportamento

Criar a tabela `UsuarioEquipe` e popular com os dados atuais.

Passos:

1. Criar migration Prisma adicionando `UsuarioEquipe`.
2. Rodar backfill:

```sql
insert into "UsuarioEquipe" ("usuarioId", "equipeId", "principal", "createdAt", "updatedAt")
select u.id, u."equipeId", true, now(), now()
from "Usuario" u
where not exists (
  select 1
  from "UsuarioEquipe" ue
  where ue."usuarioId" = u.id
    and ue."equipeId" = u."equipeId"
);
```

3. Garantir que cada usuario tenha ao menos uma equipe vinculada:

```sql
select u.id
from "Usuario" u
left join "UsuarioEquipe" ue on ue."usuarioId" = u.id
where ue.id is null;
```

4. Garantir que cada usuario tenha uma unica principal:

```sql
select "usuarioId", count(*) as principais
from "UsuarioEquipe"
where principal = true
group by "usuarioId"
having count(*) <> 1;
```

Resultado esperado: o sistema continua funcionando exatamente como antes.

## Fase 2: leitura de multiplas equipes no backend

Alterar as consultas de autenticacao para carregar tambem `equipes`.

Endpoints:

- `login`
- `verify`
- `me`
- `refresh`

Formato recomendado no retorno:

```ts
{
  equipe: "RH (Gestor)",
  equipeId: 13,
  equipes: [
    { id: 13, nome: "RH (Gestor)", principal: true },
    { id: 19, nome: "Treinamento (Gestor)", principal: false }
  ],
  equipeIds: [13, 19],
  permissoes: [
    "canAccessFuncionarios",
    "canAccessRH",
    "canAccessRHGestor",
    "canAccessTreinamento",
    "canAccessTreinamentoGestor"
  ]
}
```

Manter `equipe` e `equipeId` para compatibilidade com telas antigas.

## Fase 3: calculo agregado de permissoes

Criar funcao nova:

```ts
export function getPermissionsByTeams(teamNames: string[]): string[] {
  return Array.from(
    new Set(teamNames.flatMap((teamName) => getPermissionsByTeam(teamName))),
  );
}
```

Regras:

- Se qualquer equipe der `admin`, o usuario tem acesso total.
- Permissoes repetidas devem ser removidas.
- Equipes desconhecidas devem cair no comportamento seguro atual: apenas `canAccessFuncionarios`, ou nenhuma permissao extra, conforme decisao final.

Tambem corrigir explicitamente o mapeamento de `Administracao (Visualizador)` para evitar acesso total indevido.

## Fase 4: front-end e contexto de autenticacao

Atualizar `useAuth` para aceitar:

```ts
type UsuarioAutenticado = {
  equipe: string;
  equipeId: number;
  equipes?: Array<{
    id: number;
    nome: string;
    principal: boolean;
  }>;
  equipeIds?: number[];
  permissoes: string[];
}
```

Regras de compatibilidade:

- Se `equipes` nao vier da API, montar uma lista com `equipe/equipeId`.
- `usuario.equipe` continua existindo para telas antigas.
- `usuario.permissoes` passa a ser agregado de todas as equipes.

## Fase 5: protecao de rotas

Hoje o `ProtectedRoute` valida permissoes e tambem equipe unica.

Novo comportamento:

1. Validar permissao primeiro.
2. Se a permissao permite, liberar.
3. Quando `requiredEquipe` for usado, comparar contra todas as equipes do usuario.

Exemplo:

```ts
const nomesEquipesUsuario = usuario.equipes?.map((e) => e.nome) ?? [usuario.equipe];
const matchEquipe = nomesEquipesUsuario.some((nome) =>
  equipePermitida(nome, requiredEquipe),
);
```

Meta: um usuario com `RH (Gestor)` e `Treinamento (Gestor)` deve abrir tanto paginas de RH quanto paginas de Treinamento.

## Fase 6: APIs de usuarios

Atualizar:

- `GET /api/usuarios`
- `POST /api/usuarios`
- `PUT/PATCH /api/usuarios/[id]`
- `PUT /api/usuarios/[id]/equipe`

Entrada recomendada:

```json
{
  "funcionarioId": 123,
  "senha": "inicial",
  "equipeId": 13,
  "equipeIds": [13, 19],
  "equipePrincipalId": 13
}
```

Compatibilidade:

- Se vier apenas `equipeId`, manter comportamento atual e criar um unico vinculo.
- Se vier `equipeIds`, gravar todos.
- `equipePrincipalId` atualiza tambem `Usuario.equipeId`.

Cuidados:

- Nao permitir usuario sem equipe.
- Nao permitir equipe principal fora da lista de equipes.
- Gestores setoriais so devem conseguir atribuir equipes do proprio departamento, exceto administracao.

## Fase 7: telas de usuarios

Alterar o cadastro/edicao de usuarios:

1. Trocar select unico por selecao multipla.
2. Permitir marcar equipe principal.
3. Exibir chips/badges com todas as equipes do usuario.
4. Manter filtros por equipe funcionando.

Sugestao de UX:

- Campo "Equipe principal" com select unico.
- Campo "Perfis adicionais" com checkboxes ou multiselect.
- Ao escolher equipe principal, ela entra automaticamente na lista de perfis.

## Fase 8: auditoria, historico e notificacoes

Na fase 1, manter uso de `equipeId` principal para:

- historico de remanejamento
- eventos de tarefa
- notificacoes
- registros de sincronizacao

Isso evita mudanca ampla e reduz risco.

Fase futura opcional:

- Permitir "atuar como" quando usuario tiver mais de uma equipe.
- Exemplo: coordenadora escolhe atuar como `RH` ou `Treinamento` antes de concluir tarefas.
- So implementar se houver necessidade operacional real.

## Plano de testes

### Testes de regressao obrigatorios

1. Usuario comum com uma equipe continua acessando exatamente o que acessava.
2. Usuario `RH (Gestor)` continua vendo RH.
3. Usuario `Treinamento (Gestor)` continua vendo Treinamento.
4. Usuario com `RH (Gestor)` + `Treinamento (Gestor)` ve os dois modulos.
5. Usuario `Logistica (Visualizador)` nao ganha permissao de edicao.
6. Usuario `Administracao` continua com acesso total.
7. Usuario `Administracao (Visualizador)` nao deve receber acesso total se a regra for visualizador.
8. Rotas protegidas bloqueiam usuario sem permissao.
9. Sidebar mostra apenas os modulos permitidos.
10. Login, refresh, verify e me retornam o mesmo usuario sem erro.

### Testes de banco

Antes do deploy:

```sql
select count(*) from "Usuario";
select count(distinct "usuarioId") from "UsuarioEquipe";
```

Os dois valores devem bater, se todo usuario tiver pelo menos um vinculo.

Depois do deploy:

```sql
select u.id, f.nome
from "Usuario" u
join "Funcionario" f on f.id = u."funcionarioId"
left join "UsuarioEquipe" ue on ue."usuarioId" = u.id
where ue.id is null;
```

Resultado esperado: zero linhas.

## Plano de rollback

Como `Usuario.equipeId` sera mantido, o rollback e simples:

1. Voltar o codigo para usar apenas `Usuario.equipeId`.
2. Ignorar a tabela `UsuarioEquipe`.
3. Nao remover a tabela no rollback emergencial.

Se necessario, a tabela pode ficar no banco sem afetar o sistema antigo.

Rollback nao deve apagar dados.

## Ordem recomendada de implementacao

1. Corrigir mapeamento de permissoes sensiveis, especialmente `Administracao (Visualizador)`.
2. Criar migration `UsuarioEquipe` com backfill.
3. Alterar backend de auth para retornar equipes multiplas e permissoes agregadas, mantendo campos antigos.
4. Alterar `useAuth` e `ProtectedRoute`.
5. Alterar APIs de usuarios com compatibilidade para `equipeId`.
6. Alterar telas de usuarios para multiplos perfis.
7. Testar com usuario piloto: coordenadora RH + Treinamento.
8. Liberar para producao.
9. Monitorar login, sidebar, acesso a RH, acesso a Treinamento e notificacoes.

## Criterios de aceite

1. Nenhum usuario existente perde acesso apos a migracao.
2. Todos os usuarios ativos possuem ao menos uma linha em `UsuarioEquipe`.
3. O usuario com multiplos perfis acessa todos os modulos correspondentes.
4. O usuario com perfil unico continua com o mesmo comportamento anterior.
5. As permissoes da sidebar batem com as permissoes das rotas.
6. O sistema continua registrando auditoria com uma equipe principal.
7. O rollback pode ser feito sem restaurar banco.

## Riscos e mitigacoes

| Risco | Mitigacao |
| --- | --- |
| Usuario perder acesso | Backfill automatico e manutencao de `Usuario.equipeId` |
| Rotas bloquearem usuario multiperfil | `ProtectedRoute` deve validar todas as equipes e permissoes agregadas |
| Usuario ganhar acesso indevido | Testar visualizadores e corrigir `Administracao (Visualizador)` |
| Telas antigas quebrarem esperando `usuario.equipe` | Manter `equipe` e `equipeId` no payload |
| Auditoria ficar ambigua | Usar equipe principal na fase 1 |
| Rollback complexo | Nao remover `equipeId`; tabela nova pode ser ignorada |

## Decisao recomendada

Implementar suporte real a multiplos perfis, nao criar grupos combinados. Grupos combinados resolvem um caso imediato, mas aumentam a complexidade e criam dependencia de novas combinacoes sempre que alguem acumular responsabilidades.

O modelo com `UsuarioEquipe` resolve o problema de forma definitiva e permite evoluir o sistema sem quebrar a estrutura atual.
