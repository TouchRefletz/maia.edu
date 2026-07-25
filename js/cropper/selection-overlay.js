import { viewerState } from '../main.js';
import { CropperState } from './cropper-state.js';

/**
 * MODULE: selection-overlay.js
 * Gerencia a camada flutuante que permite selecionar áreas livres através de múltiplas páginas.
 * Versão 6.0: Persistent & Grouped State (State-Driven)
 */

let overlayElement = null;
// ActiveBox agora é apenas uma referência temporária durante o ARRASTE/CRIACAO.
// A persistência real vem do CropperState.
let draggingBox = null;
let dimmingPath = null;

// Listeners
let unsubscribe = null;
let scrollListener = null;
let resizeObserver = null;
let rafId = null;

// Enum
const DragType = {
  NONE: 'none',
  CREATE: 'create',
  BOX: 'box',
  NW: 'nw',
  NE: 'ne',
  SW: 'sw',
  SE: 'se',
  N: 'n',
  S: 's',
  W: 'w',
  E: 'e',
  // Adicione outros tipos se necessário
};

let currentDragType = DragType.NONE;
let dragStartX = 0;
let dragStartY = 0;
let initialBoxState = null;
let creationStartX = 0;
let creationStartY = 0;

// Highlight state (hover da sidebar)
let highlightedGroupId = null;

export function initSelectionOverlay() {
  const container = document.getElementById('canvasContainer');
  if (!container) return;

  if (!overlayElement) {
    createOverlayDOM(container);
  } else {
    // Se jÃ¡ existe, garantimos que estÃ¡ anexado ao container correto (caso de re-render geral)
    if (overlayElement.parentNode !== container) {
      container.appendChild(overlayElement);
    }
  }

  // Previna mÃºltiplas subscriÃ§Ãµes
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }

  // Subscribe to changes in state to re-render
  unsubscribe = CropperState.subscribe(() => {
    refreshOverlayPosition();
    updateInteractivity();
  });

  // Atualiza altura e largura total
  updateOverlayDimensions();

  // Listeners Robustos
  // Remove anterior se existir para nÃ£o duplicar
  if (scrollListener) {
    container.removeEventListener('scroll', scrollListener);
  }

  scrollListener = () => {
    updateOverlayDimensions();
  };
  container.addEventListener('scroll', scrollListener);

  if (window.ResizeObserver) {
    if (resizeObserver) resizeObserver.disconnect();

    resizeObserver = new ResizeObserver(() => {
      updateOverlayDimensions();
    });
    resizeObserver.observe(container);
  }

  updateDimmingMask();
  updateInteractivity();

  // Keyboard shortcuts para Undo/Redo
  setupKeyboardShortcuts();
}

// Listener de teclado para Ctrl+Z / Ctrl+Shift+Z
let keyboardListenerAdded = false;

function setupKeyboardShortcuts() {
  if (keyboardListenerAdded) return;
  keyboardListenerAdded = true;

  document.addEventListener('keydown', (e) => {
    // Só funciona se tiver grupo ativo (modo edição)
    if (!CropperState.getActiveGroup()) return;

    // Ignora se estiver em um input/textarea
    if (
      e.target.tagName === 'INPUT' ||
      e.target.tagName === 'TEXTAREA' ||
      e.target.isContentEditable
    ) {
      return;
    }

    // Ctrl+Z = Undo
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      e.preventDefault();
      CropperState.undo();
    }

    // Ctrl+Shift+Z ou Ctrl+Y = Redo
    if (
      (e.ctrlKey || e.metaKey) &&
      ((e.key.toLowerCase() === 'z' && e.shiftKey) || e.key.toLowerCase() === 'y')
    ) {
      e.preventDefault();
      CropperState.redo();
    }
  });
}

function updateInteractivity() {
  if (!overlayElement) return;
  const activeGroup = CropperState.getActiveGroup();
  // Se tem grupo ativo, overlay pega cliques. Se não, deixa passar (mas mostra os crops).
  // Porém, se clicarmos num crop existente em modo passivo, talvez queiramos selecionar o grupo?
  // Por simplicidade v1: Só edita se tiver grupo ativo.
  if (activeGroup) {
    overlayElement.style.display = 'block';
    overlayElement.style.pointerEvents = 'auto';
    overlayElement.classList.add('mode-editing');
    overlayElement.classList.remove('mode-viewing');

    // Adiciona classe específica para estilização simplificada se necessário
    if (activeGroup.tags && activeGroup.tags.includes('slot-mode')) {
      overlayElement.classList.add('mode-slot');
    } else {
      overlayElement.classList.remove('mode-slot');
    }

    // FIX: Se o grupo estiver vazio (criando nova questao), não "lockar" visualmente nem scroll
    if (activeGroup.crops.length === 0) {
      overlayElement.style.cursor = 'crosshair';
      overlayElement.style.touchAction = 'pan-y'; // Permite scroll vertical
      if (dimmingPath) dimmingPath.style.display = 'block'; // Re-habilita fundo escuro (pedido do user)
    } else {
      overlayElement.style.cursor = 'crosshair';
      overlayElement.style.touchAction = 'none'; // Bloqueia scroll para precisão na edição
      if (dimmingPath) dimmingPath.style.display = 'block';
    }

    // Forçar atualização de dimensões ao mostrar
    updateOverlayDimensions();
  } else {
    // Mantém VISÍVEL (block) para ver os crops, mas SEM INTERAÇÃO (none) para scrollar
    overlayElement.style.display = 'block';
    overlayElement.style.pointerEvents = 'none';
    overlayElement.style.cursor = 'default';
    overlayElement.classList.add('mode-viewing');
    overlayElement.classList.remove('mode-editing');
    // Remove o fundo escuro
    if (dimmingPath) dimmingPath.style.display = 'none';
  }
}

