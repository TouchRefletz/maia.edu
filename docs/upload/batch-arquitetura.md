# Arquitetura de Filas Batch (Processamento Sequencial)

> 🤖 **Disclaimer**: Documentação gerada por IA e pode conter imprecisões. [📋 Reportar erro](https://github.com/TouchRefletz/maia.api/issues/new?title=Erro+na+doc:+batch-arquitetura&labels=docs)

## Visão Geral

O módulo `batch-processor.js` atua silenciosamente no ecossistema do Scanner Inteligente (`js/services/batch-processor.js`). Originalmente, o escâner humano marcava três questões em um PDF e apertava extrair na primeira, aguardava 2 minutos, em seguida clicava na segunda. A Arquitetura Batch nasceu para exterminar essa ineficiência.

Com aproximadamente 550 linhas, o código funciona como um Motor de Fila FIFO assíncrona. Quando a varredura primária (OCR) deteta dezenas de questões em uma folha, o botão mágico "Extrair Todas" convoca esta classe, que empilha as questões, renderiza Abas Ocultas (`Tabs`) localmente para o ambiente, e aciona os Cloud Workers de forma escalonada, evitando gargalos de Rate Limit nas chaves do Gemini.

## O Scheduler (Escalonador) de Extração

O método `.start()` é a chave mestra de controle de estado visual e computacional do PDF Viewer. 
A arquitetura varre o dicionário de polígonos `CropperState.groups` procurando tudo que contenha a tag `{ tags: ['ia'] }`. O que foi flagrado é jogado numa Array de Fila:

```javascript
this.queue = iaGroups.map((g) => g.id);
this.totalCount = this.queue.length;
```

A cada pop, o robô injeta `autoActivate: false` na recém-criada aba lateral. Assim, a Aba Mestre de navegação (O `Hub`) nunca sai do foco visual, ao mesmo tempo em que sockets Web Worker e sessões Gemini iniciam paralelamente no Background JS do Navegador.

## Assincronicidade Híbrida: Promessas vs Mutações DOM

Por processarmos arquivos pesados de imagem atrelados na estrutura React, o Batch não pode apenas disparar `Promise.all()` infinito (isso travaria a DOM e estouraria Limits). Foi criado o conceito rigoroso de `skipWait`.

Ele aguarda a Inteligência Artificial decodificar a estrutura da Questão via JSON (Enunciado, Alternativas). Pela estrutura Híbrida VanillaJS vs React, ele injeta `await salvarQuestaoEmLote()` que converte o JSON numa estrutura de DOM nativa e suspende o motor. Se a questão tinha recortes de imagens atrelada no JSON, a fila Trava.

## O Tracker Cíclico de Eventos (`_waitForAllSlots`)

A inteligência da fila está centrada neste travamento defensivo. A classe implementa uma sub-fila `Set` (`this.pendingImageSlots`). Conforme os nós do sistema respondam que `batch-slot-filled` na rede de eventos do browser:

```javascript
window.removeEventListener("batch-slot-filled", this._onSlotFilled);
// Cada disparo limpa um slot
this.pendingImageSlots.delete(slotId);
if (this.pendingImageSlots.size === 0) { ... avança fila ... }
```

Se o Firebase falha ou a IA perde resolução da Imagem (Erro Visual OCR), um Timeout implacável cronometrado em 120s grita e pula a questão estragada, não comprometendo a extração das outras dezenas de propostas. A arquitetura, portanto, confere ao Maia uma imunidade de processamento em "Noite Adentro", onde o usuário pode deixar 80 páginas extraindo por horas sem intervir.

## Referências Cruzadas

- [Batch Imagens — A mecânica de recortes que alimenta este arquivo](/upload/batch-imagens)
- [Sidebar Tabs — O orquestrador de memória onde o Batch cria suas janelas fantasma](/ui/sidebar-tabs)
- [Editor Múltiplo IA — Scanner de origem gerador de dezenas de marcações num clique](/editor/multiplo-ia)
