/**
 * shadow-card.js — Renderizador de Cards de Questões em Closed Shadow DOM (Maia.edu)
 * 
 * Encapsula o HTML e os nós de texto das questões dentro de um Shadow Root com mode: 'closed'.
 * Isso impede que scripts externos ou comandos no DevTools (F12) consigam extrair o DOM com querySelector.
 */

import { renderLatexIn } from '../libs/loader.tsx';

/**
 * Cria um card protegido em Closed Shadow DOM
 * @param {HTMLElement} hostElement - Elemento hospedeiro no DOM principal
 * @param {string} innerHTML - Conteúdo HTML da questão
 * @param {Function} onInteractiveReady - Callback após injeção no shadow root
 * @returns {ShadowRoot} - Referência fechada temporária
 */
export function mountClosedShadowCard(hostElement, innerHTML, onInteractiveReady) {
  if (!hostElement) return null;

  // Estilos essenciais herdados dentro do Shadow Root
  const shadowStyles = `
    <style>
      :host {
        display: block;
        contain: content;
        user-select: text;
      }
      .question-card, .review-item-card, .card-questao {
        background: var(--color-surface, #ffffff);
        border: 1px solid var(--color-border, #e2e8f0);
        border-radius: 12px;
        padding: 20px;
        margin-bottom: 20px;
        color: var(--color-text, #1e293b);
        font-family: inherit;
        line-height: 1.6;
        box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      }
      .enunciado-text {
        font-size: 1.05rem;
        margin-bottom: 16px;
      }
      .alternativas-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin-top: 16px;
      }
      .alt-item {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 10px 14px;
        border-radius: 8px;
        background: var(--color-surface-hover, #f8fafc);
        border: 1px solid var(--color-border-subtle, #cbd5e1);
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .alt-item:hover {
        background: var(--color-primary-light, #e0e7ff);
        border-color: var(--color-primary, #6366f1);
      }
      .alt-letra {
        font-weight: 700;
        min-width: 24px;
      }
      img {
        max-width: 100%;
        height: auto;
        border-radius: 6px;
        margin: 12px 0;
      }
    </style>
  `;

  // Cria shadow root fechado (inacessível via hostElement.shadowRoot)
  try {
    const shadowRoot = hostElement.attachShadow({ mode: 'closed' });
    shadowRoot.innerHTML = `${shadowStyles}${innerHTML}`;

    // Renderiza LaTeX dentro do Shadow Root
    if (typeof renderLatexIn === 'function') {
      renderLatexIn(shadowRoot);
    }

    if (typeof onInteractiveReady === 'function') {
      onInteractiveReady(shadowRoot);
    }

    return shadowRoot;
  } catch (err) {
    // Fallback gracioso para navegadores ou ambientes legados
    hostElement.innerHTML = innerHTML;
    if (typeof renderLatexIn === 'function') {
      renderLatexIn(hostElement);
    }
    return null;
  }
}
