import { renderizar_estrutura_alternativa } from './structure.js';

export const renderAlternativas = (alts) => {
  if (!alts || alts.length === 0)
    return `<div class="data-box">Sem alternativas</div>`;

  return alts
    .map((a) => {
      const letra = String(a?.letra ?? '')
        .trim()
        .toUpperCase();
      const estrutura = Array.isArray(a?.estrutura)
        ? a.estrutura
        : [{ tipo: 'texto', conteudo: String(a?.texto ?? '') }];

      // Ela sabe buscar as imagens salvas em window.__imagensLimpas.alternativas.questao[letra]
      // e gera os botões com o onclick correto (iniciar_captura_para_slot_alternativa)
      const htmlEstr = renderizar_estrutura_alternativa(estrutura, letra);

      return `<div class="alt-row">
      <span class="alt-letter">${letra}</span>
      <div class="alt-content">${htmlEstr}</div>
    </div>`;
    })
    .join('');
};