# Medicao de Performance - Tarefas V1 x V2

## 1) Backend (latencia + payload)

### Executar benchmark
1. Garanta que a aplicacao esteja no ar (`http://localhost:3000`).
2. Pegue o cookie de autenticacao (`auth-token`) no navegador.
3. Rode:

```bash
npm run perf:tarefas -- --cookie "auth-token=SEU_TOKEN" --responsavel RH --iterations 20 --warmup 3
```

### O que o benchmark compara
1. V1: `/api/logistica/remanejamentos?filtrarProcesso=false&responsavel=RH`
2. V2: `/api/v2/tarefas?responsavel=RH&limit=60`
3. Metricas:
- `avg_ms`, `p50_ms`, `p95_ms`
- `avg_payload_kb`
- `avg_tarefas`

### Dicas
1. Rodar para cada setor:
- `--responsavel RH`
- `--responsavel MEDICINA`
- `--responsavel TREINAMENTO`
2. Rodar em horario de carga real para resultado mais fiel.

## 2) Frontend (tempo real de carregamento da pagina)

### Chrome DevTools
1. Abrir `/tarefas?setor=rh`.
2. Abrir DevTools (`F12`) > aba `Network`.
3. Marcar `Disable cache`.
4. Fazer hard reload (`Ctrl+Shift+R`).
5. Anotar:
- `DOMContentLoaded`
- `Load`
- quantidade de requests
- total transferido
6. Repetir os mesmos passos para `/tarefas-v2?setor=rh`.

### Gargalos comuns para observar
1. Request principal demorando muito (`/api/logistica/remanejamentos`).
2. Payload muito grande.
3. Muito tempo de scripting/render depois do retorno da API.

## 3) Critério simples de decisão
1. Se V2 tiver `p95` e payload consistentemente menores que V1, ela esta pronta para ampliar rollout.
2. Se ainda houver pico de `p95`, otimizar indice e filtros do endpoint antes de migrar features pesadas.
