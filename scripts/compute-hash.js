/**
 * Node.js Script to Compute Visual Hash for PDFs using Puppeteer
 * This ensures 100% consistency with the browser rendering.
 *
 * Usage: node scripts/compute-hash.js [directory_path] OR [pdf_file]
 */

import { exec } from "child_process";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Helper: Log to Pusher via logger.py (if exists in root or parent)
const logToPusher = (msg) => {
  // Check root (../logger.py from scripts/) or current dir
  let loggerPath = path.resolve(__dirname, "../logger.py");
  if (!fs.existsSync(loggerPath)) loggerPath = "logger.py"; // Fallback for CWD

  if (fs.existsSync(loggerPath)) {
    // Fire and forget
    exec(`python3 "${loggerPath}" "${msg}"`);
  }
};

// Path to dependencies
// We need to inject the raw code into the browser page
const PDFJS_PATH = path.resolve(
  __dirname,
  "../node_modules/pdfjs-dist/build/pdf.js"
);
const PDFJS_WORKER_PATH = path.resolve(
  __dirname,
  "../node_modules/pdfjs-dist/build/pdf.worker.js"
);
const SHARED_HASH_LOGIC_PATH = path.resolve(
  __dirname,
  "../js/utils/shared-hash-logic.js"
);

async function getBrowserInstance() {
  return await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
}

export async function computeFileHash(filePath) {
  let browser;
  try {
    const pdfData = fs.readFileSync(filePath).toString("base64");

    browser = await getBrowserInstance();
    const page = await browser.newPage();

    // 1. Inject PDF.js
    const pdfJsContent = fs.readFileSync(PDFJS_PATH, "utf8");
    await page.addScriptTag({ content: pdfJsContent });

    // 2. Setup Worker source
    const pdfJsWorkerContent = fs.readFileSync(PDFJS_WORKER_PATH, "utf8");
    await page.evaluate((workerCode) => {
      const blob = new Blob([workerCode], { type: "text/javascript" });
      window.pdfWorkerUrl = URL.createObjectURL(blob);
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = window.pdfWorkerUrl;
    }, pdfJsWorkerContent);

    // 3. Inject Shared Hash Logic
    // We need to strip 'export' keywords to make it run in the browser console verify easily
    let sharedLogic = fs.readFileSync(SHARED_HASH_LOGIC_PATH, "utf8");
    sharedLogic = sharedLogic.replace(/export /g, ""); // Remove exports
    await page.addScriptTag({ content: sharedLogic });

    // 4. Run the Hash Computation in the Browser Context
    logToPusher(`Validando integridade visual: ${path.basename(filePath)}`);
    // We get the RAW VISUAL STRING back, and hash it in Node to avoid crypto.subtle issues in insecure contexts
    const rawVisualData = await page.evaluate(async (pdfBase64) => {
      // Utils injected via shared-hash-logic (unpacked)
      // We expect: CONFIG, computeDHash, computePdfDocHash (global scope now)

      // Define helpers required by computePdfDocHash
      const canvasFn = (w, h) => {
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        return {
          canvas: c,
          context: c.getContext("2d", { willReadFrequently: true }),
        };
      };

      // Just return the data, don't hash here
      const passThroughFn = async (msg) => msg;

      // Load PDF
      // pdfjsLib is global
      const pdfData = atob(pdfBase64);
      const loadingTask = window.pdfjsLib.getDocument({ data: pdfData });
      const pdf = await loadingTask.promise;

      // Compute Hash
      // computePdfDocHash is now in global scope from the injected script
      return await window.computePdfDocHash(
        pdf,
        canvasFn,
        passThroughFn,
        (status) => {
          console.log("Browser Progress:", status);
        },
        true // Enable Debug Logging
      );
    }, pdfData);

    await browser.close();

    // 5. Compute SHA256 in Node.js
    return crypto.createHash("sha256").update(rawVisualData).digest("hex");
  } catch (e) {
    console.error(`Failed to process ${filePath}:`, e);
    if (browser) await browser.close();
    return null;
  }
}

// Main Execution
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  (async () => {
    const arg = process.argv[2];
    // Handle single file test
    if (arg && arg.toLowerCase().endsWith(".pdf") && fs.existsSync(arg)) {
      console.log(`Hashing single file: ${arg}...`);
      console.time("Hashing");
      const hash = await computeFileHash(arg);
      console.timeEnd("Hashing");
      console.log(`Hash: ${hash}`);
      process.exit(0);
    }

    // Default Directory Mode
    const targetDir = arg;
    if (!targetDir) {
      console.error(
        "Usage: node compute-hash.js <directory_path> OR <pdf_file>"
      );
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

      // Filter args
      const targetFiles = process.argv.slice(3).map((f) => f.toLowerCase());

      for (const item of items) {
        if (item.filename && item.filename.toLowerCase().endsWith(".pdf")) {
          if (
            targetFiles.length > 0 &&
            !targetFiles.includes(item.filename.toLowerCase())
          ) {
            continue;
          }

          const filePath = path.join(targetDir, "files", item.filename);
          if (fs.existsSync(filePath)) {
            console.log(`Hashing: ${item.filename}...`);
            // Only log via Pusher if not verbose to avoid spam, or key files?
            // Let's log updates
            const hash = await computeFileHash(filePath);
            if (hash) {
              // Determine if changed
              if (item.visual_hash !== hash) {
                console.log(
                  `  > Updated Hash: ${hash.substring(0, 16)}... (was ${item.visual_hash ? item.visual_hash.substring(0, 16) : "null"})`
                );
                item.visual_hash = hash;
                updated = true;
              } else {
                console.log(`  > Hash verified.`);
              }
            }
          }
        }
      }

      if (updated) {
        fs.writeFileSync(manifestPath, JSON.stringify(items, null, 2));
        console.log("Manifest updated with visual hashes.");
      } else {
        console.log("No hashes changed.");
      }
      process.exit(0);
    } catch (e) {
      console.error("Critical Error:", e);
      process.exit(1);
    }
  })();
}