function updateOverlayDimensions() {
  const container = document.getElementById('canvasContainer');
  if (!container || !overlayElement) return;

  const w = Math.max(container.scrollWidth, container.clientWidth);
  const h = Math.max(container.scrollHeight, container.clientHeight);

  if (overlayElement.style.width === `${w}px` && overlayElement.style.height === `${h}px`) {
    return;
  }

  overlayElement.style.width = `${w}px`;
  overlayElement.style.height = `${h}px`;

  if (overlayElement.firstChild && overlayElement.firstChild.tagName === 'svg') {
    overlayElement.firstChild.setAttribute('width', '100%');
    overlayElement.firstChild.setAttribute('height', '100%');
    overlayElement.firstChild.setAttribute('viewBox', `0 0 ${w} ${h}`);
  }

  updateDimmingMask();
}

function createOverlayDOM(container) {
  overlayElement = document.createElement('div');
  overlayElement.id = 'selection-overlay';
  overlayElement.style.position = 'absolute';
  overlayElement.style.top = '0';
  overlayElement.style.left = '0';
  overlayElement.style.width = '100%';
  overlayElement.style.zIndex = '999';
  overlayElement.style.backgroundColor = 'transparent';
  overlayElement.style.touchAction = 'none';

  // SVG Mask Layer
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.style.position = 'absolute';
  svg.style.top = '0';
  svg.style.left = '0';
  svg.style.width = '100%';
  svg.style.height = '100%';
  svg.style.pointerEvents = 'none';

  dimmingPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  dimmingPath.setAttribute('fill', 'rgba(0, 0, 0, 0.5)');
  dimmingPath.setAttribute('fill-rule', 'evenodd');

  svg.appendChild(dimmingPath);
  overlayElement.appendChild(svg);

  container.appendChild(overlayElement);

  overlayElement.addEventListener('pointerdown', handlePointerDown);
  document.addEventListener('pointermove', handlePointerMove);
  document.addEventListener('pointerup', handlePointerUp);

  // Listener para detectar hover em handles "abaixo" de outras boxes e ajustar cursor
  overlayElement.addEventListener('mousemove', handleHoverCursor);
}

// Mapa de handles para cursores CSS
const handleCursorMap = {
  nw: 'nwse-resize',
  se: 'nwse-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  n: 'ns-resize',
  s: 'ns-resize',
  w: 'ew-resize',
  e: 'ew-resize',
};

function handleHoverCursor(e) {
  if (!overlayElement || currentDragType !== DragType.NONE) return;

  // Não precisa checar se tem grupo ativo para hover, só para clique
  const elementsAtPoint = document.elementsFromPoint(e.clientX, e.clientY);

  // Procura por resize-handle em QUALQUER camada
  const handleEl = elementsAtPoint.find((el) => el.classList.contains('resize-handle'));
  if (handleEl && handleEl.dataset.handle) {
    const cursor = handleCursorMap[handleEl.dataset.handle] || 'pointer';
    overlayElement.style.cursor = cursor;
    return;
  }

  // Procura por selection-box do grupo ativo
  const boxEl = elementsAtPoint.find(
    (el) => el.classList.contains('selection-box') && el.classList.contains('is-active-group'),
  );
  if (boxEl) {
    overlayElement.style.cursor = 'move';
    return;
  }

  // Default: crosshair para criar nova seleção
  overlayElement.style.cursor = 'crosshair';
}

// Helper para criar caixa DOM
function createSelectionBoxDOM(isActiveGroup) {
  const box = document.createElement('div');
  box.className = 'selection-box';
  // Posicionamento absoluto é necessário para o funcionamento
  box.style.position = 'absolute';

  if (isActiveGroup) {
    box.classList.add('is-active-group');

    // Criar handles apenas se for do grupo ativo
    const handles = ['nw', 'ne', 'sw', 'se', 'n', 's', 'w', 'e'];
    handles.forEach((h) => {
      const el = document.createElement('div');
      // As classes handle-nw, handle-n, etc já cuidam do posicionamento e cursor no CSS
      el.className = `resize-handle handle-${h}`;
      el.dataset.handle = h;
      box.appendChild(el);
    });
  } else {
    // Passivo / Outros grupos
    box.classList.add('is-inactive-group');
  }

  return box;
}

export function removeSelectionOverlay() {
  // Nós não removemos mais totalmente, apenas escondemos/desativamos
  // Mas para manter compatibilidade com limpar tudo:
  const container = document.getElementById('canvasContainer');
  if (overlayElement && container) {
    // Se quiser hard remove:
    // container.removeChild(overlayElement);
    // overlayElement = null;

    // Mas a ideia é persistir. Então vamos apenas limpar a store SE for um reset total.
    // Se for só 'fechar ferramenta', mantemos.
    // A função 'removeSelectionOverlay' é chamada em 'fecharVisualizador' que limpa tudo.
    // Então aqui Sim, removemos.
    if (overlayElement.parentNode === container) {
      container.removeChild(overlayElement);
    }
  }

  overlayElement = null;
  draggingBox = null;
  dimmingPath = null;

  // Limpar listeners
  document.removeEventListener('pointermove', handlePointerMove);
  document.removeEventListener('pointerup', handlePointerUp);

  if (container && scrollListener) {
    container.removeEventListener('scroll', scrollListener);
  }
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
}

