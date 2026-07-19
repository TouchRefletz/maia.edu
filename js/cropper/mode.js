import { viewerState } from "../main.js";
import { renderizarQuestaoFinal } from "../render/final/render-questao.js";
import { customAlert } from "../ui/GlobalAlertsLogic.tsx";
import { irParaPagina } from "../viewer/pdf-core.js";
import { mostrarPainel } from "../viewer/sidebar.js";
import { iniciarCropper } from "./cropper-core.js";
import { CropperState } from "./cropper-state.js";
import { refreshOverlayPosition } from "./selection-overlay.js";

// Internal State Tracking
let __targetSlotIndex = null;
let __editingGroupId = null;

// Helper lazy load to avoid cycle if possible, or just import top level if safe.
// sidebar-tabs.js usually safe.
import { getActiveTab } from "../ui/sidebar-tabs.js";

export function ativarModoRecorte() {
  const floatParams = document.getElementById("floatingActionParams");
  if (floatParams) {
    floatParams.classList.remove("hidden");
  }

  if (viewerState.cropper) return;
  mostrarPainel();
  iniciarCropper();
  const btnHeader = document.getElementById("btnRecortarHeader");
  if (btnHeader) {
    btnHeader.style.opacity = "0.5";
    btnHeader.style.pointerEvents = "none";
  }
}

export function iniciarCapturaParaSlot(index, contexto) {
  console.log(`[SlotMode] Iniciando captura para slot ${index} do contexto ${contexto}`);
  window.__targetSlotIndex = Number(index);
  window.__targetSlotContext = contexto;
  window.__target_alt_letra = null;
  window.__target_alt_index = null;

  ativarModoRecorte();

  // Create a new temporary group for this slot
  const tempGroup = CropperState.createGroup({
    tags: ["slot-mode", "NOVO"],
    label: `Slot ${index} (${contexto})`,
  });

  if (!tempGroup.tags.includes("slot-mode")) {
    tempGroup.tags.push("slot-mode");
  }

  const activeTab = getActiveTab();
  let parentGroupId = null;
  if (activeTab && activeTab.groupId) {
    parentGroupId = activeTab.groupId;
  }

  tempGroup.metadata = {
    slotId: index,
    contexto: contexto,
    parentGroupId: parentGroupId,
  };

  CropperState.setActiveGroup(tempGroup.id);
  refreshOverlayPosition();

  const btnConfirm = document.querySelector(
    "#floatingActionParams .btn--success",
  );
  if (btnConfirm) {
    btnConfirm.innerText = "📍 Preencher Espaço";
  }
}

export function iniciarCapturaParaSlotAlternativa(letra, index) {
  console.log(`[SlotMode] Iniciando captura para alternativa: ${letra}, index: ${index}`);

  window.__target_alt_letra = String(letra || "").trim().toUpperCase();
  window.__target_alt_index = Number(index);
  window.__targetSlotIndex = null;
  window.__targetSlotContext = null;

  if (!viewerState.cropper) {
    mostrarPainel();
    iniciarCropper();
    const btnHeader = document.getElementById("btnRecortarHeader");
    if (btnHeader) {
      btnHeader.style.opacity = "0.5";
      btnHeader.style.pointerEvents = "none";
    }
  }

  const tempGroup = CropperState.createGroup({
    tags: ["slot-mode", "NOVO"],
    label: `Alternativa ${letra}`,
  });

  if (!tempGroup.tags.includes("slot-mode")) {
    tempGroup.tags.push("slot-mode");
  }

  const activeTab = getActiveTab();
  let parentGroupId = null;
  if (activeTab && activeTab.groupId) {
    parentGroupId = activeTab.groupId;
  }

  tempGroup.metadata = {
    altLetra: letra,
    altIndex: index,
    parentGroupId: parentGroupId,
  };

  CropperState.setActiveGroup(tempGroup.id);
  refreshOverlayPosition();

  window.dispatchEvent(
    new CustomEvent("image-slot-mode-change", {
      detail: { slotId: `alt_${letra}_${index}`, mode: "capturing" },
    }),
  );
}

