// --- 1. NORMALIZAÇÃO DOS DADOS ---f
export const joinLines = (arr) => (Array.isArray(arr) ? arr.join('\n') : arr || '');

// --- ADICIONE ESTA LINHA AQUI ---
export const safe = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
// --------------------------------
// helper: sempre devolve array (ou [])
export const asArray = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);

// helper: converte string/array/objeto em array de strings (para alertas/observações etc.)
export const asStringArray = (v) => {
  if (v == null) return [];
  if (Array.isArray(v)) return v.map((x) => String(x));
  if (typeof v === 'string')
    return v
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
  if (typeof v === 'object') return Object.values(v).map((x) => String(x));
  return [String(v)];
};

export const safeClone = (obj) => {
  try {
    return structuredClone(obj);
  } catch (e) {
    return JSON.parse(JSON.stringify(obj));
  }
};

export const escapeHTML = (s) =>
  String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

export function sanitizeInlineMarkdown(s) {
  return String(s || '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\*\*/g, '')
    .replace(/__/g, '')
    .trim();
}
