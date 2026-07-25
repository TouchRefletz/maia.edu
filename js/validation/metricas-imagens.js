import { mostrarModalAvisoImagens } from './modal-aviso-imagens.js';

export function calcularMetricasQuestao() {
  let slotsEsperados = 0;
  let imagensPreenchidas = 0;
  const q = window.__ultimaQuestaoExtraida;

  if (!q) return null;

  const isImageBlockFilled = (block, index, contextFn) => {
    if (block.pdf_page || block.pdfjs_x !== undefined || block.url) return true;
    const rascunhos = contextFn();
    return !!rascunhos[index];
  };

  let imgIndex = 0;
  if (Array.isArray(q.estrutura)) {
    q.estrutura.forEach((b) => {
      if (b.tipo === 'imagem') {
        slotsEsperados++;
        const filled = isImageBlockFilled(
          b,
          imgIndex,
          () => window.__imagensLimpas?.questao_original || [],
        );
        if (filled) imagensPreenchidas++;
        imgIndex++;
      }
    });
  }

  if (Array.isArray(q.alternativas)) {
    q.alternativas.forEach((alt) => {
      if (Array.isArray(alt.estrutura)) {
        let structureAltCount = 0;
        alt.estrutura.forEach((b) => {
          if (b.tipo === 'imagem') {
            slotsEsperados++;
            if (b.pdf_page || b.url) structureAltCount++;
          }
        });
        imagensPreenchidas += structureAltCount;
      }
    });

    const altsMap = window.__imagensLimpas?.alternativas?.questao || {};
    let totalDraftsAlts = 0;
    Object.values(altsMap).forEach((lista) => {
      if (Array.isArray(lista)) totalDraftsAlts += lista.filter(Boolean).length;
    });
    imagensPreenchidas += totalDraftsAlts;
  }

  return { slotsEsperados, imagensPreenchidas };
}

export function calcularMetricasGabarito() {
  let slotsEsperados = 0;
  let imagensPreenchidas = 0;
  const g = window.__ultimoGabaritoExtraido;

  if (!g) return null;

  if (Array.isArray(g.explicacao)) {
    g.explicacao.forEach((passo, idx) => {
      if (Array.isArray(passo.estrutura)) {
        passo.estrutura.forEach((b) => {
          if (b.tipo === 'imagem') {
            slotsEsperados++;
            if (b.pdf_page || b.pdfjs_x !== undefined || b.url) imagensPreenchidas++;
          }
        });
      }

      const imgsSalvasPasso = window.__imagensLimpas?.gabarito_passos?.[idx] || [];
      imagensPreenchidas += imgsSalvasPasso.filter(Boolean).length;
    });
  }

  return { slotsEsperados, imagensPreenchidas };
}

export async function validarProgressoImagens(contexto = 'questao') {
  return new Promise((resolve) => {
    let dados = null;
    let dadosQuestao = null;
    let dadosGabarito = null;

    // 1. Decide qual cálculo fazer baseando-se no contexto
    if (contexto === 'questao') {
      dados = calcularMetricasQuestao();
    } else if (contexto === 'gabarito') {
      dados = calcularMetricasGabarito();
    } else if (contexto === 'tudo') {
      dadosQuestao = calcularMetricasQuestao();
      dadosGabarito = calcularMetricasGabarito();

      // Combina os resultados (null significa que não tem dados para analisar, então conta como 0/0)
      const qEsp = dadosQuestao ? dadosQuestao.slotsEsperados : 0;
      const qPre = dadosQuestao ? dadosQuestao.imagensPreenchidas : 0;
      const gEsp = dadosGabarito ? dadosGabarito.slotsEsperados : 0;
      const gPre = dadosGabarito ? dadosGabarito.imagensPreenchidas : 0;

      dados = {
        slotsEsperados: qEsp + gEsp,
        imagensPreenchidas: qPre + gPre,
      };
    }

    // Se dados for null (não tinha objeto extraído), aprova direto (lógica original)
    if (!dados) {
      resolve(true);
      return;
    }

    const { slotsEsperados, imagensPreenchidas } = dados;

    // 2. Validação Final (Lógica do Modal)
    if (slotsEsperados > imagensPreenchidas) {
      // Prepara relatório detalhado se for 'tudo'
      let reportDetalhado = null;
      if (contexto === 'tudo') {
        const qEsp = dadosQuestao ? dadosQuestao.slotsEsperados : 0;
        const qPre = dadosQuestao ? dadosQuestao.imagensPreenchidas : 0;
        const gEsp = dadosGabarito ? dadosGabarito.slotsEsperados : 0;
        const gPre = dadosGabarito ? dadosGabarito.imagensPreenchidas : 0;

        reportDetalhado = {
          faltamQuestao: Math.max(0, qEsp - qPre),
          faltamGabarito: Math.max(0, gEsp - gPre),
        };
      }

      mostrarModalAvisoImagens(
        slotsEsperados,
        imagensPreenchidas,
        () => resolve(true), // Usuário clicou em "Continuar mesmo assim"
        () => resolve(false), // Usuário clicou em "Voltar"
        reportDetalhado,
      );
    } else {
      resolve(true);
    }
  });
}
