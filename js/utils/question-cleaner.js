/**
 * Remove campos gigantescos e irrelevantes do JSON da questão (como fotos_originais, fontes_externas)
 * para evitar estourar o limite de tokens da API dos modelos (especialmente Groq).
 * 
 * @param {Object} fullData Objeto original da questão
 * @returns {Object} Um novo objeto limpo e clonado
 */
export function cleanQuestionDataForAI(fullData) {
  if (!fullData || typeof fullData !== "object") return fullData;

  // Clone para evitar mutar o cache em memória
  let cleaned;
  try {
    cleaned = JSON.parse(JSON.stringify(fullData));
  } catch (e) {
    // Fallback caso falhe a clonagem profunda
    cleaned = { ...fullData };
  }

  if (cleaned.dados_questao) {
    if (cleaned.dados_questao.fotos_originais) {
      delete cleaned.dados_questao.fotos_originais;
    }
  }
  if (cleaned.dados_gabarito) {
    if (cleaned.dados_gabarito.fontes_externas) {
      delete cleaned.dados_gabarito.fontes_externas;
    }
    if (cleaned.dados_gabarito.fotos_originais) {
      delete cleaned.dados_gabarito.fotos_originais;
    }
  }

  // Remove buffers de imagem ou arrays de imagens agrupadas adicionadas no fluxo do app
  delete cleaned.imagens_agrupadas;
  delete cleaned.imagem_redimensionada;
  delete cleaned.imagem_original;

  return cleaned;
}
