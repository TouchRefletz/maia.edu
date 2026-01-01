/**
 * Node.js Script to Compute Visual Hash for PDFs
 * Matches the logic in js/utils/pdf-hash.js exactly.
 *
 * Usage: node scripts/compute-hash.js [directory_path]
 * It will scan the directory for 'files/' subdirectory (standard structure)
 * and update 'manifest.json' with 'visual_hash' for each PDF.
 */

import crypto from "crypto";
import fs from "fs";
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// CJS Dependencies (using require for safety)
const { createCanvas } = require("@napi-rs/canvas");
const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");

// Constants matching Frontend
const TARGET_WIDTH = 128;
const GRID_SIZE = 16;

// Helper: dHash
function computeDHash(sourceCanvas, width, height) {
  const w = GRID_SIZE + 1;
  const h = GRID_SIZE;

  const tempCanvas = createCanvas(w, h);
  const tempCtx = tempCanvas.getContext("2d");

  // Draw and resize
  // node-canvas supports different patterns, default is usually good.
  try {
    tempCtx.drawImage(sourceCanvas, 0, 0, width, height, 0, 0, w, h);
  } catch (e) {
    console.error("Error in computeDHash drawImage:");
    console.error(
      "sourceCanvas type:",
      sourceCanvas ? sourceCanvas.constructor.name : "null/undefined"
    );
    // console.error("sourceCanvas:", sourceCanvas); // May be too verbose for binary
    throw e;
  }

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

// Helper: SHA256
function sha256(message) {
  return crypto.createHash("sha256").update(message).digest("hex");
}

// Main Hash Function
export async function computeFileHash(filePath) {
  try {
    const data = new Uint8Array(fs.readFileSync(filePath));
    const pdf = await pdfjsLib.getDocument({
      data: data,
      standardFontDataUrl: path.join(
        __dirname,
        "../node_modules/pdfjs-dist/standard_fonts/"
      ),
    }).promise;

    let combinedVisualData = "";

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);

      // const viewport = page.getViewport({ scale: 1.0 });
      // const scale = TARGET_WIDTH / viewport.width;
      const scale = 0.1; // Performance optimization
      const scaledViewport = page.getViewport({ scale });

      const canvas = createCanvas(scaledViewport.width, scaledViewport.height);
      const ctx = canvas.getContext("2d");

      // Ensure consistent white background (avoids transparency diffs)
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({ canvasContext: ctx, viewport: scaledViewport })
        .promise;

      const hash = computeDHash(canvas, canvas.width, canvas.height);
      combinedVisualData += hash;
    }

    return sha256(combinedVisualData);
  } catch (e) {
    console.error(`Failed to process ${filePath}:`, e.message);
    return null;
  }
}

// Main Execution Logic
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  (async () => {
    const targetDir = process.argv[2];
    if (!targetDir) {
      console.error("Usage: node compute-hash.js <directory_path>");
      process.exit(1);
    }

    const manifestPath = path.join(targetDir, "manifest.json");
    if (!fs.existsSync(manifestPath)) {
      console.error("Manifest not found at:", manifestPath);
      process.exit(0);
    }

    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      let items = Array.isArray(manifest) ? manifest : manifest.results || [];
      let updated = false;

      for (const item of items) {
        // Only process PDFs if hash is missing
        if (item.filename && item.filename.toLowerCase().endsWith(".pdf")) {
          // if (item.visual_hash) continue; // Optional: Skip if exists? No, enforce update.

          const filePath = path.join(targetDir, "files", item.filename);
          if (fs.existsSync(filePath)) {
            console.log(`Hashing: ${item.filename}...`);
            const hash = await computeFileHash(filePath);
            if (hash) {
              item.visual_hash = hash;
              updated = true;
              console.log(`  > Hash: ${hash.substring(0, 16)}...`);
            }
          }
        }
      }

      if (updated) {
        fs.writeFileSync(manifestPath, JSON.stringify(items, null, 2));
        console.log("Manifest updated with visual hashes.");
      } else {
        console.log("No hashes updated.");
      }
    } catch (e) {
      console.error("Critical Error:", e);
      process.exit(1);
    }
  })();
}
