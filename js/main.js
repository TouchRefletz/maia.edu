import "./services/transformers-config.js"; // Fix: Must run before any other import to configure env
import { cleanupExpired } from "./services/memory-service.js";
// Trigger cleanup on boot
// Trigger cleanup on boot
cleanupExpired().catch(console.error);

import { ChatStorageService } from "./services/chat-storage.js";
ChatStorageService.cleanupExpired().catch(console.error);

import { initTheme } from "./services/theme-service.js";
initTheme();

import {
  app,
  auth,
  createUserWithEmailAndPassword,
  db,
  EmailAuthProvider,
  GoogleAuthProvider,
  linkWithCredential,
  linkWithPopup,
  loginWithGoogle,
  logoutUser,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from "./firebase/init.js";

import {
  confirmExitingReview,
  gerarTelaInicial,
  iniciarModoEstudante,
  iniciarModoRevisao,
} from "./app/telas.js";
import { aplicarFiltrosBanco, limparFiltros } from "./banco/filtros-ui.js";
import {
  abrirScanOriginal,
  toggleGabarito,
  verificarRespostaBanco,
} from "./banco/interacoes.js";
import { cancelarRecorte } from "./cropper/cropper-core.js";
import { CropperState } from "./cropper/cropper-state.js";
import {
  ativarModoRecorte,
  cancelImageSlotMode,
  confirmImageSlotMode,
  onClickImagemFinal,
  removerImagemFinal,
  startImageSlotMode,
} from "./cropper/mode.js";
import { salvarQuestao } from "./cropper/save-handlers.js";
import "./debug/chat-debugger.js";
import "./ui/mobile-viewport.js"; // Mobile Keyboard Fix
import { enviarDadosParaFirebase } from "./firebase/envio.js";
import { exibirModalOriginais } from "./render/final/OriginaisModal.tsx";

import { mountApiKeyModal } from "./ui/ApiKeyModal.tsx";
import { setupDragAndDrop } from "./upload/drag-drop.js";
import { setupFormLogic } from "./upload/form-logic.js";
import { setupSearchLogic } from "./upload/search-logic.js";
import {
  getManualUploadInterfaceHTML,
  getSearchInterfaceHTML,
} from "./upload/upload-template.js";

export {
  app,
  auth,
  createUserWithEmailAndPassword,
  db,
  EmailAuthProvider,
  GoogleAuthProvider,
  linkWithCredential,
  linkWithPopup,
  loginWithGoogle,
  logoutUser,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
};

export const TIPOS_ESTRUTURA_VALIDOS = new Set([
  "texto",
  "imagem",
  "citacao",
  "titulo",
  "subtitulo",
  "lista",
  "equacao",
  "codigo",
  "destaque",
  "separador",
  "fonte",
  "tabela",
]);

// Exposing functions globally as requested
window.confirmImageSlotMode = confirmImageSlotMode;
window.cancelImageSlotMode = cancelImageSlotMode;
window.salvarQuestao = salvarQuestao;
window.cancelarRecorte = cancelarRecorte;

// Added for Slot Edit Mode
import { deleteImageSlot, editImageSlotMode } from "./cropper/mode.js";
import { highlightGroup } from "./cropper/selection-overlay.js";

window.editImageSlotMode = editImageSlotMode;
window.deleteImageSlot = deleteImageSlot;
window.highlightCropGroup = highlightGroup;
window.CropperState = CropperState;

window.__ultimaQuestaoExtraida = null;
window.__recortesAcumulados = [];
window.__isProcessing = false;
export let questaoAtual = {};
export const uploadState = {
  imagensConvertidas: 0,
};

// Variáveis de controle
export const bancoState = {
  ultimoKeyCarregada: null,
  observadorScroll: null,
  carregandoMais: false,
  todasQuestoesCache: [], // Cache local para filtros rápidos
};
export const TAMANHO_PAGINA = 20;

// Variáveis de controle de IA
export const aiState = {
  lastThoughtSig: "",
  thoughtsBootstrapped: false,
};

// Variáveis de controle de UI global
export const uiState = {
  alertTimeout: null,
  undoToastTimer: null,
};

// VariÃ¡veis de escopo global para o visualizador
export const viewerState = {
  pdfDoc: null,
  pageNum: 1,
  pdfScale: 1.0, // Zoom inicial
  cropper: null,
  isRendering: false, // Prevines renderizaÃ§Ãµes simultÃ¢neas
  scrollPos: { top: 0, left: 0 },
};
window.__viewerArgs = null; // guarda os arquivos e title
window.__pdfUrls = { prova: null };

window.__imagensLimpas = window.__imagensLimpas || {
  questao_original: [],
  questao_suporte: [],
};

window.__target_alt_letra = null;
window.__target_alt_index = null;

// GLOBAL LISTENER (Gerente de Cliques)
// Proteção contra múltiplas inicializações
if (!window.__globalListenerRegistered) {
  window.__globalListenerRegistered = true;
  console.log(" Inicializando Global Listener (Única vez)...");

  // --- Slot Mode & Image Creation Integration ---
  window.addEventListener("image-slot-action", (e) => {
    const { action, slotId } = e.detail;
    console.log(`[Main] Slot Action: ${action} for ${slotId}`);

    if (action === "start-capture") {
      // Standard capture for new image
      if (window.startImageSlotMode) {
        window.startImageSlotMode(slotId, e.detail.parentGroupId);
      }
    } else if (action === "edit") {
      // Edit existing crop
      if (window.editImageSlotMode) {
        window.editImageSlotMode(slotId);
      }
    } else if (action === "delete") {
      // Delete the slot
      if (window.deleteImageSlot) {
        window.deleteImageSlot(slotId);
      }
    }
  });

  document.addEventListener("click", function (e) {
    // --- NOVO: Handler Genérico via data-action ---
    // Substitui os antigos onClick do React para permitir HTML estático
    const actionEl = e.target.closest("[data-action]");
    if (actionEl) {
      const { action, slotId, context, src, letter, idx, parentGroupId } =
        actionEl.dataset;
      // Compatibilidade: slotId ou idx
      const id = slotId || idx;
      if (action === "select-slot" || action === "edit-slot") {
        startImageSlotMode(id, parentGroupId);
        return;
      }
      if (action === "remove-slot") {
        removerImagemFinal(id, context);
        return;
      }
      if (action === "expand-image") {
        if (src && window.expandirImagem) window.expandirImagem(src);
        return;
      }
      if (action === "select-slot-alt" || action === "edit-slot-alt") {
        if (window.iniciar_captura_para_slot_alternativa) {
          window.iniciar_captura_para_slot_alternativa(letter, id);
        }
        return;
      }
      // Se tiver action mas não casou com os acima, pode deixar passar ou logar
      if (action === "confirm-crop") {
        salvarQuestao();
        return;
      }
      if (action === "cancel-crop") {
        cancelarRecorte();
        return;
      }
    }
    // --- CASO 1: BotÃµes de Captura de Slot ---
    const gatilhoSlot = e.target.closest(".js-captura-trigger");
    if (gatilhoSlot) {
      startImageSlotMode(gatilhoSlot.dataset.idx);
      return;
    }

    // --- CASO 2: BotÃ£o de Recortar Final ---
    const gatilhoRecorte = e.target.closest(".js-recortar-final");
    if (gatilhoRecorte) {
      onClickImagemFinal();
      return;
    }

    // --- CASO 3: BotÃ£o de Remover Imagem ---
    const gatilhoRemover = e.target.closest(".js-remover-img");
    if (gatilhoRemover) {
      const { idx, ctx } = gatilhoRemover.dataset;
      removerImagemFinal(idx, ctx);
      return;
    }

    // --- CASO 4: BotÃ£o Ver Originais ---
    const gatilhoOriginais = e.target.closest(".js-ver-originais");
    if (gatilhoOriginais) {
      exibirModalOriginais();
      return;
    }

    // --- CASO 5: BotÃ£o Confirmar e Enviar ---
    const gatilhoEnvio = e.target.closest(".js-confirmar-envio");
    if (gatilhoEnvio) {
      enviarDadosParaFirebase();
      return;
    }

    // --- CASO 6: Botão Voltar (Tela Inicial) ---
    const gatilhoVoltar = e.target.closest(".js-voltar-inicio");
    if (gatilhoVoltar) {
      // Usa a função async dentro do listener síncrono
      (async () => {
        const canExit = await confirmExitingReview();
        if (canExit) {
          gerarTelaInicial();
        }
      })();
      return;
    }

    // --- CASO 6.1: Toggle Nav Sidebar ---
    const gatilhoToggleNav = e.target.closest(".js-toggle-nav");
    if (gatilhoToggleNav) {
      document.querySelector(".nav-sidebar")?.classList.toggle("open");
      document
        .querySelector(".nav-sidebar-overlay")
        ?.classList.toggle("visible");
      return;
    }

    // --- CASO 6.2: Close Nav on Overlay Click ---
    const gatilhoCloseNav = e.target.closest(".js-close-nav");
    if (gatilhoCloseNav) {
      document.querySelector(".nav-sidebar")?.classList.remove("open");
      document
        .querySelector(".nav-sidebar-overlay")
        ?.classList.remove("visible");
      return;
    }

    // --- CASO 7: Botões de Extração (Busca vs Upload) ---
    if (e.target.closest(".js-iniciar-busca")) {
      window.iniciarFluxoPesquisa();
      return;
    }

    if (e.target.closest(".js-iniciar-upload")) {
      window.iniciarFluxoUploadManual();
      return;
    }

    // --- CASO 9: Card Iniciar Modo Estudante (Antigo CASO 8) ---
    const gatilhoEstudante = e.target.closest(".js-iniciar-estudante");
    if (gatilhoEstudante) {
      iniciarModoEstudante();
      return;
    }

    // --- CASO 9: Card Iniciar Modo Revisão ---
    const gatilhoRevisao = e.target.closest(".js-iniciar-revisao");
    if (gatilhoRevisao) {
      iniciarModoRevisao();
      return;
    }

    // --- CASO 9: BotÃ£o Limpar Filtros ---
    const gatilhoLimpar = e.target.closest(".js-limpar-filtros");
    if (gatilhoLimpar) {
      limparFiltros();
      return;
    }

    // --- CASO 10: BotÃ£o Aplicar Filtros (Busca) ---
    const gatilhoFiltrar = e.target.closest(".js-aplicar-filtros");
    if (gatilhoFiltrar) {
      aplicarFiltrosBanco();
      return;
    }

    // --- NOVO CASO 11: BotÃ£o Toggle Gabarito ---
    const gatilhoGabarito = e.target.closest(".js-toggle-gabarito");
    if (gatilhoGabarito) {
      // Recupera o ID que guardamos no HTML
      const cardId = gatilhoGabarito.dataset.cardId;
      toggleGabarito(cardId);
      return;
    }

    // --- NOVO CASO 12: Verificar Resposta (Alternativas) ---
    const gatilhoResposta = e.target.closest(".js-verificar-resp");
    if (gatilhoResposta) {
      // Extrai os dados do dataset do botÃ£o clicado
      const { cardId, letra, correta } = gatilhoResposta.dataset;

      // Chama a funÃ§Ã£o lÃ³gica passando o elemento (gatilhoResposta) e os dados
      verificarRespostaBanco(gatilhoResposta, cardId, letra, correta);
      return;
    }

    // --- NOVO CASO 13: Ver Scan Original (Enunciado ou Gabarito) ---
    const gatilhoScan = e.target.closest(".js-ver-scan");
    if (gatilhoScan) {
      // Passamos o prÃ³prio elemento HTML para a funÃ§Ã£o,
      // igual o 'this' fazia no onclick inline.
      abrirScanOriginal(gatilhoScan);
      return;
    }

    // --- NOVO CASO 14: Configurar API Key ---
    const gatilhoApi = e.target.closest(".js-config-api");
    if (gatilhoApi) {
      mountApiKeyModal();
      return;
    }
  });

  // --- Slot Mode & Image Creation Integration ---
  window.addEventListener("image-slot-action", (e) => {
    const { action, slotId } = e.detail;
    console.log(`[Main] Slot Action: ${action} for ${slotId}`);

    if (action === "start-capture") {
      // Standard capture for new image
      if (window.startImageSlotMode) {
        window.startImageSlotMode(slotId);
      }
    } else if (action === "edit") {
      // Edit existing crop
      if (window.editImageSlotMode) {
        window.editImageSlotMode(slotId);
      }
    } else if (action === "delete") {
      // Delete the slot
      if (window.deleteImageSlot) {
        window.deleteImageSlot(slotId);
      }
    }
  });

  // --- Slot Mode Persistence Listener ---
  // Atualizado para Sistema de Imagens via PDF (em vez de base64)
  window.addEventListener("slot-update", (e) => {
    const { slotId, action, cropData, previewUrl } = e.detail;
    console.log(`[Main] Slot Update: ${action} for ${slotId}`, cropData);

    if (
      !window.__ultimaQuestaoExtraida ||
      !window.__ultimaQuestaoExtraida.estrutura
    ) {
      console.warn(
        "[Main] Nenhuma questão extraída encontrada para atualizar.",
      );
      return;
    }

    // Extract numeric index from slotId (e.g., "questao_img_0" -> 0, or just "0" -> 0)
    let index;
    const match = String(slotId).match(/(\d+)$/);
    if (match) {
      index = Number(match[1]);
    } else {
      index = Number(slotId);
    }

    // Find the N-th image block in structure
    let imgCounter = 0;
    let targetBlock = null;

    for (let i = 0; i < window.__ultimaQuestaoExtraida.estrutura.length; i++) {
      const bloco = window.__ultimaQuestaoExtraida.estrutura[i];
      const tipo = (bloco.tipo || "imagem").toLowerCase();

      if (tipo === "imagem") {
        if (imgCounter === index) {
          targetBlock = bloco;
          break;
        }
        imgCounter++;
      }
    }

    if (targetBlock) {
      if (action === "filled" && cropData) {
        // ============================================
        // SISTEMA DE IMAGENS VIA PDF
        // Salva coordenadas em vez de base64
        // ============================================

        // URL do PDF (do manifesto, pode ser null se local)
        const pdfUrl =
          window.__pdfOriginalUrl || window.__pdfDownloadUrl || null;
        targetBlock.pdf_url = pdfUrl;

        // Coordenadas para Embed (Chrome/Edge)
        targetBlock.pdf_page = cropData.pdf_page;
        targetBlock.pdf_zoom = cropData.pdf_zoom;
        targetBlock.pdf_left = cropData.pdf_left;
        targetBlock.pdf_top = cropData.pdf_top;
        targetBlock.pdf_width = cropData.pdf_width;
        targetBlock.pdf_height = cropData.pdf_height;

        // Coordenadas para PDF.js Fallback
        targetBlock.pdfjs_source_w = cropData.pdfjs_source_w;
        targetBlock.pdfjs_source_h = cropData.pdfjs_source_h;
        targetBlock.pdfjs_x = cropData.pdfjs_x;
        targetBlock.pdfjs_y = cropData.pdfjs_y;
        targetBlock.pdfjs_crop_w = cropData.pdfjs_crop_w;
        targetBlock.pdfjs_crop_h = cropData.pdfjs_crop_h;

        // Preview temporário (blob URL, só funciona na sessão atual) REMOVIDO POR SOLICITAÇÃO
        // targetBlock.imagem_url = previewUrl || cropData.previewUrl;

        delete targetBlock.url;

        targetBlock.tipo = "imagem";

        // SYNC VALIDATION STATE
        if (!window.__imagensLimpas.questao_original)
          window.__imagensLimpas.questao_original = [];

        // [MODIFIED] Save the FULL DATA OBJECT instead of just "filled"
        // This allows OriginaisModal to access the crop parameters later
        window.__imagensLimpas.questao_original[index] = {
          id: slotId,
          pdf_url: pdfUrl,
          ...cropData,
        };
      } else if (action === "cleared") {
        // Limpa todos os dados de imagem
        targetBlock.pdf_url = null;
        targetBlock.pdf_page = null;
        targetBlock.pdf_zoom = null;
        targetBlock.pdf_left = null;
        targetBlock.pdf_top = null;
        targetBlock.pdf_width = null;
        targetBlock.pdf_height = null;
        targetBlock.pdfjs_source_w = null;
        targetBlock.pdfjs_source_h = null;
        targetBlock.pdfjs_x = null;
        targetBlock.pdfjs_y = null;
        targetBlock.pdfjs_crop_w = null;
        targetBlock.pdfjs_crop_h = null;

        targetBlock.url = null;

        // SYNC VALIDATION STATE
        if (window.__imagensLimpas.questao_original) {
          window.__imagensLimpas.questao_original[index] = null;
        }
      }

      // Re-render - BUT SKIP during batch processing to avoid focus issues
      // [FIX] When Hub is active (batch mode), don't re-render as it would:
      // 1. Find the visible question tab container
      // 2. Render into it and potentially activate it
      // 3. Steal focus from Hub and break batch processing
      // The data update already happened above, so the tab will render correctly when activated.
      import("./ui/sidebar-tabs.js").then(({ isHubActive }) => {
        if (isHubActive()) {
          console.log(
            "[Main] Slot Update: Skipping re-render (Hub active, batch mode)",
          );
          return;
        }

        import("./render/final/render-questao.js").then(
          ({ renderizarQuestaoFinal }) => {
            renderizarQuestaoFinal(window.__ultimaQuestaoExtraida);
          },
        );
      });
    }
  });

  // --- AI Image Extraction Handler REMOVED ---
  // O fluxo agora passa por startImageSlotModeWithCrop que cria uma seleção visual
  // para o usuário confirmar. Isso evita a criação de base64/blob URLs.
  // O confirmSlotMode já calcula as coordenadas corretamente.
}

// Listener Ãºnico para fechar menus de passos ao clicar fora
if (!window._stepMenuGlobalListener) {
  document.addEventListener("click", (e) => {
    // Se o clique NÃƒO foi num botÃ£o de abrir menu, fecha todos os menus de passos
    if (
      !e.target.closest(".btn-toggle-step-add") &&
      !e.target.closest(".step-menu-content")
    ) {
      document
        .querySelectorAll(".step-menu-content")
        .forEach((m) => m.classList.add("hidden"));
    }
  });
  window._stepMenuGlobalListener = true;
}

window.__targetSlotContext = null; // 'questao' ou 'gabarito'
/**
 * 4. FUNÃ‡ÃƒO PRINCIPAL (MAESTRO)
 * A Ãºnica que vocÃª chama no seu cÃ³digo.
 */
/**
 * 4. FUNÇÃO DE PESQUISA (Search Flow)
 */
window.iniciarFluxoPesquisa = function () {
  // Limpeza
  document.body.innerHTML = "";
  const viewer = document.getElementById("pdfViewerContainer");
  if (viewer) viewer.remove();

  // 1. Renderizar HTML de Busca
  document.body.innerHTML = getSearchInterfaceHTML();

  // 2. Setup Lógica de Busca
  setupSearchLogic();
};

/**
 * 5. FUNÇÃO DE UPLOAD MANUAL (Manual Upload Flow)
 */
window.iniciarFluxoUploadManual = function () {
  // Limpeza
  document.body.innerHTML = "";
  const viewer = document.getElementById("pdfViewerContainer");
  if (viewer) viewer.remove();

  // 1. Renderizar HTML de Upload
  document.body.innerHTML = getManualUploadInterfaceHTML();

  // 2. Setup Lógica de Form (Upload)
  // Precisamos chamar setupDragAndDrop e setupFormLogic
  // setupDragAndDrop espera elementos específicos que existem no template manual
  const dropZone = document.getElementById("dropZoneProva");
  const fileInput = document.getElementById("pdfFileInput");
  const fileNameDisplay = document.getElementById("fileName");

  const elements = {
    titleInput: document.getElementById("pdfTitleInput"),
    // Year input removido do template, passamos null para evitar crash na desestruturação
    yearInput: null,
    pdfInput: document.getElementById("pdfFileInput"),
    fileNameDisplay:
      document.getElementById("fileName") ||
      document.getElementById("fileNameDisplay"),
    dropZoneProva: document.getElementById("dropZoneProva"),
    form: document.getElementById("pdfUploadForm"),
  };

  if (dropZone && fileInput && fileNameDisplay) {
    setupDragAndDrop(dropZone, fileInput, fileNameDisplay);
  }

  setupFormLogic(elements);
};

// Deprecated Legacy Function (kept if needed for internal references)
window.generatePDFUploadInterface = window.iniciarFluxoPesquisa;

window.iniciar_captura_para_slot_alternativa = function (letra, index) {
  window.__target_alt_letra = String(letra || "")
    .trim()
    .toUpperCase();
  window.__target_alt_index = Number(index);

  // Reaproveita teu fluxo existente de recorte/UI
  ativarModoRecorte(); // jÃ¡ existe e liga o cropper + botÃµes flutuantes [file:2]
};

window.iniciar_ocr_campo = function (elementId) {
  // Define o contexto global para o salvar lidar depois
  window.__targetSlotContext = "ocr_field_" + elementId;
  window.__targetSlotIndex = null; // não usamos index numérico aqui, o ID já basta

  // Inicia o modo de recorte (mesma UI de sempre)
  ativarModoRecorte();
};

// --- NOVO SISTEMA DE ZOOM DE IMAGEM (MODAL) ---
window.expandirImagem = function (src) {
  // Remove modal anterior se existir
  const oldModal = document.getElementById("imgZoomModal");
  if (oldModal) oldModal.remove();

  const modalHtml = `
    <div id="imgZoomModal" class="final-modal-overlay visible" style="z-index: 999999; background: rgba(0,0,0,0.9); cursor: zoom-out;" onclick="this.remove()">
        <div style="display:flex; justify-content:center; align-items:center; width:100%; height:100%;">
            <img src="${src}" style="max-width:95%; max-height:95%; border-radius:4px; box-shadow: 0 0 20px rgba(0,0,0,0.5); object-fit: contain;">
            <button style="position:absolute; top:20px; right:20px; background:white; border:none; border-radius:50%; width:40px; height:40px; font-weight:bold; cursor:pointer;">âœ•</button>
        </div>
    </div>`;

  document.body.insertAdjacentHTML("beforeend", modalHtml);
};

// --- DEBUG FUNCTION (Temporary) ---
window.debugRenderTestQuestion = async function () {
  console.log("Criando questão de teste COMPLETA (Debug)...");

  // Dynamic imports
  const { createQuestionTab, updateTabStatus } =
    await import("./ui/sidebar-tabs.js");
  const { _processarGabarito, _processarQuestao } =
    await import("./normalize/payload.js");

  // 1. Setup Visual Crop (Corresponds to Question)
  const group = CropperState.createGroup({
    status: "verified", // Looks "done"
    tags: ["ia", "revisada"], // Simula que já foi processado/enviado
    tipo: "questao_completa",
  });
  console.log("Grupo de Debug criado:", group);

  const pageNum = 2; // Fixed to page 2 for testing
  const currentScale = viewerState.pdfScale || 1.0;

  // Visual text on page
  // Visual text on page - QUESTION CROP (Big Box)
  const questionAnchor = {
    anchorPageNum: pageNum,
    relativeLeft: 50,
    relativeTop: 50,
    unscaledW: 550, // All content
    unscaledH: 500,
  };

  // Visual image on page - IMAGE CROP (Small Box inside Question)
  const imageAnchor = {
    anchorPageNum: pageNum,
    relativeLeft: 100,
    relativeTop: 150,
    unscaledW: 450,
    unscaledH: 250,
  };

  // Register the Question Crop (so it shows as the group's "original")
  CropperState.addCropToGroup(group.id, { anchorData: questionAnchor });

  // 2. Create Tab linked to Group
  const tabId = createQuestionTab(String(group.id), "Questão Debug (Completa)");

  // 2.1 Calculate Real Crop Context for simulation
  const { calculateCropContext } = await import("./cropper/mode.js");
  const { DataNormalizer } = await import("./normalizer/data-normalizer.js");

  // A. Calculate Question Context (For fotos_originais)
  const questionCropData = await calculateCropContext(questionAnchor);
  const debugFotosOriginais = [];
  if (questionCropData) {
    questionCropData.id = 0;
    debugFotosOriginais.push(questionCropData);
  }

  // B. Calculate Image Context (For inner structure)
  const imageCropData = await calculateCropContext(imageAnchor);

  // 3. Prepare Mock Data: QUESTION
  const shouldUseGlobalPdf =
    typeof window !== "undefined" && window.__pdfOriginalUrl;

  const mockQuestaoRaw = {
    identificacao: "DEBUG-FULL-001",
    materias_possiveis: ["Debug", "FullStack"],
    palavras_chave: ["teste", "gabarito", "mock"],
    estrutura: [
      {
        tipo: "titulo",
        conteudo: "Questão de Teste Completa",
      },
      {
        tipo: "texto",
        conteudo:
          "Esta questão simula um fluxo **completo** de extração, incluindo enunciado, imagem e **gabarito** gerado por IA.",
      },
      {
        tipo: "imagem",
        conteudo: "Figura Exemplo",
        pdf_url: shouldUseGlobalPdf ? window.__pdfOriginalUrl : null,
        // Use Image Specific Crop
        pdf_page: imageCropData
          ? imageCropData.pdf_page
          : imageAnchor.anchorPageNum,
        pdf_zoom: imageCropData ? imageCropData.pdf_zoom : 150,
        pdf_left: imageCropData
          ? imageCropData.pdf_left
          : imageAnchor.relativeLeft,
        pdf_top: imageCropData
          ? imageCropData.pdf_top
          : imageAnchor.relativeTop,
        pdf_width: imageCropData
          ? imageCropData.pdf_width
          : `${imageAnchor.unscaledW}px`,
        pdf_height: imageCropData
          ? imageCropData.pdf_height
          : `${imageAnchor.unscaledH}px`,

        pdfjs_source_w: imageCropData?.pdfjs_source_w,
        pdfjs_source_h: imageCropData?.pdfjs_source_h,
        pdfjs_x: imageCropData?.pdfjs_x,
        pdfjs_y: imageCropData?.pdfjs_y,
        pdfjs_crop_w: imageCropData?.pdfjs_crop_w,
        pdfjs_crop_h: imageCropData?.pdfjs_crop_h,
        // Fallback info omitted for brevity, logic handles it
      },
      {
        tipo: "texto",
        conteudo:
          "Assinale a alternativa que descreve corretamente o status do teste:",
      },
    ],
    // Dynamic generation of fotos_originais
    fotos_originais: debugFotosOriginais,
    alternativas: [
      {
        letra: "A",
        estrutura: [{ tipo: "texto", conteudo: "O teste falhou." }],
      },
      {
        letra: "B",
        estrutura: [{ tipo: "texto", conteudo: "Faltou o gabarito." }],
      },
      {
        letra: "C",
        estrutura: [
          {
            tipo: "texto",
            conteudo: "O teste foi um **sucesso** completo.",
          },
        ],
      },
      {
        letra: "D",
        estrutura: [{ tipo: "texto", conteudo: "O PDF não carregou." }],
      },
      {
        letra: "E",
        estrutura: [
          {
            tipo: "texto",
            conteudo:
              "Nenhuma das anteriores. Mas aqui vai uma fórmula: $x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$",
          },
        ],
      },
    ],
  };

  // 4. Prepare Mock Data: GABARITO (Matching js/ia/config.js)
  const mockGabaritoRaw = {
    alternativa_correta: "C",
    justificativa_curta:
      "A alternativa C é a correta pois o script injetou com sucesso ambos os objetos de dados.",
    confianca: 0.98,
    // Complexidade
    analise_complexidade: {
      fatores: {
        texto_extenso: false,
        vocabulario_complexo: false,
        multiplas_fontes_leitura: true,
        interpretacao_visual: true,
        dependencia_conteudo_externo: false,
        interdisciplinaridade: false,
        contexto_abstrato: false,
        raciocinio_contra_intuitivo: false,
        abstracao_teorica: false,
        deducao_logica: true,
        resolucao_multiplas_etapas: false,
        transformacao_informacao: false,
        distratores_semanticos: true,
        analise_nuance_julgamento: false,
      },
      justificativa_dificuldade:
        "Questão de nível fácil, mas exige validação visual do resultado.",
    },
    // Créditos
    creditos: {
      origem_resolucao: "gerado_pela_ia",
      material_identificado: false,
      precisa_credito_generico: true,
      texto_credito_sugerido: "Gerado via Debug Console",
      autor_ou_instituicao: "FUVEST",
    },
    alertas_credito: [],
    // Explicação Passo-a-Passo
    explicacao: [
      {
        estrutura: [
          { tipo: "titulo", conteudo: "Análise da Solicitação" },
          {
            tipo: "texto",
            conteudo:
              "O usuário solicitou que a função `debugRenderTestQuestion` criasse todos os dados, incluindo o gabarito.",
          },
        ],
        origem: "gerado_pela_ia",
        fonte_material: "Prompt do Usuário",
        evidencia: "Histórico do Chat",
      },
      {
        estrutura: [
          { tipo: "titulo", conteudo: "Verificação" },
          {
            tipo: "texto",
            conteudo:
              "Ao rodar o script, verificamos se o objeto `window.__ultimoGabaritoExtraido` foi preenchido.",
          },
          {
            tipo: "equacao",
            conteudo: "Success = True",
          },
        ],
        origem: "gerado_pela_ia",
        fonte_material: "Lógica do Código",
        evidencia: "Console Logs",
      },
    ],
    // Análise das Alternativas
    alternativas_analisadas: [
      {
        letra: "A",
        correta: false,
        motivo: "O teste não falhou, pois os dados foram gerados.",
      },
      {
        letra: "B",
        correta: false,
        motivo: "O gabarito está presente neste objeto, logo não faltou.",
      },
      {
        letra: "C",
        correta: true,
        motivo: "Correto. Todos os requisitos do prompt foram atendidos.",
      },
      {
        letra: "D",
        correta: false,
        motivo: "O PDF (global ou fallback) foi referenciado.",
      },
      {
        letra: "E",
        correta: false,
        motivo: "A letra C é a correta.",
      },
    ],
    coerencia: {
      alternativa_correta_existe: true,
      tem_analise_para_todas: true,
      observacoes: ["Dados gerados sinteticamente."],
    },
    // Fallback/Legacy
    alternativa_correta_letra: "C",
  };

  // 5. Process & Store Globally (Simulating extraction pipeline)
  const questaoNorm = _processarQuestao(mockQuestaoRaw);
  const gabaritoNorm = _processarGabarito(mockGabaritoRaw);

  // --- NORMALIZAÇÃO DE DEBUG ---
  console.log("Aplicando Normalização (Debug)...");

  // 1. Instituição (Prioridade: Gabarito > Título)
  const instGabarito =
    gabaritoNorm.creditos?.autorouinstituicao ||
    gabaritoNorm.creditos?.autor_ou_instituicao;

  if (instGabarito) {
    const normalizedInst = await DataNormalizer.normalize(
      instGabarito,
      "institution",
    );
    questaoNorm.instituicao = normalizedInst;
    // Update also the source credit to reflect in UI/Debug
    if (gabaritoNorm.creditos) {
      gabaritoNorm.creditos.autorouinstituicao = normalizedInst;
    }
  }

  // 2. Keywords
  if (questaoNorm.palavras_chave && Array.isArray(questaoNorm.palavras_chave)) {
    questaoNorm.palavras_chave = await Promise.all(
      questaoNorm.palavras_chave.map((k) =>
        DataNormalizer.normalize(k, "keyword"),
      ),
    );
  }

  // 3. Bufferiza Prova
  const materialProva =
    gabaritoNorm.creditos?.material || gabaritoNorm.creditos?.ano;
  if (materialProva) {
    DataNormalizer.bufferTerm(materialProva, "exam");
  }

  // --- DEBUG: FLUSH PARA TESTAR EXPANSÃO IA ---
  console.log("[Debug] Iniciando flush com expansão IA...");
  await DataNormalizer.flush();
  console.log("[Debug] Flush completo!");
  // -----------------------------

  window.__ultimaQuestaoExtraida = questaoNorm;
  window.__ultimoGabaritoExtraido = gabaritoNorm;

  console.log("Dados Normalizados:", { questaoNorm, gabaritoNorm });

  // 6. Update Tab -> Triggers Render
  // Passing the raw 'mockQuestaoRaw' as response is typical for the listener,
  // but since we already set globals, the renderer will pick them up.
  setTimeout(() => {
    updateTabStatus(tabId, {
      status: "complete",
      response: {
        resultado: mockQuestaoRaw, // Convention: 'resultado' wrap
        // We can attach gabarito here too if the payload handler supports it,
        // but setting the global variable above ensures _prepararInterfaceBasica finds it.
      },
      label: "Questão Debug (Pronta)",
    });

    CropperState.setActiveGroup(group.id);
    console.log("Fluxo de teste finalizado. Interface deve atualizar.");
  }, 100);
};

gerarTelaInicial(); // Chama inicial ao carregar
window.setTimeout(() => mountApiKeyModal(false), 500); // Tenta abrir (se nÃ£o tiver chave)
