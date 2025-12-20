import { mostrarModalAvisoImagens } from './modal-aviso-imagens.js';

export function calcularMetricasQuestao() {
  let slotsEsperados = 0;
  let imagensPreenchidas = 0;
  const q = window.__ultimaQuestaoExtraida;

  // Se não tem questão, retorna null para indicar que deve ignorar/aprovar
  if (!q) return null;

  // Contagem de Slots Esperados
  if (Array.isArray(q.estrutura)) {
    slotsEsperados += q.estrutura.filter((b) => b.tipo === 'imagem').length;
  }
  if (Array.isArray(q.alternativas)) {
    q.alternativas.forEach((alt) => {
      if (Array.isArray(alt.estrutura)) {
        slotsEsperados += alt.estrutura.filter(
          (b) => b.tipo === 'imagem'
        ).length;
      }
    });
  }

  // Contagem de Imagens Preenchidas
  imagensPreenchidas += (window.__imagensLimpas?.questao_original || []).filter(
    Boolean
  ).length;
  const altsMap = window.__imagensLimpas?.alternativas?.questao || {};
  Object.values(altsMap).forEach((lista) => {
    if (Array.isArray(lista))
      imagensPreenchidas += lista.filter(Boolean).length;
  });

  return { slotsEsperados, imagensPreenchidas };
}

export function calcularMetricasGabarito() {
  let slotsEsperados = 0;
  let imagensPreenchidas = 0;
  const g = window.__ultimoGabaritoExtraido;

  // Se não tem gabarito, retorna null para indicar que deve ignorar/aprovar
  if (!g) return null;

  // Percorre a Explicação (Passo a Passo)
  if (Array.isArray(g.explicacao)) {
    g.explicacao.forEach((passo, idx) => {
      // Conta Slots no passo
      if (Array.isArray(passo.estrutura)) {
        slotsEsperados += passo.estrutura.filter(
          (b) => b.tipo === 'imagem'
        ).length;
      }

      // Conta Imagens salvas para este passo
      const imgsSalvasPasso =
        window.__imagensLimpas?.gabarito_passos?.[idx] || [];
      imagensPreenchidas += imgsSalvasPasso.filter(Boolean).length;
    });
  }

  return { slotsEsperados, imagensPreenchidas };
}

export async function validarProgressoImagens(contexto = 'questao') {
  return new Promise((resolve) => {
    let dados;

    // 1. Decide qual cálculo fazer baseando-se no contexto
    if (contexto === 'questao') {
      dados = calcularMetricasQuestao();
    } else if (contexto === 'gabarito') {
      dados = calcularMetricasGabarito();
    }

    // Se dados for null (não tinha objeto extraído), aprova direto (lógica original)
    if (!dados) {
      resolve(true);
      return;
    }

    const { slotsEsperados, imagensPreenchidas } = dados;

    // 2. Validação Final (Lógica do Modal)
    if (slotsEsperados > imagensPreenchidas) {
      mostrarModalAvisoImagens(
        slotsEsperados,
        imagensPreenchidas,
        () => resolve(true), // Usuário clicou em "Continuar mesmo assim"
        () => resolve(false) // Usuário clicou em "Voltar"
      );
    } else {
      resolve(true);
    }
  });
}