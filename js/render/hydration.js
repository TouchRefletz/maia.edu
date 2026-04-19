/**
 * Utilitário centralizado para hidratação de conteúdo do chat (Carousels, Scaffolding, Questões)
 * Evita duplicação de lógica entre telas.js e chat-debugger.js
 */

import { hydrateScaffoldingBlocks } from "../app/telas.js"; // Ou onde estiver definido
import { criarCardTecnico } from "../banco/card-template.js";
import { renderLatexIn } from "../libs/loader.tsx";
import { findBestQuestion } from "../services/question-service.js"; // Importar dependências diretas se possível
import { hydrateCarousels } from "../ui/carousel.js";
import mermaid from "mermaid";

// Inicializa mermaid com tema dinâmico baseado no esquema de cores atual
let lastInitedTheme = null;
function ensureMermaidInit() {
  const currentTheme = document.documentElement.getAttribute("data-color-scheme") || "dark";
  
  // Só re-inicializa se o tema mudou
  if (lastInitedTheme === currentTheme) return;
  
  console.log(`[Hydration] 🎨 Inicializando Mermaid no tema: ${currentTheme}`);
  
    mermaid.initialize({
    startOnLoad: false,
    theme: currentTheme === "dark" ? "dark" : "default",
    themeVariables: {
      darkMode: currentTheme === "dark",
      primaryColor: "#2db7c6",
      primaryTextColor: currentTheme === "dark" ? "#e0e0e0" : "#333",
      primaryBorderColor: currentTheme === "dark" ? "#3a3a3f" : "#ddd",
      lineColor: currentTheme === "dark" ? "#6b7280" : "#999",
      background: currentTheme === "dark" ? "#15151a" : "#ffffff",
      mainBkg: currentTheme === "dark" ? "#1e1e23" : "#f9f9f9",
      nodeBorder: currentTheme === "dark" ? "#3a3a3f" : "#ccc",
      clusterBkg: currentTheme === "dark" ? "#1e1e23" : "#f5f5f5",
      fontSize: "14px",
    },
    mindmap: {
      nodeTextColor: currentTheme === "dark" ? "#e0e0e0" : "#333",
      mainBkg: currentTheme === "dark" ? "#1e1e23" : "#f9f9f9",
    },
    securityLevel: "loose",
    flowchart: { curve: "basis", padding: 15 },
  });
  
  lastInitedTheme = currentTheme;
}


/**
 * Converte valores rgb(a) para HEX
 * Mermaid falha na renderização se houver vírgulas dentro das definições de estilo (classDef)
 */
function ensureHexColor(color) {
  if (!color || typeof color !== "string") return color;
  
  if (color.startsWith("rgb")) {
    const parts = color.match(/\d+(\.\d+)?/g);
    if (parts && parts.length >= 3) {
      const r = parseInt(parts[0], 10);
      const g = parseInt(parts[1], 10);
      const b = parseInt(parts[2], 10);
      // Converte para #RRGGBB
      return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
    }
  }
  return color;
}

/**
 * Resolve variáveis CSS do :root para valores HEX/RGB reais
 * Necessário pois o Mermaid nem sempre lida bem com var() dentro das definições
 */
export function resolveCssVarsInChart(chartCode) {
  const rootStyle = getComputedStyle(document.documentElement);
  
  // Regex aprimorada para suportar espaços e fallbacks: var( --nome, fallback )
  return chartCode.replace(/var\(\s*(--[^,\s\)]+)(?:\s*,\s*([^)]+))?\s*\)/g, (match, varName, fallback) => {
    let value = rootStyle.getPropertyValue(varName.trim()).trim();
    
    // Se o valor estiver vazio, usa o fallback se existir, ou retorna o original
    if (!value) {
        if (fallback) return ensureHexColor(fallback.trim());
        return match;
    }
    
    // Converte para HEX se for RGB/RGBA para evitar que as vírgulas quebrem o parser do Mermaid
    return ensureHexColor(value.replace(/;$/, ""));
  });
}


/**
 * Re-renderiza todos os diagramas Mermaid e blocos de texto com variáveis
 */