// --- DRAG AND RESIZE LOGIC ---

function handlePointerDown(e) {
  if (!overlayElement) return;

  // 0. Bloqueio se não tiver grupo ativo
  const activeGroup = CropperState.getActiveGroup();

  if (!activeGroup) {
    // Talvez piscar a sidebar?
    return;
  }

  // GUARD: Slot-Mode
  // Se for modo de slot (preenchimento de imagem), permitimos o fluxo básico
  // ignorando qualquer verificação potencial de metadados de questão.
  const isSlotMode = activeGroup.tags && activeGroup.tags.includes('slot-mode');

  const target = e.target;

  // Coordinates relative to overlay
  const rect = overlayElement.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  // IMPORTANT: Use elementsFromPoint para encontrar handles que podem estar "abaixo" de outras boxes
  const elementsAtPoint = document.elementsFromPoint(e.clientX, e.clientY);

  // 1. Procura por resize-handle em QUALQUER camada (não só e.target)
  const handleEl = elementsAtPoint.find((el) => el.classList.contains('resize-handle'));
  if (handleEl) {
    const box = handleEl.parentElement;

    // Check ownership (safety) - só permite editar boxes do grupo ativo
    if (box && box.classList.contains('is-active-group')) {
      draggingBox = box;
      currentDragType = handleEl.dataset.handle;
      e.preventDefault();
      e.stopPropagation(); // Impede que o evento propague e crie nova seleção

      initialBoxState = { ...box.__selectionRect };
      dragStartX = e.clientX;
      dragStartY = e.clientY;

      refreshBoxConstraint(box);

      overlayElement.setPointerCapture(e.pointerId);
      cacheBoxPositionsForDrag();
      updateDimmingMask();
      return; // Encerra aqui - não cria nova box
    }
  }

  // 2. Procura por selection-box do grupo ativo em QUALQUER camada
  const boxEl = elementsAtPoint.find(
    (el) => el.classList.contains('selection-box') && el.classList.contains('is-active-group'),
  );
  if (boxEl) {
    draggingBox = boxEl;
    currentDragType = DragType.BOX;
    e.preventDefault();

    initialBoxState = { ...boxEl.__selectionRect };
    dragStartX = e.clientX;
    dragStartY = e.clientY;

    refreshBoxConstraint(boxEl);

    overlayElement.setPointerCapture(e.pointerId);
    cacheBoxPositionsForDrag();
    updateDimmingMask();
    return; // Encerra aqui - não cria nova box
  }

  // 3. Clicked empty space -> Create new box
  {
    // 3a. CHECK: Start strictly inside a page?
    const elements = document.elementsFromPoint(e.clientX, e.clientY);
    const pageEl = elements.find((el) => el.classList.contains('pdf-page'));

    if (!pageEl) return;

    // CHECK CONSTRAINT
    if (CropperState.pageConstraint) {
      const clickedPageNum = parseInt(pageEl.dataset.pageNum);
      if (clickedPageNum !== CropperState.pageConstraint.pageNum) {
        // Feedback visual (shake? alert?)
        // Por enquanto, apenas bloqueia
        return;
      }
    }

    // --- SLOT MODE CONSTRAINT (Strict Parent Logic) ---
    // User Requirement: "sem crop da questão na página bloqueia hein"
    // "não possa selecionar fora de algum crop da questão"
    let imposedConstraint = null;

    if (activeGroup && activeGroup.tags && activeGroup.tags.includes('slot-mode')) {
      const clickedPageNum = parseInt(pageEl.dataset.pageNum);

      // Get all potential parent crops on this page
      let parentCrops = CropperState.getQuestaoContextCrops(clickedPageNum);

      // --- STRICT MODE: Filter by Parent Group ID if available ---
      const activeGroupId = activeGroup.id;
      // Note: activeGroup is the temp slot group. We need its metadata.
      if (activeGroup.metadata && activeGroup.metadata.parentGroupId) {
        const requiredParentId = parseInt(activeGroup.metadata.parentGroupId);
        // Filter crops that belong to the required parent group
        parentCrops = parentCrops.filter((c) => c.groupId === requiredParentId);
      }
      // -----------------------------------------------------------

      if (parentCrops.length === 0) {
        // Bloqueia se não houver questão "pai" na página (ou se não for a questão pai correta)
        // customAlert("Selecione primeiro a áera da questão nesta página."); // (Opcional)
        return;
      }

      // Verifica se o clique está dentro de algum crop "pai"
      const currentScale = viewerState.pdfScale;
      const foundParent = parentCrops.find((crop) => {
        const anchorData = crop.anchorData;
        const pageWrapper = document.getElementById(`page-wrapper-${anchorData.anchorPageNum}`);
        if (!pageWrapper) return false;

        const pLeft = pageWrapper.offsetLeft + anchorData.relativeLeft * currentScale;
        const pTop = pageWrapper.offsetTop + anchorData.relativeTop * currentScale;
        const pWidth = anchorData.unscaledW * currentScale;
        const pHeight = anchorData.unscaledH * currentScale;

        // Overlay coords equivalent imply checking clientX/Y against screen rects.
        // Or calculating overlay relative.
        // Vamos usar client coords para "point check" rápido.
        // O `overlayElement` pode estar scrollado? "ElementsFromPoint" usa viewport coords.
        // `pageWrapper.getBoundingClientRect()` é mais seguro para comparar com `e.clientX`.

        const rect = pageWrapper.getBoundingClientRect();
        // Recalcular offsets visuais relativos ao viewport
        const visLeft = rect.left + anchorData.relativeLeft * currentScale;
        const visTop = rect.top + anchorData.relativeTop * currentScale;
        const visRight = visLeft + pWidth;
        const visBottom = visTop + pHeight;

        return (
          e.clientX >= visLeft &&
          e.clientX <= visRight &&
          e.clientY >= visTop &&
          e.clientY <= visBottom
        );
      });

      if (!foundParent) {
        // Clicou fora da área da questão
        return;
      }

      // Se achou, definimos o constraint box para esse crop específico
      // Precisamos converter para coordenadas relativas ao OVERLAY,
      // pois é isso que `updateSelectionBox` e o resto da lógica usam.
      const oRect = overlayElement.getBoundingClientRect();
      const pageWrapper = document.getElementById(
        `page-wrapper-${foundParent.anchorData.anchorPageNum}`,
      );
      // Pega rect da pagina relativo ao overlay
      const pRect = pageWrapper.getBoundingClientRect();

      // Coords relativas ao overlay
      const cropLeft = pRect.left - oRect.left + foundParent.anchorData.relativeLeft * currentScale;
      const cropTop = pRect.top - oRect.top + foundParent.anchorData.relativeTop * currentScale;
      const cropW = foundParent.anchorData.unscaledW * currentScale;
      const cropH = foundParent.anchorData.unscaledH * currentScale;

      imposedConstraint = {
        left: cropLeft,
        top: cropTop,
        right: cropLeft + cropW,
        bottom: cropTop + cropH,
        width: cropW,
        height: cropH,
      };
    }
    // ----------------------------------------------------

    currentDragType = DragType.CREATE;
    e.preventDefault();

    // Fix: In slot-mode (single crop), clear previous crops immediately upon starting new drag
    if (activeGroup && activeGroup.tags && activeGroup.tags.includes('slot-mode')) {
      CropperState.clearActiveGroupCrops();
    }

    creationStartX = x;
    creationStartY = y;

    // Criar caixa temporária
    const newBox = createSelectionBoxDOM(true); // true = active

    // Apply immediate color to the temporary box (so handles/border look right during creation)
    if (activeGroup) {
      const color = CropperState.getGroupColor(activeGroup);
      newBox.style.borderColor = color;
      newBox.style.setProperty('--color-primary', color);

      const rgb = hexToRgb(color);
      if (rgb) {
        newBox.style.setProperty('--color-primary-rgb', rgb);
      }

      newBox.style.backgroundColor = `${color}1A`;
    }

    overlayElement.appendChild(newBox);
    draggingBox = newBox;

    if (imposedConstraint) {
      newBox.__constraint = imposedConstraint;
    } else {
      const pRect = pageEl.getBoundingClientRect();
      const oRect = overlayElement.getBoundingClientRect();
      newBox.__constraint = {
        left: pRect.left - oRect.left,
        top: pRect.top - oRect.top,
        right: pRect.right - oRect.left,
        bottom: pRect.bottom - oRect.top,
        width: pRect.width,
        height: pRect.height,
      };
    }

    updateSelectionBox(newBox, creationStartX, creationStartY, 0, 0);
  }

  overlayElement.setPointerCapture(e.pointerId);
  cacheBoxPositionsForDrag(); // Cache other box positions for optimized updateDimmingMask
  updateDimmingMask();
}

