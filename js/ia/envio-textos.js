import { resolverImagensEnvio } from '../render/final/json-e-modal.js';

export function prepararGabaritoEnvio(g) {
  const gabaritoLimpo = JSON.parse(JSON.stringify(g));

  // 1. Injeção de Imagens
  const imgsReais = resolverImagensEnvio(
    window.__BACKUP_IMGS_G,
    window.__imagensLimpas?.gabarito_original
  );

  if (imgsReais.length > 0) {
    gabaritoLimpo.fotos_originais = imgsReais;
    delete gabaritoLimpo.foto_original;
  }

  // 2. Limpeza de campos de crédito e alertas
  delete gabaritoLimpo.alertas_credito;
  if (gabaritoLimpo.creditos) {
    // Lista de campos para remover (com e sem underscore, mantendo sua lógica)
    const camposParaRemover = [
      'como_identificou',
      'precisa_credito_generico',
      'texto_credito_sugerido',
      'comoidentificou',
      'precisacreditogenerico',
      'textocreditosugerido',
    ];
    camposParaRemover.forEach((campo) => delete gabaritoLimpo.creditos[campo]);
  }

  return gabaritoLimpo;
}

export function prepararQuestaoEnvio(q) {
  const questaoFinal = JSON.parse(JSON.stringify(q));

  // 1. Injeção de Imagens
  const imgsReais = resolverImagensEnvio(
    window.__BACKUP_IMGS_Q,
    window.__imagensLimpas?.questao_original
  );

  if (imgsReais.length > 0) {
    questaoFinal.fotos_originais = imgsReais;
    delete questaoFinal.foto_original;
  }

  // 2. Remove identificação (pois será a chave no Firebase)
  delete questaoFinal.identificacao;

  return questaoFinal;
}

export function construirDadosParaEnvio(q, g) {
  // 1. Sanitiza o Título
  const rawTitle = window.__viewerArgs?.rawTitle || 'Material_Geral';
  const tituloMaterial = rawTitle.replace(/[.#$/[\]]/g, '_');

  // 2. Processa os Objetos
  const questaoFinal = prepararQuestaoEnvio(q);
  const gabaritoLimpo = prepararGabaritoEnvio(g);

  // Retorna tudo agrupado
  return {
    tituloMaterial,
    questaoFinal,
    gabaritoLimpo,
  };
}

export function sanitizarID(texto) {
  // ✅ Codifica para Base64URL (reversível, só usa [A-Za-z0-9_-])
  // Lógica: UTF-8 -> URI -> Base64 -> URL Safe
  const encoded = btoa(unescape(encodeURIComponent(texto || '')));
  return encoded
    .replace(/\+/g, '-') // RFC 4648 Base64URL
    .replace(/\//g, '_')
    .replace(/=/g, ''); // Remove padding
}

export function gerarIdentificadoresEnvio(tituloMaterial, q) {
  // 1. Define chave da prova
  const chaveProva = tituloMaterial || 'MATERIAL_SEM_TITULO';

  // 2. Define ID único da questão
  // Remove caracteres proibidos no caminho do Firebase (., #, $, /, [, ])
  const rawId = q.identificacao || 'QUESTAO_' + Date.now();
  const idQuestaoUnico = rawId.replace(/[.#$/[\]]/g, '-');

  // 3. Gera o ID Pinecone combinando os dois sanitizados
  const idPinecone = `${sanitizarID(chaveProva)}--${sanitizarID(idQuestaoUnico)}`;

  return {
    chaveProva,
    idQuestaoUnico,
    idPinecone,
  };
}

export const construirTextoQuestao = (q) => {
  let txt = '';

  // 1. Contexto (Matéria e Keywords)
  if (q.materias_possiveis && Array.isArray(q.materias_possiveis)) {
    txt += `MATÉRIA: ${q.materias_possiveis.join(', ')}. `;
  }
  if (q.palavras_chave && Array.isArray(q.palavras_chave)) {
    txt += `PALAVRAS-CHAVE: ${q.palavras_chave.join(', ')}. `;
  }

  // 2. Enunciado
  let textoEnunciado = '';
  if (q.estrutura && Array.isArray(q.estrutura)) {
    textoEnunciado = q.estrutura.map((item) => item.conteudo || '').join(' ');
  }
  txt += `ENUNCIADO: ${textoEnunciado} `;

  // 3. Alternativas
  if (q.alternativas && Array.isArray(q.alternativas)) {
    const textoAlts = q.alternativas
      .map((alt) => {
        let conteudoAlt = alt.texto || '';
        // Prioriza estrutura se existir
        if (alt.estrutura && Array.isArray(alt.estrutura)) {
          conteudoAlt = alt.estrutura.map((i) => i.conteudo).join(' ');
        }
        return `${alt.letra || '?'}: ${conteudoAlt}`;
      })
      .join(' | ');
    txt += `ALTERNATIVAS: ${textoAlts} `;
  }

  return txt;
};

export const construirTextoSolucao = (g) => {
  if (!g) return '';
  let txt = '';

  // Letra Correta
  if (g.dados_gabarito?.alternativa_correta) {
    txt += `GABARITO: Alternativa ${g.dados_gabarito.alternativa_correta}. `;
  }

  // Explicação Detalhada
  if (g.explicacao && Array.isArray(g.explicacao)) {
    const textoExpl = g.explicacao
      .flatMap((bloco) =>
        bloco.estrutura ? bloco.estrutura.map((i) => i.conteudo) : []
      )
      .join(' ');
    txt += `EXPLICAÇÃO: ${textoExpl} `;
  }

  // Análise dos Distratores
  if (
    g.dados_gabarito?.alternativas_analisadas &&
    Array.isArray(g.dados_gabarito.alternativas_analisadas)
  ) {
    const textoMotivos = g.dados_gabarito.alternativas_analisadas
      .map((analise) => `(${analise.letra}) ${analise.motivo || ''}`)
      .join(' ');
    txt += `ANÁLISE DOS DISTRATORES: ${textoMotivos} `;
  }

  // Justificativa Curta
  if (g.justificativa_curta) {
    txt += `RESUMO: ${g.justificativa_curta} `;
  }

  return txt;
};

export const construirTextoComplexidade = (g) => {
  if (!g || !g.dados_gabarito?.analise_complexidade) return '';

  let txt = '';
  const complex = g.dados_gabarito.analise_complexidade;

  // Justificativa da Dificuldade
  if (complex.justificativa_dificuldade) {
    txt += `COMPLEXIDADE: ${complex.justificativa_dificuldade} `;
  }

  // Fatores Ativos
  if (complex.fatores) {
    const fatoresAtivos = Object.entries(complex.fatores)
      .filter(([key, value]) => value === true) // Pega só o que é true
      .map(([key]) => key)
      .join(', ');

    if (fatoresAtivos) {
      txt += `Fatores: ${fatoresAtivos}.`;
    }
  }

  return txt;
};

export const construirTextoSemantico = (q, g) => {
  // Concatena os resultados das 3 funções
  return (
    construirTextoQuestao(q) +
    construirTextoSolucao(g) +
    construirTextoComplexidade(g)
  );
};