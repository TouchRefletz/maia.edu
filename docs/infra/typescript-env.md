# TypeScript e Variáveis de Ambiente

> 🤖 **Disclaimer**: Documentação gerada por IA e pode conter imprecisões. [📋 Reportar erro](https://github.com/TouchRefletz/maia.api/issues/new?title=Erro+na+doc:+typescript-env&labels=docs)

## Visão Geral

Configuração do TypeScript e tabela exaustiva de variáveis de ambiente do projeto maia.edu. O projeto usa TypeScript em modo **strict** com JSX React, mas permite JavaScript puro com `allowJs: true`.

## Arquivos Relacionados

| Arquivo | Papel |
|---------|-------|
| `tsconfig.json` | Configuração TypeScript |
| `.env` | Variáveis de ambiente (versionadas) |
| `.secrets` | Secrets sensíveis (gitignored) |
| `maia-api-worker/.dev.vars` | Variáveis locais do Worker |

## TypeScript Configuration

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ESNext"],
    "allowJs": true,
    "checkJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src", "js", "**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
  "exclude": ["node_modules"]
}
```

### Decisões Notáveis

| Opção | Valor | Rationale |
|-------|-------|-----------|
| `allowJs: true` | Habilitado | Projeto híbrido JS/TSX — módulos legados são `.js` |
| `checkJs: false` | Desabilitado | Evita erros em arquivos JS sem tipagem |
| `strict: true` | Habilitado | Código TypeScript novo segue strict mode |
| `isolatedModules: true` | Habilitado | Requerido pelo Vite (transpilação via esbuild) |
| `noEmit: true` | Habilitado | Vite faz o bundling, TSC só verifica tipos |
| `jsx: "react-jsx"` | React 17+ | Usa o novo transform (sem `import React`) |
| `moduleResolution: "Node"` | Node | Resolução clássica de módulos Node.js |

### Include Paths

O projeto inclui:
- `src/` — Código TypeScript puro (se houver)
- `js/` — Módulos JavaScript legados
- `**/*.ts`, `**/*.tsx` — Todos os TypeScript files
- `**/*.js`, `**/*.jsx` — Todos os JavaScript files

## Variáveis de Ambiente

### Frontend (`.env` — Versionado)

| Variável | Valor | Descrição |
|----------|-------|-----------|
| `FIREBASE_API_KEY` | `AIzaSy...` | Chave pública Firebase |
| `FIREBASE_AUTH_DOMAIN` | `projeto-cientifico-47301.firebaseapp.com` | Domínio de auth Firebase |
| `FIREBASE_PROJECT_ID` | `projeto-cientifico-47301` | ID do projeto Firebase |
| `FIREBASE_DATABASE_URL` | `https://projeto-cientifico-47301-default-rtdb.firebaseio.com` | URL do Realtime Database |
| `FIREBASE_MESSAGING_SENDER_ID` | `670616298954` | Sender ID para FCM |
| `FIREBASE_APP_ID` | `1:670616298954:web:...` | ID do app Firebase |
| `FIREBASE_MEASUREMENT_ID` | `G-CE7DX3230C` | Google Analytics |
| `VITE_WORKER_URL` | `https://maia-api-worker.willian-campos-ismart.workers.dev` | URL do Cloudflare Worker |

### Worker (`.dev.vars` — Não versionado)

| Variável | Descrição |
|----------|-----------|
| `GOOGLE_GENAI_API_KEY` | Chave da API Gemini |
| `IMGBB_API_KEY` | Chave da API ImgBB |
| `PINECONE_API_KEY` | Chave da API Pinecone |
| `PINECONE_HOST` | Host do index principal |
| `PINECONE_HOST_FILTER` | Host do index de filtros |
| `PINECONE_HOST_DEEP_SEARCH` | Host do index de deep search |
| `PINECONE_HOST_MEMORY` | Host do index de memória |
| `GITHUB_PAT` | Personal Access Token do GitHub |
| `GITHUB_OWNER` | Dono do repositório |
| `GITHUB_REPO` | Nome do repositório |
| `HF_TOKEN` | Token do HuggingFace Hub |
| `GOOGLE_SEARCH_API_KEY` | Chave do Google Custom Search |
| `GOOGLE_SEARCH_ENGINE_ID` | ID do search engine |

### GitHub Actions Secrets

| Secret | Usado em |
|--------|----------|
| `LLM_API_KEY` | Deep Search, Extract Questions |
| `TAVILY_API_KEY` | Deep Search (OpenHands) |
| `PUSHER_APP_ID` | Todos os workflows com logs |
| `PUSHER_KEY` | Todos os workflows com logs |
| `PUSHER_SECRET` | Todos os workflows com logs |
| `PUSHER_CLUSTER` | Todos os workflows com logs |
| `HF_TOKEN` | Deep Search, Extract, Manual Upload, Delete |
| `GH_PAT` | Manual Upload (cache update) |

## Referências Cruzadas

- [Configuração Vite](/infra/vite-config) — Build e dev server
- [Wrangler Config](/api-worker/wrangler) — Configuração do Worker
- [Inicialização Firebase](/firebase/init) — Uso das variáveis Firebase
- [Começando (Setup)](/guia/setup) — Guia de instalação
