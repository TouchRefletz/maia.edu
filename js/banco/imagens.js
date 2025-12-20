export function normalizarArrayImagens(obj) {
  if (obj.fotos_originais && Array.isArray(obj.fotos_originais)) {
    return obj.fotos_originais;
  } else if (obj.foto_original) {
    return [obj.foto_original];
  }
  return [];
}

export function serializarParaAtributo(arr) {
  return JSON.stringify(arr).replace(/"/g, '&quot;');
}

export function gerarHtmlImagensSuporte(fullData, q) {
  // Junta arrays garantindo que existam
  const lista = [
    ...(fullData.imagens_agrupadas?.questao_suporte || []),
    ...(q.imagens_suporte_urls || []),
  ];

  // Remove duplicatas (opcional, mas boa prática) e gera HTML
  return [...new Set(lista)]
    .map((url) => `<img src="${url}" class="q-support-img">`)
    .join('');
}

export function prepararImagensVisualizacao(fullData) {
  const q = fullData.dados_questao || {};
  const g = fullData.dados_gabarito || {};

  // 1. Processa Imagens Originais (Scan)
  const imgsQ = normalizarArrayImagens(q);
  const imgsG = normalizarArrayImagens(g);

  // 2. Serializa para botões
  const jsonImgsQ = serializarParaAtributo(imgsQ);
  const jsonImgsG = serializarParaAtributo(imgsG);

  // 3. Gera HTML de suporte
  const htmlImgsSuporte = gerarHtmlImagensSuporte(fullData, q);

  // Retorna objeto com tudo pronto
  return {
    jsonImgsQ,
    jsonImgsG,
    htmlImgsSuporte,
    // Retorna também os arrays brutos caso precise verificar .length depois
    rawImgsQ: imgsQ,
    rawImgsG: imgsG,
  };
}