export function iniciarOcrCampo(elementId) {
  console.log(`[SlotMode] Iniciando OCR para campo: ${elementId}`);

  window.__targetSlotContext = "ocr_field_" + elementId;
  window.__targetSlotIndex = null;
  window.__target_alt_letra = null;
  window.__target_alt_index = null;

  ativarModoRecorte();

  const tempGroup = CropperState.createGroup({
    tags: ["slot-mode", "NOVO"],
    label: `OCR: ${elementId}`,
  });

  if (!tempGroup.tags.includes("slot-mode")) {
    tempGroup.tags.push("slot-mode");
  }

  const activeTab = getActiveTab();
  let parentGroupId = null;
  if (activeTab && activeTab.groupId) {
    parentGroupId = activeTab.groupId;
  }

  tempGroup.metadata = {
    elementId: elementId,
    parentGroupId: parentGroupId,
  };

  CropperState.setActiveGroup(tempGroup.id);
  refreshOverlayPosition();

  const btnConfirm = document.querySelector(
    "#floatingActionParams .btn--success",
  );
  if (btnConfirm) {
    btnConfirm.innerText = "🔍 Ler Campo";
  }
}


export function iniciarCapturaImagemQuestao() {
  window.__capturandoImagemFinal = true;
  window.__targetSlotIndex = null;
  window.__targetSlotContext = null;
  ativarModoRecorte();
  const btnConfirm = document.querySelector(
    "#floatingActionParams .btn--success",
  );
  if (btnConfirm) {
    const destino = window.modo === "gabarito" ? "Gabarito" : "Questão";
    btnConfirm.innerText = `💾 Salvar Figura (${destino})`;
    btnConfirm.classList.remove("btn--success");
    btnConfirm.classList.add("btn--warning");
  }
}

export function onClickImagemFinal() {
  iniciarCapturaImagemQuestao();
}

export function removerImagemFinal(index, tipo) {
  if (tipo === "gabarito") {
    if (window.__ultimoGabaritoExtraido?.imagens_suporte) {
      window.__ultimoGabaritoExtraido.imagens_suporte.splice(index, 1);
      window.__imagensLimpas.gabarito_suporte.splice(index, 1);
      renderizarQuestaoFinal(window.__ultimoGabaritoExtraido);
    }
  } else {
    if (window.__ultimaQuestaoExtraida?.imagens_suporte) {
      window.__ultimaQuestaoExtraida.imagens_suporte.splice(index, 1);
      window.__imagensLimpas.questao_suporte.splice(index, 1);
      renderizarQuestaoFinal(window.__ultimaQuestaoExtraida);
    }
  }
}

export function iniciarCapturaDeQuestaoRestrita(pageNum) {
  irParaPagina(pageNum);
  setTimeout(() => {
    const container = document.getElementById("canvasContainer");
    if (container) {
      document.body.classList.add("manual-crop-active");
      window.__isManualPageAdd = true;
      container.style.overflow = "hidden";
    }
    CropperState.setPageConstraint(pageNum);
    ativarModoRecorte();
    CropperState.createGroup({ tags: ["manual", "NOVO"] });
    customAlert(`🔒 Modo de Adição Manual: Página ${pageNum}`, 3000);
    const btnConfirm = document.querySelector(
      "#floatingActionParams .btn--success",
    );
    if (btnConfirm) {
      btnConfirm.innerText = "💾 Salvar Questão Manual";
    }
  }, 700);
}

// --- NEW SLOT MODE LOGIC ---

/**
 * Inicia slot mode COM uma seleção pré-posicionada pela IA
 * Isso permite que o usuário veja onde a IA detectou a imagem e confirme/ajuste
 *
 * @param {number} slotIndex - Índice do slot
 * @param {number} pageNum - Página onde a imagem foi detectada
 * @param {Object} normalizedCrop - Coordenadas normalizadas 0-1000 { x, y, w, h }
 * @param {string|number} explicitParentGroupId - ID do grupo pai (opcional)
 */
