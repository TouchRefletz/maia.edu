import { customAlert } from '../../ui/GlobalAlertsLogic.tsx';

// Importa helpers do TSX que retornam strings HTML
import {
    generateComplexidadeVisualHtml,
    generateCreditosTableHtml,
    generateImgsLimpasHtml,
    generateListaAlternativasHtml,
    generatePainelGabaritoHtml,
    generatePainelQuestaoHtml,
    generatePassosGabaritoHtml,
    generateTagsHtml
} from './RenderComponents.tsx';

export const renderImgsLimpas = (lista, titulo) => {
  return generateImgsLimpasHtml(lista, titulo);
};

export const renderComplexidadeVisual = (comp) => {
  return generateComplexidadeVisualHtml(comp);
};

export const renderCreditosTable = (c) => {
  return generateCreditosTableHtml(c);
};

export function prepararDadosGerais() {
  // Lógica pura (não-UI), mantida igual ao original
  const q = window.__ultimaQuestaoExtraida;
  const g = window.__ultimoGabaritoExtraido;

  if (!q || !g) {
    customAlert(
      '⚠️ Extração incompleta. Certifique-se de processar Questão e Gabarito.'
    );
    return null;
  }

  return {
    q,
    g,
    tituloMaterial:
      window.__viewerArgs?.rawTitle || 'Material Não Identificado',
    explicacaoArray: Array.isArray(g.explicacao) ? g.explicacao : [],
    imagensFinais: {
      q_original: window.__imagensLimpas?.questao_original || [],
      q_suporte: window.__imagensLimpas?.questao_suporte || [],
      g_original: window.__imagensLimpas?.gabarito_original || [],
      g_suporte: window.__imagensLimpas?.gabarito_suporte || [],
    },
  };
}

export function gerarHtmlListaAlternativas(alternativas) {
  return generateListaAlternativasHtml(alternativas);
}

export function montarHtmlPainelQuestao(q, tituloMaterial, imagensFinais) {
  return generatePainelQuestaoHtml(q, tituloMaterial, imagensFinais);
}

export function gerarHtmlPassosGabarito(explicacaoArray) {
  return generatePassosGabaritoHtml(explicacaoArray);
}

export function montarHtmlPainelGabarito(g, imagensFinais, explicacaoArray) {
  return generatePainelGabaritoHtml(g, imagensFinais, explicacaoArray);
}

export const renderTags = (l, c) => {
  return generateTagsHtml(l, c);
};