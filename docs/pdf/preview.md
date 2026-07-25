# Geração de Preview e Miniaturas (`js/viewer/preview.js`)

## Arquivo-Fonte

| Propriedade | Valor |
|---|---|
| **Arquivo** | [`js/viewer/preview.js`](file:///c:/Users/jcamp/Downloads/maia.api/js/viewer/preview.js) |
| **Escopo** | Renderização assíncrona de thumbnails na sidebar lateral com lazy loading e cache |
| **Exports** | `ThumbnailRenderer`, `renderPageThumbnail()`, `clearThumbnailCache()` |

---

## 🎯 Visão Geral e Arquitetura

O `js/viewer/preview.js` cuida da geração e gerenciamento das miniaturas de todas as páginas do PDF na sidebar de navegação.

Em documentos extensos (ex: apostilas do ENEM com 90+ páginas), renderizar todas as miniaturas de uma vez esgotaria o contexto de memória da GPU do navegador. Para solucionar isso, o `ThumbnailRenderer` utiliza o recurso de **Intersection Observer** para acionar a renderização apenas quando a div da miniatura entra no campo visível da rolagens da sidebar.

---

## 🛠️ Implementação do Código

```javascript
const thumbnailCache = new Map();

/**
 * Renderiza uma miniatura da página em escala reduzida.
 * @param {PDFDocumentProxy} pdfDocument - Instância do PDF.
 * @param {number} pageNum - Número da página.
 * @param {HTMLCanvasElement} canvas - Elemento Canvas de destino.
 */
export async function renderPageThumbnail(pdfDocument, pageNum, canvas) {
  if (thumbnailCache.has(pageNum)) {
    const cachedData = thumbnailCache.get(pageNum);
    const ctx = canvas.getContext('2d');
    canvas.width = cachedData.width;
    canvas.height = cachedData.height;
    ctx.putImageData(cachedData.imageData, 0, 0);
    return;
  }

  const page = await pdfDocument.getPage(pageNum);
  const viewport = page.getViewport({ scale: 0.18 }); // 18% da escala original

  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext('2d');

  const renderContext = {
    canvasContext: ctx,
    viewport: viewport
  };

  await page.render(renderContext).promise;

  // Armazena no cache local
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  thumbnailCache.set(pageNum, { imageData, width: canvas.width, height: canvas.height });
}

/**
 * Limpa o cache de miniaturas ao fechar o PDF.
 */
export function clearThumbnailCache() {
  thumbnailCache.clear();
}
```

---

## 🔗 Referências Cruzadas
- [Sidebar Desktop](/pdf/sidebar-desktop)
- [Contexto do Viewer](/pdf/contexto)
