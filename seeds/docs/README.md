# Seeds Data

Esta pasta contém os dados organizados para o seeding do banco de dados.

## Estrutura dos Arquivos

### 📋 status.json
- **Descrição**: Categorias de status do sistema
- **Registros**: 12
- **Formato**: Array de objetos com `categoria` e `ativo`

### 🔗 status-mapping.json  
- **Descrição**: Mapeamentos entre status gerais e categorias
- **Registros**: 66
- **Formato**: Array de objetos com `statusGeral`, `statusId` e `ativo`

### 🏗️ projetos.json
- **Descrição**: Lista de projetos da empresa
- **Registros**: 76
- **Formato**: Array de strings com nomes dos projetos

### 💰 centros-custo-projeto.json
- **Descrição**: Centros de custo associados aos projetos
- **Registros**: 148
- **Formato**: Array de objetos com `centroCusto`, `nomeCentroCusto` e `projeto`

### ⚙️ seed-config.json
- **Descrição**: Configuração e metadados dos arquivos de seed
- **Contém**: Informações sobre versão, contadores e descrições

## Como Usar

Os arquivos desta pasta são utilizados pelo `seed-complete.cjs` para popular o banco de dados com dados estruturados vindos do Excel.

## Atualização

Para atualizar os dados:
1. Execute o processo de conversão do Excel
2. Execute `node organize-seeds.cjs` para reorganizar os arquivos
3. Execute `npm run seed:complete` para aplicar no banco

---
*Gerado automaticamente em 01/10/2025, 10:46:42*
