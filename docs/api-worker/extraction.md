# /trigger-extraction e /extract-and-save — Pipeline de Extração

> 🤖 **Disclaimer**: Documentação gerada por IA e pode conter imprecisões. [📋 Reportar erro](https://github.com/TouchRefletz/maia.api/issues/new?title=Erro+na+doc:+extraction&labels=docs)

## Visão Geral

Os endpoints `/trigger-extraction`, `/check-duplicate` e `/extract-and-save` formam o pipeline de extração de questões, orquestrando o workflow `extract-questions.yml` e servindo como API para o script `extract_pipeline.py`.

## Rotas

| Método | Caminho | Função |
|--------|---------|--------|
| POST | `/trigger-extraction` | Dispara o workflow de extração |
| POST | `/check-duplicate` | Verifica duplicata no Pinecone |
| POST | `/extract-and-save` | Salva questão extraída |

## /trigger-extraction

Dispara o GitHub Action `extract-questions.yml`:

```json
{
  "slug": "enem-2022",
  "query": "enem 2022",
  "institution": "ENEM",
  "subject": "Física"
}
```

Internamente:
```javascript
await fetch(`https://api.github.com/repos/${owner}/${repo}/dispatches`, {
  body: JSON.stringify({
    event_type: 'extract-questions',
    client_payload: { slug, query, institution, subject }
  })
});
```

## /check-duplicate

Verifica se uma questão já existe no banco usando busca semântica:

### Request
```json
{ "text": "MATÉRIA: Física | ENEM 2023 Q45 | Enunciado da questão..." }
```

### Response
```json
{
  "exists": true,
  "matches": [
    { "id": "questao-abc", "score": 0.95, "metadata": { ... } }
  ]
}
```

Internamente gera embedding do texto e busca no índice Pinecone principal.

## /extract-and-save

Recebe a questão estruturada e gabarito, salvando no Firebase e Pinecone:

### Request
```json
{
  "questao": { "identificacao": "...", "estrutura": [...], "alternativas": [...] },
  "gabarito": { "alternativa_correta": "B", "explicacao": [...] },
  "source_slug": "enem-2022",
  "source_pdf": "prova-dia1.pdf",
  "page_num": 5
}
```

### Fluxo Interno

1. Normaliza a questão
2. Gera embedding do conteúdo
3. Salva no Firebase Realtime Database
4. Upsert no Pinecone (índice default)
5. Retorna ID da questão salva

## Referências Cruzadas

- [extract-questions.yml](/infra/extract-questions) — Workflow de extração
- [extract_pipeline.py](/infra/scripts-python) — Script que chama estes endpoints
- [Integração Pinecone](/api-worker/pinecone) — Roteamento multi-index
