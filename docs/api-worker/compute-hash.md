# /compute-hash — Hash Visual Server-Side

> 🤖 **Disclaimer**: Documentação gerada por IA e pode conter imprecisões. [📋 Reportar erro](https://github.com/TouchRefletz/maia.api/issues/new?title=Erro+na+doc:+compute-hash-endpoint&labels=docs)

## Visão Geral

O endpoint `/compute-hash` é um proxy para o GitHub Action `hash-service.yml`. Recebe URL e slug, e dispara o workflow que computa o hash visual do PDF. O resultado é retornado via Pusher (assíncrono).

## Rota

| Método | Caminho |
|--------|---------|
| POST | `/compute-hash` |

## Request

```json
{
  "url": "https://example.com/prova.pdf",
  "slug": "enem-2022"
}
```

## Response

```json
{
  "success": true,
  "message": "Hash Computation Triggered"
}
```

> **Nota**: O hash real é retornado assincronamente via Pusher no canal `slug`.

## Detalhamento Técnico

```javascript
const workflowDispatchUrl = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/hash-service.yml/dispatches`;
await fetch(workflowDispatchUrl, {
  method: 'POST',
  headers: { Authorization: `Bearer ${githubPat}` },
  body: JSON.stringify({
    ref: 'master',
    inputs: { file_url: url, slug: slug }
  })
});
```

### Fluxo Assíncrono

1. Frontend chama `/compute-hash`
2. Worker dispara GitHub Action
3. Action computa dHash e notifica via Pusher
4. Frontend escuta canal Pusher e recebe o hash

## Referências Cruzadas

- [Hash Service](/infra/hash-service) — Workflow que computa o hash
- [PDF Hashing](/utils/pdf-hash) — Hash no frontend
