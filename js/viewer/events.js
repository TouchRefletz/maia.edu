import { fecharModalConfirmacao } from "../cropper/gallery.js";
import { loadSelectionsFromJson } from "../cropper/json-loader.js";
import { ativarModoRecorte } from "../cropper/mode.js";
import { confirmarEnvioIA } from "../envio/ui-estado.js";
import { viewerState } from "../main.js";
import { AiScanner } from "../services/ai-scanner.js";
import { showConfirmModal } from "../ui/modal-confirm.js";
import { inicializarContextoViewer } from "./contexto.js";
import {
  carregarDocumentoPDF,
  mudarPagina,
  mudarZoom,
  renderAllPages,
} from "./pdf-core.js";
import { configurarResizerSidebar } from "./resizer.js";
import { montarTemplateViewer } from "./viewer-template.js";

// Expose for external usage
window.MaiaPlugin = window.MaiaPlugin || {};
window.MaiaPlugin.loadSelections = loadSelectionsFromJson;

/**
 * Configura todos os listeners de clique da interface do visualizador.
 * (Atualizado para garantir importações corretas)
 */
export function configurarEventosViewer() {
  // Helper para encurtar o código e evitar erros se o botão não existir
  const aoClicar = (id, callback) => {
    const elemento = document.getElementById(id);
    if (elemento) {
      elemento.addEventListener("click", callback);
    } else {
      console.warn(`Botão não encontrado: #${id}`);
    }
  };

  // --- Controles Básicos ---
  aoClicar("btnFecharViewer", fecharVisualizador);

  // --- Navegação ---
  aoClicar("btn-prev", () => mudarPagina(-1));
  aoClicar("btn-next", () => mudarPagina(1));

  // --- Zoom ---
  aoClicar("btnZoomOut", () => mudarZoom(-0.1));
  aoClicar("btnZoomIn", () => mudarZoom(0.1));

  // --- Mobile Floating Controls ---
  aoClicar("btnFloatingClose", fecharVisualizador);

  const toggleToolsPanel = () => {
    const toolsPanel = document.getElementById("floatingToolsPanel");
    if (!toolsPanel) return;

    if (toolsPanel.classList.contains("hidden")) {
      toolsPanel.classList.remove("hidden");
      toolsPanel.classList.remove("closing");
    } else {
      toolsPanel.classList.add("closing");
      const onAnimationEnd = () => {
        if (toolsPanel.classList.contains("closing")) {
          toolsPanel.classList.add("hidden");
          toolsPanel.classList.remove("closing");
        }
        toolsPanel.removeEventListener("animationend", onAnimationEnd);
      };
      toolsPanel.addEventListener("animationend", onAnimationEnd);
    }
  };

  aoClicar("btnMobileTools", toggleToolsPanel);

  // Controls inside the unified panel
  aoClicar("btnPrevMobile", () => mudarPagina(-1));
  aoClicar("btnNextMobile", () => mudarPagina(1));
  aoClicar("btnZoomOutMobile", () => mudarZoom(-0.1));
  aoClicar("btnZoomInMobile", () => mudarZoom(0.1));

  // --- GESTOS: Pinch-to-Zoom (Mobile) ---
  const container = document.getElementById("canvasContainer");
  if (container) {
    let pinchStartDist = 0;
    let pinchStartScale = 1;
    let isPinching = false;
    let lastPinchDist = 0;

    // PINCH START
    container.addEventListener(
      "touchstart",
      (e) => {
        const overlay = document.getElementById("selection-overlay");
        const isCropping =
          overlay &&
          (overlay.classList.contains("mode-creation") ||
            overlay.classList.contains("mode-editing"));

        if (e.touches.length === 2 && !isCropping) {
          e.preventDefault();
          isPinching = true;
          pinchStartDist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY,
          );
          pinchStartScale = viewerState.pdfScale;
          lastPinchDist = pinchStartDist;
        }
      },
      { passive: false },
    );

    // PINCH MOVE
    container.addEventListener(
      "touchmove",
      (e) => {
        if (isPinching && e.touches.length === 2) {
          e.preventDefault();
          const dist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY,
          );
          lastPinchDist = dist;
        }
      },
      { passive: false },
    );

    // PINCH END
    container.addEventListener("touchend", (e) => {
      if (isPinching && e.touches.length < 2) {
        isPinching = false;

        if (pinchStartDist > 0 && lastPinchDist > 0) {
          const ratio = lastPinchDist / pinchStartDist;
          // Apply changes if significant
          if (Math.abs(ratio - 1) > 0.05) {
            const newScale = pinchStartScale * ratio;
            const delta = newScale - pinchStartScale;
            // Use mudarZoom to ensure consistency with "ZOOM" controls
            mudarZoom(delta);
          }
        }
      }
    });
  }

  // --- NOVO: Click & Drag (Pan) para Desktop ---
  if (container) {
    let isDown = false;
    let startX, startY, scrollLeft, scrollTop;

    // Define cursor inicial como "grab" (mãozinha aberta)
    container.style.cursor = "grab";

    container.addEventListener("mousedown", (e) => {
      // 1. Bloqueia se estiver em modo de recorte (verifica overlay)
      // 1. Bloqueia se estiver em modo de recorte (verifica se está editando)
      const overlay = document.getElementById("selection-overlay");
      if (overlay && overlay.classList.contains("mode-editing")) return;

      // 2. Bloqueia se clicar em algum botão ou controle dentro do container (se houver)
      if (e.target.closest("button, .resizer")) return;

      isDown = true;
      container.classList.add("is-dragging"); // Opcional, para CSS extra se precisar
      container.style.cursor = "grabbing";

      // Previne seleção de texto durante o arrasto
      container.style.userSelect = "none";

      startX = e.pageX - container.offsetLeft;
      startY = e.pageY - container.offsetTop;
      scrollLeft = container.scrollLeft;
      scrollTop = container.scrollTop;
    });

    const stopDrag = () => {
      isDown = false;
      container.classList.remove("is-dragging");
      if (!document.getElementById("selection-overlay")) {
        container.style.cursor = "grab";
      }
      container.style.removeProperty("user-select");
    };

    container.addEventListener("mouseleave", stopDrag);
    container.addEventListener("mouseup", stopDrag);

    container.addEventListener("mousemove", (e) => {
      if (!isDown) return;
      e.preventDefault(); // Impede comportamento padrão de seleção

      const x = e.pageX - container.offsetLeft;
      const y = e.pageY - container.offsetTop;

      // Multiplicador de velocidade (1 = 1:1 com mouse)
      const walkX = (x - startX) * 1;
      const walkY = (y - startY) * 1;

      container.scrollLeft = scrollLeft - walkX;
      container.scrollTop = scrollTop - walkY;
    });
  }
}