export async function rerenderAllDynamicContent() {
  // 1. Diagramas Mermaid
  const diagrams = document.querySelectorAll(".chat-mermaid-rendered, .chat-mermaid-placeholder");
  for (const container of diagrams) {
    const originalCode = container.dataset.chart;
    if (originalCode) {
        container.dataset.hydrated = "false";
        container.classList.remove("chat-mermaid-rendered");
        container.classList.add("chat-mermaid-placeholder");
    }
  }

  // 2. Blocos Markdown com Variáveis
  const markdownBlocks = document.querySelectorAll(".markdown-content[data-raw*='var(']");
  for (const block of markdownBlocks) {
      const originalRaw = block.dataset.raw;
      if (originalRaw) {
          // Nota: safeMarkdown e resolveCssVarsInChart precisam estar acessíveis ou re-importados se necessário
          // Como este arquivo é o hydration.js e ChatRender.js é quem controla a renderização inicial,
          // o ideal é que a lógica de "resolver e renderizar markdown" esteja centralizada.
          // Por simplicidade e performance, vamos apenas atualizar o texto se ele contiver var()
          const processed = resolveCssVarsInChart(originalRaw);
          // Importação dinâmica para evitar circular dependency se houver
          import("../normalize/primitives.js").then(({ safeMarkdown }) => {
              block.innerHTML = safeMarkdown(processed);
          });
      }
  }

  // Chama hidratação global ou específica
  const chatContainer = document.getElementById("chatMessages");
  if (chatContainer) await hydrateAllChatContent(chatContainer);
}

// Debounce para evitar múltiplas renderizações em picos de mudanças
let rerenderTimeout;
function debouncedRerender() {
    clearTimeout(rerenderTimeout);
    rerenderTimeout = setTimeout(() => {
        console.log("[Hydration] 🔄 Detectada mudança em variáveis, re-renderizando conteúdo...");
        rerenderAllDynamicContent();
    }, 100);
}


// Observer para detectar mudanças em variáveis CSS (via atributo style no html/body)
const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
        if (mutation.type === "attributes" && (mutation.attributeName === "style" || mutation.attributeName === "data-color-scheme")) {
            debouncedRerender();
            break;
        }
    }
});
observer.observe(document.documentElement, { attributes: true });


