# Async Queue — Fila Assíncrona de Concorrência

> 🤖 **Disclaimer**: Documentação gerada por IA e pode conter imprecisões. [📋 Reportar erro](https://github.com/TouchRefletz/maia.api/issues/new?title=Erro+na+doc:+queue&labels=docs)

## Visão Geral

O arquivo estrito `queue.js` (`js/utils/queue.js`) exporta a fundação de estrangulamento (Throttling/Concurrency Control) da aplicação. Embora os interpretadores JavaScript Node e Chromium executem em Threads únicas nativamente, os canais de fetch HTTP abertos podem colapsar a memória ou a API Endpoints rate-limited.

A classe VanillaJS `AsyncQueue` garante que um "Funil" matemático tranque o número máximo de Promises simultâneas, processando em *Lotes Limitados* ao invés de atirar indiscriminadamente na rede.

## Arquitetura de Propagação Resolvida

Diferente de filas pesadas baseadas em RabbitMQ ou Redis, a Fila da Maia é um Array Simples de blocos `Task = Function => Promise`.

```javascript
this.concurrency = 2; // O Funil (Dois por vez)
this.running = 0;
```

Sempre que a aplicação tenta inserir uma tarefa:
```javascript
queue.enqueue(async () => { await heavyLifting(); });
```
O `.process()` verifica o estado da comporta do Funil. Se `this.running < this.concurrency`, a cancela sobe, `.running++`, a tarefa `shift()` escapa do topo do array, e é mandada rolar. O milagre reside no bloco `finally`:

```javascript
finally {
   this.running--;
   this.process(); // Motor Perpétuo
}
```
Não importa se o Worker da Cloudflare travou ou a Imagem do PDF quebrou em CORS. O `finally` destranca o semáforo em -1, e invoca o `.process()` recursivamente forçando a próxima promessa a rolar.

## O Evento Drain (Esgotamento de Fila)

Uma feature silenciosa mas letal implementada é a matriz de `drainResolvers`. Quando o sistema, como o **Image Extractor** ou **Batch Processor**, quer saber quando todas as sub-rotas paralelas terminaram, eles aplicam `await queue.drain()`.

A fila assina esta promise ociosa e apenas resolve-a (o `emitDrain()`) quando matematicamente `running === 0 && queue.length === 0`. Evita polling assíncrono dispendioso que derreteria CPUs Mobile ao esperar que 50 OCRs rodassem paralelamente 2 a 2.

## Referências Cruzadas

- [Batch Engine — Utilitário mestre que consome filas ativamente, mas baseadas em EventHooks](/upload/batch-arquitetura)
- [Ai Image Extractor — Onde o OCR de base necessita evitar Throttling contra o backend gemini](/api-worker/proxy-services)
