# Payload de Imagens — Processamento Visual para IA

> 🤖 **Disclaimer**: Documentação gerada por IA e pode conter imprecisões. [📋 Reportar erro](https://github.com/TouchRefletz/maia.api/issues/new?title=Erro+na+doc:+payload-imagens&labels=docs)

## Visão Geral

O módulo de **Payload de Imagens** engloba a lógica de preparação de imagens para envio à API de IA (Gemini Vision). No fluxo de extração de questões, o scanner captura regiões de imagem do PDF, converte para Base64, e monta o payload multimodal que combina prompt textual + imagens binárias numa única requisição ao Worker.

## Por Que Imagens Precisam de Processamento

O Gemini API aceita imagens em formato Base64 com MIME type explícito. Porém, as imagens vindas do scanner podem ter:
- **Tamanho excessivo**: Fotos de celular em 12MP (5MB+ cada)
- **Formato variado**: PNG, JPEG, WebP, HEIC
- **Orientação incorreta**: Fotos rotacionadas (metadados EXIF)
- **Ruído visual**: Sombras, dedos, margens pretas

O módulo de payload resolve os primeiros dois problemas (encoding + sizing). Os demais são tratados pelo [Cropper](/cropper/visao-geral) antes de chegar aqui.

## Fluxo de Construção do Payload

```mermaid
flowchart TD
    A[Imagens cropadas pelo usuário] --> B[FileReader API]
    B --> C[readAsDataURL → Base64 string]
    C --> D{Tamanho > 4MB?}
    D -- Sim --> E[Resize via Canvas API]
    D -- Não --> F[Usa direto]
    E --> F
    F --> G[Monta objeto { data, mimeType }]
    G --> H[Array de processedFiles]
    H --> I[Enviado ao Worker como parte do payload]
```

## Conversão para Base64

```javascript
async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // Remove o prefixo "data:image/png;base64,"
      const base64 = reader.result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
```

O prefixo `data:image/png;base64,` é removido porque o Worker e a API Gemini esperam apenas o payload Base64 puro, com o MIME type separado.

## Montagem do Payload Multimodal

O Worker espera um array de objetos `{ data, mimeType }` junto com o prompt textual:

```javascript
const processedFiles = await Promise.all(
  attachments.map(async (file) => {
    const base64 = await fileToBase64(file);
    return {
      data: base64,
      mimeType: file.type || "application/octet-stream",
    };
  })
);

// Enviado ao Worker
await gerarConteudoEmJSONComImagemStream(
  prompt,         // Texto do prompt
  schema,         // JSON Schema esperado
  processedFiles, // Array de imagens Base64
  "",             // Mimetype override (deprecated)
  handlers,       // Callbacks de streaming
  options,        // Modelo, temperature, etc.
  apiKey,         // Chave da API
);
```

## Tipos de MIME Suportados

| MIME Type | Extensão | Suporte Gemini |
|-----------|----------|---------------|
| `image/jpeg` | .jpg, .jpeg | ✅ Nativo |
| `image/png` | .png | ✅ Nativo |
| `image/webp` | .webp | ✅ Nativo |
| `image/heic` | .heic | ❌ Requer conversão |
| `application/pdf` | .pdf | ✅ Via inline data |

Imagens HEIC (formato nativo do iPhone) são convertidas para JPEG pelo [Cropper](/cropper/visao-geral) antes de chegar a este módulo.

## Limite de Tamanho

A API Gemini aceita até 20MB por requisição multimodal, mas payloads menores são processados mais rápido. O maia.edu limita cada imagem a ~4MB (após encoding Base64, que infla ~33% o tamanho original). Imagens maiores são redimensionadas via Canvas API mantendo aspect ratio.

## Múltiplas Imagens por Questão

Uma questão pode ter várias "partes" capturadas separadamente (enunciado em uma imagem, alternativas em outra, figuras em terceira). O payload envia TODAS as imagens na mesma requisição, e o prompt instrui a IA a "juntar as informações de todas as imagens" numa única extração coerente.

## Contexto de Uso

O payload de imagens é usado em três cenários:
1. **Scanner de Questões**: Imagens cropadas → extração de enunciado + alternativas
2. **Scanner de Gabarito**: Imagens de resolução → extração de passo-a-passo
3. **Chat com Anexos**: Fotos do aluno → IA analisa exercício manuscrito

## Referências Cruzadas

- [Config IA — Prompts e schemas que acompanham as imagens](/embeddings/config-ia)
- [Scanner Pipeline — Orquestra a captura e envio](/ocr/scanner-pipeline)
- [Cropper — Recorte das regiões de interesse](/cropper/visao-geral)
- [Worker /generate — Endpoint que recebe o payload](/api-worker/generate)
