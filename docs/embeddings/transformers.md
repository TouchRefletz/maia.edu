# Transformers — Configuração de Modelos Locais

> 🤖 **Disclaimer**: Documentação gerada por IA e pode conter imprecisões. [📋 Reportar erro](https://github.com/TouchRefletz/maia.api/issues/new?title=Erro+na+doc:+transformers&labels=docs)

## Visão Geral

O `transformers-config.js` (`js/services/transformers-config.js`) é um módulo de configuração minimalista que define parâmetros para eventual uso de modelos locais via a biblioteca `@xenova/transformers` (agora `@huggingface/transformers`). Embora o maia.edu atualmente dependa de APIs cloud (Gemini via Cloudflare Worker) para todas as operações de IA, este módulo representa a infraestrutura preparatória para execução **on-device** de modelos leves.

## Motivação para Modelos Locais

A dependência exclusiva de APIs cloud cria três vulnerabilidades:
1. **Latência**: Cada chamada à IA requer round-trip de rede (50-500ms adicionais)
2. **Custo**: Cada token gerado é cobrado no billing da API
3. **Disponibilidade**: Sem internet = sem IA

Modelos locais via WebAssembly/WebGPU (que a Transformers.js suporta) resolveriam operações leves:
- Geração de embeddings para busca local
- Classificação de intenção do aluno (substituir o Router para operações simples)
- Detecção de idioma e sentimento

## Configuração Atual

```javascript
// js/services/transformers-config.js
export const TRANSFORMERS_CONFIG = {
  embeddingModel: "Xenova/all-MiniLM-L6-v2",
  quantized: true,         // Versão quantizada (menor, mais rápida)
  cacheDir: ".transformers-cache",
  device: "wasm",          // Fallback seguro para todos os browsers
};
```

### Campos

| Campo | Valor | Significado |
|-------|-------|-------------|
| `embeddingModel` | `Xenova/all-MiniLM-L6-v2` | Modelo de embedding de 384 dimensões, ~22MB |
| `quantized` | `true` | Usa versão quantizada em INT8 (~6MB) |
| `cacheDir` | `.transformers-cache` | Diretório de cache no Origin Private File System |
| `device` | `wasm` | Execução via WebAssembly (funciona em todos os browsers) |

## Modelos Candidatos

| Modelo | Tamanho | Dimensões | Uso Potencial | Status |
|--------|---------|-----------|---------------|--------|
| `all-MiniLM-L6-v2` | 22MB (6MB quantizado) | 384 | Embedding para busca local | Configurado |
| `bart-large-mnli` | 400MB | - | Zero-shot classification | Futuro |
| `distilbert-base-multilingual` | 270MB | - | Detecção de idioma/sentimento | Futuro |

## Integração Futura com EntityDB

Atualmente o EntityDB usa embeddings de 768 dimensões (Gemini). Se modelos locais forem adotados, seria necessário:
- Manter dual-indexing (768 para Pinecone cloud, 384 para busca local)
- Ou migrar tudo para 384 dims (perderia compatibilidade com embeddings cloud existentes)

A estratégia recomendada é dual-indexing: modelos locais para busca rápida offline, modelos cloud para busca de alta precisão quando online.

## WebGPU vs WebAssembly

O campo `device: "wasm"` é o fallback seguro. Em browsers que suportam WebGPU (Chrome 113+), o modelo roda na GPU do dispositivo com performance 10-50x superior ao WASM:

```javascript
// Detecção automática futura
const device = navigator.gpu ? "webgpu" : "wasm";
```

No entanto, WebGPU ainda tem suporte limitado (não funciona em Safari, Firefox experimental). O WASM garante compatibilidade universal.

## Cache e First-Load

O primeiro carregamento de qualquer modelo baixa os weights (~6MB para MiniLM quantizado) e os armazena no cache do browser. Loads subsequentes são instantâneos (< 100ms).

Em conexões lentas (3G de escola pública), o download inicial pode levar 10-30 segundos. A estratégia para mitigar isso é pre-caching durante idle time:

```javascript
// Futuro: pre-cache durante idle
if ('requestIdleCallback' in window) {
  requestIdleCallback(() => {
    import('@huggingface/transformers').then(({ pipeline }) => {
      pipeline('feature-extraction', TRANSFORMERS_CONFIG.embeddingModel);
    });
  });
}
```

## Estado Atual

Este módulo é **infraestrutura preparatória**. Nenhuma funcionalidade de produção depende dele atualmente. Todos os embeddings são gerados via API cloud (Gemini Embedding → Worker → Pinecone). A configuração existe para quando o projeto decidir implementar funcionalidades offline ou reduzir custos de API com processamento local.

## Referências Cruzadas

- [Pipeline de Embedding — Geração atual via API cloud](/embeddings/pipeline)
- [EntityDB — Banco vetorial local que consumiria embeddings locais](/memoria/entitydb)
- [Visão Geral da Arquitetura — Contexto do stack de IA](/guia/arquitetura)
