// loader.tsx
import { useEffect, useRef } from 'react';

// 1. Definição de Tipos Globais para as bibliotecas que são carregadas via CDN
declare global {
  interface Window {
    __libsLoaded?: boolean;
    marked?: {
      parse: (text: string) => string;
    };
    renderMathInElement?: (
      element: HTMLElement,
      options?: {
        delimiters?: Array<{
          left: string;
          right: string;
          display: boolean;
        }>;
        throwOnError?: boolean;
      }
    ) => void;
  }
}

// Adiciona um arquivo CSS ao <head> se ainda não existir
export function addCss(href: string): void {
  // Converte NodeList para Array para usar .some
  const links = Array.from(document.querySelectorAll('link'));
  
  if (links.some((l) => l.href.includes(href))) {
    return;
  }

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

// Adiciona um Script JS e retorna uma Promise
export function addScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const scripts = Array.from(document.querySelectorAll('script'));

    // Se já existe, resolve imediatamente
    if (scripts.some((s) => s.src.includes(src))) {
      return resolve();
    }

    const s = document.createElement('script');
    s.src = src;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = (e) => reject(e);
    document.head.appendChild(s);
  });
}

export async function ensureLibsLoaded(): Promise<void> {
  // Evita carregamento duplicado
  if (typeof window !== 'undefined' && window.__libsLoaded) return;
  
  if (typeof window !== 'undefined') {
    window.__libsLoaded = true;
  }

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
    if (typeof window !== 'undefined') {
      window.__libsLoaded = false; // Permite tentar de novo se falhar
    }
  }
}

export async function renderLatexIn(rootEl: HTMLElement | null): Promise<void> {
  if (!rootEl) return;

  await ensureLibsLoaded();

  // Renderiza Markdown nos elementos que pedem (classe .markdown-content)
  // Verifica se o marked foi carregado no window
  if (window.marked) {
    const markdownElements = rootEl.querySelectorAll('.markdown-content');
    
    markdownElements.forEach((el) => {
      // Cast para HTMLElement para acessar propriedades específicas se necessário
      const htmlEl = el as HTMLElement;
      
      const raw = htmlEl.getAttribute('data-raw') || htmlEl.innerHTML;
      
      // O renderer do marked converte markdown para HTML
      htmlEl.innerHTML = window.marked!.parse(raw);
    });
  }

  // Renderiza LaTeX (Matemática)
  if (window.renderMathInElement) {
    window.renderMathInElement(rootEl, {
      delimiters: [
        { left: '\\[', right: '\\]', display: true }, // Bloco isolado
        { left: '$$', right: '$$', display: true },   // Bloco isolado (alternativo)
        { left: '\\(', right: '\\)', display: false },// Inline padrão
        { left: '$', right: '$', display: false },    // Inline prático
      ],
      throwOnError: false,
    });
  }
}

// --- MÉTODOS AUXILIARES REACT (Para facilitar a manutenção) ---

/**
 * Hook React para renderizar Markdown e LaTeX automaticamente em um elemento.
 * Uso: const ref = useMathRender(conteudo);
 * <div ref={ref} />
 */
export function useMathRender(contentDependencies: any[] = []) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      renderLatexIn(ref.current);
    }
  }, [contentDependencies]); // Re-renderiza quando as dependências mudarem

  return ref;
}