export function startImageSlotModeWithCrop(
  slotIndex,
  pageNum,
  normalizedCrop,
  explicitParentGroupId = null,
) {
  console.log(
    `[SlotMode] Iniciando captura com crop da IA para slot: ${slotIndex}, página: ${pageNum}`,
    normalizedCrop,
  );

  __targetSlotIndex = Number(slotIndex);
  window.__targetSlotIndex = __targetSlotIndex;
  window.__targetSlotContext = "image-slot";

  // Navegar para a página correta
  irParaPagina(pageNum);

  // Aguardar um pouco para garantir que a página está renderizada
  setTimeout(() => {
    mostrarPainel();
    iniciarCropper();

    // Get page dimensions para converter 0-1000 para pixels
    const wrapper = document.getElementById(`page-wrapper-${pageNum}`);
    if (!wrapper) {
      console.error(`[SlotMode] Página ${pageNum} não encontrada`);
      return;
    }

    const currentScale = viewerState.pdfScale || 1.0;
    const wrapperWidth = wrapper.offsetWidth;
    const wrapperHeight = wrapper.offsetHeight;

    // Converte 0-1000 para pixels (unscaled, pois anchorData usa coordenadas normalizadas)
    const pxX = (normalizedCrop.x / 1000) * (wrapperWidth / currentScale);
    const pxY = (normalizedCrop.y / 1000) * (wrapperHeight / currentScale);
    const pxW = (normalizedCrop.w / 1000) * (wrapperWidth / currentScale);
    const pxH = (normalizedCrop.h / 1000) * (wrapperHeight / currentScale);

    // Create temporary group
    const tempGroup = CropperState.createTemporaryGroup
      ? CropperState.createTemporaryGroup()
      : CropperState.createGroup({
          tags: ["slot-mode"],
          label: "Novo Slot (IA)",
        });

    if (!tempGroup.tags.includes("slot-mode")) {
      tempGroup.tags.push("slot-mode");
    }
    tempGroup.tags.push("ia-detected"); // Tag para indicar que foi detectado por IA

    // Set parent group metadata
    const activeTab = getActiveTab();
    let parentGroupId = explicitParentGroupId;
    if (!parentGroupId && activeTab && activeTab.groupId) {
      parentGroupId = activeTab.groupId;
    }

    tempGroup.metadata = {
      slotId: slotIndex,
      parentGroupId: parentGroupId,
    };

    // Add pre-positioned crop from AI detection
    const anchorData = {
      anchorPageNum: pageNum,
      relativeLeft: pxX,
      relativeTop: pxY,
      unscaledW: pxW,
      unscaledH: pxH,
    };

    CropperState.addCropToGroup(tempGroup.id, { anchorData });
    CropperState.setActiveGroup(tempGroup.id);

    refreshOverlayPosition();

    // Dispatch event for React UI to update to 'capturing' state
    window.dispatchEvent(
      new CustomEvent("image-slot-mode-change", {
        detail: { slotId: slotIndex, mode: "capturing" },
      }),
    );

    console.log(
      `[SlotMode] Crop da IA aplicado: x=${pxX.toFixed(0)}, y=${pxY.toFixed(0)}, w=${pxW.toFixed(0)}, h=${pxH.toFixed(0)}`,
    );
  }, 400); // Delay para garantir que a página carregou
}

/**
 * Confirma diretamente um crop detectado pela IA SEM passar pelo modo de edição
 * Calcula as coordenadas e dispara o evento slot-update automaticamente
 *
 * @param {number} slotIndex - Índice do slot
 * @param {number} pageNum - Página onde a imagem foi detectada
 * @param {Object} normalizedCrop - Coordenadas normalizadas 0-1000 { x, y, w, h }
 */
