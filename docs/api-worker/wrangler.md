# Wrangler Config — Configuração do Cloudflare Worker

> 🤖 **Disclaimer**: Documentação gerada por IA e pode conter imprecisões. [📋 Reportar erro](https://github.com/TouchRefletz/maia.api/issues/new?title=Erro+na+doc:+wrangler-config&labels=docs)

## Visão Geral

O `wrangler.jsonc` configura o deploy do Maia API Worker no Cloudflare Workers. O Worker atua como **API Gateway central** entre o frontend e todos os serviços externos (Gemini, Pinecone, ImgBB, GitHub Actions, HuggingFace).

## Arquivo

| Arquivo | Caminho |
|---------|---------|
| `wrangler.jsonc` | `maia-api-worker/wrangler.jsonc` |

## Configuração Completa

```jsonc
{
  "name": "maia-api-worker",
  "main": "src/index.js",
  "compatibility_date": "2025-12-19",
  "compatibility_flags": ["nodejs_compat", "global_fetch_strictly_public"],
  "assets": { "directory": "./public" },
  "observability": { "enabled": true },
  "placement": { "mode": "smart" }
}
```

## Detalhamento Técnico

### Nome e Entrypoint

| Campo | Valor | Descrição |
|-------|-------|-----------|
| `name` | `maia-api-worker` | Nome do Worker no Cloudflare |
| `main` | `src/index.js` | Arquivo de entrada |

### Compatibility

| Flag | Propósito |
|------|-----------|
| `nodejs_compat` | Habilita APIs Node.js (crypto, buffer, etc.) |
| `global_fetch_strictly_public` | `fetch()` global faz requests para internet pública |
| `compatibility_date: 2025-12-19` | Versão do runtime com features mais recentes |

### Assets

```jsonc
"assets": { "directory": "./public" }
```
Serve arquivos estáticos da pasta `public/` (ex: favicon, robots.txt).

### Observability

```jsonc
"observability": { "enabled": true }
```
Habilita logs e métricas no Cloudflare Dashboard para monitoramento.

### Smart Placement

```jsonc
"placement": { "mode": "smart" }
```

O **Smart Placement** analisa automaticamente para quais serviços o Worker faz mais requests e posiciona a execução no datacenter mais próximo desses serviços, reduzindo latência. Dado que o Worker chama predominantemente APIs nos EUA (Gemini, Pinecone), ele tende a ser colocado em datacenters americanos.

### Secrets (Deploy)

Secrets são configurados via CLI:
```bash
npx wrangler secret put GOOGLE_GENAI_API_KEY
npx wrangler secret put PINECONE_API_KEY
npx wrangler secret put GITHUB_PAT
# ... etc
```

Para desenvolvimento local:
```bash
# .dev.vars (não versionado)
GOOGLE_GENAI_API_KEY=xxx
PINECONE_API_KEY=xxx
```

## Decisões de Design

1. **JSONC (com comentários)**: Permite documentação inline sem quebrar parsing.
2. **Smart Placement**: Como o Worker é API proxy, reduz latência para serviços externos.
3. **nodejs_compat**: Necessário para `crypto` (Pusher HMAC) e `Buffer` (base64).
4. **Single file (`src/index.js`)**: Todo o roteamento em um arquivo. Simples mas eficiente para o tamanho atual.

## Referências Cruzadas

- [Arquitetura do Worker](/api-worker/arquitetura) — Visão geral dos endpoints
- [TypeScript e Ambiente](/infra/typescript-env) — Variáveis de ambiente
