<template>
  <ClientOnly>
    <Teleport to="body" v-if="isMounted">
      <Transition name="mermaid-modal-fade">
        <div
          v-if="isOpen"
          class="mermaid-zoom-overlay"
          @click.self="closeModal"
          tabindex="-1"
          ref="overlayRef"
        >
          <!-- Top Toolbar -->
          <div class="mermaid-zoom-toolbar">
            <div class="toolbar-left">
              <span class="toolbar-title">📊 Visualizador Vetorial HD</span>
              <span class="zoom-badge">{{ Math.round(currentScale * 100) }}%</span>
              <span class="vector-badge">⚡ 100% Vetorial (Sem Pixelar)</span>
            </div>

            <div class="toolbar-actions">
              <button
                class="tool-btn"
                @click="zoomIn"
                title="Aumentar Zoom (Scroll Up ou +)"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
              </button>
              <button
                class="tool-btn"
                @click="zoomOut"
                title="Diminuir Zoom (Scroll Down ou -)"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
              </button>
              <button
                class="tool-btn"
                @click="resetZoom"
                title="Resetar Posição e Zoom 100% (0 ou R)"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
              </button>
              <button
                class="tool-btn"
                @click="downloadSvg"
                title="Baixar Diagrama Vetorial (.svg)"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              </button>
              <div class="toolbar-divider"></div>
              <button
                class="tool-btn tool-btn--close"
                @click="closeModal"
                title="Fechar (ESC)"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
          </div>

          <!-- Canvas / Viewport Area -->
          <div
            class="mermaid-zoom-viewport"
            ref="viewportRef"
            @wheel.prevent="handleWheel"
            @mousedown="startPan"
            @touchstart="handleTouchStart"
            @touchmove="handleTouchMove"
            @touchend="handleTouchEnd"
            :class="{ 'is-panning': isPanning }"
          >
            <div
              class="mermaid-svg-host"
              ref="svgHostRef"
              v-html="rawSvgString"
            ></div>
          </div>

          <!-- Bottom Helper Hint -->
          <div class="mermaid-zoom-hint">
            <span>💡 Zoom no cursor • Arraste para mover • Zoom até <strong>3000%</strong> • <code>ESC</code> para fechar</span>
          </div>
        </div>
      </Transition>
    </Teleport>
  </ClientOnly>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue';

const isMounted = ref(false);
const isOpen = ref(false);
const rawSvgString = ref('');
const currentScale = ref(1.0);
const isPanning = ref(false);
const overlayRef = ref(null);
const viewportRef = ref(null);
const svgHostRef = ref(null);

// Coordenadas do ViewBox: [minX, minY, width, height]
let origVb = [0, 0, 1000, 600];
let curVb = [0, 0, 1000, 600];
let startPointerX = 0;
let startPointerY = 0;
let lastTouchDist = 0;

/**
 * Atualiza o atributo viewBox no elemento SVG ativo
 */
function updateSvgViewBox() {
  if (!svgHostRef.value) return;
  const svg = svgHostRef.value.querySelector('svg');
  if (!svg) return;
  svg.setAttribute('viewBox', `${curVb[0]} ${curVb[1]} ${curVb[2]} ${curVb[3]}`);
}

/**
 * Executa zoom centrado em um ponto específico da tela (ex: sob o cursor do mouse)
 */
function zoomAtPoint(factor, clientX, clientY) {
  if (!viewportRef.value) return;
  const rect = viewportRef.value.getBoundingClientRect();

  // Posição normalizada do ponteiro (0.0 a 1.0) dentro do viewport
  const rx = typeof clientX === 'number' ? (clientX - rect.left) / rect.width : 0.5;
  const ry = typeof clientY === 'number' ? (clientY - rect.top) / rect.height : 0.5;

  // Limites: 10% (0.1x) até 3000% (30.0x)
  const newScale = Math.min(Math.max(currentScale.value * factor, 0.1), 30.0);
  const effectiveFactor = newScale / currentScale.value;
  if (effectiveFactor === 1) return;

  currentScale.value = newScale;

  // Ponto exato sob o cursor em coordenadas do viewBox
  const pointX = curVb[0] + rx * curVb[2];
  const pointY = curVb[1] + ry * curVb[3];

  // Novas dimensões do viewBox
  const newW = origVb[2] / newScale;
  const newH = origVb[3] / newScale;

  // Nova origem (minX, minY) para manter o ponto sob o cursor fixo
  const newX = pointX - rx * newW;
  const newY = pointY - ry * newH;

  curVb = [newX, newY, newW, newH];
  updateSvgViewBox();
}