function refreshBoxConstraint(box) {
  if (!box || !box.__selectionRect) return;
  // Find page based on center of box
  const boxRect = box.getBoundingClientRect();
  const centerX = boxRect.left + boxRect.width / 2;
  const centerY = boxRect.top + boxRect.height / 2;

  const elements = document.elementsFromPoint(centerX, centerY);
  const pageEl = elements.find((el) => el.classList.contains('pdf-page'));

  if (pageEl && overlayElement) {
    // --- DEFAULT CONSTRAINT: PAGE BOUNDS ---
    const pRect = pageEl.getBoundingClientRect();
    const oRect = overlayElement.getBoundingClientRect();
    let constraint = {
      left: pRect.left - oRect.left,
      top: pRect.top - oRect.top,
      right: pRect.right - oRect.left,
      bottom: pRect.bottom - oRect.top,
      width: pRect.width,
      height: pRect.height,
    };

    // --- SLOT MODE CONSTRAINT (Strict Parent Logic) ---
    // Aplica a mesma restrição do handlePointerDown durante a edição/move
    const activeGroup = CropperState.getActiveGroup();
    if (activeGroup && activeGroup.tags && activeGroup.tags.includes('slot-mode')) {
      const clickedPageNum = parseInt(pageEl.dataset.pageNum);
      let parentCrops = CropperState.getQuestaoContextCrops(clickedPageNum);

      // Filter by Parent Group ID if available
      if (activeGroup.metadata && activeGroup.metadata.parentGroupId) {
        const requiredParentId = parseInt(activeGroup.metadata.parentGroupId);
        parentCrops = parentCrops.filter((c) => c.groupId === requiredParentId);
      }

      // Se achou crop pai, restringe a ele
      if (parentCrops.length > 0) {
        // Encontra o crop que contam a box atual (ou o primeiro válido)
        // Como já estamos editando um crop EXISTENTE, ele supostamente já está dentro.
        // Vamos pegar o primeiro que servir (ou o que contém o centro).
        const currentScale = viewerState.pdfScale;

        // Tenta achar o crop pai que contem o centro da box atual
        const foundParent = parentCrops.find((crop) => {
          const anchorData = crop.anchorData;
          const pageWrapper = document.getElementById(`page-wrapper-${anchorData.anchorPageNum}`);
          if (!pageWrapper) return false;

          const rect = pageWrapper.getBoundingClientRect();
          const visLeft = rect.left + anchorData.relativeLeft * currentScale;
          const visTop = rect.top + anchorData.relativeTop * currentScale;
          const visRight = visLeft + anchorData.unscaledW * currentScale;
          const visBottom = visTop + anchorData.unscaledH * currentScale;

          return (
            centerX >= visLeft && centerX <= visRight && centerY >= visTop && centerY <= visBottom
          );
        });

        // Se achou um pai valido onde o centro está
        if (foundParent) {
          const wrapper = document.getElementById(
            `page-wrapper-${foundParent.anchorData.anchorPageNum}`,
          );
          const wRect = wrapper.getBoundingClientRect();

          const cropLeft =
            wRect.left - oRect.left + foundParent.anchorData.relativeLeft * currentScale;
          const cropTop = wRect.top - oRect.top + foundParent.anchorData.relativeTop * currentScale;
          const cropW = foundParent.anchorData.unscaledW * currentScale;
          const cropH = foundParent.anchorData.unscaledH * currentScale;

          constraint = {
            left: cropLeft,
            top: cropTop,
            right: cropLeft + cropW,
            bottom: cropTop + cropH,
            width: cropW,
            height: cropH,
          };
        }
      }
    }

    box.__constraint = constraint;
  }
}