// Listener para troca de tema do site
window.addEventListener("maia-theme-change", () => {
  console.log("[Hydration] 🌓 Tema alterado, re-renderizando diagramas...");
  rerenderAllDynamicContent();
});


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

      // URLs que já falharam para este placeholder (evita loop infinito)
      const failedUrls = new Set();
      let fallbackRetries = 0;
      const MAX_FALLBACK_RETRIES = 3;

      const renderLoadingState = (msg = "Buscando imagem...") => {
        placeholder.innerHTML = `
          <div style="width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; background:rgba(0,0,0,0.2); border-radius:12px; border:1px dashed var(--color-border, #444); gap:10px;">
            <div class="maia-spinner" style="width:20px; height:20px; border:2px solid var(--color-primary, #2db7c6); border-top-color:transparent; border-radius:50%; animation:spin 1s linear infinite;"></div>
            <span style="font-size:0.8em; color:var(--color-text-secondary);">${msg}</span>
          </div>
        `;
      };

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
        placeholder.style.borderRadius = "12px";

        placeholder.innerHTML = `
            <img class="chat-dynamic-img-expandable" src="${imgUrl}" alt="${query || 'imagem'}" style="width:100%; height:100%; object-fit:cover; display:block; cursor:pointer;" />
            <div style="font-size:0.85em; color:var(--color-text-secondary, #b0b0b0); background: var(--color-surface, rgba(0,0,0,0.8)); border: 1px solid var(--color-border, #333); padding:4px 8px; position:absolute; bottom:8px; left:8px; border-radius:6px; max-width:calc(100% - 16px); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; box-shadow: 0 4px 12px rgba(0,0,0,0.5);">${query || 'Visualização'}</div>
          `;

        // Fallback automático: se a imagem falhar no DOM (403, CORS, etc.), busca outra
        const imgEl = placeholder.querySelector(".chat-dynamic-img-expandable");
        if (imgEl) {
          imgEl.addEventListener("error", () => {
            console.warn(
              `[Hydration] ⚠️ Imagem bloqueada/indisponível no DOM: ${imgUrl}`,
            );
            failedUrls.add(imgUrl);
            
            if (fallbackRetries < MAX_FALLBACK_RETRIES) {
                fallbackRetries++;
                // Mostra estado de busca na UI
                renderLoadingState(`Buscando alternativa (${fallbackRetries}/${MAX_FALLBACK_RETRIES})...`);
                
                // Limpa a URL salva no dataset (que é inválida)
                placeholder.dataset.url = "";
                
                // Pequeno delay para não sobrecarregar
                setTimeout(() => fetchFallback(), 500);
            } else {
                console.error(`[Hydration] ❌ Limite de fallbacks atingido para: ${query}`);
                renderError();
            }
          }, { once: true });

          imgEl.addEventListener("click", () => {
            const overlay = document.createElement("div");
            overlay.style.position = "fixed";
            overlay.style.top = "0";
            overlay.style.left = "0";
            overlay.style.width = "100%";
            overlay.style.height = "100%";
            overlay.style.backgroundColor = "rgba(10, 10, 12, 0.85)"; 
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

          // Envia URLs que já falharam para o worker excluí-las da busca
          const excludeParam = failedUrls.size > 0
            ? `&exclude=${encodeURIComponent(JSON.stringify([...failedUrls]))}`
            : "";
          const apiUrl = `${workerUrl}/search-image?q=${encodeURIComponent(query)}${excludeParam}`;

          const res = await fetch(apiUrl);
          if (res.ok) {
            const data = await res.json();
            if (data.url && !failedUrls.has(data.url)) {
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
        img.onerror = () => {
          console.warn(`[Hydration] ⚠️ Pre-check falhou para: ${definedUrl}`);
          failedUrls.add(definedUrl);
          fallbackRetries++;
          renderLoadingState(`Buscando alternativa (${fallbackRetries}/${MAX_FALLBACK_RETRIES})...`);
          fetchFallback();
        };
        img.src = definedUrl;
      } else {
        renderLoadingState();
        await fetchFallback();
      }
    },
  );

  // 5. Diagramas Mermaid (Renderiza SVG a partir de placeholders)
  const mermaidPlaceholders = container.querySelectorAll(
    ".chat-mermaid-placeholder:not([data-hydrated='true'])",
  );
  const mermaidPromises = Array.from(mermaidPlaceholders).map(
    async (placeholder, idx) => {
      placeholder.dataset.hydrated = "true";
      const chartCode = placeholder.dataset.chart;
      if (!chartCode || !chartCode.trim()) {
        placeholder.innerHTML = `<div style="color:var(--color-text-secondary); font-size:0.85em;">⚠️ Diagrama vazio</div>`;
        return;
      }

      try {
        ensureMermaidInit();
        const uniqueId = `mermaid-${Date.now()}-${idx}`;
        
        let processedChartCode = chartCode.trim();
        
        // Se for mindmap, remove a linha classDef que o Mermaid não suporta neste tipo de diagrama
        // Isso evita erros de renderização quando a IA tenta aplicar o protocolo visual
        if (processedChartCode.toLowerCase().startsWith("mindmap")) {
          processedChartCode = processedChartCode
            .split('\n')
            .filter(line => !line.trim().toLowerCase().startsWith("classdef"))
            .join('\n');
        }

        // Pós-processamento "brabo": Resolve variáveis CSS antes de mandar pro Mermaid
        processedChartCode = resolveCssVarsInChart(processedChartCode);

        // EXTRA: Injeção de Tema Premium para Mindmaps (conforme solicitado pelo USER)
        if (processedChartCode.toLowerCase().trim().startsWith("mindmap")) {
          const rootStyle = getComputedStyle(document.documentElement);
          const currentTheme = document.documentElement.getAttribute("data-color-scheme") || "dark";
          const isDark = currentTheme === "dark";
          
          // Captura cores do tema do site dinamicamente
          const themePrimary = ensureHexColor(rootStyle.getPropertyValue("--color-primary").trim()) || "#cc5252";
          const themeSecondary = ensureHexColor(rootStyle.getPropertyValue("--color-secondary").trim()) || "#b84dff";
          const themeAccent = ensureHexColor(rootStyle.getPropertyValue("--color-accent").trim()) || "#4d94ff";
          const themeText = isDark ? "#ffffff" : "#1a1a1a";
          const themeLine = isDark ? "#444" : "#ccc";

          // Define uma escala de cores (cScale) baseada no tema para garantir que todos os níveis tenham cor
          // Mermaid mindmaps usam cScale0 até cScale11
          const initBlock = `%%{
  init: {
    'theme': 'base',
    'themeVariables': {
      'primaryColor': '${themePrimary}',
      'primaryTextColor': '#ffffff',
      'secondaryColor': '${themeSecondary}',
      'tertiaryColor': '${themeAccent}',
      'lineColor': '${themeLine}',
      'fontFamily': 'Inter, sans-serif',
      'fontSize': '15px',
      'cScale0': '${themePrimary}',
      'cScale1': '${themeSecondary}',
      'cScale2': '${themeAccent}',
      'cScale3': '#10b981',
      'cScale4': '#f59e0b',
      'cScale5': '#ef4444',
      'cScale6': '#8b5cf6',
      'cScale7': '#ec4899',
      'cScale8': '#2db7c6',
      'cScale9': '#6366f1',
      'cScale10': '#f43f5e',
      'cScale11': '#84cc16',
      'cScaleLabel0': '#ffffff',
      'cScaleLabel1': '#ffffff',
      'cScaleLabel2': '#ffffff'
    }
  }
}%%
`;
          // Só injeta se não tiver um bloco de init já definido
          if (!processedChartCode.includes("%%{")) {
            processedChartCode = initBlock + processedChartCode;
          }
        }
        
        const { svg } = await mermaid.render(uniqueId, processedChartCode);

        // Substitui placeholder pelo SVG renderizado
        placeholder.style.padding = "0";
        placeholder.style.border = "none";
        placeholder.style.background = "transparent";
        placeholder.style.textAlign = "center";
        placeholder.style.display = "block";
        placeholder.classList.add("chat-mermaid-rendered");
        placeholder.classList.remove("chat-mermaid-placeholder");
        placeholder.dataset.chart = chartCode; // Guarda o código original para re-render
        placeholder.innerHTML = svg;

        // Garante que o SVG se adapte ao container
        const svgEl = placeholder.querySelector("svg");
        if (svgEl) {
          svgEl.style.maxWidth = "100%";
          svgEl.style.height = "auto";
          svgEl.style.borderRadius = "12px";
          svgEl.style.filter = "drop-shadow(0 10px 30px rgba(0,0,0,0.15))";
        }
      } catch (err) {
        console.error("[Hydration] Erro ao renderizar Mermaid:", err);
        // Fallback: mostra o código bruto em um bloco de código
        placeholder.style.textAlign = "left";
        placeholder.innerHTML = `<pre style="background:var(--color-surface); padding:12px; border-radius:8px; overflow-x:auto; font-size:0.85em; color:var(--color-text-secondary); border: 1px solid var(--color-border);"><code>${chartCode.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></pre>
        <div style="color:var(--color-text-secondary); font-size:0.75em; margin-top:4px;">⚠️ Não foi possível renderizar o diagrama</div>`;
      }
    },
  );

  await Promise.all([...hydrationPromises, ...imagePromises, ...mermaidPromises]);
  
  // 6. Fontes/Sources (Resolução automática e batched)
  await hydrateSources(container);
}

/**
 * Resolve links de fontes em lotes para evitar sobrecarga e atualizar a UI dinamicamente
 */
export async function hydrateSources(container) {
  // 1. Resolve Cards se estiverem visíveis (ex: no modal)
  const sourceCards = container.querySelectorAll(".source-card-premium.resolving");
  
  // 2. Se não houver cards, mas houver dados de fontes, resolve em background
  const sourcesContainer = container.querySelector(".chat-sources-container");
  const sourcesDataAttr = sourcesContainer?.dataset?.sources;
  
  if (sourceCards.length === 0 && !sourcesDataAttr) return;

  const { resolveLinkOnDemand } = await import("../api/worker.js");
  const BATCH_SIZE = 3; // Reduzido pra evitar rate limit do microlink
  const BATCH_DELAY = 1500; // Delay entre batches (ms)

  if (sourceCards.length > 0) {
    const cardsArray = Array.from(sourceCards);
    for (let i = 0; i < cardsArray.length; i += BATCH_SIZE) {
      const batch = cardsArray.slice(i, i + BATCH_SIZE);
      
      // Delay entre batches (não no primeiro)
      if (i > 0) await new Promise(r => setTimeout(r, BATCH_DELAY));
      
      await Promise.all(batch.map(async (card) => {
        const uri = card.dataset.uri;
        if (!uri) { card.classList.remove("resolving"); return; }
        try {
          // 1. Resolve link via worker (cleans redirects)
          const resolved = await resolveLinkOnDemand(uri);
          const finalUrl = (typeof resolved === "object" && resolved?.resolved) ? resolved.resolved : (typeof resolved === "string" ? resolved : uri);

          // 2. Fetch OG metadata from microlink (optional, handles 429 gracefully)
          let ogTitle = null, ogDesc = null, ogLogo = null;
          try {
            const mlRes = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(finalUrl)}`);
            if (mlRes.ok) {
              const mlData = await mlRes.json();
              if (mlData.status === "success" && mlData.data) {
                ogTitle = mlData.data.title;
                ogDesc = mlData.data.description;
                ogLogo = mlData.data.logo?.url || null;
              }
            } else if (mlRes.status === 429) {
              console.warn("[Hydration] ⚠️ Microlink rate limit (429). Skipping enrichment.");
            }
            // Qualquer outro status: silenciosamente ignora
          } catch (_) { /* microlink is optional, never blocks */ }

          // 3. Update card UI (SEMPRE finaliza, com ou sem microlink)
          card.classList.remove("resolving");
          const titleEl = card.querySelector(".source-card-title");
          const descEl = card.querySelector(".source-card-description");
          const hostEl = card.querySelector(".source-card-hostname");
          const thumbImg = card.querySelector(".source-card-thumb-img");
          const faviconImg = card.querySelector(".source-card-favicon");
          
          if (titleEl && ogTitle) titleEl.textContent = ogTitle;
          if (descEl && ogDesc) descEl.textContent = ogDesc;
          
          // Update small favicon with the REAL one from the site
          if (faviconImg && ogLogo) {
            faviconImg.src = ogLogo;
            faviconImg.style.display = "";
          }
          
          // Update hostname from resolved URL
          try {
            const resolvedHostname = new URL(finalUrl).hostname;
            if (hostEl) hostEl.textContent = resolvedHostname;
          } catch (_) {}

          // Enliven thumbnail
          if (thumbImg) {
            thumbImg.style.filter = "brightness(0.92) saturate(1.1)";
            thumbImg.style.opacity = "1";
          }
          
          card.onclick = () => window.open(finalUrl, "_blank");
        } catch (err) {
          console.warn("[Hydration] Source resolve failed:", uri, err);
          card.classList.remove("resolving");
        }
      }));
    }
  } else if (sourcesDataAttr) {
    // Resolução em Background + Atualização dos Favicons no Footer Compacto
    try {
      const sources = JSON.parse(decodeURIComponent(sourcesDataAttr));
      
      // Encontrar os favicon imgs do footer compacto (stacked icons)
      const compactFooter = sourcesContainer.closest(".chat-sources-container")
        ?.querySelector(".chat-sources-stacked-favicons");
      const stackedIcons = compactFooter 
        ? Array.from(compactFooter.querySelectorAll(".chat-source-stacked-icon"))
        : [];
      
      for (let i = 0; i < sources.length; i += BATCH_SIZE) {
        if (i > 0) await new Promise(r => setTimeout(r, BATCH_DELAY));
        const batch = sources.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (s, batchIdx) => {
          const globalIdx = i + batchIdx;
          try {
            const resolved = await resolveLinkOnDemand(s.uri);
            const finalUrl = (typeof resolved === "object" && resolved?.resolved) 
              ? resolved.resolved 
              : (typeof resolved === "string" ? resolved : s.uri);
            
            // Atualizar o favicon correspondente no footer (primeiros 3)
            if (globalIdx < 3 && stackedIcons[globalIdx]) {
              try {
                const realHostname = new URL(finalUrl).hostname;
                const icon = stackedIcons[globalIdx];
                // Usar DuckDuckGo pro hostname REAL (não o vertex)
                icon.src = `https://icons.duckduckgo.com/ip3/${realHostname}.ico`;
                icon.onerror = function() {
                  this.src = `https://www.google.com/s2/favicons?domain=${realHostname}&sz=64`;
                  this.onerror = () => { this.parentElement.style.display = 'none'; };
                };
                // Garantir que está visível
                icon.parentElement.style.display = '';
              } catch (_) {}
            }
          } catch (_) {}
        }));
      }
    } catch (e) {}
  }
}