export async function confirmAISlotDirectly(
  slotIndex,
  pageNum,
  normalizedCrop,
) {
  // [FIX] Extrai o índice numérico do slotId (ex: "questao_img_1" -> 1, ou "1" -> 1)
  // Isso garante consistência com ImageSlotCard que espera apenas o número
  let numericIndex = slotIndex;
  const match = String(slotIndex).match(/(\d+)$/);
  if (match) {
    numericIndex = Number(match[1]);
  } else {
    numericIndex = Number(slotIndex);
  }

  console.log(
    `[SlotMode] Confirmando slot da IA diretamente: ${slotIndex} (índice: ${numericIndex}), página: ${pageNum}`,
    normalizedCrop,
  );

  __targetSlotIndex = numericIndex;
  window.__targetSlotIndex = numericIndex;

  // ============================================
  // CÁLCULO DE COORDENADAS - MESMO PADRÃO DO confirmSlotMode
  // ============================================

  const outputZoom = 200;

  // Obter dimensões do PDF
  let pdfWidthPt = 595; // Fallback A4
  let pdfHeightPt = 842;

  try {
    if (viewerState.pdfDoc) {
      const pdfPage = await viewerState.pdfDoc.getPage(pageNum);
      const viewport = pdfPage.getViewport({ scale: 1.0 });
      pdfWidthPt = viewport.width;
      pdfHeightPt = viewport.height;
    }
  } catch (e) {
    console.warn("[SlotMode AI] Erro ao obter viewport:", e);
  }

  // Converter 0-1000 para PDF Points
  const pdfLeft = Math.round((normalizedCrop.x / 1000) * pdfWidthPt);
  const pdfTop = Math.round((normalizedCrop.y / 1000) * pdfHeightPt);
  const pdfCropW = Math.round((normalizedCrop.w / 1000) * pdfWidthPt);
  const pdfCropH = Math.round((normalizedCrop.h / 1000) * pdfHeightPt);

  // Calcular coordenadas do embed
  const outputScale = outputZoom / 100;
  const EMBED_SCALE_FACTOR = 96 / 72;
  const SIZE_OFFSET = 5;
  const EMBED_AJUSTMENT = 5;
  const PADDING = 20;

  const embedLeft = Math.max(
    0,
    Math.round(pdfLeft * EMBED_SCALE_FACTOR) + EMBED_AJUSTMENT - PADDING,
  );
  const embedTop = Math.max(
    0,
    Math.round(pdfTop * EMBED_SCALE_FACTOR) + EMBED_AJUSTMENT - PADDING,
  );

  const finalContainerWidth =
    Math.round((pdfCropW - SIZE_OFFSET) * outputScale * EMBED_SCALE_FACTOR) +
    EMBED_AJUSTMENT +
    Math.round(PADDING * 2 * outputScale);

  const finalContainerHeight =
    Math.round((pdfCropH - SIZE_OFFSET) * outputScale * EMBED_SCALE_FACTOR) +
    EMBED_AJUSTMENT +
    Math.round(PADDING * 2 * outputScale);

  // PDF.js fallback
  const DPI_SCALE = 300 / 72;
  const canvasSourceW = Math.round(pdfWidthPt * DPI_SCALE);
  const canvasSourceH = Math.round(pdfHeightPt * DPI_SCALE);

  const padding = 20;
  const padNormX = Math.max(0, normalizedCrop.x - padding);
  const padNormY = Math.max(0, normalizedCrop.y - padding);
  const padNormW = Math.min(1000 - padNormX, normalizedCrop.w + 2 * padding);
  const padNormH = Math.min(1000 - padNormY, normalizedCrop.h + 2 * padding);

  const pdfjsX = Math.round((padNormX / 1000) * canvasSourceW);
  const pdfjsY = Math.round((padNormY / 1000) * canvasSourceH);
  const pdfjsCropW = Math.round((padNormW / 1000) * canvasSourceW);
  const pdfjsCropH = Math.round((padNormH / 1000) * canvasSourceH);

  // URL do PDF
  const finalPdfUrl =
    window.__pdfOriginalUrl ||
    window.__pdfDownloadUrl ||
    window.__viewerArgs?.originalPdfUrl ||
    null;

  // Montar cropData
  const cropData = {
    norm_x: Math.round(normalizedCrop.x),
    norm_y: Math.round(normalizedCrop.y),
    norm_w: Math.round(normalizedCrop.w),
    norm_h: Math.round(normalizedCrop.h),

    pdf_page: pageNum,
    pdf_zoom: outputZoom,
    pdf_left: embedLeft,
    pdf_top: embedTop,
    pdf_width: `${finalContainerWidth}px`,
    pdf_height: `${finalContainerHeight}px`,

    pdfjs_source_w: canvasSourceW,
    pdfjs_source_h: canvasSourceH,
    pdfjs_x: pdfjsX,
    pdfjs_y: pdfjsY,
    pdfjs_crop_w: pdfjsCropW,
    pdfjs_crop_h: pdfjsCropH,

    previewUrl: finalPdfUrl,
    pdf_url: finalPdfUrl,
  };

  console.log("[SlotMode AI] Dados de crop calculados:", cropData);

  // Disparar evento de atualização do slot
  window.dispatchEvent(
    new CustomEvent("slot-update", {
      detail: {
        slotId: numericIndex,
        action: "filled",
        cropData: cropData,
        timestamp: Date.now(),
      },
    }),
  );

  // Sinalizar que o slot foi preenchido
  window.dispatchEvent(
    new CustomEvent("image-slot-mode-change", {
      detail: { slotId: numericIndex, mode: "filled" },
    }),
  );
  // [BATCH FIX] Disparar evento para o BatchProcessor (pois o componente React pode não estar montado)
  window.dispatchEvent(
    new CustomEvent("batch-slot-filled", {
      detail: {
        slotId: numericIndex,
        cropData: cropData,
      },
    }),
  );
}