function handlePointerMove(e) {
  if (currentDragType === DragType.NONE || !overlayElement) return;

  if (rafId) return;

  rafId = requestAnimationFrame(() => {
    rafId = null;
    if (!overlayElement) return;

    const rect = overlayElement.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (currentDragType === DragType.CREATE) {
      if (!draggingBox) return;

      let left = Math.min(mouseX, creationStartX);
      let top = Math.min(mouseY, creationStartY);
      let width = Math.abs(mouseX - creationStartX);
      let height = Math.abs(mouseY - creationStartY);

      if (draggingBox.__constraint) {
        const c = draggingBox.__constraint;
        let curX = mouseX;
        let curY = mouseY;
        if (curX < c.left) curX = c.left;
        if (curX > c.right) curX = c.right;
        if (curY < c.top) curY = c.top;
        if (curY > c.bottom) curY = c.bottom;

        left = Math.min(curX, creationStartX);
        top = Math.min(curY, creationStartY);
        width = Math.abs(curX - creationStartX);
        height = Math.abs(curY - creationStartY);
      }

      updateSelectionBox(draggingBox, left, top, width, height);
    } else {
      if (!initialBoxState || !draggingBox) return;

      const deltaX = e.clientX - dragStartX;
      const deltaY = e.clientY - dragStartY;

      let newLeft = initialBoxState.left;
      let newTop = initialBoxState.top;
      let newWidth = initialBoxState.width;
      let newHeight = initialBoxState.height;

      if (currentDragType === DragType.BOX) {
        newLeft += deltaX;
        newTop += deltaY;
      } else {
        const type = currentDragType;
        if (type.includes('e')) newWidth += deltaX;
        if (type.includes('w')) {
          newLeft += deltaX;
          newWidth -= deltaX;
        }
        if (type.includes('s')) newHeight += deltaY;
        if (type.includes('n')) {
          newTop += deltaY;
          newHeight -= deltaY;
        }
      }

      if (newWidth < 10) newWidth = 10;
      if (newHeight < 10) newHeight = 10;

      // --- CONSTRAINT APPLICATION ---
      if (draggingBox && draggingBox.__constraint) {
        const c = draggingBox.__constraint;

        // Calculate anchors from initial state for resize clamping
        const initialBottom = initialBoxState.top + initialBoxState.height;
        const initialRight = initialBoxState.left + initialBoxState.width;

        // 1. Clamp LEFT
        if (newLeft < c.left) {
          newLeft = c.left;
          // If resizing West (Left), we must Recalculate Width to preserve Right Anchor
          if (currentDragType !== DragType.BOX && currentDragType.includes('w')) {
            newWidth = initialRight - newLeft;
          }
        }

        // 2. Clamp TOP
        if (newTop < c.top) {
          newTop = c.top;
          // If resizing North (Top), we must Recalculate Height to preserve Bottom Anchor
          if (currentDragType !== DragType.BOX && currentDragType.includes('n')) {
            newHeight = initialBottom - newTop;
          }
        }

        // 3. Clamp RIGHT (Width)
        if (newLeft + newWidth > c.right) {
          if (currentDragType === DragType.BOX) {
            newLeft = c.right - newWidth;
            if (newLeft < c.left) {
              newLeft = c.left;
              newWidth = c.right - c.left;
            }
          } else {
            // Resize East/West
            // If dragging East, ensure width doesn't exceed boundary
            newWidth = c.right - newLeft;
          }
        }

        // 4. Clamp BOTTOM (Height)
        if (newTop + newHeight > c.bottom) {
          if (currentDragType === DragType.BOX) {
            newTop = c.bottom - newHeight;
            if (newTop < c.top) {
              newTop = c.top;
              newHeight = c.bottom - c.top;
            }
          } else {
            // Resize North/South
            newHeight = c.bottom - newTop;
          }
        }
      }

      updateSelectionBox(draggingBox, newLeft, newTop, newWidth, newHeight);
    }
    updateDimmingMask();
  });
}

