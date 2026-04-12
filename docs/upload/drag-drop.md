# Drag & Drop — Gerenciamento Estrito de Arquivos Interativos

> 🤖 **Disclaimer**: Documentação gerada por IA e pode conter imprecisões. [📋 Reportar erro](https://github.com/TouchRefletz/maia.api/issues/new?title=Erro+na+doc:+drag-drop&labels=docs)

## Visão Geral

O arquivo genérico `drag-drop.js` (`js/upload/drag-drop.js`) implementa um wrapper robusto da **HTML5 Drag and Drop API**. Em vez de acoplar sua lógica ao gigantesco `form-logic.js`, ele foi projetado como uma Utility Function ("Pureish Function") que recebe apenas três referências mutáveis: a Área Flutuante (DropZone), o Escravo Input Arquivo `input[type='file']`, e o Text Node Display.

Com cerca de \~60 linhas de VanillaJS puro, esta abstração foca-se na prevenção de comportamentos danosos do navegador e validações estritas de MIME Type, alimentando o Pipeline do Upload com DataTransfer objects cristalinos.

## Isolamento e Prevenção de Abortos Visuais

Quando um usuário acidentalmente solta um arquivo (PDF ou JPEG) em qualquer lugar desprotegido do Browse Engine de Chromium ou Firefox, a ação corriqueira do motor HTML5 é abortar a SPA (Single Page Application) atual e *Renderizar* o arquivo local. Como a engine do Maia extrai e carrega estado volátil do `sessionStorage`, esse re-direcionamento causa perda trágica da sessão não-salva.

O `drag-drop` estipula uma gaiola rigorosa através de Listeners de Alta-Prioridade:
```javascript
const events = ["dragenter", "dragover", "dragleave", "drop"];
events.forEach((evt) => {
   dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation(); // Aniquila o bubble up TheDOM
   }, false);
});
```
Nenhum arquivo solto dentro das linhas pontilhadas de `.upload-box` resultará em um `window.location` hijack do navegador.

## Tratamento Assíncrono da Área Visual e DataTransfer

O arquivo rege o estado flutuante da Área de Colar através do inject e eject da classe css `.drag-over`. Quando o objeto `e.dataTransfer.files` cai no chão elástico (drop event), o script executa um porteiro de validação agressivo:

1. **Length Check**: Apenas aceita array preenchido.
2. **Mime Type Securing**: `if (files[0].type !== "application/pdf")`. Sem alertas nativos rudes; utiliza nossa bridge de UI `customAlert()`.

Se aceito, não acionamos fetchers aqui; transferimos brutal e assincronamente a Propriedade Ficheiro do DataTransfer solto para o Nodo Invisível HTML:
```javascript
inputElement.files = files; // Transfere pseudo-matriz de arquivos.
```
Essa ponte garante que quando o `form-logic.js` invocar sua macroestrutural `form.addEventListener("submit")`, o elemento `pdfInput.files[0]` exista solidamente como se o usuário tivesse efetivamente clicado no longo processo de Windows Explorer File Dialog.

## Efeito Colateral: Input Change Link

Para preencher a redundância (botão físico Clicado vs Objeto Arrastado), o módulo assina o Listener do evento de "change" da aba do `input[type=file]` para equalizar o elemento Display Visual (O nome em cinza `file.name`), padronizando o comportamento não importando a origem física da inserção de dados feita pelo humano.

## Referências Cruzadas

- [Form Logic — O Orquestrador que engole estes arquivos persistidos no `.files`](/upload/form-logic)
- [Pdf Renderers — Módulo UI final que também carrega blobs se for em Local Fallback](/ui/pdf-renderers)
- [API Worker Proxying — Responsável pelo Cloud Hashing desta mesma variável PDF](/api-worker/proxy-services)
