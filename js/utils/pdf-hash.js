/**
 * PDF Visual Hash Utility (Frontend)
 * Wraps shared logic for browser environment.
 */
import { computePdfDocHash } from './shared-hash-logic.js';

// Canvas Factory for Browser
const browserCanvasFn = (w, h) => {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return {
    canvas,
    context: canvas.getContext('2d', { willReadFrequently: true }),
  };
};

// SHA256 for Browser
const browserSha256Fn = async (message) => {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
};

export async function computePdfHash(file, onStatusUpdate) {
  if (!file) return null;

  try {
    const buffer = await file.arrayBuffer();

    // Use global pdfjsLib (assumed loaded via CDN or import in main)
    // If pdfjsLib is not defined globally, we might need to import it depending on project setup.
    // The original file assumed global pdfjsLib.
    if (typeof pdfjsLib === 'undefined') {
      throw new Error('pdfjsLib is not loaded');
    }

    const pdf = await pdfjsLib.getDocument(buffer).promise;

    return await computePdfDocHash(pdf, browserCanvasFn, browserSha256Fn, onStatusUpdate);
  } catch (err) {
    console.error('Hash calculation error:', err);
    throw new Error('Falha ao calcular identidade visual: ' + err.message);
  }
}