function handlePointerUp(e) {
  if (currentDragType !== DragType.NONE) {
    // CRIACAO NOVO CROP
    if (currentDragType === DragType.CREATE && draggingBox) {
      const rect = draggingBox.__selectionRect;
      if (!rect || rect.width < 5 || rect.height < 5) {
        draggingBox.remove();
        draggingBox = null;
      } else {
        // SALVAR NO ESTADO
        const anchorData = calculateAnchor(draggingBox, rect);
        if (anchorData) {
          // Adiciona ao estado (que vai disparar refreshOverlayPosition e recriar o box corretamente)
          CropperState.addCropToActiveGroup({ anchorData });

          // Remove o DOM temporário (o refresh o trará de volta como permanente)
          draggingBox.remove();
        } else {
          draggingBox.remove();
        }
      }
    }
    // EDICAO DE EXISTENTE
    else if (draggingBox) {
      // Se tem cropId (veio do render ou já persistido), atualizamos
      const cropId = draggingBox.dataset.cropId;
      const rect = draggingBox.__selectionRect;

      if (cropId && rect) {
        // Precisamos recalcular o anchorData
        const anchorData = calculateAnchor(draggingBox, rect);
        if (anchorData) {
          // Converte string para number se necessário, dependendo de como foi salvo
          // Date.now() + Math.random() cria number, mas dataset vira string.
          // Vamos tratar comparar frouxamente ou converter.
          // Melhor passar como está e o findIndex lidar (mas dataset é string).
          // No addCrop fizemos: cropData.id = ... (number)
          // Então:
          const idNum = parseFloat(cropId);
          CropperState.updateCrop(idNum, anchorData);
        }
      }

      draggingBox.remove();
    }

    currentDragType = DragType.NONE;
    initialBoxState = null;
    draggingBox = null;

    if (overlayElement) overlayElement.releasePointerCapture(e.pointerId);

    clearBoxPositionCache(); // Clear cache after drag ends

    // Força refresh para garantir sincronia
    updateDimmingMask();
  }
}

function updateSelectionBox(box, left, top, w, h) {
  if (!box) return;
  box.style.left = `${left}px`;
  box.style.top = `${top}px`;
  box.style.width = `${w}px`;
  box.style.height = `${h}px`;
  box.__selectionRect = { left, top, width: w, height: h };
}

// --- CALCULO ANCORA ---

function calculateAnchor(box, currentRect) {
  const container = document.getElementById('canvasContainer');
  const boxLeft = currentRect.left;
  const boxTop = currentRect.top;
  const boxCX = boxLeft + currentRect.width / 2;
  const boxCY = boxTop + currentRect.height / 2;

  const pages = Array.from(container.querySelectorAll('.pdf-page'));
  let bestPage = null;

  for (const page of pages) {
    const pTop = page.offsetTop;
    const pHeight = page.offsetHeight;
    const pBottom = pTop + pHeight;

    if (boxCY >= pTop && boxCY <= pBottom) {
      bestPage = page;
      break;
    }
  }

  if (!bestPage) return null;

  const currentScale = viewerState.pdfScale;
  const relativeTop = (boxTop - bestPage.offsetTop) / currentScale;
  const relativeLeft = (boxLeft - bestPage.offsetLeft) / currentScale;
  const unscaledW = currentRect.width / currentScale;
  const unscaledH = currentRect.height / currentScale;

  return {
    anchorPageNum: parseInt(bestPage.dataset.pageNum),
    relativeTop,
    relativeLeft,
    unscaledW,
    unscaledH,
  };
}

// --- RENDERIZADOR PRINCIPAL ---

