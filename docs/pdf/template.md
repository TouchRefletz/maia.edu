# Template e Estrutura DOM do Viewer (`js/viewer/template.js`)

## Arquivo-Fonte

| Propriedade | Valor |
|---|---|
| **Arquivo** | `js/viewer/template.js` |
| **Escopo** | Injeção e criação da árvore DOM do PDF Viewer, toolbar e viewport |
| **Exports** | `createViewerHTML()`, `injectViewerTemplate()` |

---

## 🏗️ Estrutura DOM Injetada

```javascript
export function createViewerHTML() {
  return `
    <div class="pdf-viewer-root">
      <header class="pdf-toolbar">
        <div class="toolbar-left">
          <button id="btn-sidebar-toggle" class="btn-icon" aria-label="Abrir Sidebar">☰</button>
          <span class="document-title" id="pdf-doc-title">Documento.pdf</span>
        </div>
        <div class="toolbar-center">
          <button id="btn-prev-page" class="btn-icon">▲</button>
          <input type="number" id="input-page-num" value="1" min="1" />
          <span id="label-total-pages">/ 0</span>
          <button id="btn-next-page" class="btn-icon">▼</button>
        </div>
        <div class="toolbar-right">
          <button id="btn-zoom-out" class="btn-icon">-</button>
          <span id="zoom-value-label">100%</span>
          <button id="btn-zoom-in" class="btn-icon">+</button>
          <button id="btn-mode-crop" class="btn-primary">✂️ Cortar Questão</button>
        </div>
      </header>
      <div class="pdf-body-wrapper">
        <aside id="pdf-sidebar" class="pdf-sidebar"></aside>
        <main id="pdf-viewport" class="pdf-viewport">
          <div id="pdf-canvas-container" class="canvas-container"></div>
        </main>
      </div>
    </div>
  `;
}
```

---

## 🔗 Referências Cruzadas
- [Core do PDF Viewer](/pdf/core)
- [PDF Viewer Styles CSS](/css/pdf-viewer)
