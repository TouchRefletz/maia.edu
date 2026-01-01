/**
 * Shared PDF Hashing Logic
 * Used by both Frontend (Vite) and Backend (Node.js)
 */

export const CONFIG = {
  GRID_SIZE: 16,
  TARGET_WIDTH: 128, // Common width for initial rendering to reduce aliasing
};

/**
 * Computes dHash (Difference Hash) for a given canvas/image source
 * @param {Canvas|HTMLElement} sourceCanvas - The source canvas or image
 * @param {number} width - Source width
 * @param {number} height - Source height
 * @param {Function} createCanvasFn - Function(w, h) -> { canvas, context } OR canvas (if context available via getContext)
 * @returns {string} The binary hash string
 */
export function computeDHash(sourceCanvas, width, height, createCanvasFn) {
  const w = CONFIG.GRID_SIZE + 1;
  const h = CONFIG.GRID_SIZE;

  // Create temporary canvas for resizing
  const tempObj = createCanvasFn(w, h);
  // Handle both {canvas, ctx} return or just canvas return
  const tempCanvas = tempObj.canvas || tempObj;
  const tempCtx = tempObj.context || tempCanvas.getContext("2d");

  // Enforce consistent smoothing settings
  tempCtx.imageSmoothingEnabled = true;
  if (tempCtx.imageSmoothingQuality) {
    tempCtx.imageSmoothingQuality = "high";
  }

  // Draw and resize
  try {
    tempCtx.drawImage(
      sourceCanvas.canvas || sourceCanvas, // Handle if source is context or canvas
      0,
      0,
      width,
      height,
      0,
      0,
      w,
      h
    );
  } catch (e) {
    console.error("Error in computeDHash drawImage:", e);
    throw e;
  }

  // Get Pixels
  const imageData = tempCtx.getImageData(0, 0, w, h);
  const data = imageData.data;
  let hash = "";

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w - 1; x++) {
      const index = (y * w + x) * 4;
      const brightness =
        data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;

      const indexNext = (y * w + (x + 1)) * 4;
      const brightnessNext =
        data[indexNext] * 0.299 +
        data[indexNext + 1] * 0.587 +
        data[indexNext + 2] * 0.114;

      hash += brightness > brightnessNext ? "1" : "0";
    }
  }
  return hash;
}

/**
 * Orchestrates the full PDF hashing process
 * @param {Object} pdfDoc - The loaded PDF document (pdfjs-dist)
 * @param {Function} createCanvasFn - Function(w, h) -> canvas (or {canvas, context})
 * @param {Function} sha256Fn - Async Function(string) -> string (hex)
 * @param {Function} onStatusUpdate - Optional callback for status
 * @returns {Promise<string>} The visual hash
 */
export async function computePdfDocHash(
  pdfDoc,
  createCanvasFn,
  sha256Fn,
  onStatusUpdate
) {
  let combinedVisualData = "";

  for (let i = 1; i <= pdfDoc.numPages; i++) {
    if (onStatusUpdate)
      onStatusUpdate(`Processando página ${i}/${pdfDoc.numPages}...`);

    const page = await pdfDoc.getPage(i);

    // Check if we have a custom release/cleanup method (backend needs this sometimes)
    // but usually page.cleanup() is enough.

    try {
      // Determine scale to match TARGET_WIDTH exactly
      // This ensures both Node and Browser render the same number of pixels initially
      const unscaledViewport = page.getViewport({ scale: 1.0 });
      const scale = CONFIG.TARGET_WIDTH / unscaledViewport.width;
      const scaledViewport = page.getViewport({ scale });

      const renderObj = createCanvasFn(
        scaledViewport.width,
        scaledViewport.height
      );
      const renderCanvas = renderObj.canvas || renderObj;
      const renderCtx = renderObj.context || renderCanvas.getContext("2d");

      // Ensure white background
      renderCtx.fillStyle = "#FFFFFF";
      renderCtx.fillRect(0, 0, renderCanvas.width, renderCanvas.height);

      // Render parameters
      // Note: Backend might need 'canvasFactory' passed to render(), but that's pdfjs-dist specific.
      // We assume the caller handles the render call if it's complex, OR we do it standard here.
      // Standard:
      await page.render({
        canvasContext: renderCtx,
        viewport: scaledViewport,
        // canvasFactory: ... we don't pass it here, assumed global or not needed if we provide context
      }).promise;

      const hash = computeDHash(
        renderCanvas,
        renderCanvas.width,
        renderCanvas.height,
        createCanvasFn
      );
      combinedVisualData += hash;
    } finally {
      if (page.cleanup) page.cleanup();
    }
  }

  if (onStatusUpdate) onStatusUpdate("Gerando assinatura digital...");
  return await sha256Fn(combinedVisualData);
}
