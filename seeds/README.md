# Seeds Organization

Esta pasta contém todos os dados organizados para o seeding do banco de dados.

## 📁 Estrutura

```
seeds/
├── data/                    # Dados principais
│   ├── status.json         # Categorias de status (12 registros)
│   ├── status-mapping.json # Mapeamentos de status (66 registros)
│   ├── projetos.json       # Lista de projetos (76 registros)
│   └── centros-custo-projeto.json # Centros de custo (148 registros)
├── config/                  # Configurações
│   └── seed-config.json    # Metadados e configurações
└── docs/                    # Documentação
    └── README.md           # Documentação detalhada
```

## 🚀 Como Usar

1. **Executar seed completo:**
   ```bash
   npm run seed:complete
   ```

2. **Validar dados:**
   ```bash
   node validate-seeds.cjs
   ```

## 📊 Estatísticas

- **Total de registros:** 302
- **Arquivos de dados:** 4
- **Última atualização:** 01/10/2025

## 🔄 Atualizações

Para atualizar os dados:
1. Processe novos dados do Excel
2. Execute o script de organização
3. Execute o seed completo

---
*Estrutura organizada automaticamente*