/**
 * Move a visualização (pan) convertendo pixels de tela em unidades viewBox do SVG
 */
function panBy(deltaScreenX, deltaScreenY) {
  if (!viewportRef.value) return;
  const rect = viewportRef.value.getBoundingClientRect();

  const svgDx = (deltaScreenX / rect.width) * curVb[2];
  const svgDy = (deltaScreenY / rect.height) * curVb[3];

  curVb[0] -= svgDx;
  curVb[1] -= svgDy;
  updateSvgViewBox();
}

function openModal(svgEl) {
  if (!svgEl) return;

  const clone = svgEl.cloneNode(true);

  // Lê o viewBox original do diagrama
  const viewBoxAttr = clone.getAttribute('viewBox');
  if (viewBoxAttr) {
    const parts = viewBoxAttr.trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
      origVb = parts;
    } else {
      const bbox = svgEl.getBoundingClientRect();
      origVb = [0, 0, bbox.width || 800, bbox.height || 600];
    }
  } else {
    const bbox = svgEl.getBoundingClientRect();
    origVb = [0, 0, bbox.width || 800, bbox.height || 600];
  }

  // Prepara o SVG para renderização vetorial livre de restrições
  clone.removeAttribute('width');
  clone.removeAttribute('height');
  clone.style.width = '100%';
  clone.style.height = '100%';
  clone.style.maxWidth = 'none';
  clone.style.maxHeight = 'none';
  clone.style.display = 'block';

  curVb = [...origVb];
  currentScale.value = 1.0;
  rawSvgString.value = clone.outerHTML;
  isOpen.value = true;

  if (typeof document !== 'undefined') {
    document.body.style.overflow = 'hidden';
  }

  nextTick(() => {
    updateSvgViewBox();
    overlayRef.value?.focus();
  });
}

function closeModal() {
  isOpen.value = false;
  if (typeof document !== 'undefined') {
    document.body.style.overflow = '';
  }
}

function zoomIn() {
  zoomAtPoint(1.35);
}

function zoomOut() {
  zoomAtPoint(1 / 1.35);
}

function resetZoom() {
  currentScale.value = 1.0;
  curVb = [...origVb];
  updateSvgViewBox();
}

function handleWheel(e) {
  // Zoom suave e contínuo sob o ponteiro do mouse
  const factor = e.deltaY < 0 ? 1.18 : 0.85;
  zoomAtPoint(factor, e.clientX, e.clientY);
}

function startPan(e) {
  if (e.button !== 0) return; // Apenas botão principal
  isPanning.value = true;
  startPointerX = e.clientX;
  startPointerY = e.clientY;

  window.addEventListener('mousemove', onPanMove);
  window.addEventListener('mouseup', endPan);
}

function onPanMove(e) {
  if (!isPanning.value) return;
  const dx = e.clientX - startPointerX;
  const dy = e.clientY - startPointerY;
  startPointerX = e.clientX;
  startPointerY = e.clientY;
  panBy(dx, dy);
}

function endPan() {
  isPanning.value = false;
  window.removeEventListener('mousemove', onPanMove);
  window.removeEventListener('mouseup', endPan);
}

function handleTouchStart(e) {
  if (e.touches.length === 1) {
    isPanning.value = true;
    startPointerX = e.touches[0].clientX;
    startPointerY = e.touches[0].clientY;
  } else if (e.touches.length === 2) {
    lastTouchDist = getTouchDist(e);
  }
}

function handleTouchMove(e) {
  if (e.touches.length === 1 && isPanning.value) {
    const dx = e.touches[0].clientX - startPointerX;
    const dy = e.touches[0].clientY - startPointerY;
    startPointerX = e.touches[0].clientX;
    startPointerY = e.touches[0].clientY;
    panBy(dx, dy);
  } else if (e.touches.length === 2) {
    const dist = getTouchDist(e);
    if (lastTouchDist > 0) {
      const factor = dist / lastTouchDist;
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      zoomAtPoint(factor, midX, midY);
    }
    lastTouchDist = dist;
  }
}

function handleTouchEnd(e) {
  if (e.touches.length < 2) {
    lastTouchDist = 0;
  }
  if (e.touches.length === 0) {
    isPanning.value = false;
  }
}

