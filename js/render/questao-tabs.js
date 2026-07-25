import React from 'react';
import ReactDOM from 'react-dom/client';
import ReactDOMServer from 'react-dom/server';
import {
  AcoesGabaritoView,
  DetalhesTecnicos,
  GabaritoCardView,
  GabaritoEditorView,
  MetaGabarito,
  OpcoesGabarito,
  PassosExplicacao,
  prepararDadosGabarito as prepararDadosGabaritoTSX,
} from './GabaritoCard.tsx';
import QuestaoTabs from './QuestaoTabs.tsx';

export function mountQuestaoTabs(container, questao, gabarito, options = {}) {
  if (!container) return;

  // Verifica se já existe uma root React anexada ao container
  let root = container._reactRoot;

  if (!root) {
    // Se não existir, cria uma nova e salva no container
    root = ReactDOM.createRoot(container);
    container._reactRoot = root;
  }

  // Renderiza (ou re-renderiza) usando a root existente
  root.render(
    React.createElement(QuestaoTabs, {
      questao,
      gabarito,
      containerRef: container,
      isReadOnly: options.isReadOnly || false,
      isReviewMode: options.isReviewMode || false,
      onReviewSubmit: options.onReviewSubmit || null,
      onReviewSubmit: options.onReviewSubmit || null,
      onReviewChange: options.onReviewChange || null,
      aiThoughtsHtml: options.aiThoughtsHtml || null, // [NOVO] Repassa o HTML dos pensamentos
    }),
  );
  return root;
}

/**
 * Centraliza toda a extração e normalização de dados do gabarito.
 * Redireciona para a implementação TypeScript.
 */
export function prepararDadosGabarito(gabarito, questao) {
  return prepararDadosGabaritoTSX(gabarito, questao);
}

/**
 * Renderiza o cartão principal do gabarito.
 * Usa ReactDOMServer para converter o componente React em string HTML estática,
 * mantendo a compatibilidade com o sistema legado que espera innerHTML.
 */
export function renderCartaoGabarito(dados) {
  return ReactDOMServer.renderToStaticMarkup(React.createElement(GabaritoCardView, { dados }));
}

/**
 * Renderiza os botões de ação (Editar/Finalizar).
 */
export function renderAcoesGabarito() {
  return ReactDOMServer.renderToStaticMarkup(React.createElement(AcoesGabaritoView));
}

/**
 * Renderiza o formulário de edição completo.
 */
export function renderFormularioEditor(dados) {
  return ReactDOMServer.renderToStaticMarkup(React.createElement(GabaritoEditorView, { dados }));
}

// --- Sub-funções de Renderização Visual (Legado) ---
// Mantidas exportadas caso algum outro arquivo as chame diretamente,
// mas agora usando os sub-componentes React internamente.

export function _renderMetaGabarito(confianca, creditos) {
  return ReactDOMServer.renderToStaticMarkup(
    React.createElement(MetaGabarito, { confianca, creditos }),
  );
}

export function _renderOpcoesGabarito(questao, respostaLetra, alternativasAnalisadas) {
  return ReactDOMServer.renderToStaticMarkup(
    React.createElement(OpcoesGabarito, {
      questao,
      respostaLetra,
      alternativasAnalisadas,
    }),
  );
}

export function _renderPassosExplicacao(explicacaoArray) {
  return ReactDOMServer.renderToStaticMarkup(
    React.createElement(PassosExplicacao, { explicacaoArray }),
  );
}

export function _renderDetalhesTecnicos(dados) {
  return ReactDOMServer.renderToStaticMarkup(React.createElement(DetalhesTecnicos, { dados }));
}

// As sub-funções do editor (_renderEditorPassos, etc) eram usadas apenas internamente
// pelo renderFormularioEditor no original. Como renderFormularioEditor agora renderiza
// o componente React completo <GabaritoEditorView>, não é estritamente necessário
// exportar as sub-partes do editor, a menos que haja código externo dependendo especificamente delas.
// Se necessário, seguiria o mesmo padrão: renderToStaticMarkup(<EditorPassos ... />).
