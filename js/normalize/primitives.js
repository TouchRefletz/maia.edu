// --- 1. NORMALIZAÇÃO DOS DADOS ---f
export const joinLines = (arr) =>
  Array.isArray(arr) ? arr.join("\n") : arr || "";

// --- ADICIONE ESTA LINHA AQUI ---
export const safe = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
// --------------------------------
// helper: sempre devolve array (ou [])
export const asArray = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);

// helper: converte string/array/objeto em array de strings (para alertas/observações etc.)
export const asStringArray = (v) => {
  if (v == null) return [];
  if (Array.isArray(v)) return v.map((x) => String(x));
  if (typeof v === "string")
    return v
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  if (typeof v === "object") return Object.values(v).map((x) => String(x));
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
  String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

export function sanitizeInlineMarkdown(s) {
  return String(s || "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\*\*/g, "")
    .replace(/__/g, "")
    .trim();
}

/**
 * Decodifica HTML entities de volta para caracteres normais
 * Útil quando texto vem da IA com &quot; ao invés de "
 */
export const decodeEntities = (s) =>
  String(s ?? "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");

/**
 * Renderiza texto como markdown seguro, decodificando entities primeiro
 * Usa marked para converter markdown para HTML
 */
// Helper para processar LaTeX inline ($...$ -> \(...\))
export const processLatex = (s) => {
  if (!s) return "";
  // Substitui $...$ por \(...\) garantindo que não pegue \$ escapado
  return s.replace(/([^\\]|^)\$([^$]+)\$/g, (match, prefix, content) => {
    // Se for apenas números, pontos, vírgulas ou espaços (ex: datas, valores), remove o LaTeX
    // para evitar fontes de matemática estranhas e o problema dos parênteses.
    if (/^[0-9.,\s]+$/.test(content)) {
      return prefix + content;
    }
    // Caso contrário, converte para sintaxe MathJax \(...\)
    // Precisamos de 4 barras invertidas na string literal para resultar em 2 no output (\),
    // que o markdown consome para virar 1 na renderização final.
    // ESCAPA backslashes no conteúdo para sobreviverem ao markdown (ex: \text -> \\text)
    return `${prefix}\\\\(${content.replace(/\\/g, "\\\\")}\\\\)`;
  });
};

/**
 * Renderiza texto como markdown seguro, decodificando entities primeiro
 * Usa marked para converter markdown para HTML
 */
export const safeMarkdown = (s) => {
  // Primeiro decodifica entities
  let decoded = decodeEntities(s);

  // Processa LaTeX inline antes do markdown para evitar crash com caracteres especiais
  decoded = processLatex(decoded);

  // Verifica se o texto possui indícios de formatação markdown
  const temMarkdown = /[*_`#\[\]()]/.test(decoded) || 
                      /^([-+*])\s/m.test(decoded) || 
                      /^(\d+)[.)]\s/m.test(decoded) || 
                      /^>\s/m.test(decoded) || 
                      /\|/.test(decoded);

  if (!temMarkdown) {
    // Se só tiver latex (\(...\)), não precisa de markdown, mas precisamos garantir que o HTML escape funcione para o resto
    // Mas wait, safe() escapa < e >. Se o latex tiver < ou >, pode quebrar?
    // MathJax costuma lidar, mas idealmente não escapamos o conteúdo do LaTeX.
    // Porem, como estamos fazendo replace simples, vamos assumir que o usuário confia no input ou usar marked.
    // Vamos deixar passar pelo marked se tiver latex também?

    // Melhora: se tiver \( ou \[, considera que tem formatação rica e joga pro marked ou retorna direto
    if (decoded.includes("\\(") || decoded.includes("\\[")) {
      // Deixa cair no bloco do marked abaixo ou fallback
    } else {
      // safe() escapa ", mas innerHTML não precisa disso - apenas < > & são perigosos
      return decoded
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br>");
    }
  }

  // Se tiver marked disponível globalmente, usa
  if (typeof window !== "undefined" && window.marked) {
    try {
      // breaks: true garante que \n vire <br> (GFM style)
      return window.marked.parse(decoded, { breaks: true });
    } catch (e) {
      console.warn("Erro ao parsear markdown:", e);
    }
  }

  // Fallback: converte markdown básico manualmente
  return decoded
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/_(.+?)_/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\n/g, "<br>");
};
