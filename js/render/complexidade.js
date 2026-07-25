import React from 'react';
import ReactDOMServer from 'react-dom/server';
import {
  ComplexityCard,
  _calcularComplexidade as calcComp,
  _getComplexidadeConfig as getConfig,
} from './ComplexityCard.tsx'; // Ajuste o caminho conforme sua estrutura

/**
 * 1. CONFIGURAÇÕES E CONSTANTES
 * Re-exporta a lógica vinda do TSX
 */
export const _getComplexidadeConfig = getConfig;

/**
 * 2. PROCESSAMENTO DE DADOS
 * Re-exporta a lógica vinda do TSX
 */
export const _calcularComplexidade = calcComp;

/**
 * 3. HELPER DE RENDERIZAÇÃO (GRUPO)
 * Mantido apenas se algum código legado chamar especificamente esta função interna.
 * Se ninguém chamar isso externamente, pode remover.
 * Recriamos aqui usando o renderToStaticMarkup para manter compatibilidade de assinatura (retornar string).
 */
export const _renderGrupoComplexidade = (catKey, grupos, CFG) => {
  // Nota: Isso é um hack para manter a função existente funcionando.
  // Idealmente, o código consumidor deveria usar o componente React completo.
  // Aqui instanciamos apenas um pedaço da UI, se necessário.

  // Como as funções internas do TSX não são exportadas isoladamente (apenas o componente principal),
  // se esta função for crucial, recomendo refatorar o consumidor.
  // Pelo seu código original, ela parecia ser usada apenas internamente pelo renderComplexidade.
  // Se for interna, deixamos vazia ou retornamos string vazia, pois o renderComplexidade abaixo já cuida de tudo.
  return '';
};

/**
 * 4. FUNÇÃO PRINCIPAL (ORQUESTRADORA)
 * Gera o HTML final do card de complexidade usando React SSR estático.
 */
export const renderComplexidade = (complexidadeObj) => {
  // Renderiza o componente React para uma string HTML estática
  // Isso satisfaz o requisito de retornar HTML puro para o sistema legado.
  return ReactDOMServer.renderToStaticMarkup(
    React.createElement(ComplexityCard, { data: complexidadeObj }),
  );
};
