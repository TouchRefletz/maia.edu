# Estado e Contexto do Visualizador (`js/viewer/context.js`)

## Arquivo-Fonte

| Propriedade | Valor |
|---|---|
| **Arquivo** | `js/viewer/context.js` |
| **Escopo** | Gerenciador de estado reativo e singleton do PDF Viewer (`PDFViewerContext`) |
| **Exports** | `PDFViewerContext`, `usePDFContext()` |

---

## 🎯 Visão Geral e Arquitetura

O `js/viewer/context.js` mantém a **fonte única da verdade (Single Source of Truth)** do leitor de PDF. Ele gerencia as variáveis de sessão em memória, garantindo que alterações feitas na toolbar (como dar zoom, trocar de página ou alterar o modo de corte) sejam refletidas instantaneamente na viewport Canvas e nas sidebars laterais.

---

## 🛠️ Implementação do Código

```javascript
import { viewerEvents } from './events.js';

class PDFViewerState {
  constructor() {
    this.pdfDocument = null;
    this.currentPage = 1;
    this.totalPages = 0;
    this.scale = 1.0;
    this.rotation = 0;
    this.mode = 'view'; // 'view' | 'crop' | 'select'
    this.crops = [];
  }

  /**
   * Associa um novo documento PDF.js e reseta os ponteiros de página.
   * @param {PDFDocumentProxy} pdfProxy - Objeto do PDF.js.
   */
  setDocument(pdfProxy) {
    this.pdfDocument = pdfProxy;
    this.totalPages = pdfProxy ? pdfProxy.numPages : 0;
    this.currentPage = 1;
    this.crops = [];
    viewerEvents.emit('pdf:loaded', { totalPages: this.totalPages });
  }

  /**
   * Altera a página atual com validação de limites.
   * @param {number} pageNum - Número da página de destino.
   */
  setCurrentPage(pageNum) {
    if (pageNum < 1 || pageNum > this.totalPages || pageNum === this.currentPage) {
      return;
    }
    this.currentPage = pageNum;
    viewerEvents.emit('pdf:pagechange', { page: this.currentPage, total: this.totalPages });
  }

  /**
   * Atualiza a escala de zoom.
   * @param {number} newScale - Novo fator de zoom (ex: 1.5).
   */
  setScale(newScale) {
    const clampedScale = Math.min(Math.max(newScale, 0.5), 4.0);
    if (clampedScale === this.scale) return;
    this.scale = clampedScale;
    viewerEvents.emit('pdf:zoomchange', { scale: this.scale });
  }

  /**
   * Alterna entre o modo de visualização padrão e o modo Cropper.
   * @param {string} newMode - 'view' ou 'crop'.
   */
  setMode(newMode) {
    this.mode = newMode;
    viewerEvents.emit('pdf:modechange', { mode: this.mode });
  }
}

export const PDFViewerContext = new PDFViewerState();
```

---

## 🔗 Referências Cruzadas
- [Core do PDF Viewer](/pdf/core)
- [Sistema de Eventos](/pdf/eventos)
- [Zoom e Resizer](/pdf/zoom)
