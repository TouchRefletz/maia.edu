import { showConfirmModal } from "./modal-confirm.js";
import { SidebarPageManager } from "./sidebar-page-manager.js";

export const ScannerUI = {
  activePage: null,

  init(numPages) {
    // FIX: Não chamar SidebarPageManager.init() aqui pois ele limpa a sidebar.
    // A sidebar já é inicializada com todas as páginas no carregamento do PDF (events.js).
    // SidebarPageManager.init();

    // Configura o botão de stop global (agora gerido pelo SidebarPageManager ou header fixo se houver)
    // O Manager cria a estrutura de páginas.
    // Vamos garantir que a sidebar esteja visível e limpa.

    // O botão de stop pode ser injetado globalmente ou por página.
    // O requisito diz: "header atual tu vai colocar só pra parar a análise com ia"
    // Vamos injetar um header simples no topo da lista se não existir.
    this.ensureGlobalHeader();
  },

  ensureGlobalHeader() {
    const container = document.getElementById(SidebarPageManager.containerId);
    if (!container) return;

    let header = document.getElementById("ai-scanner-global-header");
    if (!header) {
      header = document.createElement("div");
      header.id = "ai-scanner-global-header";
      header.className = "maia-thoughts-header-content";

      // Header só mostra status - controles ficam no floating
      header.innerHTML = `
        <div class="maia-thoughts-title-group">
            <img src="/logo.png" class="maia-thought-header-logo" alt="Maia" />
            <span id="ai-header-title">Extrair com IA</span>
        </div>
      `;
      container.prepend(header);
    }
    return header;
  },

  startCountdown(durationMs, onCancel, onFinish) {
    this.ensureGlobalHeader();
    const header = document.getElementById("ai-scanner-global-header");
    const titleSpan = document.getElementById("ai-header-title");

    if (!header || !titleSpan) return;

    // Criar botão de cancelar temporário para o countdown
    // PRIMEIRO: remover botões/ações se existirem
    const oldStartBtn = header.querySelector("#btn-start-ai");
    if (oldStartBtn) oldStartBtn.remove();
    const oldActions = header.querySelector(".ai-header-actions");
    if (oldActions) oldActions.remove();

    let btnCancel = header.querySelector("#btn-countdown-cancel");
    if (!btnCancel) {
      btnCancel = document.createElement("button");
      btnCancel.id = "btn-countdown-cancel";
      btnCancel.className = "btn-stop-ai cancel-mode";
      btnCancel.innerText = "Cancelar";
      header.appendChild(btnCancel);
    }
    btnCancel.style.display = "";

    this.toggleGlow(true);
    document.body.classList.add("ai-scanning-active");

    let cancelled = false;
    let timeoutId = null;

    header.classList.remove("countdown-active");
    void header.offsetWidth;
    header.classList.add("countdown-active");

    titleSpan.innerText = "Iniciando extração...";

    const handleCancel = (e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      cancelled = true;
      clearTimeout(timeoutId);
      header.classList.remove("countdown-active");

      this.toggleGlow(false);
      document.body.classList.remove("ai-scanning-active");

      titleSpan.innerText = "Extração Cancelada";
      btnCancel.remove();

      if (onCancel) onCancel();

      // Reset após delay
      setTimeout(() => {
        this.resetHeaderToStart();
      }, 3000);
    };

    btnCancel.onclick = handleCancel;

    timeoutId = setTimeout(() => {
      if (!cancelled) {
        header.classList.remove("countdown-active");
        titleSpan.innerText = "Extração em andamento";

        // Remove botão de cancelar temporário
        btnCancel.remove();

        // INJETAR OS CONTROLES NO HEADER PRINCIPAL
        this.renderHeaderControls(header);

        if (onFinish) onFinish();
      }
    }, durationMs);

    return () => handleCancel();
  },

  renderHeaderControls(header) {
    if (!header) return;

    // Remove botões antigos se houver (para garantir ordem)
    const oldActions = header.querySelector(".ai-header-actions");
    if (oldActions) oldActions.remove();

    const actionsDiv = document.createElement("div");
    actionsDiv.className = "ai-header-actions";
    actionsDiv.innerHTML = `
        <button id="btn-header-pause" class="btn-icon-action" title="Pausar">⏸</button>
        <button id="btn-header-resume" class="btn-icon-action" title="Continuar" style="display:none;">▶</button>
        <button id="btn-header-cancel" class="btn-icon-action" title="Parar">⏹</button>
    `;

    header.appendChild(actionsDiv);

    // Bind events
    actionsDiv.querySelector("#btn-header-pause").onclick = () => {
      import("../services/ai-scanner.js").then((m) => m.AiScanner.pause());
    };
    actionsDiv.querySelector("#btn-header-resume").onclick = () => {
      import("../services/ai-scanner.js").then((m) => m.AiScanner.resume());
    };
    actionsDiv.querySelector("#btn-header-cancel").onclick = async () => {
      const confirmed = await showConfirmModal(
        "Parar Extração?",
        "Tem certeza que deseja parar a extração completamente?",
        "Parar",
        "Voltar",
      );
      if (confirmed) {
        import("../services/ai-scanner.js").then((m) => m.AiScanner.stop());
      }
    };
  },

  // Reseta o header para estado inicial (Iniciar ou Resumir)
  resetHeaderToStart() {
    const header = document.getElementById("ai-scanner-global-header");
    const titleSpan = document.getElementById("ai-header-title");
    if (!header || !titleSpan) return;

    // Remove TODOS os botões existentes
    const oldStartBtn = header.querySelector("#btn-start-ai");
    const oldCancelBtn = header.querySelector("#btn-countdown-cancel");
    const oldActions = header.querySelector(".ai-header-actions");
    const oldConfigBtn = header.querySelector("#btn-config-extractor-models");

    if (oldStartBtn) oldStartBtn.remove();
    if (oldCancelBtn) oldCancelBtn.remove();
    if (oldActions) oldActions.remove();
    if (oldConfigBtn) oldConfigBtn.remove();

    // Verifica se tem progresso para mostrar "Resumir"
    import("../services/ai-scanner.js").then((m) => {
      const hasProgress = m.AiScanner.lastProcessedPage > 0;

      titleSpan.classList.remove("animate-appear");
      void titleSpan.offsetWidth;
      titleSpan.innerText = hasProgress ? "Extração pausada" : "Extrair com IA";
      titleSpan.classList.add("animate-appear");

      const actionsDiv = document.createElement("div");
      actionsDiv.className = "ai-header-actions";

      const btnStart = document.createElement("button");
      btnStart.id = "btn-start-ai";
      btnStart.className = "btn-stop-ai start-mode animate-appear";
      btnStart.innerText = hasProgress ? "Resumir" : "Iniciar";
      btnStart.title = hasProgress ? "Continuar extração" : "Iniciar extração";

      btnStart.onclick = (ev) => {
        ev.preventDefault();
        if (m.AiScanner.lastPdfDoc) {
          m.AiScanner.start(m.AiScanner.lastPdfDoc, hasProgress);
        } else {
          customAlert("Carregue um documento primeiro.");
        }
      };

      const btnConfig = document.createElement("button");
      btnConfig.id = "btn-config-extractor-models";
      btnConfig.className = "btn-stop-ai animate-appear";
      btnConfig.title = "Configurar Modelos da Extração";
      btnConfig.style.background = "rgba(139, 92, 246, 0.15)";
      btnConfig.style.border = "1px solid rgba(139, 92, 246, 0.3)";
      btnConfig.style.color = "#a78bfa";
      btnConfig.style.borderRadius = "8px";
      btnConfig.style.cursor = "pointer";
      btnConfig.style.display = "inline-flex";
      btnConfig.style.alignItems = "center";
      btnConfig.style.justifyContent = "center";
      btnConfig.style.height = "26px";
      btnConfig.style.width = "28px";
      btnConfig.style.padding = "0";
      btnConfig.style.fontSize = "14px";
      btnConfig.innerHTML = "⚙️";

      btnConfig.onmouseenter = () => {
        btnConfig.style.background = "rgba(139, 92, 246, 0.25)";
        btnConfig.style.borderColor = "rgba(139, 92, 246, 0.5)";
      };
      btnConfig.onmouseleave = () => {
        btnConfig.style.background = "rgba(139, 92, 246, 0.15)";
        btnConfig.style.borderColor = "rgba(139, 92, 246, 0.3)";
      };

      btnConfig.onclick = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        import("./ModelSelectorModal.tsx").then((m) => {
          m.mountModelSelectorModal(
            window.selectedModelScannerDetect || "models/gemini-3.5-flash",
            (modelId) => {
              console.log("Modelos do extrator salvos!");
            },
            "extractor"
          );
        });
      };

      actionsDiv.appendChild(btnStart);
      actionsDiv.appendChild(btnConfig);
      header.appendChild(actionsDiv);
    });
  },

  setPageActive(pageNum) {
    this.activePage = pageNum;
    SidebarPageManager.openPage(pageNum);
  },

  toggleGlow(active) {
    const overlay = document.getElementById("ai-glow-overlay");
    if (overlay) {
      if (active) overlay.classList.add("visible");
      else overlay.classList.remove("visible");
    }
  },

  updateAgentStatus(pageNum, agentType, text) {
    SidebarPageManager.updateAgentStatus(pageNum, agentType, text);
  },

  addThought(title, text) {
    if (!this.activePage) return;
    let type = "analysis";
    if (title.toLowerCase().includes("auditor")) type = "auditor";
    else if (
      title.toLowerCase().includes("correção") ||
      title.toLowerCase().includes("corretor")
    )
      type = "correction";
    else if (title.toLowerCase().includes("erro")) type = "default";
    this.updateAgentStatus(this.activePage, type, text);
  },

  _uiObserver: null,

  startUiObserver() {
    this.ensureFloatingHeader();
    const mainHeader = document.getElementById("ai-scanner-global-header");
    const floatingHeader = document.getElementById("ai-floating-controls");
    const sidebarContainer = document.getElementById("viewerSidebar");

    if (!mainHeader || !floatingHeader || !sidebarContainer) {
      return;
    }

    // Limpa observer antigo se existir
    if (this._uiObserver) {
      this._uiObserver.disconnect();
    }

    // Force hide initially
    floatingHeader.classList.remove("visible");

    // Observer para detectar quando o header principal está visível
    this._uiObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Header visível -> esconde flutuante
            floatingHeader.classList.remove("visible");
          } else {
            // Header fora de vista -> mostra flutuante
            floatingHeader.classList.add("visible");
          }
        });
      },
      {
        root: sidebarContainer,
        threshold: 0,
        rootMargin: "0px",
      },
    );

    this._uiObserver.observe(mainHeader);
  },

  stopUiObserver() {
    // Desconecta o observer
    if (this._uiObserver) {
      this._uiObserver.disconnect();
      this._uiObserver = null;
    }

    // REMOVE floating header AND overlay completely
    const floatingHeader = document.getElementById("ai-floating-controls");
    if (floatingHeader) {
      floatingHeader.remove();
    }
    const overlay = document.getElementById("ai-sidebar-overlay");
    if (overlay) {
      overlay.remove();
    }

    // Reset main header to initial state
    const titleSpan = document.getElementById("ai-header-title");
    if (titleSpan) {
      titleSpan.innerText = "Extrair com IA";
    }
  },

  ensureFloatingHeader() {
    // Criar overlay container DENTRO do container de páginas
    const pagesContainer = document.getElementById("sidebar-pages-container");
    if (!pagesContainer) return null;

    let overlay = document.getElementById("ai-sidebar-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "ai-sidebar-overlay";
      pagesContainer.appendChild(overlay);
    }

    let floating = document.getElementById("ai-floating-controls");
    if (!floating) {
      floating = document.createElement("div");
      floating.id = "ai-floating-controls";
      floating.innerHTML = `
            <div class="ai-float-content">
                <span class="ai-float-status">Extração em andamento...</span>
                <div class="ai-float-actions">
                    <button id="btn-float-pause" class="btn-icon-action" title="Pausar">⏸</button>
                    <button id="btn-float-resume" class="btn-icon-action" title="Continuar" style="display:none;">▶</button>
                    <button id="btn-float-cancel" class="btn-icon-action" title="Parar">⏹</button>
                </div>
            </div>
          `;

      // Colocar dentro do overlay
      overlay.appendChild(floating);

      floating.querySelector("#btn-float-pause").onclick = () => {
        import("../services/ai-scanner.js").then((m) => m.AiScanner.pause());
      };
      floating.querySelector("#btn-float-resume").onclick = () => {
        import("../services/ai-scanner.js").then((m) => m.AiScanner.resume());
      };
      floating.querySelector("#btn-float-cancel").onclick = async () => {
        const confirmed = await showConfirmModal(
          "Parar Extração?",
          "Tem certeza que deseja parar a extração completamente?",
          "Parar",
          "Voltar",
        );
        if (confirmed) {
          import("../services/ai-scanner.js").then((m) => m.AiScanner.stop());
        }
      };
    }
    return floating;
  },

  setPausePendingState() {
    // 1. Atualizar Header Flutuante - TRAVA TODOS OS BOTÕES
    const floating = document.getElementById("ai-floating-controls");
    if (floating) {
      const btnPause = floating.querySelector("#btn-float-pause");
      const btnResume = floating.querySelector("#btn-float-resume");
      const btnCancel = floating.querySelector("#btn-float-cancel");
      const statusSpan = floating.querySelector(".ai-float-status");

      // Desabilita TODOS os botões durante o pending
      if (btnPause) {
        btnPause.disabled = true;
        btnPause.style.opacity = "0.5";
      }
      if (btnResume) {
        btnResume.disabled = true;
        btnResume.style.opacity = "0.5";
      }
      if (btnCancel) {
        btnCancel.disabled = true;
        btnCancel.style.opacity = "0.5";
      }
      if (statusSpan) {
        statusSpan.innerText = "Pausando...";
        statusSpan.classList.add("paused");
      }
    }

    // 2. Atualizar Header Principal - TRAVA TODOS OS BOTÕES
    const mainHeader = document.getElementById("ai-scanner-global-header");
    if (mainHeader) {
      const btnPause = mainHeader.querySelector("#btn-header-pause");
      const btnResume = mainHeader.querySelector("#btn-header-resume");
      const btnCancel = mainHeader.querySelector("#btn-header-cancel");
      const mainTitle = document.getElementById("ai-header-title");

      if (mainTitle) mainTitle.innerText = "Pausando...";

      // Desabilita TODOS os botões durante o pending
      if (btnPause) {
        btnPause.disabled = true;
        btnPause.style.opacity = "0.5";
      }
      if (btnResume) {
        btnResume.disabled = true;
        btnResume.style.opacity = "0.5";
      }
      if (btnCancel) {
        btnCancel.disabled = true;
        btnCancel.style.opacity = "0.5";
      }
    }
  },

  onScannerPaused(isPaused) {
    // 1. Atualizar Header Flutuante
    const floating = document.getElementById("ai-floating-controls");
    if (floating) {
      const btnPause = floating.querySelector("#btn-float-pause");
      const btnResume = floating.querySelector("#btn-float-resume");
      const btnCancel = floating.querySelector("#btn-float-cancel");
      const statusSpan = floating.querySelector(".ai-float-status");

      // Reset disabled states - HABILITA TUDO
      if (btnPause) {
        btnPause.disabled = false;
        btnPause.style.opacity = "1";
      }
      if (btnCancel) {
        btnCancel.disabled = false;
        btnCancel.style.opacity = "1";
      }
      if (btnResume) {
        btnResume.disabled = false;
        btnResume.style.opacity = "1";
      }

      if (isPaused) {
        if (btnPause) btnPause.style.display = "none";
        if (btnResume) btnResume.style.display = "inline-flex";
        if (statusSpan) {
          statusSpan.innerText = "Pausado";
          statusSpan.classList.add("paused");
        }
      } else {
        if (btnPause) btnPause.style.display = "inline-flex";
        if (btnResume) btnResume.style.display = "none";
        if (statusSpan) {
          statusSpan.innerText = "Extraindo...";
          statusSpan.classList.remove("paused");
        }
      }
    }

    // 2. Atualizar Header Principal
    const mainHeader = document.getElementById("ai-scanner-global-header");
    if (mainHeader) {
      const mainTitle = document.getElementById("ai-header-title");
      const btnPause = mainHeader.querySelector("#btn-header-pause");
      const btnResume = mainHeader.querySelector("#btn-header-resume");
      const btnCancel = mainHeader.querySelector("#btn-header-cancel");

      // Reset disabled states - HABILITA TUDO
      if (btnPause) {
        btnPause.disabled = false;
        btnPause.style.opacity = "1";
      }
      if (btnCancel) {
        btnCancel.disabled = false;
        btnCancel.style.opacity = "1";
      }
      if (btnResume) {
        btnResume.disabled = false;
        btnResume.style.opacity = "1";
      }

      if (mainTitle) {
        mainTitle.innerText = isPaused
          ? "Extração Pausada"
          : "Extração em andamento";
      }

      if (isPaused) {
        if (btnPause) btnPause.style.display = "none";
        if (btnResume) btnResume.style.display = "inline-flex";
      } else {
        if (btnPause) btnPause.style.display = "inline-flex";
        if (btnResume) btnResume.style.display = "none";
      }
    }
  },

  clear() {},
};
