import { viewerState } from '../main.js';
import { CropperState } from './cropper-state.js';

export function loadSelectionsFromJson(jsonInput, targetPageNum = 2, options = {}) {
  console.log('📥 Loading selections from JSON...', jsonInput);

  let data = jsonInput;
  if (typeof jsonInput === 'string') {
    try {
      data = JSON.parse(jsonInput);
    } catch (e) {
      console.error('❌ Invalid JSON format', e);
      return;
    }
  }

  if (!data.regions || !Array.isArray(data.regions)) {
    console.error('❌ No regions found in JSON');
    return;
  }

  // Determine coordinate system
  const isY1X1 = data.coordinateSystem === 'normalized_0_1000_y1x1y2x2';

  data.regions.forEach((region) => {
    // Tenta encontrar grupo existente para fazer merging (caso seja split question ou atualização de rascunho)
    const questionId = region.questionId;
    let group = null;
    let isMerge = false;

    if (questionId && CropperState.findGroupByExternalId) {
      const existingGroup = CropperState.findGroupByExternalId(questionId);
      if (existingGroup) {
        // LÓGICA DE ATUALIZAÇÃO "DRAFT" -> "VERIFIED"
        // Se o grupo existente for RASCUNHO e o novo for VERIFICADO (ou estamos numa fase final 'sent'/'verified'),
        // Limpamos os crops antigos para substituir pelos novos refinados.
        // Assim evitamos "sombra" ou duplicidade.
        if (
          existingGroup.status === 'draft' &&
          (options.status === 'verified' || options.status === 'sent')
        ) {
          // Smart Merge/Upgrade Logic
          // Determine types involved
          const isNewComplete = (region.tipo || 'questao_completa') === 'questao_completa';
          const isNewPart = region.tipo === 'parte_questao';

          const hasExistingComplete = existingGroup.crops.some(
            (c) => (c.tipo || 'questao_completa') === 'questao_completa',
          );
          const hasExistingPart = existingGroup.crops.some((c) => c.tipo === 'parte_questao');

          console.log(
            `🔄 Upgrading Draft Q${questionId}. New: ${region.tipo}, Existing Has: [Complete:${hasExistingComplete}, Part:${hasExistingPart}]`,
          );

          if (isNewComplete && hasExistingComplete) {
            // Collision: New Main Body replacing Old Main Body.
            // Filter out old complete, keep parts.
            console.log("   -> Replacing old 'questao_completa' crops.");
            existingGroup.crops = existingGroup.crops.filter(
              (c) => (c.tipo || 'questao_completa') !== 'questao_completa',
            );
          } else if (isNewPart && hasExistingPart) {
            // Collision: New Part (Support Text) with Existing Part.
            // We APPEND instead of replacing, because support text can be split across multiple boxes (multicast).
            console.log("   -> Appending new 'parte_questao' to existing parts.");
          }

          // If we didn't clear above, we are Merging (Appending).

          existingGroup.status = options.status; // Upgrade status
          group = existingGroup;
          isMerge = true;
          // Continue to add the new crop
        }
        // LÓGICA DE MERGING (Partes da mesma questão)
        else {
          // Só une se pelo menos um dos lados for "parte_questao" OU se for continuação.
          // Se ambos forem "questao_completa", pode ser colisão, mas se o ID é igual, assumimos que é split
          // ou erro da IA que mandou 2 caixas. Na dúvida, mergeamos para não perder dados.
          group = existingGroup;
          isMerge = true;
          console.log(`🔄 Merging additional part to Question ${questionId}`);

          if (options.status && existingGroup.status !== options.status) {
            existingGroup.status = options.status;
          }
        }
      }
    }

    if (!group) {
      // Pass externalId so it can be found later
      const newOptions = {
        ...options,
        externalId: questionId,
        tipo: region.tipo || 'questao_completa',
        status: options.status || 'sent', // Default to sent if not provided
      };
      group = CropperState.createGroup(newOptions);
    }

    // Calculate functionality
    const [c1, c2, c3, c4] = region.box;
    let top, left, bottom, right;

    if (isY1X1) {
      // [y1, x1, y2, x2]
      top = c1;
      left = c2;
      bottom = c3;
      right = c4;
    } else {
      // Assume [x1, y1, x2, y2] or similar default
      left = c1;
      top = c2;
      right = c3;
      bottom = c4;
    }

    // APLY PADDING IF PROVIDED (options.padding)
    // Expand the box by 'padding' amount in all directions, clamping to 0..1000
    if (options.padding && typeof options.padding === 'number') {
      const p = options.padding;
      top = Math.max(0, top - p);
      left = Math.max(0, left - p);
      bottom = Math.min(1000, bottom + p);
      right = Math.min(1000, right + p);
    }

    // Convert normalized 0-1000 to relative 0-1
    const relTop = top / 1000;
    const relLeft = left / 1000;
    const relBottom = bottom / 1000;
    const relRight = right / 1000;

    const relWidth = relRight - relLeft;
    const relHeight = relBottom - relTop;

    // We need the PAGE DIMENSIONS to convert normalized -> unscaled pixels.
    const pageContainer = document.getElementById(`page-wrapper-${targetPageNum}`);
    if (!pageContainer) {
      console.warn(`⚠️ Page ${targetPageNum} not found/rendered yet.`);
      return;
    }

    const currentW = pageContainer.offsetWidth;
    const currentH = pageContainer.offsetHeight;

    // Unscaled dimensions (the "100%" size of the page in PDF coordinate terms)
    const unscaledPageW = currentW / viewerState.pdfScale;
    const unscaledPageH = currentH / viewerState.pdfScale;

    const anchorData = {
      anchorPageNum: targetPageNum,
      // Convert 0-1 fraction to unscaled pixels
      relativeLeft: relLeft * unscaledPageW,
      relativeTop: relTop * unscaledPageH,
      unscaledW: relWidth * unscaledPageW,
      unscaledH: relHeight * unscaledPageH,
    };

    // Store type on crop data as well for rendering
    const cropData = {
      anchorData,
      tipo: region.tipo || 'questao_completa', // IMPORTANT: Pass type to crop
    };

    if (isMerge) {
      CropperState.addCropToGroup(group.id, cropData);
    } else {
      // Create new group done above, just add crop to active (which is the new one)
      // Actually createGroup sets activeGroupId.
      CropperState.addCropToActiveGroup(cropData);
    }
    CropperState.notify();
  });

  // Força o fim da edição (fecha o painel de edição e mostra a lista)
  CropperState.setActiveGroup(null);

  console.log('✅ Selections loaded successfully!');
}
