import { gerarConteudoEmJSONComImagemStream } from "../api/worker.js";
import { renderPageHighRes } from "../viewer/pdf-core.js";

// Schema para detecção de imagens (mesmo do crop-tool.html)
const imageDetectionSchema = {
  type: "object",
  properties: {
    crops: {
      type: "array",
      items: {
        type: "object",
        properties: {
          x: { type: "integer", description: "X coordinate (0-1000)" },
          y: { type: "integer", description: "Y coordinate (0-1000)" },
          w: { type: "integer", description: "Width (0-1000)" },
          h: { type: "integer", description: "Height (0-1000)" },
        },
        required: ["x", "y", "w", "h"],
      },
    },
  },
  required: ["crops"],
};

// Prompt para detecção de imagens visuais (mesmo do crop-tool.html)
const IMAGE_DETECTION_PROMPT = `Analyze this PDF page image. Identify purely visual elements (like charts, diagrams, photos, figures). 

STRICTLY IGNORE the following elements:
- Text (texto)
- Quotes (citacao)
- Lists (lista)
- Equations (equacao)
- Code (codigo)
- Highlights (destaque)
- Separators (separador)
- Titles (titulo)
- Subtitles (subtitulo)
- Sources (fonte)
- Tables (tabela)

Focus ONLY on visual content that does not fall into the above categories. Return a list of crops for each valid visual element found.`;

/**
 * Verifica se dois retângulos se intersectam
 */
function rectsIntersect(a, b) {
  return !(
    a.x + a.w <= b.x ||
    b.x + b.w <= a.x ||
    a.y + a.h <= b.y ||
    b.y + b.h <= a.y
  );
}

/**
 * Clippa um retângulo para ficar dentro dos bounds
 */
function clipToBounds(crop, bounds) {
  const x1 = Math.max(crop.x, bounds.x);
  const y1 = Math.max(crop.y, bounds.y);
  const x2 = Math.min(crop.x + crop.w, bounds.x + bounds.w);
  const y2 = Math.min(crop.y + crop.h, bounds.y + bounds.h);

  return {
    x: x1,
    y: y1,
    w: Math.max(0, x2 - x1),
    h: Math.max(0, y2 - y1),
  };
}

/**
 * Extrai imagens de uma região específica da página usando IA
 *
 * @param {number} pageNum - Número da página
 * @param {Object} questionBounds - Bounds da questão em escala 0-1000 { x, y, w, h }
 * @param {Object} callbacks - Callbacks opcionais { onStatus, onThought, signal }
 * @returns {Promise<{success: boolean, crops?: Array, error?: string}>}
 */
export async function extractImagesFromRegion(
  pageNum,
  questionBounds,
  callbacks = {}
) {
  const { onStatus, onThought, signal } = callbacks;

  try {
    // 1. Renderiza página em alta resolução
    onStatus?.("Renderizando página...");
    const imageBase64 = await renderPageHighRes(pageNum);

    if (!imageBase64) {
      return { success: false, error: "Falha ao renderizar página" };
    }

    // 2. Envia para Gemini
    onStatus?.("Analisando com IA...");

    const result = await gerarConteudoEmJSONComImagemStream(
      IMAGE_DETECTION_PROMPT,
      imageDetectionSchema,
      [imageBase64],
      "image/png",
      {
        onStatus,
        onThought,
        signal,
      },
      {
        model: window.selectedModelExtractorImageDetect || "models/gemini-3.5-flash",
      }
    );

    if (!result || !result.crops) {
      return { success: false, error: "Resposta inválida da IA" };
    }

    // 3. Filtra crops que intersectam com os bounds da questão
    const validCrops = result.crops
      .filter((crop) => rectsIntersect(crop, questionBounds))
      .map((crop) => clipToBounds(crop, questionBounds))
      .filter((crop) => crop.w > 20 && crop.h > 20); // Ignora crops muito pequenos

    if (validCrops.length === 0) {
      return {
        success: false,
        error: "Nenhuma imagem encontrada dentro da questão",
      };
    }

    // 4. Retorna o primeiro crop válido (ou todos se necessário no futuro)
    return {
      success: true,
      crops: validCrops,
      firstCrop: validCrops[0],
    };
  } catch (e) {
    if (e.name === "AbortError") {
      return { success: false, error: "Extração cancelada" };
    }
    console.error("[AI Image Extractor]", e);
    return { success: false, error: e.message };
  }
}

/**
 * Converte coordenadas normalizadas (0-1000) para formato anchorData
 * usado pelo sistema de cropping existente
 *
 * @param {Object} crop - { x, y, w, h } em escala 0-1000
 * @param {number} pageNum - Número da página
 * @returns {Object} anchorData compatível com extractImageFromCropData
 */
export function convertCropToAnchorData(crop, pageNum) {
  // O anchorData precisa de coordenadas em pixels baseadas no viewport atual
  // Vamos buscar as dimensões do wrapper da página
  const wrapper = document.getElementById(`page-wrapper-${pageNum}`);
  if (!wrapper) return null;

  const wrapperWidth = wrapper.offsetWidth;
  const wrapperHeight = wrapper.offsetHeight;

  // Converte 0-1000 para pixels
  const pxX = (crop.x / 1000) * wrapperWidth;
  const pxY = (crop.y / 1000) * wrapperHeight;
  const pxW = (crop.w / 1000) * wrapperWidth;
  const pxH = (crop.h / 1000) * wrapperHeight;

  return {
    pageNum,
    x: pxX,
    y: pxY,
    width: pxW,
    height: pxH,
    // Adiciona coordenadas normalizadas para rastreabilidade
    normalized: { ...crop },
  };
}
