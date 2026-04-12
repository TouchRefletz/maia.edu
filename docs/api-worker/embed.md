# /embed — Endpoint de Embeddings

> 🤖 **Disclaimer**: Documentação gerada por IA e pode conter imprecisões. [📋 Reportar erro](https://github.com/TouchRefletz/maia.api/issues/new?title=Erro+na+doc:+embed&labels=docs)

## Visão Geral

O endpoint `/embed` gera embeddings vetoriais via Gemini Embedding API. Usado para vetorizar texto antes de operações no Pinecone (upsert, query).

## Rota

| Método | Caminho |
|--------|---------|
| POST | `/embed` |

## Request

```json
{
  "texto": "Texto para vetorizar",
  "model": "models/gemini-embedding-001",
  "apiKey": "optional-user-key"
}
```

## Response

```json
[0.012, -0.034, 0.056, ...]
```

Array de floats representando o embedding (768 dimensões para `gemini-embedding-001`).

## Detalhamento Técnico

### Modelo

| Modelo | Dimensionalidade | Uso |
|--------|-----------------|-----|
| `gemini-embedding-001` | 768 | Padrão |

### Implementação

```javascript
async function generateEmbedding(text, apiKey, model = 'models/gemini-embedding-001') {
  const client = new GoogleGenAI({ apiKey });
  const result = await client.models.embedContent({
    model: model,
    contents: text,
  });
  return result.embedding?.values || result.embeddings?.[0]?.values;
}
```

A função trata ambos os formatos de resposta (`embedding.values` e `embeddings[0].values`) para compatibilidade com diferentes versões da API.

## Referências Cruzadas

- [Pipeline de Embedding](/embeddings/pipeline) — Fluxo completo de vetorização
- [Integração Pinecone](/embeddings/pinecone) — Onde os embeddings são armazenados
