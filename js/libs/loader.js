// Adiciona um arquivo CSS ao <head> se ainda não existir
export function addCss(href) {
  if ([...document.querySelectorAll('link')].some((l) => l.href.includes(href)))
    return;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

// Adiciona um Script JS e retorna uma Promise (para usar await)
export function addScript(src) {
  return new Promise((resolve, reject) => {
    // Se já existe, resolve imediatamente
    if (
      [...document.querySelectorAll('script')].some((s) => s.src.includes(src))
    )
      return resolve();

    const s = document.createElement('script');
    s.src = src;
    s.defer = true;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

export async function ensureLibsLoaded() {
  // Evita carregamento duplicado
  if (window.__libsLoaded) return;
  window.__libsLoaded = true;

  try {
    // 1. Carrega KaTeX (Matemática)
    addCss('https://cdn.jsdelivr.net/npm/katex@0.16.25/dist/katex.min.css');
    await addScript(
      'https://cdn.jsdelivr.net/npm/katex@0.16.25/dist/katex.min.js'
    );

    // Auto-render depende do katex base
    await addScript(
      'https://cdn.jsdelivr.net/npm/katex@0.16.25/dist/contrib/auto-render.min.js'
    );

    // 2. Carrega Marked (Markdown)
    await addScript('https://cdn.jsdelivr.net/npm/marked/marked.min.js');

    console.log('Bibliotecas (KaTeX e Marked) carregadas com sucesso.');
  } catch (error) {
    console.error('Erro ao carregar bibliotecas externas:', error);
    window.__libsLoaded = false; // Permite tentar de novo se falhar
  }
}

export async function renderLatexIn(rootEl) {
  await ensureLibsLoaded();

  // Renderiza Markdown nos elementos que pedem (classe .markdown-content)
  if (window.marked && rootEl) {
    rootEl.querySelectorAll('.markdown-content').forEach((el) => {
      // Pega o texto cru (raw markdown) e converte pra HTML
      // O renderer do marked as vezes escapa o LaTeX, vamos proteger o cifrão
      const raw = el.getAttribute('data-raw') || el.innerHTML;
      el.innerHTML = window.marked.parse(raw);
    });
  }

  // Renderiza LaTeX (Matemática)
  if (window.renderMathInElement && rootEl) {
    window.renderMathInElement(rootEl, {
      delimiters: [
        { left: '\\[', right: '\\]', display: true }, // Bloco isolado
        { left: '$$', right: '$$', display: true }, // Bloco isolado (alternativo)
        { left: '\\(', right: '\\)', display: false }, // Inline padrão
        { left: '$', right: '$', display: false }, // Inline prático (Preferido da IA)
      ],
      throwOnError: false,
    });
  }
}