export function refreshOverlayPosition() {
  const container = document.getElementById('canvasContainer');
  if (!overlayElement || !viewerState.pdfDoc || !container) return;

  if (overlayElement.parentNode !== container) {
    container.appendChild(overlayElement);
  }

  updateOverlayDimensions();

  // 1. Limpar boxes existentes do DOM
  const existingBoxes = Array.from(overlayElement.querySelectorAll('.selection-box'));
  existingBoxes.forEach((b) => {
    // Se for o que estamos arrastando agora, NÃO REMOVE
    // (Para permitir update suave enquanto o subscribe é chamado)
    if (b !== draggingBox) {
      b.remove();
    }
  });

  // 2. Pegar estado - TODOS os crops são renderizados para permitir transições
  const allCrops = CropperState.getAllCrops();
  const currentScale = viewerState.pdfScale;

  allCrops.forEach((crop) => {
    // Se for o crop que estamos criando/arrastando ID match?
    // Não temos match de ID ainda no draggingBox.
    // Simplesmente renderiza todos que estão no STORE. O draggingBox temporário é extra-store.

    const anchorData = crop.anchorData;
    const anchorPage = document.getElementById(`page-wrapper-${anchorData.anchorPageNum}`);
    if (!anchorPage) return; // Pagina não renderizada

    const newLeft = anchorPage.offsetLeft + anchorData.relativeLeft * currentScale;
    const newTop = anchorPage.offsetTop + anchorData.relativeTop * currentScale;
    const newWidth = anchorData.unscaledW * currentScale;
    const newHeight = anchorData.unscaledH * currentScale;

    if (newHeight < 1 || newWidth < 1) return;

    const box = createSelectionBoxDOM(crop.isActiveGroup);
    updateSelectionBox(box, newLeft, newTop, newWidth, newHeight);

    // Apply Dynamic Color
    // Apply Dynamic Color
    if (crop.color) {
      box.style.borderColor = crop.color;
      // Set CSS variable so handles (children) inherit the color
      box.style.setProperty('--color-primary', crop.color);

      const rgb = hexToRgb(crop.color);
      if (rgb) {
        box.style.setProperty('--color-primary-rgb', rgb);
      }

      // Background with opacity (unless draft/gray, then keep gray default or handle here)
      // Note: We use the rgb variable for background in CSS, but explicit set here ensures it works if class fails
      if (crop.status !== 'draft') {
        box.style.backgroundColor = `${crop.color}1A`; // ~10% opacity
      } else {
        // Drafts also get color now
        box.style.backgroundColor = `${crop.color}1A`;
      }
    }

    // Apply Line Style (Dashed vs Solid)
    if (crop.tipo === 'parte_questao') {
      box.style.borderStyle = 'dashed';
    } else {
      box.style.borderStyle = 'solid';
    }

    // Add status class
    if (crop.status === 'verified') {
      box.classList.add('status-verified');
    } else if (crop.status === 'draft') {
      // box.classList.add("status-draft"); // Optional, default is ok
    }

    // HIGHLIGHT LOGIC: Aplica classes de destaque quando hover na sidebar
    if (highlightedGroupId !== null) {
      if (crop.groupId === highlightedGroupId) {
        box.classList.add('is-highlighted');
        // Adiciona glow com a cor do crop
        if (crop.color) {
          box.style.boxShadow = `0 0 20px 5px ${crop.color}80, 0 0 40px 10px ${crop.color}40`;
        }
      } else {
        box.classList.add('is-dimmed');
      }
    }

    // Armazena ID para futuro (edição)
    box.dataset.cropId = crop.id;
    box.dataset.groupId = crop.groupId;

    overlayElement.appendChild(box);
  });

  updateDimmingMask();
}

/**
 * Destaca visualmente os crops de um grupo específico (usado no hover da sidebar)
 * @param {number|null} groupId - ID do grupo para destacar, ou null para remover destaque
 */
export function highlightGroup(groupId) {
  highlightedGroupId = groupId;

  // Atualiza a classe no overlay para controlar o dimming geral
  if (overlayElement) {
    if (groupId !== null) {
      overlayElement.classList.add('highlight-mode');
    } else {
      overlayElement.classList.remove('highlight-mode');
    }
  }

  // Atualiza apenas as classes nos elementos existentes (SEM recriar!)
  // Isso permite que as transições CSS funcionem
  updateHighlightClasses();
  updateDimmingMask();
}

/**
 * Atualiza apenas as classes de highlight nos crops existentes
 * NÃO recria os elementos DOM, para permitir transições CSS
 */
function updateHighlightClasses() {
  if (!overlayElement) return;

  const boxes = overlayElement.querySelectorAll('.selection-box');

  boxes.forEach((box) => {
    const groupId = parseFloat(box.dataset.groupId);

    // Remove classes anteriores
    box.classList.remove('is-highlighted', 'is-dimmed');
    box.style.boxShadow = '';

    // Aplica novas classes baseado no estado de highlight
    if (highlightedGroupId !== null) {
      if (groupId === highlightedGroupId) {
        box.classList.add('is-highlighted');
        // Pega a cor do CSS variable ou usa default
        const color = getComputedStyle(box).getPropertyValue('--color-primary').trim() || '#3b82f6';
        // box.style.boxShadow = `0 0 20px 5px ${color}80, 0 0 40px 10px ${color}40`;
      } else {
        box.classList.add('is-dimmed');
      }
    }
  });
}

/**
 * Updates the SVG path
 * OPTIMIZED: Uses cached box data during drag operations to avoid expensive DOM queries
 * HIGHLIGHT MODE: Em modo highlight, apenas os crops do grupo destacado criam "buracos" na máscara
 */
let cachedBoxPositions = null; // Cache for box positions during drag

function updateDimmingMask() {
  if (!dimmingPath || !overlayElement) return;

  const w = Math.max(overlayElement.offsetWidth, 100);
  const h = Math.max(overlayElement.offsetHeight, 100);

  // Outer rectangle
  let d = `M 0 0 h ${w} v ${h} h -${w} Z `;

  // HIGHLIGHT MODE: Apenas os crops destacados criam "spotlight"
  if (highlightedGroupId !== null) {
    // Só adiciona buracos para os crops do grupo em destaque
    const boxes = overlayElement.querySelectorAll('.selection-box.is-highlighted');
    boxes.forEach((box) => {
      if (box.style.display === 'none') return;
      const bx = parseFloat(box.style.left) || 0;
      const by = parseFloat(box.style.top) || 0;
      const bw = parseFloat(box.style.width) || 0;
      const bh = parseFloat(box.style.height) || 0;

      if (bw > 0 && bh > 0) {
        d += `M ${bx} ${by} h ${bw} v ${bh} h -${bw} Z `;
      }
    });
  }
  // OPTIMIZATION: During drag, use cached positions for other boxes
  else if (currentDragType !== DragType.NONE && draggingBox && cachedBoxPositions) {
    // Use cached positions for all boxes except the one being dragged
    cachedBoxPositions.forEach((pos) => {
      d += `M ${pos.x} ${pos.y} h ${pos.w} v ${pos.h} h -${pos.w} Z `;
    });

    // Add current draggingBox position (from DOM)
    const bx = parseFloat(draggingBox.style.left) || 0;
    const by = parseFloat(draggingBox.style.top) || 0;
    const bw = parseFloat(draggingBox.style.width) || 0;
    const bh = parseFloat(draggingBox.style.height) || 0;
    if (bw > 0 && bh > 0) {
      d += `M ${bx} ${by} h ${bw} v ${bh} h -${bw} Z `;
    }
  } else {
    // Not dragging and not highlighting - do full DOM query (only happens on init/refresh)
    const boxes = overlayElement.querySelectorAll('.selection-box');
    boxes.forEach((box) => {
      if (box.style.display === 'none') return;
      const bx = parseFloat(box.style.left) || 0;
      const by = parseFloat(box.style.top) || 0;
      const bw = parseFloat(box.style.width) || 0;
      const bh = parseFloat(box.style.height) || 0;

      if (bw > 0 && bh > 0) {
        d += `M ${bx} ${by} h ${bw} v ${bh} h -${bw} Z `;
      }
    });
  }

  dimmingPath.setAttribute('d', d);
}