// Exportar para uso global
window.startImageSlotModeWithCrop = startImageSlotModeWithCrop;
window.confirmAISlotDirectly = confirmAISlotDirectly;

export function startImageSlotMode(slotIndex, explicitParentGroupId = null) {
  console.log(
    `[SlotMode] Iniciando captura para slot: ${slotIndex}, ParentGroup: ${explicitParentGroupId}`,
  );

  __targetSlotIndex = Number(slotIndex);
  window.__targetSlotIndex = __targetSlotIndex; // Sync global
  window.__targetSlotContext = "image-slot";

  mostrarPainel();
  iniciarCropper();

  // Create a new temporary group for this slot
  // If createTemporaryGroup doesn't exist, we fallback to createGroup
  const tempGroup = CropperState.createTemporaryGroup
    ? CropperState.createTemporaryGroup()
    : CropperState.createGroup({ tags: ["slot-mode"], label: "Novo Slot" });

  // Ensure tags are set correctly
  if (!tempGroup.tags.includes("slot-mode")) {
    tempGroup.tags.push("slot-mode");
  }
  // Tag with the slot ID so we can find it later for editing
  // Also tag with parentGroupId (Active Tab) for strict bounding
  const activeTab = getActiveTab();

  // FIX: Use explicit ID if valid, otherwise try activeTab.groupId
  // activeTab.id is usually 'question-1', so we want activeTab.groupId
  let parentGroupId = explicitParentGroupId;

  if (!parentGroupId && activeTab && activeTab.groupId) {
    parentGroupId = activeTab.groupId;
  }

  // Ensure it's a number if possible, though metadata handles strings usually.
  // Selection-overlay expects matching types.

  tempGroup.metadata = {
    slotId: slotIndex,
    parentGroupId: parentGroupId,
  };

  CropperState.setActiveGroup(tempGroup.id);

  refreshOverlayPosition();

  // Dispatch event for React UI to update to 'capturing' state
  window.dispatchEvent(
    new CustomEvent("image-slot-mode-change", {
      detail: { slotId: slotIndex, mode: "capturing" },
    }),
  );
}

export function editImageSlotMode(slotId) {
  __targetSlotIndex = Number(slotId);
  window.__targetSlotIndex = __targetSlotIndex;
  window.__targetSlotContext = "image-slot";

  mostrarPainel();
  iniciarCropper();

  // Find the existing group for this slot
  const groups = CropperState.groups || [];

  const existingGroup = groups.find(
    (g) =>
      g.tags &&
      g.tags.includes("slot-mode") &&
      g.metadata &&
      g.metadata.slotId == slotId, // Weak equality for safety
  );

  if (existingGroup) {
    __editingGroupId = existingGroup.id;
    CropperState.setActiveGroup(existingGroup.id);

    // FIX: Ensure parent constraints are up-to-date even on edit
    const activeTab = getActiveTab();

    // Preserve existing parentGroupId if explicit, otherwise fallback to activeTab
    // But usually, the group already has it from creation.
    // If we want to enforce CURRENT active tab as parent:
    let parentGroupId = existingGroup.metadata?.parentGroupId;

    // If not set, try to grab from active tab
    if (!parentGroupId && activeTab && activeTab.groupId) {
      parentGroupId = activeTab.groupId;
    }

    // Merge, don't overwrite slotId
    existingGroup.metadata = {
      ...existingGroup.metadata,
      parentGroupId: parentGroupId,
    };

    refreshOverlayPosition();

    // Dispatch event for React UI to update to 'capturing' (editing) state
    window.dispatchEvent(
      new CustomEvent("image-slot-mode-change", {
        detail: { slotId: slotId, mode: "capturing" },
      }),
    );
  } else {
    console.warn(
      `[SlotMode] Grupo de edição não encontrado para slot ${slotId}. Iniciando novo.`,
    );
    startImageSlotMode(slotId);
  }
}

