# Gestão de Zoom e Escala (`js/viewer/resizer.js`)

## Arquivo-Fonte

| Propriedade | Valor |
|---|---|
| **Arquivo** | `js/viewer/resizer.js` |
| **Escopo** | Resizer de escala de páginas, cálculo de Device Pixel Ratio (Hi-DPI) e pinch-to-zoom |
| **Exports** | `calculateFitScale()`, `getHiDPIViewport()`, `applyScaleLimits()` |

---

## 🎯 Visão Geral e Arquitetura

O `js/viewer/resizer.js` calcula as escalas de zoom do documento PDF para garantir renderização vetorial nítida sem estouro de memória GPU. Ele considera a densidade de pixels do dispositivo (`window.devicePixelRatio`) e calcula o encaixe de página ideal.

---

## 🛠️ Implementação do Código

```javascript
/**
 * Calcula a escala ideal para ajustar a página à largura da tela (page-width).
 * @param {PDFPageProxy} page - Objeto da página PDF.js.
 * @param {number} containerWidth - Largura em pixels da viewport do browser.
 * @returns {number} Fator de escala.
 */
export function calculateFitScale(page, containerWidth) {
  const unscaledViewport = page.getViewport({ scale: 1.0 });
  const padding = 32; // 16px em cada lado
  const availableWidth = containerWidth - padding;
  return availableWidth / unscaledViewport.width;
}

/**
 * Constrói o viewport otimizado com multiplicador DPR para telas Retina / Hi-DPI.
 * @param {PDFPageProxy} page - Objeto da página.
 * @param {number} scale - Escala desejada pelo usuário.
 * @returns {Object} Contexto de viewport com dimensões físicas de canvas.
 */
export function getHiDPIViewport(page, scale) {
  const dpr = window.devicePixelRatio || 1;
  const viewport = page.getViewport({ scale: scale * dpr });

  return {
    viewport,
    dpr,
    cssWidth: `${Math.floor(viewport.width / dpr)}px`,
    cssHeight: `${Math.floor(viewport.height / dpr)}px`
  };
}
```

---

## 🔗 Referências Cruzadas
- [Contexto do Viewer](/pdf/contexto)
- [Core do PDF Viewer](/pdf/core)
