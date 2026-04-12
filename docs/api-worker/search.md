# /search — Google Search Grounding

> 🤖 **Disclaimer**: Documentação gerada por IA e pode conter imprecisões. [📋 Reportar erro](https://github.com/TouchRefletz/maia.api/issues/new?title=Erro+na+doc:+search&labels=docs)

## Visão Geral

O endpoint `/search` usa o **Google Search Grounding** do Gemini para gerar respostas baseadas em buscas na web em tempo real. Retorna streaming NDJSON com thoughts, respostas e metadados de grounding (fontes).

## Rota

| Método | Caminho |
|--------|---------|
| POST | `/search` |

## Request

```json
{
  "texto": "Gabarito e resolução: ENEM 2023 Q45 - ...",
  "schema": { ... },
  "model": "models/gemini-3-flash-preview",
  "listaImagensBase64": [],
  "files": [{ "mimeType": "application/pdf", "data": "..." }],
  "apiKey": "optional"
}
```

## Response (NDJSON Streaming)

| type | Descrição |
|------|-----------|
| `meta` | `{ event: "attempt_start", model }` |
| `thought` | Pensamentos do modelo durante a busca |
| `answer` | Resposta gerada com base nas fontes |
| `grounding` | Metadados das fontes encontradas |
| `debug` | Informações de debug (keys, has grounding) |
| `reset` | Sinal de RECITATION retry |
| `error` | Erro terminal |

### Grounding Metadata

O campo `grounding` contém informações das fontes da web:

```json
{
  "type": "grounding",
  "metadata": {
    "searchEntryPoint": { "renderedContent": "<html>..." },
    "groundingChunks": [
      { "web": { "uri": "https://...", "title": "..." } }
    ],
    "groundingSupports": [
      { "segment": { "text": "..." }, "groundingChunkIndices": [0] }
    ]
  }
}
```

## Detalhamento Técnico

### Configuração

```javascript
const generationConfig = {
  tools: [{ googleSearch: {} }],      // Habilita Search Grounding
  safetySettings,
  thinkingConfig: { includeThoughts: true },
};
```

### RECITATION Handling

Mesmo mecanismo de fallback do `/generate`:
- Flash → Flash Lite → Erro

### Debug Detalhado

O endpoint envia chunks de debug para rastrear a presença de grounding metadata:

```ndjson
{"type":"debug","text":"Chunk Keys: candidates, promptFeedback"}
{"type":"debug","text":"Cand Keys: content, finishReason, groundingMetadata | Has Grounding: true"}
{"type":"debug","text":"FOUND GROUNDING METADATA!"}
```

### Tratamento de Grounding Metadata

A metadata é buscada em múltiplos caminhos (camelCase e snake_case):

```javascript
const groundingMetadata =
  cand?.groundingMetadata ||
  chunk?.groundingMetadata ||
  cand?.grounding_metadata ||
  chunk?.grounding_metadata;
```

## Uso Principal

O `/search` é usado em dois contextos:

1. **Busca de Gabarito**: Pipeline de extração busca respostas de questões
2. **Gabarito com Pesquisa (Frontend)**: `worker.js` → `callWorkerGabaritoComPesquisa()`

## Referências Cruzadas

- [/generate](/api-worker/generate) — Endpoint de geração padrão
- [Gabarito com Pesquisa](/utils/gabarito-pesquisa) — Frontend que usa este endpoint
- [Pipeline de Extração](/infra/scripts-python) — Uso server-side
