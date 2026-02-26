/**
 * Utilitário centralizado para hidratação de conteúdo do chat (Carousels, Scaffolding, Questões)
 * Evita duplicação de lógica entre telas.js e chat-debugger.js
 */

import { hydrateScaffoldingBlocks } from "../app/telas.js"; // Ou onde estiver definido
import { criarCardTecnico } from "../banco/card-template.js";
import { renderLatexIn } from "../libs/loader.tsx";
import { findBestQuestion } from "../services/question-service.js"; // Importar dependências diretas se possível
import { hydrateCarousels } from "../ui/carousel.js";

// Nota: hydrateScaffoldingBlocks e hydrateQuestionBlocks estão atualmente dentro de telas.js
// O ideal seria movê-las para cá ou para um módulo separado, mas por compatibilidade vamos importá-las ou redefini-las se necessário.
// Como hydrateScaffoldingBlocks é exportada de telas.js, podemos usá-la.
// hydrateQuestionBlocks NÃO é exportada de telas.js (é interna). Precisamos movê-la ou duplicar a lógica aqui de forma mais limpa.

/**
 * Hidrata todo o conteúdo dinâmico dentro de um container de mensagem
 */
export async function hydrateAllChatContent(container) {
  if (!container) return;

  // 1. Carousels
  hydrateCarousels(container);

  // 2. Scaffolding (Exercícios Interativos)
  // Tenta usar a importada, mas em ambiente de debug ela pode ter dependências de estado global de telas.js
  // Vamos assumir que funciona, pois o debugger já importa ela no topo
  try {
    if (typeof hydrateScaffoldingBlocks === "function") {
      hydrateScaffoldingBlocks(container);
    }
  } catch (e) {
    console.warn("Erro ao hidratar scaffolding:", e);
  }

  // 3. Questões (Busca Async)
  // Esta lógica estava dentro de telas.js e duplicada no debugger. Centralizando aqui.
  const placeholders = container.querySelectorAll(".chat-question-placeholder");

  // Processamos em paralelo para performance
  const hydrationPromises = Array.from(placeholders).map(
    async (placeholder) => {
      try {
        // Evita re-hidratação
        if (placeholder.dataset.hydrated) return;
        placeholder.dataset.hydrated = "true";

        const filterJson = placeholder.dataset.filter;
        if (!filterJson) return;

        const filterData = JSON.parse(filterJson);

        // Fallback visual enquanto carrega
        // (Já existe o spinner do HTML estático, mas podemos refinar se quiser)

        const q = await findBestQuestion(filterData);

        if (q) {
          const card = criarCardTecnico(q.id, q.fullData);
          card.classList.add("chat-embedded-card");

          // Substitui o placeholder pelo card real
          placeholder.replaceWith(card);

          // Renderiza LaTeX nas partes estáticas do card recém-criado
          const staticParts = card.querySelectorAll(
            ".q-header, .q-options, .q-footer, .static-render-target, .markdown-content",
          );
          staticParts.forEach((el) => renderLatexIn(el));
        } else {
          // Caso não encontre, mantém o placeholder ou mostra erro discreto
          placeholder.innerHTML = `<div style="padding:10px; color:var(--color-text-secondary); border:1px dashed var(--color-border); border-radius:8px; text-align:center;">
                    Questão não encontrada: "${filterData.query}"
                 </div>`;
        }
      } catch (err) {
        console.error("Erro na hidratação da questão:", err);
        placeholder.innerHTML = `<div style="color:red; font-size:12px;">Erro ao carregar questão.</div>`;
      }
    },
  );

  // 4. Imagens Dinâmicas (Busca via IA/Google/Wikimedia)
  const imagePlaceholders = container.querySelectorAll(
    ".chat-dynamic-image-placeholder:not([data-hydrated='true'])",
  );
  const imagePromises = Array.from(imagePlaceholders).map(
    async (placeholder) => {
      placeholder.dataset.hydrated = "true";
      const definedUrl = placeholder.dataset.url;
      const query = placeholder.dataset.query;

      const renderImage = (imgUrl) => {
        placeholder.style.padding = "0";
        placeholder.style.border = "none";
        placeholder.innerHTML = `
            <img src="${imgUrl}" alt="${query}" style="max-width:100%; border-radius:8px; display:block; margin: 0 auto; box-shadow: 0 4px 12px rgba(0,0,0,0.1);" />
            <div style="font-size:0.85em; color:var(--color-text-tertiary); text-align:center; margin-top:8px;">${query}</div>
          `;
      };

      const renderError = () => {
        placeholder.innerHTML = `
            <div style="font-size:1.5em; margin-bottom:8px;">🚫</div>
            <div>Não foi possível carregar a imagem.</div>
            <div style="font-size:0.85em; margin-top:4px;">Descrição original: ${query}</div>
          `;
      };

      async function fetchFallback() {
        if (!query) return renderError();

        try {
          const workerUrl =
            typeof import.meta !== "undefined" &&
            import.meta.env?.VITE_WORKER_URL
              ? import.meta.env.VITE_WORKER_URL
              : "https://maia-api.touchrefletz.workers.dev";
          const apiUrl = `${workerUrl}/search-image?q=${encodeURIComponent(query)}`;

          const res = await fetch(apiUrl);
          if (res.ok) {
            const data = await res.json();
            if (data.url) {
              renderImage(data.url);
            } else {
              renderError();
            }
          } else {
            renderError();
          }
        } catch (e) {
          console.error("Erro ao buscar imagem fallback:", e);
          renderError();
        }
      }

      if (definedUrl) {
        const img = new Image();
        img.onload = () => renderImage(definedUrl);
        img.onerror = () => fetchFallback();
        img.src = definedUrl;
      } else {
        await fetchFallback();
      }
    },
  );

  await Promise.all([...hydrationPromises, ...imagePromises]);
}
