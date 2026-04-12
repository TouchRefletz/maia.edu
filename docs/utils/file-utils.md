# File Utils — Serialização Base64 para Payload Vertex AI

> 🤖 **Disclaimer**: Documentação gerada por IA e pode conter imprecisões. [📋 Reportar erro](https://github.com/TouchRefletz/maia.api/issues/new?title=Erro+na+doc:+file-utils&labels=docs)

## Visão Geral

O arquivo estático `file-utils.js` (`js/utils/file-utils.js`), minimalista em suas poucas (17) linhas, encapsula a conversão massiva de Mídia Binária (Blob / File) do Navegador Local para Base64-String. 
Ele age ativamente como Ponte Precursora para requisições na Google Cloud Vertex AI (Backend Gemini). 
Ao contrário de WebSockets que transportam arrays Unit8 binários, Rest APIs de LLMs Multi-Modais (como `gemini-1.5-pro` e `gemini-exp-1206`) exigem que imagens sejam empacotadas nativamente no JSON Payload como Strings Alfanuméricas serializadas de base 64.

## Arquitetura de Conversão (FileReader)

A função base, e por hora a única constante ali exportada, delega o trabalho duro ao núcleo C++ do Chromium através da API Antiga de FileReader HTML5:

```javascript
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(",")[1];
      resolve(base64);
    };
    reader.readAsDataURL(file);
  });
}
```

O detalhe fundamental desta arquitetura não é apenas promissificar um CallBack legado da V8, mas o `split(",")[1]`. 

O Backend Gemini (`generative-ai` do Google) quebra sumariamente falhando com erro "Bad Request 400" se enviarmos o Schema de MimeType `data:image/jpeg;base64,` incluso visualmente no prefixo da String. A função então arranca a "Cabeça Ociosa" retornando a *Naked String* (Apenas os dados algorítmicos), tornando-a imediatamente consumível pela estrutura de Payload Vertex AI.

## Gargalos e Throttling Base64

Em um computador fraco local (como um i3 Celeron fornecido muitas vezes aos professores em rede pública), a memória de Heap do Browser limita severamente Strings de gigabytes. Um PDF inteiro não pode ser atirado cru nesta função. O ecossistema Maia fragmenta os Canvas, envia Crop Images microscópico de Resolução Alta (Apenas a equação da pergunta, nunca o fundo), passando por este utilitário e retornando a string limpa numa fração irrelevante de RAM, reduzindo Latency Penalty nas requisições subsequentes para a rede.

## Referências Cruzadas

- [Ai Image Extractor — O Agente que estilhaça imagens e precisa gerar JSON payloads deste arquivo](/api-worker/proxy-services)
- [Editor Múltiplo IA — Crop provider local (A Máquina de recortar)](/editor/multiplo-ia)
