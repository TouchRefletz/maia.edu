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
        // Mantém uma dimensão fixa para o placeholder como pedido, impedindo que imagem quebre o layout
        placeholder.style.aspectRatio = "16/9";
        placeholder.style.background = "var(--color-surface, #1e1e23)";
        placeholder.style.position = "relative";
        placeholder.style.overflow = "hidden";
        placeholder.style.display = "flex";
        placeholder.style.flexDirection = "column";

        placeholder.innerHTML = `
            <img class="chat-dynamic-img-expandable" src="${imgUrl}" alt="${query}" style="width:100%; height:100%; object-fit:cover; display:block; cursor:pointer;" />
            <div style="font-size:0.85em; color:var(--color-text-secondary, #b0b0b0); background: var(--color-surface, rgba(0,0,0,0.8)); border: 1px solid var(--color-border, #333); padding:4px 8px; position:absolute; bottom:8px; left:8px; border-radius:6px; max-width:calc(100% - 16px); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; box-shadow: 0 4px 12px rgba(0,0,0,0.5);">${query}</div>
          `;

        // Click action: Popup / Lightbox
        const imgEl = placeholder.querySelector(".chat-dynamic-img-expandable");
        if (imgEl) {
          imgEl.addEventListener("click", () => {
            const overlay = document.createElement("div");
            overlay.style.position = "fixed";
            overlay.style.top = "0";
            overlay.style.left = "0";
            overlay.style.width = "100%";
            overlay.style.height = "100%";
            overlay.style.backgroundColor = "rgba(10, 10, 12, 0.85)"; // Use a dark theme base
            overlay.style.zIndex = "99999";
            overlay.style.display = "flex";
            overlay.style.alignItems = "center";
            overlay.style.justifyContent = "center";
            overlay.style.backdropFilter = "blur(12px)";
            overlay.style.cursor = "zoom-out";

            const expandedImg = document.createElement("img");
            expandedImg.src = imgUrl;
            expandedImg.style.maxWidth = "90%";
            expandedImg.style.maxHeight = "90%";
            expandedImg.style.objectFit = "contain";
            expandedImg.style.borderRadius = "12px";
            expandedImg.style.boxShadow =
              "0 12px 60px rgba(0,0,0,0.8), 0 0 0 1px var(--color-border, rgba(255,255,255,0.05))";
            expandedImg.style.cursor = "default";

            const closeBtn = document.createElement("button");
            closeBtn.innerHTML = "✖";
            closeBtn.style.position = "absolute";
            closeBtn.style.top = "20px";
            closeBtn.style.right = "20px";
            closeBtn.style.background = "var(--color-surface, #2a2a30)";
            closeBtn.style.color = "var(--color-text, #fff)";
            closeBtn.style.border =
              "1px solid var(--color-border, rgba(255,255,255,0.1))";
            closeBtn.style.borderRadius = "50%";
            closeBtn.style.width = "40px";
            closeBtn.style.height = "40px";
            closeBtn.style.cursor = "pointer";
            closeBtn.style.fontSize = "16px";
            closeBtn.style.display = "flex";
            closeBtn.style.alignItems = "center";
            closeBtn.style.justifyContent = "center";
            closeBtn.style.boxShadow = "0 4px 12px rgba(0,0,0,0.3)";
            closeBtn.style.transition = "transform 0.2s, background 0.2s";

            closeBtn.onmouseover = () => {
              closeBtn.style.transform = "scale(1.1)";
              closeBtn.style.background = "var(--color-border)";
            };
            closeBtn.onmouseout = () => {
              closeBtn.style.transform = "scale(1)";
              closeBtn.style.background = "var(--color-surface, #2a2a30)";
            };

            const closeLightbox = () => overlay.remove();

            closeBtn.addEventListener("click", (e) => {
              e.stopPropagation();
              closeLightbox();
            });
            overlay.addEventListener("click", closeLightbox);
            expandedImg.addEventListener("click", (e) => e.stopPropagation());

            overlay.appendChild(expandedImg);
            overlay.appendChild(closeBtn);
            document.body.appendChild(overlay);
          });
        }
      };

      async function saveImageMetadataToHistory(imgUrl, _retryCount = 0) {
        const MAX_RETRIES = 3;
        const RETRY_DELAYS = [2000, 4000, 8000]; // Delays crescentes (2s, 4s, 8s)

        if (!window.currentChatId) return; // Só persiste se estiver em um chat salvo
        const messageEl = placeholder.closest(".chat-message");
        if (!messageEl || messageEl.dataset.msgIndex === undefined) return;

        const msgIndex = parseInt(messageEl.dataset.msgIndex, 10);
        const chatId = window.currentChatId; // Captura o ID atual (pode mudar entre retries)

        try {
          const { ChatStorageService } =
            await import("../services/chat-storage.js");
          const chat = await ChatStorageService.getChat(chatId);

          if (chat && chat.messages && chat.messages[msgIndex]) {
            const msg = chat.messages[msgIndex];
            let modified = false;

            const updateBlock = (block) => {
              if (!block || typeof block !== "object") return;

              // Verifica se é o bloco de imagem alvo
              if (block.tipo === "imagem") {
                const blockConteudo =
                  typeof block.conteudo === "string"
                    ? block.conteudo
                    : block.query || "";
                if (
                  blockConteudo.toLowerCase() === query.toLowerCase() ||
                  blockConteudo === placeholder.dataset.query
                ) {
                  if (!block.props) block.props = {};
                  if (block.props.url !== imgUrl) {
                    block.props.url = imgUrl;
                    modified = true;
                  }
                }
              }

              // Escaneia iterativamente estruturas comuns do chat formatado
              if (Array.isArray(block)) {
                block.forEach(updateBlock);
              } else {
                const keysToScan = [
                  "conteudo",
                  "slots",
                  "sections",
                  "slides",
                  "content",
                ];
                keysToScan.forEach((key) => {
                  if (block[key]) {
                    if (Array.isArray(block[key]))
                      block[key].forEach(updateBlock);
                    else if (typeof block[key] === "object") {
                      Object.values(block[key]).forEach((v) => {
                        if (Array.isArray(v)) v.forEach(updateBlock);
                        else updateBlock(v);
                      });
                    }
                  }
                });
              }
            };

            updateBlock(msg.content);

            if (modified) {
              await ChatStorageService.saveChat(chat);
              console.log(
                "[Hydration] ✅ URL da Imagem salva no histórico:",
                imgUrl,
              );
            }
          } else if (_retryCount < MAX_RETRIES) {
            // Mensagem ainda não foi persistida pelo pipeline (timing issue)
            // Agenda retry com delay crescente para esperar o addMessage completar
            const delay = RETRY_DELAYS[_retryCount] || 4000;
            console.log(
              `[Hydration] ⏳ Mensagem [${msgIndex}] não encontrada no storage. Retry ${_retryCount + 1}/${MAX_RETRIES} em ${delay}ms...`,
            );
            setTimeout(() => {
              // Verifica se ainda estamos no mesmo chat antes de tentar novamente
              if (window.currentChatId === chatId) {
                saveImageMetadataToHistory(imgUrl, _retryCount + 1);
              }
            }, delay);
          } else {
            console.warn(
              `[Hydration] ❌ Falha ao salvar URL da imagem após ${MAX_RETRIES} tentativas. Mensagem [${msgIndex}] não encontrada.`,
            );
          }
        } catch (e) {
          console.warn("Erro ao salvar imagem no histórico:", e);
        }
      }

      const renderError = () => {
        placeholder.style.padding = "12px";
        placeholder.style.border = "1px dashed var(--color-border, #444)";
        placeholder.style.borderRadius = "8px";
        placeholder.style.textAlign = "center";
        placeholder.style.color = "var(--color-text-secondary, #888)";
        placeholder.style.fontSize = "0.85em";
        placeholder.innerHTML = `<div>🖼️ Imagem indisponível${query ? `: "${query}"` : ""}</div>`;
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
              await saveImageMetadataToHistory(data.url);
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