function getTouchDist(e) {
  const dx = e.touches[0].clientX - e.touches[1].clientX;
  const dy = e.touches[0].clientY - e.touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function downloadSvg() {
  if (!svgHostRef.value) return;
  const svg = svgHostRef.value.querySelector('svg');
  if (!svg) return;
  const svgStr = svg.outerHTML;
  const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `diagrama_hd_${Date.now()}.svg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function handleKeydown(e) {
  if (!isOpen.value) return;
  if (e.key === 'Escape') closeModal();
  if (e.key === '+' || e.key === '=') zoomIn();
  if (e.key === '-' || e.key === '_') zoomOut();
  if (e.key === '0' || e.key === 'r' || e.key === 'R') resetZoom();
}

/**
 * Captura cliques em diagramas Mermaid via Event Delegation
 */
function handleDocClick(e) {
  if (e.target.closest('.mermaid-zoom-overlay')) return;
  if (e.target.closest('a')) return;

  const mermaidContainer = e.target.closest('.vp-doc .mermaid, .mermaid, [class*="mermaid"]');
  if (!mermaidContainer) return;

  const svg = mermaidContainer.querySelector('svg');
  if (svg) {
    openModal(svg);
  }
}

onMounted(() => {
  isMounted.value = true;
  window.addEventListener('click', handleDocClick);
  window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener('click', handleDocClick);
  window.removeEventListener('keydown', handleKeydown);
  if (typeof document !== 'undefined') {
    document.body.style.overflow = '';
  }
});
</script>

<style scoped>
/* Transição */
.mermaid-modal-fade-enter-active,
.mermaid-modal-fade-leave-active {
  transition: opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.mermaid-modal-fade-enter-from,
.mermaid-modal-fade-leave-to {
  opacity: 0;
}

/* Fundo Escuro com Frosted Glass */
.mermaid-zoom-overlay {
  position: fixed;
  inset: 0;
  z-index: 999999;
  background: rgba(10, 14, 23, 0.92);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  display: flex;
  flex-direction: column;
  outline: none;
  user-select: none;
}

/* Toolbar Superior */
.mermaid-zoom-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  background: rgba(22, 27, 34, 0.85);
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  z-index: 10;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.toolbar-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: #f0f6fc;
  letter-spacing: -0.2px;
}

.zoom-badge {
  font-size: 0.75rem;
  font-weight: 700;
  background: rgba(33, 128, 141, 0.3);
  color: #32b8c6;
  border: 1px solid rgba(33, 128, 141, 0.5);
  padding: 2px 8px;
  border-radius: 12px;
  min-width: 48px;
  text-align: center;
}

.vector-badge {
  font-size: 0.7rem;
  font-weight: 500;
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.3);
  padding: 2px 8px;
  border-radius: 12px;
}

@media (max-width: 640px) {
  .vector-badge {
    display: none;
  }
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tool-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #c9d1d9;
  cursor: pointer;
  transition: all 0.15s ease;
}

.tool-btn:hover {
  background: rgba(255, 255, 255, 0.16);
  color: #ffffff;
  transform: translateY(-1px);
}

.tool-btn:active {
  transform: scale(0.95);
}

.tool-btn--close:hover {
  background: rgba(239, 68, 68, 0.25);
  border-color: rgba(239, 68, 68, 0.5);
  color: #f87171;
}

.toolbar-divider {
  width: 1px;
  height: 20px;
  background: rgba(255, 255, 255, 0.15);
  margin: 0 4px;
}

/* Área do Canvas de Zoom e Pan */
.mermaid-zoom-viewport {
  flex: 1;
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  padding: 20px;
  box-sizing: border-box;
}

.mermaid-zoom-viewport.is-panning {
  cursor: grabbing;
}

/* Host do SVG ocupando todo o espaço com renderização vetorial pura */
.mermaid-svg-host {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

:deep(.mermaid-svg-host svg) {
  width: 100% !important;
  height: 100% !important;
  max-width: 100% !important;
  max-height: 100% !important;
  display: block !important;
  shape-rendering: geometricPrecision !important;
  text-rendering: geometricPrecision !important;
  filter: drop-shadow(0 12px 36px rgba(0, 0, 0, 0.6));
}

/* Dica Inferior */
.mermaid-zoom-hint {
  position: absolute;
  bottom: 18px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(22, 27, 34, 0.88);
  border: 1px solid rgba(255, 255, 255, 0.14);
  padding: 6px 18px;
  border-radius: 20px;
  font-size: 0.78rem;
  color: #8b949e;
  pointer-events: none;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
  white-space: nowrap;
}

.mermaid-zoom-hint code {
  background: rgba(255, 255, 255, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  color: #f0f6fc;
}

.mermaid-zoom-hint strong {
  color: #32b8c6;
}
</style>
