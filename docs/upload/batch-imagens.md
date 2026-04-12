# Batch Imagens — Tratamento de Assíncrono de Slots Multimídia

> 🤖 **Disclaimer**: Documentação gerada por IA e pode conter imprecisões. [📋 Reportar erro](https://github.com/TouchRefletz/maia.api/issues/new?title=Erro+na+doc:+batch-imagens&labels=docs)

## Visão Geral

Inseparável da lógica principal do motor sequencial, a extração fotográfica dentro do Batch Processing exigiu uma reestruturação severa da interoperação Vanilla/React. Ao instruir que a IA vasculhe matrizes vetoriais de polígonos nas páginas do PDF, não basta gerar Markdown: é necessário embutir gráficos algébricos e tabelas fotográficas nativas nas alternativas.

O documento mapeia o método `_triggerAutoImageExtraction(slotIds)`, uma das peças tecnológicas de extração cruzada mais pesadas do repositório (~150 linhas em `batch-processor.js`), capaz de calcular matrizes numéricas sem ter uma tela renderizada.

## A Problemática da Renderização Suspensa (React)

Originalmente, o componente `<ImageSlotCard>` em React identificava que a questão gerada detinha slots vazios (`[IMG-A, IMG-B]`) e demandava a IA automaticamente. Mas ele faz isso executando na Tree Mount Lifecycle (`useEffect`). 

No Processo Batch, as abas das questões (`tab-content-question-n`) rodam em invisibilidade pura (Display/Visibility/Z-Index negativos), logo as bibliotecas do ecossistema do React interceptam e adiam Mount/Updates intensos para poupar RAM.

Sem Mount, não há ImageSlotCard. Sem o Card, o motor da Inteligência Fotográfica nunca dispara, e a esteira de montagem empaca eternamente nos slots pendentes apontados pelo JSON.

## Extração Analítica "Headless"

A solução documentada implementou um acionamento fantasma e imperativo que foge dos ciclos React:

```javascript
// 1. O motor do JS não espera Mount. Ele importa preguiçosamente o extrator:
const { extractImagesFromRegion } = await import("./ai-image-extractor.js");

// 2. Extrai das coordenadas RAW originais guardadas
const firstCrop = group.crops[0];
const anchorData = firstCrop.anchorData;

const questionBounds = {
   x: Math.round((anchorData.relativeLeft / wrapperWidth) * 1000),
   w: Math.round((anchorData.unscaledW / wrapperWidth) * 1000),
   // ... Normalizando entre ranges (0-1000)
};
```

Baseado matematicamente nas coordenadas cartesianas do Canvas PDF escalonado, a matriz algébrica invoca a IA Vision por debaixo dos panos do React.

## Injeção Inversa de Mutações (Window Confirm Trigger)

Mesmo bypassando o Mount visual para requisitar as mídias da nuvem Google do recorte de imagem (`firstCrop`), as imagens retornam e demandam injeção. 

Como as instâncias React não assinam variáveis globais comumente, a interface forçou um hook bidirecional. O React expõe, na janela principal (`window`), a ponte:
```javascript
if (window.confirmAISlotDirectly) {
   // Entrega o Slot, Pagina e o Binário Cru 
   await window.confirmAISlotDirectly(slotId, pageNum, crop);
}
```

Isso enxerta a imagem diretamente na memória persistente. A interface `ImageSlotCard` ou `RenderComponent` ao ser ativada na sua aba (quando o usuário resolve clicar na aba finalizada) montará seu estado lendo o Cache estático, acordando como se a foto estivesse lá desde o princípio, com uma experiência estritamente fluída e un-obstrusiva.

## Referências Cruzadas

- [Batch Arquitetura — Orquestrador onde este pedaço engatilha suas Promises](/upload/batch-arquitetura)
- [Image Slot Card — Componentização React que expõe os ganchos da `window`](/render/image-slot)
- [Editor Cropper — Entidade geradora original das coordenadas cartesianas](/editor/modo-recorte)