export function realizarLimpezaCompleta() {
  // 1. Encerra cropper com segurança (Se houver resquício)
  try {
    import("../cropper/selection-overlay.js").then((module) => {
      module.removeSelectionOverlay();
    });
  } catch (_) {}

  try {
    if (typeof viewerState.cropper !== "undefined" && viewerState.cropper) {
      viewerState.cropper.destroy();
      viewerState.cropper = null;
    }
  } catch (_) {}

  // 2. Limpeza do DOM (Visual)
  const idsParaRemover = [
    "pdfViewerContainer",
    "sidebarResizer",
    "viewerSidebar",
    "reopenSidebarBtn",
    "finalModal",
  ];

  idsParaRemover.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.remove();
  });

  // Esconde/Reseta elementos persistentes
  document.getElementById("cropConfirmModal")?.classList.remove("visible");
  document.getElementById("floatingActionParams")?.classList.add("hidden");

  // 3. Gestão de Memória (URLs)
  try {
    if (window.__pdfUrls?.prova) URL.revokeObjectURL(window.__pdfUrls.prova);
    if (window.__pdfUrls?.gabarito)
      URL.revokeObjectURL(window.__pdfUrls.gabarito);
  } catch (_) {}

  // 4. Reset das Variáveis Globais (Estado)
  window.__pdfUrls = { prova: null };
  window.__fileGabarito = null;
  window.__viewerArgs = null;

  window.__isProcessing = false;
  window.__capturandoImagemFinal = false;

  window.__ultimaQuestaoExtraida = null;
  window.questaoAtual = {};

  window.__recortesAcumulados = [];
  window.recortesAcumulados = [];

  window.__imagensLimpas = {
    questao_original: [],
    questao_suporte: [],
  };
}

