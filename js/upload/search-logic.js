// --- CONFIG ---
const PROD_WORKER_URL =
  import.meta.env.VITE_WORKER_URL || "https://your-worker.workers.dev";

// Importa o visualizador
import { gerarVisualizadorPDF } from "../viewer/events.js";
import { TerminalUI } from "./terminal-ui.js";

// --- STATE ---
let currentSlug = null;
let currentManifest = null;
let selectedItems = {
  prova: null, // { name, url, file (blob) }
  gabarito: null,
};
// Connection State
let activePusher = null;
let activeChannel = null;
let activeWebSocket = null;

export function setupSearchLogic() {
  const btnSearch = document.getElementById("btnSearch");
  const searchInput = document.getElementById("searchInput");
  const searchResults = document.getElementById("searchResults");
  const btnShowUpload = document.getElementById("btnShowUpload");
  const btnBackToSearch = document.getElementById("btnBackToSearch");

  const searchContainer = document.getElementById("searchContainer");
  const manualUploadContainer = document.getElementById(
    "manualUploadContainer"
  );

  // --- Toggles de Interface ---
  if (btnShowUpload) {
    btnShowUpload.addEventListener("click", () => {
      searchContainer.classList.add("hidden");
      searchContainer.style.display = "none";
      manualUploadContainer.classList.remove("hidden");
      manualUploadContainer.style.display = "flex";
      manualUploadContainer.classList.add("fade-in-centralized");
    });
  }

  if (btnBackToSearch) {
    btnBackToSearch.addEventListener("click", () => {
      manualUploadContainer.classList.add("hidden");
      manualUploadContainer.style.display = "none";
      searchContainer.classList.remove("hidden");
      searchContainer.style.display = "flex";
      searchContainer.classList.add("fade-in-centralized");
    });
  }

  // --- Disclaimer Modal Logic ---
  const btnDisclaimerInfo = document.getElementById("btnDisclaimerInfo");
  const disclaimerModal = document.getElementById("disclaimerModal");
  const btnCloseDisclaimer = document.getElementById("btnCloseDisclaimer");

  if (btnDisclaimerInfo && disclaimerModal) {
    btnDisclaimerInfo.addEventListener("click", () => {
      disclaimerModal.style.display = "flex";
    });

    if (btnCloseDisclaimer) {
      btnCloseDisclaimer.addEventListener("click", () => {
        disclaimerModal.style.display = "none";
      });
    }

    disclaimerModal.addEventListener("click", (e) => {
      if (e.target === disclaimerModal) disclaimerModal.style.display = "none";
    });
  }

  // --- Deep Search Lógica ---
  const doSearch = async (force = false, cleanup = false) => {
    const query = searchInput.value.trim();
    if (!query) return;

    // Reset Connections
    if (activeWebSocket) {
      activeWebSocket.close();
      activeWebSocket = null;
    }
    if (activeChannel) {
      activeChannel.unbind_all();
      // Unsubscribe using the previous slug if possible, or just disconnect pusher entirely
      if (activePusher && currentSlug) activePusher.unsubscribe(currentSlug);
      activeChannel = null;
    }
    if (activePusher) {
      activePusher.disconnect();
      activePusher = null;
    }

    // Limpa UI e Estado
    searchResults.innerHTML = "";
    selectedItems = { prova: null, gabarito: null };
    currentSlug = null;
    let isSuccess = false; // Track success for retry warning

    // 1. Cria Console UI (Terminal Style)
    const consoleContainer = document.createElement("div");
    consoleContainer.id = "deep-search-terminal";
    searchResults.appendChild(consoleContainer);

    // Instantiate State Machine UI
    const terminal = new TerminalUI("deep-search-terminal");

    // Retry Handler
    terminal.onRetry = () => {
      const proceed = () => {
        log("Reiniciando processo...", "warning");
        doSearch(true, true); // Force + Cleanup
      };

      if (isSuccess) {
        // Modal Warning
        // We can use a custom modal or standard confirm for simplicity as per request "aviso num modal"
        // Since we don't have a custom modal ready for this generic content, confirm is safest
        // or we build a small overlay? User said "modal".
        // Let's use confirm() which is a "modal dialog" in browser terms, or create a quick custom one?
        // "modal dizendo que ao tentar novamente tudo vai ser excluído"
        if (
          confirm(
            "ATENÇÃO: A pesquisa anterior foi concluída com sucesso.\n\nAo tentar novamente, os resultados salvos (Hugging Face e Pinecone) serão EXCLUÍDOS PERMANENTEMENTE para permitir uma nova busca limpa.\n\nDeseja continuar?"
          )
        ) {
          proceed();
        }
      } else {
        // Failed/Cancelled -> No warning needed
        proceed();
      }
    };

    // Helper for action button (legacy support or extra feature)
    const updateActionButton = (url) => {
      // Optional: Add logging/button logic here if needed,
      // but TerminalUI handles most UI now.
      // We could inject a button into the terminal header if we really want.
      // For now, we trust TerminalUI's own finish state or simple logging.
    };

    let actionButton = null;

    const log = (text, type = "info") => {
      // Pass to Terminal UI Processor
      terminal.processLogLine(text, type);

      // Check for Log URL with explicit tag (keep legacy hook just in case)
      const tagMatch = text.match(/\[GITHUB_LOGS\]\s*(https?:\/\/[^\s]+)/);
      if (tagMatch && tagMatch[1]) {
        updateActionButton(tagMatch[1]);
      }
    };

    log("Iniciando Pesquisa Avançada...", "info");

    const slug = query
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    currentSlug = slug;

    // Pusher Config
    const pusherKey = "6c9754ef715796096116"; // Public Key
    const pusherCluster = "sa1";

    // --- EXECUÇÃO ---
    try {
      log(`Modo Produção. Conectando via Pusher (Canal: ${slug})...`);

      // Import Pusher dynamically or assume it's loaded via <script> or import
      // For module compatibility, let's try to use the imported one if available,
      // or rely on window.Pusher if strictly vanilla.
      let PusherClass = window.Pusher;
      if (!PusherClass) {
        const module = await import("pusher-js");
        PusherClass = module.default;
      }

      activePusher = new PusherClass(pusherKey, {
        cluster: pusherCluster,
      });

      activeChannel = activePusher.subscribe(slug);

      activeChannel.bind("log", function (data) {
        if (!data) return;
        // data.message is the string from bash usually, but let's be safe
        const text =
          data.message ||
          (typeof data === "string" ? data : JSON.stringify(data));
        if (!text) return;

        if (text.includes("COMPLETED")) {
          // Explicitly tell terminal to finish with retry button enabled (New Search Success)
          if (terminal) terminal.finish(true);
          isSuccess = true; // Mark as success for retry logic

          log(
            "Fluxo de Trabalho Concluído! Aguardando propagação (5s)...",
            "success"
          );
          activePusher.unsubscribe(slug);

          const finalSlug = data.new_slug || slug;
          currentSlug = finalSlug;

          setTimeout(() => {
            // Fetch from HUGGING FACE now
            const hfBase =
              "https://huggingface.co/datasets/toquereflexo/maia-deep-search/resolve/main";
            loadResults(`${hfBase}/output/${finalSlug}/manifest.json`);
          }, 5000);
        } else {
          log(text);
        }
      });

      const response = await fetch(`${PROD_WORKER_URL}/trigger-deep-search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          slug,
          force,
          cleanup, // Pass cleanup flag
          ntfy_topic: "deprecated", // Legacy param
          apiKey: sessionStorage.getItem("GOOGLE_GENAI_API_KEY"),
        }),
      });

      const result = await response.json();

      // Debug Log for Pinecone
      if (result.debug_matches) {
        log(`[DEBUG] Correspondências Pinecone encontradas (Top 5):`, "info");
        result.debug_matches.forEach((m) => {
          log(
            ` - ${m.metadata.slug || "slug?"} (Score: ${m.score.toFixed(4)})`,
            "info"
          );
        });
      }

      if (result.candidates) {
        log("Encontradas pesquisas similares no histórico.", "success");
        showCandidatesModal(
          result.candidates,
          query,
          (candidate) => {
            log(`Carregando cache: ${candidate.slug}...`, "success");
            currentSlug = candidate.slug;
            isSuccess = true; // Cache hit is also a success

            // Visual feedback: Update task list to show we are loading cache
            if (terminal) {
              terminal.updatePlan([
                {
                  title: `Recuperando dados de: ${candidate.slug}`,
                  status: "completed",
                },
              ]);
              terminal.finish(false); // Hide retry button for cache hits
            }

            const hfBase =
              "https://huggingface.co/datasets/toquereflexo/maia-deep-search/resolve/main";
            loadResults(`${hfBase}/output/${candidate.slug}/manifest.json`);
          },
          () => {
            log("Forçando nova pesquisa...", "warning");
            doSearch(true);
          }
        );
        activePusher.unsubscribe(slug); // Stop listening to this channel for now
        return;
      }

      if (result.cached && result.slug) {
        log("Resultado idêntico encontrado em cache! Carregando...", "success");
        if (terminal) terminal.finish(false);
        activePusher.unsubscribe(slug);
        isSuccess = true; // Cache hit
        loadResults(
          `https://huggingface.co/datasets/toquereflexo/maia-deep-search/resolve/main/output/${result.slug}/manifest.json`
        );
        return;
      }
    } catch (e) {
      log(`Erro Fatal: ${e.message}`, "error");
    }
  };

  // --- UI RENDER ---
  const loadResults = async (manifestUrl) => {
    try {
      let loadingAttempts = 0;
      let manifest = null;
      while (loadingAttempts < 10 && !manifest) {
        // 10 attempts (20s) for HF caching/propagation
        try {
          console.log(
            `[SearchLogic] Tentando carregar manifesto: ${manifestUrl} (Tentativa ${loadingAttempts + 1})`
          );
          const r = await fetch(manifestUrl);
          if (r.ok) {
            manifest = await r.json();
            console.log("[SearchLogic] Manifesto carregado com sucesso.");
            break;
          } else {
            console.warn(
              `[SearchLogic] Falha ao carregar manifesto. Status: ${r.status} ${r.statusText}`
            );
          }
        } catch (e) {
          console.error(`[SearchLogic] Erro ao carregar manifesto:`, e);
        }
        loadingAttempts++;
        await new Promise((res) => setTimeout(res, 2000));
      }
      if (!manifest)
        throw new Error(
          "Manifesto não encontrado no Hugging Face. Verifique os logs do GitHub Actions para erros de upload."
        );
      currentManifest = manifest; // Save for later usage
      renderResultsNewUI(manifest);
    } catch (e) {
      if (typeof log === "function") {
        log(`Erro ao carregar resultados: ${e.message}`, "error");
      }
    }
  };

  const renderResultsNewUI = async (manifest) => {
    console.log("Renderizando Manifesto:", manifest); // Debug Log

    // Fix: Validar tanto .results quanto .files
    const lista =
      manifest.results ||
      manifest.files ||
      (Array.isArray(manifest) ? manifest : []);

    // Container Principal
    const container = document.createElement("div");
    container.className = "results-container fade-in-centralized";
    container.style.marginTop = "32px";
    container.style.maxWidth = "1200px";
    container.style.marginLeft = "auto";
    container.style.marginRight = "auto";
    container.style.width = "100%";

    // Header de Ação
    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.justifyContent = "space-between";
    header.style.alignItems = "center";
    header.style.marginBottom = "24px";

    header.innerHTML = `
      <h2 style="color:var(--color-text); font-weight:var(--font-weight-bold); font-size:var(--font-size-2xl);">
        Resultados Encontrados (${lista.length})
      </h2>
      <button id="btnExtractSelection" disabled style="
        background: var(--color-primary); 
        color: var(--color-btn-primary-text); 
        border: none; 
        padding: 10px 24px; 
        border-radius: var(--radius-base); 
        cursor: pointer; 
        font-weight: var(--font-weight-medium); 
        opacity: 0.5; 
        transition: all var(--duration-normal);
        display: flex; align-items: center; gap: 8px;">
        <span>Extrair Selecionados</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      </button>
    `;
    container.appendChild(header);

    // Grid Repaginado
    const grid = document.createElement("div");
    grid.style.display = "grid";
    // Mobile first: 1 col, md: 2 cols, lg: 3 cols
    grid.style.gridTemplateColumns = "repeat(auto-fill, minmax(320px, 1fr))";
    grid.style.gap = "24px";

    container.appendChild(grid);
    searchResults.appendChild(container);

    // Filter Items Logic
    const items = lista;
    if (!items || items.length === 0) {
      searchResults.innerHTML =
        '<div style="text-align:center; padding: 20px;">0 resultados encontrados (manifesto vazio)</div>';
      return;
    }

    // Show loading for verification
    const loadingDiv = document.createElement("div");
    loadingDiv.innerHTML = "Verificando integridade dos arquivos...";
    loadingDiv.style.textAlign = "center";
    loadingDiv.style.padding = "20px";
    loadingDiv.style.color = "#888";
    container.appendChild(loadingDiv);

    // Listas separadas
    const validItems = [];
    const referenceItems = [];

    // Helper to resolve URL for verification
    const resolveUrl = (item) => {
      let finalUrl = item.path || item.url;
      if (!finalUrl) return "#";
      if (!finalUrl.startsWith("http")) {
        const cleanPath = finalUrl.startsWith("/")
          ? finalUrl.slice(1)
          : finalUrl;
        const prefix = `output/${currentSlug}`; // Uses globally captured currentSlug
        finalUrl = `https://huggingface.co/datasets/toquereflexo/maia-deep-search/resolve/main/${prefix}/${cleanPath}`;
      }
      return finalUrl;
    };

    // Parallel verification
    await Promise.all(
      items.map(async (item) => {
        // Normalization (Enhanced for robust key handling)
        if (!item.name && item.nome) item.name = item.nome;
        if (!item.name && item.titulo) item.name = item.titulo;
        if (!item.name && item.nome_amigavel) item.name = item.nome_amigavel;
        if (!item.name && item.description) item.name = item.description;
        if (!item.name && item.friendly_name) item.name = item.friendly_name;

        if (!item.path && item.arquivo_local) {
          if (!item.arquivo_local.startsWith("files/"))
            item.path = `files/${item.arquivo_local}`;
          else item.path = item.arquivo_local;
        }
        if (!item.path && item.filename) {
          // Ensure path is files/filename
          if (
            !item.filename.startsWith("files/") &&
            !item.path?.startsWith("files/")
          ) {
            item.path = `files/${item.filename}`;
          } else if (item.filename) {
            item.path = item.filename;
          }
        }

        if (!item.url && item.link_origem) item.url = item.link_origem;
        if (!item.url && item.link) item.url = item.link;
        if (!item.url && item.link_direto) item.url = item.link_direto;
        if (!item.url && item.direct_link) item.url = item.direct_link;

        if (!item.tipo && item.type) item.tipo = item.type;

        // Status Check (from Agent)
        const status = item.status || "unknown"; // "downloaded" or "reference"
        const fullUrl = resolveUrl(item);

        // If explicitly "reference", skip verification and add to refs
        if (status === "reference") {
          referenceItems.push({ ...item, url: item.url || fullUrl });
          return;
        }

        // Verify potentially valid local file
        const isValid = await verifyPdfResource(fullUrl);

        if (isValid) {
          validItems.push(item);
        } else {
          console.warn(
            `[SearchLogic] Item ignorado (inválido/corrompido): ${item.name} - ${fullUrl}`
          );
          // If verification fails but we have a link, treat as reference
          referenceItems.push({ ...item, url: item.url || fullUrl });
        }
      })
    );

    // Remove loading
    loadingDiv.remove();

    // Update count
    header.querySelector("h2").innerText =
      `Arquivos Baixados (${validItems.length})`;

    if (validItems.length === 0 && referenceItems.length === 0) {
      searchResults.innerHTML +=
        '<div style="text-align:center; padding: 20px; color: orangered;">Nenhum resultado encontrado.</div>';
      return;
    }

    // Render Cards (Valid items)
    validItems.forEach((item) => {
      const card = createCard(item);
      grid.appendChild(card);
    });

    // Render Reference List
    if (referenceItems.length > 0) {
      const refContainer = document.createElement("div");
      refContainer.className = "references-container fade-in-centralized";
      refContainer.style.marginTop = "40px";
      refContainer.style.marginBottom = "40px";
      refContainer.style.width = "100%";
      refContainer.style.borderTop = "1px solid var(--color-border)";
      refContainer.style.paddingTop = "24px";

      // Disclaimer Banner for References
      const warningBanner = document.createElement("div");
      Object.assign(warningBanner.style, {
        backgroundColor: "rgba(255, 152, 0, 0.1)",
        border: "1px solid rgba(255, 152, 0, 0.3)",
        borderRadius: "8px",
        padding: "16px",
        marginBottom: "24px",
        display: "flex",
        gap: "12px",
        alignItems: "flex-start",
      });
      warningBanner.innerHTML = `
          <div style="color:var(--color-warning); margin-top:2px;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <div>
              <h4 style="margin:0 0 4px 0; color:var(--color-text); font-size:0.95rem;">Links não processados automaticamente</h4>
              <p style="margin:0; font-size:0.85rem; color:var(--color-text-secondary); line-height:1.4;">
                  Estes links podem conter o material que você procura, mas não puderam ser verificados ou baixados automaticamente. 
                  Você pode acessá-los manualmente e, se encontrar o arquivo correto, fazer o <strong>Upload Manual</strong> abaixo.
              </p>
          </div>
      `;
      refContainer.appendChild(warningBanner);

      const refTitle = document.createElement("h3");
      refTitle.innerText = `Outros Links Encontrados (${referenceItems.length})`;
      refTitle.style.fontSize = "1.1rem";
      refTitle.style.fontWeight = "600";
      refTitle.style.marginBottom = "16px";
      refTitle.style.color = "var(--color-text)";
      refContainer.appendChild(refTitle);

      const list = document.createElement("div");
      list.style.display = "flex";
      list.style.flexDirection = "column";
      list.style.gap = "12px";

      referenceItems.forEach((ref) => {
        const row = document.createElement("div");
        row.style.display = "flex";
        row.style.alignItems = "center";
        row.style.gap = "12px";
        row.style.padding = "12px";
        row.style.backgroundColor = "var(--color-surface)";
        row.style.border = "1px solid var(--color-border)";
        row.style.borderRadius = "8px";

        const isRef = ref.status === "reference" || !ref.status;
        const statusLabel = isRef ? "Link Externo" : "Falha Download";

        row.innerHTML = `
                <div style="width:32px; height:32px; border-radius:50%; background:var(--color-bg-1); display:flex; align-items:center; justify-content:center; color:var(--color-text-secondary);">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                </div>
                <div style="flex:1;">
                    <a href="${ref.url}" target="_blank" style="color:var(--color-primary); text-decoration:none; font-weight:500; display:block; margin-bottom:2px;">
                        ${ref.name || "Documento sem nome"}
                    </a>
                    <div style="font-size:0.8rem; color:var(--color-text-secondary); display:flex; gap:8px; align-items:center;">
                        <span style="background:var(--color-bg-1); padding:2px 6px; border-radius:4px; font-size:0.7rem;">${(ref.tipo || "Desconhecido").toUpperCase()}</span>
                        <span>${ref.ano || ""}</span>
                        <span style="color:${isRef ? "var(--color-text-secondary)" : "var(--color-warning)"}">${statusLabel}</span>
                    </div>
                </div>
                <a href="${ref.url}" target="_blank" class="btn btn--sm btn--outline" style="min-width:auto; padding:6px 12px; font-size:0.8rem;">
                    Acessar
                </a>
            `;
        list.appendChild(row);
      });

      refContainer.appendChild(list);
      container.appendChild(refContainer);
    }

    document.getElementById("btnExtractSelection").onclick = showRenameModal;
  };

  const verifyPdfResource = async (url) => {
    try {
      // Allow relative paths in dev/prod
      const fetchUrl = url.startsWith("http") ? url : url;
      const method = "HEAD";

      const response = await fetch(fetchUrl, { method });

      if (!response.ok) return false;

      const type = response.headers.get("Content-Type");
      const length = response.headers.get("Content-Length");

      // Basic checks
      if (
        type &&
        !type.toLowerCase().includes("pdf") &&
        !type.includes("application/octet-stream")
      ) {
        // If it's explicitly text/html, it's bad
        if (type.includes("text/html")) return false;
      }

      if (length && parseInt(length) < 1000) {
        // < 1KB is suspicious for a PDF
        return false;
      }

      return true;
    } catch (e) {
      console.warn("Verification failed for", url, e);
      // If we can't check, we might assume it's okay or bad. Let's assume bad to be safe?
      // Or maybe permissive if it's CORS issue?
      // For local runner, CORS should be fine.
      return false;
    }
  };

  const createCard = (item) => {
    let finalUrl = item.path || item.url;

    // Safety check just in case
    if (!finalUrl) {
      console.warn("Item sem URL ou Path:", item);
      finalUrl = "#";
    }

    if (!finalUrl.startsWith("http")) {
      const cleanPath = finalUrl.startsWith("/") ? finalUrl.slice(1) : finalUrl;
      // Ensure we point to the correct output folder
      const prefix = `output/${currentSlug}`;

      finalUrl = `https://huggingface.co/datasets/toquereflexo/maia-deep-search/resolve/main/${prefix}/${cleanPath}`;
    }

    // --- Title Fallback Logic ---
    let displayTitle =
      item.name || item.nome_amigavel || item.description || item.friendly_name;

    if (!displayTitle || displayTitle.trim() === "") {
      // Fallback: Use filename
      let fileBase = (item.filename || item.path || "").split("/").pop(); // Get basename
      if (fileBase) {
        // Remove extension
        fileBase = fileBase.replace(/\.pdf$/i, "");
        // Replace underscores/hyphens with spaces
        displayTitle = fileBase.replace(/[_-]/g, " ");
        // Capitalize first letters
        displayTitle = displayTitle.replace(/\b\w/g, (l) => l.toUpperCase());
      } else {
        displayTitle = "Sem Título";
      }
    }

    const card = document.createElement("div");
    card.className = "result-card";
    card.setAttribute(
      "data-type",
      item.tipo?.toLowerCase().includes("gabarito") ? "gabarito" : "prova"
    );

    // Estilos do Card
    Object.assign(card.style, {
      position: "relative",
      borderRadius: "var(--radius-lg)",
      overflow: "hidden",
      backgroundColor: "var(--color-surface)",
      border: "1px solid var(--color-card-border)",
      display: "flex",
      flexDirection: "column",
      height: "380px", // Mais altura para visualização
      transition:
        "transform var(--duration-fast), border-color var(--duration-fast), box-shadow var(--duration-fast)",
      cursor: "pointer",
      boxShadow: "var(--shadow-sm)",
    });

    // Hover Effect via JS (já que inline)
    card.onmouseenter = () => {
      card.style.transform = "translateY(-4px)";
      card.style.boxShadow = "var(--shadow-lg)";
    };
    card.onmouseleave = () => {
      card.style.transform = "translateY(0)";
      card.style.boxShadow = "var(--shadow-sm)";
    };

    // Thumbnail
    const thumbContainer = document.createElement("div");
    Object.assign(thumbContainer.style, {
      height: "220px", // Fixo para uniformidade
      width: "100%",
      position: "relative",
      backgroundColor: "var(--color-background)",
      overflow: "hidden",
      borderBottom: "1px solid var(--color-border)",
    });

    const canvas = document.createElement("canvas");
    canvas.style.width = "100%";
    canvas.style.objectFit = "contain";
    thumbContainer.appendChild(canvas);

    // --- Lazy Load Thumbnail (Global Optimized) ---
    registerPdfThumbnail(finalUrl, canvas);

    // Badge
    const typeLabel = (item.tipo || "Arquivo").toUpperCase();
    const isGab = typeLabel.includes("GABARITO");
    const badge = document.createElement("span");
    badge.innerText = typeLabel;
    Object.assign(badge.style, {
      position: "absolute",
      top: "12px",
      right: "12px",
      padding: "4px 8px",
      borderRadius: "4px",
      fontSize: "0.7rem",
      fontWeight: "bold",
      backgroundColor: isGab
        ? "rgba(var(--color-warning-rgb), 0.9)"
        : "rgba(var(--color-primary-rgb), 0.9)",
      color: "#fff",
      boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
      backdropFilter: "blur(4px)",
    });
    thumbContainer.appendChild(badge);

    // Content
    const content = document.createElement("div");
    Object.assign(content.style, {
      padding: "20px",
      flex: 1,
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
    });

    const title = document.createElement("h3");
    title.innerText = displayTitle;
    title.title = displayTitle; // Tooltip
    Object.assign(title.style, {
      fontSize: "var(--font-size-md)",
      color: "var(--color-text)",
      fontWeight: "var(--font-weight-medium)",
      margin: "0 0 16px 0",
      lineHeight: "1.5",
      display: "-webkit-box",
      WebkitLineClamp: 3,
      WebkitBoxOrient: "vertical",
      overflow: "hidden",
    });

    const actions = document.createElement("div");
    Object.assign(actions.style, {
      display: "flex",
      alignItems: "center",
      justifyContent: "flex-end",
    });

    // Abrir Button (Secondary style)
    const btnPreview = document.createElement("button");
    btnPreview.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
      Visualizar
    `;
    Object.assign(btnPreview.style, {
      display: "flex",
      alignItems: "center",
      padding: "8px 16px",
      borderRadius: "6px",
      border: "1px solid var(--color-border)",
      background: "transparent",
      color: "var(--color-text-secondary)",
      fontSize: "var(--font-size-sm)",
      cursor: "pointer",
      transition: "background 0.2s",
    });
    btnPreview.onmouseenter = () => {
      btnPreview.style.background = "var(--color-bg-1)";
      btnPreview.style.color = "var(--color-primary)";
    };
    btnPreview.onmouseleave = () => {
      btnPreview.style.background = "transparent";
      btnPreview.style.color = "var(--color-text-secondary)";
    };

    btnPreview.onclick = (e) => {
      e.stopPropagation();
      openPreviewModal(finalUrl, item.name);
    };

    actions.appendChild(btnPreview);
    content.appendChild(title);
    content.appendChild(actions);

    card.appendChild(thumbContainer);
    card.appendChild(content);

    // Overlay de Seleção (Borda + Icon)
    const selectOverlay = document.createElement("div");
    Object.assign(selectOverlay.style, {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(var(--color-primary-rgb), 0.05)",
      border: "2px solid var(--color-primary)",
      borderRadius: "var(--radius-lg)",
      pointerEvents: "none",
      display: "none",
      zIndex: 10,
    });

    // Check Circle
    const checkIcon = document.createElement("div");
    checkIcon.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`;
    Object.assign(checkIcon.style, {
      position: "absolute",
      top: "12px",
      left: "12px", // Esquerda superior
      width: "28px",
      height: "28px",
      backgroundColor: "var(--color-primary)",
      borderRadius: "50%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
    });
    selectOverlay.appendChild(checkIcon);
    card.appendChild(selectOverlay);

    card.onclick = () => toggleSelection(item, card, selectOverlay, finalUrl);

    return card;
  };

  const showCandidatesModal = (
    candidates,
    originalQuery,
    onSelect,
    onForce
  ) => {
    // Create Overlay
    const overlay = document.createElement("div");
    Object.assign(overlay.style, {
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0,0,0,0.8)",
      zIndex: 10000,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backdropFilter: "blur(4px)",
    });

    const modal = document.createElement("div");
    Object.assign(modal.style, {
      backgroundColor: "var(--color-surface)",
      width: "90%",
      maxWidth: "600px",
      borderRadius: "var(--radius-lg)",
      padding: "24px",
      border: "1px solid var(--color-border)",
      boxShadow: "var(--shadow-xl)",
      animation: "fadeIn 0.3s ease",
    });

    modal.innerHTML = `
        <h3 style="margin-top:0; color:var(--color-text);">Pesquisas Similares Encontradas</h3>
        <p style="color:var(--color-text-secondary); font-size:0.9rem;">
            Encontramos resultados parecidos com <strong>"${originalQuery}"</strong>.<br>
            Você pode aproveitar esse conteúdo já processado:
        </p>
        <div id="candidatesList" style="
            margin: 20px 0; 
            max-height: 300px; 
            overflow-y: auto; 
            display: flex; 
            flex-direction: column; 
            gap: 10px;">
        </div>
        <div style="display:flex; justify-content:end; gap:10px; margin-top:20px; border-top:1px solid var(--color-border); padding-top:16px;">
            <button id="btnForceSearch" style="
                background: transparent; 
                border: 1px solid var(--color-border); 
                color: var(--color-text); 
                padding: 8px 16px; 
                border-radius: var(--radius-base); 
                cursor: pointer;">
                Não, fazer nova pesquisa
            </button>
        </div>
      `;

    const list = modal.querySelector("#candidatesList");

    candidates.forEach((cand) => {
      const item = document.createElement("div");
      Object.assign(item.style, {
        padding: "12px",
        border: "1px solid var(--color-border)",
        borderRadius: "8px",
        cursor: "pointer",
        transition: "background 0.2s",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        backgroundColor: "var(--color-bg-sub)",
      });
      item.onmouseover = () =>
        (item.style.backgroundColor = "var(--color-bg-hover)");
      item.onmouseout = () =>
        (item.style.backgroundColor = "var(--color-bg-sub)");

      const formatSlug = (str) => {
        if (!str) return null;
        return str
          .split("-")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ");
      };

      const title = formatSlug(cand.slug) || cand.query;
      const info =
        [cand.institution, cand.year].filter(Boolean).join(" • ") ||
        "Processado recentemente";

      item.innerHTML = `
            <div>
                <div style="font-weight:600; color:var(--color-primary);">${title}</div>
                <div style="font-size:0.8rem; color:var(--color-text-secondary);">${info}</div>
            </div>
            <div style="font-size:0.8rem; background:var(--color-bg-2); padding:4px 8px; borderRadius:4px;">
                ${(cand.score * 100).toFixed(0)}% match
            </div>
          `;

      item.onclick = () => {
        document.body.removeChild(overlay);
        if (onSelect) onSelect(cand);
      };

      list.appendChild(item);
    });

    const btnForce = modal.querySelector("#btnForceSearch");
    btnForce.onclick = () => {
      document.body.removeChild(overlay);
      if (onForce) onForce();
    };

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  };

  const toggleSelection = (item, cardEl, overlayEl, url) => {
    const type = item.tipo?.toLowerCase().includes("gabarito")
      ? "gabarito"
      : "prova";

    // Verificação de estado atual
    const isCurrentlySelected =
      selectedItems[type] && selectedItems[type].url === url;

    // Seleciona todos os cards do mesmo tipo para manipular
    const allCardsOfTheSameType = document.querySelectorAll(
      `.result-card[data-type="${type}"]`
    );

    if (isCurrentlySelected) {
      // --- AÇÃO DE DESELECIONAR ---
      selectedItems[type] = null;

      // Reset Visuals para ESTE card
      overlayEl.style.display = "none";
      cardEl.style.borderColor = "var(--color-card-border)";
      cardEl.style.transform = "none"; // Reset scale/transform se tiver

      // REABILITAR todos os outros cards
      allCardsOfTheSameType.forEach((c) => {
        if (c !== cardEl) {
          c.style.opacity = "1";
          c.style.pointerEvents = "auto";
          c.style.filter = "none";
          c.style.cursor = "pointer";
        }
      });
    } else {
      // --- AÇÃO DE SELECIONAR ---

      // Se já existe um selecionado desse tipo (e não é este, pois caíria no if acima),
      // em teoria não deveríamos conseguir clicar aqui por causa do bloqueo de UI.
      // Mas se acontecer, ignoramos ou retornamos.
      if (selectedItems[type]) return;

      selectedItems[type] = { ...item, url, el: cardEl };

      // Highlight ESTE card
      overlayEl.style.display = "block";
      cardEl.style.borderColor = "var(--color-primary)";

      // DESABILITAR todos os outros cards
      allCardsOfTheSameType.forEach((c) => {
        if (c !== cardEl) {
          c.style.opacity = "0.3"; // Bem apagado
          c.style.pointerEvents = "none"; // Impede cliques
          c.style.filter = "grayscale(100%)"; // Preto e branco
          c.style.cursor = "not-allowed";
        }
      });
    }

    // Atualiza estado do botão de extração
    const btn = document.getElementById("btnExtractSelection");
    const hasSelection = selectedItems.prova || selectedItems.gabarito;

    if (hasSelection) {
      btn.disabled = false;
      btn.style.opacity = "1";
      btn.style.cursor = "pointer";
    } else {
      btn.disabled = true;
      btn.style.opacity = "0.5";
      btn.style.cursor = "not-allowed";
    }
  };

  // --- Advanced PDF Thumbnail Logic (Cancellation + Retina) ---
  const activeRenders = new Map();
  const TARGET_HEIGHT = 300;
  const PIXEL_RATIO = window.devicePixelRatio || 1;

  const renderThumbnail = async (url, canvas) => {
    if (!url || !canvas) return;

    // Se já estiver renderizando neste canvas, cancela o anterior
    if (activeRenders.has(canvas)) {
      try {
        await activeRenders.get(canvas).cancel();
      } catch (e) {
        // RenderingCancelledException é esperado
      }
    }

    try {
      if (!window.pdfjsLib) return;
      if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      }

      const loadingTask = pdfjsLib.getDocument(url);
      const pdf = await loadingTask.promise;
      const page = await pdf.getPage(1);

      // --- CÁLCULO DE ESCALA OTIMIZADO (COVER + RETINA) ---
      const initialViewport = page.getViewport({ scale: 1 });

      // Dimensões do container (ou fallback)
      const container = canvas.parentElement;
      const containerWidth = container ? container.clientWidth : 300;
      const containerHeight = container ? container.clientHeight : 220;

      // Calcula scale para cobrir (Math.max) ambas as dimensões
      const scaleW = containerWidth / initialViewport.width;
      const scaleH = containerHeight / initialViewport.height;
      const scale = Math.max(scaleW, scaleH) * PIXEL_RATIO;

      const viewport = page.getViewport({ scale });

      // Tamanho físico (alta resolução)
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      // Tamanho visual (CSS) para preencher container com crop
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.objectFit = "cover";
      canvas.style.objectPosition = "top center"; // Mostra o topo do documento

      const ctx = canvas.getContext("2d", { alpha: false });
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const renderTask = page.render({
        canvasContext: ctx,
        viewport: viewport,
      });

      activeRenders.set(canvas, renderTask);

      await renderTask.promise;

      // Marca como carregado para não renderizar novamente
      canvas.dataset.loaded = "true";
      activeRenders.delete(canvas);
    } catch (e) {
      if (e.name === "RenderingCancelledException") return;
      console.warn("Erro no thumbnail:", e);
      renderFallback(canvas);
    }
  };

  const renderFallback = (canvas) => {
    const ctx = canvas.getContext("2d");
    if (canvas.width === 0 || canvas.width === 300) {
      canvas.width = 210;
      canvas.height = 297;
    }
    ctx.fillStyle = "#f5f5f5";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#999";
    ctx.font = "bold 20px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("PDF", canvas.width / 2, canvas.height / 2);

    // Marca como carregado (com erro) para não tentar de novo infinitamente
    canvas.dataset.loaded = "true";
  };

  // Global Observer para gerenciar visibilidade e cancelamento
  const thumbnailObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const canvas = entry.target;
        const url = canvas.dataset.pdfUrl;

        if (entry.isIntersecting) {
          // Se já carregou, ignora
          if (canvas.dataset.loaded === "true") return;
          renderThumbnail(url, canvas);
        } else {
          // Saiu da tela: Cancelar renderização pesada
          if (activeRenders.has(canvas)) {
            activeRenders.get(canvas).cancel();
            activeRenders.delete(canvas);
          }
        }
      });
    },
    { rootMargin: "200px", threshold: 0.1 }
  );

  const registerPdfThumbnail = (url, canvas) => {
    canvas.dataset.pdfUrl = url;
    thumbnailObserver.observe(canvas);
  };

  const openPreviewModal = (url, title) => {
    const existing = document.getElementById("previewModal");
    if (existing) existing.remove();

    const modal = document.createElement("div");
    modal.id = "previewModal";
    Object.assign(modal.style, {
      position: "fixed",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      backgroundColor: "rgba(0,0,0,0.6)", // Backdrop blur leve
      backdropFilter: "blur(4px)",
      zIndex: 9999,
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      padding: "20px",
    });

    const isDarkMode =
      document.documentElement.getAttribute("data-color-scheme") === "dark"; // Check simples

    modal.innerHTML = `
        <div style="
            width: 100%; max-width: 1000px; height: 85vh; 
            background: var(--color-surface); 
            border-radius: var(--radius-lg); 
            box-shadow: var(--shadow-lg);
            display: flex; flex-direction: column; overflow: hidden;
            border: 1px solid var(--color-border);
        ">
            <header style="
                padding: 16px 24px; 
                border-bottom: 1px solid var(--color-border); 
                display: flex; justify-content: space-between; align-items: center;
                background: var(--color-background);
            ">
                <div style="display:flex; align-items:center; gap:12px;">
                    <span style="font-size:1.5rem;">📄</span>
                    <div>
                        <h3 style="margin:0; font-size:var(--font-size-md); color:var(--color-text); font-weight:var(--font-weight-bold);">${title}</h3>
                        <span style="font-size:var(--font-size-sm); color:var(--color-text-secondary);">Visualização Prévia</span>
                    </div>
                </div>
                <button id="btnCloseModal" style="
                    background: transparent; border: none; 
                    color: var(--color-text-secondary); 
                    cursor: pointer; padding: 8px; border-radius: 50%;
                    transition: background 0.2s;
                    display: flex; align-items: center; justify-content: center;
                ">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </header>
            <div style="flex: 1; background: #525659; position: relative;">
                <iframe src="${url}#toolbar=0&navpanes=0" style="width:100%; height:100%; border:none;"></iframe>
            </div>
        </div>
      `;

    document.body.appendChild(modal);

    const btnClose = document.getElementById("btnCloseModal");
    btnClose.onmouseenter = () =>
      (btnClose.style.backgroundColor = "var(--color-bg-1)");
    btnClose.onmouseleave = () =>
      (btnClose.style.backgroundColor = "transparent");
    btnClose.onclick = () => modal.remove();

    // Fecha ao clicar fora
    modal.onclick = (e) => {
      if (e.target === modal) modal.remove();
    };
  };

  const showRenameModal = () => {
    const existing = document.getElementById("renameModal");
    if (existing) existing.remove();

    const prova = selectedItems.prova;
    const gab = selectedItems.gabarito;

    if (!prova && !gab) return;

    const modal = document.createElement("div");
    modal.id = "renameModal";
    Object.assign(modal.style, {
      position: "fixed",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      backgroundColor: "rgba(0,0,0,0.7)",
      zIndex: 10000,
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
    });

    const hasProva = !!prova;
    const hasGab = !!gab;

    modal.innerHTML = `
        <div style="background:#2d2d2d; padding:25px; border-radius:12px; width:400px; box-shadow:0 10px 30px rgba(0,0,0,0.5);">
            <h2 style="margin-top:0; color:white; margin-bottom:20px;">Confirmar Seleção</h2>
            
            ${
              hasProva
                ? `
                <div style="margin-bottom:15px;">
                    <label style="display:block; color:#ccc; margin-bottom:5px;">Nome da Prova</label>
                    <input type="text" id="inputRenameProva" value="${prova.name}" style="width:100%; padding:8px; border-radius:6px; border:1px solid #444; background:#1e1e1e; color:white;">
                </div>
            `
                : ""
            }

            ${
              hasGab
                ? `
                <div style="margin-bottom:15px;">
                    <label style="display:block; color:#ccc; margin-bottom:5px;">Nome do Gabarito</label>
                    <input type="text" id="inputRenameGab" value="${gab.name}" style="width:100%; padding:8px; border-radius:6px; border:1px solid #444; background:#1e1e1e; color:white;">
                </div>
            `
                : ""
            }

            <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:25px;">
                <button id="btnCancelExtract" style="padding:8px 16px; background:transparent; border:1px solid #666; color:#ccc; border-radius:6px; cursor:pointer;">Cancelar</button>
                <button id="btnConfirmExtract" style="padding:8px 16px; background:var(--color-primary); border:none; color:white; border-radius:6px; cursor:pointer;">Confirmar e Abrir</button>
            </div>
            <div id="loadingStatus" style="margin-top:10px; color:#aaa; font-size:0.9rem; display:none;">Processando...</div>
        </div>
      `;

    document.body.appendChild(modal);

    document.getElementById("btnCancelExtract").onclick = () => modal.remove();
    document.getElementById("btnConfirmExtract").onclick = async () => {
      const status = document.getElementById("loadingStatus");
      status.style.display = "block";
      status.innerText = "Baixando arquivos...";

      try {
        // 1. Download Blobs
        let provaBlob = null;
        let gabaritoBlob = null;

        if (hasProva) {
          const newName = document.getElementById("inputRenameProva").value;
          const resp = await fetch(prova.url);
          provaBlob = await resp.blob();
          // Metadata update not needed for blob, but passed to viewer
          prova.rawTitle = newName;
        }

        if (hasGab) {
          const newName = document.getElementById("inputRenameGab").value;
          const resp = await fetch(gab.url);
          gabaritoBlob = await resp.blob();
          gab.rawTitle = newName;
        }

        // 3. Start Viewer
        status.innerText = "Iniciando visualizador...";

        const viewerData = {
          title: hasProva ? `(${prova.rawTitle})` : "Documento Extraído",
          rawTitle: hasProva ? prova.rawTitle : "Documento",
          fileProva: provaBlob,
          fileGabarito: gabaritoBlob,
          gabaritoNaProva: !hasGab, // Se não selecionou gabarito separado, assume que tá na prova ou nem tem
        };

        modal.remove();
        // Inicia a mágica
        gerarVisualizadorPDF(viewerData);
      } catch (e) {
        console.error(e);
        status.innerText = "Erro: " + e.message;
        status.style.color = "red";
      }
    };
  };

  // Listeners Iniciais
  if (btnSearch) btnSearch.addEventListener("click", () => doSearch(false));
  if (searchInput) {
    searchInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") doSearch(false);
    });
  }
}
