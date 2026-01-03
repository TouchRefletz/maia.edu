// --- CONFIG ---
const PROD_WORKER_URL =
  import.meta.env.VITE_WORKER_URL || "https://your-worker.workers.dev";

// Importa o visualizador
import { AsyncQueue } from "../utils/queue.js";
import { gerarVisualizadorPDF } from "../viewer/events.js";
import { SearchPersistence } from "./search-persistence.js";
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
let terminalInstance = null; // Guardar referencia global

const normalizeItem = (item) => {
  // Helper to ensure item has standard props
  let newItem = { ...item };
  if (!newItem.name && newItem.nome) newItem.name = newItem.nome;
  if (!newItem.name && newItem.friendly_name)
    newItem.name = newItem.friendly_name;

  // REFERENCE ITEM LOGIC
  if (newItem.status === "reference") {
    if (!newItem.url) {
      // Try common fields for external links
      newItem.url =
        newItem.link ||
        newItem.link_origem ||
        newItem.url_source ||
        newItem.original_link ||
        newItem.external_url;
    }
    // If still empty, it might be a broken reference.
    if (!newItem.url) newItem.url = "#broken-reference";
  } else {
    // Normal File Logic
    if (!newItem.url) {
      let path = newItem.path || newItem.filename || newItem.arquivo_local;
      if (path && !path.startsWith("http")) {
        // Construct full URL for verification
        const prefix = `output/${currentSlug}`;
        // Handle 'files/' prefix cleanly
        if (path.startsWith("files/")) path = path.replace("files/", "");
        newItem.url = `https://huggingface.co/datasets/toquereflexo/maia-deep-search/resolve/main/${prefix}/files/${path}`;
      }
    }
  }
  return newItem;
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
  const hasSelection = selectedItems.prova && selectedItems.gabarito;

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

/**
 * CONFLICT RESOLUTION MODAL (Mix & Match)
 * @param {Object} conflictData - { slug, remote_manifest, ai_data, temp_pdf_url, temp_gabarito_url }
 * @param {Function} onConfirm - Callback({ pdfUrl, gabUrl })
 */
export const showConflictResolutionModal = (conflictData, onConfirm) => {
  const { slug, remote_manifest, ai_data, temp_pdf_url, temp_gabarito_url } =
    conflictData;

  // 1. Prepare Items for Cards
  // 1. Prepare Items for Cards
  // Remote Items (Handle Array vs Object structure)
  let itemsSource = [];
  if (Array.isArray(remote_manifest)) {
    itemsSource = remote_manifest;
  } else if (remote_manifest.files) {
    itemsSource = remote_manifest.files;
  } else if (remote_manifest.results) {
    itemsSource = remote_manifest.results;
  }

  const remoteItems = itemsSource.map((item) =>
    normalizeItem({
      ...item,
      tipo: item.type || item.tipo, // ensure type exists
      source: "remote",
    })
  );

  // Local Items (Constructed from AI data + Temp URLs)
  const localItems = [];
  if (temp_pdf_url) {
    localItems.push({
      name: `(Novo) ${ai_data.institution} ${ai_data.year}`,
      tipo: "Prova",
      url: temp_pdf_url,
      source: "local",
    });
  }
  if (temp_gabarito_url) {
    localItems.push({
      name: `(Novo) Gabarito`,
      tipo: "Gabarito",
      url: temp_gabarito_url,
      source: "local",
    });
  }

  // 2. Render Modal
  const overlay = document.createElement("div");
  Object.assign(overlay.style, {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.85)",
    zIndex: 11000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backdropFilter: "blur(8px)",
  });

  const modal = document.createElement("div");
  Object.assign(modal.style, {
    backgroundColor: "var(--color-surface)",
    width: "95%",
    maxWidth: "1000px",
    height: "85vh",
    borderRadius: "var(--radius-xl)",
    display: "flex",
    flexDirection: "column",
    boxShadow: "var(--shadow-2xl)",
    border: "1px solid var(--color-border)",
    overflow: "hidden",
  });

  modal.innerHTML = `
        <div style="padding: 24px; border-bottom: 1px solid var(--color-border);">
            <h2 style="margin:0; color:var(--color-text);">Conflito Detectado: ${slug}</h2>
            <p style="margin:8px 0 0; color:var(--color-text-secondary);">
                Já existe uma versão desta prova no banco de dados. <br>
                <strong>Selecione qual versão você deseja usar</strong> para a Prova e para o Gabarito.
            </p>
        </div>
        <div style="flex:1; overflow-y:auto; padding:24px; display:grid; grid-template-columns: 1fr 1fr; gap:32px;">
            <!-- Remote Column -->
            <div>
                <h3 style="color:var(--color-primary); margin-bottom:16px; border-bottom:2px solid var(--color-primary); padding-bottom:8px;">
                    ☁️ Na Nuvem (Existente)
                </h3>
                <div id="remote-list" style="display:flex; flex-direction:column; gap:16px;"></div>
            </div>
             <!-- Local Column -->
            <div>
                 <h3 style="color:var(--color-success); margin-bottom:16px; border-bottom:2px solid var(--color-success); padding-bottom:8px;">
                    📂 Seu Upload (Novo)
                </h3>
                <div id="local-list" style="display:flex; flex-direction:column; gap:16px;"></div>
            </div>
        </div>
        <div style="padding: 24px; border-top: 1px solid var(--color-border); display:flex; justify-content:flex-end; gap:16px; background:var(--color-bg-sub);">
            <button id="btnCancelConflict" style="padding:12px 24px; border-radius:8px; border:1px solid var(--color-border); background:transparent; color:var(--color-text); cursor:pointer;">
                Cancelar Upload
            </button>
            <button id="btnMergeConflict" disabled style="padding:12px 24px; border-radius:8px; border:none; background:var(--color-primary); color:white; font-weight:bold; cursor:not-allowed; opacity:0.5;">
                Confirmar Fusão
            </button>
        </div>
      `;

  // 3. Selection State
  const selection = { prova: null, gabarito: null };

  const updateButton = () => {
    const btn = modal.querySelector("#btnMergeConflict");
    // Valid if we have at least a Prova selected (Gabarito optional but good)
    // Actually, let's require explicit choice if options exist.
    // For simplicity: User MUST select a Prova. Gabarito is optional if none exist.
    if (selection.prova) {
      btn.disabled = false;
      btn.style.opacity = "1";
      btn.style.cursor = "pointer";
    }
  };

  const handleSelect = (item, type) => {
    selection[type.toLowerCase()] = item;
    // Visual Update: Highlight selected, dim others of same type across both lists

    document
      .querySelectorAll(`.conflict-card[data-type="${type.toLowerCase()}"]`)
      .forEach((card) => {
        if (card.dataset.url === item.url) {
          card.style.borderColor = "var(--color-primary)";
          card.style.transform = "scale(1.02)";
          card.style.opacity = "1";
          card.querySelector(".check-icon").style.display = "flex";
        } else {
          card.style.borderColor = "transparent";
          card.style.transform = "scale(1)";
          card.style.opacity = "0.6";
          card.querySelector(".check-icon").style.display = "none";
        }
      });
    updateButton();
  };

  // Helper to render mini-cards
  const renderMiniCard = (item, containerId) => {
    const container = modal.querySelector(containerId);
    const type = (item.tipo || "Arquivo").toLowerCase().includes("gabarito")
      ? "gabarito"
      : "prova";

    const card = document.createElement("div");
    card.className = "conflict-card";
    card.dataset.type = type;
    card.dataset.url = item.url;

    Object.assign(card.style, {
      padding: "16px",
      borderRadius: "12px",
      backgroundColor: "var(--color-surface)",
      border: "2px solid transparent",
      boxShadow: "var(--shadow-sm)",
      cursor: "pointer",
      position: "relative",
      transition: "all 0.2s",
    });

    card.innerHTML = `
            <div class="check-icon" style="display:none; position:absolute; top:-10px; right:-10px; width:24px; height:24px; background:var(--color-primary); border-radius:50%; align-items:center; justify-content:center; color:white;">✓</div>
            <div style="font-weight:bold; color:var(--color-text); margin-bottom:4px;">${item.name || "Sem Título"}</div>
            <div style="font-size:0.8rem; color:var(--color-text-secondary); text-transform:uppercase;">${type} • ${item.source === "remote" ? "Hugging Face" : "Local"}</div>
          `;

    card.onclick = () => handleSelect(item, type);
    container.appendChild(card);
  };

  remoteItems.forEach((i) => renderMiniCard(i, "#remote-list"));
  localItems.forEach((i) => renderMiniCard(i, "#local-list"));

  // 4. Actions
  modal.querySelector("#btnCancelConflict").onclick = () => {
    document.body.removeChild(overlay);
    if (window.SearchToaster)
      window.SearchToaster.add("info", "Upload cancelado pelo usuário.");
  };

  modal.querySelector("#btnMergeConflict").onclick = () => {
    document.body.removeChild(overlay);
    onConfirm({
      pdfUrl: selection.prova ? selection.prova.url : null,
      gabUrl: selection.gabarito ? selection.gabarito.url : null,
    });
  };

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
};

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

  const btnVoltarInicio = document.querySelector(".js-voltar-inicio");

  // --- STATE RESTORATION (Persistence) ---
  const savedSession = SearchPersistence.getSession();
  const savedManifest = SearchPersistence.getManifest();

  if (savedSession && savedSession.slug) {
    console.log("[RESTORE] Found saved session:", savedSession);
    currentSlug = savedSession.slug;

    // 1. Restore Terminal (if we have tasks or if we have results)
    // We restore terminal if there's a session, to show log history/status.
    if (
      (savedSession.tasks && savedSession.tasks.length > 0) ||
      savedManifest
    ) {
      if (searchResults) {
        searchResults.innerHTML = ""; // Clear placeholders
        const consoleContainer = document.createElement("div");
        consoleContainer.id = "deep-search-terminal";
        searchResults.appendChild(consoleContainer);

        terminalInstance = new TerminalUI(consoleContainer);
        // Save Global Ref
        // Re-attach expand handler since we just created it
        terminalInstance.onExpandRequest = () => {
          if (document.getElementById("btnBackToSearch"))
            document.getElementById("btnBackToSearch").click();
        };

        if (savedSession.tasks) {
          terminalInstance.updateTaskFromEvent(savedSession.tasks);
        }

        // Apply Status
        if (savedSession.status === "completed" || savedManifest) {
          terminalInstance.state = "DONE";
          terminalInstance.finish(true);
        } else if (savedSession.status === "running") {
          // If it was running, we might leave it as is or mark as interrupted/unknown
          // For now, let's keep it open.
        }
      }
    }

    // 2. Restore Results
    if (savedManifest && savedManifest.length > 0) {
      console.log("[RESTORE] Restoring results manifest...");
      currentManifest = savedManifest;
      renderResultsNewUI(savedManifest);
    }
  }

  // Helper to Float Terminal (EXPORTED LOGIC)
  // We attach this to window or export it. Since we are in a module, we should export it.
  // But setupSearchLogic is the main export. We will add a secondary export at the bottom or modify the module structure.
  // Actually, for simplicity and to avoid circular deps or complex refactors, let's just make it a global window function or
  // export it if possible. The file structure allows multiple exports.

  // Checking if we can re-dock on init
  if (terminalInstance && terminalInstance.state !== "DONE") {
    // Re-dock logic
    const targetParent = searchResults; // Default place
    if (targetParent) {
      // Verify if it's already there (it shouldn't be, DOM was wiped)
      if (!targetParent.contains(terminalInstance.container)) {
        terminalInstance.setFloatMode(false);
        targetParent.appendChild(terminalInstance.container);
      }
    }
  }

  const floatTerminal = () => {
    // FLOATING MODE: If terminal exists and job running, float it.
    if (terminalInstance && terminalInstance.state !== "DONE") {
      terminalInstance.setFloatMode(true);

      // Ensure Wrapper
      let wrapper = document.getElementById("floating-term-wrapper");
      if (!wrapper) {
        wrapper = document.createElement("div");
        wrapper.id = "floating-term-wrapper";
        wrapper.style.position = "fixed";
        wrapper.style.zIndex = "99999";
        document.body.appendChild(wrapper);
      }

      // Move container to wrapper (Reparenting)
      wrapper.appendChild(terminalInstance.container);
      wrapper.style.display = "block";
    }
  };

  // --- Toggles de Interface ---
  if (btnShowUpload) {
    btnShowUpload.addEventListener("click", () => {
      searchContainer.classList.add("hidden");
      searchContainer.style.display = "none";
      manualUploadContainer.classList.remove("hidden");
      manualUploadContainer.style.display = "flex";
      manualUploadContainer.classList.add("fade-in-centralized");

      floatTerminal();
    });
  }

  // Bind to Global Back Button (js-voltar-inicio)
  if (btnVoltarInicio) {
    btnVoltarInicio.addEventListener("click", () => {
      // If we are navigating away from search, trigger float
      // But what does this button do? It usually goes back to Home.
      // If so, we probably want to float the terminal if search is active.
      floatTerminal();
    });
  }

  if (btnBackToSearch) {
    btnBackToSearch.addEventListener("click", () => {
      manualUploadContainer.classList.add("hidden");
      manualUploadContainer.style.display = "none";
      searchContainer.classList.remove("hidden");
      searchContainer.style.display = "flex";
      searchContainer.classList.add("fade-in-centralized");

      // RESTORE MODE
      if (terminalInstance) {
        terminalInstance.setFloatMode(false);
        // Devolver ao lugar original
        // O lugar original era resultsContainer
        const originalParent =
          document.getElementById("deep-search-terminal-container") ||
          searchResults;
        // Ensure we don't duplicate
        if (!originalParent.contains(terminalInstance.container)) {
          originalParent.prepend(terminalInstance.container);
        }
      }
    });
  }

  // Handle Expand from Floating
  const handleExpandRequest = () => {
    if (btnBackToSearch) btnBackToSearch.click(); // Reuse logic
  };

  // STRICT CANCELLATION ON CLOSE
  window.addEventListener("unload", () => {
    // Use sendBeacon to guarantee request is sent triggers even if page dies
    if (
      currentSlug &&
      (!terminalInstance || terminalInstance.state !== "DONE")
    ) {
      // Precisamos do runId se tiver, se não cancela pelo slug se a API suportar (mas a API pede runId).
      // Se não tiver runId, paciência, o backend deve ter timeout.
      const runId = terminalInstance ? terminalInstance.runId : null;

      if (runId) {
        const data = JSON.stringify({ runId: runId });
        const blob = new Blob([data], { type: "application/json" });
        navigator.sendBeacon(`${PROD_WORKER_URL}/cancel-deep-search`, blob);
      }
    }
  });

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
  const doSearch = async (
    force = false,
    cleanup = false,
    confirm = false,
    mode = "overwrite"
  ) => {
    const query = searchInput.value.trim();
    if (!query) return;

    // Reset Connections if starting a NEW main search (not just a verification step)
    if (!activePusher || confirm) {
      // Reset if we are confirming OR if it's a fresh start
      if (activeWebSocket) {
        activeWebSocket.close();
        activeWebSocket = null;
      }
      if (activeChannel) {
        activeChannel.unbind_all();
        if (activePusher && currentSlug) activePusher.unsubscribe(currentSlug);
        activeChannel = null;
      }
      if (activePusher) {
        activePusher.disconnect();
        activePusher = null;
      }
    }

    // UI Feedback for "Update Mode"
    if (mode === "update") {
      const termHeader = document.querySelector(
        "#deep-search-terminal .terminal-header span"
      );
      if (termHeader) {
        termHeader.innerText = "TERMINAL - MODO ATUALIZAÇÃO";
        termHeader.style.color = "var(--color-warning)";
      }
    }

    // Setup Terminal if not exists (only on fresh start)
    let terminal = null;
    const existingEl = document.getElementById("deep-search-terminal");

    if (!confirm || !existingEl) {
      // Fresh start OR Recovery if terminal is missing
      searchResults.innerHTML = "";
      selectedItems = { prova: null, gabarito: null };

      // Only reset slug if fresh start, otherwise we might want to keep it?
      // Actually, if we are retrying, we usually get a new slug anyway.
      // So resetting is safer to avoid pusher conflicts.
      currentSlug = null;

      const consoleContainer = document.createElement("div");
      consoleContainer.id = "deep-search-terminal";
      searchResults.appendChild(consoleContainer);
      terminal = new TerminalUI(consoleContainer);
      terminalInstance = terminal; // Save Global Ref
      terminal.onExpandRequest = handleExpandRequest; // Link expand logic

      const log = (text, type = "info") => terminal.processLogLine(text, type);

      if (!confirm) {
        // Initial LOG
        log(
          "Verificando banco de dados por resultados existentes...",
          "in_progress"
        );
      } else {
        log("Reiniciando busca (Terminal Restaurado)...", "warning");
      }

      // Wire Retry Logic
      terminal.onRetry = () => showRetryConfirmationModal(log, terminal);
    } else {
      // 0. CAPTURE STATE (Notification)
      const prevNotify = terminalInstance
        ? terminalInstance.getNotificationState()
        : false;

      // --- FIX: CLEAR PREVIOUS RESULTS ON UPDATE ---
      // If we are "Adding more results" or "Retrying", we should clear the old grid
      // so the user sees a "fresh" start while the agent runs.
      const existingResults = searchResults.querySelector(".results-container");
      if (existingResults) existingResults.remove();
      // Reset selections since DOM elements are gone
      selectedItems = { prova: null, gabarito: null };

      // Re-attach to existing terminal
      if (terminalInstance) {
        terminal = terminalInstance;
      } else {
        terminal = new TerminalUI(existingEl);
        terminalInstance = terminal;
      }

      // 1. Define log helper FIRST (needed for onRetry)
      const log = (text, type = "info") => terminal.processLogLine(text, type);

      // 2. Bind onRetry with TYPE support (retry vs add_more)
      terminal.onRetry = (type) =>
        showRetryConfirmationModal(log, terminal, type);

      // 3. RESET TERMINAL STATE FOR FRESH LOOK (Even on update)
      if (terminal) terminal.reset();

      terminal.onExpandRequest = handleExpandRequest;

      // 4. RESTORE STATE
      if (prevNotify) terminal.setNotificationState(true);

      // If update mode, show visual cue
      if (mode === "update")
        terminal.processLogLine(
          "⚠ MODO ATUALIZAÇÃO ATIVADO: Novos arquivos serão mesclados.",
          "warning"
        );
    }

    // Internal Log helper
    const log = (text, type = "info") => {
      terminal?.processLogLine(text, type);
    };

    // Pusher Config
    const pusherKey = "6c9754ef715796096116";
    const pusherCluster = "sa1";

    try {
      // Step 1 & 2: Call Worker
      const response = await fetch(`${PROD_WORKER_URL}/trigger-deep-search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          slug: currentSlug, // Fix: Ensure we target the existing folder on retry/update
          force,
          cleanup,
          confirm,
          mode,
          apiKey: sessionStorage.getItem("GOOGLE_GENAI_API_KEY"),
        }),
      });
      const result = await response.json();

      // --- HANDLE PRE-FLIGHT ---
      if (result.preflight) {
        log(`Slug Canônico Gerado: ${result.canonical_slug}`, "success");

        if (result.slug_reasoning) {
          log(`Raciocínio: ${result.slug_reasoning}`, "info");
        }

        // MOSTRA direto o resultado
        if (result.exact_match) {
          log(
            `Banco de provas encontrado (${
              result.exact_match.slug || result.canonical_slug
            }). Carregando resultados...`,
            "success"
          );
          const existSlug = result.exact_match.slug || result.canonical_slug;
          currentSlug = existSlug;

          // Persist Session for "Exact Match" immediately
          SearchPersistence.startSession(existSlug);

          // --- AUTO-DETECT MANUAL UPLOAD & UPGRADE ---
          // Fetch manifest to check if it's "manual-only"
          // We do this proactively.
          const checkAndAutoUpgrade = async () => {
            try {
              const mfUrl = `https://huggingface.co/datasets/toquereflexo/maia-deep-search/resolve/main/output/${existSlug}/manifest.json?t=${Date.now()}`;
              const r = await fetch(mfUrl);
              if (r.ok) {
                const data = await r.json();
                const items = Array.isArray(data) ? data : data.results || [];

                // Check if *only* manual content exists (or predominantly manual)
                // Logic: If we have items and they are ALL link_origem="manual-upload",
                // then this is a "stub" repo created by a user, not a full search.
                // We should definitely AUTO-UPGRADE.

                const isManualOnly =
                  items.length > 0 &&
                  items.every((i) => i.link_origem === "manual-upload");

                if (isManualOnly) {
                  log(
                    `[AUTO-UPGRADE] Pasta '${existSlug}' encontrada, mas contém apenas uploads manuais.`,
                    "warning"
                  );
                  log(
                    `Iniciando Pesquisa Avançada complementar (Modo: UPDATE)...`,
                    "success"
                  );

                  // Recursive call with UPDATE mode
                  // force=true, cleanup=false, confirm=true, mode="update"
                  doSearch(true, false, true, "update");
                  return true; // We handled it
                }
              }
            } catch (e) {
              console.warn("Auto-upgrade check failed:", e);
            }
            return false;
          };

          // Execute check
          checkAndAutoUpgrade().then((handled) => {
            if (!handled) {
              SearchPersistence.finishSession(true);
              // Load immediately
              const hfBase =
                "https://huggingface.co/datasets/toquereflexo/maia-deep-search/resolve/main";
              loadResults(
                `${hfBase}/output/${existSlug}/manifest.json`,
                log,
                terminal,
                new Set(),
                true // Enable Retry/Add More Button even for Cached Results
              );
            }
          });
          return;
          return;
        }

        // Se não identificou (não exato), NÃO mostra nada e SÓ pesquisa.
        // Ignora "similares" para simplificar fluxo.
        // log("Nenhum banco exato encontrado. Iniciando busca...", "info");

        doSearch(force, cleanup, true, "overwrite");
        return;
      }

      // --- HANDLE CONFIRMED TRIGGER ---
      // We now have a final_slug from the worker
      const slug = result.final_slug;
      currentSlug = slug;

      // Start Persistence Session
      if (mode !== "recover") {
        SearchPersistence.startSession(slug);
      }

      log(`Conectando ao canal: ${slug}...`, "info");

      let PusherClass = window.Pusher;
      if (!PusherClass) {
        const module = await import("pusher-js");
        PusherClass = module.default;
      }

      activePusher = new PusherClass(pusherKey, {
        cluster: pusherCluster,
      });

      activeChannel = activePusher.subscribe(slug);

      activeChannel.bind("task_update", function (data) {
        if (terminal && data) {
          // Filter out cleanup tasks if mode is update?
          // The backend might not send them if we skip the steps in GH Action.
          terminal.updateTaskFromEvent(data);
          SearchPersistence.saveTasks(data);

          // Update Toaster with latest task
          const running = data.find((t) => t.status === "in_progress");
          if (running) {
            //
          }
        }
      });

      activeChannel.bind("log", function (data) {
        if (!data) return;
        const text =
          data.message ||
          (typeof data === "string" ? data : JSON.stringify(data));
        if (!text) return;

        if (text.includes("COMPLETED")) {
          let isSuccess = true; // Scope var

          log(
            "Busca base finalizada. Iniciando verificação de integridade...",
            "success"
          );
          activePusher.unsubscribe(slug);
          SearchPersistence.finishSession(true); // Mark Done

          const finalSlug = data.new_slug || slug;
          currentSlug = finalSlug;

          setTimeout(() => {
            const hfBase =
              "https://huggingface.co/datasets/toquereflexo/maia-deep-search/resolve/main";
            loadResults(
              `${hfBase}/output/${finalSlug}/manifest.json`,
              log,
              terminal,
              new Set(),
              true // Enable Retry Button for Fresh Searches
            );
          }, 3000);
        } else {
          log(text);
        }
      });
    } catch (e) {
      if (e.name === "AbortError" || e.message.includes("aborted")) {
        log("Operação cancelada.", "info");
      } else {
        log(`Erro Fatal: ${e.message}`, "error");
      }
    }
  };

  const showRetryConfirmationModal = (log, terminal, type = "add_more") => {
    // Create Modal UI dynamically
    const modalId = "retry-confirmation-modal";
    let modal = document.getElementById(modalId);
    if (modal) modal.remove();

    modal = document.createElement("div");
    modal.id = modalId;
    Object.assign(modal.style, {
      position: "fixed",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      backgroundColor: "rgba(0,0,0,0.8)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 10000,
      backdropFilter: "blur(4px)",
    });

    const content = document.createElement("div");
    Object.assign(content.style, {
      backgroundColor: "var(--color-surface)",
      padding: "32px",
      borderRadius: "var(--radius-xl)",
      maxWidth: "500px",
      width: "90%",
      border: "1px solid var(--color-border)",
      boxShadow: "var(--shadow-2xl)",
      textAlign: "center",
    });

    let iconHtml =
      '<div style="font-size: 3rem; margin-bottom: 16px;">🔎</div>';
    let titleText = "Continuar Busca?";
    let bodyText = `
        Deseja buscar <strong>novos arquivos</strong> para este termo?<br>
        <br>
        O sistema irá procurar itens que ainda não foram encontrados e adicioná-los ao banco de dados existente.
    `;
    let confirmBtnText = "Buscar Mais";
    let confirmBtnColor = "var(--color-primary)"; // Default blue

    // CUSTOMIZE FOR RETRY (ERROR RECOVERY)
    if (type === "retry") {
      iconHtml = '<div style="font-size: 3rem; margin-bottom: 16px;">🔄</div>';
      titleText = "Tentar Novamente?";
      bodyText = `
          A busca anterior pode não ter sido concluída corretamente ou falhou.<br>
          <br>
          Deseja <strong>reiniciar o processo</strong>?
      `;
      confirmBtnText = "Tentar Novamente";
      // Optional: Change button color to imply 'fix' or 'retry'
    }

    content.innerHTML = `
          ${iconHtml}
          <h2 style="font-size: 1.5rem; margin-bottom: 8px;">${titleText}</h2>
          <p style="color: var(--color-text-secondary); margin-bottom: 24px;">
              ${bodyText}
          </p>
          
          <div style="display: flex; gap: 12px; justify-content: center;">
              <button id="btn-cancel-retry" style="
                  background: transparent; border: 1px solid var(--color-border); color: var(--color-text);
                  padding: 12px 24px; border-radius: 8px; font-weight: 600; cursor: pointer; flex: 1;
              ">Cancelar</button>
              
              <button id="btn-confirm-retry" style="
                  background: ${confirmBtnColor}; color: white; border: none; padding: 12px 24px;
                  border-radius: 8px; font-weight: 600; cursor: pointer; flex: 1;
              ">${confirmBtnText}</button>
          </div>
      `;

    modal.appendChild(content);
    document.body.appendChild(modal);

    // Handlers
    document.getElementById("btn-cancel-retry").onclick = () => {
      modal.remove();
    };

    document.getElementById("btn-confirm-retry").onclick = () => {
      modal.remove();

      if (terminal)
        terminal.queueLog(
          "[SISTEMA] Iniciando busca complementar (Modo Update)...",
          "info"
        );

      // Trigger Search: force=true, cleanup=FALSE, confirm=true, mode="update"
      // cleanup=false is critical to prevent deletion
      doSearch(true, false, true, "update");
    };
  };

  const showUnifiedDecisionModal = (
    preflightData,
    originalQuery,
    log,
    terminal,
    force,
    cleanup
  ) => {
    // Create Modal UI dynamically
    const modalId = "unified-decision-modal";
    let modal = document.getElementById(modalId);
    if (modal) modal.remove();

    modal = document.createElement("div");
    modal.id = modalId;
    Object.assign(modal.style, {
      position: "fixed",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      backgroundColor: "rgba(0,0,0,0.8)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 10000,
      backdropFilter: "blur(4px)",
    });

    const content = document.createElement("div");
    Object.assign(content.style, {
      backgroundColor: "var(--color-surface)",
      padding: "32px",
      borderRadius: "var(--radius-xl)",
      maxWidth: "600px",
      width: "90%",
      border: "1px solid var(--color-border)",
      boxShadow: "var(--shadow-2xl)",
      textAlign: "center",
      maxHeight: "90vh",
      overflowY: "auto",
    });

    // Content Logic
    const exact = preflightData.exact_match;
    // FIX: Use exact.slug if available (truth source), fallback to canonical, fallback to query
    const slug =
      exact && exact.slug
        ? exact.slug
        : preflightData.canonical_slug ||
          originalQuery.toLowerCase().replace(/[^a-z0-9]+/g, "-");

    let html = "";

    // --- 1. EXACT MATCH SECTION ---
    if (exact) {
      html += `
                <div style="background: rgba(var(--color-success-rgb), 0.1); border: 1px solid var(--color-success); border-radius: 12px; padding: 24px; margin-bottom: 24px;">
                    <div style="font-size: 3rem; margin-bottom: 16px;">📂</div>
                    <h2 style="font-size: 1.5rem; margin-bottom: 8px;">Banco de Provas Encontrado!</h2>
                    <p style="color: var(--color-text-secondary); margin-bottom: 12px;">
                        Já existe um repositório chamado <strong>${slug}</strong> em nosso banco de dados.
                    </p>
                    <div style="font-size: 0.9rem; color: var(--color-text-dim); margin-bottom: 24px;">
                         📁 ${exact.file_count || "?"} arquivos • 🕒 Atualizado em: ${exact.updated_at ? new Date(exact.updated_at).toLocaleDateString() : "Desconhecido"}
                    </div>
                    
                    <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
                        <button id="btn-view-existing" style="
                            background: var(--color-primary); color: white; border: none; padding: 12px 24px;
                            border-radius: 8px; font-weight: 600; cursor: pointer; flex: 1;
                        ">Visualizar Agora</button>
                        
                        <button id="btn-update-mode" style="
                            background: transparent; border: 1px solid var(--color-warning); color: var(--color-warning);
                            padding: 12px 24px; border-radius: 8px; font-weight: 600; cursor: pointer; flex: 1;
                        ">Atualizar / Buscar Novos</button>
                    </div>
                </div>
             `;
    } else {
      html += `
                <div style="font-size: 3rem; margin-bottom: 16px;">🤔</div>
                <h2 style="font-size: 1.5rem; margin-bottom: 8px;">Nenhum Banco Exato Encontrado</h2>
                <p style="color: var(--color-text-secondary); margin-bottom: 24px;">
                    Não encontramos "<strong>${slug}</strong>" especificamente.
                </p>
             `;
    }

    // --- 2. SIMILAR CANDIDATES SECTION (ALWAYS SHOW IF EXISTS) ---
    if (
      preflightData.similar_candidates &&
      preflightData.similar_candidates.length > 0
    ) {
      html += `
                <div style="text-align: left; margin-top: 24px;">
                    <h3 style="font-size: 1.1rem; margin-bottom: 12px; color: var(--color-text-secondary); border-bottom: 1px solid var(--color-border); padding-bottom: 8px;">
                        ${exact ? "Outras opções que podem interessar:" : "Talvez você esteja procurando por:"}
                    </h3>
                    <div style="background: var(--color-bg-1); border-radius: 8px; max-height: 200px; overflow-y: auto;">
             `;

      preflightData.similar_candidates.forEach((cand) => {
        // Filter out the exact match itself from the list if it accidentally appears
        if (exact && cand.slug === exact.slug) return;

        html += `
                    <div style="padding: 12px; border-bottom: 1px solid var(--color-border); display: flex; justify-content: space-between; align-items: center; cursor: pointer; hover: background-color: var(--color-bg-2);"
                         onclick="document.getElementById('${modalId}').dataset.selectedSlug = '${cand.slug}'; document.getElementById('btn-view-selected').click();">
                        <div style="flex: 1;">
                            <div style="font-weight: 600;">${cand.slug}</div>
                            <div style="font-size: 0.8em; opacity: 0.7;">${cand.file_count || 0} arquivos • Score: ${(cand.score * 100).toFixed(0)}%</div>
                        </div>
                        <span style="color: var(--color-primary); font-size: 0.9rem;">Ver &rarr;</span>
                    </div>
                 `;
      });
      html += `</div></div>`;
    }

    // --- 3. FOOTER ACTIONS (Force New Search / Cancel) ---
    // If we found an exact match, the main actions are inside the green box.
    // But we still might want a "Cancel" button at the bottom.
    // If NO exact match, we need the "Create New" button.

    html += `
            <div style="margin-top: 32px; border-top: 1px solid var(--color-border); padding-top: 24px; display: flex; gap: 12px; justify-content: center;">
                <button id="btn-cancel-modal" style="
                    background: transparent; border: 1px solid var(--color-border); color: var(--color-text);
                    padding: 12px 24px; border-radius: 8px; font-weight: 600; cursor: pointer;
                ">Cancelar</button>
        `;

    if (!exact) {
      html += `
                <button id="btn-force-search" style="
                    background: var(--color-primary); color: white; border: none; padding: 12px 24px;
                    border-radius: 8px; font-weight: 600; cursor: pointer;
                ">Criar Nova Pesquisa: ${slug}</button>
            `;
    }

    html += `</div> <button id="btn-view-selected" style="display: none;"></button>`;

    content.innerHTML = html;
    modal.appendChild(content);
    document.body.appendChild(modal);

    // --- EVENT HANDLERS ---

    // Exact Match Handlers
    if (exact) {
      const btnView = document.getElementById("btn-view-existing");
      if (btnView)
        btnView.onclick = () => {
          modal.remove();
          log(`Carregando banco existente: ${slug}...`, "success");
          currentSlug = slug; // Fix global slug
          loadResults(
            `https://huggingface.co/datasets/toquereflexo/maia-deep-search/resolve/main/output/${slug}/manifest.json`,
            log,
            terminal
          );
        };

      const btnUpdate = document.getElementById("btn-update-mode");
      if (btnUpdate)
        btnUpdate.onclick = () => {
          modal.remove();
          log("Iniciando MODO ATUALIZAÇÃO...", "warning");
          doSearch(force, cleanup, true, "update"); // Confirm + Update Mode
        };
    } else {
      const btnForce = document.getElementById("btn-force-search");
      if (btnForce)
        btnForce.onclick = () => {
          modal.remove();
          doSearch(force, cleanup, true, "overwrite");
        };
    }

    // Common Handlers
    document.getElementById("btn-cancel-modal").onclick = () => {
      modal.remove();
      log("Operação cancelada pelo usuário.", "error");
    };

    document.getElementById("btn-view-selected").onclick = () => {
      const selected = modal.dataset.selectedSlug;
      modal.remove();
      if (selected && selected !== "undefined") {
        log(`Carregando banco selecionado: ${selected}...`, "success");
        currentSlug = selected;
        loadResults(
          `https://huggingface.co/datasets/toquereflexo/maia-deep-search/resolve/main/output/${selected}/manifest.json`,
          log,
          terminal
        );
      } else {
        log("Erro ao selecionar item.", "error");
      }
    };
  };

  // --- CORE: INTEGRATED VERIFICATION & LOAD LOGIC ---
  const loadResults = async (
    manifestUrl,
    logFn,
    terminal,
    ignoredFiles = new Set(),
    enableRetry = true // Default to true (show button)
  ) => {
    const log =
      logFn ||
      ((msg, type) => console.log(`[${type?.toUpperCase() || "INFO"}] ${msg}`));

    try {
      // 1. Fetch Manifest
      let loadingAttempts = 0;
      let manifest = null;

      // Update Terminal for Phase 3 (Verification)
      if (terminal) {
        // Switch mode to allow progress up to 99%
        if (terminal.setVerifyMode) terminal.setVerifyMode();

        terminal.setStatus("VERIFICANDO_INTEGRIDADE");
        terminal.updateStepText("Analisando estrutura dos arquivos...");
      }

      while (loadingAttempts < 10 && !manifest) {
        try {
          // Cache Busting: Ensure we get the latest manifest version
          const bust = Date.now();
          const r = await fetch(`${manifestUrl}?t=${bust}`);
          if (r.ok) {
            manifest = await r.json();

            // Save valid manifest to persistence
            if (manifest) {
              SearchPersistence.saveManifest(manifest);
            }
            break;
          }
        } catch (e) {
          /* ignore */
        }
        loadingAttempts++;
        await new Promise((res) => setTimeout(res, 2000));
      }

      if (!manifest) throw new Error("Manifesto não encontrado.");

      // 2. Headless Verification
      log(
        "[SISTEMA] Iniciando verificação de integridade dos arquivos...",
        "info"
      );

      const { validItems, corruptedItems } = await verifyManifestIntegrity(
        manifest,
        log,
        terminal,
        ignoredFiles
      );

      // 3. Conditional Cleanup
      if (corruptedItems.length > 0) {
        log(
          `[ALERTA] Identificados ${corruptedItems.length} arquivos incompatíveis.`,
          "warning"
        );

        if (terminal) {
          terminal.setStatus("LIMPANDO_ARQUIVOS");
          terminal.updateStepText(
            `Removendo ${corruptedItems.length} itens corrompidos...`
          );
          // Bump slightly
          terminal.currentVirtualProgress = 95;
          terminal.updateProgressBar();
        }

        await performBatchCleanup(corruptedItems, log);

        // Optimistic Update: Add these to ignoredFiles so we don't block on them
        corruptedItems.forEach((item) => {
          const filename =
            item.filename ||
            (item.path ? item.path.split("/").pop() : item.url);
          ignoredFiles.add(filename);
          // Also add the raw name/path to be safe
          ignoredFiles.add(item.filename);
        });

        log(
          "[SISTEMA] Limpeza solicitada. Prosseguindo (Optimistic)...",
          "success"
        );

        // Recursive Retry immediately (or short delay), passing ignoredFiles
        await new Promise((r) => setTimeout(r, 1000));
        return loadResults(
          manifestUrl,
          logFn,
          terminal,
          ignoredFiles,
          enableRetry
        );
      }

      // 4. Check for Total Failure (Auto-Run Agent)
      if (validItems.length === 0) {
        log(
          "[SISTEMA] Nenhum resultado válido encontrado. Iniciando Agente Automaticamente...",
          "warning"
        );
        if (terminal)
          terminal.processLogLine(">> Redirecionando para Agent...", "system");

        // Trigger Force Search (Overwrite)
        // force=true, cleanup=false, confirm=true, mode="overwrite"
        doSearch(true, false, true, "overwrite");
        return;
      }

      // 5. Success -> Render
      log("[SISTEMA] Todos os arquivos validados com sucesso.", "success");

      if (terminal) {
        terminal.finish(true, enableRetry);
      }

      currentManifest = validItems;
      renderResultsNewUI(validItems);

      // AUTO-PERSIST RESULTS
      SearchPersistence.saveManifest(validItems);
    } catch (e) {
      console.error("Critical Error in loadResults:", e); // Detailed Console Log
      if (terminal) terminal.fail(e.message);
      log(
        `Erro detalhado ao carregar resultados: ${e.message}\nStack: ${e.stack || "N/A"}`,
        "error"
      );
    }
  };

  // Headless Verification using Range Headers
  const verifyManifestIntegrity = async (
    manifest,
    log,
    terminal,
    ignoredFiles
  ) => {
    // Normalization logic
    const rawItems =
      manifest.results ||
      manifest.files ||
      (Array.isArray(manifest) ? manifest : []);

    const corruptedItems = [];

    // Phase 1: Normalize & Basic Filter
    let items = rawItems
      .map((item) => normalizeItem(item))
      .filter((item) => {
        if (!item || !item.url || item.url.includes("/undefined")) return false;

        // OPTIMISTIC FILTER: If we just asked to delete this, hide it.
        const fname = item.filename || item.path?.split("/").pop();
        if (
          ignoredFiles &&
          (ignoredFiles.has(fname) || ignoredFiles.has(item.filename))
        ) {
          if (log)
            log(`[SKIP] Ignorando arquivo pendente de exclusão: ${fname}`);
          return false;
        }
        return true;
      });

    // Phase 2: Deduplication (Quarta Camada de Verificação)
    const seenHashes = new Set();
    const uniqueItems = [];

    items.forEach((item) => {
      // Se temos um hash visual e já vimos ele antes...
      if (item.visual_hash && seenHashes.has(item.visual_hash)) {
        if (log)
          log(
            `[DUPLICATA] Hash visual repetido detectado em ${
              item.filename || item.nome
            }. Marcando para remoção.`,
            "warning"
          );
        // Adiciona direto aos corrompidos para limpeza
        corruptedItems.push(item);
      } else {
        // Se é novo, registra e segue
        if (item.visual_hash) seenHashes.add(item.visual_hash);
        uniqueItems.push(item);
      }
    });

    // Atualiza a lista base para usar apenas os únicos
    items = uniqueItems;

    // Split references vs downloads
    const downloadableItems = items.filter((i) => i.status !== "reference");
    const referenceItems = items.filter((i) => i.status === "reference");

    // Pre-populate valid with references (we will verification them below)
    const validItems = [];
    // const validItems = items.filter((i) => i.status === "reference"); // REMOVED: We now verify references

    // Check downloads efficiently
    const queue = new AsyncQueue(4); // 4 checks in parallel
    let processed = 0;

    // 1. Verify Downloads (PDFs)
    const checkDownloadTask = async (item) => {
      const isValid = await robustVerifyPdf(item.url, log);
      if (isValid) {
        validItems.push(item);
      } else {
        corruptedItems.push(item);
      }
      processed++;
    };

    downloadableItems.forEach((item) =>
      queue.enqueue(() => checkDownloadTask(item))
    );

    // 2. Verify References (Links)
    const checkReferenceTask = async (item) => {
      // Assume valid initially? No, strict check requested.
      const isValid = await verifyReference(item.url, log);
      if (isValid) {
        validItems.push(item);
      } else {
        if (log)
          log(`[REFERÊNCIA QUEBRADA] ${item.name} (${item.url})`, "warning");
        corruptedItems.push(item);
      }
    };

    referenceItems.forEach((item) =>
      queue.enqueue(() => checkReferenceTask(item))
    );

    await queue.drain();

    return { validItems, corruptedItems };
  };

  // --- NEW: Verify Reference Link ---
  const verifyReference = async (url, log) => {
    if (!url || url === "#broken-reference") return false;
    try {
      // Use no-cors to avoid blocking but check network.
      // Note: status is 0 (opaque). We accept opaque as "connected".
      // If DNS fails or connection refused -> fetch throws TypeError.
      await fetch(url, { method: "HEAD", mode: "no-cors" });
      return true;
    } catch (e) {
      // Network error (DNS, Connection Refused etc)
      return false;
    }
  };

  const performBatchCleanup = async (corruptedItems, log) => {
    // Collect all filenames to delete
    const filenamesToDelete = corruptedItems.map(
      (item) =>
        item.filename || (item.path ? item.path.split("/").pop() : item.url)
    );

    if (filenamesToDelete.length === 0) return;

    log(
      `[BATCH] Solicitando exclusão de ${filenamesToDelete.length} itens em lote...`,
      "warning"
    );

    try {
      await fetch(`${PROD_WORKER_URL}/delete-artifact`, {
        method: "POST",
        body: JSON.stringify({
          slug: currentSlug,
          filenames: filenamesToDelete, // Send array
          batch_mode: true,
        }),
        headers: { "Content-Type": "application/json" },
      });
      log(`[BATCH] Solicitação enviada com sucesso.`, "success");
    } catch (e) {
      console.error("Batch artifact delete failed", e);
      log(`[ERRO] Falha ao enviar solicitação de exclusão em lote.`, "error");
    }
  };

  // --- ROBUST 3-LAYER VERIFICATION ---
  const robustVerifyPdf = async (url, log) => {
    // Helper helper for dual logging
    const logError = (msg) => {
      if (log) log(msg, "warning");
      console.warn(msg);
    };

    /**
     * Resolves the correct Fetch URL.
     */
    const getFetchUrl = (relativeUrl) => {
      if (relativeUrl.startsWith("http")) return relativeUrl;
      return `https://huggingface.co/datasets/toquereflexo/maia-deep-search/resolve/main/output/${currentSlug}/${relativeUrl}`;
    };

    const targetUrl = getFetchUrl(url);
    // Cache Busting for Verification
    const bustUrl = `${targetUrl}?no_cache=${Date.now()}`;

    try {
      // --- LAYER 1: NETWORK & METADATA (HEAD) ---
      // Low cost, checks existence and basic type.
      const headResp = await fetch(bustUrl, { method: "HEAD" });

      if (!headResp.ok) {
        logError(
          `[VERIFICAÇÃO L1] Arquivo inacessível: ${url} (Status: ${headResp.status})`
        );
        return false;
      }

      const type = headResp.headers.get("Content-Type");
      const len = headResp.headers.get("Content-Length");

      if (type && !type.includes("pdf") && !type.includes("octet-stream")) {
        logError(`[VERIFICAÇÃO L1] Tipo inválido: ${type}`);
        return false;
      }
      if (len && parseInt(len) < 500) {
        logError(`[VERIFICAÇÃO L1] Arquivo muito pequeno: ${len} bytes`);
        return false;
      }

      // --- LAYER 2: SIGNATURE CHECK (MAGIC BYTES) ---
      // Medium cost, checks if it's actually a PDF binary.
      const rangeResp = await fetch(targetUrl, {
        headers: { Range: "bytes=0-1023" },
      });

      if (!rangeResp.ok && rangeResp.status !== 206) {
        logError(`[VERIFICAÇÃO L2] Falha ao ler bytes iniciais.`);
        return false;
      }

      const buffer = await rangeResp.arrayBuffer();
      // Use slice(0, 50) to catch header even if lots of comments
      const headerStr = new TextDecoder().decode(buffer.slice(0, 50));

      // Strict PDF Regex: %PDF-1.x
      const pdfRegex = /%PDF-1\.[0-7]/;
      if (!pdfRegex.test(headerStr)) {
        logError(
          `[VERIFICAÇÃO L2] Assinatura PDF inválida: ${headerStr.substring(0, 15)}...`
        );
        return false;
      }

      // --- LAYER 3: STRUCTURAL INTEGRITY (PDF.js) ---
      // High cost, checks if the PDF structure is parsable.
      if (!window.pdfjsLib) {
        console.warn("PDF.js not loaded, skipping Layer 3 check.");
        return true;
      }

      if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      }

      try {
        const loadingTask = pdfjsLib.getDocument({
          url: targetUrl,
          disableAutoFetch: true,
          rangeChunkSize: 65536,
        });

        const pdf = await loadingTask.promise;
        await pdf.getPage(1); // Try to decode page 1
        return true;
      } catch (pdfErr) {
        logError(`[VERIFICAÇÃO L3] Estrutura corrompida: ${pdfErr.message}`);
        return false;
      }
    } catch (e) {
      logError(`[VERIFICAÇÃO] Erro sistêmico: ${e.message}`);
      return false;
    }
  };

  const renderResultsNewUI = async (items) => {
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
        Resultados Encontrados (${items.length})
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
    grid.style.gridTemplateColumns = "repeat(auto-fill, minmax(320px, 1fr))";
    grid.style.gap = "24px";

    container.appendChild(grid);
    searchResults.appendChild(container);

    const itemsFiles = items.filter((i) => i.status !== "reference");
    const itemsRefs = items.filter((i) => i.status === "reference");

    // --- RENDER FILES ---
    if (itemsFiles.length > 0) {
      itemsFiles.forEach((item) => {
        const card = createCard(item);
        grid.appendChild(card);
      });
    } else {
      const msg = document.createElement("div");
      Object.assign(msg.style, {
        gridColumn: "1 / -1",
        textAlign: "center",
        padding: "32px",
        color: "var(--color-text-secondary)",
        border: "1px dashed var(--color-border)",
        borderRadius: "8px",
        background: "var(--color-bg-sub)",
      });
      msg.innerHTML = "Nenhum arquivo de prova encontrado.";
      grid.appendChild(msg);
    }

    // --- RENDER REFERENCES ---
    // User requested: Always show the field, even if empty (with message)
    if (true) {
      // Create Section Break
      const refSection = document.createElement("div");
      refSection.style.gridColumn = "1 / -1";
      refSection.style.marginTop = "32px";

      let contentHtml = `<h3 style="color:var(--color-text); margin-bottom:16px;">Links de Referência (${itemsRefs.length})</h3>`;

      if (itemsRefs.length > 0) {
        contentHtml += `
            <div style="
                background: rgba(255, 193, 7, 0.1); 
                border: 1px solid rgba(255, 193, 7, 0.3); 
                border-radius: 8px; 
                padding: 16px; 
                display: flex; 
                align-items: center; 
                gap: 12px;
                color: var(--color-warning);
                margin-bottom: 24px;
            ">
                <div style="font-size: 1.5rem;">⚠️</div>
                <div>
                    <strong>Referências Externas Detectadas</strong><br>
                    <span style="font-size: 0.9em; opacity: 0.9;">Estes links foram encontrados durante a varredura, mas apontam para sites externos e não foram arquivados. Eles podem estar quebrados ou desatualizados.</span>
                </div>
            </div>
          `;
        refSection.innerHTML = contentHtml;
        grid.appendChild(refSection);

        itemsRefs.forEach((item) => {
          const card = createCard(item, true); // true = isReference
          grid.appendChild(card);
        });
      } else {
        // Empty State
        contentHtml += `
            <div style="
                padding: 32px; 
                background: var(--color-bg-sub); 
                border-radius: 8px; 
                text-align: center; 
                color: var(--color-text-secondary);
                border: 1px dashed var(--color-border);
            ">
                Nenhuma referência encontrada ou válida.
            </div>
          `;
        refSection.innerHTML = contentHtml;
        grid.appendChild(refSection);
      }

      // MOVED: Render items separately to ensure they are appended correctly
      if (itemsRefs.length > 0) {
        const refList = document.createElement("div");
        Object.assign(refList.style, {
          gridColumn: "1 / -1",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        });

        itemsRefs.forEach((item) => {
          const row = createReferenceRow(item);
          refList.appendChild(row);
        });
        grid.appendChild(refList);
      }
    }

    document.getElementById("btnExtractSelection").onclick = showRenameModal;
  };

  // --- NEW: ROW RENDERER FOR REFERENCES ---
  const createReferenceRow = (item) => {
    let finalUrl = item.url;
    if (!finalUrl && item.path) finalUrl = item.path;
    if (!finalUrl) return document.createElement("div");

    // Title Fallback
    let displayTitle =
      item.name || item.nome_amigavel || item.description || item.friendly_name;
    if (!displayTitle || displayTitle.trim() === "") {
      displayTitle = item.url; // Use URL if no name
    }

    const row = document.createElement("div");
    Object.assign(row.style, {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "16px 20px",
      backgroundColor: "var(--color-surface)",
      border: "1px solid var(--color-border)",
      borderRadius: "var(--radius-lg)",
      boxShadow: "var(--shadow-sm)",
      transition: "all 0.2s ease",
      width: "100%",
      gap: "16px",
    });

    row.onmouseenter = () => {
      row.style.borderColor = "var(--color-primary)";
      row.style.transform = "translateX(4px)";
    };
    row.onmouseleave = () => {
      row.style.borderColor = "var(--color-border)";
      row.style.transform = "none";
    };

    // Icon + Info Group
    const leftGroup = document.createElement("div");
    Object.assign(leftGroup.style, {
      display: "flex",
      alignItems: "center",
      gap: "16px",
      flex: "1",
      overflow: "hidden",
    });

    const icon = document.createElement("div");
    icon.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`;
    Object.assign(icon.style, {
      color: "var(--color-text-secondary)",
      flexShrink: 0,
    });

    const textCol = document.createElement("div");
    Object.assign(textCol.style, {
      display: "flex",
      flexDirection: "column",
      gap: "4px",
      overflow: "hidden",
    });

    const titleEl = document.createElement("div");
    titleEl.innerText = displayTitle;
    Object.assign(titleEl.style, {
      fontWeight: "600",
      color: "var(--color-text)",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    });

    const urlEl = document.createElement("div");
    urlEl.innerText = finalUrl;
    Object.assign(urlEl.style, {
      fontSize: "0.85rem",
      color: "var(--color-text-secondary)",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      opacity: "0.8",
    });

    textCol.appendChild(titleEl);
    textCol.appendChild(urlEl);
    leftGroup.appendChild(icon);
    leftGroup.appendChild(textCol);

    // Action Button
    const btn = document.createElement("a");
    btn.href = finalUrl;
    btn.target = "_blank";
    btn.innerHTML = `
        <span>Visitar Link</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
      `;
    Object.assign(btn.style, {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      padding: "8px 16px",
      backgroundColor: "var(--color-bg-sub)",
      color: "var(--color-text)",
      border: "1px solid var(--color-border)",
      borderRadius: "6px",
      fontSize: "0.9rem",
      fontWeight: "500",
      textDecoration: "none",
      whiteSpace: "nowrap",
      transition: "all 0.2s",
    });

    btn.onmouseenter = () => {
      btn.style.backgroundColor = "var(--color-primary)";
      btn.style.borderColor = "var(--color-primary)";
      btn.style.color = "white";
    };
    btn.onmouseleave = () => {
      btn.style.backgroundColor = "var(--color-bg-sub)";
      btn.style.borderColor = "var(--color-border)";
      btn.style.color = "var(--color-text)";
    };

    row.appendChild(leftGroup);
    row.appendChild(btn);

    return row;
  };

  const createCard = (item, isReference = false) => {
    let finalUrl = item.url;
    // Fallback if url is somehow missing but path exists
    // (Normalized by verify strategy but just in case)
    if (!finalUrl && item.path) finalUrl = item.path;

    if (!finalUrl && !isReference) return document.createElement("div"); // Skip invalid cards

    // --- Title Fallback Logic ---
    let displayTitle =
      item.name || item.nome_amigavel || item.description || item.friendly_name;

    if (!displayTitle || displayTitle.trim() === "") {
      let fileBase = (item.filename || item.path || "").split("/").pop();
      if (fileBase) {
        fileBase = fileBase.replace(/\.pdf$/i, "");
        displayTitle = fileBase.replace(/[_-]/g, " ");
        displayTitle = displayTitle.replace(/\b\w/g, (l) => l.toUpperCase());
      } else {
        displayTitle = isReference ? "Link Externo" : "Sem Título";
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
      height: isReference ? "120px" : "380px", // Smaller height for references
      transition:
        "transform var(--duration-fast), border-color var(--duration-fast), box-shadow var(--duration-fast)",
      cursor: "pointer",
      boxShadow: "var(--shadow-sm)",
    });

    card.onmouseenter = () => {
      card.style.transform = "translateY(-4px)";
      card.style.boxShadow = "var(--shadow-lg)";
    };
    card.onmouseleave = () => {
      card.style.transform = "translateY(0)";
      card.style.boxShadow = "var(--shadow-sm)";
    };

    // Thumbnail Logic (Priority: Backend > Frontend)
    const thumbContainer = document.createElement("div");
    Object.assign(thumbContainer.style, {
      height: "220px",
      width: "100%",
      position: "relative",
      backgroundColor: "var(--color-background)",
      overflow: "hidden",
      borderBottom: "1px solid var(--color-border)",
    });

    if (item.thumbnail && !item.thumbnail.includes("undefined")) {
      // Backend Generation (Fast)
      const img = document.createElement("img");
      const thumbUrl = `https://huggingface.co/datasets/toquereflexo/maia-deep-search/resolve/main/output/${currentSlug}/${item.thumbnail}`;

      Object.assign(img.style, {
        width: "100%",
        height: "100%",
        objectFit: "cover",
        objectPosition: "top",
        display: "block",
      });
      img.src = thumbUrl;
      img.loading = "lazy";

      // Fallback if backend image fails (404)
      img.onerror = () => {
        // console.warn("Backend thumbnail failed, falling back to canvas:", thumbUrl);
        img.remove();
        // Create Canvas Fallback
        const canvas = document.createElement("canvas");
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        canvas.style.objectFit = "cover";
        canvas.style.objectPosition = "top";
        thumbContainer.appendChild(canvas);
        registerPdfThumbnail(finalUrl, canvas);
      };

      thumbContainer.appendChild(img);
    } else {
      // Frontend Generation (Fallback/Legacy)
      const canvas = document.createElement("canvas");
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.objectFit = "cover";
      canvas.style.objectPosition = "top";
      thumbContainer.appendChild(canvas);
      registerPdfThumbnail(finalUrl, canvas);
    }

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
    title.title = displayTitle;
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

      // REMOVED LEGACY CORRUPTION CHECK FROM HERE
      // Verification logic is now handled HEADLESSLY before rendering.
      // If we are here, the PDF ID is supposedly valid.
      // If it still fails to render, we just show fallback, no auto-trigger.

      console.warn("Erro no thumbnail (Render):", e);
      // Fallback Visual
    }
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

/* --- EXPORTED HELPER FOR GLOBAL NAVIGATION --- */
export function checkAndRestoreFloatingTerminal() {
  if (terminalInstance && terminalInstance.state !== "DONE") {
    terminalInstance.setFloatMode(true);
    let wrapper = document.getElementById("floating-term-wrapper");
    if (!wrapper) {
      wrapper = document.createElement("div");
      wrapper.id = "floating-term-wrapper";
      wrapper.style.position = "fixed";
      wrapper.style.zIndex = "99999";
      document.body.appendChild(wrapper);
    }
    if (
      terminalInstance.container &&
      !wrapper.contains(terminalInstance.container)
    ) {
      wrapper.appendChild(terminalInstance.container);
    }
    wrapper.style.display = "block";
  }
}
