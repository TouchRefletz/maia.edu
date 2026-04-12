# /canonical-slug — Geração de Slug via Gemini

> 🤖 **Disclaimer**: Documentação gerada por IA e pode conter imprecisões. [📋 Reportar erro](https://github.com/TouchRefletz/maia.api/issues/new?title=Erro+na+doc:+canonical-slug&labels=docs)

## Visão Geral

O endpoint `/canonical-slug` usa o Gemini para gerar um **slug canônico** normalizado a partir de uma query de busca. Isso garante que buscas como "provas do enem 2022", "ENEM 22" e "enem dois mil e vinte e dois" convergem para o mesmo slug: `enem-2022`.

## Rota

| Método | Caminho |
|--------|---------|
| POST | `/canonical-slug` |

## Request

```json
{
  "query": "provas do enem 2022 caderno azul",
  "search_type": "provas"
}
```

## Response

```json
{
  "slug": "enem-2022",
  "reasoning": "Normalizei 'enem 2022' como instituição ENEM, ano 2022. Ignorei 'caderno azul' pois é variante."
}
```

## Detalhamento Técnico

### Prompt

O Gemini recebe instruções para:
1. Extrair **instituição** e **ano** da query
2. Normalizar siglas (FUVEST, UNICAMP, ITA, etc.)
3. Gerar slug no formato `{instituicao}-{ano}` 
4. Ignorar variantes (cadernos, fases) no slug principal
5. Para `search_type: "questoes"`, incluir o tema no slug

### Exemplos de Normalização

| Query | Slug Gerado |
|-------|------------|
| `"provas do enem 2022"` | `enem-2022` |
| `"ITA segunda fase 2023"` | `ita-2023` |
| `"fuvest 1a fase"` | `fuvest-2026` |
| `"questões geometria analítica ita"` | `geometria-analitica-ita` |

### Fallback

Se a IA falha, usa sanitização simples:

```javascript
canonicalSlug = query
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');
```

## Decisões de Design

1. **IA em vez de regex**: Queries humanas são muito variáveis para regras estáticas
2. **Deduplicação por slug**: Evita que a mesma prova seja buscada múltiplas vezes
3. **Usado internamente**: O `/trigger-deep-search` chama este endpoint internamente

## Referências Cruzadas

- [/trigger-deep-search](/api-worker/deep-search) — Usa slug para deduplicação
- [Deep Search](/infra/deep-search) — Workflow que recebe o slug