// Helper to cache box positions when drag starts
function cacheBoxPositionsForDrag() {
  if (!overlayElement) return;
  cachedBoxPositions = [];
  const boxes = overlayElement.querySelectorAll('.selection-box');
  boxes.forEach((box) => {
    if (box === draggingBox || box.style.display === 'none') return;
    const bx = parseFloat(box.style.left) || 0;
    const by = parseFloat(box.style.top) || 0;
    const bw = parseFloat(box.style.width) || 0;
    const bh = parseFloat(box.style.height) || 0;
    if (bw > 0 && bh > 0) {
      cachedBoxPositions.push({ x: bx, y: by, w: bw, h: bh });
    }
  });
}

function clearBoxPositionCache() {
  cachedBoxPositions = null;
}

// Função legada/compatibilidade para pegar a imagem 'atual' (última do grupo ativo)
export async function extractImageFromSelection() {
  const activeGroup = CropperState.getActiveGroup();
  if (!activeGroup || activeGroup.crops.length === 0) {
    return null;
  }
  // Pega o último crop adicionado (suposição de fluxo linear de recorte único por vez no botão de confirmar)
  const lastCrop = activeGroup.crops[activeGroup.crops.length - 1];
  return await extractImageFromCropData(lastCrop.anchorData);
}

// Necessário para exportar porem usar lógica nova (extração baseada em crop data)
export async function extractImageFromCropData(anchorData) {
  const container = document.getElementById('canvasContainer');
  const currentScale = viewerState.pdfScale;

  // Reconstruir coordenadas atuais
  const anchorPage = document.getElementById(`page-wrapper-${anchorData.anchorPageNum}`);
  if (!anchorPage) return null; // Pagina nao visivel

  const x = anchorPage.offsetLeft + anchorData.relativeLeft * currentScale;
  const y = anchorPage.offsetTop + anchorData.relativeTop * currentScale;
  const width = anchorData.unscaledW * currentScale;
  const height = anchorData.unscaledH * currentScale;

  // Lógica de canvas drawImage
  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = width;
  finalCanvas.height = height;
  const ctx = finalCanvas.getContext('2d');
  const pages = Array.from(container.querySelectorAll('.pdf-page'));

  // Mesma lógica de interseção de extractImageFromSelection original
  for (const pageWrapper of pages) {
    const pLeft = pageWrapper.offsetLeft;
    const pTop = pageWrapper.offsetTop;
    const pWidth = pageWrapper.offsetWidth;
    const pHeight = pageWrapper.offsetHeight;

    const x_overlap = Math.max(0, Math.min(x + width, pLeft + pWidth) - Math.max(x, pLeft));
    const y_overlap = Math.max(0, Math.min(y + height, pTop + pHeight) - Math.max(y, pTop));

    if (x_overlap > 0 && y_overlap > 0) {
      const sourceX = Math.max(0, x - pLeft);
      const sourceY = Math.max(0, y - pTop);
      const destX = Math.max(0, pLeft - x);
      const destY = Math.max(0, pTop - y);
      const drawW = Math.min(width - destX, pWidth - sourceX);
      const drawH = Math.min(height - destY, pHeight - sourceY);

      try {
        const pageNum = parseInt(pageWrapper.dataset.pageNum);
        const pageCanvasOnScreen = document.getElementById(`page-canvas-${pageNum}`);
        if (pageCanvasOnScreen) {
          const pRatio = pageCanvasOnScreen.width / pageCanvasOnScreen.clientWidth;
          ctx.drawImage(
            pageCanvasOnScreen,
            sourceX * pRatio,
            sourceY * pRatio,
            drawW * pRatio,
            drawH * pRatio,
            destX,
            destY,
            drawW,
            drawH,
          );
        }
      } catch (err) {}
    }
  }

  return new Promise((resolve) => {
    finalCanvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const base64 = finalCanvas.toDataURL('image/png');
      resolve({ blobUrl: url, base64 });
    }, 'image/png');
  });
}

// Helper para converter Hex para RGB ("r, g, b") para uso em variáveis CSS
function hexToRgb(hex) {
  if (!hex) return null;
  // Remove # if present
  hex = hex.replace(/^#/, '');

  // Handle shorthand (e.g. #FFF)
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((char) => char + char)
      .join('');
  }

  // Parse
  const bigint = parseInt(hex, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;

  return `${r}, ${g}, ${b}`;
}
