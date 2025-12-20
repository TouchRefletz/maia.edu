import { gerarHtmlCorpoQuestao } from './card-partes.js';
import { prepararImagensVisualizacao } from './imagens.js';
import { renderBotaoScanGabarito } from './card-partes.js';
import { renderCreditosCompleto } from './card-partes.js';
import { renderMatrizComplexidade } from './card-partes.js';
import { renderPassosComDetalhes } from './card-partes.js';
import { renderizar_estrutura_alternativa } from '../render/structure.js';

export function prepararElementoCard(idFirebase, q, g, meta) {
  // 1. Criação do elemento DOM
  const card = document.createElement('div');
  card.className = 'q-card';
  card.id = `card_${idFirebase}`;

  // 2. Configuração dos Datasets (Para Filtros)
  card.dataset.materia = (q.materias_possiveis || []).join(' ');
  card.dataset.origem = meta.material_origem || '';

  // Concatena texto da estrutura ou do enunciado legado para busca
  const textoBusca = q.estrutura
    ? q.estrutura.map((b) => b.conteudo).join(' ')
    : q.enunciado || '';

  card.dataset.texto = (
    textoBusca +
    ' ' +
    (q.identificacao || '')
  ).toLowerCase();

  // 3. Geração do HTML das Alternativas
  const cardId = `q_${idFirebase}`;

  const htmlAlts = (q.alternativas || [])
    .map((alt) => {
      const letra = alt.letra.trim().toUpperCase();
      let conteudoHtml = '';

      if (alt.estrutura) {
        // MUDANÇA: Passa 'banco' como contexto para desabilitar edição
        // Assume que renderizar_estrutura_alternativa está no escopo global
        conteudoHtml = renderizar_estrutura_alternativa(
          alt.estrutura,
          letra,
          [],
          'banco'
        );
      } else {
        conteudoHtml = alt.texto || '';
      }

      // Gera o botão interativo
      return `
        <button 
            class="q-opt-btn js-verificar-resp" 
            data-card-id="${cardId}" 
            data-letra="${letra}" 
            data-correta="${g.alternativa_correta}"
        >
            <span class="q-opt-letter">${letra})</span>
            <div class="q-opt-content">${conteudoHtml}</div>
        </button>`;
    })
    .join('');

  return { card, htmlAlts, cardId };
}

/**
 * Gera o cabeçalho do card com ID e origem.
 */
export function gerarHtmlHeader(id, meta) {
  return `
        <div class="q-header">
            <div style="display:flex; align-items:center; gap:10px;">
                <span class="q-id-badge">${id}</span>
                <span style="font-weight:bold; color:var(--color-text); font-size:0.9rem;">
                    ${meta.material_origem || 'Banco'}
                </span>
            </div>
        </div>`;
}

/**
 * Gera a seção de tags (matérias e palavras-chave).
 */
export function gerarHtmlTags(questao) {
  const materias = (questao.materias_possiveis || [])
    .map((m) => `<span class="q-tag highlight">${m}</span>`)
    .join('');

  const keywords = (questao.palavras_chave || [])
    .map((t) => `<span class="q-tag">${t}</span>`)
    .join('');

  return `
        <div class="q-tags">
            ${materias}
            ${keywords}
        </div>`;
}

/**
 * Gera o bloco de resolução (gabarito, justificativa, passos, etc) que inicia oculto.
 */
export function gerarHtmlResolucao(cardId, gabarito, rawImgsG, jsonImgsG) {
  const confianca = Math.round((gabarito.confianca || 0) * 100);
  const justificativa = gabarito.justificativa_curta || 'Sem justificativa.';

  return `
        <div id="${cardId}_res" class="q-resolution" style="display:none;">
            <div class="q-res-header">
                <div style="display:flex; align-items:center; gap:10px;">
                    <span class="q-res-badge">Gabarito: ${gabarito.alternativa_correta}</span>
                    <span style="font-size:0.8rem; color:var(--color-text-secondary);">
                        Confiança IA: ${confianca}%
                    </span>
                </div>
            </div>
            <div class="q-res-section">
                <span class="q-res-label">Justificativa</span>
                <p class="markdown-content" style="margin:0; line-height:1.5;">${justificativa}</p>
            </div>
            ${renderPassosComDetalhes(gabarito)}
            ${renderMatrizComplexidade(gabarito)}
            ${renderBotaoScanGabarito(rawImgsG, jsonImgsG)}
            ${renderCreditosCompleto(gabarito)}
        </div>`;
}

/**
 * Gera o rodapé com botões de ação (Ver Original, Ver Gabarito).
 */
export function gerarHtmlFooter(cardId, imgsOriginalQ, jsonImgsQ) {
  const btnScan =
    imgsOriginalQ.length > 0
      ? `<button class="q-action-link js-ver-scan" data-imgs="${jsonImgsQ}">📄 Ver Original (Enunciado)</button>`
      : '';

  return `
        <div class="q-footer">
            ${btnScan}
            <button class="q-action-link js-toggle-gabarito" data-card-id="${cardId}" title="Ver/Esconder Gabarito">
                👁️ Ver/Esconder Gabarito
            </button>
        </div>`;
}

/**
 * Função principal que orquestra a criação do card técnico.
 */
export function criarCardTecnico(idFirebase, fullData) {
  // Desestrutura os dados necessários
  const q = fullData.dados_questao || {};
  const g = fullData.dados_gabarito || {};
  const meta = fullData.meta || {};

  // 1. Prepara imagens e suporte visual
  const {
    jsonImgsQ,
    jsonImgsG,
    htmlImgsSuporte,
    rawImgsQ: imgsOriginalQ,
    rawImgsG,
  } = prepararImagensVisualizacao(fullData);

  // 2. Prepara o conteúdo do corpo da questão
  const htmlCorpoQuestao = gerarHtmlCorpoQuestao(
    q,
    imgsOriginalQ,
    htmlImgsSuporte
  );

  // 3. Cria o elemento base do card e gera o HTML das alternativas
  // Nota: Assumo que 'prepararElementoCard' já cria o div container e gera o ID único
  const { card, htmlAlts, cardId } = prepararElementoCard(
    idFirebase,
    q,
    g,
    meta
  );

  // 4. Monta o HTML final juntando as partes modularizadas
  card.innerHTML = [
    gerarHtmlHeader(idFirebase, meta),
    gerarHtmlTags(q),
    `<div class="q-body">${htmlCorpoQuestao}</div>`,
    `<div class="q-options" id="${cardId}_opts">${htmlAlts}</div>`,
    gerarHtmlResolucao(cardId, g, rawImgsG, jsonImgsG),
    gerarHtmlFooter(cardId, imgsOriginalQ, jsonImgsQ),
  ].join('');

  return card;
}