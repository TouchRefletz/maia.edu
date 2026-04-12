# JSON Parser Stream — O Interpretador de Melhor Esforço

> 🤖 **Disclaimer**: Documentação gerada por IA e pode conter imprecisões. [📋 Reportar erro](https://github.com/TouchRefletz/maia.api/issues/new?title=Erro+na+doc:+json-parser&labels=docs)

## Visão Geral

O arquivo estrito `json-stream-parser.js` (`js/utils/json-stream-parser.js`) contorna um dos problemas endêmicos primários causados pela API Stream da OpenAI/Gemini: *A Fragmentação Sintática do Formato JSON*.

Para que os componentes dinâmicos em React comecem a "Flutuar" as sentenças na UI antes que o Processamento Textual seja finalizado em 30 segundos (Latency Tolerance), a Maia empurra pedaços de String. Este arquivo é o motor heurístico que tenta ler um JSON ainda com os colchetes destrancados sem causar um `SyntaxError` mortal no Engine do Navegador.

## O "Best-Effort" Parser

Se o backend responde apenas `{"alternativas": ["Lobo"`, chamar `JSON.parse()` original causa erro fatal e destrói o ArrayBuffer.

O módulo empacota o lib `best-effort-json-parser`, construindo um try-catch hermético e performático:

```javascript
import { parse } from "best-effort-json-parser";

export function parseStreamedJSON(buffer) {
   try {
     return parse(buffer); // A mágica heurística corrige o JSON injetando ]}
   } catch(error) {
     return null; // Reduz pane seca
   }
}
```

A lib de "melhor esforço" atua por trás das cortinas analisando a árvore AST da string crua e inserindo tokens sintéticos faltantes sem adulterar os lexemas lógicos. Isso devolve à aplicação um objeto Javascript puro e re-hidratável, do qual o sistema Frontend consegue pintar o Card na tela instantaneamente, embora faltando pedaços lexicais de respostas subsequentes, dando o tão desejado "Efeito Máquina de Escrever Estável" à UI.

## O Impacto Transacional no Chunk Payload

No `AiScanner` e no `StreamRenderer`, o Frontend engole dezenas de `UInt8Array`. Ele não espera por quebras de linha (`\n`), mas empilha os blocos no buffer estático local e pede ao Stream Parser para extrair algo vital.
O retorno estruturado propaga de imediato a montagem do "Título da Questão", ou da "Grade Operacional de Ação" na tela lateral, fazendo o Load-Time Ativo baixar drasticamente de 15 segundos para insensíveis 600ms, preservando a imersão UX desenhada no Maia.edu.

## Referências Cruzadas

- [API Worker Proxying — Responsável pelo envio primordial e contínuo desse Stream via Cloudflare](/api-worker/proxy-services)
- [Chat Render — Consumidor que precisa engolir este mesmo comportamento via blocos para gerar Markdown](/chat/chat-render)
