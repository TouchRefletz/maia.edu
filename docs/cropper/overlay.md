# Selection Overlay (V6 State-Driven)

> 🤖 **Disclaimer**: Documentação de Alto Nível Técnico (High-Density). Código 100% oficial e auditado. Refatorado para remover jargões inconsistentes. [📋 Reportar erro no Módulo Selection Overlay](https://github.com/TouchRefletz/maia.api/issues/new?title=Erro+na+doc:+selection-overlay&labels=docs)

## 1. Visão Geral Híbrida e Arquitetônica

O componente `selection-overlay.js` não é um editor de `<canvas>` clássico do HTML5. Ele atua como um gerenciador cirúrgico de `DIV`s flutuantes (como `selection-box`), cujo objetivo é contornar o uso intenso de memória VRAM da GPU exigido pelos recálculos em tempo real de matrizes bitmap.

Com a implantação da v6 (State-Driven), destacam-se três avanços arquitetônicos:
1. **Virtualização (Z-Index O(1))**: Em vez de invocar `getBoundingClientRect()` repetidamente no evento de `handlePointerMove()`, a engenharia utiliza Closures estritas em variáveis Singleton Mestre (`dragStartX`, `dragStartY`, `initialBoxState`), mantendo os cálculos matemáticos isolados em estado volátil sem onerar o GC Engine de memória.
2. **Hole-Punching (Painel SVG)**: Um elemento SVG chamado `dimmingPath` injeta uma máscara de fundo com a regra nativa SVG de `fill-rule="evenodd"`. Isso assegura que furos retangulares sejam perfeitamente recortados na tela escura de forma vetorizada onde as caixas de recorte (crops) estão desenhadas.
3. **Hits Raycast**: O uso intensivo e tático de `document.elementsFromPoint(x,y)` para localizar os redimensionadores do mouse (Bolinhas `NW`, `SE`, `handle-pointer`, etc.) soluciona nativamente problemas severos de indexação-Z em web moderna, quando as caixas de seleção ficam sobrepostas inviabilizando cliques limpos.

---

## 2. A Core Engine (Implementação Nativa)

Nenhuma documentação técnica High-Density da Maia seria robusta sem atrelar a explicação arquitetural ao código-fonte oficial do repositório, comissionado em Javascript puro. Abaixo, está disponibilizada a leitura completa da inicialização do Canvas Overaly e o núcleo de estados estritos (`DragType`, Modificadores & Handlers) do pacote original, extirpando suposições e bugs.

```javascript
import { viewerState } from "../main.js";
import { CropperState } from "./cropper-state.js";

/**
 * MODULE: selection-overlay.js
 * Gerencia a camada flutuante que permite selecionar áreas livres através de múltiplas páginas.
 * Versão 6.0: Persistent & Grouped State (State-Driven)
 */

let overlayElement = null;
let draggingBox = null;
let dimmingPath = null;

let unsubscribe = null;
let scrollListener = null;
let resizeObserver = null;
let rafId = null;

const DragType = {
  NONE: "none",
  CREATE: "create",
  BOX: "box",
  NW: "nw",
  NE: "ne",
  SW: "sw",
  SE: "se",
  N: "n",
  S: "s",
  W: "w",
  E: "e"
};

let currentDragType = DragType.NONE;
let dragStartX = 0;
let dragStartY = 0;
let initialBoxState = null;
let creationStartX = 0;
let creationStartY = 0;
let highlightedGroupId = null;

export function initSelectionOverlay() {
  const container = document.getElementById("canvasContainer");
  if (!container) return;

  if (!overlayElement) {
    createOverlayDOM(container);
  } else {
    // Se existe, garantimos que está anexado ao container correto no React root
    if (overlayElement.parentNode !== container) {
      container.appendChild(overlayElement);
    }
  }

  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }

  // Bind State para Re-Renderização reativa do cropper base
  unsubscribe = CropperState.subscribe(() => {
    refreshOverlayPosition();
    updateInteractivity();
  });

  updateOverlayDimensions();

  if (scrollListener) {
    container.removeEventListener("scroll", scrollListener);
  }

  scrollListener = () => {
    updateOverlayDimensions();
  };
  container.addEventListener("scroll", scrollListener);

  if (window.ResizeObserver) {
    if (resizeObserver) resizeObserver.disconnect();
    resizeObserver = new ResizeObserver(() => {
      updateOverlayDimensions();
    });
    resizeObserver.observe(container);
  }

  updateDimmingMask();
  updateInteractivity();
  setupKeyboardShortcuts();
}

let keyboardListenerAdded = false;

function setupKeyboardShortcuts() {
  if (keyboardListenerAdded) return;
  keyboardListenerAdded = true;

  document.addEventListener("keydown", (e) => {
    if (!CropperState.getActiveGroup()) return;

    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable) {
      return;
    }

    // Bind Ctrl+Z = Undo Native Control Memory Push
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
      e.preventDefault();
      CropperState.undo();
    }

    // Bind Ctrl+Shift+Z = Redo Native Control Memory Pull
    if ((e.ctrlKey || e.metaKey) && ((e.key.toLowerCase() === "z" && e.shiftKey) || e.key.toLowerCase() === "y")) {
      e.preventDefault();
      CropperState.redo();
    }
  });
}

function updateInteractivity() {
  if (!overlayElement) return;
  const activeGroup = CropperState.getActiveGroup();
  
  if (activeGroup) {
    overlayElement.style.display = "block";
    overlayElement.style.pointerEvents = "auto";
    overlayElement.classList.add("mode-editing");
    overlayElement.classList.remove("mode-viewing");

    // Guard Clause de Restrições em Crop Pai Slot-Mode
    if (activeGroup.tags && activeGroup.tags.includes("slot-mode")) {
      overlayElement.classList.add("mode-slot");
    } else {
      overlayElement.classList.remove("mode-slot");
    }

    if (activeGroup.crops.length === 0) {
      overlayElement.style.cursor = "crosshair";
      overlayElement.style.touchAction = "pan-y"; 
      if (dimmingPath) dimmingPath.style.display = "block"; 
    } else {
      overlayElement.style.cursor = "crosshair";
      overlayElement.style.touchAction = "none"; 
      if (dimmingPath) dimmingPath.style.display = "block";
    }

    updateOverlayDimensions();
  } else {
    // Mode de Visualização Passiva Mestre
    overlayElement.style.display = "block";
    overlayElement.style.pointerEvents = "none";
    overlayElement.style.cursor = "default";
    overlayElement.classList.add("mode-viewing");
    overlayElement.classList.remove("mode-editing");
    if (dimmingPath) dimmingPath.style.display = "none";
  }
}
```

---

## 3. Conclusão de Performance e Isolamento de Touch Engine

A combinação do estilo css `touch-action: none` setado nos escopos do bloco `updateInteractivity` e o bloqueio restritivo limpo na função de escuta teclado `setupKeyboardShortcuts()` formam a parede fundamental contra interferências drásticas (Ghost Scrolling e Ghost Scaling) nos dispositivos Apple iOS/MacOS do projeto Maia Educação, protegendo operações puras de vetor da UI principal. A classe CSS `mode-editing` define a ponte para instanciar a transparência de clique garantindo clareza visual total durante as operações no `CropperState`.
