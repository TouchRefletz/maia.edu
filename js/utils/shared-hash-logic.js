/**
 * Shared PDF Hashing Logic
 * Used by both Frontend (Vite) and Backend (Node.js)
 */

export const CONFIG = {
  GRID_SIZE: 16,
  TARGET_WIDTH: 512, // Higher res for better stability when downscaling
};

/**
 * Computes dHash (Difference Hash) for a given canvas/image source
 * @param {Canvas|HTMLElement} sourceCanvas - The source canvas or image
 * @param {number} width - Source width
 * @param {number} height - Source height
 * @param {Function} createCanvasFn - Function(w, h) -> { canvas, context } OR canvas (if context available via getContext)
 * @returns {string} The binary hash string
 */
/**
 * Deterministic Box Downscaling
 * @param {Uint8ClampedArray} srcData
 * @param {number} srcW
 * @param {number} srcH
 * @param {number} dstW
 * @param {number} dstH
 * @returns {Uint8ClampedArray}
 */
function boxDownscale(srcData, srcW, srcH, dstW, dstH) {
  const dstData = new Uint8ClampedArray(dstW * dstH * 4);

  // Precompute row offsets to avoid float drift/overlaps
  const getY = (y) => Math.floor((y * srcH) / dstH);
  const getX = (x) => Math.floor((x * srcW) / dstW);

  for (let y = 0; y < dstH; y++) {
    const srcYStart = getY(y);
    const srcYEnd = getY(y + 1);

    for (let x = 0; x < dstW; x++) {
      const srcXStart = getX(x);
      const srcXEnd = getX(x + 1);

      let r = 0,
        g = 0,
        b = 0,
        count = 0;

      for (let sy = srcYStart; sy < srcYEnd; sy++) {
        for (let sx = srcXStart; sx < srcXEnd; sx++) {
          const srcIdx = (sy * srcW + sx) * 4;
          r += srcData[srcIdx];
          g += srcData[srcIdx + 1];
          b += srcData[srcIdx + 2];
          count++;
        }
      }

      const dstIdx = (y * dstW + x) * 4;
      if (count > 0) {
        dstData[dstIdx] = Math.floor(r / count);
        dstData[dstIdx + 1] = Math.floor(g / count);
        dstData[dstIdx + 2] = Math.floor(b / count);
        dstData[dstIdx + 3] = 255;
      }
    }
  }
  return dstData;
}

export function computeDHash(
  sourceCanvas,
  width,
  height,
  createCanvasFn,
  debug = false
) {
  const w = CONFIG.GRID_SIZE; // Still using config (try 8 or 16)
  const h = CONFIG.GRID_SIZE;

  // Get Source Pixels
  const ctx = sourceCanvas.context || sourceCanvas.getContext("2d");
  const srcImageData = ctx.getImageData(0, 0, width, height);

  // Manual Deterministic Downscale
  const data = boxDownscale(srcImageData.data, width, height, w, h);

  // Aggressive Quantization (Posterization)
  // Divide 0-255 into 4 buckets: 0, 1, 2, 3
  // Bucket size = 64
  // This ignores subtle rendering differences (gamma, antialiasing)
  // and captures only the macro layout (Text vs White Space).

  let hash = "";
  let debugGrid = [];

  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    // Grayscale
    const val = Math.floor(
      data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114
    );

    // 4 levels: 0-63, 64-127, 128-191, 192-255
    // Math.min(3, ...) ensures 255 doesn't overflow if we did floor(256/64)=4
    const bucket = Math.min(3, Math.floor(val / 64));

    if (debug) {
      debugGrid.push(val); // Push raw grayscale value (0-255)
    }

    hash += bucket.toString();
  }

  if (debug) {
    console.log(`[Hash Debug] Grid (${w}x${h}):`, debugGrid.join(","));
    console.log(`[Hash Debug] Quantized:`, hash);
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
  onStatusUpdate,
  debug = false
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

      // Explicitly floor dimensions to ensure integer canvas size matches on all platforms
      const renderWidth = Math.floor(scaledViewport.width);
      const renderHeight = Math.floor(scaledViewport.height);

      const renderObj = createCanvasFn(renderWidth, renderHeight);
      const renderCanvas = renderObj.canvas || renderObj;
      const renderCtx = renderObj.context || renderCanvas.getContext("2d");

      // Ensure white background
      renderCtx.fillStyle = "#FFFFFF";
      renderCtx.fillRect(0, 0, renderWidth, renderHeight);

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
        renderWidth,
        renderHeight,
        createCanvasFn,
        debug
      );
      combinedVisualData += hash;
    } finally {
      if (page.cleanup) page.cleanup();
    }
  }

  if (onStatusUpdate) onStatusUpdate("Gerando assinatura digital...");
  return await sha256Fn(combinedVisualData);
}