export function deleteImageSlot(slotId) {
  console.log(`[SlotMode] Deletando slot: ${slotId}`);

  const groups = CropperState.groups || [];
  const groupToRemove = groups.find(
    (g) =>
      g.tags &&
      g.tags.includes("slot-mode") &&
      g.metadata &&
      g.metadata.slotId == slotId,
  );

  if (groupToRemove) {
    CropperState.deleteGroup(groupToRemove.id);
  }

  // Update React UI
  window.dispatchEvent(
    new CustomEvent("image-slot-action-complete", {
      detail: {
        slotId: slotId,
        action: "cleared",
      },
    }),
  );

  // Also dispatch the old style event if legacy code needs it
  window.dispatchEvent(
    new CustomEvent("slot-update", {
      detail: { slotId, action: "cleared" },
    }),
  );
}

export async function calculateCropContext(anchorData) {
  if (!anchorData) return null;

  const workScale = viewerState.pdfScale || 2.0;
  const outputZoom = 200;
  const pageNum = anchorData.anchorPageNum || viewerState.paginaAtual || 1;

  // 1. OBTER DIMENSÕES DA PÁGINA
  const anchorPage = document.getElementById(`page-wrapper-${pageNum}`);
  if (!anchorPage) {
    console.error("Erro: página não encontrada para cálculo de crop.");
    return null;
  }

  // Dados do crop - JÁ VÊM NORMALIZADOS (Points)
  const normalizedX = anchorData.relativeLeft || 0;
  const normalizedY = anchorData.relativeTop || 0;
  const normalizedW = anchorData.unscaledW || 100;
  const normalizedH = anchorData.unscaledH || 100;

  // 2. CONVERTER PARA PDF POINTS
  const pdfLeft = Math.round(normalizedX);
  const pdfTop = Math.round(normalizedY);
  const pdfCropW = Math.round(normalizedW);
  const pdfCropH = Math.round(normalizedH);

  // 3. CALCULAR EMBED & CONTAINER
  const outputScale = outputZoom / 100;
  const EMBED_SCALE_FACTOR = 96 / 72;
  const SIZE_OFFSET = 5;
  const EMBED_AJUSTMENT = 5;
  const PADDING = 20;

  const embedLeft = Math.max(
    0,
    Math.round(pdfLeft * EMBED_SCALE_FACTOR) + EMBED_AJUSTMENT - PADDING,
  );
  const embedTop = Math.max(
    0,
    Math.round(pdfTop * EMBED_SCALE_FACTOR) + EMBED_AJUSTMENT - PADDING,
  );

  const finalContainerWidth =
    Math.round((pdfCropW - SIZE_OFFSET) * outputScale * EMBED_SCALE_FACTOR) +
    EMBED_AJUSTMENT +
    Math.round(PADDING * 2 * outputScale);

  const finalContainerHeight =
    Math.round((pdfCropH - SIZE_OFFSET) * outputScale * EMBED_SCALE_FACTOR) +
    EMBED_AJUSTMENT +
    Math.round(PADDING * 2 * outputScale);

  // 4. VP E PDFJS
  let pdfWidthPt = 595;
  let pdfHeightPt = 842;

  try {
    if (viewerState.pdfDoc) {
      const pdfPage = await viewerState.pdfDoc.getPage(pageNum);
      const viewport = pdfPage.getViewport({ scale: 1.0 });
      pdfWidthPt = viewport.width;
      pdfHeightPt = viewport.height;
    }
  } catch (e) {
    console.warn("[calculateCropContext] Erro ao obter viewport:", e);
  }

  const normX = (pdfLeft / pdfWidthPt) * 1000;
  const normY = (pdfTop / pdfHeightPt) * 1000;
  const normW = (pdfCropW / pdfWidthPt) * 1000;
  const normH = (pdfCropH / pdfHeightPt) * 1000;

  const DPI_SCALE = 300 / 72;
  const canvasSourceW = Math.round(pdfWidthPt * DPI_SCALE);
  const canvasSourceH = Math.round(pdfHeightPt * DPI_SCALE);

  const padding = 20;
  const padNormX = Math.max(0, normX - padding);
  const padNormY = Math.max(0, normY - padding);
  const padNormW = Math.min(1000 - padNormX, normW + 2 * padding);
  const padNormH = Math.min(1000 - padNormY, normH + 2 * padding);

  const pdfjsX = Math.round((padNormX / 1000) * canvasSourceW);
  const pdfjsY = Math.round((padNormY / 1000) * canvasSourceH);
  const pdfjsCropW = Math.round((padNormW / 1000) * canvasSourceW);
  const pdfjsCropH = Math.round((padNormH / 1000) * canvasSourceH);

  const finalPdfUrl =
    window.__pdfOriginalUrl ||
    window.__pdfDownloadUrl ||
    window.__viewerArgs?.originalPdfUrl ||
    null;

  return {
    norm_x: Math.round(normX),
    norm_y: Math.round(normY),
    norm_w: Math.round(normW),
    norm_h: Math.round(normH),

    pdf_page: pageNum,
    pdf_zoom: outputZoom,
    pdf_left: embedLeft,
    pdf_top: embedTop,
    pdf_width: `${finalContainerWidth}px`,
    pdf_height: `${finalContainerHeight}px`,

    pdfjs_source_w: canvasSourceW,
    pdfjs_source_h: canvasSourceH,
    pdfjs_x: pdfjsX,
    pdfjs_y: pdfjsY,
    pdfjs_crop_w: pdfjsCropW,
    pdfjs_crop_h: pdfjsCropH,

    previewUrl: finalPdfUrl,
    pdf_url: finalPdfUrl,
  };
}