export async function fecharVisualizador() {
  // 1. Pergunta de Segurança
  const msg = "Todo o progresso não salvo desta questão será perdido.";

  const confirmou = await showConfirmModal(
    "Voltar ao início?",
    msg,
    "Sair",
    "Cancelar",
  );

  if (!confirmou) {
    return;
  }

  // 2. Chama a Limpeza Pesada
  realizarLimpezaCompleta();

  // 3. Redireciona/Recarrega a Interface de Upload
  // 3. Redireciona/Recarrega a Interface de Upload (Guia Manual)
  if (typeof window.iniciarFluxoUploadManual === "function") {
    window.iniciarFluxoUploadManual();
  } else if (typeof generatePDFUploadInterface === "function") {
    generatePDFUploadInterface(null); // Fallback
  }
}

/**
 * Renderiza a interface de visualização de PDF e anexa os eventos.
 */
export async function gerarVisualizadorPDF(args) {
  // FASE 1: Preparação (async para buscar manifesto)
  const urlProva = await inicializarContextoViewer(args);

  // FASE 2: Injeção do HTML no DOM
  const viewerHTML = montarTemplateViewer(args);
  document.body.insertAdjacentHTML("beforeend", viewerHTML);

  // FASE 3: Eventos (Toda a mágica em uma linha)
  configurarEventosViewer();

  // Configurações finais (resize, etc)
  configurarResizerSidebar();

  // INICIALIZA A SIDEBAR NOVA (Cropper UI)
  import("./sidebar.js").then((mod) => {
    if (mod.inicializarSidebarCompleta) mod.inicializarSidebarCompleta();
  });

  // Tenta carregar. Se der sucesso, fecha qualquer modal de conflito que ainda esteja na tela
  // (Caso o usuário tenha vindo do conflito e o modal ficou aberto por algum motivo, ou "Processing" toaster)
  const carregou = await carregarDocumentoPDF(urlProva);

  if (carregou) {
    // --- 1. INICIALIZA PÁGINAS DA SIDEBAR AGORA ---
    // User Request: "muda aqui pra ter página 3,4,5 e etc, todas do pdf, existindo no primeiro segundo"
    if (viewerState.pdfDoc) {
      import("../ui/sidebar-page-manager.js").then((mod) => {
        mod.SidebarPageManager.init(viewerState.pdfDoc.numPages);
      });
    }

    const modalConflict = document.getElementById("unified-decision-modal");
    if (modalConflict) modalConflict.remove();

    // Também fecha o toaster de processamento se houver
    const toasterContainer = document.getElementById(
      "search-toaster-container",
    );
    if (toasterContainer) toasterContainer.innerHTML = "";

    // --- AI AUTO-SCANNER TRIGGER ---
    console.log("🚀 Iniciando AI Scanner...");
    setTimeout(() => {
      if (viewerState.pdfDoc) {
        AiScanner.start(viewerState.pdfDoc);
      }
    }, 200); // Pequeno delay pra UI estabilizar
  }

  try {
    const modalEl = document.getElementById("upload-progress-modal");
    if (modalEl) modalEl.remove();
  } catch (e) {}
}
