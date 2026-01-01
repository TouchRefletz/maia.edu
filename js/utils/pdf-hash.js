/**
 * PDF Visual Hash Utility
 * Calculates a unique "Visual ID" for a PDF based on the visual content of its pages.
 *
 * Algorithm:
 * 1. Render each page to an image (width=128px)
 * 2. Resize to 17x16 pixels for dHash
 * 3. Convert to Grayscale
 * 4. Compute dHash (Difference Hash) string
 * 5. Concatenate all page hashes
 * 6. Compute SHA-256 signature of the concatenation
 */

const TARGET_WIDTH = 128;
const GRID_SIZE = 16; // dHash grid size (16x16)

export async function computePdfHash(file, onStatusUpdate) {
  if (!file) return null;

  try {
    const buffer = await file.arrayBuffer();
    // Use global pdfjsLib (assumed loaded via CDN in index.html)
    const pdf = await pdfjsLib.getDocument(buffer).promise;

    if (onStatusUpdate)
      onStatusUpdate(`Processando ${pdf.numPages} páginas...`);

    let combinedVisualData = "";

    // Process each page
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      if (onStatusUpdate)
        onStatusUpdate(`Processando página ${i}/${pdf.numPages}...`);

      // 1. Calculate Scale for Target Width (128px)
      // const viewport = page.getViewport({ scale: 1.0 });
      // const scale = TARGET_WIDTH / viewport.width;
      const scale = 0.1; // Performance optimization (Matches backend)
      const scaledViewport = page.getViewport({ scale });

      // 2. Render to Temporary Canvas
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });

      canvas.width = scaledViewport.width;
      canvas.height = scaledViewport.height;

      // Ensure consistent white background (avoids transparency diffs)
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({ canvasContext: ctx, viewport: scaledViewport })
        .promise;

      // 3. Compute dHash
      const hash = computeDHash(ctx, canvas.width, canvas.height);
      combinedVisualData += hash;
    }

    if (onStatusUpdate) onStatusUpdate("Gerando assinatura digital...");

    // 4. Final SHA-256
    const fingerprint = await sha256(combinedVisualData);

    return fingerprint;
  } catch (err) {
    console.error("Hash calculation error:", err);
    throw new Error("Falha ao calcular identidade visual: " + err.message);
  }
}

// dHash Implementation (Difference Hash)
// Matches logic from `code que compara hash/index js.html`
function computeDHash(ctx, width, height) {
  // Resize to grid size (17x16 to compare adjacent pixels horizontally)
  // We need width+1 to compare w[i] < w[i+1]
  const w = GRID_SIZE + 1;
  const h = GRID_SIZE;

  // Create temporary canvas for resizing
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = w;
  tempCanvas.height = h;
  const tempCtx = tempCanvas.getContext("2d");

  // Draw and resize (Bilinear/Bicubic done by browser)
  tempCtx.drawImage(ctx.canvas, 0, 0, width, height, 0, 0, w, h);

  // Get Pixels
  const imageData = tempCtx.getImageData(0, 0, w, h);
  const data = imageData.data;
  let hash = "";

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w - 1; x++) {
      // Iterate up to w-1
      // Get grayscale value of pixel (x, y)
      const index = (y * w + x) * 4;
      const brightness =
        data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;

      // Get grayscale value of pixel (x+1, y)
      const indexNext = (y * w + (x + 1)) * 4;
      const brightnessNext =
        data[indexNext] * 0.299 +
        data[indexNext + 1] * 0.587 +
        data[indexNext + 2] * 0.114;

      // 1 if left is brighter than right, 0 otherwise
      hash += brightness > brightnessNext ? "1" : "0";
    }
  }
  return hash;
}

async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hashHex;
}