export async function confirmSlotMode() {
  const activeGroup = CropperState.getActiveGroup();
  if (!activeGroup) return;

  if (activeGroup.crops.length === 0) {
    customAlert("⚠️ Selecione uma área na imagem!", 2000);
    return;
  }

  const lastCrop = activeGroup.crops[activeGroup.crops.length - 1];
  const anchorData = lastCrop.anchorData;

  if (!anchorData) {
    customAlert("Erro: dados de ancoragem não encontrados.", 2000);
    return;
  }

  const cropData = await calculateCropContext(anchorData);

  if (!cropData) {
    customAlert("Erro ao calcular dados do recorte.", 2000);
    return;
  }

  console.log("[SlotMode] Dados de crop calculados:", cropData);

  // Update group metadata
  activeGroup.metadata = { slotId: __targetSlotIndex };
  activeGroup.status = "verified";

  // Dispatch Event com dados de crop
  window.dispatchEvent(
    new CustomEvent("slot-update", {
      detail: {
        slotId: __targetSlotIndex,
        action: "filled",
        cropData: cropData,
        timestamp: activeGroup.id,
      },
    }),
  );

  // Exit mode but KEEP the group (persist)
  CropperState.setActiveGroup(null);
  refreshOverlayPosition();
  customAlert("Imagem atualizada!", 1500);

  // Signal React to go to 'filled' state
  window.dispatchEvent(
    new CustomEvent("image-slot-mode-change", {
      detail: { slotId: __targetSlotIndex, mode: "filled" },
    }),
  );
}

export function cancelSlotMode() {
  // If was creating new (no params passed to distinguish yet, relying on side effects)
  if (CropperState.revert) {
    CropperState.revert();
  }

  // If it was a NEW group that was just created and we cancel, we should delete it.
  if (__editingGroupId === null) {
    const activeGroup = CropperState.getActiveGroup();
    if (activeGroup) CropperState.deleteGroup(activeGroup.id);
  }

  // Removed showSlotControls(false)
  CropperState.setActiveGroup(null);
  refreshOverlayPosition();

  // Dispatch 'cancel' state to UI
  window.dispatchEvent(
    new CustomEvent("image-slot-mode-change", {
      detail: { slotId: __targetSlotIndex, mode: "idle" }, // Or whatever previous state was, usually idle/empty
    }),
  );
}

// Exports
export {
  cancelSlotMode as cancelImageSlotMode,
  confirmSlotMode as confirmImageSlotMode,
};
