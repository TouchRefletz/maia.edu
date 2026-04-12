# Worker Client — Conexão Failsafe para Serverless Edges

> 🤖 **Disclaimer**: Documentação gerada por IA e pode conter imprecisões. [📋 Reportar erro](https://github.com/TouchRefletz/maia.api/issues/new?title=Erro+na+doc:+worker-client&labels=docs)

## Visão Geral

A arquitetura da Maia.edu orgulha-se de possuir "Zero-Backend Fixo" no que tange o faturamento clássico EC2/VPS. Exceto pelo Agente Rápido em Digital Ocean, a maior parte da lógica pesada — processar Strings grandes, gerar chaves síncronas, assinar uploads do repositório Hugging Face Caching — é delegada a **Cloudflare Workers**. 

O design do `Worker Client` define como o Frontend (Vite/Vanilla/React) envelopa instâncias globais com o `import.meta.env.VITE_WORKER_URL`. A principal finalidade dessa doc abrange a mitigação de problemas severos provocados por quebras abruptas de conexões via Fetch e o gerenciamento do Token Lifecycle entre Abas (Context Propagation).

## A Ponte Híbrida de Conexão

Sempre que a malha de Ingestão de Imagem (IA Extratora) necessita evocar a Vertex AI (Gemini), ela jamais engata chamadas HTTP diretas pelo Browser. Primeiro porque exporia as Keys do Google Generative AI nas Headers da requisição DevTools. Segundo porque navegadores tem Limits CORS insanos impostos para Cross-Origins Google.

A técnica injeta:
```javascript
const PROD_WORKER_URL = import.meta.env.VITE_WORKER_URL;

const response = await fetch(`${PROD_WORKER_URL}/trigger-deep-search`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ PayloadMassivo }),
});
```
O Edge Node Client não apenas roteia, mas encripta o Token do professor ativado por contexto do SessionStorage. Ele garante que um arquivo gigantesco chegue quebrado em Stream a partir da Cloudflare.

## Polling Progressivo e Fallback Sockets

O Edge Server da Cloudflare impõe Timeout severo de 30 segundos (Nas camadas Free/Pro tier Workers). Processar propostas usando OpenHands leva 4 minutos. O Cloudflare Client falharia brutalmente com `Error 524 (Timeout)`.

A Arquitetura cliente soluciona isso criando Redefinições Mistas (Mixed-State Channels). O Worker atua apenas como um "Disparador Asíncrono Fire-and-Forget". Ele recebe a query `"Provas Mackenzie"` (SearchLogic), despacha a ordem ao Cloud Server e responde `200 OK - Job Started` ao Frontend instantâneamente (100ms).

O Worker Client liberta-se da âncora do Fetch engatando dinamicamente Conexões WebSocket Pusher, ouvindo Broadcasts do Cloud Server isoladamente do Fluxo Primordial, que garante imensa resiliência ao Browser mesmo que ele saia da internet num túnel e reinicie.

## Tratamento de Interrupção Genuína (The SendBeacon)

Se o Cliente no Chrome é desligado por um Professor abruptamente irritado com a demora (Aba Crash/Close Tab), a aba morre. Os EventListener de Destroy nem sempre batem tempo do Evento Fetch Delete chegar no Cloudflare Worker.

A implementação clássica da Maia empacota:
```javascript
window.addEventListener("unload", () => {
    // Escapa do cancelamento de Thread do Browser usando Beacon
    const blob = new Blob([data], { type: "application/json" });
    navigator.sendBeacon(`${PROD_WORKER_URL}/cancel-deep-search`, blob);
});
```
Isso força uma micro-requisição OS-level, abortando a Containerização Longa da IA e poupando Tokens desnecessários que o Administrador pagaria por algo orfão.

## Referências Cruzadas

- [Proxy Services — Instâncias ativas que utilizam esse padrão de túnel](/api-worker/proxy-services)
- [Pdf Renderers — Como mídias renderizadas evitam trafegar atoa pra Nuvem Cloudflare](/ui/pdf-renderers)
- [Log Translator — Consumidor que engole ativamente sockets do Worker](/upload/log-translator)
