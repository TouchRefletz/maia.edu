// ============================================
// PAYLOAD DE IMAGENS - SISTEMA VIA PDF
// Não faz mais upload para ImgBB
// Apenas limpa blob URLs temporários e valida dados
// ============================================

import { uploadState } from "../main.js";

/**
 * @deprecated Upload para ImgBB removido. Agora usamos renderização via PDF.
 * Mantido apenas para retrocompatibilidade.
 */
export const uploadToImgBB = async (base64String) => {
  console.warn(
    "[payload-imagens] uploadToImgBB foi deprecado. Imagens são renderizadas via PDF."
  );
  return null;
};

/**
 * Processa objeto recursivamente para limpar dados temporários.
 * NÃO faz mais upload para ImgBB - agora usamos dados de PDF para renderização.
 */
export const processarObjetoRecursivo = async (obj, btnEnviar) => {
  if (!obj || typeof obj !== "object") return;

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const val = obj[i];

      // Limpa blob URLs (são temporários e não funcionam após sessão)
      if (typeof val === "string" && val.startsWith("blob:")) {
        console.log(
          `[payload-imagens] Limpando blob URL temporário no array[${i}]`
        );
        obj[i] = null;
      }
      // Limpa base64 grandes se temos dados de PDF no mesmo objeto
      else if (typeof val === "object" && val !== null) {
        await processarObjetoRecursivo(val, btnEnviar);
      }
    }
    return;
  }

  for (const key in obj) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;

    const val = obj[key];

    // Limpa blob URLs
    if (typeof val === "string" && val.startsWith("blob:")) {
      console.log(`[payload-imagens] Limpando blob URL temporário: ${key}`);
      obj[key] = null;
    }

    // Se temos dados de crop, podemos limpar imagem_url que é blob
    else if (key === "imagem_url" && obj.pdf_page && val?.startsWith("blob:")) {
      console.log(
        `[payload-imagens] Limpando blob imagem_url (temos dados de crop)`
      );
      obj[key] = null;
    }
    // Processa objetos aninhados
    else if (typeof val === "object" && val !== null) {
      await processarObjetoRecursivo(val, btnEnviar);
    }
  }
};

/**
 * Prepara o payload para envio ao Firebase.
 * Limpa dados temporários (blob URLs) e valida estrutura.
 */
export async function prepararPayloadComImagens(
  btnEnviar,
  questaoFinal,
  gabaritoLimpo,
  metaExtra = {}
) {
  // 0. Reset do contador
  uploadState.imagensConvertidas = 0;

  // 1. Feedback Visual
  if (btnEnviar) btnEnviar.innerText = "⏳ Preparando dados...";

  // 2. Monta a estrutura final
  const payloadParaSalvar = {
    meta: {
      timestamp: new Date().toISOString(),
      ...(metaExtra || {})
    },
    dados_questao: questaoFinal,
    dados_gabarito: gabaritoLimpo,
  };

  // 3. Processamento: Limpa blob URLs e dados desnecessários
  // (Não faz mais upload para ImgBB)
  await processarObjetoRecursivo(payloadParaSalvar, btnEnviar);

  if (btnEnviar) btnEnviar.innerText = "✅ Dados prontos!";

  return payloadParaSalvar;
}
